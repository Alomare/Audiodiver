---
title: Preparing the audio
group: Making a mod
summary: Which files to use, how loud to make them, and how to cut them so they fit in the game.
---

## Formats

Audiodiver reads WAV, FLAC, MP3, OGG, Opus, M4A, AAC, AIFF and WMA. A build converts each file to the format the game plays, which is Vorbis at 48 kHz in stereo. Mono files stay mono, and surround files are mixed down to stereo.

Start from the best copy you have. **WAV or FLAC at 48 kHz** goes through only one conversion. An MP3 also works, but it gets compressed a second time, which can add a slight haze to cymbals and reverb tails.

## Loudness

The game's music sits at about **−13 to −15 LUFS** (integrated loudness). Music at that level fits with the game's effects and voices without further changes.

- Measure loudness with a loudness meter. The height of the waveform is a poor guide. [Tools and links](wiki:tools-and-links) lists free meters.
- Keep peaks below about **−1 dBTP** so that the conversion doesn't clip.
- If a slot still sounds too quiet or too loud in game, change its Make-Up Gain. You don't need to export the file again. See [Make-Up Gain and the game's mix](wiki:volume).

## Length and cuts

- Trim silence from the start of each file. The game starts a clip at its first sample, so a quiet lead-in plays as a gap.
- A piece that loops should end at a point where it can start again. A fade-out makes the loop point audible.
- Keep a natural ring-out at the end. The audio after a segment's *Exit* point plays over the next segment. See [Timing, cue points and loops](wiki:timing-and-loops).
- Name the files of a piece in play order, such as `01 Intro` and `02 Loop`. Fills follow file-name order, which puts `2` before `10`.

## Where to keep the files

Keep the audio in the project's folder. A file from another folder works too, and **Collect files** on the [Project](app:project) tab copies it into `audio\added`. The project stores paths relative to its folder, so you can move or copy the whole folder. If a file goes missing, Build lists it as a problem and doesn't build until you fix it.
