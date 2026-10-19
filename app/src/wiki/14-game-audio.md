---
title: The game's audio, explained
group: Getting started
summary: Archives, banks, sounds, takes, cues, segments and slots: how Helldivers 2 keeps and plays its audio, and why the app names things as it does. A glossary closes the page.
---

Helldivers 2 plays its audio with **Wwise**, an audio engine many games use. Wwise doesn't think in songs or named files: it keeps clips in containers, numbers everything, and decides during play which clip comes next. Audiodiver turns that back into things a player recognises. The words below are the ones on screen.

## Where the audio is kept

From the biggest to the smallest:

1. **Archive**: one of the game's files in its `data` folder, named by a 16-character code like `2e24ba9dd702da24`. One archive usually holds the audio of one thing: a weapon, a faction's music, a voice in one language. **All Archives** lists them.
2. **Bank**: a Wwise sound bank inside an archive. It holds the clips and the **sounds** that play them. *In the archive …* at the top of the middle panel names both.
3. **Sound**: one thing the game can trigger, like *autocannon shot* or *"Reloading!"*. It isn't a clip: it picks one of its **takes**.
4. **Take**: one recording of a sound. A rifle shot has several, picked at random, so no two shots sound alike. This is the clip a replacement changes.

Long audio (music, voice lines) is often **streamed**: the clip sits in the archive next to the bank. It makes no difference here; Audiodiver finds it either way.

## Why so many things are called "Sound 3" or "Take 2"

The game files have numbers, not names. Names come from community documents (see [About ▸ Credits](app:about)) and from what Audiodiver can work out:

- A sound without a name is **Sound 1**, **Sound 2**… in the bank's order. Listen to find out what it is.
- Its takes are **Take 1**, **Take 2**…, unless the take is transcribed: a voice line goes by its words.
- A sound set or archive without a name goes by its archive's code, and says *Not named yet*.

So "Sound 4 › Take 2" is the second recording of the fourth sound in the bank. Replace every take of a sound, or the game will sometimes play an original.

## Other Audio and No Audio in the Game Files

At the end of a sound set, two groups can follow the named and numbered sounds:

- **Other Audio**: clips the bank holds or names that none of its own sounds play. Usually a sound in *another* bank plays them. They play like any clip, but nothing says what they are for.
- **No Audio in the Game Files**: named in the bank's data, but not in the installed game files. Cut content, or part of the game that isn't installed. Nothing to play or replace: their ▶ is off and fills skip them.

## How music is put together

Music is built to change with the action.

- **Cue**: one piece of music as the game's data defines it: a playlist of segments. **+3 cues** on a slot means the same clip plays in three other pieces of music.
- **Piece of music**: what the Index lists, like *Loadout Selection*. One cue, or several that belong together.
- **Part**: one cue of a piece, shown as a tab: per biome, per intensity, per language of a voice. Each part has its own slots.
- **Segment**: a stretch of music played as a unit, with an **Entry** and an **Exit** point. At the Exit the next segment starts, while the end of this one rings out over it.
- **Layer** (or stem): clips a segment plays at once, stacked. Each layer is its own slot.
- **Slot**: one clip in its place: a take of a sound, or a layer of a segment. The unit of replacement: one slot, one file.
- **Variant**: a slot that plays only under a condition, like a biome. The row shows the condition.
- **Transition** (↝) and **stinger** (✦): short pieces between two pieces of music, or over one.

[How the game plays music](wiki:how-the-game-plays-music) has the details.

## Ids

Every clip, sound, bank and cue has a number, and the game files only know those. An id from notes or another tool can be pasted into a search box to find where it is. A slot's **source id** (the number at the top of the details) is the clip's id; projects stay valid when a game update changes ids.

## Glossary

| Word | Meaning |
|---|---|
| Archive | One of the game's files in its `data` folder. Holds banks and streamed clips. |
| Assignment | A file (or silence) on a slot. |
| Bank | A Wwise sound bank: clips and the sounds that play them. |
| Category, section | How the Index sorts things: Weapons ▸ Shotguns. |
| Cue | One piece of music as the game's data defines it: a playlist of segments. |
| Entry, Exit | A segment's cue points: where it counts as started, and where the next one starts. |
| Fill | Assigning several files to slots in play order at once. |
| Group | A sound and its takes, shown as one folding line. |
| Index | The Library's sorted view of everything with a name. |
| Layer, stem | Clips a segment plays at the same time. |
| New audio | The file that replaces a slot's original. |
| Original | The game's own audio in a slot. |
| Part | One cue of a piece of music or one language of a voice, shown as a tab. |
| Piece of music | Music a player recognises; one or more cues. |
| Play through | Playing a whole piece the way the game hands over between its segments. |
| Project | The `.audi` file: what the mod works on, and its assignments. |
| Replaced | A slot that plays new audio (or silence) instead of the original. |
| Segment | A stretch of music played as a unit. |
| Silence, Skip | Replacing a slot with nothing; Skip does it to a transition so the game moves straight on. |
| Slot | One clip of the game's audio in its place. |
| Sound | Something the game triggers; it plays one of its takes. |
| Sound set | The sounds of one thing (a weapon, an enemy, a voice). |
| Source id | A clip's number in the game files. |
| Stinger | A short phrase played over the music. |
| Stream | A clip kept next to a bank instead of inside it. |
| Take | One recording of a sound; the game picks one at random. |
| Transition | A short piece played between two pieces of music. |
| Variant | A slot that plays only under a condition. |
| Wwise | The audio engine the game uses. |
