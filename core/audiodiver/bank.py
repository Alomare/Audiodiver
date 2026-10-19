"""Wwise bank (v154) chunks: DIDX/DATA media and HIRC objects."""
import struct

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


def audio_summary(bank: bytes):
    """(DIDX media ids, source ids played by its Sounds and MusicTracks, number of music segments)."""
    media, refs, segments = [], set(), 0
    for tag, body in chunks(bank):
        if tag == b"DIDX":
            media = [struct.unpack_from("<I", body, i)[0] for i in range(0, len(body), 12)]
        elif tag == b"HIRC":
            for t, _id, b in music.iter_hirc(body):
                refs.update(source_ids(t, b))
                segments += t == MUSIC_SEGMENT
    return media, sorted(refs), segments


def hirc(bank: bytes) -> bytes:
    return next((body for tag, body in chunks(bank) if tag == b"HIRC"), b"\0\0\0\0")
