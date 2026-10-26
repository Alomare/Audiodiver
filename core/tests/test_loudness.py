"""loudness.py on made tones (no game needed): BS.1770 values, a clip shorter than a block, silence, the gate."""
import wave

import numpy as np
import pytest

from audiodiver import loudness


def sine(path, seconds, amp, channels=1, hz=1000):
    """A WAV of a sine at 48 kHz, the same on every channel; `amp` may be an array (a level that changes)."""
    t = np.arange(int(48000 * seconds)) / 48000
    a = np.clip(amp * np.sin(2 * np.pi * hz * t), -1, 1)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(channels); w.setsampwidth(2); w.setframerate(48000)
        w.writeframes(np.repeat((a * 32767).astype("<i2"), channels).tobytes())
    return path


def test_a_tone_reads_as_bs1770_says(tmp_path):
    """A 1 kHz sine 20 dB under full scale is -23.0 LUFS on one channel and 3 dB more on two (ffmpeg's ebur128 reads
    the same); a clip shorter than a block (400 ms) by its own length, where ebur128 gives up (-70)."""
    m = loudness.measure(sine(tmp_path / "a.wav", 2, 0.1))
    assert m["max"] == pytest.approx(-23.0, abs=0.05) and m["integrated"] == pytest.approx(-23.0, abs=0.05)
    assert loudness.measure(sine(tmp_path / "b.wav", 2, 0.1, channels=2))["integrated"] == pytest.approx(-20.0, abs=0.05)
    short = loudness.measure(sine(tmp_path / "c.wav", 0.3, 0.1))
    assert short["seconds"] == pytest.approx(0.3) and short["max"] == pytest.approx(-23.0, abs=0.05)
    assert loudness.measure(sine(tmp_path / "d.wav", 1, 0.0)) == {"seconds": 1.0, "max": None, "integrated": None}


def test_the_match_goes_by_the_loudest_moment_for_short_sounds_and_the_whole_for_long_ones(tmp_path):
    """Matched to a 2 s tone, a tone of a quarter of its level needs +12 dB; one loud for 1 s then quiet for 1 s
    needs nothing (its loudest moment is as loud). Matched to 8 s of music, the quiet half counts too, less the part
    the relative gate leaves out."""
    a = sine(tmp_path / "a.wav", 2, 0.1)
    assert loudness.match_gain(a, sine(tmp_path / "b.wav", 2, 0.025)) == pytest.approx(12.04, abs=0.05)
    half = np.where(np.arange(96000) < 48000, 0.1, 0.01)
    assert loudness.match_gain(a, sine(tmp_path / "c.wav", 2, half)) == pytest.approx(0.0, abs=0.05)
    long = sine(tmp_path / "d.wav", 8, 0.1)
    steps = np.where(np.arange(48000 * 8) < 48000 * 4, 0.1, 0.05)  # 4 s at -23 LUFS, 4 s 6 dB under (inside the gate)
    assert loudness.match_gain(long, sine(tmp_path / "e.wav", 8, steps)) == pytest.approx(2.0, abs=0.2)
    assert loudness.match_gain(a, sine(tmp_path / "f.wav", 1, 0.0)) is None
