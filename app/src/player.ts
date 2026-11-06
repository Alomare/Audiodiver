// One shared audio player: whatever plays, plays here, so starting a preview stops the previous one. Switching
// between the original and the replacement of one slot keeps the position (A/B comparison). Several slots can play
// as one (Play Together, through Web Audio), which the same controls drive.
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { t } from "@lingui/core/macro";

/** Where what plays can be found: the tab it was started on (the Library, the Editor or the Soundtrack), the item and
    the cue that were open (in the Soundtrack, the piece and its part), and the slot. The now-playing bar's label
    leads back there. */
export type PlayedAt = { scope: "library" | "editor" | "soundtrack"; itemId: string | null; cueId: string | null; source: string | null };
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
audio.crossOrigin = "anonymous"; // the core allows it, and Web Audio hears only what is allowed (level below)
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
  set({ playing: false, loading: false, error: t`Can't play this audio. Press ▶ to try again.` });
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
  endMix();
  load = { n: ++loads, url, start: startSec, tries: 0 };
  set({ key, label, at, loading: true, playing: false, time: startSec, duration: 0, error: null });
  level();
  open(load);
}

// Make-Up Gain on what plays (the new audio's, the original's where it has one), so it sounds as the mod plays it.
// An audio element can't go past full volume, so the gain goes through Web Audio, set up the first time a gain other
// than 0 plays; from then on the volume slider is part of the same gain. `gainOf` (the store's) says each key's gain.
let graph: { ctx: AudioContext; gain: GainNode } | null = null;
let gainOf: (key: string, at: PlayedAt | null) => number = () => 0;
function level() {
  const db = state.key ? gainOf(state.key, state.at) : 0;
  if (!graph && db) {
    try {
      const ctx = new AudioContext();
      const gain = ctx.createGain();
      ctx.createMediaElementSource(audio).connect(gain).connect(ctx.destination);
      graph = { ctx, gain };
    } catch { /* no Web Audio: the volume alone, as before */ }
  }
  mixLevel();
  if (!graph) { audio.volume = state.volume; return; }
  audio.volume = 1;
  if (graph.ctx.state === "suspended") graph.ctx.resume().catch(() => {});
  graph.gain.gain.value = state.volume * 10 ** (db / 20);
}

// Several slots at once (Play Together): decoded into Web Audio and started on one clock, each at its own Make-Up
// Gain, all of them at 1/√n of the volume (sounds that don't line up add up about that way) and through a limiter, so
// a crowd doesn't clip. The now-playing bar drives them as one sound: pause, resume, seek and stop.
export const TOGETHER_MAX = 16;
type Mix = {
  ctx: AudioContext; out: GainNode; limiter: DynamicsCompressorNode; parts: { key: string; buffer: AudioBuffer; gain: GainNode }[];
  sources: AudioBufferSourceNode[]; startedAt: number; duration: number; ended: boolean;
};
let mix: Mix | null = null;
let mixCtx: AudioContext | null = null;

function mixLevel() {
  if (!mix) return;
  mix.out.gain.value = state.volume / Math.sqrt(mix.parts.length);
  for (const p of mix.parts) p.gain.gain.value = 10 ** (gainOf(p.key, state.at) / 20);
}

function mixSilence() {
  if (!mix) return;
  for (const s of mix.sources) { s.onended = null; try { s.stop(); } catch { /* not started */ } s.disconnect(); }
  mix.sources = [];
}

function endMix() {
  if (!mix) return;
  mixSilence();
  mix.out.disconnect(); mix.limiter.disconnect();
  mix = null;
}

/** Starts every part of the mix at `offset` seconds, together; paused (`play` false), they start on resuming. */
function mixAt(offset: number, play = true) {
  const m = mix;
  if (!m) return;
  mixSilence();
  const when = m.ctx.currentTime + 0.05;
  for (const p of m.parts) {
    if (offset >= p.buffer.duration) continue;
    const s = m.ctx.createBufferSource();
    s.buffer = p.buffer;
    s.connect(p.gain);
    s.start(when, offset);
    m.sources.push(s);
  }
  m.startedAt = when - offset;
  m.ended = false;
  set({ playing: play, loading: false, time: offset });
  if (!play) return;
  if (m.ctx.state === "suspended") m.ctx.resume().then(() => requestAnimationFrame(mixTick)).catch(() => {});
  else requestAnimationFrame(mixTick);
}

function mixTick() {
  const m = mix;
  if (!m || m.ended || m.ctx.state !== "running") return;
  const time = Math.max(0, m.ctx.currentTime - m.startedAt);
  if (time >= m.duration) {
    m.ended = true;
    mixSilence();
    m.ctx.suspend().catch(() => {}); // a seek now waits for ▶, as the single player does after the end
    const key = state.key;
    set({ playing: false, time: 0 });
    if (key) enders.forEach((f) => f(key));
    return;
  }
  set({ time });
  requestAnimationFrame(mixTick);
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
  /** Plays several sounds at once, from the start, as one thing under `key` (the same key pauses and resumes them).
      `parts`: each sound's own key, which its Make-Up Gain goes by, and its url; at most TOGETHER_MAX are taken. A
      part that can't be read is left out; none readable is an error, as for one sound. */
  playTogether(key: string, parts: { key: string; url: string }[], label = "", at: PlayedAt | null = null) {
    if (state.key === key && mix) { player.toggle(); return; }
    load = null; stopAt = null;
    audio.pause();
    endMix();
    const n = ++loads;
    set({ key, label, at, loading: true, playing: false, time: 0, duration: 0, error: null });
    let ctx: AudioContext;
    try {
      ctx = mixCtx ??= new AudioContext();
    } catch {
      set({ loading: false, error: t`Can't play this audio. Press ▶ to try again.` });
      return;
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {}); // within the click or key that asked for it
    const read = async (p: { key: string; url: string }) => {
      const res = await fetch(p.url);
      if (!res.ok) throw new Error(String(res.status));
      return { key: p.key, buffer: await ctx.decodeAudioData(await res.arrayBuffer()) };
    };
    Promise.allSettled(parts.slice(0, TOGETHER_MAX).map(read)).then((got) => {
      if (loads !== n) return; // something else plays now
      const ok = got.flatMap((g) => (g.status === "fulfilled" ? [g.value] : []));
      if (!ok.length) { set({ loading: false, error: t`Can't play this audio. Press ▶ to try again.` }); return; }
      const limiter = ctx.createDynamicsCompressor(); // a limiter: nothing past -1 dB
      limiter.threshold.value = -1; limiter.knee.value = 0; limiter.ratio.value = 20;
      limiter.attack.value = 0.002; limiter.release.value = 0.2;
      const out = ctx.createGain();
      out.connect(limiter).connect(ctx.destination);
      const duration = Math.max(...ok.map((p) => p.buffer.duration));
      mix = { ctx, out, limiter, sources: [], startedAt: 0, duration, ended: false,
        parts: ok.map((p) => { const gain = ctx.createGain(); gain.connect(out); return { ...p, gain }; }) };
      mixLevel();
      set({ duration });
      mixAt(0);
    });
  },
  /** Pauses or resumes whatever is loaded; false when nothing is. */
  toggle() {
    if (mix) {
      const m = mix;
      if (m.ended) mixAt(0);
      else if (m.ctx.state === "running") m.ctx.suspend().then(() => set({ playing: false })).catch(() => {});
      else m.ctx.resume().then(() => { set({ playing: true }); requestAnimationFrame(mixTick); }).catch(() => {});
      return true;
    }
    if (!state.key || !audio.getAttribute("src") || state.error) return false;
    if (audio.paused) audio.play().catch(() => {}); else audio.pause();
    return true;
  },
  stop() {
    load = null;
    endMix();
    audio.pause(); audio.removeAttribute("src"); audio.load();
    set({ key: null, playing: false, loading: false, time: 0, duration: 0, label: "", at: null, error: null });
  },
  seek(fraction: number) {
    const f = Math.max(0, Math.min(1, fraction));
    if (mix) {
      mixAt(f * mix.duration, mix.ctx.state === "running");
      return;
    }
    if (audio.duration) audio.currentTime = f * audio.duration;
  },
  setVolume(v: number) {
    set({ volume: Math.max(0, Math.min(1, v)) });
    level();
    try { localStorage.setItem(VOLUME_KEY, String(state.volume)); } catch { /* storage off */ }
  },
  /** How loud each key plays (the store's Make-Up Gain, in dB); what plays follows a change at once. */
  setGains(f: (key: string, at: PlayedAt | null) => number) {
    gainOf = f;
    level();
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
