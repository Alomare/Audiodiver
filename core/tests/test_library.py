"""The Library (library.py) and the project's list of what it works on. Unit tests need nothing; `game` tests read
the installed game."""
import json
import wave
import zipfile

import pytest

from audiodiver.editor import EditorError, Session
from audiodiver.game import murmur64_hash
from audiodiver.project import Project, Replacement
from audiodiver.titles import title


def _wav(path, seconds=0.2):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(48000)
        w.writeframes(bytes(int(48000 * seconds) * 2))
    return path


# --- names
def test_titles_are_title_case_and_leave_codes_and_units_alone():
    for text, want in [
        ("on the ship", "On the Ship"), ("stepping out of the hellpod", "Stepping Out of the Hellpod"),
        ("hive world", "Hive World"), ("after the mission", "After the Mission"),
        ("battle → exploring #2", "Battle → Exploring #2"), ("terminids: destroy hive lung", "Terminids: Destroy Hive Lung"),
        ("blow up assembly site", "Blow Up Assembly Site"), ("drop off black box", "Drop Off Black Box"),
        ("eagle 500kg bomb", "Eagle 500kg Bomb"), ("orbital 380mm HE barrage (DSS)", "Orbital 380mm HE Barrage (DSS)"),
        ("AR-23A liberator carbine", "AR-23A Liberator Carbine"), ("StA-X3 W.A.S.P. launcher", "StA-X3 W.A.S.P. Launcher"),
        ("music_tutorial_old", "music_tutorial_old"), ("G-12 high explosive, G-16 impact grenades",
                                                       "G-12 High Explosive, G-16 Impact Grenades"),
    ]:
        assert title(text) == want


# --- the project's list
def test_project_keeps_its_list_and_a_file_without_one_stays_without(tmp_path):
    p = Project(name="Test", path=tmp_path / "t.audi", library=["deploy/loadout", "archive:6ad7cc21015a5f85"])
    p.save()
    assert json.loads((tmp_path / "t.audi").read_text())["library"] == ["deploy/loadout", "archive:6ad7cc21015a5f85"]
    assert Project.load(tmp_path / "t.audi").library == p.library
    old = Project(name="Old", path=tmp_path / "old.audi")  # from before projects had a list
    old.save()
    assert "library" not in json.loads((tmp_path / "old.audi").read_text())
    assert Project.load(tmp_path / "old.audi").library is None


def test_a_new_project_lists_nothing_and_the_list_needs_the_game(tmp_path):
    s = Session(load=False)
    st = s.new_project(tmp_path / "m.audi", "M")
    assert st["library"] == [] and st["library_missing"] == [] and st["in_banks"] == {} and st["outside"] == []
    assert json.loads((tmp_path / "m.audi").read_text())["library"] == []
    with pytest.raises(EditorError, match="loading"):
        s.library_add(["deploy/loadout"])


# --- with the game
AUTOCANNON = f"bank:{murmur64_hash(b'content/audio/wep_autocannon')}"


@pytest.fixture(scope="module")
def session():
    s = Session()
    s.wait_ready()
    return s


def _items(s):
    return {i["id"]: i for c in s.index()["categories"] for sec in c["sections"] for i in sec["items"]}


def _rows(view):
    return [sl for g in view["segments_detail"] for st in g["stems"] for sl in st["slots"]]


@pytest.fixture(scope="module")
def own(session):
    """(a weapon's item id, its bank's cue id, a sound no other bank plays): most of a weapon's sounds are copied
    into other banks (its sentry, its exosuit, the tutorial), so the first weapon with one of its own is looked
    for."""
    for item in next(c for c in session.index()["categories"] if c["id"] == "weapons")["sections"][0]["items"]:
        cue = item["parts"][0]["cue"]
        sound = next((r["source"] for r in _rows(session.cue(cue)) if not r["also_n"]), None)
        if sound and len(item["parts"]) == 1:
            return item["id"], cue, sound
    pytest.fail("no weapon has a sound of its own")


@pytest.mark.game
def test_index_has_the_music_first_then_the_sound_sets_by_category(session):
    cats = session.index()["categories"]
    assert cats[0]["id"] == "music"
    assert [s["id"] for s in cats[0]["sections"]] == [s["id"] for s in session.music()["sections"]]
    assert {"weapons", "stratagems", "helldivers", "allies", "enemies", "planets"} <= {c["id"] for c in cats}
    assert all(isinstance(c["hue"], int) and c["name"] == title(c["name"]) for c in cats)
    ids = [i["id"] for c in cats for sec in c["sections"] for i in sec["items"]]
    assert len(ids) == len(set(ids)) > 400
    it = _items(session)
    gun = it["set:weapons/support/ac-8-autocannon"]
    assert gun["name"] == "AC-8 Autocannon" and gun["category"] == "weapons" and gun["kind"] == "sounds"
    assert [p["cue"] for p in gun["parts"]] == [AUTOCANNON] and gun["parts"][0]["count"] == gun["count"] > 100
    assert it["deploy/loadout"]["category"] == "music" and it["deploy/loadout"]["count"] == 15
    # a voice has a part for every language that is installed, English among them
    voice = it["set:helldivers/voices/helldiver-voice-2"]
    assert "English" in [p["name"] for p in voice["parts"]] or len(voice["parts"]) == 1
    # a thing the community names by archive alone still finds its bank, and nothing is listed without sounds
    assert it["set:enemies/illuminate/voteless"]["count"] > 500
    assert all(i["parts"] and all(p["count"] for p in i["parts"]) for i in it.values() if i["kind"] == "sounds")


@pytest.mark.game
def test_all_archives_lists_everything_with_audio_and_tags_what_the_index_knows(session):
    archives = session.archives()
    ix = session.ix
    with_audio = {a for bid, b in ix.banks.items() if b["refs"] or b["media"] for a in b["archives"]}
    assert with_audio <= {a["id"] for a in archives} and len(archives) > 450
    tagged = [bool(a["tags"]) for a in archives]
    assert tagged == sorted(tagged, reverse=True) and not all(tagged)  # the known ones first, the unknown ones too
    known = {c["id"] for c in session.index()["categories"]}
    assert all(t["category"] in known for a in archives for t in a["tags"])
    gun = next(a for a in archives if "AC-8 Autocannon" in a["names"])
    assert gun["tags"] == [{"name": "Weapons", "category": "weapons"}] and gun["banks"] >= 1
    assert all(int(a["preview"]) for a in archives)  # each has something to hear without opening it
    item = session.item(f"archive:{gun['id']}")
    assert item["kind"] == "archive" and AUTOCANNON in [p["cue"] for p in item["parts"]]
    unknown = next(a for a in archives if not a["tags"])
    blank = session.item(f"archive:{unknown['id']}")
    assert blank["name"] == f"Archive {unknown['id']}" and blank["about"] == "Not named yet."
    assert sum(p["count"] for p in blank["parts"]) == blank["count"] > 0
    with pytest.raises(EditorError):
        session.item("archive:0000000000000000")


@pytest.mark.game
def test_a_bank_opens_as_its_sounds_grouped_by_take(session):
    view = session.cue(AUTOCANNON)
    bid = int(AUTOCANNON[5:])
    rows = _rows(view)
    assert view["kind"] == "sounds" and view["name"] == "AC-8 Autocannon" and view["path"] == ["Weapons", "Support Weapons"]
    assert view["tags"] == [{"name": "AC-8 Autocannon", "category": "weapons", "item": "set:weapons/support/ac-8-autocannon"}]
    assert view["bank_name"] == "content/audio/wep_autocannon"
    # every sound of the bank once, and nothing else
    assert sorted(int(r["source"]) for r in rows) == sorted(session.lib.sources(bid)) == sorted(map(int, view["slots"]))
    groups = view["segments_detail"]
    assert len(groups) > 20 and all(g["group"] for g in groups)
    first = groups[0]["stems"][0]["slots"]
    assert groups[0]["name"] == "Sequence 1" and [r["label"] for r in first[:2]] == ["Take 1", "Take 2"]
    assert sum(1 for r in rows if r["duration_ms"]) > len(rows) * 0.8  # lengths come from the audio's own header
    # sounds every weapon has a copy of say so, without listing a hundred banks
    shared = max(rows, key=lambda r: r["also_n"])
    assert shared["also_n"] > 50 and len(shared["also_in"]) <= 8 and shared["banks"] == shared["also_n"]
    assert any(g["shared"] > 50 for g in groups) and groups[0]["shared"] < 50
    assert session.cue(AUTOCANNON) is view  # kept: opening it again is instant
    for bad in ("bank:1", "bank:x", "streams:nope", "nonsense"):
        with pytest.raises(EditorError):
            session.cue(bad)


@pytest.mark.game
def test_container_ids_list_a_bank_as_its_tree(session):
    """By container id (Settings): each group is the container right above its Sounds, named by its id, in the bank's
    tree order, under the containers over it; a run of Actor-Mixers that each hold only the next shares a line. The
    same sounds as by name, and the view by name stays as it was."""
    by_name, by_id = session.cue(AUTOCANNON), session.cue(AUTOCANNON, ids=True)
    assert sorted(r["source"] for r in _rows(by_id)) == sorted(r["source"] for r in _rows(by_name))
    assert by_name["segments_detail"][0]["name"] == "Sequence 1" and "above" not in by_name["segments_detail"][0]
    groups = [g for g in by_id["segments_detail"] if "key" in g]  # not the Sounds without a container, nor the rest
    assert len(groups) > 40 and all(g["name"] == g["key"] and g["ctype"] in ("Random", "Sequence", "Switch", "Layer", "Actor-Mixer")
                                    for g in groups)
    lines = [tuple("/".join(a["ids"]) for a in g["above"]) for g in groups]
    assert any(len(a["ids"]) > 1 and a["type"] == "Actor-Mixer" for g in groups for a in g["above"])
    assert {a["type"] for g in groups for a in g["above"]} >= {"Actor-Mixer", "Switch", "Layer"}
    # a depth-first walk: the groups under any container come one after another
    for path in {p[:d] for p in lines for d in range(1, len(p) + 1)}:
        at = [i for i, p in enumerate(lines) if p[:len(path)] == path]
        assert at == list(range(at[0], at[-1] + 1)), path
    assert session.cue(AUTOCANNON, ids=True) is by_id and session.cue(AUTOCANNON) is by_name


@pytest.mark.game
def test_a_slot_says_the_make_up_gain_the_game_gives_its_sound(session):
    """A slot's Make-Up Gain adds to the one the Sound has in the game (about 1 Sound in 12): the row says what that
    is (game_gain), for the details panel. The LAS-5 Scythe's beam has three takes with −4, −5 and −17 dB."""
    part = _items(session)["set:weapons/primary/las-5-scythe"]["parts"][0]
    view = session.cue(part["cue"])
    beam = next(g for g in view["segments_detail"] if g["name"] == "Sequence 7")
    assert sorted(s.get("game_gain") for s in beam["stems"][0]["slots"]) == [-17, -5, -4]
    assert any("game_gain" not in r for r in _rows(view))


@pytest.mark.game
def test_voice_lines_say_what_they_say_and_play_from_their_language(session):
    it = _items(session)
    part = next(p for p in it["set:helldivers/voices/helldiver-voice-2"]["parts"] if p["name"] in ("English", ""))
    view = session.cue(part["cue"])
    rows = _rows(view)
    assert view["language"] == "English" and "English voices" in view["notes"]
    have = {b.get("lang") for b in session.ix.banks.values()} - {"", None}
    assert ("once Steam downloads" in view["notes"]) == (len(have) < 10)  # missing languages are named as such
    assert ("Only English voices are installed." in view["notes"]) == (have == {"us"})
    said = [r for r in rows if r["label"] and not r["label"].startswith("Take ")]
    assert len(said) > len(rows) * 0.6 and all(r["label"][0] == r["label"][0].upper() for r in said)
    assert any(g["name"].startswith("“") for g in view["segments_detail"])  # a line's takes go by what it says
    sid = int(said[0]["source"])
    ix = session.ix
    assert ix.language[sid] == "us" and ix.stream_file(sid) == murmur64_hash(f"content/audio/us/{sid}".encode())
    wav = session.vanilla_wav(sid)
    with wave.open(str(wav)) as w:
        assert abs(w.getnframes() * 1000 / w.getframerate() - said[0]["duration_ms"]) < 60


@pytest.mark.game
def test_voice_lines_say_their_subtitles_and_clips_without_words_are_named(session):
    it = _items(session)
    views = [session.cue(next(p for p in it[f"set:helldivers/voices/helldiver-voice-{v}"]["parts"]
                              if p["name"] in ("English", ""))["cue"]) for v in (1, 2)]
    for view in views:  # voice 1: the community transcribed none of it, its subtitles say it all the same
        rows = _rows(view)
        said = [r for r in rows if r.get("subtitle")]
        assert len(said) > len(rows) * 0.8 and all(r["label"] and isinstance(r["subtitle_sure"], bool) for r in said)
        assert any(r["subtitle_sure"] for r in said) and not all(r["subtitle_sure"] for r in said)
        assert "another Helldiver voice" not in view["notes"]
        # grunts, panting: grouped by what they are, numbered in the bank (sighs and laughs are panting)
        names = [g["name"] for g in view["segments_detail"]]
        assert any(n.startswith("Grunts") for n in names) and "Panting" in names
        assert not {"Sighs", "Laughs"} & set(names)
        grunts = [r["label"] for r in rows if r.get("sound") == "Grunt"]
        assert grunts[:2] == ["Grunt 1", "Grunt 2"] and len(set(grunts)) == len(grunts) > 50
        assert not any(r.get("subtitle") and r.get("sound") for r in rows)


@pytest.mark.game
def test_exertions_are_named_by_kind_and_voice(session):
    """A group per kind and voice (data/exertions.json), listed by name, each take saying when it plays; the grunts
    the bank holds for the voice banks stay grouped by what they are."""
    view = session.cue(_items(session)["set:helldivers/voices/helldiver-exertions"]["parts"][0]["cue"])
    names = [g["name"] for g in view["segments_detail"]]
    assert names[:4] == [f"Bleeding Out · Voice {v}" for v in (1, 2, 3, 4)]
    assert len([n for n in names if " · Voice " in n]) == 108
    assert names.index("Death · Voice 4") + 1 == names.index("Death Scream, Long · Voice 1")
    drowning = next(g for g in view["segments_detail"] if g["name"] == "Drowning · Voice 1")
    assert all(sl["label"].startswith("Take") and sl["notes"] for st in drowning["stems"] for sl in st["slots"])
    assert any(n.startswith("Grunts") for n in names) and "Panting" in names


@pytest.mark.game
def test_music_banks_open_with_their_segments_tagged(session):
    bid = murmur64_hash(b"content/audio/music_ship")
    view = session.cue(f"bank:{bid}")
    tagged = [g for g in view["segments_detail"] if g["tags"]]
    assert tagged and all(t["category"] == "music" and t["item"] in _items(session) for g in tagged for t in g["tags"])
    assert all(g["segment"] and g["cue"] for g in tagged)
    archive = session.ix.banks[bid]["archives"][0]
    row = next(a for a in session.archives() if a["id"] == archive)
    assert {"name": "Music", "category": "music"} in row["tags"] and any(n.startswith("Music: ") for n in row["names"])


@pytest.mark.game
def test_items_are_added_to_a_project_and_removed_with_their_audio(session, own, tmp_path):
    s = session
    gun, bank, sound = own
    s.new_project(tmp_path / "p.audi", "P")
    loadout = "deploy/loadout"
    st = s.library_add([gun, loadout, gun])
    assert st["library"] == [gun, loadout] and st["undo_label"] == "add"
    assert json.loads((tmp_path / "p.audi").read_text())["library"] == [gun, loadout]
    with pytest.raises(EditorError, match="not in this game version"):
        s.library_add(["set:weapons/no-such-thing"])
    music = _items(s)[loadout]["targets"][0]
    a = str(_wav(tmp_path / "a.wav"))
    s.assign(sound, a)
    st = s.assign(music, a)
    assert st["in_banks"] == {bank: 1} and st["outside"] == []
    # audio in a slot nothing on the list holds puts what it belongs to on the list: nothing is replaced unseen
    foley = f"bank:{murmur64_hash(b'content/audio/foley_player')}"
    stray = next(r["source"] for r in _rows(s.cue(foley)) if not r["also_n"])
    st = s.assign(stray, a)
    assert st["library"] == [gun, loadout, "set:helldivers/body/movement-and-gear"] and st["outside"] == []
    assert st["in_banks"] == {bank: 1, foley: 1}
    # what taking it off would take with it, for the question the app asks first; asking changes nothing
    assert s.library_remove_preview([gun]) == {"slots": 1, "files": ["a.wav"]}
    assert s.library_remove_preview([loadout]) == {"slots": 1, "files": ["a.wav"]} and gun in s.project_state()["library"]
    st = s.library_remove([gun])
    assert st["library"] == [loadout, "set:helldivers/body/movement-and-gear"] and sound not in st["assignments"]
    assert set(st["assignments"]) == {music, stray} and st["undo_label"] == "unlist" and st["in_banks"] == {foley: 1}
    st = s.undo()
    assert st["library"][:2] == [gun, loadout] and sound in st["assignments"] and st["in_banks"][bank] == 1
    # the same bank is never listed twice: an archive that is only the gun's bank isn't added, and says why
    only = [f"archive:{ar}" for ar in s.ix.banks[int(bank[5:])]["archives"]
            if [p["cue"] for p in s.lib.archive_item(ar)["parts"]] == [bank]]
    if only:
        st = s.library_add(only)
        assert not set(only) & set(st["library"]) and st["notes"] == [
            f"The sounds of {s._list_name(only[0])} are already in the project, under {_items(s)[gun]['full']}."]
    # an archive that shares a set's bank is added, with a note; taking either off takes the audio in their shared
    # slots too: removed audio never stays in the project (a build made it after the item was gone)
    single = [it for it in _items(s).values() if it["kind"] == "sounds" and len(it["parts"]) == 1 and it["id"] != gun]
    one, archive = next((it, f"archive:{ar}") for it in single
                        for ar in s.ix.banks[int(it["parts"][0]["cue"][5:])]["archives"]
                        if len(s.lib.archive_item(ar)["parts"]) > 1
                        and any(not r["also_n"] for r in _rows(s.cue(it["parts"][0]["cue"]))))
    held = next(r["source"] for r in _rows(s.cue(one["parts"][0]["cue"])) if not r["also_n"])
    s.library_add([one["id"]])
    s.assign(held, a)
    st = s.library_add([archive])
    assert archive in st["library"] and "show under both" in st["notes"][0]
    assert s.library_remove_preview([one["id"]])["slots"] == 1
    plain = next(r["source"] for r in _rows(s.cue(one["parts"][0]["cue"])) if r["source"] != held)
    assert s.original_gain([plain], -6)["gains"].get(str(plain)) == -6
    st = s.library_remove([one["id"]])
    assert held not in st["assignments"] and archive in st["library"] and str(plain) not in st["gains"]
    assert held in s.undo()["assignments"]
    assert held not in s.library_remove([archive])["assignments"]


@pytest.mark.game
def test_a_project_from_before_the_list_gets_one_from_its_replacements(session, own, tmp_path):
    s = session
    gun, _bank, sound = own
    it = _items(s)
    _wav(tmp_path / "a.wav")
    old = Project(name="Old", path=tmp_path / "old.audi", replacements=[
        Replacement(int(sound), "a.wav"), Replacement(int(it["deploy/loadout"]["targets"][0]), "a.wav"),
        Replacement(int(it["deploy/loadout"]["targets"][1]), "a.wav")])
    old.save()
    st = s.open_project(tmp_path / "old.audi")
    assert st["library"] == ["deploy/loadout", gun] and st["outside"] == []  # in the Index's order
    assert "library" not in json.loads((tmp_path / "old.audi").read_text())  # opening a project doesn't write to it
    s.update(sound, gain_db=2)
    assert json.loads((tmp_path / "old.audi").read_text())["library"] == st["library"]  # the first edit saves it
    assert s.undo()["library"] == st["library"]


@pytest.mark.game
def test_a_set_renamed_in_the_index_is_found_by_its_old_name(session, tmp_path):
    s = session
    it = _items(s)
    assert it["set:enemies/automatons/vox-engine"]["name"] == "Vox Engine" and "set:enemies/automatons/cyborg-siege-engine" not in it
    assert it["set:interface/ui/game-init"]["name"] == "Game Init"
    old = Project(name="Renamed", path=tmp_path / "r.audi", library=["set:enemies/automatons/cyborg-siege-engine", "set:interface/ui/game-start"])
    old.save()
    st = s.open_project(tmp_path / "r.audi")
    assert st["library"] == ["set:enemies/automatons/vox-engine", "set:interface/ui/game-init"] and st["library_missing"] == []


@pytest.mark.game
def test_seaf_and_civilian_voices_are_two_sets(session, tmp_path):
    """The SEAF's voice lines and the civilians' are two banks in each language (Mission_SEAF_VO, Mission_Civilian_VO)
    with no clip in common, so two sets, and an archive with both banks is named after both. A project that listed
    the civilians' voices as "Civilians", or the SEAF's as "SEAF Soldier" (from before the bank had a known name),
    finds them under the new names."""
    s = session
    it = _items(s)
    civ, seaf = it["set:allies/civilians/civilian-voices"], it["set:allies/civilians/seaf-voices"]
    banks = lambda item: [int(p["cue"][5:]) for p in item["parts"]]
    assert {s.lib.bank_names[b] for b in banks(civ)} == {"Mission_Civilian_VO"}
    assert {s.lib.bank_names[b] for b in banks(seaf)} == {"Mission_SEAF_VO"}
    clips = lambda item: {x for b in banks(item) for x in s.lib.sources(b)}
    assert clips(civ) and clips(seaf) and not clips(civ) & clips(seaf)
    archives = lambda item: {a for b in banks(item) for a in s.ix.banks[b]["archives"]}
    for a in archives(civ) & archives(seaf):
        names = next(r["names"] for r in s.archives() if r["id"] == a)
        assert any(n.startswith("Civilian Voices") for n in names) and any(n.startswith("SEAF Voices") for n in names)
    assert s.lib.home(next(iter(clips(seaf)))) == seaf["id"] and s.lib.home(next(iter(clips(civ)))) == civ["id"]
    old = Project(name="Voices", path=tmp_path / "v.audi",
                  library=["set:allies/civilians/civilians", "set:allies/civilians/seaf-soldier"])
    old.save()
    st = s.open_project(tmp_path / "v.audi")
    assert st["library"] == [civ["id"], seaf["id"]] and st["library_missing"] == []


@pytest.mark.game
def test_weapons_by_loadout_slot_keep_the_ids_projects_listed(session, tmp_path):
    """Weapons was one section once. Its sets are in their loadout slots now, some under their in-game names and
    some in other categories, and a project that listed one by its id of that time still finds it."""
    s = session
    weapons = next(c for c in s.index()["categories"] if c["id"] == "weapons")
    assert [x["name"] for x in weapons["sections"]] == ["Primary Weapons", "Secondary Weapons", "Support Weapons", "Grenades", "Shared"]
    it = _items(s)
    assert it["set:weapons/primary/smg-203-gallant"]["name"] == "SMG-203 Gallant"
    assert it["set:allies/civilians/seaf-liberator"]["category"] == "allies"
    old = Project(name="Old", path=tmp_path / "w.audi", library=["set:weapons/ac-8-autocannon", "set:weapons/smg-solvent",
                                                                  "set:weapons/seaf-liberator", "set:weapons/combat-walker-flamethrower"])
    old.save()
    st = s.open_project(tmp_path / "w.audi")
    assert st["library"] == ["set:weapons/support/ac-8-autocannon", "set:weapons/primary/smg-203-gallant",
                             "set:allies/civilians/seaf-liberator", "set:vehicles/exo-51-lumberer-flamethrower"]
    assert st["library_missing"] == []


@pytest.mark.game
def test_ids_lead_to_where_they_are_listed(session, own):
    s = session
    gun, bank, sound = own
    where = s.ix.banks[int(bank[5:])]["archives"]
    assert s.find(sound) == [{"cue": bank, "source": sound, "item": gun, "archives": where}]
    assert s.find(bank[5:]) == [{"cue": bank, "source": None, "item": gun, "archives": where}]
    assert s.find("12") == [] and s.find("not a number") == []
    # a sound many banks have a copy of leads to each of them, the ones the Index knows first
    shared = max(_rows(s.cue(AUTOCANNON)), key=lambda r: r["also_n"])["source"]
    places = s.find(shared)
    assert len(places) > 50 and places[0]["item"].startswith("set:")
    assert ("set:weapons/support/ac-8-autocannon", AUTOCANNON, shared) in [(p["item"], p["cue"], p["source"]) for p in places]
    assert s.lib.home(int(shared)).startswith("set:weapons/")
    # a sound nobody has named leads to the archive it is in
    unknown = next(a for a in s.archives() if not a["tags"])
    part = next(p["cue"] for p in s.item(f"archive:{unknown['id']}")["parts"])
    lone = next(r["source"] for r in _rows(s.cue(part)) if not r["also_n"])
    assert s.find(lone) == [{"cue": part, "source": lone, "item": f"archive:{unknown['id']}", "archives": [unknown["id"]]}]
    assert s.lib.home(int(lone)) == f"archive:{unknown['id']}"


@pytest.mark.game
def test_a_voice_line_builds_into_a_patch_of_its_own_language(session, tmp_path):
    """A replaced voice line goes into the stream filed under its language. A line that is only streamed leaves
    its bank as it is; one with its first bytes in the bank changes that bank too, and no other."""
    from audiodiver import patch
    from audiodiver.build import build
    s = session
    part = next(p for p in _items(s)["set:allies/training/general-brasch"]["parts"] if p["name"] in ("English", ""))
    line = _rows(s.cue(part["cue"]))[0]["source"]
    _wav(tmp_path / "line.wav", 0.5)
    p = Project(name="Voice", path=tmp_path / "v.audi", library=[], replacements=[Replacement(int(line), "line.wav")])
    zip_path = build(p, s.ix, tmp_path / "out", log=lambda *_: None)  # the build verifies what it wrote
    with zipfile.ZipFile(zip_path) as z:
        z.extractall(tmp_path / "x")
    banks, streams = patch.read_patch(str(next((tmp_path / "x").rglob("*.patch_0"))))
    assert list(streams) == [murmur64_hash(f"content/audio/us/{line}".encode())]
    assert set(banks) <= {int(part["cue"][5:])}


@pytest.mark.game
def test_a_banks_sounds_export_one_file_each(session, tmp_path):
    import time
    s = session
    rows = _rows(s.cue(AUTOCANNON))
    assert s.export_options(AUTOCANNON) == {"music": False, "groups": [], "random": False, "playlist": False, "segments": 0}
    assert s.export_options(716451767)["music"] is True
    with pytest.raises(EditorError, match="one by one"):
        s.export(AUTOCANNON, tmp_path / "x", what="segments")
    job = s.export(AUTOCANNON, tmp_path / "out", what="slots", sources=[r["source"] for r in rows[:2]])
    while s.job(job["id"])["state"] == "running":
        time.sleep(0.1)
    done = s.job(job["id"])
    assert done["state"] == "done" and done["result"]["files"] == 2, done
    names = sorted(f.name for f in (tmp_path / "out").iterdir())
    assert names == ["Weapons - Support Weapons - AC-8 Autocannon - 001 Sound 1 Take 1.wav",
                     "Weapons - Support Weapons - AC-8 Autocannon - 002 Sound 1 Take 2.wav"]


@pytest.mark.game
def test_the_export_list_exports_what_was_collected_from_several_places(session, tmp_path):
    import time
    s = session
    rows = _rows(s.cue(AUTOCANNON))
    job = s.export_list([{"cue": AUTOCANNON, "sources": [rows[0]["source"]], "name": "Autocannon: first"},
                         {"cue": AUTOCANNON, "sources": [rows[1]["source"]], "name": "Second"},
                         {"cue": "716451767", "sources": [], "name": "Loadout"}], str(tmp_path), fmt="flac")
    while s.job(job["id"])["state"] == "running":
        time.sleep(0.1)
    done = s.job(job["id"])
    assert done["state"] == "done", done
    folders = {f.name: sorted(x.name for x in f.iterdir()) for f in tmp_path.iterdir()}
    # the entry's name on the list names its folder and starts its files' names (":" can't be in a name)
    assert folders["Autocannon first"] == ["Autocannon first - 001 Sound 1 Take 1.flac"]
    assert folders["Second"] == ["Second - 002 Sound 1 Take 2.flac"]
    assert len(folders["Loadout"]) == 15 and done["result"]["files"] == 17  # no sources: all of it
    with pytest.raises(EditorError, match="empty"):
        s.export_list([], str(tmp_path))


@pytest.mark.game
def test_the_export_preview_names_the_files_an_export_writes(session, tmp_path):
    """The Export panel's preview: each entry's files, named as export_list writes them (full names, short names or
    source IDs), and why an entry can't be exported. WEM files are the game's own, byte for byte."""
    import time
    s = session
    rows = _rows(s.cue(AUTOCANNON))
    two = [rows[0]["source"], rows[1]["source"]]
    entry = {"cue": AUTOCANNON, "sources": two, "name": "Cannon"}
    assert s.export_preview([entry])["folders"] == [
        {"name": "Cannon", "files": ["Cannon - 001 Sound 1 Take 1.wav", "Cannon - 002 Sound 1 Take 2.wav"], "total": 2}]
    assert s.export_preview([entry], names="short", fmt="flac")["folders"][0]["files"] == ["001 Sound 1 Take 1.flac",
                                                                                           "002 Sound 1 Take 2.flac"]
    assert s.export_preview([entry], names="ids", fmt="wem")["folders"][0]["files"] == [f"{x}.wem" for x in two]
    loadout = {"cue": "716451767", "sources": [], "name": "Loadout"}
    assert s.export_preview([{**loadout, "what": "cue"}])["folders"][0]["files"] == ["Loadout.wav"]
    segs = s.export_preview([{**loadout, "what": "segments"}], limit=2)["folders"][0]
    assert segs["total"] == 15 and segs["files"][0] == "Loadout - 01 Loadout Start.wav"
    bad = s.export_preview([{**entry, "what": "segments"}])
    assert bad["total"] == 0 and "one by one" in bad["folders"][0]["error"]
    with pytest.raises(EditorError, match="WEM"):
        s.export_list([{**loadout, "what": "segments"}], str(tmp_path), fmt="wem")
    job = s.export_list([entry], str(tmp_path / "wem"), fmt="wem", names="ids", apart=False)
    while s.job(job["id"])["state"] == "running":
        time.sleep(0.1)
    assert s.job(job["id"])["state"] == "done"
    for x in two:
        assert (tmp_path / "wem" / f"{x}.wem").read_bytes() == s.ix.wem(int(x))


@pytest.mark.game
def test_an_export_as_the_mod_plays_it_has_new_audio_where_a_slot_has_some(session, own, tmp_path):
    """As the mod plays it (whose "mod"): every slot, the new audio where a slot has some, the Original elsewhere;
    Both: the replaced version beside the Original, each tagged."""
    import time
    s = session
    gun, bank, sound = own
    s.new_project(tmp_path / "p.audi", "P")
    s.library_add([gun])
    s.assign(sound, str(_wav(tmp_path / "a.wav")))
    entry = {"cue": bank, "sources": [], "name": "Gun"}
    original = s.export_preview([entry], limit=1000)["folders"][0]
    mod = s.export_preview([{**entry, "whose": "mod"}], limit=1000)["folders"][0]
    both = s.export_preview([{**entry, "whose": "both"}], limit=1000)["folders"][0]
    assert mod["files"] == original["files"]  # the same names: one of them now holds the new audio
    assert both["total"] == original["total"] + 1 and sum(f.endswith("(replaced).wav") for f in both["files"]) == 1
    job = s.export_list([{**entry, "whose": "both", "sources": [sound]}], str(tmp_path / "out"), fmt="flac")
    while s.job(job["id"])["state"] == "running":
        time.sleep(0.1)
    assert s.job(job["id"])["state"] == "done", s.job(job["id"])
    names = sorted(f.name for f in (tmp_path / "out" / "Gun").iterdir())
    assert len(names) == 2 and names[0].endswith("(original).flac") and names[1].endswith("(replaced).flac")
    s.close_project()


@pytest.mark.game
def test_play_through_says_where_each_clip_plays(session):
    t = session.play_through(716451767)  # loadout selection
    assert t["marks"] and all(m["name"] and m["clips"] for m in t["marks"])
    first = t["marks"][0]["clips"][0]
    assert set(first) == {"source", "mine", "at_ms", "offset_ms", "length_ms"} and first["mine"] is False
    assert first["source"] in session.cue(716451767)["slots"] and 0 <= first["at_ms"] <= t["marks"][0]["ms"]
