"""Curves on music tracks (clip automation): read, shown, dropped per clip by a project's switch, and kept from a mod. The
mods here are the game's banks with one track edited, as a modding tool saves it: no example mod has curves."""
import struct
import time

import pytest

from audiodiver import bank as wbank, build, music, patch
from audiodiver.addition import from_patch
from audiodiver.editor import Session
from audiodiver.project import Project

TRACK, CLIP = 990527808, 41628611  # Hellpod Descent: the clip with a volume curve and a fade-in
OTHER_CLIP = 200968094             # the other, which has none
FLAT = [(0.0, 0.0, 4), (46.0, 0.0, 4)]


def track_body(curves=(), sources=(11, 22), tail=b"tail"):
    """A MusicTrack as far as curves go: sources, flags, clips, the sub-track count, curves, then the rest."""
    head = struct.pack("<I", len(sources)) + b"".join(struct.pack("<IBIII", 0, 0, s, 0, 0)[:18].ljust(18, b"\0") for s in sources) + b"\0"
    items = struct.pack("<I", len(sources)) + b"".join(struct.pack("<IIII", 0, s, 0, 0) + struct.pack("<dddd", 0, 0, 0, 1) for s in sources)
    return head + items + struct.pack("<I", 1) + struct.pack("<I", len(curves)) + b"".join(c.to_bytes() for c in curves) + tail


def curve(clip, kind, *values, source=0):
    return music.ClipCurve(clip, kind, [(float(i), float(v), 4) for i, v in enumerate(values)], source)


def test_curves_are_read_and_written_back_as_they_were():
    body = track_body([curve(0, 0, 0, -0.5), curve(1, 3, 0, 1)])
    got = music.curves_of(body)
    assert [(c.clip, c.kind, c.source, len(c.points)) for c in got] == [(0, 0, 11, 2), (1, 3, 22, 2)]
    assert music.with_curves(body, got) == body
    assert music.clip_sources(body) == [11, 22]


def test_replacing_curves_keeps_what_comes_after_them():
    body = track_body([curve(0, 0, 0, -0.5)])
    new = music.with_curves(body, [curve(1, 4, 1, 0, 0)])
    assert new.endswith(b"tail") and [(c.clip, c.kind, c.source) for c in music.curves_of(new)] == [(1, 4, 22)]
    assert music.curves_of(music.with_curves(body, [curve(5, 0, 0)])) == []  # a clip the track doesn't have


def test_a_clip_loses_its_level_curves_and_keeps_its_filters_and_the_other_clips_curves():
    body = track_body([curve(0, 0, 0, -0.5), curve(0, 3, 0, 1), curve(0, 1, 70, 80), curve(1, 0, 0, -0.1)])
    got = music.curves_of(music.without_level_curves(body, {11}))
    assert [(c.clip, c.kind) for c in got] == [(0, 1), (1, 0)]
    assert music.without_level_curves(body, {99}) == body


def test_what_a_mod_does_to_a_curve_is_told_apart():
    game = track_body([curve(0, 0, 0, -0.5), curve(0, 3, 0, 1), curve(1, 0, 0, -0.1)])
    assert music.dropped_curves(game, music.without_level_curves(game, {11})) == {11}
    assert music.dropped_curves(game, game) is None
    edited = music.with_curves(game, [curve(0, 0, 0, -0.9), curve(0, 3, 0, 1), curve(1, 0, 0, -0.1)])
    assert music.dropped_curves(game, edited) is None  # changed, not taken away
    half = music.with_curves(game, [curve(0, 3, 0, 1), curve(1, 0, 0, -0.1)])
    assert music.dropped_curves(game, half) is None    # the fade stays: only the mod's own curves say what it plays


def test_a_slot_is_shown_the_curves_that_shape_the_level():
    got = music.curves_of(track_body([curve(0, 0, 0, -0.5), curve(0, 1, 70, 80), curve(1, 3, 0, 1)]))
    assert music.level_view(got, 11) == {"volume": [[0.0, 0.0], [1000.0, -0.5]]}
    assert music.level_view(got, 22) == {"fade_in": [[0.0, 0.0], [1000.0, 1.0]]}
    assert music.level_view(got, 99) == {}


def test_a_project_keeps_its_curve_settings(tmp_path):
    p = Project(name="C", path=tmp_path / "c.audi", library=[])
    p.curves_off, p.curves = {41628611}, {TRACK: [curve(0, 0, 0, -0.5, source=CLIP).to_json()]}
    again = Project.from_json(p.to_json(), p.path)
    assert again.curves_off == {41628611} and again.curves == p.curves
    bare = Project(name="B", path=tmp_path / "b.audi", library=[]).to_json()
    assert "curves" not in bare and "curves_off" not in bare


# --- on the game's banks


def _mod(path, ix, change):
    """A patch of every bank that has the track, with the track as change(body) gives it."""
    banks, deps = {}, {}
    for bid in ix.copies(TRACK):
        raw, dep = ix.bank_files(bid)
        banks[bid], _ = patch._with_objects(raw, lambda t, i, b: change(b) if i == TRACK else None)
        if dep:
            deps[bid] = dep
    path.parent.mkdir(parents=True, exist_ok=True)
    patch.write_patch(str(path), {}, banks, deps)
    return path


def _edited(body):
    return music.with_curves(body, [music.ClipCurve(c.clip, c.kind, FLAT if c.kind == 0 else c.points, c.source) for c in music.curves_of(body)])


def _tracks(path):
    """{bank: the bytes of the track in a built patch}."""
    return {bid: hirc[TRACK][1] for bid, (_, hirc) in patch.read_patch(str(path))[0].items() if TRACK in hirc}


def _built(s, tmp_path):
    zip_path = build.build(s.project, s.ix, tmp_path / "out", log=lambda *a: None)
    import zipfile
    out = tmp_path / "unzipped"
    with zipfile.ZipFile(zip_path) as z:
        z.extractall(out)
    return next(p for p in out.rglob("*.patch_0"))


def _wait(s, job):
    while (j := s.job(job["id"]))["state"] == "running":
        time.sleep(0.2)
    return j


@pytest.mark.game
def test_the_switch_drops_the_curve_in_every_copy_of_the_track_and_nothing_else(tmp_path):
    s = Session()
    s.wait_ready()
    assert s.catalog.cm.curves[CLIP][TRACK]["volume"][-1][1] < -0.5  # as the game has it
    s.new_project(tmp_path / "off.audi", "Off")
    st = s.keep_curve([str(CLIP)], False)
    assert st["curves_off"] == [str(CLIP)] and st["undo_label"] == "curve"
    built = _tracks(_built(s, tmp_path))
    assert set(built) == set(s.ix.copies(TRACK))
    for body in built.values():
        kinds = [c.kind for c in music.curves_of(body)]
        assert not set(kinds) & set(music.LEVEL_CURVES)
    assert s.undo()["curves_off"] == []
    assert s.keep_curve([str(CLIP)], True)["curves_off"] == []


@pytest.mark.game
def test_a_view_draws_the_curve_of_its_slot(tmp_path):
    s = Session()
    s.wait_ready()
    cue = next(e for e in s.cues() if e.get("name") == "Hellpod Descent")
    slots = {sl["source"]: sl for g in s.cue(cue["id"])["segments_detail"] for st in g["stems"] for sl in st["slots"]}
    assert slots[str(CLIP)]["curve"]["volume"][0] == [0.0, 0.0] and "fade_in" in slots[str(CLIP)]["curve"]
    assert "curve" not in slots[str(OTHER_CLIP)]


@pytest.mark.game
def test_a_mods_curve_comes_in_with_an_import_and_goes_out_with_a_build(tmp_path):
    s = Session()
    s.wait_ready()
    mod = _mod(tmp_path / "mod" / "046d4441a6dae0a9.patch_0", s.ix, _edited)
    got = from_patch(s.ix, patch.diff(str(mod), s.ix))
    assert set(got.curves) == {TRACK} and not got.curves_off and not got.other
    s.new_project(tmp_path / "in.audi", "In")
    j = _wait(s, s.import_patch(str(mod)))
    assert j["state"] == "done", j
    assert set(s.project.curves) == {TRACK}
    built = _tracks(_built(s, tmp_path))
    assert set(built) == set(s.ix.copies(TRACK))
    game = next(b for t, i, b in music.iter_hirc(wbank.hirc(s.ix.bank_files(s.ix.copies(TRACK)[0])[0])) if i == TRACK)
    want = music.curves_of(_edited(game))
    assert all(music.curves_of(b) == want for b in built.values())


@pytest.mark.game
def test_a_build_with_a_curve_switched_off_reads_back_as_the_switch(tmp_path):
    """So Import and Repatch keep it: a mod made with the switch reads as the switch, not as other changes."""
    s = Session()
    s.wait_ready()
    s.new_project(tmp_path / "a.audi", "A")
    s.keep_curve([str(CLIP)], False)
    built = _built(s, tmp_path)
    got = from_patch(s.ix, patch.diff(str(built), s.ix))
    assert got.curves_off == {CLIP} and not got.curves and not got.other
