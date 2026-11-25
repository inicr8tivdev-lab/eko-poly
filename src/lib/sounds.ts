import type { GameState } from "@/game/engine";

export type SoundEffect =
  | "roll"
  | "land"
  | "rent"
  | "buy"
  | "passGo"
  | "build"
  | "tax"
  | "owambe"
  | "wahala"
  | "jail"
  | "bid"
  | "trade"
  | "cash"
  | "bankrupt"
  | "turn"
  | "win";

const STORAGE_KEY = "ekopoly-sound-v1";

let audioCtx: AudioContext | null = null;
const timers = new Set<number>();

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx || audioCtx.state === "closed") {
    audioCtx = new Ctor();
  }
  return audioCtx;
}

export function unlockAudio(): void {
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    void ctx.resume().catch(() => {});
  }
}

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw !== "false";
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
  } catch {
    /* ignore storage failures */
  }
  if (enabled) unlockAudio();
}

function tone(
  ctx: AudioContext,
  freq: number,
  startOffset: number,
  duration: number,
  options?: {
    type?: OscillatorType;
    gain?: number;
    endFreq?: number;
  },
): void {
  const now = ctx.currentTime + startOffset;
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  const peak = options?.gain ?? 0.16;

  osc.type = options?.type ?? "triangle";
  osc.frequency.setValueAtTime(freq, now);
  if (options?.endFreq !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, options.endFreq), now + duration);
  }

  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.linearRampToValueAtTime(peak, now + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

function noiseTap(
  ctx: AudioContext,
  startOffset: number,
  duration: number,
  freq: number,
  gain = 0.12,
): void {
  const sampleRate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(sampleRate * duration));
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp((-i / length) * 6);
  }

  const src = ctx.createBufferSource();
  src.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  filter.Q.value = 2.5;

  const gainNode = ctx.createGain();
  const now = ctx.currentTime + startOffset;
  gainNode.gain.setValueAtTime(gain, now);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  src.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(ctx.destination);
  src.start(now);
}

export function playSound(effect: SoundEffect): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    void ctx.resume().catch(() => {});
  }

  switch (effect) {
    case "roll": {
      const hits = [0, 0.065, 0.14, 0.22, 0.32, 0.43];
      hits.forEach((t, i) => {
        noiseTap(ctx, t, 0.045, 900 + (i % 3) * 280, 0.16);
        tone(ctx, 260 + (i % 2) * 90, t, 0.04, { type: "triangle", gain: 0.08, endFreq: 130 });
      });
      return;
    }
    case "land":
      tone(ctx, 210, 0, 0.09, { type: "sine", gain: 0.18, endFreq: 95 });
      noiseTap(ctx, 0, 0.03, 600, 0.08);
      return;
    case "rent":
      // Cash-register double coin chime
      tone(ctx, 1318.5, 0, 0.14, { type: "sine", gain: 0.15 });
      tone(ctx, 1975.5, 0.075, 0.24, { type: "sine", gain: 0.18 });
      tone(ctx, 2637, 0.11, 0.22, { type: "triangle", gain: 0.07 });
      return;
    case "buy":
      tone(ctx, 523.25, 0, 0.12, { type: "triangle", gain: 0.14 });
      tone(ctx, 659.25, 0.07, 0.12, { type: "triangle", gain: 0.15 });
      tone(ctx, 783.99, 0.14, 0.22, { type: "triangle", gain: 0.18 });
      return;
    case "passGo":
      tone(ctx, 523.25, 0, 0.1, { type: "triangle", gain: 0.14 });
      tone(ctx, 659.25, 0.07, 0.1, { type: "triangle", gain: 0.14 });
      tone(ctx, 783.99, 0.14, 0.1, { type: "triangle", gain: 0.14 });
      tone(ctx, 1046.5, 0.21, 0.24, { type: "sine", gain: 0.18 });
      return;
    case "build":
      noiseTap(ctx, 0, 0.04, 750, 0.14);
      tone(ctx, 300, 0, 0.08, { type: "triangle", gain: 0.14, endFreq: 180 });
      noiseTap(ctx, 0.09, 0.04, 920, 0.14);
      tone(ctx, 390, 0.09, 0.09, { type: "triangle", gain: 0.15, endFreq: 220 });
      return;
    case "tax": {
      try {
        if (typeof window !== "undefined" && typeof Audio !== "undefined") {
          const audio = new Audio("/assets/aistudio/Eweeh-sound-effects_08a981e6.mp3");
          audio.volume = 0.8;
          void audio.play().catch(() => {});
        }
      } catch {
        // ignore audio errors
      }
      tone(ctx, 392, 0, 0.12, { type: "triangle", gain: 0.13, endFreq: 330 });
      tone(ctx, 293.66, 0.11, 0.18, { type: "triangle", gain: 0.14, endFreq: 220 });
      return;
    }
    case "owambe": {
      try {
        if (typeof window !== "undefined" && typeof Audio !== "undefined") {
          const audio = new Audio(
            "/assets/aistudio/Lets-have-it-Comedy-sound-effect_f089d645.mp3",
          );
          audio.volume = 0.85;
          void audio.play().catch(() => {});
        }
      } catch {
        // ignore audio errors
      }
      tone(ctx, 587.33, 0, 0.1, { type: "triangle", gain: 0.14 });
      tone(ctx, 739.99, 0.07, 0.1, { type: "triangle", gain: 0.14 });
      tone(ctx, 880, 0.14, 0.1, { type: "triangle", gain: 0.15 });
      tone(ctx, 1174.66, 0.21, 0.25, { type: "sine", gain: 0.17 });
      return;
    }
    case "wahala": {
      try {
        if (typeof window !== "undefined" && typeof Audio !== "undefined") {
          const audio = new Audio(
            "/assets/aistudio/Wahala-wahala-wahala-Sound-effect_9200d5a4.mp3",
          );
          audio.volume = 0.85;
          void audio.play().catch(() => {});
        }
      } catch {
        // ignore audio errors
      }
      tone(ctx, 349.23, 0, 0.13, { type: "sawtooth", gain: 0.08, endFreq: 329.63 });
      tone(ctx, 311.13, 0.12, 0.22, { type: "sawtooth", gain: 0.08, endFreq: 246.94 });
      return;
    }
    case "jail": {
      const tracks = [
        "/assets/aistudio/Eweeh-sound-effects_08a981e6.mp3",
        "/assets/aistudio/sorry_7f7f44d5.mp3",
      ];
      const track = tracks[Math.floor(Math.random() * tracks.length)];
      try {
        if (typeof window !== "undefined" && typeof Audio !== "undefined") {
          const audio = new Audio(track);
          audio.volume = 0.8;
          void audio.play().catch(() => {});
        }
      } catch {
        // ignore audio errors
      }
      tone(ctx, 280, 0, 0.25, { type: "square", gain: 0.08 });
      tone(ctx, 415, 0, 0.25, { type: "triangle", gain: 0.14 });
      noiseTap(ctx, 0, 0.06, 1500, 0.15);
      return;
    }
    case "bid":
      tone(ctx, 740, 0, 0.06, { type: "sine", gain: 0.14 });
      return;
    case "trade":
      tone(ctx, 659.25, 0, 0.11, { type: "sine", gain: 0.13 });
      tone(ctx, 987.77, 0.09, 0.16, { type: "sine", gain: 0.14 });
      return;
    case "cash":
      tone(ctx, 880, 0, 0.09, { type: "sine", gain: 0.13 });
      tone(ctx, 1108.73, 0.06, 0.15, { type: "sine", gain: 0.14 });
      return;
    case "bankrupt":
      tone(ctx, 329.63, 0, 0.16, { type: "triangle", gain: 0.15 });
      tone(ctx, 261.63, 0.15, 0.16, { type: "triangle", gain: 0.15 });
      tone(ctx, 220, 0.3, 0.3, { type: "triangle", gain: 0.16, endFreq: 146.83 });
      return;
    case "turn":
      tone(ctx, 480, 0, 0.04, { type: "sine", gain: 0.07 });
      return;
    case "win":
      tone(ctx, 523.25, 0, 0.11, { type: "triangle", gain: 0.15 });
      tone(ctx, 659.25, 0.1, 0.11, { type: "triangle", gain: 0.15 });
      tone(ctx, 783.99, 0.2, 0.11, { type: "triangle", gain: 0.15 });
      tone(ctx, 1046.5, 0.3, 0.16, { type: "sine", gain: 0.18 });
      tone(ctx, 783.99, 0.46, 0.11, { type: "triangle", gain: 0.15 });
      tone(ctx, 1046.5, 0.57, 0.35, { type: "sine", gain: 0.2 });
      return;
  }
}

export function playSoundSequence(effects: SoundEffect[]): void {
  if (!isSoundEnabled() || effects.length === 0) return;
  effects.forEach((effect, idx) => {
    if (idx === 0) {
      playSound(effect);
      return;
    }
    if (typeof window === "undefined") return;
    const id = window.setTimeout(() => {
      timers.delete(id);
      playSound(effect);
    }, idx * 180);
    timers.add(id);
  });
}

export function clearPendingSounds(): void {
  for (const id of timers) {
    if (typeof window !== "undefined") window.clearTimeout(id);
  }
  timers.clear();
}

/**
 * Derive crisp sound cues from pure GameState transitions (works identically for local and online play).
 */
export function detectGameSounds(
  prev: GameState,
  next: GameState,
  options?: { includeRemoteRoll?: boolean },
): SoundEffect[] {
  const newCount = next.logSeq - prev.logSeq;
  const entries =
    newCount > 0 ? next.log.slice(0, Math.min(newCount, next.log.length)).reverse() : [];
  const sounds: SoundEffect[] = [];
  const push = (s: SoundEffect) => {
    if (sounds[sounds.length - 1] !== s) sounds.push(s);
  };

  let rolled = false;
  for (const entry of entries) {
    const t = entry.text;
    if (t.includes(" rolled ") && !t.includes("escaped Kirikiri")) {
      rolled = true;
      if (options?.includeRemoteRoll) push("roll");
      continue;
    }
    if (t.includes("passed GO and collected")) {
      push("passGo");
      continue;
    }
    if (t.includes("Off to Kirikiri")) {
      push("jail");
      continue;
    }
    if (t.includes("escaped Kirikiri") || t.includes("left Kirikiri")) {
      push("cash");
      continue;
    }
    if (t.includes("paid ") && t.includes(" rent ")) {
      push("rent");
      continue;
    }
    if (t.includes("drew Owambe:")) {
      push("owambe");
      continue;
    }
    if (t.includes("drew Wahala:")) {
      push("wahala");
      continue;
    }
    if (t.includes("bought ") || t.includes("Sold!") || t.includes("accepted ")) {
      push("buy");
      continue;
    }
    if (t.includes("built ")) {
      push("build");
      continue;
    }
    if (
      t.includes("sold a building") ||
      t.includes("mortgaged ") ||
      t.includes("settled their debt")
    ) {
      push("cash");
      continue;
    }
    if (t.includes("paid ₦")) {
      push("tax");
      continue;
    }
    if (t.includes("bid ₦")) {
      push("bid");
      continue;
    }
    if (t.includes("offered a deal") || t.includes("counter-offer")) {
      push("trade");
      continue;
    }
    if (t.includes("is bankrupt!")) {
      push("bankrupt");
      continue;
    }
    if (
      t.includes("landed on ") ||
      t.includes("stuck in Go-Slow") ||
      t.includes("just visiting Kirikiri")
    ) {
      push("land");
      continue;
    }
  }

  if (next.winner !== null && prev.winner === null) {
    push("win");
  } else if (rolled && sounds.length === 0) {
    push("land");
  } else if (sounds.length === 0 && next.turn !== prev.turn) {
    push("turn");
  }

  return sounds.slice(0, 3);
}
