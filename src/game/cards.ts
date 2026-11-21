export type CardEffect =
  | { type: "money"; amount: number }
  | { type: "advance"; to: number }
  | { type: "back"; steps: number }
  | { type: "nearest"; kind: "transport" | "utility" }
  | { type: "jail" }
  | { type: "jailFree" }
  | { type: "repairs"; house: number; hotel: number }
  | { type: "eachPlayer"; amount: number };

export interface Card {
  text: string;
  effect: CardEffect;
}

export const WAHALA: Card[] = [
  { text: "Third Mainland go-slow. You turn back 3 spaces.", effect: { type: "back", steps: 3 } },
  { text: "LASTMA caught you on one-way. Go straight to Kirikiri.", effect: { type: "jail" } },
  { text: "Salary don land! Advance to GO.", effect: { type: "advance", to: 0 } },
  { text: "Danfo conductor actually gave you your change. Collect ₦50k.", effect: { type: "money", amount: 50 } },
  { text: "Up NEPA! Advance to the nearest power source.", effect: { type: "nearest", kind: "utility" } },
  { text: "Okada ban. Take the nearest transport instead.", effect: { type: "nearest", kind: "transport" } },
  { text: "Your client said 'come to my house'. Advance to Banana Island.", effect: { type: "advance", to: 39 } },
  { text: "Meeting at Ikeja GRA. Advance there.", effect: { type: "advance", to: 24 } },
  { text: "Area boys blocked your gate. Pay ₦50k.", effect: { type: "money", amount: -50 } },
  { text: "Your generator packed up. Pay ₦100k for a new one.", effect: { type: "money", amount: -100 } },
  { text: "Your crypto pumped. Collect ₦150k.", effect: { type: "money", amount: 150 } },
  { text: "Your uncle knows somebody. Get out of Kirikiri free.", effect: { type: "jailFree" } },
  { text: "Building control visited. Pay ₦25k per house, ₦100k per hotel.", effect: { type: "repairs", house: 25, hotel: 100 } },
  { text: "Flood in Lekki! Take CMS Ferry.", effect: { type: "advance", to: 35 } },
  { text: "Fuel scarcity. Queue for hours and pay ₦30k for black market fuel.", effect: { type: "money", amount: -30 } },
  { text: "You were elected chairman of your estate. Pay each player ₦20k for drinks.", effect: { type: "eachPlayer", amount: -20 } },
];

export const OWAMBE: Card[] = [
  { text: "You sprayed too much at the owambe. Pay ₦100k.", effect: { type: "money", amount: -100 } },
  { text: "Aunty sprayed you dollars on the dance floor! Collect ₦100k.", effect: { type: "money", amount: 100 } },
  { text: "It's your birthday! Collect ₦10k from every player.", effect: { type: "eachPlayer", amount: 10 } },
  { text: "Aso-ebi for your cousin's wedding. Pay ₦50k.", effect: { type: "money", amount: -50 } },
  { text: "Baba left you something in his will. Collect ₦100k.", effect: { type: "money", amount: 100 } },
  { text: "Your jollof catering was the talk of the party. Collect ₦200k.", effect: { type: "money", amount: 200 } },
  { text: "You ate too much small chops. Hospital bill: pay ₦100k.", effect: { type: "money", amount: -100 } },
  { text: "Party finished early. Advance to GO.", effect: { type: "advance", to: 0 } },
  { text: "Fight broke out at the party. Go to Kirikiri.", effect: { type: "jail" } },
  { text: "The DJ is your guy. Get out of Kirikiri free.", effect: { type: "jailFree" } },
  { text: "LIRS refund. Collect ₦20k.", effect: { type: "money", amount: 20 } },
  { text: "Your brother sent japa money from abroad. Collect ₦50k.", effect: { type: "money", amount: 50 } },
  { text: "Your gele was the best at the party. Collect ₦25k in prizes.", effect: { type: "money", amount: 25 } },
  { text: "Landlord increased rent. Pay ₦40k per house, ₦115k per hotel.", effect: { type: "repairs", house: 40, hotel: 115 } },
];
