"""Combining mods (combine.py, Session.combine_read and Session.combine): a mod's options and the patches they
deploy, what HD2 Arsenal recorded as chosen, the clashes between mods and who wins them, and a combined mod built
from three synthetic mods on the game."""
import json
import shutil
import time
import zipfile
from pathlib import Path

import pytest

from audiodiver import addition, combine as cb, installed, patch, repatch
from audiodiver import bank as wbank
from audiodiver.editor import EditorError, Session

ARCHIVE = "9ba626afa44a3aa3.patch_0"
MANIFEST = {"Version": 1, "Guid": "0b7c3a52-60f4-4e8e-9d35-7c1f2b9e4a10", "Name": "Voices", "Description": "Two.",
            "Options": [{"Name": "Base", "Include": ["base"]},
                        {"Name": "Voices", "SubOptions": [{"Name": "Loud", "Include": ["voices/loud"]},
                                                          {"Name": "Soft", "Include": ["voices\\soft"]}]},
                        {"Name": "Extra", "Include": ["extra"]}]}


def _zip(path, files: dict, manifest=None):
    with zipfile.ZipFile(path, "w") as z:
        for name, data in files.items():
            z.writestr(name, data)
        if manifest is not None:
            z.writestr("Voices/manifest.json", json.dumps(manifest))
    return path


def test_a_mods_options_and_the_patches_a_choice_deploys(tmp_path):
    files = {f"Voices/{d}/{ARCHIVE}": b"x" for d in ("base", "voices/loud", "voices/soft", "extra", "unlisted")}
    files["Voices/base/9ba626afa44a3aa3.patch_1"] = b"x"
    f = repatch.scan(_zip(tmp_path / "v.zip", files, MANIFEST))
    opts = cb.options(f.manifest)
    assert cb.shown(opts) == [{"id": "0", "name": "Base", "sub": []},
                              {"id": "1", "name": "Voices", "sub": [{"id": "1.0", "name": "Loud"}, {"id": "1.1", "name": "Soft"}]},
                              {"id": "2", "name": "Extra", "sub": []}]
    assert cb.default_picks(opts) == ["0", "1.0", "2"]
    # in the manifest's order, each folder's patches in load order; a folder no option names isn't deployed
    assert cb.parts(f, opts, ["0", "1.1", "2"]) == [f"Voices/base/{ARCHIVE}", "Voices/base/9ba626afa44a3aa3.patch_1",
                                                    f"Voices/voices/soft/{ARCHIVE}", f"Voices/extra/{ARCHIVE}"]
    assert cb.parts(f, opts, ["1"]) == [f"Voices/voices/loud/{ARCHIVE}"]  # an Option's own id: its first SubOption
    assert cb.parts(f, opts, ["2", "nothing"]) == [f"Voices/extra/{ARCHIVE}"]
    assert cb.labels(opts, ["0", "1.1"]) == ["Base", "Voices / Soft"]
    # as Arsenal deploys: only what is right in a folder, a folder named twice counts at its later place, and with
    # every option off the mod's own folder
    deep = {f"Voices/{d}{ARCHIVE}": b"x" for d in ("", "base/", "base/old/", "extra/")}
    twice = {**MANIFEST, "Options": [{"Name": "A", "Include": ["base"]}, {"Name": "B", "Include": ["extra"]},
                                     {"Name": "C", "Include": ["base"]}]}
    g = repatch.scan(_zip(tmp_path / "deep.zip", deep, twice))
    g_opts = cb.options(g.manifest)
    assert cb.parts(g, g_opts, ["0", "1", "2"]) == [f"Voices/extra/{ARCHIVE}", f"Voices/base/{ARCHIVE}"]
    assert cb.parts(g, g_opts, ["0"]) == [f"Voices/base/{ARCHIVE}"]
    assert cb.parts(g, g_opts, []) == [f"Voices/{ARCHIVE}"]
    # without a manifest: every patch, in load order, as one part
    plain = repatch.scan(_zip(tmp_path / "Plain.zip", {f"b/{ARCHIVE}": b"", "a/9ba626afa44a3aa3.patch_1": b""}))
    assert cb.options(plain.manifest) == [] and cb.parts(plain, [], []) == [f"b/{ARCHIVE}", "a/9ba626afa44a3aa3.patch_1"]

    got = Session(load=False).combine_scan(str(tmp_path / "v.zip"))
    assert (got["name"], got["manifest"], got["picks"]) == ("Voices", True, ["0", "1.0", "2"])
    assert got["options"] == cb.shown(opts) and got["other"] == [] and got["description"] == "Two."
    with pytest.raises(EditorError, match="wasn't found"):
        Session(load=False).combine_scan(str(tmp_path / "gone.zip"))


def test_what_arsenal_recorded_as_chosen_is_the_start(tmp_path, monkeypatch):
    opts = cb.options(MANIFEST)
    # the shapes the entry can take (Arsenal doesn't publish its format)
    assert cb.arsenal_picks({"options": [{"name": "Base", "enabled": False},
                                         {"name": "Voices", "enabled": True, "subOptions": [
                                             {"name": "Loud", "selected": False}, {"name": "Soft", "selected": True}]},
                                         {"name": "Extra", "enabled": True}]}, opts) == ["1.1", "2"]
    assert cb.arsenal_picks({"selectedOptions": ["Voices / Soft", "Base"]}, opts) == ["0", "1.1"]
    assert cb.arsenal_picks({"options": {"Base": True, "Voices": "Loud", "Extra": False}}, opts) == ["0", "1.0"]
    assert cb.arsenal_picks({"label": "Voices", "path": "x"}, opts) is None
    # read for a mod of Arsenal's library, by its folder
    mod = tmp_path / "lib" / "Voices"
    for d in ("base", "voices/loud", "voices/soft", "extra"):
        (mod / d).mkdir(parents=True)
        (mod / d / ARCHIVE).write_bytes(b"x")
    (mod / "manifest.json").write_text(json.dumps(MANIFEST))
    data = tmp_path / "hd2a_data.json"
    data.write_text(json.dumps({"modsLibrary": [{"label": "Voices", "path": str(mod), "options": {"Extra": False}}]}))
    monkeypatch.setattr(installed, "ARSENAL_DATA", data)
    s = Session(load=False)
    assert s.combine_scan(str(mod))["picks"] == ["0", "1.0"]
    assert s.combine_installed() == {"mods": [{"name": "Voices", "source": str(mod), "deployed": False}], "arsenal": True}
    # as Arsenal 0.37 writes it: the library lists the manifest's options, the deployed profile what was chosen
    listed = [{"name": "Base", "enabled": True}, {"name": "Voices", "enabled": True, "suboptions": [
        {"name": "Loud", "enabled": True}, {"name": "Soft", "enabled": False}]}, {"name": "Extra", "enabled": True}]
    picked = [{"name": "Base", "enabled": False}, {"name": "Voices", "enabled": True, "suboptions": [
        {"name": "Loud", "enabled": False}, {"name": "Soft", "enabled": True}]}, {"name": "Extra", "enabled": True}]
    data.write_text(json.dumps({"deployedProfile": "p2", "selectedProfile": "default",
                                "modsLibrary": [{"uuid": "u1", "label": "Voices", "path": str(mod), "options": listed}],
                                "modsList": {"default": {"mods": [{"uuid": "u1", "optionsConfig": listed}]},
                                             "p2": {"mods": [{"uuid": "u1", "enabled": True, "optionsConfig": picked}]}}}))
    assert s.combine_scan(str(mod))["picks"] == ["1.1", "2"]


def test_clashes_are_where_mods_differ_and_the_later_wins():
    a, b, c = cb.Effect(), cb.Effect(), cb.Effect()
    a.replaced = {1: (0, "aa"), 2: (0, "same"), 3: (0, "x")}
    b.replaced = {1: (0, "bb"), 2: (0, "same")}  # 2: the same audio in another file, no clash
    c.replaced = {1: (1, "cc")}
    a.own, b.own = {50: (0, 900, "p"), 51: (0, 901, "q")}, {50: (0, 902, "r"), 51: (0, 903, "q")}
    a.settings = {70: {5: (0, 3.0), 0: (0, -1.0)}, 80: {5: (0, 2.0)}}
    b.settings = {70: {5: (0, -2.0), 0: (0, -1.0)}, 80: {5: (0, 6.0)}, 81: {1: (0, 4.0)}}
    plays = lambda objects: {80: [1], 70: [99]}  # 80 plays clip 1, which clashes: its settings go with it
    found, follows = cb.clashes([a, b, c], plays)
    assert [(x["id"], x["mods"]) for x in found] == [("sound:1", [0, 1, 2]), ("clip:50", [0, 1]), ("set:70:5", [0, 1])]
    assert follows == {80: "sound:1"}
    won = cb.winners(found, {"sound:1": 0, "set:70:5": 7, "clip:50": True})  # a mod without a version: the default
    assert won == {"sound:1": 0, "clip:50": 1, "set:70:5": 1}
    clips, own, settings, by = cb.outcome([a, b, c], found, follows, won)
    assert clips == {1: (0, 0), 2: (1, 0), 3: (0, 0)} and own == {50: (1, 0), 51: (1, 0)}
    assert settings == {70: {5: -2.0, 0: -1.0}, 80: {5: 2.0}, 81: {1: 4.0}}  # 80's from clip 1's winner
    assert by == {70: {0, 1}, 80: {0}, 81: {1}}
    assert cb.description([("A", ["Base", "Voices / Soft"]), ("B", [])]) == \
        "Combined from these mods:\n- A (Base, Voices / Soft)\n- B"


# --- with the game
HIVE = "content/audio/obj_bug_destroy_hive_lung"  # a small bank whose clips and containers no other bank has


@pytest.fixture(scope="module")
def session():
    s = Session()
    s.wait_ready()
    return s


def _wait(s, job):
    while (j := s.job(job["id"]))["state"] == "running":
        time.sleep(0.2)
    return j


def _pieces(s):
    """(bank, the container new takes go into, the container that gets a setting, six clips of the bank's own that
    the latter doesn't play: four to replace, two whose audio stands in for new audio)."""
    from audiodiver.game import murmur64_hash
    ix = s.ix
    bid = murmur64_hash(HIVE.encode())
    if bid not in ix.banks:
        pytest.skip(f"{HIVE} isn't in this game version")
    _, h = wbank.parse(ix.bank_files(bid)[0])
    parent = {o: addition.parent_of(t, b) for o, (t, b) in h.items() if t == wbank.SOUND and addition.is_audio(b)}
    clip = {o: wbank.SOURCE.unpack_from(h[o][1], 0)[2] for o in parent}
    boxes = [o for o, (t, _) in sorted(h.items()) if t == addition.RANSEQ and ix.copies(o) == [bid]
             and sum(p == o for p in parent.values()) >= 2 and not addition.take_problem(ix, o)]
    if len(boxes) < 2:
        pytest.skip(f"{HIVE} has changed")
    takes_in, set_on = boxes[:2]
    below = set(s._plays({set_on})[set_on])
    clips = sorted({clip[o] for o in parent if clip[o] not in below and ix.holders.get(clip[o]) == {bid}
                    and ix.users.get(clip[o], {bid}) <= {bid} and ix.stream_file(clip[o]) is None})
    if len(clips) < 6:
        pytest.skip(f"{HIVE} has changed")
    return bid, takes_in, set_on, clips[:6]


def _mod(ix, path, replaced: dict, takes=(), settings=None):
    """A patch that replaces clips, adds takes and sets settings, as a mod's tool would write it."""
    reps = [patch.Replacement(sid, wem, fit_timing=False) for sid, wem in replaced.items()]
    plan = addition.plan(ix, [addition.Take(*t) for t in takes], [], []) if takes else None
    path.parent.mkdir(parents=True, exist_ok=True)
    patch.build_patch(str(path), reps, ix, plan=plan, settings=settings)
    return path


@pytest.mark.game
def test_combined_mods_keep_every_take_and_the_winners(session, tmp_path):
    s, ix = session, session.ix
    bid, takes_in, set_on, (x, z, y, w, one, two) = _pieces(s)
    a1, a2 = ix.wem(one), ix.wem(two)
    sound, clip = addition.new_id(ix.taken), addition.new_id(ix.taken)  # the same ids in both mods' takes
    mod_a = _mod(ix, tmp_path / "A" / ARCHIVE, {x: a1, z: a2}, [(takes_in, sound, clip, a1)], {set_on: {5: 3.0}})
    mod_b = _mod(ix, tmp_path / "B" / ARCHIVE, {x: a2, z: a2}, [(takes_in, sound, clip, a2)], {set_on: {5: -2.0}})
    files = {}
    for folder, reps in (("base", {y: a1}), ("voices/loud", {w: a1}), ("voices/soft", {w: a2}), ("extra", {})):
        if reps:
            made = _mod(ix, tmp_path / "C" / folder / ARCHIVE, reps)
            files[f"Voices/{folder}/{ARCHIVE}"] = made.read_bytes()
    mod_c = _zip(tmp_path / "Voices.zip", files, {**MANIFEST, "Options": MANIFEST["Options"][:2]})
    mods = [{"source": str(mod_a), "picks": []}, {"source": str(mod_b), "picks": []},
            {"source": str(mod_c), "picks": ["0", "1.1"]}]

    j = _wait(s, s.combine_read(mods))
    assert j["state"] == "done", j["error"]
    got = j["result"]
    assert [m["sounds"] for m in got["mods"]] == [3, 3, 2] and not any(m["left"] for m in got["mods"])
    clashes = {c["id"]: c for g in got["groups"] for c in g["clashes"]}
    assert set(clashes) == {f"sound:{x}", f"set:{set_on}:5"}  # z: the same audio from both, no clash
    sx = clashes[f"sound:{x}"]
    assert sx["kind"] == "sound" and sx["source"] == str(x) and sx["label"] and sx["winner"] == 1
    assert [v["mod"] for v in sx["versions"]] == [0, 1] and all(Path(v["audio"]).is_file() and v["ms"] for v in sx["versions"])
    assert [v["value"] for v in clashes[f"set:{set_on}:5"]["versions"]] == [3.0, -2.0]
    assert all(g["name"] for g in got["groups"])
    again = time.time()
    assert _wait(s, s.combine_read(mods[::-1]))["state"] == "done" and time.time() - again < 30  # read once, kept

    j = _wait(s, s.combine(mods, {f"sound:{x}": 0}, "Combined test", str(tmp_path / "out")))
    assert j["state"] == "done", j["error"]
    made = j["result"]
    home = tmp_path / "out" / "Combined test"
    assert Path(made["project"]) == home / "Combined test.audi" and Path(made["zip"]).parent == home / "build"
    assert [(m["imported"], m["added"]) for m in made["mods"]] == [(1, 1), (1, 1), (2, 0)]
    assert made["mods"][0]["settings"] == 0 and made["mods"][1]["settings"] == 1
    wavs = sorted(f.relative_to(home / "audio" / "imported").parent.name for f in (home / "audio" / "imported").rglob("*.wav"))
    assert len(wavs) == 6  # what wins, and the takes: mod B's audio for x stays out
    p = json.loads(Path(made["project"]).read_text())
    assert "Voices / Soft" in p["description"] and p["version"] == 2 and len(p["additions"]) == 2

    with zipfile.ZipFile(made["zip"]) as zf:
        key = next(n for n in zf.namelist() if n.endswith(ARCHIVE))
        (tmp_path / "built").mkdir()
        (tmp_path / "built" / ARCHIVE).write_bytes(zf.read(key))
        if key + ".stream" in zf.namelist():
            (tmp_path / "built" / (ARCHIVE + ".stream")).write_bytes(zf.read(key + ".stream"))
    banks, _ = patch.read_patch(str(tmp_path / "built" / ARCHIVE))
    media, hirc = banks[bid]
    assert media[x] == a1 and media[z] == a2 and media[y] == a1 and media[w] == a2  # x: mod A, as chosen; w: Soft
    assert wbank.props(*hirc[set_on])[5] == -2.0  # the setting's default winner, the later mod
    _, game = wbank.parse(ix.bank_files(bid)[0])
    new = [o for o, (t, b) in hirc.items() if o not in game and t == wbank.SOUND and addition.parent_of(t, b) == takes_in]
    assert len(new) == 2  # both mods' takes
    with pytest.raises(EditorError, match="name"):
        s.combine(mods, None, "Bad: name", str(tmp_path / "out"))
    shutil.rmtree(home, ignore_errors=True)
