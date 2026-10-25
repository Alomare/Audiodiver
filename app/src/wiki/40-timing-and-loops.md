---
title: Timing, cue points and loops
group: Making a mod
summary: How the game moves from one segment to the next, how to make new music hand over cleanly, and how to slice one song into a cue.
---

## Fitting the timing to the new audio

**Fit timing to the new audio** is on by default for every replaced slot. The segment takes the length of the new clip, and the *Exit* point moves to the end of the clip. The next segment starts when the clip finishes.

Turn the option off only when the clip has to follow the original timing, such as a short sting placed inside a longer segment.

## Entry and Exit

The waveforms under the slots show the original above the replacement, on the same time scale, with cue points:

- **Entry** is where the segment counts as started. Audio before the Entry is a lead-in that plays under the end of the previous segment.
- **Exit** is where the next segment starts. Audio after the Exit rings out over the next segment.

Drag the Exit on the replacement to move the hand-over. To undo, drag it back to the automatic position or press **Reset cue points**. The details show the same values in milliseconds under **Cue points**.

> [!TIP]
> Place reverb tails and final hits after the Exit. They overlap the next segment there, which avoids a gap.

## Hearing the result

**Play through** plays the whole piece as it plays in game, with the segments in order and each hand-over at an Exit point. Compare **Original** and **Replaced** to catch gaps, double hits and jumps in volume before you build.

## Loops

A segment marked **loops** repeats until the game moves on. A segment marked **×2** or a higher number repeats that many times. A loop that ends where it began plays without a seam. Some pieces loop several segments in a row (Loadout Selection plays fourteen), and each of those segments should end at a point where the next one can start.

## Slicing one long song

{icon:slice} **Slice a song** cuts one long file into consecutive pieces at exact sample positions, so the pieces sound like the uncut song when they play back to back. Each piece goes to one segment, in play order. The layers of a segment play together, so all of the pieces go into the layer of the **From** slot.

The window shows the song and the original on one time scale:

- The **New audio** lane shows the song, the cuts, and the number and slot of each piece.
- The **Original** lane shows the original audio of each slot, starting at the cut for that piece. A red edge means the original runs past the cut, so the piece is shorter than the original. A dashed line marks where an original ends early, so the piece is longer. The table and the lane show the difference.

To slice a song:

1. Choose the slots in **From** and **To**. Each segment between them gets one piece, and **To** lists how many pieces that makes.
2. Place the cuts. **Original proportions** spreads the original lengths over the whole song. **Original lengths** cuts at exactly the original lengths, so the last piece can end before the song does. **Even** cuts the song into equal pieces.
3. Adjust the cuts. Drag a cut to move it, and hold Shift to stop it from snapping to the original length. Double-click the song to add a cut. Select a cut and press Delete to remove it, or nudge it with ←/→ (Shift moves 100 ms, Alt moves 1 ms). **Start** and **End** can skip an intro or an outro.
4. Listen. **Song** plays the song, and **Originals** plays the original audio of the slots one after another. Click the song or the original to play from that point, or press ▶ on a piece or on the original beside it in the table. Space plays and pauses.
5. Zoom with Ctrl+wheel or the buttons. Scroll with the wheel or the strip under the lanes. Click a row of the table to bring that piece into view.
6. Press **Slice and fill**. Audiodiver saves the pieces in the `audio\slices` folder of the project and fills the slots.

Audiodiver keeps the cuts for each song, so you can slice the same song again from where you left off.
