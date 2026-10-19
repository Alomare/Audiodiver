"""The game's text: string tables ("strings" resources), one per table and language, all in archive 9ba626afa44a3aa3.

A table is: u32 magic, u32 version (1), u32 count, u32 language (the high half of murmur64 of its code, "us"), the
string ids in ascending order (u32), an offset from the start of the table for each (u32), then the strings, UTF-8
and NUL-terminated. The game's tables share the bytes of equal strings; a table written here doesn't (a little
bigger, read the same). A string's id is the high half of murmur64 of its key. A patch carries whole tables, so a build
writes the live table with the user's edits applied (only to ids it already has: a new id is never asked for).

Subtitles start with their timing, "{0.00->3.85}" (seconds from the start of the voice line), one piece per span;
[square brackets] mark sounds that aren't words. Markup the game reads: <c=AARRGGBB>…</c> a colour (alpha first),
<c=#NAME>…</c> a colour the game fills in, <i=N>…</i> a style, <f=N>…</f> a font; words in capitals after # (#COUNT)
are filled in by the game. <s=NN>…</s> (a size) is used by players in chat, but no line of the game uses it.
One table, 13281693659630462238 in US English, is lip-sync timing, not text, and is left out.
Format found by the HD2 modding community (hd2-audio-modder, filediver) and checked against the installed game.
"""
import re
import struct
from dataclasses import dataclass

from .game import murmur64_hash

STRINGS = murmur64_hash(b"strings")
ARCHIVE = "9ba626afa44a3aa3"
MAGIC = 0x3E85F3AE
LANGUAGES = {"us": "English (US)", "gb": "English (UK)", "fr": "French", "de": "German", "it": "Italian",
             "es": "Spanish (Spain)", "ms": "Spanish (Latin America)", "pt": "Portuguese", "bp": "Portuguese (Brazil)",
             "pl": "Polish", "ru": "Russian", "nl": "Dutch", "jp": "Japanese", "ko": "Korean",
             "cn": "Chinese (Simplified)", "tc": "Chinese (Traditional)"}
CODE_OF = {murmur64_hash(c.encode()) >> 32: c for c in LANGUAGES}
TIMING = re.compile(r"\{(\d+(?:\.\d+)?)->(\d+(?:\.\d+)?)\}")
MARKUP = re.compile(r"</?[cifs](?:=[^>]*)?>")


@dataclass
class Table:
    language: int                 # as the header has it; CODE_OF names it
    texts: dict[int, str]         # string id -> text, in id order

    @property
    def code(self) -> str:
        return CODE_OF.get(self.language, f"{self.language:08x}")


def parse(data: bytes) -> Table:
    magic, version, n, language = struct.unpack_from("<IIII", data)
    if magic != MAGIC or version != 1:
        raise ValueError("not a string table")
    ids = struct.unpack_from(f"<{n}I", data, 16)
    offsets = struct.unpack_from(f"<{n}I", data, 16 + 4 * n)
    return Table(language, {i: data[o:data.index(b"\0", o)].decode("utf-8") for i, o in zip(ids, offsets)})


def serialize(table: Table) -> bytes:
    ids = sorted(table.texts)
    pool, offsets, at = [], [], 16 + 8 * len(ids)
    for i in ids:
        b = table.texts[i].encode("utf-8") + b"\0"
        offsets.append(at)
        pool.append(b)
        at += len(b)
    return struct.pack(f"<IIII{len(ids)}I{len(ids)}I", MAGIC, 1, len(ids), table.language, *ids, *offsets) + b"".join(pool)


def plain(text: str) -> str:
    """The words of a line: no timing, no markup."""
    return " ".join(MARKUP.sub("", TIMING.sub(" ", text)).split())


def kind_of(table: Table) -> str:
    """"subtitles" (lines with their timing), "lipsync" (timing for faces, not text) or "text" (everything else)."""
    sample = [t for t in list(table.texts.values())[:200] if t]
    if sample and sum("\t" in t and t[:1].isdigit() for t in sample) > len(sample) / 2:
        return "lipsync"
    if sample and sum(bool(TIMING.match(t)) for t in sample) > len(sample) / 2:
        return "subtitles"
    return "text"


class Texts:
    """The installed game's string tables, read when first asked for and kept."""

    def __init__(self, game):
        self.game = game
        self._tables: dict[int, Table] = {}
        self._kinds: dict[int, str] = {}

    def ids(self) -> list[int]:
        return sorted(fid for fid, tid, _off, size in self.game.package_toc(ARCHIVE) if tid == STRINGS and size > 16)

    def table(self, fid: int) -> Table:
        if fid not in self._tables:
            self._tables[fid] = parse(self.game.resource(ARCHIVE, fid, STRINGS)[0])
        return self._tables[fid]

    def kind(self, fid: int) -> str:
        if fid not in self._kinds:
            self._kinds[fid] = kind_of(self.table(fid))
        return self._kinds[fid]

    def tables(self, code: str | None = None) -> list[tuple[int, Table]]:
        """(file id, table) of every table in a language (all languages: None), lip-sync left out."""
        out = []
        for fid in self.ids():
            t = self.table(fid)
            if (code is None or t.code == code) and self.kind(fid) != "lipsync":
                out.append((fid, t))
        return out

    def languages(self) -> list[str]:
        return sorted({t.code for _, t in self.tables()}, key=lambda c: list(LANGUAGES).index(c) if c in LANGUAGES else 99)

    def apply(self, fid: int, edits: dict[int, str]) -> tuple[bytes, list[int]]:
        """The table with edits applied, as the patch carries it, and the ids it doesn't have (left out)."""
        t = self.table(fid)
        missing = [i for i in edits if i not in t.texts]
        return serialize(Table(t.language, {**t.texts, **{i: s for i, s in edits.items() if i in t.texts}})), missing
