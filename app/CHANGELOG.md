# Changelog

The Updates tab shows this file. Each release starts with a second-level heading, `<version> - <date>`,
newest first.

## 1.4.0 - 2026-10-28

### Highlights

#### Languages

Audiodiver is in Portuguese (Brazil) and Simplified Chinese as well as English: the window, the messages, the Wiki and the names in the Library and the Soundtrack, with weapons and other items named as the game writes them. **Language** in Settings ▸ System picks one. Automatic follows the language Helldivers 2 is set to in Steam, then the language of Windows. The Library search also finds the English names.

#### Import Mod

**Import Mod** on Home and on the Project tab makes a new project from the ZIP or patch file of a mod. Before anything is written, it lists what comes in, with each line of text the mod changes to keep or leave out, and sets the name, folder, mod ID and icon. **Import Patches** opens the same panel and takes ZIP files too.

#### Export

Export is one panel for the open item and the export list, and it lists the files it will write before writing them. It takes the selected, the replaced or all slots, and in the Audio tab and the Soundtrack the audio as the mod plays it, the Original or both. The Soundtrack also exports the whole piece, a fight of 1 to 10 minutes as the game plays it, each segment or each slot.

#### Interactive Tutorials

Tutorials in the Wiki darken the window except where to click and say what to do there, one step at a time. The first one walks through replacing the firing sounds of the Liberator with audio the tutorial brings, then building the mod. A notice offers them at the first start.

#### Global Notes

A **Global Note** on a slot or an item shows in every project and in the Library, and is kept in a notes file on this computer. The note in the details panel is now the **Project Note**, with the Global Note under it, and the Library has a details panel for the Global Note. The search in the list on the left finds words in global notes too. **Global Notes** in Settings ▸ System can keep the file in another folder, such as a synced one. **Export Notes** there saves notes as Markdown or JSON, and **Import Notes** brings in a notes file or the notes of a project.

#### History and Notifications

**History** beside Undo and Redo lists the changes made since the project opened, with the time of each, and a click goes back or forward to any of them. **Notifications** at the right end of the status bar lists the notices shown so far and keeps the last 100 across restarts. A notice that led somewhere, such as one with **Show in Folder**, leads there again when clicked in the list.

### Additions

- **Imported Settings** in the details panel of the Audio tab lists what an imported mod set on the sound of a slot, or on a container above it, that Audiodiver has no control for, such as Volume, Pitch or Initial Delay. Builds include these settings.
- **Notifications** in Settings ▸ System sets the corner of the window where notices show. Bottom Right is the default.
- Ticks on the slots in the Library, to export some sounds of an item.
- Exported files get full names, short names or source IDs, and Original slots can export as the WEM files of the game.
- The installer follows the language of Windows.

### Changes

- Changes are faster in projects with a lot of new audio, as Audiodiver checks each audio file once per change instead of four or five times. In a project with 391 replaced slots, a change followed by Undo takes about 85 ms, down from 245. A running build or import redraws the window only when the progress shows something new.
- Rows in the Library hold the name and a + filled in the primary colour, which turns into a red ✕ once the item is in the project, to take it off again. The sound count and the length are gone.
- The Export List button moved from the status bar to the toolbar, beside Export.
- Exported file names end in (original) and (replaced) only when both versions are exported, and a slot keeps the number it has in the item whichever slots are exported.
- The Library's export no longer has the Original, Replaced and Both choice, which could only export the Original.
- Ticking a folded sound in the Audio tab selects the takes and leaves the sound folded.
- The Build tab shows the icon, name and description as the mod manager shows them, above the Build button.
- The Wiki entries above the guides have no outlines, and the open one is marked like any open page.

### Bug Fixes

- Make-Up Gain that a patch sets on a sound, a music track or a container above sounds came in with **Import Patches** as a hidden setting, so the slots showed 0 dB and a gain set on a slot went on top of it. **Import Patches** and **Import Mod** now put it on the slots it reaches, on the new audio or on the Original, and a mod that only sets gains lists the items it changes. Where a mod gives two sounds that play the same clip different gains, those gains stay on the sounds and show under **Imported Settings**, since a slot has one gain.
- Removing an item from the project kept the new audio in slots that another item in the project shares, and a build still put that audio in the mod. Removing now takes everything the project changes in the item: the new audio in every slot of the item, added takes and layers, Make-Up Gain on the original audio, and the cue points and Soundtrack settings of music. Audiodiver asks first when new audio would go.
- The Library's + sat 2 pixels further left on items than on the lines of categories and sections.
- Clicking what plays in the status bar after playing it in the Soundtrack opened the Audio tab. It now goes back to the Soundtrack, at the piece and the segment.
- Small buttons were shorter than the fields beside them, as in the formatting bar of the Text tab. Buttons, fields and selects in a row now share one height, including the search rows and the language of the Text tab.
- Listed by container ID in the Audio tab, sounds now sit further in under the containers above them, as in the Library.
- The voice lines of SEAF soldiers are back in the Index as SEAF Voices (2,040 lines), beside Civilian Voices (1,414). Since a game update they showed only in All Archives, under the name of the civilians.

## 1.3.0 - 2026-10-27

### Highlights

#### Waveform Controls

The waveforms zoom in on time, to place cue points closely, and in level, to show quiet audio. One slider runs up the right side and one under the waveforms, and the mouse wheel zooms too. The slice tool has the same controls.

#### Make-Up Gain

Make-Up Gain also works on sounds without new audio, so an original sound can play louder or quieter. **Match the Original Loudness** sets the gain that makes new audio as loud as the original. The waveforms are drawn at the gain, with anything past full scale in red, and ▶ plays at it, as the mod does.

#### Play Order

The play order in the Soundtrack shows each group of segments as a card, under a heading that says how the group plays them. Segments that play in order are joined by →, a random pick by "or", and a group that holds a single thing shows that thing alone.

#### Exertion Catalogue

The Helldiver Exertions in the Library are named: 27 kinds, such as Drowning, On Fire and Death, for each of the four voices, with when each one plays.

#### Container IDs

A toolbar button lists a sound bank by container ID, as the bank's tree, the way Wwise tools show it. The ID is also in the right-click menus and in what the slot search finds.

### Additions

- Autosave on a timer, in Settings ▸ System: every 1 to 30 minutes, or with each change as before. Changes are saved before a build and when the project or Audiodiver closes.
- A button after Make-Up Gain and after the level of a Soundtrack piece that sets them back to 0 dB.
- The Make-Up Gain the game gives a sound, in the ? of Make-Up Gain.
- WEM files as audio for a slot. A WEM in Wwise Vorbis goes into the mod unchanged, and other WEM files are converted like any audio.
- **Keep added audio to the project's banks**, a build option, off by default. New takes, layers and new audio set to Only This Sound then stay out of the other banks that have a copy of the sound: the mod gets smaller, but the original can play where one of those banks loads first.
- A number from 0 to 100 over the knob of the zoom, preview volume and colour sliders while they move.

### Changes

- Each kind of slider looks different: Make-Up Gain and levels are faders lit from 0 dB, zoom is a thin line, the preview volume is thin and grey, and settings fill up to a square knob.
- Open Project on Home holds the last project opened, with the icon and name of that project, in place of the Recent line under it.
- With a project loaded, Home has Go to Project and Close under Open Project, each with an icon. Close works like Close Project on the Project tab.
- The Home menu sits further from the edges of the window.
- Buttons are in Title Case, and none ends in three dots, including the ones that open a dialog or a menu.
- A music segment with several tracks shows the segment name on a separate line, with a row for each track under it.
- The list of guides in the Wiki takes a quarter of the width, and the page the rest. Dragging the edge keeps the share when the window changes size.
- Panel dividers turn light grey under the pointer, in place of the primary colour.
- The music list and the header of the Soundtrack resize by dragging their edges, as in the other tabs.
- The Slots link of the Soundtrack sits beside the name of the music.
- The waveforms button on the toolbar works only while one slot is selected.
- The + that adds audio to a sound has a blue outline, level with the dot beside it.
- The messages at the bottom of the window and the tab names that open beside the tab bar have square corners, like the rest of the app.
- "id" is written "ID" everywhere in the app and the Wiki.

### Bug Fixes

- Make-Up Gain on sounds that already have one in the game (about 1 in 12) replaced that value instead of adding to it, so −1 dB could play 4 dB quieter.
- The new audio of a slot with Make-Up Gain moved as the gain changed and pushed the length out of line.
- The selected row of the lists in high contrast was white on white in the light theme.
- Selecting a segment in the Soundtrack was slow on music with many segments, such as a Battle.
- The Templates button of the Soundtrack sat in the middle of the Music row instead of at the right.
- The files in a built ZIP were dated 31 December 1979.
- New takes or a layer added to a folded sound were selected but stayed hidden, as the sound didn't open.

## 1.2.0 - 2026-10-26

### Additions

- **Move project…** on the Project tab. It moves the project folder into another folder, and the project still finds every file it uses.
- **Change…** for the mod ID on the Project tab, so that builds can update a mod made before, such as one packed by hand.
- The build option **Also save the patch files in a folder**, for packing a mod by hand.
- Cue points for several selected slots at once, and **Apply to … more segments with this file** under Cue points.
- The tag **replaced in another sound** on slots that keep the Original while another sound has **Only this sound**.

### Changes

- Builds, Repatch and Combine leave out an empty `.patch_0.gpu_resources` or `.patch_0.stream` file. Audio needs no GPU resources.
- The subtitle of the Project tab reads "Projects are folders containing the mod and all associated files."

### Bug Fixes

- New audio could turn into a screech when it played over other new audio, such as a voice line over another voice line or over new music. Build the mod again to get this fix.
- A short piece of music replaced by a long song could crash the game when it started. Build the mod again to get this fix.
- Repatch, Import and Combine dropped the cue points of the music in a mod.
- Builds failed with "banks still holding the original audio" when they replaced footsteps, some shared voice lines, or a shared clip that one sound changes with Only this sound.

## 1.1.1 - 2026-10-25

Reading the game audio no longer fails on a stray file in the Helldivers 2 data folder. The error said "unpack requires a buffer of … bytes".

## 1.1.0 - 2026-10-25

### Highlights

#### The Soundtrack Tab

A new tab sets how each piece of music plays in a mission: in the original order, as one song cut across the segments, as a playlist of whole songs, or silent. Whole fights can be heard before building.

#### Audiodiver Utils

Repatch and Combine Mods on their own, as a 27 MB portable window and a command line that scripts and mod managers can call.

### Additions

- Ctrl+V for audio files copied in Explorer: they paste into the selected slots.
- A tick on each slot that selects it, and the selected slots take one file or several at once.
- Search slots, which finds slots by name, label, note, file name or ID in every piece of music and sound set.
- The stream ID on the slots, the ID other audio tools use.
- Two buttons at the end of the toolbar that hide or show the header and the waveforms.
- A way to hide the Audio, Soundtrack and Text tabs, in Settings or for one project.
- A page of frequently asked questions in the Wiki.
- Ctrl+F in the Wiki, which finds and marks words on the page. A page opened from the search marks the words searched for.
- The library of a second mod manager in Installed mods and Combine Mods.
- An option for Dark or Light to follow the system theme, and Reset to Default for the theme.
- A Ko-fi button in About, and the source of the news ticker on Home in the credits.

### Changes

- The Index search also finds music by slot labels, and opens a pasted ID at the slot.
- Make-Up Gain goes from −96 to +96 dB, dragged or typed, with one slider for several slots.
- The toolbar above the slots is a row of icons, with Play through as two round buttons at the start.
- The header above the slots is shorter, with the facts side by side.
- Build sits apart from the project tabs, and shows only while a project is open.
- The tabs along a top or bottom bar share one width, with a longer name widening only that tab.
- Home stays the same with a project open, and lists recent projects under Open project.
- The Project tab lists recent projects while no project is open, and shows where to start in a new project.
- Wiki headings stand out by level.
- Combine Mods shows setting values with units.
- The app and the Wiki say "mod manager" instead of naming one. Builds work with any manager that imports the usual manifest ZIPs.
- The Shared with list shows the other places by where they are, with unnamed music folded.
- Item descriptions are behind the ⓘ after the title.
- Reset Key Binds asks first.
- About and the Updates tab show the version once.
- Tooltips, notes and ? links across the app say what things are for, in plainer wording.
- The chosen option in a row of choices isn't bold any more, so the row keeps one width.

### Bug Fixes

- Six music clips had a label from another sound group, such as Loadout #13 being named "Mission End - Stats Screen".
- The tip on "Raise the version after each build" wrongly said that a mod manager sees every build as an update.
- Lines in the Wiki ended on an opening bracket.
- The ⓘ and the Replaced status sat out of line with the item title.
- The How Audiodiver works page pointed to the wrong next page.
- The Library said "never played" where the slot rows say "never heard", and the Text tab marked changed lines as Replaced instead of Changed.

## 1.0.0 - 2026-10-23

First release.
