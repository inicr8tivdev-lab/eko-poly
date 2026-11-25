import { BOARD, isOwnable } from "@/game/board";
import { OWAMBE, WAHALA } from "@/game/cards";
import type {
  Auction,
  DeckName,
  GameState,
  Holding,
  LogEntry,
  Phase,
  Player,
  TradeOffer,
} from "@/game/engine";
import { LAGOS_EVENTS, type LagosEvent } from "@/game/events";
import {
  emptyMissionStats,
  missionById,
  type PlayerMissionState,
  type PlayerMissionStats,
} from "@/game/missions";

const VALID_PHASES: ReadonlySet<Phase> = new Set([
  "roll",
  "buy",
  "auction",
  "trade",
  "end",
  "debt",
  "gameover",
]);

const EVENT_BY_ID = new Map(LAGOS_EVENTS.map((ev) => [ev.id, ev]));

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function defaultDeckIndices(length: number): number[] {
  return Array.from({ length }, (_, i) => i);
}

function sanitizeDeck(raw: unknown, length: number): number[] {
  if (!Array.isArray(raw)) return defaultDeckIndices(length);
  const valid = raw.filter(
    (x): x is number => typeof x === "number" && Number.isInteger(x) && x >= 0 && x < length,
  );
  return valid.length > 0 ? valid : defaultDeckIndices(length);
}

function sanitizePlayers(raw: unknown): Player[] | null {
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > 4) return null;
  const players: Player[] = [];
  for (let i = 0; i < raw.length; i++) {
    const p = raw[i];
    if (!isRecord(p)) return null;
    const rawPosition = p["position"];
    const rawPos =
      typeof rawPosition === "number" && Number.isFinite(rawPosition) ? Math.floor(rawPosition) : 0;
    const position = ((rawPos % BOARD.length) + BOARD.length) % BOARD.length;
    const rawMoney = p["money"];
    const money = typeof rawMoney === "number" && Number.isFinite(rawMoney) ? rawMoney : 0;
    const rawName = p["name"];
    const rawToken = p["token"];
    const rawAvatar = p["avatar"];
    const rawJailTurns = p["jailTurns"];
    const rawJailCards = p["jailCards"];
    const rawLastProposal = p["lastProposal"];
    players.push({
      id: i,
      name: typeof rawName === "string" && rawName.trim() ? rawName : `Player ${i + 1}`,
      token:
        typeof rawToken === "number" && Number.isInteger(rawToken) && rawToken >= 0 && rawToken < 4
          ? rawToken
          : i,
      ...(typeof rawAvatar === "string" || rawAvatar === null ? { avatar: rawAvatar } : {}),
      isCpu: Boolean(p["isCpu"]),
      money,
      position,
      inJail: Boolean(p["inJail"]),
      jailTurns:
        typeof rawJailTurns === "number" && Number.isFinite(rawJailTurns) && rawJailTurns >= 0
          ? Math.floor(rawJailTurns)
          : 0,
      jailCards:
        typeof rawJailCards === "number" && Number.isFinite(rawJailCards) && rawJailCards >= 0
          ? Math.floor(rawJailCards)
          : 0,
      bankrupt: Boolean(p["bankrupt"]),
      ...(typeof rawLastProposal === "number" && Number.isFinite(rawLastProposal)
        ? { lastProposal: rawLastProposal }
        : {}),
    });
  }
  return players;
}

function sanitizeHoldings(raw: unknown, playerCount: number): Record<number, Holding> {
  const rawRecord = isRecord(raw) ? raw : {};
  const holdings: Record<number, Holding> = {};
  BOARD.forEach((space, i) => {
    if (!isOwnable(space)) return;
    const item = rawRecord[String(i)];
    if (!isRecord(item)) {
      holdings[i] = { owner: null, houses: 0, mortgaged: false };
      return;
    }
    const rawOwner = item["owner"];
    const owner =
      typeof rawOwner === "number" &&
      Number.isInteger(rawOwner) &&
      rawOwner >= 0 &&
      rawOwner < playerCount
        ? rawOwner
        : null;
    const itemHouses = item["houses"];
    const rawHouses =
      typeof itemHouses === "number" && Number.isFinite(itemHouses) ? Math.floor(itemHouses) : 0;
    const houses = space.kind === "property" ? Math.max(0, Math.min(5, rawHouses)) : 0;
    holdings[i] = {
      owner,
      houses: owner === null ? 0 : houses,
      mortgaged: owner !== null && Boolean(item["mortgaged"]),
    };
  });
  return holdings;
}

function sanitizeEvent(raw: unknown): LagosEvent | null {
  if (!isRecord(raw)) return null;
  const rawId = raw["id"];
  if (typeof rawId === "string") {
    const canonical = EVENT_BY_ID.get(rawId);
    if (canonical) return canonical;
  }
  const rawTitle = raw["title"];
  const rawDesc = raw["description"];
  const rawEffectType = raw["effectType"];
  const rawValue = raw["value"];
  const rawDuration = raw["durationRounds"];
  if (
    typeof rawId === "string" &&
    typeof rawTitle === "string" &&
    typeof rawDesc === "string" &&
    typeof rawEffectType === "string" &&
    typeof rawValue === "number" &&
    Number.isFinite(rawValue) &&
    (rawDuration === 1 || rawDuration === 2)
  ) {
    return raw as unknown as LagosEvent;
  }
  return null;
}

function sanitizeLog(raw: unknown, playerCount: number): LogEntry[] {
  if (!Array.isArray(raw)) return [];
  const entries: LogEntry[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!isRecord(item)) continue;
    const rawText = item["text"];
    if (typeof rawText !== "string") continue;
    const rawId = item["id"];
    const rawPlayer = item["player"];
    const id = typeof rawId === "number" && Number.isFinite(rawId) ? rawId : i + 1;
    const player =
      typeof rawPlayer === "number" &&
      Number.isInteger(rawPlayer) &&
      rawPlayer >= 0 &&
      rawPlayer < playerCount
        ? rawPlayer
        : null;
    entries.push({ id, text: rawText, player });
  }
  return entries;
}

function sanitizeAuction(raw: unknown, playerCount: number): Auction | null {
  if (!isRecord(raw)) return null;
  const rawIndex = raw["index"];
  if (
    typeof rawIndex !== "number" ||
    !Number.isInteger(rawIndex) ||
    rawIndex < 0 ||
    rawIndex >= BOARD.length ||
    !isOwnable(BOARD[rawIndex]!)
  ) {
    return null;
  }
  const rawTurn = raw["turn"];
  const turn =
    typeof rawTurn === "number" &&
    Number.isInteger(rawTurn) &&
    rawTurn >= 0 &&
    rawTurn < playerCount
      ? rawTurn
      : null;
  if (turn === null) return null;
  const rawBidder = raw["bidder"];
  const bidder =
    typeof rawBidder === "number" &&
    Number.isInteger(rawBidder) &&
    rawBidder >= 0 &&
    rawBidder < playerCount
      ? rawBidder
      : null;
  const rawBid = raw["bid"];
  const bid = typeof rawBid === "number" && Number.isFinite(rawBid) && rawBid >= 0 ? rawBid : 0;
  const rawOut = raw["out"];
  const out = Array.isArray(rawOut)
    ? rawOut.filter(
        (x): x is number =>
          typeof x === "number" && Number.isInteger(x) && x >= 0 && x < playerCount,
      )
    : [];
  return { index: rawIndex, bid, bidder, turn, out };
}

function sanitizeTrade(raw: unknown, playerCount: number): TradeOffer | null {
  if (!isRecord(raw)) return null;
  const rawFrom = raw["from"];
  const rawTo = raw["to"];
  const from =
    typeof rawFrom === "number" &&
    Number.isInteger(rawFrom) &&
    rawFrom >= 0 &&
    rawFrom < playerCount
      ? rawFrom
      : null;
  const to =
    typeof rawTo === "number" && Number.isInteger(rawTo) && rawTo >= 0 && rawTo < playerCount
      ? rawTo
      : null;
  if (from === null || to === null || from === to) return null;
  const filterProps = (arr: unknown) =>
    Array.isArray(arr)
      ? arr.filter(
          (i): i is number =>
            typeof i === "number" &&
            Number.isInteger(i) &&
            i >= 0 &&
            i < BOARD.length &&
            isOwnable(BOARD[i]!),
        )
      : [];
  const rawResume = raw["resume"];
  const resume =
    typeof rawResume === "string" && VALID_PHASES.has(rawResume as Phase)
      ? (rawResume as Phase)
      : "end";
  const rawGiveCash = raw["giveCash"];
  const rawGetCash = raw["getCash"];
  return {
    from,
    to,
    give: filterProps(raw["give"]),
    get: filterProps(raw["get"]),
    giveCash:
      typeof rawGiveCash === "number" && Number.isFinite(rawGiveCash) && rawGiveCash >= 0
        ? rawGiveCash
        : 0,
    getCash:
      typeof rawGetCash === "number" && Number.isFinite(rawGetCash) && rawGetCash >= 0
        ? rawGetCash
        : 0,
    resume,
  };
}

function sanitizeMissions(
  rawMissions: unknown,
  rawStats: unknown,
  playerCount: number,
): {
  missions?: Record<number, PlayerMissionState>;
  missionStats?: Record<number, PlayerMissionStats>;
} {
  if (!isRecord(rawMissions)) return {};
  const missions: Record<number, PlayerMissionState> = {};
  for (let i = 0; i < playerCount; i++) {
    const entry = rawMissions[String(i)];
    if (!isRecord(entry)) return {};
    const missionId = entry["missionId"];
    if (typeof missionId !== "string") return {};
    if (missionId !== "__hidden__" && !missionById(missionId)) return {};
    const completedTurn = entry["completedTurn"];
    missions[i] = {
      missionId,
      completed: Boolean(entry["completed"]),
      revealed: Boolean(entry["revealed"]),
      ...(typeof completedTurn === "number" && Number.isFinite(completedTurn)
        ? { completedTurn }
        : {}),
    };
  }

  const statsRecord = isRecord(rawStats) ? rawStats : {};
  const missionStats: Record<number, PlayerMissionStats> = {};
  for (let i = 0; i < playerCount; i++) {
    const s = statsRecord[String(i)];
    const base = emptyMissionStats();
    if (isRecord(s)) {
      const rentCollectedCount = s["rentCollectedCount"];
      const rentCollectedAmount = s["rentCollectedAmount"];
      const rentPayers = s["rentPayers"];
      const passedGoCount = s["passedGoCount"];
      const auctionsWon = s["auctionsWon"];
      const tradesCompleted = s["tradesCompleted"];
      missionStats[i] = {
        rentCollectedCount:
          typeof rentCollectedCount === "number" && Number.isFinite(rentCollectedCount)
            ? rentCollectedCount
            : base.rentCollectedCount,
        rentCollectedAmount:
          typeof rentCollectedAmount === "number" && Number.isFinite(rentCollectedAmount)
            ? rentCollectedAmount
            : base.rentCollectedAmount,
        rentPayers: Array.isArray(rentPayers)
          ? rentPayers.filter((x): x is number => typeof x === "number" && Number.isInteger(x))
          : base.rentPayers,
        passedGoCount:
          typeof passedGoCount === "number" && Number.isFinite(passedGoCount)
            ? passedGoCount
            : base.passedGoCount,
        auctionsWon:
          typeof auctionsWon === "number" && Number.isFinite(auctionsWon)
            ? auctionsWon
            : base.auctionsWon,
        tradesCompleted:
          typeof tradesCompleted === "number" && Number.isFinite(tradesCompleted)
            ? tradesCompleted
            : base.tradesCompleted,
      };
    } else {
      missionStats[i] = base;
    }
  }
  return { missions, missionStats };
}

/**
 * Validates and migrates a parsed JSON value into a safe `GameState`, or returns `null` if
 * the payload is malformed / incompatible so `GameScreen` never crashes on resume.
 */
export function sanitizeGameState(raw: unknown): GameState | null {
  if (!isRecord(raw)) return null;
  const players = sanitizePlayers(raw["players"]);
  if (!players) return null;

  const rawCurrent = raw["current"];
  const current =
    typeof rawCurrent === "number" &&
    Number.isInteger(rawCurrent) &&
    rawCurrent >= 0 &&
    rawCurrent < players.length
      ? rawCurrent
      : null;
  if (current === null) return null;

  const rawPhase = raw["phase"];
  let phase: Phase =
    typeof rawPhase === "string" && VALID_PHASES.has(rawPhase as Phase)
      ? (rawPhase as Phase)
      : "roll";

  const auction = sanitizeAuction(raw["auction"], players.length);
  const trade = sanitizeTrade(raw["trade"], players.length);
  if (phase === "auction" && !auction) phase = "end";
  if (phase === "trade" && !trade) phase = "end";

  const holdings = sanitizeHoldings(raw["holdings"], players.length);
  const decksRaw = raw["decks"];
  const decksRecord = isRecord(decksRaw) ? decksRaw : {};
  const log = sanitizeLog(raw["log"], players.length);
  const rawWinner = raw["winner"];
  const winner =
    typeof rawWinner === "number" &&
    Number.isInteger(rawWinner) &&
    rawWinner >= 0 &&
    rawWinner < players.length
      ? rawWinner
      : null;

  const rawDice = raw["dice"];
  const dice =
    Array.isArray(rawDice) &&
    rawDice.length === 2 &&
    typeof rawDice[0] === "number" &&
    typeof rawDice[1] === "number"
      ? ([rawDice[0], rawDice[1]] as [number, number])
      : null;

  const rawLastCard = raw["lastCard"];
  let lastCard: { deck: DeckName; text: string } | null = null;
  if (isRecord(rawLastCard)) {
    const deck = rawLastCard["deck"];
    const text = rawLastCard["text"];
    if ((deck === "wahala" || deck === "owambe") && typeof text === "string") {
      lastCard = { deck, text };
    }
  }

  const activeEvent = sanitizeEvent(raw["activeEvent"]);
  const { missions, missionStats } = sanitizeMissions(
    raw["missions"],
    raw["missionStats"],
    players.length,
  );

  const rawDoubles = raw["doubles"];
  const rawDebtTo = raw["debtTo"];
  const rawLogSeq = raw["logSeq"];
  const rawTurn = raw["turn"];
  const rawRound = raw["round"];
  const rawMaxRounds = raw["maxRounds"];
  const rawExpires = raw["eventExpiresAtRound"];
  const rawHistory = raw["eventHistory"];

  return {
    players,
    holdings,
    current,
    phase,
    dice,
    doubles:
      typeof rawDoubles === "number" && Number.isFinite(rawDoubles) && rawDoubles >= 0
        ? Math.floor(rawDoubles)
        : 0,
    extraRoll: Boolean(raw["extraRoll"]),
    lastCard,
    debtTo:
      typeof rawDebtTo === "number" &&
      Number.isInteger(rawDebtTo) &&
      rawDebtTo >= 0 &&
      rawDebtTo < players.length
        ? rawDebtTo
        : null,
    auction,
    trade,
    log,
    logSeq: typeof rawLogSeq === "number" && Number.isFinite(rawLogSeq) ? rawLogSeq : log.length,
    decks: {
      wahala: sanitizeDeck(decksRecord["wahala"], WAHALA.length),
      owambe: sanitizeDeck(decksRecord["owambe"], OWAMBE.length),
    },
    winner,
    turn:
      typeof rawTurn === "number" && Number.isFinite(rawTurn) && rawTurn >= 1
        ? Math.floor(rawTurn)
        : 1,
    round:
      typeof rawRound === "number" && Number.isFinite(rawRound) && rawRound >= 1
        ? Math.floor(rawRound)
        : 1,
    maxRounds:
      typeof rawMaxRounds === "number" && Number.isFinite(rawMaxRounds) && rawMaxRounds > 0
        ? Math.floor(rawMaxRounds)
        : null,
    activeEvent,
    ...(typeof rawExpires === "number" && Number.isFinite(rawExpires)
      ? { eventExpiresAtRound: rawExpires }
      : {}),
    ...(Array.isArray(rawHistory)
      ? {
          eventHistory: rawHistory.filter((x): x is string => typeof x === "string"),
        }
      : {}),
    ...(missions ? { missions } : {}),
    ...(missionStats ? { missionStats } : {}),
  };
}

export function safeClearSavedGame(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage access restrictions (private mode / blocked site data)
  }
}

export function safeLoadSavedGame(key: string): GameState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    const sanitized = sanitizeGameState(parsed);
    if (!sanitized) {
      safeClearSavedGame(key);
      return null;
    }
    return sanitized.phase !== "gameover" ? sanitized : null;
  } catch {
    safeClearSavedGame(key);
    return null;
  }
}

export function safeSaveGame(key: string, game: GameState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(game));
  } catch {
    // Ignore storage quota / privacy mode restrictions
  }
}
