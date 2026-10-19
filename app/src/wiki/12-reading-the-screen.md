---
title: Reading the screen
group: Getting started
summary: What each part of the Library and the Audio Editor shows, and what the tags and marks on a row mean.
---

The Library and the Audio Editor share one layout: a list on the left, what is open in the middle, and (in the Audio Editor) the selected slot's settings on the right. Words in **bold** are explained in [The game's audio, explained](wiki:game-audio).

## The list on the left

- **Index**: the game's audio by what it is. Categories (Music, Weapons, Enemies…) hold sections (*On the Ship*, *Shotguns*…), and sections hold what opens: a **piece of music** or a **sound set**. The number at the end of a row is a length for music and a count of sounds for the rest.
- **All Archives**: every **archive** with audio, as a table. Click a heading to sort by it, again to reverse. The *Index* column's icons are the categories that know the archive.
- Library: **+** at the end of a row adds it to the project, **✓** means the project has it. A category or section line has a **+** too, for everything in it that shows: a search followed by **+** adds just what it found.
- Audio Editor: the list holds what the project has. **✕** on a row, or on a category or section line, takes it off the project with its new audio; right-click does the same. {key:undo} brings it back.
- {icon:collapse} **Collapse all**, next to the search, folds every category and section. A search opens whatever it finds.

## The head of the middle panel

- **The path and the title**: where the Index has it (*Weapons*, *Helldivers ▸ Voices*) and its name.
- **Original**, **Partly replaced** or **Replaced** (Audio Editor): what it plays now.
- **In the archive …**: the archive that holds it (click to open it in All Archives), then the **bank**'s name in the game files.
- **Shares audio with**: other things that play some of the same clips. A replacement there changes it here too.
- **N transitions play next to this music** (music only): the short pieces into and out of it. **Show** lists them with what they play now.

## The toolbar

**Add to the project** (Library), or **Fill from files…**, **Slice a song…**, **Export…** and the rest (Audio Editor). **Play through** plays a whole piece of music the way the game does, segment after segment: **Original** or **Replaced**. In a big sound set, **Filter these sounds** narrows the list by name, words of a voice line, or id.

## Parts

Under the toolbar, tabs switch between the **parts** of what is open: the biomes or intensities of a piece of music, the languages of a voice, the versions of a transition. The number on a tab is its length, or its count of sounds.

## The slots

Each row is one **slot**: one clip of the game's audio, replaceable.

- **Music** lists its **segments** in play order. A segment's first row carries its name; rows under it are its other **layers**.
- **Sounds** come in **groups**: one line per sound, its **takes** folded under it. ▶ on the line plays the first take; files dropped on it fill the takes in order; right-click it to fill, silence or clear all its takes at once.
- The left of a row is the original: ▶ plays it, its length closes that part. The right is the replacement (Audio Editor): ▶ plays the new audio, its file name picks another file, ✕ removes it. An empty slot says *Drop audio or choose a file*.
- Double-click a row to play it. Right-click for everything else: copy, paste, silence, ids.

### Tags on a row

| Tag | Means |
|---|---|
| {icon:link} **+3 cues** / **+5 banks** / **+8 more** | Linked: the game plays the same clip in that many other places, and a replacement changes all of them. |
| {icon:link} **in 104 other banks** (on a group) | Every sound of the group is a shared copy, like the handling sounds every weapon carries. |
| **loops**, **×2** | The segment repeats until the game moves on, or that many times. |
| a condition, like *Desert* | A **variant**: the slot plays only when that holds. |
| **never heard** | Listed in the game's data, but nothing plays it: a replacement changes nothing. |
| **do not touch** | Replacing it makes the music stutter. Fills skip it. |
| **no audio** | Named in the game's data, but not in the installed game files: nothing to play or replace. |
| **quiet drums** | A barely audible drum layer under another layer of the segment. |
| **never plays** | In the game files, but the game never plays it (the Illuminate Void's own death music). |
| a coloured tag | What the Index knows about it. Click it to open that thing. |

Hover a tag to read its note. Selecting a clip shows its notes in the details: when it plays, or a warning, like a minimum length for new audio.

### Marks

| Mark | Means |
|---|---|
| ○ ◐ ● | Original, partly replaced, replaced. |
| ↝ | A **transition**: it plays between two pieces of music. |
| ✦ | A **stinger**: it plays over the music. |
| ×3 | It has three **parts**. |
| **!** | An original transition plays next to new music. See [How the game plays music](wiki:how-the-game-plays-music). |

## Under the slots

The selected slot's **waveforms**: the original, and the replacement under it in the Audio Editor, on one time scale, with the **Entry** and **Exit** points. Click a waveform to play from there; drag its top edge to resize it. In the Library, the line above it says what the slot is: its id (click to copy), length, when it plays, and where else the game plays it.

## The right panel (Audio Editor)

The selected slot's settings: what replaces it (the file, with a button to show it in its folder, or silence and its timing), **Make-Up Gain** ([what that is](wiki:volume)), **Fit timing to the new audio**, its **cue points**, its notes and **Also plays in**. With several slots selected, it sets their Make-Up Gain or silence together. Playing and choosing files happen on the slot's row.

## The bars

- **Left**: the tabs, with {icon:updates} Updates, the Wiki and Settings at the bottom. The open tab takes the colour of its page; tabs *inside* a page (Index and All Archives, a piece's parts, Settings' sections) are underlined instead. A dot on Updates means a new version of Audiodiver is out.
- **Bottom**: undo and redo, the project's file, the **Export list** once something is on it, what is playing (click it to go there), **Vol**, the preview volume (not part of the mod), and the version: it opens Updates, and the {icon:info} beside it opens [About](app:about).

Short confirmations (*Loadout Selection added to My Mod*, *My Mod saved*) show for a moment at the bottom of the window. Notices that need reading or have a button (Undo, Show in folder) show at the bottom right.

## Ids

Every slot shows its **source id** at the end of its row: click to copy. Right-click the row for all its ids: the **source** id, the 64-bit **stream** id of the file that holds its audio (the id older tools use), the **Sound** that plays it in a bank, or the music **track** it is a layer of. Search takes any of them.

## The export list

**Export…** saves what is open. To export things from all over at once, right-click slots, a group of takes, anything in the Index, a category or section line, or an archive, and choose **Add to the export list**. The **Export list** button in the status bar shows it: rename an entry to name its folder, take entries off, and export them all as one job. The list stays until cleared.

## Colours

- The **primary colour** (Super Earth yellow) fills the main buttons and marks what is replaced: new audio, edits, the project.
- The **secondary colour** (blue) navigates and informs: links, the open tab, the selection, the focus ring. On the light theme it also draws the primary colour's text and lines.
- Neutral gray is the original.

Both colours, the theme, contrast and **Night mode** are in [Settings ▸ Theme](app:settings/theme).
