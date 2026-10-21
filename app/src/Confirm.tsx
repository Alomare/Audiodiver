import { useSyncExternalStore } from "react";
import { useDialog } from "./dialog";

/** A question before a change that loses work (removing new audio, or a piece of music with its new audio): the
    action waits for `confirm(...)`, which resolves true for the confirming button. Enter confirms, Esc keeps.
    `choose(...)` asks the same way with a second way to go ahead (`alt`, beside `ok`): it resolves "ok", "alt" or
    null for Cancel. */
type Answer = "ok" | "alt" | null;
type Ask = { title: string; text: string; ok: string; alt?: string; cancel?: string; resolve: (a: Answer) => void };

let asking: Ask | null = null;
const listeners = new Set<() => void>();
const set = (a: Ask | null) => { asking = a; listeners.forEach((f) => f()); };

export function choose(q: Omit<Ask, "resolve">): Promise<Answer> {
  asking?.resolve(null); // one question at a time: a newer one stands in for the old
  return new Promise((resolve) => set({ ...q, resolve }));
}

export async function confirm(q: Omit<Ask, "resolve" | "alt">): Promise<boolean> {
  return (await choose(q)) === "ok";
}

export function ConfirmDialog() {
  const a = useSyncExternalStore((f) => { listeners.add(f); return () => { listeners.delete(f); }; }, () => asking);
  return a ? <ConfirmBox key={a.title + a.text} a={a} /> : null;
}

function ConfirmBox({ a }: { a: Ask }) {
  const answer = (x: Answer) => { if (asking === a) set(null); a.resolve(x); };
  const box = useDialog(() => answer(null));
  return (
    <div className="modal-back" onPointerDown={(e) => { if (e.target === e.currentTarget) answer(null); }}>
      <div className="modal narrow confirm" role="alertdialog" aria-modal="true" aria-label={a.title} ref={box} tabIndex={-1}
        onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget) { e.preventDefault(); answer("ok"); } }}>
        <h2>{a.title}</h2>
        <p>{a.text}</p>
        <div className="modal-foot">
          <button className="btn primary" onClick={() => answer("ok")}>{a.ok}</button>
          {a.alt && <button className="btn" onClick={() => answer("alt")}>{a.alt}</button>}
          <span className="spacer" />
          <button className="btn quiet" onClick={() => answer(null)}>{a.cancel ?? "Cancel"}</button>
        </div>
      </div>
    </div>
  );
}
