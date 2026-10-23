---
title: Make-Up Gain and the game's mix
group: Making a mod
summary: Setting a slot's loudness, how the game's HDR mix works, and why some screens sound quieter in game than in Audiodiver.
---

## Make-Up Gain per slot

Select a replaced slot and set **Make-Up Gain** in the details, from −12 to +12 dB, or pick a preset. If several slots are selected, they all get the same value. Make-Up Gain doesn't change the audio file, so you can adjust it at any time.

> [!NOTE]
> A few clips ignore Make-Up Gain in game, including the Illuminate's calm stingers. Their details show a warning. Set the loudness of these clips in the audio file.

The **Vol** slider in the status bar sets only the preview volume in Audiodiver. It isn't part of the mod.

## Make-Up Gain and Volume are different settings

Wwise, the game's audio engine, has two settings that both sound like "volume":

- **Volume** is the *logical* volume, which is how loud the game considers a sound to be. The game's mix uses this value to decide which sounds to turn down.
- **Make-Up Gain** is applied *after* the mix has made that decision. It makes the sound louder or quieter to the ear without changing how loud the mix considers it.

Audiodiver sets Make-Up Gain, which changes the loudness of the new audio and nothing else.

## The game's HDR mix

The game mixes its audio with **HDR** (high dynamic range). At any moment, the sounds with the highest logical Volume turn the quieter sounds down. A gunshot or an explosion briefly ducks the ambience and the music, much like a loud noise does to your hearing.

This means that a sound silenced in the usual way still affects the mix. If you set its Make-Up Gain to −96 dB, or replace it with a silent file, the speakers play nothing. Its logical Volume still tells the mix that it is loud, though, and the sounds around it still duck.

> [!TIP]
> **Silence in Audiodiver is taken out of the mix.** When you replace a sound effect or a voice line with silence, Audiodiver also sets its logical Volume to −60 dB. That level is too low for the mix to count, so nothing ducks for the sound. It is still high enough that the game doesn't stop the sound early, so anything that waits for the sound keeps its timing. Music keeps its Volume, and a silenced music slot keeps or skips its time according to its silence setting.

## The game turns the music down on some screens

At some moments the game lowers its music, and it lowers new music in the same way:

- On the drop location screen, the loops play more quietly. The music comes back up on the loadout screen that follows. This comes from the game's mix and has nothing to do with your file.
- On the ship, walking up to the war table turns the music down by 6 dB, and nothing turns it back up. Before your first visit to the war table, the ship's music plays 6 dB louder than it does for players who joined a mission from the war table, which is the usual way. Judge the ship's music after a visit to the war table.
- Voices, explosions and combat effects sit on top of the music, and HDR turns the music down under them. Music that sounds right alone can sound buried during a firefight.

For these reasons, set Make-Up Gain by ear **in game**, at the moments you changed, and compare it with how loud the original music is there.

> [!TIP]
> If a piece needs a boost, raise its slots by +4 dB at a time and listen in game after each step.

**Add Wwise loudness analysis** on the [Build](app:build) tab requires an installation of Wwise. It makes no audible difference and is off by default.
