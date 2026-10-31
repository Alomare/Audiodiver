import { useSyncExternalStore } from "react";
import { isTauri } from "./api";
import { WIKI_WINDOW } from "./edition";
import { about, nav, type Tab } from "./nav";
import { theme } from "./theme";

/** The Wiki in a window of its own: the same pages opened with `?view=wiki`, which draw only the Wiki (bootWiki.tsx).
    The shell opens and closes that window and says when it is gone (lib.rs); in a browser against the dev servers a
    tab stands in for it. The two talk over a BroadcastChannel, which every page of one origin shares, so a walk runs
    the same code as the desktop app.

    While the Wiki is away, the main window's Wiki tab offers to bring it back, and a page asked for there (a "?", a
    link) goes to the Wiki's window. A link in the Wiki to a tab or to About goes to the main window, and so does Start
    Tutorial, which brings the Wiki back first: a tutorial points at parts of one window. */
type Message = { page: string } | { go: Tab | "about"; sub?: string } | { tutorial: string };

const link = new BroadcastChannel("audiodiver.wiki");
const send = (m: Message) => link.postMessage(m);

async function shell<T>(command: string, args?: Record<string, unknown>) {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}
const bringForward = (label: "main" | "wiki") => { if (isTauri()) shell("bring_forward", { label }).catch(() => {}); };

let away = false; // the main window: the Wiki is in its own window
let tab: Window | null = null; // the browser tab that stands in for that window
const listeners = new Set<() => void>();
const setAway = (next: boolean) => {
  away = next;
  nav.handOver(next ? (place, sub) => {
    if (place !== "wiki" || sub === undefined) return false; // the Wiki tab itself still opens, with its button
    send({ page: sub });
    bringForward("wiki");
    return true;
  } : null);
  listeners.forEach((f) => f());
};
/** The window is gone, whoever closed it. */
const cameBack = () => {
  if (!away) return;
  nav.wikiBack();
  setAway(false);
};

/** Whether the Wiki is in its own window (only the main window asks). */
export const useWikiAway = () => useSyncExternalStore((f) => { listeners.add(f); return () => { listeners.delete(f); }; }, () => away);

/** Moves the Wiki into a window of its own, at the page it is on. */
export async function detachWiki() {
  if (isTauri()) await shell("open_wiki");
  else {
    tab = window.open(`${location.pathname}?view=wiki`, "audiodiver-wiki");
    const id = setInterval(() => { if (!tab || tab.closed) { clearInterval(id); cameBack(); } }, 300);
  }
  setAway(true);
}

/** Brings the Wiki back into its tab. */
export function attachWiki() {
  if (!away) return;
  if (isTauri()) shell("close_wiki").catch(() => {});
  else tab?.close();
  cameBack();
}

let tutorialAsked: (id: string) => void = () => {};
/** What the main window does with Start Tutorial pressed in the Wiki's window. */
export const onTutorialAsked = (start: (id: string) => void) => { tutorialAsked = start; };
/** The Wiki's window: asks the main window to start a tutorial. */
export const askTutorial = (id: string) => send({ tutorial: id });

if (WIKI_WINDOW) {
  nav.handOver((place, sub) => {
    if (place === "wiki") return false;
    send({ go: place, sub });
    return true;
  });
  link.onmessage = ({ data }: MessageEvent<Message>) => { if ("page" in data) nav.go("wiki", data.page); };
  // what Settings changes in the main window: both share the browser storage
  window.addEventListener("storage", ({ key }) => {
    if (key === "audiodiver.theme") theme.reload();
    else if (key === "audiodiver.language" || key === "audiodiver.autoLanguage" || key === "audiodiver.keys") location.reload();
  });
} else {
  link.onmessage = ({ data }: MessageEvent<Message>) => {
    if ("page" in data) return;
    bringForward("main");
    if ("tutorial" in data) tutorialAsked(data.tutorial);
    else if (data.go === "about") about.open();
    else nav.go(data.go, data.sub);
  };
  if (isTauri()) {
    import("@tauri-apps/api/event").then(({ listen }) => listen("wiki-closed", cameBack)).catch(() => {});
    // the main window loads again on a change of language, and the Wiki's window stays open through it
    shell<boolean>("wiki_is_open").then((open) => { if (open) setAway(true); }).catch(() => {});
  }
}
