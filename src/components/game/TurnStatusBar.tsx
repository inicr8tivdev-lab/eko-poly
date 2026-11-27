import { actorOf, playerAt, type GameState } from "@/game/engine";
import { cn } from "@/lib/utils";
import { PlayerAvatar } from "./PlayerAvatar";
import { PLAYER_BG, PLAYER_BORDER, PLAYER_RING } from "./styles";

function phaseInstruction(game: GameState): string {
  const actor = playerAt(game, actorOf(game));
  switch (game.phase) {
    case "roll":
      return actor.inJail ? "In Kirikiri · Pay bail or roll doubles" : "Roll dice";
    case "buy":
      return "Buy or auction space";
    case "auction":
      return "Auction bid";
    case "trade":
      return "Respond to trade offer";
    case "debt":
      return "Raise cash to settle debt";
    case "end":
      return "Build, trade, or end turn";
    case "gameover":
      return "Game over";
  }
}

export function TurnStatusBar({ game, viewer }: { game: GameState; viewer?: number | undefined }) {
  if (game.phase === "gameover") return null;

  const activeSeat = actorOf(game);
  const actor = playerAt(game, activeSeat);
  const isViewerTurn = viewer !== undefined && viewer === activeSeat;
  const turnLabel = isViewerTurn
    ? `Your turn · ${actor.name}`
    : actor.name.trim().toLowerCase() === "you"
      ? "Your turn"
      : `${actor.name}'s turn`;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="turn-status-bar"
      className={cn(
        "border-b border-border bg-card/85 px-3 py-2 sm:px-6",
        isViewerTurn && "bg-primary/10",
      )}
    >
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className={cn(
              "size-7 shrink-0 rounded-full ring-2 ring-offset-1 ring-offset-background",
              PLAYER_RING[activeSeat],
            )}
          >
            <PlayerAvatar player={actor} seatIndex={activeSeat} className="size-7 text-sm" />
          </div>
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
            <span className="truncate font-display font-bold text-foreground">{turnLabel}</span>
            {actor.isCpu && <span className="text-xs font-medium text-muted-foreground">CPU</span>}
            <span aria-hidden="true" className="text-muted-foreground">
              ·
            </span>
            <span className="truncate text-xs text-muted-foreground sm:text-sm">
              {phaseInstruction(game)}
            </span>
          </div>
        </div>

        <ol aria-label="Turn order" className="hidden shrink-0 items-center gap-3 text-xs sm:flex">
          {game.players.map((player, idx) => {
            if (player.bankrupt) return null;
            const current = idx === activeSeat;
            return (
              <li
                key={player.id}
                aria-current={current ? "true" : undefined}
                className={cn(
                  "flex items-center gap-1.5 pb-0.5 transition-opacity",
                  current
                    ? cn("border-b-2 font-semibold text-foreground", PLAYER_BORDER[idx])
                    : "text-muted-foreground opacity-70",
                )}
              >
                <span className={cn("size-2 rounded-full", PLAYER_BG[idx])} aria-hidden="true" />
                <span className="max-w-24 truncate">{player.name}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
