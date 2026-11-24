import { beforeEach, describe, expect, it, vi } from "vitest";

describe("music preference and track playback", () => {
  const playMock = vi.fn(() => Promise.resolve());
  const pauseMock = vi.fn();
  const createdAudio: Array<{ src: string; loop: boolean; preload: string; volume: number }> = [];

  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
    playMock.mockReset();
    playMock.mockImplementation(() => Promise.resolve());
    pauseMock.mockReset();
    createdAudio.length = 0;

    class MockAudio {
      src: string;
      loop = false;
      preload = "none";
      volume = 1;
      play = playMock;
      pause = pauseMock;
      constructor(src: string) {
        this.src = src;
        createdAudio.push(this);
      }
    }

    vi.stubGlobal("Audio", MockAudio);
  });

  it("defaults to enabled on startup", async () => {
    const { isMusicEnabled } = await import("./music");
    expect(isMusicEnabled()).toBe(true);
  });

  it("persists toggling music off and back on", async () => {
    const { isMusicEnabled, toggleMusic } = await import("./music");
    expect(toggleMusic()).toBe(false);
    expect(isMusicEnabled()).toBe(false);
    expect(window.localStorage.getItem("ekopoly-music-v1")).toBe("false");

    expect(toggleMusic()).toBe(true);
    expect(isMusicEnabled()).toBe(true);
    expect(window.localStorage.getItem("ekopoly-music-v1")).toBe("true");
  });

  it("notifies subscribers when music is toggled", async () => {
    const { setMusicEnabled, subscribeMusic } = await import("./music");
    const listener = vi.fn();
    const unsubscribe = subscribeMusic(listener);

    setMusicEnabled(false);
    setMusicEnabled(true);
    unsubscribe();
    setMusicEnabled(false);

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenNthCalledWith(1, false);
    expect(listener).toHaveBeenNthCalledWith(2, true);
  });

  it("plays the uploaded MP3 track in a loop and pauses when toggled off", async () => {
    const { MUSIC_TRACK_SRC, initStartupMusic, setMusicEnabled } = await import("./music");
    const cleanup = initStartupMusic();

    expect(playMock).toHaveBeenCalledTimes(1);
    expect(createdAudio).toHaveLength(1);
    expect(createdAudio[0]?.src).toBe(MUSIC_TRACK_SRC);
    expect(MUSIC_TRACK_SRC).toBe("/assets/aistudio/vadim_makes_sound-atlas-nigeria-560364_1ade5cc5.mp3");
    expect(createdAudio[0]?.loop).toBe(true);

    setMusicEnabled(false);
    expect(pauseMock).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("retries playback on first user gesture if browser autoplay blocks initial start", async () => {
    const { startMusic, stopMusic } = await import("./music");
    playMock.mockImplementationOnce(() => Promise.reject(new Error("NotAllowedError")));
    startMusic();
    await Promise.resolve();
    await Promise.resolve();

    playMock.mockImplementation(() => Promise.resolve());
    window.dispatchEvent(new Event("pointerdown"));

    expect(playMock).toHaveBeenCalledTimes(2);
    stopMusic();
  });
});
