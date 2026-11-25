---
title: Options for players
group: Building and sharing
summary: Choices players make in the mod manager, such as how loud the mod plays or which music it brings.
---

## What an option is

An option is a question players answer in the mod manager, with a few **choices**. **Volume** with Default, Louder and Quieter is one; **Ship Music** with Synthwave and Orchestral is another. Players pick one choice of each option.

The first choice of every option is the mod as it is, called **Main**. A player who never opens the options, or turns one off, gets Main. Every other choice says only what differs from Main: other audio in some slots, the original back in some, a gain, filters, fades or cue points.

Options are made on the [Project](app:project) tab, under **Options for Players**.

## Making options

**Add Option** offers three starts:

- **Blank Option**: a Default choice and an empty second one to fill.
- **Volume Levels**: Default, Louder (+3 dB) and Quieter (−3 dB) on every slot the mod changes.
- **Original or Replaced** for an item of the project: Replaced, the default, and Original, so players can turn that part of the mod off.

Click a name to change it, and write what players read under it. The arrows move options and choices, and ✕ removes them. The first choice always stays first.

**Gain** on a choice adds that many dB to the Make-Up Gain of every slot the mod changes, from −12 to +12 dB. Under each choice, a line says what it changes and about how much it adds to the mod.

## Changing slots in a choice

**Edit in Audio Tab** on a choice opens the [Audio](app:editor) tab with that choice picked in the **Editing** switch, on the toolbar. A band under the toolbar says which choice is being edited. From then on, everything done to slots goes into that choice: dropping files, Copy and Paste, Silence, the gain, filters and fades in the details, cue points and the [Waveform Editor](wiki:timing-and-loops#the-waveform-editor). The slots the choice changes carry the choice's name, and the details say what Main has there.

- **Back to Main**, in the right-click menu of a slot, takes the change away: the choice then plays that slot as Main does.
- **Original in This Choice** plays the game's audio there, whatever Main has.
- **Back to Main** in the band, or Main in the switch, goes back to editing the mod itself.

New takes, layers and Isolate Audio change what the sounds are made of, not their audio, so they belong to Main. Switch back to Main to use them.

## Options that change the same banks

In Helldivers 2 mod managers, each choice deploys after Main and replaces whole sound banks. When two options change the same bank, the later option wins there whatever players pick in the first. The Project tab says so under the options, and the Build tab lists it.

**Combine into One Option** turns the two into one option with a choice for every pair, such as **Louder · Orchestral**. Each pair can be renamed. Leaving them apart is allowed: the order of the options then says which one wins.

Obsidian, for Helldivers 1 mods, keeps a picker for each option even when they change the same sounds: the build puts in a version of those sounds for every pair of choices.

## What a build makes

For Helldivers 2, the mod's first option is the mod itself (Main). Each option follows, with the choices as sub-options. The first choice deploys nothing, as it is Main, and each other choice holds only the sound banks and streams that differ from Main. Where a choice puts the original back on a sound Main replaces, it holds the game's bank, so the original plays.

For Helldivers 1, the options go into the mod for Obsidian, and each sound a choice changes goes in for that choice.

> A choice that changes nothing yet deploys nothing. Fill it in the Audio tab, or give it a gain, before building.
