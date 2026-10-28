"""Notes people write in a project (project.py, `notes`), in Markdown, by key:

    clip:<source id>    item:<Index item id, or archive:<name>>

The details panel writes those two. Projects of earlier versions can also hold notes under these keys, kept and
not shown:

    cat:<category id>    sec:<section id>    seg:<music segment id>    obj:<the container that holds a sound's takes>

A note whose thing a game update took away stays in the file: nothing shows it, and it comes back if the id does.
Empty text removes a note.
"""
import re

from .i18n import tr

KEY = re.compile(r"^(cat|sec|item|seg|obj|clip):\S{1,300}$")
MAX_TEXT = 100_000  # characters in one note


def check(key, text) -> tuple[str, str]:
    """The key and the text as they are kept (the text without trailing blank lines), or ValueError. A key or a text
    of the wrong kind is the app's mistake, said in English; a note too long can be anyone's."""
    if not isinstance(key, str) or not KEY.match(key):
        raise ValueError(f"{key!r} isn't something a note can go on")
    if not isinstance(text, str):
        raise ValueError("A note is text")
    if len(text) > MAX_TEXT:
        raise ValueError(tr("A note can be up to {n} characters long").format(n=f"{MAX_TEXT:,}"))
    return key, text.rstrip()


def tidy(d) -> tuple[dict[str, str], bool]:
    """The valid notes of a {key: text} read from a file, and whether any had to be left out."""
    if not isinstance(d, dict):
        return {}, d is not None
    out = {}
    for k, v in d.items():
        try:
            k, v = check(k, v)
        except ValueError:
            continue
        if v:
            out[k] = v
    return out, len(out) != len(d)
