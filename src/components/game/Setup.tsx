import { useEffect, useState } from "react";
import { Bot, Globe, Play, RotateCcw, User, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import logo from "@/assets/ekopoly-logo.png";
import poster from "@/assets/lagos-poster.jpg";
import { type GameState, type PlayerConfig } from "@/game/engine";
import { MusicToggle } from "@/components/MusicToggle";
import { loadSavedAvatar, saveLocalAvatar } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import { AvatarPicker } from "./AvatarPicker";

const DEFAULTS: PlayerConfig[] = [
  { name: "You", isCpu: false },
  { name: "Chief Emeka", isCpu: true },
  { name: "Aunty Bisi", isCpu: true },
  { name: "Femi Danfo", isCpu: true },
];

const LENGTHS: { label: string; hint: string; rounds: number | null }[] = [
  { label: "Quick", hint: "15 rounds", rounds: 15 },
  { label: "Standard", hint: "30 rounds", rounds: 30 },
  { label: "Endless", hint: "Till bankruptcy", rounds: null },
];

export function Setup({
  saved,
  onStart,
  onResume,
}: {
  saved: GameState | null;
  onStart: (players: PlayerConfig[], maxRounds: number | null) => void;
  onResume: () => void;
}) {
  const [count, setCount] = useState(3);
  const [players, setPlayers] = useState<PlayerConfig[]>(DEFAULTS);
  const [length, setLength] = useState<number | null>(30);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const savedAvatar = loadSavedAvatar();
    if (savedAvatar) {
      setPlayers((ps) =>
        ps.map((p, j) => (j === 0 && !p.avatar ? { ...p, avatar: savedAvatar } : p)),
      );
    }
    const t = setTimeout(() => setEntered(true), 50);
    return () => clearTimeout(t);
  }, []);

  const update = (i: number, patch: Partial<PlayerConfig>) =>
    setPlayers((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  return (
    <main className="grid min-h-screen overflow-x-hidden lg:grid-cols-[1fr_minmax(0,560px)]">
      <div className="relative hidden overflow-hidden lg:block">
        <img
          src={poster}
          alt="Danfo buses crossing Third Mainland Bridge at sunset"
          width={1024}
          height={1280}
          className="absolute inset-0 h-full w-full object-cover animate-scale-slow transition-transform duration-1000"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-3 bg-danfo animate-pulse" />
        <div className="absolute bottom-12 left-12 right-12 z-10 text-white drop-shadow-md">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/90 px-3 py-1 font-display text-xs font-bold uppercase tracking-widest text-primary-foreground backdrop-blur-sm">
            <Sparkles className="size-3.5 animate-spin" /> Eko o ni baje
          </span>
          <p className="mt-3 font-display text-2xl font-black tracking-tight sm:text-3xl">
            Buy Banana Island, survive go-slow &amp; own Lagos!
          </p>
        </div>
      </div>

      <section
        className={cn(
          "flex flex-col justify-center px-6 py-12 sm:px-12 transition-all duration-700 ease-out",
          entered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <h1 className="animate-fade-in">
            <img
              src={logo}
              alt="Ekopoly"
              width={560}
              height={468}
              className="h-auto w-52 sm:w-64 drop-shadow-sm transition-transform duration-500 hover:scale-105"
            />
          </h1>
          <MusicToggle compactOnMobile={false} variant="outline" />
        </div>
        <p className="mt-4 max-w-md text-lg text-muted-foreground animate-fade-in">
          The ultimate Lagos property game. Buy Lekki, dodge LASTMA, collect owambe spray — and
          become the Big Man of Eko.
        </p>

        {saved && (
          <div className="animate-card-in mt-6">
            <Button
              variant="go"
              size="xl"
              className="w-full shadow-lg transition-all hover:scale-[1.01]"
              onClick={onResume}
            >
              <RotateCcw className="animate-spin-slow" /> Continue saved game
            </Button>
          </div>
        )}

        <div className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-bold uppercase tracking-widest">Players</h2>
            <div className="flex rounded-lg bg-secondary p-1">
              {[2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCount(n)}
                  className={cn(
                    "rounded-md px-3 py-1 text-sm font-semibold transition-all duration-300",
                    count === n
                      ? "bg-primary text-primary-foreground shadow-sm scale-105"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <ul className="mt-4 space-y-3">
            {players.slice(0, count).map((p, i) => (
              <li
                key={i}
                className="flex items-center gap-3 transition-all duration-300 animate-fade-in"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <AvatarPicker
                  seatIndex={i}
                  name={p.name}
                  avatar={p.avatar}
                  onChange={(next) => {
                    update(i, { avatar: next });
                    if (i === 0) saveLocalAvatar(next);
                  }}
                />
                <Input
                  value={p.name}
                  maxLength={18}
                  onChange={(e) => update(i, { name: e.target.value })}
                  aria-label={`Player ${i + 1} name`}
                  className="h-10 bg-background transition-colors focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => update(i, { isCpu: !p.isCpu })}
                  className={cn(
                    "flex h-10 w-28 shrink-0 items-center justify-center gap-1.5 rounded-md border text-sm font-medium transition-all",
                    p.isCpu
                      ? "border-border bg-secondary text-secondary-foreground hover:bg-secondary/80"
                      : "border-primary bg-primary/10 text-primary hover:bg-primary/20",
                  )}
                >
                  {p.isCpu ? <Bot className="size-4" /> : <User className="size-4" />}
                  {p.isCpu ? "Computer" : "Human"}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            Humans take turns on this device. Everyone starts with ₦1.5M.
          </p>
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md">
          <h2 className="font-display text-sm font-bold uppercase tracking-widest">Game length</h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {LENGTHS.map((l) => (
              <button
                key={l.label}
                type="button"
                onClick={() => setLength(l.rounds)}
                className={cn(
                  "rounded-lg border px-2 py-2.5 text-left transition-all duration-300",
                  length === l.rounds
                    ? "border-primary bg-primary/10 shadow-sm scale-[1.02]"
                    : "border-border bg-secondary hover:border-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "block text-sm font-semibold",
                    length === l.rounds && "text-primary",
                  )}
                >
                  {l.label}
                </span>
                <span className="block text-xs text-muted-foreground">{l.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <Button
          variant="danfo"
          size="xl"
          className="mt-6 w-full shadow-lg transition-transform hover:scale-[1.01] active:scale-[0.99]"
          onClick={() => onStart(players.slice(0, count), length)}
        >
          <Play className="animate-bounce" /> {saved ? "Start new game" : "Enter Lagos"}
        </Button>
        <Button
          asChild
          variant="outline"
          size="xl"
          className="mt-3 w-full transition-all hover:border-primary"
        >
          <Link to="/online">
            <Globe /> Play online with friends
          </Link>
        </Button>
      </section>
    </main>
  );
}
