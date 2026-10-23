// The open project's notes (core project.py, `notes`), written in the details panel (Notes.tsx). A note goes by a
// key: clip: (a slot's clip) and item: (an Index item, or archive:<name>). Older projects can have notes under
// cat:, sec:, seg: and obj: keys too; they stay in the file and don't show. The panel asks only about its own key.
import { useSyncExternalStore } from "react";

type Notes = Record<string, string>;
let project: Notes = {};
const listeners = new Set<() => void>();
const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };

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
    listeners.forEach((f) => f());
  },
};

/** A thing's note in the open project ("" when there is none). */
export const useNote = (key: string) => useSyncExternalStore(subscribe, () => project[key] ?? "");
