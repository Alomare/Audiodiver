---
title: Combining mods
group: Building and sharing
summary: Making one mod out of several audio mods that change the same sound banks, choosing whose version of each shared sound goes in.
---

A mod contains complete copies of the sound banks it changes. When two mods change the same bank, the one deployed later replaces the other's copy, so only one of them plays. Music mods share most of their banks, and so do many weapon and voice mods. **Combine Mods**, on [Tools](app:tools/combine), reads several mods and builds one mod with the audio of all of them, on the current sound banks.

## When to use it

- Two mods you want together change the same banks, and only the one deployed last plays.
- Several small mods are easier to keep and update as one.

## Combining mods

1. Open [Tools ▸ Combine Mods](app:tools/combine).
2. Drop the mods on the page. You can drop the downloaded ZIPs, the mod folders, or the `.patch_0` files with the `.stream` files next to them. **Add ZIPs or patch files…** and **Add a folder…** do the same, and **Installed mods…** lists the mods in a mod manager's library and the game folder.
3. Choose the options for each mod. A mod with options lists them under the mod name, starting from the choices that the mod manager recorded. An option with several choices takes one of them.
4. Put the mods in order with ↑ and ↓. See [Order and conflicts](#order-and-conflicts).
5. Press **Check for conflicts**, and choose a mod for each conflict it finds.
6. Check the name, then press **Combine**.

After a check, changing the list, the order or the options requires another check before **Combine** works. A second check is quick, because Audiodiver keeps what it read from each mod.

## Order and conflicts

A conflict is a sound that more than one mod changes in different ways. The mods give the same clip different audio, or set the same setting, such as a sound's volume, to different values. Mods that give a clip the same audio don't conflict. New takes and layers that several mods add to the same sound are all kept.

Conflicts are grouped by their item in the Index, such as a piece of music or a weapon. Each line plays the original first, then the version from each mod. The highlighted mod goes in. **All from** on an item's line picks one mod for every conflict in that item. By default the mod lower in the list wins, as if it were deployed later.

A setting on a sound in conflict follows the sound, so the mod whose audio goes in also brings the volume set on that sound. Cue points follow the audio the same way: a music segment takes the cue points of the mod whose audio it plays.

## Destination folder

The new ZIP goes into the **Destination folder**. The default location is `Documents\Audiodiver\Combined`, and **Change…** picks another. If a ZIP with the same name is already there, it stays, and the new one gets a number.

After a game update, combine the mods again. To change the audio further, make a project and import the combined patch into it, as [When the game updates](wiki:game-updates#mods-made-with-older-tools) explains. A project takes only the audio.

## What combining leaves out

- Changes Audiodiver doesn't carry over, such as effects or how a container picks sounds, and sounds a mod still has from an older game version. The result lists them for each mod, as [Repatch](wiki:repatching#what-repatching-leaves-out) does.
- A file besides audio, such as a texture or a string table, that two mods both have: the copy of the mod higher in the list. The copy of the lower mod goes in, as if that mod were deployed later, and the result notes this.

Everything else in the patches, such as text, models and textures, goes in as it was.

## Installing the result

The combined mod is a new mod with a new ID. In the mod manager, turn off the mods it combines, then import the new ZIP and deploy it. A combined mod is still the work of the original authors, so keep it for personal use, and share it only with their permission.
