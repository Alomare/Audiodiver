import { useEffect, useRef, useState } from "react";
import { iconUrl, nameProblem, type Icon, type IconFrame } from "./api";
import { confirm } from "./Confirm";
import { NoProjectCard, Page, useDraft } from "./Page";
import { copyText, fullPath, reveal } from "./platform";
import { useEditor } from "./store";
import { Help } from "./Wiki";

const FRAME_KEYS: (keyof IconFrame)[] = ["border", "border_color", "radius"];
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const sizeText = (bytes: number) => (bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`);

/** The Project tab: what the mod is (its name, description, icon and id) and where its files are (its folder, the
    files nothing uses, and packs). Build keeps how the ZIP is made. */
export function ProjectTab() {
  const { project } = useEditor();
  return (
    <Page title="Project" wide
      lead={<>This page holds what the mod is in HD2 Arsenal, and where the project keeps its files. <Help tip="Project folders" page="project-folders" /></>}>
      {project ? <ProjectPage key={project.path} /> : <NoProjectCard text="Create or open a project, or open a pack." />}
    </Page>
  );
}

function ProjectPage() {
  const { project, actions, revision, quick } = useEditor();
  const p = project!;
  // what is on disk now: an image deleted since the last change shows as a problem here at once
  useEffect(() => { actions.refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [name, setName] = useDraft(p.name);
  const [description, setDescription] = useDraft(p.description);
  const [icon, setIcon] = useState<Icon>(p.icon);
  const savedIcon = JSON.stringify(p.icon);
  const latest = useRef(icon);
  latest.current = icon;
  // The saved icon changed (a save came back, an undo, a picked image). The form follows it, unless something newer
  // is on its way or being edited here: a later save, a colour being tried, a slider being dragged. Without this,
  // quick steps on a slider's arrow keys would be taken back one by one as their saves came in.
  const saving = useRef({ count: 0, sent: savedIcon, saved: savedIcon }); // saves on their way, what the last one carried, what was saved before
  useEffect(() => {
    const s = saving.current, now = JSON.stringify(latest.current);
    if (!s.count && (now === s.saved || now === s.sent)) setIcon(p.icon);
    s.saved = savedIcon;
  }, [savedIcon]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = (fields: Record<string, unknown>) => actions.settings(fields);
  const saveName = () => { if (name.trim() && name.trim() !== p.name) save({ name: name.trim() }); else setName(p.name); };
  /** Saves the icon as it is being edited (or `next`), when it differs from the saved one, or from the one a save
      that is still on its way carries. */
  const saveIcon = (next: Icon = latest.current) => {
    setIcon(next);
    const s = saving.current, to = JSON.stringify(next);
    if (to === (s.count ? s.sent : savedIcon)) return;
    s.sent = to;
    s.count++;
    save({ icon: next }).finally(() => { s.count--; });
  };
  const problem = nameProblem(name);
  // the icon's full frame while it is edited: the saved one's, with what has been changed since on top
  const frame = { ...p.icon_frame, ...Object.fromEntries(FRAME_KEYS.filter((k) => k in icon).map((k) => [k, icon[k]])) } as IconFrame;

  return (
    <div className="bld">
      <div className="bld-main">
        <section className="set-sec">
          <h2>Name and description</h2>
          <label className="field">
            <span className="field-label">Name <Help tip="Arsenal keeps the name from the first import, so choose it before sharing. Leave the version out of the name." page="build-and-install#name-and-description" /></span>
            <input value={name} maxLength={80} spellCheck={false} aria-invalid={!!problem} onChange={(e) => setName(e.target.value)} onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                else if (e.key === "Escape") { setName(p.name); requestAnimationFrame(() => e.currentTarget?.blur()); }
              }} />
            {problem && <small className="bad">{problem}</small>}
          </label>
          <label className="field">
            <span className="field-label">Description <Help tip="Optional. Arsenal shows this text with the mod." page="build-and-install#name-and-description" /></span>
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
              onBlur={() => { if (description.trim() !== p.description) save({ description }); }} />
          </label>
        </section>

        <IconEditor icon={icon} frame={frame} setIcon={setIcon} saveIcon={saveIcon} />

        <section className="set-sec">
          <h2>Mod id <Help tip="Arsenal recognises the mod by this id. As long as the id stays the same, a new build updates the installed mod." page="build-and-install#mod-id" /></h2>
          <div className="pkg-id">
            <code>{p.guid}</code>
            <button className="btn quiet" onClick={() => copyText(p.guid, quick, "the mod id")}>Copy</button>
            <button className="btn quiet" onClick={() => actions.newModId()}
              data-tip="Use this when a copied project becomes a different mod" data-tip-more="Arsenal then installs it as a separate mod">Make a new id</button>
          </div>
        </section>

        <FolderSection />
        <UnusedFiles />

        <section className="set-sec">
          <h2>Share <Help tip="A pack holds the project and the files it uses in one file, to move to another computer or to keep" page="project-folders#packs" /></h2>
          <p className="set-note">A pack is one <code>.audipack</code> file with the project and the files it uses. Opening it unpacks the project into the projects folder.</p>
          <div className="row-btns">
            <button className="btn" onClick={actions.exportPack}>Export as pack…</button>
          </div>
        </section>
      </div>

      <aside className="bld-side">
        <IconPreview preview={same(icon, p.icon) ? undefined : icon} bust={String(revision)} name={name.trim() || p.name}
          description={description.trim()} />
      </aside>
    </div>
  );
}

/** Where the project and the files it uses are: the folder, a move into a folder of its own, and collecting files
    that are outside it. */
function FolderSection() {
  const { project: p, actions } = useEditor();
  if (!p) return null;
  const stem = p.path.split(/[\\/]/).pop()!.replace(/\.audi$/i, "");
  const move = async () => {
    const ok = await confirm({
      title: "Move the project into a folder of its own?",
      text: `The project moves to ${p.folder}\\${stem}\\${stem}.audi, with the slices, imported audio and builds Audiodiver made for it. Files you picked from elsewhere stay where they are, and the project points at them.`,
      ok: "Move", cancel: "Keep it here",
    });
    if (ok) await actions.moveToOwnFolder();
  };
  return (
    <section className="set-sec">
      <h2>Folder <Help tip="Where the project file and the files it uses are kept" page="project-folders#the-project-folder" /></h2>
      <p className="path" data-tip={p.path} data-tip-clip>{p.folder}</p>
      <div className="row-btns">
        <button className="btn quiet" onClick={() => reveal(p.path)}>Show in folder</button>
        {!p.own_folder && <button className="btn" onClick={move}>Move to its own folder</button>}
        {p.files_elsewhere > 0 && <button className="btn" onClick={actions.collectFiles}>Collect files</button>}
      </div>
      {!p.own_folder && (
        <p className="warn-box">
          {p.folder_projects
            ? `This folder holds ${p.folder_projects === 1 ? "another project" : `${p.folder_projects} other projects`}, which ${p.folder_projects === 1 ? "shares" : "share"} its slices and imported audio.`
            : "This project is in a shared place, such as the Desktop or Documents."}
          {" "}<Help tip="Moving a project into its own folder" page="project-folders#moving-a-project-into-its-own-folder" />
        </p>
      )}
      {p.files_elsewhere > 0 && (
        <p className="set-note">
          {plural(p.files_elsewhere, "file")} the project uses {p.files_elsewhere === 1 ? "is" : "are"} outside its folder.
          {" "}<Help tip="Collecting files into the project's folder" page="project-folders#collecting-files" />
        </p>
      )}
    </section>
  );
}

type Unused = { folder: string; files: { path: string; rel: string; bytes: number }[]; bytes: number };

/** The files in Audiodiver's folders beside the project that nothing uses: found on request, removed to the Recycle
    Bin. The list is taken again when the project changes. */
function UnusedFiles() {
  const { project, run, quick } = useEditor();
  const [found, setFound] = useState<Unused | null>(null);
  const [busy, setBusy] = useState(false);
  const revision = project?.revision;
  useEffect(() => { setFound(null); }, [revision]);
  const find = async () => {
    setBusy(true);
    const r = await run<Unused>("unused_files");
    setBusy(false);
    if (r) setFound(r);
  };
  const remove = async () => {
    if (!found?.files.length) return;
    const n = found.files.length;
    const ok = await confirm({
      title: `Remove ${plural(n, "unused file")}?`,
      text: `They go to the Recycle Bin. Files the project or its Undo history still uses are kept.`,
      ok: "Remove", cancel: "Keep",
    });
    if (!ok) return;
    const r = await run<{ removed: number; left: number; bytes: number }>("unused_remove", { paths: found.files.map((f) => f.path) });
    if (!r) return;
    setFound(null);
    quick(r.removed ? `${plural(r.removed, "file")} removed${r.left ? `, ${plural(r.left, "file")} still in use` : ""}`
      : "No files were removed", r.removed ? "done" : "info");
  };
  return (
    <section className="set-sec">
      <h2>Unused files <Help tip="Files Audiodiver made for the project that nothing uses any more" page="project-folders#unused-files" /></h2>
      <div className="row-btns">
        <button className="btn" onClick={find} disabled={busy}>{busy ? "Looking…" : "Find unused files"}</button>
        {!!found?.files.length && <button className="btn quiet" onClick={remove}>Remove</button>}
      </div>
      {found && (found.files.length ? (
        <>
          <p className="set-note">Nothing uses {plural(found.files.length, "file")}. {found.files.length === 1 ? "It takes" : "They take"} {sizeText(found.bytes)}.</p>
          <ul className="unused-list">
            {found.files.slice(0, 8).map((f) => <li key={f.path}>{f.rel}</li>)}
            {found.files.length > 8 && <li>and {found.files.length - 8} more</li>}
          </ul>
        </>
      ) : <p className="set-note">No unused files.</p>)}
    </section>
  );
}

// ---------------------------------------------------------------- the icon

const SWATCHES: [string, string][] = [
  ["#ffd400", "Super Earth yellow"], ["#ffffff", "White"], ["#e6e6e6", "Light grey"], ["#8a8f98", "Steel"],
  ["#2b2f36", "Gunmetal"], ["#181b20", "Dark"], ["#000000", "Black"], ["#d8312b", "Automaton red"],
  ["#f28c28", "Terminid orange"], ["#7d5cff", "Illuminate violet"], ["#3fc1e8", "Cyan"], ["#2f6db5", "Democracy blue"],
];

type IconProps = { icon: Icon; frame: IconFrame; setIcon: (i: Icon) => void; saveIcon: (i?: Icon) => void };

/** The icon: an image, or Audiodiver's default icon until one is chosen, with a frame (a border and rounded corners)
    either way. */
function IconEditor({ icon, frame, setIcon, saveIcon }: IconProps) {
  const { project, actions } = useEditor();
  const p = project!;
  const image = icon.image;
  const set = (patch: Icon) => saveIcon({ ...icon, ...patch });             // a click: saved at once
  const slide = (patch: Icon) => setIcon({ ...icon, ...patch });            // a slider moving: previewed, saved on release
  const toDefault = () => { const { image: _, ...rest } = icon; saveIcon(rest); };

  return (
    <section className="set-sec">
      <h2>Icon <Help tip="The image is cropped to a square around its centre and resized to 540 × 540, the size Arsenal uses. You can also drop an image on the preview." page="build-and-install#icon" /></h2>
      <div className="ico-body view-in" key={image ? "image" : "default"}>
        <p className="path" data-tip={image} data-tip-clip>{image ?? "Default icon"}</p>
        <div className="row-btns">
          <button className="btn" onClick={() => actions.setIcon()}>{image ? "Choose another image…" : "Choose an image…"}</button>
          {image && <button className="btn quiet" disabled={p.problems.some((x) => x.startsWith("icon: image not found"))}
            onClick={() => reveal(fullPath(p.folder, image))}>Show in folder</button>}
          {image && <button className="btn quiet" onClick={toDefault} data-tip="The image file stays where it is">Use the default icon</button>}
        </div>
      </div>

      <div className="ico-grid ico-frame">
        <label className="ico-label" htmlFor="ico-border">Border</label>
        <div className="ico-cell ico-slide">
          <input id="ico-border" type="range" min={0} max={48} step={1} value={frame.border}
            onChange={(e) => slide({ border: Number(e.target.value) })} onPointerUp={() => saveIcon()} onKeyUp={() => saveIcon()} />
          <span className="val">{frame.border ? `${frame.border} px` : "None"}</span>
        </div>
        <span className="ico-label">Border colour</span>
        <div className="ico-cell">
          <ColorPick label="Border colour" value={frame.border_color} onChange={(c) => set({ border_color: c })} onTry={(c) => slide({ border_color: c })} disabled={!frame.border} />
        </div>
        <label className="ico-label" htmlFor="ico-radius">Corners</label>
        <div className="ico-cell ico-slide">
          <input id="ico-radius" type="range" min={0} max={270} step={2} value={frame.radius}
            onChange={(e) => slide({ radius: Number(e.target.value) })} onPointerUp={() => saveIcon()} onKeyUp={() => saveIcon()} />
          <span className="val">{frame.radius >= 270 ? "Circle" : frame.radius ? `${frame.radius} px` : "Square"}</span>
        </div>
      </div>
    </section>
  );
}

/** A colour from the swatches, or any colour from the system's picker (tried while it is open, saved when it closes). */
function ColorPick({ label, value, onChange, onTry, disabled }: {
  label: string; value: string; onChange: (c: string) => void; onTry: (c: string) => void; disabled?: boolean;
}) {
  const custom = !SWATCHES.some(([c]) => c === value);
  const input = useRef<HTMLInputElement>(null);
  const done = useRef(onChange);
  done.current = onChange;
  useEffect(() => { // React's onChange fires on every move in the picker; the native change event once, at the end
    const el = input.current;
    const commit = () => done.current(el!.value);
    el?.addEventListener("change", commit);
    return () => el?.removeEventListener("change", commit);
  }, []);
  return (
    <div className={`swatches${disabled ? " off" : ""}`} role="radiogroup" aria-label={label} aria-disabled={disabled}>
      {SWATCHES.map(([c, name]) => (
        <button key={c} role="radio" aria-checked={value === c} aria-label={name} className={`swatch${value === c ? " on" : ""}`}
          style={{ ["--c" as any]: c }} data-tip={name} disabled={disabled} onClick={() => onChange(c)} />
      ))}
      <label className={`swatch any${custom ? " on" : ""}`} style={custom ? { ["--c" as any]: value } : undefined} data-tip={custom ? `${value}: change it` : "Any colour"}>
        {!custom && <span aria-hidden>+</span>}
        <input ref={input} type="color" value={value} disabled={disabled} aria-label={`${label}: any colour`} onChange={(e) => onTry(e.target.value)} />
      </label>
    </div>
  );
}

/** The icon as a build would package it, redrawn shortly after a change. An image dropped on it becomes the icon. */
function IconPreview({ preview, bust, name, description }: { preview?: Icon; bust: string; name: string; description: string }) {
  const { project } = useEditor();
  // sliding redraws the icon after a short pause, not on every step
  const key = preview ? JSON.stringify(preview) : "";
  const [shown, setShown] = useState(key);
  useEffect(() => {
    const t = setTimeout(() => setShown(key), 160);
    return () => clearTimeout(t);
  }, [key]);
  const src = iconUrl(bust, shown ? JSON.parse(shown) : undefined);
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <div className="pkg-preview" aria-label="Preview">
      <div className="pkg-icon" data-drop={JSON.stringify({ kind: "icon" })}>
        {failed === src ? <span className="pkg-icon-missing">The image can't be read. Choose another, or use the default icon.</span>
          : <img src={src} alt="The mod's icon" width={540} height={540} onError={() => setFailed(src)} />}
      </div>
      <div className="pkg-card">
        <b>{name}</b>
        {description && <span className="pkg-desc" data-tip={description.length > 160 ? description : undefined}>{description}</span>}
      </div>
      <p className="set-note">File name <b>{project!.zip_name}</b></p>
    </div>
  );
}
