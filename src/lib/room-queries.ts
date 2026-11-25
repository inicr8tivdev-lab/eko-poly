import { queryOptions } from "@tanstack/react-query";
import { isSupabaseConfigured, supabase } from "./supabase";
import type { GameState } from "@/game/engine";
import { loadSavedAvatar } from "./avatar";
import { extractChatMessages, type ChatMessage } from "./chat";
import { MAX_PLAYERS } from "./rooms";
import {
  getMyProfileAvatar,
  getMyProfileName,
  getMyRooms,
  getOpenLobbies,
  getRoomState,
} from "./rooms.functions";

export interface RoomPlayer {
  user_id: string;
  seat: number;
  display_name: string;
  avatar?: string | null;
}

export interface Room {
  id: string;
  code: string;
  status: "lobby" | "playing" | "finished";
  host_id: string;
  max_rounds: number | null;
  state: GameState | null;
  chat: ChatMessage[];
  version: number;
  winner_name: string | null;
  players: RoomPlayer[];
}

export interface LobbyPlayer {
  display_name: string;
  user_id: string;
  seat: number;
}

export interface OpenLobby {
  id: string;
  code: string;
  status: string;
  max_rounds: number | null;
  host_id: string;
  updated_at: string;
  game_players: LobbyPlayer[];
}

/** Keeps active online lobbies that still have open seats and sorts players by seat. */
export function filterOpenLobbies(
  rows: ReadonlyArray<{
    id?: string;
    code?: string | null;
    status?: string;
    max_rounds?: number | null;
    host_id?: string;
    updated_at?: string;
    game_players?: LobbyPlayer[] | null;
  }>,
): OpenLobby[] {
  const out: OpenLobby[] = [];
  for (const r of rows) {
    if (r.status !== "lobby" || !r.code || !r.id) continue;
    const players = [...(r.game_players ?? [])].sort((a, b) => a.seat - b.seat);
    if (players.length === 0 || players.length >= MAX_PLAYERS) continue;
    out.push({
      id: r.id,
      code: r.code,
      status: r.status,
      max_rounds: r.max_rounds ?? null,
      host_id: r.host_id ?? "",
      updated_at: r.updated_at ?? "",
      game_players: players,
    });
  }
  return out;
}

/** A room as seen by one of its players; null when it doesn't exist or you haven't joined. */
export const roomQuery = (code: string) =>
  queryOptions({
    queryKey: ["room", code],
    refetchInterval: isSupabaseConfigured() ? 5_000 : 1_500, // fast poll when using local server store
    queryFn: async (): Promise<Room | null> => {
      if (!isSupabaseConfigured()) {
        return (await getRoomState({ data: { code } })) as Room | null;
      }
      const { data, error } = await supabase
        .from("games")
        .select(
          "id, code, status, host_id, max_rounds, state, version, winner_name, game_players(user_id, seat, display_name)",
        )
        .eq("code", code)
        .eq("mode", "online")
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const { game_players, ...rest } = data;
      return {
        ...rest,
        code: rest.code ?? code,
        status: rest.status as Room["status"],
        state: rest.status === "lobby" ? null : (rest.state as unknown as GameState | null),
        chat: extractChatMessages(rest.state),
        players: [...(game_players ?? [])].sort((a, b) => a.seat - b.seat),
      };
    },
  });

export function isAuthFailure(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { message?: unknown; code?: unknown; status?: unknown };
  const msg = typeof err.message === "string" ? err.message.toLowerCase() : "";
  const code = typeof err.code === "string" ? err.code.toUpperCase() : "";
  const status = typeof err.status === "number" ? err.status : 0;
  return (
    status === 401 ||
    code === "PGRST301" ||
    msg.includes("unauthorized") ||
    msg.includes("jwt") ||
    msg.includes("invalid token")
  );
}

export function isMissingSchemaError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { message?: unknown; code?: unknown; status?: unknown };
  const msg = typeof err.message === "string" ? err.message.toLowerCase() : "";
  const code = typeof err.code === "string" ? err.code.toUpperCase() : "";
  return (
    code === "PGRST205" ||
    code === "42P01" ||
    code === "42883" ||
    msg.includes("schema cache") ||
    msg.includes("could not find the table") ||
    (msg.includes("relation") && msg.includes("does not exist"))
  );
}

export const myRoomsQuery = (userId?: string) =>
  queryOptions({
    queryKey: ["my-rooms", userId ?? "current"],
    retry: false,
    refetchInterval: isSupabaseConfigured() ? 5_000 : 1_500,
    queryFn: async () => {
      if (!isSupabaseConfigured()) {
        return await getMyRooms();
      }
      if (userId) {
        const { data: memberships, error: memErr } = await supabase
          .from("game_players")
          .select("game_id")
          .eq("user_id", userId);
        if (memErr) throw memErr;
        const gameIds = Array.from(
          new Set((memberships ?? []).map((m) => m.game_id).filter(Boolean)),
        );
        if (gameIds.length === 0) return [];
        const { data, error } = await supabase
          .from("games")
          .select(
            "id, code, status, max_rounds, host_id, updated_at, game_players(display_name, user_id, seat)",
          )
          .eq("mode", "online")
          .in("id", gameIds)
          .in("status", ["lobby", "playing"])
          .order("updated_at", { ascending: false })
          .limit(30);
        if (error) throw error;
        return (data ?? []).map((r) => ({
          ...r,
          game_players: [...(r.game_players ?? [])].sort((a, b) => a.seat - b.seat),
        }));
      }
      const { data, error } = await supabase
        .from("games")
        .select(
          "id, code, status, max_rounds, host_id, updated_at, game_players(display_name, user_id, seat)",
        )
        .eq("mode", "online")
        .in("status", ["lobby", "playing"])
        .order("updated_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        game_players: [...(r.game_players ?? [])].sort((a, b) => a.seat - b.seat),
      }));
    },
  });

export const openLobbiesQuery = () =>
  queryOptions({
    queryKey: ["open-lobbies"],
    retry: false,
    refetchInterval: isSupabaseConfigured() ? 5_000 : 1_500,
    queryFn: async (): Promise<OpenLobby[]> => {
      if (!isSupabaseConfigured()) {
        const rows = await getOpenLobbies();
        return filterOpenLobbies(rows);
      }
      const { data, error } = await supabase
        .from("games")
        .select(
          "id, code, status, max_rounds, host_id, updated_at, game_players(display_name, user_id, seat)",
        )
        .eq("mode", "online")
        .eq("status", "lobby")
        .order("updated_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return filterOpenLobbies(data ?? []);
    },
  });

export const myNameQuery = (userId: string) =>
  queryOptions({
    queryKey: ["my-name", userId],
    retry: false,
    queryFn: async () => {
      try {
        if (!isSupabaseConfigured()) {
          return await getMyProfileName();
        }
        const { data } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", userId)
          .maybeSingle();
        return data?.display_name ?? "";
      } catch {
        return "";
      }
    },
  });

export const myAvatarQuery = (userId: string) =>
  queryOptions({
    queryKey: ["my-avatar", userId],
    retry: false,
    queryFn: async () => {
      try {
        if (!isSupabaseConfigured()) {
          return (await getMyProfileAvatar()) ?? loadSavedAvatar();
        }
        return loadSavedAvatar();
      } catch {
        return loadSavedAvatar();
      }
    },
  });
