import { useEffect, useMemo, useRef, useState } from "react";
import { call, fmtBytes } from "./api";
import { confirm } from "./Confirm";
import { UTILS } from "./edition";
import { captureChord, COMMANDS, FIXED, fmtChord, keymap, useKeymap, type CommandId } from "./keys";
import { HIDEABLE, nav, useNav, type Hideable, type SettingsTab as Sub } from "./nav";
import { Page, tabArrows } from "./Page";
import { reveal } from "./platform";
import { player } from "./player";
import { DEFAULT_SETTINGS, resetLayout, settings, TIP_SPEEDS, UPDATE_MODES, UPDATE_NOTES, useSettings } from "./settings";
import { useEditor } from "./store";
import { Help } from "./Wiki";
import { accentFor, BAR_SIDES, barIsVertical, BLUE_HUE, contrastOn, DEFAULT_SIZE, DEFAULT_THEME, DEFAULT_WARMTH, DENSITIES, FONTS, modeOf, motionOn, nightTint,
  RESET_THEME, secondFor, SPEEDS, systemReducesMotion, systemWantsContrast, TEXT_SIZES, theme, useTheme, WARMTH, YELLOW_HUE, type FontId } from "./theme";

const SUBS: [Sub, string, string][] = UTILS ? [
  ["system", "System", "Game folder, updates, tooltips, disk space"],
  ["theme", "Theme", "Dark or light, contrast, text size"],
] : [
  ["system", "System", "Game folder, tabs, startup, updates, tooltips, disk space, layout"],
  ["shortcuts", "Shortcuts", "Shortcut keys and rebinding"],
  ["theme", "Theme", "Colours, text, spacing, the tab bar, animations"],
];

/** The Settings tab (the gear): System, Shortcuts and Theme. Settings are kept per user, not per project. About
    (version, licence, log file, credits) is the ⓘ by the version in the status bar, About.tsx. */
export function SettingsTab() {
  const { settings: sub } = useNav();
  return (
    <Page title="Settings">
      <div className="sub-tabs" role="tablist" aria-label="Settings" onKeyDown={tabArrows}>
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
const TAB_NAMES: [Hideable, string][] = [["editor", "Audio"], ["soundtrack", "Soundtrack"], ["text", "Text"]];
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
      quick(`Freed **${fmtBytes(Math.max(0, before - after[kind]))}**`);
    } catch (e: any) { notify("bad", e.message ?? String(e)); }
    setClearing(null);
  };
  // the settings on this page (the build switches live on the Build tab)
  const defaults = { openLast: DEFAULT_SETTINGS.openLast, tips: DEFAULT_SETTINGS.tips, updates: DEFAULT_SETTINGS.updates, tabs: DEFAULT_SETTINGS.tabs };
  const changed = s.openLast !== defaults.openLast || s.tips !== defaults.tips || s.updates !== defaults.updates
    || s.tabs.join() !== defaults.tabs.join();

  return (
    <div className="set-page">
      <GameFolder />

      {!UTILS && <section className="set-sec">
        <h2>Tabs <Help tip="The tabs that show. A new project starts with these, and can change them on the Project tab." page="how-audiodiver-works#tabs" /></h2>
        <TabChecks value={s.tabs} onChange={(tabs) => settings.set({ tabs })} />
        {project?.tabs && <small className="set-note">{project.name} uses the tabs chosen on the Project tab.</small>}
      </section>}

      {!UTILS && <section className="set-sec">
        <h2>Startup</h2>
        <label className="check">
          <input type="checkbox" checked={s.openLast} onChange={(e) => settings.set({ openLast: e.target.checked })} />
          <span>Open the last project when Audiodiver starts <Help tip="When on, the last project opens on the Audio tab. When off, Audiodiver starts on Home." page="how-audiodiver-works#startup" /></span>
        </label>
      </section>}

      <section className="set-sec">
        <h2>Updates <Help tip="Audiodiver checks GitHub for a new version on every start. The Updates tab lists the changes in each version." page="how-audiodiver-works#new-versions-of-audiodiver" /></h2>
        <div className="field">
          <span className="field-label">Mode</span>
          <div className="segmented updates-mode" role="radiogroup" aria-label="Updates">
            {UPDATE_MODES.map(([id, name]) => (
              <button key={id} role="radio" aria-checked={s.updates === id} className={s.updates === id ? "on" : ""}
                onClick={() => settings.set({ updates: id })}>{name}</button>
            ))}
          </div>
          <small>{UPDATE_NOTES[s.updates]}</small>
        </div>
      </section>

      <section className="set-sec">
        <h2>Tooltips</h2>
        <div className="field">
          <span className="field-label">Delay</span>
          <div className="segmented narrow" role="radiogroup" aria-label="Tooltips">
            {TIP_SPEEDS.map(([id, name]) => (
              <button key={id} role="radio" aria-checked={s.tips === id} className={s.tips === id ? "on" : ""}
                onClick={() => settings.set({ tips: id })}>{name}</button>
            ))}
          </div>
          <small>{s.tips === "off" ? "Off. The “?” buttons still show their text."
            : s.tips === "quick" ? "Almost immediately." : s.tips === "slow" ? "After the pointer rests for a second." : "After the pointer rests for half a second."}</small>
        </div>
      </section>

      <section className="set-sec">
        <h2>Disk space <Help tip="Prepared copies of audio, kept for reuse. Projects and audio files are never stored here." page="how-audiodiver-works#disk-space" /></h2>
        <div className="set-rows">
          <div className="set-row">
            <div><b>Previews</b><small>Decoded originals, waveforms and Play through renders</small></div>
            <span className="set-value">{cache ? fmtBytes(cache.previews) : "…"}</span>
            <button className="btn" disabled={!cache?.previews || clearing !== null} onClick={() => clear("previews")}>{clearing === "previews" ? "Clearing…" : "Clear"}</button>
          </div>
          <div className="set-row">
            <div><b>Encoded audio</b><small>New audio converted for the game, reused by builds</small></div>
            <span className="set-value">{cache ? fmtBytes(cache.encoded) : "…"}</span>
            <button className="btn" disabled={!cache?.encoded || clearing !== null} onClick={() => clear("encoded")}>{clearing === "encoded" ? "Clearing…" : "Clear"}</button>
          </div>
        </div>
        {cache && <button className="link-text" onClick={() => reveal(cache.folder)}>Show the folder</button>}
      </section>

      {!UTILS && <section className="set-sec">
        <h2>Layout</h2>
        <button className="btn" onClick={() => { resetLayout(); quick("Panel sizes reset"); }}
          data-tip="The side panels, the header and the waveforms back to their default sizes">Reset panel sizes</button>
      </section>}

      {changed && <button className="link-text set-reset" onClick={() => settings.set(defaults)}>Reset these settings to default</button>}
    </div>
  );
}

const FOUND: Record<string, string> = {
  steam: "Found through Steam.",
  chosen: "Chosen here.",
  env: "Set by the HD2_DATA environment variable.",
};

/** Where the game is: found through Steam, or a folder chosen here. Changing it reads the game's audio again. */
function GameFolder() {
  const { status, actions, jobs } = useEditor();
  const [error, setError] = useState<string | null>(null);
  const where = status?.game_folder;
  const busy = Object.values(jobs).some((j) => j.state === "running");
  const change = async (path?: string | null) => setError(await actions.setGameFolder(path));
  return (
    <section className="set-sec">
      <h2>Game <Help tip="Audiodiver only reads from this folder. Choosing another folder reads the game again, which takes about a minute the first time." page="how-audiodiver-works#game-folder" /></h2>
      <div className="game-folder">
        <span className="path-text">{where?.path ?? "Not found"}</span>
      </div>
      {where?.how && FOUND[where.how] && <p className="set-note">{FOUND[where.how]}</p>}
      <div className="row-btns">
        <button className="btn" disabled={busy} onClick={() => change()}
          data-tip={busy ? "Wait for the build or export to finish" : "The Helldivers 2 install folder, or its data folder"}>Choose another folder…</button>
        {where?.chosen && <button className="btn quiet" disabled={busy} onClick={() => change(null)}>Find it through Steam again</button>}
        {where?.path && <button className="btn quiet" onClick={() => reveal(where.path!)}>Show in folder</button>}
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
    if (from) setNote(`${fmtChord(chord)} now does “${keymap.command(id).label}”. It was taken from “${keymap.command(from).label}”.`);
  };
  const reset = (id: CommandId) => {
    const lost = keymap.reset(id);
    setNote(lost.length ? `Reset to default. This took a key from ${lost.map((x) => `“${keymap.command(x).label}”`).join(" and ")}.` : null);
  };
  const resetAll = async () => {
    const ok = await confirm({ title: "Reset all shortcuts?", text: "All commands go back to their default keys.", ok: "Reset", cancel: "Cancel" });
    if (!ok) return;
    keymap.resetAll();
    setNote("All shortcuts reset to default.");
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
        <input type="search" placeholder="Search a shortcut by function or key" value={query} aria-label="Search a shortcut"
          onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") setQuery(""); }} />
        <button className="btn" disabled={keymap.allDefault()} onClick={resetAll}>Reset Key Binds</button>
      </div>
      <p className="set-note">Click on a key bind to change it. Press Esc to cancel.<br />
        Key functions are exclusive. If you assign a key to a function, all other functions that use that key will be emptied.</p>
      <p className="keys-note" role="status">{capture ? "Press the new key…" : note}</p>

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
                    return (
                      <span key={chord} className={`key-chip${waiting ? " waiting" : ""}`}>
                        <button onClick={() => rebind(c.id, chord)} data-tip="Change this key">{waiting ? "Press a key…" : fmtChord(chord)}</button>
                        <button className="key-x" aria-label={`Remove ${fmtChord(chord)}`} data-tip="Remove this key" onClick={() => keymap.unbind(c.id, chord)}>✕</button>
                      </span>
                    );
                  })}
                  {capture?.id === c.id && !capture.replacing ? <span className="key-chip waiting"><button>Press a key…</button></span>
                    : !map[c.id].length && <span className="key-none">No key</span>}
                  <button className="key-add" onClick={() => rebind(c.id)} aria-label={`Add a key for: ${c.label}`}
                    data-tip={map[c.id].length ? "Add another key for this" : "Give this a key"}>+</button>
                </span>
                <button className="link-text key-reset" style={{ visibility: keymap.isDefault(c.id) ? "hidden" : undefined }}
                  onClick={() => reset(c.id)} data-tip={`Back to ${c.keys.map(fmtChord).join(" and ") || "no key"}`}>Reset</button>
              </div>
            ))}
          </section>
        );
      })}
      {!shown.length && !fixed.length && <p className="set-note">Nothing matches “{query}”.</p>}

      {fixed.length > 0 && (
        <section className="set-sec keys-group">
          <h2>Mouse and fixed keys</h2>
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
  const t = useTheme();
  // the slider shows the colours you would really get, which differ in brightness from a plain rainbow
  const rainbow = useMemo(() => `linear-gradient(90deg, ${Array.from({ length: 25 }, (_, i) => accentFor(modeOf(t), i * 15, contrastOn(t)).accent).join(", ")})`, [t.mode, t.contrast]);
  const rainbow2 = useMemo(() => `linear-gradient(90deg, ${Array.from({ length: 25 }, (_, i) => secondFor(modeOf(t), i * 15, contrastOn(t)).fg).join(", ")})`, [t.mode, t.contrast]);
  const warm = useMemo(() => `linear-gradient(90deg, ${[0, 0.25, 0.5, 0.75, 1].map((w) => nightTint(w)).join(", ")})`, []);
  const changed = (Object.keys(RESET_THEME) as (keyof typeof RESET_THEME)[]).some((k) => t[k] !== RESET_THEME[k]);
  const reset = async () => {
    const ok = await confirm({ title: "Reset the theme?", text: UTILS ? "Text size goes back to its default. Dark or light and contrast follow the system."
      : "Every theme setting goes back to its default. Dark or light, contrast and animations follow the system.", ok: "Reset", cancel: "Cancel" });
    if (ok) theme.reset();
  };
  return (
    <div className="set-split">
      <div className="set-page">
      <section className="set-sec">
        <h2>Colours</h2>
        <div className="field">
          <span className="field-label">Theme
            {t.mode !== null && <button className="link-inline" onClick={() => theme.set({ mode: null })}>Follow the system</button>}
          </span>
          <div className="segmented narrow" role="radiogroup" aria-label="Theme">
            {(["dark", "light"] as const).map((m) => (
              <button key={m} role="radio" aria-checked={modeOf(t) === m} className={modeOf(t) === m ? "on" : ""}
                onClick={() => theme.set({ mode: m })}>{m === "dark" ? "Dark" : "Light"}</button>
            ))}
          </div>
          {t.mode === null && <small>Following the system.</small>}
        </div>
        <div className="field">
          <span className="field-label">Contrast
            {t.contrast !== null && <button className="link-inline" onClick={() => theme.set({ contrast: null })}>Follow the system</button>}
          </span>
          <div className="segmented narrow" role="radiogroup" aria-label="Contrast">
            {([false, true] as const).map((high) => (
              <button key={String(high)} role="radio" aria-checked={contrastOn(t) === high} className={contrastOn(t) === high ? "on" : ""}
                onClick={() => theme.set({ contrast: high })}>{high ? "High" : "Normal"}</button>
            ))}
          </div>
          <small>{t.contrast !== null ? "Set here, overriding the system setting."
            : systemWantsContrast() ? "High, because the system asks for more contrast." : "Following the system."}</small>
        </div>
        {!UTILS && <>
        <div className="field">
          <span className="field-label">Night mode</span>
          <div className="segmented narrow" role="radiogroup" aria-label="Night mode">
            {([false, true] as const).map((on) => (
              <button key={String(on)} role="radio" aria-checked={t.night === on} className={t.night === on ? "on" : ""}
                onClick={() => theme.set({ night: on })}>{on ? "On" : "Off"}</button>
            ))}
          </div>
          <small>Warms every colour, like a night light.</small>
        </div>
        <div className="field">
          <span className="field-label">Warmth
            {t.warmth !== DEFAULT_WARMTH && <button className="link-inline" onClick={() => theme.set({ warmth: DEFAULT_WARMTH })}>Back to default</button>}
          </span>
          <input type="range" className="hue-slider" style={{ background: warm }} min={WARMTH[0]} max={WARMTH[1]} step={0.05} value={t.warmth}
            disabled={!t.night} aria-label="Night mode warmth" aria-valuetext={`${Math.round(t.warmth * 100)}%`}
            onChange={(e) => theme.set({ warmth: Number(e.target.value) })} />
          {!t.night && <small>Night mode is off.</small>}
        </div>
        <div className="field">
          <span className="field-label">Primary colour
            {t.hue !== YELLOW_HUE && <button className="link-inline" onClick={() => theme.set({ hue: YELLOW_HUE })}>Back to yellow</button>}
          </span>
          <input type="range" className="hue-slider" style={{ background: rainbow }} min={0} max={359} step={1} value={t.hue} aria-label="Primary colour hue"
            onChange={(e) => theme.set({ hue: Number(e.target.value) })} />
          <small>Main buttons, new audio and edits.</small>
        </div>
        <div className="field">
          <span className="field-label">Secondary colour
            {t.hue2 !== BLUE_HUE && <button className="link-inline" onClick={() => theme.set({ hue2: BLUE_HUE })}>Back to blue</button>}
          </span>
          <input type="range" className="hue-slider second" style={{ background: rainbow2 }} min={0} max={359} step={1} value={t.hue2} aria-label="Secondary colour hue"
            onChange={(e) => theme.set({ hue2: Number(e.target.value) })} />
          <small>Links, the open tab, the selection and the focus ring{modeOf(t) === "light" ? ", and primary-coloured text and lines on the light theme" : ""}.</small>
        </div>
        </>}
      </section>

      <section className="set-sec">
        <h2>{UTILS ? "Text" : "Text and spacing"}</h2>
        {!UTILS && <>
        <div className="field">
          <span className="field-label">Typeface for text
            {t.bodyFont !== DEFAULT_THEME.bodyFont && <button className="link-inline" onClick={() => theme.set({ bodyFont: DEFAULT_THEME.bodyFont })}>Back to Archivo</button>}
          </span>
          <FontPicker label="Typeface for text" value={t.bodyFont} onChange={(f) => theme.set({ bodyFont: f })} />
          <small>{FONTS.find((f) => f.id === t.bodyFont)?.about}</small>
        </div>
        <div className="field">
          <span className="field-label">Typeface for titles
            {t.titleFont !== DEFAULT_THEME.titleFont && <button className="link-inline" onClick={() => theme.set({ titleFont: DEFAULT_THEME.titleFont })}>Back to Archivo</button>}
          </span>
          <FontPicker label="Typeface for titles" value={t.titleFont} onChange={(f) => theme.set({ titleFont: f })} />
          <small>Page and panel titles, and the app name.</small>
        </div>
        </>}
        <div className="field">
          <span className="field-label">Text size
            {t.size !== DEFAULT_SIZE && <button className="link-inline" onClick={() => theme.set({ size: DEFAULT_SIZE })}>Back to default</button>}
          </span>
          <input type="range" className="size-slider" min={0} max={TEXT_SIZES.length - 1} step={1} value={TEXT_SIZES.indexOf(t.size)}
            aria-label="Text size" aria-valuetext={`${t.size} pixels`} onChange={(e) => theme.set({ size: TEXT_SIZES[Number(e.target.value)] })} />
          <div className="size-ticks">
            {TEXT_SIZES.map((px) => (
              <button key={px} tabIndex={-1} className={`${px === t.size ? "on" : ""}${px === DEFAULT_SIZE ? " default" : ""}`}
                data-tip={px === DEFAULT_SIZE ? "Default" : undefined} onClick={() => theme.set({ size: px })}>{px}px</button>
            ))}
          </div>
        </div>
        {!UTILS && <div className="field">
          <span className="field-label">Spacing</span>
          <div className="segmented narrow" role="radiogroup" aria-label="Spacing">
            {DENSITIES.map(([d, name]) => (
              <button key={d} role="radio" aria-checked={t.density === d} className={t.density === d ? "on" : ""}
                onClick={() => theme.set({ density: d })}>{name}</button>
            ))}
          </div>
          <small>{t.density === "compact" ? "Fits the most on screen." : t.density === "relaxed" ? "More room around rows and buttons." : "The default."}</small>
        </div>}
      </section>

      {!UTILS && <>
      <section className="set-sec">
        <h2>Tab bar</h2>
        <div className="field">
          <span className="field-label">Position</span>
          <div className="segmented narrow" role="radiogroup" aria-label="Tab bar position">
            {BAR_SIDES.map(([side, name]) => (
              <button key={side} role="radio" aria-checked={t.bar === side} className={t.bar === side ? "on" : ""}
                onClick={() => theme.set({ bar: side })}>{name}</button>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="field-label">Tab names</span>
          <div className="segmented narrow" role="radiogroup" aria-label="Tab names">
            {([true, false] as const).map((on) => (
              <button key={String(on)} role="radio" aria-checked={t.labels === on} className={t.labels === on ? "on" : ""}
                onClick={() => theme.set({ labels: on })}>{on ? "On" : "Off"}</button>
            ))}
          </div>
          <small>{!t.labels ? "Icons only. Names show in tooltips." : barIsVertical(t.bar) ? "Names show when the pointer is on a tab." : "Names show beside the icons."}</small>
        </div>
      </section>

      <section className="set-sec">
        <h2>Animations</h2>
        <div className="field">
          <span className="field-label">Animations
            {t.motion !== null && <button className="link-inline" onClick={() => theme.set({ motion: null })}>Follow the system</button>}
          </span>
          <div className="segmented narrow" role="radiogroup" aria-label="Animations">
            {([true, false] as const).map((on) => (
              <button key={String(on)} role="radio" aria-checked={motionOn(t) === on} className={motionOn(t) === on ? "on" : ""}
                onClick={() => theme.set({ motion: on })}>{on ? "On" : "Off"}</button>
            ))}
          </div>
          <small>{t.motion !== null ? "Set here, overriding the system setting."
            : systemReducesMotion() ? "Off, because the system asks for less motion." : "Following the system."}</small>
        </div>
        <div className="field">
          <span className="field-label">Animation speed
            {t.speed !== 1 && <button className="link-inline" onClick={() => theme.set({ speed: 1 })}>Back to normal</button>}
          </span>
          <input type="range" className="size-slider" min={0} max={SPEEDS.length - 1} step={1} value={SPEEDS.indexOf(t.speed)}
            disabled={!motionOn(t)} aria-label="Animation speed" aria-valuetext={`${t.speed} times normal`}
            onChange={(e) => theme.set({ speed: SPEEDS[Number(e.target.value)] })} />
          <div className="size-ticks">
            {SPEEDS.map((s) => (
              <button key={s} tabIndex={-1} disabled={!motionOn(t)} className={`${s === t.speed ? "on" : ""}${s === 1 ? " default" : ""}`}
                data-tip={s === 1 ? "Normal" : s < 1 ? "Slower" : "Faster"} onClick={() => theme.set({ speed: s })}>{s}×</button>
            ))}
          </div>
          <div className="motion-demo" aria-hidden><span key={`${t.speed}:${motionOn(t)}`} /></div>
        </div>
      </section>
      </>}
      </div>
      <aside className="set-aside">
        <button className="btn" disabled={!changed} onClick={reset}>Reset to Default</button>
      </aside>
    </div>
  );
}
