import {
  BOARD,
  spaceAt,
  GO_SALARY,
  JAIL_FINE,
  JAIL_INDEX,
  START_MONEY,
  groupMembers,
  isOwnable,
  type ColorGroup,
} from "./board";
import { OWAMBE, WAHALA } from "./cards";
import { EVENT_INTERVAL_ROUNDS, LAGOS_EVENTS, type LagosEvent } from "./events";
import type { ChatMessage } from "@/lib/chat";

export const TOKENS = [
  { emoji: "🚌", label: "Danfo" },
  { emoji: "🛺", label: "Keke" },
  { emoji: "🏍️", label: "Okada" },
  { emoji: "⛴️", label: "Ferry" },
] as const;

export function tokenOf(i: number): (typeof TOKENS)[number] {
  return TOKENS[i] ?? TOKENS[0];
}

export interface Player {
  id: number;
  name: string;
  token: number;
  avatar?: string | null | undefined;
  isCpu: boolean;
  money: number;
  position: number;
  inJail: boolean;
  jailTurns: number;
  jailCards: number;
  bankrupt: boolean;
  /** Turn number of this player's last trade proposal (used to pace computer offers). */
  lastProposal?: number;
}

export interface Holding {
  owner: number | null;
  houses: number; // 5 = hotel
  mortgaged: boolean;
}

export type Phase = "roll" | "buy" | "auction" | "trade" | "end" | "debt" | "gameover";

/** What a player puts on the table. `give`/`giveCash` leave the proposer, `get`/`getCash` come from the other player. */
export interface TradeTerms {
  to: number;
  give: number[];
  get: number[];
  giveCash: number;
  getCash: number;
}

export interface TradeOffer extends TradeTerms {
  from: number;
  /** Phase to go back to once the offer is answered. */
  resume: Phase;
}

/** Smallest step a bid can go up by (in ₦k). */
export const BID_STEP = 10;

export interface Auction {
  index: number;
  /** Highest bid so far (₦k); 0 = no bids yet. */
  bid: number;
  bidder: number | null;
  /** Player whose turn it is to bid. */
  turn: number;
  /** Players who have dropped out. */
  out: number[];
}
export type DeckName = "wahala" | "owambe";

export interface LogEntry {
  id: number;
  text: string;
  player: number | null;
}

export interface GameState {
  players: Player[];
  holdings: Record<number, Holding>;
  current: number;
  phase: Phase;
  dice: [number, number] | null;
  doubles: number;
  extraRoll: boolean;
  lastCard: { deck: DeckName; text: string } | null;
  debtTo: number | null;
  auction?: Auction | null;
  trade?: TradeOffer | null;
  log: LogEntry[];
  logSeq: number;
  decks: Record<DeckName, number[]>;
  winner: number | null;
  turn: number;
  round: number;
  /** Game ends after this many rounds (richest wins); null = play until one player is left. */
  maxRounds: number | null;
  chat?: ChatMessage[] | undefined;
  activeEvent?: LagosEvent | null | undefined;
  eventExpiresAtRound?: number | undefined;
  eventHistory?: string[] | undefined;
}

export type Action =
  | { type: "roll"; dice: [number, number] }
  | { type: "buy" }
  | { type: "decline" }
  | { type: "auction" }
  | { type: "bid"; amount: number }
  | { type: "auctionPass" }
  | { type: "proposeTrade"; terms: TradeTerms }
  | { type: "acceptTrade" }
  | { type: "rejectTrade" }
  | { type: "endTurn" }
  | { type: "payJail" }
  | { type: "useJailCard" }
  | { type: "build"; index: number }
  | { type: "sell"; index: number }
  | { type: "mortgage"; index: number }
  | { type: "unmortgage"; index: number }
  | { type: "bankrupt" };

export interface PlayerConfig {
  name: string;
  isCpu: boolean;
  avatar?: string | null | undefined;
}

function shuffle(n: number, rng: () => number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

export function triggerRandomLagosEvent(s: GameState, rng: () => number = Math.random) {
  const history = (s.eventHistory ??= []);
  const available = LAGOS_EVENTS.filter((ev) => !history.slice(-10).includes(ev.id));
  const pool = available.length > 0 ? available : LAGOS_EVENTS;
  const chosen = pool[Math.floor(rng() * pool.length)]!;
  s.activeEvent = chosen;
  s.eventExpiresAtRound = s.round + chosen.durationRounds;
  history.push(chosen.id);

  if (chosen.effectType === "all_players_cash") {
    for (const p of s.players) {
      if (!p.bankrupt) p.money += chosen.value;
    }
    log(
      s,
      `Lagos Event: ${chosen.title} — ${chosen.description} (All active players received ₦${chosen.value}k)`,
      null,
    );
  } else {
    log(s, `Lagos Event: ${chosen.title} — ${chosen.description}`, null);
  }
}

export function createGame(
  configs: PlayerConfig[],
  rng: () => number = Math.random,
  maxRounds: number | null = null,
): GameState {
  const holdings: Record<number, Holding> = {};
  BOARD.forEach((s, i) => {
    if (isOwnable(s)) holdings[i] = { owner: null, houses: 0, mortgaged: false };
  });
  const state: GameState = {
    players: configs.map((c, i) => ({
      id: i,
      name: c.name.trim() || `Player ${i + 1}`,
      token: i,
      ...(c.avatar ? { avatar: c.avatar } : {}),
      isCpu: c.isCpu,
      money: START_MONEY,
      position: 0,
      inJail: false,
      jailTurns: 0,
      jailCards: 0,
      bankrupt: false,
    })),
    holdings,
    current: 0,
    phase: "roll",
    dice: null,
    doubles: 0,
    extraRoll: false,
    lastCard: null,
    debtTo: null,
    auction: null,
    trade: null,
    log: [],
    logSeq: 0,
    decks: { wahala: shuffle(WAHALA.length, rng), owambe: shuffle(OWAMBE.length, rng) },
    winner: null,
    turn: 1,
    round: 1,
    maxRounds,
    activeEvent: null,
    eventExpiresAtRound: 0,
    eventHistory: [],
  };
  log(state, "Welcome to Eko! First to bankrupt everybody wins. Eko o ni baje!", null);
  return state;
}

export function rollDice(rng: () => number = Math.random): [number, number] {
  return [1 + Math.floor(rng() * 6), 1 + Math.floor(rng() * 6)];
}

// ---------- queries ----------

export function holdingAt(s: GameState, i: number): Holding {
  const h = s.holdings[i];
  if (!h) throw new Error(`Space ${i} cannot be owned`);
  return h;
}

export function playerAt(s: GameState, i: number): Player {
  const p = s.players[i];
  if (!p) throw new Error(`No player ${i}`);
  return p;
}

export function ownsGroup(s: GameState, pid: number, group: ColorGroup): boolean {
  return groupMembers(group).every((i) => holdingAt(s, i).owner === pid);
}

function countOwned(s: GameState, pid: number, kind: "transport" | "utility"): number {
  return BOARD.filter((sp, i) => sp.kind === kind && holdingAt(s, i).owner === pid).length;
}

export function propertyPriceFor(s: GameState, index: number): number {
  const sp = spaceAt(index);
  if (!isOwnable(sp)) return 0;
  if (s.activeEvent?.effectType === "property_value_modifier") {
    return Math.max(10, Math.round(sp.price * s.activeEvent.value));
  }
  return sp.price;
}

export function houseCostFor(s: GameState, index: number): number {
  const sp = spaceAt(index);
  if (sp.kind !== "property") return 0;
  if (s.activeEvent?.effectType === "building_cost_modifier") {
    return Math.max(25, sp.houseCost + s.activeEvent.value);
  }
  return sp.houseCost;
}

export function jailFineFor(s: GameState): number {
  if (s.activeEvent?.effectType === "jail_fee_modifier") {
    return Math.max(10, JAIL_FINE + s.activeEvent.value);
  }
  return JAIL_FINE;
}

export function taxAmountFor(s: GameState, baseAmount: number): number {
  if (s.activeEvent?.effectType === "tax_modifier") {
    return Math.max(0, baseAmount + s.activeEvent.value);
  }
  return baseAmount;
}

export function goSalaryFor(s: GameState): number {
  if (s.activeEvent?.effectType === "pass_go_bonus") {
    return Math.max(50, GO_SALARY + s.activeEvent.value);
  }
  return GO_SALARY;
}

export function rentFor(s: GameState, index: number, diceTotal: number): number {
  const sp = spaceAt(index);
  const h = holdingAt(s, index);
  if (!h || h.owner === null || h.mortgaged) return 0;
  let baseRent = 0;
  if (sp.kind === "property") {
    baseRent =
      h.houses > 0
        ? (sp.rent[h.houses] ?? 0)
        : ownsGroup(s, h.owner, sp.group)
          ? sp.rent[0] * 2
          : sp.rent[0];
  } else if (sp.kind === "transport") {
    baseRent = 25 * 2 ** (countOwned(s, h.owner, "transport") - 1);
  } else if (sp.kind === "utility") {
    baseRent = (countOwned(s, h.owner, "utility") === 2 ? 10 : 4) * diceTotal;
  }
  if (baseRent > 0 && s.activeEvent?.effectType === "rent_multiplier") {
    const target = s.activeEvent.targetGroup;
    if (!target || (sp.kind === "property" && sp.group === target) || sp.kind === target) {
      baseRent = Math.max(1, Math.round(baseRent * s.activeEvent.value));
    }
  }
  return baseRent;
}

export function canBuild(s: GameState, pid: number, index: number): boolean {
  const sp = spaceAt(index);
  const h = holdingAt(s, index);
  if (sp.kind !== "property" || !h || h.owner !== pid || h.houses >= 5) return false;
  if (!ownsGroup(s, pid, sp.group)) return false;
  const members = groupMembers(sp.group);
  if (members.some((i) => holdingAt(s, i).mortgaged)) return false;
  const min = Math.min(...members.map((i) => holdingAt(s, i).houses));
  return h.houses <= min && playerAt(s, pid).money >= houseCostFor(s, index);
}

export function canSell(s: GameState, pid: number, index: number): boolean {
  const sp = spaceAt(index);
  const h = holdingAt(s, index);
  if (sp.kind !== "property" || !h || h.owner !== pid || h.houses === 0) return false;
  const max = Math.max(...groupMembers(sp.group).map((i) => holdingAt(s, i).houses));
  return h.houses >= max;
}

export function canMortgage(s: GameState, pid: number, index: number): boolean {
  const sp = spaceAt(index);
  const h = holdingAt(s, index);
  if (!h || h.owner !== pid || h.mortgaged) return false;
  if (sp.kind === "property")
    return groupMembers(sp.group).every((i) => holdingAt(s, i).houses === 0);
  return true;
}

export function unmortgageCost(index: number): number {
  const sp = spaceAt(index);
  return isOwnable(sp) ? Math.ceil((sp.price / 2) * 1.1) : 0;
}

export function canUnmortgage(s: GameState, pid: number, index: number): boolean {
  const h = holdingAt(s, index);
  return !!h && h.owner === pid && h.mortgaged && playerAt(s, pid).money >= unmortgageCost(index);
}

export function netWorth(s: GameState, pid: number): number {
  let total = playerAt(s, pid).money;
  for (const [k, h] of Object.entries(s.holdings)) {
    if (h.owner !== pid) continue;
    const sp = spaceAt(Number(k));
    if (!isOwnable(sp)) continue;
    total += h.mortgaged ? 0 : sp.price;
    if (sp.kind === "property") total += h.houses * sp.houseCost;
  }
  return total;
}

/** Most cash the player could have after selling every house and mortgaging everything. */
export function maxRaisable(s: GameState, pid: number): number {
  let total = playerAt(s, pid).money;
  for (const [k, h] of Object.entries(s.holdings)) {
    if (h.owner !== pid) continue;
    const sp = spaceAt(Number(k));
    if (!isOwnable(sp)) continue;
    if (sp.kind === "property") total += (h.houses * sp.houseCost) / 2;
    if (!h.mortgaged) total += sp.price / 2;
  }
  return total;
}

export function ownedBy(s: GameState, pid: number): number[] {
  return Object.entries(s.holdings)
    .filter(([, h]) => h.owner === pid)
    .map(([k]) => Number(k))
    .sort((a, b) => a - b);
}

// ---------- mutation helpers (operate on a draft) ----------

function log(s: GameState, text: string, player: number | null = s.current) {
  s.logSeq += 1;
  s.log.unshift({ id: s.logSeq, text, player });
  if (s.log.length > 80) s.log.length = 80;
}

function cur(s: GameState): Player {
  return playerAt(s, s.current);
}

function transfer(s: GameState, from: number, to: number | null, amount: number) {
  playerAt(s, from).money -= amount;
  if (to !== null) playerAt(s, to).money += amount;
  if (from === s.current && playerAt(s, from).money < 0) s.debtTo = to;
}

function moveForwardTo(s: GameState, to: number) {
  const p = cur(s);
  if (to < p.position || (to === 0 && p.position !== 0)) {
    const salary = goSalaryFor(s);
    p.money += salary;
    log(s, `${p.name} passed GO and collected ₦${salary}k salary.`);
  }
  p.position = to;
}

function sendToJail(s: GameState, reason: string) {
  const p = cur(s);
  p.position = JAIL_INDEX;
  p.inJail = true;
  p.jailTurns = 0;
  s.extraRoll = false;
  s.doubles = 0;
  s.phase = "end";
  log(s, `${p.name}: ${reason} Off to Kirikiri.`);
}

function drawCard(s: GameState, deck: DeckName, diceTotal: number) {
  const p = cur(s);
  const order = s.decks[deck];
  const idx = order.shift()!;
  order.push(idx);
  const card = (deck === "wahala" ? WAHALA : OWAMBE)[idx];
  if (!card) return;
  s.lastCard = { deck, text: card.text };
  log(s, `${p.name} drew ${deck === "wahala" ? "Wahala" : "Owambe"}: “${card.text}”`);
  const e = card.effect;
  switch (e.type) {
    case "money":
      if (e.amount >= 0) p.money += e.amount;
      else transfer(s, p.id, null, -e.amount);
      return;
    case "advance":
      moveForwardTo(s, e.to);
      landOn(s, diceTotal);
      return;
    case "back":
      p.position = (p.position - e.steps + BOARD.length) % BOARD.length;
      landOn(s, diceTotal);
      return;
    case "nearest": {
      let i = p.position;
      do i = (i + 1) % BOARD.length;
      while (spaceAt(i).kind !== e.kind);
      moveForwardTo(s, i);
      landOn(s, diceTotal);
      return;
    }
    case "jail":
      sendToJail(s, "Card says so.");
      return;
    case "jailFree":
      p.jailCards += 1;
      return;
    case "repairs": {
      let cost = 0;
      for (const i of ownedBy(s, p.id)) {
        const h = holdingAt(s, i);
        cost += h.houses === 5 ? e.hotel : h.houses * e.house;
      }
      if (cost > 0) transfer(s, p.id, null, cost);
      log(s, `${p.name} paid ₦${cost}k for repairs.`);
      return;
    }
    case "eachPlayer": {
      for (const o of s.players) {
        if (o.id === p.id || o.bankrupt) continue;
        if (e.amount > 0) {
          const paid = Math.min(e.amount, Math.max(0, o.money));
          o.money -= paid;
          p.money += paid;
        } else {
          transfer(s, p.id, o.id, -e.amount);
        }
      }
      return;
    }
  }
}

function landOn(s: GameState, diceTotal: number) {
  const p = cur(s);
  const sp = spaceAt(p.position);
  switch (sp.kind) {
    case "property":
    case "transport":
    case "utility": {
      const h = holdingAt(s, p.position);
      if (h.owner === null) {
        s.phase = "buy";
        log(s, `${p.name} landed on ${sp.name} — e dey for sale (₦${sp.price}k).`);
        return;
      }
      if (h.owner === p.id) {
        log(s, `${p.name} landed on their own ${sp.name}. Home sweet home.`);
        return;
      }
      if (h.mortgaged) {
        log(s, `${p.name} landed on ${sp.name}, but it's mortgaged. No rent.`);
        return;
      }
      const rent = rentFor(s, p.position, diceTotal);
      transfer(s, p.id, h.owner, rent);
      log(s, `${p.name} paid ₦${rent}k rent to ${playerAt(s, h.owner).name} for ${sp.name}.`);
      return;
    }
    case "tax": {
      const taxAmount = taxAmountFor(s, sp.amount);
      transfer(s, p.id, null, taxAmount);
      log(s, `${p.name} paid ₦${taxAmount}k ${sp.name}.`);
      return;
    }
    case "card":
      drawCard(s, sp.deck, diceTotal);
      return;
    case "gotojail":
      sendToJail(s, "LASTMA don catch you!");
      return;
    case "parking":
      log(s, `${p.name} is stuck in Go-Slow. Buy gala and relax.`);
      return;
    case "jail":
      log(s, `${p.name} is just visiting Kirikiri.`);
      return;
    case "go":
      return;
  }
}

function afterStep(s: GameState) {
  const p = cur(s);
  if (p.money < 0) {
    s.phase = "debt";
    return;
  }
  if (s.phase === "buy") return;
  s.phase = s.extraRoll && !p.inJail ? "roll" : "end";
}

function nextPlayer(s: GameState) {
  const n = s.players.length;
  const prev = s.current;
  let i = s.current;
  do i = (i + 1) % n;
  while (playerAt(s, i).bankrupt);
  if (i <= prev) {
    s.round += 1;
    if (s.maxRounds !== null && s.round > s.maxRounds) {
      endByNetWorth(s);
      return;
    }
    if (s.activeEvent && s.eventExpiresAtRound !== undefined && s.round >= s.eventExpiresAtRound) {
      log(s, `Lagos Event ended: ${s.activeEvent.title} effects have expired.`, null);
      s.activeEvent = null;
      s.eventExpiresAtRound = 0;
    }
    if (!s.activeEvent && s.round % EVENT_INTERVAL_ROUNDS === 0) {
      triggerRandomLagosEvent(s);
    }
  }
  s.current = i;
  s.phase = "roll";
  s.doubles = 0;
  s.extraRoll = false;
  s.lastCard = null;
  s.debtTo = null;
  s.auction = null;
  s.trade = null;
  s.turn += 1;
}

// ---------- reducer ----------

/** Whoever has to make the next move: a bidder, someone answering a deal, or the current player. */
export function actorOf(g: GameState): number {
  if (g.phase === "auction" && g.auction) return g.auction.turn;
  if (g.phase === "trade" && g.trade) return g.trade.to;
  return g.current;
}

/** Online play: a seat may only send a move when the game is waiting on that seat. */
export function canAct(g: GameState, seat: number): boolean {
  return g.phase !== "gameover" && actorOf(g) === seat;
}

export function reduce(prev: GameState, action: Action): GameState {
  if (prev.phase === "gameover") return prev;
  const s: GameState = structuredClone(prev);
  const p = cur(s);
  const manage = s.phase === "roll" || s.phase === "end" || s.phase === "buy" || s.phase === "debt";

  switch (action.type) {
    case "roll": {
      if (s.phase !== "roll") return prev;
      const [a, b] = action.dice;
      const total = a + b;
      const isDouble = a === b;
      s.dice = [a, b];
      s.lastCard = null;
      log(s, `${p.name} rolled ${a} + ${b} = ${total}${isDouble ? " (doubles!)" : ""}.`);
      if (p.inJail) {
        s.extraRoll = false;
        if (isDouble) {
          p.inJail = false;
          p.jailTurns = 0;
          log(s, `${p.name} rolled doubles and escaped Kirikiri!`);
        } else {
          p.jailTurns += 1;
          if (p.jailTurns < 3) {
            log(s, `${p.name} is still in Kirikiri (${p.jailTurns}/3).`);
            s.phase = "end";
            return s;
          }
          p.inJail = false;
          p.jailTurns = 0;
          const fine = jailFineFor(s);
          transfer(s, p.id, null, fine);
          log(s, `${p.name} paid ₦${fine}k bail after 3 turns.`);
        }
      } else if (isDouble) {
        s.doubles += 1;
        if (s.doubles >= 3) {
          sendToJail(s, "Three doubles in a row? Over-speeding!");
          return s;
        }
        s.extraRoll = true;
      } else {
        s.extraRoll = false;
      }
      moveForwardTo(s, (p.position + total) % BOARD.length);
      landOn(s, total);
      afterStep(s);
      return s;
    }

    case "buy": {
      if (s.phase !== "buy") return prev;
      const sp = spaceAt(p.position);
      const price = propertyPriceFor(s, p.position);
      if (!isOwnable(sp) || p.money < price) return prev;
      p.money -= price;
      holdingAt(s, p.position).owner = p.id;
      log(s, `${p.name} bought ${sp.name} for ₦${price}k. Landlord!`);
      s.phase = s.extraRoll ? "roll" : "end";
      return s;
    }

    case "decline": {
      if (s.phase !== "buy") return prev;
      log(s, `${p.name} passed on ${spaceAt(p.position).name}.`);
      s.phase = s.extraRoll ? "roll" : "end";
      return s;
    }

    case "auction": {
      if (s.phase !== "buy") return prev;
      const sp = spaceAt(p.position);
      if (!isOwnable(sp)) return prev;
      const price = propertyPriceFor(s, p.position);
      s.auction = { index: p.position, bid: 0, bidder: null, turn: p.id, out: [] };
      s.phase = "auction";
      log(
        s,
        p.money < price
          ? `${p.name} no get ₦${price}k for ${sp.name}, so everybody fit bid for am!`
          : `${p.name} put ${sp.name} up for bidding. Who go carry am?`,
      );
      return s;
    }

    case "bid": {
      const a = s.auction;
      if (s.phase !== "auction" || !a) return prev;
      const bidder = playerAt(s, a.turn);
      const amount = Math.floor(action.amount);
      if (amount < a.bid + BID_STEP || amount < BID_STEP || amount > bidder.money) return prev;
      a.bid = amount;
      a.bidder = bidder.id;
      log(s, `${bidder.name} bid ₦${amount}k for ${spaceAt(a.index).name}.`, bidder.id);
      advanceAuction(s);
      return s;
    }

    case "auctionPass": {
      const a = s.auction;
      if (s.phase !== "auction" || !a) return prev;
      const bidder = playerAt(s, a.turn);
      a.out.push(bidder.id);
      log(s, `${bidder.name} dropped out of the bidding.`, bidder.id);
      advanceAuction(s);
      return s;
    }

    case "proposeTrade": {
      const countering = s.phase === "trade" && s.trade;
      if (!countering && s.phase !== "roll" && s.phase !== "end" && s.phase !== "debt") return prev;
      const from = countering ? s.trade!.to : s.current;
      const resume = countering ? s.trade!.resume : s.phase;
      const terms = action.terms;
      if (countering && terms.to !== s.trade!.from) return prev;
      if (tradeProblem(s, from, terms)) return prev;
      s.trade = {
        from,
        resume,
        to: terms.to,
        give: [...terms.give],
        get: [...terms.get],
        giveCash: Math.floor(terms.giveCash),
        getCash: Math.floor(terms.getCash),
      };
      playerAt(s, from).lastProposal = s.turn;
      s.phase = "trade";
      log(
        s,
        `${playerAt(s, from).name} ${countering ? "came back with a counter-offer for" : "offered a deal to"} ${playerAt(s, terms.to).name}: ${describeTrade(s, s.trade)}.`,
        from,
      );
      return s;
    }

    case "acceptTrade": {
      const t = s.trade;
      if (s.phase !== "trade" || !t || tradeProblem(s, t.from, t)) return prev;
      const a = playerAt(s, t.from);
      const b = playerAt(s, t.to);
      for (const i of t.give) holdingAt(s, i).owner = b.id;
      for (const i of t.get) holdingAt(s, i).owner = a.id;
      a.money += t.getCash - t.giveCash;
      b.money += t.giveCash - t.getCash;
      log(s, `${b.name} accepted ${a.name}'s deal. Handshake don happen! 🤝`, b.id);
      s.trade = null;
      s.phase = t.resume;
      settleIfPaid(s);
      return s;
    }

    case "rejectTrade": {
      const t = s.trade;
      if (s.phase !== "trade" || !t) return prev;
      log(s, `${playerAt(s, t.to).name} said no to ${playerAt(s, t.from).name}'s deal.`, t.to);
      s.trade = null;
      s.phase = t.resume;
      return s;
    }

    case "endTurn": {
      if (s.phase !== "end") return prev;
      nextPlayer(s);
      return s;
    }

    case "payJail": {
      const fine = jailFineFor(s);
      if (s.phase !== "roll" || !p.inJail || p.money < fine) return prev;
      p.money -= fine;
      p.inJail = false;
      p.jailTurns = 0;
      log(s, `${p.name} paid ₦${fine}k bail and left Kirikiri.`);
      return s;
    }

    case "useJailCard": {
      if (s.phase !== "roll" || !p.inJail || p.jailCards < 1) return prev;
      p.jailCards -= 1;
      p.inJail = false;
      p.jailTurns = 0;
      log(s, `${p.name} used connections to leave Kirikiri free.`);
      return s;
    }

    case "build": {
      if (!manage || s.phase === "debt" || !canBuild(s, p.id, action.index)) return prev;
      const sp = spaceAt(action.index);
      if (sp.kind !== "property") return prev;
      p.money -= houseCostFor(s, action.index);
      const h = holdingAt(s, action.index);
      h.houses += 1;
      log(s, `${p.name} built ${h.houses === 5 ? "a hotel" : "a house"} on ${sp.name}.`);
      return s;
    }

    case "sell": {
      if (!manage || !canSell(s, p.id, action.index)) return prev;
      const sp = spaceAt(action.index);
      if (sp.kind !== "property") return prev;
      const h = holdingAt(s, action.index);
      h.houses -= 1;
      p.money += sp.houseCost / 2;
      log(s, `${p.name} sold a building on ${sp.name} for ₦${sp.houseCost / 2}k.`);
      settleIfPaid(s);
      return s;
    }

    case "mortgage": {
      if (!manage || !canMortgage(s, p.id, action.index)) return prev;
      const sp = spaceAt(action.index);
      if (!isOwnable(sp)) return prev;
      holdingAt(s, action.index).mortgaged = true;
      p.money += sp.price / 2;
      log(s, `${p.name} mortgaged ${sp.name} for ₦${sp.price / 2}k.`);
      settleIfPaid(s);
      return s;
    }

    case "unmortgage": {
      if (!manage || s.phase === "debt" || !canUnmortgage(s, p.id, action.index)) return prev;
      const cost = unmortgageCost(action.index);
      holdingAt(s, action.index).mortgaged = false;
      p.money -= cost;
      log(s, `${p.name} paid off the mortgage on ${spaceAt(action.index).name} (₦${cost}k).`);
      return s;
    }

    case "bankrupt": {
      if (s.phase !== "debt") return prev;
      const creditor = s.debtTo;
      for (const i of ownedBy(s, p.id)) {
        const sp = spaceAt(i);
        const h = holdingAt(s, i);
        if (sp.kind === "property" && h.houses > 0) {
          p.money += (h.houses * sp.houseCost) / 2;
          h.houses = 0;
        }
        h.owner = null;
        h.mortgaged = false;
      }
      if (creditor !== null) {
        playerAt(s, creditor).money += p.money; // negative balance claws back the unpaid part
        playerAt(s, creditor).jailCards += p.jailCards;
      }
      p.money = 0;
      p.jailCards = 0;
      p.bankrupt = true;
      p.inJail = false;
      log(s, `${p.name} is bankrupt! All properties return to the bank.`);
      const alive = s.players.filter((x) => !x.bankrupt);
      const last = alive[0];
      if (alive.length === 1 && last) {
        s.winner = last.id;
        s.phase = "gameover";
        log(s, `${last.name} is the Big Man of Lagos! 🎉`, last.id);
        return s;
      }
      nextPlayer(s);
      return s;
    }
  }
}

/** Properties a player could put in a trade: no buildings anywhere in the colour set. */
export function canTradeProperty(s: GameState, pid: number, index: number): boolean {
  const h = s.holdings[index];
  if (!h || h.owner !== pid) return false;
  const sp = spaceAt(index);
  if (sp.kind !== "property") return true;
  return groupMembers(sp.group).every((i) => holdingAt(s, i).houses === 0);
}

/** Why a trade can't happen, or null when it's valid. */
export function tradeProblem(s: GameState, from: number, t: TradeTerms): string | null {
  const a = s.players[from];
  const b = s.players[t.to];
  if (!a || !b || a.id === b.id) return "Pick who you want to trade with.";
  if (a.bankrupt || b.bankrupt) return "Bankrupt players can't trade.";
  if (t.give.length + t.get.length === 0 && t.giveCash === 0 && t.getCash === 0)
    return "Put something on the table.";
  if (t.give.length === 0 && t.get.length === 0) return "Add at least one property to the deal.";
  const ints = [t.giveCash, t.getCash].every((x) => Number.isInteger(x) && x >= 0);
  if (!ints) return "Cash must be a whole, positive amount.";
  if (new Set(t.give).size !== t.give.length || new Set(t.get).size !== t.get.length)
    return "Each property can only be listed once.";
  if (!t.give.every((i) => canTradeProperty(s, a.id, i)))
    return "Sell the buildings on a colour set before trading from it.";
  if (!t.get.every((i) => canTradeProperty(s, b.id, i)))
    return `${b.name} has buildings on that colour set — they must sell them first.`;
  if (t.giveCash > Math.max(0, a.money)) return `${a.name} doesn't have that much cash.`;
  if (t.getCash > Math.max(0, b.money)) return `${b.name} doesn't have that much cash.`;
  return null;
}

function describeTrade(s: GameState, t: TradeOffer): string {
  const side = (props: number[], cash: number) =>
    [...props.map((i) => spaceAt(i).name), ...(cash > 0 ? [`₦${cash}k`] : [])].join(" + ") ||
    "nothing";
  return `${side(t.give, t.giveCash)} for ${side(t.get, t.getCash)}`;
}

/** Moves bidding to the next player, or closes the auction when it's decided. */
function advanceAuction(s: GameState) {
  const a = s.auction;
  if (!a) return;
  const sp = spaceAt(a.index);
  const left = s.players.filter((x) => !x.bankrupt && !a.out.includes(x.id)).map((x) => x.id);
  const others = left.filter((id) => id !== a.bidder);
  if (others.length === 0) {
    if (a.bidder !== null) {
      const winner = playerAt(s, a.bidder);
      winner.money -= a.bid;
      holdingAt(s, a.index).owner = winner.id;
      log(s, `${winner.name} won ${sp.name} for ₦${a.bid}k. Sold!`, winner.id);
    } else {
      log(s, `Nobody bid for ${sp.name}. E remain for the bank.`, null);
    }
    s.auction = null;
    s.phase = s.extraRoll && !cur(s).inJail ? "roll" : "end";
    return;
  }
  const n = s.players.length;
  let i = a.turn;
  do i = (i + 1) % n;
  while (!others.includes(i));
  a.turn = i;
}

function endByNetWorth(s: GameState) {
  const alive = s.players.filter((x) => !x.bankrupt);
  const best = alive.reduce((a, b) => (netWorth(s, b.id) > netWorth(s, a.id) ? b : a));
  s.winner = best.id;
  s.phase = "gameover";
  s.round = s.maxRounds ?? s.round;
  log(
    s,
    `Time up! ${best.name} is the richest in Lagos with ₦${netWorth(s, best.id)}k. 🎉`,
    best.id,
  );
}

function settleIfPaid(s: GameState) {
  const p = cur(s);
  if (s.phase === "debt" && p.money >= 0) {
    s.debtTo = null;
    log(s, `${p.name} settled their debt.`);
    s.phase = s.extraRoll && !p.inJail ? "roll" : "end";
  }
}

/** The host stops the game early: the richest player still standing wins. */
export function endGameEarly(g: GameState): GameState {
  if (g.phase === "gameover") return g;
  const s = structuredClone(g);
  const alive = s.players.filter((x) => !x.bankrupt);
  const best = alive.reduce((a, b) => (netWorth(s, b.id) > netWorth(s, a.id) ? b : a));
  s.winner = best.id;
  s.phase = "gameover";
  s.auction = null;
  s.trade = null;
  log(
    s,
    `The host ended the game. ${best.name} is the richest in Lagos with ₦${netWorth(s, best.id)}k. 🎉`,
    best.id,
  );
  return s;
}
