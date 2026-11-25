import { useQuery } from "@tanstack/react-query";
import { Award, Flame, Gamepad2, Trophy, Zap } from "lucide-react";
import { playerStatsQuery } from "@/lib/player-stats";
import { formatNaira } from "@/game/board";
import { cn } from "@/lib/utils";

export function PlayerProfileStats({ userId, className }: { userId: string; className?: string }) {
  const { data: stats, isLoading } = useQuery(playerStatsQuery(userId));

  const games = stats?.gamesPlayed ?? 0;
  const wins = stats?.wins ?? 0;
  const losses = stats?.losses ?? 0;
  const winRate = stats?.winRate ?? 0;
  const bestNetWorth = stats?.bestNetWorth ?? 0;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card shadow-sm",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-4 py-3">
        <h2 className="flex items-center gap-2 font-display text-xs font-bold uppercase tracking-widest text-muted-foreground">
          <Award className="size-4 text-primary" /> Online Career Record
        </h2>
        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary">
          {winRate}% Win Rate
        </span>
      </div>

      <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
        <div className="bg-card p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
            <Gamepad2 className="size-4 text-primary" />
            <span className="text-xs uppercase tracking-wider">Total Games</span>
          </div>
          <p className="mt-1 font-display text-2xl font-black">{isLoading ? "—" : games}</p>
        </div>

        <div className="bg-card p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
            <Trophy className="size-4 text-amber-500" />
            <span className="text-xs uppercase tracking-wider">Wins</span>
          </div>
          <p className="mt-1 font-display text-2xl font-black text-amber-600 dark:text-amber-400">
            {isLoading ? "—" : wins}
          </p>
        </div>

        <div className="bg-card p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
            <Flame className="size-4 text-rose-500" />
            <span className="text-xs uppercase tracking-wider">Losses</span>
          </div>
          <p className="mt-1 font-display text-2xl font-black text-rose-600 dark:text-rose-400">
            {isLoading ? "—" : losses}
          </p>
        </div>

        <div className="bg-card p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
            <Zap className="size-4 text-emerald-500" />
            <span className="text-xs uppercase tracking-wider">Best Net Worth</span>
          </div>
          <p className="mt-1 font-display text-lg font-black text-emerald-600 dark:text-emerald-400 sm:text-xl">
            {isLoading ? "—" : formatNaira(bestNetWorth)}
          </p>
        </div>
      </div>
    </div>
  );
}
