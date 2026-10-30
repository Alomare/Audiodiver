---
title: How Audiodiver works
group: Getting started
summary: What Audiodiver does, what a project is, and what each tab is for.
---

Audiodiver replaces Helldivers 2 audio by **what it is and where it plays**. Find a piece of music or a set of sounds in the Library, add it to a project and give it new audio. Audiodiver then works out the sound banks, IDs and timing values the game needs.

[Game audio, explained](wiki:game-audio) covers archives, banks, takes, cues, segments and slots. [Reading the screen](wiki:reading-the-screen) describes every part of the window.

## Projects

A project is a folder named after the project, with a `.audi` file in it. The file records what the mod changes, which files replace which clips, and the Make-Up Gain and timing. Audio files are in that folder, or the project stores their paths. [Project folders](wiki:project-folders) covers what is in it.

Changes are saved automatically, as they are made or every few minutes ([Autosave](wiki:how-audiodiver-works#autosave)). {key:save} saves at any time, and {key:undo} undoes the last change.

Audiodiver never writes to the game folder. It reads the game audio from the Steam library, or from another folder chosen under **Game** in [Settings](app:settings/system). A build produces a ZIP that a mod manager imports and installs.

## The tabs

The tab bar along the top of the window holds the main tabs. Home and Tools come first. The darker band after them holds the tabs for the open project in the order a mod is made, starting with Project, which shows the project icon. Build comes after the band and shows while a project is open. Hover over a tab to see what it holds and the shortcut. **Tab bar** in [Settings ▸ Theme](app:settings/theme) moves the bar to another side of the window and shows or hides tab names.

- {icon:home} **Home** starts a new project or opens one, and leads to Repatch and Combine.
- {icon:tools} **Tools** works on existing mods, without a project. [Repatch](wiki:repatching) rebuilds a mod for the current game version, and [Combine Mods](wiki:combining-mods) makes one mod out of several. Both produce a new ZIP.
- {icon:project} **Project** holds the mod name, description, icon and ID, the tabs the project shows, and the project folder, with **Import Patches** and **Close Project** over the icon. With no project open, it lists the recent projects. The tab shows the project icon and name.
- {icon:library} **Library** lists everything the game plays, so you can find it and listen to it. Browsing changes nothing. **Add to the Project** puts an entry in the project. **Index** sorts the audio that has a name, and **All Archives** lists every archive that contains audio.
- {icon:audio} **Audio** shows the slots of what the project works on. Slots get new audio here.
- {icon:soundtrack} **Soundtrack** sets how each piece of music plays: in the original order, as one song, as a playlist, or silent. See [Soundtrack](wiki:soundtrack).
- {icon:text} **Text** has all in-game text in every language, including subtitles. See [Text and subtitles](wiki:text).
- {icon:build} **Build** holds the next version, the Build options and the Build button. A dot on the tab means the project isn't built yet, or it changed or the game updated since the last build. A red number counts the problems that block a build.
- {icon:updates} **Updates**, {icon:wiki} **Wiki** ({key:wiki}) and {icon:settings} **Settings** are at the end of the tab bar. Updates is highlighted when a new version of Audiodiver is available, and it lists the changes in every version. On a Wiki page, {key:search} finds words on that page.

The {icon:detach} button beside the guides' search box moves the Wiki into a separate window, to read beside a project. The Wiki tab then shows **Bring the Wiki Back**, and closing the window does the same. While the Wiki is in that window, a **?** or a link to a page opens there. Starting a tutorial brings the Wiki back first.

The version number at the right end of the status bar also opens Updates. The {icon:info} button next to it opens [About](app:about), with the licence, the log file and the credits.

The window title is the name of the open project.

The Library and the Audio tab share the same layout, and both have {icon:export} **Export**. Find something in the Library and work on it in the Audio tab.

## Tabs

Audio, Soundtrack and Text can be hidden. Untick them under **Tabs** in [Settings ▸ System](app:settings/system), for example to keep only Text for a mod that changes subtitles. A new project starts with the tabs that Settings shows. Each project can then pick different ones under **Tabs** on the [Project](app:project) tab and keeps that choice. Hiding a tab removes nothing, and what was changed there stays in the mod.

## New versions of Audiodiver

Audiodiver checks GitHub for a new version every time it starts. [Settings ▸ System](app:settings/system) controls what happens when there is one:

- **Prompt on Startup** (the default) asks first, with **Update Now**, **Read the Changelog** and **Not Now**.
- **Manual** doesn't ask. The Updates tab and the version in the status bar are highlighted, and **Update Now** is on the Updates tab.
- **Automatic** installs the new version at startup and restarts Audiodiver.

An update replaces only the app. Projects, audio files and settings are kept.

## Settings

### Language

**Language** in [Settings ▸ System](app:settings/system) sets the language of the window and of the messages Audiodiver shows. **Automatic** takes the language Helldivers 2 is set to in Steam. When Audiodiver has no translation for it, Automatic takes the language of Windows, and otherwise English. After a change the window loads again in the new language, on the same tab. Subtitles and voice lines from the game stay as they are, and the Text tab still chooses which language of the game text to edit.

### Game folder

**Game** in [Settings ▸ System](app:settings/system) shows the folder Audiodiver reads the game from. Audiodiver finds it through Steam. If the game is somewhere else, press **Choose Another Folder** and pick the Helldivers 2 install folder, or the `data` folder inside it. Audiodiver then reads the game again, which takes about a minute the first time. It only reads from this folder and never writes to it.

### Startup

With **Open the last project when Audiodiver starts** on, Audiodiver opens the last project on the Audio tab. With it off, Audiodiver starts on Home.

### Home

With **Show the news ticker** off, Home doesn't show the strip of war news along the bottom, and the news isn't loaded.

### Autosave

**Autosave** sets when changes go into the project file. **With Each Change**, the default, saves every change as it is made. **On a Timer** saves every 1 to 30 minutes instead, and until then the status bar says *Unsaved changes*. A build, closing the project and closing Audiodiver save the changes first. {key:save} saves at any time.

### Notifications

**Corner** under **Notifications** in [Settings ▸ System](app:settings/system) sets the corner of the window where notices appear. **Bottom Right** is the default.

### Global notes

**Global Notes** in [Settings ▸ System](app:settings/system) shows the notes file, which starts in the folder of Audiodiver's settings. **Choose Another Folder** keeps the notes in another one, such as a folder synced between two computers. When that folder has a notes file already, the notes in it and these come together, and a thing with a different note in each keeps both texts. **Use the Default Folder** goes back. The file in the old folder stays as it was.

**Export Notes** saves the global notes, the notes of the open project or both, either as a Markdown document to read, with each note under the name of what it is on, or as a JSON notes file. **Import Notes** brings the notes of such a JSON file, or of a project file, into the global notes.

### Disk space

Audiodiver keeps prepared copies of audio so that it doesn't prepare the same audio twice. **Previews** are the decoded originals, the waveforms and the Play through renders. **Encoded audio** is new audio converted for the game, which builds reuse. Clearing either one is safe. Audiodiver prepares the copies again when needed. Projects and audio files are never stored there.
