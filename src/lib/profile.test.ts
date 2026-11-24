import { describe, expect, it, vi } from "vitest";
import { fallbackPlayerName } from "./profile";

vi.mock("./supabase", () => ({
  isSupabaseConfigured: () => false,
  supabase: {},
}));

describe("fallbackPlayerName", () => {
  it("prefers an explicit entered name", () => {
    expect(fallbackPlayerName({ id: "u1", email: "ada@example.com" }, "  Chief   Ada ")).toBe("Chief Ada");
  });

  it("uses user_metadata.display_name when present", () => {
    expect(
      fallbackPlayerName({
        id: "u1",
        email: "ada@example.com",
        user_metadata: { display_name: "Tunde" },
      }),
    ).toBe("Tunde");
  });

  it("falls back to cleaned email prefix and then Player", () => {
    expect(fallbackPlayerName({ id: "u1", email: "inicr8tivdev@gmail.com" })).toBe("inicr8tivdev");
    expect(fallbackPlayerName({ id: "u1", email: "" })).toBe("Player");
  });
});
