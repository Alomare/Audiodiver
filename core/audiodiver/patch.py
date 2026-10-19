"""Audiodiver's surgical patch writer: copies each vanilla bank and changes only the replaced audio, the size fields that
describe it, and (optionally) the timing of the music segments/tracks that play it.

Unlike hd2-audio-modder it never merges same-id objects across banks, so everything not being replaced stays
byte-identical to the current game.
"""
import os
import struct
from dataclasses import dataclass, field

from . import music
from . import bank as wbank
from .bank import SOUND, MUSIC_SEGMENT, MUSIC_TRACK, TYPE_NAMES
from .game import WWISE_STREAM, WWISE_BANK, WWISE_DEP, toc_entries
from .index import AudioIndex
from .strings import STRINGS

BANK, PREFETCH = 0, 1  # source stream types (2 = streamed only, no media in the bank)
# prop ids (bank v154; older Wwise numbers them differently). Make-Up Gain is applied after the game's HDR mix, so it
# makes a sound louder or quieter without changing how much it ducks others; the logical Volume is what HDR reads.
VOLUME = 0x00
MAKEUP_GAIN = 0x05     # as hd2-audio-modder writes it
# the logical Volume a silenced Sound gets: far below anything the HDR mix counts, so the silence stops ducking the
# sounds under it (a silent clip at its normal Volume still ducks them), yet above the volume threshold the game sets
# (-96 dB, in its Init bank), so the voice still plays out its time and a sequence it is part of keeps its timing
MUTE_DB = -60.0
HEADER_TAIL = bytes.fromhex("ce09f5f4000000000c729f9e8872b8bd00a06b0200000000007951") + bytes(29)  # as written by the old tool
BANK_TAG = bytes.fromhex("D82F7678")


@dataclass
class Replacement:
    source: int          # Wwise source (short) id
    wem: bytes
    fit_timing: bool = True
    makeup_db: float = 0.0  # Make-Up Gain on the Sounds/MusicTracks that play it (what hd2-audio-modder's dB box sets)
    mute: bool = False      # a silence that also leaves the mix: the Sounds that play it get the Volume MUTE_DB

    @property
    def length_ms(self):
        rate, samples = struct.unpack_from("<I", self.wem, 24)[0], struct.unpack_from("<I", self.wem, 44)[0]
        return samples * 1000 / rate


@dataclass
class BankEdit:
    media: list = field(default_factory=list)     # source ids whose media changed
    tracks: list = field(default_factory=list)    # MusicTrack ids retimed
    segments: list = field(default_factory=list)  # MusicSegment ids retimed / overridden
    sounds: list = field(default_factory=list)    # Sound ids whose in-memory size changed
    gains: list = field(default_factory=list)     # Sound/MusicTrack ids given a Make-Up Gain
    mutes: list = field(default_factory=list)     # Sound ids taken out of the mix (Volume MUTE_DB)


def _align(n, a):
    return (n + a - 1) // a * a


def _base_params_offset(t, body):
    """Offset of NodeBaseParams in a Sound or MusicTrack body (after the id)."""
    if t == SOUND:
        return 18
    p = 4 + 18 * struct.unpack_from("<I", body)[0] + 1  # sources, flags
    items = struct.unpack_from("<I", body, p)[0]
    p += 4 + 48 * items + (4 if items else 0)  # playlist items, sub-track count
    clips = struct.unpack_from("<I", body, p)[0]
    p += 4
    for _ in range(clips):  # clip automation: index, type, point count, points
        p += 12 + 12 * struct.unpack_from("<I", body, p + 8)[0]
    return p


def set_prop(t, body: bytearray, prop_id: int, value: float) -> bytearray:
    """Sets one float property in the node's prop bundle (count u8, ids u8[n], values f32[n]), adding it if absent."""
    p = _base_params_offset(t, body) + 1  # fx override flag
    n, p = body[p], p + 1
    p += 1 + 6 * n if n else 0             # bypass bits + effects
    p += 1                                  # metadata fx override flag
    n, p = body[p], p + 1
    p += 6 * n + 9                          # metadata effects; bus, parent, bits
    n, ids = body[p], list(body[p + 1:p + 1 + body[p]])
    values = list(struct.unpack_from(f"<{n}f", body, p + 1 + n))
    if prop_id in ids:
        values[ids.index(prop_id)] = value
    else:
        i = sum(x < prop_id for x in ids)
        ids.insert(i, prop_id)
        values.insert(i, value)
    bundle = bytes([len(ids), *ids]) + struct.pack(f"<{len(values)}f", *values)
    return body[:p] + bundle + body[p + 1 + 5 * n:]


def patch_bank(bank: bytes, reps: dict[int, Replacement], overrides: dict[int, dict]):
    """Returns (new bank bytes, BankEdit). The bank is returned unchanged when nothing in it is replaced."""
    chunks = wbank.chunks(bank)
    get = lambda t: next((c for c in chunks if c[0] == t), None)
    edit = BankEdit()

    # 1. HIRC: source sizes, track timing, then segment timing
    hirc = get(b"HIRC")
    entries = [[t, id, bytearray(b)] for t, id, b in music.iter_hirc(hirc[1])] if hirc else []
    mem_sizes = {}   # source id -> media size this bank must hold
    retimed = {}     # track id -> new length
    for t, id, body in entries:
        if t == SOUND:
            offs = [0]
        elif t == MUSIC_TRACK:
            offs = [4 + 18 * i for i in range(struct.unpack_from("<I", body)[0])]
        else:
            continue
        for o in offs:
            _plugin, stype, sid, _cache, mem = struct.unpack_from("<IBIII", body, o)
            r = reps.get(sid)
            if r is None:
                continue
            if stype == BANK or (stype == PREFETCH and len(r.wem) < mem):
                mem = len(r.wem)
            if stype in (BANK, PREFETCH):
                mem_sizes[sid] = mem
                if struct.unpack_from("<I", body, o + 13)[0] != mem:
                    struct.pack_into("<I", body, o + 13, mem)
                    (edit.sounds if t == SOUND else edit.tracks).append(id)
            if t == MUSIC_TRACK and r.fit_timing:
                p = offs[-1] + 18 + 1  # skip the flags byte after the sources
                for i in range(struct.unpack_from("<I", body, p)[0]):
                    item = p + 4 + 48 * i
                    if struct.unpack_from("<I", body, item + 4)[0] == sid:
                        struct.pack_into("<dddd", body, item + 16, 0.0, 0.0, 0.0, r.length_ms)
                        retimed[id] = max(retimed.get(id, 0), r.length_ms)
                        if id not in edit.tracks:
                            edit.tracks.append(id)
    for e in entries:
        t, id, body = e
        if t in (SOUND, MUSIC_TRACK):
            offs = [0] if t == SOUND else [4 + 18 * i for i in range(struct.unpack_from("<I", body)[0])]
            gains = [reps[s].makeup_db for s in (struct.unpack_from("<I", body, o + 5)[0] for o in offs)
                     if s in reps and reps[s].makeup_db]
            if gains:
                e[2] = set_prop(t, body, MAKEUP_GAIN, max(gains))
                edit.gains.append(id)
            # a silenced Sound leaves the mix; a MusicTrack keeps its Volume (music silence keeps or skips its time)
            if t == SOUND and (r := reps.get(struct.unpack_from("<I", body, 5)[0])) is not None and r.mute:
                e[2] = set_prop(t, e[2], VOLUME, MUTE_DB)
                edit.mutes.append(id)
    for e in entries:
        t, id, body = e
        if t != MUSIC_SEGMENT:
            continue
        seg = music.MusicSegment.read(id, music.Reader(bytes(body)))
        lengths = [retimed[c] for c in seg.node.children if c in retimed]
        if not lengths and id not in overrides:
            continue
        if lengths:
            seg.duration_ms = max(lengths)
            seg.markers = [(m, 0.0 if m == music.ENTRY_CUE else seg.duration_ms if m == music.EXIT_CUE else p, n)
                           for m, p, n in seg.markers]
        for key, value in overrides.get(id, {}).items():
            cue = {"entry_marker": music.ENTRY_CUE, "exit_marker": music.EXIT_CUE}[key]
            seg.markers = [(m, value if m == cue else p, n) for m, p, n in seg.markers]
        e[2] = bytearray(seg.to_bytes())
        edit.segments.append(id)

    # 2. DIDX/DATA: swap media, keep the vanilla order and alignment
    didx, data = get(b"DIDX"), get(b"DATA")
    if didx:
        rows = [struct.unpack_from("<III", didx[1], i) for i in range(0, len(didx[1]), 12)]
        align = 16 if all(off % 16 == 0 for _, off, _ in rows) else 1
        new_rows, blobs, off = [], [], 0
        for sid, o, n in rows:
            blob = data[1][o:o + n]
            if sid in reps and sid in mem_sizes:
                blob = reps[sid].wem[:mem_sizes[sid]]
                edit.media.append(sid)
            off = _align(off, align)
            blobs.append((off, blob))
            new_rows.append(struct.pack("<III", sid, off, len(blob)))
            off += len(blob)
        if edit.media:
            buf = bytearray(off)
            for o, blob in blobs:
                buf[o:o + len(blob)] = blob
            didx[1], data[1] = b"".join(new_rows), bytes(buf)

    if not (edit.media or edit.tracks or edit.segments or edit.sounds or edit.gains or edit.mutes):
        return bank, edit
    if hirc:
        hirc[1] = struct.pack("<I", len(entries)) + b"".join(
            struct.pack("<BII", t, 4 + len(b), id) + bytes(b) for t, id, b in entries)
    return b"".join(t + struct.pack("<I", len(b)) + b for t, b in chunks), edit


def write_patch(path, streams: dict[int, bytes], banks: dict[int, bytes], deps: dict[int, bytes],
                strings: dict[int, bytes] | None = None):
    """Writes path (+ .stream): wwise streams, banks (raw bank bytes), their deps (raw toc data) and string tables
    (raw table bytes, strings.py)."""
    strings = strings or {}
    groups = [(WWISE_STREAM, sorted(streams)), (WWISE_BANK, sorted(banks)), (WWISE_DEP, sorted(deps)),
              (STRINGS, sorted(strings))]
    groups = [g for g in groups if g[1]]
    nfiles = sum(len(ids) for _, ids in groups)
    out = bytearray(struct.pack("<IIII", 0xF0000011, len(groups), nfiles, 0) + HEADER_TAIL)
    for tid, ids in groups:
        out += struct.pack("<QQQII", 0, tid, len(ids), 16, 64)
    toc_off = len(out) + 80 * nfiles + 8
    entries, toc_data, stream_data, idx = [], [], bytearray(), 0
    for tid, ids in groups:
        for fid in ids:
            s_off, s_size = len(stream_data), 0
            if tid == WWISE_STREAM:
                d = streams[fid]
                blob, size, s_size = BANK_TAG + bytes(4) + struct.pack("<Q", len(d)), 0x0C, len(d)
                stream_data += d + bytes(_align(len(d), 16) - len(d))
            elif tid == WWISE_BANK:
                b = banks[fid]
                blob = BANK_TAG + struct.pack("<IQ", len(b), fid) + b
                size = len(blob)
            else:
                blob = deps[fid] if tid == WWISE_DEP else strings[fid]
                size = len(blob)
            blob += bytes(_align(len(blob), 16) - len(blob))
            entries.append(struct.pack("<QQQQQQQIIIIII", fid, tid, toc_off, s_off, 0, 0, 0, size, s_size, 0, 16, 64, idx))
            toc_data.append(blob)
            toc_off += len(blob)
            idx += 1
    out += b"".join(entries) + bytes(8) + b"".join(toc_data)
    out += bytes(max(0, nfiles * 256 - len(out)))
    open(path, "wb").write(out)
    if stream_data:
        open(path + ".stream", "wb").write(stream_data)
    elif os.path.exists(path + ".stream"):
        os.remove(path + ".stream")


def build_patch(path, reps: list[Replacement], ix: AudioIndex, overrides=None, strings=None):
    """Patches every bank that holds or plays a replaced source, and adds string tables ({file id: table bytes});
    returns {bank id: BankEdit}."""
    overrides = overrides or {}
    by_source = {r.source: r for r in reps}
    banks = set()
    for r in reps:
        banks |= ix.banks_for(r.source)
    new_banks, deps, edits = {}, {}, {}
    for bid in sorted(banks):
        raw, dep = ix.bank_files(bid)
        new, edit = patch_bank(raw, by_source, overrides)
        if new is not raw:
            new_banks[bid], edits[bid] = new, edit
            if dep:
                deps[bid] = dep
    # a sound's stream goes by the index: a voice line's is filed under its language, and a stream no bank plays
    # is its own target
    streams = {ix.stream_file(r.source): r.wem for r in reps if ix.stream_file(r.source) is not None}
    write_patch(path, streams, new_banks, deps, strings)
    return edits


def read_patch(path):
    """({bank id: ({media id: bytes}, {hirc id: (type, body)})}, {stream file id: bytes}) of a written patch."""
    data = open(path, "rb").read()
    stream = open(path + ".stream", "rb").read() if os.path.exists(path + ".stream") else b""
    banks, streams = {}, {}
    for fid, tid, off, size, s_off, s_size in toc_entries(data):
        if tid == WWISE_BANK:
            banks[fid] = wbank.parse(data[off + 16:off + size])
        elif tid == WWISE_STREAM:
            streams[fid] = stream[s_off:s_off + s_size]
    return banks, streams


def diff(path, ix: AudioIndex):
    """What a patch changes against the current game: streams, and per bank the media and HIRC objects."""
    banks, streams = read_patch(path)
    out = {"streams": streams, "banks": {}}
    for bid, (media, hirc) in banks.items():
        v_media, v_hirc = wbank.parse(ix.bank_files(bid)[0])
        out["banks"][bid] = {
            "media": sorted(m for m in media if v_media.get(m) != media[m]),
            "objects": sorted((TYPE_NAMES.get(t, hex(t)), id) for id, (t, b) in hirc.items() if v_hirc.get(id) != (t, b)),
            "added": sorted(set(hirc) - set(v_hirc)), "removed": sorted(set(v_hirc) - set(hirc)),
        }
    return out


def verify_strings(path, tables: dict[int, bytes]) -> list[str]:
    """Problems with the string tables of a written patch: each must be there, read back as a table, and hold
    exactly what was meant (tables: {file id: the bytes meant}). Empty list = good."""
    from . import strings
    data, problems = open(path, "rb").read(), []
    found = {fid: data[off:off + size] for fid, tid, off, size, *_ in toc_entries(data) if tid == STRINGS}
    for fid, want in tables.items():
        try:
            ok = fid in found and strings.parse(found[fid]).texts == strings.parse(want).texts
        except (ValueError, struct.error, UnicodeDecodeError):
            ok = False
        if not ok:
            problems.append(f"string table {fid} is not as meant")
    if set(found) - set(tables):
        problems.append(f"unexpected string tables {sorted(set(found) - set(tables))}")
    return problems


def verify(path, reps: list[Replacement], ix: AudioIndex) -> list[str]:
    """Problems with a written patch: it must change only the replaced audio, its size fields, the timing of the
    segments/tracks that play it, their gain and (silence) their Volume. Empty list = good."""
    d, by_source, problems = diff(path, ix), {r.source: r for r in reps}, []
    for fid, data in d["streams"].items():
        sid = ix.resolve(fid)
        if sid not in by_source:
            problems.append(f"unexpected stream {fid}")
        elif data != by_source[sid].wem:
            problems.append(f"stream {fid} is not the encoded clip")
    for sid in by_source:
        missing = [b for b in ix.holders.get(sid, ()) if b not in d["banks"] or sid not in d["banks"][b]["media"]]
        if missing:
            problems.append(f"source {sid}: banks still holding the original audio {missing}")
    other = {t for b in d["banks"].values() for t, _ in b["objects"]} - {"MusicSegment", "MusicTrack", "Sound"}
    stray = [m for b in d["banks"].values() for m in b["media"] if m not in by_source]
    if other or stray or any(b["added"] or b["removed"] for b in d["banks"].values()):
        problems.append(f"bank changes beyond the replacements: object types {other}, media {stray[:5]}")
    return problems
