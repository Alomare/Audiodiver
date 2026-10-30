import { useSyncExternalStore } from "react";
import { UTILS } from "./edition";

/** Which master tab shows. Home and Tools lead the tab bar, then Project, Library, Audio, Soundtrack and Text in the
    project's band, then Build while a project is open (App.tsx Rail); Updates, Wiki and Settings sit at its end, and
    those lead back to where you were when pressed again. In the code, Audio is `editor`. */
export type Tab = "home" | "project" | "library" | "editor" | "soundtrack" | "text" | "build" | "tools" | "updates" | "settings" | "wiki";
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

/** The tabs that can be hidden (Settings ▸ System, and each project on the Project tab), in the bar's order. */
export const HIDEABLE = ["editor", "soundtrack", "text"] as const;
export type Hideable = typeof HIDEABLE[number];

const MAIN: Tab[] = ["home", "project", "library", "editor", "soundtrack", "text", "build", "tools"];
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

const START: Tab = UTILS ? "tools" : "home"; // Audiodiver Utils has no Home
// Where the window was when a change of language opened it again (i18n.ts): read once, at the start.
const REOPEN_KEY = "audiodiver.reopenAt";
function reopened(): Partial<Nav> {
  try {
    const kept = JSON.parse(sessionStorage.getItem(REOPEN_KEY) ?? "null");
    sessionStorage.removeItem(REOPEN_KEY);
    const ALL: Tab[] = [...MAIN, "updates", "settings", "wiki"];
    if (!kept || !ALL.includes(kept.tab)) return {};
    return { tab: kept.tab, from: MAIN.includes(kept.from) ? kept.from : START,
      settings: SETTINGS.includes(kept.settings) ? kept.settings : "system" };
  } catch { return {}; }
}
let current: Nav = { tab: START, settings: "system", library: lastLibraryTab(), tools: "repatch", wiki: lastWikiPage(), anchor: "", from: START, origin: {}, ...reopened() };
let off: readonly Tab[] = []; // the hideable tabs that are off now (App.tsx keeps it up to date)
let open = false;             // a project is open: Build shows only then (the store keeps it up to date)
let hidden = new Set<Tab>(["build"]);
const listeners = new Set<() => void>();
/** While the Wiki is in a window of its own (wikiWindow.ts): takes what the other window shows; true when it did. */
let elsewhere: ((place: Tab | "about", sub?: string) => boolean) | null = null;
/** The tabs out of the bar now; the one that shows, if hidden, moves to the Project tab. */
function hide() {
  hidden = new Set<Tab>(open ? off : [...off, "build"]);
  if (hidden.has(current.tab)) nav.go("project");
}

export const nav = {
  get: () => current,
  /** Shows a tab. `sub` picks the Settings, Library or Tools sub-tab, or the Wiki page ("page#heading" for a part of it).
      `back`: going back to where a tab was opened from, which keeps where that one was opened from in turn. A tab
      that is hidden doesn't open. */
  go(tab: Tab, sub?: string, back = false) {
    if (elsewhere?.(tab, sub) || hidden.has(tab)) return;
    const next = { ...current, tab };
    if (MAIN.includes(tab)) next.from = tab;
    else if (tab !== current.tab && !back) next.origin = { ...current.origin, [tab]: current.tab };
    if (tab === "settings" && SETTINGS.includes(sub as SettingsTab)) next.settings = sub as SettingsTab;
    if (tab === "library" && LIBRARY.includes(sub as LibraryTab)) next.library = sub as LibraryTab;
    if (tab === "tools" && TOOLS.includes(sub as ToolsTab)) next.tools = sub as ToolsTab;
    if (tab === "wiki" && sub !== undefined) [next.wiki, next.anchor = ""] = sub.split("#");
    if (next.tab === current.tab && next.settings === current.settings && next.library === current.library
      && next.tools === current.tools && next.wiki === current.wiki && next.anchor === current.anchor) return;
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
    const to = back && back !== tab && !hidden.has(back) ? back : !hidden.has(current.from) ? current.from : "project";
    nav.go(to, undefined, true);
  },
  /** The Wiki has scrolled to the heading a link named: the page stays where it is, and opens at its top next time. */
  landed() {
    if (!current.anchor) return;
    current = { ...current, anchor: "" };
    listeners.forEach((f) => f());
  },
  /** The hideable tabs that show now (the open project's choice, else Settings'). A hidden tab that shows moves
      to the Project tab. */
  setShown(shown: readonly Hideable[]) { off = HIDEABLE.filter((t) => !shown.includes(t)); hide(); },
  /** Whether a project is open, which Build needs. */
  setProject(isOpen: boolean) { open = isOpen; hide(); },
  /** Whether a tab is in the tab bar now. */
  shown: (tab: Tab) => !hidden.has(tab),
  /** Where a project opens: Audio, else the first hideable tab that shows, else the Project tab. */
  work: (): Tab => HIDEABLE.find((t) => !hidden.has(t)) ?? "project",
  /** The window is about to load again (a change of language): it comes back to this tab. */
  keepForReload() {
    try { sessionStorage.setItem(REOPEN_KEY, JSON.stringify({ tab: current.tab, from: current.from, settings: current.settings })); } catch { /* storage off */ }
  },
  /** Who takes what the other window shows, while the Wiki is in a window of its own (null: nobody). */
  handOver(to: typeof elsewhere) { elsewhere = to; },
  /** The Wiki's window has closed: the Wiki here carries on at the page that one was on. */
  wikiBack() {
    current = { ...current, wiki: lastWikiPage(), anchor: "" };
    listeners.forEach((f) => f());
  },
  subscribe(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; },
};

export const useNav = () => useSyncExternalStore(nav.subscribe, nav.get);

/** Folds every category and section of the Library's Index (IndexTree listens): a new project starts from there. */
export const FOLD_LIBRARY = "audiodiver:fold-library";

/** Whether About (About.tsx) shows: it opens over any tab, from the ⓘ in the status bar. */
let aboutOpen = false;
const aboutListeners = new Set<() => void>();
const showAbout = (v: boolean) => { aboutOpen = v; aboutListeners.forEach((f) => f()); };
export const about = {
  open: () => { if (!elsewhere?.("about")) showAbout(true); },
  close: () => showAbout(false),
  subscribe(f: () => void) { aboutListeners.add(f); return () => { aboutListeners.delete(f); }; },
};
export const useAboutOpen = () => useSyncExternalStore(about.subscribe, () => aboutOpen);
