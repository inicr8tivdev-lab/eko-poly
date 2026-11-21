import { useEffect, useState } from "react";
import { Bot, Globe, Play, RotateCcw, User } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import logo from "@/assets/ekopoly-logo.png";
import poster from "@/assets/lagos-poster.jpg";
import { type GameState, type PlayerConfig } from "@/game/engine";
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

  useEffect(() => {
    const savedAvatar = loadSavedAvatar();
    if (savedAvatar) {
      setPlayers((ps) => ps.map((p, j) => (j === 0 && !p.avatar ? { ...p, avatar: savedAvatar } : p)));
    }
  }, []);

  const update = (i: number, patch: Partial<PlayerConfig>) =>
    setPlayers((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  return (
    <main className="grid min-h-screen lg:grid-cols-[1fr_minmax(0,560px)]">
      <div className="relative hidden overflow-hidden lg:block">
        <img src={poster} alt="Danfo buses crossing Third Mainland Bridge at sunset" width={1024} height={1280} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-x-0 bottom-0 h-3 bg-danfo" />
      </div>

      <section className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <h1>
          <img src={logo} alt="Ekopoly" width={560} height={468} className="h-auto w-52 sm:w-64" />
        </h1>
        <p className="mt-4 max-w-md text-lg text-muted-foreground">
          The Lagos property game. Buy Lekki, survive go-slow, dodge LASTMA — and become the Big Man of Eko.
        </p>

        {saved && (
          <Button variant="go" size="xl" className="mt-8 w-full" onClick={onResume}>
            <RotateCcw /> Continue saved game
          </Button>
        )}

        <div className="mt-8 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-bold uppercase tracking-widest">Players</h2>
            <div className="flex rounded-lg bg-secondary p-1">
              {[2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCount(n)}
                  className={cn(
                    "rounded-md px-3 py-1 text-sm font-semibold transition",
                    count === n ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <ul className="mt-4 space-y-3">
            {players.slice(0, count).map((p, i) => (
              <li key={i} className="flex items-center gap-3">
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
                  className="h-10 bg-background"
                />
                <button
                  type="button"
                  onClick={() => update(i, { isCpu: !p.isCpu })}
                  className={cn(
                    "flex h-10 w-28 shrink-0 items-center justify-center gap-1.5 rounded-md border text-sm font-medium transition",
                    p.isCpu ? "border-border bg-secondary text-secondary-foreground" : "border-primary bg-primary/10 text-primary",
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

        <div className="mt-4 rounded-2xl border border-border bg-card p-5">
          <h2 className="font-display text-sm font-bold uppercase tracking-widest">Game length</h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {LENGTHS.map((l) => (
              <button
                key={l.label}
                type="button"
                onClick={() => setLength(l.rounds)}
                className={cn(
                  "rounded-lg border px-2 py-2.5 text-left transition",
                  length === l.rounds ? "border-primary bg-primary/10" : "border-border bg-secondary hover:border-muted-foreground",
                )}
              >
                <span className={cn("block text-sm font-semibold", length === l.rounds && "text-primary")}>{l.label}</span>
                <span className="block text-xs text-muted-foreground">{l.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <Button variant="danfo" size="xl" className="mt-6 w-full" onClick={() => onStart(players.slice(0, count), length)}>
          <Play /> {saved ? "Start new game" : "Enter Lagos"}
        </Button>
        <Button asChild variant="outline" size="xl" className="mt-3 w-full">
          <Link to="/online">
            <Globe /> Play online with friends
          </Link>
        </Button>
      </section>
    </main>
  );
}
