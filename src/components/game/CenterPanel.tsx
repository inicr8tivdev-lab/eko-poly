import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JAIL_FINE, formatNaira, isOwnable, spaceAt } from "@/game/board";
import {
  BID_STEP,
  actorOf,
  maxRaisable,
  playerAt,
  type Action,
  type GameState,
} from "@/game/engine";
import { cn } from "@/lib/utils";
import { Die } from "./Dice";
import { PlayerAvatar } from "./PlayerAvatar";

interface Props {
  state: GameState;
  rolling: boolean;
  sending?: boolean | undefined;
  onRoll: () => void;
  dispatch: (a: Action) => void;
  onCounter: () => void;
  /** Online games: the seat of the person holding this device. Other seats only watch. */
  viewer?: number | undefined;
}

/** True when a player's move happens somewhere else: a computer, or a friend on another device. */
function elsewhere(state: GameState, pid: number, viewer: number | undefined): boolean {
  return playerAt(state, pid).isCpu || (viewer !== undefined && pid !== viewer);
}

function Waiting({ state, pid, children }: { state: GameState; pid: number; children?: string }) {
  const who = playerAt(state, pid);
  return (
    <p className="flex items-center justify-center gap-2 text-center text-sm opacity-90 @min-[620px]/game:text-[clamp(11px,1.8cqw,16px)]">
      <Loader2 className="size-4 shrink-0 animate-spin" /> {who.name}{" "}
      {children ?? (who.isCpu ? "dey think…" : "dey play…")}
    </p>
  );
}

export function CenterPanel(props: Props) {
  const { state, rolling } = props;
  const p = playerAt(state, state.current);
  const [faces, setFaces] = useState<[number, number]>(state.dice ?? [3, 4]);

  useEffect(() => {
    if (!rolling) {
      if (state.dice) setFaces(state.dice);
      return;
    }
    const t = setInterval(
      () => setFaces([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]),
      80,
    );
    return () => clearInterval(t);
  }, [rolling, state.dice]);

  return (
    <div className="flex min-h-full flex-col items-center justify-between gap-[1.5cqw] p-[3cqw]">
      <div className="text-center">
        <h1 className="font-display text-[clamp(22px,7cqw,72px)] font-black leading-none tracking-tight text-primary drop-shadow">
          EKOPOLY
        </h1>
        <p className="mt-[0.6cqw] text-[clamp(9px,1.5cqw,14px)] font-medium uppercase tracking-[0.3em] opacity-80">
          Eko o ni baje
        </p>
      </div>

      <div className="flex w-full max-w-[78%] flex-col items-center gap-[1.6cqw]">
        <div className="flex items-center gap-2 rounded-full bg-board-line/40 py-1 pl-1 pr-4">
          <PlayerAvatar player={p} seatIndex={state.current} className="size-8" />
          <span className="text-[clamp(11px,1.8cqw,16px)] font-semibold">
            {p.name}
            <span className="ml-2 opacity-70">{formatNaira(p.money)}</span>
          </span>
        </div>

        <div className="flex gap-[2cqw]">
          <Die value={faces[0]} rolling={rolling} />
          <Die value={faces[1]} rolling={rolling} />
        </div>

        {/* On small boards the actions sit under the board instead (see ActionBar). */}
        <div className="hidden min-h-[clamp(64px,13cqw,120px)] w-full flex-col items-center justify-center gap-2 @min-[620px]/game:flex">
          <Actions {...props} />
        </div>
      </div>

      <div className="flex min-h-[clamp(48px,12cqw,110px)] w-full max-w-[82%] items-end justify-center">
        {state.lastCard ? (
          <div
            key={state.logSeq}
            className={cn(
              "animate-card-in w-full rounded-xl border-2 border-board-line px-4 py-3 text-center shadow-pop",
              state.lastCard.deck === "wahala"
                ? "bg-sunset text-primary-foreground"
                : "bg-primary text-primary-foreground",
            )}
          >
            <p className="font-display text-[clamp(9px,1.5cqw,13px)] font-bold uppercase tracking-widest">
              {state.lastCard.deck === "wahala" ? "⚠️ Wahala" : "🎉 Owambe"}
            </p>
            <p className="mt-1 text-[clamp(10px,1.7cqw,15px)] font-medium leading-snug">
              {state.lastCard.text}
            </p>
          </div>
        ) : (
          <p className="text-center text-[clamp(9px,1.5cqw,13px)] italic opacity-75">
            {state.log[0]?.text}
          </p>
        )}
      </div>
    </div>
  );
}

/** The buttons for whatever the game is waiting on: roll, buy, bid, answer a deal, pay up or end the turn. */
function Actions({ state, rolling, sending, onRoll, dispatch, onCounter, viewer }: Props) {
  const p = playerAt(state, state.current);
  const here = spaceAt(p.position);
  const away = elsewhere(state, p.id, viewer);
  const busy = rolling || !!sending || away;
  const txBusy = rolling || !!sending;
  return (
    <>
      {state.phase === "gameover" ? null : state.phase === "auction" && state.auction ? (
        <AuctionPanel state={state} dispatch={dispatch} viewer={viewer} busy={txBusy} />
      ) : state.phase === "trade" && state.trade ? (
        <TradePanel
          state={state}
          dispatch={dispatch}
          onCounter={onCounter}
          viewer={viewer}
          busy={txBusy}
        />
      ) : away ? (
        <Waiting state={state} pid={p.id} />
      ) : state.phase === "roll" ? (
        p.inJail ? (
          <>
            <p className="text-center text-xs opacity-90 @min-[620px]/game:text-[clamp(10px,1.6cqw,14px)]">
              You're in Kirikiri ({p.jailTurns}/3). Roll doubles, pay bail, or use your connections.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="danfo" size="sm" disabled={busy} onClick={onRoll}>
                Roll for doubles
              </Button>
              <Button
                variant="onCenter"
                size="sm"
                disabled={busy || p.money < JAIL_FINE}
                onClick={() => dispatch({ type: "payJail" })}
              >
                Pay {formatNaira(JAIL_FINE)}
              </Button>
              {p.jailCards > 0 && (
                <Button
                  variant="onCenter"
                  size="sm"
                  disabled={busy}
                  onClick={() => dispatch({ type: "useJailCard" })}
                >
                  Use card
                </Button>
              )}
            </div>
          </>
        ) : (
          <Button variant="danfo" size="xl" disabled={busy} onClick={onRoll}>
            {rolling ? "Rolling…" : state.extraRoll ? "Doubles! Roll again" : "Roll dice"}
          </Button>
        )
      ) : state.phase === "buy" && isOwnable(here) ? (
        <>
          <p className="text-center text-sm @min-[620px]/game:text-[clamp(11px,1.8cqw,16px)]">
            Buy <strong>{here.name}</strong> for <strong>{formatNaira(here.price)}</strong>?
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              variant="danfo"
              disabled={busy || p.money < here.price}
              onClick={() => dispatch({ type: "buy" })}
            >
              Buy am
            </Button>
            <Button
              variant="onCenter"
              disabled={busy}
              onClick={() => dispatch({ type: "auction" })}
            >
              {p.money < here.price ? "Let everybody bid" : "Auction it"}
            </Button>
            <Button
              variant="onCenter"
              disabled={busy}
              onClick={() => dispatch({ type: "decline" })}
            >
              Pass
            </Button>
          </div>
          {p.money < here.price && (
            <p className="text-center text-xs opacity-80 @min-[620px]/game:text-[clamp(9px,1.4cqw,12px)]">
              Not enough cash — mortgage something, or put it up for bidding.
            </p>
          )}
        </>
      ) : state.phase === "debt" ? (
        <>
          <p className="text-center text-sm @min-[620px]/game:text-[clamp(10px,1.7cqw,15px)]">
            You owe <strong>{formatNaira(-p.money)}</strong>. Sell buildings or mortgage property to
            pay.
          </p>
          <Button
            variant={maxRaisable(state, p.id) < 0 ? "destructive" : "onCenter"}
            size="sm"
            disabled={busy}
            onClick={() => dispatch({ type: "bankrupt" })}
          >
            Declare bankruptcy
          </Button>
        </>
      ) : (
        <Button
          variant="go"
          size="xl"
          disabled={busy}
          onClick={() => dispatch({ type: "endTurn" })}
        >
          End turn
        </Button>
      )}
    </>
  );
}

/** Small screens: the same actions, pinned to the viewport bottom so they stay reachable while scrolling. */
export function ActionBar(props: Props) {
  if (props.state.phase === "gameover") return null;
  const actorId = actorOf(props.state);
  const actor = playerAt(props.state, actorId);
  const isMyTurn = !elsewhere(props.state, actorId, props.viewer);

  return (
    <div className="fixed inset-x-2 bottom-2 z-30 pb-[env(safe-area-inset-bottom)] @min-[620px]/game:hidden">
      <div
        className={cn(
          "bg-board-center mx-auto flex max-h-[42dvh] max-w-xl flex-col items-center justify-center gap-2 overflow-y-auto rounded-2xl border-2 px-3 py-3 text-board-center-foreground shadow-pop",
          isMyTurn ? "border-primary ring-1 ring-primary/40" : "border-board-line",
        )}
      >
        {isMyTurn && (
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
            <PlayerAvatar player={actor} seatIndex={actor.id} className="size-5 text-xs" />
            {props.viewer !== undefined ? "Your turn" : `${actor.name}'s turn`} ·{" "}
            {formatNaira(actor.money)}
          </p>
        )}
        <Actions {...props} />
      </div>
    </div>
  );
}

function AuctionPanel({
  state,
  dispatch,
  viewer,
  busy,
}: {
  state: GameState;
  dispatch: (a: Action) => void;
  viewer: number | undefined;
  busy: boolean;
}) {
  const a = state.auction;
  if (!a) return null;
  const sp = spaceAt(a.index);
  const bidder = playerAt(state, a.turn);
  const leader = a.bidder !== null ? playerAt(state, a.bidder) : null;
  const steps = [BID_STEP, 50, 100].map((x) => a.bid + x);

  return (
    <div className="flex w-full flex-col items-center gap-2 rounded-xl bg-board-line/40 px-3 py-2">
      <p className="text-center text-xs @min-[620px]/game:text-[clamp(10px,1.6cqw,14px)]">
        Bidding for <strong>{sp.name}</strong>
        {isOwnable(sp) && <span className="opacity-75"> (list {formatNaira(sp.price)})</span>}
      </p>
      <p className="text-center text-sm @min-[620px]/game:text-[clamp(11px,1.8cqw,16px)]">
        {leader ? (
          <span className="inline-flex flex-wrap items-center justify-center gap-1.5">
            Top bid <strong>{formatNaira(a.bid)}</strong> by{" "}
            <PlayerAvatar player={leader} seatIndex={leader.id} className="size-5 text-xs" />{" "}
            {leader.name}
          </span>
        ) : (
          "No bids yet"
        )}
      </p>
      {elsewhere(state, bidder.id, viewer) ? (
        <Waiting state={state} pid={bidder.id}>
          {bidder.isCpu ? "dey calculate…" : "is deciding on a bid…"}
        </Waiting>
      ) : (
        <>
          <p className="flex items-center gap-2 text-xs font-semibold @min-[620px]/game:text-[clamp(10px,1.6cqw,14px)]">
            <PlayerAvatar player={bidder} seatIndex={bidder.id} className="size-6 text-xs" />
            {bidder.name}, your turn ({formatNaira(bidder.money)} cash)
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {steps.map((amount) => (
              <Button
                key={amount}
                variant="danfo"
                size="sm"
                disabled={busy || amount > bidder.money}
                onClick={() => dispatch({ type: "bid", amount })}
              >
                Bid {formatNaira(amount)}
              </Button>
            ))}
            <Button
              variant="onCenter"
              size="sm"
              disabled={busy}
              onClick={() => dispatch({ type: "auctionPass" })}
            >
              Drop out
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function TradePanel({
  state,
  dispatch,
  onCounter,
  viewer,
  busy,
}: {
  state: GameState;
  dispatch: (a: Action) => void;
  onCounter: () => void;
  viewer: number | undefined;
  busy: boolean;
}) {
  const t = state.trade;
  if (!t) return null;
  const from = playerAt(state, t.from);
  const to = playerAt(state, t.to);
  const side = (props: number[], cash: number) =>
    [...props.map((i) => spaceAt(i).name), ...(cash > 0 ? [formatNaira(cash)] : [])].join(" + ") ||
    "nothing";

  return (
    <div className="flex w-full flex-col items-center gap-2 rounded-xl bg-board-line/40 px-3 py-2 text-center">
      <p className="flex flex-wrap items-center justify-center gap-1 text-xs @min-[620px]/game:text-[clamp(10px,1.6cqw,14px)]">
        <PlayerAvatar player={from} seatIndex={from.id} className="size-5 text-xs" />
        <strong>{from.name}</strong> offers{" "}
        <PlayerAvatar player={to} seatIndex={to.id} className="size-5 text-xs" />
        <strong>{to.name}</strong> a deal
      </p>
      <p className="text-xs @min-[620px]/game:text-[clamp(10px,1.6cqw,14px)]">
        Gives <strong>{side(t.give, t.giveCash)}</strong>
        <br />
        Wants <strong>{side(t.get, t.getCash)}</strong>
      </p>
      {elsewhere(state, to.id, viewer) ? (
        <Waiting state={state} pid={to.id}>
          dey consider am…
        </Waiting>
      ) : (
        <>
          <p className="text-xs opacity-80 @min-[620px]/game:text-[clamp(9px,1.4cqw,12px)]">
            {to.name}, your call.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              variant="go"
              size="sm"
              disabled={busy}
              onClick={() => dispatch({ type: "acceptTrade" })}
            >
              Accept
            </Button>
            <Button variant="onCenter" size="sm" disabled={busy} onClick={onCounter}>
              Counter
            </Button>
            <Button
              variant="onCenter"
              size="sm"
              disabled={busy}
              onClick={() => dispatch({ type: "rejectTrade" })}
            >
              Reject
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
