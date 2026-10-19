---
title: Make-Up Gain and the game's mix
group: Making a mod
summary: Setting a slot's loudness, how the game's HDR mix works, and why some screens sound quieter in game than in Audiodiver.
---

## Make-Up Gain per slot

Select a replaced slot and set **Make-Up Gain** in the details, from −12 to +12 dB, or pick a preset. Several selected slots take it at once. The file itself is untouched, so it can change at any time.

> [!NOTE]
> A few clips ignore Make-Up Gain in game, the Illuminate's calm stingers among them. Their details say so: set their loudness in the file instead.

The **Vol** slider in the status bar only sets how loud previews play. It is not part of the mod.

## Make-Up Gain is not Volume

Wwise, the game's audio engine, has two settings that both sound like "volume":

- **Volume** is the *logical* volume: how loud the game believes a sound is. The game's mix decides what to turn down from it.
- **Make-Up Gain** applies *after* that decision: louder or quieter to the ear, without changing how loud the mix believes the sound is.

Audiodiver sets **Make-Up Gain**: it changes the new audio's loudness and nothing else.

## The game's HDR mix

The game mixes with **HDR** (high dynamic range): at any moment the loudest sounds, by their logical Volume, turn the quieter ones down. A gunshot or an explosion ducks the ambience and the music for a moment, as a loud noise does to the ear.

So a sound silenced the usual way still has an effect: with its Make-Up Gain at −96 dB, or replaced by a silent file, nothing comes out of the speakers, yet its logical Volume still tells the mix it is loud, and the sounds around it still duck.

> [!TIP]
> **Silence in Audiodiver leaves the mix.** A sound effect or voice line replaced with silence also gets a logical Volume of −60 dB: far below what the mix counts, so nothing ducks for it, and above the point where the game would stop the sound early, so anything waiting for it keeps its timing. Music keeps its own Volume: a silenced music slot keeps or skips its time as chosen.

## The game mixes some screens down

The game turns its own music down at some moments, and new music with it:

- On the loadout screen, the first set of loops plays quieter than the rest, and the music comes back up after a drop location is picked. That is the game's mix, not the file.
- Voices, explosions and combat effects sit on top of the music, and HDR turns the music down under them. Music that sounds right alone can sound buried in a firefight.

So set Make-Up Gain by ear **in game**, at the moments that changed, against how loud the original music is there.

> [!TIP]
> When one piece needs a boost, raise its slots by +4 dB at a time and listen in game after each step.

**Add Wwise loudness analysis** on the [Build](app:build) tab needs Wwise installed and makes no audible difference; it is off by default.
