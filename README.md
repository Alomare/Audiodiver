<p align="center">
  <img src="assets/logo/logo-fullres.png" alt="Audiodiver's logo" width="128">
</p>

<h1 align="center">Audiodiver</h1>

<p align="center">Helldivers 2 audio and text archive explorer, editor and mod packager</p>

<p align="center">
  <img alt="Windows 10 and 11" src="https://img.shields.io/badge/Windows-10%20%7C%2011-2f7bf5?style=flat-square">
  <img alt="Mods for HD2 Arsenal" src="https://img.shields.io/badge/mods%20for-HD2%20Arsenal-ffe81f?style=flat-square">
  <img alt="License: MPL-2.0" src="https://img.shields.io/badge/license-MPL--2.0-3a3a3a?style=flat-square">
  <a href="https://github.com/Alomare/Audiodiver/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/Alomare/Audiodiver?style=flat-square&label=release&color=3a3a3a"></a>
</p>

<p align="center">
  <a href="https://discord.gg/helldiversmodding"><img alt="Ask on the Helldivers 2 Modding Discord" src="https://img.shields.io/badge/Helldivers%202%20Modding%20Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white" height="40"></a>
</p>

<p align="center">
  <a href="https://github.com/Alomare/Audiodiver/releases/latest"><b>Download</b></a> ·
  <a href="#get-started">Get started</a> ·
  <a href="https://github.com/Alomare/Audiodiver/issues">Report a bug</a> ·
  <a href="https://ko-fi.com/alomare">Ko-fi</a>
</p>

<br>

<p align="center">
  <img src="assets/readme/editor.png" alt="The Audio Editor with the loadout screen's music open: its segments in a list, each with the original and the new audio side by side, and both waveforms on one time scale below" width="100%">
  <br>
  <sub>The Audio Editor with new music for the loadout screen.</sub>
</p>

> [!NOTE]
> Audiodiver reads the game's files and never writes to the game's folder. Mods reach the game through HD2 Arsenal,
> where you can turn them off at any time.

<p align="center">
  <a href="#features">Features</a> ·
  <a href="#feature-list">Feature list</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#get-started">Get started</a> ·
  <a href="#questions-and-feedback">Questions and feedback</a> ·
  <a href="#contributing">Contributing</a> ·
  <a href="#credits">Credits</a>
</p>

<br>

<table>
  <tr>
    <td width="25%" valign="top">
      <h3>Every sound by name</h3>
      Music by the moment it plays, weapons by loadout slot with their in-game names, then stratagems, enemies, voices and planets.
    </td>
    <td width="25%" valign="top">
      <h3>Any audio file</h3>
      WAV, FLAC, MP3 and more. Audiodiver converts them to the game's format and works out the sound banks, ids and timing.
    </td>
    <td width="25%" valign="top">
      <h3>Original and new</h3>
      Each row plays the original and the new audio, and a whole piece of music plays as the game strings it together.
    </td>
    <td width="25%" valign="top">
      <h3>Mods for HD2 Arsenal</h3>
      A ZIP with the mod's name, icon and version. After a game update, build it again.
    </td>
  </tr>
</table>

<br>

## Features

<table>
  <tr>
    <td width="50%" valign="top">
      <img src="assets/readme/library.png" alt="The Library's Index with On the Ship, Bridge and War Map open: its two parts, their segments, and the transitions and stingers that play next to it" width="100%">
      <h3>Library</h3>
      The game's audio, sorted by what it is. Music goes by the moment it plays, from the ship to the extraction, and sound sets by the game's own names: weapons by loadout slot, stratagems, enemies, planets. Search takes a name or an id, and All Archives lists every archive in the game.
    </td>
    <td width="50%" valign="top">
      <img src="assets/readme/sounds.png" alt="The AC-8 Autocannon in the Audio Editor: takes of a sound with new audio, the selected one 4 dB louder, and its details with the places that share its clip" width="100%">
      <h3>Audio Editor</h3>
      The project's music and sounds, one slot per clip. Audio files dropped on a slot, a sound's takes or a whole piece of music replace the original. Each slot has its own Make-Up Gain, from −12 to +12 dB, or silence.
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="assets/readme/playthrough.png" alt="Play through playing the new loadout music: a progress bar with a tick for each segment, the playing slot lit, and the playhead on its waveform" width="100%">
      <h3>Audio Editor ▸ Play through</h3>
      A whole piece of music with the game's hand-overs between segments, in the original or the new audio. Both waveforms share one time scale, with the Entry and Exit cue points.
    </td>
    <td width="50%" valign="top">
      <img src="assets/readme/slice.png" alt="The slice tool: a five-minute song with 15 numbered cuts for the slots of Loadout Selection, the original of each slot under it, and a table of the pieces" width="100%">
      <h3>Audio Editor ▸ Slice a song</h3>
      One song cut into the segments of a piece at exact sample positions, so the pieces play back to back like the song. The cuts start at the original lengths or proportions, and you drag them to where the music turns.
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="assets/readme/adding.png" alt="The AC-8 Autocannon in the Audio Editor with a layer added under Sound 3: two new takes, the first selected, its details saying it plays whenever the sound above it plays" width="100%">
      <h3>Audio Editor ▸ Add new audio</h3>
      New takes for a sound, a layer that plays with it, or a clip of its own for a sound that shares one with others. Importing a mod made with another tool brings its added audio in the same way.
    </td>
    <td width="50%" valign="top">
      <img src="assets/readme/text.png" alt="The Text Editor with a changed subtitle: the original, the new text with its colour and emphasis tags, and a preview of how the game shows it" width="100%">
      <h3>Text Editor</h3>
      Every line of the game's text in 15 languages, subtitles included, with a formatting bar and a preview as the game shows the line. A voice line links to its subtitle, and a subtitle to its voice lines.
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="assets/readme/project.png" alt="The Project tab: the description, the icon with its border and corners, the mod id and the folder, beside a preview of the mod as HD2 Arsenal shows it" width="100%">
      <h3>Project</h3>
      The mod's name, description, icon and id, with a preview as HD2 Arsenal shows them, and the project's folder: <b>Collect files</b>, unused files to the Recycle Bin, and packs (<code>.audipack</code>) for another computer.
    </td>
    <td width="50%" valign="top">
      <img src="assets/readme/build.png" alt="The Build tab after a build: the next version, the build options, the Build button with the destination folder and the last build, and the build's log" width="100%">
      <h3>Build</h3>
      The project as a ZIP for HD2 Arsenal, checked before it's packed. It patches only the banks of what the project lists, or every bank with the sounds. A dot on the tab means the project changed since the last build.
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="assets/readme/repatch.png" alt="Tools, Repatch, after rebuilding a mod: the new ZIP, Show in folder and Repatch another mod, then what was carried over, its string table included" width="100%">
      <h3>Tools ▸ Repatch</h3>
      A mod made for an older game version, rebuilt on the current sound banks with its own audio, settings, options and id. Its text, models and textures go in as they were. <b>Installed mods</b> finds the mods in HD2 Arsenal and the game's folder that need it.
    </td>
    <td width="50%" valign="top">
      <img src="assets/readme/combine.png" alt="Combine Mods with two mods that both change Loadout Selection: six conflicts, each with both mods' versions to play and the chosen one marked" width="100%">
      <h3>Tools ▸ Combine Mods</h3>
      Several mods that change the same sound banks, built as one mod with the options chosen in Arsenal, their text, models and textures included. Where two mods change the same sound, you play both versions and pick one.
    </td>
  </tr>
</table>

<br>

## Feature list

<table>
  <tr>
    <td width="33%" valign="top">
      <h4>Music</h4>
      Segments, loops, layers and biome variants · transitions and stingers, with <b>Skip</b> to silence the ones between new pieces · Entry and Exit cue points · segments that fit the new audio's length · Play through · the slice tool · silence that keeps the original timing or moves straight on
    </td>
    <td width="33%" valign="top">
      <h4>Sounds and voices</h4>
      Sound sets for weapons, stratagems, vehicles, Helldivers, allies, enemies, planets and the interface · voice lines labelled with their subtitle's words, and the grunts and breaths named · new takes, layers and audio for one sound only · Make-Up Gain from −12 to +12 dB · silence · shared clips marked
    </td>
    <td width="33%" valign="top">
      <h4>Text</h4>
      Every line of the game's text in 15 languages · colour, size, emphasis and line breaks · a preview as the game shows it · subtitles linked to their voice lines · the changed lines on their own
    </td>
  </tr>
  <tr>
    <td width="33%" valign="top">
      <h4>Projects</h4>
      A folder per project · <b>Collect files</b> · unused files to the Recycle Bin · packs (<code>.audipack</code>) · Markdown notes on slots and items · undo and redo · <code>.audi</code> projects and packs open from Explorer
    </td>
    <td width="33%" valign="top">
      <h4>Building and tools</h4>
      ZIPs for HD2 Arsenal with the mod's name, description, icon, id and version · the project's banks or every bank · a check of every build · Repatch · Combine Mods · a check of the installed mods · a mod's patch imported into a project · audio exported to files
    </td>
    <td width="33%" valign="top">
      <h4>The app</h4>
      Dark and light themes, with your own colour and sizes · the tab bar on any side · keyboard shortcuts · a Wiki of 20 pages (F1) · updates from inside the app · installed or portable
    </td>
  </tr>
</table>

<br>

## How it works

- Audiodiver finds Helldivers 2 through Steam and reads its archives.
- At the first start, which takes about a minute, the core indexes every sound bank, stream and object, with names
  from the modding community's research. It indexes again after each game update.
- A build takes the current game's sound banks, puts the new audio and timing in, and reads the result back to check
  it before packing the ZIP. That's why rebuilding after an update is usually all a mod needs.
- wav2wem encodes new audio to Wwise Vorbis, vgmstream plays the game's audio, and FFmpeg reads everything else. All
  three come with Audiodiver.
- A Python core reads, patches and builds, and the window is Tauri 2 with React. They talk over a local connection
  protected by a token.
- More than 180 tests, among them byte-for-byte builds of three complete music mods.

## Get started

You need Windows 10 or 11, Helldivers 2 installed through Steam, and
[HD2 Arsenal](https://github.com/Orbit-Studios/hd2arsenal-release/releases) to install the mods you build.

1. Download Audiodiver from [Releases](https://github.com/Alomare/Audiodiver/releases/latest) and run it. The installer
   isn't code-signed yet, so Windows may say it protected your PC: choose **More info**, then **Run anyway**.
2. Start Audiodiver. It finds the game through Steam and reads its audio, which takes about a minute the first time.
3. On Home, choose **New project**.
4. In the Library, find what you want to change and press **Add to the project**.
5. In the Audio Editor, drop audio files on its slots.
6. Press **Build**, then import the ZIP in HD2 Arsenal and deploy it.

The Wiki (F1) has a first mod step by step, how the game plays its music, how loud new audio should be, and what to
do after a game update.

| Download | What it is |
|---|---|
| `Audiodiver_<version>_x64-setup.exe` | The installer. It adds Audiodiver to the Start menu, opens projects and packs from Explorer, and installs new versions. |
| `Audiodiver-<version>-portable.zip` | The portable copy, with its settings and caches beside it. Unzip it anywhere and start `Audiodiver.exe`. New versions are downloaded by hand. |

The window needs the Microsoft Edge WebView2 Runtime, which Windows 11 has and nearly every Windows 10 PC has too. If
yours doesn't, Audiodiver shows a link to [Microsoft's free download](https://developer.microsoft.com/microsoft-edge/webview2/).
Everything else comes with Audiodiver.

## Questions and feedback

### Asking for help

Ask on the [Helldivers 2 Modding Discord](https://discord.gg/helldiversmodding): how to do something, what you made,
or what you'd like Audiodiver to do next.

### Reporting a bug

Open an [issue](https://github.com/Alomare/Audiodiver/issues) with:

- the version, at the bottom right of the window,
- what you did, what you expected, and what happened instead,
- the log file, if the problem left an error in it (the ⓘ next to the version shows where it is),
- for something you heard in game, the mission, planet or faction where it happened.

If a mod sounds wrong in game, build it again first, since the game may have updated since its last build. If it
still sounds wrong, say which piece or sound it is and what you heard.

### Suggesting an idea

Talk it over on the Discord first, then open an issue once it's agreed on.

### Supporting Audiodiver

Audiodiver is free. If you'd like to support it, there's [Ko-fi](https://ko-fi.com/alomare).

## Contributing

### Without code

- Report bugs, odd sounds and confusing screens, in an issue or on the Discord.
- Fix names. The Library's names come from the community's spreadsheets and research, so if a sound is in the wrong
  place, or has the wrong name or none, say so.
- Edit the Wiki. Its pages are Markdown files in [`app/src/wiki/`](app/src/wiki/), and a clearer sentence or a missing
  step is a good first pull request.
- Help others on the Discord.

### With code

You need Windows with Helldivers 2 from Steam, Python 3.12+, Node.js 20+ and Rust, and ffmpeg, vgmstream-cli and
wav2wem on your PATH.

```sh
pip install -e "core[test]"     # the core
cd app && npm install           # the window
npm run tauri dev               # the app, with hot reload
```

Before a pull request, run `python -m pytest core -q` and `npx tsc --noEmit` (in `app`), and try the change in the
app. [`app/README.md`](app/README.md) and [`core/README.md`](core/README.md) say what each file does, and the first
also has the rules for the app's writing and layout. Keep to one change per pull request, add a screenshot when it
changes what the app shows, and open an issue before a large change.

[CONTRIBUTING.md](CONTRIBUTING.md) has the details, including what the repository never takes: game files, other
people's mods, and anything without a license that allows it here.

<br>

<p align="center">
  <a href="https://discord.gg/helldiversmodding"><img alt="Join the Helldivers 2 Modding Discord" src="https://img.shields.io/badge/Helldivers%202%20Modding%20Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white" height="40"></a>
  <br>
  Audio modders on the Discord share what they make, swap notes on the game's music and help with first mods.
</p>

---

## Credits

Audiodiver builds on the research and tools of the Helldivers 2 modding community. The app lists them under
About ▸ Credits too.

| | By | What Audiodiver takes from it |
|---|---|---|
| [hd2-audio-modder](https://github.com/RaidingForPants/hd2-audio-modder) | RaidingForPants | Reading the game's archives, and how HD2 keeps its sound banks. Its archive reader is part of Audiodiver. |
| [wwise-teller](https://github.com/Dekr0/wwise-teller) | Dekr0 | Wwise property ids, Volume against Make-Up Gain, and how new takes, layers and clips go into a bank. |
| [wwiser](https://github.com/bnnm/wwiser) | bnnm | The reference for Wwise sound bank structures. |
| [FileDiver](https://github.com/xypwn/filediver) | xypwn | The name lists behind the banks' path names. |
| [Sound Systems Rebalanced](https://github.com/CowboyBingus/SoundSystemsRebalanced) | CowboyBingus | The music's drop at the war table. |
| Helldivers 2 Archive Labeling | the HD2 modding community | Names of sound sets, banks and archives, and voice line transcripts. |
| Helldivers 2 Music Stuff | the HD2 modding community | Names of music clips, and the marks on clips not to touch. |
| Music notes | geoffreyhdt1 | Illuminate Void and Automaton clip names, when clips play, warnings and minimum lengths. |
| [Whisper](https://github.com/openai/whisper) | OpenAI | Hearing the voice lines, to match each one to its subtitle. |
| [Audio Spectrogram Transformer](https://huggingface.co/MIT/ast-finetuned-audioset-10-10-0.4593) | MIT | Telling grunts, breaths and laughs from words. |
| [FFmpeg](https://ffmpeg.org), [vgmstream](https://github.com/vgmstream/vgmstream), [wav2wem](https://github.com/pas2k/wav2wem) | | Reading, playing and encoding audio. They come with Audiodiver as programs of their own. |
| Archivo, Noto Serif and Roboto Mono | | The typefaces, under the [SIL Open Font License](https://openfontlicense.org). |

## License

Audiodiver is free software under the [Mozilla Public License 2.0](LICENSE). Anyone who shares it, changed or not,
has to keep its files open under the same license. The license doesn't cover the mods you build with it.

`core/audiodiver/_vendor/slim.py` comes from hd2-audio-modder, under the MIT License
(`core/audiodiver/_vendor/LICENSE-hd2-audio-modder`). FFmpeg, vgmstream and wav2wem keep their own licenses (wav2wem
is under GPL-2.0), and their sources are at the links above. The Home pictures (`app/src/art/`) are screenshots of
Helldivers 2 by the author; the game in them belongs to Arrowhead Game Studios.

<sub>Audiodiver is a fan-made tool, not affiliated with or endorsed by Arrowhead Game Studios or Sony Interactive
Entertainment. HELLDIVERS is a trademark of Sony Interactive Entertainment LLC.</sub>
