"""The Text tab's categories, and lines going out to a file and back."""
import csv
import json
from types import SimpleNamespace

import pytest

from audiodiver import textsort
from audiodiver.editor import EditorError, Session
from audiodiver.project import Project

SUBS, ARSENAL, UNKNOWN, FR_SUBS, FR_ARSENAL = 1, 8968223446113782149, 5, 11, 12
US = {
    SUBS: {10: "{0.00->1.00}Reloading.", 20: "{0.00->1.00}Hold the line!", 30: "{0.00->1.00}Nobody says this."},
    ARSENAL: {40: "AR-23 LIBERATOR", 41: "HOVER PACK", 42: "Helps prevent flinching when hit.", 43: "NOT YET IMPLEMENTED",
              44: "#VALUE RPM", 45: "Fires #COUNT rounds at #TARGET, and it does so very quickly indeed."},
    UNKNOWN: {50: "A new table"},
}
FR = {FR_SUBS: {10: "{0.00->1.00}Rechargement.", 20: "{0.00->1.00}Tenez bon !"}, FR_ARSENAL: {40: "AR-23 LIBÉRATEUR", 41: "JETPACK"}}


class FakeTexts:
    def __init__(self):
        self.all = {**{f: ("us", t) for f, t in US.items()}, **{f: ("fr", t) for f, t in FR.items()}}

    def tables(self, code=None):
        return [(f, SimpleNamespace(texts=t, code=c)) for f, (c, t) in self.all.items() if code is None or c == code]

    def table(self, fid):
        return SimpleNamespace(texts=self.all[fid][1])

    def kind(self, fid):
        return "subtitles" if fid in (SUBS, FR_SUBS) else "text"

    def languages(self):
        return ["us", "fr"]


class FakeLibrary:
    order = {"set:helldivers/voices/helldiver-voice-1": 0, "set:allies/civilians/seaf-voices": 1}
    items = {"set:helldivers/voices/helldiver-voice-1": {"name": "Helldiver Voice 1"}, "set:allies/civilians/seaf-voices": {"name": "SEAF Voices"}}
    subtitles = {100: (10, True), 101: (10, True), 200: (20, True)}
    clip_subtitles = {}
    ix = SimpleNamespace(copies=lambda oid: [oid], users={}, holders={})
    homes = {100: "set:allies/civilians/seaf-voices", 101: "set:helldivers/voices/helldiver-voice-1", 200: "set:allies/civilians/seaf-voices"}

    def _bank_home(self, bid):
        return self.homes[bid]


@pytest.fixture
def s(tmp_path, monkeypatch):
    session = Session(load=False)
    session.stage = "ready"
    session.texts, session.lib = FakeTexts(), FakeLibrary()
    monkeypatch.setattr(session, "_texts", lambda: session.texts)
    session.project = Project(name="t", path=tmp_path / "t.audi")
    return session


def test_a_subtitle_goes_by_the_voice_that_says_it_and_the_first_of_several(s):
    sort = s._text_sort()
    assert sort[10] == ("voices", "set:helldivers/voices/helldiver-voice-1", "set:helldivers/voices/helldiver-voice-1")
    assert sort[20][:2] == ("people", "set:allies/civilians/seaf-voices")
    assert sort[30] == ("unmatched", "subtitles", None)


@pytest.mark.parametrize("line, section", [(40, "designations"), (41, "names"), (42, "sentences"), (43, "unfinished"), (44, "fills"), (45, "sentences")])
def test_other_lines_go_by_their_table_and_their_shape(s, line, section):
    assert s._text_sort()[line] == ("arsenal", section, None)


def test_a_table_nothing_names_is_other_text(s):
    assert s._text_sort()[50][0] == "other"


def test_every_table_of_the_game_is_named():
    """A name the sort uses has a place in the lists."""
    assert {c for c, _ in textsort.TABLES.values()} <= set(textsort.CATEGORIES)
    assert {x for _, x in textsort.TABLES.values() if x} <= set(textsort.SECTIONS)
    assert set(textsort.VOICES.values()) <= set(textsort.CATEGORIES)


def test_every_line_shows_with_no_words_typed_and_groups_in_order(s):
    got = s.text_lines("us")
    assert len(got["lines"]) == sum(map(len, US.values()))
    assert [g["id"] for g in got["groups"]] == ["voices", "people", "unmatched", "arsenal", "other"]
    arsenal = next(g for g in got["groups"] if g["id"] == "arsenal")
    assert [x["id"] for x in arsenal["sections"]] == ["names", "designations", "sentences", "fills", "unfinished"]


def test_a_language_sorts_as_english_does_and_shows_the_reference(s):
    got = s.text_lines("fr", reference="us")
    line = next(x for x in got["lines"] if x["id"] == 40)
    assert (line["cat"], line["sec"], line["ref"]) == ("arsenal", "designations", "AR-23 LIBERATOR")


def test_a_search_finds_the_words_and_the_id(s):
    assert [x["id"] for x in s.text_lines("us", "hold line")["lines"]] == [20]
    assert [x["id"] for x in s.text_lines("us", "41")["lines"]] == [41]


def test_a_csv_opens_as_utf8_in_a_spreadsheet_and_has_every_column(s, tmp_path):
    s.project.texts.clear()
    s.text_apply([{"table": FR_ARSENAL, "id": 41, "text": "RÉACTEUR"}])
    out = tmp_path / "x" / "lines.csv"
    assert s.text_export(str(out), "fr", ids=[41, 10], reference="us")["lines"] == 2
    assert out.read_bytes()[:3] == b"\xef\xbb\xbf"
    rows = list(csv.DictReader(out.read_text(encoding="utf-8-sig").splitlines()))
    assert rows[0] == {"Language": "fr", "ID": "41", "Table": str(FR_ARSENAL), "Category": "Arsenal", "Speaker": "", "Original": "JETPACK",
                       "New text": "RÉACTEUR", "Reference (us)": "HOVER PACK"}
    assert rows[1]["Speaker"] == "Helldiver Voice 1" and rows[1]["New text"] == ""


def test_lines_come_back_from_a_file_as_one_undo_step_after_a_preview(s, tmp_path):
    out = tmp_path / "lines.csv"
    s.text_export(str(out), "fr")
    text = out.read_text(encoding="utf-8-sig").replace(",JETPACK,", ",JETPACK,RÉACTEUR").replace(",{0.00->1.00}Tenez bon !,", ",{0.00->1.00}Tenez bon !,Ça tient")
    # a spreadsheet saves it with semicolons in many countries
    rows = list(csv.reader(text.splitlines()))
    with open(out, "w", encoding="utf-8-sig", newline="") as f:
        csv.writer(f, delimiter=";").writerows(rows)
    got = s.text_import(str(out))
    assert not s.project.texts, "a preview changes nothing"
    by_id = {c["id"]: c for c in got["changes"]}
    assert set(by_id) == {41, 20} and got["unknown"] == 0
    assert by_id[20]["lost"] == ["{0.00->0.00}"], "the timing went missing"
    s.text_apply([{"table": c["table"], "id": c["id"], "text": c["after"]} for c in got["changes"]])
    assert {t.id for t in s.project.texts} == {41, 20}
    s.undo()
    assert not s.project.texts, "one step"


def test_an_import_counts_what_it_cant_place_and_what_the_game_changed(s, tmp_path):
    out = tmp_path / "lines.json"
    out.write_text(json.dumps({"lines": [
        {"Language": "fr", "ID": 41, "New text": "A", "Original": "OLD WORDS"}, {"Language": "fr", "ID": 999, "New text": "B"},
        {"Language": "xx", "ID": 41, "New text": "C"}, {"Language": "fr", "ID": 40, "New text": ""},
        {"Language": "fr", "ID": 40, "New text": "AR-23 LIBÉRATEUR"}]}), encoding="utf-8")
    got = s.text_import(str(out))
    assert ([c["id"] for c in got["changes"]], got["unknown"], got["stale"], got["empty"], got["same"]) == ([41], 2, 1, 1, 1)


def test_a_file_that_isnt_an_export_is_refused(s, tmp_path):
    out = tmp_path / "other.csv"
    out.write_text("a,b\n1,2\n", encoding="utf-8")
    with pytest.raises(EditorError, match="Language, ID and New text"):
        s.text_import(str(out))


def test_replacing_words_leaves_timing_markup_and_fills_alone():
    text = "{1.10->2.10}<c=FF112233>Eagle #EAGLE</c> eagle"
    assert textsort.replaced(text, "eagle", "Falcon") == "{1.10->2.10}<c=FF112233>Falcon #EAGLE</c> Falcon"
    assert textsort.replaced(text, "eagle", "Falcon", case=True) == "{1.10->2.10}<c=FF112233>Eagle #EAGLE</c> Falcon"
    assert textsort.replaced(text, "c=FF", "x") == text
    assert textsort.replaced(text, "1.10", "x") == text
    assert textsort.replaced("a", "a", r"\1") == r"\1", "the new words are only words"


def test_whole_words_leave_longer_words_alone_and_parts_are_the_default():
    text = "Reinforce the reinforcements, reinforce-now (reinforce)"
    assert textsort.replaced(text, "reinforce", "Help") == "Help the Helpments, Help-now (Help)"
    assert textsort.replaced(text, "reinforce", "Help", whole=True) == "Help the reinforcements, Help-now (Help)"
    assert textsort.replaced("Reinforce reinforce", "reinforce", "Help", case=True, whole=True) == "Reinforce Help"
    assert textsort.replaced("(a) b(a)c", "(a)", "x", whole=True) == "x b(a)c", "words that start and end with signs"
    assert textsort.replaced("#COUNT eagle", "COUNT", "x", whole=True) == "#COUNT eagle", "what the game fills in stays"


def test_a_whole_word_replace_reaches_the_route(s):
    s.text_apply([{"table": ARSENAL, "id": 41, "text": "PACK PACKS"}])
    assert [c["after"] for c in s.text_replace("us", "pack", "Kit", ids=[41], whole=True)["changes"]] == ["Kit PACKS"]
    assert [c["after"] for c in s.text_replace("us", "pack", "Kit", ids=[41])["changes"]] == ["Kit KitS"]


def test_a_replace_starts_from_the_new_text_and_goes_by_the_chosen_lines(s):
    s.text_apply([{"table": ARSENAL, "id": 41, "text": "HOVER PACK II"}])
    got = s.text_replace("us", "pack", "Kit")["changes"]
    assert [(c["id"], c["after"]) for c in got] == [(41, "HOVER Kit II")]
    assert s.text_replace("us", "pack", "Kit", ids=[40])["changes"] == []


def test_the_original_text_again_takes_a_line_off_the_project(s):
    s.text_apply([{"table": ARSENAL, "id": 41, "text": "X"}, {"table": ARSENAL, "id": 42, "text": "Y"}])
    s.text_apply([{"table": ARSENAL, "id": 41, "text": "HOVER PACK"}, {"table": ARSENAL, "id": 42, "text": "Z"}])
    assert [(t.id, t.text) for t in s.project.texts] == [(42, "Z")]
    with pytest.raises(EditorError):
        s.text_apply([{"table": ARSENAL, "id": 999, "text": "Z"}])


def test_lost_says_what_a_new_text_dropped():
    assert textsort.lost("{0.00->1.00}Kill #COUNT #RACE", "{0.00->1.00}Kill #COUNT") == ["#RACE"]
    assert textsort.lost("{0.00->1.00}Kill", "Kill") == ["{0.00->0.00}"]
    assert textsort.lost("Kill", "Kill all") == []


