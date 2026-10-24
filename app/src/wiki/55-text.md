---
title: Text and subtitles
group: Making a mod
summary: Changing subtitles and any other line of the game's text on the Text tab, including words, colours and sizes, and what to keep intact.
---

The [Text](app:text) tab has every line of game text in every language, including voice line subtitles, mission and menu text, and names. Search for a line to change it, and the mod includes the change.

## Finding a line

Pick the **language** first. Each language is a separate table, so a change to *English (US)* doesn't change *English (UK)* or *French*. Then search for a word from the line, or paste its id. **Changed** lists the lines that the project changes.

Each row shows whether the line is a **Subtitle** or other **Text**. The right panel shows the **Original**, the **New text** box under it, and a **Preview** of the line as shown in game.

## Changing a line

Type in **New text**. The change is saved shortly after you stop typing, or immediately with {key:save}, and each save is one step for {key:undo}. **Restore the original** puts the original line back.

To format part of a line, select the words and use the bar above the box. It has **Colour**, **Size** and **Emphasis**, and **Timing** for subtitles. With nothing selected, a button formats the whole line. **Clear formatting** removes every colour, size and style.

[Formatting text](wiki:formatting-text) describes each format, with examples you can copy.

## What to keep

- **Subtitle timing.** A subtitle starts with timing marks like `{0.00->3.85}`, which set when the words appear and disappear, in seconds from the start of the voice line. A long line has several marks. Keep them, and change the times if the new audio has a different length. **Timing** adds a mark at the cursor.
- **Words the game fills in.** Capitalised words after `#`, like `#COUNT` or `#NAME`, are replaced in game when the line is shown. The editor warns if one goes missing.
- **Colours the game fills in**, like `<c=#PLAYER_COLOR>`. Leave these unchanged.
- **Square brackets** in subtitles, like *[Grunts]*, mark sounds that aren't words.

## How text is built

A mod contains whole text tables. A build takes each table from the installed game and puts the project's lines into it. This has two consequences:

> [!WARNING]
> **Use only one text mod per table and language.** If two mods change lines in the same table, their changes don't combine. The mod that the mod manager deploys later replaces the other copy of the table.

> [!NOTE]
> **Build again after a game update.** A built mod contains the table as it was at build time, so lines that the game adds or rewrites later are hidden behind it. A new build takes the new table and puts the project's lines back into it. If the game rewrote a line that the project changes, the Text tab shows a warning.

## Subtitles of voice lines

The game files don't link voice lines to subtitles. Audiodiver matched them by what each line says and how long it is. Select a voice line and click the **Subtitle** link to open the subtitle here.

Often several subtitles have the same words. For example, the game has 32 subtitles that say *Reloading.* For many of them, the length of the recording isn't enough to tell them apart. A line like this is marked **one of several**. The Text tab lists every subtitle with those words and opens the most likely one. Change all of them to make sure the new words appear.
