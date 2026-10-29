import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { andList, call } from "./api";
import { confirm } from "./Confirm";
import { UTILS } from "./edition";
import { parse, Markdown } from "./Markdown";
import { nav, useNav } from "./nav";
import { reveal, startAudioPickerIn } from "./platform";
import { useEditor } from "./store";
import { CatMark } from "./Tags";
import { motionOn, useTheme } from "./theme";
import { markOffered, TUTORIALS, unoffered, type Tutorial, type TutorialKit, type TutorialState } from "./tutorials";

/** The Wiki's page of interactive tutorials (not a Markdown page): Wiki.tsx shows TutorialsPage for it. */
export const TUTORIALS_PAGE = "tutorials";

// ---- the tutorial that runs, if one does: which, and at which step (-1 while it sets up)

type Run = { id: string; step: number } | null;
let running: Run = null;
const listeners = new Set<() => void>();
const set = (next: Run) => { running = next; listeners.forEach((f) => f()); };
const useRun = () => useSyncExternalStore((f) => { listeners.add(f); return () => { listeners.delete(f); }; }, () => running);

/** Starts a tutorial (from the tutorials page). TutorialLayer sets it up and shows its steps. */
export function startTutorial(id: string) {
  if (!running) set({ id, step: -1 });
}
/** Asks before a tutorial ends early (the panel's Stop Tutorial). */
async function askStop() {
  if (await confirm({ title: t`End tutorial?`, text: t`You can start it again any time in the Wiki.`, ok: t`End Tutorial`, cancel: t`Keep Going` })) set(null);
}

const PAD = 6;      // the hole's margin around what it shows
const GAP = 14;     // between what a step points at and the panel
const EDGE = 12;    // the panel keeps this far from the window's edges

type Box = { left: number; top: number; right: number; bottom: number };
/** The box around some elements, with the margin, inside the window; null when none shows. */
function around(els: Element[], vw: number, vh: number): Box | null {
  const rects = els.map((e) => e.getBoundingClientRect()).filter((r) => r.width || r.height);
  if (!rects.length) return null;
  return {
    left: Math.max(0, Math.min(...rects.map((r) => r.left)) - PAD), top: Math.max(0, Math.min(...rects.map((r) => r.top)) - PAD),
    right: Math.min(vw, Math.max(...rects.map((r) => r.right)) + PAD), bottom: Math.min(vh, Math.max(...rects.map((r) => r.bottom)) + PAD),
  };
}
const list = (t: Element | Element[] | null | undefined) => (!t ? [] : Array.isArray(t) ? t : [t]);

/** The running tutorial over the window: everything dark but the part the step is about, with a pulsing outline in
    the primary colour, and beside it the panel with the step (in the primary colour until the pointer is first on it). A
    step to do takes clicks there (or in its wider `room`) and nowhere else, and is done when the app shows it done
    (its `done`), or with its button. A step to look takes no clicks and no keys outside the panel, its outline
    stands still, and Next goes on. */
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
  const editor = useRef(scopes.editor);
  editor.current = scopes.editor;
  const kit = useMemo<TutorialKit>(() => ({
    call: <T,>(method: string, params?: Record<string, unknown>) => call<T>(method, params),
    addToProject: actions.addToProject, assignAll: actions.assignAll, silence: actions.silence,
    newProjectAt: actions.newProjectAt, reveal: (path) => { reveal(path).catch(() => {}); },
    select: (sources) => editor.current.setSelected(sources), pickFrom: startAudioPickerIn,
  }), [actions]);
  useEffect(() => () => startAudioPickerIn(null), []); // the picker opens where it did before, once the tutorial ends
  // what the steps read, fresh on every check (the open items aren't React state here)
  const latest = useRef<() => TutorialState>(() => ({ tab, project, jobs, libraryItem: null, audioItem: null }));
  latest.current = () => ({ tab, project, jobs, libraryItem: scopes.library.itemId, audioItem: scopes.editor.itemId });
  const [working, setWorking] = useState(false);
  // the step the pointer was on the panel in: the panel keeps the plain colours until the next step. Moving, not
  // entering, counts, so a step that starts under the pointer (after Next) is seen too.
  const [seenAt, setSeenAt] = useState(-1);
  const seen = seenAt === at;
  const step = at >= 0 ? tutorial.steps[at] : undefined;
  const look = !!step?.look;
  const nextLabel = step?.next ?? (look ? t({ message: "Next", context: "tutorial step", comment: "The button that goes on to the next step of a tutorial" }) : undefined);

  // setting up, then each step as it comes
  useEffect(() => {
    let live = true;
    if (at < 0) {
      (tutorial.start ? tutorial.start(kit) : Promise.resolve(true))
        .then((ok) => { if (live) set(ok ? { id: tutorial.id, step: 0 } : null); })
        .catch((e) => { const error = String(e.message ?? e); notify("bad", t`The tutorial couldn't start: ${error}`); set(null); });
      return () => { live = false; };
    }
    try { Promise.resolve(step?.enter?.(kit, latest.current())).catch(() => {}); } catch { /* the step still shows */ }
    return () => { live = false; };
  }, [at]); // eslint-disable-line react-hooks/exhaustive-deps

  // a step that works in one tab: when something in its room led to another (a link in the details panel, a crumb),
  // back to it, or the dark would cover the way back
  useEffect(() => {
    if (!step?.tab || tab === step.tab) return;
    nav.go(step.tab);
    quick(t`Back to the tutorial step`, "info");
  }, [tab, step]); // eslint-disable-line react-hooks/exhaustive-deps

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
    else { set(null); quick(t`Tutorial finished`, "info"); }
  };
  const act = async () => {
    if (!step?.action || working) return;
    setWorking(true);
    try { await step.action.run(kit, latest.current()); }
    catch (e) { notify("bad", (e as Error).message ?? String(e)); }
    finally { setWorking(false); }
  };

  // a step to look: the keys stay with the panel (Next has the focus), except in a dialog over it (Stop Tutorial's)
  const nextBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!look) return;
    nextBtn.current?.focus();
    const hold = (e: KeyboardEvent) => {
      if (e.key === "Tab" || panel.current?.contains(e.target as Node) || document.querySelector(".modal-back")) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    window.addEventListener("keydown", hold, true);
    return () => window.removeEventListener("keydown", hold, true);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // the hole, the ring and the panel follow the target as it moves (a list that scrolls, a window that resizes),
  // written straight to the page each frame rather than through React
  const mask = useRef<HTMLDivElement>(null), ring = useRef<HTMLDivElement>(null), panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0, lastLook = 0, aim: Element[] = [], room: Element[] = [];
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (now - lastLook > 200 || [...aim, ...room].some((e) => !e.isConnected)) { // looked for again now and then: lists redraw
        lastLook = now;
        aim = list(step?.target?.());
        room = step?.room ? list(step.room()) : aim;
      }
      const vw = window.innerWidth, vh = window.innerHeight;
      const target = around(aim, vw, vh), hole = around(room, vw, vh) ?? target;
      if (mask.current) {
        mask.current.style.clipPath = hole
          ? `polygon(evenodd, 0 0, ${vw}px 0, ${vw}px ${vh}px, 0 ${vh}px, 0 0, ${hole.left}px ${hole.top}px, ${hole.left}px ${hole.bottom}px, ${hole.right}px ${hole.bottom}px, ${hole.right}px ${hole.top}px, ${hole.left}px ${hole.top}px)`
          : "none";
      }
      if (ring.current) {
        ring.current.style.display = target ? "block" : "none";
        if (target) Object.assign(ring.current.style, { left: `${target.left}px`, top: `${target.top}px`, width: `${target.right - target.left}px`, height: `${target.bottom - target.top}px` });
      }
      const p = panel.current;
      if (p) {
        const w = p.offsetWidth, h = p.offsetHeight;
        let x = (vw - w) / 2, y = (vh - h) / 2; // in the middle when the step points nowhere
        if (target && target.bottom + GAP + h <= vh - EDGE) [x, y] = [target.left, target.bottom + GAP];   // below
        else if (target && target.top - GAP - h >= EDGE) [x, y] = [target.left, target.top - GAP - h];     // above
        else if (target) [x, y] = [target.right + GAP + w <= vw - EDGE ? target.right + GAP : target.left - GAP - w, target.top]; // beside
        p.style.transform = `translate(${Math.round(Math.max(EDGE, Math.min(vw - w - EDGE, x)))}px, ${Math.round(Math.max(EDGE, Math.min(vh - h - EDGE, y)))}px)`;
      }
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [step]);

  const busy = step?.busy?.(latest.current()) ?? null;
  const doc = useMemo(() => (step ? parse(step.text) : null), [step]);
  const stepNumber = at + 1, stepCount = tutorial.steps.length;
  return (
    <div className={`tut${motionOn(theme) ? " moving" : ""}${look ? " look" : ""}`}>
      <div className="tut-mask" ref={mask} aria-hidden />
      {look && <div className="tut-block" aria-hidden />}
      <div className="tut-ring" ref={ring} aria-hidden />
      <div className={`tut-panel${seen ? " seen" : ""}`} ref={panel} role="dialog" aria-live="polite" aria-label={tutorial.title}
        onPointerMove={() => { if (!seen) setSeenAt(at); }}>
        {!step ? <p className="tut-wait"><Trans>Making the practice project</Trans></p> : (
          <>
            <div className="tut-top">
              <span className="tut-count"><Trans>Step {stepNumber} of {stepCount}</Trans></span>
              <button className="tut-stop" onClick={askStop}><Trans>Stop Tutorial</Trans></button>
            </div>
            <h3>{step.title}</h3>
            {doc && <div className="tut-text"><Markdown tokens={doc.tokens} /></div>}
            {busy && <p className="tut-wait">{busy}</p>}
            {(step.action || nextLabel) && (
              <div className="tut-btns">
                {step.action && <button className="btn tut-act" onClick={act} disabled={working}>{step.action.label}</button>}
                {nextLabel && <button className="btn tut-next" ref={nextBtn} onClick={next}>{nextLabel}</button>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** The first time Audiodiver starts, and after an update that brings new tutorials: an announcement in the corner,
    once, that opens the tutorials page when clicked anywhere. `blocked`: another question is on screen (the update
    prompt); the announcement waits for it. */
export function TutorialPrompt({ blocked }: { blocked: boolean }) {
  const { announce } = useEditor();
  const made = useRef(false);
  useEffect(() => {
    // not under automation (the walk, probes, the README's screenshots), where it would cover what they click
    if (UTILS || navigator.webdriver || blocked || made.current) return;
    const fresh = unoffered();
    if (!fresh.length) return;
    const timer = setTimeout(() => {
      made.current = true;
      markOffered(fresh.map((x) => x.id));
      const all = fresh.length === TUTORIALS.length, count = fresh.length, titles = andList(fresh.map((x) => x.title));
      announce(all ? t`Interactive tutorials` : plural(count, { one: "A new interactive tutorial", other: "New interactive tutorials" }),
        all ? t`Walkthroughs that show where to click, one step at a time.` : t({ message: `${titles}.`, comment: "The names of the new tutorials, as a list" }),
        { tab: "wiki", sub: TUTORIALS_PAGE },
        all ? t`Click here to see them in the Wiki.` : plural(count, { one: "Click here to see it in the Wiki.", other: "Click here to see them in the Wiki." }),
        t`Interactive Tutorials`);
    }, 1200);
    return () => clearTimeout(timer);
  }, [blocked]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** The Wiki's page of interactive tutorials: each walkthrough, what it teaches and how long it takes, to start. */
export function TutorialsPage() {
  const run = useRun();
  return (
    <article className="wiki-article view-in">
      <header className="page-head">
        <h1><Trans>Interactive Tutorials</Trans></h1>
        <p className="page-lead"><Trans>Walkthroughs that show where to click, one step at a time. Each one works in a new practice project, and the
          project that is open is saved and closed first.</Trans></p>
      </header>
      <div className="tut-cards">
        {TUTORIALS.map((tut) => (
          <section key={tut.id} className="tut-card">
            <h2><CatMark category={tut.category} />{tut.title}</h2>
            <p>{tut.summary}</p>
            <ul>{tut.teaches.map((x) => <li key={x}>{x}</li>)}</ul>
            <div className="tut-card-foot">
              <span className="tut-len">{plural({ minutes: tut.minutes }, { one: "About # minute", other: "About # minutes" })}</span>
              <button className="btn primary" disabled={!!run} onClick={() => startTutorial(tut.id)}
                data-tip={run ? t`A tutorial is running` : undefined}><Trans>Start Tutorial</Trans></button>
            </div>
          </section>
        ))}
      </div>
      <p className="tut-more"><Trans>More interactive tutorials may be added in the future.</Trans></p>
    </article>
  );
}
