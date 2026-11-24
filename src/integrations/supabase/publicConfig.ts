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

export function getPublicSupabaseConfig(): PublicSupabaseConfig {
  const viteProjectId = import.meta.env["VITE_SUPABASE_PROJECT_ID"]?.trim();
  const viteUrl = import.meta.env["VITE_SUPABASE_URL"]?.trim();
  const viteKey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"]?.trim();

  const procProjectId = typeof process !== "undefined" ? process.env["SUPABASE_PROJECT_ID"]?.trim() : undefined;
  const procUrl = typeof process !== "undefined" ? process.env["SUPABASE_URL"]?.trim() : undefined;
  const procKey = typeof process !== "undefined" ? process.env["SUPABASE_PUBLISHABLE_KEY"]?.trim() : undefined;

  if (viteUrl && viteKey) {
    return {
      projectId: viteProjectId || DEFAULT_SUPABASE_PROJECT_ID,
      url: viteUrl,
      publishableKey: viteKey,
    };
  }

  if (procUrl && procKey) {
    return {
      projectId: procProjectId || DEFAULT_SUPABASE_PROJECT_ID,
      url: procUrl,
      publishableKey: procKey,
    };
  }

  return {
    projectId: viteProjectId || procProjectId || DEFAULT_SUPABASE_PROJECT_ID,
    url: DEFAULT_SUPABASE_URL,
    publishableKey: DEFAULT_SUPABASE_PUBLISHABLE_KEY,
  };
}
