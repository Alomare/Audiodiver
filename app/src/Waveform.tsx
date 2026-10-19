import { useEffect, useRef, useState } from "react";
import { call, fmtTime } from "./api";
import { useTheme } from "./theme";

export type Peaks = { duration_ms: number; peaks: number[] };
export type Marker = { id: string; ms: number; label: string; draggable?: boolean; min?: number; max?: number };

const cache = new Map<string, Promise<Peaks>>();
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function fetchPeaks(kind: "vanilla" | "project" | "file", id: string, key: string) {
  if (!cache.has(key)) {
    const args = kind === "file" ? { kind, path: id } : { kind, source: id };
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
    `error` says why it failed, and `retry` asks again. */
export function usePeaks(kind: "vanilla" | "project" | "file", id: string | null, version = "") {
  const key = id ? `${kind}:${id}:${version}` : "";
  const [got, setGot] = useState<{ key: string; peaks: Peaks | null; error: string | null }>({ key: "", peaks: null, error: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!id) return;
    let live = true;
    setGot((g) => (g.key === key && g.peaks ? g : { key, peaks: null, error: null }));
    fetchPeaks(kind, id, key).then(
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
  tone: "game" | "mine";
  height?: number;             // fixed height; without it the waveform fills its parent's height
  markers?: Marker[];
  playheadMs?: number | null;
  activeFrom?: number;         // audio outside [activeFrom, activeTo] is drawn dim (before entry / after exit)
  activeTo?: number;
  bands?: number[];            // boundaries; alternate pieces are shaded (slice tool)
  onSeek?: (ms: number) => void;
  onMarkerMove?: (id: string, ms: number) => void;
  onMarkerCommit?: (id: string, ms: number, how: "drag" | "key") => void; // how: a drag snaps back onto the automatic spot, keys never do
  label?: string;                // shown while there are no peaks yet
  error?: string | null;         // shown instead when they failed, with a way to ask again
  onRetry?: () => void;
};

export function Waveform({ peaks, spanMs, tone, height: fixed, markers = [], playheadMs, activeFrom, activeTo, bands, onSeek, onMarkerMove, onMarkerCommit, label, error, onRetry }: Props) {
  // where key nudges put each marker, until the project's answer puts it there too
  const nudged = useRef<Record<string, number>>({});
  for (const m of markers) if (nudged.current[m.id] === m.ms) delete nudged.current[m.id];
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [drag, setDrag] = useState<{ id: string; ms: number } | null>(null);
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

  const x = (ms: number) => (spanMs > 0 ? (ms / spanMs) * width : 0);
  const msAt = (clientX: number) => {
    const r = wrap.current!.getBoundingClientRect();
    return Math.max(0, Math.min(spanMs, ((clientX - r.left) / r.width) * spanMs));
  };

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
    const w = x(peaks.duration_ms), n = peaks.peaks.length, mid = height / 2;
    const from = activeFrom ?? 0, to = activeTo ?? peaks.duration_ms;
    for (let px = 0; px < w; px++) {
      const a = Math.floor((px / w) * n), b = Math.max(a + 1, Math.floor(((px + 1) / w) * n));
      let v = 0;
      for (let i = a; i < b && i < n; i++) v = Math.max(v, peaks.peaks[i]);
      const ms = (px / w) * peaks.duration_ms;
      const h = Math.max(1, (v / 255) * (height - 6));
      g.fillStyle = ms >= from && ms <= to ? bright : dim;
      g.globalAlpha = ms >= from && ms <= to ? 0.9 : 0.45;
      g.fillRect(px, mid - h / 2, 1, h);
    }
    g.globalAlpha = 1;
  }, [peaks, width, height, spanMs, tone, activeFrom, activeTo, bands?.join(","), look]);

  const startDrag = (e: React.PointerEvent, m: Marker) => {
    if (!m.draggable) return;
    e.stopPropagation(); e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ id: m.id, ms: m.ms });
  };
  const moveDrag = (e: React.PointerEvent, m: Marker) => {
    if (!drag || drag.id !== m.id) return;
    const ms = Math.max(m.min ?? 0, Math.min(m.max ?? spanMs, msAt(e.clientX)));
    setDrag({ id: m.id, ms });
    onMarkerMove?.(m.id, ms);
  };
  const endDrag = (m: Marker) => {
    if (!drag || drag.id !== m.id) return;
    onMarkerCommit?.(m.id, Math.round(drag.ms), "drag");
    setDrag(null);
  };

  // a flag that would cover the one before it (Entry and Exit close together on short audio) goes a row lower. A
  // flag's width is guessed from its label, on the generous side: too generous only stacks two that would just fit.
  const flagRows = new Map<string, number>();
  let flagEnd = -Infinity, flagRow = 0;
  for (const m of [...markers].sort((a, b) => a.ms - b.ms)) {
    const ms = drag?.id === m.id ? drag.ms : m.ms;
    const left = x(ms), w = 14 + (m.label.length + (drag?.id === m.id ? 7 : 0)) * 8;
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
          <span>Couldn't read this audio{onRetry && <>. <button className="link-inline" onClick={onRetry}>Try again</button></>}</span>
        </span>
      ) : !peaks && label && <span className="wave-empty">{label}</span>}
      {/* moved by a transform: it moves on every frame of playback, and a transform needs no layout or paint */}
      {playheadMs != null && <div className="playhead" style={{ transform: `translateX(${x(playheadMs)}px)` }} />}
      {markers.map((m) => {
        const ms = drag?.id === m.id ? drag.ms : m.ms;
        const left = x(ms), row = flagRows.get(m.id) ?? 0;
        return (
          <div key={m.id} className={`marker${m.draggable ? " draggable" : ""}${drag?.id === m.id ? " dragging" : ""}${left > width - 90 ? " flip" : ""}`}
            style={{ left }} role={m.draggable ? "slider" : undefined} tabIndex={m.draggable ? 0 : undefined}
            aria-label={m.label} aria-valuenow={m.draggable ? Math.round(ms) : undefined} data-tip={drag ? undefined : `${m.label} at ${fmtTime(ms)}`} data-tip-side="top"
            onPointerDown={(e) => startDrag(e, m)} onPointerMove={(e) => moveDrag(e, m)} onPointerUp={() => endDrag(m)}
            onKeyDown={(e) => {
              if (!m.draggable) return;
              const step = (e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0) * (e.shiftKey ? 100 : 10);
              if (!step) return;
              e.preventDefault(); e.stopPropagation();
              const from = nudged.current[m.id] ?? ms;
              const to = Math.max(m.min ?? 0, Math.min(m.max ?? spanMs, Math.round(from + step)));
              nudged.current[m.id] = to;
              onMarkerCommit?.(m.id, to, "key");
            }}>
            <span className="marker-flag" style={row ? { top: `calc(${row} * (16px * var(--fs) + 1px))` } : undefined}>
              {m.label}{drag?.id === m.id ? ` ${fmtTime(ms)}` : ""}</span>
          </div>
        );
      })}
    </div>
  );
}
