import { createContext, use, useCallback, useContext, useEffect, useMemo, useRef, useState, type Context, type ReactNode } from "react";
import { t, plural } from "@lingui/core/macro";
import { andList, call, fmtNumber, type ArchiveRow, type Assignment, type Cue, type Index, type Job, type MusicItem, type Piece, type Place as Found, type ProjectState, type Status } from "./api";
import { confirm } from "./Confirm";
import { importAsk } from "./importAsk";
import { liveGain } from "./gain";
import { keyLabel } from "./keys";
import { indexItems } from "./music";
import { FOLD_LIBRARY, HIDEABLE, nav as tabs, type Hideable } from "./nav";
import { follow, noticeLog, type Go } from "./noticeLog";
import { notes } from "./noteStore";
import { UTILS } from "./edition";
import * as platform from "./platform";
import { player, type PlayedAt } from "./player";
import { coreLanguage, followAuto } from "./i18n";
import { settings, useSettings } from "./settings";
import { motionMs } from "./theme";

/** A notice's button: what it does now (run), or where it leads (go), which the notifications log keeps too. */
export type NoticeAction = { label: string; run?: () => void; go?: Go };
export const actOn = (a: NoticeAction) => (a.run ? a.run() : a.go && follow(a.go));
export type Notice = {
  id: number; tone: "info" | "good" | "bad"; text: string; action?: NoticeAction; sticky?: boolean;
  leaving?: boolean;  // on its way out (animating)
  title?: string; open?: Go; hint?: string; // an announcement (announce): a title, where a click anywhere on it leads,
                                            // and a line that says so (not in the notifications log)
};
/** A quick note: one short line that confirms what was just done ("**Loadout Selection** added to **My Mod**",
    "**My Mod** saved"), shown for a moment at the bottom of the window. `**words**` are drawn bold. A new one takes
    the place of the last, so quick actions in a row never pile up. Notices are for what needs reading or a button. */
export type Toast = { id: number; text: string; icon: ToastIcon; leaving?: boolean };
export type ToastIcon = "done" | "add" | "save" | "copy" | "undo" | "info";
const TOAST_MS = 1800;
/** Two answers about a job that show the same: its card counts whole seconds, so a tick within the same second with
    no other change draws nothing. */
const sameJob = (a: Job | undefined, b: Job) => !!a && a.state === b.state && a.done === b.done && a.total === b.total
  && a.doing === b.doing && a.error === b.error && a.result === b.result && a.log.length === b.log.length
  && a.log[a.log.length - 1] === b.log[b.log.length - 1] && Math.round(a.seconds) === Math.round(b.seconds);

const RECENT_KEY = "audiodiver.recent";
const RECENT_MAX = 10;
const LAST_KEY = "audiodiver.last"; // where you were, per tab: reopened at the next launch
const removing = new Set<string>(); // slots whose new audio is being removed (unassign)
function recentProjects(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(list) ? list.filter((p) => typeof p === "string") : [];
  } catch { return []; }
}
function saveRecent(list: string[]) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch { /* storage off */ }
}

/** Plain words for the core's edit labels: "Undo fill", "Undone: move". */
export const EDIT_NAMES: Record<string, string> = {
  assign: t({ message: "assign", comment: "Edit in Undo, Redo and History: new audio chosen for a slot" }),
  fill: t({ message: "fill", comment: "Edit in Undo, Redo and History: slots filled with several files at once" }),
  unassign: t({ message: "remove", comment: "Edit in Undo, Redo and History: new audio removed from slots" }),
  update: t({ message: "change", comment: "Edit in Undo, Redo and History: the settings of a slot changed" }),
  gain: t`Make-Up Gain`,
  match: t({ message: "match loudness", comment: "Edit in Undo, Redo and History: Make-Up Gain set so the new audio is as loud as the original" }),
  skip: t({ message: "skip", comment: "Edit in Undo, Redo and History: transitions or stingers skipped" }),
  silence: t({ message: "silence", comment: "Edit in Undo, Redo and History: slots replaced with silence" }),
  paste: t({ message: "paste", comment: "Edit in Undo, Redo and History: copied audio pasted into slots" }),
  move: t({ message: "move", comment: "Edit in Undo, Redo and History: audio moved or swapped between two slots" }),
  segment: t({ message: "cue points", comment: "Edit in Undo, Redo and History: the cue points of music segments changed" }),
  settings: t({ message: "mod details", comment: "Edit in Undo, Redo and History: the name, version or other details of the mod changed" }),
  import: t({ message: "import", comment: "Edit in Undo, Redo and History: a mod imported into the project" }),
  add: t({ message: "add to the project", comment: "Edit in Undo, Redo and History" }),
  unlist: t({ message: "remove from the project", comment: "Edit in Undo, Redo and History" }),
  text: t({ message: "text change", comment: "Edit in Undo, Redo and History: a line of game text changed" }),
  "add take": t({ message: "new takes", comment: "Edit in Undo, Redo and History: new takes added to a sound" }),
  "add layer": t({ message: "new layer", comment: "Edit in Undo, Redo and History: a layer added beside a sound" }),
  "own clip": t({ message: "only this sound", comment: "Edit in Undo, Redo and History: the new audio of a slot set to play only in this sound" }),
  "shared clip": t({ message: "every sound that plays it", comment: "Edit in Undo, Redo and History: the new audio of a slot set to play in every sound that plays the clip" }),
  note: t({ message: "note", comment: "Edit in Undo, Redo and History: a note written in the project" }),
  collect: t({ message: "collect files", comment: "Edit in Undo, Redo and History: files copied into the project folder" }),
  tabs: t({ message: "tabs", comment: "Edit in Undo, Redo and History: the tabs the project shows changed" }),
  song: t({ message: "song", comment: "Edit in Undo, Redo and History: a song set for a piece of music" }),
  playlist: t({ message: "playlist", comment: "Edit in Undo, Redo and History: the songs of a playlist changed" }),
  soundtrack: t({ message: "soundtrack", comment: "Edit in Undo, Redo and History: how pieces of music play changed" }),
  level: t({ message: "level", comment: "Edit in Undo, Redo and History: the volume of a piece of music changed" }),
  "leave out": t({ message: "leave out", comment: "Edit in Undo, Redo and History: a song left out of the original music" }),
  "put back": t({ message: "put back", comment: "Edit in Undo, Redo and History: a song put back into the original music" }),
  shuffle: t({ message: "shuffle", comment: "Edit in Undo, Redo and History: shuffle turned on or off for a playlist" }),
  resume: t({ message: "playlist order", comment: "Edit in Undo, Redo and History: whether a playlist goes on where it stopped" }),
  Original: t`Original`, "One Song": t`One Song`, Playlist: t`Playlist`, Silent: t`Silent`, "Same as Battle": t`Same as Battle`,
  "Battle Songs": t`Battle Songs`, "Quiet Exploring": t`Quiet Exploring`, "No Openings": t`No Openings`,
  "Original soundtrack": t`Original soundtrack`,
};

/** "a.wav, b.wav and 3 more". */
function listNames(names: string[], shown = 3) {
  const xs = names.slice(0, shown), more = names.length - xs.length;
  return andList(more ? [...xs, t({ message: plural(more, { one: "# more", other: "# more" }), comment: "The end of a list of file names: a.wav, b.wav and 3 more" })] : xs);
}
/** "Undo (Ctrl+Z)": the command and its key, to name in a sentence. */
const undoHint = () => { const key = keyLabel("undo"); return key ? t`Undo (${key})` : t`Undo`; };
/** A number the core rounds to one decimal (2 or 12.5 MB, -3.5 dB), written the way the language writes it. */
const fmtTenth = (n: number) => fmtNumber(n, n % 1 ? 1 : 0);

/** Asks before new audio leaves slots (a new take goes with its audio). True to go ahead. */
function confirmRemoval(mine: Assignment[], p: ProjectState) {
  const n = mine.length, silence = mine.every((x) => x.silence);
  const takes = mine.filter((x) => p.additions.some((a) => a.kind === "take" && a.source === x.target)).length;
  const files = [...new Set(mine.filter((x) => !x.silence).map((x) => x.name))];
  const title = silence ? (takes === n ? t`Remove the silence?` : plural(n, { 1: "Remove the silence?", other: "Remove the silence from # slots?" }))
    : takes === n ? plural(n, { 1: "Remove the new take?", other: "Remove the new takes?" })
    : plural(n, { 1: "Remove the new audio?", other: "Remove the new audio from # slots?" });
  const after = takes === n ? plural(n, { 1: "The take is removed from the sound.", other: "The takes are removed from their sounds." })
    : silence ? plural(n, { 1: "This slot plays the original again.", other: "These slots play the original again." })
    : plural(n, { 1: "This slot plays the original again.", other: "These # slots play the original again." });
  const file = files[0], list = listNames(files), undo = undoHint();
  const kept = !files.length ? "" : files.length === 1 ? t`The file ${file} stays on disk.` : t`The files (${list}) stay on disk.`;
  return confirm({
    title,
    text: [after, kept, plural(n, { 1: `${undo} brings it back.`, other: `${undo} brings them back.` })].filter(Boolean).join(" "),
    ok: t`Remove`, cancel: t({ message: "Keep", comment: "The answer to a question that asks before removing: don't remove" }),
  });
}

/** What opening a project put right in its file (said once, when it opens; the file is fixed by its next save). */
const repairNote = (p: ProjectState) => {
  const name = p.name, fields = andList(p.repairs);
  return t`Some values in ${name} were damaged and reset to defaults (${fields}).`;
};

/** A job stopped by Cancel, in a sentence for each kind of job (any other kind is an export). */
const jobCancelled = (kind: string) => ({
  build: t`Build cancelled`, import: t`Import cancelled`, repatch: t`Repatch cancelled`,
  pack: t({ message: "Pack cancelled", comment: "Packing the project and the files it uses into one .audipack file" }),
  unpack: t`Unpack cancelled`, check: t({ message: "Check cancelled", comment: "Checking the installed mods for sound banks of an older game version" }),
  combine_read: t`Conflict check cancelled`, combine: t`Combine cancelled`,
} as Record<string, string>)[kind] ?? t`Export cancelled`;
/** A job that failed, and why (the core's words), in a sentence for each kind of job (any other kind is an export). */
const jobFailure = (kind: string, why: string) => ({
  build: t`Build failed: ${why}`, import: t`Import failed: ${why}`, repatch: t`Repatch failed: ${why}`,
  pack: t({ message: `Pack failed: ${why}`, comment: "Packing the project and the files it uses into one .audipack file" }),
  unpack: t`Unpack failed: ${why}`, check: t({ message: `Check failed: ${why}`, comment: "Checking the installed mods for sound banks of an older game version" }),
  combine_read: t`Conflict check failed: ${why}`, combine: t`Combine failed: ${why}`,
} as Record<string, string>)[kind] ?? t`Export failed: ${why}`;

/** The two tabs that show audio. The Library is everything the game has, to hear and to add to a project; the
    Editor is what the open project lists, to replace. Each keeps its own open place, selection and history. */
export type ScopeName = "library" | "editor";
type Place = { itemId: string | null; cueId: string };
type Saved = Place & { project?: string };

function lastPlace(scope: ScopeName): Saved | null {
  try {
    const p = JSON.parse(localStorage.getItem(`${LAST_KEY}.${scope}`) ?? "null");
    return p && typeof p.cueId === "string" ? p : null;
  } catch { return null; }
}

/** One tab's browsing: what is open in it, what is selected there, and where it has been (back and forward). */
function useBrowse(scope: ScopeName, deps: {
  notify: (tone: Notice["tone"], text: string) => void;
  resolveItem: (id: string) => Promise<MusicItem | null>;
  gameRev: number;                 // bumps when the game was read again: what is open is fetched again
  projectPath: () => string | null;
  added?: string;                  // the Editor: the audio the project adds, as a key (a bank is fetched again with it)
}) {
  const { notify, resolveItem, gameRev, projectPath, added = "" } = deps;
  const [place, setPlace] = useState<Place | null>(null);
  // the cue that shows, the item it was opened as a part of, and the read of the game (and of added audio) it came from
  const [loaded, setLoaded] = useState<{ cue: Cue; itemId: string | null; rev: string } | null>(null);
  const last = useRef(loaded);
  last.current = loaded;
  const [slow, setSlow] = useState(false); // the open cue is taking a while to come: stop showing the last one
  const [selected, setSelected] = useState<string[]>([]);
  const cueId = place?.cueId ?? null;
  const ids = useSettings().soundNames === "ids"; // a bank's sounds by container id, as its tree

  // the cue follows what is open (and is fetched again after the game data is). A big bank takes a second or two
  // the first time, so the one that showed before stays for a moment, then gives way to a note that says so.
  useEffect(() => {
    if (!place) { setLoaded(null); setSlow(false); return; }
    const { cueId: id, itemId } = place;
    const bank = id.startsWith("bank:");
    const rev = `${gameRev}|${bank ? added : ""}|${bank && ids ? "ids" : ""}`;
    if (last.current?.cue.id === id && last.current.rev === rev) { // the same cue, reached another way
      if (last.current.itemId !== itemId) setLoaded({ ...last.current, itemId });
      return;
    }
    let live = true;
    const t = setTimeout(() => { if (live) setSlow(true); }, 180);
    call<Cue>("cue", { id, mine: scope === "editor", ...(bank && ids ? { ids } : {}) })
      .then((c) => { if (live) { setLoaded({ cue: c, itemId, rev }); setSlow(false); } })
      .catch((e) => { if (live) { setPlace(null); setSlow(false); notify("bad", e.message); } }) // nothing to show: nothing is open
      .finally(() => clearTimeout(t));
    return () => { live = false; clearTimeout(t); };
  }, [place, notify, gameRev, added, scope, ids]);
  const loading = !!place && loaded?.cue.id !== place.cueId;
  const cue = loading && slow ? null : loaded?.cue ?? null;
  /** The item the cue that shows was opened as a part of. While the next one loads that is still the last one's. */
  const shownItemId = loading ? loaded?.itemId ?? null : place?.itemId ?? null;

  // back and forward through what was opened here
  const hist = useRef<{ list: Place[]; at: number }>({ list: [], at: -1 });
  const [nav, setNav] = useState({ back: false, forward: false });
  const lastPart = useRef(new Map<string, number>()); // item -> the part that was open
  const go = useCallback((next: Place, push: boolean) => {
    setPlace(next);
    const h = hist.current;
    if (push) {
      const cur = h.list[h.at];
      if (!cur || cur.itemId !== next.itemId || cur.cueId !== next.cueId) {
        h.list = [...h.list.slice(0, h.at + 1), next].slice(-100);
        h.at = h.list.length - 1;
      }
    }
    setNav({ back: h.at > 0, forward: h.at < h.list.length - 1 });
    try { localStorage.setItem(`${LAST_KEY}.${scope}`, JSON.stringify({ ...next, project: projectPath() ?? undefined })); } catch { /* storage off */ }
  }, [scope, projectPath]);

  /** Opens a cue on its own: one sound outside everything the project lists. */
  const openCue = useCallback((id: string, select?: string) => {
    go({ itemId: null, cueId: id }, true);
    setSelected(select ? [select] : []);
  }, [go]);
  /** Opens an item at one of its parts: the one given (by number or by its cue), else the one that was open last,
      else the first. `select` selects a slot in it. False when there is no such item. */
  const openItem = useCallback(async (id: string, part?: number | string | null, select?: string | null) => {
    const it = await resolveItem(id);
    if (!it || !it.parts.length) return false;
    const want = typeof part === "string" ? it.parts.findIndex((p) => p.cue === part) : part ?? -1;
    const i = Math.max(0, Math.min(want >= 0 ? want : lastPart.current.get(id) ?? 0, it.parts.length - 1));
    lastPart.current.set(id, i);
    go({ itemId: id, cueId: it.parts[i].cue }, true);
    setSelected(select ? [select] : []);
    return true;
  }, [resolveItem, go]);
  /** Shows nothing: the project closed, or what was open left it. History goes with it. */
  const close = useCallback(() => {
    setPlace(null); setSelected([]);
    hist.current = { list: [], at: -1 };
    setNav({ back: false, forward: false });
  }, []);
  const step = useCallback((d: -1 | 1) => {
    const h = hist.current;
    const next = h.list[h.at + d];
    if (!next) return;
    h.at += d;
    go(next, false);
    setSelected([]);
    if (scope === "library" && next.itemId) tabs.go("library", next.itemId.startsWith("archive:") ? "archives" : "index");
  }, [go, scope]);
  const back = useCallback(() => step(-1), [step]);
  const forward = useCallback(() => step(1), [step]);

  // what is open and what is selected, apart: a key press that selects the next slot changes only the selection
  const open = useMemo(() => ({ itemId: place?.itemId ?? null, cueId, cue, shownItemId, loading, openCue, openItem, close, back, forward,
    nav }), [place, cueId, cue, shownItemId, loading, openCue, openItem, close, back, forward, nav]);
  const selection = useMemo(() => ({ selected, setSelected }), [selected]);
  return { open, selection };
}
type Open = ReturnType<typeof useBrowse>["open"];
type Selection = ReturnType<typeof useBrowse>["selection"];
/** One tab's browsing, all of it. */
type Browse = Open & Selection;

function useEditorState() {
  const [status, setStatus] = useState<Status | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [index, setIndex] = useState<Index | null>(null);
  const [archives, setArchives] = useState<ArchiveRow[]>([]);
  const [archiveItems, setArchiveItems] = useState<Record<string, MusicItem>>({}); // archives as items, fetched as needed
  const itemIndex = useMemo(() => indexItems(index, archiveItems), [index, archiveItems]);
  const [project, setProject] = useState<ProjectState | null>(null);
  // the player plays a slot at its Make-Up Gain, as the mod does: the new audio at its own, the original at the gain on
  // it while the slot has no new audio, and a value being set at once. The Library plays the game's audio as it is.
  useEffect(() => {
    const apply = () => player.setGains((key, at) => {
      const [kind, source] = key.split(":");
      if (!project || at?.scope === "library" || (kind !== "vanilla" && kind !== "project")) return 0;
      const a = project.assignments[source], live = liveGain.get(source);
      if (kind === "project") return a && !a.silence ? live ?? a.gain_db : 0;
      return a ? 0 : live ?? project.gains[source] ?? 0;
    });
    apply();
    return liveGain.subscribe(apply);
  }, [project]);
  // the projects opened lately, newest first: the Home tab's list. Opening one puts it back on top, also after it
  // was taken off the list by hand.
  const [recent, setRecent] = useState<string[]>(recentProjects);
  /** Puts a project on top of the recent list; `replacing`: the path it had before a move, which leaves the list. */
  const remember = useCallback((path: string, replacing?: string) => {
    setRecent((list) => {
      const next = [path, ...list.filter((p) => p !== path && p !== replacing)].slice(0, RECENT_MAX);
      saveRecent(next);
      return next;
    });
  }, []);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [jobs, setJobs] = useState<Record<string, Job>>({});
  const [revision, setRevision] = useState(0); // bumps when assigned audio changes (preview cache-busting)
  const [clip, setClip] = useState<string[]>([]); // slots whose audio Ctrl+C copied, in play order
  const clipAt = useRef(-1); // the clipboard's change count then: files copied in Explorer since paste instead
  const nextId = useRef(1);
  const editSeq = useRef(0); // counts edits, so an Undo button only undoes the edit it was shown for

  /** Takes a notice away, after a short exit animation when animations play. */
  const dismiss = useCallback((id: number) => {
    setNotices((n) => n.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
    setTimeout(() => setNotices((n) => n.filter((x) => x.id !== id)), motionMs(160));
  }, []);
  /** Shows a notice, and keeps it in the notifications log (the status bar). Sticky ones stay until dismissed: a
      failed job must not vanish while nobody is looking. */
  const notify = useCallback((tone: Notice["tone"], text: string, action?: Notice["action"], sticky = false) => {
    const id = nextId.current++;
    // the same words again (a button pressed twice) take the place of the notice already saying them
    setNotices((n) => [...n.filter((x) => x.text !== text || x.leaving).slice(-3), { id, tone, text, action, sticky }]);
    noticeLog.add(tone, text, action?.go, action?.label);
    if (!sticky) setTimeout(() => dismiss(id), action ? 12000 : tone === "bad" ? 9000 : 4500);
  }, [dismiss]);
  /** An announcement: a notice in the primary colour with a title, which a click anywhere on it follows to `open`
      (the offer of the interactive tutorials at the first start); `hint` says where it leads, and `label` names it
      in the notifications log. It stays until clicked or dismissed. */
  const announce = useCallback((title: string, text: string, open: Go, hint: string, label: string) => {
    const id = nextId.current++;
    setNotices((n) => [...n.slice(-3), { id, tone: "info", text, title, open, hint, sticky: true }]);
    noticeLog.add("info", `${title}: ${text}`, open, label);
  }, []);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimers = useRef<number[]>([]);
  /** Shows a quick note (see Toast), in place of the one showing. */
  const quick = useCallback((text: string, icon: ToastIcon = "done") => {
    toastTimers.current.forEach(clearTimeout);
    const id = nextId.current++;
    setToast({ id, text, icon });
    toastTimers.current = [
      window.setTimeout(() => setToast((t) => (t?.id === id ? { ...t, leaving: true } : t)), TOAST_MS),
      window.setTimeout(() => setToast((t) => (t?.id === id ? null : t)), TOAST_MS + motionMs(160)),
    ];
  }, []);
  const logPath = useRef("");
  /** A job failed: say so until dismissed, with a way to the core's log. */
  const jobFailed = useCallback((j: Job) => {
    notify("bad", jobFailure(j.kind, j.error ?? ""), logPath.current ? { label: t`Open Log`, go: { reveal: logPath.current } } : undefined, true);
  }, [notify]);

  /** Runs an API call; errors become notices instead of exceptions. These calls (edits, mostly) go to the core one at
      a time, in the order they were made. The core answers each request on a thread of its own, so of two edits on
      their way at once, the earlier one could land last and win: quick taps on a slider lost a step that way. */
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const run = useCallback(<T,>(method: string, args: Record<string, unknown> = {}): Promise<T | undefined> => {
    const answer = queue.current.then(async () => {
      try { return await call<T>(method, args); } catch (e: any) { notify("bad", e.message ?? String(e)); return undefined; }
    });
    queue.current = answer;
    return answer;
  }, [notify]);

  const projectPath = useRef<string | null>(null);
  const coreRevision = useRef(-1); // the core's count of changes to what is open, as last applied
  const audioSig = useRef("");     // what plays in each slot, as last applied: `revision` moves when it changes
  const applyProject = useCallback((p: ProjectState | null | undefined) => {
    if (p === undefined) return;
    if ((p?.path ?? null) !== projectPath.current) { // copied slots belong to one project
      projectPath.current = p?.path ?? null;
      setClip([]);
    }
    // a change since a notice was shown (an edit, an undo, another project) makes its Undo refuse; a no-op doesn't
    const rev = p ? p.revision : -1;
    const changed = rev !== coreRevision.current;
    if (changed) { coreRevision.current = rev; editSeq.current++; }
    setProject(p);
    notes.setProject(p?.notes);
    if (!UTILS) { tabs.setProject(!!p); tabs.setShown(p?.tabs ?? settings.get().tabs); } // before any tab opens for it
    // previews and waveforms are fetched again only when the audio itself may have changed: another file, silence,
    // the icon, or files chosen again (they may have been rewritten on disk: a song cut again). A gain or a cue point
    // keeps them.
    const sig = p ? JSON.stringify([Object.entries(p.assignments).map(([s, a]) => [s, a.audio, a.silence, a.exists, a.duration_ms]), p.icon]) : "";
    if (sig !== audioSig.current || (changed && ["assign", "fill", "import", "song", "playlist"].includes(p?.undo_label ?? ""))) {
      audioSig.current = sig;
      setRevision((r) => r + 1);
    }
  }, []);
  // autosave on a timer (Settings ▸ System): the core keeps edits in memory and says so (project.unsaved), and they
  // are saved once the first of them has waited the minutes set. Ctrl+S, a build and closing save them sooner.
  const autosave = useSettings().autosave;
  const connected = status !== null;
  useEffect(() => { if (!UTILS && connected) call("autosave", { minutes: autosave }).catch(() => {}); }, [autosave, connected]);
  const unsaved = !!project?.unsaved;
  useEffect(() => {
    if (!unsaved || !autosave) return;
    const t = window.setTimeout(() => { run<ProjectState>("project_save").then(applyProject); }, autosave * 60_000);
    return () => clearTimeout(t);
  }, [unsaved, autosave, project?.path, run, applyProject]);
  /** applyProject for an edit; true when the core took it (it may have changed nothing). */
  const edited = useCallback((p: ProjectState | null | undefined) => {
    if (!p) return false;
    applyProject(p);
    return true;
  }, [applyProject]);
  const undoRef = useRef<() => void>(() => {});
  /** A notice for an edit, with an Undo button that only works while nothing else has changed since. */
  const editNotice = useCallback((tone: Notice["tone"], text: string) => {
    const seq = editSeq.current;
    notify(tone, text, {
      label: t`Undo`, run: () => {
        if (editSeq.current === seq) undoRef.current();
        else { const undo = undoHint(); notify("info", t`There are newer changes. ${undo} steps back one change at a time.`); }
      },
    });
  }, [notify]);

  // --- startup, and again when the game is read from another folder: wait for the core and the game data. The app
  // opens on Home; with "Open the last project at startup" on (Settings ▸ System) it reopens that project and goes
  // straight to the Editor. A second read keeps the tab and the project as they were.
  const resume = useRef<(j: Job) => void>(() => {}); // follows a job the core is running (set below, by watchJob)
  // a project or pack opened in Explorer while the window runs: the shell hands its path over. Until startup is done
  // (the core loading, the launch file and the last project opening) it waits, then opens with the newest actions.
  const openFile = useRef<(path: string) => Promise<unknown>>(async () => {});
  const started = useRef(false);
  const waiting = useRef<string[]>([]);
  useEffect(() => {
    let off = () => {}, gone = false;
    platform.onOpenFile((path) => { if (started.current) openFile.current(path); else waiting.current.push(path); })
      .then((f) => { if (gone) f(); else off = f; });
    return () => { gone = true; off(); };
  }, []);
  const [boot, setBoot] = useState(0);        // counts the times the game data is read
  const [gameRev, setGameRev] = useState(0);  // bumps when it has been read again (what is open is fetched again)
  const firstBoot = useRef(true);
  const toldLanguage = useRef(false);
  useEffect(() => {
    let stop = false;
    (async () => {
      while (!stop) {
        try {
          const s = await call<Status>("status");
          if (stop) return; // cancelled meanwhile (React runs effects twice in development)
          // the core speaks the window's language (and starts in it next time), told before anything is fetched: a
          // new language makes it name the sounds again, so the status is read again after (not "ready" meanwhile)
          if (!toldLanguage.current) {
            toldLanguage.current = true;
            try { await call("set_language", { language: coreLanguage() }); } catch { /* it keeps the language it started in */ }
            continue;
          }
          setStatus(s); setConnectError(null); logPath.current = s.log ?? "";
          // Automatic follows the game's language once the core has found the game (or failed to)
          if (s.stage !== "starting" && s.languages) followAuto(s.languages.game, s.languages.system);
          if (s.stage === "ready") {
            const [ix, all] = await Promise.all([call<Index>("index"), call<ArchiveRow[]>("archives")]);
            if (stop) return;
            setIndex(ix); setArchives(all);
            if (!firstBoot.current) { setArchiveItems({}); pending.current.clear(); applyProject(s.project); setGameRev((r) => r + 1); return; }
            firstBoot.current = false;
            for (const j of s.jobs ?? []) resume.current(j); // a build or export still running: the window reloaded
            // a project or pack opened in Explorer (a double-click): it wins over the last one
            const launched = UTILS ? null : await platform.launchFile();
            if (stop) return;
            if (launched) {
              try {
                if (/\.audipack$/i.test(launched)) {
                  const job = await call<Job>("pack_open", { path: launched });
                  if (!stop) resume.current(job); // its end unpacks the project, says where, and opens it
                } else {
                  const p = await call<ProjectState>("project_open", { path: launched });
                  if (stop) return;
                  applyProject(p); remember(p.path); tabs.go(tabs.work());
                  if (p.repairs.length) notify("info", repairNote(p), undefined, true);
                }
              } catch (e: any) {
                if (!stop) notify("bad", String(e?.message ?? e), undefined, true);
              }
            } else if (s.project) { applyProject(s.project); tabs.go(tabs.work()); } // the core kept it open (the window reloaded)
            else if (!UTILS && settings.get().openLast) {
              const last = recentProjects()[0];
              if (last) {
                try {
                  const p = await call<ProjectState>("project_open", { path: last });
                  if (stop) return;
                  applyProject(p);
                  tabs.go(tabs.work());
                  const name = p.name;
                  quick(t`**${name}** opened`, "info");
                  // sticky, these two: at startup the update question may be over them
                  if (p.repairs.length) notify("info", repairNote(p), undefined, true);
                } catch (e: any) { // moved, deleted or damaged: start on Home, and say why
                  const name = last.split(/[\\/]/).pop() ?? last;
                  const why = String(e.message ?? t`it wasn't found`).replace(last, name);
                  if (!stop) notify("info", t`The last project didn't open: ${why}`, undefined, true);
                }
              }
            }
            started.current = true; // files opened in Explorer meanwhile open now, in turn
            for (const path of waiting.current.splice(0)) await openFile.current(path);
            return;
          }
          if (s.stage === "failed") return;
        } catch (e: any) { setConnectError(e.message ?? String(e)); }
        await new Promise((r) => setTimeout(r, 700));
      }
    })();
    return () => { stop = true; };
  }, [quick, notify, boot, applyProject, remember]);

  // --- coming back to the window (from Explorer, say) looks at the project's files again: one deleted or renamed
  // meanwhile is a problem on the Build tab at once, not at the next edit
  useEffect(() => {
    const again = () => {
      if (document.hidden || !projectPath.current) return;
      call<ProjectState>("project").then((p) => { if (p && p.path === projectPath.current) applyProject(p); }).catch(() => {});
    };
    window.addEventListener("focus", again);
    document.addEventListener("visibilitychange", again);
    return () => { window.removeEventListener("focus", again); document.removeEventListener("visibilitychange", again); };
  }, [applyProject]);

  // --- items by id: the Index's are at hand; an archive's is asked for once and kept
  const idx = useRef(itemIndex);
  idx.current = itemIndex;
  const pending = useRef(new Map<string, Promise<MusicItem | null>>());
  const resolveItem = useCallback(async (id: string): Promise<MusicItem | null> => {
    const known = idx.current.items.get(id);
    if (known) return known;
    if (!id.startsWith("archive:")) return null;
    if (!pending.current.has(id)) {
      pending.current.set(id, call<MusicItem>("item", { id }).then((it) => {
        setArchiveItems((all) => ({ ...all, [id]: it }));
        return it;
      }, () => { pending.current.delete(id); return null; }));
    }
    return pending.current.get(id)!;
  }, []);
  // the archives a project lists are items the Editor shows: have them at hand
  useEffect(() => {
    for (const id of project?.library ?? []) if (id.startsWith("archive:") && !archiveItems[id]) resolveItem(id);
  }, [project?.library, archiveItems, resolveItem]);

  // --- the two tabs that browse
  const getProjectPath = useCallback(() => projectPath.current, []);
  const lib = useBrowse("library", { notify, resolveItem, gameRev, projectPath: getProjectPath });
  const added = useMemo(() => JSON.stringify(project?.additions ?? []), [project?.additions]);
  const ed = useBrowse("editor", { notify, resolveItem, gameRev, projectPath: getProjectPath, added });
  const browseRef = useRef({ library: lib, editor: ed });
  browseRef.current = { library: lib, editor: ed };
  /** Each tab's browsing as it is when asked, for actions and handlers. It keeps one identity, so the shared state
      doesn't change when something is selected or opened (the contexts below carry that). */
  const scopes = useMemo(() => {
    const now = (s: ScopeName): Browse => ({ ...browseRef.current[s].open, ...browseRef.current[s].selection });
    return { get library() { return now("library"); }, get editor() { return now("editor"); } } as Record<ScopeName, Browse>;
  }, []);

  /** Goes to where something is: the tab, the item and part, the slot. `at.cueId` alone opens that cue on its own. */
  const goTo = useCallback(async (at: PlayedAt & { scope: ScopeName }) => { // the Soundtrack's own: openInSoundtrack
    const s = scopes[at.scope];
    tabs.go(at.scope, at.scope === "library" && at.itemId ? (at.itemId.startsWith("archive:") ? "archives" : "index") : undefined);
    if (at.itemId) return s.openItem(at.itemId, at.cueId, at.source);
    if (at.cueId) s.openCue(at.cueId, at.source ?? undefined);
    return !!at.cueId;
  }, [scopes]);
  /** Opens what `find` found, in a tab. */
  const openFound = useCallback((scope: ScopeName, f: Found) => goTo({ scope, itemId: f.item, cueId: f.cue, source: f.source }), [goTo]);

  // the Library reopens where it was, once the Index is known
  const restored = useRef(false);
  useEffect(() => {
    if (!index || restored.current) return;
    restored.current = true;
    const last = lastPlace("library");
    if (last?.itemId) scopes.library.openItem(last.itemId, last.cueId);
  }, [index, scopes]);
  // the Editor shows what the open project lists, and nothing else: it reopens where it was in that project, and
  // lets go of what leaves the list. What it let go of comes back when an Undo puts it back on the list while
  // nothing else has opened.
  const editorFor = useRef<string | null>(null);
  const letGo = useRef<{ itemId: string; cueId: string | null } | null>(null);
  useEffect(() => {
    const e = scopes.editor;
    const path = project?.path ?? null;
    if (path !== editorFor.current) {
      editorFor.current = path;
      letGo.current = null;
      e.close();
      const last = lastPlace("editor");
      if (path && last?.project === path && last.itemId && project!.library.includes(last.itemId)) e.openItem(last.itemId, last.cueId);
      return;
    }
    if (!project) return;
    if (!e.itemId && !e.cueId) {
      const back = letGo.current;
      if (back && project.library.includes(back.itemId)) { letGo.current = null; e.openItem(back.itemId, back.cueId); }
      return;
    }
    const listed = e.itemId ? project.library.includes(e.itemId) : project.outside.includes(e.cueId!.replace(/^sfx:/, ""));
    letGo.current = listed || !e.itemId ? null : { itemId: e.itemId, cueId: e.cueId };
    if (!listed) e.close();
  }, [project, ed.open.itemId, ed.open.cueId, scopes]);

  // --- jobs (build, import): poll until done
  const madeByImport = useRef(new Set<string>()); // imports that make a new project: it opens when they end
  const watchJob = useCallback((job: Job, onDone: (j: Job) => void) => {
    setJobs((js) => ({ ...js, [job.id]: job }));
    let misses = 0;
    const tick = async () => {
      const j = await call<Job>("job", { id: job.id }).catch(() => null);
      if (!j) { // one missed answer must not end the watch silently
        if (++misses < 20) setTimeout(tick, 1000);
        else onDone({ ...job, state: "failed", error: t`lost contact with the Audiodiver core` });
        return;
      }
      misses = 0;
      // the same answer again keeps the state as it is: a new object would draw everything that reads useEditor()
      setJobs((js) => (sameJob(js[j.id], j) ? js : { ...js, [j.id]: j }));
      if (j.state === "running") setTimeout(tick, 500);
      else onDone(j);
    };
    setTimeout(tick, 400);
  }, []);

  /** What a job's end says, whichever way it ended: also for a job a reloaded window picked up again. Every end
      fetches the project again, so its version, its problems and what an import brought in show at once. */
  const finishJob = useCallback(async (j: Job) => {
    const refresh = async () => applyProject(await run<ProjectState>("project"));
    if (j.state === "cancelled") quick(jobCancelled(j.kind), "info");
    else if (j.state !== "done") jobFailed(j);
    else if (j.kind === "check" || j.kind === "combine_read") {
      // the Repatch and Combine Mods pages show what it found
    } else if (j.kind === "build") {
      const file = j.result.zip.split(/[\\/]/).pop(), mb = fmtTenth(j.result.mb);
      notify("good", t`Built ${file} (${mb} MB).`,
        { label: t`Show in Folder`, go: { reveal: j.result.zip } });
      if (settings.get().revealBuild) platform.reveal(j.result.zip).catch(() => {});
    } else if (j.kind === "repatch" || j.kind === "combine") { // the Repatch and Combine Mods pages show the rest
      const zip: string = j.result.zip;
      const title = j.title, file = zip.split(/[\\/]/).pop()!, mb = fmtTenth(j.result.mb);
      notify("good", j.kind === "repatch" ? t`Repatched ${title}: ${file} (${mb} MB).` : t`Combined ${title}: ${file} (${mb} MB).`,
        { label: t`Show in Folder`, go: { reveal: zip } });
      if (settings.get().revealBuild) platform.reveal(zip).catch(() => {});
    } else if (j.kind === "import") {
      // replacements, what the mod adds (new takes, layers, sounds with a clip of their own) and the lines of text;
      // what can't come in is said, and then the notice waits to be read (a heading, then one line each). A new
      // project made from a mod is open in the core by now: it joins the recent projects and shows its audio
      const r = j.result, left: string[] = [...(r.left ?? []), ...(r.others ?? [])];
      if (madeByImport.current.delete(j.id)) {
        const p = await run<ProjectState>("project");
        if (p) {
          applyProject(p); remember(p.path);
          tabs.go(r.imported || r.added || r.gains ? "editor" : r.texts ? "text" : "project");
        }
      }
      const { imported, added, gains, texts, skipped, stale, older } = r, objects = r.settings, mod = j.title;
      const brought = [imported ? plural(imported, { one: "# replaced sound", other: "# replaced sounds" }) : "",
        added ? plural(added, { one: "# added sound", other: "# added sounds" }) : "",
        gains ? t`Make-Up Gain on ${plural(gains, { one: "# sound", other: "# sounds" })}` : "",
        objects ? t`Settings on ${plural(objects, { one: "# sound or container", other: "# sounds and containers" })}` : "",
        texts ? plural(texts, { one: "# line of text", other: "# lines of text" }) : ""].filter(Boolean);
      const lines = [
        brought.length ? (mod ? t`Imported from ${mod}:` : t`Imported from the mod:`)
          : mod ? t`Imported nothing from ${mod}.` : t`Imported nothing from the mod.`,
        ...brought,
        skipped ? t`${plural(skipped, { one: "# sound", other: "# sounds" })} couldn't be decoded` : "",
        // sounds the patch still had from an older game version: not the mod's, so not imported (Wiki: Repatching)
        stale ? t`Left out: ${plural(stale, { one: "# sound", other: "# sounds" })} from an older game version` : "",
        // the game's objects as the patch's older copies had them: the current ones stay (Wiki: Repatching)
        older ? t`Kept current: ${plural(older, { one: "# sound object", other: "# sound objects" })} the patch had from an older game version` : "",
        ...left.map((item) => t`Left out: ${item}`),
      ].filter(Boolean);
      const why = r.stale ? "repatching#sounds-from-an-older-game-version"
        : r.older ? "repatching#shared-settings-from-an-older-game-version" : "";
      notify("good", lines.join("\n"), why ? { label: t`Why?`, go: { tab: "wiki", sub: why } } : undefined,
        left.length > 0 || r.stale > 0 || r.older > 0);
    } else if (j.kind === "pack") {
      const r = j.result, pack = r.pack.split(/[\\/]/).pop(), mb = fmtTenth(r.mb);
      const { missing, files } = r;
      const missed = missing ? " " + plural(missing, { one: "# file the project uses was not found.", other: "# files the project uses were not found." }) : "";
      notify("good", t`Packed ${plural(files, { one: "# file", other: "# files" })} into ${pack} (${mb} MB).` + missed,
        { label: t`Show in Folder`, go: { reveal: r.pack } }, r.missing > 0); // files left out: it waits to be read
    } else if (j.kind === "unpack") {
      // the pack's project, in a new folder where new projects go: it opens where it landed
      const p = await run<ProjectState>("project_open", { path: j.result.project });
      if (p) { applyProject(p); remember(p.path); tabs.go(tabs.work()); }
      const folder = j.result.folder;
      notify("good", t`Unpacked into ${folder}.`, { label: t`Show in Folder`, go: { reveal: j.result.folder } });
      if (p?.repairs.length) notify("info", repairNote(p), undefined, true);
    } else {
      // the export list's slots that have no audio in the game's files: why fewer files came out than it counts
      const { absent, files } = j.result, title = j.title;
      const noAudio = absent ? " " + plural(absent, { one: "# slot on it has no audio in the game files.", other: "# slots on it have no audio in the game files." }) : "";
      notify("good", t`Exported ${plural(files, { one: "# file", other: "# files" })} of ${title}.` + noAudio,
        { label: t`Show in Folder`, go: { reveal: j.result.first } }, true);
    }
    if (j.kind === "build" || j.kind === "import") await refresh();
  }, [applyProject, run, quick, jobFailed, notify, remember]);
  resume.current = (j: Job) => watchJob(j, finishJob);

  /** Unpacks a .audipack: the core makes a folder for it where new projects go, and its end opens the project. */
  const openPack = useCallback(async (path: string) => {
    const job = await run<Job>("pack_open", { path });
    if (job) watchJob(job, finishJob);
  }, [run, watchJob, finishJob]);

  const needProject = useCallback(() => {
    if (project) return true;
    notify("info", t`Open or create a project first.`, { label: t`Home`, go: { tab: "home" } });
    return false;
  }, [project, notify]);

  /** How many slots an edit gave new audio. */
  const changed = (after: ProjectState) => Object.entries(after.assignments).filter(([s, x]) => project?.assignments[s]?.audio !== x.audio).length;
  const fitNote = (files: number, placed: number) => {
    const left = files - placed;
    return left > 0 ? " " + t`${plural(left, { one: "# file", other: "# files" })} left over, because there are no free slots.` : "";
  };

  const actions = useMemo(() => ({
    async newProject() {
      // new projects get a folder of their own in the projects folder (Settings keeps the last one used)
      const folder = await call<string>("projects_folder").catch(() => "");
      const stem = t({ message: "My mod", comment: "The file name offered for a new project, without the extension" });
      const path = await platform.pickProjectToCreate(`${stem}.audi`, folder);
      if (!path) return;
      const name = path.split(/[\\/]/).pop()!.replace(/\.audi$/i, "");
      const from = tabs.get().tab;
      // it shows the tabs Settings ▸ System shows now, and keeps that choice
      const p = await run<ProjectState>("project_new", { path, name, tabs: settings.get().tabs });
      if (p) {
        applyProject(p); remember(p.path);
        window.dispatchEvent(new Event(FOLD_LIBRARY)); // the Library starts folded for it
        if (tabs.get().tab === from) tabs.go("project");
        const name = p.name; // the name the core gave it
        quick(t`**${name}** created`, "add");
      }
    },
    /** A new project at a path, in a folder of its own, without a dialog (a tutorial's practice project), showing
        every tab. Null, and nothing said, when the core refuses it (one of that name is there), so the caller can
        try another name. */
    async newProjectAt(path: string, name: string) {
      const p = await call<ProjectState>("project_new", { path, name, tabs: [...HIDEABLE] }).catch(() => null);
      if (!p) return null;
      applyProject(p); remember(p.path);
      window.dispatchEvent(new Event(FOLD_LIBRARY));
      return p;
    },
    /** Writes the project file now. Edits save themselves; Ctrl+S also commits a field being typed in (the Project
        tab's name, a line on the Text tab), which saves when it loses focus. */
    async save() {
      if (!project) { quick(t`No project open`, "info"); return; }
      const field = document.activeElement as HTMLElement | null;
      if (field?.matches("input, textarea")) { field.blur(); field.focus(); }
      await new Promise((r) => setTimeout(r)); // the field's own save (on blur) goes first, then this one
      const p = await run<ProjectState>("project_save");
      if (p) { applyProject(p); const name = p.name; quick(t`**${name}** saved`, "save"); } // the name just typed, not the one before
    },
    /** Opens a project (asking which, without a path) and shows it in the Editor. A .audipack unpacks first. */
    async openProject(path?: string) {
      path ??= (await platform.pickProjectToOpen(project?.path ?? recentProjects()[0])) ?? undefined;
      if (!path) return;
      if (/\.audipack$/i.test(path)) return openPack(path);
      const p = await run<ProjectState>("project_open", { path });
      if (p) {
        applyProject(p); remember(p.path); tabs.go(tabs.work());
        if (p.repairs.length) notify("info", repairNote(p), undefined, true); // a list to read: it waits for its ✕
      }
    },
    /** Writes the open project's note on a thing (Notes.tsx); "" removes it. One step of Undo. True when the core
        took it. */
    async setNote(key: string, text: string) {
      const r = await run<{ project: ProjectState | null }>("note_set", { key, project_text: text });
      if (!r) return false;
      if (r.project) applyProject(r.project);
      return true;
    },
    async closeProject() {
      if (!project) return;
      await run("project_close");
      applyProject(null);
      const name = project.name;
      quick(t`**${name}** closed`, "info");
    },
    /** A .audipack unpacks into a new folder, and the project it holds opens (see openPack above). */
    openPack,
    /** Moves the project into a new folder beside its file (Project tab). The recent list follows its new path. */
    async moveToOwnFolder() {
      if (!project) return;
      const old = project.path;
      const p = await run<ProjectState>("project_move");
      if (!p) return;
      applyProject(p);
      remember(p.path, old);
      const name = p.name;
      quick(t`**${name}** moved into a new folder`);
    },
    /** Moves the project's folder into another folder (Project tab, Move project). The recent list follows its new
        path. */
    async moveProject(folder: string) {
      if (!project) return;
      const old = project.path;
      const r = await run<ProjectState & { old_left: boolean }>("project_move_to", { folder });
      if (!r) return;
      const { old_left, ...p } = r;
      applyProject(p);
      remember(p.path, old);
      const name = p.name;
      if (old_left) notify("info", t`${name} moved. Some files stayed in the old folder because they were in use. The project no longer uses them.`, undefined, true);
      else quick(t`**${name}** moved`);
    },
    /** Copies the files the project uses from outside its folder into audio\added (Project tab). */
    async collectFiles() {
      const r = await run<ProjectState & { collected: number }>("collect_files");
      if (!r) return;
      const { collected, ...p } = r;
      edited(p);
      if (collected) editNotice("good", t`Copied ${plural(collected, { one: "# file", other: "# files" })} into the project folder.`);
      else quick(t`Nothing to copy`, "info");
    },
    /** Writes the project and the files it uses as one .audipack file (Project tab), named as the project file is. */
    async exportPack() {
      if (!project) return;
      const parent = project.folder.replace(/[\\/][^\\/]*$/, "");
      const stem = project.path.split(/[\\/]/).pop()!.replace(/\.audi$/i, "");
      const dest = await platform.pickPackToSave(`${stem}.audipack`, parent || project.folder);
      if (!dest) return;
      const job = await run<Job>("pack_export", { dest });
      if (job) watchJob(job, finishJob);
    },
    /** Takes a project off the Home tab's list. The file is left alone; opening it again lists it again. */
    forgetRecent(path: string) {
      setRecent((list) => { const next = list.filter((p) => p !== path); saveRecent(next); return next; });
    },
    /** Adds Index items or archives to the project: from then on the Editor shows them. `what` names them. A bank is
        never listed twice: the core leaves out what the list has already and says so (`notes`), in a notice to read.
        True when they are all on the list now. */
    async addToProject(ids: string[], what: string) {
      if (!needProject()) return false;
      const fresh = ids.filter((id) => !project!.library.includes(id));
      if (!fresh.length) return true;
      const p = await run<ProjectState & { notes?: string[] }>("library_add", { items: fresh });
      if (!edited(p)) return false;
      if (p!.notes?.length) notify("info", p!.notes.join(" "));
      else { const name = project!.name; quick(t`**${what}** added to **${name}**`, "add"); }
      return fresh.every((id) => p!.library.includes(id));
    },
    /** Takes items off the project's list, and with them the new audio in their slots. Without any audio lost it is
        a quick note; with audio, a notice with Undo. */
    async removeFromProject(ids: string[], what: string) {
      if (!project) return;
      const before = Object.keys(project.assignments).length;
      // what goes with them: the new audio in their slots (the core's preview of the same removal)
      const losing = await run<{ slots: number; files: string[] }>("library_remove_preview", { items: ids });
      if (!losing) return;
      // the slots going, with it (one item) or them, and the files in brackets when there are any
      const slots = losing.slots, list = listNames(losing.files), undo = undoHint();
      const going = ids.length === 1
        ? (list ? plural(slots, { one: `# slot with new audio goes with it (${list}).`, other: `# slots with new audio go with it (${list}).` })
          : plural(slots, { one: "# slot with new audio goes with it.", other: "# slots with new audio go with it." }))
        : list ? plural(slots, { one: `# slot with new audio goes with them (${list}).`, other: `# slots with new audio go with them (${list}).` })
        : plural(slots, { one: "# slot with new audio goes with them.", other: "# slots with new audio go with them." });
      if (slots && !(await confirm({
        title: t`Remove ${what} from the project?`,
        text: going + " " + t`The audio files stay on disk, and ${undo} brings everything back.`,
        ok: t`Remove`, cancel: t({ message: "Keep", comment: "The answer to a question that asks before removing: don't remove" }),
      }))) return;
      const p = await run<ProjectState>("library_remove", { items: ids });
      if (!p || !edited(p)) return;
      const gone = before - Object.keys(p.assignments).length;
      if (gone) editNotice("info", t`Removed ${what} from the project, along with the new audio in ${plural(gone, { one: "# slot", other: "# slots" })}.`);
      else { const name = project.name; quick(t`**${what}** removed from **${name}**`, "undo"); }
    },
    /** Uses an image file as the mod's icon (asking which, without a path). */
    async setIcon(path?: string) {
      if (!needProject()) return;
      path ??= (await platform.pickImage(project?.folder)) ?? undefined;
      if (path) edited(await run<ProjectState>("set_icon", { image: path }));
    },
    async assign(source: string, files: string[]) {
      if (!needProject()) return;
      const audio = files.filter((f) => !/\.(patch_\d+|audi)$/i.test(f));
      if (!audio.length) return;
      const cue = scopes.editor.cueId; // read now: actions don't change when another cue opens
      if (audio.length > 1 && cue) {
        const p = await run<ProjectState>("fill", { cue, files: audio, start_source: source });
        if (p && edited(p)) {
          const n = changed(p);
          editNotice("good", t`Filled ${plural(n, { one: "# slot", other: "# slots" })} from here on, in file-name order.` + fitNote(audio.length, n));
        }
      } else edited(await run<ProjectState>("assign", { source, audio: audio[0] }));
    },
    async fill(cue: string, files: string[], onlyEmpty = false) {
      if (!needProject()) return;
      const p = await run<ProjectState>("fill", { cue, files, only_empty: onlyEmpty });
      if (p && edited(p)) {
        const n = changed(p);
        editNotice("good", t`Filled ${plural(n, { one: "# slot", other: "# slots" })} in play order, by file name.` + fitNote(files.length, n));
      }
    },
    /** Fills the given slots in order: a whole piece of music with several parts at once. */
    async fillSources(sources: string[], files: string[], what: string) {
      if (!needProject() || !files.length) return;
      const p = await run<ProjectState>("fill_sources", { sources, files });
      if (p && edited(p)) {
        const n = changed(p);
        editNotice("good", t`Filled ${plural(n, { one: "# slot", other: "# slots" })} across ${what}, by file name.` + fitNote(files.length, n));
      }
    },
    /** One file into every one of these slots (several selected slots, the details panel's Choose a file for all). */
    async assignAll(sources: string[], file: string) {
      if (!needProject() || !sources.length) return;
      const p = await run<ProjectState>("fill_sources", { sources, files: sources.map(() => file) });
      if (p && edited(p)) {
        const name = file.split(/[\\/]/).pop()!, slots = sources.length;
        quick(t`**${name}** in ${plural(slots, { one: "# slot", other: "# slots" })}`);
      }
    },
    async unassign(sources: string[]) {
      // asked again before the core's answer took the row away (the dialog gives the focus back to ✕: Enter twice)
      if (sources.some((s) => removing.has(s))) return;
      const mine = sources.flatMap((s) => project?.assignments[s] ?? []);
      const n = mine.length;
      sources.forEach((s) => removing.add(s));
      try {
        if (n && !(await confirmRemoval(mine, project!))) return;
        if (edited(await run<ProjectState>("unassign", { sources })) && n)
          editNotice("info", mine.every((x) => x.silence) ? t`Removed the silence from ${plural(n, { one: "# slot", other: "# slots" })}.`
            : t`Removed the new audio from ${plural(n, { one: "# slot", other: "# slots" })}.`);
      } finally {
        sources.forEach((s) => removing.delete(s));
      }
    },
    /** Makes transitions or stingers play a short silence, so the game moves straight on. `what` names them. */
    async skip(sources: string[], what: string) {
      if (!needProject() || !sources.length) return;
      if (edited(await run<ProjectState>("skip", { sources }))) quick(t`**${what}** skipped`);
    },
    /** Replaces slots with the built-in silence. keepTiming (Keep original duration, on by default): they stay silent
        for as long as the original would play; otherwise the game moves straight on, as Skip does. */
    async silence(sources: string[], keepTiming = true, named?: string) {
      if (!needProject() || !sources.length) return;
      const slots = sources.length, what = named ?? plural(slots, { one: "# slot", other: "# slots" });
      if (edited(await run<ProjectState>("silence", { sources, keep_timing: keepTiming }))) quick(t`**${what}** replaced with silence`);
    },
    /** Remembers the audio of these slots for pasting (the slots without new audio are left out). */
    copySlots(sources: string[]) {
      const mine = sources.filter((s) => project?.assignments[s]);
      if (!mine.length) { quick(t`Nothing to copy. These slots aren't replaced`, "info"); return; }
      setClip(mine);
      platform.clipboardAudio().then((c) => { clipAt.current = c.seq; });
      const paste = keyLabel("paste"), slots = mine.length;
      quick(paste ? t`Copied ${plural(slots, { one: "# slot", other: "# slots" })} · ${paste} pastes`
        : t`Copied ${plural(slots, { one: "# slot", other: "# slots" })}`, "copy");
    },
    /** Pastes what was copied last: audio files copied in Explorer go into `selection` (one file into every slot,
        several in file-name order; one slot fills on from there), slots copied in the app go into `targets` (one
        copied slot into every target, several in order). */
    async pasteSlots(targets: string[], selection: string[] = targets) {
      if (!needProject()) return;
      const os = await platform.clipboardAudio();
      if (os.audio.length && (!clip.length || os.seq !== clipAt.current)) {
        if (!selection.length) return;
        if (selection.length === 1) return actions.assign(selection[0], os.audio);
        const files = os.audio.length === 1 ? selection.map(() => os.audio[0]) : os.audio;
        const p = await run<ProjectState>("fill_sources", { sources: selection, files });
        if (p && edited(p)) {
          const copied = os.audio.length, slots = changed(p);
          quick(copied === 1 ? t`Pasted into ${plural(slots, { one: "# slot", other: "# slots" })}`
            : t`Pasted ${plural(copied, { one: "# file", other: "# files" })} into ${plural(slots, { one: "# slot", other: "# slots" })}`);
        }
        return;
      }
      if (!clip.length) { quick(t`Nothing to paste. Copy audio files or replaced slots first`, "info"); return; }
      if (!targets.length) return;
      const pairs = clip.length === 1 ? targets.map((t) => [clip[0], t]) : clip.slice(0, targets.length).map((c, i) => [c, targets[i]]);
      const slots = pairs.length;
      if (edited(await run<ProjectState>("copy_audio", { pairs }))) quick(t`Pasted into ${plural(slots, { one: "# slot", other: "# slots" })}`);
    },
    /** New takes for a sound the game picks takes from (or for a layer), one per file in file-name order, asking
        which files without them. `what` names the sound. The first new take is selected. */
    async addTakes(container: string, what: string, files?: string[]) {
      if (!needProject()) return;
      files ??= (await platform.pickAudio(true)) ?? [];
      const audio = files.filter((f) => !/\.(patch_\d+|audi)$/i.test(f));
      if (!audio.length) return;
      const p = await run<ProjectState & { sources: string[] }>("add_takes", { container, files: audio });
      if (p && edited(p)) {
        scopes.editor.setSelected(p.sources.slice(0, 1));
        const takes = p.sources.length;
        quick(t`${plural(takes, { one: "# new take", other: "# new takes" })} for **${what}**`, "add");
      }
    },
    /** A layer beside a sound, with a take per file: it plays whenever that sound plays. */
    async addLayer(beside: string, what: string, files?: string[]) {
      if (!needProject()) return;
      files ??= (await platform.pickAudio(true)) ?? [];
      const audio = files.filter((f) => !/\.(patch_\d+|audi)$/i.test(f));
      if (!audio.length) return;
      const p = await run<ProjectState & { sources: string[] }>("add_layer", { beside, files: audio });
      if (p && edited(p)) {
        scopes.editor.setSelected(p.sources.slice(0, 1));
        quick(t`New layer on **${what}**`, "add");
      }
    },
    /** The slot's new audio plays only in this sound (a clip of its own), or again in every sound that plays the
        clip. The slot it moves to stays selected. */
    async onlyThisSound(source: string, sound: string | undefined, only: boolean) {
      const p = await run<ProjectState & { source: string }>(only ? "own_clip" : "shared_clip", only ? { source, sound } : { source });
      if (p && edited(p)) scopes.editor.setSelected([p.source]);
    },
    /** Swaps the audio of two slots (or moves it into an empty one). */
    async swap(a: string, b: string) {
      if (!needProject()) return false;
      return edited(await run<ProjectState>("swap", { a, b }));
    },
    async update(source: string, fields: Record<string, unknown>) {
      edited(await run<ProjectState>("update", { source, ...fields }));
    },
    async updateMany(sources: string[], fields: Record<string, unknown>) {
      edited(await run<ProjectState>("update_many", { sources, ...fields }));
    },
    /** Make-Up Gain on the original audio of slots without new audio; 0 takes it off. */
    async originalGain(sources: string[], gain_db: number) {
      edited(await run<ProjectState>("original_gain", { sources, gain_db }));
    },
    /** Make-Up Gain that makes the new audio of each slot as loud as its original (core loudness.py). */
    async matchLoudness(sources: string[]) {
      const st = await run<ProjectState & { matched?: Record<string, number> }>("match_loudness", { sources });
      if (!edited(st)) return;
      const got = Object.values(st!.matched ?? {});
      const matched = got.length, total = sources.length;
      const gain = matched === 1 ? `${got[0] > 0 ? "+" : ""}${fmtTenth(got[0])}` : "";
      quick(matched === 1 ? t`Make-Up Gain set to **${gain} dB**`
        : matched < total ? t`Make-Up Gain set on ${plural(matched, { one: "# slot", other: "# slots" })} of ${total}`
        : t`Make-Up Gain set on ${plural(matched, { one: "# slot", other: "# slots" })}`);
    },
    async settings(fields: Record<string, unknown>) { edited(await run<ProjectState>("settings", fields)); },
    /** A new mod id: a mod manager then sees the next build as another mod. Undo puts the old id back. */
    async newModId() {
      if (edited(await run<ProjectState>("settings", { guid: "new" }))) editNotice("info", t`New mod ID created. Mod managers install the next build as a separate mod.`);
    },
    /** A mod id typed or pasted, such as the one in a manifest made for the mod before. True when the core took it. */
    async setModId(guid: string) {
      const ok = edited(await run<ProjectState>("settings", { guid }));
      if (ok) editNotice("info", t`Mod ID changed. Mod managers treat the next build as an update to the mod with this ID.`);
      return ok;
    },
    /** The project as it is on disk now (a file deleted meanwhile becomes a problem); quiet when it can't be asked. */
    async refresh() {
      if (!project) return;
      try { applyProject(await call<ProjectState>("project")); } catch { /* the next edit says it */ }
    },
    /** Changes a line of the game's text (the Text tab); the game's own text back takes it off the project. */
    /** Changes a line; resolves the project as the core has it after this change (null when it was refused). */
    async setText(table: string, id: number, text: string): Promise<ProjectState | null> {
      if (!needProject()) return null;
      const p = await run<ProjectState>("text_set", { table, id, text });
      return edited(p) ? p! : null;
    },
    async revertText(lines: { table: string; id: number }[]) {
      if (!needProject()) return false;
      return edited(await run<ProjectState>("text_revert", { lines }));
    },
    async segmentOverride(segment: string, entry: number | null, exit: number | null) {
      edited(await run<ProjectState>("segment_override", { segment, entry_marker: entry, exit_marker: exit }));
    },
    /** Cue points on several segments: a key given is set (a number) or taken off (null) on every one, a key left
        out stays as each segment has it. */
    async segmentOverrides(segments: string[], cues: { entry_marker?: number | null; exit_marker?: number | null }) {
      edited(await run<ProjectState>("segment_overrides", { segments, ...cues }));
    },
    /** The segment's cue points (or none) on every other segment that plays the file replacing `source`. */
    async sameCuePoints(segment: string, source: string) {
      const p = await run<ProjectState & { segments: number }>("same_cue_points", { segment, source });
      if (edited(p)) {
        const segments = p!.segments;
        quick(segments ? t`Cue points set in ${plural(segments, { one: "# more segment", other: "# more segments" })}`
          : t`The other segments have these cue points already`, segments ? "done" : "info");
      }
    },
    /** Cuts one song at boundsMs and assigns the pieces to `sources`, in order; true when it worked. */
    async sliceFill(cue: string, audio: string, boundsMs: number[], sources: string[]) {
      if (!needProject()) return false;
      const p = await run<ProjectState>("slice_fill", { cue, audio, bounds_ms: boundsMs, sources });
      if (!edited(p)) return false;
      const pieces = boundsMs.length - 1;
      editNotice("good", t`Sliced into ${plural(pieces, { one: "# piece", other: "# pieces" })}, filled in play order.`);
      return true;
    },
    /** Sets how pieces of music play (null: as the game plays them), as one undo step; `done` confirms it. */
    async soundtrackSet(pieces: Record<string, Piece | null>, label: string, done?: string) {
      if (!needProject()) return false;
      if (!edited(await run<ProjectState>("soundtrack_set", { pieces, label }))) return false;
      if (done) quick(done);
      return true;
    },
    /** A song cut into a piece of music's segments, played from the first every time the music starts. */
    async songFill(cue: string, audio: string, boundsMs: number[], segments: string[]) {
      if (!needProject()) return false;
      if (!edited(await run<ProjectState>("song_fill", { cue, audio, bounds_ms: boundsMs, segments }))) return false;
      const pieces = boundsMs.length - 1;
      editNotice("good", t`Cut into ${plural(pieces, { one: "# piece", other: "# pieces" })}.`);
      return true;
    },
    /** A playlist's songs place by place (core playlist_set): each place empty (null), a new file, or the song at
        another place now (`keep`). `done` confirms it. */
    async playlistSet(cue: string, places: ({ file: string } | { keep: number } | null)[], done?: string, options: { shuffle?: boolean; resume?: boolean } = {}) {
      if (!needProject()) return false;
      if (!edited(await run<ProjectState>("playlist_set", { cue, places, ...options }))) return false;
      if (done) quick(done);
      return true;
    },
    /** Sets other music as this one is set (core soundtrack_copy): `to` maps each to what it follows (Same as Battle)
        or null. `what` names them for the note. */
    async soundtrackCopy(cue: string, to: Record<string, string | null>, what: string) {
      if (!needProject()) return false;
      const p = await run<ProjectState & { short: string[] }>("soundtrack_copy", { cue, to });
      if (!edited(p)) return false;
      const short = p!.short.length;
      if (short) editNotice("info", t`Copied to ${what}. ${plural(short, { one: "# of them has", other: "# of them have" })} fewer places, so the last songs or pieces were left out there.`);
      else editNotice("good", t`Copied to ${what}.`);
      return true;
    },
    async undo() {
      if (!project) return;
      const p = await run<ProjectState>("undo"); // after any save still on its way: that is what it undoes
      if (!p) return;
      const did = p.revision !== coreRevision.current;
      applyProject(p);
      const name = EDIT_NAMES[p.redo_label ?? ""];
      quick(!did ? t`Nothing to undo` : name ? t`Undone: ${name}` : t`Undone: the last change`, did ? "undo" : "info");
    },
    async redo() {
      if (!project) return;
      const p = await run<ProjectState>("redo");
      if (!p) return;
      const did = p.revision !== coreRevision.current;
      applyProject(p);
      const name = EDIT_NAMES[p.undo_label ?? ""];
      quick(!did ? t`Nothing to redo` : name ? t`Redone: ${name}` : t`Redone: the change`, did ? "undo" : "info");
    },
    /** Undoes (steps below 0) or redoes that many changes at once: the History list going to one of them. */
    async historyGo(steps: number) {
      if (!project || !steps) return;
      const p = await run<ProjectState>("history_go", { steps });
      if (!p) return;
      applyProject(p);
      const count = Math.abs(steps);
      quick(steps < 0 ? t`Undone: ${plural(count, { one: "# change", other: "# changes" })}`
        : t`Redone: ${plural(count, { one: "# change", other: "# changes" })}`, "undo");
    },
    /** Reads the game from another folder (asking which, without a path; null: find it through Steam again). The
        window shows the start-up screen while the game's audio is read again. Returns what went wrong, if anything:
        the caller shows it, since notices can't be seen from the start-up screen. */
    async setGameFolder(path?: string | null): Promise<string | null> {
      if (path === undefined) {
        path = await platform.pickFolder(status?.game_folder?.path ?? undefined, t`Choose the Helldivers 2 install folder`);
        if (!path) return null;
      }
      try {
        const s = await call<Status>("set_game_folder", { path });
        setStatus(s);
        setBoot((b) => b + 1);
        return null;
      } catch (e: any) { return e.message ?? String(e); }
    },
    /** Builds the mod's ZIP. The Build tab's switches say whether the version goes up afterwards and whether
        the ZIP is shown in its folder. */
    async build() {
      if (!needProject()) return;
      // what the Build button says when it is off, Ctrl+B says too
      if (Object.values(jobs).some((j) => j.kind === "build" && j.state === "running")) { quick(t`A build is already running`, "info"); return; }
      const fresh = await run<ProjectState>("project"); // a file deleted meanwhile shows up as a problem now
      if (!fresh) return;
      applyProject(fresh);
      if (fresh.problems.length) {
        const problems = fresh.problems.length;
        notify("bad", plural(problems, { 1: "Fix the problem on the Build tab first.", other: "Fix the # problems on the Build tab first." }),
          { label: t`Build Tab`, go: { tab: "build" } });
        return;
      }
      if (!Object.keys(fresh.assignments).length && !Object.keys(fresh.gains ?? {}).length && !fresh.texts.length && !Object.keys(fresh.soundtrack ?? {}).length) {
        notify("info", t`Nothing to build yet. Replace some audio, set a piece in the Soundtrack or change a line of text first.`);
        return;
      }
      const job = await run<Job>("build", { bump: settings.get().bumpVersion });
      if (job) watchJob(job, finishJob);
    },
    /** Starts an export job (see Session.export in the core) and reports when the files are written. */
    /** Starts an export; true when the core took it (a wrong folder is refused at once, with a notice). */
    async exportList(args: Record<string, unknown>) {
      const job = await run<Job>("export_list", args);
      if (job) watchJob(job, finishJob);
      return !!job;
    },
    async exportAudio(args: Record<string, unknown>) {
      const job = await run<Job>("export", args);
      if (job) watchJob(job, finishJob);
      return !!job;
    },
    async cancelJob(id: string) { await run("job_cancel", { id }); },
    /** Rebuilds an existing mod on the game as it is now, as the one mod it was (the Repatch page). */
    async repatch(path: string, name: string, folder: string, everyBank: boolean) {
      const job = await run<Job>("repatch", { path, name, folder, every_bank: everyBank });
      if (job) watchJob(job, finishJob);
      return !!job;
    },
    /** Reads mods to combine, each with its options, and finds where they change the same things (Combine Mods). */
    async combineRead(mods: { source: string; picks: string[] }[]) {
      const job = await run<Job>("combine_read", { mods });
      if (job) watchJob(job, finishJob);
      return !!job;
    },
    /** Builds one mod out of several, with the winner chosen for each conflict (Combine Mods). */
    async combine(mods: { source: string; picks: string[] }[], winners: Record<string, number>, name: string, folder: string, everyBank: boolean) {
      const job = await run<Job>("combine", { mods, winners, name, folder, every_bank: everyBank });
      if (job) watchJob(job, finishJob);
      return !!job;
    },
    /** Checks the installed mods for sound banks of an older game version (the Repatch page lists them). */
    async checkMods() {
      const job = await run<Job>("check_mods");
      if (job) watchJob(job, finishJob);
    },
    /** A mod's patches into the open project (the Project tab's Import Patches, a patch file dropped on the window):
        the Import Mod panel opens on the mod chosen, and says what comes in first. Without a project open, the
        panel makes a new one. */
    async importPatch(path?: string) {
      path ??= (await platform.pickMod(t`Choose a mod to import`)) ?? undefined;
      if (path) importAsk.open({ path, into: !!project });
    },
    /** Import Mod (Home, the Project tab): a new project made from a mod (a ZIP, a folder or a patch file), set up
        in the Import Mod panel. */
    async importMod(path?: string) {
      path ??= (await platform.pickMod(t`Choose a mod to import`)) ?? undefined;
      if (path) importAsk.open({ path, into: false });
    },
    /** Runs an import the Import Mod panel set up (core import_mod). A new project opens once it is made. True when
        the core took it (a name or folder it refuses keeps the panel open). */
    async runImport(args: Record<string, unknown>) {
      const job = await run<Job>("import_mod", args);
      if (!job) return false;
      if (args.folder) madeByImport.current.add(job.id);
      watchJob(job, finishJob);
      return true;
    },
  }), [run, applyProject, edited, editNotice, notify, quick, needProject, scopes, project, watchJob, finishJob, clip, remember, status, jobs, openPack]);
  undoRef.current = actions.undo;
  openFile.current = actions.openProject; // a .audipack goes on to openPack

  // one object while these stay the same: selecting a slot or opening an item (each tab's contexts, below) leaves it
  // as it is, so what reads only this isn't drawn again
  const shared = useMemo(() => ({
    status, connectError, index, archives, itemIndex, project, recent, clip, notices, dismiss, notify, announce, toast, quick, jobs, revision,
    actions, run, scopes, resolveItem, goTo, openFound,
  }), [status, connectError, index, archives, itemIndex, project, recent, clip, notices, dismiss, notify, announce, toast, quick, jobs, revision,
    actions, run, scopes, resolveItem, goTo, openFound]);
  return { shared, browse: { library: lib, editor: ed } };
}

type Shared = ReturnType<typeof useEditorState>["shared"];
const Ctx = createContext<Shared | null>(null);
const ScopeCtx = createContext<ScopeName>("editor");
// each tab's browsing in two contexts: what is open there, and what is selected there
const OpenCtx = { library: createContext<Open | null>(null), editor: createContext<Open | null>(null) };
const SelectionCtx = { library: createContext<Selection | null>(null), editor: createContext<Selection | null>(null) };

export function EditorProvider({ children }: { children: ReactNode }) {
  const { shared, browse: { library: lib, editor: ed } } = useEditorState();
  return (
    <Ctx.Provider value={shared}>
      <OpenCtx.library.Provider value={lib.open}><SelectionCtx.library.Provider value={lib.selection}>
        <OpenCtx.editor.Provider value={ed.open}><SelectionCtx.editor.Provider value={ed.selection}>
          <LiteProvider scope="editor">{children}</LiteProvider>
        </SelectionCtx.editor.Provider></OpenCtx.editor.Provider>
      </SelectionCtx.library.Provider></OpenCtx.library.Provider>
    </Ctx.Provider>
  );
}
/** Everything under it browses in one tab: the Library (read-only) or the Editor. */
export function Scope({ name, children }: { name: ScopeName; children: ReactNode }) {
  return <ScopeCtx.Provider value={name}><LiteProvider scope={name}>{children}</LiteProvider></ScopeCtx.Provider>;
}

/** What the rows of a long list need besides their own data. It changes rarely (an edit, opening something, the
    Index arriving), so a row that reads it instead of useEditor() isn't drawn again when a notice, a quick note or a
    job's progress changes: everything that reads useEditor() is, and a bank can have a thousand rows. */
export type Lite = {
  revision: number; scope: ScopeName; readOnly: boolean; itemId: string | null; cueId: string | null;
  itemIndex: Shared["itemIndex"]; notify: Shared["notify"]; quick: Shared["quick"];
};
const LiteCtx = createContext<Lite | null>(null);
function LiteProvider({ scope, children }: { scope: ScopeName; children: ReactNode }) {
  const e = useContext(Ctx)!;
  const here = useContext(OpenCtx[scope])!;
  const value = useMemo<Lite>(() => ({ revision: e.revision, scope, readOnly: scope === "library", itemId: here.itemId, cueId: here.cueId,
    itemIndex: e.itemIndex, notify: e.notify, quick: e.quick }), [e.revision, scope, here.itemId, here.cueId, e.itemIndex, e.notify, e.quick]);
  return <LiteCtx.Provider value={value}>{children}</LiteCtx.Provider>;
}
export function useLite(): Lite {
  const v = useContext(LiteCtx);
  if (!v) throw new Error("useLite outside EditorProvider");
  return v;
}

// a tab's browsing, field by field, with the context each field comes from (TypeScript checks that none is missing)
const OPEN_FIELDS: Record<keyof Open, true> = { itemId: true, cueId: true, cue: true, shownItemId: true, loading: true, openCue: true,
  openItem: true, close: true, back: true, forward: true, nav: true };
const SELECTION_FIELDS: Record<keyof Selection, true> = { selected: true, setSelected: true };
/** What useEditor() starts from in each tab: the tab's browsing as getters, each reading its context when it is read.
    React lets use() run anywhere in a render, so a component is drawn again by the selection, or by what is open, only
    when it reads them. */
const BROWSING = Object.fromEntries((["library", "editor"] as const).map((scope) => {
  const view = {};
  const from = (fields: object, ctx: Context<any>) => {
    for (const k of Object.keys(fields)) Object.defineProperty(view, k, {
      get(this: { scopes: Record<ScopeName, Browse> }) {
        // read in a handler, after the render, use() can't run: the tab's browsing as it is now does instead
        try { return use(ctx)[k]; } catch { return this.scopes[scope][k as keyof Browse]; }
      },
    });
  };
  from(OPEN_FIELDS, OpenCtx[scope]);
  from(SELECTION_FIELDS, SelectionCtx[scope]);
  return [scope, view];
})) as Record<ScopeName, Browse>;

/** The app's state, with the browsing of the tab this component is in (what is open and selected there). Outside
    the two tabs that browse, that is the Audio tab's. The browsing comes from the tab's own contexts as its fields
    are read (see BROWSING): a component that takes only `project` and `actions` isn't drawn again when a slot is
    selected. So take the fields while rendering, as `const { cue, selected } = useEditor()` does: one read only in a
    handler gets the tab's browsing as it is then, but doesn't draw the component again when it changes. */
export function useEditor() {
  const e = useContext(Ctx);
  const scope = useContext(ScopeCtx);
  if (!e) throw new Error("useEditor outside EditorProvider");
  const { goTo, project, scopes } = e;
  /** Opens an item where it can be shown: here, or in the Library when this is the Editor and the project doesn't
      list it. */
  const show = (itemId: string, part?: number | string | null, select?: string | null) => {
    if (scope === "editor" && !project?.library.includes(itemId)) {
      return goTo({ scope: "library", itemId, cueId: typeof part === "string" ? part : null, source: select ?? null });
    }
    // in the Library, the list on the left shows where it is: the Index for an item, All Archives for an archive
    if (scope === "library") tabs.go("library", itemId.startsWith("archive:") ? "archives" : "index");
    return scopes[scope].openItem(itemId, part, select);
  };
  return Object.assign(Object.create(BROWSING[scope]) as Browse, e, { scope, readOnly: scope === "library", show });
}

/** The tabs that can be hidden that show now: the open project's choice, else Settings ▸ System's. */
export function useShownTabs(): Hideable[] {
  const project = useContext(Ctx)?.project;
  const system = useSettings().tabs;
  const list = project?.tabs ?? system;
  const key = list.join();
  return useMemo(() => list, [key]); // eslint-disable-line react-hooks/exhaustive-deps
}
