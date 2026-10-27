"""Audio the in-app tutorials put in slots, made here rather than shipped (the app's Tutorial.tsx asks for it through
Session.tutorial_audio): a laser shot and the echo after it, for "How to change the Liberator's firing sounds". The
same seed makes the same files every time. 48 kHz stereo, 16-bit, as the game's own clips are.

The shot is four layers: a click for the attack, a falling chirp with a second harmonic (the laser), band-limited
noise for the body and a falling sine under it. The echo is noise that darkens as it fades, with two quieter
repeats of the chirp."""
import wave
from pathlib import Path

import numpy as np

RATE = 48_000
KINDS = ("shot", "echo")


def _lowpass(x: np.ndarray, cutoff: float | np.ndarray) -> np.ndarray:
    """A one-pole low-pass, the cutoff in Hz (one value, or one per sample)."""
    a = np.exp(-2 * np.pi * np.broadcast_to(np.asarray(cutoff, dtype=np.float64), x.shape) / RATE)
    y, prev = np.empty_like(x), 0.0
    for i, (v, k) in enumerate(zip(x, a)):
        prev = (1 - k) * v + k * prev
        y[i] = prev
    return y


def _chirp(t: np.ndarray, f0: float, f1: float, sweep: float) -> np.ndarray:
    """A sine falling from f0 to f1 Hz over `sweep` seconds (exponentially), then holding f1."""
    k = np.log(f1 / f0) / sweep
    phase = np.where(t < sweep, f0 * (np.exp(k * t) - 1) / k, f0 * (np.exp(k * sweep) - 1) / k + f1 * (t - sweep))
    return np.sin(2 * np.pi * phase)


def shot(seed: int = 23) -> np.ndarray:
    """The laser shot, 0.45 s, (frames, 2) in -1..1."""
    rng = np.random.default_rng(seed)
    t = np.arange(int(0.45 * RATE)) / RATE
    attack = np.minimum(1.0, t / 0.002)
    click = np.diff(rng.standard_normal(len(t) + 1)) * np.exp(-t / 0.003) * 0.35
    laser = (_chirp(t, 2400, 160, 0.18) + 0.3 * _chirp(t, 4800, 320, 0.18)) * attack * np.exp(-t / 0.07) * 0.6
    sub = np.sin(2 * np.pi * (70 * t - 25 * t * t)) * attack * np.exp(-t / 0.09) * 0.55
    out = np.zeros((len(t), 2))
    for ch in range(2):  # the noise differs a little left and right, the tones sit in the middle
        body = _lowpass(rng.standard_normal(len(t)), 2500) * attack * np.exp(-t / 0.045) * 0.9
        out[:, ch] = click + laser + body + sub
    out = np.tanh(1.6 * out)
    return out / np.abs(out).max() * 10 ** (-1 / 20)


def echo(seed: int = 9) -> np.ndarray:
    """The echo after the shot, 2.6 s, (frames, 2) in -1..1, quieter than the shot (a peak of -8 dB)."""
    rng = np.random.default_rng(seed)
    t = np.arange(int(2.6 * RATE)) / RATE
    fade = np.exp(-np.maximum(0.0, t - 0.02) / 0.55) * np.minimum(1.0, t / 0.02)
    out = np.zeros((len(t), 2))
    cutoff = 200 + 2300 * np.exp(-t / 0.35)  # darker as it fades, as a far echo is
    for ch in range(2):
        out[:, ch] = _lowpass(_lowpass(rng.standard_normal(len(t)), cutoff), cutoff) * fade
    for delay, gain in ((0.18, 0.25), (0.42, 0.12)):  # two repeats of the laser, further and darker each time
        d = t - delay
        on = d >= 0
        tone = np.zeros_like(t)
        tone[on] = _chirp(d[on], 1600, 140, 0.18) * np.exp(-d[on] / 0.08) * gain
        tone = _lowpass(tone, 2000)
        out += tone[:, None]
    return out / np.abs(out).max() * 10 ** (-8 / 20)


def write(path: Path, kind: str) -> Path:
    """One of KINDS as a WAV file at path (its folder made if need be)."""
    audio = {"shot": shot, "echo": echo}[kind]()
    path.parent.mkdir(parents=True, exist_ok=True)
    pcm = (np.clip(audio, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(pcm.tobytes())
    return path
