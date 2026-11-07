---
title: Helldivers 1 mods
group: Getting started
summary: Replacing the audio of Helldivers 1: the switch on Home, what a project can change, and why a mod can be large.
---

With Helldivers 1 installed, the **Helldivers 2** and **Helldivers 1** buttons on [Home](app:home) choose the game Audiodiver makes mods for. Each project belongs to one game, and opening a project switches to that game. Choosing the other game closes the project that is open.

## Starting a project

1. Choose **Helldivers 1** on Home and press **New Project**.
2. In the [Library](app:library), press **+** on what you want to change.
3. In the [Audio](app:editor) tab, drop audio on a slot, or choose a file.
4. In the [Build](app:build) tab, press **Build**. The ZIP installs with [a mod manager for Helldivers 1](https://www.nexusmods.com/helldivers/mods/16), version 1.1.0 or later.

## What a project can change

A slot can have new audio or silence. New audio can have **Make-Up Gain**, **Fades** and **Match Original Loudness**, and a build puts these into the audio itself. New audio takes the format, sample rate and channels of the original, so a stereo file in a mono slot plays in mono.

The Soundtrack, Text and Tools tabs, **Import Mod**, **Filters**, new takes and layers, and Make-Up Gain on the original audio are only for Helldivers 2.

## Audio from Helldivers 2

The Library shows Helldivers 2 as well. Select slots there and press **Ctrl+C**, then select slots in the [Audio](app:editor) tab and press **Ctrl+V**. The original audio goes in as new audio, and a build fits it to the slot like any other file. Copying works the other way too, from Helldivers 1 into a Helldivers 2 project.

## Languages and size

Some sounds have a tab for each language, with separate slots. New audio in one language plays only in that language.

A mod holds only the new audio, so the ZIP stays small. From version 1.4.0, the mod manager puts the new clips into small sound banks beside the game's, and the game's own sound banks stay as they are, so a deploy takes about as much disk as the new audio. A language the mod gives no new audio keeps the game's sounds, which the deploy copies: about 4 MB for one footstep in US English. After a game update, deploy again: the mod stays as it is. Helldivers 1 mods need version 1.1.0 or later of the mod manager. Before 1.4.0, it rebuilds each sound bank the mod changes, and one short sound in a big sound bank can take about 3 GB of disk while deployed.
