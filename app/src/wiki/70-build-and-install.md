---
title: Building and installing
group: Building and sharing
summary: What a build makes, how to install it with a mod manager, and how updates reach the installed mod.
---

## Building

On [Build](app:build), press **Build** ({key:build}). Audiodiver converts the new audio for the game and patches the sound banks that hold or play the replaced sounds ([which ones](#every-bank-with-the-sounds)). It then checks the result and packs it into a ZIP named after the mod name and version.

Building doesn't change the project, the audio files or the game.

If the project has problems, such as a missing file or a name that mod managers can't use, the Build button is disabled. The tab lists the problems above the button.

### Destination folder

The ZIP goes into the `build` folder next to the project file. To build into another folder, press **Change…** under **Destination folder**. **Back to the default** returns to the `build` folder. A build adds only the ZIP, and the [patch files](#patch-files) when you turn them on, so several mods can share one folder. Audiodiver doesn't build into the game folder.

## What the mod manager shows

The [Project](app:project) tab previews the icon, the name and the description as a mod manager displays them.

### Name and description

Use only letters, digits and spaces in the name, and leave the version out. The mod manager keeps the name from the first import, so choose it before sharing the mod. The description is optional and appears with the mod.

### Version

**Next version** is the number in the next ZIP's name. It goes up by one after each build, unless **Raise the version after each build** is off.

### Icon

The icon is the default Audiodiver icon until you choose an image. An image is cropped to a square around the centre and resized to 540 × 540, the size mod managers use. You can also drop an image on the preview. **Border**, **Border colour** and **Corners** frame the icon, default or chosen.

### Mod id

A mod manager recognises a mod by the mod id. While the id stays the same, a new build updates the installed mod. When you copy a project to make a different mod, press **Make a new id**, and the copy installs as a separate mod.

To make the builds update a mod you made before, press **Change…** and paste the id of that mod: the `Guid` in the `manifest.json` of the mod. Undo puts the old id back.

## Build options

These settings are under **Build options** on the Build tab.

- **Raise the version after each build** gives each build a new ZIP name, and the earlier ZIPs stay. With it off, the next build replaces the last ZIP. The [mod id](wiki:build-and-install#mod-id), not the version, decides whether a mod manager takes a build as an update. The setting applies to all projects.
- **Show the ZIP in Explorer when a build finishes** opens Explorer with the ZIP selected.

### Patch files

**Also save the patch files in a folder** puts the mod's patch files next to each ZIP, in a folder with the same name as the ZIP. They are the `.patch_0` file and, when the mod has streamed audio, the `.patch_0.stream` file. Use them to pack the mod yourself, for example in a 7z archive with a manifest of your own. To install them, pack them for a mod manager rather than copying them into the game folder ([Installing](#installing)). The setting applies to the open project.

A build has a `.patch_0.gpu_resources` file only when the project carries an imported mod's textures or models. Audio needs none.

### Wwise loudness analysis

**Add Wwise loudness analysis** adds the loudness data that original audio files carry. It makes no audible difference. It needs Wwise installed and makes builds slower. The setting applies to the open project.

### Every bank with the sounds

A sound is often in more than one sound bank. A clip that several weapons share is in the bank of each weapon, and some clips are in a hundred banks. By default, a build patches only the banks of the sound sets, music and archives in the project's list. This keeps the mod small, like mods made with other tools.

**Patch every bank with the sounds** puts the new audio into every bank that has the sounds. The new audio then plays wherever the sounds are used, also for a weapon the project doesn't list. The mod gets bigger, sometimes by hundreds of megabytes. Turn it on if the original still plays where the new audio should. The setting applies to the open project.

Some sounds go into every bank either way:

- Music. Every mission's music bank has copies of the music of every faction, and `music_init` has copies of much of it. The game uses the first copy it loads. A copy with the old timing would play the new audio for the old length, so the music would cut off or go silent.
- The banks that hold the start of a streamed sound, such as a voice line. Each one gets the new start, so the original never plays before the new audio.
- A sound that no bank on the list has.

A project with an imported mod also counts the banks that mod patched. On [Tools ▸ Repatch](app:tools/repatch), the same checkbox applies to the repatched mod. With it off, the audio goes only into the banks the mod patched.

## Installing

Builds are ZIPs in the shared manifest format that Helldivers 2 mod managers import.

1. Import the ZIP in the mod manager.
2. Deploy the mods.
3. Start the game and go to a place where the new music plays.

> [!WARNING]
> Don't copy patch files into the game's `data` folder by hand. The mod manager numbers the patches of all mods when deploying them. A patch copied by hand gets overwritten, or it overrides another mod.

## Two mods that change the same bank

A mod contains complete copies of the sound banks it changes. If two mods change the same bank, their changes don't combine. The mod deployed later replaces the other's copy of the bank. Music mods share most of their banks, so two music mods can't be deployed together, whichever tool made them. [Combine Mods](wiki:combining-mods) makes one mod out of them, with the audio of both.

## Updating

Import the new ZIP in the mod manager. With the same id, it replaces the installed version and doesn't add another copy. Deploy again and restart the game.
