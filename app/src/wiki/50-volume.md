---
title: Make-Up Gain and the mix
group: Making a mod
summary: Setting a slot's loudness, how the game's HDR mix works, and why some screens sound quieter in game than in Audiodiver.
---

## Make-Up Gain per slot

Select a slot and set **Make-Up Gain** in the details, from −96 to +96 dB, with the slider or by typing a value. Several selected slots all get the same value. Make-Up Gain doesn't change the audio file, so you can adjust it at any time. {icon:reset} after the value sets it back to 0 dB, the level the game plays the sound at. Some sounds have a Make-Up Gain of their own in the game, which the **?** shows. It stays, since the value here adds to it. The **Level** of a piece in the [Soundtrack](wiki:soundtrack) has the same button.

On a slot without new audio, Make-Up Gain makes the Original louder or quieter. The mod changes only that setting, so it holds no copy of the audio. The row shows the value as a tag. While the slot has new audio, the gain set on the new audio applies instead.

The waveforms under the slots are drawn at the gain and follow the slider as it moves, on the same scale as the Original, so the new audio can be set as loud as the Original by eye. Red marks audio pushed past full scale, which clips. ▶ plays the new audio at the gain too, and the Original at the gain on it.

**Match the Original Loudness** sets the Make-Up Gain that makes the new audio as loud as the Original. Audiodiver measures the loudness of both (as broadcast loudness meters do): a sound shorter than 3 seconds, such as a shot or a voice line, by the loudest moment, and longer audio, such as music, by the whole. With several slots selected, **Match Each to the Original Loudness** sets a separate gain for each slot.

> [!NOTE]
> A few clips ignore Make-Up Gain in game, including the Illuminate calm stingers. Their details show a warning. Set the loudness of these clips in the audio file.

The **Vol** slider in the status bar sets only the preview volume in Audiodiver. It isn't part of the mod.

## Volume curves

The game changes the level of some music while it plays: a volume curve on the clip lowers or raises the level over time, and a fade brings the sound in or takes it out. The curve is part of the music track, not of the audio file, so new audio in that slot follows it too. A slot with a curve shows it as a line around the waveform, with **Volume curve** beside it.

Turn off **Keep the volume curve** in the details to play the slot at an even level. Make-Up Gain can't do this, because it sets one level for the whole clip. The switch takes off volume curves and fades, works on slots with or without new audio and, with several slots selected, applies to the ones that have a curve. A clip can be on several music tracks, and the switch covers all of them.

For example, one of the two clips of Hellpod Descent has a curve that keeps lowering the level, and the other has none. With the same song in both, one plays quieter than the other until the curve is off.

A mod's own curves come in with the [import](wiki:importing-mods#what-comes-in). They show in the waveforms and under **Imported Settings**, and the switch takes them off too.

## Make-Up Gain and Volume are different settings

Wwise, the game's audio engine, has two settings that both sound like "volume":

- **Volume** is the *logical* volume, how loud the game considers a sound to be. The mix uses this value to decide which sounds to turn down.
- **Make-Up Gain** is applied *after* that decision. It makes the sound louder or quieter to the ear without changing how loud the mix considers it.

Audiodiver sets Make-Up Gain, which changes only the loudness. The value in the details is added to the Make-Up Gain the game already gives the sound, so 0 dB plays the sound as the game does.

## The game's HDR mix

The game mixes audio with **HDR** (high dynamic range). At any moment, the sounds with the highest logical Volume turn the quieter sounds down. A gunshot or an explosion briefly ducks the ambience and the music, much like a loud noise does to your hearing.

A sound silenced in the usual way still affects the mix. With Make-Up Gain at −96 dB, or with a silent file, the speakers play nothing. The logical Volume is still loud, though, and the sounds around it still duck.

> [!TIP]
> **Silence in Audiodiver is taken out of the mix.** When you replace a sound effect or a voice line with silence, Audiodiver also sets the logical Volume to −60 dB. That level is too low for the mix to count, so nothing ducks. It is still high enough that the game doesn't stop the sound early, so it doesn't disrupt the sequence's timing. Music volume is unchanged, and a silenced music slot keeps the same duration or moves straight on, depending on the silence setting.

## The game turns the music down on some screens

At some moments the game lowers the music, and new music is lowered in the same way:

- On the drop location screen, the loops play more quietly and come back up on the loadout screen that follows. The mix causes this, not the audio file.
- On the ship, walking up to the war table turns the music down by 6 dB, and nothing turns it back up. Before the first visit to the war table, the ship music plays 6 dB louder than for players who joined a mission from the war table, which is the usual way. Judge the ship music after a visit to the war table.
- Voices, explosions and combat effects play over the music, and HDR turns the music down under them. Music that sounds right alone can sound buried during a firefight.

For these reasons, set Make-Up Gain by ear **in game**, at the changed moments, and compare it with how loud the original music is there.

> [!TIP]
> If a piece needs a boost, raise the slots by +4 dB at a time and listen in game after each step.

**Add Wwise loudness analysis** on the [Build](app:build) tab requires an installation of Wwise. It makes no audible difference and is off by default.

## Filters

**Low-Pass** dulls a sound and **High-Pass** thins it, from 0 to 100, set in the details of any slot, with new audio or the original. They add to what the game sets, and the most a sound can have is 100.

The game applies them, so previews and the waveforms in Audiodiver play without them. To hear the change, build the mod and listen in the game.

## Fades

**Fade In** and **Fade Out** are in milliseconds, in the details of a slot with new audio. They go into the audio itself, so the waveform and the preview show them, and the length doesn't change. A `.wem` that would go in unchanged is encoded again when it has a fade.


## Radio filter

The radio sound on some voices isn't in their files. The lines pass through a radio effect in the game's mix, so new audio on those voices gets the same effect. The **Radio Filter** section of the [Project](app:project) tab turns it off, a voice at a time, for every language:

- **Mission Control**
- **The Admiral**
- **Eagle-1**
- **Pelican-1**
- **Helldivers**, for teammates on the radio and anyone in a vehicle

A mod can be just this, with no new audio.

Clean voices come out louder. **Normalize the loudness** turns them down to about the level of the radio.

The mix is in the game's Init bank, which every sound goes through, so the mod carries a copy with only these changes:

- Only one mod can carry Init. With two, the last one wins. [Combine](wiki:combining-mods) keeps the radio settings of each mod in one Init.
- After a game update, build the mod again, or a change to the mix goes missing for every sound. The [installed mods check](wiki:game-updates) flags an old Init.
- It changes your own game only. Other players hear what their game plays.

