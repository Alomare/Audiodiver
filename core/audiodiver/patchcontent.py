"""Patch Content: new audio for the sounds inside an existing mod, with the mod's own banks as the base.

A mod's patch holds whole banks as the game version it was made for had them, and the game plays a bank from a patch
in place of its own. When an update takes a sound out of the game, Repatch and Import can't keep it: they put a mod's
audio into the game's current banks, which no longer have it. 7.2.2 took out the flag-raising anthem that way: ten
objective banks (content/audio/obj_gen_raise_flag and the others) lost 8 clips (190505498 among them) and the 20
objects that played them, and their four flag events lost the action that started it. The events are still there
under the same IDs, so a patch with the older banks plays the anthem again. Here such a mod is the base: every file of
it stays byte for byte, and only the audio of the sounds given new audio changes, with the size fields that describe
it (patch.patch_bank). The sounds don't have to exist in the current game.

A sound is a source ID. In a bank it is held whole, or its start is held (a prefetch) with the whole file in a
stream, or it is only streamed; a stream goes by its file ID (game.stream_id: the plain one, or a voice line's with
its language). The new audio goes wherever the mod has the sound: every bank of every patch, and its stream.
"""
import hashlib
import struct
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

from . import bank as wbank
from . import music, patch, wem
from .game import WWISE_BANK, WWISE_DEP, WWISE_STREAM, stream_id
from .i18n import tr
from .index import CACHE_DIR, LANGUAGES, _dep_path

KINDS = ("bank", "prefetch", "stream")  # held whole in a bank, its start in a bank and the whole in a stream, a stream


class ContentError(Exception):
    for_people = True


@dataclass
class Sound:
    source: int
    banks: set = field(default_factory=set)      # the mod's banks that hold or play it
    keys: set = field(default_factory=set)       # the mod's patch files that have it
    kind: str = "bank"
    stream: int | None = None                    # the file ID of its stream in the mod
    duration_ms: float = 0.0


@dataclass
class Content:
    """What a mod's patches hold: their files on disk (a ZIP's taken out into a folder of its own), the banks by ID
    with a name, and the sounds by source ID."""
    found: object                                # repatch.Found
    files: dict = field(default_factory=dict)    # patch key -> its path on disk
    banks: dict = field(default_factory=dict)    # bank ID -> its path name, "" when the mod doesn't spell it
    sounds: dict = field(default_factory=dict)   # source ID -> Sound
    folder: tempfile.TemporaryDirectory | None = None

    def close(self):
        if self.folder:
            self.folder.cleanup()
            self.folder = None


def _sources(t: int, body: bytes):
    """(source ID, stream type) of each audio source of a Sound or MusicTrack, leaving out plugins that make their
    own sound (a tone, silence)."""
    for o in wbank.source_offsets(t, body):
        plugin, stype, sid = struct.unpack_from("<IBI", body, o)
        if plugin & 0xF != 2:
            yield sid, stype


def _stream_ids(sid: int) -> list[int]:
    """The file IDs a source's stream can have: the plain one, then a voice line's in each language."""
    return [stream_id(sid), *(stream_id(sid, code) for code in LANGUAGES)]


def read(found, ix=None) -> Content:
    """The sounds of every patch of a mod (repatch.scan's Found). ix (the game's index), when given, finds a stream
    the mod leaves to the game."""
    c = Content(found)
    c.folder = tempfile.TemporaryDirectory(prefix="audiodiver-content-", ignore_cleanup_errors=True)
    try:
        for i, key in enumerate(k for p in found.patches for k in p.keys):
            path = found.place(key, Path(c.folder.name) / str(i))
            c.files[key] = path
            _read_patch(c, key, path, ix)
    except (ValueError, struct.error, AssertionError, IndexError, OSError) as e:
        c.close()
        name = Path(key).name if found.patches else found.source.name
        raise ContentError(tr("{file} can't be read as a game patch: {why}").format(file=name, why=e)) from None
    if not c.sounds:
        c.close()
        raise ContentError(tr("{file} holds no audio").format(file=found.source.name))
    return c


def _read_patch(c: Content, key: str, path: Path, ix):
    deps = dict(patch._files(str(path), WWISE_DEP))
    heads = dict(_stream_heads(path))  # stream file ID -> its first bytes
    for bid, raw in patch._files(str(path), WWISE_BANK):
        name = _dep_path(deps[bid], bid) if bid in deps else ""
        c.banks[bid] = c.banks.get(bid) or name or (ix.banks[bid].get("path", "") if ix and bid in ix.banks else "")
        media, hirc = wbank.parse(raw)
        kinds = {}
        for t, body in hirc.values():
            if t in (wbank.SOUND, wbank.MUSIC_TRACK):
                for sid, stype in _sources(t, body):
                    kinds[sid] = max(kinds.get(sid, 0), stype)  # streamed in any copy: its audio is in a stream
        for sid in media:
            kinds.setdefault(sid, 0)
        for sid, stype in kinds.items():
            s = c.sounds.setdefault(sid, Sound(sid))
            s.banks.add(bid)
            s.keys.add(key)
            s.kind = KINDS[max(KINDS.index(s.kind), min(stype, 2))]
            if sid in media and not s.duration_ms:
                s.duration_ms = wem.length_ms(media[sid][:256]) or 0.0
        del media, hirc, raw
    for sid, s in c.sounds.items():
        if s.stream is None and key in s.keys:
            s.stream = next((fid for fid in _stream_ids(sid) if fid in heads), None)
    # a stream no bank in the mod plays: the mod replaces it as it is, a sound of its own
    played = {s.stream for s in c.sounds.values()}
    for fid in heads:
        if fid in played:
            continue
        sid = fid
        if ix:
            try:
                sid = ix.resolve(fid)
            except KeyError:
                pass
        s = c.sounds.setdefault(sid, Sound(sid, kind="stream", stream=fid))
        s.keys.add(key)
        s.stream = s.stream or fid
    for s in c.sounds.values():
        if key in s.keys and not s.duration_ms and s.stream in heads:
            s.duration_ms = wem.length_ms(heads[s.stream]) or 0.0


def _stream_heads(path: Path):
    """(file ID, first bytes) of each stream in a patch, read from its .stream file."""
    at = [(fid, off, size) for fid, t, _o, _s, off, size in patch._toc(str(path)) if t == WWISE_STREAM]
    if not at or not Path(str(path) + ".stream").is_file():
        return [(fid, b"") for fid, _, _ in at]
    out = []
    with open(str(path) + ".stream", "rb") as f:
        for fid, off, size in at:
            f.seek(off)
            out.append((fid, f.read(min(size, 256))))
    return out


def audio(c: Content, sid: int, ix=None) -> bytes:
    """The mod's .wem of a sound, whole: its stream in the mod, else the whole clip in one of its banks, else the
    game's stream (a prefetch left the rest to the game). ContentError when the mod has none of it."""
    s = c.sounds.get(sid)
    if s is None:
        raise ContentError(tr("The mod has no sound {id}").format(id=sid))
    for key in sorted(s.keys):
        path = c.files[key]
        if s.stream is not None:
            got = dict(patch._files(str(path), WWISE_STREAM, s.stream))
            if got.get(s.stream):
                return got[s.stream]
    if s.kind == "bank":
        for key in sorted(s.keys):
            for bid, raw in patch._files(str(c.files[key]), WWISE_BANK):
                if bid in s.banks:
                    media, _ = wbank.parse(raw)
                    if sid in media:
                        return media[sid]
    if ix is not None and ix.stream_file(sid) is not None:
        return ix.stream_data(sid)
    raise ContentError(tr("The audio of sound {id} isn't in the mod or the game").format(id=sid))


def preview(c: Content, sid: int, ix=None) -> Path:
    """A sound's audio in the mod as a WAV to play (cached by content, with the previews)."""
    data = audio(c, sid, ix)
    path = CACHE_DIR / "preview" / f"content-{hashlib.sha1(data).hexdigest()[:16]}.wem"
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    return Path(wem.decoded(path))


def rewrite(src: Path, out: Path, reps: dict, streams_of: dict) -> dict:
    """The patch src written again as out with new audio: reps {source: patch.Replacement}, streams_of {source: the
    file ID its stream goes to, or None}. Every file but the audio stays as it was. Returns {bank: BankEdit} of the
    banks that changed."""
    banks, edits = {}, {}
    for bid, raw in patch._files(str(src), WWISE_BANK):
        new, edit = patch.patch_bank(raw, reps, {})
        banks[bid] = new
        if new is not raw:
            edits[bid] = edit
    streams = dict(patch._files(str(src), WWISE_STREAM))
    for sid, fid in streams_of.items():
        if fid is not None and sid in reps:
            streams[fid] = reps[sid].wem
    deps = dict(patch._files(str(src), WWISE_DEP))
    patch.write_patch(str(out), streams, banks, deps, carried=patch.carried_of(str(src)))
    return edits


def verify(src: Path, out: Path, reps: dict, streams_of: dict) -> list[str]:
    """What is wrong with a rewritten patch: it must hold what src held, with only the replaced sounds' audio, the
    sizes that describe it and the timing of the music that plays it changed, and their streams. Empty = good."""
    problems = []
    old_banks = dict(patch._files(str(src), WWISE_BANK))
    new_banks = dict(patch._files(str(out), WWISE_BANK))
    if set(old_banks) != set(new_banks):
        return [f"banks {sorted(set(old_banks) ^ set(new_banks))[:5]} are missing or extra"]
    for bid, raw in old_banks.items():
        (m0, h0), (m1, h1) = wbank.parse(raw), wbank.parse(new_banks[bid])
        if set(m0) != set(m1) or set(h0) != set(h1):
            problems.append(f"bank {bid}: media or objects are missing or extra")
            continue
        for sid in m0:
            if sid in reps:
                if not reps[sid].wem.startswith(m1[sid]) or not m1[sid]:
                    problems.append(f"bank {bid}: media {sid} isn't the new audio")
            elif m0[sid] != m1[sid]:
                problems.append(f"bank {bid}: media {sid} changed")
        changed_tracks = set()
        for oid, (t, body) in h0.items():
            if h1[oid] == (t, body):
                continue
            plays = t in (wbank.SOUND, wbank.MUSIC_TRACK) and any(s in reps for s, _ in _sources(t, body))
            if t == wbank.MUSIC_TRACK and plays:
                changed_tracks.add(oid)
            if not plays and t != wbank.MUSIC_SEGMENT:
                problems.append(f"bank {bid}: {wbank.TYPE_NAMES.get(t, hex(t))} {oid} changed")
        for oid, (t, body) in h0.items():
            if t == wbank.MUSIC_SEGMENT and h1[oid] != (t, body):
                seg = music.MusicSegment.read(oid, music.Reader(bytes(body)))
                if not set(seg.node.children) & changed_tracks:
                    problems.append(f"bank {bid}: music segment {oid} changed")
    old_streams = dict(patch._files(str(src), WWISE_STREAM))
    new_streams = dict(patch._files(str(out), WWISE_STREAM))
    want = {fid: reps[sid].wem for sid, fid in streams_of.items() if fid is not None and sid in reps}
    for fid in set(old_streams) | set(new_streams):
        expected = want.get(fid, old_streams.get(fid))
        if new_streams.get(fid) != expected:
            problems.append(f"stream {fid} isn't as meant")
    if dict(patch._files(str(src), WWISE_DEP)) != dict(patch._files(str(out), WWISE_DEP)):
        problems.append("the bank names changed")
    return problems + patch.verify_carried(str(out), patch.carried_of(str(src)))


def streams_for(c: Content, sids, ix=None) -> dict:
    """{source: the file ID its new audio goes to as a stream, or None for one held whole in banks}: the mod's
    stream, else the game's, else a plain one for a sound the banks stream."""
    out = {}
    for sid in sids:
        s = c.sounds[sid]
        if s.stream is not None:
            out[sid] = s.stream
        elif s.kind == "bank":
            out[sid] = None
        elif ix is not None and ix.stream_file(sid) is not None:
            out[sid] = ix.stream_file(sid)
        else:
            out[sid] = stream_id(sid)
    return out
