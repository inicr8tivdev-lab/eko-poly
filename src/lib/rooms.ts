import { z } from "zod";

/** Room rules shared by the browser and the server. */
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;
export const CODE_LENGTH = 6;
// No 0/O, 1/I/L so codes are easy to read out over the phone.
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CODE_LENGTH);
}

export function isValidCode(code: string): boolean {
  return code.length === CODE_LENGTH && [...code].every((c) => CODE_ALPHABET.includes(c));
}

export function makeCode(randomInts: Uint32Array): string {
  return Array.from(randomInts.slice(0, CODE_LENGTH), (n) => CODE_ALPHABET[n % CODE_ALPHABET.length]).join("");
}

export function cleanName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, 18) || "Player";
}

/** Lowest empty seat, or null when the room is full. */
export function nextFreeSeat(taken: number[]): number | null {
  for (let s = 0; s < MAX_PLAYERS; s++) if (!taken.includes(s)) return s;
  return null;
}

const idx = z.number().int().min(0).max(39);
const terms = z.object({
  to: z.number().int().min(0).max(3),
  give: z.array(idx).max(28),
  get: z.array(idx).max(28),
  giveCash: z.number().int().min(0).max(1_000_000),
  getCash: z.number().int().min(0).max(1_000_000),
});

/** Every move a player can send. Dice are ignored for online games: the server rolls them. */
export const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("roll") }),
  z.object({ type: z.literal("buy") }),
  z.object({ type: z.literal("decline") }),
  z.object({ type: z.literal("auction") }),
  z.object({ type: z.literal("bid"), amount: z.number().int().min(1).max(1_000_000) }),
  z.object({ type: z.literal("auctionPass") }),
  z.object({ type: z.literal("proposeTrade"), terms }),
  z.object({ type: z.literal("acceptTrade") }),
  z.object({ type: z.literal("rejectTrade") }),
  z.object({ type: z.literal("endTurn") }),
  z.object({ type: z.literal("payJail") }),
  z.object({ type: z.literal("useJailCard") }),
  z.object({ type: z.literal("build"), index: idx }),
  z.object({ type: z.literal("sell"), index: idx }),
  z.object({ type: z.literal("mortgage"), index: idx }),
  z.object({ type: z.literal("unmortgage"), index: idx }),
  z.object({ type: z.literal("bankrupt") }),
]);
export type OnlineMove = z.infer<typeof actionSchema>;
