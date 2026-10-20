---
title: The game's text and subtitles
group: Making a mod
summary: Changing subtitles and any other line of the game's text in the Text Editor, including words, colours and sizes, and what to keep intact.
---

The [Text Editor](app:text) has every line of the game's text in each of its languages. This includes the subtitles of every voice line, mission and menu text, and names. Find a line and change it, and the mod includes the change.

## Finding a line

Pick the **language** first. Each language is a separate table, so a change to *English (US)* doesn't change *English (UK)* or *French*. Then search for a word from the line, or paste its id. **Changed** lists the lines that the project changes.

Each row shows whether the line is a **Subtitle** or other **Text**. The right panel shows the **Original**, the **New text** box under it, and a **Preview** of how the game displays the line.

## Changing a line

Type in **New text**. The change is saved shortly after you stop typing, or immediately with {key:save}, and each save is one step for {key:undo}. **Restore the original** puts the game's line back.

To format part of a line, select the words and use the bar above the box. It has **Colour**, **Size** and **Emphasis**, and **Timing** for subtitles. If nothing is selected, a button formats the whole line. **Clear formatting** removes every colour, size and style.

[Formatting text](wiki:formatting-text) describes each format, with examples you can copy.

## What to keep

- **Subtitle timing.** A subtitle starts with timing marks like `{0.00->3.85}`, which set when its words appear and disappear, in seconds from the start of the voice line. A long line has several marks. Keep them, and if the voice line's new audio has a different length, change the times to match it. **Timing** adds a mark at the cursor.
- **Words the game fills in.** Capitalised words after `#`, like `#COUNT` or `#NAME`, are replaced by the game when it shows the line. The editor warns you if one goes missing.
- **Colours the game fills in**, like `<c=#PLAYER_COLOR>`. Leave these unchanged.
- **Square brackets** in subtitles, like *[Grunts]*, mark sounds that aren't words.

## How text is built

A mod contains whole text tables. A build takes each table from the installed game and puts the project's lines into it. This has two consequences:

> [!WARNING]
> **Use only one text mod per table and language.** If two mods change lines in the same table, their changes don't combine. The mod that HD2 Arsenal deploys later replaces the other mod's copy of the table.

> [!NOTE]
> **Build again after a game update.** A built mod contains the table as it was at build time. Lines that the game adds or rewrites later would be hidden behind the mod's copy. Building again takes the new table and puts the project's lines back into it. If the game rewrote a line that the project changes, the Text Editor shows a warning.

## Subtitles of voice lines

The game files don't link a voice line to its subtitle. Audiodiver matched them by what each line says and how long it is. Select a voice line and click its **Subtitle** link to open the subtitle here.

Often several subtitles have the same words. For example, the game has 32 subtitles that say *Reloading.* For many of them, the recording's length isn't enough to tell them apart. A line like this is marked **one of several**. The Text Editor lists every subtitle with those words and opens the most likely one. To make sure the new words appear, change all of them.
