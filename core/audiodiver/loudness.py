"""How loud an audio file sounds, to match new audio to the original's (Session.match_loudness).

ITU-R BS.1770: the audio K-weighted (a high shelf, then a high-pass), its mean square summed over the channels, in
blocks of 400 ms that start every 100 ms, as LUFS. A file is measured one of two ways, and both files of a match the
same way, chosen by the original's length:

- "max": the loudest block (momentary loudness), for a sound under 3 s (a shot, a voice line): a tail or a pause
  doesn't pull it down. A file shorter than a block is one block of its own length.
- "integrated": the blocks over -70 LUFS, then those within 10 LU of their mean, averaged; for longer audio (music).

A silent file has no loudness (None). Results are cached by file (path, time, size).
"""
import functools
import hashlib
import json
import subprocess
from pathlib import Path

import numpy as np

from . import wem
from .audio import cache_lock
from .index import CACHE_DIR

RATE = 48000
HOP, HOPS = 4800, 4            # 100 ms; a block is four of them (400 ms)
SHORT_S = 3.0                  # an original shorter than this is matched by its loudest block
CHUNK = 64 * HOP               # samples filtered at a time (whole hops), so a song never sits whole in memory
TAPS = 8192                    # the K-weighting's impulse response, cut where it has died away (~30 ms)
# the K-weighting at 48 kHz (BS.1770-4): (b, a) of the shelf and of the high-pass
STAGES = (((1.53512485958697, -2.69169618940638, 1.19839281085285), (1.0, -1.69065929318241, 0.73248077421585)),
          ((1.0, -2.0, 1.0), (1.0, -1.99004745483398, 0.99007225036621)))


@functools.cache
def _impulse() -> np.ndarray:
    x = np.zeros(TAPS)
    x[0] = 1.0
    for b, a in STAGES:
        y = np.zeros(TAPS)
        for n in range(TAPS):
            y[n] = (b[0] * x[n] + (b[1] * x[n - 1] - a[1] * y[n - 1] if n else 0.0)
                    + (b[2] * x[n - 2] - a[2] * y[n - 2] if n > 1 else 0.0))
        x = y
    return x


def _decode(path) -> np.ndarray:
    """The file as float32 at 48 kHz, (frames, channels): its own channels, more than two mixed down to two."""
    path = wem.decoded(path)
    probe = subprocess.run([wem.FFPROBE, "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=channels",
                            "-of", "csv=p=0", path], capture_output=True, text=True, check=True)
    ch = 1 if probe.stdout.strip().split(",")[0] == "1" else 2
    raw = subprocess.run([wem.FFMPEG, "-v", "error", "-i", path, "-ac", str(ch), "-ar", str(RATE), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw[:len(raw) // (4 * ch) * 4 * ch], dtype="<f4").reshape(-1, ch)


def hop_energy(a: np.ndarray) -> np.ndarray:
    """The K-weighted energy of each 100 ms of the audio, summed over the channels (FFT convolution with the
    filter's impulse response, a chunk at a time)."""
    n = len(a)
    size = 1 << int(np.ceil(np.log2(CHUNK + TAPS - 1)))
    h = np.fft.rfft(_impulse(), size)[:, None]
    hops = -(-n // HOP)
    out = np.zeros(hops)
    carry = np.zeros((TAPS - 1, a.shape[1]))
    for at in range(0, n, CHUNK):
        part = a[at:at + CHUNK].astype(np.float64)
        y = np.fft.irfft(np.fft.rfft(part, size, axis=0) * h, size, axis=0)[:len(part) + TAPS - 1]
        y[:TAPS - 1] += carry
        carry = y[len(part):].copy()
        body = (y[:len(part)] ** 2).sum(axis=1)
        body = np.pad(body, (0, -len(body) % HOP))
        out[at // HOP:at // HOP + len(body) // HOP] = body.reshape(-1, HOP).sum(axis=1)
    return out


def from_energy(e: np.ndarray, mode: str, frames: int) -> float | None:
    """LUFS of hop energies (hop_energy) of audio this many frames long, by the loudest block ("max") or integrated;
    None when silent. Audio shorter than a block is one block of its own length."""
    blocks = np.array([e.sum() / max(frames, 1)]) if frames < HOP * HOPS \
        else np.convolve(e, np.ones(HOPS), "valid") / (HOP * HOPS)
    with np.errstate(divide="ignore"):
        lufs = -0.691 + 10 * np.log10(blocks)
    if mode == "max":
        top = lufs.max()
        return float(top) if top > -70 else None
    kept = blocks[lufs > -70]
    if not len(kept):
        return None
    gate = -0.691 + 10 * np.log10(kept.mean()) - 10
    kept = blocks[lufs > max(-70, gate)]
    return float(-0.691 + 10 * np.log10(kept.mean()))


def measure(path) -> dict:
    """{seconds, max, integrated} of an audio file (cached): its length, and its loudness both ways in LUFS (None
    when it is silent)."""
    path = Path(path)
    st = path.stat()
    key = hashlib.sha1(f"{path.resolve()}:{st.st_mtime_ns}:{st.st_size}".encode()).hexdigest()[:16]
    cache = CACHE_DIR / "loudness" / f"{key}.json"
    with cache_lock(cache):
        if cache.exists():
            return json.loads(cache.read_text())
        a = _decode(path)
        e = hop_energy(a)
        d = {"seconds": len(a) / RATE, "max": from_energy(e, "max", len(a)), "integrated": from_energy(e, "integrated", len(a))}
        cache.parent.mkdir(parents=True, exist_ok=True)
        tmp = cache.with_suffix(".partial")
        tmp.write_text(json.dumps(d))
        tmp.replace(cache)
    return d


def match_gain(original, new) -> float | None:
    """The gain in dB that makes `new` as loud as `original`, both measured the way the original's length asks for;
    None when either is silent."""
    o, n = measure(original), measure(new)
    mode = "max" if o["seconds"] < SHORT_S else "integrated"
    return None if o[mode] is None or n[mode] is None else o[mode] - n[mode]
