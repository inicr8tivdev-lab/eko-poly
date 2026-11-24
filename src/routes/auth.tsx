import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthButtons } from "@/components/auth/AuthButtons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ensureUserProfile, fallbackPlayerName } from "@/lib/profile";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import logo from "@/assets/ekopoly-logo.png";

const NEXT_KEY = "ekopoly-after-sign-in";

/** Only same-site paths, so a link can't bounce someone to another website after sign-in. */
function safePath(p: unknown): string | undefined {
  return typeof p === "string" && p.startsWith("/") && !p.startsWith("//") ? p : undefined;
}

function readNextPath(): string | undefined {
  try {
    return safePath(sessionStorage.getItem(NEXT_KEY));
  } catch {
    return undefined;
  }
}

function writeNextPath(value: string | null) {
  try {
    if (value) sessionStorage.setItem(NEXT_KEY, value);
    else sessionStorage.removeItem(NEXT_KEY);
  } catch {
    // ignore storage errors in restricted contexts
  }
}

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string } => {
    const redirect = safePath(s["redirect"]);
    return redirect ? { redirect } : {};
  },
  head: () => ({
    meta: [
      { title: "Sign in — Ekopoly online" },
      { name: "description", content: "Sign in to create a private Ekopoly room or join your friends' game." },
      { property: "og:title", content: "Sign in — Ekopoly online" },
      { property: "og:description", content: "Play Ekopoly, the Lagos property game, with friends on their own phones." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<{ message: string; suggestSignup?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);
  const [hasOAuthButtons, setHasOAuthButtons] = useState(false);
  const navigatedRef = useRef(false);

  const finish = useCallback(() => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    const stored = readNextPath();
    writeNextPath(null);
    void navigate({ to: redirect ?? stored ?? "/online", replace: true });
  }, [navigate, redirect]);

  // Remember where to go for sign-ins that leave the page (Google / Lovable), and skip ahead if already signed in.
  useEffect(() => {
    if (redirect) writeNextPath(redirect);
    let active = true;
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (active && data.user) {
          void ensureUserProfile(data.user).finally(() => {
            if (active) finish();
          });
        }
      })
      .catch(() => {});
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session && active) {
        void ensureUserProfile(session.user).finally(() => {
          if (active) finish();
        });
      }
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [finish, redirect]);

  const switchMode = (nextMode: "signin" | "signup") => {
    setMode(nextMode);
    setAuthError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setAuthError({ message: "Please enter your email address." });
      return;
    }
    setAuthError(null);
    setBusy(true);
    try {
      if (mode === "signin") {
        const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (error) {
          const lower = error.message.toLowerCase();
          if (lower.includes("invalid login credentials")) {
            const msg = "Wrong email or password. If you haven't created an account yet, switch to Create account.";
            setAuthError({ message: msg, suggestSignup: true });
            toast.error("Wrong email or password.");
          } else if (lower.includes("email not confirmed")) {
            const msg = "Please confirm your email link before signing in.";
            setAuthError({ message: msg });
            toast.error(msg);
          } else {
            setAuthError({ message: error.message });
            toast.error(error.message);
          }
          return;
        }
        if (data.user) {
          await ensureUserProfile(data.user);
        }
        if (data.session) finish();
        return;
      }

      const resolvedName = fallbackPlayerName({ id: "pending", email: cleanEmail }, displayName);
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: { display_name: resolvedName },
          emailRedirectTo: `${window.location.origin}/auth`,
        },
      });
      if (error) {
        const lower = error.message.toLowerCase();
        if (lower.includes("already registered") || lower.includes("already exists")) {
          const msg = "An account with this email already exists — try signing in.";
          setAuthError({ message: msg });
          setMode("signin");
          toast.error(msg);
        } else {
          setAuthError({ message: error.message });
          toast.error(error.message);
        }
        return;
      }
      if (data.user && data.session) {
        await ensureUserProfile(data.user, displayName || undefined);
        finish();
        return;
      }
      setCheckEmail(true);
    } catch {
      toast.error("Could not reach the sign-in service. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Link to="/" className="mx-auto block w-40">
          <img src={logo} alt="Ekopoly" width={560} height={468} className="h-auto w-full" />
        </Link>
        <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-pop">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1" role="tablist" aria-label="Authentication mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signin"}
              onClick={() => switchMode("signin")}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-semibold transition",
                mode === "signin" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signup"}
              onClick={() => switchMode("signup")}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-semibold transition",
                mode === "signup" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              Create account
            </button>
          </div>

          <h1 className="mt-5 font-display text-xl font-black">
            {mode === "signin" ? "Sign in to play online" : "Create your account"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Online rooms need an account so your friends know who's who.
          </p>

          {checkEmail ? (
            <div className="mt-6 rounded-xl bg-secondary p-4 text-sm">
              Check <strong>{email}</strong> for a confirmation link. Open it on this device and you'll come straight back here.
            </div>
          ) : (
            <>
              <div className="mt-6">
                <AuthButtons onSignedIn={finish} onAvailabilityChange={setHasOAuthButtons} />
              </div>
              {hasOAuthButtons && (
                <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
                  <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
                </div>
              )}
              <form onSubmit={submit} className={hasOAuthButtons ? "grid gap-3" : "mt-5 grid gap-3"}>
                {mode === "signup" && (
                  <div className="grid gap-1.5">
                    <Label htmlFor="display-name">Player name</Label>
                    <Input
                      id="display-name"
                      type="text"
                      maxLength={18}
                      placeholder="e.g. Ini (optional)"
                      autoComplete="nickname"
                      value={displayName}
                      onChange={(e) => {
                        setDisplayName(e.target.value);
                        setAuthError(null);
                      }}
                    />
                  </div>
                )}
                <div className="grid gap-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setAuthError(null);
                    }}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    minLength={6}
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setAuthError(null);
                    }}
                  />
                </div>
                {authError && (
                  <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-xs text-destructive" role="alert">
                    <p>{authError.message}</p>
                    {authError.suggestSignup && (
                      <button
                        type="button"
                        onClick={() => switchMode("signup")}
                        className="mt-1.5 font-semibold text-primary underline underline-offset-4"
                      >
                        Switch to Create account →
                      </button>
                    )}
                  </div>
                )}
                <Button type="submit" variant="danfo" size="lg" disabled={busy} className="mt-1">
                  {busy && <Loader2 className="animate-spin" />}
                  {mode === "signin" ? "Sign in" : "Create account"}
                </Button>
              </form>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
                <button
                  type="button"
                  className="font-semibold text-primary underline-offset-4 hover:underline"
                  onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
                >
                  {mode === "signin" ? "Create an account" : "Sign in"}
                </button>
              </p>
            </>
          )}
        </div>
        <p className="mt-4 text-center text-sm">
          <Link to="/" className="text-muted-foreground hover:text-foreground">
            ← Play on this device instead
          </Link>
        </p>
      </div>
    </main>
  );
}
