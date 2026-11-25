import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { audioUrl, call, fileUrl, fmtDecimal, fmtExact, fmtTime, type Block } from "./api";
import { confirm } from "./Confirm";
import { useDialog } from "./dialog";
import { AddAudioIcon, CloseIcon, DuplicateIcon, ExportIcon, GripIcon, LoopIcon, MagnetIcon, NormalizeIcon, PauseIcon, PlayIcon, PlusIcon, RedoIcon,
  RemoveIcon, ResetIcon, SplitIcon, StopIcon, TrashIcon, UndoIcon } from "./Icons";
import { fullPath, pickAudio, pickAudioToSave } from "./platform";
import { player, usePlayer } from "./player";
import { useEditor } from "./store";
import { useWaveZoom, WaveScroll, WaveZoom, wheelZoom, type WaveZoomState } from "./Waveform";
import { Help } from "./Wiki";

/** The Waveform Editor: the audio of one slot as blocks on a time line, so that basic editing needs no other program.
    Each block is a stretch of one file placed at a time of its own, with a fade in, a fade out and a gain. Blocks
    are trimmed at their edges, moved by their body (also to another layer), split at the cursor, duplicated and
    removed, and their fades are dragged from the grips at their top corners. The magnet snaps the cursor, edges and
    blocks to each other, to the start, and to where the original ends.

    Blocks sit on layers: lanes, one under the other, that only keep blocks apart to see and reach them; a block
    plays the same on any. Layers are added, reordered by their grip, resized by their bottom edge and deleted (one
    with blocks asks first). Each lane, the original's too, has a box: Play plays the lanes ticked, and Export writes
    them to a file; Apply keeps every layer. The lanes playing pulse in their colour.

    Selecting: a click picks the shortest block under it, and another click on the same spot the next one under it,
    so a block under a longer one is never out of reach. Dragging from an empty spot draws a box that selects every
    block it touches, on any layer; Shift or Ctrl adds to the selection, or takes a block out of it. Selected blocks
    move, duplicate, split, normalize and go together. The cursor moves by a click, by dragging it, or along the
    ruler.

    It edits the new audio of a slot, or the original (the result then becomes the new audio, as a copy does). The
    original's waveform runs along the top for reference. Nothing changes in the project until Apply; the core then
    makes the audio a build uses from the same blocks (core audio.edited), so what plays here is what the game plays.
    Playback here is Web Audio, at once, from the decoded files. */

const MIN_BLOCK = 10;   // ms: the shortest block (the core's MIN_TRIM_MS)
const MIN_SPAN = 20;    // ms: the closest the view zooms in
const SNAP_PX = 8;      // the magnet's reach
const EDGE_PX = 6;      // how near an edge a press trims instead of moving
const GRIP_PX = 7;      // a fade grip's half size
const CURSOR_PX = 5;    // how near the cursor a press takes hold of it
const NUDGE = 10;       // ms an arrow key moves a block (Shift: ×10)
const LANES = { ruler: 24, original: 64 };
const LAYER = { h: 120, min: 48, max: 320, pad: 6 }; // a layer's height, as it starts and as far as it resizes; a block's inset
const MAX_LAYERS = 32;  // the core's MAX_LAYERS
const BUCKET = 64;      // frames per level in the summary of a file
const DOUBLE_MS = 400;  // a second click this soon after the first is a double click, which plays instead of picking
const PULSE_S = 1.4;    // one breath of the lanes playing

type Kind = "move" | "trimL" | "trimR" | "fadeIn" | "fadeOut" | "cursor" | "box";
type Drag = {
  kind: Kind; i: number; x0: number; y0: number; from: Block[]; moved: boolean;
  again: boolean; under: number[]; // pressed on the one block selected; the blocks under the press, shortest first
  group: number[]; base: number[]; add: boolean; // the blocks a move takes; what a box adds to; Shift or Ctrl held
};
type Decoded = { buf: AudioBuffer; levels: Float32Array };
type Hit = { kind: Kind; i: number; under: number[] };
/** Audio to put in as blocks: a file (whole), or the blocks a copied slot plays (each naming its file). */
type Incoming = { audio: string; blocks?: Block[] };
type ExportPrefs = { fmt: string; rate: number; channels: number; normalize: boolean };

const lengthOf = (b: Block) => b.end_ms - b.start_ms;
const lastIndex = <T,>(xs: T[], f: (x: T) => boolean) => { for (let i = xs.length - 1; i >= 0; i--) if (f(xs[i])) return i; return -1; };
const endOf = (b: Block) => b.at_ms + lengthOf(b);
const layerOf = (b: Block) => b.layer ?? 0;
const round1 = (v: number) => Math.round(v * 10) / 10;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const range = (from: number, n: number) => Array.from({ length: n }, (_, i) => from + i);
const clean = (b: Block): Block => ({ start_ms: round1(b.start_ms), end_ms: round1(b.end_ms), at_ms: round1(Math.max(0, b.at_ms)),
  fade_in_ms: round1(Math.max(0, b.fade_in_ms)), fade_out_ms: round1(Math.max(0, b.fade_out_ms)), gain_db: round1(b.gain_db),
  ...(b.audio ? { audio: b.audio } : {}), ...(b.layer ? { layer: Math.round(b.layer) } : {}) });
/** A block with its fades kept inside it, after its length or a fade changed. */
const fitted = (b: Block): Block => { const len = lengthOf(b), fi = clamp(b.fade_in_ms, 0, len); return { ...b, fade_in_ms: fi, fade_out_ms: clamp(b.fade_out_ms, 0, len - fi) }; };
const nameOf = (path: string) => path.split(/[\\/]/).pop() ?? path;
const FULL = /^([a-z]:[\\/]|[\\/])/i; // a full path (a file just added), not one the project stores
const EXPORT_FORMATS: [string, string, string][] = [ // id (the core's EDIT_EXPORTS), name, extension
  ["wav24", "WAV · 24-bit", "wav"], ["wav16", "WAV · 16-bit", "wav"], ["flac", "FLAC", "flac"], ["mp3", "MP3 · 320 kbps", "mp3"], ["ogg", "Ogg Vorbis", "ogg"]];
const EXPORT_KEY = "audiodiver.waveExport";

/** Audio dropped on the open editor: App.tsx hands it here (one editor is open at a time). */
let dropInto: ((paths: string[]) => void) | null = null;
export function waveDrop(paths: string[]) { dropInto?.(paths); }
function onWaveDrop(f: (paths: string[]) => void) { dropInto = f; return () => { if (dropInto === f) dropInto = null; }; }

/** Follows a press to its release, anywhere on the page: `move` and `up` get how far it went down (px). */
function follow(e: React.PointerEvent, move: (dy: number) => void, up: (dy: number) => void) {
  e.preventDefault(); e.stopPropagation();
  const y0 = e.clientY;
  const mv = (ev: PointerEvent) => move(ev.clientY - y0);
  const done = (ev: PointerEvent) => {
    window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", done); window.removeEventListener("pointercancel", done);
    up(ev.clientY - y0);
  };
  window.addEventListener("pointermove", mv); window.addEventListener("pointerup", done); window.addEventListener("pointercancel", done);
}

/** The loudest sample of every BUCKET frames, over all channels: enough to draw a file at any zoom but the deepest. */
function summarize(buf: AudioBuffer): Float32Array {
  const n = Math.ceil(buf.length / BUCKET), out = new Float32Array(n);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < n; i++) {
      let m = out[i];
      for (let j = i * BUCKET, e = Math.min(d.length, j + BUCKET); j < e; j++) { const v = d[j] < 0 ? -d[j] : d[j]; if (v > m) m = v; }
      out[i] = m;
    }
  }
  return out;
}

/** The loudest level of a file between two moments (ms), from the summary, or from the samples when zoomed in close. */
function levelAt(f: Decoded, fromMs: number, toMs: number): number {
  const rate = f.buf.sampleRate;
  const a = Math.max(0, Math.floor((fromMs / 1000) * rate)), b = Math.min(f.buf.length, Math.ceil((toMs / 1000) * rate));
  if (b <= a) return 0;
  let m = 0;
  if (b - a < BUCKET * 2) {
    for (let c = 0; c < f.buf.numberOfChannels; c++) {
      const d = f.buf.getChannelData(c);
      for (let i = a; i < b; i++) { const v = d[i] < 0 ? -d[i] : d[i]; if (v > m) m = v; }
    }
    return m;
  }
  for (let i = Math.floor(a / BUCKET), e = Math.min(f.levels.length, Math.ceil(b / BUCKET)); i < e; i++) if (f.levels[i] > m) m = f.levels[i];
  return m;
}

/** The level a block plays at, a moment into it: its gain, and its fades as straight lines in level. */
function envelope(b: Block, intoMs: number) {
  const len = lengthOf(b);
  let k = 10 ** (b.gain_db / 20);
  if (b.fade_in_ms > 0 && intoMs < b.fade_in_ms) k *= Math.max(0, intoMs / b.fade_in_ms);
  if (b.fade_out_ms > 0 && intoMs > len - b.fade_out_ms) k *= Math.max(0, (len - intoMs) / b.fade_out_ms);
  return k;
}

/** Blocks that overlap another on the same layer: each gets a colour of its own (by its place among them), the rest
    the primary colour. */
function colours(blocks: Block[]): (number | null)[] {
  const out: (number | null)[] = blocks.map(() => null);
  let n = 0;
  blocks.forEach((b, i) => {
    if (blocks.some((o, j) => j !== i && layerOf(o) === layerOf(b) && o.at_ms < endOf(b) && b.at_ms < endOf(o))) out[i] = n++;
  });
  return out;
}

async function decode(url: string, ctx: BaseAudioContext): Promise<Decoded> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  const buf = await ctx.decodeAudioData(await res.arrayBuffer());
  return { buf, levels: summarize(buf) };
}

export function WaveEditor({ source, what, original, onClose }: { source: string; what: string; original: boolean; onClose: () => void }) {
  const { project, actions, quick, notify } = useEditor();
  const a = project?.assignments[source];
  const vol = usePlayer().volume;
  // one audio context while the editor is open (made in the effect, so a second mount in development gets its own)
  const [ctx, setCtx] = useState<AudioContext | null>(null);
  useEffect(() => {
    let c: AudioContext;
    try { c = new AudioContext({ sampleRate: 48000 }); } catch { c = new AudioContext(); }
    setCtx(c);
    return () => { void c.close().catch(() => {}); };
  }, []);

  // the files: the slot's own (key ""; none for a slot without new audio, built from added files), every other file a
  // block names (by the path it carries: as the project stores it, or a full path just added), and the original for
  // reference (the slot's own when the original is edited)
  const [mode, setMode] = useState<"original" | "mine">(original ? "original" : "mine");
  const editOriginal = mode === "original";
  const hasOwn = editOriginal || (!!a && !a.silence);
  const [files, setFiles] = useState<Record<string, Decoded>>({});
  const [ref, setRef] = useState<Decoded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const urlOf = useCallback((key: string) => (key === ""
    ? (editOriginal || !a || !project ? audioUrl("vanilla", source) : fileUrl(fullPath(project.folder, a.audio)))
    : fileUrl(FULL.test(key) || !project ? key : fullPath(project.folder, key))), [editOriginal, a, project, source]);
  const asked = useRef(new Set<string>());
  const need = useCallback((key: string) => {
    if (!ctx || asked.current.has(key)) return;
    asked.current.add(key);
    decode(urlOf(key), ctx).then((f) => setFiles((x) => ({ ...x, [key]: f })),
      (e) => { if (key === "") setError(String(e?.message ?? e)); });
  }, [ctx, urlOf]);
  useEffect(() => { if (hasOwn) need(""); }, [hasOwn, need]);
  useEffect(() => {
    if (!ctx) return;
    let live = true;
    decode(audioUrl("vanilla", source), ctx).then((f) => { if (live) setRef(f); }, () => { /* no original (a new take): no reference */ });
    return () => { live = false; };
  }, [ctx, source]);
  const file = files[""] ?? null;
  const reference = editOriginal ? file : ref;
  const fileMs = file ? file.buf.duration * 1000 : 0;
  const refMs = reference ? reference.buf.duration * 1000 : 0;
  const fileOf = (b: Block) => files[b.audio ?? ""] ?? null;
  const msOfFile = (b: Block) => { const f = fileOf(b); return f ? f.buf.duration * 1000 : b.end_ms; };
  const ready = !hasOwn || !!file;
  const ownName = editOriginal ? t`Original` : a ? nameOf(a.audio) : "";

  // the blocks, with their history here (Undo inside the editor); `live` is a drag before it is let go
  const [hist, setHist] = useState<{ list: Block[][]; at: number }>({ list: [], at: 0 });
  const blocks = hist.list[hist.at] ?? [];
  const [live, setLive] = useState<Block[] | null>(null);
  const shown = live ?? blocks;
  const [sel, setSelRaw] = useState<number[]>([]); // the blocks selected, the one clicked last at the end
  const setSel = (v: number[]) => setSelRaw([...new Set(v)]);
  const picked = useMemo(() => new Set(sel.filter((i) => i < shown.length)), [sel, shown.length]);
  const one = sel.length === 1 && sel[0] < blocks.length ? sel[0] : null;
  const commit = useCallback((next: Block[]) => {
    setLive(null);
    setHist((h) => ({ list: [...h.list.slice(0, h.at + 1), next.map(clean)], at: h.at + 1 }));
  }, []);
  const start = useRef<Block[] | null>(null); // what the editor opened with: Apply is on once something differs
  useEffect(() => {
    if (hist.list.length || !ready) return;
    const ms = file ? file.buf.duration * 1000 : 0;
    const first: Block[] = !hasOwn ? []
      : editOriginal || !a ? [{ start_ms: 0, end_ms: ms, at_ms: 0, fade_in_ms: 0, fade_out_ms: 0, gain_db: 0 }]
      : a.blocks?.length ? a.blocks
      : [{ start_ms: a.start_ms ?? 0, end_ms: Math.min(ms, a.end_ms || ms), at_ms: a.delay_ms ?? 0, fade_in_ms: a.fade_in_ms, fade_out_ms: a.fade_out_ms, gain_db: 0 }];
    start.current = first.map(clean);
    for (const b of first) if (b.audio) need(b.audio);
    setHist({ list: [start.current], at: 0 });
    setSel(first.length ? [0] : []);
  }, [ready, mode]); // eslint-disable-line react-hooks/exhaustive-deps
  /** Starts again from the original (from the empty start of a slot without new audio). */
  const fromOriginal = () => { asked.current.delete(""); setFiles({}); start.current = null; setHist({ list: [], at: 0 }); setMode("original"); };
  const changed = !!start.current && JSON.stringify(blocks) !== JSON.stringify(start.current);
  const undo = () => { setLive(null); setSel([]); setHist((h) => ({ ...h, at: Math.max(0, h.at - 1) })); };
  const redo = () => { setLive(null); setSel([]); setHist((h) => ({ ...h, at: Math.min(h.list.length - 1, h.at + 1) })); };

  // --- the layers: as many as asked for, and at least one past the last a block is on (an Undo can bring one back);
  // their heights and boxes go with them, the box of the original apart; the layer worked on takes new audio
  const [asks, setAsks] = useState(1);
  const layers = clamp(Math.max(asks, ...shown.map((b) => layerOf(b) + 1)), 1, MAX_LAYERS);
  const [heights, setHeights] = useState<number[]>([]);
  const hOf = (i: number) => heights[i] ?? LAYER.h;
  const [plays, setPlays] = useState<boolean[]>([]);
  const playsOf = (i: number) => plays[i] ?? true;
  const [playOriginal, setPlayOriginal] = useState(false);
  const [active, setActive] = useState(0);
  const on = Math.min(active, layers - 1);
  const editTop = LANES.ruler + LANES.original;
  const lanes = useMemo(() => {
    const out: { top: number; h: number }[] = [];
    let top = editTop;
    for (let i = 0; i < layers; i++) { const h = heights[i] ?? LAYER.h; out.push({ top, h }); top += h; }
    return out;
  }, [layers, heights, editTop]);
  const height = editTop + lanes.reduce((s, l) => s + l.h, 0);
  /** The layer at a height on the canvas, or -1 above the layers. */
  const laneAt = (y: number) => { if (y < editTop) return -1; const i = lanes.findIndex((l) => y < l.top + l.h); return i < 0 ? layers - 1 : i; };
  const blockBox = (b: Block) => { const l = lanes[Math.min(layerOf(b), layers - 1)]; return { top: l.top + LAYER.pad, h: l.h - LAYER.pad * 2 }; };

  const resultMs = Math.max(0, ...shown.map(endOf));
  // the time line: everything there is and room after it to move a block into, from the blocks as let go (not while
  // a drag runs); it shrinks again when blocks go, and a zoomed-in view keeps showing as much time as before
  const total = Math.max(1000, Math.ceil((Math.max(fileMs, refMs, ...blocks.map(endOf)) * 1.12) / 100) * 100);
  const zoom = useWaveZoom(total, MIN_SPAN);
  const lastTotal = useRef(total);
  useEffect(() => {
    const was = lastTotal.current;
    lastTotal.current = total;
    if (was !== total && zoom.x > 1) zoom.zoomX(zoom.x * (total / was), zoom.from + zoom.span / 2);
  }, [total]); // eslint-disable-line react-hooks/exhaustive-deps
  const [cursor, setCursor] = useState(0);
  const [magnet, setMagnet] = useState(() => { try { return localStorage.getItem("audiodiver.waveMagnet") !== "0"; } catch { return true; } });
  useEffect(() => { try { localStorage.setItem("audiodiver.waveMagnet", magnet ? "1" : "0"); } catch { /* storage off */ } }, [magnet]);
  const [loop, setLoop] = useState(false);

  // --- playback: each block of the lanes ticked a buffer source with its gain and fades, from the cursor
  const play = useRef<{ nodes: AudioScheduledSourceNode[]; t0: number; from: number; to: number; timer: number } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [head, setHead] = useState<number | null>(null);
  const master = useMemo(() => { if (!ctx) return null; const g = ctx.createGain(); g.connect(ctx.destination); return g; }, [ctx]);
  useEffect(() => { if (master) master.gain.value = vol; }, [master, vol]);
  /** What Play plays: the blocks of the layers ticked, and the original when its box is ticked. */
  const heard = (list: Block[]) => {
    const out: { b: Block; f: Decoded }[] = [];
    for (const b of list) { const f = fileOf(b); if (f && playsOf(layerOf(b))) out.push({ b, f }); }
    if (playOriginal && reference) out.push({ b: { start_ms: 0, end_ms: refMs, at_ms: 0, fade_in_ms: 0, fade_out_ms: 0, gain_db: 0 }, f: reference });
    return out;
  };
  const audible = heard(shown);
  const stop = useCallback(() => {
    const p = play.current;
    play.current = null;
    if (p) { clearTimeout(p.timer); for (const n of p.nodes) { try { n.stop(); } catch { /* not started */ } n.disconnect(); } }
    setPlaying(false); setHead(null);
  }, []);
  useEffect(() => stop, [stop]);
  const startPlay = useCallback((fromMs: number) => {
    stop();
    if (!ctx || !master) return;
    const list = heard(live ?? blocks);
    if (!list.length) return;
    player.stop(); // the app's player and the editor never play over each other
    void ctx.resume();
    // a loop plays the selected blocks over and over, else the whole of what plays; from past the end, from the start
    const chosen = loop ? sel.filter((i) => i < blocks.length).map((i) => blocks[i]) : [];
    const to = chosen.length ? Math.max(...chosen.map(endOf)) : Math.max(...list.map((x) => endOf(x.b)));
    let from = chosen.length ? Math.min(...chosen.map((b) => b.at_ms)) : Math.max(0, fromMs);
    if (from >= to - 1) from = 0;
    if (from >= to) return;
    const t0 = ctx.currentTime + 0.04, nodes: AudioScheduledSourceNode[] = [];
    for (const { b, f } of list) {
      const len = lengthOf(b), into = Math.max(0, from - b.at_ms);
      if (endOf(b) <= from || b.at_ms >= to || into >= len) continue;
      const src = ctx.createBufferSource(), g = ctx.createGain();
      src.buffer = f.buf;
      src.connect(g).connect(master);
      const when = t0 + Math.max(0, b.at_ms - from) / 1000;
      const k = 10 ** (b.gain_db / 20), outAt = len - b.fade_out_ms;
      g.gain.setValueAtTime(envelope(b, into), when);
      if (b.fade_in_ms > into) g.gain.linearRampToValueAtTime(envelope(b, b.fade_in_ms), when + (b.fade_in_ms - into) / 1000);
      if (b.fade_out_ms > 0) {
        if (outAt > into) g.gain.setValueAtTime(b.fade_in_ms >= outAt ? envelope(b, outAt) : k, when + (outAt - into) / 1000);
        g.gain.linearRampToValueAtTime(0, when + (len - into) / 1000);
      }
      src.start(when, (b.start_ms + into) / 1000, (Math.min(len, to - b.at_ms) - into) / 1000);
      nodes.push(src);
    }
    const timer = window.setTimeout(() => {
      if (play.current?.timer !== timer) return;
      if (loop) startPlay(chosen.length ? from : 0);
      else stop();
    }, (to - from) / 1000 * 1000 + 60);
    play.current = { nodes, t0, from, to, timer };
    setPlaying(true);
  }, [ctx, master, files, reference, blocks, live, loop, sel, refMs, stop, plays, playOriginal]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!playing) return;
    let id = 0;
    const tick = () => {
      const p = play.current;
      if (p && ctx) setHead(p.from + Math.max(0, ctx.currentTime - p.t0) * 1000);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing, ctx]);
  const toggle = () => (playing ? stop() : startPlay(cursor));
  /** The lanes that sound while Play plays: the original (-1) and the layers ticked with blocks on them. */
  const sounding = useMemo(() => new Set([...(playOriginal && reference ? [-1] : []),
    ...shown.filter((b) => playsOf(layerOf(b))).map(layerOf)]), [shown, plays, playOriginal, reference]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- editing: on the selected blocks
  const chosen = () => sel.filter((i) => i < blocks.length);
  const set = (i: number, b: Partial<Block>) => commit(blocks.map((x, j) => (j === i ? { ...x, ...b } : x)));
  /** A change to every selected block (the values beside the time line with several selected), fades kept inside. */
  const setMany = (b: Partial<Block>) => commit(blocks.map((x, j) => (picked.has(j) ? fitted({ ...x, ...b }) : x)));
  const splitAt = (ms: number) => {
    const inside = (b: Block) => b.at_ms + MIN_BLOCK < ms && ms < endOf(b) - MIN_BLOCK;
    let cut = chosen().filter((i) => inside(blocks[i]));
    if (!cut.length) { const j = lastIndex(blocks, (b) => layerOf(b) === on && inside(b)); cut = [j >= 0 ? j : lastIndex(blocks, inside)].filter((i) => i >= 0); }
    if (!cut.length) return;
    const next: Block[] = [], rights: number[] = [];
    blocks.forEach((b, i) => {
      if (!cut.includes(i)) { next.push(b); return; }
      const at = b.start_ms + (ms - b.at_ms);
      next.push({ ...b, end_ms: at, fade_out_ms: 0, fade_in_ms: Math.min(b.fade_in_ms, at - b.start_ms) });
      rights.push(next.length);
      next.push({ ...b, start_ms: at, at_ms: ms, fade_in_ms: 0, fade_out_ms: Math.min(b.fade_out_ms, b.end_ms - at) });
    });
    commit(next);
    setSel(rights);
  };
  const removable = sel.length > 0 && !(hasOwn && chosen().length >= blocks.length);
  const remove = () => {
    if (!removable) return;
    commit(blocks.filter((_, j) => !picked.has(j)));
    setSel([]);
  };
  /** Copies of the selected blocks right after them, as they lie to each other; the copies are selected. */
  const duplicate = () => {
    const list = chosen().map((i) => blocks[i]);
    if (!list.length) return;
    const span = Math.max(...list.map(endOf)) - Math.min(...list.map((b) => b.at_ms));
    commit([...blocks, ...list.map((b) => ({ ...b, at_ms: b.at_ms + span }))]);
    setSel(range(blocks.length, list.length));
  };
  const normalize = () => {
    if (!sel.length) return;
    commit(blocks.map((b, j) => {
      const f = picked.has(j) ? fileOf(b) : null, peak = f ? levelAt(f, b.start_ms, b.end_ms) : 0;
      return peak > 0 ? { ...b, gain_db: clamp(20 * Math.log10(10 ** (-1 / 20) / peak), -60, 24) } : b;
    }));
  };
  const nudge = (by: number) => {
    const list = chosen();
    if (!list.length) { setCursor((c) => Math.max(0, c + by)); return; }
    const d = Math.max(by, -Math.min(...list.map((i) => blocks[i].at_ms)));
    if (d) commit(blocks.map((b, j) => (picked.has(j) ? { ...b, at_ms: b.at_ms + d } : b)));
  };
  const reset = () => {
    commit(hasOwn ? [{ start_ms: 0, end_ms: fileMs, at_ms: 0, fade_in_ms: 0, fade_out_ms: 0, gain_db: 0 }] : []);
    setSel(hasOwn ? [0] : []);
    setAsks(1); setActive(0); setPlays([]);
  };

  // --- layers
  const addLayer = () => { if (layers >= MAX_LAYERS) return; setAsks(layers + 1); setActive(layers); };
  const deleteLayer = async (i: number) => {
    if (layers < 2) return;
    const n = blocks.filter((b) => layerOf(b) === i).length;
    if (n && !(await confirm({ title: t`Delete Layer ${i + 1}?`,
      text: n === 1 ? t`The block on it is removed with it. Undo brings both back.` : t`The ${n} blocks on it are removed with it. Undo brings them back.`,
      ok: t`Delete` }))) return;
    if (blocks.some((b) => layerOf(b) >= i)) {
      commit(blocks.filter((b) => layerOf(b) !== i).map((b) => (layerOf(b) > i ? { ...b, layer: layerOf(b) - 1 } : b)));
      setSel([]);
    }
    setAsks(layers - 1);
    setHeights((h) => h.filter((_, j) => j !== i));
    setPlays((p) => p.filter((_, j) => j !== i));
    setActive((x) => (x > i ? x - 1 : x === i ? Math.max(0, i - 1) : x));
  };
  /** Moves a layer to another place among them: its blocks go along, as do its height, its box and the layer worked on. */
  const moveLayer = (from: number, to: number) => {
    if (from === to) return;
    const order = range(0, layers);
    order.splice(to, 0, ...order.splice(from, 1));
    const now = (i: number) => order.indexOf(i);
    if (blocks.some((b) => now(layerOf(b)) !== layerOf(b))) commit(blocks.map((b) => ({ ...b, layer: now(layerOf(b)) })));
    setHeights((h) => order.map((i) => h[i] ?? LAYER.h));
    setPlays((p) => order.map((i) => p[i] ?? true));
    setActive((x) => now(x));
  };
  const [reorder, setReorder] = useState<{ from: number; to: number; dy: number } | null>(null);
  const startReorder = (e: React.PointerEvent, from: number) => {
    if (e.button !== 0 || layers < 2) return;
    setActive(from);
    const centre = (i: number) => lanes[i].top + lanes[i].h / 2;
    const target = (dy: number) => lanes.filter((_, j) => j !== from && centre(j) < centre(from) + dy).length;
    setReorder({ from, to: from, dy: 0 });
    follow(e, (dy) => setReorder({ from, to: target(dy), dy }), (dy) => { setReorder(null); moveLayer(from, target(dy)); });
  };
  const startResize = (e: React.PointerEvent, i: number) => {
    if (e.button !== 0) return;
    const h0 = hOf(i);
    const to = (dy: number) => setHeights((h) => { const n = [...h]; for (let j = 0; j < layers; j++) n[j] ??= LAYER.h; n[i] = clamp(Math.round(h0 + dy), LAYER.min, LAYER.max); return n; });
    follow(e, to, to);
  };

  /** Puts audio in as blocks on the layer worked on, from the cursor: files whole, one after the other; a copied
      slot's blocks as they play there, each layer of them on a layer from this one down. */
  const [adding, setAdding] = useState(false);
  const insert = useCallback(async (items: Incoming[]) => {
    if (!ctx || !items.length) return;
    setAdding(true);
    const got: Block[] = [];
    const known: Record<string, Decoded> = {};
    const load = async (path: string) => {
      const f = known[path] ?? files[path] ?? await decode(urlOf(path), ctx);
      known[path] = f;
      asked.current.add(path);
      return f;
    };
    let at = cursor;
    for (const item of items) {
      try {
        if (item.blocks?.length) {
          const first = Math.min(...item.blocks.map((b) => b.at_ms)), top = Math.min(...item.blocks.map(layerOf));
          let end = at;
          for (const b of item.blocks) {
            const ms = (await load(b.audio || item.audio)).buf.duration * 1000;
            const stop_ = b.end_ms > b.start_ms && b.end_ms <= ms ? b.end_ms : ms;
            const nb = { ...b, audio: b.audio || item.audio, end_ms: round1(stop_), at_ms: round1(at + b.at_ms - first), layer: clamp(on + layerOf(b) - top, 0, MAX_LAYERS - 1) };
            got.push(nb); end = Math.max(end, endOf(nb));
          }
          at = end;
        } else {
          const ms = (await load(item.audio)).buf.duration * 1000;
          got.push({ start_ms: 0, end_ms: round1(ms), at_ms: round1(at), fade_in_ms: 0, fade_out_ms: 0, gain_db: 0, audio: item.audio, layer: on });
          at += ms;
        }
      } catch (e: any) { notify("bad", t`${nameOf(item.audio)} can't be read: ${String(e?.message ?? e)}`); }
    }
    setFiles((x) => ({ ...x, ...known }));
    setAdding(false);
    if (got.length) { commit([...blocks, ...got]); setSelRaw(range(blocks.length, got.length)); }
  }, [ctx, cursor, files, urlOf, blocks, commit, on]);
  const addFiles = async (paths?: string[]) => {
    paths ??= (await pickAudio(true)) ?? [];
    await insert(paths.map((audio) => ({ audio })));
  };
  /** Ctrl+V: what was copied last, slots in the list or files in Explorer (store clipForEditor). */
  const paste = async () => { if (ctx && !adding) await insert(await actions.clipForEditor()); };
  // audio dropped on the editor (App.tsx hands it over) comes in as added files
  useEffect(() => onWaveDrop((paths) => void insert(paths.map((audio) => ({ audio })))), [insert]);
  const [saving, setSaving] = useState(false);
  const apply = async () => {
    if (saving || !blocks.length) return;
    if (editOriginal && a && !a.silence && !(await confirm({ title: t`Replace the New Audio?`, text: t`The edited original becomes the new audio of this slot, in place of ${a.name}.`, ok: t`Replace` }))) return;
    setSaving(true);
    stop();
    const ok = await actions.setEdit(source, blocks, editOriginal, editOriginal ? t`${what} (edited original)` : undefined);
    setSaving(false);
    if (ok) onClose();
  };
  // --- Export: the lanes ticked, as one file
  const [exporting, setExporting] = useState(false);
  const exportable = blocks.some((b) => playsOf(layerOf(b))) || (playOriginal && !!reference);
  const doExport = async (prefs: ExportPrefs) => {
    const ext = EXPORT_FORMATS.find((f) => f[0] === prefs.fmt)?.[2] ?? "wav";
    const path = await pickAudioToSave(`${what} (edited).${ext}`.replace(/[\\/:*?"<>|]/g, "-"), ext);
    if (!path) return false;
    try {
      const got = await call<{ path: string }>("edit_export", { source, blocks: blocks.filter((b) => playsOf(layerOf(b))), path, fmt: prefs.fmt,
        rate: prefs.rate, channels: prefs.channels, normalize: prefs.normalize, original: editOriginal, with_original: playOriginal && !!reference });
      quick(t`Exported **${nameOf(got.path)}**`, "done");
      return true;
    } catch (e: any) { notify("bad", String(e?.message ?? e)); return false; }
  };
  const close = async () => {
    if (changed && !(await confirm({ title: t`Discard the Changes?`, text: t`The changes made in the Waveform Editor are lost.`, ok: t`Discard`, cancel: t`Keep Editing` }))) return;
    stop();
    onClose();
  };
  const box = useDialog(() => void close());

  // --- the canvas: the ruler, the original, the layers with their blocks, the cursor and the playhead
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const view = { from: zoom.from, span: zoom.span };
  const xOf = (ms: number) => ((ms - view.from) / view.span) * width;
  const msOf = (x: number) => view.from + (x / width) * view.span;
  const colourOf = useMemo(() => colours(shown), [shown]);
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(width * dpr); c.height = Math.round(height * dpr);
    const g = c.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const css = getComputedStyle(c);
    const v = (n: string) => css.getPropertyValue(n).trim();
    const palette = [v("--second-fg"), v("--green"), v("--red"), "#c792ea", "#5fd4c4", v("--accent-fg")];
    g.clearRect(0, 0, width, height);
    // the ruler: a tick on round times, labelled
    g.fillStyle = v("--panel"); g.fillRect(0, 0, width, LANES.ruler);
    const step = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 30000, 60000].find((s) => (s / view.span) * width >= 70) ?? 120000;
    g.font = `${11 * (parseFloat(v("--fs")) || 1)}px ${v("--body") || "sans-serif"}`;
    g.fillStyle = v("--muted"); g.strokeStyle = v("--line");
    for (let ms = Math.floor(view.from / step) * step; ms <= view.from + view.span; ms += step) {
      const x = Math.round(xOf(ms)) + 0.5;
      g.beginPath(); g.moveTo(x, LANES.ruler - 7); g.lineTo(x, LANES.ruler); g.stroke();
      g.fillText(step < 1000 ? `${fmtDecimal(ms / 1000, step < 10 ? 3 : step < 100 ? 2 : 1)} s` : fmtTime(ms), x + 3, LANES.ruler - 10);
    }
    const lane = (top: number, h: number, f: Decoded, from: number, to: number, at: number, colour: string, alpha: number, b?: Block) => {
      const mid = top + h / 2, x0 = Math.max(0, Math.floor(xOf(at))), x1 = Math.min(width, Math.ceil(xOf(at + to - from)));
      g.globalAlpha = alpha; g.fillStyle = colour;
      for (let x = x0; x < x1; x++) {
        const m0 = msOf(x) - at + from, m1 = msOf(x + 1) - at + from;
        let lv = levelAt(f, Math.max(from, m0), Math.min(to, m1)) * zoom.y;
        if (b) lv *= envelope(b, (m0 + m1) / 2 - from);
        const hh = Math.max(0.5, Math.min(1, lv) * (h / 2 - 3));
        g.fillRect(x, mid - hh, 1, hh * 2);
      }
      g.globalAlpha = 1;
    };
    g.fillStyle = v("--bg"); g.fillRect(0, LANES.ruler, width, height - LANES.ruler);
    // the lanes playing breathe in their colour (still, with the animations off)
    const still = document.documentElement.dataset.motion === "off";
    const breath = playing ? (still ? 0.6 : 0.5 + 0.5 * Math.sin((performance.now() / 1000) * ((2 * Math.PI) / PULSE_S))) : 0;
    const glow = (top: number, h: number, colour: string) => { g.fillStyle = colour; g.globalAlpha = 0.05 + 0.09 * breath; g.fillRect(0, top, width, h); g.globalAlpha = 1; };
    if (playing && sounding.has(-1)) glow(LANES.ruler, LANES.original, v("--steel"));
    if (reference) lane(LANES.ruler, LANES.original, reference, 0, refMs, 0, playing && sounding.has(-1) ? v("--steel") : v("--steel-dim"), 1);
    // the layers: the one worked on a shade lighter, each apart by a line
    lanes.forEach((l, i) => {
      if (i === on && layers > 1) { g.fillStyle = v("--panel"); g.globalAlpha = 0.45; g.fillRect(0, l.top, width, l.h); g.globalAlpha = 1; }
      if (playing && sounding.has(i)) glow(l.top, l.h, v("--accent-fg"));
      g.strokeStyle = v("--line-soft"); g.beginPath(); g.moveTo(0, l.top + 0.5); g.lineTo(width, l.top + 0.5); g.stroke();
    });
    // the blocks: the selected ones last, on top; each names its file when there are several; a layer not ticked dimmer
    const named = new Set(shown.map((b) => b.audio ?? "")).size > 1;
    const order = shown.map((_, i) => i).sort((x, y) => Number(picked.has(x)) - Number(picked.has(y)));
    for (const i of order) {
      const b = shown[i], ci = colourOf[i], colour = ci == null ? v("--accent-fg") : palette[ci % palette.length];
      const x0 = xOf(b.at_ms), x1 = xOf(endOf(b)), { top, h } = blockBox(b);
      if (x1 < 0 || x0 > width) continue;
      const see = ci != null, quiet = !playsOf(layerOf(b)); // overlapping: see-through, so both show
      g.globalAlpha = see ? 0.16 : 0.1; g.fillStyle = colour; g.fillRect(x0, top, x1 - x0, h); g.globalAlpha = 1;
      const bf = fileOf(b);
      if (bf) lane(top, h, bf, b.start_ms, b.end_ms, b.at_ms, colour, (see ? 0.55 : 0.9) * (quiet ? 0.45 : 1), b);
      if (named && x1 - x0 > 40 && h > 30) { // which file, at the foot of the block
        g.save(); g.beginPath(); g.rect(x0, top, x1 - x0, h); g.clip();
        g.fillStyle = colour; g.fillText(b.audio ? nameOf(b.audio) : ownName, Math.max(x0, 0) + 6, top + h - 6); g.restore();
      }
      // the fades: a shade over the part that fades, under a line from silence to full
      const fi = xOf(b.at_ms + b.fade_in_ms), fo = xOf(endOf(b) - b.fade_out_ms);
      g.fillStyle = v("--bg"); g.globalAlpha = 0.55; // the faded part, shaded with the page's own colour (any theme)
      if (b.fade_in_ms > 0) { g.beginPath(); g.moveTo(x0, top); g.lineTo(fi, top); g.lineTo(x0, top + h); g.closePath(); g.fill(); }
      if (b.fade_out_ms > 0) { g.beginPath(); g.moveTo(x1, top); g.lineTo(fo, top); g.lineTo(x1, top + h); g.closePath(); g.fill(); }
      g.globalAlpha = 1;
      g.strokeStyle = colour; g.lineWidth = 1.25;
      g.beginPath(); g.moveTo(x0, top + h); g.lineTo(fi, top); g.lineTo(fo, top); g.lineTo(x1, top + h); g.stroke();
      // the frame, and the fade grips at the top corners
      const isOn = picked.has(i);
      g.lineWidth = isOn ? 2 : 1; g.strokeStyle = isOn ? v("--text") : colour;
      g.strokeRect(x0 + (isOn ? 1 : 0.5), top + (isOn ? 1 : 0.5), x1 - x0 - (isOn ? 2 : 1), h - (isOn ? 2 : 1));
      g.lineWidth = 1;
      // the fade grips, on the top edge: filled in the block's colour on a selected block, outlined on the others
      for (const gx of [fi, fo]) {
        const gs = isOn ? GRIP_PX + 3 : GRIP_PX + 1, gy = top - gs / 2 + 1;
        g.fillStyle = isOn ? colour : v("--bg"); g.fillRect(gx - gs / 2, gy, gs, gs);
        g.lineWidth = 1.5; g.strokeStyle = isOn ? v("--text") : colour; g.strokeRect(gx - gs / 2, gy, gs, gs); g.lineWidth = 1;
      }
    }
    // where the original ends: what the new audio is usually fitted to
    if (refMs) {
      const x = Math.round(xOf(refMs)) + 0.5;
      g.setLineDash([4, 4]); g.strokeStyle = v("--steel"); g.globalAlpha = 0.7;
      g.beginPath(); g.moveTo(x, LANES.ruler); g.lineTo(x, height); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
    }
    // the box being drawn
    if (marquee) {
      const x = Math.min(marquee.x0, marquee.x1), y = Math.min(marquee.y0, marquee.y1), w = Math.abs(marquee.x1 - marquee.x0), hh = Math.abs(marquee.y1 - marquee.y0);
      g.fillStyle = v("--second-fg"); g.globalAlpha = 0.12; g.fillRect(x, y, w, hh); g.globalAlpha = 1;
      g.strokeStyle = v("--second-fg"); g.setLineDash([4, 3]); g.strokeRect(x + 0.5, y + 0.5, w, hh); g.setLineDash([]);
    }
    // the cursor, with its handle on the ruler, and the playhead while something plays
    const cx = Math.round(xOf(cursor)) + 0.5;
    g.strokeStyle = v("--second-fg"); g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, height); g.stroke();
    g.fillStyle = v("--second-fg"); g.beginPath(); g.moveTo(cx - 6, 0); g.lineTo(cx + 6, 0); g.lineTo(cx + 6, 6); g.lineTo(cx, 12); g.lineTo(cx - 6, 6); g.closePath(); g.fill();
    if (head != null) {
      const hx = Math.round(xOf(head)) + 0.5;
      g.strokeStyle = v("--text"); g.lineWidth = 1; g.beginPath(); g.moveTo(hx, LANES.ruler); g.lineTo(hx, height); g.stroke();
    }
  }); // drawn after every render: a drag, the playhead and the zoom all change what shows

  // --- the pointer: what a press at a spot takes, and the magnet
  const nearCursor = (x: number) => Math.abs(x - xOf(cursor)) <= CURSOR_PX;
  const hitAt = (x: number, y: number): Hit => {
    if (y < LANES.ruler) return { kind: "cursor", i: -1, under: [] }; // the ruler: the cursor goes along it
    const li = laneAt(y);
    if (li < 0) return { kind: nearCursor(x) ? "cursor" : "box", i: -1, under: [] };
    const here = shown.map((_, i) => i).filter((i) => layerOf(shown[i]) === li);
    const first = here.sort((p, q) => (picked.has(p) !== picked.has(q) ? (picked.has(p) ? -1 : 1) : lengthOf(shown[p]) - lengthOf(shown[q]))); // selected, then shortest
    for (const i of first) { // a fade grip, on the top edge
      const b = shown[i], { top } = blockBox(b);
      if (y < top + GRIP_PX + 3 && y > top - GRIP_PX - 2) {
        if (Math.abs(x - xOf(b.at_ms + b.fade_in_ms)) <= GRIP_PX) return { kind: "fadeIn", i, under: [] };
        if (Math.abs(x - xOf(endOf(b) - b.fade_out_ms)) <= GRIP_PX) return { kind: "fadeOut", i, under: [] };
      }
    }
    for (const i of first) { // an edge
      const b = shown[i], x0 = xOf(b.at_ms), x1 = xOf(endOf(b));
      if (Math.abs(x - x0) <= EDGE_PX && x <= x1) return { kind: "trimL", i, under: [] };
      if (Math.abs(x - x1) <= EDGE_PX && x >= x0) return { kind: "trimR", i, under: [] };
    }
    // the body: of the blocks under the spot, a selected one, else the shortest (a longer one shows elsewhere)
    const under = first.filter((i) => x >= xOf(shown[i].at_ms) && x <= xOf(endOf(shown[i]))).sort((p, q) => lengthOf(shown[p]) - lengthOf(shown[q]));
    if (under.length) return { kind: "move", i: under.find((i) => picked.has(i)) ?? under[0], under };
    return { kind: nearCursor(x) ? "cursor" : "box", i: -1, under: [] };
  };
  /** The nearest spot the magnet pulls to within reach of each candidate, or the candidates as they are. */
  const snap = (candidates: number[], skip: Set<number> | null, withCursor = true) => {
    if (!magnet) return 0;
    const reach = (SNAP_PX / width) * view.span;
    const spots = [0, ...(withCursor ? [cursor] : []), ...(refMs ? [refMs] : []), ...blocks.flatMap((b, j) => (skip?.has(j) ? [] : [b.at_ms, endOf(b)]))];
    let best = 0, dist = reach;
    for (const c of candidates) for (const s of spots) if (Math.abs(s - c) < dist) { dist = Math.abs(s - c); best = s - c; }
    return best;
  };
  const drag = useRef<Drag | null>(null);
  const lastUp = useRef(0);
  const local = (e: { clientX: number; clientY: number }) => {
    const r = wrap.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const reshape = (d: Drag, dx: number, y: number): Block[] => {
    const b = d.from[d.i], dms = (dx / width) * view.span;
    if (d.kind === "move") { // the blocks taken move together, in time and from layer to layer
      const group = d.group.map((j) => d.from[j]);
      const minAt = Math.min(...group.map((x) => x.at_ms)), maxEnd = Math.max(...group.map(endOf));
      let by = Math.max(-minAt, dms);
      by = Math.max(-minAt, by + snap([minAt + by, maxEnd + by], new Set(d.group)));
      const lo = -Math.min(...group.map(layerOf)), hi = layers - 1 - Math.max(...group.map(layerOf));
      const dl = clamp((y < editTop ? 0 : laneAt(y)) - layerOf(b), lo, hi);
      const moving = new Set(d.group);
      return d.from.map((x, j) => (moving.has(j) ? { ...x, at_ms: x.at_ms + by, layer: layerOf(x) + dl } : x));
    }
    const next = { ...b };
    if (d.kind === "trimL") {
      // the file stays put: the block starts later in the file and later on the line by the same amount
      let at = b.at_ms + dms;
      at += snap([at], new Set([d.i]));
      const by = Math.max(-b.start_ms, -b.at_ms, Math.min(at - b.at_ms, lengthOf(b) - MIN_BLOCK - b.fade_out_ms));
      Object.assign(next, { start_ms: b.start_ms + by, at_ms: b.at_ms + by, fade_in_ms: Math.max(0, Math.min(b.fade_in_ms, lengthOf(b) - by - b.fade_out_ms)) });
    } else if (d.kind === "trimR") {
      let end = endOf(b) + dms;
      end += snap([end], new Set([d.i]));
      const len = Math.max(MIN_BLOCK + b.fade_in_ms, Math.min(msOfFile(b) - b.start_ms, end - b.at_ms));
      Object.assign(next, { end_ms: b.start_ms + len, fade_out_ms: Math.max(0, Math.min(b.fade_out_ms, len - b.fade_in_ms)) });
    } else if (d.kind === "fadeIn") {
      next.fade_in_ms = Math.max(0, Math.min(lengthOf(b) - b.fade_out_ms, b.fade_in_ms + dms));
    } else if (d.kind === "fadeOut") {
      next.fade_out_ms = Math.max(0, Math.min(lengthOf(b) - b.fade_in_ms, b.fade_out_ms - dms));
    }
    return d.from.map((x, j) => (j === d.i ? next : x));
  };
  /** The blocks a box drawn on the canvas touches, on any layer. */
  const inBox = (m: { x0: number; y0: number; x1: number; y1: number }) => {
    const [l, r, tp, bt] = [Math.min(m.x0, m.x1), Math.max(m.x0, m.x1), Math.min(m.y0, m.y1), Math.max(m.y0, m.y1)];
    return shown.map((_, i) => i).filter((i) => {
      const b = shown[i], { top, h } = blockBox(b);
      return xOf(b.at_ms) <= r && xOf(endOf(b)) >= l && top <= bt && top + h >= tp;
    });
  };
  const [hover, setHover] = useState<Kind | null>(null);
  const cursorTo = (x: number) => { const ms = Math.max(0, msOf(x)); setCursor(Math.max(0, ms + snap([ms], null, false))); };
  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || !ready || (e.target as HTMLElement).closest("button")) return; // the empty start's buttons
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const { x, y } = local(e), hit = hitAt(x, y), li = laneAt(y), add = e.shiftKey || e.ctrlKey || e.metaKey;
    if (li >= 0) setActive(li);
    const base: Drag = { kind: hit.kind, i: hit.i, x0: x, y0: y, from: blocks, moved: false, again: false, under: hit.under, group: [], base: [], add };
    if (hit.i >= 0) {
      if (add && hit.kind === "move") { // Shift or Ctrl: in or out of the selection, nothing dragged
        setSel(picked.has(hit.i) ? sel.filter((j) => j !== hit.i) : [...sel, hit.i]);
        drag.current = null;
        return;
      }
      const inSel = picked.has(hit.i);
      if (!inSel) setSel([hit.i]);
      drag.current = { ...base, again: sel.length === 1 && sel[0] === hit.i, group: hit.kind === "move" && inSel ? [...picked] : [hit.i] };
      return;
    }
    drag.current = { ...base, base: add ? [...picked] : [] };
    if (hit.kind === "cursor") cursorTo(x);
  };
  const onMove = (e: React.PointerEvent) => {
    const { x, y } = local(e), d = drag.current;
    if (!d) { setHover(hitAt(x, y).kind); return; }
    if (!d.moved && Math.abs(x - d.x0) < 3 && (d.kind === "box" ? Math.abs(y - d.y0) < 3 : d.kind !== "move" || laneAt(y) === layerOf(d.from[d.i]))) return;
    d.moved = true;
    if (d.kind === "cursor") { cursorTo(x); return; }
    if (d.kind === "box") {
      const m = { x0: d.x0, y0: d.y0, x1: x, y1: y };
      setMarquee(m);
      setSel([...d.base, ...inBox(m)]);
      return;
    }
    setLive(reshape(d, x - d.x0, y));
  };
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    setMarquee(null);
    if (!d) return;
    const { x, y } = local(e), now = performance.now(), quick2 = now - lastUp.current < DOUBLE_MS;
    lastUp.current = now;
    if (d.kind === "cursor") return;
    if (d.kind === "box") { if (!d.moved) { cursorTo(x); if (!d.add) setSel([]); } return; } // a click on an empty spot: the cursor goes there
    if (d.moved) { commit(reshape(d, x - d.x0, y)); return; }
    // a click on a block: the cursor goes there, the block alone is selected; on the one block selected, where others
    // lie under it too, the next of them
    cursorTo(x); setLive(null);
    if (d.kind === "move" && d.again && !quick2 && d.under.length > 1) setSel([d.under[(d.under.indexOf(d.i) + 1) % d.under.length]]);
    else if (sel.length > 1) setSel([d.i]);
  };
  /** A double click: the cursor goes there and the lanes ticked play from there. */
  const onDouble = (e: React.MouseEvent) => {
    if (!ready || (e.target as HTMLElement).closest("button")) return;
    const { x } = local(e), ms = Math.max(0, msOf(x));
    const at = Math.max(0, ms + snap([ms], null, false));
    setCursor(at);
    startPlay(at);
  };
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const wz: { current: WaveZoomState } = { current: zoom };
    const wheel = (e: WheelEvent) => { e.preventDefault(); wheelZoom(e, wz.current, el.getBoundingClientRect()); };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [zoom]);

  // --- keys (not while typing in a field)
  const onKey = (e: React.KeyboardEvent) => {
    if (exporting || (e.target as HTMLElement).closest("input:not([type=checkbox]), textarea, select")) return;
    const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
    const did = () => { e.preventDefault(); e.stopPropagation(); };
    if (k === " ") { did(); toggle(); }
    else if (mod && k === "z") { did(); if (e.shiftKey) redo(); else undo(); }
    else if (mod && k === "y") { did(); redo(); }
    else if (mod && k === "d") { did(); duplicate(); }
    else if (mod && k === "v") { did(); void paste(); }
    else if (mod && k === "a") { did(); setSel(range(0, blocks.length)); }
    else if (!mod && k === "s") { did(); splitAt(cursor); }
    else if (!mod && k === "n") { did(); normalize(); }
    else if (!mod && k === "m") { did(); setMagnet((m) => !m); }
    else if (!mod && k === "l") { did(); setLoop((l) => !l); }
    else if (k === "delete" || k === "backspace") { did(); remove(); }
    else if (k === "home") { did(); setCursor(0); }
    else if (k === "end") { did(); setCursor(resultMs); }
    else if (k === "arrowleft" || k === "arrowright") { did(); nudge((k === "arrowleft" ? -1 : 1) * NUDGE * (e.shiftKey ? 10 : 1)); }
    else if (k === "enter" && mod) { did(); void apply(); }
  };

  const cursorCls = { move: "grab", trimL: "ew-resize", trimR: "ew-resize", fadeIn: "col-resize", fadeOut: "col-resize", cursor: "ew-resize", box: "crosshair" } as const;
  const diff = refMs ? resultMs - refMs : 0;
  const source_ = editOriginal ? t`Original` : a && !a.silence ? a.name : t`New audio`;
  const many = chosen().map((i) => blocks[i]);
  const tool = (icon: React.ReactNode, label: string, onClick: () => void, disabled: boolean, key?: string, more?: string) => (
    <button className="icon-btn" onClick={onClick} disabled={disabled} aria-label={label} data-tip={label} data-tip-key={key} data-tip-more={more}>{icon}</button>
  );
  const checkTip = t`Ticked lanes play with Play and go into Export`;
  const checkMore = t`Apply keeps every layer, ticked or not`;
  // on the body: the waveform panel it opens from would hold a fixed box inside itself
  return createPortal(
    <div className="modal-back" onPointerDown={(e) => { if (e.target === e.currentTarget) void close(); }}>
      <div className="modal wave-ed" role="dialog" aria-modal="true" aria-label={t`Waveform Editor`} ref={box} tabIndex={-1} onKeyDown={onKey}>
        <header className="wave-ed-head">
          <h2><Trans>Waveform Editor</Trans></h2>
          <span className="wave-ed-what" data-tip={what} data-tip-clip>{what}</span>
          <span className={`wave-ed-src ${editOriginal ? "game" : "mine"}`} data-tip={editOriginal ? t`Editing the original: the result becomes the new audio` : a?.audio}>{source_}</span>
          <span className="spacer" />
          <Help tip={t`Trim, split, move and fade audio`} page="timing-and-loops#the-waveform-editor" />
          <button className="icon-btn" onClick={() => void close()} aria-label={t`Close`} data-tip={t`Close`}><CloseIcon /></button>
        </header>

        <div className="wave-ed-main">
        <div className="wave-ed-left">
        <div className="wave-ed-over">
          <div className="wave-ed-tools" role="toolbar" aria-label={t`Waveform Editor tools`}>
            <div className="wave-ed-group" role="group" aria-label={t`Playback`}>
              <button className={`icon-btn wave-ed-play${playing ? " on" : ""}`} onClick={toggle} disabled={!ready || !audible.length}
                aria-label={playing ? t`Pause` : t`Play`} data-tip={playing ? t`Pause` : audible.length ? t`Play from the cursor` : t`Tick a lane to play it`}
                data-tip-more={t`Plays the lanes ticked. A double click on the waveforms plays from there`} data-tip-key="Space">
                {playing ? <PauseIcon /> : <PlayIcon />}</button>
              {tool(<StopIcon />, t`Stop`, () => { stop(); setCursor(0); }, false, undefined, t`Puts the cursor back at the start`)}
              <button className="icon-btn wave-ed-toggle" aria-pressed={loop} onClick={() => setLoop(!loop)} aria-label={t`Loop`}
                data-tip={loop ? t`Loop: on` : t`Loop: off`} data-tip-more={t`Plays the selected blocks over and over, or the whole result`} data-tip-key="L"><LoopIcon /></button>
            </div>
            <div className="wave-ed-group" role="group" aria-label={t`Blocks`}>
              {tool(<AddAudioIcon />, t`Add Audio`, () => void addFiles(), !ctx || adding, undefined,
                t`Adds audio files as new blocks on the selected layer, one after the other from the cursor. Dropping files on the editor does the same, and Ctrl+V pastes slots copied in the list or files copied in Explorer`)}
              {tool(<SplitIcon />, t`Split at the cursor`, () => splitAt(cursor), !shown.length, "S", t`Splits the selected blocks there, or the block under the cursor`)}
              {tool(<NormalizeIcon />, t`Normalize`, normalize, !sel.length, "N", t`Brings each selected block up or down until the loudest moment of it reaches −1 dB`)}
              {tool(<DuplicateIcon />, t`Duplicate`, duplicate, !sel.length, "Ctrl+D", t`The copies go right after the selected blocks`)}
              {tool(<RemoveIcon />, t`Remove`, remove, !removable, "Delete", t`Removes the selected blocks`)}
            </div>
            <div className="wave-ed-group" role="group" aria-label={t`Magnet`}>
              <button className="icon-btn wave-ed-toggle" aria-pressed={magnet} onClick={() => setMagnet(!magnet)} aria-label={t`Magnet`} data-tip={magnet ? t`Magnet: on` : t`Magnet: off`}
                data-tip-more={t`The cursor, block edges and blocks snap to edges: of blocks, the start and where the original ends`} data-tip-key="M"><MagnetIcon /></button>
            </div>
            <div className="wave-ed-group" role="group" aria-label={t`History`}>
              {tool(<UndoIcon />, t`Undo`, undo, hist.at === 0, "Ctrl+Z")}
              {tool(<RedoIcon />, t`Redo`, redo, hist.at >= hist.list.length - 1, "Ctrl+Y")}
              {tool(<ResetIcon />, t`Reset`, reset, !ready, undefined, hasOwn ? t`Back to the whole file, as it is, on one layer` : t`Removes every block`)}
            </div>
          </div>
          <span className="spacer" />
          <span className="wave-ed-time" data-tip={t`Where the cursor is`} data-tip-more={t`Drag the cursor, or along the ruler, to move it`}>{fmtExact(cursor)}</span>
        </div>
        <div className="wave-ed-body zoom-grid">
          <div className="wave-ed-lanes">
            <div className="wave-ed-labels">
              <span style={{ height: LANES.ruler }} />
              <label className={`game${playing && sounding.has(-1) ? " playing" : ""}`} style={{ height: LANES.original }} data-tip={checkTip}>
                <span className="wave-ed-grip" aria-hidden="true" />{/* where a layer has its grip: the boxes line up */}
                <input type="checkbox" className="wave-ed-check" checked={playOriginal} disabled={!reference} onChange={(e) => setPlayOriginal(e.target.checked)}
                  aria-label={t`Play the original`} />
                {t`Original`}</label>
              {lanes.map((l, i) => {
                // while a layer is dragged it follows the pointer, and the one whose place it takes shows a line there
                const moving = reorder?.from === i;
                const mark = reorder && !moving && i === reorder.to ? (reorder.to > reorder.from ? " drop-after" : " drop-before") : "";
                return (
                  <div key={i} className={`wave-ed-layer${i === on ? " on" : ""}${moving ? " moving" : ""}${playing && sounding.has(i) ? " playing" : ""}${mark}`}
                    style={{ height: l.h, ...(moving ? { transform: `translateY(${reorder!.dy}px)` } : {}) }} onPointerDown={() => setActive(i)}>
                    <span className="wave-ed-grip" onPointerDown={(e) => startReorder(e, i)} aria-hidden={layers < 2}
                      data-tip={layers > 1 ? t`Drag to reorder the layers` : undefined}><GripIcon /></span>
                    <input type="checkbox" className="wave-ed-check" checked={playsOf(i)} aria-label={t`Play Layer ${i + 1}`} data-tip={checkTip} data-tip-more={checkMore}
                      onChange={(e) => setPlays((p) => { const n = range(0, layers).map((j) => p[j] ?? true); n[i] = e.target.checked; return n; })} />
                    <LayerName n={i + 1} />
                    <button className="icon-btn small" onClick={() => void deleteLayer(i)} disabled={layers < 2} aria-label={t`Delete Layer ${i + 1}`}
                      data-tip={t`Delete the layer`} data-tip-more={t`With the blocks on it`}><TrashIcon /></button>
                    <span className="wave-ed-layer-size" role="separator" aria-orientation="horizontal" aria-label={t`Resize Layer ${i + 1}`}
                      onPointerDown={(e) => startResize(e, i)} onDoubleClick={() => setHeights((h) => { const n = [...h]; n[i] = LAYER.h; return n; })}
                      data-tip={t`Drag to resize the layer`} data-tip-more={t`A double click sets it back`} />
                  </div>
                );
              })}
            </div>
            <div className="wave-ed-canvas" ref={wrap} data-span={Math.round(zoom.span)} data-drop={JSON.stringify({ kind: "wave-editor" })} style={{ height, cursor: drag.current ? (drag.current.kind === "move" ? "grabbing" : cursorCls[drag.current.kind]) : hover ? cursorCls[hover] : "default" }}
              onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onDoubleClick={onDouble} onPointerLeave={() => setHover(null)}>
              <canvas ref={canvas} style={{ width, height }} />
              {!ready ? <p className="wave-ed-state">{error ? t`The audio can't be read: ${error}` : t`Reading the audio…`}</p>
                : !shown.length && (
                  <div className="wave-ed-state wave-ed-empty" style={{ top: editTop }}>
                    <p><Trans>Add audio files to build the new audio from, or start from the original.</Trans></p>
                    <div className="row-btns">
                      <button className="btn primary" onClick={() => void addFiles()}><PlusIcon /><Trans>Add Audio</Trans></button>
                      {ref && <button className="btn" onClick={fromOriginal}><Trans>Start from the Original</Trans></button>}
                    </div>
                  </div>
                )}
            </div>
          </div>
          {/* under the waveforms, at the left: New Layer, then the scroll bar and the time zoom */}
          <WaveZoom zoom={zoom} foot={<>
            <button className="btn quiet wave-ed-new-layer" onClick={addLayer} disabled={layers >= MAX_LAYERS} data-tip={t`A layer to keep blocks apart on`}
              data-tip-more={t`Every layer plays, all together. Drag a block up or down to move it to another layer`}><PlusIcon /><Trans>New Layer</Trans></button>
            {zoom.x > 1 && <WaveScroll zoom={zoom} />}
          </>} />
        </div>
        </div>
        <aside className="wave-ed-side" aria-label={t`Selected blocks`}>
          {one != null ? <BlockFields b={blocks[one]} n={one + 1} fileMs={msOfFile(blocks[one])} file={blocks[one].audio ? nameOf(blocks[one].audio!) : ownName} onSet={(x) => set(one, x)} />
            : many.length > 1 ? <ManyFields list={many} onSet={setMany} />
            : <p className="wave-ed-hint"><Trans>Click a block to set it up. Drag the body to move it, also to another layer, an edge to trim it, and the squares on the top edge to fade it. Drag from an empty spot to select several blocks, and hold Shift or Ctrl to add to them. Where blocks overlap, click again for the one under it. A double click plays from there.</Trans></p>}
        </aside>
        </div>

        <footer className="modal-foot">
          <button className="btn primary" onClick={() => void apply()} disabled={!ready || saving || !blocks.length || (!changed && !editOriginal)}
            data-tip={editOriginal ? t`Use the edited original as the new audio of the slot` : t`Keep these changes in the project`} data-tip-key="Ctrl+Enter">
            {editOriginal || !hasOwn ? t`Use as New Audio` : t`Apply`}</button>
          <button className="btn" onClick={() => { stop(); setExporting(true); }} disabled={!ready || !exportable}
            data-tip={exportable ? t`Export the lanes ticked as one audio file` : t`Tick a lane with audio to export it`}><ExportIcon /><Trans>Export</Trans></button>
          <button className="btn quiet" onClick={() => void close()}><Trans>Cancel</Trans></button>
          <span className="spacer" />
          <span className="wave-ed-sum">
            <Trans>Result <b>{fmtTime(resultMs)}</b></Trans>
            {refMs > 0 && <span className={Math.abs(diff) < 1 ? "" : diff > 0 ? "longer" : "shorter"}>
              {" · "}<Trans>Original {fmtTime(refMs)}</Trans>{Math.abs(diff) >= 1 && ` (${diff > 0 ? "+" : "−"}${fmtTime(Math.abs(diff))})`}</span>}
            {" · "}{shown.length === 1 ? t`1 block` : t`${shown.length} blocks`}
          </span>
        </footer>
      </div>
      {exporting && <ExportPanel what={[...(playOriginal && reference ? [t`Original`] : []), ...range(0, layers).filter((i) => playsOf(i) && blocks.some((b) => layerOf(b) === i)).map((i) => t`Layer ${i + 1}`)]}
        onExport={doExport} onClose={() => setExporting(false)} />}
    </div>, document.body);
}

/** A layer's name, "Layer 2", or only its number where the whole name doesn't fit the label (a long word in another
    language, a large text size); the full name stays for a screen reader and in the tooltip. */
function LayerName({ n }: { n: number }) {
  const el = useRef<HTMLSpanElement>(null);
  const [short, setShort] = useState(false);
  const full = t`Layer ${n}`;
  useLayoutEffect(() => {
    const box = el.current?.parentElement, probe = el.current;
    if (!box || !probe) return;
    // measured with the whole name in a hidden copy, so it switches back once there is room again
    const fit = () => setShort(probe.scrollWidth > probe.clientWidth + 0.5);
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    fit();
    return () => ro.disconnect();
  }, [full]);
  return (
    <span className="wave-ed-layer-name" data-tip={short ? full : undefined} aria-label={full}>
      <span className="wave-ed-name-full" ref={el} aria-hidden="true">{full}</span>
      {short && <span className="wave-ed-name-short" aria-hidden="true">{n}</span>}
    </span>
  );
}

/** Export's settings, over the editor: what goes in (the lanes ticked), the format, rate and channels, and whether
    the loudest moment is brought to −1 dB. Kept for the next time. Export asks where the file goes. */
function ExportPanel({ what, onExport, onClose }: { what: string[]; onExport: (p: ExportPrefs) => Promise<boolean>; onClose: () => void }) {
  const [prefs, setPrefs] = useState<ExportPrefs>(() => {
    const none: ExportPrefs = { fmt: "wav24", rate: 48000, channels: 0, normalize: false };
    try { return { ...none, ...JSON.parse(localStorage.getItem(EXPORT_KEY) ?? "{}") }; } catch { return none; }
  });
  const pref = (p: Partial<ExportPrefs>) => setPrefs((x) => { const n = { ...x, ...p }; try { localStorage.setItem(EXPORT_KEY, JSON.stringify(n)); } catch { /* storage off */ } return n; });
  const [busy, setBusy] = useState(false);
  const box = useDialog(onClose);
  const go = async () => { setBusy(true); const ok = await onExport(prefs); setBusy(false); if (ok) onClose(); };
  const radio = <T extends string | number>(label: string, value: T, options: [T, string][], set: (v: T) => void) => (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map(([v, name]) => <button key={String(v)} role="radio" aria-checked={value === v} className={value === v ? "on" : ""} onClick={() => set(v)}>{name}</button>)}
      </div>
    </div>
  );
  return createPortal(
    <div className="modal-back front" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal wave-ex" role="dialog" aria-modal="true" aria-label={t`Export Audio`} ref={box} tabIndex={-1}>
        <h2><Trans>Export Audio</Trans></h2>
        <p className="wave-ex-what"><Trans>Mixes into one file:</Trans> <b>{what.join(", ")}</b></p>
        <label className="field">
          <span className="field-label"><Trans>Format</Trans></span>
          <select value={prefs.fmt} onChange={(e) => pref({ fmt: e.target.value })}>
            {EXPORT_FORMATS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        {radio(t`Sample rate`, prefs.rate, [[48000, "48 kHz"], [44100, "44.1 kHz"]], (rate) => pref({ rate }))}
        {radio(t`Channels`, prefs.channels, [[0, t`As the audio`], [2, t`Stereo`], [1, t`Mono`]], (channels) => pref({ channels }))}
        <label className="check"><input type="checkbox" checked={prefs.normalize} onChange={(e) => pref({ normalize: e.target.checked })} />
          <span><Trans>Normalize to −1 dB</Trans></span></label>
        <div className="modal-foot">
          <button className="btn primary" onClick={() => void go()} disabled={busy}><ExportIcon />{busy ? t`Exporting…` : t`Export…`}</button>
          <button className="btn quiet" onClick={onClose}><Trans>Cancel</Trans></button>
        </div>
      </div>
    </div>, document.body);
}

/** One field of the values beside the time line: label, value and unit on the column's grid. `value` null: the
    selected blocks differ, and the field shows empty until a value is typed. */
function Field({ name, tip, value, lo, hi, unit = "ms", step = 1, onSet }: {
  name: string; tip: string; value: number | null; lo: number; hi: number; unit?: string; step?: number; onSet: (v: number) => void;
}) {
  return (
    <label className="wave-ed-field" data-tip={tip} data-tip-side="left">
      <span className="wave-ed-label">{name}</span>
      <input type="number" min={lo} max={hi} step={step} key={String(value)} defaultValue={value == null ? "" : round1(value)} placeholder="—" aria-label={`${name} (${unit})`}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        onBlur={(e) => {
          const raw = e.target.value, v = Number(raw);
          if (raw === "" || !Number.isFinite(v) || (value != null && round1(v) === round1(value))) { e.target.value = value == null ? "" : String(round1(value)); return; }
          onSet(clamp(v, lo, hi));
        }} /><span className="unit">{unit}</span>
    </label>
  );
}

/** The selected block in numbers, in ms (Gain in dB): what the canvas does by dragging, to type exactly. A column of
    label, value and unit, in groups: where it plays, the stretch of the file, the fades, the level. */
function BlockFields({ b, n, fileMs, file, onSet }: {
  b: Block; n: number; fileMs: number; file: string; onSet: (b: Partial<Block>) => void;
}) {
  const len = lengthOf(b);
  return (
    <div className="wave-ed-block">
      <div className="wave-ed-block-head"><b>{t`Block ${n}`}</b><span className="wave-ed-file" data-tip={file} data-tip-clip>{file}</span></div>
      <div className="wave-ed-set">
        <Field name={t`Position`} tip={t`When the block plays, from the start of the slot`} value={b.at_ms} lo={0} hi={3_600_000} onSet={(v) => onSet({ at_ms: v })} />
        <div className="wave-ed-field wave-ed-ro"><span className="wave-ed-label">{t`Length`}</span><b>{fmtDecimal(len, 1)}</b><span className="unit">ms</span></div>
      </div>
      <div className="wave-ed-set">
        <Field name={t({ message: "Start", context: "Trim handle" })} tip={t`Where the block starts in the file`} value={b.start_ms} lo={0} hi={b.end_ms - MIN_BLOCK} onSet={(v) => onSet({ start_ms: v })} />
        <Field name={t({ message: "End", context: "Trim handle" })} tip={t`Where the block ends in the file`} value={b.end_ms} lo={b.start_ms + MIN_BLOCK} hi={fileMs} onSet={(v) => onSet({ end_ms: v })} />
      </div>
      <div className="wave-ed-set">
        <Field name={t`Fade In`} tip={t`How long the block takes to rise from silence`} value={b.fade_in_ms} lo={0} hi={len - b.fade_out_ms} onSet={(v) => onSet({ fade_in_ms: v })} />
        <Field name={t`Fade Out`} tip={t`How long the block takes to fall to silence before it ends`} value={b.fade_out_ms} lo={0} hi={len - b.fade_in_ms} onSet={(v) => onSet({ fade_out_ms: v })} />
      </div>
      <div className="wave-ed-set">
        <Field name={t`Gain`} tip={t`How much louder or quieter the block plays`} value={b.gain_db} lo={-60} hi={24} unit="dB" step={0.5} onSet={(v) => onSet({ gain_db: v })} />
      </div>
    </div>
  );
}

/** Several blocks selected: the values they can share, set on all of them at once (a fade longer than a block stops
    at its length). A value they differ in shows empty. */
function ManyFields({ list, onSet }: { list: Block[]; onSet: (b: Partial<Block>) => void }) {
  const same = (k: "fade_in_ms" | "fade_out_ms" | "gain_db") => (list.every((b) => round1(b[k]) === round1(list[0][k])) ? list[0][k] : null);
  const longest = Math.max(...list.map(lengthOf));
  const n = list.length;
  return (
    <div className="wave-ed-block">
      <div className="wave-ed-block-head"><b>{t`${n} blocks`}</b><span className="wave-ed-file">{t`Values set here apply to each of them`}</span></div>
      <div className="wave-ed-set">
        <Field name={t`Fade In`} tip={t`How long each block takes to rise from silence`} value={same("fade_in_ms")} lo={0} hi={longest} onSet={(v) => onSet({ fade_in_ms: v })} />
        <Field name={t`Fade Out`} tip={t`How long each block takes to fall to silence before it ends`} value={same("fade_out_ms")} lo={0} hi={longest} onSet={(v) => onSet({ fade_out_ms: v })} />
      </div>
      <div className="wave-ed-set">
        <Field name={t`Gain`} tip={t`How much louder or quieter each block plays`} value={same("gain_db")} lo={-60} hi={24} unit="dB" step={0.5} onSet={(v) => onSet({ gain_db: v })} />
      </div>
    </div>
  );
}
