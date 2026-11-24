import { describe, expect, it } from "vitest";
import { supabase as integrationSupabase } from "@/integrations/supabase/client";
import { getSupabaseStorageKey, isSupabaseConfigured, supabase } from "./supabase";

describe("lib/supabase configuration", () => {
  it("shares a single Supabase client instance across @/lib/supabase and @/integrations/supabase/client", () => {
    expect(integrationSupabase.auth).toBe(supabase.auth);
  });

  it("enables persistSession, autoRefreshToken, and detectSessionInUrl when configured", () => {
    if (!isSupabaseConfigured()) return;
    const auth = supabase.auth as unknown as {
      storageKey: string;
      persistSession: boolean;
      autoRefreshToken: boolean;
      detectSessionInUrl: boolean;
    };
    expect(auth.persistSession).toBe(true);
    expect(auth.autoRefreshToken).toBe(true);
    expect(auth.detectSessionInUrl).toBe(true);
    expect(auth.storageKey).toBe(getSupabaseStorageKey());
  });
});
