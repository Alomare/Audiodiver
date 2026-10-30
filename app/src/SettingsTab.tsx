import { useEffect, useMemo, useRef, useState } from "react";
import { i18n } from "@lingui/core";
import { ph, plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { andList, call, fmtBytes, intlLocale } from "./api";
import { confirm } from "./Confirm";
import { UTILS } from "./edition";
import { captureChord, COMMANDS, FIXED, fmtChord, keyLabel, keymap, useKeymap, type CommandId } from "./keys";
import { HIDEABLE, nav, useNav, type Hideable, type SettingsTab as Sub } from "./nav";
import { Page, tabArrows } from "./Page";
import { pickFolder, pickNotesFile, pickNotesToSave, reveal } from "./platform";
import { rangeVars } from "./range";
import { player } from "./player";
import { AUTOSAVE_DEFAULT, AUTOSAVE_MAX, DEFAULT_SETTINGS, NOTICE_CORNERS, resetLayout, settings, TIP_SPEEDS, UPDATE_MODES, UPDATE_NOTES, useSettings } from "./settings";
import { useEditor } from "./store";
import { notes, useGlobalNotes, type GlobalNotes } from "./noteStore";
import { useDialog } from "./dialog";
import { Help } from "./Wiki";
import { autoLanguage, chooseLanguage, chosenLanguage, languageName, LANGUAGES, PSEUDO, type Choice } from "./i18n";
import { accentFor, BAR_SIDES, barIsVertical, BLUE_HUE, contrastOn, DEFAULT_SIZE, DEFAULT_THEME, DEFAULT_WARMTH, DENSITIES, FONTS, modeOf, motionOn, nightTint,
  RESET_THEME, secondFor, SPEEDS, systemReducesMotion, systemWantsContrast, TEXT_SIZES, theme, useTheme, WARMTH, YELLOW_HUE, type FontId } from "./theme";

const minutes = (count: number) => plural(count, { one: "# minute", other: "# minutes" });
const everyMinutes = (count: number) => plural(count, { one: "Every # minute", other: "Every # minutes" });
const pixels = (count: number) => plural(count, { one: "# pixel", other: "# pixels" });
const timesNormal = (speed: number) => plural(speed, { one: "# times normal", other: "# times normal" });

const SUBS: [Sub, string, string][] = UTILS ? [
  ["system", t`System`, t`Game folder, updates, tooltips, disk space`],
  ["theme", t`Theme`, t`Dark or light, contrast, text size`],
] : [
  ["system", t`System`, t`Game folder, tabs, startup, updates, tooltips, notifications, global notes, disk space, layout`],
  ["shortcuts", t`Shortcuts`, t`Shortcut keys and rebinding`],
  ["theme", t`Theme`, t`Colours, text, spacing, the tab bar, animations`],
];

/** The Settings tab (the gear): System, Shortcuts and Theme. Settings are kept per user, not per project. About
    (version, licence, log file, credits) is the ⓘ by the version in the status bar, About.tsx. */
export function SettingsTab() {
  const { settings: sub } = useNav();
  return (
    <Page title={t`Settings`}>
      <div className="sub-tabs" role="tablist" aria-label={t`Settings`} onKeyDown={tabArrows}>
        {SUBS.map(([id, name, about]) => (
          <button key={id} role="tab" aria-selected={sub === id} className={sub === id ? "on" : ""} data-tip={about}
            onClick={() => nav.go("settings", id)}>{name}</button>
        ))}
      </div>
      <div className="view-in" key={sub}>
        {sub === "system" ? <System /> : sub === "shortcuts" ? <Shortcuts /> : <Theme />}
      </div>
    </Page>
  );
}

// ---------------------------------------------------------------- System

type Cache = { folder: string; previews: number; encoded: number };

/** A tick for each tab that can be hidden (Settings ▸ System, and each project on the Project tab). */
const TAB_NAMES: [Hideable, string][] = [["editor", t`Audio`], ["soundtrack", t`Soundtrack`], ["text", t`Text`]];
export function TabChecks({ value, onChange }: { value: Hideable[]; onChange: (tabs: Hideable[]) => void }) {
  return (
    <div className="tab-checks">
      {TAB_NAMES.map(([id, name]) => (
        <label key={id} className="check">
          <input type="checkbox" checked={value.includes(id)}
            onChange={(e) => onChange(HIDEABLE.filter((t) => (t === id ? e.target.checked : value.includes(t))))} />
          <span>{name}</span>
        </label>
      ))}
    </div>
  );
}

/** The language of the window and of what the core says. Automatic follows the game's language in Steam, then
    Windows (i18n.ts); a change loads the window again. */
function LanguagePicker() {
  const auto = languageName(autoLanguage());
  return (
    <section className="set-sec">
      <h2>{t`Language`} <Help tip={t`Automatic takes the language the game is set to in Steam, else the language of Windows.`} page="how-audiodiver-works#language" /></h2>
      <div className="field">
        <select className="lang-select" value={chosenLanguage()} aria-label={t`Language`} onChange={(e) => chooseLanguage(e.target.value as Choice)}>
          <option value="auto">{t`Automatic: ${auto}`}</option>
          {LANGUAGES.map((l) => <option key={l.tag} value={l.tag} lang={l.tag}>{l.name}</option>)}
          {import.meta.env.DEV && <option value={PSEUDO}>Pseudo</option>}
        </select>
      </div>
    </section>
  );
}

function System() {
  const s = useSettings();
  const { notify, quick, project } = useEditor();
  const [cache, setCache] = useState<Cache | null>(null);
  const [clearing, setClearing] = useState<string | null>(null);
  useEffect(() => { call<Cache>("cache_info").then(setCache).catch(() => {}); }, []);

  const clear = async (kind: "previews" | "encoded") => {
    setClearing(kind);
    if (kind === "previews") player.stop(); // what plays is one of the files to clear
    try {
      const before = cache?.[kind] ?? 0;
      const after = await call<Cache>("cache_clear", { kind });
      setCache(after);
      const size = fmtBytes(Math.max(0, before - after[kind]));
      quick(t`Freed **${size}**`);
    } catch (e: any) { notify("bad", e.message ?? String(e)); }
    setClearing(null);
  };
  // the settings on this page (the build switches live on the Build tab)
  const defaults = { openLast: DEFAULT_SETTINGS.openLast, tips: DEFAULT_SETTINGS.tips, updates: DEFAULT_SETTINGS.updates, tabs: DEFAULT_SETTINGS.tabs,
    autosave: DEFAULT_SETTINGS.autosave, noticeCorner: DEFAULT_SETTINGS.noticeCorner, homeTicker: DEFAULT_SETTINGS.homeTicker };
  const changed = s.openLast !== defaults.openLast || s.tips !== defaults.tips || s.updates !== defaults.updates
    || s.tabs.join() !== defaults.tabs.join() || s.autosave !== defaults.autosave || s.noticeCorner !== defaults.noticeCorner
    || s.homeTicker !== defaults.homeTicker;
  const saveKey = keyLabel("save");

  return (
    <div className="set-page">
      <LanguagePicker />
      <GameFolder />

      {!UTILS && <section className="set-sec">
        <h2>{t`Tabs`} <Help tip={t`The tabs that show. A new project starts with these, and can change them on the Project tab.`} page="how-audiodiver-works#tabs" /></h2>
        <TabChecks value={s.tabs} onChange={(tabs) => settings.set({ tabs })} />
        {project?.tabs && <small className="set-note">{t`${ph({ project: project.name })} uses the tabs chosen on the Project tab.`}</small>}
      </section>}

      {!UTILS && <section className="set-sec">
        <h2><Trans>Startup</Trans></h2>
        <label className="check">
          <input type="checkbox" checked={s.openLast} onChange={(e) => settings.set({ openLast: e.target.checked })} />
          <span>{t`Open the last project when Audiodiver starts`} <Help tip={t`When on, the last project opens on the Audio tab. When off, Audiodiver starts on Home.`} page="how-audiodiver-works#startup" /></span>
        </label>
      </section>}

      {!UTILS && <section className="set-sec">
        <h2><Trans>Home</Trans></h2>
        <label className="check">
          <input type="checkbox" checked={s.homeTicker} onChange={(e) => settings.set({ homeTicker: e.target.checked })} />
          <span>{t`Show the news ticker`}</span>
        </label>
      </section>}

      {!UTILS && <section className="set-sec">
        <h2>{t`Autosave`} <Help tip={saveKey ? t`When changes go into the project file. ${saveKey} saves at any time.` : t`When changes go into the project file.`} page="how-audiodiver-works#autosave" /></h2>
        <div className="field">
          <span className="field-label"><Trans comment="Field label: when Autosave saves the project (With Each Change or On a Timer)">Save</Trans></span>
          <div className="segmented narrow" role="radiogroup" aria-label={t`Autosave`}>
            <button role="radio" aria-checked={!s.autosave} className={!s.autosave ? "on" : ""} onClick={() => settings.set({ autosave: 0 })}><Trans>With Each Change</Trans></button>
            <button role="radio" aria-checked={!!s.autosave} className={s.autosave ? "on" : ""}
              onClick={() => { if (!s.autosave) settings.set({ autosave: AUTOSAVE_DEFAULT }); }}><Trans>On a Timer</Trans></button>
          </div>
          {s.autosave > 0 && <>
            <input type="range" className="size-slider" style={rangeVars(s.autosave, 1, AUTOSAVE_MAX)} min={1} max={AUTOSAVE_MAX} step={1} value={s.autosave} aria-label={t`Minutes between saves`}
              aria-valuetext={minutes(s.autosave)} onChange={(e) => settings.set({ autosave: Number(e.target.value) })} />
            <span className="autosave-val">{everyMinutes(s.autosave)}</span>
          </>}
          <small>{s.autosave ? t`Changes are also saved before a build and when the project or Audiodiver closes.`
            : t`Every change goes into the project file as it is made.`}</small>
        </div>
      </section>}

      <section className="set-sec">
        <h2>{t`Updates`} <Help tip={t`Audiodiver checks GitHub for a new version on every start. The Updates tab lists the changes in each version.`} page="how-audiodiver-works#new-versions-of-audiodiver" /></h2>
        <div className="field">
          <span className="field-label"><Trans>Mode</Trans></span>
          <div className="segmented updates-mode" role="radiogroup" aria-label={t`Updates`}>
            {UPDATE_MODES.map(([id, name]) => (
              <button key={id} role="radio" aria-checked={s.updates === id} className={s.updates === id ? "on" : ""}
                onClick={() => settings.set({ updates: id })}>{name}</button>
            ))}
          </div>
          <small>{UPDATE_NOTES[s.updates]}</small>
        </div>
      </section>

      <section className="set-sec">
        <h2><Trans>Tooltips</Trans></h2>
        <div className="field">
          <span className="field-label"><Trans>Delay</Trans></span>
          <div className="segmented narrow" role="radiogroup" aria-label={t`Tooltips`}>
            {TIP_SPEEDS.map(([id, name]) => (
              <button key={id} role="radio" aria-checked={s.tips === id} className={s.tips === id ? "on" : ""}
                onClick={() => settings.set({ tips: id })}>{name}</button>
            ))}
          </div>
          <small>{s.tips === "off" ? t`Off. The “?” buttons still show their text.`
            : s.tips === "quick" ? t`Almost immediately.` : s.tips === "slow" ? t`After the pointer rests for a second.` : t`After the pointer rests for half a second.`}</small>
        </div>
      </section>

      <section className="set-sec">
        <h2><Trans>Notifications</Trans></h2>
        <div className="field">
          <span className="field-label"><Trans comment="Field label: the corner of the window notifications show in">Corner</Trans></span>
          <div className="segmented corners" role="radiogroup" aria-label={t`Notifications`}>
            {NOTICE_CORNERS.map(([id, name]) => (
              <button key={id} role="radio" aria-checked={s.noticeCorner === id} className={s.noticeCorner === id ? "on" : ""}
                onClick={() => settings.set({ noticeCorner: id })}>{name}</button>
            ))}
          </div>
        </div>
      </section>

      {!UTILS && <GlobalNotesSettings />}

      <section className="set-sec">
        <h2>{t`Disk space`} <Help tip={t`Prepared copies of audio, kept for reuse. Projects and audio files are never stored here.`} page="how-audiodiver-works#disk-space" /></h2>
        <div className="set-rows">
          <div className="set-row">
            <div><b><Trans>Previews</Trans></b><small><Trans>Decoded originals, waveforms and Play through renders</Trans></small></div>
            <span className="set-value">{cache ? fmtBytes(cache.previews) : "…"}</span>
            <button className="btn" disabled={!cache?.previews || clearing !== null} onClick={() => clear("previews")}>
              {clearing === "previews" ? t({ message: "Clearing", comment: "The Clear button while it deletes the files" }) : t({ message: "Clear", comment: "Button: deletes these files" })}</button>
          </div>
          <div className="set-row">
            <div><b><Trans>Encoded audio</Trans></b><small><Trans>New audio converted for the game, reused by builds</Trans></small></div>
            <span className="set-value">{cache ? fmtBytes(cache.encoded) : "…"}</span>
            <button className="btn" disabled={!cache?.encoded || clearing !== null} onClick={() => clear("encoded")}>
              {clearing === "encoded" ? t({ message: "Clearing", comment: "The Clear button while it deletes the files" }) : t({ message: "Clear", comment: "Button: deletes these files" })}</button>
          </div>
        </div>
        {cache && <button className="link-text" onClick={() => reveal(cache.folder)}><Trans>Show the Folder</Trans></button>}
      </section>

      {!UTILS && <section className="set-sec">
        <h2><Trans>Layout</Trans></h2>
        <button className="btn" onClick={() => { resetLayout(); quick(t`Panel sizes reset`); }}
          data-tip={t`The side panels, the header and the waveforms back to their default sizes`}><Trans>Reset Panel Sizes</Trans></button>
      </section>}

      {changed && <button className="link-text set-reset" onClick={() => settings.set(defaults)}><Trans>Reset These Settings to Default</Trans></button>}
    </div>
  );
}

const FOUND: Record<string, string> = {
  steam: t`Found through Steam.`,
  chosen: t`Chosen here.`,
  env: t`Set by the HD2_DATA environment variable.`,
};

/** Where the game is: found through Steam, or a folder chosen here. Changing it reads the game's audio again. */
/** Settings ▸ System ▸ Global Notes: where the notes file is (a folder with a notes file in it, a synced one say,
    brings its notes together with these; the core's set_notes_folder), and the export and import of notes. */
function GlobalNotesSettings() {
  const g = useGlobalNotes();
  const { quick } = useEditor();
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const count = Object.keys(g.notes).length;
  const move = async (folder: string | null) => {
    setError(null);
    try { notes.setGlobal(await call<GlobalNotes>("notes_folder_set", { folder })); } catch (e: any) { setError(e.message ?? String(e)); }
  };
  const choose = async () => {
    const folder = await pickFolder(g.folder, t`Choose a folder for the global notes`);
    if (folder) await move(folder);
  };
  const bringIn = async () => {
    const path = await pickNotesFile();
    if (!path) return;
    setError(null);
    try {
      const r = await call<GlobalNotes & { added: number }>("notes_import", { path });
      notes.setGlobal(r);
      quick(r.added ? plural(r.added, { one: "Imported notes on # thing", other: "Imported notes on # things" }) : t`The global notes already have every note in that file`,
        r.added ? "done" : "info");
    } catch (e: any) { setError(e.message ?? String(e)); }
  };
  return (
    <section className="set-sec">
      <h2>{t`Global Notes`} <Help tip={t`Notes shown in every project and in the Library, kept in a notes file in this folder. A folder that already has a notes file, such as a synced folder, adds those notes to these.`} page="how-audiodiver-works#global-notes" /></h2>
      <div className="game-folder"><span className="path-text">{g.file}</span></div>
      <p className="set-note">{count ? plural(count, { one: "# global note", other: "# global notes" }) : t`No global notes yet`}</p>
      <div className="row-btns">
        <button className="btn" onClick={choose}><Trans>Choose Another Folder</Trans></button>
        {!g.default && <button className="btn quiet" onClick={() => move(null)}><Trans>Use the Default Folder</Trans></button>}
        {g.folder && <button className="btn quiet" onClick={() => reveal(count ? g.file : g.folder)}><Trans>Show in Folder</Trans></button>}
      </div>
      <div className="row-btns">
        <button className="btn" onClick={() => setExporting(true)}><Trans>Export Notes</Trans></button>
        <button className="btn" onClick={bringIn} data-tip={t`Bring the notes of an exported notes file or of a project into the global notes`}><Trans>Import Notes</Trans></button>
      </div>
      {(error || g.error) && <p className="warn-box" role="alert">{error ?? g.error}</p>}
      {exporting && <NotesExport onClose={() => setExporting(false)} />}
    </section>
  );
}

type NotesWhat = "global" | "project" | "both";
/** Export Notes: which notes (the global ones, the open project's, or both) and as what (Markdown to read, or a JSON
    notes file that Import Notes takes), then where to save them. */
function NotesExport({ onClose }: { onClose: () => void }) {
  const { project, notify } = useEditor();
  const [what, setWhat] = useState<NotesWhat>("global");
  const [form, setForm] = useState<"md" | "json">("md");
  const box = useDialog(onClose);
  const name = what === "project" && project
    ? t({ message: `${project.name} notes`, comment: "The suggested file name for a project's exported notes, without the extension" })
    : t({ message: "Audiodiver notes", comment: "The suggested file name for exported notes, without the extension" });
  const go = async () => {
    const path = await pickNotesToSave(`${name}.${form}`, form);
    if (!path) return;
    try {
      const r = await call<{ path: string; count: number }>("notes_export", { path, what, form });
      onClose();
      notify("good", plural(r.count, { one: "Exported # note.", other: "Exported # notes." }), { label: t`Show in Folder`, go: { reveal: r.path } });
    } catch (e: any) { notify("bad", e.message ?? String(e)); }
  };
  const WHAT: [NotesWhat, string][] = [["global", t`Global Notes`], ["project", t`Project Notes`], ["both", t({ message: "Both", comment: "Export Notes: the global notes and the project notes" })]];
  return (
    <div className="modal-back" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal narrow notes-export" role="dialog" aria-modal="true" aria-label={t`Export Notes`} ref={box} tabIndex={-1}>
        <h2><Trans>Export Notes</Trans></h2>
        <div className="field">
          <span className="field-label"><Trans comment="Export Notes: which notes go into the file">Notes</Trans></span>
          <div className="segmented" role="radiogroup" aria-label={t`Notes`}>
            {WHAT.map(([id, label]) => (
              <button key={id} role="radio" aria-checked={what === id} className={what === id ? "on" : ""} disabled={id !== "global" && !project}
                data-tip={id !== "global" && !project ? t`Open a project to export the project notes` : undefined} onClick={() => setWhat(id)}>{label}</button>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="field-label"><Trans comment="Export Notes: the kind of file">Format</Trans></span>
          <div className="segmented" role="radiogroup" aria-label={t`Format`}>
            <button role="radio" aria-checked={form === "md"} className={form === "md" ? "on" : ""} onClick={() => setForm("md")}>Markdown</button>
            <button role="radio" aria-checked={form === "json"} className={form === "json" ? "on" : ""} onClick={() => setForm("json")}>JSON</button>
          </div>
          <small>{form === "md" ? t`A document to read, with each note under the name of what it is on.`
            : t`A notes file that Import Notes brings into the global notes, on this computer or another.`}</small>
        </div>
        <div className="modal-foot">
          <button className="btn primary" onClick={go}><Trans comment="Export Notes: saves the file">Export</Trans></button>
          <span className="spacer" />
          <button className="btn quiet" onClick={onClose}><Trans>Cancel</Trans></button>
        </div>
      </div>
    </div>
  );
}

function GameFolder() {
  const { status, actions, jobs } = useEditor();
  const [error, setError] = useState<string | null>(null);
  const where = status?.game_folder;
  const busy = Object.values(jobs).some((j) => j.state === "running");
  const change = async (path?: string | null) => setError(await actions.setGameFolder(path));
  return (
    <section className="set-sec">
      <h2>{t`Game`} <Help tip={t`Audiodiver only reads from this folder. Choosing another folder reads the game again, which takes about a minute the first time.`} page="how-audiodiver-works#game-folder" /></h2>
      <div className="game-folder">
        <span className="path-text">{where?.path ?? t`Not found`}</span>
      </div>
      {where?.how && FOUND[where.how] && <p className="set-note">{FOUND[where.how]}</p>}
      <div className="row-btns">
        <button className="btn" disabled={busy} onClick={() => change()}
          data-tip={busy ? t`Wait for the build or export to finish` : t`The Helldivers 2 install folder, or the data folder inside it`}><Trans>Choose Another Folder</Trans></button>
        {where?.chosen && <button className="btn quiet" disabled={busy} onClick={() => change(null)}><Trans>Find It Through Steam Again</Trans></button>}
        {where?.path && <button className="btn quiet" onClick={() => reveal(where.path!)}><Trans>Show in Folder</Trans></button>}
      </div>
      {error && <p className="warn-box" role="alert">{error}</p>}
    </section>
  );
}

// ---------------------------------------------------------------- Shortcuts

type Capture = { id: CommandId; replacing?: string };
const GROUPS = [...new Set(COMMANDS.map((c) => c.group))];

function Shortcuts() {
  const map = useKeymap();
  const [capture, setCapture] = useState<Capture | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const turn = useRef(0), cancel = useRef<() => void>(() => {});
  useEffect(() => () => cancel.current(), []); // leaving the tab stops listening for a key

  /** Waits for a key and puts the command on it, in place of one of its keys or as one more. */
  const rebind = async (id: CommandId, replacing?: string) => {
    cancel.current();
    const mine = ++turn.current;
    const waiting = captureChord();
    cancel.current = waiting.cancel;
    setCapture({ id, replacing });
    setNote(null);
    const chord = await waiting.chord;
    if (turn.current !== mine) return; // another key is being set meanwhile
    setCapture(null);
    if (!chord || chord === replacing) return;
    const from = keymap.bind(id, chord, replacing);
    if (from) {
      const keyName = fmtChord(chord), command = keymap.command(id).label, previous = keymap.command(from).label;
      setNote(t`${keyName} now does “${command}”. It was taken from “${previous}”.`);
    }
  };
  const reset = (id: CommandId) => {
    const lost = keymap.reset(id);
    const commands = andList(lost.map((x) => `“${keymap.command(x).label}”`));
    setNote(lost.length ? t`Reset to default. This took a key from ${commands}.` : null);
  };
  const resetAll = async () => {
    const ok = await confirm({ title: t`Reset all shortcuts?`, text: t`All commands go back to their default keys.`, ok: t`Reset`, cancel: t`Cancel` });
    if (!ok) return;
    keymap.resetAll();
    setNote(t`All shortcuts reset to default.`);
  };

  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = useMemo(() => COMMANDS.filter((c) => {
    const hay = `${c.group} ${c.label} ${map[c.id].map(fmtChord).join(" ")}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  }), [map, query]); // eslint-disable-line react-hooks/exhaustive-deps
  // the keys that can't be changed are found by the same words ("esc", "double-click")
  const fixed = FIXED.filter(([how, what]) => words.every((w) => `${how} ${what}`.toLowerCase().includes(w)));

  return (
    <div className="set-page keys-page">
      <div className="keys-bar">
        <input type="search" placeholder={t`Search a shortcut by function or key`} value={query} aria-label={t`Search a shortcut`}
          onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") setQuery(""); }} />
        <button className="btn" disabled={keymap.allDefault()} onClick={resetAll}><Trans>Reset Key Binds</Trans></button>
      </div>
      <p className="set-note"><Trans>Click on a key bind to change it. Press Esc to cancel.<br />
        Key functions are exclusive. If you assign a key to a function, all other functions that use that key will be emptied.</Trans></p>
      <p className="keys-note" role="status">{capture ? t`Press the new key…` : note}</p>

      {GROUPS.map((group) => {
        const rows = shown.filter((c) => c.group === group);
        if (!rows.length) return null;
        return (
          <section key={group} className="set-sec keys-group">
            <h2>{group}</h2>
            {rows.map((c) => (
              <div key={c.id} className="key-row">
                <span className="key-what">{c.label}</span>
                <span className="key-chords">
                  {map[c.id].map((chord) => {
                    const waiting = capture?.id === c.id && capture.replacing === chord;
                    const keyName = fmtChord(chord);
                    return (
                      <span key={chord} className={`key-chip${waiting ? " waiting" : ""}`}>
                        <button onClick={() => rebind(c.id, chord)} data-tip={t`Change this key`}>{waiting ? t`Press a Key` : keyName}</button>
                        <button className="key-x" aria-label={t`Remove ${keyName}`} data-tip={t`Remove this key`} onClick={() => keymap.unbind(c.id, chord)}>✕</button>
                      </span>
                    );
                  })}
                  {capture?.id === c.id && !capture.replacing ? <span className="key-chip waiting"><button>{t`Press a Key`}</button></span>
                    : !map[c.id].length && <span className="key-none">{t`No key`}</span>}
                  <button className="key-add" onClick={() => rebind(c.id)} aria-label={t`Add a key for: ${ph({ command: c.label })}`}
                    data-tip={map[c.id].length ? t`Add another key for this` : t`Give this a key`}>+</button>
                </span>
                <button className="link-text key-reset" style={{ visibility: keymap.isDefault(c.id) ? "hidden" : undefined }}
                  onClick={() => reset(c.id)} data-tip={c.keys.length ? t`Back to ${ph({ keys: andList(c.keys.map(fmtChord)) })}` : t`Back to no key`}>{t`Reset`}</button>
              </div>
            ))}
          </section>
        );
      })}
      {!shown.length && !fixed.length && <p className="set-note"><Trans>Nothing matches “{query}”.</Trans></p>}

      {fixed.length > 0 && (
        <section className="set-sec keys-group">
          <h2><Trans>Mouse and fixed keys</Trans></h2>
          {fixed.map(([how, what]) => (
            <div key={how} className="key-row fixed"><span className="key-what">{what}</span><span className="key-chords"><span className="key-fixed">{how}</span></span></div>
          ))}
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Theme

/** One of the built-in typefaces, each named in its own letters. */
function FontPicker({ label, value, onChange }: { label: string; value: FontId; onChange: (f: FontId) => void }) {
  return (
    <div className="segmented narrow font-picker" role="radiogroup" aria-label={label}>
      {FONTS.map((f) => (
        <button key={f.id} role="radio" aria-checked={value === f.id} className={value === f.id ? "on" : ""}
          style={{ fontFamily: f.stack }} onClick={() => onChange(f.id)}>{f.name}</button>
      ))}
    </div>
  );
}

function Theme() {
  const th = useTheme();
  // the slider shows the colours you would really get, which differ in brightness from a plain rainbow
  const rainbow = useMemo(() => `linear-gradient(90deg, ${Array.from({ length: 25 }, (_, i) => accentFor(modeOf(th), i * 15, contrastOn(th)).accent).join(", ")})`, [th.mode, th.contrast]);
  const rainbow2 = useMemo(() => `linear-gradient(90deg, ${Array.from({ length: 25 }, (_, i) => secondFor(modeOf(th), i * 15, contrastOn(th)).fg).join(", ")})`, [th.mode, th.contrast]);
  const warm = useMemo(() => `linear-gradient(90deg, ${[0, 0.25, 0.5, 0.75, 1].map((w) => nightTint(w)).join(", ")})`, []);
  const changed = (Object.keys(RESET_THEME) as (keyof typeof RESET_THEME)[]).some((k) => th[k] !== RESET_THEME[k]);
  const reset = async () => {
    const ok = await confirm({ title: t`Reset the theme?`, text: UTILS ? t`Text size goes back to the default. Dark or light and contrast follow the system.`
      : t`Every theme setting goes back to the default. Dark or light, contrast and animations follow the system.`, ok: t`Reset`, cancel: t`Cancel` });
    if (ok) theme.reset();
  };
  return (
    <div className="set-split">
      <div className="set-page">
      <section className="set-sec">
        <h2><Trans>Colours</Trans></h2>
        <div className="field">
          <span className="field-label"><Trans>Theme</Trans>
            {th.mode !== null && <button className="link-inline" onClick={() => theme.set({ mode: null })}><Trans>Follow the System</Trans></button>}
          </span>
          <div className="segmented narrow" role="radiogroup" aria-label={t`Theme`}>
            {(["dark", "light"] as const).map((m) => (
              <button key={m} role="radio" aria-checked={modeOf(th) === m} className={modeOf(th) === m ? "on" : ""}
                onClick={() => theme.set({ mode: m })}>{m === "dark" ? t({ message: "Dark", comment: "Theme: dark colours" }) : t({ message: "Light", comment: "Theme: light colours" })}</button>
            ))}
          </div>
          {th.mode === null && <small><Trans>Following the system.</Trans></small>}
        </div>
        <div className="field">
          <span className="field-label"><Trans>Contrast</Trans>
            {th.contrast !== null && <button className="link-inline" onClick={() => theme.set({ contrast: null })}><Trans>Follow the System</Trans></button>}
          </span>
          <div className="segmented narrow" role="radiogroup" aria-label={t`Contrast`}>
            {([false, true] as const).map((high) => (
              <button key={String(high)} role="radio" aria-checked={contrastOn(th) === high} className={contrastOn(th) === high ? "on" : ""}
                onClick={() => theme.set({ contrast: high })}>{high ? t({ message: "High", comment: "Contrast level" }) : t({ message: "Normal", comment: "Contrast level" })}</button>
            ))}
          </div>
          <small>{th.contrast !== null ? t`Set here, overriding the system setting.`
            : systemWantsContrast() ? t`High, because the system asks for more contrast.` : t`Following the system.`}</small>
        </div>
        {!UTILS && <>
        <div className="field">
          <span className="field-label"><Trans>Night mode</Trans></span>
          <div className="segmented narrow" role="radiogroup" aria-label={t`Night mode`}>
            {([false, true] as const).map((on) => (
              <button key={String(on)} role="radio" aria-checked={th.night === on} className={th.night === on ? "on" : ""}
                onClick={() => theme.set({ night: on })}>{on ? t`On` : t`Off`}</button>
            ))}
          </div>
          <small><Trans>Warms every colour, like a night light.</Trans></small>
        </div>
        <div className="field">
          <span className="field-label"><Trans>Warmth</Trans>
            {th.warmth !== DEFAULT_WARMTH && <button className="link-inline" onClick={() => theme.set({ warmth: DEFAULT_WARMTH })}><Trans>Back to Default</Trans></button>}
          </span>
          <input type="range" className="hue-slider" style={{ background: warm }} min={WARMTH[0]} max={WARMTH[1]} step={0.05} value={th.warmth} data-scale-tip
            disabled={!th.night} aria-label={t`Night mode warmth`} aria-valuetext={`${Math.round(th.warmth * 100)}%`}
            onChange={(e) => theme.set({ warmth: Number(e.target.value) })} />
          {!th.night && <small><Trans>Night mode is off.</Trans></small>}
        </div>
        <div className="field">
          <span className="field-label"><Trans>Primary colour</Trans>
            {th.hue !== YELLOW_HUE && <button className="link-inline" onClick={() => theme.set({ hue: YELLOW_HUE })}><Trans>Back to Yellow</Trans></button>}
          </span>
          <input type="range" className="hue-slider" style={{ background: rainbow }} min={0} max={359} step={1} value={th.hue} aria-label={t`Primary colour hue`} data-scale-tip
            onChange={(e) => theme.set({ hue: Number(e.target.value) })} />
          <small><Trans>Main buttons, new audio and edits.</Trans></small>
        </div>
        <div className="field">
          <span className="field-label"><Trans>Secondary colour</Trans>
            {th.hue2 !== BLUE_HUE && <button className="link-inline" onClick={() => theme.set({ hue2: BLUE_HUE })}><Trans>Back to Blue</Trans></button>}
          </span>
          <input type="range" className="hue-slider second" style={{ background: rainbow2 }} min={0} max={359} step={1} value={th.hue2} aria-label={t`Secondary colour hue`} data-scale-tip
            onChange={(e) => theme.set({ hue2: Number(e.target.value) })} />
          <small>{modeOf(th) === "light" ? t`Links, the open tab, the selection and the focus ring, and primary-coloured text and lines on the light theme.`
            : t`Links, the open tab, the selection and the focus ring.`}</small>
        </div>
        </>}
      </section>

      <section className="set-sec">
        <h2>{UTILS ? t`Text` : t`Text and spacing`}</h2>
        {!UTILS && <>
        <div className="field">
          <span className="field-label"><Trans>Typeface for text</Trans>
            {th.bodyFont !== DEFAULT_THEME.bodyFont && <button className="link-inline" onClick={() => theme.set({ bodyFont: DEFAULT_THEME.bodyFont })}><Trans>Back to Archivo</Trans></button>}
          </span>
          <FontPicker label={t`Typeface for text`} value={th.bodyFont} onChange={(f) => theme.set({ bodyFont: f })} />
          <small>{i18n._((FONTS.find((f) => f.id === th.bodyFont) ?? FONTS[0]).about)}</small>
        </div>
        <div className="field">
          <span className="field-label"><Trans>Typeface for titles</Trans>
            {th.titleFont !== DEFAULT_THEME.titleFont && <button className="link-inline" onClick={() => theme.set({ titleFont: DEFAULT_THEME.titleFont })}><Trans>Back to Archivo</Trans></button>}
          </span>
          <FontPicker label={t`Typeface for titles`} value={th.titleFont} onChange={(f) => theme.set({ titleFont: f })} />
          <small><Trans>Page and panel titles, and the app name.</Trans></small>
        </div>
        </>}
        <div className="field">
          <span className="field-label"><Trans>Text size</Trans>
            {th.size !== DEFAULT_SIZE && <button className="link-inline" onClick={() => theme.set({ size: DEFAULT_SIZE })}><Trans>Back to Default</Trans></button>}
          </span>
          <input type="range" className="size-slider" style={rangeVars(TEXT_SIZES.indexOf(th.size), 0, TEXT_SIZES.length - 1)} min={0} max={TEXT_SIZES.length - 1} step={1} value={TEXT_SIZES.indexOf(th.size)}
            aria-label={t`Text size`} aria-valuetext={pixels(th.size)} onChange={(e) => theme.set({ size: TEXT_SIZES[Number(e.target.value)] })} />
          <div className="size-ticks">
            {TEXT_SIZES.map((px) => (
              <button key={px} tabIndex={-1} className={`${px === th.size ? "on" : ""}${px === DEFAULT_SIZE ? " default" : ""}`}
                data-tip={px === DEFAULT_SIZE ? t`Default` : undefined} onClick={() => theme.set({ size: px })}>{px}px</button>
            ))}
          </div>
        </div>
        {!UTILS && <div className="field">
          <span className="field-label"><Trans>Spacing</Trans></span>
          <div className="segmented narrow" role="radiogroup" aria-label={t`Spacing`}>
            {DENSITIES.map(([d, name]) => (
              <button key={d} role="radio" aria-checked={th.density === d} className={th.density === d ? "on" : ""}
                onClick={() => theme.set({ density: d })}>{i18n._(name)}</button>
            ))}
          </div>
          <small>{th.density === "compact" ? t`Fits the most on screen.` : th.density === "relaxed" ? t`More room around rows and buttons.` : t`The default.`}</small>
        </div>}
      </section>

      {!UTILS && <>
      <section className="set-sec">
        <h2><Trans>Tab bar</Trans></h2>
        <div className="field">
          <span className="field-label"><Trans>Position</Trans></span>
          <div className="segmented narrow" role="radiogroup" aria-label={t`Tab bar position`}>
            {BAR_SIDES.map(([side, name]) => (
              <button key={side} role="radio" aria-checked={th.bar === side} className={th.bar === side ? "on" : ""}
                onClick={() => theme.set({ bar: side })}>{i18n._(name)}</button>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="field-label"><Trans>Tab names</Trans></span>
          <div className="segmented narrow" role="radiogroup" aria-label={t`Tab names`}>
            {([true, false] as const).map((on) => (
              <button key={String(on)} role="radio" aria-checked={th.labels === on} className={th.labels === on ? "on" : ""}
                onClick={() => theme.set({ labels: on })}>{on ? t`On` : t`Off`}</button>
            ))}
          </div>
          <small>{!th.labels ? t`Icons only. Names show in tooltips.` : barIsVertical(th.bar) ? t`Names show when the pointer is on a tab.` : t`Names show beside the icons.`}</small>
        </div>
      </section>

      <section className="set-sec">
        <h2><Trans>Animations</Trans></h2>
        <div className="field">
          <span className="field-label"><Trans>Animations</Trans>
            {th.motion !== null && <button className="link-inline" onClick={() => theme.set({ motion: null })}><Trans>Follow the System</Trans></button>}
          </span>
          <div className="segmented narrow" role="radiogroup" aria-label={t`Animations`}>
            {([true, false] as const).map((on) => (
              <button key={String(on)} role="radio" aria-checked={motionOn(th) === on} className={motionOn(th) === on ? "on" : ""}
                onClick={() => theme.set({ motion: on })}>{on ? t`On` : t`Off`}</button>
            ))}
          </div>
          <small>{th.motion !== null ? t`Set here, overriding the system setting.`
            : systemReducesMotion() ? t`Off, because the system asks for less motion.` : t`Following the system.`}</small>
        </div>
        <div className="field">
          <span className="field-label"><Trans>Animation speed</Trans>
            {th.speed !== 1 && <button className="link-inline" onClick={() => theme.set({ speed: 1 })}><Trans>Back to Normal</Trans></button>}
          </span>
          <input type="range" className="size-slider" style={rangeVars(SPEEDS.indexOf(th.speed), 0, SPEEDS.length - 1)} min={0} max={SPEEDS.length - 1} step={1} value={SPEEDS.indexOf(th.speed)}
            disabled={!motionOn(th)} aria-label={t`Animation speed`} aria-valuetext={timesNormal(th.speed)}
            onChange={(e) => theme.set({ speed: SPEEDS[Number(e.target.value)] })} />
          <div className="size-ticks">
            {SPEEDS.map((s) => (
              <button key={s} tabIndex={-1} disabled={!motionOn(th)} className={`${s === th.speed ? "on" : ""}${s === 1 ? " default" : ""}`}
                data-tip={s === 1 ? t({ message: "Normal", comment: "Animation speed" }) : s < 1 ? t`Slower` : t`Faster`} onClick={() => theme.set({ speed: s })}>{s.toLocaleString(intlLocale())}×</button>
            ))}
          </div>
          <div className="motion-demo" aria-hidden><span key={`${th.speed}:${motionOn(th)}`} /></div>
        </div>
      </section>
      </>}
      </div>
      <aside className="set-aside">
        <button className="btn" disabled={!changed} onClick={reset}><Trans>Reset to Default</Trans></button>
      </aside>
    </div>
  );
}
