import { describe, expect, it } from "vitest";
import { isAuthFailure, isMissingSchemaError } from "./room-queries";

describe("room query error classification", () => {
  it("identifies auth failures from HTTP status, PostgREST codes, and messages", () => {
    expect(isAuthFailure({ status: 401 })).toBe(true);
    expect(isAuthFailure({ code: "PGRST301" })).toBe(true);
    expect(isAuthFailure({ message: "JWT expired" })).toBe(true);
    expect(isAuthFailure({ message: "Unauthorized: Invalid token" })).toBe(true);
    expect(isAuthFailure({ code: "PGRST205", message: "Could not find the table" })).toBe(false);
    expect(isAuthFailure(null)).toBe(false);
  });

  it("identifies missing table / schema cache errors", () => {
    expect(isMissingSchemaError({ code: "PGRST205", message: "Could not find the table 'public.games' in the schema cache" })).toBe(true);
    expect(isMissingSchemaError({ code: "42P01", message: 'relation "public.games" does not exist' })).toBe(true);
    expect(isMissingSchemaError({ code: "PGRST301" })).toBe(false);
    expect(isMissingSchemaError(undefined)).toBe(false);
  });
});
