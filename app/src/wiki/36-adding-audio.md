---
title: Adding audio
group: Making a mod
summary: New takes for a sound, a layer that plays with it, and new audio for one sound only, in addition to what the game has.
---

Replacing audio changes what a slot plays. You can also give a bank's sounds audio that the game doesn't have. There are three ways to do this, and all of them are in the Audio Editor. They work for sounds and voices, but music can't get added audio.

## New takes

When the game picks a sound's audio at random from several takes, you can add more takes. Press **+** on the sound's line and choose **New takes…**, then pick one file for each take. The game then picks from the original takes and the new ones. A new take is marked *new take* and has no original to play. Its ✕ removes it.

To replace a sound completely, give each of its existing takes new audio. See [Sounds and voices](wiki:sounds-and-voices).

## A layer

A layer plays together with a sound every time the sound plays, like a deeper boom under a gunshot. Press **+** and choose **New layer…** to add a layer under the sound, with one take for each file you pick. The layer's **+** adds more takes, and the game picks one of them each time. A layer goes to the same place in the game's mix as its sound, and its Make-Up Gain sets how loud it is.

Some sounds can't have a layer, and **New layer…** is greyed out for them. A sound that is one of the random choices of another sound can't have one, because the layer would only become another choice. A sound that nothing plays directly can't have one either.

## Only this sound

Several sounds often play the same clip, and replacing the clip changes it in all of them. After a slot has new audio, you can set **Scope** in the details to **Only this sound**. The other sounds that play the clip then keep the original. Each option shows how many banks it changes.

This option works at the level of the sound. When the game copies a whole sound into other banks, like the weapon handling sounds that are in every weapon's bank, the copies are the same sound. The change applies to all of them.

## Size

Added audio goes into every bank that contains its sound. Just as with replacements, adding audio to a widely shared sound makes the mod large.
