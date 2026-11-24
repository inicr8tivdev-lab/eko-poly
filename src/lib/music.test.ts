import { beforeEach, describe, expect, it, vi } from "vitest";
import { isMusicEnabled, setMusicEnabled, subscribeMusic, toggleMusic } from "./music";

describe("music preference", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("defaults to enabled on startup", () => {
    expect(isMusicEnabled()).toBe(true);
  });

  it("persists toggling music off and back on", () => {
    expect(toggleMusic()).toBe(false);
    expect(isMusicEnabled()).toBe(false);
    expect(window.localStorage.getItem("ekopoly-music-v1")).toBe("false");

    expect(toggleMusic()).toBe(true);
    expect(isMusicEnabled()).toBe(true);
    expect(window.localStorage.getItem("ekopoly-music-v1")).toBe("true");
  });

  it("notifies subscribers when music is toggled", () => {
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
});
