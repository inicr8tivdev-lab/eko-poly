import { useEffect, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatNaira, isOwnable, spaceAt } from "@/game/board";
import {
  canTradeProperty,
  holdingAt,
  ownedBy,
  playerAt,
  tradeProblem,
  type GameState,
  type TradeTerms,
} from "@/game/engine";
import { cn } from "@/lib/utils";
import { PlayerAvatar } from "./PlayerAvatar";
import { GROUP_BG } from "./styles";

export interface TradeDraft {
  from: number;
  terms: TradeTerms;
  counter?: boolean;
}

export function TradeDialog({
  state,
  draft,
  onClose,
  onPropose,
}: {
  state: GameState;
  draft: TradeDraft | null;
  onClose: () => void;
  onPropose: (terms: TradeTerms) => void;
}) {
  const [terms, setTerms] = useState<TradeTerms | null>(draft?.terms ?? null);
  useEffect(() => setTerms(draft?.terms ?? null), [draft]);

  if (!draft || !terms) return null;
  const me = playerAt(state, draft.from);
  const them = playerAt(state, terms.to);
  const problem = tradeProblem(state, me.id, terms);

  const toggle = (key: "give" | "get", i: number) =>
    setTerms(
      (t) =>
        t && { ...t, [key]: t[key].includes(i) ? t[key].filter((x) => x !== i) : [...t[key], i] },
    );
  const setCash = (key: "giveCash" | "getCash", v: string) =>
    setTerms((t) => t && { ...t, [key]: Math.max(0, Math.floor(Number(v) || 0)) });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <ArrowLeftRight className="size-5 text-primary" />
            {draft.counter ? "Counter-offer" : "Make a deal"}
          </DialogTitle>
          <DialogDescription>
            {me.name}, pick what you'll give and what you want from {them.name}. Properties with
            buildings on their colour set can't be traded.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <Side
            state={state}
            pid={me.id}
            title={`${me.name} gives`}
            picked={terms.give}
            onToggle={(i) => toggle("give", i)}
            cash={terms.giveCash}
            onCash={(v) => setCash("giveCash", v)}
          />
          <Side
            state={state}
            pid={them.id}
            title={`${me.name} gets from ${them.name}`}
            picked={terms.get}
            onToggle={(i) => toggle("get", i)}
            cash={terms.getCash}
            onCash={(v) => setCash("getCash", v)}
          />
        </div>

        <DialogFooter className="flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className={cn("text-sm", problem ? "text-destructive" : "text-muted-foreground")}>
            {problem ?? `${them.name} will be asked to accept.`}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="danfo" disabled={!!problem} onClick={() => onPropose(terms)}>
              Send offer
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Side({
  state,
  pid,
  title,
  picked,
  onToggle,
  cash,
  onCash,
}: {
  state: GameState;
  pid: number;
  title: string;
  picked: number[];
  onToggle: (i: number) => void;
  cash: number;
  onCash: (v: string) => void;
}) {
  const p = playerAt(state, pid);
  const props = ownedBy(state, pid);
  return (
    <div className="rounded-xl border border-border bg-secondary/40 p-3">
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <PlayerAvatar player={p} seatIndex={pid} className="size-6 text-sm" />
        {title}
      </p>
      <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
        {props.length === 0 && (
          <p className="py-2 text-sm text-muted-foreground">No property yet.</p>
        )}
        {props.map((i) => {
          const sp = spaceAt(i);
          const ok = canTradeProperty(state, pid, i);
          const on = picked.includes(i);
          return (
            <button
              key={i}
              type="button"
              disabled={!ok}
              aria-pressed={on}
              onClick={() => onToggle(i)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-sm transition",
                on ? "border-primary bg-primary/15" : "border-transparent hover:bg-secondary",
                !ok && "cursor-not-allowed opacity-40",
              )}
            >
              <span
                className={cn(
                  "h-4 w-2 shrink-0 rounded-sm",
                  sp.kind === "property" ? GROUP_BG[sp.group] : "bg-board",
                )}
              />
              <span className="flex-1 truncate">{sp.name}</span>
              {holdingAt(state, i).mortgaged && (
                <span className="text-[10px] uppercase text-muted-foreground">mortgaged</span>
              )}
              <span className="text-xs text-muted-foreground">
                {isOwnable(sp) ? formatNaira(sp.price) : ""}
              </span>
            </button>
          );
        })}
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Cash ₦k</span>
        <Input
          type="number"
          min={0}
          step={10}
          max={Math.max(0, p.money)}
          value={cash || ""}
          placeholder="0"
          onChange={(e) => onCash(e.target.value)}
          className="h-8"
        />
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          of {formatNaira(Math.max(0, p.money))}
        </span>
      </label>
    </div>
  );
}
