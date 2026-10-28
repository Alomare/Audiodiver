---
title: Importing a mod
group: Getting started
summary: A mod made with any tool, as a project to keep working on: the audio, the sounds it adds, the settings and the text.
---

**Import Mod** on [Home](app:home), or on the [Project](app:project) tab while no project is open, makes a new project from an existing mod. Choose the ZIP of the mod, or a `.patch_0` file. The panel that opens shows the mod as a mod manager shows it, and lists what comes in before anything is written.

## Options, name and folder

1. Choose the options. A mod with options, such as a choice of voices or a version with subtitles, starts with the options the mod manager has on, or all of them. **What comes in** lists the patches those options deploy.
2. Name the project and choose the folder. The project goes into a new folder there.
3. **Keep the mod ID** makes the builds of the project update this mod in the mod manager. Turn it off to install the builds beside the mod as another one ([Mod ID](wiki:build-and-install#mod-id)).
4. **Use the icon of the mod** puts the image the mod manager shows on the project. Without it, the project has the default icon.
5. Press **Create Project**. The project opens on the Audio tab when the import is done.

## What comes in

- The audio the mod replaces, on the same sounds. It goes into builds without being converted again.
- The audio the mod adds: new takes for a sound, a new sound that plays with an existing one (a layer), or a separate clip for one sound. Each one becomes the same kind of addition that [Adding audio](wiki:adding-audio) makes.
- Make-Up Gain, on the slots of the sounds it reaches, also when the mod sets it on a container above them. A slot has one gain, so where the mod gives two sounds that play the same clip different gains, those gains stay on the sounds, with the other settings.
- Other sound settings, such as the volume or pitch of a sound or a container, or a delay before it plays. Builds include them, and the details panel of the Audio tab lists them under **Imported Settings** on each slot they reach.
- The cue points of the music segments the mod gives new audio.
- The lines of the game text the mod changes, such as subtitles or names.

Models, textures and other files that aren't audio or text stay out, because a project holds only audio and text. Other kinds of change, such as effects or how a container picks sounds, aren't imported either. The import lists what was left out.

## Text

The text comes in as changes on the [Text](app:text) tab, one for each line the mod changes. A mod carries whole tables of text, so a mod made for an older game version also carries the text of that version. Those lines show up as changes even where only the game changed, such as an enemy renamed in an update. The panel lists each line with the text of the mod above the current text. Untick the lines that only the game changed, one by one or a group at once.

## Into the open project

**Import Patches** on the Project tab, or a `.patch_0` file dropped on the window, brings a mod into the open project. The same panel opens, without the name and the folder. If the project isn't empty, choose how the audio comes in. **Add to the Project** keeps the current content, and where both have audio for a slot, the audio of the mod goes in. **Replace the Project's Audio** removes the new audio, added sounds, cue points and list first. Text and audio files stay either way, and Undo restores the project.

To rebuild a mod for the current game version without a project, use [Repatch](wiki:repatching).
