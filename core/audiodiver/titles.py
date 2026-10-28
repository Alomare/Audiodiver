"""Title case for the names the library shows: "On the Ship", "Stepping Out of the Hellpod", "Hive World".

Every name a person reads as a title goes through `title`: sections, pieces of music, parts, sound sets and the
segments inside them, whether it was written by hand in data/*.json, taken from the community's documents or put
together from the game's own state names. Descriptions and notes are sentences, and stay as they are written.

Title case is English: a translation carries its own capitals. A data name goes through `title` before it is
translated (`i18n.dtr(title(name))`: the key is the name as English shows it), and a name put together from pieces
goes through `shown`, which is `title` in English and leaves a translation as it is written.
"""
import re

from . import i18n

# short joining words stay small inside a name; prepositions of four letters or more are capitalised. "Up" and
# "off" keep their capital: in these names they are part of a verb ("Blow Up", "Drop Off") far more often than not
MINOR = {"a", "an", "the", "and", "but", "or", "nor", "for", "so", "yet", "as", "at", "by", "in", "of", "on", "per",
         "to", "via", "vs"}
BREAKS = ":→(·/[“\"—–"  # the word after one of these starts a name of its own
_WORD = re.compile(r"[^\W\d_][\w'’]*")


def title(text: str) -> str:
    """text in title case. Words that already carry a capital after their first letter, a digit or an underscore
    (FTL, SEAF, AR-23, music_tutorial_old) are left alone, and so are letters written onto a number (380mm, 500kg)
    and anything inside {braces}."""
    if not text:
        return text
    words = [m for m in _WORD.finditer(text) if not _in_braces(text, m.start())]
    out, pos = [], 0
    for n, m in enumerate(words):
        word = m.group()
        before = text[:m.start()].rstrip()
        first = n == 0 or before[-1:] in BREAKS
        after = text[m.end():].lstrip()
        last = n == len(words) - 1 or after[:1] in ":→)·]”"
        if any(c.isupper() for c in word[1:]) or any(c.isdigit() for c in word) or "_" in word \
                or text[max(0, m.start() - 1):m.start()].isdigit():
            new = word
        elif word.lower() in MINOR and not first and not last and text[m.start() - 1].isspace() \
                and text[m.end()] in " ,":  # a word between spaces, not a letter of "W.A.S.P."
            new = word.lower()
        else:
            new = word[0].upper() + word[1:]
        out.append(text[pos:m.start()] + new)
        pos = m.end()
    return "".join(out) + text[pos:]


def _in_braces(text: str, at: int) -> bool:
    return text.rfind("{", 0, at) > text.rfind("}", 0, at)


def shown(text: str) -> str:
    """A name put together from pieces as the language in use shows it: in title case in English (the whole name,
    so a small word between two pieces is small), as written in a translation."""
    return title(text) if i18n.language() == "en" else text


def named(text: str) -> str:
    """A name from the data files in the language in use: its title case English, translated where the data
    catalog has it (i18n.dtr)."""
    return i18n.dtr(title(text))
