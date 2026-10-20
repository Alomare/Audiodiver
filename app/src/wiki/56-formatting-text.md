---
title: Formatting text
group: Making a mod
summary: What each button of the Text Editor's formatting bar does, how the game writes each format, and examples to copy.
---

The game formats its text with tags. An opening tag goes before some words, and a closing tag goes after them. For example, `<c=FFFFE900>ARMORED ENEMIES</c>` shows *ARMORED ENEMIES* in the game's yellow. The bar above **New text** in the [Text Editor](app:text) writes the tags for you, and you can also type them yourself. **Preview** shows the result as you work.

Each example below shows a line as you type it on the left, and as it appears on the right.

## Applying a format

1. Select the words in **New text**.
2. If the format has a colour or a size, set it first.
3. Press the button.

The tags go around the selected words, and the words stay selected, so you can press a second button to add a second format. If nothing is selected, a button formats the whole line, after any subtitle timing.

Tags can go inside other tags. Close them in the reverse order of opening them:

```game-text
Use the <c=FFFFE900><i=1>Hellbomb</i></c> on the nest.
```

**Clear formatting** removes every colour, size and style tag from the line and keeps the words and the timing. It also removes the colours that the game fills in (described below). The editor warns you when that happens, and {key:undo} brings them back.

## Colour

**Colour** changes the colour of the words. Pick a colour with the swatch, or type its hex code in the box next to it, and then press **Colour**.

The game writes a colour as eight hex digits. The first two set the opacity (`FF` is fully opaque), and the rest set red, green and blue. Audiodiver always writes `FF` for the opacity. To make words partly transparent, type a lower value by hand. For example, `80` is half transparent.

```game-text
Pick up and use <c=FFFFE900>EXPENDABLE ANTI-TANK</c> against <c=FFFFE900>ARMORED ENEMIES</c>.
```

```game-text
<c=FFFF0000>Danger close.</c> Clear the area.
```

```game-text
<c=80FFFFFF>Barely there.</c>
```

These are the colours the game uses most often:

| Code | Colour | Lines |
|---|---|---|
| `FFFFE900` | Super Earth yellow, used on the key words of tips | 166 |
| `FF336666` | dark teal | 13 |
| `FF66cc99` | pale green | 5 |
| `FFFF0000` | red | 4 |

## Size

**Size** makes the words larger or smaller. Set a size from 10 to 60 in the number box, then press **Size**. The game's normal size is 20.

```game-text
<s=30>FOR SUPER EARTH!</s>
```

```game-text
Mission complete. <s=14>Mostly.</s>
```

> [!NOTE]
> None of the game's lines use sizes, but the game's chat does. The game decides how a size looks in a subtitle or a menu, so check it in game before you share a mod.

## Emphasis

**Emphasis** writes `<i=1>`, the style the game uses for terms that its tips and briefings explain. The Preview shows it in italics. In game it uses the game's emphasis style.

```game-text
Welcome to the <i=1>Galactic Map</i>. Select <i=1>Missions</i> to play.
```

The game has other styles that the bar doesn't add. It uses `<i=3>` for the heading of an advisory, and `<i=2>` between the numbers of a timer. Type them by hand to use them:

```game-text
<i=3>STRATEGIC ADVISORY</i>
The Automaton <i=1>Jet Brigade</i> has been spotted.
```

## Timing (subtitles)

A subtitle starts with a timing mark, `{start->end}`. The mark sets when the words after it appear and disappear, in seconds from the start of the voice line. A long subtitle has several marks, one for each piece of text. Press **Timing** to add `{0.00->2.00}` at the cursor, then type the times.

```game-text
{0.00->1.85}Reinforcements inbound!
```

```game-text
{0.00->2.40}Stratagem coming in hot.
{2.40->4.10}Clear the landing zone!
```

If you give a voice line new audio with a different length, change the times in its subtitle to match. The Library shows a voice line's length above its waveform, and the line's **Subtitle** link opens the subtitle here.

## Line breaks

Press Enter in **New text** to start a new line. The game's longer texts use line breaks (440 lines have them), and so do a few long subtitles, with one piece of text per line.

## Parts the game fills in

The game fills in some parts of a line when it displays the line. Keep these parts unchanged, and move them along with the words when you reword the line:

- **Capitalised words after `#`**, like `#NAME` or `#COUNT`, become a player's name or a number. The Preview shows them as boxes.
- **Colours with a name in place of a code**, like `<c=#PLAYER_COLOR>`, are chosen by the game. One example is a player's colour. The Preview underlines the words that these tags colour.

```game-text
<c=#PLAYER_COLOR>#NAME</c> DIED
```

```game-text
<c=#PLAYER_COLOR>#NAME</c> gave their life for <c=FFFFE900>Super Earth</c>
```

The editor warns you if a line loses one of these parts.
