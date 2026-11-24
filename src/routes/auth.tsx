import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { MusicToggle } from "@/components/MusicToggle";
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
      { property: "og:url", content: "https://eko-poly.vercel.app/auth" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot" | "recovery">("signin");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<{ message: string; wrongCreds?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState<"confirm" | "reset" | null>(null);
  const [hasOAuthButtons, setHasOAuthButtons] = useState(false);
  const navigatedRef = useRef(false);
  const isRecoveryRef = useRef(false);

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
    if (typeof window !== "undefined" && window.location.hash.includes("type=recovery")) {
      isRecoveryRef.current = true;
      setMode("recovery");
    } else {
      supabase.auth
        .getUser()
        .then(({ data }) => {
          if (active && data.user && !isRecoveryRef.current) {
            void ensureUserProfile(data.user).finally(() => {
              if (active && !isRecoveryRef.current) finish();
            });
          }
        })
        .catch(() => {});
    }
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY") {
        isRecoveryRef.current = true;
        setMode("recovery");
        setAuthError(null);
        setCheckEmail(null);
        return;
      }
      if (event === "SIGNED_IN" && session && !isRecoveryRef.current && !window.location.hash.includes("type=recovery")) {
        void ensureUserProfile(session.user).finally(() => {
          if (active && !isRecoveryRef.current) finish();
        });
      }
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [finish, redirect]);

  const switchMode = (nextMode: "signin" | "signup" | "forgot" | "recovery") => {
    isRecoveryRef.current = nextMode === "recovery";
    setMode(nextMode);
    setAuthError(null);
    setCheckEmail(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setBusy(true);
    try {
      if (mode === "recovery") {
        const { data, error } = await supabase.auth.updateUser({ password });
        if (error) {
          setAuthError({ message: error.message });
          toast.error(error.message);
          return;
        }
        toast.success("Password updated!");
        if (data.user) {
          await ensureUserProfile(data.user);
        }
        finish();
        return;
      }

      const cleanEmail = email.trim();
      if (!cleanEmail) {
        setAuthError({ message: "Please enter your email address." });
        return;
      }

      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (error) {
          setAuthError({ message: error.message });
          toast.error(error.message);
          return;
        }
        setCheckEmail("reset");
        return;
      }

      if (mode === "signin") {
        const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (error) {
          const lower = error.message.toLowerCase();
          if (lower.includes("invalid login credentials")) {
            const msg =
              "Wrong email or password. Check for typos or browser autofill, reset your password, or create an account if you are new.";
            setAuthError({ message: msg, wrongCreds: true });
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
          const msg = "An account with this email already exists — sign in or reset your password.";
          setAuthError({ message: msg, wrongCreds: true });
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
      setCheckEmail("confirm");
    } catch {
      toast.error("Could not reach the sign-in service. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="absolute right-4 top-4">
        <MusicToggle compactOnMobile={false} variant="outline" />
      </div>
      <div className="w-full max-w-sm">
        <Link to="/" className="mx-auto block w-40">
          <img src={logo} alt="Ekopoly" width={560} height={468} className="h-auto w-full" />
        </Link>
        <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-pop">
          {(mode === "signin" || mode === "signup") && (
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
          )}

          <h1 className={cn("font-display text-xl font-black", (mode === "signin" || mode === "signup") && "mt-5")}>
            {mode === "signin"
              ? "Sign in to play online"
              : mode === "signup"
                ? "Create your account"
                : mode === "forgot"
                  ? "Reset your password"
                  : "Set a new password"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "forgot"
              ? "Enter your account email and we'll send you a reset link."
              : mode === "recovery"
                ? "Choose a new password (at least 6 characters) for your account."
                : "Online rooms need an account so your friends know who's who."}
          </p>

          {checkEmail ? (
            <div className="mt-6 space-y-3 rounded-xl bg-secondary p-4 text-sm">
              <p>
                {checkEmail === "reset" ? (
                  <>
                    Check <strong>{email.trim()}</strong> for your password reset link. Open it on this device to set a new password.
                  </>
                ) : (
                  <>
                    Check <strong>{email.trim()}</strong> for a confirmation link. Open it on this device and you'll come straight back here.
                  </>
                )}
              </p>
              <button
                type="button"
                className="font-semibold text-primary underline underline-offset-4"
                onClick={() => switchMode("signin")}
              >
                ← Back to sign in
              </button>
            </div>
          ) : (
            <>
              {(mode === "signin" || mode === "signup") && (
                <>
                  <div className="mt-6">
                    <AuthButtons onSignedIn={finish} onAvailabilityChange={setHasOAuthButtons} />
                  </div>
                  {hasOAuthButtons && (
                    <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
                      <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
                    </div>
                  )}
                </>
              )}
              <form
                onSubmit={submit}
                className={hasOAuthButtons && (mode === "signin" || mode === "signup") ? "grid gap-3" : "mt-5 grid gap-3"}
              >
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
                {mode !== "recovery" && (
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
                )}
                {mode !== "forgot" && (
                  <div className="grid gap-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">{mode === "recovery" ? "New password" : "Password"}</Label>
                      {mode === "signin" && (
                        <button
                          type="button"
                          onClick={() => switchMode("forgot")}
                          className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={6}
                        autoComplete={mode === "signin" ? "current-password" : "new-password"}
                        className="pr-10"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setAuthError(null);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                )}
                {authError && (
                  <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-xs text-destructive" role="alert">
                    <p>{authError.message}</p>
                    {authError.wrongCreds && (
                      <div className="mt-2 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => switchMode("forgot")}
                          className="font-semibold text-primary underline underline-offset-4"
                        >
                          Reset password →
                        </button>
                        <button
                          type="button"
                          onClick={() => switchMode("signup")}
                          className="font-semibold text-primary underline underline-offset-4"
                        >
                          Switch to Create account →
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <Button type="submit" variant="danfo" size="lg" disabled={busy} className="mt-1">
                  {busy && <Loader2 className="animate-spin" />}
                  {mode === "signin"
                    ? "Sign in"
                    : mode === "signup"
                      ? "Create account"
                      : mode === "forgot"
                        ? "Send reset link"
                        : "Update password"}
                </Button>
              </form>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                {mode === "forgot" || mode === "recovery" ? (
                  <button
                    type="button"
                    className="font-semibold text-primary underline-offset-4 hover:underline"
                    onClick={() => switchMode("signin")}
                  >
                    ← Back to sign in
                  </button>
                ) : (
                  <>
                    {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
                    <button
                      type="button"
                      className="font-semibold text-primary underline-offset-4 hover:underline"
                      onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
                    >
                      {mode === "signin" ? "Create an account" : "Sign in"}
                    </button>
                  </>
                )}
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
