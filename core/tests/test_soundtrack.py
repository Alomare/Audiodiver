"""The Soundtrack (soundtrack.py): playlist trees rewritten, fights played as the game plays them, and builds that
change every copy of the music objects."""
import math
import random
import struct
import wave

import pytest

from audiodiver import music, soundtrack as st
from audiodiver.project import Project

BATTLE, INTENSE, EXPLORING = 841554794, 213690393, 1071111299  # Illuminate battle, intense and exploring music


def item(seg=0, iid=0, rs=0, loop=1, children=()):
    return music.PlaylistItem(seg, iid, rs, loop, 0, 0, 50000, 1, 1, 0, list(children))


def illuminate():
    """The shape of the Illuminate battle music: a step group of segments, then a group of openings the music
    starts on (CS∞(SS∞(A..F) SR(M N O)))."""
    main = item(iid=10, rs=st.SS, loop=0, children=[item(seg=100 + i, iid=20 + i) for i in range(6)])
    openings = item(iid=30, rs=st.SR, children=[item(seg=200 + i, iid=40 + i) for i in range(3)])
    return item(iid=1, rs=st.CS, loop=0, children=[main, openings])


def segs(tree):
    return [it.segment_id for _, it in tree.walk() if it.segment_id]


def tone(path, seconds):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(48000)
        w.writeframes(b"".join(struct.pack("<hh", v, v) for v in
                               (int(6000 * math.sin(i / 15)) for i in range(int(48000 * seconds)))))
    return path


def test_a_song_plays_from_its_first_segment_after_the_openings():
    root = illuminate()
    new = st.song_root(root, [100, 101, 102], entry=30)
    assert (new.rs_type, new.loop) == (st.CS, 0)
    song, openings = new.children
    assert segs(song) == [100, 101, 102] and (song.rs_type, song.loop) == (st.CS, 0)
    assert openings.item_id == 30 and segs(openings) == [200, 201, 202]
    assert len(st.items(new)) == sum(1 for _ in new.walk())  # no item id twice
    assert st.song_segments(root, 30) == [100, 101, 102, 103, 104, 105]
    shuffled = st.song_root(root, [100, 101, 102], entry=30, shuffle=True).children[0]
    assert shuffled.rs_type == st.CR and shuffled.avoid_repeat == 2


def test_openings_a_level_down_stay_and_the_rest_is_the_song():
    """The Automatons' intense music has its openings beside the music a level down, and an empty group beside
    that: SS∞(CS∞(SS∞(A B C) SS(M N)) CS())."""
    main = item(iid=11, rs=st.SS, loop=0, children=[item(seg=100 + i, iid=20 + i) for i in range(3)])
    opens = item(iid=12, rs=st.SS, children=[item(seg=200, iid=40), item(seg=201, iid=41)])
    root = item(iid=1, rs=st.SS, loop=0, children=[item(iid=10, rs=st.CS, loop=0, children=[main, opens]), item(iid=13)])
    assert st.entry_branch(root, 12) is opens
    assert st.song_segments(root, 12) == [100, 101, 102]
    new = st.song_root(root, [100, 101], entry=12)
    assert segs(new.children[0]) == [100, 101] and new.children[1].item_id == 12
    assert segs(st.pruned(root, {40, 41})) == [100, 101, 102]


def test_fights_go_on_in_the_game_and_start_over_in_a_song():
    root, rng = illuminate(), random.Random(3)
    length = lambda seg: 10_000.0
    state = {}
    first = st.fight(root, 30, state, 40_000, length, rng)
    second = st.fight(root, 30, state, 40_000, length, rng)
    assert first[0] in (200, 201, 202) and first[1:] == [100, 101, 102]
    assert second[1:] == [103, 104, 105]  # the step group goes on from where it stopped
    new, state = st.song_root(root, [100, 101, 102], entry=30), {}
    for _ in range(3):
        assert st.fight(new, 30, state, 40_000, length, rng)[1:] == [100, 101, 102]


def test_a_playlist_that_resumes_goes_on_with_the_next_song_at_each_fight():
    root, rng = illuminate(), random.Random(5)
    length = lambda seg: 10_000.0
    new = st.song_root(root, [100, 101, 102], entry=30, resume=True)
    assert new.children[0].rs_type == st.SS
    state = {}
    assert [st.fight(new, 30, state, 20_000, length, rng)[1] for _ in range(4)] == [100, 101, 102, 100]
    shuffled = st.song_root(root, [100, 101, 102], entry=30, shuffle=True, resume=True).children[0]
    assert shuffled.rs_type == st.SR and shuffled.avoid_repeat == 2


def test_items_left_out_go_and_take_empty_groups_with_them():
    root = illuminate()
    kept = st.pruned(root, {21, 40, 41, 42})
    assert segs(kept) == [100, 102, 103, 104, 105] and len(kept.children) == 1
    assert st.pruned(root, {1}) is None


def test_the_project_file_keeps_the_soundtrack(tmp_path):
    p = Project(name="S", path=tmp_path / "s.audi")
    p.soundtrack = {BATTLE: st.Piece("song", [1, 2], gain_db=-3.0), INTENSE: st.Piece("same", follows=BATTLE)}
    p.save()
    back = Project.load(tmp_path / "s.audi")
    assert back.soundtrack == p.soundtrack
    assert back.to_json()["soundtrack"][str(INTENSE)] == {"mode": "same", "follows": str(BATTLE)}
    with pytest.raises(ValueError):
        st.Piece.from_json({"mode": "loud"})
    assert st.Piece.from_json({"mode": "original", "gain_db": 500}).gain_db == 96.0
    kept = st.Piece("tracks", [1], shuffle=True, resume=True, song="")
    assert st.Piece.from_json(kept.to_json()) == kept
    assert st.Piece.from_json({"mode": "song", "segments": ["1"], "song": "audio/a.wav"}).song == "audio/a.wav"


def test_the_project_file_keeps_its_tabs(tmp_path):
    Project(name="T", path=tmp_path / "t.audi", tabs=["text", "editor"]).save()
    assert Project.load(tmp_path / "t.audi").tabs == ["editor", "text"]  # in the tab bar's order
    Project(name="U", path=tmp_path / "u.audi").save()
    assert "tabs" not in Project.load(tmp_path / "u.audi").to_json()  # as Settings says
    bad = Project.from_json({"name": "V", "tabs": ["editor", "music"]})
    assert bad.tabs is None and bad.repairs == ["the tabs"]


@pytest.fixture(scope="module")
def game_session():
    from audiodiver.editor import Session
    s = Session()
    s.wait_ready()
    return s


@pytest.mark.game
def test_a_song_build_changes_every_copy_of_the_music(game_session, tmp_path):
    """A song in the Illuminate battle music and the intense music following it: the build rewrites the playlist
    and the switch in every bank that has a copy, the check passes, and a fight in the preview opens with one of the
    game's openings and then plays the song from its first piece."""
    from audiodiver import patch
    from audiodiver.build import make_patch
    s = game_session
    s.new_project(tmp_path / "s.audi", "S")
    m = s.playlist_map(BATTLE)
    assert m["entry"] != "0" and len(m["song"]) == 12 and m["mine"] is None
    state = s.song_fill(BATTLE, str(tone(tmp_path / "song.wav", 3.0)), [0, 1000, 2000, 3000])
    assert state["soundtrack"][str(BATTLE)] == {"mode": "song", "segments": m["song"][:3], "song": "song.wav"}
    assert s.playlist_map(BATTLE)["mine"]["children"][0]["children"][0]["segment"] == m["song"][0]
    s.soundtrack_set({str(INTENSE): {"mode": "same", "follows": str(BATTLE)}})
    tracks = [str(tone(tmp_path / f"{n} track.wav", 1.0)) for n in (1, 2)]
    assert s.tracks_fill(EXPLORING, tracks, shuffle=True)["soundtrack"][str(EXPLORING)]["shuffle"] is True
    edits = make_patch(s.project, s.ix, tmp_path, log=lambda *_: None)  # verified
    assert {b for b, e in edits.items() if BATTLE in e.music} == set(s.ix.copies(BATTLE))
    banks, _ = patch.read_patch(str(tmp_path / "9ba626afa44a3aa3.patch_0"))
    for bid in s.ix.copies(BATTLE):
        t, body = banks[bid][1][BATTLE]
        new = music.MusicPlaylist.read(BATTLE, music.Reader(bytes(body)))
        assert [str(x) for x in segs(new.root.children[0])] == m["song"][:3]
    fight = s.play_through(BATTLE, "mine", fight={"ms": 10_000})
    assert fight["marks"][1]["segment"] == m["song"][0] and fight["state"]
    with pytest.raises(Exception, match="Same song"):
        s.soundtrack_set({str(INTENSE): {"mode": "same", "follows": str(INTENSE)}})


@pytest.mark.game
def test_a_playlist_takes_songs_place_by_place_and_copies_to_other_music(game_session, tmp_path):
    """Songs put into chosen places, moved and taken out as one step each; the playlist then copied to the
    intense music, each song at the same place. A new project takes the tabs it is given."""
    s = game_session
    assert s.new_project(tmp_path / "p.audi", "P", tabs=["text", "editor"])["tabs"] == ["editor", "text"]
    a, b, c = (str(tone(tmp_path / f"{n}.wav", 1.0)) for n in "abc")
    m = s.playlist_map(BATTLE)
    song = lambda seg: s._song_of(s.project, BATTLE, int(seg))
    piece = s.playlist_set(BATTLE, [None, {"file": a}, None, {"file": b}])["soundtrack"][str(BATTLE)]
    assert piece == {"mode": "tracks", "segments": [m["song"][1], m["song"][3]]}
    # b to the first place, a out, c into the third
    piece = s.playlist_set(BATTLE, [{"keep": 3}, None, {"file": c}], shuffle=True, resume=True)["soundtrack"][str(BATTLE)]
    assert piece == {"mode": "tracks", "segments": [m["song"][0], m["song"][2]], "shuffle": True, "resume": True}
    assert song(m["song"][0]).audio == "b.wav" and song(m["song"][2]).audio == "c.wav"
    assert song(m["song"][1]) is None and song(m["song"][3]) is None  # the places emptied lost their audio
    with pytest.raises(Exception, match="places for songs"):
        s.playlist_set(BATTLE, [None] * (len(m["song"]) + 1))
    copied = s.soundtrack_copy(BATTLE, {str(INTENSE): None})
    mi = s.playlist_map(INTENSE)
    assert copied["short"] == [] and copied["soundtrack"][str(INTENSE)]["segments"] == [mi["song"][0], mi["song"][2]]
    assert s._song_of(s.project, INTENSE, int(mi["song"][2])).audio == "c.wav"


@pytest.mark.game
def test_tracks_leave_at_the_next_bar(game_session):
    """A whole song in a segment: the rules that would wait for its Exit leave at the next bar, with a fade."""
    objs = game_session._music()
    segs = st.song_segments(objs[BATTLE].root, st.entry_item(objs, BATTLE))[:2]
    p = st.plan(objs, {BATTLE: st.Piece("tracks", segs)})
    waiting = [(o, r) for o in objs.values() for r in getattr(o, "rules", [])
               if r.sync_type == st.EXIT_MARKER and p.prompt & set(r.sources)]
    assert waiting and {o.id for o, _ in waiting} <= p.objects
    import copy
    o, r = waiting[0]
    o = copy.deepcopy(o)
    assert st.change(o, p)
    changed = next(x for x in o.rules if x.sources == r.sources and x.destinations == r.destinations)
    assert changed.sync_type == st.NEXT_BAR and changed.src_fade.time_ms >= st.TRACK_FADE_MS
