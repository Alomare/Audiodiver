---
title: The game's text and subtitles
group: Making a mod
summary: Changing subtitles and any other line of the game's text on the Text Editor: words, colours, sizes, and what to keep.
---

The [Text Editor](app:text) has every line of the game's text, in each of its languages: the subtitles of every voice line, mission and menu text, names. Find a line, change it, and the mod carries the change.

## Finding a line

Pick the **language** first: each language is a table of its own, so a change to *English (US)* doesn't change *English (UK)* or *French*. Then search for a word of the line, or paste its id. **Changed** lists the lines the project changes.

A row says whether the line is a **Subtitle** or other **Text**. The right panel shows the **Original**, the **New text** under it, and a **Preview** of how the game shows it.

## Changing it

Type in **New text**; it saves a moment after typing stops (or at once with {key:save}), and each save is one step of {key:undo}. **Restore the original** gives the line back.

Select words and use the bar above the box:

- **Colour**: pick one (or type its hex code) and press *Colour*. The game writes colours as `<c=FFRRGGBB>words</c>`, the opacity first: `FFFFE900` is the game's own yellow.
- **Size**: `<s=30>words</s>`. Chat uses sizes; no line of the game does.
- **Emphasis**: the game's own emphasis style, `<i=1>words</i>`.
- **Clear formatting** removes every colour, size and style.

With nothing selected, a button formats the whole line.

## What to keep

- **Subtitle timing.** A subtitle starts with its timing, like `{0.00->3.85}`: from when to when, in seconds into the voice line, its words show. A long line has several. Keep them, and when the voice line's new audio has another length, change the times to match. **Timing** adds one at the cursor.
- **Words the game fills in.** Words in capitals after `#`, like `#COUNT` or `#NAME`, are filled in when the game shows the line. The editor warns when one goes missing.
- **Colours the game fills in**, like `<c=#PLAYER_COLOR>`: leave them as they are.
- *[Square brackets]* in subtitles mark sounds that aren't words, like *[Grunts]*.

## How it is built

A mod carries whole text tables, not single lines. A build takes the table from the installed game and puts the project's lines in it, so:

> [!WARNING]
> **One text mod per table and language.** Two mods that change lines of the same table don't add up: the one HD2 Arsenal deploys later replaces the other's table whole.

> [!NOTE]
> **After a game update, build again.** A built mod is a copy of the table as it was, so lines the game adds or rewrites later would be hidden behind it. Building again takes the new table and puts the project's lines back in. If the game rewrote a changed line, the Text Editor says so.

The game files don't link a voice line to its subtitle: to change both, find the subtitle by its words.
