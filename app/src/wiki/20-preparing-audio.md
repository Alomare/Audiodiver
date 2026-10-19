---
title: Preparing the audio
group: Making a mod
summary: Which files to use, how loud to make them, and how to cut them so they sit well in the game.
---

## Formats

Audiodiver reads WAV, FLAC, MP3, OGG, Opus, M4A, AAC, AIFF and WMA. A build converts each file to what the game plays: 48 kHz, stereo (mono stays mono, surround folds down), Vorbis.

Start from the best copy. **WAV or FLAC at 48 kHz** goes through one conversion only. An MP3 works, but is compressed a second time, which can add a little haze to cymbals and reverb tails.

## Loudness

The game's music sits at roughly **−13 to −15 LUFS** (integrated loudness). Music near that level fits next to the game's effects and voices without further changes.

- Measure with a loudness meter, not by the waveform's height. [Tools and links](wiki:tools-and-links) has free ones.
- Keep peaks below about **−1 dBTP**, so the conversion doesn't clip.
- A slot that still sounds too quiet or too loud in game: change its Make-Up Gain instead of exporting the file again. See [Make-Up Gain and the game's mix](wiki:volume).

## Length and cuts

- Trim silence at the start: the game starts a clip on its first sample, so a quiet lead-in plays as a gap.
- A piece that loops should end where it can start again. Fade-outs make loops audible.
- Leave a natural ring-out alone: the part after a segment's *Exit* plays over the next segment. See [Timing, cue points and loops](wiki:timing-and-loops).
- Name the files of a piece in play order (`01 Intro`, `02 Loop`, …). Fills follow file-name order, and `2` comes before `10`.

## Where to keep it

In the project's folder, or a folder next to it. The project stores paths relative to itself, so the whole folder can move or be copied, and a missing file shows up as a problem instead of breaking the build.
