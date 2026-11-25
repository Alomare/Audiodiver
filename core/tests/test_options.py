"""Mod Options (options.py): the model in the project file, resolve and capture, Combine, the editor's Editing switch,
and builds that hold choices. Unit tests need nothing; `game` tests read the installed game."""
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


def _project():
    p = Project(name="P", replacements=[Replacement(1, "a.wav", gain_db=2.0), Replacement(2, "b.wav")])
    p.gains[3] = 1.5
    p.options = [opts.Option("music", "Ship Music", choices=[
        opts.Choice("main", "Synthwave"),
        opts.Choice("orch", "Orchestral", slots={1: {"audio": "o.wav", "gain_db": -1.0}, 2: None, 4: {"audio": "n.wav", "label": "n",
                                                  "gain_db": 0.0, "fit_timing": True, "silence": False, "fade_in_ms": 0.0, "fade_out_ms": 0.0,
                                                  "start_ms": 0.0, "end_ms": 0.0, "delay_ms": 0.0, "blocks": []}},
                    cues={77: {"exit_marker": 900.0}})])]
    return p


def test_options_keep_in_the_project_file_and_damage_is_put_right():
    p = _project()
    q = Project.from_json(json.loads(json.dumps(p.to_json())))
    assert opts.to_json(q.options) == opts.to_json(p.options) and not q.repairs
    d = p.to_json()
    d["options"] += [{"id": "Bad Id", "name": "x", "choices": [{"id": "a", "name": "A"}]},
                     {"id": "vol", "name": "Volume", "choices": [{"id": "d", "name": "Default", "rules": [{"gain_db": 3}]},
                                                                 {"id": "up", "name": "Louder", "rules": [{"gain_db": 40}],
                                                                  "slots": {"5": {"gain_db": "x", "lowpass": 20}}}]}]
    q = Project.from_json(d)
    assert [o.id for o in q.options] == ["music", "vol"] and q.repairs
    vol = q.options[1]
    assert vol.choices[0].empty()  # the first choice is Main: it carries nothing
    assert vol.choices[1].rules[0].gain_db == 12.0 and vol.choices[1].slots == {5: {"lowpass": 20}}
    assert "options" not in Project(name="P").to_json()


def test_resolve_puts_a_choice_over_main_and_main_stays_as_it_was():
    p = _project()
    before = p.to_json()
    q = opts.resolve(p, {"music": "orch"})
    reps = {r.target: r for r in q.replacements}
    assert reps[1].audio == "o.wav" and reps[1].gain_db == -1.0  # the patch's keys stand in for Main's
    assert 2 not in reps and 4 in reps and reps[4].audio == "n.wav"  # None: the original; a slot only the choice replaces
    assert q.gains == {3: 1.5} and q.segment_overrides == {77: {"exit_marker": 900.0}}
    assert opts.resolve(p, {"music": "main"}).to_json() == before == p.to_json()
    with pytest.raises(RuntimeError):
        q.save("x.audi")  # a view is never saved


def test_rules_add_gain_or_give_the_original_back_on_items_or_the_whole_mod():
    p = _project()
    p.options = [opts.Option("v", "Volume", choices=[opts.Choice("d", "Default"), opts.Choice("up", "Louder", rules=[opts.Rule(3.0)]),
                                                     opts.Choice("item", "Item", rules=[opts.Rule(-2.0, items=["weapons"])]),
                                                     opts.Choice("off", "Off", rules=[opts.Rule(0.0, True, ["weapons"])])])]
    slots_of = lambda items: {2, 9}  # noqa: E731 - the item's sounds
    q = opts.resolve(p, {"v": "up"})
    assert {r.target: r.gain_db for r in q.replacements} == {1: 5.0, 2: 3.0} and q.gains == {3: 4.5}
    q = opts.resolve(p, {"v": "item"}, slots_of)
    assert {r.target: r.gain_db for r in q.replacements} == {1: 2.0, 2: -2.0} and q.gains == {3: 1.5, 9: -2.0}
    q = opts.resolve(p, {"v": "off"}, slots_of)
    assert [r.target for r in q.replacements] == [1]


def test_capture_keeps_only_what_differs_from_main():
    p = _project()
    view = opts.resolve(p, {"music": "orch"})
    next(r for r in view.replacements if r.target == 1).gain_db = 6.0
    view.filters[3] = [30, 0]
    c = opts.capture(p, "music", "orch", view)
    assert c.slots[1] == {"audio": "o.wav", "gain_db": 6.0} and c.slots[2] is None and c.slots[3] == {"lowpass": 30}
    # taken back to Main's: no patch left
    view = opts.resolve(p, {"music": "orch"})
    r1 = next(r for r in view.replacements if r.target == 1)
    r1.audio, r1.gain_db = "a.wav", 2.0
    view.replacements.append(Replacement(2, "b.wav"))
    view.replacements = [r for r in view.replacements if r.target != 4]
    view.segment_overrides.clear()
    view.filters.pop(3)  # the filter the first capture kept
    assert opts.capture(p, "music", "orch", view).empty()


def test_combine_makes_a_choice_for_every_pair():
    p = _project()
    p.options.append(opts.Option("vol", "Volume", choices=[opts.Choice("d", "Default"), opts.Choice("up", "Louder", rules=[opts.Rule(3.0)]),
                                                           opts.Choice("down", "Quieter", rules=[opts.Rule(-3.0)])]))
    o = opts.combine(p.options, "music", "vol")
    assert [x.id for x in p.options] == ["music"] and len(o.choices) == 6 and o.choices[0].empty()
    pair = next(c for c in o.choices if c.name == "Orchestral · Louder")
    assert pair.rules[0].gain_db == 3.0 and pair.slots[1]["audio"] == "o.wav"


# --- the editor
def _session(tmp_path):
    s = Session(load=False)
    s.new_project(tmp_path / "m.audi", "M")
    a, b = _wav(tmp_path / "a.wav"), _wav(tmp_path / "b.wav")
    s._edit("assign", lambda p: s._set(p, 1234, str(a)))
    return s, a, b


def test_the_editing_switch_puts_edits_into_the_choice_and_main_keeps_its_own(tmp_path):
    s, a, b = _session(tmp_path)
    st = s.option_add("blank")
    oid = st["added"][0]
    second = st["options"][0]["choices"][1]["id"]
    st = s.option_editing(oid, second)
    assert st["editing"]["choice"] == second
    s._edit("assign", lambda p: s._set(p, 5678, str(b)))  # a slot only the choice replaces
    st = s.update(1234, gain_db=4)
    assert st["assignments"]["5678"]["name"] == "b.wav" and st["assignments"]["1234"]["gain_db"] == 4
    assert set(st["choice_slots"]) == {"1234", "5678"} and st["choice_slots"]["1234"]["main"]["gain_db"] == 0
    saved = json.loads((tmp_path / "m.audi").read_text())
    assert [r["target"] for r in saved["replacements"]] == ["1234"] and saved["replacements"][0]["gain_db"] == 0
    assert saved["options"][0]["choices"][1]["slots"]["1234"] == {"gain_db": 4.0}
    with pytest.raises(EditorError, match="Main"):
        s._edit("add take", lambda p: None)
    st = s.choice_slots([1234], "main")  # back to Main there
    assert st["assignments"]["1234"]["gain_db"] == 0 and set(st["choice_slots"]) == {"5678"}
    st = s.option_editing()  # Main again
    assert "5678" not in st["assignments"] and st["editing"] is None
    st = s.undo()  # the choice's slot comes back; the undo doesn't change what is edited
    assert st["options"][0]["choices"][1]["slots"] == 2


def test_an_undo_that_takes_the_choice_away_goes_back_to_main(tmp_path):
    s, _, b = _session(tmp_path)
    oid = s.option_add("blank")["added"][0]
    cid = s.choice_add(oid, "Third")["added"]
    s.option_editing(oid, cid)
    s.undo()
    assert s.project_state()["editing"] is None


def test_option_and_choice_edits_are_checked(tmp_path):
    s, _, _ = _session(tmp_path)
    oid = s.option_add("volume")["added"][0]
    st = s.option_set(oid, name="Loudness", description="How loud")
    o = st["options"][0]
    assert o["name"] == "Loudness" and [c["name"] for c in o["choices"]] == ["Default", "Louder", "Quieter"]
    with pytest.raises(EditorError):
        s.option_set(oid, name="x" * 61)
    with pytest.raises(EditorError):
        s.choice_remove(oid, o["choices"][0]["id"])
    with pytest.raises(EditorError):
        s.choice_set(oid, o["choices"][0]["id"], rules=[{"gain_db": 3}])
    with pytest.raises(EditorError):
        s.choice_set(oid, o["choices"][1]["id"], rules=[{"gain_db": 20}])
    st = s.choice_move(oid, o["choices"][2]["id"], 0)  # the first stays Main
    assert [c["name"] for c in st["options"][0]["choices"]] == ["Default", "Quieter", "Louder"]
    two = s.option_add("blank")["added"][0]
    st = s.options_combine(oid, two)
    assert len(st["options"]) == 1 and len(st["options"][0]["choices"]) == 6
    st = s.option_remove(st["options"][0]["id"])
    assert st["options"] == []


def test_files_a_choice_uses_count_as_the_project_files(tmp_path):
    from audiodiver import projectfiles as pf
    s, a, b = _session(tmp_path)
    oid = s.option_add("blank")["added"][0]
    s.option_editing(oid, s.project.options[0].choices[1].id)
    s._edit("assign", lambda p: s._set(p, 1234, str(b)))
    d = s.project.to_json()
    assert pf.norm(b) in pf.uses(d, tmp_path)
    moved = pf.rebase(d, tmp_path, tmp_path / "sub")
    assert moved["options"][0]["choices"][1]["slots"]["1234"]["audio"] == "../b.wav"
    b.unlink()
    assert any("b.wav" in t for t in s.project_state()["problems"])


# --- builds with choices
@pytest.fixture(scope="module")
def game_session():
    s = Session()
    s.wait_ready()
    return s


@pytest.mark.game
def test_a_choice_ships_only_what_differs_from_main(game_session, tmp_path):
    """Main replaces two sounds of different banks. Louder (+3 dB on every slot) changes both banks; Quiet One puts
    one sound back to the original. Each choice's folder holds only what differs from Main, the game's bank where
    the choice puts the original back, and the manifest lists Main first, then the option, its default deploying
    nothing."""
    from audiodiver.build import PATCH
    from audiodiver.game import WWISE_BANK
    from audiodiver import patch
    s = game_session
    s.new_project(tmp_path / "o.audi", "Options Test")
    cue = s.cue(716451767)
    order = list(dict.fromkeys(sl["source"] for seg in cue["segments_detail"] for st in seg["stems"] for sl in st["slots"]))
    a = order[0]
    s.assign(a, str(_wav(tmp_path / "a.wav", level=800)))
    oid = s.option_add("volume")["added"][0]
    s.choice_add(oid, "Quiet One")
    cid = s.project.options[0].choices[3].id
    s.option_editing(oid, cid)
    s.choice_slots([a], "original")
    s.option_editing()
    job = s.build(bump=False)
    while s.job(job["id"])["state"] == "running":
        import time
        time.sleep(0.3)
    done = s.job(job["id"])
    assert done["state"] == "done", done
    with zipfile.ZipFile(done["result"]["zip"]) as z:
        m = json.loads(z.read("manifest.json"))
        names = z.namelist()
        assert [o["Name"] for o in m["Options"]] == ["Options Test", "Volume"]
        subs = m["Options"][1]["SubOptions"]
        assert [x["Name"] for x in subs] == ["Default", "Louder", "Quieter", "Quiet One"] and subs[0]["Include"] == []
        assert m["Options"][1]["Include"] == [] and all(x["Include"] for x in subs[1:])
        for sub in subs[1:]:
            assert f"{sub['Include'][0]}/{PATCH}" in names
        quiet = tmp_path / "quiet.patch"
        quiet.write_bytes(z.read(f"{subs[3]['Include'][0]}/{PATCH}"))
    # the choice that puts the original back holds the game's banks of that sound, as they are
    ix = s.ix
    for bid, data in patch._files(str(quiet), WWISE_BANK):
        assert data == ix.bank_files(bid)[0]
