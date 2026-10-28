"""The names and data texts the core shows, in the language in use: codes the app goes by instead of English words,
the data catalog (i18n.dtr), the names put together from pieces, and naming everything again when the language
changes. Unit tests need nothing; `game` tests read the installed game."""
import json

import pytest

from audiodiver import combine, i18n
from audiodiver.catalog import label_shown
from audiodiver.editor import Session
from audiodiver.game import murmur64_hash
from audiodiver.project import Project, Replacement
from audiodiver.titles import named, shown, title

AUTOCANNON = f"bank:{murmur64_hash(b'content/audio/wep_autocannon')}"


@pytest.fixture
def xx(tmp_path, monkeypatch):
    """A made-up language "xx" whose data catalog translates a few texts; English again afterwards."""
    data = tmp_path / "data"
    data.mkdir()
    (data / "xx.json").write_text(json.dumps({
        "AC-8 Autocannon": "AC-8 Canhão", "AR-23 Liberator": "AR-23 Liberador", "Weapons": "Armas",
        "Terminid": "Terminídeo", "Battle": "Batalha", "Drowning": "Afogando", "Voice 1": "Voz 1",
        "Downtime Music": "Música de Folga", "Untranslated": ""}), encoding="utf-8")
    (data / "en.json").write_text("{}", encoding="utf-8")  # the list of texts, never a translation
    monkeypatch.setattr(i18n, "DATA_DIR", data)
    yield "xx"
    i18n.set_language("en")


# --- the data catalog
def test_data_texts_are_translated_where_the_catalog_has_them(xx):
    assert "xx" in i18n.available() and "en" not in i18n.available()
    assert i18n.resolve("xx") == "xx" and i18n.resolve("xx-YY") == "xx" and i18n.resolve("zz") == "en"
    assert i18n.set_language("xx") == "xx"
    assert i18n.dtr("AR-23 Liberator") == "AR-23 Liberador" and i18n.dtr("Not in it") == "Not in it"
    assert i18n.dtr("Untranslated") == "Untranslated" and i18n.dtr("") == ""  # an empty translation is none
    assert named("AR-23 liberator") == "AR-23 Liberador"  # keyed by the name as English shows it, in title case
    assert label_shown("Drowning · Voice 1") == "Afogando · Voz 1" and label_shown("Drowning · Voice 2") == "Afogando · Voice 2"
    assert shown("battle or intense battle") == "battle or intense battle"  # a translation keeps its own capitals
    i18n.set_language("en")
    assert i18n.dtr("AR-23 Liberator") == "AR-23 Liberator" and i18n.data_catalog("en") == {}
    assert shown("battle or intense battle") == "Battle or Intense Battle"


def test_the_whole_english_name_is_in_title_case_whatever_the_case_of_its_pieces():
    """A name put together from pieces is title cased as a whole in English (titles.shown), so the pieces' own title
    case changes nothing: "Exploring or the Combat Music", not "Exploring or The Combat Music"."""
    for raw, pieces in [("forest, grassland and arctic", ["Forest", ", ", "Grassland", " and ", "Arctic"]),
                        ("exploring or the combat music", ["Exploring", " or ", "The Combat Music"]),
                        ("anything → terminid battle (stealth)", ["Anything", " → ", "Terminid Battle", " (", "Stealth", ")"]),
                        ("several levels, also on arrival", ["Several Levels", ", Also on Arrival"]),
                        ("battle → leaving the mission", ["Battle", " → ", "Leaving the Mission"])]:
        assert shown("".join(pieces)) == title(raw)


def test_the_list_of_data_texts_is_up_to_date():
    """locale/data/en.json holds every text the data files give the app (tools/i18n.py data makes it again)."""
    import importlib.util
    from pathlib import Path
    spec = importlib.util.spec_from_file_location("i18n_tool", Path(__file__).parents[1] / "tools" / "i18n.py")
    tool = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(tool)
    have = json.loads((i18n.DATA_DIR / "en.json").read_text(encoding="utf-8"))
    assert list(have) == list(tool.collect_data()), "run: python core/tools/i18n.py data"
    for lang in ("pt-BR", "zh-Hans"):  # what the language files translate is in it
        assert set(i18n.data_catalog(lang)) <= set(have)


# --- codes instead of English words
def test_project_problems_have_kinds(tmp_path):
    p = Project(name="Trilha Épica", guid="not-a-guid", icon={"image": "gone.png", "border": "wide"},
                replacements=[Replacement(1, "x.wav"), Replacement(1, "y.wav")], path=tmp_path / "t.audi")
    found = p.problem_list()
    assert [k for k, _ in found] == ["name", "icon_missing", "icon", "missing_file", "duplicate", "missing_file", "mod_id"]
    assert p.problems() == [text for _, text in found]
    texts = [text for _, text in found]  # the English as it was
    assert texts[1].startswith("icon: image not found (") and texts[2].startswith("icon: border is")
    assert texts[3].startswith("x.wav: the audio file wasn't found (")
    assert texts[6] == "mod ID: damaged in the project file (Make a New ID, on the Project tab)"


def test_the_project_state_says_each_problem_kind(tmp_path):
    s = Session(load=False)
    s.new_project(tmp_path / "m.audi", "My Mod")
    st = s.settings(name="Trilha Épica")
    assert st["problem_kinds"] == ["name"] and len(st["problems"]) == 1


def test_a_setting_in_a_conflict_says_its_unit(xx):
    assert [combine.prop_unit(p) for p in (0x00, 0x01, 0x02, 0x05, 0x22, 99)] == ["dB", "cents", "", "dB", "s", ""]
    assert combine.prop_name(0x00) == "Volume" and combine.prop_name(99) == "Setting 99"
    i18n.set_language("xx")
    assert combine.prop_name(0x05) == "Make-Up Gain"  # the Wwise name, in every language


# --- with the game
@pytest.fixture(scope="module")
def session():
    s = Session()
    s.wait_ready()
    return s


def _music(s):
    return {i["id"]: i for sec in s.music()["sections"] for i in sec["items"]}


@pytest.mark.game
def test_a_banks_groups_say_their_kind(session):
    groups = session.cue(AUTOCANNON)["segments_detail"]
    assert groups[0]["name"] == "Sound 1" and groups[0]["kind"] == "sound" and groups[0]["made_up"]
    assert all(bool(g.get("made_up")) == (g["kind"] == "sound" and g["name"].startswith("Sound ")) for g in groups)
    by_id = session.cue(AUTOCANNON, ids=True)["segments_detail"]
    assert not any(g.get("made_up") for g in by_id)  # named by the container's id
    seen = {}
    for a in session.archives():
        for p in session.item(f"archive:{a['id']}")["parts"]:
            for g in session.cue(p["cue"])["segments_detail"]:
                if g.get("group"):
                    seen.setdefault(g["kind"], g["name"])
        if {"run", "other", "absent", "wordless"} <= set(seen):
            break
    assert seen["other"].startswith("Other Audio") and seen["absent"].startswith("No Audio in the Game Files")
    assert seen["run"].startswith("Sounds 1–") and seen["wordless"]
    if session.ix.orphans:  # streams no bank plays (an install may have none)
        lost = session.ix.streams[next(iter(session.ix.orphans))][0]
        assert {g["kind"] for g in session.cue(f"streams:{lost}")["segments_detail"]} == {"streams"}


@pytest.mark.game
def test_an_archive_named_by_its_id_says_so(session):
    blank = session.item(f"archive:{next(a for a in session.archives() if not a['names'])['id']}")
    assert blank["id_name"] and blank["name"] == f"Archive {blank['archive']}"
    one = next(a for a in session.archives() if len(a["names"]) == 1)
    item = session.item(f"archive:{one['id']}")
    assert "id_name" not in item and item["name"] == one["names"][0]


@pytest.mark.game
def test_names_put_together_read_in_english_as_they_did(session):
    """The music's names made of pieces and English words (now whole messages with fields) read as before."""
    music = _music(session)
    assert music["terminids/battle"]["full"] == "Terminid Battle" and music["terminids/battle"]["name"] == "Battle"
    # exploring by intensity (a sort key, not the first word), the named levels first
    assert [p["name"] for p in music["terminids/exploring"]["parts"]][:4] == ["Ambient", "Low", "Idle", "Unnamed Level"]
    parts = {p["name"] for it in music.values() for p in it["parts"]}
    assert {"Hellpod Descent → Anything", "The Hellpod Drop → The Combat Music",
            "Intense Battle → Mission Failed, Leaving the Mission and 1 More", "Several Levels, Also on Arrival",
            "Exploring or Anything Else → An Unknown Piece"} <= parts
    assert all("en" not in it for it in music.values())  # English: no second name
    assert session.catalog.music.label(next(int(p["cue"]) for p in music["terminids/transitions"]["parts"])) \
        .startswith("Terminids: ")


@pytest.mark.game
def test_every_data_text_the_core_looks_up_is_in_the_list(monkeypatch):
    """What the names and notes look up in the data catalog (the keys of i18n.dtr) is in locale/data/en.json, for
    translators to find: the Index, the Music view, every music cue and a share of the banks."""
    seen = set()

    class Seen(dict):
        def get(self, key, default=None):
            seen.add(key)
            return default
    monkeypatch.setattr(i18n, "_data", Seen())
    s = Session(load=False)
    s._load_game()
    s.index(), s.music()
    for e in s.cues():
        s.cue(e["id"])
    for n, a in enumerate(s.archives()[::6]):
        for p in s.item(f"archive:{a['id']}")["parts"]:
            s.cue(p["cue"], ids=n % 4 == 0)
    have = json.loads((i18n.DATA_DIR / "en.json").read_text(encoding="utf-8"))
    assert len(seen) > 500 and sorted(seen - set(have)) == []


@pytest.mark.game
def test_another_language_names_everything_again(xx):
    s = Session(load=False)
    s._load_game()
    catalog = s.catalog
    assert s.set_language("xx") == {"language": "xx"} and s.stage == s.RENAMING  # the window waits
    s.wait_ready()
    assert s.catalog is not catalog and s.names_language == "xx"
    weapons = next(c for c in s.index()["categories"] if c["id"] == "weapons")
    assert weapons["name"] == "Armas" and weapons["en"] == "Weapons"
    gun = next(i for sec in weapons["sections"] for i in sec["items"] if i["id"] == "set:weapons/support/ac-8-autocannon")
    assert gun["name"] == "AC-8 Canhão" and gun["en"] == "AC-8 Autocannon"
    battle = _music(s)["terminids/battle"]
    assert battle["name"] == "Batalha" and battle["full"] == "Terminídeo Batalha" and battle["en"] == "Terminid Battle"
    view = s.cue(AUTOCANNON)
    assert view["name"] == "AC-8 Canhão" and view["path"][0] == "Armas"
    # a label is found by its English words and by its translation, and says the translation
    assert any(h["label"] == "Música de Folga" for h in s.find_text("folga"))
    assert any(h["label"] == "Música de Folga" for h in s.find_text("downtime"))
    # the same language again changes nothing
    renamed = s.catalog
    s.set_language("xx")
    assert s.stage == "ready" and s.catalog is renamed
    s.set_language("en")
    s.wait_ready()
    assert next(c for c in s.index()["categories"] if c["id"] == "weapons")["name"] == "Weapons"
