# Changelog

The Updates tab shows this file. Each release starts with a second-level heading, `<version> - <date>`,
newest first.

## 2.0.1 - 2026-11-26

### Changes

- Removed **Edit Segment**, the gain and Volume curve tags, the lengths, the zoom sliders and the note line from the waveforms under the slots, leaving **Old**, **New**, the copy buttons and the pencils. To zoom in, open the audio in the **Waveform Suite**.
- Removed **Reset Cue Points** from under the waveforms. A cue point let go near the automatic spot still goes back onto it.
- Sped up opening the first piece of music after Audiodiver starts by about a second, by reading the music of the game in the background once the game is read.

### Bug Fixes

- Fixed the icon on the Project and Build tabs loading again each time the tab showed after an edit, which took up to half a second with an image.
- Fixed the **Waveform Suite** reading the original of a slot more than once, a whole song to fetch and decode each time.

## 2.0.0 - 2026-11-26

### Highlights

#### Options for Players

Added **Options for Players** to the Project tab: groups of options that players pick from in the mod manager, such as one of five sounds for a weapon, or a louder and a quieter mod. Until now a mod was one fixed set of sounds.

#### Waveform Suite

Added the **Waveform Suite**, an audio editor opened from the pencil beside each waveform, to trim, split, move, fade and layer the audio of a slot. It replaced the trim and fade lines that 1.8.0 put on the waveforms.

#### Faster Start

Changed Audiodiver to open on Home at once and read both games side by side, about three times faster, where it used to wait for Helldivers 2. Helldivers 1 mods now work without Helldivers 2 installed.

### Additions

- Added **Select** to each option, which makes the Audio tab edit that option, and a menu over the Audio tab that switches between the base mod and any option.
- Added **Changes** to each option, which lists the slots the option changes from the base mod, with an undo for each.
- Added codes such as A2 to groups and options, shown on slots in the Audio tab in place of the group and option names, so the tag stays short.
- Added the authors and the mod ID to the Project tab of a Helldivers 1 mod, so Obsidian shows them and a build can update a mod made before.
- Added **Icon colour** for the logo on the default icon, which was always yellow.
- Added **Copy Original Audio** to the slot menu, and a copy button beside the **Old** and **New** waveforms.
- Added 39 more Helldivers 1 sound names, and moved the sounds still without a name to the end of each category, under Not Named Yet.
- Added 7-Zip and oggenc with aoTuV to About ▸ Credits, which come with Audiodiver since 1.8.0.

### Changes

- Changed projects with Options for Players to a new file format, which Audiodiver 1.x refuses to open, since it would drop the groups. Other projects still open in 1.x.
- Renamed the waveforms under the slots from Original and Replaced to **Old** and **New**.
- Changed the screen shown while Audiodiver starts to show the logo, the name and the version, and stopped it showing the wait as a problem.
- Moved the game switch on Home from the top right to above **New Project**, with the skull of each game, and changed Home to open on the game used last.
- Moved **Import Patches** and **Close Project** beside the Project title, and reordered the icon settings to **Icon colour**, **Border size**, **Border corner radius** and **Border colour**.

### Bug Fixes

- Fixed new text showing as short codes instead of words.
- Fixed Helldivers 1 builds failing with "Access is denied" when one audio file filled several slots in a project that was just moved or renamed.
- Fixed audio files kept outside the project folder showing as missing when the project sits in a deep folder with a long name.
- Fixed a slot played again after a change of trim or fades cutting off early until Stop was pressed.
- Fixed Paste from the menu of a slot not yet selected pasting into the old selection.

## 1.8.0 - 2026-11-17

### Highlights

#### Linux

Added Linux support, in beta: an AppImage that updates itself, a .deb package, and Audiodiver Utils as a .tar.gz. Audiodiver finds the games in native, Flatpak and Snap Steam.

#### Trim, Move and Fade New Audio

Added lines to the Replaced waveform that set where new audio starts and ends in the file, how long it waits after the Original starts, and how long it fades in and out. Builds and previews follow them and leave the file as it is.

#### Korean

Added Korean (한국어) to the app, the Wiki and the game names. Audiodiver picks it on a Korean Steam or system.

### Additions

- Added .7z and .rar mods to Import Mod, Repatch, Combine and Patch Content, which read them as mod managers do (GitHub issue #6).
- Added **Slice a song** for sounds: with one slot of a sound selected, it cuts a stretch of a song for that slot.

### Changes

- Changed Helldivers 1 builds to encode audio on every spare processor core, keep it between builds, and share one copy between slots with the same audio. Builds are several times faster, a build after a small change takes seconds, and mods are smaller.
- Replaced "Also save the patch files in a folder" with two Build options, **Export zipped mod** (on) and **Export raw patch files** (off), so a build can make the patch files alone. With both off, **Build** is off and says why.
- Removed the blur from the pictures on Home, leaving only the shade behind the page.

### Bug Fixes

- Fixed quad and 5.1 audio, such as music copied from Helldivers 2, coming out about 7 dB quieter in stereo slots.
- Fixed Helldivers 1 objective music, and other sounds the game keeps the same in every language, playing new audio only in the language it was set in. These items open as one part in the Library now.
- Fixed builds and previews failing with an AssertionError after a game update while Audiodiver was open. Audiodiver reads the game again by itself now.
- Fixed the Container IDs ticks standing in one column at the left, instead of right before the line each one selects.
- Fixed cue points and the Make-Up Gain, filter and Level sliders jumping back when let go quickly after a drag.
- Fixed the Library staying on the other game when a project opened, with no + buttons. It turns to the game of the project now.
- Fixed Patch Content showing "Something went wrong (TypeError)" when silence can't be encoded, instead of saying which audio failed.

## 1.7.2 - 2026-11-08

### Additions

- Added a list to **Repatch**: drop or choose several mods, or a folder of mods, and each is repatched into a separate ZIP, one after another. A mod that fails doesn't stop the others.

### Bug Fixes

- Fixed voice mods going silent in game when settings imported from a mod brought other languages of the voice into the patch. A mod keeps one language of a voice now, and **Build** stops if a voice has new audio in two languages.

## 1.7.1 - 2026-11-07

### Highlights

#### Patch Content

Added **Patch Content** to Tools, which opens a mod as it is and writes it again with new audio or silence for the sounds chosen. It lists the sounds the game no longer has first, and works in Audiodiver Utils too.

#### Play Together

Added **Play Together**, which plays the selected slots at the same time, up to 16 and kept from clipping, to hear the layers of a gunshot together. It is in the toolbar and the right-click menu, or Shift+Space.

#### Clip Sharing Mode

Replaced Plays In with **Clip Sharing Mode**, set to **Keep Sharing** or **Isolate Audio**. When Isolate Audio can't keep the Original somewhere, because other banks play the same sound, the details name those banks.

### Additions

- Added an entry for each exosuit under Vehicles ▸ Exosuits, and one for the sounds they share. Projects that listed the old set keep those sounds under the new entries.
- Added names for the Title Screen music and Joining or Leaving a Squad in On the Ship.

### Changes

- Changed voice lines to show their subtitles in the language Audiodiver is set to, as the game writes them, in every voice tab. The filter finds a line by the words shown and by the English ones.
- Changed **Open Project** on Home to offer the last project of the selected game, so it no longer switches to the other game.
- Changed Import Mod to point to **Patch Content** when a mod only changes audio the game removed in an update.
- Renamed Bull Machine Pistol to P-44 Mist and Storm Tank to TD-110 Maelstrom, as the game names them.
- Shortened labels such as **Write Mod**, **Add to Project**, **Copy Sound ID** and **Show ZIP**.
- Sped up encoding 16-bit WAVs at 48 kHz and silence, with the same result.
- Updated the Helldivers 1 page of the Wiki: from version 1.4.0 of the mod manager, a deploy takes about as much disk as the new audio.

### Bug Fixes

- Fixed Helldivers 2 sounds in the Library not playing or showing waveforms with a Helldivers 1 project open.
- Fixed the Library sometimes failing to load with both games found.
- Fixed **Helldivers** set to Off in Radio Filter leaving the helmet sound on the voice of the player's Helldiver on foot.
- Fixed **Slice a song** on music with a single slot to fill, such as transitions and stingers.
- Fixed Select All and the tick in the toolbar missing the takes of folded sequences.

## 1.6.0 - 2026-11-02

### Highlights

#### Helldivers 1 Mods

Added Helldivers 1 mode, picked with a switch on Home: a Helldivers 1 project takes new audio or silence and builds a ZIP for the mod manager for Helldivers 1, version 1.1.0 or later. Until now the Library could only play Helldivers 1 audio.

#### The Text Tab

Reworked the Text tab to show every line in categories before anything is typed, and added export and import of lines as CSV or JSON, Find and Replace, and a second language beside each line.

#### Plays In

Replaced Scope with **Plays In**, set to Only This Sound or Every Sound, and made it reachable before a slot has new audio, for several slots at once, in the right-click menu and in the toolbar.

#### Home

Redesigned Home: the picture blurs and darkens behind the menu, each menu button has an icon, New Project has a level meter, and Helldivers 1 mode has pictures of that game.

### Additions

- Added a button beside each Library group or item in the project that opens it in the Audio tab.
- Added a GitHub button beside Discord and Ko-fi on Home.

### Changes

- Changed Audiodiver to open as soon as Helldivers 2 is read. Helldivers 1 joins the Library a moment later, with a notice when that takes a while.
- Changed the Radio Filter section to list each voice with On and Off, so the choice reads the way the game plays it. A mod can be just Radio Filter changes, with no new audio.
- Sped up the first read of Helldivers 1 to about a third of the time, and changed it to read one file at a time on a hard drive.
- Changed tooltips to wait 0.9 s at Normal before they show, instead of 0.5 s.
- Changed notices to take at most half the window and scroll, and "Left out" to name up to three banks on one line.
- Removed the "The mod" title from the Repatch page.

### Bug Fixes

- Fixed Import Mod saying "replaces, adds or sets nothing" on a mod that only changes audio the game removed in an update, such as the flag-raise anthem, instead of saying so (GitHub issue #5).
- Fixed the Simplified Chinese names for the Hellpod, the Automatons, the Cyborgs and the Void to match the game (GitHub issue #4), the French and Japanese names for the Void, and the French names for Illuminate music and weapons.
- Fixed Repatch offering only a file once a mod was read, by adding Choose Another Folder beside Choose Another File.
- Fixed Import Lines calling a CSV that Excel saved in the encoding of the PC "not a text export". It says to save it as CSV UTF-8 now, and line breaks inside a cell come back as the game has them.
- Fixed Find and Replace applying the previous search when Replace was pressed right after typing.
- Fixed a Helldivers 1 project opening in Helldivers 2 mode when Helldivers 1 wasn't found, instead of saying so.
- Fixed the replaced-sound dots in the Library not lining up between groups and items.

## 1.5.1 - 2026-10-31

### Additions

- Added a Helldivers 1 battle theme for each difficulty range (1-4, 5-8 and 9+) under Bugs, Cyborgs and The Illuminate, which used to be one long list of takes.
- Added the three Helldivers 1 boss themes, with their openings.
- Labelled the Helldivers 1 clips that open, loop or close a sound as **Start**, **Loop** and **End**.
- Added the Audiodiver logo to the installer.

### Changes

- Sorted the Helldivers 1 music into a section for each enemy, then **Missions** and **Menus**, in the order the game plays them.

### Bug Fixes

- Fixed Helldivers 1 sounds that showed only some of their clips, or a clip that wasn't theirs. Bullet Gravel had 4 of 67.

## 1.5.0 - 2026-10-31

### Highlights

#### Radio Filter

Added **Radio Filter** to the Project tab, which turns off the radio filter on Mission Control, the Admiral, Eagle-1, Pelican-1 and Helldivers, one voice at a time. Until now, new audio on these voices always went through the filter.

#### Filters and Fades

Added **Low-Pass** and **High-Pass** to any slot, with new audio or the original, and **Fade In** and **Fade Out** for new audio, drawn on the waveform and heard in the preview.

#### Volume Curves

Added the volume curves of the game to the waveform, which show why a song gets quieter as it plays, and **Keep the volume curve** to play a slot at an even level instead.

#### Every Segment in the Soundtrack

Reworked One Song and Playlist to show every segment of a piece, so a whole piece of music can be filled without leaving the tab. The openings got a separate list, where they take new audio or a skip.

#### Helldivers 1

Added Helldivers 1 to the Library, as a tab under Index and All Archives, to play the sounds of that game and export them as WAV, FLAC or MP3. Replacing Helldivers 1 audio wasn't possible yet.

#### Languages

Added French, Spanish and Japanese: the window, the messages, the names in the Library and the Wiki.

#### Copying Audio

Added Ctrl+C and Ctrl+V for audio: copy any slot in the Library or the Audio tab and paste it into the Audio tab, where it needed an export and an import before.

### Additions

- Added exact times to the slice tool: every time shows to the millisecond, and a cut can be typed.
- Added a way to move the Wiki into a separate window, to read beside a project.
- Added selection by container: By Container ID, a click on the line of a container selects every slot under it.
- Added a warning to the installed mods check for a mod with an old copy of the Init bank.
- Added a Helldivers 1 folder to Settings ▸ System.
- Added a setting to hide the news ticker on Home, in Settings ▸ System.
- Added a form for reporting a wrong translation, linked from Settings ▸ System.

### Changes

- Changed Index and All Archives to keep separate panel widths, and All Archives to start wider to fit the columns.

### Bug Fixes

- Fixed Make-Up Gain on original audio adding banks that only store the clip, which made those mods bigger.
- Fixed the "can't be read" warning on an empty global notes file.
- Fixed a voice line with one take showing the line twice By Container ID.
- Fixed a long path in the error message of the Global Note running out of the details panel.
- Fixed the Wiki naming the wrong copy that Combine Mods keeps when two mods have the same texture or string table. It keeps the copy of the lower mod.

## 1.4.2 - 2026-10-29

### Changes

- Renamed groups of takes to **Sequences** ("Sequence 6" instead of "Sound 6"), as in other Helldivers 2 audio tools.
- Changed the details panel to show the Make-Up Gain the game gives a take (**Default**), even at 0 dB, and what the take plays at with the gain set in the project added.
- Proofread the Simplified Chinese translation throughout, so it reads more naturally.
- Removed Flag Raising from the Soundtrack, since the 7.2.2 game update removed the anthem.
- Changed the highlight on the panel of a tutorial step to go away once the pointer moves over it, and come back with the next step.

### Bug Fixes

- Fixed voice lines losing their names and subtitles after the 7.2.2 game update.

## 1.4.0 - 2026-10-28

### Highlights

#### Languages

Added support for languages besides English, starting with Brazilian Portuguese and Simplified Chinese: the window, the messages, the Wiki and the names in the Library and the Soundtrack. **Language** in Settings ▸ System picks one, or follows Steam.

#### Import Mod

Added **Import Mod**, on Home and the Project tab, which turns the ZIP or patch file of an existing mod into a new project after showing what comes in. **Import Patches** opens the same panel now and takes ZIP files too.

#### Export

Reworked Export into one panel for the open item and the export list, which shows the files before writing anything and chooses the slots and the audio: as the mod plays it, the Original, or both.

#### Interactive Tutorials

Added interactive tutorials to the Wiki, which darken the window except where to click and go one step at a time in a practice project. The first one gives the Liberator new firing sounds.

#### Global Notes

Added global notes on slots and items, which show in every project and in the Library. The note a slot had before became the **Project Note**, with the **Global Note** under it.

#### History and Notifications

Added **History** beside Undo and Redo, to go back or forward to any change since the project opened, and **Notifications** in the status bar, which keeps the last 100 notices across restarts.

### Additions

- Added export of a whole piece to the Soundtrack: a fight of 1 to 10 minutes as the game would play it, each segment or each slot.
- Added **Global Notes** to Settings ▸ System, to move the notes file to another folder, export notes as Markdown or JSON, and import notes from a file or a project.
- Added **Imported Settings** to the details panel of the Audio tab, listing settings from an imported mod that Audiodiver has no control for, such as Volume or Pitch. Builds keep them.
- Added a setting for the corner where notices show, in Settings ▸ System.
- Added ticks to Library slots, to export only some sounds of an item.
- Added name choices for exported files (full names, short names or source IDs), and WEM export for Original slots.
- Added a preview of the icon, name and description as the mod manager shows them to the Build tab.

### Changes

- Sped up changes and Undo about 3 times in projects with a lot of new audio.
- Changed Library rows to show only the name and a +, which turns into a red ✕ once the item is in the project, and removed the sound count and length.
- Moved the Export List button from the status bar to the toolbar.
- Changed exported names to get (original) and (replaced) only when both versions are exported, and slots to keep their numbers from the item.
- Removed the Original, Replaced and Both choice from the export of the Library, which could only export the Original anyway.
- Changed ticking a folded sound in the Audio tab to select the takes without unfolding it.
- Changed the installer to follow the language of Windows.
- Removed the outlines from the Wiki entries above the guides.

### Bug Fixes

- Fixed imported Make-Up Gain showing as 0 dB on slots while still adding to any gain set there. It comes in on the slots it reaches now, and mods that only change gains list the items they change. Where two sounds that share a clip get different gains, those stay on the sounds and show under Imported Settings.
- Fixed removing an item leaving new audio in slots that another item shares, which still went into builds. Removing clears everything the project changed in the item now, and asks first when new audio would go.
- Fixed the + of the Library sitting 2 pixels off on items.
- Fixed clicking what plays in the status bar opening the Audio tab after playing in the Soundtrack.
- Fixed small buttons being shorter than the fields beside them.
- Fixed the indent of sounds listed by container ID in the Audio tab.
- Fixed SEAF voice lines missing from the Index since a game update. They're back as SEAF Voices.

## 1.3.0 - 2026-10-27

### Highlights

#### Waveform Controls

Added zoom to the waveforms, in time to place cue points closely and in level to show quiet audio, with a slider up the right side, one under the waveforms, and the mouse wheel. The slice tool got the same controls.

#### Make-Up Gain

Changed Make-Up Gain to work on sounds without new audio too, so an original sound can play louder or quieter, and added **Match the Original Loudness**, which sets the gain that makes new audio as loud as the original.

#### Play Order

Reworked the play order in the Soundtrack into a card for each group of segments, under a heading that says how the group plays them: → joins segments that play in order, and "or" a random pick.

#### Exertion Catalogue

Named the Helldiver Exertions in the Library: 27 kinds, such as Drowning, On Fire and Death, for each of the four voices, with when each one plays.

#### Container IDs

Added a toolbar button that lists a sound bank by container ID, as the tree of the bank, the way Wwise tools show it. The ID is also in the right-click menus and in what the slot search finds.

### Additions

- Added autosave on a timer, in Settings ▸ System: every 1 to 30 minutes, or with each change as before. Changes are saved before a build and when the project or Audiodiver closes.
- Added a button after Make-Up Gain and after the level of a Soundtrack piece that sets them back to 0 dB.
- Added the Make-Up Gain the game gives a sound to the ? of Make-Up Gain.
- Added WEM files as audio for a slot. A WEM in Wwise Vorbis goes into the mod unchanged, and other WEM files are converted like any audio.
- Added **Keep added audio to the project's banks**, a build option, off by default. New takes, layers and new audio set to Only This Sound then stay out of the other banks that have a copy of the sound: the mod gets smaller, but the original can play where one of those banks loads first.
- Added a number from 0 to 100 over the knob of the zoom, preview volume and colour sliders while they move.

### Changes

- Changed the waveforms to draw at the Make-Up Gain, with anything past full scale in red, and ▶ to play at it, as the mod does.
- Changed each kind of slider to look different: Make-Up Gain and levels are faders lit from 0 dB, zoom is a thin line, the preview volume is thin and grey, and settings fill up to a square knob.
- Changed Open Project on Home to hold the last project opened, with the icon and name of that project, in place of the Recent line under it.
- Added Go to Project and Close under Open Project on Home while a project is loaded, each with an icon. Close works like Close Project on the Project tab.
- Moved the Home menu further from the edges of the window.
- Changed buttons to Title Case, and removed the three dots at the end of the ones that open a dialog or a menu.
- Changed a music segment with several tracks to show the segment name on a separate line, with a row for each track under it.
- Changed the list of guides in the Wiki to take a quarter of the width, and the page the rest. Dragging the edge keeps the share when the window changes size.
- Changed panel dividers to turn light grey under the pointer, in place of the primary colour.
- Made the music list and the header of the Soundtrack resize by dragging their edges, as in the other tabs.
- Moved the Slots link of the Soundtrack beside the name of the music.
- Changed the waveforms button on the toolbar to work only while one slot is selected.
- Changed the + that adds audio to a sound to a blue outline, level with the dot beside it.
- Squared the corners of the messages at the bottom of the window and of the tab names that open beside the tab bar, like the rest of the app.
- Changed "id" to "ID" everywhere in the app and the Wiki.

### Bug Fixes

- Fixed Make-Up Gain on sounds that already have one in the game (about 1 in 12) replacing that value instead of adding to it, so −1 dB could play 4 dB quieter.
- Fixed the new audio of a slot with Make-Up Gain moving as the gain changed and pushing the length out of line.
- Fixed the selected row of the lists in high contrast showing white on white in the light theme.
- Fixed selecting a segment in the Soundtrack being slow on music with many segments, such as a Battle.
- Fixed the Templates button of the Soundtrack sitting in the middle of the Music row instead of at the right.
- Fixed the files in a built ZIP being dated 31 December 1979.
- Fixed new takes or a layer added to a folded sound staying hidden while selected, as the sound didn't open.

## 1.2.0 - 2026-10-26

### Additions

- Added **Move project…** to the Project tab, which moves the project folder into another folder, and the project still finds every file it uses.
- Added **Change…** for the mod ID on the Project tab, so builds can update a mod made before, such as one packed by hand.
- Added the build option **Also save the patch files in a folder**, for packing a mod by hand.
- Added cue points for several selected slots at once, and **Apply to … more segments with this file** under Cue points.
- Added the tag **replaced in another sound** to slots that keep the Original while another sound has **Only this sound**.

### Changes

- Changed builds, Repatch and Combine to leave out an empty `.patch_0.gpu_resources` or `.patch_0.stream` file, since audio needs no GPU resources.
- Changed the subtitle of the Project tab to "Projects are folders containing the mod and all associated files."

### Bug Fixes

- Fixed new audio turning into a screech when it played over other new audio, such as a voice line over another voice line or over new music. Build the mod again to get this fix.
- Fixed a short piece of music replaced by a long song crashing the game when it started. Build the mod again to get this fix.
- Fixed Repatch, Import and Combine dropping the cue points of the music in a mod.
- Fixed builds failing with "banks still holding the original audio" when they replaced footsteps, some shared voice lines, or a shared clip that one sound changes with Only this sound.

## 1.1.1 - 2026-10-25

### Bug Fixes

- Fixed reading the game audio failing on a stray file in the Helldivers 2 data folder, with "unpack requires a buffer of … bytes".

## 1.1.0 - 2026-10-25

### Highlights

#### The Soundtrack Tab

Added the **Soundtrack** tab, which sets how each piece of music plays in a mission: in the original order, as one song cut across the segments, as a playlist of whole songs, or silent. Whole fights can be heard before building.

#### Audiodiver Utils

Added **Audiodiver Utils**: Repatch and Combine Mods without the editor, as a 27 MB portable window and a command line that scripts and mod managers can call.

### Additions

- Added Ctrl+V for audio files copied in Explorer, which paste into the selected slots.
- Added a tick on each slot that selects it, and made the selected slots take one file or several at once.
- Added Search slots, which finds slots by name, label, note, file name or ID in every piece of music and sound set.
- Added the stream ID to the slots, the ID other audio tools use.
- Added two buttons at the end of the toolbar that hide or show the header and the waveforms.
- Added a way to hide the Audio, Soundtrack and Text tabs, in Settings or for one project.
- Added a page of frequently asked questions to the Wiki.
- Added Ctrl+F to the Wiki, which finds and marks words on the page. A page opened from the search marks the words searched for.
- Added the library of a second mod manager to Installed mods and Combine Mods.
- Added an option for Dark or Light to follow the system theme, and Reset to Default for the theme.
- Added a Ko-fi button to About, and the source of the news ticker on Home to the credits.

### Changes

- Changed the Index search to also find music by slot labels, and to open a pasted ID at the slot.
- Changed Make-Up Gain to go from −96 to +96 dB, dragged or typed, with one slider for several slots.
- Changed the toolbar above the slots to a row of icons, with Play through as two round buttons at the start.
- Shortened the header above the slots, with the facts side by side.
- Moved Build apart from the project tabs, shown only while a project is open.
- Changed the tabs along a top or bottom bar to share one width, with a longer name widening only that tab.
- Changed Home to stay the same with a project open, and to list recent projects under Open project.
- Changed the Project tab to list recent projects while no project is open, and to show where to start in a new project.
- Made Wiki headings stand out by level.
- Added units to the setting values in Combine Mods.
- Changed the app and the Wiki to say "mod manager" instead of naming one, since builds work with any manager that imports the usual manifest ZIPs.
- Changed the Shared with list to show the other places by where they are, with unnamed music folded.
- Moved item descriptions behind the ⓘ after the title.
- Changed Reset Key Binds to ask first.
- Changed About and the Updates tab to show the version once.
- Rewrote tooltips, notes and ? links across the app to say what things are for, in plainer wording.
- Stopped the chosen option in a row of choices from turning bold, so the row keeps one width.

### Bug Fixes

- Fixed six music clips having a label from another sound group, such as Loadout #13 being named "Mission End - Stats Screen".
- Fixed the tip on "Raise the version after each build" wrongly saying that a mod manager sees every build as an update.
- Fixed lines in the Wiki ending on an opening bracket.
- Fixed the ⓘ and the Replaced status sitting out of line with the item title.
- Fixed the How Audiodiver works page pointing to the wrong next page.
- Fixed the Library saying "never played" where the slot rows say "never heard", and the Text tab marking changed lines as Replaced instead of Changed.

## 1.0.0 - 2026-10-23

First release.
