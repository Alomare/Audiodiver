"""Checking the installed mods for sound banks of an older game version.

A mod's patch holds whole copies of the banks it changes. After a game update those copies are stale, and while the
mod is installed the game can load them in place of today's. Its own sounds can go wrong, and so can everything
under the objects many banks share: an actor-mixer that every weapon bank has, in an older copy, silenced all gunfire
after the update of 2026-10-20.

The signs looked for are ones a mod doesn't make itself, so a mod made for the current game never shows them: its
copy of an actor-mixer has other base params than today's beyond its settings (curves, effects: updates change those
on the game's shared parents, mods at most their settings; addition.base_differs); a copy lacks a setting today's has
or has other values for the game's mix, like Priority (addition.older_settings; a mod rebuilt on today's banks with
its old settings carried over shows this); its bank lacks objects today's has (mods don't take the game's out); it
has a bank the game no longer has; or an object is exactly as an earlier version had it (addition.bank_history). A
bank the update didn't touch shows nothing, as it is still right.

Where: the patches in the game's data folder (what the game loads now, whoever put them there) and the mods in HD2
Arsenal's library, deployed or not. Arsenal's own data file is read as far as it goes (its format is Arsenal's); a
deployed patch that is one of its mods' files (the same bytes) is listed once, under that mod.
"""
import filecmp
import json
import os
from pathlib import Path

from . import addition, patch
from . import bank as wbank
from .repatch import PATCH_RE, RepatchError, scan

ARSENAL_DATA = Path(os.environ.get("LOCALAPPDATA") or Path.home() / "AppData" / "Local") / "hd2arsenal" / "hd2a_data.json"
# what a patch says, worst first
SHARED, OLDER, CURRENT, NO_AUDIO, UNREADABLE = "shared", "older", "current", "no_audio", "unreadable"
RANK = {SHARED: 0, OLDER: 1, UNREADABLE: 2, CURRENT: 3, NO_AUDIO: 4}


def arsenal_mods(data_file=None) -> list[tuple[str, Path]]:
    """(name, folder) of each mod in HD2 Arsenal's library; [] without Arsenal or when its file can't be read."""
    try:
        d = json.loads(Path(data_file or ARSENAL_DATA).read_text(encoding="utf-8"))
        mods = [(str(m.get("label") or "").strip(), Path(str(m["path"]))) for m in d["modsLibrary"]
                if isinstance(m, dict) and m.get("path")]
    except (OSError, ValueError, TypeError, KeyError):
        return []
    return [(name or folder.name, folder) for name, folder in mods if folder.is_dir()]


def deployed(data: Path) -> list[Path]:
    """The patch files in the game's data folder."""
    return sorted(p for p in Path(data).glob("*.patch_*") if PATCH_RE.search(p.name) and p.is_file())


def check_patch(path, ix) -> dict:
    """What a patch's sound banks say about the game version they were made for: {"state": SHARED (older copies of
    objects that other banks have too: they can change sounds well beyond the mod), OLDER (its banks are an older
    version's), CURRENT or NO_AUDIO, "objects": how many such shared objects it has, "reach": how many other banks
    have a copy of one of them, "weapons": how many of those are weapon banks}."""
    d = patch.diff(str(path), ix)
    if not d["banks"] and not d["unknown"]:
        return {"state": NO_AUDIO}
    mixers, settings, older = set(), set(), bool(d["unknown"])
    for bid, b in d["banks"].items():
        (_, hirc), (_, vanilla) = b["read"]
        before = addition.bank_history().get(bid, addition.NO_HISTORY)[2]
        same = [(i, t) for _, i in b["objects"] if i in vanilla and (t := hirc[i][0]) == vanilla[i][0]]
        mixers |= {i for i, t in same if t == addition.MIXER and addition.base_differs(t, vanilla[i][1], hirc[i][1])}
        settings |= {i for i, t in same if t in wbank.SETTABLE and addition.older_settings(t, vanilla[i][1], hirc[i][1])}
        older = older or bool(b["removed"]) or any(wbank.fingerprint(*hirc[i]) in before.get(i, ())
                                                   for _, i in b["objects"])
    # older settings matter where other banks share them; in the mod's banks alone they change its own sounds
    shared = {i for i in mixers | settings if set(ix.copies(i)) - set(d["banks"])}
    reach = set().union(*(ix.copies(i) for i in shared)) - set(d["banks"]) if shared else set()
    weapons = {bid for bid in reach if ix.banks[bid].get("path", "").startswith("content/audio/wep")}
    return {"state": SHARED if reach else OLDER if older or mixers else CURRENT,
            "objects": len(shared), "reach": len(reach), "weapons": len(weapons)}


def _checked(path, ix) -> dict:
    try:
        return check_patch(path, ix)
    except Exception as e:  # noqa: BLE001 (a file that isn't a patch, struct.error...: one mod doesn't stop the check)
        return {"state": UNREADABLE, "error": str(e)}


def _worst(parts) -> str:
    return min((p["state"] for p in parts), key=RANK.get, default=NO_AUDIO)


def check(ix, data: Path, arsenal_file=None, step=None) -> dict:
    """Every installed mod with sound banks, worst first: {"mods": [{"name", "source" (the folder or patch file to
    repatch), "where": "arsenal" or "game", "deployed", "state", "patches": [{"label", "file", "state", ...}]}],
    "quiet": how many mods hold no sound banks, "arsenal": whether Arsenal's library was found}.
    step(doing, done, total) follows it."""
    found = []  # (name, source, where, [(label, path)])
    for name, folder in arsenal_mods(arsenal_file):
        try:
            f = scan(folder)
        except (RepatchError, OSError):
            continue
        found.append((name, folder, "arsenal", [(p.label, f.place(key, folder)) for p in f.patches for key in p.keys]))
    loose = deployed(data)
    by_size = {}
    for *_, patches in found:
        for _, p in patches:
            try:
                by_size.setdefault(p.stat().st_size, []).append(p)
            except OSError:
                pass
    shipped = {}  # an Arsenal mod's patch -> the deployed file with its bytes
    for p in loose:
        same = next((q for q in by_size.get(p.stat().st_size, []) if filecmp.cmp(p, q, shallow=False)), None)
        if same is not None:
            shipped[same] = p
        else:
            found.append((p.name, p, "game", [("", p)]))

    total = sum(len(patches) for *_, patches in found)
    done, mods, quiet = 0, [], 0
    for name, source, where, patches in found:
        parts = []
        for label, path in patches:
            if step:
                step(f"Checking {name}", done, total)
            done += 1
            parts.append({"label": label, "file": str(path), **_checked(path, ix)})
        state = _worst(parts)
        if state == NO_AUDIO:
            quiet += 1
            continue
        mods.append({"name": name, "source": str(source), "where": where, "state": state,
                     "deployed": where == "game" or any(path in shipped for _, path in patches),
                     "patches": [p for p in parts if p["state"] != NO_AUDIO]})
    mods.sort(key=lambda m: (RANK[m["state"]], not m["deployed"], m["name"].lower()))
    return {"mods": mods, "quiet": quiet, "arsenal": bool(arsenal_mods(arsenal_file))}
