import { useSyncExternalStore } from "react";
import { useDialog } from "./dialog";

/** A question before a change that loses work (removing new audio, or a piece of music with its new audio): the
    action waits for `confirm(...)`, which resolves true for the confirming button. Enter confirms, Esc keeps. */
type Ask = { title: string; text: string; ok: string; cancel?: string; resolve: (yes: boolean) => void };

let asking: Ask | null = null;
const listeners = new Set<() => void>();
const set = (a: Ask | null) => { asking = a; listeners.forEach((f) => f()); };

export function confirm(q: Omit<Ask, "resolve">): Promise<boolean> {
  asking?.resolve(false); // one question at a time: a newer one stands in for the old
  return new Promise((resolve) => set({ ...q, resolve }));
}

export function ConfirmDialog() {
  const a = useSyncExternalStore((f) => { listeners.add(f); return () => { listeners.delete(f); }; }, () => asking);
  return a ? <ConfirmBox key={a.title + a.text} a={a} /> : null;
}

function ConfirmBox({ a }: { a: Ask }) {
  const answer = (yes: boolean) => { if (asking === a) set(null); a.resolve(yes); };
  const box = useDialog(() => answer(false));
  return (
    <div className="modal-back" onPointerDown={(e) => { if (e.target === e.currentTarget) answer(false); }}>
      <div className="modal narrow confirm" role="alertdialog" aria-modal="true" aria-label={a.title} ref={box} tabIndex={-1}
        onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget) { e.preventDefault(); answer(true); } }}>
        <h2>{a.title}</h2>
        <p>{a.text}</p>
        <div className="modal-foot">
          <button className="btn primary" onClick={() => answer(true)}>{a.ok}</button>
          <span className="spacer" />
          <button className="btn quiet" onClick={() => answer(false)}>{a.cancel ?? "Cancel"}</button>
        </div>
      </div>
    </div>
  );
}
