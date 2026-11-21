import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Crown, Loader2, LogOut, Play, Share2 } from "lucide-react";
import { toast } from "sonner";
import { AvatarPicker } from "@/components/game/AvatarPicker";
import { AvatarCircle } from "@/components/game/PlayerAvatar";
import { GameScreen, type OnlinePlay } from "@/components/game/GameScreen";
import { OnlineHeader } from "@/components/online/OnlineHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { tokenOf, type Action } from "@/game/engine";
import { loadSavedAvatar, saveLocalAvatar } from "@/lib/avatar";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { myAvatarQuery, myNameQuery, roomQuery, type Room } from "@/lib/room-queries";
import { MAX_PLAYERS, MIN_PLAYERS, normalizeCode } from "@/lib/rooms";
import { endRoom, joinRoom, leaveRoom, sendMove, startRoom, updateMyAvatar } from "@/lib/rooms.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/room/$code")({
  params: {
    parse: (p) => ({ code: normalizeCode(p.code) }),
    stringify: (p) => ({ code: p.code }),
  },
  head: ({ params }) => ({
    meta: [
      { title: `Room ${params.code} — Ekopoly online` },
      { name: "description", content: "Join your friends' private Ekopoly room and play the Lagos property game live." },
      { property: "og:title", content: "Join my Ekopoly game" },
      { property: "og:description", content: "Tap to join my private Ekopoly room — buy Lekki, dodge LASTMA, become the Big Man of Eko." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context, params }) => {
    void context.queryClient.ensureQueryData(myNameQuery(context.user.id));
    void context.queryClient.ensureQueryData(myAvatarQuery(context.user.id));
    return context.queryClient.ensureQueryData(roomQuery(params.code));
  },
  component: RoomPage,
});

function useLiveRoom(room: Room | null, code: string) {
  const queryClient = useQueryClient();
  const id = room?.id;
  useEffect(() => {
    if (!id || !isSupabaseConfigured()) return;
    const refresh = () => void queryClient.invalidateQueries({ queryKey: ["room", code] });
    const channel = supabase
      .channel(`room-${id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `id=eq.${id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_players", filter: `game_id=eq.${id}` }, refresh)
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, code, queryClient]);
}

function RoomPage() {
  const { code } = Route.useParams();
  const { user } = Route.useRouteContext();
  const { data: room } = useSuspenseQuery(roomQuery(code));
  useLiveRoom(room, code);

  if (!room) return <JoinRoom code={code} userId={user.id} />;
  const me = room.players.find((p) => p.user_id === user.id);
  if (!me) return <JoinRoom code={code} userId={user.id} />;
  if (room.status === "lobby" || !room.state) return <Lobby room={room} userId={user.id} />;
  return <OnlineGame room={room} seat={me.seat} isHost={room.host_id === user.id} />;
}

function JoinRoom({ code, userId }: { code: string; userId: string }) {
  const { data: savedName } = useSuspenseQuery(myNameQuery(userId));
  const { data: savedAvatar } = useSuspenseQuery(myAvatarQuery(userId));
  const [name, setName] = useState(savedName);
  const [avatar, setAvatar] = useState<string | null>(savedAvatar ?? null);
  useEffect(() => {
    const local = loadSavedAvatar();
    setAvatar((prev) => prev ?? savedAvatar ?? local ?? null);
  }, [savedAvatar]);
  const queryClient = useQueryClient();
  const join = useServerFn(joinRoom);
  const m = useMutation({
    mutationFn: () => join({ data: { code, name, avatar } }),
    onSuccess: async (r) => {
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["room", code] });
    },
    onError: () => toast.error("Could not join the room. Please try again."),
  });

  return (
    <div className="min-h-screen">
      <OnlineHeader />
      <main className="mx-auto max-w-sm px-4 py-12">
        <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">You've been invited</p>
        <h1 className="mt-2 font-display text-3xl font-black">
          Room <span className="font-mono tracking-widest text-primary">{code}</span>
        </h1>
        <form
          className="mt-6 rounded-2xl border border-border bg-card p-5"
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate();
          }}
        >
          <Label htmlFor="join-name">Your profile at the table</Label>
          <div className="mt-2 flex items-center gap-3">
            <AvatarPicker
              seatIndex={0}
              name={name || "Player"}
              avatar={avatar}
              sizeClassName="size-11 text-xl"
              onChange={(next) => {
                setAvatar(next);
                saveLocalAvatar(next);
              }}
              ariaLabel="Customize your profile avatar"
            />
            <Input
              id="join-name"
              value={name}
              maxLength={18}
              onChange={(e) => setName(e.target.value)}
              className="h-11 bg-background"
            />
          </div>
          <Button type="submit" variant="danfo" size="lg" className="mt-4 w-full" disabled={m.isPending || !name.trim()}>
            {m.isPending && <Loader2 className="animate-spin" />} Join room
          </Button>
        </form>
        <p className="mt-6 text-center text-sm">
          <Link to="/online" className="text-muted-foreground hover:text-foreground">
            ← Back to rooms
          </Link>
        </p>
      </main>
    </div>
  );
}

function Lobby({ room, userId }: { room: Room; userId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isHost = room.host_id === userId;
  const [copied, setCopied] = useState(false);
  const start = useServerFn(startRoom);
  const leave = useServerFn(leaveRoom);
  const saveAvatarFn = useServerFn(updateMyAvatar);
  const link = typeof window === "undefined" ? "" : `${window.location.origin}/room/${room.code}`;

  const startM = useMutation({
    mutationFn: () => start({ data: { gameId: room.id } }),
    onSuccess: async (r) => {
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["room", room.code] });
    },
    onError: () => toast.error("Could not start the game. Please try again."),
  });
  const leaveM = useMutation({
    mutationFn: () => leave({ data: { gameId: room.id } }),
    onSuccess: (r) => {
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      queryClient.removeQueries({ queryKey: ["room", room.code] });
      void queryClient.invalidateQueries({ queryKey: ["my-rooms"] });
      void navigate({ to: "/online" });
    },
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — share the code instead.");
    }
  };
  const share = async () => {
    try {
      await navigator.share({ title: "Ekopoly", text: `Join my Ekopoly game! Room code ${room.code}`, url: link });
    } catch {
      /* closed the share sheet */
    }
  };
  const canShare = typeof navigator !== "undefined" && "share" in navigator;
  const seats = Array.from({ length: MAX_PLAYERS }, (_, i) => room.players[i]);
  const ready = room.players.length >= MIN_PLAYERS;

  return (
    <div className="min-h-screen">
      <OnlineHeader />
      <main className="mx-auto max-w-xl px-4 py-8 sm:py-12">
        <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Lobby</p>
        <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="h-2 bg-danfo" />
          <div className="p-5 text-center">
            <p className="text-sm text-muted-foreground">Room code</p>
            <p className="mt-1 font-mono text-4xl font-bold tracking-[0.35em] text-primary sm:text-5xl">{room.code}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button variant="secondary" size="sm" onClick={copy}>
                {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy invite link"}
              </Button>
              {canShare && (
                <Button variant="secondary" size="sm" onClick={share}>
                  <Share2 /> Share
                </Button>
              )}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {room.max_rounds ? `${room.max_rounds} rounds — richest player wins at time up` : "Endless — last one standing wins"}
            </p>
          </div>
        </div>

        <h2 className="mt-6 font-display text-sm font-bold uppercase tracking-widest">
          Players ({room.players.length}/{MAX_PLAYERS})
        </h2>
        <ul className="mt-3 space-y-2">
          {seats.map((p, i) => (
            <li
              key={p?.user_id ?? `empty-${i}`}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3 py-2.5",
                p ? "border-border bg-card" : "border-dashed border-border text-muted-foreground",
              )}
            >
              {p && p.user_id === userId ? (
                <AvatarPicker
                  seatIndex={i}
                  name={p.display_name}
                  avatar={p.avatar}
                  sizeClassName="size-10 text-xl"
                  onChange={(next) => {
                    saveLocalAvatar(next);
                    void saveAvatarFn({ data: { avatar: next, gameId: room.id } })
                      .then(async () => {
                        await queryClient.invalidateQueries({ queryKey: ["room", room.code] });
                        await queryClient.invalidateQueries({ queryKey: ["my-avatar", userId] });
                      })
                      .catch(() => toast.error("Could not update avatar."));
                  }}
                />
              ) : p ? (
                <AvatarCircle seatIndex={i} avatar={p.avatar} name={p.display_name} className="size-10 text-xl" />
              ) : (
                <span className="flex size-10 items-center justify-center rounded-full bg-secondary text-xl opacity-50">
                  {tokenOf(i).emoji}
                </span>
              )}
              {p ? (
                <span className="flex flex-1 items-center gap-2 font-semibold">
                  {p.display_name}
                  {p.user_id === room.host_id && <Crown className="size-4 text-primary" aria-label="Host" />}
                  {p.user_id === userId && (
                    <span className="rounded bg-primary/15 px-1.5 text-[10px] uppercase tracking-wider text-primary">You</span>
                  )}
                </span>
              ) : (
                <span className="flex-1 text-sm">Waiting for a friend…</span>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-6">
          {isHost ? (
            <>
              <Button
                variant="danfo"
                size="xl"
                className="w-full"
                disabled={!ready || startM.isPending}
                onClick={() => startM.mutate()}
              >
                {startM.isPending ? <Loader2 className="animate-spin" /> : <Play />} Start the game
              </Button>
              {!ready && (
                <p className="mt-2 text-center text-sm text-muted-foreground">
                  Share the code — you need at least {MIN_PLAYERS} players.
                </p>
              )}
            </>
          ) : (
            <p className="flex items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-4 text-sm">
              <Loader2 className="size-4 animate-spin" /> Waiting for the host to start the game…
            </p>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 w-full text-muted-foreground"
            disabled={leaveM.isPending}
            onClick={() => leaveM.mutate()}
          >
            <LogOut /> {isHost ? "Close room" : "Leave room"}
          </Button>
        </div>
      </main>
    </div>
  );
}

function OnlineGame({ room, seat, isHost }: { room: Room; seat: number; isHost: boolean }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const move = useServerFn(sendMove);

  const send = useCallback(
    async (a: Action) => {
      try {
        const r = await move({ data: { gameId: room.id, move: a } });
        if (!r.ok) toast.error(r.error);
      } catch {
        toast.error("Connection wahala — that move didn't go through. Try again.");
      }
      await queryClient.invalidateQueries({ queryKey: ["room", room.code] });
    },
    [move, room.id, room.code, queryClient],
  );

  const end = useServerFn(endRoom);
  const onEnd = useCallback(async () => {
    try {
      const r = await end({ data: { gameId: room.id } });
      if (!r.ok) toast.error(r.error);
    } catch {
      toast.error("Could not end the game. Please try again.");
    }
    await queryClient.invalidateQueries({ queryKey: ["room", room.code] });
  }, [end, room.id, room.code, queryClient]);

  const online = useMemo<OnlinePlay>(
    () => ({ seat, code: room.code, send, onEnd: isHost ? () => void onEnd() : undefined }),
    [seat, room.code, send, isHost, onEnd],
  );
  const back = () => navigate({ to: "/online" });
  if (!room.state) return null;

  return <GameScreen game={room.state} setGame={() => {}} online={online} onQuit={back} onNewGame={back} />;
}
