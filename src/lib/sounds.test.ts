import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGame, reduce } from "@/game/engine";
import {
  clearPendingSounds,
  detectGameSounds,
  isSoundEnabled,
  playSound,
  setSoundEnabled,
} from "./sounds";

function makeAudioMock() {
  const start = vi.fn();
  const stop = vi.fn();
  const connect = vi.fn();
  const osc = {
    type: "sine",
    frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    connect,
    start,
    stop,
  };
  const gain = {
    gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    connect,
  };
  const bufferSrc = { buffer: null, connect, start };
  const filter = { type: "bandpass", frequency: { value: 0 }, Q: { value: 0 }, connect };
  const ctx = {
    state: "running",
    currentTime: 0,
    sampleRate: 44100,
    destination: {},
    resume: vi.fn(async () => {}),
    createOscillator: vi.fn(() => osc),
    createGain: vi.fn(() => gain),
    createBuffer: vi.fn((_c: number, len: number) => ({ getChannelData: () => new Float32Array(len) })),
    createBufferSource: vi.fn(() => bufferSrc),
    createBiquadFilter: vi.fn(() => filter),
  };
  return { ctx, start };
}

describe("sounds", () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearPendingSounds();
    vi.restoreAllMocks();
  });

  it("persists sound toggle state in localStorage and skips audio when muted", () => {
    const { ctx, start } = makeAudioMock();
    vi.stubGlobal(
      "AudioContext",
      vi.fn(function () {
        return ctx;
      }),
    );

    expect(isSoundEnabled()).toBe(true);
    playSound("roll");
    expect(start).toHaveBeenCalled();

    start.mockClear();
    setSoundEnabled(false);
    expect(isSoundEnabled()).toBe(false);
    playSound("rent");
    expect(start).not.toHaveBeenCalled();

    setSoundEnabled(true);
    expect(isSoundEnabled()).toBe(true);
    playSound("rent");
    expect(start).toHaveBeenCalled();
  });

  it("detects landing, rent collection, buying, and passing GO from state transitions", () => {
    const s0 = createGame([
      { name: "Ada", isCpu: false },
      { name: "Tunde", isCpu: false },
    ]);

    // Roll 1 -> lands on unowned Mushin (index 1)
    const s1 = reduce(s0, { type: "roll", dice: [0, 1] });
    expect(detectGameSounds(s0, s1)).toEqual(["land"]);
    expect(detectGameSounds(s0, s1, { includeRemoteRoll: true })).toEqual(["roll", "land"]);

    // Buy Mushin
    const s2 = reduce(s1, { type: "buy" });
    expect(detectGameSounds(s1, s2)).toEqual(["buy"]);

    // End turn -> next player
    const s3 = reduce(s2, { type: "endTurn" });
    expect(detectGameSounds(s2, s3)).toEqual(["turn"]);

    // Player 2 rolls 1 -> lands on Ada's Mushin and pays rent
    const s4 = reduce(s3, { type: "roll", dice: [0, 1] });
    expect(detectGameSounds(s3, s4)).toEqual(["rent"]);
  });
});
