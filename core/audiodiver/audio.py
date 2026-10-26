"""Audio helpers for the editor: waveform peaks for drawing, and sample-exact slicing of one song into pieces."""
import array
import hashlib
import json
import math
import re
import shutil
import subprocess
import tempfile
import threading
import wave
from pathlib import Path

from . import wem
from .index import CACHE_DIR

PEAK_RATE = 8000
SILENCE_MS = 100  # the built-in silence: long enough for every encoder and the game, short enough to move straight on
_durations: dict = {}  # (path, mtime, size) -> ms
_locks: dict = {}
_locks_guard = threading.Lock()


def cache_lock(path) -> threading.Lock:
    """One lock per cache file. The player and the waveform ask for the same audio at the same moment; without
    this, both decode it into the same temp file and one of them fails."""
    with _locks_guard:
        return _locks.setdefault(str(path), threading.Lock())


def silence_wav() -> Path:
    """The audio of a slot replaced with silence: a tenth of a second of 48 kHz stereo, kept with the caches and
    written again if it goes missing. Projects only say "silence", so no file of theirs is involved."""
    out = CACHE_DIR / "silence" / f"{SILENCE_MS}ms.wav"
    with cache_lock(out):
        if not out.exists():
            out.parent.mkdir(parents=True, exist_ok=True)
            tmp = out.with_name(f"{SILENCE_MS}ms.partial.wav")
            with wave.open(str(tmp), "wb") as w:
                w.setnchannels(2)
                w.setsampwidth(2)
                w.setframerate(48000)
                w.writeframes(bytes(4 * 48 * SILENCE_MS))
            tmp.replace(out)
    return out


def peaks(path: Path, buckets: int = 1200) -> dict:
    """{duration_ms, peaks: [0..255] * buckets}: the loudest sample in each slice of the file (cached)."""
    path = Path(path)
    st = path.stat()
    key = hashlib.sha1(f"{path.resolve()}:{st.st_mtime_ns}:{st.st_size}:{buckets}".encode()).hexdigest()[:16]
    cache = CACHE_DIR / "peaks" / f"{key}.json"
    with cache_lock(cache):
        if cache.exists():
            return json.loads(cache.read_text())
        d = _peaks(path, buckets)
        cache.parent.mkdir(parents=True, exist_ok=True)
        tmp = cache.with_suffix(".partial")
        tmp.write_text(json.dumps(d))
        tmp.replace(cache)
    return d


def _peaks(path: Path, buckets: int) -> dict:
    raw = subprocess.run([wem.FFMPEG, "-v", "error", "-i", wem.decoded(path), "-ac", "1", "-ar", str(PEAK_RATE),
                          "-f", "s16le", "-"], capture_output=True, check=True).stdout
    try:  # numpy (installed with the renderer) does a song's 100,000 buckets at once; the loop below is the same
        import numpy as np
    except ImportError:
        np = None
    if np is not None and len(raw) >= 2:
        a = np.abs(np.frombuffer(raw[:len(raw) // 2 * 2], dtype="<i2").astype(np.int32))
        n = len(a)
        starts = np.minimum((np.arange(buckets) * n) // buckets, n - 1)  # an empty bucket takes its first sample
        top = np.maximum.reduceat(a, starts)
        return {"duration_ms": round(n * 1000 / PEAK_RATE, 1),
                "peaks": np.minimum(255, top * 255 // 32767).astype(int).tolist()}
    samples = array.array("h")
    samples.frombytes(raw[:len(raw) // 2 * 2])
    n = len(samples)
    out = []
    for i in range(buckets):
        chunk = samples[i * n // buckets:max((i + 1) * n // buckets, i * n // buckets + 1)]
        out.append(min(255, max(max(chunk, default=0), -min(chunk, default=0)) * 255 // 32767) if chunk else 0)
    return {"duration_ms": round(n * 1000 / PEAK_RATE, 1), "peaks": out}


def duration_ms(path) -> float | None:
    """The length of an audio file in ms (cached by path, time and size), or None when it can't be read."""
    path = Path(path)
    try:
        st = path.stat()
    except OSError:
        return None
    key = (str(path.resolve()), st.st_mtime_ns, st.st_size)
    if key not in _durations:
        _durations[key] = _probe_ms(path)
    return _durations[key]


def _probe_ms(path: Path) -> float | None:
    try:
        path = Path(wem.decoded(path))
    except (subprocess.CalledProcessError, OSError):
        return None
    try:  # PCM WAV: from the header, no process
        with wave.open(str(path)) as w:
            return round(w.getnframes() * 1000 / w.getframerate(), 1)
    except (wave.Error, EOFError, OSError):
        pass
    try:
        out = subprocess.run([wem.FFPROBE, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
                              str(path)], capture_output=True, text=True, timeout=30).stdout.strip()
        return round(float(out) * 1000, 1)
    except (ValueError, OSError, subprocess.SubprocessError):
        return None


def natural(path) -> list:
    """Sort key for file names that puts "Track 2" before "Track 10"."""
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", Path(path).name)]


MIN_PIECE_MS = 100  # the slice tool's shortest piece (MIN_PIECE in SliceTool.tsx)


def slice_folder(project_dir: Path, src: Path, legacy=False) -> Path:
    """Where a project keeps the pieces of one song: a folder per song in its audio/slices (named after the song, and
    told apart from other songs of the same name by their paths). legacy: where projects kept them before, in a
    slices folder beside the project file, which several projects could share."""
    src = Path(src)
    tag = hashlib.sha1(str(src.resolve()).lower().encode()).hexdigest()[:6]
    return Path(project_dir) / ("slices" if legacy else "audio/slices") / f"{src.stem}-{tag}"


def slice_song(src: Path, bounds_ms: list[float], song_dir: Path) -> list[Path]:
    """Cuts src at bounds_ms (N+1 ascending boundaries -> N pieces) into 48 kHz WAVs, exact to the sample, so
    pieces that play back to back sound like the uncut song. Returns the piece paths, in order.

    Each set of cuts gets a folder of its own in song_dir, named after the cuts: slicing again never deletes or
    overwrites pieces that slots may still play (this project's, its undo history's, another project's), and the
    same cuts give the same files. Everything is checked before anything is written."""
    src, song_dir = Path(src), Path(song_dir)
    try:
        bounds = [float(b) for b in bounds_ms]
    except (TypeError, ValueError):
        raise ValueError("Cut points are numbers of milliseconds") from None
    if len(bounds) < 2 or not all(math.isfinite(b) and b >= 0 for b in bounds) \
            or any(b <= a for a, b in zip(bounds, bounds[1:])):
        raise ValueError("Cut points must be ascending, with at least a start and an end")
    with tempfile.TemporaryDirectory() as tmp:
        full = Path(tmp) / "full.wav"
        try:
            wem.prepare_wav(str(src), str(full))
        except (subprocess.CalledProcessError, OSError):
            raise ValueError(f"Can't read the audio in {src.name}") from None
        with wave.open(str(full)) as w:
            params, total = w.getparams(), w.getnframes()
            frames = [min(total, round(b * wem.RATE / 1000)) for b in bounds]
            if frames[-1] <= frames[0]:
                raise ValueError("The cut points lie outside the song")
            for i, (a, b) in enumerate(zip(frames, frames[1:]), 1):
                if (b - a) * 1000 / wem.RATE < MIN_PIECE_MS:
                    raise ValueError(f"Piece {i} is shorter than {MIN_PIECE_MS / 1000:g} s" if b > a else
                                     f"Piece {i} is empty: the song ends before it")
            key = hashlib.sha1(json.dumps(frames).encode()).hexdigest()[:8]
            out_dir = song_dir / key
            digits = max(2, len(str(len(frames) - 1)))
            names = [out_dir / f"{i:0{digits}d} {src.stem}.wav" for i in range(1, len(frames))]
            if not all(p.is_file() for p in names):  # the same cuts made earlier: their files are these
                part = song_dir / f".{key}.partial"
                shutil.rmtree(part, ignore_errors=True)
                part.mkdir(parents=True)
                for (a, b), piece in zip(zip(frames, frames[1:]), names):
                    w.setpos(a)
                    with wave.open(str(part / piece.name), "wb") as o:
                        o.setparams(params)
                        o.writeframes(w.readframes(b - a))
                shutil.rmtree(out_dir, ignore_errors=True)  # a set left incomplete by a crash
                part.rename(out_dir)
    (song_dir / "cuts.json").write_text(json.dumps({"audio": str(src.resolve()), "bounds_ms": bounds}, indent=1))
    return names


def previous_cuts(out_dir: Path, src: Path) -> list[float] | None:
    """The boundaries last used to slice src into out_dir, if any."""
    f = Path(out_dir) / "cuts.json"
    try:
        d = json.loads(f.read_text())
        return d["bounds_ms"] if Path(d["audio"]) == Path(src).resolve() else None
    except (OSError, ValueError, KeyError):
        return None
