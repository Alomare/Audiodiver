"""Failures in words for the person using Audiodiver: the same whatever language Windows speaks, and without Python's
own vocabulary. The details (tracebacks, the tool's command line) go to the log."""
import errno
import subprocess
from pathlib import Path

from .i18n import N_, tr

_OS_WORDS = {errno.ENOENT: N_("{file} wasn't found"), errno.EACCES: N_("{file} can't be opened: access was denied"),
             errno.EEXIST: N_("{file} already exists"), errno.ENOTDIR: N_("{file} isn't a folder"),
             errno.EISDIR: N_("{file} is a folder"), errno.EINVAL: N_("{file} isn't a valid path"),
             errno.ENOSPC: N_("{file} can't be written: the disk is full"),
             errno.EROFS: N_("{file} can't be written: the disk is read-only"),
             errno.ENAMETOOLONG: N_("{file} has a path that is too long")}


def os_error(e: OSError, what="") -> str:
    """An OS error in plain words (Windows' own message is in its language). An OSError raised with only a message
    (a FileNotFoundError of our own) keeps that message."""
    if e.errno is None:
        return str(e)
    name = e.filename or what or tr("A file")
    if e.errno in _OS_WORDS:
        return tr(_OS_WORDS[e.errno]).format(file=name)
    return tr("{file} gave an error: {error}").format(file=name, error=e.strerror or type(e).__name__)


def tool_file(e: subprocess.CalledProcessError) -> str:
    """The file a tool was working on when it failed: what follows -i (ffmpeg), else the last argument."""
    cmd = [str(c) for c in (e.cmd if isinstance(e.cmd, (list, tuple)) else [e.cmd])]
    if "-i" in cmd[:-1]:
        return Path(cmd[cmd.index("-i") + 1]).name
    return Path(cmd[-1]).name if len(cmd) > 1 else tr("a file")


def plain(e: BaseException, log_hint=True) -> str:
    """Any failure as the UI shows it. An exception whose class says it is for people (EditorError, BuildError) keeps
    its words; log_hint (that the log has the details) is false where there is no log (the command line)."""
    if getattr(e, "for_people", False):
        return str(e)
    if isinstance(e, OSError):
        return os_error(e)
    if isinstance(e, subprocess.CalledProcessError):
        tool = Path(str(e.cmd[0] if isinstance(e.cmd, (list, tuple)) else e.cmd)).stem
        return (tr("{tool} couldn't process {file} (the log has the details)") if log_hint
                else tr("{tool} couldn't process {file}")).format(tool=tool, file=tool_file(e))
    return (tr("Something went wrong ({error}): the log has the details") if log_hint
            else tr("Something went wrong ({error})")).format(error=type(e).__name__)
