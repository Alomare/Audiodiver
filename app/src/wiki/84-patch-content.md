---
title: Patch Content
group: Building and sharing
summary: Replacing sounds inside an existing mod, on the mod's own sound banks, also sounds that an update took out of the game.
---

A mod's patch holds copies of the sound banks it changes, as they were in the game version the mod was made for, and the game plays those copies in place of the current banks. **Patch Content**, on [Tools](app:tools/content), opens such a mod as it is, lists the sounds in the patches, and writes the mod again with new audio for the sounds chosen. Everything else stays as the mod has it.

## When to use it

- An update took a sound out of the game, and a mod made before the update still has the sound. Version 7.2.2, for example, took out the anthem that played while a flag goes up. A project and **Repatch** build on the current sound banks, which no longer have such a sound, so only the banks in the old mod can carry new audio for it.
- A few sounds of a mod need other audio, and nothing else in the mod should change.

For sounds the game still has, a project or [Repatch](wiki:repatching) is the better choice: both build on the current banks, so the mod keeps up with the game.

## Opening a mod

1. Open [Tools](app:tools/content) and choose **Patch Content**.
2. Drop the mod on the page as a ZIP, a folder or a `.patch_0` file, or press **Choose a ZIP or Patch File** or **Choose a Folder**.

The list starts with the sounds the current game doesn't have, tagged **Not in the game**. **All Sounds** shows every sound in the mod, and the search finds a sound by ID, name or bank. Each row plays the audio as the mod has it and names the banks in the mod that hold the sound.

## Giving sounds new audio

- Drop an audio file on a sound, or press **Choose File** on the row. **Silence** replaces the sound with silence.
- ✕ takes the new audio away again.
- The new audio goes into every bank and stream of the mod that has the sound. A file is encoded as a build encodes it, and a `.wem` that the game plays as it is goes in unchanged.

## Writing the mod

Choose the name the mod manager shows and a destination folder, then press **Write the Mod**. The new ZIP is the mod as it was: the manifest, the options, the other files and the mod ID stay, so importing it in a mod manager updates the old mod. A mod without a manifest becomes a ZIP for a mod manager, with an option for each part of the mod.

Each patch that holds a chosen sound is written again and checked against the old one: only the audio of those sounds, the sizes that describe it and the timing of music that plays it differ.

## What to know

- The banks in the mod stay as they were in the game version the mod was made for. While the mod is installed, the game plays them in place of the current banks, so what an update changed in those banks doesn't reach the game. See [Sounds from an older game version](wiki:repatching#sounds-from-an-older-game-version).
- A mod made this way is still the work of the original author. Keep it for personal use, and share it only with the author's permission.
