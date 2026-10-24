"""Repatching (repatch.py, Session.repatch): an existing mod found in a file, folder or ZIP, and rebuilt on the game
as it is now."""
import json
import struct
import time
import zipfile
from pathlib import Path

import pytest

from audiodiver import patch, repatch
from audiodiver import bank as wbank
from audiodiver.editor import EditorError, Session
from audiodiver.game import WWISE_BANK, WWISE_STREAM, WWISE_DEP
from audiodiver.patch import read_patch
from audiodiver.strings import STRINGS

MODS = Path(__file__).parents[3] / "replacement mods"
WOS = MODS / "hd2-wos-descent" / "9ba626afa44a3aa3.patch_0"  # made with hd2-audio-modder: a stale music_init
WARP = MODS.parent / "_examples" / "Warp Pack Plus 5 Sounds" / "9ba626afa44a3aa3.patch_0"  # new takes, louder containers
GUID = "0b7c3a52-60f4-4e8e-9d35-7c1f2b9e4a10"


def _zip(path, files: dict, manifest=None):
    with zipfile.ZipFile(path, "w") as z:
        for name, data in files.items():
            z.writestr(name, data)
        if manifest is not None:
            z.writestr(manifest[0], json.dumps(manifest[1]))
    return path


def test_a_mod_managers_zip_names_its_patches_by_their_options(tmp_path):
    files = {f"My Mod/{d}/9ba626afa44a3aa3.patch_0": b"x" for d in ("base", "voice/loud", "voice/soft")}
    files["My Mod/pic.png"] = b"png"
    manifest = {"Version": 1, "Guid": GUID, "Name": "Loud: Voices?", "Description": "Two takes.", "IconPath": "pic.png",
                "Options": [{"Name": "Base", "Include": ["base"]},
                            {"Name": "Voice", "SubOptions": [{"Name": "Loud", "Include": ["voice/loud"]},
                                                              {"Name": "Soft", "Include": ["voice\\soft"]}]}]}
    f = repatch.scan(_zip(tmp_path / "m.zip", files, ("My Mod/manifest.json", manifest)))
    assert f.is_zip and f.name == "Loud Voices" and f.description == "Two takes." and f.guid == GUID
    assert f.icon == "My Mod/pic.png" and f.read(f.icon) == b"png"
    assert [p.label for p in f.patches] == ["Base", "Voice / Loud", "Voice / Soft"]
    out = f.place(f.patches[1].key, tmp_path / "out")
    assert out.parent == tmp_path / "out" and out.read_bytes() == b"x"

    # no manifest: named after the ZIP, the patches after their folders; one patch alone has no label
    f = repatch.scan(_zip(tmp_path / "Plain Mod.zip", {"a/9ba626afa44a3aa3.patch_0": b"", "b/9ba626afa44a3aa3.patch_0": b""}))
    assert f.name == "Plain Mod" and not f.guid and [p.label for p in f.patches] == ["a", "b"]
    f = repatch.scan(_zip(tmp_path / "One.zip", {"deep/9ba626afa44a3aa3.patch_0": b"", "deep/9ba626afa44a3aa3.patch_0.stream": b""}))
    assert [p.label for p in f.patches] == [""]
    # one folder's patches are one part, in the order the game loads them
    stack = {f"9ba626afa44a3aa3.patch_{n}": b"" for n in (2, 0, 10, 1)} | {"tanks/9e430d763af434c1.patch_0": b"",
                                                                            "tanks/9ba626afa44a3aa3.patch_0": b""}
    f = repatch.scan(_zip(tmp_path / "Stacked.zip", stack))
    assert [(p.label, p.keys) for p in f.patches] == [
        ("", [f"9ba626afa44a3aa3.patch_{n}" for n in (0, 1, 2, 10)]),
        ("tanks", ["tanks/9ba626afa44a3aa3.patch_0", "tanks/9e430d763af434c1.patch_0"])]
    # a download's name, without what Nexus Mods added (from its site, from its app)
    for download, name in [("Apex Music-17608-1-0-1729430000", "Apex Music"),
                           ("Apex Music 17608 1.2 2026-10-20T12-46Z 3aPOjIbKe", "Apex Music"),
                           ("Pack-2-Remix", "Pack-2-Remix"), ("Warp Pack Plus 5 Sounds", "Warp Pack Plus 5 Sounds")]:
        assert repatch.scan(_zip(tmp_path / f"{download}.zip", {"9ba626afa44a3aa3.patch_0": b""})).name == name

    for bad, why in [(tmp_path / "none.zip", "holds no patch"), (tmp_path / "notes.txt", "isn't a mod"),
                     (tmp_path / "gone.zip", "wasn't found"), (tmp_path / "broken.zip", "can't be opened")]:
        if bad.name == "none.zip":
            _zip(bad, {"readme.txt": b"hi"})
        elif bad.suffix == ".txt" or bad.name == "broken.zip":
            bad.write_bytes(b"not a zip")
        with pytest.raises(repatch.RepatchError, match=why):
            repatch.scan(bad)


@pytest.fixture(scope="module")
def session():
    s = Session()
    s.wait_ready()
    return s


def _wait(s, job):
    while (j := s.job(job["id"]))["state"] == "running":
        time.sleep(0.2)
    return j


def _patch_of(zip_path, key, into: Path) -> Path:
    """A patch in a built ZIP (with its .stream), as files."""
    into.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path) as z:
        for s in ("", ".stream"):
            if key + s in z.namelist():
                (into / (Path(key).name + s)).write_bytes(z.read(key + s))
    return into / Path(key).name


def _object(banks, oid):
    return next(hirc[oid] for _, hirc in banks.values() if oid in hirc)


@pytest.mark.game
@pytest.mark.skipif(not (WOS.exists() and WARP.exists()), reason="the original WoS patch or the Warp Pack isn't here")
def test_an_old_mod_comes_back_on_the_current_game_as_it_was(session, tmp_path):
    s, ix = session, session.ix
    manifest = {"Version": 1, "Guid": GUID, "Name": "WoS", "Description": "Old.", "Options": [
        {"Name": "Descent", "Include": ["descent"], "Image": "pic.png"},
        {"Name": "Extras", "SubOptions": [{"Name": "Warp", "Include": ["extras/warp"]},
                                          {"Name": "Broken", "Include": ["extras/broken"]}]}]}
    files = {"WoS/descent/9ba626afa44a3aa3.patch_0": WOS.read_bytes(),
             "WoS/descent/9ba626afa44a3aa3.patch_0.stream": WOS.with_name(WOS.name + ".stream").read_bytes(),
             "WoS/extras/warp/9ba626afa44a3aa3.patch_0": WARP.read_bytes(),
             "WoS/extras/broken/9ba626afa44a3aa3.patch_0": b"not a patch",
             "WoS/pic.png": b"png", "WoS/readme.txt": b"hi"}
    mod = _zip(tmp_path / "wos.zip", files, ("WoS/manifest.json", manifest))
    seen = s.repatch_scan(str(mod))
    assert seen["name"] == "WoS" and seen["guid"] and seen["manifest"]
    assert [p["label"] for p in seen["patches"]] == ["Descent", "Extras / Broken", "Extras / Warp"]

    j = _wait(s, s.repatch(str(mod), "WoS Again", str(tmp_path / "out")))
    assert j["state"] == "done", j["error"]
    got = j["result"]
    assert got["kept_id"] and Path(got["zip"]) == tmp_path / "out" / "WoS Again.zip"
    assert [x.name for x in (tmp_path / "out").iterdir()] == ["WoS Again.zip"]  # the ZIP alone: no project stays
    descent, broken, warp = got["parts"]
    assert descent["imported"] > 0 and descent["settings"] == 1 and not descent["kept"]
    assert broken["kept"] and warp["added"] == 6 and warp["settings"] == 4
    assert all("other change" in x for x in warp["left"])  # what the game changed since the mod (positioning)
    # the Sounds the repatch adds are the mod's six, each with new audio: none the game had in the mod's day and
    # took out since (25988413 took 7 out of this bank, addition.older_version)
    warp_banks, _ = read_patch(str(_patch_of(got["zip"], "WoS/extras/warp/9ba626afa44a3aa3.patch_0", tmp_path / "w")))
    for bid, (media, hirc) in warp_banks.items():
        game = wbank.parse(ix.bank_files(bid)[0])[1]
        new = [body for i, (t, body) in hirc.items() if i not in game and t == wbank.SOUND]
        assert len(new) == 6 and not any(wbank.SOURCE.unpack_from(body, 0)[2] in ix.users for body in new)

    with zipfile.ZipFile(got["zip"]) as z:  # one mod, as it was: its manifest, options and files
        names = set(z.namelist())
        assert json.loads(z.read("WoS/manifest.json")) == dict(manifest, Name="WoS Again")
        assert z.read("WoS/readme.txt") == b"hi" and z.read("WoS/pic.png") == b"png"
        assert z.read("WoS/extras/broken/9ba626afa44a3aa3.patch_0") == b"not a patch"  # kept as it was
        assert {f"WoS/extras/warp/9ba626afa44a3aa3.patch_0{x}" for x in ("", ".stream", ".gpu_resources")} <= names
    banks, streams = read_patch(str(_patch_of(got["zip"], "WoS/descent/9ba626afa44a3aa3.patch_0", tmp_path / "d")))
    old_banks, old_streams = read_patch(str(WOS))
    for bid, (media, hirc) in banks.items():  # the game's banks of today, each object at least once
        assert set(wbank.parse(ix.bank_files(bid)[0])[1]) <= set(hirc)
    old_audio = set(old_streams.values()) | {m for media, _ in old_banks.values() for m in media.values()}
    assert streams and all(data in old_audio for data in streams.values())  # as the mod had it, not encoded again
    assert wbank.props(*_object(banks, 990527808)).get(5) == 6.0  # its Make-Up Gain, as the mod set it

    banks, _ = read_patch(str(_patch_of(got["zip"], "WoS/extras/warp/9ba626afa44a3aa3.patch_0", tmp_path / "w")))
    old, _ = read_patch(str(WARP))
    for oid in (372068234, 612810235, 618435854, 429412609):  # the mod's settings, on today's objects
        assert wbank.props(*_object(banks, oid)) == wbank.props(*_object(old, oid))

    j = _wait(s, s.repatch(str(mod), "", str(tmp_path / "out")))  # again: a ZIP beside the first, never over it
    assert j["state"] == "done" and Path(j["result"]["zip"]).name == "WoS.zip"
    j = _wait(s, s.repatch(str(mod), "", str(tmp_path / "out")))
    assert Path(j["result"]["zip"]).name == "WoS 2.zip"
    with pytest.raises(EditorError, match="name"):
        s.repatch(str(mod), "Bad: name", str(tmp_path / "out"))

    # a patch alone: an Arsenal ZIP of its own
    j = _wait(s, s.repatch(str(WARP), "Warp", str(tmp_path / "out")))
    assert j["state"] == "done", j["error"]
    assert not j["result"]["kept_id"] and Path(j["result"]["zip"]).name == "Warp.zip"
    with zipfile.ZipFile(j["result"]["zip"]) as z:
        m = json.loads(z.read("manifest.json"))
        assert m["Name"] == "Warp" and m["Guid"] != GUID and len(m["Options"]) == 1


TEXTURE, MODEL = 0xCD4238C6A0C69E32, 0xE0A48D0BE9A7453F  # types a mod's patch holds besides audio and text


def _others():
    """A model with GPU data, a texture with stream and GPU data, and a string table, as a mod's patch has them."""
    return [patch.Carried(7, MODEL, b"model" * 9, gpu=b"g" * 100, unknown=(2656768, 4220160, 16, 64)),
            patch.Carried(8, TEXTURE, b"tex", stream=b"s" * 33, gpu=b"t" * 70, unknown=(5, 6, 16, 64)),
            patch.Carried(9, STRINGS, b"a table, carried unread")]


def test_a_patch_carries_a_mods_other_files_as_they_were(tmp_path):
    path = str(tmp_path / "9ba626afa44a3aa3.patch_0")
    others = _others()
    late = patch.Carried(8, TEXTURE, b"later", gpu=b"L" * 5)  # the same id again: the later one goes in
    mine = patch.Carried(4, STRINGS, b"the project's own table wins")
    patch.write_patch(path, {1: b"stream" * 5}, {2: b"bank" * 8}, {2: b"dep"}, {4: b"own table"},
                      carried=[*others, late, mine])
    got = sorted(patch.carried_of(path), key=lambda c: c.fid)  # with the project's own table (4)
    assert got[0].data == b"own table" and got[1:] == [others[0], late, others[2]]
    assert patch.verify_carried(path, [*others, late, mine], {4: b""}) == []
    assert dict(patch._files(path, WWISE_BANK)) == {2: b"bank" * 8}  # the audio as written
    assert dict(patch._files(path, WWISE_STREAM)) == {1: b"stream" * 5}
    assert dict(patch._files(path, STRINGS)) == {4: b"own table", 9: b"a table, carried unread"}
    rows = Path(path).read_bytes()
    nt, nf = struct.unpack_from("<II", rows, 4)
    entries = [struct.unpack_from("<QQQQQQQIIIIII", rows, 72 + 32 * nt + 80 * i) for i in range(nf)]
    assert [e[1] for e in entries].count(STRINGS) == 2 and nt == len({e[1] for e in entries})  # one row a type
    assert all(e[4] % 64 == 0 for e in entries if e[9]) and all(e[3] % 64 == 0 for e in entries if e[8] and e[1] != WWISE_STREAM)
    patch.write_patch(path, {}, {2: b"bank"}, {})  # without carried files, no .gpu_resources stays
    assert not Path(path + ".gpu_resources").exists() and patch.carried_of(path) == []


@pytest.mark.game
@pytest.mark.skipif(not WARP.exists(), reason="the Warp Pack isn't here")
def test_a_repatch_keeps_what_a_patch_holds_besides_audio(session, tmp_path):
    mixed = tmp_path / "mod" / "9ba626afa44a3aa3.patch_0"
    mixed.parent.mkdir()
    others = _others()
    patch.write_patch(str(mixed), dict(patch._files(str(WARP), WWISE_STREAM)), dict(patch._files(str(WARP), WWISE_BANK)),
                      dict(patch._files(str(WARP), WWISE_DEP)), carried=others)
    seen = session.repatch_scan(str(mixed))
    assert seen["patches"][0]["others"] == ["1 string table", "2 other files, such as models or textures"]
    j = _wait(session, session.repatch(str(mixed), "Mixed", str(tmp_path / "out")))
    assert j["state"] == "done", j["error"]
    part = j["result"]["parts"][0]
    assert part["added"] == 6 and part["others"] == seen["patches"][0]["others"]
    assert all("other change" in x for x in part["left"])  # nothing about the other files: they went in
    with zipfile.ZipFile(j["result"]["zip"]) as z:
        key = next(n for n in z.namelist() if n.endswith(".patch_0"))
        out = tmp_path / "built"
        out.mkdir()
        for s in ("", ".stream", ".gpu_resources"):
            (out / ("9ba626afa44a3aa3.patch_0" + s)).write_bytes(z.read(key + s))
    built = str(out / "9ba626afa44a3aa3.patch_0")
    assert sorted(patch.carried_of(built), key=lambda c: c.fid) == others  # byte for byte
    assert read_patch(built)[0]  # and the banks, rebuilt


def test_a_mods_settings_go_on_the_games_objects():
    from audiodiver.project import Project
    body = bytes(18) + bytes([0, 0, 0, 0]) + bytes(4) + (7).to_bytes(4, "little") + bytes([0])
    body += bytes([2, 0, 5]) + struct.pack("<ff", -3.0, -2.0) + bytes(8)
    assert wbank.props(wbank.SOUND, body) == {0: -3.0, 5: -2.0}
    mod = wbank.with_props(wbank.SOUND, body, {5: 11.0, 0: None, 34: 0.3})
    assert wbank.props(wbank.SOUND, mod) == {5: 11.0, 34: pytest.approx(0.3)} and mod.endswith(bytes(8))
    assert wbank.prop_changes(wbank.SOUND, body, mod) == {5: 11.0, 34: pytest.approx(0.3), 0: None}
    p = Project("Mod", settings={372068234: {5: 12.0, 0: None}})
    assert Project.from_json(p.to_json()).settings == p.settings
    assert "settings" not in Project("Mod").to_json()


def test_repatched_mods_go_to_documents_by_default():
    assert repatch.documents().is_dir()


@pytest.mark.game
@pytest.mark.skipif(not WARP.exists(), reason="the Warp Pack isn't here")
def test_the_tools_work_without_numpy_and_pillow(tmp_path):
    """Audiodiver Utils leaves numpy and Pillow out of its core (release.py utils): Repatch and Combine, from the
    command line in a fresh process where neither can be imported."""
    import shutil
    import subprocess
    import sys
    other = tmp_path / "Other" / WARP.name
    other.parent.mkdir()
    shutil.copyfile(WARP, other)
    run = "import sys; sys.modules.update(numpy=None, PIL=None); from audiodiver.cli import main; main(sys.argv[1:])"
    for cmd in (["repatch", str(WARP)], ["combine", str(WARP), str(other)]):
        out = tmp_path / cmd[0]
        done = subprocess.run([sys.executable, "-c", run, *cmd, "--out", str(out), "--json"], capture_output=True,
                              text=True, encoding="utf-8", timeout=600)
        assert done.returncode == 0, done.stdout + done.stderr
        assert list(out.glob("*.zip")), done.stdout


@pytest.mark.game
def test_objects_as_an_older_game_version_had_them_are_not_the_mods(monkeypatch):
    """A mod's copy of an object exactly as an earlier game version had it (bank_history's fingerprints) is that
    version's, not a change of the mod's: not listed as an other change, and no settings taken from it. Here the
    history is made up from the mod's own copies of what the game changes, as the tool would record them."""
    from audiodiver import addition, patch
    from audiodiver.index import AudioIndex
    ix = AudioIndex()
    d = patch.diff(str(WARP), ix)
    before = addition.from_patch(ix, d)
    differs = {bid: {i: wbank.fingerprint(*b["read"][0][1][i]) for _, i in b["objects"] if i not in b["added"]}
               for bid, b in d["banks"].items()}
    if not any(differs.values()):
        pytest.skip("the mod's copies differ from this game version in nothing but what it adds")
    history = {bid: (old, new, {**changed, **{i: frozenset({f}) for i, f in differs.get(bid, {}).items()}})
               for bid, (old, new, changed) in addition.bank_history().items()}
    for bid in differs:
        history.setdefault(bid, (frozenset(), frozenset(), {i: frozenset({f}) for i, f in differs[bid].items()}))
    monkeypatch.setattr(addition, "bank_history", lambda: history)
    after = addition.from_patch(ix, d)
    assert not any("other change" in x for x in after.left) and not after.settings
    assert len(after.takes) == len(before.takes) and after.replaced == before.replaced  # the mod's own, as before
