import { useSyncExternalStore } from "react";

/** The mod the Import Mod panel is open on, if any, and where it goes: `into` the open project (the Project tab's
    Import Patches, or a patch file dropped on the window), else a new project (Import Mod on Home and on the Project
    tab). The store opens it; App.tsx draws it (ImportModHost). */
export type ImportAsk = { path: string; into: boolean } | null;

let ask: ImportAsk = null;
const listeners = new Set<() => void>();

export const importAsk = {
  get: () => ask,
  open(next: ImportAsk) { ask = next; listeners.forEach((f) => f()); },
  close() { importAsk.open(null); },
  subscribe(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; },
};

export const useImportAsk = () => useSyncExternalStore(importAsk.subscribe, importAsk.get);
