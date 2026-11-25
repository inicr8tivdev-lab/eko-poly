import { cleanName } from "./rooms";
import { isSupabaseConfigured, supabase } from "./supabase";

export interface AuthUserLike {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}

export function fallbackPlayerName(
  user: AuthUserLike | null | undefined,
  preferredName?: string,
): string {
  const explicit = preferredName?.trim();
  if (explicit) return cleanName(explicit);
  const metaName =
    typeof user?.user_metadata?.["display_name"] === "string"
      ? user.user_metadata["display_name"].trim()
      : "";
  if (metaName) return cleanName(metaName);
  const emailPrefix = user?.email?.split("@")[0]?.trim() ?? "";
  return cleanName(emailPrefix || "Player");
}

/** Ensures every authenticated user has a saved row in `public.profiles`. */
export async function ensureUserProfile(
  user: AuthUserLike | null | undefined,
  preferredName?: string,
): Promise<string> {
  if (!user?.id) return "Player";
  const resolved = fallbackPlayerName(user, preferredName);
  if (!isSupabaseConfigured()) return resolved;

  try {
    const { data: existing, error: selectErr } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();

    if (selectErr) {
      console.warn("ensureUserProfile select failed", selectErr.message);
      return resolved;
    }

    const existingName = existing?.display_name?.trim() ?? "";
    const explicit = preferredName?.trim() ? cleanName(preferredName) : "";

    if (!existing) {
      const { error: insertErr } = await supabase
        .from("profiles")
        .upsert({ id: user.id, display_name: resolved }, { onConflict: "id" });
      if (insertErr) console.warn("ensureUserProfile insert failed", insertErr.message);
      return resolved;
    }

    if (explicit && explicit !== existingName) {
      const { error: updateErr } = await supabase
        .from("profiles")
        .upsert({ id: user.id, display_name: explicit }, { onConflict: "id" });
      if (updateErr) console.warn("ensureUserProfile update failed", updateErr.message);
      return explicit;
    }

    return existingName || resolved;
  } catch (err) {
    console.warn("ensureUserProfile unexpected error", err);
    return resolved;
  }
}
