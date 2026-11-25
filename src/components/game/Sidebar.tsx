import { ArrowLeftRight, Home, Hotel, Landmark, Lock, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GROUP_LABEL, formatNaira, isOwnable, spaceAt } from "@/game/board";
import {
  holdingAt,
  playerAt,
  canBuild,
  canMortgage,
  canSell,
  canUnmortgage,
  netWorth,
  ownedBy,
  unmortgageCost,
  type Action,
  type GameState,
} from "@/game/engine";
import { cn } from "@/lib/utils";
import { PlayerAvatar } from "./PlayerAvatar";
import { GROUP_BG, PLAYER_BG, PLAYER_BORDER } from "./styles";

export function PlayersPanel({
  state,
  onSelect,
  onTrade,
  viewer,
}: {
  state: GameState;
  onSelect: (i: number) => void;
  /** Online games: marks "you" in the list. */
  viewer?: number | undefined;
  /** Present when the current player may start a deal. */
  onTrade?: ((pid: number) => void) | undefined;
}) {
  return (
    <div className="space-y-2">
      {state.players.map((p, idx) => {
        const active = idx === state.current && state.phase !== "gameover";
        return (
          <div
            key={p.id}
            className={cn(
              "rounded-xl border-2 bg-card p-3 transition",
              active ? PLAYER_BORDER[idx] : "border-transparent",
              p.bankrupt && "opacity-40",
            )}
          >
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <PlayerAvatar player={p} seatIndex={idx} className="size-9 text-lg" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate font-semibold">
                  {p.name}
                  {viewer === p.id && (
                    <span className="rounded bg-primary/15 px-1.5 text-[10px] uppercase tracking-wider text-primary">
                      You
                    </span>
                  )}
                  {p.isCpu && (
                    <span className="rounded bg-secondary px-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      CPU
                    </span>
                  )}
                  {p.inJail && (
                    <Lock className="size-3.5 text-destructive" aria-label="In Kirikiri" />
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {p.bankrupt
                    ? "Bankrupt — don japa"
                    : `Worth ${formatNaira(netWorth(state, p.id))}`}
                  {p.jailCards > 0 && ` · ${p.jailCards} free-exit card`}
                </p>
              </div>
              <p
                className={cn(
                  "font-display text-sm font-bold",
                  p.money < 0 ? "text-destructive" : "text-primary",
                )}
              >
                {formatNaira(p.money)}
              </p>
              {onTrade && idx !== state.current && !p.bankrupt && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2"
                  onClick={() => onTrade(p.id)}
                  aria-label={`Trade with ${p.name}`}
                >
                  <ArrowLeftRight /> Trade
                </Button>
              )}
            </div>
            {!p.bankrupt && ownedBy(state, p.id).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {ownedBy(state, p.id).map((i) => {
                  const sp = spaceAt(i);
                  const h = holdingAt(state, i);
                  return (
                    <button
                      key={i}
                      type="button"
                      title={sp.name}
                      onClick={() => onSelect(i)}
                      className={cn(
                        "flex h-5 min-w-5 items-center justify-center rounded-sm border border-border px-1 text-[10px] font-bold text-board-foreground",
                        sp.kind === "property" ? GROUP_BG[sp.group] : "bg-board",
                        h.mortgaged && "opacity-40",
                      )}
                    >
                      {sp.kind === "property"
                        ? h.houses === 5
                          ? "H"
                          : h.houses || ""
                        : sp.kind === "transport" || sp.kind === "utility"
                          ? sp.icon
                          : ""}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function SpaceDetails({
  state,
  index,
  dispatch,
  viewer,
  busy,
}: {
  state: GameState;
  index: number;
  dispatch: (a: Action) => void;
  /** Online games: only the player holding this device may manage their own property. */
  viewer?: number | undefined;
  busy?: boolean | undefined;
}) {
  const sp = spaceAt(index);
  const h = state.holdings[index];
  const me = playerAt(state, state.current);
  const mine =
    h?.owner === me.id &&
    !me.isCpu &&
    (viewer === undefined || viewer === me.id) &&
    state.phase !== "gameover" &&
    state.phase !== "auction" &&
    state.phase !== "trade";
  const owner = h?.owner != null ? playerAt(state, h.owner) : null;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-board text-board-foreground shadow-pop">
      <div
        className={cn(
          "px-4 py-3 text-center",
          sp.kind === "property" ? GROUP_BG[sp.group] : "bg-board-line text-board",
        )}
      >
        {sp.kind === "property" && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-80">
            {GROUP_LABEL[sp.group]}
          </p>
        )}
        <h3 className="font-display text-lg font-bold uppercase">{sp.name}</h3>
      </div>
      <div className="space-y-3 p-4 text-sm">
        {"blurb" in sp && <p className="text-center italic opacity-75">{sp.blurb}</p>}
        {"sub" in sp && <p className="text-center opacity-80">{sp.sub}</p>}
        {sp.kind === "card" && (
          <p className="text-center opacity-80">
            {sp.deck === "wahala"
              ? "Lagos wahala — anything fit happen."
              : "Party time! Spray or be sprayed."}
          </p>
        )}

        {sp.kind === "property" && (
          <table className="w-full text-sm">
            <tbody>
              {[
                ["Rent", sp.rent[0]],
                ["Full set", sp.rent[0] * 2],
                ["1 house", sp.rent[1]],
                ["2 houses", sp.rent[2]],
                ["3 houses", sp.rent[3]],
                ["4 houses", sp.rent[4]],
                ["Hotel", sp.rent[5]],
              ].map(([label, v], r) => (
                <tr key={label} className={cn(h && h.houses === r - 1 && r > 1 && "font-bold")}>
                  <td className="py-0.5 opacity-75">{label}</td>
                  <td className="py-0.5 text-right">{formatNaira(v as number)}</td>
                </tr>
              ))}
              <tr className="border-t border-board-line/20">
                <td className="pt-1.5 opacity-75">Building cost</td>
                <td className="pt-1.5 text-right">{formatNaira(sp.houseCost)}</td>
              </tr>
            </tbody>
          </table>
        )}
        {sp.kind === "transport" && (
          <p className="text-center">
            Rent: ₦25k · ₦50k · ₦100k · ₦200k for owning 1–4 transport lines.
          </p>
        )}
        {sp.kind === "utility" && (
          <p className="text-center">
            Rent: 4× dice roll (in ₦k), or 10× if you own both NEPA and Generator.
          </p>
        )}

        {isOwnable(sp) && (
          <div className="flex items-center justify-between rounded-lg bg-board-line/10 px-3 py-2">
            <span className="flex items-center gap-1.5 opacity-75">
              <Landmark className="size-4" /> {formatNaira(sp.price)}
            </span>
            <span className="flex items-center gap-1.5 font-semibold">
              {owner ? (
                <>
                  <span className={cn("size-3 rounded-full", PLAYER_BG[owner.id])} />
                  {owner.name}
                  {h?.mortgaged && <span className="text-destructive">(mortgaged)</span>}
                </>
              ) : (
                "For sale"
              )}
            </span>
          </div>
        )}

        {mine && h && (
          <div className="grid grid-cols-2 gap-2">
            {sp.kind === "property" && (
              <>
                <Button
                  size="sm"
                  variant="go"
                  disabled={!!busy || !canBuild(state, me.id, index) || state.phase === "debt"}
                  onClick={() => dispatch({ type: "build", index })}
                >
                  {h.houses >= 4 ? <Hotel /> : <Home />} Build {formatNaira(sp.houseCost)}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!!busy || !canSell(state, me.id, index)}
                  onClick={() => dispatch({ type: "sell", index })}
                >
                  Sell +{formatNaira(sp.houseCost / 2)}
                </Button>
              </>
            )}
            {h.mortgaged ? (
              <Button
                size="sm"
                variant="secondary"
                className="col-span-2"
                disabled={!!busy || !canUnmortgage(state, me.id, index) || state.phase === "debt"}
                onClick={() => dispatch({ type: "unmortgage", index })}
              >
                <Wallet /> Pay off mortgage {formatNaira(unmortgageCost(index))}
              </Button>
            ) : (
              isOwnable(sp) && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="col-span-2"
                  disabled={!!busy || !canMortgage(state, me.id, index)}
                  onClick={() => dispatch({ type: "mortgage", index })}
                >
                  <Wallet /> Mortgage +{formatNaira(sp.price / 2)}
                </Button>
              )
            )}
            {sp.kind === "property" && !canBuild(state, me.id, index) && h.houses < 5 && (
              <p className="col-span-2 text-center text-xs opacity-70">
                Own the whole {GROUP_LABEL[sp.group]} set (none mortgaged) and build evenly to add
                houses.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function GameLog({ state }: { state: GameState }) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <p className="border-b border-border px-4 py-2 font-display text-xs font-bold uppercase tracking-widest text-muted-foreground">
        Gist
      </p>
      <ul className="max-h-64 space-y-1.5 overflow-y-auto px-4 py-3 text-sm">
        {state.log.map((e) => (
          <li key={e.id} className="flex gap-2">
            <span
              className={cn(
                "mt-1.5 size-2 shrink-0 rounded-full",
                e.player !== null ? PLAYER_BG[e.player] : "bg-muted-foreground",
              )}
            />
            <span className="text-card-foreground/90">{e.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
