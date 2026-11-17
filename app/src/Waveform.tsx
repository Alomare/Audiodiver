import { ph, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { call, fmtTime, intlLocale } from "./api";
import { ResetIcon } from "./Icons";
import { rangeVars } from "./range";
import { useTheme } from "./theme";

/** The loudest sample of each slice of the audio, from 0 to `full` (255, or 32767 for a waveform zoomed in on). */
export type Peaks = { duration_ms: number; peaks: number[]; full?: number };
export type Marker = {
  id: string; ms: number; label: string; about?: string; draggable?: boolean; min?: number; max?: number;
  // a line that bends: its top at `bend` while its foot stays at `ms` (a fade from the foot to the top). Its flag,
  // at the top, drags the bend; the rest of the line drags the marker, the bend going along
  bend?: number; bendMin?: number; bendMax?: number; bendAbout?: string;
};
type Part = "line" | "bend";
/** Fades on a stretch of audio, in its ms: the level rises in a straight line over `in` from `from`, and falls over
    `out` up to `to` (audio.faded). */
export type Fades = { from: number; to: number; in: number; out: number };
const fadeLevel = (f: Fades, ms: number) =>
  Math.max(0, Math.min(1, f.in > 0 ? (ms - f.from) / f.in : 1, f.out > 0 ? (f.to - ms) / f.out : 1));
/** Finer peaks for a zoomed-in waveform: more slices, on the 16-bit scale. */
type Fine = { buckets: number };

const cache = new Map<string, Promise<Peaks>>();
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function fetchPeaks(kind: "vanilla" | "project" | "file", id: string, key: string, fine?: Fine) {
  if (!cache.has(key)) {
    const args = { ...(kind === "file" ? { kind, path: id } : { kind, source: id }), ...(fine ? { buckets: fine.buckets, full: 32767 } : {}) };
    // asked again, twice, before giving up: the core may still be busy with the same audio for the player
    const p = call<Peaks>("peaks", args)
      .catch(() => wait(400).then(() => call<Peaks>("peaks", args)))
      .catch(() => wait(1200).then(() => call<Peaks>("peaks", args)));
    cache.set(key, p);
    p.catch(() => cache.delete(key));
  }
  return cache.get(key)!;
}

/** Peaks from the same cache as the waveforms, for drawing several at once (the slice tool's originals). */
export const loadPeaks = (kind: "vanilla" | "project" | "file", id: string, version = "") => fetchPeaks(kind, id, `${kind}:${id}:${version}`);

/** Peaks of the original audio, the assigned audio or a file. `peaks` is null while loading or when it failed;
    `error` says why it failed, and `retry` asks again. `fine`: the finer peaks of a zoomed-in waveform. */
export function usePeaks(kind: "vanilla" | "project" | "file", id: string | null, version = "", fine?: Fine) {
  const key = id ? `${kind}:${id}:${version}${fine ? `:${fine.buckets}:fine` : ""}` : "";
  const [got, setGot] = useState<{ key: string; peaks: Peaks | null; error: string | null }>({ key: "", peaks: null, error: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!id) return;
    let live = true;
    setGot((g) => (g.key === key && g.peaks ? g : { key, peaks: null, error: null }));
    fetchPeaks(kind, id, key, fine).then(
      (d) => live && setGot({ key, peaks: d, error: null }),
      (e) => live && setGot({ key, peaks: null, error: String(e?.message ?? e) }));
    return () => { live = false; };
  }, [key, attempt]);
  // the last answer belongs to this audio only; another slot's waveform never shows for a frame
  const mine = got.key === key ? got : { peaks: null, error: null };
  return { peaks: mine.peaks, error: mine.error, retry: () => setAttempt((n) => n + 1) };
}

type Props = {
  peaks: Peaks | null;
  spanMs: number;              // time shown across the full width (lets two waveforms share one scale)
  fromMs?: number;             // where that time starts: past 0 when zoomed in
  zoomY?: number;              // drawn this many times taller (zoomed in on the level); what plays is the same
  tone: "game" | "mine";
  height?: number;             // fixed height; without it the waveform fills its parent's height
  markers?: Marker[];
  playheadMs?: number | null;
  activeFrom?: number;         // audio outside [activeFrom, activeTo] is drawn dim (before entry / after exit)
  activeTo?: number;
  bands?: number[];            // boundaries; alternate pieces are shaded (slice tool)
  onSeek?: (ms: number) => void;
  onMarkerMove?: (id: string, ms: number, part: Part) => void;
  onMarkerCommit?: (id: string, ms: number, how: "drag" | "key", part: Part) => void; // how: a drag snaps back onto the automatic spot, keys never do
  label?: string;                // shown while there are no peaks yet
  error?: string | null;         // shown instead when they failed, with a way to ask again
  onRetry?: () => void;
  gainDb?: number;               // drawn this much louder or quieter (Make-Up Gain); past full scale in red
  curve?: number[][];            // [ms, level]: the level the game gives the clip as it plays, 1 as mixed, as a line each side
  fades?: Fades;                 // drawn into the shape (a marker's bent line shows each ramp)
};

export function Waveform({ peaks, spanMs, fromMs = 0, zoomY = 1, tone, height: fixed, markers = [], playheadMs, activeFrom, activeTo, bands, onSeek, onMarkerMove, onMarkerCommit, label, error, onRetry, gainDb = 0, curve, fades }: Props) {
  // where key nudges put each marker, until the project's answer puts it there too
  const nudged = useRef<Record<string, number>>({});
  for (const m of markers) if (nudged.current[m.id] === m.ms) delete nudged.current[m.id];
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [drag, setDrag] = useState<{ id: string; ms: number; part: Part } | null>(null);
  const look = useTheme(); // the canvas reads colours from CSS, so redraw when they change

  useEffect(() => {
    const el = wrap.current!;
    const measure = () => setSize((s) => (s.w === el.clientWidth && s.h === el.clientHeight ? s : { w: el.clientWidth, h: el.clientHeight }));
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);
  const width = size.w;
  const height = fixed ?? Math.max(20, size.h);

  const x = (ms: number) => (spanMs > 0 ? ((ms - fromMs) / spanMs) * width : 0);
  const msAt = (clientX: number) => {
    const r = wrap.current!.getBoundingClientRect();
    // before 0 only where the view starts there (new audio placed later than the original: its delay)
    return Math.max(Math.min(0, fromMs), fromMs + Math.min(spanMs, Math.max(0, ((clientX - r.left) / r.width) * spanMs)));
  };
  const inView = (px: number) => px >= -1 && px <= width + 1;

  useEffect(() => {
    const c = canvas.current;
    if (!c || !width) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(width * dpr); c.height = Math.round(height * dpr);
    const g = c.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, width, height);
    const css = getComputedStyle(c);
    const bright = css.getPropertyValue(tone === "mine" ? "--accent-fg" : "--steel").trim();
    const dim = css.getPropertyValue(tone === "mine" ? "--accent-dim" : "--steel-dim").trim();
    if (bands) {
      g.fillStyle = css.getPropertyValue("--band").trim();
      for (let i = 0; i + 1 < bands.length; i += 2) g.fillRect(x(bands[i]), 0, x(bands[i + 1]) - x(bands[i]), height);
    }
    if (!peaks) return;
    // each pixel of the view: the loudest slice under it. Red is past full scale at the Make-Up Gain, whatever the
    // zoom; a waveform zoomed in on the level is cut off at the edges instead
    const dur = peaks.duration_ms, n = peaks.peaks.length, mid = height / 2, full = peaks.full ?? 255;
    const from = activeFrom ?? 0, to = activeTo ?? dur;
    const k = 10 ** (gainDb / 20), red = css.getPropertyValue("--red").trim();
    const end = Math.min(width, Math.ceil(x(dur)));
    for (let px = Math.max(0, Math.floor(x(0))); px < end; px++) {
      const ms = fromMs + (px / width) * spanMs, ms2 = fromMs + ((px + 1) / width) * spanMs;
      const a = Math.max(0, Math.floor((ms / dur) * n)), b = Math.min(n, Math.max(a + 1, Math.ceil((ms2 / dur) * n)));
      let v = 0;
      for (let i = a; i < b; i++) v = Math.max(v, peaks.peaks[i]);
      v = (v / full) * k * (fades && ms >= from && ms <= to ? fadeLevel(fades, ms) : 1);
      const h = Math.max(1, Math.min(1, v * zoomY) * (height - 6));
      g.fillStyle = v > 1 ? red : ms >= from && ms <= to ? bright : dim;
      g.globalAlpha = ms >= from && ms <= to ? 0.9 : 0.45;
      g.fillRect(px, mid - h / 2, 1, h);
    }
    g.globalAlpha = 1;
    if (curve?.length) {
      const y = (level: number) => (Math.min(1, level * zoomY) * (height - 6)) / 2, last = curve[curve.length - 1][1];
      g.strokeStyle = css.getPropertyValue("--text").trim();
      g.lineWidth = 1.25;
      g.globalAlpha = 0.85;
      for (const side of [-1, 1]) {
        g.beginPath();
        g.moveTo(x(0), mid + side * y(curve[0][1]));
        for (const [ms, level] of curve) g.lineTo(x(ms), mid + side * y(level));
        g.lineTo(x(dur), mid + side * y(last));
        g.stroke();
      }
      g.globalAlpha = 1;
    }
  }, [peaks, width, height, spanMs, fromMs, zoomY, tone, activeFrom, activeTo, bands?.join(","), look, gainDb, curve,
    fades?.from, fades?.to, fades?.in, fades?.out]);

  const startDrag = (e: React.PointerEvent, m: Marker) => {
    if (!m.draggable) return;
    e.stopPropagation(); e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const bend = m.bend != null && !!(e.target as HTMLElement).closest(".marker-flag");
    setDrag({ id: m.id, ms: bend ? m.bend! : m.ms, part: bend ? "bend" : "line" });
  };
  const clamp = (m: Marker, part: Part, ms: number) =>
    part === "bend" ? Math.max(m.bendMin ?? m.ms, Math.min(m.bendMax ?? m.ms, ms)) : Math.max(m.min ?? 0, Math.min(m.max ?? spanMs, ms));
  const moveDrag = (e: React.PointerEvent, m: Marker) => {
    if (!drag || drag.id !== m.id) return;
    const ms = clamp(m, drag.part, msAt(e.clientX));
    setDrag({ ...drag, ms });
    onMarkerMove?.(m.id, ms, drag.part);
  };
  // where the release is, not the last move's state: that may not be drawn yet when the release comes right after it
  // (WebKit, the window on Linux), and the marker went back to where the drag began
  const endDrag = (e: React.PointerEvent, m: Marker) => {
    if (!drag || drag.id !== m.id) return;
    onMarkerCommit?.(m.id, Math.round(clamp(m, drag.part, msAt(e.clientX))), "drag", drag.part);
    setDrag(null);
  };
  /** Where a marker's foot and top are drawn, with a drag in progress: dragging the line takes the bend along. */
  const placed = (m: Marker) => {
    const d = drag?.id === m.id ? drag : null;
    const foot = d?.part === "line" ? d.ms : m.ms;
    const top = d?.part === "bend" ? d.ms : m.bend != null ? m.bend + (foot - m.ms) : foot;
    return { foot, top };
  };

  // a flag that would cover the one before it (Entry and Exit close together on short audio) goes a row lower. A
  // flag's width is guessed from its label, on the generous side: too generous only stacks two that would just fit.
  const flagRows = new Map<string, number>();
  let flagEnd = -Infinity, flagRow = 0;
  for (const m of [...markers].sort((a, b) => placed(a).top - placed(b).top)) {
    const left = x(placed(m).top), w = 14 + (m.label.length + (drag?.id === m.id ? 7 : 0)) * 8;
    const from = left > width - 90 ? left - w : left; // a flipped flag reaches back from its line
    flagRow = from < flagEnd ? flagRow + 1 : 0;
    flagRows.set(m.id, flagRow);
    flagEnd = Math.max(flagEnd, from + w);
  }

  return (
    <div className={`wave ${tone}${onSeek ? " seekable" : ""}${fixed ? "" : " fill"}${peaks ? " ready" : ""}`} ref={wrap} style={fixed ? { height: fixed } : undefined} aria-label={label}
      onPointerDown={(e) => { if (onSeek && !(e.target as HTMLElement).closest(".marker")) onSeek(msAt(e.clientX)); }}>
      <canvas ref={canvas} style={{ width: "100%", height }} />
      {!peaks && error ? (
        <span className="wave-empty failed" onPointerDown={(e) => e.stopPropagation()}>
          <span>{onRetry ? <Trans>Couldn't read this audio. <button className="link-inline" onClick={onRetry}>Try Again</button></Trans>
            : <Trans>Couldn't read this audio</Trans>}</span>
        </span>
      ) : !peaks && label && <span className="wave-empty">{label}</span>}
      {/* moved by a transform: it moves on every frame of playback, and a transform needs no layout or paint */}
      {playheadMs != null && inView(x(playheadMs)) && <div className="playhead" style={{ transform: `translateX(${x(playheadMs)}px)` }} />}
      {markers.map((m) => {
        const { foot, top } = placed(m);
        const ms = drag?.id === m.id ? drag.ms : m.ms;
        const left = x(foot), dx = x(top) - left, row = flagRows.get(m.id) ?? 0;
        if (!inView(left) && !inView(left + dx) && drag?.id !== m.id) return null; // zoomed in elsewhere
        const bent = Math.abs(dx) >= 0.5;
        return (
          <div key={m.id} className={`marker${m.draggable ? " draggable" : ""}${drag?.id === m.id ? " dragging" : ""}${left + dx > width - 90 ? " flip" : ""}${bent ? " bent" : ""}${m.bend != null ? " bendable" : ""}`}
            style={{ left }} role={m.draggable ? "slider" : undefined} tabIndex={m.draggable ? 0 : undefined}
            aria-label={m.label} aria-valuenow={m.draggable ? Math.round(ms) : undefined} data-tip={drag ? undefined : t`${ph({ name: m.label })} at ${ph({ time: fmtTime(m.ms) })}`} data-tip-side="top"
            data-tip-more={drag ? undefined : m.about}
            onPointerDown={(e) => startDrag(e, m)} onPointerMove={(e) => moveDrag(e, m)} onPointerUp={(e) => endDrag(e, m)}
            onKeyDown={(e) => {
              if (!m.draggable) return;
              const step = (e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0) * (e.shiftKey ? 100 : 10);
              if (!step) return;
              e.preventDefault(); e.stopPropagation();
              const from = nudged.current[m.id] ?? ms;
              const to = Math.max(m.min ?? 0, Math.min(m.max ?? spanMs, Math.round(from + step)));
              nudged.current[m.id] = to;
              onMarkerCommit?.(m.id, to, "key", "line");
            }}>
            {/* the bent line: from the foot at the bottom to the top, where the flag is */}
            {bent && (
              <svg className="marker-bend" style={{ left: Math.min(0, dx), width: Math.abs(dx) }} aria-hidden="true">
                <line x1={dx > 0 ? "0%" : "100%"} y1="100%" x2={dx > 0 ? "100%" : "0%"} y2="0%" />
                {/* the slant itself drags the marker, as the straight line does */}
                <line className="grab" x1={dx > 0 ? "0%" : "100%"} y1="100%" x2={dx > 0 ? "100%" : "0%"} y2="0%" />
              </svg>
            )}
            <span className="marker-flag" style={{ ...(row ? { top: `calc(${row} * (16px * var(--fs) + 1px))` } : {}), ...(bent ? { marginLeft: dx } : {}) }}
              data-tip={m.bend != null && !drag ? m.bendAbout : undefined} data-tip-side="top">
              {m.label}{drag?.id === m.id ? ` ${fmtTime(drag.part === "bend" ? Math.abs(drag.ms - m.ms) : ms)}` : ""}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---- zoom: the waveforms beside one set of controls share it

/** As tall as the level zoom goes: ×64 shows audio 36 dB below full scale at full height. */
export const ZOOM_Y_MAX = 64;
const ZOOM_X_MAX = 256;
/** A slider's 0 to 100, on a doubling scale from ×1 to `max`, and back. */
const toSlider = (z: number, max: number) => (max > 1 ? Math.round((Math.log2(z) / Math.log2(max)) * 1000) / 10 : 0);
const fromSlider = (v: number, max: number) => 2 ** ((v / 100) * Math.log2(max));

export type WaveZoomState = {
  x: number; y: number; maxX: number;  // times wider and taller than the whole audio at full scale
  from: number; span: number;          // the stretch of `total` ms in view
  total: number;
  zoomed: boolean;
  zoomX: (x: number, atMs?: number) => void; // about a moment (the pointer), else the middle of the view
  zoomY: (y: number) => void;
  scroll: (fromMs: number) => void;
  reset: () => void;
};

/** The zoom of waveforms that share one time scale of `total` ms. Nothing zooms by itself: it stays as set when
    another slot is chosen, which only scrolls back to the start. `minSpan`: the shortest stretch it shows. */
export function useWaveZoom(total: number, minSpan: number, slot: string | null = null): WaveZoomState {
  const [z, setZ] = useState({ x: 1, y: 1, from: 0 });
  useEffect(() => setZ((s) => (s.from ? { ...s, from: 0 } : s)), [slot]);
  const t = Math.max(total, 1);
  const maxX = Math.max(1, Math.min(ZOOM_X_MAX, t / minSpan));
  const x = Math.min(z.x, maxX), span = t / x;
  const from = Math.max(0, Math.min(t - span, z.from));
  return {
    x, y: z.y, maxX, from, span, total: t, zoomed: x > 1 || z.y > 1,
    zoomX: (nx, atMs) => setZ((s) => {
      const x1 = Math.max(1, Math.min(maxX, nx)), span1 = t / x1;
      const at = atMs ?? from + span / 2;
      return { ...s, x: x1, from: Math.max(0, Math.min(t - span1, at - ((at - from) / span) * span1)) };
    }),
    zoomY: (ny) => setZ((s) => ({ ...s, y: Math.max(1, Math.min(ZOOM_Y_MAX, ny)) })),
    scroll: (f) => setZ((s) => ({ ...s, from: Math.max(0, Math.min(t - span, f)) })),
    reset: () => setZ({ x: 1, y: 1, from: 0 }),
  };
}

/** The wheel on waveforms: it zooms in on time about the moment under the pointer, with Ctrl it zooms the level, and
    with Shift (or sideways, on a touchpad) it scrolls. */
export function useWheelZoom(el: RefObject<HTMLElement | null>, zoom: WaveZoomState, on: boolean) {
  const now = useRef(zoom);
  now.current = zoom;
  useEffect(() => {
    const box = el.current;
    if (!box || !on) return;
    const wheel = (e: WheelEvent) => {
      const z = now.current, wave = box.querySelector(".wave")?.getBoundingClientRect();
      if (!wave?.width) return;
      e.preventDefault();
      wheelZoom(e, z, wave);
    };
    box.addEventListener("wheel", wheel, { passive: false });
    return () => box.removeEventListener("wheel", wheel);
  }, [el, on]);
}

/** What a turn of the wheel does to a zoom (useWheelZoom, and the slice tool's lanes): `box` is the waveform's. */
export function wheelZoom(e: WheelEvent, z: WaveZoomState, box: DOMRect) {
  const sideways = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY);
  if (e.ctrlKey || e.metaKey) z.zoomY(z.y * Math.exp(-e.deltaY * 0.002));
  else if (sideways) z.scroll(z.from + ((e.deltaX || e.deltaY) / box.width) * z.span);
  else z.zoomX(z.x * Math.exp(-e.deltaY * 0.002), z.from + ((e.clientX - box.left) / box.width) * z.span);
}

/** The finer peaks a waveform needs once zoomed in (on time or on the level): about one slice per half millisecond. */
export const finePeaks = (zoom: WaveZoomState, durationMs: number | undefined) =>
  zoom.zoomed && durationMs ? { buckets: Math.round(Math.max(1200, Math.min(120_000, durationMs * 2))) } : undefined;

/** The zoom of waveforms, as a mirrored L around them: the level zoom up the right side, the time zoom at the right
    end of the foot (after `foot`, the scroll strip when there is one), and the button back to the whole audio at full
    scale in the corner where the two meet. It goes in a .zoom-grid, after the waveforms. */
export function WaveZoom({ zoom, foot }: { zoom: WaveZoomState; foot?: ReactNode }) {
  const y = toSlider(zoom.y, ZOOM_Y_MAX), x = toSlider(zoom.x, zoom.maxX);
  // the zoom in words for a screen reader, to one decimal in the language's way: "2.5 times as tall"
  const tall = zoom.y.toLocaleString(intlLocale(), { maximumFractionDigits: 1 });
  const wide = zoom.x.toLocaleString(intlLocale(), { maximumFractionDigits: 1 });
  return (
    <>
      <div className="zoom-level">
        <input type="range" className="r-zoom" style={rangeVars(y, 0, 100)} min={0} max={100} step={0.1} value={y} data-scale-tip
          onChange={(e) => zoom.zoomY(fromSlider(Number(e.target.value), ZOOM_Y_MAX))} aria-label={t`Level zoom`} aria-orientation="vertical"
          aria-valuetext={t`${tall} times as tall`} data-tip={t`Level zoom`} data-tip-side="left"
          data-tip-more={t`Taller, to see quiet audio. It plays as loud as before. Ctrl+wheel on the waveforms zooms too`} />
      </div>
      <div className="zoom-foot">
        {foot}
        <input type="range" className="r-zoom zoom-time" style={rangeVars(x, 0, 100)} min={0} max={100} step={0.1} value={x} disabled={zoom.maxX <= 1} data-scale-tip
          onChange={(e) => zoom.zoomX(fromSlider(Number(e.target.value), zoom.maxX))} aria-label={t`Time zoom`}
          aria-valuetext={t`${wide} times as wide`} data-tip={t`Time zoom`} data-tip-side="top"
          data-tip-more={t`Wider, to place cue points closely. The wheel on the waveforms zooms too, and Shift+wheel scrolls`} />
      </div>
      <button className="icon-btn zoom-reset" disabled={!zoom.zoomed} onClick={zoom.reset} aria-label={t`Reset zoom`}
        data-tip={zoom.zoomed ? t`Reset zoom` : t`Not zoomed in`} data-tip-side="left"><ResetIcon /></button>
    </>
  );
}

/** Under zoomed-in waveforms: the whole audio, with the stretch in view as a handle to drag. A click elsewhere
    on it brings that moment into view. */
export function WaveScroll({ zoom }: { zoom: WaveZoomState }) {
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x0: number; from0: number } | null>(null);
  const { from, span, total } = zoom;
  const at = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    return ((clientX - r.left) / r.width) * total;
  };
  return (
    <div className="wave-scroll" ref={track} aria-hidden onPointerDown={(e) => { if (e.target === track.current) zoom.scroll(at(e.clientX) - span / 2); }}>
      <div className="wave-thumb" style={{ left: `${(from / total) * 100}%`, width: `${(span / total) * 100}%` }}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x0: e.clientX, from0: from }; }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const r = track.current!.getBoundingClientRect();
          zoom.scroll(drag.current.from0 + ((e.clientX - drag.current.x0) / r.width) * total);
        }}
        onPointerUp={() => { drag.current = null; }} />
    </div>
  );
}
