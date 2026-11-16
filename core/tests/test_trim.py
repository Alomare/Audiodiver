"""Where new audio starts and ends in its file, and the silence before it (Replacement.start_ms, end_ms, delay_ms):
baked into what plays, as the fades are, so previews, waveforms and both games' builds hear the same."""
import json
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
