import { useEffect, useMemo, useState } from "react";
import { call, isMusic, type Cue } from "./api";
import { rowsOf } from "./CueView";
import { useDialog } from "./dialog";
import { addedNote, exportList, useExportList, type ExportEntry, type NewEntry, type What, type Whose } from "./exportList";
import { FolderIcon } from "./Icons";
import { pickFolder } from "./platform";
import { useEditor } from "./store";
import { Help } from "./Wiki";

export type SwitchGroup = { group: string; name: string; values: { value: string; name: string }[] };
export type ExportOptions = {
  music: boolean; // a piece of music: it has segments to mix and plays through. A bank's sounds export one by one
  groups: SwitchGroup[]; random: boolean; playlist: boolean; segments: number;
};
/** Where the panel was opened. The Library exports the Original; the Audio tab and the Soundtrack also the audio as
    the mod plays it, and the Soundtrack a fight. */
export type ExportContext = "library" | "audio" | "soundtrack";
/** The open item, which the first tab exports: its cue, the name the tab shows, where it is in the Index, and the
    slots selected. `fight`: music the game plays in fights (the Soundtrack offers A Fight). */
export type ExportTarget = { context: ExportContext; cue: Cue; name: string; where: string; selected: string[]; fight?: boolean };

type Names = "full" | "short" | "ids";
type Scope = "selected" | "replaced" | "all";
type Prefs = { fmt: string; names: Names; apart: boolean; music: What; piece: What; tails: boolean; whose: Whose; minutes: number };
/** What the core writes for a list of entries (export_preview): the first files of each folder, and how many. */
type Preview = { folders: { name: string; files: string[]; total: number }[]; total: number };

const FOLDER_KEY = "audiodiver.exportFolder";
const PREFS_KEY = "audiodiver.exportPrefs";
const DEFAULTS: Prefs = { fmt: "wav", names: "full", apart: true, music: "segments", piece: "cue", tails: true, whose: "mod", minutes: 3 };
const CONTENTS: Record<What, { title: string; text: string }> = {
  slots: { title: "Each Slot", text: "Each slot as a separate file" },
  segments: { title: "Each Segment", text: "Each segment as one file, with the layers mixed" },
  cue: { title: "The Whole Piece", text: "One track with the segments in play order, joined at their Exit points" },
  fight: { title: "A Fight", text: "One track of a fight, with the segments the game picks as it plays" },
};
const FORMATS = [
  { id: "wav", name: "WAV (24-bit)" }, { id: "flac", name: "FLAC (lossless, smaller)" },
  { id: "mp3", name: "MP3 320 kbps" }, { id: "mp3-vbr", name: "MP3 VBR (best quality, smaller)" },
  { id: "wem", name: "WEM (unchanged from the game)" },
];
const VERSIONS: [Whose, string, string | undefined][] = [
  ["mod", "As the Mod Plays It", "New audio where a slot has some, the Original everywhere else"],
  ["game", "Original", undefined],
  ["both", "Both", "Two files where the mod changes something, named (original) and (replaced)"],
];
const NAMES: [Names, string, string][] = [
  ["full", "Full Names", "The item name, a number, then the sound or segment"],
  ["short", "Short Names", "A number, then the sound or segment"],
  ["ids", "Source IDs", "The source ID of each slot, as other modding tools name game audio"],
];
/** The same choices in a list's menus, where they read as words rather than buttons. */
const CONTENT_OPTION: Record<What, string> = { slots: "Each slot", segments: "Each segment", cue: "The whole piece", fight: "A fight" };
const REFERENCE_ONLY = "Exports of the original are for reference and mod work. Don't upload them.";
const MINUTES = [1, 10];
const isMusicCue = (cue: string) => /^\d+$/.test(cue);

function loadPrefs(): Prefs {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}");
    // before the Soundtrack had a choice of its own, `what` was the music's
    const music = ["slots", "segments", "cue"].includes(p.music ?? p.what) ? p.music ?? p.what : DEFAULTS.music;
    return { ...DEFAULTS, ...p, music };
  } catch { return DEFAULTS; }
}

/** What the open cue is called where it was opened: the Index's name for it (its item, and the part when the item
    has several), else the core's own name for the cue, and where the Index has it ("Weapons ▸ Primary Weapons"). */
export function useExportName() {
  const { itemId, itemIndex } = useEditor();
  return (cue: Cue) => {
    const it = itemId ? itemIndex.items.get(itemId) : undefined;
    const part = it?.parts.find((x) => x.cue === cue.id);
    if (!it || !part) return { name: cue.name, where: cue.path.join(" ▸ ") };
    const name = it.parts.length > 1 && part.name ? `${it.full} · ${part.name}` : it.full;
    const section = itemIndex.section.get(it.id)?.name, category = itemIndex.category.get(it.id)?.name;
    return { name, where: [category, section].filter(Boolean).join(" ▸ ") };
  };
}

/** The entry as the core takes it (editor.py, export_list). */
const spec = (e: NewEntry) => ({
  cue: e.cue, sources: e.sources, name: e.name, what: e.what ?? "slots", whose: e.whose ?? "game",
  tails: e.tails ?? true, loops: e.loops ?? 1, fight_ms: e.fight_ms, variants: e.variants ?? {}, all_variants: !!e.all_variants,
});

/** The Export panel, from the Export button of a toolbar (the Library, the Audio tab, the Soundtrack) or from the
    export list's button beside it. Two tabs: the open item (some or all of its slots, how its music is written, which
    audio) and the export list (what was collected from anywhere). Both share the format, the file names, the
    folders and the destination, and a preview shows the files they write before anything is written. */
export function ExportPanel({ target, start, onClose }: { target: ExportTarget | null; start: "item" | "list"; onClose: () => void }) {
  const list = useExportList();
  const { project, actions, quick } = useEditor();
  const box = useDialog(onClose);
  const [tab, setTab] = useState<"item" | "list">(target ? start : "list");
  const [prefs, setPrefs] = useState(loadPrefs);
  const pref = (patch: Partial<Prefs>) => setPrefs((p) => ({ ...p, ...patch }));
  const [folder, setFolder] = useState<string>(() => { try { return localStorage.getItem(FOLDER_KEY) ?? ""; } catch { return ""; } });
  const item = useItem(target, prefs, pref);
  const entries: NewEntry[] = tab === "item" ? (item.entry ? [item.entry] : []) : list;
  // WEM is the game's own file: only for the Original, slot by slot
  const wemOk = entries.length > 0 && entries.every((e) => (e.what ?? "slots") === "slots" && (e.whose ?? "game") === "game");
  const fmt = prefs.fmt === "wem" && !wemOk ? "wav" : prefs.fmt;
  const idsOk = entries.some((e) => (e.what ?? "slots") === "slots");
  const names = prefs.names === "ids" && !idsOk ? "full" : prefs.names;
  const preview = usePreview(entries, fmt, names, prefs.apart);

  const choose = async () => { const f = await pickFolder(folder || project?.folder); if (f) setFolder(f); };
  const keep = (dest: string) => {
    setFolder(dest); // kept only once the core took it: a refused folder isn't offered again
    try {
      localStorage.setItem(FOLDER_KEY, dest);
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch { /* storage off */ }
  };
  const submit = async () => {
    if (!entries.length) return;
    const dest = folder || (await pickFolder(project?.folder)) || "";
    if (!dest) return;
    if (!(await actions.exportList({ entries: entries.map(spec), folder: dest, fmt, names, apart: prefs.apart }))) return;
    keep(dest);
    onClose();
  };
  const toList = () => {
    if (!item.entry) return;
    quick(addedNote(exportList.add([item.entry]), 1), "add");
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* storage off */ }
    onClose();
  };
  const files = preview?.total ?? 0;

  return (
    <div className="modal-back" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal export" role="dialog" aria-modal="true" aria-label="Export" ref={box} tabIndex={-1}>
        <div className="pop-head">
          <h2>Export</h2>
          <button className="x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="xp-tabs" role="tablist" aria-label="What to export">
          {target && (
            <button role="tab" aria-selected={tab === "item"} className={tab === "item" ? "on" : ""} onClick={() => setTab("item")}
              data-tip={target.where || undefined}>{target.name}</button>
          )}
          <button role="tab" aria-selected={tab === "list"} className={tab === "list" ? "on" : ""} onClick={() => setTab("list")}
            data-tip="Things collected from anywhere, to export together">
            Export List{list.length > 0 && <span className="xp-count">{list.length}</span>}</button>
        </div>

        <div className="xp-body">
          <div className="xp-side">
            {tab === "item" ? item.form : <ListForm withMod={!!project} />}
            <div className="field">
              <span className="field-label">File names</span>
              <div className="segmented" role="radiogroup" aria-label="File names">
                {NAMES.map(([id, label, about]) => (
                  <button key={id} role="radio" aria-checked={names === id} className={names === id ? "on" : ""} disabled={id === "ids" && !idsOk}
                    onClick={() => pref({ names: id })} data-tip={id === "ids" && !idsOk ? "For Each Slot" : about}>{label}</button>
                ))}
              </div>
            </div>
            <label className="field xp-format">
              <span className="field-label">Format</span>
              <select value={fmt} onChange={(e) => pref({ fmt: e.target.value })}>
                {FORMATS.map((f) => <option key={f.id} value={f.id} disabled={f.id === "wem" && !wemOk}>{f.name}</option>)}
              </select>
            </label>
            <label className="check"><input type="checkbox" checked={prefs.apart} onChange={(e) => pref({ apart: e.target.checked })} />
              <span>A folder for each item <Help tip="When this is off, all files go into the destination folder." page="reading-the-screen#a-folder-for-each-item" /></span></label>
          </div>

          <div className="xp-out">
            <div className="field">
              <span className="field-label">Destination folder</span>
              <div className="folder-row">
                <span className={`folder${folder ? "" : " none"}`} data-tip={folder || undefined} data-tip-clip>{folder || "No folder chosen yet"}</span>
                <button className="btn" onClick={choose}>Choose</button>
              </div>
            </div>
            <Files preview={preview} apart={prefs.apart} folder={folder} empty={!entries.length} />
          </div>
        </div>

        <div className="modal-foot">
          {tab === "item" ? (
            <button className="btn" onClick={toList} disabled={!item.entry} data-tip="Collect it with other items to export together">Add to the Export List</button>
          ) : list.length > 0 && <button className="btn quiet" onClick={() => exportList.clear()}>Clear the List</button>}
          <span className="spacer" />
          <button className="btn quiet" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!entries.length || preview?.total === 0} onClick={submit}>
            {files ? `Export ${files} ${files === 1 ? "File" : "Files"}` : "Export"}</button>
        </div>
      </div>
    </div>
  );
}

/** The open item's half of the panel: the form, and the entry it makes. */
function useItem(target: ExportTarget | null, prefs: Prefs, pref: (p: Partial<Prefs>) => void) {
  const { project, notify } = useEditor();
  const [options, setOptions] = useState<ExportOptions | null>(null);
  const cue = target?.cue;
  useEffect(() => {
    if (cue) call<ExportOptions>("export_options", { cue: cue.id }).then(setOptions).catch((e) => notify("bad", e.message));
  }, [cue, notify]);
  const rows = useMemo(() => (cue ? rowsOf(cue.segments_detail).filter((r) => !r.slot.absent) : []), [cue]);
  const selected = useMemo(() => rows.filter((r) => target?.selected.includes(r.slot.source)).map((r) => r.slot.source), [rows, target]);
  const withMod = !!project && !!target && target.context !== "library";
  const replaced = useMemo(() => (withMod ? rows.filter((r) => project!.assignments[r.slot.source]).map((r) => r.slot.source) : []),
    [rows, withMod, project]);
  const [scope, setScope] = useState<Scope>(selected.length > 1 ? "selected" : "all");
  const [variants, setVariants] = useState<Record<string, string>>({});
  const [allVariants, setAllVariants] = useState(false);
  const [loops, setLoops] = useState(1);
  if (!target || !cue) return { entry: null, form: null };

  const soundtrack = target.context === "soundtrack";
  const music = isMusic(cue) && options?.music !== false;
  const kinds: What[] = !music ? ["slots"] : soundtrack
    ? ["cue", ...(options?.playlist && target.fight ? ["fight" as What] : []), "segments", "slots"] : ["slots", "segments", "cue"];
  const wanted = soundtrack ? prefs.piece : prefs.music;
  const kind: What = kinds.includes(wanted) ? wanted : kinds[0];
  const setKind = (w: What) => pref(soundtrack ? { piece: w } : { music: w });
  const whole = kind === "cue" || kind === "fight";
  const side: Whose = withMod ? prefs.whose : "game";
  const scopes: [Scope, string, number][] = whole ? [] : [
    ["selected", "Selected", selected.length],
    ...(withMod ? [["replaced", "Replaced", replaced.length] as [Scope, string, number]] : []),
    ["all", "All", rows.length],
  ];
  const usedScope: Scope = scopes.some(([s, , n]) => s === scope && n > 0) ? scope : "all";
  const sources = whole || usedScope === "all" ? [] : usedScope === "selected" ? selected : replaced;
  const groups = kind === "slots" ? [] : options?.groups ?? [];
  const minutes = Math.max(MINUTES[0], Math.min(MINUTES[1], prefs.minutes));
  const entry: NewEntry = {
    cue: cue.id, name: target.name, where: target.where, sources, count: sources.length || (kind === "slots" ? rows.length : 0),
    what: kind, whose: side, tails: prefs.tails, loops, fight_ms: minutes * 60_000, variants, all_variants: allVariants,
  };

  const form = (
    <>
      {kinds.length > 1 ? (
        <div className="field">
          <span className="field-label">Contents</span>
          <div className={`cards${kinds.length > 3 ? " four" : ""}`} role="radiogroup" aria-label="Contents">
            {kinds.map((w) => (
              <button key={w} role="radio" aria-checked={kind === w} className={`card${kind === w ? " on" : ""}`} onClick={() => setKind(w)}
                data-tip={CONTENTS[w].text}><b>{CONTENTS[w].title}</b></button>
            ))}
          </div>
          <small>{CONTENTS[kind].text}.</small>
        </div>
      ) : null}

      {scopes.length > 0 && (
        <div className="field">
          <span className="field-label">{music ? "Slots" : "Sounds"}</span>
          <div className="segmented" role="radiogroup" aria-label={music ? "Slots" : "Sounds"}>
            {scopes.map(([s, label, n]) => (
              <button key={s} role="radio" aria-checked={usedScope === s} className={usedScope === s ? "on" : ""} disabled={!n}
                onClick={() => setScope(s)} data-tip={s === "selected" && !n ? "Tick slots in the list to export only those" : undefined}>
                {label} ({n})</button>
            ))}
          </div>
          {kind === "segments" && usedScope !== "all" && <small>The segments that hold these slots, mixed whole.</small>}
        </div>
      )}

      {withMod && (
        <div className="field">
          <span className="field-label">Audio <Help tip={REFERENCE_ONLY} page="sharing#rights" /></span>
          <div className="segmented xp-versions" role="radiogroup" aria-label="Audio">
            {VERSIONS.map(([id, label, about]) => (
              <button key={id} role="radio" aria-checked={side === id} className={side === id ? "on" : ""} onClick={() => pref({ whose: id })}
                data-tip={about}>{label}</button>
            ))}
          </div>
        </div>
      )}

      {(kind === "fight" || kind === "segments" || groups.length > 0 || (kind === "cue" && options?.playlist)) && (
        <div className="field export-more">
          {kind === "fight" && (
            <label className="inline">Length
              <input type="number" min={MINUTES[0]} max={MINUTES[1]} value={minutes}
                onChange={(e) => pref({ minutes: Math.max(MINUTES[0], Math.min(MINUTES[1], Number(e.target.value) || MINUTES[0])) })} />
              minute{minutes === 1 ? "" : "s"} <Help tip="Each export is a new fight, with the segments picked as the game picks them in a mission" page="soundtrack#exporting" />
            </label>
          )}
          {groups.map((g) => (
            <label key={g.group} className="inline">Variant ({g.name}){" "}
              <Help tip="Some slots play only under a condition, such as a biome. The export uses the one chosen here" page="how-the-game-plays-music#variants" />
              <select disabled={allVariants} value={variants[g.group] ?? g.values[0].value}
                onChange={(e) => setVariants({ ...variants, [g.group]: e.target.value })}>
                {g.values.map((v) => <option key={v.value} value={v.value}>{v.name}</option>)}
              </select>
            </label>
          ))}
          {groups.length > 0 && kind !== "fight" && (
            <label className="check"><input type="checkbox" checked={allVariants} onChange={(e) => setAllVariants(e.target.checked)} />
              <span>Every variant, one file each</span></label>
          )}
          {kind === "segments" && (
            <label className="check"><input type="checkbox" checked={prefs.tails} onChange={(e) => pref({ tails: e.target.checked })} />
              <span>Lead-in and ring-out <Help tip="The audio before Entry and after Exit. When this is off, the pieces sit end to end without overlap." page="reading-the-screen#lead-in-and-ring-out" /></span></label>
          )}
          {kind === "cue" && options?.playlist && (
            <label className="inline">Play the repeating part
              <input type="number" min={1} max={8} value={loops} onChange={(e) => setLoops(Math.max(1, Math.min(8, Number(e.target.value) || 1)))} />
              time{loops === 1 ? "" : "s"}
            </label>
          )}
          {kind === "cue" && options?.random && <small>The game shuffles parts of this music. The export uses the listed order.</small>}
        </div>
      )}
    </>
  );
  return { entry, form };
}

/** The export list's half of the panel: each entry, renamed in place (its folder's name), with what it writes and
    which audio, or taken off the list. */
function ListForm({ withMod }: { withMod: boolean }) {
  const list = useExportList();
  if (!list.length) {
    return <p className="set-note xp-empty">The list is empty. Collect slots, groups, Index entries or archives with a right-click,
      or with <b>Add to the Export List</b> here, to export them together.</p>;
  }
  const kindsOf = (e: ExportEntry): What[] => (!isMusicCue(e.cue) ? ["slots"] : e.what === "fight" ? ["fight", "cue", "segments", "slots"] : ["slots", "segments", "cue"]);
  return (
    <ul className="xl-list">
      {list.map((e) => (
        <li key={e.id}>
          <input className="xl-name" defaultValue={e.name} aria-label="Folder name" data-tip="Folder name (click to rename)"
            onBlur={(ev) => { const v = ev.target.value.trim(); if (v && v !== e.name) exportList.rename(e.id, v); }}
            onKeyDown={(ev) => { if (ev.key === "Enter") ev.currentTarget.blur(); }} />
          <button className="x" onClick={() => exportList.remove(e.id)} aria-label={`Remove ${e.name} from the list`} data-tip="Remove from the list">✕</button>
          <span className="xl-opts">
            <span className="xl-where" data-tip={e.where || undefined} data-tip-clip>{e.where}</span>
            {e.count > 0 && <span className="xl-n">{e.count} slot{e.count === 1 ? "" : "s"}</span>}
            {kindsOf(e).length > 1 && (
              <select value={e.what ?? "slots"} aria-label={`Contents of ${e.name}`} onChange={(ev) => exportList.set(e.id, { what: ev.target.value as What })}>
                {kindsOf(e).map((w) => <option key={w} value={w}>{CONTENT_OPTION[w]}</option>)}
              </select>
            )}
            {withMod && (
              <select value={e.whose ?? "game"} aria-label={`Audio of ${e.name}`} onChange={(ev) => exportList.set(e.id, { whose: ev.target.value as Whose })}>
                <option value="mod">As the mod plays it</option><option value="game">Original</option><option value="both">Both</option>
              </select>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The files an export writes, before it writes them: the destination, a folder for each item (when that is on)
    and the first files in each, as the core names them. */
function Files({ preview, apart, folder, empty }: { preview: Preview | null; apart: boolean; folder: string; empty: boolean }) {
  const root = folder ? folder.split(/[\\/]/).filter(Boolean).pop() : "Destination folder";
  return (
    <div className="xp-files" aria-label="Files">
      <div className="xp-tree">
        <div className="xp-root"><FolderIcon /><span>{root}</span></div>
        {empty ? <p className="xp-none">Nothing to export yet.</p> : !preview ? <p className="xp-none">Reading…</p> : preview.folders.map((f, i) => (
          <div key={i} className={`xp-dir${apart ? "" : " flat"}`}>
            {apart && <div className="xp-dir-name"><FolderIcon /><span>{f.name}</span></div>}
            <ul>
              {f.files.map((n) => <li key={n} data-tip={n} data-tip-clip>{n}</li>)}
              {f.total > f.files.length && <li className="xp-more">and {f.total - f.files.length} more</li>}
              {!f.total && <li className="xp-more">no file</li>}
            </ul>
          </div>
        ))}
      </div>
      {preview && !empty && <p className="xp-sum">{preview.total} file{preview.total === 1 ? "" : "s"}{apart && preview.folders.length > 1 ? ` in ${preview.folders.length} folders` : ""}</p>}
    </div>
  );
}

/** The core's preview of the files a list of entries writes, asked for again a moment after the choices change. */
function usePreview(entries: NewEntry[], fmt: string, names: Names, apart: boolean) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const key = JSON.stringify([entries.map(spec), fmt, names, apart]);
  useEffect(() => {
    if (!entries.length) { setPreview(null); return; }
    let live = true;
    const t = setTimeout(() => {
      call<Preview>("export_preview", { entries: entries.map(spec), fmt, names, apart })
        .then((p) => { if (live) setPreview(p); })
        .catch(() => { if (live) setPreview({ folders: [], total: 0 }); });
    }, 180);
    return () => { live = false; clearTimeout(t); };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return preview;
}

/** The export list's button, beside a toolbar's Export button once something is on the list. */
export function ExportListChip({ onOpen }: { onOpen: () => void }) {
  const list = useExportList();
  if (!list.length) return null;
  return (
    <button className="xl-chip" onClick={onOpen} data-tip="Export list" data-tip-more="Things collected from anywhere, to export together">
      Export List<span className="xp-count">{list.length}</span></button>
  );
}
