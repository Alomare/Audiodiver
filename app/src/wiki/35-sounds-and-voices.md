---
title: Sounds and voices
group: Making a mod
summary: Weapons, enemies, voices and all other audio that isn't music. How the Library shows them, and what to check before you replace one.
---

Audiodiver has the most information about the game's music, but the Library contains all of the game's audio. This page covers everything other than music.

## Sound sets

Outside the music, the Index lists **sound sets**. A sound set holds the sounds of one weapon, stratagem, enemy, voice or type of planet, under the name the game shows to players.

The sounds in a set are shown in groups. Each group is one sound with its **takes**, and the game picks one take at random each time the sound plays. To replace a sound completely, give every take new audio. Otherwise the game still mixes in the originals. Files dropped on a group's line fill its takes in order. Right-click the line to fill, silence or clear all of its takes.

Most groups have only numbers as names, like *Sound 1* and *Take 2* ([why this happens](wiki:game-audio)), so you have to listen to them. ▶ on a group's line plays its first take. In a large set the groups start folded, and **Filter these sounds** finds a sound by a word or an id. The same page explains the **Other Audio** and **No Audio in the Game Files** groups.

You can also add audio that the game doesn't have, such as more takes for a sound or a layer that plays with it. See [Adding audio](wiki:adding-audio).

## Sounds that many things share

The game keeps copies of some sounds in many places. For example, the bank of every weapon contains the weapon handling sounds. A group like this shows **in 104 other banks** and comes after the sounds that belong to the set alone.

Replacing a shared sound changes it everywhere the game plays it. The details list those places under **Also plays in**. The mod also includes a copy of every bank it changes, so replacing a widely shared sound makes the mod large.

## Voices

A voice has one part for each installed language, such as *English* and *Italian*. Each language has separate recordings. If you replace a line in the English part, only players who play in English hear the change.

A voice line is named after the words of its subtitle, and the filter can find it by those words. When several takes say the same line, both the group and each take show the line's words.

Sounds without words are named after what they are, like *Grunt 1* or *Panting 3*, and numbered separately for each voice. Grunts are short sounds of effort. **Panting** covers the longer breathing, sighs and laughs. Most of these sounds are at the end of a Helldiver voice and in **Helldiver Exertions**, in groups called **Grunts** and **Panting**. Each of these clips is shared by two Helldiver voices (voices 1 and 3, and voices 2 and 4), so a replacement is heard in both.

When a voice line has a subtitle, its details show a **Subtitle** link. The link opens the line in the [Text Editor](wiki:text), where you can change the words too.

## All Archives

The Index contains only audio that has a name. **All Archives** contains every archive that has audio. Archives that are in the Index show a name and the icons of their categories, and the others show *Not named yet*. Sort by **Sounds** to find the largest archives, or by **Language** to find a voice pack.

When a game update adds new audio, look for it in All Archives. You can listen to it, add it to the project and replace it immediately.

Both lists accept ids as well as words. Paste a source id, a stream's file id or a bank's id, and the list shows where it is.
