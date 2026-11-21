import { useCallback, useEffect, useRef, useState } from "react";
import { LogOut, Square, Trophy, Volume2, VolumeX } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cpuDecide } from "@/game/ai";
import { formatNaira } from "@/game/board";
import { actorOf, netWorth, playerAt, reduce, rollDice, type Action, type GameState } from "@/game/engine";
import {
  clearPendingSounds,
  detectGameSounds,
  isSoundEnabled,
  playSound,
  playSoundSequence,
  setSoundEnabled,
  unlockAudio,
} from "@/lib/sounds";
import { cn } from "@/lib/utils";
import { Board } from "./Board";
import { ActionBar, CenterPanel } from "./CenterPanel";
import icon from "@/assets/ekopoly-icon.png";
import { PlayerAvatar } from "./PlayerAvatar";
import { GameLog, PlayersPanel, SpaceDetails } from "./Sidebar";
import { TradeDialog, type TradeDraft } from "./TradeDialog";

/** Online play: moves go to the server instead of being applied on this device. */
export interface OnlinePlay {
  seat: number;
  code: string;
  send: (a: Action) => Promise<void>;
  /** Set only for the room creator: stops the game for everyone. */
  onEnd?: (() => void) | undefined;
}

const FALLBACK: Record<string, Action> = {
  buy: { type: "decline" },
  auction: { type: "auctionPass" },
  trade: { type: "rejectTrade" },
  end: { type: "endTurn" },
  debt: { type: "bankrupt" },
};

export function GameScreen({
  game,
  setGame,
  onQuit,
  onNewGame,
  online,
}: {
  game: GameState;
  setGame: (fn: (g: GameState) => GameState) => void;
  onQuit: () => void;
  onNewGame: () => void;
  online?: OnlinePlay | undefined;
}) {
  const [rolling, setRolling] = useState(false);
  const [sending, setSending] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const sendingRef = useRef(false);
  const localRollSoundRef = useRef(false);
  const prevGameRef = useRef<GameState>(game);
  const [draft, setDraft] = useState<TradeDraft | null>(null);
  const me = playerAt(game, game.current);
  const activeActor = playerAt(game, actorOf(game));
  const viewer = online?.seat;
  const isMyTurn =
    game.phase !== "gameover" &&
    !activeActor.isCpu &&
    (viewer === undefined || viewer === activeActor.id);
  const canTrade =
    !rolling &&
    !sending &&
    !me.isCpu &&
    (viewer === undefined || viewer === game.current) &&
    (game.phase === "roll" || game.phase === "end" || game.phase === "debt");
  const [selected, setSelected] = useState<number>(playerAt(game, game.current).position);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    setSoundOn(isSoundEnabled());
    return () => clearPendingSounds();
  }, []);

  const toggleSound = useCallback(() => {
    const next = !soundOn;
    setSoundEnabled(next);
    setSoundOn(next);
    if (next) playSound("cash");
    else clearPendingSounds();
  }, [soundOn]);

  const dispatch = useCallback(
    (a: Action) => {
      unlockAudio();
      if (online) {
        if (sendingRef.current) return;
        sendingRef.current = true;
        setSending(true);
        void online.send(a).finally(() => {
          sendingRef.current = false;
          setSending(false);
        });
      } else {
        setGame((g) => reduce(g, a));
      }
    },
    [online, setGame],
  );

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const roll = useCallback(
    (dice: [number, number]) => {
      if (online && sendingRef.current) return;
      unlockAudio();
      localRollSoundRef.current = true;
      playSound("roll");
      setRolling(true);
      if (online) {
        sendingRef.current = true;
        setSending(true);
        // The server rolls the real dice; keep the shake going at least as long as a local roll.
        void Promise.all([online.send({ type: "roll", dice }), new Promise((r) => setTimeout(r, 650))]).finally(() => {
          sendingRef.current = false;
          setSending(false);
          setRolling(false);
        });
        return;
      }
      later(() => {
        dispatch({ type: "roll", dice });
        setRolling(false);
      }, 650);
    },
    [dispatch, online],
  );

  useEffect(() => {
    const prev = prevGameRef.current;
    prevGameRef.current = game;
    if (prev === game) return;
    const includeRemoteRoll = !localRollSoundRef.current;
    localRollSoundRef.current = false;
    const cues = detectGameSounds(prev, game, { includeRemoteRoll });
    if (cues.length > 0) playSoundSequence(cues);
  }, [game]);

  // Follow the active player's token.
  const pos = playerAt(game, game.current).position;
  useEffect(() => setSelected(pos), [pos, game.current]);

  // Computer players act on their own.
  useEffect(() => {
    const p = playerAt(game, actorOf(game));
    if (online || !p.isCpu || game.phase === "gameover" || rolling) return;
    const action = cpuDecide(game);
    const t = window.setTimeout(
      () => {
        if (action.type === "roll") return roll(action.dice);
        setGame((g) => {
          const next = reduce(g, action);
          if (next !== g) return next;
          const fb = FALLBACK[g.phase];
          return fb ? reduce(g, fb) : g;
        });
      },
      action.type === "roll" ? 700 : 550,
    );
    return () => clearTimeout(t);
  }, [game, online, rolling, roll, setGame]);

  const panelProps = {
    state: game,
    rolling,
    sending,
    onRoll: () => roll(rollDice()),
    dispatch,
    viewer,
    onCounter: () => {
      const t = game.trade;
      if (!t) return;
      setDraft({
        from: t.to,
        counter: true,
        terms: { to: t.from, give: t.get, get: t.give, giveCash: t.getCash, getCash: t.giveCash },
      });
    },
  };

  const winner = game.winner !== null ? playerAt(game, game.winner) : null;

  return (
    <div className="min-h-dvh" onPointerDownCapture={unlockAudio}>
      <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5 sm:px-6 sm:py-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <img src={icon} alt="" width={36} height={36} className="size-8 shrink-0 sm:size-9" />
          <span className="hidden font-display text-lg font-black tracking-tight text-primary sm:inline">EKOPOLY</span>
          {online && (
            <span className="shrink-0 rounded-md bg-secondary px-2 py-0.5 font-mono text-xs tracking-widest text-secondary-foreground">
              {online.code}
            </span>
          )}
          <span className="hidden text-sm text-muted-foreground sm:inline">
            Round {game.round}
            {game.maxRounds !== null && ` of ${game.maxRounds}`}
          </span>
          {game.phase !== "gameover" && (
            <span
              className={cn(
                "inline-flex min-w-0 items-center gap-1.5 truncate rounded-full px-2 py-0.5 text-xs font-medium sm:hidden",
                isMyTurn ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground",
              )}
            >
              <span className="truncate">
                {online && viewer === activeActor.id ? "Your turn" : `${activeActor.name}'s turn`}
              </span>
              <span className="shrink-0 opacity-75">· R{game.round}</span>
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSound}
            aria-label={soundOn ? "Mute sound effects" : "Unmute sound effects"}
            aria-pressed={soundOn}
          >
            {soundOn ? <Volume2 /> : <VolumeX className="text-muted-foreground" />}
            <span className="hidden sm:inline">{soundOn ? "Sound on" : "Sound off"}</span>
          </Button>
          {online?.onEnd && game.phase !== "gameover" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  aria-label="End game"
                >
                  <Square /> <span className="hidden sm:inline">End game</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>End this game for everyone?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The game will finish immediately and the player with the highest net worth will win.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep playing</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => online.onEnd?.()}
                  >
                    End game
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button variant="ghost" size="sm" onClick={onQuit} aria-label={online ? "Back to rooms" : "Leave game"}>
            <LogOut /> <span className="hidden sm:inline">{online ? "Back to rooms" : "Leave game"}</span>
          </Button>
        </div>
      </header>

      <main
        className={cn(
          "mx-auto grid max-w-[1400px] gap-6 p-3 sm:p-6 lg:grid-cols-[minmax(0,1fr)_360px]",
          game.phase !== "gameover" && "pb-44 lg:pb-6",
        )}
      >
        <div className="@container/game mx-auto w-full max-w-[min(100%,calc(100dvh-7rem))]">
          <Board state={game} selected={selected} onSelect={setSelected}>
            <CenterPanel {...panelProps} />
          </Board>
          <ActionBar {...panelProps} />
        </div>

        <aside className="space-y-4">
          <PlayersPanel
            state={game}
            viewer={viewer}
            onSelect={setSelected}
            onTrade={
              canTrade
                ? (to) => setDraft({ from: game.current, terms: { to, give: [], get: [], giveCash: 0, getCash: 0 } })
                : undefined
            }
          />
          <SpaceDetails state={game} index={selected} dispatch={dispatch} viewer={viewer} busy={rolling || sending} />
          <GameLog state={game} />
        </aside>
      </main>

      <TradeDialog
        state={game}
        draft={draft}
        onClose={() => setDraft(null)}
        onPropose={(terms) => {
          dispatch({ type: "proposeTrade", terms });
          setDraft(null);
        }}
      />

      {winner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6 backdrop-blur">
          <div className="animate-card-in w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card text-center shadow-board">
            <div className="h-3 bg-danfo" />
            <div className="p-8">
              <Trophy className="mx-auto size-12 text-primary" />
              <p className="mt-4 text-sm uppercase tracking-[0.3em] text-muted-foreground">Big Man of Lagos</p>
              <div className="mt-3 flex items-center justify-center gap-3">
                <PlayerAvatar player={winner} seatIndex={winner.id} className="size-12 text-2xl" />
                <h2 className="font-display text-3xl font-black">{winner.name}</h2>
              </div>
              <p className="mt-3 text-muted-foreground">
                Finished with {formatNaira(netWorth(game, winner.id))} in cash and property. Owambe for everybody!
              </p>
              <Button variant="danfo" size="xl" className="mt-6 w-full" onClick={onNewGame}>
                {online ? "Back to rooms" : "Play again"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
