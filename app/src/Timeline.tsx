import { useMemo } from "react";
import { audioUrl, fmtTime, type Cue } from "./api";
import { audible, rowName, rowsOf, SILENCE_TIP } from "./CueView";
import { throughHead, throughSeek, type Through } from "./PlayThrough";
import { player, usePlayer, type PlayedAt } from "./player";
import { SlotFacts } from "./Inspector";
import { ResizeEdge, useStoredHeight } from "./Resize";
import { useEditor } from "./store";
import { usePeaks, Waveform, type Marker } from "./Waveform";

/** The selected slot as two waveforms on one time scale: the original above, the replacement below, with the
    segment's entry and exit cue points. The replacement's can be dragged; the original's show where the game's sit.
    The Library has the original alone. A click plays from that spot (the slot's row has the play buttons).

    While the cue plays through (`through`), the playhead shows where the play-through is in this slot's audio, and a
    click on a waveform moves the play-through to that spot.

    `cue` and `source` show a slot of another cue than the tab's (the Soundtrack's segment), else the tab's own cue
    and its selected slot. */
const HEIGHT = 210;
const HEIGHT_ONE = 190; // the Library's: the game's waveform under the slot's facts
// what the cue points do, in the flags' tooltips
const ENTRY_ABOUT = "The segment counts as started here. Audio before it plays under the end of the segment before";
const EXIT_ABOUT = "The next segment starts here. Audio after it rings out over the next one";

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
  const none = !!(row?.slot.absent || row?.slot.added); // "No audio", or a new take: no original to draw
  const gameWave = usePeaks("vanilla", none ? null : source);
  const mineWave = usePeaks("project", audible(a) ? source : null, String(revision));
  const game = gameWave.peaks, mine = mineWave.peaks;
  if (!row || !source) return null;

  const { seg } = row;
  const what = rowName(row);
  const span = Math.max(game?.duration_ms ?? 0, mine?.duration_ms ?? 0, 1);
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
      `${what} · ${kind === "vanilla" ? "original" : "replaced"}`, at ?? { scope, itemId: null, cueId: cue?.id ?? null, source });
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
    ? [{ id: "entry", ms: seg.entry_ms ?? 0, label: "Entry", about: ENTRY_ABOUT }, { id: "exit", ms: seg.exit_ms, label: "Exit", about: EXIT_ABOUT }] : [];
  const myMarkers: Marker[] = hasCues && mine
    ? [{ id: "entry", ms: entry, label: "Entry", about: `${ENTRY_ABOUT}. Drag to move it`, draggable: true, min: 0, max: exit - 50 },
       { id: "exit", ms: exit, label: "Exit", about: `${EXIT_ABOUT}. Drag to move it`, draggable: true, min: entry + 50, max: mine.duration_ms }] : [];

  const commit = (id: string, ms: number, how: "drag" | "key") => {
    // a drag that ends near the automatic spot snaps back onto it, clearing the override; a key's 10 ms step never does
    const near = (x: number, y: number) => how === "drag" && Math.abs(x - y) < 15;
    const e = id === "entry" ? (near(ms, autoEntry) ? null : ms) : o.entry_marker ?? null;
    const x = id === "exit" ? (near(ms, autoExit) ? null : ms) : o.exit_marker ?? null;
    actions.segmentOverride(seg.segment, e, x);
  };
  const overridden = o.entry_marker != null || o.exit_marker != null;
  const tail = mine ? mine.duration_ms - exit : 0;

  return (
    <section className={`timeline${readOnly ? " one" : ""}`} aria-label="Waveforms" style={{ height: h ?? (readOnly ? HEIGHT_ONE : HEIGHT) }}>
      <ResizeEdge edge="top" label="Resize the waveforms" min={readOnly ? 120 : 140} max={room} onResize={setH} onReset={() => setH(readOnly ? HEIGHT_ONE : HEIGHT)} />
      {readOnly && <SlotFacts row={row} />}
      <div className="tl-row">
        <div className="tl-label game"><b>Original</b><span>{fmtTime(game?.duration_ms)}</span></div>
        <Waveform peaks={game} spanMs={span} tone="game" markers={gameMarkers} playheadMs={head(kGame, false, game?.duration_ms)}
          activeFrom={hasCues ? seg.entry_ms ?? 0 : undefined} activeTo={hasCues ? seg.exit_ms ?? undefined : undefined}
          onSeek={none ? undefined : (ms) => seek("vanilla", ms)}
          label={row.slot.added ? "A new take has no original" : row.slot.absent ? "Not in the installed game files" : "Loading the original…"}
          error={gameWave.error} onRetry={gameWave.retry} />
      </div>
      {!readOnly && (
        <div className="tl-row">
          <div className="tl-label mine"><b>Replaced</b><span>{a?.silence ? "silence" : a ? fmtTime(mine?.duration_ms) : ""}</span></div>
          {a?.silence ? (
            <div className="wave placeholder">Silence: {a.fit_timing ? SILENCE_TIP.move.toLowerCase() : SILENCE_TIP.keep.toLowerCase()}</div>
          ) : a?.exists ? (
            <Waveform peaks={mine} spanMs={span} tone="mine" markers={myMarkers} playheadMs={head(kMine, true, mine?.duration_ms)}
              activeFrom={hasCues ? entry : undefined} activeTo={hasCues ? exit : undefined}
              onSeek={(ms) => seek("project", ms)}
              onMarkerCommit={commit} label="Reading the new audio…" error={mineWave.error} onRetry={mineWave.retry} />
          ) : (
            <div className="wave placeholder">{a ? "File missing" : "Not replaced"}</div>
          )}
        </div>
      )}
      {audible(a) && hasCues && (
        <p className="tl-note">
          {fit ? "Drag Exit to move where the next segment starts" : "Fit timing is off, so the original cue points apply until one is moved"}
          {tail > 30 && <>. The last <b>{fmtTime(tail)}</b> rings out over the next segment</>}.
          {overridden && <button className="link-inline" onClick={() => actions.segmentOverride(seg.segment, null, null)}>Reset cue points</button>}
        </p>
      )}
    </section>
  );
}
