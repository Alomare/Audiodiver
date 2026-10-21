// One shared audio player: whatever plays, plays here, so starting a preview stops the previous one. Switching
// between the original and the replacement of one slot keeps the position (A/B comparison).
import { useCallback, useMemo, useSyncExternalStore } from "react";

/** Where what plays can be found: the tab it was started on (the Library or the Editor), the item and the cue that
    were open, and the slot. The now-playing bar's label leads back there. */
export type PlayedAt = { scope: "library" | "editor"; itemId: string | null; cueId: string | null; source: string | null };
export type PlayerState = {
  key: string | null; playing: boolean; loading: boolean; time: number; duration: number; error: string | null;
  label: string;  // what is playing, for the now-playing bar ("Loadout #3 · game")
  at: PlayedAt | null;
  volume: number; // 0..1, remembered between sessions
};

const VOLUME_KEY = "audiodiver.volume";
const savedVolume = (() => {
  try {
    const v = localStorage.getItem(VOLUME_KEY);
    return v !== null && Number(v) >= 0 && Number(v) <= 1 ? Number(v) : 1;
  } catch { return 1; }
})();

const audio = new Audio();
audio.preload = "auto";
audio.volume = savedVolume;
let state: PlayerState = { key: null, playing: false, loading: false, time: 0, duration: 0, error: null, label: "", at: null, volume: savedVolume };
const listeners = new Set<() => void>();            // what follows everything that plays (the now-playing bar)
const byKey = new Map<string, Set<() => void>>();    // what follows one key (a play button, a slot's row)
// A change is told to the global listeners and to the keys it concerns: the one that plays, and the one that played
// before. Every play button of a long list follows a key of its own, so the frames of playback (one change each)
// don't call hundreds of them.
const set = (patch: Partial<PlayerState>) => {
  const was = state.key;
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
  for (const k of was === state.key ? [was] : [was, state.key]) if (k) byKey.get(k)?.forEach((l) => l());
};

// The load in progress. Every play starts a new one; answers that arrive late for an older one are ignored, so a
// quick click elsewhere can't seek or fail the audio that plays now.
type Load = { n: number; url: string; start: number; tries: number };
let load: Load | null = null;
let loads = 0;
const RETRIES = 2;

let stopAt: number | null = null;
audio.addEventListener("timeupdate", () => {
  if (stopAt != null && audio.currentTime >= stopAt) { stopAt = null; audio.pause(); }
  set({ time: audio.currentTime });
});
// timeupdate fires only ~4 times a second; a frame loop keeps playheads smooth while playing, and only then, so the
// window can idle when nothing plays
let ticking = false;
const tick = () => {
  if (audio.paused) { ticking = false; return; }
  if (stopAt != null && audio.currentTime >= stopAt) { stopAt = null; audio.pause(); }
  set({ time: audio.currentTime });
  requestAnimationFrame(tick);
};
audio.addEventListener("durationchange", () => set({ duration: audio.duration || 0 }));
audio.addEventListener("playing", () => {
  set({ playing: true, loading: false });
  if (!ticking) { ticking = true; requestAnimationFrame(tick); }
});
audio.addEventListener("pause", () => set({ playing: false }));
const enders = new Set<(key: string) => void>(); // what plays one thing after another (the slice tool's originals)
audio.addEventListener("ended", () => {
  const key = state.key;
  set({ playing: false, time: 0 });
  if (key) enders.forEach((f) => f(key));
});
audio.addEventListener("waiting", () => set({ loading: true }));
// A source that fails to load is asked for again, twice, before giving up: the core may still have been preparing it.
audio.addEventListener("error", () => {
  const l = load;
  if (!l || !audio.getAttribute("src")) return;
  if (l.tries < RETRIES) {
    l.tries++;
    setTimeout(() => { if (load === l) open(l); }, 250 * l.tries);
    return;
  }
  set({ playing: false, loading: false, error: "Can't play this audio. Press ▶ to try again." });
});

function open(l: Load) {
  audio.src = l.tries ? `${l.url}${l.url.includes("?") ? "&" : "?"}retry=${l.tries}` : l.url;
  const begin = () => {
    if (load !== l) return;
    if (l.start) audio.currentTime = Math.max(0, Math.min(l.start, (audio.duration || l.start) - 0.05));
    audio.play().catch((e) => {
      // AbortError: a newer load took over. NotSupportedError: the source failed, and the error listener retries.
      if (load !== l || e?.name === "AbortError" || e?.name === "NotSupportedError") return;
      set({ playing: false, loading: false, error: String(e?.message ?? e) });
    });
  };
  if (l.start) audio.addEventListener("loadedmetadata", begin, { once: true }); else begin();
}

function start(key: string, url: string, startSec: number, label: string, at: PlayedAt | null) {
  load = { n: ++loads, url, start: startSec, tries: 0 };
  set({ key, label, at, loading: true, playing: false, time: startSec, duration: 0, error: null });
  open(load);
}

export const player = {
  /** Plays url under key; the same key toggles pause. keepPosition continues from the current time (A/B).
      label says what plays, for the now-playing bar, and `at` where it can be found. */
  play(key: string, url: string, keepPosition = false, label = "", at: PlayedAt | null = null) {
    stopAt = null;
    if (state.key === key && audio.getAttribute("src") && !state.error) {
      if (audio.paused) audio.play().catch(() => {}); else audio.pause();
      return;
    }
    start(key, url, keepPosition ? audio.currentTime : 0, label, at);
  },
  /** Plays url from startSec, stopping at endSec if given (auditioning a spot or a slice). */
  playFrom(key: string, url: string, startSec: number, endSec?: number, label?: string, at: PlayedAt | null = null) {
    stopAt = endSec ?? null;
    if (state.key === key && audio.getAttribute("src") && !state.error && audio.readyState > 0) {
      if (label) set({ label });
      audio.currentTime = Math.max(0, startSec);
      audio.play().catch(() => {});
      return;
    }
    start(key, url, Math.max(0, startSec), label ?? "", at);
  },
  /** Pauses or resumes whatever is loaded; false when nothing is. */
  toggle() {
    if (!state.key || !audio.getAttribute("src") || state.error) return false;
    if (audio.paused) audio.play().catch(() => {}); else audio.pause();
    return true;
  },
  stop() {
    load = null;
    audio.pause(); audio.removeAttribute("src"); audio.load();
    set({ key: null, playing: false, loading: false, time: 0, duration: 0, label: "", at: null, error: null });
  },
  seek(fraction: number) { if (audio.duration) audio.currentTime = Math.max(0, Math.min(1, fraction)) * audio.duration; },
  setVolume(v: number) {
    audio.volume = Math.max(0, Math.min(1, v));
    set({ volume: audio.volume });
    try { localStorage.setItem(VOLUME_KEY, String(audio.volume)); } catch { /* storage off */ }
  },
  /** Calls back with the key of whatever plays to its end; returns the way to stop listening. */
  onEnded(f: (key: string) => void) { enders.add(f); return () => { enders.delete(f); }; },
  get state() { return state; },
};

const follow = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export function usePlayer() {
  return useSyncExternalStore(follow, () => state);
}

/** One key's view of the player as a few words that change only when what a list row shows changes: playing,
    loading, and its progress in steps of 3°. It is told only about its own key, so a row neither draws nor gets
    called while another one plays, nor on every frame of its own playback. */
export function usePlayerLook(key: string): { playing: boolean; loading: boolean; progress: number } {
  const look = useSyncExternalStore(useFollowKey(key), () => (state.key !== key ? ""
    : `${state.playing ? "p" : ""}${state.loading ? "l" : ""}:${state.duration ? Math.round((state.time / state.duration) * 120) : 0}`));
  return useMemo(() => {
    const [flags, steps] = look.split(":");
    return { playing: flags.includes("p"), loading: flags.includes("l"), progress: Number(steps || 0) / 120 };
  }, [look]);
}

function useFollowKey(key: string) {
  return useCallback((l: () => void) => {
    let subs = byKey.get(key);
    if (!subs) byKey.set(key, (subs = new Set()));
    subs.add(l);
    return () => { subs!.delete(l); if (!subs!.size) byKey.delete(key); };
  }, [key]);
}
