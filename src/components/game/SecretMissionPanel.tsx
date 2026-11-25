import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Eye, EyeOff, Lock, Sparkles, Target, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNaira } from "@/game/board";
import { type GameState, playerAt } from "@/game/engine";
import {
  computeMissionProgress,
  missionById,
  type MissionDifficulty,
  type MissionProgress,
} from "@/game/missions";
import { cn } from "@/lib/utils";
import { PlayerAvatar } from "./PlayerAvatar";

const DIFFICULTY_STYLES: Record<MissionDifficulty, { label: string; cls: string }> = {
  easy: {
    label: "Easy",
    cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  medium: {
    label: "Medium",
    cls: "border-primary/40 bg-primary/15 text-primary",
  },
  hard: {
    label: "Hard",
    cls: "border-destructive/40 bg-destructive/15 text-destructive",
  },
};

function resolveMissionViewerId(state: GameState, viewer: number | undefined): number | undefined {
  if (viewer !== undefined) return viewer;
  const humans = state.players.filter((p) => !p.isCpu);
  if (humans.length === 1) return humans[0]!.id;
  const cur = playerAt(state, state.current);
  if (!cur.isCpu) return cur.id;
  return undefined;
}

function formatProgressText(p: MissionProgress): string {
  if (p.unit === "naira") {
    return `${formatNaira(p.current)} / ${formatNaira(p.target)}`;
  }
  return `${p.current} / ${p.target}`;
}

export function SecretMissionPanel({
  state,
  viewer,
  onReveal,
  busy,
}: {
  state: GameState;
  viewer?: number | undefined;
  onReveal: (playerId: number) => void;
  busy?: boolean | undefined;
}) {
  const viewerId = resolveMissionViewerId(state, viewer);
  const humanCount = state.players.filter((p) => !p.isCpu).length;
  const passAndPlayPrivacy = viewer === undefined && humanCount > 1;
  const [unveiledTurnKey, setUnveiledTurnKey] = useState<string | null>(null);
  const currentTurnKey = `${state.current}:${state.turn}`;
  const isUnveiled = !passAndPlayPrivacy || unveiledTurnKey === currentTurnKey;

  const myMissionState = viewerId !== undefined ? state.missions?.[viewerId] : undefined;
  const myMission =
    myMissionState && myMissionState.missionId !== "__hidden__"
      ? missionById(myMissionState.missionId)
      : undefined;

  const [notifyOpen, setNotifyOpen] = useState(false);
  const prevCompletedBySeat = useRef<Record<number, boolean>>({});
  const notifiedKeys = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (viewerId === undefined || !myMissionState || !myMission) return;
    if (state.phase === "gameover") {
      setNotifyOpen(false);
      return;
    }
    const wasCompleted = prevCompletedBySeat.current[viewerId] ?? false;
    prevCompletedBySeat.current[viewerId] = myMissionState.completed;

    const notifyKey = `${viewerId}:${myMission.id}`;
    if (
      myMissionState.completed &&
      !myMissionState.revealed &&
      !notifiedKeys.current.has(notifyKey) &&
      (!wasCompleted || myMissionState.completedTurn === state.turn)
    ) {
      notifiedKeys.current.add(notifyKey);
      setNotifyOpen(true);
    }
  }, [viewerId, myMissionState, myMission, state.phase, state.turn]);

  useEffect(() => {
    if (!notifyOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNotifyOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [notifyOpen]);

  if (!state.missions) return null;

  const revealedOthers = state.players
    .map((p) => {
      if (p.id === viewerId) return null;
      const ms = state.missions?.[p.id];
      if (!ms || (!ms.revealed && state.phase !== "gameover")) return null;
      if (ms.missionId === "__hidden__") return null;
      const mission = missionById(ms.missionId);
      if (!mission) return null;
      return { player: p, state: ms, mission };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const myPlayer = viewerId !== undefined ? playerAt(state, viewerId) : undefined;
  const progress =
    viewerId !== undefined && myMission ? computeMissionProgress(state, viewerId, myMission) : null;

  const pct = myMissionState?.completed
    ? 100
    : progress
      ? Math.min(100, Math.round((progress.current / Math.max(1, progress.target)) * 100))
      : 0;

  return (
    <>
      <section
        aria-label="Secret Mission"
        className="overflow-hidden rounded-xl border border-border bg-card"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <p className="flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <Target className="size-3.5 text-primary" />
            Secret Mission
          </p>
          {myMission && isUnveiled && (
            <span
              className={cn(
                "rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                DIFFICULTY_STYLES[myMission.difficulty].cls,
              )}
            >
              {DIFFICULTY_STYLES[myMission.difficulty].label}
            </span>
          )}
        </div>

        <div className="p-4">
          {viewerId !== undefined && myPlayer && myMission && myMissionState ? (
            !isUnveiled ? (
              <div className="space-y-3 text-center">
                <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                  <Lock className="size-5" />
                </div>
                <div>
                  <p className="font-display text-sm font-bold">
                    {myPlayer.name}&apos;s Secret Objective
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Keep other players from looking before you peek.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11 w-full"
                  onClick={() => setUnveiledTurnKey(currentTurnKey)}
                >
                  <Eye className="size-4" /> Peek {myPlayer.name}&apos;s mission
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-xl">
                      {myMission.icon}
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-display text-sm font-black leading-snug">
                        {myMission.title}
                      </h3>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        {myMission.objective}
                      </p>
                    </div>
                  </div>
                  {passAndPlayPrivacy && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 shrink-0 px-2 text-xs text-muted-foreground"
                      onClick={() => setUnveiledTurnKey(null)}
                      aria-label="Hide secret mission"
                    >
                      <EyeOff className="size-3.5" /> Hide
                    </Button>
                  )}
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 font-semibold",
                        myMissionState.completed
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground",
                      )}
                    >
                      {myMissionState.completed ? (
                        <>
                          <CheckCircle2 className="size-3.5" /> Completed
                        </>
                      ) : (
                        "Progress"
                      )}
                    </span>
                    <span className="font-mono font-bold tabular-nums text-foreground">
                      {myMissionState.completed && progress
                        ? formatProgressText({ ...progress, current: progress.target, done: true })
                        : progress
                          ? formatProgressText(progress)
                          : "0 / 1"}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        myMissionState.completed ? "bg-emerald-500" : "bg-primary",
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Reward & reveal controls */}
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-secondary/50 px-3 py-2 text-xs">
                  <span className="font-medium text-muted-foreground">
                    Reward: <strong className="text-foreground">{myMission.rewardLabel}</strong>
                  </span>
                  {myMissionState.completed && (
                    <span
                      className={cn(
                        "text-[11px] font-semibold",
                        myMissionState.revealed
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-primary",
                      )}
                    >
                      {myMissionState.revealed ? "Revealed to table" : "Secret kept"}
                    </span>
                  )}
                </div>

                {myMissionState.completed &&
                  !myMissionState.revealed &&
                  state.phase !== "gameover" && (
                    <Button
                      type="button"
                      variant="danfo"
                      size="sm"
                      className="min-h-10 w-full"
                      disabled={!!busy}
                      onClick={() => onReveal(viewerId)}
                    >
                      <Sparkles className="size-4" /> Reveal to Everyone
                    </Button>
                  )}

                {!myMissionState.completed && (
                  <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Lock className="size-3 shrink-0" /> Hidden from other players until you reveal
                    it or the game ends.
                  </p>
                )}
              </div>
            )
          ) : (
            <p className="text-xs text-muted-foreground">
              Each player holds a hidden Lagos objective until revealed or game end.
            </p>
          )}

          {revealedOthers.length > 0 && (
            <div className="mt-4 space-y-2 border-t border-border pt-3">
              <p className="font-display text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Revealed Missions
              </p>
              <ul className="space-y-1.5">
                {revealedOthers.map(({ player, state: ms, mission }) => (
                  <li
                    key={player.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-secondary/40 px-2.5 py-2 text-xs"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <PlayerAvatar
                        player={player}
                        seatIndex={player.id}
                        className="size-6 shrink-0 text-xs"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-semibold">
                          {player.name}: {mission.icon} {mission.title}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {mission.objective}
                        </p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 font-semibold",
                        ms.completed
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground",
                      )}
                    >
                      {ms.completed ? "Done" : "Missed"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* Private Mission Completed Notification */}
      {notifyOpen && myMission && viewerId !== undefined && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="secret-mission-complete-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setNotifyOpen(false);
          }}
        >
          <div className="animate-card-in w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card shadow-board">
            <div className="h-2.5 bg-emerald-500" />
            <div className="p-6">
              <div className="flex items-center gap-3">
                <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-3xl">
                  {myMission.icon}
                </span>
                <div>
                  <p className="inline-flex items-center gap-1.5 font-display text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    <Lock className="size-3" /> Private Mission Complete
                  </p>
                  <h2
                    id="secret-mission-complete-title"
                    className="mt-0.5 font-display text-lg font-black"
                  >
                    {myMission.title}
                  </h2>
                </div>
              </div>

              <p className="mt-4 text-sm text-muted-foreground">{myMission.objective}</p>

              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-sm">
                <Trophy className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    Bonus Awarded Privately
                  </p>
                  <p className="font-display font-bold text-foreground">{myMission.rewardLabel}</p>
                </div>
              </div>

              <p className="mt-3 text-xs text-muted-foreground">
                Your secret mission remains hidden from opponents unless you choose to reveal it.
              </p>

              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  className="flex-1"
                  onClick={() => setNotifyOpen(false)}
                >
                  Keep Secret
                </Button>
                <Button
                  type="button"
                  variant="danfo"
                  size="lg"
                  className="flex-1"
                  disabled={!!busy}
                  onClick={() => {
                    onReveal(viewerId);
                    setNotifyOpen(false);
                  }}
                >
                  <Sparkles className="size-4" /> Reveal to Everyone
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
