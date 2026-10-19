---
title: Building and installing
group: Building and sharing
summary: What a build makes, how to install it with HD2 Arsenal, and how updates reach the installed mod.
---

## Building

On [Build](app:build), press **Build** ({key:build}). Audiodiver converts the new audio for the game, patches every sound bank that holds or plays the replaced sounds, verifies the result, and packs it as a ZIP named after the mod and its version.

The ZIP goes to the `build` folder next to the project file. **Change…** under the Build button sends a mod's builds to another folder; **Back to the default** returns to the project's own. A build adds only the ZIP, so several mods can share a folder. Audiodiver won't build into the game's folder.

Nothing else changes: not the project, not the audio, not the game.

When the project has problems (a missing file, a name Arsenal can't use), Build stays off and the tab lists what to fix, above the button.

## Installing with HD2 Arsenal

HD2 Arsenal is the mod manager Audiodiver builds for.

1. Import the ZIP in Arsenal.
2. Deploy the mods there.
3. Start the game and go where the new music plays.

> [!WARNING]
> Don't copy patch files into the game's `data` folder by hand. Arsenal numbers the patches of all mods when it deploys them, and a hand-copied one gets overwritten or overrides another mod.

## Updating

After each build the version goes up by one (turned off under **When building**). Import the new ZIP in Arsenal: the mod's id stays the same, so Arsenal replaces the installed version instead of adding a second copy. Deploy again and restart the game.

## What Arsenal shows

The [Build](app:build) tab sets the name, description and icon, and previews the icon as Arsenal shows it. Keep the name to plain letters, digits and spaces, without the version: Arsenal keeps the name from the first import. An icon is cropped to a square and sized to 540 × 540.
