import { useEffect, useMemo, useRef, useState } from "react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { audioUrl, fmtDecimal, fmtTime, type Cue, type Curve } from "./api";
import { audible, rowName, rowsOf } from "./CueView";
import { useLiveGain } from "./gain";
import { throughHead, throughSeek, type Through } from "./PlayThrough";
import { player, usePlayer, type PlayedAt } from "./player";
import { SlotFacts } from "./Inspector";
import { ResizeEdge, useStoredHeight } from "./Resize";
import { useEditor } from "./store";
import { finePeaks, usePeaks, useWaveZoom, useWheelZoom, WaveScroll, Waveform, WaveZoom, type Marker } from "./Waveform";
import { fullPath } from "./platform";
import { Help } from "./Wiki";

/** The selected slot as two waveforms on one time scale: the original above, the replacement below, with the
    segment's entry and exit cue points. The replacement's can be dragged; the original's show where the game's sit.
    The Library has the original alone. A click plays from that spot (the slot's row has the play buttons). Both
    share one level scale and are drawn at the Make-Up Gain the mod plays them at (past full scale in red), following
    the slider while it moves, so the new audio can be set as loud as the original by eye.

    While the cue plays through (`through`), the playhead shows where the play-through is in this slot's audio, and a
    click on a waveform moves the play-through to that spot.

    `cue` and `source` show a slot of another cue than the tab's (the Soundtrack's segment), else the tab's own cue
    and its selected slot. */
const HEIGHT = 210;
const HEIGHT_ONE = 190; // the Library's: the game's waveform under the slot's facts
const TRIM_ROOM = 34;   // added for the new audio's fields, so the two waveforms keep their height
const MIN_SPAN = 20;    // ms: the closest the time zoom goes
// the cue points' names, on the flags
const ENTRY = t({ message: "Entry", comment: "A music segment's Entry cue point (Wwise term): where the segment counts as started" });
const EXIT = t({ message: "Exit", comment: "A music segment's Exit cue point (Wwise term): where the next segment starts" });
// what the cue points do, in the flags' tooltips
const ENTRY_ABOUT = t`The segment counts as started here. Audio before it plays under the end of the segment before`;
const EXIT_ABOUT = t`The next segment starts here. Audio after it rings out over the next one`;
const ENTRY_DRAG = t`The segment counts as started here. Audio before it plays under the end of the segment before. Drag to move it`;
const EXIT_DRAG = t`The next segment starts here. Audio after it rings out over the next one. Drag to move it`;

/** A clip's curves as one line, [ms, level] with 1 as mixed: a volume curve takes away from 1, and fades scale that. */
function curveLine(c: Curve): number[][] {
  const at = (points: number[][] | undefined, ms: number, none: number) => {
    if (!points?.length) return none;
    const i = points.findIndex((p) => p[0] >= ms);
    if (i <= 0) return points[i === 0 ? 0 : points.length - 1][1];
    const [x0, y0] = points[i - 1], [x1, y1] = points[i];
    return y0 + ((ms - x0) / (x1 - x0)) * (y1 - y0);
  };
  const times = [...new Set([...(c.volume ?? []), ...(c.fade_in ?? []), ...(c.fade_out ?? [])].map((p) => p[0]))].sort((a, b) => a - b);
  return times.map((ms) => [ms, Math.max(0, (1 + at(c.volume, ms, 0)) * at(c.fade_in, ms, 1) * at(c.fade_out, ms, 1))]);
}

/** Says what the line over a waveform is, under its label. */
function CurveLabel() {
  return <span className="tl-curve" data-tip={t`The level the game gives this clip as it plays`} data-tip-more={t`Drawn as the line around the waveform`}><Trans>Volume curve</Trans></span>;
}

type Trim = { start: number; end: number; delay: number };
const MIN_TRIM = 10; // ms: the shortest stretch that can play (the core's MIN_TRIM_MS)

type FadeMs = { in: number; out: number };

/** The new audio as one lane: its whole file on the waveforms' time scale, placed where it plays, the stretch that
    plays bright and the rest dim, drawn with its fades and at its Make-Up Gain. Start and End set the stretch,
    Fade In and Fade Out the fades inside it, and dragging the stretch moves it later or earlier against the original
    (the silence before it is the delay). The file stays put while a handle moves, so a handle stays under the
    pointer. A music segment's Entry and Exit sit on it too. Everything given and returned here is on the time scale
    (what plays, from the slot's start), except the trim and fades, which are in the file's own ms. */
function NewAudioLane({ file, fileMs, trim, fades, view, gainDb, curve, playheadMs, cues, active, onCue, onSet, onFades, onSeek }: {
  file: string; fileMs: number; trim: Trim; fades: FadeMs; view: { spanMs: number; fromMs: number; zoomY: number };
  gainDb: number; curve?: number[][]; playheadMs: number | null; cues: Marker[]; active?: [number, number];
  onCue: (id: string, ms: number, how: "drag" | "key") => void;
  onSet: (t: Trim) => void; onFades: (f: Partial<{ fade_in_ms: number; fade_out_ms: number }>) => void; onSeek: (ms: number) => void;
}) {
  const { peaks, error, retry } = usePeaks("file", file);
  const [live, setLive] = useState<Trim | null>(null);
  const [liveFades, setLiveFades] = useState<FadeMs | null>(null);
  useEffect(() => setLive(null), [trim.start, trim.end, trim.delay]); // the project's answer replaces what was dragged
  useEffect(() => setLiveFades(null), [fades.in, fades.out]);
  const { start, end, delay } = live ?? trim;
  // fades longer than the stretch stop at it, as the build makes them
  const fIn = Math.min((liveFades ?? fades).in, end - start), fOut = Math.min((liveFades ?? fades).out, end - start - fIn);
  const offset = delay - start; // where the file's first moment sits on the time scale
  const wrap = useRef<HTMLDivElement>(null);
  const moving = useRef<{ x: number; delay: number; moved: boolean } | null>(null);
  const at = (ms: number) => `${((ms - view.fromMs) / view.spanMs) * 100}%`;
  const set = (t: Trim) => { setLive(t); onSet(t); };
  // a handle: Start keeps the file where it is, so the stretch begins under the pointer (the delay follows it)
  const handle = (id: string, ms: number): Trim => (id === "start" ? { start: ms, end, delay: offset + ms } : { start, end: ms, delay });
  // the top of Start bends right into the fade in, the top of End left into the fade out
  const fadeAt = (id: string, ms: number): FadeMs => (id === "start" ? { in: ms - start, out: fOut } : { in: fIn, out: end - ms });
  const markers: Marker[] = [
    // the cue points, from the time scale into the file's ms, under Start and End: with Fit timing, Exit sits on End
    // and Entry on Start, and a drag there moves the end of the audio (the cue point follows it)
    ...cues.map((c) => ({ ...c, ms: c.ms - offset, min: c.min != null ? c.min - offset : -offset, max: c.max != null ? c.max - offset : undefined })),
    { id: "start", ms: start, label: t({ message: "Start", context: "Trim handle", comment: "Where the new audio starts playing in the file" }), draggable: true,
      min: Math.max(0, -offset), max: end - MIN_TRIM - fIn - fOut, about: t`Where the new audio starts in the file. Drag the line to move it`,
      bend: start + fIn, bendMin: start, bendMax: end - fOut, bendAbout: t`Drag to fade the new audio in` },
    { id: "end", ms: end, label: t({ message: "End", context: "Trim handle", comment: "Where the new audio stops playing in the file" }), draggable: true,
      min: start + MIN_TRIM + fIn + fOut, max: fileMs, about: t`Where the new audio ends in the file. Drag the line to move it`,
      bend: end - fOut, bendMin: start + fIn, bendMax: end, bendAbout: t`Drag to fade the new audio out` },
  ];
  const isCue = (id: string) => cues.some((c) => c.id === id);
  return (
    <div className="trim-wrap" ref={wrap}>
      <Waveform peaks={peaks} spanMs={view.spanMs} fromMs={view.fromMs - offset} zoomY={view.zoomY} tone="mine" markers={markers}
        activeFrom={active ? Math.max(start, active[0] - offset) : start} activeTo={active ? Math.min(end, active[1] - offset) : end}
        gainDb={gainDb} curve={curve?.map(([ms, level]) => [ms - offset, level])} fades={{ from: start, to: end, in: fIn, out: fOut }}
        playheadMs={playheadMs == null ? null : playheadMs - offset} label={t`Reading the new audio…`} error={error} onRetry={retry}
        onSeek={(ms) => onSeek(Math.max(0, ms + offset))}
        onMarkerMove={(id, ms, part) => {
          if (isCue(id)) return;
          if (part === "bend") setLiveFades(fadeAt(id, ms));
          else setLive(handle(id, ms));
        }}
        onMarkerCommit={(id, ms, how, part) => {
          if (isCue(id)) onCue(id, Math.round(ms + offset), how);
          else if (part === "line") set(handle(id, Math.round(ms)));
          else {
            const f = fadeAt(id, Math.round(ms));
            setLiveFades(f);
            onFades(id === "start" ? { fade_in_ms: Math.max(0, f.in) } : { fade_out_ms: Math.max(0, f.out) });
          }
        }} />
      {/* the stretch that plays: a drag moves it, a click plays from there */}
      <div className="trim-body" style={{ left: `calc(${at(delay)} + 6px)`, width: `calc(${((end - start) / view.spanMs) * 100}% - 12px)` }}
        data-tip={t`Drag to play the new audio later or earlier`} data-tip-more={t`Before it, the slot plays silence`}
        onPointerDown={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          moving.current = { x: e.clientX, delay, moved: false };
        }}
        onPointerMove={(e) => {
          const m = moving.current, box = wrap.current?.getBoundingClientRect();
          if (!m || !box || (!m.moved && Math.abs(e.clientX - m.x) < 3)) return;
          m.moved = true;
          setLive({ start, end, delay: Math.max(0, Math.round(m.delay + ((e.clientX - m.x) / box.width) * view.spanMs)) });
        }}
        onPointerUp={(e) => {
          const m = moving.current, box = wrap.current?.getBoundingClientRect();
          moving.current = null;
          if (!m || !box) return;
          // from the release itself: the last move's state may not be drawn yet (WebKit sends the release right after)
          const moved = m.moved || Math.abs(e.clientX - m.x) >= 3;
          if (moved) set({ start, end, delay: Math.max(0, Math.round(m.delay + ((e.clientX - m.x) / box.width) * view.spanMs)) });
          else onSeek(view.fromMs + ((e.clientX - box.left) / box.width) * view.spanMs);
        }} />
    </div>
  );
}

/** The new audio's lane in numbers, in ms: where it starts and ends in its file, how late it starts, its fades. */
function TrimFields({ trim, fades, fileMs, onSet, onFades }: {
  trim: Trim; fades: FadeMs; fileMs: number; onSet: (t: Trim) => void;
  onFades: (f: Partial<{ fade_in_ms: number; fade_out_ms: number }>) => void;
}) {
  const field = (key: string, now: number, label: string, tip: string, set: (v: number) => void) => (
    <label className="trim-field" data-tip={tip}>{label}
      <input type="number" min={0} step={1} key={`${key}:${now}`} defaultValue={Math.round(now)}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        onBlur={(e) => {
          const v = Math.max(0, Math.round(Number(e.target.value)));
          if (!Number.isFinite(v) || v === Math.round(now)) { e.target.value = String(Math.round(now)); return; }
          set(v);
        }} />
    </label>
  );
  const changed = trim.start > 0 || trim.end < fileMs - 0.5 || trim.delay > 0 || fades.in > 0 || fades.out > 0;
  return (
    <div className="tl-trim">
      {field("start", trim.start, t`Start (ms)`, t`Where the new audio starts in the file`, (v) => onSet({ ...trim, start: v }))}
      {field("end", trim.end, t`End (ms)`, t`Where the new audio ends in the file`, (v) => onSet({ ...trim, end: v }))}
      {field("delay", trim.delay, t`Delay (ms)`, t`Silence before the new audio, so it starts later than the original`, (v) => onSet({ ...trim, delay: v }))}
      {field("fadeIn", fades.in, t`Fade In (ms)`, t`How long the new audio takes to rise from silence`, (v) => onFades({ fade_in_ms: Math.min(600_000, v) }))}
      {field("fadeOut", fades.out, t`Fade Out (ms)`, t`How long the new audio takes to fall to silence before it ends`, (v) => onFades({ fade_out_ms: Math.min(600_000, v) }))}
      {changed && <button className="link-inline" onClick={() => { onSet({ start: 0, end: fileMs, delay: 0 }); if (fades.in || fades.out) onFades({ fade_in_ms: 0, fade_out_ms: 0 }); }}>{t`Reset`}</button>}
      <Help tip={t`Trim and move the new audio`} page="timing-and-loops#trimming-and-moving-new-audio" />
    </div>
  );
}

/** The Make-Up Gain a waveform is drawn at, under its label. */
function Db({ db }: { db: number }) {
  return <span className="gain" data-tip={t`Make-Up Gain`} data-tip-more={t`Drawn and played at this gain`}>{fmtDecimal(db, 2, true)} dB</span>;
}

export function Timeline({ room, through, at, cue: given, source: picked }: {
  room: () => number; through: Through | null; at: PlayedAt | null; cue?: Cue; source?: string | null;
}) {
  const editor = useEditor();
  const { project, revision, actions, readOnly, scope } = editor;
  const cue = given ?? editor.cue;
  const selected = given ? (picked ? [picked] : []) : editor.selected;
  const [h, setH] = useStoredHeight(`audiodiver.waveHeight${readOnly ? ".libraryFacts" : ""}`, readOnly ? HEIGHT_ONE : HEIGHT);
  const p = usePlayer();
  const rows = useMemo(() => (cue ? rowsOf(cue.segments_detail) : []), [cue]);
  const row = selected.length === 1 ? rows.find((r) => r.slot.source === selected[0]) : undefined;
  const source = row?.slot.source ?? null;
  const a = source && !readOnly ? project?.assignments[source] : undefined;
  // drawn at the Make-Up Gain the mod plays them at, and at the one being set while the slider moves: the new
  // audio at its own, the original at the gain on it while the slot has no new audio
  const live = useLiveGain(readOnly ? null : source);
  const mineDb = audible(a) ? live ?? a!.gain_db : 0;
  const gameDb = !a && source && !readOnly ? live ?? project?.gains[source] ?? 0 : 0;
  const none = !!(row?.slot.absent || row?.slot.added); // "No audio", or a new take: no original to draw
  const gameWave = usePeaks("vanilla", none ? null : source);
  // the new audio's file, where it plays (NewAudioLane): its whole length is on the scale, so its end can be dragged out
  const fileMs = audible(a) && a!.exists && a!.file_ms ? a!.file_ms : 0;
  const trim: Trim | null = fileMs ? { start: a!.start_ms ?? 0, end: a!.end_ms || fileMs, delay: a!.delay_ms ?? 0 } : null;
  const fades: FadeMs = { in: a?.fade_in_ms ?? 0, out: a?.fade_out_ms ?? 0 };
  // what plays, drawn from the project's audio only where the file can't be (an older core gives no file length)
  const mineWave = usePeaks("project", audible(a) && !trim ? source : null, String(revision));
  const extra = !readOnly && trim ? TRIM_ROOM : 0;
  // one zoom for both, from the controls at the right; zoomed in, finer peaks take over once they come
  const span = Math.max(gameWave.peaks?.duration_ms ?? 0, mineWave.peaks?.duration_ms ?? 0,
    trim ? trim.delay - trim.start + fileMs : 0, 1);
  const zoom = useWaveZoom(span, MIN_SPAN, source);
  const fineGame = finePeaks(zoom, gameWave.peaks?.duration_ms), fineMine = finePeaks(zoom, mineWave.peaks?.duration_ms);
  const gameFine = usePeaks("vanilla", fineGame && !none ? source : null, "", fineGame);
  const mineFine = usePeaks("project", fineMine && audible(a) && !trim ? source : null, String(revision), fineMine);
  const game = gameFine.peaks ?? gameWave.peaks, mine = mineFine.peaks ?? mineWave.peaks;
  const heardMs = trim ? trim.delay + trim.end - trim.start : mine?.duration_ms; // how long the new audio plays
  const waves = useRef<HTMLDivElement>(null);
  useWheelZoom(waves, zoom, !!row);
  const curve = useMemo(() => (row?.slot.curve ? curveLine(row.slot.curve) : undefined), [row?.slot.curve]);
  if (!row || !source) return null;

  const { seg } = row;
  const what = rowName(row);
  // what plays in the slot follows the curve, unless the project drops it; the original lane always shows the game's
  const dropped = !readOnly && !!project?.curves_off.includes(source);
  const gameCurve = a || !dropped ? curve : undefined, mineCurve = dropped ? undefined : curve;
  const view = { spanMs: zoom.span, fromMs: zoom.from, zoomY: zoom.y };
  const kGame = `vanilla:${source}`, kMine = `project:${source}`;
  // the play-through that plays in this tab, and how far it is
  const playing = through && p.key === through.key ? through : null;
  const now = p.time * 1000;
  const head = (k: string, yours: boolean, lengthMs?: number) =>
    (p.key === k ? now : playing ? throughHead(playing, now, source, yours, lengthMs) : null);
  /** A click on a waveform: while the cue plays through, the play-through goes to that spot of this slot; otherwise
      (or when the play-through never plays that spot) the slot itself plays from there. */
  const seek = (kind: "vanilla" | "project", ms: number) => {
    const to = playing ? throughSeek(playing, now, source, kind === "project", ms) : null;
    if (to !== null && playing) { player.seek(to / playing.duration_ms); return; }
    player.playFrom(kind === "vanilla" ? kGame : kMine, audioUrl(kind, source, kind === "project" ? String(revision) : ""), ms / 1000, undefined,
      kind === "vanilla" ? t`${what} · original` : t`${what} · replaced`, at ?? { scope, itemId: null, cueId: cue?.id ?? null, source });
  };

  /** A trim, as the core keeps it: an end at the file's end is none. A trim the core refuses leaves the old one. */
  const setTrim = (src: string, x: Trim) => {
    const end = Math.min(fileMs, Math.max(x.start + MIN_TRIM, x.end));
    void actions.setTrim(src, { start_ms: Math.max(0, Math.min(x.start, end - MIN_TRIM)), end_ms: end >= fileMs - 0.5 ? 0 : end,
      delay_ms: Math.max(0, x.delay) });
  };

  const hasCues = !!seg.segment;
  const o = project?.segment_overrides[seg.segment] ?? {};
  const fit = a?.fit_timing ?? true;
  // what the build writes: with "fit timing", entry 0 and exit at the clip's end, unless a cue point overrides it
  const autoEntry = fit ? 0 : seg.entry_ms ?? 0;
  const autoExit = fit ? heardMs ?? 0 : seg.exit_ms ?? seg.duration_ms;
  const entry = o.entry_marker ?? autoEntry;
  const exit = o.exit_marker ?? autoExit;

  const gameMarkers: Marker[] = hasCues && seg.exit_ms != null
    ? [{ id: "entry", ms: seg.entry_ms ?? 0, label: ENTRY, about: ENTRY_ABOUT }, { id: "exit", ms: seg.exit_ms, label: EXIT, about: EXIT_ABOUT }] : [];
  const myMarkers: Marker[] = hasCues && heardMs
    ? [{ id: "entry", ms: entry, label: ENTRY, about: ENTRY_DRAG, draggable: true, min: 0, max: exit - 50 },
       { id: "exit", ms: exit, label: EXIT, about: EXIT_DRAG, draggable: true, min: entry + 50, max: heardMs }] : [];

  const commit = (id: string, ms: number, how: "drag" | "key") => {
    // a drag that ends near the automatic spot snaps back onto it, clearing the override; a key's 10 ms step never does
    const near = (x: number, y: number) => how === "drag" && Math.abs(x - y) < 15;
    const e = id === "entry" ? (near(ms, autoEntry) ? null : ms) : o.entry_marker ?? null;
    const x = id === "exit" ? (near(ms, autoExit) ? null : ms) : o.exit_marker ?? null;
    actions.segmentOverride(seg.segment, e, x);
  };
  const overridden = o.entry_marker != null || o.exit_marker != null;
  const tail = heardMs ? heardMs - exit : 0;
  const last = fmtTime(tail);

  return (
    <section className={`timeline${readOnly ? " one" : ""}`} aria-label={t`Waveforms`} style={{ height: (h ?? (readOnly ? HEIGHT_ONE : HEIGHT)) + extra }}>
      <ResizeEdge edge="top" label={t`Resize the waveforms`} min={readOnly ? 120 : 140} max={room} onResize={(v) => setH(v - extra)} onReset={() => setH(readOnly ? HEIGHT_ONE : HEIGHT)} />
      {readOnly && <SlotFacts row={row} />}
      <div className="tl-body zoom-grid">
        <div className="tl-rows" ref={waves}>
          <div className="tl-row">
            <div className="tl-label game"><b>{t`Original`}</b><span>{fmtTime(game?.duration_ms)}</span>{gameDb !== 0 && <Db db={gameDb} />}{gameCurve && <CurveLabel />}</div>
            <Waveform peaks={game} {...view} tone="game" markers={gameMarkers} playheadMs={head(kGame, false, game?.duration_ms)} gainDb={gameDb} curve={gameCurve}
              activeFrom={hasCues ? seg.entry_ms ?? 0 : undefined} activeTo={hasCues ? seg.exit_ms ?? undefined : undefined}
              onSeek={none ? undefined : (ms) => seek("vanilla", ms)}
              label={row.slot.added ? t`A new take has no original` : row.slot.absent ? t`Not in the installed game files` : t`Loading the original…`}
              error={gameWave.error} onRetry={gameWave.retry} />
          </div>
          {!readOnly && (
            <div className="tl-row">
              <div className="tl-label mine"><b>{t`Replaced`}</b><span>{a?.silence ? t({ message: "silence", comment: "In place of the length of the new audio: the slot plays silence" }) : a ? fmtTime(heardMs) : ""}</span>{mineDb !== 0 && <Db db={mineDb} />}{audible(a) && mineCurve && <CurveLabel />}</div>
              {a?.silence ? (
                <div className="wave placeholder">{a.fit_timing ? t`Silence: plays nothing, and the game moves straight on`
                  : t`Silence: plays nothing for the length of the original, so the timing doesn't change`}</div>
              ) : trim && project ? (
                <NewAudioLane file={fullPath(project.folder, a!.audio)} fileMs={fileMs} trim={trim} fades={fades} view={view}
                  gainDb={mineDb} curve={mineCurve} playheadMs={head(kMine, true, heardMs)} cues={myMarkers}
                  active={hasCues ? [entry, exit] : undefined} onCue={commit} onSeek={(ms) => seek("project", ms)}
                  onSet={(x) => setTrim(source, x)} onFades={(f) => void actions.setFades([source], f)} />
              ) : a?.exists ? (
                <Waveform peaks={mine} {...view} tone="mine" markers={myMarkers} playheadMs={head(kMine, true, mine?.duration_ms)} gainDb={mineDb} curve={mineCurve}
                  activeFrom={hasCues ? entry : undefined} activeTo={hasCues ? exit : undefined}
                  onSeek={(ms) => seek("project", ms)}
                  onMarkerCommit={commit} label={t`Reading the new audio…`} error={mineWave.error} onRetry={mineWave.retry} />
              ) : (
                <div className="wave placeholder">{a ? t`File missing` : t`Not replaced`}</div>
              )}
            </div>
          )}
        </div>
        <WaveZoom zoom={zoom} foot={zoom.x > 1 ? <WaveScroll zoom={zoom} /> : null} />
      </div>
      {!readOnly && trim && <TrimFields trim={trim} fades={fades} fileMs={fileMs} onSet={(x) => setTrim(source, x)}
        onFades={(f) => void actions.setFades([source], f)} />}
      {audible(a) && hasCues && (
        <p className="tl-note">
          {fit ? t`Drag Exit to move where the next segment starts.` : t`Fit timing is off, so the original cue points apply until one is moved.`}
          {tail > 30 && <> <Trans>The last <b>{last}</b> rings out over the next segment.</Trans></>}
          {overridden && <button className="link-inline" onClick={() => actions.segmentOverride(seg.segment, null, null)}>{t`Reset Cue Points`}</button>}
        </p>
      )}
    </section>
  );
}
