import { useEffect } from "react";
import { fmtWhen, type Job } from "./api";
import { EVERY_BANK_PAGE } from "./content";
import { JOB_NAMES } from "./jobs";
import { nav } from "./nav";
import { NoProjectCard, Page, useDraft } from "./Page";
import { pickFolder, reveal } from "./platform";
import { settings, useSettings } from "./settings";
import { useEditor } from "./store";
import { Help } from "./Wiki";

const fileName = (path: string) => path.split(/[\\/]/).pop()!;
/** Problems that the Project tab fixes (the core's Project.problems): the name, the icon, the mod id. */
const ON_PROJECT_TAB = /^(name "|icon: |mod id: )/;
const MISSING = /: the audio file wasn't found \(/; // core project.py: a file the project uses is gone

/** Why a typed version can't be used, or null. */
function versionProblem(v: string): string | null {
  return /^\s*\d+\s*$/.test(v) && Number(v) >= 1 && Number(v) <= 99999 ? null : "A whole number from 1 to 99999.";
}

/** The Build tab: the open project's next version, how the ZIP is made, and what builds logged. The mod's name, icon
    and id are on the Project tab; Repatch and Combine Mods on Tools. */
export function BuildTab() {
  const { project } = useEditor();
  return (
    <Page title="Build" wide lead={<>A build is a ZIP to install with a mod manager.{" "}
      <Help tip="Import the ZIP in a mod manager, then deploy it to hear the mod in the game" page="build-and-install" /></>}>
      {project ? <BuildPage key={project.path} /> : <NoProjectCard text="Open a project to build it." />}
    </Page>
  );
}

function BuildPage() {
  const { project, actions } = useEditor();
  const p = project!;
  // what is on disk now: a file deleted since the last edit is a problem here at once
  useEffect(() => { actions.refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [version, setVersion] = useDraft(String(p.version));
  const save = (fields: Record<string, unknown>) => actions.settings(fields);
  const saveVersion = () => {
    if (versionProblem(version)) return; // stays as typed, with the note under it, until it is a version
    const v = Number(version);
    if (v !== p.version) save({ version: v }); else setVersion(String(p.version));
  };

  return (
    <div className="bld">
      <div className="bld-main">
        <section className="set-sec">
          <h2>Version</h2>
          <label className="field">
            <span className="field-label">Next version <Help tip={`The number in the ZIP name (${p.zip_name}). It goes up after each build unless turned off under Build options.`} page="build-and-install#version" /></span>
            <input className="short" type="number" min={1} max={99999} step={1} value={version} aria-invalid={!!versionProblem(version)}
              onChange={(e) => setVersion(e.target.value)} onBlur={saveVersion}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                else if (e.key === "Escape") setVersion(String(p.version));
              }} />
            {versionProblem(version) && <small className="bad">{versionProblem(version)}</small>}
          </label>
        </section>

        <BuildOptions />
        <Log />
      </div>

      <aside className="bld-side">
        <BuildBox />
      </aside>
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
  const empty = !Object.keys(p.assignments).length && !p.texts.length && !p.settings && !Object.keys(p.soundtrack ?? {}).length;
  const elsewhere = p.build_folder !== p.build_folder_default;
  const chooseFolder = async () => {
    // the picker starts in a folder that is there: the default build folder isn't, before the first build
    const folder = await pickFolder(elsewhere ? p.build_folder : p.folder, "Choose a destination folder for builds");
    if (folder) actions.settings({ build_folder: folder });
  };
  return (
    <div className="bld-box">
      {p.problems.length > 0 && (
        <div className="warn-box">
          <b>Fix {p.problems.length === 1 ? "this" : "these"} before building</b>
          <ul className="problems">{p.problems.map((x, i) => (
            <li key={i}>{x}{ON_PROJECT_TAB.test(x) && <> <button className="link-inline" onClick={() => nav.go("project")}>Project tab</button></>}
              {MISSING.test(x) && <> <Help tip="Put the file back where it was, or choose another file on the slot in the Audio tab" page="project-folders#missing-files" /></>}</li>
          ))}</ul>
          {p.unresolved.length > 0 && (
            <button className="btn" onClick={() => actions.unassign(p.unresolved.map((u) => u.target))}>
              Remove the {p.unresolved.length === 1 ? "sound" : `${p.unresolved.length} sounds`} the game no longer has</button>
          )}
        </div>
      )}
      {empty && !p.problems.length && (
        <p className="info-box">Nothing replaced yet. Add music or sounds from
          the <button className="link-text" onClick={() => nav.go("library")}>Library</button>, then replace them on
          the <button className="link-text" onClick={() => nav.go("editor")}>Audio</button> tab.</p>
      )}
      <button className="btn primary build" onClick={actions.build} disabled={building || empty || p.problems.length > 0} data-tip-cmd="build"
        data-tip={p.problems.length ? "Fix the problems first" : empty ? "Nothing to build yet" : "Encode, patch the sound banks, verify and pack the ZIP"}>
        {building ? "Building…" : `Build v${p.version}`}
      </button>
      <div className="bld-out">
        <p>Destination folder <span className="path" data-tip={p.build_folder} data-tip-clip>{p.build_folder}</span></p>
        <div className="row-btns">
          <button className="btn" onClick={chooseFolder} disabled={building} data-tip="Choose another folder for builds. Only the ZIP is written there.">Change…</button>
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
      {p.last_build && p.game_updated && (
        <p className="warn-box">The game updated after this build, so the sound banks in the ZIP are outdated. Build again before playing or sharing it.
          {" "}<Help tip="An older build can mute sounds it never changed, like all gunfire." page="repatching#shared-settings-from-an-older-game-version" /></p>
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
    <section className="set-sec" id="build-options">
      <h2>Build options</h2>
      <div className="set-list">
        <label className="check">
          <input type="checkbox" checked={s.bumpVersion} onChange={(e) => settings.set({ bumpVersion: e.target.checked })} />
          <span>Raise the version after each build <Help tip="Each build then gets a new ZIP name, and the earlier ZIPs stay. With it off, the next build replaces the last ZIP." page="build-and-install#build-options" /></span>
        </label>
        <label className="check">
          <input type="checkbox" checked={s.revealBuild} onChange={(e) => settings.set({ revealBuild: e.target.checked })} />
          <span>Show the ZIP in Explorer when a build finishes</span>
        </label>
        <label className="check" data-tip={missing && !p.loudness_analysis ? missing : undefined}>
          <input type="checkbox" checked={p.loudness_analysis} disabled={!!missing && !p.loudness_analysis}
            onChange={(e) => actions.settings({ loudness_analysis: e.target.checked })} />
          <span>Add Wwise loudness analysis <Help tip="Applies to this project. The game's audio includes this data, but it makes no audible difference. It needs Wwise installed and makes builds slower." page="build-and-install#wwise-loudness-analysis" />
            {missing && <small>{p.loudness_analysis ? `${missing}. Builds fail until you turn this off.` : missing}</small>}</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={p.every_bank} onChange={(e) => actions.settings({ every_bank: e.target.checked })} />
          <span>Patch every bank with the sounds <Help tip="A sound is often in many banks, such as a clip that several weapons share. With this on, the new audio goes into all of them and plays wherever the sound is used, but the mod gets bigger. With it off, only the banks of the listed items get it." page={EVERY_BANK_PAGE} /></span>
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
      {status?.log && <button className="link-inline log-file" onClick={() => reveal(status.log)}
        data-tip="Show the log file in Explorer" data-tip-more="Attach it to a bug report">Show the log file</button>}
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
