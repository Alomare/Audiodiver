---
title: Repatching
group: Building and sharing
summary: Rebuilding an audio mod that was made for an older version of the game, or with another tool, against the current game.
---

A mod's patch contains complete copies of the sound banks it changes, as they were in the game version the mod was made for. After a game update, those copies are out of date. The mod can go silent or play the wrong sounds, and while installed it rolls newer audio back. It can even silence sounds it never changed, because the banks also hold settings that many other banks share. **Repatch**, on [Tools](app:tools/repatch), rebuilds such a mod against the current game. It needs no project or modding experience.

## When to use it

- A mod's sounds went silent, wrong or missing after a game update, and the author hasn't updated it.
- Other sounds, like all gunfire, go silent while the mod is installed. See [Shared settings from an older game version](#shared-settings-from-an-older-game-version).

## Repatching a mod

1. Open [Tools ▸ Repatch](app:tools/repatch).
2. Drop the mod on the page. You can drop the downloaded ZIP, the mod folder, or the `.patch_0` file with the `.stream` file next to it. **Choose a ZIP or Patch File** and **Choose a Folder** do the same. A ZIP dropped anywhere in Audiodiver also opens on this page.
3. Check the name. Audiodiver takes it from the manifest if there is one, and otherwise from the file or folder name, without the numbers and dates that Nexus Mods adds to downloads.
4. Tick **Patch every bank with the sounds** to play the mod's audio wherever those sounds are used. Left off, the audio goes only into the banks the mod patched, as in the original, and the size stays about the same. [More about it](wiki:build-and-install#every-bank-with-the-sounds).
5. Press **Repatch**.

The page then sums up the result: what was carried over, what was kept as it was, and what was left out. **Show All** lists every patch and the log. **Repatch Another Mod** clears the page.

Some mods have several options, with one patch for each. Such a mod stays one mod with the same options. The page counts the patches, and Audiodiver rebuilds each patch that holds audio where it was. A patch without audio, such as an option that only changes a texture, stays as it is. **Show all** lists them one by one.

Some mods have several patch files in one folder, such as `.patch_0`, `.patch_1` and `.patch_2`. The game loads them over each other as one mod. Audiodiver reads them in the same order and builds them into one patch.

## Checking installed mods

**Installed mods**, at the bottom of the Repatch page, finds the mods that need a repatch. **Check Installed Mods** looks through the mods in a mod manager's library, deployed or not, and the patch files in the game's `data` folder. It lists every mod with sound banks:

- **Older shared settings.** The banks have older copies of [settings that other banks share](#shared-settings-from-an-older-game-version). While deployed, the mod can mute or change sounds it never touched. The line below shows how many other banks it reaches.
- **Older sound banks.** The banks are from an older game version. The mod's sounds can be wrong or missing.
- **Up to date.** Nothing in the banks is older than the current game. Either the mod was made for this version, or later updates didn't touch those banks.
- **Can't be read.** Audiodiver couldn't read the patch file.

**Deployed** marks the mods currently in the game folder. A mod with options is listed once, with **Options** showing each option when they differ. **Repatch** opens a flagged mod in the form at the top of the page, ready to repatch.

The check only reports what a mod's author wouldn't have changed on purpose, so a mod made for the current game never shows up as older.

## What repatching carries over

- The audio that the mod replaces, and the audio it adds. Added audio can be new takes for a sound, a sound that plays with another sound, or a separate clip for one sound.
- Sound settings, such as the volume (Make-Up Gain) of a sound or a container, a delay before it plays, and how much of it goes to reverb.
- The cue points of the music segments that play new audio.
- Volume curves on music tracks, as the mod set them.
- Everything else in the patch, such as text, models and textures, exactly as it was. The page lists what a patch holds besides audio.

Audiodiver applies all of this to the current sound banks and builds a new ZIP of the same mod. Banks the mod didn't patch get the audio only when **Patch every bank with the sounds** is ticked.

If the mod has a mod manager manifest, the new ZIP keeps everything else from the original: the name, the description, the icon, the options, the files next to the patches, and the ID. With the same ID, importing the new ZIP in a mod manager updates the old mod and doesn't add another copy. Only the patches are new. The audio goes in without being converted again, so it sounds the same.

## Destination folder

The new ZIP goes into the **Destination folder**. The default location is `Documents\Audiodiver\Repatched`, and **Change** picks another. If a ZIP with the same name is already there, it stays, and the new one gets a number.

To change a mod further, make a project and import the mod's patch into it, as [When the game updates](wiki:game-updates#mods-made-with-older-tools) explains. Then build it from [Build](app:build) like any other project.

## What repatching leaves out

A mod's copy of a bank can also have different effects or positioning, or a different way for a container to pick sounds. Most of these differences come from the banks as they were when the mod was made, before later updates changed them. Audiodiver leaves them out, and the page lists them. A difference that Audiodiver knows from an earlier game version isn't listed. If the repatched mod sounds different, compare it with the old version in game.

Text, models and textures go in unchanged. A string table holds every line of the table, so a table from an older game version also brings back that version's lines, as the old mod did.

Sound settings are copied as they were. One of them may override a value that the game has changed since, as the old mod did. On groups that other banks share, only the volume, pitch, filters and delay are copied. See [Shared settings from an older game version](#shared-settings-from-an-older-game-version).

> [!NOTE]
> Audiodiver keeps track of what each game update changes, starting with the update of 20 October 2026. For a mod made before that update, some items under **Left out** and some of the copied settings can be Original values from that time that the mod didn't change.

In a mod with several options, a patch with audio that can't be repatched stays in the ZIP unchanged, and the page names it. This happens when the sound banks in the patch can't be read, or hold nothing that Audiodiver can bring over.

## Sounds from an older game version

A mod's bank copies still contain every sound the game had when the mod was made. When a later update removes some of those sounds, they look like sounds the mod added. Repatching them in would bring the removed sounds back as extra takes beside the current ones.

Audiodiver recognizes these sounds, leaves them out, and shows how many. They were never part of the mod, so the repatched mod still has everything the author made. [Importing a mod's patch](wiki:game-updates) into a project leaves them out too.

Audiodiver recognizes them in two ways:

- It remembers which sounds earlier game versions had in each bank.
- A sound that the mod added plays new audio. A sound that plays audio the current game still has is an original sound.

If the mod replaced the audio of a sound that the game has since removed, there is nothing to put that audio on, and the repatched mod plays the current sounds there.

## Shared settings from an older game version

Many sounds take their volume, priority and other settings from groups shared between banks. Every weapon sound goes through one group that is in more than a hundred banks. A mod's bank copy has these groups as they were when the mod was made. When the game loads that bank, the old copy of a group can replace the current one, and every sound in the group changes with it. After the update of 20 October 2026, mods like this silenced all gunfire.

Updates change the curves, effects and mix settings of these groups, such as priority. Mods change at most the volume, pitch, filters and delay. When a group in the mod differs in curves or effects, Audiodiver treats it as an older game version and keeps the current group. From the other settings of a shared group, it takes only the volume, pitch, filters and delay, and keeps the current values for the rest. A setting that the current game has and the mod lacks came with a later update. A shared copy without it is from an older game version, so none of the settings in that copy are carried over. The page shows how many sound objects were updated this way. [Importing a mod's patch](wiki:game-updates) works the same.

A mod can have these old copies even when it was updated after the game. Some modding tools carry the mod's settings over to the new banks, and with them the old values of the shared groups. The installed mods check finds these as well.

A mod built with Audiodiver has the same copies. Build it again after every game update. The [Build](app:build) page warns when the last build is older than the game.

## Installing the result

Import the new ZIP in the mod manager. If the page says the mod ID was kept, the new ZIP replaces the old mod. Otherwise, remove the old mod first.

> [!NOTE]
> A repatched mod is still the author's work. Keep it for personal use, and share it only with the author's permission. Better still, point the author to Audiodiver to update the mod.
