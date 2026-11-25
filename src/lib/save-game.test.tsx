import { render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { GameScreen } from "@/components/game/GameScreen";
import { Setup } from "@/components/game/Setup";
import { createGame } from "@/game/engine";
import {
  safeClearSavedGame,
  safeLoadSavedGame,
  safeSaveGame,
  sanitizeGameState,
} from "./save-game";

vi.mock("@tanstack/react-router", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");
  return {
    ...actual,
    Link: ({
      to,
      children,
      ...rest
    }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string; children?: ReactNode }) => (
      <a href={to} {...rest}>
        {children}
      </a>
    ),
  };
});

describe("save-game safety & legacy migration", () => {
  it("never throws when localStorage access is blocked or quota is exceeded", () => {
    const getSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Access denied", "SecurityError");
    });
    const setSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });
    const removeSpy = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("Access denied", "SecurityError");
    });

    try {
      expect(safeLoadSavedGame("ekopoly-save-v2")).toBeNull();
      const game = createGame([
        { name: "Ada", isCpu: false },
        { name: "Tunde", isCpu: true },
      ]);
      expect(() => safeSaveGame("ekopoly-save-v2", game)).not.toThrow();
      expect(() => safeClearSavedGame("ekopoly-save-v2")).not.toThrow();

      expect(() =>
        render(<Setup saved={null} onStart={() => {}} onResume={() => {}} />),
      ).not.toThrow();
      expect(screen.getByRole("button", { name: "Enter Lagos" })).toBeInTheDocument();
    } finally {
      getSpy.mockRestore();
      setSpy.mockRestore();
      removeSpy.mockRestore();
    }
  });

  it("discards malformed or unrecoverable saved payloads without crashing", () => {
    window.localStorage.setItem("ekopoly-save-v2", "{not valid json");
    expect(safeLoadSavedGame("ekopoly-save-v2")).toBeNull();
    expect(window.localStorage.getItem("ekopoly-save-v2")).toBeNull();

    window.localStorage.setItem("ekopoly-save-v2", JSON.stringify({}));
    expect(safeLoadSavedGame("ekopoly-save-v2")).toBeNull();

    window.localStorage.setItem("ekopoly-save-v2", JSON.stringify(null));
    expect(safeLoadSavedGame("ekopoly-save-v2")).toBeNull();

    expect(
      sanitizeGameState({
        players: [{ id: 0, name: "Solo", isCpu: false, money: 1500, position: 0 }],
        current: 0,
      }),
    ).toBeNull();

    expect(
      sanitizeGameState({
        players: [
          { id: 0, name: "Ada", isCpu: false, money: 1500, position: 0 },
          { id: 1, name: "Tunde", isCpu: true, money: 1500, position: 0 },
        ],
        current: 99,
      }),
    ).toBeNull();
  });

  it("migrates partial or legacy saved games cleanly so GameScreen renders safely", () => {
    const legacy = {
      players: [
        {
          id: 0,
          name: "Ada",
          isCpu: false,
          money: 1200,
          position: 43,
          inJail: false,
          bankrupt: false,
        },
        {
          id: 1,
          name: "Tunde",
          isCpu: true,
          money: 1400,
          position: 5,
          inJail: false,
          bankrupt: false,
        },
      ],
      holdings: {
        1: { owner: 0, houses: 2, mortgaged: false },
      },
      current: 0,
      phase: "auction",
      // Missing auction, decks, log, winner, activeEvent, missions
      activeEvent: { id: "removed_legacy_event" },
    };

    const migrated = sanitizeGameState(legacy);
    expect(migrated).not.toBeNull();
    expect(migrated!.players[0]!.position).toBe(3); // 43 % 40
    expect(migrated!.phase).toBe("end"); // Invalid missing auction safely resets to end
    expect(migrated!.winner).toBeNull();
    expect(migrated!.activeEvent).toBeNull();
    expect(migrated!.holdings[3]).toEqual({ owner: null, houses: 0, mortgaged: false });
    expect(migrated!.decks.wahala.length).toBeGreaterThan(0);

    expect(() =>
      render(
        <GameScreen game={migrated!} setGame={() => {}} onQuit={() => {}} onNewGame={() => {}} />,
      ),
    ).not.toThrow();
    expect(screen.getAllByText("Ada").length).toBeGreaterThanOrEqual(1);
  });
});
