"""Helldivers 1 mods: the project's new audio in the game's Timpani banks, built as a mod for a mod manager that
deploys resources into patches (an `obsidian.json` and its files, in a ZIP).

A bank (hd1.py) is a table of rows, sorted by clip id, then the clips in an order of their own, each starting on 4
bytes. A clip is its 68-byte header and the first part of its audio; the rest is in the bundle's .stream, the parts
one after another in the clips' order. Rebuilt with nothing new, every bank of the game comes out byte for byte.

A new clip keeps what the game knows the original by: its codec (Ogg Vorbis, or 16-bit PCM held whole), its rate,
its channels, and how much of it sits in the bank before the stream takes over (8 KB, 32 KB for music, or all of it).

A patch replaces a resource whole, every language of it at once, and a bundle reads only its own patches. So each
bank with new audio goes into the mod with all its languages (the ones without new audio as the game has them) and
into every bundle that holds it. Sound changes only what one player hears, so the mod's scope is client.
"""
import json
import struct
import subprocess
import tempfile
import zipfile
from pathlib import Path

from . import arsenal, hd1, wem
from .audio import faded, silence_wav
from .i18n import ntr, tr
from .project import Project

PAD = 4                  # a clip starts on a multiple of this, from the bank's start
VORBIS_QUALITY = "6"     # libvorbis -q: about 190 kbps stereo, near the game's own clips
MANIFEST = "obsidian.json"


class Hd1BuildError(Exception):
    pass


def bank_files(game: hd1.Hd1, bank: dict) -> tuple[bytes, bytes]:
    """A bank in one language, as the game has it: (the bank, its part of the .stream)."""
    path = game.contents / bank["bundle"]
    with hd1.Bundle(path, game.chunks.get(path)) as b:
        game.chunks[path] = b.chunks
        raw = b.read(bank["at"], bank["size"])
    stream = b""
    if bank["stream_size"]:
        with open(path.with_name(path.name + ".stream"), "rb") as f:
            f.seek(bank["stream"])
            stream = f.read(bank["stream_size"])
    return raw, stream


def rows_of(raw: bytes) -> list[tuple[int, int, int, int, int]]:
    """A bank's rows: (clip, offset in the bank, bytes there, offset in the stream, bytes there)."""
    count = struct.unpack_from("<I", raw)[0]
    return [struct.unpack_from("<QIIII", raw, 8 + 24 * i) for i in range(count)]


def rebuild(raw: bytes, stream: bytes, new: dict[int, tuple[bytes, bytes]]) -> tuple[bytes, bytes]:
    """The bank and stream with some clips in place of the game's: new {clip: (what goes in the bank, header
    included; what goes in the stream)}. Everything else stays where the game's layout puts it."""
    rows = rows_of(raw)
    table = 8 + 24 * len(rows)
    out, out_stream, placed = bytearray(raw[:8]) + bytes(24 * len(rows)), bytearray(), {}
    for clip, off, size, soff, ssize in sorted(rows, key=lambda r: r[1]):
        out += bytes(-len(out) % PAD)
        kept, streamed = new.get(clip) or (raw[off:off + size], stream[soff:soff + ssize])
        placed[clip] = (len(out), len(kept), len(out_stream), len(streamed))
        out += kept
        out_stream += streamed
    for i, (clip, *_) in enumerate(rows):
        struct.pack_into("<QIIII", out, 8 + 24 * i, clip, *placed[clip])
    assert len(out) >= table
    return bytes(out), bytes(out_stream)


def _pcm(src: Path, channels: int, rate: int) -> bytes:
    """Audio as raw 16-bit PCM at the original's channels and rate."""
    run = subprocess.run([wem.FFMPEG, "-v", "error", "-i", str(src), "-ac", str(channels), "-ar", str(rate),
                          "-f", "s16le", "-c:a", "pcm_s16le", "-"], capture_output=True)
    if run.returncode or not run.stdout:
        raise Hd1BuildError(tr("Can't read {file}: {why}").format(file=src.name, why=run.stderr.decode(errors="replace").strip()[-300:]))
    return run.stdout


def _vorbis(pcm: bytes, channels: int, rate: int) -> bytes:
    run = subprocess.run([wem.FFMPEG, "-v", "error", "-f", "s16le", "-ac", str(channels), "-ar", str(rate), "-i", "-",
                          "-c:a", "libvorbis", "-q:a", VORBIS_QUALITY, "-f", "ogg", "-"], input=pcm, capture_output=True)
    if run.returncode or not run.stdout:
        raise Hd1BuildError(tr("Can't encode the audio: {why}").format(why=run.stderr.decode(errors="replace").strip()[-300:]))
    return run.stdout


def _with_gain(src: Path, gain_db: float, work: Path) -> Path:
    if not gain_db:
        return src
    out = work / f"gain-{abs(hash((str(src), gain_db))):x}.wav"
    if not out.exists():
        run = subprocess.run([wem.FFMPEG, "-v", "error", "-y", "-i", str(src), "-af", f"volume={gain_db}dB",
                              "-c:a", "pcm_s16le", str(out)], capture_output=True)
        if run.returncode:
            raise Hd1BuildError(tr("Can't read {file}: {why}").format(file=src.name, why=run.stderr.decode(errors="replace").strip()[-300:]))
    return out


def new_clip(src: Path, original: bytes, streamed: bool) -> tuple[bytes, bytes]:
    """A file as a clip in the original's place: (what goes in the bank, what goes in the stream). original: the
    game's clip as the bank holds it, header first; streamed: whether the rest of it was in the stream."""
    tag, channels, rate = struct.unpack_from("<HHI", original, 48)
    pcm = _pcm(src, channels, rate)
    samples = len(pcm) // (2 * channels)
    if tag == hd1.VORBIS:
        audio = _vorbis(pcm, channels, rate)
        # a clip that went on in the stream keeps as much in the bank as before (8 or 32 KB); one held whole stays whole
        kept = min(len(audio), struct.unpack_from("<I", original, 4)[0]) if streamed else len(audio)
        fmt = struct.pack("<HHIIHHI", hd1.VORBIS, channels, rate, 0, 0, 0, 0)
    else:  # PCM is always held whole in the bank
        audio, kept = pcm, len(pcm)
        fmt = struct.pack("<HHIIHHI", hd1.PCM, channels, rate, rate * channels * 2, channels * 2, 16, 0)
    head = struct.pack("<3I", hd1.HEAD, kept, samples) + bytes(36) + fmt
    assert len(head) == hd1.HEAD
    return head + audio[:kept], audio[kept:]


def _source_file(p: Project, r) -> Path:
    """The audio a replacement puts in: its file with its fades, or silence."""
    if r.silence:
        return silence_wav()
    path = p.audio_path(r)
    if not path or not path.is_file():
        raise Hd1BuildError(tr("{name}: the audio file is missing ({file})").format(name=r.label or r.audio, file=r.audio))
    return faded(path, r.fade_in_ms, r.fade_out_ms) if (r.fade_in_ms or r.fade_out_ms) else path


def mod_id(p: Project) -> str:
    """The mod's id for the mod manager: stays the same from build to build of a project."""
    return f"audiodiver.{arsenal.slug(p.name).replace('_', '-')[:40]}-{p.guid.replace('-', '')[:6]}".strip("-")


def build(p: Project, game: hd1.Hd1, log=print, step=None) -> Path:
    """Builds the project as a Helldivers 1 mod: <build folder>/<name>-<version>.zip, holding obsidian.json and the
    banks. Returns the ZIP's path."""
    step = step or (lambda *_a, **_k: None)
    reps = [r for r in p.replacements if game.has(r.target)]
    if not reps:
        raise Hd1BuildError(tr("Nothing to build yet. Replace some audio first."))
    gone = [r for r in p.replacements if not game.has(r.target)]
    if gone:
        raise Hd1BuildError(ntr("{n} replaced sound isn't in this version of Helldivers 1",
                                "{n} replaced sounds aren't in this version of Helldivers 1", len(gone)).format(n=len(gone)))
    by_clip = {}  # (bank name, language) -> {clip: replacement}
    for r in reps:
        clip, lang = r.target & hd1.LOW, r.target >> 64
        for bank in game.banks:
            if bank["lang"] == lang and any(row[0] == clip for row in bank["rows"]):
                by_clip.setdefault((bank["name"], lang), {})[clip] = r
    names = sorted({name for name, _ in by_clip})
    out_dir = p.build_dir()
    zip_path = out_dir / f"{arsenal.slug(p.name)}-{p.version}.zip"
    resources, files = [], {}
    with tempfile.TemporaryDirectory(prefix="audiodiver-hd1-") as tmp:
        work = Path(tmp)
        res = work / "res"
        res.mkdir()
        total = sum(len(v) for v in by_clip.values())
        done = 0
        for name in names:
            variants = []
            for bank in sorted((b for b in game.banks if b["name"] == name), key=lambda b: b["lang"]):
                raw, stream = bank_files(game, bank)
                mine = by_clip.get((name, bank["lang"]), {})
                new = {}
                rows = {row[0]: row for row in rows_of(raw)}
                for clip, r in mine.items():
                    done += 1
                    step(tr("encoding {name}").format(name=r.label or Path(r.audio).name or tr("silence")), done)
                    _, off, size, _, ssize = rows[clip]
                    new[clip] = new_clip(_with_gain(_source_file(p, r), r.gain_db, work), raw[off:off + size], ssize > 0)
                if new:
                    raw, stream = rebuild(raw, stream, new)
                stem = f"{name:016x}.{bank['lang']:x}"
                (res / f"{stem}.timpani_bank").write_bytes(raw)
                variant = {"lang": bank["lang"], "data": f"res/{stem}.timpani_bank"}
                if stream:
                    (res / f"{stem}.stream").write_bytes(stream)
                    variant["stream"] = f"res/{stem}.stream"
                variants.append(variant)
                files[stem] = len(raw) + len(stream)
            holders = sorted({b for bank in game.banks if bank["name"] == name for b in bank.get("bundles", [bank["bundle"]])})
            for bundle in holders:
                entry = {"type": "timpani_bank", "name": f"#{name:016x}", "bundle": Path(bundle).name}
                if len(variants) == 1 and variants[0]["lang"] == 0:
                    entry |= {k: v for k, v in variants[0].items() if k != "lang"}
                else:
                    entry["variants"] = variants
                resources.append(entry)
        step(tr("writing the mod"), total)
        manifest = {"obsidian": 1, "id": mod_id(p), "version": f"1.0.{p.version}", "name": {"en": p.name},
                    "description": {"en": p.description or "New audio for Helldivers 1, made with Audiodiver."},  # English, as mod names
                    "authors": [], "scope": "client", "resources": resources, "loader_api": 1}
        (work / MANIFEST).write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        try:
            out_dir.mkdir(parents=True, exist_ok=True)
            partial = zip_path.with_suffix(".zip.partial")
            with zipfile.ZipFile(partial, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
                z.write(work / MANIFEST, MANIFEST)
                for f in sorted(res.iterdir()):
                    # Ogg and PCM barely shrink: stored, the ZIP is made in a fraction of the time
                    z.write(f, f"res/{f.name}", compress_type=zipfile.ZIP_STORED)
            partial.replace(zip_path)
        except OSError as e:
            raise Hd1BuildError(tr("Can't write {file}: {why}").format(file=zip_path.name, why=str(e))) from None
    log(ntr("{n} bank with new audio, {mb} MB", "{n} banks with new audio, {mb} MB", len(names)).format(
        n=len(names), mb=round(zip_path.stat().st_size / 1e6, 1)))
    return zip_path


def verify(zip_path: Path, game: hd1.Hd1) -> list[str]:
    """Reads a built mod back: every bank parses, ends on its last clip, and its stream holds what its rows say.
    Returns what is wrong (nothing for a good mod)."""
    wrong = []
    with zipfile.ZipFile(zip_path) as z:
        m = json.loads(z.read(MANIFEST))
        for r in m["resources"]:
            for v in r.get("variants") or [r]:
                raw = z.read(v["data"])
                stream = z.read(v["stream"]) if v.get("stream") else b""
                rows = rows_of(raw)
                ends = max((off + size for _, off, size, _, _ in rows), default=8 + 24 * len(rows))
                if ends != len(raw):
                    wrong.append(f"{v['data']}: the bank doesn't end on the last clip")
                if sum(s for *_, s in rows) != len(stream):
                    wrong.append(f"{v['data']}: the stream isn't the size the rows say")
                for clip, off, size, soff, ssize in rows:
                    head = raw[off:off + hd1.HEAD]
                    if len(head) < hd1.HEAD or struct.unpack_from("<H", head, 48)[0] not in (hd1.VORBIS, hd1.PCM):
                        wrong.append(f"{v['data']}: clip {clip:016x} has no clip header")
                        break
    return wrong
