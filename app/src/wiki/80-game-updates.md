---
title: When the game updates
group: Building and sharing
summary: Why a music mod usually needs only a rebuild after a patch, and what to do when it needs more.
---

Small Helldivers 2 patches usually don't change audio. Large updates often add music for a new enemy or a new type of planet, and they can move existing music to different game files.

## Rebuild

A project records *which sound* the new audio replaces. It doesn't record where that sound is stored. After an update:

1. Start Audiodiver. It detects the changed game files and reads them again, so the first start after an update takes about a minute. If the game has moved and Audiodiver can't find it, the start-up screen asks for the game folder. You can also set the folder under **Game** in [Settings](app:settings/system).
2. Open the project and build it.
3. Import the new ZIP in the mod manager and deploy it.

The new build patches the current sound banks, so it includes every change from the update.

## When a sound has moved

If a replaced sound no longer exists, the [Build](app:build) tab lists it as a problem, and you can't build until you fix it. Find the new location in the [Library](app:library), add it to the project, and assign the file there.

New music appears in the Index automatically. Music that Audiodiver can't identify yet is listed under **Not Identified Yet**. Other new audio appears in **All Archives** immediately, without a name. See [Sounds and voices](wiki:sounds-and-voices).

## Mods made with older tools

Patches from older, id-based tools contain complete sound banks from the game version they were built on. After a large update, such a patch rolls those banks back and can undo newer music.

To update one of these mods, [repatch](wiki:repatching) it on [Tools ▸ Repatch](app:tools/repatch). Drop the mod on the page, and Audiodiver rebuilds it against the current game version.

To keep working on the mod in Audiodiver instead, import it ([Importing a mod](wiki:importing-mods)). **Import Mod** on [Home](app:home) makes a new project from it, and **Import Patches** on the [Project](app:project) tab brings it into the open project. The audio of the mod goes into the build without being converted again.
