import { describe, expect, it } from "vitest";
import { filterOpenLobbies, isAuthFailure, isMissingSchemaError } from "./room-queries";

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

describe("filterOpenLobbies", () => {
  it("keeps open lobbies with 1 to 3 players, excludes full/empty/started rooms, and sorts players by seat", () => {
    const result = filterOpenLobbies([
      {
        id: "open-1",
        code: "ABC234",
        status: "lobby",
        max_rounds: 30,
        host_id: "u1",
        updated_at: "2026-01-01T00:00:00Z",
        game_players: [
          { display_name: "Ada", user_id: "u2", seat: 1 },
          { display_name: "Tunde", user_id: "u1", seat: 0 },
        ],
      },
      {
        id: "full-room",
        code: "FULL99",
        status: "lobby",
        max_rounds: 15,
        host_id: "u1",
        updated_at: "2026-01-01T00:00:00Z",
        game_players: [
          { display_name: "P1", user_id: "1", seat: 0 },
          { display_name: "P2", user_id: "2", seat: 1 },
          { display_name: "P3", user_id: "3", seat: 2 },
          { display_name: "P4", user_id: "4", seat: 3 },
        ],
      },
      {
        id: "empty-room",
        code: "EMPT22",
        status: "lobby",
        max_rounds: null,
        host_id: "u1",
        updated_at: "2026-01-01T00:00:00Z",
        game_players: [],
      },
      {
        id: "started-room",
        code: "PLAY55",
        status: "playing",
        max_rounds: 30,
        host_id: "u1",
        updated_at: "2026-01-01T00:00:00Z",
        game_players: [
          { display_name: "P1", user_id: "1", seat: 0 },
          { display_name: "P2", user_id: "2", seat: 1 },
        ],
      },
      {
        id: "no-code",
        code: null,
        status: "lobby",
        max_rounds: 30,
        host_id: "u1",
        updated_at: "2026-01-01T00:00:00Z",
        game_players: [{ display_name: "P1", user_id: "1", seat: 0 }],
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.code).toBe("ABC234");
    expect(result[0]?.game_players.map((p) => p.display_name)).toEqual(["Tunde", "Ada"]);
  });
});
