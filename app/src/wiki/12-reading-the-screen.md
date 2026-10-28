---
title: Reading the screen
group: Getting started
summary: What each part of the Library and the Audio tab shows, and what the tags and marks on a row mean.
---

The Library and the Audio tab share one layout. There is a list on the left and the open item in the middle. The Audio tab also shows the settings of the selected slot on the right. The Soundtrack has a different layout, described in [Soundtrack](wiki:soundtrack). Words in **bold** are explained in [Game audio, explained](wiki:game-audio).

## The list on the left

- **Index** sorts the audio by what it is. Categories such as Music, Weapons and Enemies contain sections such as *On the Ship* and *Primary Weapons*. Each section lists things you can open, either a **piece of music** or a **sound set**. The number at the end of a row is the length of a piece of music, or the number of sounds in a set.
- **All Archives** shows every **archive** that contains audio, as a table. Click a column heading to sort by it, and click again to reverse the order. The icons in the *Index* column show which categories include the archive.
- In the Library, the **+** at the end of a row adds it to the project, and **✓** means the project already has it. Category and section lines have a **+** as well, which adds everything visible under them. After a search, that **+** adds only the results.
- In the Audio tab, the list shows what the project has. **✕** on a row, or on a category or section line, removes it from the project, together with everything the project changes in it: the new audio, also in slots that another item in the project shares, added takes and layers, Make-Up Gain, and the cue points and Soundtrack settings of music. Audiodiver asks first when new audio would go. Right-clicking does the same, and {key:undo} brings it back.
- {icon:collapse} **Collapse all**, next to the search box, folds every category and section. A search unfolds whatever matches.

## The top of the middle panel

- **The path and the title** show where the item is in the Index (*Weapons ▸ Primary Weapons*, *Helldivers ▸ Voices*) and what it is called. ‹ and › at the end of the title go back and forward.
- **Original**, **Partly replaced** or **Replaced** shows what the item plays now, in the Audio tab only.
- **In the archive …** names the archive that contains the item, followed by the **bank** name from the game files. Click the archive to open it in All Archives.

Under the title, a row of boxes says more about the item. They sit side by side and stack when the panel is narrow:

- {icon:transition} **N transitions play next to this music** appears for music only. It counts the short pieces that lead into and out of the music. **Show** lists them and what each one plays now.
- {icon:order} **The game plays these slots in another order** appears for music whose playlist doesn't play the slots top to bottom. **Play Order** opens it in the [Soundtrack](wiki:soundtrack).
- {icon:link} **Shares audio with** lists other things that play some of the same clips.

{icon:header} at the end of the toolbar hides the header, and shows it again.

## The toolbar

{icon:through} **Play through** plays the whole piece of music segment by segment, in the same order the game uses. The grey button plays the **Original** audio, the yellow one the **Replaced** audio. While one plays, a bar shows where it is.

The toolbar starts with a tick that selects every slot, or clears the selection. In the Library it then has **Add to the Project**, and in the Audio tab these tools:

| Tool | What it does |
|---|---|
| {icon:fill} **Fill from files** | Fills the slots with files, one file per slot, in play order and file-name order. |
| {icon:fillpiece} **Fill the whole piece** | Fills the slots of every part the same way, part by part. |
| {icon:slice} **Slice a song** | Cuts one song into pieces, one per slot. |
| {icon:export} **Export** | Saves the item, or the selected slots, as WAV, FLAC, MP3 or WEM files. **Export List** beside it opens the [export list](#the-export-list) once something is on it. |
| {icon:skip} **Skip it**, {icon:skipall} **Skip all** | Replace a transition or stinger with a short silence. |
| {icon:clear} **Clear all**, **Clear this part** | Removes the new audio from every slot shown, or from every slot of the part. |

{icon:search} **Search slots** narrows the list by name, label, note, file name or ID. In a sound set it also finds the words of a voice line. When nothing in the list matches, **Elsewhere** lists the pieces of music and sound sets that have a match.

{icon:id} after the search lists the sounds of a bank by [container ID](#container-ids). Press it again to go back to names.

{icon:header} and {icon:waves} at the end of the toolbar hide or show the header and the waveforms, and the **?** after them opens this section. The waveforms button works while one slot is selected.

## Parts

Tabs under the toolbar switch between the **parts** of the open item. Parts are the biomes or intensities of a piece of music, or the languages of a voice. The number on a tab is a length or a number of sounds.

Transitions and stingers have many short parts, so each part is a line in the list of slots instead. A line plays the original, shows the length, and marks a part that is silent or belongs to other music. The slots of the open part are listed right under it. Click another line to open that part, or the open one to fold it. The toolbar acts on the open part.

## The slots

Each row is one **slot**, a single game clip that can be replaced.

- **Music** lists **segments** in play order. The first row of a segment shows the segment name, and the rows under it are the other **layers**.
- **Sounds** are shown in **groups**, with one line per sound and the **takes** folded under it. ▶ on the line plays the first take. Files dropped on the line fill the takes in order. Right-click the line to fill, silence or clear all takes at once.
- The left half of a row is the original. ▶ plays it, and the length is shown at the end. In the Audio tab, the right half is the replacement. ▶ plays the new audio, clicking the file name picks another file, and ✕ removes it. An empty slot shows *Drop audio or choose a file*.
- The tick at the start of a row puts the slot in the selection, or takes it out, as Ctrl+click does. Shift on a tick selects a range. A group line has a tick for all the takes in the group, and the group stays folded. In the Library, **Export** can save only the selected slots. In the Audio tab, with several slots selected, the right panel has **Choose One File for All**, **Choose Files**, **Replace with Silence** and the button that removes the new audio.
- Double-click a row to play it. Right-click it for everything else, including copy, paste, silence and IDs.
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
| **only this sound** | The new audio plays in this sound only. The other sounds that play the clip keep the Original. See [Only this sound](wiki:adding-audio#only-this-sound). |
| **replaced in another sound** | Another sound plays new audio in place of this clip, with **Only This Sound**. This one keeps the Original. |
| **−6 dB** | Make-Up Gain on the Original, in a slot without new audio. See [Make-Up Gain per slot](wiki:volume#make-up-gain-per-slot). |
| a coloured tag | An Index entry related to this slot. Click the tag to open it. |

Hover over a tag to read the note. The notes of a selected clip appear in the details panel. They describe when the clip plays, or give a warning such as a minimum length for new audio.

### Marks

| Mark | Meaning |
|---|---|
| ○ ◐ ● | Original, partly replaced, replaced. |
| ↝ | A **transition**, which plays between two pieces of music. |
| ✦ | A **stinger**, which plays over the music. |
| ×3 | The item has three **parts**. |
| **!** | An original transition plays next to new music. See [How the game plays music](wiki:how-the-game-plays-music). |

## Under the slots

The **waveforms** of the selected slot are shown here. The original is on top, and in the Audio tab the replacement is underneath, on the same time and level scales, with the **Entry** and **Exit** points marked. Both are drawn at their [Make-Up Gain](wiki:volume#make-up-gain-per-slot), and red marks audio pushed past full scale. Click a waveform to play from that point, and drag the top edge of the panel to resize it. {icon:waves} at the end of the toolbar hides them. In the Library, the line above the waveforms describes the slot. It shows the ID (click to copy it), the length, when the slot plays, and where else the game plays it.

Two sliders zoom both waveforms. The one up the right side draws them taller, to show quiet audio, and the one under them, at the right, zooms in on time, to place Entry and Exit closely. On the waveforms, the mouse wheel zooms in on time, Ctrl+wheel draws them taller, and Shift+wheel scrolls. Zoomed in on time, the strip under the waveforms scrolls too. {icon:reset}, in the corner between the sliders, shows the whole audio at full scale again. While a slider moves, a number from 0 to 100 over the knob shows how far along it is. Zoom stays as set when another slot is selected, and the slice tool has the same sliders.

## The right panel (Audio tab)

This panel holds the settings of the selected slot. It shows what replaces the slot, either a file or silence. A file has a button that shows it in Explorer, and silence has **Keep original duration**. Below that are **Make-Up Gain** ([explained here](wiki:volume)), **Fit timing to the new audio**, the **cue points**, **Shared with** and the note. A slot without new audio has **Use Silence** and Make-Up Gain for the Original. Play audio and choose files on the slot row.

With several slots selected, the panel sets Make-Up Gain, cue points or silence for all of them. **Choose One File for All** puts one file in every selected slot, and **Choose Files** puts a file in each, in list order and file-name order.

With no slot selected, the panel shows the note of the open item and the keys of the slot list.

## Notes

Slots, and items in the list on the left, can have notes. Notes are at the bottom of the right panel. Select a slot to see the note on it, or select nothing to see the note on the item. **Add Note** opens the editor. Notes are saved in the project file, and Undo reverts a change to a note.

Notes are written in Markdown. `#` starts a heading, `-` starts a list item, `**bold**` and `*italic*` mark words, and `[text](https://…)` makes a link. The buttons above the box do the same for the selected words, and pressing one again takes the mark off. {key:undo} works in the box while you type. Click elsewhere to save the note and show it formatted. Click it to edit it again. **Delete Note** removes it, and asks first if it has any words.

A clip that plays in several places has one note, shown in every place. When a game update gives a clip a new ID, the note no longer shows. It stays in the file and shows again if the ID comes back.

## The bars

The tab bar holds the main tabs. Home and Tools come first. The darker band after them holds the tabs for the open project, from Project to Text, and the Project tab shows the project icon. Build comes after the band while a project is open, and {icon:updates} Updates, the Wiki and Settings are at the end. The bar runs along the top of the window, and **Tab bar** in [Settings ▸ Theme](app:settings/theme) puts it on another side. With tab names on, a bar at the top or bottom shows the names beside the icons, and a bar at the left or right shows a name when the pointer is on the tab. The open tab takes the colour of the page it opens, and in the band the open tab has an edge in the primary colour. Tabs inside a page, such as Index and All Archives, the parts of a piece, or the sections of Settings, are underlined instead. A dot on Build means the project needs a new build, and a dot on Updates means a new version of Audiodiver is available.

The status bar at the bottom has undo and redo, the project file and the audio that is playing. Click the playing audio to go back to where it was played: the slot in the Library or the Audio tab, or the piece and the segment in the Soundtrack. **Vol** sets the preview volume, which doesn't affect the mod. The version number opens Updates, and the {icon:info} next to it opens [About](app:about).

### History

The clock beside undo and redo opens **History**, the list of changes made since the project opened, oldest first, each with the time it was made. The change the project is at is marked. Click an earlier one to undo every change after it at once, or one further down, in grey, to redo up to it. **As opened** undoes them all and shows when the project opened. Undo and redo keep working from wherever the list went, and the list keeps the last 200 changes.

### Notifications

Short confirmations such as *Loadout Selection added to My Mod* or *My Mod saved* appear briefly at the bottom of the window. Notices that need reading, or that have a button such as Undo or Show in Folder, appear at the bottom right, or in the corner set under **Notifications** in [Settings ▸ System](app:settings/system).

The bell at the right end of the status bar lists the notices shown so far, newest first, with the time of each, to read one again after it is gone. A notice that led somewhere, such as the offer of the tutorials or one with **Show in Folder**, leads there again when clicked in the list. The list keeps the last 100, also after Audiodiver restarts. It only lists them, and never shows anything by itself.

## Ids

Every slot shows a **stream ID** at the end of the row, the ID other audio tools list it by. A slot with audio stored only inside a bank shows the **source ID** instead. Click the ID to copy it. Right-click the row to see all IDs of the slot:

- the 64-bit **stream** ID of the file that holds the audio
- the **source** ID of the clip
- the **Sound** in a bank that plays the clip
- the **container** that holds the takes of the sound
- the music **track** that the clip is a layer of

Both search boxes take any of them.

## Container IDs

Press {icon:id} on the toolbar to list the sounds of a bank as Wwise tools list it. Each sound is then named by the ID of the container right above the takes, with the kind of container before the ID (Random, Sequence, Switch, Layer or Actor-Mixer) and the usual name after it. The containers above sit on lines of their own, one step further in for each level, in bank order. Actor-Mixers that hold only the next one share a line. Click an ID on these lines to copy it. The slot search finds container IDs too.

## Exporting

{icon:export} **Export** on the toolbar opens the Export panel. The first tab saves the open item, and the second the [export list](#the-export-list). On the right, the panel lists the folders and files the export writes, with the names they will have, before anything is written.

- **Sounds** or **Slots**: **Selected** (tick slots in the list first), **Replaced** (in the Audio tab) or **All**.
- **Contents**, for music: **Each Slot**, **Each Segment** with the layers mixed, or **The Whole Piece** played through. In the Soundtrack, **A Fight** saves a fight as the game plays it ([Exporting music](wiki:soundtrack#exporting)).
- **Audio**, in the Audio tab and the Soundtrack: **As the Mod Plays It** saves the new audio where a slot has some, at the Make-Up Gain set, and the Original everywhere else. **Both** adds the replaced version beside the Original wherever the mod changes something, and those names end in *(original)* and *(replaced)*. The Library saves the Original.
- **File names**: **Full Names** start with the name of the item, **Short Names** leave it out, and **Source IDs** name each slot by the source ID, as other modding tools name game audio.
- **Format**: WAV, FLAC, MP3, or WEM for Original slots. A WEM is the file exactly as the game has it, and it goes into another slot as new audio without being encoded again.

### A folder for each item

With **A folder for each item** on, the files of each entry go into a folder named after it. With it off, all files go into the destination folder.

### Lead-in and ring-out

Exporting a piece of music by segment saves one file per segment. **Lead-in and ring-out** includes the audio before the Entry and after the Exit of each segment, so the files overlap the way the segments do in game. With it off, the files hold only the audio from Entry to Exit and fit end to end. See [Timing and loops](wiki:timing-and-loops#entry-and-exit).

## The export list

Collect things from different places to export them together. Right-click a slot, a group of takes, an Index entry, a category or section line, or an archive, and choose **Add to the Export List**. **Add to the Export List** in the Export panel adds the open item with the choices made there. **Export List** on the toolbar opens the list. Rename an entry to name the folder it goes to, change what it saves and which audio, remove entries, and export everything as one job. The list is kept until you clear it.

## Colours

- The **primary colour** (Super Earth yellow) fills the main buttons and marks replaced audio, edits and the project.
- The **secondary colour** (blue) is used for navigation and information, such as links, the open tab, the selection and the focus ring. On the light theme, it is also used for text, lines and tints that would otherwise be in the primary colour.
- Neutral grey marks the original.

Change both colours, the theme, the contrast and **Night mode** in [Settings ▸ Theme](app:settings/theme).
