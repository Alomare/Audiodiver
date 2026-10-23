<p align="center">
  <img src="assets/logo/logo-fullres.png" alt="Audiodiver's logo" width="128">
</p>

<h1 align="center">Audiodiver</h1>

<p align="center">
  <b>Audio mods for Helldivers 2, made in one window.</b><br>
  Replace any music, sound or voice line, add new takes and layers, change the game's text,<br>
  and build a mod that HD2 Arsenal installs. No Wwise, no hex editor, no command line.
</p>

<p align="center">
  <img alt="Windows 10 and 11" src="https://img.shields.io/badge/Windows-10%20%7C%2011-2f7bf5?style=flat-square">
  <img alt="Mods for HD2 Arsenal" src="https://img.shields.io/badge/mods%20for-HD2%20Arsenal-ffe81f?style=flat-square">
  <img alt="Licence: MPL-2.0" src="https://img.shields.io/badge/licence-MPL--2.0-3a3a3a?style=flat-square">
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
  <sub>The Audio Editor with new music for the loadout screen. Each row plays the original on the left and the new audio on the right.</sub>
</p>

> [!NOTE]
> Audiodiver only reads the game's files. It never writes to the game's folder: a mod reaches the game when you
> deploy it in HD2 Arsenal, and you can turn it off there at any time.

<p align="center">
  <a href="#features">Features</a> ·
  <a href="#everything-in-the-box">Everything in the box</a> ·
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
      <h3>🔎 Everything, by name</h3>
      Music by the moment it plays, weapons by loadout slot with their in-game names, then stratagems, enemies, voices and planets. Every sound in the game is a click away from playing.
    </td>
    <td width="25%" valign="top">
      <h3>🎚️ Drop in the audio</h3>
      WAV, FLAC, MP3 and more. Audiodiver converts each file to the game's format and works out the sound banks, ids and timing for you.
    </td>
    <td width="25%" valign="top">
      <h3>🎧 Hear it in context</h3>
      Play a whole piece of music the way the game strings it together, and switch between the original and the new audio without losing your place.
    </td>
    <td width="25%" valign="top">
      <h3>📦 Ready for Arsenal</h3>
      One button builds a ZIP with the mod's name, icon and version. After a game update, a new build is usually all it needs.
    </td>
  </tr>
</table>

<br>

## Features

Every screenshot is the app itself, with a demo project.

<table>
  <tr>
    <td width="50%" valign="top">
      <img src="assets/readme/library.png" alt="The Library's Index with On the Ship, Bridge and War Map open: its two parts, their segments, and the transitions and stingers that play next to it" width="100%">
      <br>
      <sub>The ship's bridge and war map music: its two parts, their segments, and what plays next to it.</sub>
      <h3>Find any sound in the game</h3>
      The Library's Index sorts the game's audio by what it is. Music goes by the moment it plays, from the ship and the hellpod to each faction's missions and the extraction. Everything else comes in sound sets named as the game names them: weapons by loadout slot, stratagems, vehicles, Helldivers, enemies and planets. Press ▶ on anything to hear it.
      <br><br>
      A piece of music shows how the game builds it, from its segments and loops to the layers and the variants a biome picks. Search finds anything by name or id, and All Archives lists every archive in the game for what the Index doesn't name.
    </td>
    <td width="50%" valign="top">
      <img src="assets/readme/sounds.png" alt="The AC-8 Autocannon in the Audio Editor: five takes of a sound with new audio, one of them 4 dB louder, one silenced, and the selected take's details with the places that share its clip" width="100%">
      <br>
      <sub>The AC-8 Autocannon: five takes replaced, one louder by 4 dB, one silenced, and where else the clip plays.</sub>
      <h3>Replace it by dropping a file</h3>
      Add what you want to change to a project, then drop audio files on it in the Audio Editor: on one slot, on a sound's group of takes, or on a whole piece of music, which fills its slots in file-name order. Audiodiver reads WAV, FLAC, MP3, OGG, Opus, M4A, AAC, AIFF and WMA, and converts each file to the game's format when it builds.
      <br><br>
      Each slot can have its own Make-Up Gain, from −12 to +12 dB, or play silence in place of the original. A clip that several sounds share is marked, and its details list where else it plays, so you know what changes with it.
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="assets/readme/playthrough.png" alt="Play through playing the new loadout music: a progress bar with a tick for each segment, the playing slot lit, and the playhead on its waveform" width="100%">
      <br>
      <sub>Play through on the new loadout music: the playing slot is lit, with the playhead on its waveform.</sub>
      <h3>Hear it the way the game plays it</h3>
      Each slot's row plays the original on its left half and the new audio on its right, and switching between them keeps the playback position. <b>Play through</b> plays the whole piece the way the game strings it together, with the same hand-overs between segments.
      <br><br>
      Below the slots, both waveforms share one time scale, with the Entry and Exit cue points that time each hand-over. A segment takes the length of its new clip by default, so new music doesn't have to match the original's length.
    </td>
    <td width="50%" valign="top">
      <img src="assets/readme/slice.png" alt="The slice tool: a five-minute song with 15 numbered cuts for the slots of Loadout Selection, the original of each slot under it, and a table of the pieces" width="100%">
      <br>
      <sub>A song cut into the 15 slots of Loadout Selection, with each slot's original under it.</sub>
      <h3>One song, cut to fit</h3>
      <b>Slice a song…</b> cuts one long track into the segments of a piece at exact sample positions, so the pieces play back to back like the uncut song. Place the cuts by the original proportions, by the original lengths or evenly, then drag them to where the music turns.
      <br><br>
      The original audio of each slot runs under the song on the same time scale, with a red edge where a piece is shorter than the original. Audiodiver keeps the cuts for each song, so you can come back and slice it again.
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="assets/readme/adding.png" alt="The AC-8 Autocannon in the Audio Editor with a layer added under Sound 3: two new takes, the first selected, its details saying it plays whenever the sound above it plays" width="100%">
      <br>
      <sub>A layer with two new takes under one of the autocannon's sounds. It plays whenever that sound plays.</sub>
      <h3>Add audio the game doesn't have</h3>
      Some changes need more than a replacement. Give a sound <b>new takes</b>, and the game picks among them and its own each time the sound plays. Add a <b>layer</b> that plays along with a sound. Or give one sound <b>new audio of its own</b> where the game shares a clip between several.
      <br><br>
      Audiodiver writes the new objects and ids into the sound banks itself. Importing a mod made with another tool brings its added audio in the same way.
    </td>
    <td width="50%" valign="top">
      <img src="assets/readme/text.png" alt="The Text Editor with a changed subtitle: the original, the new text with its colour and emphasis tags, and a preview of how the game shows it" width="100%">
      <br>
      <sub>A changed subtitle, with its preview as the game shows it.</sub>
      <h3>Change any line of text</h3>
      The Text Editor holds every line of the game's text in its 15 languages, subtitles included. Find a line, change it, and colour, size or emphasise part of it from the formatting bar. The preview shows the line the way the game will.
      <br><br>
      Voice lines and subtitles are linked both ways: a voice line's <b>Subtitle</b> opens its line in the Text Editor, and a subtitle lists the voice lines that say it.
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="assets/readme/build.png" alt="The Build tab after a build: the next version, the build options, the Build button with the destination folder and the last build, and the build's log" width="100%">
      <br>
      <sub>The Build tab after a build: the next version, the options and the log.</sub>
      <h3>Build a mod for HD2 Arsenal</h3>
      <b>Build</b> turns the project into a ZIP that HD2 Arsenal installs, named after the mod and its version. Audiodiver converts the new audio, patches the sound banks that play it, checks the result and packs it. The project, its files and the game stay as they were.
      <br><br>
      By default a build patches only the banks of what the project lists, so the mod stays small. <b>Patch every bank with the sounds</b> reaches every bank that has them. A dot on the Build tab means the project changed since its last build, and the tab says when the game has updated since.
    </td>
    <td width="50%" valign="top">
      <img src="assets/readme/project.png" alt="The Project tab: the description, the icon with its border and corners, the mod id and the folder, beside a preview of the mod as HD2 Arsenal shows it" width="100%">
      <br>
      <sub>The Project tab, with a preview of the mod as Arsenal shows it.</sub>
      <h3>A project in one folder</h3>
      The Project tab holds what Arsenal shows: the name, the description, an icon cropped and framed to Arsenal's size, and the mod id that lets each new build update the installed mod.
      <br><br>
      Each project keeps its audio in a folder of its own. <b>Collect files</b> copies in what came from elsewhere, unused files go to the Recycle Bin, and a pack (<code>.audipack</code>) carries the project and its files to another computer.
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="assets/readme/repatch.png" alt="Tools, Repatch, after rebuilding a mod: the new ZIP, Show in folder and Repatch another mod, then what was carried over and what was left out" width="100%">
      <br>
      <sub>Repatch after rebuilding a mod: what it carried over and what it left out, in short.</sub>
      <h3>Bring old mods back</h3>
      A mod made for an older version of the game can go silent after an update, or even mute sounds it never changed, like all gunfire. <b>Repatch</b> rebuilds it on the current game's sound banks with the mod's own audio and sound settings, without encoding the audio again. Its options, files and id stay as they were, so Arsenal updates the installed copy.
      <br><br>
      <b>Installed mods</b> checks the mods in HD2 Arsenal and in the game's folder for sound banks of an older version, and opens the ones that need it, ready to repatch.
    </td>
    <td width="50%" valign="top">
      <img src="assets/readme/combine.png" alt="Combine Mods with two mods that both change Loadout Selection: six conflicts, each with both mods' versions to play and the chosen one marked" width="100%">
      <br>
      <sub>Two mods that change the same music: each conflict with both versions to play, and the one chosen.</sub>
      <h3>Many mods as one</h3>
      Two mods that change the same sound banks can't both play: the one deployed last wins. <b>Combine Mods</b> reads several mods, with the options you chose in Arsenal, and lists the sounds that more than one of them changes. Play each version and choose one.
      <br><br>
      The result is one mod, built on the current game, and a project you can open to change it further.
    </td>
  </tr>
</table>

<br>

## Everything in the box

<table>
  <tr>
    <td width="33%" valign="top">
      <h4>🎵 Music</h4>
      Segments, loops, layers and biome variants · transitions and stingers, with <b>Skip</b> to silence the ones between new pieces · Entry and Exit cue points · segments that fit the new audio's length · Play through · the slice tool · silence that keeps the original timing or moves straight on
    </td>
    <td width="33%" valign="top">
      <h4>🔊 Sounds and voices</h4>
      Sound sets for weapons, stratagems, vehicles, Helldivers, allies, enemies, planets and the interface · voice lines labelled with their subtitle's words, and the grunts and breaths named · new takes, layers and audio for one sound only · Make-Up Gain from −12 to +12 dB · silence · shared clips marked where they're shared
    </td>
    <td width="33%" valign="top">
      <h4>📝 Text</h4>
      Every line of the game's text in 15 languages · colour, size, emphasis and line breaks from a formatting bar · a preview as the game shows it · subtitles linked to their voice lines · the changed lines on their own
    </td>
  </tr>
  <tr>
    <td width="33%" valign="top">
      <h4>📁 Projects</h4>
      A folder per project · <b>Collect files</b> · unused files to the Recycle Bin · packs (<code>.audipack</code>) for another computer · notes in Markdown on slots and items · undo and redo · <code>.audi</code> projects and packs open from Explorer
    </td>
    <td width="33%" valign="top">
      <h4>📦 Building and tools</h4>
      ZIPs for HD2 Arsenal with the mod's name, description, icon, id and version · the project's banks or every bank · a check of every build · Repatch · Combine Mods · a check of the installed mods · importing a mod's patch into a project · exporting audio to files, alone or from an export list
    </td>
    <td width="33%" valign="top">
      <h4>🖥️ The app</h4>
      Dark and light themes, with your own colour and sizes · the tab bar on any side of the window · keyboard shortcuts for the tabs and commands · a Wiki of 20 pages, a press of F1 away · updates from inside the app · installed or portable
    </td>
  </tr>
</table>

<br>

## How it works

- **It reads the game and never writes to it.** Audiodiver finds Helldivers 2 through Steam and reads its archives. Nothing it does changes the game's folder.
- **An index of the game's audio.** At the first start, which takes about a minute, the core indexes every sound bank, stream and object, with names from the modding community's research. It indexes again after each game update.
- **Builds start from the current game.** A build takes today's sound banks, puts the new audio and timing in, and reads the result back to check it before packing the ZIP. That's why rebuilding after an update is usually all a mod needs.
- **The game's own audio format.** New audio is encoded to Wwise Vorbis with wav2wem, the game's audio plays through vgmstream, and FFmpeg reads everything else. All three come with Audiodiver.
- **Two halves.** A Python core reads, patches and builds, and the window is Tauri 2 with React. They talk over a local connection that a token protects.
- **Tested against real mods.** More than 180 tests, among them byte-for-byte builds of three complete music mods.

### What it doesn't do

- It runs on Windows only, with Helldivers 2 from Steam.
- It changes what plays and how loud. Effects, positioning and how a container picks its takes stay as the game has them.
- Repatch and Combine Mods carry over audio and sound settings. They leave out text and anything else a patch holds besides sound banks, like models and textures.
- It doesn't install mods. HD2 Arsenal does that.
- It doesn't change the game's videos.

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

The Wiki inside the app (F1) walks through a first mod step by step, and explains how the game plays its music,
how loud new audio should be, and what to do after a game update.

| Download | What it is |
|---|---|
| `Audiodiver_<version>_x64-setup.exe` | The installer. It adds Audiodiver to the Start menu, opens projects and packs from Explorer, and can install new versions for you. |
| `Audiodiver-<version>-portable.zip` | Runs from any folder, with its settings and caches beside it. Unzip it and start `Audiodiver.exe`. New versions are downloaded by hand. |

Everything Audiodiver runs comes with it. Its window uses the Microsoft Edge WebView2 Runtime, which Windows 11 has
and nearly every Windows 10 PC has too. If yours doesn't, Audiodiver shows a link to
[Microsoft's free download](https://developer.microsoft.com/microsoft-edge/webview2/).

## Questions and feedback

Audiodiver comes out of the Helldivers 2 modding community, and every report and idea makes it better.

### Asking for help

The [Helldivers 2 Modding Discord](https://discord.gg/helldiversmodding) is the place to ask how to do something,
show what you made, or say what you'd like Audiodiver to do next. Many of the people whose research Audiodiver builds
on are there too.

### Reporting a bug

Open an [issue](https://github.com/Alomare/Audiodiver/issues) with:

- the version, shown at the bottom right of the window,
- what you did, what you expected, and what happened instead,
- the log file, if the problem left an error in it (the ⓘ next to the version shows where it is),
- for something you heard in game, the mission, planet or faction where it happened.

If a mod sounds wrong in game, build it again first: the game may have updated since its last build. If it still
sounds wrong, say which piece or sound it is and what you heard.

### Suggesting an idea

Talk it over on the Discord first. An issue is the place for a change once it's agreed on.

### Supporting Audiodiver

Audiodiver is free. If it saved you an evening, you can buy the developer a coffee on [Ko-fi](https://ko-fi.com/alomare).

## Contributing

Help of every kind is welcome, with code or without.

### Without code

- **Report what you find.** Bugs, odd sounds, confusing screens: an issue or a message on the Discord helps.
- **Name things.** The Library's names come from the community's spreadsheets and research. If a sound is in the
  wrong place, or has the wrong name or none, say so.
- **Improve the Wiki.** Its pages are Markdown files in [`app/src/wiki/`](app/src/wiki/). A clearer sentence or a
  missing step makes a good first pull request.
- **Help others** on the Discord with what you've learned.

### With code

You need Windows with Helldivers 2 from Steam, Python 3.12+, Node.js 20+ and Rust, and ffmpeg, vgmstream-cli and
wav2wem on your PATH.

```sh
pip install -e "core[test]"     # the core
cd app && npm install           # the window
npm run tauri dev               # the app, with hot reload
```

Before a pull request, `python -m pytest core -q` and `npx tsc --noEmit` (in `app`) pass, and you've tried the change
in the app. [`app/README.md`](app/README.md) and [`core/README.md`](core/README.md) say what each file does, and the
first also gives the rules for the app's writing and layout. Keep to one change per pull request, add a screenshot
when it changes what the app shows, and open an issue before a large change so we can agree on the approach.

[CONTRIBUTING.md](CONTRIBUTING.md) has the details, including what the repository never takes: game files, other
people's mods, and anything without a licence that allows it here.

<br>

<p align="center">
  <a href="https://discord.gg/helldiversmodding"><img alt="Join the Helldivers 2 Modding Discord" src="https://img.shields.io/badge/Helldivers%202%20Modding%20Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white" height="40"></a>
</p>

<h3 align="center">Come mod with us</h3>

<p align="center">
  The Helldivers 2 Modding Discord is where audio modders trade notes on how the game plays its music,<br>
  share what they've made, and help each other with a first mod. Whether you're replacing one gunshot<br>
  or scoring every mission, you're welcome there.
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

## Licence

Audiodiver is free software under the [Mozilla Public License 2.0](LICENSE). Anyone who shares it, changed or not,
has to keep its files open under the same licence. The licence doesn't cover the mods you build with it.

`core/audiodiver/_vendor/slim.py` comes from hd2-audio-modder, under the MIT License
(`core/audiodiver/_vendor/LICENSE-hd2-audio-modder`). FFmpeg, vgmstream and wav2wem keep their own licences (wav2wem
is under GPL-2.0), and their sources are at the links above. The Home pictures (`app/src/art/`) are screenshots of
Helldivers 2 by the author; the game in them belongs to Arrowhead Game Studios.

<sub>Audiodiver is a fan-made tool, not affiliated with or endorsed by Arrowhead Game Studios or Sony Interactive
Entertainment. HELLDIVERS is a trademark of Sony Interactive Entertainment LLC.</sub>
