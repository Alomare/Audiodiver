"""Mods of an older game version: their older copies of what many banks share (addition.from_patch, base_differs),
the check of the installed mods (installed.py), and builds that say when the game updated since (Project.built_for,
editor._game_updated)."""
import json
import shutil
import struct
import time
import zipfile
from pathlib import Path
from types import SimpleNamespace

import pytest

from audiodiver import addition, installed, patch
from audiodiver import bank as wbank
from audiodiver.editor import Session, _game_updated
from audiodiver.project import Project

MODS = Path(__file__).parents[3] / "replacement mods"
WARP = MODS.parent / "_examples" / "Warp Pack Plus 5 Sounds" / "9ba626afa44a3aa3.patch_0"  # made before 25988413
CYCLOPS = MODS / "hd2-exo-cyclops" / "mod" / "Cyclops Exosuit Voice" / "9ba626afa44a3aa3.patch_0"
WEAPONS_MIXER = 0x26CF0E53  # an actor-mixer every weapon bank has; 25988413 changed it
# rebuilt on 25988413's banks with its settings of before carried over: a random container 110 banks have keeps the
# Priority 75 and prop 57 of -50 it had, and lacks the prop 30 the update added
ODST = MODS.parent / "_examples" / "FROM NEXUS" / "ODST Warbond SFX 9352 1.1.4 2026-10-21T11-07Z tlwx5cdqD.zip"
SHARED_CONTAINER = 0x23976CBA
AMBIENCE = ODST.with_name("Enhanced Ambience SFX 13943 1.2 2026-10-21T16-34Z Zdo1YygAr.zip")
MERGED_ACTION = 0x1D45782B  # a Play action in 12 ambience banks


def _rest(parent=7):
    """A node's base params up to its prop bundle: no effects, no metadata effects, the bus, the parent, bits."""
    return bytes([0, 0, 0, 0]) + bytes(4) + parent.to_bytes(4, "little") + bytes([0])


def test_a_sound_that_plays_a_plugin_has_its_settings_after_the_plugins_parameters():
    tone = struct.pack("<IBIIIB", 0x830402, 0, 1, 0, 0, 0) + struct.pack("<I", 4) + b"parm"
    body = tone + _rest() + bytes([1, 5]) + struct.pack("<f", -3.0) + bytes(8)
    assert wbank.sound_base(body) == 26 and wbank.props(wbank.SOUND, body) == {5: -3.0}
    assert addition.parent_of(wbank.SOUND, body) == 7
    assert bytes(wbank.with_props(wbank.SOUND, body, {})) == body
    clip = bytes(18) + _rest() + bytes([0]) + bytes(8)
    clip = struct.pack("<I", 0x40001) + clip[4:]
    assert wbank.sound_base(clip) == 18 and wbank.props(wbank.SOUND, clip) == {}


def test_builds_say_when_the_game_updated_since():
    last = {"zip": "m-3.zip", "mb": 1.0, "modified": 1000}
    steam = lambda build, updated=2000: SimpleNamespace(version=str(build), steam={"build": build, "updated": updated})
    assert _game_updated(Project("M", built_for="25988413"), steam(25988414), last)
    assert not _game_updated(Project("M", built_for="25988413"), steam(25988413), last)
    assert not _game_updated(Project("M", built_for="25988413"), steam(25480438), last)  # this computer is behind
    assert not _game_updated(Project("M", built_for="25988413"), steam(25988414), None)  # no build to speak of
    files = SimpleNamespace(version="files-0badf00d", steam={})
    assert _game_updated(Project("M", built_for="files-12345678"), files, last)
    # a project built before builds were noted: its ZIP against Steam's last update
    assert _game_updated(Project("M"), steam(25988413, updated=2000), last)
    assert not _game_updated(Project("M"), steam(25988413, updated=500), last)
    assert not _game_updated(Project("M"), files, last)
    p = Project("M", built_for="25988413")
    assert Project.from_json(p.to_json()).built_for == "25988413" and "built_for" not in Project("M").to_json()


@pytest.fixture(scope="module")
def ix():
    from audiodiver.index import AudioIndex
    return AudioIndex()


@pytest.mark.game
def test_a_mixers_settings_alone_are_the_mods_and_other_base_params_an_older_versions(ix):
    _, hirc = wbank.parse(ix.bank_files(ix.copies(WEAPONS_MIXER)[0])[0])
    t, body = hirc[WEAPONS_MIXER]
    louder = bytes(wbank.with_props(t, body, {5: -8.0}))
    assert not addition.base_differs(t, body, louder) and not addition.base_differs(t, body, body)
    end = addition.base_end(t, body)
    other = body[:end - 1] + bytes([body[end - 1] ^ 1]) + body[end:]  # the last byte of its base params
    assert addition.base_differs(t, body, other)


@pytest.mark.game
def test_a_copys_mix_and_the_settings_it_lacks_are_an_older_versions(ix):
    _, hirc = wbank.parse(ix.bank_files(ix.copies(SHARED_CONTAINER)[0])[0])
    t, body = hirc[SHARED_CONTAINER]
    as_was = bytes(wbank.with_props(t, body, {6: 75.0, 57: -50.0, 30: None}))
    assert addition.older_settings(t, body, as_was) and not addition.base_differs(t, body, as_was)
    assert addition.older_settings(t, body, bytes(wbank.with_props(t, body, {30: None})))
    assert addition.older_settings(t, body, bytes(wbank.with_props(t, body, {6: 50.0})))  # Priority is the game's
    louder = bytes(wbank.with_props(t, body, {5: 3.0, 0: -2.0, 1: 200.0}))
    assert not addition.older_settings(t, body, louder) and not addition.older_settings(t, body, body)


@pytest.mark.game
@pytest.mark.skipif(not ODST.exists(), reason="the ODST Warbond SFX download isn't here")
def test_a_mod_rebuilt_with_its_old_settings_shows_up_and_they_arent_taken(ix, tmp_path):
    with zipfile.ZipFile(ODST) as z:
        (made := tmp_path / "fd3eef9a0329b2c2.patch_0").write_bytes(z.read("MA5C/fd3eef9a0329b2c2.patch_0"))
    got = installed.check_patch(made, ix)
    assert got["state"] == installed.SHARED and got["reach"] >= 100 and got["weapons"] > 50
    found = addition.from_patch(ix, patch.diff(str(made), ix))
    assert SHARED_CONTAINER in found.older and SHARED_CONTAINER not in found.settings
    assert found.settings and all(k in wbank.MIX_PROPS for s in found.settings.values() for k in s)


@pytest.mark.game
@pytest.mark.skipif(not AMBIENCE.exists(), reason="the Enhanced Ambience SFX download isn't here")
def test_another_banks_copy_written_by_a_merging_tool_isnt_the_mods(ix, tmp_path):
    """The mod's tool wrote env_sandy's copy of a Play action (each bank's names that bank) into the other biomes'
    banks: not a change of the mod's. Its Make-Up Gain on the ambience containers is."""
    with zipfile.ZipFile(AMBIENCE) as z:
        (made := tmp_path / "9ba626afa44a3aa3.patch_0").write_bytes(
            z.read("Enhanced Ambience SFX/Enhanced Ambience sfx/9ba626afa44a3aa3.patch_0"))
    found = addition.from_patch(ix, patch.diff(str(made), ix))
    assert MERGED_ACTION in found.merged and MERGED_ACTION not in found.settings
    assert found.settings[0x2EF8D576] == {0x05: 10.0}


@pytest.mark.game
@pytest.mark.skipif(not CYCLOPS.exists(), reason="the Cyclops mod isn't here")
def test_an_old_mods_copies_of_shared_mixers_and_the_settings_the_game_added_since_arent_the_mods(ix):
    got = addition.from_patch(ix, patch.diff(str(CYCLOPS), ix))
    assert WEAPONS_MIXER in got.older and WEAPONS_MIXER not in got.settings
    assert not any(v is None for s in got.settings.values() for v in s.values())
    assert not any(ix.copies(o) and len(ix.copies(o)) > 50 for o in got.settings)


@pytest.mark.game
@pytest.mark.skipif(not WARP.exists(), reason="the Warp Pack isn't here")
def test_an_old_mod_shows_up_and_its_repatch_doesnt(ix, tmp_path):
    old = installed.check_patch(WARP, ix)
    assert old["state"] == installed.SHARED and old["reach"] > 50 and old["weapons"] > 0
    s = Session()
    s.wait_ready()
    j = s.repatch(str(WARP), "Warp", str(tmp_path / "out"))
    while (j := s.job(j["id"]))["state"] == "running":
        time.sleep(0.2)
    assert j["state"] == "done", j["error"]
    with zipfile.ZipFile(j["result"]["zip"]) as z:
        key = next(n for n in z.namelist() if n.endswith(".patch_0"))
        made = tmp_path / "made.patch_0"
        made.write_bytes(z.read(key))
        if key + ".stream" in z.namelist():
            Path(f"{made}.stream").write_bytes(z.read(key + ".stream"))
    assert installed.check_patch(made, ix) == {"state": installed.CURRENT, "objects": 0, "reach": 0, "weapons": 0}


@pytest.mark.game
@pytest.mark.skipif(not WARP.exists(), reason="the Warp Pack isn't here")
def test_the_installed_mods_are_listed_once_each_worst_first(ix, tmp_path):
    data, lib = tmp_path / "data", tmp_path / "mods"
    (lib / "Warp").mkdir(parents=True)
    (lib / "Scopes").mkdir()
    data.mkdir()
    for to in (lib / "Warp" / WARP.name, data / "9ba626afa44a3aa3.patch_3"):  # in Arsenal's library and deployed
        shutil.copyfile(WARP, to)
    (lib / "Scopes" / "9ba626afa44a3aa3.patch_0").write_bytes(struct.pack("<III", 0xF0000011, 0, 0) + bytes(60))
    (data / "9ba626afa44a3aa3.patch_4").write_bytes(b"not a patch")
    arsenal = tmp_path / "hd2a_data.json"
    arsenal.write_text(json.dumps({"modsLibrary": [{"label": "Warp Pack", "path": str(lib / "Warp")},
                                                   {"label": "Scopes", "path": str(lib / "Scopes")},
                                                   {"label": "Gone", "path": str(lib / "Gone")}]}))
    assert [n for n, _ in installed.arsenal_mods(arsenal)] == ["Warp Pack", "Scopes"]
    assert installed.arsenal_mods(tmp_path / "none.json") == []

    got = installed.check(ix, data, arsenal)
    assert got["arsenal"] and got["quiet"] == 1  # the scopes have no sound banks
    warp, broken = got["mods"]
    assert (warp["name"], warp["where"], warp["deployed"], warp["state"]) == ("Warp Pack", "arsenal", True, installed.SHARED)
    assert Path(warp["source"]) == lib / "Warp"
    assert (broken["name"], broken["where"], broken["state"]) == ("9ba626afa44a3aa3.patch_4", "game", installed.UNREADABLE)
