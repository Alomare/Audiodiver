# Contributing to Audiodiver

Thanks for helping. Bug reports, ideas and pull requests are all welcome. For questions, feedback and help, come to
the [Helldivers 2 Modding Discord](https://discord.gg/helldiversmodding); issues are for bugs and planned changes.

## Reporting a bug

Open an issue with:

- the version (bottom right of the window),
- what you did, what you expected, and what happened instead,
- the log file, if the problem left an error in it (the ⓘ next to the version shows where it is).

For anything about how the game plays a sound, say which mission, planet or faction it happened on.

## Suggesting a change

Ideas are best talked over on the Discord first. Open an issue before starting on a large change, so we can agree on
the approach. Small fixes can go straight to a pull request.

## What the repository never takes

- Game files or audio extracted from the game.
- Other people's mods, or audio you don't have the rights to share.
- Art, fonts or code under a licence that doesn't allow it here.

## Setting up

Audiodiver runs on Windows, with Helldivers 2 installed through Steam.

- **Python 3.12+**, for the core (`core/`): `pip install -e "core[test]"`.
- **Node.js 20+** and **Rust** (stable), for the window (`app/`): `npm install` in `app`.
- **ffmpeg**, **vgmstream-cli** and **wav2wem** on your PATH: the core runs them to read and encode audio.

Then `npm run tauri dev` in `app` starts the app with hot reload. The window can also run in a browser against the
core; `app/README.md` explains how.

## Before a pull request

- `python -m pytest core -q` passes. The golden build tests skip unless you have the three reference mods.
- `npx tsc --noEmit` in `app` passes.
- You have run the change in the app and checked it does what it says.
- Code reads like the code around it. `app/README.md` and `core/README.md` say what each file does, and
  `app/README.md` has the rules for the app's writing and layout: short labels, the same action in the same place
  everywhere, smooth on low-end PCs.

One change per pull request, with what it does and why. Add a screenshot when it changes what the app shows.
Contributions written with AI tools are held to the same standard: you've run them and you understand them.

## Licence

Audiodiver is under the GNU General Public License v3.0 or later. By contributing, you agree that your contribution
is released under the same licence.
