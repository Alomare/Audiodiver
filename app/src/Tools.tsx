import { useEffect, useState, type ReactNode } from "react";
import { call, type Place } from "./api";
import type { CommandId } from "./keys";
import { HeaderIcon, SearchIcon, WavesIcon } from "./Icons";
import { where } from "./music";
import { RESET_LAYOUT } from "./settings";
import { useEditor } from "./store";

/** Whether a view's header and waveforms show (the Audio tab, the Library, the Soundtrack), kept between sessions.
    Reset panel sizes (Settings ▸ System) shows both again. */
export type Panels = { head: boolean; waves: boolean };
export function usePanels(view: string) {
  const key = `audiodiver.panels.${view}`;
  const [v, setV] = useState<Panels>(() => {
    try { const s = JSON.parse(localStorage.getItem(key) ?? "{}"); return { head: s.head !== false, waves: s.waves !== false }; }
    catch { return { head: true, waves: true }; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage off */ } }, [key, v]);
  useEffect(() => {
    const reset = () => setV({ head: true, waves: true });
    window.addEventListener(RESET_LAYOUT, reset);
    return () => window.removeEventListener(RESET_LAYOUT, reset);
  }, []);
  return [v, setV] as const;
}

/** The two buttons at the end of the toolbar that show or hide the header and the waveforms. `waves`: whether there
    is a waveform to show (one slot selected); without one the button waits. */
export function PanelToggles({ panels, set, waves }: { panels: Panels; set: (p: Panels) => void; waves: boolean }) {
  return (
    <div className="panel-toggles">
      <button className={`icon-btn${panels.head ? " on" : ""}`} aria-pressed={panels.head} aria-label="Header"
        onClick={() => set({ ...panels, head: !panels.head })} data-tip={panels.head ? "Hide the header" : "Show the header"}>
        <HeaderIcon on={panels.head} /></button>
      <button className={`icon-btn${panels.waves ? " on" : ""}`} aria-pressed={panels.waves} aria-label="Waveforms" disabled={!waves}
        onClick={() => set({ ...panels, waves: !panels.waves })}
        data-tip={!waves ? "Select a slot to see the waveforms" : panels.waves ? "Hide the waveforms" : "Show the waveforms"}>
        <WavesIcon on={panels.waves} /></button>
    </div>
  );
}

/** A button of the toolbar above the slots: an icon, with the tool's name and what it does in its tooltip. */
export function ToolButton({ icon, name, about, cmd, primary, disabled, onClick }: {
  icon: ReactNode; name: string; about?: string; cmd?: CommandId; primary?: boolean; disabled?: boolean; onClick: () => void;
}) {
  return (
    <button className={`tool-btn${primary ? " primary" : ""}`} disabled={disabled} onClick={onClick} aria-label={name}
      data-tip={name} data-tip-more={about} data-tip-cmd={cmd}>{icon}</button>
  );
}

/** The search box of the toolbar: it narrows the slots of what is open. */
export function SlotSearch({ value, onChange, sounds }: { value: string; onChange: (v: string) => void; sounds: boolean }) {
  const what = sounds ? "sounds" : "slots";
  return (
    <label className="slot-search">
      <SearchIcon />
      <input type="search" placeholder={`Search ${what}`} value={value} onChange={(e) => onChange(e.target.value)} aria-label={`Search ${what}`}
        data-tip={sounds ? "Name, words of a voice line, label, note, file name or ID" : "Name, label, note, file name or ID"} data-tip-side="top"
        onKeyDown={(e) => { if (e.key === "Escape") { if (value) onChange(""); else e.currentTarget.blur(); } }} />
    </label>
  );
}

type Named = Place & { label?: string };

/** Where else a search of the slots leads, when nothing here matches: an id or a community label, anywhere in the
    game. A place in the project opens in the Audio tab, any other in the Library. */
export function Elsewhere({ query, here }: { query: string; here: string }) {
  const { itemIndex, project, goTo } = useEditor();
  const [places, setPlaces] = useState<Named[] | null>(null);
  const q = query.trim();
  useEffect(() => {
    setPlaces(null);
    const numeric = /^\d{5,20}$/.test(q);
    if (!numeric && q.replace(/\s/g, "").length < 3) return;
    let live = true;
    const t = setTimeout(() => {
      call<Named[]>(numeric ? "find" : "find_text", { query: q })
        .then((p) => {
          if (!live) return;
          const found = p.filter((x) => x.item && x.cue !== here);
          const music = found.filter((x) => /^\d+$/.test(x.cue)); // a clip of music: its cues, not the banks that hold it
          setPlaces(music.length ? music : found);
        })
        .catch(() => live && setPlaces([]));
    }, 200);
    return () => { live = false; clearTimeout(t); };
  }, [q, here]);
  if (!places?.length) return null;
  // one line per piece and label: the first slot of several with the same label opens
  const lines: { at: Named; n: number }[] = [];
  for (const p of places) {
    const same = lines.find((l) => l.at.item === p.item && l.at.label === p.label && (p.label || l.at.cue === p.cue));
    if (same) same.n++; else lines.push({ at: p, n: 1 });
  }
  const listed = new Set(project?.library ?? []);
  const shown = lines.slice(0, 8);
  return (
    <div className="elsewhere">
      <p>Elsewhere</p>
      {shown.map(({ at: p, n }, i) => {
        const item = itemIndex.items.get(p.item!);
        const name = item ? where(itemIndex, item) : p.item!.startsWith("archive:") ? `Archive ${p.item!.slice(8)}` : p.item!;
        const inProject = !!item && listed.has(item.id);
        return (
          <button key={i} className="link-text" onClick={() => goTo({ scope: inProject ? "editor" : "library", itemId: p.item, cueId: p.cue, source: p.source })}
            data-tip={inProject ? "In the project" : "In the Library"}>
            {name}{p.label ? ` · ${p.label}` : ""}{n > 1 ? ` (${n} slots)` : ""}
          </button>
        );
      })}
      {lines.length > shown.length && <p className="slots-note">and {lines.length - shown.length} more</p>}
    </div>
  );
}
