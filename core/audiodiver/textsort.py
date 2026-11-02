"""Where a line of the game's text belongs, for the Text tab, and the files that carry lines out and back.

Line ids are hashes and a table keeps its lines in hash order, so neighbours say nothing. What sorts them: a subtitle
by the voice that says it (the Library's matches), any other line by its table and then by its shape. A line's id is
the same in every language and in one table only, so US English sorts them all, and a language and an id find a line.
"""
import csv
import io
import json
import re
from pathlib import Path

from . import strings
from .i18n import N_, tr

# the groups of the Index that hold voices (the part of a sound set's id before its own name)
VOICES = {"helldivers/voices": "voices", "allies/civilians": "people", "allies/ship": "ship",
          "allies/command": "command", "allies/training": "training", "interface/cutscenes": "cutscenes"}
# the US English tables: (category, section); no section: the lines go by their shape. A table a game update adds is
# "other" until it is named here.
TABLES = {
    8968223446113782149: ("arsenal", None), 2353201499227948450: ("arsenal", None), 8725882203228335512: ("arsenal", None),
    10746975350888924917: ("menus", None), 2134944833625166792: ("menus", "platoons"),
    9834748718779273902: ("menus", "difficulty"), 13143077619332894668: ("menus", "achievements"),
    1730905535078580201: ("hud", None), 12682703256038597039: ("hud", "fills"),
    15176461585342432614: ("missions", None),
    7282059567125189880: ("war", None), 9649740686103069267: ("war", "orders"),
    14152595578923878385: ("war", "news"), 5584473128896090609: ("war", "elections"),
    7125271031410732524: ("world", None), 12922835453363189548: ("world", "objects"),
}
CATEGORIES = {
    "voices": N_("Helldiver Voices"), "people": N_("SEAF and Civilians"), "ship": N_("Ship"), "command": N_("Command"),
    "training": N_("Training"), "cutscenes": N_("Cutscenes"), "voiced": N_("Other Voices"),
    "unmatched": N_("Subtitles Not Matched"),
    "arsenal": N_("Arsenal"), "menus": N_("Menus and Settings"), "hud": N_("HUD"), "missions": N_("Missions"),
    "war": N_("Galactic War"), "world": N_("Places and Enemies"), "other": N_("Other Text"),
}
SECTIONS = {
    "names": N_("Names"), "designations": N_("Designations"), "sentences": N_("Sentences"), "fills": N_("Filled In by the Game"),
    "unfinished": N_("Unfinished"), "platoons": N_("Platoons"), "difficulty": N_("Difficulty"),
    "achievements": N_("Achievements"), "orders": N_("Orders"), "news": N_("News"), "elections": N_("Elections"),
    "objects": N_("Objects and Biomes"), "subtitles": N_("Subtitles"),
}
DESIGNATION = re.compile(r"^[A-Z]{1,4}-\d+")
UNFINISHED = re.compile(r"\[PLACEHOLDER\]|NOT (YET )?IMPLEMENTED|^temp\b|^\"[A-Za-z ]+Tier\d+\"$", re.I)
FILL = re.compile(r"#[A-Z][A-Z0-9_]+")
# what a replace leaves alone: when words appear, how they look, and what the game fills in
KEPT = re.compile(r"(\{\d+(?:\.\d+)?->\d+(?:\.\d+)?\}|</?[cifs](?:=[^>]*)?>|#[A-Z][A-Z0-9_]+)")


def shape(text: str) -> str:
    """A line that isn't a subtitle, by what it looks like."""
    p = strings.plain(text)
    if UNFINISHED.search(p):
        return "unfinished"
    if FILL.search(p) and len(FILL.sub("", p).split()) <= 2:
        return "fills"
    words, ends = len(p.split()), p.endswith((".", "!", "?"))
    if DESIGNATION.match(p) and words <= 5 and not ends:
        return "designations"
    return "names" if words <= 4 and not ends else "sentences"


def classify(tx: strings.Texts, lib) -> dict[int, tuple[str, str, str | None]]:
    """{line id: (category, section, the sound set that says it)}. A subtitle's section is that sound set; where
    several say it, the first in the Index."""
    said: dict[int, set[str]] = {}
    for oid, (i, _) in lib.subtitles.items():
        for bid in lib.ix.copies(oid):
            said.setdefault(i, set()).add(lib._bank_home(bid))
    for sid, (i, _) in lib.clip_subtitles.items():
        for bid in lib.ix.users.get(sid) or lib.ix.holders.get(sid) or ():
            said.setdefault(i, set()).add(lib._bank_home(bid))
    out = {}
    for fid, t in tx.tables("us"):
        subtitles = tx.kind(fid) == "subtitles"
        cat, sec = TABLES.get(fid, ("other", None))
        for i, text in t.texts.items():
            if not subtitles:
                out[i] = (cat, "unfinished" if UNFINISHED.search(strings.plain(text)) else sec or shape(text), None)
                continue
            homes = [h for h in said.get(i, ()) if h in lib.order]
            home = min(homes, key=lib.order.__getitem__) if homes else None
            if home:
                out[i] = (VOICES.get(home.removeprefix("set:").rpartition("/")[0], "voiced"), home, home)
            else:
                out[i] = ("unmatched", "subtitles", None)
    return out


def tree(lines: list[dict], lib) -> list[dict]:
    """The categories and sections these lines fall in, named in the window's language, in the order of CATEGORIES
    and SECTIONS (voices in the order of the Index): [{id, name, sections: [{id, name}]}]."""
    found: dict[str, set[str]] = {}
    for x in lines:
        found.setdefault(x["cat"], set()).add(x["sec"])
    order = list(SECTIONS)

    def rank(sec):
        return (0, lib.order.get(sec, 0), "") if sec not in SECTIONS else (1, order.index(sec), "")
    return [{"id": c, "name": tr(name), "sections": [{"id": s, "name": section_name(s, lib)} for s in sorted(found[c], key=rank)]}
            for c, name in CATEGORIES.items() if c in found]


def section_name(sec: str, lib) -> str:
    return tr(SECTIONS[sec]) if sec in SECTIONS else lib.items[sec]["name"]


def replaced(text: str, find: str, new: str, case: bool = False, whole: bool = False) -> str:
    """The line with these words changed, leaving timing, markup and what the game fills in as they are. It matches
    parts of words too, unless `whole`: no letter or digit right before or after."""
    what = re.compile(rf"(?<!\w){re.escape(find)}(?!\w)" if whole else re.escape(find), 0 if case else re.I)
    parts = KEPT.split(text)
    parts[::2] = [what.sub(lambda _: new, p) for p in parts[::2]]
    return "".join(parts)


def lost(before: str, after: str) -> list[str]:
    """What the game needs that a new text no longer has: words it fills in, and timing marks."""
    fills = [f for f in dict.fromkeys(FILL.findall(before)) if f not in after]
    return fills + (["{0.00->0.00}"] if strings.TIMING.search(before) and not strings.TIMING.search(after) else [])


COLUMNS = ["Language", "ID", "Table", "Category", "Speaker", "Original", "New text"]


def write_rows(path: Path, rows: list[dict], reference: str | None):
    """The rows as a file a spreadsheet opens (.csv, UTF-8 with a BOM, which Excel needs to read it as UTF-8) or as
    .json. The reference language is a column of its own, which an import doesn't read."""
    columns = COLUMNS + ([f"Reference ({reference})"] if reference else [])
    table = [{c: r.get("Reference" if c.startswith("Reference") else c, "") for c in columns} for r in rows]
    if path.suffix.lower() == ".json":
        path.write_text(json.dumps({"lines": table}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        return
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, columns)
        w.writeheader()
        w.writerows(table)


def read_rows(path: Path) -> list[dict]:
    """The rows of a file write_rows made, after any spreadsheet has saved it: comma, semicolon or tab between the
    columns. ValueError: not such a file. UnicodeError: not UTF-8 (or UTF-16), as Excel's plain "CSV" saves it, in the
    PC's own code page, with a ? for every letter that code page lacks: reading it would bring those ? in."""
    raw = path.read_bytes()
    text = raw.decode("utf-16") if raw[:2] in (b"\xff\xfe", b"\xfe\xff") else raw.decode("utf-8-sig")
    if path.suffix.lower() == ".json":
        rows = json.loads(text)
        rows = rows.get("lines") if isinstance(rows, dict) else rows
        if not isinstance(rows, list) or not all(isinstance(r, dict) for r in rows):
            raise ValueError("no lines")
    else:
        head = text.split("\n", 1)[0]
        # as a file opened with newline="": only the CSV's own line ends end a row, not every break splitlines knows
        rows = list(csv.DictReader(io.StringIO(text, newline=""), delimiter=max(",;\t", key=head.count)))
        # a break inside a cell as Windows writes it (Notepad, a CRLF file): the game's text has \n alone
        rows = [{k: v.replace("\r\n", "\n") if isinstance(v, str) else v for k, v in r.items()} for r in rows]
    if rows and not {"Language", "ID", "New text"} <= set(rows[0]):
        raise ValueError("no columns")
    return rows
