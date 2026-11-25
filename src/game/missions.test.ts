import { describe, expect, it } from "vitest";
import { createGame, holdingAt, playerAt, reduce } from "./engine";
import {
  LAGOS_MISSIONS,
  computeMissionProgress,
  missionById,
  redactSecretMissions,
} from "./missions";

describe("Secret Missions catalog & gameplay tracking", () => {
  it("provides at least 25 distinct Lagos-inspired secret missions", () => {
    expect(LAGOS_MISSIONS.length).toBeGreaterThanOrEqual(25);
    const ids = new Set(LAGOS_MISSIONS.map((m) => m.id));
    expect(ids.size).toBe(LAGOS_MISSIONS.length);
    for (const m of LAGOS_MISSIONS) {
      expect(m.title.trim().length).toBeGreaterThan(0);
      expect(m.objective.trim().length).toBeGreaterThan(0);
      expect(m.rewardCash).toBeGreaterThan(0);
      expect(["easy", "medium", "hard"]).toContain(m.difficulty);
    }
  });

  it("assigns unique secret missions to each player in a single game with zero duplicates", () => {
    const s = createGame([
      { name: "Ada", isCpu: false },
      { name: "Tunde", isCpu: false },
      { name: "Chidi", isCpu: false },
      { name: "Bola", isCpu: false },
    ]);
    expect(s.missions).toBeDefined();
    const assigned = [0, 1, 2, 3].map((id) => s.missions![id]!.missionId);
    expect(new Set(assigned).size).toBe(4);
    for (const id of assigned) {
      expect(missionById(id)).toBeDefined();
    }
  });

  it("automatically tracks progress, awards private bonus without leaking to log, and lets the player reveal it", () => {
    const s = createGame([
      { name: "Ada", isCpu: false },
      { name: "Tunde", isCpu: false },
    ]);
    s.missions![0] = { missionId: "banana_island_mogul", completed: false, revealed: false };
    s.missions![1] = { missionId: "third_mainland_commuter", completed: false, revealed: false };

    // Player 0 lands on Banana Island (index 39) and buys it (₦400k), earning the ₦400k Banana Island Mogul bonus.
    playerAt(s, 0).position = 36;
    const beforeLogLen = s.log.length;
    let next = reduce(s, { type: "roll", dice: [1, 2] }); // lands on 39
    expect(next.phase).toBe("buy");
    const cashBeforeBuy = playerAt(next, 0).money;
    next = reduce(next, { type: "buy" });

    // Net cash: cashBeforeBuy - 400 (property) + 400 (mission reward)
    expect(playerAt(next, 0).money).toBe(cashBeforeBuy);
    expect(next.missions![0]!.completed).toBe(true);
    expect(next.missions![0]!.revealed).toBe(false);

    // Public game log must NOT leak secret mission completion while unrevealed.
    const addedLogs = next.log.slice(0, next.log.length - beforeLogLen).map((l) => l.text);
    expect(addedLogs.some((t) => t.toLowerCase().includes("secret mission"))).toBe(false);

    // Player 0 can reveal their completed mission publicly.
    const revealed = reduce(next, { type: "revealMission", playerId: 0 });
    expect(revealed.missions![0]!.revealed).toBe(true);
    expect(revealed.log[0]!.text).toContain("Banana Island Mogul");
  });

  it("tracks rent collection, GO passes, auctions won, and trades completed", () => {
    const s = createGame([
      { name: "Ada", isCpu: false },
      { name: "Tunde", isCpu: false },
      { name: "Chidi", isCpu: false },
    ]);
    s.missions![0] = { missionId: "rent_harvest", completed: false, revealed: false };
    s.missions![1] = { missionId: "marina_deal_maker", completed: false, revealed: false };

    // Player 1 owns Victoria Island (index 34, rent ₦28k / hotel ₦1,200k). Set houses=3 -> ₦1,000k rent.
    holdingAt(s, 34).owner = 1;
    holdingAt(s, 34).houses = 3;
    holdingAt(s, 31).owner = 1;
    holdingAt(s, 32).owner = 1;

    playerAt(s, 0).position = 30;
    const afterRent = reduce(s, { type: "roll", dice: [2, 2] }); // Player 0 pays rent on 34 to Player 1
    expect(afterRent.missionStats![1]!.rentCollectedCount).toBe(1);
    expect(afterRent.missionStats![1]!.rentCollectedAmount).toBeGreaterThanOrEqual(500);
    expect(afterRent.missionStats![1]!.rentPayers).toContain(0);

    // Verify GO pass counter increments on Player 0 passing GO (landing safely on Makoko index 1).
    const sGo = createGame(
      [
        { name: "Ada", isCpu: false },
        { name: "Tunde", isCpu: false },
      ],
      () => 0.5,
    );
    sGo.missions![0] = { missionId: "third_mainland_commuter", completed: false, revealed: false };
    playerAt(sGo, 0).position = 38;
    let passed = reduce(sGo, { type: "roll", dice: [1, 2] }); // 38 -> 1 (Makoko)
    expect(passed.missionStats![0]!.passedGoCount).toBe(1);
    const prog1 = computeMissionProgress(passed, 0, missionById("third_mainland_commuter")!);
    expect(prog1).toEqual({ current: 1, target: 2, done: false });

    passed = reduce(passed, { type: "decline" });
    passed.phase = "roll";
    playerAt(passed, 0).position = 38;
    passed = reduce(passed, { type: "roll", dice: [1, 2] }); // 38 -> 1 again
    expect(passed.missionStats![0]!.passedGoCount).toBe(2);
    expect(passed.missions![0]!.completed).toBe(true);
    expect(playerAt(passed, 0).money).toBe(1500 + 200 + 200 + 120);

    // Verify auction win mission completion awards reward cleanly.
    const sAuc = createGame(
      [
        { name: "Ada", isCpu: false },
        { name: "Tunde", isCpu: false },
      ],
      () => 0.5,
    );
    sAuc.missions![1] = { missionId: "alaba_bargain_hunter", completed: false, revealed: false };
    playerAt(sAuc, 0).position = 38;
    let auc = reduce(sAuc, { type: "roll", dice: [1, 2] }); // Makoko
    auc = reduce(auc, { type: "auction" });
    auc = reduce(auc, { type: "auctionPass" }); // Player 0 passes
    auc = reduce(auc, { type: "bid", amount: 50 }); // Player 1 bids 50
    expect(auc.missionStats![1]!.auctionsWon).toBe(1);
    expect(auc.missions![1]!.completed).toBe(true);
    expect(playerAt(auc, 1).money).toBe(1500 - 50 + 140);

    // Verify trade mission awards cash + Kirikiri Free-Exit card.
    const sTrade = createGame([
      { name: "Ada", isCpu: false },
      { name: "Tunde", isCpu: false },
    ]);
    sTrade.missions![0] = { missionId: "marina_deal_maker", completed: false, revealed: false };
    holdingAt(sTrade, 1).owner = 0;
    holdingAt(sTrade, 3).owner = 1;
    let traded = reduce(sTrade, {
      type: "proposeTrade",
      terms: { to: 1, give: [1], get: [3], giveCash: 0, getCash: 0 },
    });
    traded = reduce(traded, { type: "acceptTrade" });
    expect(traded.missions![0]!.completed).toBe(true);
    expect(playerAt(traded, 0).jailCards).toBe(1);
    expect(playerAt(traded, 0).money).toBe(1500 + 180);
  });

  it("redacts unrevealed opponent missions during active online play and reveals all at gameover", () => {
    const s = createGame([
      { name: "Ada", isCpu: false },
      { name: "Tunde", isCpu: false },
    ]);
    const viewForAda = redactSecretMissions(s, 0);
    expect(viewForAda.missions![0]!.missionId).toBe(s.missions![0]!.missionId);
    expect(viewForAda.missions![1]!.missionId).toBe("__hidden__");

    // Revealing Tunde's mission makes it visible to Ada.
    s.missions![1]!.revealed = true;
    const viewAfterReveal = redactSecretMissions(s, 0);
    expect(viewAfterReveal.missions![1]!.missionId).toBe(s.missions![1]!.missionId);

    // At gameover, unrevealed missions are exposed cleanly.
    s.missions![1]!.revealed = false;
    s.phase = "gameover";
    const viewAtEnd = redactSecretMissions(s, 0);
    expect(viewAtEnd.missions![1]!.missionId).toBe(s.missions![1]!.missionId);
  });
});
