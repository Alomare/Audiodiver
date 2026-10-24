import { useState, type ReactNode } from "react";
import { fmtTime, type Assignment, type Cue, type MusicItem, type MusicPart } from "./api";
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

const WAY = { in: "Into", out: "Out of", over: "Over" } as const;

const ABOUT_KEY = "audiodiver.itemAbout"; // whether item descriptions show under the title: the last choice, for all items
const aboutShown = () => { try { return !!localStorage.getItem(ABOUT_KEY); } catch { return false; } };

/** The ⓘ after an item's title: its description in the tooltip, and a click shows it under the title (or hides it). */
function AboutToggle({ about, open, onToggle }: { about: string; open: boolean; onToggle: () => void }) {
  return (
    <button className="about-btn item-about" aria-expanded={open} aria-label={open ? "Hide the description" : "Show the description"}
      onClick={onToggle} data-tip={open ? "Hide the description" : about} data-tip-more={open ? undefined : "Click to keep it shown"}>
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
  const kind = item.kind === "transition" ? "Transition" : item.kind === "stinger" ? "Stinger" : "";
  const music = isMusicItem(item);
  // where it is: "On the Ship", "Weapons", "Helldivers ▸ Voices", or All Archives for an archive on its own
  const place = item.kind === "archive" ? "All Archives" : music ? section?.name
    : category && section && section.name !== category.name ? `${category.name} ▸ ${section.name}` : category?.name;
  const listed = !!project?.library.includes(item.id);
  // a sound set or archive whose banks the project has already, in something else it lists
  const inside = readOnly && project && !listed ? heldBy(listedBanks(itemIndex, project.library), item) : null;
  // in an archive, what the Index knows of the bank that shows: a link to the sound set it is
  const known = item.kind === "archive" ? (cue.tags ?? []).filter((t) => t.item) : [];
  const archives = cue.kind === "sounds" ? cue.archive_names : [];
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
      <p key="shares" className="fact"><LinkIcon /><span>Shares audio with{" "}
        {item.shares.map((s, i) => {
          const other = itemIndex.items.get(s.item);
          return other ? (
            <span key={s.item}>{i > 0 && (i === item.shares.length - 1 ? " and " : ", ")}
              <button className="link-text" onClick={() => show(other.id)} data-tip={other.full}>
                {itemIndex.section.get(other.id) === section ? other.name : other.full}</button> ({s.count} slot{s.count === 1 ? "" : "s"})</span>
          ) : null;
        })}.</span>
      </p>
    ),
  ].filter(Boolean);
  return (
    <>
      <div className="head-row">
        <div className="crumbs">
          {category && <CatMark category={category.id} />}
          {place}{kind && <> · {kind}{item.parts.length > 1 ? "s" : ""}</>}
        </div>
      </div>
      <div className="item-title">
        <h1>{item.name}</h1>
        {item.about && <AboutToggle about={item.about} open={aboutOpen} onToggle={toggleAbout} />}
        {!readOnly && project && c.total > 0 && (
          <span className={`item-cov ${statusOf(c)}`}><Mark status={statusOf(c)} />{COVERAGE[statusOf(c)]}</span>
        )}
        {readOnly && listed && <span className="item-cov done" data-tip={`In ${project!.name}`}>In the project</span>}
        {inside && <span className="item-cov done" data-tip="These sounds are in the project already" data-tip-more={`In ${listName(inside)}`}>In the project</span>}
        {item.kind === "archive" && (item.tags ?? []).map((t) => <CatTag key={t.category} tag={t} />)}
        {nav}
      </div>
      {item.about && <Fold open={aboutOpen}><p className="cue-notes">{item.about}</p></Fold>}
      {known.length > 0 && (
        <p className="cue-detail">This bank is {known.map((t, i) => (
          <span key={t.item}>{i > 0 && " and "}<CatTag tag={t} tip="Show in the Index" onOpen={() => show(t.item!, cue.id)} /></span>
        ))} in the Index.</p>
      )}
      {all.length > 0 && <div className="head-facts">{all}</div>}
      {archives.length > 0 && item.kind !== "archive" && (
        <p className="cue-detail">
          {archives.length === 1 ? "In the archive " : `In ${archives.length} archives: `}
          {archives.slice(0, 4).map((name, i) => (
            <span key={name}>{i > 0 && ", "}<button className="link-text arc-id" data-tip="Show in All Archives"
              onClick={() => goTo({ scope: "library", itemId: `archive:${name}`, cueId: cue.id, source: null })}>{name}</button></span>
          ))}{archives.length > 4 && ` and ${archives.length - 4} more`}
          {cue.bank_name && <> · <span className="arc-id" data-tip="Bank name in the game files">{cue.bank_name}</span></>}
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
  if (item.kind === "music") {
    return total > 1 ? (
      <ToolButton icon={<FillPieceIcon />} name="Fill the whole piece" about={`Choose files for all ${total} slots in every part, in order`}
        onClick={async () => { const f = await pickAudio(true); if (f) actions.fillSources(counted(item), f, `the ${item.parts.length} parts of ${item.full}`); }} />
    ) : null;
  }
  const kind = item.kind === "transition" ? "transition" : "stinger";
  const skippable = [...new Set(item.parts.flatMap((p) => p.own.filter((t) => !a[t])))];
  return skippable.length ? (
    <ToolButton icon={<SkipAllIcon />} name={`Skip all ${item.parts.length}`} onClick={() => actions.skip(skippable, `${item.parts.length} ${kind}s`)}
      about={`Replace them with a short silence, so the next music starts right away${keyHint("undo") ? `. Undo${keyHint("undo")} brings them back` : ""}`} />
  ) : null;
}

/** The item's parts (variants, segments, a transition's versions) as tabs: they sit under the toolbar, right above
    the list of slots they switch. */
export function PartTabs({ item, part }: { item: MusicItem; part: MusicPart }) {
  const { openItem, project, readOnly } = useEditor();
  return (
    <div className="parts" role="tablist" aria-label="Parts" onKeyDown={tabArrows}>
      {item.parts.map((p, i) => {
        const c = itemCoverage(item, readOnly ? null : project, p);
        const bank = p.kind === "bank";
        return (
          <button key={p.cue} role="tab" aria-selected={p === part} className={`part-tab${p === part ? " on" : ""}`}
            onClick={() => openItem(item.id, i)} data-tip={p.note || undefined}
            data-drop={!readOnly && !bank && p.kind !== "sound" ? JSON.stringify({ kind: "cue", cue: p.cue }) : undefined}>
            {c.total > 0 && <Mark status={statusOf(c)} />}
            <span>{p.name || `Part ${i + 1}`}</span>
            <span className="part-len" data-tip={bank ? `${p.count} sound${p.count === 1 ? "" : "s"}` : undefined}>{bank ? p.count : p.kind === "sound" ? "sound" : fmtTime(p.duration_ms)}</span>
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
  const name = part.name || `Part ${index + 1}`;
  // silence, and audio that belongs to other music, say so in words; the dot says the rest
  const mine = part.own.filter((t) => a[t]);
  const worded = !part.own.length || (mine.length === part.own.length && mine.every((t) => a[t].silence));
  return (
    <div className={`grp part-grp${open ? " open" : ""}`}
      data-drop={!readOnly && part.kind !== "bank" && part.kind !== "sound" ? JSON.stringify({ kind: "cue", cue: part.cue }) : undefined}>
      <PlayButton kind="vanilla" source={part.targets[0] ?? ""} label={`the original ${name}`} what={name} small disabled={!part.targets.length}
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
  const what = [transitions && `${transitions} transition${transitions === 1 ? "" : "s"}`, stingers && `${stingers} stinger${stingers === 1 ? "" : "s"}`].filter(Boolean).join(" and ");
  const warn = game.length > 0;
  return (
    <div className={`fact around${warn ? " warn" : ""}`}>
      <div className="around-head">
        <TransitionIcon />
        <span>{what} {rows.length === 1 ? "plays" : "play"} next to this music{warn ? <>. <b>{game.length}</b> still {game.length === 1 ? "plays" : "play"} the original next to new music.</> : "."}</span>
        <button className="link-text" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Hide" : "Show"}</button>
        {warn && project && (
          <button className="btn quiet small-btn" data-tip="Replace them with a short silence, so the next music starts right away. This also adds them to the project."
            onClick={() => actions.skip([...new Set(game.flatMap((r) => r.part.own.filter((t) => !a[t])))], `${game.length} around ${item.full}`)}>
            Skip {game.length === 1 ? "it" : "them"}</button>
        )}
      </div>
      <Fold open={open}>
        <ul className="around-list">
          {rows.map(({ near, owner, part, index }) => (
            <li key={`${near.cue}-${near.way}`}>
              <span className="way">{WAY[near.way]}</span>
              <PlayButton kind="vanilla" source={part.targets[0] ?? ""} label={`the original ${owner.name}`} small disabled={!part.targets.length}
                what={owner.parts.length > 1 && part.name ? part.name : owner.full}
                at={{ scope: !readOnly && project?.library.includes(owner.id) ? "editor" : "library", itemId: owner.id, cueId: part.cue, source: part.targets[0] ?? null }} />
              <button className="link-text around-name" onClick={() => show(owner.id, index)}
                data-tip={!readOnly && !project?.library.includes(owner.id) ? "Not in the project. Opens in the Library" : undefined}>
                {owner.parts.length > 1 && part.name ? part.name : owner.name}
              </button>
              <span className="pstate-cell">{clash.has(part.cue) && <span className="clash" data-tip="Plays the original next to new music">!</span>}
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
  if (!part.own.length) return <span className="pstate shared" data-tip="The audio is part of other music and changes with it">with the music</span>;
  const mine = part.own.filter((t) => a[t]);
  if (!mine.length) return <span className="pstate game">original</span>;
  if (mine.length < part.own.length) return <span className="pstate part">partly replaced</span>;
  if (!mine.every((t) => a[t].silence)) return <span className="pstate mine">replaced</span>;
  return mine.every((t) => a[t].fit_timing) ? <span className="pstate skipped" data-tip="Silent, and the game moves straight on">skipped</span>
    : <span className="pstate silent" data-tip="Silence for the length of the original">silent</span>;
}
