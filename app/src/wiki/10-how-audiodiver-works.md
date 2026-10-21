---
title: How Audiodiver works
group: Getting started
summary: What Audiodiver does, what a project is, and what each tab is for.
---

Audiodiver replaces Helldivers 2 audio by **what it is and where it plays**. You find a piece of music or a set of sounds in the Library, add it to a project and give it new audio. Audiodiver then works out the sound banks, ids and timing values the game needs.

If the game's audio is new to you, [The game's audio, explained](wiki:game-audio) covers archives, banks, takes, cues, segments and slots. [Reading the screen](wiki:reading-the-screen) goes through every part of the window.

## Projects

A project is a single `.audi` file. It records what the mod changes and which files replace which of the game's clips, along with Make-Up Gain and timing. The project points to the audio files and doesn't copy them. If you keep the audio files next to the project file, you can move the whole folder.

Changes are saved automatically. {key:save} saves at any time, and {key:undo} undoes the last change.

Audiodiver never writes to the game's folder. It reads the game's audio from the Steam library, and you can choose another folder under **Game** in [Settings](app:settings/system). A build produces a ZIP for **HD2 Arsenal**, the mod manager that installs it.

## The tabs

The icons down the left of the window are the main tabs. Hover over one to see its name and shortcut.

- {icon:home} **Home** has new, open and recent projects.
- {icon:library} **Library** lists everything the game plays, so you can find it and listen to it. Browsing it changes nothing, and **Add to the project** puts an entry in the project. **Index** sorts the audio that has a name, and **All Archives** lists every archive that contains audio.
- {icon:audio} **Audio Editor** shows what the project works on. This is where slots get new audio.
- {icon:text} **Text Editor** has the game's text in every language, including subtitles. See [The game's text and subtitles](wiki:text).
- {icon:build} **Build** sets what HD2 Arsenal shows for the mod and holds the Build button. A red number on the tab counts the problems that block a build.
- {icon:updates} **Updates**, {icon:wiki} **Wiki** ({key:wiki}) and {icon:settings} **Settings** are at the bottom. Updates is highlighted when a new version of Audiodiver is available, and it lists the changes in every version.

The version number at the right end of the status bar also opens Updates. The {icon:info} button next to it opens [About](app:about), with the licence, the log file and the credits.

The window's title is the name of the open project.

The Library and the Audio Editor share the same layout, and both have **Export…**. You find something in the Library and work on it in the Audio Editor.

## New versions of Audiodiver

Audiodiver checks GitHub for a new version every time it starts. [Settings ▸ System](app:settings/system) controls what happens when there is one:

- **Prompt on startup** (the default) asks first, with **Update now**, **Read the changelog** and **Not now**.
- **Manual** doesn't ask. The Updates tab and the version in the status bar are highlighted, and **Update now** is on the Updates tab.
- **Automatic** installs the new version at startup and restarts Audiodiver.

An update replaces only the app. Projects, audio files and settings are kept.

## Settings

### Game folder

**Game** in [Settings ▸ System](app:settings/system) shows the folder Audiodiver reads the game from. Audiodiver finds it through Steam. If the game is somewhere else, press **Choose another folder…** and pick the folder Steam installed Helldivers 2 in, or its `data` folder. Audiodiver then reads the game again, which takes about a minute the first time. It only reads from this folder and never writes to it.

### Startup

With **Open the last project when Audiodiver starts** on, Audiodiver opens the last project in the Audio Editor. With it off, Audiodiver starts on Home with the recent projects.

### Disk space

Audiodiver keeps prepared copies of audio so that it doesn't prepare the same audio twice. **Previews** are the decoded originals, the waveforms and the Play through renders. **Encoded audio** is new audio converted for the game, which builds reuse. Clearing either one is safe, and Audiodiver prepares the copies again when it needs them. Projects and audio files are never stored there.

Next: [A first mod](wiki:first-mod).
