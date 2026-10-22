// The notes written on what the Audio Editor shows (core notes.py): the global ones, the same in every project, and
// the open project's. A note goes by a key: cat:, sec:, item: (the list's categories, sections and items), seg: (a
// music segment), obj: (the container of a sound's takes) and clip: (a slot). Rows ask only about their own key, so
// writing a note draws again just the buttons it changes.
import { useSyncExternalStore } from "react";
import { call } from "./api";

type Notes = Record<string, string>;
let global: Notes = {};
let project: Notes = {};
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((f) => f());
const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };

export const noteKeys = {
  category: (id: string) => `cat:${id}`,
  section: (id: string) => `sec:${id}`,
  item: (id: string) => `item:${id}`,
  segment: (id: string) => `seg:${id}`,
  group: (key: string) => `obj:${key}`,
  clip: (source: string) => `clip:${source}`,
};

export const notes = {
  global: (key: string) => global[key] ?? "",
  project: (key: string) => project[key] ?? "",
  /** The global notes, read once the core is ready. */
  async load() {
    try { notes.setGlobal(await call<Notes>("notes")); } catch { /* none to show: writing one says what went wrong */ }
  },
  setGlobal(n: Notes) { global = n ?? {}; changed(); },
  /** The open project's notes (none with no project open), from every project state the core sends. */
  setProject(n: Notes | undefined) {
    const next = n ?? {};
    if (JSON.stringify(next) === JSON.stringify(project)) return;
    project = next;
    changed();
  },
};

/** A thing's notes, global and the project's (each "" when there is none). */
export function useNote(key: string): [string, string] {
  const g = useSyncExternalStore(subscribe, () => global[key] ?? "");
  const p = useSyncExternalStore(subscribe, () => project[key] ?? "");
  return [g, p];
}

/** The note being edited: what it is on, by key and by name. Notes.tsx shows the dialog. */
export type Editing = { key: string; name: string };
let editing: Editing | null = null;
const editListeners = new Set<() => void>();
export function openNote(key: string, name: string) {
  editing = { key, name };
  editListeners.forEach((f) => f());
}
export function closeNote() {
  editing = null;
  editListeners.forEach((f) => f());
}
export const useEditingNote = () =>
  useSyncExternalStore((f) => { editListeners.add(f); return () => { editListeners.delete(f); }; }, () => editing);
