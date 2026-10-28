// The notifications the app showed (its notices, not the quick notes), kept to read again from the status bar:
// oldest first, the last 100, also after a restart (this viewer's browser storage). The log only keeps them: it
// never shows anything by itself.
import { useSyncExternalStore } from "react";
import { nav, type Tab } from "./nav";
import { reveal } from "./platform";

/** Where a notification leads (its button, or a click on an announcement): kept with it in the log, so a click there
    leads to the same place later, also after a restart. Data, not a function, for that reason; buttons that act on
    the moment (Undo, Remove) have none. */
export type Go = { tab: Tab; sub?: string } | { reveal: string };
export const follow = (go: Go) => {
  if ("reveal" in go) reveal(go.reveal).catch(() => {});
  else nav.go(go.tab, go.sub);
};

export type Logged = { id: number; at: number; tone: "info" | "good" | "bad"; text: string; go?: Go; label?: string };
const KEY = "audiodiver.notifications";
const MAX = 100;
const SAME_MS = 5000; // the same words again this soon (a button pressed twice) are one notification

function load(): Logged[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => x && typeof x.text === "string" && typeof x.at === "number") : [];
  } catch { return []; }
}
let entries: Logged[] = load();
const listeners = new Set<() => void>();
function change(next: Logged[]) {
  entries = next;
  try { localStorage.setItem(KEY, JSON.stringify(entries)); } catch { /* storage off: this session keeps them */ }
  listeners.forEach((f) => f());
}

export const noticeLog = {
  /** go and label: where a click on it leads, and the name of that (the notice's button). */
  add(tone: Logged["tone"], text: string, go?: Go, label?: string) {
    const last = entries[entries.length - 1], at = Date.now();
    if (last && last.text === text && last.tone === tone && at - last.at < SAME_MS) change([...entries.slice(0, -1), { ...last, at, go, label }]);
    else change([...entries, { id: (last?.id ?? 0) + 1, at, tone, text, go, label }].slice(-MAX));
  },
  subscribe(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; },
};

export const useNoticeLog = () => useSyncExternalStore(noticeLog.subscribe, () => entries);
