"""Mods packed as .7z or .rar, which mod managers take as well as ZIPs: unpacked by 7-Zip into the cache, and read
from there as a mod folder (repatch.Found.root).

A release carries 7-Zip in core/tools (7z with 7z.dll on Windows, 7zz on Linux: both read RAR). Elsewhere the one on
PATH is used, else the one 7-Zip's installer puts in Program Files.
"""
import hashlib
import os
import shutil
import subprocess
import uuid
from pathlib import Path

from .i18n import tr

TYPES = (".7z", ".rar")
KEEP = 6  # unpacked archives kept in the cache; older ones are removed when another is unpacked


class ArchiveError(Exception):
    for_people = True


def is_archive(path) -> bool:
    return Path(path).suffix.lower() in TYPES


def seven_zip() -> str | None:
    """The 7-Zip program, or None."""
    for name in ("7zz", "7z", "7za"):  # 7za reads no RAR: the last resort, for .7z only
        if found := shutil.which(name):
            return found
    for base in (os.environ.get("ProgramW6432"), os.environ.get("ProgramFiles")):
        if base and (exe := Path(base) / "7-Zip" / "7z.exe").is_file():
            return str(exe)
    return None


def _folder() -> Path:
    from .index import CACHE_DIR
    return CACHE_DIR / "unpacked"


def unpack(path) -> Path:
    """The folder `path` (a .7z or .rar) is unpacked in; unpacked once for each version of the file (its place, size
    and time name the folder)."""
    path = Path(path)
    st = path.stat()
    tag = hashlib.sha1(f"{str(path.resolve()).lower()}|{st.st_size}|{st.st_mtime_ns}".encode()).hexdigest()[:16]
    root = _folder()
    out = root / tag
    if (out / ".done").is_file():
        os.utime(out)  # the newest, for _prune
        return out
    exe = seven_zip()
    if not exe:
        raise ArchiveError(tr("{file} can't be opened: reading .7z and .rar files needs 7-Zip").format(file=path.name))
    part = root / f"{tag}.{uuid.uuid4().hex[:6]}.part"
    part.mkdir(parents=True)
    try:
        # -p with nothing after it: an archive with a password fails instead of asking for one
        r = subprocess.run([exe, "x", "-y", "-p", "-bso0", "-bsp0", f"-o{part}", "--", str(path)],
                           stdin=subprocess.DEVNULL, capture_output=True, text=True, errors="replace",
                           creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        if r.returncode != 0:
            text = (r.stderr or r.stdout).lower()
            why = (tr("{file} has a password. Unpack it with the password first") if "password" in text
                   else tr("{file} can't be opened as a .7z or .rar file"))
            raise ArchiveError(why.format(file=path.name))
        inside = part.resolve()
        for f in part.rglob("*"):  # nothing may land outside the folder, a link included
            if f.is_symlink() or not f.resolve().is_relative_to(inside):
                raise ArchiveError(tr("{file} can't be opened as a .7z or .rar file").format(file=path.name))
        (part / ".done").write_text(str(path), encoding="utf-8")
        shutil.rmtree(out, ignore_errors=True)
        part.rename(out)
    except BaseException:
        shutil.rmtree(part, ignore_errors=True)
        raise
    _prune(root, keep=out)
    return out


def _prune(root: Path, keep: Path):
    """Removes all but the KEEP most recently used unpacked archives, and parts an earlier run left behind."""
    try:
        done = sorted((d for d in root.iterdir() if d.is_dir() and (d / ".done").is_file()),
                      key=lambda d: d.stat().st_mtime, reverse=True)
        stale = [d for d in root.iterdir() if d.is_dir() and d.name.endswith(".part")]
    except OSError:
        return
    for d in done[KEEP:] + stale:
        if d != keep:
            shutil.rmtree(d, ignore_errors=True)
