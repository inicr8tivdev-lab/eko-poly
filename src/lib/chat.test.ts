import { describe, expect, it } from "vitest";
import {
  MAX_CHAT_HISTORY,
  MAX_CHAT_LENGTH,
  appendChatMessage,
  cleanChatText,
  extractChatMessages,
  mergeChatMessages,
  type ChatMessage,
} from "./chat";

function msg(id: string, text = "Hello", seat = 0): ChatMessage {
  return { id, seat, sender: `Player ${seat + 1}`, text, sentAt: "2026-11-24T07:00:00.000Z" };
}

describe("online chat helpers", () => {
  it("normalizes whitespace and clamps message length", () => {
    expect(cleanChatText("  Oya\n\troll   the dice!  ")).toBe("Oya roll the dice!");
    expect(cleanChatText("   ")).toBe("");
    const over = "a".repeat(MAX_CHAT_LENGTH + 25);
    expect(cleanChatText(over)).toHaveLength(MAX_CHAT_LENGTH);
  });

  it("extracts valid messages from lobby or game state and ignores malformed entries", () => {
    expect(extractChatMessages(null)).toEqual([]);
    expect(
      extractChatMessages({
        chat: [
          msg("m1", "Ready!"),
          { id: "", seat: 0, sender: "X", text: "bad", sentAt: "now" },
          { id: "m2", seat: -1, sender: "X", text: "bad seat", sentAt: "now" },
          msg("m3", "Let's go", 1),
        ],
      }),
    ).toEqual([msg("m1", "Ready!"), msg("m3", "Let's go", 1)]);
  });

  it("appends idempotently and enforces history cap", () => {
    const initial = [msg("m1", "First")];
    expect(appendChatMessage(initial, msg("m1", "Duplicate"))).toBe(initial);

    let list: ChatMessage[] = [];
    for (let i = 0; i < MAX_CHAT_HISTORY + 10; i++) {
      list = appendChatMessage(list, msg(`m-${i}`, `Message ${i}`));
    }
    expect(list).toHaveLength(MAX_CHAT_HISTORY);
    expect(list[0]?.id).toBe("m-10");
  });

  it("merges server and live messages without duplicating ids", () => {
    const server = [msg("m1", "From server"), msg("m2", "Confirmed")];
    const live = [msg("m2", "Confirmed"), msg("m3", "Optimistic", 1)];
    expect(mergeChatMessages(server, live)).toEqual([
      msg("m1", "From server"),
      msg("m2", "Confirmed"),
      msg("m3", "Optimistic", 1),
    ]);
  });
});
