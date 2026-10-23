---
title: How the game plays music
group: Making a mod
summary: Segments, loops, layers, variants, transitions and stingers, and what each one means for a replacement.
---

Helldivers 2 doesn't play songs from start to end. It plays music in pieces and decides from moment to moment what comes next. Knowing how the pieces work lets you cut new music to fit them.

## Segments and slots

A piece of music is a chain of **segments**, and each segment holds one or more **slots** (clips). When a segment reaches the **Exit** point, the next segment starts and the rest of the first one rings out over it.

For example, the drop location screen plays a start segment once, then fourteen loops in order. It repeats the loops until the screen closes. Where a piece starts depends on what played before. The loadout screen that comes next skips the start segment and continues the loops from where the drop location music stopped.

## Layers

Some segments play several slots at the same time, as layers named *Stem 1*, *Stem 2* and so on. The bridge music on the ship has three layers. A layer that isn't replaced keeps playing the original under the new audio. Replace every layer you don't want to hear.

## Variants

A slot with a condition, such as a biome, plays only when that condition is met. The row shows the condition. To change a piece that has variants, give each variant new audio.

## Transitions and stingers

**Transitions** (↝) play between two pieces of music, for example from the ship music into the hellpod. A transition plays the original until it is replaced, so an original transition can end up between two pieces of new music. The Audio Editor warns about this above the list and marks those transitions with **!**. **Skip** adds them to the project and replaces them with silence, so the game moves straight on.

**Stingers** (✦) play over the music at certain moments, like the fanfare when you complete a main objective.

## Silence

Any slot can play silence in place of the original, without a file. Right-click the slot and choose **Replace with silence**, or select it and press **Use silence** in the details. **Keep original duration** in the details sets how the silence affects the timing:

- On, which is the default, the slot stays silent for as long as the original would play, so the timing doesn't change. Use this to mute one layer of a piece, or to keep a pause from the original.
- Off, the game continues to the next segment at once. **Skip** silences transitions and stingers this way.

✕ on the row removes the silence.

## Shared audio

The game reuses some clips in several places, and replacing a shared clip changes it in all of them. A slot with a shared clip shows **+N cues**, and the details list the other places under **Shared with**.

Leave slots tagged **never heard** or **do not touch** alone. [Reading the screen](wiki:reading-the-screen) explains these tags.
