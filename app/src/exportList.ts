import { useSyncExternalStore } from "react";
import type { MusicItem } from "./api";

/** The export list: things collected from anywhere in the Library and the Editor (some slots, a sound set, an
    archive, a whole section) to export together as one job, a folder each (editor.py, export_list). Kept per user in
    localStorage, so it survives a restart. */
export type ExportEntry = {
  id: string;
  cue: string;        // what to open: a bank ("bank:…"), a piece of music's cue, a sound ("sfx:…")
  sources: string[];  // only these of its slots; empty: all of them
  name: string;       // the folder it goes in, and how the list shows it
  where: string;      // where it is, for the list: "Weapons ▸ Shotguns"
  count: number;      // how many slots, when known (0: unknown)
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
const same = (a: NewEntry, b: NewEntry) => a.cue === b.cue && a.sources.length === b.sources.length && a.sources.every((s) => b.sources.includes(s));

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
  clear() { commit([]); },
  subscribe(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; },
};

export const useExportList = () => useSyncExternalStore(exportList.subscribe, exportList.get);

/** An Index item (a piece of music, a sound set, an archive) as entries: one per part (a language of a voice, a
    bank of an archive, a biome of a piece of music), each with all its slots. */
export function itemEntries(item: MusicItem, where: string): NewEntry[] {
  return item.parts.map((p) => ({
    cue: p.cue, sources: [], where, count: p.count ?? p.targets.length,
    name: item.parts.length > 1 && p.name ? `${item.full} - ${p.name}` : item.full,
  }));
}

/** "Added 3 to the export list", or that they are on it already: a quick note. `items`: how many things were chosen,
    when that differs from the entries they make. */
export function addedNote(added: number, of: number, items = of) {
  if (!added) return "Already on the export list";
  // things chosen that make more entries (one per part, or per bank of an archive) say both, so the counts agree
  if (items !== of) return added < of ? `Added ${added} of ${of} entries to the export list (${of - added} already on it)`
    : `Added ${items === 1 ? "" : `${items} `}to the export list, as ${of} entries (one per part)`;
  return `Added ${added === 1 && of === 1 ? "" : `${added} `}to the export list${added < of ? ` (${of - added} already on it)` : ""}`;
}
