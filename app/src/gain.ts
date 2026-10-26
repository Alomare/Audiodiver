import { useSyncExternalStore } from "react";

/** Make-Up Gain while it is being set (the slider dragged, a value typed), before the project has it: the waveforms
    and the player follow it at once. {source: dB}. */
const live = new Map<string, number>();
const subs = new Set<() => void>();
const told = () => subs.forEach((f) => f());

export const liveGain = {
  get: (source: string) => live.get(source),
  set(sources: string[], db: number) {
    for (const s of sources) live.set(s, db);
    told();
  },
  /** The project has the value now (or the change was dropped). */
  clear(sources: string[]) {
    if (!sources.some((s) => live.has(s))) return;
    for (const s of sources) live.delete(s);
    told();
  },
  subscribe(f: () => void) { subs.add(f); return () => { subs.delete(f); }; },
};

/** The gain being set on a slot, while it is. */
export const useLiveGain = (source: string | null) => useSyncExternalStore(liveGain.subscribe, () => (source ? live.get(source) : undefined));
