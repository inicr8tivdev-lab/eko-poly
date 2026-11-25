export const MAX_CHAT_LENGTH = 280;
export const MAX_CHAT_HISTORY = 80;

export const QUICK_CHAT_PHRASES = ["Oya roll!", "Pay up!", "Wahala!", "Nice deal", "GG!"] as const;

export interface ChatMessage {
  id: string;
  seat: number;
  sender: string;
  text: string;
  sentAt: string;
}

export function cleanChatText(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, MAX_CHAT_LENGTH);
}

function isValidChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const msg = value as Partial<ChatMessage>;
  return (
    typeof msg.id === "string" &&
    msg.id.length > 0 &&
    typeof msg.seat === "number" &&
    Number.isInteger(msg.seat) &&
    msg.seat >= 0 &&
    typeof msg.sender === "string" &&
    typeof msg.text === "string" &&
    msg.text.length > 0 &&
    typeof msg.sentAt === "string"
  );
}

/** Extracts persisted chat messages from either lobby `{ chat }` or full `GameState`. */
export function extractChatMessages(state: unknown): ChatMessage[] {
  if (!state || typeof state !== "object") return [];
  const raw = (state as { chat?: unknown }).chat;
  if (!Array.isArray(raw)) return [];
  return raw.filter(isValidChatMessage).slice(-MAX_CHAT_HISTORY);
}

/** Idempotently appends a chat message by id and trims history to MAX_CHAT_HISTORY. */
export function appendChatMessage(
  list: readonly ChatMessage[],
  message: ChatMessage,
): ChatMessage[] {
  if (list.some((m) => m.id === message.id)) {
    return list as ChatMessage[];
  }
  const next = [...list, message];
  return next.length > MAX_CHAT_HISTORY ? next.slice(-MAX_CHAT_HISTORY) : next;
}

/** Merges server-persisted messages with optimistic/realtime messages without duplicates. */
export function mergeChatMessages(
  serverMessages: readonly ChatMessage[],
  liveMessages: readonly ChatMessage[],
): ChatMessage[] {
  const seen = new Set<string>();
  const merged: ChatMessage[] = [];
  for (const m of serverMessages) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    merged.push(m);
  }
  for (const m of liveMessages) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    merged.push(m);
  }
  return merged.length > MAX_CHAT_HISTORY ? merged.slice(-MAX_CHAT_HISTORY) : merged;
}
