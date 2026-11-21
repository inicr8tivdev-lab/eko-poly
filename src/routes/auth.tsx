import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthButtons } from "@/components/auth/AuthButtons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/ekopoly-logo.png";

const NEXT_KEY = "ekopoly-after-sign-in";

/** Only same-site paths, so a link can't bounce someone to another website after sign-in. */
function safePath(p: unknown): string | undefined {
  return typeof p === "string" && p.startsWith("/") && !p.startsWith("//") ? p : undefined;
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  const finish = () => {
    const stored = safePath(sessionStorage.getItem(NEXT_KEY));
    sessionStorage.removeItem(NEXT_KEY);
    void navigate({ to: redirect ?? stored ?? "/online", replace: true });
  };

  // Remember where to go for sign-ins that leave the page (Google / Lovable), and skip ahead if already signed in.
  useEffect(() => {
    if (redirect) sessionStorage.setItem(NEXT_KEY, redirect);
    let done = false;
    supabase.auth.getUser().then(({ data }) => {
      if (data.user && !done) finish();
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session && !done) {
        done = true;
        finish();
      }
    });
    return () => {
      done = true;
      data.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) toast.error(error.message === "Invalid login credentials" ? "Wrong email or password." : error.message);
      return;
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth` },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data.session) setCheckEmail(true);
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Link to="/" className="mx-auto block w-40">
          <img src={logo} alt="Ekopoly" width={560} height={468} className="h-auto w-full" />
        </Link>
        <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-pop">
          <h1 className="font-display text-xl font-black">{mode === "signin" ? "Sign in to play online" : "Create your account"}</h1>
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
                <AuthButtons onSignedIn={finish} />
              </div>
              <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
              </div>
              <form onSubmit={submit} className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
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
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
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
                  onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
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
