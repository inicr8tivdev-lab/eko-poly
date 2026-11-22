import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AlertCircle, ArrowRight, Loader2, LogIn, Plus, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import { AvatarPicker } from "@/components/game/AvatarPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OnlineHeader } from "@/components/online/OnlineHeader";
import { supabase } from "@/integrations/supabase/client";
import { loadSavedAvatar, saveLocalAvatar } from "@/lib/avatar";
import { isAuthFailure, isMissingSchemaError, myAvatarQuery, myNameQuery, myRoomsQuery } from "@/lib/room-queries";
import { CODE_LENGTH, normalizeCode } from "@/lib/rooms";
import { createRoom, joinRoom, updateMyAvatar } from "@/lib/rooms.functions";
import { cn } from "@/lib/utils";

const LENGTHS = [
  { label: "Quick", hint: "15 rounds", rounds: 15 },
  { label: "Standard", hint: "30 rounds", rounds: 30 },
  { label: "Endless", hint: "Till bankruptcy", rounds: null },
] as const;

export const Route = createFileRoute("/_authenticated/online")({
  head: () => ({
    meta: [
      { title: "Play online — Ekopoly" },
      { name: "description", content: "Create a private Ekopoly room or join one with a code from your friend." },
      { property: "og:title", content: "Play Ekopoly online with friends" },
      { property: "og:description", content: "Private rooms for up to 4 friends, each on their own phone." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(myRoomsQuery(context.user.id));
    void context.queryClient.prefetchQuery(myAvatarQuery(context.user.id));
    void context.queryClient.prefetchQuery(myNameQuery(context.user.id));
  },
  component: OnlinePage,
});

function OnlinePage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: savedName = "" } = useQuery(myNameQuery(user.id));
  const { data: savedAvatar } = useQuery(myAvatarQuery(user.id));
  const roomsQuery = useQuery(myRoomsQuery(user.id));
  const rooms = roomsQuery.data ?? [];
  const [name, setName] = useState(savedName);
  const [avatar, setAvatar] = useState<string | null>(savedAvatar ?? null);
  const [length, setLength] = useState<number | null>(30);
  const [code, setCode] = useState("");
  useEffect(() => setName((n) => n || savedName), [savedName]);
  useEffect(() => {
    const local = loadSavedAvatar();
    setAvatar((prev) => prev ?? savedAvatar ?? local ?? null);
  }, [savedAvatar]);
  useEffect(() => {
    if (!roomsQuery.isError || !isAuthFailure(roomsQuery.error)) return;
    let active = true;
    void supabase.auth.refreshSession().then(async ({ data, error }) => {
      if (!active) return;
      if (!error && data.session) {
        void queryClient.invalidateQueries({ queryKey: ["my-rooms"] });
        return;
      }
      await supabase.auth.signOut().catch(() => {});
      if (active) void navigate({ to: "/auth", search: { redirect: "/online" }, replace: true });
    });
    return () => {
      active = false;
    };
  }, [roomsQuery.isError, roomsQuery.error, navigate, queryClient]);

  const create = useServerFn(createRoom);
  const join = useServerFn(joinRoom);
  const saveAvatarFn = useServerFn(updateMyAvatar);

  const handleAvatarChange = (next: string | null) => {
    setAvatar(next);
    saveLocalAvatar(next);
    void saveAvatarFn({ data: { avatar: next } })
      .then(() => queryClient.invalidateQueries({ queryKey: ["my-avatar", user.id] }))
      .catch(() => {});
  };

  const go = (c: string) => navigate({ to: "/room/$code", params: { code: c } });

  const handleUnauthorizedError = async (fallbackToast: string) => {
    const { data, error } = await supabase.auth.refreshSession().catch(() => ({ data: { session: null }, error: new Error("refresh failed") }));
    if (!error && data.session) {
      toast.error(fallbackToast);
      return;
    }
    await supabase.auth.signOut().catch(() => {});
    toast.error("Your session expired — please sign in again.");
    void navigate({ to: "/auth", search: { redirect: "/online" }, replace: true });
  };

  const createM = useMutation({
    mutationFn: () => create({ data: { name, maxRounds: length, avatar } }),
    onSuccess: (r) => {
      if (r.ok) void go(r.code);
      else toast.error(r.error);
    },
    onError: (err) => {
      console.error("createRoom error", err);
      const msg = err instanceof Error ? err.message : "";
      if (msg.toLowerCase().includes("unauthorized")) {
        void handleUnauthorizedError("Couldn't verify your request with the server — please try again.");
        return;
      }
      toast.error("Could not create the room. Please try again.");
    },
  });
  const joinM = useMutation({
    mutationFn: () => join({ data: { code, name, avatar } }),
    onSuccess: (r) => {
      if (r.ok) void go(r.code);
      else toast.error(r.error);
    },
    onError: (err) => {
      console.error("joinRoom error", err);
      const msg = err instanceof Error ? err.message : "";
      if (msg.toLowerCase().includes("unauthorized")) {
        void handleUnauthorizedError("Couldn't verify your request with the server — please try again.");
        return;
      }
      toast.error("Could not join the room. Please try again.");
    },
  });

  const missingSchema = roomsQuery.isError && isMissingSchemaError(roomsQuery.error);

  return (
    <div className="min-h-screen">
      <OnlineHeader />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        <h1 className="font-display text-3xl font-black tracking-tight sm:text-4xl">Play with friends</h1>
        <p className="mt-2 text-muted-foreground">
          Make a private room, send the code to your people, and everyone plays from their own phone.
        </p>

        {missingSchema && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-400" />
            <div className="flex-1">
              <p className="font-semibold text-foreground">Supabase tables not initialized yet</p>
              <p className="mt-1 text-muted-foreground">
                This Supabase project does not have the <code>games</code>, <code>game_players</code>, <code>profiles</code>, or{" "}
                <code>game_results</code> tables yet. Run the schema SQL in your Supabase SQL Editor, then refresh.
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => void roomsQuery.refetch()}>
              <RefreshCw className="size-3.5" /> Retry
            </Button>
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-border bg-card p-5">
          <Label htmlFor="name" className="font-display text-xs font-bold uppercase tracking-widest">
            Your profile at the table
          </Label>
          <div className="mt-2 flex items-center gap-3">
            <AvatarPicker
              seatIndex={0}
              name={name || "Player"}
              avatar={avatar}
              sizeClassName="size-11 text-xl"
              onChange={handleAvatarChange}
              ariaLabel="Customize your profile avatar"
            />
            <Input
              id="name"
              value={name}
              maxLength={18}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ini"
              className="h-11 bg-background"
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Tap your token to choose a preset or upload a photo (auto-resized to ≤ 30 KB) for your board piece.
          </p>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-widest">
              <Plus className="size-4 text-primary" /> New room
            </h2>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {LENGTHS.map((l) => (
                <button
                  key={l.label}
                  type="button"
                  onClick={() => setLength(l.rounds)}
                  className={cn(
                    "rounded-lg border px-2 py-2 text-left transition",
                    length === l.rounds ? "border-primary bg-primary/10" : "border-border bg-secondary hover:border-muted-foreground",
                  )}
                >
                  <span className={cn("block text-sm font-semibold", length === l.rounds && "text-primary")}>{l.label}</span>
                  <span className="block text-[11px] leading-tight text-muted-foreground">{l.hint}</span>
                </button>
              ))}
            </div>
            <Button
              variant="danfo"
              size="lg"
              className="mt-4 w-full"
              disabled={createM.isPending || !name.trim()}
              onClick={() => createM.mutate()}
            >
              {createM.isPending ? <Loader2 className="animate-spin" /> : <Users />} Create room
            </Button>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-widest">
              <LogIn className="size-4 text-primary" /> Join a room
            </h2>
            <form
              className="mt-3"
              onSubmit={(e) => {
                e.preventDefault();
                joinM.mutate();
              }}
            >
              <Label htmlFor="code" className="text-xs text-muted-foreground">
                Room code
              </Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(normalizeCode(e.target.value))}
                placeholder="ABC234"
                autoCapitalize="characters"
                autoComplete="off"
                className="mt-1 h-11 bg-background text-center font-mono text-lg tracking-[0.4em]"
              />
              <Button
                type="submit"
                variant="go"
                size="lg"
                className="mt-4 w-full"
                disabled={joinM.isPending || code.length !== CODE_LENGTH || !name.trim()}
              >
                {joinM.isPending ? <Loader2 className="animate-spin" /> : <ArrowRight />} Join
              </Button>
            </form>
          </section>
        </div>

        {roomsQuery.isError && !missingSchema && !isAuthFailure(roomsQuery.error) && (
          <div className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm">
            <span className="text-muted-foreground">Couldn't load your active rooms right now.</span>
            <Button variant="secondary" size="sm" onClick={() => void roomsQuery.refetch()}>
              Try again
            </Button>
          </div>
        )}

        {rooms.length > 0 && (
          <section className="mt-8">
            <h2 className="font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">Your rooms</h2>
            <ul className="mt-3 space-y-2">
              {rooms.map((r) => (
                <li key={r.id}>
                  <Link
                    to="/room/$code"
                    params={{ code: r.code ?? "" }}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 transition hover:border-primary"
                  >
                    <span className="font-mono text-base tracking-widest text-primary">{r.code}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                      {(r.game_players ?? []).map((p) => p.display_name).join(", ")}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-semibold",
                        r.status === "playing" ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground",
                      )}
                    >
                      {r.status === "playing" ? "Playing" : "In lobby"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-8 text-center text-sm">
          <Link to="/" className="text-muted-foreground hover:text-foreground">
            ← Play on one device instead
          </Link>
        </p>
      </main>
    </div>
  );
}
