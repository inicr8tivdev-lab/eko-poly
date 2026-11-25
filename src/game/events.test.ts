import { describe, expect, it } from "vitest";
import { GO_SALARY, JAIL_FINE, spaceAt } from "./board";
import {
  createGame,
  holdingAt,
  houseCostFor,
  jailFineFor,
  playerAt,
  propertyPriceFor,
  reduce,
  rentFor,
  type GameState,
} from "./engine";
import {
  EVENT_INTERVAL_ROUNDS,
  LAGOS_EVENTS,
  describeEventEffect,
  describeEventScope,
  getEventVisualTheme,
  isSpaceAffectedByEvent,
} from "./events";

function twoPlayerGame(maxRounds: number | null = null): GameState {
  return createGame(
    [
      { name: "Ada", isCpu: false },
      { name: "Tunde", isCpu: false },
    ],
    () => 0.5,
    maxRounds,
  );
}

function advanceRounds(state: GameState, rounds: number): GameState {
  let s = state;
  for (let i = 0; i < rounds; i++) {
    s.phase = "end";
    s = reduce(s, { type: "endTurn" }); // Player 0 -> Player 1
    s.phase = "end";
    s = reduce(s, { type: "endTurn" }); // Player 1 -> Player 0 (round++)
  }
  return s;
}

describe("Dynamic Lagos Events", () => {
  it("contains at least 25 unique Lagos-inspired events lasting 1 or 2 rounds", () => {
    expect(LAGOS_EVENTS.length).toBeGreaterThanOrEqual(25);
    const ids = new Set(LAGOS_EVENTS.map((e) => e.id));
    expect(ids.size).toBe(LAGOS_EVENTS.length);
    for (const ev of LAGOS_EVENTS) {
      expect([1, 2]).toContain(ev.durationRounds);
      expect(describeEventScope(ev).length).toBeGreaterThan(0);
      expect(describeEventEffect(ev).length).toBeGreaterThan(0);
    }
  });

  it("triggers an event after 8 rounds instead of 2 and automatically expires it after its duration", () => {
    expect(EVENT_INTERVAL_ROUNDS).toBe(8);
    let s = twoPlayerGame();
    expect(s.round).toBe(1);
    expect(s.activeEvent).toBeNull();

    // Advance rounds 1 -> 7: no event should trigger yet (including round 2)
    for (let r = 2; r < EVENT_INTERVAL_ROUNDS; r++) {
      s = advanceRounds(s, 1);
      expect(s.round).toBe(r);
      expect(s.activeEvent).toBeNull();
    }

    // Entering round 8 -> first Lagos Event triggers
    s = advanceRounds(s, 1);
    expect(s.round).toBe(EVENT_INTERVAL_ROUNDS);
    expect(s.activeEvent).not.toBeNull();

    const firstEvent = s.activeEvent!;
    const expectedExpiry = EVENT_INTERVAL_ROUNDS + firstEvent.durationRounds;
    expect(s.eventExpiresAtRound).toBe(expectedExpiry);

    // Advance to expiration round
    s = advanceRounds(s, firstEvent.durationRounds);
    expect(s.round).toBe(expectedExpiry);
    expect(s.activeEvent).toBeNull();

    // Next event triggers at round 16
    s = advanceRounds(s, 16 - expectedExpiry);
    expect(s.round).toBe(16);
    expect(s.activeEvent).not.toBeNull();
    expect(s.activeEvent!.id).not.toBe(firstEvent.id);
  });

  it("assigns red disruption theme to Road Construction and semantic themes to other events", () => {
    const roadConstruction = LAGOS_EVENTS.find((e) => e.id === "badagry_roadworks")!;
    expect(getEventVisualTheme(roadConstruction)).toMatchObject({
      tone: "alert",
      hex: "#dc2626",
    });

    const owambe = LAGOS_EVENTS.find((e) => e.id === "owambe_weekend")!;
    expect(getEventVisualTheme(owambe).tone).toBe("boost");

    const bananaBoom = LAGOS_EVENTS.find((e) => e.id === "banana_boom")!;
    expect(getEventVisualTheme(bananaBoom).tone).toBe("surge");
  });

  it("applies targeted and city-wide rent multipliers accurately", () => {
    const s = twoPlayerGame();
    holdingAt(s, 5).owner = 1; // Oshodi Danfo Park (transport, base 25k)
    holdingAt(s, 39).owner = 1; // Banana Island (darkblue, base 50k)

    const fuelEvent = LAGOS_EVENTS.find((e) => e.id === "fuel_scarcity")!;
    s.activeEvent = fuelEvent;
    expect(rentFor(s, 5, 7)).toBe(38); // 25 * 1.5 rounded
    expect(rentFor(s, 39, 7)).toBe(50); // unaffected by transport event
    expect(isSpaceAffectedByEvent(spaceAt(5), fuelEvent)).toBe(true);
    expect(isSpaceAffectedByEvent(spaceAt(39), fuelEvent)).toBe(false);

    const dettyEvent = LAGOS_EVENTS.find((e) => e.id === "detty_december")!;
    s.activeEvent = dettyEvent;
    expect(rentFor(s, 5, 7)).toBe(31); // 25 * 1.25 rounded
    expect(rentFor(s, 39, 7)).toBe(63); // 50 * 1.25 rounded
  });

  it("applies tax, property value, building cost, GO bonus, and jail bail events", () => {
    const s = twoPlayerGame();

    // Tax modifier (+50k)
    s.activeEvent = LAGOS_EVENTS.find((e) => e.id === "third_mainland_jam")!;
    playerAt(s, 0).position = 1;
    const afterTax = reduce(s, { type: "roll", dice: [1, 2] }); // lands on 4 (LIRS Tax 200k)
    expect(playerAt(afterTax, 0).money).toBe(1500 - 250);

    // Property value modifier (20% off)
    s.activeEvent = LAGOS_EVENTS.find((e) => e.id === "housing_stimulus_dip")!;
    expect(propertyPriceFor(s, 1)).toBe(48); // Makoko 60k * 0.8
    playerAt(s, 0).position = 0;
    const landedBuy = reduce(s, { type: "roll", dice: [0, 1] });
    const bought = reduce(landedBuy, { type: "buy" });
    expect(playerAt(bought, 0).money).toBe(1500 - 48);

    // Building cost modifier (-25k)
    s.activeEvent = LAGOS_EVENTS.find((e) => e.id === "eko_atlantic_sale")!;
    holdingAt(s, 1).owner = 0;
    holdingAt(s, 3).owner = 0;
    expect(houseCostFor(s, 1)).toBe(25);
    const built = reduce(s, { type: "build", index: 1 });
    expect(playerAt(built, 0).money).toBe(1500 - 25);

    // Pass GO bonus (+100k)
    s.activeEvent = LAGOS_EVENTS.find((e) => e.id === "owambe_weekend")!;
    playerAt(s, 0).position = 38;
    const passedGo = reduce(s, { type: "roll", dice: [1, 2] });
    expect(playerAt(passedGo, 0).money).toBe(1500 + GO_SALARY + 100);

    // Jail bail modifier (+30k)
    s.activeEvent = LAGOS_EVENTS.find((e) => e.id === "lastma_crackdown")!;
    expect(jailFineFor(s)).toBe(JAIL_FINE + 30);
    playerAt(s, 0).inJail = true;
    playerAt(s, 0).position = 10;
    const paidBail = reduce(s, { type: "payJail" });
    expect(playerAt(paidBail, 0).inJail).toBe(false);
    expect(playerAt(paidBail, 0).money).toBe(1500 - (JAIL_FINE + 30));
  });

  it("handles legacy saved GameState without event fields cleanly", () => {
    const legacy = twoPlayerGame();
    delete legacy.activeEvent;
    delete legacy.eventExpiresAtRound;
    delete legacy.eventHistory;

    const next = advanceRounds(legacy, EVENT_INTERVAL_ROUNDS - 1);
    expect(next.round).toBe(EVENT_INTERVAL_ROUNDS);
    expect(next.activeEvent).not.toBeNull();
    expect(next.eventHistory?.length).toBe(1);
  });
});
