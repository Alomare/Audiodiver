"""Helldivers 1 in the Library (hd1.py), on a small game made here: a bundle with a bank in two languages and a master."""
import os
import struct
import wave
import zlib

import pytest

from audiodiver import hd1
from audiodiver.game import murmur64_hash

EVENT = "vo_admiral_missionc_easy2"  # a name data/hd1_events.json knows
LINE = {"en": "Well done, #PLAYERRANK #PLAYERNAME.[P=1] #PLANETNAME stands.", "fr": "Bravo, #PLAYERRANK."}
ALONE = 0x1234                       # the top of a hash no name has
BANK_NAME = 0xAAAA000000000001
CLIPS = {"one": 0x1111111111111111, "two": 0x2222222222222222, "left": 0x3333333333333333}
SAMPLES = 2400  # 50 ms at 48 kHz


def clip_head(samples=SAMPLES, kept=0):
    words = [hd1.HEAD, kept, samples, *[0] * 9]
    return struct.pack("<12I", *words) + struct.pack("<HHIIHHI", hd1.PCM, 1, 48000, 96000, 2, 16, 0)


def bank(tone, stream_at=0):
    """A bank of three clips, each with a part of the audio in the stream. Returns (the bank, the stream)."""
    rows, body, stream = [], b"", b""
    at = 8 + 24 * len(CLIPS)
    for n, clip in enumerate(CLIPS.values()):
        audio = struct.pack("<h", tone + n) * SAMPLES
        kept, rest = audio[:1000], audio[1000:]
        data = clip_head(kept=len(kept)) + kept
        rows.append(struct.pack("<QIIII", clip, at + len(body), len(data), len(stream), len(rest)))
        body += data
        stream += rest
    return struct.pack("<II", len(CLIPS), 0) + b"".join(rows) + body, stream


def master():
    """Two events: the named one picks from two clips, through a wrapper; the other plays one clip. "left" has none."""
    def leaf(clip):
        return struct.pack("<IIIIQ", 0, 0, 0, 0, clip).ljust(72, b"\0")
    pick = struct.pack("<III", 1, 0, 2).ljust(24, b"\0") + struct.pack("<II", 0, 1) + struct.pack("<II", 1, 1)
    wrap = struct.pack("<III", 4, 0, 0).ljust(12, b"\0") + struct.pack("<I", 2)
    records = [leaf(CLIPS["one"]), leaf(CLIPS["two"]), pick, wrap, leaf(CLIPS["two"])]
    offsets, at = [], 4 + 4 * len(records)
    for r in records:
        offsets.append(at)
        at += len(r)
    sounds = struct.pack("<I", len(records)) + struct.pack(f"<{len(records)}I", *offsets) + b"".join(records)

    def event(sound):
        return struct.pack("<IIII", 0, 0, 0, 1) + struct.pack("<IIII", 0, 0, 0, sound).ljust(24, b"\0")
    named = murmur64_hash(EVENT.encode()) >> 32
    table = sorted([(named, 3), (ALONE, 4)])
    head = 4 + 8 * len(table)
    events = struct.pack("<I", len(table)) + b"".join(struct.pack("<II", h, head + 40 * i) for i, (h, _) in enumerate(table)) \
        + b"".join(event(s) for _, s in table)
    start = 4 + 28
    return struct.pack("<I7I", 0x61914940, 0, 0, start, start + len(sounds), start + len(sounds) + len(events), 0, 0) \
        + sounds + events


def bundle_of(payload):
    out = struct.pack("<III", hd1.VERSION, len(payload), 0)
    for at in range(0, len(payload), hd1.CHUNK):
        body = zlib.compress(payload[at:at + hd1.CHUNK].ljust(hd1.CHUNK, b"\0"))
        out += struct.pack("<I", len(body)) + body
    return out


def text_table(lines):
    """A `strings` resource: a magic, a count, keys and offsets sorted by key, then the text."""
    keyed = sorted((murmur64_hash(k.encode()) >> 32, v.encode() + b"\0") for k, v in lines.items())
    at, rows, body = 8 + 8 * len(keyed), b"", b""
    for key, text in keyed:
        rows += struct.pack("<II", key, at + len(body))
        body += text
    return struct.pack("<II", 0x3E85F3AE, len(keyed)) + rows + body


@pytest.fixture
def game(tmp_path, monkeypatch):
    monkeypatch.setattr(hd1, "CACHE_DIR", tmp_path / "cache")
    contents = tmp_path / "contents"
    contents.mkdir()
    en, en_stream = bank(1000)
    fr, fr_stream = bank(2000)
    m = master()
    other = 7
    resources = [(other, 1, [(0, b"x" * 10, 100)]), (hd1.BANK, BANK_NAME, [(0, en, len(en_stream)), (0x100, fr, len(fr_stream))]),
                 (hd1.MASTER, 2, [(0, m, 0)]),
                 (hd1.STRINGS, 3, [(0, text_table({"dia_admiral_missionc_easy2": LINE["en"], "enc_bug_tank": "TANK"}), 0),
                                   (0x100, text_table({"dia_admiral_missionc_easy2": LINE["fr"], "enc_bug_tank": "CHAR D'ASSAUT"}), 0)])]
    payload = struct.pack("<I", len(resources)) + bytes(256 + 16 * len(resources))
    for kind, name, variants in resources:
        payload += struct.pack("<QQII", kind, name, len(variants), 0)
        payload += b"".join(struct.pack("<III", lang, len(data), stream) for lang, data, stream in variants)
        payload += b"".join(data for _, data, _ in variants)
    name = "0123456789abcdef"
    (contents / name).write_bytes(bundle_of(payload))
    (contents / f"{name}.stream").write_bytes(b"s" * 100 + en_stream + fr_stream)
    return contents


def item_of(h, name):
    return next(i for c in h.categories("en") for s in c["sections"] for i in s["items"] if i["name"] == name)


def test_a_game_is_read_and_kept(game, monkeypatch):
    h = hd1.Hd1.read(game)
    assert sorted(h.langs[CLIPS["one"]]) == [0, 0x100]
    assert h.events[murmur64_hash(EVENT.encode()) >> 32] == [CLIPS["one"], CLIPS["two"]]
    assert h.where[hd1.source(CLIPS["one"])][1][5] == 50.0  # samples and rate from the clip's header
    monkeypatch.setattr(hd1, "scan", lambda *_: pytest.fail("read again with nothing changed"))
    assert hd1.Hd1.read(game).where.keys() == h.where.keys()
    os.utime(game / "0123456789abcdef", (1, 1))  # an update: read again
    called = []
    monkeypatch.setattr(hd1, "scan", lambda c: called.append(c) or {"banks": [], "events": {}})
    hd1.Hd1.read(game)
    assert called == [game]


def test_a_named_event_is_an_item_with_a_part_per_language(game):
    h = hd1.Hd1.read(game)
    voices = next(c for c in h.categories("en") if c["id"] == "hd1/voices")
    assert voices["game"] == "hd1" and [s["name"] for s in voices["sections"]] == ["Admiral"]
    it = item_of(h, "Mission Complete Easy 2")
    assert it["game"] == "hd1" and it["count"] == 2 and it["en"] == EVENT and it["full"] == "Admiral Mission Complete Easy 2"
    assert [p["name"] for p in it["parts"]] == ["English", "French"]
    view = h.view(it["parts"][1]["cue"])
    slots = view["segments_detail"][0]["stems"][0]["slots"]
    assert [s["source"] for s in slots] == [str(hd1.source(c, 0x100)) for c in (CLIPS["one"], CLIPS["two"])]
    assert [s["stream"] for s in slots] == [str(CLIPS["one"]), str(CLIPS["two"])]
    assert [s["label"] for s in slots] == ["Take 1", "Take 2"] and slots[0]["duration_ms"] == 50.0


def test_a_voice_item_says_the_line_shown_on_screen_in_the_language_in_use(game):
    h = hd1.Hd1.read(game)
    assert item_of(h, "Mission Complete Easy 2")["about"] == "Well done, Helldiver. … stands."
    fr = next(c for c in h.categories("fr") if c["id"] == "hd1/voices")["sections"][0]["items"][0]
    assert fr["about"] == "Bravo, Helldiver."


def test_a_name_finds_its_place_in_the_index_by_its_first_words():
    assert hd1._place("chr_bug_tank_growl") == ("bugs", "@enc_bug_tank", 3)
    assert hd1._place("wep_ar_carbine_fire") == ("weapons", "@weapon_carbine", 3)
    assert hd1._place("wep_ar_reload_done") == ("weapons", "Assault Rifles", 2)
    assert hd1._place("game_hellbomb_explode")[:2] == ("stratagems", "@stratagem_hellbomb")
    assert hd1._place("game_complete") == ("other", "", 1)
    assert hd1._place("vo_soldier1_generic_01") == ("voices", "soldier1", 2)
    assert hd1._place("vo_ammolow") == ("voices", "helldiver", 1)
    assert hd1._place("something_new") == ("other", "", 0)


def test_a_section_goes_by_the_game_text_in_the_language_in_use(game):
    h = hd1.Hd1.read(game)
    assert h._name("@enc_bug_tank", "en") == "Tank" and h._name("@enc_bug_tank", "fr") == "Char d'assaut"
    assert h._name("@enc_cyborg_hulk", "en") == "Hulk"  # not in this table: said some way
    assert h._name("admiral", "en") == "Admiral" and h._name("", "en") == ""


def test_the_unnamed_stay_out_of_the_index_and_in_their_bank(game):
    h = hd1.Hd1.read(game)
    assert [c["id"] for c in h.categories("en")] == ["hd1/voices"]
    rows = h.archives("en")
    assert [(r["id"], r["item"], r["names"], r["game"], r["sounds"], r["banks"], r["language"]) for r in rows] == \
        [(f"{BANK_NAME:016x}", f"hd1:bank:{BANK_NAME:016x}", ["Mission Complete Easy 2"], "hd1", 3, 2, "2 languages")]  # by its few events
    assert rows[0]["tags"] == [{"category": "hd1/voices", "name": "Voices"}]
    it = h.item(rows[0]["item"])
    assert [p["name"] for p in it["parts"]] == ["English", "French"] and it["game"] == "hd1"
    view = h.view(it["parts"][1]["cue"])
    assert [g["name"] for g in view["segments_detail"]] == ["Admiral Mission Complete Easy 2", "Clips No Event Plays"]
    assert view["slots"] == [str(hd1.source(c, 0x100)) for c in CLIPS.values()]


@pytest.mark.parametrize("flag,tone", [(0, 1000), (0x100, 2000)])
def test_a_clip_comes_back_whole_from_after_the_resources_before_it(game, flag, tone):
    h = hd1.Hd1.read(game)
    with wave.open(str(h.wav(hd1.source(CLIPS["two"], flag)))) as w:
        assert (w.getnframes(), w.getframerate(), w.getnchannels()) == (SAMPLES, 48000, 1)
        assert set(struct.iter_unpack("<h", w.readframes(SAMPLES))) == {(tone + 1,)}


def test_a_clip_id_leads_to_the_events_that_play_it(game):
    h = hd1.Hd1.read(game)
    h.categories("en")
    named = f"hd1:{murmur64_hash(EVENT.encode()) >> 32:08x}"
    bank = f"{BANK_NAME:016x}"
    assert [(p["item"], p["archives"]) for p in h.places(CLIPS["two"])] == [(named, [bank])]  # the named ones only
    assert [(p["item"], p["cue"], p["archives"]) for p in h.places(CLIPS["left"])] == [(f"hd1:bank:{bank}", f"hd1:bank:{bank}", [bank])]
    assert h.places(1) == []


def test_labels_leave_out_what_the_index_says():
    assert hd1.label("fs_rock_run", 1) == "Rock Run"
    assert hd1.label("wep_ar_reload_done", 1) == "AR Reload Done"
    assert hd1.label("chr_fs_initiate_gravel_left", 2) == "Initiate Gravel Left"
    assert hd1.label("vo_admiral_low_missionc_easy3", 2) == "Low Mission Complete Easy 3"
    assert hd1.label("wep_railgun_magins", 2) == "Magazine In"


def test_only_the_game_folder_counts(tmp_path, monkeypatch):
    monkeypatch.setenv("HD1_CONTENTS", str(tmp_path))
    assert hd1.locate() == (None, None)
    (tmp_path / "0123456789abcdef").write_bytes(b"")
    assert hd1.locate() == (tmp_path, "env")


def test_a_folder_chosen_comes_before_the_rest(tmp_path, monkeypatch):
    monkeypatch.delenv("HD1_CONTENTS", raising=False)
    install = tmp_path / "Helldivers"
    (install / "contents").mkdir(parents=True)
    (install / "contents" / "0123456789abcdef").write_bytes(b"")
    assert hd1.contents_folder(install) == hd1.contents_folder(install / "contents") == install / "contents"
    assert hd1.locate(str(install)) == (install / "contents", "chosen")
    assert hd1.locate(str(tmp_path / "nothing")) == (None, None)
    with pytest.raises(ValueError, match="no Helldivers 1 files"):
        hd1.contents_folder(tmp_path)


def test_settings_can_point_at_another_folder(game, tmp_path, monkeypatch):
    from audiodiver import editor
    from audiodiver.editor import EditorError, Session
    monkeypatch.setattr(editor, "SETTINGS_FILE", tmp_path / "settings.json")
    monkeypatch.delenv("HD1_CONTENTS", raising=False)
    monkeypatch.setattr(hd1, "steam_libraries", lambda: [])
    s = Session(load=False)
    s.stage = "ready"
    with pytest.raises(EditorError, match="no Helldivers 1 files"):
        s.set_hd1_folder(str(tmp_path / "elsewhere"))
    assert editor.load_settings().get("hd1_contents") is None  # a wrong folder changes nothing
    got = s.set_hd1_folder(str(tmp_path))
    assert got["hd1_folder"] == {"path": str(game), "how": "chosen", "chosen": str(game)} and s.hd1
    assert s.set_hd1_folder(None)["hd1_folder"] == {"path": None, "how": None, "chosen": None} and not s.hd1
