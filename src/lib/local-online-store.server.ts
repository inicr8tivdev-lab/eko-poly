import crypto from "node:crypto";
import fs from "node:fs";
import type { GameState } from "@/game/engine";
import { redactSecretMissions } from "@/game/missions";
import { extractChatMessages } from "./chat";

interface LocalUser {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

interface LocalProfile {
  id: string;
  display_name: string;
  avatar?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LocalGameRow {
  id: string;
  code: string | null;
  host_id: string;
  mode: string;
  status: string;
  max_rounds: number | null;
  state: GameState | null;
  version: number;
  winner_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface LocalGamePlayerRow {
  game_id: string;
  user_id: string;
  seat: number;
  display_name: string;
  avatar?: string | null;
  joined_at: string;
}

export interface LocalGameResultRow {
  game_id: string;
  user_id: string;
  display_name: string;
  won: boolean;
  net_worth: number;
  finished_at: string;
}

interface LocalStoreData {
  secret: string;
  users: LocalUser[];
  profiles: LocalProfile[];
  games: LocalGameRow[];
  game_players: LocalGamePlayerRow[];
  game_results: LocalGameResultRow[];
}

const STORE_PATH = "/tmp/ekopoly-online-store.json";
const GLOBAL_KEY = "__ekopolyLocalOnlineStore";

type GlobalWithStore = typeof globalThis & {
  [GLOBAL_KEY]?: LocalStoreData;
};

function loadStore(): LocalStoreData {
  const g = globalThis as GlobalWithStore;
  if (g[GLOBAL_KEY]) return g[GLOBAL_KEY];

  let loaded: LocalStoreData | null = null;
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, "utf8");
      const parsed = JSON.parse(raw) as Partial<LocalStoreData>;
      if (parsed && typeof parsed.secret === "string" && Array.isArray(parsed.users)) {
        loaded = {
          secret: parsed.secret,
          users: parsed.users,
          profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
          games: Array.isArray(parsed.games) ? parsed.games : [],
          game_players: Array.isArray(parsed.game_players) ? parsed.game_players : [],
          game_results: Array.isArray(parsed.game_results) ? parsed.game_results : [],
        };
      }
    }
  } catch {
    // Ignore disk read errors and initialize fresh in-memory store.
  }

  const store: LocalStoreData = loaded ?? {
    secret: crypto.randomBytes(32).toString("hex"),
    users: [],
    profiles: [],
    games: [],
    game_players: [],
    game_results: [],
  };
  g[GLOBAL_KEY] = store;
  return store;
}

function saveStore(store: LocalStoreData) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(store), "utf8");
  } catch {
    // Ephemeral / read-only FS fallback: in-memory globalThis store still persists for process lifetime.
  }
}

function hashPassword(password: string, salt?: string): string {
  const s = salt ?? crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, s, 64).toString("hex");
  return `${s}:${derived}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

function base64Url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

function signToken(store: LocalStoreData, user: { id: string; email: string }): string {
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
  const payload = base64Url(JSON.stringify({ sub: user.id, email: user.email, exp }));
  const sig = crypto
    .createHmac("sha256", store.secret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${sig}`;
}

export function verifyLocalToken(token: string): { id: string; email: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts;
  if (!header || !payload || !sig) return null;

  const store = loadStore();
  const expected = crypto
    .createHmac("sha256", store.secret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      sub?: unknown;
      email?: unknown;
      exp?: unknown;
    };
    if (typeof decoded.sub !== "string" || typeof decoded.email !== "string") return null;
    if (typeof decoded.exp === "number" && decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return { id: decoded.sub, email: decoded.email };
  } catch {
    return null;
  }
}

function syncClientCredentials(
  store: LocalStoreData,
  clientCredentials?: Array<{ email: string; password: string }>,
) {
  if (!Array.isArray(clientCredentials)) return;
  for (const c of clientCredentials) {
    if (c && typeof c.email === "string" && typeof c.password === "string") {
      const email = c.email.trim().toLowerCase();
      const existing = store.users.find((u) => u.email === email);
      if (!existing) {
        const now = new Date().toISOString();
        store.users.push({
          id: crypto.randomUUID(),
          email,
          passwordHash: hashPassword(c.password),
          createdAt: now,
        });
      } else {
        existing.passwordHash = hashPassword(c.password);
      }
    }
  }
  saveStore(store);
}

export function localAuthSignUp(
  emailRaw: string,
  password: string,
  clientCredentials?: Array<{ email: string; password: string }>,
) {
  const email = emailRaw.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { ok: false as const, error: "Please enter a valid email address." };
  }
  if (password.length < 6) {
    return { ok: false as const, error: "Password should be at least 6 characters." };
  }
  const store = loadStore();
  syncClientCredentials(store, clientCredentials);
  const existing = store.users.find((u) => u.email === email);
  if (existing) {
    return {
      ok: false as const,
      error: "An account with this email already exists. Try signing in.",
    };
  }
  const now = new Date().toISOString();
  const user: LocalUser = {
    id: crypto.randomUUID(),
    email,
    passwordHash: hashPassword(password),
    createdAt: now,
  };
  store.users.push(user);
  saveStore(store);
  const access_token = signToken(store, user);
  return {
    ok: true as const,
    session: {
      access_token,
      user: { id: user.id, email: user.email },
    },
  };
}

export function localAuthSignIn(
  emailRaw: string,
  password: string,
  clientCredentials?: Array<{ email: string; password: string }>,
) {
  const email = emailRaw.trim().toLowerCase();
  const store = loadStore();
  syncClientCredentials(store, clientCredentials);
  const user = store.users.find((u) => u.email === email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { ok: false as const, error: "Invalid login credentials" };
  }
  const access_token = signToken(store, user);
  return {
    ok: true as const,
    session: {
      access_token,
      user: { id: user.id, email: user.email },
    },
  };
}

export function localAuthGuest(nameRaw?: string) {
  const store = loadStore();
  const id = crypto.randomUUID();
  const tag = id.slice(0, 6);
  const email = `guest-${tag}@ekopoly.local`;
  const now = new Date().toISOString();
  const user: LocalUser = {
    id,
    email,
    passwordHash: hashPassword(crypto.randomBytes(16).toString("hex")),
    createdAt: now,
  };
  store.users.push(user);
  const cleaned = (nameRaw ?? "").replace(/\s+/g, " ").trim().slice(0, 18);
  if (cleaned) {
    store.profiles.push({ id, display_name: cleaned, created_at: now, updated_at: now });
  }
  saveStore(store);
  const access_token = signToken(store, user);
  return {
    ok: true as const,
    session: {
      access_token,
      user: { id: user.id, email: user.email },
    },
  };
}

export function getLocalRoomForUser(userId: string, code: string) {
  const store = loadStore();
  const game = store.games.find((g) => g.code === code && g.mode === "online");
  if (!game) return null;
  const players = store.game_players
    .filter((p) => p.game_id === game.id)
    .sort((a, b) => a.seat - b.seat)
    .map((p) => ({
      user_id: p.user_id,
      seat: p.seat,
      display_name: p.display_name,
      avatar: p.avatar ?? store.profiles.find((pr) => pr.id === p.user_id)?.avatar ?? null,
    }));
  const me = players.find((p) => p.user_id === userId);
  if (!me) return null;
  const visibleState =
    game.status === "lobby" || !game.state ? null : redactSecretMissions(game.state, me.seat);
  return {
    id: game.id,
    code: game.code ?? code,
    status: game.status as "lobby" | "playing" | "finished",
    host_id: game.host_id,
    max_rounds: game.max_rounds,
    state: visibleState,
    chat: extractChatMessages(game.state),
    version: game.version,
    winner_name: game.winner_name,
    players,
  };
}

export function listLocalRoomsForUser(userId: string) {
  const store = loadStore();
  const myGameIds = new Set(
    store.game_players.filter((p) => p.user_id === userId).map((p) => p.game_id),
  );
  return store.games
    .filter(
      (g) =>
        myGameIds.has(g.id) &&
        g.mode === "online" &&
        (g.status === "lobby" || g.status === "playing"),
    )
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
    .slice(0, 30)
    .map((g) => ({
      id: g.id,
      code: g.code,
      status: g.status,
      max_rounds: g.max_rounds,
      host_id: g.host_id,
      updated_at: g.updated_at,
      game_players: store.game_players
        .filter((p) => p.game_id === g.id)
        .sort((a, b) => a.seat - b.seat)
        .map((p) => ({ display_name: p.display_name, user_id: p.user_id, seat: p.seat })),
    }));
}

export function listLocalOpenLobbies() {
  const store = loadStore();
  return store.games
    .filter((g) => g.mode === "online" && g.status === "lobby" && Boolean(g.code))
    .map((g) => ({
      id: g.id,
      code: g.code,
      status: g.status,
      max_rounds: g.max_rounds,
      host_id: g.host_id,
      updated_at: g.updated_at,
      game_players: store.game_players
        .filter((p) => p.game_id === g.id)
        .sort((a, b) => a.seat - b.seat)
        .map((p) => ({ display_name: p.display_name, user_id: p.user_id, seat: p.seat })),
    }))
    .filter((g) => g.game_players.length > 0 && g.game_players.length < 4)
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
    .slice(0, 50);
}

export function getLocalProfileName(userId: string): string {
  const store = loadStore();
  return store.profiles.find((p) => p.id === userId)?.display_name ?? "";
}

export function getLocalProfileAvatar(userId: string): string | null {
  const store = loadStore();
  return store.profiles.find((p) => p.id === userId)?.avatar ?? null;
}

export function setLocalProfileAvatar(userId: string, avatar: string | null): void {
  const store = loadStore();
  const now = new Date().toISOString();
  const existing = store.profiles.find((p) => p.id === userId);
  if (existing) {
    existing.avatar = avatar;
    existing.updated_at = now;
  } else {
    store.profiles.push({
      id: userId,
      display_name: "",
      avatar,
      created_at: now,
      updated_at: now,
    });
  }
  saveStore(store);
}

export function setLocalRoomPlayerAvatar(
  userId: string,
  gameId: string,
  avatar: string | null,
): void {
  const store = loadStore();
  const now = new Date().toISOString();
  const existing = store.profiles.find((p) => p.id === userId);
  if (existing) {
    existing.avatar = avatar;
    existing.updated_at = now;
  } else {
    store.profiles.push({
      id: userId,
      display_name: "",
      avatar,
      created_at: now,
      updated_at: now,
    });
  }

  const game = store.games.find((g) => g.id === gameId);
  const player = store.game_players.find((p) => p.game_id === gameId && p.user_id === userId);
  if (player && (!game || game.status === "lobby")) {
    player.avatar = avatar;
    if (game) game.updated_at = now;
  }
  saveStore(store);
}

export function getLocalRoomPlayerAvatars(gameId: string): Record<string, string | null> {
  const store = loadStore();
  const map: Record<string, string | null> = {};
  for (const p of store.game_players) {
    if (p.game_id !== gameId) continue;
    map[p.user_id] = p.avatar ?? store.profiles.find((pr) => pr.id === p.user_id)?.avatar ?? null;
  }
  return map;
}

type Filter =
  { type: "eq"; col: string; val: unknown } | { type: "in"; col: string; vals: unknown[] };
type Order = { col: string; ascending: boolean };

function cloneRow<T>(row: T): T {
  return JSON.parse(JSON.stringify(row)) as T;
}

function matchesFilters(row: Record<string, unknown>, filters: Filter[]): boolean {
  for (const f of filters) {
    const v = row[f.col];
    if (f.type === "eq" && v !== f.val) return false;
    if (f.type === "in" && !f.vals.includes(v)) return false;
  }
  return true;
}

export function createLocalDbClient(scopedUserId?: string) {
  return {
    from(table: "games" | "game_players" | "game_results" | "profiles") {
      let mode: "select" | "insert" | "update" | "upsert" | "delete" = "select";
      let payload: unknown = null;
      const filters: Filter[] = [];
      let orderBy: Order | null = null;
      let limitCount: number | null = null;
      let wantSingle: "single" | "maybeSingle" | null = null;
      let wantSelectAfterWrite = false;

      const execute = async (): Promise<{
        data: unknown;
        error: { code?: string; message: string } | null;
      }> => {
        const store = loadStore();
        const now = new Date().toISOString();

        if (table === "games") {
          if (mode === "insert") {
            const input = payload as Partial<LocalGameRow>;
            if (input.code && store.games.some((g) => g.code === input.code)) {
              return {
                data: null,
                error: { code: "23505", message: "duplicate key value violates unique constraint" },
              };
            }
            const row: LocalGameRow = {
              id: input.id ?? crypto.randomUUID(),
              code: input.code ?? null,
              host_id: input.host_id ?? "",
              mode: input.mode ?? "online",
              status: input.status ?? "lobby",
              max_rounds: input.max_rounds ?? null,
              state: input.state ?? null,
              version: input.version ?? 0,
              winner_name: input.winner_name ?? null,
              created_at: now,
              updated_at: now,
            };
            store.games.push(row);
            saveStore(store);
            const out = cloneRow(row);
            return { data: wantSingle ? out : [out], error: null };
          }

          if (mode === "update") {
            const patch = payload as Partial<LocalGameRow>;
            const updated: LocalGameRow[] = [];
            for (const g of store.games) {
              if (matchesFilters(g as unknown as Record<string, unknown>, filters)) {
                Object.assign(g, patch, { updated_at: patch.updated_at ?? now });
                updated.push(cloneRow(g));
              }
            }
            saveStore(store);
            if (!wantSelectAfterWrite) return { data: null, error: null };
            if (wantSingle === "single") {
              return updated[0]
                ? { data: updated[0], error: null }
                : { data: null, error: { message: "Not found" } };
            }
            if (wantSingle === "maybeSingle") return { data: updated[0] ?? null, error: null };
            return { data: updated, error: null };
          }

          if (mode === "delete") {
            const removedIds = new Set<string>();
            store.games = store.games.filter((g) => {
              const hit = matchesFilters(g as unknown as Record<string, unknown>, filters);
              if (hit) removedIds.add(g.id);
              return !hit;
            });
            if (removedIds.size > 0) {
              store.game_players = store.game_players.filter((p) => !removedIds.has(p.game_id));
              store.game_results = store.game_results.filter((r) => !removedIds.has(r.game_id));
            }
            saveStore(store);
            return { data: null, error: null };
          }

          let rows = store.games.filter((g) => {
            if (scopedUserId) {
              const isMember = store.game_players.some(
                (p) => p.game_id === g.id && p.user_id === scopedUserId,
              );
              if (!isMember && g.host_id !== scopedUserId) return false;
            }
            return matchesFilters(g as unknown as Record<string, unknown>, filters);
          });
          if (orderBy) {
            const { col, ascending } = orderBy;
            rows = [...rows].sort((a, b) => {
              const av = (a as unknown as Record<string, unknown>)[col];
              const bv = (b as unknown as Record<string, unknown>)[col];
              if (av === bv) return 0;
              return (av! < bv! ? -1 : 1) * (ascending ? 1 : -1);
            });
          }
          if (limitCount !== null) rows = rows.slice(0, limitCount);
          const cloned = rows.map((r) => cloneRow(r));
          if (wantSingle === "single") {
            return cloned[0]
              ? { data: cloned[0], error: null }
              : { data: null, error: { message: "Not found" } };
          }
          if (wantSingle === "maybeSingle") return { data: cloned[0] ?? null, error: null };
          return { data: cloned, error: null };
        }

        if (table === "game_players") {
          if (mode === "insert") {
            const items = (
              Array.isArray(payload) ? payload : [payload]
            ) as Partial<LocalGamePlayerRow>[];
            const inserted: LocalGamePlayerRow[] = [];
            for (const item of items) {
              if (
                store.game_players.some(
                  (p) =>
                    p.game_id === item.game_id &&
                    (p.user_id === item.user_id || p.seat === item.seat),
                )
              ) {
                return {
                  data: null,
                  error: { code: "23505", message: "duplicate seat or player" },
                };
              }
              const row: LocalGamePlayerRow = {
                game_id: item.game_id ?? "",
                user_id: item.user_id ?? "",
                seat: item.seat ?? 0,
                display_name: item.display_name ?? "Player",
                ...(item.avatar !== undefined ? { avatar: item.avatar } : {}),
                joined_at: now,
              };
              store.game_players.push(row);
              inserted.push(cloneRow(row));
            }
            saveStore(store);
            return { data: wantSelectAfterWrite ? inserted : null, error: null };
          }

          if (mode === "update") {
            const patch = payload as Partial<LocalGamePlayerRow>;
            for (const p of store.game_players) {
              if (matchesFilters(p as unknown as Record<string, unknown>, filters)) {
                Object.assign(p, patch);
              }
            }
            saveStore(store);
            return { data: null, error: null };
          }

          if (mode === "delete") {
            store.game_players = store.game_players.filter(
              (p) => !matchesFilters(p as unknown as Record<string, unknown>, filters),
            );
            saveStore(store);
            return { data: null, error: null };
          }

          let rows = store.game_players.filter((p) =>
            matchesFilters(p as unknown as Record<string, unknown>, filters),
          );
          if (orderBy) {
            const { col, ascending } = orderBy;
            rows = [...rows].sort((a, b) => {
              const av = (a as unknown as Record<string, unknown>)[col];
              const bv = (b as unknown as Record<string, unknown>)[col];
              if (av === bv) return 0;
              return (av! < bv! ? -1 : 1) * (ascending ? 1 : -1);
            });
          }
          const cloned = rows.map((r) => cloneRow(r));
          if (wantSingle === "single") {
            return cloned[0]
              ? { data: cloned[0], error: null }
              : { data: null, error: { message: "Not found" } };
          }
          if (wantSingle === "maybeSingle") return { data: cloned[0] ?? null, error: null };
          return { data: cloned, error: null };
        }

        if (table === "profiles") {
          if (mode === "upsert") {
            const item = payload as Partial<LocalProfile>;
            const existing = store.profiles.find((p) => p.id === item.id);
            if (existing) {
              if (item.display_name !== undefined) existing.display_name = item.display_name;
              if (item.avatar !== undefined) existing.avatar = item.avatar;
              existing.updated_at = now;
            } else if (item.id) {
              store.profiles.push({
                id: item.id,
                display_name: item.display_name ?? "",
                ...(item.avatar !== undefined ? { avatar: item.avatar } : {}),
                created_at: now,
                updated_at: now,
              });
            }
            saveStore(store);
            return { data: null, error: null };
          }
          const rows = store.profiles
            .filter((p) => matchesFilters(p as unknown as Record<string, unknown>, filters))
            .map((r) => cloneRow(r));
          if (wantSingle === "maybeSingle") return { data: rows[0] ?? null, error: null };
          return { data: rows, error: null };
        }

        if (table === "game_results") {
          if (mode === "insert") {
            const items = (
              Array.isArray(payload) ? payload : [payload]
            ) as Partial<LocalGameResultRow>[];
            for (const item of items) {
              store.game_results.push({
                game_id: item.game_id ?? "",
                user_id: item.user_id ?? "",
                display_name: item.display_name ?? "Player",
                won: Boolean(item.won),
                net_worth: item.net_worth ?? 0,
                finished_at: now,
              });
            }
            saveStore(store);
            return { data: null, error: null };
          }
        }

        return { data: wantSingle ? null : [], error: null };
      };

      const builder = {
        select(_cols?: string) {
          if (mode !== "select") wantSelectAfterWrite = true;
          return builder;
        },
        insert(data: unknown) {
          mode = "insert";
          payload = data;
          return builder;
        },
        update(data: unknown) {
          mode = "update";
          payload = data;
          return builder;
        },
        upsert(data: unknown) {
          mode = "upsert";
          payload = data;
          return builder;
        },
        delete() {
          mode = "delete";
          return builder;
        },
        eq(col: string, val: unknown) {
          filters.push({ type: "eq", col, val });
          return builder;
        },
        in(col: string, vals: unknown[]) {
          filters.push({ type: "in", col, vals });
          return builder;
        },
        order(col: string, opts?: { ascending?: boolean }) {
          orderBy = { col, ascending: opts?.ascending ?? true };
          return builder;
        },
        limit(n: number) {
          limitCount = n;
          return builder;
        },
        single() {
          wantSingle = "single";
          return execute();
        },
        maybeSingle() {
          wantSingle = "maybeSingle";
          return execute();
        },
        then(
          onFulfilled?: (v: {
            data: unknown;
            error: { code?: string; message: string } | null;
          }) => unknown,
          onRejected?: (e: unknown) => unknown,
        ) {
          return execute().then(onFulfilled, onRejected);
        },
      };

      return builder;
    },
  };
}
