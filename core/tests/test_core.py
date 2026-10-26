"""Unit tests (no game needed) and golden builds of the three mods (marked `game`; need the installed game)."""
import ast
import hashlib
import json
import re
import struct
import zipfile
from pathlib import Path

import pytest

from audiodiver import akd, bank, patch
from audiodiver.game import murmur64_hash, toc_entries, WWISE_BANK, WWISE_STREAM, WWISE_DEP
from audiodiver.project import Project, Replacement

HERE = Path(__file__).parent
MODS = HERE.parents[2] / "replacement mods"


# --- ids
def test_murmur64_known_values():
    assert murmur64_hash(b"content/audio/190505498") == 17544149167861950138
    assert murmur64_hash(b"abcdefghijk") == 18374413395122349366


# --- notes on clips
def test_clip_notes_merge_by_clip():
    from audiodiver.catalog import _clips
    got = _clips([{"label": "Stealth", "note": "a", "ids": ["1", "2"]},
                  {"tag": "quiet drums", "note": "b", "ids": ["2"]},
                  {"label": "Other", "note": "c", "warn": True, "min_ms": 7500, "ids": ["2"]}])
    assert got["1"] == {"label": "Stealth", "notes": [{"text": "a"}]}
    assert got["2"] == {"label": "Stealth", "min_ms": 7500, "notes": [
        {"text": "a"}, {"text": "b", "tag": "quiet drums"}, {"text": "c", "warn": True}]}


# the app's wording (app/README.md, Writing): what the screen shows names no people or sources (they are in
# About ▸ Credits), says nothing about testing, and speaks of the original and the new audio
SHOWN_NOT = re.compile(r"geoffrey|dekr0|community|\btested\b|untested|\byours?\b|\bmy audio\b|\bits\b", re.I)
ITS = re.compile(r"\bits\b", re.I)


def test_no_its_in_shown_text():
    """"its" never shows (the user's rule): not in the Wiki or the changelog, the app's strings or the core's messages.
    Comments and docstrings aren't shown. The game's own lines (subtitles, voice transcriptions) are quotes."""
    app = HERE.parents[1] / "app"
    found = []
    for f in [*sorted((app / "src" / "wiki").glob("*.md")), app / "CHANGELOG.md"]:
        found += [f"{f.name}:{i}" for i, line in enumerate(f.read_text(encoding="utf-8").splitlines(), 1) if ITS.search(line)]
    for f in sorted((app / "src").glob("*.ts*")):
        code = re.sub(r"/\*.*?\*/", "", f.read_text(encoding="utf-8"), flags=re.S)
        code = re.sub(r"(?<![:\\])//[^\n]*", "", code)
        found += [f"{f.name}: {m.group(0).strip()}" for m in re.finditer(r"[^\n]*\bits\b[^\n]*", code, re.I)]
    for f in sorted((HERE.parent / "audiodiver").glob("*.py")):
        tree = ast.parse(f.read_text(encoding="utf-8"))
        docs = {id(n.body[0].value) for n in ast.walk(tree)
                if isinstance(n, (ast.Module, ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) and n.body
                and isinstance(n.body[0], ast.Expr) and isinstance(n.body[0].value, ast.Constant)}
        found += [f"{f.name}:{n.lineno}" for n in ast.walk(tree)
                  if isinstance(n, ast.Constant) and isinstance(n.value, str) and id(n) not in docs and ITS.search(n.value)]
    assert found == []


def test_shown_data_texts_keep_the_writing_rules():
    data = HERE.parent / "audiodiver" / "data"
    notes = [g for name in ("notes.json", "exertions.json")
             for g in json.loads((data / name).read_text(encoding="utf-8"))["groups"]]
    music = json.loads((data / "music.json").read_text(encoding="utf-8"))
    shown = [t for g in notes for t in (g.get("note", ""), g.get("label", ""))]

    def walk(x, top=False):  # every "about" and "note" in music.json, but its own top-level "about" (for developers)
        if isinstance(x, dict):
            for k, v in x.items():
                if k in ("about", "note", "death") and isinstance(v, str) and not top:
                    shown.append(v)
                walk(v)
        elif isinstance(x, list):
            for v in x:
                walk(v)
    walk(music, top=True)
    for cat in json.loads((data / "sounds.json").read_text(encoding="utf-8"))["categories"]:
        shown += [cat["about"], *(s["about"] for s in cat["sections"])]
    assert len(shown) > 80 and [t for t in shown if SHOWN_NOT.search(t)] == []


# --- bank objects
def _sound(props: list[tuple[int, float]]) -> bytearray:
    """A minimal Sound body: source, then NodeBaseParams up to and past the prop bundle."""
    source = bank.SOURCE.pack(0x40001, 2, 1234, 0, 0, 0)
    head = bytes([0, 0, 0, 0]) + struct.pack("<IIB", 0, 99, 0)  # no fx/metadata; bus, parent, bits
    bundle = bytes([len(props), *(i for i, _ in props)]) + struct.pack(f"<{len(props)}f", *(v for _, v in props))
    return bytearray(source + head + bundle + b"TAIL")


def test_set_prop_adds_in_id_order_and_keeps_the_rest():
    body = patch.set_prop(bank.SOUND, _sound([(0, -3.0), (6, 100.0)]), patch.MAKEUP_GAIN, 4.0)
    assert body == _sound([(0, -3.0), (5, 4.0), (6, 100.0)])


def test_set_prop_replaces_an_existing_value():
    body = patch.set_prop(bank.SOUND, _sound([(5, 1.0)]), patch.MAKEUP_GAIN, 8.0)
    assert body == _sound([(5, 8.0)])


def test_silence_takes_a_sound_out_of_the_mix():
    """A silenced Sound gets a low logical Volume, which the game's HDR mix reads (Make-Up Gain it doesn't), so the
    silence stops ducking other sounds. Its Make-Up Gain stays; a Sound that plays something else is left alone."""
    sound, other = bytes(_sound([(5, 2.0)])), bytes(_sound([]))
    other = other[:5] + struct.pack("<I", 999) + other[9:]  # plays source 999
    hirc = struct.pack("<I", 2) + b"".join(struct.pack("<BII", bank.SOUND, 4 + len(b), i) + b for i, b in ((7, sound), (8, other)))
    raw = b"BKHD" + struct.pack("<I", 4) + bytes(4) + b"HIRC" + struct.pack("<I", len(hirc)) + hirc
    new, edit = patch.patch_bank(raw, {1234: patch.Replacement(1234, bytes(64), mute=True)}, {})
    assert edit.mutes == [7] and bank.parse(new)[1] == {7: (bank.SOUND, bytes(_sound([(0, patch.MUTE_DB), (5, 2.0)]))), 8: (bank.SOUND, other)}
    unchanged, edit = patch.patch_bank(raw, {1234: patch.Replacement(1234, bytes(64))}, {})
    assert unchanged is raw and not edit.mutes  # a replacement that isn't silence keeps the Volume


# --- streamed clips: the start a bank keeps
def _vorbis(seek: int, setup: int, packets: list[int]) -> bytes:
    """A Wwise Vorbis WEM laid out as the game's: fmt of 0x42 bytes with the Vorbis fields, then data holding the
    seek table, the setup packet and packets of the sizes given (each a 2-byte size, then its bytes). Data at 94."""
    fmt = bytearray(0x42)
    struct.pack_into("<HHI", fmt, 0, 0xFFFF, 2, 48000)
    struct.pack_into("<II", fmt, 0x28, seek, seek + setup)  # seek table size, first packet (from data)
    audio = b"".join(struct.pack("<H", n) + bytes([k + 1]) * n for k, n in enumerate(packets))
    return _riff((b"fmt ", bytes(fmt)), (b"data", bytes(seek + setup) + audio))


def test_a_kept_start_holds_the_whole_header_and_ends_on_a_packet():
    """As in every prefetch the game has: a start cut inside the header (a long song in place of a short piece has a
    longer seek table) crashed the game's decoder. Packets end at 947, 1249, 1551, 1853 (the header at 924)."""
    from audiodiver.wem import prefetch_size
    wem = _vorbis(600, 230, [21, 300, 300, 300])
    assert [prefetch_size(wem, mem) for mem in (642, 924, 947, 1000, 1249, 1852)] == [947, 947, 947, 1249, 1249, 1853]
    assert prefetch_size(wem, len(wem) + 5) == len(wem)
    pcm = _riff((b"fmt ", struct.pack("<HHI", 1, 2, 48000) + bytes(8)), (b"data", bytes(4000)))
    assert prefetch_size(pcm, 642) == 642  # not Wwise Vorbis: as before


def test_every_copy_of_a_streamed_clip_gives_the_start_the_bank_keeps():
    wem = _vorbis(600, 230, [21, 300, 300, 300])
    sounds = []
    for oid, mem in ((7, 642), (8, 1000)):
        body = bytes(_sound([]))
        sounds.append((oid, bank.SOURCE.pack(0x40001, patch.PREFETCH, 1234, 0, mem, 0) + body[bank.SOURCE.size:]))
    hirc = struct.pack("<I", 2) + b"".join(struct.pack("<BII", bank.SOUND, 4 + len(b), i) + b for i, b in sounds)
    old = b"RIFF" + bytes(1100)
    didx, data = struct.pack("<III", 1234, 0, len(old)), old
    raw = (b"BKHD" + struct.pack("<I", 4) + bytes(4) + b"DIDX" + struct.pack("<I", 12) + didx
           + b"DATA" + struct.pack("<I", len(data)) + data + b"HIRC" + struct.pack("<I", len(hirc)) + hirc)
    new, edit = patch.patch_bank(raw, {1234: patch.Replacement(1234, wem, fit_timing=False)}, {})
    media, objects = bank.parse(new)
    assert media == {1234: wem[:1249]} and edit.media == [1234] and sorted(edit.sounds) == [7, 8]
    assert [bank.SOURCE.unpack_from(objects[i][1], 0)[4] for i in (7, 8)] == [1249, 1249]


def test_clips_nothing_in_the_bank_plays_get_the_new_audio_too():
    """Footsteps keep their clips in banks that another bank's Sounds play from, and a Sound given a clip of its own
    leaves its old clip in its bank. The game plays the first copy loaded, so each copy gets the new audio, as the
    bank had it: the whole file, or the start of a streamed one."""
    whole, start = _riff((b"fmt ", bytes(16)), (b"data", bytes(100))), b"RIFF" + struct.pack("<I", 5000) + bytes(634)
    didx = struct.pack("<III", 1234, 0, len(whole)) + struct.pack("<III", 5678, 128, len(start))
    data = whole.ljust(128, b"\0") + start
    raw = (b"BKHD" + struct.pack("<I", 4) + bytes(4) + b"DIDX" + struct.pack("<I", len(didx)) + didx
           + b"DATA" + struct.pack("<I", len(data)) + data)
    wem = _vorbis(600, 230, [21, 300, 300, 300])
    new, edit = patch.patch_bank(raw, {s: patch.Replacement(s, wem) for s in (1234, 5678)}, {})
    assert bank.parse(new)[0] == {1234: wem, 5678: wem[:947]} and edit.media == [1234, 5678]


def _wav2wem_hash(setup: bytes) -> bytes:
    """A Wwise Vorbis WEM with this setup packet and the codebook hash wav2wem writes on every clip (fmt at 20)."""
    wem = bytearray(_vorbis(8, 2 + len(setup), [21, 30]))
    struct.pack_into("<H", wem, 94 + 8, len(setup))  # data at 94: the seek table, then the setup packet
    wem[94 + 10:94 + 10 + len(setup)] = setup
    struct.pack_into("<I", wem, 20 + 0x3C, 0x20CEF588)
    return bytes(wem)


def test_a_clip_gives_the_codebook_hash_of_its_own_setup():
    """The game decodes the clips playing at once that give one codebook hash with one copy of the codebooks (Wwise
    writes FNV-1 of the setup packet). wav2wem gives every clip the hash of its 24 kHz mono setup: a 48 kHz voice
    line played over a 24 kHz one screeched."""
    from audiodiver.wem import codebook_hash, with_codebook_hash
    assert codebook_hash(b"") == 0x811C9DC5 and codebook_hash(b"a") == 0x050C5D7E  # FNV-1, not FNV-1a
    setup = bytes(range(7, 47))
    wem = _wav2wem_hash(setup)
    fixed = with_codebook_hash(wem)
    assert struct.unpack_from("<I", fixed, 20 + 0x3C)[0] == codebook_hash(setup)
    assert fixed[:20 + 0x3C] == wem[:20 + 0x3C] and fixed[20 + 0x40:] == wem[20 + 0x40:]
    assert with_codebook_hash(fixed) is fixed  # a clip with the right hash (the game's, Wwise's) stays as it is
    pcm = _riff((b"fmt ", struct.pack("<HHI", 1, 2, 48000) + bytes(8)), (b"data", bytes(400)))
    assert with_codebook_hash(pcm) is pcm and with_codebook_hash(b"RIFF") == b"RIFF"


def test_mono_and_stereo_encodings_give_hashes_of_their_own(tmp_path):
    import wave
    from audiodiver import wem
    hashes = set()
    for channels in (1, 2):
        src, out = tmp_path / f"{channels}.wav", tmp_path / f"{channels}.wem"
        with wave.open(str(src), "wb") as w:
            w.setnchannels(channels); w.setsampwidth(2); w.setframerate(48000)
            w.writeframes(bytes(2 * channels * 4800))
        wem.encode(str(src), str(out))
        data = out.read_bytes()
        assert wem.with_codebook_hash(data) is data
        hashes.add(struct.unpack_from("<I", data, wem.fmt_offset(data) + 0x3C)[0])
    assert len(hashes) == 2 and 0x20CEF588 not in hashes


def test_a_wem_the_game_plays_goes_in_as_it_is_and_any_other_is_encoded(tmp_path, monkeypatch):
    """A Wwise Vorbis .wem is built unchanged but for the channel config wav2wem leaves out; a PCM one (Wwise writes
    those for authoring) is encoded like any other file."""
    import wave
    from audiodiver import build, index, wem
    monkeypatch.setattr(index, "CACHE_DIR", tmp_path / "cache")
    monkeypatch.setattr(build, "CACHE_DIR", tmp_path / "cache")
    pcm = tmp_path / "pcm.wem"
    with wave.open(str(pcm), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(48000)
        w.writeframes(bytes(range(256)) * 375)  # 0.5 s
    vorbis = tmp_path / "vorbis.wem"
    wem.encode(str(pcm), str(vorbis))
    data = bytearray(vorbis.read_bytes())
    struct.pack_into("<I", data, wem.fmt_offset(data) + 0x14, 0)
    vorbis.write_bytes(data)
    fixed = bytes(wem.fix_channel_config(bytearray(data)))
    assert build.encode_cached(vorbis) == fixed != bytes(data)
    encoded = build.encode_cached(pcm)
    assert wem.vorbis_fmt(encoded) == 20 and wem.length_ms(encoded) == 500


@pytest.mark.game
def test_the_games_clips_give_the_codebook_hash_of_their_setup():
    """What with_codebook_hash writes is what Wwise wrote in the game's own clips."""
    from audiodiver import wem
    from audiodiver.index import AudioIndex
    ix = AudioIndex()
    vorbis = 0
    for bid in sorted(ix.banks)[:60]:
        for data in bank.parse(ix.bank_files(bid)[0])[0].values():
            if data[:4] == b"RIFF" and len(data) >= struct.unpack_from("<I", data, 4)[0] + 8 \
                    and struct.unpack_from("<H", data, wem.fmt_offset(data))[0] == 0xFFFF:
                assert wem.with_codebook_hash(data) is data
                vorbis += 1
    assert vorbis > 100


@pytest.mark.game
def test_a_build_gives_each_clip_the_codebook_hash_of_its_setup(tmp_path, monkeypatch):
    """Encodings cached before the fix, and a mod's own clips, go into the patch with the hash of their setup."""
    from audiodiver import build
    from audiodiver.index import AudioIndex
    from audiodiver.wem import with_codebook_hash
    ix = AudioIndex()
    wrong = _wav2wem_hash(bytes(range(7, 47)))
    monkeypatch.setattr(build, "encode_cached", lambda src, quality=6, log=None: wrong)
    (tmp_path / "a.wav").write_bytes(b"")
    p = Project(name="Test", path=tmp_path / "t.audi", replacements=[Replacement(min(ix.holders), "a.wav")])
    [r] = build.replacements(p, ix)
    assert r.wem == with_codebook_hash(wrong) != wrong


# --- WEM analysis chunk
def _riff(*chunks):
    body = b"WAVE" + b"".join(tag + struct.pack("<I", len(d)) + d for tag, d in chunks)
    return b"RIFF" + struct.pack("<I", len(body)) + body


def test_akd_insert_uses_the_game_layout():
    data = _riff((b"fmt ", bytes(66)), (b"hash", bytes(16)), (b"data", b"\x01\x02\x03"))
    a = struct.pack("<ffIf", 1, 1, 1, -12.0) + struct.pack("<IH", 0, 12)
    out = akd.insert(data, a)
    assert [(t, o - 8) for t, o, _ in akd.chunks(out)] == [(b"fmt ", 12), (b"hash", 86), (b"junk", 110),
                                                           (b"akd ", 120), (b"data", 120 + 8 + len(a))]
    assert akd.get_chunk(out, b"akd ") == a and akd.get_chunk(out, b"data") == b"\x01\x02\x03"
    assert struct.unpack_from("<I", out, 4)[0] == len(out) - 8


# --- patch container
def test_write_patch_round_trips(tmp_path):
    hirc = struct.pack("<I", 1) + struct.pack("<BII", bank.SOUND, 4 + 4, 7) + b"body"
    raw_bank = b"BKHD" + struct.pack("<I", 4) + b"head" + b"HIRC" + struct.pack("<I", len(hirc)) + hirc
    path = str(tmp_path / "x.patch_0")
    patch.write_patch(path, {111: b"stream-bytes"}, {222: raw_bank}, {222: b"dep-data"})
    entries = toc_entries(open(path, "rb").read())
    assert [(e[0], e[1]) for e in entries] == [(111, WWISE_STREAM), (222, WWISE_BANK), (222, WWISE_DEP)]
    banks, streams = patch.read_patch(path)
    assert streams == {111: b"stream-bytes"}
    assert banks[222] == ({}, {7: (bank.SOUND, b"body")})


def _patch_files(n):
    """Streams, banks, deps and string tables of odd sizes: every file needs padding, and with n=1 the patch ends
    before 256 bytes a file."""
    return ({111: b"s" * (5 * n + 3), 99: b"t" * (16 * n), 5: b"u" * 7},
            {222: b"B" * (9 * n + 1), 7: b"C" * 33, 300: b"D" * (16 * n - 16)},
            {222: b"dep-data", 300: b"d" * 21}, {44: b"table" * (3 * n)} if n > 1 else {})


@pytest.mark.parametrize("n, digests", [
    (1, ("23bfb4127b70d449cc8a4f867827cb3fc6a3e100b09fb6062f82f801a35dd714",
         "5fc27d1ab01edd7559a2b7d57d496d23b755ee1842fda97c52f9033227e5fb6b")),
    (40_000, ("05938a4e7cfcc00a4354b85e7c1b892a35ecf43bd2ef510c14c46799eb63a6ac",
              "4f83d9dd807ee2b9a3761b84ba44564be2e1f09276eddf9c958e255eef86ba82"))])
def test_write_patch_writes_the_bytes_it_always_has(tmp_path, n, digests):
    """The same bytes as the writer that joined the whole patch in memory first (its SHA-256s)."""
    path = str(tmp_path / "x.patch_0")
    patch.write_patch(path, *_patch_files(n))
    assert tuple(hashlib.sha256(open(p, "rb").read()).hexdigest() for p in (path, path + ".stream")) == digests


@pytest.mark.parametrize("piece", [7, 16, 500, 1 << 20])
def test_patch_writer_laid_out_for_more_writes_what_write_patch_does(tmp_path, monkeypatch, piece):
    """Banks and deps that were laid out but don't come: what is written moves up, a piece at a time (pieces
    smaller than a file, not a multiple of 16, larger than the distance moved), to where write_patch puts it. With
    none of the banks the table loses its rows for banks and deps."""
    monkeypatch.setattr(patch, "MOVE_PIECE", piece)
    streams, banks, deps, strings = _patch_files(40)
    for came, came_deps in ((banks, deps), ({}, {})):
        want, got = str(tmp_path / "want.patch_0"), str(tmp_path / "got.patch_0")
        patch.write_patch(want, streams, came, came_deps, strings)
        with patch.PatchWriter(got, streams, [*banks, 250, 400], [*deps, 7, 250], strings) as w:
            for fid in sorted(came):
                w.bank(fid, came[fid])
            w.finish(came_deps)
        for suffix in ("", ".stream"):
            assert open(got + suffix, "rb").read() == open(want + suffix, "rb").read()
        assert not (tmp_path / "got.patch_0.partial").exists()


def test_patch_writer_that_fails_leaves_the_patch_as_it_was(tmp_path):
    path = str(tmp_path / "x.patch_0")
    patch.write_patch(path, *_patch_files(1))
    before = open(path, "rb").read()
    with pytest.raises(patch.CueError):
        with patch.PatchWriter(path, {}, [1, 2], [1]) as w:
            w.bank(1, b"x" * 100)
            raise patch.CueError(2, 10, 5)
    with pytest.raises(ValueError):  # banks come in id order, and only those laid out
        with patch.PatchWriter(path, {}, [1, 2], []) as w:
            w.bank(2, b"x")
            w.bank(1, b"x")
    assert open(path, "rb").read() == before and not (tmp_path / "x.patch_0.partial").exists()


# --- the game's archives
def _bundle(folder: Path, resources, name="bundles.00.nxa") -> dict[int, int]:
    """Writes folder/name as the game lays a bundle out: "DSAR", then a table of chunks, each stored as it is or
    LZ4-compressed, a resource's first chunk flagged. resources: [[(bytes, compressed)] per chunk]. Returns
    {uncompressed offset: chunk} (slim.bundle_offsets)."""
    from lz4 import block
    from audiodiver._vendor import slim
    chunks, offsets, at = [], {}, 0
    for resource in resources:
        for i, (data, packed) in enumerate(resource):
            offsets[at] = len(chunks)
            chunks.append((at, data, block.compress(data, store_size=False) if packed else data, packed, i == 0))
            at += len(data)
    table, blobs, stored_at = b"", b"", 0x20 + 0x20 * len(chunks)
    for at, data, stored, packed, first in chunks:
        table += struct.pack("<QQIIBB6x", at, stored_at + len(blobs), len(data), len(stored),
                             slim.COMPRESSED if packed else slim.UNCOMPRESSED, slim.START if first else slim.CONTINUE)
        blobs += stored
    (folder / name).write_bytes(struct.pack("<4s4xI", b"DSAR", len(chunks)).ljust(0x20, b"\0") + table + blobs)
    return offsets


def test_bundle_part_reads_what_the_whole_package_has(tmp_path, monkeypatch):
    """Every range of a package, read from only its chunks, is that range of the package rebuilt whole: resources of
    one chunk and of several, stored and compressed, and a part whose last resource runs on past where the next
    part starts (the next part's bytes win there)."""
    import random
    from audiodiver import game
    from audiodiver._vendor import slim
    random.seed(5)
    blob = lambda n: bytes(random.randrange(4) for _ in range(n))  # a few values: LZ4 has something to pack
    resources = [[(blob(40), False)], [(blob(100), True), (blob(50), False), (blob(70), True)],
                 [(blob(33), True)], [(blob(64), False), (blob(10), True)], [(blob(25), True)]]
    offsets = _bundle(tmp_path, resources)

    def part(start, at):
        e = slim.BundleEntry()
        e.bundle_index, e.start_offset, e.original_archive_offset = 0, start, at
        return e
    p = slim.Package()
    # the first part is two resources (260 bytes); the second (from 260) runs 7 bytes on past the third's start
    p.size, p.entries = 385, [part(0, 0), part(260, 260), part(367, 360)]
    shuffled = slim.Package()
    shuffled.size, shuffled.entries = p.size, [p.entries[1], p.entries[0], p.entries[2]]
    monkeypatch.setattr(slim, "package_contents", {"pkg": p, "shuffled": shuffled})
    monkeypatch.setattr(slim, "bundle_offsets", {"bundles.00.nxa": offsets})
    whole = game.from_bundles(tmp_path, "pkg")
    assert len(whole) == p.size
    for offset in range(0, p.size + 1):
        for size in {0, 1, 7, 16, 41, 99, p.size - offset}:
            if offset + size <= p.size:
                assert game.bundle_part(tmp_path, "pkg", offset, size) == whole[offset:offset + size], (offset, size)
    # past the end, or parts out of order: only the whole rebuild reads those
    assert game.bundle_part(tmp_path, "pkg", 380, 6) is None
    assert game.bundle_part(tmp_path, "shuffled", 0, 10) is None


def test_files_of_another_kind_beside_the_bundles_are_passed_over(tmp_path, monkeypatch):
    """Only DSAR files are read as bundles. Before 1.1.1, one uncompressed file in the data folder that the game
    doesn't ship (another tool's, left there) stopped the game from loading: "unpack requires a buffer of ... bytes"."""
    from audiodiver import game
    from audiodiver._vendor import slim
    for name in ("package_contents", "bundle_offsets", "game_data_folder"):
        monkeypatch.setattr(slim, name, getattr(slim, name))  # slim_init sets them for the whole core
    _bundle(tmp_path, [[(bytes(0x20), False)]], "bundles.nxa")  # the index of packages: none
    offsets = _bundle(tmp_path, [[(bytes(40), False)], [(bytes(30), True)]])
    stray = struct.pack("<III", 0xF0000011, 0, 1000).ljust(600, b"\0")  # bytes 8-11 read as 1000 chunks
    for name in ("0123456789abcdef", "0123456789abcdef.stream", "0123456789abcdef.gpu_resources"):
        (tmp_path / name).write_bytes(stray)
    g = game.Game(tmp_path)
    assert slim.bundle_offsets == {"bundles.nxa": {0: 0}, "bundles.00.nxa": offsets}
    assert g.packages == [] and g.loose == {}


# --- project file
def test_project_round_trips_64_bit_targets(tmp_path):
    (tmp_path / "a.wav").write_bytes(b"")
    p = Project(name="Test", replacements=[Replacement(18446744073709551557, "a.wav", gain_db=8.0)],
                segment_overrides={967132321: {"exit_marker": 6000.0}}, path=tmp_path / "t.audi")
    p.save()
    text = (tmp_path / "t.audi").read_text()
    assert '"target": "18446744073709551557"' in text
    q = Project.load(tmp_path / "t.audi")
    assert q.replacements == p.replacements and q.segment_overrides == p.segment_overrides and q.problems() == []


def test_project_keeps_its_banks_setting_and_an_imported_mods_banks(tmp_path):
    p = Project(name="Test", path=tmp_path / "t.audi")
    p.save()
    text = (tmp_path / "t.audi").read_text()
    assert "every_bank" not in text and "imported_banks" not in text and "patch_files" not in text  # as they were
    p.every_bank, p.imported_banks, p.patch_files = True, [6187728386225981464], True
    p.save()
    assert '"6187728386225981464"' in (tmp_path / "t.audi").read_text()
    q = Project.load(tmp_path / "t.audi")
    assert q.every_bank and q.imported_banks == [6187728386225981464] and q.patch_files


def test_a_sound_goes_into_the_projects_banks():
    """build.reach: an imported mod's banks first, then those of what the project lists; the holders join a bank
    that only plays the sound, a stream's holders always; music and a sound no such bank has keep every bank."""
    from types import SimpleNamespace
    from audiodiver.build import reach
    R = lambda s: patch.Replacement(s, b"")
    ix = SimpleNamespace(
        holders={1: {10, 11, 12}, 2: {10, 11}, 3: {30}, 4: {40, 41}, 5: {50}},
        users={1: {10, 11, 12, 13}, 2: {14}, 3: {30, 31}, 4: {40}, 5: {50, 51}},
        music_banks=[50, 51], stream_file=lambda s: 99 if s == 4 else None,
        copies=lambda o: [10, 11, 12] if o == 7 else [])
    ix.banks_for = lambda s: ix.holders.get(s, set()) | ix.users.get(s, set())
    reps = [R(1), R(2), R(3), R(4), R(5)]
    p = Project(name="Test", imported_banks=[10, 14])
    sounds, objects = reach(p, ix, reps, {7: {0: 1.0}, 8: {0: 1.0}}, listed={31, 40})
    assert sounds == {1: {10}, 2: {10, 14}, 3: {31, 30}, 4: {40, 41}}  # 5: music
    assert objects == {7: {10}}  # 8: no copy in the mod's banks, so every copy
    assert reach(Project(name="Test", every_bank=True, imported_banks=[10]), ix, reps, {7: {0: 1.0}}) == ({}, {})


def test_project_flags_duplicate_targets_and_missing_audio(tmp_path):
    p = Project(name="Test", replacements=[Replacement(1, "x.wav"), Replacement(1, "y.wav")], path=tmp_path / "t.audi")
    probs = p.problems()
    assert any("same target" in s for s in probs) and sum("wasn't found" in s for s in probs) == 2


# --- packaging
def test_package_writes_the_zip_whole_or_not_at_all(tmp_path, monkeypatch):
    from PIL import Image
    from audiodiver import arsenal
    (tmp_path / "patch").mkdir()
    (tmp_path / "patch" / arsenal.ARCHIVE).write_bytes(b"patch")
    (tmp_path / "icon.png").write_bytes(arsenal.default_icon())
    out = tmp_path / "out" / "mod-1.zip"
    args = dict(name="Mod", guid="613bc667-0000-4000-8000-000000000000", icon=tmp_path / "icon.png",
                options=[{"name": "Mod", "description": "", "folder": tmp_path / "patch"}])
    arsenal.package(out, **args)
    with zipfile.ZipFile(out) as z:
        assert sorted(z.namelist()) == ["icon.png", "manifest.json", "mod/9ba626afa44a3aa3.patch_0"]
        assert json.loads(z.read("manifest.json"))["IconPath"] == "icon.png"
        assert z.getinfo("mod/9ba626afa44a3aa3.patch_0").compress_type == zipfile.ZIP_STORED  # Vorbis barely deflates
        assert z.read("mod/9ba626afa44a3aa3.patch_0") == b"patch"
    before, written = out.read_bytes(), []
    real = zipfile.ZipFile.open

    def disk_full(self, name, mode="r", *a, **kw):  # the second build of this version fails halfway through the ZIP
        if mode == "w":
            written.append(getattr(name, "filename", name))
            if len(written) == 3:
                raise OSError(28, "No space left on device")
        return real(self, name, mode, *a, **kw)
    monkeypatch.setattr(zipfile.ZipFile, "open", disk_full)
    with pytest.raises(OSError):
        arsenal.package(out, **args)
    monkeypatch.undo()
    assert out.read_bytes() == before and [f.name for f in out.parent.iterdir()] == ["mod-1.zip"]
    Image.new("RGB", (8, 8)).save(tmp_path / "icon.jpg")
    with pytest.raises(ValueError):
        arsenal.package(out, **{**args, "icon": tmp_path / "icon.jpg"})


def test_a_patch_ships_without_empty_parts_and_its_files_can_be_saved(tmp_path):
    """Audio has no GPU data, and most audio mods ship without an empty .gpu_resources or .stream."""
    from audiodiver import arsenal
    names = [arsenal.ARCHIVE + s for s in arsenal.SUFFIXES]
    patch_dir, out = tmp_path / "patch", tmp_path / "mod-2"
    patch_dir.mkdir(); out.mkdir()
    for name, data in zip(names, (b"patch", b"streams", b"")):
        (patch_dir / name).write_bytes(data)
    assert sorted(arsenal.archive_files(patch_dir)) == names[:2]
    (out / names[2]).write_bytes(b"gpu")  # left by a build with data there
    arsenal.save_patch_files(patch_dir, out)
    assert sorted(f.name for f in out.iterdir()) == names[:2] and (out / names[0]).read_bytes() == b"patch"


def test_a_build_never_goes_into_the_games_folder(tmp_path):
    from types import SimpleNamespace
    from audiodiver.build import BuildError, build
    from audiodiver.game import in_game_folder
    game = tmp_path / "Helldivers 2"
    (game / "data").mkdir(parents=True)
    ix = SimpleNamespace(game=SimpleNamespace(data=game / "data"))  # the check comes before anything reads the game
    p = Project(name="Test", path=tmp_path / "proj" / "t.audi", build_folder="../Helldivers 2/mods")
    for folder in (None, game / "data", game, game / "bin" / "x"):  # None: the folder the project file names
        with pytest.raises(BuildError, match="inside the game folder"):
            build(p, ix, folder, log=lambda *_: None)
    assert [f.name for f in game.iterdir()] == ["data"] and not list((game / "data").iterdir())
    assert not in_game_folder(tmp_path / "Helldivers 2 mods", game / "data")  # a name that only starts the same
    root = Path(tmp_path.anchor)  # a data folder at a drive's root has no game folder around it
    assert in_game_folder(root / "data" / "x", root / "data") and not in_game_folder(root / "builds", root / "data")


def _png_size(data: bytes):
    import io
    from PIL import Image
    with Image.open(io.BytesIO(data)) as img:
        assert img.format == "PNG"
        return img.size


# --- golden builds (the three mods, verified in game)
GOLDEN = json.loads((HERE / "golden.json").read_text())


@pytest.mark.game
@pytest.mark.parametrize("key", sorted(GOLDEN["projects"]))
def test_golden_build(key, tmp_path):
    from audiodiver.build import build
    from audiodiver.index import AudioIndex
    ix = AudioIndex()
    if hashlib.sha256(ix.game.fingerprint.encode()).hexdigest()[:16] != GOLDEN["game"]:
        pytest.skip("game updated since the goldens were recorded; rebuild, test in game, re-record")
    g = GOLDEN["projects"][key]
    zip_path = build(Project.load(MODS / g["project"]), ix, tmp_path, log=lambda *_: None)
    assert [f.name for f in tmp_path.iterdir()] == [zip_path.name]  # the ZIP is all a build leaves in its folder
    with zipfile.ZipFile(zip_path) as z:  # one option folder with the patch's files; an empty part is left out
        patch_files = {Path(n).name: z.read(n) for n in z.namelist() if "/" in n}
        assert _png_size(z.read("icon.png")) == (540, 540)
    got = {name: hashlib.sha256(data).hexdigest() for name, data in patch_files.items() if data}
    assert got == g["files"] and all(patch_files.values())


@pytest.mark.game
def test_a_shared_clip_goes_into_the_projects_banks_or_every_bank(tmp_path):
    """A clip many banks hold, kept to one bank by default and in all of them with every_bank; both verified."""
    from audiodiver import build
    from audiodiver.index import AudioIndex
    ix = AudioIndex()
    music = set(ix.music_banks)
    sid = next(s for s, h in sorted(ix.holders.items()) if len(h) >= 3 and not ix.banks_for(s) & music
               and ix.stream_file(s) is None)
    home = min(ix.holders[sid])
    for every in (False, True):
        p = Project(name="Test", path=tmp_path / f"{every}" / "t.audi", every_bank=every, imported_banks=[home],
                    replacements=[Replacement(sid, "", silence=True)])
        (tmp_path / f"{every}").mkdir()
        edits = build.make_patch(p, ix, tmp_path / f"{every}", log=lambda *_: None)
        assert set(edits) == (ix.banks_for(sid) if every else {home})


@pytest.mark.game
def test_a_build_can_save_the_patch_files_beside_the_zip(tmp_path):
    """For packing the mod another way: a folder named like the ZIP, with the files the ZIP holds."""
    from audiodiver import build
    from audiodiver.index import AudioIndex
    ix = AudioIndex()
    sid = next(s for s, h in sorted(ix.holders.items()) if len(h) == 1 and ix.stream_file(s) is None)
    p = Project(name="Test", path=tmp_path / "t.audi", imported_banks=[min(ix.holders[sid])], patch_files=True,
                replacements=[Replacement(sid, "", silence=True)])
    zip_path = build.build(p, ix, tmp_path / "out", log=lambda *_: None)
    folder = tmp_path / "out" / "test-1"
    assert sorted(f.name for f in (tmp_path / "out").iterdir()) == ["test-1", "test-1.zip"]
    with zipfile.ZipFile(zip_path) as z:
        assert {f.name: f.read_bytes() for f in folder.iterdir()} == \
            {Path(n).name: z.read(n) for n in z.namelist() if "/" in n}
