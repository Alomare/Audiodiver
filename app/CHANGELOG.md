# Changelog

The Updates tab shows this file. Each release starts with a second-level heading, `<version> - <date>`,
newest first.

## 1.2.0 - 2026-10-26

### Fixes that need a new build

Build a mod again to fix two problems that mods built with earlier versions can have. New audio could turn into a screech when it played over other new audio, such as a voice line over another voice line or over new music. A short piece of music replaced by a long song could crash the game when it started.

### Other changes

- Added **Move project…** to the Project tab. It moves the project folder into another folder, and the project still finds every file it uses.
- Added **Change…** to the mod id on the Project tab, so that builds can update a mod made before, such as one packed by hand.
- Added the build option **Also save the patch files in a folder**, for packing a mod by hand.
- Added cue points for several selected slots at once, and **Apply to … more segments with this file** under Cue points.
- Added the tag **replaced in another sound** to slots that keep the Original while another sound has **Only this sound**.
- Changed builds, Repatch and Combine to leave out an empty `.patch_0.gpu_resources` or `.patch_0.stream` file. Audio needs no GPU resources.
- Changed the Project tab's subtitle to "Projects are folders containing the mod and all associated files."
- Fixed Repatch, Import and Combine dropping the cue points of a mod's music.
- Fixed builds failing with "banks still holding the original audio" when they replaced footsteps, some shared voice lines, or a shared clip that one sound changes with Only this sound.

## 1.1.1 - 2026-10-25

Reading the game audio no longer fails on a stray file in the Helldivers 2 data folder. The error said "unpack requires a buffer of … bytes".

## 1.1.0 - 2026-10-25

### The Soundtrack tab

A new tab sets how each piece of music plays in a mission: in the original order, as one song cut across the segments, as a playlist of whole songs, or silent. Whole fights can be heard before building.

### Other changes

- Added Audiodiver Utils: Repatch and Combine Mods on their own, as a 27 MB portable window and a command line that scripts and mod managers can call.
- Added Ctrl+V for audio files copied in Explorer: they paste into the selected slots.
- Added a tick to each slot that selects it, and the selected slots take one file or several at once.
- Added Search slots, which finds slots by name, label, note, file name or id in every piece of music and sound set.
- Changed the Index search to also find music by slot labels, and to open a pasted id at the slot.
- Changed Make-Up Gain to go from −96 to +96 dB, dragged or typed, with one slider for several slots.
- Added the stream id to the slots, the id other audio tools use.
- Changed the toolbar above the slots to a row of icons, with Play through as two round buttons at the start.
- Added two buttons at the end of the toolbar that hide or show the header and the waveforms.
- Shortened the header above the slots, with the facts side by side.
- Added a way to hide the Audio, Soundtrack and Text tabs, in Settings or for one project.
- Moved Build apart from the project tabs. It shows only while a project is open.
- Changed the tabs along a top or bottom bar to share one width, with a longer name widening only that tab.
- Changed Home to stay the same with a project open, and to list recent projects under Open project.
- Changed the Project tab to list recent projects while no project is open, and to show where to start in a new project.
- Added a page of frequently asked questions to the Wiki, and made Wiki headings stand out by level.
- Added Ctrl+F in the Wiki, which finds and marks words on the page. A page opened from the search marks the words searched for.
- Added the library of a second mod manager to Installed mods and Combine Mods.
- Changed Combine Mods to show setting values with units.
- Changed the app and the Wiki to say "mod manager" instead of naming one. Builds work with any manager that imports the usual manifest ZIPs.
- Changed the Shared with list to show the other places by where they are, with unnamed music folded.
- Moved item descriptions behind the ⓘ after the title.
- Added an option for Dark or Light to follow the system theme, and Reset to Default for the theme.
- Changed Reset Key Binds to ask first.
- Added a Ko-fi button to About, and the source of the news ticker on Home to the credits.
- Changed About and the Updates tab to show the version once.
- Rewrote tooltips, notes and ? links across the app to say what things are for, in plainer wording everywhere.
- Removed the bold from the chosen option in a row of choices, so the row keeps one width.
- Fixed six music clips that had a label from another sound group, such as Loadout #13 being named "Mission End - Stats Screen".
- Fixed the tip on "Raise the version after each build", which wrongly said that a mod manager sees every build as an update.
- Fixed lines in the Wiki that ended on an opening bracket.
- Fixed the ⓘ and the Replaced status sitting out of line with the item title.
- Fixed the How Audiodiver works page pointing to the wrong next page.
- Fixed the Library saying "never played" where the slot rows say "never heard", and the Text tab marking changed lines as Replaced instead of Changed.

## 1.0.0 - 2026-10-23

First release.
