---
title: A first mod
group: Getting started
summary: From an empty project to new music in game, in nine steps.
---

This page goes through replacing the music of the loadout screen and hearing the result in game, installed with a mod manager.

1. On [Home](app:home), choose **New Project** and give the project a name. Audiodiver makes a folder for it, with the project file inside, in the projects folder (`Documents\Audiodiver\Projects` at first). The [Project](app:project) tab opens with the mod name, icon and folder. Copy the audio files into that folder.
2. Go to the [Library](app:library). In the Index, open **Before the Drop** under Music and press ▶ next to **Loadout Selection** to hear it.
3. Click **Loadout Selection**. It has a start segment followed by fourteen loops that the game plays in order. In game, the loadout screen comes after the drop location screen and the music continues from there in the loops, so the start is rarely heard. Press **Add to the Project**.
4. Go to the [Audio](app:editor) tab and click **Loadout Selection** in the list.
5. Drag the audio files from Explorer onto the piece in the list, or onto the first slot of the piece. Slots fill in file-name order, so name the files `01 …`, `02 …` and so on.
6. Select a slot and press ▶ on each half of the row. The left half plays the original and the right half plays the replacement. Switching between them keeps the playback position. The waveforms below show both on one time scale.
7. Press the yellow {icon:through} **Play through** button above the slots. It plays the whole piece with the same hand-overs between segments that the game uses, and selects each slot as it plays.
8. On [Project](app:project), give the mod a name and an icon.
9. Press **Build**. Import the ZIP in a mod manager, deploy it and start the game.

> [!TIP]
> Listen in game with normal volume settings, at the changed moments. The game turns the music down on some screens. See [Make-Up Gain and the mix](wiki:volume) for details.

## Next steps

- Add more from the Library. A piece with several parts has {icon:fillpiece} **Fill the whole piece**, which takes files for all parts at once.
- Weapons, enemies, voices and other sounds are in the Index too. See [Sounds and voices](wiki:sounds-and-voices).
- {icon:slice} **Slice a song** cuts one long song into pieces that play back without gaps. See [Timing, cue points and loops](wiki:timing-and-loops).
- After a change, build again and import the new ZIP. The mod manager updates the installed mod. See [Building and installing](wiki:build-and-install).
