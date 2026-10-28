// Whether each tab's details panel is folded away by the button in its corner (Inspector.tsx PanelToggle): a narrow
// strip with the button stays. Kept with the layout sizes, so Settings' reset of the layout shows the panels again.
import { useSyncExternalStore } from "react";
import { RESET_LAYOUT } from "./settings";

export type PanelScope = "editor" | "library";
export const PANELS_KEY = "audiodiver.foldedPanels";
const NONE: Record<PanelScope, boolean> = { editor: false, library: false };

function load(): Record<PanelScope, boolean> {
  try {
    const v = JSON.parse(localStorage.getItem(PANELS_KEY) ?? "{}");
    return { editor: v?.editor === true, library: v?.library === true };
  } catch { return NONE; }
}
let folded = load();
const listeners = new Set<() => void>();
function set(next: Record<PanelScope, boolean>) {
  folded = next;
  try { localStorage.setItem(PANELS_KEY, JSON.stringify(folded)); } catch { /* storage off */ }
  listeners.forEach((f) => f());
}
window.addEventListener(RESET_LAYOUT, () => { folded = NONE; listeners.forEach((f) => f()); });

export const panels = {
  toggle: (s: PanelScope) => set({ ...folded, [s]: !folded[s] }),
  /** Unfolds a panel (a tutorial whose steps are in it). */
  show: (s: PanelScope) => { if (folded[s]) set({ ...folded, [s]: false }); },
};
export const usePanelFolded = (s: PanelScope) =>
  useSyncExternalStore((f) => { listeners.add(f); return () => { listeners.delete(f); }; }, () => folded[s]);
