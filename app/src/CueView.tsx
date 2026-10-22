import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { audioUrl, fmtTime, isMusic, type Assignment, type Cue, type Segment, type Slot } from "./api";
import { useContextMenu, type MenuEntry } from "./ContextMenu";
import { ExportDialog } from "./ExportDialog";
import { addedNote, exportList } from "./exportList";
import { CollapseAllIcon, LinkIcon } from "./Icons";
import { Mark } from "./IndexTree";
import { ItemActions, ItemHead, PartTabs } from "./ItemHead";
import { keyHint, keyLabel, useCommands, useKeymap } from "./keys";
import { coverage, COVERAGE, heldBy, isMusicItem, listedBanks, listName, statusOf, where } from "./music";
import { nav as tabs } from "./nav";
import { NoteButton } from "./Notes";
import { noteKeys } from "./noteStore";
import { copyText, fullPath, pickAudio, reveal } from "./platform";
import { PlayThrough, type Mark as ThroughMark, type Through } from "./PlayThrough";
import { player, usePlayerLook, type PlayedAt } from "./player";
import { ResizeEdge, useStoredHeight } from "./Resize";
import { SliceTool } from "./SliceTool";
import { useStable } from "./stable";
import { WikiLink } from "./Wiki";
import { useEditor, useLite } from "./store";
import { CatTag } from "./Tags";
import { scrollBehavior } from "./theme";
import { Timeline } from "./Timeline";

export type Row = {
  seg: Segment; segIndex: number; slot: Slot; stemIndex: number; stems: number; firstOfSeg: boolean;
  takes: number; // how many slots its segment (or group of sounds) has
};

export function rowsOf(segments: Segment[]): Row[] {
  const rows: Row[] = [];
  const seen = new Set<string>();
  segments.forEach((seg, segIndex) => {
    const from = rows.length;
    seg.stems.forEach((st, stemIndex) => st.slots.forEach((slot) => {
      if (seen.has(slot.source)) return; // a source repeated in the playlist is one slot
      seen.add(slot.source);
      rows.push({ seg, segIndex, slot, stemIndex, stems: seg.stems.length, firstOfSeg: rows.length === from, takes: 0 });
    }));
    for (let i = from; i < rows.length; i++) rows[i].takes = rows.length - from;
  });
  return rows;
}

/** "Loadout #3", "Segment 2 · Stem 3" when a segment has several stems, "Sound 4 · Take 2" for one take of a sound:
    what a slot is, for the now-playing bar and notices. A voice line goes by what it says. */
export function rowName(r: Row) {
  if (r.stems > 1) return `${r.seg.name} · ${r.slot.label || `Stem ${r.stemIndex + 1}`}`;
  if (r.seg.group && r.slot.label && r.takes > 1) return r.seg.name.includes(r.slot.label) ? r.seg.name : `${r.seg.name} · ${r.slot.label}`;
  return r.seg.name;
}

/** The tags the clip notes put on a clip ("quiet drums", "never plays"). */
export const noteTags = (slot: Slot) => (slot.notes ?? []).flatMap((n) => n.tag ? [n.tag] : []);

/** A clip's tags on its row, each with its note as the tip. */
function NoteTags({ slot }: { slot: Slot }) {
  return <>{(slot.notes ?? []).map((n) => n.tag && <span key={n.tag} className={`tag${n.warn ? " warn" : ""}`} data-tip={n.text}>{n.tag}</span>)}</>;
}

/** What each kind of silence does: the slot row's tooltip and the choice in the details panel. */
export const SILENCE_TIP = {
  move: "Plays nothing, and the game moves straight on",
  keep: "Plays nothing for as long as the original would, so what follows keeps its timing",
};

/** Whether a slot has new audio to listen to: a file that is there, not silence. */
export const audible = (a?: Assignment) => !!a?.exists && !a.silence;

/** Plays the original audio of a slot ("vanilla") or its replacement ("project"). Switching sides on the same slot
    keeps the position, so A/B comparisons line up. `at` says where the slot is, so the now-playing bar can lead back
    to it. */
export function playSlot(kind: "vanilla" | "project", source: string, revision: number, what: string, at: PlayedAt | null = null) {
  const other = `${kind === "vanilla" ? "project" : "vanilla"}:${source}`;
  player.play(`${kind}:${source}`, audioUrl(kind, source, kind === "project" ? String(revision) : ""),
    player.state.key === other, `${what} · ${kind === "vanilla" ? "original" : "replaced"}`, at);
}

export function PlayButton({ kind, source, label, disabled, small, what, onPlay, at }: {
  kind: "vanilla" | "project"; source: string; label: string; disabled?: boolean; small?: boolean;
  what?: string;         // what plays, for the now-playing bar
  onPlay?: () => void;   // also runs on a click (a slot row selects itself)
  at?: PlayedAt;         // where it is, when that isn't the slot `source` of what is open here
}) {
  const { revision, scope, itemId, cueId } = useLite(); // not useEditor(): rows of long lists hold one each
  // drawn again only when it visibly changes: playing or not, loading, its ring in steps of 3° (not every frame)
  const { playing, loading, progress } = usePlayerLook(`${kind}:${source}`);
  return (
    <button className={`play ${kind}${small ? " small" : ""}${playing ? " playing" : ""}`} disabled={disabled}
      aria-label={`${playing ? "Pause" : "Play"} ${label}`} data-tip={`${playing ? "Pause" : "Play"} ${label}`}
      onClick={(e) => { e.stopPropagation(); onPlay?.(); playSlot(kind, source, revision, what ?? label, at ?? { scope, itemId, cueId, source }); }}
      onDoubleClick={(e) => e.stopPropagation()}
      style={{ ["--progress" as any]: progress }}>
      <span aria-hidden>{loading ? "…" : playing ? "❚❚" : "▶"}</span>
    </button>
  );
}

/** What is open in this tab: a piece of music's cue with its slots, or a bank's sounds. In the Editor the slots take
    new audio; in the Library they are for listening, and the item they belong to can be added to the project. */
export function CueView() {
  const { cue, loading } = useEditor();
  if (!cue) return loading ? <CueLoading /> : <CueEmpty />;
  return <CueBody key={cue.id} cue={cue} />;
}

const NONE: string[] = [];
const OPEN_ALL = 200;     // a bank with more sounds than this opens with its groups folded
const MAX_SHOWN = 300;    // a filter shows at most this many sounds at once

function CueBody({ cue }: { cue: Cue }) {
  const { project, selected, setSelected, actions, shownItemId, itemIndex, show, goTo, revision, clip, back, forward, nav: nav_,
    scope, readOnly, quick } = useEditor();
  const music = isMusic(cue);
  const grouped = cue.kind === "sounds";
  const all = useMemo(() => rowsOf(cue.segments_detail), [cue]);
  const listRef = useRef<HTMLDivElement>(null);
  const [slicing, setSlicing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [through, setThrough] = useState<Through | null>(null);  // the play-through that is playing, if one is
  const [mark, setMark] = useState<ThroughMark | null>(null);    // where it is: the segment whose Entry it passed last
  const [menu, openMenu] = useContextMenu();
  const assigned = project?.assignments ?? {};
  const cueRef = useRef<HTMLElement>(null);
  const [headH, setHeadH] = useStoredHeight("audiodiver.headHeight", null); // null: as tall as its content

  // a bank's sounds come in groups (the takes of one sound) that fold, and a filter narrows them
  const [filter, setFilter] = useState("");
  const [flipped, setFlipped] = useState<Set<number>>(() => new Set()); // the groups folded or opened by hand
  const openByDefault = !grouped || all.length <= OPEN_ALL;
  // (a segment of music a bank holds isn't a group: its slots always show, under its own name)
  const isOpen = useCallback((r: Row) => r.takes === 1 || !r.seg.group || flipped.has(r.segIndex) !== openByDefault, [flipped, openByDefault]);
  // the list follows the filter a beat behind the typing, in a render that typing can interrupt
  const typed = useDeferredValue(filter);
  const q = grouped ? typed.trim().toLowerCase() : "";
  const hits = useMemo(() => {
    if (!q) return null;
    const words = q.split(/\s+/);
    return all.filter((r) => { const hay = `${r.seg.name} ${r.slot.label} ${r.slot.source} ${r.slot.was ?? ""} ${noteTags(r.slot).join(" ")}`.toLowerCase(); return words.every((w) => hay.includes(w)); });
  }, [all, q]);
  /** The slots that show: all of a music cue's; of a bank's, those of the open groups or the ones the filter finds. */
  const rows = useMemo(() => (hits ? hits.slice(0, MAX_SHOWN) : grouped ? all.filter(isOpen) : all), [hits, grouped, all, isOpen]);
  // a slot that gets selected from elsewhere (a search, the now-playing bar, "also plays in") shows: its group opens
  useEffect(() => {
    if (!grouped || !selected.length) return;
    const shut = all.filter((r) => selected.includes(r.slot.source) && !isOpen(r)).map((r) => r.segIndex);
    if (shut.length) setFlipped((f) => { const next = new Set(f); for (const i of shut) if (openByDefault) next.delete(i); else next.add(i); return next; });
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  const scrollTo = (source: string) => listRef.current?.querySelector(`[data-source="${source}"]`)?.scrollIntoView({ block: "nearest" });
  const usable = (r: Row) => !r.slot.unused && !r.slot.locked && !r.slot.absent;
  // each group's takes that can take audio, worked out once per cue rather than for every group on every render
  const takesOf = useMemo(() => {
    const m = new Map<number, string[]>();
    for (const r of all) {
      if (!usable(r)) continue;
      const l = m.get(r.segIndex);
      if (l) l.push(r.slot.source); else m.set(r.segIndex, [r.slot.source]);
    }
    return m;
  }, [all]); // eslint-disable-line react-hooks/exhaustive-deps
  const at = (source: string): PlayedAt => ({ scope, itemId: shownItemId, cueId: cue.id, source });
  /** Paste targets: the selection, or (one slot selected, several copied) the slots from it on. */
  const pasteTargets = useCallback(() => {
    if (selected.length === 1 && clip.length > 1) {
      const i = rows.findIndex((r) => r.slot.source === selected[0]);
      return rows.slice(Math.max(0, i)).filter(usable).slice(0, clip.length).map((r) => r.slot.source);
    }
    return rows.filter((r) => selected.includes(r.slot.source)).map((r) => r.slot.source);
  }, [rows, selected, clip]);
  /** Moves the selected slot's audio to the next usable slot up or down, swapping with what is there. One move at
      a time: a key held down or pressed fast moves on from where the last move put the audio. */
  const moving = useRef(false);
  const moveAudio = useCallback(async (d: -1 | 1) => {
    if (selected.length !== 1 || moving.current) return;
    const i = rows.findIndex((r) => r.slot.source === selected[0]);
    let j = i + d;
    while (j >= 0 && j < rows.length && !usable(rows[j])) j += d;
    if (i < 0 || j < 0 || j >= rows.length) return;
    const a = rows[i].slot.source, b = rows[j].slot.source;
    if (!assigned[a]) return; // only new audio moves: an empty slot doesn't pull its neighbour's in
    moving.current = true;
    try {
      if (await actions.swap(a, b)) { setSelected([b]); scrollTo(b); }
    } finally { moving.current = false; }
  }, [rows, selected, assigned, actions, setSelected]);

  // the slot list's keys (keys.ts has which ones): they go before the app's own, and only count on this tab. The
  // Library's list is for listening: the keys that change a project do nothing there.
  const pos = () => rows.findIndex((r) => r.slot.source === selected[selected.length - 1]);
  const here = () => tabs.get().tab === scope && rows.length > 0;
  const editing = () => here() && !readOnly;
  const step = (d: -1 | 1) => {
    if (!here()) return false;
    const i = pos();
    const j = Math.max(0, Math.min(rows.length - 1, i < 0 ? 0 : i + d));
    setSelected([rows[j].slot.source]);
    scrollTo(rows[j].slot.source);
  };
  const play = (kind: "vanilla" | "project" | null) => {
    const i = pos();
    if (!here() || i < 0) return false;
    const s = rows[i].slot.source;
    const mine = !readOnly && audible(assigned[s]);
    if (kind === "project" && !mine) return false;
    if (!mine && rows[i].slot.absent) return false; // nothing in the game's files to play
    playSlot(kind ?? (mine ? "project" : "vanilla"), s, revision, rowName(rows[i]), at(s));
  };
  useCommands({
    selectPrev: () => step(-1),
    selectNext: () => step(1),
    moveUp: () => (editing() ? void moveAudio(-1) : false),
    moveDown: () => (editing() ? void moveAudio(1) : false),
    remove: () => {
      const mine = project ? selected.filter((s) => project.assignments[s]) : [];
      if (!editing() || !mine.length) return false;
      actions.unassign(mine);
    },
    silence: () => {
      const targets = rows.filter((r) => selected.includes(r.slot.source) && usable(r)).map((r) => r.slot.source);
      if (!editing() || !targets.length || !project) return false;
      actions.silence(targets);
    },
    chooseFile: (e) => { // Enter on a button presses that button
      const i = pos();
      if (!editing() || selected.length !== 1 || i < 0 || !project || !usable(rows[i]) || (e.target as Element).closest?.("button, a, summary")) return false;
      choose(rows[i].slot.source);
    },
    playPause: () => {
      const st = player.state, i = pos(), s = i >= 0 ? rows[i].slot.source : null;
      // what plays (or is paused) is the selection, a play-through, or plays on: the app's own key pauses or resumes it
      if (st.key && (st.playing || !s || st.key.startsWith("through:") || st.key.endsWith(`:${s}`))) return false;
      return play(null);
    },
    playGame: () => play("vanilla"),
    playMine: () => play("project"),
    selectAll: () => {
      if (!here()) return false;
      setSelected(rows.map((r) => r.slot.source));
    },
    copy: () => { // with text selected, the key copies that text
      if (!editing() || !selected.length || window.getSelection()?.toString()) return false;
      actions.copySlots(rows.filter((r) => selected.includes(r.slot.source)).map((r) => r.slot.source));
    },
    paste: () => {
      if (!editing() || !selected.length || !clip.length) return false;
      actions.pasteSlots(pasteTargets());
    },
  }, 1);
  useKeymap(); // the menu and the tooltips name the keys as they are now

  // Play through: the slot that plays is selected as its segment comes (its waveform shows where the music is), and
  // it stays in view. Of a segment's slots it is the one this play-through plays: the take or the layer picked.
  const nowSeg = mark?.segment ?? null;
  useEffect(() => {
    if (!mark) return;
    const of = all.filter((r) => r.seg.segment === mark.segment);
    const playing = of.find((r) => mark.clips.some((c) => c.source === r.slot.source)) ?? of[0];
    if (playing) setSelected([playing.slot.source]);
    listRef.current?.querySelector(`[data-seg="${mark.segment}"]`)?.scrollIntoView({ block: "nearest", behavior: scrollBehavior() });
  }, [mark]); // eslint-disable-line react-hooks/exhaustive-deps

  const mine = all.filter((r) => assigned[r.slot.source]).length;
  const cov = coverage(all.filter(usable).map((r) => r.slot.source), assigned);
  const fillable = all.filter(usable).length;
  // the item this cue was opened as a part of, and that part
  const item = shownItemId ? itemIndex.items.get(shownItemId) : undefined;
  const part = item?.parts.find((p) => p.cue === cue.id);
  const home = !part ? itemIndex.byCue.get(cue.id) : undefined; // opened on its own: where the Index has it
  const between = !readOnly && part && (part.kind === "bridge" || part.kind === "stinger") ? part : undefined;
  const skip = between ? between.own.filter((s) => !assigned[s]) : [];
  const listed = !!item && !!project?.library.includes(item.id);
  // in the Library, a sound set or archive whose banks the project has already, in something else: that opens instead
  const banks = readOnly && item && !listed ? listedBanks(itemIndex, project?.library ?? []) : null;
  const inside = banks && item && heldBy(banks, item) ? banks.get(cue.id) ?? null : null;
  const openInside = (source: string | null) => inside && goTo({ scope: "editor", itemId: inside.id, cueId: cue.id, source });

  const click =(e: React.MouseEvent, source: string) => {
    if (e.shiftKey && selected.length) {
      const a = rows.findIndex((r) => r.slot.source === selected[0]);
      const b = rows.findIndex((r) => r.slot.source === source);
      const [lo, hi] = a < b ? [a, b] : [b, a];
      setSelected([selected[0], ...rows.slice(lo, hi + 1).map((r) => r.slot.source).filter((s) => s !== selected[0])]);
    } else if (e.ctrlKey || e.metaKey) {
      setSelected(selected.includes(source) ? selected.filter((s) => s !== source) : [...selected, source]);
    } else setSelected([source]);
  };
  const choose = async (source: string) => {
    setSelected([source]);
    const f = await pickAudio(true);
    if (f) actions.assign(source, f);
  };

  /** Puts some slots of this cue on the export list (in list order), named after the one or after the cue. */
  const toExport = (sources: string[], name: string) => {
    const ordered = all.filter((x) => sources.includes(x.slot.source)).map((x) => x.slot.source);
    const n = exportList.add([{ cue: cue.id, sources: ordered, name, count: ordered.length,
      where: item ? where(itemIndex, item) : cue.path.join(" ▸ ") }]);
    quick(addedNote(n, 1), "add");
  };
  const exportEntry = (sel: string[], r: Row): MenuEntry => ({
    label: sel.length > 1 ? `Add the ${sel.length} slots to the export list` : "Add to the export list",
    run: () => toExport(sel, sel.length > 1 ? `${item?.full ?? cue.name} (${sel.length} slots)` : `${item?.full ?? cue.name} - ${rowName(r)}`),
  });

  /** The ids of a slot, each to copy, with the id shown next to it: the ones modders go by when they write about a
      sound (the source, the stream that holds it, the Sound or the music track that plays it). */
  const copyIds = (r: Row): MenuEntry[] => {
    const sl = r.slot, track = r.seg.stems[r.stemIndex]?.track;
    const entry = (what: string, id: string): MenuEntry => ({ label: `Copy the ${what} id`, keys: id, run: () => copyId(id, quick) });
    return [
      entry("source", sl.source),
      ...(sl.stream ? [entry("stream", sl.stream)] : []),
      ...(sl.object ? [entry("Sound", sl.object)] : []),
      ...(track && track !== "0" ? [entry("track", track)] : []),
    ];
  };

  /** What a sound can have added (the Audio Editor): new takes, which its random container picks like its own, and
      a layer beside it, which plays whenever it plays. A layer takes new takes too. */
  const addEntries = (r: Row): MenuEntry[] => {
    const g = r.seg;
    if (readOnly || !g.container) return [];
    return [
      { label: "New takes…", disabled: !project, run: () => actions.addTakes(g.container!, g.name) },
      ...(g.added === "layer" ? [] : [{ label: "New layer…", disabled: !project || !g.layer, run: () => actions.addLayer(g.container!, g.name) }]),
    ];
  };

  /** The right-click menu of a slot (it acts on the selection when the slot is part of it). */
  const slotMenu = (e: React.MouseEvent, r: Row) => {
    const s = r.slot.source;
    const sel = selected.includes(s) ? selected : [s];
    if (!selected.includes(s)) setSelected([s]);
    const a = assigned[s];
    if (readOnly) {
      openMenu(e, [
        { label: "Play the original", keys: keyLabel("playGame"), disabled: r.slot.absent, run: () => playSlot("vanilla", s, revision, rowName(r), at(s)) },
        exportEntry(sel, r),
        "-",
        ...(item ? [listed
          ? { label: "Open in the Audio Editor", run: () => goTo({ scope: "editor", itemId: item.id, cueId: cue.id, source: s }) } as MenuEntry
          : inside ? { label: "Open in the Audio Editor", run: () => openInside(s) } as MenuEntry
          : { label: `Add ${item.full} to the project`, run: () => actions.addToProject([item.id], item.full) } as MenuEntry] : []),
        ...copyIds(r),
      ]);
      return;
    }
    const ordered = rows.filter((x) => sel.includes(x.slot.source)).map((x) => x.slot.source);
    const withAudio = ordered.filter((x) => assigned[x]);
    const silenceable = rows.filter((x) => sel.includes(x.slot.source) && usable(x)).map((x) => x.slot.source);
    const many = sel.length > 1 ? ` (${sel.length} slots)` : "";
    const adds = addEntries(r);
    const entries: MenuEntry[] = [
      { label: "Play the original", keys: keyLabel("playGame"), disabled: r.slot.absent || !!r.slot.added, run: () => playSlot("vanilla", s, revision, rowName(r), at(s)) },
      { label: "Play the new audio", keys: keyLabel("playMine"), disabled: !audible(a), run: () => playSlot("project", s, revision, rowName(r), at(s)) },
      "-",
      { label: a ? "Replace with another file…" : "Choose a file…", keys: keyLabel("chooseFile"), disabled: !project || !usable(r), run: () => choose(s) },
      { label: `Copy the new audio${many}`, keys: keyLabel("copy"), disabled: !withAudio.length, run: () => actions.copySlots(ordered) },
      { label: `Paste${clip.length > 1 && sel.length === 1 ? ` ${clip.length} slots from here` : many}`, keys: keyLabel("paste"),
        disabled: !project || !clip.length, run: () => actions.pasteSlots(pasteTargets().length ? pasteTargets() : [s]) },
      { label: "Move the new audio up", keys: keyLabel("moveUp"), disabled: sel.length > 1 || !project || !a, run: () => moveAudio(-1) },
      { label: "Move the new audio down", keys: keyLabel("moveDown"), disabled: sel.length > 1 || !project || !a, run: () => moveAudio(1) },
      { label: `Replace with silence${many}`, keys: keyLabel("silence"), disabled: !project || !silenceable.length || silenceable.every((x) => assigned[x]?.silence),
        run: () => actions.silence(silenceable, false, sel.length > 1 ? `${silenceable.length} slots` : rowName(r)) },
      { label: `Remove the new audio${many}`, keys: keyLabel("remove"), disabled: !withAudio.length, run: () => actions.unassign(withAudio) },
      ...(adds.length ? ["-" as const, ...adds] : []),
      "-",
      exportEntry(sel, r),
      { label: "Show the file in its folder", disabled: !a?.exists || a.silence, run: () => reveal(fullPath(project!.folder, a!.audio)) },
      ...copyIds(r),
    ];
    openMenu(e, entries);
  };

  const nav = (
    <div className="nav-btns">
      <button className="icon-btn" onClick={back} disabled={!nav_.back} data-tip="Back" data-tip-cmd="back" aria-label="Back">‹</button>
      <button className="icon-btn" onClick={forward} disabled={!nav_.forward} data-tip="Forward" data-tip-cmd="forward" aria-label="Forward">›</button>
    </div>
  );
  // files dropped on the header or the toolbar fill a music cue's slots, in the Editor
  const drop = !readOnly && music ? JSON.stringify({ kind: "cue", cue: cue.id }) : undefined;
  // how tall the header or the waveforms may get: the slot list keeps at least 120px
  const room = (panel: "top" | "wave") => {
    const c = cueRef.current;
    if (!c) return 400;
    const h = (sel: string) => c.querySelector(sel)?.getBoundingClientRect().height ?? 0;
    return c.getBoundingClientRect().height - h(".cue-bar") - h(panel === "top" ? ".timeline" : ".cue-top") - 120;
  };

  // what the rows do, with one identity for the life of the list: the rows are memoised, and a selection change then
  // draws the two rows it changes instead of every row of the bank
  const on: RowHandlers = useStable({
    click: (e: React.MouseEvent, source: string) => click(e, source),
    select: (source: string) => { if (!selected.includes(source)) setSelected([source]); },
    choose: (source: string) => choose(source),
    menu: (e: React.MouseEvent, r: Row) => slotMenu(e, r),
    remove: (source: string) => { actions.unassign([source]); },
    toggle: (segIndex: number) => setFlipped((f) => { const next = new Set(f); if (next.has(segIndex)) next.delete(segIndex); else next.add(segIndex); return next; }),
    openTag: (id: string, cueId: string) => { show(id, cueId); },
    add: (e: React.MouseEvent, first: Row) => openMenu(e, addEntries(first)),
    groupMenu: (e: React.MouseEvent, first: Row) => {
      const takes = takesOf.get(first.segIndex) ?? NONE, replaced = takes.filter((s) => assigned[s]);
      const name = first.seg.name, n = `${takes.length} ${takes.length === 1 ? "take" : "takes"}`;
      openMenu(e, [
        { label: "Play the first take", run: () => playSlot("vanilla", first.slot.source, revision, rowName(first), at(first.slot.source)) },
        ...(readOnly ? [] : ["-",
          { label: `Choose files for its ${n}…`, disabled: !project || !takes.length,
            run: async () => { const f = await pickAudio(true); if (f) actions.fillSources(takes, f, `the takes of ${name}`); } },
          { label: `Replace its ${n} with silence`, disabled: !project || !takes.length || takes.every((s) => assigned[s]?.silence),
            run: () => actions.silence(takes, false, name) },
          { label: `Remove the new audio from its ${n}`, disabled: !replaced.length, run: () => actions.unassign(replaced) },
          ...(addEntries(first).length ? ["-", ...addEntries(first)] : []),
          "-"] as MenuEntry[]),
        { label: `Add its ${first.takes} ${first.takes === 1 ? "take" : "takes"} to the export list`,
          run: () => toExport(all.filter((r) => r.segIndex === first.segIndex).map((r) => r.slot.source), `${item?.full ?? cue.name} - ${name}`) },
      ]);
    },
  });
  const slot = (r: Row) => (
    <SlotRow key={r.slot.source} row={r} a={readOnly ? undefined : assigned[r.slot.source]} selected={selected.includes(r.slot.source)}
      now={r.seg.segment !== "" && r.seg.segment === nowSeg} itemId={shownItemId} cueId={cue.id} on={on} />
  );
  /** A bank's sounds: each group under a line that folds it, says how many takes it has and plays the first. */
  const groups = () => {
    const out: React.ReactNode[] = [];
    let i = 0;
    const list = hits ? rows : all;
    while (i < list.length) {
      const first = list[i];
      let j = i;
      while (j < list.length && list[j].segIndex === first.segIndex) j++;
      const of = list.slice(i, j);
      i = j;
      if (first.takes === 1 || !first.seg.group) { out.push(...of.map(slot)); continue; }
      const open = !!hits || isOpen(first);
      const sources = takesOf.get(first.segIndex) ?? NONE;
      out.push(
        <GroupHead key={`g${first.segIndex}`} row={first} open={open} shown={hits ? of.length : first.takes} itemId={shownItemId} cueId={cue.id}
          sources={sources} status={readOnly || !project ? "na" : statusOf(coverage(sources, assigned))} on={on} />,
      );
      if (open) out.push(...of.map(slot));
    }
    return out;
  };
  const folds = (r: Row) => r.takes > 1 && !!r.seg.group; // a group with a line of its own to fold it under
  const anyOpen = grouped && all.some((r) => folds(r) && isOpen(r));
  // folded is the default for big banks (nothing flipped) and the exception for the others (every group flipped)
  const collapseAll = () => setFlipped(new Set(openByDefault ? all.filter((r) => folds(r) && r.firstOfSeg).map((r) => r.segIndex) : []));

  return (
    <section className={`cue${readOnly ? " ro" : ""}`} aria-label={cue.name} ref={cueRef}>
      <div className={`cue-top${headH != null ? " sized" : ""}`} style={headH != null ? { height: headH } : undefined}>
        <header className="cue-head view-in" key={item?.id ?? cue.id} data-drop={drop}>
          {item && part ? <ItemHead item={item} part={part} cue={cue} nav={nav} /> : (
            <>
              <div className="head-row"><div className="crumbs">{cue.path.join(" ▸ ")}</div>{nav}</div>
              <div className="item-title">
                <h1>{cue.name}</h1>
                {!readOnly && project && cov.total > 0 && (
                  <span className={`item-cov ${statusOf(cov)}`}><Mark status={statusOf(cov)} />{COVERAGE[statusOf(cov)]}</span>
                )}
              </div>
              {cue.detail && cue.curated === false && <p className="cue-detail">{cue.detail}</p>}
              {home && (
                <p className="cue-detail">In the Index: <button className="link-text"
                  onClick={() => show(home.item.id, home.part.cue)}>
                  {itemIndex.section.get(home.item.id)?.name} ▸ {home.item.name}{home.part.name && home.item.parts.length > 1 ? ` ▸ ${home.part.name}` : ""}</button></p>
              )}
            </>
          )}
          {part?.note && <p className="cue-notes">{part.note}</p>}
          {cue.notes && (!part || cue.locked || !music) && <p className={`cue-notes${cue.locked ? " warn" : ""}`}>{cue.notes}</p>}
          {between && between.own.length < between.targets.length && (
            <p className="cue-notes">{between.own.length ? `${between.targets.length - between.own.length} of its ${between.targets.length} slots also belong`
              : "Its audio also belongs"} to other music, and {between.own.length ? "they change" : "it changes"} along with that music.</p>
          )}
        </header>
        <ResizeEdge edge="bottom" label="Resize the header" min={56} max={() => room("top")}
          onResize={setHeadH} onReset={() => setHeadH(null)} />
      </div>
      <div className="cue-bar" data-drop={drop}>
        {readOnly && item && (listed ? (
          <button className="btn primary" data-tip="Open it to give it new audio"
            onClick={() => goTo({ scope: "editor", itemId: item.id, cueId: cue.id, source: selected[0] ?? null })}>Open in the Audio Editor</button>
        ) : inside ? (
          <button className="btn primary" data-tip="Its sounds are in the project already" data-tip-more={`In ${listName(inside)}`}
            onClick={() => openInside(selected[0] ?? null)}>Open in the Audio Editor</button>
        ) : (
          <button className="btn primary" data-tip={project ? `Add to ${project.name}` : "Open or create a project first"}
            onClick={() => actions.addToProject([item.id], item.full)}>Add to the project</button>
        ))}
        {!readOnly && music && cue.kind !== "sound" && (
          <button className="btn primary" disabled={!fillable} data-tip="Choose files for the slots, in play order"
            onClick={async () => { const f = await pickAudio(true); if (f) actions.fill(cue.id, f); }}>
            Fill from files…
          </button>
        )}
        {!readOnly && item && isMusicItem(item) && <ItemActions item={item} />}
        {!readOnly && music && fillable > 1 && (
          <button className="btn" disabled={!project} data-tip={project ? "Cut one song into pieces, one per slot" : "Open a project first"}
            onClick={() => setSlicing(true)}>Slice a song…</button>
        )}
        {cue.kind !== "sound" && (
          <button className="btn" data-tip="Save as WAV, FLAC or MP3" onClick={() => setExporting(true)}>Export…</button>
        )}
        {between && project && skip.length > 0 && (
          <button className="btn" data-tip={`Replace with a short silence, so the game goes straight to the next music${keyHint("undo") ? `. Undo${keyHint("undo")} brings it back` : ""}`}
            onClick={() => actions.skip(skip, between.name || item?.name || cue.name)}>Skip it</button>
        )}
        {!readOnly && mine > 0 && (
          <button className="btn quiet" onClick={() => actions.unassign(all.map((r) => r.slot.source).filter((s) => assigned[s]))}>
            {all.every((r) => !assigned[r.slot.source] || assigned[r.slot.source].silence) ? between ? "Undo the skip" : "Remove the silence"
              : part && item && item.parts.length > 1 ? "Clear this part" : "Clear this cue"}
          </button>
        )}
        {grouped && all.length > 12 && (
          <div className="cue-filter">
            <input type="search" placeholder="Filter these sounds" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter these sounds"
              data-tip="By name, words of a voice line, or id" data-tip-side="top"
              onKeyDown={(e) => { if (e.key === "Escape") { if (filter) setFilter(""); else e.currentTarget.blur(); } }} />
            {!hits && all.some(folds) && (
              <button className="icon-btn" disabled={!anyOpen} onClick={collapseAll} aria-label="Collapse all"
                data-tip={anyOpen ? "Collapse all sounds" : "Every sound is collapsed"}><CollapseAllIcon /></button>
            )}
          </div>
        )}
        {music && cue.kind !== "sound" && <PlayThrough onThrough={setThrough} onMark={setMark} />}
      </div>
      {item && part && item.parts.length > 1 && <PartTabs item={item} part={part} />}

      <div className="slots view-in" key={cue.id} ref={listRef} role="listbox" aria-multiselectable aria-label={grouped ? "Sounds" : "Slots"}>
        {grouped ? groups() : rows.map(slot)}
        {hits && hits.length > MAX_SHOWN && <p className="slots-note">Showing the first {MAX_SHOWN} of {hits.length} sounds that match. Type more to narrow them down.</p>}
        {hits && !hits.length && <p className="slots-note">No sound here matches “{filter.trim()}”.</p>}
      </div>
      <Timeline room={() => room("wave")} through={through} at={selected.length === 1 ? at(selected[0]) : null} />
      {menu}
      {slicing && <SliceTool onClose={() => setSlicing(false)} />}
      {exporting && <ExportDialog onClose={() => setExporting(false)} />}
    </section>
  );
}

/** What a list's rows do, from the list (useStable keeps one identity for each). */
type RowHandlers = {
  click: (e: React.MouseEvent, source: string) => void; select: (source: string) => void; choose: (source: string) => void;
  menu: (e: React.MouseEvent, r: Row) => void; remove: (source: string) => void; toggle: (segIndex: number) => void;
  openTag: (id: string, cueId: string) => void; groupMenu: (e: React.MouseEvent, first: Row) => void;
  add: (e: React.MouseEvent, first: Row) => void;
};

/** The + at the end of a sound's line in the Audio Editor: new takes for it, or a layer beside it. */
function AddButton({ row, on }: { row: Row; on: RowHandlers }) {
  const { readOnly } = useLite();
  if (readOnly || !row.seg.container) return null;
  // the takes' audio can be in banks the container isn't: added audio goes only where the container is
  const { copies = 0, shared = 0 } = row.seg;
  const where = copies ? `. The ${copies} other bank${copies === 1 ? "" : "s"} with this sound get${copies === 1 ? "s" : ""} it too`
    : shared ? ". Only this bank gets it. The other banks with this audio play it from sounds of their own" : "";
  return (
    <button className="icon-btn grp-add" aria-label={`Add new audio to ${row.seg.name}`} data-tip="Add new audio"
      data-tip-more={(row.seg.added === "layer" ? "New takes for this layer" : "New takes, or a layer that plays with it") + where}
      onClick={(e) => { e.stopPropagation(); on.add(e, row); }} onDoubleClick={(e) => e.stopPropagation()}>+</button>
  );
}

/** A tag on a row of audio the project adds: a new take, or a clip of its own. */
function AddedTag({ slot }: { slot: Slot }) {
  if (slot.added) return <span className="tag new" data-tip={ADDED_TIP.take}>new take</span>;
  if (slot.was) return <span className="tag new" data-tip={ADDED_TIP.own}>only this sound</span>;
  return null;
}
const ADDED_TIP = {
  take: "A take added by the project. The game picks it like the other takes. It has no original",
  own: "The new audio plays only in this sound. Other sounds that play the clip keep the original",
};

/** Where a row's slot is, for the now-playing bar to lead back to. */
function useAt(itemId: string | null, cueId: string, source: string): PlayedAt {
  const { scope } = useLite();
  return useMemo(() => ({ scope, itemId, cueId, source }), [scope, itemId, cueId, source]);
}

/** The line above the takes of one sound: it folds them, says how many there are, plays the first, and takes files
    dropped on it (one per take, in order). In a bank's listing it also carries what the Index knows about a segment
    of music, as a link to it. Memoised: it draws again only when something it shows changes. */
const GroupHead = memo(function GroupHead({ row, open, shown, status, itemId, cueId, sources, on }: {
  row: Row; open: boolean; shown: number; status: "none" | "part" | "done" | "na"; itemId: string | null; cueId: string;
  sources: string[]; on: RowHandlers;
}) {
  const { readOnly } = useLite();
  const { seg, slot, takes } = row;
  const at = useAt(itemId, cueId, slot.source);
  const drop = useMemo(() => (readOnly ? undefined : JSON.stringify({ kind: "sources", sources, what: `the takes of ${seg.name}` })),
    [readOnly, sources, seg.name]);
  const shared = seg.shared ?? 0;
  // the takes of one sound, or (a run cut out of a long list) just sounds
  const unit = /^(Sounds|Other Audio|No Audio|Streams)\b/.test(seg.name) ? "sounds" : "takes";
  return (
    <div className={`grp${open ? " open" : ""}`} data-drop={drop} onContextMenu={(e) => on.groupMenu(e, row)}>
      <PlayButton kind="vanilla" source={slot.source} label={`the first of ${seg.name}`} what={rowName(row)} small at={at} disabled={slot.absent || !!slot.added} />
      <button className="grp-head" aria-expanded={open} onClick={() => on.toggle(row.segIndex)}>
        <span className="caret" aria-hidden>▸</span>
        <span className={`grp-name${seg.added ? " new" : ""}`} data-tip={seg.name} data-tip-clip>{seg.name}</span>
        <span className="grp-n">{shown < takes ? `${shown} of ${takes}` : takes} {unit}</span>
      </button>
      <span className="grp-meta">
        {(seg.tags ?? []).map((t) => <CatTag key={t.item ?? t.name} tag={t} tip="Show it in the Index" onOpen={t.item ? () => on.openTag(t.item!, seg.cue ?? "") : undefined} />)}
        {seg.added === "layer" && <span className="tag new" data-tip={LAYER_TIP}>layer</span>}
        {shared > 0 && <Linked tip={`Its audio is also in ${shared} other bank${shared === 1 ? "" : "s"}. New audio on its takes plays there too`}><OtherBanks n={shared} /></Linked>}
        {status !== "na" && <Mark status={status} />}
        {!readOnly && seg.key && <NoteButton k={noteKeys.group(seg.key)} name={seg.name} />}
        <AddButton row={row} on={on} />
      </span>
    </div>
  );
});

/** Copies an id and says so. */
function copyId(id: string, quick: (text: string, icon?: "copy" | "info") => void) {
  copyText(id, quick);
}

/** A slot's source id at the end of its line: click to copy it; the right-click menu has its other ids. */
function SlotId({ id }: { id: string }) {
  const { quick } = useLite();
  return (
    <button className="slot-id" data-tip="Copy the source id" data-tip-more="Right-click the row for its other ids"
      onClick={(e) => { e.stopPropagation(); copyId(id, quick); }} onDoubleClick={(e) => e.stopPropagation()}>{id}</button>
  );
}

/** A tag saying the audio is linked to other places: the same sound plays in other cues or banks, so replacing it
    changes it there too. The chain says "linked" before the words are read. */
function Linked({ children, tip = "Linked to other places. New audio here plays there too" }: { children: React.ReactNode; tip?: string }) {
  return <span className="tag linked" data-tip={tip}><LinkIcon />{children}</span>;
}

/** "in N other banks", whose words a narrow list leaves out (the chain and the number stay; the tip says it in full). */
function OtherBanks({ n }: { n: number }) {
  return <><span className="lk-words">in </span>{n}<span className="lk-words"> other bank{n === 1 ? "" : "s"}</span></>;
}

/** Counts the changes of a value after the first render; a new count replays the flash that shows what an edit
    (a fill, a paste, a move, an undo) just changed. */
function useFlash(value: string) {
  const prev = useRef(value);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    setN((x) => x + 1);
  }, [value]);
  return n;
}

/** One slot. Memoised: it draws again only when something it shows changes (its audio, its selection, playback),
    not whenever the list does. */
const SlotRow = memo(function SlotRow({ row, a, selected, now, itemId, cueId, on }: {
  row: Row; a?: Assignment; selected: boolean; now: boolean; itemId: string | null; cueId: string; on: RowHandlers;
}) {
  const { revision, readOnly } = useLite();
  const { seg, slot } = row;
  const at = useAt(itemId, cueId, slot.source);
  const onSelect = () => on.select(slot.source);
  const label = slot.label || (row.stems > 1 ? `Stem ${row.stemIndex + 1}` : "");
  const loops = seg.loop === 0 ? "loops" : seg.loop > 1 ? `×${seg.loop}` : "";
  const game = usePlayerLook(`vanilla:${slot.source}`), yours = usePlayerLook(`project:${slot.source}`);
  const playing = game.playing || yours.playing;
  const flash = useFlash(a ? `${a.audio}|${a.silence}` : "");
  const [flashed, setFlashed] = useState(0); // the flash that has played: taken away, or it would play again whenever the Audio Editor tab comes back
  const what = rowName(row);
  const gameMs = slot.duration_ms || seg.duration_ms;
  const inGroup = !!seg.group && row.takes > 1; // a take of a sound: its group's line above says what it is
  // a sound with one take: drawn like a group's line (play, name, where else it is), so every sound looks alike
  const solo = !!seg.group && row.takes === 1;
  const also = slot.also_n ?? slot.also_in.length;
  const banks = slot.banks ?? 0;
  return (
    <div className={`slot${solo ? " solo" : ""}${selected ? " selected" : ""}${a ? " assigned" : ""}${slot.unused || slot.absent ? " unused" : ""}${slot.locked ? " locked" : ""}${row.firstOfSeg && !inGroup ? " seg-start" : ""}${inGroup ? " take" : ""}${playing ? " playing-row" : ""}${now ? " now" : ""}`}
      role="option" aria-selected={selected} data-source={slot.source} data-seg={row.firstOfSeg ? seg.segment : undefined} onClick={(e) => on.click(e, slot.source)}
      onMouseDown={(e) => { if (e.shiftKey) e.preventDefault(); }} // Shift+click selects a range of slots, not the text between them
      onDoubleClick={() => { if (audible(a) || !slot.absent) playSlot(audible(a) ? "project" : "vanilla", slot.source, revision, what, at); }}
      onContextMenu={(e) => on.menu(e, row)}
      data-drop={readOnly || slot.absent ? undefined : JSON.stringify({ kind: "slot", source: slot.source })}>
      {flash > flashed && <span key={flash} className="slot-flash" aria-hidden onAnimationEnd={() => setFlashed(flash)} />}
      {solo ? (
        <div className="slot-name solo-line">
          <PlayButton kind="vanilla" source={slot.source} label="the original" what={what} onPlay={onSelect} at={at} disabled={slot.absent || !!slot.added} small />
          <span className="caret ghost" aria-hidden>▸</span>
          <span className={`grp-name${seg.added ? " new" : ""}`} data-tip={seg.name} data-tip-more={seg.added ? LAYER_TIP : undefined}
            data-tip-clip={seg.added ? undefined : true}>{seg.name}</span>
          {!seg.added && <span className="grp-n" data-tip={gameMs ? fmtTime(gameMs) : undefined}>{label && !seg.name.includes(label) ? label : "1 take"}</span>}
          <span className="grp-meta">
            {slot.absent && <span className="tag" data-tip={NO_AUDIO_TIP}>no audio</span>}
            {slot.locked && <span className="tag warn">do not touch</span>}
            {seg.added !== "layer" && <AddedTag slot={slot} />}
            <NoteTags slot={slot} />
            {(seg.tags ?? []).map((t) => <CatTag key={t.item ?? t.name} tag={t} />)}
            {also > 0 && <Linked>{banks >= also ? <OtherBanks n={also} /> : `+${also} ${banks ? "more" : `cue${also > 1 ? "s" : ""}`}`}</Linked>}
            {!readOnly && <NoteButton k={noteKeys.clip(slot.source)} name={what} />}
            <AddButton row={row} on={on} />
          </span>
          {!seg.added && <SlotId id={slot.source} />}
        </div>
      ) : (
      <div className="slot-name">
        {/* the original plays from the start of the line, as it does on a group's line and in the lists */}
        <PlayButton kind="vanilla" source={slot.source} label="the original" what={what} onPlay={onSelect} at={at} disabled={slot.absent || !!slot.added} />
        <div className="slot-text">
          {inGroup ? null : row.firstOfSeg ? (
            <span className="seg-name">{seg.name}
              {/* a music segment of several slots has a note of its own; one of a single slot shares the slot's */}
              {!readOnly && !seg.group && seg.segment && row.takes > 1 && <NoteButton k={noteKeys.segment(seg.segment)} name={seg.name} />}
            </span>
          ) : <span className="seg-cont" aria-hidden />}
          <span className="slot-sub" data-tip={label ? [label, slot.variant].filter(Boolean).join(" · ") : undefined} data-tip-clip>
            {label && <span className={`slot-label${label.length < 16 ? " nowrap" : ""}`}>{label}</span>}{slot.variant && <span className="tag">{slot.variant}</span>}
            {loops && <span className="tag">{loops}</span>}
            {slot.unused && <span className="tag" data-tip="The game never plays this clip">never heard</span>}
            {slot.absent && <span className="tag" data-tip={NO_AUDIO_TIP}>no audio</span>}
            {slot.locked && <span className="tag warn">do not touch</span>}
            <AddedTag slot={slot} />
            {audible(a) && slot.min_ms && a!.duration_ms != null && a!.duration_ms < slot.min_ms && (
              <span className="tag warn" data-tip={`The new audio is too short. This clip needs at least ${fmtTime(slot.min_ms)}`}>too short</span>
            )}
            <NoteTags slot={slot} />
            {!inGroup && row.firstOfSeg && (seg.tags ?? []).map((t) => <CatTag key={t.item ?? t.name} tag={t} />)}
            {also > 0 && !(inGroup && (seg.shared ?? 0) > 0) && (
              <Linked>+{also} {banks >= also ? `bank${also > 1 ? "s" : ""}` : banks ? "more" : `cue${also > 1 ? "s" : ""}`}</Linked>
            )}
          </span>
        </div>
        {!readOnly && <NoteButton k={noteKeys.clip(slot.source)} name={what} />}
        <SlotId id={slot.source} />
      </div>
      )}
      {solo ? null : (
        <div className="slot-game"><span className="len">{gameMs ? fmtTime(gameMs) : "–"}</span></div>
      )}
      {/* the replacement: played, chosen, replaced and removed here, and nowhere else on screen (the details panel
          sets it up). Its name is the button that picks another file. */}
      {!readOnly && (
        <div className="slot-mine">
          {a?.silence ? (
            <>
              <span className="silence-mark" aria-hidden />
              <button className="file silent" data-tip="Replace the silence with a file" data-tip-more={a.fit_timing ? SILENCE_TIP.move : SILENCE_TIP.keep}
                onClick={(e) => { e.stopPropagation(); on.choose(slot.source); }} onDoubleClick={(e) => e.stopPropagation()}>Silence</button>
              <span className="tag">{a.fit_timing ? "moves on" : "keeps timing"}</span>
              <button className="x" aria-label="Remove the silence" data-tip="Remove the silence" data-tip-cmd="remove"
                onClick={(e) => { e.stopPropagation(); on.remove(slot.source); }}>✕</button>
            </>
          ) : a ? (
            <>
              <PlayButton kind="project" source={slot.source} label="the new audio" disabled={!a.exists} what={what} onPlay={onSelect} at={at} />
              <button className={`file${a.exists ? "" : " missing"}`} data-tip="Replace with another file" data-tip-more={a.audio}
                onClick={(e) => { e.stopPropagation(); on.choose(slot.source); }} onDoubleClick={(e) => e.stopPropagation()}>
                {a.exists ? a.name : `Missing: ${a.name}`}</button>
              {a.duration_ms != null && (
                <span className={`len mine-len${slot.min_ms && a.duration_ms < slot.min_ms ? " short" : ""}`}
                  data-tip={slot.min_ms && a.duration_ms < slot.min_ms ? `Too short. This clip needs at least ${fmtTime(slot.min_ms)}` : gameMs ? `Original: ${fmtTime(gameMs)}` : undefined}>
                  {fmtTime(a.duration_ms)}</span>
              )}
              {a.gain_db !== 0 && <span className="gain">{a.gain_db > 0 ? "+" : ""}{a.gain_db} dB</span>}
              <button className="x" aria-label="Remove the new audio" data-tip="Remove the new audio" data-tip-cmd="remove"
                onClick={(e) => { e.stopPropagation(); on.remove(slot.source); }}>✕</button>
            </>
          ) : (
            <button className="drop-hint" onClick={(e) => { e.stopPropagation(); on.choose(slot.source); }}
              onDoubleClick={(e) => e.stopPropagation()} data-tip-cmd="chooseFile" data-tip={slot.absent ? undefined : "Choose a file"}
              disabled={slot.absent}>Drop audio or choose a file</button>
          )}
        </div>
      )}
    </div>
  );
});

const NO_AUDIO_TIP = "Not in the installed game files, so there is nothing to play or replace";
const LAYER_TIP = "A layer added by the project. It plays whenever the sound above it plays";

/** A bank that is still being read: the first time one is opened takes a second or two. */
function CueLoading() {
  return (
    <section className="cue empty">
      <p className="loading cue-loading">Reading its sounds…</p>
    </section>
  );
}

function CueEmpty() {
  const { project, scope } = useEditor();
  if (scope === "library") {
    return (
      <section className="cue empty">
        <div className="empty-card">
          <h1>Everything the game plays</h1>
          <p>Press ▶ to play anything. Open an entry to see its slots, and add it to {project ? <b>{project.name}</b>
            : <>a project <span className="nowrap">(<button className="link-text" onClick={() => tabs.go("home")}>Home</button>)</span></>} to replace it.</p>
          <p><WikiLink page="game-audio" about="Archives, banks, sounds and slots">The game's audio, explained</WikiLink></p>
        </div>
      </section>
    );
  }
  return (
    <section className="cue empty">
      <div className="empty-card">
        <h1>{project ? "Nothing open" : "No project open"}</h1>
        {project ? (
          <>
            <p>Open something on the left and drop audio on its slots. More is in
              the <button className="link-text" onClick={() => tabs.go("library")}>Library</button>.</p>
            <p><WikiLink page="first-mod" about="A first mod">A first mod, step by step</WikiLink></p>
          </>
        ) : (
          <p>Open or create one on <button className="link-text" onClick={() => tabs.go("home")}>Home</button>.</p>
        )}
      </div>
    </section>
  );
}
