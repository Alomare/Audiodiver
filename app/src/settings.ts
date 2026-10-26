import { useSyncExternalStore } from "react";
import { HIDEABLE, type Hideable } from "./nav";

/** How the app behaves (Settings ▸ System, and the build switches on the Build tab). Kept per user in
    localStorage, like the theme. Where the game is lives in the core's settings instead (Session.set_game_folder):
    the core needs it before the window has loaded. */
export type TipSpeed = "off" | "quick" | "normal" | "slow";
/** What a new version of Audiodiver does at startup (updates.ts): wait in the Updates tab, ask, or install. */
export type UpdateMode = "manual" | "prompt" | "auto";
/** How a bank's sounds are named and laid out: by what names them, or by container id in the bank's tree. */
export type SoundNames = "names" | "ids";
export type Settings = {
  openLast: boolean;     // open the project you had open last when the app starts
  tips: TipSpeed;        // hover tooltips: off, or how long the pointer rests before one shows
  updates: UpdateMode;   // what a new version of Audiodiver found at startup does
  bumpVersion: boolean;  // raise the mod's version by one after each build
  revealBuild: boolean;  // show the built ZIP in its folder when a build finishes
  tabs: Hideable[];      // the hideable tabs that show (a project can choose its own on the Project tab)
  soundNames: SoundNames; // a bank's sounds by name, or by container id as Wwise tools list them
};

export const DEFAULT_SETTINGS: Settings = { openLast: false, tips: "normal", updates: "prompt", bumpVersion: true, revealBuild: false,
  tabs: [...HIDEABLE], soundNames: "names" };
export const SOUND_NAMES: [SoundNames, string][] = [["names", "Names"], ["ids", "Container ids"]];
/** A list of hideable tabs in the bar's order, or null for anything else. */
export const tabList = (v: unknown): Hideable[] | null =>
  Array.isArray(v) && v.every((t) => (HIDEABLE as readonly unknown[]).includes(t)) ? HIDEABLE.filter((t) => v.includes(t)) : null;
/** How long the pointer rests on something before its tooltip shows, in ms. */
export const TIP_DELAY: Record<Exclude<TipSpeed, "off">, number> = { quick: 150, normal: 500, slow: 1100 };
export const TIP_SPEEDS: [TipSpeed, string][] = [["off", "Off"], ["quick", "Quick"], ["normal", "Normal"], ["slow", "Slow"]];
export const UPDATE_MODES: [UpdateMode, string][] = [["manual", "Manual"], ["prompt", "Prompt on startup"], ["auto", "Automatic"]];
/** What each mode does, under the choice (Settings ▸ System) and at the foot of the Updates tab. */
export const UPDATE_NOTES: Record<UpdateMode, string> = {
  manual: "Checks at startup and lists new versions in the Updates tab.",
  prompt: "At startup, asks before installing a new version.",
  auto: "At startup, installs a new version and restarts.",
};
const KEY = "audiodiver.settings";

function load(): Settings {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (s && typeof s === "object") {
      const flag = (k: "openLast" | "bumpVersion" | "revealBuild") => (typeof s[k] === "boolean" ? s[k] : DEFAULT_SETTINGS[k]);
      return { openLast: flag("openLast"), bumpVersion: flag("bumpVersion"), revealBuild: flag("revealBuild"),
        tips: TIP_SPEEDS.some(([t]) => t === s.tips) ? s.tips : DEFAULT_SETTINGS.tips,
        updates: UPDATE_MODES.some(([m]) => m === s.updates) ? s.updates : DEFAULT_SETTINGS.updates,
        tabs: tabList(s.tabs) ?? DEFAULT_SETTINGS.tabs,
        soundNames: SOUND_NAMES.some(([n]) => n === s.soundNames) ? s.soundNames : DEFAULT_SETTINGS.soundNames };
    }
  } catch { /* storage off or bad value */ }
  return DEFAULT_SETTINGS;
}

let current = load();
const listeners = new Set<() => void>();

export const settings = {
  get: () => current,
  /** Applies a change straight away and remembers it. */
  set(patch: Partial<Settings>) {
    current = { ...current, ...patch };
    try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* storage off */ }
    listeners.forEach((f) => f());
  },
  reset() { settings.set(DEFAULT_SETTINGS); },
  subscribe(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; },
};

export const useSettings = () => useSyncExternalStore(settings.subscribe, settings.get);

/** The panel sizes the user dragged (side panels, the header, the waveforms) go back to their defaults: whoever
    keeps one listens for this. */
export const RESET_LAYOUT = "audiodiver:reset-layout";
/** Every size kept between sessions: cleared too, so a panel that isn't on screen now (the Wiki's list, say) opens
    at its default size next time. */
const LAYOUT_KEYS = ["audiodiver.widths", "audiodiver.headHeight", "audiodiver.textLeft", "audiodiver.waveHeight",
  "audiodiver.waveHeight.libraryFacts", "audiodiver.wikiWidth", "audiodiver.archiveColumnWidths", "audiodiver.soundtrackLeft",
  "audiodiver.soundtrackHead"];
export const resetLayout = () => {
  for (const k of LAYOUT_KEYS) try { localStorage.removeItem(k); } catch { /* storage off */ }
  window.dispatchEvent(new Event(RESET_LAYOUT));
};
