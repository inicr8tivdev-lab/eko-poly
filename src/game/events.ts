import { GROUP_LABEL, type ColorGroup, type Space } from "./board";

export type EventCategory =
  "city" | "traffic" | "market" | "power" | "property" | "weather" | "gov";

export type EventEffectType =
  | "rent_multiplier"
  | "tax_modifier"
  | "property_value_modifier"
  | "pass_go_bonus"
  | "jail_fee_modifier"
  | "building_cost_modifier"
  | "all_players_cash";

export type EventTarget = ColorGroup | "transport" | "utility";

export interface LagosEvent {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  durationRounds: 1 | 2;
  effectType: EventEffectType;
  value: number;
  targetGroup?: EventTarget;
  icon: string;
}

export const LAGOS_EVENTS: LagosEvent[] = [
  {
    id: "fuel_scarcity",
    title: "Fuel Scarcity & Black Market",
    description:
      "Long queues at every filling station! Danfo, BRT, Rail, and Ferry fares jump by 50%.",
    category: "traffic",
    durationRounds: 2,
    effectType: "rent_multiplier",
    value: 1.5,
    targetGroup: "transport",
    icon: "⛽",
  },
  {
    id: "lekki_flood",
    title: "Heavy Lekki Flash Floods",
    description:
      "Torrential downpours flood Admiralty Way and Chevron. Lekki Axis property rents are halved.",
    category: "weather",
    durationRounds: 2,
    effectType: "rent_multiplier",
    value: 0.5,
    targetGroup: "yellow",
    icon: "🌊",
  },
  {
    id: "third_mainland_jam",
    title: "Third Mainland Bridge Gridlock",
    description:
      "Standstill traffic across the bridge! Commuters pay an extra ₦50k on all tax and toll spaces.",
    category: "traffic",
    durationRounds: 1,
    effectType: "tax_modifier",
    value: 50,
    icon: "🚗",
  },
  {
    id: "grid_collapse",
    title: "National Grid Power Outage",
    description:
      "No light anywhere in Eko! NEPA and Generator utility charges double across the city.",
    category: "power",
    durationRounds: 2,
    effectType: "rent_multiplier",
    value: 2.0,
    targetGroup: "utility",
    icon: "⚡",
  },
  {
    id: "owambe_weekend",
    title: "Grand Owambe Weekend",
    description:
      "Asoebi and jollof everywhere! Earn an extra ₦100k cash spray every time you pass GO.",
    category: "city",
    durationRounds: 2,
    effectType: "pass_go_bonus",
    value: 100,
    icon: "🎉",
  },
  {
    id: "alaba_boom",
    title: "Alaba Market Electronics Boom",
    description:
      "Traders storm the mainland markets! Mushin, Agege, and Oshodi rents surge by 50%.",
    category: "market",
    durationRounds: 2,
    effectType: "rent_multiplier",
    value: 1.5,
    targetGroup: "lightblue",
    icon: "📦",
  },
  {
    id: "apapa_congestion",
    title: "Apapa Port Container Congestion",
    description: "Trailers block every terminal route! Transport line fares double city-wide.",
    category: "traffic",
    durationRounds: 2,
    effectType: "rent_multiplier",
    value: 2.0,
    targetGroup: "transport",
    icon: "🚢",
  },
  {
    id: "governors_audit",
    title: "LIRS Surprise Tax Audit",
    description:
      "Tax officials inspect every ledger in town. Landing on any tax space costs +₦100k extra.",
    category: "gov",
    durationRounds: 1,
    effectType: "tax_modifier",
    value: 100,
    icon: "📋",
  },
  {
    id: "banana_boom",
    title: "Banana Island Luxury Boom",
    description:
      "Diaspora buyers flood the luxury market! Eko Atlantic and Banana Island rents increase 50%.",
    category: "property",
    durationRounds: 2,
    effectType: "rent_multiplier",
    value: 1.5,
    targetGroup: "darkblue",
    icon: "🏝️",
  },
  {
    id: "eko_atlantic_sale",
    title: "Lagos Housing Construction Rebate",
    description:
      "Subsidised cement and steel lower house & hotel construction costs by ₦25k city-wide.",
    category: "property",
    durationRounds: 2,
    effectType: "building_cost_modifier",
    value: -25,
    icon: "🏗️",
  },
  {
    id: "yaba_tech_surge",
    title: "Yabacon Valley Tech Week",
    description: "Founders and investors pack Yaba, Surulere, and Ebute Metta. Rents jump by 50%.",
    category: "market",
    durationRounds: 2,
    effectType: "rent_multiplier",
    value: 1.5,
    targetGroup: "pink",
    icon: "💻",
  },
  {
    id: "ikeja_gra_gala",
    title: "Ikeja GRA Diplomatic Gala",
    description: "VIP delegations fill Allen Avenue, Maryland, and Ikeja GRA. Rents rise by 50%.",
    category: "city",
    durationRounds: 2,
    effectType: "rent_multiplier",
    value: 1.5,
    targetGroup: "red",
    icon: "🥂",
  },
  {
    id: "oshodi_market_modernization",
    title: "Oshodi Market Commerce Boom",
    description:
      "Upgraded bus interchange and stalls boost earnings: collect +₦50k extra when passing GO.",
    category: "market",
    durationRounds: 1,
    effectType: "pass_go_bonus",
    value: 50,
    icon: "🛒",
  },
  {
    id: "vi_corporate_holiday",
    title: "Island Corporate Tax Relief",
    description:
      "Commercial incentives ease costs on Victoria Island, Ikoyi, and Parkview. Rents drop 25%.",
    category: "gov",
    durationRounds: 2,
    effectType: "rent_multiplier",
    value: 0.75,
    targetGroup: "green",
    icon: "🏢",
  },
  {
    id: "festac_carnival",
    title: "Festac Town Cultural Carnival",
    description:
      "Street parades bring huge crowds to Festac, Gbagada, and Magodo. Rents climb by 50%.",
    category: "city",
    durationRounds: 2,
    effectType: "rent_multiplier",
    value: 1.5,
    targetGroup: "orange",
    icon: "🎭",
  },
  {
    id: "cms_ferry_subsidy",
    title: "State Transit Fare Subsidy",
    description:
      "Lagos subsidises Danfo, BRT, Rail, and Ferry rides. All transport station rents are halved.",
    category: "traffic",
    durationRounds: 1,
    effectType: "rent_multiplier",
    value: 0.5,
    targetGroup: "transport",
    icon: "⛴️",
  },
  {
    id: "badagry_roadworks",
    title: "Expressway Road Construction",
    description:
      "Major highway resurfacing disrupts haulage trucks. Building costs increase by +₦50k city-wide.",
    category: "traffic",
    durationRounds: 2,
    effectType: "building_cost_modifier",
    value: 50,
    icon: "🚧",
  },
  {
    id: "magodo_estate_levy",
    title: "Statewide Security & Estate Levy",
    description: "Upgraded street patrols and lighting add +₦40k to every tax space across Lagos.",
    category: "property",
    durationRounds: 1,
    effectType: "tax_modifier",
    value: 40,
    icon: "🛡️",
  },
  {
    id: "surulere_nightlife",
    title: "National Stadium Concert Night",
    description:
      "Sold-out Afrobeats concert packs Yaba & Surulere! Pink district rents surge by 50%.",
    category: "city",
    durationRounds: 1,
    effectType: "rent_multiplier",
    value: 1.5,
    targetGroup: "pink",
    icon: "🎤",
  },
  {
    id: "epe_fish_festival",
    title: "Epe Lagoon Trade Festival",
    description: "Booming coastal trade adds an extra +₦75k payout whenever any player passes GO.",
    category: "market",
    durationRounds: 2,
    effectType: "pass_go_bonus",
    value: 75,
    icon: "🐟",
  },
  {
    id: "marina_dividend",
    title: "Marina Financial District Stimulus",
    description:
      "A surprise economic dividend! Every active player receives an immediate ₦100k payout.",
    category: "gov",
    durationRounds: 1,
    effectType: "all_players_cash",
    value: 100,
    icon: "💰",
  },
  {
    id: "agege_bread_fever",
    title: "Makoko & Ajegunle Waterfront Revival",
    description: "Tourists flock to Lagoon Side landmarks! Brown property rents rise by 50%.",
    category: "market",
    durationRounds: 2,
    effectType: "rent_multiplier",
    value: 1.5,
    targetGroup: "brown",
    icon: "🍞",
  },
  {
    id: "lastma_crackdown",
    title: "LASTMA One-Way Enforcement Blitz",
    description:
      "Strict traffic enforcement city-wide! Kirikiri Prison bail rises by +₦30k (to ₦80k).",
    category: "gov",
    durationRounds: 1,
    effectType: "jail_fee_modifier",
    value: 30,
    icon: "🚨",
  },
  {
    id: "bar_beach_renewal",
    title: "VI & Ikoyi Coastal Promenade",
    description:
      "Waterfront redevelopment boosts The Island demand! Green property rents rise by 40%.",
    category: "property",
    durationRounds: 2,
    effectType: "rent_multiplier",
    value: 1.4,
    targetGroup: "green",
    icon: "🌴",
  },
  {
    id: "ikoyi_golf_tournament",
    title: "Ikoyi Club Golf Classic",
    description: "High society gathers in town. Eko Atlantic and Banana Island rents rise by 50%.",
    category: "city",
    durationRounds: 1,
    effectType: "rent_multiplier",
    value: 1.5,
    targetGroup: "darkblue",
    icon: "⛳",
  },
  {
    id: "lagos_property_boom",
    title: "Lagos Real Estate Gold Rush",
    description:
      "Speculators drive up land values! Unowned property purchase prices increase by 20% city-wide.",
    category: "property",
    durationRounds: 2,
    effectType: "property_value_modifier",
    value: 1.2,
    icon: "📈",
  },
  {
    id: "housing_stimulus_dip",
    title: "State Land Allocation Rebate",
    description:
      "New land permits reduce acquisition costs! Buy unowned properties for 20% off city-wide.",
    category: "gov",
    durationRounds: 2,
    effectType: "property_value_modifier",
    value: 0.8,
    icon: "🏷️",
  },
  {
    id: "detty_december",
    title: "Detty December Visitor Wave",
    description:
      "Tourists pack every corner of Lagos! All property, transport, and utility rents increase by 25%.",
    category: "city",
    durationRounds: 2,
    effectType: "rent_multiplier",
    value: 1.25,
    icon: "✨",
  },
];

export function describeEventScope(ev: LagosEvent): string {
  if (!ev.targetGroup) return "City-Wide";
  if (ev.targetGroup === "transport") return "All Transport Stations";
  if (ev.targetGroup === "utility") return "NEPA & Generator Utilities";
  return GROUP_LABEL[ev.targetGroup];
}

export function describeEventEffect(ev: LagosEvent): string {
  const scope = describeEventScope(ev);
  switch (ev.effectType) {
    case "rent_multiplier": {
      const pct = Math.round((ev.value - 1) * 100);
      const change = pct >= 0 ? `+${pct}%` : `${pct}%`;
      return `${scope} rent ${change}`;
    }
    case "tax_modifier":
      return ev.value >= 0
        ? `Tax & levy spaces cost +₦${ev.value}k extra`
        : `Tax & levy spaces reduced by ₦${Math.abs(ev.value)}k`;
    case "property_value_modifier": {
      const pct = Math.round((ev.value - 1) * 100);
      const change = pct >= 0 ? `+${pct}%` : `${pct}%`;
      return `Property purchase prices ${change} (${scope})`;
    }
    case "pass_go_bonus":
      return `Passing GO pays +₦${ev.value}k extra`;
    case "jail_fee_modifier":
      return `Kirikiri bail ${ev.value >= 0 ? "+" : "-"}₦${Math.abs(ev.value)}k`;
    case "building_cost_modifier":
      return `House & hotel builds ${ev.value >= 0 ? "+" : "-"}₦${Math.abs(ev.value)}k`;
    case "all_players_cash":
      return `All active players receive +₦${ev.value}k immediately`;
  }
}

export const EVENT_INTERVAL_ROUNDS = 8;

export type EventVisualTone = "alert" | "boost" | "surge";

export interface EventVisualTheme {
  tone: EventVisualTone;
  hex: string;
  strokeHex: string;
  fillOpacity: number;
  label: string;
}

export function getEventVisualTheme(ev: LagosEvent): EventVisualTheme {
  const isReliefOrBonus =
    ev.effectType === "pass_go_bonus" ||
    ev.effectType === "all_players_cash" ||
    (ev.effectType === "rent_multiplier" && ev.value < 1) ||
    (ev.effectType === "tax_modifier" && ev.value < 0) ||
    (ev.effectType === "building_cost_modifier" && ev.value < 0) ||
    (ev.effectType === "property_value_modifier" && ev.value < 1) ||
    (ev.effectType === "jail_fee_modifier" && ev.value < 0);

  if (isReliefOrBonus) {
    return {
      tone: "boost",
      hex: "#059669",
      strokeHex: "#047857",
      fillOpacity: 0.24,
      label: "Favorable",
    };
  }

  const isDisruption =
    ev.category === "traffic" ||
    ev.category === "power" ||
    ev.category === "weather" ||
    (ev.effectType === "tax_modifier" && ev.value > 0) ||
    (ev.effectType === "jail_fee_modifier" && ev.value > 0) ||
    (ev.effectType === "building_cost_modifier" && ev.value > 0);

  if (isDisruption) {
    return {
      tone: "alert",
      hex: "#dc2626",
      strokeHex: "#b91c1c",
      fillOpacity: 0.28,
      label: "Disruption",
    };
  }

  return {
    tone: "surge",
    hex: "#d97706",
    strokeHex: "#b45309",
    fillOpacity: 0.24,
    label: "Market Surge",
  };
}

export function isSpaceAffectedByEvent(space: Space, ev: LagosEvent | null | undefined): boolean {
  if (!ev) return false;
  switch (ev.effectType) {
    case "rent_multiplier":
      if (!ev.targetGroup) {
        return space.kind === "property" || space.kind === "transport" || space.kind === "utility";
      }
      if (ev.targetGroup === "transport" || ev.targetGroup === "utility") {
        return space.kind === ev.targetGroup;
      }
      return space.kind === "property" && space.group === ev.targetGroup;
    case "property_value_modifier":
      return space.kind === "property" || space.kind === "transport" || space.kind === "utility";
    case "building_cost_modifier":
      return space.kind === "property";
    case "tax_modifier":
      return space.kind === "tax";
    case "pass_go_bonus":
      return space.kind === "go";
    case "jail_fee_modifier":
      return space.kind === "jail" || space.kind === "gotojail";
    case "all_players_cash":
      return false;
  }
}
