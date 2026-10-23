<img src="../assets/logo/logo-lowres.png" alt="" width="64">

# Audiodiver (desktop editor)

Tauri 2 + React. The window starts the Python core (`python -m audiodiver serve`, see `../core`) and talks to it over a token-protected localhost API. The interpreter is `AUDIODIVER_PYTHON` if set, else the one named in `core.json` in the app's local data folder (`%LOCALAPPDATA%\com.audiodiver.editor`), else the one a release carries (`core/python` beside the exe, with ffmpeg, vgmstream-cli and wav2wem in `core/tools`), else `python`. `core.json` is for a computer whose `python` doesn't have the core (a venv): `{"python": "…\\venv\\Scripts\\python.exe", "path": ["…\\bin"], "env": {"PYTHONUTF8": "1"}}`, where `path` folders go first on the core's PATH (ffmpeg, vgmstream-cli, wav2wem). The file is per computer, so a copied exe still runs the Python installed on each computer. When the core can't start, the window shows the last error Python printed, such as a missing module.

```
npm install
npm run tauri dev        # the app, with hot reload
npm run tauri build      # src-tauri/target/release/audiodiver.exe + an NSIS installer
```

Updates come from the GitHub releases' `latest.json` (`plugins.updater` in `src-tauri/tauri.conf.json`), and the app
installs one only if its signature matches the public key there.

A release is made by pushing a tag (`v1.2.0`) after the version is the same in `src-tauri/tauri.conf.json`,
`package.json`, `src-tauri/Cargo.toml` and `../core/pyproject.toml`, and `CHANGELOG.md` has a section for it. The
workflow (`../.github/workflows/release.yml`) checks that, runs the core's tests, puts the core together
(`scripts/release.py core`: Python's embeddable package with the core and its packages, and the tools, each pinned and
checked against its SHA-256, in `src-tauri/core`), builds with `--config src-tauri/tauri.release.conf.json` (the core
as resources, and the installer signed for the updater with `TAURI_SIGNING_PRIVATE_KEY` and
`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, GitHub Actions secrets), and makes a draft release with the changelog's section
as its text: the installer, its `.sig`, `latest.json` and the portable ZIP (`scripts/release.py portable`).
Publishing the draft releases it. A build without the release config works as before, without the core or a
signature.

The portable ZIP is the exe with the core beside it and a `portable.txt`. With that file beside it, the exe keeps
everything in a `data` folder there (the core's settings, caches, notes and log, `core.json`, the WebView2 profile and
the window's place) and nothing in AppData, and Update opens the release's page in place of the installer.

Without the shell, the UI also runs in a browser for development: start `python -m audiodiver serve --port 8765 --token dev`, then `npm run dev` and open `http://localhost:1420/?port=8765&token=dev`. File pickers become path prompts there, and dragging files in needs the desktop app.

The master tabs are in the tab bar, along the top of the window by default (Settings ▸ Theme ▸ Tab bar puts it on any side and turns the tabs' names on or off). They come in two sets: Home and Tools, which make projects and mods, then a darker band of the tabs that work on the open project, Project (showing the project's icon and name), Library, Audio Editor (`editor` in the code), Text Editor (`text`) and Build. Updates, the Wiki and Settings are at the far end. Along the top or bottom each main tab shows its name beside its icon; down a side the name shows when the pointer is on the tab, in a label that grows out of the button and holds what the tooltip says. Updates, the Wiki and Settings never show a name. The window's title is the open project's name. The Build tab shows the number of problems, or a dot when the build folder's ZIP isn't the project as it is now (`rebuild` in the project's state), and Updates is highlighted when a new version is available. The version at the end of the status bar opens Updates. The ⓘ next to it, and the one by the logo on Home, open About. The Project tab holds what the mod is (name, description, icon and id) and where its files are (its folder, the files nothing uses, packs). Tools works on existing mods without a project: Repatch and Combine Mods. The Library (Index and All Archives) lists everything in the game, to find, hear and add to a project. The Audio Editor lists what the open project contains, to replace. Both use the same three panes, and each keeps a separate open item, selection and history (`Scope` in `src/store.tsx`).

| File | Role |
|---|---|
| `src/App.tsx` | the window: the tab bar of master tabs (`Rail`: its side and names from the theme, the project's band), status bar (undo, redo, now playing, the version and About), notices and the quick note, drag-and-drop routing, app-wide shortcuts (Ctrl+S saves), the update check at startup |
| `src/nav.ts` | which tab shows and the Library's, Tools' and Settings' sub-tabs (Updates, Wiki and Settings remember the tab they were opened from), whether About is open, and `FOLD_LIBRARY` (a new project starts the Library folded) |
| `src/store.tsx` | the app's state and every action (talks to the core), notices (`notify`) and quick notes (`quick`, `Toast`), recent projects, and the two tabs that browse: what is open and selected in the Library and in the Audio Editor, each in a context of its own |
| `src/Home.tsx` | Home: new, open, recent (each with Show in folder) and open project, About by the logo, the background art (a slow slideshow) and its credit; What's new, when the changelog has an entry |
| `src/Library.tsx`, `src/IndexTree.tsx` | the left panels: the Library's Index and All Archives, and the Audio Editor's list of what the project works on |
| `src/music.ts`, `src/Tags.tsx` | the Index as the app looks things up in it, whose audio an item plays, and tags in a category's colour |
| `src/CueView.tsx`, `src/ItemHead.tsx` | the slots of what is open (a music cue, a bank's sounds in groups that fold, or a transition's or stinger's parts as lines that fold, the open one with its slots under it: `PartHead`), and the slot list's shortcuts. A row is where a slot's original and replacement play and where its file is chosen, replaced (the file name) and removed. In the Audio Editor the + on a sound's line adds new takes or a layer (a new take is its file: its ✕ takes it away) |
| `src/Notes.tsx`, `src/noteStore.ts` | the project's note on a slot (its clip) or, with no slot selected, on the open item, at the foot of the details panel: Add note, an editor with buttons that mark the selected words in Markdown, the note as it reads once written (a click edits it), Delete note (asks when it has words). Saved when the editor loses the focus, one step of Undo |
| `src/Inspector.tsx` | the selected slot's settings: what replaces it (file, or silence and whether it keeps the original duration), where the new audio plays (every sound that plays the clip, or only this one), Make-Up Gain, timing, cue points, where else it plays, a voice line's subtitle (opens it in the Text tab), its note; while nothing is selected, the open item's note and the keys. In the Library, `SlotFacts` says what a slot is |
| `src/Timeline.tsx`, `src/Waveform.tsx` | the waveform dock: original vs replaced on one scale, click to play from a spot, draggable cue points, and where a play-through is in the slot |
| `src/PlayThrough.tsx`, `src/player.ts` | a whole cue played the way the game does, and the one player everything plays through (the now-playing bar leads back to what plays) |
| `src/SliceTool.tsx` | cut one song into pieces and fill a cue, one slot per segment From one slot To another: the song and the originals on one zoomable time scale, the originals played one after another, cuts to drag, add and remove, a table of pieces against their originals |
| `src/Confirm.tsx` | the question before removing new audio (`confirm()`, Enter confirms, Esc keeps), and one with two ways to go ahead (`choose()`: Import a mod's patch adds or replaces) |
| `src/RepatchPage.tsx` | Tools ▸ Repatch: an existing mod (ZIP, folder or `.patch_0`, dropped or picked) rebuilt on the current game, its patches (those without audio counted, kept as they are), name and folder, the outcome in short with Show all and Repatch another mod, and what repatching does; Installed mods, the check that finds mods with older sound banks |
| `src/BuildTab.tsx` | Build: the next version, the Build button and where builds go, build options, the log; a problem the Project tab fixes (name, icon, id) links there |
| `src/ToolsTab.tsx`, `src/CombinePage.tsx` | Tools' two sub-tabs, Repatch (`RepatchPage.tsx`) and Combine Mods: several mods, each with its options, read into one project, their conflicts settled by choosing a mod per sound, and built as one mod on the current game |
| `src/ProjectTab.tsx` | the Project tab: name, description, icon (an image or the default one, with a border and corners) and id as HD2 Arsenal shows them, the icon preview, and the folder (where it is, moving it into a folder, copying files in), the files nothing uses, and the pack |
| `src/ExportDialog.tsx`, `src/exportList.ts` | the Export… dialog (a cue's audio, or a bank's sounds one by one, as WAV, FLAC or MP3), and the export list: things collected from anywhere (right-click ▸ Add to the export list), exported together from the status bar |
| `src/TextTab.tsx` | the Text tab: the game's text in every language (subtitles and every other line), to search and change, with colours, sizes and emphasis, and a preview of how the game shows it. `showLines` opens it on given lines (a voice line's subtitle, or those with its words), in the voice's language; a subtitle lists the voice lines that say it, each opening in the Library |
| `src/TextPreview.tsx` | a line of the game's text as the game shows it (colours, sizes, styles, timing marks, the words the game fills in): the Text tab's preview and the Wiki's `game-text` examples |
| `src/stable.ts` | `useStable`: handlers that keep one identity, for rows memoised with React.memo |
| `src/listWindow.ts` | `useListWindow`: a long list whose lines differ in height (a big bank's slots), drawn only near where it is scrolled to, each line measured once it is drawn |
| `src/Fold.tsx` | sections that grow open and shrink shut (library groups, What's new, the list around a piece of music) |
| `src/SettingsTab.tsx`, `src/settings.ts` | Settings: System (the game's folder, startup, updates: Manual, Prompt on startup or Automatic, tooltips, disk space, layout), Shortcuts, Theme (colours, text and spacing, the tab bar, animations) |
| `src/About.tsx` | About Audiodiver, a dialog over any tab: version, licence and source, log file, Credits |
| `src/dialog.ts` | `useDialog`: what every dialog shares: the newest one open takes Esc, keeps the keyboard inside and takes the focus itself; closing gives the focus back |
| `src/UpdatesTab.tsx`, `src/updates.ts` | Updates: this version against the newest release on GitHub (asked through the core's `releases`), Update now, and every version's changes as a timeline; the question at startup (`UpdatePrompt`). `updates.ts` keeps the state, orders versions as semver does and installs through the shell's updater plugin, or opens the release's page where the shell has none |
| `src/keys.ts` | every keyboard command, its default keys, the user's rebindings, and the one listener that runs them |
| `src/theme.ts` | the theme: colours from the chosen hue, text size, spacing, contrast, animations, and the tab bar's side and names (`data-bar`, `data-labels` on the page) |
| `src/Tooltip.tsx` | the styled tooltips: any element with `data-tip` (see the file for the attributes; `data-tip-more` adds a fainter second line) |
| `src/Wiki.tsx`, `src/wiki/*.md` | the Wiki and its pages (one Markdown file per page; see `src/content.ts` for the header); `Help`, the "?" that holds a description (hover) and opens a Wiki page (click); `WikiLink`, words that open one |
| `src/Markdown.tsx`, `src/content.ts` | Markdown rendering (in-app links, live key names, callouts, `game-text` examples); the bundled pages, changelog and art, `CREDITS` (About), `REPO_URL` and the licence |
| `CHANGELOG.md` | what's new, newest first; Home shows the top entry and Updates lists them all (with the release notes from GitHub). Empty until the first release |
| `src/art/` | the Home background: every image in it, shown in turn (see the README there for size and format) |
| `src/Logo.tsx`, `../assets/logo/` | the logo: the official files, taken straight from `assets/logo` (`@logo` in `vite.config.ts`) and drawn in the highlight colour |
| `src/platform.ts` | dialogs, drag-and-drop, reveal and web links in the desktop app; browser fallbacks |
| `src-tauri/src/lib.rs` | starts and stops the core (with this computer's `core.json`, if any, or the core a release carries), hands its port and token to the UI, or why the core didn't start; the updater plugin; a message box with Microsoft's download page when the WebView2 Runtime is missing; the main window (built in code, `create: false`) and a portable copy's data folder; `tauri-plugin-single-instance` (a second launch, from a double-clicked project or pack, focuses the open window and emits `open-file`) and `launch_file`, which hands over the file the exe was started with, once |
| `src-tauri/tauri.conf.json` | the window and the bundle; `bundle.fileAssociations` registers `.audi` and `.audipack` with Windows (the NSIS installer only, not the portable ZIP) |
| `src-tauri/tauri.release.conf.json` | added to the config for a release: the core (`src-tauri/core`, made by `scripts/release.py core`) as resources, and the installer signed for the updater (its `.sig`) |
| `scripts/release.py` | what a release needs beyond `tauri build`: the version check, the release's text, the core with Python and the tools, the portable ZIP |
| `src-tauri/icons/`, `app-icon.png` | the app's icons, made from the logo: see `../core/tools/import_logo.py` for how to make them again |

Conventions. Tooltips use `data-tip` and never `title=`, so they match the app's style and show the current key. Text that mentions a key gets it from `keyLabel()` in `keys.ts`, so it follows a rebinding.

Writing rules (`core/tests/test_core.py` checks the core's shown data against them):
- The terms are **Original** (the game's audio in a slot), **new audio** (the file that replaces it) and **Replaced** (a slot, item or state that plays new audio). Don't contrast "the game's" with "yours", "Yours" or "my audio". The app avoids a personal tone. Statuses are *Original / Partly replaced / Replaced*, and the Text Editor uses *Original / New text / Changed*.
- People and sources are named only in **About ▸ Credits** (the ⓘ by the version, `CREDITS` in `src/content.ts`). Clip notes, tooltips, the Wiki and the core's data don't name them. A note says what a clip does ("Plays when approaching an outpost.") and never who found it. Other names for a piece are written as *Also called '…'*.
- Name things by what they are, not by what they do. A label is a noun for the thing: *Destination folder* (once "Goes to" and "Save to"), *Scope* (once "Plays in"), *Build options* (once "When building"). A checkbox or a button says what it does (*Patch every bank with the sounds*, *Change…*).
- Every "?" (`Help`) opens its Wiki section (`page="page#heading"`). A new "?" gets a section to land on.
- Everything clickable looks clickable. Buttons have an outline (`.btn.quiet` too), links are underlined.
- Removing new audio asks first (`Confirm.tsx`): a slot's, a group's, or an item's with the new audio in its slots.
- No testing status on screen, such as "not tested" or "experimental, test it in game". State what is known plainly, or leave it out.
- Keep it short. Labels and tooltips say what a thing is or does in a few words. A description that needs a full sentence goes into a "?" (`Help`) or the Wiki, and doesn't sit under every control. No reassurance ("Your work is saved", "Nothing half-written was left behind") and no flavour paragraphs.
- Quick notes (`quick()`) confirm what was just done, in one line ("**X** added to **My Mod**"). Notices (`notify`) are for messages that need reading or a button, such as Undo after an edit that removes audio, Show in folder, and failures.
- Plain sentences. Write each fact once, as a full sentence with a subject and a verb, and end it with a period.
  A colon introduces a list, or a term and its definition in a table. Don't use it to join two clauses, and never
  to restate the first clause in other words.
- No machine-sounding habits. These read as generated text, and the app avoids them in labels, tooltips, notices,
  data notes and the Wiki:
  - correcting something nobody assumed ("by what it is, not by its id", "an update, not a second copy");
  - things that live, know, believe, wait or say so ("where the audio lives", "the Index knows", "the page says
    so"). Use literal verbs: is in, lists, shows, warns;
  - "of its own", "the game's own", and asides like "(a biome, say)";
  - stock phrases repeated from page to page ("as it is now", "the way the game does", "and the like", "in one
    step", "replaces it whole");
  - one-line morals and fragments that close a paragraph ("Music can't.", "One slot, one file."), and "So …"
    paragraphs that repeat the one before;
  - a parenthesis in every sentence, and dropped articles. Short text should still read like normal English.
- Each control has one place. A slot's row plays the original and the replacement, and takes, replaces and removes its file. The waveforms play from where you click. The details panel only holds settings. Don't add a second set of play or file buttons elsewhere.

Readability rules:
- Where the meaning of something isn't immediately clear, add a visual element that gives context before the words are read. Examples are the chain on tags that mean "linked to other places" (`Linked` in `CueView.tsx`), the category icons and the play button's progress ring.
- Avoid friction. The same action is in the same place everywhere, and play buttons always come first on their line (groups, takes, slots, the Index, All Archives).
- Lists that fold have one **Collapse all** button (`CollapseAllIcon`). Don't use an expand/collapse pair or a toggle.
- Keep the app smooth on low-end PCs, and measure with the CPU throttled 4x. Rows of long lists are memoised, read `useLite()` in place of `useEditor()`, and get `useStable` handlers. Off-screen rows are skipped (`content-visibility: auto`, `useRowWindow` for the Archives table, or `useListWindow` for a slot list of more than 150 lines). `useEditor()` reads the open item and the selection from contexts of their own as its fields are read, so a component takes the fields it shows while rendering (`const { cue } = useEditor()`) and is drawn again only when they change. Drags write to the DOM once a frame and tell React on release. Anything that changes on every frame of playback reads `usePlayerLook` (visible changes only), moves by transform, and gets a separate compositing layer.

Fonts are Archivo, Noto Serif and Roboto Mono, from the `@fontsource-variable` packages (SIL Open Font License 1.1). They are loaded in `src/main.tsx`, chosen in Settings ▸ Theme (`src/theme.ts`), and free to ship. The Home pictures are screenshots of Helldivers 2 by the author (`src/art/`, the originals in `internal/art/`), credited in About. The game in them belongs to Arrowhead Game Studios and isn't covered by Audiodiver's licence.
