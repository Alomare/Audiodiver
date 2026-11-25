---
title: Options for players
group: Building and sharing
summary: Groups players tick in the mod manager, each with options to pick from, such as one of five sounds for a weapon.
---

## Groups and options

A **group** is a part of the mod players can turn on or off in the mod manager, such as **Liberator Fire** or **Extraction**. The group has **options** to pick from, such as **1**, **2** and **3**. Players tick a group and pick one option of the group. A group left unticked installs nothing, so the slots of the group play as they would without it: the original sound, or what the rest of the mod puts there.

Everything outside the groups is the **base mod**, which is always installed.

Groups are made on the [Project](app:project) tab, under **Options for Players**:

- **Add Group** adds a group with one option. **Add Option** adds another.
- Click a name to change it, and write what players read under it.
- The square beside a name chooses the image players see in the mod manager. It is cropped to a centred square, like the icon.
- The arrows move groups and options, and ✕ removes them. The first option of a group is the one a mod manager picks at first.

Under each option, a line says what it changes and about how much it adds to the mod.

## In the Audio tab

Once the project has a group, a bar over the [Audio](app:editor) tab has a picker for each group: **Off**, or one of the group's options. **Edit in Audio Tab** on an option picks it there too.

What the pickers pick is what plays in the Audio tab, so any combination can be heard together. Changes to slots go where the slots belong:

- A slot a group already has goes into the option picked in that group. The row carries the group's name and the option's.
- A slot no group has yet goes where **New Slots Go To** says: one of the groups picked, or **The Base Mod**. With one group picked, it goes there. With several, choose first.
- A slot whose group is **Off** can't change until an option of that group is picked.

Everything done to slots counts: dropping files, Copy and Paste, Silence, the gain, filters and fades in the details, cue points and the [Waveform Editor](wiki:timing-and-loops#the-waveform-editor). The details panel says which option changes a slot and what plays without the group.

**Remove from Option**, in the right-click menu of a slot, takes the change away: the slot then plays as without the group. A slot no option of the group changes any more is the base mod's again.

New takes, layers and Isolate Audio change what the sounds are made of, so they belong to the base mod. Turn every group **Off** to use them.

## Gain

**Gain** on an option adds that many dB to every slot the base mod changes, from −12 to +12 dB. A **Volume** group with **Louder** at +3 dB and **Quieter** at −3 dB lets players set how loud the mod plays. The slots of groups keep the levels set on them.

## Groups that change the same banks

In Helldivers 2 mod managers, each option replaces whole sound banks. Two groups can't change the same bank: whichever deploys later would win there, whatever players pick in the other. So a slot whose bank already has sounds of another group can't go into a second group; change it in that group, or in the base mod. The Project and Build tabs say so if two groups still share banks, such as a **Volume** group and a group that changes slots in the base mod's banks.

Obsidian, for Helldivers 1 mods, has no such limit: the build puts in a version of the shared sounds for every set of picks.

## What a build makes

For Helldivers 2, the mod manager lists the base mod first. Each group follows, with the group's options to pick from. Each option holds only the sound banks and streams that differ from the base mod. Where an option puts the original back on a sound the base mod replaces, it holds the game's bank, so the original plays.

For Helldivers 1, each group is an option in Obsidian, with the group's options and **Off** to pick from.

> An option that changes nothing yet deploys nothing. Fill it in the Audio tab, or give it a gain, before building.
