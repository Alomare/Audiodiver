import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { call, fileUrl, fmtTime, plural, type Assignment, type Cue, type MusicItem, type Piece, type PlaylistMap, type PlayNode } from "./api";
import { confirm } from "./Confirm";
import { useContextMenu, type MenuEntry } from "./ContextMenu";
import { audible, PlayButton, playSlot } from "./CueView";
import { AudioIcon, CollapseAllIcon, PauseIcon, ThroughIcon } from "./Icons";
import { ResetLevel } from "./Inspector";
import { keyLabel, useCommands, useKeymap } from "./keys";
import { nav } from "./nav";
import { tabArrows } from "./Page";
import { fullPath, pickAudio } from "./platform";
import { player, usePlayer, type PlayedAt } from "./player";
import type { Mark, Through } from "./PlayThrough";
import { ResizeEdge, Splitter, useStoredHeight, useStoredWidth } from "./Resize";
import { SliceTool } from "./SliceTool";
import { useEditor, useShownTabs } from "./store";
import { motionMs, scrollBehavior } from "./theme";
import { Timeline } from "./Timeline";
import { PanelToggles, usePanels } from "./Tools";
import { Help } from "./Wiki";

type Mode = Piece["mode"];
const MODES: { mode: Mode; name: string; tip: string }[] = [
  { mode: "original", name: "Original", tip: "The segments in their original order. Untick one to leave it out" },
  { mode: "song", name: "One song", tip: "One song cut into the segments, played from the beginning each time the music starts" },
  { mode: "tracks", name: "Playlist", tip: "Whole songs, one after another or shuffled" },
  { mode: "silent", name: "Silent", tip: "Nothing plays" },
  { mode: "same", name: "Same as Battle", tip: "The battle music plays on here, from where it is" },
];
const NAME = Object.fromEntries(MODES.map((m) => [m.mode, m.name])) as Record<Mode, string>;
/** What each kind of group does with its children (core soundtrack.py, music.RS_TYPES). */
const KIND = [
  { name: "In order", tip: "Plays these one after another" },
  { name: "Next each time", tip: "Plays one of these each time, the next in order, going on from where the music last stopped" },
  { name: "Shuffled", tip: "Plays all of these in a random order" },
  { name: "One at random", tip: "Plays one of these, picked at random" },
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
const pieceOf = (soundtrack: Record<string, Piece> | undefined, cue: string): Piece => soundtrack?.[cue] ?? { mode: "original" };
/** The battle music an intense piece can follow: the Battle of its section. */
function partnerOf(sections: Sections, it: MusicItem): string | null {
  if (it.role !== "intense") return null;
  const battle = sections.find((g) => g.items.includes(it))?.items.find((x) => x.role === "battle");
  return battle ? playlists(battle)[0]?.cue ?? null : null;
}
/** Combat music plays in fights; the rest plays each time the moment comes. */
const inFights = (it: MusicItem) => it.role === "battle" || it.role === "intense";
const fmtDb = (db: number) => (db ? `${db > 0 ? "+" : "−"}${Math.abs(db).toFixed(Math.abs(db) % 1 ? 1 : 0)} dB` : "0 dB");
const fileName = (path: string) => path.split(/[\\/]/).pop() ?? path;
const byName = (files: string[]) => [...files].sort((a, b) => fileName(a).localeCompare(fileName(b), undefined, { numeric: true }));

type Pick = { item: string; part: number };
const PICK_KEY = "audiodiver.soundtrack";
const LIST_WIDTH = 330; // the music list's width to start with (px at the default text size)
const OPEN = "audiodiver:soundtrack-open";
const DROP = "audiodiver:soundtrack-drop";

/** Shows a piece of music in the Soundtrack, at its part `cue`. */
export function openInSoundtrack(item: MusicItem, cue: string) {
  const pick: Pick = { item: item.id, part: Math.max(0, playlists(item).findIndex((p) => p.cue === cue)) };
  try { localStorage.setItem(PICK_KEY, JSON.stringify(pick)); } catch { /* storage off */ }
  window.dispatchEvent(new CustomEvent<Pick>(OPEN, { detail: pick }));
  nav.go("soundtrack");
}

/** What a drop on the Soundtrack hit: a place of a playlist, or One song (App.tsx routes drops here). */
export type SoundtrackTarget = { kind: "place"; cue: string; index: number } | { kind: "song"; cue: string };
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
      <aside className="library" aria-label="Music">
        {project ? <MusicList sections={sections} pick={pick} setPick={setPick} /> : (
          <div className="lib-empty">
            <h2>No project open</h2>
            <p>Open or create a project to set how the music plays.</p>
            <div className="row-btns">
              <button className="btn primary" onClick={actions.newProject}>New project…</button>
              <button className="btn" onClick={() => actions.openProject()}>Open project…</button>
            </div>
          </div>
        )}
      </aside>
      <Splitter width={width} onResize={setWidth} initial={LIST_WIDTH} panel="left" label="Resize the list" />
      <main className="center">
        {project && item && count ? (
          <PieceView key={item.id} item={item} part={Math.min(pick!.part, count - 1)} sections={sections}
            setPart={(part) => setPick({ item: item.id, part })} open={(id) => setPick({ item: id, part: 0 })} />
        ) : (
          <div className="st-empty center-note"><p>{project ? "Choose music on the left." : ""}</p></div>
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
    Object.keys(set).length ? actions.soundtrackSet(set, label, done) : quick("No music needed a change", "info");
  const templates: MenuEntry[] = [
    {
      label: "Battle songs: every Intense Battle set to Same as Battle", run: () => {
        const set: Record<string, Piece> = {};
        for (const g of combat) for (const it of g.items) {
          const follows = partnerOf(sections, it);
          if (follows) for (const p of playlists(it)) set[p.cue] = { mode: "same", follows, ...gainOf(st, p.cue) };
        }
        apply(set, "Battle songs", `Intense Battle follows Battle for ${plural(combat.length, "enemy", "enemies")}`);
      },
    },
    {
      label: "Quiet exploring: every Exploring set to Silent", run: () => {
        const set: Record<string, Piece> = {};
        for (const g of combat) for (const it of g.items) {
          if (it.role === "exploring") for (const p of playlists(it)) set[p.cue] = { mode: "silent", ...gainOf(st, p.cue) };
        }
        apply(set, "Quiet exploring", "Exploring set to Silent");
      },
    },
    {
      label: "No openings: fights start on the music itself", run: async () => {
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
        apply(set, "No openings", `Fights start on the music itself in ${plural(Object.keys(set).length, "piece")}`);
      },
    },
    "-",
    {
      label: "Original: all music back to Original", disabled: !Object.keys(st).length, run: () => {
        actions.soundtrackSet(Object.fromEntries(Object.keys(st).map((cue) => [cue, null])), "Original soundtrack", "All music set back to Original");
      },
    },
  ];

  const modesOf = (it: MusicItem) => [...new Set(playlists(it).map((p) => pieceOf(st, p.cue).mode))];
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = words.length ? sections.map((g) => ({ ...g, items: g.items.filter((it) => {
    const modes = modesOf(it), hay = `${g.section.name} ${it.name} ${it.full} ${modes.length === 1 ? NAME[modes[0]] : "Mixed"}`.toLowerCase();
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
        <h2>Music</h2>
        <button className="btn quiet small-btn" onClick={(e) => openMenu(e, templates)} data-tip="Set much music at once">Templates</button>
        <Help tip="What each template does. Undo takes back a whole template" page="soundtrack#music" />
      </div>
      <div className="lib-search">
        <input type="search" placeholder={`Search the music${searchKey ? `  ( ${searchKey} )` : ""}`} value={query}
          onChange={(e) => setQuery(e.target.value)} aria-label="Search the music" onKeyDown={searchKeys} />
        <button className="icon-btn" onClick={() => setShut(Object.fromEntries(sections.map((g) => [g.section.id, true])))}
          aria-label="Collapse all" data-tip="Collapse all"><CollapseAllIcon /></button>
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
                    {gains.length === 1 && gains[0] ? <span className="st-gain" data-tip="Level of the whole piece">{fmtDb(gains[0])}</span> : null}
                    <span className={`st-mode ${modes.length === 1 ? modes[0] : "mixed"}`}
                      data-tip={modes.length === 1 ? undefined : "The parts of this music play in different ways"}>{modes.length === 1 ? NAME[modes[0]] : "Mixed"}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
        {!shown.length && <p className="empty-note">Nothing matches “{query}”.</p>}
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
  const [sel, setSel] = useState<string | null>(null);  // the slot selected: a segment's first, or a layer's
  const [run, setRun] = useState<FightRun | null>(null);
  const [now, setNow] = useState<Mark | null>(null);    // the segment a fight is at
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
  const partner = partnerOf(sections, item);
  const fight = inFights(item);
  const set = (next: Piece | null, label: string, done?: string) => actions.soundtrackSet({ [cueId]: next }, label, done);
  const gain = piece.gain_db ?? 0;
  const keep = (p: Piece): Piece => (gain ? { ...p, gain_db: gain } : p);
  const firsts = useMemo(() => (cue ? firstSlots(cue) : new Map<string, string>()), [cue]);
  const lengths = useMemo(() => (cue ? originalLengths(cue) : new Map<string, number>()), [cue]);
  const at = (source: string | null): PlayedAt => ({ scope: "editor", itemId: item.id, cueId, source });

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
      : await set(keep({ mode }), NAME[mode]);
    if (ok && left.length) {
      notify("info", `The ${piece.mode === "song" ? "song pieces stay" : "songs stay"} as new audio in ${plural(piece.segments?.length ?? 0, "segment")}${mode === "original" ? ", in the original order" : ""}.`,
        { label: "Remove", run: () => actions.unassign(left) });
    }
  };
  // a segment leaves (or comes back) wherever the piece plays it
  const toggle = (it: string) => {
    if (!map) return;
    const all = leaves(map.tree);
    const seg = all.find((l) => l.item === it)?.segment;
    const same = all.filter((l) => l.segment === seg).map((l) => l.item);
    const out = new Set(piece.left_out ?? []);
    const leaving = !same.some((i) => out.has(i));
    for (const i of same) if (leaving) out.add(i); else out.delete(i);
    set(out.size || gain ? keep({ mode: "original", left_out: [...out] }) : null, leaving ? "leave out" : "put back");
  };
  const songTarget = map && cue ? {
    cue, segments: map.song, fill: (file: string, bounds: number[]) => actions.songFill(cueId, file, bounds, map.song),
  } : undefined;
  const plays = piece.mode !== "silent" && piece.mode !== "same";

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
    actions.playlistSet(cueId, next, fit.length > 1 ? `${plural(fit.length, "song")} from place ${k + 1}` : undefined);
    if (files.length > fit.length) notify("info", `${plural(files.length - fit.length, "song")} left over. This music has ${plural(places.length, "place")}.`);
  };
  // a drop on One song or on a place (App.tsx hands it over)
  const latest = useRef({ put, cueId });
  latest.current = { put, cueId };
  useEffect(() => {
    const take = (e: Event) => {
      const { target, files } = (e as CustomEvent<{ target: SoundtrackTarget; files: string[] }>).detail;
      if (target.cue !== latest.current.cueId) return;
      if (target.kind === "place") latest.current.put(target.index, files);
      else setSlicing({ file: files[0] });
    };
    window.addEventListener(DROP, take);
    return () => window.removeEventListener(DROP, take);
  }, []);

  // what the keys go through, top to bottom: the places of a playlist, the pieces of a song, else the play order
  const order = useMemo(() => {
    if (!map) return [];
    const segs = piece.mode === "tracks" ? map.song : piece.mode === "song" ? piece.segments ?? []
      : leaves(piece.mode === "original" ? map.tree : map.mine ?? map.tree).map((l) => l.segment!);
    return [...new Set(segs.map((s) => firsts.get(s)).filter((s): s is string => !!s))];
  }, [map, piece, firsts]);
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
    const seg = [...firsts].find(([, s]) => s === source)?.[0];
    return `${item.full} · ${seg && map ? segName(map, seg) : "segment"}`;
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
    openMenu(e, [
      { label: `Every other ${item.name} (${others.length})`, run: () => actions.soundtrackCopy(cueId, to(others), `every other ${item.name}`) },
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
                  data-tip="The slots of this music in Audio"><AudioIcon />Slots</button>
              )}
            </div>
            {parts.length > 1 && (
              <div className="parts" role="tablist" aria-label="Parts" onKeyDown={tabArrows}>
                {parts.map((p, i) => (
                  <button key={p.cue} role="tab" aria-selected={i === part} className={`part-tab${i === part ? " on" : ""}`} onClick={() => setPart(i)}>
                    <span>{p.name || `Part ${i + 1}`}</span>
                    <span className="part-len">{NAME[pieceOf(project?.soundtrack, p.cue).mode]}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="st-controls">
              <div className="segmented st-modes" role="radiogroup" aria-label="How it plays">
                {MODES.filter((m) => m.mode !== "same" || partner).map((m) => (
                  <button key={m.mode} role="radio" aria-checked={piece.mode === m.mode} className={piece.mode === m.mode ? "on" : ""}
                    data-tip={m.tip} onClick={() => choose(m.mode)}>{m.name}</button>
                ))}
              </div>
              <Help tip="What each mode does" page="soundtrack#modes" />
              <Level db={gain} onSet={(db) => set(db || piece.mode !== "original" || piece.left_out?.length ? { ...piece, gain_db: db } : null, "level")}
                off={piece.mode === "silent" ? "Nothing of this music plays while it is Silent"
                  : piece.mode === "same" ? "The Battle music plays here, at the Battle level" : undefined} />
              {piece.mode !== "original" && others.length > 0 && (
                <button className="btn quiet small-btn" onClick={copyTo} data-tip={`Sets other ${item.name} music to ${NAME[piece.mode]} too`}
                  data-tip-more={piece.mode === "song" ? "With the song and the level" : piece.mode === "tracks" ? "With the songs, Shuffle, Continue and the level" : "With the level"}>Copy to…</button>
              )}
            </div>
          </header>
          <ResizeEdge edge="bottom" label="Resize the header" min={56} max={() => room("top")}
            onResize={setHeadH} onReset={() => setHeadH(null)} />
        </div>
      )}
      <div className="cue-bar">
        {map && plays && <FightBar map={map} item={item} run={run} setRun={setRun} onNow={setNow} />}
        <PanelToggles panels={panels} set={setPanels} waves={!!cue && !!sel} />
      </div>
      {failed ? <p className="slots-note">{failed}</p> : !map || !cue ? <p className="slots-note">Reading the music…</p> : (
        <div className="st-body" ref={body}>
          {run && <Transcript run={run} now={now} fight={fight} />}
          {piece.mode === "song" && <SongBody map={map} cue={cue} piece={piece} firsts={firsts} lengths={lengths} sel={sel} onPick={setSel} at={at} now={now?.segment ?? null}
            fight={fight} onChoose={() => setSlicing({})} onRecut={() => setSlicing({ file: project && piece.song ? fullPath(project.folder, piece.song) : undefined })} />}
          {piece.mode === "tracks" && <PlaylistBody map={map} piece={piece} places={places} cueId={cueId} lengths={lengths} sel={sel} onPick={setSel} at={at}
            now={now?.segment ?? null} current={current} put={put} onSet={set} fight={fight} />}
          {piece.mode === "silent" && <p className="st-note">Nothing plays while the game would play this music.</p>}
          {piece.mode === "same" && partner && (
            <p className="st-note">The{" "}<button className="link-text" onClick={() => open(itemIndex.byCue.get(partner)?.item.id ?? item.id)}>Battle</button>{" "}
              music plays on here, from where it is.</p>
          )}
          {piece.mode === "original" && <Layers cue={cue} sel={sel} onPick={setSel} at={at} lengths={lengths} />}
          {plays && (
            <div className="st-order">
              <h2>Play order{piece.mode === "original" ? "" : " in the project"} <Help tip="How the game picks the next segment" page="soundtrack#play-order" /></h2>
              {piece.mode === "original"
                ? <PlayOrder map={map} tree={map.tree} firsts={firsts} lengths={lengths} leftOut={new Set(piece.left_out ?? [])} onToggle={toggle} now={now?.segment ?? null} sel={sel} onPick={setSel} at={at} fight={fight} />
                : <PlayOrder map={map} tree={map.mine ?? map.tree} firsts={firsts} lengths={lengths} now={now?.segment ?? null} sel={sel} onPick={setSel} at={at} fight={fight} />}
            </div>
          )}
        </div>
      )}
      {panels.waves && cue && <Timeline room={() => room("wave")} through={run} at={sel ? at(sel) : null} cue={cue} source={sel} />}
      {slicing && songTarget && <SliceTool target={songTarget} file={slicing.file} onClose={() => setSlicing(null)} />}
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
    <div className={`st-level${off ? " off" : ""}`} data-tip={off ?? "The level of the whole piece, on top of each slot's Make-Up Gain"}>
      <span>Level</span>
      <input type="range" min={-LEVEL_MAX} max={LEVEL_MAX} step={0.5} value={v} aria-label="Level in dB" disabled={!!off}
        onChange={(e) => setV(Number(e.target.value))} onPointerUp={() => commit(v)} onBlur={() => commit(v)}
        onKeyUp={(e) => { if (/^(Arrow|Home|End|Page)/.test(e.key)) commitSoon(v); }}
        onKeyDown={(e) => { if (e.ctrlKey || e.metaKey || e.altKey) commit(v); }} /* a nudge on its way goes first: then Ctrl+Z undoes it */ />
      <span className="st-db">
        <input className="gain-val" value={typed ?? fmtLevel(v)} aria-label="Level in dB, typed" inputMode="decimal" disabled={!!off}
          onFocus={(e) => { setTyped(fmtLevel(v)); e.currentTarget.select(); }} onChange={(e) => setTyped(e.target.value)} onBlur={takeTyped}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); else if (e.key === "Escape") { escaped.current = true; e.currentTarget.blur(); } }}
          data-tip={off ? undefined : `Type a value from −${LEVEL_MAX} to +${LEVEL_MAX}`} /> dB
      </span>
      <ResetLevel off={!!off || (db === 0 && v === 0)} onReset={() => { setV(0); commit(0); }} more="0 dB on every track of the piece" />
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
const OpeningsHelp = () => <Help tip="What the openings are, and how to change them" page="soundtrack#openings" />;

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

type Pickable = { sel: string | null; onPick: (source: string) => void; at: (source: string | null) => PlayedAt; now: string | null;
  lengths: Map<string, number> };

/** The play order: the playlist as groups of segments, each group saying what it does with them, and the item fights
    start on flagged. Each segment plays what the project plays there (▶) and selects with a click; with onToggle
    (Original) a tick leaves it in or out. */
function PlayOrder({ map, tree, firsts, leftOut, onToggle, now, sel, onPick, at, fight }: Pickable & {
  map: PlaylistMap; tree: PlayNode; firsts: Map<string, string>; leftOut?: Set<string>; onToggle?: (item: string) => void; fight: boolean;
}) {
  const { project } = useEditor();
  const node = (n: PlayNode, depth: number) => {
    const start = n.item === map.entry;
    if (n.segment !== undefined) {
      const out = leftOut?.has(n.item);
      const seg = map.segments[n.segment], name = segName(map, n.segment), source = firsts.get(n.segment);
      const a = source ? project?.assignments[source] : undefined;
      const repeat = n.loop === 1 ? "" : n.loop ? `, ${n.loop} times` : ", repeats";
      return (
        <div key={n.item} className={`po-seg${out ? " out" : ""}${now === n.segment ? " now" : ""}${start ? " start" : ""}${source && sel === source ? " sel" : ""}`}
          data-source={source} data-tip={`${name}, ${fmtTime(seg?.ms ?? 0)}${repeat}`} onClick={() => source && onPick(source)}>
          {onToggle && <input type="checkbox" checked={!out} onChange={() => onToggle(n.item)} onClick={(e) => e.stopPropagation()}
            aria-label={`Play ${name}`} data-tip={out ? "Put it back" : "Leave it out"} />}
          {source && <PlayButton kind={audible(a) ? "project" : "vanilla"} source={source} label={name} small at={at(source)} onPlay={() => onPick(source)} />}
          <span className="po-name">{name}</span>
        </div>
      );
    }
    const kind = KIND[n.rs ?? 0];
    return (
      <div key={n.item} className={`po-group k${n.rs ?? 0}${start ? " start" : ""}${depth ? "" : " root"}`}>
        <div className="po-head">
          <span className="po-kind" data-tip={kind.tip}>{kind.name}</span>
          {n.loop !== 1 && <span className="po-loop" data-tip={n.loop ? `Plays ${n.loop} times, then moves on` : "Plays again and again until the music changes"}>
            {n.loop ? `${n.loop} times` : "repeats"}</span>}
          {start && <span className="po-start" data-tip={fight ? "Where the music starts when a fight begins" : "Where the music starts each time it comes on"}>
            {fight ? "Fights start here" : "Starts here"}</span>}
        </div>
        <div className="po-kids">{(n.children ?? []).map((c) => node(c, depth + 1))}</div>
      </div>
    );
  };
  return <div className="po">{node(tree, 0)}</div>;
}

/** Music whose segments play several layers at once (the Extraction music): the segments as rows, and as columns
    the layers that play at each switch value (low and high intensity), the slot in each cell. Shown when some
    segment has more than one layer. A cell selects its slot. */
function Layers({ cue, sel, onPick, at }: Omit<Pickable, "now"> & { cue: Cue }) {
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
  const head = (c: string) => { const [v, n] = c.split("|"); return v ? `${v[0].toUpperCase()}${v.slice(1)}, layer ${n}` : `Layer ${n}`; };
  const whole = (c: string) => { const v = c.split("|")[0], f = full.get(v); return f && f !== v ? f : undefined; };
  return (
    <div className="st-order">
      <h2>Layers <Help tip="Layers that play at the same time. Replace them in the Audio tab" page="soundtrack#layers" /></h2>
      <div className="st-layers" role="table" style={{ gridTemplateColumns: `auto repeat(${cols.length}, minmax(0, 1fr))` }}>
        <span role="columnheader" />
        {cols.map((c) => <span key={c} role="columnheader" className="st-lh" data-tip={whole(c)}>{head(c)}</span>)}
        {rows.map((r) => (
          <div key={r.name} role="row" className="st-lrow">
            <span role="rowheader" className="st-lname">{r.name}</span>
            {cols.map((c) => {
              const cell = r.cells.get(c);
              if (!cell) return <span key={c} role="cell" />;
              const a = project?.assignments[cell.source];
              return (
                <span key={c} role="cell" className={`st-cell${a ? " mine" : ""}${sel === cell.source ? " sel" : ""}`} data-tip={cell.label || undefined}
                  data-source={cell.source} onClick={() => onPick(cell.source)}>
                  <PlayButton kind={audible(a) ? "project" : "vanilla"} source={cell.source} label={`${r.name}, ${head(c)}`} small at={at(cell.source)} onPlay={() => onPick(cell.source)} />
                  <span className="st-cname">{a ? (a.silence ? "Silence" : a.name) : "Original"}</span>
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/** A segment as a line, as a slot's in Audio: its original (▶, number, name, length) and what the project puts
    there, which `children` draw. A click selects it. */
function SegLine({ n, seg, map, source, a, sel, onPick, at, now, lengths, drop, place, children }: Pickable & {
  n: number; seg: string; map: PlaylistMap; source: string | null; a?: Assignment; drop?: string; place?: number; children: React.ReactNode;
}) {
  const name = segName(map, seg), ms = lengths.get(seg) ?? 0;
  return (
    <div className={`st-line${source && sel === source ? " selected" : ""}${now === seg ? " now" : ""}${a ? " assigned" : ""}`}
      data-source={source ?? undefined} data-drop={drop} data-place={place} onClick={() => source && onPick(source)} role="option" aria-selected={!!source && sel === source}>
      <div className="st-orig">
        {source ? <PlayButton kind="vanilla" source={source} label={`the original ${name}`} at={at(source)} onPlay={() => onPick(source)} /> : <span className="play-gap" />}
        <span className="st-n">{n}</span>
        <span className="st-sname" data-tip={name} data-tip-clip>{name}</span>
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
      <span className={`file${a.exists ? "" : " missing"}`} data-tip={a.audio} data-tip-clip>{a.exists ? a.name : `Missing: ${a.name}`}</span>
      {a.duration_ms != null && <span className="len">{fmtTime(a.duration_ms)}</span>}
      {children}
    </>
  );
}

/** One song: the song, the pieces in the segments they went into, and the ways to cut it again or choose another. A
    song dropped here opens the slice tool with it. */
function SongBody({ map, cue, piece, firsts, fight, onChoose, onRecut, ...pick }: Pickable & {
  map: PlaylistMap; cue: Cue; piece: Piece; firsts: Map<string, string>; fight: boolean; onChoose: () => void; onRecut: () => void;
}) {
  const { project } = useEditor();
  const segs = piece.segments ?? [];
  const opens = !!openings(map);
  const drop = JSON.stringify({ kind: "song", cue: cue.id });
  if (!segs.length) {
    return (
      <div className="st-empty st-drop" data-drop={drop}>
        <p>Choose a song to cut into up to {plural(map.song.length, "piece")}, or drop one here.</p>
        <button className="btn primary" onClick={onChoose}>Choose a song…</button>
      </div>
    );
  }
  return (
    <div className="st-song" data-drop={drop}>
      <div className="st-row-btns">
        {piece.song && <span className="st-songname" data-tip={piece.song}>{fileName(piece.song)}</span>}
        {piece.song && <button className="btn small-btn" onClick={onRecut}>Change the cuts…</button>}
        <button className="btn quiet small-btn" onClick={onChoose}>Choose another song…</button>
      </div>
      <p className="st-note">{fight
        ? opens ? "Each fight starts on one of the openings, then plays the song from piece 1." : "Each fight plays the song from piece 1."
        : opens ? "Each time the music comes on, one of the openings plays first, then the song from piece 1."
        : "The song plays from piece 1 each time the music comes on."}{opens && <> <OpeningsHelp /></>}</p>
      <div className="st-lines" role="listbox" aria-label="Pieces">
        {segs.map((seg, i) => {
          const source = firsts.get(seg) ?? null, a = source ? project?.assignments[source] : undefined;
          return (
            <SegLine key={seg} n={i + 1} seg={seg} map={map} source={source} a={a} {...pick}>
              {source && a && !a.silence ? <NewAudio source={source} a={a} name={`piece ${i + 1}`} at={pick.at(source)} onPick={() => pick.onPick(source)} />
                : <span className="st-none">No audio</span>}
            </SegLine>
          );
        })}
      </div>
    </div>
  );
}

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
function PlaylistBody({ map, piece, places, cueId, current, put, onSet, fight, ...pick }: Pickable & {
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
  const used = places.filter((x) => x.a).length;
  const choose = async (k: number) => { const f = await pickAudio(true); if (f?.length) put(k, f); };
  const add = async () => {
    const files = await pickAudio(true);
    if (!files?.length) return;
    const next = current(), free = next.flatMap((x, k) => (x ? [] : [k]));
    const fit = byName(files).slice(0, free.length);
    fit.forEach((f, i) => { next[free[i]] = { file: f }; });
    actions.playlistSet(cueId, next, `${plural(fit.length, "song")} added`);
    if (files.length > fit.length) notify("info", `${plural(files.length - fit.length, "song")} left over. This music has ${plural(places.length, "place")}.`);
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
    const k = places.findIndex((x) => x.source === pick.sel);
    if (nav.get().tab !== "soundtrack" || k < 0 || !places[k].a || !places[k + d]?.source) return false;
    move(k, d);
  };
  const remove = async (k: number) => {
    const x = places[k];
    if (!x.a || !(await confirm({
      title: `Remove ${x.a.name} from the playlist?`, ok: "Remove", cancel: "Keep",
      text: `The file stays on disk.${keyLabel("undo") ? ` Undo (${keyLabel("undo")}) brings it back.` : ""}`,
    }))) return;
    const next = current();
    next[k] = null;
    actions.playlistSet(cueId, next);
  };
  return (
    <div className="st-song">
      <div className="st-row-btns">
        <button className={`btn small-btn${used ? "" : " primary"}`} onClick={add} disabled={used === places.length}>Add songs…</button>
        <label className="check" data-tip="A random order, and no song plays twice before the others have played">
          <input type="checkbox" checked={!!piece.shuffle} disabled={!used}
            onChange={(e) => onSet({ ...piece, shuffle: e.target.checked }, "shuffle")} /> Shuffle</label>
        <label className="check" data-tip={fight ? "Each fight starts on the song after the one the last fight stopped on"
          : "Each time the music comes on, it starts on the song after the one that played last"}>
          <input type="checkbox" checked={!!piece.resume} disabled={!used}
            onChange={(e) => onSet({ ...piece, resume: e.target.checked }, "resume")} /> {fight ? "Continue in the next fight" : "Continue next time"}</label>
        <span className="muted small">{used} of {plural(places.length, "place")}</span>
        <Help tip="Places, the order and the options" page="soundtrack#playlist" />
      </div>
      {openings(map) && (
        <p className="st-note">{fight ? "Each fight starts on one of the openings, then plays the songs."
          : "Each time the music comes on, one of the openings plays first, then the songs."} <OpeningsHelp /></p>
      )}
      <div className="st-lines reorder" role="listbox" aria-label="Songs" {...handlers}>
        {places.map((x, k) => (
          <SegLine key={x.seg} n={k + 1} seg={x.seg} map={map} source={x.source} a={x.a} {...pick} place={x.source ? k : undefined}
            drop={x.source ? JSON.stringify({ kind: "place", cue: cueId, index: k }) : undefined}>
            {x.source && x.a ? (
              <NewAudio source={x.source} a={x.a} name={x.a.name} at={pick.at(x.source)} onPick={() => pick.onPick(x.source!)}>
                <span className="st-tools">
                  <button className="x" aria-label="Move up" data-tip="Move up" disabled={k === 0} onClick={(e) => { e.stopPropagation(); move(k, -1); }}>↑</button>
                  <button className="x" aria-label="Move down" data-tip="Move down" disabled={k === places.length - 1} onClick={(e) => { e.stopPropagation(); move(k, 1); }}>↓</button>
                  <button className="x" aria-label="Remove the song" data-tip="Remove the song" onClick={(e) => { e.stopPropagation(); remove(k); }}>✕</button>
                </span>
              </NewAudio>
            ) : x.source ? (
              <button className="drop-hint" onClick={(e) => { e.stopPropagation(); pick.onPick(x.source!); choose(k); }}>Drop a song or choose a file</button>
            ) : <span className="st-none" data-tip="No song can go here" data-tip-more="This segment holds no audio that can be replaced. Places without a song don't play">No slot for audio</span>}
          </SegLine>
        ))}
      </div>
    </div>
  );
}

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
      player.play(key, url, false, `${item.full} · ${fight ? "fight" : "play"} ${from.n + 1} · ${side === "game" ? "original" : "replaced"}`);
    } catch (e: any) { notify("bad", e.message ?? String(e)); }
    setBusy(null);
  };
  const active = run && p.key === run.key ? run : null;
  const t = active ? p.time * 1000 : 0;
  let now: Mark | null = null;
  for (const m of active?.marks ?? []) if (m.ms <= t + 1) now = m;
  useEffect(() => { onNow(now); }, [now, onNow]);

  const button = (side: "game" | "mine") => {
    const on = active?.side === side && p.playing;
    const name = `${fight ? "Play a fight" : "Play"} · ${side === "game" ? "Original" : "Replaced"}`;
    return (
      <button className={`play ${side === "game" ? "vanilla" : "project"} through-btn${on ? " playing" : ""}`} disabled={busy !== null || (side === "mine" && !project)}
        aria-label={on ? "Pause" : name} data-tip={on ? "Pause" : name}
        data-tip-more={side === "game" ? "The original order and audio" : "The project's order and audio"}
        onClick={() => (active?.side === side ? player.toggle() : play(side, false))}
        style={{ ["--progress" as any]: active?.side === side ? t / active.duration_ms : 0 }}>
        {busy === side ? <span aria-hidden>…</span> : on ? <PauseIcon /> : <ThroughIcon />}
      </button>
    );
  };
  return (
    <>
      <div className="through-btns" role="group" aria-label={fight ? "Fights" : "Play"}>{button("game")}{button("mine")}</div>
      <label className="st-length" data-tip={fight ? "How long the fight lasts" : "How long the music plays"}
        data-tip-more={`It ends with the segment playing at that time, and ${fight ? "Next fight" : "Play again"} goes on from there`}>
        {fight ? "Fight length" : "Plays for"}
        <select value={ms} onChange={(e) => setMs(Number(e.target.value))}>
          {LENGTHS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <button className="btn small-btn" disabled={!run || busy !== null} onClick={() => run && play(run.side, true)}
        data-tip="Goes on from where the last one stopped">{fight ? "Next fight" : "Play again"}</button>
      {active && (
        <div className="through">
          <div className={`through-bar ${active.side}`} role="slider" aria-label="Position" aria-valuemin={0}
            aria-valuemax={Math.round(active.duration_ms / 1000)} aria-valuenow={Math.round(t / 1000)} tabIndex={0}
            onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); player.seek((e.clientX - r.left) / r.width); }}
            onKeyDown={(e) => {
              const d = e.key === "ArrowRight" ? 5000 : e.key === "ArrowLeft" ? -5000 : 0;
              if (d) { e.preventDefault(); e.stopPropagation(); player.seek(Math.max(0, Math.min(1, (t + d) / active.duration_ms))); }
            }}>
            <div className="through-fill" style={{ width: `${(t / active.duration_ms) * 100}%` }} />
            {active.marks.map((m, i) => <span key={i} className="through-tick" style={{ left: `${(m.ms / active.duration_ms) * 100}%` }} />)}
          </div>
          <span className="through-now"><b>{now?.name ?? "Lead-in"}</b> {fmtTime(t)} / {fmtTime(active.duration_ms)}</span>
        </div>
      )}
    </>
  );
}

/** The segments of the last fight in the order they played, the one playing lit. */
function Transcript({ run, now, fight }: { run: FightRun; now: Mark | null; fight: boolean }) {
  const at = now ? run.marks.indexOf(now) : -1;
  const name = `${fight ? "Fight" : "Play"} ${run.n}, ${run.side === "game" ? "Original" : "Replaced"}`;
  return (
    <div className="st-transcript" aria-label={name}>
      <span className="muted small" data-tip={fight ? "The segments of this fight, in the order they played" : "The segments that played, in order"}>{name}</span>
      {run.marks.map((m, i) => <span key={i} className={`st-mark${i === at ? " now" : ""}`}>{m.name}</span>)}
    </div>
  );
}
