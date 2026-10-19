// The app's dialogs (About, the update question, Export, the export list, the slice tool): the newest one open takes
// Esc and keeps the keyboard inside it; one opening takes the focus itself (not its first button, so a key pressed at
// that moment presses nothing), and one closing gives the focus back to where it was.
import { useEffect, useRef } from "react";

type Open = { el: () => HTMLElement | null; close: () => void };
const open: Open[] = [];
const FOCUSABLE = 'button, [href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';

window.addEventListener("keydown", (e) => {
  // the newest dialog on screen: one left open in a tab that is hidden now (a "?" in it opened the Wiki) waits
  const top = [...open].reverse().find((d) => d.el()?.getClientRects().length);
  if (!top || document.querySelector("[role=menu]")) return; // a menu over the dialog closes first, on its own
  const el = top.el();
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopImmediatePropagation();
    top.close();
  } else if (e.key === "Tab" && el) {
    const all = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => !x.matches(":disabled") && x.offsetParent !== null);
    if (!all.length) { e.preventDefault(); el.focus(); return; }
    const at = all.indexOf(document.activeElement as HTMLElement);
    if (e.shiftKey && at <= 0) { e.preventDefault(); all[all.length - 1].focus(); }
    else if (!e.shiftKey && (at === all.length - 1 || at < 0)) { e.preventDefault(); all[0].focus(); }
  }
}, true); // before the rest of the app hears the key

/** Makes the element the ref goes on (the dialog's box, with tabIndex={-1}) a dialog, while the component is
    mounted: Esc calls onClose. */
export function useDialog<T extends HTMLElement = HTMLDivElement>(onClose: () => void) {
  const ref = useRef<T>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const me: Open = { el: () => ref.current, close: () => close.current() };
    open.push(me);
    ref.current?.focus({ preventScroll: true });
    return () => {
      open.splice(open.indexOf(me), 1);
      if (before?.isConnected && !open.length) before.focus({ preventScroll: true });
    };
  }, []);
  return ref;
}
