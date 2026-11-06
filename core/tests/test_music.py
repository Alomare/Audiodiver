"""The Music view (musiclist.py) and skipping transitions, against the installed game."""
import re

import pytest

from audiodiver.editor import Session

pytestmark = pytest.mark.game


@pytest.fixture(scope="module")
def session():
    s = Session()
    s.wait_ready()
    return s


def items(s):
    return {i["id"]: i for sec in s.music()["sections"] for i in sec["items"]}


def test_every_replaceable_cue_has_a_place(session):
    ml = session.catalog.music
    assert [c for c, cue in session.catalog.cm.cues.items() if ml.targets(cue) and c not in ml.cue_item] == []


def test_sections_follow_a_mission(session):
    ids = [s["id"] for s in session.music()["sections"]]
    assert ids[:2] == ["ship", "deploy"]
    assert {"terminids", "hive-worlds", "automatons", "illuminate"} <= set(ids)
    assert ids.index("extraction") < ids.index("after") < ids.index("credits")


def test_the_main_moments_are_named_and_complete(session):
    it = items(session)
    assert len(it["deploy/loadout"]["targets"]) == 15
    assert it["credits/credits"]["parts"][0]["cue"] == "274818547"
    assert "objectives/flag" not in it  # 7.2.2 took the anthem out: its sound, and the flag-raise state's own music
    assert {f"terminids/{r}" for r in ("arrival", "exploring", "battle", "intense", "respawn", "death")} <= set(it)
    assert not [i["name"] for i in it.values() if re.search(r"\d{6,}", i["name"])]  # nothing named by a bare id


def test_the_title_screen_and_the_squad_jump_have_a_place_on_the_ship(session, tmp_path):
    """Players' reports: stream 2724847495560933971 plays during the FTL jump on joining or leaving a squad, and
    7486365861729135686 (the intro) then 4325589761797325839 (the loop) while the game stays on the title screen. A
    project that listed either piece while it was not identified yet finds it under the new name."""
    it, ix, cat = items(session), session.ix, session.catalog
    ship = [i["id"] for sec in session.music()["sections"] if sec["id"] == "ship" for i in sec["items"]]
    assert ship[0] == "ship/title" and ship.index("ship/squad") == ship.index("ship/ftl") + 1
    squad, title_ = it["ship/squad"], it["ship/title"]
    assert [p["cue"] for p in squad["parts"]] == ["522993376"] and [p["cue"] for p in title_["parts"]] == ["913964047"]
    assert squad["targets"] == [str(ix.by_stream[2724847495560933971])]
    assert title_["targets"] == [str(ix.by_stream[f]) for f in (7486365861729135686, 4325589761797325839)]
    segs = cat.cue(913964047)["segments_detail"]
    assert [s["name"] for s in segs] == ["Intro", "Loop"] and [s["loop"] for s in segs] == [1, 0]
    names = {e["id"]: (e["path"], e["name"]) for e in session.cues()}
    assert names["913964047"] == (["Menu"], "Title Screen") and names["522993376"] == (["Ship"], "Joining or Leaving a Squad")
    from audiodiver.project import Project
    Project(name="Old", path=tmp_path / "o.audi", library=["unknown/913964047", "unknown/522993376"]).save()
    st = session.open_project(tmp_path / "o.audi")
    assert st["library"] == ["ship/title", "ship/squad"] and st["library_missing"] == []


def test_transitions_are_named_by_what_they_connect(session):
    it = items(session)
    hellpod = it["deploy/hellpod-in"]
    assert hellpod["kind"] == "transition"
    assert hellpod["parts"][0]["name"] == "Bridge and War Map → Drop Location Selection or Loadout Selection"
    assert "Battle → Exploring #1" in [p["name"] for p in it["terminids/transitions"]["parts"]]
    assert {"item": "deploy/hellpod-in", "cue": hellpod["parts"][0]["cue"], "way": "in"} in it["deploy/loadout"]["around"]


def test_all_cues_view_uses_the_music_names(session):
    names = {e["id"]: e["name"] for e in session.cues()}
    assert names["948868724"] == "Terminid Exploring · Idle"
    assert names["606955718"] == "Stepping Into the Hellpod"


def test_skip_silences_only_what_no_music_plays(session, tmp_path):
    from audiodiver.audio import silence_wav
    from audiodiver.build import encode_cached
    from audiodiver.patch import Replacement
    it = items(session)
    session.new_project(tmp_path / "s.audi", "S")
    part = it["deploy/hellpod-in"]["parts"][0]
    st = session.skip(part["own"])
    a = st["assignments"][part["own"][0]]
    assert a["silence"] and a["fit_timing"] and a["name"] == "Silence" and st["undo_label"] == "skip"
    wem = encode_cached(silence_wav())
    assert 90 < Replacement(0, wem).length_ms < 110
    # the silence plays through: fitted, the transition is over in a tenth of a second
    first = int(part["cue"])
    assert session.play_through(first, side="mine")["duration_ms"] < session.play_through(first, side="game")["duration_ms"]
    # the Terminid transition into Death is the start of the Death music: nothing in it can be skipped alone
    into_death = next(p for p in it["terminids/transitions"]["parts"] if p["name"] == "Exploring → Death")
    assert into_death["targets"] and into_death["own"] == []


def test_the_notes_on_clips_land_where_they_belong(session):
    """data/notes.json (geoffreyhdt1's notes): every clip is in this game, the Void and Cyborgs exploring music is
    named, the Void's own death music is in the game files but in no cue, each minimum length is shorter than the
    game's audio, and the ship's Ready sounds are named."""
    import json
    from importlib import resources
    cat, ix = session.catalog, session.catalog.cm.ix
    groups = json.loads(resources.files("audiodiver").joinpath("data", "notes.json").read_text(encoding="utf-8"))["groups"]
    ids = [int(i) for g in groups for i in g["ids"]]
    assert [i for i in ids if i not in ix.stream_of and not ix.holders.get(i) and i not in ix.orphans] == []
    never = [int(i) for g in groups if g.get("tag") == "never plays" for i in g["ids"]]
    assert len(never) == 3 and not any(cat.cm.by_source.get(i) for i in never)
    it = items(session)
    labels = lambda iid: {sl["label"] for p in it[iid]["parts"] for sg in cat.cue(int(p["cue"]))["segments_detail"]
                          for st in sg["stems"] for sl in st["slots"]}
    assert {"Stealth", "Calm", "Stinger Out of Nowhere"} <= labels("illuminate-rifts/exploring")
    assert {"Stealth", "Calm", "Downtime Music"} <= labels("automatons-2/exploring")
    for g in groups:
        for i in g["ids"] if "min_ms" in g else []:
            assert cat.music.source_ms[int(i)] > g["min_ms"]
    ship = session.lib.view("bank:12110229567385836952")
    assert {"Ready 1", "Ready 2", "Ready 3"} <= {g["name"] for g in ship["segments_detail"]}
