"""Wwise bank (v154) chunks: DIDX/DATA media and HIRC objects."""
import struct
import zlib

from . import music

SOUND, MUSIC_SEGMENT, MUSIC_TRACK = 0x02, 0x0A, 0x0B
TYPE_NAMES = {0x02: "Sound", 0x04: "Event", 0x0A: "MusicSegment", 0x0B: "MusicTrack", 0x0C: "MusicSwitch",
              0x0D: "MusicPlaylist"}
SOURCE = struct.Struct("<IBIIIB")  # plugin, stream type (0 bank, 1 prefetch, 2 streamed), source id, cache id, mem size, bits


def chunks(bank: bytes):
    """[[tag, payload]] in file order."""
    out, pos = [], 0
    while pos + 8 <= len(bank):
        tag, size = bank[pos:pos + 4], struct.unpack_from("<I", bank, pos + 4)[0]
        out.append([tag, bank[pos + 8:pos + 8 + size]])
        pos += 8 + size
    assert pos == len(bank), "trailing bytes after the last chunk"
    return out


def source_offsets(type_, body) -> list[int]:
    """Offsets of the 18-byte sources in a Sound or MusicTrack body (after the id)."""
    if type_ == SOUND:
        return [0]
    if type_ == MUSIC_TRACK:
        return [4 + 18 * i for i in range(struct.unpack_from("<I", body)[0])]
    return []


def source_ids(type_, body) -> list[int]:
    return [struct.unpack_from("<I", body, o + 5)[0] for o in source_offsets(type_, body)]


def parse(bank: bytes):
    """({media id: bytes}, {hirc id: (type, body)})."""
    didx, data, hirc = [], b"", {}
    for tag, body in chunks(bank):
        if tag == b"DIDX":
            didx = [struct.unpack_from("<III", body, i) for i in range(0, len(body), 12)]
        elif tag == b"DATA":
            data = body
        elif tag == b"HIRC":
            hirc = {id: (t, b) for t, id, b in music.iter_hirc(body)}
    return {id: data[off:off + n] for id, off, n in didx}, hirc


def fingerprint(t: int, body: bytes) -> int:
    """A HIRC object's content as one number (CRC-32 of its type and body): what tells an object a game version
    changed from the same object as it was (tools/import_bank_history.py, addition.from_patch)."""
    return zlib.crc32(bytes([t]) + body)


def audio_summary(bank: bytes):
    """(DIDX media ids, source ids played by its Sounds and MusicTracks, number of music segments, the ids of all its
    HIRC objects, their fingerprints in the same order)."""
    media, refs, segments, objects = [], set(), 0, {}
    for tag, body in chunks(bank):
        if tag == b"DIDX":
            media = [struct.unpack_from("<I", body, i)[0] for i in range(0, len(body), 12)]
        elif tag == b"HIRC":
            for t, id, b in music.iter_hirc(body):
                refs.update(source_ids(t, b))
                segments += t == MUSIC_SEGMENT
                objects[id] = fingerprint(t, b)
    ids = sorted(objects)
    return media, sorted(refs), segments, ids, [objects[i] for i in ids]


def hirc(bank: bytes) -> bytes:
    return next((body for tag, body in chunks(bank) if tag == b"HIRC"), b"\0\0\0\0")


# --- a node's settings: the prop bundle in its NodeBaseParams (count u8, ids u8[n], values f32[n]). Its Sounds,
# MusicTracks, random/sequence, switch and layer containers and actor-mixers have one where these find it.
SETTABLE = (SOUND, 0x05, 0x06, 0x07, 0x09, MUSIC_TRACK)
# the settings a mod sets on how a sound plays: Volume, Pitch, the low- and high-pass filters, Make-Up Gain, Initial
# Delay. The rest of a bundle (Priority, sends, HDR...) is the game's mix: updates change it on objects many banks
# share, and on those the mods looked at (148 patches) differ there only as an older game version had it
MIX_PROPS = (0x00, 0x01, 0x02, 0x03, 0x05, 0x22)


def sound_base(body) -> int:
    """Where a Sound's NodeBaseParams start: after its 18-byte source, and for a source plugin (a tone, silence) after
    the plugin's parameters (their size, u32, then the parameters)."""
    if struct.unpack_from("<I", body)[0] & 0xF == 2:
        return 22 + struct.unpack_from("<I", body, 18)[0]
    return 18


def base_at(t, body) -> int:
    """Offset of NodeBaseParams in a node's body (after the id)."""
    if t == SOUND:
        return sound_base(body)
    if t != MUSIC_TRACK:
        return 0
    p = 4 + 18 * struct.unpack_from("<I", body)[0] + 1  # sources, flags
    items = struct.unpack_from("<I", body, p)[0]
    p += 4 + 48 * items + (4 if items else 0)  # playlist items, sub-track count
    clips = struct.unpack_from("<I", body, p)[0]
    p += 4
    for _ in range(clips):  # clip automation: index, type, point count, points
        p += 12 + 12 * struct.unpack_from("<I", body, p + 8)[0]
    return p


def props_at(t, body) -> int:
    p = base_at(t, body) + 1               # fx override flag
    n, p = body[p], p + 1
    p += 1 + 6 * n if n else 0             # bypass bits + effects
    p += 1                                  # metadata fx override flag
    n, p = body[p], p + 1
    return p + 6 * n + 9                    # metadata effects; bus, parent, bits


def props(t, body) -> dict[int, float]:
    """{prop id: value} of a node's settings (bank v154 numbering: patch.py names the ones Audiodiver sets)."""
    p = props_at(t, body)
    n = body[p]
    return dict(zip(body[p + 1:p + 1 + n], struct.unpack_from(f"<{n}f", body, p + 1 + n)))


def with_props(t, body, changes: dict) -> bytearray:
    """The node with its settings changed: {prop id: value, or None to take it away}. Values change in place; a
    new one goes in id order."""
    p = props_at(t, body)
    n = body[p]
    ids = list(body[p + 1:p + 1 + n])
    values = list(struct.unpack_from(f"<{n}f", body, p + 1 + n))
    for pid, value in changes.items():
        if pid in ids:
            if value is None:
                del values[ids.index(pid)]
                ids.remove(pid)
            else:
                values[ids.index(pid)] = value
        elif value is not None:
            i = sum(x < pid for x in ids)
            ids.insert(i, pid)
            values.insert(i, value)
    bundle = bytes([len(ids), *ids]) + struct.pack(f"<{len(values)}f", *values)
    return bytearray(body[:p] + bundle + body[p + 1 + 5 * n:])


def prop_changes(t, game, mod) -> dict:
    """What the mod's copy of a node sets differently from the game's: {prop id: value, or None when it takes one
    away}."""
    a, b = props(t, game), props(t, mod)
    return {**{k: v for k, v in b.items() if a.get(k) != v}, **{k: None for k in a if k not in b}}
