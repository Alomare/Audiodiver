// Notes, written in the details panel (Notes.tsx), by key: clip: (a slot's clip) and item: (an Index item, or
// archive:<name>). The open project's (core project.py, `notes`; the Project Note) and the global ones (core
// notes.py; the Global Note), which every project and the Library see. Older projects can have notes under cat:,
// sec:, seg: and obj: keys too; they stay in the file and don't show. The panel asks only about its own key.
import { useSyncExternalStore } from "react";
import { call } from "./api";

type Notes = Record<string, string>;
/** The global notes and where they are kept (core Session.global_notes). error: why the file can't be read. */
export type GlobalNotes = { notes: Notes; folder: string; file: string; default: boolean; error: string | null };

let project: Notes = {};
let global: GlobalNotes = { notes: {}, folder: "", file: "", default: true, error: null };
const listeners = new Set<() => void>();
const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
const changed = () => listeners.forEach((f) => f());

export const noteKeys = {
  item: (id: string) => `item:${id}`,
  clip: (source: string) => `clip:${source}`,
};

export const notes = {
  /** The open project's notes (none with no project open), from every project state the core sends. */
  setProject(n: Notes | undefined) {
    const next = n ?? {};
    if (JSON.stringify(next) === JSON.stringify(project)) return;
    project = next;
    changed();
  },
  /** The global notes as the core answered (every call that changes them answers with all of them). */
  setGlobal(g: GlobalNotes) {
    if (JSON.stringify(g) === JSON.stringify(global)) return;
    global = g;
    changed();
  },
  /** Reads the global notes again: at the start, and when the window comes back to the front (another computer may
      have changed the file, through a synced folder). */
  async loadGlobal() {
    try { notes.setGlobal(await call<GlobalNotes>("notes_global")); } catch { /* the core says why elsewhere */ }
  },
  /** Writes a global note ("" removes it). Throws the core's message. */
  async setGlobalNote(key: string, text: string) {
    notes.setGlobal(await call<GlobalNotes>("note_global_set", { key, text }));
  },
};

/** A thing's note in the open project ("" when there is none). */
export const useNote = (key: string) => useSyncExternalStore(subscribe, () => project[key] ?? "");
/** A thing's global note ("" when there is none). */
export const useGlobalNote = (key: string) => useSyncExternalStore(subscribe, () => global.notes[key] ?? "");
/** The global notes, with where they are kept (Settings ▸ System). */
export const useGlobalNotes = () => useSyncExternalStore(subscribe, () => global);
