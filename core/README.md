# audiodiver (core)

A headless library and command-line tool that builds Helldivers 2 audio replacement mods from a `.audi` project into a verified HD2 Arsenal ZIP. The editor (`../app`) runs it as a local API server.

```
pip install -e "core[loudness,test]"     # loudness = optional Wwise analysis
python -m audiodiver new my.audi --name "My Mod" --from-folder replacers
python -m audiodiver build my.audi       # -> build/<name>-<version>.zip (or the project's build_folder, or --out DIR)
python -m audiodiver inspect some.patch_0   # what a patch changes against the current game
python -m audiodiver index --rebuild
python -m audiodiver serve --port 8765 --token dev   # the editor's API (the desktop app starts this itself)
python -m pytest core                    # unit tests + golden builds of the three mods (needs the game)
python core/tools/import_sounds.py       # dev: the Index's sound data, from the community's workbook (see the file)
python core/tools/import_logo.py         # dev: the default mod icon and the app icon's source, from assets/logo
```

The build needs ffmpeg, wav2wem and vgmstream-cli (see `audiodiver/wem.py`). The game folder is found through Steam (the registry says where Steam is). The editor's Settings ▸ System can choose another folder, which the core keeps in `%LOCALAPPDATA%\Audiodiver\settings.json` (`game_data`); without one, the `HD2_DATA` environment variable goes before Steam. Caches (the audio index, encoded WEMs and the Wwise scratch project) live in `%LOCALAPPDATA%\Audiodiver` too. The index rebuilds itself when the game's files change.

| Module | Role |
|---|---|
| `game.py` | finds the game, reads packages from the slim bundles (vendored `_vendor/slim.py`, MIT) and the voice packs next to them (DSAR files, one set per installed language), murmur64 |
| `index.py` | which banks hold or play each sound, which archives hold each bank or stream, and which language a voice bank is in; cached per game version |
| `bank.py`, `music.py` | Wwise v154 bank chunks and music objects (round-trip byte-identical) |
| `patch.py` | the surgical patch writer: copies vanilla banks and changes only the replaced audio, its sizes, its timing and its gain; `verify` enforces that |
| `wem.py`, `akd.py` | WAV→WEM encoding; optional Wwise loudness/HDR analysis chunk |
| `project.py`, `build.py`, `cli.py` | the `.audi` format, the build pipeline, the CLI |
| `arsenal.py` | the Arsenal ZIP/manifest packager, and the icon: an image, or the default one (Audiodiver's logo, `data/icon.png`), with a border and rounded corners |
| `cuemap.py` | every piece of music the game can play, walked from the music root switches and events; cached per game version |
| `catalog.py`, `data/` | names for people: every music cue in the game's own structure, cue and slot names, locks. `data/catalog.json` is hand-curated; `names.json` (cracked Wwise names) and `labels.json` come from dictionary attacks on the Wwise names and the music workbook (`tools/import_knowledge.py`); `notes.json` (hand-kept) names and explains single clips, with warnings and minimum lengths. Shown texts follow the app's writing rules (`app/README.md`): no people or sources (those are in the app's Credits), no testing status |
| `musiclist.py`, `data/music.json` | the music as the Index lists it: sections in mission order, items a player would recognise (one per faction role for combat: arrival, exploring, battle...), transitions named by what they connect, and which transitions or stingers sit next to which music |
| `library.py`, `data/sounds.json`, `banks.json`, `voices.json` | the Library: the Index (the music, then the sound sets the community has named, by category) and All Archives (every archive with audio in it). A bank opens as its sounds, grouped by take and labelled with what a voice line says (for a voice nobody transcribed, the call another voice built the same way makes in its place). The three data files are written by `tools/import_sounds.py` |
| `titles.py` | title case for every name the Library shows |
| `strings.py` | the game's text: string tables (one per table and language, in archive 9ba626afa44a3aa3), read, searched and written back whole with a project's lines in them |
| `audio.py` | waveform peaks (numpy when installed), sample-exact slicing of one song into pieces, and the built-in silence a replacement can play instead of a file |
| `render.py` | renders segments and whole cues the way the game plays them (exports, Play through); needs numpy |
| `editor.py`, `server.py` | the editor session (autosave and save on demand, undo/redo, the project's list of what it works on, album fill, slicing into chosen slots, patch import, background builds) and its token-protected localhost API |
| `updates.py` | Audiodiver's own releases on its GitHub repository, for the app's Updates tab (the `releases` method; it only reads, the shell installs). `AUDIODIVER_RELEASES` names a file in the GitHub API's format to read instead (development, tests) |
