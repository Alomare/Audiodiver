import { useEffect, useLayoutEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react";
import { motionMs } from "./theme";

/** A section that opens by growing from nothing and closes by shrinking back, pushing what is below it along
    instead of making it jump. While it closes it keeps its content, then lets it go, so long lists aren't kept
    rendered while hidden. `instant` opens and closes at once (search results, which change on every key).
    Only a change of `open` moves: a section that is open when it first shows, or when its tab comes back, is
    simply there. */
export function Fold({ open, instant, className, children, ...rest }: {
  open: boolean; instant?: boolean; className?: string; children: ReactNode;
} & HTMLAttributes<HTMLDivElement>) {
  const [kept, setKept] = useState(open);   // in the page at all
  const [grown, setGrown] = useState(open); // at its full height; false while it is shut
  const el = useRef<HTMLDivElement>(null);
  if (open && !kept) { setKept(true); if (instant) setGrown(true); } // opening renders the content at once, shut
  if (!open && grown) setGrown(false);
  useLayoutEffect(() => {
    if (!open || grown) return;
    el.current?.getBoundingClientRect(); // the browser has now laid it out shut, so it grows from there
    setGrown(true);
  }, [open, grown]);
  useEffect(() => {
    if (open || !kept) return;
    const t = setTimeout(() => setKept(false), instant ? 0 : motionMs(160) + 40);
    return () => clearTimeout(t);
  }, [open, kept, instant]);
  if (!kept) return null;
  return (
    <div {...rest} ref={el} className={`fold${grown ? "" : " shut"}${instant ? " instant" : ""}${className ? ` ${className}` : ""}`} inert={!open}>
      {children}
    </div>
  );
}

/** The last value `value` had while `keep` was true: what a folding-away section goes on showing while it closes
    (a banner whose count just dropped to 0 still says what it said). */
export function useLastWhile<T>(value: T, keep: boolean): T {
  const [last, setLast] = useState(value);
  if (keep && last !== value) setLast(value);
  return keep ? value : last;
}

/** True during the render in which `on` turns off as well as while it is on: what a search opened closes as
    abruptly as it opened once the search is cleared. */
export function useLinger(on: boolean): boolean {
  const was = useRef(on);
  useEffect(() => { was.current = on; });
  return on || was.current;
}
