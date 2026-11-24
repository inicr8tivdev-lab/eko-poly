import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canAct, createGame, endGameEarly, netWorth, reduce, rollDice, type Action, type GameState } from "@/game/engine";
import { getPublicSupabaseConfig } from "@/integrations/supabase/publicConfig";
import { isValidAvatar } from "./avatar";
import { appendChatMessage, cleanChatText, extractChatMessages, type ChatMessage } from "./chat";
import { MAX_PLAYERS, MIN_PLAYERS, actionSchema, cleanName, isValidCode, makeCode, nextFreeSeat, normalizeCode } from "./rooms";

const avatarSchema = z
  .string()
  .max(45_000)
  .refine((v) => isValidAvatar(v), "Invalid avatar or larger than 30 KB.")
  .nullable()
  .optional();

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

function isMissingTableError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const code = (error.code ?? "").toUpperCase();
  const msg = (error.message ?? "").toLowerCase();
  return code === "PGRST205" || code === "42P01" || msg.includes("schema cache") || msg.includes("does not exist");
}

function isLocalContext(claims: unknown): boolean {
  return Boolean(
    claims && typeof claims === "object" && "iss" in claims && (claims as { iss?: unknown }).iss === "ekopoly-local",
  );
}

function isRemoteSupabaseEnv(): boolean {
  return Boolean(getPublicSupabaseConfig().url);
}

async function admin(fallback?: unknown, claims?: unknown) {
  if (isLocalContext(claims) && fallback) {
    return fallback as Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];
  }
  const { isSupabaseAdminConfigured, supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!isSupabaseAdminConfigured() && isRemoteSupabaseEnv() && fallback) {
    return fallback as typeof supabaseAdmin;
  }
  return supabaseAdmin;
}

/** Bump updated_at so everyone watching the room refreshes. */
async function touch(gameId: string, fallback?: unknown, claims?: unknown) {
  const db = await admin(fallback, claims);
  await db.from("games").update({ updated_at: new Date().toISOString() }).eq("id", gameId);
}

async function saveName(userId: string, name: string, fallback?: unknown, claims?: unknown) {
  const db = await admin(fallback, claims);
  const { error } = await db.from("profiles").upsert({ id: userId, display_name: name });
  if (error) console.warn("saveName", error);
}

async function saveAvatarIfLocal(
  userId: string,
  avatar: string | null | undefined,
  gameId?: string,
  claims?: unknown,
) {
  if (avatar === undefined) return;
  const { isSupabaseAdminConfigured } = await import("@/integrations/supabase/client.server");
  if (!isLocalContext(claims) && (isSupabaseAdminConfigured() || isRemoteSupabaseEnv())) return;
  const { setLocalProfileAvatar, setLocalRoomPlayerAvatar } = await import("./local-online-store.server");
  if (gameId) setLocalRoomPlayerAvatar(userId, gameId, avatar);
  else setLocalProfileAvatar(userId, avatar);
}

export const createRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().max(40),
        maxRounds: z.number().int().min(5).max(100).nullable(),
        avatar: avatarSchema,
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<Result<{ code: string }>> => {
    const name = cleanName(data.name);
    const db = await admin(context.supabase, context.claims);
    await saveName(context.userId, name, context.supabase, context.claims);

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = makeCode(crypto.getRandomValues(new Uint32Array(8)));
      const gameId = crypto.randomUUID();
      const { error } = await db
        .from("games")
        .insert({ id: gameId, host_id: context.userId, mode: "online", status: "lobby", code, max_rounds: data.maxRounds });
      if (error?.code === "23505") continue; // code already used, try another
      if (error) {
        console.error("createRoom", error);
        if (isMissingTableError(error)) {
          return { ok: false, error: "Database tables are not set up yet on this Supabase project." };
        }
        return { ok: false, error: "Could not create the room. Please try again." };
      }
      const { error: playerErr } = await db
        .from("game_players")
        .insert({ game_id: gameId, user_id: context.userId, seat: 0, display_name: name });
      if (playerErr) {
        console.error("createRoom playerErr", playerErr);
        await db.from("games").delete().eq("id", gameId);
        if (isMissingTableError(playerErr)) {
          return { ok: false, error: "Database tables are not set up yet on this Supabase project." };
        }
        return { ok: false, error: "Could not create the room. Please try again." };
      }
      await saveAvatarIfLocal(context.userId, data.avatar, gameId, context.claims);
      return { ok: true, code };
    }
    return { ok: false, error: "Could not create the room. Please try again." };
  });

export const joinRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ code: z.string().max(20), name: z.string().max(40), avatar: avatarSchema }).parse(d),
  )
  .handler(async ({ data, context }): Promise<Result<{ code: string }>> => {
    const code = normalizeCode(data.code);
    if (!isValidCode(code)) return { ok: false, error: "That code doesn't look right. Codes have 6 letters and numbers." };
    const db = await admin(context.supabase, context.claims);
    const { data: game, error: gameErr } = await db
      .from("games")
      .select("id, status")
      .eq("code", code)
      .eq("mode", "online")
      .maybeSingle();
    if (gameErr) {
      console.error("joinRoom gameErr", gameErr);
      if (isMissingTableError(gameErr)) {
        return { ok: false, error: "Database tables are not set up yet on this Supabase project." };
      }
      return { ok: false, error: "Could not look up that room right now. Please try again." };
    }
    if (!game) return { ok: false, error: "No room with that code. Check it with your friend." };

    const { data: players } = await db.from("game_players").select("user_id, seat").eq("game_id", game.id);
    const list = players ?? [];
    if (list.some((p) => p.user_id === context.userId)) {
      if (game.status === "lobby") await saveAvatarIfLocal(context.userId, data.avatar, game.id, context.claims);
      return { ok: true, code };
    }
    if (game.status !== "lobby") return { ok: false, error: "This game has already started without you." };
    if (list.length >= MAX_PLAYERS) return { ok: false, error: `This room is full (${MAX_PLAYERS} players max).` };

    const name = cleanName(data.name);
    await saveName(context.userId, name, context.supabase, context.claims);
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: again } = await db.from("game_players").select("seat").eq("game_id", game.id);
      const seat = nextFreeSeat((again ?? []).map((p) => p.seat));
      if (seat === null) return { ok: false, error: `This room is full (${MAX_PLAYERS} players max).` };
      const { error } = await db
        .from("game_players")
        .insert({ game_id: game.id, user_id: context.userId, seat, display_name: name });
      if (!error) {
        await saveAvatarIfLocal(context.userId, data.avatar, game.id, context.claims);
        await touch(game.id, context.supabase, context.claims);
        return { ok: true, code };
      }
      if (error.code !== "23505") {
        console.error("joinRoom", error);
        break;
      }
    }
    return { ok: false, error: "Could not join the room. Please try again." };
  });

export const leaveRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ gameId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<Result> => {
    // Reading through the caller's own access confirms they belong to this room.
    const { data: game } = await context.supabase.from("games").select("id, host_id, status").eq("id", data.gameId).maybeSingle();
    if (!game) return { ok: false, error: "Room not found." };
    if (game.status !== "lobby") return { ok: false, error: "The game has started — you can't leave the room now." };
    const db = await admin(context.supabase, context.claims);
    if (game.host_id === context.userId) {
      await db.from("games").delete().eq("id", game.id);
    } else {
      await db.from("game_players").delete().eq("game_id", game.id).eq("user_id", context.userId);
      await touch(game.id, context.supabase, context.claims);
    }
    return { ok: true };
  });

export const startRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ gameId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<Result> => {
    const { data: game } = await context.supabase
      .from("games")
      .select("id, host_id, status, max_rounds, state")
      .eq("id", data.gameId)
      .maybeSingle();
    if (!game) return { ok: false, error: "Room not found." };
    if (game.host_id !== context.userId) return { ok: false, error: "Only the host can start the game." };
    if (game.status !== "lobby") return { ok: false, error: "This game has already started." };

    const db = await admin(context.supabase, context.claims);
    const { data: players } = await db
      .from("game_players")
      .select("user_id, seat, display_name")
      .eq("game_id", game.id)
      .order("seat");
    const list = players ?? [];
    if (list.length < MIN_PLAYERS) return { ok: false, error: `You need at least ${MIN_PLAYERS} players to start.` };

    // Close any gaps left by people who left, so seat N is player N in the game.
    for (const [i, p] of list.entries()) {
      if (p.seat !== i) await db.from("game_players").update({ seat: i }).eq("game_id", game.id).eq("user_id", p.user_id);
    }
    let avatars: Record<string, string | null> = {};
    const { isSupabaseAdminConfigured } = await import("@/integrations/supabase/client.server");
    if (isLocalContext(context.claims) || (!isSupabaseAdminConfigured() && !isRemoteSupabaseEnv())) {
      const { getLocalRoomPlayerAvatars } = await import("./local-online-store.server");
      avatars = getLocalRoomPlayerAvatars(game.id);
    }
    const lobbyChat = extractChatMessages(game.state);
    const createdState = createGame(
      list.map((p) => ({ name: p.display_name, isCpu: false, avatar: avatars[p.user_id] ?? null })),
      Math.random,
      game.max_rounds,
    );
    const state: GameState = lobbyChat.length > 0 ? { ...createdState, chat: lobbyChat } : createdState;
    const { error } = await db
      .from("games")
      .update({ status: "playing", state: state as never, version: 1 })
      .eq("id", game.id)
      .eq("status", "lobby");
    if (error) {
      console.error("startRoom", error);
      return { ok: false, error: "Could not start the game. Please try again." };
    }
    return { ok: true };
  });

export const sendMove = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ gameId: z.string().uuid(), move: actionSchema }).parse(d))
  .handler(async ({ data, context }): Promise<Result> => {
    const { data: me } = await context.supabase
      .from("game_players")
      .select("seat")
      .eq("game_id", data.gameId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!me) return { ok: false, error: "You're not in this game." };
    const { data: game } = await context.supabase
      .from("games")
      .select("id, status, state, version")
      .eq("id", data.gameId)
      .maybeSingle();
    if (!game || game.status !== "playing" || !game.state) return { ok: false, error: "This game isn't running." };

    const state = game.state as unknown as GameState;
    if (!canAct(state, me.seat)) return { ok: false, error: "Hold on — it's not your move." };

    const action: Action = data.move.type === "roll" ? { type: "roll", dice: rollDice() } : (data.move as Action);
    const next = reduce(state, action);
    if (next === state) return { ok: false, error: "That move isn't allowed right now." };

    const db = await admin(context.supabase, context.claims);
    const finished = next.phase === "gameover";
    const winner = next.winner !== null ? next.players[next.winner] : undefined;
    const { data: saved, error } = await db
      .from("games")
      .update({
        state: next as never,
        version: game.version + 1,
        ...(finished ? { status: "finished", winner_name: winner?.name ?? null } : {}),
      })
      .eq("id", game.id)
      .eq("version", game.version)
      .select("id");
    if (error) {
      console.error("sendMove", error);
      return { ok: false, error: "Could not save that move. Please try again." };
    }
    if (!saved?.length) return { ok: false, error: "Someone moved at the same time — the board has been refreshed." };

    if (finished) await saveResults(game.id, next, context.supabase, context.claims);
    return { ok: true };
  });

export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        gameId: z.string().uuid(),
        text: z.string().max(400),
        clientId: z.string().min(1).max(64).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<Result<{ message: ChatMessage }>> => {
    const text = cleanChatText(data.text);
    if (!text) return { ok: false, error: "Type a message first." };

    const { data: me } = await context.supabase
      .from("game_players")
      .select("seat, display_name")
      .eq("game_id", data.gameId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!me) return { ok: false, error: "You're not in this room." };

    const message: ChatMessage = {
      id: data.clientId ?? crypto.randomUUID(),
      seat: me.seat,
      sender: cleanName(me.display_name),
      text,
      sentAt: new Date().toISOString(),
    };

    const db = await admin(context.supabase, context.claims);
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: game, error: loadErr } = await db
        .from("games")
        .select("id, status, state, version")
        .eq("id", data.gameId)
        .maybeSingle();
      if (loadErr) {
        console.error("sendChatMessage loadErr", loadErr);
        return { ok: false, error: "Could not send message right now." };
      }
      if (!game) return { ok: false, error: "Room not found." };

      const existing = extractChatMessages(game.state);
      const already = existing.find((m) => m.id === message.id);
      if (already) return { ok: true, message: already };

      const nextChat = appendChatMessage(existing, message);
      const baseState =
        game.status === "lobby" || !game.state || typeof game.state !== "object"
          ? {}
          : (game.state as Record<string, unknown>);
      const nextState = { ...baseState, chat: nextChat };

      const { data: saved, error } = await db
        .from("games")
        .update({ state: nextState as never, updated_at: new Date().toISOString() })
        .eq("id", game.id)
        .eq("version", game.version)
        .select("id");
      if (error) {
        console.error("sendChatMessage updateErr", error);
        return { ok: false, error: "Could not send message right now." };
      }
      if (saved?.length) return { ok: true, message };
    }
    return { ok: false, error: "Could not send message right now. Please try again." };
  });

async function saveResults(gameId: string, next: GameState, fallback?: unknown, claims?: unknown) {
  const db = await admin(fallback, claims);
  const { data: players } = await db.from("game_players").select("user_id, seat, display_name").eq("game_id", gameId);
  await db.from("game_results").insert(
    (players ?? []).map((p) => ({
      game_id: gameId,
      user_id: p.user_id,
      display_name: p.display_name,
      won: p.seat === next.winner,
      net_worth: netWorth(next, p.seat),
    })),
  );
}

/** Host only: stop a running game now; the richest player wins. */
export const endRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ gameId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<Result> => {
    const { data: game } = await context.supabase
      .from("games")
      .select("id, host_id, status, state, version")
      .eq("id", data.gameId)
      .maybeSingle();
    if (!game) return { ok: false, error: "Room not found." };
    if (game.host_id !== context.userId) return { ok: false, error: "Only the room creator can end the game." };
    if (game.status !== "playing" || !game.state) return { ok: false, error: "This game isn't running." };
    const next = endGameEarly(game.state as unknown as GameState);
    const winner = next.winner !== null ? next.players[next.winner] : undefined;
    const db = await admin(context.supabase, context.claims);
    const { data: saved, error } = await db
      .from("games")
      .update({ state: next as never, version: game.version + 1, status: "finished", winner_name: winner?.name ?? null })
      .eq("id", game.id)
      .eq("version", game.version)
      .select("id");
    if (error || !saved?.length) return { ok: false, error: "Could not end the game. Please try again." };
    await saveResults(game.id, next, context.supabase, context.claims);
    return { ok: true };
  });

export const getRoomState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ code: z.string().max(20) }).parse(d))
  .handler(async ({ data, context }) => {
    const { getLocalRoomForUser } = await import("./local-online-store.server");
    return getLocalRoomForUser(context.userId, normalizeCode(data.code));
  });

export const getMyRooms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listLocalRoomsForUser } = await import("./local-online-store.server");
    return listLocalRoomsForUser(context.userId);
  });

export const getOpenLobbies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { listLocalOpenLobbies } = await import("./local-online-store.server");
    return listLocalOpenLobbies();
  });

export const getMyProfileName = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getLocalProfileName } = await import("./local-online-store.server");
    return getLocalProfileName(context.userId);
  });

export const getMyProfileAvatar = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { isSupabaseAdminConfigured } = await import("@/integrations/supabase/client.server");
    if (!isLocalContext(context.claims) && (isSupabaseAdminConfigured() || isRemoteSupabaseEnv())) return null;
    const { getLocalProfileAvatar } = await import("./local-online-store.server");
    return getLocalProfileAvatar(context.userId);
  });

export const updateMyAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        avatar: avatarSchema,
        gameId: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<Result> => {
    await saveAvatarIfLocal(context.userId, data.avatar ?? null, data.gameId, context.claims);
    return { ok: true };
  });
