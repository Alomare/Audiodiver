import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { call, fmtTime, isMusic, shownId, type Assignment, type Place, type Slot } from "./api";
import { rowsOf, SILENCE_TIP, type Row } from "./CueView";
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
    the original where nothing does, and says where else it plays. The Library has no such panel: SlotFacts says what
    a slot is, over its waveform. */
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
    <aside className="inspector" aria-label="Details">
      <div className="view-in" key={slot.source}>
      <div className="insp-title">
        <h2>{seg.name}{sub ? <span className="sub">{sub}</span> : null}</h2>
        <CopyId slot={slot} />
      </div>
      {slot.locked && <p className="warn-box">Do not touch. Replacing this clip makes the music stutter. <Help tip="Tags on a slot" page="reading-the-screen#tags-on-a-row" /></p>}
      {slot.absent && <p className="info-box">This clip isn't in the installed game files, so there is nothing to play or replace.</p>}
      {slot.unused && <p className="info-box">The game never plays this clip.</p>}
      {seg.added === "layer" ? <p className="info-box">A new layer. It plays whenever the sound above it plays.</p>
        : slot.added && <p className="info-box">A new take. The game picks it like the other takes.</p>}
      <ClipNotes slot={slot} a={a} />

      <Settle key={a?.silence ? "silence" : a ? "file" : "none"} still={shown.current !== slot.source}>
        <Replacement slot={slot} a={a} music={isMusic(cue)} what={seg.name} />
        {a && (slot.was || (!slot.added && slot.object && ((slot.players ?? 1) > 1 || (slot.sound_banks ?? 0) < (slot.banks ?? 0)))) &&
          <Reach slot={slot} />}
        {a && !a.silence && <Gain sources={[slot.source]} value={a.gain_db} match={slot.added ? undefined : "one"} base={slot.game_gain} />}
        {!a && project && usable && <Gain original sources={[slot.source]} value={project.gains[slot.source] ?? 0} base={slot.game_gain} />}
        {a && !a.silence && seg.segment && (
          <section className="insp-sec">
            <label className="check">
              <input type="checkbox" checked={a.fit_timing} onChange={(e) => actions.update(slot.source, { fit_timing: e.target.checked })} />
              <span>Fit timing to the new audio <Help tip="When this is on, the next segment starts when the new audio ends. When it is off, the original timing applies." page="timing-and-loops#fitting-the-timing-to-the-new-audio" /></span>
            </label>
          </section>
        )}
        {a && !a.silence && seg.segment && <Markers segment={seg.segment} gameEntry={seg.entry_ms} gameExit={seg.exit_ms}
          fit={a.fit_timing} lengthMs={a.duration_ms} source={slot.source} more={(a.file_segments ?? 1) - 1} />}
      </Settle>

      {also > 0 && <section className="insp-sec"><SharedWith slot={slot} also={also} /></section>}
      <section className="insp-sec facts">
        <dl>
          <dt>Original</dt><dd>{slot.duration_ms || seg.duration_ms ? fmtTime(slot.duration_ms || seg.duration_ms) : "–"}</dd>
          {seg.segment && <><dt>Segment <Help tip="A stretch of music that plays as a unit. The next segment starts at the Exit" page="how-the-game-plays-music#segments-and-slots" /></dt>
            <dd>{fmtTime(seg.duration_ms)}{seg.exit_ms != null && <> · <span data-tip="The next segment starts here">exit at {fmtTime(seg.exit_ms)}</span></>}</dd></>}
          {slot.variant && <><dt>Variant <Help tip="This slot plays only under a condition, such as a biome. Give each variant new audio to change the piece everywhere" page="how-the-game-plays-music#variants" /></dt>
            <dd>{slot.variant}</dd></>}
          {cue.language && <><dt>Language</dt><dd>{cue.language}</dd></>}
          {slot.subtitle && text && <><dt>Subtitle</dt><dd><SubtitleLink slot={slot}>Open</SubtitleLink>{!slot.subtitle_sure &&
            <span className="muted" data-tip={SEVERAL}> · one of several</span>}</dd></>}
        </dl>
      </section>
      {!slot.absent && <NoteSection k={noteKeys.clip(slot.source)} name={sub ? `${seg.name}, ${sub}` : seg.name} />}
      </div>
    </aside>
  );
}

/** Nothing selected: the open item's note, and what the keys do, with the keys they are on now. */
function Empty() {
  const { shownItemId, itemIndex } = useEditor();
  const item = shownItemId ? itemIndex.items.get(shownItemId) : undefined;
  return (
    <aside className="inspector" aria-label="Details">
      {item && (
        <div className="insp-item view-in" key={item.id}>
          <div className="insp-title"><h2>{item.name}</h2></div>
          <NoteSection k={noteKeys.item(item.id)} name={item.full} />
        </div>
      )}
      <div className="insp-empty">
        <p>Select a slot.</p>
        <dl className="key-hints">
          {hint(["selectPrev", "selectNext"], "select")}
          {hint(["playPause"], "play or pause")}
          {hint(["playGame", "playMine"], "original / new audio")}
          {hint(["chooseFile"], "choose a file")}
          {hint(["moveUp", "moveDown"], "move the new audio")}
          {hint(["copy", "paste"], "copy / paste")}
          {hint(["remove"], "remove")}
          {hint(["undo"], "undo")}
        </dl>
        <p className="keys">
          <button className="link-text" onClick={() => nav.go("settings", "shortcuts")}>All Shortcuts</button>
          {" · "}<WikiLink page="reading-the-screen" about="What the Audio tab shows">Reading the screen</WikiLink>
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
        <h3>Silence <Help tip="Silence plays nothing in place of the original." page="how-the-game-plays-music#silence" /></h3>
        <label className="check">
          <input type="checkbox" checked={!a.fit_timing} onChange={(e) => actions.update(slot.source, { fit_timing: !e.target.checked })} />
          <span>Keep original duration <Help tip={`On: ${SILENCE_TIP.keep.toLowerCase()}. Off: ${SILENCE_TIP.move.toLowerCase()}.`} page="how-the-game-plays-music#silence" /></span>
        </label>
        {!music && <p className="muted small">Audiodiver also removes it from the mix. <Help tip="A silenced sound no longer turns down the sounds around it." page="volume#the-game-s-hdr-mix" /></p>}
      </section>
    );
  }
  if (a) {
    return (
      <section className="insp-sec">
        <h3>New audio</h3>
        <div className="replaced-with">
          <span className={`file${a.exists ? "" : " missing"}`} data-tip={a.audio} data-tip-clip>{a.exists ? a.name : `Missing: ${a.name}`}</span>
          {a.duration_ms != null && <span className="len">{fmtTime(a.duration_ms)}</span>}
          <button className="icon-btn" aria-label="Show in folder" data-tip="Show in folder" disabled={!a.exists}
            onClick={() => reveal(fullPath(project!.folder, a.audio))}><FolderIcon /></button>
        </div>
      </section>
    );
  }
  const usable = !slot.unused && !slot.locked && !slot.absent;
  const choose = keyLabel("chooseFile");
  return (
    <section className="insp-sec">
      <h3>Not replaced</h3>
      {usable && <p className="muted small">Drop audio on the slot{choose ? `, or press ${choose} to choose a file` : ""}.</p>}
      <div className="row-btns">
        <button className="btn" disabled={!usable} onClick={() => actions.silence([slot.source], true, what)} data-tip-cmd="silence"
          data-tip="Play nothing here instead of the original">Use Silence</button>
      </div>
    </section>
  );
}

/** Where the new audio plays, for a bank's sound whose clip other sounds play too: in every sound that plays the
    clip, as any replacement does, or only in this sound (a clip of its own). The count is of banks, this one too. */
function Reach({ slot }: { slot: Slot }) {
  const { actions } = useEditor();
  const own = !!slot.was;
  const banks = (others: number) => `${others + 1} bank${others ? "s" : ""}`;
  const choices = [
    [false, "Every Sound That Plays It", own ? "Every sound that plays this clip gets the new audio"
      : `Changes it in ${banks(slot.banks ?? 0)}`],
    [true, "Only This Sound", `Changes it in ${banks(own ? slot.banks ?? 0 : slot.sound_banks ?? 0)}. Other sounds that play the clip keep the original.`],
  ] as const;
  return (
    <section className="insp-sec">
      <h3>Scope <Help tip="Several sounds can play the same clip. Choose whether the new audio plays in all of them or only in this one." page="adding-audio#only-this-sound" /></h3>
      <div className="cards one" role="radiogroup" aria-label="Scope">
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
  return (
    <>
      {(slot.notes ?? []).map((n) => <p key={n.text} className={n.warn ? "warn-box" : "info-box"}>{n.text}</p>)}
      {short && <p className="warn-box">The new audio is {fmtTime(a?.duration_ms)} long, and this slot needs at least {fmtTime(slot.min_ms)}.</p>}
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
        {seg.segment && seg.exit_ms != null && <span data-tip="The next segment starts here">exit at {fmtTime(seg.exit_ms)}</span>}
        {slot.variant && <span>plays when {slot.variant}</span>}
        {cue?.language && <span>{cue.language}</span>}
        {slot.locked && <span className="warn" data-tip="Replacing it makes the music stutter">do not touch</span>}
        {slot.unused && <span data-tip="The game never plays this clip">never heard</span>}
        {slot.absent && <span data-tip="Not in the installed game files">no audio</span>}
        {slot.subtitle && <SubtitleLink slot={slot}>{slot.subtitle_sure ? "subtitle" : "subtitle: one of several"}</SubtitleLink>}
        {(slot.notes ?? []).map((n) => n.tag && <span key={n.tag} className={n.warn ? "warn" : undefined} data-tip={n.text}>{n.tag}</span>)}
      </div>
      {also > 0 && <SharedWith slot={slot} also={also} />}
      {(slot.notes ?? []).map((n) => !n.tag && <div key={n.text} className={`tl-facts-line${n.warn ? " warn" : ""}`}>{n.text}</div>)}
    </div>
  );
}

const SEVERAL = "Several subtitles have these words, and the game files don't show which one matches this recording. The Text tab lists them all and opens the most likely one";

/** A voice line's subtitle, opened in the Text tab: the one it says, or, where several subtitles have its words
    and its length doesn't tell them apart, all of them (core: library.py `subtitle`, editor.py text_alike). */
function SubtitleLink({ slot, children }: { slot: Slot; children: ReactNode }) {
  const { cue } = useEditor();
  const text = useShownTabs().includes("text"); // the Text tab hidden: no way there
  const open = async () => {
    const id = Number(slot.subtitle);
    const ids = slot.subtitle_sure ? [id] : await call<number[]>("text_alike", { id }).catch(() => [id]);
    const lang = cue?.lang || undefined; // the voice's language: its subtitle in the same one
    showLines({ ids, pick: id, lang, note: ids.length > 1
      ? `${ids.length} subtitles have the ${lang && lang !== "us" ? "English " : ""}words of this voice line. The open one is the most likely match.`
      : "The subtitle of this voice line." });
  };
  if (!text) return null;
  return <button className="link-text" onClick={open} data-tip={slot.subtitle_sure ? "Open the subtitle in the Text tab" : SEVERAL}>{children}</button>;
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
    catch { quick("Couldn't copy to the clipboard", "info"); }
  };
  return (
    <button className="id" data-tip={`Copy the ${what} ID`} onClick={copy}>
      {done ? "Copied" : id}
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
      const group = at ? where(itemIndex, at.item).replace(/ ▸ [^▸]*$/, "") || "Music" : "All Archives";
      const name = at ? `${at.item.name}${at.part.name && at.item.parts.length > 1 ? ` · ${at.part.name}` : ""}` : `Bank ${id.slice(5)}`;
      groups.set(group, [...groups.get(group) ?? [], { id, name }]);
    }
    return { groups: [...groups], cues };
  }, [slot.also_in, itemIndex]);
  const more = also - slot.also_in.length;
  return (
    <div className="shared">
      <h3>Shared with <span className="shared-n">{also}</span>
        <Help tip="The game plays this audio in other places too." page="how-the-game-plays-music#shared-audio" /></h3>
      <dl className="shared-groups">
        {groups.map(([group, places]) => (
          <div key={group}>
            <dt>{group}</dt>
            <dd>{places.map((p) => <PlaceLink key={p.id} id={p.id} source={slot.source}>{p.name}</PlaceLink>)}</dd>
          </div>
        ))}
        {cues.length > 0 && (
          <div>
            <dt>Unnamed music</dt>
            <dd>
              <button className="link-text shared-fold" aria-expanded={cuesOpen} onClick={() => setCuesOpen(!cuesOpen)}>
                <span className="caret" aria-hidden>▸</span>{cues.length} Cue{cues.length === 1 ? "" : "s"}</button>
              {cuesOpen && cues.map((id) => <PlaceLink key={id} id={id} source={slot.source} mono>{id}</PlaceLink>)}
            </dd>
          </div>
        )}
      </dl>
      {more > 0 && <p className="muted small">And {more} more.</p>}
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
const fmtGain = (x: number) => `${x > 0 ? "+" : ""}${x}`;

/** The button after a Make-Up Gain or a level that sets it back to 0 dB: the level the game plays it at. A Sound's
    own gain in the game stays, since a slot's gain adds to it. `off`: at 0 already. */
export function ResetLevel({ off, onReset, more }: { off: boolean; onReset: () => void; more?: string }) {
  return (
    <button className="icon-btn level-reset" disabled={off} onClick={onReset} aria-label="Back to the original level"
      data-tip={off ? "At the original level" : "Back to the original level"} data-tip-more={off ? undefined : more}><ResetIcon /></button>
  );
}

/** Make-Up Gain of one replaced slot or of several, or (`original`) of the original audio of slots without new audio;
    `value` is null while several differ (the box says Mixed and the slider rests at 0 until moved). `note` says which
    of the selected slots it sets, when not all. The waveforms and the player follow the slider as it moves (liveGain).
    `match`: a button that sets the gain that makes each new audio as loud as its original. `base`: the Make-Up Gain
    the game gives the one slot's Sound, which this adds to. */
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
  const shown = value === null && !moved ? "Mixed" : fmtGain(v);
  const reset = () => { move(0); commit(0, true); };
  const kept = base ? `The ${fmtGain(base)} dB the game gives this sound stays` : undefined;
  return (
    <section className="insp-sec">
      <h3>Make-Up Gain <Help tip={(original ? "The original, louder or quieter, without new audio or a change to the mix."
        : "Louder or quieter, without changing the file or the mix.") + (base ? ` Added to the ${fmtGain(base)} dB the game gives this sound.` : "")}
        page="volume#make-up-gain-per-slot" />
        <span className="val"><input className="gain-val" value={typed ?? shown} aria-label="Make-Up Gain in dB, typed" inputMode="decimal"
          onFocus={(e) => { setTyped(value === null && !moved ? "" : fmtGain(v)); e.currentTarget.select(); }} onChange={(e) => setTyped(e.target.value)} onBlur={takeTyped}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); else if (e.key === "Escape") { escaped.current = true; e.currentTarget.blur(); } }}
          data-tip={`Type a value from −${GAIN_MAX} to +${GAIN_MAX}`} /> dB
          <ResetLevel off={value === 0 && v === 0} onReset={reset} more={kept ?? (sources.length > 1 ? "0 dB on every selected slot" : undefined)} /></span></h3>
      {note && <p className="muted small insp-note">{note}</p>}
      <input type="range" className="r-fader" style={rangeVars(v, -GAIN_MAX, GAIN_MAX, 0)} min={-GAIN_MAX} max={GAIN_MAX} step={0.5} value={v} aria-label="Make-Up Gain in dB"
        onChange={(e) => move(Number(e.target.value))} onPointerUp={() => commit(v)}
        onKeyUp={(e) => { if (/^(Arrow|Home|End|Page)/.test(e.key)) commitSoon(v); }} onBlur={() => commit(v)}
        onKeyDown={(e) => { if (e.ctrlKey || e.metaKey || e.altKey) commit(v); }} /* a nudge on its way goes first: then Ctrl+Z undoes it */ />
      {match && (
        <p className="gain-match">
          <button className="link-text" disabled={matching} onClick={matchAll}
            data-tip={match === "one" ? "The Make-Up Gain that makes the new audio as loud as the original"
              : "Each slot gets the Make-Up Gain that makes the new audio as loud as the original"}
            data-tip-more="Short sounds by the loudest moment, longer ones by the whole">
            {matching ? "Measuring" : match === "one" ? "Match the Original Loudness" : "Match Each to the Original Loudness"}</button>
        </p>
      )}
    </section>
  );
}

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
  const problem = [e1, e2].some((x) => x !== null && (!Number.isFinite(x) || x < 0)) ? "Cue points are milliseconds from 0."
    : (e1 ?? autoEntry) >= (e2 ?? autoExit ?? Infinity) ? "Entry comes before Exit."
    : Math.max(e1 ?? 0, e2 ?? 0) > end ? `The new audio is ${Math.round(end)} ms long.` : null;
  const save = async () => {
    if (problem) return;
    if (e1 === (o.entry_marker ?? null) && e2 === (o.exit_marker ?? null)) return; // as they were: no change
    await actions.segmentOverride(segment, e1, e2);
  };
  // what was just typed goes in first (the click comes before the box's own save is back)
  const spread = async () => { await save(); actions.sameCuePoints(segment, source); };
  const auto = (x: number | null | undefined) => (x == null ? "auto" : `${Math.round(x)} (${fit ? "fitted" : "original"})`);
  return (
    <details className="insp-sec" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary>Cue points <Help tip="Entry is where the segment counts as started. Exit is where the next segment starts." page="timing-and-loops#entry-and-exit" /></summary>
      <div className="markers">
        <label>Entry (ms)<input ref={entryBox} type="number" min={0} value={entry} placeholder={auto(autoEntry)}
          onChange={(e) => setEntry(e.target.value)} onBlur={save} aria-invalid={!!problem || undefined} /></label>
        <label>Exit (ms)<input ref={exitBox} type="number" min={0} value={exit} placeholder={auto(autoExit)}
          onChange={(e) => setExit(e.target.value)} onBlur={save} aria-invalid={!!problem || undefined} /></label>
      </div>
      {problem && <small className="bad" role="alert">{problem}</small>}
      {more > 0 && !problem && (
        <p className="markers-more">
          <button className="link-text" onClick={spread} data-tip={e1 === null && e2 === null
            ? "The other segments go back to automatic cue points" : "The other segments get these cue points"}>
            Apply to {more} More Segment{more === 1 ? "" : "s"} with This File</button>
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
  const slots = (n: number, title = false) => `${n} ${title ? "Slot" : "slot"}${n === 1 ? "" : "s"}`;
  return (
    <aside className="inspector" aria-label="Details">
      <div className="insp-title"><h2>{sources.length} slots selected</h2></div>
      <section className="insp-sec insp-actions">
        <button className="btn" disabled={!usable.length} data-tip={`The same file in all ${slots(usable.length)}`}
          onClick={async () => { const f = (await pickAudio(false))?.[0]; if (f) actions.assignAll(usable, f); }}><FillIcon />Choose One File for All</button>
        <button className="btn" disabled={!usable.length} data-tip="A file for each slot, in list order and file-name order"
          onClick={async () => { const f = await pickAudio(true); if (f) actions.fillSources(usable, f, slots(usable.length)); }}><FillPieceIcon />Choose Files</button>
        <button className="btn" disabled={!toSilence.length} onClick={() => actions.silence(toSilence, true)} data-tip-cmd="silence"
          data-tip={toSilence.length ? "Play nothing in these slots" : usable.length ? "Already silent" : "Never played, or do not touch"}>
          <SilenceIcon />Replace {toSilence.length > 0 && toSilence.length < sources.length ? `${slots(toSilence.length, true)} ` : ""}with Silence</button>
      </section>
      {files.length > 0 ? (
        <Gain sources={files} value={files.every((s) => a[s].gain_db === a[files[0]].gain_db) ? a[files[0]].gain_db : null}
          note={files.length < sources.length ? `Applies to the ${slots(files.length)} with new audio.` : undefined} match="each" />
      ) : project && plain.length > 0 && (
        <Gain original sources={plain} value={plain.every((s) => (kept[s] ?? 0) === (kept[plain[0]] ?? 0)) ? kept[plain[0]] ?? 0 : null}
          note={plain.length < sources.length ? `Applies to the ${slots(plain.length)} with the original audio.` : undefined} />
      )}
      {cued.length > 0 && <BulkMarkers rows={cued} partial={cued.length < sources.length} />}
      {silent.length > 0 && (
        <section className="insp-sec">
          <h3>Silence in {slots(silent.length)}</h3>
          <label className="check">
            <input type="checkbox" checked={silent.every((s) => !a[s].fit_timing)}
              ref={(el) => { if (el) el.indeterminate = silent.some((s) => !a[s].fit_timing) && silent.some((s) => a[s].fit_timing); }}
              onChange={(e) => actions.updateMany(silent, { fit_timing: !e.target.checked })} />
            <span>Keep original duration <Help tip={`On: ${SILENCE_TIP.keep.toLowerCase()}. Off: ${SILENCE_TIP.move.toLowerCase()}.`} page="how-the-game-plays-music#silence" /></span>
          </label>
        </section>
      )}
      {mine.length > 0 ? (
        <section className="insp-sec insp-actions">
          <button className="btn quiet" onClick={() => actions.unassign(mine)}>
            <ClearIcon />Remove {silent.length === mine.length ? "the Silence" : "the New Audio"} from {slots(mine.length, true)}</button>
        </section>
      ) : <p className="insp-empty insp-sec">None of these is replaced yet.</p>}
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
  const problem = [e1, e2].some((x) => x !== null && (!Number.isFinite(x) || x < 0)) ? "Cue points are milliseconds from 0."
    : e1 !== null && e2 !== null && e1 >= e2 ? "Entry comes before Exit."
    : Math.max(e1 ?? 0, e2 ?? 0) > shortest ? `The shortest new audio is ${Math.round(shortest)} ms long.` : null;
  const save = (k: CueKey, v: number | null) => {
    if (problem || v === was[k] || (v === null && was[k] === undefined)) return; // as it was, or empty over Mixed
    actions.segmentOverrides(segments, { [k]: v });
  };
  const hint = (v: number | null | undefined) => (v === undefined ? "Mixed" : "auto");
  const n = segments.length;
  return (
    <section className="insp-sec">
      <h3>Cue points in {n} segment{n === 1 ? "" : "s"} <Help tip="Entry is where the segment counts as started. Exit is where the next segment starts." page="timing-and-loops#entry-and-exit" /></h3>
      {partial && <p className="muted small insp-note">Applies to the slots with new audio.</p>}
      <div className="markers">
        <label>Entry (ms)<input ref={entryBox} type="number" min={0} value={entry} placeholder={hint(was.entry_marker)}
          onChange={(e) => setEntry(e.target.value)} onBlur={() => save("entry_marker", e1)} aria-invalid={!!problem || undefined} /></label>
        <label>Exit (ms)<input ref={exitBox} type="number" min={0} value={exit} placeholder={hint(was.exit_marker)}
          onChange={(e) => setExit(e.target.value)} onBlur={() => save("exit_marker", e2)} aria-invalid={!!problem || undefined} /></label>
      </div>
      {problem && <small className="bad" role="alert">{problem}</small>}
      {segments.some((s) => over[s]) && (
        <p className="markers-more">
          <button className="link-text" onClick={() => actions.segmentOverrides(segments, { entry_marker: null, exit_marker: null })}>
            Reset Cue Points</button>
        </p>
      )}
    </section>
  );
}
