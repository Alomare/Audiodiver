import { Fragment, useState, type ReactNode } from "react";
import { ph, plural, t } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import { fmtTime, intlLocale, type Assignment, type Cue, type MusicItem, type MusicPart } from "./api";
import { PlayButton } from "./CueView";
import { Fold } from "./Fold";
import { FillPieceIcon, InfoIcon, LinkIcon, SkipAllIcon, TransitionIcon } from "./Icons";
import { Mark } from "./IndexTree";
import { keyHint } from "./keys";
import { clashes, counted, COVERAGE, heldBy, isMusicItem, itemCoverage, listedBanks, listName, statusOf } from "./music";
import { tabArrows } from "./Page";
import { pickAudio } from "./platform";
import { useEditor } from "./store";
import { CatMark, CatTag } from "./Tags";
import { ToolButton } from "./Tools";
import { Help } from "./Wiki";

const WAY = {
  in: t({ message: "Into", comment: "A transition into this music" }),
  out: t({ message: "Out of", comment: "A transition out of this music" }),
  over: t({ message: "Over", comment: "A stinger over this music" }),
} as const;

const ABOUT_KEY = "audiodiver.itemAbout"; // whether item descriptions show under the title: the last choice, for all items
const aboutShown = () => { try { return !!localStorage.getItem(ABOUT_KEY); } catch { return false; } };

/** Links or tags joined as the language joins a list ("A, B and C"): andList for elements. */
function listOf(items: ReactNode[]) {
  const parts = new Intl.ListFormat(intlLocale(), { type: "conjunction" }).formatToParts(items.map((_, i) => String(i)));
  return <>{parts.map((p, k) => <Fragment key={k}>{p.type === "element" ? items[Number(p.value)] : p.value}</Fragment>)}</>;
}

/** The ⓘ after an item's title: its description in the tooltip, and a click shows it under the title (or hides it). */
function AboutToggle({ about, open, onToggle }: { about: string; open: boolean; onToggle: () => void }) {
  return (
    <button className="about-btn item-about" aria-expanded={open} aria-label={open ? t`Hide the description` : t`Show the description`}
      onClick={onToggle} data-tip={open ? t`Hide the description` : about} data-tip-more={open ? undefined : t`Click to keep it shown`}>
      <InfoIcon /></button>
  );
}

/** The top of the centre panel for an item: what it is and where the Index has it, and for a piece of
    music what leads in and out of it. `nav` (back and forward) sits at the end of the title's line. `cue` is the part
    that shows: for a bank it says what archives hold it and what the Index knows of it. The title says what the item
    plays as a whole; each part's own state is on its tab. What it shares, what plays next to it and `facts` (the
    slot list's own) sit side by side in one row under the title, and stack when there is no room. */
export function ItemHead({ item, part, cue, nav, facts = [] }: { item: MusicItem; part: MusicPart; cue: Cue; nav: ReactNode; facts?: ReactNode[] }) {
  const { itemIndex, project, show, goTo, readOnly } = useEditor();
  const a = project?.assignments ?? {};
  const section = itemIndex.section.get(item.id), category = itemIndex.category.get(item.id);
  const c = itemCoverage(item, readOnly ? null : project);
  const parts = item.parts.length;
  const kind = item.kind === "transition" ? plural(parts, { one: "Transition", other: "Transitions" })
    : item.kind === "stinger" ? plural(parts, { one: "Stinger", other: "Stingers" }) : "";
  const music = isMusicItem(item);
  // where it is: "On the Ship", "Weapons", "Helldivers ▸ Voices", or All Archives for an archive on its own
  const place = item.kind === "archive" ? t`All Archives` : music ? section?.name
    : category && section && section.name !== category.name ? `${category.name} ▸ ${section.name}` : category?.name;
  const listed = !!project?.library.includes(item.id);
  // a sound set or archive whose banks the project has already, in something else it lists
  const inside = readOnly && project && !listed ? heldBy(listedBanks(itemIndex, project.library), item) : null;
  // in an archive, what the Index knows of the bank that shows: a link to the sound set it is
  const known = item.kind === "archive" ? (cue.tags ?? []).filter((t) => t.item) : [];
  const sets = known.length ? listOf(known.map((tag) => <CatTag key={tag.item} tag={tag} tip={t`Show in the Index`} onOpen={() => show(tag.item!, cue.id)} />)) : null;
  const archives = cue.kind === "sounds" ? cue.archive_names : [];
  // the archives that hold the bank, as links: the first four, then how many more
  const count = archives.length;
  const links = archives.slice(0, 4).map((name) => (
    <button key={name} className="link-text arc-id" data-tip={t`Show in All Archives`}
      onClick={() => goTo({ scope: "library", itemId: `archive:${name}`, cueId: cue.id, source: null })}>{name}</button>
  ));
  const [link] = links;
  const list = count > 1 ? listOf(count > 4 ? [...links, t({ message: `${ph({ count: count - 4 })} more`, comment: "The end of a list of archives: “A, B, C, D and 2 more”" })] : links) : null;
  // what it shares audio with, each a link with the number of slots: "A (2 slots), B (1 slot) and C (3 slots)"
  const others = item.shares.length ? listOf(item.shares.flatMap((s) => {
    const other = itemIndex.items.get(s.item);
    return other ? [<span key={s.item}><button className="link-text" onClick={() => show(other.id)} data-tip={other.full}>
      {itemIndex.section.get(other.id) === section ? other.name : other.full}</button> ({plural(ph({ count: s.count }), { one: "# slot", other: "# slots" })})</span>] : [];
  })) : null;
  const [aboutOpen, setAboutOpen] = useState(aboutShown);
  const toggleAbout = () => {
    setAboutOpen(!aboutOpen);
    try { localStorage.setItem(ABOUT_KEY, aboutOpen ? "" : "1"); } catch { /* storage off: for this view only */ }
  };
  // the short ones first, so they sit side by side; music of the same section goes by its own name ("Intense Battle")
  const all = [
    item.kind === "music" && item.around.length > 0 && <Around key="around" item={item} a={a} />,
    ...facts,
    item.shares.length > 0 && (
      <p key="shares" className="fact"><LinkIcon /><span><Trans>Shares audio with {others}.</Trans>{" "}
        <Help tip={t`Replacing one of these slots changes that music too`} page="how-the-game-plays-music#shared-audio" /></span>
      </p>
    ),
  ].filter(Boolean);
  return (
    <>
      <div className="head-row">
        <div className="crumbs">
          {category && <CatMark category={category.id} />}
          {place}{kind && <> · {kind}</>}
        </div>
      </div>
      <div className="item-title">
        <h1>{item.name}</h1>
        {item.about && <AboutToggle about={item.about} open={aboutOpen} onToggle={toggleAbout} />}
        {!readOnly && project && c.total > 0 && (
          <span className={`item-cov ${statusOf(c)}`} data-tip={t`${ph({ count: c.n })} of ${ph({ total: c.total })} slots replaced`}
            data-tip-more={statusOf(c) === "part" ? t`The other slots still play the original` : undefined}><Mark status={statusOf(c)} />{COVERAGE[statusOf(c)]}</span>
        )}
        {readOnly && listed && <span className="item-cov done" data-tip={t`In ${ph({ project: project!.name })}`}><Trans>In the project</Trans></span>}
        {inside && <span className="item-cov done" data-tip={t`These sounds are in the project already`} data-tip-more={t`In ${ph({ name: listName(inside) })}`}><Trans>In the project</Trans></span>}
        {item.kind === "archive" && (item.tags ?? []).map((t) => <CatTag key={t.category} tag={t} />)}
        {nav}
      </div>
      {item.about && <Fold open={aboutOpen}><p className="cue-notes">{item.about}</p></Fold>}
      {known.length > 0 && <p className="cue-detail"><Trans>This bank is {sets} in the Index.</Trans></p>}
      {all.length > 0 && <div className="head-facts">{all}</div>}
      {archives.length > 0 && item.kind !== "archive" && (
        <p className="cue-detail">
          {count === 1 ? <Trans>In the archive {link}</Trans> : <Trans>In {count} archives: {list}</Trans>}
          {cue.bank_name && <> · <span className="arc-id" data-tip={t`Bank name in the game files`}>{cue.bank_name}</span></>}
        </p>
      )}
    </>
  );
}

/** Buttons that act on the whole item, for the toolbar: fill all its parts, or skip all its transitions. */
export function ItemActions({ item }: { item: MusicItem }) {
  const { project, actions } = useEditor();
  if (!project || item.parts.length < 2) return null;
  const a = project.assignments;
  const total = counted(item).length;
  const count = item.parts.length, name = item.full;
  if (item.kind === "music") {
    return total > 1 ? (
      <ToolButton icon={<FillPieceIcon />} name={t`Fill the whole piece`} about={t`A file for each of the ${total} slots, part by part, in play order and file-name order`}
        onClick={async () => { const f = await pickAudio(true); if (f) actions.fillSources(counted(item), f, t({ message: `the ${count} parts of ${name}`, comment: "Named in a note, as in “Filled 12 slots across the 3 parts of Battle Music”" })); }} />
    ) : null;
  }
  const skippable = [...new Set(item.parts.flatMap((p) => p.own.filter((t) => !a[t])))];
  const undo = keyHint("undo");
  return skippable.length ? (
    <ToolButton icon={<SkipAllIcon />} name={t`Skip all ${count}`} onClick={() => actions.skip(skippable, item.kind === "transition"
      ? plural(count, { one: "# transition", other: "# transitions" }) : plural(count, { one: "# stinger", other: "# stingers" }))}
      about={undo ? t({ message: `Replace them with a short silence, so the next music starts right away. Undo${undo} brings them back`, comment: "{undo} is the key in parentheses, such as “ (Ctrl+Z)”" })
        : t`Replace them with a short silence, so the next music starts right away`} />
  ) : null;
}

/** The item's parts (variants, segments, a transition's versions) as tabs: they sit under the toolbar, right above
    the list of slots they switch. */
export function PartTabs({ item, part }: { item: MusicItem; part: MusicPart }) {
  const { openItem, project, readOnly } = useEditor();
  return (
    <div className="parts" role="tablist" aria-label={t`Parts`} onKeyDown={tabArrows}>
      {item.parts.map((p, i) => {
        const c = itemCoverage(item, readOnly ? null : project, p);
        const bank = p.kind === "bank";
        return (
          <button key={p.cue} role="tab" aria-selected={p === part} className={`part-tab${p === part ? " on" : ""}`}
            onClick={() => openItem(item.id, i)} data-tip={p.note || undefined}
            data-drop={!readOnly && !bank && p.kind !== "sound" ? JSON.stringify({ kind: "cue", cue: p.cue }) : undefined}>
            {c.total > 0 && <Mark status={statusOf(c)} />}
            <span>{p.name || t`Part ${ph({ number: i + 1 })}`}</span>
            <span className="part-len" data-tip={bank ? plural(ph({ count: p.count ?? 0 }), { one: "# sound", other: "# sounds" }) : undefined}>
              {bank ? p.count : p.kind === "sound" ? t({ message: "sound", comment: "On a part tab, in place of a length: the part is one sound" }) : fmtTime(p.duration_ms)}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Whether an item's parts fold in the slot list instead of sitting in tabs: transitions and stingers, which have
    many parts of a slot or two each, with long names ("Intense Battle → Exploring #2"). */
export const partsFold = (item: MusicItem) => item.parts.length > 1 && (item.kind === "transition" || item.kind === "stinger");

/** A part's line in the slot list (partsFold): it plays the part's original, opens it (its slots show under it, the
    other parts fold) or folds it, takes files dropped on it, and says what it plays now. */
export function PartHead({ item, part, index, open, onToggle }: {
  item: MusicItem; part: MusicPart; index: number; open: boolean; onToggle: () => void;
}) {
  const { project, readOnly, scope } = useEditor();
  const a = project?.assignments ?? {};
  const c = itemCoverage(item, readOnly ? null : project, part);
  const name = part.name || t`Part ${ph({ number: index + 1 })}`;
  // silence, and audio that belongs to other music, say so in words; the dot says the rest
  const mine = part.own.filter((t) => a[t]);
  const worded = !part.own.length || (mine.length === part.own.length && mine.every((t) => a[t].silence));
  return (
    <div className={`grp part-grp${open ? " open" : ""}`}
      data-drop={!readOnly && part.kind !== "bank" && part.kind !== "sound" ? JSON.stringify({ kind: "cue", cue: part.cue }) : undefined}>
      <PlayButton kind="vanilla" source={part.targets[0] ?? ""} label={t({ message: `the original ${name}`, comment: "After Play or Pause on a play button" })} what={name} small disabled={!part.targets.length}
        at={{ scope, itemId: item.id, cueId: part.cue, source: part.targets[0] ?? null }} />
      <button className="grp-head" aria-expanded={open} onClick={onToggle} data-tip={part.note || undefined}>
        <span className="caret" aria-hidden>▸</span>
        <span className="grp-name" data-tip={name} data-tip-clip>{name}</span>
        <span className="grp-n">{fmtTime(part.duration_ms)}</span>
      </button>
      <span className="grp-meta">
        {!readOnly && project && worded && <PartState part={part} a={a} />}
        {c.total > 0 ? <Mark status={statusOf(c)} /> : <span className="mark-dot none mark-gap" aria-hidden />}
      </span>
    </div>
  );
}

/** Transitions into and out of a piece of music and stingers over it, with what they play now. */
function Around({ item, a }: { item: MusicItem; a: Record<string, Assignment> }) {
  const { itemIndex, project, show, actions, readOnly } = useEditor();
  const [open, setOpen] = useState(false);
  const clash = new Set(readOnly ? [] : clashes(itemIndex, a).filter((c) => c.next.includes(item)).map((c) => c.part.cue));
  const rows = item.around.flatMap((near) => {
    const owner = itemIndex.items.get(near.item);
    const i = owner?.parts.findIndex((p) => p.cue === near.cue) ?? -1;
    return owner && i >= 0 ? [{ near, owner, part: owner.parts[i], index: i }] : [];
  });
  const game = rows.filter((r) => clash.has(r.part.cue));
  const transitions = rows.filter((r) => r.near.way !== "over").length, stingers = rows.length - transitions;
  // a whole sentence for each mix: transitions, stingers, or both
  const what = !stingers ? plural(transitions, { one: "# transition plays next to this music.", other: "# transitions play next to this music." })
    : !transitions ? plural(stingers, { one: "# stinger plays next to this music.", other: "# stingers play next to this music." })
    : t`${plural(transitions, { one: "# transition", other: "# transitions" })} and ${plural(stingers, { one: "# stinger", other: "# stingers" })} play next to this music.`;
  const warn = game.length > 0, count = game.length;
  return (
    <div className={`fact around${warn ? " warn" : ""}`}>
      <div className="around-head">
        <TransitionIcon />
        <span>{what}{warn && <> <Plural value={count} one={<Trans><b>#</b> still plays the original next to new music.</Trans>}
          other={<Trans><b>#</b> still play the original next to new music.</Trans>} /></>}{" "}
          <Help tip={t`A transition plays between two pieces of music, and a stinger over one. Left original, they play a stretch of the original music next to the new music. Skip replaces them with a short silence`} page="how-the-game-plays-music#transitions-and-stingers" /></span>
        <button className="link-text" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? t`Hide` : t`Show`}</button>
        {warn && project && (
          <button className="btn quiet small-btn" data-tip={t`Replace them with a short silence, so the next music starts right away. This also adds them to the project.`}
            onClick={() => actions.skip([...new Set(game.flatMap((r) => r.part.own.filter((t) => !a[t])))],
              t({ message: `${count} around ${ph({ name: item.full })}`, comment: "Named in a note, as in “2 around Battle Music skipped”" }))}>
            {count === 1 ? t`Skip It` : t`Skip Them`}</button>
        )}
      </div>
      <Fold open={open}>
        <ul className="around-list">
          {rows.map(({ near, owner, part, index }) => (
            <li key={`${near.cue}-${near.way}`}>
              <span className="way">{WAY[near.way]}</span>
              <PlayButton kind="vanilla" source={part.targets[0] ?? ""} label={t({ message: `the original ${ph({ name: owner.name })}`, comment: "After Play or Pause on a play button" })} small disabled={!part.targets.length}
                what={owner.parts.length > 1 && part.name ? part.name : owner.full}
                at={{ scope: !readOnly && project?.library.includes(owner.id) ? "editor" : "library", itemId: owner.id, cueId: part.cue, source: part.targets[0] ?? null }} />
              <button className="link-text around-name" onClick={() => show(owner.id, index)}
                data-tip={!readOnly && !project?.library.includes(owner.id) ? t`Not in the project. Opens in the Library` : undefined}>
                {owner.parts.length > 1 && part.name ? part.name : owner.name}
              </button>
              <span className="pstate-cell">{clash.has(part.cue) && <span className="clash" data-tip={t`Plays the original next to new music`}>!</span>}
                {!readOnly && <PartState part={part} a={a} />}</span>
            </li>
          ))}
        </ul>
      </Fold>
    </div>
  );
}

/** What a transition or stinger plays now: the original, a replacement, a skip (silence the game moves straight on
    from) or silence that keeps the original timing. */
export function PartState({ part, a }: { part: MusicPart; a: Record<string, Assignment> }) {
  if (!part.own.length) return <span className="pstate shared" data-tip={t`The audio is part of other music and changes with it`}>{t({ message: "with the music", comment: "What a transition or stinger plays now" })}</span>;
  const mine = part.own.filter((t) => a[t]);
  if (!mine.length) return <span className="pstate game">{t({ message: "original", comment: "What a transition or stinger plays now" })}</span>;
  if (mine.length < part.own.length) return <span className="pstate part">{t({ message: "partly replaced", comment: "What a transition or stinger plays now" })}</span>;
  if (!mine.every((t) => a[t].silence)) return <span className="pstate mine">{t({ message: "replaced", comment: "What a transition or stinger plays now" })}</span>;
  return mine.every((t) => a[t].fit_timing) ? <span className="pstate skipped" data-tip={t`Silent, and the game moves straight on`}>{t({ message: "skipped", comment: "What a transition or stinger plays now" })}</span>
    : <span className="pstate silent" data-tip={t`Silence for the length of the original`}>{t({ message: "silent", comment: "What a transition or stinger plays now" })}</span>;
}
