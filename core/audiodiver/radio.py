"""The radio filters. Radio voices aren't filtered in their files: their lines pass through mixing buses in the Init
bank, and a FutzBox effect on those buses makes the radio sound. Turning a family's radio off bypasses the FutzBox on
its buses, for every language at once; the compressor and gain after it stay, and so does what the game's code does
with the bus.

Without the FutzBox the voices come out louder. `quieter` lowers those buses' Bus Volume, for a level near the game's
radio. It is a bus setting, so it comes after the effects.

Init reaches every sound in the game, so a build changes only these bytes of today's Init, whatever a mod's Init had
(patch.verify checks that byte for byte). Bus layout after bnnm/wwiser's for bank version 154."""
import struct
from dataclasses import dataclass

from . import music

INIT_PATH = "content/audio/Init"
BUS, SHARE_SET, CUSTOM_FX = 0x08, 0x10, 0x11
FUTZBOX = 0x006E1003      # McDSP's plugin id
BUS_VOLUME = 0x04         # in a bus's props
BYPASS, IS_SHARE_SET = 1, 2   # the bits of an effect slot
QUIETER_DB = -7.0        # by ear in game: -6 was a little loud, -9 a little quiet
# the voices with a radio, each with the buses that carry the FutzBox. A Helldiver takes three: a teammate on the
# radio, and a teammate or the player in a vehicle
FAMILIES = {"mission_control": (1149102368,), "admiral": (3416783710,), "eagle": (2421160179,), "pelican": (2211648952,),
            "helldivers": (508400881, 3231114864, 2771513447)}


@dataclass
class Plan:
    off: set         # the families (FAMILIES) with their radio off
    quieter: bool    # those buses turned down to about the radio's level

    def __bool__(self):
        return bool(self.off)

    def buses(self) -> set[int]:
        return {b for f in self.off for b in FAMILIES[f]}


def _layout(body) -> tuple[int, int]:
    """(where a bus's props start, where its effect slots start)."""
    p = 4 + (4 if struct.unpack_from("<I", body)[0] == 0 else 0)  # the parent bus; the root has its device after it
    props = p
    p += 1 + 5 * body[p]
    bits = body[p]
    p += 1
    if bits & 1 and bits & 2:  # positioning overridden, in 3D
        p += 1
        if (bits >> 5) & 3:    # with a path: 16 bytes a vertex, 20 a play-list item
            p += 5
            n = struct.unpack_from("<I", body, p)[0]
            p += 4 + 16 * n
            n = struct.unpack_from("<I", body, p)[0]
            p += 4 + 20 * n
    p += 1 + (16 if body[p] & 0b1000 else 0) + 4   # aux bits, their four ids, the reflections bus
    p += 1 + 2 + 4 + 1 + 4 + 4                     # virtual bits, max voices, channels, HDR, recovery, max duck
    n = struct.unpack_from("<I", body, p)[0]
    return props, p + 4 + 18 * n


def slots(body) -> list[tuple[int, int, int]]:
    """(where the bits are, effect id, the bits) of each effect slot of a bus."""
    at = _layout(body)[1]
    return [(at + 2 + 6 * k + 5, struct.unpack_from("<I", body, at + 2 + 6 * k + 1)[0], body[at + 2 + 6 * k + 5])
            for k in range(body[at])]


def props(body) -> dict[int, float]:
    p = _layout(body)[0]
    n = body[p]
    return dict(zip(body[p + 1:p + 1 + n], struct.unpack_from(f"<{n}f", body, p + 1 + n)))


def with_bus_volume(body, db: float) -> bytes:
    """The bus with db on its Bus Volume, in id order among its props when it had none."""
    p, values = _layout(body)[0], props(body)
    values[BUS_VOLUME] = values.get(BUS_VOLUME, 0.0) + db
    ids = sorted(values)
    bundle = bytes([len(ids), *ids]) + struct.pack(f"<{len(ids)}f", *(values[i] for i in ids))
    return bytes(body[:p]) + bundle + bytes(body[p + 1 + 5 * body[p]:])


def futzboxes(entries) -> set[tuple[int, int]]:
    """(type, id) of the effects that are FutzBoxes, of (type, id, body) objects."""
    return {(t, i) for t, i, b in entries if t in (SHARE_SET, CUSTOM_FX) and struct.unpack_from("<I", b)[0] == FUTZBOX}


def _is_futzbox(fx, bits, boxes) -> bool:
    return (SHARE_SET if bits & IS_SHARE_SET else CUSTOM_FX, fx) in boxes


def off(body, boxes, quieter: bool) -> bytes | None:
    """A bus with its FutzBox bypassed; None when it has none to bypass."""
    new, found = bytearray(body), False
    for at, fx, bits in slots(body):
        if _is_futzbox(fx, bits, boxes) and not bits & BYPASS:
            new[at] |= BYPASS
            found = True
    if not found:
        return None
    return with_bus_volume(new, QUIETER_DB) if quieter else bytes(new)


def apply_to(entries, plan: Plan) -> dict[int, bytes]:
    """{bus: its new body} of Init's objects as the plan sets them. A bus this game version doesn't have, or that has
    no FutzBox on any more, stays out."""
    boxes, wanted = futzboxes(entries), plan.buses()
    changed = {i: off(b, boxes, plan.quieter) for t, i, b in entries if t == BUS and i in wanted}
    return {i: b for i, b in changed.items() if b is not None}


def read_mod(mod: dict, game: dict) -> tuple[Plan, set[int]]:
    """What a mod's Init sets of this (mod, game: {id: (type, body)}, bank.parse): the plan, and the buses that differ
    from the game's in only that way. Anything else in a mod's Init is the game's mix of some version, so it stays out."""
    entries = [(t, i, b) for i, (t, b) in game.items()]
    boxes, plan, explained = futzboxes(entries), Plan(set(), False), set()
    for family, buses in FAMILIES.items():
        bypassed = []
        for bus in buses:
            if bus not in mod or bus not in game or mod[bus][0] != BUS or game[bus][0] != BUS:
                continue
            mine, was = mod[bus][1], game[bus][1]
            ours = [b for (_, fx, b), (_, _, g) in zip(slots(mine), slots(was)) if _is_futzbox(fx, g, boxes) and b & BYPASS and not g & BYPASS]
            if ours:
                bypassed.append(bus)
                quieter = props(mine).get(BUS_VOLUME, 0.0) < props(was).get(BUS_VOLUME, 0.0)
                plan.quieter |= quieter
                if bytes(mine) == off(was, boxes, quieter):
                    explained.add(bus)
        if bypassed:
            plan.off.add(family)
    return plan, explained


def entries_of(bank: bytes) -> list[tuple[int, int, bytes]]:
    """(type, id, body) of a bank's objects, as they are: Init uses some ids for two objects of different types."""
    from . import bank as wbank
    return list(music.iter_hirc(bytes(wbank.hirc(bank))))


def init_of(ix) -> int:
    """Init's file id."""
    return next(b for b, v in ix.banks.items() if v.get("path") == INIT_PATH)
