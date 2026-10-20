---
title: Building and installing
group: Building and sharing
summary: What a build makes, how to install it with HD2 Arsenal, and how updates reach the installed mod.
---

## Building

On [Build](app:build), press **Build** ({key:build}). Audiodiver converts the new audio for the game and patches every sound bank that holds or plays the replaced sounds. It then checks the result and packs it into a ZIP named after the mod and its version.

The ZIP goes into the `build` folder next to the project file. To send a mod's builds to another folder, press **Change…** under the Build button. **Back to the default** returns to the project's `build` folder. A build adds only the ZIP, so several mods can share one folder. Audiodiver doesn't build into the game's folder.

Building changes nothing else. The project, the audio files and the game stay the same.

If the project has problems, such as a missing file or a name that Arsenal can't use, the Build button is disabled. The tab lists the problems to fix above the button.

## Installing with HD2 Arsenal

HD2 Arsenal is the mod manager that Audiodiver builds for.

1. Import the ZIP in Arsenal.
2. Deploy the mods in Arsenal.
3. Start the game and go to a place where the new music plays.

> [!WARNING]
> Don't copy patch files into the game's `data` folder by hand. Arsenal numbers the patches of all mods when it deploys them. A patch copied by hand gets overwritten, or it overrides another mod.

## Two mods that change the same bank

A mod contains complete copies of the sound banks it changes. If two mods change the same bank, their changes don't combine. The mod that HD2 Arsenal deploys later replaces the other mod's copy of the bank. Music mods share most of their banks, so two music mods can't be used together, whichever tool made them.

### Music that stays silent on some planets

On seven types of planet (swamp, deciduous, coniferous, desert, oasis, hive worlds and Illuminate rifts), the game is missing a version of the music for the first minutes of a mission. After a drop, the music stays silent until its intensity changes, which can take minutes, and some drop music doesn't play at all.

**Fix music that stays silent on some planets**, under When building, adds a fix to the `music_init` bank, which almost every music build includes. Those planets then play the default version of the music. It is off for new projects. The fix comes from the **Sound Systems Rebalanced** mod and was made for an older game version. Where it no longer fits the game's banks, the build goes on without it and the build log says so.

With the fix on, deploy the music mod **after** Sound Systems Rebalanced if you use both. The two mods then carry the fix whichever loads last, and the music timing and Make-Up Gain stay as you built them.

## Updating

After each build, the version number goes up by one. You can turn this off under **When building**. Import the new ZIP in Arsenal. The mod keeps the same id, so Arsenal replaces the installed version and doesn't add another copy. Deploy again and restart the game.

## What Arsenal shows

The [Build](app:build) tab sets the name, the description and the icon, and previews the icon as Arsenal displays it. Use only letters, digits and spaces in the name, and leave the version out. Arsenal keeps the name from the first import. An icon is cropped to a square and resized to 540 × 540.
