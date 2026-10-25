# Audiodiver's command line

Repatch, Combine Mods and the installed mods check also run from a command line, so a script or a mod manager can
call them. They are the same jobs the window runs, on the same game data and caches.

## Where to get it

- **Audiodiver Utils** (`Audiodiver-Utils-<version>-portable.zip` on the
  [releases page](https://github.com/Alomare/Audiodiver/releases/latest)): unzip it anywhere and run
  `audiodiver.cmd`. It needs no Python and no install, and keeps everything it writes in the `data` folder beside it.
- **From source**: `pip install -e core`, then `python -m audiodiver`, with the tools [README.md](README.md) names.

The examples below use `audiodiver.cmd`; with Python, use `python -m audiodiver` instead.

## Commands

| Command | What it does |
|---|---|
| `scan <mod>` | Lists what a mod holds: the patches, the options with their ids, and the choice it starts with. Reads no game data, so it answers at once. |
| `repatch <mod>` | Rebuilds a mod made for an older game version on the current sound banks, with the same audio, settings, options and id. |
| `combine <mod> <mod> …` | Builds one mod out of several. Where two mods change the same sound, the later one wins unless a plan says otherwise. |
| `check` | Lists the installed mods (from the mod manager's library, else the game's folder) and whether each needs a repatch. |

A mod is a ZIP, a folder or a `.patch_0` file. The first command after a game update reads the game's audio, which
takes about a minute; later ones start in seconds.

| Option | For | What it does |
|---|---|---|
| `--json` | all | Prints the result as JSON on stdout. Progress goes to stderr. |
| `--verbose` | all | Prints progress on stderr with `--json` too. |
| `--game DIR` | all | Reads the game from this folder, else the one in Settings, `HD2_DATA` or Steam's. |
| `--out DIR` | repatch, combine | The folder the ZIP goes into, else the one the window's Tools used last. |
| `--name NAME` | repatch, combine | The new mod's name, else the mod's own (or "Combined mods"). |
| `--every-bank` | repatch, combine | Puts the sounds into every bank that has them, not only the mod's own. |
| `--plan FILE` | combine | The mods, their options and who wins each clash, as JSON (below). |
| `--clashes` | combine | Only reads the mods and lists where they clash. Builds nothing. |

`audiodiver.cmd <command> --help` lists them too.

## Exit codes and errors

`0` means done. Anything else is a failure: the message goes to stderr, and with `--json` stdout has
`{"error": "…"}` in place of the result. Ctrl+C stops a running job the way Cancel does in the window.

## Combining with a plan

Without a plan, each mod starts with the options the mod manager recorded as chosen (Arsenal's or Echelon's
library), else every option on, set to the first choice. A plan names the options and the winners:

```json
{
  "mods": [
    {"source": "C:\\Mods\\Loadout Music.zip", "picks": ["0", "1.1"]},
    {"source": "C:\\Mods\\Weapon Sounds.zip"}
  ],
  "winners": {"<clash id>": 0},
  "name": "My combined mod"
}
```

- `mods` is in order: where two mods differ, the later one wins unless `winners` says otherwise. A mod without
  `picks` starts as above.
- `picks` are option ids from `scan`: `"0"` turns on the first option, `"1.1"` picks the second choice of the second
  option.
- `winners` maps a clash id from `--clashes` to the mod that wins it, by the index of that mod in `mods` (0 is the first).
- `name` is optional, and `--name` wins when both are given.

A typical run:

```
audiodiver.cmd scan "C:\Mods\Loadout Music.zip" --json
audiodiver.cmd combine --plan plan.json --clashes --json
audiodiver.cmd combine --plan plan.json --out "C:\Mods\Combined" --json
```

## What `--json` returns

Paths are absolute. Fields not listed here can change between versions.

**scan**

```json
{
  "name": "BF1 Behemoth Horns for Factory Strider",
  "manifest": true,
  "patches": [{"key": "BF1 Behemoth Horns/BF1 Behemoth Horns and Heavy Units/9ba626afa44a3aa3.patch_0",
               "label": "BF1 Behemoth Horns for Factory Strider / BF1 Behemoth Horns and Heavy Units",
               "audio": true}],
  "options": [{"id": "0", "name": "BF1 Behemoth Horns for Factory Strider",
               "sub": [{"id": "0.0", "name": "BF1 Behemoth Horns and Heavy Units"},
                       {"id": "0.1", "name": "BF1 Behemoth Horns for Factory Strider"}]}],
  "picks": ["0.0"]
}
```

`manifest` says whether the mod has a mod manager manifest, `audio` whether a patch has audio to repatch, and
`picks` the choice the mod starts with.

**repatch**

```json
{
  "name": "Warp Pack Plus 5 Sounds",
  "zip": "C:\\Mods\\Repatched\\Warp Pack Plus 5 Sounds.zip",
  "mb": 4.2,
  "kept_id": false,
  "parts": [{"label": "", "imported": 10, "added": 6, "settings": 4, "left": [], "kept": ""}]
}
```

One part per patch: `imported` sounds carried over, `added` new ones, `settings` changed, `left` the changes left
out (as sentences), and `kept` why a patch was kept as it was (empty when it was repatched). `kept_id` says whether
the new ZIP has the old mod's id, so that a mod manager updates it in place.

**combine**

```json
{
  "name": "Combined mods",
  "zip": "C:\\Mods\\Combined\\Combined mods.zip",
  "mb": 4.7,
  "mods": [{"name": "Loadout Music", "imported": 10, "added": 6, "settings": 4, "left": []}]
}
```

With `--clashes`, the mods as read, and the clashes grouped by where they play:

```json
{
  "mods": [{"source": "C:\\Mods\\Loadout Music.zip", "name": "Loadout Music", "sounds": 16, "left": []}],
  "groups": [{"name": "Loadout Selection", "clashes": [
    {"id": "<clash id>", "kind": "sound", "label": "Loadout Start",
     "versions": [{"mod": 0, "audio": "C:\\…\\a.wav", "ms": 8120}, {"mod": 1, "audio": "C:\\…\\b.wav", "ms": 7980}],
     "winner": 1}]}]
}
```

A clash's `kind` is `sound`, `clip` or `setting` (a setting's versions have a `value` in place of `audio`).
`winner` is the mod that wins without a plan.

**check**

```json
{
  "mods": [{"name": "Loadout Music", "source": "C:\\…\\Loadout Music", "where": "manager", "deployed": true,
            "state": "older"}],
  "quiet": 3,
  "library": true
}
```

`state` is `current`, `older` (sound banks of an older game version: repatch it), `shared` (older copies of settings
that other sounds use, which can silence them: repatch it), `no_audio` or `unreadable`. `where` is `manager` for a
mod in a mod manager's library, `game` for a patch only in the game's folder. `quiet` counts the mods without sound
banks, and `library` says whether a mod manager's library was found.
