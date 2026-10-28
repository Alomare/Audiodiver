import { useEffect, useRef, useState } from "react";
import { t } from "@lingui/core/macro";
import { RESET_LAYOUT } from "./settings";
import { DEFAULT_SIZE, useThemeValue } from "./theme";

/** A height the user chose by dragging, remembered between sessions; null means "fit the content". "Reset panel
    sizes" (Settings ▸ System) puts it back to `initial`. */
export function useStoredHeight(key: string, initial: number | null) {
  const [h, setH] = useState<number | null>(() => {
    try {
      const v = localStorage.getItem(key);
      return v === null ? initial : v === "auto" ? null : Number(v) || initial;
    } catch { return initial; }
  });
  useEffect(() => { try { localStorage.setItem(key, h === null ? "auto" : String(h)); } catch { /* storage off */ } }, [key, h]);
  useEffect(() => {
    const reset = () => setH(initial);
    window.addEventListener(RESET_LAYOUT, reset);
    return () => window.removeEventListener(RESET_LAYOUT, reset);
  }, [initial]);
  return [h, setH] as const;
}

/** The width of a side panel, chosen by dragging its splitter and remembered between sessions. */
export function useStoredWidth(key: string, initial: number) {
  const [w, setW] = useState(() => {
    try { return Number(localStorage.getItem(key)) || initial; } catch { return initial; }
  });
  useEffect(() => { try { localStorage.setItem(key, String(w)); } catch { /* storage off */ } }, [key, w]);
  useEffect(() => {
    const reset = () => setW(initial);
    window.addEventListener(RESET_LAYOUT, reset);
    return () => window.removeEventListener(RESET_LAYOUT, reset);
  }, [initial]);
  return [w, setW] as const;
}

/** Drag to resize the side panel next to it; double-click resets it. `panel` says which side the panel is on. The
    width is in pixels at the default text size, or with `fraction` the panel's share of its parent (0 to 1), which
    keeps the proportion when the window changes size. */
export function Splitter({ width, onResize, initial, panel, label, cssVar, fraction }: {
  width: number; onResize: (w: number) => void; initial: number; panel: "left" | "right"; label: string;
  cssVar?: string; // the custom property on the parent that holds the width (default --left or --right)
  fraction?: boolean;
}) {
  const [active, setActive] = useState(false);
  const start = useRef({ x: 0, w: 0, box: 0 });
  const el = useRef<HTMLDivElement>(null);
  const drag = useRef({ frame: 0, w: null as number | null });
  const scale = useThemeValue((t) => t.size) / DEFAULT_SIZE; // panels are drawn at width x text scale
  const boxWidth = () => el.current?.parentElement?.clientWidth ?? window.innerWidth;
  // pixels moved, in the width's unit
  const unit = (px: number, box: number) => (fraction ? px / box : px / scale);
  // at least 200 px, and as wide as the panes allow while the middle keeps its 360 px (styles.css .panes has the same
  // limit, so a panel dragged wide on a big window shrinks with a smaller one instead of pushing the middle out)
  const clamp = (w: number, box: number) => fraction
    ? Math.max(200 / box, Math.min(Math.round(w * 1000) / 1000, (box - 380) / box))
    : Math.max(200, Math.min(Math.round(w), Math.floor((box - 380) / scale)));
  const sign = panel === "left" ? 1 : -1;
  // while it drags, the width goes straight to the parent's custom property, once a frame; the app learns it when the
  // drag ends. Re-rendering the whole window on every move made a drag crawl on slow PCs.
  const show = (w: number) => {
    drag.current.w = w;
    if (drag.current.frame) return;
    drag.current.frame = requestAnimationFrame(() => {
      drag.current.frame = 0;
      el.current?.parentElement?.style.setProperty(cssVar ?? (panel === "left" ? "--left" : "--right"),
        fraction ? String(drag.current.w) : `${drag.current.w}px`);
    });
  };
  const end = () => {
    setActive(false);
    cancelAnimationFrame(drag.current.frame);
    drag.current.frame = 0;
    if (drag.current.w != null) onResize(drag.current.w);
    drag.current.w = null;
  };
  return (
    <div ref={el} className={`splitter${active ? " active" : ""}`} role="separator" aria-orientation="vertical" tabIndex={0} aria-label={label}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); start.current = { x: e.clientX, w: width, box: boxWidth() }; setActive(true); }}
      onPointerMove={(e) => {
        const { x, w, box } = start.current;
        if (active) show(clamp(w + sign * unit(e.clientX - x, box), box));
      }}
      onPointerUp={end} onPointerCancel={end}
      onDoubleClick={() => onResize(initial)}
      onKeyDown={(e) => {
        const step = e.key === "ArrowLeft" ? -16 : e.key === "ArrowRight" ? 16 : 0;
        const box = boxWidth();
        if (step) { e.preventDefault(); e.stopPropagation(); onResize(clamp(width + sign * (fraction ? step / box : step), box)); }
      }} />
  );
}

/** A drag handle along the top or bottom edge of its parent panel, to change the panel's height. Arrow keys move it
    too; double-click resets it. The parent must be position: relative and must not scroll (the handle would scroll
    with it). */
export function ResizeEdge({ edge, label, min, max, onResize, onReset }: {
  edge: "top" | "bottom"; label: string; min: number;
  max: () => number;                // the tallest the panel may get now (it depends on the window)
  onResize: (h: number) => void; onReset: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const start = useRef({ y: 0, h: 0 });
  const [active, setActive] = useState(false);
  const height = () => ref.current!.parentElement!.getBoundingClientRect().height;
  const clamp = (h: number) => Math.round(Math.max(min, Math.min(Math.max(min, max()), h)));
  const sign = edge === "bottom" ? 1 : -1;
  return (
    <div ref={ref} className={`resize-edge ${edge}${active ? " active" : ""}`} role="separator" aria-orientation="horizontal"
      tabIndex={0} aria-label={label} data-tip={t`${label}. Double-click to reset.`}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = { y: e.clientY, h: height() };
        setActive(true);
      }}
      onPointerMove={(e) => { if (active) onResize(clamp(start.current.h + sign * (e.clientY - start.current.y))); }}
      onPointerUp={() => setActive(false)} onPointerCancel={() => setActive(false)}
      onDoubleClick={onReset}
      onKeyDown={(e) => {
        const step = e.key === "ArrowUp" ? -16 : e.key === "ArrowDown" ? 16 : 0;
        if (step) { e.preventDefault(); e.stopPropagation(); onResize(clamp(height() + sign * step)); }
      }} />
  );
}
