const MUSIC_STORAGE_KEY = "ekopoly-music-v1";
export const MUSIC_TRACK_SRC =
  "/assets/aistudio/vadim_makes_sound-atlas-nigeria-560364_1ade5cc5.mp3";
const MUSIC_VOLUME = 0.35;

type MusicListener = (enabled: boolean) => void;

const listeners = new Set<MusicListener>();

let audioEl: HTMLAudioElement | null = null;
let isPlaying = false;
let gestureListenersAttached = false;
let visibilityListenerAttached = false;

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

function getOrCreateAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined" || typeof Audio === "undefined") return null;
  if (!audioEl) {
    audioEl = new Audio(MUSIC_TRACK_SRC);
    audioEl.loop = true;
    audioEl.preload = "auto";
    audioEl.volume = MUSIC_VOLUME;
  }
  return audioEl;
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

function tryPlayAudio(audio: HTMLAudioElement): void {
  try {
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.then === "function") {
      void playPromise
        .then(() => {
          if (isPlaying && isMusicEnabled()) {
            detachGestureListeners();
          } else {
            audio.pause();
          }
        })
        .catch(() => {
          if (isPlaying && isMusicEnabled()) {
            attachGestureListeners();
          }
        });
    } else {
      detachGestureListeners();
    }
  } catch {
    if (isPlaying && isMusicEnabled()) {
      attachGestureListeners();
    }
  }
}

function handleVisibilityChange(): void {
  if (typeof document === "undefined" || !audioEl) return;
  if (document.hidden) {
    audioEl.pause();
    return;
  }
  if (isMusicEnabled() && isPlaying) {
    tryPlayAudio(audioEl);
  }
}

export function startMusic(): void {
  if (typeof window === "undefined" || !isMusicEnabled()) return;
  const audio = getOrCreateAudio();
  if (!audio) return;

  if (!visibilityListenerAttached && typeof document !== "undefined") {
    visibilityListenerAttached = true;
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }

  isPlaying = true;
  audio.volume = MUSIC_VOLUME;

  if (typeof document !== "undefined" && document.hidden) return;
  tryPlayAudio(audio);
}

export function stopMusic(): void {
  isPlaying = false;
  detachGestureListeners();
  if (audioEl) {
    try {
      audioEl.pause();
    } catch {
      /* ignore pause errors in non-media environments */
    }
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
