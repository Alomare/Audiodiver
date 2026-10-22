---
title: Project folders
group: Getting started
summary: Where a project keeps its files, how to move one into a folder, and how a pack carries it to another computer.
---

## The project folder

A new project gets a folder named after it, and its file goes inside, as in `Dune\Dune.audi`. Everything Audiodiver makes for the project goes in an `audio` folder beside that file:

- `audio\slices` holds the pieces the slice tool cuts.
- `audio\imported` holds the audio decoded from an imported mod's patch.
- `audio\added` holds the files **Collect files** copied from elsewhere.
- `build` holds this mod's ZIPs.

Audio you pick from another folder stays there, and the project stores the path to it. Paths in a project file are relative to its folder, so the whole folder can be moved or copied. A file on another drive is stored with its full path.

Older projects can sit several to a folder, with `slices` and `imported` beside the `.audi` file. They keep working there, and the [Project](app:project) tab offers to move one.

## Moving a project into its own folder

The Project tab shows a warning when the project shares its folder with something else. **Move to its own folder** makes a folder named after the project beside the project file and moves into it:

- the project file
- the slices and imported audio Audiodiver made for it
- its builds, when they are in the default build folder

Files you picked from elsewhere stay where they are, and the project points at them. A file that another project in the old folder uses is copied. The list of recent projects follows the project to its new path.

## Collecting files

**Collect files** copies the audio the project uses from outside its folder into `audio\added` and points the project at the copies. This is one step of Undo, and the copies stay on disk after an undo.

A project with every file inside its folder can be moved, copied or packed as one piece.

## Unused files

**Find unused files** lists what Audiodiver made for the project that nothing uses any more: slices of an older cut, decoded audio of an imported patch, collected files that no slot plays. **Remove** sends them to the Recycle Bin, and Windows can put them back.

Audiodiver searches only the folders it makes, which are `audio\slices`, `audio\imported`, `audio\added` and the older `slices` and `imported`. Files you chose yourself are never listed. Before anything is removed, the list is taken again, and a file that the project or its Undo history still uses is kept.

## Packs

A pack is one file with the `.audipack` extension. It holds the project file and the files the project uses, so another computer gets the project as it is. Builds and unused files are left out, and a file from outside the folder goes in `audio\added`.

**Export as pack…** on the Project tab writes one. Open it with **Open project…** on [Home](app:home), or double-click it in Explorer. Audiodiver unpacks the project into a new folder in the projects folder, which is `Documents\Audiodiver\Projects` unless another one was chosen, and opens it.

A pack holds the project. To share a mod, see [Sharing a mod](wiki:sharing).

## Opening files from Explorer

With the installer, double-clicking a `.audi` or `.audipack` file opens Audiodiver with that project or pack. When Audiodiver runs already, the same double-click opens the file in the open window, without starting a second copy.

The portable copy from the release's ZIP doesn't register these file types. Open projects and packs from the app instead.
