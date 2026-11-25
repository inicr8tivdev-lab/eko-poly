import { Home, Hotel, Lock, Minus, Plus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GROUP_LABEL, formatNaira, groupMembers, isOwnable, spaceAt } from "@/game/board";
import {
  canBuild,
  canMortgage,
  canSell,
  canUnmortgage,
  holdingAt,
  houseCostFor,
  playerAt,
  rentFor,
  unmortgageCost,
  type Action,
  type GameState,
} from "@/game/engine";
import { cn } from "@/lib/utils";
import { GROUP_BG } from "./styles";

interface PropertyActionDialogProps {
  state: GameState;
  index: number | null;
  onSelectIndex: (index: number) => void;
  onClose: () => void;
  dispatch: (a: Action) => void;
  viewer?: number | undefined;
  busy?: boolean | undefined;
}

export function PropertyActionDialog({
  state,
  index,
  onSelectIndex,
  onClose,
  dispatch,
  viewer,
  busy,
}: PropertyActionDialogProps) {
  if (index === null || state.phase === "gameover") return null;

  const sp = spaceAt(index);
  const h = state.holdings[index];
  if (!isOwnable(sp) || !h || h.owner === null) return null;

  const owner = playerAt(state, h.owner);
  const activePlayer = playerAt(state, state.current);
  const canControlOwner =
    h.owner === state.current &&
    !activePlayer.isCpu &&
    (viewer === undefined || viewer === h.owner) &&
    (state.phase === "roll" ||
      state.phase === "end" ||
      state.phase === "buy" ||
      state.phase === "debt");

  const buildAllowed =
    canControlOwner && state.phase !== "debt" && canBuild(state, h.owner, index) && !busy;
  const sellAllowed = canControlOwner && canSell(state, h.owner, index) && !busy;
  const mortgageAllowed = canControlOwner && canMortgage(state, h.owner, index) && !busy;
  const unmortgageAllowed =
    canControlOwner && state.phase !== "debt" && canUnmortgage(state, h.owner, index) && !busy;

  const buildCost = sp.kind === "property" ? houseCostFor(state, index) : 0;
  const sellRefund = sp.kind === "property" ? sp.houseCost / 2 : 0;
  const mortgageValue = sp.price / 2;
  const payoffCost = unmortgageCost(index);
  const currentRent = rentFor(state, index, 7);

  let lockReason: string | null = null;
  if (!canControlOwner) {
    if (state.phase === "auction" || state.phase === "trade") {
      lockReason = `Finish the active ${state.phase} first.`;
    } else if (h.owner !== state.current) {
      lockReason = `Wait for your turn (${activePlayer.name} is playing).`;
    } else {
      lockReason = "Only the active owner can manage this property.";
    }
  }

  let buildHint: string | null = null;
  if (sp.kind === "property" && canControlOwner && !buildAllowed && h.houses < 5) {
    const members = groupMembers(sp.group);
    const ownsAll = members.every((m) => holdingAt(state, m).owner === h.owner);
    if (state.phase === "debt") {
      buildHint = "Clear your debt before building.";
    } else if (!ownsAll) {
      buildHint = `Own all ${GROUP_LABEL[sp.group]} properties to build.`;
    } else if (members.some((m) => holdingAt(state, m).mortgaged)) {
      buildHint = `Pay off all ${GROUP_LABEL[sp.group]} mortgages first.`;
    } else {
      const minHouses = Math.min(...members.map((m) => holdingAt(state, m).houses));
      if (h.houses > minHouses) {
        buildHint = `Build evenly across ${GROUP_LABEL[sp.group]} first.`;
      } else if (owner.money < buildCost) {
        buildHint = `Need ${formatNaira(buildCost)} (you have ${formatNaira(owner.money)}).`;
      }
    }
  }

  let mortgageHint: string | null = null;
  if (canControlOwner && !h.mortgaged && !mortgageAllowed && sp.kind === "property") {
    mortgageHint = `Sell all houses in ${GROUP_LABEL[sp.group]} before mortgaging.`;
  }

  const nextRent =
    sp.kind === "property" && h.houses < 5 ? (sp.rent[h.houses + 1] ?? sp.rent[5]) : currentRent;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-hidden p-0">
        <div
          className={cn(
            "px-6 py-4",
            sp.kind === "property" ? GROUP_BG[sp.group] : "bg-board-line text-board",
          )}
        >
          <DialogHeader className="text-left">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] opacity-85">
              {sp.kind === "property"
                ? GROUP_LABEL[sp.group]
                : sp.kind === "transport"
                  ? "Transport Line"
                  : "City Utility"}
            </p>
            <DialogTitle className="font-display text-2xl font-black uppercase tracking-tight">
              {sp.name}
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-current opacity-90">
              {owner.name} · Cash {formatNaira(owner.money)} ·{" "}
              {h.mortgaged
                ? "Mortgaged (₦0 rent)"
                : sp.kind === "utility"
                  ? "Rent depends on dice"
                  : `Current rent ${formatNaira(currentRent)}`}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-6 py-5">
          {sp.kind === "property" && (
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-1.5" aria-label="Development level">
                {h.houses === 5 ? (
                  <span className="inline-flex items-center gap-1.5 font-display text-sm font-bold text-destructive">
                    <Hotel className="size-4" /> Hotel built
                  </span>
                ) : (
                  <>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <span
                        key={i}
                        className={cn(
                          "flex size-7 items-center justify-center rounded-md border",
                          i < h.houses
                            ? "border-accent bg-accent text-accent-foreground"
                            : "border-border bg-secondary/50 text-muted-foreground/40",
                        )}
                      >
                        <Home className="size-3.5" />
                      </span>
                    ))}
                    <span className="ml-1.5 text-xs font-medium text-muted-foreground tabular-nums">
                      {h.houses}/4 houses
                    </span>
                  </>
                )}
              </div>
              <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                {h.houses < 5 ? `Next rent ${formatNaira(nextRent)}` : "Max level"}
              </span>
            </div>
          )}

          {lockReason && (
            <p className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-xs font-medium text-muted-foreground">
              <Lock className="size-3.5 shrink-0" />
              {lockReason}
            </p>
          )}

          <div className="space-y-2.5">
            {sp.kind === "property" && (
              <>
                <Button
                  type="button"
                  variant="go"
                  size="lg"
                  className="h-auto w-full justify-between px-4 py-3 text-left"
                  disabled={!buildAllowed}
                  onClick={() => dispatch({ type: "build", index })}
                >
                  <span className="flex items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-black/15">
                      {h.houses >= 4 ? <Hotel className="size-4" /> : <Plus className="size-4" />}
                    </span>
                    <span className="flex flex-col">
                      <span className="font-display text-sm font-bold">
                        {h.houses >= 5
                          ? "Hotel Complete"
                          : h.houses === 4
                            ? "Upgrade to Hotel"
                            : `Build House ${h.houses + 1}`}
                      </span>
                      <span className="text-xs font-normal opacity-90">
                        {h.houses >= 5
                          ? "Maximum development reached"
                          : `Rent rises to ${formatNaira(nextRent)}`}
                      </span>
                    </span>
                  </span>
                  <span className="font-display text-sm font-bold tabular-nums">
                    {h.houses >= 5 ? "Max" : `-${formatNaira(buildCost)}`}
                  </span>
                </Button>
                {buildHint && <p className="px-1 text-xs text-muted-foreground">{buildHint}</p>}

                {h.houses > 0 && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    className="h-auto w-full justify-between px-4 py-3 text-left"
                    disabled={!sellAllowed}
                    onClick={() => dispatch({ type: "sell", index })}
                  >
                    <span className="flex items-center gap-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background/60">
                        <Minus className="size-4" />
                      </span>
                      <span className="flex flex-col">
                        <span className="font-display text-sm font-bold">
                          {h.houses === 5 ? "Sell Hotel" : "Sell House"}
                        </span>
                        <span className="text-xs font-normal text-muted-foreground">
                          Half of construction price refunded
                        </span>
                      </span>
                    </span>
                    <span className="font-display text-sm font-bold text-primary tabular-nums">
                      +{formatNaira(sellRefund)}
                    </span>
                  </Button>
                )}
              </>
            )}

            {h.mortgaged ? (
              <Button
                type="button"
                variant="danfo"
                size="lg"
                className="h-auto w-full justify-between px-4 py-3 text-left"
                disabled={!unmortgageAllowed}
                onClick={() => dispatch({ type: "unmortgage", index })}
              >
                <span className="flex items-center gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-black/15">
                    <Wallet className="size-4" />
                  </span>
                  <span className="flex flex-col">
                    <span className="font-display text-sm font-bold">Pay Off Mortgage</span>
                    <span className="text-xs font-normal opacity-90">
                      Restore rent collection (includes 10% fee)
                    </span>
                  </span>
                </span>
                <span className="font-display text-sm font-bold tabular-nums">
                  -{formatNaira(payoffCost)}
                </span>
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="h-auto w-full justify-between px-4 py-3 text-left"
                  disabled={!mortgageAllowed}
                  onClick={() => dispatch({ type: "mortgage", index })}
                >
                  <span className="flex items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
                      <Wallet className="size-4" />
                    </span>
                    <span className="flex flex-col">
                      <span className="font-display text-sm font-bold">Mortgage Property</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        Raise instant cash (₦0 rent while mortgaged)
                      </span>
                    </span>
                  </span>
                  <span className="font-display text-sm font-bold text-primary tabular-nums">
                    +{formatNaira(mortgageValue)}
                  </span>
                </Button>
                {mortgageHint && (
                  <p className="px-1 text-xs text-muted-foreground">{mortgageHint}</p>
                )}
              </>
            )}
          </div>

          {sp.kind === "property" && (
            <div className="border-t border-border pt-3">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">
                {GROUP_LABEL[sp.group]} Set
              </p>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                {groupMembers(sp.group).map((memberIdx) => {
                  const memberSp = spaceAt(memberIdx);
                  const memberHold = holdingAt(state, memberIdx);
                  const isMine = memberHold.owner === h.owner;
                  const active = memberIdx === index;
                  return (
                    <button
                      key={memberIdx}
                      type="button"
                      disabled={!isMine}
                      onClick={() => onSelectIndex(memberIdx)}
                      className={cn(
                        "flex min-h-10 flex-col items-start justify-center rounded-lg border px-2.5 py-1.5 text-left text-xs transition",
                        active
                          ? "border-primary bg-primary/15 font-semibold text-foreground"
                          : isMine
                            ? "border-border bg-secondary/50 hover:bg-secondary"
                            : "border-border/50 bg-background/40 opacity-50",
                      )}
                    >
                      <span className="w-full truncate font-medium">{memberSp.name}</span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {!isMine
                          ? memberHold.owner !== null
                            ? playerAt(state, memberHold.owner).name
                            : "Unowned"
                          : memberHold.mortgaged
                            ? "Mortgaged"
                            : memberHold.houses === 5
                              ? "Hotel"
                              : `${memberHold.houses} houses`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border bg-secondary/30 px-6 py-3">
          <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
