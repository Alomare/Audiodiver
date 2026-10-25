---
title: Sounds and voices
group: Making a mod
summary: Weapons, enemies, voices and all other audio that isn't music. How the Library shows them, and what to check before you replace one.
---

Audiodiver has the most information about music, but the Library contains all of the game's audio. This page covers everything other than music.

## Sound sets

Outside the music, the Index lists **sound sets**. A sound set holds the sounds of one weapon, stratagem, enemy, voice or type of planet, under the name players see in game.

The sounds in a set are shown in groups. Each group is one sound and the **takes** it plays from. The game picks one take at random each time the sound plays. To replace a sound completely, give every take new audio, or the game still mixes in the originals. Files dropped on a group's line fill the takes in order. Right-click the line to fill, silence or clear all takes.

Most groups have only numbers as names, like *Sound 1* and *Take 2* ([why this happens](wiki:game-audio)), so listen to tell them apart. ▶ on a group's line plays the first take. In a large set the groups start folded, and **Search sounds** finds a sound by a word or an id. The same page explains the **Other Audio** and **No Audio in the Game Files** groups.

You can also add audio that the game doesn't have, such as more takes for a sound or a layer that plays with it. See [Adding audio](wiki:adding-audio).

## Weapons

A weapon shot is several sounds that play at the same time, each in a separate group of the set. One shot plays between 3 and 15 of them, depending on the weapon. Most weapons play 6 or more, and the flamethrowers play the most.

A gunshot is usually built from these parts:

| Part | Description |
|---|---|
| Mechanism | The moving parts of the gun, such as the bolt and the trigger. |
| Bass | The low thump of the shot. |
| Transient | The short crack at the start of the shot. |
| Tail | The echo of the shot, and the shot as it sounds from far away. |

The set also holds the handling sounds, such as reloading and the ammunition belt.

To give a weapon a new shot, replace or silence every group that the shot plays. A group left original still plays under the new sound. The groups are numbered, so listen to each one to find which part of the shot it is. You can also replace one part and keep the others, for example to put a heavier bass under the original shot.

Some parts are shared with other weapons, and replacing one changes it on every weapon that has it.

## Sounds that many things share

The game keeps copies of some sounds in many places. For example, every weapon bank contains the weapon handling sounds. A group like this shows **in 104 other banks** and comes after the sounds that only this set has.

Replacing a shared sound changes it everywhere it plays, and the details list those places under **Shared with**. The mod includes a copy of every bank it changes, so replacing a widely shared sound makes the mod large.

## Voices

A voice has one part for each installed language, such as *English* and *Italian*, with separate recordings for each. A line replaced in the English part is heard only by players who play in English.

A voice line is named after the words of the matching subtitle, and the filter finds it by those words. When several takes say the same line, the group and each take show the words.

Sounds without words are named after what they are, like *Grunt 1* or *Panting 3*, and numbered separately for each voice. Grunts are short sounds of effort. **Panting** covers the longer breathing, sighs and laughs. Most of these sounds are at the end of a Helldiver voice and in **Helldiver Exertions**, in groups called **Grunts** and **Panting**. Each of these clips is shared by two Helldiver voices, voices 1 and 3, and voices 2 and 4.

A voice line with a subtitle shows a **Subtitle** link in the details. The link opens the line on the [Text](wiki:text) tab to change the words.

## All Archives

The Index contains only named audio. **All Archives** contains every archive with audio. Archives in the Index show a name and category icons, and the others show *Not named yet*. Sort by **Sounds** to find the largest archives, or by **Language** to find a voice pack.

When a game update adds audio, look for it in All Archives. It can be played, added to the project and replaced right away.

Both lists accept ids as well as words. Paste a source id, a stream file id or a bank id to see where it is.
