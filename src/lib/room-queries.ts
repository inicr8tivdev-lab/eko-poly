import { queryOptions } from "@tanstack/react-query";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import type { GameState } from "@/game/engine";
import { loadSavedAvatar } from "./avatar";
import { getMyProfileAvatar, getMyProfileName, getMyRooms, getRoomState } from "./rooms.functions";

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
  version: number;
  winner_name: string | null;
  players: RoomPlayer[];
}

/** A room as seen by one of its players; null when it doesn't exist or you haven't joined. */
export const roomQuery = (code: string) =>
  queryOptions({
    queryKey: ["room", code],
    refetchInterval: isSupabaseConfigured() ? 15_000 : 1_500, // fast poll when using local server store
    queryFn: async (): Promise<Room | null> => {
      if (!isSupabaseConfigured()) {
        return (await getRoomState({ data: { code } })) as Room | null;
      }
      const { data, error } = await supabase
        .from("games")
        .select("id, code, status, host_id, max_rounds, state, version, winner_name, game_players(user_id, seat, display_name)")
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
        state: rest.state as unknown as GameState | null,
        players: [...(game_players ?? [])].sort((a, b) => a.seat - b.seat),
      };
    },
  });

export const myRoomsQuery = () =>
  queryOptions({
    queryKey: ["my-rooms"],
    queryFn: async () => {
      if (!isSupabaseConfigured()) {
        return await getMyRooms();
      }
      const { data, error } = await supabase
        .from("games")
        .select("id, code, status, updated_at, game_players(display_name)")
        .eq("mode", "online")
        .in("status", ["lobby", "playing"])
        .order("updated_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

export const myNameQuery = (userId: string) =>
  queryOptions({
    queryKey: ["my-name", userId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) {
        return await getMyProfileName();
      }
      const { data } = await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle();
      return data?.display_name ?? "";
    },
  });

export const myAvatarQuery = (userId: string) =>
  queryOptions({
    queryKey: ["my-avatar", userId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) {
        return (await getMyProfileAvatar()) ?? loadSavedAvatar();
      }
      return loadSavedAvatar();
    },
  });
