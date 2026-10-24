"""Audiodiver's surgical patch writer: copies each vanilla bank and changes only the replaced audio, the size fields that
describe it, and (optionally) the timing of the music segments/tracks that play it.

Unlike hd2-audio-modder it never merges same-id objects across banks, so everything not being replaced stays
byte-identical to the current game. Audio a project adds (new takes, layers, clips of their own: addition.py) goes in
first, and its new clips are then replaced like the game's: their sizes, gain and silence are set here too.
"""
import os
import struct
from dataclasses import dataclass, field

from . import addition, music, soundtrack
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
MOVE_PIECE = 16 << 20  # bytes moved at a time when a patch's table of contents comes out smaller than laid out
AUDIO_TYPES = (WWISE_STREAM, WWISE_BANK, WWISE_DEP)
CARRIED_ALIGN = 64  # where a carried file's .stream and .gpu_resources data start (the GPU data of the game's and
#                     the modding tools' patches is at multiples of 64)


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
    added: list = field(default_factory=list)     # ids of the objects added (addition.py)
    settings: list = field(default_factory=list)  # ids of the objects given the project's settings
    music: list = field(default_factory=list)     # ids of the playlists and switches the Soundtrack changed


@dataclass
class Carried:
    """A file of another kind in a mod's patch (a string table, a texture, a model...), carried into a new patch as it
    was: its toc data, its data in the .stream and .gpu_resources files, and the entry's fields no one has named."""
    fid: int
    tid: int
    data: bytes
    stream: bytes = b""
    gpu: bytes = b""
    unknown: tuple = (0, 0, 16, 64)  # the entry's unknown1, unknown2, unknown3 and unknown4


def carried_of(path, skip=AUDIO_TYPES) -> list[Carried]:
    """The files of a patch on disk whose type isn't in skip, read whole from it and the .stream and .gpu_resources
    files next to it. A patch whose files are cut short or missing raises ValueError."""
    with open(path, "rb") as f:
        head = f.read(72)
        nt, nf = struct.unpack_from("<II", head, 4)
        rows = f.read(32 * nt + 80 * nf)
        toc_entries(head + rows)  # the magic and the counts
        entries = [e for e in (struct.unpack_from("<QQQQQQQIIIIII", rows, 32 * nt + 80 * i) for i in range(nf))
                   if e[1] not in skip]
        out = []
        for fid, tid, toc, _, _, u1, u2, size, *_, u3, u4, _ in entries:
            f.seek(toc)
            out.append(Carried(fid, tid, f.read(size), unknown=(u1, u2, u3, u4)))
            if len(out[-1].data) != size:
                raise ValueError(f"{os.path.basename(path)} is cut short")
    for suffix, at, size, attr in ((".stream", 3, 8, "stream"), (".gpu_resources", 4, 9, "gpu")):
        wanted = [(c, e[at], e[size]) for c, e in zip(out, entries) if e[size]]
        if not wanted:
            continue
        if not os.path.isfile(path + suffix):
            raise ValueError(f"{os.path.basename(path)}{suffix} is missing")
        with open(path + suffix, "rb") as f:
            for c, off, n in wanted:
                f.seek(off)
                setattr(c, attr, f.read(n))
                if len(getattr(c, attr)) != n:
                    raise ValueError(f"{os.path.basename(path)}{suffix} is cut short")
    return out


def _write_at(path, pieces: list[tuple[int, bytes]]):
    """Writes path with each piece's bytes at its offset (rising), zeros between, and the end at a multiple of 16; or
    removes path when no piece has bytes."""
    if not any(data for _, data in pieces):
        if os.path.exists(path):
            os.remove(path)
        return
    with open(path, "wb") as f:
        for off, data in pieces:
            f.write(bytes(off - f.tell()))
            f.write(data)
        f.write(_pad(f.tell()))


class CueError(ValueError):
    """A segment whose Entry cue point would come at or after its Exit."""
    def __init__(self, segment: int, entry_ms: float, exit_ms: float):
        super().__init__(f"segment {segment}: Entry at {entry_ms:.0f} ms, Exit at {exit_ms:.0f} ms")
        self.segment, self.entry_ms, self.exit_ms = segment, entry_ms, exit_ms


def _align(n, a):
    return (n + a - 1) // a * a


def set_prop(t, body: bytearray, prop_id: int, value: float) -> bytearray:
    """Sets one float property in the node's prop bundle, adding it if absent."""
    return wbank.with_props(t, body, {prop_id: value})


def apply_settings(bank: bytes, settings: dict[int, dict]) -> tuple[bytes, list[int]]:
    """The bank with the settings ({object id: {prop id: value or None}}, Project.settings) on the objects it has;
    and their ids. The bank comes back as it was when it has none of them."""
    chunks = wbank.chunks(memoryview(bank))  # views: the media is copied once, into the new bank
    hirc = next((c for c in chunks if c[0] == b"HIRC"), None)
    if hirc is None:
        return bank, []
    entries, done = [], []
    for t, id, body in music.iter_hirc(bytes(hirc[1])):
        if id in settings and t in wbank.SETTABLE:
            body = wbank.with_props(t, body, settings[id])
            done.append(id)
        entries.append((t, id, body))
    if not done:
        return bank, []
    hirc[1] = struct.pack("<I", len(entries)) + b"".join(struct.pack("<BII", t, 4 + len(b), id) + bytes(b)
                                                         for t, id, b in entries)
    return b"".join(x for t, b in chunks for x in (t, struct.pack("<I", len(b)), b)), done


def patch_bank(bank: bytes, reps: dict[int, Replacement], overrides: dict[int, dict]):
    """Returns (new bank bytes, BankEdit). The bank is returned unchanged when nothing in it is replaced."""
    chunks = wbank.chunks(memoryview(bank))  # views: the media is copied once, into the new bank
    get = lambda t: next((c for c in chunks if c[0] == t), None)
    edit = BankEdit()

    # 1. HIRC: source sizes, track timing, then segment timing
    hirc = get(b"HIRC")
    entries = [[t, id, bytearray(b)] for t, id, b in music.iter_hirc(hirc[1])] if hirc else []
    mem_sizes = {}   # source id -> media size this bank must hold
    retimed = {}     # track id -> new length
    replaced = set()  # track ids that play new audio: only their segments take the project's cue points
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
            if t == MUSIC_TRACK:
                replaced.add(id)
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
        # cue points are in ms of the new audio: a segment that plays none keeps the game's
        cues = overrides.get(id, {}) if any(c in replaced for c in seg.node.children) else {}
        if not lengths and not cues:
            continue
        if lengths:
            seg.duration_ms = max(lengths)
            seg.markers = [(m, 0.0 if m == music.ENTRY_CUE else seg.duration_ms if m == music.EXIT_CUE else p, n)
                           for m, p, n in seg.markers]
        for key, value in cues.items():
            cue = {"entry_marker": music.ENTRY_CUE, "exit_marker": music.EXIT_CUE}[key]
            seg.markers = [(m, value if m == cue else p, n) for m, p, n in seg.markers]
        if (entry := seg.cue(music.ENTRY_CUE)) is not None and (end := seg.cue(music.EXIT_CUE)) is not None \
                and entry >= end:
            # the game would hold the segment until its Entry (the music before it plays on, minutes long)
            raise CueError(id, entry, end)
        e[2] = bytearray(seg.to_bytes())
        edit.segments.append(id)

    # 2. DIDX/DATA: swap media, keep the vanilla order and alignment
    didx, data = get(b"DIDX"), get(b"DATA")
    if didx:
        rows = [struct.unpack_from("<III", didx[1], i) for i in range(0, len(didx[1]), 12)]
        align = 16 if all(off % 16 == 0 for _, off, _ in rows) else 1
        new_rows, pieces, off = [], [], 0  # pieces: the new DATA, its clips with the alignment between them
        for sid, o, n in rows:
            blob = data[1][o:o + n]
            if sid in reps and sid in mem_sizes:
                blob = reps[sid].wem[:mem_sizes[sid]]
                edit.media.append(sid)
            if (at := _align(off, align)) > off:
                pieces.append(bytes(at - off))
            pieces.append(blob)
            new_rows.append(struct.pack("<III", sid, at, len(blob)))
            off = at + len(blob)
        if edit.media:
            didx[1], data[1] = b"".join(new_rows), b"".join(pieces)
        del pieces

    if not (edit.media or edit.tracks or edit.segments or edit.sounds or edit.gains or edit.mutes):
        return bank, edit
    if hirc:
        hirc[1] = struct.pack("<I", len(entries)) + b"".join(
            struct.pack("<BII", t, 4 + len(b), id) + bytes(b) for t, id, b in entries)
    return b"".join(x for t, b in chunks for x in (t, struct.pack("<I", len(b)), b)), edit


def _head_size(groups: int, files: int) -> int:
    """Where a patch's toc data starts: after its header, a row per type and per file, and 8 bytes."""
    return 72 + 32 * groups + 80 * files + 8


def _pad(n: int) -> bytes:
    return bytes(_align(n, 16) - n)


class PatchWriter:
    """Writes a patch a file at a time, so a build holds one patched bank rather than all of them (a big sound
    effects project patches over 800 MB of banks; joined in memory, a patch took several times its size). The banks
    come in id order (bank), then their deps and the string tables (finish). The files go after the table of
    contents, which is laid out for the banks that may come and the deps they may have: when fewer come (a bank the
    replacements leave as the game has it), what is written moves up to where the smaller table ends. The patch is
    written under another name and takes its own on finish, so one that fails part of the way leaves the folder as
    it was. Carried files (a mod's other files, Carried) go last, as they were; one with the id of a file written
    here is left out, and of two carried with one id the later one goes in."""

    def __init__(self, path, streams: dict[int, bytes], banks, deps, strings: dict[int, bytes] | None = None,
                 carried: list[Carried] | None = None):
        self.path, self.streams, self.strings = path, streams, strings or {}
        self.banks, self.deps, self.sizes = set(banks), set(deps), {}  # the ids laid out; sizes: {bank id: size}
        self.carried = {}  # {(type, id): Carried}
        for c in carried or []:
            if c.tid not in AUDIO_TYPES and not (c.tid == STRINGS and c.fid in self.strings):
                self.carried[(c.tid, c.fid)] = c
        counts = [len(streams), len(self.banks), len(self.deps), len(self.strings)]
        types = len({t for t, _ in self.carried})
        self.start = _head_size(sum(map(bool, counts)) + types, sum(counts) + len(self.carried))
        self.f = open(path + ".partial", "w+b")
        self.f.seek(self.start)
        for fid in sorted(streams):
            self.f.write(BANK_TAG + bytes(4) + struct.pack("<Q", len(streams[fid])))

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        if not self.f.closed:  # not finished
            self.f.close()
        if os.path.exists(self.path + ".partial"):
            os.remove(self.path + ".partial")

    def bank(self, fid: int, data: bytes):
        """Writes the next bank (raw bank bytes; ids rising)."""
        if fid not in self.banks or (self.sizes and fid <= next(reversed(self.sizes))):
            raise ValueError(f"bank {fid} isn't one that may come next")
        self.f.write(BANK_TAG + struct.pack("<IQ", len(data), fid))
        self.f.write(data)
        self.f.write(_pad(16 + len(data)))
        self.sizes[fid] = len(data)

    def finish(self, deps: dict[int, bytes]):
        """Writes the deps of the banks written (raw toc data), the string tables (raw table bytes, strings.py) and
        the table of contents, then the .stream file."""
        if set(deps) - self.deps:
            raise ValueError(f"deps {sorted(set(deps) - self.deps)[:5]} weren't laid out")
        carried = self.carried
        ids = {WWISE_STREAM: sorted(self.streams), WWISE_BANK: list(self.sizes), WWISE_DEP: sorted(deps),
               STRINGS: sorted(self.strings)}
        for t, i in sorted(carried):  # a carried string table joins the project's
            ids.setdefault(t, []).append(i)
        groups = [(t, got if t == WWISE_BANK else sorted(got)) for t, got in ids.items() if got]
        nfiles = sum(len(ids) for _, ids in groups)
        head = bytearray(struct.pack("<IIII", 0xF0000011, len(groups), nfiles, 0) + HEADER_TAIL)
        for tid, ids in groups:
            head += struct.pack("<QQQII", 0, tid, len(ids), 16, 64)
        toc_off, s_off, g_off, idx = _head_size(len(groups), nfiles), 0, 0, 0
        # (offset, data) in the .stream and .gpu_resources files; the toc data that follows the banks, in order
        streamed, gpu, tail = [], [], []
        for tid, ids in groups:
            for fid in ids:
                c, at, g_size, unknown = carried.get((tid, fid)), s_off, 0, (0, 0, 16, 64)
                if tid == WWISE_STREAM:
                    size, s_size = 0x0C, len(self.streams[fid])
                    streamed.append((at, self.streams[fid]))
                elif tid == WWISE_BANK:
                    size, s_size = 16 + self.sizes[fid], 0
                elif c is None:
                    tail.append(deps[fid] if tid == WWISE_DEP else self.strings[fid])
                    size, s_size = len(tail[-1]), 0
                else:
                    size, s_size, g_size, unknown = len(c.data), len(c.stream), len(c.gpu), c.unknown
                    at = _align(s_off, CARRIED_ALIGN) if s_size else 0
                    if s_size:
                        streamed.append((at, c.stream))
                        s_off = at
                    if g_size:
                        g_off = _align(g_off, CARRIED_ALIGN)
                        gpu.append((g_off, c.gpu))
                    tail.append(c.data)
                head += struct.pack("<QQQQQQQIIIIII", fid, tid, toc_off, at, g_off if g_size else 0, *unknown[:2],
                                    size, s_size, g_size, *unknown[2:], idx)
                toc_off += 16 if tid == WWISE_STREAM else _align(size, 16)
                s_off += _align(s_size, 16)
                g_off += g_size
                idx += 1
        head += bytes(8)
        f, end = self.f, self.f.tell()
        if len(head) < self.start:  # forward, a piece at a time: each piece is read before it is written over
            for at in range(self.start, end, MOVE_PIECE):
                f.seek(at)
                piece = f.read(min(MOVE_PIECE, end - at))
                f.seek(at - self.start + len(head))
                f.write(piece)
            f.seek(end - self.start + len(head))
        for data in tail:
            f.write(data)
            f.write(_pad(len(data)))
        assert f.tell() == toc_off, "the patch's files don't add up to its table of contents"
        if toc_off < nfiles * 256:  # a patch is never shorter than 256 bytes a file
            f.write(bytes(nfiles * 256 - toc_off))
        f.truncate()
        f.seek(0)
        f.write(head)
        f.close()
        os.replace(self.path + ".partial", self.path)
        _write_at(self.path + ".stream", streamed)
        _write_at(self.path + ".gpu_resources", gpu)


def write_patch(path, streams: dict[int, bytes], banks: dict[int, bytes], deps: dict[int, bytes],
                strings: dict[int, bytes] | None = None, carried: list[Carried] | None = None):
    """Writes path (+ .stream, .gpu_resources): wwise streams, banks (raw bank bytes), their deps (raw toc data),
    string tables (raw table bytes, strings.py) and carried files (a mod's others, as they were)."""
    with PatchWriter(path, streams, banks, deps, strings, carried) as w:
        for fid in sorted(banks):
            w.bank(fid, banks[fid])
        w.finish(deps)


def build_patch(path, reps: list[Replacement], ix: AudioIndex, overrides=None, strings=None,
                plan: addition.Plan | None = None, settings=None, where=None, set_where=None, carried=None,
                music_plan: soundtrack.Plan | None = None):
    """Patches every bank that holds or plays a replaced source, gets new audio (the plan; reps hold the new
    clips' audio too) or has an object with settings ({object id: {prop id: value or None}}: an imported mod's,
    applied before the replacements' gain and silence), and adds string tables ({file id: table bytes}) and the
    carried files (a mod's files besides its audio, Carried); returns {bank id: BankEdit}. music_plan (the
    Soundtrack's, soundtrack.plan) changes every copy of the playlists and switches it names. where ({source: banks}) and set_where ({object: banks}) keep a source or an
    object to those banks (build.reach); a bank patched for something else still gets them where it has them."""
    overrides, settings, where, set_where = overrides or {}, settings or {}, where or {}, set_where or {}
    by_source = {r.source: r for r in reps}
    banks = set(plan.banks) if plan else set()
    for r in reps:
        banks |= where.get(r.source) or ix.banks_for(r.source)
    for oid in settings:
        banks |= set_where.get(oid) or set(ix.copies(oid))
    for oid in music_plan.objects if music_plan else ():
        banks |= set(ix.copies(oid))
    # a sound's stream goes by the index: a voice line's is filed under its language, and a stream no bank plays
    # is its own target
    streams = {ix.stream_file(r.source): r.wem for r in reps if ix.stream_file(r.source) is not None}
    order, deps, edits = sorted(banks), {}, {}
    # each bank goes to the disk once patched. The patch's table is laid out for all of them, and nearly always all
    # come: a bank that only plays a streamed sound, without a new gain, stays as the game has it
    with PatchWriter(path, streams, order, [b for b in order if ix.has_dep(b)], strings, carried) as w:
        for bid in order:
            raw, dep = ix.bank_files(bid)
            grown = addition.apply(raw, plan.banks[bid], plan) if plan and bid in plan.banks else raw
            grown, set_ids = apply_settings(grown, settings) if settings else (grown, [])
            grown, music_ids = soundtrack.apply(grown, music_plan) if music_plan else (grown, [])
            new, edit = patch_bank(grown, by_source, overrides)
            edit.settings, edit.music = set_ids, music_ids
            if plan and bid in plan.banks:
                edit.added = sorted(plan.banks[bid].added)
            if new is not raw:
                w.bank(bid, new)
                edits[bid] = edit
                if dep:
                    deps[bid] = dep
            del raw, grown, new  # the next bank is read without this one
        w.finish(deps)
    return edits


def _toc(path):
    """toc_entries of a written patch, read from its head only."""
    with open(path, "rb") as f:
        head = f.read(72)
        types, files = struct.unpack_from("<II", head, 4)
        return toc_entries(head + f.read(32 * types + 80 * files))


def _files(path, tid):
    """(file id, data) of each file of one type in a written patch, read from the disk one at a time: a bank's bytes
    (its toc data less their 16-byte header), a stream's stream data, else the toc data. Read whole, a patch and
    its banks parsed took several times the patch's size."""
    stream, skip = tid == WWISE_STREAM, 16 if tid == WWISE_BANK else 0
    at = [(fid, s_off, s_size) if stream else (fid, off + skip, size - skip)
          for fid, t, off, size, s_off, s_size in _toc(path) if t == tid]
    if stream and not os.path.exists(path + ".stream"):
        yield from ((fid, b"") for fid, _, _ in at)
        return
    with open(path + ".stream" if stream else path, "rb") as f:
        for fid, off, size in at:
            f.seek(off)
            yield fid, f.read(max(0, size))


def read_patch(path):
    """({bank id: ({media id: bytes}, {hirc id: (type, body)})}, {stream file id: bytes}) of a written patch."""
    return ({fid: wbank.parse(data) for fid, data in _files(path, WWISE_BANK)},
            dict(_files(path, WWISE_STREAM)))


def _bank_diff(bid, patched, ix: AudioIndex):
    """What diff() says of one bank (patched: wbank.parse of the patch's), or None when this game version doesn't
    have it."""
    if bid not in ix.banks:
        return None
    vanilla = wbank.parse(ix.bank_files(bid)[0])
    (media, hirc), (v_media, v_hirc) = patched, vanilla
    return {
        "media": sorted(m for m in media if v_media.get(m) != media[m]),
        "objects": sorted((TYPE_NAMES.get(t, hex(t)), id) for id, (t, b) in hirc.items() if v_hirc.get(id) != (t, b)),
        "added": sorted(set(hirc) - set(v_hirc)), "removed": sorted(set(v_hirc) - set(hirc)),
        "read": (patched, vanilla),
    }


def _bank_diffs(path, ix: AudioIndex):
    """(bank id, _bank_diff of it), a bank at a time: verify keeps only what it needs of each."""
    for bid, data in _files(path, WWISE_BANK):
        # each let go as soon as it can be: the game's bank is read without the patch's bytes, and the next bank
        # without this one parsed
        patched = wbank.parse(data)
        del data
        b = _bank_diff(bid, patched, ix)
        del patched
        yield bid, b


def diff(path, ix: AudioIndex):
    """What a patch changes against the current game: streams, and per bank the media and HIRC objects (new ones
    count as changed too, and are also listed as added). "read" keeps both banks as wbank.parse reads them."""
    # unknown: banks this game version doesn't have
    out = {"streams": dict(_files(path, WWISE_STREAM)), "banks": {}, "unknown": []}
    for bid, b in _bank_diffs(path, ix):
        if b is None:
            out["unknown"].append(bid)
        else:
            out["banks"][bid] = b
    return out


def verify_strings(path, tables: dict[int, bytes], carried=()) -> list[str]:
    """Problems with the string tables of a written patch: each must be there, read back as a table, and hold
    exactly what was meant (tables: {file id: the bytes meant}). Empty list = good. carried: the ids of the string
    tables carried from a mod (verify_carried checks those)."""
    from . import strings
    found, problems = dict(_files(path, STRINGS)), []
    for fid, want in tables.items():
        try:
            ok = fid in found and strings.parse(found[fid]).texts == strings.parse(want).texts
        except (ValueError, struct.error, UnicodeDecodeError):
            ok = False
        if not ok:
            problems.append(f"string table {fid} is not as meant")
    if extra := set(found) - set(tables) - set(carried):
        problems.append(f"unexpected string tables {sorted(extra)}")
    return problems


def verify_carried(path, carried: list[Carried], strings_made=()) -> list[str]:
    """Problems with the carried files of a written patch: each one (the last of an id, unless a string table of
    strings_made has it) must be there exactly as it was, nothing else besides audio and the made string tables.
    Empty list = good."""
    want = {(c.tid, c.fid): c for c in carried if not (c.tid == STRINGS and c.fid in strings_made)}
    try:
        got = {(c.tid, c.fid): c for c in carried_of(path)}
    except (ValueError, OSError, struct.error) as e:
        return [f"its other files can't be read back: {e}"]
    for key in [*want, *got]:
        if key[0] == STRINGS and key[1] in strings_made:
            continue
        if want.get(key) != got.get(key):
            problems = "missing" if key not in got else "not as it was" if key in want else "unexpected"
            return [f"the mod's file {key[1]:016x} (type {key[0]:016x}) is {problems}"]
    return []


def verify(path, reps: list[Replacement], ix: AudioIndex, plan: addition.Plan | None = None, settings=None,
           where=None, music_plan: soundtrack.Plan | None = None) -> list[str]:
    """Problems with a written patch: it must change only the replaced audio, its size fields, the timing of the
    segments/tracks that play it, their gain and (silence) their Volume; put the new audio in every bank that holds
    the old (of those in where, {source: banks}, for a source kept to them); add exactly what the plan adds, where
    it belongs (addition.check); and give the objects with settings those settings (their Make-Up Gain and Volume a
    replacement's gain or silence may set instead); and give every copy of the music objects the Soundtrack
    changes (music_plan) exactly that change. Empty list = good."""
    where, settings = where or {}, settings or {}
    by_source, planned = {r.source: r for r in reps}, plan.banks if plan else {}
    banks, unknown, problems, added_problems = {}, [], [], []
    # a bank at a time, each let go once checked: all of them parsed, the patch's and the game's, took twice the
    # patch's size
    for bid, b in _bank_diffs(path, ix):
        if b is None:
            unknown.append(bid)
            continue
        hirc = b["read"][0][1]
        for oid in [i for _, i in b["objects"] if i in settings]:
            t, body = hirc[oid]
            have = wbank.props(t, body)
            if any(have.get(k) != v for k, v in settings[oid].items() if k not in (MAKEUP_GAIN, VOLUME)):
                problems.append(f"bank {bid}: object {oid} doesn't have its settings")
        b["objects"] = [(t, i) for t, i in b["objects"] if i not in settings]
        if music_plan:
            game = b["read"][1][1]
            for oid in music_plan.objects & set(game):
                t, body = game[oid]
                obj = music.PARSERS[t].read(oid, music.Reader(bytes(body)))
                want = (t, obj.to_bytes()) if soundtrack.change(obj, music_plan) else game[oid]
                if hirc.get(oid) != want:
                    problems.append(f"bank {bid}: music object {oid} isn't as the Soundtrack sets it")
            b["objects"] = [(t, i) for t, i in b["objects"] if i not in music_plan.objects]
        here = planned.get(bid)
        if here is not None:
            added_problems += [f"bank {bid}: {p}" for p in addition.check(*b["read"], here)]
            b["objects"] = [(t, i) for t, i in b["objects"] if i not in here.added | here.changed]
            b["added"] = []
        del b["read"], hirc
        banks[bid] = b
    if unknown:
        problems.append(f"banks this game version doesn't have: {unknown[:5]}")
    for bid, here in planned.items():
        if bid not in banks:
            problems.append(f"bank {bid}: the audio added to it is missing")
    problems += added_problems
    for fid, data in _files(path, WWISE_STREAM):
        sid = ix.resolve(fid)
        if sid not in by_source:
            problems.append(f"unexpected stream {fid}")
        elif data != by_source[sid].wem:
            problems.append(f"stream {fid} is not the encoded clip")
    for sid in by_source:
        missing = [b for b in ix.holders.get(sid, ()) if (sid not in where or b in where[sid])
                   and (b not in banks or sid not in banks[b]["media"])]
        if missing:
            problems.append(f"source {sid}: banks still holding the original audio {missing}")
    other = {t for b in banks.values() for t, _ in b["objects"]} - {"MusicSegment", "MusicTrack", "Sound"}
    stray = [m for b in banks.values() for m in b["media"] if m not in by_source]
    if other or stray or any(b["added"] or b["removed"] for b in banks.values()):
        problems.append(f"bank changes beyond the replacements: object types {other}, media {stray[:5]}")
    return problems
