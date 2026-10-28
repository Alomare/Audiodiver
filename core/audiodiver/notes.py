"""Notes people write in Markdown, by key:

    clip:<source id>    item:<Index item id, or archive:<name>>

A project's (project.py, `notes`, the details panel's Project Note) and global notes (the Global Note), which every
project and the Library see: one file per person, `notes.json` in the folder Settings ▸ System names (the core's
settings folder by default). The details panel writes those two keys. Projects of earlier versions can also hold
notes under these keys, kept and not shown:

    cat:<category id>    sec:<section id>    seg:<music segment id>    obj:<the container that holds a sound's takes>

A note whose thing a game update took away stays in the file: nothing shows it, and it comes back if the id does.
Empty text removes a note.
"""
import json
import re
from pathlib import Path

from .i18n import tr

KEY = re.compile(r"^(cat|sec|item|seg|obj|clip):\S{1,300}$")
MAX_TEXT = 100_000  # characters in one note
FILE = "notes.json"  # the global notes, in their folder
FORMAT = "audiodiver-notes"  # the global notes file, and an export of notes as JSON, which import reads
JOIN = "\n\n---\n\n"  # between two different texts of one thing, when notes come together (merge)


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


def merge(mine: dict[str, str], more: dict[str, str]) -> dict[str, str]:
    """Two sets of notes as one: a thing with a note in only one keeps it; one with two different texts keeps both,
    mine first, unless mine has the other's words already (the same notes brought in twice)."""
    out = dict(mine)
    for k, v in more.items():
        if k not in out or v in out[k]:
            out.setdefault(k, v)
        elif out[k] in v:
            out[k] = v
        else:
            out[k] = out[k] + JOIN + v
    return out


def file_json(notes: dict[str, str]) -> str:
    """The global notes file, or an export of notes as JSON."""
    return json.dumps({"format": FORMAT, "version": 1, "notes": dict(sorted(notes.items()))}, ensure_ascii=False,
                      indent=2) + "\n"


def read_file(path) -> dict[str, str]:
    """The notes in a notes file (file_json's) or in a project file (its `notes`). A file that isn't there has none;
    ValueError for a file that can't be read as either (OSError when it can't be read at all)."""
    path = Path(path)
    if not path.exists():
        return {}
    try:
        d = json.loads(path.read_text(encoding="utf-8"))
    except (ValueError, UnicodeDecodeError):
        raise ValueError("not JSON") from None
    if isinstance(d, dict) and d.get("format") == FORMAT:
        return tidy(d.get("notes"))[0]
    if isinstance(d, dict) and "audiodiver" in d:  # a project
        return tidy(d.get("notes", {}))[0]
    raise ValueError("not a notes file")


def first_line(text: str, n: int = 80) -> str:
    """A note's first line with words, without its Markdown marks, at most n characters (search says why it found
    something by it)."""
    line = next((x for x in text.splitlines() if x.strip()), "")
    line = re.sub(r"^\s*(#+|[-*+]|\d+\.)\s+", "", line)
    line = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", line).replace("**", "").replace("__", "").strip()
    return line if len(line) <= n else line[:n - 1].rstrip() + "…"


def markdown(sections: list[tuple[str, dict[str, str]]], name) -> str:
    """Notes to read, as one Markdown document: a heading for each set (sections: (heading, notes)), then each note
    under the name of its thing (name(key)), in name order."""
    out = []
    for heading, notes in sections:
        out.append(f"# {heading}\n")
        if not notes:
            out.append(tr("No notes.") + "\n")
        for title, text in sorted(((name(k), v) for k, v in notes.items()), key=lambda x: x[0].lower()):
            out.append(f"## {title}\n\n{text}\n")
    return "\n".join(out)
