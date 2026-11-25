import { describe, expect, it } from "vitest";
import { MAX_PLAYERS, isValidCode, nextFreeSeat, normalizeCode } from "./rooms";
import {
  createLocalDbClient,
  getLocalRoomForUser,
  getLocalRoomPlayerAvatars,
  listLocalRoomsForUser,
  localAuthGuest,
  localAuthSignIn,
  localAuthSignUp,
  setLocalRoomPlayerAvatar,
  verifyLocalToken,
} from "./local-online-store.server";

describe("room rules", () => {
  it("allows at most 4 players", () => {
    expect(MAX_PLAYERS).toBe(4);
    expect(nextFreeSeat([0, 1, 2, 3])).toBeNull();
  });
  it("gives the lowest free seat", () => expect(nextFreeSeat([0, 2])).toBe(1));
  it("codes are 6 characters, case-insensitive", () => {
    expect(isValidCode(normalizeCode("abc234"))).toBe(true);
    expect(isValidCode("ABC23")).toBe(false);
  });
});

describe("local online store", () => {
  it("supports sign-up, sign-in, guest auth, and token verification", () => {
    const email = `host-${Date.now()}@example.com`;
    const up = localAuthSignUp(email, "secret123");
    expect(up.ok).toBe(true);
    if (!up.ok) return;
    expect(verifyLocalToken(up.session.access_token)?.id).toBe(up.session.user.id);

    const inRes = localAuthSignIn(email, "secret123");
    expect(inRes.ok).toBe(true);

    const guest = localAuthGuest("Tunde");
    expect(guest.ok).toBe(true);
    expect(verifyLocalToken(guest.session.access_token)?.id).toBe(guest.session.user.id);
  });

  it("lets one signed-in user create a room and another join it", async () => {
    const host = localAuthGuest("Host");
    const friend = localAuthGuest("Friend");
    const db = createLocalDbClient();
    const code = `T${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    const created = await db
      .from("games")
      .insert({
        host_id: host.session.user.id,
        mode: "online",
        status: "lobby",
        code,
        max_rounds: 30,
      })
      .select("id")
      .single();
    expect(created.error).toBeNull();
    const gameId = (created.data as { id: string }).id;

    const p1 = await db
      .from("game_players")
      .insert({ game_id: gameId, user_id: host.session.user.id, seat: 0, display_name: "Host" });
    expect(p1.error).toBeNull();

    const p2 = await db.from("game_players").insert({
      game_id: gameId,
      user_id: friend.session.user.id,
      seat: 1,
      display_name: "Friend",
    });
    expect(p2.error).toBeNull();

    setLocalRoomPlayerAvatar(host.session.user.id, gameId, "🦁");
    const avatarPhoto = `data:image/jpeg;base64,${"A".repeat(400)}`;
    setLocalRoomPlayerAvatar(friend.session.user.id, gameId, avatarPhoto);

    const roomForFriend = getLocalRoomForUser(friend.session.user.id, code);
    expect(roomForFriend?.players.map((p) => p.display_name)).toEqual(["Host", "Friend"]);
    expect(roomForFriend?.players.map((p) => p.avatar)).toEqual(["🦁", avatarPhoto]);
    expect(getLocalRoomPlayerAvatars(gameId)).toEqual({
      [host.session.user.id]: "🦁",
      [friend.session.user.id]: avatarPhoto,
    });
    expect(listLocalRoomsForUser(host.session.user.id).some((r) => r.code === code)).toBe(true);
  });
});
