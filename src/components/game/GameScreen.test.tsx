import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createGame, type Action, type GameState } from "@/game/engine";
import { LAGOS_EVENTS } from "@/game/events";
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
    expect(screen.getByRole("button", { name: "Unmute sound effects" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(window.localStorage.getItem("ekopoly-sound-v1")).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "Unmute sound effects" }));
    expect(screen.getByRole("button", { name: "Mute sound effects" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(window.localStorage.getItem("ekopoly-sound-v1")).toBe("true");
  });

  it("toggles background music on and off and persists the preference", () => {
    window.localStorage.clear();
    const game = makeOnlineGame();

    render(<GameScreen game={game} setGame={() => {}} onQuit={() => {}} onNewGame={() => {}} />);

    const toggle = screen.getByRole("button", { name: "Turn music off" });
    expect(toggle).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Turn music on" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(window.localStorage.getItem("ekopoly-music-v1")).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "Turn music on" }));
    expect(screen.getByRole("button", { name: "Turn music off" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(window.localStorage.getItem("ekopoly-music-v1")).toBe("true");
  });

  it("renders online table chat, sends messages and quick banter, and tracks unread count on mobile", () => {
    const onSend = vi.fn();
    const game = makeOnlineGame();
    const initialMessages = [
      {
        id: "m1",
        seat: 1,
        sender: "Tunde",
        text: "Who get Lekki?",
        sentAt: "2026-11-24T07:00:00.000Z",
      },
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
              {
                id: "m2",
                seat: 1,
                sender: "Tunde",
                text: "Pay rent!",
                sentAt: "2026-11-24T07:01:00.000Z",
              },
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

  it("displays Dynamic Lagos Event pop-up modal, banner, and D3 board highlight overlay", async () => {
    const roadworks = LAGOS_EVENTS.find((e) => e.id === "badagry_roadworks")!;
    const game = makeOnlineGame({
      round: 8,
      activeEvent: roadworks,
      eventExpiresAtRound: 8 + roadworks.durationRounds,
    });

    const { rerender } = render(
      <GameScreen game={game} setGame={() => {}} onQuit={() => {}} onNewGame={() => {}} />,
    );

    // Pop-up notification opens automatically for a newly triggered event.
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getAllByText(roadworks.title).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(roadworks.description)).toBeInTheDocument();

    // D3 board overlay highlights all 22 property spaces in red during Road Construction.
    const overlay = screen.getByTestId("board-event-overlay");
    expect(overlay).toHaveAttribute("data-event-id", "badagry_roadworks");
    expect(overlay).toHaveAttribute("data-event-tone", "alert");
    expect(overlay).toHaveAttribute("data-event-tint", "#dc2626");
    expect(overlay).toHaveAttribute("data-affected-count", "22");
    const tintRects = overlay.querySelectorAll("rect.event-cell-tint");
    expect(tintRects.length).toBe(22);
    expect(tintRects[0]).toHaveAttribute("fill", "#dc2626");

    // Closing modal leaves the active event banner visible, and Details re-opens it.
    fireEvent.click(screen.getByRole("button", { name: "Got it, continue game" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    expect(screen.getByText(/Lagos Event · Disruption/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    // Targeted property group event highlights only that group + draws D3 connector links.
    const lekkiFlood = LAGOS_EVENTS.find((e) => e.id === "lekki_flood")!;
    rerender(
      <GameScreen
        game={makeOnlineGame({
          round: 16,
          activeEvent: lekkiFlood,
          eventExpiresAtRound: 16 + lekkiFlood.durationRounds,
        })}
        setGame={() => {}}
        onQuit={() => {}}
        onNewGame={() => {}}
      />,
    );
    expect(overlay).toHaveAttribute("data-affected-count", "3");
    expect(overlay.querySelectorAll("g.event-cell").length).toBe(3);
    expect(overlay.querySelectorAll("path.event-group-link").length).toBe(2);
  });

  it("opens easy-to-pick build and mortgage options when clicking an owned property or house", async () => {
    const base = makeOnlineGame();
    const holdings = {
      ...base.holdings,
      1: { owner: 0, houses: 0, mortgaged: false }, // Makoko (brown)
      3: { owner: 0, houses: 0, mortgaged: false }, // Ajegunle (brown)
      5: { owner: 1, houses: 0, mortgaged: false }, // Oshodi Danfo Park (owned by Tunde)
    };
    const send = vi.fn(async () => {});
    const game = makeOnlineGame({ holdings, phase: "end", current: 0 });

    render(
      <GameScreen
        game={game}
        setGame={() => {}}
        onQuit={() => {}}
        onNewGame={() => {}}
        online={{ seat: 0, code: "ABC234", send }}
      />,
    );

    // Clicking opponent's property does not open quick-manage dialog.
    fireEvent.click(screen.getAllByRole("button", { name: "Oshodi Danfo Park" })[0]!);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Clicking owned property (Makoko) on the board opens quick-manage dialog with Build & Mortgage options.
    fireEvent.click(screen.getAllByRole("button", { name: "Makoko" })[0]!);
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();

    const buildBtn = within(dialog).getByRole("button", { name: /Build House 1/ });
    expect(buildBtn).not.toBeDisabled();
    fireEvent.click(buildBtn);
    await waitFor(() => expect(send).toHaveBeenCalledWith({ type: "build", index: 1 }));

    const mortgageBtn = within(dialog).getByRole("button", { name: /Mortgage Property/ });
    expect(mortgageBtn).not.toBeDisabled();
    fireEvent.click(mortgageBtn);
    await waitFor(() => expect(send).toHaveBeenCalledWith({ type: "mortgage", index: 1 }));

    // Switching to sibling property in the same color group updates dialog target.
    fireEvent.click(within(dialog).getByRole("button", { name: /Ajegunle/ }));
    expect(within(dialog).getByRole("heading", { name: "Ajegunle" })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
