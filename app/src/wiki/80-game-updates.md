---
title: When the game updates
group: Building and sharing
summary: Why a rebuild is usually all a music mod needs after a patch, and what to do when it isn't.
---

Small Helldivers 2 patches usually leave the game's audio alone. Big updates add music (a new enemy or a new kind of planet often brings its own) and can move existing music between the game files.

## Rebuild

A project records *which sound* the new audio replaces, not where the game keeps it. After an update:

1. Start Audiodiver. It notices the changed game files and reads them again; the first start after an update takes about a minute. If the game moved and can't be found, the start-up screen asks for its folder (also under **Game** in [Settings](app:settings/system)).
2. Open the project and build it.
3. Import the new ZIP in HD2 Arsenal and deploy.

The new build patches the game's current sound banks, so it carries everything the update changed.

## When something moved

A replaced sound that no longer exists shows as a problem: the [Build](app:build) tab lists it, and the build waits until it is fixed. Find where that audio lives now in the [Library](app:library), add it to the project and assign the file there.

New music shows up in the Index by itself; music the app can't place yet is under **Not Identified Yet**. Other new audio shows up in **All Archives** at once, without a name: see [Sounds and voices](wiki:sounds-and-voices).

## Mods made with older tools

Patches from older, id-based tools carry whole sound banks from the game version they were built on. After a big update, such a patch rolls those banks back and can undo the game's newer music.

To bring one up to date, open or create a project and use **Import a mod's patch…** on [Home](app:home), or drop the `.patch_0` file on the window. Audiodiver takes the audio out of the patch and assigns it to the same sounds; build from there.
