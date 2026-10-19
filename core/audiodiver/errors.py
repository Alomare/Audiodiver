"""Failures in words for the person using Audiodiver: the same whatever language Windows speaks, and without Python's
own vocabulary. The details (tracebacks, the tool's command line) go to the log."""
import errno
import subprocess
from pathlib import Path

_OS_WORDS = {errno.ENOENT: "wasn't found", errno.EACCES: "can't be opened: access was denied",
             errno.EEXIST: "already exists", errno.ENOTDIR: "isn't a folder", errno.EISDIR: "is a folder",
             errno.EINVAL: "isn't a valid path", errno.ENOSPC: "can't be written: the disk is full",
             errno.EROFS: "can't be written: the disk is read-only", errno.ENAMETOOLONG: "has a path that is too long"}


def os_error(e: OSError, what="") -> str:
    """An OS error in plain words (Windows' own message is in its language). An OSError raised with only a message
    (a FileNotFoundError of our own) keeps that message."""
    if e.errno is None:
        return str(e)
    name = e.filename or what or "A file"
    return f"{name} {_OS_WORDS.get(e.errno) or 'gave an error: ' + (e.strerror or type(e).__name__)}"


def tool_file(e: subprocess.CalledProcessError) -> str:
    """The file a tool was working on when it failed: what follows -i (ffmpeg), else the last argument."""
    cmd = [str(c) for c in (e.cmd if isinstance(e.cmd, (list, tuple)) else [e.cmd])]
    if "-i" in cmd[:-1]:
        return Path(cmd[cmd.index("-i") + 1]).name
    return Path(cmd[-1]).name if len(cmd) > 1 else "a file"


def plain(e: BaseException, log_hint=" (the log has the details)") -> str:
    """Any failure as the UI shows it. An exception whose class says it is for people (EditorError, BuildError) keeps
    its words; log_hint is left out where there is no log (the command line)."""
    if getattr(e, "for_people", False):
        return str(e)
    if isinstance(e, OSError):
        return os_error(e)
    if isinstance(e, subprocess.CalledProcessError):
        return f"{Path(str(e.cmd[0] if isinstance(e.cmd, (list, tuple)) else e.cmd)).stem} couldn't process {tool_file(e)}{log_hint}"
    hint = log_hint.strip(" ()")
    return f"Something went wrong ({type(e).__name__}): {hint}" if hint else f"Something went wrong ({type(e).__name__})"
