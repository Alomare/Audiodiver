"""Notes people write on what the Audio Editor shows: one global note per thing, kept for every project in
`notes.json` beside the core's settings, and one per project, in its file (project.py, `notes`). Both are Markdown,
keyed alike:

    cat:<category id>    sec:<section id>    item:<Index item id, or archive:<name>>
    seg:<music segment id>    obj:<the container that holds a sound's takes>    clip:<source id>

A note whose thing a game update took away stays in the file: nothing shows it, and it comes back if the id does.
Empty text removes a note.
"""
import json
import os
import re
import threading

from .index import CACHE_DIR

FILE = CACHE_DIR / "notes.json"
KEY = re.compile(r"^(cat|sec|item|seg|obj|clip):\S{1,300}$")
MAX_TEXT = 100_000  # characters in one note

_lock = threading.Lock()


def check(key, text) -> tuple[str, str]:
    """The key and the text as they are kept (the text without trailing blank lines), or ValueError."""
    if not isinstance(key, str) or not KEY.match(key):
        raise ValueError(f"{key!r} isn't something a note can go on")
    if not isinstance(text, str):
        raise ValueError("A note is text")
    if len(text) > MAX_TEXT:
        raise ValueError(f"A note can be up to {MAX_TEXT:,} characters long")
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


def load() -> dict[str, str]:
    """The global notes ({} when there are none, or the file can't be read)."""
    try:
        d = json.loads(FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return tidy(d.get("notes") if isinstance(d, dict) else None)[0]


def set_note(key, text) -> dict[str, str]:
    """Writes (or, with empty text, removes) one global note; returns them all. The file is replaced whole, so a
    write cut short leaves the one before."""
    key, text = check(key, text)
    with _lock:
        notes = load()
        if text:
            notes[key] = text
        elif notes.pop(key, None) is None:
            return notes
        FILE.parent.mkdir(parents=True, exist_ok=True)
        tmp = FILE.with_suffix(".tmp")
        tmp.write_text(json.dumps({"notes": notes}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        os.replace(tmp, FILE)
        return notes
