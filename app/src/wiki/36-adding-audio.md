---
title: Adding audio
group: Making a mod
summary: New takes for a sound, a layer that plays with it, and new audio for one sound only, in addition to what the game has.
---

Replacing audio changes what a slot plays. Sounds can also get audio that the game doesn't have, in three ways, all on the Audio tab. They work for sounds and voices, but not for music.

## New takes

A sound that picks one of several takes at random can get more takes. Press **+** on the sound's line, choose **New takes…** and pick one file for each take. The game then picks from the original and the new takes. A new take is marked *new take* and has no original to play. ✕ removes it.

To replace a sound completely, give every existing take new audio. See [Sounds and voices](wiki:sounds-and-voices).

## A layer

A layer plays along with a sound every time, like a deeper boom under a gunshot. Press **+** and choose **New layer…** to add a layer under the sound, with one take for each file you pick. **+** on the layer adds more takes, and the game picks one of them each time. A layer goes to the same place in the mix as the sound, and Make-Up Gain sets how loud it is.

**New layer…** is greyed out for sounds that can't have a layer. A sound that is one of the random choices of another sound can't have one, because the layer would only become another choice. Neither can a sound that nothing plays directly.

## Only this sound

Several sounds often play the same clip, and replacing the clip changes it in all of them. To limit a replacement, set **Scope** in the details of a replaced slot to **Only this sound**. The other sounds then keep the original. Each option shows how many banks it changes.

This option works per sound. When the game copies a whole sound into other banks, like the weapon handling sounds in every weapon bank, the copies are the same sound and all of them change.

## Size

Added audio goes into every bank that contains the sound. As with replacements, adding audio to a widely shared sound makes the mod large.
