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
- In the Audio tab, the list shows what the project has. **✕** on a row, or on a category or section line, removes it from the project, together with the new audio in it. Right-clicking does the same, and {key:undo} brings it back.
- {icon:collapse} **Collapse all**, next to the search box, folds every category and section. A search unfolds whatever matches.

## The top of the middle panel

- **The path and the title** show where the item is in the Index (*Weapons ▸ Primary Weapons*, *Helldivers ▸ Voices*) and what it is called. ‹ and › at the end of the title go back and forward.
- **Original**, **Partly replaced** or **Replaced** shows what the item plays now, in the Audio tab only.
- **In the archive …** names the archive that contains the item, followed by the **bank** name from the game files. Click the archive to open it in All Archives.

Under the title, a row of boxes says more about the item. They sit side by side and stack when the panel is narrow:

- {icon:transition} **N transitions play next to this music** appears for music only. It counts the short pieces that lead into and out of the music. **Show** lists them and what each one plays now.
- {icon:order} **The game plays these slots in another order** appears for music whose playlist doesn't play the slots top to bottom. **Play order** opens it in the [Soundtrack](wiki:soundtrack).
- {icon:link} **Shares audio with** lists other things that play some of the same clips.

{icon:header} at the end of the toolbar hides the header, and shows it again.

## The toolbar

{icon:through} **Play through** plays the whole piece of music segment by segment, in the same order the game uses. The grey button plays the **Original** audio, the yellow one the **Replaced** audio. While one plays, a bar shows where it is.

In the Library, the toolbar has **Add to the project**. In the Audio tab it starts with a tick that selects every slot, or clears the selection, and has these tools:

| Tool | What it does |
|---|---|
| {icon:fill} **Fill from files** | Fills the slots with files, one file per slot, in play order and file-name order. |
| {icon:fillpiece} **Fill the whole piece** | Fills the slots of every part the same way, part by part. |
| {icon:slice} **Slice a song** | Cuts one song into pieces, one per slot. |
| {icon:export} **Export** | Saves the audio as WAV, FLAC or MP3. |
| {icon:skip} **Skip it**, {icon:skipall} **Skip all** | Replace a transition or stinger with a short silence. |
| {icon:clear} **Clear all**, **Clear this part** | Removes the new audio from every slot shown, or from every slot of the part. |

{icon:search} **Search slots** narrows the list by name, label, note, file name or id. In a sound set it also finds the words of a voice line. When nothing in the list matches, **Elsewhere** lists the pieces of music and sound sets that have a match.

{icon:header} and {icon:waves} at the end of the toolbar hide or show the header and the waveforms, and the **?** after them opens this section.

## Parts

Tabs under the toolbar switch between the **parts** of the open item. Parts are the biomes or intensities of a piece of music, or the languages of a voice. The number on a tab is a length or a number of sounds.

Transitions and stingers have many short parts, so each part is a line in the list of slots instead. A line plays the original, shows the length, and marks a part that is silent or belongs to other music. The slots of the open part are listed right under it. Click another line to open that part, or the open one to fold it. The toolbar acts on the open part.

## The slots

Each row is one **slot**, a single game clip that can be replaced.

- **Music** lists **segments** in play order. The first row of a segment shows the segment name, and the rows under it are the other **layers**.
- **Sounds** are shown in **groups**, with one line per sound and the **takes** folded under it. ▶ on the line plays the first take. Files dropped on the line fill the takes in order. Right-click the line to fill, silence or clear all takes at once.
- The left half of a row is the original. ▶ plays it, and the length is shown at the end. In the Audio tab, the right half is the replacement. ▶ plays the new audio, clicking the file name picks another file, and ✕ removes it. An empty slot shows *Drop audio or choose a file*.
- In the Audio tab, the tick at the start of a row puts the slot in the selection, or takes it out, as Ctrl+click does. Shift on a tick selects a range. A group line has a tick for all the takes in the group. With several slots selected, the right panel has **Choose one file for all…**, **Choose files…**, **Replace with silence** and the button that removes the new audio.
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
| **only this sound** | The new audio plays in this sound only. The other sounds that play the clip keep the Original. See [Only this sound](wiki:adding-audio#only-this-sound). |
| **replaced in another sound** | Another sound plays new audio in place of this clip, with **Only this sound**. This one keeps the Original. |
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

The **waveforms** of the selected slot are shown here. The original is on top, and in the Audio tab the replacement is underneath, on the same time scale, with the **Entry** and **Exit** points marked. Click a waveform to play from that point, and drag the top edge of the panel to resize it. {icon:waves} at the end of the toolbar hides them. In the Library, the line above the waveforms describes the slot. It shows the id (click to copy it), the length, when the slot plays, and where else the game plays it.

## The right panel (Audio tab)

This panel holds the settings of the selected slot. It shows what replaces the slot, either a file or silence. A file has a button that shows it in Explorer, and silence has **Keep original duration**. Below that are **Make-Up Gain** ([explained here](wiki:volume)), **Fit timing to the new audio**, the **cue points**, **Shared with** and the note. Play audio and choose files on the slot row.

With several slots selected, the panel sets Make-Up Gain, cue points or silence for all of them. **Choose one file for all…** puts one file in every selected slot, and **Choose files…** puts a file in each, in list order and file-name order.

With no slot selected, the panel shows the note of the open item and the keys of the slot list.

## Notes

Slots, and items in the list on the left, can have notes. Notes are at the bottom of the right panel. Select a slot to see the note on it, or select nothing to see the note on the item. **Add note** opens the editor. Notes are saved in the project file, and Undo reverts a change to a note.

Notes are written in Markdown. `#` starts a heading, `-` starts a list item, `**bold**` and `*italic*` mark words, and `[text](https://…)` makes a link. The buttons above the box do the same for the selected words, and pressing one again takes the mark off. {key:undo} works in the box while you type. Click elsewhere to save the note and show it formatted. Click it to edit it again. **Delete note** removes it, and asks first if it has any words.

A clip that plays in several places has one note, shown in every place. When a game update gives a clip a new id, the note no longer shows. It stays in the file and shows again if the id comes back.

## The bars

The tab bar holds the main tabs. Home and Tools come first. The darker band after them holds the tabs for the open project, from Project to Text, and the Project tab shows the project icon. Build comes after the band while a project is open, and {icon:updates} Updates, the Wiki and Settings are at the end. The bar runs along the top of the window, and **Tab bar** in [Settings ▸ Theme](app:settings/theme) puts it on another side. With tab names on, a bar at the top or bottom shows the names beside the icons, and a bar at the left or right shows a name when the pointer is on the tab. The open tab takes the colour of the page it opens, and in the band the open tab has an edge in the primary colour. Tabs inside a page, such as Index and All Archives, the parts of a piece, or the sections of Settings, are underlined instead. A dot on Build means the project needs a new build, and a dot on Updates means a new version of Audiodiver is available.

The status bar at the bottom has undo and redo, the project file and the audio that is playing. Click the playing audio to go to that slot. The **Export list** button appears once the list has something on it. **Vol** sets the preview volume, which doesn't affect the mod. The version number opens Updates, and the {icon:info} next to it opens [About](app:about).

Short confirmations such as *Loadout Selection added to My Mod* or *My Mod saved* appear briefly at the bottom of the window. Notices that need reading, or that have a button such as Undo or Show in folder, appear at the bottom right.

## Ids

Every slot shows a **stream id** at the end of the row, the id other audio tools list it by. A slot with audio stored only inside a bank shows the **source id** instead. Click the id to copy it. Right-click the row to see all ids of the slot:

- the 64-bit **stream** id of the file that holds the audio
- the **source** id of the clip
- the **Sound** in a bank that plays the clip
- the music **track** that the clip is a layer of

Both search boxes take any of them.

## Exporting

{icon:export} **Export** saves the open item as audio files, the **Original** audio, the **Replaced** audio or **Both**, in the format you pick. Each file name ends in *(original)* or *(replaced)*. For music, **Contents** sets whether each slot, each segment or the whole piece becomes a file, and the line under the choices describes the one chosen.

### A folder for each

With **A folder for each** on, the files of each entry go into a separate folder. With it off, all files go into one folder, and each file is named after the place it comes from.

### Lead-in and ring-out

Exporting a piece of music by segment saves one file per segment. **Lead-in and ring-out** includes the audio before the Entry and after the Exit of each segment, so the files overlap the way the segments do in game. With it off, the files hold only the audio from Entry to Exit and fit end to end. See [Timing and loops](wiki:timing-and-loops#entry-and-exit).

## The export list

Collect things from different places to export them together. Right-click a slot, a group of takes, an Index entry, a category or section line, or an archive, and choose **Add to the export list**. The **Export list** button in the status bar opens the list. There you can rename an entry to name the folder it goes to, remove entries, and export everything as a single job. The list is kept until you clear it.

## Colours

- The **primary colour** (Super Earth yellow) fills the main buttons and marks replaced audio, edits and the project.
- The **secondary colour** (blue) is used for navigation and information, such as links, the open tab, the selection and the focus ring. On the light theme, it is also used for text, lines and tints that would otherwise be in the primary colour.
- Neutral grey marks the original.

Change both colours, the theme, the contrast and **Night mode** in [Settings ▸ Theme](app:settings/theme).
