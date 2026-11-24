import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { brokeredPreviewStorage, type PreviewAuthStorage } from "@/integrations/supabase/previewAuthStorage";
import { getPublicSupabaseConfig } from "@/integrations/supabase/publicConfig";

const LOCAL_SESSION_KEY = "ekopoly-local-auth-session";

type LocalSession = {
  access_token: string;
  user: { id: string; email: string };
};

type AuthListener = (event: string, session: LocalSession | null) => void;
const authListeners = new Set<AuthListener>();

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function getSupabaseEnv(): { url: string | undefined; key: string | undefined } {
  const { url, publishableKey } = getPublicSupabaseConfig();
  return { url, key: publishableKey };
}

export function isSupabaseConfigured(): boolean {
  const { url, key } = getSupabaseEnv();
  return Boolean(url && key);
}

export function getSupabaseStorageKey(): string | null {
  const { url } = getSupabaseEnv();
  if (!url) return null;
  try {
    return `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
  } catch {
    return null;
  }
}

function serverSupabaseUrl(publicUrl: string, supabaseKey: string): string | undefined {
  if (typeof window !== "undefined" || typeof process === "undefined") return undefined;
  const serverUrl = process.env["SUPABASE_URL"]?.replace(/\/+$/, "");
  if (!serverUrl || serverUrl === publicUrl || process.env["SUPABASE_PUBLISHABLE_KEY"] !== supabaseKey) return undefined;
  return serverUrl;
}

function createSupabaseFetch(supabaseUrl: string, supabaseKey: string): typeof fetch {
  const publicUrl = supabaseUrl.replace(/\/+$/, "");
  const serverUrl = serverSupabaseUrl(publicUrl, supabaseKey);
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    // New Supabase API keys are opaque strings, not bearer JWTs.
    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    if (serverUrl) {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.startsWith(`${publicUrl}/`)) {
        const target = serverUrl + url.slice(publicUrl.length);
        const request = typeof input === "string" || input instanceof URL ? target : new Request(target, input);
        return fetch(request, { ...init, headers });
      }
    }
    return fetch(input, { ...init, headers });
  };
}

function createSafeBrowserStorage(): PreviewAuthStorage | undefined {
  if (typeof window === "undefined") return undefined;
  const memoryFallback = new Map<string, string>();
  let primary: PreviewAuthStorage | undefined;
  try {
    primary = brokeredPreviewStorage();
  } catch {
    primary = undefined;
  }
  if (!primary) {
    return {
      getItem: (key) => memoryFallback.get(key) ?? null,
      setItem: (key, value) => {
        memoryFallback.set(key, value);
      },
      removeItem: (key) => {
        memoryFallback.delete(key);
      },
    };
  }
  return {
    getItem: async (key) => {
      try {
        return await primary.getItem(key);
      } catch {
        return memoryFallback.get(key) ?? null;
      }
    },
    setItem: async (key, value) => {
      memoryFallback.set(key, value);
      try {
        await primary.setItem(key, value);
      } catch {
        // ignore storage quota/privacy restrictions; memoryFallback keeps current tab working
      }
    },
    removeItem: async (key) => {
      memoryFallback.delete(key);
      try {
        await primary.removeItem(key);
      } catch {
        // ignore storage restrictions
      }
    },
  };
}

function readLocalSession(): LocalSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalSession>;
    if (parsed.access_token && parsed.user?.id && parsed.user?.email) {
      return { access_token: parsed.access_token, user: parsed.user };
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

function writeLocalSession(session: LocalSession | null, event: string) {
  if (typeof window !== "undefined") {
    try {
      if (session) window.localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(session));
      else window.localStorage.removeItem(LOCAL_SESSION_KEY);
    } catch {
      // ignore storage errors
    }
  }
  for (const listener of authListeners) {
    try {
      listener(event, session);
    } catch {
      // ignore listener errors
    }
  }
}

export async function signInAsGuest(name?: string): Promise<{ error?: Error }> {
  try {
    const { localGuestSignIn } = await import("@/lib/local-auth.functions");
    const res = await localGuestSignIn({ data: { name } });
    if (!res.ok) return { error: new Error("Could not sign in as guest.") };
    writeLocalSession(res.session, "SIGNED_IN");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
}

function createLocalSupabaseClient(): ReturnType<typeof createClient<Database>> {
  const makeQuery = () => {
    let singleMode = false;
    const resolveResult = () => Promise.resolve({ data: singleMode ? null : [], error: null });
    const target: Record<string, unknown> = {
      then: (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
        resolveResult().then(onFulfilled, onRejected),
      catch: (onRejected?: (e: unknown) => unknown) => resolveResult().catch(onRejected),
      finally: (onFinally?: () => void) => resolveResult().finally(onFinally),
    };
    const proxy: unknown = new Proxy(target, {
      get(t, prop) {
        if (prop in t) return t[prop as keyof typeof t];
        if (prop === "single" || prop === "maybeSingle") {
          return () => {
            singleMode = true;
            return proxy;
          };
        }
        return () => proxy;
      },
    });
    return proxy;
  };

  const mockChannel = {
    on: () => mockChannel,
    subscribe: () => mockChannel,
    unsubscribe: () => Promise.resolve("ok" as const),
  };

  return {
    auth: {
      getUser: async () => {
        const session = readLocalSession();
        if (!session) return { data: { user: null }, error: null };
        try {
          const { localGetUser } = await import("@/lib/local-auth.functions");
          const user = await localGetUser({ data: { token: session.access_token } });
          if (!user) {
            writeLocalSession(null, "SIGNED_OUT");
            return { data: { user: null }, error: null };
          }
          return { data: { user }, error: null };
        } catch {
          return { data: { user: session.user }, error: null };
        }
      },
      getSession: async () => {
        const session = readLocalSession();
        return { data: { session }, error: null };
      },
      refreshSession: async () => {
        const session = readLocalSession();
        return { data: { session, user: session?.user ?? null }, error: null };
      },
      onAuthStateChange: (cb: AuthListener) => {
        authListeners.add(cb);
        return {
          data: {
            subscription: {
              id: "local",
              callback: cb,
              unsubscribe: () => {
                authListeners.delete(cb);
              },
            },
          },
        };
      },
      signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
        const { localSignIn } = await import("@/lib/local-auth.functions");
        const res = await localSignIn({ data: { email, password } });
        if (!res.ok) {
          return { data: { user: null, session: null }, error: { message: res.error, name: "AuthApiError", status: 400 } };
        }
        writeLocalSession(res.session, "SIGNED_IN");
        return { data: { user: res.session.user, session: res.session }, error: null };
      },
      signUp: async ({ email, password }: { email: string; password: string }) => {
        const { localSignUp } = await import("@/lib/local-auth.functions");
        const res = await localSignUp({ data: { email, password } });
        if (!res.ok) {
          return { data: { user: null, session: null }, error: { message: res.error, name: "AuthApiError", status: 400 } };
        }
        writeLocalSession(res.session, "SIGNED_IN");
        return { data: { user: res.session.user, session: res.session }, error: null };
      },
      signOut: async () => {
        writeLocalSession(null, "SIGNED_OUT");
        return { error: null };
      },
      setSession: async () => {
        const session = readLocalSession();
        return { data: { user: session?.user ?? null, session }, error: null };
      },
    },
    from: () => makeQuery(),
    channel: () => mockChannel,
    removeChannel: async () => "ok" as const,
  } as unknown as ReturnType<typeof createClient<Database>>;
}

function createSupabaseClient() {
  const { url: SUPABASE_URL, key: SUPABASE_PUBLISHABLE_KEY } = getSupabaseEnv();
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return createLocalSupabaseClient();
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY),
    },
    auth: {
      storage: createSafeBrowserStorage(),
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
