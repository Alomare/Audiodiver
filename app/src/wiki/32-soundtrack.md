---
title: Soundtrack
group: Making a mod
summary: How each piece of music plays, in the original order, as one song, as a playlist, silent, or as the battle music.
---

The game doesn't play a piece of music top to bottom. The playlist of a piece mixes groups that play in order, groups that play the next segment each time, and groups that pick at random. Most combat music starts each fight on a short opening, and a new fight goes on from where the last one stopped. A song cut into the slots in list order plays out of order in game.

The [Soundtrack](app:soundtrack) tab lists all music and sets how each piece plays. Builds write that order into the music.

## Music

The list on the left has all music in the game, by where you hear it. Each row says how the music plays, with the level when it isn't 0 dB, and **Mixed** means the parts of a piece play in different ways. Music with several parts, like Arrival with one for each biome, shows them as tabs. The search box finds music by section, name or mode, such as *Illuminate* or *Playlist*, and {icon:collapse} **Collapse all** folds every section.

**Templates** set much music at once:

- **Battle songs** sets every enemy's Intense Battle to **Same as Battle**, so one song covers a fight.
- **Quiet exploring** sets every enemy's Exploring music to **Silent**.
- **No openings** leaves the short openings out of the battle music, so fights start on the music itself.
- **Original** sets all music back to the original order. The new audio stays in the slots.

Undo takes back a whole template. A template that finds nothing to change says so.

## Modes

| Mode | What plays |
|---|---|
| **Original** | The segments in their original order. Untick a segment in the play order to leave it out of this music. It still plays wherever else the game uses it. |
| **One song** | One song, cut into the segments. Each fight plays an opening, then the song from piece 1. |
| **Playlist** | Whole songs, one in each place, in order or shuffled. |
| **Silent** | Nothing. |
| **Same as Battle** | For Intense Battle. The battle music plays on from the segment it is at, so the song doesn't start over when a fight gets heavier. |

**Level** raises or lowers the whole piece by up to 96 dB, on top of each slot's Make-Up Gain. Drag the slider, or type a value in the box beside it. {icon:reset} sets it back to 0 dB. Silent music and music set to Same as Battle don't play, so Level is off for them.

**Copy to…** sets the music of the same name in other places the same way, for example the Battle music of every enemy. A playlist puts each song at the same place, and One song puts the pieces in order. Where there are fewer places, the last songs or pieces are left out, and a note says so.

## One song

**Choose a song…** opens the slice tool with the segments the song fills. A song dropped on the page opens it too. Cut it into as many pieces as you like, up to one per segment. Each piece goes whole into one segment. The first layer gets the piece and the other layers play silence. In the Extraction music, the first layer at low intensity and the first at high intensity both get it.

**Change the cuts…** opens the slice tool again with the same song and the same cuts. **Choose another song…** starts with a new one.

## Playlist

A playlist has a line for each place a song can go, in play order. Click a place, or drop a song on it, to put a song there. Several files chosen or dropped on a place fill it and the places after it, in file-name order. **Add songs…** fills the empty places. Drag a song to another place to move it, and the songs between move one place along. ↑ and ↓ on the line, or {key:moveUp} and {key:moveDown}, move a song one place, and ✕ takes it out of the playlist. The file stays on disk.

Empty places don't play. **Shuffle** plays the songs in a random order, and no song plays twice before the others have played. **Continue in the next fight** starts each fight on the song after the one the last fight stopped on. Without it, each fight starts again from the first song. For music outside combat the option is **Continue next time**.

When the music changes, for example from exploring to battle, it leaves a song at the next bar with a short fade, without waiting for the song to end.

## Openings

Most combat music starts each fight on a short opening, one segment from a group of them, before the music itself. The play order marks that group **Fights start here**. Some music outside combat starts the same way each time it comes on.

**One song** and **Playlist** keep the openings, so a fight starts on an original opening and the song or the playlist follows. To change what plays there:

- Replace the openings in the [Audio](app:editor) tab, like any other slot, with new audio or with silence. Silence with **Keep original duration** off moves straight on to the song ([Silence](wiki:how-the-game-plays-music#silence)).
- For music in **Original**, untick the openings in the play order to leave them out, or use the **No openings** template for the battle music of every enemy at once.

## Listening

Each line has the original on the left and the new audio on the right, each with ▶, like a slot in the Audio tab. Click a line, or a segment in the play order, to select it. The waveforms of the selected segment show at the bottom, the original on top and the new audio under it, with **Entry** and **Exit**. Click a waveform to play from that point. {key:selectPrev} and {key:selectNext} select the segment before or after, and {key:playGame} and {key:playMine} play the original or the new audio of that segment.

The round buttons at the top play a whole fight, the grey one with the original music and the yellow one with the project's order and audio. **Fight length** sets how long the fight lasts. The fight ends with the segment playing at that time, and **Next fight** goes on from there. For music outside combat these are **Plays for** and **Play again**. While a fight plays, a bar shows where it is (click it to move there), and the segment playing lights up and is selected, so the waveforms follow the fight. A line under the bar lists the segments of the fight in the order they played.

{icon:header} and {icon:waves} at the end of that bar hide or show the header and the waveforms. Drag the edges under the header, above the waveforms and beside the list to resize them. **Slots**, beside the name of the music, opens it in the [Audio](app:editor) tab.

## Play order

The play order shows the piece as groups of segments. Each group says what it does with them:

- **In order** plays them one after another.
- **Next each time** plays one each time, the next in order. A new fight goes on from where the last one stopped.
- **Shuffled** plays all of them in a random order.
- **One at random** plays one, picked at random.

**Repeats** marks a group that plays again until the music changes, and **3 times** one that plays three times, then moves on. **Fights start here** marks where the music starts when a fight begins ([Openings](wiki:soundtrack#openings)), and **Starts here** where other music starts each time it comes on. The ▶ on a segment plays what the project plays there.

## Layers

Music that plays several layers at once, like the Extraction music, shows them as a grid: a row for each segment, and a column for each layer at low and at high intensity. Click a cell to see the waveforms. Replace layers in the [Audio](app:editor) tab.
