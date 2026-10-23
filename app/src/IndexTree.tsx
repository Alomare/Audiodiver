import { memo, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { call, fmtTime, type MusicItem, type MusicSection, type Place } from "./api";
import { useContextMenu, type MenuEntry } from "./ContextMenu";
import { PlayButton, playSlot } from "./CueView";
import { Fold, useLastWhile, useLinger } from "./Fold";
import { keyHint, keyLabel, useKeymap } from "./keys";
import { clashes, COVERAGE, heldBy, isMusicItem, itemCoverage, listedBanks, listName, statusOf, where, type Status } from "./music";
import { useEditor, useLite } from "./store";
import { useStable } from "./stable";
import { addedNote, exportList, itemEntries } from "./exportList";
import { CollapseAllIcon } from "./Icons";
import { CatMark } from "./Tags";
import { motionMs, scrollBehavior } from "./theme";
import { FOLD_LIBRARY } from "./nav";

type Filter = "all" | "mine" | "game";
/** A top-level group of the tree: an Index category, or the archives a project lists. `flat`: it has one section,
    so its items sit right under it. */
type Group = { id: string; name: string; about: string; flat: boolean; sections: MusicSection[] };
const DEFAULT_OPEN = new Set(["c:music", "s:ship", "s:deploy"]);
const SMALL = 30; // a category with no more items than this shows its sections open

/** The Index as a tree: categories, their sections, and the items in them. In the Library it is the whole Index,
    and an item can be added to the project from here; in the Audio Editor it is what the open project lists, marked
    with whether each item plays the original or a replacement. A whole category or section is added (Library) or
    removed (Audio Editor) from its line: the + or ✕ on it, or a right-click. */
export function IndexTree() {
  const { index, itemIndex, project, itemId, openItem, goTo, actions, revision, scope, quick } = useEditor();
  const editing = scope === "editor";
  const [query, setQuery] = useState("");
  const [hi, setHi] = useState(-1); // the item the search box's arrow keys are on
  const [menu, openMenu] = useContextMenu();
  const [filter, setFilter] = useState<Filter>("all");
  const openKey = `audiodiver.tree.${scope}`;
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(openKey) ?? "{}"); } catch { return {}; }
  });
  useEffect(() => { try { localStorage.setItem(openKey, JSON.stringify(open)); } catch { /* storage off */ } }, [open, openKey]);
  const [found, setFound] = useState<Place[] | null>(null); // where a pasted id leads
  useKeymap();

  const a = project?.assignments ?? {};
  // the tree follows the search a beat behind the typing, in a render that typing can interrupt
  const q = useDeferredValue(query).trim().toLowerCase();
  const numeric = /^\d{5,20}$/.test(q);
  const tree = useRef<HTMLDivElement>(null);
  const listed = useMemo(() => new Set(project?.library ?? []), [project?.library]);
  const banks = useMemo(() => listedBanks(itemIndex, project?.library ?? []), [itemIndex, project?.library]);
  /** In the Library: the listed item that has all of this one's banks already, so it can't be added again. */
  const held = (it: MusicItem) => (editing || listed.has(it.id) ? null : heldBy(banks, it));

  // what the tree is made of: the whole Index, or the part of it the project lists (and the archives it lists)
  const groups = useMemo<Group[]>(() => {
    const all: Group[] = (index?.categories ?? []).map((c) => ({ id: c.id, name: c.name, about: c.about, flat: c.sections.length === 1, sections: c.sections }));
    if (!editing) return all;
    const mine = all.map((g) => ({ ...g, sections: g.sections.map((s) => ({ ...s, items: s.items.filter((it) => listed.has(it.id)) })).filter((s) => s.items.length) }));
    const archives = (project?.library ?? []).filter((id) => id.startsWith("archive:")).flatMap((id) => itemIndex.items.get(id) ?? []);
    if (archives.length) {
      mine.push({ id: "archives", name: "Archives", about: "Whole archives, from All Archives", flat: true,
        sections: [{ id: "archives", name: "Archives", about: "", unused: false, items: archives }] });
    }
    return mine.filter((g) => g.sections.length);
  }, [index, editing, listed, project?.library, itemIndex]);
  const sizes = useMemo(() => new Map((index?.categories ?? []).map((c) => [c.id, c.sections.reduce((n, s) => n + s.items.length, 0)])), [index]);
  const isOpen = (key: string, group: string) => open[key] ?? (editing || DEFAULT_OPEN.has(key) || (key.startsWith("s:") && (sizes.get(group) ?? 0) <= SMALL));

  // a new project: the Library's Index starts folded, at its top
  useEffect(() => {
    if (editing) return;
    const fold = () => {
      setOpen(Object.fromEntries((index?.categories ?? []).flatMap((c) => [`c:${c.id}`, ...c.sections.map((s) => `s:${s.id}`)]).map((k) => [k, false])));
      tree.current?.scrollTo(0, 0);
    };
    window.addEventListener(FOLD_LIBRARY, fold);
    return () => window.removeEventListener(FOLD_LIBRARY, fold);
  }, [editing, index]);

  // whatever opens an item (a link, Back, the last session) shows it here: its groups open and it scrolls in
  useEffect(() => {
    const s = itemId ? itemIndex.section.get(itemId) : undefined, c = itemId ? itemIndex.category.get(itemId) : undefined;
    if (!itemId) return;
    const keys = [c ? `c:${c.id}` : itemId.startsWith("archive:") ? "c:archives" : "", s ? `s:${s.id}` : ""].filter(Boolean);
    setOpen((o) => (keys.every((k) => o[k]) ? o : { ...o, ...Object.fromEntries(keys.map((k) => [k, true])) }));
    const t = setTimeout(() => tree.current?.querySelector(".mus-item.active")?.scrollIntoView({ block: "nearest", behavior: scrollBehavior() }), 30 + motionMs(160));
    return () => clearTimeout(t);
  }, [itemId, itemIndex]);
  const searched = useRef(false);
  useEffect(() => {
    if (q) { searched.current = true; return; }
    if (!searched.current) return;
    searched.current = false;
    const t = setTimeout(() => tree.current?.querySelector(".mus-item.active")?.scrollIntoView({ block: "center", behavior: "auto" }), 40);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    if (!numeric) { setFound(null); return; }
    let live = true;
    call<Place[]>("find", { query: q }).then((hits) => { if (live) setFound(hits); }).catch(() => live && setFound([]));
    return () => { live = false; };
  }, [q, numeric]);
  const foundItems = useMemo(() => new Set((found ?? []).flatMap((f) => f.item ?? [])), [found]);

  const clash = useMemo(() => (editing ? clashes(itemIndex, a) : []), [editing, itemIndex, a]);
  const clashing = useMemo(() => new Set(clash.map((c) => c.item.id)), [clash]);
  const statusOfItem = (it: MusicItem): Status => statusOf(itemCoverage(it, project));

  const shownGroups = useMemo(() => {
    const words = q.split(/\s+/).filter(Boolean);
    const keep = (g: Group, s: MusicSection, it: MusicItem) => {
      if (numeric) return foundItems.has(it.id) || it.targets.includes(q) || it.archive === q;
      if (words.length) {
        const hay = `${g.name} ${s.name} ${it.name} ${it.full} ${it.about} ${it.names?.join(" ") ?? ""} ${it.archive ?? ""} ${it.parts.map((p) => `${p.name} ${p.note}`).join(" ")}`.toLowerCase();
        if (!words.every((w) => hay.includes(w))) return false;
      }
      if (filter === "all" || !editing || !project) return true;
      const st = statusOfItem(it);
      // "Replaced" is anything with new audio in it; "Original" is what a player hears that has none
      return filter === "mine" ? st === "part" || st === "done" : st === "none" && !s.unused;
    };
    return groups.map((g) => ({ ...g, sections: g.sections.map((s) => ({ ...s, items: s.items.filter((it) => keep(g, s, it)) })).filter((s) => s.items.length) }))
      .filter((g) => g.sections.length);
  }, [groups, q, numeric, foundItems, filter, editing, project]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => shownGroups.flatMap((g) => g.sections.flatMap((s) => s.items)), [shownGroups]);
  useEffect(() => {
    if (!itemId || !query || shown.some((it) => it.id === itemId)) return;
    if (groups.some((g) => g.sections.some((s) => s.items.some((it) => it.id === itemId)))) setQuery("");
  }, [itemId]); // eslint-disable-line react-hooks/exhaustive-deps -- only when another item opens
  // what Enter opens: the item called what was typed, else one whose name starts with it, else the first found
  const best = useMemo(() => {
    if (!q || numeric) return -1;
    const rank = (it: MusicItem) => {
      const n = it.name.toLowerCase(), f = it.full.toLowerCase();
      return n === q || f === q ? 0 : n.startsWith(q) || f.startsWith(q) ? 1 : n.includes(q) || f.includes(q) ? 2 : 3;
    };
    let at = 0;
    shown.forEach((it, i) => { if (rank(it) < rank(shown[at])) at = i; });
    return shown.length ? at : -1;
  }, [shown, q, numeric]);
  useEffect(() => setHi(best), [best, filter]);
  useEffect(() => { if (hi >= 0) tree.current?.querySelector(".mus-item.hi")?.scrollIntoView({ block: "nearest" }); }, [hi]);

  /** The search box drives the list: arrows move through what matches, Enter opens it. */
  const searchKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") { if (query) setQuery(""); else e.currentTarget.blur(); }
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setHi((h) => Math.max(0, Math.min(shown.length - 1, h + (e.key === "ArrowDown" ? 1 : -1))));
    } else if (e.key === "Enter" && shown.length) {
      e.preventDefault();
      openItem(shown[Math.max(0, hi)].id);
    }
  };

  /** Puts items on the export list, all their parts, and says so. */
  const toExport = (items: MusicItem[]) => {
    const all = items.flatMap((it) => itemEntries(it, where(itemIndex, it)));
    quick(addedNote(exportList.add(all), all.length, items.length), "add");
  };
  /** The right-click menu of an item. */
  const itemMenu = (e: React.MouseEvent, it: MusicItem) => {
    const skippable = it.kind === "transition" || it.kind === "stinger" ? [...new Set(it.parts.flatMap((p) => p.own.filter((t) => !a[t])))] : [];
    const added = listed.has(it.id), inside = held(it);
    const entries: MenuEntry[] = [
      { label: "Open", run: () => openItem(it.id) },
      { label: "Play a sample", disabled: !it.preview, run: () => playSlot("vanilla", it.preview, revision, `${it.full} (sample)`, { scope, itemId: it.id, cueId: null, source: it.preview }) },
      { label: "Add to the export list", run: () => toExport([it]) },
      ...(editing && skippable.length ? [{ label: it.parts.length > 1 ? `Skip all ${it.parts.length}` : "Skip it",
        run: () => actions.skip(skippable, it.parts.length > 1 ? `${it.parts.length} in ${it.full}` : it.full) } as MenuEntry] : []),
      "-",
      ...(editing ? [
        { label: "Show in the Library", run: () => goTo({ scope: "library", itemId: it.id, cueId: null, source: null }) } as MenuEntry,
        { label: "Remove from the project", run: () => actions.removeFromProject([it.id], it.full) } as MenuEntry,
      ] : added ? [
        { label: "Open in the Audio Editor", run: () => goTo({ scope: "editor", itemId: it.id, cueId: null, source: null }) } as MenuEntry,
        { label: "Remove from the project", run: () => actions.removeFromProject([it.id], it.full) } as MenuEntry,
      ] : inside ? [
        { label: "Open in the Audio Editor", run: () => goTo({ scope: "editor", itemId: inside.id, cueId: it.parts[0].cue, source: null }) } as MenuEntry,
      ] : [
        { label: "Add to the project", run: () => actions.addToProject([it.id], it.full) } as MenuEntry,
      ]),
    ];
    openMenu(e, entries);
  };

  // what the rows do, with one identity for the life of the tree: the rows are memoised, so a search or a selection
  // draws the rows it changes instead of all of them
  const on = useStable({
    open: (it: MusicItem) => openItem(it.id),
    menu: (e: React.MouseEvent, it: MusicItem) => itemMenu(e, it),
    add: (it: MusicItem) => { actions.addToProject([it.id], it.full); },
    remove: (it: MusicItem) => { actions.removeFromProject([it.id], it.full); },
  });
  const narrowed = q.length > 0 || filter !== "all";
  const instant = useLinger(narrowed); // a search or a filter opens and closes groups at once
  if (!index) return <div className="lib-tree"><p className="empty-note">Reading the Index…</p></div>;
  const searchKey = keyLabel("search");
  // an id that leads somewhere this list doesn't show: say where
  const elsewhere = numeric && found && !shown.length ? found.find((f) => f.item) : undefined;

  const rows = (s: MusicSection, deep: boolean) => s.items.map((it) => (
    <ItemRow key={it.id} item={it} deep={deep} active={it.id === itemId} hi={hi >= 0 && shown[hi] === it}
      status={editing && project ? statusOfItem(it) : "na"} clash={clashing.has(it.id)} added={!editing && listed.has(it.id)}
      held={held(it)} editing={editing} noProject={!project} on={on} />
  ));
  /** A group's line (a category or a section): the head that folds it, and what acts on everything it shows (all of
      it, or what a search left) at once. In the Library a + adds it to the project; in the Audio Editor an ✕ takes it
      off. A right-click has the same and more. The + is always there, so it can be found; with no
      project open, it says to open one. */
  const groupLine = (head: ReactNode, items: MusicItem[], name: string) => {
    const exporting: MenuEntry = { label: `Add ${items.length === 1 ? "it" : `all ${items.length}`} to the export list`, run: () => toExport(items) };
    const inProject = items.filter((it) => listed.has(it.id));
    const what = (some: MusicItem[]) => (some.length === 1 ? some[0].full : some.length === items.length ? name : `${some.length} from ${name}`);
    const remove = () => actions.removeFromProject(inProject.map((it) => it.id), what(inProject));
    const removeLabel = inProject.length === items.length ? `Remove ${items.length === 1 ? "it" : `all ${items.length}`} from the project`
      : `Remove the ${inProject.length} in the project`;
    if (editing) {
      return (
        <div className="lib-group-line" onContextMenu={(e) => openMenu(e, [{ label: removeLabel, run: remove }, "-", exporting])}>
          {head}
          <button className="row-act remove" onClick={remove} aria-label={`${removeLabel}: ${name}`} data-tip={removeLabel}>✕</button>
        </div>
      );
    }
    const fresh = items.filter((it) => !listed.has(it.id) && !held(it));
    const add = () => actions.addToProject(fresh.map((it) => it.id), what(fresh));
    const label = !fresh.length ? "All in the project" : fresh.length === items.length ? `Add all ${fresh.length} to the project`
      : `Add the ${fresh.length} not in the project`;
    return (
      <div className="lib-group-line" onContextMenu={(e) => openMenu(e, [
        { label, disabled: !fresh.length, run: add },
        ...(inProject.length ? [{ label: removeLabel, run: remove } as MenuEntry] : []),
        "-", exporting])}>
        {head}
        {fresh.length ? <button className="row-act" onClick={add} aria-label={`${label}: ${name}`} data-tip={label}
          data-tip-more={project ? undefined : "Open or create a project first"}>+</button>
          : <span className="in-proj" role="img" aria-label="All in the project" data-tip="All in the project">✓</span>}
      </div>
    );
  };
  /** Every category and section folded. */
  const collapseAll = () =>
    setOpen(Object.fromEntries(groups.flatMap((g) => [`c:${g.id}`, ...g.sections.map((s) => `s:${s.id}`)]).map((k) => [k, false])));
  const hasMine = (items: MusicItem[]) => editing && !!project && items.some((it) => { const st = statusOfItem(it); return st === "part" || st === "done"; });
  const mineDot = <span className="mark-dot done small" role="img" aria-label="Has new audio" data-tip="Has new audio" />;

  return (
    <>
      <div className="lib-search">
        <input type="search" placeholder={`Search, or paste an id${searchKey ? `  ( ${searchKey} )` : ""}`} value={query}
          onChange={(e) => setQuery(e.target.value)} aria-label={editing ? "Search the project" : "Search the Index"} onKeyDown={searchKeys} />
        <button className="icon-btn" onClick={collapseAll} aria-label="Collapse all" data-tip="Collapse all"><CollapseAllIcon /></button>
      </div>
      {editing && project && <Filters filter={filter} setFilter={setFilter} />}
      <div className="lib-tree" ref={tree}>
        {shownGroups.map((g) => {
          const groupOpen = narrowed || isOpen(`c:${g.id}`, g.id);
          return (
            <div key={g.id} className="lib-group cat">
              {groupLine(
                <button className="lib-group-head" data-tip={g.about || undefined} data-tip-side="right" aria-expanded={groupOpen}
                  onClick={() => setOpen((o) => ({ ...o, [`c:${g.id}`]: !groupOpen }))}>
                  <span className="caret" aria-hidden>▸</span>
                  <CatMark category={g.id} />
                  <span className="lib-group-name">{g.name}</span>
                  {hasMine(g.sections.flatMap((s) => s.items)) && mineDot}
                </button>, g.sections.flatMap((s) => s.items), g.name)}
              <Fold open={groupOpen} instant={instant} className="lib-group-body">
                {g.flat ? rows(g.sections[0], false) : g.sections.map((s) => {
                  const secOpen = narrowed || isOpen(`s:${s.id}`, g.id);
                  return (
                    <div key={s.id} className={`lib-group${s.unused ? " unused" : ""}`}>
                      {groupLine(
                        <button className="lib-group-head sub" data-tip={s.about || undefined} data-tip-side="right" aria-expanded={secOpen}
                          onClick={() => setOpen((o) => ({ ...o, [`s:${s.id}`]: !secOpen }))}>
                          <span className="caret" aria-hidden>▸</span>
                          <span className="lib-group-name">{s.name}</span>
                          {!s.unused && hasMine(s.items) && mineDot}
                        </button>, s.items, s.name)}
                      <Fold open={secOpen} instant={instant} className="lib-group-body">{rows(s, true)}</Fold>
                    </div>
                  );
                })}
              </Fold>
            </div>
          );
        })}
        {!shownGroups.length && !elsewhere && (
          <p className="empty-note">{q ? `Nothing ${editing ? "in the project " : ""}matches “${query}”.` : filter === "mine" ? "Nothing replaced yet."
            : filter === "game" ? "Everything here is replaced." : "Nothing here yet."}</p>
        )}
        {elsewhere && <FoundElsewhere place={elsewhere} more={found!.filter((f) => f.item).length - 1} />}
        {editing && <Missing />}
      </div>
      {menu}
    </>
  );
}

const GLYPH: Partial<Record<MusicItem["kind"], string>> = { transition: "↝", stinger: "✦" };
const KIND_TIP: Partial<Record<MusicItem["kind"], string>> = { transition: "A transition between two pieces of music", stinger: "A stinger that plays over the music" };

/** One item of the tree. Memoised: it draws again only when something it shows changes, not with every keystroke of
    a search or every selection. */
const ItemRow = memo(function ItemRow({ item, deep, active, hi, status, clash, added, held, editing, noProject, on }: {
  item: MusicItem; deep: boolean; active: boolean; hi: boolean; status: Status; clash: boolean;
  added: boolean;            // the Library: the project lists it already
  held: MusicItem | null;    // the Library: what the project lists that has all its banks already (it can't be added)
  editing: boolean;          // the Audio Editor's list (it can be taken off), else the Library's (it can be added)
  noProject: boolean;        // no project open: the + says to open one
  on: { open: (it: MusicItem) => void; menu: (e: React.MouseEvent, it: MusicItem) => void; add: (it: MusicItem) => void; remove: (it: MusicItem) => void };
}) {
  const { scope } = useLite();
  const single = item.parts.length === 1 && !item.parts[0].cue.startsWith("sfx:");
  const music = isMusicItem(item);
  // files can be dropped onto a piece of music in the Editor: onto its one cue, or across its parts
  const drop = !editing || !music ? undefined : single ? { kind: "cue", cue: item.parts[0].cue } : item.kind === "music" ? { kind: "item", item: item.id } : undefined;
  const sounds = item.count ?? 0;
  return (
    <div className={`mus-item ${item.kind}${deep ? " deep" : ""}${active ? " active" : ""}${hi ? " hi" : ""}`} onContextMenu={(e) => on.menu(e, item)}
      data-drop={drop ? JSON.stringify(drop) : undefined}>
      {item.preview ? <PlayButton kind="vanilla" source={item.preview} label={`a sample of ${item.full}`} what={`${item.full} (sample)`} small
        at={{ scope, itemId: item.id, cueId: null, source: item.preview }} /> : <span className="play-gap" />}
      <button className="mus-name" onClick={() => on.open(item)} data-tip={(item.kind === "music" || !music ? item.about : KIND_TIP[item.kind]) || undefined} data-tip-side="right">
        {GLYPH[item.kind] && <span className="glyph" aria-hidden>{GLYPH[item.kind]}</span>}
        <span className="mus-label" data-tip={item.full} data-tip-clip>{item.name}</span>
        {item.parts.length > 1 && <span className="parts-n" data-tip={`${item.parts.length} parts`}>×{item.parts.length}</span>}
      </button>
      <span className="mus-meta">
        {clash && <span className="clash" data-tip="Plays the original next to new music">!</span>}
        {status !== "na" && <Mark status={status} />}
        {added && <span className="in-proj" role="img" aria-label="In the project" data-tip="In the project">✓</span>}
        {held && <span className="in-proj held" role="img" aria-label={`In the project, in ${listName(held)}`} data-tip="In the project already"
          data-tip-more={`The sounds are in ${listName(held)}`}>✓</span>}
        {!editing && !added && !held && (
          <button className="row-act" onClick={() => on.add(item)} aria-label={`Add ${item.full} to the project`} data-tip="Add to the project"
            data-tip-more={noProject ? "Open or create a project first" : undefined}>+</button>
        )}
        {editing && (
          <button className="row-act" onClick={() => on.remove(item)} aria-label={`Remove ${item.full} from the project`}
            data-tip="Remove from the project" data-tip-more="Also removes the new audio. Undo brings both back.">✕</button>
        )}
        {/* the Audio Editor's list leaves out lengths and counts, so its marks and buttons line up from row to row */}
        {!editing && (music ? <span className="dur">{fmtTime(item.duration_ms || null)}</span>
          : <span className="dur" data-tip={`${sounds} sound${sounds === 1 ? "" : "s"}`}>{sounds}</span>)}
      </span>
    </div>
  );
});

/** What something plays: a hollow dot for the original, a half for partly replaced, a full one for replaced. */
export function Mark({ status }: { status: Status }) {
  return <span className={`mark-dot ${status}`} role="img" data-tip={COVERAGE[status]} aria-label={COVERAGE[status]} />;
}

/** An id that leads to something this list doesn't show: an archive nobody has named (the Library's Index), or
    something the project doesn't list (the Audio Editor). */
function FoundElsewhere({ place, more }: { place: Place; more: number }) {
  const { itemIndex, openFound, scope } = useEditor();
  const item = place.item ? itemIndex.items.get(place.item) : undefined;
  const archive = place.item?.startsWith("archive:");
  const name = item ? where(itemIndex, item) : archive ? `archive ${place.item!.slice(8)}` : "the Library";
  return (
    <div className="sfx-hit">
      <p>{scope === "editor" ? <>That is in {name}, which isn't in the project.</> : <>That is in {name}{archive ? ", which isn't in the Index" : ""}.</>}
        {more > 0 && ` It plays in ${more} other place${more === 1 ? "" : "s"} too.`}</p>
      <button className="btn" onClick={() => openFound("library", place)}>{archive ? "Show in All Archives" : "Show in the Library"}</button>
    </div>
  );
}

/** What the project lists that this game version has nothing for: an archive a game update renamed, a set that is
    gone. Shown so it can be taken off the list. */
function Missing() {
  const { project, actions } = useEditor();
  const gone = project?.library_missing ?? [];
  if (!gone.length) return null;
  return (
    <div className="lib-group">
      <div className="lib-group-head" data-tip="Listed in the project but missing from this game version. An update may have renamed or removed them">
        <span className="lib-group-name">Not in This Game Version</span>
      </div>
      {gone.map((id) => (
        <div key={id} className="mus-item gone">
          <span className="play-gap" />
          <span className="mus-name"><span className="mus-label">{id.replace(/^(archive|set):/, "")}</span></span>
          <span className="mus-meta">
            <button className="row-act" onClick={() => actions.removeFromProject([id], id.replace(/^(archive|set):/, ""))} aria-label={`Remove ${id} from the project`}
              data-tip="Remove from the project">✕</button>
          </span>
        </div>
      ))}
    </div>
  );
}

/** Above the Editor's list: show only what is replaced or only what isn't, and say what still clashes with the new
    music: transitions and stingers that play the original next to it, whether the project lists them or not.
    Skipping or reviewing one the project doesn't list adds it. */
function Filters({ filter, setFilter }: { filter: Filter; setFilter: (f: Filter) => void }) {
  const { project, itemIndex, actions, openItem } = useEditor();
  const a = project?.assignments ?? {};
  const listed = new Set(project?.library ?? []);
  const clash = clashes(itemIndex, a);
  const count = clash.length;
  const n = useLastWhile(count, count > 0); // while the note folds away it still says what it said
  const skipAll = () => actions.skip([...new Set(clash.flatMap((c) => c.open))],
    `${n} transition${n === 1 ? "" : "s"} and stinger${n === 1 ? "" : "s"}`);
  // a clash is reviewed where it can be shown: one the project lists opens here, another gets added first
  const review = async () => {
    const c = clash.find((x) => listed.has(x.item.id)) ?? clash[0];
    if (!c) return;
    if (!listed.has(c.item.id) && !(await actions.addToProject([c.item.id], c.item.full))) return;
    openItem(c.item.id, c.item.parts.indexOf(c.part));
  };
  const tabs: [Filter, string, string][] = [
    ["all", "All", "Everything in the project"],
    ["mine", "Replaced", "Only what has new audio"],
    ["game", "Original", "Only what still plays the original"],
  ];
  return (
    <div className="mus-filters">
      <div className="segmented mus-filter" role="radiogroup" aria-label="Show">
        {tabs.map(([f, label, about]) => (
          <button key={f} role="radio" aria-checked={filter === f} className={filter === f ? "on" : ""}
            onClick={() => setFilter(f)} data-tip={about}>{label}</button>
        ))}
      </div>
      <Fold open={count > 0}>
        <div className="mus-clash">
          <span><b>{n}</b> transition{n === 1 ? "" : "s"} or stinger{n === 1 ? "" : "s"} still play{n === 1 ? "s" : ""} the original next to new music.</span>
          <div className="row-btns">
            <button className="btn quiet small-btn" onClick={review} data-tip="Open the first one and add it to the project">Review</button>
            <button className="btn small-btn" onClick={skipAll}
              data-tip={`Replace them with a short silence, so the next music starts right away${keyHint("undo") ? `. Undo${keyHint("undo")} brings them back` : ""}`}>Skip them all</button>
          </div>
        </div>
      </Fold>
    </div>
  );
}
