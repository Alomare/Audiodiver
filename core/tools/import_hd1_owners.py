"""Dev tool: which unit or level plays each Helldivers 1 event that has no name, into audiodiver/data/hd1_owners.json.

    python core/tools/import_hd1_owners.py        (needs Helldivers 1 installed; about two minutes)

Units and levels name the sound events they play by the whole murmur64 of the event's name (124 places in units and
12 in levels for the names known, build 6001293), where the master keeps only its top 32 bits. A value in a unit or
level whose top 32 bits are an unnamed event's is that event, when the same resource also plays a known event or two
unnamed ones: a chance match at that rate is about one in all the units. The resource's path comes from the strings of
the game's scripts (its unit paths, hashed); a resource whose path no script says is left out. An event several
resources play gets the one that names a character, then equipment, then the first by path.
"""
import json
import re
import struct
import sys
from pathlib import Path

CORE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(CORE))
from audiodiver import hd1  # noqa: E402
from audiodiver.game import murmur64_hash  # noqa: E402

TYPES = {murmur64_hash(t.encode()) for t in ("unit", "level")}
LUA = murmur64_hash(b"lua")
OUT = CORE / "audiodiver" / "data" / "hd1_owners.json"
RANK = ("characters/", "equipment/")


def main():
    contents = hd1.locate()[0]
    if not contents:
        sys.exit("Helldivers 1 isn't installed")
    game = hd1.Hd1.read(contents)
    names = hd1._names()
    known = {murmur64_hash(n.encode()) for n in names.values()}
    unnamed = {e for e in game.events if e not in names}
    paths, found, seen = {}, {}, set()
    for p in hd1._bundles(contents):
        with hd1.Bundle(p) as b:
            for kind, name, lang, at, size, *_ in hd1._resources(b):
                if (kind, name) in seen or not size or (kind not in TYPES and kind != LUA):
                    continue
                seen.add((kind, name))
                d = b.read(at, size)
                if kind == LUA:
                    for s in re.findall(rb"[a-z0-9_]+(?:/[a-z0-9_]+)+", d):
                        paths[murmur64_hash(s)] = s.decode()
                    continue
                hits, plays_known = set(), False
                for off in range(0, len(d) - 7, 4):
                    v = struct.unpack_from("<Q", d, off)[0]
                    if v in known:
                        plays_known = True
                    elif v >> 32 in unnamed:
                        hits.add(v >> 32)
                if hits and (plays_known or len(hits) >= 2):
                    found[name] = hits
    owners = {}
    for res, events in found.items():
        if res not in paths:
            continue
        for e in events:
            owners.setdefault(e, []).append(paths[res])
    pick = {f"{e:08x}": min(ps, key=lambda p: (next((i for i, r in enumerate(RANK) if p.startswith(r)), len(RANK)), p))
            for e, ps in sorted(owners.items())}
    OUT.write_text(json.dumps(pick, indent=1, sort_keys=True) + "\n", encoding="utf-8")
    print(f"{len(pick)} of {len(unnamed)} unnamed events have an owner -> {OUT}")


if __name__ == "__main__":
    main()
