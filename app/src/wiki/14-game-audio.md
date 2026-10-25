---
title: Game audio, explained
group: Getting started
summary: How Helldivers 2 stores and plays audio, from archives and banks down to takes and slots, why the app names things as it does, and a glossary.
---

Helldivers 2 plays audio with **Wwise**, an audio engine that many games use. Wwise has no concept of songs or named files. It stores clips in containers, gives everything a number, and decides during play which clip comes next. Audiodiver turns that structure back into things a player recognises, and the terms on this page are the ones shown on screen.

## Where the audio is stored

From the largest to the smallest:

1. An **archive** is one of the files in the game's `data` folder, named with a 16-character code like `2e24ba9dd702da24`. An archive usually holds the audio for one thing, such as a weapon, a faction's music, or a voice in one language. **All Archives** lists them.
2. A **bank** is a Wwise sound bank inside an archive. It holds clips and the **sounds** that play them. The *In the archive …* line at the top of the middle panel names both the archive and the bank.
3. A **sound** is one thing the game can trigger, like *autocannon shot* or *"Reloading!"*. A sound has one or more **takes** and plays one of them each time.
4. A **take** is one recording of a sound. A rifle shot has several takes, and the game picks one at random so that no two shots sound the same. A take is the clip that a replacement changes.

Long audio such as music and voice lines is often **streamed**, which means the clip is stored in the archive next to the bank. Audiodiver finds the clip in both cases.

## Why many things are called "Sound 3" or "Take 2"

The game files contain numbers and no names. The names in Audiodiver come from community documents (listed in [About ▸ Credits](app:about)) and from what Audiodiver can work out:

- A sound without a name is called **Sound 1**, **Sound 2** and so on, in the order of the bank. Listen to it to find out what it is.
- The takes of an unnamed sound are called **Take 1**, **Take 2** and so on. A transcribed take, such as a voice line, is named after what it says.
- A sound set or archive without a name is named after the archive code and is marked *Not named yet*.

For example, "Sound 4 › Take 2" is the second recording of the fourth sound in the bank. To replace a sound, give every take new audio. Otherwise the game sometimes picks an original.

## Other Audio and No Audio in the Game Files

Two groups can appear at the end of a sound set, after the named and numbered sounds:

- **Other Audio** holds clips that the bank stores or names, but that none of the sounds in it play. A sound in a different bank usually plays them. They can be played and replaced like any clip, but there is no information on what they are for.
- **No Audio in the Game Files** holds clips that the bank data names, but that the installed game files don't include. They are cut content or parts of the game that aren't installed. Their ▶ button is disabled and fills skip them.

## How music is put together

Helldivers 2 music is built to change with the action. Audiodiver uses these terms for it:

- A **cue** is a playlist of segments, one piece of music as the game data defines it. A **+3 cues** tag on a slot means the same clip plays in three other pieces of music.
- A **piece of music** is what the Index lists, like *Loadout Selection*. It is one cue, or several cues that belong together.
- A **part** is one cue of a piece, shown as a tab (as a line of the list for transitions and stingers). A piece can have a part for each biome, each intensity, or each language of a voice. Each part has a separate set of slots.
- A **segment** is a stretch of music that plays as a unit, with an **Entry** and an **Exit** point. The next segment starts at the Exit, and the end of the current segment rings out over it.
- A **layer**, or stem, is one of several clips that a segment plays at the same time. Each layer is a separate slot.
- A **slot** is one place where a clip plays, either a take of a sound or a layer of a segment. Audio is replaced one slot at a time, with one file per slot.
- A **variant** is a slot that plays only under a condition, like a biome. The row shows the condition.
- A **transition** (↝) is a short piece that plays between two pieces of music. A **stinger** (✦) is a short piece that plays over the music.

[How the game plays music](wiki:how-the-game-plays-music) has more detail.

## Ids

Every clip, sound, bank and cue has a number, and the game files use only these numbers. Paste an id from notes or from another tool into a search box to find where it is. The top of the details shows the **stream id** of a slot, or the **source id** (the clip id) when the audio is only inside a bank. Projects stay valid when a game update changes ids.

## Glossary

| Word | Meaning |
|---|---|
| Archive | A file in the game's `data` folder. Holds banks and streamed clips. |
| Assignment | A file, or silence, given to a slot. |
| Bank | A Wwise sound bank, with clips and the sounds that play them. |
| Category, section | How the Index sorts things, as in Weapons ▸ Support Weapons. |
| Cue | A playlist of segments, one piece of music as the game data defines it. |
| Entry, Exit | A segment's cue points. Entry is where it counts as started, and Exit is where the next one starts. |
| Fill | Assigning several files to slots in play order in one action. |
| Group | A sound with the takes it plays from, shown as one line that folds open. |
| Index | The Library's sorted list of everything that has a name. |
| Layer, stem | Clips that a segment plays at the same time. |
| New audio | The file that replaces a slot's original. |
| Original | The game's audio in a slot. |
| Part | One cue of a piece of music or one language of a voice, shown as a tab. |
| Piece of music | Music a player recognises, made of one or more cues. |
| Play through | Playing a whole piece with the same hand-overs between segments that the game uses. |
| Project | The `.audi` file, which records what the mod works on and the assignments. |
| Replaced | A slot that plays new audio, or silence, in place of the original. |
| Segment | A stretch of music that plays as a unit. |
| Silence, Skip | Replacing a slot with nothing. Skip does this to a transition so that the game moves straight on. |
| Slot | One place where a game clip plays. |
| Sound | Something the game triggers. It plays one take each time. |
| Sound set | The sounds of one thing, such as a weapon, an enemy or a voice. |
| Source id | A clip's number in the game files. |
| Stinger | A short phrase that plays over the music. |
| Stream | A clip stored next to a bank, outside it. |
| Stream id | A stream file's 64-bit number. |
| Take | One recording of a sound. The game picks one at random. |
| Transition | A short piece that plays between two pieces of music. |
| Variant | A slot that plays only under a condition. |
| Wwise | The audio engine the game uses. |
