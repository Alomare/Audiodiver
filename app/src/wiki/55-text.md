---
title: Text and subtitles
group: Making a mod
summary: Changing subtitles and any other line of the game's text on the Text tab, including words, colours and sizes, and what to keep intact.
---

The [Text](app:text) tab has every line of game text in every language, including voice line subtitles, mission and menu text, and names. Search for a line to change it, and the mod includes the change.

## Finding a line

Pick the **language** first. Each language is a separate table, so a change to *English (US)* doesn't change *English (UK)* or *French*. Every line sits in a category: subtitles by the voice that says them, and other lines by what they are for and how they read. Open a category, search for a word from the line, or paste the line ID. **Changed** lists the lines that the project changes.

The right panel shows the **Original**, the **New text** box under it, and a **Preview** of the line as shown in game. Choose a second language above the list to read the line in that language too.

## Changing a line

Type in **New text**. The change is saved shortly after you stop typing, or immediately with {key:save}, and each save is one step for {key:undo}. **Restore Original** puts the original line back.

To format part of a line, select the words and use the bar above the box. It has **Colour**, **Size** and **Emphasis**, and **Timing** for subtitles. With nothing selected, a button formats the whole line. **Clear Formatting** removes every colour, size and style.

[Formatting text](wiki:formatting-text) describes each format, with examples you can copy.

## What to keep

- **Subtitle timing.** A subtitle starts with timing marks like `{0.00->3.85}`, which set when the words appear and disappear, in seconds from the start of the voice line. A long line has several marks. Keep them, and change the times if the new audio has a different length. **Timing** adds a mark at the cursor.
- **Words the game fills in.** Capitalised words after `#`, like `#COUNT` or `#NAME`, are replaced in game when the line is shown. The editor warns if one goes missing.
- **Colours the game fills in**, like `<c=#PLAYER_COLOR>`. Leave these unchanged.
- **Square brackets** in subtitles, like *[Grunts]*, mark sounds that aren't words.

## Find and replace

**Find and Replace** changes words in many lines at once. Choose the lines, type the words, and see every change before it is made. Timing, colours, sizes and words the game fills in stay as they are, and the whole change is one step for {key:undo}. A search also finds parts of words, unless **Whole words only** is on, so check the list before you apply it.

## Exporting and importing

**Export** saves lines to a CSV or JSON file: the selected lines, the changed lines, the lines shown, or a category. A second language adds a column. Tick a line to select it, and Shift+click to select a run of lines. **Restore Original** works on the selected lines too.

Fill in the **New text** column in a spreadsheet, and leave the **Language** and **ID** columns as they are. **Import** reads the file and shows what changes before anything does, as one step for {key:undo}. A line with no new text stays as it is. Lines that lost timing or words the game fills in stay out, unless you untick that option.

## How text is built

A mod contains whole text tables. A build takes each table from the installed game and puts the project's lines into it. This has two consequences:

> [!WARNING]
> **Use only one text mod per table and language.** If two mods change lines in the same table, their changes don't combine. The mod that the mod manager deploys later replaces the other copy of the table.

> [!NOTE]
> **Build again after a game update.** A built mod contains the table as it was at build time, so lines that the game adds or rewrites later are hidden behind it. A new build takes the new table and puts the project's lines back into it. If the game rewrote a line that the project changes, the Text tab shows a warning.

## Subtitles of voice lines

The game files don't link voice lines to subtitles. Audiodiver matched them by what each line says and how long it is. Select a voice line and click the **Subtitle** link to open the subtitle here.

Often several subtitles have the same words. For example, the game has 32 subtitles that say *Reloading.* For many of them, the length of the recording isn't enough to tell them apart. A line like this is marked **one of several**. The Text tab lists every subtitle with those words and opens the most likely one. Change all of them to make sure the new words appear.
