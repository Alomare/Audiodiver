"""The game's silent music on seven planet biomes, fixed in the music_init bank a build ships.

The mission music's biome tracks and switches know 9 values of the planet biome; the game has 7 more (swamp,
deciduous, coniferous, desert, oasis, bug_hiveworld, rift_active), and Wwise plays nothing for a value a track
doesn't list: on those planets the music stays silent until its intensity changes. Sound Systems Rebalanced
(CowboyBingus, 0BSD, vendored in _vendor/ssr) fixes it in music_init alone: each missing biome plays the track's
default (None) clip, each biome switch gets a wildcard branch to its None branch, and the 24 tracks and 3 switches
only the mission banks define get fixed copies in music_init (it loads at boot, and Wwise keeps the first copy).

Nearly every music build ships music_init (it plays audio of most music), and a later mod's copy replaces an
earlier one's whole: with a project's biome_fix on (off by default), a build's music_init starts from the fixed one,
so the fix stays whichever of the two loads, and the build's own changes (timing, sizes, gain) reach the copies and
the new clips like every other copy.

Made for the banks of Steam build 25480438; where a game version's banks no longer have the layout the patch
expects (or the game fixed it), builds go on without it.
"""
import struct

from ._vendor.ssr import biome_patch as ssr
from .game import murmur64_hash

INIT = murmur64_hash(ssr.INIT.encode())
MISSION = tuple(murmur64_hash(n.encode()) for n in ssr.MISSION)


def _resource(bnk: bytes) -> bytes:
    """A bank as the vendored patch reads it: the 16-byte Stingray header (only its size field is read), then the bnk."""
    return bytes(4) + struct.pack("<I", len(bnk)) + bytes(8) + bnk


def fixed_init(ix) -> bytes | None:
    """music_init with the fix (no Stingray header, as AudioIndex.bank_files gives banks), or None where it doesn't
    apply to this game version. Worked out once per index."""
    if not hasattr(ix, "_biome_init"):
        try:
            banks = {name: _resource(ix.bank_files(bid)[0])
                     for name, bid in zip((ssr.INIT, *ssr.MISSION), (INIT, *MISSION))}
            ix._biome_init = ssr.patch_bank(banks)[0]
        except (KeyError, ValueError, IndexError, struct.error):
            ix._biome_init = None
    return ix._biome_init


def copied(ix) -> set[int]:
    """The ids of the objects the fix copies into music_init (in it, they mark a music_init that carries the fix)."""
    if not hasattr(ix, "_biome_copied"):
        from . import bank as wbank
        fixed = fixed_init(ix)
        ids = set(wbank.parse(fixed)[1]) - set(wbank.parse(ix.bank_files(INIT)[0])[1]) if fixed else set()
        ix._biome_copied = ids
    return ix._biome_copied


def base(ix, bid: int) -> bytes:
    """What a build changes for a bank: the game's, or for music_init the fixed one (where the fix applies)."""
    return (bid == INIT and fixed_init(ix)) or ix.bank_files(bid)[0]


def base_for(ix, bid: int, objects) -> bytes:
    """What a patch's copy of a bank is compared with: the fixed music_init where the copy carries the fix (an
    Audiodiver build's, or Sound Systems Rebalanced's own), else the game's."""
    fix = bid == INIT and copied(ix)
    return fixed_init(ix) if fix and fix <= set(objects) else ix.bank_files(bid)[0]
