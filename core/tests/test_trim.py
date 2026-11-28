"""Where new audio starts and ends in its file, and the silence before it (Replacement.start_ms, end_ms, delay_ms):
baked into what plays, as the fades are, so previews, waveforms and both games' builds hear the same."""
import json
from pathlib import Path
import struct
import wave

import numpy as np
import pytest

from audiodiver import audio
from audiodiver.editor import EditorError, Session
from audiodiver.project import Project, Replacement, heard_ms


def ramp(path, seconds=1.0, rate=48000):
    """A mono WAV whose every sample says where it is: sample i holds i // 2 (up to 24000)."""
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate)
        w.writeframes(b"".join(struct.pack("<h", min(i // 2, 32767)) for i in range(int(rate * seconds))))
    return path


def samples(path):
    with wave.open(str(path)) as w:
        return np.frombuffer(w.readframes(w.getnframes()), "<i2").reshape(-1, w.getnchannels())[:, 0]


def test_the_stretch_plays_after_the_delay_and_the_fades_shape_the_audio_not_the_silence(tmp_path):
    src = ramp(tmp_path / "r.wav")
    v = samples(audio.faded(src, 0, 0, start_ms=250, end_ms=750, delay_ms=100))
    assert len(v) == 4800 + 24000  # 100 ms of silence, then 500 ms of the file
    assert not v[:4800].any() and v[4800] == 12000 / 2 * 2 // 2 and v[-1] == (36000 - 1) // 2
    v = samples(audio.faded(src, 100, 0, start_ms=500, delay_ms=50))
    assert len(v) == 2400 + 24000 and not v[:2400].any()
    assert v[2400] == 0 and v[2400 + 4800 + 10] > 0.9 * ((24000 + 4810) // 2)  # the fade starts with the audio
    assert audio.faded(src, 0, 0) != audio.faded(src, 0, 0, delay_ms=1)  # each shape kept apart
    r = Replacement(1, "r.wav", start_ms=250, end_ms=750, delay_ms=100)
    assert heard_ms(r, 1000.0) == 600.0 and heard_ms(Replacement(1, "r.wav", end_ms=5000), 1000.0) == 1000.0
    assert heard_ms(Replacement(1, "", silence=True, delay_ms=50), 20.0) == 20.0


def test_the_project_file_keeps_the_trim_and_leaves_it_out_when_there_is_none(tmp_path):
    p = Project(name="P", path=tmp_path / "p.audi", replacements=[Replacement(5, "a.wav", start_ms=10.0, delay_ms=20.0)])
    d = p.to_json()
    assert d["replacements"][0]["start_ms"] == 10.0 and d["replacements"][0]["delay_ms"] == 20.0
    assert "end_ms" not in d["replacements"][0]
    q = Project.from_json(d, tmp_path / "p.audi")
    assert (q.replacements[0].start_ms, q.replacements[0].end_ms, q.replacements[0].delay_ms) == (10.0, 0.0, 20.0)
    d["replacements"][0]["delay_ms"] = -5
    q = Project.from_json(d, tmp_path / "p.audi")  # repaired, as a fade out of range is
    assert q.replacements[0].delay_ms == 0.0 and q.repairs


def test_trim_set_checks_the_values_is_one_undo_step_and_a_new_file_starts_untrimmed(tmp_path):
    s = Session(load=False)
    s.new_project(tmp_path / "m.audi", "M")
    a, b = ramp(tmp_path / "a.wav"), ramp(tmp_path / "b.wav")
    s._edit("assign", lambda p: s._set(p, 1234, str(a)))
    st = s.trim_set(1234, 200, 900, 50)
    got = st["assignments"]["1234"]
    assert (got["start_ms"], got["end_ms"], got["delay_ms"], got["duration_ms"], got["file_ms"]) == (200, 900, 50, 750, 1000)
    heard = samples(s.project_audio(1234))
    assert len(heard) == round(0.75 * 48000)
    assert json.loads((tmp_path / "m.audi").read_text())["replacements"][0]["end_ms"] == 900
    assert s.trim_set(1234, 0, 1000, 0)["assignments"]["1234"]["end_ms"] == 0  # at the file's end: none
    assert s.undo()["assignments"]["1234"]["start_ms"] == 200
    for bad in [(-1, 0, 0), (0, 0, 4_000_000), (995, 0, 0), (500, 505, 0), (True, 0, 0)]:
        with pytest.raises(EditorError):
            s.trim_set(1234, *bad)
    with pytest.raises(EditorError, match="no new audio"):
        s.trim_set(99, 0, 0, 0)
    s._edit("assign", lambda p: s._set(p, 1234, str(a)))  # the same file again keeps the trim
    assert s.project.replacements[0].start_ms == 200
    s._edit("assign", lambda p: s._set(p, 1234, str(b)))  # another file: none
    assert (s.project.replacements[0].start_ms, s.project.replacements[0].delay_ms) == (0.0, 0.0)


def test_blocks_play_their_stretches_at_their_times_and_overlaps_add_up(tmp_path):
    """The Waveform Suite's blocks (audio.edited): each a stretch of the file at a time of its own, with a gain and
    fades; silence where none plays; overlapping blocks added up."""
    from audiodiver.project import Block
    src = ramp(tmp_path / "r.wav")
    v = samples(audio.edited(src, [Block(0, 100, 0), Block(500, 600, 200)]))
    assert len(v) == round(0.3 * 48000)  # the last block ends at 300 ms
    assert v[4800 - 1] == (4800 - 1) // 2 and not v[4800:9600].any()  # the first block, then silence
    assert v[9600] == 24000 // 2  # the second block plays the file from 500 ms
    both = samples(audio.edited(src, [Block(100, 200, 0), Block(100, 200, 0)]))  # the same stretch twice: twice as loud
    assert both[100] == 2 * ((4800 + 100) // 2)
    quiet = samples(audio.edited(src, [Block(100, 200, 0, gain_db=-6.0206)]))
    assert abs(int(quiet[100]) - (4800 + 100) // 4) <= 1
    faded_in = samples(audio.edited(src, [Block(500, 1000, 0, fade_in_ms=100)]))
    assert faded_in[0] == 0 and faded_in[4800 + 10] > 0.9 * ((24000 + 4810) // 2)
    r = Replacement(1, "r.wav", blocks=[Block(0, 100, 900), Block(0, 500, 0)])
    assert r.shaped and heard_ms(r, 1000.0) == 1000.0


def test_the_project_file_keeps_blocks_and_repairs_bad_ones(tmp_path):
    from audiodiver.project import Block
    p = Project(name="P", path=tmp_path / "p.audi",
                replacements=[Replacement(5, "a.wav", blocks=[Block(0, 100, 50, gain_db=-3), Block(200, 300)])])
    d = p.to_json()
    assert d["replacements"][0]["blocks"] == [{"start_ms": 0, "end_ms": 100, "at_ms": 50, "gain_db": -3},
                                              {"start_ms": 200, "end_ms": 300}]
    assert "blocks" not in Project(name="P", replacements=[Replacement(5, "a.wav")]).to_json()["replacements"][0]
    q = Project.from_json(json.loads(json.dumps(d)), tmp_path / "p.audi")
    assert q.replacements[0].blocks == p.replacements[0].blocks and not q.repairs
    d["replacements"][0]["blocks"].append({"start_ms": 50, "end_ms": 10})  # plays nothing: dropped
    d["replacements"][0]["blocks"][0]["gain_db"] = 99
    q = Project.from_json(d, tmp_path / "p.audi")
    assert len(q.replacements[0].blocks) == 2 and q.replacements[0].blocks[0].gain_db == 24 and q.repairs


def test_edit_set_keeps_a_plain_trim_as_one_and_splits_as_blocks(tmp_path):
    s = Session(load=False)
    s.new_project(tmp_path / "m.audi", "M")
    a = ramp(tmp_path / "a.wav")
    s._edit("assign", lambda p: s._set(p, 1234, str(a)))
    got = s.edit_set(1234, [{"start_ms": 100, "end_ms": 600, "at_ms": 30, "fade_in_ms": 20}])["assignments"]["1234"]
    assert (got["start_ms"], got["end_ms"], got["delay_ms"], got["fade_in_ms"], got["blocks"]) == (100, 600, 30, 20, [])
    two = [{"start_ms": 0, "end_ms": 400, "at_ms": 0, "fade_out_ms": 50}, {"start_ms": 600, "end_ms": 1000, "at_ms": 350}]
    got = s.edit_set(1234, two)["assignments"]["1234"]
    assert len(got["blocks"]) == 2 and got["start_ms"] == 0 and got["duration_ms"] == 750
    assert len(samples(s.project_audio(1234))) == round(0.75 * 48000)
    assert s.fades_set([1234], fade_out_ms=80)["assignments"]["1234"]["blocks"][1]["fade_out_ms"] == 80
    assert s.undo()["assignments"]["1234"]["blocks"][1]["fade_out_ms"] == 0
    whole = s.edit_set(1234, [{"start_ms": 0, "end_ms": 1000, "at_ms": 0}])["assignments"]["1234"]
    assert whole["blocks"] == [] and not s.project.replacements[0].shaped  # the file as it is
    for bad in ([{"start_ms": 0, "end_ms": 5}], [{"start_ms": 0, "end_ms": 500, "gain_db": 99}], "x"):
        with pytest.raises(EditorError):
            s.edit_set(1234, bad)
    with pytest.raises(EditorError, match="no new audio"):
        s.edit_set(99, [])
    s.edit_set(1234, two)
    s._edit("assign", lambda p: s._set(p, 1234, str(ramp(tmp_path / "b.wav"))))  # another file: none
    assert s.project.replacements[0].blocks == []


def test_several_files_make_one_clip_and_the_project_lists_them_all(tmp_path):
    """Blocks with an audio of their own: an empty slot takes the first block's file, the others stay named on their
    blocks, and packs, moves and the missing-file check count them (projectfiles.uses)."""
    from audiodiver import projectfiles as pf
    s = Session(load=False)
    s.new_project(tmp_path / "m.audi", "M")
    (tmp_path / "in").mkdir()
    a, b = ramp(tmp_path / "in" / "a.wav"), ramp(tmp_path / "in" / "b.wav", 0.5)
    got = s.edit_set(77, [{"start_ms": 0, "end_ms": 1000, "at_ms": 0, "audio": str(a)},
                          {"start_ms": 0, "end_ms": 500, "at_ms": 900, "audio": str(b), "fade_in_ms": 100}])["assignments"]["77"]
    assert got["audio"] == "in/a.wav" and [x["audio"] for x in got["blocks"]] == ["", "in/b.wav"]
    assert got["duration_ms"] == 1400 and len(samples(s.project_audio(77))) == round(1.4 * 48000)
    assert s.project.files_of(s.project.replacements[0]) == ["in/a.wav", "in/b.wav"]
    assert pf.uses(s.project.to_json(), tmp_path) == {tmp_path / "in" / "a.wav", tmp_path / "in" / "b.wav"}
    moved = pf.rebase(s.project.to_json(), tmp_path, tmp_path / "sub")
    assert moved["replacements"][0]["blocks"][1]["audio"] == "../in/b.wav"
    b.unlink()
    assert any(k == "missing_file" and "b.wav" in t for k, t in s.project.problem_list())


def test_edit_export_writes_the_blocks_as_one_file_and_changes_nothing(tmp_path):
    """The Waveform Suite's Export: the blocks it sends (the layers ticked) mixed into one file, in the format, rate
    and channels asked for, normalized to -1 dB when asked; the project stays as it was."""
    from audiodiver import wem
    if not wem.has_ffmpeg():
        pytest.skip("needs ffmpeg")
    s = Session(load=False)
    s.new_project(tmp_path / "m.audi", "M")
    a = ramp(tmp_path / "a.wav")
    s._edit("assign", lambda p: s._set(p, 1234, str(a)))
    before = (tmp_path / "m.audi").read_text()
    blocks = [{"start_ms": 0, "end_ms": 400, "at_ms": 0}, {"start_ms": 0, "end_ms": 400, "at_ms": 300, "layer": 1}]
    one = lambda b: [{"source": 1234, "blocks": b}]  # noqa: E731
    got = s.edit_export(one(blocks), str(tmp_path / "out.mp3"), "wav16", 44100, 2, True)
    out = tmp_path / "out.wav"
    assert got["path"] == str(out)  # the extension follows the format
    with wave.open(str(out)) as w:
        assert (w.getframerate(), w.getnchannels(), w.getsampwidth()) == (44100, 2, 2)
        assert abs(w.getnframes() - round(0.7 * 44100)) < 50
        v = np.frombuffer(w.readframes(w.getnframes()), "<i2")
    assert abs(np.abs(v.astype(int)).max() / 32768 - 10 ** (-1 / 20)) < 0.01  # normalized to -1 dB
    assert (tmp_path / "m.audi").read_text() == before and not s.project.replacements[0].blocks
    assert Path(s.edit_export(one(blocks[:1]), str(tmp_path / "x"), "flac")["path"]).suffix == ".flac"
    for bad in [("ogg", 22050, 0), ("aiff", 48000, 0), ("wav24", 48000, 6)]:
        with pytest.raises(EditorError):
            s.edit_export(one(blocks), str(tmp_path / "y.wav"), *bad)
    with pytest.raises(EditorError, match="Nothing to export"):
        s.edit_export([{"source": 99, "blocks": []}], str(tmp_path / "z.wav"))
    # several tracks (the Segment view's slots) add up into one file, as long as the longest
    b = ramp(tmp_path / "b.wav", 1.5)
    s._edit("assign", lambda p: s._set(p, 77, str(b)))
    s.edit_export([{"source": 1234, "blocks": blocks[:1]}, {"source": 77, "blocks": [{"start_ms": 0, "end_ms": 1500}]}],
                  str(tmp_path / "both.wav"), "wav16")
    with wave.open(str(tmp_path / "both.wav")) as w:
        assert abs(w.getnframes() - 72000) < 10
        both = np.frombuffer(w.readframes(w.getnframes()), "<i2").astype(int)
    assert both[4800] == 2 * (4800 // 2)  # 100 ms in: both ramps at the same sample, added


def test_edit_render_saves_a_file_target_as_a_new_file(tmp_path):
    """A song edited in the Waveform Suite (a file, not a slot) becomes a new file in audio/edited, numbered when the
    name is taken; the file it came from stays as it was, and the project doesn't change."""
    s = Session(load=False)
    s.new_project(tmp_path / "m.audi", "M")
    song = ramp(tmp_path / "Song.wav")
    before = song.read_bytes()
    got = Path(s.edit_render(str(song), [{"start_ms": 200, "end_ms": 700, "at_ms": 0, "fade_out_ms": 100}])["path"])
    assert got == tmp_path / "audio" / "edited" / "Song (edited).wav" and len(samples(got)) == 24000
    again = Path(s.edit_render(str(got), [{"start_ms": 0, "end_ms": 300}])["path"])
    assert again.name == "Song (edited 2).wav" and len(samples(again)) == 14400
    assert song.read_bytes() == before and not s.project.replacements
    with pytest.raises(EditorError, match="Nothing to save"):
        s.edit_render(str(song), [])


def test_edit_merge_mixes_blocks_into_one_new_file(tmp_path):
    """Merge: blocks of one track mixed as they play, from 0: a gap is silence and an overlap adds up; saved in
    audio/edited as <name> (merged).wav, numbered when taken. A slot's own file and other files both go in."""
    s = Session(load=False)
    s.new_project(tmp_path / "m.audi", "M")
    a = ramp(tmp_path / "a.wav")
    s._edit("assign", lambda p: s._set(p, 1234, str(a)))
    blocks = [{"start_ms": 0, "end_ms": 200, "at_ms": 0}, {"start_ms": 0, "end_ms": 200, "at_ms": 300},
              {"start_ms": 0, "end_ms": 200, "at_ms": 400, "audio": str(a)}]
    got = s.edit_merge(blocks, name="Slot: one", source=1234)
    v = samples(got["path"])
    assert Path(got["path"]) == tmp_path / "audio" / "edited" / "Slot one (merged).wav"  # a name made safe for a file
    assert len(v) == 28800 and abs(got["duration_ms"] - 600) < 1  # 0..200, silence, 300..500 and 400..600
    assert v[100] == 50 and not v[9600:14400].any()  # the first block, then the gap
    assert v[19200 + 10] == (4800 + 10) // 2 + 10 // 2  # 400 ms: the second block's 100 ms and the third's start, added
    assert Path(s.edit_merge(blocks[:2], name="Slot: one", source=1234)["path"]).name == "Slot one (merged 2).wav"
    with pytest.raises(EditorError, match="two blocks"):
        s.edit_merge(blocks[:1], source=1234)
    assert len(s.project.replacements) == 1 and not s.project.replacements[0].blocks  # the project doesn't change


def test_layers_place_blocks_in_the_editor_and_play_the_same(tmp_path):
    """A block's layer (the Waveform Suite's lane) is kept, left out of the file when it is the first, repaired when
    out of range, and doesn't change the audio: moving a block to another layer makes the same file."""
    from audiodiver.project import Block
    s = Session(load=False)
    s.new_project(tmp_path / "m.audi", "M")
    a = ramp(tmp_path / "a.wav")
    s._edit("assign", lambda p: s._set(p, 1234, str(a)))
    two = [{"start_ms": 0, "end_ms": 400, "at_ms": 0}, {"start_ms": 0, "end_ms": 400, "at_ms": 200, "layer": 2}]
    got = s.edit_set(1234, two)["assignments"]["1234"]
    assert [x["layer"] for x in got["blocks"]] == [0, 2]
    heard = s.project_audio(1234)
    saved = json.loads((tmp_path / "m.audi").read_text())["replacements"][0]["blocks"]
    assert "layer" not in saved[0] and saved[1]["layer"] == 2
    two[1]["layer"] = 0
    s.edit_set(1234, two)
    assert s.project_audio(1234) == heard  # the same audio, from the same cached render
    for bad in (-1, 32, 1.5, True):
        with pytest.raises(EditorError):
            s.edit_set(1234, [{"start_ms": 0, "end_ms": 400, "layer": bad}, two[1]])
    d = Project(name="P", replacements=[Replacement(5, "a.wav", blocks=[Block(0, 100, layer=3)])]).to_json()
    d["replacements"][0]["blocks"].append({"start_ms": 0, "end_ms": 100, "layer": 99})
    q = Project.from_json(d, tmp_path / "p.audi")
    assert [b.layer for b in q.replacements[0].blocks] == [3, 31] and q.repairs


def test_a_volume_curve_shapes_the_block_at_the_times_of_its_file(tmp_path):
    """A block's volume curve: points at times of the file with a level, a straight line between them and the edge
    levels held beyond; kept in the project, left out without points, and checked (a bad one is refused or dropped)."""
    from audiodiver.project import Block
    s = Session(load=False)
    s.new_project(tmp_path / "m.audi", "M")
    a = ramp(tmp_path / "a.wav")
    s._edit("assign", lambda p: s._set(p, 1234, str(a)))
    # the stretch from 200 ms of the file, played at 0: the curve goes by the file's time, from full at 200 to silence at 600
    got = s.edit_set(1234, [{"start_ms": 200, "end_ms": 800, "curve": [[600, 0], [200, 1]]}])["assignments"]["1234"]
    assert got["blocks"][0]["curve"] == [[200, 1], [600, 0]]
    v = samples(s.project_audio(1234))
    assert v[0] == 4800  # full: 200 ms into the ramp
    assert abs(v[9600] - 0.5 * ((9600 + 9600) // 2)) < 3  # 400 ms of the file: half way down
    assert not v[19200:].any()  # past the last point: its level, silence
    saved = json.loads((tmp_path / "m.audi").read_text())["replacements"][0]["blocks"][0]
    assert saved["curve"] == [[200, 1], [600, 0]]
    s.edit_set(1234, [{"start_ms": 200, "end_ms": 800, "gain_db": 1}])
    assert "curve" not in json.loads((tmp_path / "m.audi").read_text())["replacements"][0]["blocks"][0]
    for bad in ([[0]], [[0, "x"]], "no", [[0, 1]] * 257, [[0, True]]):
        with pytest.raises(EditorError):
            s.edit_set(1234, [{"start_ms": 0, "end_ms": 400, "curve": bad}])
    d = Project(name="P", replacements=[Replacement(5, "a.wav", blocks=[Block(0, 100, curve=[[0, 2], [50, -1]])])]).to_json()
    q = Project.from_json(d, tmp_path / "p.audi")
    assert q.replacements[0].blocks[0].curve == [[0, 1], [50, 0]]  # levels kept between silence and full
    d["replacements"][0]["blocks"][0]["curve"] = [["a", 1]]
    q = Project.from_json(d, tmp_path / "p.audi")
    assert q.replacements[0].blocks[0].curve == [] and q.repairs


@pytest.mark.skipif(not audio.wem.has_ffmpeg(), reason="needs ffmpeg")
def test_tempo_and_pitch_stretch_a_block_on_the_time_line(tmp_path):
    """A block at twice the tempo plays its stretch in half the time; linked to the pitch (12 semitones) it only
    resamples, so sample values keep their order; the project keeps both and leaves them out at their defaults."""
    s = Session(load=False)
    s.new_project(tmp_path / "m.audi", "M")
    a = ramp(tmp_path / "a.wav")
    s._edit("assign", lambda p: s._set(p, 1234, str(a)))
    got = s.edit_set(1234, [{"start_ms": 200, "end_ms": 800, "tempo": 2, "pitch": 12, "fade_in_ms": 900}])["assignments"]["1234"]
    b = got["blocks"][0]
    assert b["tempo"] == 2 and b["pitch"] == 12 and b["fade_in_ms"] == 300  # fades stay inside the 300 ms it plays
    v = samples(s.project_audio(1234))
    assert abs(len(v) - 0.3 * 48000) < 60
    assert v[len(v) // 4] < v[len(v) // 2] < v[3 * len(v) // 4]  # the ramp, in order: resampled, not stretched
    alone = s.edit_set(1234, [{"start_ms": 0, "end_ms": 1000, "tempo": 0.5}])["assignments"]["1234"]
    assert alone["duration_ms"] == pytest.approx(2000, abs=1)  # the pitch stays, the tempo halves: twice as long
    assert abs(len(samples(s.project_audio(1234))) - 96000) < 200
    saved = json.loads((tmp_path / "m.audi").read_text())["replacements"][0]["blocks"][0]
    assert saved["tempo"] == 0.5 and "pitch" not in saved
    s.edit_set(1234, [{"start_ms": 0, "end_ms": 1000, "gain_db": 1}])
    assert "tempo" not in json.loads((tmp_path / "m.audi").read_text())["replacements"][0]["blocks"][0]
    for bad in ({"tempo": 3}, {"tempo": 0}, {"pitch": 13}, {"pitch": True}):
        with pytest.raises(EditorError):
            s.edit_set(1234, [{"start_ms": 0, "end_ms": 400, **bad}])
    assert Path(s.edit_stretch(1.5, -2, file=str(a))["path"]).is_file()
