import { createContext, use, useCallback, useContext, useEffect, useMemo, useRef, useState, type Context, type ReactNode } from "react";
import { call, plural, type ArchiveRow, type Assignment, type Cue, type Index, type Job, type MusicItem, type Place as Found, type ProjectState, type Status } from "./api";
import { choose, confirm } from "./Confirm";
import { JOB_NAMES } from "./jobs";
import { keyHint, keyLabel } from "./keys";
import { indexItems } from "./music";
import { FOLD_LIBRARY, nav as tabs } from "./nav";
import { notes } from "./noteStore";
import * as platform from "./platform";
import type { PlayedAt } from "./player";
import { settings } from "./settings";
import { motionMs } from "./theme";

export type Notice = {
  id: number; tone: "info" | "good" | "bad"; text: string; action?: { label: string; run: () => void }; sticky?: boolean;
  leaving?: boolean;  // on its way out (animating)
};
/** A quick note: one short line that confirms what was just done ("**Loadout Selection** added to **My Mod**",
    "**My Mod** saved"), shown for a moment at the bottom of the window. `**words**` are drawn bold. A new one takes
    the place of the last, so quick actions in a row never pile up. Notices are for what needs reading or a button. */
export type Toast = { id: number; text: string; icon: ToastIcon; leaving?: boolean };
export type ToastIcon = "done" | "add" | "save" | "copy" | "undo" | "info";
const TOAST_MS = 1800;

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
  assign: "assign", fill: "fill", unassign: "remove", update: "change", skip: "skip", silence: "silence", paste: "paste",
  move: "move", segment: "cue points", settings: "mod details", import: "import", add: "add to the project",
  unlist: "remove from the project", text: "text change", "add take": "new takes", "add layer": "new layer",
  "own clip": "only this sound", "shared clip": "every sound that plays it", note: "note", collect: "collect files",
};

/** "a.wav, b.wav and 3 more". */
function listNames(names: string[], shown = 3) {
  const xs = names.slice(0, shown), more = names.length - xs.length;
  if (more) return `${xs.join(", ")} and ${more} more`;
  return xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}` : xs[0] ?? "";
}
const undoHint = () => (keyLabel("undo") ? `Undo (${keyLabel("undo")})` : "Undo");

/** Asks before new audio leaves slots (a new take goes with its audio). True to go ahead. */
function confirmRemoval(mine: Assignment[], p: ProjectState) {
  const n = mine.length, silence = mine.every((x) => x.silence);
  const takes = mine.filter((x) => p.additions.some((a) => a.kind === "take" && a.source === x.target)).length;
  const files = [...new Set(mine.filter((x) => !x.silence).map((x) => x.name))];
  const what = silence ? "the silence" : takes === n ? (n === 1 ? "the new take" : "the new takes") : "the new audio";
  const after = takes === n ? (n === 1 ? "The take is gone from the sound." : "The takes are gone from their sounds.")
    : silence ? `${n === 1 ? "This slot plays" : "These slots play"} the original again.`
    : `${n === 1 ? "This slot plays" : `These ${n} slots play`} the original again.`;
  return confirm({
    title: `Remove ${what}${n > 1 && takes !== n ? ` from ${n} slots` : ""}?`,
    text: `${after}${files.length ? ` ${files.length === 1 ? `The file ${files[0]} stays` : `The files (${listNames(files)}) stay`} on disk.` : ""}`
      + ` ${undoHint()} brings ${n === 1 ? "it" : "them"} back.`,
    ok: "Remove", cancel: "Keep",
  });
}

/** What opening a project put right in its file (said once, when it opens; the file is fixed by its next save). */
const repairNote = (p: ProjectState) =>
  `Some values in ${p.name} were damaged and were reset to their defaults (${p.repairs.join(", ")}).`;

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

  // the cue follows what is open (and is fetched again after the game data is). A big bank takes a second or two
  // the first time, so the one that showed before stays for a moment, then gives way to a note that says so.
  useEffect(() => {
    if (!place) { setLoaded(null); setSlow(false); return; }
    const { cueId: id, itemId } = place;
    const rev = `${gameRev}|${id.startsWith("bank:") ? added : ""}`;
    if (last.current?.cue.id === id && last.current.rev === rev) { // the same cue, reached another way
      if (last.current.itemId !== itemId) setLoaded({ ...last.current, itemId });
      return;
    }
    let live = true;
    const t = setTimeout(() => { if (live) setSlow(true); }, 180);
    call<Cue>("cue", { id, mine: scope === "editor" })
      .then((c) => { if (live) { setLoaded({ cue: c, itemId, rev }); setSlow(false); } })
      .catch((e) => { if (live) { setPlace(null); setSlow(false); notify("bad", e.message); } }) // nothing to show: nothing is open
      .finally(() => clearTimeout(t));
    return () => { live = false; clearTimeout(t); };
  }, [place, notify, gameRev, added, scope]);
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
  const nextId = useRef(1);
  const editSeq = useRef(0); // counts edits, so an Undo button only undoes the edit it was shown for

  /** Takes a notice away, after a short exit animation when animations play. */
  const dismiss = useCallback((id: number) => {
    setNotices((n) => n.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
    setTimeout(() => setNotices((n) => n.filter((x) => x.id !== id)), motionMs(160));
  }, []);
  /** Shows a notice. Sticky ones stay until dismissed: a failed job must not vanish while nobody is looking. */
  const notify = useCallback((tone: Notice["tone"], text: string, action?: Notice["action"], sticky = false) => {
    const id = nextId.current++;
    // the same words again (a button pressed twice) take the place of the notice already saying them
    setNotices((n) => [...n.filter((x) => x.text !== text || x.leaving).slice(-3), { id, tone, text, action, sticky }]);
    if (!sticky) setTimeout(() => dismiss(id), action ? 12000 : tone === "bad" ? 9000 : 4500);
  }, [dismiss]);
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
  const jobFailed = useCallback((what: string, j: Job) => {
    notify("bad", `${what} failed: ${j.error}`, logPath.current ? { label: "Open log", run: () => platform.reveal(logPath.current) } : undefined, true);
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
    // previews and waveforms are fetched again only when the audio itself may have changed: another file, silence,
    // the icon, or files chosen again (they may have been rewritten on disk). A gain or a cue point keeps them.
    const sig = p ? JSON.stringify([Object.entries(p.assignments).map(([s, a]) => [s, a.audio, a.silence, a.exists, a.duration_ms]), p.icon]) : "";
    if (sig !== audioSig.current || (changed && ["assign", "fill", "import"].includes(p?.undo_label ?? ""))) {
      audioSig.current = sig;
      setRevision((r) => r + 1);
    }
  }, []);
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
      label: "Undo", run: () => {
        if (editSeq.current === seq) undoRef.current();
        else notify("info", `Newer changes came after it. Undo${keyHint("undo")} steps back one change at a time.`);
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
  useEffect(() => {
    let stop = false;
    (async () => {
      while (!stop) {
        try {
          const s = await call<Status>("status");
          if (stop) return; // cancelled meanwhile (React runs effects twice in development)
          setStatus(s); setConnectError(null); logPath.current = s.log ?? "";
          if (s.stage === "ready") {
            const [ix, all] = await Promise.all([call<Index>("index"), call<ArchiveRow[]>("archives")]);
            if (stop) return;
            setIndex(ix); setArchives(all);
            if (!firstBoot.current) { setArchiveItems({}); pending.current.clear(); applyProject(s.project); setGameRev((r) => r + 1); return; }
            firstBoot.current = false;
            for (const j of s.jobs ?? []) resume.current(j); // a build or export still running: the window reloaded
            // a project or pack opened in Explorer (a double-click): it wins over the last one
            const launched = await platform.launchFile();
            if (stop) return;
            if (launched) {
              try {
                if (/\.audipack$/i.test(launched)) {
                  const job = await call<Job>("pack_open", { path: launched });
                  if (!stop) resume.current(job); // its end unpacks the project, says where, and opens it
                } else {
                  const p = await call<ProjectState>("project_open", { path: launched });
                  if (stop) return;
                  applyProject(p); remember(p.path); tabs.go("editor");
                  if (p.repairs.length) notify("info", repairNote(p), undefined, true);
                }
              } catch (e: any) {
                if (!stop) notify("bad", String(e?.message ?? e), undefined, true);
              }
            } else if (s.project) { applyProject(s.project); tabs.go("editor"); } // the core kept it open (the window reloaded)
            else if (settings.get().openLast) {
              const last = recentProjects()[0];
              if (last) {
                try {
                  const p = await call<ProjectState>("project_open", { path: last });
                  if (stop) return;
                  applyProject(p);
                  tabs.go("editor");
                  quick(`**${p.name}** opened`, "info");
                  // sticky, these two: at startup the update question may be over them
                  if (p.repairs.length) notify("info", repairNote(p), undefined, true);
                } catch (e: any) { // moved, deleted or damaged: start on Home, and say why
                  const name = last.split(/[\\/]/).pop() ?? last;
                  if (!stop) notify("info", `The last project didn't open: ${String(e.message ?? "it wasn't found").replace(last, name)}`, undefined, true);
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
  const goTo = useCallback(async (at: PlayedAt) => {
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
  const watchJob = useCallback((job: Job, onDone: (j: Job) => void) => {
    setJobs((js) => ({ ...js, [job.id]: job }));
    let misses = 0;
    const tick = async () => {
      const j = await call<Job>("job", { id: job.id }).catch(() => null);
      if (!j) { // one missed answer must not end the watch silently
        if (++misses < 20) setTimeout(tick, 1000);
        else onDone({ ...job, state: "failed", error: "lost contact with the Audiodiver core" });
        return;
      }
      misses = 0;
      setJobs((js) => ({ ...js, [j.id]: j }));
      if (j.state === "running") setTimeout(tick, 500);
      else onDone(j);
    };
    setTimeout(tick, 400);
  }, []);

  /** What a job's end says, whichever way it ended: also for a job a reloaded window picked up again. Every end
      fetches the project again, so its version, its problems and what an import brought in show at once. */
  const finishJob = useCallback(async (j: Job) => {
    const refresh = async () => applyProject(await run<ProjectState>("project"));
    const what = JOB_NAMES[j.kind]?.[0] ?? "Export";
    if (j.state === "cancelled") quick(`${what} cancelled`, "info");
    else if (j.state !== "done") jobFailed(what, j);
    else if (j.kind === "check" || j.kind === "combine_read") {
      // the Repatch and Combine Mods pages show what it found
    } else if (j.kind === "build") {
      notify("good", `Built ${j.result.zip.split(/[\\/]/).pop()} (${j.result.mb} MB).`,
        { label: "Show in folder", run: () => platform.reveal(j.result.zip) });
      if (settings.get().revealBuild) platform.reveal(j.result.zip).catch(() => {});
    } else if (j.kind === "repatch" || j.kind === "combine") { // the Repatch and Combine Mods pages show the rest
      const zip: string = j.result.zip;
      notify("good", `${j.kind === "repatch" ? "Repatched" : "Combined"} ${j.title}: ${zip.split(/[\\/]/).pop()} (${j.result.mb} MB).`,
        { label: "Show in folder", run: () => platform.reveal(zip) });
      if (settings.get().revealBuild) platform.reveal(zip).catch(() => {});
    } else if (j.kind === "import") {
      // replacements, and what the mod adds (new takes, layers, sounds with a clip of their own); what can't come
      // in is said, and then the notice waits to be read
      // (a heading, then one line each)
      const r = j.result, left: string[] = r.left ?? [];
      const brought = [r.imported ? plural(r.imported, "replaced sound") : "", r.added ? plural(r.added, "added sound") : "",
        r.settings ? `The mod's settings on ${plural(r.settings, "sound or container", "sounds and containers")}` : ""].filter(Boolean);
      const lines = [
        brought.length ? "Imported from the patch into the Audio Editor:" : "Imported nothing from the patch.",
        ...brought,
        r.skipped ? `${r.skipped} couldn't be decoded` : "",
        // sounds the patch still had from an older game version: not the mod's, so not imported (Wiki: Repatching)
        r.stale ? `Left out: ${plural(r.stale, "sound")} from an older game version` : "",
        // the game's objects as the patch's older copies had them: the current ones stay (Wiki: Repatching)
        r.older ? `Kept current: ${plural(r.older, "sound object")} the patch had from an older game version` : "",
        ...left.map((l) => `Left out: ${l}`),
      ].filter(Boolean);
      const why = r.stale ? "repatching#sounds-from-an-older-game-version"
        : r.older ? "repatching#shared-settings-from-an-older-game-version" : "";
      notify("good", lines.join("\n"), why ? { label: "Why?", run: () => tabs.go("wiki", why) } : undefined,
        left.length > 0 || r.stale > 0 || r.older > 0);
    } else if (j.kind === "pack") {
      const r = j.result;
      const missed = r.missing ? ` ${plural(r.missing, "file")} the project uses ${r.missing === 1 ? "was" : "were"} not found.` : "";
      notify("good", `Packed ${plural(r.files, "file")} into ${r.pack.split(/[\\/]/).pop()} (${r.mb} MB).${missed}`,
        { label: "Show in folder", run: () => platform.reveal(r.pack) }, r.missing > 0); // files left out: it waits to be read
    } else if (j.kind === "unpack") {
      // the pack's project, in a new folder where new projects go: it opens where it landed
      const p = await run<ProjectState>("project_open", { path: j.result.project });
      if (p) { applyProject(p); remember(p.path); tabs.go("editor"); }
      notify("good", `Unpacked into ${j.result.folder}.`, { label: "Show in folder", run: () => platform.reveal(j.result.folder) });
      if (p?.repairs.length) notify("info", repairNote(p), undefined, true);
    } else {
      // the export list's slots that have no audio in the game's files: why fewer files came out than it counts
      const absent = j.result.absent ? ` ${plural(j.result.absent, "slot")} on it ${j.result.absent === 1 ? "has" : "have"} no audio in the game's files.` : "";
      notify("good", `Exported ${plural(j.result.files, "file")} of ${j.title}.${absent}`,
        { label: "Show in folder", run: () => platform.reveal(j.result.first) }, true);
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
    notify("info", "Open or create a project first.", { label: "Home", run: () => tabs.go("home") });
    return false;
  }, [project, notify]);

  /** How many slots an edit gave new audio. */
  const changed = (after: ProjectState) => Object.entries(after.assignments).filter(([s, x]) => project?.assignments[s]?.audio !== x.audio).length;
  const fitNote = (files: number, placed: number) => (files > placed ? ` ${plural(files - placed, "file")} left over, because there are no free slots.` : "");

  const actions = useMemo(() => ({
    async newProject() {
      // new projects get a folder of their own in the projects folder (Settings keeps the last one used)
      const folder = await call<string>("projects_folder").catch(() => "");
      const path = await platform.pickProjectToCreate("My mod.audi", folder);
      if (!path) return;
      const name = path.split(/[\\/]/).pop()!.replace(/\.audi$/i, "");
      const from = tabs.get().tab;
      const p = await run<ProjectState>("project_new", { path, name });
      if (p) {
        applyProject(p); remember(p.path);
        window.dispatchEvent(new Event(FOLD_LIBRARY)); // the Library starts folded for it
        if (tabs.get().tab === from) tabs.go("project");
        quick(`**${p.name}** created`, "add");
      }
    },
    /** Writes the project file now. Edits save themselves; Ctrl+S also commits a field being typed in (the Project
        tab's name, a line on the Text Editor), which saves when it loses focus. */
    async save() {
      if (!project) { quick("No project open", "info"); return; }
      const field = document.activeElement as HTMLElement | null;
      if (field?.matches("input, textarea")) { field.blur(); field.focus(); }
      await new Promise((r) => setTimeout(r)); // the field's own save (on blur) goes first, then this one
      const p = await run<ProjectState>("project_save");
      if (p) { applyProject(p); quick(`**${p.name}** saved`, "save"); } // the name just typed, not the one before
    },
    /** Opens a project (asking which, without a path) and shows it in the Editor. A .audipack unpacks first. */
    async openProject(path?: string) {
      path ??= (await platform.pickProjectToOpen(project?.path ?? recentProjects()[0])) ?? undefined;
      if (!path) return;
      if (/\.audipack$/i.test(path)) return openPack(path);
      const p = await run<ProjectState>("project_open", { path });
      if (p) {
        applyProject(p); remember(p.path); tabs.go("editor");
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
      quick(`**${project.name}** closed`, "info");
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
      quick(`**${p.name}** moved into a new folder`);
    },
    /** Copies the files the project uses from outside its folder into audio\added (Project tab). */
    async collectFiles() {
      const r = await run<ProjectState & { collected: number }>("collect_files");
      if (!r) return;
      const { collected, ...p } = r;
      edited(p);
      if (collected) editNotice("good", `Copied ${plural(collected, "file")} into the project's folder.`);
      else quick("Nothing to copy", "info");
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
      else quick(`**${what}** added to **${project!.name}**`, "add");
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
      if (losing.slots && !(await confirm({
        title: `Remove ${what} from the project?`,
        text: `${plural(losing.slots, "slot")} with new audio ${losing.slots === 1 ? "goes" : "go"} with ${ids.length === 1 ? "it" : "them"}`
          + `${losing.files.length ? ` (${listNames(losing.files)})` : ""}. The audio files stay on disk, and `
          + `${undoHint()} brings everything back.`,
        ok: "Remove", cancel: "Keep",
      }))) return;
      const p = await run<ProjectState>("library_remove", { items: ids });
      if (!p || !edited(p)) return;
      const gone = before - Object.keys(p.assignments).length;
      if (gone) editNotice("info", `Removed ${what} from the project, with the new audio of ${plural(gone, "slot")}.`);
      else quick(`**${what}** removed from **${project.name}**`, "undo");
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
          editNotice("good", `Filled ${plural(n, "slot")} from here on, in file-name order.${fitNote(audio.length, n)}`);
        }
      } else edited(await run<ProjectState>("assign", { source, audio: audio[0] }));
    },
    async fill(cue: string, files: string[], onlyEmpty = false) {
      if (!needProject()) return;
      const p = await run<ProjectState>("fill", { cue, files, only_empty: onlyEmpty });
      if (p && edited(p)) {
        const n = changed(p);
        editNotice("good", `Filled ${plural(n, "slot")} in play order, by file name.${fitNote(files.length, n)}`);
      }
    },
    /** Fills the given slots in order: a whole piece of music with several parts at once. */
    async fillSources(sources: string[], files: string[], what: string) {
      if (!needProject() || !files.length) return;
      const p = await run<ProjectState>("fill_sources", { sources, files });
      if (p && edited(p)) {
        const n = changed(p);
        editNotice("good", `Filled ${plural(n, "slot")} across ${what}, by file name.${fitNote(files.length, n)}`);
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
          editNotice("info", `Removed ${mine.every((x) => x.silence) ? "the silence" : "the new audio"} from ${plural(n, "slot")}.`);
      } finally {
        sources.forEach((s) => removing.delete(s));
      }
    },
    /** Makes transitions or stingers play a short silence, so the game moves straight on. `what` names them. */
    async skip(sources: string[], what: string) {
      if (!needProject() || !sources.length) return;
      if (edited(await run<ProjectState>("skip", { sources }))) quick(`**${what}** skipped`);
    },
    /** Replaces slots with the built-in silence. keepTiming (Keep original duration, on by default): they stay silent
        for as long as the original would play; otherwise the game moves straight on, as Skip does. */
    async silence(sources: string[], keepTiming = true, what = plural(sources.length, "slot")) {
      if (!needProject() || !sources.length) return;
      if (edited(await run<ProjectState>("silence", { sources, keep_timing: keepTiming }))) quick(`**${what}** replaced with silence`);
    },
    /** Remembers the audio of these slots for pasting (the slots without new audio are left out). */
    copySlots(sources: string[]) {
      const mine = sources.filter((s) => project?.assignments[s]);
      if (!mine.length) { quick("Nothing to copy, because these slots aren't replaced", "info"); return; }
      setClip(mine);
      const paste = keyLabel("paste");
      quick(`Copied ${plural(mine.length, "slot")}${paste ? ` · ${paste} pastes` : ""}`, "copy");
    },
    /** Gives targets the copied audio: one copied slot goes into every target, several go in order. */
    async pasteSlots(targets: string[]) {
      if (!needProject() || !clip.length || !targets.length) return;
      const pairs = clip.length === 1 ? targets.map((t) => [clip[0], t]) : clip.slice(0, targets.length).map((c, i) => [c, targets[i]]);
      if (edited(await run<ProjectState>("copy_audio", { pairs }))) quick(`Pasted into ${plural(pairs.length, "slot")}`);
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
        quick(`${plural(p.sources.length, "new take")} for **${what}**`, "add");
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
        quick(`New layer on **${what}**`, "add");
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
    async settings(fields: Record<string, unknown>) { edited(await run<ProjectState>("settings", fields)); },
    /** A new mod id: HD2 Arsenal then sees the next build as another mod. Undo puts the old id back. */
    async newModId() {
      if (edited(await run<ProjectState>("settings", { guid: "new" }))) editNotice("info", "New mod id created. HD2 Arsenal installs the next build as a separate mod.");
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
    /** Cuts one song at boundsMs and assigns the pieces to `sources`, in order; true when it worked. */
    async sliceFill(cue: string, audio: string, boundsMs: number[], sources: string[]) {
      if (!needProject()) return false;
      const p = await run<ProjectState>("slice_fill", { cue, audio, bounds_ms: boundsMs, sources });
      if (!edited(p)) return false;
      editNotice("good", `Sliced into ${boundsMs.length - 1} pieces, filled in play order.`);
      return true;
    },
    async undo() {
      if (!project) return;
      const p = await run<ProjectState>("undo"); // after any save still on its way: that is what it undoes
      if (!p) return;
      const did = p.revision !== coreRevision.current;
      applyProject(p);
      quick(did ? `Undone: ${EDIT_NAMES[p.redo_label ?? ""] ?? "the last change"}` : "Nothing to undo", did ? "undo" : "info");
    },
    async redo() {
      if (!project) return;
      const p = await run<ProjectState>("redo");
      if (!p) return;
      const did = p.revision !== coreRevision.current;
      applyProject(p);
      quick(did ? `Redone: ${EDIT_NAMES[p.undo_label ?? ""] ?? "the change"}` : "Nothing to redo", did ? "undo" : "info");
    },
    /** Reads the game from another folder (asking which, without a path; null: find it through Steam again). The
        window shows the start-up screen while the game's audio is read again. Returns what went wrong, if anything:
        the caller shows it, since notices can't be seen from the start-up screen. */
    async setGameFolder(path?: string | null): Promise<string | null> {
      if (path === undefined) {
        path = await platform.pickFolder(status?.game_folder?.path ?? undefined, "Choose the folder Helldivers 2 is installed in");
        if (!path) return null;
      }
      try {
        const s = await call<Status>("set_game_folder", { path });
        setStatus(s);
        setBoot((b) => b + 1);
        return null;
      } catch (e: any) { return e.message ?? String(e); }
    },
    /** Builds the Arsenal ZIP. The Build tab's switches say whether the version goes up afterwards and whether
        the ZIP is shown in its folder. */
    async build() {
      if (!needProject()) return;
      // what the Build button says when it is off, Ctrl+B says too
      if (Object.values(jobs).some((j) => j.kind === "build" && j.state === "running")) { quick("A build is already running", "info"); return; }
      const fresh = await run<ProjectState>("project"); // a file deleted meanwhile shows up as a problem now
      if (!fresh) return;
      applyProject(fresh);
      if (fresh.problems.length) {
        notify("bad", `Fix ${fresh.problems.length === 1 ? "the problem" : `the ${fresh.problems.length} problems`} on the Build tab first.`,
          { label: "Build tab", run: () => tabs.go("build") });
        return;
      }
      if (!Object.keys(fresh.assignments).length && !fresh.texts.length) {
        notify("info", "Nothing to build yet. Replace some audio or change a line of text first.");
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
    async importPatch(path?: string) {
      if (!needProject()) return;
      path ??= (await platform.pickPatch()) ?? undefined;
      if (!path) return;
      // a project with something in it: the patch's audio joins it, or takes the place of its audio
      const p = project!;
      const empty = !Object.keys(p.assignments).length && !p.additions.length && !p.settings
        && !Object.keys(p.segment_overrides).length && !p.library.length;
      let mode: "add" | "replace" = "add";
      if (!empty) {
        const answer = await choose({
          title: `Import ${path.split(/[\\/]/).pop()}`,
          text: "Add the patch's audio to this project, or replace the project's audio with it? Adding keeps what the "
            + "project has, and where both have audio for a slot, the patch's goes in. Replacing takes out the project's "
            + `new audio, added sounds, cue points and list first; its text and audio files stay. ${undoHint()} brings it back.`,
          ok: "Add to the project", alt: "Replace the project's audio",
        });
        if (!answer) return;
        if (answer === "alt") mode = "replace";
      }
      const job = await run<Job>("import_patch", { path, mode });
      if (job) watchJob(job, finishJob);
    },
  }), [run, applyProject, edited, editNotice, notify, quick, needProject, scopes, project, watchJob, finishJob, clip, remember, status, jobs, openPack]);
  undoRef.current = actions.undo;
  openFile.current = actions.openProject; // a .audipack goes on to openPack

  // one object while these stay the same: selecting a slot or opening an item (each tab's contexts, below) leaves it
  // as it is, so what reads only this isn't drawn again
  const shared = useMemo(() => ({
    status, connectError, index, archives, itemIndex, project, recent, clip, notices, dismiss, notify, toast, quick, jobs, revision,
    actions, run, scopes, resolveItem, goTo, openFound,
  }), [status, connectError, index, archives, itemIndex, project, recent, clip, notices, dismiss, notify, toast, quick, jobs, revision,
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
    the two tabs that browse, that is the Audio Editor's. The browsing comes from the tab's own contexts as its fields
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
