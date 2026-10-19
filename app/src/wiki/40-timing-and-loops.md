---
title: Timing, cue points and loops
group: Making a mod
summary: How the game moves from one segment to the next, how to make new music hand over cleanly, and how to slice one song into a cue.
---

## Fitting the timing to the new audio

Every replaced slot has **Fit timing to the new audio** on by default. The segment then takes the new clip's length, and its *Exit* point sits at the clip's end, so the next segment starts when it finishes.

Turn it off only when the clip must follow the original timing, for example a short sting placed inside a longer segment.

## Entry and Exit

The waveforms under the slots show the original above the replacement, on one time scale, with their cue points:

- **Entry**: where the segment counts as started. Audio before it is a lead-in under the end of the previous segment.
- **Exit**: where the next segment starts. Audio after it rings out over the next segment.

Drag the replacement's Exit to move the hand-over. Drag it back onto its automatic spot, or use **Reset cue points**, to clear the change. The details have the same values in milliseconds under **Cue points**.

> [!TIP]
> Reverb tails and final hits sound best after the Exit: they overlap the next segment instead of leaving a gap.

## Hearing the result

**Play through** plays the whole piece the way the game does: segments in order, handing over at their Exit points. Compare **Original** and **Replaced** to catch gaps, double hits and jumps in volume before building.

## Loops

Segments marked **loops** repeat until the game moves on; **×2** and so on repeat that many times. A loop that ends where it began is seamless. When a piece loops several segments in a row (Loadout Selection plays fourteen), each should end where the next can start.

## Slicing one long song

**Slice a song…** cuts one long file into consecutive pieces, exact to the sample, so the pieces played back to back sound like the uncut song. Each piece goes to one segment, in play order: a segment's layers play together, so the pieces fill one layer (the one of the first slot).

The window shows the song and the original on one time scale:

- **New audio**: the song, its cuts, and each piece's number and slot.
- **Original**: each slot's original audio, starting at its piece's cut. A red edge means the original runs past the cut (the piece is shorter); a dashed line marks where an original ends early (the piece is longer). The table and the lane say by how much.

To work with it:

1. **Pieces** sets how many, **First slot** where they start. *to …* names the last slot filled.
2. Place the cuts: **Original proportions** spreads the original lengths over the song, **Original lengths** cuts at the original lengths exactly, **Even** cuts equal pieces.
3. Fine-tune: drag a cut (it snaps to the original's length; hold Shift to drag freely), double-click the song to add one, select one and press Delete to remove it, or nudge it with ←/→ (Shift: 100 ms, Alt: 1 ms). **Start** and **End** can skip an intro or an outro.
4. Listen: click the song or the original to play from that spot, or press ▶ on a piece in the table. Space plays and pauses.
5. Zoom with Ctrl+wheel or the buttons, scroll with the wheel or the strip under the lanes. A row of the table brings its piece into view.
6. **Slice and fill** saves the pieces in the project's `slices` folder and fills the slots.

The cuts are kept for each song, so slicing it again starts where it was left.
