import { useSyncExternalStore } from "react";

/** Which master tab shows. Home and Tools lead the tab bar, then Project, Library, the two editors and Build in the
    project's band (App.tsx Rail); Updates, Wiki and Settings sit at its end, and those lead back to where you were
    when pressed again. */
export type Tab = "home" | "project" | "library" | "editor" | "text" | "build" | "tools" | "updates" | "settings" | "wiki";
export type SettingsTab = "system" | "shortcuts" | "theme";
export type LibraryTab = "index" | "archives";
export type ToolsTab = "repatch" | "combine";
export type Nav = {
  tab: Tab;
  settings: SettingsTab; // the sub-tab Settings shows
  library: LibraryTab;   // the sub-tab the Library shows
  tools: ToolsTab;       // the sub-tab Tools shows
  wiki: string;          // the Wiki page that is open ("" = the first one)
  anchor: string;        // a heading of that page to scroll to, once (a link to part of a page); not remembered
  from: Tab;            // the main tab last shown
  origin: Partial<Record<Tab, Tab>>; // where Updates, the Wiki and Settings were each opened from (one opened from
                         // another goes back to that one)
};

const MAIN: Tab[] = ["home", "project", "library", "editor", "text", "build", "tools"];
const SETTINGS: SettingsTab[] = ["system", "shortcuts", "theme"];
const LIBRARY: LibraryTab[] = ["index", "archives"];
const TOOLS: ToolsTab[] = ["repatch", "combine"];
const LIBRARY_KEY = "audiodiver.libraryTab";
const WIKI_KEY = "audiodiver.wikiPage";

function lastLibraryTab(): LibraryTab {
  try { return localStorage.getItem(LIBRARY_KEY) === "archives" ? "archives" : "index"; } catch { return "index"; }
}

function lastWikiPage(): string {
  try { return (localStorage.getItem(WIKI_KEY) ?? "").split("#")[0]; } catch { return ""; }
}

let current: Nav = { tab: "home", settings: "system", library: lastLibraryTab(), tools: "repatch", wiki: lastWikiPage(), anchor: "", from: "home", origin: {} };
const listeners = new Set<() => void>();

export const nav = {
  get: () => current,
  /** Shows a tab. `sub` picks the Settings, Library or Tools sub-tab, or the Wiki page ("page#heading" for a part of it).
      `back`: going back to where a tab was opened from, which keeps where that one was opened from in turn. */
  go(tab: Tab, sub?: string, back = false) {
    const next = { ...current, tab };
    if (MAIN.includes(tab)) next.from = tab;
    else if (tab !== current.tab && !back) next.origin = { ...current.origin, [tab]: current.tab };
    if (tab === "settings" && SETTINGS.includes(sub as SettingsTab)) next.settings = sub as SettingsTab;
    if (tab === "library" && LIBRARY.includes(sub as LibraryTab)) next.library = sub as LibraryTab;
    if (tab === "tools" && TOOLS.includes(sub as ToolsTab)) next.tools = sub as ToolsTab;
    if (tab === "wiki" && sub !== undefined) [next.wiki, next.anchor = ""] = sub.split("#");
    if (next.tab === current.tab && next.settings === current.settings && next.library === current.library && next.tools === current.tools
      && next.wiki === current.wiki && next.anchor === current.anchor) return;
    if (next.library !== current.library) try { localStorage.setItem(LIBRARY_KEY, next.library); } catch { /* storage off */ }
    if (next.wiki !== current.wiki) try { localStorage.setItem(WIKI_KEY, next.wiki); } catch { /* storage off */ }
    current = next;
    listeners.forEach((f) => f());
  },
  /** Shows a tab, or goes back to where you came from when it already shows (the gear, the guide, the ? key). */
  toggle(tab: Tab, sub?: string) {
    const there = current.tab === tab && (tab !== "settings" || sub === undefined || current.settings === sub);
    if (!there) return nav.go(tab, sub);
    const back = current.origin[tab];
    nav.go(back && back !== tab ? back : current.from, undefined, true);
  },
  /** The Wiki has scrolled to the heading a link named: the page stays where it is, and opens at its top next time. */
  landed() {
    if (!current.anchor) return;
    current = { ...current, anchor: "" };
    listeners.forEach((f) => f());
  },
  subscribe(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; },
};

export const useNav = () => useSyncExternalStore(nav.subscribe, nav.get);

/** Folds every category and section of the Library's Index (IndexTree listens): a new project starts from there. */
export const FOLD_LIBRARY = "audiodiver:fold-library";

/** Whether About (About.tsx) shows: it opens over any tab, from the ⓘ in the status bar and on Home. */
let aboutOpen = false;
const aboutListeners = new Set<() => void>();
const showAbout = (v: boolean) => { aboutOpen = v; aboutListeners.forEach((f) => f()); };
export const about = {
  open: () => showAbout(true),
  close: () => showAbout(false),
  subscribe(f: () => void) { aboutListeners.add(f); return () => { aboutListeners.delete(f); }; },
};
export const useAboutOpen = () => useSyncExternalStore(about.subscribe, () => aboutOpen);
