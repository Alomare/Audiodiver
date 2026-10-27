import { useEffect, useRef, useState } from "react";
import { call, fmtBytes, fmtWhen, iconUrl, nameProblem, plural, type Icon, type IconFrame } from "./api";
import { confirm } from "./Confirm";
import { FolderIcon } from "./Icons";
import { NoProjectCard, Page, useDraft } from "./Page";
import { copyText, fullPath, pickFolder, reveal } from "./platform";
import { TabChecks } from "./SettingsTab";
import { useEditor, useShownTabs } from "./store";
import { motionMs } from "./theme";
import { nav } from "./nav";
import { Help, WikiLink } from "./Wiki";
import { rangeVars } from "./range";

const FRAME_KEYS: (keyof IconFrame)[] = ["border", "border_color", "radius"];
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** The Project tab: what the mod is (its name, description, icon and id), the tabs it shows, and where its files
    are (its folder, the files nothing uses, and packs), with Import patches and Close project over the icon. Build
    keeps how the ZIP is made. With no project open: New, Open and the recent projects. */
export function ProjectTab() {
  const { project } = useEditor();
  return (
    <Page title="Project" wide
      lead={<>Projects are folders containing the mod and all associated files.{" "}
        <Help tip="The project file records what the mod replaces and with which files. Audiodiver keeps what it makes for the project beside that file" page="project-folders" /></>}>
      {project ? <ProjectPage key={project.path} />
        : <div className="proj-none">
          <NoProjectCard text="Create or open a project, or open a pack." recent={false} />
          <RecentProjects />
        </div>}
    </Page>
  );
}

type Info = { path: string; exists: boolean; readable: boolean; name: string; modified: number | null };
const fileName = (path: string) => path.split(/[\\/]/).pop()!.replace(/\.audi$/i, "");

/** The projects opened before, newest first: each opens with a click, shows its folder, or leaves the list (the
    file stays). A row says when its file was last changed, or that it is gone or can't be read. Nothing shows until
    a project has been made or opened. */
function RecentProjects() {
  const { recent, actions } = useEditor();
  const [info, setInfo] = useState<Record<string, Info>>({});
  const [leaving, setLeaving] = useState<string[]>([]); // rows folding away after their ✕
  const forget = (path: string) => {
    setLeaving((l) => [...l, path]);
    setTimeout(() => { actions.forgetRecent(path); setLeaving((l) => l.filter((p) => p !== path)); }, motionMs(160));
  };

  // the list says whether each file is still there, and shows the mod's name rather than the file's
  useEffect(() => {
    if (!recent.length) return;
    let live = true;
    call<Info[]>("projects_info", { paths: recent })
      .then((list) => { if (live) setInfo(Object.fromEntries(list.map((i) => [i.path, i]))); })
      .catch(() => { /* the list still works from the paths alone */ });
    return () => { live = false; };
  }, [recent]);

  if (!recent.length) return null;
  return (
    <section className="set-sec recent" aria-label="Recent projects">
      <h2>Recent projects</h2>
      <ul>
        {recent.map((path) => {
          const i = info[path];
          const name = i?.name ?? fileName(path);
          const missing = i ? !i.exists : false;
          const unreadable = !!i && i.exists && !i.readable;
          const gone = leaving.includes(path);
          return (
            <li key={path} className={`recent-row${missing || unreadable ? " missing" : ""}${gone ? " leaving" : ""}`} inert={gone}>
              <button className="recent-open" disabled={missing} onClick={() => actions.openProject(path)}>
                <span className="recent-name">{name}</span>
                <span className="recent-path" data-tip={path} data-tip-clip>{path}</span>
              </button>
              <span className="recent-when" data-tip={missing ? "Moved, renamed or deleted" : unreadable ? "Not an Audiodiver project, or damaged" : undefined}>
                {missing ? "Not found" : unreadable ? "Can't be read" : fmtWhen(i?.modified)}</span>
              <span className="recent-tools">
                <button className="x" aria-label={`Show ${name} in folder`} disabled={missing}
                  onClick={() => reveal(path)} data-tip="Show in folder"><FolderIcon /></button>
                <button className="x" aria-label={`Remove ${name} from this list`} onClick={() => forget(path)}
                  data-tip="Remove from this list" data-tip-more="The file stays where it is">✕</button>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ProjectPage() {
  const { project, actions, revision, jobs } = useEditor();
  const shown = useShownTabs();
  const p = project!;
  const busy = Object.values(jobs).some((j) => j.state === "running"); // the folder's files may be changing
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
        {/* a new project: the first step is on other tabs */}
        {shown.includes("editor") && !p.library.length && !Object.keys(p.assignments).length && (
          <p className="info-box">Nothing in the project yet. Add music or sounds from
            the <button className="link-text" onClick={() => nav.go("library")}>Library</button>, then replace them on
            the <button className="link-text" onClick={() => nav.go("editor")}>Audio</button> tab.{" "}
            <WikiLink page="first-mod" about="A first mod">A first mod, step by step</WikiLink></p>
        )}
        <section className="set-sec">
          <h2>Name and description</h2>
          <label className="field">
            <span className="field-label">Name <Help tip="Choose it before sharing. Mod managers keep the name from the first import. Leave out the version." page="build-and-install#name-and-description" /></span>
            <input value={name} maxLength={80} spellCheck={false} aria-invalid={!!problem} onChange={(e) => setName(e.target.value)} onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                else if (e.key === "Escape") { setName(p.name); requestAnimationFrame(() => e.currentTarget?.blur()); }
              }} />
            {problem && <small className="bad">{problem}</small>}
          </label>
          <label className="field">
            <span className="field-label">Description <Help tip="Optional. Shown with the mod in the mod manager." page="build-and-install#name-and-description" /></span>
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
              onBlur={() => { if (description.trim() !== p.description) save({ description }); }} />
          </label>
        </section>

        <IconEditor icon={icon} frame={frame} setIcon={setIcon} saveIcon={saveIcon} />

        <ModId />

        <section className="set-sec">
          <h2>Tabs <Help tip="Hide the tabs this mod doesn't use, such as all but Text for a subtitle mod. What was changed in a hidden tab stays in the mod. A new project starts with the tabs Settings ▸ System shows." page="how-audiodiver-works#tabs" /></h2>
          <TabChecks value={shown} onChange={(tabs) => actions.settings({ tabs })} />
        </section>

        <FolderSection busy={busy} />
        <UnusedFiles busy={busy} />

        <section className="set-sec">
          <h2>Export <Help tip="A pack is one .audipack file with the project and all associated files, for moving it to another computer or keeping a copy." page="project-folders#packs" /></h2>
          <div className="row-btns">
            <button className="btn" onClick={actions.exportPack} disabled={busy}>Export as Pack</button>
          </div>
        </section>
      </div>

      <aside className="bld-side">
        <div className="side-actions">
          <button className="btn" onClick={() => actions.importPatch()}
            data-tip="Import the replaced and added sounds from a mod's .patch_0 file into this project"
            data-tip-more="To keep working on an existing mod, such as one made with another tool">Import Patches</button>
          <button className="btn quiet" onClick={actions.closeProject} data-tip="Close the project" data-tip-cmd="closeProject">Close Project</button>
        </div>
        <IconPreview preview={same(icon, p.icon) ? undefined : icon} bust={String(revision)} name={name.trim() || p.name}
          description={description.trim()} />
      </aside>
    </div>
  );
}

const GUID = /^\{?[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}\}?$/i;

/** The mod id: copied, made new, or changed to the id of a mod made before (such as the Guid in its manifest.json),
    so that a build updates that mod. */
function ModId() {
  const { project, actions, quick } = useEditor();
  const p = project!;
  const [draft, setDraft] = useState<string | null>(null); // the id being typed; null while the id shows
  const typed = draft?.trim() ?? "";
  const problem = typed && !GUID.test(typed) ? "A mod ID looks like this: 613bc667-1b2d-4f5e-8a9b-0c1d2e3f4a5b" : null;
  const save = async () => {
    if (!typed || typed.replace(/[{}]/g, "").toLowerCase() === p.guid) setDraft(null);
    else if (!problem && await actions.setModId(typed)) setDraft(null);
  };
  return (
    <section className="set-sec">
      <h2>Mod ID <Help tip="Mod managers recognise the mod by this ID. While it stays the same, a new build updates the installed mod." page="build-and-install#mod-id" /></h2>
      {draft === null ? (
        <div className="pkg-id">
          <code>{p.guid}</code>
          <button className="btn quiet" onClick={() => copyText(p.guid, quick, "the mod ID")}>Copy</button>
          <button className="btn quiet" onClick={() => setDraft(p.guid)}
            data-tip="Use the ID of a mod made before, such as the Guid in the manifest.json of the mod" data-tip-more="Mod managers then treat a build as an update to that mod">Change</button>
          <button className="btn quiet" onClick={() => actions.newModId()}
            data-tip="Use this when a copied project becomes a different mod" data-tip-more="The next build installs as a separate mod">Make a New ID</button>
        </div>
      ) : (
        <div className="field">
          <div className="pkg-id">
            <input value={draft} autoFocus spellCheck={false} aria-label="Mod ID" aria-invalid={!!problem}
              onChange={(e) => setDraft(e.target.value)} onFocus={(e) => e.currentTarget.select()}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                else if (e.key === "Escape") setDraft(null);
              }} />
            <button className="btn" onClick={save} disabled={!!problem}>Save</button>
            <button className="btn quiet" onClick={() => setDraft(null)}>Cancel</button>
          </div>
          {problem && <small className="bad">{problem}</small>}
        </div>
      )}
    </section>
  );
}

/** Where the project and the files it uses are: the folder, moving it to another place or into a new folder, and
    collecting files that are outside it. Each action sits in the box that says why it is offered. */
function FolderSection({ busy }: { busy: boolean }) {
  const { project: p, actions, run } = useEditor();
  if (!p) return null;
  const moveTo = async () => {
    const parent = p.folder.replace(/[\\/][^\\/]*$/, "") || p.folder;
    const folder = await pickFolder(parent, "Choose where to move the project");
    if (!folder) return;
    const where = await run<{ dest: string; copy: boolean }>("project_move_to", { folder, check: true });
    if (!where) return;
    const ok = await confirm({
      title: "Move the project?",
      text: (p.own_folder ? `The project folder moves to ${where.dest}, with everything in it.`
        : `The project moves to ${where.dest}, with the slices, imported audio and builds Audiodiver made for it.`)
        + " Files you picked from elsewhere stay where they are, and the project still finds them."
        + (where.copy ? " That is another drive, so the files are copied there first, which takes a while for a big project." : ""),
      ok: "Move", cancel: "Keep It Here",
    });
    if (ok) await actions.moveProject(folder);
  };
  const move = async () => {
    const ok = await confirm({
      title: "Move the project into a new folder?",
      text: `The project moves to ${p.move_to ?? "a new folder"}, with the slices, imported audio and builds Audiodiver made for it. Files you picked from elsewhere stay where they are.`,
      ok: "Move", cancel: "Keep It Here",
    });
    if (ok) await actions.moveToOwnFolder();
  };
  const others = p.folder_projects;
  return (
    <section className="set-sec">
      <h2>Folder <Help tip="Where the project file and the files it uses are kept" page="project-folders#the-project-folder" /></h2>
      <p className="path" data-tip={p.path} data-tip-clip>{p.folder}</p>
      <div className="row-btns">
        <button className="btn quiet" onClick={() => reveal(p.path)}>Show in Folder</button>
        <button className="btn quiet" onClick={moveTo} disabled={busy} data-tip="Move the project to another folder"
          data-tip-more="The project still finds every file it uses">Move Project</button>
      </div>
      {!p.own_folder && (
        <div className="warn-box">
          <p>{others
            ? `${others === 1 ? "Another project is" : `${others} other projects are`} in this folder and ${others === 1 ? "uses" : "use"} the same slices and imported folders.`
            : "This project is in a shared place, such as the Desktop or Documents."}
            {" "}<Help tip="Audiodiver puts the slices, the imported audio and the builds beside the project file. In a folder that holds only this project, they stay apart from other files." page="project-folders#moving-a-project-into-a-new-folder" /></p>
          <div className="row-btns">
            <button className="btn" onClick={move} disabled={busy}>Move to a New Folder</button>
          </div>
        </div>
      )}
      {p.files_elsewhere > 0 && (
        <div className="info-box">
          <p>{plural(p.files_elsewhere, "file")} the project uses {p.files_elsewhere === 1 ? "is" : "are"} outside the project folder.
            {" "}<Help tip="Copies them into the project folder, so the project can be moved or copied as one folder" page="project-folders#collecting-files" /></p>
          <div className="row-btns">
            <button className="btn" onClick={actions.collectFiles} disabled={busy}>Collect Files</button>
          </div>
        </div>
      )}
    </section>
  );
}

type Unused = { folder: string; files: { path: string; rel: string; bytes: number }[]; bytes: number };

/** The files in Audiodiver's folders beside the project that nothing uses: found on request, removed to the Recycle
    Bin. The list is taken again when the project changes. */
function UnusedFiles({ busy: working }: { busy: boolean }) {
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
      text: n === 1 ? "It goes to the Recycle Bin." : "They go to the Recycle Bin.",
      ok: "Remove", cancel: "Keep",
    });
    if (!ok) return;
    const r = await run<{ removed: number; left: number; bytes: number }>("unused_remove", { paths: found.files.map((f) => f.path) });
    if (!r) return;
    setFound(null);
    quick(r.removed ? `${plural(r.removed, "file")} moved to the Recycle Bin${r.left ? `, ${r.left} couldn't be removed` : ""}`
      : "No files were removed", r.removed ? "done" : "info");
  };
  return (
    <section className="set-sec">
      <h2>Unused files <Help tip="Files Audiodiver made for the project that nothing uses any more" page="project-folders#unused-files" /></h2>
      <div className="row-btns">
        <button className="btn" onClick={find} disabled={busy || working}>{busy ? "Looking" : "Find Unused Files"}</button>
        {!!found?.files.length && <button className="btn quiet" onClick={remove} disabled={working}>Remove</button>}
      </div>
      {found && (found.files.length ? (
        <>
          <p className="set-note">{plural(found.files.length, "file is", "files are")} unused ({fmtBytes(found.bytes)}).</p>
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
      <h2>Icon <Help tip="Cropped to a centred square and resized to 540 × 540. Drop an image on the preview to use it." page="build-and-install#icon" /></h2>
      <div className="ico-body view-in" key={image ? "image" : "default"}>
        <p className="path" data-tip={image} data-tip-clip>{image ?? "Default icon"}</p>
        <div className="row-btns">
          <button className="btn" onClick={() => actions.setIcon()}>{image ? "Choose Another Image" : "Choose an Image"}</button>
          {image && <button className="btn quiet" disabled={p.problems.some((x) => x.startsWith("icon: image not found"))}
            onClick={() => reveal(fullPath(p.folder, image))}>Show in Folder</button>}
          {image && <button className="btn quiet" onClick={toDefault} data-tip="The image file stays where it is">Use the Default Icon</button>}
        </div>
      </div>

      <div className="ico-grid ico-frame">
        <label className="ico-label" htmlFor="ico-border">Border</label>
        <div className="ico-cell ico-slide">
          <input id="ico-border" type="range" style={rangeVars(frame.border, 0, 48)} min={0} max={48} step={1} value={frame.border}
            onChange={(e) => slide({ border: Number(e.target.value) })} onPointerUp={() => saveIcon()} onKeyUp={() => saveIcon()} />
          <span className="val">{frame.border ? `${frame.border} px` : "None"}</span>
        </div>
        <span className="ico-label">Border colour</span>
        <div className="ico-cell">
          <ColorPick label="Border colour" value={frame.border_color} onChange={(c) => set({ border_color: c })} onTry={(c) => slide({ border_color: c })} disabled={!frame.border} />
        </div>
        <label className="ico-label" htmlFor="ico-radius">Corners</label>
        <div className="ico-cell ico-slide">
          <input id="ico-radius" type="range" style={rangeVars(frame.radius, 0, 270)} min={0} max={270} step={2} value={frame.radius}
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
          : <img src={src} alt="Mod icon" width={540} height={540} onError={() => setFailed(src)} />}
      </div>
      <div className="pkg-card">
        <b>{name}</b>
        {description && <span className="pkg-desc" data-tip={description.length > 160 ? description : undefined}>{description}</span>}
      </div>
      <p className="set-note">File name <b>{project!.zip_name}</b></p>
    </div>
  );
}
