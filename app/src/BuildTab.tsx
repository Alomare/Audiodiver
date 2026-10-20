import { useEffect, useRef, useState } from "react";
import { fmtWhen, iconUrl, nameProblem, type Icon, type IconFrame, type Job } from "./api";
import { JOB_NAMES } from "./jobs";
import { nav, useNav, type BuildTab as BuildSub } from "./nav";
import { NoProjectCard, Page, tabArrows, useDraft } from "./Page";
import { RepatchPage } from "./RepatchPage";
import { copyText, fullPath, pickFolder, reveal } from "./platform";
import { settings, useSettings } from "./settings";
import { useEditor } from "./store";
import { Help } from "./Wiki";

const fileName = (path: string) => path.split(/[\\/]/).pop()!;
const FRAME_KEYS: (keyof IconFrame)[] = ["border", "border_color", "radius"];
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Why a typed version can't be used, or null. */
function versionProblem(v: string): string | null {
  return /^\s*\d+\s*$/.test(v) && Number(v) >= 1 && Number(v) <= 99999 ? null : "A whole number from 1 to 99999.";
}

const SUBS: [BuildSub, string, string][] = [
  ["project", "Project", "The open project's name and icon in HD2 Arsenal, and its build"],
  ["repatch", "Repatch", "Rebuild an existing audio mod for the current game version"],
];

/** The Build tab. Project: what the mod is called and looks like in HD2 Arsenal, building it, and what builds
    logged. Repatch (RepatchPage.tsx): an existing mod rebuilt on the game as it is now, no project needed. */
export function BuildTab() {
  const { project } = useEditor();
  const { build: sub } = useNav();
  return (
    <Page title="Build" wide lead={sub === "repatch"
      ? <>Rebuild an audio mod made for an older version of the game, or by another tool. <Help tip="Repatching" page="repatching" /></>
      : <>A build is a ZIP for <b>HD2 Arsenal</b>, the mod manager. <Help tip="Building and installing" page="build-and-install" /></>}>
      <div className="sub-tabs" role="tablist" aria-label="Build" onKeyDown={tabArrows}>
        {SUBS.map(([id, name, about]) => (
          <button key={id} role="tab" aria-selected={sub === id} className={sub === id ? "on" : ""} data-tip={about}
            onClick={() => nav.go("build", id)}>{name}</button>
        ))}
      </div>
      <div className="view-in bld-sub" key={sub}>
        {sub === "repatch" ? <RepatchPage />
          : project ? <BuildPage key={project.path} /> : <NoProjectCard text="Open a project to build it, or repatch an existing mod." />}
      </div>
    </Page>
  );
}

function BuildPage() {
  const { project, actions, revision, quick } = useEditor();
  const p = project!;
  // what is on disk now: a file deleted since the last edit is a problem here at once
  useEffect(() => { actions.refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [name, setName] = useDraft(p.name);
  const [description, setDescription] = useDraft(p.description);
  const [version, setVersion] = useDraft(String(p.version));
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
  const saveVersion = () => {
    if (versionProblem(version)) return; // stays as typed, with the note under it, until it is a version
    const v = Number(version);
    if (v !== p.version) save({ version: v }); else setVersion(String(p.version));
  };
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
              <span className="field-label">Name <Help tip="Arsenal keeps the name from the first import, so choose it before sharing. Leave the version out of the name." /></span>
              <input value={name} maxLength={80} spellCheck={false} aria-invalid={!!problem} onChange={(e) => setName(e.target.value)} onBlur={saveName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  else if (e.key === "Escape") { setName(p.name); requestAnimationFrame(() => e.currentTarget?.blur()); }
                }} />
              {problem && <small className="bad">{problem}</small>}
            </label>
            <label className="field">
              <span className="field-label">Description <Help tip="Optional. Arsenal shows this text with the mod." /></span>
              <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
                onBlur={() => { if (description.trim() !== p.description) save({ description }); }} />
            </label>
          </section>

          <section className="set-sec">
            <h2>Version</h2>
            <label className="field">
              <span className="field-label">Next build <Help tip={`The number in the ZIP's name (${p.zip_name}). It goes up after each build unless turned off under When building.`} /></span>
              <input className="short" type="number" min={1} max={99999} step={1} value={version} aria-invalid={!!versionProblem(version)}
                onChange={(e) => setVersion(e.target.value)} onBlur={saveVersion}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  else if (e.key === "Escape") setVersion(String(p.version));
                }} />
              {versionProblem(version) && <small className="bad">{versionProblem(version)}</small>}
            </label>
          </section>

          <IconEditor icon={icon} frame={frame} setIcon={setIcon} saveIcon={saveIcon} />

          <section className="set-sec">
            <h2>Mod id <Help tip="Arsenal recognises the mod by this id. As long as the id stays the same, a new build updates the installed mod." /></h2>
            <div className="pkg-id">
              <code>{p.guid}</code>
              <button className="btn quiet" onClick={() => copyText(p.guid, quick, "the mod id")}>Copy</button>
              <button className="btn quiet" onClick={() => actions.newModId()}
                data-tip="Use this when a copied project becomes a different mod" data-tip-more="Arsenal then installs it as a separate mod">Make a new id</button>
            </div>
          </section>

          <BuildOptions />
          <Log />
        </div>

        <aside className="bld-side">
          <IconPreview preview={same(icon, p.icon) ? undefined : icon} bust={String(revision)} name={name.trim() || p.name}
            description={description.trim()} />
          <BuildBox />
        </aside>
      </div>
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
      <h2>Icon <Help tip="The image is cropped to a square around its centre and resized to 540 × 540, the size Arsenal uses. You can also drop an image on the preview." /></h2>
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

/** The icon as the build would package it, redrawn shortly after a change. An image dropped on it becomes the icon. */
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
      <p className="set-note">Builds as {project!.zip_name}</p>
    </div>
  );
}

// ---------------------------------------------------------------- building

/** Next to the preview: what stops a build, the button, and where the ZIP goes (a folder chosen for it, or the
    build folder next to the project file). */
function BuildBox() {
  const { project, actions, jobs } = useEditor();
  const p = project!;
  const building = Object.values(jobs).some((j) => j.kind === "build" && j.state === "running");
  const empty = !Object.keys(p.assignments).length && !p.texts.length && !p.settings;
  const elsewhere = p.build_folder !== p.build_folder_default;
  const chooseFolder = async () => {
    // the picker starts in a folder that is there: the default build folder isn't, before the first build
    const folder = await pickFolder(elsewhere ? p.build_folder : p.folder, "Choose the folder this mod's builds go to");
    if (folder) actions.settings({ build_folder: folder });
  };
  return (
    <div className="bld-box">
      {p.problems.length > 0 && (
        <div className="warn-box">
          <b>Fix {p.problems.length === 1 ? "this" : "these"} before building</b>
          <ul className="problems">{p.problems.map((x, i) => <li key={i}>{x}</li>)}</ul>
          {p.unresolved.length > 0 && (
            <button className="btn" onClick={() => actions.unassign(p.unresolved.map((u) => u.target))}>
              Remove the {p.unresolved.length === 1 ? "sound" : `${p.unresolved.length} sounds`} the game no longer has</button>
          )}
        </div>
      )}
      {empty && !p.problems.length && (
        <p className="info-box">Nothing replaced yet. Add music or sounds from
          the <button className="link-text" onClick={() => nav.go("library")}>Library</button>, then replace them in
          the <button className="link-text" onClick={() => nav.go("editor")}>Audio Editor</button>.</p>
      )}
      <button className="btn primary build" onClick={actions.build} disabled={building || empty || p.problems.length > 0} data-tip-cmd="build"
        data-tip={p.problems.length ? "Fix the problems first" : empty ? "Nothing to build yet" : "Encode, patch the game's sound banks, verify and pack the ZIP"}>
        {building ? "Building…" : `Build v${p.version}`}
      </button>
      <div className="bld-out">
        <p>Goes to <span className="path" data-tip={p.build_folder} data-tip-clip>{p.build_folder}</span></p>
        <div className="row-btns">
          <button className="btn" onClick={chooseFolder} disabled={building} data-tip="Choose another folder for this mod's builds. Only the ZIP is written there.">Change…</button>
          {elsewhere && <button className="btn" onClick={() => actions.settings({ build_folder: null })} disabled={building}
            data-tip={p.build_folder_default}>Back to the default</button>}
        </div>
      </div>
      {p.settings > 0 && (
        <p className="set-note">The build also includes an imported mod's settings on {p.settings === 1 ? "a sound or container" : `${p.settings} sounds and containers`}
          {" "}<Help tip="Volume, delays and similar settings, with the values the imported mod used. A slot's Make-Up Gain is applied on top." page="repatching#what-repatching-carries-over" /></p>
      )}
      {p.last_build && (
        <p className="build-last">Last build: <b>{fileName(p.last_build.zip)}</b>, {p.last_build.mb} MB, {fmtWhen(p.last_build.modified)}
          <button className="link-inline" onClick={() => reveal(p.last_build!.zip)}>Show in folder</button></p>
      )}
    </div>
  );
}

function BuildOptions() {
  const { project, actions, status } = useEditor();
  const s = useSettings();
  const p = project!;
  const missing = status?.loudness_missing ?? null;
  return (
    <section className="set-sec" id="when-building">
      <h2>When building</h2>
      <div className="set-list">
        <label className="check">
          <input type="checkbox" checked={s.bumpVersion} onChange={(e) => settings.set({ bumpVersion: e.target.checked })} />
          <span>Raise the version after each build <Help tip="Arsenal then sees every build as an update." /></span>
        </label>
        <label className="check">
          <input type="checkbox" checked={s.revealBuild} onChange={(e) => settings.set({ revealBuild: e.target.checked })} />
          <span>Show the ZIP in its folder when a build finishes</span>
        </label>
        <label className="check" data-tip={missing && !p.loudness_analysis ? missing : undefined}>
          <input type="checkbox" checked={p.loudness_analysis} disabled={!!missing && !p.loudness_analysis}
            onChange={(e) => actions.settings({ loudness_analysis: e.target.checked })} />
          <span>Add Wwise loudness analysis <Help tip="Applies to this project. The game's audio includes this data, but it makes no audible difference. It needs Wwise installed and makes builds slower." />
            {missing && <small>{p.loudness_analysis ? `${missing}. Builds fail until you turn this off.` : missing}</small>}</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={p.biome_fix} onChange={(e) => actions.settings({ biome_fix: e.target.checked })} />
          <span>Fix music that stays silent on some planets <Help tip="Applies to this project, when the build includes the music_init bank. Made for an older game version: where it no longer fits, builds go on without it. See the Wiki's Building and installing page." /></span>
        </label>
      </div>
    </section>
  );
}

function Log() {
  const { jobs, status } = useEditor();
  const list = Object.values(jobs).reverse();
  return (
    <section className="set-sec build-log" aria-label="Log">
      <h2>Log</h2>
      {list.length ? (
        <div className="log">{list.map((j) => <LogJob key={j.id} job={j} />)}</div>
      ) : <p className="set-note">This session's builds, imports and exports.</p>}
      {status?.log && <button className="link-inline log-file" onClick={() => reveal(status.log)}>Show the core's log file</button>}
    </section>
  );
}

function LogJob({ job: j }: { job: Job }) {
  return (
    <div className={`log-job ${j.state}`}>
      <div className="log-head">{JOB_NAMES[j.kind]?.[0] ?? j.kind}{j.title ? `: ${j.title}` : ""}, {j.state}, {j.seconds} s</div>
      <pre>{[...j.log, j.error && j.state !== "cancelled" ? `\n${j.error}` : ""].join("\n").trim() || "…"}</pre>
    </div>
  );
}
