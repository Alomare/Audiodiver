---
title: Repatching
group: Building and sharing
summary: Rebuilding an audio mod that was made for an older version of the game, or with another tool, against the current game.
---

A mod's patch contains complete copies of the sound banks it changes, as they were in the game version the mod was made for. After a game update, those copies are out of date. The mod can go silent or play the wrong sounds, and while it is installed it rolls the game's newer audio back. **Repatch**, on [Build](app:build/repatch), rebuilds such a mod against the current game. You don't need a project or any modding experience to use it.

## When to use it

- A mod's sounds went silent, wrong or missing after a game update, and its author hasn't updated it.

## Repatching a mod

1. Open [Build ▸ Repatch](app:build/repatch).
2. Drop the mod on the page. You can drop the ZIP you downloaded, the mod's folder, or its `.patch_0` file with its `.stream` file next to it. **Choose a ZIP or patch file…** and **Choose a folder…** do the same. A ZIP dropped anywhere in Audiodiver also opens on this page.
3. Check the name. Audiodiver takes it from the mod's manifest if the mod has one, and otherwise from the file or folder name.
4. Press **Repatch**.

Some mods have several options, with one patch for each option. A mod like this stays one mod with the same options. The page lists its patches, and Audiodiver rebuilds each one in its original place.

## What repatching carries over

- The audio that the mod replaces, and the audio it adds. Added audio can be new takes for a sound, a sound that plays with another sound, or a separate clip for one sound.
- The mod's sound settings. These include the volume (Make-Up Gain) of a sound or a container, a delay before it plays, how much of it goes to the game's reverb, and similar settings.

Audiodiver applies all of this to the game's current sound banks and builds a new ZIP of the same mod. The fix for music that stays silent on some planets (see [Building and installing](wiki:build-and-install)) is off. To add it, open the project, turn it on under When building, and build again.

If the mod has a mod manager manifest, the new ZIP keeps everything else from the original. That includes the name, the description, the icon, the options, the files next to the patches, and the mod's id. Because the id stays the same, importing the new ZIP in Arsenal updates the old mod and doesn't add another copy. Only the patches are new. The mod's audio goes in exactly as it was, without being converted again, so it sounds the same.

Each repatched mod gets a folder under **Where it goes**. The default location is `Documents\Audiodiver\Repatched`, and **Change…** picks another. The folder holds the new ZIP and one project for each patch, with the audio extracted from the patch in an `imported` folder. **Open as project** opens a project in the [Audio Editor](app:editor), where you can change it further and build it from [Build](app:build). If the mod had several options, each option built this way becomes a separate mod.

## What repatching leaves out

Repatching carries over audio and sound settings. After each repatch, the page lists what it left out:

- **Other kinds of change.** A mod's copy of a bank can also have different effects or positioning, a different way for a container to pick its sounds, or missing objects. Most of these differences are the game's banks as they were when the mod was made, before later updates changed them, so Audiodiver leaves them out. Where Audiodiver knows a difference from an earlier game version, it doesn't list it. If the repatched mod sounds different, compare it with the old version in game.
- **Text that the mod changes.** Repatching doesn't support text yet. For example, a voice mod's new subtitles are left out, and the game shows its normal subtitles. The page tells you when a patch contains text.
- **Anything else in the patch besides sound banks.** A patch that also contains models or textures loses them. The page tells you when this happens.

The sound settings are copied from the mod as they were. One of them may override a value that the game has changed since, and the old mod overrode it in the same way.

> [!NOTE]
> Audiodiver keeps track of what each game update changes, starting with the update of 20 October 2026. For a mod made before that update, some items under **Left out** and some of the copied settings can be the game's own values from that time, not changes the mod made.

In a mod with several options, a patch that can't be repatched stays in the ZIP unchanged, and the page tells you which one. This happens when a patch contains no sound or can't be read.

## Sounds from an older game version

A mod's copies of the sound banks still contain every sound the game had when the mod was made. When a later update removes some of those sounds, the mod's copies make them look like sounds the mod added. Repatching them in would bring the removed sounds back as extra takes, and they would play beside the current ones.

Audiodiver recognizes these sounds and leaves them out. The page then says how many it left out. They were never part of the mod, so the repatched mod still has everything its author made. [Importing a mod's patch](wiki:game-updates) into a project leaves them out in the same way.

Audiodiver recognizes them in two ways:

- It remembers which sounds earlier game versions had in each bank.
- A sound that the mod added plays new audio. A sound that plays audio the current game still has is one of the game's own.

If the mod replaced the audio of a sound that the game has since removed, there is nothing left to put that audio on, and the repatched mod plays the current game's sounds there.

## Installing the result

In HD2 Arsenal, import the new ZIP. If the page says the mod kept its id, the new ZIP replaces the old mod. Otherwise, remove the old mod first.

> [!NOTE]
> A repatched mod is still its author's work. Keep it for personal use, and share it only with the author's permission. Better still, point the author to Audiodiver so they can update the mod themselves.
