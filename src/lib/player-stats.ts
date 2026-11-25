import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isSupabaseConfigured, supabase } from "./supabase";

export interface PlayerStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  bestNetWorth: number;
}

export async function fetchLocalPlayerStats(userId: string): Promise<PlayerStats> {
  const { createLocalDbClient } = await import("./local-online-store.server");
  const db = createLocalDbClient(userId);
  const { data } = await db.from("game_results").select("won, net_worth").eq("user_id", userId);
  const rows = (data ?? []) as { won: boolean; net_worth: number }[];
  const gamesPlayed = rows.length;
  const wins = rows.filter((r) => r.won).length;
  const losses = Math.max(0, gamesPlayed - wins);
  const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;
  const bestNetWorth = rows.reduce((max, r) => Math.max(max, r.net_worth ?? 0), 0);
  return { gamesPlayed, wins, losses, winRate, bestNetWorth };
}

export const getPlayerStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { isSupabaseAdminConfigured } = await import("@/integrations/supabase/client.server");
    const isLocal =
      (context.claims &&
        typeof context.claims === "object" &&
        "iss" in context.claims &&
        (context.claims as { iss?: unknown }).iss === "ekopoly-local") ||
      (!isSupabaseAdminConfigured() && !process.env["SUPABASE_URL"]);
    if (isLocal) {
      return await fetchLocalPlayerStats(context.userId);
    }
    const { data, error } = await context.supabase
      .from("game_results")
      .select("won, net_worth")
      .eq("user_id", context.userId);
    if (error) {
      console.warn("getPlayerStats error", error);
      return { gamesPlayed: 0, wins: 0, losses: 0, winRate: 0, bestNetWorth: 0 };
    }
    const rows = data ?? [];
    const gamesPlayed = rows.length;
    const wins = rows.filter((r) => r.won).length;
    const losses = Math.max(0, gamesPlayed - wins);
    const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;
    const bestNetWorth = rows.reduce((max, r) => Math.max(max, r.net_worth ?? 0), 0);
    return { gamesPlayed, wins, losses, winRate, bestNetWorth };
  });

export const playerStatsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["player-stats", userId],
    retry: false,
    refetchInterval: isSupabaseConfigured() ? 10_000 : 2_000,
    queryFn: async (): Promise<PlayerStats> => {
      if (!isSupabaseConfigured()) {
        return await fetchLocalPlayerStats(userId);
      }
      const { data, error } = await supabase
        .from("game_results")
        .select("won, net_worth")
        .eq("user_id", userId);
      if (error) throw error;
      const rows = data ?? [];
      const gamesPlayed = rows.length;
      const wins = rows.filter((r) => r.won).length;
      const losses = Math.max(0, gamesPlayed - wins);
      const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;
      const bestNetWorth = rows.reduce((max, r) => Math.max(max, r.net_worth ?? 0), 0);
      return { gamesPlayed, wins, losses, winRate, bestNetWorth };
    },
  });
