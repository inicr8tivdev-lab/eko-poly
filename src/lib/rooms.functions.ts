import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canAct, createGame, endGameEarly, netWorth, reduce, rollDice, type Action, type GameState } from "@/game/engine";
import { isValidAvatar } from "./avatar";
import { MAX_PLAYERS, MIN_PLAYERS, actionSchema, cleanName, isValidCode, makeCode, nextFreeSeat, normalizeCode } from "./rooms";

const avatarSchema = z
  .string()
  .max(45_000)
  .refine((v) => isValidAvatar(v), "Invalid avatar or larger than 30 KB.")
  .nullable()
  .optional();

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function admin(fallback?: unknown) {
  const { isSupabaseAdminConfigured, supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!isSupabaseAdminConfigured() && process.env["SUPABASE_URL"] && fallback) {
    return fallback as typeof supabaseAdmin;
  }
  return supabaseAdmin;
}

/** Bump updated_at so everyone watching the room refreshes. */
async function touch(gameId: string, fallback?: unknown) {
  const db = await admin(fallback);
  await db.from("games").update({ updated_at: new Date().toISOString() }).eq("id", gameId);
}

async function saveName(userId: string, name: string, fallback?: unknown) {
  const db = await admin(fallback);
  const { error } = await db.from("profiles").upsert({ id: userId, display_name: name });
  if (error) console.warn("saveName", error);
}

async function saveAvatarIfLocal(userId: string, avatar: string | null | undefined, gameId?: string) {
  if (avatar === undefined) return;
  const { isSupabaseAdminConfigured } = await import("@/integrations/supabase/client.server");
  if (isSupabaseAdminConfigured() || process.env["SUPABASE_URL"]) return;
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
    const db = await admin(context.supabase);
    await saveName(context.userId, name, context.supabase);

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = makeCode(crypto.getRandomValues(new Uint32Array(8)));
      const { data: game, error } = await db
        .from("games")
        .insert({ host_id: context.userId, mode: "online", status: "lobby", code, max_rounds: data.maxRounds })
        .select("id")
        .single();
      if (error?.code === "23505") continue; // code already used, try another
      if (error || !game) {
        console.error("createRoom", error);
        return { ok: false, error: "Could not create the room. Please try again." };
      }
      const { error: playerErr } = await db
        .from("game_players")
        .insert({ game_id: game.id, user_id: context.userId, seat: 0, display_name: name });
      if (playerErr) {
        console.error("createRoom playerErr", playerErr);
        await db.from("games").delete().eq("id", game.id);
        return { ok: false, error: "Could not create the room. Please try again." };
      }
      await saveAvatarIfLocal(context.userId, data.avatar, game.id);
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
    const db = await admin(context.supabase);
    const { data: game } = await db.from("games").select("id, status").eq("code", code).eq("mode", "online").maybeSingle();
    if (!game) return { ok: false, error: "No room with that code. Check it with your friend." };

    const { data: players } = await db.from("game_players").select("user_id, seat").eq("game_id", game.id);
    const list = players ?? [];
    if (list.some((p) => p.user_id === context.userId)) {
      if (game.status === "lobby") await saveAvatarIfLocal(context.userId, data.avatar, game.id);
      return { ok: true, code };
    }
    if (game.status !== "lobby") return { ok: false, error: "This game has already started without you." };
    if (list.length >= MAX_PLAYERS) return { ok: false, error: `This room is full (${MAX_PLAYERS} players max).` };

    const name = cleanName(data.name);
    await saveName(context.userId, name, context.supabase);
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: again } = await db.from("game_players").select("seat").eq("game_id", game.id);
      const seat = nextFreeSeat((again ?? []).map((p) => p.seat));
      if (seat === null) return { ok: false, error: `This room is full (${MAX_PLAYERS} players max).` };
      const { error } = await db
        .from("game_players")
        .insert({ game_id: game.id, user_id: context.userId, seat, display_name: name });
      if (!error) {
        await saveAvatarIfLocal(context.userId, data.avatar, game.id);
        await touch(game.id, context.supabase);
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
    const db = await admin(context.supabase);
    if (game.host_id === context.userId) {
      await db.from("games").delete().eq("id", game.id);
    } else {
      await db.from("game_players").delete().eq("game_id", game.id).eq("user_id", context.userId);
      await touch(game.id, context.supabase);
    }
    return { ok: true };
  });

export const startRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ gameId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<Result> => {
    const { data: game } = await context.supabase
      .from("games")
      .select("id, host_id, status, max_rounds")
      .eq("id", data.gameId)
      .maybeSingle();
    if (!game) return { ok: false, error: "Room not found." };
    if (game.host_id !== context.userId) return { ok: false, error: "Only the host can start the game." };
    if (game.status !== "lobby") return { ok: false, error: "This game has already started." };

    const db = await admin(context.supabase);
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
    if (!isSupabaseAdminConfigured() && !process.env["SUPABASE_URL"]) {
      const { getLocalRoomPlayerAvatars } = await import("./local-online-store.server");
      avatars = getLocalRoomPlayerAvatars(game.id);
    }
    const state = createGame(
      list.map((p) => ({ name: p.display_name, isCpu: false, avatar: avatars[p.user_id] ?? null })),
      Math.random,
      game.max_rounds,
    );
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

    const db = await admin(context.supabase);
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

    if (finished) await saveResults(game.id, next, context.supabase);
    return { ok: true };
  });

async function saveResults(gameId: string, next: GameState, fallback?: unknown) {
  const db = await admin(fallback);
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
    const db = await admin(context.supabase);
    const { data: saved, error } = await db
      .from("games")
      .update({ state: next as never, version: game.version + 1, status: "finished", winner_name: winner?.name ?? null })
      .eq("id", game.id)
      .eq("version", game.version)
      .select("id");
    if (error || !saved?.length) return { ok: false, error: "Could not end the game. Please try again." };
    await saveResults(game.id, next, context.supabase);
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
    if (isSupabaseAdminConfigured() || process.env["SUPABASE_URL"]) return null;
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
    await saveAvatarIfLocal(context.userId, data.avatar ?? null, data.gameId);
    return { ok: true };
  });
