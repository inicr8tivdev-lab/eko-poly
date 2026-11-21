import { describe, expect, it } from "vitest";
import { createGame, endGameEarly, holdingAt, playerAt, reduce, rentFor, type GameState } from "./engine";

function newGame(): GameState {
  return createGame(
    [
      { name: "A", isCpu: false },
      { name: "B", isCpu: false },
    ],
    () => 0.5,
  );
}

describe("Ekopoly rules", () => {
  it("pays ₦200k salary when passing GO", () => {
    const s = newGame();
    playerAt(s, 0).position = 38;
    const next = reduce(s, { type: "roll", dice: [1, 2] }); // lands on 1 (Makoko)
    expect(playerAt(next, 0).position).toBe(1);
    expect(playerAt(next, 0).money).toBe(1500 + 200);
  });

  it("doubles base rent when the owner holds the full colour set", () => {
    const s = newGame();
    holdingAt(s, 1).owner = 1;
    expect(rentFor(s, 1, 7)).toBe(2);
    holdingAt(s, 3).owner = 1;
    expect(rentFor(s, 1, 7)).toBe(4);
  });

  it("charges transport rent of 25k, 50k, 100k, 200k by lines owned", () => {
    const s = newGame();
    const lines = [5, 15, 25, 35];
    const expected = [25, 50, 100, 200];
    lines.forEach((l, i) => {
      holdingAt(s, l).owner = 1;
      expect(rentFor(s, 5, 7)).toBe(expected[i]);
    });
  });

  it("sends a player to Kirikiri after three doubles in a row", () => {
    let s = newGame();
    playerAt(s, 0).position = 0;
    s = reduce(s, { type: "roll", dice: [1, 1] }); // 2 Owambe card
    s.phase = "roll";
    s.lastCard = null;
    playerAt(s, 0).position = 0;
    playerAt(s, 0).inJail = false;
    s = reduce(s, { type: "roll", dice: [3, 3] }); // 6 Mushin
    s.phase = "roll";
    s = reduce(s, { type: "roll", dice: [2, 2] });
    expect(playerAt(s, 0).inJail).toBe(true);
    expect(playerAt(s, 0).position).toBe(10);
  });

  it("landing on LASTMA sends you to Kirikiri without GO salary", () => {
    const s = newGame();
    playerAt(s, 0).position = 25;
    const next = reduce(s, { type: "roll", dice: [2, 3] });
    expect(playerAt(next, 0).inJail).toBe(true);
    expect(playerAt(next, 0).position).toBe(10);
    expect(playerAt(next, 0).money).toBe(1500);
  });

  it("bail out of Kirikiri costs ₦50k", () => {
    const s = newGame();
    playerAt(s, 0).inJail = true;
    playerAt(s, 0).position = 10;
    const next = reduce(s, { type: "payJail" });
    expect(playerAt(next, 0).inJail).toBe(false);
    expect(playerAt(next, 0).money).toBe(1450);
  });

  it("bankrupt player's property goes to the creditor and the last player wins", () => {
    const s = newGame();
    holdingAt(s, 39).owner = 1;
    holdingAt(s, 39).houses = 5; // Banana Island hotel: ₦2M rent
    holdingAt(s, 37).owner = 1;
    playerAt(s, 0).position = 35;
    playerAt(s, 0).money = 100;
    holdingAt(s, 1).owner = 0;
    let next = reduce(s, { type: "roll", dice: [1, 3] });
    expect(next.phase).toBe("debt");
    next = reduce(next, { type: "bankrupt" });
    expect(playerAt(next, 0).bankrupt).toBe(true);
    expect(holdingAt(next, 1).owner).toBe(1);
    expect(next.phase).toBe("gameover");
    expect(next.winner).toBe(1);
  });
});

describe("Game length", () => {
  it("ends after the chosen number of rounds and crowns the richest player", () => {
    let s = createGame(
      [
        { name: "A", isCpu: false },
        { name: "B", isCpu: false },
      ],
      () => 0.5,
      1,
    );
    holdingAt(s, 39).owner = 1; // B owns Banana Island → richer
    s.phase = "end";
    s = reduce(s, { type: "endTurn" }); // A → B, still round 1
    expect(s.phase).toBe("roll");
    s.phase = "end";
    s = reduce(s, { type: "endTurn" }); // B → A would start round 2
    expect(s.phase).toBe("gameover");
    expect(s.winner).toBe(1);
  });
});

describe("Bidding when you can't afford a property", () => {
  // Player A lands on Eko Atlantic (index 37, ₦350k) with only ₦100k.
  function broke(): GameState {
    const s = createGame(
      [
        { name: "A", isCpu: false },
        { name: "B", isCpu: false },
        { name: "C", isCpu: false },
      ],
      () => 0.5,
    );
    playerAt(s, 0).position = 33;
    playerAt(s, 0).money = 100;
    return reduce(s, { type: "roll", dice: [1, 3] });
  }

  it("opens bidding when the player can't afford the price", () => {
    const s = broke();
    expect(s.phase).toBe("buy");
    const a = reduce(s, { type: "auction" });
    expect(a.phase).toBe("auction");
    expect(a.auction?.turn).toBe(0);

  });

  it("also lets a player who can afford the property put it up for bidding", () => {
    const rich = structuredClone(broke());
    playerAt(rich, 0).money = 1000;
    const a = reduce(rich, { type: "auction" });
    expect(a.phase).toBe("auction");
    expect(a.auction?.index).toBe(37);
  });

  it("highest bidder pays their bid and gets the property", () => {
    let s = reduce(broke(), { type: "auction" });
    s = reduce(s, { type: "bid", amount: 50 }); // A
    s = reduce(s, { type: "bid", amount: 120 }); // B
    s = reduce(s, { type: "auctionPass" }); // C
    s = reduce(s, { type: "auctionPass" }); // A
    expect(holdingAt(s, 37).owner).toBe(1);
    expect(playerAt(s, 1).money).toBe(1500 - 120);
    expect(playerAt(s, 0).money).toBe(100);
    expect(s.phase).toBe("end");
  });

  it("a player cannot bid more cash than they have", () => {
    const s = reduce(broke(), { type: "auction" });
    expect(reduce(s, { type: "bid", amount: 110 })).toBe(s);
  });

  it("property stays with the bank when nobody bids", () => {
    let s = reduce(broke(), { type: "auction" });
    s = reduce(s, { type: "auctionPass" });
    s = reduce(s, { type: "auctionPass" });
    s = reduce(s, { type: "auctionPass" });
    expect(holdingAt(s, 37).owner).toBe(null);
    expect(s.phase).toBe("end");
  });
});

describe("host ends game early", () => {
  it("ends the game and the richest player wins", () => {
    const g = createGame([{ name: "A", isCpu: false }, { name: "B", isCpu: false }], () => 0.5, null);
    g.players[1]!.money += 500;
    const e = endGameEarly(g);
    expect(e.phase).toBe("gameover");
    expect(e.winner).toBe(1);
  });
});
