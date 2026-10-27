import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { audioUrl, call, fileUrl, fmtTime, type Cue } from "./api";
import { rowName, rowsOf, type Row } from "./CueView";
import { useDialog } from "./dialog";
import { pickAudio } from "./platform";
import { player, usePlayer, usePlayerLook } from "./player";
import { useEditor } from "./store";
import { useTheme } from "./theme";
import { loadPeaks, wheelZoom, WaveZoom, ZOOM_Y_MAX, type Peaks, type WaveZoomState } from "./Waveform";
import { Help } from "./Wiki";

/** The slice tool: cuts one song into consecutive pieces and fills a cue's slots with them in play order, one piece
    per segment. The cuts are exact to the sample, so pieces played back to back sound like the uncut song.

    The song and the original sit on one time scale. The song's lane shows the cuts and the slot each piece goes to;
    the original lane shows each slot's original audio starting at its piece's cut, so a piece longer or shorter than
    the clip it replaces shows at a glance, and by how much. The wheel (time; Ctrl: the level) or the zoom beside the lanes zoom, Shift+wheel or the
    overview strip scroll; cuts drag (snapping to the original's length), a double-click adds one, Delete removes the
    selected one, the arrow keys nudge it. */

type Info = Peaks & { previous: number[] | null };
/** How the cuts were placed: the original's proportions over the song, the original's lengths as they are, evenly,
    or by hand (a cut was dragged, added or removed). A new number of pieces is placed the same way. */
type Layout = "proportions" | "lengths" | "even" | "custom";
type View = { from: number; span: number }; // the stretch of the song across the lanes, in ms

const KEY = "slice";       // the player key the song plays under
const MIN_PIECE = 100;     // ms: no piece is shorter
const MIN_SPAN = 400;      // ms: the closest the view zooms in
const SNAP_PX = 7;         // a cut dragged this close to where the original before it ends snaps onto that spot
const MAX_PIECES = 64;
const LANES = { ruler: 22, song: 116, original: 74 };

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const even = (count: number, from: number, to: number) => Array.from({ length: count + 1 }, (_, i) => Math.round(from + ((to - from) * i) / count));
/** Cuts in the proportions of the original lengths, stretched over from..to. */
function proportions(lens: number[], from: number, to: number) {
  const total = sum(lens) || 1;
  let t = from;
  const out = [from, ...lens.map((l) => Math.round((t += ((to - from) * l) / total)))];
  out[out.length - 1] = to;
  return out;
}
/** Cuts at the original lengths as they are, from `from` on, as many as fit before the song's end (the last piece
    takes what is left when that is long enough). */
function lengths(lens: number[], from: number, end: number) {
  const out = [from];
  for (const l of lens) {
    const at = out[out.length - 1] + l;
    if (at <= end) { out.push(Math.round(at)); continue; }
    if (end - out[out.length - 1] >= MIN_PIECE) out.push(end);
    break;
  }
  return out.length > 1 ? out : [from, end];
}
/** No piece shorter than MIN_PIECE (the core refuses one): a cut that leaves one goes, so the piece joins the next
    (the last joins the one before). */
function tidy(b: number[]) {
  const out = [b[0]];
  for (let i = 1; i < b.length; i++) {
    if (b[i] - out[out.length - 1] >= MIN_PIECE) out.push(b[i]);
    else if (i === b.length - 1) { if (out.length > 1) out[out.length - 1] = b[i]; else out.push(b[i]); }
  }
  return out;
}
/** A different number of pieces, keeping the hand-placed cuts: the longest piece splits in two, or the shortest
    merges into its shorter neighbour. */
function recount(bounds: number[], count: number) {
  const b = [...bounds];
  while (b.length - 1 < count) {
    let at = 0;
    for (let i = 1; i < b.length - 1; i++) if (b[i + 1] - b[i] > b[at + 1] - b[at]) at = i;
    if (b[at + 1] - b[at] < 2 * MIN_PIECE) break;
    b.splice(at + 1, 0, Math.round((b[at] + b[at + 1]) / 2));
  }
  while (b.length - 1 > count && b.length > 2) {
    let at = 0;
    for (let i = 1; i < b.length - 1; i++) if (b[i + 1] - b[i] < b[at + 1] - b[at]) at = i;
    // drop the cut between it and its shorter neighbour (the first piece can only merge forwards, the last backwards)
    const left = at > 0 ? b[at] - b[at - 1] : Infinity, right = at < b.length - 2 ? b[at + 2] - b[at + 1] : Infinity;
    b.splice(left <= right ? at : at + 1, 1);
  }
  return b;
}

/** The slots a song's pieces can go to from `start` on, in play order: one per segment, since a segment's layers
    play together. Where a segment has several, the one on the same layer (and variant) as `start`. */
function targetsFrom(rows: Row[], start: Row | undefined): Row[] {
  if (!start) return [];
  const bySeg = new Map<number, Row[]>();
  for (const r of rows) if (r.segIndex >= start.segIndex) bySeg.set(r.segIndex, [...(bySeg.get(r.segIndex) ?? []), r]);
  return [...bySeg.values()].map((of) => (of[0].segIndex === start.segIndex ? start
    : of.find((r) => r.stemIndex === start.stemIndex && r.slot.variant === start.slot.variant)
      ?? of.find((r) => r.stemIndex === start.stemIndex) ?? of[0]));
}
const originalMs = (r: Row) => r.slot.duration_ms || r.seg.duration_ms || 0;
/** A piece's length against its original's: "+0.8 s" longer, "−1.2 s" shorter, "=" within 50 ms. */
function diffText(ms: number) {
  if (Math.abs(ms) < 50) return "=";
  return `${ms > 0 ? "+" : "−"}${(Math.abs(ms) / 1000).toFixed(Math.abs(ms) < 10000 ? 1 : 0)} s`;
}

/** A song for the Soundtrack: the piece of music's cue, the segments the song fills in order (a piece each, into
    the first slot that takes audio), and what saving it does. */
export type SongTarget = { cue: Cue; segments: string[]; fill: (file: string, boundsMs: number[]) => Promise<boolean> };

/** `file`: the song to start on (one dropped, or the song a piece was cut from), else the picker opens. */
export function SliceTool({ onClose, target, file: given }: { onClose: () => void; target?: SongTarget; file?: string }) {
  const editor = useEditor();
  const { selected, actions, notify } = editor;
  const cue = target?.cue ?? editor.cue;
  const box = useDialog(onClose);
  const rows = useMemo(() => (cue ? rowsOf(cue.segments_detail).filter((r) => !r.slot.unused && !r.slot.locked && !r.slot.absent) : []), [cue]);
  const fixed = useMemo(() => (target ? target.segments.flatMap((seg) => rows.find((r) => r.seg.segment === seg) ?? []) : null), [target, rows]);
  // the pieces go From one slot To another: one piece per segment between them
  const [start, setStart] = useState(() => (rows.find((r) => r.slot.source === selected[0]) ?? rows[0])?.slot.source ?? "");
  const [stop, setStop] = useState(""); // the To slot; none chosen yet: as far as the cue goes
  const startRow = rows.find((r) => r.slot.source === start);
  const reach = useMemo(() => (fixed ?? targetsFrom(rows, startRow)).slice(0, MAX_PIECES), [fixed, rows, startRow]); // what To offers
  const targets = useMemo(() => {
    const i = reach.findIndex((r) => r.slot.source === stop);
    return reach.slice(0, i >= 0 ? i + 1 : reach.length);
  }, [reach, stop]);
  const lens = useMemo(() => targets.map(originalMs), [targets]);
  const [file, setFile] = useState<string | null>(null);
  const [info, setInfo] = useState<Info | null>(null);
  const [bounds, setBounds] = useState<number[]>([]);
  // the stretch of the song the pieces come from: all of it, unless the Start or End cut was moved by hand. Every
  // layout places its cuts within it (Original lengths can end before its end, and that doesn't shrink it)
  const [span, setSpan] = useState({ from: 0, to: 0 });
  const [layout, setLayout] = useState<Layout>("proportions");
  const [view, setView] = useState<View>({ from: 0, span: 1 });
  const [sel, setSel] = useState<number | null>(null); // the selected cut, for the keys
  const [busy, setBusy] = useState(false);
  const n = Math.max(0, bounds.length - 1);
  const total = info?.duration_ms ?? 1;
  const known = lens.every((l) => l > 0);

  /** Cuts for one piece per slot of `slots`, over the stretch, placed the `how` way. */
  const place = (how: Layout, slots: Row[], over = span, now = bounds): number[] => {
    const { from, to } = over;
    const ls = slots.map(originalMs), sure = ls.every((l) => l > 0);
    const room = Math.max(1, Math.floor((to - from) / MIN_PIECE)); // a short song has room for fewer pieces
    const k = Math.max(1, Math.min(slots.length, room));
    if (how === "lengths" && sure) return tidy(lengths(ls.slice(0, k), from, to));
    if (how === "proportions" && sure) return tidy(proportions(ls.slice(0, k), from, to));
    if (how === "custom" && now.length > 1) return tidy(recount(now, k));
    return tidy(even(k, from, to));
  };

  const choose = async () => {
    const f = (await pickAudio(false))?.[0];
    if (f) load(f); // cancelled: the dialog stays, with its own Choose button
  };
  const load = async (f: string) => {
    setFile(f); setInfo(null);
    try {
      const i = await call<Info>("slice_info", { audio: f });
      setInfo(i);
      setView({ from: 0, span: i.duration_ms });
      setSel(null);
      const prev = i.previous; // the cuts this song had last time, unless they no longer fit (or leave a piece too short)
      if (prev && prev.length - 1 <= reach.length && prev[prev.length - 1] <= i.duration_ms + 1 && tidy(prev).length === prev.length) {
        setBounds(prev); setLayout("custom");
        setSpan({ from: prev[0], to: prev[prev.length - 1] });
        setStop(reach[prev.length - 2].slot.source);
      } else {
        const how: Layout = known ? "proportions" : "even";
        setLayout(how);
        setSpan({ from: 0, to: i.duration_ms });
        setBounds(place(how, targets, { from: 0, to: i.duration_ms }));
      }
    } catch (e: any) { notify("bad", e.message); setFile(null); }
  };
  // other From and To slots: the cuts placed again for as many pieces, the same way (cuts placed by hand are kept,
  // with pieces split or merged)
  const targetKey = targets.map((r) => r.slot.source).join();
  const placedFor = useRef(targetKey);
  useEffect(() => {
    if (placedFor.current === targetKey) return;
    placedFor.current = targetKey;
    if (info && bounds.length && (layout !== "custom" || targets.length !== n)) { setBounds(place(layout, targets)); setSel(null); }
  }, [targetKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // the song given, or the picker straight away, once (React runs a new component's effects twice in development)
  const asked = useRef(false);
  useEffect(() => { if (!asked.current) { asked.current = true; if (given) load(given); else choose(); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // leaving stops what the dialog played (the song, a piece, an original)
  useEffect(() => () => { if (player.state.key?.startsWith(KEY) || player.state.key?.startsWith("vanilla:")) player.stop(); }, []);

  // ---- the view: zoom about a spot, scroll, show a stretch
  const clampView = useCallback((v: View): View => {
    const span = Math.max(Math.min(MIN_SPAN, total), Math.min(total, v.span));
    return { span, from: Math.max(0, Math.min(total - span, v.from)) };
  }, [total]);
  const zoom = useCallback((factor: number, atMs?: number) => setView((v) => {
    const at = atMs ?? v.from + v.span / 2, span = v.span / factor;
    return clampView({ span, from: at - ((at - v.from) / v.span) * span });
  }), [clampView]);
  const fit = () => setView({ from: 0, span: total });
  // the zoom column at the right of the lanes, as beside the waveforms (Waveform.tsx): time zooms this view, and
  // the level zoom draws both lanes taller
  const [tall, setTall] = useState(1);
  const sliceZoom: WaveZoomState = {
    x: total / view.span, y: tall, maxX: Math.max(1, total / MIN_SPAN), from: view.from, span: view.span, total,
    zoomed: view.span < total || tall > 1,
    zoomX: (x, atMs) => zoom(x / (total / view.span), atMs),
    zoomY: (y) => setTall(Math.max(1, Math.min(ZOOM_Y_MAX, y))),
    scroll: (from) => setView((v) => clampView({ ...v, from })),
    reset: () => { fit(); setTall(1); },
  };
  /** Brings a stretch into view, zooming out only when it doesn't fit. */
  const reveal = (from: number, to: number) => setView((v) => {
    if (from >= v.from && to <= v.from + v.span) return v;
    const span = Math.max(v.span, (to - from) * 1.15);
    return clampView({ span, from: (from + to) / 2 - span / 2 });
  });

  // ---- editing the cuts
  const apply = (how: Layout) => {
    if (!info || !bounds.length) return;
    setLayout(how);
    setBounds(place(how, targets));
    setSel(null);
  };
  const moveCut = (i: number, ms: number) => {
    setBounds((b) => b.map((x, j) => (j === i ? ms : x)));
    // the Start or End cut moved by hand: the pieces come from the new stretch of the song
    if (i === 0) setSpan((s) => ({ ...s, from: ms }));
    else if (i === n) setSpan((s) => ({ ...s, to: ms }));
    setLayout("custom");
  };
  const addCut = (ms: number) => {
    if (n >= reach.length) { notify("info", `No room for another piece. This cue has ${reach.length} slot${reach.length === 1 ? "" : "s"} from ${startRow ? rowName(startRow) : "here"}.`); return; }
    const i = bounds.findIndex((b) => b > ms);
    if (i <= 0 || ms - bounds[i - 1] < MIN_PIECE || bounds[i] - ms < MIN_PIECE) return;
    setBounds((b) => [...b.slice(0, i), Math.round(ms), ...b.slice(i)]);
    setLayout("custom");
    setStop(reach[n].slot.source); // one more piece: To moves on by a slot
    setSel(i);
  };
  const removeCut = (i: number) => {
    if (i <= 0 || i >= n) return; // the start and the end stay
    setBounds((b) => b.filter((_, j) => j !== i));
    setLayout("custom");
    setStop(reach[n - 2].slot.source);
    setSel(null);
  };

  // ---- playing
  const song = file ? fileUrl(file) : "";
  // the originals played one after another (Play the originals): the piece playing now, or null
  const inTurn = useRef<number | null>(null);
  /** Plays the song from a spot, or one piece (`piece`: its own key, so its button shows it playing). */
  const playSong = (fromMs: number, toMs?: number, piece?: number) => {
    inTurn.current = null;
    if (file) player.playFrom(piece === undefined ? KEY : `${KEY}:${piece}`, song, fromMs / 1000, toMs !== undefined ? toMs / 1000 : undefined,
      `Slice · ${file.split(/[\\/]/).pop()}`);
  };
  const playOriginal = (i: number, offsetMs = 0, next = false) => {
    const r = targets[i];
    inTurn.current = next ? i : null;
    if (r) player.playFrom(`vanilla:${r.slot.source}`, audioUrl("vanilla", r.slot.source), offsetMs / 1000, undefined,
      next ? `Originals · ${i + 1} of ${n} · ${rowName(r)}` : `${rowName(r)} · original`);
  };
  useEffect(() => player.onEnded((key) => {
    const i = inTurn.current;
    if (i === null || key !== `vanilla:${targets[i]?.slot.source}`) return;
    if (i + 1 < n) playOriginal(i + 1, 0, true); else inTurn.current = null;
  }), [targets, n]); // eslint-disable-line react-hooks/exhaustive-deps
  const look = usePlayer();
  const songOn = look.playing && look.key === KEY;
  const originalsOn = look.playing && inTurn.current !== null && look.key === `vanilla:${targets[inTurn.current]?.slot.source}`;

  // the dialog's keys (the app's own are off while a dialog is open)
  const latest = useRef({ sel, n, bounds, info, total });
  latest.current = { sel, n, bounds, info, total };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as Element).closest?.("input, select, textarea")) return;
      const { sel: s, n: count, bounds: b, info: inf, total: end } = latest.current;
      if (!inf) return;
      if (e.key === " ") {
        e.preventDefault();
        if (!player.toggle()) playSong(s !== null ? b[s] : b[0]);
      } else if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && s !== null) {
        e.preventDefault();
        const step = (e.key === "ArrowLeft" ? -1 : 1) * (e.shiftKey ? 100 : e.altKey ? 1 : 10);
        const lo = s === 0 ? 0 : b[s - 1] + MIN_PIECE, hi = s === count ? end : b[s + 1] - MIN_PIECE;
        moveCut(s, Math.max(lo, Math.min(hi, b[s] + step)));
      } else if ((e.key === "Delete" || e.key === "Backspace") && s !== null) {
        e.preventDefault(); removeCut(s);
      } else if (e.key === "+" || e.key === "=") zoom(1.5);
      else if (e.key === "-") zoom(1 / 1.5);
      else if (e.key === "0") setView({ from: 0, span: end });
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }); // the latest handlers every render; latest.current carries the state

  if (!cue) return null;
  const submit = async () => {
    if (!file || !n || tooShort) return;
    setBusy(true);
    const ok = target ? await target.fill(file, bounds) : await actions.sliceFill(cue.id, file, bounds, targets.slice(0, n).map((r) => r.slot.source));
    setBusy(false);
    if (ok) onClose();
  };
  const tooShort = !!info && info.duration_ms < MIN_PIECE; // shorter than one piece can be
  const slotName = (r: Row) => `${rowName(r)}${r.slot.variant ? ` (${r.slot.variant})` : ""}`;

  return (
    <div className="modal-back" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal slice" role="dialog" aria-modal="true" aria-label="Slice a song into this cue" ref={box} tabIndex={-1}>
        <div className="pop-head">
          <h2>Slice a song into {cue.name}</h2>
          <Help tip="Drag a cut to move it, and hold Shift to stop it snapping to the original length. Double-click the song to add a cut. Delete removes the selected cut, and ←/→ nudge it (Shift moves 100 ms, Alt moves 1 ms). The wheel zooms in on time, Ctrl+wheel on the level, Shift+wheel scrolls, and Space plays." page="timing-and-loops#slicing-one-long-song" />
          <span className="spacer" />
          <button className="x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {!file || !info ? (
          <div className="slice-empty">
            <p>{file ? "Reading the song…" : "Choose a song to cut into the slots."}</p>
            {!file && <button className="btn primary" onClick={choose}>Choose a song…</button>}
          </div>
        ) : (
          <>
            <div className="slice-bar">
              <span className="slice-file" data-tip={file} data-tip-clip>{file.split(/[\\/]/).pop()}</span>
              <span className="muted">{fmtTime(info.duration_ms)}</span>
              <button className="btn small-btn" onClick={choose} data-tip="Choose another song">Change…</button>
              <span className="spacer" />
              {!target && (
                <label className="slice-field" data-tip="The slot that gets the first piece">From
                  <select value={start} onChange={(e) => setStart(e.target.value)}>
                    {rows.map((r) => <option key={r.slot.source} value={r.slot.source}>{slotName(r)}</option>)}
                  </select>
                </label>
              )}
              <label className="slice-field" data-tip="The slot that gets the last piece"
                data-tip-more={target ? "Each segment up to here gets one piece of the song" : "Each slot from From to here gets one piece of the song"}>To
                <select value={targets[targets.length - 1]?.slot.source ?? ""} onChange={(e) => setStop(e.target.value)}>
                  {reach.map((r, i) => <option key={r.slot.source} value={r.slot.source}>{slotName(r)} · {i + 1} piece{i ? "s" : ""}</option>)}
                </select>
              </label>
              {n < targets.length && <span className="muted slice-through" data-tip="The song is too short for a piece in every slot">{n} of {targets.length} slots</span>}
            </div>

            <div className="slice-tools">
              <button className={`btn small-btn play-btn${songOn ? " on" : ""}`} onClick={() => (songOn ? player.toggle() : playSong(bounds[0]))}
                data-tip="Play the song from the first cut">{songOn ? "❚❚" : "▶"} Song</button>
              <button className={`btn small-btn play-btn${originalsOn ? " on" : ""}`} onClick={() => (originalsOn ? player.toggle() : playOriginal(0, 0, true))}
                data-tip="Play the originals one after another">{originalsOn ? "❚❚" : "▶"} Originals</button>
              <div className="segmented" role="radiogroup" aria-label="Place the cuts">
                {([["proportions", "Original proportions", "The whole song, cut in the proportions of the originals", ""],
                  ["lengths", "Original lengths", "Each piece as long as the original, so the timing stays the same", "The song after the last piece is left out"],
                  ["even", "Even", "The whole song, in pieces of equal length", ""]] as const).map(([how, label, tip, more]) => (
                  <button key={how} role="radio" aria-checked={layout === how} className={layout === how ? "on" : ""} data-tip={tip} data-tip-more={more || undefined}
                    disabled={how !== "even" && !known} onClick={() => apply(how)}>{label}</button>
                ))}
              </div>
              {layout === "custom" && <span className="muted small">Placed by hand</span>}
            </div>

            <div className="slice-zoomed zoom-grid">
              <div className="slice-view">
                <Lanes info={info} bounds={bounds} targets={targets} view={view} tall={tall} sel={sel} setSel={setSel} waveZoom={sliceZoom}
                  moveCut={moveCut} addCut={addCut} playSong={playSong} playOriginal={playOriginal} />
                <Overview info={info} bounds={bounds} view={view} setView={(v) => setView(clampView(v))} />
              </div>
              <WaveZoom zoom={sliceZoom} />
            </div>

            <div className="slice-list" role="table" aria-label="Pieces">
              <div className="slice-piece head" role="row">
                <span /><span>#</span><span>Slot</span><span data-tip="Where the piece starts and ends in the song">Cut</span>
                <span className="num" data-tip="How long the piece is">New</span><span /><span className="num" data-tip="How long the original is">Original</span>
                <span className="num" data-tip="How much longer (+) or shorter (−) the piece is than the original">Difference</span>
              </div>
              {targets.slice(0, n).map((r, i) => {
                const len = bounds[i + 1] - bounds[i], orig = lens[i], d = len - orig;
                return (
                  <div key={r.slot.source} role="row" className={`slice-piece${sel === i ? " on" : ""}`}
                    onClick={() => { setSel(i); reveal(bounds[i], bounds[i + 1]); }}>
                    <PieceButton k={`${KEY}:${i}`} label={`piece ${i + 1}`} onPlay={() => playSong(bounds[i], bounds[i + 1], i)} tone="project" />
                    <span className="piece-n">{i + 1}</span>
                    <span className="piece-slot" data-tip={rowName(r)} data-tip-clip>{rowName(r)}{r.slot.variant ? ` · ${r.slot.variant}` : ""}</span>
                    <span className="piece-len">{fmtTime(bounds[i])} – {fmtTime(bounds[i + 1])}</span>
                    <span className="piece-len num mine">{fmtTime(len)}</span>
                    <PieceButton k={`vanilla:${r.slot.source}`} label={`the original ${rowName(r)}`} onPlay={() => playOriginal(i)} tone="vanilla" />
                    <span className="piece-len num">{orig ? fmtTime(orig) : "–"}</span>
                    <span className={`piece-len num diff${!orig ? "" : Math.abs(d) < 50 ? " same" : ""}`}>{orig ? diffText(d) : ""}</span>
                  </div>
                );
              })}
            </div>
            <div className="modal-foot">
              <span className="muted small">{tooShort ? `This song is shorter than ${MIN_PIECE} ms and can't be cut.`
                : <>Pieces are saved in the project's <code>audio\slices</code> folder.</>}</span>
              <span className="spacer" />
              <button className="btn quiet" onClick={onClose}>Cancel</button>
              <button className="btn primary" disabled={busy || n < 1 || tooShort} onClick={submit}>
                {busy ? "Slicing…" : target ? `Cut into ${n} piece${n === 1 ? "" : "s"}` : `Slice and fill ${n} slot${n === 1 ? "" : "s"}`}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** A play button that follows its own key in the player: a piece of the song (`slice:<n>`) or an original. */
function PieceButton({ k, label, onPlay, tone }: { k: string; label: string; onPlay: () => void; tone: "project" | "vanilla" }) {
  const { playing } = usePlayerLook(k);
  return (
    <button className={`play small ${tone}${playing ? " playing" : ""}`} aria-label={`${playing ? "Pause" : "Play"} ${label}`} data-tip={`${playing ? "Pause" : "Play"} ${label}`}
      onClick={(e) => { e.stopPropagation(); if (playing) player.toggle(); else onPlay(); }}>
      <span aria-hidden>{playing ? "❚❚" : "▶"}</span>
    </button>
  );
}

/** The song and the originals on one time scale, with a ruler, the cuts (dragged, added, nudged) and the playheads.
    Drawn on a canvas: a song's waveform is up to 120,000 peaks, and only the part in view is drawn. */
function Lanes({ info, bounds, targets, view, tall, sel, setSel, waveZoom, moveCut, addCut, playSong, playOriginal }: {
  info: Info; bounds: number[]; targets: Row[]; view: View; tall: number /* the level zoom */; sel: number | null; setSel: (i: number | null) => void;
  waveZoom: WaveZoomState; // the zoom beside the lanes: the wheel works it too
  moveCut: (i: number, ms: number) => void; addCut: (ms: number) => void;
  playSong: (fromMs: number, toMs?: number, piece?: number) => void; playOriginal: (i: number, offsetMs?: number) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [drag, setDrag] = useState<number | null>(null);
  const look = useTheme();
  const n = bounds.length - 1;
  const height = LANES.ruler + LANES.song + LANES.original;
  const x = (ms: number) => ((ms - view.from) / view.span) * width;
  const msAt = (clientX: number) => {
    const r = wrap.current!.getBoundingClientRect();
    return view.from + ((clientX - r.left) / r.width) * view.span;
  };

  // the originals' peaks, as they come
  const [orig, setOrig] = useState<Record<string, Peaks>>({});
  useEffect(() => {
    let live = true;
    for (const r of targets.slice(0, n)) {
      if (orig[r.slot.source]) continue;
      loadPeaks("vanilla", r.slot.source).then((p) => { if (live) setOrig((o) => ({ ...o, [r.slot.source]: p })); }, () => {});
    }
    return () => { live = false; };
  }, [targets, n]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = wrap.current!;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // the wheel as on the waveforms (wheelZoom): time about the pointer, Ctrl the level, Shift scrolls
  const wz = useRef(waveZoom);
  wz.current = waveZoom;
  useEffect(() => {
    const el = wrap.current!;
    const wheel = (e: WheelEvent) => { e.preventDefault(); wheelZoom(e, wz.current, el.getBoundingClientRect()); };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !width) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(width * dpr); c.height = Math.round(height * dpr);
    const g = c.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, width, height);
    const css = getComputedStyle(c);
    const v = (name: string) => css.getPropertyValue(name).trim();
    const font = `${Math.round(11 * (Number(v("--fs")) || 1))}px ${v("--body")}`;
    const songTop = LANES.ruler, origTop = LANES.ruler + LANES.song;

    // ruler: a tick every "nice" step that keeps labels ~80 px apart
    const steps = [100, 200, 500, 1000, 2000, 5000, 10000, 15000, 30000, 60000, 120000, 300000];
    const step = steps.find((s) => (s / view.span) * width >= 80) ?? steps[steps.length - 1];
    g.fillStyle = v("--faint"); g.strokeStyle = v("--line"); g.font = font; g.textBaseline = "middle";
    for (let t = Math.ceil(view.from / step) * step; t <= view.from + view.span; t += step) {
      const px = Math.round(x(t)) + 0.5;
      g.beginPath(); g.moveTo(px, LANES.ruler - 6); g.lineTo(px, LANES.ruler); g.stroke();
      g.fillText(step < 1000 ? `${(t / 1000).toFixed(1)} s` : fmtTime(t), px + 3, LANES.ruler / 2 - 1);
    }
    g.fillStyle = v("--line"); g.fillRect(0, origTop, width, 1);

    // alternate bands per piece, the selected piece stronger
    for (let i = 0; i < n; i++) {
      if (i % 2 && sel !== i) continue;
      g.fillStyle = sel === i ? v("--second-dim") : v("--band");
      g.globalAlpha = sel === i ? 0.22 : 1;
      g.fillRect(x(bounds[i]), songTop, x(bounds[i + 1]) - x(bounds[i]), LANES.song + LANES.original);
      g.globalAlpha = 1;
    }

    // a waveform over [x0, x1): peaks spread over durationMs, starting at startMs on the time scale
    const wave = (p: Peaks, startMs: number, top: number, h: number, from: number, to: number, bright: string, dim: string, inside: (ms: number) => boolean) => {
      const N = p.peaks.length, mid = top + h / 2, full = p.full ?? 255;
      const x0 = Math.max(0, Math.floor(x(Math.max(from, startMs)))), x1 = Math.min(width, Math.ceil(x(Math.min(to, startMs + p.duration_ms))));
      for (let px = x0; px < x1; px++) {
        const a = view.from + (px / width) * view.span - startMs, b = view.from + ((px + 1) / width) * view.span - startMs;
        let i0 = Math.floor((a / p.duration_ms) * N), i1 = Math.ceil((b / p.duration_ms) * N);
        i0 = Math.max(0, i0); i1 = Math.min(N, Math.max(i0 + 1, i1));
        let peak = 0;
        for (let i = i0; i < i1; i++) if (p.peaks[i] > peak) peak = p.peaks[i];
        const ms = startMs + a, hh = Math.max(1, Math.min(1, (peak / full) * tall) * (h - 8));
        const on = inside(ms);
        g.fillStyle = on ? bright : dim; g.globalAlpha = on ? 0.9 : 0.4;
        g.fillRect(px, mid - hh / 2, 1, hh);
      }
      g.globalAlpha = 1;
    };
    wave(info, 0, songTop, LANES.song, 0, info.duration_ms, v("--accent-fg"), v("--accent-dim"), (ms) => ms >= bounds[0] && ms <= bounds[n]);

    // the originals: each from its piece's cut, cut short at the next cut. Where the original runs past the cut, a
    // red edge says by how much; where it ends early, a dashed line marks its end and the rest of the piece is hatched
    g.font = font;
    for (let i = 0; i < n; i++) {
      const r = targets[i];
      if (!r) break;
      const from = bounds[i], to = bounds[i + 1], len = originalMs(r), p = orig[r.slot.source];
      if (x(to) < 0 || x(from) > width) continue;
      const end = from + len;
      if (p) wave(p, from, origTop, LANES.original, from, Math.min(to, end), v("--steel"), v("--steel-dim"), () => true);
      else { g.fillStyle = v("--band"); g.fillRect(x(from), origTop + 8, x(Math.min(to, end)) - x(from), LANES.original - 16); }
      if (!len) continue;
      const d = (to - from) - len;
      if (Math.abs(d) < 50) continue;
      if (d < 0) { // the original is longer: it would run on past this cut
        g.fillStyle = v("--red"); g.fillRect(x(to) - 2, origTop + 4, 2, LANES.original - 8);
      } else { // the original ends before the cut
        const ex = Math.round(x(end)) + 0.5;
        g.strokeStyle = v("--steel-dim"); g.setLineDash([3, 3]);
        g.beginPath(); g.moveTo(ex, origTop + 4); g.lineTo(ex, origTop + LANES.original - 4); g.stroke(); g.setLineDash([]);
      }
      const label = diffText(d), lw = g.measureText(label).width + 8;
      if (x(to) - x(from) > lw + 6) {
        g.fillStyle = v("--raised"); g.fillRect(x(to) - lw - 4, origTop + LANES.original - 18, lw, 15);
        g.fillStyle = d < 0 ? v("--red") : v("--muted"); g.textBaseline = "middle";
        g.fillText(label, x(to) - lw, origTop + LANES.original - 10);
      }
    }
  }, [info, bounds, targets, orig, view, tall, width, height, sel, n, look]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Where the cut `i` may go, and the spot it snaps to: where the original before it ends. */
  const limits = (i: number) => ({
    lo: i === 0 ? 0 : bounds[i - 1] + MIN_PIECE,
    hi: i === n ? info.duration_ms : bounds[i + 1] - MIN_PIECE,
    snap: i === 0 ? 0 : bounds[i - 1] + originalMs(targets[i - 1] ?? targets[0]),
  });
  const dragTo = (i: number, clientX: number, free: boolean) => {
    const { lo, hi, snap } = limits(i);
    let ms = msAt(clientX);
    if (!free && Math.abs(x(ms) - x(snap)) < SNAP_PX) ms = snap;
    moveCut(i, Math.round(Math.max(lo, Math.min(hi, ms))));
  };

  const pieceAt = (ms: number) => { const i = bounds.findIndex((b) => b > ms) - 1; return i >= 0 && i < n ? i : -1; };
  return (
    <div className="slice-lanes">
      <div className="slice-lane-labels" aria-hidden>
        <span style={{ height: LANES.ruler }} />
        <b className="mine" style={{ height: LANES.song }} data-tip="The song, cut into pieces" data-tip-more="A click plays from there, and a double-click adds a cut">New audio</b>
        <b className="game" style={{ height: LANES.original }} data-tip="Each original starts at the cut of the piece that replaces it"
          data-tip-more="A red edge marks an original that runs past the next cut, and a dashed line one that ends before it">Original</b>
      </div>
      <div className="slice-canvas" ref={wrap} style={{ height }}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest(".slice-cut")) return;
          const ms = msAt(e.clientX), y = e.clientY - wrap.current!.getBoundingClientRect().top;
          setSel(null);
          if (y < LANES.ruler + LANES.song) { playSong(Math.max(0, ms)); return; }
          const i = pieceAt(ms);
          if (i >= 0 && ms - bounds[i] < originalMs(targets[i])) playOriginal(i, ms - bounds[i]);
        }}
        onDoubleClick={(e) => {
          const y = e.clientY - wrap.current!.getBoundingClientRect().top;
          if (y < LANES.ruler || y >= LANES.ruler + LANES.song) return;
          addCut(msAt(e.clientX));
          if (player.state.key === KEY) player.stop(); // the double-click's first click played the song from there
        }}>
        <canvas ref={canvas} style={{ width: "100%", height }} />
        {/* what each piece is: its number and its slot, at the top of its band */}
        {targets.slice(0, n).map((r, i) => {
          const left = Math.max(0, x(bounds[i])), right = Math.min(width, x(bounds[i + 1]));
          return right - left > 18 ? (
            <span key={r.slot.source} className="slice-tag" style={{ left: left + 4, maxWidth: right - left - 8, top: LANES.ruler + 3 }}>
              <b>{i + 1}</b> {rowName(r)}
            </span>
          ) : null;
        })}
        {bounds.map((ms, i) => {
          const px = x(ms);
          if (px < -8 || px > width + 8) return null;
          const name = i === 0 ? "Start" : i === n ? "End" : `Cut ${i}`;
          return (
            <div key={i} className={`slice-cut${sel === i ? " on" : ""}${drag === i ? " dragging" : ""}${i === 0 || i === n ? " edge" : ""}${i === n ? " end" : ""}`}
              style={{ transform: `translateX(${px}px)`, top: LANES.ruler, height: LANES.song + LANES.original }}
              role="slider" tabIndex={0} aria-label={name} aria-valuenow={Math.round(ms)} aria-valuetext={fmtTime(ms)}
              data-tip={drag === null ? `${name} at ${fmtTime(ms)}` : undefined} data-tip-side="top"
              data-tip-more={i === 0 ? "Drag it to leave out the start of the song" : i === n ? "Drag it to leave out the end of the song" : undefined}
              onFocus={() => setSel(i)}
              onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); setDrag(i); setSel(i); }}
              onPointerMove={(e) => { if (drag === i) dragTo(i, e.clientX, e.shiftKey); }}
              onPointerUp={() => setDrag(null)} onPointerCancel={() => setDrag(null)}
              onDoubleClick={(e) => e.stopPropagation()}>
              {(i === 0 || i === n || drag === i) && <span className="slice-cut-flag">{drag === i ? fmtTime(ms) : name}</span>}
            </div>
          );
        })}
        <Heads bounds={bounds} targets={targets} x={x} />
      </div>
    </div>
  );
}

/** Where the song or an original is playing, as a line on its lane. Its own component: playback moves it every
    frame, and only it draws then. */
function Heads({ bounds, targets, x }: { bounds: number[]; targets: Row[]; x: (ms: number) => number }) {
  const p = usePlayer();
  if (!p.key) return null;
  if (p.key === KEY || p.key.startsWith(`${KEY}:`)) {
    return <div className="playhead" style={{ transform: `translateX(${x(p.time * 1000)}px)`, top: LANES.ruler, height: LANES.song }} />;
  }
  const i = targets.findIndex((r) => p.key === `vanilla:${r.slot.source}`);
  if (i < 0 || i >= bounds.length - 1) return null;
  return <div className="playhead game" style={{ transform: `translateX(${x(bounds[i] + p.time * 1000)}px)`, top: LANES.ruler + LANES.song, height: LANES.original }} />;
}

/** The whole song small, with the cuts and the stretch in view: click or drag it to move the view. */
function Overview({ info, bounds, view, setView }: { info: Info; bounds: number[]; view: View; setView: (v: View) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const look = useTheme();
  const H = 30;
  useEffect(() => {
    const el = wrap.current!;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el); setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const c = canvas.current;
    if (!c || !width) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(width * dpr); c.height = Math.round(H * dpr);
    const g = c.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, width, H);
    const css = getComputedStyle(c), v = (k: string) => css.getPropertyValue(k).trim();
    const N = info.peaks.length;
    g.fillStyle = v("--accent-dim");
    for (let px = 0; px < width; px++) {
      const i0 = Math.floor((px / width) * N), i1 = Math.max(i0 + 1, Math.floor(((px + 1) / width) * N));
      let peak = 0;
      for (let i = i0; i < i1 && i < N; i++) if (info.peaks[i] > peak) peak = info.peaks[i];
      const h = Math.max(1, (peak / 255) * (H - 6));
      g.fillRect(px, H / 2 - h / 2, 1, h);
    }
    g.fillStyle = v("--muted");
    for (const b of bounds) g.fillRect(Math.round((b / info.duration_ms) * width), 0, 1, H);
  }, [info, bounds, width, look]);
  const left = (view.from / info.duration_ms) * width, w = Math.max(6, (view.span / info.duration_ms) * width);
  const goTo = (clientX: number) => {
    const r = wrap.current!.getBoundingClientRect();
    setView({ span: view.span, from: ((clientX - r.left) / r.width) * info.duration_ms - view.span / 2 });
  };
  return (
    <div className="slice-overview" ref={wrap} style={{ height: H }} aria-hidden
      onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); goTo(e.clientX); }}
      onPointerMove={(e) => { if (e.buttons) goTo(e.clientX); }}>
      <canvas ref={canvas} style={{ width: "100%", height: H }} />
      <div className="slice-viewport" style={{ transform: `translateX(${left}px)`, width: w }} />
    </div>
  );
}
