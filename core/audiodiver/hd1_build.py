"""Helldivers 1 mods: the project's new audio in the game's Timpani banks, built as a mod for a mod manager that
deploys resources into patches (an `obsidian.json` and its files, in a ZIP).

A bank (hd1.py) is a table of rows, sorted by clip id, then the clips in an order of their own, each starting on 4
bytes. A clip is its 68-byte header and the first part of its audio; the rest is in the bundle's .stream, the parts
one after another in the clips' order. Rebuilt with nothing new, every bank of the game comes out byte for byte.

A new clip keeps what the game knows the original by: its codec (Ogg Vorbis, or 16-bit PCM held whole), its rate,
its channels, and how much of it sits in the bank before the stream takes over (8 KB, 32 KB for music, or all of it).

A patch replaces a resource whole, every language of it at once, and a bundle reads only its own patches, which makes
a whole bank up to 159 MB in each of 9 languages. So a mod holds only the new clips and names the banks they go in, and
the mod manager makes the patches from the installed game when it deploys. Up to Obsidian 1.3.1 it rebuilt those banks:
every language, and every bundle that holds them (rebuild here is that layout), about 2.7 GB for one footstep. The
overlay that follows (overlay below, Obsidian's overlay.rs) leaves the game's banks alone: the game's one list of sounds
(timpani_master, in the boot bundle) names new IDs where it named the replaced clips, and the clips go under those IDs
into a small bank beside each bank they replace, in every bundle that holds it (the boot bundle loads before the
language is set, so a bank there plays language 0 in every language). Sound changes only what one player hears, so the
mod's scope is client.
"""
import hashlib
import json
import os
import re
import shutil
import struct
import subprocess
import tempfile
import threading
import zipfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from . import arsenal, hd1, wem
from .audio import silence_wav
from .i18n import ntr, tr
from .project import Project

PAD = 4                  # a clip starts on a multiple of this, from the bank's start
VORBIS_QUALITY = "6"     # libvorbis -q: about 190 kbps stereo, near the game's own clips
MANIFEST = "obsidian.json"
MIN_MANAGER = "1.1.0"    # the first that deploys these mods with its progress shown (older ones look stuck)


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


def _readable(src: Path) -> Path:
    """A file ffmpeg can read: a .wem (a Helldivers 2 clip copied from the Library, or one given as audio) decoded
    to WAV first."""
    try:
        return Path(wem.decoded(src))
    except (subprocess.CalledProcessError, OSError):
        raise Hd1BuildError(tr("Can't read {file}: {why}").format(file=src.name, why="vgmstream")) from None


def _pcm(src: Path, channels: int, rate: int, gain_db: float = 0) -> bytes:
    """Audio as raw 16-bit PCM at the original's channels and rate, with its Make-Up Gain."""
    try:
        fold = wem.fold_args(src, channels)
    except (subprocess.CalledProcessError, ValueError, OSError):
        fold = ["-ac", str(channels)]  # ffmpeg says what is wrong with the file below
    if gain_db:
        gain = f"volume={gain_db}dB"
        fold = ["-af", f"{fold[1]},{gain}"] if fold[0] == "-af" else [*fold, "-af", gain]
    run = subprocess.run([wem.FFMPEG, "-v", "error", "-i", str(src), *fold, "-ar", str(rate),
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


def new_clip(src: Path, original: bytes, streamed: bool, gain_db: float = 0) -> tuple[bytes, bytes]:
    """A file as a clip in the original's place: (what goes in the bank, what goes in the stream). original: the
    game's clip as the bank holds it, header first; streamed: whether the rest of it was in the stream."""
    tag, channels, rate = struct.unpack_from("<HHI", original, 48)
    pcm = _pcm(src, channels, rate, gain_db)
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
    return p.heard_path(r)  # its stretch, delay and fades, as in a Helldivers 2 build


ENCODING = 2         # changes the cache's keys when the encoding changes (2: quad and 5.1 folded as players fold them)
KEEP_PROJECTS = 3    # the projects whose clips stay cached, the ones built last


def _clip_cache(p: Project) -> Path:
    """Where a project's encoded clips are kept between builds, so a build encodes only what changed."""
    from .index import CACHE_DIR
    return CACHE_DIR / "hd1_clips" / p.guid


def _clip_name(src: Path, head: bytes, streamed: bool, gain_db: float) -> str:
    """An encoding's name in the cache: the file it comes from as it is now, and everything that shapes the clip."""
    st = src.stat()
    what = [str(src), st.st_size, st.st_mtime_ns, head[48:56].hex(), struct.unpack_from("<I", head, 4)[0] if streamed else 0,
            gain_db, VORBIS_QUALITY, ENCODING]
    return hashlib.sha1(json.dumps(what).encode()).hexdigest()[:20]


def _encode_all(p: Project, jobs: dict, step) -> dict:
    """Encodes each job {key: (replacement, the original's header, streamed)} on as many threads as the computer has
    cores to spare (each encoder runs on one), taking what the cache already holds. Returns {key: cache name}."""
    cache = _clip_cache(p)
    cache.mkdir(parents=True, exist_ok=True)
    locks, locks_guard = {}, threading.Lock()

    def make(key):
        r, head, streamed = jobs[key]
        src = _readable(_source_file(p, r))
        name = _clip_name(src, head, streamed, r.gain_db)
        clip, stream = cache / f"{name}.clip", cache / f"{name}.stream"
        with locks_guard:
            lock = locks.setdefault(name, threading.Lock())
        with lock:  # jobs sharing an audio file share a name: one encodes it, the others wait and take it from the cache
            if not (clip.exists() and stream.exists()):
                data, rest = new_clip(src, head, streamed, r.gain_db)
                for path, b in ((stream, rest), (clip, data)):  # the clip last: with it there, both are whole
                    tmp = path.with_name(path.name + f".{threading.get_ident()}.partial")
                    tmp.write_bytes(b)
                    tmp.replace(path)
        return key, name

    names = {}
    pool = ThreadPoolExecutor(max(1, (os.cpu_count() or 2) - 1))
    try:
        futures = [pool.submit(make, key) for key in jobs]
        for done, f in enumerate(as_completed(futures), 1):
            key, names[key] = f.result()
            r = jobs[key][0]
            step(tr("encoding {name}").format(name=r.label or Path(r.audio).name or tr("silence")), done, len(jobs))
    finally:
        pool.shutdown(wait=True, cancel_futures=True)  # a cancel (step raises) or an error stops what hasn't started
    return names


def _prune(p: Project, used: set[str]):
    """Drops the project's cached clips this build didn't use, and the caches of all but the last projects built."""
    cache = _clip_cache(p)
    for f in cache.iterdir():
        if f.name.split(".")[0] not in used:
            f.unlink(missing_ok=True)
    cache.touch()
    others = sorted((d for d in cache.parent.iterdir() if d.is_dir()), key=lambda d: d.stat().st_mtime, reverse=True)
    for d in others[KEEP_PROJECTS:]:
        shutil.rmtree(d, ignore_errors=True)


def default_mod_id(p: Project) -> str:
    """The id a mod gets when none is given, from the project's guid: a renamed project still updates the mod installed."""
    return f"audiodiver.hd1-{p.guid.replace('-', '').lower()[:16]}"


def mod_id(p: Project) -> str:
    """The mod's id for the mod manager: the one the project gives (such as the id of a mod made before), or the default."""
    return p.mod_id or default_mod_id(p)


def clip_head(game: hd1.Hd1, bank: dict, row) -> bytes:
    """The game's header of a clip, which says what a new clip in its place has to be."""
    path = game.contents / bank["bundle"]
    with hd1.Bundle(path, game.chunks.get(path)) as b:
        game.chunks[path] = b.chunks
        return b.read(bank["at"] + row[1], hd1.HEAD)


def _clips(p: Project, game: hd1.Hd1, step, kept, used: set) -> dict[tuple[int, int, str], dict]:
    """The clips a project puts in: {(bank name, language, clip): its row in a resource}, the files written with
    kept(data, kind). used gets the cache names of the encodings taken."""
    reps = [r for r in p.replacements if game.has(r.target)]
    gone = [r for r in p.replacements if not game.has(r.target)]
    if gone:
        raise Hd1BuildError(ntr("{n} replaced sound isn't in this version of Helldivers 1",
                                "{n} replaced sounds aren't in this version of Helldivers 1", len(gone)).format(n=len(gone)))
    # each replaced clip in its language, and in every language whose copy is the same sound (hd1.alike), unless the
    # project replaces that copy itself
    own = {(r.target & hd1.LOW, r.target >> 64) for r in reps}
    by_target = {}
    for r in reps:
        clip, flag = r.target & hd1.LOW, r.target >> 64
        by_target[(clip, flag)] = r
        for other in game.alike(clip, flag):
            if (clip, other) not in own:
                by_target.setdefault((clip, other), r)
    wanted = set(by_target)
    rows_at: dict[tuple[int, int], list] = {}  # (clip, language): [(bank, its row of the clip)], read once for them all
    for bank in game.banks:
        for row in bank["rows"]:
            if (row[0], bank["lang"]) in wanted:
                rows_at.setdefault((row[0], bank["lang"]), []).append((bank, row))
    places = [(bank, row, r) for key, r in by_target.items() for bank, row in rows_at.get(key, [])]
    # a file comes out the same wherever the original has the same format: one encoding per (replacement, format)
    jobs: dict[tuple, tuple] = {}
    keys = []
    for bank, row, r in places:
        head = clip_head(game, bank, row)
        streamed = row[4] > 0
        key = (id(r), struct.unpack_from("<HHI", head, 48), struct.unpack_from("<I", head, 4)[0] if streamed else 0)
        keys.append(key)
        jobs.setdefault(key, (r, head, streamed))
    names = _encode_all(p, jobs, step)
    used |= set(names.values())
    files, out = {}, {}  # an encoding's (bank file, stream file) in the mod
    for (bank, row, r), key in zip(places, keys):
        name = names[key]
        if name not in files:
            stream = (_clip_cache(p) / f"{name}.stream").read_bytes()
            files[name] = (kept((_clip_cache(p) / f"{name}.clip").read_bytes(), "clip"), kept(stream, "stream") if stream else None)
        data, stream = files[name]
        entry = {"clip": f"#{row[0]:016x}", **({"lang": bank["lang"]} if bank["lang"] else {}), "data": data}
        if stream:
            entry["stream"] = stream
        out[(bank["name"], bank["lang"], entry["clip"])] = entry
    return out


@dataclass
class OptionBuild:
    """The project's options for a build: the options, and resolve(picks), the project a set of picks plays
    ({option id: choice id}; the editor's, which knows the Library items a rule names)."""
    options: list
    resolve: Callable[[dict], Project]


def _option_clips(game: hd1.Hd1, main: dict, choices: OptionBuild, step, kept, used: set):
    """The clips of the mod with the options: [(when, {place: row})]. A clip no option changes stays Main's, without
    `when`. A clip one option changes goes in once for each choice of that option that has new audio there (Main's
    under the first choice), with `when` naming that choice. A clip several options change goes in for every set of
    their choices (options.combos), each built, with `when` naming them all: Obsidian keeps one picker per option."""
    from . import options as opts
    first = {o.id: o.choices[0].id for o in choices.options}
    built = {frozenset(): main}  # {the picks off the default: their clips}

    def clips_of(picks: dict) -> dict:
        key = frozenset((i, c) for i, c in picks.items() if c != first[i])
        if key not in built:
            built[key] = _clips(choices.resolve(dict(key)), game, step, kept, used)
        return built[key]
    touched: dict[tuple, set] = {}  # place: the options that change it
    for o in choices.options:
        for c in o.choices[1:]:
            got = clips_of({o.id: c.id})
            for place in set(got) | set(main):
                if got.get(place) != main.get(place):
                    touched.setdefault(place, set()).add(o.id)
    out = [((), {k: v for k, v in main.items() if k not in touched})]
    by_options: dict[tuple, set] = {}
    for place, ids in touched.items():
        by_options.setdefault(tuple(sorted(ids)), set()).add(place)
    for ids, places in sorted(by_options.items()):
        picks = opts.combos(choices.options, ids)
        if len(picks) > opts.MAX_COMBOS:
            raise Hd1BuildError(tr("The options {names} change the same sounds in {n} ways, more than a mod can hold. "
                                   "Narrow them to fewer sounds.").format(names=", ".join(ids), n=len(picks)))
        for pick in picks:
            got = clips_of(pick)
            rows = {k: got[k] for k in places if k in got}
            if rows:  # none: the game's clips there, as no resource puts anything in
                out.append((tuple(sorted(pick.items())), rows))
    return out


def build(p: Project, game: hd1.Hd1, log=print, step=None, choices=None) -> Path:
    """Builds the project as a Helldivers 1 mod: <build folder>/<name>-<version>.zip, holding obsidian.json and the
    new clips, one resource per bank. Rows with the same bytes share a file. Returns the ZIP's path. choices: the
    options' choices resolved (OptionBuild), which go in as Obsidian options, each clip a choice changes in a
    resource with `when`."""
    step = step or (lambda *_a, **_k: None)
    if not [r for r in p.replacements if game.has(r.target)] and not choices:
        raise Hd1BuildError(tr("Nothing to build yet. Replace some audio first."))
    out_dir = p.build_dir()
    zip_path = out_dir / f"{arsenal.slug(p.name)}-{p.version}.zip"
    with tempfile.TemporaryDirectory(prefix="audiodiver-hd1-") as tmp:
        work = Path(tmp)
        res = work / "res"
        res.mkdir()

        def kept(data: bytes, kind: str) -> str:
            """The file with these bytes, which rows of the same clip share."""
            name = f"res/{hashlib.sha256(data).hexdigest()[:16]}.{kind}"
            if not (work / name).exists():
                (work / name).write_bytes(data)
            return name
        used: set[str] = set()
        main = _clips(p, game, step, kept, used)
        groups = _option_clips(game, main, choices, step, kept, used) if choices else [((), main)]
        if not any(rows for _, rows in groups):
            raise Hd1BuildError(tr("Nothing to build yet. Replace some audio first."))
        _prune(p, used)
        step(tr("writing the mod"), 1, 1)
        resources = []
        for when, rows in groups:
            by_bank: dict[int, list] = {}
            for (bank, _lang, _clip), entry in rows.items():
                by_bank.setdefault(bank, []).append(entry)
            for name in sorted(by_bank):
                resources.append({"type": "timpani_bank", "name": f"#{name:016x}",
                                  "clips": sorted(by_bank[name], key=lambda x: (x["clip"], x.get("lang", 0))),
                                  **({"when": dict(when)} if when else {})})
        rows = {r["name"] for r in resources}
        # min_obsidian: an older mod manager from 1.1.0 on refuses the mod and says to update (1.0.4 ignores it)
        manifest = {"obsidian": 1, "min_obsidian": MIN_MANAGER, "id": mod_id(p), "version": f"1.0.{p.version}", "name": {"en": p.name},
                    "description": {"en": p.description or "New audio for Helldivers 1, made with Audiodiver."},  # English, as mod names
                    "authors": list(p.authors), "scope": "client", "resources": resources, "loader_api": 1}
        if choices:
            manifest["options"] = [{"id": o.id, "type": "choice", "default": o.choices[0].id, "label": {"en": o.name},
                                    **({"description": {"en": o.description}} if o.description else {}),
                                    "choices": [{"id": c.id, "label": {"en": c.name}} for c in o.choices]}
                                   for o in choices.options]
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
    log(ntr("{n} bank with new audio, {mb} MB", "{n} banks with new audio, {mb} MB", len(rows)).format(
        n=len(rows), mb=round(zip_path.stat().st_size / 1e6, 1)))
    return zip_path


ID = re.compile(r"#[0-9a-f]{16}")


def verify(zip_path: Path, game: hd1.Hd1) -> list[str]:
    """Reads a built mod back, as the mod manager will: each row names a bank, language and clip the game has, and
    holds a clip in the original's format with the size its header says. The banks themselves are made at deploy, so
    the check stops there. Returns what is wrong (nothing for a good mod)."""
    wrong = []
    with zipfile.ZipFile(zip_path) as z:
        m = json.loads(z.read(MANIFEST))
        names = set(z.namelist())
        if not m["resources"]:
            wrong.append("the mod holds nothing")
        for r in m["resources"]:
            if set(r) - {"when"} != {"type", "name", "clips"} or r["type"] != "timpani_bank" or not ID.fullmatch(r["name"]):
                wrong.append(f"{r.get('name')}: a resource holds only a type, a name, clips and when")
                continue
            if "when" in r and not all(any(o["id"] == k and v in [c["id"] for c in o["choices"]] for o in m.get("options", []))
                                       for k, v in r["when"].items()):
                wrong.append(f"{r.get('name')}: when names an option or choice the mod doesn't have")
                continue
            bank_id = int(r["name"][1:], 16)
            listed = set()
            for row in r["clips"]:
                where = f"{r['name']} {row.get('clip')}"
                if not ID.fullmatch(str(row.get("clip"))):
                    wrong.append(f"{where}: a clip is # and 16 lowercase hex digits")
                    continue
                clip, lang = int(row["clip"][1:], 16), row.get("lang", 0)
                if (clip, lang) in listed:
                    wrong.append(f"{where}: listed twice in one language")
                listed.add((clip, lang))
                bank = next((b for b in game.banks if b["name"] == bank_id and b["lang"] == lang), None)
                original = bank and next((x for x in bank["rows"] if x[0] == clip), None)
                if not original:
                    wrong.append(f"{where}: this clip and language isn't in the game's bank")
                    continue
                missing = [f for f in (row.get("data"), row.get("stream")) if f and f not in names]
                if missing or not row.get("data"):
                    wrong.append(f"{where}: the file is gone: {missing}")
                    continue
                data = z.read(row["data"])
                if len(data) < hd1.HEAD or struct.unpack_from("<I", data)[0] != hd1.HEAD:
                    wrong.append(f"{where}: no clip header")
                    continue
                if struct.unpack_from("<I", data, 4)[0] != len(data) - hd1.HEAD:
                    wrong.append(f"{where}: the header's kept size isn't the size of the file")
                head = clip_head(game, bank, original)
                if data[48:56] != head[48:56]:
                    wrong.append(f"{where}: not in the original's format")
    return wrong


# --- what the mod manager deploys: the overlay (Obsidian's overlay.rs), for checks and sizes. The same layout in both.
MASTER_MAGIC = 0x61914940


def clip_places(master: bytes) -> list[tuple[int, int]]:
    """(offset of the clip ID, the clip) of each clip record of a master: the third section's records of kind 0."""
    if struct.unpack_from("<I", master)[0] != MASTER_MAGIC:
        raise ValueError("not a master")
    sounds = struct.unpack_from("<I", master, 12)[0]
    count = struct.unpack_from("<I", master, sounds)[0]
    out = []
    for i in range(count):
        at = sounds + struct.unpack_from("<I", master, sounds + 4 + 4 * i)[0]
        if struct.unpack_from("<I", master, at)[0] == 0:
            out.append((at + 16, struct.unpack_from("<Q", master, at + 16)[0]))
    return out


def overlay_ids(clips, taken: set[int]) -> dict[int, int]:
    """The new ID of each replaced clip: the hash of obsidian/clip/<id>, then of obsidian/clip/<id>/<n> while taken."""
    used, out = set(taken) | set(clips), {}
    for clip in sorted(clips):
        n, new = 1, hd1.murmur64_hash(f"obsidian/clip/{clip:016x}".encode())
        while new in used:
            new, n = hd1.murmur64_hash(f"obsidian/clip/{clip:016x}/{n}".encode()), n + 1
        used.add(new)
        out[clip] = new
    return out


def overlay_bank(clips: dict[int, tuple[bytes, bytes]]) -> tuple[bytes, bytes]:
    """A bank of {id: (bytes in the bank, bytes in the stream)}: rows by ID, the clips and their stream parts in that
    order, each clip on 4 bytes."""
    ids = sorted(clips)
    out, stream, rows = bytearray(struct.pack("<II", len(ids), 0)) + bytes(24 * len(ids)), bytearray(), []
    for i in ids:
        out += bytes(-len(out) % PAD)
        data, streamed = clips[i]
        rows.append(struct.pack("<QIIII", i, len(out), len(data), len(stream), len(streamed)))
        out += data
        stream += streamed
    out[8:8 + 24 * len(ids)] = b"".join(rows)
    return bytes(out), bytes(stream)


def overlay_name(bank: int) -> int:
    """The resource name of Obsidian's bank of new clips beside a bank of the game."""
    return hd1.murmur64_hash(f"obsidian/timpani/clips/{bank:016x}".encode())


def overlay(game: hd1.Hd1, zip_path: Path) -> tuple[bytes, dict[int, dict[int, tuple[bytes, bytes]]]]:
    """What the mod manager deploys for a mod, the game's banks left as they are: (the master with every replaced clip
    named by a new ID, for the boot bundle; {bank: {language: (Obsidian's bank of the new clips, its stream)}}, which
    goes in every bundle that holds that bank, as the game loads those after it sets the language). In each language
    of a bank, a replaced clip plays the mod's clip in that language, else the bank's own clip there; a language
    whose clips are those of language 0 has no variant (the game falls back to 0)."""
    with zipfile.ZipFile(zip_path) as z:
        m = json.loads(z.read(MANIFEST))
        new, mine = {}, {}
        for r in m["resources"]:
            bank = int(r["name"][1:], 16)
            for row in r["clips"]:
                clip = int(row["clip"][1:], 16)
                mine.setdefault(bank, set()).add(clip)
                new[(clip, row.get("lang", 0))] = (z.read(row["data"]), z.read(row["stream"]) if row.get("stream") else b"")
    master = game_master(game)
    taken = {c for _, c in clip_places(master)}
    variants = [b for b in game.banks if b["name"] in mine]
    for b in variants:
        taken.update(r[0] for r in b["rows"])
    ids = overlay_ids({c for c, _ in new}, taken)
    out = bytearray(master)
    for at, c in clip_places(master):
        if c in ids:
            struct.pack_into("<Q", out, at, ids[c])
    own = {}  # (bank, language, clip): the bank's own clip there
    for b in variants:
        rows = {r[0]: r for r in b["rows"] if r[0] in mine[b["name"]]}
        if rows:
            raw, stream = bank_files(game, b)
            for c, r in rows.items():
                own[(b["name"], b["lang"], c)] = (raw[r[1]:r[1] + r[2]], stream[r[3]:r[3] + r[4]])
    banks = {}
    for bank, clips in mine.items():
        heard = {lang: {ids[c]: new.get((c, lang)) or own.get((bank, lang, c)) or own.get((bank, 0, c)) or new[(c, 0)] for c in clips}
                 for lang in sorted({b["lang"] for b in variants if b["name"] == bank} | {0})}
        banks[bank] = {lang: overlay_bank(got) for lang, got in heard.items() if lang == 0 or got != heard[0]}
    return bytes(out), banks

def game_master(game: hd1.Hd1) -> bytes:
    """The game's timpani_master (in the boot bundle)."""
    for path in hd1._bundles(game.contents):
        with hd1.Bundle(path, game.chunks.get(path)) as b:
            for kind, _name, lang, at, size, _, _ in hd1._resources(b):
                if kind == hd1.MASTER:
                    return b.read(at, size)
    raise ValueError("no timpani_master in the game")
