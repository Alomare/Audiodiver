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

Where: the patches in the game's data folder (what the game loads now, whoever put them there) and the mods in the
mod managers' libraries, deployed or not: HD2 Arsenal's data file, read as far as it goes (its format is Arsenal's),
and Echelon's library.json (a published format, version 1). A deployed patch that is one of their mods' files (the
same bytes) is listed once, under that mod.
"""
import filecmp
import json
import os
from pathlib import Path

from . import addition, patch
from . import bank as wbank
from .i18n import tr
from .repatch import PATCH_RE, RepatchError, scan

ARSENAL_DATA = Path(os.environ.get("LOCALAPPDATA") or Path.home() / "AppData" / "Local") / "hd2arsenal" / "hd2a_data.json"
ECHELON_DATA = Path(os.environ.get("APPDATA") or Path.home() / "AppData" / "Roaming") / "Echelon" / "library.json"
# what a patch says, worst first
SHARED, OLDER, CURRENT, NO_AUDIO, UNREADABLE = "shared", "older", "current", "no_audio", "unreadable"
RANK = {SHARED: 0, OLDER: 1, UNREADABLE: 2, CURRENT: 3, NO_AUDIO: 4}


def _profile(d: dict) -> dict:
    """{mod uuid: its line in the profile Arsenal deployed (else the one it shows)}. A line says whether the mod is on
    and what is chosen of its options: optionsConfig, [{name, enabled, suboptions: [{name, enabled}]}]."""
    lists = d.get("modsList")
    for key in (d.get("deployedProfile"), d.get("selectedProfile"), "default"):
        prof = lists.get(key) if isinstance(lists, dict) and isinstance(key, str) else None
        if isinstance(prof, dict) and isinstance(prof.get("mods"), list) and prof["mods"]:
            return {m.get("uuid"): m for m in prof["mods"] if isinstance(m, dict)}
    return {}


def arsenal_entries(data_file=None) -> list[tuple[str, Path, dict]]:
    """(name, folder, its entry) of each mod in HD2 Arsenal's library; [] without Arsenal or when its file can't be
    read. The library's entry lists the mod's options as its manifest has them (all on, the first of each choice);
    what the user chose is in the profile, so the entry's options are the profile's where it has the mod."""
    try:
        d = json.loads(Path(data_file or ARSENAL_DATA).read_text(encoding="utf-8"))
        chosen = _profile(d)
        mods = []
        for m in d["modsLibrary"]:
            if isinstance(m, dict) and m.get("path"):
                line = chosen.get(m.get("uuid")) or {}
                if isinstance(line.get("optionsConfig"), list):
                    m = {**m, "options": line["optionsConfig"]}
                mods.append((str(m.get("label") or "").strip(), Path(str(m["path"])), m))
    except (OSError, ValueError, TypeError, KeyError, AttributeError):
        return []
    return [(name or folder.name, folder, m) for name, folder, m in mods if folder.is_dir()]


def echelon_entries(data_file=None) -> list[tuple[str, Path, dict]]:
    """(name, folder, its entry) of each mod in Echelon's library; [] without Echelon or when its file can't be read.
    The entry's options are the active profile's: [{name, enabled, choices: [{name}], selected: a choice's place}]."""
    try:
        d = json.loads(Path(data_file or ECHELON_DATA).read_text(encoding="utf-8"))
        if d.get("format") != "echelon-library":
            return []
        mods = [(str(m.get("name") or "").strip(), Path(str(m["folder"])), m)
                for m in d["mods"] if isinstance(m, dict) and m.get("folder")]
    except (OSError, ValueError, TypeError, KeyError, AttributeError):
        return []
    return [(name or folder.name, folder, m) for name, folder, m in mods if folder.is_dir()]


def manager_entries(arsenal_file=None, echelon_file=None) -> list[tuple[str, Path, dict]]:
    """(name, folder, its entry) of each mod in the mod managers' libraries, a folder both have once (Arsenal's)."""
    seen, out = set(), []
    for name, folder, m in arsenal_entries(arsenal_file) + echelon_entries(echelon_file):
        if (k := os.path.normcase(os.path.normpath(folder))) not in seen:
            seen.add(k)
            out.append((name, folder, m))
    return out


def arsenal_mods(data_file=None) -> list[tuple[str, Path]]:
    """(name, folder) of each mod in HD2 Arsenal's library; [] without Arsenal or when its file can't be read."""
    return [(name, folder) for name, folder, _ in arsenal_entries(data_file)]


def manager_mods(arsenal_file=None, echelon_file=None) -> list[tuple[str, Path]]:
    """(name, folder) of each mod in the mod managers' libraries; [] when none is found."""
    return [(name, folder) for name, folder, _ in manager_entries(arsenal_file, echelon_file)]


def same_file(a: Path, b: Path, ends=1 << 16) -> bool:
    """Whether two files are the same, told quickly: the same size, start and end (patches are hundreds of MB)."""
    try:
        if a.stat().st_size != b.stat().st_size:
            return False
        with open(a, "rb") as x, open(b, "rb") as y:
            if x.read(ends) != y.read(ends):
                return False
            size = a.stat().st_size
            x.seek(max(0, size - ends))
            y.seek(max(0, size - ends))
            return x.read(ends) == y.read(ends)
    except OSError:
        return False


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


def check(ix, data: Path, arsenal_file=None, step=None, echelon_file=None) -> dict:
    """Every installed mod with sound banks, worst first: {"mods": [{"name", "source" (the folder or patch file to
    repatch), "where": "manager" or "game", "deployed", "state", "patches": [{"label", "file", "state", ...}]}],
    "quiet": how many mods hold no sound banks, "library": whether a mod manager's library was found}.
    step(doing, done, total) follows it."""
    found = []  # (name, source, where, [(label, path)])
    managed = manager_mods(arsenal_file, echelon_file)
    for name, folder in managed:
        try:
            f = scan(folder)
        except (RepatchError, OSError):
            continue
        found.append((name, folder, "manager", [(p.label, f.place(key, folder)) for p in f.patches for key in p.keys]))
    loose = deployed(data)
    by_size = {}
    for *_, patches in found:
        for _, p in patches:
            try:
                by_size.setdefault(p.stat().st_size, []).append(p)
            except OSError:
                pass
    shipped = {}  # a managed mod's patch -> the deployed file with its bytes
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
                step(tr("Checking {mod}").format(mod=name), done, total)
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
    return {"mods": mods, "quiet": quiet, "library": bool(managed)}
