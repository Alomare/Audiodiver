import { memo, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ph, plural, t } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import { call, type MusicItem, type MusicSection, type Place } from "./api";
import { useContextMenu, type MenuEntry } from "./ContextMenu";
import { PlayButton, playSlot } from "./CueView";
import { Fold, useLastWhile, useLinger } from "./Fold";
import { keyHint, keyLabel, useKeymap } from "./keys";
import { clashes, COVERAGE, heldBy, isMusicItem, itemCoverage, listedBanks, listName, statusOf, where, type Status } from "./music";
import { useEditor, useLite } from "./store";
import { useStable } from "./stable";
import { addedNote, exportList, itemEntries } from "./exportList";
import { CheckIcon, CollapseAllIcon, NoteIcon, PlusIcon, RemoveIcon, SearchIcon } from "./Icons";
import { CatMark } from "./Tags";
import { motionMs, scrollBehavior } from "./theme";
import { FOLD_LIBRARY } from "./nav";
import { Help } from "./Wiki";

type Filter = "all" | "mine" | "game";
/** A top-level group of the tree: an Index category, or the archives a project lists. `flat`: it has one section,
    so its items sit right under it. */
type Group = { id: string; name: string; about: string; flat: boolean; sections: MusicSection[]; en?: string };
const DEFAULT_OPEN = new Set(["c:music", "s:ship", "s:deploy"]);
const SMALL = 30; // a category with no more items than this shows its sections open

/** The Index as a tree: categories, their sections, and the items in them. In the Library it is the whole Index,
    and an item can be added to the project from here; in the Audio tab it is what the open project lists, marked
    with whether each item plays the original or a replacement. A whole category or section is added (Library) or
    removed (Audio tab) from its line: the + or ✕ on it, or a right-click. */
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
    const all: Group[] = (index?.categories ?? []).map((c) => ({ id: c.id, name: c.name, about: c.about, flat: c.sections.length === 1, sections: c.sections, en: c.en }));
    if (!editing) return all;
    const mine = all.map((g) => ({ ...g, sections: g.sections.map((s) => ({ ...s, items: s.items.filter((it) => listed.has(it.id)) })).filter((s) => s.items.length) }));
    const archives = (project?.library ?? []).filter((id) => id.startsWith("archive:")).flatMap((id) => itemIndex.items.get(id) ?? []);
    if (archives.length) {
      mine.push({ id: "archives", name: t`Archives`, about: t`Whole archives, from All Archives`, flat: true,
        sections: [{ id: "archives", name: t`Archives`, about: "", unused: false, items: archives }] });
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
  // a name also finds the slots the community labels or the clip notes call that, in whatever piece they are
  const [named, setNamed] = useState<Named[]>([]);
  useEffect(() => {
    if (numeric || q.replace(/\s/g, "").length < 3) { setNamed([]); return; }
    let live = true;
    const t = setTimeout(() => call<Named[]>("find_text", { query: q }).then((hits) => { if (live) setNamed(hits); }).catch(() => live && setNamed([])), 150);
    return () => { live = false; clearTimeout(t); };
  }, [q, numeric]);
  const byLabel = useMemo(() => {
    const m = new Map<string, Named>();
    for (const n of named) if (n.item && !m.has(n.item)) m.set(n.item, n);
    return m;
  }, [named]);
  /** Opens an item, at the slot the search found in it: the id pasted, or the label typed. */
  const openHit = (it: MusicItem) => {
    const at = numeric ? found?.find((f) => f.item === it.id) : hints.has(it.id) ? byLabel.get(it.id) : undefined;
    if (at) goTo({ scope, itemId: it.id, cueId: at.cue, source: at.source });
    else openItem(it.id);
  };

  const clash = useMemo(() => (editing ? clashes(itemIndex, a) : []), [editing, itemIndex, a]);
  const clashing = useMemo(() => new Set(clash.map((c) => c.item.id)), [clash]);
  const statusOfItem = (it: MusicItem): Status => statusOf(itemCoverage(it, project));

  // hints: the items shown only for a slot's label, with that label
  const { shownGroups, hints } = useMemo(() => {
    const words = q.split(/\s+/).filter(Boolean);
    const hints = new Map<string, Named>();
    const keep = (g: Group, s: MusicSection, it: MusicItem) => {
      if (numeric) return foundItems.has(it.id) || it.targets.includes(q) || it.archive === q;
      if (words.length) {
        // the English names too (`en`, where the language names them otherwise): players know the items by them
        const hay = `${g.name} ${g.en ?? ""} ${s.name} ${s.en ?? ""} ${it.name} ${it.full} ${it.en ?? ""} ${it.about} ${it.names?.join(" ") ?? ""} ${it.archive ?? ""} ${it.parts.map((p) => `${p.name} ${p.note}`).join(" ")}`.toLowerCase();
        if (!words.every((w) => hay.includes(w))) {
          const n = byLabel.get(it.id);
          if (!n) return false;
          hints.set(it.id, n);
        }
      }
      if (filter === "all" || !editing || !project) return true;
      const st = statusOfItem(it);
      // "Replaced" is anything with new audio in it; "Original" is what a player hears that has none
      return filter === "mine" ? st === "part" || st === "done" : st === "none" && !s.unused;
    };
    const shownGroups = groups.map((g) => ({ ...g, sections: g.sections.map((s) => ({ ...s, items: s.items.filter((it) => keep(g, s, it)) })).filter((s) => s.items.length) }))
      .filter((g) => g.sections.length);
    return { shownGroups, hints };
  }, [groups, q, numeric, foundItems, byLabel, filter, editing, project]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => shownGroups.flatMap((g) => g.sections.flatMap((s) => s.items)), [shownGroups]);
  useEffect(() => {
    if (!itemId || !query || shown.some((it) => it.id === itemId)) return;
    if (groups.some((g) => g.sections.some((s) => s.items.some((it) => it.id === itemId)))) setQuery("");
  }, [itemId]); // eslint-disable-line react-hooks/exhaustive-deps -- only when another item opens
  // what Enter opens: the item called what was typed, else one whose name starts with it, else the first found
  const best = useMemo(() => {
    if (!q || numeric) return -1;
    const rank = (it: MusicItem) => {
      const names = [it.name, it.full, it.en ?? it.full].map((x) => x.toLowerCase());
      return names.some((x) => x === q) ? 0 : names.some((x) => x.startsWith(q)) ? 1 : names.some((x) => x.includes(q)) ? 2 : 3;
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
      openHit(shown[Math.max(0, hi)]);
    }
  };

  /** Puts items on the export list, all their parts, and says so: in the Audio tab as the mod plays them. */
  const toExport = (items: MusicItem[]) => {
    const all = items.flatMap((it) => itemEntries(it, where(itemIndex, it), editing ? "mod" : "game"));
    quick(addedNote(exportList.add(all), all.length, items.length), "add");
  };
  /** The right-click menu of an item. */
  const itemMenu = (e: React.MouseEvent, it: MusicItem) => {
    const skippable = it.kind === "transition" || it.kind === "stinger" ? [...new Set(it.parts.flatMap((p) => p.own.filter((t) => !a[t])))] : [];
    const added = listed.has(it.id), inside = held(it);
    const count = it.parts.length, name = it.full;
    const entries: MenuEntry[] = [
      { label: t`Open`, run: () => openItem(it.id) },
      { label: t`Play a Sample`, disabled: !it.preview, run: () => playSlot("vanilla", it.preview, revision, t`${name} (sample)`, { scope, itemId: it.id, cueId: null, source: it.preview }) },
      { label: t`Add to the Export List`, run: () => toExport([it]) },
      ...(editing && skippable.length ? [{ label: count > 1 ? t`Skip All ${count}` : t`Skip It`,
        run: () => actions.skip(skippable, count > 1 ? t({ message: `${count} in ${name}`, comment: "Named in a note, as in “3 in Exploring → Battle skipped”" }) : it.full) } as MenuEntry] : []),
      "-",
      ...(editing ? [
        { label: t`Show in the Library`, run: () => goTo({ scope: "library", itemId: it.id, cueId: null, source: null }) } as MenuEntry,
        { label: t`Remove from the Project`, run: () => actions.removeFromProject([it.id], it.full) } as MenuEntry,
      ] : added ? [
        { label: t`Open in the Audio Tab`, run: () => goTo({ scope: "editor", itemId: it.id, cueId: null, source: null }) } as MenuEntry,
        { label: t`Remove from the Project`, run: () => actions.removeFromProject([it.id], it.full) } as MenuEntry,
      ] : inside ? [
        { label: t`Open in the Audio Tab`, run: () => goTo({ scope: "editor", itemId: inside.id, cueId: it.parts[0].cue, source: null }) } as MenuEntry,
      ] : [
        { label: t`Add to the Project`, run: () => actions.addToProject([it.id], it.full) } as MenuEntry,
      ]),
    ];
    openMenu(e, entries);
  };

  // what the rows do, with one identity for the life of the tree: the rows are memoised, so a search or a selection
  // draws the rows it changes instead of all of them
  const on = useStable({
    open: (it: MusicItem) => openHit(it),
    menu: (e: React.MouseEvent, it: MusicItem) => itemMenu(e, it),
    add: (it: MusicItem) => actions.addToProject([it.id], it.full),
    remove: (it: MusicItem) => actions.removeFromProject([it.id], it.full),
  });
  const narrowed = q.length > 0 || filter !== "all";
  const instant = useLinger(narrowed); // a search or a filter opens and closes groups at once
  if (!index) return <div className="lib-tree"><p className="empty-note"><Trans>Reading the Index…</Trans></p></div>;
  const searchKey = keyLabel("search");
  // an id that leads somewhere this list doesn't show: say where
  const elsewhere = numeric && found && !shown.length ? found.find((f) => f.item) : undefined;

  const rows = (s: MusicSection, deep: boolean) => s.items.map((it) => (
    <ItemRow key={it.id} item={it} deep={deep} active={it.id === itemId} hi={hi >= 0 && shown[hi] === it}
      status={editing && project ? statusOfItem(it) : "na"} clash={clashing.has(it.id)} added={!editing && listed.has(it.id)}
      held={held(it)} editing={editing} noProject={!project} hint={hints.get(it.id)} on={on} />
  ));
  /** A group's line (a category or a section): the head that folds it, and what acts on everything it shows (all of
      it, or what a search left) at once. In the Library a + adds it to the project; in the Audio tab an ✕ takes it
      off. A right-click has the same and more. The + is always there, so it can be found; with no
      project open, it says to open one. */
  const groupLine = (head: ReactNode, items: MusicItem[], name: string) => {
    const count = items.length;
    const exporting: MenuEntry = { label: count === 1 ? t`Add It to the Export List` : t`Add All ${count} to the Export List`, run: () => toExport(items) };
    const inProject = items.filter((it) => listed.has(it.id));
    const what = (some: MusicItem[]) => (some.length === 1 ? some[0].full : some.length === items.length ? name
      : t({ message: `${ph({ count: some.length })} from ${name}`, comment: "Named in a note, as in “3 from Weapons added to My Mod”" }));
    const remove = () => actions.removeFromProject(inProject.map((it) => it.id), what(inProject));
    // the menu says it in Title Case, as buttons do; the ✕ and the + say the same as a tip
    const removeTip = inProject.length === items.length ? (count === 1 ? t`Remove it from the project` : t`Remove all ${count} from the project`)
      : t`Remove the ${ph({ count: inProject.length })} in the project`;
    const removeLabel = inProject.length === items.length ? (count === 1 ? t`Remove It from the Project` : t`Remove All ${count} from the Project`)
      : t`Remove the ${ph({ count: inProject.length })} in the Project`;
    if (editing) {
      return (
        <div className="lib-group-line" onContextMenu={(e) => openMenu(e, [{ label: removeLabel, run: remove }, "-", exporting])}>
          {head}
          <button className="row-act remove" onClick={remove} aria-label={`${removeTip}: ${name}`} data-tip={removeTip}>✕</button>
        </div>
      );
    }
    const fresh = items.filter((it) => !listed.has(it.id) && !held(it));
    const add = () => actions.addToProject(fresh.map((it) => it.id), what(fresh));
    const tip = !fresh.length ? t`All in the project` : fresh.length === items.length ? t`Add all ${count} to the project`
      : t`Add the ${ph({ count: fresh.length })} not in the project`;
    const label = !fresh.length ? t`All in the Project` : fresh.length === items.length ? t`Add All ${count} to the Project`
      : t`Add the ${ph({ count: fresh.length })} Not in the Project`;
    // the + while something here can be added; once all of it is in, the ✕ that takes it off
    return (
      <div className="lib-group-line" onContextMenu={(e) => openMenu(e, [
        { label, disabled: !fresh.length, run: add },
        ...(inProject.length ? [{ label: removeLabel, run: remove } as MenuEntry] : []),
        "-", exporting])}>
        {head}
        {fresh.length ? <AddToggle added={false} run={add} label={`${tip}: ${name}`} tip={tip} more={project ? undefined : t`Open or create a project first`} />
          : inProject.length ? <AddToggle added run={remove} label={`${removeTip}: ${name}`} tip={removeTip} />
          : <span className="lib-add held" role="img" aria-label={t`All in the project`} data-tip={t`All in the project`}><CheckIcon /></span>}
      </div>
    );
  };
  /** Every category and section folded. */
  const collapseAll = () =>
    setOpen(Object.fromEntries(groups.flatMap((g) => [`c:${g.id}`, ...g.sections.map((s) => `s:${s.id}`)]).map((k) => [k, false])));
  const hasMine = (items: MusicItem[]) => editing && !!project && items.some((it) => { const st = statusOfItem(it); return st === "part" || st === "done"; });
  const mineDot = <span className="mark-dot done small" role="img" aria-label={t`Has new audio`} data-tip={t`Has new audio`} />;

  return (
    <>
      <div className="lib-search">
        <input type="search" placeholder={`${t`Search, or paste an ID`}${searchKey ? `  ( ${searchKey} )` : ""}`} value={query}
          onChange={(e) => setQuery(e.target.value)} aria-label={editing ? t`Search the project` : t`Search the Index`} onKeyDown={searchKeys}
          data-tip={t`Names, descriptions and slot labels`} data-tip-more={t`Or paste a source, stream, bank or cue ID to find where it plays`} />
        <button className="icon-btn" onClick={collapseAll} aria-label={t`Collapse all`} data-tip={t`Collapse all`}><CollapseAllIcon /></button>
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
          <p className="empty-note">{q ? (editing ? t`Nothing in the project matches “${query}”.` : t`Nothing matches “${query}”.`) : filter === "mine" ? t`Nothing replaced yet.`
            : filter === "game" ? t`Everything here is replaced.` : t`Nothing here yet.`}</p>
        )}
        {elsewhere && <FoundElsewhere place={elsewhere} more={found!.filter((f) => f.item).length - 1} />}
        {editing && <Missing />}
      </div>
      {menu}
    </>
  );
}

const GLYPH: Partial<Record<MusicItem["kind"], string>> = { transition: "↝", stinger: "✦" };
/** A place a name leads to (core find_text): an id's place, with the label that matched. */
type Named = Place & { label?: string; note?: boolean };
const KIND_TIP: Partial<Record<MusicItem["kind"], string>> = { transition: t`A transition between two pieces of music`, stinger: t`A stinger that plays over the music` };

/** One item of the tree. Memoised: it draws again only when something it shows changes, not with every keystroke of
    a search or every selection. */
const ItemRow = memo(function ItemRow({ item, deep, active, hi, status, clash, added, held, editing, noProject, hint, on }: {
  item: MusicItem; deep: boolean; active: boolean; hi: boolean; status: Status; clash: boolean;
  hint?: Named;              // a search found it by this label of a slot in it, or by a global note
  added: boolean;            // the Library: the project lists it already
  held: MusicItem | null;    // the Library: what the project lists that has all its banks already (it can't be added)
  editing: boolean;          // the Audio tab's list (it can be taken off), else the Library's (it can be added)
  noProject: boolean;        // no project open: the + says to open one
  on: { open: (it: MusicItem) => void; menu: (e: React.MouseEvent, it: MusicItem) => void; add: (it: MusicItem) => void; remove: (it: MusicItem) => void };
}) {
  const { scope } = useLite();
  const name = item.full;
  const single = item.parts.length === 1 && !item.parts[0].cue.startsWith("sfx:");
  const music = isMusicItem(item);
  // files can be dropped onto a piece of music in the Editor: onto its one cue, or across its parts
  const drop = !editing || !music ? undefined : single ? { kind: "cue", cue: item.parts[0].cue } : item.kind === "music" ? { kind: "item", item: item.id } : undefined;
  return (
    <div className={`mus-item ${item.kind}${deep ? " deep" : ""}${active ? " active" : ""}${hi ? " hi" : ""}`} onContextMenu={(e) => on.menu(e, item)}
      data-drop={drop ? JSON.stringify(drop) : undefined}>
      {item.preview ? <PlayButton kind="vanilla" source={item.preview} label={t({ message: `a sample of ${name}`, comment: "After Play or Pause on a play button" })} what={t`${name} (sample)`} small
        at={{ scope, itemId: item.id, cueId: null, source: item.preview }} /> : <span className="play-gap" />}
      <button className="mus-name" onClick={() => on.open(item)} data-tip={(item.kind === "music" || !music ? item.about : KIND_TIP[item.kind]) || undefined} data-tip-side="right">
        {GLYPH[item.kind] && <span className="glyph" aria-hidden>{GLYPH[item.kind]}</span>}
        <span className="mus-label" data-tip={item.full} data-tip-clip>{item.name}</span>
        {hint && <span className="mus-hint" data-tip={hint.note ? t`Found in a global note` : undefined}>{hint.note ? <NoteIcon /> : <SearchIcon />}{hint.label}</span>}
      </button>
      {/* the Library's rows hold the name and the + alone; the Audio tab's add whether each plays new audio */}
      <span className="mus-meta">
        {clash && <span className="clash" data-tip={t`Plays the original next to new music`}>!</span>}
        {status !== "na" && <Mark status={status} />}
        {!editing && (held ? <HeldMark held={held} />
          : <AddToggle added={added} run={() => (added ? on.remove(item) : on.add(item))}
            label={added ? t`Remove ${name} from the project` : t`Add ${name} to the project`}
            tip={added ? t`Remove from the project` : t`Add to the project`}
            more={added ? t`Also removes the new audio. Undo brings both back.` : noProject ? t`Open or create a project first` : undefined} />)}
        {editing && (
          <button className="row-act" onClick={() => on.remove(item)} aria-label={t`Remove ${name} from the project`}
            data-tip={t`Remove from the project`} data-tip-more={t`Also removes the new audio. Undo brings both back.`}>✕</button>
        )}
      </span>
    </div>
  );
});

/** How long the + and ✕ ignore clicks after one: longer than a double click takes. */
const SETTLE_MS = 500;

/** The + that adds to the project and the ✕ it turns into, which takes it off again: on the Library's items, the
    lines of its groups and All Archives. Clicks right after one do nothing (the second click of a double click, a
    press while the first is still on its way), so one quick double click never adds and removes at once. */
export function AddToggle({ added, run, label, tip, more }: {
  added: boolean; run: () => unknown; label: string; tip: string; more?: string;
}) {
  const settling = useRef(false);
  const click = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (settling.current || e.detail > 1) return;
    settling.current = true;
    const done = () => { setTimeout(() => { settling.current = false; }, SETTLE_MS); };
    Promise.resolve(run()).then(done, done);
  };
  return (
    <button className={`lib-add${added ? " on" : ""}`} onClick={click} onDoubleClick={(e) => e.stopPropagation()}
      aria-label={label} data-tip={tip} data-tip-more={more}>{added ? <RemoveIcon /> : <PlusIcon />}</button>
  );
}

/** In place of the + on an item the project has inside another it lists (all of its banks are there already). */
function HeldMark({ held }: { held: MusicItem }) {
  const name = listName(held);
  return (
    <span className="lib-add held" role="img" aria-label={t`In the project, in ${name}`} data-tip={t`In the project already`}
      data-tip-more={t`The sounds are in ${name}`}><CheckIcon /></span>
  );
}

/** What something plays: a hollow dot for the original, a half for partly replaced, a full one for replaced. */
export function Mark({ status, label }: { status: Status; label?: string /* the Text tab says Changed */ }) {
  return <span className={`mark-dot ${status}`} role="img" data-tip={label ?? COVERAGE[status]} aria-label={label ?? COVERAGE[status]} />;
}

/** An id that leads to something this list doesn't show: an archive nobody has named (the Library's Index), or
    something the project doesn't list (the Audio tab). */
function FoundElsewhere({ place, more }: { place: Place; more: number }) {
  const { itemIndex, openFound, scope } = useEditor();
  const item = place.item ? itemIndex.items.get(place.item) : undefined;
  const archive = place.item?.startsWith("archive:");
  const name = item ? where(itemIndex, item) : "", id = archive ? place.item!.slice(8) : "";
  // a whole sentence for each case: a place in the Index, an archive by the name in the game files, or the Library
  const said = scope === "editor"
    ? item ? t`That is in ${name}, which isn't in the project.` : archive ? t`That is in archive ${id}, which isn't in the project.`
      : t`That is in the Library, which isn't in the project.`
    : archive ? item ? t`That is in ${name}, which isn't in the Index.` : t`That is in archive ${id}, which isn't in the Index.`
    : item ? t`That is in ${name}.` : t`That is in the Library.`;
  return (
    <div className="sfx-hit">
      <p>{said}
        {more > 0 && ` ${plural(more, { one: "It plays in # other place too.", other: "It plays in # other places too." })}`}</p>
      <button className="btn" onClick={() => openFound("library", place)}>{archive ? t`Show in All Archives` : t`Show in the Library`}</button>
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
      <div className="lib-group-head" data-tip={t`Listed in the project but missing from this game version. An update may have renamed or removed them`}>
        <span className="lib-group-name"><Trans>Not in This Game Version</Trans></span>
      </div>
      {gone.map((id) => (
        <div key={id} className="mus-item gone">
          <span className="play-gap" />
          <span className="mus-name"><span className="mus-label">{id.replace(/^(archive|set):/, "")}</span></span>
          <span className="mus-meta">
            <button className="row-act" onClick={() => actions.removeFromProject([id], id.replace(/^(archive|set):/, ""))} aria-label={t`Remove ${ph({ name: id })} from the project`}
              data-tip={t`Remove from the project`}>✕</button>
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
    plural(n, { one: "# transition and stinger", other: "# transitions and stingers" }));
  // a clash is reviewed where it can be shown: one the project lists opens here, another gets added first
  const review = async () => {
    const c = clash.find((x) => listed.has(x.item.id)) ?? clash[0];
    if (!c) return;
    if (!listed.has(c.item.id) && !(await actions.addToProject([c.item.id], c.item.full))) return;
    openItem(c.item.id, c.item.parts.indexOf(c.part));
  };
  const tabs: [Filter, string, string][] = [
    ["all", t({ message: "All", context: "Filter of the project list" }), t`Everything in the project`],
    ["mine", t({ message: "Replaced", context: "Filter of the project list" }), t`Only what has new audio`],
    ["game", t({ message: "Original", context: "Filter of the project list" }), t`Only what still plays the original`],
  ];
  const undo = keyHint("undo");
  return (
    <div className="mus-filters">
      <div className="segmented mus-filter" role="radiogroup" aria-label={t({ message: "Show", context: "Filter of the project list" })}>
        {tabs.map(([f, label, about]) => (
          <button key={f} role="radio" aria-checked={filter === f} className={filter === f ? "on" : ""}
            onClick={() => setFilter(f)} data-tip={about}>{label}</button>
        ))}
      </div>
      <Fold open={count > 0}>
        <div className="mus-clash">
          <span><Plural value={n} one={<Trans><b>#</b> transition or stinger still plays the original next to new music.</Trans>}
            other={<Trans><b>#</b> transitions or stingers still play the original next to new music.</Trans>} />{" "}
            <Help tip={t`A transition plays between two pieces of music, and a stinger over one. Left original, they play a stretch of the original music next to the new music. Skip replaces them with a short silence`} page="how-the-game-plays-music#transitions-and-stingers" /></span>
          <div className="row-btns">
            <button className="btn quiet small-btn" onClick={review} data-tip={t`Open the first one and add it to the project`}><Trans>Review</Trans></button>
            <button className="btn small-btn" onClick={skipAll}
              data-tip={undo ? t({ message: `Replace them with a short silence, so the next music starts right away. Undo${undo} brings them back`, comment: "{undo} is the key in parentheses, such as “ (Ctrl+Z)”" })
                : t`Replace them with a short silence, so the next music starts right away`}><Trans>Skip Them All</Trans></button>
          </div>
        </div>
      </Fold>
    </div>
  );
}
