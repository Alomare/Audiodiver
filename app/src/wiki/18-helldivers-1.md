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
4. In the [Build](app:build) tab, press **Build**. The ZIP installs with a mod manager for Helldivers 1.

## What a project can change

A slot can have new audio or silence. New audio can have **Make-Up Gain**, **Fades** and **Match the Original Loudness**, and a build puts these into the audio itself. New audio takes the format, sample rate and channels of the original, so a stereo file in a mono slot plays in mono.

The Soundtrack, Text and Tools tabs, **Import Mod**, **Filters**, new takes and layers, and Make-Up Gain on the original audio are only for Helldivers 2.

## Audio from Helldivers 2

The Library shows Helldivers 2 as well. Select slots there and press **Ctrl+C**, then select slots in the [Audio](app:editor) tab and press **Ctrl+V**. The original audio goes in as new audio, and a build fits it to the slot like any other file. Copying works the other way too, from Helldivers 1 into a Helldivers 2 project.

## Languages and size

Some sounds have a tab for each language, with separate slots. New audio in one language plays only in that language.

A mod holds only the new audio, so the ZIP stays small. The game replaces a sound bank all at once, in every language and in every place that holds it, so the mod manager rebuilds each sound bank the mod changes from the game's files when it deploys. One short sound in a big sound bank can take about 3 GB of disk while deployed. After a game update, deploy again: the mod stays as it is. Helldivers 1 mods need the latest version of the mod manager.
