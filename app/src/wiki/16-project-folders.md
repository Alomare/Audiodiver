---
title: Project folders
group: Getting started
summary: Where a project stores files, how to move one, and how a pack carries a project to another computer.
---

## The project folder

A new project gets a folder named after it, with the project file inside, as in `Dune\Dune.audi`. Audiodiver puts everything it makes for the project in an `audio` folder beside that file:

- `audio\slices` holds the pieces the slice tool cuts.
- `audio\imported` holds the audio decoded from an imported mod's patch.
- `audio\added` holds the files **Collect Files** copied from elsewhere.

Built ZIPs go in a `build` folder beside the project file.

Audio picked from another folder stays there, and the project stores the path to it. Paths in a project file are relative to the project folder, and a file on another drive is stored with the full path. A folder moved by hand still has the files inside it, but the project can lose those outside it. [Move project…](#moving-a-project) keeps them.

Older projects can share a folder, with `slices` and `imported` beside the `.audi` file. They keep working, and the [Project](app:project) tab offers to move them.

## Moving a project

**Move Project**, under **Folder** on the Project tab, moves the project folder into a folder you choose: choosing `D:\Mods` for `Dune` makes it `D:\Mods\Dune`. When `D:\Mods` already has a folder named `Dune`, the project folder becomes `Dune 2`.

Everything in the project folder goes along: the project file, the audio Audiodiver made, files you put there, and the builds. Files picked from outside the folder stay where they are, and the project still finds them. On the same drive the move takes a moment. To another drive, the files are copied first, which takes longer for a big project. The list of recent projects follows the project to the new path.

A project that [shares a folder](#moving-a-project-into-a-new-folder) with other projects or files first moves into a new folder, and that folder moves.

## Moving a project into a new folder

The Project tab shows a warning when the project shares a folder with other projects, or is in a shared place such as the Desktop. Audiodiver puts the slices, the imported audio and the builds beside the project file, and in a folder that holds only this project they stay apart from other files. **Move to a New Folder** makes a folder named after the project beside the project file and moves these into it:

- the project file
- the slices and imported audio Audiodiver made for it
- builds in the default build folder

Files picked from elsewhere stay where they are. A file that another project in the old folder uses is copied. The list of recent projects follows the project to the new path.

## Collecting files

**Collect Files** copies audio from outside the project folder into `audio\added` and points the project at the copies. One Undo reverts it, and the copies stay on disk.

Once every file is inside the project folder, the project can be moved or copied as one folder.

## Missing files

A file the project uses goes missing when it is moved, renamed or deleted outside Audiodiver. The slot then shows **Missing:** before the file name, and the Build tab lists the file as a problem, because the mod can't be built without it. Put the file back where it was, or click the file name on the slot to choose another file. With every file inside the project folder ([Collecting files](wiki:project-folders#collecting-files)), the files move with the project.

## Unused files

**Find Unused Files** lists what Audiodiver made for the project that nothing uses any more: slices of an older cut, decoded audio of an imported patch, collected files that no slot plays. **Remove** sends them to the Recycle Bin, and Windows can put them back. On a drive without a Recycle Bin, such as a network drive, Audiodiver asks before it deletes them for good.

Audiodiver searches only the folders it makes, which are `audio\slices`, `audio\imported`, `audio\added` and the older `slices` and `imported`. Before removing anything, Audiodiver checks the list again and keeps any file used by the project, by the Undo history or by another project in the folder.

## Packs

A pack is one file with the `.audipack` extension. It holds the project file and the files the project uses, so the project opens the same on another computer. Builds and unused files are left out, and a file from outside the folder goes in `audio\added`.

**Export as Pack** on the Project tab writes one. Open it with **Open Project** on [Home](app:home), or double-click it in Explorer. Audiodiver unpacks the project into a new folder in the projects folder and opens it. The projects folder is `Documents\Audiodiver\Projects` at first, and then the folder where the last new project was made.

To share the mod itself, see [Sharing a mod](wiki:sharing).

## Opening files from Explorer

With the installer, double-clicking a `.audi` or `.audipack` file opens Audiodiver with that project or pack. When Audiodiver is already running, the same double-click opens the file in the open window.

The portable copy from the release ZIP doesn't register these file types. Open projects and packs from the app instead.
