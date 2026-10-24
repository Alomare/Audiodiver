import { useEffect, useState, type ReactNode } from "react";
import { nav } from "./nav";
import { useEditor } from "./store";

/** The frame the Project, Build and Settings tabs share: a page that scrolls, with one big title. */
export function Page({ title, lead, wide, children }: { title: string; lead?: ReactNode; wide?: boolean; children: ReactNode }) {
  return (
    <section className="page" aria-label={title}>
      <div className={`page-inner view-in${wide ? " wide" : ""}`}>
        <header className="page-head">
          <h1>{title}</h1>
          {lead && <p className="page-lead">{lead}</p>}
        </header>
        {children}
      </div>
    </section>
  );
}

/** Arrow keys along a tablist (← → across, ↑ ↓ down a vertical one, Home and End): the next tab takes the focus and
    opens, as tabs do. The key goes no further (the slot list's ↑ ↓ stay with the list). */
export function tabArrows(e: React.KeyboardEvent<HTMLElement>) {
  const vertical = e.currentTarget.getAttribute("aria-orientation") === "vertical";
  const [prev, next] = vertical ? ["ArrowUp", "ArrowDown"] : ["ArrowLeft", "ArrowRight"];
  if (![prev, next, "Home", "End"].includes(e.key) || e.altKey || e.ctrlKey) return;
  const tabs = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]:not(:disabled)')];
  const at = tabs.indexOf(document.activeElement as HTMLElement);
  if (at < 0) return;
  e.preventDefault();
  const to = e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : (at + (e.key === next ? 1 : -1) + tabs.length) % tabs.length;
  tabs[to].focus();
  tabs[to].click();
}

/** What Build's This project page shows while no project is open, and the Project tab too (which has the recent
    projects under it, so no way to them). */
export function NoProjectCard({ text, recent = true }: { text: string; recent?: boolean }) {
  const { actions } = useEditor();
  return (
    <div className="empty-card">
      <h2>No project is open</h2>
      <p>{text}</p>
      <div className="row-btns">
        <button className="btn primary" onClick={actions.newProject}>New project…</button>
        <button className="btn" onClick={() => actions.openProject()}>Open project…</button>
        {recent && <button className="btn quiet" onClick={() => nav.go("project")}>Recent projects</button>}
      </div>
    </div>
  );
}

/** Text being edited in a field. It follows `saved` whenever that changes (an undo, another project), and keeps
    what is typed in between. */
export function useDraft(saved: string) {
  const [text, setText] = useState(saved);
  useEffect(() => setText(saved), [saved]);
  return [text, setText] as const;
}
