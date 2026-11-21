// Ekopoly board: 40 spaces in classic Monopoly order, money is in thousands of naira (k).

export type ColorGroup =
  | "brown"
  | "lightblue"
  | "pink"
  | "orange"
  | "red"
  | "yellow"
  | "green"
  | "darkblue";

export type Space =
  | { kind: "go"; name: string; sub: string }
  | {
      kind: "property";
      name: string;
      group: ColorGroup;
      price: number;
      rent: [number, number, number, number, number, number];
      houseCost: number;
      blurb: string;
    }
  | { kind: "transport"; name: string; price: number; icon: string; blurb: string }
  | { kind: "utility"; name: string; price: number; icon: string; blurb: string }
  | { kind: "tax"; name: string; amount: number; sub: string }
  | { kind: "card"; deck: "wahala" | "owambe"; name: string }
  | { kind: "jail"; name: string; sub: string }
  | { kind: "parking"; name: string; sub: string }
  | { kind: "gotojail"; name: string; sub: string };

export const START_MONEY = 1500;
export const GO_SALARY = 200;
export const JAIL_FINE = 50;
export const JAIL_INDEX = 10;

const p = (
  name: string,
  group: ColorGroup,
  price: number,
  rent: [number, number, number, number, number, number],
  houseCost: number,
  blurb: string,
): Space => ({ kind: "property", name, group, price, rent, houseCost, blurb });

export const BOARD: Space[] = [
  { kind: "go", name: "GO", sub: "Collect ₦200k salary" },
  p("Makoko", "brown", 60, [2, 10, 30, 90, 160, 250], 50, "Venice of Africa, stilts and all."),
  { kind: "card", deck: "owambe", name: "Owambe" },
  p("Ajegunle", "brown", 60, [4, 20, 60, 180, 320, 450], 50, "AJ City — home of the stars."),
  { kind: "tax", name: "LIRS Tax", amount: 200, sub: "Pay ₦200k" },
  { kind: "transport", name: "Oshodi Danfo Park", price: 200, icon: "🚌", blurb: "Owa! Owa! Enter with your change." },
  p("Mushin", "lightblue", 100, [6, 30, 90, 270, 400, 550], 50, "Strong area, stronger people."),
  { kind: "card", deck: "wahala", name: "Wahala" },
  p("Agege", "lightblue", 100, [6, 30, 90, 270, 400, 550], 50, "Agege bread is not a joke."),
  p("Oshodi", "lightblue", 120, [8, 40, 100, 300, 450, 600], 50, "Under-bridge market energy."),
  { kind: "jail", name: "Kirikiri", sub: "Just visiting" },
  p("Yaba", "pink", 140, [10, 50, 150, 450, 625, 750], 100, "Yabacon Valley tech hub."),
  { kind: "utility", name: "NEPA", price: 150, icon: "💡", blurb: "Up NEPA! Light don come." },
  p("Surulere", "pink", 140, [10, 50, 150, 450, 625, 750], 100, "Stadium nights, buka days."),
  p("Ebute Metta", "pink", 160, [12, 60, 180, 500, 700, 900], 100, "Old Lagos with railway history."),
  { kind: "transport", name: "BRT Terminal", price: 200, icon: "🚍", blurb: "Blue bus, dedicated lane, small queue." },
  p("Festac Town", "orange", 180, [14, 70, 200, 550, 750, 950], 100, "Planned estate, plenty roundabouts."),
  { kind: "card", deck: "owambe", name: "Owambe" },
  p("Gbagada", "orange", 180, [14, 70, 200, 550, 750, 950], 100, "Mid-mainland, close to everything."),
  p("Magodo", "orange", 200, [16, 80, 220, 600, 800, 1000], 100, "Gated, quiet, posh mainland."),
  { kind: "parking", name: "Go-Slow", sub: "Third Mainland traffic. Rest small." },
  p("Allen Avenue", "red", 220, [18, 90, 250, 700, 875, 1050], 150, "Ikeja's busiest strip."),
  { kind: "card", deck: "wahala", name: "Wahala" },
  p("Maryland", "red", 220, [18, 90, 250, 700, 875, 1050], 150, "The mall, the bridge, the traffic."),
  p("Ikeja GRA", "red", 240, [20, 100, 300, 750, 925, 1100], 150, "Government Reserved, quietly rich."),
  { kind: "transport", name: "Blue Line Rail", price: 200, icon: "🚆", blurb: "Marina to Mile 2 — finally!" },
  p("Chevron", "yellow", 260, [22, 110, 330, 800, 975, 1150], 150, "Lekki corridor estates."),
  p("Oniru", "yellow", 260, [22, 110, 330, 800, 975, 1150], 150, "Beach, royalty and lounges."),
  { kind: "utility", name: "Generator", price: 150, icon: "⚡", blurb: "When NEPA fails, gen don start." },
  p("Lekki Phase 1", "yellow", 280, [24, 120, 360, 850, 1025, 1200], 150, "Admiralty Way soft life."),
  { kind: "gotojail", name: "LASTMA!", sub: "You don enter one-way. Go to Kirikiri" },
  p("Victoria Island", "green", 300, [26, 130, 390, 900, 1100, 1275], 200, "Where the money sleeps."),
  p("Ikoyi", "green", 300, [26, 130, 390, 900, 1100, 1275], 200, "Old money, tall gates."),
  { kind: "card", deck: "owambe", name: "Owambe" },
  p("Parkview Estate", "green", 320, [28, 150, 450, 1000, 1200, 1400], 200, "Ikoyi within Ikoyi."),
  { kind: "transport", name: "CMS Ferry", price: 200, icon: "⛴️", blurb: "Beat traffic on the lagoon." },
  { kind: "card", deck: "wahala", name: "Wahala" },
  p("Eko Atlantic", "darkblue", 350, [35, 175, 500, 1100, 1300, 1500], 200, "A whole city built on the sea."),
  { kind: "tax", name: "Area Boys Levy", amount: 100, sub: "Pay ₦100k 'settlement'" },
  p("Banana Island", "darkblue", 400, [50, 200, 600, 1400, 1700, 2000], 200, "The richest square metres in Africa."),
];

export const GROUP_LABEL: Record<ColorGroup, string> = {
  brown: "Lagoon Side",
  lightblue: "Mainland Hustle",
  pink: "Yaba & Surulere",
  orange: "Mainland Estates",
  red: "Ikeja Axis",
  yellow: "Lekki Axis",
  green: "The Island",
  darkblue: "Big Men Only",
};

export function groupMembers(group: ColorGroup): number[] {
  return BOARD.flatMap((s, i) => (s.kind === "property" && s.group === group ? [i] : []));
}

export function isOwnable(space: Space): space is Extract<Space, { price: number }> {
  return space.kind === "property" || space.kind === "transport" || space.kind === "utility";
}

export function formatNaira(k: number): string {
  const sign = k < 0 ? "-" : "";
  const v = Math.abs(k);
  if (v >= 1000) {
    const m = v / 1000;
    return `${sign}₦${Number.isInteger(m) ? m : m.toFixed(2).replace(/0$/, "")}M`;
  }
  return `${sign}₦${v}k`;
}

export function spaceAt(i: number): Space {
  const s = BOARD[i];
  if (!s) throw new Error(`No board space ${i}`);
  return s;
}
