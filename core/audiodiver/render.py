"""Renders music the way the game plays it, for exports and for listening to a whole cue in the editor.

Three levels: a slot's own audio (`transcode`), a segment (its stems mixed on the segment's timeline, `Renderer.segment`)
and a whole cue (its segments in playlist order, each one's Entry point landing on the previous one's Exit point while
the ring-out and lead-in overlap, `Renderer.cue`). Every playlist in the game hands over that way: at the Exit cue,
playing post-exit and pre-entry, without fades.

With a project, the render applies what a build would: replaced audio, fit-to-clip timing, make-up gain and segment
cue-point overrides (the same rules as patch.patch_bank). What it does not model is the game's mixer: bus volumes,
ducking and the per-object volumes of the vanilla tracks, so levels are a guide, not a measurement.
"""
import itertools
import subprocess
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

from . import wem
from .index import CACHE_DIR

RATE = wem.RATE
AUDIO_CACHE_BYTES = 160 << 20  # decoded sources a Renderer keeps at hand
CONTINUOUS = (0, 2)   # music.RS_TYPES: a pass plays every child; the others (step) play one child per pass
RANDOM = (2, 3)
MAX_MINUTES = 30
FORMATS = {  # name -> (extension, ffmpeg output arguments)
    "wav": ("wav", ["-c:a", "pcm_s24le"]),
    "flac": ("flac", ["-c:a", "flac", "-sample_fmt", "s32", "-bits_per_raw_sample", "24"]),
    "mp3": ("mp3", ["-c:a", "libmp3lame", "-b:a", "320k", "-id3v2_version", "3"]),
    "mp3-vbr": ("mp3", ["-c:a", "libmp3lame", "-q:a", "0", "-id3v2_version", "3"]),
    "preview": ("wav", ["-c:a", "pcm_s16le"]),  # for listening in the editor, not offered as an export
}


class RenderError(Exception):
    pass


def frames(ms: float) -> int:
    return round(ms * RATE / 1000)


def load(path) -> np.ndarray:
    """Any audio file as float32 stereo at 48 kHz, shape (frames, 2). Mono goes to both sides at full level."""
    path = str(path)
    try:
        probe = subprocess.run([wem.FFPROBE, "-v", "error", "-select_streams", "a:0", "-show_entries",
                                "stream=channels", "-of", "csv=p=0", path], capture_output=True, text=True, check=True)
        ch = 1 if probe.stdout.strip().split(",")[0] == "1" else 2
        raw = subprocess.run([wem.FFMPEG, "-v", "error", "-i", path, "-ac", str(ch), "-ar", str(RATE),
                              "-f", "f32le", "-"], capture_output=True, check=True).stdout
    except subprocess.CalledProcessError as e:
        raise RenderError(f"can't read the audio in {Path(path).name}") from e
    a = np.frombuffer(raw[:len(raw) // (4 * ch) * 4 * ch], dtype="<f4").reshape(-1, ch)
    return np.repeat(a, 2, axis=1) if ch == 1 else a


def _tags(tags: dict | None) -> list[str]:
    return [x for k, v in (tags or {}).items() if v not in (None, "") for x in ("-metadata", f"{k}={v}")]


def write(path: Path, audio, fmt: str, tags: dict | None = None) -> float:
    """Encodes float32 stereo to path. `audio` is one array or an iterable of consecutive pieces (Renderer.stream),
    which are spooled to disk as they come, so a long cue never sits in memory. Audio that would clip is turned
    down as a whole; returns that change in dB (0 when untouched)."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    spool = CACHE_DIR / "render" / f"spool-{uuid.uuid4().hex[:10]}.f32"
    spool.parent.mkdir(parents=True, exist_ok=True)
    peak = 0.0
    try:
        with open(spool, "wb") as f:
            for piece in ([audio] if isinstance(audio, np.ndarray) else audio):
                if len(piece):
                    peak = max(peak, float(np.abs(piece).max()))
                    f.write(memoryview(np.ascontiguousarray(piece, dtype="<f4")).cast("B"))
        change = -20 * float(np.log10(peak)) if peak > 1.0 else 0.0
        level = ["-af", f"volume={1 / peak:.6f}"] if change else []
        p = subprocess.run([wem.FFMPEG, "-v", "error", "-y", "-f", "f32le", "-ar", str(RATE), "-ac", "2", "-i",
                            str(spool), *level, *FORMATS[fmt][1], *_tags(tags), str(path)], capture_output=True)
        if p.returncode:
            raise RenderError(f"can't write {path.name}: {p.stderr.decode(errors='replace').strip()[-300:]}")
    except BaseException:
        path.unlink(missing_ok=True)  # never leave half a file behind (errors and cancelled exports)
        raise
    finally:
        spool.unlink(missing_ok=True)
    return change


def clean_spool(age_s: float = 3600):
    """Removes spool files left by a core that was closed mid-export (a long cue's spool runs to hundreds of MB).
    A live export keeps writing to its spool, so anything untouched for an hour is safe to delete."""
    for f in (CACHE_DIR / "render").glob("spool-*.f32"):
        try:
            if time.time() - f.stat().st_mtime > age_s:
                f.unlink()
        except OSError:
            pass


def transcode(src: Path, dst: Path, fmt: str, tags: dict | None = None):
    """A file as it is (its own channels and rate), in another format."""
    dst.parent.mkdir(parents=True, exist_ok=True)
    p = subprocess.run([wem.FFMPEG, "-v", "error", "-y", "-i", str(src), "-vn", *FORMATS[fmt][1], *_tags(tags),
                        str(dst)], capture_output=True)
    if p.returncode:
        dst.unlink(missing_ok=True)
        raise RenderError(f"can't write {dst.name}: {p.stderr.decode(errors='replace').strip()[-300:]}")


@dataclass
class Mine:
    """A replacement as the renderer needs it."""
    path: Path
    gain_db: float = 0.0
    fit_timing: bool = True


@dataclass
class Placed:
    """One clip on a segment's timeline."""
    source: int
    mine: bool
    start_ms: float    # where it starts on the segment timeline
    offset_ms: float   # where in the source it starts
    length_ms: float
    gain_db: float = 0.0


@dataclass
class SegmentPlan:
    segment: int
    duration_ms: float
    entry_ms: float
    exit_ms: float
    clips: list[Placed] = field(default_factory=list)
    changed: bool = False  # differs from the game (replaced audio or moved cue points)


class Renderer:
    """Renders segments and cues of one cue-map cue. `vanilla(sid)` returns the path of a source's game audio;
    `mine` maps replaced source ids to Mine and `overrides` segment ids to cue-point overrides (both empty to render
    the game's own music)."""

    def __init__(self, cue: dict, vanilla, mine: dict[int, Mine] | None = None, overrides: dict | None = None):
        self.cue, self.vanilla = cue, vanilla
        self.mine, self.overrides = mine or {}, overrides or {}
        self.segments = {}
        for s in cue["segments"]:
            self.segments.setdefault(s["segment"], s)
        self._audio, self._lengths = {}, {}

    # --- audio
    def audio(self, sid: int, mine: bool) -> np.ndarray:
        key = (sid, mine)
        if key not in self._audio:
            a = load(self.mine[sid].path if mine else self.vanilla(sid))
            self._lengths[key] = len(a)
            self._audio[key] = a
            while len(self._audio) > 1 and sum(x.nbytes for x in self._audio.values()) > AUDIO_CACHE_BYTES:
                self._audio.pop(next(iter(self._audio)))  # a long cue has hundreds of sources; keep memory bounded
        return self._audio[key]

    def length_ms(self, sid: int, mine: bool) -> float:
        if (sid, mine) not in self._lengths:
            self.audio(sid, mine)
        return self._lengths[(sid, mine)] * 1000 / RATE

    # --- variants
    def switch_groups(self, segment: int | None = None) -> dict[int, list[int]]:
        """{switch group: [values that have audio]} over the cue, or over one segment."""
        out = {}
        for s in ([self.segments[segment]] if segment is not None else self.segments.values()):
            for st in s["stems"]:
                if st["type"] != "switch":
                    continue
                used = {c["subtrack"] for c in st["clips"]}
                vals = [v for i, v in enumerate(st["switch_values"]) if i in used]
                out.setdefault(st["switch_group"], [])
                out[st["switch_group"]] += [v for v in vals if v not in out[st["switch_group"]]]
        return out

    def _subtrack(self, st, variants, take: int) -> int | None:
        """Which subtrack of a stem plays (None: all of them)."""
        used = sorted({c["subtrack"] for c in st["clips"]})
        if not used or st["type"] == "normal":
            return None
        if st["type"] == "switch":
            want = (variants or {}).get(st["switch_group"])
            if want in st["switch_values"] and st["switch_values"].index(want) in used:
                return st["switch_values"].index(want)
            return used[0]
        return used[take % len(used)]  # random and sequence tracks: one take per play

    # --- one segment
    def plan(self, segment: int, variants=None, take=0) -> SegmentPlan:
        s = self.segments[segment]
        plan = SegmentPlan(segment, s["duration_ms"], s["entry_ms"] or 0.0,
                           s["duration_ms"] if s["exit_ms"] is None else s["exit_ms"])
        retimed = []
        for st in s["stems"]:
            sub = self._subtrack(st, variants, take)
            gains = [self.mine[sl["source"]].gain_db for sl in st["slots"]
                     if sl["source"] in self.mine and self.mine[sl["source"]].gain_db]
            gain = max(gains) if gains else 0.0  # make-up gain sits on the track, so it lifts every clip of it
            for c in st["clips"]:
                sid = c["source"]
                m = self.mine.get(sid)
                if m and m.fit_timing:
                    retimed.append(self.length_ms(sid, True))
                if sub is not None and c["subtrack"] != sub:
                    continue
                if m and m.fit_timing:
                    placed = Placed(sid, True, 0.0, 0.0, retimed[-1], gain)
                else:
                    placed = Placed(sid, bool(m), c["play_at_ms"] + c["begin_trim_ms"], c["begin_trim_ms"],
                                    c["source_ms"] + c["end_trim_ms"] - c["begin_trim_ms"], gain)
                plan.clips.append(placed)
                plan.changed |= bool(m)
        if retimed:
            plan.duration_ms = plan.exit_ms = max(retimed)
            plan.entry_ms = 0.0
        o = self.overrides.get(segment) or {}
        plan.entry_ms, plan.exit_ms = o.get("entry_marker", plan.entry_ms), o.get("exit_marker", plan.exit_ms)
        plan.changed |= bool(o)
        return plan

    def segment(self, segment: int, variants=None, take=0, plan: SegmentPlan | None = None) -> np.ndarray:
        """The whole segment timeline, lead-in and ring-out included."""
        plan = plan or self.plan(segment, variants, take)
        out = np.zeros((max(0, frames(plan.duration_ms)), 2), dtype=np.float32)
        for c in plan.clips:
            src = self.audio(c.source, c.mine)
            a, n = frames(c.offset_ms), frames(c.length_ms)
            if a < 0 or n <= 0 or not len(src):
                continue
            if not c.mine and a + n > len(src):   # a clip stretched past its source loops it
                src = np.tile(src, ((a + n) // len(src) + 1, 1))
            piece = src[a:a + n]
            at = frames(c.start_ms)
            if at < 0:
                piece, at = piece[-at:], 0
            piece = piece[:max(0, len(out) - at)]
            if len(piece):
                out[at:at + len(piece)] += piece * (10 ** (c.gain_db / 20)) if c.gain_db else piece
        return out

    # --- the whole cue
    def order(self, loops=1) -> list[int]:
        """Segment ids in the order the playlist plays them. Loops the game repeats forever play `loops` times;
        random groups play in their listed order."""
        tree = self.cue.get("playlist")
        if not tree:
            return [s["segment"] for s in self.cue["segments"]]
        endless = lambda n: not n["loop"] or any(endless(k) for k in n.get("children", []))
        steps, out = {}, []

        def play(n):
            inner = any(endless(k) for k in n.get("children", []))
            times = n["loop"] or (1 if inner else max(1, int(loops)))
            if "segment" in n:
                out.extend([n["segment"]] * times if n["segment"] in self.segments else [])
                return
            kids = n["children"]
            if not kids:
                return
            if n["rs"] in CONTINUOUS:
                for _ in range(times):
                    for k in kids:
                        play(k)
            else:  # a step group plays one child per pass; a pass of an endless one here is a full round
                for _ in range(times * (len(kids) if not n["loop"] else 1)):
                    i = steps.get(id(n), 0)
                    steps[id(n)] = i + 1
                    play(kids[i % len(kids)])
                    if len(out) > 5000:
                        return
        play(tree)
        return out

    def has_random(self) -> bool:
        walk = lambda n: n.get("rs") in RANDOM and len(n["children"]) > 1 or any(walk(k) for k in n.get("children", []))
        tree = self.cue.get("playlist")
        return bool(tree and walk(tree))

    def layout(self, variants=None, loops=1) -> tuple[list, list[float], float, list[dict]]:
        """How the cue plays through: (plans with their take, each one's start ms, total ms, marks). The marks say
        where each segment's Entry and Exit fall (ms), and where each of its clips plays: `at_ms` in the
        play-through, from `offset_ms` of its source, for `length_ms`. That is what lets a slot's waveform show
        where the play-through is in it."""
        takes, plans = {}, []
        for seg in self.order(loops):
            take = takes.get(seg, 0)
            takes[seg] = take + 1
            plans.append((self.plan(seg, variants, take), take))
        if not plans:
            raise RenderError("this cue has nothing to play")
        cursor, starts, end = None, [], 0.0   # cursor: where the next segment's Entry point lands
        for p, _ in plans:
            cursor = p.entry_ms if cursor is None else cursor
            starts.append(cursor - p.entry_ms)
            end = max(end, starts[-1] + p.duration_ms)
            cursor += max(0.0, p.exit_ms - p.entry_ms)
        shift = -min(0.0, min(starts))  # a long lead-in on a later segment can reach before the start
        if end + shift > MAX_MINUTES * 60000:
            raise RenderError(f"this cue runs over {MAX_MINUTES} minutes played through; export its segments instead")
        starts = [s + shift for s in starts]
        marks = [{"segment": str(p.segment), "ms": round(s + p.entry_ms, 1), "exit_ms": round(s + p.exit_ms, 1),
                  "clips": [{"source": str(c.source), "mine": c.mine, "at_ms": round(s + c.start_ms, 1),
                             "offset_ms": round(c.offset_ms, 1), "length_ms": round(c.length_ms, 1)} for c in p.clips]}
                 for (p, _), s in zip(plans, starts)]
        return plans, starts, end + shift, marks

    def stream(self, variants=None, loops=1, layout=None, on_segment=None):
        """Yields the cue played through as consecutive pieces, holding only the part still being mixed.
        on_segment(i, count, plan) is called before each segment is rendered (progress, cancelling)."""
        plans, starts, total, _ = layout or self.layout(variants, loops)
        total = frames(total)
        ats = [frames(s) for s in starts]
        # nothing after segment i starts before `safe[i]`, so everything before it is final
        safe = [total] * len(ats)
        for i in range(len(ats) - 2, -1, -1):
            safe[i] = min(safe[i + 1], ats[i + 1])
        buf, base = np.zeros((0, 2), dtype=np.float32), 0   # buf[0] is frame `base` of the cue
        for i, ((p, take), at) in enumerate(zip(plans, ats)):
            if on_segment:
                on_segment(i, len(plans), p)
            a = self.segment(p.segment, variants, take, p)[:max(0, total - at)]
            if not len(buf) and safe[i] >= at >= base:   # nothing pending and nothing later starts before
                # this segment (the usual case): the segment itself is the buffer
                if at > base:
                    yield np.zeros((at - base, 2), dtype=np.float32)
                buf, base = a, at
            else:
                if at - base + len(a) > len(buf):
                    buf = np.concatenate([buf, np.zeros((at - base + len(a) - len(buf), 2), dtype=np.float32)])
                buf[at - base:at - base + len(a)] += a
            del a
            done = max(0, min(safe[i], total) - base)
            if done:
                yield buf[:done]
                buf, base = buf[done:].copy(), base + done
        if total > base:   # silence up to the end, if the last segments were empty
            if total - base > len(buf):
                buf = np.concatenate([buf, np.zeros((total - base - len(buf), 2), dtype=np.float32)])
            yield buf[:total - base]

    def render(self, variants=None, loops=1) -> tuple[np.ndarray, list[dict]]:
        """(audio, marks): the cue played through in one array. Fine for short cues and tests; exports stream."""
        layout = self.layout(variants, loops)
        pieces = list(self.stream(variants, loops, layout))
        return (np.concatenate(pieces) if pieces else np.zeros((0, 2), dtype=np.float32)), layout[3]


def variant_sets(groups: dict[int, list[int]], limit=64) -> list[dict[int, int]]:
    """Every combination of switch values, as {group: value} dicts ([{}] when there are no switches)."""
    keys = sorted(groups)
    combos = [dict(zip(keys, vals)) for vals in itertools.product(*(groups[k] for k in keys))]
    return combos[:limit] or [{}]
