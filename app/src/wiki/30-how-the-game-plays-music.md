---
title: How the game plays music
group: Making a mod
summary: Segments, loops, layers, variants, transitions and stingers, and what each means for a replacement.
---

Helldivers 2 doesn't play songs from start to end. It plays its music in pieces and decides from moment to moment what comes next. Knowing the pieces helps to cut new music to fit.

## Segments and slots

A piece of music is a chain of **segments**. Each holds one or more **slots** (clips). When a segment reaches its **Exit** point, the next one starts, while the rest of the first one rings out over it.

The loadout screen, for example, plays a start segment once, then fourteen loops in order, again and again until the screen closes.

## Layers

Some segments play several slots at once, as layers: *Stem 1*, *Stem 2* and so on. The bridge music on the ship is three layers. A layer left alone keeps playing the original under the new audio, so replace every layer that shouldn't be heard.

## Variants

A slot marked with a condition (a biome, say) plays only when it holds; the row shows the condition. A piece with variants needs audio for each one to change.

## Transitions and stingers

- **Transitions** (↝) play between two pieces, for example from the ship's music into the hellpod. They play the original until replaced, so an original transition can end up between two pieces of new music. The Audio Editor says so above its list and marks them with **!**. **Skip** replaces them with silence, so the game moves straight on, and adds them to the project.
- **Stingers** (✦) play over the music at certain moments, like the fanfare when a main objective is done.

## Silence

Any slot can play nothing instead of the original, without a file: right-click it and choose **Replace with silence**, or select it and use **Use silence** in the details. The details then set what the silence does to the timing:

- **Move straight on**: the game goes on to what comes next at once. **Skip** does this to a transition or a stinger.
- **Keep the original timing**: the slot stays silent for as long as the original would play, and what plays with it or after it keeps its place. For muting one layer of a piece, or keeping a pause the original had.

✕ on the row removes the silence.

## Shared audio

The game reuses some clips in several places. A slot that does shows **+N cues**, and the details list where else it plays under **Also plays in**. A replacement changes all of them.

Slots tagged **never heard** or **do not touch** are best left alone: see the tags in [Reading the screen](wiki:reading-the-screen).
