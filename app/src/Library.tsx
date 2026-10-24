import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { RESET_LAYOUT } from "./settings";
import { call, type ArchiveRow, type Place } from "./api";
import { useContextMenu, type MenuEntry } from "./ContextMenu";
import { PlayButton, playSlot } from "./CueView";
import { addedNote, exportList, itemEntries } from "./exportList";
import { Fold } from "./Fold";
import { IndexTree } from "./IndexTree";
import { keyLabel, useKeymap } from "./keys";
import { nav, useNav } from "./nav";
import { tabArrows } from "./Page";
import { copyText } from "./platform";
import { useEditor } from "./store";
import { CatMark } from "./Tags";
import { DEFAULT_SIZE, motionMs, scrollBehavior, useThemeValue } from "./theme";

/** The Library tab's left panel: the Index (what is known, sorted by where you hear it) or All Archives (everything
    the game has, named or not). Both stay as they were left when the other shows. */
export function LibraryPanel() {
  const { library: sub } = useNav();
  return (
    <aside className="library" aria-label="Library">
      <div className="lib-tabs" role="tablist" aria-label="Library" onKeyDown={tabArrows}>
        <button role="tab" aria-selected={sub === "index"} className={sub === "index" ? "on" : ""} onClick={() => nav.go("library", "index")}
          data-tip="Named music and sounds, by what they are">Index</button>
        <button role="tab" aria-selected={sub === "archives"} className={sub === "archives" ? "on" : ""} onClick={() => nav.go("library", "archives")}
          data-tip="Every archive with audio, named or not">All Archives</button>
      </div>
      <div className="lib-pane" hidden={sub !== "index"}><IndexTree /></div>
      <div className="lib-pane" hidden={sub !== "archives"}><ArchiveList /></div>
    </aside>
  );
}

type SortKey = "name" | "cat" | "archive" | "language" | "banks" | "sounds";
/** The table's columns: what each sorts by, its heading and what it says. */
const COLUMNS: [SortKey, string, string][] = [
  ["name", "Name", "Name in the Index"],
  ["cat", "Index", "Categories in the Index"],
  ["archive", "Archive", "Name in the game files"],
  ["language", "Language", "Voice pack language"],
  ["banks", "Banks", "Number of sound banks"],
  ["sounds", "Sounds", "Number of sounds"],
];
const SORT_KEY = "audiodiver.archiveSort";
/** The columns' widths at the default text size; each heading's right edge drags its column wider or narrower. */
const WIDTHS = { play: 30, name: 230, cat: 76, archive: 100, language: 68, banks: 52, sounds: 58, act: 30 };
type Col = keyof typeof WIDTHS;
const WIDTHS_KEY = "audiodiver.archiveColumnWidths"; // only the columns dragged: a new default reaches the rest
try { localStorage.removeItem("audiodiver.archiveColumns"); } catch { /* storage off */ } // every width, before

const NATURAL = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }); // "Track 2" before "Track 10"
const CHUNK = 8, OVERSCAN = 16; // rows: the drawn window moves in steps of CHUNK, with OVERSCAN more either side
/** Which rows of a long list to draw: those in view and a few either side. The rest are spacers of the same height,
    so the scrollbar is the list's own. A column drag or a panel resize then lays out a screenful of rows instead of
    hundreds, which keeps it smooth on slow PCs. The window only changes when the view has moved on by CHUNK rows. */
function useRowWindow(box: RefObject<HTMLElement | null>, count: number, rowH: number, head: number) {
  const [view, setView] = useState({ top: 0, height: 1000 });
  const dims = useRef({ rowH, head });
  dims.current = { rowH, head };
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let frame = 0;
    const read = () => { // the top in whole CHUNKs of rows: a scroll within one draws nothing new (OVERSCAN covers it)
      frame = 0;
      const { rowH: r, head: h } = dims.current;
      const top = Math.floor(Math.max(0, el.scrollTop - h) / (r * CHUNK)) * r * CHUNK + h;
      setView((v) => (v.top === top && v.height === el.clientHeight ? v : { top, height: el.clientHeight }));
    };
    const later = () => { if (!frame) frame = requestAnimationFrame(read); };
    read();
    el.addEventListener("scroll", later, { passive: true });
    const seen = new ResizeObserver(later);
    seen.observe(el);
    return () => { cancelAnimationFrame(frame); el.removeEventListener("scroll", later); seen.disconnect(); };
  }, [box]);
  const at = Math.floor(Math.max(0, view.top - head) / rowH), fits = Math.ceil(view.height / rowH);
  const first = Math.max(0, Math.floor(at / CHUNK) * CHUNK - OVERSCAN);
  const last = Math.min(count, Math.ceil((at + fits) / CHUNK) * CHUNK + OVERSCAN);
  return [first, Math.max(first, last)] as const;
}

/** Every archive of the game that has audio in it, as a table that sorts by any column (click a heading; again to
    turn it round). What the Index knows shows as its names and its categories' icons; an archive nobody has named
    goes by its name in the game's files. */
function ArchiveList() {
  const { archives, itemId, openItem, project, actions, scope, revision, goTo, itemIndex, quick, resolveItem } = useEditor();
  const [query, setQuery] = useState("");
  const [widths, setWidths] = useState<typeof WIDTHS>(() => {
    try { return { ...WIDTHS, ...JSON.parse(localStorage.getItem(WIDTHS_KEY) ?? "{}") }; } catch { return WIDTHS; }
  });
  useEffect(() => {
    const dragged = Object.fromEntries(Object.entries(widths).filter(([c, v]) => v !== WIDTHS[c as Col]));
    try {
      if (Object.keys(dragged).length) localStorage.setItem(WIDTHS_KEY, JSON.stringify(dragged));
      else localStorage.removeItem(WIDTHS_KEY);
    } catch { /* storage off */ }
  }, [widths]);
  useEffect(() => { // Settings ▸ Reset panel sizes
    const reset = () => setWidths(WIDTHS);
    window.addEventListener(RESET_LAYOUT, reset);
    return () => window.removeEventListener(RESET_LAYOUT, reset);
  }, []);
  const scale = useThemeValue((t) => t.size) / DEFAULT_SIZE; // columns are drawn at width x text scale
  const w = (c: Col) => `calc(${widths[c]}px * var(--fs))`;
  const table = useRef<HTMLTableElement>(null);
  const total = (v: typeof WIDTHS) => `calc(${Object.values(v).reduce((a, b) => a + b, 0)}px * var(--fs))`;
  /** The handle on a heading's right edge: drag to resize that column, double-click to reset it. While it drags,
      only the column and the table's width change, once a frame: re-rendering hundreds of rows on every move
      stutters. The width is kept when the drag ends. */
  const grip = (c: Col) => (
    <span className="col-grip" aria-hidden onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => {
        e.preventDefault(); e.stopPropagation();
        const el = e.currentTarget, x0 = e.clientX, w0 = widths[c];
        const col = table.current?.querySelector<HTMLElement>(`col[data-col="${c}"]`);
        let next = widths, frame = 0;
        el.setPointerCapture(e.pointerId);
        const move = (m: PointerEvent) => {
          next = { ...widths, [c]: Math.max(24, Math.round(w0 + (m.clientX - x0) / scale)) };
          if (frame) return;
          frame = requestAnimationFrame(() => {
            frame = 0;
            if (col) col.style.width = `calc(${next[c]}px * var(--fs))`;
            if (table.current) table.current.style.width = total(next);
          });
        };
        const up = () => {
          cancelAnimationFrame(frame);
          el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up);
          setWidths(next);
        };
        el.addEventListener("pointermove", move); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
      }}
      onDoubleClick={(e) => { e.stopPropagation(); setWidths((v) => ({ ...v, [c]: WIDTHS[c] })); }} />
  );
  const [found, setFound] = useState<Set<string> | null>(null); // the archives a pasted id is in
  const [menu, openMenu] = useContextMenu();
  const list = useRef<HTMLDivElement>(null);
  useKeymap();
  const q = query.trim().toLowerCase();
  const numeric = /^\d{5,20}$/.test(q);
  useEffect(() => {
    if (!numeric) { setFound(null); return; }
    let live = true;
    call<Place[]>("find", { query: q }).then((hits) => { if (live) setFound(new Set(hits.flatMap((h) => h.archives))); }).catch(() => live && setFound(new Set()));
    return () => { live = false; };
  }, [q, numeric]);
  const listed = useMemo(() => new Set(project?.library ?? []), [project?.library]);
  // the order: the core's (named first) until a heading is clicked; remembered for next time
  const [sort, setSort] = useState<{ key: SortKey | null; up: boolean }>(() => {
    try { return { key: null, up: true, ...JSON.parse(localStorage.getItem(SORT_KEY) ?? "{}") }; } catch { return { key: null, up: true }; }
  });
  useEffect(() => { try { localStorage.setItem(SORT_KEY, JSON.stringify(sort)); } catch { /* storage off */ } }, [sort]);

  const rows = useMemo(() => {
    const words = q.split(/\s+/).filter(Boolean);
    return archives.filter((a) => {
      if (!words.length || (numeric && found?.has(a.id))) return true;
      const hay = `${a.id} ${a.names.join(" ")} ${a.tags.map((t) => t.name).join(" ")} ${a.language}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [archives, q, numeric, found]);

  const sorted = useMemo(() => {
    const { key, up } = sort;
    if (!key) return rows;
    const sign = up ? 1 : -1, byId = (x: ArchiveRow, y: ArchiveRow) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0);
    if (key === "banks" || key === "sounds") return [...rows].sort((x, y) => (x[key] - y[key]) * sign || byId(x, y));
    // each row's text once, not twice per comparison (sorting took 200-300 ms on a slow PC)
    const keyed = rows.map((a) => [key === "name" ? a.names.join(", ") : key === "cat" ? a.tags.map((t) => t.category).join(" ")
      : key === "archive" ? a.id : a.language, a] as const);
    const order = key === "archive" ? (x: string, y: string) => (x < y ? -1 : x > y ? 1 : 0) : NATURAL.compare; // hex names: as text
    keyed.sort(([tx, x], [ty, y]) => {
      if (!tx !== !ty) return tx ? -1 : 1; // the empty ones (unnamed, no language) go last either way round
      return order(tx, ty) * sign || byId(x, y);
    });
    return keyed.map(([, a]) => a);
  }, [rows, sort]);

  // the rows are all one height (one line each): measured from a drawn row, with the sticky heading above them
  const [size, setSize] = useState({ row: 28, head: 30 });
  useLayoutEffect(() => {
    const row = table.current?.querySelector<HTMLElement>("tbody .arc-row")?.getBoundingClientRect().height;
    const head = table.current?.tHead?.getBoundingClientRect().height;
    if (row && head && (Math.abs(row - size.row) > 0.2 || Math.abs(head - size.head) > 0.2)) setSize({ row, head });
  });
  const [first, last] = useRowWindow(list, sorted.length, size.row, size.head);

  useEffect(() => {
    if (itemId?.startsWith("archive:") && query && !rows.some((a) => `archive:${a.id}` === itemId)) setQuery("");
  }, [itemId]); // eslint-disable-line react-hooks/exhaustive-deps
  // whatever opens an archive (a link, Back, the last session) scrolls it into view; it may not be drawn yet, so
  // where it is comes from its place in the list
  const latest = useRef({ sorted, size });
  latest.current = { sorted, size };
  useEffect(() => {
    if (!itemId?.startsWith("archive:")) return;
    const t = setTimeout(() => {
      const el = list.current, { sorted: s, size: z } = latest.current;
      const i = s.findIndex((a) => `archive:${a.id}` === itemId);
      if (!el || i < 0) return;
      const top = i * z.row, bottom = z.head + (i + 1) * z.row; // under the sticky heading, and above the bottom edge
      if (top < el.scrollTop) el.scrollTo({ top, behavior: scrollBehavior() });
      else if (bottom > el.scrollTop + el.clientHeight) el.scrollTo({ top: bottom - el.clientHeight, behavior: scrollBehavior() });
    }, 30 + motionMs(160));
    return () => clearTimeout(t);
  }, [itemId]);

  /** Its categories, once each, with the names the Index has for it in each. */
  const cats = (a: ArchiveRow) => {
    const by = new Map<string, string[]>();
    for (const t of a.tags) by.set(t.category, [...(by.get(t.category) ?? []), t.name]);
    return [...by].map(([c, names]) => [c, names.join(", ")] as const);
  };
  const title = (a: ArchiveRow) => (a.names.length ? a.names.join(", ") : a.id);
  const rowMenu = (e: React.MouseEvent, a: ArchiveRow) => {
    const id = `archive:${a.id}`;
    const entries: MenuEntry[] = [
      { label: "Open", run: () => openItem(id) },
      { label: "Play a sample", run: () => playSlot("vanilla", a.preview, revision, `${title(a)} (sample)`, { scope, itemId: id, cueId: null, source: a.preview }) },
      { label: "Add to the export list", run: async () => {
        const it = itemIndex.items.get(id) ?? await resolveItem(id);
        if (!it) return;
        const all = itemEntries({ ...it, full: a.names.length ? `${title(a)} (${a.id})` : `Archive ${a.id}` }, "All Archives");
        quick(addedNote(exportList.add(all), all.length, 1), "add");
      } },
      "-",
      ...(listed.has(id) ? [
        { label: "Open in the Audio tab", run: () => goTo({ scope: "editor", itemId: id, cueId: null, source: null }) } as MenuEntry,
        { label: "Remove from the project", run: () => actions.removeFromProject([id], title(a)) } as MenuEntry,
      ] : [{ label: "Add to the project", run: () => actions.addToProject([id], title(a)) } as MenuEntry]),
      { label: "Copy the archive name", run: () => copyText(a.id, quick) },
    ];
    openMenu(e, entries);
  };
  const searchKey = keyLabel("search");

  return (
    <>
      <div className="lib-search">
        <input type="search" placeholder={`Search, or paste an id${searchKey ? `  ( ${searchKey} )` : ""}`} value={query} onChange={(e) => setQuery(e.target.value)}
          aria-label="Search the archives" onKeyDown={(e) => {
            if (e.key === "Escape") { if (query) setQuery(""); else e.currentTarget.blur(); }
            else if (e.key === "Enter" && sorted.length) { e.preventDefault(); openItem(`archive:${sorted[0].id}`); }
          }} />
      </div>
      <div className="lib-tree arc-list" ref={list}>
        <table className="arc-table" ref={table} style={{ width: total(widths) }} aria-rowcount={sorted.length + 1}>
          <colgroup>
            {(Object.keys(WIDTHS) as Col[]).map((c) => <col key={c} data-col={c} style={{ width: w(c) }} />)}
          </colgroup>
          <thead>
            <tr>
              <th aria-label="Play" />
              {COLUMNS.map(([key, label, about]) => (
                <th key={key} className={key === "banks" || key === "sounds" ? "num" : undefined}
                  aria-sort={sort.key === key ? (sort.up ? "ascending" : "descending") : undefined}>
                  <button className={sort.key === key ? "on" : undefined} data-tip={about}
                    onClick={() => setSort((s) => (s.key === key ? { key, up: !s.up } : { key, up: key !== "banks" && key !== "sounds" }))}>
                    {label}<span className="sort-caret" aria-hidden>{sort.key === key ? (sort.up ? "▴" : "▾") : ""}</span>
                  </button>
                  {grip(key)}
                </th>
              ))}
              <th aria-label="In the project" />
            </tr>
          </thead>
          <tbody>
            {first > 0 && <tr className="arc-spacer" aria-hidden style={{ height: first * size.row }}><td colSpan={8} /></tr>}
            {sorted.slice(first, last).map((a, k) => {
              const id = `archive:${a.id}`, added = listed.has(id), name = title(a), i = first + k;
              return (
                <tr key={a.id} className={`arc-row${i % 2 ? " odd" : ""}${id === itemId ? " active" : ""}${a.tags.length ? "" : " unnamed"}`}
                  aria-rowindex={i + 2} onClick={() => openItem(id)} onContextMenu={(e) => rowMenu(e, a)}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <PlayButton kind="vanilla" source={a.preview} label={`a sample of ${a.names.length ? name : "this archive"}`} what={`${name} (sample)`} small
                      at={{ scope, itemId: id, cueId: null, source: a.preview }} />
                  </td>
                  <td className="arc-name-cell">
                    <button className="arc-open" onClick={(e) => { e.stopPropagation(); openItem(id); }}>
                      <span className="arc-name" data-tip={a.names.length ? name : undefined} data-tip-clip>{a.names.length ? name : "Not named yet"}</span>
                    </button>
                  </td>
                  <td className="arc-cats">{(() => {
                    const all = cats(a), more = all.slice(3);
                    return <>{all.slice(0, 3).map(([category, names]) => <span key={category} data-tip={names}><CatMark category={category} /></span>)}
                      {more.length > 0 && <span className="arc-more" data-tip={more.map(([, names]) => names).join("; ")}>+{more.length}</span>}</>;
                  })()}</td>
                  <td className="arc-id" data-tip={a.id} data-tip-clip>{a.id}</td>
                  <td>{a.language}</td>
                  <td className="num">{a.banks}</td>
                  <td className="num">{a.sounds}</td>
                  <td className="arc-act" onClick={(e) => e.stopPropagation()}>
                    {added ? <span className="in-proj" role="img" aria-label="In the project" data-tip="In the project">✓</span>
                      : <button className="row-act" onClick={() => actions.addToProject([id], name)} aria-label={`Add ${name} to the project`} data-tip="Add to the project"
                        data-tip-more={project ? undefined : "Open or create a project first"}>+</button>}
                  </td>
                </tr>
              );
            })}
            {last < sorted.length && <tr className="arc-spacer" aria-hidden style={{ height: (sorted.length - last) * size.row }}><td colSpan={8} /></tr>}
          </tbody>
        </table>
        {!rows.length && <p className="empty-note">{q ? `No archive matches “${query}”.` : "Nothing here."}</p>}
      </div>
      {menu}
    </>
  );
}

/** The Editor's left panel: what the open project works on, and nothing else. Things get here from the Library. */
export function ProjectPanel() {
  const { project, actions } = useEditor();
  if (!project) {
    return (
      <aside className="library" aria-label="Project">
        <div className="lib-empty">
          <h2>No project open</h2>
          <p>Open or create a project, then add music or sounds to it from the Library.</p>
          <div className="row-btns">
            <button className="btn primary" onClick={actions.newProject}>New project…</button>
            <button className="btn" onClick={() => actions.openProject()}>Open project…</button>
          </div>
        </div>
      </aside>
    );
  }
  const empty = !project.library.length && !project.library_missing.length && !project.outside.length;
  return (
    <aside className="library" aria-label="Project">
      <div className="lib-title">
        <h2 data-tip={project.name} data-tip-clip>In This Project</h2>
        <button className="btn quiet small-btn" onClick={() => nav.go("library")} data-tip="Find more in the Library">Add from the Library</button>
      </div>
      {empty ? (
        <div className="lib-empty">
          <p>The project is empty. Add music or sounds from the Library.</p>
          <div className="row-btns"><button className="btn primary" onClick={() => nav.go("library")}>Open the Library</button></div>
        </div>
      ) : (
        <>
          <IndexTree />
          <OtherSounds />
        </>
      )}
    </aside>
  );
}

/** New audio in slots that nothing on the project's list holds. The list follows the replacements, so this stays
    empty unless a project file was edited by hand; it is shown so nothing is ever replaced unseen. */
function OtherSounds() {
  const { project, cueId, openCue } = useEditor();
  const [open, setOpen] = useState(true);
  const others = project?.outside ?? [];
  if (!others.length) return null;
  return (
    <div className="lib-other">
      <div className="lib-group">
        <button className="lib-group-head" aria-expanded={open} onClick={() => setOpen(!open)}
          data-tip="Replaced slots that no project entry contains">
          <span className="caret" aria-hidden>▸</span>
          <span className="lib-group-name">Other Replaced Sounds</span>
        </button>
        <Fold open={open} className="lib-group-body">
          {others.map((sid) => {
            const a = project!.assignments[sid];
            return (
              <button key={sid} className={`lib-cue${cueId === `sfx:${sid}` ? " active" : ""}`} style={{ paddingLeft: 26 }} onClick={() => openCue(`sfx:${sid}`, sid)}>
                <span className="lib-cue-name">{a?.label || (a?.silence ? "Silence" : sid)}</span>
                <span className="lib-cue-meta"><span className="dur">{sid}</span></span>
              </button>
            );
          })}
        </Fold>
      </div>
    </div>
  );
}
