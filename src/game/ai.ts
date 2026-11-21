import { BOARD, groupMembers, isOwnable, spaceAt, type ColorGroup } from "./board";
import {
  BID_STEP,
  canBuild,
  canTradeProperty,
  netWorth,
  tradeProblem,
  canMortgage,
  canSell,
  canUnmortgage,
  holdingAt,
  playerAt,
  ownedBy,
  rollDice,
  type Action,
  type GameState,
  type TradeTerms,
} from "./engine";

/** Worth of a full colour set on top of its list prices, when judging trades. */
const SET_BONUS = 250;
/** Turns a computer player waits between its own trade offers. */
const PROPOSAL_GAP = 6;

/** Picks the next move for a computer player. */
export function cpuDecide(s: GameState): Action {
  const p = playerAt(s, s.current);
  switch (s.phase) {
    case "roll":
      if (p.inJail && p.jailCards > 0) return { type: "useJailCard" };
      if (p.inJail && p.money > 500) return { type: "payJail" };
      return { type: "roll", dice: rollDice() };

    case "buy": {
      const sp = spaceAt(p.position);
      if (!isOwnable(sp)) return { type: "decline" };
      if (p.money < sp.price) return { type: "auction" };
      const completes =
        sp.kind === "property" &&
        groupMembers(sp.group).every((i) => i === p.position || holdingAt(s, i).owner === p.id);
      return p.money - sp.price >= 120 || completes ? { type: "buy" } : { type: "auction" };
    }

    case "auction": {
      const a = s.auction;
      if (!a) return { type: "auctionPass" };
      const me = playerAt(s, a.turn);
      const sp = spaceAt(a.index);
      if (!isOwnable(sp)) return { type: "auctionPass" };
      const completes =
        sp.kind === "property" &&
        groupMembers(sp.group).every((i) => i === a.index || holdingAt(s, i).owner === me.id);
      const worth = Math.floor(sp.price * (completes ? 1.2 : 0.75));
      const limit = Math.min(worth, me.money - 100);
      const next = a.bid + BID_STEP;
      return next <= limit ? { type: "bid", amount: next } : { type: "auctionPass" };
    }

    case "trade": {
      const t = s.trade;
      if (!t) return { type: "rejectTrade" };
      return tradeValue(s, t.to, t.from, t) > 20 ? { type: "acceptTrade" } : { type: "rejectTrade" };
    }

    case "debt": {
      const mine = ownedBy(s, p.id);
      const sellable = mine.filter((i) => canSell(s, p.id, i));
      if (sellable[0] !== undefined) return { type: "sell", index: sellable[0] };
      const mortgageable = mine
        .filter((i) => canMortgage(s, p.id, i))
        .sort((a, b) => priceOf(a) - priceOf(b));
      if (mortgageable[0] !== undefined) return { type: "mortgage", index: mortgageable[0] };
      return { type: "bankrupt" };
    }

    case "end": {
      const offer = cpuTradeIdea(s);
      if (offer) return { type: "proposeTrade", terms: offer };
      const mine = ownedBy(s, p.id);
      if (p.money > 500) {
        const um = mine.find((i) => canUnmortgage(s, p.id, i));
        if (um !== undefined) return { type: "unmortgage", index: um };
      }
      const buildable = mine
        .filter((i) => canBuild(s, p.id, i))
        .filter((i) => {
          const sp = spaceAt(i);
          return sp.kind === "property" && p.money - sp.houseCost >= 200;
        })
        .sort((a, b) => b - a);
      if (buildable[0] !== undefined) return { type: "build", index: buildable[0] };
      return { type: "endTurn" };
    }

    default:
      return { type: "endTurn" };
  }
}

function priceOf(i: number): number {
  const sp = spaceAt(i);
  return isOwnable(sp) ? sp.price : 0;
}

function allGroups(): ColorGroup[] {
  const groups = new Set<ColorGroup>();
  BOARD.forEach((sp) => sp.kind === "property" && groups.add(sp.group));
  return [...groups];
}

function fullSets(s: GameState, pid: number): number {
  return allGroups().filter((g) => groupMembers(g).every((i) => holdingAt(s, i).owner === pid)).length;
}

/**
 * How much better off `judge` is after the trade (₦k), counting colour sets
 * they complete and sets the other side completes.
 */
export function tradeValue(s: GameState, judge: number, other: number, t: TradeTerms & { from: number }): number {
  const after = structuredClone(s);
  for (const i of t.give) holdingAt(after, i).owner = t.to;
  for (const i of t.get) holdingAt(after, i).owner = t.from;
  playerAt(after, t.from).money += t.getCash - t.giveCash;
  playerAt(after, t.to).money += t.giveCash - t.getCash;
  const mine = netWorth(after, judge) - netWorth(s, judge);
  const mySets = fullSets(after, judge) - fullSets(s, judge);
  const theirSets = fullSets(after, other) - fullSets(s, other);
  return mine + SET_BONUS * (mySets - theirSets);
}

/** A cash offer for the one property that would finish a colour set, if any. */
function cpuTradeIdea(s: GameState): TradeTerms | null {
  const p = playerAt(s, s.current);
  if (p.lastProposal !== undefined && s.turn - p.lastProposal < PROPOSAL_GAP) return null;
  for (const g of allGroups()) {
    const missing = groupMembers(g).filter((i) => holdingAt(s, i).owner !== p.id);
    if (missing.length !== 1) continue;
    const target = missing[0]!;
    const owner = holdingAt(s, target).owner;
    if (owner === null || playerAt(s, owner).bankrupt || !canTradeProperty(s, owner, target)) continue;
    const sp = spaceAt(target);
    if (!isOwnable(sp)) continue;
    const cash = sp.price + SET_BONUS + 50;
    if (p.money - cash < 150) continue;
    const terms: TradeTerms = { to: owner, give: [], get: [target], giveCash: cash, getCash: 0 };
    if (!tradeProblem(s, p.id, terms)) return terms;
  }
  return null;
}
