<img src="../assets/logo/logo-lowres.png" alt="" width="64">

# Audiodiver (desktop editor)

Tauri 2 + React. The window starts the Python core (`python -m audiodiver serve`, see `../core`) and talks to it over a token-protected localhost API. The interpreter is `AUDIODIVER_PYTHON` if set, else the one named in `core.json` in the app's local data folder (`%LOCALAPPDATA%\com.audiodiver.editor`), else `python`. `core.json` is for a computer whose `python` doesn't have the core (a venv): `{"python": "…\\venv\\Scripts\\python.exe", "path": ["…\\bin"], "env": {"PYTHONUTF8": "1"}}`, where `path` folders go first on the core's PATH (ffmpeg, vgmstream-cli, wav2wem). It stays on its computer, so a copied exe still runs each computer's own Python. When the core can't start, the window shows Python's own last words (a missing module, say).

```
npm install
npm run tauri dev        # the app, with hot reload
npm run tauri build      # src-tauri/target/release/audiodiver.exe + an NSIS installer
```

Without the shell, the UI also runs in a browser for development: start `python -m audiodiver serve --port 8765 --token dev`, then `npm run dev` and open `http://localhost:1420/?port=8765&token=dev`. File pickers become path prompts there, and dragging files in needs the desktop app.

The window has master tabs, icons down the left (the rail; names in the tooltips): Home, Library, Audio Editor (`editor` in the code), Text Editor (`text`) and Build, with Updates, the Wiki and Settings at the bottom. The open project's name is the window's title, the Build tab carries the count of problems, and Updates lights up when a new version is out. The version at the end of the status bar opens Updates; the ⓘ beside it (and the one by the logo on Home) opens About. The Library (Index and All Archives) is everything the game has, to find, hear and add to a project; the Audio Editor is what the open project lists, to replace. Both are the same three panes, each with its own open place, selection and history (`Scope` in `src/store.tsx`).

| File | Role |
|---|---|
| `src/App.tsx` | the window: the rail of master tabs, status bar (undo, redo, now playing, the version and About), notices and the quick note, drag-and-drop routing, app-wide shortcuts (Ctrl+S saves), the update check at startup |
| `src/nav.ts` | which tab shows (Updates, Wiki and Settings remember the tab they were opened from), and whether About is open |
| `src/store.tsx` | the app's state and every action (talks to the core), notices (`notify`) and quick notes (`quick`, `Toast`), recent projects, and the two tabs that browse: what is open and selected in the Library and in the Audio Editor |
| `src/Home.tsx` | Home: new, open, recent (each with Show in folder) and open project, About by the logo, the background art (a slow slideshow) and its credit; What's new, when the changelog has an entry |
| `src/Library.tsx`, `src/IndexTree.tsx` | the left panels: the Library's Index and All Archives, and the Audio Editor's list of what the project works on |
| `src/music.ts`, `src/Tags.tsx` | the Index as the app looks things up in it, whose audio an item plays, and tags in a category's colour |
| `src/CueView.tsx`, `src/ItemHead.tsx` | the slots of what is open (a music cue, or a bank's sounds in groups that fold), and the slot list's shortcuts. A row is where a slot's original and replacement play and where its file is chosen, replaced (the file name) and removed |
| `src/Inspector.tsx` | the selected slot's settings: what replaces it (file or silence and its timing), Make-Up Gain, timing, cue points, notes, where else it plays; the keys while nothing is selected. In the Library, `SlotFacts` says what a slot is |
| `src/Timeline.tsx`, `src/Waveform.tsx` | the waveform dock: original vs replaced on one scale, click to play from a spot, draggable cue points, and where a play-through is in the slot |
| `src/PlayThrough.tsx`, `src/player.ts` | a whole cue played the way the game does, and the one player everything plays through (the now-playing bar leads back to what plays) |
| `src/SliceTool.tsx` | cut one song into pieces and fill a cue, one slot per segment: the song and the originals on one zoomable time scale, cuts to drag, add and remove, a table of pieces against their originals |
| `src/BuildTab.tsx` | Build: name, description, version and id as HD2 Arsenal shows them, the icon (an image or the default one, with a border and corners), the Build button and where builds go, build options, the log |
| `src/ExportDialog.tsx`, `src/exportList.ts` | the Export… dialog (a cue's audio, or a bank's sounds one by one, as WAV, FLAC or MP3), and the export list: things collected from anywhere (right-click ▸ Add to the export list), exported together from the status bar |
| `src/TextTab.tsx` | the Text tab: the game's text in every language (subtitles and every other line), to search and change, with colours, sizes and emphasis, and a preview of how the game shows it |
| `src/stable.ts` | `useStable`: handlers that keep one identity, for rows memoised with React.memo |
| `src/Fold.tsx` | sections that grow open and shrink shut (library groups, What's new, the list around a piece of music) |
| `src/SettingsTab.tsx`, `src/settings.ts` | Settings: System (the game's folder, startup, updates: Manual, Prompt on startup or Automatic, tooltips, disk space, layout), Shortcuts, Theme |
| `src/About.tsx` | About Audiodiver, a dialog over any tab: version, licence and source, log file, Credits |
| `src/dialog.ts` | `useDialog`: what every dialog shares: the newest one open takes Esc, keeps the keyboard inside and takes the focus itself; closing gives the focus back |
| `src/UpdatesTab.tsx`, `src/updates.ts` | Updates: this version against the newest release on GitHub (asked through the core's `releases`), Update now, and every version's changes as a timeline; the question at startup (`UpdatePrompt`). `updates.ts` keeps the state, orders versions as semver does and installs through the shell's updater plugin, or opens the release's page where the shell has none |
| `src/keys.ts` | every keyboard command, its default keys, the user's rebindings, and the one listener that runs them |
| `src/theme.ts` | the theme: colours from the chosen hue, text size, spacing, contrast, animations |
| `src/Tooltip.tsx` | the styled tooltips: any element with `data-tip` (see the file for the attributes; `data-tip-more` adds a fainter second line) |
| `src/Wiki.tsx`, `src/wiki/*.md` | the Wiki and its pages (one Markdown file per page; see `src/content.ts` for the header); `Help`, the "?" that holds a description (hover) and opens a Wiki page (click); `WikiLink`, words that open one |
| `src/Markdown.tsx`, `src/content.ts` | Markdown rendering (in-app links, live key names, callouts); the bundled pages, changelog and art, `CREDITS` (About), `REPO_URL` and the licence |
| `CHANGELOG.md` | what's new, newest first; Home shows the top entry and Updates lists them all (with the release notes from GitHub). Empty while the app is in Beta 1 |
| `src/art/` | the Home background: every image in it, shown in turn (see the README there for size and format) |
| `src/Logo.tsx`, `../assets/logo/` | the logo: the official files, taken straight from `assets/logo` (`@logo` in `vite.config.ts`) and drawn in the highlight colour |
| `src/platform.ts` | dialogs, drag-and-drop, reveal and web links in the desktop app; browser fallbacks |
| `src-tauri/src/lib.rs` | starts and stops the core (with this computer's `core.json`, if any), hands its port and token to the UI, or why the core didn't start |
| `src-tauri/icons/`, `app-icon.png` | the app's icons, made from the logo: see `../core/tools/import_logo.py` for how to make them again |

Conventions: tooltips use `data-tip` (never `title=`), so they look like the app and name the current key; text that mentions a key asks `keyLabel()` in `keys.ts`, so it follows a rebinding.

Writing rules (`core/tests/test_core.py` checks the core's shown data against them):
- The words are **Original** (the game's audio in a slot), **new audio** (the file that replaces it) and **Replaced** (a slot, item or state that plays new audio). Never "the game's" against "yours", "Yours" or "my audio": no personal feel. Statuses read *Original / Partly replaced / Replaced*; the Text Editor says *Original / New text / Changed*.
- People and sources are named in **About ▸ Credits** (the ⓘ by the version) (`CREDITS` in `src/content.ts`) and nowhere else: not in clip notes, tooltips, the Wiki or the core's data. A note says what a clip does ("Plays when approaching an outpost."), never who found it. Other names a piece goes by read *Also called '…'*.
- No testing status on screen ("not tested", "experimental, test it in game"): state what is known plainly, or leave it out.
- Short: labels and tooltips say what a thing is or does, in a few words. A description that needs a sentence goes into a "?" (`Help`) or the Wiki, not under every control. No reassurance ("Your work is saved", "Nothing half-written was left behind") and no flavour paragraphs.
- Quick notes (`quick()`) confirm what was just done, one line ("**X** added to **My Mod**"). Notices (`notify`) are for what needs reading or a button: Undo after an edit that takes audio away, Show in folder, failures.
- One home per control: a slot's row plays the original and the replacement and takes, replaces and removes its file; the waveforms play from a click; the details panel only sets up. Don't add a second set of play or file buttons elsewhere.

Readability rules:
- Where the meaning of something isn't immediately clear, add a visual element that puts it in context before the words are read: the chain on tags that mean "linked to other places" (`Linked` in `CueView.tsx`), the category icons, the play button's progress ring.
- Nothing that adds friction: the same action sits in the same place everywhere. Play buttons always lead their line (groups, takes, slots, the Index, All Archives).
- Lists that fold have one **Collapse all** button (`CollapseAllIcon`), not an expand/collapse pair or a toggle.
- Smooth on low-end PCs (measure with the CPU throttled 4x): rows of long lists are memoised, read `useLite()` instead of `useEditor()` and get `useStable` handlers; off-screen rows are skipped (`content-visibility: auto`, or `useRowWindow` for the Archives table); drags write to the DOM once a frame and tell React on release; what changes every frame of playback reads `usePlayerLook` (only visible changes), moves by transform, and has a layer of its own.

Fonts: Archivo, Noto Serif and Roboto Mono, from the `@fontsource-variable` packages (SIL Open Font License 1.1), loaded in `src/main.tsx` and chosen in Settings ▸ Theme (`src/theme.ts`). They are free to ship. The Home art is official Helldivers 2 artwork, captioned under the picture on Home and credited in About. A credit is not a licence: the art is not in the public repository (`.gitignore`), and a build that ships it needs permission first.
