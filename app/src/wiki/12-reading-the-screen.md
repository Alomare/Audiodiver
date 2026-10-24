---
title: Reading the screen
group: Getting started
summary: What each part of the Library and the Audio Editor shows, and what the tags and marks on a row mean.
---

The Library and the Audio Editor share one layout. There is a list on the left and the open item in the middle. The Audio Editor also shows the settings of the selected slot on the right. Words in **bold** are explained in [Game audio, explained](wiki:game-audio).

## The list on the left

- **Index** sorts the audio by what it is. Categories such as Music, Weapons and Enemies contain sections such as *On the Ship* and *Primary Weapons*. Each section lists things you can open, either a **piece of music** or a **sound set**. The number at the end of a row is the length of a piece of music, or the number of sounds in a set.
- **All Archives** shows every **archive** that contains audio, as a table. Click a column heading to sort by it, and click again to reverse the order. The icons in the *Index* column show which categories include the archive.
- In the Library, the **+** at the end of a row adds it to the project, and **✓** means the project already has it. Category and section lines have a **+** as well, which adds everything visible under them. After a search, that **+** adds only the results.
- In the Audio Editor, the list shows what the project has. **✕** on a row, or on a category or section line, removes it and its new audio from the project. Right-clicking does the same, and {key:undo} brings it back.
- {icon:collapse} **Collapse all**, next to the search box, folds every category and section. A search unfolds whatever matches.

## The top of the middle panel

- **The path and the title** show where the item is in the Index (*Weapons ▸ Primary Weapons*, *Helldivers ▸ Voices*) and its name.
- **Original**, **Partly replaced** or **Replaced** shows what the item plays now, in the Audio Editor only.
- **In the archive …** names the archive that contains the item, followed by the **bank** name from the game files. Click the archive to open it in All Archives.
- **Shares audio with** lists other things that play some of the same clips.
- **N transitions play next to this music** appears for music only. It counts the short pieces that lead into and out of the music. **Show** lists them and what each one plays now.

## The toolbar

In the Library, the toolbar has **Add to the project**. In the Audio Editor, it has **Fill from files…**, **Slice a song…**, **Export…** and other actions. **Play through** plays a whole piece of music segment by segment, in the same order the game uses, with either the **Original** or the **Replaced** audio. In a large sound set, **Filter these sounds** narrows the list by name, by the words of a voice line, or by id.

## Parts

Tabs under the toolbar switch between the **parts** of the open item. Parts are the biomes or intensities of a piece of music, or the languages of a voice. The number on a tab is a length or a number of sounds.

Transitions and stingers have many short parts, so each part is a line in the list of slots instead. A line plays the original, shows the length, and marks a part that is silent or belongs to other music. The slots of the open part are under its line. Click another line to open that part, or the open one to fold it. The toolbar acts on the open part.

## The slots

Each row is one **slot**, a single game clip that can be replaced.

- **Music** lists **segments** in play order. The first row of a segment shows the segment name, and the rows under it are the other **layers**.
- **Sounds** are shown in **groups**, with one line per sound and the **takes** folded under it. ▶ on the line plays the first take. Files dropped on the line fill the takes in order. Right-click the line to fill, silence or clear all takes at once.
- The left half of a row is the original. ▶ plays it, and the length is shown at the end. In the Audio Editor, the right half is the replacement. ▶ plays the new audio, clicking the file name picks another file, and ✕ removes it. An empty slot shows *Drop audio or choose a file*.
- Double-click a row to play it. Right-click it for everything else, including copy, paste, silence and ids.
- Copy audio files in Explorer, select slots and press **Ctrl+V**. One file goes into every selected slot. Several files go in file-name order, and on a single selected slot they fill on from there. Ctrl+V pastes whatever was copied last: files from Explorer or slots copied in Audiodiver.

### Tags on a row

| Tag | Meaning |
|---|---|
| {icon:link} **+3 cues** / **+5 banks** / **+8 more** | The game plays the same clip in that many other places. |
| {icon:link} **in 104 other banks** (on a group) | Every sound in the group is a shared copy, like the handling sounds that every weapon carries. |
| **loops**, **×2** | The segment repeats until the game moves on, or repeats that many times. |
| a condition, like *Desert* | This slot is a **variant** and plays only when the condition is met. |
| **never heard** | The game data lists this clip, but nothing plays it. |
| **do not touch** | Replacing this clip makes the music stutter. Fills skip it. |
| **no audio** | The game data names this clip, but the installed game files don't include it. There is nothing to play or replace. |
| **quiet drums** | A barely audible drum layer under another layer of the segment. |
| **never plays** | The clip is in the game files, but the game never plays it. The Illuminate Void's death music is one example. |
| a coloured tag | An Index entry related to this slot. Click the tag to open it. |

Hover over a tag to read its note. The notes of a selected clip appear in the details panel. They describe when the clip plays, or give a warning such as a minimum length for new audio.

### Marks

| Mark | Meaning |
|---|---|
| ○ ◐ ● | Original, partly replaced, replaced. |
| ↝ | A **transition**, which plays between two pieces of music. |
| ✦ | A **stinger**, which plays over the music. |
| ×3 | The item has three **parts**. |
| **!** | An original transition plays next to new music. See [How the game plays music](wiki:how-the-game-plays-music). |

## Under the slots

The **waveforms** of the selected slot are shown here. The original is on top, and in the Audio Editor the replacement is underneath, on the same time scale, with the **Entry** and **Exit** points marked. Click a waveform to play from that point, and drag its top edge to resize it. In the Library, the line above the waveforms describes the slot. It shows the id (click to copy it), the length, when the slot plays, and where else the game plays it.

## The right panel (Audio Editor)

This panel holds the settings of the selected slot. It shows what replaces the slot, either a file or silence. A file has a button that shows it in its folder, and silence has **Keep original duration**. Below that are **Make-Up Gain** ([explained here](wiki:volume)), **Fit timing to the new audio**, the **cue points**, **Shared with** and the note. With several slots selected, the panel sets Make-Up Gain or silence for all of them. Play audio and choose files on the slot row.

With no slot selected, the panel shows the note of the open item and the keys of the slot list.

## Notes

Slots, and items in the list on the left, can have notes. Notes are at the bottom of the right panel. Select a slot to see its note, or select nothing to see the note of the item. **Add note** opens the editor. Notes are saved in the project file, and Undo reverts a change to a note.

Notes are written in Markdown. `#` starts a heading, `-` starts a list item, `**bold**` and `*italic*` mark words, and `[text](https://…)` makes a link. The buttons above the box do the same for the selected words, and pressing one again takes the mark off. {key:undo} works in the box while you type. Click elsewhere to save the note and show it formatted. Click it to edit it again. **Delete note** removes it, and asks first if it has any words.

A clip that plays in several places has one note, shown in every place. When a game update gives a clip a new id, the note no longer shows. It stays in the file and shows again if the id comes back.

## The bars

The tab bar holds the main tabs. Home and Tools come first. The darker band after them holds the tabs for the open project, from Project to Build, and the Project tab shows the project icon and name. {icon:updates} Updates, the Wiki and Settings are at the end. The bar runs along the top of the window, and **Tab bar** in [Settings ▸ Theme](app:settings/theme) puts it on another side. With tab names on, a bar at the top or bottom shows the names beside the icons, and a bar at the left or right shows a name when the pointer is on the tab. The open tab takes the colour of its page, and in the band its edge is in the primary colour. Tabs inside a page, such as Index and All Archives, the parts of a piece, or the sections of Settings, are underlined instead. A dot on Build means the project isn't built in its current state, and a dot on Updates means a new version of Audiodiver is available.

The status bar at the bottom has undo and redo, the project file and the audio that is playing. Click the playing audio to go to its slot. The **Export list** button appears once the list has something on it. **Vol** sets the preview volume, which doesn't affect the mod. The version number opens Updates, and the {icon:info} next to it opens [About](app:about).

Short confirmations such as *Loadout Selection added to My Mod* or *My Mod saved* appear briefly at the bottom of the window. Notices that need reading, or that have a button such as Undo or Show in folder, appear at the bottom right.

## Ids

Every slot shows its **stream id** at the end of the row, the id other audio tools list it by. Audio stored only inside a bank shows its **source id**. Click the id to copy it. Right-click the row to see all ids of the slot:

- the 64-bit **stream** id of the file that holds the audio
- the **source** id of the clip
- the **Sound** in a bank that plays the clip
- the music **track** that the clip is a layer of

The search box accepts any of them.

## Exporting

**Export…** saves the open item as audio files, either the **Original** or the **Replaced** audio, in the format you pick.

### A folder for each

With **A folder for each** on, the files of each entry go into a separate folder. With it off, all files go into one folder, and each file is named after the place it comes from.

### Lead-in and ring-out

Exporting a piece of music by segment saves one file per segment. **Lead-in and ring-out** includes the audio before each segment's Entry and after its Exit, so the files overlap the way the segments do in game. With it off, the files hold only the audio from Entry to Exit and fit end to end. See [Timing and loops](wiki:timing-and-loops#entry-and-exit).

## The export list

Collect things from different places to export them together. Right-click a slot, a group of takes, an Index entry, a category or section line, or an archive, and choose **Add to the export list**. The **Export list** button in the status bar opens the list. There you can rename an entry to set its folder name, remove entries, and export everything as a single job. The list is kept until you clear it.

## Colours

- The **primary colour** (Super Earth yellow) fills the main buttons and marks replaced audio, edits and the project.
- The **secondary colour** (blue) is used for navigation and information, such as links, the open tab, the selection and the focus ring. On the light theme, it is also used for text, lines and tints that would otherwise be in the primary colour.
- Neutral grey marks the original.

Change both colours, the theme, the contrast and **Night mode** in [Settings ▸ Theme](app:settings/theme).
