import { useEffect, useMemo, useRef, useState } from "react";
import { t, plural, ph } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { andList, audioUrl, fileUrl, fmtTime, intlLocale, nameProblem, type Job } from "./api";
import { EVERY_BANK_PAGE } from "./content";
import { Fold } from "./Fold";
import { CollapseAllIcon } from "./Icons";
import { nav } from "./nav";
import { pickFolder, pickMods, reveal } from "./platform";
import { player, usePlayerLook } from "./player";
import { useEditor } from "./store";
import { Help } from "./Wiki";

/** What the core found in a mod (Session.combine_scan): its options as a mod manager shows them, and the default
    choice. `picks` holds the ids of the Options that are on; for an Option with SubOptions, the chosen one's id. */
type ModScan = {
  source: string; name: string; description: string; manifest: boolean; others: string[];
  options: { id: string; name: string; sub: { id: string; name: string }[] }[];
  picks: string[];
};
type Mod = { scan: ModScan; picks: string[] };
/** Two or more mods change the same thing (core combine.py): each mod's version, and the one that goes in. */
type Clash = {
  id: string; kind: "sound" | "clip" | "setting"; label: string; source?: string;
  setting?: string; unit?: "dB" | "cents" | "s" | ""; // a setting: its name (also at the end of the label) and the unit of its values
  versions: { mod: number; audio?: string; ms?: number; value?: number }[]; winner: number;
};
/** A setting's unit as it follows a value (core combine.PROP_UNITS); the filters go from 0 to 100 and have none. */
const unitOf = (c: Clash) => (c.unit === "cents" ? ` ${t({ message: "cents", comment: "The unit of pitch: hundredths of a semitone, after a number" })}`
  : c.unit ? ` ${c.unit}` : "");
const fmtValue = (x: number) => `${x < 0 ? "−" : ""}${Math.abs(x).toLocaleString(intlLocale(), { maximumFractionDigits: 2 })}`;
type Read = { mods: { source: string; name: string; left: string[]; sounds: number }[]; groups: { item: string; name: string; clashes: Clash[] }[] };
type Made = {
  name: string; zip: string; mb: number;
  mods: { name: string; imported: number; added: number; settings: number; stale: number; older: number; left: string[]; others: string[] }[];
};
type Installed = { mods: { name: string; source: string; deployed: boolean }[]; library: boolean };

const fileName = (path: string) => path.split(/[\\/]/).pop()!;
const OPEN_ALL = 30; // more conflicts than this start folded

/** Mods dropped on the window for this page (App.tsx's drop handler): held until the page takes them. */
export const combineInbox = (() => {
  let waiting: string[] = [];
  const listeners = new Set<() => void>();
  return {
    offer(paths: string[]) { waiting = [...waiting, ...paths]; nav.go("tools", "combine"); listeners.forEach((f) => f()); },
    take() { const p = waiting; waiting = []; return p; },
    subscribe(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; },
  };
})();

// what is being set up, kept while another tab shows
let kept: {
  mods: Mod[]; name: string; named: boolean; folder: string; everyBank: boolean; checked: string; winners: Record<string, number>;
  picked: Record<string, string>;
} | null = null;

/** The mods, their order and choices, as one string: a conflict check is for exactly these. */
const signature = (mods: Mod[]) => JSON.stringify(mods.map((m) => [m.scan.source, [...m.picks].sort()]));
/** The name a combined mod gets until one is typed: the mods' names, or the first one's and how many more. */
function defaultName(mods: Mod[]) {
  const names = mods.map((m) => m.scan.name);
  const all = names.join(" + ");
  if (all.length <= 60 || names.length < 2) return all.slice(0, 80);
  const short = `${names[0]} + ${names.length - 1} more`;
  return short.length <= 80 ? short : "Combined mods";
}

/** Tools ▸ Combine Mods: several audio mods (ZIPs, folders, .patch_0 files, or mods in a mod manager's library), each
    with the options it should have, made into one mod built on the current game. Where two mods change the same
    sound, the user picks which mod's goes in (the lower one by default, as it deploys later). The explanations sit
    beside it, the rest in the Wiki. */
export function CombinePage() {
  const { run, actions, jobs } = useEditor();
  const [mods, setMods] = useState<Mod[]>(kept?.mods ?? []);
  const [name, setName] = useState(kept?.name ?? "");
  const [named, setNamed] = useState(kept?.named ?? false); // typed by hand: the list no longer names it
  const [folder, setFolder] = useState(kept?.folder ?? "");
  const [everyBank, setEveryBank] = useState(kept?.everyBank ?? false);
  const [checked, setChecked] = useState(kept?.checked ?? ""); // the signature the last check was started for
  const [winners, setWinners] = useState<Record<string, number>>(kept?.winners ?? {});
  // the choices made by hand, by the mod's source, so that they outlast a new check (the order may have changed)
  const [picked, setPicked] = useState<Record<string, string>>(kept?.picked ?? {});
  const [reading, setReading] = useState(0);
  const [installed, setInstalled] = useState<Installed | null>(null);
  useEffect(() => { kept = { mods, name, named, folder, everyBank, checked, winners, picked }; }, [mods, name, named, folder, everyBank, checked, winners, picked]);
  useEffect(() => { if (!folder) run<string>("combine_folder").then((f) => f && setFolder((now) => now || f)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!named) setName(defaultName(mods)); }, [mods, named]);

  const add = async (paths: string[]) => {
    setReading((n) => n + 1);
    for (const path of paths) {
      const s = await run<ModScan>("combine_scan", { path });
      if (s) setMods((list) => (list.some((m) => m.scan.source === s.source) ? list : [...list, { scan: s, picks: s.picks }]));
    }
    setReading((n) => n - 1);
  };
  const addRef = useRef(add);
  addRef.current = add;
  useEffect(() => { // mods dropped on the window, now or while this page wasn't showing
    const take = () => { const p = combineInbox.take(); if (p.length) addRef.current(p); };
    take();
    return combineInbox.subscribe(take);
  }, []);

  const readJob = Object.values(jobs).filter((j) => j.kind === "combine_read").pop();
  const job = Object.values(jobs).filter((j) => j.kind === "combine").pop();
  // a check asked for and not yet in the jobs: the one before it (asked) still shows there meanwhile
  const [asked, setAsked] = useState<string | null>(null);
  const waiting = asked !== null && (readJob?.id ?? "") === asked;
  const checking = waiting || readJob?.state === "running", combining = job?.state === "running";
  const sig = signature(mods);
  const result: Read | null = readJob?.state === "done" && !waiting ? readJob.result : null;
  const fresh = !!result && checked === sig;
  // a new check's answer: its winners are the core's defaults, but for the mods chosen by hand before
  const seen = useRef(readJob?.id);
  useEffect(() => {
    if (!result || seen.current === readJob?.id) return;
    seen.current = readJob?.id;
    const at = (source?: string) => result.mods.findIndex((m) => m.source === source);
    setWinners(Object.fromEntries(result.groups.flatMap((g) => g.clashes.map((c) => {
      const mine = at(picked[c.id]);
      return [c.id, mine >= 0 && c.versions.some((v) => v.mod === mine) ? mine : c.winner];
    }))));
  }, [result, readJob?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  /** Sets the winners of some conflicts, remembered by the mod's source too. */
  const choose = (chosen: Record<string, number>) => {
    setWinners((w) => ({ ...w, ...chosen }));
    setPicked((p) => ({ ...p, ...Object.fromEntries(Object.entries(chosen).map(([id, m]) => [id, result?.mods[m]?.source ?? ""])) }));
  };

  const check = async () => {
    setAsked(readJob?.id ?? "");
    setChecked(sig);
    if (!(await actions.combineRead(mods.map((m) => ({ source: m.scan.source, picks: m.picks }))))) setAsked(null);
  };
  const problem = nameProblem(name);
  const busy = Object.values(jobs).some((j) => ["build", "repatch", "combine", "combine_read"].includes(j.kind) && j.state === "running");
  const go = () => fresh && !problem && actions.combine(mods.map((m) => ({ source: m.scan.source, picks: m.picks })), winners, name.trim(), folder, everyBank);
  const move = (i: number, d: -1 | 1) => setMods((list) => {
    const next = [...list];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    return next;
  });
  const setPicks = (i: number, picks: string[]) => setMods((list) => list.map((m, j) => (j === i ? { ...m, picks } : m)));
  const findInstalled = async () => { const r = await run<Installed>("combine_installed"); if (r) setInstalled(r); };

  return (
    <div className="bld rp cmb drop-page" data-drop={JSON.stringify({ kind: "combine" })}>
      <div className="bld-main">
        <section className="set-sec">
          <h2><Trans>Mods</Trans> <Help tip={t`The order counts where two mods change the same sound. A mod lower in the list wins, as it does when a mod manager deploys it later.`} page="combining-mods#order-and-conflicts" /></h2>
          {mods.length > 0 && (
            <ol className="cmb-mods drop-zone">
              {mods.map((m, i) => (
                <li key={m.scan.source} className="cmb-mod view-in">
                  <div className="cmb-mod-head">
                    <span className="cmb-n" aria-hidden>{i + 1}</span>
                    <b className="cmb-name" data-tip={m.scan.source}>{m.scan.name}</b>
                    <button className="icon-btn" disabled={i === 0 || checking || combining} onClick={() => move(i, -1)} aria-label={t`Move ${ph({ name: m.scan.name })} up`}
                      data-tip={t`Move up`} data-tip-more={t`A mod lower in the list wins conflicts by default`}>↑</button>
                    <button className="icon-btn" disabled={i === mods.length - 1 || checking || combining} onClick={() => move(i, 1)} aria-label={t`Move ${ph({ name: m.scan.name })} down`}
                      data-tip={t`Move down`} data-tip-more={t`A mod lower in the list wins conflicts by default`}>↓</button>
                    <button className="icon-btn" disabled={checking || combining} onClick={() => setMods((list) => list.filter((_, j) => j !== i))}
                      aria-label={t`Remove ${ph({ name: m.scan.name })} from the list`} data-tip={t`Remove from the list`}>✕</button>
                  </div>
                  {m.scan.options.length > 0 && <Options mod={m} disabled={checking || combining} onChange={(p) => setPicks(i, p)} />}
                  {m.scan.others.length > 0 && <small className="cmb-other">{t`Also holds ${ph({ others: andList(m.scan.others) })}, carried over.`}</small>}
                </li>
              ))}
            </ol>
          )}
          <div className={mods.length ? "row-btns" : "rp-drop drop-zone"}>
            {!mods.length && <p><Trans>Drop mods here as <b>ZIPs</b>, <b>folders</b> or <b>.patch_0</b> files.</Trans></p>}
            <div className="row-btns">
              <button className="btn" disabled={combining} onClick={async () => { const p = await pickMods(); if (p) add(p); }}><Trans>Add ZIPs or Patch Files</Trans></button>
              <button className="btn" disabled={combining} onClick={async () => { const f = await pickFolder(undefined, t`Choose a mod folder`); if (f) add([f]); }}><Trans>Add a Folder</Trans></button>
              <button className="btn quiet" disabled={combining} onClick={findInstalled}><Trans>Installed Mods</Trans></button>
            </div>
            {reading > 0 && <p className="set-note"><Trans>Reading…</Trans></p>}
          </div>
          {installed && (
            <div className="cmb-installed view-in">
              {!installed.library && <p className="set-note"><Trans>No mod manager library was found.</Trans></p>}
              {installed.mods.length ? (
                <ul>
                  {installed.mods.map((m) => {
                    const on = mods.some((x) => x.scan.source === m.source);
                    return (
                      <li key={m.source}>
                        <button className="link-text" disabled={on || combining} onClick={() => add([m.source])} data-tip={on ? t`On the list` : t`Add to the list`}>{m.name}</button>
                        {m.deployed && <span className="tag" data-tip={t`In the game folder now, so the game loads it`}>
                          {t({ message: "Deployed", comment: "Tag on a mod that is in the game folder now" })}</span>}
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="set-note"><Trans>No installed mod has sound banks.</Trans></p>}
              <button className="link-inline" onClick={() => setInstalled(null)}><Trans comment="Button that hides the list of installed mods">Hide</Trans></button>
            </div>
          )}
        </section>

        <section className="set-sec">
          <h2><Trans>Conflicts</Trans> <Help tip={t`Sounds that more than one mod changes. Choose which mod's version goes in.`} page="combining-mods#order-and-conflicts" /></h2>
          <div className="row-btns">
            <button className="btn" onClick={check} disabled={mods.length < 2 || checking || combining}
              data-tip={mods.length < 2 ? t`Add at least two mods` : undefined}>{checking ? t`Checking` : fresh ? t`Check Again` : t`Check for Conflicts`}</button>
            {checking && (waiting || !readJob ? <span className="set-note"><Trans>Starting…</Trans></span> : (
              <>
                <span className="set-note">{readJob.doing || t`Starting…`}</span>
                <button className="btn quiet" onClick={() => actions.cancelJob(readJob.id)}><Trans>Cancel</Trans></button>
              </>
            ))}
          </div>
          {readJob?.state === "failed" && !waiting && checked === sig && <p className="warn-box">{readJob.error}</p>}
          {result && !fresh && !checking && <p className="set-note"><Trans>The list changed since the last check.</Trans></p>}
          {result && fresh && <Conflicts read={result} winners={winners} choose={choose} />}
        </section>

        <section className="set-sec">
          <h2><Trans>The combined mod</Trans></h2>
          <label className="field">
            <span className="field-label"><Trans>Name</Trans> <Help tip={t`Name shown in the mod manager.`} page="combining-mods#combining-mods" /></span>
            <input value={name} maxLength={80} spellCheck={false} aria-invalid={!!problem} disabled={combining}
              onChange={(e) => { setName(e.target.value); setNamed(true); }} />
            {problem && mods.length > 0 && <small className="bad">{problem}</small>}
          </label>
          <span className="field-label"><Trans>Destination folder</Trans> <Help tip={t`The new ZIP goes here. A ZIP with the same name stays, and the new one gets a number.`} page="combining-mods#destination-folder" /></span>
          <p className="path" data-tip={folder} data-tip-clip>{folder || "Documents\\Audiodiver\\Combined"}</p>
          <div className="row-btns">
            <button className="btn" disabled={combining} onClick={async () => { const f = await pickFolder(folder || undefined, t`Choose where combined mods go`); if (f) setFolder(f); }}>
              <Trans comment="Button that chooses another destination folder">Change</Trans></button>
          </div>
          <div className="set-list">
            <label className="check">
              <input type="checkbox" checked={everyBank} disabled={combining} onChange={(e) => setEveryBank(e.target.checked)} />
              <span><Trans>Patch every bank with the sounds</Trans> <Help tip={t`A sound is often in many banks, such as a clip that several weapons share. With this on, the mods' audio goes into all of them, but the mod gets bigger. With it off, only the banks the mods patched get it.`} page={EVERY_BANK_PAGE} /></span>
            </label>
          </div>
        </section>

        <div className="bld-box rp-go">
          <button className="btn primary build" onClick={go} disabled={!fresh || !!problem || busy}
            data-tip={mods.length < 2 ? t`Add at least two mods` : !fresh ? t`Check for conflicts first` : t`Build one mod from these on the current sound banks`}>
            {combining ? t`Combining` : t`Combine`}
          </button>
          {combining && job && (
            <div className="rp-progress">
              <span>{job.doing || t`Starting…`}</span>
              <button className="btn quiet" onClick={() => actions.cancelJob(job.id)}><Trans>Cancel</Trans></button>
            </div>
          )}
        </div>

        {job && !combining && <Outcome job={job} />}
      </div>

      <aside className="bld-side rp-about">
        <About />
      </aside>
    </div>
  );
}

/** A mod's options as a mod manager has them: each can be on or off, and one with choices of its own takes one.
    Import Mod shows them too, with its own `help`. */
export function Options({ mod, disabled, onChange, help }: {
  mod: { scan: Pick<ModScan, "options">; picks: string[] }; disabled: boolean; onChange: (picks: string[]) => void;
  help?: { tip: string; page: string };
}) {
  const { scan, picks } = mod;
  const h = help ?? { tip: t`The options of this mod that go into the combined mod. They start as the mod manager has them, or all on`, page: "combining-mods#combining-mods" };
  return (
    <div className="cmb-options">
      <span className="field-label"><Trans>Options</Trans> <Help tip={h.tip} page={h.page} /></span>
      {scan.options.map((o) => {
        const chosen = o.sub.find((s) => picks.includes(s.id));
        const on = o.sub.length ? !!chosen : picks.includes(o.id);
        const without = picks.filter((p) => p !== o.id && !o.sub.some((s) => s.id === p));
        return (
          <div key={o.id} className="cmb-option">
            <label className="check">
              <input type="checkbox" checked={on} disabled={disabled}
                onChange={(e) => onChange(e.target.checked ? [...without, o.sub.length ? o.sub[0].id : o.id] : without)} />
              <span>{o.name}</span>
            </label>
            {o.sub.length > 0 && (
              <select value={chosen?.id ?? o.sub[0].id} disabled={disabled || !on} aria-label={t`${ph({ option: o.name })}: choice`}
                onChange={(e) => onChange([...without, e.target.value])}>
                {o.sub.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** The conflicts, by Index item: each sound with the original and every mod's version to play, and the mod whose
    version goes in. Inside an item, one line sets one mod for all of it. A mod shows as its number in the list and its
    name, cut short (the whole name in the tooltip). */
function Conflicts({ read, winners, choose }: { read: Read; winners: Record<string, number>; choose: (w: Record<string, number>) => void }) {
  const total = read.groups.reduce((n, g) => n + g.clashes.length, 0);
  const [shut, setShut] = useState<Set<string>>(() => new Set(total > OPEN_ALL ? read.groups.map((g) => g.item || g.name) : []));
  if (!total) return <p className="set-note view-in"><Trans>No conflicts.</Trans></p>;
  const toggle = (k: string) => setShut((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const modName = (i: number) => read.mods[i]?.name ?? t`Mod ${ph({ number: i + 1 })}`;
  return (
    <div className="cmb-conflicts view-in">
      <div className="cmb-sum">
        <span>{t`${plural(total, { one: "# conflict", other: "# conflicts" })} in ${plural(ph({ items: read.groups.length }), { one: "# item", other: "# items" })}`}</span>
        <button className="icon-btn" disabled={shut.size === read.groups.length} aria-label={t`Collapse all`} data-tip={t`Collapse all`}
          onClick={() => setShut(new Set(read.groups.map((g) => g.item || g.name)))}><CollapseAllIcon /></button>
      </div>
      {read.groups.map((g) => {
        const k = g.item || g.name, open = !shut.has(k);
        const involved = [...new Set(g.clashes.flatMap((c) => c.versions.map((v) => v.mod)))].sort((a, b) => a - b);
        return (
          <div key={k} className="cmb-group">
            <button className="lib-group-head" aria-expanded={open} onClick={() => toggle(k)}>
              <span className="caret" aria-hidden>▸</span>
              <span className="lib-group-name">{g.name}</span>
              <span className="grp-n">{plural(ph({ conflicts: g.clashes.length }), { one: "# conflict", other: "# conflicts" })}</span>
            </button>
            <Fold open={open}>
              {g.clashes.length > 1 && (
                <div className="cmb-all">
                  <span>{t({ message: "All from", comment: "Before a row of mod buttons: the mod clicked wins every conflict of this item" })}</span>
                  {involved.map((m) => (
                    <ModChip key={m} n={m} name={modName(m)} about={t`Use this mod for every conflict in this item`}
                      on={g.clashes.every((c) => winners[c.id] === m || !c.versions.some((v) => v.mod === m))}
                      pick={() => choose(Object.fromEntries(g.clashes.filter((c) => c.versions.some((v) => v.mod === m)).map((c) => [c.id, m])))} />
                  ))}
                </div>
              )}
              <ul className="cmb-clashes">
                {g.clashes.map((c) => <ClashLine key={c.id} c={c} winner={winners[c.id] ?? c.winner} modName={modName}
                  pick={(m) => choose({ [c.id]: m })} />)}
              </ul>
            </Fold>
          </div>
        );
      })}
    </div>
  );
}

/** One conflict: the original to play, what it is, and under it each mod's version to play and choose. */
function ClashLine({ c, winner, modName, pick }: { c: Clash; winner: number; modName: (i: number) => string; pick: (m: number) => void }) {
  const what = c.kind === "setting" ? t({ message: "a setting", comment: "After the name of a conflict: the mods change a setting, not audio" })
    : c.kind === "clip" ? t({ message: "only this sound", comment: "After the name of a conflict: a clip that a mod added for this sound only" }) : "";
  return (
    <li className="cmb-clash">
      <div className="cmb-clash-head">
        {c.source ? <Play url={audioUrl("vanilla", c.source)} k={`vanilla:${c.source}`}
          label={t({ message: `the original ${ph({ label: c.label })}`, comment: "A sound to play, after Play or Pause and in the now-playing bar" })} />
          : <span className="play-gap" />}
        <span className="cmb-label" data-tip={c.label} data-tip-clip>{c.label}{what && <small data-tip={c.kind === "clip"
          ? t`A separate clip that a mod added for this sound only` : undefined}> · {what}</small>}</span>
      </div>
      <div className="cmb-versions" role="radiogroup" aria-label={t`Which mod's ${ph({ label: c.label })}`}>
        {c.versions.map((v) => (
          <span key={v.mod} className="cmb-version">
            {v.audio ? <Play url={fileUrl(v.audio)} k={`file:${v.audio}`}
              label={t({ message: `${ph({ mod: modName(v.mod) })}'s ${ph({ label: c.label })}`, comment: "A sound to play, after Play or Pause and in the now-playing bar" })} />
              : <span className="play-gap" />}
            <ModChip n={v.mod} name={modName(v.mod)} on={winner === v.mod} pick={() => pick(v.mod)} radio
              more={v.ms != null ? fmtTime(v.ms) : v.value != null ? `${fmtValue(v.value)}${unitOf(c)}` : undefined}
              about={v.ms != null ? t`Length ${ph({ length: fmtTime(v.ms) })}` : v.value != null ? `${c.setting ?? ""} ${fmtValue(v.value)}${unitOf(c)}` : undefined} />
          </span>
        ))}
      </div>
    </li>
  );
}

/** A mod to choose: its number in the list and its name, cut short to fit. */
function ModChip({ n, name, on, pick, radio, more, about }: {
  n: number; name: string; on: boolean; pick: () => void; radio?: boolean; more?: string; about?: string;
}) {
  return (
    <button role={radio ? "radio" : undefined} aria-checked={radio ? on : undefined} aria-pressed={radio ? undefined : on}
      className={`chip cmb-chip${on ? " on" : ""}`} onClick={pick} data-tip={name} data-tip-more={about ?? more}>
      <span className="cmb-chip-n">{n + 1}</span><span className="cmb-chip-name">{name}</span>
      {more && <span className="cmb-chip-more">{more}</span>}
    </button>
  );
}

/** A small play button for audio that isn't a slot of what is open: a game sound, or a mod's file. */
function Play({ url, k, label }: { url: string; k: string; label: string }) {
  const { playing, loading, progress } = usePlayerLook(k);
  return (
    <button className={`play vanilla small${playing ? " playing" : ""}`} aria-label={playing ? t`Pause ${label}` : t`Play ${label}`}
      data-tip={playing ? t`Pause ${label}` : t`Play ${label}`} style={{ ["--progress" as any]: progress }}
      onClick={() => player.play(k, url, false, label)}>
      <span aria-hidden>{loading ? "…" : playing ? "❚❚" : "▶"}</span>
    </button>
  );
}

/** What the last combine made, what it left out, and its log. */
function Outcome({ job }: { job: Job }) {
  const m: Made | null = job.state === "done" ? job.result : null;
  const lines = useMemo(() => m?.mods.map((x) => {
    const { imported, added, settings } = x;
    const got = [imported && plural(imported, { one: "# replaced sound", other: "# replaced sounds" }), added && plural(added, { one: "# added sound", other: "# added sounds" }),
      settings && plural(settings, { one: "settings on # sound or container", other: "settings on # sounds and containers" }), ...x.others].filter(Boolean) as string[];
    return { ...x, got: andList(got) || t`Nothing went in` };
  }) ?? [], [m]);
  if (!m) {
    return (
      <section className="set-sec view-in">
        <h2>{job.state === "cancelled" ? t`Cancelled` : t`Combining failed`}</h2>
        {job.state !== "cancelled" && <p className="warn-box">{job.error}</p>}
        <details className="rp-log"><summary><Trans comment="Noun: the lines written while the job ran">Log</Trans></summary><pre>{job.log.join("\n") || "…"}</pre></details>
      </section>
    );
  }
  return (
    <section className="set-sec view-in rp-made" aria-label={t`Combined`}>
      <h2><Trans>Combined</Trans></h2>
      <p><b>{m.name}</b>: {fileName(m.zip)}, {m.mb.toLocaleString(intlLocale())} MB. <Trans>In the mod manager, turn off the mods it combines before deploying it.</Trans></p>
      <div className="row-btns">
        <button className="btn" onClick={() => reveal(m.zip)}><Trans>Show in Folder</Trans></button>
      </div>
      {lines.map((x) => (
        <div key={x.name} className="rp-mod">
          <h3>{x.name}</h3>
          <p className="set-note">{x.got}.</p>
          {x.stale > 0 && <p className="set-note">{plural(ph({ sounds: x.stale }), { one: "# sound from an older game version left out", other: "# sounds from an older game version left out" })}{" "}
            <Help tip={t`The mod's sound banks are from an older game version and still had these sounds. The current game no longer has them.`} page="repatching#sounds-from-an-older-game-version" /></p>}
          {x.left.length > 0 && (
            <div className="info-box"><b>{t`Left out`}</b> <Help tip={t`Combining carries over the mods' audio and sound settings, and leaves out other kinds of change.`} page="combining-mods#what-combining-leaves-out" />
              <ul>{x.left.map((l, i) => <li key={i}>{l}</li>)}</ul>
            </div>
          )}
        </div>
      ))}
      <details className="rp-log"><summary><Trans comment="Noun: the lines written while the job ran">Log</Trans></summary><pre>{job.log.join("\n") || "…"}</pre></details>
    </section>
  );
}

/** Beside the form: what combining does and doesn't, in short. The Wiki's page says it in full. */
function About() {
  return (
    <div className="rp-text">
      <h3><Trans>What it does</Trans></h3>
      <ul>
        <li><Trans>Takes the audio and sound settings of each mod with the chosen options, and copies other files, like text or textures, unchanged.</Trans></li>
        <li><Trans>Lists the sounds that more than one mod changes, to play and choose from.</Trans></li>
        <li><Trans>Builds one mod on the current sound banks.</Trans></li>
      </ul>
      <h3><Trans>When to use it</Trans></h3>
      <ul>
        <li><Trans>Two mods change the same sound banks, so only the one deployed last plays.</Trans></li>
        <li><Trans>Several small mods are easier to keep as one.</Trans></li>
      </ul>
      <h3><Trans>What it leaves out</Trans></h3>
      <ul>
        <li><Trans>Changes of other kinds in the sound banks, like effects. The result lists them for each mod.</Trans></li>
        <li><Trans>Of two mods with the same file besides audio, the one lower in the list goes in.</Trans></li>
      </ul>
      <h3><Trans>Installing</Trans></h3>
      <ul>
        <li><Trans>Turn off the combined mods in the mod manager, then import and deploy the new ZIP.</Trans></li>
      </ul>
      <p className="set-note"><Trans>A combined mod is still the work of the original authors. Keep it for personal use, and share it only with their permission.</Trans></p>
      <p className="set-note"><button className="link-text" onClick={() => nav.go("wiki", "combining-mods")}><Trans>More in the Wiki</Trans></button></p>
    </div>
  );
}
