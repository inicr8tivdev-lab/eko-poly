import { useEffect, useState } from "react";
import { LovableMark } from "@lovable.dev/cloud-auth-js/react";
import { UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable";
import { isSupabaseConfigured, signInAsGuest, supabase } from "@/integrations/supabase/client";

function GoogleLogo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" className="size-[18px]!">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
    </svg>
  );
}

function isLovableCloudProject(): boolean {
  const url = import.meta.env["VITE_SUPABASE_URL"];
  if (!url) return false;
  try {
    return new URL(url).hostname.endsWith(".lovable.cloud");
  } catch {
    return false;
  }
}

/** Google/Lovable OAuth when hosted on Lovable Cloud, Supabase Google OAuth if enabled on standalone Supabase, or Guest sign-in locally. */
export function AuthButtons({
  onSignedIn,
  onAvailabilityChange,
}: {
  onSignedIn: () => void;
  onAvailabilityChange?: (hasButtons: boolean) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const configured = isSupabaseConfigured();
  const lovableCloud = isLovableCloudProject();
  const [supabaseGoogleEnabled, setSupabaseGoogleEnabled] = useState(false);

  useEffect(() => {
    if (!configured) {
      onAvailabilityChange?.(true);
      return;
    }
    if (lovableCloud) {
      onAvailabilityChange?.(true);
      return;
    }
    onAvailabilityChange?.(false);
    const url = import.meta.env["VITE_SUPABASE_URL"];
    const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) return;
    let active = true;
    fetch(`${url.replace(/\/+$/, "")}/auth/v1/settings`, { headers: { apikey: key } })
      .then((res) => (res.ok ? (res.json() as Promise<{ external?: { google?: boolean } }>) : null))
      .then((settings) => {
        if (!active) return;
        const enabled = Boolean(settings?.external?.google);
        setSupabaseGoogleEnabled(enabled);
        onAvailabilityChange?.(enabled);
      })
      .catch(() => {
        if (active) onAvailabilityChange?.(false);
      });
    return () => {
      active = false;
    };
  }, [configured, lovableCloud, onAvailabilityChange]);

  if (!configured) {
    const guest = async () => {
      setBusy("guest");
      const res = await signInAsGuest();
      setBusy(null);
      if (res.error) {
        toast.error("Sign-in didn't go through. Please try again.");
        return;
      }
      onSignedIn();
    };
    return (
      <div className="grid gap-2">
        <Button type="button" variant="secondary" disabled={busy !== null} onClick={guest} className="h-10 gap-2.5">
          <UserCheck className="size-[18px]!" />
          Continue as Guest
        </Button>
      </div>
    );
  }

  if (!lovableCloud) {
    if (!supabaseGoogleEnabled) return null;
    const googleOAuth = async () => {
      setBusy("google");
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth` },
      });
      setBusy(null);
      if (error) toast.error("Sign-in didn't go through. Please try again.");
    };
    return (
      <div className="grid gap-2">
        <Button
          type="button"
          disabled={busy !== null}
          onClick={googleOAuth}
          className="h-10 gap-2.5 border border-google-border bg-google px-3 text-sm font-medium text-google-foreground hover:bg-google/90"
        >
          <GoogleLogo />
          Continue with Google
        </Button>
      </div>
    );
  }

  const go = async (provider: "google" | "lovable") => {
    setBusy(provider);
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: `${window.location.origin}/auth` });
    setBusy(null);
    if (result.error) {
      toast.error("Sign-in didn't go through. Please try again.");
      return;
    }
    if (result.redirected) return;
    onSignedIn();
  };

  return (
    <div className="grid gap-2">
      <Button
        type="button"
        disabled={busy !== null}
        onClick={() => go("google")}
        className="h-10 gap-2.5 border border-google-border bg-google px-3 text-sm font-medium text-google-foreground hover:bg-google/90"
      >
        <GoogleLogo />
        Continue with Google
      </Button>
      <Button type="button" variant="outline" disabled={busy !== null} onClick={() => go("lovable")} className="h-10 gap-2.5">
        <LovableMark className="size-[18px]!" />
        Continue with Lovable
      </Button>
    </div>
  );
}
