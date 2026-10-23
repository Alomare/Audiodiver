import { startTransition, useEffect, useRef, useState } from "react";
import { AboutButton, AboutDialog } from "./About";
import { ConfirmDialog } from "./Confirm";
import { BuildTab } from "./BuildTab";
import { combineInbox } from "./CombinePage";
import { repatchInbox } from "./RepatchPage";
import { CueView } from "./CueView";
import { ExportListDialog } from "./ExportDialog";
import { useExportList } from "./exportList";
import { Home } from "./Home";
import { AudioIcon, BuildIcon, CheckIcon, CopyIcon, GearIcon, GuideIcon, HomeIcon, InfoIcon, LibraryIcon, PlusIcon,
  ProjectIcon, RedoIcon, SaveIcon, TextIcon, ToolsIcon, UndoIcon, UpdatesIcon } from "./Icons";
import { Inspector } from "./Inspector";
import { LibraryPanel, ProjectPanel } from "./Library";
import { Logo } from "./Logo";
import { ProjectTab } from "./ProjectTab";
import { tabArrows } from "./Page";
import { SettingsTab } from "./SettingsTab";
import { TextTab } from "./TextTab";
import { ToolsTab } from "./ToolsTab";
import { TooltipLayer } from "./Tooltip";
import { UpdatePrompt, UpdatesTab } from "./UpdatesTab";
import { updates, useUpdates } from "./updates";
import { Wiki } from "./Wiki";
import { fmtTime, iconUrl, type Job } from "./api";
import { APP_LABEL, APP_VERSION, versionLabel } from "./content";
import { JOB_NAMES } from "./jobs";
import { keyLabel, useCommands, useKeymap, type CommandId } from "./keys";
import { counted } from "./music";
import { nav, useNav, type Tab } from "./nav";
import { expandDropped, isImage, isTauri, onFileDrop, setTitle } from "./platform";
import { player, usePlayer } from "./player";
import { Splitter } from "./Resize";
import { RESET_LAYOUT, useSettings } from "./settings";
import { barIsVertical, useThemeValue, type BarSide } from "./theme";
import { EDIT_NAMES, Scope, useEditor, type ScopeName, type ToastIcon } from "./store";

export function App() {
  const { status, connectError } = useEditor();
  if (!status || status.stage !== "ready") return <Startup error={connectError ?? status?.error ?? null} stage={status?.stage} />;
  return <Shell />;
}

function Startup({ error, stage }: { error: string | null; stage?: string }) {
  const { status, actions } = useEditor();
  const [picked, setPicked] = useState<string | null>(null); // why the folder just chosen can't be used
  const where = status?.game_folder;
  const choose = async (path?: string | null) => setPicked(await actions.setGameFolder(path));
  return (
    <main className="startup">
      <div className="startup-card">
        <Logo detail />
        <h1>Audiodiver</h1>
        {stage === "failed" ? (
          <>
            <p className="warn-box">{picked ?? error}</p>
            {/* a folder that was just refused says where to look itself */}
            {!picked && <p className="muted">Choose the folder Steam installed Helldivers 2 in,
              usually <code>…\steamapps\common\Helldivers 2</code>. Audiodiver only reads it.</p>}
            <div className="row-btns">
              <button className="btn primary" onClick={() => choose()}>Choose the game's folder…</button>
              {where?.chosen && <button className="btn quiet" onClick={() => choose(null)}>Look in Steam again</button>}
            </div>
          </>
        ) : error && !stage ? (
          <p className="warn-box">{error}</p>
        ) : (
          <>
            <p className="loading">{stage && stage !== "starting" ? stage : "Starting…"}</p>
            {where?.path && <p className="startup-where" data-tip={where.path} data-tip-clip>{where.path}</p>}
          </>
        )}
      </div>
      <TooltipLayer />
    </main>
  );
}

// libSplit: the Library's list, as a share of the window (it has no details panel), a third by default
const WIDTHS = { left: 320, right: 340, libSplit: 1 / 3 };
type Widths = typeof WIDTHS;

/** The tab that browses audio, if that is the one showing: the Library or the Editor. */
const browsing = (): ScopeName | null => { const t = nav.get().tab; return t === "library" || t === "editor" ? t : null; };

/** The window: the master tabs along the top, the tab that shows, and the status bar. The Library and the Editor
    stay in place behind the other tabs, so coming back finds them as they were left (scroll position, search,
    selection). */
function Shell() {
  const { actions, quick, notify, itemIndex, jobs, scopes, project } = useEditor();
  const { tab } = useNav();
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  // the Text Editor stays as it was left (search, filter, the open line) once it has been opened
  const [textSeen, setTextSeen] = useState(false);
  useEffect(() => { if (tab === "text") setTextSeen(true); }, [tab]);
  // the Library and the Audio Editor are drawn when first shown, or when the start is over, in a render a click can
  // interrupt: drawing the hidden one at the start too cost a slow PC most of a second before the window answered
  const [drawn, setDrawn] = useState<ReadonlySet<Tab>>(() => new Set([tab]));
  useEffect(() => { if (!drawn.has(tab)) setDrawn((d) => new Set([...d, tab])); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const id = requestIdleCallback(() => startTransition(() => setDrawn((d) => new Set([...d, "library", "editor"]))), { timeout: 4000 });
    return () => cancelIdleCallback(id);
  }, []);
  const [widths, setWidths] = useState<Widths>(() => {
    try {
      const kept = { ...WIDTHS, ...JSON.parse(localStorage.getItem("audiodiver.widths") ?? "{}") };
      return kept.libSplit === 0.5 ? { ...kept, libSplit: WIDTHS.libSplit } : kept;  // the old default, never dragged
    } catch { return WIDTHS; }
  });
  useEffect(() => { try { localStorage.setItem("audiodiver.widths", JSON.stringify(widths)); } catch { /* storage off */ } }, [widths]);
  useEffect(() => {
    const reset = () => setWidths(WIDTHS);
    window.addEventListener(RESET_LAYOUT, reset);
    return () => window.removeEventListener(RESET_LAYOUT, reset);
  }, []);
  const handler = useRef<(paths: string[], target: any) => void>(() => {});

  // a new version of Audiodiver, looked for once per launch: the setting (Settings ▸ System) says whether to ask,
  // install it straight away, or only light up the Updates tab
  const [prompt, setPrompt] = useState(false);
  useEffect(() => {
    let live = true;
    updates.startup().then(async (action) => {
      if (!live || !action || !updates.claimStartup()) return; // asked once per launch, also when the game is read again
      if (action === "prompt") return setPrompt(true);
      const label = versionLabel(updates.get().latest!.version);
      const r = await updates.install(false, () => notify("info", `Updating to ${label}. Audiodiver restarts when the update is installed.`));
      if (r === "page") setPrompt(true); // this version can't install it: ask instead
      else if (r === "failed") notify("bad", `${label} didn't install: ${updates.get().installError}`, { label: "Updates", run: () => nav.go("updates") }, true);
    });
    return () => { live = false; };
  }, [notify]);

  // what a drop does depends on what was dropped and where it lands
  handler.current = async (raw, target) => {
    // mods to combine: anything on the Combine Mods page
    if (target?.kind === "combine") return combineInbox.offer(raw);
    // a mod to repatch: anything on the Repatch page, or a ZIP anywhere else (nothing else takes one)
    const zip = raw.find((p) => /\.zip$/i.test(p));
    if (target?.kind === "repatch" || zip) {
      nav.go("tools", "repatch");
      return repatchInbox.offer(target?.kind === "repatch" ? raw[0] : zip!);
    }
    const paths = await expandDropped(raw);
    const patch = paths.find((p) => /\.patch_\d+$/i.test(p));
    const pack = paths.find((p) => /\.audipack$/i.test(p));
    const proj = paths.find((p) => /\.audi$/i.test(p));
    const images = paths.filter(isImage);
    const audio = paths.filter((p) => !/\.(patch_\d+|audi|audipack)$/i.test(p) && !isImage(p));
    if (pack) return actions.openPack(pack);
    if (proj) return actions.openProject(proj);
    if (patch) return actions.importPatch(patch);
    if (target?.kind === "icon") return images.length ? actions.setIcon(images[0]) : quick("Drop an image here to make it the icon", "info");
    if (!audio.length) return quick(images.length ? "Drop images on the icon on the Project tab" : "No audio files in the drop", "info");
    // only the Editor has places to drop audio onto: a slot, a group of takes, a cue, a piece of music
    if (target?.kind === "slot") { scopes.editor.setSelected([target.source]); return actions.assign(target.source, audio); }
    if (target?.kind === "sources") return actions.fillSources(target.sources, audio, target.what);
    if (target?.kind === "cue") return actions.fill(target.cue, audio);
    if (target?.kind === "item") {
      const it = itemIndex.items.get(target.item);
      if (it) return actions.fillSources(counted(it), audio, `the ${it.parts.length} parts of ${it.full}`);
    }
    const t = nav.get().tab;
    quick(t === "editor" ? (project ? "Drop audio on a slot, a group of takes, a piece in the list or a title" : "Open a project first")
      : t === "library" ? "Add it to the project, then drop audio on its slots in the Audio Editor"
      : "Drop audio on a slot in the Audio Editor", "info");
  };

  useEffect(() => {
    let off = () => {}, gone = false; // gone: the effect was undone before the listener was in place
    const targetAt = (x: number, y: number) => (document.elementFromPoint(x, y)?.closest("[data-drop]") as HTMLElement | null);
    let last: HTMLElement | null = null;
    onFileDrop((e) => {
      last?.classList.remove("drop-over");
      if (e.kind === "leave") { setDropTarget(null); last = null; return; }
      const el = targetAt(e.x, e.y);
      if (e.kind === "over") {
        el?.classList.add("drop-over"); last = el;
        setDropTarget(el ? JSON.parse(el.dataset.drop!).kind : "none");
      } else {
        setDropTarget(null); last = null;
        handler.current(e.paths, el ? JSON.parse(el.dataset.drop!) : null);
      }
    }).then((f) => { if (gone) f(); else off = f; });
    // in a plain browser, file drops carry no paths
    const block = (ev: DragEvent) => { ev.preventDefault(); if (ev.type === "drop" && !isTauri()) quick("Dropping files needs the desktop app", "info"); };
    window.addEventListener("dragover", block); window.addEventListener("drop", block);
    return () => { gone = true; off(); window.removeEventListener("dragover", block); window.removeEventListener("drop", block); };
  }, [quick]);

  // closing the window while a build or export runs asks first: closing stops the core, and the job with it
  const running = useRef<string[]>([]);
  running.current = Object.values(jobs).filter((j) => j.state === "running").map((j) => JOB_NAMES[j.kind]?.[0].toLowerCase() ?? j.kind);
  useEffect(() => {
    if (!isTauri()) return;
    let off = () => {};
    let gone = false;
    (async () => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const w = getCurrentWindow();
      const stop = await w.onCloseRequested(async (ev) => {
        if (!running.current.length) return;
        ev.preventDefault();
        const { ask } = await import("@tauri-apps/plugin-dialog");
        const what = running.current.length > 1 ? "Some jobs are" : `A ${running.current[0]} is`;
        if (await ask(`${what} still running. Closing Audiodiver stops it.`, { title: "Audiodiver", kind: "warning", okLabel: "Close anyway", cancelLabel: "Keep working" })) {
          await w.destroy();
        }
      });
      if (gone) stop(); else off = stop;
    })();
    return () => { gone = true; off(); };
  }, []);

  // what the keyboard does anywhere in the app (keys.ts has the keys; the slot lists add their own in CueView)
  useCommands({
    save: () => { actions.save(); },
    undo: () => { actions.undo(); },
    redo: () => { actions.redo(); },
    build: () => { actions.build(); },
    newProject: () => { actions.newProject(); },
    openProject: () => { actions.openProject(); },
    closeProject: () => { actions.closeProject(); },
    search: () => { // the search box of the tab that shows (the Wiki, the Text Editor, Settings ▸ Shortcuts, the
      // Library's and the Audio Editor's lists); from a tab without one, the Library's
      const own = { wiki: ".wiki-search input", text: ".text-tab:not([hidden]) .lib-search input[type=search]",
        settings: ".keys-bar input[type=search]" }[nav.get().tab as string];
      const box0 = own ? document.querySelector<HTMLInputElement>(own) : null;
      if (box0) { box0.focus(); box0.select(); return; }
      if (!browsing()) nav.go("library");
      requestAnimationFrame(() => {
        const box = document.querySelector<HTMLInputElement>(
          ".panes:not([hidden]) .lib-pane:not([hidden]) .lib-search input, .panes:not([hidden]) .library > .lib-search input");
        box?.focus(); box?.select();
      });
    },
    // Ctrl+A outside a field and away from a slot list (they take it first) selects nothing, not the window's text
    selectAll: (e) => ((e.target as Element).closest?.("input, textarea, [contenteditable=true]") ? false : undefined),
    // taken on every tab, so the keys never reach the webview's own history
    back: () => { const s = browsing(); if (s) scopes[s].back(); },
    forward: () => { const s = browsing(); if (s) scopes[s].forward(); },
    playPause: (e) => { // pause or resume whatever plays; Space and Enter on a button still press that button
      if ((e.key === " " || e.key === "Enter") && (e.target as Element).closest?.("button, a, summary, [role=slider]")) return false;
      return player.toggle();
    },
    stop: () => {
      const s = browsing();
      if (player.state.key) player.stop();
      else if (s && scopes[s].selected.length) scopes[s].setSelected([]);
      else return false;
    },
    tabHome: () => nav.go("home"),
    tabProject: () => nav.go("project"),
    tabLibrary: () => nav.go("library"),
    tabEditor: () => nav.go("editor"),
    tabBuild: () => nav.go("build"),
    tabTools: () => nav.go("tools"),
    tabText: () => nav.go("text"),
    updates: () => nav.toggle("updates"),
    wiki: () => nav.toggle("wiki"),
    settings: () => nav.toggle("settings"),
    shortcuts: () => nav.toggle("settings", "shortcuts"),
  });

  // the mouse's back and forward buttons
  const scopesNow = useRef(scopes);
  scopesNow.current = scopes;
  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      const s = browsing();
      if ((e.button === 3 || e.button === 4) && s) { e.preventDefault(); (e.button === 3 ? scopesNow.current[s].back : scopesNow.current[s].forward)(); }
    };
    window.addEventListener("mouseup", onMouse);
    return () => window.removeEventListener("mouseup", onMouse);
  }, []);

  return (
    <div className={`app${dropTarget ? " dragging" : ""}`} data-tab={tab}>
      <Rail />
      <div className="views">
        {(["library", "editor"] as const).map((scope) => {
          // the Library has two panels, half and half to start: what a slot is shows under its waveform, in the middle
          const lib = scope === "library";
          if (tab !== scope && !drawn.has(scope)) return null;
          return (
            <Scope key={scope} name={scope}>
              <div className={`panes${lib ? " two lib-split" : ""}`} hidden={tab !== scope}
                style={lib ? { ["--split" as any]: String(widths.libSplit) } : { ["--left" as any]: `${widths.left}px`, ["--right" as any]: `${widths.right}px` }}>
                {lib ? <LibraryPanel /> : <ProjectPanel />}
                {lib ? <Splitter fraction width={widths.libSplit} onResize={(f) => setWidths((v) => ({ ...v, libSplit: f }))} initial={WIDTHS.libSplit}
                    panel="left" cssVar="--split" label="Resize the list" />
                  : <Splitter width={widths.left} onResize={(w) => setWidths((v) => ({ ...v, left: w }))} initial={WIDTHS.left} panel="left" label="Resize the list" />}
                <main className="center"><CueView /></main>
                {!lib && <Splitter width={widths.right} onResize={(w) => setWidths((v) => ({ ...v, right: w }))} initial={WIDTHS.right} panel="right" label="Resize the details panel" />}
                {!lib && <Inspector />}
              </div>
            </Scope>
          );
        })}
        {tab === "home" && <Home />}
        {tab === "project" && <ProjectTab />}
        {(tab === "text" || textSeen) && <TextTab hidden={tab !== "text"} />}
        {tab === "build" && <BuildTab />}
        {tab === "tools" && <ToolsTab />}
        {tab === "updates" && <UpdatesTab />}
        {tab === "settings" && <SettingsTab />}
        {tab === "wiki" && <Wiki />}
      </div>
      <StatusBar />
      <Notices />
      <AboutDialog />
      <ConfirmDialog />
      {prompt && <UpdatePrompt onClose={() => setPrompt(false)} />}
      <TooltipLayer />
    </div>
  );
}

type MainTab = { id: Tab; name: string; about: string; cmd: CommandId; Icon: () => React.JSX.Element };
/** Home and Tools make projects; the rest work on the open one, in the order a mod is made. */
const APP_TABS: MainTab[] = [
  { id: "home", name: "Home", about: "projects", cmd: "tabHome", Icon: HomeIcon },
  { id: "tools", name: "Tools", about: "repatch and combine existing mods", cmd: "tabTools", Icon: ToolsIcon },
];
const MOD_TABS: MainTab[] = [
  { id: "project", name: "Project", about: "name, icon and files", cmd: "tabProject", Icon: ProjectIcon },
  { id: "library", name: "Library", about: "all the game's audio", cmd: "tabLibrary", Icon: LibraryIcon },
  { id: "editor", name: "Audio Editor", about: "replace what the project lists", cmd: "tabEditor", Icon: AudioIcon },
  { id: "text", name: "Text Editor", about: "subtitles and the rest of the game's text", cmd: "tabText", Icon: TextIcon },
  { id: "build", name: "Build", about: "the mod's ZIP", cmd: "tabBuild", Icon: BuildIcon },
];
/** Why the Build tab carries a dot: the ZIP in the build folder isn't the project as it is now. */
const REBUILD = { new: "not built yet", changed: "changed since the last build", game: "the game updated since the last build" };

const TIP_SIDE: Record<BarSide, string> = { top: "bottom", right: "left", bottom: "top", left: "right" };
const upper = (s: string) => s[0].toUpperCase() + s.slice(1);
/** A short key for a project's icon (its file and settings), so the tab bar fetches it again only when it changes. */
const iconKey = (icon: unknown) => {
  let h = 0;
  for (const c of JSON.stringify(icon)) h = (h * 31 + c.charCodeAt(0)) | 0;
  return (h >>> 0).toString(36);
};

/** The master tabs, along the side of the window Settings ▸ Theme puts them on (the top by default): an icon each.
    Home and Tools come first; then a band of the tabs that work on the open project, led by the Project tab with
    the project's own icon and name, and ending with Build (a dot when the build folder's ZIP isn't the project as it
    is now, a count when problems stop the build). Updates, the Wiki and Settings are at the far end (Updates lights
    up when a new version is out). With names on, a top or bottom bar shows each main tab's name beside its icon,
    and a side bar shows it when the pointer is on the tab, in a label that grows out of the button and holds what
    the tooltip says. Updates, the Wiki and Settings never show a name. The open tab takes the colour of the page
    beside it and covers the bar's edge, so it reads as holding that page. The open project's name is the window's
    title. */
function Rail() {
  const { project } = useEditor();
  const { tab } = useNav();
  const u = useUpdates();
  const t = { bar: useThemeValue((x) => x.bar), labels: useThemeValue((x) => x.labels) }; // not every colour change
  const { tips } = useSettings();
  useKeymap(); // the keys in the side bar's labels follow a rebinding
  const problems = project?.problems.length ?? 0;
  const name = project?.name;
  useEffect(() => { setTitle(name ? `${name} · Audiodiver` : "Audiodiver"); }, [name]);
  const iconSig = project ? iconKey([project.path, project.icon]) : ""; // repatched projects all have "icon.png"
  const [broken, setBroken] = useState(""); // the icon that didn't load: the Project tab's own icon stands in
  const vertical = barIsVertical(t.bar);
  const tabButton = (id: Tab, label: string, tip: string, cmd: CommandId, icon: React.ReactNode, go: () => void,
    badge?: number, lit?: boolean | "dot", shown?: { name: string; about: string }, cls = "") => {
    const named = !!shown && t.labels && !vertical; // the name beside the icon
    const flyout = !!shown && t.labels && vertical;  // the name in a label on hover, with the tooltip's words in it
    return (
      <button key={id} role="tab" aria-selected={tab === id} aria-label={label}
        className={`tab${tab === id ? " on" : ""}${lit === true ? " lit" : ""}${named ? " named" : ""}${cls}`} onClick={go}
        data-tip={flyout ? undefined : named ? upper(shown!.about) : tip} data-tip-cmd={cmd} data-tip-side={TIP_SIDE[t.bar]}>
        {icon}
        {named && <span className="tab-name">{shown!.name}</span>}
        {badge ? <span className="rail-badge" aria-hidden>{badge}</span>
          : lit ? <span className={`rail-dot${lit === "dot" ? " quiet" : ""}`} aria-hidden /> : null}
        {flyout && (
          <span className="tab-fly" aria-hidden>
            <b>{shown!.name}</b>
            {tips !== "off" && <span className="tab-fly-tip">{upper(shown!.about)}{keyLabel(cmd) && <kbd>{keyLabel(cmd)}</kbd>}</span>}
          </span>
        )}
      </button>
    );
  };
  const mainTab = ({ id, name, about, cmd, Icon }: MainTab) => {
    let label = name, shown = name, icon = <Icon />, badge = 0, dot = false, cls = "";
    if (id === "project" && project) { // the project's own icon and name
      [label, shown, about, cls] = [`Project, ${project.name}`, project.name, "the project's name, icon and files", " tab-mod"];
      if (broken !== iconSig)
        icon = <img className="tab-mod-icon" src={iconUrl(iconSig)} alt="" draggable={false} onError={() => setBroken(iconSig)} />;
    }
    if (id === "build" && problems) {
      const stop = `${problems} problem${problems > 1 ? "s" : ""}`;
      [label, about, badge] = [`${name}, ${stop}`, `${stop} to fix`, problems];
    } else if (id === "build" && project?.rebuild) {
      [label, about, dot] = [`${name}, ${REBUILD[project.rebuild]}`, REBUILD[project.rebuild], true];
    }
    return tabButton(id, label, `${shown}: ${about}`, cmd, icon, () => nav.go(id), badge, dot && "dot", { name: shown, about }, cls);
  };
  const update = u.latest ? `${versionLabel(u.latest.version)} is available` : "";
  const orientation = vertical ? "vertical" : "horizontal";
  return (
    <nav className="rail" aria-label="Main">
      <div className="rail-group" role="tablist" aria-orientation={orientation} aria-label="Tabs" onKeyDown={tabArrows}>
        <div className="rail-set">{APP_TABS.map(mainTab)}</div>
        <div className={`rail-set rail-mod${project ? "" : " idle"}`}>{MOD_TABS.map(mainTab)}</div>
      </div>
      <div className="rail-group" role="tablist" aria-orientation={orientation} aria-label="More" onKeyDown={tabArrows}>
        {tabButton("updates", update ? `Updates, ${update}` : "Updates", update ? `Updates: ${update}` : "Updates: new versions and changelogs",
          "updates", <UpdatesIcon />, () => nav.toggle("updates"), 0, !!update)}
        {tabButton("wiki", "Wiki", "Wiki: guides", "wiki", <GuideIcon />, () => nav.toggle("wiki"))}
        {tabButton("settings", "Settings", "Settings", "settings", <GearIcon />, () => nav.toggle("settings"))}
      </div>
    </nav>
  );
}

/** Along the bottom: undo and redo, what the core is doing or where the project is saved, the export list, what
    plays, and the version (it leads to Updates, and carries a dot when a new one is out) with About beside it. */
function StatusBar() {
  const { status, jobs, project, actions } = useEditor();
  const u = useUpdates();
  const running = Object.values(jobs).filter((j) => j.state === "running");
  const core = status?.version && status.version !== APP_VERSION ? `, core ${versionLabel(status.version)}` : "";
  return (
    <footer className="statusbar">
      <div className="sb-undo">
        <button className="sb-btn" onClick={actions.undo} disabled={!project?.can_undo} aria-label="Undo" data-tip-cmd="undo"
          data-tip={project?.can_undo ? `Undo ${EDIT_NAMES[project.undo_label ?? ""] ?? "the last change"}` : "Nothing to undo"}><UndoIcon /></button>
        <button className="sb-btn" onClick={actions.redo} disabled={!project?.can_redo} aria-label="Redo" data-tip-cmd="redo"
          data-tip={project?.can_redo ? `Redo ${EDIT_NAMES[project.redo_label ?? ""] ?? "the change"}` : "Nothing to redo"}><RedoIcon /></button>
      </div>
      {running.length ? (
        <span className="busy sb-main">{JOB_NAMES[running[0].kind]?.[1] ?? "Working"}{running[0].total ? ` ${Math.round((running[0].done / running[0].total) * 100)}%` : ""}: {running[0].doing || running[0].log[running[0].log.length - 1] || "starting"}</span>
      ) : (
        <span className="sb-main" data-tip={project?.path} data-tip-clip>{project ? `Autosaved · ${project.path}` : "No project open"}</span>
      )}
      <span className="spacer" />
      <ExportListButton />
      <NowPlaying />
      <span className="sb-version">
        <button className={`sb-ver${u.latest ? " lit" : ""}`} onClick={() => nav.go("updates")} aria-label={u.latest ? `${APP_LABEL}: a new version is available` : undefined}
          data-tip={u.latest ? `${versionLabel(u.latest.version)} is available` : `Audiodiver ${APP_LABEL}${core}`} data-tip-more="Updates and changelogs">
          {APP_LABEL}{u.latest && <span className="sb-dot" aria-hidden />}</button>
        <AboutButton />
      </span>
    </footer>
  );
}

/** The export list's button, once something is on it: opens the list to export it all at once. */
function ExportListButton() {
  const list = useExportList();
  const [open, setOpen] = useState(false);
  if (!list.length && !open) return null;
  return (
    <>
      <button className="sb-list" onClick={() => setOpen(true)} data-tip="Things collected to export together">
        Export list · {list.length}</button>
      {open && <ExportListDialog onClose={() => setOpen(false)} />}
    </>
  );
}

/** What plays, wherever it was started from: pause, stop, position, and the preview volume. Its name leads to it:
    the tab, the item and the slot it was started from. */
function NowPlaying() {
  const p = usePlayer();
  const { goTo, quick } = useEditor();
  const show = async () => { if (p.at && !(await goTo(p.at))) quick("That item no longer exists", "info"); };
  // a preview that fails (a file gone, audio the core can't read) says so: the button alone just went back to ▶
  useEffect(() => { if (p.error) quick(`Can't play ${p.label || "this audio"}`, "info"); }, [p.error, p.label, quick]);
  return (
    <span className="np">
      {p.key && (
        <>
          <button className="np-btn" onClick={() => player.toggle()} aria-label={p.playing ? "Pause" : "Play"} data-tip={p.playing ? "Pause" : "Play"} data-tip-cmd="playPause">{p.playing ? "❚❚" : "▶"}</button>
          {p.at ? <button className="np-label go" onClick={show} data-tip={`Go to ${p.label || "it"}`}>{p.label || "Preview"}</button>
            : <span className="np-label" data-tip={p.label} data-tip-clip>{p.label || "Preview"}</span>}
          <span className="np-time">{fmtTime(p.time * 1000)}{p.duration ? ` / ${fmtTime(p.duration * 1000)}` : ""}</span>
          <button className="np-btn" onClick={() => player.stop()} aria-label="Stop" data-tip="Stop" data-tip-cmd="stop">■</button>
        </>
      )}
      <label className="np-vol" data-tip={`Preview volume: ${Math.round(p.volume * 100)}% (not part of the mod)`}>
        <span aria-hidden>Vol</span>
        <input type="range" min={0} max={1} step={0.05} value={p.volume} aria-label="Preview volume"
          onChange={(e) => player.setVolume(Number(e.target.value))} />
      </label>
    </span>
  );
}

/** A running job, shown until it ends: what it is on, how far along, and a way to stop it. */
function JobCard({ job }: { job: Job }) {
  const { actions } = useEditor();
  const [stopping, setStopping] = useState(false);
  const name = JOB_NAMES[job.kind]?.[1] ?? "Working";
  const fraction = job.total ? Math.min(1, job.done / job.total) : null;
  return (
    <div className="notice job" role="status">
      <div className="job-body">
        <div className="job-head">
          <b>{name}{job.title ? ` ${job.title}` : ""}</b>
          <span>{[fraction !== null && `${Math.round(fraction * 100)}%`, `${Math.round(job.seconds)} s`].filter(Boolean).join(" · ")}</span>
        </div>
        <div className={`job-bar${fraction === null ? " unknown" : ""}`} role="progressbar" aria-valuemin={0} aria-valuemax={100}
          aria-valuenow={fraction !== null ? Math.round(fraction * 100) : undefined}>
          <div style={fraction !== null ? { width: `${fraction * 100}%` } : undefined} />
        </div>
        <div className="job-doing">{stopping ? "Stopping…" : job.doing || job.log[job.log.length - 1] || "Starting…"}</div>
      </div>
      {(job.kind === "export" || job.kind === "build") && (
        <button className="btn quiet" disabled={stopping} onClick={() => { setStopping(true); actions.cancelJob(job.id); }}>Cancel</button>
      )}
    </div>
  );
}

function Notices() {
  const { notices, dismiss, jobs } = useEditor();
  const running = Object.values(jobs).filter((j) => j.state === "running");
  return (
    <>
      <div className="notices" aria-live="polite">
        {running.map((j) => <JobCard key={j.id} job={j} />)}
        {notices.map((n) => (
          <div key={n.id} className={`notice ${n.tone}${n.leaving ? " leaving" : ""}`}>
            <NoticeText text={n.text} />
            {n.action && <button className="btn quiet" onClick={() => { n.action!.run(); dismiss(n.id); }}>{n.action.label}</button>}
            <button className="x" onClick={() => dismiss(n.id)} aria-label="Dismiss">✕</button>
          </div>
        ))}
      </div>
      <QuickNote />
    </>
  );
}

/** A notice's words: its first line, then any further lines as a list (what an import brought in, item by item). */
function NoticeText({ text }: { text: string }) {
  const [head, ...rest] = text.split("\n");
  if (!rest.length) return <span>{head}</span>;
  return (
    <div className="notice-text">
      {head}
      <ul>{rest.map((line, i) => <li key={i}>{line}</li>)}</ul>
    </div>
  );
}

const TOAST_ICONS: Record<ToastIcon, () => React.JSX.Element> = {
  done: CheckIcon, add: PlusIcon, save: SaveIcon, copy: CopyIcon, undo: UndoIcon, info: InfoIcon,
};

/** The quick note at the bottom of the window (store.tsx, Toast): one line, an icon, gone in a moment. */
function QuickNote() {
  const { toast } = useEditor();
  if (!toast) return <div className="toast-slot" role="status" aria-live="polite" />;
  const Icon = TOAST_ICONS[toast.icon];
  return (
    <div className="toast-slot" role="status" aria-live="polite">
      <div key={toast.id} className={`toast ${toast.icon}${toast.leaving ? " leaving" : ""}`}>
        <Icon />
        <span>{toast.text.split("**").map((part, i) => (i % 2 ? <b key={i}>{part}</b> : part))}</span>
      </div>
    </div>
  );
}
