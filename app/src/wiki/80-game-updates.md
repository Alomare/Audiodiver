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

To bring the mod into an existing project instead, use **Import patches…** on the [Project](app:project) tab, or drop the `.patch_0` file on the window. Audiodiver extracts the audio from the patch and assigns it to the same sounds, and you build the project from there. If the project isn't empty, Audiodiver asks first. **Add to the project** keeps the current content, and where both have audio for a slot, the patch's audio goes in. **Replace the project's audio** removes the new audio, added sounds, cue points and list before the import. Text and audio files stay either way, and Undo restores the project. In both cases, the mod's audio goes into the build without being converted again.

The import also brings in audio that the mod adds. This can be new takes for a sound, a new sound that plays with an existing one (a layer), or a separate clip for one sound. Each one becomes the same kind of addition that [Adding audio](wiki:adding-audio) makes. A layer goes next to the sound it was built from, and plays wherever that sound plays.

Sound settings come in too, such as the volume of a sound or a container, or a delay before it plays. The build applies them with the values the mod used. So do the cue points of the music segments the patch gives new audio. Other kinds of change, such as effects or how a container picks sounds, aren't imported. The import shows how many were left out.
