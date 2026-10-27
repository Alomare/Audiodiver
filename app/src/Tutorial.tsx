import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { call } from "./api";
import { confirm } from "./Confirm";
import { useDialog } from "./dialog";
import { UTILS } from "./edition";
import { parse, Markdown } from "./Markdown";
import { nav, useNav } from "./nav";
import { reveal } from "./platform";
import { useEditor } from "./store";
import { motionOn, useTheme } from "./theme";
import { markOffered, TUTORIALS, unoffered, type Tutorial, type TutorialKit, type TutorialState } from "./tutorials";

/** The Wiki's page of tutorials (not a Markdown page): Wiki.tsx shows TutorialsPage for it. */
export const TUTORIALS_PAGE = "tutorials";

// ---- the tutorial that runs, if one does: which, and at which step (-1 while it sets up)

type Run = { id: string; step: number } | null;
let running: Run = null;
const listeners = new Set<() => void>();
const set = (next: Run) => { running = next; listeners.forEach((f) => f()); };
const useRun = () => useSyncExternalStore((f) => { listeners.add(f); return () => { listeners.delete(f); }; }, () => running);

/** Starts a tutorial (from the Tutorials page). TutorialLayer sets it up and shows its steps. */
export function startTutorial(id: string) {
  if (!running) set({ id, step: -1 });
}
/** Asks before a tutorial ends early (the panel's Stop Tutorial). */
async function askStop() {
  if (await confirm({ title: "End tutorial?", text: "You can start it again any time in the Wiki.", ok: "End Tutorial", cancel: "Keep Going" })) set(null);
}

const PAD = 6;      // the hole's margin around what it shows
const GAP = 14;     // between the hole and the panel
const EDGE = 12;    // the panel keeps this far from the window's edges

/** The running tutorial over the window: everything dark but the part the step is about, which takes clicks and has
    a pulsing outline in the primary colour, and beside it the panel with the step (in the primary colour until the
    pointer is on it). The dark takes every other click. A step is done when the app shows it done (its `done`), or
    with its button. */
export function TutorialLayer() {
  const run = useRun();
  const tutorial = run ? TUTORIALS.find((t) => t.id === run.id) : undefined;
  if (!run || !tutorial) return null;
  return <Steps key={run.id} tutorial={tutorial} at={run.step} />;
}

function Steps({ tutorial, at }: { tutorial: Tutorial; at: number }) {
  const { project, jobs, scopes, actions, notify, quick } = useEditor();
  const { tab } = useNav();
  const theme = useTheme();
  const kit = useMemo<TutorialKit>(() => ({
    call: <T,>(method: string, params?: Record<string, unknown>) => call<T>(method, params),
    addToProject: actions.addToProject, assignAll: actions.assignAll, silence: actions.silence,
    newProjectAt: actions.newProjectAt, reveal: (path) => { reveal(path).catch(() => {}); },
  }), [actions]);
  // what the steps read, fresh on every check (the open items aren't React state here)
  const latest = useRef<() => TutorialState>(() => ({ tab, project, jobs, libraryItem: null, audioItem: null }));
  latest.current = () => ({ tab, project, jobs, libraryItem: scopes.library.itemId, audioItem: scopes.editor.itemId });
  const [working, setWorking] = useState(false);
  const step = at >= 0 ? tutorial.steps[at] : undefined;

  // setting up, then each step as it comes
  useEffect(() => {
    let live = true;
    if (at < 0) {
      (tutorial.start ? tutorial.start(kit) : Promise.resolve(true))
        .then((ok) => { if (live) set(ok ? { id: tutorial.id, step: 0 } : null); })
        .catch((e) => { notify("bad", `The tutorial couldn't start: ${e.message ?? e}`); set(null); });
      return () => { live = false; };
    }
    try { step?.enter?.(kit, latest.current()); } catch { /* the step still shows */ }
    return () => { live = false; };
  }, [at]); // eslint-disable-line react-hooks/exhaustive-deps

  // on to the next step once the app shows this one done
  useEffect(() => {
    if (!step?.done) return;
    const id = setInterval(() => {
      if (step.done!(latest.current())) {
        clearInterval(id);
        next();
      }
    }, 250);
    return () => clearInterval(id);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps
  const next = () => {
    if (!running || running.id !== tutorial.id) return;
    if (at + 1 < tutorial.steps.length) set({ id: tutorial.id, step: at + 1 });
    else { set(null); quick("Tutorial finished", "info"); }
  };
  const act = async () => {
    if (!step?.action || working) return;
    setWorking(true);
    try { await step.action.run(kit, latest.current()); }
    catch (e) { notify("bad", (e as Error).message ?? String(e)); }
    finally { setWorking(false); }
  };

  // the hole, the ring and the panel follow the target as it moves (a list that scrolls, a window that resizes),
  // written straight to the page each frame rather than through React
  const mask = useRef<HTMLDivElement>(null), ring = useRef<HTMLDivElement>(null), panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0, found: Element[] = [], lastLook = 0;
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (now - lastLook > 200 || found.some((e) => !e.isConnected)) { // looked for again now and then: lists redraw
        lastLook = now;
        const t = step?.target?.();
        found = !t ? [] : Array.isArray(t) ? t : [t];
      }
      const rects = found.map((e) => e.getBoundingClientRect()).filter((r) => r.width || r.height);
      const vw = window.innerWidth, vh = window.innerHeight;
      const hole = rects.length ? {
        left: Math.max(0, Math.min(...rects.map((r) => r.left)) - PAD), top: Math.max(0, Math.min(...rects.map((r) => r.top)) - PAD),
        right: Math.min(vw, Math.max(...rects.map((r) => r.right)) + PAD), bottom: Math.min(vh, Math.max(...rects.map((r) => r.bottom)) + PAD),
      } : null;
      if (mask.current) {
        mask.current.style.clipPath = hole
          ? `polygon(evenodd, 0 0, ${vw}px 0, ${vw}px ${vh}px, 0 ${vh}px, 0 0, ${hole.left}px ${hole.top}px, ${hole.left}px ${hole.bottom}px, ${hole.right}px ${hole.bottom}px, ${hole.right}px ${hole.top}px, ${hole.left}px ${hole.top}px)`
          : "none";
      }
      if (ring.current) {
        ring.current.style.display = hole ? "block" : "none";
        if (hole) Object.assign(ring.current.style, { left: `${hole.left}px`, top: `${hole.top}px`, width: `${hole.right - hole.left}px`, height: `${hole.bottom - hole.top}px` });
      }
      const p = panel.current;
      if (p) {
        const w = p.offsetWidth, h = p.offsetHeight;
        let x = (vw - w) / 2, y = (vh - h) / 2; // in the middle when the step points nowhere
        if (hole && hole.bottom + GAP + h <= vh - EDGE) [x, y] = [hole.left, hole.bottom + GAP];   // below
        else if (hole && hole.top - GAP - h >= EDGE) [x, y] = [hole.left, hole.top - GAP - h];     // above
        else if (hole) [x, y] = [hole.right + GAP + w <= vw - EDGE ? hole.right + GAP : hole.left - GAP - w, hole.top]; // beside
        p.style.transform = `translate(${Math.round(Math.max(EDGE, Math.min(vw - w - EDGE, x)))}px, ${Math.round(Math.max(EDGE, Math.min(vh - h - EDGE, y)))}px)`;
      }
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [step]);

  const busy = step?.busy?.(latest.current()) ?? null;
  const doc = useMemo(() => (step ? parse(step.text) : null), [step]);
  return (
    <div className={`tut${motionOn(theme) ? " moving" : ""}`}>
      <div className="tut-mask" ref={mask} aria-hidden />
      <div className="tut-ring" ref={ring} aria-hidden />
      <div className="tut-panel" ref={panel} role="dialog" aria-live="polite" aria-label={tutorial.title}>
        {!step ? <p className="tut-wait">Making the practice project</p> : (
          <>
            <div className="tut-top">
              <span className="tut-count">Step {at + 1} of {tutorial.steps.length}</span>
              <button className="tut-stop" onClick={askStop}>Stop Tutorial</button>
            </div>
            <h3>{step.title}</h3>
            {doc && <div className="tut-text"><Markdown tokens={doc.tokens} /></div>}
            {busy && <p className="tut-wait">{busy}</p>}
            {(step.action || step.next) && (
              <div className="tut-btns">
                {step.action && <button className="btn tut-act" onClick={act} disabled={working}>{step.action.label}</button>}
                {step.next && <button className="btn tut-next" onClick={next}>{step.next}</button>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** The first time Audiodiver starts, and after an update that brings new tutorials: an offer to see them, once.
    `blocked`: another question is on screen (the update prompt); the offer waits for it. */
export function TutorialPrompt({ blocked }: { blocked: boolean }) {
  const [list, setList] = useState<Tutorial[] | null>(null);
  useEffect(() => {
    // not under automation (the walk, probes, the README's screenshots), where it would cover what they click
    if (UTILS || navigator.webdriver || blocked || list) return;
    const fresh = unoffered();
    if (!fresh.length) return;
    const t = setTimeout(() => { markOffered(fresh.map((x) => x.id)); setList(fresh); }, 1200);
    return () => clearTimeout(t);
  }, [blocked]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!list) return null;
  return <Offer list={list} onClose={() => setList(null)} />;
}

function Offer({ list, onClose }: { list: Tutorial[]; onClose: () => void }) {
  const box = useDialog(onClose);
  const all = list.length === TUTORIALS.length;
  return (
    <div className="modal-back" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal tut-offer" role="dialog" aria-modal="true" aria-label="Tutorials" ref={box} tabIndex={-1}>
        <h2>{all ? "Tutorials" : list.length === 1 ? "A new tutorial" : "New tutorials"}</h2>
        <p className="set-note">Walkthroughs that show where to click, one step at a time.</p>
        <ul className="tut-offer-list">
          {list.map((t) => <li key={t.id}><b>{t.title}</b><span>{t.minutes} min</span></li>)}
        </ul>
        <div className="modal-foot">
          <span className="spacer" />
          <button className="btn quiet" onClick={onClose}>Start Using the App</button>
          <button className="btn primary" onClick={() => { onClose(); nav.go("wiki", TUTORIALS_PAGE); }}>Check Out Tutorials</button>
        </div>
      </div>
    </div>
  );
}

/** The Wiki's Tutorials page: each walkthrough, what it teaches and how long it takes, to start. */
export function TutorialsPage() {
  const run = useRun();
  return (
    <article className="wiki-article view-in">
      <header className="page-head">
        <h1>Tutorials</h1>
        <p className="page-lead">Walkthroughs that show where to click, one step at a time. Each one works in a new practice project, and the
          project that is open is saved and closed first.</p>
      </header>
      <div className="tut-cards">
        {TUTORIALS.map((t) => (
          <section key={t.id} className="tut-card">
            <h2>{t.title}</h2>
            <p>{t.summary}</p>
            <ul>{t.teaches.map((x) => <li key={x}>{x}</li>)}</ul>
            <div className="tut-card-foot">
              <span className="tut-len">About {t.minutes} minutes</span>
              <button className="btn primary" disabled={!!run} onClick={() => startTutorial(t.id)}
                data-tip={run ? "A tutorial is running" : undefined}>Start Tutorial</button>
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
