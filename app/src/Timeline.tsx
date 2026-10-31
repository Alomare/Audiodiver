import { useMemo, useRef } from "react";
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
  const mineWave = usePeaks("project", audible(a) ? source : null, String(revision));
  // one zoom for both, from the controls at the right; zoomed in, finer peaks take over once they come
  const span = Math.max(gameWave.peaks?.duration_ms ?? 0, mineWave.peaks?.duration_ms ?? 0, 1);
  const zoom = useWaveZoom(span, MIN_SPAN, source);
  const fineGame = finePeaks(zoom, gameWave.peaks?.duration_ms), fineMine = finePeaks(zoom, mineWave.peaks?.duration_ms);
  const gameFine = usePeaks("vanilla", fineGame && !none ? source : null, "", fineGame);
  const mineFine = usePeaks("project", fineMine && audible(a) ? source : null, String(revision), fineMine);
  const game = gameFine.peaks ?? gameWave.peaks, mine = mineFine.peaks ?? mineWave.peaks;
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

  const hasCues = !!seg.segment;
  const o = project?.segment_overrides[seg.segment] ?? {};
  const fit = a?.fit_timing ?? true;
  // what the build writes: with "fit timing", entry 0 and exit at the clip's end, unless a cue point overrides it
  const autoEntry = fit ? 0 : seg.entry_ms ?? 0;
  const autoExit = fit ? mine?.duration_ms ?? 0 : seg.exit_ms ?? seg.duration_ms;
  const entry = o.entry_marker ?? autoEntry;
  const exit = o.exit_marker ?? autoExit;

  const gameMarkers: Marker[] = hasCues && seg.exit_ms != null
    ? [{ id: "entry", ms: seg.entry_ms ?? 0, label: ENTRY, about: ENTRY_ABOUT }, { id: "exit", ms: seg.exit_ms, label: EXIT, about: EXIT_ABOUT }] : [];
  const myMarkers: Marker[] = hasCues && mine
    ? [{ id: "entry", ms: entry, label: ENTRY, about: ENTRY_DRAG, draggable: true, min: 0, max: exit - 50 },
       { id: "exit", ms: exit, label: EXIT, about: EXIT_DRAG, draggable: true, min: entry + 50, max: mine.duration_ms }] : [];

  const commit = (id: string, ms: number, how: "drag" | "key") => {
    // a drag that ends near the automatic spot snaps back onto it, clearing the override; a key's 10 ms step never does
    const near = (x: number, y: number) => how === "drag" && Math.abs(x - y) < 15;
    const e = id === "entry" ? (near(ms, autoEntry) ? null : ms) : o.entry_marker ?? null;
    const x = id === "exit" ? (near(ms, autoExit) ? null : ms) : o.exit_marker ?? null;
    actions.segmentOverride(seg.segment, e, x);
  };
  const overridden = o.entry_marker != null || o.exit_marker != null;
  const tail = mine ? mine.duration_ms - exit : 0;
  const last = fmtTime(tail);

  return (
    <section className={`timeline${readOnly ? " one" : ""}`} aria-label={t`Waveforms`} style={{ height: h ?? (readOnly ? HEIGHT_ONE : HEIGHT) }}>
      <ResizeEdge edge="top" label={t`Resize the waveforms`} min={readOnly ? 120 : 140} max={room} onResize={setH} onReset={() => setH(readOnly ? HEIGHT_ONE : HEIGHT)} />
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
              <div className="tl-label mine"><b>{t`Replaced`}</b><span>{a?.silence ? t({ message: "silence", comment: "In place of the length of the new audio: the slot plays silence" }) : a ? fmtTime(mine?.duration_ms) : ""}</span>{mineDb !== 0 && <Db db={mineDb} />}{audible(a) && mineCurve && <CurveLabel />}</div>
              {a?.silence ? (
                <div className="wave placeholder">{a.fit_timing ? t`Silence: plays nothing, and the game moves straight on`
                  : t`Silence: plays nothing for the length of the original, so the timing doesn't change`}</div>
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
