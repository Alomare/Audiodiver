---
title: How Audiodiver works
group: Getting started
summary: What Audiodiver does, what a project is, and what each tab is for.
---

Audiodiver replaces Helldivers 2 audio by **what it is and where it plays**, not by the ids in the game files. Find a piece of music or a set of sounds in the Library, add it to a project, give it new audio, and Audiodiver works out every sound bank, id and timing value the game needs.

New to the game's audio? [The game's audio, explained](wiki:game-audio) covers archives, banks, takes, cues, segments and slots, and [Reading the screen](wiki:reading-the-screen) every part of the window.

## Projects

A project is one `.audi` file. It records what the mod works on and which files replace which of the game's clips, with Make-Up Gain and timing. Audio files stay where they are: keep them next to the project file and the whole folder can move.

Every change saves itself, {key:save} saves on demand, and {key:undo} takes a change back.

Audiodiver never writes to the game. It reads the game's audio from the Steam library (another folder can be chosen under **Game** in [Settings](app:settings/system)), and a build writes a ZIP for **HD2 Arsenal**, the mod manager that installs it.

## The tabs

The master tabs are the icons down the left of the window; hover one for its name and key.

- {icon:home} **Home**: new, open and recent projects.
- {icon:library} **Library**: everything the game plays, to find and hear. It changes nothing. **Index** sorts what has a name; **All Archives** lists every archive with audio. **Add to the project** puts something in the project.
- {icon:audio} **Audio Editor**: what the project works on. This is where slots get new audio.
- {icon:text} **Text Editor**: the game's text in every language, subtitles included. See [The game's text and subtitles](wiki:text).
- {icon:build} **Build**: what HD2 Arsenal shows for the mod, and the Build button. A red number counts the problems that stop a build.
- {icon:updates} **Updates**, {icon:wiki} **Wiki** ({key:wiki}) and {icon:settings} **Settings**, at the bottom. Updates lights up when a new version of Audiodiver is out, and lists every version's changes.

The version, at the right end of the status bar, opens Updates too. The {icon:info} next to it opens [About](app:about): the licence, the log file and the credits.

The open project's name is the window's title.

The Library and the Audio Editor look alike on purpose: find something in one, work on it in the other. **Export…** is in both.

## New versions of Audiodiver

Audiodiver looks for a new version on GitHub each time it starts. [Settings ▸ System](app:settings/system) says what happens when there is one:

- **Prompt on startup** (the default): it asks, with **Update now**, **Read the changelog** and **Not now**.
- **Manual**: it doesn't ask. The Updates tab and the version in the status bar light up, and **Update now** is in the Updates tab.
- **Automatic**: it installs the new version at startup and opens again on it.

An update replaces Audiodiver itself. Projects, audio files and settings stay where they are.

Next: [A first mod](wiki:first-mod).
