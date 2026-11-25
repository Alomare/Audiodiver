"""Options for Players (options.py): groups and options in the project file, resolve and capture, the Audio tab's
pickers, and builds that hold groups. Unit tests need nothing; `game` tests read the installed game."""
import json
import wave
import zipfile

import pytest

from audiodiver import options as opts
from audiodiver.editor import EditorError, Session
from audiodiver.project import Project, Replacement


def _wav(path, seconds=0.2, level=0):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(48000)
        w.writeframes(int(level).to_bytes(2, "little", signed=True) * int(48000 * seconds))
    return path


NEW = {"audio": "n.wav", "label": "n", "gain_db": 0.0, "fit_timing": True, "silence": False, "fade_in_ms": 0.0,
       "fade_out_ms": 0.0, "start_ms": 0.0, "end_ms": 0.0, "delay_ms": 0.0, "blocks": []}


def _project():
    """The base mod replaces 1 and 2 and sets a gain on 3. Liberator Fire has 1 and 4 (two options), Volume is gains."""
    p = Project(name="P", replacements=[Replacement(1, "a.wav", gain_db=2.0), Replacement(2, "b.wav")])
    p.gains[3] = 1.5
    p.groups = [opts.Group("fire", "Liberator Fire", options=[
        opts.Option("one", "1", slots={1: {"audio": "o.wav", "gain_db": -1.0}, 4: dict(NEW)}, cues={77: {"exit_marker": 900.0}}),
        opts.Option("two", "2", slots={1: None})]),
        opts.Group("vol", "Volume", options=[opts.Option("up", "Louder", gain_db=3.0), opts.Option("down", "Quieter", gain_db=-3.0)])]
    return p


def test_groups_keep_in_the_project_file_and_damage_is_put_right():
    p = _project()
    p.groups[0].image, p.groups[0].options[0].image = "art/fire.png", "art/one.png"
    q = Project.from_json(json.loads(json.dumps(p.to_json())))
    assert opts.to_json(q.groups) == opts.to_json(p.groups) and not q.repairs
    d = p.to_json()
    d["groups"] += [{"id": "Bad Id", "name": "x", "options": [{"id": "a", "name": "A"}]},
                    {"id": "more", "name": "More", "options": [
                        {"id": "off", "name": "Off"},  # Obsidian's id for a group off
                        {"id": "x", "name": "X", "gain_db": 40, "slots": {"1": {"gain_db": 3}, "5": {"gain_db": "x", "lowpass": 20}}}]}]
    q = Project.from_json(d)
    assert [g.id for g in q.groups] == ["fire", "vol", "more"] and q.repairs
    [x] = q.groups[2].options
    assert x.gain_db == 12.0 and x.slots == {5: {"lowpass": 20}}, "slot 1 is Liberator Fire's: one group a slot"
    assert "groups" not in Project(name="P").to_json()


def test_resolve_plays_the_base_mod_with_each_picked_option():
    p = _project()
    before = p.to_json()
    assert opts.resolve(p, {}).to_json() == before  # every group off: the base mod
    q = opts.resolve(p, {"fire": "one"})
    reps = {r.target: r for r in q.replacements}
    assert reps[1].audio == "o.wav" and reps[1].gain_db == -1.0  # the patch's keys stand in for the base mod's
    assert reps[4].audio == "n.wav" and q.segment_overrides == {77: {"exit_marker": 900.0}}
    assert 1 not in {r.target for r in opts.resolve(p, {"fire": "two"}).replacements}  # None: the game's sound
    q = opts.resolve(p, {"vol": "up"})  # a gain on what the base mod changes, but Liberator Fire's slots
    assert {r.target: r.gain_db for r in q.replacements} == {1: 2.0, 2: 3.0} and q.gains == {3: 4.5}
    assert p.to_json() == before
    with pytest.raises(RuntimeError):
        q.save("x.audi")  # a view is never saved


def test_capture_puts_each_slot_where_it_belongs():
    p = _project()
    picks = {"fire": "one", "vol": "up"}
    was = opts.resolve(p, picks)
    view = opts.resolve(p, picks)
    next(r for r in view.replacements if r.target == 1).gain_db = 6.0  # Liberator Fire's slot: into option one
    next(r for r in view.replacements if r.target == 2).gain_db = 5.0  # the base mod's, seen 3 dB louder
    view.filters[9] = [30, 0]  # no group has it: where new slots go
    with pytest.raises(opts.OptionError, match="Choose where"):
        opts.capture(p, picks, None, was, view)
    grown = opts.capture(p, picks, "fire", was, view)
    one = p.groups[0].options[0]
    assert one.slots[1] == {"audio": "o.wav", "gain_db": 6.0} and one.slots[9] == {"lowpass": 30} and grown == {"fire"}
    assert one.slots[2] == {"gain_db": 2.0}, "no group had it: into Liberator Fire, the Volume option's gain taken off"
    assert next(r for r in p.replacements if r.target == 2).gain_db == 0.0
    # into the base mod; and a slot of a group that is off can't change
    p = _project()
    was, view = opts.resolve(p, {"vol": "down"}), opts.resolve(p, {"vol": "down"})
    view.replacements.append(Replacement(8, "c.wav"))
    assert opts.capture(p, {"vol": "down"}, opts.BASE, was, view) == set()
    assert any(r.target == 8 for r in p.replacements)
    view = opts.resolve(p, {"vol": "down"})
    view.gains[4] = 2.0
    with pytest.raises(opts.OptionError, match="Liberator Fire"):
        opts.capture(p, {"vol": "down"}, opts.BASE, opts.resolve(p, {"vol": "down"}), view)
    # taken back to the base mod's: the patch goes
    p = _project()
    was, view = opts.resolve(p, {"fire": "one"}), opts.resolve(p, {"fire": "one"})
    r1 = next(r for r in view.replacements if r.target == 1)
    r1.audio, r1.gain_db = "a.wav", 2.0
    opts.capture(p, {"fire": "one"}, "fire", was, view)
    assert 1 not in p.groups[0].options[0].slots


def test_combos_list_every_set_of_picks_with_the_groups_off_first():
    p = _project()
    assert opts.combos(p.groups, ["fire", "vol"])[:2] == [{}, {"vol": "up"}]
    assert len(opts.combos(p.groups, ["fire", "vol"])) == 9


# --- the editor
def _session(tmp_path):
    s = Session(load=False)
    s.new_project(tmp_path / "m.audi", "M")
    a, b = _wav(tmp_path / "a.wav"), _wav(tmp_path / "b.wav")
    s._edit("assign", lambda p: s._set(p, 1234, str(a)))
    return s, a, b


def test_the_pickers_send_edits_to_the_picked_option_and_the_base_mod_keeps_its_own(tmp_path):
    s, a, b = _session(tmp_path)
    gid = s.group_add("Liberator Fire")["added"]
    st = s.option_pick(gid, "option_1")
    assert st["picks"] == {gid: "option_1"} and st["target"] == gid, "one group picked: new slots go there"
    s._edit("assign", lambda p: s._set(p, 5678, str(b)))  # a slot only the option replaces
    st = s.update(1234, gain_db=4)
    assert st["assignments"]["5678"]["name"] == "b.wav" and st["assignments"]["1234"]["gain_db"] == 4
    assert set(st["option_slots"]) == {"1234", "5678"} and st["option_slots"]["1234"]["base"]["gain_db"] == 0
    saved = json.loads((tmp_path / "m.audi").read_text())
    assert [r["target"] for r in saved["replacements"]] == ["1234"] and saved["replacements"][0]["gain_db"] == 0
    assert saved["groups"][0]["options"][0]["slots"]["1234"] == {"gain_db": 4.0}
    with pytest.raises(EditorError, match="base mod"):
        s._edit("add take", lambda p: None)
    st = s.option_slots_off([1234])  # back to the base mod's there
    assert st["assignments"]["1234"]["gain_db"] == 0 and set(st["option_slots"]) == {"5678"}
    st = s.option_pick()  # back to the base mod
    assert "5678" not in st["assignments"] and st["picks"] == {} and st["target"] == ""
    assert st["option_slots"]["5678"] == {"group": gid, "option": None, "on": False, "base": None}
    vol = s.group_add("Volume")["added"]
    st = s.option_pick(vol, "option_1")  # one pick at a time: Liberator Fire is off now
    assert st["picks"] == {vol: "option_1"} and st["target"] == vol
    with pytest.raises(EditorError, match="Liberator Fire"):  # the group's slot, with the group off
        s._edit("gain", lambda p: p.gains.__setitem__(5678, 2.0))
    s._edit("assign", lambda p: s._set(p, 4321, str(b)))  # a new slot: into the group picked
    assert s.project_state()["option_slots"]["4321"]["group"] == vol


def test_an_undo_that_takes_the_group_away_turns_its_picker_off(tmp_path):
    s, _, _ = _session(tmp_path)
    gid = s.group_add()["added"]
    s.option_pick(gid, "option_1")
    s.undo()
    assert s.project_state()["picks"] == {}


def test_group_and_option_edits_are_checked(tmp_path):
    s, a, _ = _session(tmp_path)
    gid = s.group_add()["added"]
    st = s.group_set(gid, name="Loudness", description="How loud")
    assert st["groups"][0]["name"] == "Loudness" and [o["name"] for o in st["groups"][0]["options"]] == ["Option 1"]
    with pytest.raises(EditorError):
        s.group_set(gid, name="x" * 61)
    with pytest.raises(EditorError):
        s.option_set(gid, "option_1", gain_db=20)
    with pytest.raises(EditorError):
        s.group_set(gid, image=str(a))  # not an image
    off = s.option_add(gid, "Off")["added"]
    assert off != "off", "Obsidian's id for a group off"
    st = s.option_move(gid, off, 0)
    assert [o["name"] for o in st["groups"][0]["options"]] == ["Off", "Option 1"]
    s.option_remove(gid, off)
    st = s.option_remove(gid, "option_1")  # the last option: the group goes too
    assert st["groups"] == []


def test_files_and_images_of_the_options_count_as_the_project_files(tmp_path):
    from PIL import Image
    from audiodiver import projectfiles as pf
    s, a, b = _session(tmp_path)
    img = tmp_path / "fire.png"
    Image.new("RGB", (64, 32), "red").save(img)
    gid = s.group_add()["added"]
    s.group_set(gid, image=str(img))
    assert len(s.option_image(gid)) > 1000  # fitted to 540x540
    s.option_pick(gid, "option_1")
    s._edit("assign", lambda p: s._set(p, 1234, str(b)))
    d = s.project.to_json()
    assert pf.norm(b) in pf.uses(d, tmp_path) and pf.norm(img) in pf.uses(d, tmp_path)
    moved = pf.rebase(d, tmp_path, tmp_path / "sub")
    assert moved["groups"][0]["options"][0]["slots"]["1234"]["audio"] == "../b.wav"
    assert moved["groups"][0]["image"] == "../fire.png"
    b.unlink()
    img.unlink()
    problems = s.project_state()["problems"]
    assert any("b.wav" in t for t in problems) and any("fire.png" in t for t in problems)


# --- builds with groups
@pytest.fixture(scope="module")
def game_session():
    s = Session()
    s.wait_ready()
    return s


@pytest.mark.game
def test_an_option_ships_only_what_differs_from_the_base_mod(game_session, tmp_path):
    """The base mod replaces two sounds. A group has Louder (+3 dB on the base mod's slots but the group's: their
    bank), Vanilla (the first sound as the game has it) and Same (nothing). Each option's folder holds only what differs from the base mod, the
    game's bank where the option gives the original back; the group deploys nothing unticked."""
    from audiodiver.build import PATCH
    from audiodiver.game import WWISE_BANK
    from audiodiver import patch
    from PIL import Image
    s = game_session
    s.new_project(tmp_path / "o.audi", "Options Test")
    cue = s.cue(716451767)
    order = list(dict.fromkeys(sl["source"] for seg in cue["segments_detail"] for st in seg["stems"] for sl in st["slots"]))
    a = order[0]
    s.assign(a, str(_wav(tmp_path / "a.wav", level=800)))
    s.assign(order[1], str(_wav(tmp_path / "b.wav", level=800)))  # the base mod's alone: Louder reaches it
    gid = s.group_add("Music")["added"]
    s.option_set(gid, "option_1", name="Louder", gain_db=3)
    Image.new("RGB", (64, 64), "blue").save(tmp_path / "v.png")
    vanilla = s.option_add(gid, "Vanilla")["added"]
    s.option_set(gid, vanilla, image=str(tmp_path / "v.png"))
    s.option_add(gid, "Same")
    s.option_pick(gid, vanilla)
    s.unassign([a])
    s.option_pick(gid)
    job = s.build(bump=False)
    while s.job(job["id"])["state"] == "running":
        import time
        time.sleep(0.3)
    done = s.job(job["id"])
    assert done["state"] == "done", done
    with zipfile.ZipFile(done["result"]["zip"]) as z:
        m = json.loads(z.read("manifest.json"))
        names = z.namelist()
        assert [o["Name"] for o in m["Options"]] == ["Options Test", "Music"]
        subs = m["Options"][1]["SubOptions"]
        assert [x["Name"] for x in subs] == ["Louder", "Vanilla", "Same"] and m["Options"][1]["Include"] == []
        assert subs[0]["Include"] and subs[1]["Include"] and subs[2]["Include"] == []
        assert subs[1]["Image"] in names and subs[0]["Image"] == "icon.png"
        for sub in subs[:2]:
            assert f"{sub['Include'][0]}/{PATCH}" in names
        main = tmp_path / "main.patch"
        main.write_bytes(z.read(f"{m['Options'][0]['Include'][0]}/{PATCH}"))
        vanilla = tmp_path / "vanilla.patch"
        vanilla.write_bytes(z.read(f"{subs[1]['Include'][0]}/{PATCH}"))
    # Vanilla holds the first sound's bank again, without that sound: never the base mod's bank
    ours = dict(patch._files(str(main), WWISE_BANK))
    got = dict(patch._files(str(vanilla), WWISE_BANK))
    assert got and all(data != ours.get(bid) for bid, data in got.items())
