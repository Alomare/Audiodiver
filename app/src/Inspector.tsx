import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ph, plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { call, fmtDecimal, fmtTime, intlLocale, isMusic, shownId, type Assignment, type Place, type Slot } from "./api";
import { rowsOf, type Row } from "./CueView";
import { liveGain } from "./gain";
import { ClearIcon, FillIcon, FillPieceIcon, FolderIcon, ResetIcon, SilenceIcon } from "./Icons";
import { keyLabel, useKeymap, type CommandId } from "./keys";
import { where } from "./music";
import { nav } from "./nav";
import { NoteSection } from "./Notes";
import { noteKeys } from "./noteStore";
import { fullPath, pickAudio, reveal } from "./platform";
import { useEditor, useShownTabs } from "./store";
import { showLines } from "./TextTab";
import { Help, WikiLink } from "./Wiki";
import { rangeVars } from "./range";

/** The Audio tab's right panel: the selected slot's settings. Each control has one home: the slot's row plays the
    original and the replacement and takes or replaces its file; the waveforms below the list play from any spot; this
    panel sets up what replaces the slot (silence's timing, Make-Up Gain, timing, cue points), or the Make-Up Gain of
    the original where nothing does, and says where else it plays. At the foot, the slot's Project Note and Global
    Note. The Library's panel is LibraryDetails; there SlotFacts says what a slot is, over its waveform. */
export function Inspector() {
  const { cue, selected, project, actions } = useEditor();
  const rows = useMemo(() => (cue ? rowsOf(cue.segments_detail) : []), [cue]);
  const sel = rows.filter((r) => selected.includes(r.slot.source));
  const text = useShownTabs().includes("text"); // a subtitle shows while the Text tab does
  useKeymap();
  // the slot the panel showed last: what replaces it settles in when that changes, not when another slot is selected
  // (the whole panel settles in then)
  const one = sel.length === 1 ? sel[0].slot.source : null;
  const shown = useRef(one);
  useEffect(() => { shown.current = one; });
  if (!cue || !sel.length) return <Empty />;
  if (sel.length > 1) {
    return <Bulk rows={sel} sources={sel.map((r) => r.slot.source)} usable={sel.filter((r) => !r.slot.unused && !r.slot.locked && !r.slot.absent).map((r) => r.slot.source)} />;
  }
  const { slot, seg } = sel[0];
  const a = project?.assignments[slot.source];
  const usable = !slot.unused && !slot.locked && !slot.absent && !slot.added;
  const also = slot.also_n ?? slot.also_in.length;
  const sub = slot.label && !seg.name.includes(slot.label) ? slot.label : null;
  return (
    <aside className="inspector" aria-label={t`Details`}>
      <div className="view-in" key={slot.source}>
      <div className="insp-title">
        <h2>{seg.name}{sub ? <span className="sub">{sub}</span> : null}</h2>
        <CopyId slot={slot} />
      </div>
      {slot.locked && <p className="warn-box"><Trans>Do not touch. Replacing this clip makes the music stutter.</Trans> <Help tip={t`Tags on a slot`} page="reading-the-screen#tags-on-a-row" /></p>}
      {slot.absent && <p className="info-box"><Trans>This clip isn't in the installed game files, so there is nothing to play or replace.</Trans></p>}
      {slot.unused && <p className="info-box"><Trans>The game never plays this clip.</Trans></p>}
      {seg.added === "layer" ? <p className="info-box"><Trans>A new layer. It plays whenever the sound above it plays.</Trans></p>
        : slot.added && <p className="info-box"><Trans>A new take. The game picks it like the other takes.</Trans></p>}
      <ClipNotes slot={slot} a={a} />

      <Settle key={a?.silence ? "silence" : a ? "file" : "none"} still={shown.current !== slot.source}>
        <Replacement slot={slot} a={a} music={isMusic(cue)} what={seg.name} />
        {a && (slot.was || (!slot.added && slot.object && ((slot.players ?? 1) > 1 || (slot.sound_banks ?? 0) < (slot.banks ?? 0)))) &&
          <Reach slot={slot} />}
        {a && !a.silence && <Gain sources={[slot.source]} value={a.gain_db} match={slot.added ? undefined : "one"} base={slot.added ? undefined : slot.game_gain ?? 0} />}
        {!a && project && usable && <Gain original sources={[slot.source]} value={project.gains[slot.source] ?? 0} base={slot.game_gain ?? 0} />}
        {project && usable && slot.curve && <CurveSwitch sources={[slot.source]} />}
        {a && !a.silence && seg.segment && (
          <section className="insp-sec">
            <label className="check">
              <input type="checkbox" checked={a.fit_timing} onChange={(e) => actions.update(slot.source, { fit_timing: e.target.checked })} />
              <span><Trans>Fit timing to the new audio</Trans> <Help tip={t`When this is on, the next segment starts when the new audio ends. When it is off, the original timing applies.`} page="timing-and-loops#fitting-the-timing-to-the-new-audio" /></span>
            </label>
          </section>
        )}
        {a && !a.silence && seg.segment && <Markers segment={seg.segment} gameEntry={seg.entry_ms} gameExit={seg.exit_ms}
          fit={a.fit_timing} lengthMs={a.duration_ms} source={slot.source} more={(a.file_segments ?? 1) - 1} />}
      </Settle>

      {slot.mod_settings?.length ? <ModSettings list={slot.mod_settings} /> : null}
      {also > 0 && <section className="insp-sec"><SharedWith slot={slot} also={also} /></section>}
      <section className="insp-sec facts">
        <dl>
          <dt><Trans comment="The length of the original audio of the slot">Original</Trans></dt><dd>{slot.duration_ms || seg.duration_ms ? fmtTime(slot.duration_ms || seg.duration_ms) : "–"}</dd>
          {seg.segment && <><dt><Trans>Segment</Trans> <Help tip={t`A stretch of music that plays as a unit. The next segment starts at the Exit`} page="how-the-game-plays-music#segments-and-slots" /></dt>
            <dd>{fmtTime(seg.duration_ms)}{seg.exit_ms != null && <> · <span data-tip={t`The next segment starts here`}>{exitAt(seg.exit_ms)}</span></>}</dd></>}
          {slot.variant && <><dt><Trans>Variant</Trans> <Help tip={t`This slot plays only under a condition, such as a biome. Give each variant new audio to change the piece everywhere`} page="how-the-game-plays-music#variants" /></dt>
            <dd>{slot.variant}</dd></>}
          {cue.language && <><dt><Trans>Language</Trans></dt><dd>{cue.language}</dd></>}
          {slot.subtitle && text && <><dt><Trans>Subtitle</Trans></dt><dd><SubtitleLink slot={slot}><Trans comment="Opens the subtitle of the voice line in the Text tab">Open</Trans></SubtitleLink>{!slot.subtitle_sure &&
            <span className="muted" data-tip={SEVERAL}> · {t({ message: "one of several", comment: "The subtitle shown is one of several that have the words of the voice line" })}</span>}</dd></>}
        </dl>
      </section>
      {!slot.absent && <NoteSection scope="project" k={noteKeys.clip(slot.source)} name={sub ? `${seg.name}, ${sub}` : seg.name} />}
      {!slot.absent && <NoteSection scope="global" k={noteKeys.clip(slot.source)} name={sub ? `${seg.name}, ${sub}` : seg.name} />}
      </div>
    </aside>
  );
}

/** Nothing selected: the open item's notes, and what the keys do, with the keys they are on now. */
function Empty() {
  const { shownItemId, itemIndex } = useEditor();
  const item = shownItemId ? itemIndex.items.get(shownItemId) : undefined;
  return (
    <aside className="inspector" aria-label={t`Details`}>
      {item && (
        <div className="insp-item view-in" key={item.id}>
          <div className="insp-title"><h2>{item.name}</h2></div>
          <NoteSection scope="project" k={noteKeys.item(item.id)} name={item.full} />
          <NoteSection scope="global" k={noteKeys.item(item.id)} name={item.full} />
        </div>
      )}
      <div className="insp-empty">
        <p><Trans>Select a slot.</Trans></p>
        <dl className="key-hints">
          {hint(["selectPrev", "selectNext"], t({ message: "select", comment: "What the keys do: select the slot above or below" }))}
          {hint(["playPause"], t`play or pause`)}
          {hint(["playGame", "playMine"], t({ message: "original / new audio", comment: "What the keys do: play the original or the new audio of the slot" }))}
          {hint(["chooseFile"], t`choose a file`)}
          {hint(["moveUp", "moveDown"], t`move the new audio`)}
          {hint(["copy", "paste"], t`copy / paste`)}
          {hint(["remove"], t({ message: "remove", comment: "What the key does: remove the new audio from the slot" }))}
          {hint(["undo"], t`undo`)}
        </dl>
        <p className="keys">
          <button className="link-text" onClick={() => nav.go("settings", "shortcuts")}><Trans>All Shortcuts</Trans></button>
          {" · "}<WikiLink page="reading-the-screen" about={t`What the Audio tab shows`}><Trans>Reading the screen</Trans></WikiLink>
        </p>
      </div>
    </aside>
  );
}

/** One line of the key list: the keys, then what they do. A command without a key is left out. */
function hint(ids: CommandId[], what: string) {
  const keys = ids.map(keyLabel).filter(Boolean).join(" / ");
  return keys ? <div key={ids[0]}><dt>{keys}</dt><dd>{what}</dd></div> : null;
}

/** What replaces the slot. The file itself is chosen, replaced and removed on the slot's row (and its right-click
    menu); here is what it is, and for silence what it does to the timing. */
function Replacement({ slot, a, music, what }: { slot: Slot; a?: Assignment; music: boolean; what: string }) {
  const { project, actions } = useEditor();
  if (a?.silence) {
    return (
      <section className="insp-sec">
        <h3><Trans>Silence</Trans> <Help tip={t`Silence plays nothing in place of the original.`} page="how-the-game-plays-music#silence" /></h3>
        <label className="check">
          <input type="checkbox" checked={!a.fit_timing} onChange={(e) => actions.update(slot.source, { fit_timing: !e.target.checked })} />
          <span><Trans>Keep original duration</Trans> <Help tip={keepTip()} page="how-the-game-plays-music#silence" /></span>
        </label>
        {!music && <p className="muted small"><Trans>Audiodiver also removes it from the mix.</Trans> <Help tip={t`A silenced sound no longer turns down the sounds around it.`} page="volume#the-game-s-hdr-mix" /></p>}
      </section>
    );
  }
  if (a) {
    const name = a.name;
    return (
      <section className="insp-sec">
        <h3><Trans>New audio</Trans></h3>
        <div className="replaced-with">
          <span className={`file${a.exists ? "" : " missing"}`} data-tip={a.audio} data-tip-clip>{a.exists ? a.name : t`Missing: ${name}`}</span>
          {a.duration_ms != null && <span className="len">{fmtTime(a.duration_ms)}</span>}
          <button className="icon-btn" aria-label={t`Show in folder`} data-tip={t`Show in folder`} disabled={!a.exists}
            onClick={() => reveal(fullPath(project!.folder, a.audio))}><FolderIcon /></button>
        </div>
      </section>
    );
  }
  const usable = !slot.unused && !slot.locked && !slot.absent;
  const choose = keyLabel("chooseFile");
  return (
    <section className="insp-sec">
      <h3><Trans>Not replaced</Trans></h3>
      {usable && <p className="muted small">{choose ? t`Drop audio on the slot, or press ${choose} to choose a file.` : t`Drop audio on the slot.`}</p>}
      <div className="row-btns">
        <button className="btn" disabled={!usable} onClick={() => actions.silence([slot.source], true, what)} data-tip-cmd="silence"
          data-tip={t`Play nothing here instead of the original`}><Trans>Use Silence</Trans></button>
      </div>
    </section>
  );
}

/** Where the new audio plays, for a bank's sound whose clip other sounds play too: in every sound that plays the
    clip, as any replacement does, or only in this sound (a clip of its own). The count is of banks, this one too. */
function Reach({ slot }: { slot: Slot }) {
  const { actions } = useEditor();
  const own = !!slot.was;
  // the banks each choice changes, this one too
  const banks = (slot.banks ?? 0) + 1, soundBanks = (own ? slot.banks ?? 0 : slot.sound_banks ?? 0) + 1;
  const choices = [
    [false, t`Every Sound That Plays It`, own ? t`Every sound that plays this clip gets the new audio`
      : plural(banks, { one: "Changes it in # bank", other: "Changes it in # banks" })],
    [true, t`Only This Sound`, plural(soundBanks, {
      one: "Changes it in # bank. Other sounds that play the clip keep the original.",
      other: "Changes it in # banks. Other sounds that play the clip keep the original.",
    })],
  ] as const;
  return (
    <section className="insp-sec">
      <h3><Trans>Scope</Trans> <Help tip={t`Several sounds can play the same clip. Choose whether the new audio plays in all of them or only in this one.`} page="adding-audio#only-this-sound" /></h3>
      <div className="cards one" role="radiogroup" aria-label={t`Scope`}>
        {choices.map(([only, title, text]) => (
          <button key={title} role="radio" aria-checked={own === only} className={`card${own === only ? " on" : ""}`} data-tip={text}
            onClick={() => { if (own !== only) actions.onlyThisSound(slot.source, slot.object, only); }}>
            <b>{title}</b>
          </button>
        ))}
      </div>
    </section>
  );
}

/** What the clip notes say about a clip (core data/notes.json), and a warning when the new audio is shorter than
    the shortest that works there. */
function ClipNotes({ slot, a }: { slot: Slot; a?: Assignment }) {
  const short = !!(slot.min_ms && a && !a.silence && a.duration_ms != null && a.duration_ms < slot.min_ms);
  const length = fmtTime(a?.duration_ms), needed = fmtTime(slot.min_ms);
  return (
    <>
      {(slot.notes ?? []).map((n) => <p key={n.text} className={n.warn ? "warn-box" : "info-box"}>{n.text}</p>)}
      {short && <p className="warn-box"><Trans>The new audio is {length} long, and this slot needs at least {needed}.</Trans></p>}
    </>
  );
}

/** The Library's facts about the selected slot, in a line over its waveform: what it is, its id, how long it plays,
    when, and where else the game plays the same audio. */
export function SlotFacts({ row }: { row: Row }) {
  const { cue } = useEditor();
  const { slot, seg } = row;
  const also = slot.also_n ?? slot.also_in.length;
  const sub = slot.label && !seg.name.includes(slot.label) ? slot.label : null;
  const length = slot.duration_ms || seg.duration_ms;
  return (
    <div className="tl-facts view-in" key={slot.source}>
      <div className="tl-facts-line">
        <b>{seg.name}{sub && <span className="muted"> · {sub}</span>}</b>
        <CopyId slot={slot} />
        {length > 0 && <span>{fmtTime(length)}</span>}
        {seg.segment && seg.exit_ms != null && <span data-tip={t`The next segment starts here`}>{exitAt(seg.exit_ms)}</span>}
        {slot.variant && <span>{t`plays when ${ph({ variant: slot.variant })}`}</span>}
        {cue?.language && <span>{cue.language}</span>}
        {slot.locked && <span className="warn" data-tip={t`Replacing it makes the music stutter`}>{t`do not touch`}</span>}
        {slot.unused && <span data-tip={t`The game never plays this clip`}>{t`never heard`}</span>}
        {slot.absent && <span data-tip={t`Not in the installed game files`}>{t`no audio`}</span>}
        {slot.subtitle && <SubtitleLink slot={slot}>{slot.subtitle_sure ? t`subtitle` : t`subtitle: one of several`}</SubtitleLink>}
        {(slot.notes ?? []).map((n) => n.tag && <span key={n.tag} className={n.warn ? "warn" : undefined} data-tip={n.text}>{n.tag}</span>)}
      </div>
      {also > 0 && <SharedWith slot={slot} also={also} />}
      {(slot.notes ?? []).map((n) => !n.tag && <div key={n.text} className={`tl-facts-line${n.warn ? " warn" : ""}`}>{n.text}</div>)}
    </div>
  );
}

const SEVERAL = t`Several subtitles have these words, and the game files don't show which one matches this recording. The Text tab lists them all and opens the most likely one`;

/** What an imported mod set on the Sound or MusicTrack that plays the slot, or on a container above it (core
    Project.settings, Session._setting_reach): builds include it, and Audiodiver has no control for it, so it is only
    listed. Make-Up Gain shows here only where the slot can't carry it (two sounds that play the clip, with different
    gains from the mod). */
/** Whether slots keep the volume curve on their clip, the line over the waveform: off, they play at an even level. */
function CurveSwitch({ sources }: { sources: string[] }) {
  const { project, actions } = useEditor();
  const off = sources.filter((s) => project?.curves_off.includes(s)).length;
  return (
    <section className="insp-sec">
      <label className="check">
        <input type="checkbox" checked={!off} ref={(el) => { if (el) el.indeterminate = off > 0 && off < sources.length; }}
          onChange={(e) => actions.keepCurve(sources, e.target.checked)} />
        <span><Trans>Keep the volume curve</Trans> <Help tip={t`The game changes the level of this clip as it plays, and new audio follows the same curve. Turn this off to play it at an even level`} page="volume#volume-curves" /></span>
      </label>
    </section>
  );
}

function ModSettings({ list }: { list: NonNullable<Slot["mod_settings"]> }) {
  const on = (x: (typeof list)[number]) => x.kind === "sound" ? t`this sound` : x.kind === "track" ? t`this music track`
    : t({ message: `container ${ph({ id: x.object })}`, comment: "Where an imported setting is: a container above the slot, by the container ID" });
  const value = (s: (typeof list)[number]["settings"][number]) => s.value.toLocaleString(intlLocale(),
    { maximumFractionDigits: 2, signDisplay: s.unit === "dB" || s.unit === "cents" ? "exceptZero" : "auto" }) + (s.unit ? ` ${s.unit}` : "");
  return (
    <section className="insp-sec facts mod-settings">
      <h3><Trans>Imported Settings</Trans> <Help tip={t`Set by the imported mod on this sound or on a container above it. Builds include them.`} page="importing-mods#what-comes-in" /></h3>
      <dl>
        {list.flatMap((x) => x.settings.map((s) => (
          <Fragment key={`${x.object}:${s.name}`}><dt>{s.name}</dt><dd>{s.text ?? value(s)} <span className="muted">· {on(x)}</span></dd></Fragment>
        )))}
      </dl>
    </section>
  );
}

/** The Library's right panel: what the selected slot is, or with none or several selected the open item, and its
    Global Note. The Library shows the game as it is, so a project's notes stay in the Audio tab. */
export function LibraryDetails() {
  const { cue, selected, shownItemId, itemIndex } = useEditor();
  const rows = useMemo(() => (cue ? rowsOf(cue.segments_detail) : []), [cue]);
  const sel = rows.filter((r) => selected.includes(r.slot.source));
  const item = shownItemId ? itemIndex.items.get(shownItemId) : undefined;
  if (sel.length === 1 && !sel[0].slot.absent) {
    const { slot, seg } = sel[0];
    const sub = slot.label && !seg.name.includes(slot.label) ? slot.label : null;
    return (
      <aside className="inspector" aria-label={t`Details`}>
        <div className="view-in" key={slot.source}>
          <div className="insp-title">
            <h2>{seg.name}{sub ? <span className="sub">{sub}</span> : null}</h2>
            <CopyId slot={slot} />
          </div>
          <NoteSection scope="global" k={noteKeys.clip(slot.source)} name={sub ? `${seg.name}, ${sub}` : seg.name} />
        </div>
      </aside>
    );
  }
  return (
    <aside className="inspector" aria-label={t`Details`}>
      {item && (
        <div className="insp-item view-in" key={item.id}>
          <div className="insp-title"><h2>{item.name}</h2></div>
          <NoteSection scope="global" k={noteKeys.item(item.id)} name={item.full} />
        </div>
      )}
      <div className="insp-empty"><p><Trans>Select a slot.</Trans></p></div>
    </aside>
  );
}

/** "exit at 1:23": where the next segment starts, in the facts about a segment. */
const exitAt = (ms: number) => {
  const time = fmtTime(ms);
  return t({ message: `exit at ${time}`, comment: "Where the next music segment starts: the Exit cue point" });
};

/** What Keep original duration does, on and off (SILENCE_TIP in CueView says the same of one slot). */
const keepTip = () =>
  t`On: plays nothing for the length of the original, so the timing doesn't change. Off: plays nothing, and the game moves straight on.`;

/** A voice line's subtitle, opened in the Text tab: the one it says, or, where several subtitles have its words
    and its length doesn't tell them apart, all of them (core: library.py `subtitle`, editor.py text_alike). */
function SubtitleLink({ slot, children }: { slot: Slot; children: ReactNode }) {
  const { cue } = useEditor();
  const text = useShownTabs().includes("text"); // the Text tab hidden: no way there
  const open = async () => {
    const id = Number(slot.subtitle);
    const ids = slot.subtitle_sure ? [id] : await call<number[]>("text_alike", { id }).catch(() => [id]);
    const lang = cue?.lang || undefined; // the voice's language: its subtitle in the same one
    const count = ids.length;
    showLines({ ids, pick: id, lang, note: count > 1
      ? lang && lang !== "us"
        ? plural(count, {
          one: "# subtitle has the English words of this voice line. The open one is the most likely match.",
          other: "# subtitles have the English words of this voice line. The open one is the most likely match.",
        })
        : plural(count, {
          one: "# subtitle has the words of this voice line. The open one is the most likely match.",
          other: "# subtitles have the words of this voice line. The open one is the most likely match.",
        })
      : t`The subtitle of this voice line.` });
  };
  if (!text) return null;
  return <button className="link-text" onClick={open} data-tip={slot.subtitle_sure ? t`Open the subtitle in the Text tab` : SEVERAL}>{children}</button>;
}

/** Content that settles in when it takes the place of other content (its key changed). `still` is read once, when it
    appears: true when the panel around it is new as well and settles in itself. */
function Settle({ still, children }: { still: boolean; children: ReactNode }) {
  const [cls] = useState(still ? undefined : "view-in");
  return <div className={cls}>{children}</div>;
}

function CopyId({ slot }: { slot: Slot }) {
  const [done, setDone] = useState(false);
  const { quick } = useEditor();
  const { id, what } = shownId(slot);
  const copy = async () => {
    try { await navigator.clipboard.writeText(id); setDone(true); setTimeout(() => setDone(false), 1200); }
    catch { quick(t`Couldn't copy to the clipboard`, "info"); }
  };
  return (
    <button className="id" data-tip={what === "stream" ? t`Copy the stream ID` : t`Copy the source ID`} onClick={copy}>
      {done ? t`Copied` : id}
    </button>
  );
}

/** The other places that play the slot's audio, grouped by where the Index has them ("Hive World": Exploring ·
    Ambient), banks the Index doesn't name under All Archives, and cues without a name folded behind their count.
    Each opens there with the slot selected. `also` is the full count, which can be more than the ids sent. */
function SharedWith({ slot, also }: { slot: Slot; also: number }) {
  const { itemIndex } = useEditor();
  const [cuesOpen, setCuesOpen] = useState(false);
  const { groups, cues } = useMemo(() => {
    const groups = new Map<string, { id: string; name: string }[]>(), cues: string[] = [];
    for (const id of slot.also_in) {
      const at = itemIndex.byCue.get(id);
      const bank = id.startsWith("bank:");
      if (!at && !bank) { cues.push(id); continue; }
      const group = at ? where(itemIndex, at.item).replace(/ ▸ [^▸]*$/, "") || t`Music` : t`All Archives`;
      const name = at ? `${at.item.name}${at.part.name && at.item.parts.length > 1 ? ` · ${at.part.name}` : ""}` : t`Bank ${ph({ id: id.slice(5) })}`;
      groups.set(group, [...groups.get(group) ?? [], { id, name }]);
    }
    return { groups: [...groups], cues };
  }, [slot.also_in, itemIndex]);
  const more = also - slot.also_in.length, count = cues.length;
  return (
    <div className="shared">
      <h3><Trans>Shared with <span className="shared-n">{also}</span></Trans>
        <Help tip={t`The game plays this audio in other places too.`} page="how-the-game-plays-music#shared-audio" /></h3>
      <dl className="shared-groups">
        {groups.map(([group, places]) => (
          <div key={group}>
            <dt>{group}</dt>
            <dd>{places.map((p) => <PlaceLink key={p.id} id={p.id} source={slot.source}>{p.name}</PlaceLink>)}</dd>
          </div>
        ))}
        {cues.length > 0 && (
          <div>
            <dt><Trans>Unnamed music</Trans></dt>
            <dd>
              <button className="link-text shared-fold" aria-expanded={cuesOpen} onClick={() => setCuesOpen(!cuesOpen)}>
                <span className="caret" aria-hidden>▸</span>{plural(count, { one: "# Cue", other: "# Cues" })}</button>
              {cuesOpen && cues.map((id) => <PlaceLink key={id} id={id} source={slot.source} mono>{id}</PlaceLink>)}
            </dd>
          </div>
        )}
      </dl>
      {more > 0 && <p className="muted small"><Trans>And {more} more.</Trans></p>}
    </div>
  );
}

/** Another place that plays the same audio: a piece of music or a sound set as the Index names it, else a bank or a
    cue, found in the Library (All Archives has every bank). It opens with the slot selected: in this tab when it can
    show it, else in the Library. */
function PlaceLink({ id, source, mono, children }: { id: string; source: string; mono?: boolean; children: ReactNode }) {
  const { itemIndex, show, openFound } = useEditor();
  const at = itemIndex.byCue.get(id);
  const open = async () => {
    if (at) return show(at.item.id, at.part.cue, source);
    const places = await call<Place[]>("find", { query: id.startsWith("bank:") ? id.slice(5) : id }).catch(() => []);
    if (places[0]) openFound("library", { ...places[0], source });
  };
  return <button className={`link${mono ? " mono" : ""}`} onClick={open}>{children}</button>;
}

const GAIN_MAX = 96; // dB either way, as the core takes it (project.GAIN_DB)
const fmtGain = (x: number) => fmtDecimal(x, 2, true); // the box reads a decimal comma back too (takeTyped)

/** The button after a Make-Up Gain or a level that sets it back to 0 dB: the level the game plays it at. A Sound's
    own gain in the game stays, since a slot's gain adds to it. `off`: at 0 already. */
export function ResetLevel({ off, onReset, more }: { off: boolean; onReset: () => void; more?: string }) {
  return (
    <button className="icon-btn level-reset" disabled={off} onClick={onReset} aria-label={t`Back to the original level`}
      data-tip={off ? t`At the original level` : t`Back to the original level`} data-tip-more={off ? undefined : more}><ResetIcon /></button>
  );
}

/** Make-Up Gain of one replaced slot or of several, or (`original`) of the original audio of slots without new audio;
    `value` is null while several differ (the box says Mixed and the slider rests at 0 until moved). `note` says which
    of the selected slots it sets, when not all. The waveforms and the player follow the slider as it moves (liveGain).
    `match`: a button that sets the gain that makes each new audio as loud as its original. `base`: the Make-Up Gain
    the game gives the one slot's Sound, which this adds to (0 too: it shows under the slider). */
function Gain({ sources, value, note, original, match, base }: {
  sources: string[]; value: number | null; note?: string; original?: boolean; match?: "one" | "each"; base?: number;
}) {
  const { actions } = useEditor();
  const [v, setV] = useState(value ?? 0);
  const [typed, setTyped] = useState<string | null>(null); // the value box while it is typed in
  const [moved, setMoved] = useState(false); // mixed values: the slider has been moved, so its value shows
  const [matching, setMatching] = useState(false);
  const escaped = useRef(false);
  const key = sources.join();
  useEffect(() => { setV(value ?? 0); setMoved(false); liveGain.clear(sources); }, [value, key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => liveGain.clear(sources), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const later = useRef(0);
  useEffect(() => () => clearTimeout(later.current), []);
  const move = (x: number) => { setV(x); setMoved(true); liveGain.set(sources, x); };
  const commit = (x: number, typedIn = false) => {
    clearTimeout(later.current);
    if (x === value || (value === null && !moved && !typedIn)) { liveGain.clear(sources); return; }
    if (original) actions.originalGain(sources, x);
    else if (sources.length === 1) actions.update(sources[0], { gain_db: x });
    else actions.updateMany(sources, { gain_db: x });
  };
  // arrow keys on the slider step it; the steps become one change (one undo) once the keys rest
  const commitSoon = (x: number) => { clearTimeout(later.current); later.current = window.setTimeout(() => commit(x), 600); };
  const takeTyped = () => {
    const x = Number(typed?.replace(",", ".").replace("−", "-"));
    setTyped(null);
    if (escaped.current) { escaped.current = false; return; } // Esc: as it was
    if (typed === null || typed.trim() === "" || !Number.isFinite(x)) return;
    const g = Math.round(Math.max(-GAIN_MAX, Math.min(GAIN_MAX, x)) * 2) / 2;
    move(g);
    commit(g, true);
  };
  const matchAll = async () => {
    setMatching(true);
    try { await actions.matchLoudness(sources); } finally { setMatching(false); }
  };
  const shown = value === null && !moved ? t({ message: "Mixed", comment: "The selected slots have different values" }) : fmtGain(v);
  const reset = () => { move(0); commit(0, true); };
  const gain = fmtGain(base ?? 0); // the Make-Up Gain the game gives the sound
  const kept = base ? t`The ${gain} dB the game gives this sound stays` : undefined;
  const help = original
    ? base ? t`The original, louder or quieter, without new audio or a change to the mix. Added to the ${gain} dB the game gives this sound.`
      : t`The original, louder or quieter, without new audio or a change to the mix.`
    : base ? t`Louder or quieter, without changing the file or the mix. Added to the ${gain} dB the game gives this sound.`
      : t`Louder or quieter, without changing the file or the mix.`;
  return (
    <section className="insp-sec">
      <h3><Trans>Make-Up Gain</Trans> <Help tip={help}
        page="volume#make-up-gain-per-slot" />
        <span className="val"><input className="gain-val" value={typed ?? shown} aria-label={t`Make-Up Gain in dB, typed`} inputMode="decimal"
          onFocus={(e) => { setTyped(value === null && !moved ? "" : fmtGain(v)); e.currentTarget.select(); }} onChange={(e) => setTyped(e.target.value)} onBlur={takeTyped}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); else if (e.key === "Escape") { escaped.current = true; e.currentTarget.blur(); } }}
          data-tip={t`Type a value from −${GAIN_MAX} to +${GAIN_MAX}`} /> dB
          <ResetLevel off={value === 0 && v === 0} onReset={reset} more={kept ?? (sources.length > 1 ? t`0 dB on every selected slot` : undefined)} /></span></h3>
      {note && <p className="muted small insp-note">{note}</p>}
      <input type="range" className="r-fader" style={rangeVars(v, -GAIN_MAX, GAIN_MAX, 0)} min={-GAIN_MAX} max={GAIN_MAX} step={0.5} value={v} aria-label={t`Make-Up Gain in dB`}
        onChange={(e) => move(Number(e.target.value))} onPointerUp={() => commit(v)}
        onKeyUp={(e) => { if (/^(Arrow|Home|End|Page)/.test(e.key)) commitSoon(v); }} onBlur={() => commit(v)}
        onKeyDown={(e) => { if (e.ctrlKey || e.metaKey || e.altKey) commit(v); }} /* a nudge on its way goes first: then Ctrl+Z undoes it */ />
      {base !== undefined && sources.length === 1 && (
        <p className="muted small" data-tip={t`The Make-Up Gain the game gives this take`} data-tip-more={t`The slider adds to it`}>
          {t`Default: ${gain} dB`}{v ? <> · {t`plays at ${fmtGain(base + v)} dB`}</> : null}</p>
      )}
      {match && (
        <p className="gain-match">
          <button className="link-text" disabled={matching} onClick={matchAll}
            data-tip={match === "one" ? t`The Make-Up Gain that makes the new audio as loud as the original`
              : t`Each slot gets the Make-Up Gain that makes the new audio as loud as the original`}
            data-tip-more={t`Short sounds by the loudest moment, longer ones by the whole`}>
            {matching ? t`Measuring` : match === "one" ? t`Match the Original Loudness` : t`Match Each to the Original Loudness`}</button>
        </p>
      )}
    </section>
  );
}

/** The labels of the cue point boxes, and what an empty box says (one segment or several). */
const entryLabel = () => t({ message: "Entry (ms)", comment: "The Entry cue point of a music segment, in milliseconds" });
const exitLabel = () => t({ message: "Exit (ms)", comment: "The Exit cue point of a music segment, in milliseconds" });
const autoText = () => t({ message: "auto", comment: "An empty cue point box: the point is worked out" });

/** A segment's cue points, and the same ones on the `more` other segments that play the slot's file. */
function Markers({ segment, gameEntry, gameExit, fit, lengthMs, source, more }: {
  segment: string; gameEntry: number | null; gameExit: number | null; fit: boolean; lengthMs: number | null;
  source: string; more: number;
}) {
  const { project, actions } = useEditor();
  const o = project?.segment_overrides[segment] ?? {};
  const [open, setOpen] = useState(Object.keys(o).length > 0);
  const [entry, setEntry] = useState(o.entry_marker?.toString() ?? "");
  const [exit, setExit] = useState(o.exit_marker?.toString() ?? "");
  const entryBox = useRef<HTMLInputElement>(null), exitBox = useRef<HTMLInputElement>(null);
  // each box follows the project (an undo, a drag on the waveform) on its own, and not while it is typed in
  useEffect(() => { if (document.activeElement !== entryBox.current) setEntry(o.entry_marker?.toString() ?? ""); }, [o.entry_marker]);
  useEffect(() => { if (document.activeElement !== exitBox.current) setExit(o.exit_marker?.toString() ?? ""); }, [o.exit_marker]);
  const num = (t: string) => (t.trim() === "" ? null : Number(t));
  const e1 = num(entry), e2 = num(exit);
  // the points that apply while a box is empty: the new audio's start and end with Fit timing, else the original's
  const autoEntry = fit ? 0 : gameEntry ?? 0;
  const autoExit = fit ? lengthMs : gameExit;
  const end = lengthMs ?? Infinity;
  const problem = [e1, e2].some((x) => x !== null && (!Number.isFinite(x) || x < 0)) ? t`Cue points are milliseconds from 0.`
    : (e1 ?? autoEntry) >= (e2 ?? autoExit ?? Infinity) ? t`Entry comes before Exit.`
    : Math.max(e1 ?? 0, e2 ?? 0) > end ? t`The new audio is ${ph({ length: Math.round(end) })} ms long.` : null;
  const save = async () => {
    if (problem) return;
    if (e1 === (o.entry_marker ?? null) && e2 === (o.exit_marker ?? null)) return; // as they were: no change
    await actions.segmentOverride(segment, e1, e2);
  };
  // what was just typed goes in first (the click comes before the box's own save is back)
  const spread = async () => { await save(); actions.sameCuePoints(segment, source); };
  const auto = (x: number | null | undefined) => {
    if (x == null) return autoText();
    const ms = Math.round(x);
    return fit ? t({ message: `${ms} (fitted)`, comment: "An empty cue point box: the point it stands for, in ms, fitted to the new audio" })
      : t({ message: `${ms} (original)`, comment: "An empty cue point box: the point it stands for, in ms, from the original" });
  };
  return (
    <details className="insp-sec" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary><Trans>Cue points</Trans> <Help tip={t`Entry is where the segment counts as started. Exit is where the next segment starts.`} page="timing-and-loops#entry-and-exit" /></summary>
      <div className="markers">
        <label>{entryLabel()}<input ref={entryBox} type="number" min={0} value={entry} placeholder={auto(autoEntry)}
          onChange={(e) => setEntry(e.target.value)} onBlur={save} aria-invalid={!!problem || undefined} /></label>
        <label>{exitLabel()}<input ref={exitBox} type="number" min={0} value={exit} placeholder={auto(autoExit)}
          onChange={(e) => setExit(e.target.value)} onBlur={save} aria-invalid={!!problem || undefined} /></label>
      </div>
      {problem && <small className="bad" role="alert">{problem}</small>}
      {more > 0 && !problem && (
        <p className="markers-more">
          <button className="link-text" onClick={spread} data-tip={e1 === null && e2 === null
            ? t`The other segments go back to automatic cue points` : t`The other segments get these cue points`}>
            {plural(more, { one: "Apply to # More Segment with This File", other: "Apply to # More Segments with This File" })}</button>
        </p>
      )}
    </details>
  );
}

/** Several slots selected: what can replace them all, as a column of buttons with an icon each (the order of the
    one-slot view: what replaces it first, then the settings), Make-Up Gain of the replaced ones, the timing of the
    silent ones, and Remove apart at the end. `usable`: the ones the game plays and nobody marked do-not-touch. */
function Bulk({ rows, sources, usable }: { rows: Row[]; sources: string[]; usable: string[] }) {
  const { project, actions } = useEditor();
  const a = project?.assignments ?? {};
  const mine = sources.filter((s) => a[s]);
  const files = mine.filter((s) => !a[s].silence), silent = mine.filter((s) => a[s].silence);
  const plain = usable.filter((s) => !a[s]), kept = project?.gains ?? {}; // the originals: their Make-Up Gain
  const cued = rows.filter((r) => r.seg.segment && a[r.slot.source] && !a[r.slot.source].silence); // music with new audio
  const toSilence = usable.filter((s) => !a[s]?.silence);
  const curved = rows.filter((r) => r.slot.curve && usable.includes(r.slot.source)).map((r) => r.slot.source);
  // the counts the messages below give
  const count = sources.length, fillable = usable.length, silenceable = toSilence.length, withNew = files.length,
    withOriginal = plain.length, silenced = silent.length, replaced = mine.length;
  return (
    <aside className="inspector" aria-label={t`Details`}>
      <div className="insp-title"><h2>{plural(count, { one: "# slot selected", other: "# slots selected" })}</h2></div>
      <section className="insp-sec insp-actions">
        <button className="btn" disabled={!usable.length} data-tip={plural(fillable, { one: "The same file in all # slot", other: "The same file in all # slots" })}
          onClick={async () => { const f = (await pickAudio(false))?.[0]; if (f) actions.assignAll(usable, f); }}><FillIcon /><Trans>Choose One File for All</Trans></button>
        <button className="btn" disabled={!usable.length} data-tip={t`A file for each slot, in list order and file-name order`}
          onClick={async () => { const f = await pickAudio(true); if (f) actions.fillSources(usable, f, plural(fillable, { one: "# slot", other: "# slots" })); }}><FillPieceIcon /><Trans>Choose Files</Trans></button>
        <button className="btn" disabled={!toSilence.length} onClick={() => actions.silence(toSilence, true)} data-tip-cmd="silence"
          data-tip={toSilence.length ? t`Play nothing in these slots` : usable.length ? t`Already silent` : t`Never played, or do not touch`}>
          <SilenceIcon />{toSilence.length > 0 && toSilence.length < sources.length
            ? plural(silenceable, { one: "Replace # Slot with Silence", other: "Replace # Slots with Silence" }) : t`Replace with Silence`}</button>
      </section>
      {files.length > 0 ? (
        <Gain sources={files} value={files.every((s) => a[s].gain_db === a[files[0]].gain_db) ? a[files[0]].gain_db : null}
          note={files.length < sources.length ? plural(withNew, { one: "Applies to the # slot with new audio.", other: "Applies to the # slots with new audio." }) : undefined} match="each" />
      ) : project && plain.length > 0 && (
        <Gain original sources={plain} value={plain.every((s) => (kept[s] ?? 0) === (kept[plain[0]] ?? 0)) ? kept[plain[0]] ?? 0 : null}
          note={plain.length < sources.length ? plural(withOriginal, {
            one: "Applies to the # slot with the original audio.", other: "Applies to the # slots with the original audio.",
          }) : undefined} />
      )}
      {project && curved.length > 0 && <CurveSwitch sources={curved} />}
      {cued.length > 0 && <BulkMarkers rows={cued} partial={cued.length < sources.length} />}
      {silent.length > 0 && (
        <section className="insp-sec">
          <h3>{plural(silenced, { one: "Silence in # slot", other: "Silence in # slots" })}</h3>
          <label className="check">
            <input type="checkbox" checked={silent.every((s) => !a[s].fit_timing)}
              ref={(el) => { if (el) el.indeterminate = silent.some((s) => !a[s].fit_timing) && silent.some((s) => a[s].fit_timing); }}
              onChange={(e) => actions.updateMany(silent, { fit_timing: !e.target.checked })} />
            <span><Trans>Keep original duration</Trans> <Help tip={keepTip()} page="how-the-game-plays-music#silence" /></span>
          </label>
        </section>
      )}
      {mine.length > 0 ? (
        <section className="insp-sec insp-actions">
          <button className="btn quiet" onClick={() => actions.unassign(mine)}>
            <ClearIcon />{silent.length === mine.length
              ? plural(replaced, { one: "Remove the Silence from # Slot", other: "Remove the Silence from # Slots" })
              : plural(replaced, { one: "Remove the New Audio from # Slot", other: "Remove the New Audio from # Slots" })}</button>
        </section>
      ) : <p className="insp-empty insp-sec"><Trans>None of these is replaced yet.</Trans></p>}
    </aside>
  );
}

type CueKey = "entry_marker" | "exit_marker";
/** Cue points for the segments of several selected slots with new audio. A box with a value shows what all of them
    have: changed, the value goes on all of them, and emptied, comes off all of them. An empty box over values that
    differ (Mixed) leaves each segment as it is. */
function BulkMarkers({ rows, partial }: { rows: Row[]; partial: boolean }) {
  const { project, actions } = useEditor();
  const segments = useMemo(() => [...new Set(rows.map((r) => r.seg.segment))], [rows]);
  const over = project?.segment_overrides ?? {};
  const shared = (k: CueKey) => { // undefined: the segments differ; null: none has one
    const vals = new Set(segments.map((s) => over[s]?.[k] ?? null));
    return vals.size === 1 ? [...vals][0] : undefined;
  };
  const was = { entry_marker: shared("entry_marker"), exit_marker: shared("exit_marker") };
  const text = (v: number | null | undefined) => (v == null ? "" : String(v));
  const [entry, setEntry] = useState(text(was.entry_marker));
  const [exit, setExit] = useState(text(was.exit_marker));
  const entryBox = useRef<HTMLInputElement>(null), exitBox = useRef<HTMLInputElement>(null);
  useEffect(() => { if (document.activeElement !== entryBox.current) setEntry(text(was.entry_marker)); }, [was.entry_marker]);
  useEffect(() => { if (document.activeElement !== exitBox.current) setExit(text(was.exit_marker)); }, [was.exit_marker]);
  const num = (t: string) => (t.trim() === "" ? null : Number(t));
  const e1 = num(entry), e2 = num(exit);
  const shortest = Math.min(...rows.map((r) => project?.assignments[r.slot.source]?.duration_ms ?? Infinity));
  const problem = [e1, e2].some((x) => x !== null && (!Number.isFinite(x) || x < 0)) ? t`Cue points are milliseconds from 0.`
    : e1 !== null && e2 !== null && e1 >= e2 ? t`Entry comes before Exit.`
    : Math.max(e1 ?? 0, e2 ?? 0) > shortest ? t`The shortest new audio is ${ph({ length: Math.round(shortest) })} ms long.` : null;
  const save = (k: CueKey, v: number | null) => {
    if (problem || v === was[k] || (v === null && was[k] === undefined)) return; // as it was, or empty over Mixed
    actions.segmentOverrides(segments, { [k]: v });
  };
  const hint = (v: number | null | undefined) => (v === undefined ? t({ message: "Mixed", comment: "The selected slots have different values" }) : autoText());
  const n = segments.length;
  return (
    <section className="insp-sec">
      <h3>{plural(n, { one: "Cue points in # segment", other: "Cue points in # segments" })} <Help tip={t`Entry is where the segment counts as started. Exit is where the next segment starts.`} page="timing-and-loops#entry-and-exit" /></h3>
      {partial && <p className="muted small insp-note"><Trans>Applies to the slots with new audio.</Trans></p>}
      <div className="markers">
        <label>{entryLabel()}<input ref={entryBox} type="number" min={0} value={entry} placeholder={hint(was.entry_marker)}
          onChange={(e) => setEntry(e.target.value)} onBlur={() => save("entry_marker", e1)} aria-invalid={!!problem || undefined} /></label>
        <label>{exitLabel()}<input ref={exitBox} type="number" min={0} value={exit} placeholder={hint(was.exit_marker)}
          onChange={(e) => setExit(e.target.value)} onBlur={() => save("exit_marker", e2)} aria-invalid={!!problem || undefined} /></label>
      </div>
      {problem && <small className="bad" role="alert">{problem}</small>}
      {segments.some((s) => over[s]) && (
        <p className="markers-more">
          <button className="link-text" onClick={() => actions.segmentOverrides(segments, { entry_marker: null, exit_marker: null })}>
            <Trans>Reset Cue Points</Trans></button>
        </p>
      )}
    </section>
  );
}
