import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { call, fmtTime, isMusic, type Assignment, type Place, type Slot } from "./api";
import { rowsOf, SILENCE_TIP, type Row } from "./CueView";
import { FolderIcon } from "./Icons";
import { keyLabel, useKeymap, type CommandId } from "./keys";
import { where } from "./music";
import { nav } from "./nav";
import { fullPath, reveal } from "./platform";
import { useEditor } from "./store";
import { showLines } from "./TextTab";
import { Help, WikiLink } from "./Wiki";

/** The Audio Editor's right panel: the selected slot's settings. Each control has one home: the slot's row plays the
    original and the replacement and takes or replaces its file; the waveforms below the list play from any spot; this
    panel sets up what replaces the slot (silence's timing, Make-Up Gain, timing, cue points) and says where else it
    plays. The Library has no such panel: SlotFacts says what a slot is, over its waveform. */
export function Inspector() {
  const { cue, selected, project, actions } = useEditor();
  const rows = useMemo(() => (cue ? rowsOf(cue.segments_detail) : []), [cue]);
  const sel = rows.filter((r) => selected.includes(r.slot.source));
  useKeymap();
  // the slot the panel showed last: what replaces it settles in when that changes, not when another slot is selected
  // (the whole panel settles in then)
  const one = sel.length === 1 ? sel[0].slot.source : null;
  const shown = useRef(one);
  useEffect(() => { shown.current = one; });
  if (!cue || !sel.length) return <Empty />;
  if (sel.length > 1) {
    return <Bulk sources={sel.map((r) => r.slot.source)} usable={sel.filter((r) => !r.slot.unused && !r.slot.locked && !r.slot.absent).map((r) => r.slot.source)} />;
  }
  const { slot, seg } = sel[0];
  const a = project?.assignments[slot.source];
  const also = slot.also_n ?? slot.also_in.length;
  const sub = slot.label && !seg.name.includes(slot.label) ? slot.label : null;
  return (
    <aside className="inspector" aria-label="Details">
      <div className="view-in" key={slot.source}>
      <div className="insp-title">
        <h2>{seg.name}{sub ? <span className="sub">{sub}</span> : null}</h2>
        <CopyId id={slot.source} />
      </div>
      {slot.locked && <p className="warn-box">Do not touch. Replacing this clip makes the music stutter. <Help tip="Tags on a slot" page="reading-the-screen" /></p>}
      {slot.absent && <p className="info-box">This clip isn't in the installed game files, so there is nothing to play or replace.</p>}
      {slot.unused && <p className="info-box">Never heard. The game never plays this clip.</p>}
      {seg.added === "layer" ? <p className="info-box">A new layer. It plays whenever the sound above it plays.</p>
        : slot.added && <p className="info-box">A new take. The game picks it like the sound's other takes.</p>}
      <ClipNotes slot={slot} a={a} />

      <Settle key={a?.silence ? "silence" : a ? "file" : "none"} still={shown.current !== slot.source}>
        <Replacement slot={slot} a={a} music={isMusic(cue)} what={seg.name} />
        {a && (slot.was || (!slot.added && slot.object && ((slot.players ?? 1) > 1 || (slot.sound_banks ?? 0) < (slot.banks ?? 0)))) &&
          <Reach slot={slot} />}
        {a && !a.silence && <Gain source={slot.source} value={a.gain_db} />}
        {a && !a.silence && seg.segment && (
          <section className="insp-sec">
            <label className="check">
              <input type="checkbox" checked={a.fit_timing} onChange={(e) => actions.update(slot.source, { fit_timing: e.target.checked })} />
              <span>Fit timing to the new audio <Help tip="When this is on, the next segment starts when the new audio ends. When it is off, the original timing applies." page="timing-and-loops" /></span>
            </label>
          </section>
        )}
        {a && !a.silence && seg.segment && <Markers segment={seg.segment} gameEntry={seg.entry_ms} gameExit={seg.exit_ms}
          fit={a.fit_timing} lengthMs={a.duration_ms} />}
      </Settle>

      {also > 0 && (
        <section className="insp-sec">
          <h3>Also plays in <Help tip="The game reuses this audio in other places, and new audio here is heard there too." page="how-the-game-plays-music" /></h3>
          <ul className="also">
            {slot.also_in.map((id) => <li key={id}><AlsoLink id={id} source={slot.source} /></li>)}
          </ul>
          {also > slot.also_in.length && <p className="muted small">And {also - slot.also_in.length} more.</p>}
        </section>
      )}
      <section className="insp-sec facts">
        <dl>
          <dt>Original</dt><dd>{slot.duration_ms || seg.duration_ms ? fmtTime(slot.duration_ms || seg.duration_ms) : "–"}</dd>
          {seg.segment && <><dt>Segment</dt><dd>{fmtTime(seg.duration_ms)}{seg.exit_ms != null && <> · exit at {fmtTime(seg.exit_ms)}</>}</dd></>}
          {slot.variant && <><dt>Plays when</dt><dd>{slot.variant}</dd></>}
          {cue.language && <><dt>Language</dt><dd>{cue.language}</dd></>}
          {slot.subtitle && <><dt>Subtitle</dt><dd><SubtitleLink slot={slot}>Open</SubtitleLink>{!slot.subtitle_sure &&
            <span className="muted" data-tip={SEVERAL}> · one of several</span>}</dd></>}
        </dl>
      </section>
      </div>
    </aside>
  );
}

/** Nothing selected: what the keys do, with the keys they are on now. */
function Empty() {
  return (
    <aside className="inspector" aria-label="Details">
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
          <button className="link-text" onClick={() => nav.go("settings", "shortcuts")}>All shortcuts</button>
          {" · "}<WikiLink page="reading-the-screen" about="What the Audio Editor shows">Reading the screen</WikiLink>
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
        <h3>Silence <Help tip="Silence plays nothing in place of the original." page="how-the-game-plays-music" /></h3>
        <div className="cards one" role="radiogroup" aria-label="What the silence does to the timing">
          {([[true, "Move straight on", SILENCE_TIP.move], [false, "Keep the original timing", SILENCE_TIP.keep]] as const).map(([fit, title, text]) => (
            <button key={title} role="radio" aria-checked={a.fit_timing === fit} className={`card${a.fit_timing === fit ? " on" : ""}`}
              data-tip={text} onClick={() => { if (a.fit_timing !== fit) actions.update(slot.source, { fit_timing: fit }); }}>
              <b>{title}</b>
            </button>
          ))}
        </div>
        {!music && <p className="muted small">Audiodiver also takes it out of the game's mix. <Help tip="A silenced sound no longer turns down the sounds around it." page="volume" /></p>}
      </section>
    );
  }
  if (a) {
    return (
      <section className="insp-sec">
        <h3>Replaced with</h3>
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
        <button className="btn" disabled={!usable} onClick={() => actions.silence([slot.source], false, what)} data-tip-cmd="silence"
          data-tip="Play nothing here instead of the original">Use silence</button>
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
    [false, "Every sound that plays it", own ? "Like any replacement, every sound that plays this clip gets the new audio"
      : `Changes it in ${banks(slot.banks ?? 0)}`],
    [true, "Only this sound", `Changes it in ${banks(own ? slot.banks ?? 0 : slot.sound_banks ?? 0)}. Other sounds that play the clip keep the original.`],
  ] as const;
  return (
    <section className="insp-sec">
      <h3>Plays in <Help tip="Several sounds can play the same clip. Choose whether the new audio plays in all of them or only in this one." page="adding-audio" /></h3>
      <div className="cards one" role="radiogroup" aria-label="Where the new audio plays">
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
        <CopyId id={slot.source} />
        {length > 0 && <span>{fmtTime(length)}</span>}
        {seg.segment && seg.exit_ms != null && <span>exit at {fmtTime(seg.exit_ms)}</span>}
        {slot.variant && <span>plays when {slot.variant}</span>}
        {cue?.language && <span>{cue.language}</span>}
        {slot.locked && <span className="warn" data-tip="Replacing it makes the music stutter">do not touch</span>}
        {slot.unused && <span data-tip="Nothing in the game data plays it">never played</span>}
        {slot.absent && <span data-tip="Not in the installed game files">no audio</span>}
        {slot.subtitle && <SubtitleLink slot={slot}>{slot.subtitle_sure ? "subtitle" : "subtitle: one of several"}</SubtitleLink>}
        {(slot.notes ?? []).map((n) => n.tag && <span key={n.tag} className={n.warn ? "warn" : undefined} data-tip={n.text}>{n.tag}</span>)}
      </div>
      {also > 0 && (
        <div className="tl-facts-line also-line" data-tip="The game reuses this audio in other places, and new audio here is heard there too" data-tip-side="top">
          <span>Also plays in</span>
          {slot.also_in.map((id) => <AlsoLink key={id} id={id} source={slot.source} />)}
          {also > slot.also_in.length && <span>and {also - slot.also_in.length} more</span>}
        </div>
      )}
      {(slot.notes ?? []).map((n) => !n.tag && <div key={n.text} className={`tl-facts-line${n.warn ? " warn" : ""}`}>{n.text}</div>)}
    </div>
  );
}

const SEVERAL = "Several subtitles have these words, and the game files don't show which one belongs to this recording. The Text Editor lists them all and opens the most likely one";

/** A voice line's subtitle, opened in the Text Editor: the one it says, or, where several subtitles have its words
    and its length doesn't tell them apart, all of them (core: library.py `subtitle`, editor.py text_alike). */
function SubtitleLink({ slot, children }: { slot: Slot; children: ReactNode }) {
  const { cue } = useEditor();
  const open = async () => {
    const id = Number(slot.subtitle);
    const ids = slot.subtitle_sure ? [id] : await call<number[]>("text_alike", { id }).catch(() => [id]);
    const lang = cue?.lang || undefined; // the voice's language: its subtitle in the same one
    showLines({ ids, pick: id, lang, note: ids.length > 1
      ? `${ids.length} subtitles have the ${lang && lang !== "us" ? "English " : ""}words of this voice line. The recording matches one of them, most likely the one that is open.`
      : "The subtitle of this voice line." });
  };
  return <button className="link-text" onClick={open} data-tip={slot.subtitle_sure ? "Open its subtitle in the Text Editor" : SEVERAL}>{children}</button>;
}

/** Content that settles in when it takes the place of other content (its key changed). `still` is read once, when it
    appears: true when the panel around it is new as well and settles in itself. */
function Settle({ still, children }: { still: boolean; children: ReactNode }) {
  const [cls] = useState(still ? undefined : "view-in");
  return <div className={cls}>{children}</div>;
}

function CopyId({ id }: { id: string }) {
  const [done, setDone] = useState(false);
  const { quick } = useEditor();
  const copy = async () => {
    try { await navigator.clipboard.writeText(id); setDone(true); setTimeout(() => setDone(false), 1200); }
    catch { quick("Couldn't copy to the clipboard", "info"); }
  };
  return (
    <button className="id" data-tip="Copy the source id" onClick={copy}>
      {done ? "Copied" : id}
    </button>
  );
}

/** Another place that plays the same audio: a piece of music or a sound set as the Index names it, else the bank.
    It opens there, with the slot selected: in this tab when it can show it, else in the Library. */
function AlsoLink({ id, source }: { id: string; source: string }) {
  const { itemIndex, show, openFound } = useEditor();
  const at = itemIndex.byCue.get(id);
  if (at) {
    return (
      <button className="link" onClick={() => show(at.item.id, at.part.cue, source)}>
        {at.item.name}{at.part.name && at.item.parts.length > 1 ? ` · ${at.part.name}` : ""}<small>{where(itemIndex, at.item).replace(/ ▸ [^▸]*$/, "") || "Music"}</small>
      </button>
    );
  }
  const bank = id.startsWith("bank:") ? id.slice(5) : null; // a bank the Index doesn't have: All Archives does
  const open = async () => {
    const places = await call<Place[]>("find", { query: bank ?? id }).catch(() => []);
    if (places[0]) openFound("library", { ...places[0], source });
  };
  return <button className="link" onClick={open}>{bank ? `Bank ${bank}` : `Cue ${id}`}<small>{bank ? "Opens in All Archives" : "Music"}</small></button>;
}

const GAIN_PRESETS = [-4, 0, 4, 8]; // the same for one slot and for several
const fmtGain = (x: number) => `${x > 0 ? "+" : ""}${x}`;

function Gain({ source, value }: { source: string; value: number }) {
  const { actions } = useEditor();
  const [v, setV] = useState(value);
  const [typed, setTyped] = useState<string | null>(null); // the value box while it is typed in
  const escaped = useRef(false);
  useEffect(() => setV(value), [value]);
  const later = useRef(0);
  useEffect(() => () => clearTimeout(later.current), []);
  const commit = (x: number) => { clearTimeout(later.current); if (x !== value) actions.update(source, { gain_db: x }); };
  // arrow keys on the slider step it; the steps become one change (one undo) once the keys rest
  const commitSoon = (x: number) => { clearTimeout(later.current); later.current = window.setTimeout(() => commit(x), 600); };
  const takeTyped = () => {
    const x = Number(typed?.replace(",", ".").replace("−", "-"));
    setTyped(null);
    if (escaped.current) { escaped.current = false; return; } // Esc: as it was
    if (typed === null || typed.trim() === "" || !Number.isFinite(x)) return;
    const g = Math.round(Math.max(-12, Math.min(12, x)) * 2) / 2;
    setV(g);
    commit(g);
  };
  return (
    <section className="insp-sec">
      <h3>Make-Up Gain <Help tip="Louder or quieter, without changing the file or the game's mix." page="volume" />
        <span className="val"><input className="gain-val" value={typed ?? fmtGain(v)} aria-label="Make-Up Gain in dB, typed" inputMode="decimal"
          onFocus={(e) => { setTyped(fmtGain(v)); e.currentTarget.select(); }} onChange={(e) => setTyped(e.target.value)} onBlur={takeTyped}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); else if (e.key === "Escape") { escaped.current = true; e.currentTarget.blur(); } }}
          data-tip="Type a value from −12 to +12" /> dB</span></h3>
      <input type="range" min={-12} max={12} step={0.5} value={v} aria-label="Make-Up Gain in dB"
        onChange={(e) => setV(Number(e.target.value))} onPointerUp={() => commit(v)}
        onKeyUp={(e) => { if (/^(Arrow|Home|End|Page)/.test(e.key)) commitSoon(v); }} onBlur={() => commit(v)}
        onKeyDown={(e) => { if (e.ctrlKey || e.metaKey || e.altKey) commit(v); }} /* a nudge on its way goes first: then Ctrl+Z undoes it */ />
      <div className="presets">
        {GAIN_PRESETS.map((x) => <button key={x} className={`chip${v === x ? " on" : ""}`} onClick={() => { setV(x); commit(x); }}>{fmtGain(x)} dB</button>)}
      </div>
    </section>
  );
}

function Markers({ segment, gameEntry, gameExit, fit, lengthMs }: {
  segment: string; gameEntry: number | null; gameExit: number | null; fit: boolean; lengthMs: number | null;
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
  const save = () => {
    if (problem) return;
    if (e1 === (o.entry_marker ?? null) && e2 === (o.exit_marker ?? null)) return; // as they were: no change
    actions.segmentOverride(segment, e1, e2);
  };
  const auto = (x: number | null | undefined) => (x == null ? "auto" : `${Math.round(x)} (${fit ? "fitted" : "original"})`);
  return (
    <details className="insp-sec" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary>Cue points <Help tip="Entry is where the segment counts as started. Exit is where the next segment starts." page="timing-and-loops" /></summary>
      <div className="markers">
        <label>Entry (ms)<input ref={entryBox} type="number" min={0} value={entry} placeholder={auto(autoEntry)}
          onChange={(e) => setEntry(e.target.value)} onBlur={save} aria-invalid={!!problem || undefined} /></label>
        <label>Exit (ms)<input ref={exitBox} type="number" min={0} value={exit} placeholder={auto(autoExit)}
          onChange={(e) => setExit(e.target.value)} onBlur={save} aria-invalid={!!problem || undefined} /></label>
      </div>
      {problem && <small className="bad" role="alert">{problem}</small>}
    </details>
  );
}

/** Several slots selected. `usable`: the ones of them the game plays and nobody marked do-not-touch. */
function Bulk({ sources, usable }: { sources: string[]; usable: string[] }) {
  const { project, actions } = useEditor();
  const a = project?.assignments ?? {};
  const mine = sources.filter((s) => a[s]);
  const files = mine.filter((s) => !a[s].silence), silent = mine.filter((s) => a[s].silence);
  const toSilence = usable.filter((s) => !a[s]?.silence);
  const slots = (n: number) => `${n} slot${n === 1 ? "" : "s"}`;
  return (
    <aside className="inspector" aria-label="Details">
      <div className="insp-title"><h2>{sources.length} slots selected</h2></div>
      {files.length > 0 && (
        <section className="insp-sec">
          <h3>Make-Up Gain{files.length < sources.length ? ` of the ${files.length} replaced` : ""}</h3>
          <div className="presets">
            {GAIN_PRESETS.map((x) => <button key={x} className="chip" onClick={() => actions.updateMany(files, { gain_db: x })}>{fmtGain(x)} dB</button>)}
          </div>
        </section>
      )}
      {silent.length > 0 && (
        <section className="insp-sec">
          <h3>Silence in {slots(silent.length)}</h3>
          <div className="presets">
            <button className={`chip${silent.every((s) => a[s].fit_timing) ? " on" : ""}`} data-tip={SILENCE_TIP.move}
              onClick={() => actions.updateMany(silent, { fit_timing: true })}>Move straight on</button>
            <button className={`chip${silent.every((s) => !a[s].fit_timing) ? " on" : ""}`} data-tip={SILENCE_TIP.keep}
              onClick={() => actions.updateMany(silent, { fit_timing: false })}>Keep the original timing</button>
          </div>
        </section>
      )}
      {!mine.length && <p className="insp-empty">None of these is replaced yet.</p>}
      <section className="insp-sec">
        <div className="row-btns">
          <button className="btn" disabled={!toSilence.length} onClick={() => actions.silence(toSilence)} data-tip-cmd="silence"
            data-tip={toSilence.length ? "Play nothing in these slots" : usable.length ? "Already silent" : "Never played, or do not touch"}>
            Replace {toSilence.length > 0 && toSilence.length < sources.length ? `${slots(toSilence.length)} ` : ""}with silence</button>
          {mine.length > 0 && (
            <button className="btn quiet" onClick={() => actions.unassign(mine)}>
              Remove {silent.length === mine.length ? "the silence" : "the new audio"} from {slots(mine.length)}</button>
          )}
        </div>
      </section>
    </aside>
  );
}
