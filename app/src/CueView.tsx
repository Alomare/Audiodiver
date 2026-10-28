import { Fragment, memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { ph, plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { andList, audioUrl, fmtDecimal, fmtNumber, fmtTime, isMusic, shownId, type Assignment, type Cue, type Segment, type Slot, type StandIn } from "./api";
import { useContextMenu, type MenuEntry } from "./ContextMenu";
import { ExportListChip, ExportPanel, useExportName, type ExportTarget } from "./ExportDialog";
import { addedNote, exportList } from "./exportList";
import { ClearIcon, CollapseAllIcon, ExportIcon, FillIcon, IdIcon, LinkIcon, OrderIcon, PlusIcon, SkipIcon, SliceIcon } from "./Icons";
import { Mark } from "./IndexTree";
import { ItemActions, ItemHead, PartHead, partsFold, PartTabs } from "./ItemHead";
import { keyHint, keyLabel, useCommands, useKeymap } from "./keys";
import { useListWindow, type WindowLine } from "./listWindow";
import { coverage, COVERAGE, heldBy, isMusicItem, listedBanks, listName, statusOf, where } from "./music";
import { nav as tabs } from "./nav";
import { copyText, fullPath, pickAudio, reveal } from "./platform";
import { PlayThrough, type Mark as ThroughMark, type Through } from "./PlayThrough";
import { player, usePlayerLook, type PlayedAt } from "./player";
import { ResizeEdge, useStoredHeight } from "./Resize";
import { settings, useSettings } from "./settings";
import { SliceTool } from "./SliceTool";
import { openInSoundtrack } from "./Soundtrack";
import { useStable } from "./stable";
import { Help, WikiLink } from "./Wiki";
import { useEditor, useLite, useShownTabs } from "./store";
import { CatTag } from "./Tags";
import { DEFAULT_SIZE, DENSITIES, scrollBehavior, useThemeValue } from "./theme";
import { Timeline } from "./Timeline";
import { Elsewhere, PanelToggles, SlotSearch, ToolButton, usePanels } from "./Tools";

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

/** A music segment of several slots (its tracks): its name has a line of its own over them. */
const titled = (r: Row) => !r.seg.group && r.takes > 1;

/** "Loadout #3", "Segment 2 · Stem 3" when a segment has several stems, "Sound 4 · Take 2" for one take of a sound:
    what a slot is, for the now-playing bar and notices. A voice line goes by what it says. */
export function rowName(r: Row) {
  if (r.stems > 1) return `${r.seg.name} · ${r.slot.label || t`Stem ${ph({ n: r.stemIndex + 1 })}`}`;
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
  move: t`Plays nothing, and the game moves straight on`,
  keep: t`Plays nothing for the length of the original, so the timing doesn't change`,
};

/** Whether a slot has new audio to listen to: a file that is there, not silence. */
export const audible = (a?: Assignment) => !!a?.exists && !a.silence;

/** Plays the original audio of a slot ("vanilla") or its replacement ("project"). Switching sides on the same slot
    keeps the position, so A/B comparisons line up. `at` says where the slot is, so the now-playing bar can lead back
    to it. */
export function playSlot(kind: "vanilla" | "project", source: string, revision: number, what: string, at: PlayedAt | null = null) {
  const other = `${kind === "vanilla" ? "project" : "vanilla"}:${source}`;
  player.play(`${kind}:${source}`, audioUrl(kind, source, kind === "project" ? String(revision) : ""),
    player.state.key === other, kind === "vanilla"
      ? t({ message: `${what} · original`, comment: "The now-playing bar: what plays, and that it is the original audio" })
      : t({ message: `${what} · replaced`, comment: "The now-playing bar: what plays, and that it is the new audio" }), at);
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
  const tip = playing ? t({ message: `Pause ${label}`, comment: "label: what plays, such as 'the original' or 'the new audio'" })
    : t({ message: `Play ${label}`, comment: "label: what plays, such as 'the original' or 'the new audio'" });
  return (
    <button className={`play ${kind}${small ? " small" : ""}${playing ? " playing" : ""}`} disabled={disabled}
      aria-label={tip} data-tip={tip}
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

let pen: CanvasRenderingContext2D | null = null;
const widths = new Map<string, number>();
/** The width of a line of text in the body font, at `px` and `weight` (measured once, kept). */
function textWidth(text: string, px: number, weight = 400) {
  const family = getComputedStyle(document.body).fontFamily;
  const key = `${weight} ${px}px ${family}|${text}`;
  let w = widths.get(key);
  if (w === undefined) {
    pen ??= document.createElement("canvas").getContext("2d");
    if (!pen) return text.length * px * 0.55;
    pen.font = `${weight} ${px}px ${family}`;
    w = pen.measureText(text).width;
    widths.set(key, w);
  }
  return w;
}
const DROP_HINT = t`Drop Audio or Choose a File`;
/** The words on the line of a slot replaced with silence, shown and measured (useMineWidth) alike. */
const SILENT = {
  name: t`Silence`,
  move: t({ message: "moves on", comment: "Tag on a slot replaced with silence: the game moves straight on" }),
  keep: t({ message: "keeps timing", comment: "Tag on a slot replaced with silence: it stays silent as long as the original plays" }),
};
/** The name of new audio whose file isn't there any more, shown and measured alike. */
const missing = (name: string) => t`Missing: ${name}`;

/** How wide the new audio column is (`mine`): what its widest line needs (a file with its gain box, length and ✕,
    silence, or the drop hint), so the column lines up from row to row and leaves the rest of the row to the names. It
    is worked out from the text rather than from what is drawn, so the rows a long list leaves undrawn count too.
    `gain`: the width of the gain box. */
function useMineWidth(all: Row[], assigned: Record<string, Assignment>, on: boolean) {
  const t = useThemeValue((x) => `${x.size}|${x.density}|${x.bodyFont}`);
  const [fonts, setFonts] = useState(() => document.fonts?.status === "loaded");
  useEffect(() => { if (!fonts) document.fonts?.ready.then(() => setFonts(true)); }, [fonts]);
  return useMemo(() => {
    if (!on) return { mine: 0, gain: 0 };
    const [size, density] = t.split("|");
    const fs = Number(size) / DEFAULT_SIZE, sp = DENSITIES.find(([d]) => d === density)?.[2] ?? 1;
    const play = 24 + 6 * sp, gap = 8, x = 24, frame = 12; // .play, .slot-mine's gap, .x, its padding
    // Make-Up Gain has a box as wide as its widest value on every line with new audio, set or not: moving the slider
    // never changes the width of the column
    const gain = gainBox(fs);
    let w = frame + 22 + textWidth(DROP_HINT, 13 * fs);   // .drop-hint: its padding and border
    for (const r of all) {
      const a = assigned[r.slot.source];
      if (!a) continue;
      const len = a.duration_ms != null ? gap + textWidth(fmtTime(a.duration_ms), 13 * fs) : 0;
      const line = a.silence
        ? play + gap + textWidth(SILENT.name, 14 * fs) + gap + 14 + textWidth(a.fit_timing ? SILENT.move : SILENT.keep, 12 * fs) + gap + x
        : play + gap + textWidth(a.exists ? a.name : missing(a.name), 14 * fs) + len + gap + gain + gap + x;
      w = Math.max(w, frame + 3 + line); // + the replaced line's left border
    }
    return { mine: Math.ceil(w) + 2, gain };
  }, [all, assigned, on, t, fonts]);
}

/** The width of the Make-Up Gain box on a line with new audio: the widest value, "−88.5 dB". */
const gainBox = (fs: number) => Math.ceil(textWidth("−88.5 dB", 12 * fs, 500)) + 2;

const NONE: string[] = [];
const NO_ASSIGNMENTS: Record<string, Assignment> = {}; // one empty object, so the memos below keep without a project
const NO_STAND_INS: Record<string, StandIn[]> = {};
const NO_GAINS: Record<string, number> = {};
const OPEN_ALL = 200;    // a bank with more sounds than this opens with its groups folded
const MAX_SHOWN = 300;    // a filter shows at most this many sounds at once
const WINDOW_FROM = 150;  // a list with more lines than this draws only those near the view (useListWindow)

function CueBody({ cue }: { cue: Cue }) {
  const { project, selected, setSelected, actions, shownItemId, itemIndex, show, goTo, openItem, revision, clip, back, forward, nav: nav_,
    scope, readOnly, quick } = useEditor();
  const music = isMusic(cue);
  const grouped = cue.kind === "sounds";
  const bank = cue.id.startsWith("bank:");
  const ids = useSettings().soundNames === "ids"; // a bank's sounds by container ID: the toggle beside the search
  const all = useMemo(() => rowsOf(cue.segments_detail), [cue]);
  const listRef = useRef<HTMLDivElement>(null);
  const [slicing, setSlicing] = useState(false);
  const [exporting, setExporting] = useState<"item" | "list" | null>(null); // the Export panel, on its first tab or on the list
  const [through, setThrough] = useState<Through | null>(null);  // the play-through that is playing, if one is
  const [mark, setMark] = useState<ThroughMark | null>(null);    // where it is: the segment whose Entry it passed last
  const [menu, openMenu] = useContextMenu();
  const assigned = project?.assignments ?? NO_ASSIGNMENTS;
  const gains = project?.gains ?? NO_GAINS;
  const standIns = project?.stand_ins ?? NO_STAND_INS;
  const cueRef = useRef<HTMLElement>(null);
  const [headH, setHeadH] = useStoredHeight("audiodiver.headHeight", null); // null: as tall as its content
  const [panels, setPanels] = usePanels(scope); // whether the header and the waveforms show
  const shown = useShownTabs();
  const column = useMineWidth(all, assigned, !readOnly);

  // a bank's sounds come in groups (the takes of one sound) that fold, and a filter narrows them
  const [filter, setFilter] = useState("");
  const [flipped, setFlipped] = useState<Set<number>>(() => new Set()); // the groups folded or opened by hand
  const [shut, setShut] = useState(false); // a transition's or stinger's open part, folded by hand (PartHead)
  useEffect(() => { if (selected.length) setShut(false); }, [selected]); // a slot selected from the keys or elsewhere shows
  const openByDefault = !grouped || all.length <= OPEN_ALL;
  // (a segment of music a bank holds isn't a group: its slots always show, under its own name)
  const isOpen = useCallback((r: Row) => r.takes === 1 || !r.seg.group || flipped.has(r.segIndex) !== openByDefault, [flipped, openByDefault]);
  // the list follows the search a beat behind the typing, in a render that typing can interrupt
  const typed = useDeferredValue(filter);
  const q = typed.trim().toLowerCase();
  const hits = useMemo(() => {
    if (!q) return null;
    const words = q.split(/\s+/);
    return all.filter((r) => {
      const sl = r.slot, a = assigned[sl.source];
      const hay = `${r.seg.name} ${r.seg.alias ?? ""} ${r.seg.key ?? ""} ${(r.seg.above ?? []).map((x) => x.ids.join(" ")).join(" ")}
        ${sl.label} ${sl.source} ${sl.stream ?? ""} ${sl.object ?? ""} ${r.seg.stems[r.stemIndex]?.track ?? ""} ${sl.was ?? ""}
        ${(sl.notes ?? []).map((n) => `${n.tag ?? ""} ${n.text}`).join(" ")} ${a && !a.silence ? a.audio : ""}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [all, q, assigned]);
  /** The slots that show: all of a music cue's; of a bank's, those of the open groups or the ones the filter finds. */
  const rows = useMemo(() => (hits ? hits.slice(0, MAX_SHOWN) : grouped ? all.filter(isOpen) : all), [hits, grouped, all, isOpen]);
  // a slot that gets selected from elsewhere (a search, the now-playing bar, "also plays in") shows: its group opens,
  // and the list scrolls to it if none of it is on screen. One clicked or ticked here stays where it is, and a folded
  // sound ticked as a whole stays folded.
  const picked = useRef(false); // the selection is the list's own: a click, a key, the play-through moving on
  // a selection made before the list has its slots (new takes, selected as the bank reloads): shown once it has them
  const waiting = useRef<{ sel: string[]; own: boolean } | null>(null);
  const showSelected = (sel: string[], own: boolean) => {
    if (grouped && !all.some((r) => sel.includes(r.slot.source))) { waiting.current = { sel, own }; return; }
    waiting.current = null;
    const shut = grouped && !own ? all.filter((r) => sel.includes(r.slot.source) && !isOpen(r)).map((r) => r.segIndex) : [];
    if (shut.length) setFlipped((f) => { const next = new Set(f); for (const i of shut) if (openByDefault) next.delete(i); else next.add(i); return next; });
    if (!own && sel.length === 1) win.reveal(sel[0], { block: "center", hidden: true });
  };
  useEffect(() => {
    const own = picked.current;
    picked.current = false;
    waiting.current = null;
    if (selected.length) showSelected(selected, own);
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (waiting.current) showSelected(waiting.current.sel, waiting.current.own); }, [all]); // eslint-disable-line react-hooks/exhaustive-deps

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
  /** Where audio files copied in Explorer go: the selected slots that take audio, in play order. */
  const pasteSelection = useCallback(() => rows.filter((r) => selected.includes(r.slot.source) && usable(r)).map((r) => r.slot.source),
    [rows, selected]);
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
      if (await actions.swap(a, b)) { setSelected([b]); win.reveal(b); }
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
    picked.current = true;
    setSelected([rows[j].slot.source]);
    win.reveal(rows[j].slot.source);
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
      actions.silence(targets, true);
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
      if (!editing() || !selected.length) return false;
      actions.pasteSlots(pasteTargets(), pasteSelection());
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
    if (playing) { picked.current = true; setSelected([playing.slot.source]); }
    // the segment's name: the line over its slots, or its first slot's
    if (of.length) win.reveal(titled(of[0]) ? `h${of[0].segIndex}` : of[0].slot.source, { behavior: scrollBehavior() });
  }, [mark]); // eslint-disable-line react-hooks/exhaustive-deps

  // over every slot, once per cue and change of the project rather than per render (a key press in an 8,330-sound
  // bank spent 37 ms here on a slow PC)
  const { mine, cov, fillable } = useMemo(() => {
    const open = all.filter(usable).map((r) => r.slot.source);
    return { mine: all.filter((r) => assigned[r.slot.source]).length, cov: coverage(open, assigned), fillable: open.length };
  }, [all, assigned]); // eslint-disable-line react-hooks/exhaustive-deps
  const groupStatus = useMemo(() => new Map([...takesOf].map(([g, sources]) => [g, statusOf(coverage(sources, assigned))])),
    [takesOf, assigned]);
  // the item this cue was opened as a part of, and that part
  const item = shownItemId ? itemIndex.items.get(shownItemId) : undefined;
  const part = item?.parts.find((p) => p.cue === cue.id);
  const home = !part ? itemIndex.byCue.get(cue.id) : undefined; // opened on its own: where the Index has it
  const between = !readOnly && part && (part.kind === "bridge" || part.kind === "stinger") ? part : undefined;
  const skip = between ? between.own.filter((s) => !assigned[s]) : [];
  // transitions and stingers: every part has a line in the slot list, and the open one shows its slots under it
  const folding = !!item && !!part && partsFold(item);
  useEffect(() => { // the list is drawn again for each part opened: the open one stays in view
    if (folding) listRef.current?.querySelector(".part-grp.open")?.scrollIntoView({ block: "nearest" });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  /** The list's lines, top to bottom: a bank's sounds, each group under a line that folds it (or the ones the filter
      finds, under their groups' lines), or a music cue's slots, those of a segment with several under its name. By
      container id, the containers over each group come first where they differ from the last group's, a line each
      (as Wwise tools draw the tree). */
  const lines = useMemo(() => {
    const out: Line[] = [];
    const add = (r: Row) => out.push({ key: r.slot.source, kind: !r.seg.group ? "slot" : r.takes > 1 ? "take" : "solo", row: r });
    if (!grouped) {
      rows.forEach((r, i) => {
        if (titled(r) && rows[i - 1]?.segIndex !== r.segIndex) out.push({ key: `h${r.segIndex}`, kind: "segment", row: r, head: true });
        add(r);
      });
      return out;
    }
    const list = hits ? rows : all;
    let path: string[] = []; // the container lines over the last group, top down
    for (let i = 0, j = 0; i < list.length; i = j) {
      const first = list[i];
      while (j < list.length && list[j].segIndex === first.segIndex) j++;
      const above = first.seg.above ?? [], at = above.map((a) => a.ids.join("/"));
      let k = 0;
      while (k < at.length && at[k] === path[k]) k++;
      for (let d = k; d < at.length; d++) out.push({ key: `t${at.slice(0, d + 1).join("/")}`, kind: "tree", row: first, tree: { ...above[d], depth: d } });
      path = at;
      if (first.takes === 1 || !first.seg.group) { list.slice(i, j).forEach(add); continue; }
      const open = !!hits || isOpen(first);
      out.push({ key: `g${first.segIndex}`, kind: "group", row: first, group: { open, shown: hits ? j - i : first.takes } });
      if (open) list.slice(i, j).forEach(add);
    }
    return out;
  }, [grouped, hits, rows, all, isOpen]);
  // a long list draws the lines near the view and spacers for the rest: a key press or a wheel tick then lays out a
  // screenful of rows instead of a bank's thousands. A short one draws them all, as before.
  const windowed = !folding && lines.length > WINDOW_FROM;
  const win = useListWindow(listRef, lines, windowed,
    (key) => listRef.current?.querySelector(`[data-source="${key}"], [data-line="${key}"]`));
  const listed = !!item && !!project?.library.includes(item.id);
  // in the Library, a sound set or archive whose banks the project has already, in something else: that opens instead
  const banks = readOnly && item && !listed ? listedBanks(itemIndex, project?.library ?? []) : null;
  const inside = banks && item && heldBy(banks, item) ? banks.get(cue.id) ?? null : null;
  const openInside = (source: string | null) => inside && goTo({ scope: "editor", itemId: inside.id, cueId: cue.id, source });

  const click =(e: React.MouseEvent, source: string) => {
    picked.current = true;
    if (e.shiftKey && selected.length) {
      const a = rows.findIndex((r) => r.slot.source === selected[0]);
      const b = rows.findIndex((r) => r.slot.source === source);
      const [lo, hi] = a < b ? [a, b] : [b, a];
      setSelected([selected[0], ...rows.slice(lo, hi + 1).map((r) => r.slot.source).filter((s) => s !== selected[0])]);
    } else if (e.ctrlKey || e.metaKey) {
      setSelected(selected.includes(source) ? selected.filter((s) => s !== source) : [...selected, source]);
    } else setSelected([source]);
  };
  /** A slot's tick: in or out of the selection, as Ctrl+click does; with Shift, the range from the first selected. */
  const check = (e: React.MouseEvent, source: string) => {
    if (e.shiftKey && selected.length) return click(e, source);
    picked.current = true;
    setSelected(selected.includes(source) ? selected.filter((s) => s !== source) : [...selected, source]);
  };
  /** A group's tick: all its takes in the selection, or none of them. */
  const checkGroup = (sources: string[]) => {
    picked.current = true;
    const all = sources.every((s) => selected.includes(s));
    setSelected(all ? selected.filter((s) => !sources.includes(s)) : [...selected, ...sources.filter((s) => !selected.includes(s))]);
  };
  const choose = async (source: string) => {
    setSelected([source]);
    const f = await pickAudio(true);
    if (f) actions.assign(source, f);
  };

  /** Puts some slots of this cue on the export list (in list order), named after the one or after the cue: in the
      Audio tab as the mod plays them. */
  const toExport = (sources: string[], name: string) => {
    const ordered = all.filter((x) => sources.includes(x.slot.source)).map((x) => x.slot.source);
    const n = exportList.add([{ cue: cue.id, sources: ordered, name, count: ordered.length, whose: readOnly ? "game" : "mod",
      where: item ? where(itemIndex, item) : cue.path.join(" ▸ ") }]);
    quick(addedNote(n, 1), "add");
  };
  const named = useExportName();
  const target: ExportTarget = { context: readOnly ? "library" : "audio", cue, selected, ...named(cue) };
  const exportEntry = (sel: string[], r: Row): MenuEntry => {
    const count = sel.length, full = item?.full ?? cue.name;
    return {
      label: count > 1 ? plural(count, { one: "Add # Slot to the Export List", other: "Add # Slots to the Export List" }) : t`Add to the Export List`,
      run: () => toExport(sel, count > 1 ? plural(count, { one: `${full} (# slot)`, other: `${full} (# slots)` }) : `${full} - ${rowName(r)}`),
    };
  };

  /** The ids of a slot, each to copy, with the id shown next to it: the ones modders go by when they write about a
      sound (the source, the stream that holds it, the Sound, its container or the music track that plays it). */
  const copyIds = (r: Row): MenuEntry[] => {
    const sl = r.slot, track = r.seg.stems[r.stemIndex]?.track;
    const entry = (label: string, id: string): MenuEntry => ({ label, keys: id, run: () => copyId(id, quick) });
    return [
      ...(sl.stream ? [entry(t`Copy the Stream ID`, sl.stream)] : []),
      entry(t`Copy the Source ID`, sl.source),
      ...(sl.object ? [entry(t`Copy the Sound ID`, sl.object)] : []),
      ...(r.seg.key ? [entry(t`Copy the Container ID`, r.seg.key)] : []),
      ...(track && track !== "0" ? [entry(t`Copy the Track ID`, track)] : []),
    ];
  };

  /** What a sound can have added (the Audio tab): new takes, which its random container picks like its own, and
      a layer beside it, which plays whenever it plays. A layer takes new takes too. */
  const addEntries = (r: Row): MenuEntry[] => {
    const g = r.seg;
    if (readOnly || !g.container) return [];
    return [
      { label: t`New Takes`, disabled: !project, run: () => actions.addTakes(g.container!, g.name) },
      ...(g.added === "layer" ? [] : [{ label: t`New Layer`, disabled: !project || !g.layer, run: () => actions.addLayer(g.container!, g.name) }]),
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
        { label: t`Play the Original`, keys: keyLabel("playGame"), disabled: r.slot.absent, run: () => playSlot("vanilla", s, revision, rowName(r), at(s)) },
        exportEntry(sel, r),
        "-",
        ...(item ? [listed
          ? { label: t`Open in the Audio Tab`, run: () => goTo({ scope: "editor", itemId: item.id, cueId: cue.id, source: s }) } as MenuEntry
          : inside ? { label: t`Open in the Audio Tab`, run: () => openInside(s) } as MenuEntry
          : { label: t`Add ${ph({ name: item.full })} to the Project`, run: () => actions.addToProject([item.id], item.full) } as MenuEntry] : []),
        ...copyIds(r),
      ]);
      return;
    }
    const ordered = rows.filter((x) => sel.includes(x.slot.source)).map((x) => x.slot.source);
    const withAudio = ordered.filter((x) => assigned[x]);
    const silenceable = rows.filter((x) => sel.includes(x.slot.source) && usable(x)).map((x) => x.slot.source);
    // the counts in the labels: the slots acted on, those that take audio, and the slots copied
    const count = sel.length, usableCount = silenceable.length, copied = clip.length;
    const many = count > 1;
    const adds = addEntries(r);
    const entries: MenuEntry[] = [
      { label: t`Play the Original`, keys: keyLabel("playGame"), disabled: r.slot.absent || !!r.slot.added, run: () => playSlot("vanilla", s, revision, rowName(r), at(s)) },
      { label: t`Play the New Audio`, keys: keyLabel("playMine"), disabled: !audible(a), run: () => playSlot("project", s, revision, rowName(r), at(s)) },
      "-",
      ...(sel.length > 1 ? [
        { label: plural(usableCount, { one: "Choose One File for # Slot", other: "Choose One File for # Slots" }), disabled: !project || !silenceable.length,
          run: async () => { const f = (await pickAudio(false))?.[0]; if (f) actions.assignAll(silenceable, f); } },
        { label: plural(usableCount, { one: "Choose Files for # Slot", other: "Choose Files for # Slots" }), disabled: !project || !silenceable.length,
          run: async () => { const f = await pickAudio(true); if (f) actions.fillSources(silenceable, f, plural(usableCount, { one: "# slot", other: "# slots" })); } },
      ] : [{ label: a ? t`Replace with Another File` : t`Choose a File`, keys: keyLabel("chooseFile"), disabled: !project || !usable(r), run: () => choose(s) }]),
      { label: many ? plural(count, { one: "Copy the New Audio (# Slot)", other: "Copy the New Audio (# Slots)" }) : t`Copy the New Audio`,
        keys: keyLabel("copy"), disabled: !withAudio.length, run: () => actions.copySlots(ordered) },
      { label: clip.length > 1 && sel.length === 1 ? plural(copied, { one: "Paste # Slot from Here", other: "Paste # Slots from Here" })
        : many ? plural(count, { one: "Paste (# Slot)", other: "Paste (# Slots)" }) : t`Paste`, keys: keyLabel("paste"),
        disabled: !project, run: () => actions.pasteSlots(pasteTargets().length ? pasteTargets() : [s], pasteSelection().length ? pasteSelection() : [s]) },
      { label: t`Move the New Audio Up`, keys: keyLabel("moveUp"), disabled: sel.length > 1 || !project || !a, run: () => moveAudio(-1) },
      { label: t`Move the New Audio Down`, keys: keyLabel("moveDown"), disabled: sel.length > 1 || !project || !a, run: () => moveAudio(1) },
      { label: many ? plural(count, { one: "Replace with Silence (# Slot)", other: "Replace with Silence (# Slots)" }) : t`Replace with Silence`,
        keys: keyLabel("silence"), disabled: !project || !silenceable.length || silenceable.every((x) => assigned[x]?.silence),
        run: () => actions.silence(silenceable, true, sel.length > 1 ? plural(usableCount, { one: "# slot", other: "# slots" }) : rowName(r)) },
      { label: many ? plural(count, { one: "Remove the New Audio (# Slot)", other: "Remove the New Audio (# Slots)" }) : t`Remove the New Audio`,
        keys: keyLabel("remove"), disabled: !withAudio.length, run: () => actions.unassign(withAudio) },
      ...(adds.length ? ["-" as const, ...adds] : []),
      "-",
      exportEntry(sel, r),
      { label: t`Show in Folder`, disabled: !a?.exists || a.silence, run: () => reveal(fullPath(project!.folder, a!.audio)) },
      ...copyIds(r),
    ];
    openMenu(e, entries);
  };

  const nav = (
    <div className="nav-btns">
      <button className="icon-btn" onClick={back} disabled={!nav_.back} data-tip={t`Back`} data-tip-cmd="back" aria-label={t`Back`}>‹</button>
      <button className="icon-btn" onClick={forward} disabled={!nav_.forward} data-tip={t`Forward`} data-tip-cmd="forward" aria-label={t`Forward`}>›</button>
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
    check: (e: React.MouseEvent, source: string) => check(e, source),
    checkGroup: (sources: string[]) => checkGroup(sources),
    select: (source: string) => { if (!selected.includes(source)) { picked.current = true; setSelected([source]); } },
    choose: (source: string) => choose(source),
    menu: (e: React.MouseEvent, r: Row) => slotMenu(e, r),
    remove: (source: string) => { actions.unassign([source]); },
    toggle: (segIndex: number) => setFlipped((f) => { const next = new Set(f); if (next.has(segIndex)) next.delete(segIndex); else next.add(segIndex); return next; }),
    openTag: (id: string, cueId: string) => { show(id, cueId); },
    add: (e: React.MouseEvent, first: Row) => openMenu(e, addEntries(first)),
    groupMenu: (e: React.MouseEvent, first: Row) => {
      const takes = takesOf.get(first.segIndex) ?? NONE, replaced = takes.filter((s) => assigned[s]);
      const name = first.seg.name, count = takes.length, total = first.takes; // the takes that take audio, and all of them
      openMenu(e, [
        { label: t`Play the First Take`, run: () => playSlot("vanilla", first.slot.source, revision, rowName(first), at(first.slot.source)) },
        ...(readOnly ? [] : ["-",
          { label: plural(count, { one: "Choose Files for the # Take", other: "Choose Files for the # Takes" }), disabled: !project || !takes.length,
            run: async () => { const f = await pickAudio(true); if (f) actions.fillSources(takes, f, t`the takes of ${name}`); } },
          { label: plural(count, { one: "Replace the # Take with Silence", other: "Replace the # Takes with Silence" }),
            disabled: !project || !takes.length || takes.every((s) => assigned[s]?.silence), run: () => actions.silence(takes, true, name) },
          { label: plural(count, { one: "Remove the New Audio from the # Take", other: "Remove the New Audio from the # Takes" }),
            disabled: !replaced.length, run: () => actions.unassign(replaced) },
          ...(addEntries(first).length ? ["-", ...addEntries(first)] : []),
          "-"] as MenuEntry[]),
        { label: plural(total, { one: "Add the # Take to the Export List", other: "Add the # Takes to the Export List" }),
          run: () => toExport(all.filter((r) => r.segIndex === first.segIndex).map((r) => r.slot.source), `${item?.full ?? cue.name} - ${name}`) },
        ...(first.seg.key ? [{ label: t`Copy the Container ID`, keys: first.seg.key, run: () => copyId(first.seg.key!, quick) }] : []),
      ]);
    },
  });
  const selSet = useMemo(() => new Set(selected), [selected]);
  const slot = (r: Row) => (
    <SlotRow key={r.slot.source} row={r} a={readOnly ? undefined : assigned[r.slot.source]} selected={selSet.has(r.slot.source)}
      standIns={readOnly ? undefined : standIns[r.slot.source]} gain={readOnly ? undefined : gains[r.slot.source]}
      now={r.seg.segment !== "" && r.seg.segment === nowSeg} itemId={shownItemId} cueId={cue.id} on={on} />
  );
  /** A line of the list: a slot, a segment's name over its slots, or a group's line, which folds its takes, says how
      many there are and plays the first. */
  const line = (l: Line) => {
    if (l.tree) return <TreeLine key={l.key} {...l.tree} />;
    if (l.head) return <SegmentHead key={l.key} row={l.row} line={l.key} on={on} />;
    if (!l.group) return slot(l.row);
    const sources = takesOf.get(l.row.segIndex) ?? NONE, n = sources.filter((s) => selSet.has(s)).length;
    return (
      <GroupHead key={l.key} row={l.row} open={l.group.open} shown={l.group.shown} itemId={shownItemId} cueId={cue.id}
        sources={sources} picked={!n ? "none" : n === sources.length ? "all" : "some"}
        status={readOnly || !project ? "na" : groupStatus.get(l.row.segIndex) ?? "na"} on={on} />
    );
  };
  // the toolbar's tick: every slot shown, or none (the ones that take audio and the rest alike, as Ctrl+A)
  const shownSources = useMemo(() => rows.map((r) => r.slot.source), [rows]);
  const ticked = shownSources.filter((s) => selSet.has(s)).length;
  // what the header says besides the item's own facts, in its row of facts
  const facts: React.ReactNode[] = [];
  if (project && item && part?.kind === "playlist" && cue.ordered === false && shown.includes("soundtrack")) {
    facts.push(<p key="order" className="fact"><OrderIcon /><span><Trans>The game plays these slots in another order.{" "}
      <button className="link-text" onClick={() => openInSoundtrack(item, part.cue)}>Play Order</button></Trans></span></p>);
  }
  if (between && between.own.length < between.targets.length) {
    const total = between.targets.length, others = total - between.own.length; // the slots, and those other music plays too
    facts.push(<p key="between" className="fact" data-tip={t`Replacing these slots changes that music too`} data-tip-more={t`Skip leaves them as they are`}>
      <LinkIcon /><span>{between.own.length ? plural(others, {
        one: `# of the ${total} slots also play in other music.`, other: `# of the ${total} slots also play in other music.`,
      }) : t`This audio also plays in other music.`}</span></p>);
  }
  const folds = (r: Row) => r.takes > 1 && !!r.seg.group; // a group with a line of its own to fold it under
  const anyOpen = grouped && all.some((r) => folds(r) && isOpen(r));
  // folded is the default for big banks (nothing flipped) and the exception for the others (every group flipped)
  const collapseAll = () => setFlipped(new Set(openByDefault ? all.filter((r) => folds(r) && r.firstOfSeg).map((r) => r.segIndex) : []));
  // the values the messages below name
  const replacedCount = cov.n, slotCount = cov.total, selectedCount = selected.length, undoKey = keyHint("undo"),
    query = filter.trim(), found = hits?.length ?? 0;
  const homeAt = home ? `${itemIndex.section.get(home.item.id)?.name ?? ""} ▸ ${home.item.name}${home.part.name && home.item.parts.length > 1 ? ` ▸ ${home.part.name}` : ""}` : "";

  return (
    <section className={`cue${readOnly ? " ro" : ""}`} aria-label={cue.name} ref={cueRef}>
      {panels.head && <div className={`cue-top${headH != null ? " sized" : ""}`} style={headH != null ? { height: headH } : undefined}>
        <header className="cue-head view-in" key={item?.id ?? cue.id} data-drop={drop}>
          {item && part ? <ItemHead item={item} part={part} cue={cue} nav={nav} facts={facts} /> : (
            <>
              <div className="head-row"><div className="crumbs">{cue.path.join(" ▸ ")}</div></div>
              <div className="item-title">
                <h1>{cue.name}</h1>
                {!readOnly && project && cov.total > 0 && (
                  <span className={`item-cov ${statusOf(cov)}`} data-tip={plural(slotCount, { one: `${replacedCount} of # slot replaced`, other: `${replacedCount} of # slots replaced` })}
                    data-tip-more={statusOf(cov) === "part" ? t`The other slots still play the original` : undefined}><Mark status={statusOf(cov)} />{COVERAGE[statusOf(cov)]}</span>
                )}
                {nav}
              </div>
              {cue.detail && cue.curated === false && <p className="cue-detail">{cue.detail}</p>}
              {home && (
                <p className="cue-detail"><Trans>In the Index: <button className="link-text"
                  onClick={() => show(home.item.id, home.part.cue)}>{homeAt}</button></Trans></p>
              )}
              {facts.length > 0 && <div className="head-facts">{facts}</div>}
            </>
          )}
          {part?.note && <p className="cue-notes">{part.note}</p>}
          {cue.notes && (!part || cue.locked || !music) && <p className={`cue-notes${cue.locked ? " warn" : ""}`}>{cue.notes}</p>}
        </header>
        <ResizeEdge edge="bottom" label={t`Resize the header`} min={56} max={() => room("top")}
          onResize={setHeadH} onReset={() => setHeadH(null)} />
      </div>}
      <div className="cue-bar" data-drop={drop}>
        {/* ticks select slots in both tabs: to replace in the Audio tab, to export in either */}
        <input type="checkbox" className="slot-check all" checked={ticked > 0 && ticked === shownSources.length} disabled={!shownSources.length}
          ref={(el) => { if (el) el.indeterminate = ticked > 0 && ticked < shownSources.length; }}
          onChange={() => { picked.current = true; setSelected(ticked === shownSources.length ? [] : shownSources); }}
          aria-label={ticked === shownSources.length ? t`Clear the selection` : t`Select every slot`}
          data-tip={ticked === shownSources.length ? t`Clear the selection` : grouped ? t`Select every sound shown` : t`Select every slot`}
          data-tip-cmd={ticked === shownSources.length ? undefined : "selectAll"} />
        {music && cue.kind !== "sound" && <PlayThrough onThrough={setThrough} onMark={setMark} />}
        {readOnly && item && (listed ? (
          <button className="btn primary" data-tip={t`Replace audio there`}
            onClick={() => goTo({ scope: "editor", itemId: item.id, cueId: cue.id, source: selected[0] ?? null })}><Trans>Open in the Audio Tab</Trans></button>
        ) : inside ? (
          <button className="btn primary" data-tip={t`These sounds are in the project already`} data-tip-more={t`In ${ph({ name: listName(inside) })}`}
            onClick={() => openInside(selected[0] ?? null)}><Trans>Open in the Audio Tab</Trans></button>
        ) : (
          <button className="btn primary" data-tip={project ? t`Add to ${ph({ name: project.name })}` : t`Open or create a project first`}
            onClick={() => actions.addToProject([item.id], item.full)}><Trans>Add to the Project</Trans></button>
        ))}
        <div className="tools">
          {!readOnly && music && cue.kind !== "sound" && (
            <ToolButton icon={<FillIcon />} name={t`Fill from files`} about={t`A file for each slot, in play order and file-name order`} primary disabled={!fillable}
              onClick={async () => { const f = await pickAudio(true); if (f) actions.fill(cue.id, f); }} />
          )}
          {!readOnly && item && isMusicItem(item) && <ItemActions item={item} />}
          {!readOnly && music && fillable > 1 && (
            <ToolButton icon={<SliceIcon />} name={t`Slice a song`} about={project ? t`Cut one song into pieces, one per slot` : t`Open a project first`}
              disabled={!project} onClick={() => setSlicing(true)} />
          )}
          {cue.kind !== "sound" && (
            <ToolButton icon={<ExportIcon />} name={t`Export`} about={selected.length > 1 ? plural(selectedCount, {
              one: "All of it or the # selected, as WAV, FLAC, MP3 or WEM", other: "All of it or the # selected, as WAV, FLAC, MP3 or WEM",
            }) : t`Save as WAV, FLAC, MP3 or WEM`} onClick={() => setExporting("item")} />
          )}
          <ExportListChip onOpen={() => setExporting("list")} />
          {between && project && skip.length > 0 && (
            <ToolButton icon={<SkipIcon />} name={t`Skip it`} onClick={() => actions.skip(skip, between.name || item?.name || cue.name)}
              about={undoKey ? t({
                message: `Replace with a short silence, so the next music starts right away. Undo${undoKey} brings it back`,
                comment: "undoKey is the key in brackets after a space, such as ' (Ctrl+Z)'",
              }) : t`Replace with a short silence, so the next music starts right away`} />
          )}
          {!readOnly && mine > 0 && (() => {
            const silent = all.every((r) => !assigned[r.slot.source] || assigned[r.slot.source].silence);
            const name = silent ? between ? t`Undo the skip` : t`Remove the silence` : part && item && item.parts.length > 1 ? t`Clear this part` : t`Clear all`;
            return <ToolButton icon={<ClearIcon />} name={name} about={silent ? t`The original plays again` : t`Remove the new audio from every slot here`}
              onClick={() => actions.unassign(all.map((r) => r.slot.source).filter((s) => assigned[s]))} />;
          })()}
        </div>
        <SlotSearch value={filter} onChange={setFilter} sounds={grouped} />
        {bank && (
          <button className={`icon-btn${ids ? " on" : ""}`} aria-pressed={ids} aria-label={t`Container IDs`}
            onClick={() => settings.set({ soundNames: ids ? "names" : "ids" })} data-tip={ids ? t`Show names` : t`Show container IDs`}
            data-tip-more={ids ? t`Each sound by what it says or what it is`
              : t`Each sound by the ID of the container that holds it, under the containers above, as Wwise tools list them`}><IdIcon /></button>
        )}
        {grouped && !hits && all.some(folds) && (
          <button className="icon-btn" disabled={!anyOpen} onClick={collapseAll} aria-label={t`Collapse all`}
            data-tip={anyOpen ? t`Collapse all sounds` : t`Every sound is collapsed`}><CollapseAllIcon /></button>
        )}
        {folding && (
          <button className="icon-btn parts-collapse" disabled={shut} onClick={() => setShut(true)} aria-label={t`Collapse all`}
            data-tip={shut ? t`Every part is collapsed` : t`Collapse all parts`}><CollapseAllIcon /></button>
        )}
        <PanelToggles panels={panels} set={setPanels} waves={selected.length === 1} />
        <Help tip={t`What each button on this bar does`} page="reading-the-screen#the-toolbar" />
      </div>
      {item && part && item.parts.length > 1 && !folding && <PartTabs item={item} part={part} />}

      <div className={`slots view-in${windowed ? " windowed" : ""}`} key={folding ? item!.id : cue.id} ref={listRef} role="listbox" aria-multiselectable
        aria-label={grouped ? t`Sounds` : t`Slots`} style={readOnly ? undefined : { ["--mine-w" as any]: `${column.mine}px`, ["--gain-w" as any]: `${column.gain}px` }}>
        {folding ? item!.parts.map((p, i) => (
          <Fragment key={p.cue}>
            <PartHead item={item!} part={p} index={i} open={p === part && !shut}
              onToggle={() => (p === part ? setShut(!shut) : openItem(item!.id, i))} />
            {p === part && !shut && lines.map(line)}
          </Fragment>
        )) : windowed ? (
          <>
            <div className="slots-gap" ref={win.gap.top} style={{ height: win.before }} aria-hidden />
            {lines.slice(win.first, win.last).map(line)}
            <div className="slots-gap" ref={win.gap.end} style={{ height: win.after }} aria-hidden />
          </>
        ) : lines.map(line)}
        {hits && hits.length > MAX_SHOWN && <p className="slots-note">{plural(found, {
          one: `Showing the first ${MAX_SHOWN} of # match. Type more to narrow the search.`,
          other: `Showing the first ${MAX_SHOWN} of # matches. Type more to narrow the search.`,
        })}</p>}
        {hits && !hits.length && <p className="slots-note">{grouped ? t`No sound here matches “${query}”.` : t`No slot here matches “${query}”.`}</p>}
        {hits && !hits.length && <Elsewhere query={typed} here={cue.id} />}
      </div>
      {panels.waves && <Timeline room={() => room("wave")} through={through} at={selected.length === 1 ? at(selected[0]) : null} />}
      {menu}
      {slicing && <SliceTool onClose={() => setSlicing(false)} />}
      {exporting && <ExportPanel target={cue.kind !== "sound" ? target : null} start={exporting} onClose={() => setExporting(null)} />}
    </section>
  );
}

/** A line of the slot list: a slot (its row), the line above a group's takes (`group`, with `row` its first take), or
    by container id a container over the group of `row` (`tree`). */
type Line = WindowLine & {
  row: Row; group?: { open: boolean; shown: number }; tree?: { ids: string[]; type: string; depth: number };
  head?: boolean; // the name of a music segment, over its slots
};

/** What a list's rows do, from the list (useStable keeps one identity for each). */
type RowHandlers = {
  click: (e: React.MouseEvent, source: string) => void; select: (source: string) => void; choose: (source: string) => void;
  check: (e: React.MouseEvent, source: string) => void; checkGroup: (sources: string[]) => void;
  menu: (e: React.MouseEvent, r: Row) => void; remove: (source: string) => void; toggle: (segIndex: number) => void;
  openTag: (id: string, cueId: string) => void; groupMenu: (e: React.MouseEvent, first: Row) => void;
  add: (e: React.MouseEvent, first: Row) => void;
};

/** The + at the end of a sound's line in the Audio tab: new takes for it, or a layer beside it. */
function AddButton({ row, on }: { row: Row; on: RowHandlers }) {
  const { readOnly } = useLite();
  if (readOnly || !row.seg.container) return null;
  // the takes' audio can be in banks the container isn't: added audio goes only where the container is
  const { copies = 0, shared = 0, name } = row.seg;
  const what = row.seg.added === "layer" ? t`New takes for this layer` : row.seg.layer ? t`New takes, or a layer that plays with it`
    : t`New takes. This sound can't have a layer`;
  const where = copies ? plural(copies, { one: "The # other bank with this sound gets it too", other: "The # other banks with this sound get it too" })
    : shared ? t`Only this bank gets it. The other banks with this audio play it from separate sounds` : "";
  return (
    <button className="icon-btn grp-add" aria-label={t`Add new audio to ${name}`} data-tip={t`Add new audio`}
      data-tip-more={where ? t({ message: `${what}. ${where}`, comment: "Two sentences of a tooltip: what can be added, and where it goes" }) : what}
      onClick={(e) => { e.stopPropagation(); on.add(e, row); }} onDoubleClick={(e) => e.stopPropagation()}><PlusIcon /></button>
  );
}

/** The Make-Up Gain on a slot's original audio, as a tag on its row. */
function GainTag({ db }: { db: number }) {
  return <span className="tag gain-tag" data-tip={t`Make-Up Gain on the original`} data-tip-more={t`Set in the details`}>{fmtDecimal(db, 2, true)} dB</span>;
}

/** The tag on a clip that must stay as it is (fills and group actions leave it out). */
function LockedTag() {
  return <span className="tag warn" data-tip={t`Replacing this clip makes the music stutter`} data-tip-more={t`Fills leave it out`}>{t`do not touch`}</span>;
}

/** A tag on a row of audio the project adds: a new take, or a clip of its own. */
function AddedTag({ slot }: { slot: Slot }) {
  if (slot.added) return <span className="tag new" data-tip={ADDED_TIP.take}>{t`new take`}</span>;
  if (slot.was) return <span className="tag new" data-tip={ADDED_TIP.own}>{t({ message: "only this sound", comment: "Tag on a slot whose new audio plays only in this sound, not in the other sounds that play the clip" })}</span>;
  return null;
}
const ADDED_TIP = {
  take: t`A take added by the project. The game picks it like the other takes. It has no original`,
  own: t`The new audio plays only in this sound. Other sounds that play the clip keep the original`,
};
/** The tag on a clip that other sounds play new audio in place of (Only this sound, there), on the sounds that keep
    the Original: without it the row looks as if the replacement had failed. A sound in the bank on screen is said
    to be here. */
function StandInTag({ standIns, cueId }: { standIns: StandIn[]; cueId: string }) {
  const here = cueId.startsWith("bank:") ? cueId.slice(5) : "";
  const places = [...new Set(standIns.map((s) => (here && s.banks.includes(here) ? t`another sound here` : s.place || t`another sound`)))];
  const where = andList(places), count = standIns.length;
  return (
    <span className="tag" data-tip={t`New audio only in ${where}`} data-tip-more={t`This sound keeps the Original`}>
      {plural(count, { one: "replaced in another sound", other: "replaced in # other sounds" })}</span>
  );
}
/** What a group name the Library makes up means (by the group's kind, core library.py): an unnamed sound, or the
    clips left over in a bank. */
function madeUpName(seg: Segment): { tip: string; more?: string } | null {
  if (seg.made_up) return { tip: t`Not named yet`, more: t`Numbered in bank order. Play it to hear what it is` };
  if (seg.kind === "other") return { tip: t`Clips that no sound in this bank plays`, more: t`A sound in another bank usually plays them` };
  if (seg.kind === "absent") return { tip: NO_AUDIO_TIP };
  return null;
}
/** The groups that hold separate sounds rather than the takes of one sound. */
const OF_SOUNDS = new Set(["run", "other", "absent", "streams"]);

/** Where a row's slot is, for the now-playing bar to lead back to. */
function useAt(itemId: string | null, cueId: string, source: string): PlayedAt {
  const { scope } = useLite();
  return useMemo(() => ({ scope, itemId, cueId, source }), [scope, itemId, cueId, source]);
}

/** The line above the takes of one sound: it folds them, says how many there are, plays the first, and takes files
    dropped on it (one per take, in order). In a bank's listing it also carries what the Index knows about a segment
    of music, as a link to it. Memoised: it draws again only when something it shows changes. */
const GroupHead = memo(function GroupHead({ row, open, shown, status, itemId, cueId, sources, picked, on }: {
  row: Row; open: boolean; shown: number; status: "none" | "part" | "done" | "na"; itemId: string | null; cueId: string;
  sources: string[]; picked: "none" | "some" | "all"; on: RowHandlers;
}) {
  const { readOnly } = useLite();
  const { seg, slot, takes } = row;
  const at = useAt(itemId, cueId, slot.source);
  const name = seg.name;
  const drop = useMemo(() => (readOnly ? undefined : JSON.stringify({ kind: "sources", sources, what: t`the takes of ${name}` })),
    [readOnly, sources, name]);
  const shared = seg.shared ?? 0;
  // the takes of one sound, or (a run cut out of a long list) just sounds
  const unit = seg.kind && OF_SOUNDS.has(seg.kind) ? "sounds" : "takes";
  const madeUp = madeUpName(seg);
  return (
    <div className={`grp${open ? " open" : ""}`} style={depthStyle(seg)} data-drop={drop} data-key={seg.key} onContextMenu={(e) => on.groupMenu(e, row)}>
      {sources.length > 0 && (
        <input type="checkbox" className="slot-check" checked={picked === "all"} readOnly tabIndex={-1}
          aria-label={unit === "sounds" ? t`Select the sounds of ${name}` : t`Select the takes of ${name}`}
          ref={(el) => { if (el) el.indeterminate = picked === "some"; }} onClick={(e) => { e.stopPropagation(); on.checkGroup(sources); }} />
      )}
      <PlayButton kind="vanilla" source={slot.source} label={t({ message: `the first of ${name}`, comment: "What a play button plays: the first take of a sound" })}
        what={rowName(row)} small at={at} disabled={slot.absent || !!slot.added} />
      <button className="grp-head" aria-expanded={open} onClick={() => on.toggle(row.segIndex)}>
        <span className="caret" aria-hidden>▸</span>
        {seg.ctype && <span className="grp-type">{seg.ctype}</span>}
        <span className={`grp-name${seg.added ? " new" : ""}`} data-tip={madeUp?.tip ?? seg.name} data-tip-more={madeUp?.more}
          data-tip-clip={madeUp ? undefined : true}>{seg.name}</span>
        {seg.alias && <span className="grp-alias" data-tip={seg.alias} data-tip-clip>{seg.alias}</span>}
        <span className="grp-n" data-tip={unit === "takes" ? t`Recordings of one sound. The game plays one of them each time` : undefined}
          data-tip-more={unit === "takes" ? t`Give every take new audio to replace the sound completely` : undefined}>
          {unit === "sounds"
            ? shown < takes ? plural(takes, { one: `${shown} of # sound`, other: `${shown} of # sounds` }) : plural(takes, { one: "# sound", other: "# sounds" })
            : shown < takes ? plural(takes, { one: `${shown} of # take`, other: `${shown} of # takes` }) : plural(takes, { one: "# take", other: "# takes" })}</span>
      </button>
      <span className="grp-meta">
        {(seg.tags ?? []).map((tag) => <CatTag key={tag.item ?? tag.name} tag={tag} tip={t`Show in the Index`} onOpen={tag.item ? () => on.openTag(tag.item!, seg.cue ?? "") : undefined} />)}
        {seg.added === "layer" && <span className="tag new" data-tip={LAYER_TIP}>{t({ message: "layer", comment: "Tag on a sound the project added: a layer that plays with the sound above it" })}</span>}
        {shared > 0 && <Linked tip={plural(shared, {
          one: "Also in # other bank. New audio on these takes plays there too", other: "Also in # other banks. New audio on these takes plays there too",
        })}><OtherBanks n={shared} /></Linked>}
        {status !== "na" && <Mark status={status} />}
        <AddButton row={row} on={on} />
      </span>
    </div>
  );
});

/** The name of a music segment of several slots, on a line over them, with what the Index knows about it (each
    slot under it is one of its tracks). Memoised, as the rows are. */
const SegmentHead = memo(function SegmentHead({ row, line, on }: { row: Row; line: string; on: RowHandlers }) {
  const { seg } = row;
  return (
    <div className="seg-head" data-line={line} data-seg={seg.segment} style={depthStyle(seg)}>
      <span className="seg-name">{seg.name}</span>
      {(seg.tags ?? []).map((tag) => <CatTag key={tag.item ?? tag.name} tag={tag} tip={t`Show in the Index`}
        onOpen={tag.item ? () => on.openTag(tag.item!, seg.cue ?? "") : undefined} />)}
    </div>
  );
});

/** By container id, a container over the groups below it: its kind and id (several Actor-Mixers that each hold only
    the next share a line), indented by how deep it sits. Each id copies. */
function TreeLine({ ids, type, depth }: { ids: string[]; type: string; depth: number }) {
  const { quick } = useLite();
  return (
    <div className="tree-line" style={{ ["--depth" as any]: depth }}>
      <span className="tree-type">{type}</span>
      {ids.map((id, i) => (
        <Fragment key={id}>
          {i > 0 && <span className="tree-sep" aria-hidden>›</span>}
          <button className="tree-id" data-tip={t`Copy the ID`} onClick={() => copyId(id, quick)}>{id}</button>
        </Fragment>
      ))}
    </div>
  );
}

/** How deep a group sits by container id: its row's indent (none in the list by name). */
const depthStyle = (seg: Segment) => (seg.above?.length ? { ["--depth" as any]: seg.above.length } : undefined);

/** Copies an id and says so. */
function copyId(id: string, quick: (text: string, icon?: "copy" | "info") => void) {
  copyText(id, quick);
}

/** A slot's id at the end of its line (`shownId`): click to copy it; the right-click menu has its other ids. */
function SlotId({ slot }: { slot: Slot }) {
  const { quick } = useLite();
  const { id, what } = shownId(slot);
  return (
    <button className="slot-id" data-tip={what === "stream" ? t`Copy the stream ID` : t`Copy the source ID`}
      data-tip-more={what === "stream" ? t`The ID other audio tools list this clip by. Right-click the row for the other IDs`
        : t`The clip ID in the game files. Right-click the row for the other IDs`}
      onClick={(e) => { e.stopPropagation(); copyId(id, quick); }} onDoubleClick={(e) => e.stopPropagation()}>{id}</button>
  );
}

/** A tag saying the audio is linked to other places: the same sound plays in other cues or banks, so replacing it
    changes it there too. The chain says "linked" before the words are read. */
function Linked({ children, tip = t`Linked to other places. New audio here plays there too` }: { children: React.ReactNode; tip?: string }) {
  return <span className="tag linked" data-tip={tip}><LinkIcon />{children}</span>;
}

/** "in N other banks", whose words a narrow list leaves out (the chain and the number stay; the tip says it in full). */
function OtherBanks({ n }: { n: number }) {
  // one message, cut at the number (as `#` writes it), so the words on either side can go
  const words = plural(n, { one: "in # other bank", other: "in # other banks" });
  const num = fmtNumber(n), at = words.indexOf(num);
  if (at < 0) return <>{words}</>;
  return <><span className="lk-words">{words.slice(0, at)}</span>{num}<span className="lk-words">{words.slice(at + num.length)}</span></>;
}

/** "+3 more" and "+3 cues" on a slot's line: the other places that play the audio, where not all of them are banks. */
const moreTag = (also: number) => t({ message: `+${also} more`, comment: "Tag on a slot: how many other places play the same audio" });
const cuesTag = (also: number) => plural(also, { one: "+# cue", other: "+# cues" });

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
const SlotRow = memo(function SlotRow({ row, a, standIns, gain, selected, now, itemId, cueId, on }: {
  row: Row; a?: Assignment; standIns?: StandIn[]; selected: boolean; now: boolean; itemId: string | null; cueId: string;
  gain?: number; // Make-Up Gain on the original audio (it applies while the slot has no new audio)
  on: RowHandlers;
}) {
  const { revision, readOnly } = useLite();
  const { seg, slot, stems } = row;
  const at = useAt(itemId, cueId, slot.source);
  const onSelect = () => on.select(slot.source);
  const label = slot.label || (row.stems > 1 ? t`Stem ${ph({ n: row.stemIndex + 1 })}` : "");
  const loops = seg.loop === 0 ? t({ message: "loops", comment: "Tag on a music segment that repeats until the game moves on" }) : seg.loop > 1 ? `×${seg.loop}` : "";
  const times = seg.loop; // how many times the segment plays in a row
  const game = usePlayerLook(`vanilla:${slot.source}`), yours = usePlayerLook(`project:${slot.source}`);
  const playing = game.playing || yours.playing;
  const flash = useFlash(a ? `${a.audio}|${a.silence}` : "");
  const [flashed, setFlashed] = useState(0); // the flash that has played: taken away, or it would play again whenever the Audio tab comes back
  const what = rowName(row);
  const gameMs = slot.duration_ms || seg.duration_ms;
  const inGroup = !!seg.group && row.takes > 1; // a take of a sound: its group's line above says what it is
  const named = row.firstOfSeg && !inGroup && !titled(row); // a segment of one slot: its name heads the row
  // a sound with one take: drawn like a group's line (play, name, where else it is), so every sound looks alike
  const solo = !!seg.group && row.takes === 1;
  const also = slot.also_n ?? slot.also_in.length;
  const banks = slot.banks ?? 0;
  return (
    <div className={`slot${solo ? " solo" : ""}${selected ? " selected" : ""}${a ? " assigned" : ""}${slot.unused || slot.absent ? " unused" : ""}${slot.locked ? " locked" : ""}${named ? " seg-start" : ""}${inGroup ? " take" : ""}${playing ? " playing-row" : ""}${now ? " now" : ""}`}
      role="option" aria-selected={selected} data-source={slot.source} data-seg={named ? seg.segment : undefined} style={depthStyle(seg)}
      onClick={(e) => on.click(e, slot.source)}
      onMouseDown={(e) => { if (e.shiftKey) e.preventDefault(); }} // Shift+click selects a range of slots, not the text between them
      onDoubleClick={() => { if (audible(a) || !slot.absent) playSlot(audible(a) ? "project" : "vanilla", slot.source, revision, what, at); }}
      onContextMenu={(e) => on.menu(e, row)}
      data-drop={readOnly || slot.absent ? undefined : JSON.stringify({ kind: "slot", source: slot.source })}>
      {flash > flashed && <span key={flash} className="slot-flash" aria-hidden onAnimationEnd={() => setFlashed(flash)} />}
      <input type="checkbox" className="slot-check" checked={selected} readOnly tabIndex={-1} aria-hidden
        onClick={(e) => { e.stopPropagation(); on.check(e, slot.source); }} onDoubleClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => { if (e.shiftKey) e.preventDefault(); }} />
      {solo ? (
        <div className="slot-name solo-line">
          <PlayButton kind="vanilla" source={slot.source} label={t({ message: "the original", comment: "What a play button plays" })} what={what} onPlay={onSelect} at={at} disabled={slot.absent || !!slot.added} small />
          <span className="caret ghost" aria-hidden>▸</span>
          {seg.ctype && <span className="grp-type">{seg.ctype}</span>}
          <span className={`grp-name${seg.added ? " new" : ""}`} data-tip={seg.name} data-tip-more={seg.added ? LAYER_TIP : undefined}
            data-tip-clip={seg.added ? undefined : true}>{seg.name}</span>
          {seg.alias && <span className="grp-alias" data-tip={seg.alias} data-tip-clip>{seg.alias}</span>}
          {!seg.added && <span className="grp-n" data-tip={gameMs ? fmtTime(gameMs) : undefined}>{label && !seg.name.includes(label) ? label : t`1 take`}</span>}
          <span className="grp-meta">
            {slot.absent && <span className="tag" data-tip={NO_AUDIO_TIP}>{t`no audio`}</span>}
            {slot.locked && <LockedTag />}
            {seg.added !== "layer" && <AddedTag slot={slot} />}
            {!a && standIns && <StandInTag standIns={standIns} cueId={cueId} />}
            {!a && !!gain && <GainTag db={gain} />}
            <NoteTags slot={slot} />
            {(seg.tags ?? []).map((tag) => <CatTag key={tag.item ?? tag.name} tag={tag} tip={t`Show in the Index`} onOpen={tag.item ? () => on.openTag(tag.item!, seg.cue ?? "") : undefined} />)}
            {also > 0 && <Linked>{banks >= also ? <OtherBanks n={also} /> : banks ? moreTag(also) : cuesTag(also)}</Linked>}
            <AddButton row={row} on={on} />
          </span>
          {!seg.added && <SlotId slot={slot} />}
        </div>
      ) : (
      <div className="slot-name">
        {/* the original plays from the start of the line, as it does on a group's line and in the lists */}
        <PlayButton kind="vanilla" source={slot.source} label={t({ message: "the original", comment: "What a play button plays" })} what={what} onPlay={onSelect} at={at} disabled={slot.absent || !!slot.added} />
        <div className="slot-text">
          {inGroup ? null : named ? (
            <span className="seg-name">{seg.name}
              {/* a music segment of several slots has a note of its own; one of a single slot shares the slot's */}

            </span>
          ) : <span className="seg-cont" aria-hidden />}
          <span className="slot-sub" data-tip={label ? [label, slot.variant].filter(Boolean).join(" · ") : undefined} data-tip-clip>
            {label && <span className={`slot-label${label.length < 16 ? " nowrap" : ""}`}
              data-tip={row.stems > 1 && !slot.label ? plural(stems, { one: "One of # layer that play at the same time", other: "One of # layers that play at the same time" }) : undefined}
              data-tip-more={row.stems > 1 && !slot.label ? t`A layer left original still plays under the new audio` : undefined}>{label}</span>}
            {slot.variant && <span className="tag" data-tip={t`Plays only under this condition`} data-tip-more={t`To change the piece everywhere, give each variant new audio`}>{slot.variant}</span>}
            {loops && <span className="tag" data-tip={seg.loop === 0 ? t`Repeats until the game moves on` : plural(times, { one: "Plays # time in a row", other: "Plays # times in a row" })}>{loops}</span>}
            {slot.unused && <span className="tag" data-tip={t`The game never plays this clip`}>{t`never heard`}</span>}
            {slot.absent && <span className="tag" data-tip={NO_AUDIO_TIP}>{t`no audio`}</span>}
            {slot.locked && <LockedTag />}
            <AddedTag slot={slot} />
            {!a && standIns && <StandInTag standIns={standIns} cueId={cueId} />}
            {!a && !!gain && <GainTag db={gain} />}
            {audible(a) && slot.min_ms && a!.duration_ms != null && a!.duration_ms < slot.min_ms && (
              <span className="tag warn" data-tip={t`The new audio is too short. This clip needs at least ${ph({ needed: fmtTime(slot.min_ms) })}`}>{t`too short`}</span>
            )}
            <NoteTags slot={slot} />
            {named && (seg.tags ?? []).map((tag) => <CatTag key={tag.item ?? tag.name} tag={tag} tip={t`Show in the Index`}
              onOpen={tag.item ? () => on.openTag(tag.item!, seg.cue ?? "") : undefined} />)}
            {also > 0 && !(inGroup && (seg.shared ?? 0) > 0) && (
              <Linked>{banks >= also ? plural(also, { one: "+# bank", other: "+# banks" }) : banks ? moreTag(also) : cuesTag(also)}</Linked>
            )}
          </span>
        </div>
        <SlotId slot={slot} />
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
              <button className="file silent" data-tip={t`Replace the silence with a file`} data-tip-more={a.fit_timing ? SILENCE_TIP.move : SILENCE_TIP.keep}
                onClick={(e) => { e.stopPropagation(); on.choose(slot.source); }} onDoubleClick={(e) => e.stopPropagation()}>{SILENT.name}</button>
              <span className="tag" data-tip={a.fit_timing ? SILENCE_TIP.move : SILENCE_TIP.keep}
                data-tip-more={t`Keep original duration, in the details, sets this`}>{a.fit_timing ? SILENT.move : SILENT.keep}</span>
              <button className="x" aria-label={t`Remove the silence`} data-tip={t`Remove the silence`} data-tip-cmd="remove"
                onClick={(e) => { e.stopPropagation(); on.remove(slot.source); }}>✕</button>
            </>
          ) : a ? (
            <>
              <PlayButton kind="project" source={slot.source} label={t({ message: "the new audio", comment: "What a play button plays" })} disabled={!a.exists} what={what} onPlay={onSelect} at={at} />
              <button className={`file${a.exists ? "" : " missing"}`} data-tip={a.exists ? t`Replace with another file` : t`File not found. Click to choose another`}
                data-tip-more={a.exists ? a.audio : t`${ph({ file: a.audio })}. The mod can't be built until the file is back or replaced`}
                onClick={(e) => { e.stopPropagation(); on.choose(slot.source); }} onDoubleClick={(e) => e.stopPropagation()}>
                {a.exists ? a.name : missing(a.name)}</button>
              {/* a box of one width, set or not, before the length: the lengths stay in one column, and moving the
                  slider changes neither the file name's room nor the column's width */}
              <span className="gain mine-gain" data-tip={a.gain_db ? t`Make-Up Gain` : undefined} data-tip-more={a.gain_db ? t`Set in the details` : undefined}>
                {a.gain_db ? `${fmtDecimal(a.gain_db, 2, true)} dB` : ""}</span>
              {a.duration_ms != null && (
                <span className={`len mine-len${slot.min_ms && a.duration_ms < slot.min_ms ? " short" : ""}`}
                  data-tip={slot.min_ms && a.duration_ms < slot.min_ms ? t`Too short. This clip needs at least ${ph({ needed: fmtTime(slot.min_ms) })}`
                    : gameMs ? t`Original: ${ph({ length: fmtTime(gameMs) })}` : undefined}>
                  {fmtTime(a.duration_ms)}</span>
              )}
              <button className="x" aria-label={t`Remove the new audio`} data-tip={t`Remove the new audio`} data-tip-cmd="remove"
                onClick={(e) => { e.stopPropagation(); on.remove(slot.source); }}>✕</button>
            </>
          ) : (
            <button className="drop-hint" onClick={(e) => { e.stopPropagation(); on.choose(slot.source); }}
              onDoubleClick={(e) => e.stopPropagation()} data-tip-cmd="chooseFile" data-tip={slot.absent ? undefined : t`Choose a file`}
              disabled={slot.absent}>{DROP_HINT}</button>
          )}
        </div>
      )}
    </div>
  );
});

const NO_AUDIO_TIP = t`Not in the installed game files, so there is nothing to play or replace`;
const LAYER_TIP = t`A layer added by the project. It plays whenever the sound above it plays`;

/** A bank that is still being read: the first time one is opened takes a second or two. */
function CueLoading() {
  return (
    <section className="cue empty">
      <p className="loading cue-loading"><Trans>Reading the bank…</Trans></p>
    </section>
  );
}

function CueEmpty() {
  const { project, scope } = useEditor();
  const name = project?.name;
  if (scope === "library") {
    return (
      <section className="cue empty">
        <div className="empty-card">
          <h1><Trans>Nothing open</Trans></h1>
          <p>{project
            ? <Trans>Press ▶ to play anything. Open an entry to see the slots, and add it to <b>{name}</b> to replace the audio.</Trans>
            : <Trans>Press ▶ to play anything. Open an entry to see the slots, and add it to a project <span className="nowrap">(<button className="link-text" onClick={() => tabs.go("home")}>Home</button>)</span> to replace the audio.</Trans>}</p>
          <p><WikiLink page="game-audio" about={t`Archives, banks, sounds and slots`}><Trans>Game audio, explained</Trans></WikiLink></p>
        </div>
      </section>
    );
  }
  return (
    <section className="cue empty">
      <div className="empty-card">
        <h1>{project ? t`Nothing open` : t`No project open`}</h1>
        {project ? (
          <>
            <p><Trans>Open an entry on the left and drop audio on the slots. Find more in
              the <button className="link-text" onClick={() => tabs.go("library")}>Library</button>.</Trans></p>
            <p><WikiLink page="first-mod" about={t`A first mod`}><Trans>A first mod, step by step</Trans></WikiLink></p>
          </>
        ) : (
          <p><Trans>Open or create one on <button className="link-text" onClick={() => tabs.go("home")}>Home</button>.</Trans></p>
        )}
      </div>
    </section>
  );
}
