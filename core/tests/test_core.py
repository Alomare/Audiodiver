"""Unit tests (no game needed) and golden builds of the three mods (marked `game`; need the installed game)."""
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
SHOWN_NOT = re.compile(r"geoffrey|dekr0|community|\btested\b|untested|\byours?\b|\bmy audio\b", re.I)


def test_shown_data_texts_keep_the_writing_rules():
    data = HERE.parent / "audiodiver" / "data"
    notes = json.loads((data / "notes.json").read_text(encoding="utf-8"))["groups"]
    music = json.loads((data / "music.json").read_text(encoding="utf-8"))
    shown = [g.get("note", "") for g in notes]

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
        assert sorted(z.namelist()) == ["icon.png", "manifest.json", "mod/9ba626afa44a3aa3.patch_0",
                                        "mod/9ba626afa44a3aa3.patch_0.gpu_resources",
                                        "mod/9ba626afa44a3aa3.patch_0.stream"]
        assert json.loads(z.read("manifest.json"))["IconPath"] == "icon.png"
    before, written = out.read_bytes(), []
    real = zipfile.ZipFile.writestr

    def disk_full(self, *a, **kw):  # the second build of this version fails halfway through the ZIP
        written.append(a[0].filename)
        if len(written) == 3:
            raise OSError(28, "No space left on device")
        return real(self, *a, **kw)
    monkeypatch.setattr(zipfile.ZipFile, "writestr", disk_full)
    with pytest.raises(OSError):
        arsenal.package(out, **args)
    monkeypatch.undo()
    assert out.read_bytes() == before and [f.name for f in out.parent.iterdir()] == ["mod-1.zip"]
    Image.new("RGB", (8, 8)).save(tmp_path / "icon.jpg")
    with pytest.raises(ValueError):
        arsenal.package(out, **{**args, "icon": tmp_path / "icon.jpg"})


def test_a_build_never_goes_into_the_games_folder(tmp_path):
    from types import SimpleNamespace
    from audiodiver.build import BuildError, build
    from audiodiver.game import in_game_folder
    game = tmp_path / "Helldivers 2"
    (game / "data").mkdir(parents=True)
    ix = SimpleNamespace(game=SimpleNamespace(data=game / "data"))  # the check comes before anything reads the game
    p = Project(name="Test", path=tmp_path / "proj" / "t.audi", build_folder="../Helldivers 2/mods")
    for folder in (None, game / "data", game, game / "bin" / "x"):  # None: the folder the project file names
        with pytest.raises(BuildError, match="inside the game's folder"):
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
    with zipfile.ZipFile(zip_path) as z:  # one option folder with the patch trio; the parts a patch lacks ship empty
        patch_files = {Path(n).name: z.read(n) for n in z.namelist() if "/" in n}
        assert _png_size(z.read("icon.png")) == (540, 540)
    got = {name: hashlib.sha256(data).hexdigest() for name, data in patch_files.items() if data}
    assert got == g["files"] and len(patch_files) == 3


@pytest.mark.game
def test_music_builds_carry_the_fix_for_silent_biomes(tmp_path):
    """With the project's biome_fix on, a build's music_init starts from the fix for the music that stays silent on
    seven biomes (biome.py, Sound Systems Rebalanced's patch): each object the fix touches is the fix applied to the
    build's own copy of it (the build's timing, sizes and gain reach the copied tracks and the new clips), and nothing
    else differs from the same build with it off (the default)."""
    from audiodiver import biome, patch
    from audiodiver._vendor.ssr import biome_patch as ssr
    from audiodiver.build import build
    from audiodiver.index import AudioIndex
    ix = AudioIndex()
    if biome.fixed_init(ix) is None:
        pytest.skip("this game version's music banks aren't the ones the fix was made for")
    project = MODS / GOLDEN["projects"]["wos"]["project"]

    def built(folder, fix):
        folder.mkdir()
        p = Project.load(project)
        assert not p.biome_fix  # off unless a project turns it on
        p.biome_fix = fix
        with zipfile.ZipFile(build(p, ix, folder, log=lambda *_: None)) as z:
            for n in z.namelist():
                if "/" in n:
                    (folder / Path(n).name).write_bytes(z.read(n))
        return patch.read_patch(str(folder / "9ba626afa44a3aa3.patch_0"))
    (fixed, streams) = built(tmp_path / "fixed", True)
    (plain, plain_streams) = built(tmp_path / "plain", False)
    assert biome.INIT in fixed and streams == plain_streams
    assert {b: v for b, v in fixed.items() if b != biome.INIT} == {b: v for b, v in plain.items() if b != biome.INIT}
    new, old = fixed[biome.INIT][1], plain[biome.INIT][1]
    assert set(new) - set(old) == biome.copied(ix) and set(old) <= set(new)
    mission = (fixed.get(biome.MISSION[0]) or (None, bank.parse(ix.bank_files(biome.MISSION[0])[0])[1]))[1]
    changed = [i for i in new if new[i] != old.get(i)]
    assert len(changed) == 52  # 24 tracks and a switch fixed in place, 24 tracks and 3 switches copied in
    for i in changed:
        kind, body = old.get(i) or mission[i]
        want = ssr.patch_track(body) if kind == 11 else ssr.patch_switch(body if i in old else ssr.without_children(body))
        assert new[i] == (kind, want)
    # a patch whose music_init carries the fix reads as changing only what the build changed
    assert not patch.diff(str(tmp_path / "fixed" / "9ba626afa44a3aa3.patch_0"), ix)["banks"][biome.INIT]["added"]
