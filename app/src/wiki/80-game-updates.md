---
title: When the game updates
group: Building and sharing
summary: Why a music mod usually needs only a rebuild after a patch, and what to do when it needs more.
---

Small Helldivers 2 patches usually don't change the game's audio. Large updates often add music for a new enemy or a new type of planet, and they can move existing music to different game files.

## Rebuild

A project records *which sound* the new audio replaces. It doesn't record where the game stores that sound. After an update:

1. Start Audiodiver. It detects the changed game files and reads them again, so the first start after an update takes about a minute. If the game has moved and Audiodiver can't find it, the start-up screen asks for its folder. You can also set the folder under **Game** in [Settings](app:settings/system).
2. Open the project and build it.
3. Import the new ZIP in HD2 Arsenal and deploy it.

The new build patches the game's current sound banks, so it includes every change from the update.

## When a sound has moved

If a replaced sound no longer exists, the [Build](app:build) tab lists it as a problem, and you can't build until you fix it. Find the audio's new location in the [Library](app:library), add it to the project, and assign the file there.

New music appears in the Index automatically. Music that Audiodiver can't identify yet is listed under **Not Identified Yet**. Other new audio appears in **All Archives** immediately, without a name. See [Sounds and voices](wiki:sounds-and-voices).

## Mods made with older tools

Patches from older, id-based tools contain complete sound banks from the game version they were built on. After a large update, such a patch rolls those banks back and can undo the game's newer music.

To update one of these mods, [repatch](wiki:repatching) it on [Tools ▸ Repatch](app:tools/repatch). Drop the mod on the page, and Audiodiver rebuilds it against the current game version.

To work the mod into an existing project instead, use **Import a mod's patch…** on [Home](app:home), or drop its `.patch_0` file on the window. Audiodiver extracts the audio from the patch, assigns it to the same sounds, and you build the project from there. When the project already has something in it, Audiodiver asks first: **Add to the project** keeps what it has (where both have audio for a slot, the patch's goes in), and **Replace the project's audio** takes out its new audio, added sounds, cue points and list before the patch comes in. Its text and audio files stay either way, and Undo brings the project back as it was. In both cases, the mod's audio goes into the build exactly as it was and isn't converted again.

The import also brings in audio that the mod adds. This can be new takes for a sound, a new sound that plays with an existing one (a layer), or a separate clip for one sound. Each one becomes the same kind of addition that [Adding audio](wiki:adding-audio) makes, with the mod's audio. A layer goes next to the sound the mod built it from, and plays wherever that sound plays.

The mod's sound settings come in too, such as the volume of a sound or a container, or a delay before it plays. The build applies them to the game's sounds with the values the mod used. Other kinds of change, such as effects or how a container picks its sounds, aren't imported. The import tells you how many it left out.
