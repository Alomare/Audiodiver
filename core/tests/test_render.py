"""The renderer on a hand-made cue (no game needed), then an export of real game music."""
import struct
import wave

import pytest

from audiodiver import render
from audiodiver.render import Mine, Renderer


def tone(path, seconds, level):
    """A WAV holding one constant sample value, so a mix can be checked by reading single samples."""
    with wave.open(str(path), "wb") as w:
        w.setparams((1, 2, render.RATE, 0, "NONE", ""))
        w.writeframes(struct.pack("<h", round(level * 32767)) * round(seconds * render.RATE))
    return path


def stem(source, play_at=0.0, begin=0.0, end=0.0, length=1000.0, type="normal", **more):
    return {"track": source, "type": type, "switch_group": 0, "switch_values": [], "slots": [{"source": source}],
            "clips": [{"source": source, "subtrack": 0, "play_at_ms": play_at, "begin_trim_ms": begin,
                       "end_trim_ms": end, "source_ms": length}], **more}


def segment(id, stems, duration=1000.0, entry=0.0, exit=1000.0):
    return {"segment": id, "duration_ms": duration, "entry_ms": entry, "exit_ms": exit, "stems": stems}


@pytest.fixture
def cue(tmp_path):
    files = {1: tone(tmp_path / "a.wav", 1, 0.25), 2: tone(tmp_path / "b.wav", 1, 0.5)}
    cue = {"segments": [segment(10, [stem(1)], exit=600.0), segment(20, [stem(2)], entry=200.0)],
           "playlist": {"rs": 0, "loop": 1, "children": [{"segment": 10, "loop": 1}, {"segment": 20, "loop": 1}]}}
    return cue, files.__getitem__, tmp_path


def at(audio, ms):
    return float(audio[render.frames(ms), 0])


def test_segments_hand_over_at_exit_with_overlap(cue):
    cue, vanilla, _ = cue
    audio, marks = Renderer(cue, vanilla).render()
    # segment 20's Entry (200 ms in) lands on segment 10's Exit (600 ms), so it starts at 400 ms
    assert [m["ms"] for m in marks] == [0.0, 600.0] and len(audio) == render.frames(1400)
    # and each mark says where its clips play, so a slot's waveform can show where the play-through is in it
    assert marks[1]["clips"] == [{"source": "2", "mine": False, "at_ms": 400.0, "offset_ms": 0.0, "length_ms": 1000.0}]
    assert at(audio, 100) == pytest.approx(0.25, abs=1e-3)
    assert at(audio, 500) == pytest.approx(0.75, abs=1e-3)   # ring-out of 10 over the lead-in of 20
    assert at(audio, 1200) == pytest.approx(0.5, abs=1e-3)


def test_stream_matches_one_big_mix(tmp_path):
    """Streaming keeps only the part still being mixed; the result must equal mixing everything in one buffer,
    also when a later segment's long lead-in reaches back over earlier ones."""
    import numpy as np
    files = {i: tone(tmp_path / f"{i}.wav", 1, 0.1 * i) for i in (1, 2, 3, 4)}
    segs = [segment(10, [stem(1)], exit=300.0), segment(20, [stem(2)], exit=250.0),
            segment(30, [stem(3)], entry=700.0), segment(40, [stem(4)], entry=100.0, exit=400.0)]
    cue = {"segments": segs, "playlist": {"rs": 0, "loop": 2, "children": [{"segment": s["segment"], "loop": 1} for s in segs]}}
    r = Renderer(cue, files.__getitem__)
    plans, starts, total, marks = r.layout()
    assert min(starts) == 0 and starts[2] < starts[1]   # segment 30 starts before segment 20 does
    big = np.zeros((render.frames(total), 2), dtype=np.float32)
    for (p, take), s in zip(plans, starts):
        a = r.segment(p.segment, None, take, p)
        big[render.frames(s):render.frames(s) + len(a)] += a[:len(big) - render.frames(s)]
    pieces = list(r.stream())
    assert len(pieces) > 1 and np.allclose(np.concatenate(pieces), big, atol=1e-6)
    seen = []
    list(r.stream(on_segment=lambda i, n, p: seen.append((i, n))))
    assert seen == [(i, 8) for i in range(8)]


def test_failed_write_leaves_no_file(cue, tmp_path, monkeypatch):
    cue, vanilla, _ = cue
    monkeypatch.setattr(render, "CACHE_DIR", tmp_path / "cache")

    def broken():
        yield Renderer(cue, vanilla).render()[0]
        raise RuntimeError("cancelled")
    out = tmp_path / "half.wav"
    with pytest.raises(RuntimeError):
        render.write(out, broken(), "wav")
    assert not out.exists() and not list((render.CACHE_DIR / "render").glob("spool-*"))


def test_spool_left_by_a_closed_export_is_cleaned(tmp_path, monkeypatch):
    import os
    import time
    monkeypatch.setattr(render, "CACHE_DIR", tmp_path)
    (tmp_path / "render").mkdir()
    old, live = tmp_path / "render" / "spool-old.f32", tmp_path / "render" / "spool-live.f32"
    old.write_bytes(b"x"); live.write_bytes(b"x")
    os.utime(old, (time.time() - 7200, time.time() - 7200))
    render.clean_spool()
    assert not old.exists() and live.exists()


def test_clip_offsets_and_trims():
    seg = segment(1, [stem(1, play_at=100.0, begin=200.0, end=-300.0)])
    plan = Renderer({"segments": [seg]}, None).plan(1)
    c = plan.clips[0]
    assert (c.start_ms, c.offset_ms, c.length_ms) == (300.0, 200.0, 500.0)


def test_project_changes_are_rendered(cue):
    cue, vanilla, tmp = cue
    mine = {1: Mine(tone(tmp / "mine.wav", 2, 0.1), gain_db=6.0206, fit_timing=True)}
    r = Renderer(cue, vanilla, mine)
    plan = r.plan(10)
    assert plan.changed and (plan.duration_ms, plan.entry_ms, plan.exit_ms) == (2000.0, 0.0, 2000.0)
    audio, marks = r.render()
    assert at(audio, 1000) == pytest.approx(0.2, abs=1e-3)          # my audio, 6 dB up
    assert marks[1]["ms"] == 2000.0 and not r.plan(20).changed
    # a moved Exit point pulls the next segment in
    audio, marks = Renderer(cue, vanilla, mine, {10: {"exit_marker": 1500.0}}).render()
    assert marks[1]["ms"] == 1500.0
    assert at(audio, 1700) == pytest.approx(0.2 + 0.5, abs=1e-3)


def test_gain_on_the_original_is_rendered(cue):
    """Make-Up Gain on an original clip (Project.gains) lifts it as a build would; new audio there plays with its own."""
    cue, vanilla, tmp = cue
    r = Renderer(cue, vanilla, originals={1: 6.0206})
    assert r.plan(10).changed and not r.plan(20).changed
    assert at(r.render()[0], 300) == pytest.approx(0.5, abs=1e-3)  # the original, 6 dB up
    mine = {1: Mine(tone(tmp / "mine.wav", 1, 0.1), fit_timing=False)}
    assert at(Renderer(cue, vanilla, mine, originals={1: 6.0206}).render()[0], 300) == pytest.approx(0.1, abs=1e-3)


def test_playlist_order():
    leaf = lambda s, loop=1: {"segment": s, "loop": loop}
    segs = [segment(i, []) for i in (1, 2, 3)]
    # an intro, then a step group the game cycles forever: one full round per loop asked for
    tree = {"rs": 0, "loop": 0, "children": [leaf(1), {"rs": 1, "loop": 0, "children": [leaf(2), leaf(3)]}]}
    r = Renderer({"segments": segs, "playlist": tree}, None)
    assert r.order(1) == [1, 2, 3] and r.order(2) == [1, 2, 3, 2, 3]
    tree = {"rs": 0, "loop": 2, "children": [leaf(1, 2), leaf(2)]}
    assert Renderer({"segments": segs, "playlist": tree}, None).order(5) == [1, 1, 2, 1, 1, 2]
    assert not r.has_random()


def test_switch_variants():
    st = stem(1, type="switch")
    st.update(switch_group=7, switch_values=[70, 71], slots=[{"source": 1}, {"source": 2}])
    st["clips"].append({**st["clips"][0], "source": 2, "subtrack": 1})
    r = Renderer({"segments": [segment(1, [st])]}, None)
    assert r.switch_groups() == {7: [70, 71]}
    assert [c.source for c in r.plan(1, {7: 71}).clips] == [2]
    assert [c.source for c in r.plan(1).clips] == [1]
    assert render.variant_sets({7: [70, 71]}) == [{7: 70}, {7: 71}] and render.variant_sets({}) == [{}]


def test_write_formats_and_clipping(cue, tmp_path):
    cue, vanilla, _ = cue
    audio, _ = Renderer(cue, vanilla).render()
    for fmt, (ext, _) in render.FORMATS.items():
        out = tmp_path / f"x-{fmt}.{ext}"
        assert render.write(out, audio, fmt, {"title": "t"}) == 0.0 and out.stat().st_size > 1000
    assert render.write(tmp_path / "loud.wav", audio * 4, "wav") == pytest.approx(-9.54, abs=0.05)


@pytest.mark.game
def test_export_game_music(tmp_path):
    import time
    from audiodiver.editor import Session
    s = Session()
    s.wait_ready()
    loadout = "716451767"
    assert s.export_options(loadout)["playlist"]

    def run(**o):
        job = s.export(loadout, str(tmp_path / o["what"]), **o)
        while (job := s.job(job["id"]))["state"] == "running":
            time.sleep(0.2)
        assert job["state"] == "done", job
        return job["result"], sorted(p.name for p in (tmp_path / o["what"]).iterdir())

    first = s.cue(loadout)["segments_detail"][1]["stems"][0]["slots"][0]["source"]
    result, names = run(what="slots", fmt="mp3", sources=[first])
    assert result["files"] == 1 and names == ["Hellpod - Loadout Selection - 02 Loadout #1 (original).mp3"]
    result, names = run(what="segments", fmt="flac")
    assert result["files"] == 15 and names[0] == "Hellpod - Loadout Selection - 01 Loadout Start (original).flac"
    result, names = run(what="cue", fmt="wav")
    assert names == ["Hellpod - Loadout Selection (original).wav"]
    with wave.open(result["first"]) as w:  # played through, hand-overs make it shorter than the slots laid end to end
        assert 150 < w.getnframes() / w.getframerate() < 200
    with pytest.raises(Exception):
        s.export(loadout, str(tmp_path), whose="mine")  # no project open
    # progress, and cancelling a long export
    job = s.export("547769336", str(tmp_path / "cancel"), what="cue", fmt="wav")
    while not (j := s.job(job["id"]))["done"] and j["state"] == "running":
        time.sleep(0.02)
    assert j["total"] > 10 and "of" in j["doing"]
    s.cancel_job(job["id"])
    while (j := s.job(job["id"]))["state"] == "running":
        time.sleep(0.05)
    assert j["state"] == "cancelled" and not list((tmp_path / "cancel").iterdir())
