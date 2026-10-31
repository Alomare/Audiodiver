import { useEffect } from "react";
import { plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { fmtDecimal, fmtWhen, type Job, type ProblemKind } from "./api";
import { EVERY_BANK_PAGE, OWN_BANKS_PAGE } from "./content";
import { JOB_NAMES } from "./jobs";
import { nav } from "./nav";
import { NoProjectCard, Page, useDraft } from "./Page";
import { pickFolder, reveal } from "./platform";
import { IconPreview } from "./ProjectTab";
import { settings, useSettings } from "./settings";
import { useEditor } from "./store";
import { Help } from "./Wiki";

const fileName = (path: string) => path.split(/[\\/]/).pop()!;
/** Problems that the Project tab fixes (the kinds of the core's Project.problem_list): the name, the icon, the mod
    ID. A missing_file is a file the project uses that is gone. */
const ON_PROJECT_TAB = new Set<ProblemKind>(["name", "icon", "icon_missing", "mod_id"]);

/** Why a typed version can't be used, or null. */
function versionProblem(v: string): string | null {
  return /^\s*\d+\s*$/.test(v) && Number(v) >= 1 && Number(v) <= 99999 ? null : t`A whole number from 1 to 99999.`;
}

/** The Build tab: the open project's next version, how the ZIP is made, and what builds logged, with the icon as the
    mod manager shows it over the Build button. The mod's name, icon and id are set on the Project tab; Repatch and
    Combine Mods are on Tools. */
export function BuildTab() {
  const { project } = useEditor();
  return (
    <Page title={t({ message: "Build", comment: "Title of the Build tab" })} wide lead={<><Trans>A build is a ZIP to install with a mod manager.</Trans>{" "}
      <Help tip={t`Import the ZIP in a mod manager, then deploy it to hear the mod in the game`} page="build-and-install" /></>}>
      {project ? <BuildPage key={project.path} /> : <NoProjectCard text={t`Open a project to build it.`} />}
    </Page>
  );
}

function BuildPage() {
  const { project, actions, revision } = useEditor();
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
  const zipName = p.zip_name;

  return (
    <div className="bld">
      <div className="bld-main">
        <section className="set-sec">
          <h2><Trans>Version</Trans></h2>
          <label className="field">
            <span className="field-label"><Trans>Next version</Trans> <Help tip={t`The number in the ZIP name (${zipName}). It goes up after each build unless turned off under Build options.`} page="build-and-install#version" /></span>
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
        <IconPreview bust={String(revision)} name={p.name} description={p.description} />
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
  const empty = !Object.keys(p.assignments).length && !Object.keys(p.gains ?? {}).length && !p.texts.length && !p.settings && !Object.keys(p.soundtrack ?? {}).length
    && !Object.keys(p.filters ?? {}).length && !p.radio_off.length;
  const elsewhere = p.build_folder !== p.build_folder_default;
  const chooseFolder = async () => {
    // the picker starts in a folder that is there: the default build folder isn't, before the first build
    const folder = await pickFolder(elsewhere ? p.build_folder : p.folder, t`Choose a destination folder for builds`);
    if (folder) actions.settings({ build_folder: folder });
  };
  // the counts and values the messages name
  const problems = p.problems.length, unresolved = p.unresolved.length, objects = p.settings, version = p.version;
  const last = p.last_build, zip = last ? fileName(last.zip) : "", mb = last ? fmtDecimal(last.mb, 1) : "", when = fmtWhen(last?.modified);
  return (
    <div className="bld-box">
      {p.problems.length > 0 && (
        <div className="warn-box">
          <b>{plural(problems, { one: "Fix this before building", other: "Fix these before building" })}</b>
          <ul className="problems">{p.problems.map((x, i) => (
            <li key={i}>{x}{ON_PROJECT_TAB.has(p.problem_kinds[i]) && <> <button className="link-inline" onClick={() => nav.go("project")}>{t`Project Tab`}</button></>}
              {p.problem_kinds[i] === "missing_file" && <> <Help tip={t`Put the file back where it was, or choose another file on the slot in the Audio tab`} page="project-folders#missing-files" /></>}</li>
          ))}</ul>
          {p.unresolved.length > 0 && (
            <button className="btn" onClick={() => actions.unassign(p.unresolved.map((u) => u.target))}>
              {plural(unresolved, { one: "Remove the Sound the Game No Longer Has", other: "Remove the # Sounds the Game No Longer Has" })}</button>
          )}
        </div>
      )}
      {empty && !p.problems.length && (
        <p className="info-box"><Trans>Nothing replaced yet. Add music or sounds from
          the <button className="link-text" onClick={() => nav.go("library")}>Library</button>, then replace them on
          the <button className="link-text" onClick={() => nav.go("editor")}>Audio</button> tab.</Trans></p>
      )}
      <button className="btn primary build" onClick={actions.build} disabled={building || empty || p.problems.length > 0} data-tip-cmd="build"
        data-tip={p.problems.length ? t`Fix the problems first` : empty ? t`Nothing to build yet` : t`Encode, patch the sound banks, verify and pack the ZIP`}>
        {building ? t({ message: "Building", comment: "The Build button while a build runs" }) : t`Build v${version}`}
      </button>
      <div className="bld-out">
        <p><Trans>Destination folder</Trans> <span className="path" data-tip={p.build_folder} data-tip-clip>{p.build_folder}</span></p>
        <div className="row-btns">
          <button className="btn" onClick={chooseFolder} disabled={building}
            data-tip={p.patch_files ? t`Choose another folder for builds. Only the ZIP and the patch files are written there.`
              : t`Choose another folder for builds. Only the ZIP is written there.`}><Trans comment="Button: choose another destination folder for builds">Change</Trans></button>
          {elsewhere && <button className="btn" onClick={() => actions.settings({ build_folder: null })} disabled={building}
            data-tip={p.build_folder_default}><Trans>Back to the Default</Trans></button>}
        </div>
      </div>
      {p.settings > 0 && (
        <p className="set-note">{plural(objects, { one: "The build also includes an imported mod's settings on a sound or container", other: "The build also includes an imported mod's settings on # sounds and containers" })}
          {" "}<Help tip={t`Volume, delays and similar settings, with the values the imported mod used. A slot's Make-Up Gain is applied on top.`} page="repatching#what-repatching-carries-over" /></p>
      )}
      {p.last_build && (
        <p className="build-last"><Trans>Last build: <b>{zip}</b>, {mb} MB, {when}</Trans>
          <button className="link-inline" onClick={() => reveal(p.last_build!.zip)}><Trans>Show in Folder</Trans></button></p>
      )}
      {p.last_build && p.game_updated && (
        <p className="warn-box"><Trans>The game updated after this build, so the sound banks in the ZIP are outdated. Build again before playing or sharing it.</Trans>
          {" "}<Help tip={t`An older build can mute sounds it never changed, like all gunfire.`} page="repatching#shared-settings-from-an-older-game-version" /></p>
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
      <h2><Trans>Build options</Trans></h2>
      <div className="set-list">
        <label className="check">
          <input type="checkbox" checked={s.bumpVersion} onChange={(e) => settings.set({ bumpVersion: e.target.checked })} />
          <span><Trans>Raise the version after each build</Trans> <Help tip={t`Each build then gets a new ZIP name, and the earlier ZIPs stay. With it off, the next build replaces the last ZIP.`} page="build-and-install#build-options" /></span>
        </label>
        <label className="check">
          <input type="checkbox" checked={s.revealBuild} onChange={(e) => settings.set({ revealBuild: e.target.checked })} />
          <span><Trans>Show the ZIP in Explorer when a build finishes</Trans></span>
        </label>
        <label className="check" data-tip={missing && !p.loudness_analysis ? missing : undefined}>
          <input type="checkbox" checked={p.loudness_analysis} disabled={!!missing && !p.loudness_analysis}
            onChange={(e) => actions.settings({ loudness_analysis: e.target.checked })} />
          <span><Trans>Add Wwise loudness analysis</Trans> <Help tip={t`Applies to this project. The game's audio includes this data, but it makes no audible difference. It needs Wwise installed and makes builds slower.`} page="build-and-install#wwise-loudness-analysis" />
            {missing && <small>{p.loudness_analysis ? t`${missing}. Builds fail until you turn this off.` : missing}</small>}</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={p.patch_files} onChange={(e) => actions.settings({ patch_files: e.target.checked })} />
          <span><Trans>Also save the patch files in a folder</Trans> <Help tip={t`Applies to this project. Beside each ZIP, a folder with the same name holds the mod's .patch_0 files, for packing the mod yourself.`} page="build-and-install#build-options" /></span>
        </label>
        <label className="check">
          <input type="checkbox" checked={p.every_bank} onChange={(e) => actions.settings({ every_bank: e.target.checked })} />
          <span><Trans>Patch every bank with the sounds</Trans> <Help tip={t`A sound is often in many banks, such as a clip that several weapons share. With this on, the new audio goes into all of them and plays wherever the sound is used, but the mod gets bigger. With it off, only the banks of the listed items get it.`} page={EVERY_BANK_PAGE} /></span>
        </label>
        <label className="check" data-tip={p.every_bank ? t({ message: "Patch every bank with the sounds is on", comment: "Names the checkbox above it, as it reads" }) : undefined}>
          <input type="checkbox" checked={p.project_banks_only} disabled={p.every_bank}
            onChange={(e) => actions.settings({ project_banks_only: e.target.checked })} />
          <span><Trans>Keep added audio to the project's banks</Trans> <Help tip={t`New takes, layers and new audio set to Only This Sound go into every bank with a copy of the sound, as the game plays the copy it loads first. With this on, they go only into the banks of the listed items. The mod gets smaller, but where the game loads another bank's copy first, the original plays.`} page={OWN_BANKS_PAGE} /></span>
        </label>
      </div>
    </section>
  );
}

function Log() {
  const { jobs, status } = useEditor();
  const list = Object.values(jobs).reverse();
  return (
    <section className="set-sec build-log" aria-label={t`Log`}>
      <h2><Trans comment="Heading: what the builds, imports and exports of this session wrote">Log</Trans></h2>
      {list.length ? (
        <div className="log">{list.map((j) => <LogJob key={j.id} job={j} />)}</div>
      ) : <p className="set-note"><Trans>This session's builds, imports and exports.</Trans></p>}
      {status?.log && <button className="link-inline log-file" onClick={() => reveal(status.log)}
        data-tip={t`Show the log file in Explorer`} data-tip-more={t`Attach it to a bug report`}><Trans>Show the Log File</Trans></button>}
    </section>
  );
}

/** A job's state as the log shows it. */
const STATES: Record<Job["state"], string> = {
  running: t({ message: "running", comment: "A job's state in the Build tab's log, such as: Build: My Mod, running, 12 s" }),
  done: t({ message: "done", comment: "A job's state in the Build tab's log, such as: Build: My Mod, done, 12 s" }),
  failed: t({ message: "failed", comment: "A job's state in the Build tab's log, such as: Build: My Mod, failed, 12 s" }),
  cancelled: t({ message: "cancelled", comment: "A job's state in the Build tab's log, such as: Build: My Mod, cancelled, 12 s" }),
};

function LogJob({ job: j }: { job: Job }) {
  return (
    <div className={`log-job ${j.state}`}>
      <div className="log-head">{JOB_NAMES[j.kind]?.[0] ?? j.kind}{j.title ? `: ${j.title}` : ""}, {STATES[j.state] ?? j.state}, {fmtDecimal(j.seconds, 1)} s</div>
      <pre>{[...j.log, j.error && j.state !== "cancelled" ? `\n${j.error}` : ""].join("\n").trim() || "…"}</pre>
    </div>
  );
}
