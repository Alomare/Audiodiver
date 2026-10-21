import { useEffect, useState } from "react";
import { call, isMusic, type Cue } from "./api";
import { useDialog } from "./dialog";
import { rowsOf } from "./CueView";
import { addedNote, exportList, useExportList } from "./exportList";
import { pickFolder } from "./platform";
import { useEditor } from "./store";
import { Help } from "./Wiki";

export type SwitchGroup = { group: string; name: string; values: { value: string; name: string }[] };
export type ExportOptions = {
  music: boolean; // a piece of music: it has segments to mix and plays through. A bank's sounds export one by one
  groups: SwitchGroup[]; random: boolean; playlist: boolean; segments: number;
};
type What = "slots" | "segments" | "cue";
type Whose = "game" | "mine" | "both";

const FOLDER_KEY = "audiodiver.exportFolder";
const PREFS_KEY = "audiodiver.exportPrefs";
const WHAT: { id: What; title: string; text: string }[] = [
  { id: "slots", title: "Each slot", text: "Each slot's audio as a separate, unchanged file" },
  { id: "segments", title: "Each segment", text: "Every segment mixed as the game plays it, layers together" },
  { id: "cue", title: "The whole cue", text: "One track with the segments in play order, handing over at their Exit points" },
];
const FORMATS = [
  { id: "wav", name: "WAV (24-bit)" }, { id: "flac", name: "FLAC (lossless, smaller)" },
  { id: "mp3", name: "MP3 320 kbps" }, { id: "mp3-vbr", name: "MP3 VBR (best quality, smaller)" },
];
/** Which audio an export takes: the original, the replacement (where there is one), or both. */
const SIDES = [["game", "Original"], ["mine", "Replaced"], ["both", "Both"]] as const;
const REFERENCE_ONLY = "Exports of the original are for reference and mod work. Don't upload them.";

function prefs(): { what?: What; fmt?: string; tails?: boolean } {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}"); } catch { return {}; }
}

/** What the open cue is called where it was opened: the Index's name for it (its item, and the part when the item
    has several) and the path to it, "Before the Drop - Loadout Selection", for the files' names. The core's own name
    for the cue when the Index has none. */
function useExportName() {
  const { itemId, itemIndex } = useEditor();
  return (cue: Cue) => {
    const it = itemId ? itemIndex.items.get(itemId) : undefined;
    const part = it?.parts.find((x) => x.cue === cue.id);
    if (!it || !part) return { name: cue.name, title: undefined };
    const name = it.parts.length > 1 && part.name ? `${it.full} · ${part.name}` : it.full;
    const section = itemIndex.section.get(it.id)?.name;
    return { name, title: [section && section !== it.full ? section : "", name].filter(Boolean).join(" - ") };
  };
}

/** The Export… button: the export form in a dialog, for the cue or the bank that is open in this tab. */
export function ExportDialog({ onClose }: { onClose: () => void }) {
  const { cue } = useEditor();
  const named = useExportName();
  const box = useDialog(onClose);
  if (!cue) return null;
  return (
    <div className="modal-back" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal narrow" role="dialog" aria-modal="true" aria-label="Export audio" ref={box} tabIndex={-1}>
        <div className="pop-head">
          <h2>Export {named(cue).name}</h2>
          <button className="x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <ExportForm onDone={onClose} onCancel={onClose} />
      </div>
    </div>
  );
}

/** The export list (from the status bar): what was collected from anywhere in the Library and the Editor, exported
    together as one job, every slot's own audio, in a folder per entry. */
export function ExportListDialog({ onClose }: { onClose: () => void }) {
  const list = useExportList();
  const { project, actions } = useEditor();
  const [whose, setWhose] = useState<Whose>("game");
  const [fmt, setFmt] = useState(prefs().fmt ?? "wav");
  const [apart, setApart] = useState(true);
  const [folder, setFolder] = useState<string>(() => { try { return localStorage.getItem(FOLDER_KEY) ?? ""; } catch { return ""; } });
  const box = useDialog(onClose);
  const side: Whose = project ? whose : "game";
  const slots = list.reduce((n, e) => n + e.count, 0);
  const submit = async () => {
    const dest = folder || (await pickFolder(project?.folder)) || "";
    if (!dest) return;
    if (!(await actions.exportList({ entries: list.map(({ cue, sources, name }) => ({ cue, sources, name })), folder: dest, whose: side, fmt, apart }))) return;
    setFolder(dest); // kept only once the core took it: a refused folder isn't offered again
    try { localStorage.setItem(FOLDER_KEY, dest); } catch { /* storage off */ }
    onClose();
  };
  return (
    <div className="modal-back" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal narrow" role="dialog" aria-modal="true" aria-label="Export list" ref={box} tabIndex={-1}>
        <div className="pop-head">
          <h2>Export list</h2>
          <button className="x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {list.length ? (
          <ul className="xl-list">
            {list.map((e) => (
              <li key={e.id}>
                <input className="xl-name" defaultValue={e.name} aria-label="Folder name" data-tip="Folder name (click to rename)"
                  onBlur={(ev) => { const v = ev.target.value.trim(); if (v && v !== e.name) exportList.rename(e.id, v); }}
                  onKeyDown={(ev) => { if (ev.key === "Enter") ev.currentTarget.blur(); }} />
                <span className="xl-where">{e.where}{e.count ? ` · ${e.count} slot${e.count === 1 ? "" : "s"}` : ""}</span>
                <button className="x" onClick={() => exportList.remove(e.id)} aria-label={`Take ${e.name} off the list`} data-tip="Take off the list">✕</button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="set-note">The list is empty. Right-click slots, groups, Index entries or archives and choose <b>Add to the export list</b>.</p>
        )}
        <div className="export-grid">
          <div className="field">
            <span className="field-label">Audio <Help tip={REFERENCE_ONLY} page="sharing#rights" /></span>
            <div className="segmented" role="radiogroup" aria-label="Audio">
              {SIDES.map(([id, name]) => (
                <button key={id} role="radio" aria-checked={side === id} className={side === id ? "on" : ""} disabled={id !== "game" && !project}
                  onClick={() => setWhose(id)}>{name}</button>
              ))}
            </div>
            {!project && <small>Open a project to export the replaced audio.</small>}
          </div>
          <label className="field">
            <span className="field-label">Format</span>
            <select value={fmt} onChange={(e) => setFmt(e.target.value)}>
              {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </label>
        </div>
        <label className="check"><input type="checkbox" checked={apart} onChange={(e) => setApart(e.target.checked)} />
          <span>A folder for each <Help tip="When this is off, all files go into one folder and are named after where they come from." page="reading-the-screen#a-folder-for-each" /></span></label>
        <div className="field">
          <span className="field-label">Destination folder</span>
          <div className="folder-row">
            <span className={`folder${folder ? "" : " none"}`} data-tip={folder} data-tip-clip>{folder || "No folder chosen yet"}</span>
            <button className="btn" onClick={async () => { const f = await pickFolder(folder || project?.folder); if (f) setFolder(f); }}>Choose…</button>
          </div>
        </div>
        <div className="modal-foot">
          {list.length > 0 && <button className="btn quiet" onClick={() => exportList.clear()}>Clear the list</button>}
          <span className="spacer" />
          <button className="btn quiet" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!list.length} onClick={submit}>
            Export {list.length} {list.length === 1 ? "entry" : "entries"}{slots ? ` (${slots} slots)` : ""}</button>
        </div>
      </div>
    </div>
  );
}

/** Exports the open cue's audio: slots, mixed segments or the whole cue played through, the original or the
    replacement. A bank's sounds export one file each; the Library exports the original only. The form of the
    Export… dialog. */
export function ExportForm({ onDone, onCancel }: { onDone?: () => void; onCancel?: () => void }) {
  const { cue, project: open, selected, actions, notify, quick, readOnly } = useEditor();
  const named = useExportName();
  const project = readOnly ? null : open;
  const saved = prefs();
  const [options, setOptions] = useState<ExportOptions | null>(null);
  const [what, setWhat] = useState<What>(saved.what ?? "segments");
  const [whose, setWhose] = useState<Whose>("game");
  const [fmt, setFmt] = useState(saved.fmt ?? "wav");
  const [tails, setTails] = useState(saved.tails ?? true);
  const [onlySelected, setOnlySelected] = useState(selected.length > 1);
  const [variants, setVariants] = useState<Record<string, string>>({});
  const [allVariants, setAllVariants] = useState(false);
  const [loops, setLoops] = useState(1);
  const [folder, setFolder] = useState<string>(() => {
    try { return localStorage.getItem(FOLDER_KEY) ?? ""; } catch { return ""; }
  });

  useEffect(() => {
    if (cue) call<ExportOptions>("export_options", { cue: cue.id }).then(setOptions).catch((e) => notify("bad", e.message));
  }, [cue, notify]);

  if (!cue) return null;
  const music = isMusic(cue) && options?.music !== false;
  const kind: What = music ? what : "slots";
  const rows = rowsOf(cue.segments_detail).filter((r) => !r.slot.absent); // a sound with no audio isn't written
  const { name: shownName, title } = named(cue);
  const mine = project ? rows.filter((r) => project.assignments[r.slot.source]).length : 0;
  const moved = project ? cue.segments_detail.some((s) => project.segment_overrides[s.segment]) : false;
  const canMine = mine > 0 || (moved && kind !== "slots");
  const side: Whose = canMine ? whose : "game";
  const groups = kind === "slots" ? [] : options?.groups ?? [];
  const choose = async () => { const f = await pickFolder(folder || project?.folder); if (f) setFolder(f); };

  /** The open cue (or its selected slots) onto the export list: each slot's own audio, exported with the rest. */
  const toList = () => {
    const sources = onlySelected && selected.length > 1 ? rows.filter((r) => selected.includes(r.slot.source)).map((r) => r.slot.source) : [];
    const name = sources.length ? `${shownName} (${sources.length} slots)` : shownName;
    quick(addedNote(exportList.add([{ cue: cue.id, sources, name, where: cue.path.join(" ▸ "), count: sources.length || rows.length }]), 1), "add");
    onDone?.();
  };

  const submit = async () => {
    const dest = folder || (await pickFolder(project?.folder)) || "";
    if (!dest) return;
    const ok = await actions.exportAudio({
      cue: cue.id, folder: dest, what: kind, whose: side, fmt, tails, loops, variants, all_variants: allVariants, title,
      sources: onlySelected && kind !== "cue" && selected.length ? selected : null,
    });
    if (!ok) return; // refused (a file, not a folder): the dialog stays, and the folder isn't kept
    try {
      localStorage.setItem(FOLDER_KEY, dest);
      localStorage.setItem(PREFS_KEY, JSON.stringify({ what, fmt, tails })); // `what` is the choice for music: a bank doesn't change it
    } catch { /* storage off */ }
    setFolder(dest);
    onDone?.();
  };

  return (
    <>
        {music ? (
          <div className="field">
            <span className="field-label">Contents</span>
            <div className="cards" role="radiogroup" aria-label="Contents">
              {WHAT.map((w) => (
                <button key={w.id} role="radio" aria-checked={what === w.id} className={`card${what === w.id ? " on" : ""}`} onClick={() => setWhat(w.id)}
                  data-tip={w.text}>
                  <b>{w.title}</b>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="set-note">One file per sound, named by its group and take
            {onlySelected && selected.length > 1 ? `: the ${selected.length} selected.` : `: ${rows.length} file${rows.length === 1 ? "" : "s"}.`}</p>
        )}

        <div className="export-grid">
          <div className="field">
            <span className="field-label">Audio <Help tip={REFERENCE_ONLY} page="sharing#rights" /></span>
            <div className="segmented" role="radiogroup" aria-label="Audio">
              {SIDES.map(([id, name]) => (
                <button key={id} role="radio" aria-checked={side === id} className={side === id ? "on" : ""} disabled={id !== "game" && !canMine}
                  onClick={() => setWhose(id)} data-tip={id === "mine" && kind !== "slots" ? "As the mod plays it, with Make-Up Gain, timing and cue points" : undefined}>{name}</button>
              ))}
            </div>
            {(readOnly || !project || !canMine) && <small>{readOnly ? "The replaced audio exports from the Audio Editor." : !project ? "Open a project to export the replaced audio."
              : "Nothing replaced here yet."}</small>}
          </div>
          <label className="field">
            <span className="field-label">Format</span>
            <select value={fmt} onChange={(e) => setFmt(e.target.value)}>
              {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </label>
        </div>

        {(groups.length > 0 || kind !== "slots" || selected.length > 1) && (
          <div className="field export-more">
            {groups.map((g) => (
              <label key={g.group} className="inline">Variant ({g.name})
                <select disabled={allVariants} value={variants[g.group] ?? g.values[0].value}
                  onChange={(e) => setVariants({ ...variants, [g.group]: e.target.value })}>
                  {g.values.map((v) => <option key={v.value} value={v.value}>{v.name}</option>)}
                </select>
              </label>
            ))}
            {groups.length > 0 && (
              <label className="check"><input type="checkbox" checked={allVariants} onChange={(e) => setAllVariants(e.target.checked)} />
                <span>Every variant, one file each</span></label>
            )}
            {kind === "segments" && (
              <label className="check"><input type="checkbox" checked={tails} onChange={(e) => setTails(e.target.checked)} />
                <span>Lead-in and ring-out <Help tip="The audio before Entry and after Exit. When this is off, the pieces sit end to end without overlap." page="reading-the-screen#lead-in-and-ring-out" /></span></label>
            )}
            {kind === "cue" && options?.playlist && (
              <label className="inline">Play the repeating part
                <input type="number" min={1} max={8} value={loops} onChange={(e) => setLoops(Math.max(1, Math.min(8, Number(e.target.value) || 1)))} />
                time{loops === 1 ? "" : "s"}
              </label>
            )}
            {kind === "cue" && options?.random && <small>The game shuffles parts of this cue. The export plays them in their listed order.</small>}
            {kind !== "cue" && selected.length > 1 && (
              <label className="check"><input type="checkbox" checked={onlySelected} onChange={(e) => setOnlySelected(e.target.checked)} />
                <span>Only the {selected.length} selected slots</span></label>
            )}
          </div>
        )}

        <div className="field">
          <span className="field-label">Destination folder</span>
          <div className="folder-row">
            <span className={`folder${folder ? "" : " none"}`} data-tip={folder} data-tip-clip>{folder || "No folder chosen yet"}</span>
            <button className="btn" onClick={choose}>Choose…</button>
          </div>
        </div>

        <div className="modal-foot">
          <span className="spacer" />
          {onCancel && <button className="btn quiet" onClick={onCancel}>Cancel</button>}
          <button className="btn" onClick={toList} data-tip="Collect it with other things, to export together from the status bar">
            Add to the export list</button>
          <button className="btn primary" onClick={submit}>Export</button>
        </div>
    </>
  );
}
