import { BOARD, groupMembers, spaceAt, type ColorGroup } from "./board";

export type MissionDifficulty = "easy" | "medium" | "hard";

export interface PlayerMissionStats {
  rentCollectedCount: number;
  rentCollectedAmount: number;
  rentPayers: number[];
  passedGoCount: number;
  auctionsWon: number;
  tradesCompleted: number;
}

export interface PlayerMissionState {
  missionId: string;
  completed: boolean;
  revealed: boolean;
  completedTurn?: number | undefined;
}

export type MissionCondition =
  | { kind: "distinct_groups"; target: number }
  | { kind: "own_space"; spaceIndex: number }
  | { kind: "rent_collected_count"; target: number }
  | { kind: "rent_collected_amount"; target: number }
  | { kind: "rent_from_all_rivals" }
  | { kind: "same_group_count"; target: number }
  | { kind: "cash_at_least"; target: number }
  | { kind: "transport_and_utility"; transport: number; utility: number }
  | { kind: "complete_sets"; target: number }
  | { kind: "own_count"; target: number }
  | { kind: "own_transports"; target: number }
  | { kind: "own_utilities"; target: number }
  | { kind: "own_region"; region: "mainland" | "island"; target: number }
  | { kind: "mainland_and_island"; mainland: number; island: number }
  | { kind: "passed_go"; target: number }
  | { kind: "auctions_won"; target: number }
  | { kind: "trades_completed"; target: number }
  | { kind: "houses_built"; target: number }
  | { kind: "has_hotel" }
  | { kind: "unmortgaged_assets"; target: number }
  | { kind: "own_group_pair"; groups: [ColorGroup, ColorGroup] }
  | { kind: "own_any_from_group"; group: ColorGroup; target: number };

export interface SecretMission {
  id: string;
  title: string;
  objective: string;
  difficulty: MissionDifficulty;
  rewardCash: number;
  rewardJailCards?: number | undefined;
  rewardLabel: string;
  condition: MissionCondition;
  icon: string;
}

export const MAINLAND_GROUPS = new Set<ColorGroup>(["brown", "lightblue", "pink", "orange", "red"]);

export const ISLAND_GROUPS = new Set<ColorGroup>(["yellow", "green", "darkblue"]);

export const ALL_COLOR_GROUPS: ColorGroup[] = [
  "brown",
  "lightblue",
  "pink",
  "orange",
  "red",
  "yellow",
  "green",
  "darkblue",
];

export const LAGOS_MISSIONS: SecretMission[] = [
  {
    id: "cross_city_landlord",
    title: "Cross-City Landlord",
    objective: "Own properties in 3 different Lagos colour groups.",
    difficulty: "medium",
    rewardCash: 220,
    rewardLabel: "+₦220k cash bonus",
    condition: { kind: "distinct_groups", target: 3 },
    icon: "🗺️",
  },
  {
    id: "banana_island_mogul",
    title: "Banana Island Mogul",
    objective: "Become the owner of Banana Island (Lagos' most expensive property).",
    difficulty: "hard",
    rewardCash: 400,
    rewardLabel: "+₦400k cash bonus",
    condition: { kind: "own_space", spaceIndex: 39 },
    icon: "🏝️",
  },
  {
    id: "eko_toll_collector",
    title: "Eko Toll Collector",
    objective: "Collect rent 5 times from other players.",
    difficulty: "medium",
    rewardCash: 250,
    rewardLabel: "+₦250k cash bonus",
    condition: { kind: "rent_collected_count", target: 5 },
    icon: "🧾",
  },
  {
    id: "same_street_syndicate",
    title: "Same-Street Syndicate",
    objective: "Own 3 properties belonging to the same colour group.",
    difficulty: "medium",
    rewardCash: 220,
    rewardLabel: "+₦220k cash bonus",
    condition: { kind: "same_group_count", target: 3 },
    icon: "🏘️",
  },
  {
    id: "rainy_day_stash",
    title: "Rainy Day Stash",
    objective: "Accumulate at least ₦2.2M in cash on hand.",
    difficulty: "easy",
    rewardCash: 150,
    rewardLabel: "+₦150k cash bonus",
    condition: { kind: "cash_at_least", target: 2200 },
    icon: "💵",
  },
  {
    id: "transit_and_power",
    title: "Transit & Power Link",
    objective: "Own at least 1 Transport station and 1 Utility (NEPA or Generator).",
    difficulty: "easy",
    rewardCash: 150,
    rewardLabel: "+₦150k cash bonus",
    condition: { kind: "transport_and_utility", transport: 1, utility: 1 },
    icon: "🔌",
  },
  {
    id: "street_monopoly",
    title: "District Monopoly",
    objective: "Complete 1 full colour property set.",
    difficulty: "medium",
    rewardCash: 240,
    rewardLabel: "+₦240k cash bonus",
    condition: { kind: "complete_sets", target: 1 },
    icon: "🏛️",
  },
  {
    id: "rent_harvest",
    title: "Rent Harvest",
    objective: "Earn at least ₦500k in total rent from rivals.",
    difficulty: "medium",
    rewardCash: 250,
    rewardLabel: "+₦250k cash bonus",
    condition: { kind: "rent_collected_amount", target: 500 },
    icon: "💰",
  },
  {
    id: "rising_landlord",
    title: "Rising Landlord",
    objective: "Own at least 4 properties, transports, or utilities.",
    difficulty: "easy",
    rewardCash: 140,
    rewardLabel: "+₦140k cash bonus",
    condition: { kind: "own_count", target: 4 },
    icon: "🔑",
  },
  {
    id: "danfo_brt_boss",
    title: "Danfo & BRT Boss",
    objective: "Own at least 2 Transport lines across Lagos.",
    difficulty: "easy",
    rewardCash: 150,
    rewardLabel: "+₦150k cash bonus",
    condition: { kind: "own_transports", target: 2 },
    icon: "🚌",
  },
  {
    id: "uninterrupted_power",
    title: "Uninterrupted Power",
    objective: "Own both NEPA and Generator utilities.",
    difficulty: "medium",
    rewardCash: 220,
    rewardLabel: "+₦220k cash bonus",
    condition: { kind: "own_utilities", target: 2 },
    icon: "⚡",
  },
  {
    id: "mainland_hustler",
    title: "Mainland Hustler",
    objective: "Own at least 3 Mainland properties (Brown through Red).",
    difficulty: "easy",
    rewardCash: 150,
    rewardLabel: "+₦150k cash bonus",
    condition: { kind: "own_region", region: "mainland", target: 3 },
    icon: "🏙️",
  },
  {
    id: "island_vip",
    title: "Island VIP",
    objective: "Own at least 2 Island properties (Lekki, VI, Ikoyi, or Eko Atlantic).",
    difficulty: "easy",
    rewardCash: 160,
    rewardLabel: "+₦160k cash bonus",
    condition: { kind: "own_region", region: "island", target: 2 },
    icon: "🌴",
  },
  {
    id: "third_mainland_commuter",
    title: "Third Mainland Commuter",
    objective: "Pass GO at least 2 times during the match.",
    difficulty: "easy",
    rewardCash: 120,
    rewardLabel: "+₦120k cash bonus",
    condition: { kind: "passed_go", target: 2 },
    icon: "🚦",
  },
  {
    id: "alaba_bargain_hunter",
    title: "Alaba Bargain Hunter",
    objective: "Win at least 1 property through a table auction.",
    difficulty: "easy",
    rewardCash: 140,
    rewardLabel: "+₦140k cash bonus",
    condition: { kind: "auctions_won", target: 1 },
    icon: "🔨",
  },
  {
    id: "marina_deal_maker",
    title: "Marina Deal Maker",
    objective: "Complete at least 1 property trade with another player.",
    difficulty: "medium",
    rewardCash: 180,
    rewardJailCards: 1,
    rewardLabel: "+₦180k cash & 1 Kirikiri Free-Exit card",
    condition: { kind: "trades_completed", target: 1 },
    icon: "🤝",
  },
  {
    id: "early_rent_check",
    title: "Early Rent Check",
    objective: "Earn at least ₦250k in total rent from rivals.",
    difficulty: "easy",
    rewardCash: 140,
    rewardLabel: "+₦140k cash bonus",
    condition: { kind: "rent_collected_amount", target: 250 },
    icon: "🪙",
  },
  {
    id: "heritage_collector",
    title: "Lagos Heritage Collector",
    objective: "Own at least 1 Lagoon Side (Brown) and 1 Yaba & Surulere (Pink) property.",
    difficulty: "easy",
    rewardCash: 150,
    rewardLabel: "+₦150k cash bonus",
    condition: { kind: "own_group_pair", groups: ["brown", "pink"] },
    icon: "📻",
  },
  {
    id: "concrete_and_mortar",
    title: "Concrete & Mortar",
    objective: "Build at least 3 houses across your Lagos properties.",
    difficulty: "medium",
    rewardCash: 240,
    rewardLabel: "+₦240k cash bonus",
    condition: { kind: "houses_built", target: 3 },
    icon: "🧱",
  },
  {
    id: "admiralty_connector",
    title: "Admiralty Connector",
    objective: "Own at least 2 properties in Lekki Axis (Yellow).",
    difficulty: "medium",
    rewardCash: 200,
    rewardLabel: "+₦200k cash bonus",
    condition: { kind: "own_any_from_group", group: "yellow", target: 2 },
    icon: "⛵",
  },
  {
    id: "ikeja_business_mogul",
    title: "Ikeja Business Mogul",
    objective: "Own at least 2 properties in Ikeja Axis (Red).",
    difficulty: "medium",
    rewardCash: 200,
    rewardLabel: "+₦200k cash bonus",
    condition: { kind: "own_any_from_group", group: "red", target: 2 },
    icon: "✈️",
  },
  {
    id: "third_mainland_bridge",
    title: "Bridge Builder",
    objective: "Own at least 2 Mainland and 2 Island properties at the same time.",
    difficulty: "medium",
    rewardCash: 260,
    rewardLabel: "+₦260k cash bonus",
    condition: { kind: "mainland_and_island", mainland: 2, island: 2 },
    icon: "🌉",
  },
  {
    id: "debt_free_magnate",
    title: "Clean Ledger Magnate",
    objective: "Own at least 5 active, unmortgaged assets at once.",
    difficulty: "medium",
    rewardCash: 240,
    rewardLabel: "+₦240k cash bonus",
    condition: { kind: "unmortgaged_assets", target: 5 },
    icon: "📒",
  },
  {
    id: "everybody_pays_rent",
    title: "Everybody Pays Eko",
    objective: "Collect rent at least once from every active opponent.",
    difficulty: "medium",
    rewardCash: 220,
    rewardJailCards: 1,
    rewardLabel: "+₦220k cash & 1 Kirikiri Free-Exit card",
    condition: { kind: "rent_from_all_rivals" },
    icon: "👑",
  },
  {
    id: "liquid_billionaire",
    title: "Liquid Naira Reserve",
    objective: "Accumulate at least ₦3M in cash on hand.",
    difficulty: "hard",
    rewardCash: 320,
    rewardLabel: "+₦320k cash bonus",
    condition: { kind: "cash_at_least", target: 3000 },
    icon: "🏦",
  },
  {
    id: "double_monopoly",
    title: "Double District Monopoly",
    objective: "Complete 2 full colour property sets.",
    difficulty: "hard",
    rewardCash: 400,
    rewardLabel: "+₦400k cash bonus",
    condition: { kind: "complete_sets", target: 2 },
    icon: "🏆",
  },
  {
    id: "skyline_architect",
    title: "Skyline Architect",
    objective: "Upgrade any Lagos property to a full Hotel.",
    difficulty: "hard",
    rewardCash: 380,
    rewardLabel: "+₦380k cash bonus",
    condition: { kind: "has_hotel" },
    icon: "🏨",
  },
  {
    id: "pan_lagos_emperor",
    title: "Pan-Lagos Emperor",
    objective: "Own properties across 5 different Lagos colour groups.",
    difficulty: "hard",
    rewardCash: 380,
    rewardLabel: "+₦380k cash bonus",
    condition: { kind: "distinct_groups", target: 5 },
    icon: "🦅",
  },
  {
    id: "transit_empire",
    title: "Transit Empire",
    objective: "Own all 4 Lagos Transport stations (Danfo, BRT, Rail, and Ferry).",
    difficulty: "hard",
    rewardCash: 420,
    rewardLabel: "+₦420k cash bonus",
    condition: { kind: "own_transports", target: 4 },
    icon: "🚆",
  },
  {
    id: "big_man_rent_baron",
    title: "Big Man Rent Baron",
    objective: "Earn at least ₦900k in total rent from rivals.",
    difficulty: "hard",
    rewardCash: 400,
    rewardLabel: "+₦400k cash bonus",
    condition: { kind: "rent_collected_amount", target: 900 },
    icon: "💎",
  },
];

const MISSION_MAP = new Map(LAGOS_MISSIONS.map((m) => [m.id, m]));

export function missionById(id: string): SecretMission | undefined {
  return MISSION_MAP.get(id);
}

export function emptyMissionStats(): PlayerMissionStats {
  return {
    rentCollectedCount: 0,
    rentCollectedAmount: 0,
    rentPayers: [],
    passedGoCount: 0,
    auctionsWon: 0,
    tradesCompleted: 0,
  };
}

export interface MissionSnapshot {
  players: Array<{ id: number; money: number; bankrupt: boolean }>;
  holdings: Record<number, { owner: number | null; houses: number; mortgaged: boolean }>;
  phase: string;
  missions?: Record<number, PlayerMissionState> | undefined;
  missionStats?: Record<number, PlayerMissionStats> | undefined;
}

export interface MissionProgress {
  current: number;
  target: number;
  done: boolean;
  unit?: string | undefined;
}

export function computeMissionProgress(
  state: MissionSnapshot,
  playerId: number,
  mission: SecretMission,
): MissionProgress {
  const player = state.players.find((p) => p.id === playerId);
  const stats = state.missionStats?.[playerId] ?? emptyMissionStats();
  const ownedIndices = Object.entries(state.holdings)
    .filter(([, h]) => h.owner === playerId)
    .map(([k]) => Number(k));

  const cond = mission.condition;
  switch (cond.kind) {
    case "distinct_groups": {
      const groups = new Set<ColorGroup>();
      for (const i of ownedIndices) {
        const sp = spaceAt(i);
        if (sp.kind === "property") groups.add(sp.group);
      }
      const cur = Math.min(groups.size, cond.target);
      return { current: cur, target: cond.target, done: groups.size >= cond.target };
    }
    case "own_space": {
      const owns = state.holdings[cond.spaceIndex]?.owner === playerId;
      return { current: owns ? 1 : 0, target: 1, done: owns };
    }
    case "rent_collected_count": {
      const cur = Math.min(stats.rentCollectedCount, cond.target);
      return {
        current: cur,
        target: cond.target,
        done: stats.rentCollectedCount >= cond.target,
      };
    }
    case "rent_collected_amount": {
      const cur = Math.min(stats.rentCollectedAmount, cond.target);
      return {
        current: cur,
        target: cond.target,
        done: stats.rentCollectedAmount >= cond.target,
        unit: "naira",
      };
    }
    case "rent_from_all_rivals": {
      const activeRivals = state.players
        .filter((p) => p.id !== playerId && !p.bankrupt)
        .map((p) => p.id);
      if (activeRivals.length === 0) {
        return { current: 0, target: 1, done: false };
      }
      const paidCount = activeRivals.filter((id) => stats.rentPayers.includes(id)).length;
      return {
        current: paidCount,
        target: activeRivals.length,
        done: paidCount >= activeRivals.length,
      };
    }
    case "same_group_count": {
      let best = 0;
      for (const grp of ALL_COLOR_GROUPS) {
        const members = groupMembers(grp);
        const count = members.filter((i) => state.holdings[i]?.owner === playerId).length;
        if (count > best) best = count;
      }
      return {
        current: Math.min(best, cond.target),
        target: cond.target,
        done: best >= cond.target,
      };
    }
    case "cash_at_least": {
      const cash = Math.max(0, player?.money ?? 0);
      return {
        current: Math.min(cash, cond.target),
        target: cond.target,
        done: cash >= cond.target,
        unit: "naira",
      };
    }
    case "transport_and_utility": {
      const transports = ownedIndices.filter((i) => BOARD[i]?.kind === "transport").length;
      const utilities = ownedIndices.filter((i) => BOARD[i]?.kind === "utility").length;
      const score = Math.min(transports, cond.transport) + Math.min(utilities, cond.utility);
      const target = cond.transport + cond.utility;
      return {
        current: score,
        target,
        done: transports >= cond.transport && utilities >= cond.utility,
      };
    }
    case "complete_sets": {
      let sets = 0;
      for (const grp of ALL_COLOR_GROUPS) {
        if (groupMembers(grp).every((i) => state.holdings[i]?.owner === playerId)) {
          sets += 1;
        }
      }
      return {
        current: Math.min(sets, cond.target),
        target: cond.target,
        done: sets >= cond.target,
      };
    }
    case "own_count": {
      const cur = ownedIndices.length;
      return { current: Math.min(cur, cond.target), target: cond.target, done: cur >= cond.target };
    }
    case "own_transports": {
      const cur = ownedIndices.filter((i) => BOARD[i]?.kind === "transport").length;
      return { current: Math.min(cur, cond.target), target: cond.target, done: cur >= cond.target };
    }
    case "own_utilities": {
      const cur = ownedIndices.filter((i) => BOARD[i]?.kind === "utility").length;
      return { current: Math.min(cur, cond.target), target: cond.target, done: cur >= cond.target };
    }
    case "own_region": {
      const set = cond.region === "mainland" ? MAINLAND_GROUPS : ISLAND_GROUPS;
      const cur = ownedIndices.filter((i) => {
        const sp = BOARD[i];
        return sp?.kind === "property" && set.has(sp.group);
      }).length;
      return { current: Math.min(cur, cond.target), target: cond.target, done: cur >= cond.target };
    }
    case "mainland_and_island": {
      const mainland = ownedIndices.filter((i) => {
        const sp = BOARD[i];
        return sp?.kind === "property" && MAINLAND_GROUPS.has(sp.group);
      }).length;
      const island = ownedIndices.filter((i) => {
        const sp = BOARD[i];
        return sp?.kind === "property" && ISLAND_GROUPS.has(sp.group);
      }).length;
      const cur = Math.min(mainland, cond.mainland) + Math.min(island, cond.island);
      const target = cond.mainland + cond.island;
      return {
        current: cur,
        target,
        done: mainland >= cond.mainland && island >= cond.island,
      };
    }
    case "passed_go": {
      const cur = stats.passedGoCount;
      return { current: Math.min(cur, cond.target), target: cond.target, done: cur >= cond.target };
    }
    case "auctions_won": {
      const cur = stats.auctionsWon;
      return { current: Math.min(cur, cond.target), target: cond.target, done: cur >= cond.target };
    }
    case "trades_completed": {
      const cur = stats.tradesCompleted;
      return { current: Math.min(cur, cond.target), target: cond.target, done: cur >= cond.target };
    }
    case "houses_built": {
      const cur = ownedIndices.reduce(
        (sum, i) => sum + (BOARD[i]?.kind === "property" ? (state.holdings[i]?.houses ?? 0) : 0),
        0,
      );
      return { current: Math.min(cur, cond.target), target: cond.target, done: cur >= cond.target };
    }
    case "has_hotel": {
      const hasHotel = ownedIndices.some(
        (i) => BOARD[i]?.kind === "property" && (state.holdings[i]?.houses ?? 0) >= 5,
      );
      return { current: hasHotel ? 1 : 0, target: 1, done: hasHotel };
    }
    case "unmortgaged_assets": {
      const cur = ownedIndices.filter((i) => !state.holdings[i]?.mortgaged).length;
      return { current: Math.min(cur, cond.target), target: cond.target, done: cur >= cond.target };
    }
    case "own_group_pair": {
      const [g1, g2] = cond.groups;
      const has1 = groupMembers(g1).some((i) => state.holdings[i]?.owner === playerId) ? 1 : 0;
      const has2 = groupMembers(g2).some((i) => state.holdings[i]?.owner === playerId) ? 1 : 0;
      return { current: has1 + has2, target: 2, done: has1 + has2 === 2 };
    }
    case "own_any_from_group": {
      const cur = groupMembers(cond.group).filter(
        (i) => state.holdings[i]?.owner === playerId,
      ).length;
      return { current: Math.min(cur, cond.target), target: cond.target, done: cur >= cond.target };
    }
  }
}

/** Strips unrevealed secret missions belonging to other players when delivering online state to a viewer. */
export function redactSecretMissions<T extends MissionSnapshot>(
  state: T,
  viewerSeat: number | undefined,
): T {
  if (!state.missions || state.phase === "gameover") return state;
  let changed = false;
  const redacted: Record<number, PlayerMissionState> = {};
  for (const [k, ms] of Object.entries(state.missions)) {
    const seat = Number(k);
    if (seat === viewerSeat || ms.revealed) {
      redacted[seat] = ms;
    } else {
      changed = true;
      redacted[seat] = {
        missionId: "__hidden__",
        completed: false,
        revealed: false,
      };
    }
  }
  if (!changed) return state;
  return { ...state, missions: redacted };
}
