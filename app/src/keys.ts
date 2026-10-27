// Keyboard shortcuts: every command the keyboard can run, the keys it is on (the defaults, or what the user chose
// in Settings ▸ Shortcuts), and the one listener that runs them. Components say what a command does with
// useCommands; texts that name a key ask keyLabel, so they follow a rebinding.
import { useEffect, useRef, useSyncExternalStore } from "react";

export type CommandId =
  | "playPause" | "stop" | "playGame" | "playMine"
  | "selectPrev" | "selectNext" | "chooseFile" | "moveUp" | "moveDown" | "copy" | "paste" | "selectAll" | "remove"
  | "silence"
  | "search" | "back" | "forward"
  | "save" | "undo" | "redo" | "build" | "newProject" | "openProject" | "closeProject"
  | "tabHome" | "tabProject" | "tabLibrary" | "tabEditor" | "tabSoundtrack" | "tabText" | "tabBuild" | "tabTools"
  | "updates" | "wiki" | "tutorials" | "settings" | "shortcuts";

export type Command = {
  id: CommandId; group: string; label: string;
  keys: string[];     // the default chords; the first is the one tooltips and menus show
  inputs?: boolean;   // also runs while typing in a text field (only on a chord with Ctrl or Alt, or an F key)
};

/** In the order Settings ▸ Shortcuts lists them. */
export const COMMANDS: Command[] = [
  { id: "playPause", group: "Playback", label: "Play the selected slot, or pause and resume", keys: ["Space"] },
  { id: "stop", group: "Playback", label: "Stop playback, or clear the selection", keys: ["Escape"] },
  // the ids predate the words: playGame plays the original, playMine the replacement
  { id: "playGame", group: "Playback", label: "Play the original of the selected slot", keys: ["O"] },
  { id: "playMine", group: "Playback", label: "Play the new audio of the selected slot", keys: ["R"] },

  { id: "selectPrev", group: "Slots", label: "Select the previous slot", keys: ["ArrowUp"] },
  { id: "selectNext", group: "Slots", label: "Select the next slot", keys: ["ArrowDown"] },
  { id: "chooseFile", group: "Slots", label: "Choose a file for the selected slot", keys: ["Enter"] },
  { id: "moveUp", group: "Slots", label: "Move the new audio up a slot", keys: ["Alt+ArrowUp"] },
  { id: "moveDown", group: "Slots", label: "Move the new audio down a slot", keys: ["Alt+ArrowDown"] },
  { id: "copy", group: "Slots", label: "Copy the new audio of the selected slots", keys: ["Ctrl+C"] },
  { id: "paste", group: "Slots", label: "Paste into the selection", keys: ["Ctrl+V"] },
  { id: "selectAll", group: "Slots", label: "Select every slot", keys: ["Ctrl+A"] },
  { id: "remove", group: "Slots", label: "Remove the new audio from the selected slots", keys: ["Delete", "Backspace"] },
  { id: "silence", group: "Slots", label: "Replace the selected slots with silence", keys: [] },

  { id: "search", group: "Finding audio", label: "Search", keys: ["/", "Ctrl+F"], inputs: true },
  { id: "back", group: "Finding audio", label: "Back", keys: ["Alt+ArrowLeft"] },
  { id: "forward", group: "Finding audio", label: "Forward", keys: ["Alt+ArrowRight"] },

  { id: "save", group: "Project", label: "Save the project", keys: ["Ctrl+S"], inputs: true },
  { id: "undo", group: "Project", label: "Undo", keys: ["Ctrl+Z"] },
  { id: "redo", group: "Project", label: "Redo", keys: ["Ctrl+Y", "Ctrl+Shift+Z"] },
  { id: "build", group: "Project", label: "Build the mod", keys: ["Ctrl+B"] },
  { id: "newProject", group: "Project", label: "New project", keys: ["Ctrl+N"] },
  { id: "openProject", group: "Project", label: "Open a project", keys: ["Ctrl+O"] },
  { id: "closeProject", group: "Project", label: "Close the project", keys: [] },

  { id: "tabHome", group: "Tabs", label: "Go to Home", keys: ["Ctrl+1"], inputs: true },
  { id: "tabTools", group: "Tabs", label: "Go to Tools", keys: ["Ctrl+2"], inputs: true },
  { id: "tabProject", group: "Tabs", label: "Go to Project", keys: ["Ctrl+3"], inputs: true },
  { id: "tabLibrary", group: "Tabs", label: "Go to the Library", keys: ["Ctrl+4"], inputs: true },
  { id: "tabEditor", group: "Tabs", label: "Go to Audio", keys: ["Ctrl+5"], inputs: true },
  { id: "tabSoundtrack", group: "Tabs", label: "Go to Soundtrack", keys: ["Ctrl+6"], inputs: true },
  { id: "tabText", group: "Tabs", label: "Go to Text", keys: ["Ctrl+7"], inputs: true },
  { id: "tabBuild", group: "Tabs", label: "Go to Build", keys: ["Ctrl+8"], inputs: true },
  { id: "updates", group: "Tabs", label: "Open or close Updates", keys: [], inputs: true },
  { id: "wiki", group: "Tabs", label: "Open or close the Wiki", keys: ["F1"], inputs: true },
  { id: "tutorials", group: "Tabs", label: "Open the tutorials", keys: [], inputs: true },
  { id: "settings", group: "Tabs", label: "Open or close Settings", keys: ["Ctrl+,"], inputs: true },
  { id: "shortcuts", group: "Tabs", label: "Show these shortcuts", keys: ["?"] },
];
const BY_ID = new Map(COMMANDS.map((c) => [c.id, c]));

/** What the mouse and a few fixed keys do: listed with the shortcuts, but not for rebinding. */
export const FIXED: [string, string][] = [
  ["Click ▶", "play, and select the slot"],
  ["Double-click a slot", "play the new audio, or the original if there is none"],
  ["Ctrl+click, Shift+click, a slot's tick", "add a slot to the selection, or select a range"],
  ["Right-click", "every other action"],
  ["Drop files on a piece, a part or a slot in the Audio tab", "fill it, in file-name order"],
  ["Drop files on a place of a playlist in the Soundtrack", "put the songs there and in the places after it"],
  ["Drag a song in a playlist", "move it to another place"],
  ["↑ ↓ then Enter in the search box", "open a match"],
  ["Mouse back / forward", "go back or forward"],
  ["Esc", "close a dialog or a menu"],
];

// ---- chords: "Ctrl+Shift+Z", "Alt+ArrowUp", "Space", "/", "G"

const NOT_A_KEY = new Set(["Control", "Shift", "Alt", "Meta", "AltGraph", "CapsLock", "NumLock", "ScrollLock", "Dead", "Process", "Unidentified", "ContextMenu"]);

/** The chord a key press makes, or null for a modifier on its own. Letters are matched by what the key types on
    the user's layout; a layout without Latin letters falls back to the key's position. */
export function chordOf(e: KeyboardEvent): string | null {
  let k = e.key;
  if (NOT_A_KEY.has(k)) return null;
  const altGr = e.getModifierState?.("AltGraph"); // AltGr types a character; Windows reports it as Ctrl+Alt
  const ctrl = (e.ctrlKey || e.metaKey) && !altGr, alt = e.altKey && !altGr;
  let shift = e.shiftKey;
  if (k === " ") k = "Space";
  else if (k.length === 1) {
    if (!/^[a-z]$/i.test(k) && /^Key[A-Z]$/.test(e.code) && k.toLowerCase() !== k.toUpperCase()) k = e.code.slice(3);
    if (k.toLowerCase() !== k.toUpperCase()) k = k.toUpperCase(); // a letter: Shift stays a modifier
    else shift = false;                                           // a symbol or digit: Shift is how it is typed
  }
  return `${ctrl ? "Ctrl+" : ""}${alt ? "Alt+" : ""}${shift ? "Shift+" : ""}${k}`;
}

const KEY_NAMES: Record<string, string> = {
  ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→", Escape: "Esc", Delete: "Del", PageUp: "Page Up",
  PageDown: "Page Down", Insert: "Ins",
};
/** A chord as shown to the user: "Alt+↑", "Esc", "Ctrl+Z". */
export function fmtChord(chord: string) {
  const mods = /^(?:(?:Ctrl|Alt|Shift)\+)*/.exec(chord)![0];
  const key = chord.slice(mods.length);
  return mods + (KEY_NAMES[key] ?? key);
}
const plain = (chord: string) => !/^(Ctrl|Alt)\+/.test(chord) && !/^(Shift\+)?F\d{1,2}$/.test(chord);

// ---- the keymap: the defaults, with the user's changes on top

export type Keymap = Record<CommandId, string[]>;
const KEY = "audiodiver.keys";

function load(): Partial<Keymap> {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    if (saved && saved.tabPackage && !saved.tabBuild) saved.tabBuild = saved.tabPackage; // Package became Build in 0.3
    const out: Partial<Keymap> = {};
    for (const c of COMMANDS) {
      const v = saved?.[c.id];
      if (Array.isArray(v) && v.every((x) => typeof x === "string")) out[c.id] = v;
    }
    return out;
  } catch { return {}; }
}

let changed: Partial<Keymap> = load(); // only the commands the user rebound, so new defaults reach the others
let map: Keymap, byChord: Map<string, CommandId>;
const listeners = new Set<() => void>();

const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** A chord runs one command. The user's choices claim theirs first; defaults get what is left, so a default added
    in a later version never takes a key the user gave to something else. */
function rebuild() {
  const m = {} as Keymap;
  byChord = new Map();
  for (const pass of [true, false]) {
    for (const c of COMMANDS) {
      if (!!changed[c.id] !== pass) continue;
      m[c.id] = (changed[c.id] ?? c.keys).filter((chord) => !byChord.has(chord));
      for (const chord of m[c.id]) byChord.set(chord, c.id);
    }
  }
  map = m;
}
rebuild();

function commit() {
  for (const c of COMMANDS) if (changed[c.id] && same(changed[c.id]!, c.keys)) delete changed[c.id]; // no longer a change
  rebuild();
  try { localStorage.setItem(KEY, JSON.stringify(changed)); } catch { /* storage off */ }
  listeners.forEach((f) => f());
}

export const keymap = {
  get: () => map,
  command: (id: CommandId) => BY_ID.get(id)!,
  /** The command a chord runs, if any. */
  owner: (chord: string) => byChord.get(chord) ?? null,
  /** Puts a command on a chord, in place of `replacing` (one of its chords) or as one more. A chord belongs to one
      command: it is taken from the command that had it, and that command's id is returned. */
  bind(id: CommandId, chord: string, replacing?: string): CommandId | null {
    const from = byChord.get(chord) ?? null;
    if (from && from !== id) changed[from] = map[from].filter((c) => c !== chord);
    const mine = map[id].filter((c) => c !== chord);
    const at = replacing ? mine.indexOf(replacing) : -1;
    if (at >= 0) mine[at] = chord; else mine.push(chord);
    changed[id] = mine;
    commit();
    return from !== id ? from : null;
  },
  unbind(id: CommandId, chord: string) { changed[id] = map[id].filter((c) => c !== chord); commit(); },
  /** Back to the default keys. A default key that another command got meanwhile is taken back from it; those
      commands are returned. */
  reset(id: CommandId): CommandId[] {
    const lost = new Set<CommandId>();
    for (const chord of BY_ID.get(id)!.keys) {
      const o = byChord.get(chord);
      if (o && o !== id) { changed[o] = (changed[o] ?? map[o]).filter((c) => c !== chord); lost.add(o); }
    }
    delete changed[id];
    commit();
    return [...lost];
  },
  resetAll() { changed = {}; commit(); },
  isDefault: (id: CommandId) => same(map[id], BY_ID.get(id)!.keys),
  allDefault: () => COMMANDS.every((c) => same(map[c.id], c.keys)),
  subscribe(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; },
};

/** Re-renders when a shortcut changes. */
export const useKeymap = () => useSyncExternalStore(keymap.subscribe, keymap.get);
/** The key a command is on, as shown to the user ("Ctrl+Z"), or "" when it has none. */
export const keyLabel = (id: CommandId) => (map[id][0] ? fmtChord(map[id][0]) : "");
/** " (Ctrl+Z)", or "" when the command has no key: for sentences that mention one in passing. */
export const keyHint = (id: CommandId) => (map[id][0] ? ` (${fmtChord(map[id][0])})` : "");

// ---- running commands

/** What a command does here. Return false when it does not apply now (nothing selected, another tab): the next
    handler gets its turn, and if none takes it the key keeps its normal meaning. */
export type Handler = (e: KeyboardEvent) => boolean | void;
type Registered = { fn: Handler; priority: number };
const handlers = new Map<CommandId, Registered[]>();

function register(id: CommandId, h: Registered) {
  const list = handlers.get(id) ?? [];
  list.push(h);
  list.sort((a, b) => b.priority - a.priority);
  handlers.set(id, list);
  return () => { const l = handlers.get(id); if (l) handlers.set(id, l.filter((x) => x !== h)); };
}

/** Runs these while the component is mounted. A higher priority goes first (the slot list before the app). */
export function useCommands(commands: Partial<Record<CommandId, Handler>>, priority = 0) {
  const latest = useRef(commands);
  latest.current = commands;
  const ids = Object.keys(commands).sort().join(",");
  useEffect(() => {
    const off = (ids ? (ids.split(",") as CommandId[]) : []).map((id) =>
      register(id, { priority, fn: (e) => { const f = latest.current[id]; return f ? f(e) : false; } }));
    return () => off.forEach((f) => f());
  }, [ids, priority]);
}

let capturing = false;

function onKey(e: KeyboardEvent) {
  if (capturing || e.defaultPrevented || e.isComposing) return;
  const chord = chordOf(e);
  const id = chord ? byChord.get(chord) : undefined;
  if (!chord || !id) return;
  const t = e.target instanceof Element ? e.target : document.body;
  // a dialog or a menu is open: it has its own keys
  // a dialog or a menu is open, and on screen (one left in a hidden tab's panel doesn't count): it has its own keys
  if ([...document.querySelectorAll(".modal-back")].some((m) => m.getClientRects().length) || t.closest("[role=menu]")) return;
  // a field being typed in keeps its keys; a checkbox keeps Space and Enter, a slider its arrows, Home and End, and
  // every other key does what it does anywhere (Ctrl+Z right after moving the gain slider undoes the move)
  const field = t.closest("input, textarea, select, [contenteditable=true]");
  const kind = field instanceof HTMLInputElement ? field.type : "";
  if (kind === "checkbox" || kind === "radio" || kind === "range") {
    // its plain keys are its own (Space ticks, arrows slide; Delete must not remove a slot's audio): only Esc, and
    // Space on a slider (play and pause), go on
    if (plain(chord) && e.key !== "Escape" && !(kind === "range" && e.key === " ")) return;
  } else if (field && (!BY_ID.get(id)!.inputs || plain(chord))) return;
  for (const h of handlers.get(id) ?? []) {
    if (h.fn(e) !== false) { e.preventDefault(); return; }
  }
}
window.addEventListener("keydown", onKey);

/** Waits for the next key press and gives its chord, for rebinding. Esc, Tab, a click or leaving the window cancel
    (null). Nothing else sees the keys meanwhile. */
export function captureChord(): { chord: Promise<string | null>; cancel: () => void } {
  let done: (chord: string | null) => void = () => {};
  const chord = new Promise<string | null>((resolve) => { done = resolve; });
  const finish = (c: string | null) => {
    capturing = false;
    window.removeEventListener("keydown", key, true);
    window.removeEventListener("pointerdown", away, true);
    window.removeEventListener("blur", away);
    done(c);
  };
  const key = (e: KeyboardEvent) => {
    e.preventDefault(); e.stopPropagation();
    const c = chordOf(e);
    if (!c) return; // a modifier on its own: keep waiting
    finish(c === "Escape" || c === "Tab" || c === "Shift+Tab" ? null : c);
  };
  const away = () => finish(null);
  capturing = true;
  window.addEventListener("keydown", key, true);
  window.addEventListener("pointerdown", away, true);
  window.addEventListener("blur", away);
  return { chord, cancel: () => finish(null) };
}
