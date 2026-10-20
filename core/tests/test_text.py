"""The game's text (strings.py): reading tables, changing lines in a project, and building them into the patch."""
import zipfile

import pytest

from audiodiver import strings
from audiodiver.build import build
from audiodiver.editor import Session
from audiodiver.game import toc_entries

SUBTITLES = "2060271984843282606"  # US English


def test_a_table_round_trips_and_lines_read_without_their_markup():
    t = strings.Table(0x03F97B57, {5: "{0.00->1.00}Hi", 9: "", 12: "<c=FFFFE900>Démocratie</c>"})
    assert strings.parse(strings.serialize(t)) == t
    assert strings.plain("{0.00->1.20}Hello <c=FFFFE900>there</c>{1.30->2.00} friend") == "Hello there friend"
    assert strings.kind_of(t) == "subtitles" or strings.kind_of(t) == "text"


@pytest.fixture(scope="module")
def session():
    s = Session()
    s.wait_ready()
    return s


@pytest.mark.game
def test_a_voice_line_opens_its_subtitle_and_those_with_the_same_words(session):
    s = session
    one = next(r for r in s.text_search("us", "reloading", limit=5000)["results"] if strings.plain(r["text"]) == "Reloading.")
    alike = s.text_alike(one["id"])
    assert alike[0] == one["id"] and len(alike) > 10 and len(set(alike)) == len(alike)
    assert all(strings.plain(r["text"]).lower().strip(".!") == "reloading" for r in s.text_search("us", ids=alike)["results"])
    got = s.text_search("us", "anything at all", ids=alike[:3][::-1])  # the ids, in their order, whatever the query
    assert [r["id"] for r in got["results"]] == alike[:3][::-1] and got["total"] == 3
    with pytest.raises(Exception):
        s.text_alike(12345)
    # and back: the recordings that say a subtitle, in the voices of the language asked for (English where it has none)
    said = s.text_voices(alike, "us")
    assert said and all(v["cue"].startswith("bank:") and v["subtitle"] in map(str, alike) for v in said)
    assert {v["name"].split(" · ")[0] for v in said} >= {"Helldiver Voice 1", "Helldiver Voice 2"}
    assert all(v["name"].endswith("English") for v in said)
    assert any(v["source"] == p["source"] for v in said for p in s.find(v["source"]) if p["cue"] == v["cue"])
    assert [v["name"] for v in s.text_voices(alike, "gb")] == [v["name"] for v in said]  # no UK voices: the US ones
    if "Italian" in s.lib.voice_languages:
        it = s.text_voices(alike, "it")
        assert it and all(v["name"].endswith("Italian") for v in it)
    assert s.text_voices([12345], "us") == []


@pytest.mark.game
def test_lines_are_found_changed_undone_and_built_whole(session, tmp_path):
    s = session
    assert s.text_languages()[0] == {"code": "us", "name": "English (US)"}
    hit = s.text_search("us", "defeat is but the catalyst")["results"][0]
    assert hit["table"] == SUBTITLES and hit["kind"] == "subtitles" and "yours" not in hit
    s.new_project(tmp_path / "t.audi", "Text")
    mine = hit["text"].replace("catalyst", "<c=FFFFE900>catalyst</c>")
    st = s.text_set(hit["table"], hit["id"], mine)
    assert st["texts"] == [{"table": SUBTITLES, "id": hit["id"], "text": mine, "was": hit["text"]}]
    assert s.text_search("us", mine=True)["results"][0]["yours"] == mine
    assert s.undo()["texts"] == [] and s.redo()["texts"][0]["text"] == mine
    assert s.text_set(hit["table"], hit["id"], hit["text"])["texts"] == []  # the game's text again: not the project's
    s.text_set(hit["table"], hit["id"], mine)

    zip_path = build(s.project, s.ix, tmp_path / "out", log=lambda *_: None)
    with zipfile.ZipFile(zip_path) as z:
        patch = next(z.read(n) for n in z.namelist() if n.endswith(".patch_0"))
    tables = [e for e in toc_entries(patch) if e[1] == strings.STRINGS]
    assert [e[0] for e in tables] == [int(SUBTITLES)]  # the one table, whole
    _fid, _tid, off, size, *_ = tables[0]
    built, live = strings.parse(patch[off:off + size]).texts, s._texts().table(int(SUBTITLES)).texts
    assert built[hit["id"]] == mine
    assert {k: v for k, v in built.items() if k != hit["id"]} == {k: v for k, v in live.items() if k != hit["id"]}
