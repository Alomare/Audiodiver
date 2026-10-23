---
title: Combining mods
group: Building and sharing
summary: Making one mod out of several audio mods that change the same sound banks, choosing whose version of each shared sound goes in.
---

A mod contains complete copies of the sound banks it changes. When two mods change the same bank, the one HD2 Arsenal deploys later replaces the other's copy whole, so only one of them plays. Music mods share most of their banks, and so do many weapon and voice mods. **Combine Mods**, on [Tools](app:tools/combine), reads several mods and builds one mod with the audio of all of them, on the current game's sound banks.

## When to use it

- Two mods you want together change the same banks, and only the one deployed last plays.
- Several small mods are easier to keep and update as one.

## Combining mods

1. Open [Tools ▸ Combine Mods](app:tools/combine).
2. Drop the mods on the page. You can drop the ZIPs you downloaded, the mods' folders, or their `.patch_0` files with the `.stream` files next to them. **Add ZIPs or patch files…** and **Add a folder…** do the same, and **Installed mods…** lists the mods in HD2 Arsenal's library and the game's folder.
3. Choose each mod's options. A mod with options lists them under its name, as Arsenal does. An option with choices of its own takes one of them.
4. Put the mods in order with ↑ and ↓. See [Order and conflicts](#order-and-conflicts).
5. Press **Check for conflicts**, and choose a mod for each conflict it finds.
6. Check the name, then press **Combine**.

Changing the list, the order or the options after a check asks for another check before **Combine** works. A second check is quick, because Audiodiver keeps what it read from each mod.

## Order and conflicts

A conflict is a sound that more than one mod changes in different ways: each gives the same clip other audio, or sets the same setting, such as a sound's volume, to a different value. Mods that give a clip the same audio don't conflict. New takes and layers that several mods add to the same sound are all kept.

Conflicts are listed by the item the Index has them in, like a piece of music or a weapon. Each line plays the original first, then each mod's version, and the highlighted mod is the one that goes in. **All from** on an item's line picks one mod for all of its conflicts. By default the mod lower in the list wins, as it would if Arsenal deployed it later.

A setting on a sound in conflict follows the sound: the mod whose audio goes in also brings its volume.

## Destination folder

Each combined mod gets a folder in the **Destination folder**. The default location is `Documents\Audiodiver\Combined`, and **Change…** picks another. The folder holds a project with the audio of the sounds that went in, in `audio\imported`, and the new ZIP in `build`. **Open as project** opens the project in the [Audio Editor](app:editor) to change it further, and [Build](app:build) builds it again, also after a game update.

## What combining leaves out

- Text the mods change, such as subtitles.
- Anything a patch holds besides sound banks, such as models or textures.
- Changes Audiodiver doesn't carry over, such as effects or how a container picks its sounds, and sounds a mod still has from an older game version. The result lists them for each mod, as [Repatch](wiki:repatching#what-repatching-leaves-out) does.

## Installing the result

The combined mod is a new mod with an id of its own. In Arsenal, turn off the mods it combines, then import the new ZIP and deploy it. A combined mod is still its authors' work, so keep it for personal use, and share it only with their permission.
