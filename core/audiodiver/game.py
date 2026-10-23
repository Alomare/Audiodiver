"""Read access to the installed game: finds the data folder, lists packages and reads their TOC and stream data.

Most packages live inside the `bundles.NN.nxa` files (the "slim" install); the vendored hd2-audio-modder reader
rebuilds them. The voice packs, one set per installed language, are files of their own next to the bundles: each a
compressed "DSAR" file, with its audio in a `.stream` file beside it. Those are read here, a piece at a time.
"""
import bisect
import collections
import functools
import glob
import os
import re
import struct
import threading
import zlib
from pathlib import Path

from lz4 import block

from ._vendor import slim

WWISE_STREAM = 5785811756662211598
WWISE_BANK = 6006249203084351385
WWISE_DEP = 12624162998411505776
PATCH_MAGIC = 0xF0000011

_STEAM_DEFAULT = r"C:\Program Files (x86)\Steam"
STEAM_APP = 553850


def murmur64_hash(data: bytes, seed: int = 0) -> int:
    """MurmurHash64A, the game's resource id hash (`murmur64("content/audio/<source id>")` names a stream)."""
    m, r, mask = 0xC6A4A7935BD1E995, 47, 2 ** 64 - 1
    h = seed ^ ((m * len(data)) & mask)
    off = len(data) // 8 * 8
    for i in range(0, off, 8):
        k = (int.from_bytes(data[i:i + 8], "little") * m) & mask
        k = ((k ^ (k >> r)) * m) & mask
        h = ((h ^ k) * m) & mask
    if len(data) & 7:
        h = ((h ^ int.from_bytes(data[off:], "little")) * m) & mask
    h = ((h ^ (h >> r)) * m) & mask
    return h ^ (h >> r)


def stream_id(source_id: int, language: str = "") -> int:
    """The file id of a source's stream. Voice lines are kept per language: `content/audio/us/<source id>`."""
    return murmur64_hash(f"content/audio/{language + '/' if language else ''}{source_id}".encode())


# --- the archives inside the bundles, and the cache of the ones read whole (the index reads each package once, a
# preview of a streamed sound its archive's stream data), trimmed between jobs so an idle core gives the memory
# back. A bank or a table is read from only the chunks that hold it (bundle_part): reading whole packages, a Dune
# build read 16 of them over and over and kept up to 600 MB of them
PACKAGE_CACHE, STREAM_CACHE = 150 << 20, 300 << 20  # bytes
IDLE_CACHE = 150 << 20


def from_bundles(data: Path, name: str) -> bytes:
    """slim.reconstruct_package_from_bundles, with each bundle file opened once (slim opens it again for every chunk:
    about 25,700 opens in a Dune build). The same bytes: each part of the package is the bundle's resources from its
    start, one after another, until the part is covered."""
    p = slim.package_contents.get(name)
    if p is None:
        return b""
    out, files, counts = bytearray(p.size), {}, {}
    try:
        for i, item in enumerate(p.entries):
            end = p.entries[i + 1].original_archive_offset if i + 1 < len(p.entries) else p.size
            bundle = f"bundles.{item.bundle_index:02d}.nxa"
            if bundle not in files:
                f = open(data / bundle, "rb")
                files[bundle] = f
                f.seek(8)
                counts[bundle] = struct.unpack("<I", f.read(4))[0]
            f, starts, done = files[bundle], slim.bundle_offsets[bundle], 0
            while done < end - item.original_archive_offset:
                piece = _bundle_resource(f, counts[bundle], starts[item.start_offset + done])
                at = item.original_archive_offset + done
                out[at:at + len(piece)] = piece
                done += len(piece)
    finally:
        for f in files.values():
            f.close()
    return bytes(out)


@functools.lru_cache(maxsize=64)
def _part_starts(p: slim.Package) -> list[int] | None:
    """Where each part of a package starts in it, or None when they aren't in order."""
    begins = [e.original_archive_offset for e in p.entries]
    return begins if all(a <= b for a, b in zip(begins, begins[1:])) else None


def bundle_part(data: Path, name: str, offset: int, size: int) -> bytes | None:
    """from_bundles(data, name)[offset:offset + size], decompressing only the chunks that hold those bytes: a bank
    cost its whole package (up to 169 MB) and a place in the package cache. None for a range past the package's end
    or a package whose parts aren't in order, which only a whole rebuild reads as from_bundles does."""
    p = slim.package_contents.get(name)
    if p is None or offset < 0 or size < 0 or offset + size > p.size or (begins := _part_starts(p)) is None:
        return None
    parts, end, out, files, counts = p.entries, offset + size, bytearray(size), {}, {}
    try:
        for i in range(max(0, bisect.bisect_right(begins, offset) - 1), len(parts)):
            item, lo = parts[i], begins[i]
            if lo >= end:
                break
            hi = begins[i + 1] if i + 1 < len(parts) else p.size
            if hi <= offset:
                continue
            bundle = f"bundles.{item.bundle_index:02d}.nxa"
            if bundle not in files:
                f = open(data / bundle, "rb")
                files[bundle] = f
                f.seek(8)
                counts[bundle] = struct.unpack("<I", f.read(4))[0]
            f, count, starts, at = files[bundle], counts[bundle], slim.bundle_offsets[bundle], lo
            # resource by resource as from_bundles reads them; a part's bytes are its own up to the next part's
            # start, also where its last resource runs on
            while at < hi and at < end:
                chunk, first = starts[item.start_offset + at - lo], True
                while True:
                    f.seek(0x20 + 0x20 * chunk)
                    _, stored_at, length, stored, compression, flags = struct.unpack("<QQIIBB6x", f.read(0x20))
                    if flags & slim.START and not first:
                        break
                    first, n = False, length if compression == slim.COMPRESSED else stored
                    a, b = max(at, offset), min(at + n, hi, end)
                    if a < b:
                        f.seek(stored_at)
                        piece = f.read(stored)
                        if compression == slim.COMPRESSED:
                            piece = block.decompress(piece, uncompressed_size=length)
                        if len(piece) != n:  # a chunk shorter than its header says: the whole rebuild has it right
                            return None
                        out[a - offset:b - offset] = memoryview(piece)[a - at:b - at]
                    at += n
                    if chunk == count - 1:
                        break
                    chunk += 1
    finally:
        for f in files.values():
            f.close()
    return bytes(out)


def _bundle_resource(f, count: int, chunk: int) -> bytes:
    """One resource of an open bundle of `count` chunks: its chunks from `chunk` to the next that starts a resource
    (as slim reads it)."""
    data = []
    while True:
        f.seek(0x20 + 0x20 * chunk)
        _, stored_at, length, stored, compression, flags = struct.unpack("<QQIIBB6x", f.read(0x20))
        if flags & slim.START and data:
            return b"".join(data)
        f.seek(stored_at)
        raw = f.read(stored)
        data.append(block.decompress(raw, uncompressed_size=length) if compression == slim.COMPRESSED else raw)
        if chunk == count - 1:
            return b"".join(data)
        chunk += 1


class SizedCache:
    """Byte strings by key, the least recently used dropped once they add up to more than `cap` bytes (the newest
    always stays, however large)."""

    def __init__(self, cap: int):
        self.cap, self.items, self.lock = cap, collections.OrderedDict(), threading.Lock()

    def get(self, key, make):
        with self.lock:
            if key in self.items:
                self.items.move_to_end(key)
                return self.items[key]
        value = make()  # outside the lock: a build and a preview read different packages at once
        with self.lock:
            self.items[key] = value
            self.items.move_to_end(key)
            self._drop(self.cap, keep=1)
        return value

    def trim(self, cap: int):
        """Drops the least recently used until the rest adds up to `cap` bytes at most."""
        with self.lock:
            self._drop(cap, keep=0)

    def _drop(self, cap, keep):
        total = sum(len(v) for v in self.items.values())
        while total > cap and len(self.items) > keep:
            total -= len(self.items.popitem(last=False)[1])


# --- archives kept as files of their own (DSAR): a table of chunks, each stored as it is or LZ4-compressed
DSAR_MAGIC = b"DSAR"
_DSAR_LZ4 = 0x03


@functools.lru_cache(maxsize=128)
def _dsar_chunks(path: str, stamp: tuple) -> tuple[list[int], list[tuple]]:
    """([uncompressed offset of each chunk], [(uncompressed offset, compressed offset, uncompressed size,
    compressed size, compression)]). `stamp` (size, modified) makes a changed file read again."""
    with open(path, "rb") as f:
        head = f.read(0x20)
        if head[:4] != DSAR_MAGIC:
            raise ValueError(f"{path} is not a DSAR archive")
        raw = f.read(0x20 * struct.unpack_from("<I", head, 8)[0])
    chunks = [struct.unpack_from("<QQIIB", raw, at) for at in range(0, len(raw), 0x20)]
    return [c[0] for c in chunks], chunks


def dsar_read(path, offset: int = 0, size: int | None = None) -> bytes:
    """`size` bytes from `offset` of what a DSAR file holds once uncompressed (all of it without a size). Only the
    chunks that cover the range are read, so one voice line doesn't cost its whole archive."""
    path = str(path)
    st = os.stat(path)
    starts, chunks = _dsar_chunks(path, (st.st_size, st.st_mtime_ns))
    if not chunks:
        return b""
    total = chunks[-1][0] + chunks[-1][2]
    end = total if size is None else min(total, offset + size)
    out, i = [], max(0, bisect.bisect_right(starts, offset) - 1)
    with open(path, "rb") as f:
        while i < len(chunks) and chunks[i][0] < end:
            at, stored_at, length, stored, compression = chunks[i]
            f.seek(stored_at)
            data = f.read(stored)
            if compression == _DSAR_LZ4:
                data = block.decompress(data, uncompressed_size=length)
            out.append(data[max(0, offset - at):end - at])
            i += 1
    return b"".join(out)


def is_dsar(path: Path) -> bool:
    try:
        with open(path, "rb") as f:
            return f.read(4) == DSAR_MAGIC
    except OSError:
        return False


def _steam_roots() -> list[str]:
    """Where Steam is installed: the registry's answer first (Steam can live anywhere), then the usual place."""
    roots = []
    if os.name == "nt":
        import winreg
        for hive, key, value in ((winreg.HKEY_CURRENT_USER, r"Software\Valve\Steam", "SteamPath"),
                                 (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Valve\Steam", "InstallPath")):
            try:
                with winreg.OpenKey(hive, key) as k:
                    roots.append(str(Path(winreg.QueryValueEx(k, value)[0])))
            except OSError:
                pass
    return list(dict.fromkeys(roots + [_STEAM_DEFAULT]))


def is_data_folder(folder) -> bool:
    """True for a Helldivers 2 data folder: it holds the game's bundles (bundles.NN.nxa)."""
    return Path(folder).is_dir() and any(Path(folder).glob("bundles.*.nxa"))


def data_folder(chosen, saved=False) -> Path:
    """The data folder in or under a folder someone picked: the data folder itself, the game's folder, or the Steam
    library folder above it. Raises ValueError, in words for that person, when none of them is the game's. saved: a
    folder chosen earlier (Audiodiver's settings), which may have gone since."""
    chosen = Path(chosen)
    for folder in (chosen, chosen / "data", chosen / "Helldivers 2" / "data",
                   chosen / "common" / "Helldivers 2" / "data", chosen / "steamapps" / "common" / "Helldivers 2" / "data"):
        if is_data_folder(folder):
            return folder
    if chosen.is_file():
        raise ValueError(f"{chosen} is a file. Choose the folder Steam installed Helldivers 2 in.")
    if not chosen.is_dir():
        raise ValueError(f"{chosen} isn't there any more" if saved else f"{chosen} wasn't found")
    raise ValueError(f"{chosen} isn't Helldivers 2's folder, because it has no game files (bundles.NN.nxa in "
                     f"a folder called data). Choose the folder Steam installed the game in, usually "
                     r"…\steamapps\common\Helldivers 2.")


def in_game_folder(folder, data) -> bool:
    """True when folder is the game's own folder (the one its data folder `data` sits in) or anywhere inside it.
    Audiodiver never writes there."""
    folder, data = Path(folder).resolve(), Path(data).resolve()
    game = data.parent if data.parent != data.parent.parent else data  # a data folder at a drive's root stands alone
    return folder == game or game in folder.parents


def locate(chosen=None) -> tuple[Path, str]:
    """(data folder, how it was found): "chosen" in Audiodiver's settings, "env" from $HD2_DATA, or "steam" from the
    Steam libraries. Raises FileNotFoundError when there is no game to be found."""
    if chosen:
        try:
            return data_folder(chosen, saved=True), "chosen"
        except ValueError as e:
            raise FileNotFoundError(str(e)) from None
    env = os.environ.get("HD2_DATA")
    if env:
        if not is_data_folder(env):
            raise FileNotFoundError(f"The HD2_DATA environment variable points to {env}, and Helldivers 2's files "
                                    f"aren't there")
        return Path(env), "env"
    libraries = []
    for root in _steam_roots():
        libraries.append(root)
        vdf = Path(root) / "steamapps" / "libraryfolders.vdf"
        if vdf.exists():
            libraries += [p.replace("\\\\", "\\") for p in re.findall(r'"path"\s+"([^"]+)"', vdf.read_text(errors="replace"))]
    for lib in dict.fromkeys(libraries):
        data = Path(lib) / "steamapps" / "common" / "Helldivers 2" / "data"
        if is_data_folder(data):  # an uninstalled game can leave its folder behind
            return _as_spelled(data), "steam"
    raise FileNotFoundError("Audiodiver didn't find Helldivers 2 in your Steam libraries")


def _as_spelled(path: Path) -> Path:
    """The path with the capitals the disk gives it, for showing it to people: Steam's registry entry is all lower
    case. Left as it is when resolving it leads somewhere else (a link)."""
    try:
        real = path.resolve()
    except OSError:
        return path
    return real if os.path.normcase(real) == os.path.normcase(path) else path


def find_data_folder(chosen=None) -> Path:
    """The folder chosen in Audiodiver's settings, else $HD2_DATA, else the Steam library that has Helldivers 2."""
    return locate(chosen)[0]


class Game:
    """One installed game version. `fingerprint` changes whenever an update touches the data files."""

    def __init__(self, data_folder=None):
        self.data = Path(data_folder) if data_folder else find_data_folder()
        slim.slim_init(str(self.data))
        self.loose = self._loose()  # {name: path} of the archives outside the bundles (the voice packs)
        self.packages = sorted(set(slim.package_contents) | set(self.loose))
        # whole packages and streams as the index and previews read them, by size: lru_cache kept 8 whole packages
        # of up to 169 MB each for as long as the core ran
        self._package_cache, self._stream_cache = SizedCache(PACKAGE_CACHE), SizedCache(STREAM_CACHE)

    def _loose(self) -> dict[str, Path]:
        """The archives that are files of their own. A language that isn't installed leaves a stub of a few bytes
        with nothing in it, which is left out."""
        out = {}
        for p in self.data.iterdir():
            if re.fullmatch(r"[0-9a-f]{16}", p.name) and p.name not in slim.package_contents and p.is_file() \
                    and p.stat().st_size > 512 and is_dsar(p):
                out[p.name] = p
        return out

    @functools.cached_property
    def fingerprint(self) -> str:
        files = sorted(glob.glob(str(self.data / "bundles.*")))
        return ";".join(f"{os.path.basename(f)}:{os.path.getsize(f)}:{int(os.path.getmtime(f))}" for f in files)

    @functools.cached_property
    def audio_fingerprint(self) -> str:
        """fingerprint plus the archives outside the bundles: a language added or removed in Steam changes what
        audio there is, without touching the bundles."""
        loose = ";".join(f"{n}:{p.stat().st_size}:{int(p.stat().st_mtime)}" for n, p in sorted(self.loose.items()))
        return f"{self.fingerprint}|{loose}"

    @functools.cached_property
    def steam(self) -> dict:
        """{"build": Steam's build id, "updated": when Steam last updated the game (Unix seconds)}, from the app
        manifest in the Steam library the game is in; {} for a game Steam didn't install there."""
        try:
            text = (self.data.parent.parent.parent / f"appmanifest_{STEAM_APP}.acf").read_text(errors="replace")
        except OSError:
            return {}
        got = dict(re.findall(r'"(buildid|LastUpdated)"\s+"(\d+)"', text))
        return {k: int(got[n]) for k, n in (("build", "buildid"), ("updated", "LastUpdated")) if n in got}

    @functools.cached_property
    def version(self) -> str:
        """The game's version, the same on every computer that has it: Steam's build id, else the bundles' sizes as
        one number (`fingerprint` has their times too, which differ between computers)."""
        if "build" in self.steam:
            return str(self.steam["build"])
        sizes = ";".join(f"{os.path.basename(f)}:{os.path.getsize(f)}" for f in sorted(glob.glob(str(self.data / "bundles.*"))))
        return f"files-{zlib.crc32(sizes.encode()):08x}"

    def package_toc(self, name):
        """[(file id, type id, toc offset, toc size)], read from the start of the package only."""
        if name in self.loose:
            return [(fid, tid, off, size) for fid, tid, off, size, *_ in toc_entries(self.package(name))]
        p = slim.package_contents[name]
        first = min(p.entries, key=lambda e: e.original_archive_offset)
        bundle = str(self.data / f"bundles.{first.bundle_index:02d}.nxa")
        head = slim.get_resource_from_bundle(bundle, first.start_offset)
        magic, ntypes, nfiles = struct.unpack_from("<III", head)
        if magic != PATCH_MAGIC:
            return None
        need = 72 + ntypes * 32 + nfiles * 80
        if len(head) < need:
            head = b"".join(slim.get_resources_from_bundle(bundle, first.start_offset, need))
        return [(fid, tid, off, size) for fid, tid, off, size, *_ in toc_entries(head)]

    def package(self, name) -> bytes:
        return self._package_cache.get(name, lambda: dsar_read(self.loose[name]) if name in self.loose
                                       else from_bundles(self.data, name))

    def package_part(self, name, offset: int, size: int) -> bytes:
        """package(name)[offset:offset + size], read from only the chunks that hold it."""
        if name in self.loose:
            return dsar_read(self.loose[name], offset, size)
        part = bundle_part(self.data, name, offset, size)
        return self.package(name)[offset:offset + size] if part is None else part

    def stream(self, name) -> bytes:
        return self._stream_cache.get(name, lambda: from_bundles(self.data, name + ".stream"))

    def trim_caches(self):
        """After a job: what previews need stays, the rest goes."""
        self._package_cache.trim(IDLE_CACHE)
        self._stream_cache.trim(IDLE_CACHE)

    def stream_part(self, name, offset: int, size: int) -> bytes:
        """A piece of a package's stream data."""
        if name in self.loose:
            return dsar_read(f"{self.loose[name]}.stream", offset, size)
        return self.stream(name)[offset:offset + size]

    @functools.lru_cache(maxsize=16)
    def contents(self, name) -> dict:
        """{(file id, type id): (toc offset, toc size, stream offset, stream size)} of a package, read from its table
        of contents only."""
        head = self.package_part(name, 0, 72)
        if head[:4] == struct.pack("<I", PATCH_MAGIC):  # else toc_entries says what it is
            types, files = struct.unpack_from("<II", head, 4)
            head = self.package_part(name, 0, 72 + 32 * types + 80 * files)
        return {(fid, tid): (off, size, s_off, s_size)
                for fid, tid, off, size, s_off, s_size in toc_entries(head)}

    def resource(self, name, file_id, type_id):
        """(toc data, stream data) of one resource in a package. Only its own bytes are read: a build reads its
        banks twice (to patch them, then to check the patch) and keeps none of their packages."""
        at = self.contents(name).get((file_id, type_id))
        if at is None:
            raise KeyError(f"{file_id}/{type_id} not in {name}")
        off, size, s_off, s_size = at
        return self.package_part(name, off, size), (self.stream_part(name, s_off, s_size) if s_size else b"")

    def stream_head(self, name, file_id, size: int) -> bytes | None:
        """The first bytes of a stream, where they can be had without rebuilding a whole package: in the archives
        outside the bundles. None anywhere else."""
        at = self.contents(name).get((file_id, WWISE_STREAM)) if name in self.loose else None
        return self.stream_part(name, at[2], min(size, at[3])) if at else None


def toc_entries(data: bytes):
    """[(file id, type id, toc offset, toc size, stream offset, stream size)] of a package or patch."""
    magic, nt, nf = struct.unpack_from("<III", data)
    assert magic == PATCH_MAGIC, "not a game archive"
    base, out = 72 + nt * 32, []
    for i in range(nf):
        e = base + 80 * i
        fid, tid, toc_off, stream_off = struct.unpack_from("<QQQQ", data, e)
        toc_size, stream_size = struct.unpack_from("<II", data, e + 56)
        out.append((fid, tid, toc_off, toc_size, stream_off, stream_size))
    return out
