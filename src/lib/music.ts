const MUSIC_STORAGE_KEY = "ekopoly-music-v1";
const TEMPO_BPM = 102;
const SIXTEENTH_SEC = 60 / TEMPO_BPM / 4; // ~0.147s per 16th note
const LOOKAHEAD_SEC = 0.16;
const SCHEDULER_INTERVAL_MS = 45;
const MASTER_GAIN_LEVEL = 0.14;

type MusicListener = (enabled: boolean) => void;

const listeners = new Set<MusicListener>();

let musicCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let musicFilter: BiquadFilterNode | null = null;
let schedulerId: number | null = null;
let nextNoteTime = 0;
let currentStep = 0;
let isPlaying = false;
let gestureListenersAttached = false;
let visibilityListenerAttached = false;

// 4-bar Afrobeat / Lagos Highlife progression (64 sixteenth-note steps)
// Bars: Fmaj7 (0..15) -> G6 (16..31) -> Em7 (32..47) -> Am7 (48..63)
const BASS_ROOTS = [174.61, 196.0, 164.81, 220.0]; // F3, G3, E3, A3
const BASS_FIFTHS = [130.81, 146.83, 123.47, 164.81]; // C3, D3, B2, E3
const CHORDS: readonly (readonly number[])[] = [
  [261.63, 329.63, 440.0], // Fmaj7 upper voicing (C4, E4, A4)
  [293.66, 392.0, 493.88], // G6 upper voicing (D4, G4, B4)
  [246.94, 329.63, 392.0], // Em7 upper voicing (B3, E4, G4)
  [261.63, 329.63, 440.0], // Am7 voicing (C4, E4, A4)
];

// Syncopated Lagos highlife kalimba/guitar riff (frequencies in Hz, null = rest)
const MELODY_PATTERN: readonly (number | null)[] = [
  // Bar 1 (Fmaj7)
  523.25, null, 659.25, null, 587.33, null, 523.25, 440.0, null, 523.25, null, 659.25, 587.33, null, 523.25, null,
  // Bar 2 (G6)
  587.33, null, 783.99, null, 659.25, null, 587.33, 493.88, null, 587.33, null, 659.25, 587.33, null, 493.88, null,
  // Bar 3 (Em7)
  493.88, null, 659.25, null, 587.33, null, 493.88, 392.0, null, 493.88, null, 587.33, 523.25, null, 493.88, null,
  // Bar 4 (Am7)
  440.0, null, 523.25, null, 659.25, null, 783.99, null, 659.25, null, 587.33, 523.25, null, 440.0, null, null,
];

function notifyListeners(enabled: boolean): void {
  for (const listener of listeners) {
    try {
      listener(enabled);
    } catch {
      /* ignore subscriber errors */
    }
  }
}

export function subscribeMusic(listener: MusicListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isMusicEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(MUSIC_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

function getOrCreateContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!musicCtx || musicCtx.state === "closed") {
    musicCtx = new Ctor();
    masterGain = musicCtx.createGain();
    masterGain.gain.setValueAtTime(0.0001, musicCtx.currentTime);

    musicFilter = musicCtx.createBiquadFilter();
    musicFilter.type = "lowpass";
    musicFilter.frequency.setValueAtTime(2600, musicCtx.currentTime);
    musicFilter.Q.setValueAtTime(0.7, musicCtx.currentTime);

    musicFilter.connect(masterGain);
    masterGain.connect(musicCtx.destination);
  }
  return musicCtx;
}

function playPluck(ctx: AudioContext, dest: AudioNode, freq: number, time: number, duration: number, gain: number): void {
  const osc = ctx.createOscillator();
  const sub = ctx.createOscillator();
  const env = ctx.createGain();

  osc.type = "triangle";
  osc.frequency.setValueAtTime(freq, time);
  sub.type = "sine";
  sub.frequency.setValueAtTime(freq * 2, time);

  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(0.22, time);

  env.gain.setValueAtTime(0.0001, time);
  env.gain.linearRampToValueAtTime(gain, time + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, time + duration);

  osc.connect(env);
  sub.connect(subGain);
  subGain.connect(env);
  env.connect(dest);

  osc.start(time);
  sub.start(time);
  osc.stop(time + duration + 0.02);
  sub.stop(time + duration + 0.02);
}

function playBass(ctx: AudioContext, dest: AudioNode, freq: number, time: number, duration: number, gain: number): void {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, time);

  env.gain.setValueAtTime(0.0001, time);
  env.gain.linearRampToValueAtTime(gain, time + 0.015);
  env.gain.exponentialRampToValueAtTime(0.0001, time + duration);

  osc.connect(env);
  env.connect(dest);
  osc.start(time);
  osc.stop(time + duration + 0.02);
}

function playPadChord(ctx: AudioContext, dest: AudioNode, freqs: readonly number[], time: number, duration: number): void {
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, time);
  env.gain.linearRampToValueAtTime(0.06, time + 0.08);
  env.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  env.connect(dest);

  for (const freq of freqs) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, time);
    osc.connect(env);
    osc.start(time);
    osc.stop(time + duration + 0.03);
  }
}

function playShaker(ctx: AudioContext, dest: AudioNode, time: number, accent: boolean): void {
  const duration = accent ? 0.045 : 0.028;
  const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp((-i / length) * 5);
  }

  const src = ctx.createBufferSource();
  src.buffer = buffer;

  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.setValueAtTime(3200, time);

  const env = ctx.createGain();
  env.gain.setValueAtTime(accent ? 0.08 : 0.04, time);
  env.gain.exponentialRampToValueAtTime(0.0001, time + duration);

  src.connect(hp);
  hp.connect(env);
  env.connect(dest);
  src.start(time);
}

function scheduleStep(ctx: AudioContext, dest: AudioNode, step: number, time: number): void {
  const bar = Math.floor(step / 16) % 4;
  const beatStep = step % 16;
  const chord = CHORDS[bar];
  const bassRoot = BASS_ROOTS[bar];
  const bassFifth = BASS_FIFTHS[bar];

  // Warm chord swell on beat 1 (step 0) and gentle stab on beat 3 (step 10)
  if (chord && beatStep === 0) {
    playPadChord(ctx, dest, chord, time, SIXTEENTH_SEC * 14);
  } else if (chord && beatStep === 10) {
    playPadChord(ctx, dest, chord, time, SIXTEENTH_SEC * 5);
  }

  // Syncopated Afrobeat bass groove
  if (bassRoot !== undefined && (beatStep === 0 || beatStep === 6 || beatStep === 10)) {
    playBass(ctx, dest, bassRoot, time, SIXTEENTH_SEC * 2.6, 0.36);
  } else if (bassFifth !== undefined && (beatStep === 3 || beatStep === 14)) {
    playBass(ctx, dest, bassFifth, time, SIXTEENTH_SEC * 1.8, 0.28);
  }

  // Kalimba / highlife guitar lead
  const note = MELODY_PATTERN[step % MELODY_PATTERN.length] ?? null;
  if (note !== null) {
    playPluck(ctx, dest, note, time, SIXTEENTH_SEC * 2.4, 0.16);
  }

  // Gentle shekere pulse on 8th-note offbeats
  if (beatStep % 2 === 0) {
    playShaker(ctx, dest, time, beatStep % 4 === 2);
  }
}

function runScheduler(): void {
  if (!isPlaying || !musicCtx || !musicFilter || musicCtx.state !== "running") return;
  const horizon = musicCtx.currentTime + LOOKAHEAD_SEC;
  if (nextNoteTime < musicCtx.currentTime) {
    nextNoteTime = musicCtx.currentTime + 0.02;
  }
  while (nextNoteTime < horizon) {
    scheduleStep(musicCtx, musicFilter, currentStep, nextNoteTime);
    nextNoteTime += SIXTEENTH_SEC;
    currentStep = (currentStep + 1) % 64;
  }
}

function detachGestureListeners(): void {
  if (!gestureListenersAttached || typeof window === "undefined") return;
  gestureListenersAttached = false;
  window.removeEventListener("pointerdown", handleUserGesture, true);
  window.removeEventListener("keydown", handleUserGesture, true);
  window.removeEventListener("touchstart", handleUserGesture, true);
}

function handleUserGesture(): void {
  if (!isMusicEnabled()) {
    detachGestureListeners();
    return;
  }
  startMusic();
}

function attachGestureListeners(): void {
  if (gestureListenersAttached || typeof window === "undefined") return;
  gestureListenersAttached = true;
  window.addEventListener("pointerdown", handleUserGesture, { capture: true, passive: true });
  window.addEventListener("keydown", handleUserGesture, { capture: true, passive: true });
  window.addEventListener("touchstart", handleUserGesture, { capture: true, passive: true });
}

function handleVisibilityChange(): void {
  if (typeof document === "undefined" || !musicCtx || !masterGain) return;
  if (document.hidden) {
    if (schedulerId !== null) {
      window.clearInterval(schedulerId);
      schedulerId = null;
    }
    masterGain.gain.setTargetAtTime(0.0001, musicCtx.currentTime, 0.05);
    return;
  }
  if (isMusicEnabled() && isPlaying) {
    if (musicCtx.state === "suspended") {
      void musicCtx.resume().catch(() => {});
    }
    masterGain.gain.setTargetAtTime(MASTER_GAIN_LEVEL, musicCtx.currentTime, 0.12);
    nextNoteTime = musicCtx.currentTime + 0.05;
    if (schedulerId === null) {
      schedulerId = window.setInterval(runScheduler, SCHEDULER_INTERVAL_MS);
    }
  }
}

export function startMusic(): void {
  if (typeof window === "undefined" || !isMusicEnabled()) return;
  const ctx = getOrCreateContext();
  if (!ctx || !masterGain) return;

  if (!visibilityListenerAttached && typeof document !== "undefined") {
    visibilityListenerAttached = true;
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }

  isPlaying = true;

  const beginLoop = () => {
    if (!isPlaying || !musicCtx || !masterGain || !isMusicEnabled()) return;
    if (musicCtx.state === "running") {
      detachGestureListeners();
      masterGain.gain.setTargetAtTime(MASTER_GAIN_LEVEL, musicCtx.currentTime, 0.15);
      nextNoteTime = Math.max(nextNoteTime, musicCtx.currentTime + 0.04);
      if (schedulerId === null) {
        schedulerId = window.setInterval(runScheduler, SCHEDULER_INTERVAL_MS);
        runScheduler();
      }
    } else {
      attachGestureListeners();
    }
  };

  if (ctx.state === "suspended") {
    attachGestureListeners();
    void ctx
      .resume()
      .then(() => beginLoop())
      .catch(() => attachGestureListeners());
    return;
  }

  beginLoop();
}

export function stopMusic(): void {
  isPlaying = false;
  detachGestureListeners();
  if (typeof window !== "undefined" && schedulerId !== null) {
    window.clearInterval(schedulerId);
    schedulerId = null;
  }
  if (musicCtx && masterGain && musicCtx.state !== "closed") {
    masterGain.gain.setTargetAtTime(0.0001, musicCtx.currentTime, 0.06);
  }
}

export function setMusicEnabled(enabled: boolean): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(MUSIC_STORAGE_KEY, enabled ? "true" : "false");
    } catch {
      /* ignore storage errors */
    }
  }
  if (enabled) {
    startMusic();
  } else {
    stopMusic();
  }
  notifyListeners(enabled);
}

export function toggleMusic(): boolean {
  const next = !isMusicEnabled();
  setMusicEnabled(next);
  return next;
}

export function initStartupMusic(): () => void {
  if (isMusicEnabled()) {
    startMusic();
  }
  return () => {
    stopMusic();
    if (visibilityListenerAttached && typeof document !== "undefined") {
      visibilityListenerAttached = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    }
  };
}
