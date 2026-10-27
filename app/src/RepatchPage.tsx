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
  folder: string; patches: Patch[];
};
/** audio: whether it holds sound banks (one without, like a texture option, is kept as it is); others: what else it
    holds, which goes into the new patch as it was ("1 string table"). */
type Patch = { key: string; label: string; files: number; audio: boolean; others: string[] };
/** One of the mod's patches, repatched or kept as it was ("kept": why; audio false: it had none to repatch). */
type Part = {
  label: string; imported?: number; added?: number; skipped?: number; settings?: number;
  stale?: number; // sounds the mod's banks still had from an older game version (core addition.older_version)
  older?: number; // the game's objects the mod's banks had as an older version did, shared groups included (Found.older)
  left: string[]; others: string[]; kept: string; audio: boolean;
};
/** The repatched mod (Session.repatch's result). */
type Made = { name: string; zip: string; mb: number; kept_id: boolean; manifest: boolean; parts: Part[] };

const OLDER = "The mod's sound banks are from an older game version and still had these sounds. The current game no longer has them, so they are left out.";
const OLDER_PAGE = "repatching#sounds-from-an-older-game-version";
const SHARED = "The mod's banks had older copies of these. Some are shared by many banks, like the settings every weapon sound goes through, so an older copy can silence sounds the mod never changed. The new ZIP has the current ones.";
const SHARED_PAGE = "repatching#shared-settings-from-an-older-game-version";

/** A mod checked for sound banks of an older game version (core installed.check), and each of its patches. */
type State = "shared" | "older" | "current" | "unreadable";
type Checked = { label: string; file: string; state: State; objects?: number; reach?: number; weapons?: number };
type Installed = { name: string; source: string; where: "manager" | "game"; deployed: boolean; state: State; patches: Checked[] };
type CheckResult = { mods: Installed[]; quiet: number; library: boolean };
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
  const silent = !!scan && !scan.patches.some((p) => p.audio); // nothing to repatch
  const go = () => scan && !silent && actions.repatch(scan.source, name.trim(), folder, everyBank);
  // Repatch another mod: the page as it was before a mod was chosen, its last outcome put away
  const again = () => {
    setScan(null);
    setName("");
    setStale(job?.id ?? null);
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const chooseFolder = async () => {
    const f = await pickFolder(folder || undefined, "Choose where repatched mods go");
    if (f) setFolder(f);
  };

  return (
    <div className="bld rp drop-page" data-drop={JSON.stringify({ kind: "repatch" })}>
      <div className="bld-main">
        <section className="set-sec" ref={top}>
          <h2>The mod</h2>
          {scan ? (
            <div className="view-in rp-form drop-zone" key={scan.source}>
              <p className="path" data-tip={scan.source} data-tip-clip>{scan.source}</p>
              {scan.patches.length > 1 ? <Patches scan={scan} /> : silent ? (
                <p className="warn-box">The patch holds no audio, so there is nothing to repatch.</p>
              ) : (
                <>
                  {scan.patches[0].files > 1 && <p className="set-note">The {scan.patches[0].files} patch files are built into one patch. <Help tip="The game loads them over each other as one mod." page="repatching#repatching-a-mod" /></p>}
                  {scan.patches[0].others.length > 0 && <p className="set-note">Also holds {scan.patches[0].others.join(" and ")}, carried over.</p>}
                </>
              )}
              <label className="field">
                <span className="field-label">Name <Help tip="Name shown in the mod manager." page="repatching#repatching-a-mod" /></span>
                <input value={name} maxLength={80} spellCheck={false} aria-invalid={!!problem} disabled={running}
                  onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !problem) go(); }} />
                {problem && <small className="bad">{problem}</small>}
              </label>
              {scan.manifest && (
                <p className="set-note">Kept from the manifest: {listed([scan.icon && "the icon", scan.description && "the description",
                  scan.patches.length > 1 && "the options", "the files beside the patches", scan.guid && "the mod ID"])}.
                  {scan.guid && " Importing the new ZIP in a mod manager updates the old mod."}{" "}
                  <Help tip="The manifest is the file in a mod that gives the mod manager the name, icon, options and ID" page="repatching#what-repatching-carries-over" /></p>
              )}
              <div className="row-btns">
                <button className="btn quiet" disabled={running || reading} onClick={async () => read(await pickMod())}>Choose Another Mod</button>
              </div>
            </div>
          ) : (
            <div className="rp-drop drop-zone">
              <p>Drop a mod here as a <b>ZIP</b>, a <b>folder</b> or a <b>.patch_0</b> file.</p>
              <div className="row-btns">
                <button className="btn" disabled={reading} onClick={async () => read(await pickMod())}>Choose a ZIP or Patch File</button>
                <button className="btn" disabled={reading} onClick={async () => read(await pickFolder(undefined, "Choose the mod folder"))}>Choose a Folder</button>
              </div>
              {reading && <p className="set-note">Reading…</p>}
            </div>
          )}
        </section>

        <section className="set-sec">
          <h2>Destination folder <Help tip="The new ZIP goes here. A ZIP with the same name stays, and the new one gets a number." page="repatching#destination-folder" /></h2>
          <p className="path" data-tip={folder || scan?.folder} data-tip-clip>{folder || scan?.folder || "Documents\\Audiodiver\\Repatched"}</p>
          <div className="row-btns">
            <button className="btn" onClick={chooseFolder} disabled={running}>Change</button>
          </div>
        </section>

        <section className="set-sec">
          <h2>Options</h2>
          <div className="set-list">
            <label className="check">
              <input type="checkbox" checked={everyBank} disabled={running} onChange={(e) => setEveryBank(e.target.checked)} />
              <span>Patch every bank with the sounds <Help tip="A sound is often in many banks, such as a clip that several weapons share. With this on, the mod's audio goes into all of them and plays wherever the sound is used, but the mod gets bigger. With it off, only the banks the mod patched get it, as in the original." page={EVERY_BANK_PAGE} /></span>
            </label>
          </div>
        </section>

        <div className="bld-box rp-go">
          <button className="btn primary build" onClick={go} disabled={!scan || !!problem || busy || silent}
            data-tip={!scan ? "Choose a mod first" : silent ? "The mod holds no audio" : "Apply the mod's audio and settings to the current sound banks and build a new ZIP"}>
            {running ? "Repatching" : "Repatch"}
          </button>
          {running && job && (
            <div className="rp-progress">
              <span>{job.doing || "Starting…"}</span>
              <button className="btn quiet" onClick={() => actions.cancelJob(job.id)}>Cancel</button>
            </div>
          )}
        </div>

        {job && !running && job.id !== stale && <Outcome job={job} again={again} />}

        <InstalledMods busy={running} onPick={(path) => { read(path); top.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }} />
      </div>

      <aside className="bld-side rp-about">
        <About />
      </aside>
    </div>
  );
}

/** A mod's patches in the form: how many repatching rebuilds and how many it keeps as they are, each one under Show
    all (a mod can have dozens: textures and models as options of their own). */
function Patches({ scan }: { scan: Scan }) {
  const audio = scan.patches.filter((p) => p.audio), plain = scan.patches.length - audio.length;
  return (
    <div className="rp-patches">
      <span className="field-label">Patches <Help tip={scan.manifest ? "Each patch with audio is rebuilt where it was, so the options don't change." : "Without a manifest, each becomes an option of the new mod."} page="repatching#repatching-a-mod" /></span>
      {audio.length === 0 ? <p className="warn-box">The mod holds no audio, so there is nothing to repatch.</p> : (
        <ul>
          <li>{plural(audio.length, "patch", "patches")} with audio, rebuilt on the current game</li>
          {plain > 0 && <li>{plural(plain, "patch", "patches")} without audio, kept as {plain === 1 ? "it is" : "they are"}</li>}
        </ul>
      )}
      <details className="rp-log">
        <summary>Show All</summary>
        <ul>
          {scan.patches.map((p) => (
            <li key={p.key}>{p.label || fileName(p.key)}{!p.audio ? <small>No audio, kept as it is.</small> : (
              <>{p.files > 1 && <small>{p.files} patch files, built into one.</small>}{p.others.length > 0 && <small>Also holds {p.others.join(" and ")}, carried over.</small>}</>
            )}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

/** What the last repatch made, in short: what it carried over and left out, then Show all for each patch and the log. */
function Outcome({ job, again }: { job: Job; again: () => void }) {
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
  const built = m.parts.filter((p) => !p.kept);
  const plain = m.parts.filter((p) => p.kept && !p.audio); // no audio: kept as they were, as they should be
  const failed = m.parts.filter((p) => p.kept && p.audio);
  const left = [...new Set(built.flatMap((p) => p.left))];
  const most = (k: "stale" | "older") => {
    const all = built.map((p) => p[k] ?? 0), top = Math.max(0, ...all);
    return { n: top, upTo: new Set(all).size > 1 };
  };
  const stale = most("stale"), older = most("older");
  return (
    <section className="set-sec view-in rp-made" aria-label="Repatched">
      <h2>Repatched</h2>
      <p><b>{m.name}</b>: {fileName(m.zip)}, {m.mb} MB.
        {m.kept_id ? " It keeps the old mod ID, so importing it in a mod manager updates the old mod." : " Remove the old mod in the mod manager before importing this one."}</p>
      <div className="row-btns">
        <button className="btn" onClick={() => reveal(m.zip)}>Show in Folder</button>
        <button className="btn quiet" onClick={again}>Repatch Another Mod</button>
      </div>
      <dl className="set-facts rp-sum">
        <dt>Carried over</dt>
        <dd>{several ? rebuilt(built) : `${carried(built[0])}${built[0].skipped ? `; ${plural(built[0].skipped, "sound")} couldn't be read` : ""}`}</dd>
        {plain.length > 0 && <><dt>Kept as it was</dt><dd>{plural(plain.length, "patch", "patches")} without audio</dd></>}
        {left.length > 0 && (
          <><dt>Left out <Help tip="Repatching carries over the mod's audio and sound settings, and leaves out other kinds of change. Listen to the result in game." page="repatching#what-repatching-leaves-out" /></dt>
            <dd>{left.length === 1 ? left[0] : `${left[0]}, and ${left.length - 1} more`}</dd></>
        )}
        {(stale.n > 0 || older.n > 0) && (
          <><dt>Older game version</dt>
            <dd>{stale.n > 0 && <span>{stale.upTo && "up to "}{plural(stale.n, "sound")} left out <Help tip={OLDER} page={OLDER_PAGE} /></span>}
              {stale.n > 0 && older.n > 0 && ", "}
              {older.n > 0 && <span>{older.upTo && "up to "}{plural(older.n, "sound object")} updated <Help tip={SHARED} page={SHARED_PAGE} /></span>}</dd></>
        )}
      </dl>
      {failed.length > 0 && (
        <div className="warn-box"><b>Couldn't be repatched, kept as {failed.length === 1 ? "it was" : "they were"}</b>
          <ul>{failed.map((p) => <li key={p.label}>{p.label}: {p.kept}</li>)}</ul>
        </div>
      )}
      <details className="rp-log rp-all">
        <summary>Show All</summary>
        {built.map((p) => (
          <div key={p.label} className="rp-mod">
            {several && <h3>{p.label}</h3>}
            <p className="set-note">{carried(p)}{p.skipped ? `; ${plural(p.skipped, "sound")} couldn't be read` : ""}.</p>
            {!!p.stale && <p className="set-note">{plural(p.stale, "sound")} from an older game version left out</p>}
            {!!p.older && <p className="set-note">{plural(p.older, "sound object")} from an older game version updated</p>}
            {p.left.length > 0 && (
              <div className="info-box"><b>Left out</b><ul>{p.left.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
            )}
          </div>
        ))}
        {plain.length > 0 && (
          <div className="rp-mod">
            <h3>Without audio, kept as {plain.length === 1 ? "it was" : "they were"}</h3>
            <ul>{plain.map((p) => <li key={p.label}>{p.label}</li>)}</ul>
          </div>
        )}
        <Details job={job} />
      </details>
    </section>
  );
}

/** The mods in the mod managers' libraries and in the game's folder, checked for sound banks of an older game version; a flagged
    one opens in the form above with its Repatch button. */
function InstalledMods({ busy, onPick }: { busy: boolean; onPick: (path: string) => void }) {
  const { actions, jobs } = useEditor();
  const job = Object.values(jobs).filter((j) => j.kind === "check").pop();
  const checking = job?.state === "running";
  const r: CheckResult | null = job?.state === "done" ? job.result : null;
  return (
    <section className="set-sec">
      <h2>Installed mods <Help tip="Finds mods with sound banks from an older game version, in mod manager libraries and the game folder. Such a mod can mute sounds it never changed, like all gunfire." page="repatching#checking-installed-mods" /></h2>
      <div className="row-btns">
        <button className="btn" onClick={actions.checkMods} disabled={checking}>{checking ? "Checking" : r ? "Check Again" : "Check Installed Mods"}</button>
        {checking && <span className="set-note">{job?.doing || "Starting…"}</span>}
      </div>
      {job?.state === "failed" && <p className="warn-box">{job.error}</p>}
      {r && (
        <div className="view-in rp-found">
          {!r.library && <p className="set-note">No mod manager library was found, so only the game folder was checked.</p>}
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
      <p><b>{m.name}</b><span className={`tag${flagged ? " warn" : ""}`}>{STATE_TEXT[m.state]}</span>{m.deployed && <span className="tag" data-tip="In the game folder now, so the game loads it">Deployed</span>}</p>
      {m.state === "shared" && (
        <p className="set-note">Can mute sounds in {plural(widest.reach ?? 0, "other bank")}{widest.weapons ? `, ${widest.weapons} of them weapon banks` : ""}. <Help tip={SHARED} page={SHARED_PAGE} /></p>
      )}
      {m.state === "older" && <p className="set-note">The mod's sounds can be wrong or missing. <Help tip={OLDER} page={OLDER_PAGE} /></p>}
      {mixed && (
        <details className="rp-log">
          <summary>Options</summary>
          <ul>{m.patches.map((p) => <li key={p.file}>{p.label || fileName(p.file)}: {STATE_TEXT[p.state]}</li>)}</ul>
        </details>
      )}
      {flagged && (
        <div className="row-btns">
          <button className="btn quiet" disabled={busy} onClick={() => onPick(m.source)} data-tip="Open it in the form above, ready to repatch">Repatch</button>
        </div>
      )}
    </div>
  );
}

/** "10 replaced sounds, 6 added sounds and the mod's settings on 4 sounds and containers". */
function carried(p: Part) {
  return listed([p.imported && plural(p.imported, "replaced sound"), p.added && plural(p.added, "added sound"),
    p.settings && `settings on ${plural(p.settings, "sound or container", "sounds and containers")}`, ...p.others]) || "Nothing to carry over";
}

/** "4 patches, with 20 to 28 replaced or added sounds each", for a mod of several. */
function rebuilt(ps: Part[]) {
  const n = ps.map((p) => (p.imported ?? 0) + (p.added ?? 0)), lo = Math.min(...n), hi = Math.max(...n);
  const also = [ps.some((p) => p.settings) && "the mod's settings", ps.some((p) => p.others.length) && "other files"].filter(Boolean);
  const settings = also.length ? ` and ${also.join(" and ")}` : "";
  if (!hi) return `${plural(ps.length, "patch", "patches")}, with ${also.join(" and ") || "nothing to carry over"}`;
  return `${plural(ps.length, "patch", "patches")}, with ${lo === hi ? hi : `${lo} to ${hi}`} replaced or added sound${hi === 1 ? "" : "s"}${ps.length > 1 ? " each" : ""}${settings}`;
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
        <li>Takes the audio that the mod replaces and adds, with sound settings such as volume and delays.</li>
        <li>Applies them to the game's current sound banks.</li>
        <li>Builds a new ZIP of the same mod, with the same options, files and ID. The audio isn't encoded again.</li>
        <li>Keeps what the patches hold besides audio, like text, models or textures, as it was.</li>
      </ul>
      <h3>When to use it</h3>
      <ul>
        <li>A mod's sounds went silent, wrong or missing after a game update.</li>
        <li>Other sounds, like all gunfire, go silent while the mod is installed. <b>Installed mods</b> below finds the mods that do this.</li>
      </ul>
      <h3>What it leaves out</h3>
      <ul>
        <li>Changes of other kinds in the sound banks, like effects or how a container picks sounds. Each repatch lists them.</li>
      </ul>
      <h3>Installing</h3>
      <ul>
        <li>Import the new ZIP in the mod manager in place of the old mod.</li>
      </ul>
      <p className="set-note">A repatched mod is still the work of the original author. Keep it for personal use, and share it only with the author's permission.</p>
      <p className="set-note"><button className="link-text" onClick={() => nav.go("wiki", "repatching")}>More in the Wiki</button></p>
    </div>
  );
}
