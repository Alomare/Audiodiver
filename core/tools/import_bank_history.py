"""Dev tool: remembers how the game's banks changed across versions, for reading mods made for an older one.

    python core/tools/import_bank_history.py <old audio_index.json> <its Steam build id> [--again]

A mod's patch holds whole copies of the banks it changes, as they were in the game version it was made for. Against a
newer game, the objects that version had and this one doesn't look like audio the mod added, and the objects the game
added since look like objects the mod took out. addition.from_patch tells them apart by this list.

After a game update, copy %LOCALAPPDATA%\\Audiodiver\\audio_index.json aside before the core rebuilds it (the first
start of the app or `python -m audiodiver index` does), then run this with that copy and the build it was made on.
Each update adds to the list: an id stays "gone" until the game has it again, and "new" until the game drops it.

It writes audiodiver/data/bank_history.json: per bank file id, "gone" (object ids earlier versions had and this one
doesn't), "new" (object ids this one has and the earliest version listed didn't) and "changed" (an object both have
whose content differs: the fingerprints of what it was, bank.fingerprint; from indexes that have them, FORMAT 6 on).
"""
import json
import sys
from pathlib import Path

from audiodiver.index import AudioIndex

OUT = Path(__file__).parent.parent / "audiodiver" / "data" / "bank_history.json"


def main():
    if len(sys.argv) not in (3, 4):
        sys.exit(__doc__)
    old_banks = json.loads(Path(sys.argv[1]).read_text())["banks"]
    old = {int(k): set(v.get("objects") or ()) for k, v in old_banks.items()}
    old_prints = {int(k): dict(zip(v["objects"], v["prints"])) for k, v in old_banks.items() if "prints" in v}
    if not old_prints:
        print("that index has no fingerprints (made before FORMAT 6): no changed objects recorded from it")
    ix = AudioIndex()
    now = {bid: set(b.get("objects") or ()) for bid, b in ix.banks.items()}
    now_prints = {bid: dict(zip(b["objects"], b["prints"])) for bid, b in ix.banks.items()}
    have = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {"builds": [], "banks": {}}
    if sys.argv[2] in have["builds"] and "--again" not in sys.argv:
        sys.exit(f"build {sys.argv[2]} is listed already (--again adds what this index knows that the list doesn't)")
    banks = {}
    for bid in sorted(set(old) | set(now) | {int(k) for k in have["banks"]}):
        was = have["banks"].get(str(bid), {})
        cur = now.get(bid, set())
        gone = (set(was.get("gone", ())) | (old.get(bid, set()) - cur)) - cur
        new = (set(was.get("new", ())) | (cur - old.get(bid, cur))) & cur  # a bank new in this version: nothing to compare
        was_prints, here = old_prints.get(bid, {}), now_prints.get(bid, {})
        changed = {}
        for i in cur:
            prints = set(was.get("changed", {}).get(str(i), ()))
            if i in was_prints:
                prints.add(was_prints[i])
            prints.discard(here.get(i))
            if prints:
                changed[str(i)] = sorted(prints)
        if gone or new or changed:
            banks[str(bid)] = {"gone": sorted(gone), "new": sorted(new), "changed": changed}
    builds = list(dict.fromkeys(have["builds"] + [sys.argv[2]]))
    lines = ["{", ' "about": ' + json.dumps(
        "How the game's banks changed since the builds listed (tools/import_bank_history.py), so that a mod made for "
        "one of them reads right on the current game (addition.from_patch): per bank file id, 'gone' are object ids "
        "those versions had and this one doesn't, 'new' object ids this one has and they didn't, 'changed' the "
        "fingerprints (bank.fingerprint) an object had in them where this one has it otherwise.") + ",",
             ' "builds": ' + json.dumps(builds) + ",", ' "banks": {']
    lines += [f'  "{k}": {json.dumps(v, separators=(",", ":"))}{"," if n + 1 < len(banks) else ""}'
              for n, (k, v) in enumerate(banks.items())]
    lines += [" }", "}"]
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
    print(f"{len(banks)} banks changed since build {', '.join(builds)}: "
          f"{sum(len(v['gone']) for v in banks.values())} ids gone, {sum(len(v['new']) for v in banks.values())} new, "
          f"{sum(len(v['changed']) for v in banks.values())} changed "
          f"-> {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
