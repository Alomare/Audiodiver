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
- Click a name to change it. Each group and option has a description too.
- The square beside a name chooses the image players see in the mod manager. It is cropped to a centred square, like the icon.
- The arrows move groups and options, and the trash can removes them. The first option of a group is the one a mod manager picks at first.

Each group has a letter and each option a number, together a code such as **A3**: the letter shows on the group's image, and the code beside each option's image. Codes follow the order: the first group is **A**, and **A3** is the third option of that group. Moving or removing a group or an option changes the codes after it.

Under each option, a line says what it changes and about how much it adds to the mod. **Changes** lists every slot the option changes, with the setting as the base mod has it and as the option has it. The undo button on a row takes that change out of the option, after a question. Click a slot's name to show it in the Audio tab.

## Editing an option

**Select** on an option makes the [Audio](app:editor) tab edit that option, and the option is highlighted on the Project tab. The bar over the Audio tab says what is edited, and the menu there picks another: **Base Mod**, or an option of a group. **Back to Base Mod**, on either tab, goes back to editing the mod itself. One option is edited at a time.

While an option is edited, the Audio tab plays the mod with that option picked. Changes to slots go into the option:

- A slot of the group goes into the option. The row carries the option's code, such as **A3**.
- A slot no group has yet joins the group.
- A slot of another group can't change. The row carries that group's letter, dashed.

Everything done to slots counts: dropping files, Copy and Paste, Silence, the gain, filters and fades in the details, cue points and the [Waveform Suite](wiki:timing-and-loops#the-waveform-suite). The details panel says which option changes a slot and what plays without the group.

**Remove from Option**, in the right-click menu of a slot, takes the change away: the slot then plays as without the group. A slot no option of the group changes any more is the base mod's again.

New takes, layers and Isolate Audio change what the sounds are made of, so they belong to the base mod. Go back to the base mod to use them.

## Gain

**Gain** on an option adds that many dB to every slot the base mod changes, from −12 to +12 dB. A **Volume** group with **Louder** at +3 dB and **Quieter** at −3 dB lets players set how loud the mod plays. The slots of groups keep the levels set on them, and so does a slot of the base mod changed while an option is edited: it joins the group at the level it was given.

## Groups that change the same banks

In Helldivers 2 mod managers, each option replaces whole sound banks. Two groups can't change the same bank: whichever deploys later would win there, whatever players pick in the other. So a slot whose bank already has sounds of another group can't go into a second group; change it in that group, or in the base mod. The Project and Build tabs say so if two groups still share banks, such as a **Volume** group and a group that changes slots in the base mod's banks.

Obsidian, for Helldivers 1 mods, has no such limit: the build puts in a version of the shared sounds for every set of picks.

## What a build makes

For Helldivers 2, the mod manager lists the base mod first. Each group follows, with the group's options to pick from. Each option holds only the sound banks and streams that differ from the base mod. Where an option puts the original back on a sound the base mod replaces, it holds the game's bank, so the original plays.

A bank goes in whole, with every sound stored in it. Most sounds are stored in banks, so an option that changes one of them adds that bank's full size: about 10 MB for a typical sound, and much more for music, which every mission's music bank holds a copy of. A sound the game streams from a separate file adds only the size of that file.

For Helldivers 1, each group is an option in Obsidian, with the group's options and **Off** to pick from.

> An option that changes nothing yet deploys nothing. Fill it in the Audio tab, or give it a gain, before building.
