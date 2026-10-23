import { useEffect, useRef, useState } from "react";
import { nameProblem, plural, type Job } from "./api";
import { EVERY_BANK_PAGE } from "./content";
import { nav } from "./nav";
import { pickFolder, pickMod, reveal } from "./platform";
import { useEditor } from "./store";
import { Help } from "./Wiki";

/** What the core found in a mod (Session.repatch_scan). */
type Scan = {
  source: string; name: string; description: string; guid: boolean; icon: boolean; manifest: boolean; zip: boolean;
  folder: string; patches: { key: string; label: string; files: number; other: string[] }[];
};
/** One of the mod's patches, repatched or kept as it was ("kept": why). */
type Part = {
  label: string; project?: string; imported?: number; added?: number; skipped?: number; settings?: number;
  stale?: number; // sounds the mod's banks still had from an older game version (core addition.older_version)
  older?: number; // the game's objects the mod's banks had as an older version did, shared groups included (Found.older)
  left: string[]; other: string[]; kept: string;
};
/** The repatched mod (Session.repatch's result). */
type Made = { name: string; zip: string; folder: string; mb: number; kept_id: boolean; manifest: boolean; parts: Part[] };

const OLDER = "The mod was made for an older game version, and its copy of the sounds still had these. The current game no longer has them, so they aren't part of the mod.";
const OLDER_PAGE = "repatching#sounds-from-an-older-game-version";
const SHARED = "The mod's banks had older copies of these. Some are shared by many banks, like the settings every weapon sound goes through, and an older copy can silence sounds the mod never changed. The new ZIP has the current ones.";
const SHARED_PAGE = "repatching#shared-settings-from-an-older-game-version";

/** A mod checked for sound banks of an older game version (core installed.check), and each of its patches. */
type State = "shared" | "older" | "current" | "unreadable";
type Checked = { label: string; file: string; state: State; objects?: number; reach?: number; weapons?: number };
type Installed = { name: string; source: string; where: "arsenal" | "game"; deployed: boolean; state: State; patches: Checked[] };
type CheckResult = { mods: Installed[]; quiet: number; arsenal: boolean };
const STATE_TEXT: Record<State, string> = {
  shared: "Older shared settings", older: "Older sound banks", unreadable: "Can't be read", current: "Up to date",
};
const fileName = (path: string) => path.split(/[\\/]/).pop()!;
/** "a, b and c", leaving out the empty ones. */
const listed = (items: (string | false | 0 | undefined)[]) => {
  const xs = items.filter(Boolean) as string[];
  return xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}` : xs[0] ?? "";
};

/** A mod dropped on the window for this page (App.tsx's drop handler): held until the page takes it. */
export const repatchInbox = (() => {
  let waiting: string | null = null;
  const listeners = new Set<() => void>();
  return {
    offer(path: string) { waiting = path; listeners.forEach((f) => f()); },
    take() { const p = waiting; waiting = null; return p; },
    subscribe(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; },
  };
})();

// the mod being set up, kept while another tab shows
let kept: { scan: Scan; name: string; folder: string; everyBank: boolean } | null = null;
let staleJob: string | null = null;

/** Tools ▸ Repatch: an existing audio mod (a ZIP, a folder or a .patch_0) rebuilt on the game as it is now, as the
    one mod it was: each of its patches made again, its options and files as they were. The explanations sit beside
    it, the rest in the Wiki. */
export function RepatchPage() {
  const { run, actions, jobs } = useEditor();
  const [scan, setScan] = useState<Scan | null>(kept?.scan ?? null);
  const [name, setName] = useState(kept?.name ?? "");
  const [folder, setFolder] = useState(kept?.folder ?? "");
  const [everyBank, setEveryBank] = useState(kept?.everyBank ?? false);
  const [reading, setReading] = useState(false);
  const [stale, setStale] = useState(staleJob); // the repatch whose outcome belongs to the mod chosen before this one
  useEffect(() => { kept = scan && { scan, name, folder, everyBank }; }, [scan, name, folder, everyBank]);
  useEffect(() => { staleJob = stale; }, [stale]);
  const jobsNow = useRef(jobs); // read when a mod is chosen, also from a drop the first render subscribed to
  jobsNow.current = jobs;
  const top = useRef<HTMLElement>(null);

  const read = async (path: string | null) => {
    if (!path) return;
    setReading(true);
    const s = await run<Scan>("repatch_scan", { path });
    setReading(false);
    if (!s) return;
    setStale(Object.values(jobsNow.current).filter((j) => j.kind === "repatch").pop()?.id ?? null);
    setScan(s);
    setName(s.name);
    setFolder((f) => f || s.folder);
  };
  // a mod dropped on the window, now or while this page wasn't showing
  useEffect(() => {
    const take = () => { const p = repatchInbox.take(); if (p) read(p); };
    take();
    return repatchInbox.subscribe(take);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const job = Object.values(jobs).filter((j) => j.kind === "repatch").pop();
  const running = job?.state === "running";
  const busy = Object.values(jobs).some((j) => (j.kind === "build" || j.kind === "repatch") && j.state === "running");
  const problem = scan ? nameProblem(name) : null;
  const go = () => scan && actions.repatch(scan.source, name.trim(), folder, everyBank);
  const chooseFolder = async () => {
    const f = await pickFolder(folder || undefined, "Choose where repatched mods go");
    if (f) setFolder(f);
  };

  return (
    <div className="bld rp" data-drop={JSON.stringify({ kind: "repatch" })}>
      <div className="bld-main">
        <section className="set-sec" ref={top}>
          <h2>The mod</h2>
          {scan ? (
            <div className="view-in rp-form" key={scan.source}>
              <p className="path" data-tip={scan.source} data-tip-clip>{scan.source}</p>
              {scan.patches.length > 1 ? (
                <div className="rp-patches">
                  <span className="field-label">Patches <Help tip={scan.manifest ? "Each patch is rebuilt in its original place, so the mod keeps its options." : "Without a manifest, each becomes an option of the new mod."} page="repatching#repatching-a-mod" /></span>
                  <ul>
                    {scan.patches.map((p) => (
                      <li key={p.key}>{p.label || fileName(p.key)}{p.files > 1 && <small>{p.files} patch files, built into one.</small>}{p.other.length > 0 && <small>Also holds {p.other.join(" and ")}: left out.</small>}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <>
                  {scan.patches[0].files > 1 && <p className="set-note">The mod's {scan.patches[0].files} patch files go into one project and are built into one patch. <Help tip="The game loads them over each other as one mod." page="repatching#repatching-a-mod" /></p>}
                  {scan.patches[0].other.length > 0 && <p className="info-box">The patch also holds {scan.patches[0].other.join(" and ")}. Repatching leaves {scan.patches[0].other.length === 1 ? "it" : "them"} out.</p>}
                </>
              )}
              <label className="field">
                <span className="field-label">Name <Help tip="The mod's name in HD2 Arsenal." page="repatching#repatching-a-mod" /></span>
                <input value={name} maxLength={80} spellCheck={false} aria-invalid={!!problem} disabled={running}
                  onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !problem) go(); }} />
                {problem && <small className="bad">{problem}</small>}
              </label>
              {scan.manifest && (
                <p className="set-note">Kept from the manifest: {listed([scan.icon && "the icon", scan.description && "the description",
                  scan.patches.length > 1 && "the options", "the files beside the patches", scan.guid && "the mod id"])}.
                  {scan.guid && " Importing the new ZIP in Arsenal updates the old mod."}</p>
              )}
              <div className="row-btns">
                <button className="btn quiet" disabled={running || reading} onClick={async () => read(await pickMod())}>Choose another mod…</button>
              </div>
            </div>
          ) : (
            <div className="rp-drop">
              <p>Drop a mod here as a <b>ZIP</b>, a <b>folder</b> or a <b>.patch_0</b> file.</p>
              <div className="row-btns">
                <button className="btn" disabled={reading} onClick={async () => read(await pickMod())}>Choose a ZIP or patch file…</button>
                <button className="btn" disabled={reading} onClick={async () => read(await pickFolder(undefined, "Choose the mod's folder"))}>Choose a folder…</button>
              </div>
              {reading && <p className="set-note">Reading…</p>}
            </div>
          )}
        </section>

        <section className="set-sec">
          <h2>Destination folder <Help tip="Each repatched mod gets a folder here. It holds a project that you can change in the Audio Editor, the audio extracted from the mod, and the new ZIP in the build folder." page="repatching#destination-folder" /></h2>
          <p className="path" data-tip={folder || scan?.folder} data-tip-clip>{folder || scan?.folder || "Documents\\Audiodiver\\Repatched"}</p>
          <div className="row-btns">
            <button className="btn" onClick={chooseFolder} disabled={running}>Change…</button>
          </div>
        </section>

        <section className="set-sec">
          <h2>Options</h2>
          <div className="set-list">
            <label className="check">
              <input type="checkbox" checked={everyBank} disabled={running} onChange={(e) => setEveryBank(e.target.checked)} />
              <span>Patch every bank with the sounds <Help tip="A sound is often in many banks, such as a clip that several weapons share. With this on, the mod's audio goes into all of them and plays wherever the game uses the sound, but the mod gets bigger. With it off, only the banks the mod patched get it, as in the original." page={EVERY_BANK_PAGE} /></span>
            </label>
          </div>
        </section>

        <div className="bld-box rp-go">
          <button className="btn primary build" onClick={go} disabled={!scan || !!problem || busy}
            data-tip={!scan ? "Choose a mod first" : "Apply the mod's audio and settings to the current game's sound banks and build a new ZIP"}>
            {running ? "Repatching…" : "Repatch"}
          </button>
          {running && job && (
            <div className="rp-progress">
              <span>{job.doing || "Starting…"}</span>
              <button className="btn quiet" onClick={() => actions.cancelJob(job.id)}>Cancel</button>
            </div>
          )}
        </div>

        {job && !running && job.id !== stale && <Outcome job={job} />}

        <InstalledMods busy={running} onPick={(path) => { read(path); top.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }} />
      </div>

      <aside className="bld-side rp-about">
        <About />
      </aside>
    </div>
  );
}

/** What the last repatch made, what it left out, and its log. */
function Outcome({ job }: { job: Job }) {
  const { actions } = useEditor();
  if (job.state !== "done") {
    return (
      <section className="set-sec view-in">
        <h2>{job.state === "cancelled" ? "Cancelled" : "Repatching failed"}</h2>
        {job.state !== "cancelled" && <p className="warn-box">{job.error}</p>}
        <Details job={job} />
      </section>
    );
  }
  const m: Made = job.result, several = m.parts.length > 1;
  const kept = m.parts.filter((p) => p.kept);
  return (
    <section className="set-sec view-in rp-made" aria-label="Repatched">
      <h2>Repatched</h2>
      <p><b>{m.name}</b>: {fileName(m.zip)}, {m.mb} MB.
        {m.kept_id ? " It keeps the old mod's id, so importing it in Arsenal updates that mod." : " Remove the old mod in Arsenal before importing this one."}</p>
      <div className="row-btns">
        <button className="btn" onClick={() => reveal(m.zip)}>Show in folder</button>
        {!several && m.parts[0].project && (
          <button className="btn quiet" onClick={() => actions.openProject(m.parts[0].project!)} data-tip="Change it further in the Audio Editor">Open as project</button>
        )}
      </div>
      {m.parts.filter((p) => !p.kept).map((p) => (
        <div key={p.label} className="rp-mod">
          {several && <h3>{p.label}</h3>}
          <p className="set-note">{carried(p)}{p.skipped ? `; ${plural(p.skipped, "sound")} couldn't be read` : ""}.</p>
          {!!p.stale && (
            <p className="set-note">{plural(p.stale, "sound")} from an older game version left out <Help tip={OLDER} page={OLDER_PAGE} /></p>
          )}
          {!!p.older && (
            <p className="set-note">{plural(p.older, "sound object")} from an older game version updated <Help tip={SHARED} page={SHARED_PAGE} /></p>
          )}
          {(p.left.length > 0 || p.other.length > 0) && (
            <div className="info-box">
              <b>Left out</b> <Help tip="Repatching carries over the mod's audio and sound settings, and leaves out other kinds of change. Listen to the result in game." page="repatching#what-repatching-leaves-out" />
              <ul>{[...p.left, ...p.other].map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
          )}
          {several && p.project && (
            <div className="row-btns">
              <button className="btn quiet" onClick={() => actions.openProject(p.project!)}
                data-tip="Change this option in the Audio Editor. If you build it from there, it becomes a separate mod">Open as project</button>
            </div>
          )}
        </div>
      ))}
      {kept.length > 0 && (
        <div className="warn-box"><b>Kept as it was</b>
          <ul>{kept.map((p) => <li key={p.label}>{p.label}: {p.kept}</li>)}</ul>
        </div>
      )}
      <Details job={job} />
    </section>
  );
}

/** The mods in HD2 Arsenal and in the game's folder, checked for sound banks of an older game version; a flagged
    one opens in the form above with its Repatch button. */
function InstalledMods({ busy, onPick }: { busy: boolean; onPick: (path: string) => void }) {
  const { actions, jobs } = useEditor();
  const job = Object.values(jobs).filter((j) => j.kind === "check").pop();
  const checking = job?.state === "running";
  const r: CheckResult | null = job?.state === "done" ? job.result : null;
  return (
    <section className="set-sec">
      <h2>Installed mods <Help tip="Finds mods with sound banks from an older game version, in HD2 Arsenal and in the game's folder. Such a mod can mute sounds it never changed, like all gunfire." page="repatching#checking-installed-mods" /></h2>
      <div className="row-btns">
        <button className="btn" onClick={actions.checkMods} disabled={checking}>{checking ? "Checking…" : r ? "Check again" : "Check installed mods"}</button>
        {checking && <span className="set-note">{job?.doing || "Starting…"}</span>}
      </div>
      {job?.state === "failed" && <p className="warn-box">{job.error}</p>}
      {r && (
        <div className="view-in rp-found">
          {!r.arsenal && <p className="set-note">HD2 Arsenal's library wasn't found, so only the game's folder was checked.</p>}
          {r.mods.length === 0 && <p className="set-note">No installed mod has sound banks.</p>}
          {r.mods.map((m) => <InstalledMod key={m.source} m={m} busy={busy} onPick={onPick} />)}
          {r.quiet > 0 && <p className="set-note">{plural(r.quiet, "mod")} without sound banks not listed.</p>}
        </div>
      )}
    </section>
  );
}

function InstalledMod({ m, busy, onPick }: { m: Installed; busy: boolean; onPick: (path: string) => void }) {
  const flagged = m.state === "shared" || m.state === "older";
  const widest = m.patches.reduce((a, p) => ((p.reach ?? 0) > (a.reach ?? 0) ? p : a), m.patches[0]);
  const mixed = m.patches.length > 1 && m.patches.some((p) => p.state !== m.state);
  return (
    <div className="rp-mod">
      <p><b>{m.name}</b><span className={`tag${flagged ? " warn" : ""}`}>{STATE_TEXT[m.state]}</span>{m.deployed && <span className="tag">Deployed</span>}</p>
      {m.state === "shared" && (
        <p className="set-note">Can mute sounds in {plural(widest.reach ?? 0, "other bank")}{widest.weapons ? `, ${widest.weapons} of them weapon banks` : ""}. <Help tip={SHARED} page={SHARED_PAGE} /></p>
      )}
      {m.state === "older" && <p className="set-note">Its own sounds can be wrong or missing. <Help tip={OLDER} page={OLDER_PAGE} /></p>}
      {mixed && (
        <details className="rp-log">
          <summary>Options</summary>
          <ul>{m.patches.map((p) => <li key={p.file}>{p.label || fileName(p.file)}: {STATE_TEXT[p.state]}</li>)}</ul>
        </details>
      )}
      {flagged && (
        <div className="row-btns">
          <button className="btn quiet" disabled={busy} onClick={() => onPick(m.source)} data-tip="Open it in the form above, ready to repatch">Repatch…</button>
        </div>
      )}
    </div>
  );
}

/** "10 replaced sounds, 6 added sounds and the mod's settings on 4 sounds and containers". */
function carried(p: Part) {
  return listed([p.imported && plural(p.imported, "replaced sound"), p.added && plural(p.added, "added sound"),
    p.settings && `its settings on ${plural(p.settings, "sound or container", "sounds and containers")}`]) || "Nothing to carry over";
}

function Details({ job }: { job: Job }) {
  return (
    <details className="rp-log">
      <summary>Log</summary>
      <pre>{job.log.join("\n") || "…"}</pre>
    </details>
  );
}

/** Beside the form: what repatching does and doesn't, in short. The Wiki's Repatching page says it in full. */
function About() {
  return (
    <div className="rp-text">
      <h3>What it does</h3>
      <ul>
        <li>Takes the audio that the mod replaces and adds, and its sound settings such as volume and delays.</li>
        <li>Applies them to the game's current sound banks.</li>
        <li>Builds a new ZIP of the same mod, with its options, files and id unchanged. The mod's audio isn't encoded again.</li>
      </ul>
      <h3>When to use it</h3>
      <ul>
        <li>A mod's sounds went silent, wrong or missing after a game update.</li>
        <li>Other sounds, like all gunfire, go silent while the mod is installed. <b>Installed mods</b> below finds the mods that do this.</li>
      </ul>
      <h3>What it leaves out</h3>
      <ul>
        <li>Changes of other kinds, like effects or how a container picks its sounds. Each repatch lists them.</li>
        <li>Text that the mod changes, like subtitles. Repatching doesn't support text yet.</li>
        <li>Anything else a patch holds besides sound banks, like models or textures.</li>
      </ul>
      <h3>Installing</h3>
      <ul>
        <li>Import the new ZIP in Arsenal in place of the old mod.</li>
      </ul>
      <p className="set-note">A repatched mod is still its author's work. Keep it for personal use, and share it only with the author's permission.</p>
      <p className="set-note"><button className="link-text" onClick={() => nav.go("wiki", "repatching")}>More in the Wiki</button></p>
    </div>
  );
}
