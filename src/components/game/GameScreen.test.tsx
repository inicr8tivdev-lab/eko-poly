import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createGame, type Action, type GameState } from "@/game/engine";
import { GameScreen } from "./GameScreen";

function makeOnlineGame(patch?: Partial<GameState>): GameState {
  const base = createGame([
    { name: "Ada", isCpu: false },
    { name: "Tunde", isCpu: false },
  ]);
  return { ...base, ...patch };
}

describe("GameScreen mobile & online play controls", () => {
  it("pins ActionBar to mobile viewport bottom, shows turn ownership, and guards double-taps while sending", async () => {
    let resolveSend!: () => void;
    const send = vi.fn(
      (_a: Action) =>
        new Promise<void>((resolve) => {
          resolveSend = resolve;
        }),
    );

    const base = makeOnlineGame();
    const game: GameState = {
      ...base,
      phase: "buy",
      players: [{ ...base.players[0]!, position: 1 }, base.players[1]!],
    };

    const { container } = render(
      <GameScreen
        game={game}
        setGame={() => {}}
        onQuit={() => {}}
        onNewGame={() => {}}
        online={{ seat: 0, code: "ABC234", send }}
      />,
    );

    // Header shows mobile turn badge and ActionBar is fixed to viewport bottom under @container/game.
    expect(screen.getAllByText(/Your turn/).length).toBeGreaterThanOrEqual(1);
    const fixedBar = container.querySelector(".fixed.inset-x-2.bottom-2");
    expect(fixedBar).toBeInTheDocument();
    expect(fixedBar?.className).toContain("@min-[620px]/game:hidden");

    const buyButtons = screen.getAllByRole("button", { name: "Buy am" });
    expect(buyButtons.length).toBeGreaterThanOrEqual(1);
    expect(buyButtons[0]!.parentElement?.className).toContain("flex-wrap");

    // Rapid double tap only sends one online move while pending.
    fireEvent.click(buyButtons[0]!);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ type: "buy" });

    for (const btn of screen.getAllByRole("button", { name: "Buy am" })) {
      expect(btn).toBeDisabled();
    }
    for (const btn of screen.getAllByRole("button", { name: "Auction it" })) {
      expect(btn).toBeDisabled();
    }

    fireEvent.click(buyButtons[0]!);
    expect(send).toHaveBeenCalledTimes(1);

    resolveSend();
    await waitFor(() => {
      for (const btn of screen.getAllByRole("button", { name: "Buy am" })) {
        expect(btn).not.toBeDisabled();
      }
    });
  });

  it("lets a non-current player bid on mobile during an online auction", async () => {
    const send = vi.fn(async () => {});
    const game = makeOnlineGame({
      phase: "auction",
      current: 0,
      auction: { index: 1, bid: 0, bidder: null, turn: 1, out: [] },
    });

    render(
      <GameScreen
        game={game}
        setGame={() => {}}
        onQuit={() => {}}
        onNewGame={() => {}}
        online={{ seat: 1, code: "ABC234", send }}
      />,
    );

    expect(screen.getAllByText(/Your turn/).length).toBeGreaterThanOrEqual(1);
    const bidButtons = screen.getAllByRole("button", { name: /Bid ₦10k/ });
    fireEvent.click(bidButtons[0]!);
    expect(send).toHaveBeenCalledWith({ type: "bid", amount: 10 });
    await waitFor(() => expect(bidButtons[0]).not.toBeDisabled());
  });

  it("confirms host End game via AlertDialog instead of window.confirm", () => {
    const onEnd = vi.fn();
    const confirmSpy = vi.spyOn(window, "confirm");
    const game = makeOnlineGame();

    render(
      <GameScreen
        game={game}
        setGame={() => {}}
        onQuit={() => {}}
        onNewGame={() => {}}
        online={{ seat: 0, code: "ABC234", send: async () => {}, onEnd }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "End game" }));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.getByText("End this game for everyone?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "End game" }));
    expect(onEnd).toHaveBeenCalledTimes(1);
    confirmSpy.mockRestore();
  });

  it("toggles sound effects on and off and persists the preference", () => {
    window.localStorage.clear();
    const game = makeOnlineGame();

    render(<GameScreen game={game} setGame={() => {}} onQuit={() => {}} onNewGame={() => {}} />);

    const toggle = screen.getByRole("button", { name: "Mute sound effects" });
    expect(toggle).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Unmute sound effects" })).toHaveAttribute("aria-pressed", "false");
    expect(window.localStorage.getItem("ekopoly-sound-v1")).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "Unmute sound effects" }));
    expect(screen.getByRole("button", { name: "Mute sound effects" })).toHaveAttribute("aria-pressed", "true");
    expect(window.localStorage.getItem("ekopoly-sound-v1")).toBe("true");
  });

  it("toggles background music on and off and persists the preference", () => {
    window.localStorage.clear();
    const game = makeOnlineGame();

    render(<GameScreen game={game} setGame={() => {}} onQuit={() => {}} onNewGame={() => {}} />);

    const toggle = screen.getByRole("button", { name: "Turn music off" });
    expect(toggle).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Turn music on" })).toHaveAttribute("aria-pressed", "false");
    expect(window.localStorage.getItem("ekopoly-music-v1")).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "Turn music on" }));
    expect(screen.getByRole("button", { name: "Turn music off" })).toHaveAttribute("aria-pressed", "true");
    expect(window.localStorage.getItem("ekopoly-music-v1")).toBe("true");
  });

  it("renders online table chat, sends messages and quick banter, and tracks unread count on mobile", () => {
    const onSend = vi.fn();
    const game = makeOnlineGame();
    const initialMessages = [
      { id: "m1", seat: 1, sender: "Tunde", text: "Who get Lekki?", sentAt: "2026-11-24T07:00:00.000Z" },
    ];

    const { rerender } = render(
      <GameScreen
        game={game}
        setGame={() => {}}
        onQuit={() => {}}
        onNewGame={() => {}}
        online={{
          seat: 0,
          code: "ABC234",
          send: async () => {},
          chat: { messages: initialMessages, onSend },
        }}
      />,
    );

    expect(screen.getByText("Who get Lekki?")).toBeInTheDocument();

    const input = screen.getByLabelText("Chat message");
    fireEvent.change(input, { target: { value: "I dey come!" } });
    fireEvent.click(screen.getByRole("button", { name: "Send chat message" }));
    expect(onSend).toHaveBeenCalledWith("I dey come!");

    fireEvent.click(screen.getByRole("button", { name: "Oya roll!" }));
    expect(onSend).toHaveBeenCalledWith("Oya roll!");

    // Incoming remote message increments unread badge on mobile chat trigger while drawer is closed.
    rerender(
      <GameScreen
        game={game}
        setGame={() => {}}
        onQuit={() => {}}
        onNewGame={() => {}}
        online={{
          seat: 0,
          code: "ABC234",
          send: async () => {},
          chat: {
            messages: [
              ...initialMessages,
              { id: "m2", seat: 1, sender: "Tunde", text: "Pay rent!", sentAt: "2026-11-24T07:01:00.000Z" },
            ],
            onSend,
          },
        }}
      />,
    );

    const mobileChatBtn = screen.getByRole("button", { name: "Open table chat (1 unread)" });
    fireEvent.click(mobileChatBtn);
    expect(screen.getByRole("button", { name: "Close chat" })).toBeInTheDocument();
  });
});
