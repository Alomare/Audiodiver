"""Game-wide audio index: which banks hold each sound's audio, which banks play it, and which archives hold each bank
or stream. Projects name targets by id alone; the archives to patch are looked up here, never typed.

It covers every archive with audio in it: the packages inside the bundles and the voice packs next to them (one set
per installed language). A sound is known by its source id. A voice line has a source id of its own in every
language, and its stream is filed under that language (`content/audio/us/<source id>`); a bank that plays such
sources is marked with the language's code. A stream no bank plays is known by its own file id.

A bank's path name comes from its wwise_dep resource, which spells it ("path"), so a bank the game adds is named
without any list.

It also keeps the ids of every bank's objects (Sounds, containers, events...): one object is often copied into many
banks under the same id, and audio added to the game has to go into every copy (addition.py), under ids the game
doesn't use. Each object's fingerprint ("prints", in the same order) says what it was in this version, for the
versions after it (tools/import_bank_history.py).

The index is cached per game version (keyed by the data files' fingerprint) and rebuilt after an update.
"""
import json
import os
import struct
import time
from functools import cached_property
from pathlib import Path

from . import bank as wbank
from .game import Game, WWISE_BANK, WWISE_STREAM, WWISE_DEP, murmur64_hash, stream_id

CACHE_DIR = Path(os.environ.get("AUDIODIVER_CACHE") or Path(os.environ.get("LOCALAPPDATA", Path.home())) / "Audiodiver")
FORMAT = 6
# the game's codes for the languages it has voices in, as its stream names spell them
LANGUAGES = {"us": "English", "bp": "Portuguese (Brazil)", "cn": "Chinese", "de": "German", "es": "Spanish (Spain)",
             "fr": "French", "it": "Italian", "jp": "Japanese", "ms": "Spanish (Latin America)", "ru": "Russian"}


def _language(bank: dict, streams: dict) -> str:
    """The code of the language a bank's streamed sources are filed under, "" for a bank whose sources are in banks
    or under their plain name. The first few sources that are neither settle it."""
    held, tried = set(bank["media"]), 0
    for sid in bank["refs"]:
        if sid in held:
            continue
        if str(stream_id(sid)) in streams:
            return ""
        for code in LANGUAGES:
            if str(stream_id(sid, code)) in streams:
                return code
        tried += 1
        if tried == 6:
            break
    return ""


def _dep_path(dep: bytes, fid: int) -> str:
    """A bank's path name ("content/audio/wep_autocannon"), from its wwise_dep resource (a hash, the name's length,
    the name); "" where the name doesn't hash to the bank's file id."""
    try:
        n = struct.unpack_from("<I", dep, 4)[0]
        path = dep[8:8 + n].rstrip(b"\0")
    except struct.error:
        return ""
    return path.decode("ascii", "replace") if murmur64_hash(path) == fid else ""


def build(game: Game, log=print) -> dict:
    t0, banks, streams = time.time(), {}, {}
    for name in game.packages:
        try:
            toc = game.package_toc(name) or []
        except Exception:
            continue
        for fid, tid, _off, _size in toc:
            if tid == WWISE_STREAM:
                streams.setdefault(str(fid), []).append(name)
        entries = [e for e in toc if e[1] == WWISE_BANK]
        if not entries:
            continue
        data = game.package(name)
        for fid, _t, off, size in entries:
            b = banks.setdefault(str(fid), {"archives": []})
            b["archives"].append(name)
            if "media" not in b:
                b["media"], b["refs"], b["music"], b["objects"], b["prints"] = wbank.audio_summary(data[off + 16:off + size])
        for fid, _t, off, size in (e for e in toc if e[1] == WWISE_DEP):
            b = banks.get(str(fid))
            if b is not None and "path" not in b and (path := _dep_path(data[off:off + size], fid)):
                b["path"] = path
    for b in banks.values():
        b["lang"] = _language(b, streams)
    log(f"indexed {len(banks)} banks and {len(streams)} streams in {time.time() - t0:.0f}s")
    return {"format": FORMAT, "fingerprint": game.audio_fingerprint, "banks": banks, "streams": streams}


class AudioIndex:
    def __init__(self, game: Game | None = None, rebuild=False, log=print):
        self.game = game or Game()
        path = CACHE_DIR / "audio_index.json"
        d = None
        if path.exists() and not rebuild:
            d = json.loads(path.read_text())
            if d.get("format") != FORMAT or d.get("fingerprint") != self.game.audio_fingerprint:
                log("game files changed since the last index; rebuilding it")
                d = None
        if d is None:
            d = build(self.game, log)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(d))
        self.banks = {int(k): v for k, v in d["banks"].items()}
        self.streams = {int(k): v for k, v in d["streams"].items()}
        self.holders, self.users = {}, {}
        self.language = {}   # source id -> language code, for the sources whose stream is filed under a language
        self.stream_of = {}  # source id -> the file id of its stream, for the sources that are streamed
        self.by_stream = {}  # the other way round
        spoken = []
        for bid, b in self.banks.items():
            for m in b["media"]:
                self.holders.setdefault(m, set()).add(bid)
            for s in b["refs"]:
                self.users.setdefault(s, set()).add(bid)
            if b.get("lang"):
                spoken.append(b)
        for b in spoken:
            for sid in b["refs"]:
                fid = stream_id(sid, b["lang"])
                if fid in self.streams:
                    self.language[sid] = b["lang"]
                    self.stream_of[sid], self.by_stream[fid] = fid, sid
        for sid in set(self.holders) | set(self.users):
            if sid not in self.stream_of:
                fid = stream_id(sid)
                self.by_stream[fid] = sid
                if fid in self.streams:
                    self.stream_of[sid] = fid
        # streams no bank plays: each is a sound of its own, known by its file id
        self.orphans = {fid for fid in self.streams if fid not in self.by_stream}
        self.by_archive = {}  # archive -> [bank ids]
        for bid, b in self.banks.items():
            for a in b["archives"]:
                self.by_archive.setdefault(a, []).append(bid)

    def resolve(self, target: int) -> int:
        """The id a sound goes by here, for a 32-bit source id or a 64-bit stream file id: the source id, or for a
        stream no bank plays the stream's own file id."""
        if target in self.holders or target in self.users or target in self.orphans:
            return target
        if target in self.by_stream:
            return self.by_stream[target]
        raise KeyError(f"{target} is not an audio source or stream in this game version")

    def banks_for(self, sid: int) -> set[int]:
        """Every bank that holds the source's audio or plays it."""
        return self.holders.get(sid, set()) | self.users.get(sid, set())

    @cached_property
    def _copies(self) -> dict[int, list[int]]:
        out = {}
        for bid, b in self.banks.items():
            for oid in b.get("objects", ()):
                out.setdefault(oid, []).append(bid)
        return out

    def copies(self, oid: int) -> list[int]:
        """The banks that have an object with this id (a Sound, a container, an event...), in id order."""
        return sorted(self._copies.get(oid, ()))

    @cached_property
    def taken(self) -> frozenset[int]:
        """Every id the game uses for an object or a sound: what a new one must not be."""
        return frozenset(self._copies) | frozenset(self.holders) | frozenset(self.users)

    def bank_files(self, bank_id: int):
        """(raw bank bytes, raw dep toc data or None) from the first archive that has the bank."""
        archive = self.banks[bank_id]["archives"][0]
        bank, _ = self.game.resource(archive, bank_id, WWISE_BANK)
        try:
            dep, _ = self.game.resource(archive, bank_id, WWISE_DEP)
        except KeyError:
            dep = None
        return bank[16:], dep

    def stream_file(self, sid: int) -> int | None:
        """The file id of the stream that holds a sound's audio, or None when its audio is only inside banks."""
        return sid if sid in self.orphans else self.stream_of.get(sid)

    def stream_data(self, sid: int, size: int | None = None) -> bytes | None:
        """A sound's stream (its first `size` bytes with a size: enough for the header), or None without one."""
        fid = self.stream_file(sid)
        if fid is None:
            return None
        archive = self.streams[fid][0]
        if size is None:
            return self.game.resource(archive, fid, WWISE_STREAM)[1]
        return self.game.stream_head(archive, fid, size)

    def wem(self, sid: int) -> bytes:
        """The vanilla .wem of a source: its stream, else its media in the first bank that holds it."""
        if (data := self.stream_data(sid)) is not None:
            return data
        for bid in sorted(self.holders.get(sid, ())):
            media, _ = wbank.parse(self.bank_files(bid)[0])
            if sid in media:
                return media[sid]
        raise KeyError(f"no audio for source {sid}")

    @property
    def music_banks(self) -> list[int]:
        """The banks of the game's interactive music. Voice banks use music objects for some lines too, but they
        are not music."""
        return sorted(bid for bid, b in self.banks.items() if b.get("music") and not b.get("lang"))
