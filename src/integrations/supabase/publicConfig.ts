// Public (non-secret) Supabase project configuration.
// Matches the client publishable configuration for project `tqgmbmumtjscbobhwbxo`
// so builds without `.env` / Vercel `VITE_*` env vars still connect to Supabase.
const DEFAULT_SUPABASE_PROJECT_ID = "tqgmbmumtjscbobhwbxo";
const DEFAULT_SUPABASE_URL = "https://tqgmbmumtjscbobhwbxo.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_TaW1XWR7lF-HaKCGfCET5w_Roob-Bbf";

export interface PublicSupabaseConfig {
  projectId: string;
  url: string;
  publishableKey: string;
}

function projectIdFromUrl(url: string): string | undefined {
  try {
    const host = new URL(url).hostname;
    const sub = host.split(".")[0];
    return sub || undefined;
  } catch {
    return undefined;
  }
}

export function getPublicSupabaseConfig(): PublicSupabaseConfig {
  const viteEnv =
    typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : undefined;
  const procEnv = typeof process !== "undefined" ? process.env : undefined;

  const viteProjectId =
    viteEnv?.["VITE_SUPABASE_PROJECT_ID"]?.trim() || procEnv?.["VITE_SUPABASE_PROJECT_ID"]?.trim();
  const viteUrl = viteEnv?.["VITE_SUPABASE_URL"]?.trim() || procEnv?.["VITE_SUPABASE_URL"]?.trim();
  const viteKey =
    viteEnv?.["VITE_SUPABASE_PUBLISHABLE_KEY"]?.trim() ||
    procEnv?.["VITE_SUPABASE_PUBLISHABLE_KEY"]?.trim();

  // Only override the default project when VITE_* variables are explicitly configured
  // so the browser client and server functions never talk to different Supabase projects.
  if (viteUrl && viteKey) {
    return {
      projectId: viteProjectId || projectIdFromUrl(viteUrl) || DEFAULT_SUPABASE_PROJECT_ID,
      url: viteUrl.replace(/\/+$/, ""),
      publishableKey: viteKey,
    };
  }

  return {
    projectId: viteProjectId || DEFAULT_SUPABASE_PROJECT_ID,
    url: DEFAULT_SUPABASE_URL,
    publishableKey: DEFAULT_SUPABASE_PUBLISHABLE_KEY,
  };
}
