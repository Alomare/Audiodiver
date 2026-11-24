import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { audioUrl, fileUrl, fmtDecimal, fmtTime, type Block } from "./api";
import { confirm } from "./Confirm";
import { useDialog } from "./dialog";
import { CloseIcon, DuplicateIcon, LoopIcon, MagnetIcon, NormalizeIcon, PauseIcon, PlayIcon, PlusIcon, RedoIcon, RemoveIcon, ResetIcon,
  SplitIcon, StopIcon, UndoIcon } from "./Icons";
import { fullPath, pickAudio } from "./platform";
import { player, usePlayer } from "./player";
import { useEditor } from "./store";
import { useWaveZoom, WaveScroll, WaveZoom, wheelZoom, type WaveZoomState } from "./Waveform";
import { Help } from "./Wiki";

/** The Waveform Editor: the audio of one slot as blocks on a time line, so that basic editing needs no other program.
    Each block is a stretch of one file placed at a time of its own, with a fade in, a fade out and a gain. Blocks
    are trimmed at their edges, moved by their body, split at the cursor, duplicated and removed, and their fades are
    dragged from the grips at their top corners. Blocks that overlap play together and are drawn see-through, each in
    a colour of its own, so both show; there are no layers. The magnet snaps the cursor, edges and blocks to each
    other, to the start, and to where the original ends.

    It edits the new audio of a slot, or the original (the result then becomes the new audio, as a copy does). The
    original's waveform runs along the top for reference, and plays on its own for comparison. Nothing changes in
    the project until Apply; the core then makes the audio a build uses from the same blocks (core audio.edited),
    so what plays here is what the game plays. Playback here is Web Audio, at once, from the decoded files. */

const MIN_BLOCK = 10;   // ms: the shortest block (the core's MIN_TRIM_MS)
const MIN_SPAN = 20;    // ms: the closest the view zooms in
const SNAP_PX = 8;      // the magnet's reach
const EDGE_PX = 6;      // how near an edge a press trims instead of moving
const GRIP_PX = 7;      // a fade grip's half size
const NUDGE = 10;       // ms an arrow key moves a block (Shift: ×10)
const LANES = { ruler: 24, original: 64, edit: 150 };
const BUCKET = 64;      // frames per level in the summary of a file

type Drag = {
  kind: "move" | "trimL" | "trimR" | "fadeIn" | "fadeOut" | "cursor";
  i: number; x0: number; from: Block; moved: boolean;
};
type Decoded = { buf: AudioBuffer; levels: Float32Array };
type Hit = { kind: Drag["kind"]; i: number } | null;

const lengthOf = (b: Block) => b.end_ms - b.start_ms;
const lastIndex = <T,>(xs: T[], f: (x: T) => boolean) => { for (let i = xs.length - 1; i >= 0; i--) if (f(xs[i])) return i; return -1; };
const endOf = (b: Block) => b.at_ms + lengthOf(b);
const round1 = (v: number) => Math.round(v * 10) / 10;
const clean = (b: Block): Block => ({ start_ms: round1(b.start_ms), end_ms: round1(b.end_ms), at_ms: round1(Math.max(0, b.at_ms)),
  fade_in_ms: round1(Math.max(0, b.fade_in_ms)), fade_out_ms: round1(Math.max(0, b.fade_out_ms)), gain_db: round1(b.gain_db),
  ...(b.audio ? { audio: b.audio } : {}) });
const nameOf = (path: string) => path.split(/[\\/]/).pop() ?? path;
const FULL = /^([a-z]:[\\/]|[\\/])/i; // a full path (a file just added), not one the project stores

/** Audio dropped on the open editor: App.tsx hands it here (one editor is open at a time). */
let dropInto: ((paths: string[]) => void) | null = null;
export function waveDrop(paths: string[]) { dropInto?.(paths); }
function onWaveDrop(f: (paths: string[]) => void) { dropInto = f; return () => { if (dropInto === f) dropInto = null; }; }

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

/** Blocks that overlap another: each gets a colour of its own (by its place among them), the rest the primary colour. */
function colours(blocks: Block[]): (number | null)[] {
  const out: (number | null)[] = blocks.map(() => null);
  let n = 0;
  blocks.forEach((b, i) => {
    if (blocks.some((o, j) => j !== i && o.at_ms < endOf(b) && b.at_ms < endOf(o))) out[i] = n++;
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
  const { project, actions } = useEditor();
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
  const [sel, setSel] = useState<number | null>(0);
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
    setSel(first.length ? 0 : null);
  }, [ready, mode]); // eslint-disable-line react-hooks/exhaustive-deps
  /** Starts again from the original (from the empty start of a slot without new audio). */
  const fromOriginal = () => { asked.current.delete(""); setFiles({}); start.current = null; setHist({ list: [], at: 0 }); setMode("original"); };
  const changed = !!start.current && JSON.stringify(blocks) !== JSON.stringify(start.current);
  const undo = () => { setLive(null); setHist((h) => ({ ...h, at: Math.max(0, h.at - 1) })); };
  const redo = () => { setLive(null); setHist((h) => ({ ...h, at: Math.min(h.list.length - 1, h.at + 1) })); };

  const resultMs = Math.max(0, ...shown.map(endOf));
  // the time line: everything there is, and room after it to move a block into; it only grows while the editor is open
  const [total, setTotal] = useState(1000);
  useEffect(() => {
    const need = Math.max(fileMs, refMs, ...blocks.map(endOf)) * 1.12;
    if (need > total) setTotal(Math.ceil(need / 100) * 100);
  }, [fileMs, refMs, blocks, total]);
  const zoom = useWaveZoom(total, MIN_SPAN);
  const [cursor, setCursor] = useState(0);
  const [magnet, setMagnet] = useState(() => { try { return localStorage.getItem("audiodiver.waveMagnet") !== "0"; } catch { return true; } });
  useEffect(() => { try { localStorage.setItem("audiodiver.waveMagnet", magnet ? "1" : "0"); } catch { /* storage off */ } }, [magnet]);
  const [loop, setLoop] = useState(false);

  // --- playback: each block a buffer source with its gain and fades, from the cursor
  const play = useRef<{ nodes: AudioScheduledSourceNode[]; t0: number; from: number; to: number; what: "edit" | "original"; timer: number } | null>(null);
  const [playing, setPlaying] = useState<"edit" | "original" | null>(null);
  const [head, setHead] = useState<number | null>(null);
  const master = useMemo(() => { if (!ctx) return null; const g = ctx.createGain(); g.connect(ctx.destination); return g; }, [ctx]);
  useEffect(() => { if (master) master.gain.value = vol; }, [master, vol]);
  const stop = useCallback(() => {
    const p = play.current;
    play.current = null;
    if (p) { clearTimeout(p.timer); for (const n of p.nodes) { try { n.stop(); } catch { /* not started */ } n.disconnect(); } }
    setPlaying(null); setHead(null);
  }, []);
  useEffect(() => stop, [stop]);
  const startPlay = useCallback((what: "edit" | "original", fromMs: number) => {
    stop();
    const f = what === "edit" ? null : reference;
    if ((what === "original" && !f) || !ctx || !master) return;
    player.stop(); // the app's player and the editor never play over each other
    void ctx.resume();
    const list: Block[] = what === "edit" ? (live ?? blocks) : [{ start_ms: 0, end_ms: refMs, at_ms: 0, fade_in_ms: 0, fade_out_ms: 0, gain_db: 0 }];
    // a loop plays the selected block over and over, else the whole result
    const one = loop && what === "edit" && sel != null ? list[sel] : null;
    const from = one ? one.at_ms : Math.max(0, fromMs), to = one ? endOf(one) : Math.max(...list.map(endOf));
    if (from >= to) return;
    const t0 = ctx.currentTime + 0.04, nodes: AudioScheduledSourceNode[] = [];
    for (const b of list) {
      const len = lengthOf(b), into = Math.max(0, from - b.at_ms);
      if (endOf(b) <= from || b.at_ms >= to || into >= len) continue;
      const bf = what === "edit" ? fileOf(b) : f;
      if (!bf) continue;
      const src = ctx.createBufferSource(), g = ctx.createGain();
      src.buffer = bf.buf;
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
      if (loop && what === "edit") startPlay(what, one ? one.at_ms : 0);
      else stop();
    }, (to - from) / 1000 * 1000 + 60);
    play.current = { nodes, t0, from, to, what, timer };
    setPlaying(what);
  }, [ctx, master, files, reference, blocks, live, loop, sel, refMs, stop]); // eslint-disable-line react-hooks/exhaustive-deps
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
  const toggle = (what: "edit" | "original" = "edit") => (playing === what ? stop() : startPlay(what, cursor));

  // --- editing
  const set = (i: number, b: Partial<Block>) => commit(blocks.map((x, j) => (j === i ? { ...x, ...b } : x)));
  const splitAt = (ms: number) => {
    const i = sel != null && blocks[sel].at_ms + MIN_BLOCK < ms && ms < endOf(blocks[sel]) - MIN_BLOCK ? sel
      : lastIndex(blocks, (b) => b.at_ms + MIN_BLOCK < ms && ms < endOf(b) - MIN_BLOCK);
    if (i < 0) return;
    const b = blocks[i], cut = b.start_ms + (ms - b.at_ms);
    const left = { ...b, end_ms: cut, fade_out_ms: 0, fade_in_ms: Math.min(b.fade_in_ms, cut - b.start_ms) };
    const right = { ...b, start_ms: cut, at_ms: ms, fade_in_ms: 0, fade_out_ms: Math.min(b.fade_out_ms, b.end_ms - cut) };
    commit([...blocks.slice(0, i), left, right, ...blocks.slice(i + 1)]);
    setSel(i + 1);
  };
  const remove = () => {
    if (sel == null || (hasOwn && blocks.length < 2)) return;
    commit(blocks.filter((_, j) => j !== sel));
    setSel(null);
  };
  const duplicate = () => {
    if (sel == null) return;
    const b = blocks[sel];
    commit([...blocks, { ...b, at_ms: endOf(b) }]);
    setSel(blocks.length);
  };
  const normalize = () => {
    const f = sel != null ? fileOf(blocks[sel]) : null;
    if (sel == null || !f) return;
    const b = blocks[sel], peak = levelAt(f, b.start_ms, b.end_ms);
    if (peak > 0) set(sel, { gain_db: Math.max(-60, Math.min(24, 20 * Math.log10(10 ** (-1 / 20) / peak))) });
  };
  const reset = () => {
    commit(hasOwn ? [{ start_ms: 0, end_ms: fileMs, at_ms: 0, fade_in_ms: 0, fade_out_ms: 0, gain_db: 0 }] : []);
    setSel(hasOwn ? 0 : null);
  };
  /** Audio files as new blocks, one after the other from the cursor (each whole, at its own length). */
  const [adding, setAdding] = useState(false);
  const addFiles = useCallback(async (paths?: string[]) => {
    if (!ctx) return;
    paths ??= (await pickAudio(true)) ?? [];
    if (!paths.length) return;
    setAdding(true);
    const got: Block[] = [];
    let at = cursor;
    for (const path of paths) {
      try {
        const f = files[path] ?? await decode(urlOf(path), ctx);
        asked.current.add(path);
        setFiles((x) => ({ ...x, [path]: f }));
        const ms = f.buf.duration * 1000;
        got.push({ start_ms: 0, end_ms: round1(ms), at_ms: round1(at), fade_in_ms: 0, fade_out_ms: 0, gain_db: 0, audio: path });
        at += ms;
      } catch (e: any) { setError(t`${nameOf(path)} can't be read: ${String(e?.message ?? e)}`); }
    }
    setAdding(false);
    if (got.length) { commit([...blocks, ...got]); setSel(blocks.length); }
  }, [ctx, cursor, files, urlOf, blocks, commit]);
  // audio dropped on the editor (App.tsx hands it over) comes in as added files
  useEffect(() => onWaveDrop((paths) => void addFiles(paths)), [addFiles]);
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
  const close = async () => {
    if (changed && !(await confirm({ title: t`Discard the Changes?`, text: t`The changes made in the Waveform Editor are lost.`, ok: t`Discard`, cancel: t`Keep Editing` }))) return;
    stop();
    onClose();
  };
  const box = useDialog(() => void close());

  // --- the canvas: the ruler, the original, the blocks, the cursor and the playhead
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
  const height = LANES.ruler + LANES.original + LANES.edit;
  const view = { from: zoom.from, span: zoom.span };
  const xOf = (ms: number) => ((ms - view.from) / view.span) * width;
  const msOf = (x: number) => view.from + (x / width) * view.span;
  const editTop = LANES.ruler + LANES.original;
  const colourOf = useMemo(() => colours(shown), [shown]);

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
    // the original, for reference
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
    g.fillStyle = v("--bg"); g.fillRect(0, LANES.ruler, width, LANES.original + LANES.edit);
    if (reference) lane(LANES.ruler, LANES.original, reference, 0, refMs, 0, v("--steel-dim"), 1);
    g.strokeStyle = v("--line-soft"); g.beginPath(); g.moveTo(0, editTop + 0.5); g.lineTo(width, editTop + 0.5); g.stroke();
    // the blocks: the selected one last, on top; each names its file when there are several
    const named = new Set(shown.map((b) => b.audio ?? "")).size > 1;
    const order = shown.map((_, i) => i).sort((x, y) => (x === sel ? 1 : y === sel ? -1 : 0));
    for (const i of order) {
      const b = shown[i], ci = colourOf[i], colour = ci == null ? v("--accent-fg") : palette[ci % palette.length];
      const x0 = xOf(b.at_ms), x1 = xOf(endOf(b)), top = editTop + 6, h = LANES.edit - 12;
      if (x1 < 0 || x0 > width) continue;
      const see = ci != null; // overlapping: see-through, so both show
      g.globalAlpha = see ? 0.16 : 0.1; g.fillStyle = colour; g.fillRect(x0, top, x1 - x0, h); g.globalAlpha = 1;
      const bf = fileOf(b);
      if (bf) lane(top, h, bf, b.start_ms, b.end_ms, b.at_ms, colour, see ? 0.55 : 0.9, b);
      if (named && x1 - x0 > 40) { // which file, at the foot of the block
        g.save(); g.beginPath(); g.rect(x0, top, x1 - x0, h); g.clip();
        g.fillStyle = colour; g.fillText(b.audio ? nameOf(b.audio) : ownName, Math.max(x0, 0) + 6, top + h - 6); g.restore();
      }
      // the fades: a shade over the part that fades, under a line from silence to full
      const fi = xOf(b.at_ms + b.fade_in_ms), fo = xOf(endOf(b) - b.fade_out_ms);
      g.fillStyle = "rgb(0 0 0 / .35)";
      if (b.fade_in_ms > 0) { g.beginPath(); g.moveTo(x0, top); g.lineTo(fi, top); g.lineTo(x0, top + h); g.closePath(); g.fill(); }
      if (b.fade_out_ms > 0) { g.beginPath(); g.moveTo(x1, top); g.lineTo(fo, top); g.lineTo(x1, top + h); g.closePath(); g.fill(); }
      g.strokeStyle = colour; g.lineWidth = 1.25;
      g.beginPath(); g.moveTo(x0, top + h); g.lineTo(fi, top); g.lineTo(fo, top); g.lineTo(x1, top + h); g.stroke();
      // the frame, and the fade grips at the top corners
      const on = i === sel;
      g.lineWidth = on ? 2 : 1; g.strokeStyle = on ? v("--text") : colour;
      g.strokeRect(x0 + (on ? 1 : 0.5), top + (on ? 1 : 0.5), x1 - x0 - (on ? 2 : 1), h - (on ? 2 : 1));
      g.lineWidth = 1;
      if (on) for (const gx of [fi, fo]) { g.fillStyle = v("--text"); g.fillRect(gx - GRIP_PX / 2, top - 1, GRIP_PX, GRIP_PX); }
    }
    // where the original ends: what the new audio is usually fitted to
    if (refMs) {
      const x = Math.round(xOf(refMs)) + 0.5;
      g.setLineDash([4, 4]); g.strokeStyle = v("--steel"); g.globalAlpha = 0.7;
      g.beginPath(); g.moveTo(x, LANES.ruler); g.lineTo(x, height); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
    }
    // the cursor, and the playhead while something plays
    const cx = Math.round(xOf(cursor)) + 0.5;
    g.strokeStyle = v("--second-fg"); g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, height); g.stroke();
    g.fillStyle = v("--second-fg"); g.beginPath(); g.moveTo(cx - 5, 0); g.lineTo(cx + 5, 0); g.lineTo(cx, 7); g.closePath(); g.fill();
    if (head != null) {
      const hx = Math.round(xOf(head)) + 0.5;
      g.strokeStyle = v("--text"); g.lineWidth = 1; g.beginPath(); g.moveTo(hx, LANES.ruler); g.lineTo(hx, height); g.stroke();
    }
  }); // drawn after every render: a drag, the playhead and the zoom all change what shows

  // --- the pointer: what a press at a spot takes, and the magnet
  const hitAt = (x: number, y: number): Hit => {
    if (y < editTop) return { kind: "cursor", i: -1 };
    const order = shown.map((_, i) => i).sort((p, q) => (p === sel ? -1 : q === sel ? 1 : q - p)); // the one on top first
    for (const i of order) {
      const b = shown[i], x0 = xOf(b.at_ms), x1 = xOf(endOf(b)), top = editTop + 6;
      if (i === sel && y < top + GRIP_PX + 3) {
        if (Math.abs(x - xOf(b.at_ms + b.fade_in_ms)) <= GRIP_PX) return { kind: "fadeIn", i };
        if (Math.abs(x - xOf(endOf(b) - b.fade_out_ms)) <= GRIP_PX) return { kind: "fadeOut", i };
      }
      if (x < x0 - EDGE_PX || x > x1 + EDGE_PX) continue;
      if (Math.abs(x - x0) <= EDGE_PX) return { kind: "trimL", i };
      if (Math.abs(x - x1) <= EDGE_PX) return { kind: "trimR", i };
      if (x >= x0 && x <= x1) return { kind: "move", i };
    }
    return { kind: "cursor", i: -1 };
  };
  /** The nearest spot the magnet pulls to within reach of each candidate, or the candidates as they are. */
  const snap = (candidates: number[], skip: number | null) => {
    if (!magnet) return 0;
    const reach = (SNAP_PX / width) * view.span;
    const spots = [0, cursor, ...(refMs ? [refMs] : []), ...blocks.flatMap((b, j) => (j === skip ? [] : [b.at_ms, endOf(b)]))];
    let best = 0, dist = reach;
    for (const c of candidates) for (const s of spots) if (Math.abs(s - c) < dist) { dist = Math.abs(s - c); best = s - c; }
    return best;
  };
  const drag = useRef<Drag | null>(null);
  const local = (e: { clientX: number; clientY: number }) => {
    const r = wrap.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const reshape = (d: Drag, dx: number): Block[] => {
    const b = d.from, dms = (dx / width) * view.span, next = { ...b };
    if (d.kind === "move") {
      const at = Math.max(0, b.at_ms + dms);
      next.at_ms = Math.max(0, at + snap([at, at + lengthOf(b)], d.i));
    } else if (d.kind === "trimL") {
      // the file stays put: the block starts later in the file and later on the line by the same amount
      let at = b.at_ms + dms;
      at += snap([at], d.i);
      const by = Math.max(-b.start_ms, -b.at_ms, Math.min(at - b.at_ms, lengthOf(b) - MIN_BLOCK - b.fade_out_ms));
      Object.assign(next, { start_ms: b.start_ms + by, at_ms: b.at_ms + by, fade_in_ms: Math.max(0, Math.min(b.fade_in_ms, lengthOf(b) - by - b.fade_out_ms)) });
    } else if (d.kind === "trimR") {
      let end = endOf(b) + dms;
      end += snap([end], d.i);
      const len = Math.max(MIN_BLOCK + b.fade_in_ms, Math.min(msOfFile(b) - b.start_ms, end - b.at_ms));
      Object.assign(next, { end_ms: b.start_ms + len, fade_out_ms: Math.max(0, Math.min(b.fade_out_ms, len - b.fade_in_ms)) });
    } else if (d.kind === "fadeIn") {
      next.fade_in_ms = Math.max(0, Math.min(lengthOf(b) - b.fade_out_ms, b.fade_in_ms + dms));
    } else if (d.kind === "fadeOut") {
      next.fade_out_ms = Math.max(0, Math.min(lengthOf(b) - b.fade_in_ms, b.fade_out_ms - dms));
    }
    return blocks.map((x, j) => (j === d.i ? next : x));
  };
  const [hover, setHover] = useState<Drag["kind"] | null>(null);
  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || !ready || (e.target as HTMLElement).closest("button")) return; // the empty start's buttons
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const { x, y } = local(e), hit = hitAt(x, y)!;
    if (hit.i >= 0) setSel(hit.i);
    drag.current = { kind: hit.kind, i: hit.i, x0: x, from: hit.i >= 0 ? blocks[hit.i] : blocks[0], moved: false };
    if (hit.kind === "cursor") {
      const ms = Math.max(0, msOf(x));
      setCursor(Math.max(0, ms + snap([ms], null)));
      if (y >= editTop) setSel(null);
    }
  };
  const onMove = (e: React.PointerEvent) => {
    const { x, y } = local(e), d = drag.current;
    if (!d) { setHover(hitAt(x, y)?.kind ?? null); return; }
    if (!d.moved && Math.abs(x - d.x0) < 3) return;
    d.moved = true;
    if (d.kind === "cursor") { const ms = Math.max(0, msOf(x)); setCursor(Math.max(0, ms + snap([ms], null))); return; }
    setLive(reshape(d, x - d.x0));
  };
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const { x } = local(e);
    if (d.kind === "cursor") return;
    if (d.moved || Math.abs(x - d.x0) >= 3) commit(reshape(d, x - d.x0));
    else { const ms = Math.max(0, msOf(x)); setCursor(Math.max(0, ms + snap([ms], null))); setLive(null); } // a click on a block: the cursor goes there
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
    if ((e.target as HTMLElement).closest("input, textarea")) return;
    const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
    const did = () => { e.preventDefault(); e.stopPropagation(); };
    if (k === " ") { did(); toggle(); }
    else if (mod && k === "z") { did(); if (e.shiftKey) redo(); else undo(); }
    else if (mod && k === "y") { did(); redo(); }
    else if (mod && k === "d") { did(); duplicate(); }
    else if (!mod && k === "s") { did(); splitAt(cursor); }
    else if (!mod && k === "m") { did(); setMagnet((m) => !m); }
    else if (!mod && k === "l") { did(); setLoop((l) => !l); }
    else if (k === "delete" || k === "backspace") { did(); remove(); }
    else if (k === "home") { did(); setCursor(0); }
    else if (k === "end") { did(); setCursor(resultMs); }
    else if (k === "arrowleft" || k === "arrowright") {
      did();
      const by = (k === "arrowleft" ? -1 : 1) * NUDGE * (e.shiftKey ? 10 : 1);
      if (sel != null) set(sel, { at_ms: Math.max(0, blocks[sel].at_ms + by) });
      else setCursor((c) => Math.max(0, c + by));
    }
    else if (k === "enter" && mod) { did(); void apply(); }
  };

  const b = sel != null ? blocks[sel] : null;
  const cursorCls = { move: "grab", trimL: "ew-resize", trimR: "ew-resize", fadeIn: "col-resize", fadeOut: "col-resize", cursor: "text" } as const;
  const diff = refMs ? resultMs - refMs : 0;
  const source_ = editOriginal ? t`Original` : a && !a.silence ? a.name : t`New audio`;
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

        <div className="wave-ed-tools" role="toolbar" aria-label={t`Waveform Editor tools`}>
          <button className={`btn play-btn${playing === "edit" ? " on" : ""}`} onClick={() => toggle()} disabled={!file}
            data-tip={playing === "edit" ? t`Pause` : t`Play from the cursor`} data-tip-key="Space">
            {playing === "edit" ? <PauseIcon /> : <PlayIcon />}{playing === "edit" ? t`Pause` : t`Play`}</button>
          <button className="icon-btn" onClick={() => { stop(); setCursor(0); }} aria-label={t`Stop`} data-tip={t`Stop, and put the cursor at the start`}><StopIcon /></button>
          <button className={`icon-btn${loop ? " on" : ""}`} aria-pressed={loop} onClick={() => setLoop(!loop)} aria-label={t`Loop`}
            data-tip={t`Loop`} data-tip-more={t`Plays the selected block over and over, or the whole result`} data-tip-key="L"><LoopIcon /></button>
          <span className="wave-ed-sep" />
          <button className="btn" onClick={() => void addFiles()} disabled={!ctx || adding}
            data-tip={t`Add audio files as new blocks`} data-tip-more={t`They go one after the other from the cursor. Dropping files on the editor does the same`}>
            <PlusIcon /><Trans>Add Audio</Trans></button>
          <button className="btn" onClick={() => splitAt(cursor)} disabled={!shown.length} data-tip={t`Split the block at the cursor`} data-tip-key="S"><SplitIcon /><Trans>Split</Trans></button>
          <button className="icon-btn" onClick={duplicate} disabled={b == null} aria-label={t`Duplicate`} data-tip={t`Duplicate the block`} data-tip-more={t`The copy goes right after it`} data-tip-key="Ctrl+D"><DuplicateIcon /></button>
          <button className="icon-btn" onClick={remove} disabled={b == null || blocks.length < 2} aria-label={t`Remove`} data-tip={t`Remove the block`} data-tip-key="Delete"><RemoveIcon /></button>
          <span className="wave-ed-sep" />
          <button className={`btn${magnet ? " on" : ""}`} aria-pressed={magnet} onClick={() => setMagnet(!magnet)} data-tip={t`Magnet`}
            data-tip-more={t`The cursor, block edges and blocks snap to each other, to the start and to where the original ends`} data-tip-key="M"><MagnetIcon /><Trans>Magnet</Trans></button>
          <span className="spacer" />
          <button className="icon-btn" onClick={undo} disabled={hist.at === 0} aria-label={t`Undo`} data-tip={t`Undo`} data-tip-key="Ctrl+Z"><UndoIcon /></button>
          <button className="icon-btn" onClick={redo} disabled={hist.at >= hist.list.length - 1} aria-label={t`Redo`} data-tip={t`Redo`} data-tip-key="Ctrl+Y"><RedoIcon /></button>
          <button className="btn quiet" onClick={reset} disabled={!ready} data-tip={hasOwn ? t`Back to the whole file, as it is` : t`Remove every block`}><ResetIcon /><Trans>Reset</Trans></button>
        </div>

        <div className="wave-ed-body zoom-grid">
          <div className="wave-ed-lanes">
            <div className="wave-ed-labels" style={{ gridTemplateRows: `${LANES.ruler}px ${LANES.original}px ${LANES.edit}px` }}>
              <span />
              <span className="game">
                <button className={`icon-btn small${playing === "original" ? " on" : ""}`} onClick={() => toggle("original")} disabled={!reference}
                  aria-label={t`Play the original`} data-tip={playing === "original" ? t`Stop` : t`Play the original from the cursor`}>
                  {playing === "original" ? <PauseIcon /> : <PlayIcon />}</button>
                {t`Original`}</span>
              <span className="mine">{t`Replaced`}</span>
            </div>
            <div className="wave-ed-canvas" ref={wrap} data-drop={JSON.stringify({ kind: "wave-editor" })} style={{ height, cursor: drag.current ? (drag.current.kind === "move" ? "grabbing" : cursorCls[drag.current.kind]) : hover ? cursorCls[hover] : "text" }}
              onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={() => setHover(null)}>
              <canvas ref={canvas} style={{ width, height }} />
              {!ready ? <p className="wave-ed-state">{error ? t`The audio can't be read: ${error}` : t`Reading the audio…`}</p>
                : !shown.length && (
                  <div className="wave-ed-state wave-ed-empty">
                    <p><Trans>Add audio files to build the new audio from, or start from the original.</Trans></p>
                    <div className="row-btns">
                      <button className="btn primary" onClick={() => void addFiles()}><PlusIcon /><Trans>Add Audio</Trans></button>
                      {ref && <button className="btn" onClick={fromOriginal}><Trans>Start from the Original</Trans></button>}
                    </div>
                  </div>
                )}
            </div>
          </div>
          <WaveZoom zoom={zoom} foot={zoom.x > 1 ? <WaveScroll zoom={zoom} /> : null} />
        </div>

        <div className="wave-ed-fields">
          {b ? <BlockFields b={b} n={sel! + 1} fileMs={msOfFile(b)} file={b.audio ? nameOf(b.audio) : ownName} onSet={(x) => set(sel!, x)} onNormalize={normalize} />
            : <p className="muted"><Trans>Click a block to set it up. Drag the body to move it, an edge to trim it, and the squares at the top to fade it.</Trans></p>}
        </div>

        <footer className="modal-foot">
          <button className="btn primary" onClick={() => void apply()} disabled={!ready || saving || !blocks.length || (!changed && !editOriginal)}
            data-tip={editOriginal ? t`Use the edited original as the new audio of the slot` : t`Keep these changes in the project`} data-tip-key="Ctrl+Enter">
            {editOriginal || !hasOwn ? t`Use as New Audio` : t`Apply`}</button>
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
    </div>, document.body);
}

/** The selected block in numbers, in ms (Gain in dB): what the canvas does by dragging, to type exactly. */
function BlockFields({ b, n, fileMs, file, onSet, onNormalize }: {
  b: Block; n: number; fileMs: number; file: string; onSet: (b: Partial<Block>) => void; onNormalize: () => void;
}) {
  const len = lengthOf(b);
  const field = (key: Exclude<keyof Block, "audio">, name: string, tip: string, lo: number, hi: number, unit = "ms", step = 1, put?: (v: number) => Partial<Block>) => (
    <label className="wave-ed-field" data-tip={tip}>{name}
      <input type="number" min={lo} max={hi} step={step} key={`${key}:${b[key]}`} defaultValue={round1(b[key])} aria-label={`${name} (${unit})`}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        onBlur={(e) => {
          const v = Number(e.target.value);
          if (!Number.isFinite(v) || round1(v) === round1(b[key])) { e.target.value = String(round1(b[key])); return; }
          const x = Math.max(lo, Math.min(hi, v));
          onSet(put ? put(x) : { [key]: x });
        }} /><span className="unit">{unit}</span>
    </label>
  );
  return (
    <div className="wave-ed-block">
      <b className="wave-ed-n" data-tip={file}>{t`Block ${n}`}<span className="wave-ed-file">{file}</span></b>
      {field("start_ms", t({ message: "Start", context: "Trim handle" }), t`Where the block starts in the file`, 0, b.end_ms - MIN_BLOCK)}
      {field("end_ms", t({ message: "End", context: "Trim handle" }), t`Where the block ends in the file`, b.start_ms + MIN_BLOCK, fileMs)}
      {field("at_ms", t`Position`, t`When the block plays, from the start of the slot`, 0, 3_600_000)}
      {field("fade_in_ms", t`Fade In`, t`How long the block takes to rise from silence`, 0, len - b.fade_out_ms)}
      {field("fade_out_ms", t`Fade Out`, t`How long the block takes to fall to silence before it ends`, 0, len - b.fade_in_ms)}
      {field("gain_db", t`Gain`, t`How much louder or quieter the block plays`, -60, 24, "dB", 0.5)}
      <button className="btn quiet" onClick={onNormalize} data-tip={t`Normalize`} data-tip-more={t`Sets the gain so the loudest moment of the block reaches −1 dB`}><NormalizeIcon /><Trans>Normalize</Trans></button>
      <span className="wave-ed-len">{t`Length`} <b>{fmtTime(len)}</b></span>
    </div>
  );
}
