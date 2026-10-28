import { startTransition, useEffect, useRef, useState } from "react";
import { t, plural } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { AboutButton, AboutDialog } from "./About";
import { ConfirmDialog } from "./Confirm";
import { BuildTab } from "./BuildTab";
import { combineInbox } from "./CombinePage";
import { repatchInbox } from "./RepatchPage";
import { CueView } from "./CueView";
import { Home } from "./Home";
import { ImportModHost } from "./ImportMod";
import { TUTORIALS_PAGE, TutorialLayer, TutorialPrompt } from "./Tutorial";
import { AudioIcon, BellIcon, BuildIcon, CheckIcon, CopyIcon, GearIcon, GuideIcon, HistoryIcon, HomeIcon, InfoIcon, LibraryIcon, PlayMarkIcon, PlusIcon,
  ProjectIcon, RedoIcon, SaveIcon, SoundtrackIcon, TextIcon, ToolsIcon, UndoIcon, UpdatesIcon } from "./Icons";
import { noticeLog, useNoticeLog } from "./noticeLog";
import { Inspector } from "./Inspector";
import { LibraryPanel, ProjectPanel } from "./Library";
import { Logo } from "./Logo";
import { ProjectTab } from "./ProjectTab";
import { tabArrows } from "./Page";
import { SettingsTab } from "./SettingsTab";
import { openInSoundtrack, soundtrackDrop, SoundtrackPanes } from "./Soundtrack";
import { TextTab } from "./TextTab";
import { ToolsTab } from "./ToolsTab";
import { ScaleTipLayer, TooltipLayer } from "./Tooltip";
import { UpdatePrompt, UpdatesTab } from "./UpdatesTab";
import { updates, useUpdates } from "./updates";
import { Wiki } from "./Wiki";
import { call, fmtTime, iconUrl, intlLocale, type Job } from "./api";
import { APP_NAME, UTILS } from "./edition";
import { APP_LABEL, APP_VERSION, versionLabel } from "./content";
import { JOB_NAMES } from "./jobs";
import { keyLabel, useCommands, useKeymap, type CommandId } from "./keys";
import { counted } from "./music";
import { HIDEABLE, nav, useNav, type Hideable, type Tab } from "./nav";
import { expandDropped, isImage, isTauri, onFileDrop, setTitle } from "./platform";
import { player, usePlayer } from "./player";
import { Splitter } from "./Resize";
import { RESET_LAYOUT, useSettings } from "./settings";
import { barIsVertical, useThemeValue, type BarSide } from "./theme";
import { EDIT_NAMES, Scope, useEditor, useShownTabs, type ScopeName, type ToastIcon } from "./store";
import { rangeVars } from "./range";

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
        <h1>{APP_NAME}</h1>
        {stage === "failed" ? (
          <>
            <p className="warn-box">{picked ?? error}</p>
            {/* a folder that was just refused says where to look itself */}
            {!picked && <p className="muted"><Trans>Choose the Helldivers 2 install folder,
              usually <code>…\steamapps\common\Helldivers 2</code>. Audiodiver only reads from it.</Trans></p>}
            <div className="row-btns">
              <button className="btn primary" onClick={() => choose()}><Trans>Choose the Game Folder</Trans></button>
              {where?.chosen && <button className="btn quiet" onClick={() => choose(null)} data-tip={t`Forget the chosen folder`}><Trans>Find It Through Steam Again</Trans></button>}
            </div>
          </>
        ) : error && !stage ? (
          <p className="warn-box">{error}</p>
        ) : (
          <>
            <p className="loading">{stage && stage !== "starting" ? stage : t`Starting…`}</p>
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

/** What closing the window stops while one job runs, in a sentence for each kind of job. */
const STILL_RUNNING: Record<string, string> = {
  build: t`A build is still running.`, import: t`An import is still running.`, export: t`An export is still running.`,
  repatch: t`A repatch is still running.`,
  pack: t({ message: "A pack is still running.", comment: "Packing the project and the files it uses into one .audipack file" }),
  unpack: t`An unpack is still running.`,
  check: t({ message: "A check is still running.", comment: "Checking the installed mods for sound banks of an older game version" }),
  combine_read: t`A conflict check is still running.`, combine: t`A combine is still running.`,
};

/** The window: the master tabs along the top, the tab that shows, and the status bar. The Library and the Editor
    stay in place behind the other tabs, so coming back finds them as they were left (scroll position, search,
    selection). */
function Shell() {
  const { actions, quick, notify, itemIndex, jobs, scopes, project } = useEditor();
  const { tab } = useNav();
  // the tabs that can be hidden: the open project's choice, else Settings' (a hidden tab that shows moves away)
  const shown = useShownTabs();
  useEffect(() => { if (!UTILS) nav.setShown(shown); }, [shown]);
  // the Soundtrack is drawn when first shown, and stays as it was left
  const [soundtrackSeen, setSoundtrackSeen] = useState(false);
  useEffect(() => { if (tab === "soundtrack") setSoundtrackSeen(true); }, [tab]);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  // the Text tab stays as it was left (search, filter, the open line) once it has been opened
  const [textSeen, setTextSeen] = useState(false);
  useEffect(() => { if (tab === "text") setTextSeen(true); }, [tab]);
  // the Library and the Audio tab are drawn when first shown, or when the start is over, in a render a click can
  // interrupt: drawing the hidden one at the start too cost a slow PC most of a second before the window answered
  const [drawn, setDrawn] = useState<ReadonlySet<Tab>>(() => new Set([tab]));
  useEffect(() => { if (!drawn.has(tab)) setDrawn((d) => new Set([...d, tab])); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (UTILS) return; // it has neither
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
      const r = await updates.install(false, () => notify("info", t`Updating to ${label}. Audiodiver restarts when the update is installed.`));
      if (r === "page") setPrompt(true); // this version can't install it: ask instead
      else if (r === "failed") {
        const why = updates.get().installError ?? "";
        notify("bad", t`${label} didn't install: ${why}`, { label: t`Updates`, run: () => nav.go("updates") }, true);
      }
    });
    return () => { live = false; };
  }, [notify]);

  // what a drop does depends on what was dropped and where it lands
  handler.current = async (raw, target) => {
    // mods to combine: anything on the Combine Mods page
    if (target?.kind === "combine") return combineInbox.offer(raw);
    // Audiodiver Utils takes no projects: whatever else is dropped is a mod to repatch
    if (UTILS) { nav.go("tools", "repatch"); return repatchInbox.offer(raw[0]); }
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
    if (target?.kind === "icon") return images.length ? actions.setIcon(images[0]) : quick(t`Drop an image here to make it the icon`, "info");
    if (!audio.length) return quick(images.length ? t`Drop images on the icon on the Project tab` : t`No audio files in the drop`, "info");
    // the Soundtrack's places: a place of a playlist, or One song
    if (target?.kind === "place" || target?.kind === "song") return soundtrackDrop(target, audio);
    // the Audio tab's: a slot, a group of takes, a cue, a piece of music
    if (target?.kind === "slot") { scopes.editor.setSelected([target.source]); return actions.assign(target.source, audio); }
    if (target?.kind === "sources") return actions.fillSources(target.sources, audio, target.what);
    if (target?.kind === "cue") return actions.fill(target.cue, audio);
    if (target?.kind === "item") {
      const it = itemIndex.items.get(target.item);
      if (it) {
        const count = it.parts.length, name = it.full;
        return actions.fillSources(counted(it), audio, plural(count, { one: `the # part of ${name}`, other: `the # parts of ${name}` }));
      }
    }
    const here = nav.get().tab;
    quick(!project && (here === "editor" || here === "soundtrack") ? t`Open a project first`
      : here === "editor" ? t`Drop audio on a slot, a group of takes, a piece in the list or a title`
      : here === "soundtrack" ? t`Drop songs on a place of a playlist, or a song on One Song`
      : here === "library" ? t`Add it to the project, then drop audio on the slots in the Audio tab`
      : t`Drop audio on a slot in the Audio tab`, "info");
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
    const block = (ev: DragEvent) => { ev.preventDefault(); if (ev.type === "drop" && !isTauri()) quick(t`Dropping files needs the desktop app`, "info"); };
    window.addEventListener("dragover", block); window.addEventListener("drop", block);
    return () => { gone = true; off(); window.removeEventListener("dragover", block); window.removeEventListener("drop", block); };
  }, [quick]);

  // closing the window saves what autosave on a timer keeps waiting, and asks first while a build or export runs:
  // closing stops the core, and the job with it
  const running = useRef<string[]>([]);
  running.current = Object.values(jobs).filter((j) => j.state === "running").map((j) => j.kind);
  const unsaved = useRef(false);
  unsaved.current = !!project?.unsaved;
  useEffect(() => {
    if (!isTauri()) return;
    let off = () => {};
    let gone = false;
    (async () => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const w = getCurrentWindow();
      const stop = await w.onCloseRequested(async (ev) => {
        if (unsaved.current) {
          try { await call("project_save"); } catch (e: any) {
            ev.preventDefault();
            const { ask } = await import("@tauri-apps/plugin-dialog");
            const why = e?.message ?? e;
            if (await ask(t`The project couldn't be saved. ${why}`, { title: APP_NAME, kind: "warning", okLabel: t`Close Anyway`, cancelLabel: t`Keep Working` })) {
              await w.destroy();
            }
            return;
          }
        }
        if (!running.current.length) return;
        ev.preventDefault();
        const { ask } = await import("@tauri-apps/plugin-dialog");
        const what = running.current.length > 1 ? t`Some jobs are still running.` : STILL_RUNNING[running.current[0]] ?? t`A job is still running.`;
        const stops = running.current.length > 1 ? t`Closing ${APP_NAME} stops them.` : t`Closing ${APP_NAME} stops it.`;
        if (await ask(`${what} ${stops}`, { title: APP_NAME, kind: "warning", okLabel: t`Close Anyway`, cancelLabel: t`Keep Working` })) {
          await w.destroy();
        }
      });
      if (gone) stop(); else off = stop;
    })();
    return () => { gone = true; off(); };
  }, []);

  // what the keyboard does anywhere in the app (keys.ts has the keys; the slot lists add their own in CueView)
  useCommands(UTILS ? UTILS_COMMANDS : {
    save: () => { actions.save(); },
    undo: () => { actions.undo(); },
    redo: () => { actions.redo(); },
    build: () => { actions.build(); },
    newProject: () => { actions.newProject(); },
    openProject: () => { actions.openProject(); },
    closeProject: () => { actions.closeProject(); },
    search: () => { // the search box of the tab that shows (the Soundtrack, the Text tab, Settings ▸ Shortcuts, the
      // Library's and the Audio tab's lists; the Wiki has its own find bar); from a tab without one, the Library's
      const own = { soundtrack: ".st-panes:not([hidden]) .lib-search input", text: ".text-tab:not([hidden]) .lib-search input[type=search]",
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
    // a hidden tab's key does nothing, and goes on to whatever else takes it
    tabEditor: () => (nav.shown("editor") ? nav.go("editor") : false),
    tabSoundtrack: () => (nav.shown("soundtrack") ? nav.go("soundtrack") : false),
    tabText: () => (nav.shown("text") ? nav.go("text") : false),
    tabBuild: () => (nav.shown("build") ? nav.go("build") : false),
    tabTools: () => nav.go("tools"),
    updates: () => nav.toggle("updates"),
    wiki: () => nav.toggle("wiki"),
    tutorials: () => nav.go("wiki", TUTORIALS_PAGE),
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
          // the Soundtrack works in the Audio tab's context (its project, its player places)
          if (tab !== scope && !drawn.has(scope) && (lib || tab !== "soundtrack")) return null;
          return (
            <Scope key={scope} name={scope}>
              <div className={`panes${lib ? " two lib-split" : ""}`} hidden={tab !== scope}
                style={lib ? { ["--split" as any]: String(widths.libSplit) } : { ["--left" as any]: `${widths.left}px`, ["--right" as any]: `${widths.right}px` }}>
                {lib ? <LibraryPanel /> : <ProjectPanel />}
                {lib ? <Splitter fraction width={widths.libSplit} onResize={(f) => setWidths((v) => ({ ...v, libSplit: f }))} initial={WIDTHS.libSplit}
                    panel="left" cssVar="--split" label={t`Resize the list`} />
                  : <Splitter width={widths.left} onResize={(w) => setWidths((v) => ({ ...v, left: w }))} initial={WIDTHS.left} panel="left" label={t`Resize the list`} />}
                <main className="center"><CueView /></main>
                {!lib && <Splitter width={widths.right} onResize={(w) => setWidths((v) => ({ ...v, right: w }))} initial={WIDTHS.right} panel="right" label={t`Resize the details panel`} />}
                {!lib && <Inspector />}
              </div>
              {!lib && (soundtrackSeen || tab === "soundtrack") && <SoundtrackPanes hidden={tab !== "soundtrack"} />}
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
      <ImportModHost />
      <TutorialLayer />
      <ConfirmDialog />
      {prompt && <UpdatePrompt onClose={() => setPrompt(false)} />}
      <TutorialPrompt blocked={prompt} />
      <TooltipLayer />
      <ScaleTipLayer />
    </div>
  );
}

/** What the keyboard does in Audiodiver Utils: no projects, so only playback, the Tools and the tabs at the end. */
const UTILS_COMMANDS: Parameters<typeof useCommands>[0] = {
  playPause: (e) => {
    if ((e.key === " " || e.key === "Enter") && (e.target as Element).closest?.("button, a, summary, [role=slider]")) return false;
    return player.toggle();
  },
  stop: () => { if (!player.state.key) return false; player.stop(); },
  selectAll: (e) => ((e.target as Element).closest?.("input, textarea, [contenteditable=true]") ? false : undefined),
  // Search: only the Wiki has something to search here, and the find bar there takes the key
  tabTools: () => nav.go("tools"),
  updates: () => nav.toggle("updates"),
  wiki: () => nav.toggle("wiki"),
  settings: () => nav.toggle("settings"),
};

type MainTab = { id: Tab; name: string; about: string; cmd: CommandId; Icon: () => React.JSX.Element };
/** Home and Tools make projects; the rest work on the open one, in the order a mod is made. */
const APP_TABS: MainTab[] = [
  { id: "home", name: t`Home`, about: t`new and recent projects`, cmd: "tabHome", Icon: HomeIcon },
  { id: "tools", name: t`Tools`, about: t`repatch and combine existing mods`, cmd: "tabTools", Icon: ToolsIcon },
];
const UTILS_TABS: MainTab[] = [APP_TABS[1]]; // Audiodiver Utils starts on Tools and has no Home
const MOD_TABS: MainTab[] = [
  { id: "project", name: t`Project`, about: t`name, icon and files`, cmd: "tabProject", Icon: ProjectIcon },
  { id: "library", name: t`Library`, about: t`all game audio, to find, hear and add to the project`, cmd: "tabLibrary", Icon: LibraryIcon },
  { id: "editor", name: t({ message: "Audio", comment: "Main tab: replaces the audio of what the project lists" }), about: t`replace the audio of what the project lists`, cmd: "tabEditor", Icon: AudioIcon },
  { id: "soundtrack", name: t`Soundtrack`, about: t`how each piece of music plays`, cmd: "tabSoundtrack", Icon: SoundtrackIcon },
  { id: "text", name: t({ message: "Text", comment: "Main tab: subtitles and all other game text" }), about: t`subtitles and all other game text`, cmd: "tabText", Icon: TextIcon },
];
const BUILD_TAB: MainTab = { id: "build", name: t({ message: "Build", context: "Main tab", comment: "The tab that builds the mod ZIP" }),
  about: t`the mod ZIP, to install with a mod manager`, cmd: "tabBuild", Icon: BuildIcon };
/** Why the Build tab carries a dot: the ZIP in the build folder isn't the project as it is now. */
const REBUILD = { new: t`not built yet`, changed: t`changed since the last build`, game: t`the game updated since the last build` };

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
    the project's own icon; then Build, outside the band like Home and Tools and only while a project is open (a dot
    when the build folder's ZIP isn't the project as it is now, a count when problems stop the build). Updates, the
    Wiki and Settings are at the far end (Updates lights up when a new version is out). With names on, a top or
    bottom bar shows each main tab's name beside its icon, and a side bar shows it when the pointer is on the tab, in
    a label that grows out of the button and holds what the tooltip says. Updates, the Wiki and Settings never show a
    name. The open tab takes the colour of the page beside it and covers the bar's edge, so it reads as holding that
    page. The open project's name is the window's title. */
function Rail() {
  const { project } = useEditor();
  const { tab } = useNav();
  const shown = useShownTabs();
  const u = useUpdates();
  const th = { bar: useThemeValue((x) => x.bar), labels: useThemeValue((x) => x.labels) }; // not every colour change
  const { tips } = useSettings();
  useKeymap(); // the keys in the side bar's labels follow a rebinding
  const problems = project?.problems.length ?? 0;
  const name = project?.name;
  useEffect(() => { setTitle(name && !UTILS ? `${name} · Audiodiver` : APP_NAME); }, [name]);
  const iconSig = project ? iconKey([project.path, project.icon]) : ""; // many projects have an "icon.png": the path tells them apart
  const [broken, setBroken] = useState(""); // the icon that didn't load: the Project tab's own icon stands in
  const vertical = barIsVertical(th.bar);
  const tabButton = (id: Tab, label: string, tip: string, cmd: CommandId, icon: React.ReactNode, go: () => void,
    badge?: number, lit?: boolean | "dot", shown?: { name: string; about: string }, cls = "") => {
    const named = !!shown && th.labels && !vertical; // the name beside the icon
    const flyout = !!shown && th.labels && vertical;  // the name in a label on hover, with the tooltip's words in it
    return (
      <button key={id} role="tab" aria-selected={tab === id} aria-label={label}
        className={`tab${tab === id ? " on" : ""}${lit === true ? " lit" : ""}${named ? " named" : ""}${cls}`} onClick={go}
        data-tip={flyout ? undefined : named ? upper(shown!.about) : tip} data-tip-cmd={cmd} data-tip-side={TIP_SIDE[th.bar]}>
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
    let label = name, icon = <Icon />, badge = 0, dot = false, cls = "";
    if (id === "project" && project) { // the project's own icon
      [label, cls] = [`${name}, ${project.name}`, " tab-mod"];
      if (broken !== iconSig)
        icon = <img className="tab-mod-icon" src={iconUrl(iconSig)} alt="" draggable={false} onError={() => setBroken(iconSig)} />;
    }
    if (id === "build" && problems) {
      const stop = plural(problems, { one: "# problem", other: "# problems" });
      [label, about, badge] = [`${name}, ${stop}`, plural(problems, { one: "# problem to fix", other: "# problems to fix" }), problems];
    } else if (id === "build" && project?.rebuild) {
      [label, about, dot] = [`${name}, ${REBUILD[project.rebuild]}`, REBUILD[project.rebuild], true];
    }
    return tabButton(id, label, `${name}: ${about}`, cmd, icon, () => nav.go(id), badge, dot && "dot", { name, about }, cls);
  };
  const latest = u.latest ? versionLabel(u.latest.version) : "";
  const update = latest ? t`${latest} is available` : "";
  const orientation = vertical ? "vertical" : "horizontal";
  return (
    <nav className="rail" aria-label={t({ message: "Main", comment: "The bar of main tabs, for screen readers" })}>
      <div className="rail-group" role="tablist" aria-orientation={orientation} aria-label={t`Tabs`} onKeyDown={tabArrows}>
        <div className="rail-set">{(UTILS ? UTILS_TABS : APP_TABS).map(mainTab)}</div>
        {!UTILS && <div className={`rail-set rail-mod${project ? "" : " idle"}`}>
          {MOD_TABS.filter((t) => !(HIDEABLE as readonly Tab[]).includes(t.id) || shown.includes(t.id as Hideable)).map(mainTab)}</div>}
        {!UTILS && project && <div className="rail-set rail-out">{mainTab(BUILD_TAB)}</div>}
      </div>
      <div className="rail-group" role="tablist" aria-orientation={orientation}
        aria-label={t({ message: "More", comment: "The tabs at the end of the bar (Updates, Wiki and Settings), for screen readers" })} onKeyDown={tabArrows}>
        {tabButton("updates", update ? t`Updates, ${update}` : t`Updates`, update ? t`Updates: ${update}` : t`Updates: new versions and changelogs`,
          "updates", <UpdatesIcon />, () => nav.toggle("updates"), 0, !!update)}
        {tabButton("wiki", t`Wiki`, t`Wiki: guides`, "wiki", <GuideIcon />, () => nav.toggle("wiki"))}
        {tabButton("settings", t`Settings`, t`Settings`, "settings", <GearIcon />, () => nav.toggle("settings"))}
      </div>
    </nav>
  );
}

/** Along the bottom: undo and redo with the History list, what the core is doing or where the project is saved,
    what plays, the version (it leads to Updates, and carries a dot when a new one is out) with About beside it, and
    in the corner the notifications shown so far. The export list is on the toolbars, beside Export. */
function StatusBar() {
  const { status, jobs, project, actions } = useEditor();
  const u = useUpdates();
  const { autosave } = useSettings();
  const [pop, setPop] = useState<"history" | "notifications" | null>(null);
  const toggle = (which: "history" | "notifications") => setPop((p) => (p === which ? null : which));
  const running = Object.values(jobs).filter((j) => j.state === "running");
  const core = status?.version && status.version !== APP_VERSION ? versionLabel(status.version) : "";
  const latest = u.latest ? versionLabel(u.latest.version) : "";
  const save = keyLabel("save");
  const saved = !project ? "" : project.unsaved ? t`Unsaved changes` : autosave ? t`Saved` : t`Autosaved`;
  const savedTip = !autosave ? t`Every change is saved to the project file as it is made`
    : save ? plural(autosave, { one: `Saved every # minute. ${save} saves now`, other: `Saved every # minutes. ${save} saves now` })
    : plural(autosave, { one: "Saved every # minute", other: "Saved every # minutes" });
  const changes = (project?.history?.length ?? 0) + (project?.future?.length ?? 0);
  const undoName = EDIT_NAMES[project?.undo_label ?? ""], redoName = EDIT_NAMES[project?.redo_label ?? ""];
  return (
    <footer className="statusbar">
      {!UTILS && <div className="sb-undo">
        <button className="sb-btn" onClick={actions.undo} disabled={!project?.can_undo} aria-label={t`Undo`} data-tip-cmd="undo"
          data-tip={project?.can_undo ? (undoName ? t`Undo ${undoName}` : t`Undo the last change`) : t`Nothing to undo`}><UndoIcon /></button>
        <button className="sb-btn" onClick={actions.redo} disabled={!project?.can_redo} aria-label={t`Redo`} data-tip-cmd="redo"
          data-tip={project?.can_redo ? (redoName ? t`Redo ${redoName}` : t`Redo the change`) : t`Nothing to redo`}><RedoIcon /></button>
        <button className={`sb-btn${pop === "history" ? " on" : ""}`} data-pop="history" onClick={() => toggle("history")} disabled={!project}
          aria-label={t`History`} aria-expanded={pop === "history"} data-tip={changes ? t`History` : t`History: no changes yet`}
          data-tip-more={t`The changes made since the project opened, to go back or forward to`}><HistoryIcon /></button>
      </div>}
      {pop === "history" && project && <StatusPop side="left" label={t`History`} onClose={() => setPop(null)}><HistoryList /></StatusPop>}
      {running.length ? (
        <span className="busy sb-main">{JOB_NAMES[running[0].kind]?.[1] ?? t`Working`}{running[0].total ? ` ${Math.round((running[0].done / running[0].total) * 100)}%` : ""}: {running[0].doing || running[0].log[running[0].log.length - 1] || t({ message: "starting", comment: "A job in the status bar, before it says what it is on" })}</span>
      ) : (
        <span className="sb-main" data-tip={project ? savedTip : undefined}
          data-tip-more={project?.path}>{project ? `${saved} · ${project.path}` : UTILS ? "" : t`No project open`}</span>
      )}
      <span className="spacer" />
      <NowPlaying />
      <span className="sb-version">
        <button className={`sb-ver${u.latest ? " lit" : ""}`} onClick={() => nav.go("updates")} aria-label={u.latest ? t`${APP_LABEL}: a new version is available` : undefined}
          data-tip={u.latest ? t`${latest} is available`
            : core ? t({ message: `${APP_NAME} ${APP_LABEL}, core ${core}`, comment: "The app name and version, then the version of the Audiodiver core, the program behind the window" })
            : `${APP_NAME} ${APP_LABEL}`} data-tip-more={t`Updates and changelogs`}>
          {APP_LABEL}{u.latest && <span className="sb-dot" aria-hidden />}</button>
        <AboutButton />
        {/* drawn as the ⓘ beside it, the same size and spacing */}
        <button className={`about-btn sb-bell${pop === "notifications" ? " on" : ""}`} data-pop="notifications" onClick={() => toggle("notifications")}
          aria-label={t`Notifications`} aria-expanded={pop === "notifications"} data-tip={t`Notifications`} data-tip-more={t`The notifications shown so far, to read again`}><BellIcon /></button>
      </span>
      {pop === "notifications" && <StatusPop side="right" label={t`Notifications`} onClose={() => setPop(null)}><NotificationList /></StatusPop>}
    </footer>
  );
}

/** A panel over the status bar, by the button that opened it (History, Notifications). Esc, a click outside it or
    the button again closes it. It sits outside the bar's box (fixed), which clips what overflows. */
function StatusPop({ side, label, onClose, children }: { side: "left" | "right"; label: string; onClose: () => void; children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const [bottom, setBottom] = useState(0);
  useEffect(() => {
    const place = () => setBottom(window.innerHeight - (document.querySelector(".statusbar")?.getBoundingClientRect().top ?? window.innerHeight));
    place();
    const away = (e: PointerEvent) => {
      const t = e.target as Element;
      if (!box.current?.contains(t) && !t.closest?.("[data-pop]")) close.current(); // its button toggles it itself
    };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); close.current(); } };
    window.addEventListener("resize", place);
    document.addEventListener("pointerdown", away, true);
    window.addEventListener("keydown", key, true);
    box.current?.focus();
    return () => { window.removeEventListener("resize", place); document.removeEventListener("pointerdown", away, true); window.removeEventListener("keydown", key, true); };
  }, []);
  return <div className={`sb-pop ${side}`} style={{ bottom }} role="dialog" aria-label={label} ref={box} tabIndex={-1}>{children}</div>;
}

/** The History list: the project as it was before the changes kept, each change since (oldest first) and those
    undone (greyed, last). A click goes there: the changes after it are undone, or those up to it redone, at once. */
function HistoryList() {
  const { project, actions } = useEditor();
  const done = project?.history ?? [], future = project?.future ?? [];
  const count = done.length;
  const now = useRef<HTMLButtonElement>(null);
  useEffect(() => { now.current?.scrollIntoView({ block: "nearest" }); }, []);
  const name = (label: string) => { const w = EDIT_NAMES[label] ?? label; return w.charAt(0).toUpperCase() + w.slice(1); };
  const row = (key: string, text: string, steps: number, cls: string, tip?: string) => (
    <li key={key}>
      <button className={`hist-row${cls}`} ref={!steps ? now : undefined} onClick={() => actions.historyGo(steps)} aria-current={!steps ? "step" : undefined}
        data-tip={tip} data-tip-side="right">{text}</button>
    </li>
  );
  return (
    <>
      <div className="sb-pop-head"><h2><Trans>History</Trans></h2></div>
      <ol className="hist-list">
        {row("start", done.length >= 200 ? t`Before the oldest change kept` : t`As opened`, -done.length, done.length ? "" : " now",
          count ? plural(count, { 1: "Undo the change", other: "Undo all # changes" }) : undefined)}
        {done.map((l, i) => {
          const after = done.length - 1 - i;
          return row(`d${i}`, name(l), i + 1 - done.length, i === done.length - 1 ? " now" : "",
            i < done.length - 1 ? plural(after, { 1: "Undo the change after this one", other: "Undo the # changes after this one" }) : undefined);
        })}
        {future.map((l, j) => {
          const upTo = j + 1;
          return row(`f${j}`, name(l), j + 1, " undone", plural(upTo, { 1: "Redo this change", other: "Redo the # changes up to this one" }));
        })}
      </ol>
      {!done.length && !future.length && <p className="sb-pop-empty"><Trans>No changes since the project opened.</Trans></p>}
    </>
  );
}

/** The notifications shown so far (noticeLog.ts), newest first, to read again. It never shows anything by itself. */
function NotificationList() {
  const log = useNoticeLog();
  const today = new Date().toDateString();
  const when = (at: number) => {
    const d = new Date(at), time = d.toLocaleTimeString(intlLocale(), { hour: "2-digit", minute: "2-digit" });
    return d.toDateString() === today ? time : `${d.toLocaleDateString(intlLocale(), { month: "short", day: "numeric" })} ${time}`;
  };
  return (
    <>
      <div className="sb-pop-head">
        <h2><Trans>Notifications</Trans></h2>
        {log.length > 0 && <button className="link-text" onClick={noticeLog.clear}><Trans>Clear</Trans></button>}
      </div>
      {log.length ? (
        <ol className="note-log">
          {[...log].reverse().map((n) => (
            <li key={n.id} className={`note-row ${n.tone}`}>
              <span className="note-time">{when(n.at)}</span>
              <NoticeText text={n.text} />
            </li>
          ))}
        </ol>
      ) : <p className="sb-pop-empty"><Trans>Notifications show here once the app has shown them.</Trans></p>}
    </>
  );
}

/** What plays, wherever it was started from: pause, stop, position, and the preview volume. Its name leads to it:
    the tab, the item and the slot it was started from (in the Soundtrack, the piece, its part and the segment). */
function NowPlaying() {
  const p = usePlayer();
  const { goTo, quick, itemIndex } = useEditor();
  const label = p.label, volume = Math.round(p.volume * 100);
  const shown = label || t({ message: "Preview", comment: "What plays, in the status bar, when it has no name" });
  const show = async () => {
    const at = p.at;
    if (!at) return;
    if (at.scope === "soundtrack") {
      const it = at.itemId ? itemIndex.items.get(at.itemId) : undefined;
      if (it && at.cueId) openInSoundtrack(it, at.cueId, at.source);
      else quick(t`That music no longer exists`, "info");
      return;
    }
    if (!(await goTo({ ...at, scope: at.scope }))) quick(t`That item no longer exists`, "info");
  };
  // a preview that fails (a file gone, audio the core can't read) says so: the button alone just went back to ▶
  useEffect(() => { if (p.error) quick(label ? t`Can't play ${label}` : t`Can't play this audio`, "info"); }, [p.error, label, quick]);
  return (
    <span className="np">
      {p.key && (
        <>
          <button className="np-btn" onClick={() => player.toggle()} aria-label={p.playing ? t`Pause` : t`Play`} data-tip={p.playing ? t`Pause` : t`Play`} data-tip-cmd="playPause">{p.playing ? "❚❚" : "▶"}</button>
          {p.at ? <button className="np-label go" onClick={show} data-tip={label ? t`Go to ${label}` : t`Go to it`}>{shown}</button>
            : <span className="np-label" data-tip={p.label} data-tip-clip>{shown}</span>}
          <span className="np-time">{fmtTime(p.time * 1000)}{p.duration ? ` / ${fmtTime(p.duration * 1000)}` : ""}</span>
          <button className="np-btn" onClick={() => player.stop()} aria-label={t`Stop`} data-tip={t`Stop`} data-tip-cmd="stop">■</button>
        </>
      )}
      <label className="np-vol" data-tip={t`Preview volume: ${volume}% (not part of the mod)`}>
        <span aria-hidden><Trans comment="Short for volume, beside the preview volume slider">Vol</Trans></span>
        <input type="range" className="r-volume" style={rangeVars(p.volume, 0, 1)} min={0} max={1} step={0.05} value={p.volume} aria-label={t`Preview volume`} data-scale-tip
          onChange={(e) => player.setVolume(Number(e.target.value))} />
      </label>
    </span>
  );
}

/** A running job's heading: what it does and, when the core names one, what on ("Exporting Loadout Music"), in a
    sentence for each kind of job. */
const jobHeading = (kind: string, title: string) => (!title ? JOB_NAMES[kind]?.[1] ?? t`Working` : ({
  build: t`Building ${title}`, import: t`Importing ${title}`, export: t`Exporting ${title}`, repatch: t`Repatching ${title}`,
  pack: t({ message: `Packing ${title}`, comment: "Packing the project and the files it uses into one .audipack file" }),
  unpack: t`Unpacking ${title}`, check: t`Checking ${title}`, combine_read: t`Checking for conflicts ${title}`, combine: t`Combining ${title}`,
} as Record<string, string>)[kind] ?? t`Working`);

/** A running job, shown until it ends: what it is on, how far along, and a way to stop it. */
function JobCard({ job }: { job: Job }) {
  const { actions } = useEditor();
  const [stopping, setStopping] = useState(false);
  const name = jobHeading(job.kind, job.title);
  const fraction = job.total ? Math.min(1, job.done / job.total) : null;
  return (
    <div className="notice job" role="status">
      <div className="job-body">
        <div className="job-head">
          <b>{name}</b>
          <span>{[fraction !== null && `${Math.round(fraction * 100)}%`, `${Math.round(job.seconds)} s`].filter(Boolean).join(" · ")}</span>
        </div>
        <div className={`job-bar${fraction === null ? " unknown" : ""}`} role="progressbar" aria-valuemin={0} aria-valuemax={100}
          aria-valuenow={fraction !== null ? Math.round(fraction * 100) : undefined}>
          <div style={fraction !== null ? { width: `${fraction * 100}%` } : undefined} />
        </div>
        <div className="job-doing">{stopping ? t`Stopping…` : job.doing || job.log[job.log.length - 1] || t`Starting…`}</div>
      </div>
      {(job.kind === "export" || job.kind === "build") && (
        <button className="btn quiet" disabled={stopping} onClick={() => { setStopping(true); actions.cancelJob(job.id); }}><Trans>Cancel</Trans></button>
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
        {notices.map((n) => n.open ? (
          // an announcement: in the primary colour, and a click anywhere on it follows it
          <div key={n.id} className={`notice lead${n.leaving ? " leaving" : ""}`} role="button" tabIndex={0} aria-label={`${n.title}. ${n.text}`}
            onClick={() => { n.open!(); dismiss(n.id); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); n.open!(); dismiss(n.id); } }}>
            <span className="notice-mark" aria-hidden><PlayMarkIcon /></span>
            <div className="notice-text"><b className="notice-title">{n.title}</b>{n.text}{n.hint && <small className="notice-hint">{n.hint}</small>}</div>
            <button className="x" onClick={(e) => { e.stopPropagation(); dismiss(n.id); }} aria-label={t`Dismiss`}>✕</button>
          </div>
        ) : (
          <div key={n.id} className={`notice ${n.tone}${n.leaving ? " leaving" : ""}`}>
            <NoticeText text={n.text} />
            {n.action && <button className="btn quiet" onClick={() => { n.action!.run(); dismiss(n.id); }}>{n.action.label}</button>}
            <button className="x" onClick={() => dismiss(n.id)} aria-label={t`Dismiss`}>✕</button>
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
