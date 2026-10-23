import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";

/** A line of a long list: its key, and its kind (a group's line, a slot, a take). A line not measured yet counts as
    the average of its kind. */
export type WindowLine = { key: string; kind: string };
/** How reveal() brings a line into view; `hidden`: only when none of it is on screen. */
export type Reveal = { block?: ScrollLogicalPosition; behavior?: ScrollBehavior; hidden?: boolean };

const STEP = 400;  // px: the drawn window moves when the view has moved on this far
const OVER = 600;  // px drawn beyond the view on either side: a held key or a wheel tick finds its lines there
const GUESS = 34;  // px: a line of a kind nothing has measured yet (the rows' contain-intrinsic-size)
// each kind's average height over every line measured, in any list: the next list opened starts from it
const kinds = new Map<string, { sum: number; n: number }>();
const guess = (kind: string) => { const k = kinds.get(kind); return k ? k.sum / k.n : GUESS; };

/** Which lines of a long list to draw, when the lines differ in height (a group's line, a slot, a take whose text
    wraps): those in view and OVER either side, between two spacers that take the room of the rest, so the scrollbar
    is the list's own. Each drawn line is measured by a ResizeObserver (which reads sizes after a layout instead of
    making one) and keeps its height by its key. Off, every line is drawn and nothing is measured.
    `gap.top` and `gap.end` go on the two spacers, with the lines from `first` to `last` between them, one element each.
    `find` gives a drawn line's element; reveal() scrolls to a line, drawn yet or not. */
export function useListWindow(box: RefObject<HTMLElement | null>, lines: readonly WindowLine[], on: boolean,
  find: (key: string) => Element | null | undefined) {
  const heights = useRef(new Map<string, number>());
  const [measured, setMeasured] = useState(0); // counts the measures that changed a height
  const [view, setView] = useState({ top: 0, height: 2 * STEP });

  // where each line starts, the drawn ones as measured and the rest as their kind's average
  const offsets = useMemo(() => {
    const o = new Float64Array(lines.length + 1);
    if (!on) return o;
    const avg = new Map<string, number>();
    lines.forEach((l, i) => {
      let h = heights.current.get(l.key);
      if (h === undefined) { h = avg.get(l.kind); if (h === undefined) avg.set(l.kind, h = guess(l.kind)); }
      o[i + 1] = o[i] + h;
    });
    return o;
  }, [on, lines, measured]); // eslint-disable-line react-hooks/exhaustive-deps
  const n = lines.length;
  const first = on ? lineAt(offsets, view.top - OVER) : 0;
  const last = on ? Math.min(n, lineAt(offsets, view.top + view.height + STEP + OVER) + 1) : n;

  // the view, in steps of STEP: scrolling within one draws nothing new
  useEffect(() => {
    const el = box.current;
    if (!on || !el) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      if (!el.clientHeight) return; // behind another tab: the window stays as it was
      const top = Math.floor(el.scrollTop / STEP) * STEP, height = Math.ceil(el.clientHeight / STEP) * STEP;
      setView((v) => (v.top === top && v.height === height ? v : { top, height }));
    };
    const later = () => { if (!frame) frame = requestAnimationFrame(read); };
    read();
    el.addEventListener("scroll", later, { passive: true });
    const seen = new ResizeObserver(later);
    seen.observe(el);
    return () => { cancelAnimationFrame(frame); el.removeEventListener("scroll", later); seen.disconnect(); };
  }, [box, on]);

  // the drawn lines, measured once laid out and again when their size changes (a wider panel, new audio on a slot).
  // A line's height runs from its top to the next one's, so the margins between them count.
  const gapTop = useRef<HTMLDivElement>(null), gapEnd = useRef<HTMLDivElement>(null);
  const drawn = useRef<{ lines: readonly WindowLine[]; els: Element[]; end: Element } | null>(null);
  const sizes = useRef<ResizeObserver | null>(null);
  useLayoutEffect(() => {
    sizes.current ??= new ResizeObserver(() => {
      const d = drawn.current;
      if (!d || !box.current?.clientHeight || !d.end.isConnected) return;
      const tops = [...d.els, d.end].map((x) => x.getBoundingClientRect().top);
      let changed = false;
      d.lines.forEach((l, i) => {
        const h = tops[i + 1] - tops[i], old = heights.current.get(l.key);
        if (old !== undefined && (Math.abs(h - old) < 0.5 || i === d.lines.length - 1)) return; // the last one has no margin under it
        if (Math.abs(h - (old ?? guess(l.kind))) >= 0.5) changed = true;
        const k = kinds.get(l.kind) ?? { sum: 0, n: 0 };
        kinds.set(l.kind, { sum: k.sum - (old ?? 0) + h, n: k.n + (old === undefined ? 1 : 0) });
        heights.current.set(l.key, h);
      });
      if (changed) setMeasured((m) => m + 1);
    });
    const ro = sizes.current;
    ro.disconnect();
    drawn.current = null;
    if (!on || !gapTop.current || !gapEnd.current) return;
    const els: Element[] = [];
    for (let x = gapTop.current.nextElementSibling; x && x !== gapEnd.current; x = x.nextElementSibling) els.push(x);
    if (els.length !== last - first) return;
    drawn.current = { lines: lines.slice(first, last), els, end: gapEnd.current };
    for (const x of els) ro.observe(x);
  }, [on, first, last, lines]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => sizes.current?.disconnect(), []);

  // a line to bring into view: at once when it is drawn; else the list scrolls to where it should be, and the next
  // commit (the window drawing it there, or a group opening to show it) puts it in view exactly
  const pending = useRef<{ key: string; how: Reveal; until: number } | null>(null);
  const latest = useRef({ lines, offsets, on, find });
  latest.current = { lines, offsets, on, find };
  const settle = () => {
    const p = pending.current, el = box.current, { lines: ls, offsets: o, on: windowed, find: drawnEl } = latest.current;
    if (!p || !el) return;
    const row = drawnEl(p.key);
    if (row) {
      pending.current = null;
      if (p.how.hidden) {
        const a = el.getBoundingClientRect(), b = row.getBoundingClientRect();
        if (b.bottom > a.top && b.top < a.bottom) return; // some of it shows
      }
      row.scrollIntoView({ block: p.how.block ?? "nearest", behavior: p.how.behavior ?? "auto" });
      return;
    }
    if (performance.now() > p.until) { pending.current = null; return; }
    const i = windowed ? ls.findIndex((l) => l.key === p.key) : -1;
    if (i < 0) return; // not in the list yet: its group may be opening
    const h = o[i + 1] - o[i]; // where it should be: in the middle, or at the edge it comes in from
    el.scrollTop = p.how.block === "center" ? o[i] - (el.clientHeight - h) / 2 : o[i] > el.scrollTop ? o[i] + h - el.clientHeight : o[i];
  };
  useLayoutEffect(() => { if (pending.current) settle(); });
  const reveal = (key: string, how: Reveal = {}) => {
    pending.current = { key, how, until: performance.now() + 1500 };
    settle();
  };

  return { first, last, before: offsets[first], after: offsets[n] - offsets[last], gap: { top: gapTop, end: gapEnd }, reveal };
}

/** The line at `y` px down the list: the last one that starts at or above it. */
function lineAt(offsets: Float64Array, y: number) {
  let lo = 0, hi = Math.max(0, offsets.length - 2);
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (offsets[mid] <= y) lo = mid; else hi = mid - 1;
  }
  return lo;
}
