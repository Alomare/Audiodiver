import { useEffect, useMemo, useRef, useState } from "react";
import { t, plural, ph } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { fileUrl, fmtTime, intlLocale, nameProblem, type Job } from "./api";
import { UTILS } from "./edition";
import { nav } from "./nav";
import { pickAudio, pickFolder, pickMod, reveal } from "./platform";
import { player, usePlayerLook } from "./player";
import { useEditor } from "./store";
import { Help } from "./Wiki";

/** A sound of the mod (Session.content_scan): its source ID, the name the Library gives it (none for a sound the game
    no longer has), the mod's banks that have it, and whether the current game has it. */
type Sound = { source: string; name: string; banks: string[]; kind: string; duration_ms: number; in_game: boolean };
type Scan = {
  source: string; name: string; manifest: boolean; zip: boolean; guid: boolean; folder: string;
  patches: number; banks: number; sounds: Sound[];
};
/** The written mod (Session.content_write's result). */
type Made = { name: string; zip: string; mb: number; sounds: number; patches: number; banks: number; kept_id: boolean; manifest: boolean };

const SHOWN = 300; // rows drawn at once: a music mod can hold thousands of sounds
const UTILS_AUDIO = ["wav", "wem"]; // the files Audiodiver Utils encodes without ffmpeg (a WAV only at 48 kHz, 16-bit)
const PAGE = "patch-content";

/** A mod or a file dropped on the window for this page (App.tsx's drop handler): held until the page takes it. A file
    dropped on a sound's row is new audio for that sound. */
export const contentInbox = (() => {
  let mod: string | null = null;
  const audio: [string, string][] = [];
  const listeners = new Set<() => void>();
  const tell = () => listeners.forEach((f) => f());
  return {
    offer(path: string) { mod = path; tell(); },
    offerAudio(source: string, path: string) { audio.push([source, path]); tell(); },
    take() { const p = mod; mod = null; return p; },
    takeAudio() { return audio.splice(0); },
    subscribe(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; },
  };
})();

// the mod being worked on, kept while another tab shows
let kept: { scan: Scan; choices: Record<string, string>; name: string; folder: string } | null = null;
let staleJob: string | null = null;
const fileName = (path: string) => path.split(/[\\/]/).pop()!;

/** Tools ▸ Patch Content: an existing mod opened as it is, its sounds listed, new audio given to some of them, and the
    mod written again with only that audio changed. A sound doesn't have to exist in the current game, so audio an
    update took out can still be modded through a mod that has it. */
export function PatchContentPage() {
  const { run, actions, jobs } = useEditor();
  const [scan, setScan] = useState<Scan | null>(kept?.scan ?? null);
  const [choices, setChoices] = useState<Record<string, string>>(kept?.choices ?? {}); // source -> file, or "" for silence
  const [name, setName] = useState(kept?.name ?? "");
  const [folder, setFolder] = useState(kept?.folder ?? "");
  const [reading, setReading] = useState(false);
  const [all, setAll] = useState(false);
  const [query, setQuery] = useState("");
  const [stale, setStale] = useState(staleJob);
  useEffect(() => { kept = scan && { scan, choices, name, folder }; }, [scan, choices, name, folder]);
  useEffect(() => { staleJob = stale; }, [stale]);
  const jobsNow = useRef(jobs);
  jobsNow.current = jobs;
  const top = useRef<HTMLElement>(null);

  /** Whether the core takes a file as new audio: without ffmpeg (Audiodiver Utils) only a .wem or a 16-bit WAV at
      48 kHz, and a notice says why not, before anything is written (Session.content_audio). */
  const takes = async (path: string) => !!(await run<{ path: string }>("content_audio", { path }));
  const read = async (path: string | null) => {
    if (!path) return;
    setReading(true);
    const s = await run<Scan>("content_scan", { path });
    setReading(false);
    if (!s) return;
    setStale(Object.values(jobsNow.current).filter((j) => j.kind === "content").pop()?.id ?? null);
    setScan(s);
    setChoices({});
    setName(s.name);
    setAll(!s.sounds.some((x) => !x.in_game));
    setFolder((f) => f || s.folder);
  };
  useEffect(() => {
    const take = () => {
      const p = contentInbox.take();
      if (p) read(p);
      const dropped = contentInbox.takeAudio();
      if (dropped.length) void Promise.all(dropped.map(async ([s, f]) => (await takes(f) ? [s, f] : null))).then((ok) => {
        const kept = ok.filter((x): x is [string, string] => !!x);
        if (kept.length) setChoices((c) => ({ ...c, ...Object.fromEntries(kept) }));
      });
    };
    take();
    return contentInbox.subscribe(take);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const job = Object.values(jobs).filter((j) => j.kind === "content").pop();
  const running = job?.state === "running";
  const busy = Object.values(jobs).some((j) => ["build", "repatch", "content"].includes(j.kind) && j.state === "running");
  const problem = scan ? nameProblem(name) : null;
  const picked = Object.keys(choices).length;
  const gone = scan ? scan.sounds.filter((s) => !s.in_game).length : 0;
  const shown = useMemo(() => {
    if (!scan) return [];
    const q = query.trim().toLowerCase();
    return scan.sounds.filter((s) => (all || !s.in_game || s.source in choices)
      && (!q || s.source.includes(q) || s.name.toLowerCase().includes(q) || s.banks.some((b) => b.toLowerCase().includes(q))));
  }, [scan, all, query, choices]);
  const go = () => scan && picked && actions.contentWrite(choices, name.trim(), folder);
  const again = () => {
    setScan(null); setChoices({}); setName(""); setStale(job?.id ?? null);
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const chooseFolder = async () => {
    const f = await pickFolder(folder || undefined, t`Choose where the new mod goes`);
    if (f) setFolder(f);
  };
  const choose = async (source: string) => {
    const files = await pickAudio(false, UTILS ? UTILS_AUDIO : undefined);
    if (files?.length && await takes(files[0])) setChoices((c) => ({ ...c, [source]: files[0] }));
  };
  const clear = (source: string) => setChoices(({ [source]: _, ...rest }) => rest);

  return (
    <div className="bld rp pc drop-page" data-drop={JSON.stringify({ kind: "content" })}>
      <div className="bld-main">
        <section className="set-sec" ref={top}>
          {scan ? (
            <div className="view-in rp-form drop-zone" key={scan.source}>
              <p className="path" data-tip={scan.source} data-tip-clip>{scan.source}</p>
              <p className="set-note">{plural(scan.sounds.length, { one: "# sound", other: "# sounds" })},{" "}
                {plural(scan.banks, { one: "# bank", other: "# banks" })}.{" "}
                {gone > 0 && plural(gone, { one: "# of them is not in the current game.", other: "# of them are not in the current game." })}</p>
              <div className="row-btns">
                <button className="btn quiet" disabled={running || reading} onClick={async () => read(await pickMod(t`Choose a mod`))}
                  data-tip={t`A ZIP or a .patch_0 file`}><Trans>Choose Another File</Trans></button>
                <button className="btn quiet" disabled={running || reading} onClick={async () => read(await pickFolder(undefined, t`Choose the mod folder`))}
                  data-tip={t`A mod unpacked into a folder`}><Trans>Choose Another Folder</Trans></button>
              </div>
            </div>
          ) : (
            <div className="rp-drop drop-zone">
              <p><Trans>Drop a mod here as a <b>ZIP</b>, a <b>folder</b> or a <b>.patch_0</b> file.</Trans></p>
              <div className="row-btns">
                <button className="btn" disabled={reading} onClick={async () => read(await pickMod(t`Choose a mod`))}><Trans>Choose a ZIP or Patch File</Trans></button>
                <button className="btn" disabled={reading} onClick={async () => read(await pickFolder(undefined, t`Choose the mod folder`))}><Trans>Choose a Folder</Trans></button>
              </div>
              {reading && <p className="set-note"><Trans>Reading…</Trans></p>}
            </div>
          )}
        </section>

        {scan && (
          <section className="set-sec">
            <h2><Trans>Sounds</Trans> <Help tip={t`Drop audio on a sound, or choose a file for it. The sounds without new audio stay as the mod has them.`} page={`${PAGE}#giving-sounds-new-audio`} /></h2>
            <div className="pc-tools">
              <div className="segmented narrow" role="radiogroup" aria-label={t`Sounds shown`}>
                <button role="radio" aria-checked={!all} className={!all ? "on" : ""} disabled={!gone} onClick={() => setAll(false)}
                  data-tip={t`The sounds that only the mod has, such as audio an update took out of the game`}>
                  {t`Not in the Game (${ph({ n: gone })})`}</button>
                <button role="radio" aria-checked={all} className={all ? "on" : ""} onClick={() => setAll(true)}>
                  {t`All Sounds (${ph({ n: scan.sounds.length })})`}</button>
              </div>
              <label className="pc-search"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t`Search by ID or name`} spellCheck={false}
                aria-label={t`Search by ID or name`} /></label>
            </div>
            {shown.length === 0 ? <p className="set-note"><Trans>No sound matches the search.</Trans></p> : (
              <ul className="pc-list">
                {shown.slice(0, SHOWN).map((s) => <Row key={s.source} s={s} choice={choices[s.source]} busy={running}
                  choose={() => choose(s.source)} silence={() => setChoices((c) => ({ ...c, [s.source]: "" }))} clear={() => clear(s.source)} />)}
              </ul>
            )}
            {shown.length > SHOWN && <p className="set-note">{t`Showing ${ph({ n: SHOWN })} of ${ph({ total: shown.length })}. Search to narrow the list.`}</p>}
          </section>
        )}

        {scan && (
          <section className="set-sec">
            <label className="field">
              <span className="field-label"><Trans>Name</Trans> <Help tip={t`Name shown in the mod manager.`} page={`${PAGE}#writing-the-mod`} /></span>
              <input value={name} maxLength={80} spellCheck={false} aria-invalid={!!problem} disabled={running} onChange={(e) => setName(e.target.value)} />
              {problem && <small className="bad">{problem}</small>}
            </label>
          </section>
        )}

        <section className="set-sec">
          <h2><Trans>Destination folder</Trans> <Help tip={t`The new ZIP goes here. A ZIP with the same name stays, and the new one gets a number.`} page={`${PAGE}#writing-the-mod`} /></h2>
          <p className="path" data-tip={folder || scan?.folder} data-tip-clip>{folder || scan?.folder || "Documents\\Audiodiver\\Repatched"}</p>
          <div className="row-btns">
            <button className="btn" onClick={chooseFolder} disabled={running}><Trans comment="Button that chooses another destination folder">Change</Trans></button>
          </div>
        </section>

        <div className="bld-box rp-go">
          <button className="btn primary build" onClick={go} disabled={!scan || !picked || !!problem || busy}
            data-tip={!scan ? t`Choose a mod first` : !picked ? t`Give a sound new audio first` : t`Write the mod again with the new audio, everything else as it was`}>
            {running ? t`Writing` : t`Write the Mod`}
          </button>
          {scan && picked > 0 && !running && <p className="set-note">{plural(picked, { one: "# sound with new audio", other: "# sounds with new audio" })}</p>}
          {running && job && (
            <div className="rp-progress">
              <span>{job.doing || t`Starting…`}</span>
              <button className="btn quiet" onClick={() => actions.cancelJob(job.id)}><Trans>Cancel</Trans></button>
            </div>
          )}
        </div>

        {job && !running && job.id !== stale && <Outcome job={job} again={again} />}
      </div>

      <aside className="bld-side rp-about">
        <About />
      </aside>
    </div>
  );
}

/** A sound of the mod: play the mod's audio, then what it is, and its new audio (a file, or silence). */
function Row({ s, choice, busy, choose, silence, clear }: {
  s: Sound; choice: string | undefined; busy: boolean; choose: () => void; silence: () => void; clear: () => void;
}) {
  const label = s.name || t`Sound ${ph({ id: s.source })}`;
  const banks = s.banks.length > 1 ? t`${ph({ first: s.banks[0] })} and ${plural(s.banks.length - 1, { one: "# more bank", other: "# more banks" })}` : s.banks[0] ?? "";
  return (
    <li className={`pc-row${choice !== undefined ? " on" : ""}`} data-drop={JSON.stringify({ kind: "content-sound", source: s.source })}>
      <ModPlay source={s.source} label={label} />
      <span className="pc-what">
        <span className="pc-name" data-tip={label} data-tip-clip>{label}</span>
        <small>{s.name ? `${t`ID ${ph({ id: s.source })}`} · ` : ""}{banks}{s.duration_ms ? ` · ${fmtTime(s.duration_ms)}` : ""}</small>
      </span>
      {!s.in_game && <span className="tag warn" data-tip={t`The current game doesn't have this sound. The banks in the mod bring it back.`}>{t`Not in the game`}</span>}
      <span className="pc-new">
        {choice === undefined ? (
          <>
            <button className="btn quiet" disabled={busy} onClick={choose}><Trans>Choose File</Trans></button>
            <button className="btn quiet" disabled={busy} onClick={silence} data-tip={t`Replace the sound with silence`}><Trans>Silence</Trans></button>
          </>
        ) : (
          <>
            {choice ? <FilePlay path={choice} /> : <span className="play-gap" />}
            <span className="pc-file" data-tip={choice || undefined} data-tip-clip>{choice ? fileName(choice) : t`Silence`}</span>
            <button className="btn quiet x" disabled={busy} onClick={clear} aria-label={t`Remove the new audio of ${ph({ label })}`}
              data-tip={t`Remove the new audio`}>✕</button>
          </>
        )}
      </span>
    </li>
  );
}

const previews = new Map<string, string>(); // source -> its WAV in the cache, for the mod read now

/** ▶ for the mod's audio of a sound, which the core decodes the first time. */
function ModPlay({ source, label }: { source: string; label: string }) {
  const { run } = useEditor();
  const k = `content:${source}`, { playing, loading, progress } = usePlayerLook(k);
  const [busy, setBusy] = useState(false);
  const play = async () => {
    let path = previews.get(source);
    if (!path) {
      setBusy(true);
      const r = await run<{ path: string }>("content_preview", { source });
      setBusy(false);
      if (!r) return;
      previews.set(source, (path = r.path));
    }
    player.play(k, fileUrl(path), false, t({ message: `${ph({ label })} in the mod`, comment: "A sound to play, after Play or Pause and in the now-playing bar" }));
  };
  const what = t({ message: `${ph({ label })} in the mod`, comment: "A sound to play, after Play or Pause and in the now-playing bar" });
  return (
    <button className={`play vanilla small${playing ? " playing" : ""}`} aria-label={playing ? t`Pause ${what}` : t`Play ${what}`}
      data-tip={playing ? t`Pause ${what}` : t`Play ${what}`} style={{ ["--progress" as any]: progress }} onClick={play}>
      <span aria-hidden>{loading || busy ? "…" : playing ? "❚❚" : "▶"}</span>
    </button>
  );
}

function FilePlay({ path }: { path: string }) {
  const k = `file:${path}`, { playing, loading, progress } = usePlayerLook(k), name = fileName(path);
  return (
    <button className={`play small${playing ? " playing" : ""}`} aria-label={playing ? t`Pause ${name}` : t`Play ${name}`}
      data-tip={playing ? t`Pause ${name}` : t`Play ${name}`} style={{ ["--progress" as any]: progress }}
      onClick={() => player.play(k, fileUrl(path), false, name)}>
      <span aria-hidden>{loading ? "…" : playing ? "❚❚" : "▶"}</span>
    </button>
  );
}

/** What the last write made, with Show in Folder and the log. */
function Outcome({ job, again }: { job: Job; again: () => void }) {
  if (job.state !== "done") {
    return (
      <section className="set-sec view-in">
        <h2>{job.state === "cancelled" ? t`Cancelled` : t`Writing failed`}</h2>
        {job.state !== "cancelled" && <p className="warn-box">{job.error}</p>}
        <Details job={job} />
      </section>
    );
  }
  const m: Made = job.result;
  return (
    <section className="set-sec view-in rp-made" aria-label={t`Written`}>
      <h2><Trans>Written</Trans></h2>
      <p><b>{m.name}</b>: {fileName(m.zip)}, {m.mb.toLocaleString(intlLocale())} MB.{" "}
        {m.kept_id ? t`It keeps the old mod ID, so importing it in a mod manager updates the old mod.` : t`Remove the old mod in the mod manager before importing this one.`}</p>
      <div className="row-btns">
        <button className="btn" onClick={() => reveal(m.zip)}><Trans>Show in Folder</Trans></button>
        <button className="btn quiet" onClick={again}><Trans>Open Another Mod</Trans></button>
      </div>
      <dl className="set-facts rp-sum">
        <dt><Trans>New audio</Trans></dt>
        <dd>{t`${plural(m.sounds, { one: "# sound", other: "# sounds" })} in ${plural(m.banks, { one: "# bank", other: "# banks" })}`}</dd>
        <dt><Trans>Kept as it was</Trans></dt>
        <dd><Trans>Everything else in the mod</Trans></dd>
      </dl>
      <Details job={job} />
    </section>
  );
}

function Details({ job }: { job: Job }) {
  return (
    <details className="rp-log">
      <summary><Trans comment="Noun: the lines written while the job ran">Log</Trans></summary>
      <pre>{job.log.join("\n") || "…"}</pre>
    </details>
  );
}

/** Beside the form: what Patch Content does and when it helps, in short. The Wiki says it in full. */
function About() {
  return (
    <div className="rp-text">
      <h3><Trans>What it does</Trans></h3>
      <ul>
        <li><Trans>Opens a mod as it is and lists the sounds in the patches, also those the current game no longer has.</Trans></li>
        <li><Trans>Puts new audio into the sounds chosen, in every bank and stream of the mod that has them.</Trans></li>
        <li><Trans>Keeps everything else as the mod has it: the banks, the other sounds, the options, files and ID.</Trans></li>
      </ul>
      <h3><Trans>When to use it</Trans></h3>
      <ul>
        <li><Trans>An update took a sound out of the game, and a mod made before it still has the sound. The game plays the banks in the mod, so the sound comes back with the new audio.</Trans></li>
      </ul>
      <h3><Trans>What to know</Trans></h3>
      <ul>
        <li><Trans>The banks in the mod stay as the game version it was made for had them. For sounds the game still has, a project or <b>Repatch</b> builds on the current banks.</Trans></li>
      </ul>
      <p className="set-note"><Trans>A mod made this way is still the work of the original author. Keep it for personal use, and share it only with the author's permission.</Trans></p>
      <p className="set-note"><button className="link-text" onClick={() => nav.go("wiki", PAGE)}><Trans>More in the Wiki</Trans></button></p>
    </div>
  );
}
