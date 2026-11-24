import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AlertCircle, ArrowRight, Globe, Loader2, LogIn, Plus, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import { AvatarPicker } from "@/components/game/AvatarPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OnlineHeader } from "@/components/online/OnlineHeader";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { loadSavedAvatar, saveLocalAvatar } from "@/lib/avatar";
import { fallbackPlayerName } from "@/lib/profile";
import {
  isAuthFailure,
  isMissingSchemaError,
  myAvatarQuery,
  myNameQuery,
  myRoomsQuery,
  openLobbiesQuery,
} from "@/lib/room-queries";
import { CODE_LENGTH, MAX_PLAYERS, normalizeCode } from "@/lib/rooms";
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
      { name: "description", content: "Create an Ekopoly room, browse open lobbies looking for players, or join with a code." },
      { property: "og:title", content: "Play Ekopoly online with friends" },
      { property: "og:description", content: "Create rooms or join open Ekopoly lobbies for up to 4 players." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(myRoomsQuery(context.user.id));
    void context.queryClient.prefetchQuery(openLobbiesQuery());
    void context.queryClient.prefetchQuery(myAvatarQuery(context.user.id));
    void context.queryClient.prefetchQuery(myNameQuery(context.user.id));
  },
  component: OnlinePage,
});

function useLiveOnlineLobbies(userId: string) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ["open-lobbies"] });
      void queryClient.invalidateQueries({ queryKey: ["my-rooms", userId] });
    };
    const channel = supabase
      .channel(`online-lobbies-${userId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: "mode=eq.online" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_players" }, refresh)
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}

function OnlinePage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  useLiveOnlineLobbies(user.id);

  const defaultName = fallbackPlayerName(user);
  const { data: savedName = "" } = useQuery(myNameQuery(user.id));
  const { data: savedAvatar } = useQuery(myAvatarQuery(user.id));
  const roomsQuery = useQuery(myRoomsQuery(user.id));
  const lobbiesQuery = useQuery(openLobbiesQuery());
  const rooms = roomsQuery.data ?? [];
  const lobbies = lobbiesQuery.data ?? [];

  const [name, setName] = useState(savedName || defaultName);
  const [avatar, setAvatar] = useState<string | null>(savedAvatar ?? null);
  const [length, setLength] = useState<number | null>(30);
  const [code, setCode] = useState("");
  const [joiningLobbyCode, setJoiningLobbyCode] = useState<string | null>(null);

  useEffect(() => setName((n) => n || savedName || defaultName), [savedName, defaultName]);
  useEffect(() => {
    const local = loadSavedAvatar();
    setAvatar((prev) => prev ?? savedAvatar ?? local ?? null);
  }, [savedAvatar]);

  useEffect(() => {
    const authErr =
      (roomsQuery.isError && isAuthFailure(roomsQuery.error)) ||
      (lobbiesQuery.isError && isAuthFailure(lobbiesQuery.error));
    if (!authErr) return;
    let active = true;
    void supabase.auth.refreshSession().then(async ({ data, error }) => {
      if (!active) return;
      if (!error && data.session) {
        void queryClient.invalidateQueries({ queryKey: ["my-rooms"] });
        void queryClient.invalidateQueries({ queryKey: ["open-lobbies"] });
        return;
      }
      await supabase.auth.signOut().catch(() => {});
      if (active) void navigate({ to: "/auth", search: { redirect: "/online" }, replace: true });
    });
    return () => {
      active = false;
    };
  }, [roomsQuery.isError, roomsQuery.error, lobbiesQuery.isError, lobbiesQuery.error, navigate, queryClient]);

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
      if (r.ok) {
        void queryClient.invalidateQueries({ queryKey: ["my-rooms", user.id] });
        void queryClient.invalidateQueries({ queryKey: ["open-lobbies"] });
        void queryClient.invalidateQueries({ queryKey: ["my-name", user.id] });
        void go(r.code);
      } else {
        toast.error(r.error);
      }
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
    mutationFn: (targetCode?: string) => join({ data: { code: targetCode ?? code, name, avatar } }),
    onMutate: (targetCode) => {
      setJoiningLobbyCode(targetCode ?? null);
    },
    onSuccess: (r) => {
      if (r.ok) {
        void queryClient.invalidateQueries({ queryKey: ["my-rooms", user.id] });
        void queryClient.invalidateQueries({ queryKey: ["open-lobbies"] });
        void go(r.code);
      } else {
        toast.error(r.error);
      }
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
    onSettled: () => {
      setJoiningLobbyCode(null);
    },
  });

  const missingSchema =
    (roomsQuery.isError && isMissingSchemaError(roomsQuery.error)) ||
    (lobbiesQuery.isError && isMissingSchemaError(lobbiesQuery.error));

  return (
    <div className="min-h-screen">
      <OnlineHeader />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        <h1 className="font-display text-3xl font-black tracking-tight sm:text-4xl">Play with friends</h1>
        <p className="mt-2 text-muted-foreground">
          Create as many rooms as you want, join any open lobby looking for players, or enter a room code directly.
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
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                void roomsQuery.refetch();
                void lobbiesQuery.refetch();
              }}
            >
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
              <LogIn className="size-4 text-primary" /> Join with code
            </h2>
            <form
              className="mt-3"
              onSubmit={(e) => {
                e.preventDefault();
                joinM.mutate(undefined);
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
                {joinM.isPending && joiningLobbyCode === null ? <Loader2 className="animate-spin" /> : <ArrowRight />} Join
              </Button>
            </form>
          </section>
        </div>

        <section className="mt-8" aria-labelledby="open-lobbies-heading">
          <div className="flex items-center justify-between gap-2">
            <h2
              id="open-lobbies-heading"
              className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-widest text-muted-foreground"
            >
              <Globe className="size-4 text-primary" />
              Open lobbies looking for players
              {lobbies.length > 0 && (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary">
                  {lobbies.length}
                </span>
              )}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs text-muted-foreground"
              onClick={() => void lobbiesQuery.refetch()}
              disabled={lobbiesQuery.isFetching}
              aria-label="Refresh open lobbies"
            >
              <RefreshCw className={cn("size-3.5", lobbiesQuery.isFetching && "animate-spin")} />
              Refresh
            </Button>
          </div>

          {lobbiesQuery.isError && !missingSchema && !isAuthFailure(lobbiesQuery.error) ? (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm">
              <span className="text-muted-foreground">Couldn't load open lobbies right now.</span>
              <Button variant="secondary" size="sm" onClick={() => void lobbiesQuery.refetch()}>
                Try again
              </Button>
            </div>
          ) : lobbiesQuery.isLoading && lobbies.length === 0 ? (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-primary" /> Looking for active lobbies…
            </div>
          ) : lobbies.length === 0 ? (
            <div className="mt-3 rounded-xl border border-dashed border-border bg-card/50 px-4 py-5 text-center text-sm text-muted-foreground">
              No open lobbies looking for players right now — create a room above and wait for others to join!
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {lobbies.map((lobby) => {
                const players = lobby.game_players ?? [];
                const playerCount = players.length;
                const spotsLeft = Math.max(0, MAX_PLAYERS - playerCount);
                const isMember = players.some((p) => p.user_id === user.id);
                const roundText = lobby.max_rounds ? `${lobby.max_rounds} rounds` : "Endless";
                const isJoiningThis = joinM.isPending && joiningLobbyCode === lobby.code;

                return (
                  <li
                    key={lobby.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 transition hover:border-primary/60"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-base font-bold tracking-widest text-primary">{lobby.code}</span>
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
                          {playerCount}/{MAX_PLAYERS} · {spotsLeft} {spotsLeft === 1 ? "spot" : "spots"} left
                        </span>
                        <span className="text-xs text-muted-foreground">{roundText}</span>
                      </div>
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {players.map((p) => p.display_name).join(", ")}
                      </p>
                    </div>
                    {isMember ? (
                      <Button variant="secondary" size="sm" asChild>
                        <Link to="/room/$code" params={{ code: lobby.code }}>
                          Open lobby
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        variant="go"
                        size="sm"
                        disabled={joinM.isPending || !name.trim()}
                        onClick={() => joinM.mutate(lobby.code)}
                      >
                        {isJoiningThis ? <Loader2 className="animate-spin" /> : <ArrowRight />}
                        Join
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {roomsQuery.isError && !missingSchema && !isAuthFailure(roomsQuery.error) && (
          <div className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm">
            <span className="text-muted-foreground">Couldn't load your active rooms right now.</span>
            <Button variant="secondary" size="sm" onClick={() => void roomsQuery.refetch()}>
              Try again
            </Button>
          </div>
        )}

        {rooms.length > 0 && (
          <section className="mt-8" aria-labelledby="your-rooms-heading">
            <h2
              id="your-rooms-heading"
              className="font-display text-sm font-bold uppercase tracking-widest text-muted-foreground"
            >
              Your rooms ({rooms.length})
            </h2>
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
                    <span className="text-xs text-muted-foreground">
                      {(r.game_players ?? []).length}/{MAX_PLAYERS}
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
