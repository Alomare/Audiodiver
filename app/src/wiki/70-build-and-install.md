---
title: Building and installing
group: Building and sharing
summary: What a build makes, how to install it with HD2 Arsenal, and how updates reach the installed mod.
---

## Building

On [Build](app:build), press **Build** ({key:build}). Audiodiver converts the new audio for the game and patches the sound banks that hold or play the replaced sounds ([which ones](#every-bank-with-the-sounds)). It then checks the result and packs it into a ZIP named after the mod and its version.

Building changes nothing else. The project, the audio files and the game stay the same.

If the project has problems, such as a missing file or a name that Arsenal can't use, the Build button is disabled. The tab lists the problems to fix above the button.

### Destination folder

The ZIP goes into the `build` folder next to the project file. To send a mod's builds to another folder, press **Change…** under **Destination folder**. **Back to the default** returns to the project's `build` folder. A build adds only the ZIP, so several mods can share one folder. Audiodiver doesn't build into the game's folder.

## What Arsenal shows

The [Project](app:project) tab previews the icon, the name and the description as Arsenal displays them.

### Name and description

Use only letters, digits and spaces in the name, and leave the version out. Arsenal keeps the name from the first import, so choose it before you share the mod. The description is optional, and Arsenal shows it with the mod.

### Version

**Next version** is the number in the next ZIP's name. It goes up by one after each build, unless **Raise the version after each build** is off.

### Icon

The icon is the default Audiodiver icon until you choose an image. An image is cropped to a square around its centre and resized to 540 × 540, the size Arsenal uses. You can also drop an image on the preview. **Border**, **Border colour** and **Corners** frame the icon, whichever image it shows.

### Mod id

Arsenal recognises a mod by its id. As long as the id stays the same, a new build updates the installed mod. When you copy a project to make a different mod, press **Make a new id**. Arsenal then installs the copy's builds as a separate mod.

## Build options

These settings are under **Build options** on the Build tab.

- **Raise the version after each build** makes Arsenal see every build as an update. It applies to all projects.
- **Show the ZIP in its folder when a build finishes** opens the folder in Explorer.

### Wwise loudness analysis

**Add Wwise loudness analysis** adds the loudness data that the game's audio files carry. It makes no audible difference. It needs Wwise installed on the computer, and it makes builds slower. The setting applies to the open project.

### Every bank with the sounds

A sound is often in more than one sound bank. A clip that several weapons share is in each of their banks, and some are in a hundred. By default, a build patches only the banks of the sound sets, music and archives in the project's list. The mod stays small, as mods made with other tools are.

**Patch every bank with the sounds** puts the new audio into every bank that has the sounds. It then plays wherever the game uses them, also for a weapon the project doesn't list. The mod gets bigger, sometimes by hundreds of megabytes. Turn it on if the game's audio still plays where you expected yours. The setting applies to the open project.

Some sounds go into every bank either way:

- Music. Every mission's music bank has copies of the music of every faction, and `music_init` has copies of much of it. The game uses the first copy it loads. A copy with the old timing would play the new audio for the old length, so the music would cut off or go silent.
- The banks that hold the start of a streamed sound, such as a voice line. Each one gets the new start, so the old audio never plays before the new.
- A sound that no bank on the list has.

A project that you imported a mod into also counts the banks that mod patched as its own. On [Tools ▸ Repatch](app:tools/repatch), the same checkbox applies to the repatched mod. With it off, the mod's audio goes only into the banks the mod patched.

## Installing with HD2 Arsenal

HD2 Arsenal is the mod manager that Audiodiver builds for.

1. Import the ZIP in Arsenal.
2. Deploy the mods in Arsenal.
3. Start the game and go to a place where the new music plays.

> [!WARNING]
> Don't copy patch files into the game's `data` folder by hand. Arsenal numbers the patches of all mods when it deploys them. A patch copied by hand gets overwritten, or it overrides another mod.

## Two mods that change the same bank

A mod contains complete copies of the sound banks it changes. If two mods change the same bank, their changes don't combine. The mod that HD2 Arsenal deploys later replaces the other mod's copy of the bank. Music mods share most of their banks, so two music mods can't be deployed together, whichever tool made them. [Combine Mods](wiki:combining-mods) makes one mod out of them, with the audio of both.

## Updating

Import the new ZIP in Arsenal. The mod keeps the same id, so Arsenal replaces the installed version and doesn't add another copy. Deploy again and restart the game.
