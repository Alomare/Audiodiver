import { useSyncExternalStore } from "react";
import { t } from "@lingui/core/macro";
import type { MusicItem } from "./api";

/** What an export writes of a cue: each slot's audio, each segment mixed, the whole piece played through, or one
    fight as the game plays it (the Soundtrack). A bank's sounds export slot by slot. */
export type What = "slots" | "segments" | "cue" | "fight";
/** Which audio: the Original, the audio as the mod plays it (new audio where a slot has some), or both. */
export type Whose = "game" | "mod" | "both";

/** The export list: things collected from anywhere in the Library, the Audio tab and the Soundtrack (some slots, a
    sound set, an archive, a whole section) to export together as one job, a folder each (editor.py, export_list).
    Each entry keeps what to write of it and which audio. Kept per user in localStorage, so it survives a restart. */
export type ExportEntry = {
  id: string;
  cue: string;        // what to open: a bank ("bank:…"), a piece of music's cue, a sound ("sfx:…")
  sources: string[];  // only these of its slots; empty: all of them
  name: string;       // the folder it goes in, and how the list shows it
  where: string;      // where it is, for the list: "Weapons ▸ Shotguns"
  count: number;      // how many slots, when known (0: unknown)
  what?: What;        // slots when not set (an entry from an older version of the list)
  whose?: Whose;      // the Original when not set
  tails?: boolean; loops?: number; fight_ms?: number;
  variants?: Record<string, string>; all_variants?: boolean;
};
export type NewEntry = Omit<ExportEntry, "id">;

const KEY = "audiodiver.exportList";
let entries: ExportEntry[] = (() => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((e) => e && typeof e.cue === "string" && Array.isArray(e.sources)) : [];
  } catch { return []; }
})();
const listeners = new Set<() => void>();
const commit = (next: ExportEntry[]) => {
  entries = next;
  try { localStorage.setItem(KEY, JSON.stringify(entries)); } catch { /* storage off */ }
  listeners.forEach((f) => f());
};
const same = (a: NewEntry, b: NewEntry) => a.cue === b.cue && (a.what ?? "slots") === (b.what ?? "slots")
  && (a.whose ?? "game") === (b.whose ?? "game") && a.sources.length === b.sources.length && a.sources.every((s) => b.sources.includes(s));

export const exportList = {
  get: () => entries,
  /** Adds what isn't on the list yet; returns how many were new. */
  add(items: NewEntry[]) {
    const fresh = items.filter((n) => !entries.some((e) => same(e, n)));
    if (fresh.length) commit([...entries, ...fresh.map((n) => ({ ...n, id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}` }))]);
    return fresh.length;
  },
  remove(id: string) { commit(entries.filter((e) => e.id !== id)); },
  rename(id: string, name: string) { commit(entries.map((e) => (e.id === id ? { ...e, name } : e))); },
  /** Changes what an entry writes or which audio. */
  set(id: string, patch: Partial<Pick<ExportEntry, "what" | "whose">>) { commit(entries.map((e) => (e.id === id ? { ...e, ...patch } : e))); },
  clear() { commit([]); },
  subscribe(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; },
};

export const useExportList = () => useSyncExternalStore(exportList.subscribe, exportList.get);

/** An Index item (a piece of music, a sound set, an archive) as entries: one per part (a language of a voice, a
    bank of an archive, a biome of a piece of music), each with all its slots. `whose`: the Audio tab's entries are
    the audio as the mod plays it. */
export function itemEntries(item: MusicItem, where: string, whose: Whose = "game"): NewEntry[] {
  return item.parts.map((p) => ({
    cue: p.cue, sources: [], where, count: p.count ?? p.targets.length, whose,
    name: item.parts.length > 1 && p.name ? `${item.full} - ${p.name}` : item.full,
  }));
}

/** "Added 3 to the export list", or that they are on it already: a quick note. `items`: how many things were chosen,
    when that differs from the entries they make. */
export function addedNote(added: number, total: number, items = total) {
  if (!added) return t`Already on the export list`;
  const already = total - added;
  // things chosen that make more entries (one per part, or per bank of an archive) say both, so the counts agree
  if (items !== total) return added < total ? t`Added ${added} of ${total} entries to the export list (${already} already on it)`
    : items === 1 ? t`Added to the export list, as ${total} entries (one per part)` : t`Added ${items} to the export list, as ${total} entries (one per part)`;
  return added === 1 && total === 1 ? t`Added to the export list`
    : added < total ? t`Added ${added} to the export list (${already} already on it)` : t`Added ${added} to the export list`;
}
