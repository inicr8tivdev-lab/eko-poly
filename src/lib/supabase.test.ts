import { afterEach, describe, expect, it } from "vitest";
import { supabase as integrationSupabase } from "@/integrations/supabase/client";
import { isSupabaseAdminConfigured } from "@/integrations/supabase/client.server";
import { getPublicSupabaseConfig } from "@/integrations/supabase/publicConfig";
import { getSupabaseStorageKey, isSupabaseConfigured, supabase } from "./supabase";

describe("lib/supabase configuration", () => {
  const prevUrl = process.env["SUPABASE_URL"];
  const prevKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const prevService = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  afterEach(() => {
    if (prevUrl === undefined) delete process.env["SUPABASE_URL"];
    else process.env["SUPABASE_URL"] = prevUrl;
    if (prevKey === undefined) delete process.env["SUPABASE_PUBLISHABLE_KEY"];
    else process.env["SUPABASE_PUBLISHABLE_KEY"] = prevKey;
    if (prevService === undefined) delete process.env["SUPABASE_SERVICE_ROLE_KEY"];
    else process.env["SUPABASE_SERVICE_ROLE_KEY"] = prevService;
  });

  it("shares a single Supabase client instance across @/lib/supabase and @/integrations/supabase/client", () => {
    expect(integrationSupabase.auth).toBe(supabase.auth);
  });

  it("enables persistSession, autoRefreshToken, and detectSessionInUrl for the configured project", () => {
    expect(isSupabaseConfigured()).toBe(true);
    expect(getSupabaseStorageKey()).toBe("sb-tqgmbmumtjscbobhwbxo-auth-token");
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

  it("keeps server Supabase config aligned with the browser project even if server-only SUPABASE_* vars point elsewhere", () => {
    process.env["SUPABASE_URL"] = "https://otherproject.supabase.co";
    process.env["SUPABASE_PUBLISHABLE_KEY"] = "sb_publishable_other";
    const fakeHeader = Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url");
    const fakePayload = Buffer.from(
      JSON.stringify({ ref: "otherproject", role: "service_role" }),
    ).toString("base64url");
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = `${fakeHeader}.${fakePayload}.sig`;

    const cfg = getPublicSupabaseConfig();
    expect(cfg.url).toBe("https://tqgmbmumtjscbobhwbxo.supabase.co");
    expect(cfg.projectId).toBe("tqgmbmumtjscbobhwbxo");
    expect(isSupabaseAdminConfigured()).toBe(false);
  });
});
