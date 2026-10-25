---
title: How Audiodiver works
group: Getting started
summary: What Audiodiver does, what a project is, and what each tab is for.
---

Audiodiver replaces Helldivers 2 audio by **what it is and where it plays**. Find a piece of music or a set of sounds in the Library, add it to a project and give it new audio. Audiodiver then works out the sound banks, ids and timing values the game needs.

[Game audio, explained](wiki:game-audio) covers archives, banks, takes, cues, segments and slots. [Reading the screen](wiki:reading-the-screen) describes every part of the window.

## Projects

A project is a folder named after the project, with a `.audi` file in it. The file records what the mod changes, which files replace which clips, and the Make-Up Gain and timing. Audio files are in that folder, or the project stores their paths. [Project folders](wiki:project-folders) covers what is in it.

Changes are saved automatically. {key:save} saves at any time, and {key:undo} undoes the last change.

Audiodiver never writes to the game folder. It reads the game audio from the Steam library, or from another folder chosen under **Game** in [Settings](app:settings/system). A build produces a ZIP that a mod manager imports and installs.

## The tabs

The tab bar along the top of the window holds the main tabs. Home and Tools come first. The darker band after them holds the tabs for the open project in the order a mod is made, starting with Project, which shows the project icon. Build comes after the band and shows while a project is open. Hover over a tab to see what it holds and the shortcut. **Tab bar** in [Settings ▸ Theme](app:settings/theme) moves the bar to another side of the window and shows or hides tab names.

- {icon:home} **Home** starts a new project or opens one, and leads to Repatch and Combine.
- {icon:tools} **Tools** works on existing mods, without a project. [Repatch](wiki:repatching) rebuilds a mod for the current game version, and [Combine Mods](wiki:combining-mods) makes one mod out of several. Both produce a new ZIP.
- {icon:project} **Project** holds the mod name, description, icon and id, the tabs the project shows, and the project folder, with **Import patches…** and **Close project** over the icon. With no project open, it lists the recent projects. The tab shows the project icon and name.
- {icon:library} **Library** lists everything the game plays, so you can find it and listen to it. Browsing changes nothing. **Add to the project** puts an entry in the project. **Index** sorts the audio that has a name, and **All Archives** lists every archive that contains audio.
- {icon:audio} **Audio** shows the slots of what the project works on. Slots get new audio here.
- {icon:soundtrack} **Soundtrack** sets how each piece of music plays: in the original order, as one song, as a playlist, or silent. See [Soundtrack](wiki:soundtrack).
- {icon:text} **Text** has all in-game text in every language, including subtitles. See [Text and subtitles](wiki:text).
- {icon:build} **Build** holds the next version, the Build options and the Build button. A dot on the tab means the project isn't built yet, or it changed or the game updated since the last build. A red number counts the problems that block a build.
- {icon:updates} **Updates**, {icon:wiki} **Wiki** ({key:wiki}) and {icon:settings} **Settings** are at the end of the tab bar. Updates is highlighted when a new version of Audiodiver is available, and it lists the changes in every version. On a Wiki page, {key:search} finds words on that page.

The version number at the right end of the status bar also opens Updates. The {icon:info} button next to it opens [About](app:about), with the licence, the log file and the credits.

The window title is the name of the open project.

The Library and the Audio tab share the same layout, and both have {icon:export} **Export**. Find something in the Library and work on it in the Audio tab.

## Tabs

Audio, Soundtrack and Text can be hidden. Untick them under **Tabs** in [Settings ▸ System](app:settings/system), for example to keep only Text for a mod that changes subtitles. A new project starts with the tabs that Settings shows. Each project can then pick different ones under **Tabs** on the [Project](app:project) tab and keeps that choice. Hiding a tab removes nothing, and what was changed there stays in the mod.

## New versions of Audiodiver

Audiodiver checks GitHub for a new version every time it starts. [Settings ▸ System](app:settings/system) controls what happens when there is one:

- **Prompt on startup** (the default) asks first, with **Update now**, **Read the changelog** and **Not now**.
- **Manual** doesn't ask. The Updates tab and the version in the status bar are highlighted, and **Update now** is on the Updates tab.
- **Automatic** installs the new version at startup and restarts Audiodiver.

An update replaces only the app. Projects, audio files and settings are kept.

## Settings

### Game folder

**Game** in [Settings ▸ System](app:settings/system) shows the folder Audiodiver reads the game from. Audiodiver finds it through Steam. If the game is somewhere else, press **Choose another folder…** and pick the Helldivers 2 install folder, or the `data` folder inside it. Audiodiver then reads the game again, which takes about a minute the first time. It only reads from this folder and never writes to it.

### Startup

With **Open the last project when Audiodiver starts** on, Audiodiver opens the last project on the Audio tab. With it off, Audiodiver starts on Home.

### Disk space

Audiodiver keeps prepared copies of audio so that it doesn't prepare the same audio twice. **Previews** are the decoded originals, the waveforms and the Play through renders. **Encoded audio** is new audio converted for the game, which builds reuse. Clearing either one is safe. Audiodiver prepares the copies again when needed. Projects and audio files are never stored there.
