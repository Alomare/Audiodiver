import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { keyLabel, type CommandId } from "./keys";
import { settings, TIP_DELAY } from "./settings";

/** Hover tooltips for the whole app, from one layer mounted once. An element gets one by carrying attributes:

      data-tip="Build the mod"     the text; an empty value shows nothing
      data-tip-cmd="build"         a command whose key is shown next to the text, whatever it is bound to now
      data-tip-side="right"        where it goes when there is room: bottom (default), top, right or left
      data-tip-clip                only when the element's own text is cut off (a name that didn't fit)
      data-tip-more="…"            a second, fainter line: what a click does besides (a "?" opening the Wiki)

    One shows after the pointer rests (Settings ▸ System sets how long, or turns them off), at once when another was
    just showing, and on keyboard focus. Pressing, typing or scrolling hides it. */
type Side = "bottom" | "top" | "right" | "left";
type Tip = { anchor: HTMLElement; text: string; keys: string; more: string; side: Side; x: number };

const GAP = 7;       // between the element and its tooltip
const EDGE = 6;      // kept clear along the window's edges
const WARM_MS = 500; // moving on to another element within this time skips the wait
const WIDE = 360;    // an element wider than this gets its tooltip under the pointer, not under its middle

function read(anchor: HTMLElement, x: number): Tip | null {
  const text = anchor.dataset.tip?.trim();
  if (!text) return null;
  if (anchor.dataset.tipClip !== undefined && anchor.scrollWidth <= anchor.clientWidth) return null;
  const cmd = anchor.dataset.tipCmd as CommandId | undefined;
  const side = anchor.dataset.tipSide as Side | undefined;
  return { anchor, text, keys: cmd ? keyLabel(cmd) : "", more: anchor.dataset.tipMore ?? "", side: side ?? "bottom", x };
}

export function TooltipLayer() {
  const [tip, setTip] = useState<Tip | null>(null);
  const [place, setPlace] = useState<{ left: number; top: number; side: Side } | null>(null);
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let anchor: HTMLElement | null = null; // what the pointer or the focus is on, shown or not
    let described: HTMLElement | null = null; // the element that names the tooltip as its description meanwhile
    let shown = false, timer = 0, lastShown = 0, x = 0;
    const hide = () => {
      clearTimeout(timer);
      if (!shown) return;
      shown = false;
      lastShown = performance.now();
      described?.removeAttribute("aria-describedby");
      described = null;
      setTip(null);
      setPlace(null);
    };
    const show = () => {
      const t = anchor?.isConnected ? read(anchor, x) : null;
      if (!t) return;
      shown = true;
      setPlace(null);
      setTip(t);
      if (!t.anchor.hasAttribute("aria-describedby")) { t.anchor.setAttribute("aria-describedby", "tooltip"); described = t.anchor; }
    };
    /** The pointer or the focus moved onto `next` (or onto nothing). */
    const enter = (next: HTMLElement | null, wait: number) => {
      if (next === anchor) return;
      const warm = shown || performance.now() - lastShown < WARM_MS;
      hide();
      anchor = next;
      const speed = settings.get().tips;
      // tooltips off leaves the "?"s: they are there only to hold their words (data-tip-always)
      if (!next || (speed === "off" && !next.hasAttribute("data-tip-always"))) return;
      timer = window.setTimeout(show, warm ? 60 : Math.min(wait, TIP_DELAY[speed === "off" ? "normal" : speed]));
    };
    /** The nearest element around what the event is on that has a tooltip to show now: a name that isn't cut off
        has none, so the row around it gets its turn. */
    const target = (e: Event) => {
      let t = e.target instanceof Element ? (e.target.closest("[data-tip]") as HTMLElement | null) : null;
      while (t && !read(t, x)) t = (t.parentElement?.closest("[data-tip]") as HTMLElement | undefined) ?? null;
      return t;
    };

    const over = (e: PointerEvent) => { if (e.pointerType !== "touch" && !e.buttons) { x = e.clientX; enter(target(e), Infinity); } };
    const move = (e: PointerEvent) => { x = e.clientX; };
    const gone = () => enter(null, 0);
    // pressing, typing or scrolling: the tooltip goes, and stays away until the pointer moves on to something else
    const quiet = () => hide();
    const focus = (e: FocusEvent) => {
      const t = e.target instanceof HTMLElement && e.target.matches(":focus-visible") ? target(e) : null;
      if (t) { x = t.getBoundingClientRect().left + t.offsetWidth / 2; enter(t, 300); }
    };
    // the element went away or changed under a resting pointer (a list refreshed, Play became Pause)
    const watch = window.setInterval(() => {
      if (!shown) return;
      if (!anchor?.isConnected) return enter(null, 0);
      const now = read(anchor, x);
      if (!now) hide();
      else setTip((t) => (t && (t.text !== now.text || t.keys !== now.keys) ? now : t));
    }, 250);

    document.addEventListener("pointerover", over);
    document.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", gone);
    document.addEventListener("pointerdown", quiet, true);
    document.addEventListener("keydown", quiet, true);
    document.addEventListener("wheel", quiet, { capture: true, passive: true });
    document.addEventListener("focusin", focus);
    document.addEventListener("focusout", gone);
    window.addEventListener("blur", gone);
    return () => {
      clearTimeout(timer); clearInterval(watch);
      document.removeEventListener("pointerover", over);
      document.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", gone);
      document.removeEventListener("pointerdown", quiet, true);
      document.removeEventListener("keydown", quiet, true);
      document.removeEventListener("wheel", quiet, true);
      document.removeEventListener("focusin", focus);
      document.removeEventListener("focusout", gone);
      window.removeEventListener("blur", gone);
    };
  }, []);

  // once it has a size: next to its element, flipped to the other side or pulled in where the window ends
  useLayoutEffect(() => {
    if (!tip || !el.current) return;
    const a = tip.anchor.getBoundingClientRect(), t = el.current.getBoundingClientRect();
    const W = window.innerWidth, H = window.innerHeight;
    const clamp = (v: number, max: number) => Math.max(EDGE, Math.min(v, max - EDGE));
    let side = tip.side;
    if (side === "right" && a.right + GAP + t.width > W - EDGE) side = a.left - GAP - t.width >= EDGE ? "left" : "bottom";
    else if (side === "left" && a.left - GAP - t.width < EDGE) side = a.right + GAP + t.width <= W - EDGE ? "right" : "bottom";
    if (side === "bottom" && a.bottom + GAP + t.height > H - EDGE && a.top - GAP - t.height >= EDGE) side = "top";
    else if (side === "top" && a.top - GAP - t.height < EDGE) side = "bottom";
    const middle = a.width > WIDE ? tip.x : a.left + a.width / 2;
    setPlace(side === "bottom" || side === "top"
      ? { side, left: clamp(middle - t.width / 2, W - t.width), top: side === "bottom" ? a.bottom + GAP : a.top - GAP - t.height }
      : { side, top: clamp(a.top + a.height / 2 - t.height / 2, H - t.height), left: side === "right" ? a.right + GAP : a.left - GAP - t.width });
  }, [tip]);

  if (!tip) return null;
  return (
    <div ref={el} id="tooltip" role="tooltip" className={`tooltip${place ? ` ${place.side} in` : ""}`}
      style={place ? { left: Math.round(place.left), top: Math.round(place.top) } : { left: 0, top: 0, visibility: "hidden" }}>
      <span>{tip.text}</span>
      {tip.keys && <kbd>{tip.keys}</kbd>}
      {tip.more && <small className="tip-more">{tip.more}</small>}
    </div>
  );
}
