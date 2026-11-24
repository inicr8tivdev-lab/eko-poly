// Re-export the canonical Supabase client from @/lib/supabase so only a single GoTrueClient instance exists.
export { isSupabaseConfigured, signInAsGuest, supabase } from "@/lib/supabase";
