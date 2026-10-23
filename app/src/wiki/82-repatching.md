---
title: Repatching
group: Building and sharing
summary: Rebuilding an audio mod that was made for an older version of the game, or with another tool, against the current game.
---

A mod's patch contains complete copies of the sound banks it changes, as they were in the game version the mod was made for. After a game update, those copies are out of date. The mod can go silent or play the wrong sounds, and while it is installed it rolls the game's newer audio back. It can even silence sounds it never changed, because its banks also carry settings that many other banks share. **Repatch**, on [Tools](app:tools/repatch), rebuilds such a mod against the current game. You don't need a project or any modding experience to use it.

## When to use it

- A mod's sounds went silent, wrong or missing after a game update, and its author hasn't updated it.
- Other sounds, like all gunfire, go silent while the mod is installed. See [Shared settings from an older game version](#shared-settings-from-an-older-game-version).

## Repatching a mod

1. Open [Tools ▸ Repatch](app:tools/repatch).
2. Drop the mod on the page. You can drop the ZIP you downloaded, the mod's folder, or its `.patch_0` file with its `.stream` file next to it. **Choose a ZIP or patch file…** and **Choose a folder…** do the same. A ZIP dropped anywhere in Audiodiver also opens on this page.
3. Check the name. Audiodiver takes it from the mod's manifest if the mod has one, and otherwise from the file or folder name, without the numbers and dates that Nexus Mods adds to a download's name.
4. Tick **Patch every bank with the sounds** if the mod's audio should play wherever the game uses its sounds. Left off, the mod's audio goes only into the banks the mod patched, as in the original, and the mod stays about the same size. [More about it](wiki:build-and-install#every-bank-with-the-sounds).
5. Press **Repatch**.

The page then sums up the result: what was carried over, what was kept as it was, and what was left out. **Show all** lists every patch and the log. **Repatch another mod** clears the page for the next one.

Some mods have several options, with one patch for each option. A mod like this stays one mod with the same options. The page counts its patches, and Audiodiver rebuilds each one that holds audio in its original place. A patch without audio, such as an option that only changes a texture, stays as it is. **Show all** lists them one by one.

Some mods have several patch files in one folder, such as `.patch_0`, `.patch_1` and `.patch_2`. The game loads them over each other as one mod. Audiodiver reads them in the same order and builds them into one patch.

## Checking installed mods

**Installed mods**, at the bottom of the Repatch page, finds the mods that need a repatch. **Check installed mods** looks through the mods in HD2 Arsenal's library, deployed or not, and the patch files in the game's `data` folder. It lists every mod with sound banks:

- **Older shared settings.** The mod's banks have older copies of [settings that other banks share](#shared-settings-from-an-older-game-version). While it is deployed, it can mute or change sounds it never touched. The line under it says how many other banks it reaches.
- **Older sound banks.** The mod's banks are from an older game version. Its own sounds can be wrong or missing.
- **Up to date.** Nothing in its banks is older than the current game. Either it was made for this version, or the updates since didn't touch its banks.
- **Can't be read.** Audiodiver couldn't read the patch file.

**Deployed** marks the mods that are in the game's folder now. A mod with options is listed once, with **Options** showing each option when they differ. **Repatch…** opens a flagged mod in the form at the top of the page, ready to repatch.

The check only reports what a mod's author wouldn't have changed on purpose, so a mod made for the current game never shows up as older.

## What repatching carries over

- The audio that the mod replaces, and the audio it adds. Added audio can be new takes for a sound, a sound that plays with another sound, or a separate clip for one sound.
- The mod's sound settings. These include the volume (Make-Up Gain) of a sound or a container, a delay before it plays, how much of it goes to the game's reverb, and similar settings.

Audiodiver applies all of this to the game's current sound banks and builds a new ZIP of the same mod. The banks the mod didn't patch get its audio only when **Patch every bank with the sounds** is ticked.

If the mod has a mod manager manifest, the new ZIP keeps everything else from the original. That includes the name, the description, the icon, the options, the files next to the patches, and the mod's id. Because the id stays the same, importing the new ZIP in Arsenal updates the old mod and doesn't add another copy. Only the patches are new. The mod's audio goes in exactly as it was, without being converted again, so it sounds the same.

## Destination folder

The new ZIP goes into the **Destination folder**. The default location is `Documents\Audiodiver\Repatched`, and **Change…** picks another. If a ZIP with the same name is already there, it stays, and the new one gets a number.

To change a mod further, make a project and import the mod's patch into it, as [When the game updates](wiki:game-updates#mods-made-with-older-tools) explains. Then build it from [Build](app:build) like any other project.

## What repatching leaves out

Repatching carries over audio and sound settings. After each repatch, the page lists what it left out:

- **Other kinds of change.** A mod's copy of a bank can also have different effects or positioning, or a different way for a container to pick its sounds. Most of these differences are the game's banks as they were when the mod was made, before later updates changed them, so Audiodiver leaves them out. Where Audiodiver knows a difference from an earlier game version, it doesn't list it. If the repatched mod sounds different, compare it with the old version in game.
- **Text that the mod changes.** Repatching doesn't support text yet. For example, a voice mod's new subtitles are left out, and the game shows its normal subtitles. The page tells you when a patch contains text.
- **Anything else in the patch besides sound banks.** A patch that holds sound banks and also models or textures loses the models and textures. The page tells you when this happens. A patch without any audio stays in the ZIP as it was, with everything in it.

The sound settings are copied from the mod as they were. One of them may override a value that the game has changed since, and the old mod overrode it in the same way. On groups that other banks share, only the volume, pitch, filters and delay are copied. See [Shared settings from an older game version](#shared-settings-from-an-older-game-version).

> [!NOTE]
> Audiodiver keeps track of what each game update changes, starting with the update of 20 October 2026. For a mod made before that update, some items under **Left out** and some of the copied settings can be the game's own values from that time, not changes the mod made.

In a mod with several options, a patch with audio that can't be repatched stays in the ZIP unchanged, and the page tells you which one. This happens when its sound banks can't be read, or hold nothing that Audiodiver can bring over.

## Sounds from an older game version

A mod's copies of the sound banks still contain every sound the game had when the mod was made. When a later update removes some of those sounds, the mod's copies make them look like sounds the mod added. Repatching them in would bring the removed sounds back as extra takes, and they would play beside the current ones.

Audiodiver recognizes these sounds and leaves them out. The page then says how many it left out. They were never part of the mod, so the repatched mod still has everything its author made. [Importing a mod's patch](wiki:game-updates) into a project leaves them out in the same way.

Audiodiver recognizes them in two ways:

- It remembers which sounds earlier game versions had in each bank.
- A sound that the mod added plays new audio. A sound that plays audio the current game still has is one of the game's own.

If the mod replaced the audio of a sound that the game has since removed, there is nothing left to put that audio on, and the repatched mod plays the current game's sounds there.

## Shared settings from an older game version

Many sounds take their volume, priority and other settings from groups that the game shares between banks. Every weapon sound goes through one group that is in more than a hundred banks. A mod's copy of a bank has these groups as they were when the mod was made. When the game loads the mod's bank, its old copy of a group can stand in for the current one, and every sound in that group changes with it. After the update of 20 October 2026, mods like this silenced all gunfire.

Updates change these groups' curves, effects and mix settings, such as priority. Mods change at most the volume, pitch, filters and delay. So when a group in the mod's copy differs in its curves or effects, Audiodiver takes it for the game's older version and keeps the current group. From a shared group's other settings, it takes only the volume, pitch, filters and delay, and keeps the game's values for the rest. A setting that the current game has and the mod's copy lacks came with a later update. A shared copy that lacks one is from an older game version, so none of its settings are carried over. The page says how many sound objects it updated this way. [Importing a mod's patch](wiki:game-updates) works the same.

A mod can have these old copies even when it was updated after the game. Some modding tools carry a mod's settings over to the new banks, and with them the old values of the shared groups. The installed mods check finds these as well.

A mod you built with Audiodiver has the same copies. Build it again after every game update, and the [Build](app:build) page says when the last build is older than the game.

## Installing the result

In HD2 Arsenal, import the new ZIP. If the page says the mod kept its id, the new ZIP replaces the old mod. Otherwise, remove the old mod first.

> [!NOTE]
> A repatched mod is still its author's work. Keep it for personal use, and share it only with the author's permission. Better still, point the author to Audiodiver so they can update the mod themselves.
