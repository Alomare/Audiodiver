---
title: Preparing the audio
group: Making a mod
summary: Which files to use, how loud to make them, and how to cut them so they fit in the game.
---

## Formats

Audiodiver reads WAV, FLAC, MP3, OGG, Opus, M4A, AAC, AIFF and WMA. A build converts each file to the format the game plays, Vorbis at 48 kHz in stereo. Mono files stay mono, and surround files are mixed down to stereo.

Start from the best copy you have. **WAV or FLAC at 48 kHz** goes through only one conversion. An MP3 also works, but it gets compressed a second time, which can add a slight haze to cymbals and reverb tails.

## Loudness

The game's music is at about **−13 to −15 LUFS** (integrated loudness). Music at that level fits with the effects and voices without further changes.

- Measure loudness with a loudness meter. The height of the waveform is a poor guide. [Tools and links](wiki:tools-and-links) lists free meters.
- Keep peaks below about **−1 dBTP** so that the conversion doesn't clip.
- If a slot still sounds too quiet or too loud in game, change the Make-Up Gain of the slot instead of exporting the file again. See [Make-Up Gain and the mix](wiki:volume).

## Length and cuts

- Trim silence from the start of each file. The game starts a clip at the first sample, so a quiet lead-in plays as a gap.
- A piece that loops should end at a point where it can start again. A fade-out makes the loop point audible.
- Keep a natural ring-out at the end. The audio after a segment's *Exit* point plays over the next segment. See [Timing, cue points and loops](wiki:timing-and-loops).
- Name the files of a piece in play order, such as `01 Intro` and `02 Loop`. Fills follow file-name order, which puts `2` before `10`.

## Where to keep the files

Keep the audio in the project folder. Files from other folders also work, and **Collect files** on the [Project](app:project) tab copies them into `audio\added`. Paths are stored relative to the project folder, so the whole folder can be moved or copied. Build lists a missing file as a problem and doesn't build until it is fixed.
