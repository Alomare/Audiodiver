---
title: Good practice
group: Making a mod
summary: Habits that make a mod easier to test, update and share.
---

- Keep **one folder per mod**, with the `.audi` file, its `audio` folder and `build`. A copy of the folder is then a complete backup. A project that shares its folder with another shows a warning on the [Project](app:project) tab, with **Move to its own folder**.
- **Name the files in play order**, as in `01 …` and `02 …`. Fills and slices follow that order. If you export a changed file again under the same name, the next build uses the new version.
- **Work in passes.** Rough in one area, such as the ship, the drop or one faction, and build it. Play it and note gaps, abrupt cuts and quiet spots, then fix them and build again. The loadout and drop-location screens are the quickest to reach in game.
- **Use Play through** before you build. It catches most problems with hand-overs without starting the game.
- **Check the transitions** that the Audio Editor marks with **!**. An original transition between two pieces of new music is the most common thing that sounds out of place.
- **Listen at quiet moments and during a firefight.** Loudness problems show up in both situations.
- **Keep the mod's id and name** on [Project](app:project) for the whole life of the mod, so that Arsenal updates the installed mod each time. Use **Make a new id** only when you copy a project to make a different mod.
