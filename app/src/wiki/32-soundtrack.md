---
title: Soundtrack
group: Making a mod
summary: How each piece of music plays, in its original order, as one song, as a playlist, silent, or as the battle music.
---

The game doesn't play a piece of music top to bottom. Its playlist mixes groups that play in order, groups that play the next segment each time, and groups that pick at random. Most combat music starts each fight on a short opening, and a new fight goes on from where the last one stopped. A song cut into the slots in list order plays out of order in game.

The [Soundtrack](app:soundtrack) tab lists all music and sets how each piece plays. Builds write that order into the music.

## Music

The list on the left has all music in the game, by where you hear it. Each row says how the music plays, and **Mixed** means its parts play in different ways. Music with several parts, like Arrival with one for each biome, shows them as tabs.

**Templates** set much music at once:

- **Battle songs** sets every enemy's Intense Battle to **Same as Battle**, so one song covers a fight.
- **Quiet exploring** sets every enemy's Exploring music to **Silent**.
- **No openings** leaves the short openings out of the battle music, so fights start on the music itself.
- **Original** sets all music back to its original order. The new audio stays in the slots.

## Modes

| Mode | What plays |
|---|---|
| **Original** | The segments in their original order. Untick a segment in the play order to leave it out of this music. Its slots keep playing wherever else the game uses them. |
| **One song** | One song, cut into the segments. Each fight plays an opening, then the song from piece 1. |
| **Playlist** | Whole songs, one in each place, in order or shuffled. |
| **Silent** | Nothing. |
| **Same as Battle** | For Intense Battle. The battle music plays on from the segment it is at, so the song doesn't start over when a fight gets heavier. |

**Level** raises or lowers the whole piece, on top of each slot's Make-Up Gain.

**Copy to…** sets the music of the same name in other places the same way, for example the Battle music of every enemy. A playlist puts each song at the same place, and One song puts its pieces in order. Where there are fewer places, the last songs or pieces are left out, and a note says so.

## One song

**Choose a song…** opens the slice tool with the segments the song fills. A song dropped on the page opens it too. Cut it into as many pieces as you like, up to one per segment. Each piece goes into its segment whole. The first layer gets the piece and the other layers play silence. In the Extraction music, the first layer at low intensity and the first at high intensity both get it.

**Change the cuts…** opens the slice tool again with the same song and its cuts. **Choose another song…** starts with a new one.

## Playlist

A playlist has a line for each place a song can go, in play order. Click a place, or drop a song on it, to put a song there. Several files chosen or dropped on a place fill it and the places after it, in file-name order. **Add songs…** fills the empty places. On a line with a song, ↑ and ↓ move it, and ✕ takes it out of the playlist. The file stays on disk.

Empty places don't play. **Shuffle** plays the songs in a random order, and no song plays twice before the others have played. **Continue in the next fight** starts each fight on the song after the one the last fight stopped on. Without it, each fight starts again from the first song.

When the music changes, for example from exploring to battle, it leaves a song at the next bar with a short fade, without waiting for the song to end.

## Listening

Each line has the original on the left and the new audio on the right, each with ▶, like a slot in the Audio tab. Click a line, or a segment in the play order, to select it. Its waveforms show at the bottom, the original on top and the new audio under it, with **Entry** and **Exit**. Click a waveform to play from that point. {key:selectPrev} and {key:selectNext} select the segment before or after, and {key:playGame} and {key:playMine} play its original or its new audio.

The round buttons at the top play a fight as the game plays it, the grey one with the original music and the yellow one with the project's order and audio. **Next fight** goes on from where the last fight stopped, and the length sets how long a fight lasts. While a fight plays, a bar shows where it is (click it to move there), and the segment playing lights up and is selected, so its waveforms follow the fight.

{icon:header} and {icon:waves} at the end of that bar hide or show the header and the waveforms. **Slots**, at the top right, opens the music in the [Audio](app:editor) tab.

## Play order

The play order shows the piece as groups of segments. Each group says what it does with them:

- **In order** plays them one after another.
- **Next each time** plays one each time, the next in order. A new fight goes on from where the last one stopped.
- **Shuffled** plays all of them in a random order.
- **One at random** plays one, picked at random.

**Repeats** marks a group that plays again forever. **Fights start here** marks where the music starts when a fight begins. The ▶ on a segment plays what the project plays there.

## Layers

Music that plays several layers at once, like the Extraction music, shows them as a grid: a row for each segment, and a column for each layer at low and at high intensity. Click a cell to see its waveforms. Replace layers in the [Audio](app:editor) tab.
