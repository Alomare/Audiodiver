import { useEffect, useRef, useState } from "react";
import { t, plural, ph } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { andList, intlLocale, nameProblem, type Job } from "./api";
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

const OLDER = t`The mod's sound banks are from an older game version and still had these sounds. The current game no longer has them, so they are left out.`;
const OLDER_PAGE = "repatching#sounds-from-an-older-game-version";
const SHARED = t`The mod's banks had older copies of these. Some are shared by many banks, like the settings every weapon sound goes through, so an older copy can silence sounds the mod never changed. The new ZIP has the current ones.`;
const SHARED_PAGE = "repatching#shared-settings-from-an-older-game-version";

/** A mod checked for sound banks of an older game version (core installed.check), and each of its patches. */
type State = "shared" | "older" | "current" | "unreadable";
type Checked = { label: string; file: string; state: State; objects?: number; reach?: number; weapons?: number };
type Installed = { name: string; source: string; where: "manager" | "game"; deployed: boolean; state: State; patches: Checked[] };
type CheckResult = { mods: Installed[]; quiet: number; library: boolean };
const STATE_TEXT: Record<State, string> = {
  shared: t`Older shared settings`, older: t`Older sound banks`,
  unreadable: t({ message: "Can't be read", comment: "Tag on an installed mod, or on one option of a mod: the check couldn't read the files" }),
  current: t`Up to date`,
};
const fileName = (path: string) => path.split(/[\\/]/).pop()!;
/** "a, b and c", leaving out the empty ones. */
const listed = (items: (string | false | 0 | undefined)[]) => andList(items.filter(Boolean) as string[]);

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
    const f = await pickFolder(folder || undefined, t`Choose where repatched mods go`);
    if (f) setFolder(f);
  };

  return (
    <div className="bld rp drop-page" data-drop={JSON.stringify({ kind: "repatch" })}>
      <div className="bld-main">
        <section className="set-sec" ref={top}>
          <h2><Trans>The mod</Trans></h2>
          {scan ? (
            <div className="view-in rp-form drop-zone" key={scan.source}>
              <p className="path" data-tip={scan.source} data-tip-clip>{scan.source}</p>
              {scan.patches.length > 1 ? <Patches scan={scan} /> : silent ? (
                <p className="warn-box"><Trans>The patch holds no audio, so there is nothing to repatch.</Trans></p>
              ) : (
                <>
                  {scan.patches[0].files > 1 && <p className="set-note">{plural(ph({ files: scan.patches[0].files }), {
                    one: "The # patch file is built into one patch.", other: "The # patch files are built into one patch." })}{" "}
                    <Help tip={t`The game loads them over each other as one mod.`} page="repatching#repatching-a-mod" /></p>}
                  {scan.patches[0].others.length > 0 && <p className="set-note"><Trans>Also holds {ph({ others: andList(scan.patches[0].others) })}, carried over.</Trans></p>}
                </>
              )}
              <label className="field">
                <span className="field-label"><Trans>Name</Trans> <Help tip={t`Name shown in the mod manager.`} page="repatching#repatching-a-mod" /></span>
                <input value={name} maxLength={80} spellCheck={false} aria-invalid={!!problem} disabled={running}
                  onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !problem) go(); }} />
                {problem && <small className="bad">{problem}</small>}
              </label>
              {scan.manifest && (
                <p className="set-note"><Trans>Kept from the manifest: {ph({ items: listed([scan.icon && t`the icon`, scan.description && t`the description`,
                  scan.patches.length > 1 && t`the options`, t`the files beside the patches`, scan.guid && t`the mod ID`]) })}.</Trans>
                  {scan.guid && <>{" "}<Trans>Importing the new ZIP in a mod manager updates the old mod.</Trans></>}{" "}
                  <Help tip={t`The manifest is the file in a mod that gives the mod manager the name, icon, options and ID`} page="repatching#what-repatching-carries-over" /></p>
              )}
              <div className="row-btns">
                <button className="btn quiet" disabled={running || reading} onClick={async () => read(await pickMod())}><Trans>Choose Another Mod</Trans></button>
              </div>
            </div>
          ) : (
            <div className="rp-drop drop-zone">
              <p><Trans>Drop a mod here as a <b>ZIP</b>, a <b>folder</b> or a <b>.patch_0</b> file.</Trans></p>
              <div className="row-btns">
                <button className="btn" disabled={reading} onClick={async () => read(await pickMod())}><Trans>Choose a ZIP or Patch File</Trans></button>
                <button className="btn" disabled={reading} onClick={async () => read(await pickFolder(undefined, t`Choose the mod folder`))}><Trans>Choose a Folder</Trans></button>
              </div>
              {reading && <p className="set-note"><Trans>Reading…</Trans></p>}
            </div>
          )}
        </section>

        <section className="set-sec">
          <h2><Trans>Destination folder</Trans> <Help tip={t`The new ZIP goes here. A ZIP with the same name stays, and the new one gets a number.`} page="repatching#destination-folder" /></h2>
          <p className="path" data-tip={folder || scan?.folder} data-tip-clip>{folder || scan?.folder || "Documents\\Audiodiver\\Repatched"}</p>
          <div className="row-btns">
            <button className="btn" onClick={chooseFolder} disabled={running}><Trans comment="Button that chooses another destination folder">Change</Trans></button>
          </div>
        </section>

        <section className="set-sec">
          <h2><Trans>Options</Trans></h2>
          <div className="set-list">
            <label className="check">
              <input type="checkbox" checked={everyBank} disabled={running} onChange={(e) => setEveryBank(e.target.checked)} />
              <span><Trans>Patch every bank with the sounds</Trans> <Help tip={t`A sound is often in many banks, such as a clip that several weapons share. With this on, the mod's audio goes into all of them and plays wherever the sound is used, but the mod gets bigger. With it off, only the banks the mod patched get it, as in the original.`} page={EVERY_BANK_PAGE} /></span>
            </label>
          </div>
        </section>

        <div className="bld-box rp-go">
          <button className="btn primary build" onClick={go} disabled={!scan || !!problem || busy || silent}
            data-tip={!scan ? t`Choose a mod first` : silent ? t`The mod holds no audio` : t`Apply the mod's audio and settings to the current sound banks and build a new ZIP`}>
            {running ? t`Repatching` : t`Repatch`}
          </button>
          {running && job && (
            <div className="rp-progress">
              <span>{job.doing || t`Starting…`}</span>
              <button className="btn quiet" onClick={() => actions.cancelJob(job.id)}><Trans>Cancel</Trans></button>
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
      <span className="field-label"><Trans>Patches</Trans> <Help tip={scan.manifest ? t`Each patch with audio is rebuilt where it was, so the options don't change.` : t`Without a manifest, each becomes an option of the new mod.`} page="repatching#repatching-a-mod" /></span>
      {audio.length === 0 ? <p className="warn-box"><Trans>The mod holds no audio, so there is nothing to repatch.</Trans></p> : (
        <ul>
          <li>{plural(ph({ patches: audio.length }), { one: "# patch with audio, rebuilt on the current game", other: "# patches with audio, rebuilt on the current game" })}</li>
          {plain > 0 && <li>{plural(plain, { one: "# patch without audio, kept as it is", other: "# patches without audio, kept as they are" })}</li>}
        </ul>
      )}
      <details className="rp-log">
        <summary><Trans>Show All</Trans></summary>
        <ul>
          {scan.patches.map((p) => (
            <li key={p.key}>{p.label || fileName(p.key)}{!p.audio ? <small>{t`No audio, kept as it is.`}</small> : (
              <>{p.files > 1 && <small>{plural(ph({ files: p.files }), { one: "# patch file, built into one.", other: "# patch files, built into one." })}</small>}
                {p.others.length > 0 && <small>{t`Also holds ${ph({ others: andList(p.others) })}, carried over.`}</small>}</>
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
        <h2>{job.state === "cancelled" ? t`Cancelled` : t`Repatching failed`}</h2>
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
    <section className="set-sec view-in rp-made" aria-label={t`Repatched`}>
      <h2><Trans>Repatched</Trans></h2>
      <p><b>{m.name}</b>: {fileName(m.zip)}, {m.mb.toLocaleString(intlLocale())} MB.
        {" "}{m.kept_id ? t`It keeps the old mod ID, so importing it in a mod manager updates the old mod.` : t`Remove the old mod in the mod manager before importing this one.`}</p>
      <div className="row-btns">
        <button className="btn" onClick={() => reveal(m.zip)}><Trans>Show in Folder</Trans></button>
        <button className="btn quiet" onClick={again}><Trans>Repatch Another Mod</Trans></button>
      </div>
      <dl className="set-facts rp-sum">
        <dt><Trans>Carried over</Trans></dt>
        <dd>{several ? rebuilt(built) : carried(built[0])}</dd>
        {plain.length > 0 && <><dt><Trans>Kept as it was</Trans></dt><dd>{plural(ph({ patches: plain.length }), { one: "# patch without audio", other: "# patches without audio" })}</dd></>}
        {left.length > 0 && (
          <><dt><Trans>Left out</Trans> <Help tip={t`Repatching carries over the mod's audio and sound settings, and leaves out other kinds of change. Listen to the result in game.`} page="repatching#what-repatching-leaves-out" /></dt>
            <dd>{left.length === 1 ? left[0] : t`${ph({ first: left[0] })}, and ${ph({ more: left.length - 1 })} more`}</dd></>
        )}
        {(stale.n > 0 || older.n > 0) && (
          <><dt><Trans>Older game version</Trans></dt>
            <dd>{stale.n > 0 && <span>{stale.upTo ? plural(ph({ sounds: stale.n }), { one: "up to # sound left out", other: "up to # sounds left out" })
              : plural(ph({ sounds: stale.n }), { one: "# sound left out", other: "# sounds left out" })} <Help tip={OLDER} page={OLDER_PAGE} /></span>}
              {stale.n > 0 && older.n > 0 && ", "}
              {older.n > 0 && <span>{older.upTo ? plural(ph({ objects: older.n }), { one: "up to # sound object updated", other: "up to # sound objects updated" })
                : plural(ph({ objects: older.n }), { one: "# sound object updated", other: "# sound objects updated" })} <Help tip={SHARED} page={SHARED_PAGE} /></span>}</dd></>
        )}
      </dl>
      {failed.length > 0 && (
        <div className="warn-box"><b>{plural(ph({ patches: failed.length }), { one: "Couldn't be repatched, kept as it was", other: "Couldn't be repatched, kept as they were" })}</b>
          <ul>{failed.map((p) => <li key={p.label}>{p.label}: {p.kept}</li>)}</ul>
        </div>
      )}
      <details className="rp-log rp-all">
        <summary><Trans>Show All</Trans></summary>
        {built.map((p) => (
          <div key={p.label} className="rp-mod">
            {several && <h3>{p.label}</h3>}
            <p className="set-note">{carried(p)}.</p>
            {!!p.stale && <p className="set-note">{plural(ph({ sounds: p.stale }), { one: "# sound from an older game version left out", other: "# sounds from an older game version left out" })}</p>}
            {!!p.older && <p className="set-note">{plural(ph({ objects: p.older }), { one: "# sound object from an older game version updated", other: "# sound objects from an older game version updated" })}</p>}
            {p.left.length > 0 && (
              <div className="info-box"><b>{t`Left out`}</b><ul>{p.left.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
            )}
          </div>
        ))}
        {plain.length > 0 && (
          <div className="rp-mod">
            <h3>{plural(ph({ patches: plain.length }), { one: "Without audio, kept as it was", other: "Without audio, kept as they were" })}</h3>
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
      <h2><Trans>Installed mods</Trans> <Help tip={t`Finds mods with sound banks from an older game version, in mod manager libraries and the game folder. Such a mod can mute sounds it never changed, like all gunfire.`} page="repatching#checking-installed-mods" /></h2>
      <div className="row-btns">
        <button className="btn" onClick={actions.checkMods} disabled={checking}>{checking ? t`Checking` : r ? t`Check Again` : t`Check Installed Mods`}</button>
        {checking && <span className="set-note">{job?.doing || t`Starting…`}</span>}
      </div>
      {job?.state === "failed" && <p className="warn-box">{job.error}</p>}
      {r && (
        <div className="view-in rp-found">
          {!r.library && <p className="set-note"><Trans>No mod manager library was found, so only the game folder was checked.</Trans></p>}
          {r.mods.length === 0 && <p className="set-note"><Trans>No installed mod has sound banks.</Trans></p>}
          {r.mods.map((m) => <InstalledMod key={m.source} m={m} busy={busy} onPick={onPick} />)}
          {r.quiet > 0 && <p className="set-note">{plural(ph({ mods: r.quiet }), { one: "# mod without sound banks not listed.", other: "# mods without sound banks not listed." })}</p>}
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
      <p><b>{m.name}</b><span className={`tag${flagged ? " warn" : ""}`}>{STATE_TEXT[m.state]}</span>{m.deployed && <span className="tag" data-tip={t`In the game folder now, so the game loads it`}>
        {t({ message: "Deployed", comment: "Tag on a mod that is in the game folder now" })}</span>}</p>
      {m.state === "shared" && (
        <p className="set-note">{widest.weapons
          ? t`Can mute sounds in ${plural(ph({ banks: widest.reach ?? 0 }), { one: "# other bank", other: "# other banks" })}, ${ph({ weapons: widest.weapons })} of them weapon banks.`
          : t`Can mute sounds in ${plural(ph({ banks: widest.reach ?? 0 }), { one: "# other bank", other: "# other banks" })}.`} <Help tip={SHARED} page={SHARED_PAGE} /></p>
      )}
      {m.state === "older" && <p className="set-note">{t`The mod's sounds can be wrong or missing.`} <Help tip={OLDER} page={OLDER_PAGE} /></p>}
      {mixed && (
        <details className="rp-log">
          <summary>{t`Options`}</summary>
          <ul>{m.patches.map((p) => <li key={p.file}>{p.label || fileName(p.file)}: {STATE_TEXT[p.state]}</li>)}</ul>
        </details>
      )}
      {flagged && (
        <div className="row-btns">
          <button className="btn quiet" disabled={busy} onClick={() => onPick(m.source)} data-tip={t`Open it in the form above, ready to repatch`}>{t`Repatch`}</button>
        </div>
      )}
    </div>
  );
}

/** "10 replaced sounds, 6 added sounds and the mod's settings on 4 sounds and containers", and the sounds that
    couldn't be read. */
function carried(p: Part) {
  const { imported, added, settings, skipped } = p;
  const what = listed([imported && plural(imported, { one: "# replaced sound", other: "# replaced sounds" }),
    added && plural(added, { one: "# added sound", other: "# added sounds" }),
    settings && plural(settings, { one: "settings on # sound or container", other: "settings on # sounds and containers" }), ...p.others]) || t`Nothing to carry over`;
  return skipped ? t`${what}; ${plural(skipped, { one: "# sound couldn't be read", other: "# sounds couldn't be read" })}` : what;
}

/** "4 patches, with 20 to 28 replaced or added sounds each", for a mod of several. */
function rebuilt(ps: Part[]) {
  const n = ps.map((p) => (p.imported ?? 0) + (p.added ?? 0)), lo = Math.min(...n), hi = Math.max(...n);
  const sounds = !hi ? "" : lo !== hi
    ? plural(hi, { one: `${lo} to # replaced or added sound each`, other: `${lo} to # replaced or added sounds each` })
    : ps.length > 1 ? plural(hi, { one: "# replaced or added sound each", other: "# replaced or added sounds each" })
    : plural(hi, { one: "# replaced or added sound", other: "# replaced or added sounds" });
  const list = listed([sounds, ps.some((p) => p.settings) && t`the mod's settings`, ps.some((p) => p.others.length) && t`other files`])
    || t`nothing to carry over`;
  return t`${plural(ph({ patches: ps.length }), { one: "# patch", other: "# patches" })}, with ${list}`;
}

function Details({ job }: { job: Job }) {
  return (
    <details className="rp-log">
      <summary><Trans comment="Noun: the lines written while the job ran">Log</Trans></summary>
      <pre>{job.log.join("\n") || "…"}</pre>
    </details>
  );
}

/** Beside the form: what repatching does and doesn't, in short. The Wiki's Repatching page says it in full. */
function About() {
  return (
    <div className="rp-text">
      <h3><Trans>What it does</Trans></h3>
      <ul>
        <li><Trans>Takes the audio that the mod replaces and adds, with sound settings such as volume and delays.</Trans></li>
        <li><Trans>Applies them to the game's current sound banks.</Trans></li>
        <li><Trans>Builds a new ZIP of the same mod, with the same options, files and ID. The audio isn't encoded again.</Trans></li>
        <li><Trans>Keeps what the patches hold besides audio, like text, models or textures, as it was.</Trans></li>
      </ul>
      <h3><Trans>When to use it</Trans></h3>
      <ul>
        <li><Trans>A mod's sounds went silent, wrong or missing after a game update.</Trans></li>
        <li><Trans>Other sounds, like all gunfire, go silent while the mod is installed. <b>Installed mods</b> below finds the mods that do this.</Trans></li>
      </ul>
      <h3><Trans>What it leaves out</Trans></h3>
      <ul>
        <li><Trans>Changes of other kinds in the sound banks, like effects or how a container picks sounds. Each repatch lists them.</Trans></li>
      </ul>
      <h3><Trans>Installing</Trans></h3>
      <ul>
        <li><Trans>Import the new ZIP in the mod manager in place of the old mod.</Trans></li>
      </ul>
      <p className="set-note"><Trans>A repatched mod is still the work of the original author. Keep it for personal use, and share it only with the author's permission.</Trans></p>
      <p className="set-note"><button className="link-text" onClick={() => nav.go("wiki", "repatching")}><Trans>More in the Wiki</Trans></button></p>
    </div>
  );
}
