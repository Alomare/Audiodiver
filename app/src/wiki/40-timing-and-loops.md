---
title: Timing, cue points and loops
group: Making a mod
summary: How the game moves from one segment to the next, how to make new music hand over cleanly, how to trim and move new audio, and how to slice one song into a cue.
---

## Fitting the timing to the new audio

**Fit timing to the new audio** is on by default for every replaced slot. The segment takes the length of the new clip, and the *Exit* point moves to the end of the clip. The next segment starts when the clip finishes.

Turn the option off only when the clip has to follow the original timing, such as a short sting placed inside a longer segment.

## Entry and Exit

The waveforms under the slots show the original above the replacement, on the same time scale, with cue points:

- **Entry** is where the segment counts as started. Audio before the Entry is a lead-in that plays under the end of the previous segment.
- **Exit** is where the next segment starts. Audio after the Exit rings out over the next segment.

Drag the Exit on the replacement to move the hand-over. To undo, drag it back: let go near the automatic position and it snaps onto it. The details show the same values in milliseconds under **Cue points**.

When one file plays in several segments, **Apply to … more segments with this file** under **Cue points** gives all of them the cue points of the selected one. To set cue points on a selection, select the slots and type the values in the details. A box that shows **Mixed** leaves each segment as it is until you type a value.

> [!TIP]
> Place reverb tails and final hits after the Exit. They overlap the next segment there, which avoids a gap.

## The Waveform Suite

The pencil beside **Old** (the original) or **New** (the new audio) in the waveforms opens the Waveform Suite for the selected slot. The white button before it copies that audio, to paste into other slots or into the Waveform Suite. In the [Soundtrack](app:soundtrack), **Edit Song** and the pencil on a song in a playlist open a song the same way. It trims, splits, moves and fades audio, so simple edits need no other program. This works on every slot: music, sounds and voice lines.

The audio sits on a time line as **blocks**. Each block is a stretch of a file, placed at a chosen time, with a fade in, a fade out, a gain and a volume curve. The original runs along the top for comparison, and a dashed line marks where the original ends. The tools sit in a bar above the time line, and pointing at one shows what it does and the key for it. The time of the cursor shows at the right, over the waveforms.

- Drag the body of a block to move it. Drag the left or right edge to trim it. Drag the small squares on the top edge to fade it in or out.
- Click the time line to place the cursor. To move it, drag the cursor itself, or drag along the ruler at the top.
- Drag from an empty spot to draw a box: every block it touches is selected, on any layer. Shift or Ctrl with a click adds a block to the selection or takes it out, and Ctrl+A selects every block. Selected blocks move, split, duplicate, normalize and go together, and the values beside the time line set the fades and gain of all of them.
- **Split** (S) cuts the selected blocks at the cursor, or the block under the cursor, and each part gets separate fades. **Normalize** (N) sets the gain so the loudest moment of each block reaches −1 dB. **Duplicate** (Ctrl+D) places copies right after the blocks, and **Remove** (Delete) takes them away.
- **Snap Left** and **Snap Right** move the selected blocks until they touch the block before or after them on their layer. **Place at the Start** moves them to the start, and **Place at the End** moves them to end where the original ends (with no original, after the other blocks). **Close Gaps** moves the blocks of the layer back against each other, from the first, and with blocks selected it works on their layers.
- **Magnet** (M) snaps the cursor, edges and blocks to each other, to the start and to where the original ends.
- **Volume Curves** (V) shows a line over each block: full level at the top of the block, silence at the foot. Click the line to add a point, and drag a point to shape the volume over time. A double click on a point, or Alt and a click, removes it. While a point is dragged, the level shows beside it in dB. The points stay with the audio when a block is trimmed or split, and **Flatten Curve** beside the time line takes them all away.
- **Add Audio** puts audio files on the time line as new blocks, one after the other from the cursor. Dropping files on the editor does the same, and **Ctrl+V** pastes slots copied with Ctrl+C in the list (their new audio as it plays, or the original) or audio files copied in Explorer. One slot can be made from several files this way, and a slot without new audio can start from files or from the original.
- Beside the time line, type exact values for the selected block in milliseconds.
- **Tempo** plays a block faster or slower, from 50% to 200%, and **Pitch** makes it higher or lower, up to 12 semitones either way. With the link between them on, one moves the other, as a tape played faster would. With it off, each changes alone: the tempo keeps the pitch, and the pitch keeps the tempo.
- **Play** (Space) plays from the cursor, and **Loop** (L) plays the selected blocks over and over. A double click on the time line plays from there. The lanes playing are tinted in their colour.
- Ctrl+Z and Ctrl+Y undo and redo inside the editor. **Reset** goes back to the whole file as it is.
- Zoom with the wheel, Ctrl+wheel and the sliders, as in the waveforms under the slots. Beside the time zoom, {icon:fitsel} shows the selected blocks across the whole width, and {icon:fitlayer} shows the layer from the start to the end of the last block on it. The editor keeps the zoom of each slot for the next time it opens.

### Layers

Blocks sit on **layers**, one under the other. Layers keep blocks apart so each one is easy to see and reach. Every layer plays, all together, and a block sounds the same on any layer.

- **New Layer**, under the time line, adds a layer. Click a layer's name to rename it; Apply keeps the names with the slot. New audio from Add Audio, a drop or Ctrl+V goes onto the layer last clicked, shown in yellow.
- Drag a block up or down to move it to another layer.
- Drag the dots before a layer's name to reorder the layers, and drag the bottom edge of a layer's name to make it taller or shorter. A double click on that edge sets it back.
- The bin deletes a layer. A layer with blocks on it asks first, and Undo brings the blocks back.
- The box before each lane, the original's too, chooses what **Play** plays and what **Export** writes. Tick the original to hear it along with the new audio, or untick every layer to hear it alone. **Apply** keeps every layer, ticked or not.

Blocks on one layer can also overlap, and they play together. Overlapping blocks are drawn see-through, each in another colour, so both stay visible. A click picks the shortest block under it, and another click on the same spot picks the next one, so a block under a longer one can always be selected.

### Music: cue points, context and whole segments

On a slot of a music segment, the segment's **Entry** and **Exit** stand on the time line as lines with flags on the ruler, and their times show over the waveforms. Drag a flag to move the cue point. It snaps to block edges with the magnet on, and let go near the automatic spot it goes back to it. The original's lane shows where the game has them. **Apply** sets the cue points with the blocks.

**Play in Context** (C) plays the end of the segment before, this segment as you have it in the editor and the start of the segment after, handed over at the cue points as the game plays them. Nothing has to be applied first.

**Export**, beside Apply, mixes the lanes ticked into one audio file: WAV, FLAC, MP3 or Ogg Vorbis, at 48 or 44.1 kHz, in the channels of the audio, stereo or mono, and brought to −1 dB at the loudest moment if you choose. The project doesn't change.

Nothing changes until **Apply**. The files stay as they are: the project keeps the blocks, and builds and previews play what the editor shows. Editing the original gives the slot the edited original as new audio, the way copying a slot does. Make-Up Gain applies on top of the result, and choosing another file for the slot starts it unedited.

## Hearing the result

**Play through** plays the whole piece as it plays in game, with the segments in order and each hand-over at an Exit point. Where the game picks segments at random, each play through picks them anew. Compare **Original** and **Replaced** to catch gaps, double hits and jumps in volume before you build.

## Loops

A segment marked **loops** repeats until the game moves on. A segment marked **×2** or a higher number repeats that many times. A loop that ends where it began plays without a seam. Some pieces loop several segments in a row (Loadout Selection plays fourteen), and each of those segments should end at a point where the next one can start.

## Slicing one long song

{icon:slice} **Slice a song** cuts one long file into consecutive pieces at exact sample positions, so the pieces sound like the uncut song when they play back to back. Each piece goes to one segment, in play order. The layers of a segment play together, so all of the pieces go into the layer of the **From** slot. In music whose layers change with the intensity, like the Extraction music, each piece goes into that layer at low and at high intensity, and the other layers without new audio get silence, so the song plays alone.

A cue with one slot, such as a transition, takes one piece: move **Start** and **End** to the stretch of the song it should play. A sound takes one piece too: select one slot of the sound, and **Slice a song** cuts a stretch of the song for that slot. **Original Lengths** makes the stretch as long as the original.

The window shows the song and the original on one time scale:

- The **New audio** lane shows the song, the cuts, and the number and slot of each piece.
- The **Original** lane shows the original audio of each slot, starting at the cut for that piece. A red edge means the original runs past the cut, so the piece is shorter than the original. A dashed line marks where an original ends early, so the piece is longer. The table and the lane show the difference.

To slice a song:

1. Choose the slots in **From** and **To**. Each segment between them gets one piece, and **To** lists how many pieces that makes.
2. Place the cuts. **Original Proportions** spreads the original lengths over the whole song. **Original Lengths** cuts at exactly the original lengths, so the last piece can end before the song does. **Even** cuts the song into equal pieces.
3. Adjust the cuts. Drag a cut to move it, and hold Shift to stop it from snapping to the original length. Double-click the song to add a cut. Select a cut and press Delete to remove it, or nudge it with ←/→ (Shift moves 100 ms, Alt moves 1 ms). **Start** and **End** can skip an intro or an outro. The table shows each time to the millisecond, and **Cut (ms)**, above the song, takes an exact time for the selected cut.
4. Listen. **Song** plays the song, and **Originals** plays the original audio of the slots one after another. Click the song or the original to play from that point, or press ▶ on a piece or on the original beside it in the table. Space plays and pauses.
5. Zoom with the wheel or the slider under the lanes, and draw the lanes taller for a quiet song with Ctrl+wheel or the slider at the right. Scroll with Shift+wheel or the strip under the lanes. {icon:reset}, in the corner, shows the whole song again. Click a row of the table to bring that piece into view.
6. Press **Slice and fill**. Audiodiver saves the pieces in the `audio\slices` folder of the project and fills the slots.

The window has two tabs. **Slicer** cuts the song, as above. **Waveform Suite** edits the song first, with every tool of the [Waveform Suite](#the-waveform-suite): trim it, cut a stretch out, move or fade blocks, or add other audio. Dashed lines on the time line show the cuts, numbered by piece, and they move with the audio they fall on. Back in **Slicer**, the cuts follow the edits:

- Cuts placed by hand stay on the same moment of the music. A cut in a stretch that was removed goes to the nearest edge of what is left, and a piece with no audio left merges into the next one.
- **Original Proportions**, **Original Lengths** and **Even** place the cuts again over the edited song.
- A cut at the start or the end of the song stays at the start or the end.

**Edited** beside the name of the song means the slicer cuts the song as edited. **Slice and fill** saves the edited song as a new file in the `audio\edited` folder, then cuts it. The song you chose stays as it is.

Audiodiver keeps the cuts for each song, so you can slice the same song again from where you left off.
