import type { ReactNode } from "react";
import { BOARD, formatNaira, isOwnable, type Space } from "@/game/board";
import { type GameState } from "@/game/engine";
import { cn } from "@/lib/utils";
import { PlayerAvatar } from "./PlayerAvatar";
import { GROUP_BG, PLAYER_BG, PLAYER_RING } from "./styles";

type Side = "bottom" | "left" | "top" | "right" | "corner";

const CORNER = 1.6;
const UNITS = CORNER * 2 + 9;
const TEMPLATE = `${CORNER}fr repeat(9, 1fr) ${CORNER}fr`;

function cellOf(i: number): { row: number; col: number; side: Side } {
  if (i % 10 === 0) {
    const map: Record<number, [number, number]> = {
      0: [10, 10],
      10: [10, 0],
      20: [0, 0],
      30: [0, 10],
    };
    const [row, col] = map[i] ?? [10, 10];
    return { row, col, side: "corner" };
  }
  if (i < 10) return { row: 10, col: 10 - i, side: "bottom" };
  if (i < 20) return { row: 10 - (i - 10), col: 0, side: "left" };
  if (i < 30) return { row: 0, col: i - 20, side: "top" };
  return { row: i - 30, col: 10, side: "right" };
}

function centerPct(n: number): number {
  const units = n === 0 ? CORNER / 2 : n === 10 ? UNITS - CORNER / 2 : CORNER + (n - 1) + 0.5;
  return (units / UNITS) * 100;
}

const TOKEN_OFFSETS: [number, number][] = [
  [-1.5, -1.5],
  [1.5, -1.5],
  [-1.5, 1.5],
  [1.5, 1.5],
];

interface BoardProps {
  state: GameState;
  selected: number | null;
  onSelect: (i: number) => void;
  children: ReactNode;
}

export function Board({ state, selected, onSelect, children }: BoardProps) {
  return (
    <div className="bg-danfo rounded-2xl p-[1.2%] shadow-board">
      <div
        className="board-scope relative grid aspect-square w-full gap-px overflow-hidden rounded-xl bg-board-line"
        style={{ gridTemplateColumns: TEMPLATE, gridTemplateRows: TEMPLATE }}
      >
        {BOARD.map((space, i) => {
          const { row, col, side } = cellOf(i);
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(i)}
              aria-label={space.name}
              style={{ gridRow: row + 1, gridColumn: col + 1 }}
              className={cn(
                "relative min-h-0 min-w-0 overflow-hidden bg-board text-board-foreground transition hover:brightness-95 focus-visible:outline-none",
                selected === i && "z-10 ring-2 ring-primary ring-inset",
              )}
            >
              <Cell space={space} index={i} side={side} state={state} />
            </button>
          );
        })}

        <div className="bg-board-center relative col-start-2 col-end-11 row-start-2 row-end-11 overflow-y-auto text-board-center-foreground">
          {children}
        </div>

        {/* Tokens glide across the board with CSS transitions. */}
        <div className="pointer-events-none absolute inset-0">
          {state.players.map((p, idx) => {
            if (p.bankrupt) return null;
            const { row, col } = cellOf(p.position);
            const [dx, dy] = TOKEN_OFFSETS[idx] ?? [0, 0];
            const active = idx === state.current && state.phase !== "gameover";
            return (
              <div
                key={p.id}
                className={cn(
                  "absolute flex size-[clamp(18px,4.2cqw,38px)] items-center justify-center rounded-full border-2 border-board-line shadow-pop transition-[left,top] duration-700 ease-out",
                  PLAYER_BG[idx],
                  active && cn("z-20 ring-2 ring-offset-1 animate-token-active", PLAYER_RING[idx]),
                )}
                style={{
                  left: `calc(${centerPct(col)}% + ${dx}cqw)`,
                  top: `calc(${centerPct(row)}% + ${dy}cqw)`,
                  transform: "translate(-50%, -50%)",
                }}
                title={p.name}
              >
                <PlayerAvatar
                  player={p}
                  seatIndex={idx}
                  className="size-full"
                  emojiClassName="text-[clamp(9px,2.2cqw,20px)]"
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Cell({
  space,
  index,
  side,
  state,
}: {
  space: Space;
  index: number;
  side: Side;
  state: GameState;
}) {
  if (side === "corner") return <Corner space={space} />;

  const holding = state.holdings[index];
  const owner = holding?.owner ?? null;
  const horizontal = side === "left" || side === "right";
  const flex = {
    bottom: "flex-col",
    top: "flex-col-reverse",
    left: "flex-row-reverse",
    right: "flex-row",
  }[side];

  return (
    <div className={cn("flex h-full w-full", flex, holding?.mortgaged && "opacity-45 grayscale")}>
      {space.kind === "property" && (
        <div
          className={cn(
            "flex shrink-0 items-center justify-center gap-[0.3cqw] border-board-line",
            GROUP_BG[space.group],
            horizontal ? "h-full w-[24%] flex-col" : "h-[24%] w-full",
            { bottom: "border-b", top: "border-t", left: "border-l", right: "border-r" }[side],
          )}
        >
          <Houses count={holding?.houses ?? 0} />
        </div>
      )}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-between gap-[0.2cqw] px-[0.3cqw] py-[0.5cqw] text-center">
        {space.kind !== "property" && <span className="text-cell-icon">{iconFor(space)}</span>}
        <span className="text-cell font-semibold uppercase tracking-tight break-words">
          {space.name}
        </span>
        {isOwnable(space) ? (
          <span className="text-cell-sm opacity-70">{formatNaira(space.price)}</span>
        ) : space.kind === "tax" ? (
          <span className="text-cell-sm opacity-70">{formatNaira(space.amount)}</span>
        ) : (
          <span />
        )}
      </div>
      {owner !== null && (
        <span
          className={cn(
            "absolute size-[1.4cqw] rounded-full border border-board-line",
            PLAYER_BG[owner],
            {
              bottom: "bottom-[0.4cqw] right-[0.4cqw]",
              top: "top-[0.4cqw] left-[0.4cqw]",
              left: "bottom-[0.4cqw] left-[0.4cqw]",
              right: "right-[0.4cqw] top-[0.4cqw]",
            }[side],
          )}
        />
      )}
    </div>
  );
}

function Houses({ count }: { count: number }) {
  if (count === 0) return null;
  if (count === 5)
    return <span className="size-[1.6cqw] rounded-[2px] border border-board-line bg-destructive" />;
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className="size-[1cqw] rounded-[1px] border border-board-line bg-accent" />
      ))}
    </>
  );
}

function iconFor(space: Space): string {
  switch (space.kind) {
    case "transport":
    case "utility":
      return space.icon;
    case "card":
      return space.deck === "wahala" ? "⚠️" : "🎉";
    case "tax":
      return space.name.includes("Area") ? "🧢" : "💸";
    default:
      return "";
  }
}

function Corner({ space }: { space: Space }) {
  const config: Record<string, { icon: string; cls: string }> = {
    go: { icon: "➜", cls: "bg-accent text-accent-foreground" },
    jail: { icon: "🚔", cls: "bg-muted-foreground/20" },
    parking: { icon: "🚗🚙", cls: "bg-primary text-primary-foreground" },
    gotojail: { icon: "👮🏾", cls: "bg-destructive text-destructive-foreground" },
  };
  const c = config[space.kind] ?? { icon: "", cls: "" };
  const sub = "sub" in space ? space.sub : "";
  return (
    <div
      className={cn(
        "flex h-full w-full flex-col items-center justify-center gap-[0.6cqw] p-[0.8cqw] text-center",
        c.cls,
      )}
    >
      <span
        className={cn(
          "text-corner",
          space.kind === "go"
            ? "font-display text-[clamp(14px,4.5cqw,46px)] font-black"
            : "text-[clamp(12px,3.4cqw,32px)]",
        )}
      >
        {space.kind === "go" ? "GO" : c.icon}
      </span>
      {space.kind !== "go" && (
        <span className="text-corner font-display font-bold uppercase">{space.name}</span>
      )}
      <span className="text-cell-sm opacity-80">{sub}</span>
    </div>
  );
}
