import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ph, plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { call, fileUrl, fmtNumber, fmtTime, type Assignment, type Cue, type MusicItem, type Piece, type PlaylistMap, type PlayNode } from "./api";
import { confirm } from "./Confirm";
import { useContextMenu, type MenuEntry } from "./ContextMenu";
import { audible, cuesTag, Linked, moreTag, PlayButton, playSlot, SILENCE_TIP } from "./CueView";
import { AudioIcon, CollapseAllIcon, ExportIcon, InOrderIcon, NextEachIcon, PauseIcon, RandomIcon, RepeatIcon, ShuffleIcon, SkipIcon, ThroughIcon } from "./Icons";
import { ResetLevel } from "./Inspector";
import { rangeVars } from "./range";
import { keyLabel, useCommands, useKeymap } from "./keys";
import { nav } from "./nav";
import { tabArrows } from "./Page";
import { fullPath, pickAudio } from "./platform";
import { player, usePlayer, type PlayedAt } from "./player";
import type { Mark, Through } from "./PlayThrough";
import { ResizeEdge, Splitter, useStoredHeight, useStoredWidth } from "./Resize";
import { SliceTool } from "./SliceTool";
import { useStable } from "./stable";
import { useEditor, useShownTabs } from "./store";
import { motionMs, scrollBehavior } from "./theme";
import { Timeline } from "./Timeline";
import { PanelToggles, ToolButton, usePanels } from "./Tools";
import { ExportListChip, ExportPanel } from "./ExportDialog";
import { Help } from "./Wiki";

type Mode = Piece["mode"];
const MODES: { mode: Mode; name: string; tip: string }[] = [
  { mode: "original", name: t`Original`, tip: t`The segments in their original order. Untick one to leave it out` },
  { mode: "song", name: t`One Song`, tip: t`One song cut into the segments, played from the beginning each time the music starts` },
  { mode: "tracks", name: t`Playlist`, tip: t`Whole songs, one after another or shuffled` },
  { mode: "silent", name: t({ message: "Silent", comment: "A way a piece of music plays: nothing plays" }), tip: t`Nothing plays` },
  { mode: "same", name: t`Same as Battle`, tip: t`The battle music plays on here, from where it is` },
];
const NAME = Object.fromEntries(MODES.map((m) => [m.mode, m.name])) as Record<Mode, string>;
const MIXED = t({ message: "Mixed", context: "modes", comment: "How a piece of music plays when the parts play in different ways" });
/** Each mode's undo label (core soundtrack_set): a key of EDIT_NAMES (store.tsx), which has the words for it. */
const EDIT: Record<Mode, string> = { original: "Original", song: "One Song", tracks: "Playlist", silent: "Silent", same: "Same as Battle" };
/** How a group of the play order picks what plays: its name, what it does, its icon, and what joins the things in it
    (`join` between segments on a line, `then` between groups; `word`: the join is a word, not a symbol). */
const KIND = [
  { name: t`In order`, tip: t`Plays these one after another`, Icon: InOrderIcon, join: "→",
    then: t({ message: "then", comment: "Between two groups of the play order: the second plays after the first" }) },
  { name: t`Next each time`, tip: t`Plays one of these each time, the next in order, going on from where the music last stopped`, Icon: NextEachIcon, join: "→",
    then: t({ message: "next time", comment: "Between two groups of the play order: the second plays the next time the music comes" }) },
  { name: t`Shuffled`, tip: t`Plays all of these in a random order`, Icon: ShuffleIcon, join: "·",
    then: t({ message: "and", comment: "Between two groups of the play order that play in a random order" }) },
  { name: t`One at random`, tip: t`Plays one of these, picked at random`, Icon: RandomIcon,
    join: t({ message: "or", comment: "Between segments or groups of the play order: one of them plays, picked at random" }), then: t`or`, word: true },
];

type Sections = { section: { id: string; name: string }; items: MusicItem[] }[];

/** The music the Soundtrack sets: Index music with a playlist (music that is one segment has no order to change), by
    section in mission order. */
function useMusic(): Sections {
  const { itemIndex } = useEditor();
  return useMemo(() => itemIndex.music.map((s) => ({
    section: s, items: s.items.filter((it) => it.kind === "music" && it.parts.some((p) => p.kind === "playlist")),
  })).filter((g) => g.items.length), [itemIndex]);
}

const playlists = (it: MusicItem) => it.parts.filter((p) => p.kind === "playlist");
const ORIGINAL: Piece = { mode: "original" }; // one object, so what is worked out from a piece keeps while it does
const pieceOf = (soundtrack: Record<string, Piece> | undefined, cue: string): Piece => soundtrack?.[cue] ?? ORIGINAL;
/** The battle music an intense piece can follow: the Battle of its section. */
function partnerOf(sections: Sections, it: MusicItem): string | null {
  if (it.role !== "intense") return null;
  const battle = sections.find((g) => g.items.includes(it))?.items.find((x) => x.role === "battle");
  return battle ? playlists(battle)[0]?.cue ?? null : null;
}
/** Combat music plays in fights; the rest plays each time the moment comes. */
const inFights = (it: MusicItem) => it.role === "battle" || it.role === "intense";
const fmtDb = (db: number) => (db ? `${db > 0 ? "+" : "−"}${fmtNumber(Math.abs(db), Math.abs(db) % 1 ? 1 : 0)} dB` : "0 dB");
const fileName = (path: string) => path.split(/[\\/]/).pop() ?? path;
const byName = (files: string[]) => [...files].sort((a, b) => fileName(a).localeCompare(fileName(b), undefined, { numeric: true }));

type Pick = { item: string; part: number };
const PICK_KEY = "audiodiver.soundtrack";
const LIST_WIDTH = 330; // the music list's width to start with (px at the default text size)
const OPEN = "audiodiver:soundtrack-open";
const DROP = "audiodiver:soundtrack-drop";

const SELECT = "audiodiver:soundtrack-select";
let toSelect: { cue: string; source: string } | null = null; // a slot to select once the piece shows (PieceView takes it)

/** Shows a piece of music in the Soundtrack, at its part `cue`, with the slot `select` selected (the now-playing
    bar leads back to what plays this way). */
export function openInSoundtrack(item: MusicItem, cue: string, select?: string | null) {
  const pick: Pick = { item: item.id, part: Math.max(0, playlists(item).findIndex((p) => p.cue === cue)) };
  try { localStorage.setItem(PICK_KEY, JSON.stringify(pick)); } catch { /* storage off */ }
  toSelect = select ? { cue, source: select } : null;
  window.dispatchEvent(new CustomEvent<Pick>(OPEN, { detail: pick }));
  window.dispatchEvent(new Event(SELECT));
  nav.go("soundtrack");
}

/** What a drop on the Soundtrack hit: a place of a playlist, a segment left free, or One song (App.tsx routes drops
    here). */
export type SoundtrackTarget = { kind: "place"; cue: string; index: number } | { kind: "segment"; cue: string; seg: string } | { kind: "song"; cue: string };
export function soundtrackDrop(target: SoundtrackTarget, files: string[]) {
  window.dispatchEvent(new CustomEvent(DROP, { detail: { target, files } }));
}

/** The Soundtrack tab: all music on the left, with how each plays; the one picked in the middle, with its mode, its
    level, fights to listen to, its segments and play order, and the waveforms of the segment selected. */
export function SoundtrackPanes({ hidden }: { hidden: boolean }) {
  const { project, itemIndex, actions } = useEditor();
  const sections = useMusic();
  const [pick, setPick] = useState<Pick | null>(() => {
    try { return JSON.parse(localStorage.getItem(PICK_KEY) ?? "null"); } catch { return null; }
  });
  useEffect(() => { try { localStorage.setItem(PICK_KEY, JSON.stringify(pick)); } catch { /* storage off */ } }, [pick]);
  useEffect(() => {
    const show = (e: Event) => setPick((e as CustomEvent<Pick>).detail);
    window.addEventListener(OPEN, show);
    return () => window.removeEventListener(OPEN, show);
  }, []);
  const item = pick ? itemIndex.items.get(pick.item) : undefined;
  const count = item ? playlists(item).length : 0;
  const [width, setWidth] = useStoredWidth("audiodiver.soundtrackLeft", LIST_WIDTH);
  return (
    <div className="panes st-panes" hidden={hidden} style={{ ["--left" as any]: `${width}px` }}>
      <aside className="library" aria-label={t`Music`}>
        {project ? <MusicList sections={sections} pick={pick} setPick={setPick} /> : (
          <div className="lib-empty">
            <h2><Trans>No project open</Trans></h2>
            <p><Trans>Open or create a project to set how the music plays.</Trans></p>
            <div className="row-btns">
              <button className="btn primary" onClick={actions.newProject}><Trans>New Project</Trans></button>
              <button className="btn" onClick={() => actions.openProject()}><Trans>Open Project</Trans></button>
            </div>
          </div>
        )}
      </aside>
      <Splitter width={width} onResize={setWidth} initial={LIST_WIDTH} panel="left" label={t`Resize the list`} />
      <main className="center">
        {project && item && count ? (
          <PieceView key={item.id} item={item} part={Math.min(pick!.part, count - 1)} sections={sections}
            setPart={(part) => setPick({ item: item.id, part })} open={(id) => setPick({ item: id, part: 0 })} />
        ) : (
          <div className="st-empty center-note"><p>{project ? t`Choose music on the left.` : ""}</p></div>
        )}
      </main>
    </div>
  );
}

/** All music by section, each with how it plays (the mode of every part, or Mixed) and the level. The search box
    narrows the list to music whose section, name or mode has every word typed, as the Index search does: ↑ ↓ move
    through what matches and Enter opens it. Collapse all folds every section. */
function MusicList({ sections, pick, setPick }: { sections: Sections; pick: Pick | null; setPick: (p: Pick) => void }) {
  const { project, actions, quick } = useEditor();
  const [menu, openMenu] = useContextMenu();
  const st = project?.soundtrack ?? {};
  const [shut, setShut] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const [hi, setHi] = useState(-1); // the row the search box's arrow keys are on
  const list = useRef<HTMLDivElement>(null);
  useKeymap(); // the search key in the box follows a rebinding
  // the music picked shows: its section opens and the list scrolls to it (it may come from a link in Audio)
  useEffect(() => {
    const sec = pick && sections.find((g) => g.items.some((it) => it.id === pick.item));
    if (sec) setShut((s) => (s[sec.section.id] ? { ...s, [sec.section.id]: false } : s));
    const t = setTimeout(() => list.current?.querySelector(".st-row.active")?.scrollIntoView({ block: "nearest" }), 30);
    return () => clearTimeout(t);
  }, [pick?.item]); // eslint-disable-line react-hooks/exhaustive-deps

  // the templates: much music set at once, as one undo step (or a note that nothing needed it)
  const combat = sections.filter((g) => g.items.some((it) => it.role === "battle"));
  const apply = (set: Record<string, Piece | null>, label: string, done: string) =>
    Object.keys(set).length ? actions.soundtrackSet(set, label, done) : quick(t`No music needed a change`, "info");
  const templates: MenuEntry[] = [
    {
      label: t`Battle Songs: every Intense Battle set to Same as Battle`, run: () => {
        const set: Record<string, Piece> = {};
        for (const g of combat) for (const it of g.items) {
          const follows = partnerOf(sections, it);
          if (follows) for (const p of playlists(it)) set[p.cue] = { mode: "same", follows, ...gainOf(st, p.cue) };
        }
        const enemies = combat.length;
        apply(set, "Battle Songs", t`Intense Battle follows Battle for ${plural(enemies, { one: "# enemy", other: "# enemies" })}`);
      },
    },
    {
      label: t`Quiet Exploring: every Exploring set to Silent`, run: () => {
        const set: Record<string, Piece> = {};
        for (const g of combat) for (const it of g.items) {
          if (it.role === "exploring") for (const p of playlists(it)) set[p.cue] = { mode: "silent", ...gainOf(st, p.cue) };
        }
        apply(set, "Quiet Exploring", t`Exploring set to Silent`);
      },
    },
    {
      label: t`No Openings: fights start on the music itself`, run: async () => {
        const set: Record<string, Piece> = {};
        for (const g of combat) for (const it of g.items) {
          if (it.role !== "battle" && it.role !== "intense") continue;
          for (const p of playlists(it)) {
            const was = pieceOf(st, p.cue);
            if (was.mode !== "original") continue; // One song and Playlist keep the openings
            const m = await call<PlaylistMap>("playlist_map", { cue: p.cue }).catch(() => null);
            const o = m && openings(m);
            if (!m || !o) continue;
            const out = new Set([...(was.left_out ?? []), ...leaves(o).map((l) => l.item)]);
            if (leaves(m.tree).some((l) => !out.has(l.item))) set[p.cue] = { mode: "original", left_out: [...out], ...gainOf(st, p.cue) };
          }
        }
        const pieces = Object.keys(set).length;
        apply(set, "No Openings", t`Fights start on the music itself in ${plural(pieces, { one: "# piece", other: "# pieces" })}`);
      },
    },
    "-",
    {
      label: t`Original: all music back to Original`, disabled: !Object.keys(st).length, run: () => {
        actions.soundtrackSet(Object.fromEntries(Object.keys(st).map((cue) => [cue, null])), "Original soundtrack", t`All music set back to Original`);
      },
    },
  ];

  const modesOf = (it: MusicItem) => [...new Set(playlists(it).map((p) => pieceOf(st, p.cue).mode))];
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = words.length ? sections.map((g) => ({ ...g, items: g.items.filter((it) => {
    const modes = modesOf(it), hay = `${g.section.name} ${it.name} ${it.full} ${modes.length === 1 ? NAME[modes[0]] : MIXED}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  }) })).filter((g) => g.items.length) : sections;
  const found = shown.flatMap((g) => g.items);
  useEffect(() => setHi(words.length && found.length ? 0 : -1), [query]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (hi >= 0) list.current?.querySelector(".st-row.hi")?.scrollIntoView({ block: "nearest" }); }, [hi]);
  const searchKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") { if (query) setQuery(""); else e.currentTarget.blur(); }
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setHi((h) => Math.max(0, Math.min(found.length - 1, h + (e.key === "ArrowDown" ? 1 : -1))));
    } else if (e.key === "Enter" && found.length) {
      e.preventDefault();
      setPick({ item: found[Math.max(0, hi)].id, part: 0 });
    }
  };
  const searchKey = keyLabel("search");

  return (
    <>
      <div className="lib-title">
        <h2>{t`Music`}</h2>
        <button className="btn quiet small-btn" onClick={(e) => openMenu(e, templates)} data-tip={t`Set much music at once`}><Trans>Templates</Trans></button>
        <Help tip={t`What each template does. Undo takes back a whole template`} page="soundtrack#music" />
      </div>
      <div className="lib-search">
        <input type="search" placeholder={searchKey ? t`Search the music  ( ${searchKey} )` : t`Search the music`} value={query}
          onChange={(e) => setQuery(e.target.value)} aria-label={t`Search the music`} onKeyDown={searchKeys} />
        <button className="icon-btn" onClick={() => setShut(Object.fromEntries(sections.map((g) => [g.section.id, true])))}
          aria-label={t`Collapse all`} data-tip={t`Collapse all`}><CollapseAllIcon /></button>
      </div>
      <div className="lib-tree st-list" ref={list}>
        {shown.map(({ section, items }) => {
          const open = words.length > 0 || !shut[section.id]; // a search opens what it finds
          return (
            <div key={section.id} className="lib-group">
              <button className="lib-group-head sub" aria-expanded={open} onClick={() => setShut((s) => ({ ...s, [section.id]: open }))}>
                <span className="caret" aria-hidden>▸</span>
                <span className="lib-group-name">{section.name}</span>
              </button>
              {open && items.map((it) => {
                const modes = modesOf(it);
                const gains = [...new Set(playlists(it).map((p) => pieceOf(st, p.cue).gain_db ?? 0))];
                return (
                  <button key={it.id} className={`st-row${pick?.item === it.id ? " active" : ""}${hi >= 0 && found[hi] === it ? " hi" : ""}`}
                    onClick={() => setPick({ item: it.id, part: 0 })}>
                    <span className="st-name">{it.name}</span>
                    {gains.length === 1 && gains[0] ? <span className="st-gain" data-tip={t`Level of the whole piece`}>{fmtDb(gains[0])}</span> : null}
                    <span className={`st-mode ${modes.length === 1 ? modes[0] : "mixed"}`}
                      data-tip={modes.length === 1 ? undefined : t`The parts of this music play in different ways`}>{modes.length === 1 ? NAME[modes[0]] : MIXED}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
        {!shown.length && <p className="empty-note"><Trans>Nothing matches “{query}”.</Trans></p>}
      </div>
      {menu}
    </>
  );
}

const gainOf = (st: Record<string, Piece>, cue: string) => (st[cue]?.gain_db ? { gain_db: st[cue].gain_db } : {});

/** A run of the fight player: a play-through of one fight (Through, for the waveforms and the position bar), its
    number, and which side. */
type FightRun = Through & { n: number };

/** One piece of music: its parts as tabs, the mode and level, the fight player, what the mode shows (its places,
    pieces or layers), the play order, and the waveforms of the segment selected. */
function PieceView({ item, part, setPart, sections, open }: {
  item: MusicItem; part: number; setPart: (n: number) => void; sections: Sections; open: (id: string) => void;
}) {
  const { project, actions, itemIndex, notify, goTo, revision } = useEditor();
  const shown = useShownTabs();
  const parts = playlists(item);
  const cueId = parts[part].cue;
  const piece = pieceOf(project?.soundtrack, cueId);
  const [map, setMap] = useState<PlaylistMap | null>(null);
  const [cue, setCue] = useState<Cue | null>(null);
  const [failed, setFailed] = useState("");
  const [slicing, setSlicing] = useState<{ file?: string } | null>(null); // the slice tool, and the song it starts on
  const [exporting, setExporting] = useState<"item" | "list" | null>(null); // the Export panel, on the piece or on the list
  const [sel, setSel] = useState<string | null>(null);  // the slot selected: a segment's first, or a layer's
  const [run, setRun] = useState<FightRun | null>(null);
  const [now, setNow] = useState<Mark | null>(null);    // the segment a fight is at
  // both as the lines below read them, each for itself
  const [marks] = useState(() => markStore({ sel: null, now: null }));
  useLayoutEffect(() => marks.set({ sel, now: now?.segment ?? null }), [marks, sel, now]);
  const [panels, setPanels] = usePanels("soundtrack");
  const [headH, setHeadH] = useStoredHeight("audiodiver.soundtrackHead", null); // null: as tall as its content
  const [menu, openMenu] = useContextMenu();
  const box = useRef<HTMLElement>(null);
  const body = useRef<HTMLDivElement>(null);
  // the map and the slots again when the piece or its audio changes
  const changed = JSON.stringify([piece, project?.revision]);
  useEffect(() => {
    let live = true;
    Promise.all([call<PlaylistMap>("playlist_map", { cue: cueId }), call<Cue>("cue", { id: cueId, mine: true })])
      .then(([m, c]) => { if (live) { setMap(m); setCue(c); setFailed(""); } })
      .catch((e) => live && setFailed(e.message ?? String(e)));
    return () => { live = false; };
  }, [cueId, changed]);
  useEffect(() => { setSel(null); setRun(null); }, [cueId]); // another part starts over
  // the slot openInSoundtrack asked for, once this part shows (now, or when it comes). It is let go of a moment
  // later, not at once: React runs a new view's effects twice in development
  useEffect(() => {
    const take = () => {
      const want = toSelect;
      if (want?.cue !== cueId) return;
      setSel(want.source);
      setTimeout(() => { if (toSelect === want) toSelect = null; });
    };
    take();
    window.addEventListener(SELECT, take);
    return () => window.removeEventListener(SELECT, take);
  }, [cueId]);
  const partner = partnerOf(sections, item);
  const fight = inFights(item);
  const set = (next: Piece | null, label: string, done?: string) => actions.soundtrackSet({ [cueId]: next }, label, done);
  const gain = piece.gain_db ?? 0;
  const keep = (p: Piece): Piece => (gain ? { ...p, gain_db: gain } : p);
  const firsts = useMemo(() => (cue ? firstSlots(cue) : new Map<string, string>()), [cue]);
  const lengths = useMemo(() => (cue ? originalLengths(cue) : new Map<string, number>()), [cue]);
  // one identity for the life of the view, so the play order's segments (PoSeg) don't draw again on each click
  const { at, toggle } = useStable({
    at: (source: string | null): PlayedAt => ({ scope: "soundtrack", itemId: item.id, cueId, source }),
    // a segment leaves (or comes back) wherever the piece plays it
    toggle: (it: string) => {
      if (!map) return;
      const all = leaves(map.tree);
      const seg = all.find((l) => l.item === it)?.segment;
      const same = all.filter((l) => l.segment === seg).map((l) => l.item);
      const out = new Set(piece.left_out ?? []);
      const leaving = !same.some((i) => out.has(i));
      for (const i of same) if (leaving) out.add(i); else out.delete(i);
      set(out.size || gain ? keep({ mode: "original", left_out: [...out] }) : null, leaving ? "leave out" : "put back");
    },
  });

  /** The slots of some segments that have new audio: what One song or a playlist left in them. */
  const filled = (segs: string[]) => {
    const want = new Set(segs), out = new Set<string>();
    for (const s of cue?.segments_detail ?? []) {
      if (want.has(s.segment)) for (const st of s.stems) for (const sl of st.slots) if (project?.assignments[sl.source]) out.add(sl.source);
    }
    return [...out];
  };
  const choose = async (mode: Mode) => {
    if (mode === piece.mode) return;
    const left = piece.mode === "song" || piece.mode === "tracks" ? filled(piece.segments ?? []) : [];
    const ok = mode === "original" ? await set(gain ? { mode, gain_db: gain } : null, "Original")
      : mode === "same" ? await set(keep({ mode, follows: partner! }), "Same as Battle")
      : await set(keep({ mode }), EDIT[mode]);
    if (ok && left.length) {
      const segments = piece.segments?.length ?? 0;
      const text = piece.mode === "song"
        ? mode === "original"
          ? t`The song pieces stay as new audio in ${plural(segments, { one: "# segment", other: "# segments" })}, in the original order.`
          : t`The song pieces stay as new audio in ${plural(segments, { one: "# segment", other: "# segments" })}.`
        : mode === "original"
          ? t`The songs stay as new audio in ${plural(segments, { one: "# segment", other: "# segments" })}, in the original order.`
          : t`The songs stay as new audio in ${plural(segments, { one: "# segment", other: "# segments" })}.`;
      notify("info", text, { label: t`Remove`, run: () => actions.unassign(left) });
    }
  };
  const songTarget = map && cue ? {
    cue, segments: map.song, fill: (file: string, bounds: number[]) => actions.songFill(cueId, file, bounds, map.song),
  } : undefined;
  const plays = piece.mode !== "silent" && piece.mode !== "same";

  // the segments a song leaves free: the rest of One Song's places, which play after the pieces, and the openings
  const free = useMemo(() => {
    const line = (seg: string) => ({ seg, source: firsts.get(seg) ?? null });
    const added = new Set(piece.added ?? []), cut = (piece.segments ?? []).filter((s) => !added.has(s));
    return {
      rest: piece.mode === "song" && cut.length ? (map?.song ?? []).filter((s) => !cut.includes(s)).map(line) : [],
      openings: piece.mode === "song" || piece.mode === "tracks" ? (map?.openings ?? []).map(line) : [],
    };
  }, [map, firsts, piece]);
  /** Files into a free segment and the free segments after it, in file-name order. */
  const fillFree = (seg: string, files: string[]) => {
    const list = free.rest.some((x) => x.seg === seg) ? free.rest : free.openings;
    const after = list.slice(list.findIndex((x) => x.seg === seg)).filter((x) => x.source);
    const fit = byName(files).slice(0, after.length), over = files.length - fit.length;
    actions.segmentsSet(cueId, Object.fromEntries(fit.map((f, i) => [after[i].seg, f])));
    if (over > 0) notify("info", t`${plural(over, { one: "# song left over", other: "# songs left over" })}.`);
  };

  // the places of a playlist, and what a drop or a choice puts there
  const places = useMemo(() => {
    const listed = new Set(piece.mode === "tracks" ? piece.segments ?? [] : []);
    return (map?.song ?? []).map((seg) => {
      const source = firsts.get(seg) ?? null, a = source && listed.has(seg) ? project?.assignments[source] : undefined;
      return { seg, source, a: a && !a.silence ? a : undefined };
    });
  }, [map, firsts, piece, project?.assignments]);
  const current = () => places.map((x, k): { keep: number } | null => (x.a ? { keep: k } : null));
  const put = (k: number, files: string[]) => {
    const next: ({ keep: number } | { file: string } | null)[] = current();
    const fit = byName(files).slice(0, places.length - k);
    fit.forEach((f, i) => { next[k + i] = { file: f }; });
    const songs = fit.length, place = k + 1, over = files.length - fit.length, total = places.length;
    actions.playlistSet(cueId, next, songs > 1 ? t`${plural(songs, { one: "# song", other: "# songs" })} from place ${place}` : undefined);
    if (over > 0) notify("info", t`${plural(over, { one: "# song left over", other: "# songs left over" })}. This music has ${plural(total, { one: "# place", other: "# places" })}.`);
  };
  // the bodies below are memo: they draw again when the piece changes, not on each click
  const pass = useStable({
    current, put, onSet: set,
    onFill: fillFree,
    onClear: (seg: string) => { actions.segmentsSet(cueId, { [seg]: null }); },
    onSkip: (seg: string) => {
      const here = cue?.segments_detail.find((s) => s.segment === seg);
      const slots = here?.stems.flatMap((st) => st.slots).filter((sl) => !sl.unused && !sl.locked && !sl.absent).map((sl) => sl.source) ?? [];
      if (map) actions.skip(slots, segName(map, seg));
    },
    onChoose: () => setSlicing({}),
    onRecut: () => setSlicing({ file: project && piece.song ? fullPath(project.folder, piece.song) : undefined }),
  });
  // a drop on One song or on a place (App.tsx hands it over)
  const latest = useRef({ put, fillFree, cueId });
  latest.current = { put, fillFree, cueId };
  useEffect(() => {
    const take = (e: Event) => {
      const { target, files } = (e as CustomEvent<{ target: SoundtrackTarget; files: string[] }>).detail;
      if (target.cue !== latest.current.cueId) return;
      if (target.kind === "place") latest.current.put(target.index, files);
      else if (target.kind === "segment") latest.current.fillFree(target.seg, files);
      else setSlicing({ file: files[0] });
    };
    window.addEventListener(DROP, take);
    return () => window.removeEventListener(DROP, take);
  }, []);

  // what the keys go through, top to bottom: the places of a playlist, the pieces of a song, else the play order
  const order = useMemo(() => {
    if (!map) return [];
    const segs = piece.mode === "tracks" ? [...map.song, ...map.openings]
      : piece.mode === "song" ? [...(piece.segments ?? []).filter((s) => !piece.added?.includes(s)), ...free.rest.map((x) => x.seg), ...map.openings]
      : leaves(piece.mode === "original" ? map.tree : map.mine ?? map.tree).map((l) => l.segment!);
    return [...new Set(segs.map((s) => firsts.get(s)).filter((s): s is string => !!s))];
  }, [map, piece, firsts, free]);
  const reveal = (source: string) => {
    requestAnimationFrame(() => body.current?.querySelector(`[data-source="${source}"]`)?.scrollIntoView({ block: "nearest", behavior: scrollBehavior() }));
  };
  // a fight that plays selects the segment it is at, as Play through does in Audio
  useEffect(() => {
    if (!now) return;
    const source = now.clips[0]?.source ?? firsts.get(now.segment);
    if (source) { setSel(source); reveal(source); }
  }, [now]); // eslint-disable-line react-hooks/exhaustive-deps
  const here = () => nav.get().tab === "soundtrack" && order.length > 0;
  const playSel = (kind: "vanilla" | "project" | null) => {
    if (!here() || !sel) return false;
    const a = project?.assignments[sel];
    if (kind === "project" && !audible(a)) return false;
    playSlot(kind ?? (audible(a) ? "project" : "vanilla"), sel, revision, segLabel(sel), at(sel));
  };
  const segLabel = (source: string) => {
    const seg = [...firsts].find(([, s]) => s === source)?.[0], full = item.full;
    return seg && map ? `${full} · ${segName(map, seg)}` : t`${full} · segment`;
  };
  useCommands({
    selectPrev: () => { if (!here()) return false; const i = sel ? order.indexOf(sel) : 0; const to = order[Math.max(0, i - 1)]; setSel(to); reveal(to); },
    selectNext: () => { if (!here()) return false; const i = sel ? order.indexOf(sel) : -1; const to = order[Math.min(order.length - 1, i + 1)]; setSel(to); reveal(to); },
    playPause: () => {
      if (!here()) return false;
      const st = player.state;
      if (st.key && (st.playing || !sel || st.key.startsWith("fight:") || st.key.endsWith(`:${sel}`))) return false; // the app's key pauses
      return playSel(null);
    },
    playGame: () => playSel("vanilla"),
    playMine: () => playSel("project"),
  }, 1);

  // Copy to: the same setup in the music of this name elsewhere (Battle in every enemy's music)
  const others = sections.flatMap((g) => g.items.filter((it) => it.id !== item.id && it.name === item.name
    && (piece.mode !== "same" || partnerOf(sections, it))));
  const copyTo = (e: React.MouseEvent) => {
    const target = (it: MusicItem) => { const ps = playlists(it); return ps[Math.min(part, ps.length - 1)].cue; };
    const to = (list: MusicItem[]) => Object.fromEntries(list.map((it) => [target(it), piece.mode === "same" ? partnerOf(sections, it) : null]));
    const name = item.name, count = others.length;
    openMenu(e, [
      { label: t`Every Other ${name} (${count})`, run: () => actions.soundtrackCopy(cueId, to(others), t`every other ${name}`) },
      "-",
      ...others.map((it): MenuEntry => ({ label: it.full, run: () => actions.soundtrackCopy(cueId, to([it]), it.full) })),
    ]);
  };
  const inAudio = shown.includes("editor") && !!project?.library.includes(item.id);
  // how tall the header or the waveforms may get: the lines in between keep at least 120px
  const room = (panel: "top" | "wave") => {
    const c = box.current;
    if (!c) return 400;
    const h = (q: string) => c.querySelector(q)?.getBoundingClientRect().height ?? 0;
    return c.getBoundingClientRect().height - h(".cue-bar") - h(panel === "top" ? ".timeline" : ".cue-top") - 120;
  };

  return (
    <section className="cue st-piece" aria-label={item.full} ref={box}>
      {panels.head && (
        <div className={`cue-top${headH != null ? " sized" : ""}`} style={headH != null ? { height: headH } : undefined}>
          <header className="cue-head st-head">
            <div className="head-row">
              <div className="crumbs">{itemIndex.section.get(item.id)?.name}</div>
            </div>
            <div className="item-title">
              <h1>{item.name}</h1>
              {inAudio && (
                <button className="link-text st-slots" onClick={() => goTo({ scope: "editor", itemId: item.id, cueId, source: sel })}
                  data-tip={t`The slots of this music in Audio`}><AudioIcon /><Trans>Slots</Trans></button>
              )}
            </div>
            {parts.length > 1 && (
              <div className="parts" role="tablist" aria-label={t`Parts`} onKeyDown={tabArrows}>
                {parts.map((p, i) => (
                  <button key={p.cue} role="tab" aria-selected={i === part} className={`part-tab${i === part ? " on" : ""}`} onClick={() => setPart(i)}>
                    <span>{p.name || t`Part ${ph({ n: i + 1 })}`}</span>
                    <span className="part-len">{NAME[pieceOf(project?.soundtrack, p.cue).mode]}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="st-controls">
              <div className="segmented st-modes" role="radiogroup" aria-label={t`How it plays`}>
                {MODES.filter((m) => m.mode !== "same" || partner).map((m) => (
                  <button key={m.mode} role="radio" aria-checked={piece.mode === m.mode} className={piece.mode === m.mode ? "on" : ""}
                    data-tip={m.tip} onClick={() => choose(m.mode)}>{m.name}</button>
                ))}
              </div>
              <Help tip={t`What each mode does`} page="soundtrack#modes" />
              <Level db={gain} onSet={(db) => set(db || piece.mode !== "original" || piece.left_out?.length ? { ...piece, gain_db: db } : null, "level")}
                off={piece.mode === "silent" ? t`Nothing of this music plays while it is Silent`
                  : piece.mode === "same" ? t`The Battle music plays here, at the Battle level` : undefined} />
              {piece.mode !== "original" && others.length > 0 && (
                <button className="btn quiet small-btn" onClick={copyTo} data-tip={t`Sets other ${ph({ name: item.name })} music to ${ph({ mode: NAME[piece.mode] })} too`}
                  data-tip-more={piece.mode === "song" ? t`With the song and the level` : piece.mode === "tracks" ? t`With the songs, Shuffle, Continue and the level` : t`With the level`}><Trans>Copy To</Trans></button>
              )}
            </div>
          </header>
          <ResizeEdge edge="bottom" label={t`Resize the header`} min={56} max={() => room("top")}
            onResize={setHeadH} onReset={() => setHeadH(null)} />
        </div>
      )}
      <div className="cue-bar">
        {map && plays && <FightBar map={map} item={item} run={run} setRun={setRun} onNow={setNow} />}
        <div className="tools">
          <ToolButton icon={<ExportIcon />} name={t`Export`} disabled={!cue} onClick={() => setExporting("item")}
            about={t`The whole piece, a fight or the segments, as WAV, FLAC or MP3`} />
          <ExportListChip onOpen={() => setExporting("list")} />
        </div>
        <PanelToggles panels={panels} set={setPanels} waves={!!cue && !!sel} />
      </div>
      {failed ? <p className="slots-note">{failed}</p> : !map || !cue ? <p className="slots-note">{t`Reading the music…`}</p> : (
        <div className="st-body" ref={body}>
          {run && <Transcript run={run} now={now} fight={fight} />}
          {piece.mode === "song" && <SongBody map={map} cue={cue} piece={piece} firsts={firsts} lengths={lengths} marks={marks} onPick={setSel} at={at}
            fight={fight} onChoose={pass.onChoose} onRecut={pass.onRecut} rest={free.rest} onFill={pass.onFill} onClear={pass.onClear} />}
          {piece.mode === "tracks" && <PlaylistBody map={map} piece={piece} places={places} cueId={cueId} lengths={lengths} marks={marks} onPick={setSel} at={at}
            current={pass.current} put={pass.put} onSet={pass.onSet} fight={fight} />}
          {free.openings.length > 0 && <Openings map={map} cue={cue} lines={free.openings} from={map.song.length + 1} lengths={lengths} marks={marks}
            onPick={setSel} at={at} fight={fight} onFill={pass.onFill} onClear={pass.onClear} onSkip={pass.onSkip} />}
          {piece.mode === "silent" && <p className="st-note"><Trans>Nothing plays while the game would play this music.</Trans></p>}
          {piece.mode === "same" && partner && (
            <p className="st-note"><Trans>The <button className="link-text" onClick={() => open(itemIndex.byCue.get(partner)?.item.id ?? item.id)}>Battle</button> music
              plays on here, from where it is.</Trans></p>
          )}
          {piece.mode === "original" && <Layers cue={cue} marks={marks} onPick={setSel} at={at} lengths={lengths} />}
          {plays && (
            <div className="st-order">
              <h2>{piece.mode === "original" ? t`Play order` : t`Play order in the project`} <Help tip={t`How the game picks the next segment`} page="soundtrack#play-order" /></h2>
              {piece.mode === "original"
                ? <PlayOrder map={map} tree={map.tree} firsts={firsts} lengths={lengths} leftOut={piece.left_out} onToggle={toggle} marks={marks} onPick={setSel} at={at} fight={fight} />
                : <PlayOrder map={map} tree={map.mine ?? map.tree} firsts={firsts} lengths={lengths} marks={marks} onPick={setSel} at={at} fight={fight} />}
            </div>
          )}
        </div>
      )}
      {panels.waves && cue && <Timeline room={() => room("wave")} through={run} at={sel ? at(sel) : null} cue={cue} source={sel} />}
      {slicing && songTarget && <SliceTool target={songTarget} file={slicing.file} onClose={() => setSlicing(null)} />}
      {exporting && (
        <ExportPanel start={exporting} onClose={() => setExporting(null)}
          target={cue ? { context: "soundtrack", cue, selected: sel ? [sel] : [], fight: fight && plays,
            name: parts.length > 1 ? `${item.full} · ${parts[part].name || t`Part ${ph({ n: part + 1 })}`}` : item.full,
            where: itemIndex.section.get(item.id)?.name ?? "" } : null} />
      )}
      {menu}
    </section>
  );
}

const LEVEL_MAX = 96; // dB either way, the range of Make-Up Gain (project.GAIN_DB)
const fmtLevel = (x: number) => `${x > 0 ? "+" : ""}${x}`;

/** The level of the whole piece: Make-Up Gain on every track of it, on top of each slot's own. Set with the slider or
    typed in the box (Enter takes it, Esc keeps the old value); arrow keys on the slider become one change once they
    rest, as Make-Up Gain's do. */
function Level({ db, onSet, off }: { db: number; onSet: (db: number) => void; off?: string /* why it does nothing now */ }) {
  const [v, setV] = useState(db);
  const [typed, setTyped] = useState<string | null>(null); // the box while it is typed in
  const escaped = useRef(false);
  const later = useRef(0);
  useEffect(() => setV(db), [db]);
  useEffect(() => () => clearTimeout(later.current), []);
  const commit = (x: number) => { clearTimeout(later.current); if (x !== db) onSet(x); };
  const commitSoon = (x: number) => { clearTimeout(later.current); later.current = window.setTimeout(() => commit(x), 600); };
  const takeTyped = () => {
    const x = Number(typed?.replace(",", ".").replace("−", "-"));
    setTyped(null);
    if (escaped.current) { escaped.current = false; return; }
    if (typed === null || typed.trim() === "" || !Number.isFinite(x)) return;
    const g = Math.round(Math.max(-LEVEL_MAX, Math.min(LEVEL_MAX, x)) * 2) / 2;
    setV(g);
    commit(g);
  };
  return (
    <div className={`st-level${off ? " off" : ""}`} data-tip={off ?? t`The level of the whole piece, on top of each slot's Make-Up Gain`}>
      <span>{t`Level`}</span>
      <input type="range" className="r-fader" style={rangeVars(v, -LEVEL_MAX, LEVEL_MAX, 0)} min={-LEVEL_MAX} max={LEVEL_MAX} step={0.5} value={v} aria-label={t`Level in dB`} disabled={!!off}
        onChange={(e) => setV(Number(e.target.value))} onPointerUp={() => commit(v)} onBlur={() => commit(v)}
        onKeyUp={(e) => { if (/^(Arrow|Home|End|Page)/.test(e.key)) commitSoon(v); }}
        onKeyDown={(e) => { if (e.ctrlKey || e.metaKey || e.altKey) commit(v); }} /* a nudge on its way goes first: then Ctrl+Z undoes it */ />
      <span className="st-db">
        <input className="gain-val" value={typed ?? fmtLevel(v)} aria-label={t`Level in dB, typed`} inputMode="decimal" disabled={!!off}
          onFocus={(e) => { setTyped(fmtLevel(v)); e.currentTarget.select(); }} onChange={(e) => setTyped(e.target.value)} onBlur={takeTyped}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); else if (e.key === "Escape") { escaped.current = true; e.currentTarget.blur(); } }}
          data-tip={off ? undefined : t`Type a value from −${LEVEL_MAX} to +${LEVEL_MAX}`} /> dB
      </span>
      <ResetLevel off={!!off || (db === 0 && v === 0)} onReset={() => { setV(0); commit(0); }} more={t`0 dB on every track of the piece`} />
    </div>
  );
}

const segName = (map: PlaylistMap, seg: string) => map.segments[seg]?.name ?? seg;
/** The segments of a tree, every place each one plays. */
function leaves(n: PlayNode, out: PlayNode[] = []): PlayNode[] {
  if (n.segment !== undefined) out.push(n);
  else for (const c of n.children ?? []) leaves(c, out);
  return out;
}
/** The group of openings the music starts on (the item fights start on, when it is a group below the top): what the
    No openings template leaves out. */
function openings(map: PlaylistMap): PlayNode | null {
  if (map.entry === "0" || map.entry === map.tree.item) return null;
  const find = (n: PlayNode): PlayNode | null => (n.item === map.entry ? n : (n.children ?? []).reduce<PlayNode | null>((f, c) => f ?? find(c), null));
  const node = find(map.tree);
  return node && node.segment === undefined ? node : null;
}
/** The "?" after a note that the music starts on one of the openings. */
const OpeningsHelp = () => <Help tip={t`What the openings are, and how to change them`} page="soundtrack#openings" />;

/** The first slot of each segment that takes audio: what a segment plays, where a song's piece or a playlist's song
    goes, and what selecting the segment shows in the waveforms. */
function firstSlots(cue: Cue): Map<string, string> {
  const out = new Map<string, string>();
  for (const s of cue.segments_detail) {
    if (out.has(s.segment)) continue;
    const slot = s.stems.flatMap((st) => st.slots).find((sl) => !sl.unused && !sl.locked && !sl.absent);
    if (slot) out.set(s.segment, slot.source);
  }
  return out;
}
/** How long each segment's original is, as a slot's line in Audio says it: its first slot's clip. */
function originalLengths(cue: Cue): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of cue.segments_detail) {
    if (out.has(s.segment)) continue;
    const slot = s.stems.flatMap((st) => st.slots).find((sl) => !sl.unused && !sl.locked && !sl.absent);
    out.set(s.segment, slot?.duration_ms || s.duration_ms);
  }
  return out;
}

/** What the lines of a piece share. onPick and at keep one identity (useStable in PieceView), and the slot selected
    and the segment a fight is at come through `marks`, so the lines draw again only when their own look changes. */
type Pickable = { marks: MarkStore; onPick: (source: string) => void; at: (source: string | null) => PlayedAt; lengths: Map<string, number> };

/** The slot selected and the segment a fight is at, as the lines of a piece look at them: each line asks whether it
    is the one (useMarked) and draws again only when that answer changes, so a click on a battle's music draws two
    or three lines, not hundreds. */
type Marks = { sel: string | null; now: string | null };
function markStore(first: Marks) {
  let v = first;
  const subs = new Set<() => void>();
  return {
    get: () => v,
    set(next: Marks) { if (next.sel !== v.sel || next.now !== v.now) { v = next; subs.forEach((f) => f()); } },
    subscribe(f: () => void) { subs.add(f); return () => { subs.delete(f); }; },
  };
}
type MarkStore = ReturnType<typeof markStore>;
/** Whether the slot `source` is selected, and whether a fight is at the segment `seg`. */
function useMarked(marks: MarkStore, source: string | null, seg?: string) {
  const sel = useSyncExternalStore(marks.subscribe, () => !!source && marks.get().sel === source);
  const now = useSyncExternalStore(marks.subscribe, () => seg !== undefined && marks.get().now === seg);
  return { sel, now };
}

/** The play order as people read it, playing as the game's does: a group with one thing in it, played once, is that
    thing, and a group in order inside another, played once, runs on in it. The item the music starts on stays. */
function readable(n: PlayNode, entry: string): PlayNode {
  if (n.segment !== undefined || !n.children) return n;
  const plain = (c: PlayNode) => c.segment === undefined && c.loop === 1 && c.item !== entry;
  let kids = n.children.map((c) => readable(c, entry));
  if (!n.rs) kids = kids.flatMap((c) => (plain(c) && !c.rs && c.children ? c.children : [c]));
  if (kids.length === 1 && n.loop === 1 && n.item !== entry) return kids[0];
  return { ...n, children: kids };
}

/** The play order: the playlist as groups of segments, each group saying what it does with them, and the item fights
    start on flagged. Each segment plays what the project plays there (▶) and selects with a click; with onToggle
    (Original) a tick leaves it in or out.

    Laid out to be read at a glance, as the Wiki is: a group is a card under a header with the icon and name of what
    it does (bigger at the top, smaller further in, each level a shade darker), and what it holds is joined by what
    it means: "→" for in order, "or" for one at random. Segments flow on a line; a short choice of segments (`pick`)
    and a run of segments in order (`run`) take a line or less of their own, without a header.

    Drawn once for the piece and its audio (a battle's music has over a thousand elements); a click reaches only the
    segments it changes (`marks`). onToggle keeps one identity too. */
function PlayOrder({ map, tree, firsts, leftOut, onToggle, marks, onPick, at, fight }: Pickable & {
  map: PlaylistMap; tree: PlayNode; firsts: Map<string, string>; leftOut?: string[]; onToggle?: (item: string) => void; fight: boolean;
}) {
  const { project } = useEditor();
  const assignments = project?.assignments;
  const shown = useMemo(() => readable(tree, map.entry), [tree, map.entry]);
  return useMemo(() => {
    const away = new Set(leftOut ?? []);
    const segments = (n: PlayNode) => !!n.children?.length && n.children.every((c) => c.segment !== undefined);
    const plain = (n: PlayNode) => n.segment === undefined && n.loop === 1 && n.item !== map.entry;
    const isPick = (n: PlayNode) => plain(n) && (n.rs === 2 || n.rs === 3) && segments(n) && n.children!.length <= 4;
    const isRun = (n: PlayNode) => plain(n) && !n.rs && segments(n);
    const inline = (n: PlayNode) => n.segment !== undefined || isPick(n);

    const seg = (n: PlayNode) => {
      const source = firsts.get(n.segment!) ?? null;
      return <PoSeg key={n.item} n={n} name={segName(map, n.segment!)} ms={map.segments[n.segment!]?.ms ?? 0} source={source}
        kind={audible(source ? assignments?.[source] : undefined) ? "project" : "vanilla"} start={n.item === map.entry}
        out={away.has(n.item)} marks={marks} onPick={onPick} onToggle={onToggle} at={at} />;
    };
    /** Things joined by what the group does with them: segments and short choices on lines, the rest under each other. */
    const joined = (kids: PlayNode[], k: (typeof KIND)[number], depth: number) => {
      const out: React.ReactNode[] = [];
      let line: React.ReactNode[] = [];
      const flush = () => { if (line.length) out.push(<div key={`l${out.length}`} className="po-line">{line}</div>); line = []; };
      const then = (i: number) => out.push(<div key={`t${i}`} className="po-then" aria-hidden><span>{k.then}</span></div>);
      kids.forEach((c, i) => {
        if (inline(c)) {
          if (line.length) line.push(<span key={`j${i}`} className={`po-join${k.word ? " word" : ""}`} aria-hidden>{k.join}</span>);
          else if (out.length) then(i); // a line after a group
          line.push(c.segment !== undefined ? seg(c) : pick(c));
        } else {
          flush();
          if (out.length) then(i);
          out.push(node(c, depth + 1));
        }
      });
      flush();
      return out;
    };
    const pick = (n: PlayNode) => {
      const k = KIND[n.rs ?? 0];
      return (
        <span key={n.item} className={`po-pick k${n.rs}`} data-tip={k.name} data-tip-more={k.tip}>
          <k.Icon />{n.children!.flatMap((c, i) => [i ? <span key={`o${i}`} className="po-join word" aria-hidden>{k.join}</span> : null, seg(c)])}
        </span>
      );
    };
    const node = (n: PlayNode, depth: number): React.ReactNode => {
      if (n.segment !== undefined) return seg(n);
      const k = KIND[n.rs ?? 0], start = n.item === map.entry, loop = n.loop;
      if (isRun(n)) {
        return <div key={n.item} className="po-run" data-tip={k.name} data-tip-more={k.tip}><k.Icon />{joined(n.children!, k, depth)}</div>;
      }
      return (
        <section key={n.item} className={`po-group k${n.rs ?? 0} d${Math.min(depth, 3)}${start ? " start" : ""}`}>
          <header className="po-head">
            <span className="po-kind" data-tip={k.tip}><k.Icon />{k.name}</span>
            {loop !== 1 && <span className="po-pill" data-tip={loop ? plural(loop, { one: "Plays # time, then moves on", other: "Plays # times, then moves on" }) : t`Plays again and again until the music changes`}>
              <RepeatIcon />{loop ? plural(loop, { one: "# time", other: "# times" }) : t({ message: "repeats", comment: "A part of the play order that plays again and again until the music changes" })}</span>}
            {start && <span className="po-pill start" data-tip={fight ? t`Where the music starts when a fight begins` : t`Where the music starts each time it comes on`}>
              {fight ? t`Fights start here` : t`Starts here`}</span>}
          </header>
          <div className="po-kids">{joined(n.children ?? [], k, depth)}</div>
        </section>
      );
    };
    return <div className="po">{node(shown, 0)}</div>;
  }, [shown, map, firsts, leftOut, assignments, marks, onPick, onToggle, at, fight]);
}

/** A segment of the play order: ▶ plays what the project plays there, a click selects it, and with onToggle
    (Original) a tick leaves it in or out. */
const PoSeg = memo(function PoSeg({ n, name, ms, source, kind, start, out, marks, onPick, onToggle, at }: {
  n: PlayNode; name: string; ms: number; source: string | null; kind: "vanilla" | "project"; start: boolean; out: boolean;
  marks: MarkStore; onPick: (source: string) => void; onToggle?: (item: string) => void; at: (source: string | null) => PlayedAt;
}) {
  const { sel, now } = useMarked(marks, source, n.segment);
  const length = fmtTime(ms), loop = n.loop;
  const tip = loop === 1 ? `${name}, ${length}` : loop ? t`${name}, ${length}, ${plural(loop, { one: "# time", other: "# times" })}` : t`${name}, ${length}, repeats`;
  return (
    <div className={`po-seg${out ? " out" : ""}${now ? " now" : ""}${start ? " start" : ""}${sel ? " sel" : ""}`}
      data-source={source ?? undefined} data-tip={tip} onClick={() => source && onPick(source)}>
      {onToggle && <input type="checkbox" checked={!out} onChange={() => onToggle(n.item)} onClick={(e) => e.stopPropagation()}
        aria-label={t({ message: `Play ${name}`, comment: "A checkbox: whether the segment plays or is left out" })} data-tip={out ? t`Put it back` : t`Leave it out`} />}
      {source && <PlayButton kind={kind} source={source} label={name} small at={at(source)} onPlay={() => onPick(source)} />}
      <span className="po-name">{name}</span>
      {ms ? <span className="po-len">{fmtTime(ms)}</span> : null}
      {n.loop !== 1 && <span className="po-again" aria-label={loop ? plural(loop, { one: "# time", other: "# times" }) : t`repeats`}><RepeatIcon />{n.loop || ""}</span>}
    </div>
  );
});

/** Music whose segments play several layers at once (the Extraction music): the segments as rows, and as columns
    the layers that play at each switch value (low and high intensity), the slot in each cell. Shown when some
    segment has more than one layer. A cell selects its slot. */
const Layers = memo(function Layers({ cue, marks, onPick, at }: Pickable & { cue: Cue }) {
  const { project } = useEditor();
  const rows = useMemo(() => {
    const seen = new Set<string>(), out: { name: string; cells: Map<string, { source: string; label: string }> }[] = [];
    for (const s of cue.segments_detail) {
      if (seen.has(s.segment)) continue;
      seen.add(s.segment);
      const counts = new Map<string, number>(), cells = new Map<string, { source: string; label: string }>();
      for (const st of s.stems) for (const sl of st.slots) {
        if (sl.unused || sl.absent) continue;
        const v = sl.variant.replace(/^[^:]*:\s*/, ""), n = (counts.get(v) ?? 0) + 1;
        counts.set(v, n);
        cells.set(`${v}|${n}`, { source: sl.source, label: sl.label });
      }
      out.push({ name: s.name, cells });
    }
    return out;
  }, [cue]);
  const cols = useMemo(() => [...new Set(rows.flatMap((r) => [...r.cells.keys()]))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), [rows]);
  // a column's heading drops the switch name ("intensity: low" is "Low"); the tooltip has it whole
  const full = useMemo(() => {
    const out = new Map<string, string>();
    for (const s of cue.segments_detail) for (const st of s.stems) for (const sl of st.slots) out.set(sl.variant.replace(/^[^:]*:\s*/, ""), sl.variant);
    return out;
  }, [cue]);
  if (!rows.some((r) => r.cells.size > 1)) return null;
  const head = (c: string) => { const [v, n] = c.split("|"), value = v ? `${v[0].toUpperCase()}${v.slice(1)}` : ""; return value ? t`${value}, layer ${n}` : t`Layer ${n}`; };
  const whole = (c: string) => { const v = c.split("|")[0], f = full.get(v); return f && f !== v ? f : undefined; };
  return (
    <div className="st-order">
      <h2>{t`Layers`} <Help tip={t`Layers that play at the same time. Replace them in the Audio tab`} page="soundtrack#layers" /></h2>
      <div className="st-layers" role="table" style={{ gridTemplateColumns: `auto repeat(${cols.length}, minmax(0, 1fr))` }}>
        <span role="columnheader" />
        {cols.map((c) => <span key={c} role="columnheader" className="st-lh" data-tip={whole(c)}>{head(c)}</span>)}
        {rows.map((r) => (
          <div key={r.name} role="row" className="st-lrow">
            <span role="rowheader" className="st-lname">{r.name}</span>
            {cols.map((c) => {
              const cell = r.cells.get(c);
              if (!cell) return <span key={c} role="cell" />;
              return <LayerCell key={c} source={cell.source} label={cell.label} a={project?.assignments[cell.source]}
                name={`${r.name}, ${head(c)}`} marks={marks} onPick={onPick} at={at} />;
            })}
          </div>
        ))}
      </div>
    </div>
  );
});

function LayerCell({ source, label, a, name, marks, onPick, at }: Omit<Pickable, "lengths"> & {
  source: string; label: string; a?: Assignment; name: string;
}) {
  const { sel } = useMarked(marks, source);
  return (
    <span role="cell" className={`st-cell${a ? " mine" : ""}${sel ? " sel" : ""}`} data-tip={label || undefined}
      data-source={source} onClick={() => onPick(source)}>
      <PlayButton kind={audible(a) ? "project" : "vanilla"} source={source} label={name} small at={at(source)} onPlay={() => onPick(source)} />
      <span className="st-cname">{a ? (a.silence ? t`Silence` : a.name) : t`Original`}</span>
    </span>
  );
}

/** A segment as a line, as a slot's in Audio: its original (▶, number, name, length) and what the project puts
    there, which `children` draw. A click selects it. */
function SegLine({ n, seg, map, source, a, marks, onPick, at, lengths, drop, place, tag, children }: Pickable & {
  n: number; seg: string; map: PlaylistMap; source: string | null; a?: Assignment; drop?: string; place?: number; tag?: React.ReactNode; children: React.ReactNode;
}) {
  const name = segName(map, seg), ms = lengths.get(seg) ?? 0;
  const { sel, now } = useMarked(marks, source, seg);
  return (
    <div className={`st-line${sel ? " selected" : ""}${now ? " now" : ""}${a ? " assigned" : ""}`}
      data-source={source ?? undefined} data-drop={drop} data-place={place} onClick={() => source && onPick(source)} role="option" aria-selected={sel}>
      <div className="st-orig">
        {source ? <PlayButton kind="vanilla" source={source} label={t`the original ${name}`} at={at(source)} onPlay={() => onPick(source)} /> : <span className="play-gap" />}
        <span className="st-n">{n}</span>
        <span className="st-sname" data-tip={name} data-tip-clip>{name}</span>
        {tag}
        <span className="len">{ms ? fmtTime(ms) : "–"}</span>
      </div>
      <div className="st-new">{children}</div>
    </div>
  );
}

/** What a line plays in place of the original: the file (▶, its name, its length), or nothing yet. */
function NewAudio({ source, a, name, at, onPick, children }: {
  source: string; a: Assignment; name: string; at: PlayedAt; onPick: () => void; children?: React.ReactNode;
}) {
  return (
    <>
      <PlayButton kind="project" source={source} label={name} disabled={!a.exists} at={at} onPlay={onPick} />
      <span className={`file${a.exists ? "" : " missing"}`} data-tip={a.audio} data-tip-clip>{a.exists ? a.name : t`Missing: ${ph({ name: a.name })}`}</span>
      {a.duration_ms != null && <span className="len">{fmtTime(a.duration_ms)}</span>}
      {children}
    </>
  );
}

/** A segment left free, one line of what a song or a playlist doesn't fill. It takes files with a click or a drop
    (several fill the free lines after it too), plays them and gives them up. `a`, when it has audio. An opening can
    also be skipped (onSkip): silence, and the game moves straight on. */
function FreeLine({ n, seg, map, cueId, source, a, tag, about, onFill, onClear, onSkip, ...pick }: Pickable & {
  n: number; seg: string; map: PlaylistMap; cueId: string; source: string | null; a?: Assignment; tag?: React.ReactNode; about?: string;
  onFill: (seg: string, files: string[]) => void; onClear: (seg: string) => void; onSkip?: (seg: string) => void;
}) {
  const remove = <button className="x" aria-label={t`Remove the audio`} data-tip={t`Remove the audio`} onClick={(e) => { e.stopPropagation(); onClear(seg); }}>✕</button>;
  const choose = async () => { const f = await pickAudio(true); if (f?.length) onFill(seg, f); };
  return (
    <SegLine n={n} seg={seg} map={map} source={source} a={a} tag={tag} {...pick}
      drop={source ? JSON.stringify({ kind: "segment", cue: cueId, seg }) : undefined}>
      {source && a ? (a.silence ? <><span className="st-none st-silent" data-tip={a.fit_timing ? SILENCE_TIP.move : SILENCE_TIP.keep}>{t`Silence`}</span><span className="st-tools">{remove}</span></> : (
        <NewAudio source={source} a={a} name={a.name} at={pick.at(source)} onPick={() => pick.onPick(source)}>
          <span className="st-tools">{remove}</span>
        </NewAudio>
      )) : source ? (
        <>
          <button className="drop-hint" data-tip={about} onClick={(e) => { e.stopPropagation(); pick.onPick(source); choose(); }}>{t`Drop Audio or Choose a File`}</button>
          {onSkip && <span className="st-tools"><button className="x" aria-label={t`Skip it`} data-tip={t`Skip it`} data-tip-more={SILENCE_TIP.move}
            onClick={(e) => { e.stopPropagation(); onSkip(seg); }}><SkipIcon /></button></span>}
        </>
      ) : <span className="st-none" data-tip={t`This segment holds no audio that can be replaced`}>{t`No slot for audio`}</span>}
    </SegLine>
  );
}

/** The openings of a piece set to One Song or Playlist: they stay in its play order, so only their audio can change,
    from here as from Audio. A tag says when the same segment plays in other music too. */
const Openings = memo(function Openings({ map, cue, lines, from, fight, onFill, onClear, onSkip, ...pick }: Pickable & {
  map: PlaylistMap; cue: Cue; lines: { seg: string; source: string | null }[]; from: number; fight: boolean;
  onFill: (seg: string, files: string[]) => void; onClear: (seg: string) => void; onSkip: (seg: string) => void;
}) {
  const { project } = useEditor();
  const slots = useMemo(() => new Map(cue.segments_detail.flatMap((s) => s.stems.flatMap((st) => st.slots.map((sl) => [sl.source, sl] as const)))), [cue]);
  return (
    <div className="st-song">
      <h2>{t`Openings`} <OpeningsHelp /></h2>
      <div className="st-lines" role="listbox" aria-label={t`Openings`}>
        {lines.map((x, i) => {
          const slot = x.source ? slots.get(x.source) : undefined, also = slot ? slot.also_n ?? slot.also_in.length : 0, banks = slot?.banks ?? 0;
          return (
            <FreeLine key={x.seg} n={from + i} seg={x.seg} map={map} cueId={cue.id} source={x.source} a={x.source ? project?.assignments[x.source] : undefined}
              about={fight ? t`One of the openings starts each fight` : t`One of the openings plays each time the music comes on`}
              tag={also > 0 ? <Linked>{banks >= also ? plural(also, { one: "+# bank", other: "+# banks" }) : banks ? moreTag(also) : cuesTag(also)}</Linked> : undefined}
              onFill={onFill} onClear={onClear} onSkip={onSkip} {...pick} />
          );
        })}
      </div>
    </div>
  );
});

/** One song: the song, the pieces in the segments they went into, the ways to cut it again or choose another, and
    below the pieces the segments the song doesn't reach, which take files that play after it. A song dropped here
    opens the slice tool with it. */
const SongBody = memo(function SongBody({ map, cue, piece, firsts, fight, onChoose, onRecut, rest, onFill, onClear, ...pick }: Pickable & {
  map: PlaylistMap; cue: Cue; piece: Piece; firsts: Map<string, string>; fight: boolean; onChoose: () => void; onRecut: () => void;
  rest: { seg: string; source: string | null }[]; onFill: (seg: string, files: string[]) => void; onClear: (seg: string) => void;
}) {
  const { project } = useEditor();
  const added = new Set(piece.added ?? []);
  const segs = (piece.segments ?? []).filter((s) => !added.has(s));
  const opens = !!openings(map);
  const drop = JSON.stringify({ kind: "song", cue: cue.id });
  if (!segs.length) {
    const pieces = map.song.length;
    return (
      <div className="st-empty st-drop" data-drop={drop}>
        <p>{t`Choose a song to cut into up to ${plural(pieces, { one: "# piece", other: "# pieces" })}, or drop one here.`}</p>
        <button className="btn primary" onClick={onChoose}><Trans>Choose a Song</Trans></button>
      </div>
    );
  }
  return (
    <div className="st-song" data-drop={drop}>
      <div className="st-row-btns">
        {piece.song && <span className="st-songname" data-tip={piece.song}>{fileName(piece.song)}</span>}
        {piece.song && <button className="btn small-btn" onClick={onRecut}><Trans>Change the Cuts</Trans></button>}
        <button className="btn quiet small-btn" onClick={onChoose}><Trans>Choose Another Song</Trans></button>
      </div>
      <p className="st-note">{fight
        ? opens ? t`Each fight starts on one of the openings, then plays the song from piece 1.` : t`Each fight plays the song from piece 1.`
        : opens ? t`Each time the music comes on, one of the openings plays first, then the song from piece 1.`
        : t`The song plays from piece 1 each time the music comes on.`}{opens && <> <OpeningsHelp /></>}</p>
      <div className="st-lines" role="listbox" aria-label={t`Pieces`}>
        {segs.map((seg, i) => {
          const source = firsts.get(seg) ?? null, a = source ? project?.assignments[source] : undefined, n = i + 1;
          return (
            <SegLine key={seg} n={n} seg={seg} map={map} source={source} a={a} {...pick}>
              {source && a && !a.silence ? <NewAudio source={source} a={a} name={t({ message: `piece ${n}`, comment: "The nth piece of the song cut into the segments (One Song)" })} at={pick.at(source)} onPick={() => pick.onPick(source)} />
                : <span className="st-none">{t`No audio`}</span>}
            </SegLine>
          );
        })}
        {rest.map((x, i) => (
          <FreeLine key={x.seg} n={segs.length + i + 1} seg={x.seg} map={map} cueId={cue.id} source={x.source} {...pick}
            a={x.source && added.has(x.seg) ? project?.assignments[x.source] : undefined} about={t`Plays after the song`} onFill={onFill} onClear={onClear} />
        ))}
      </div>
    </div>
  );
});

type Place = { seg: string; source: string | null; a?: Assignment };
type PlaceSet = ({ keep: number } | { file: string } | null)[];

/** A song on the way to another place: the lines that take a song (tops and bottoms in the list) with the song cells
    on them, the one it left (`from`) and where it would land now (`to`: before that line, or after the last). */
type PlaceDrag = {
  id: number; y0: number; y: number; on: boolean; raf: number; list: HTMLElement; line: HTMLElement; cell: HTMLElement;
  view: HTMLElement | null; lines: { top: number; bottom: number }[]; cells: HTMLElement[]; from: number; to: number;
  cellTop: number; cellH: number; grab: number; step: number; esc?: (e: KeyboardEvent) => void;
};

/** Dragging a song to another place, as a pointer drag (the desktop window keeps HTML drag and drop for files from
    Explorer). The song follows the pointer and the songs it passes slide one place along, so the gap shows where it
    lands; the view scrolls at the top and bottom edges. On release, `move(from, to)` gets the song's place and the
    place it ends on, counted among the places that take a song. A press that doesn't move is a click, and Esc puts
    the song back. Drawn once a frame, outside React; the songs stay where they were let go until the new order is
    drawn. */
function usePlaceDrag(places: Place[], move: (from: number, to: number) => void) {
  const drag = useRef<PlaceDrag | null>(null);
  const swallow = useRef(false); // the click that ends a drag doesn't select a line
  const dropped = useRef<{ list: HTMLElement; cells: HTMLElement[] } | null>(null);
  const moveNow = useRef(move);
  moveNow.current = move;
  const home = (cells: HTMLElement[]) => cells.forEach((c) => { c.classList.remove("lifting"); c.style.transform = ""; });
  /** The new order is drawn: every song goes back to no offset at once, without a slide. */
  const settle = () => {
    const p = dropped.current;
    dropped.current = null;
    if (p) { p.list.classList.remove("dragging"); home(p.cells); }
  };
  useLayoutEffect(settle, [places]);
  useEffect(() => () => { const d = drag.current; if (d) { cancelAnimationFrame(d.raf); if (d.esc) window.removeEventListener("keydown", d.esc, true); } }, []);

  /** The songs between where the dragged one was and where it lands, one place along. */
  const open = (d: PlaceDrag, to: number) => {
    d.cells.forEach((c, i) => {
      if (i === d.from) return;
      const by = to > d.from && i > d.from && i < to ? -d.step : to <= d.from && i >= to && i < d.from ? d.step : 0;
      c.style.transform = by ? `translateY(${by}px)` : "";
    });
  };
  const frame = () => {
    const d = drag.current;
    if (!d?.on) return;
    d.raf = 0;
    let scrolled = false; // near an edge of the view, it scrolls a little each frame
    if (d.view) {
      const v = d.view.getBoundingClientRect(), edge = 40;
      const by = d.y < v.top + edge ? -(v.top + edge - d.y) / 3 : d.y > v.bottom - edge ? (d.y - v.bottom + edge) / 3 : 0;
      const was = d.view.scrollTop;
      if (by) d.view.scrollTop += Math.round(Math.max(-16, Math.min(16, by)));
      scrolled = d.view.scrollTop !== was;
    }
    const y = d.y - d.list.getBoundingClientRect().top;
    const first = d.lines[0], last = d.lines[d.lines.length - 1];
    const top = Math.max(first.top - 6, Math.min(last.bottom - d.cellH + 6, y - d.grab));
    d.cell.style.transform = `translateY(${Math.round(top - d.cellTop)}px)`;
    let to = 0;
    while (to < d.lines.length && (d.lines[to].top + d.lines[to].bottom) / 2 < y) to++;
    if (to !== d.to) { d.to = to; open(d, to); }
    if (scrolled) d.raf = requestAnimationFrame(frame);
  };
  const begin = (d: PlaceDrag) => {
    const lines = [...d.list.querySelectorAll<HTMLElement>(".st-line[data-place]")];
    const box = d.list.getBoundingClientRect(), c = d.cell.getBoundingClientRect();
    d.on = true;
    d.lines = lines.map((el) => { const r = el.getBoundingClientRect(); return { top: r.top - box.top, bottom: r.bottom - box.top }; });
    d.cells = lines.map((el) => el.querySelector<HTMLElement>(".st-new")!);
    d.from = d.to = lines.indexOf(d.line);
    const next = d.lines[d.from + 1] ?? d.lines[d.from - 1];
    d.step = next ? Math.abs(next.top - d.lines[d.from].top) : c.height;
    [d.cellTop, d.cellH, d.grab] = [c.top - box.top, c.height, d.y0 - c.top];
    d.view = d.list.closest<HTMLElement>(".st-body");
    d.list.setPointerCapture(d.id);
    d.list.classList.add("dragging");
    d.cell.classList.add("lifting");
    d.esc = (e) => { if (e.key === "Escape") { e.preventDefault(); finish(false); } };
    window.addEventListener("keydown", d.esc, true);
  };
  const finish = (drop: boolean) => {
    const d = drag.current;
    drag.current = null;
    if (!d?.on) return;
    cancelAnimationFrame(d.raf);
    if (d.esc) window.removeEventListener("keydown", d.esc, true);
    if (d.list.hasPointerCapture(d.id)) d.list.releasePointerCapture(d.id);
    swallow.current = true;
    setTimeout(() => { swallow.current = false; });
    if (!drop || d.to === d.from || d.to === d.from + 1) { // the songs slide back
      home(d.cells);
      setTimeout(() => { if (!drag.current?.on) d.list.classList.remove("dragging"); }, motionMs(160));
      return;
    }
    // the song glides into the gap and waits there for the new order (or for nothing: the edit failed)
    settle();
    const land = d.to > d.from ? d.to - 1 : d.to;
    d.cell.classList.remove("lifting");
    d.cell.style.transform = `translateY(${Math.round(d.lines[land].top - d.lines[d.from].top)}px)`;
    const waiting = { list: d.list, cells: d.cells };
    dropped.current = waiting;
    setTimeout(() => { if (dropped.current === waiting) settle(); }, 2000);
    moveNow.current(d.from, land);
  };
  return {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0 || drag.current) return;
      const t = e.target as HTMLElement;
      const cell = t.closest<HTMLElement>(".st-new"), line = cell?.closest<HTMLElement>(".st-line.assigned[data-place]");
      if (!cell || !line || t.closest("button, input, a, select")) return;
      drag.current = { id: e.pointerId, y0: e.clientY, y: e.clientY, on: false, raf: 0, list: e.currentTarget, line, cell, view: null,
        lines: [], cells: [], from: 0, to: 0, cellTop: 0, cellH: 0, grab: 0, step: 0 };
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      const d = drag.current;
      if (!d || e.pointerId !== d.id) return;
      d.y = e.clientY;
      if (!d.on) { if (Math.abs(d.y - d.y0) < 5) return; begin(d); }
      if (!d.raf) d.raf = requestAnimationFrame(frame);
    },
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => { if (drag.current?.id === e.pointerId) finish(true); },
    onPointerCancel: () => finish(false),
    onLostPointerCapture: () => finish(false),
    onClickCapture: (e: React.MouseEvent) => { if (swallow.current) { swallow.current = false; e.stopPropagation(); } },
  };
}

/** Playlist: a line per place for a song, in play order. A place takes a song with a click or a drop (several fill
    the places after it too), plays it, moves it up or down (the arrows, Alt+↑ ↓, or a drag), or empties it. Add
    songs fills the empty places. */
const PlaylistBody = memo(function PlaylistBody({ map, piece, places, cueId, current, put, onSet, fight, ...pick }: Pickable & {
  map: PlaylistMap; piece: Piece; places: Place[]; cueId: string; current: () => PlaceSet;
  put: (k: number, files: string[]) => void; onSet: (p: Piece | null, label: string) => void; fight: boolean;
}) {
  const { actions, notify } = useEditor();
  // a song dragged from one place to another: the songs between move one place along (places without a slot stay)
  const handlers = usePlaceDrag(places, (from, to) => {
    const able = places.flatMap((x, k) => (x.source ? [k] : []));
    const now = current(), songs = able.map((k) => now[k]);
    songs.splice(to, 0, ...songs.splice(from, 1));
    able.forEach((k, i) => { now[k] = songs[i]; });
    actions.playlistSet(cueId, now);
    pick.onPick(places[able[to]].source!);
  });
  useCommands({ moveUp: () => moveSelected(-1), moveDown: () => moveSelected(1) }, 1);
  const used = places.filter((x) => x.a).length, total = places.length;
  const choose = async (k: number) => { const f = await pickAudio(true); if (f?.length) put(k, f); };
  const add = async () => {
    const files = await pickAudio(true);
    if (!files?.length) return;
    const next = current(), free = next.flatMap((x, k) => (x ? [] : [k]));
    const fit = byName(files).slice(0, free.length);
    fit.forEach((f, i) => { next[free[i]] = { file: f }; });
    const songs = fit.length, over = files.length - fit.length;
    actions.playlistSet(cueId, next, plural(songs, { one: "# song added", other: "# songs added" }));
    if (over > 0) notify("info", t`${plural(over, { one: "# song left over", other: "# songs left over" })}. This music has ${plural(total, { one: "# place", other: "# places" })}.`);
  };
  const move = (k: number, d: -1 | 1) => {
    const next = current();
    [next[k], next[k + d]] = [next[k + d], next[k]];
    actions.playlistSet(cueId, next);
    const to = places[k + d]?.source;
    if (to) pick.onPick(to);
  };
  /** Alt+↑ ↓ on the selected song, while the Soundtrack shows. */
  const moveSelected = (d: -1 | 1) => {
    const k = places.findIndex((x) => x.source === pick.marks.get().sel);
    if (nav.get().tab !== "soundtrack" || k < 0 || !places[k].a || !places[k + d]?.source) return false;
    move(k, d);
  };
  const remove = async (k: number) => {
    const x = places[k], undo = keyLabel("undo");
    if (!x.a || !(await confirm({
      title: t`Remove ${ph({ name: x.a.name })} from the playlist?`, ok: t`Remove`, cancel: t`Keep`,
      text: undo ? t`The file stays on disk. Undo (${undo}) brings it back.` : t`The file stays on disk.`,
    }))) return;
    const next = current();
    next[k] = null;
    actions.playlistSet(cueId, next);
  };
  return (
    <div className="st-song">
      <div className="st-row-btns">
        <button className={`btn small-btn${used ? "" : " primary"}`} onClick={add} disabled={used === places.length}><Trans>Add Songs</Trans></button>
        <label className="check" data-tip={t`A random order, and no song plays twice before the others have played`}>
          <input type="checkbox" checked={!!piece.shuffle} disabled={!used}
            onChange={(e) => onSet({ ...piece, shuffle: e.target.checked }, "shuffle")} /> {t`Shuffle`}</label>
        <label className="check" data-tip={fight ? t`Each fight starts on the song after the one the last fight stopped on`
          : t`Each time the music comes on, it starts on the song after the one that played last`}>
          <input type="checkbox" checked={!!piece.resume} disabled={!used}
            onChange={(e) => onSet({ ...piece, resume: e.target.checked }, "resume")} /> {fight ? t`Continue in the next fight` : t`Continue next time`}</label>
        <span className="muted small">{t`${used} of ${plural(total, { one: "# place", other: "# places" })}`}</span>
        <Help tip={t`Places, the order and the options`} page="soundtrack#playlist" />
      </div>
      {openings(map) && (
        <p className="st-note">{fight ? t`Each fight starts on one of the openings, then plays the songs.`
          : t`Each time the music comes on, one of the openings plays first, then the songs.`} <OpeningsHelp /></p>
      )}
      <div className="st-lines reorder" role="listbox" aria-label={t`Songs`} {...handlers}>
        {places.map((x, k) => (
          <SegLine key={x.seg} n={k + 1} seg={x.seg} map={map} source={x.source} a={x.a} {...pick} place={x.source ? k : undefined}
            drop={x.source ? JSON.stringify({ kind: "place", cue: cueId, index: k }) : undefined}>
            {x.source && x.a ? (
              <NewAudio source={x.source} a={x.a} name={x.a.name} at={pick.at(x.source)} onPick={() => pick.onPick(x.source!)}>
                <span className="st-tools">
                  <button className="x" aria-label={t`Move up`} data-tip={t`Move up`} disabled={k === 0} onClick={(e) => { e.stopPropagation(); move(k, -1); }}>↑</button>
                  <button className="x" aria-label={t`Move down`} data-tip={t`Move down`} disabled={k === places.length - 1} onClick={(e) => { e.stopPropagation(); move(k, 1); }}>↓</button>
                  <button className="x" aria-label={t`Remove the song`} data-tip={t`Remove the song`} onClick={(e) => { e.stopPropagation(); remove(k); }}>✕</button>
                </span>
              </NewAudio>
            ) : x.source ? (
              <button className="drop-hint" onClick={(e) => { e.stopPropagation(); pick.onPick(x.source!); choose(k); }}>{t`Drop a Song or Choose a File`}</button>
            ) : <span className="st-none" data-tip={t`No song can go here`} data-tip-more={t`This segment holds no audio that can be replaced. Places without a song don't play`}>{t`No slot for audio`}</span>}
          </SegLine>
        ))}
      </div>
    </div>
  );
});

const LENGTHS = [[60_000, "1 min"], [150_000, "2½ min"], [300_000, "5 min"]] as const;

/** The fight player, in the bar above the segments: a fight as the game plays it, from where the music starts, for a
    minute or more, and the next one going on from where that one stopped. Original is the game's music, Replaced
    the project's order and audio. While one plays, a bar shows where it is (a click moves there), and the segment
    it is at goes to `onNow`. */
function FightBar({ map, item, run, setRun, onNow }: {
  map: PlaylistMap; item: MusicItem; run: FightRun | null; setRun: (r: FightRun | null) => void; onNow: (m: Mark | null) => void;
}) {
  const { project, notify } = useEditor();
  const p = usePlayer();
  const [ms, setMs] = useState<number>(150_000);
  const [busy, setBusy] = useState<"game" | "mine" | null>(null);
  const states = useRef<Record<string, { state: unknown; n: number }>>({});
  const fight = inFights(item);
  // another part starts over, and so do the project's fights when the piece changes (its order may be another one)
  useEffect(() => { states.current = {}; }, [map.cue]);
  const mine = JSON.stringify(project?.soundtrack[map.cue] ?? null);
  const kept = useRef(mine);
  useEffect(() => {
    if (kept.current === mine) return;
    kept.current = mine;
    delete states.current.mine;
    if (run?.side === "mine") { if (player.state.key === run.key) player.stop(); setRun(null); }
  }, [mine]); // eslint-disable-line react-hooks/exhaustive-deps

  const play = async (side: "game" | "mine", next: boolean) => {
    const from = next && states.current[side] ? states.current[side] : { state: {}, n: 0 };
    setBusy(side);
    try {
      const r = await call<{ path: string; duration_ms: number; marks: Mark[]; random: boolean; state: unknown }>(
        "play_through", { cue: map.cue, side, fight: { ms, state: from.state } });
      states.current[side] = { state: r.state, n: from.n + 1 };
      const key = `fight:${map.cue}:${side}:${from.n + 1}`;
      const url = `${fileUrl(r.path)}&v=${Date.now()}`;
      setRun({ key, side, url, duration_ms: r.duration_ms, marks: r.marks, random: r.random, n: from.n + 1 });
      player.stop();
      const full = item.full, n = from.n + 1;
      const label = fight ? side === "game" ? t`${full} · fight ${n} · original` : t`${full} · fight ${n} · replaced`
        : side === "game" ? t({ message: `${full} · play ${n} · original`, comment: "A play: one numbered run of music that isn't for fights" })
        : t({ message: `${full} · play ${n} · replaced`, comment: "A play: one numbered run of music that isn't for fights" });
      player.play(key, url, false, label, { scope: "soundtrack", itemId: item.id, cueId: map.cue, source: null });
    } catch (e: any) { notify("bad", e.message ?? String(e)); }
    setBusy(null);
  };
  const active = run && p.key === run.key ? run : null;
  const pos = active ? p.time * 1000 : 0;
  let now: Mark | null = null;
  for (const m of active?.marks ?? []) if (m.ms <= pos + 1) now = m;
  useEffect(() => { onNow(now); }, [now, onNow]);

  const button = (side: "game" | "mine") => {
    const on = active?.side === side && p.playing;
    const name = fight ? side === "game" ? t`Play a fight · Original` : t`Play a fight · Replaced`
      : side === "game" ? t`Play · Original` : t`Play · Replaced`;
    return (
      <button className={`play ${side === "game" ? "vanilla" : "project"} through-btn${on ? " playing" : ""}`} disabled={busy !== null || (side === "mine" && !project)}
        aria-label={on ? t`Pause` : name} data-tip={on ? t`Pause` : name}
        data-tip-more={side === "game" ? t`The original order and audio` : t`The project's order and audio`}
        onClick={() => (active?.side === side ? player.toggle() : play(side, false))}
        style={{ ["--progress" as any]: active?.side === side ? pos / active.duration_ms : 0 }}>
        {busy === side ? <span aria-hidden>…</span> : on ? <PauseIcon /> : <ThroughIcon />}
      </button>
    );
  };
  return (
    <>
      <div className="through-btns" role="group" aria-label={fight ? t`Fights` : t`Play`}>{button("game")}{button("mine")}</div>
      <label className="st-length" data-tip={fight ? t`How long the fight lasts` : t`How long the music plays`}
        data-tip-more={fight ? t`It ends with the segment playing at that time, and Next Fight goes on from there`
          : t`It ends with the segment playing at that time, and Play Again goes on from there`}>
        {fight ? t`Fight length` : t`Plays for`}
        <select value={ms} onChange={(e) => setMs(Number(e.target.value))}>
          {LENGTHS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <button className="btn small-btn" disabled={!run || busy !== null} onClick={() => run && play(run.side, true)}
        data-tip={t`Goes on from where the last one stopped`}>{fight ? t`Next Fight` : t`Play Again`}</button>
      {active && (
        <div className="through">
          <div className={`through-bar ${active.side}`} role="slider" aria-label={t`Position`} aria-valuemin={0}
            aria-valuemax={Math.round(active.duration_ms / 1000)} aria-valuenow={Math.round(pos / 1000)} tabIndex={0}
            onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); player.seek((e.clientX - r.left) / r.width); }}
            onKeyDown={(e) => {
              const d = e.key === "ArrowRight" ? 5000 : e.key === "ArrowLeft" ? -5000 : 0;
              if (d) { e.preventDefault(); e.stopPropagation(); player.seek(Math.max(0, Math.min(1, (pos + d) / active.duration_ms))); }
            }}>
            <div className="through-fill" style={{ width: `${(pos / active.duration_ms) * 100}%` }} />
            {active.marks.map((m, i) => <span key={i} className="through-tick" style={{ left: `${(m.ms / active.duration_ms) * 100}%` }} />)}
          </div>
          <span className="through-now"><b>{now?.name ?? t`Lead-in`}</b> {fmtTime(pos)} / {fmtTime(active.duration_ms)}</span>
        </div>
      )}
    </>
  );
}

/** The segments of the last fight in the order they played, the one playing lit. */
function Transcript({ run, now, fight }: { run: FightRun; now: Mark | null; fight: boolean }) {
  const at = now ? run.marks.indexOf(now) : -1;
  const n = run.n;
  const name = fight ? run.side === "game" ? t`Fight ${n}, Original` : t`Fight ${n}, Replaced`
    : run.side === "game" ? t({ message: `Play ${n}, Original`, comment: "A play: one numbered run of music that isn't for fights" })
    : t({ message: `Play ${n}, Replaced`, comment: "A play: one numbered run of music that isn't for fights" });
  return (
    <div className="st-transcript" aria-label={name}>
      <span className="muted small" data-tip={fight ? t`The segments of this fight, in the order they played` : t`The segments that played, in order`}>{name}</span>
      {run.marks.map((m, i) => <span key={i} className={`st-mark${i === at ? " now" : ""}`}>{m.name}</span>)}
    </div>
  );
}
