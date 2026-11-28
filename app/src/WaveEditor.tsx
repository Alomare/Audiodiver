import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { audioUrl, call, fileUrl, fmtDecimal, fmtExact, fmtTime, type Block } from "./api";
import { confirm } from "./Confirm";
import { useDialog } from "./dialog";
import { AddAudioIcon, CloseGapsIcon, CloseIcon, CurveIcon, DuplicateIcon, ExportIcon, FitLayerIcon, FitSelIcon, GripIcon, LinkIcon, LoopIcon, MagnetIcon, MergeBlocksIcon, NormalizeIcon,
  PauseIcon, PlayIcon, PlusIcon, RedoIcon, RemoveIcon, ResetIcon, SnapLeftIcon, SnapRightIcon, SplitIcon, StopIcon, ThroughIcon, ToEndIcon, ToStartIcon, TrashIcon,
  UndoIcon } from "./Icons";
import { keyLabel, suiteCommand, useKeymap, type SuiteCommand } from "./keys";
import { fullPath, pickAudio, pickAudioToSave } from "./platform";
import { player, usePlayer } from "./player";
import { merges } from "./retime";
import { useEditor } from "./store";
import { useWaveZoom, WaveScroll, WaveZoom, wheelZoom, type WaveZoomState } from "./Waveform";
import { Help } from "./WikiLinks";

/** The Waveform Suite: audio as blocks on a time line, so that basic editing needs no other program. Each block is
    a stretch of one file placed at a time of its own, with a fade in, a fade out and a gain. Blocks are trimmed at
    their edges, moved by their body (also to another layer), split at the cursor, duplicated and removed, and their
    fades are dragged from the grips at their top corners. With Volume Curves on, a line over each block (full at the
    top, silence at the foot) takes points: a press on the line puts one there, a point drags in time and level, and a
    double click (or Alt and a click) removes it; the points sit at times of the file, so a trim or a split keeps them
    on the same audio. The magnet snaps the cursor, edges, blocks and cue points
    to each other, to the start, and to where the original ends.

    What it edits are tracks (`tracks`): the new audio of a slot (or its original, which then becomes the new audio,
    as a copy does); every slot of a music segment at once (Edit Segment), each a track with its original above its
    layers, so the layers line up and Apply sets them all; or a file of the Soundtrack (a song before it is cut, or
    the song in a place of a playlist), which Apply saves as a new file and hands to `onFile`.

    Blocks sit on layers: lanes under their track that only keep blocks apart to see and reach them; a block plays
    the same on any. Layers are added, reordered by their grip, resized by their bottom edge and deleted (one with
    blocks asks first). Each lane, the originals' too, has a box: Play plays the lanes ticked, and Export writes them
    to a file; Apply keeps every layer. The lanes playing have a tint of their colour.

    In a music segment (`cues`), the segment's Entry and Exit cue points stand on the time line, dragged by their flags
    on the ruler, and Play in Context plays the segment between the one before it and the one after, handed over as
    the game does (core edit_context), with the edits as they are here. Apply sets the cue points with the blocks.

    Selecting: a click picks the shortest block under it, and another click on the same spot the next one under it.
    Dragging from an empty spot draws a box that selects every block it touches; Shift or Ctrl adds to the selection
    or takes a block out of it. Selected blocks move, duplicate, split, normalize and go together. The cursor moves by
    a click, by dragging it, or along the ruler.

    Nothing changes in the project until Apply; the core then makes the audio a build uses from the same blocks (core
    audio.edited), so what plays here is what the game plays. Playback here is Web Audio, from the decoded files. */

const MIN_BLOCK = 10;   // ms: the shortest block (the core's MIN_TRIM_MS)
const MIN_SPAN = 20;    // ms: the closest the view zooms in
const SNAP_PX = 8;      // the magnet's reach
const EDGE_PX = 6;      // how near an edge a press trims instead of moving
const GRIP_PX = 7;      // a fade grip's half size
const CURSOR_PX = 5;    // how near the cursor a press takes hold of it
const FLAG_PX = 7;      // how near a cue point's flag a press on the ruler takes it
const POINT_PX = 6;     // how near a volume curve's point a press takes it
const LINE_PX = 6;      // how near a volume curve's line a press puts a point on it
const MAX_CURVE = 256;  // the core's MAX_CURVE: points on a block's volume curve
const NUDGE = 10;       // ms an arrow key moves a block (Shift: ×10)
const RULER = 24;
const REF_H = { one: 64, many: 56 }; // an original's lane, alone and in a segment
const LAYER = { h: 120, many: 84, embed: 240, min: 48, max: 320, pad: 6 }; // a layer's height (alone, in a segment, in the slice tool), its limits; a block's inset
const MAX_LAYERS = 32;  // the core's MAX_LAYERS
const TEMPO = [0.5, 2] as const; // the core's TEMPO: a block's speed
const PITCH = 12;       // the core's PITCH: semitones up or down
const BUCKET = 64;      // frames per level in the summary of a file
const DOUBLE_MS = 400;  // a second click this soon after the first is a double click, which plays instead of picking
const CONTEXT_MS = 3000; // how much of the segments around a segment Play in Context plays
const CUE_GAP = 50;     // ms Entry stays before Exit
// the cue points' names, on the flags (as on the waveforms, Timeline.tsx)
const ENTRY = t({ message: "Entry", comment: "A music segment's Entry cue point (Wwise term): where the segment counts as started" });
const EXIT = t({ message: "Exit", comment: "A music segment's Exit cue point (Wwise term): where the next segment starts" });

/** A track the editor opens: a slot (`source`; `original`: its original audio, which becomes the new audio), or a
    file (`file`, full or as the project stores it; `blocks`: how it plays now, else whole). `name` labels it. */
export type EditTrack = { source?: string; file?: string; name: string; full?: string; original?: boolean; blocks?: Block[] };
/** The music segment the tracks play in: its cue id and segment, whether its timing fits the new audio, the game's
    cue points, and the project's own (null: automatic). */
export type EditCues = { cue: string; segment: string; fit: boolean; gameEntry: number; gameExit: number; entry: number | null; exit: number | null };

type EBlock = Block & { track: number };
type Kind = "move" | "trimL" | "trimR" | "fadeIn" | "fadeOut" | "cursor" | "box" | "entry" | "exit" | "point" | "line";
type Drag = {
  kind: Kind; i: number; x0: number; y0: number; from: EBlock[]; moved: boolean;
  again: boolean; under: number[]; // pressed on the one block selected; the blocks under the press, shortest first
  group: number[]; base: number[]; add: boolean; // the blocks a move takes; what a box adds to; Shift or Ctrl held
  pt: number; made: boolean; // the volume curve's point dragged; whether the press put it there
};
type Decoded = { buf: AudioBuffer; levels: Float32Array };
type Hit = { kind: Kind; i: number; under: number[]; pt?: number };
type Lane = { kind: "ref" | "layer"; track: number; layer: number; top: number; h: number };
/** Audio to put in as blocks: a file (whole), or the blocks a copied slot plays (each naming its file). */
type Incoming = { audio: string; blocks?: Block[] };
type ExportPrefs = { fmt: string; rate: number; channels: number; normalize: boolean };
type Playing = "edit" | "context" | null;

/** How fast a block plays its stretch of the file, and whether its pitch goes with that, as a tape played faster. */
const speedOf = (b: Block) => b.tempo ?? 1;
const tapeOf = (b: Block) => Math.abs((b.pitch ?? 0) - 12 * Math.log2(speedOf(b))) < 0.01;
/** How long a block plays on the time line. */
const lengthOf = (b: Block) => (b.end_ms - b.start_ms) / speedOf(b);
const lastIndex = <T,>(xs: T[], f: (x: T) => boolean) => { for (let i = xs.length - 1; i >= 0; i--) if (f(xs[i])) return i; return -1; };
const endOf = (b: Block) => b.at_ms + lengthOf(b);
const layerOf = (b: Block) => b.layer ?? 0;
const round1 = (v: number) => Math.round(v * 10) / 10;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const range = (from: number, n: number) => Array.from({ length: n }, (_, i) => from + i);
const lk = (track: number, layer: number) => `${track}:${layer}`; // a layer's key, for its height and its box
const clean = (b: EBlock): EBlock => ({ start_ms: round1(b.start_ms), end_ms: round1(b.end_ms), at_ms: round1(Math.max(0, b.at_ms)),
  fade_in_ms: round1(Math.max(0, b.fade_in_ms)), fade_out_ms: round1(Math.max(0, b.fade_out_ms)), gain_db: round1(b.gain_db),
  ...(b.audio ? { audio: b.audio } : {}), ...(b.layer ? { layer: Math.round(b.layer) } : {}),
  ...(b.curve?.length ? { curve: b.curve.map(([ms, lv]) => [round1(Math.max(0, ms)), Math.round(clamp(lv, 0, 1) * 1e4) / 1e4]).sort((p, q) => p[0] - q[0]) } : {}),
  ...(b.tempo != null && Math.abs(b.tempo - 1) >= 1e-4 ? { tempo: Math.round(clamp(b.tempo, TEMPO[0], TEMPO[1]) * 1e4) / 1e4 } : {}),
  ...(b.pitch ? { pitch: Math.round(clamp(b.pitch, -PITCH, PITCH) * 100) / 100 } : {}),
  track: b.track });
/** A block's volume curve at a time of its file: a straight line between its points, the first and last levels held
    before and after them; full (1) without points. */
export function curveAt(b: Block, fileMs: number) {
  const c = b.curve;
  if (!c?.length) return 1;
  if (fileMs <= c[0][0]) return c[0][1];
  for (let k = 1; k < c.length; k++) {
    const [x1, y1] = c[k];
    if (fileMs <= x1) { const [x0, y0] = c[k - 1]; return x1 > x0 ? y0 + ((fileMs - x0) / (x1 - x0)) * (y1 - y0) : y1; }
  }
  return c[c.length - 1][1];
}
/** The volume curves of blocks as lines on their time line, [ms, level], each from where its block starts to where it
    ends (the waveform panel draws them over the new audio). */
export function curveLines(blocks: Block[] | undefined): number[][][] {
  return (blocks ?? []).filter((b) => b.curve?.length).map((b) => {
    const sp = speedOf(b), at = (ms: number) => b.at_ms + (ms - b.start_ms) / sp;
    return [[b.at_ms, curveAt(b, b.start_ms)], ...b.curve!.filter((p) => p[0] > b.start_ms && p[0] < b.end_ms).map((p) => [at(p[0]), p[1]]),
      [at(b.end_ms), curveAt(b, b.end_ms)]];
  });
}
/** A block's curve without its point k. What is left is no curve once it is only the two points at full that came
    with the first point put on it (or nothing but full), so Flatten goes away with the last point put there. */
function withoutPoint(b: Block, k: number): number[][] {
  const c = (b.curve ?? []).filter((_, j) => j !== k);
  const flat = c.every((p) => p[1] >= 0.9999 && (p[0] <= b.start_ms + 0.05 || p[0] >= b.end_ms - 0.05));
  return flat ? [] : c;
}
/** A level as decibels, for the point being dragged. */
const dbText = (lv: number) => (lv <= 0.00001 ? "−∞ dB" : `${fmtDecimal(20 * Math.log10(lv), 1, true)} dB`);
/** A block as the core takes it: without the track it belongs to. */
const strip = ({ track: _, ...b }: EBlock): Block => b;
/** A block with its fades kept inside it, after its length or a fade changed. */
const fitted = <B extends Block>(b: B): B => { const len = lengthOf(b), fi = clamp(b.fade_in_ms, 0, len); return { ...b, fade_in_ms: fi, fade_out_ms: clamp(b.fade_out_ms, 0, len - fi) }; };
const nameOf = (path: string) => path.split(/[\\/]/).pop() ?? path;
const FULL = /^([a-z]:[\\/]|[\\/])/i; // a full path (a file just added), not one the project stores
const EXPORT_FORMATS: [string, string, string][] = [ // id (the core's EDIT_EXPORTS), name, extension
  ["wav24", "WAV · 24-bit", "wav"], ["wav16", "WAV · 16-bit", "wav"], ["flac", "FLAC", "flac"], ["mp3", "MP3 · 320 kbps", "mp3"], ["ogg", "Ogg Vorbis", "ogg"]];
const EXPORT_KEY = "audiodiver.waveExport";
const ZOOM_KEY = "audiodiver.suiteZoom";
type KeptZoom = { from: number; span: number; y: number };
/** The zoom each track (or set of them) was left at, the latest last, up to 200 of them. */
const zooms: Map<string, KeptZoom> = (() => {
  try { return new Map(Object.entries(JSON.parse(localStorage.getItem(ZOOM_KEY) ?? "{}") as Record<string, KeptZoom>)); } catch { return new Map(); }
})();
function keepZoom(key: string, z: KeptZoom | null) {
  zooms.delete(key);
  if (z) zooms.set(key, z);
  while (zooms.size > 200) zooms.delete(zooms.keys().next().value!);
  try { localStorage.setItem(ZOOM_KEY, JSON.stringify(Object.fromEntries(zooms))); } catch { /* storage off */ }
}
const own = (track: number) => `own:${track}`; // the files map's key of a track's own file

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

/** The level a block plays at, a moment into it: its gain, its volume curve, and its fades as straight lines in level. */
function envelope(b: Block, intoMs: number) {
  const len = lengthOf(b);
  let k = 10 ** (b.gain_db / 20) * curveAt(b, b.start_ms + intoMs * speedOf(b));
  if (b.fade_in_ms > 0 && intoMs < b.fade_in_ms) k *= Math.max(0, intoMs / b.fade_in_ms);
  if (b.fade_out_ms > 0 && intoMs > len - b.fade_out_ms) k *= Math.max(0, (len - intoMs) / b.fade_out_ms);
  return k;
}

/** Blocks that overlap another on the same layer of the same track: each gets a colour of its own (by its place among
    them), the rest the primary colour. */
function colours(blocks: EBlock[]): (number | null)[] {
  const out: (number | null)[] = blocks.map(() => null);
  let n = 0;
  blocks.forEach((b, i) => {
    if (blocks.some((o, j) => j !== i && o.track === b.track && layerOf(o) === layerOf(b) && o.at_ms < endOf(b) && b.at_ms < endOf(o))) out[i] = n++;
  });
  return out;
}

async function read(url: string, ctx: BaseAudioContext): Promise<Decoded> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  const buf = await ctx.decodeAudioData(await res.arrayBuffer());
  return { buf, levels: summarize(buf) };
}
/** Each url read once for each audio context: an original edited is also the reference under it, and a song's
    original is a large file to fetch and decode. A failed read is tried again next time. */
const reads = new WeakMap<BaseAudioContext, Map<string, Promise<Decoded>>>();
function decode(url: string, ctx: BaseAudioContext): Promise<Decoded> {
  let m = reads.get(ctx);
  if (!m) reads.set(ctx, m = new Map());
  let p = m.get(url);
  if (!p) {
    m.set(url, p = read(url, ctx));
    p.catch(() => m!.delete(url));
  }
  return p;
}

/** The block the side panel is measured with: every field, and Flatten Curve. */
const SIZER: Block = { start_ms: 0, end_ms: 1000, at_ms: 0, fade_in_ms: 0, fade_out_ms: 0, gain_db: 0, curve: [[0, 1], [500, 0.5], [1000, 1]] };
/** A block of a whole file, at the start. */
const whole = (ms: number, track: number): EBlock => ({ start_ms: 0, end_ms: ms, at_ms: 0, fade_in_ms: 0, fade_out_ms: 0, gain_db: 0, track });

/** The Suite as a tab of another dialog (the slice tool's): no frame, header, Apply or Cancel of its own. It hands
    its blocks over as they change (`onBlocks`, with whether they differ from how it opened) and draws `marks` of the
    blocks as they show (a drag too): the slice tool's cuts, following the audio. */
export type SuiteEmbed = { onBlocks: (blocks: Block[], changed: boolean) => void; marks?: (blocks: Block[]) => number[]; shown?: boolean };

export function WaveEditor({ tracks, what, cues, onFile, applyLabel, onClose, embed }: {
  tracks: EditTrack[]; what: string; cues?: EditCues; onFile?: (path: string) => void | Promise<unknown>; applyLabel?: string; onClose: () => void;
  embed?: SuiteEmbed;
}) {
  const { project, actions, quick, notify } = useEditor();
  const vol = usePlayer().volume;
  useKeymap(); // the keys the tooltips name follow a rebinding
  const many = tracks.length > 1;
  const isFile = (i: number) => !!tracks[i].file;
  const assign = (i: number) => (tracks[i].source ? project?.assignments[tracks[i].source!] : undefined);
  // one audio context while the editor is open (made in the effect, so a second mount in development gets its own)
  const [ctx, setCtx] = useState<AudioContext | null>(null);
  useEffect(() => {
    let c: AudioContext;
    try { c = new AudioContext({ sampleRate: 48000 }); } catch { c = new AudioContext(); }
    setCtx(c);
    return () => { void c.close().catch(() => {}); };
  }, []);

  // the files: each track's own (own(i): a slot's new audio, its original once that is edited, or the file a file
  // track edits; none for a slot without new audio, built from added files), every other file a block names (by the
  // path it carries: as the project stores it, or a full path just added), and each slot's original for reference
  const [modes, setModes] = useState<Record<number, "original" | "mine">>(() => Object.fromEntries(tracks.map((x, i) => [i, x.original ? "original" : "mine"])));
  const editOriginal = (i: number) => !isFile(i) && modes[i] === "original";
  const hasOwn = (i: number) => isFile(i) || editOriginal(i) || (!!assign(i) && !assign(i)!.silence);
  const [files, setFiles] = useState<Record<string, Decoded>>({});
  const [refs, setRefs] = useState<Record<number, Decoded | null>>({});
  const [error, setError] = useState<string | null>(null);
  const full = useCallback((path: string) => (FULL.test(path) || !project ? path : fullPath(project.folder, path)), [project]);
  const urlOf = useCallback((key: string) => {
    if (!key.startsWith("own:")) return fileUrl(full(key));
    const i = Number(key.slice(4)), x = tracks[i], a = x.source ? project?.assignments[x.source] : undefined;
    if (x.file) return fileUrl(full(x.file));
    return modes[i] === "original" || !a || a.silence ? audioUrl("vanilla", x.source!) : fileUrl(full(a.audio));
  }, [tracks, project, modes, full]);
  const asked = useRef(new Set<string>());
  const need = useCallback((key: string) => {
    if (!ctx || asked.current.has(key)) return;
    asked.current.add(key);
    decode(urlOf(key), ctx).then((f) => setFiles((x) => ({ ...x, [key]: f })),
      (e) => { if (key.startsWith("own:")) setError(String(e?.message ?? e)); });
  }, [ctx, urlOf]);
  useEffect(() => { tracks.forEach((_, i) => { if (hasOwn(i)) need(own(i)); }); }); // eslint-disable-line react-hooks/exhaustive-deps
  // read again only when the slots change: the panel hands over a new list each time it draws (while something
  // plays, many times a second), and each read fetched and decoded the whole original again, a song's 80 MB
  const sources = tracks.map((x) => x.source ?? "").join(",");
  useEffect(() => {
    if (!ctx) return;
    let live = true;
    sources.split(",").forEach((source, i) => {
      if (!source) return;
      decode(audioUrl("vanilla", source), ctx).then((f) => { if (live) setRefs((r) => ({ ...r, [i]: f })); },
        () => { if (live) setRefs((r) => ({ ...r, [i]: null })); }); // no original (a new take): no reference
    });
    return () => { live = false; };
  }, [ctx, sources]);
  // a block at another tempo with its own pitch plays its file as the core stretches it, read once for each
  // tempo and pitch; until it is read (and for one that is a tape played faster) the player plays the file faster
  const [bent, setBent] = useState<Record<string, Decoded>>({});
  const bentAsked = useRef(new Set<string>());
  const bentKey = (b: Block & { track: number }) => `${b.audio || own(b.track)}|${speedOf(b)}|${b.pitch ?? 0}`;
  const refOf = (i: number) => (editOriginal(i) ? files[own(i)] ?? null : refs[i] ?? null);
  const fileOf = (b: EBlock) => files[b.audio || own(b.track)] ?? null;
  const msOfFile = (b: EBlock) => { const f = fileOf(b); return f ? f.buf.duration * 1000 : b.end_ms; };
  const ready = tracks.every((_, i) => !hasOwn(i) || !!files[own(i)]);
  const ownName = (i: number) => (isFile(i) ? nameOf(tracks[i].file!) : editOriginal(i) ? t`Original` : assign(i) ? nameOf(assign(i)!.audio) : "");
  const refMs = Math.max(0, ...tracks.map((_, i) => (refOf(i)?.buf.duration ?? 0) * 1000));

  // the blocks of every track, with their history here (Undo inside the editor); `live` is a drag before it is let go
  const [hist, setHist] = useState<{ list: EBlock[][]; at: number }>({ list: [], at: 0 });
  const blocks = hist.list[hist.at] ?? [];
  const [live, setLive] = useState<EBlock[] | null>(null);
  const shown = live ?? blocks;
  const [sel, setSelRaw] = useState<number[]>([]); // the blocks selected, the one clicked last at the end
  const setSel = (v: number[]) => setSelRaw([...new Set(v)]);
  const picked = useMemo(() => new Set(sel.filter((i) => i < shown.length)), [sel, shown.length]);
  const one = sel.length === 1 && sel[0] < blocks.length ? sel[0] : null;
  const commit = useCallback((next: EBlock[]) => {
    setLive(null);
    setHist((h) => ({ list: [...h.list.slice(0, h.at + 1), next.map(clean)], at: h.at + 1 }));
  }, []);
  /** How a track starts: the blocks its new audio plays as, its file whole, or nothing (a slot without new audio). */
  const firstOf = (i: number): EBlock[] => {
    const f = files[own(i)], ms = f ? f.buf.duration * 1000 : 0, a = assign(i), x = tracks[i];
    if (!hasOwn(i)) return [];
    if (isFile(i)) return x.blocks?.length ? x.blocks.map((b) => ({ ...b, track: i })) : [whole(ms, i)];
    if (editOriginal(i) || !a) return [whole(ms, i)];
    if (a.blocks?.length) return a.blocks.map((b) => ({ ...b, track: i }));
    return [{ start_ms: a.start_ms ?? 0, end_ms: Math.min(ms, a.end_ms || ms), at_ms: a.delay_ms ?? 0, fade_in_ms: a.fade_in_ms, fade_out_ms: a.fade_out_ms, gain_db: 0, track: i }];
  };
  const start = useRef<EBlock[] | null>(null); // what the editor opened with: Apply is on once something differs
  useEffect(() => {
    if (hist.list.length || !ready) return;
    const first = tracks.flatMap((_, i) => firstOf(i));
    start.current = first.map(clean);
    for (const b of first) if (b.audio) need(b.audio);
    setHist({ list: [start.current], at: 0 });
    setSel(first.length ? [0] : []);
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps
  /** A slot without new audio starts from its original: the original whole on its first layer, once it is read. */
  const [seeding, setSeeding] = useState<number[]>([]);
  const fromOriginal = (i: number) => { asked.current.delete(own(i)); setModes((m) => ({ ...m, [i]: "original" })); setSeeding((s) => [...s, i]); };
  useEffect(() => {
    const due = seeding.filter((i) => files[own(i)] && modes[i] === "original");
    if (!due.length || !hist.list.length) return;
    setSeeding((s) => s.filter((i) => !due.includes(i)));
    commit([...blocks.filter((b) => !due.includes(b.track)), ...due.map((i) => whole(files[own(i)].buf.duration * 1000, i))]);
  }, [seeding, files, modes, hist.list.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const trackChanged = (i: number) => JSON.stringify(blocks.filter((b) => b.track === i)) !== JSON.stringify((start.current ?? []).filter((b) => b.track === i));
  const undo = () => { setLive(null); setSel([]); setHist((h) => ({ ...h, at: Math.max(0, h.at - 1) })); };
  const redo = () => { setLive(null); setSel([]); setHist((h) => ({ ...h, at: Math.min(h.list.length - 1, h.at + 1) })); };

  // --- the cue points of the segment (cues): the project's own, as changed here until Apply, or the automatic ones
  const [cueOver, setCueOver] = useState<{ entry: number | null; exit: number | null }>({ entry: cues?.entry ?? null, exit: cues?.exit ?? null });
  const [cueLive, setCueLive] = useState<{ entry?: number; exit?: number } | null>(null);
  const resultMs = Math.max(0, ...shown.map(endOf));
  const autoEntry = cues ? (cues.fit ? 0 : cues.gameEntry) : 0;
  const autoExit = cues ? (cues.fit ? resultMs : cues.gameExit) : 0;
  const entryAt = cueLive?.entry ?? cueOver.entry ?? autoEntry;
  const exitAt = cueLive?.exit ?? cueOver.exit ?? autoExit;
  const cuesChanged = !!cues && (cueOver.entry !== cues.entry || cueOver.exit !== cues.exit);

  // --- the lanes: for each track, its original (a slot's) and its layers; a track has as many layers as asked for,
  // and at least one past the last a block is on (an Undo can bring one back); heights and boxes go by layer
  const [asks, setAsks] = useState<Record<number, number>>({});
  const layersOf = (i: number) => clamp(Math.max(asks[i] ?? 1, ...shown.filter((b) => b.track === i).map((b) => layerOf(b) + 1)), 1, MAX_LAYERS);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const baseH = many ? LAYER.many : embed ? LAYER.embed : LAYER.h;
  const hOf = (track: number, layer: number) => heights[lk(track, layer)] ?? baseH;
  const [plays, setPlays] = useState<Record<string, boolean>>({});
  // the layers' names ("" or none: "Layer n"), saved with Apply for a slot's track
  const namesAt = (src: (i: number) => string[] | undefined) => Object.fromEntries(tracks.flatMap((_, i) => (src(i) ?? []).map((n, l) => [lk(i, l), n] as const).filter(([, n]) => n)));
  const [names, setNames] = useState<Record<string, string>>(() => namesAt((i) => assign(i)?.layers));
  const namesStart = useRef(names);
  const namesOf = (i: number) => { const out = range(0, layersOf(i)).map((l) => (names[lk(i, l)] ?? "").trim()); while (out.length && !out[out.length - 1]) out.pop(); return out; };
  const namesChanged = (i: number) => JSON.stringify(namesOf(i)) !== JSON.stringify(range(0, MAX_LAYERS).map((l) => (namesStart.current[lk(i, l)] ?? "").trim()).filter((_, l, a) => a.slice(l).some(Boolean)));
  const changed = !!start.current && (tracks.some((_, i) => trackChanged(i) || (!!tracks[i].source && namesChanged(i))) || cuesChanged);
  const reported = useRef("");
  useEffect(() => {
    if (!embed || !hist.list.length) return;
    const key = JSON.stringify(blocks) + changed;
    if (key === reported.current) return;
    reported.current = key;
    embed.onBlocks(blocks.map(strip), changed);
  });
  // embedded: the keys go to the Suite while its tab shows (focused as it opens and on a press inside it)
  const embedBox = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (embed?.shown === false) stop();
    else if (embed) embedBox.current?.focus({ preventScroll: true });
  }, [embed?.shown]); // eslint-disable-line react-hooks/exhaustive-deps
  const playsOf = (track: number, layer: number) => plays[lk(track, layer)] ?? true;
  const [refPlays, setRefPlays] = useState<Record<number, boolean>>({});
  const [active, setActive] = useState<{ track: number; layer: number }>({ track: 0, layer: 0 });
  const on = { track: Math.min(active.track, tracks.length - 1), layer: Math.min(active.layer, layersOf(Math.min(active.track, tracks.length - 1)) - 1) };
  const counts = tracks.map((_, i) => layersOf(i)).join();
  const lanes = useMemo(() => {
    const out: Lane[] = [];
    let top = RULER;
    tracks.forEach((x, i) => {
      if (x.source) { const h = many ? REF_H.many : REF_H.one; out.push({ kind: "ref", track: i, layer: -1, top, h }); top += h; }
      for (let l = 0; l < layersOf(i); l++) { const h = hOf(i, l); out.push({ kind: "layer", track: i, layer: l, top, h }); top += h; }
    });
    return out;
  }, [tracks, counts, heights, many]); // eslint-disable-line react-hooks/exhaustive-deps
  const height = lanes.length ? lanes[lanes.length - 1].top + lanes[lanes.length - 1].h : RULER;
  const laneAt = (y: number) => (y < RULER ? -1 : Math.max(0, lanes.findIndex((l) => y < l.top + l.h) < 0 ? lanes.length - 1 : lanes.findIndex((l) => y < l.top + l.h)));
  const laneOf = (track: number, layer: number) => lanes.find((l) => l.kind === "layer" && l.track === track && l.layer === Math.min(layer, layersOf(track) - 1))!;
  const blockBox = (b: EBlock) => { const l = laneOf(b.track, layerOf(b)); return { top: l.top + LAYER.pad, h: l.h - LAYER.pad * 2 }; };

  // the time line: everything there is and room after it to move a block into, from the blocks as let go (not while
  // a drag runs); it shrinks again when blocks go, and a zoomed-in view keeps showing as much time as before
  const ownMs = Math.max(0, ...tracks.map((_, i) => (files[own(i)]?.buf.duration ?? 0) * 1000));
  const total = Math.max(1000, Math.ceil((Math.max(blocks.length ? 0 : ownMs, refMs, ...blocks.map(endOf), cues ? Math.max(cues.gameExit, cueOver.exit ?? 0) : 0) * 1.12) / 100) * 100);
  const zoom = useWaveZoom(total, MIN_SPAN);
  // the zoom this track was left at comes back once its blocks are there, and is kept as it changes
  const zoomKey = tracks.map((x) => x.source ?? x.file ?? "").join("|");
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || !hist.list.length) return;
    restored.current = true;
    const z = zooms.get(zoomKey);
    if (z) { zoom.fit(z.from, z.from + z.span); zoom.zoomY(z.y); }
  }, [hist.list.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (restored.current) keepZoom(zoomKey, zoom.zoomed ? { from: round1(zoom.from), span: round1(zoom.span), y: zoom.y } : null);
  }, [zoom.from, zoom.span, zoom.y]); // eslint-disable-line react-hooks/exhaustive-deps
  const lastTotal = useRef(total);
  useEffect(() => {
    const was = lastTotal.current;
    lastTotal.current = total;
    if (was !== total && zoom.x > 1) zoom.zoomX(zoom.x * (total / was), zoom.from + zoom.span / 2);
  }, [total]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ctx) return;
    for (const b of blocks) {
      if (tapeOf(b) || !fileOf(b)) continue;
      const key = bentKey(b);
      if (bentAsked.current.has(key)) continue;
      bentAsked.current.add(key);
      const f = b.audio || own(b.track), i = b.track, x = tracks[i], a = assign(i);
      const from = !f.startsWith("own:") ? { file: full(f) } : x.file ? { file: full(x.file) }
        : modes[i] === "original" || !a || a.silence ? { source: x.source } : { file: full(a.audio) };
      call<{ path: string }>("edit_stretch", { tempo: speedOf(b), pitch: b.pitch ?? 0, ...from })
        .then((got) => decode(fileUrl(got.path), ctx))
        .then((d) => setBent((m) => ({ ...m, [key]: d })), (e: any) => { bentAsked.current.delete(key); notify("bad", String(e?.message ?? e)); });
    }
  }, [blocks, ctx, files]); // eslint-disable-line react-hooks/exhaustive-deps
  const [cursor, setCursor] = useState(0);
  const [magnet, setMagnet] = useState(() => { try { return localStorage.getItem("audiodiver.waveMagnet") !== "0"; } catch { return true; } });
  useEffect(() => { try { localStorage.setItem("audiodiver.waveMagnet", magnet ? "1" : "0"); } catch { /* storage off */ } }, [magnet]);
  const [loop, setLoop] = useState(false);
  // tempo and pitch move together (a tape played faster) or each on its own
  const [link, setLink] = useState(() => { try { return localStorage.getItem("audiodiver.waveLink") !== "0"; } catch { return true; } });
  useEffect(() => { try { localStorage.setItem("audiodiver.waveLink", link ? "1" : "0"); } catch { /* storage off */ } }, [link]);
  const [curving, setCurving] = useState(false); // volume curves: their lines and points take the presses on a block

  // --- playback: each block of the lanes ticked a buffer source with its gain and fades, from the cursor; or Play in
  // Context, one file the core mixed, shifted so the playhead shows where it is in this segment
  const play = useRef<{ nodes: AudioScheduledSourceNode[]; t0: number; from: number; to: number; shift: number; timer: number } | null>(null);
  const [playing, setPlaying] = useState<Playing>(null);
  const [head, setHead] = useState<number | null>(null);
  const master = useMemo(() => { if (!ctx) return null; const g = ctx.createGain(); g.connect(ctx.destination); return g; }, [ctx]);
  useEffect(() => { if (master) master.gain.value = vol; }, [master, vol]);
  /** What Play plays: the blocks of the layers ticked, and each original whose box is ticked. */
  const heard = (list: EBlock[]) => {
    const out: { b: Block; f: Decoded; bent?: Decoded }[] = [];
    for (const b of list) { const f = fileOf(b); if (f && playsOf(b.track, layerOf(b))) out.push({ b, f, bent: tapeOf(b) ? undefined : bent[bentKey(b)] }); }
    tracks.forEach((_, i) => { const r = refOf(i); if (refPlays[i] && r) out.push({ b: whole(r.buf.duration * 1000, i), f: r }); });
    return out;
  };
  const audible = heard(shown);
  const stop = useCallback(() => {
    const p = play.current;
    play.current = null;
    if (p) { clearTimeout(p.timer); for (const n of p.nodes) { try { n.stop(); } catch { /* not started */ } n.disconnect(); } }
    setPlaying(null); setHead(null);
  }, []);
  useEffect(() => stop, [stop]);
  /** Plays the parts of `list` between from and to (ms), placed on the time line shifted by `shift`. */
  const schedule = (list: { b: Block; f: Decoded; bent?: Decoded }[], from: number, to: number, shift: number, what: Playing, again?: () => void) => {
    if (!ctx || !master) return;
    player.stop(); // the app's player and the editor never play over each other
    void ctx.resume();
    const t0 = ctx.currentTime + 0.04, nodes: AudioScheduledSourceNode[] = [];
    for (const { b, f, bent: bf } of list) {
      const len = lengthOf(b), into = Math.max(0, from - b.at_ms), sp = speedOf(b);
      if (endOf(b) <= from || b.at_ms >= to || into >= len) continue;
      const src = ctx.createBufferSource(), g = ctx.createGain();
      src.buffer = bf ? bf.buf : f.buf;
      if (!bf && sp !== 1) src.playbackRate.value = sp; // a tape played faster, or the stretched file not read yet
      src.connect(g).connect(master);
      const when = t0 + Math.max(0, b.at_ms - from) / 1000;
      const k = 10 ** (b.gain_db / 20), outAt = len - b.fade_out_ms, dur = (Math.min(len, to - b.at_ms) - into) / 1000;
      if (b.curve?.length) { // a volume curve: the whole level, sampled every 10 ms (the gain draws lines between)
        const n = clamp(Math.ceil(dur * 100), 2, 60000), vals = new Float32Array(n);
        for (let s = 0; s < n; s++) vals[s] = envelope(b, into + (s / (n - 1)) * dur * 1000);
        g.gain.setValueCurveAtTime(vals, when, Math.max(0.001, dur));
      } else {
        g.gain.setValueAtTime(envelope(b, into), when);
        if (b.fade_in_ms > into) g.gain.linearRampToValueAtTime(envelope(b, b.fade_in_ms), when + (b.fade_in_ms - into) / 1000);
        if (b.fade_out_ms > 0) {
          if (outAt > into) g.gain.setValueAtTime(b.fade_in_ms >= outAt ? envelope(b, outAt) : k, when + (outAt - into) / 1000);
          g.gain.linearRampToValueAtTime(0, when + (len - into) / 1000);
        }
      }
      // the stretched file holds the moment ms of the file at ms / tempo; the file itself plays `sp` times as fast
      if (bf) src.start(when, (b.start_ms / sp + into) / 1000, dur);
      else src.start(when, (b.start_ms + into * sp) / 1000, dur * sp);
      nodes.push(src);
    }
    const timer = window.setTimeout(() => {
      if (play.current?.timer !== timer) return;
      if (again) again(); else stop();
    }, (to - from) / 1000 * 1000 + 60);
    play.current = { nodes, t0, from, to, shift, timer };
    setPlaying(what);
  };
  const startPlay = useCallback((fromMs: number) => {
    stop();
    const list = heard(live ?? blocks);
    if (!list.length) return;
    // a loop plays the selected blocks over and over, else the whole of what plays; from past the end, from the start
    const chosen = loop ? sel.filter((i) => i < blocks.length).map((i) => blocks[i]) : [];
    const to = chosen.length ? Math.max(...chosen.map(endOf)) : Math.max(...list.map((x) => endOf(x.b)));
    let from = chosen.length ? Math.min(...chosen.map((b) => b.at_ms)) : Math.max(0, fromMs);
    if (from >= to - 1) from = 0;
    if (from >= to) return;
    schedule(list, from, to, 0, "edit", loop ? () => startPlay(chosen.length ? from : 0) : undefined);
  }, [ctx, master, files, refs, blocks, live, loop, sel, stop, plays, refPlays, modes, bent]); // eslint-disable-line react-hooks/exhaustive-deps
  // a change while it plays is heard at once: a block set otherwise, or a stretched file now read (Tempo and Pitch
  // apart), plays on from where the playhead is
  const lastHeard = useRef({ blocks, bent });
  useEffect(() => {
    if (lastHeard.current.blocks === blocks && lastHeard.current.bent === bent) return;
    lastHeard.current = { blocks, bent };
    const p = play.current;
    if (playing !== "edit" || !p || !ctx || loop) return;
    startPlay(p.from + Math.max(0, ctx.currentTime - p.t0) * 1000);
  }, [blocks, bent]); // eslint-disable-line react-hooks/exhaustive-deps
  const [preparing, setPreparing] = useState(false);
  /** Play in Context: the core mixes the segment before, this one as edited here and the one after; it plays from a
      little before Entry to a little after Exit. */
  const playContext = async () => {
    if (!cues || !ctx) return;
    if (playing === "context") { stop(); return; }
    stop();
    setPreparing(true);
    try {
      const got = await call<{ path: string; start_ms: number; entry_ms: number; exit_ms: number; duration_ms: number }>("edit_context", {
        cue: cues.cue, segment: cues.segment, entry_marker: cueOver.entry, exit_marker: cueOver.exit,
        tracks: tracks.flatMap((x, i) => (x.source ? [{ source: x.source, original: editOriginal(i), blocks: blocks.filter((b) => b.track === i).map(strip) }] : [])),
      });
      const f = await decode(`${fileUrl(got.path)}&v=${Date.now()}`, ctx);
      const from = Math.max(0, got.entry_ms - CONTEXT_MS), to = Math.min(got.duration_ms, got.exit_ms + CONTEXT_MS);
      schedule([{ b: whole(got.duration_ms, -1), f }], from, to, got.start_ms, "context");
    } catch (e: any) { notify("bad", String(e?.message ?? e)); }
    setPreparing(false);
  };
  useEffect(() => {
    if (!playing) return;
    let id = 0;
    const tick = () => {
      const p = play.current;
      if (p && ctx) setHead(p.from + Math.max(0, ctx.currentTime - p.t0) * 1000 - p.shift);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing, ctx]);
  const toggle = () => (playing === "edit" ? stop() : startPlay(cursor));
  /** The lanes that sound while Play plays: originals ("ref:i") and the layers ticked with blocks on them. */
  const sounding = useMemo(() => new Set([...tracks.flatMap((_, i) => (refPlays[i] && refOf(i) ? [`ref:${i}`] : [])),
    ...shown.filter((b) => playsOf(b.track, layerOf(b))).map((b) => lk(b.track, layerOf(b)))]), [shown, plays, refPlays, refs, files, modes]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- editing: on the selected blocks
  const chosen = () => sel.filter((i) => i < blocks.length);
  const set = (i: number, b: Partial<Block>) => commit(blocks.map((x, j) => (j === i ? fitted({ ...x, ...b }) : x)));
  /** A change to every selected block (the values beside the time line with several selected), fades kept inside. */
  const setMany = (b: Partial<Block>) => commit(blocks.map((x, j) => (picked.has(j) ? fitted({ ...x, ...b }) : x)));
  const splitAt = (ms: number) => {
    const inside = (b: Block) => b.at_ms + MIN_BLOCK < ms && ms < endOf(b) - MIN_BLOCK;
    let cut = chosen().filter((i) => inside(blocks[i]));
    if (!cut.length) { const j = lastIndex(blocks, (b) => b.track === on.track && layerOf(b) === on.layer && inside(b)); cut = [j >= 0 ? j : lastIndex(blocks, inside)].filter((i) => i >= 0); }
    if (!cut.length) return;
    const next: EBlock[] = [], rights: number[] = [];
    blocks.forEach((b, i) => {
      if (!cut.includes(i)) { next.push(b); return; }
      const at = b.start_ms + (ms - b.at_ms) * speedOf(b);
      next.push({ ...b, end_ms: at, fade_out_ms: 0, fade_in_ms: Math.min(b.fade_in_ms, ms - b.at_ms) });
      rights.push(next.length);
      next.push({ ...b, start_ms: at, at_ms: ms, fade_in_ms: 0, fade_out_ms: Math.min(b.fade_out_ms, endOf(b) - ms) });
    });
    commit(next);
    setSel(rights);
  };
  // a track with audio of its own keeps one block at least (no blocks would be the file as it is)
  const removable = sel.length > 0 && tracks.every((_, i) => !hasOwn(i) || blocks.some((b, j) => b.track === i && !picked.has(j)) || !blocks.some((b) => b.track === i));
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
  /** Merge: the selected blocks of one track as one block, of a file the core mixes from them as they play (gaps
      silence, overlaps together; core edit_merge), at the first of them on the highest of their layers. */
  const [merging, setMerging] = useState(false);
  // the files Merge made, and those an applied slot uses; the rest are deleted as the Suite closes (cancelled, the
  // merged block undone or removed, or only mixed into a file: a file's Apply, the slice tool's Cut)
  const made = useRef(new Set<string>());
  const kept = useRef(new Set<string>());
  useEffect(() => () => {
    const gone = [...made.current].filter((p) => !kept.current.has(p));
    gone.forEach((p) => merges.delete(p));
    if (gone.length) void call("edit_discard", { paths: gone }).catch(() => {});
  }, []);
  const mergeable = (() => { const list = chosen(); return list.length > 1 && !merging && list.every((i) => blocks[i].track === blocks[list[0]].track); })();
  const merge = async () => {
    const list = chosen();
    if (!mergeable || !ctx) return;
    const track = blocks[list[0]].track, x = tracks[track], lo = Math.min(...list.map((i) => blocks[i].at_ms));
    const parts = list.map((i) => ({ ...strip(blocks[i]), at_ms: round1(blocks[i].at_ms - lo), layer: 0 }));
    setMerging(true);
    stop();
    try {
      const got = await call<{ path: string }>("edit_merge", { ...(x.file ? { file: full(x.file) } : { source: x.source, original: editOriginal(track) }), blocks: parts, name: what });
      const f = await decode(fileUrl(got.path), ctx);
      merges.set(got.path, parts);
      made.current.add(got.path);
      asked.current.add(got.path);
      setFiles((m) => ({ ...m, [got.path]: f }));
      const one_: EBlock = { start_ms: 0, end_ms: round1(f.buf.duration * 1000), at_ms: lo, fade_in_ms: 0, fade_out_ms: 0, gain_db: 0, audio: got.path,
        layer: Math.min(...list.map((i) => layerOf(blocks[i]))), track };
      const kept = blocks.filter((_, j) => !picked.has(j));
      commit([...kept, one_]);
      setSel([kept.length]);
    } catch (e: any) { notify("bad", String(e?.message ?? e)); }
    setMerging(false);
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
  // --- placing the selected blocks, together: against the block before or after them on their layers (or the start),
  // at the start, or ending where the original ends (without one, after the other blocks)
  const shiftSel = (by: number) => {
    const list = chosen();
    if (!list.length) return;
    const d = Math.max(by, -Math.min(...list.map((i) => blocks[i].at_ms)));
    if (Math.abs(d) >= 0.05) commit(blocks.map((b, j) => (picked.has(j) ? { ...b, at_ms: b.at_ms + d } : b)));
  };
  const endTarget = () => {
    const list = chosen(), span = Math.max(...list.map((i) => endOf(blocks[i]))) - Math.min(...list.map((i) => blocks[i].at_ms));
    return refMs > 0 ? refMs : Math.max(0, ...blocks.filter((_, j) => !picked.has(j)).map(endOf)) + span;
  };
  const snapSide = (dir: -1 | 1) => {
    const list = chosen();
    if (!list.length) return;
    const lo = Math.min(...list.map((i) => blocks[i].at_ms)), hi = Math.max(...list.map((i) => endOf(blocks[i])));
    let by = dir < 0 ? -lo : Infinity;
    for (const i of list) {
      const b = blocks[i];
      for (const [j, o] of blocks.entries()) {
        if (picked.has(j) || o.track !== b.track || layerOf(o) !== layerOf(b)) continue;
        if (dir < 0 && endOf(o) <= b.at_ms + 0.05) by = Math.max(by, endOf(o) - b.at_ms);
        if (dir > 0 && o.at_ms >= endOf(b) - 0.05) by = Math.min(by, o.at_ms - endOf(b));
      }
    }
    if (!Number.isFinite(by)) by = Math.max(0, endTarget() - hi); // nothing after them: as far as the end
    shiftSel(by);
  };
  const placeAt = (where: "start" | "end") => {
    const list = chosen();
    if (!list.length) return;
    shiftSel(where === "start" ? -Math.min(...list.map((i) => blocks[i].at_ms)) : endTarget() - Math.max(...list.map((i) => endOf(blocks[i]))));
  };
  /** The layers worked on: those of the selected blocks, else the one the cursor's lane is. */
  const layersOn = () => new Set(chosen().length ? chosen().map((i) => lk(blocks[i].track, layerOf(blocks[i]))) : [lk(on.track, on.layer)]);
  /** Close Gaps: on each layer worked on, every block after the first moves back against the one before it;
      blocks that overlap keep overlapping as much. */
  const closeGaps = () => {
    const keys = layersOn(), next = blocks.map((b) => ({ ...b }));
    for (const key of keys) {
      const idx = next.map((_, j) => j).filter((j) => lk(next[j].track, layerOf(next[j])) === key).sort((p, q) => next[p].at_ms - next[q].at_ms);
      let reach = -Infinity, shift = 0;
      for (const j of idx) {
        let at = next[j].at_ms - shift;
        if (reach > -Infinity && at > reach) { shift += at - reach; at = reach; }
        next[j].at_ms = at;
        reach = Math.max(reach, endOf(next[j]));
      }
    }
    if (next.some((b, j) => Math.abs(b.at_ms - blocks[j].at_ms) >= 0.05)) commit(next);
  };
  const gapsIn = (() => { // whether a layer worked on has a gap between its blocks
    const keys = layersOn();
    for (const key of keys) {
      const list = blocks.filter((b) => lk(b.track, layerOf(b)) === key).sort((p, q) => p.at_ms - q.at_ms);
      let reach = -Infinity;
      for (const b of list) { if (reach > -Infinity && b.at_ms > reach + 0.05) return true; reach = Math.max(reach, endOf(b)); }
    }
    return false;
  })();
  /** The zoom to the selected blocks, or from the start to the end of the layers worked on. */
  const fitTo = (lo: number, hi: number) => { const pad = Math.max(10, (hi - lo) * 0.03); zoom.fit(Math.max(0, lo - pad), hi + pad); };
  const fitSelected = () => { const list = chosen(); if (list.length) fitTo(Math.min(...list.map((i) => blocks[i].at_ms)), Math.max(...list.map((i) => endOf(blocks[i])))); };
  const layerEnd = () => { const keys = layersOn(); return Math.max(0, ...blocks.filter((b) => keys.has(lk(b.track, layerOf(b)))).map(endOf)); };
  const fitLayers = () => { const end = layerEnd(); if (end > 0) fitTo(0, end); };
  const reset = () => {
    commit(tracks.flatMap((_, i) => (hasOwn(i) && files[own(i)] ? [whole(files[own(i)].buf.duration * 1000, i)] : [])));
    setSel(blocks.length ? [0] : []);
    setAsks({}); setActive({ track: 0, layer: 0 }); setPlays({}); setCueOver({ entry: cues?.entry ?? null, exit: cues?.exit ?? null });
  };

  // --- layers, within their track
  const addLayer = () => { const n = layersOf(on.track); if (n >= MAX_LAYERS) return; setAsks((x) => ({ ...x, [on.track]: n + 1 })); setActive({ track: on.track, layer: n }); };
  /** Moves the keys of a track's layers (heights, boxes) as `now` moves the layers; a layer `now` drops loses its key. */
  const rekey = <V,>(rec: Record<string, V>, track: number, now: (l: number) => number) => {
    const out: Record<string, V> = {};
    for (const [k, v] of Object.entries(rec)) {
      const [ti, li] = k.split(":").map(Number);
      if (ti !== track) { out[k] = v; continue; }
      const to = now(li);
      if (to >= 0) out[lk(ti, to)] = v;
    }
    return out;
  };
  const deleteLayer = async (track: number, i: number) => {
    const n0 = layersOf(track);
    if (n0 < 2) return;
    const n = blocks.filter((b) => b.track === track && layerOf(b) === i).length;
    if (n && !(await confirm({ title: t`Delete Layer ${i + 1}?`,
      text: n === 1 ? t`The block on it is removed with it. Undo brings both back.` : t`The ${n} blocks on it are removed with it. Undo brings them back.`,
      ok: t`Delete` }))) return;
    if (blocks.some((b) => b.track === track && layerOf(b) >= i)) {
      commit(blocks.filter((b) => b.track !== track || layerOf(b) !== i).map((b) => (b.track === track && layerOf(b) > i ? { ...b, layer: layerOf(b) - 1 } : b)));
      setSel([]);
    }
    const now = (l: number) => (l === i ? -1 : l > i ? l - 1 : l);
    setAsks((x) => ({ ...x, [track]: n0 - 1 }));
    setHeights((h) => rekey(h, track, now));
    setPlays((p) => rekey(p, track, now));
    setNames((p) => rekey(p, track, now));
    setActive((x) => (x.track !== track ? x : { track, layer: Math.max(0, x.layer > i ? x.layer - 1 : x.layer === i ? i - 1 : x.layer) }));
  };
  /** Moves a layer to another place in its track: its blocks go along, as do its height, its box and the layer worked on. */
  const moveLayer = (track: number, from: number, to: number) => {
    if (from === to) return;
    const order = range(0, layersOf(track));
    order.splice(to, 0, ...order.splice(from, 1));
    const now = (l: number) => order.indexOf(l);
    if (blocks.some((b) => b.track === track && now(layerOf(b)) !== layerOf(b))) commit(blocks.map((b) => (b.track === track ? { ...b, layer: now(layerOf(b)) } : b)));
    setHeights((h) => rekey(h, track, now));
    setPlays((p) => rekey(p, track, now));
    setNames((p) => rekey(p, track, now));
    setActive((x) => (x.track === track ? { track, layer: now(x.layer) } : x));
  };
  const [reorder, setReorder] = useState<{ track: number; from: number; to: number; dy: number } | null>(null);
  const startReorder = (e: React.PointerEvent, track: number, from: number) => {
    if (e.button !== 0 || layersOf(track) < 2) return;
    setActive({ track, layer: from });
    const mine = lanes.filter((l) => l.kind === "layer" && l.track === track);
    const centre = (l: Lane) => l.top + l.h / 2, at = centre(mine[from]);
    const target = (dy: number) => mine.filter((l, j) => j !== from && centre(l) < at + dy).length;
    setReorder({ track, from, to: from, dy: 0 });
    follow(e, (dy) => setReorder({ track, from, to: target(dy), dy }), (dy) => { setReorder(null); moveLayer(track, from, target(dy)); });
  };
  const startResize = (e: React.PointerEvent, track: number, layer: number) => {
    if (e.button !== 0) return;
    const h0 = hOf(track, layer);
    const to = (dy: number) => setHeights((h) => ({ ...h, [lk(track, layer)]: clamp(Math.round(h0 + dy), LAYER.min, LAYER.max) }));
    follow(e, to, to);
  };

  /** Puts audio in as blocks on the layer worked on, from the cursor: files whole, one after the other; a copied
      slot's blocks as they play there, each layer of them on a layer from this one down. */
  const [adding, setAdding] = useState(false);
  const insert = useCallback(async (items: Incoming[]) => {
    if (!ctx || !items.length) return;
    setAdding(true);
    const got: EBlock[] = [];
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
            const nb: EBlock = { ...b, audio: b.audio || item.audio, end_ms: round1(stop_), at_ms: round1(at + b.at_ms - first), layer: clamp(on.layer + layerOf(b) - top, 0, MAX_LAYERS - 1), track: on.track };
            got.push(nb); end = Math.max(end, endOf(nb));
          }
          at = end;
        } else {
          const ms = (await load(item.audio)).buf.duration * 1000;
          got.push({ start_ms: 0, end_ms: round1(ms), at_ms: round1(at), fade_in_ms: 0, fade_out_ms: 0, gain_db: 0, audio: item.audio, layer: on.layer, track: on.track });
          at += ms;
        }
      } catch (e: any) { notify("bad", t`${nameOf(item.audio)} can't be read: ${String(e?.message ?? e)}`); }
    }
    setFiles((x) => ({ ...x, ...known }));
    setAdding(false);
    if (got.length) { commit([...blocks, ...got]); setSelRaw(range(blocks.length, got.length)); }
  }, [ctx, cursor, files, urlOf, blocks, commit, on.track, on.layer]); // eslint-disable-line react-hooks/exhaustive-deps
  const addFiles = async (paths?: string[]) => {
    paths ??= (await pickAudio(true)) ?? [];
    await insert(paths.map((audio) => ({ audio })));
  };
  /** Ctrl+V: what was copied last, slots in the list or files in Explorer (store clipForEditor). */
  const paste = async () => { if (ctx && !adding) await insert(await actions.clipForEditor()); };
  // audio dropped on the editor (App.tsx hands it over) comes in as added files
  useEffect(() => onWaveDrop((paths) => void insert(paths.map((audio) => ({ audio })))), [insert]);

  // --- Apply: each track that changed (a slot's blocks, a file saved anew for onFile), and the cue points
  const [saving, setSaving] = useState(false);
  const applies = tracks.map((x, i) => (trackChanged(i) || editOriginal(i) || (!!x.source && namesChanged(i))) && blocks.some((b) => b.track === i));
  const apply = async () => {
    if (saving || !blocks.length || !(applies.some(Boolean) || cuesChanged)) return;
    const replaced = tracks.flatMap((_, i) => { const a = assign(i); return applies[i] && editOriginal(i) && a && !a.silence ? [a.name] : []; });
    if (replaced.length && !(await confirm({ title: t`Replace the New Audio?`, text: replaced.length === 1
      ? t`The edited original becomes the new audio of this slot, in place of ${replaced[0]}.`
      : t`The edited originals become the new audio of their slots, in place of what is there.`, ok: t`Replace` }))) return;
    setSaving(true);
    stop();
    let ok = true;
    for (const [i, x] of tracks.entries()) {
      if (!applies[i] || !ok) continue;
      const list = blocks.filter((b) => b.track === i).map(strip);
      if (x.file) {
        try {
          const got = await call<{ path: string }>("edit_render", { file: full(x.file), blocks: list });
          await onFile?.(got.path);
        } catch (e: any) { notify("bad", String(e?.message ?? e)); ok = false; }
      } else {
        ok = await actions.setEdit(x.source!, list, editOriginal(i), editOriginal(i) ? t`${x.name} (edited original)` : undefined, namesOf(i));
        if (ok) list.forEach((b) => b.audio && made.current.has(b.audio) && kept.current.add(b.audio));
      }
    }
    if (ok && cues && cuesChanged) await actions.segmentOverride(cues.segment, cueOver.entry, cueOver.exit);
    setSaving(false);
    if (ok) onClose();
  };
  // --- Export: the lanes ticked, as one file
  const [exporting, setExporting] = useState(false);
  const exportable = blocks.some((b) => playsOf(b.track, layerOf(b))) || tracks.some((_, i) => refPlays[i] && !!refOf(i));
  const doExport = async (prefs: ExportPrefs) => {
    const ext = EXPORT_FORMATS.find((f) => f[0] === prefs.fmt)?.[2] ?? "wav";
    const path = await pickAudioToSave(`${what} (edited).${ext}`.replace(/[\\/:*?"<>|]/g, "-"), ext);
    if (!path) return false;
    try {
      const sent = tracks.map((x, i) => ({ ...(x.file ? { file: full(x.file) } : { source: x.source, original: editOriginal(i), with_original: !!refPlays[i] && !!refOf(i) }),
        blocks: blocks.filter((b) => b.track === i && playsOf(i, layerOf(b))).map(strip) }));
      const got = await call<{ path: string }>("edit_export", { tracks: sent, path, fmt: prefs.fmt, rate: prefs.rate, channels: prefs.channels, normalize: prefs.normalize });
      quick(t`Exported **${nameOf(got.path)}**`, "done");
      return true;
    } catch (e: any) { notify("bad", String(e?.message ?? e)); return false; }
  };
  const close = async () => {
    if (changed && !(await confirm({ title: t`Discard the Changes?`, text: t`The changes made in the Waveform Suite are lost.`, ok: t`Discard`, cancel: t`Keep Editing` }))) return;
    stop();
    onClose();
  };
  const box = useDialog(() => void close());

  // --- the canvas: the ruler, each track's original and layers with their blocks, the cue points, the cursor and the playhead
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
  const flags = useRef<{ entry?: [number, number]; exit?: [number, number] }>({}); // the cue points' flags on the ruler, as drawn

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
    const fs = parseFloat(v("--fs")) || 1;
    g.clearRect(0, 0, width, height);
    // the ruler: a tick on round times, labelled
    g.fillStyle = v("--panel"); g.fillRect(0, 0, width, RULER);
    const step = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 30000, 60000].find((s) => (s / view.span) * width >= 70) ?? 120000;
    g.font = `${11 * fs}px ${v("--body") || "sans-serif"}`;
    g.fillStyle = v("--muted"); g.strokeStyle = v("--line");
    for (let ms = Math.floor(view.from / step) * step; ms <= view.from + view.span; ms += step) {
      const x = Math.round(xOf(ms)) + 0.5;
      g.beginPath(); g.moveTo(x, RULER - 7); g.lineTo(x, RULER); g.stroke();
      g.fillText(step < 1000 ? `${fmtDecimal(ms / 1000, step < 10 ? 3 : step < 100 ? 2 : 1)} s` : fmtTime(ms), x + 3, RULER - 10);
    }
    const wave = (top: number, h: number, f: Decoded, from: number, to: number, at: number, colour: string, alpha: number, b?: Block) => {
      const sp = b ? speedOf(b) : 1; // a block at another tempo: its file goes by sp times as fast
      const mid = top + h / 2, x0 = Math.max(0, Math.floor(xOf(at))), x1 = Math.min(width, Math.ceil(xOf(at + (to - from) / sp)));
      g.globalAlpha = alpha; g.fillStyle = colour;
      for (let x = x0; x < x1; x++) {
        const m0 = from + (msOf(x) - at) * sp, m1 = from + (msOf(x + 1) - at) * sp;
        let lv = levelAt(f, Math.max(from, m0), Math.min(to, m1)) * zoom.y;
        if (b) lv *= envelope(b, ((m0 + m1) / 2 - from) / sp);
        const hh = Math.max(0.5, Math.min(1, lv) * (h / 2 - 3));
        g.fillRect(x, mid - hh, 1, hh * 2);
      }
      g.globalAlpha = 1;
    };
    g.fillStyle = v("--bg"); g.fillRect(0, RULER, width, height - RULER);
    // the lanes playing have a see-through tint of their colour; the layer worked on a shade lighter
    const glow = (top: number, h: number, colour: string) => { g.fillStyle = colour; g.globalAlpha = 0.1; g.fillRect(0, top, width, h); g.globalAlpha = 1; };
    lanes.forEach((l, k) => {
      const playingHere = playing === "edit" && sounding.has(l.kind === "ref" ? `ref:${l.track}` : lk(l.track, l.layer));
      if (l.kind === "ref") {
        if (playingHere) glow(l.top, l.h, v("--steel"));
        const r = refOf(l.track);
        if (r) wave(l.top, l.h, r, 0, r.buf.duration * 1000, 0, playingHere ? v("--steel") : v("--steel-dim"), 1);
        if (cues) { // the game's cue points, on the original
          g.strokeStyle = v("--muted"); g.globalAlpha = 0.8;
          for (const ms of [cues.gameEntry, cues.gameExit]) { const x = Math.round(xOf(ms)) + 0.5; g.beginPath(); g.moveTo(x, l.top); g.lineTo(x, l.top + l.h); g.stroke(); }
          g.globalAlpha = 1;
        }
      } else {
        if (l.track === on.track && l.layer === on.layer && lanes.filter((x) => x.kind === "layer").length > 1) {
          g.fillStyle = v("--panel"); g.globalAlpha = 0.45; g.fillRect(0, l.top, width, l.h); g.globalAlpha = 1;
        }
        if (playingHere) glow(l.top, l.h, v("--accent-fg"));
      }
      // apart by a line; a track from the one above by a stronger one
      const newTrack = k > 0 && lanes[k - 1].track !== l.track;
      g.strokeStyle = newTrack ? v("--line") : v("--line-soft"); g.lineWidth = newTrack ? 2 : 1;
      g.beginPath(); g.moveTo(0, l.top + (newTrack ? 1 : 0.5)); g.lineTo(width, l.top + (newTrack ? 1 : 0.5)); g.stroke(); g.lineWidth = 1;
    });
    // the blocks: the selected ones last, on top; each names its file when there are several; a layer not ticked dimmer
    const named = new Set(shown.map((b) => b.audio || own(b.track))).size > 1;
    const order = shown.map((_, i) => i).sort((x, y) => Number(picked.has(x)) - Number(picked.has(y)));
    for (const i of order) {
      const b = shown[i], ci = colourOf[i], colour = ci == null ? v("--accent-fg") : palette[ci % palette.length];
      const x0 = xOf(b.at_ms), x1 = xOf(endOf(b)), { top, h } = blockBox(b);
      if (x1 < 0 || x0 > width) continue;
      const see = ci != null, quiet = !playsOf(b.track, layerOf(b)); // overlapping: see-through, so both show
      g.globalAlpha = see ? 0.16 : 0.1; g.fillStyle = colour; g.fillRect(x0, top, x1 - x0, h); g.globalAlpha = 1;
      const bf = fileOf(b);
      if (bf) wave(top, h, bf, b.start_ms, b.end_ms, b.at_ms, colour, (see ? 0.55 : 0.9) * (quiet ? 0.45 : 1), b);
      if (named && x1 - x0 > 40 && h > 30) { // which file, at the foot of the block
        g.save(); g.beginPath(); g.rect(x0, top, x1 - x0, h); g.clip();
        g.fillStyle = colour; g.fillText(b.audio ? nameOf(b.audio) : ownName(b.track), Math.max(x0, 0) + 6, top + h - 6); g.restore();
      }
      // the fades: a shade over the part that fades, under a line from silence to full
      const fi = xOf(b.at_ms + b.fade_in_ms), fo = xOf(endOf(b) - b.fade_out_ms);
      g.fillStyle = v("--bg"); g.globalAlpha = 0.55; // the faded part, shaded with the page's own colour (any theme)
      if (b.fade_in_ms > 0) { g.beginPath(); g.moveTo(x0, top); g.lineTo(fi, top); g.lineTo(x0, top + h); g.closePath(); g.fill(); }
      if (b.fade_out_ms > 0) { g.beginPath(); g.moveTo(x1, top); g.lineTo(fo, top); g.lineTo(x1, top + h); g.closePath(); g.fill(); }
      g.globalAlpha = 1;
      g.strokeStyle = colour; g.lineWidth = 1.25;
      g.beginPath(); g.moveTo(x0, top + h); g.lineTo(fi, top); g.lineTo(fo, top); g.lineTo(x1, top + h); g.stroke();
      // the volume curve: a line from full at the top to silence at the foot; its points show while curves are on
      if (curving || b.curve?.length) {
        const yOf = (lv: number) => top + (1 - lv) * h, xAt = (ms: number) => xOf(b.at_ms + (ms - b.start_ms) / speedOf(b));
        const pts = (b.curve ?? []).map((p, k) => [p[0], p[1], k]).filter((p) => p[0] >= b.start_ms && p[0] <= b.end_ms);
        g.save(); g.beginPath(); g.rect(x0 - 1, top - 1, x1 - x0 + 2, h + 2); g.clip();
        g.strokeStyle = v("--text"); g.lineWidth = 1.5; g.globalAlpha = curving ? 0.95 : 0.6;
        g.beginPath(); g.moveTo(x0, yOf(curveAt(b, b.start_ms)));
        for (const p of pts) g.lineTo(xAt(p[0]), yOf(p[1]));
        g.lineTo(x1, yOf(curveAt(b, b.end_ms))); g.stroke(); g.globalAlpha = 1;
        g.restore();
        if (curving) {
          const d = drag.current, held = d && d.kind === "point" && d.i === i ? d.pt : -1;
          for (const p of pts) {
            const px = xAt(p[0]), py = yOf(p[1]);
            g.beginPath(); g.arc(px, py, p[2] === held ? 4.5 : 3.5, 0, Math.PI * 2);
            g.fillStyle = p[2] === held ? v("--text") : v("--bg"); g.fill(); g.lineWidth = 1.5; g.strokeStyle = v("--text"); g.stroke(); g.lineWidth = 1;
            if (p[2] === held) { // the level it is at, beside it
              const label = dbText(p[1]), tw = g.measureText(label).width + 8, lx = clamp(px + 8, 0, width - tw), ly = clamp(py - 22, RULER, height - 18);
              g.fillStyle = v("--text"); g.fillRect(lx, ly, tw, 16); g.fillStyle = v("--bg"); g.fillText(label, lx + 4, ly + 12);
            }
          }
        }
      }
      // the frame, and the fade grips on the top edge: filled in the block's colour on a selected block, outlined on the others
      const isOn = picked.has(i);
      g.lineWidth = isOn ? 2 : 1; g.strokeStyle = isOn ? v("--text") : colour;
      g.strokeRect(x0 + (isOn ? 1 : 0.5), top + (isOn ? 1 : 0.5), x1 - x0 - (isOn ? 2 : 1), h - (isOn ? 2 : 1));
      g.lineWidth = 1;
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
      g.beginPath(); g.moveTo(x, RULER); g.lineTo(x, height); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
    }
    // the segment's cue points: a line down the layers and a flag on the ruler, Entry after its line and Exit before
    // it, each kept on the canvas and Exit's clear of Entry's; where the flags are is what a press on the ruler takes
    flags.current = {};
    if (cues) {
      let entryEnd = -Infinity;
      for (const [ms, name, kind] of [[entryAt, ENTRY, "entry"], [exitAt, EXIT, "exit"]] as const) {
        const x = Math.round(xOf(ms)) + 0.5;
        if (x < -1 || x > width + 1) continue;
        g.strokeStyle = v("--text"); g.lineWidth = 1.5;
        for (const l of lanes) if (l.kind === "layer") { g.beginPath(); g.moveTo(x, l.top); g.lineTo(x, l.top + l.h); g.stroke(); }
        g.lineWidth = 1;
        const tw = g.measureText(name).width + 10;
        let fx = clamp(kind === "entry" ? x : x - tw, 0, width - tw);
        if (kind === "exit" && fx < entryEnd + 2) fx = Math.min(width - tw, entryEnd + 2);
        if (kind === "entry") entryEnd = fx + tw;
        g.fillStyle = v("--text"); g.fillRect(fx, 3, tw, RULER - 6);
        g.fillStyle = v("--bg"); g.fillText(name, fx + 5, RULER - 8);
        flags.current[kind] = [Math.min(fx, x - FLAG_PX), Math.max(fx + tw, x + FLAG_PX)];
      }
    }
    // the slice tool's cuts (embedded): a dashed line each, and at the foot the number of the piece it starts (where
    // there is room for it; cuts on one spot, their pieces merged, show once)
    if (embed?.marks) {
      const cuts = embed.marks(shown.map(strip)).filter((ms, i, a) => i === 0 || ms - a[i - 1] >= 1);
      let lastLabel = -Infinity;
      cuts.forEach((ms, i) => {
        const x = Math.round(xOf(ms)) + 0.5;
        if (x < -1 || x > width + 1) return;
        g.strokeStyle = v("--accent-fg"); g.lineWidth = 1; g.setLineDash([5, 4]);
        g.beginPath(); g.moveTo(x, RULER); g.lineTo(x, height); g.stroke(); g.setLineDash([]);
        if (i >= cuts.length - 1) return;
        const label = String(i + 1), w = g.measureText(label).width + 8;
        if (x < lastLabel) return;
        g.fillStyle = v("--accent-fg"); g.fillRect(x, height - 16, w, 16);
        g.fillStyle = v("--bg"); g.fillText(label, x + 4, height - 4);
        lastLabel = x + w + 2;
      });
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
      g.strokeStyle = playing === "context" ? v("--second-fg") : v("--text"); g.lineWidth = 1; g.setLineDash(playing === "context" ? [3, 3] : []);
      g.beginPath(); g.moveTo(hx, RULER); g.lineTo(hx, height); g.stroke(); g.setLineDash([]);
    }
  }); // drawn after every render: a drag, the playhead and the zoom all change what shows

  // --- the pointer: what a press at a spot takes, and the magnet
  const nearCursor = (x: number) => Math.abs(x - xOf(cursor)) <= CURSOR_PX;
  const hitAt = (x: number, y: number): Hit => {
    if (y < RULER) { // the ruler: a cue point's flag (as last drawn), else the cursor goes along it
      for (const kind of ["exit", "entry"] as const) {
        const f = flags.current[kind];
        if (f && x >= f[0] && x <= f[1]) return { kind, i: -1, under: [] };
      }
      return { kind: "cursor", i: -1, under: [] };
    }
    const lane = lanes[laneAt(y)];
    if (!lane || lane.kind === "ref") return { kind: nearCursor(x) ? "cursor" : "box", i: -1, under: [] };
    const here = shown.map((_, i) => i).filter((i) => shown[i].track === lane.track && layerOf(shown[i]) === lane.layer);
    const first = here.sort((p, q) => (picked.has(p) !== picked.has(q) ? (picked.has(p) ? -1 : 1) : lengthOf(shown[p]) - lengthOf(shown[q]))); // selected, then shortest
    if (curving) for (const i of first) { // a volume curve's point
      const b = shown[i], { top, h } = blockBox(b), c = b.curve ?? [];
      for (let k = 0; k < c.length; k++) {
        if (c[k][0] < b.start_ms || c[k][0] > b.end_ms) continue;
        if (Math.hypot(x - xOf(b.at_ms + (c[k][0] - b.start_ms) / speedOf(b)), y - (top + (1 - c[k][1]) * h)) <= POINT_PX) return { kind: "point", i, under: [], pt: k };
      }
    }
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
    if (curving) for (const i of first) { // a volume curve's line: a press puts a point there
      const b = shown[i], { top, h } = blockBox(b);
      if (x < xOf(b.at_ms) || x > xOf(endOf(b))) continue;
      if (Math.abs(y - (top + (1 - curveAt(b, b.start_ms + (msOf(x) - b.at_ms) * speedOf(b))) * h)) <= LINE_PX) return { kind: "line", i, under: [] };
    }
    // the body: of the blocks under the spot, a selected one, else the shortest (a longer one shows elsewhere)
    const under = first.filter((i) => x >= xOf(shown[i].at_ms) && x <= xOf(endOf(shown[i]))).sort((p, q) => lengthOf(shown[p]) - lengthOf(shown[q]));
    if (under.length) return { kind: "move", i: under.find((i) => picked.has(i)) ?? under[0], under };
    return { kind: nearCursor(x) ? "cursor" : "box", i: -1, under: [] };
  };
  /** The nearest spot the magnet pulls to within reach of each candidate, or the candidates as they are. */
  const snap = (candidates: number[], skip: Set<number> | null, withCursor = true, withCues = true) => {
    if (!magnet) return 0;
    const reach = (SNAP_PX / width) * view.span;
    const spots = [0, ...(withCursor ? [cursor] : []), ...(refMs ? [refMs] : []), ...(cues && withCues ? [entryAt, exitAt] : []),
      ...blocks.flatMap((b, j) => (skip?.has(j) ? [] : [b.at_ms, endOf(b)]))];
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
  const reshape = (d: Drag, dx: number, y: number): EBlock[] => {
    const b = d.from[d.i], dms = (dx / width) * view.span;
    if (d.kind === "point") { // a volume curve's point: in time between its neighbours (and inside the block), in level by height
      const c = (b.curve ?? []).map((p) => [...p]), k = d.pt, { top, h } = blockBox(b);
      const lo = Math.max(b.start_ms, k > 0 ? c[k - 1][0] : -Infinity), hi = Math.min(b.end_ms, k < c.length - 1 ? c[k + 1][0] : Infinity);
      c[k] = [clamp(b.start_ms + (msOf(d.x0 + dx) - b.at_ms) * speedOf(b), lo, hi), clamp(1 - (y - top) / h, 0, 1)];
      return d.from.map((x, j) => (j === d.i ? { ...b, curve: c } : x));
    }
    if (d.kind === "move") { // the blocks taken move together, in time, and from layer to layer within their tracks
      const group = d.group.map((j) => d.from[j]);
      const minAt = Math.min(...group.map((x) => x.at_ms)), maxEnd = Math.max(...group.map(endOf));
      let by = Math.max(-minAt, dms);
      by = Math.max(-minAt, by + snap([minAt + by, maxEnd + by], new Set(d.group)));
      const lane = lanes[laneAt(y)];
      let dl = lane && lane.kind === "layer" && lane.track === b.track ? lane.layer - layerOf(b) : lane && lane.track === b.track && lane.kind === "ref" ? -layerOf(b) : 0;
      if (lane && lane.track !== b.track) dl = (lane.track > b.track ? layersOf(b.track) - 1 : 0) - layerOf(b); // past its track: its first or last layer
      for (const x of group) dl = clamp(dl, -layerOf(x), layersOf(x.track) - 1 - layerOf(x));
      const moving = new Set(d.group);
      return d.from.map((x, j) => (moving.has(j) ? { ...x, at_ms: x.at_ms + by, layer: layerOf(x) + dl } : x));
    }
    const next = { ...b };
    if (d.kind === "trimL") {
      // the file stays put: the block starts later in the file and later on the line by the same amount
      let at = b.at_ms + dms;
      at += snap([at], new Set([d.i]));
      const sp = speedOf(b), by = Math.max(-b.start_ms / sp, -b.at_ms, Math.min(at - b.at_ms, lengthOf(b) - MIN_BLOCK - b.fade_out_ms));
      Object.assign(next, { start_ms: b.start_ms + by * sp, at_ms: b.at_ms + by, fade_in_ms: Math.max(0, Math.min(b.fade_in_ms, lengthOf(b) - by - b.fade_out_ms)) });
    } else if (d.kind === "trimR") {
      let end = endOf(b) + dms;
      end += snap([end], new Set([d.i]));
      const sp = speedOf(b), len = Math.max(MIN_BLOCK + b.fade_in_ms, Math.min((msOfFile(b) - b.start_ms) / sp, end - b.at_ms));
      Object.assign(next, { end_ms: b.start_ms + len * sp, fade_out_ms: Math.max(0, Math.min(b.fade_out_ms, len - b.fade_in_ms)) });
    } else if (d.kind === "fadeIn") {
      next.fade_in_ms = Math.max(0, Math.min(lengthOf(b) - b.fade_out_ms, b.fade_in_ms + dms));
    } else if (d.kind === "fadeOut") {
      next.fade_out_ms = Math.max(0, Math.min(lengthOf(b) - b.fade_in_ms, b.fade_out_ms - dms));
    }
    return d.from.map((x, j) => (j === d.i ? next : x));
  };
  /** Where a cue point lands at x: snapped to block edges and the cursor, and kept apart from the other one. */
  const cueTo = (kind: "entry" | "exit", x: number) => {
    const ms = Math.max(0, msOf(x)), at = ms + snap([ms], null, true, false);
    return kind === "entry" ? clamp(at, 0, exitAt - CUE_GAP) : Math.max(entryAt + CUE_GAP, at);
  };
  /** The blocks a box drawn on the canvas touches, on any layer of any track. */
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
    (e.currentTarget.closest(".wave-ed") as HTMLElement | null)?.focus({ preventScroll: true }); // a field left is set; the keys come here
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const { x, y } = local(e), hit = hitAt(x, y), lane = lanes[laneAt(y)], add = e.shiftKey || e.ctrlKey || e.metaKey;
    if (y >= RULER && lane) setActive({ track: lane.track, layer: lane.kind === "layer" ? lane.layer : 0 });
    const base: Drag = { kind: hit.kind, i: hit.i, x0: x, y0: y, from: blocks, moved: false, again: false, under: hit.under, group: [], base: [], add, pt: -1, made: false };
    if (hit.kind === "entry" || hit.kind === "exit") { drag.current = base; return; }
    if (hit.kind === "point" || hit.kind === "line") { // a volume curve: a point taken (Alt: removed), or put on the line and taken
      const b = blocks[hit.i];
      let curve = (b.curve ?? []).map((p) => [...p]), pt = hit.pt ?? -1;
      if (hit.kind === "point" && e.altKey) { commit(blocks.map((x2, j) => (j === hit.i ? { ...x2, curve: withoutPoint(x2, pt) } : x2))); return; }
      if (hit.kind === "line") {
        if (curve.length >= MAX_CURVE) return;
        const ms = round1(b.start_ms + (msOf(x) - b.at_ms) * speedOf(b)), lv = curveAt(b, ms);
        if (!curve.length) curve = [[b.start_ms, 1], [b.end_ms, 1]]; // the first point: the ends stay at full
        pt = curve.filter((p) => p[0] <= ms).length;
        curve.splice(pt, 0, [ms, lv]);
      }
      const from = blocks.map((x2, j) => (j === hit.i ? { ...x2, curve } : x2));
      if (!picked.has(hit.i) || sel.length > 1) setSel([hit.i]);
      if (hit.kind === "line") setLive(from);
      drag.current = { ...base, kind: "point", from, pt, made: hit.kind === "line", group: [hit.i] };
      return;
    }
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
    if (!d.moved && Math.abs(x - d.x0) < 3 && (d.kind === "box" || d.kind === "point" ? Math.abs(y - d.y0) < 3 : d.kind !== "move" || laneAt(y) === laneAt(d.y0))) return;
    d.moved = true;
    if (d.kind === "cursor") { cursorTo(x); return; }
    if (d.kind === "entry" || d.kind === "exit") { setCueLive({ [d.kind]: cueTo(d.kind, x) }); return; }
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
    if (d.kind === "entry" || d.kind === "exit") { // let go near the automatic spot: back onto it, the project's own cleared
      setCueLive(null);
      if (!d.moved) return;
      const at = cueTo(d.kind, x), auto = d.kind === "entry" ? autoEntry : autoExit;
      setCueOver((c) => ({ ...c, [d.kind]: Math.abs(xOf(at) - xOf(auto)) <= SNAP_PX ? null : round1(at) }));
      return;
    }
    if (d.kind === "box") { if (!d.moved) { cursorTo(x); if (!d.add) setSel([]); } return; } // a click on an empty spot: the cursor goes there
    if (d.kind === "point") { if (d.moved) commit(reshape(d, x - d.x0, y)); else if (d.made) commit(d.from); else setLive(null); return; }
    if (d.moved) { commit(reshape(d, x - d.x0, y)); return; }
    // a click on a block: the cursor goes there, the block alone is selected; on the one block selected, where others
    // lie under it too, the next of them
    cursorTo(x); setLive(null);
    if (d.kind === "move" && d.again && !quick2 && d.under.length > 1) setSel([d.under[(d.under.indexOf(d.i) + 1) % d.under.length]]);
    else if (sel.length > 1) setSel([d.i]);
  };
  /** A double click: the cursor goes there and the lanes ticked play from there; on a volume curve's point, the point goes. */
  const onDouble = (e: React.MouseEvent) => {
    if (!ready || (e.target as HTMLElement).closest("button")) return;
    const { x, y } = local(e);
    const pt = curving && y >= RULER ? hitAt(x, y) : null;
    if (pt?.kind === "point") { commit(blocks.map((b, j) => (j === pt.i ? { ...b, curve: withoutPoint(b, pt.pt!) } : b))); return; }
    if (y < RULER && cues && (hitAt(x, y).kind === "entry" || hitAt(x, y).kind === "exit")) return;
    const ms = Math.max(0, msOf(x)), at = Math.max(0, ms + snap([ms], null, false));
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
  // the Suite's commands, on the keys Settings ▸ Shortcuts gives them (keys.ts); a few keys stay fixed
  const commands: Record<SuiteCommand, () => void> = {
    suitePlay: toggle, suiteStop: () => { stop(); setCursor(0); }, suiteLoop: () => setLoop((l) => !l),
    suiteContext: () => { if (cues) void playContext(); }, suiteAdd: () => { if (ctx && !adding) void addFiles(); },
    suiteSplit: () => splitAt(cursor), suiteNormalize: normalize, suiteDuplicate: duplicate, suiteMerge: () => void merge(),
    suiteRemove: remove, suiteSnapLeft: () => snapSide(-1), suiteSnapRight: () => snapSide(1), suiteToStart: () => placeAt("start"),
    suiteToEnd: () => placeAt("end"), suiteCloseGaps: closeGaps, suiteMagnet: () => setMagnet((m) => !m), suiteCurves: () => setCurving((c) => !c),
    suiteUndo: undo, suiteRedo: redo, suiteReset: () => { if (ready) reset(); }, suiteFitSel: fitSelected, suiteFitLayer: fitLayers,
    suiteNewLayer: addLayer, suitePaste: () => void paste(), suiteSelectAll: () => setSel(range(0, blocks.length)),
    suiteExport: () => { if (ready && exportable) { stop(); setExporting(true); } },
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (exporting || (e.target as HTMLElement).closest("input:not([type=checkbox]), textarea, select")) return;
    const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
    const did = () => { e.preventDefault(); e.stopPropagation(); };
    const id = suiteCommand(e.nativeEvent);
    if (id) { did(); commands[id](); }
    else if (k === "home" && !mod) { did(); setCursor(0); }
    else if (k === "end" && !mod) { did(); setCursor(resultMs); }
    else if ((k === "arrowleft" || k === "arrowright") && !mod) { did(); nudge((k === "arrowleft" ? -1 : 1) * NUDGE * (e.shiftKey ? 10 : 1)); }
    else if (k === "enter" && mod && !embed) { did(); void apply(); }
  };
  /** A button that goes away or turns off under the focus (Merge while it works, Remove with nothing left to remove)
      drops the focus to the page: it comes back to the Suite, so its keys go on working. */
  const keepFocus = (e: React.FocusEvent<HTMLElement>) => {
    if (e.relatedTarget) return;
    const root = e.currentTarget;
    requestAnimationFrame(() => { if (root.isConnected && (document.activeElement === document.body || !document.activeElement)) root.focus({ preventScroll: true }); });
  };
  const kl = (id: SuiteCommand) => keyLabel(id) || undefined;
  const curvesKey = keyLabel("suiteCurves") || "—";

  const cursorCls = { move: "grab", trimL: "ew-resize", trimR: "ew-resize", fadeIn: "col-resize", fadeOut: "col-resize", cursor: "ew-resize", box: "crosshair", entry: "ew-resize", exit: "ew-resize", point: "grab", line: "copy" } as const;
  const single = tracks.length === 1 ? 0 : null;
  const head_ = single != null && !isFile(0) ? (editOriginal(0) ? t`Original` : assign(0) && !assign(0)!.silence ? assign(0)!.name : t`New audio`)
    : single != null ? nameOf(tracks[0].file!) : t`${tracks.length} slots`;
  const diff = refMs ? resultMs - refMs : 0;
  const selList = chosen().map((i) => blocks[i]);
  const tool = (icon: React.ReactNode, label: string, onClick: () => void, disabled: boolean, key?: string, more?: string) => (
    <button className="icon-btn" onClick={onClick} disabled={disabled} aria-label={label} data-tip={label} data-tip-key={key} data-tip-more={more}>{icon}</button>
  );
  const checkTip = t`Ticked lanes play with Play and go into Export`;
  const checkMore = t`Apply keeps every layer, ticked or not`;
  const applyText = applyLabel ?? (single != null && (editOriginal(0) || !hasOwn(0)) && !isFile(0) ? t`Use as New Audio` : t`Apply`);
  const empty = single != null && !shown.length;
  // on the body: the waveform panel it opens from would hold a fixed box inside itself
  const main = (
        <div className="wave-ed-main">
        <div className="wave-ed-left">
        <div className="wave-ed-over">
          <div className="wave-ed-tools" role="toolbar" aria-label={t`Waveform Suite tools`}>
            <div className="wave-ed-group" role="group" aria-label={t`Playback`}>
              <button className={`icon-btn wave-ed-play${playing === "edit" ? " on" : ""}`} onClick={toggle} disabled={!ready || !audible.length}
                aria-label={playing === "edit" ? t`Pause` : t`Play`} data-tip={playing === "edit" ? t`Pause` : audible.length ? t`Play from the cursor` : t`Tick a lane to play it`}
                data-tip-more={t`Plays the lanes ticked. A double click on the waveforms plays from there`} data-tip-key={kl("suitePlay")}>
                {playing === "edit" ? <PauseIcon /> : <PlayIcon />}</button>
              {tool(<StopIcon />, t`Stop`, () => { stop(); setCursor(0); }, false, kl("suiteStop"), t`Puts the cursor back at the start`)}
              <button className="icon-btn wave-ed-toggle" aria-pressed={loop} onClick={() => setLoop(!loop)} aria-label={t`Loop`}
                data-tip={loop ? t`Loop: on` : t`Loop: off`} data-tip-more={t`Plays the selected blocks over and over, or the whole result`} data-tip-key={kl("suiteLoop")}><LoopIcon /></button>
              {cues && <button className={`icon-btn wave-ed-context${playing === "context" ? " on" : ""}`} onClick={() => void playContext()} disabled={!ready || preparing || !blocks.length}
                aria-label={t`Play in Context`} data-tip={playing === "context" ? t`Stop` : preparing ? t`Mixing the segments…` : t`Play in Context`} data-tip-key={kl("suiteContext")}
                data-tip-more={t`Plays the end of the segment before, this segment as edited here and the start of the one after, handed over at the cue points as in game`}>
                {preparing ? <span className="wave-ed-spin" aria-hidden="true" /> : <ThroughIcon />}</button>}
            </div>
            <div className="wave-ed-group" role="group" aria-label={t`Blocks`}>
              {tool(<AddAudioIcon />, t`Add Audio`, () => void addFiles(), !ctx || adding, kl("suiteAdd"),
                t`Adds audio files as new blocks on the selected layer, one after the other from the cursor. Dropping files on the editor does the same, and ${keyLabel("suitePaste")} pastes slots copied in the list or files copied in Explorer`)}
              {tool(<SplitIcon />, t`Split at the cursor`, () => splitAt(cursor), !shown.length, kl("suiteSplit"), t`Splits the selected blocks there, or the block under the cursor`)}
              {tool(<NormalizeIcon />, t`Normalize`, normalize, !sel.length, kl("suiteNormalize"), t`Brings each selected block up or down until the loudest moment of it reaches −1 dB`)}
              {tool(<DuplicateIcon />, t`Duplicate`, duplicate, !sel.length, kl("suiteDuplicate"), t`The copies go right after the selected blocks`)}
              {merging ? <button className="icon-btn" disabled aria-label={t`Merging…`} data-tip={t`Merging…`}><span className="wave-ed-spin" aria-hidden="true" /></button>
                : tool(<MergeBlocksIcon />, t`Merge`, () => void merge(), !mergeable, kl("suiteMerge"),
                  mergeable || sel.length < 2 ? t`Makes one block of the selected blocks, as they play: gaps between them become silence, and blocks that overlap play together` : t`The selected blocks are in different slots`)}
              {tool(<RemoveIcon />, t`Remove`, remove, !removable, kl("suiteRemove"), t`Removes the selected blocks`)}
            </div>
            <div className="wave-ed-group" role="group" aria-label={t`Place`}>
              {tool(<SnapLeftIcon />, t`Snap Left`, () => snapSide(-1), !sel.length, kl("suiteSnapLeft"), t`Moves the selected blocks back until they touch the block before them on their layer, or the start`)}
              {tool(<SnapRightIcon />, t`Snap Right`, () => snapSide(1), !sel.length, kl("suiteSnapRight"), t`Moves the selected blocks on until they touch the block after them on their layer`)}
              {tool(<ToStartIcon />, t`Place at the Start`, () => placeAt("start"), !sel.length, kl("suiteToStart"), t`Moves the selected blocks to the start`)}
              {tool(<ToEndIcon />, t`Place at the End`, () => placeAt("end"), !sel.length, kl("suiteToEnd"), refMs ? t`Moves the selected blocks to end where the original ends` : t`Moves the selected blocks to after the other blocks`)}
              {tool(<CloseGapsIcon />, t`Close Gaps`, closeGaps, !gapsIn, kl("suiteCloseGaps"), t`Moves the blocks of the layer back against each other, from the first. With blocks selected, on their layers`)}
            </div>
            <div className="wave-ed-group" role="group" aria-label={t`Modes`}>
              <button className="icon-btn wave-ed-toggle" aria-pressed={magnet} onClick={() => setMagnet(!magnet)} aria-label={t`Magnet`} data-tip={magnet ? t`Magnet: on` : t`Magnet: off`}
                data-tip-more={t`The cursor, block edges, blocks and cue points snap to edges: of blocks, the start and where the original ends`} data-tip-key={kl("suiteMagnet")}><MagnetIcon /></button>
              <button className="icon-btn wave-ed-toggle wave-ed-curves" aria-pressed={curving} onClick={() => setCurving(!curving)} aria-label={t`Volume Curves`}
                data-tip={curving ? t`Volume Curves: on` : t`Volume Curves: off`} data-tip-key={kl("suiteCurves")}
                data-tip-more={t`Shows a line over each block, from full at the top to silence at the foot. Click the line to add a point, drag a point to shape the volume, double-click a point to remove it`}><CurveIcon /></button>
            </div>
            <div className="wave-ed-group wave-ed-hist" role="group" aria-label={t`History`}>
              {tool(<UndoIcon />, t`Undo`, undo, hist.at === 0, kl("suiteUndo"))}
              {tool(<RedoIcon />, t`Redo`, redo, hist.at >= hist.list.length - 1, kl("suiteRedo"))}
              {tool(<ResetIcon />, t`Reset`, reset, !ready, kl("suiteReset"), t`Back to the whole file, as it is, on one layer`)}
            </div>
          </div>
          <span className="spacer" />
          <span className="wave-ed-timing">
          {cues && <span className="wave-ed-cues" data-tip={t`The segment's cue points`} data-tip-more={t`Drag their flags on the ruler. Let go near the automatic spot to go back to it`}>
            {ENTRY} <b>{fmtExact(entryAt)}</b> · {EXIT} <b>{fmtExact(exitAt)}</b>{cuesChanged && <span className="wave-ed-dot" aria-label={t`Changed`} />}</span>}
          <span className="wave-ed-time" data-tip={t`Where the cursor is`} data-tip-more={t`Drag the cursor, or along the ruler, to move it`}>{fmtExact(cursor)}</span>
          </span>
        </div>
        <div className="wave-ed-body zoom-grid">
          <div className="wave-ed-lanes">
            <div className="wave-ed-labels">
              <span style={{ height: RULER }} />
              {lanes.map((l) => {
                if (l.kind === "ref") {
                  const i = l.track, r = refOf(i), x = tracks[i];
                  return (
                    <label key={`ref:${i}`} className={`game${many ? " many" : ""}${playing === "edit" && sounding.has(`ref:${i}`) ? " playing" : ""}`} style={{ height: l.h }} data-tip={checkTip}>
                      <span className="wave-ed-grip" aria-hidden="true" />
                      <input type="checkbox" className="wave-ed-check" checked={!!refPlays[i]} disabled={!r} onChange={(e) => setRefPlays((p) => ({ ...p, [i]: e.target.checked }))}
                        aria-label={many ? t`Play the original of ${x.name}` : t`Play the original`} />
                      {many ? <span className="wave-ed-track"><b data-tip={x.full ?? x.name}>{x.name}</b><small>{t`Original`}</small></span> : t`Original`}
                      {many && !hasOwn(i) && r && !blocks.some((b) => b.track === i) && (
                        <button className="icon-btn small" onClick={(e) => { e.preventDefault(); fromOriginal(i); }} aria-label={t`Start from the original`}
                          data-tip={t`Start from the original`} data-tip-more={t`The original becomes the new audio of this layer, to edit`}><PlusIcon /></button>
                      )}
                    </label>
                  );
                }
                const { track: i, layer } = l, n = layersOf(i);
                // while a layer is dragged it follows the pointer, and the one whose place it takes shows a line there
                const moving = reorder?.track === i && reorder.from === layer;
                const mark = reorder && reorder.track === i && !moving && layer === reorder.to ? (reorder.to > reorder.from ? " drop-after" : " drop-before") : "";
                return (
                  <div key={lk(i, layer)} className={`wave-ed-layer${i === on.track && layer === on.layer ? " on" : ""}${moving ? " moving" : ""}${playing === "edit" && sounding.has(lk(i, layer)) ? " playing" : ""}${mark}`}
                    style={{ height: l.h, ...(moving ? { transform: `translateY(${reorder!.dy}px)` } : {}) }} onPointerDown={() => setActive({ track: i, layer })}>
                    <span className="wave-ed-grip" onPointerDown={(e) => startReorder(e, i, layer)} aria-hidden={n < 2}
                      data-tip={n > 1 ? t`Drag to reorder the layers` : undefined}><GripIcon /></span>
                    <input type="checkbox" className="wave-ed-check" checked={playsOf(i, layer)} aria-label={t`Play Layer ${layer + 1}`} data-tip={checkTip} data-tip-more={checkMore}
                      onChange={(e) => setPlays((p) => ({ ...p, [lk(i, layer)]: e.target.checked }))} />
                    {tracks[i].source ? <input className="wave-ed-layer-name" value={names[lk(i, layer)] ?? ""} placeholder={t`Layer ${layer + 1}`} maxLength={40}
                      spellCheck={false} aria-label={t`Name of Layer ${layer + 1}`} data-tip={names[lk(i, layer)] || undefined} data-tip-clip onChange={(e) => { const v = e.target.value; setNames((p) => ({ ...p, [lk(i, layer)]: v })); }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur(); }} />
                      : <LayerName n={layer + 1} />}
                    <button className="icon-btn small" onClick={() => void deleteLayer(i, layer)} disabled={n < 2} aria-label={t`Delete Layer ${layer + 1}`}
                      data-tip={t`Delete the layer`} data-tip-more={t`With the blocks on it`}><TrashIcon /></button>
                    <span className="wave-ed-layer-size" role="separator" aria-orientation="horizontal" aria-label={t`Resize Layer ${layer + 1}`}
                      onPointerDown={(e) => startResize(e, i, layer)} onDoubleClick={() => setHeights((h) => { const x = { ...h }; delete x[lk(i, layer)]; return x; })}
                      data-tip={t`Drag to resize the layer`} data-tip-more={t`A double click sets it back`} />
                  </div>
                );
              })}
            </div>
            <div className="wave-ed-canvas" ref={wrap} data-span={Math.round(zoom.span)} data-drop={JSON.stringify({ kind: "wave-editor" })} style={{ height, cursor: drag.current ? (drag.current.kind === "move" || drag.current.kind === "point" ? "grabbing" : cursorCls[drag.current.kind]) : hover ? cursorCls[hover] : "default" }}
              onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onDoubleClick={onDouble} onPointerLeave={() => setHover(null)}>
              <canvas ref={canvas} style={{ width, height }} />
              {!ready ? <p className="wave-ed-state">{error ? t`The audio can't be read: ${error}` : t`Reading the audio…`}</p>
                : empty && (
                  <div className="wave-ed-state wave-ed-empty" style={{ top: lanes.find((l) => l.kind === "layer")?.top ?? RULER }}>
                    <p><Trans>Add audio files to build the new audio from, or start from the original.</Trans></p>
                    <div className="row-btns">
                      <button className="btn primary" onClick={() => void addFiles()}><PlusIcon /><Trans>Add Audio</Trans></button>
                      {refs[0] && <button className="btn" onClick={() => fromOriginal(0)}><Trans>Start from the Original</Trans></button>}
                    </div>
                  </div>
                )}
            </div>
          </div>
          {/* under the waveforms, at the left: New Layer, then the scroll bar and the time zoom */}
          <WaveZoom zoom={zoom} fits={<>
            {tool(<FitSelIcon />, t`Zoom to the Selection`, fitSelected, !sel.length || !ready, kl("suiteFitSel"), t`The selected blocks across the whole width`)}
            {tool(<FitLayerIcon />, t`Zoom to the Layer`, fitLayers, !ready || layerEnd() <= 0, kl("suiteFitLayer"), t`From the start to the end of the selected blocks' layers, or of the layer worked on`)}
          </>} foot={<>
            <button className="btn quiet wave-ed-new-layer" onClick={addLayer} disabled={layersOf(on.track) >= MAX_LAYERS} data-tip-key={kl("suiteNewLayer")}
              data-tip={many ? t`A layer under ${tracks[on.track].name}, to keep blocks apart on` : t`A layer to keep blocks apart on`}
              data-tip-more={t`Every layer plays, all together. Drag a block up or down to move it to another layer`}><PlusIcon /><Trans>New Layer</Trans></button>
            {zoom.x > 1 && <WaveScroll zoom={zoom} />}
          </>} />
        </div>
        </div>
        <aside className="wave-ed-side" aria-label={t`Selected blocks`}>
          {/* as tall as the most fields there are, so the dialog keeps its height as the selection changes */}
          <div className="wave-ed-sizer" aria-hidden="true" inert>
            <BlockFields b={SIZER} base={SIZER} n={1} fileMs={1000} file="-" onSet={() => {}} onLive={() => {}} link={link} onLink={() => {}} />
          </div>
          {one != null ? <BlockFields b={shown[one] ?? blocks[one]} base={blocks[one]} n={one + 1} fileMs={msOfFile(blocks[one])} file={(many ? `${tracks[blocks[one].track].name} · ` : "") + (blocks[one].audio ? nameOf(blocks[one].audio!) : ownName(blocks[one].track))}
            onSet={(x) => set(one, x)} onLive={(x) => setLive(x ? blocks.map((b, j) => (j === one ? fitted({ ...b, ...x }) : b)) : null)} link={link} onLink={setLink} />
            : selList.length > 1 ? <ManyFields list={chosen().map((i) => shown[i] ?? blocks[i])} onSet={setMany} link={link} onLink={setLink}
              onLive={(x) => setLive(x ? blocks.map((b, j) => (picked.has(j) ? fitted({ ...b, ...x }) : b)) : null)} />
            : <p className="wave-ed-hint"><Trans>Click a block to set it up. Drag the body to move it, also to another layer, an edge to trim it, and the squares on the top edge to fade it. Drag from an empty spot to select several blocks, and hold Shift or Ctrl to add to them. Where blocks overlap, click again for the one under it. A double click plays from there. With Volume Curves on ({curvesKey}), click the line over a block to shape the volume.</Trans></p>}
        </aside>
        </div>
  );
  const exportBtn = (
    <button className="btn" onClick={() => { stop(); setExporting(true); }} disabled={!ready || !exportable} data-tip-key={kl("suiteExport")}
      data-tip={exportable ? t`Export the lanes ticked as one audio file` : t`Tick a lane with audio to export it`}><ExportIcon /><Trans>Export</Trans></button>
  );
  const sum = (
    <span className="wave-ed-sum">
      <Trans>Result <b>{fmtTime(resultMs)}</b></Trans>
      {refMs > 0 && <span className={Math.abs(diff) < 1 ? "" : diff > 0 ? "longer" : "shorter"}>
        {" · "}<Trans>Original {fmtTime(refMs)}</Trans>{Math.abs(diff) >= 1 && ` (${diff > 0 ? "+" : "−"}${fmtTime(Math.abs(diff))})`}</span>}
      {" · "}{shown.length === 1 ? t`1 block` : t`${shown.length} blocks`}
    </span>
  );
  const exportPanel = exporting && <ExportPanel what={[
    ...tracks.flatMap((x, i) => (refPlays[i] && refOf(i) ? [many ? t`${x.name}, original` : t`Original`] : [])),
    ...tracks.flatMap((x, i) => range(0, layersOf(i)).filter((l) => playsOf(i, l) && blocks.some((b) => b.track === i && layerOf(b) === l))
      .map((l) => { const nm = names[lk(i, l)]?.trim(); return many ? (nm ? `${x.name}, ${nm}` : t`${x.name}, layer ${l + 1}`) : nm || t`Layer ${l + 1}`; }))]}
    onExport={doExport} onClose={() => setExporting(false)} />;
  if (embed) return (
    <div className="wave-ed wave-ed-embed" ref={embedBox} tabIndex={-1} onKeyDown={onKey} onBlur={keepFocus} hidden={embed.shown === false}
      onPointerDown={(e) => { if (!(e.target as Element).closest("input, button, select, textarea, [tabindex]:not([tabindex='-1'])")) embedBox.current?.focus({ preventScroll: true }); }}>
      {main}
      <div className="wave-ed-embed-foot">{exportBtn}<span className="spacer" />{sum}</div>
      {exportPanel && createPortal(exportPanel, document.body)}
    </div>
  );
  return createPortal(
    <div className="modal-back" onPointerDown={(e) => { if (e.target === e.currentTarget) void close(); }}>
      <div className="modal wave-ed" role="dialog" aria-modal="true" aria-label={t`Waveform Suite`} ref={box} tabIndex={-1} onKeyDown={onKey} onBlur={keepFocus}>
        <header className="wave-ed-head">
          <h2><Trans>Waveform Suite</Trans></h2>
          <span className="wave-ed-what" data-tip={what} data-tip-clip>{what}</span>
          <span className={`wave-ed-src ${single != null && editOriginal(0) ? "game" : "mine"}`}
            data-tip={single != null && editOriginal(0) ? t`Editing the original: the result becomes the new audio` : single != null ? assign(0)?.audio ?? tracks[0].file : undefined}>{head_}</span>
          <span className="spacer" />
          <Help tip={t`Trim, split, move and fade audio`} page="timing-and-loops#the-waveform-suite" />
          <button className="icon-btn" onClick={() => void close()} aria-label={t`Close`} data-tip={t`Close`}><CloseIcon /></button>
        </header>
        {main}
        <footer className="modal-foot">
          <button className="btn primary" onClick={() => void apply()} disabled={!ready || saving || !blocks.length || !(applies.some(Boolean) || cuesChanged)}
            data-tip={tracks.some((_, i) => isFile(i)) ? t`Save the result as a new file and use it` : single != null && editOriginal(0) ? t`Use the edited original as the new audio of the slot` : t`Keep these changes in the project`} data-tip-key="Ctrl+Enter">
            {applyText}</button>
          {exportBtn}
          <button className="btn quiet" onClick={() => void close()}><Trans>Cancel</Trans></button>
          <span className="spacer" />
          {sum}
        </footer>
      </div>
      {exportPanel}
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
    selected blocks differ, and the field shows empty until a value is typed. What is typed plays at once (`onLive`)
    and is set on Enter or on leaving the field (Esc takes it back); ↑ and ↓ step it. Dragging the name left or right
    changes the value by `rate` a pixel, ten times as much with Shift and a tenth with Ctrl. */
function Field({ name, tip, value, lo, hi, unit = "ms", step = 1, rate = 2, onSet, onLive }: {
  name: string; tip: string; value: number | null; lo: number; hi: number; unit?: string; step?: number; rate?: number;
  onSet: (v: number) => void; onLive?: (v: number | null) => void;
}) {
  const dec = step < 1 ? 2 : 1, fix = (v: number) => Math.round(v * 10 ** dec) / 10 ** dec;
  const text = (v: number | null) => (v == null ? "" : String(fix(v)).replace("-", "−"));
  const [val, setVal] = useState(() => text(value));
  const editing = useRef(false); // typed in or dragged: the field shows that until it is set or taken back
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!editing.current) setVal(text(value)); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const parse = (raw: string) => {
    const s = raw.trim().replace(/[−–]/g, "-").replace(",", "."), v = Number(s);
    return !s || !Number.isFinite(v) ? null : clamp(v, lo, hi);
  };
  const finish = (v: number | null) => {
    editing.current = false;
    if (v == null || (value != null && fix(v) === fix(value))) { onLive?.(null); setVal(text(value)); return; }
    setVal(text(v));
    onSet(fix(v));
  };
  const back = () => { editing.current = false; onLive?.(null); setVal(text(value)); };
  const scrub = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    let v = parse(val) ?? clamp(value ?? 0, lo, hi), x = e.clientX, moved = false;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - x;
      if (!dx) return;
      x = ev.clientX; moved = true; editing.current = true;
      v = clamp(v + dx * rate * (ev.shiftKey ? 10 : ev.ctrlKey || ev.metaKey ? 0.1 : 1), lo, hi);
      setVal(text(v));
      onLive?.(fix(v));
    };
    const up = () => {
      el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up);
      if (moved) finish(v); else input.current?.focus();
    };
    el.addEventListener("pointermove", move); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
  };
  return (
    <div className="wave-ed-field" data-tip={tip} data-tip-more={t`Drag the name to change it: Shift for bigger steps, Ctrl for finer ones`} data-tip-side="left">
      <span className="wave-ed-label wave-ed-scrub" onPointerDown={scrub}>{name}</span>
      <input ref={input} type="text" inputMode="decimal" value={val} placeholder="—" aria-label={`${name} (${unit})`} spellCheck={false} autoComplete="off" data-own-esc
        onChange={(e) => { editing.current = true; setVal(e.target.value); const v = parse(e.target.value); if (v != null) onLive?.(v); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.closest<HTMLElement>(".wave-ed")?.focus({ preventScroll: true }); // set, and the keys go to the Suite
          else if (e.key === "Escape") { // back to what it was, and the keys go to the Suite again
            e.preventDefault(); e.stopPropagation(); back();
            e.currentTarget.closest<HTMLElement>(".wave-ed")?.focus({ preventScroll: true });
          }
          else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const v = clamp((parse(val) ?? value ?? 0) + (e.key === "ArrowUp" ? 1 : -1) * step * (e.shiftKey ? 10 : e.ctrlKey ? 0.1 : 1), lo, hi);
            finish(v);
          }
        }}
        onBlur={() => { if (editing.current) finish(parse(val)); }} />
      <span className="unit">{unit}</span>
    </div>
  );
}

/** Tempo (in %) and Pitch (in semitones), and the link between them: linked, one moves the other as a tape played
    faster would; apart, the tempo changes and the pitch stays, or the other way round. `b` null: several blocks
    that differ, shown empty. */
function SpeedFields({ tempo, pitch, link, onLink, onSet, onLive, many }: {
  tempo: number | null; pitch: number | null; link: boolean; onLink: (v: boolean) => void; onSet: (b: Partial<Block>) => void;
  onLive: (b: Partial<Block> | null) => void; many?: boolean;
}) {
  const st = (v: number) => Math.round(12 * Math.log2(v) * 100) / 100;
  const byTempo = (v: number): Partial<Block> => (link ? { tempo: v / 100, pitch: st(v / 100) } : { tempo: v / 100 });
  const byPitch = (v: number): Partial<Block> => (link ? { pitch: v, tempo: clamp(2 ** (v / 12), TEMPO[0], TEMPO[1]) } : { pitch: v });
  return (
    <div className="wave-ed-set wave-ed-speed">
      <Field name={t`Tempo`} tip={many ? t`How fast each block plays` : t`How fast the block plays: 200% in half the time`} value={tempo == null ? null : tempo * 100} lo={TEMPO[0] * 100} hi={TEMPO[1] * 100} unit="%" step={1} rate={0.5}
        onSet={(v) => onSet(byTempo(v))} onLive={(v) => onLive(v == null ? null : byTempo(v))} />
      <Field name={t`Pitch`} tip={many ? t`How much higher or lower each block plays` : t`How much higher or lower the block plays, in semitones`} value={pitch} lo={-PITCH} hi={PITCH} unit={t({ message: "st", comment: "Unit: semitones" })} step={0.5} rate={0.05}
        onSet={(v) => onSet(byPitch(v))} onLive={(v) => onLive(v == null ? null : byPitch(v))} />
      <button className={`icon-btn small wave-ed-link${link ? " on" : ""}`} aria-pressed={link} onClick={() => onLink(!link)} aria-label={t`Link Tempo and Pitch`}
        data-tip={link ? t`Tempo and Pitch: linked` : t`Tempo and Pitch: apart`}
        data-tip-more={link ? t`Changing one changes the other, as a tape played faster` : t`Each changes alone: the tempo keeps the pitch, the pitch keeps the tempo`}><LinkIcon /></button>
    </div>
  );
}

/** The selected block in numbers, in ms (Gain in dB): what the canvas does by dragging, to type exactly. A column of
    label, value and unit, in groups: where it plays, the stretch of the file, the fades, the level, the speed. */
function BlockFields({ b, base, n, fileMs, file, onSet, onLive, link, onLink }: {
  b: Block; base: Block; n: number; fileMs: number; file: string; onSet: (b: Partial<Block>) => void; onLive: (b: Partial<Block> | null) => void;
  link: boolean; onLink: (v: boolean) => void;
}) {
  // b shows the block as it is now (a drag too); the limits come from it as set (base), so a field being dragged keeps them
  const len = lengthOf(base);
  const f = (k: keyof Block) => ({ onSet: (v: number) => onSet({ [k]: v }), onLive: (v: number | null) => onLive(v == null ? null : { [k]: v }) });
  return (
    <div className="wave-ed-block">
      <div className="wave-ed-block-head"><b>{t`Block ${n}`}</b><span className="wave-ed-file" data-tip={file} data-tip-clip>{file}</span></div>
      <div className="wave-ed-set">
        <Field name={t`Position`} tip={t`When the block plays, from the start of the slot`} value={b.at_ms} lo={0} hi={3_600_000} {...f("at_ms")} />
        <div className="wave-ed-field wave-ed-ro"><span className="wave-ed-label">{t`Length`}</span><b>{fmtDecimal(lengthOf(b), 1)}</b><span className="unit">ms</span></div>
      </div>
      <div className="wave-ed-set">
        <Field name={t({ message: "Start", context: "Trim handle" })} tip={t`Where the block starts in the file`} value={b.start_ms} lo={0} hi={base.end_ms - MIN_BLOCK} {...f("start_ms")} />
        <Field name={t({ message: "End", context: "Trim handle" })} tip={t`Where the block ends in the file`} value={b.end_ms} lo={base.start_ms + MIN_BLOCK} hi={fileMs} {...f("end_ms")} />
      </div>
      <div className="wave-ed-set">
        <Field name={t`Fade In`} tip={t`How long the block takes to rise from silence`} value={b.fade_in_ms} lo={0} hi={len - base.fade_out_ms} {...f("fade_in_ms")} />
        <Field name={t`Fade Out`} tip={t`How long the block takes to fall to silence before it ends`} value={b.fade_out_ms} lo={0} hi={len - base.fade_in_ms} {...f("fade_out_ms")} />
      </div>
      <div className="wave-ed-set">
        <Field name={t`Gain`} tip={t`How much louder or quieter the block plays`} value={b.gain_db} lo={-60} hi={24} unit="dB" step={0.5} rate={0.1} {...f("gain_db")} />
        <CurveRow points={b.curve?.length ?? 0} onFlatten={() => onSet({ curve: [] })} />
      </div>
      <SpeedFields tempo={speedOf(b)} pitch={b.pitch ?? 0} link={link} onLink={onLink} onSet={onSet} onLive={onLive} />
    </div>
  );
}

/** How many points the volume curve has, and Flatten, which takes them all away (full level all along). */
function CurveRow({ points, onFlatten, many }: { points: number; onFlatten: () => void; many?: boolean }) {
  return (
    <>
      <div className="wave-ed-field wave-ed-ro" data-tip={keyLabel("suiteCurves") ? t`Shape it with the Volume Curves tool (${keyLabel("suiteCurves")})` : t`Shape it with the Volume Curves tool`} data-tip-side="left">
        <span className="wave-ed-label">{t`Volume Curve`}</span><b>{points ? points : "—"}</b><span className="unit">{points ? t`pts` : ""}</span></div>
      {points > 0 && <button className="btn quiet wave-ed-flatten" onClick={onFlatten}
        data-tip={many ? t`Takes the points off every selected block` : t`Takes the points off: the block plays at full level all along`}>{many ? t`Flatten Curves` : t`Flatten Curve`}</button>}
    </>
  );
}

/** Several blocks selected: the values they can share, set on all of them at once (a fade longer than a block stops
    at its length). A value they differ in shows empty. */
function ManyFields({ list, onSet, onLive, link, onLink }: {
  list: Block[]; onSet: (b: Partial<Block>) => void; onLive: (b: Partial<Block> | null) => void; link: boolean; onLink: (v: boolean) => void;
}) {
  const f = (k: keyof Block) => ({ onSet: (v: number) => onSet({ [k]: v }), onLive: (v: number | null) => onLive(v == null ? null : { [k]: v }) });
  const same = (k: "fade_in_ms" | "fade_out_ms" | "gain_db") => (list.every((b) => round1(b[k]) === round1(list[0][k])) ? list[0][k] : null);
  const tempo = list.every((b) => speedOf(b) === speedOf(list[0])) ? speedOf(list[0]) : null;
  const pitch = list.every((b) => (b.pitch ?? 0) === (list[0].pitch ?? 0)) ? list[0].pitch ?? 0 : null;
  const longest = Math.max(...list.map(lengthOf));
  const n = list.length;
  return (
    <div className="wave-ed-block">
      <div className="wave-ed-block-head"><b>{t`${n} blocks`}</b><span className="wave-ed-file">{t`Values set here apply to each of them`}</span></div>
      <div className="wave-ed-set">
        <Field name={t`Fade In`} tip={t`How long each block takes to rise from silence`} value={same("fade_in_ms")} lo={0} hi={longest} {...f("fade_in_ms")} />
        <Field name={t`Fade Out`} tip={t`How long each block takes to fall to silence before it ends`} value={same("fade_out_ms")} lo={0} hi={longest} {...f("fade_out_ms")} />
      </div>
      <div className="wave-ed-set">
        <Field name={t`Gain`} tip={t`How much louder or quieter each block plays`} value={same("gain_db")} lo={-60} hi={24} unit="dB" step={0.5} rate={0.1} {...f("gain_db")} />
        {list.some((b) => b.curve?.length) && <CurveRow many points={list.reduce((s, b) => s + (b.curve?.length ?? 0), 0)} onFlatten={() => onSet({ curve: [] })} />}
      </div>
      <SpeedFields many tempo={tempo} pitch={pitch} link={link} onLink={onLink} onSet={onSet} onLive={onLive} />
    </div>
  );
}
