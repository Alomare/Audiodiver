import { useEffect, useRef, useState } from "react";
import { call, fileUrl, fmtTime } from "./api";
import { PauseIcon, ThroughIcon } from "./Icons";
import { player, usePlayer } from "./player";
import { useEditor } from "./store";

/** One clip of a play-through: `source` plays from `offset_ms` of its audio for `length_ms`, starting `at_ms` into the
    play-through. `mine`: it is the new audio, not the original. */
export type Clip = { source: string; mine: boolean; at_ms: number; offset_ms: number; length_ms: number };
/** A segment of a play-through: where its Entry and Exit fall, and the clips it plays. */
export type Mark = { segment: string; ms: number; exit_ms: number; name: string; clips: Clip[] };
export type Through = { key: string; side: "game" | "mine"; url: string; duration_ms: number; marks: Mark[]; random: boolean };

/** The play-through the player has, kept outside the component: it goes on playing while something else is open,
    and coming back to its cue finds it again, bar, marks and all. */
let loaded: Through | null = null;

/** Where a play-through is in one slot's audio: the position in that audio (ms), or null while the slot isn't
    playing. A clip the game stretches past the end of its audio loops it, so the position wraps at `lengthMs`. */
export function throughHead(t: Through, nowMs: number, source: string, mine: boolean, lengthMs?: number): number | null {
  for (let i = t.marks.length - 1; i >= 0; i--) {
    for (const c of t.marks[i].clips) {
      if (c.source !== source || c.mine !== mine || nowMs < c.at_ms || nowMs >= c.at_ms + c.length_ms) continue;
      const pos = c.offset_ms + (nowMs - c.at_ms);
      return lengthMs && pos > lengthMs ? pos % lengthMs : pos;
    }
  }
  return null;
}

/** Where in a play-through a spot of one slot's audio plays: the time (ms) nearest to now, or null when this
    play-through doesn't play that spot. For seeking by clicking the slot's waveform. */
export function throughSeek(t: Through, nowMs: number, source: string, mine: boolean, posMs: number): number | null {
  let best: number | null = null;
  for (const m of t.marks) for (const c of m.clips) {
    if (c.source !== source || c.mine !== mine || posMs < c.offset_ms || posMs > c.offset_ms + c.length_ms) continue;
    const at = c.at_ms + (posMs - c.offset_ms);
    if (best === null || Math.abs(at - nowMs) < Math.abs(best - nowMs)) best = at;
  }
  return best;
}

/** Plays the whole cue the way the game would: segments in order, handing over at their Exit points. "Replaced" is
    the cue as the project changes it, so hand-overs can be checked without launching the game; the Library only has
    the original. `onThrough` hears which play-through is playing (null when none is), `onMark` the segment it is on. */
export function PlayThrough({ onThrough, onMark }: { onThrough?: (t: Through | null) => void; onMark?: (m: Mark | null) => void }) {
  const { cue, project, revision, notify, quick, scope, readOnly, shownItemId } = useEditor();
  const p = usePlayer();
  const [busy, setBusy] = useState<null | "game" | "mine">(null);
  const key = (side: string) => `through:${scope}:${cue?.id}:${side}`;
  const [t, setT] = useState<Through | null>(() => (loaded && player.state.key === loaded.key && (loaded.key === key("game") || loaded.key === key("mine")) ? loaded : null));

  // an edit to this cue's replacements (audio, gain, timing, cue points) makes the render of the replaced version
  // stale: it stops, and says so. The original stays as it is.
  const mine = !project || !cue ? "" : JSON.stringify([revision, cue.slots.map((s) => project.assignments[s] ?? null),
    cue.segments_detail.map((s) => project.segment_overrides[s.segment] ?? null)]);
  const rendered = useRef(mine);
  useEffect(() => {
    if (rendered.current === mine) return;
    rendered.current = mine;
    if (t?.side !== "mine") return;
    if (player.state.key === t.key) { player.stop(); quick("Play through stopped because this cue changed", "info"); }
    setT(null);
  }, [mine, t, quick]);

  // tell the slot list and the waveforms what plays, and which segment it is on, so they can follow along
  const active = t && p.key === t.key ? t : null;
  const ms = active ? p.time * 1000 : 0;
  let now: Mark | null = null; // the last segment whose Entry has passed
  for (const m of active?.marks ?? []) if (m.ms <= ms + 1) now = m;
  useEffect(() => { onThrough?.(active); }, [active, onThrough]);
  useEffect(() => { onMark?.(now); }, [now, onMark]);
  useEffect(() => () => { onThrough?.(null); onMark?.(null); }, [onThrough, onMark]);

  if (!cue) return null;
  const changed = !readOnly && !!project && (cue.slots.some((s) => project.assignments[s]) || cue.segments_detail.some((s) => project.segment_overrides[s.segment]));

  const start = async (side: "game" | "mine") => {
    if (t?.side === side && p.key === t.key) { player.play(t.key, t.url); return; } // pause / resume
    setBusy(side);
    try {
      const r = await call<Omit<Through, "side" | "url" | "key"> & { path: string }>("play_through", { cue: cue.id, side });
      const next = { ...r, side, key: key(side), url: `${fileUrl(r.path)}&v=${Date.now()}` };
      loaded = next;
      setT(next);
      player.stop();
      player.play(next.key, next.url, false, `Play through · ${cue.name} · ${side === "game" ? "original" : "replaced"}`,
        { scope, itemId: shownItemId, cueId: cue.id, source: null });
    } catch (e: any) { notify("bad", e.message ?? String(e)); }
    setBusy(null);
  };

  const button = (side: "game" | "mine") => {
    const on = active?.side === side && p.playing;
    const name = side === "mine" ? "Play through · Replaced" : readOnly ? "Play through" : "Play through · Original";
    const about = busy === side ? "Preparing…" : side === "mine" ? changed ? "The cue as the mod plays it" : "Nothing replaced in this cue yet"
      : `The cue as the game plays it, segment by segment${t?.random ? ". The game shuffles parts of this cue" : ""}`;
    return (
      <button className={`play ${side === "game" ? "vanilla" : "project"} through-btn${on ? " playing" : ""}`} disabled={busy !== null || (side === "mine" && !changed)}
        aria-label={on ? `Pause ${name}` : name} data-tip={on ? `Pause ${name}` : name} data-tip-more={about} onClick={() => start(side)}
        style={{ ["--progress" as any]: active?.side === side ? ms / active.duration_ms : 0 }}>
        {busy === side ? <span aria-hidden>…</span> : on ? <PauseIcon /> : <ThroughIcon />}
      </button>
    );
  };

  return (
    <>
      <div className="through-btns" role="group" aria-label="Play through">{button("game")}{!readOnly && button("mine")}</div>
      {active ? (
        <div className="through">
          <div className={`through-bar ${active.side}`} role="slider" aria-label="Position in the cue" aria-valuemin={0}
            aria-valuemax={Math.round(active.duration_ms / 1000)} aria-valuenow={Math.round(ms / 1000)} tabIndex={0}
            onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); player.seek((e.clientX - r.left) / r.width); }}
            onKeyDown={(e) => {
              const d = e.key === "ArrowRight" ? 5000 : e.key === "ArrowLeft" ? -5000 : 0;
              if (d) { e.preventDefault(); e.stopPropagation(); player.seek(Math.max(0, Math.min(1, (ms + d) / active.duration_ms))); }
            }}>
            <div className="through-fill" style={{ width: `${(ms / active.duration_ms) * 100}%` }} />
            {active.marks.map((m, i) => <span key={i} className="through-tick" style={{ left: `${(m.ms / active.duration_ms) * 100}%` }} />)}
          </div>
          <span className="through-now"><b>{now?.name ?? "Lead-in"}</b> {fmtTime(ms)} / {fmtTime(active.duration_ms)}</span>
        </div>
      ) : null}
    </>
  );
}
