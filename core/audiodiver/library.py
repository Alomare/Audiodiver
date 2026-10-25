"""The library: every sound the game has, as the Library tab shows it.

Two views of the same audio:

  The Index is what is known: the music by where a player hears it (musiclist.py), and the sound sets the community
  has named (data/sounds.json: weapons, stratagems, enemies, voices, environments...). A sound set is one or more
  banks; its parts are those banks.

  All Archives is everything there is: each archive of the game that has audio in it, with the banks it holds. An
  archive nobody has named yet is listed all the same, so new audio can be found, heard and replaced before anyone
  documents it. What the Index does know shows as tags (the category, in its colour) on the archive, and as the
  set or the piece of music on the banks and segments inside it.

Both lead to the same things to open: a piece of music's cue (catalog.py), or a bank's sounds (`bank:<id>`), which
come as a cue-shaped dict so the editor shows either the same way. A bank's sounds are grouped the way the bank
nests them: the takes of one sound (the children of one random container) sit together. A voice line is labelled
with what it says: its subtitle where it was matched to one (data/subtitles.json, which also says which subtitle, so
the Text tab can open it), else what the community wrote down (data/voices.json). A clip without words is named by
what it is ("Grunt 3", numbered per bank); a voice bank lists those it holds for other banks' Sounds by kind
("Grunts", "Laughs"). In the Audio tab a bank's sounds
come with the audio the project adds (Added, addition.py): its new takes after the game's (`added: "take"`), a layer
as a group after the sound it plays with (`added: "layer"`), a clip of its own in place of the clip it stood in for
(`was`). A group whose takes a random container picks says which (`container`), and whether a layer can go beside it.

A project lists the Index items and archives it works on (project.py, "library"); `home` finds the one a sound
belongs to, for a project that has replacements but no list yet.
"""
import collections
import json
import re
import struct
import threading
from dataclasses import dataclass
from functools import cached_property
from importlib import resources

from . import bank as wbank
from . import music, wem
from .addition import ACTION, LAYER, RANSEQ, SWITCH, play_target
from .cuemap import slots
from .game import murmur64_hash
from .index import LANGUAGES
from .titles import title

PREFIX = "content/audio/"
CONTAINERS = (0x05, 0x06, 0x07, 0x09)  # random/sequence, switch, actor-mixer, layer: what a Sound can sit in
MUSIC = {"id": "music", "name": "Music", "hue": 300,
         "about": "Music by where it plays, from the ship to the credits."}
BIG_GROUP, CHUNK = 150, 100  # a group with more sounds than this is listed in runs of CHUNK
ALSO_LISTED = 8              # how many of the other places a sound plays in a slot names; the rest are counted
WIDELY = 10                  # a sound in this many other banks or more is one a whole family of banks shares
VIEWS_KEPT = 12
KIND_GROUP = {"Grunt": "Grunts", "Sigh": "Sighs", "Laugh": "Laughs", "Scream": "Screams", "Cough": "Coughs",
              "Groan": "Groans", "Yell": "Yells", "Sniff": "Sniffs", "Hiccup": "Hiccups", "Burp": "Burps",
              "Whistle": "Whistles", "Hum": "Humming", "Vocal sound": "Vocal Sounds"}  # a clip without words: its group


def _data(name):
    return json.loads(resources.files("audiodiver").joinpath("data", name).read_text(encoding="utf-8"))


def slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def _line(text: str) -> str:
    """A transcribed voice line, starting with a capital: the community writes them either way."""
    return text[:1].upper() + text[1:]


@dataclass(frozen=True)
class Added:
    """The audio a project adds (project.additions), as the banks' views show it: new takes after the game's, a
    layer as a group after the sound it plays with, a clip of its own in place of the clip it stands in for."""
    takes: tuple = ()   # ((container, new Sound, new clip), ...)
    layers: tuple = ()  # ((layer id, the game's container it plays with), ...)
    own: tuple = ()     # ((the game's Sound, its new clip), ...)


def _part(cue: str, name: str, count: int) -> dict:
    """A part of a sound set or an archive: one bank (or an archive's loose streams), shaped like a part of a piece
    of music. `count` is how many sounds it has."""
    return {"cue": cue, "name": name, "kind": "bank", "targets": [], "own": [], "links": [], "duration_ms": 0,
            "note": "", "count": count}


class Library:
    def __init__(self, catalog):
        self.cat, self.cm, self.ix = catalog, catalog.cm, catalog.cm.ix
        voices, subs = _data("voices.json"), _data("subtitles.json")
        self.said = {int(k): v for k, v in subs["texts"].items()}  # subtitle id -> its English words
        # a voice line's subtitle (id, certain), by its English Sound (other languages: _english) or its English clip
        self.subtitles = {int(k): (v[0], bool(v[1])) for k, v in subs["lines"].items()}
        self.clip_subtitles = {int(k): (v[0], bool(v[1])) for k, v in subs["clips"].items()}
        self.wordless = subs["sounds"]  # "o<Sound>" or "s<source>" -> what a clip without words is ("Grunt")
        self.voices = {int(k): _line(v) for k, v in voices["lines"].items()}
        self.voices.update((oid, self.said[i]) for oid, (i, _) in self.subtitles.items())  # the game's own words first
        self.calls = {int(k): _line(v) for k, v in voices.get("calls", {}).items()}  # untranscribed: a sibling's words
        self.bank_names = {}  # bank id -> the last part of its path name ("wep_autocannon")
        for tail in _data("banks.json")["names"]:
            for path in (PREFIX + tail, *(f"{PREFIX}{code}/{tail}" for code in LANGUAGES)):
                bid = murmur64_hash(path.encode())
                if bid in self.ix.banks:
                    self.bank_names[bid] = tail
        for bid, b in self.ix.banks.items():  # the rest: as the game spells them (index.py)
            if bid not in self.bank_names and b.get("path"):
                self.bank_names[bid] = b["path"].rsplit("/", 1)[-1]
        installed = {b.get("lang") for b in self.ix.banks.values()}
        self.voice_languages = [name for code, name in LANGUAGES.items() if code in installed]  # in this install
        self._views, self._lock = collections.OrderedDict(), threading.Lock()
        self.items = {}                                # item id -> item, for everything in the Index
        self.order = {}                                # item id -> its place in the Index, top to bottom
        self.bank_sets = collections.defaultdict(list)  # bank id -> the sound sets it is a part of
        self.sound_items = {}                          # a plain sound a piece of music lists -> that piece
        self.where = {}                                # item id -> (category name, section name)
        self.renamed = {}                              # the id a set had under an older name ("was") -> its id now
        self.categories = self._index()
        self.music_in_archive = collections.defaultdict(list)  # archive -> the music sections with cues in it
        for cid, cue in self.cm.cues.items():
            at = self.cat.music.cue_item.get(cid)
            if at:
                for a in cue["archives"]:
                    if at[0].section not in self.music_in_archive[a]:
                        self.music_in_archive[a].append(at[0].section)

    # --- banks
    def sources(self, bid: int) -> list[int]:
        """Every sound a bank plays or holds, without repeats."""
        b = self.ix.banks[bid]
        return list(dict.fromkeys([*b["refs"], *b["media"]]))

    def _has_audio(self, bid) -> bool:
        b = self.ix.banks.get(bid)
        return bool(b and (b["refs"] or b["media"]))

    def _shared(self, archives: list[str]) -> list[int]:
        """The banks the archives the community lists for a thing have in common: those in every one of them this
        game has, else those in at least half."""
        here = [a for a in archives if a in self.ix.by_archive]
        count = collections.Counter(b for a in here for b in self.ix.by_archive[a] if self._has_audio(b))
        common = [b for b, n in count.items() if n == len(here)] or [b for b, n in count.items() if n * 2 >= len(here)]
        return sorted(common, key=lambda b: (-len(self.ix.banks[b]["refs"]), b))

    def bank_label(self, bid: int) -> str:
        """A bank's name for people: the sound set it is (with its language, for a voice), else its path name, else
        its number."""
        sets = self.bank_sets.get(bid, [])
        lang = LANGUAGES.get(self.ix.banks[bid].get("lang") or "", "")
        if len(sets) == 1:
            return self.items[sets[0]]["full"] + (f" · {lang}" if lang else "")
        if bid in self.bank_names:
            return title(self.bank_names[bid].replace("_", " ")) + (f" · {lang}" if lang else "")
        return f"Bank {bid}"

    # --- the Index
    def _set_parts(self, e: dict) -> list[tuple[str, int]]:
        """[(part name, bank id)] of a sound set: its banks that this game version has. A bank goes by its path name
        ("banks") or, where nobody knows that, by its file id ("ids"); a voice has one bank per language."""
        ids = [murmur64_hash(p.encode()) for p in e.get("banks", [])] + [int(i) for i in e.get("ids", [])]
        out = [("", bid) for bid in ids if self._has_audio(bid)]
        if "voice" in e:
            for code, language in LANGUAGES.items():
                bid = murmur64_hash(f"{PREFIX}{code}/{e['voice']}".encode())
                if self._has_audio(bid):
                    out.append((language, bid))
        # the one voice without a known name: in each language, the voice bank of its archives that has no name
        for code, archives in e.get("archives_by_language", {}).items():
            out += [(LANGUAGES.get(code, code), b) for b in self._shared(archives)
                    if self.ix.banks[b].get("lang") == code and b not in self.bank_names]
        if len(out) > 1:  # several banks: tell them apart
            named = []
            for n, (name, bid) in enumerate(out, 1):
                named.append((name or (title(self.bank_names[bid].replace("_", " ")) if bid in self.bank_names
                                       else f"Bank {n}"), bid))
            out = named
        return out

    def _index(self) -> list[dict]:
        cats = []
        sections = self.cat.music.to_json()["sections"]
        for s in sections:
            for it in s["items"]:
                it.update(category="music", count=len(it["targets"]))
                self.items[it["id"]] = it
                self.where[it["id"]] = (MUSIC["name"], s["name"])
                for p in it["parts"]:
                    if p["cue"].startswith("sfx:"):
                        self.sound_items.setdefault(int(p["cue"][4:]), it["id"])
        cats.append({**MUSIC, "sections": sections})
        for cat in _data("sounds.json")["categories"]:
            out = {"id": cat["id"], "name": title(cat["name"]), "hue": cat["hue"], "about": cat.get("about", ""),
                   "sections": []}
            for sec in cat["sections"]:
                items = []
                for e in sec["entries"]:
                    parts = self._set_parts(e)
                    if not parts:
                        continue  # nothing of it in this game version (another language, or gone)
                    iid = base = f"set:{sec['id']}/{slug(e['name'])}"
                    n = 2
                    while iid in self.items:
                        iid, n = f"{base}-{n}", n + 1
                    counts = [len(self.sources(bid)) for _, bid in parts]
                    first = self.sources(parts[0][1])
                    it = {
                        "id": iid, "name": title(e["name"]), "full": title(e["name"]), "about": e.get("about", ""),
                        "kind": "sounds", "role": "", "category": cat["id"],
                        "parts": [_part(f"bank:{bid}", name, c) for (name, bid), c in zip(parts, counts)],
                        "targets": [], "duration_ms": 0, "preview": str(first[0]) if first else "", "around": [],
                        "shares": [], "count": sum(counts),
                    }
                    self.items[iid] = it
                    self.where[iid] = (out["name"], title(sec["name"]))
                    # a project that listed it by an older name finds it: a "was" is a name in this section, or the
                    # whole id it had elsewhere ("set:weapons/seaf-liberator"); and a category that was one section
                    # once (Weapons) has its sets' ids of that time
                    for old in e.get("was", []):
                        self.renamed.setdefault(old if old.startswith("set:") else f"set:{sec['id']}/{slug(old)}", iid)
                    if sec["id"] != cat["id"] and sec["id"].startswith(f"{cat['id']}/"):
                        for old in [e["name"], *(w for w in e.get("was", []) if not w.startswith("set:"))]:
                            self.renamed.setdefault(f"set:{cat['id']}/{slug(old)}", iid)
                    items.append(it)
                    for _, bid in parts:
                        self.bank_sets[bid].append(iid)
                if items:
                    out["sections"].append({"id": sec["id"], "name": title(sec["name"]), "about": sec.get("about", ""),
                                            "unused": False, "items": items})
            if out["sections"]:
                cats.append(out)
        self.order = {it["id"]: n for n, it in enumerate(i for c in cats for s in c["sections"] for i in s["items"])}
        return cats

    def index(self) -> dict:
        return {"categories": self.categories}

    def _tag(self, iid: str) -> dict:
        it = self.items[iid]
        return {"name": it["full"], "category": it["category"], "item": iid}

    # --- all archives
    def _archive_facts(self, a: str) -> tuple[list[str], list[dict]]:
        """(names, tags) of an archive: the sound sets its banks are and the music it has, and a tag for every
        category of the Index it has something of."""
        names, found = [], set()
        for bid in self.ix.by_archive.get(a, []):
            lang = LANGUAGES.get(self.ix.banks[bid].get("lang") or "", "")
            for iid in self.bank_sets.get(bid, []):
                name = self.items[iid]["full"] + (f" · {lang}" if lang else "")
                if name not in names:
                    names.append(name)
                found.add(self.items[iid]["category"])
        here = set(self.music_in_archive.get(a, []))
        if here:  # by its sections, in the Index's order: "Music: On the Ship, Before the Drop and 4 More"
            secs = [s["name"] for s in self.categories[0]["sections"] if s["id"] in here]
            names.append("Music: " + ", ".join(secs[:2]) + (f" and {len(secs) - 2} More" if len(secs) > 2 else ""))
            found.add("music")
        return names, [{"name": c["name"], "category": c["id"]} for c in self.categories if c["id"] in found]

    @cached_property
    def archives(self) -> list[dict]:
        """Every archive with audio in it. The ones something is known about come first, in the Index's order."""
        ix, out = self.ix, []
        order = {c["id"]: n for n, c in enumerate(self.categories)}
        lost = collections.Counter(a for o in ix.orphans for a in ix.streams[o])  # streams no bank plays, per archive
        for a in sorted(set(ix.by_archive) | set(lost)):
            banks = [b for b in ix.by_archive.get(a, []) if self._has_audio(b)]
            if not banks and not lost[a]:
                continue  # banks without audio (events, settings): nothing to hear or replace
            names, tags = self._archive_facts(a)
            langs = {ix.banks[b].get("lang") or "" for b in banks}
            first = next((s for b in banks for s in self.sources(b)), None)  # something to hear without opening it
            out.append({"id": a, "names": names, "tags": tags, "banks": len(banks),
                        "sounds": len({s for b in banks for s in self.sources(b)}) + lost[a],
                        "language": LANGUAGES.get(next(iter(langs)), "") if len(langs) == 1 else "",
                        "preview": str(first if first is not None else next(o for o in ix.orphans if a in ix.streams[o]))})
        rank = lambda r: (0, min(order[t["category"]] for t in r["tags"]), r["names"][0].lower(), r["id"]) \
            if r["tags"] else (1, 0, "", r["id"])
        return sorted(out, key=rank)

    def archive_item(self, a: str) -> dict:
        """An archive as something to open: its banks are its parts."""
        ix = self.ix
        banks = [b for b in ix.by_archive.get(a, []) if self._has_audio(b)]
        lost = sorted(o for o in ix.orphans if a in ix.streams[o])
        if not banks and not lost:
            raise KeyError(f"no archive {a} with audio in this game version")
        names, tags = self._archive_facts(a)
        parts = [_part(f"bank:{bid}", self.bank_label(bid), len(self.sources(bid))) for bid in banks]
        if lost:
            parts.append(_part(f"streams:{a}", "Streams No Bank Plays", len(lost)))
        first = next((self.sources(b) for b in banks if self.sources(b)), lost)
        about = (f"Holds {', '.join(names[:6])}{' and more' if len(names) > 6 else ''}." if names
                 else "Not named yet.")
        return {"id": f"archive:{a}", "name": names[0] if len(names) == 1 else f"Archive {a}",
                "full": names[0] if len(names) == 1 else f"Archive {a}", "about": about, "kind": "archive", "role": "",
                "category": tags[0]["category"] if tags else "", "parts": parts, "targets": [], "duration_ms": 0,
                "preview": str(first[0]) if first else "", "around": [], "shares": [],
                "count": sum(p["count"] for p in parts), "archive": a, "tags": tags, "names": names}

    def item(self, iid: str) -> dict:
        """An Index item or an archive, by the id a project lists it under. KeyError when this game version has no
        such thing."""
        if iid.startswith("archive:"):
            return self.archive_item(iid[8:])
        return self.items[iid]

    def cue_sources(self, cue_id: str) -> list[int]:
        """The sounds of one part: a music cue's slots, a bank's sounds, an archive's loose streams or a plain
        sound."""
        kind, _, key = cue_id.partition(":")
        if kind == "bank":
            return self.sources(int(key))
        if kind == "streams":
            return sorted(o for o in self.ix.orphans if key in self.ix.streams[o])
        if kind == "sfx":
            return [int(key)]
        return slots(self.cm.cues[int(cue_id)])

    def item_sources(self, iid: str) -> set[int]:
        """Every sound of an item, over all its parts."""
        return {s for p in self.item(iid)["parts"] for s in self.cue_sources(p["cue"])}

    def banks(self, ids) -> set[int]:
        """The banks of the items with these ids (a project's list): a sound set's or an archive's own banks, and
        every bank that has a piece of music's sounds or a single sound. An id this game version has nothing for
        adds none."""
        out = set()
        for iid in ids:
            try:
                parts = self.item(self.renamed.get(iid, iid))["parts"]
            except KeyError:
                continue
            for p in parts:
                kind, _, key = p["cue"].partition(":")
                if kind == "bank":
                    out.add(int(key))
                elif kind != "streams":
                    for s in self.cue_sources(p["cue"]):
                        out |= self.ix.banks_for(s)
        return out

    # --- a bank's sounds, as something to open
    def view(self, cue_id: str, added: "Added | None" = None) -> dict:
        """The cue-shaped view of `bank:<id>` or `streams:<archive>`, a bank's with the audio a project adds to it.
        KeyError when there is no such thing."""
        kind, _, key = cue_id.partition(":")
        at = (cue_id, added if kind == "bank" and added else None)
        with self._lock:
            if at in self._views:
                self._views.move_to_end(at)
                return self._views[at]
        try:
            v = (self._bank(int(key), at[1]) if kind == "bank" else self._streams(key) if kind == "streams"
                 else self._sound(int(key)) if kind == "sfx" else None)
        except (ValueError, KeyError):
            v = None
        if v is None:
            raise KeyError(f"nothing to open as {cue_id}")
        with self._lock:
            self._views[at] = v
            while len(self._views) > VIEWS_KEPT:
                self._views.popitem(last=False)
        return v

    def _slot(self, sid: int, ms=None, label="", here: int | None = None) -> dict:
        """A sound as a slot. `also_in` names the first few other places that play it (music cues, then the banks
        the Index knows, then the rest) and `also_n` counts them all: a weapon's handling sounds are in a hundred
        banks. `banks` counts the other banks alone. `absent`: the game's data names the sound, but no bank or
        stream of this install has its audio (about 2,600 of them, in the banks of sound sets), so it can't play."""
        ix = self.ix
        if ms is None and (sid in ix.stream_of or sid in ix.orphans):
            head = ix.stream_data(sid, 96)
            ms = wem.length_ms(head) if head else None
        banks = sorted((b for b in ix.users.get(sid, ()) if b != here), key=lambda b: (not self.bank_sets.get(b), b))
        also = [str(c) for c in self.cm.by_source.get(sid, [])] + [f"bank:{b}" for b in banks]
        absent = sid not in ix.stream_of and not ix.holders.get(sid) and sid not in ix.orphans
        return {"source": str(sid), "duration_ms": round(ms, 1) if ms else 0, "unused": False, "absent": absent, "variant": "",
                "label": label, "locked": False, "also_in": also[:ALSO_LISTED], "also_n": len(also),
                "banks": len(banks), **self.cat.clip_notes(sid)}

    def _voice(self, slot: dict, oid: int | None, sid: int) -> dict:
        """A voice line's subtitle on its slot (`subtitle`, `subtitle_sure`: false where it is one of several with
        the same words), its words as the label where it has none; or, for a clip without words, what it is
        (`sound`, its label until the bank numbers it)."""
        sub = (oid is not None and self.subtitles.get(oid)) or self.clip_subtitles.get(sid)
        if sub:
            slot.update(subtitle=str(sub[0]), subtitle_sure=sub[1])
            slot["label"] = slot["label"] or self.said[sub[0]]
        elif kind := (oid is not None and self.wordless.get(f"o{oid}")) or self.wordless.get(f"s{sid}"):
            slot.update(sound=kind, label=slot["label"] or kind)
        return slot

    def _reach(self, banks, here) -> dict:
        """A slot's `also_in`, `also_n` and `banks` for something that plays in these banks."""
        others = sorted((b for b in banks if b != here), key=lambda b: (not self.bank_sets.get(b), b))
        also = [f"bank:{b}" for b in others]
        return {"also_in": also[:ALSO_LISTED], "also_n": len(also), "banks": len(others)}

    def _added_slot(self, sid, oid, banks, here) -> dict:
        """A new take as a slot: it has no original."""
        return {"source": str(sid), "duration_ms": 0, "unused": False, "absent": False, "variant": "", "label": "",
                "locked": False, "object": str(oid), "added": "take", **self._reach(banks, here)}

    @staticmethod
    def _group(name, slots_, **more) -> dict:
        """Sounds that belong together, shaped like a music segment with one stem. `shared` is how many other banks
        play every one of them (0 for sounds this bank has to itself)."""
        return {"segment": "", "name": name, "depth": 0, "loop": 1, "duration_ms": 0, "entry_ms": None, "exit_ms": None,
                "stems": [{"track": "", "type": "sound", "switch_group": "", "slots": slots_}], "tags": [], "group": True,
                "shared": min((s["banks"] for s in slots_), default=0), **more}

    def _languages(self, bid: int) -> list[int]:
        """The same voice's bank in every installed language (the bank alone for one that isn't a voice)."""
        tail, lang = self.bank_names.get(bid), self.ix.banks[bid].get("lang")
        if not tail or not lang:
            return [bid]
        return [b for code in LANGUAGES if (b := murmur64_hash(f"{PREFIX}{code}/{tail}".encode())) in self.ix.banks]

    def _english(self, bid: int) -> dict[int, int]:
        """{Sound id: the Sound at the same place in the English bank} for a voice bank in another language, where
        the ids differ. Voices' words, subtitles and names (voices.json, subtitles.json) go by the English Sounds.
        A voice's banks are built alike in every language, the n-th Sound of each saying the same line, but an update
        can renumber one language's Sounds and not the others' (build 25988413 renumbered English alone, and gave
        three ship voices' English banks three more lines at the end). {} for English, a bank that isn't a voice, or
        one whose Sounds don't pair up with the English ones (their parents don't match one to one)."""
        if not hasattr(self, "_en"):
            self._en = {}
        if bid not in self._en:
            self._en[bid] = {}
            us = next((b for b in self._languages(bid) if self.ix.banks[b].get("lang") == "us"), None)
            if us is not None and us != bid:
                def sounds(b):
                    out = []
                    for t, oid, body in music.iter_hirc(wbank.hirc(self.ix.bank_files(b)[0])):
                        if t == wbank.SOUND:
                            try:
                                out.append((oid, music.read_node_base_params(music.Reader(body, 18))[1]))
                            except Exception:
                                out.append((oid, 0))
                    return out
                mine, theirs = sounds(bid), sounds(us)
                pairs = {}
                if not any(pairs.setdefault(p, q) != q for (_, p), (_, q) in zip(mine, theirs)):
                    self._en[bid] = {o: e for (o, _), (e, _) in zip(mine, theirs) if o != e}
        return self._en[bid]

    def _bank(self, bid: int, added: "Added | None" = None) -> dict:
        ix = self.ix
        info = ix.banks[bid]
        didx, data, hirc = [], b"", bytes(4)  # a bank that only stores audio has no objects at all
        for tag, body in wbank.chunks(ix.bank_files(bid)[0]):
            if tag == b"DIDX":
                didx = [struct.unpack_from("<III", body, i) for i in range(0, len(body), 12)]
            elif tag == b"DATA":
                data = body
            elif tag == b"HIRC":
                hirc = body
        held = {sid: wem.length_ms(data[off:off + min(n, 96)]) for sid, off, n in didx}  # source -> ms, of what is in here
        sounds, parent, segments, kinds, plays = [], {}, [], {}, set()
        for t, oid, body in music.iter_hirc(hirc):
            if t == wbank.SOUND:
                plugin, _stype, sid, _cache, _mem, _bits = wbank.SOURCE.unpack_from(body, 0)
                if plugin & 0xF != 1:
                    continue  # a generator (silence, a tone): no audio to replace
                try:
                    parent[oid] = music.read_node_base_params(music.Reader(body, 18))[1]
                except Exception:
                    parent[oid] = 0
                sounds.append((oid, sid))
            elif t in CONTAINERS:
                kinds[oid] = t
                try:
                    parent[oid] = music.read_node_base_params(music.Reader(body, 0))[1]
                except Exception:
                    pass
            elif t == music.MUSIC_SEGMENT:
                segments.append(oid)
            elif t == ACTION and (target := play_target(body)) is not None:
                plays.add(target)

        # the project's added audio: clips of their own, layers, new takes (each new take after the game's)
        was, layer_of, new_takes = {}, {}, set()  # new clip -> the clip it stands in for; layer -> beside; new Sounds
        if added:
            own = dict(added.own)
            was = {own[oid]: sid for oid, sid in sounds if oid in own}
            sounds = [(oid, own.get(oid, sid)) for oid, sid in sounds]
            for lay, beside in added.layers:
                if beside in kinds:
                    layer_of[lay], kinds[lay], parent[lay] = beside, RANSEQ, parent.get(beside, 0)
            for container, snd, src in added.takes:
                if kinds.get(container) == RANSEQ:
                    sounds.append((snd, src))
                    parent[snd] = container
                    new_takes.add(snd)

        groups, listed = [], set()
        # 1. music segments, as the cue map has them (named and timed), each tagged with the piece of music it is
        cues = {}  # cue id -> (its detail, {segment id: the segment as the catalog names it}), None without slots
        for seg in segments:
            cid = next(iter(self.cm.by_segment.get(seg, [])), None)
            if cid is None:
                continue
            if cid not in cues:
                try:
                    detail = self.cat.cue(cid)
                    cues[cid] = (detail, {s["segment"]: s for s in detail["segments_detail"]})
                except KeyError:  # a cue with nothing to replace in it
                    cues[cid] = None
            if not cues[cid] or str(seg) not in cues[cid][1]:
                continue
            cue, g = cues[cid][0], dict(cues[cid][1][str(seg)])
            if g["name"].startswith("Segment "):
                g["name"] = f"{cue['name']} · {g['name']}"
            at = self.cat.music.cue_item.get(cid)
            g.update(tags=[self._tag(at[0].id)] if at else [], cue=str(cid), shared=0)
            # in the Index's order, a cue's segments together and in play order
            groups.append(((self.order.get(at[0].id, len(self.order)) if at else len(self.order) + 1, cid,
                            list(cues[cid][1]).index(str(seg))), g))
            listed.update(int(sl["source"]) for st in g["stems"] for sl in st["slots"])
        groups = [g for _, g in sorted(groups, key=lambda x: x[0])]

        # 2. sounds, by the container that holds the takes of one sound: the nearest one above with more than one.
        # A layer's takes are a group of their own, right after the sound it plays with.
        leaves = collections.Counter()
        for oid, _sid in sounds:
            cur, seen = parent.get(oid), set()
            while cur in parent and cur not in seen and cur not in layer_of:
                seen.add(cur)
                leaves[cur] += 1
                cur = parent[cur]
        by_key, order, home = collections.defaultdict(list), [], {}  # home: a container -> the group of its takes
        for oid, sid in sounds:
            if sid in listed:
                continue  # in the music above, or played by a Sound that came before: one thing to replace
            listed.add(sid)
            key, seen = parent.get(oid, 0), set()
            while key not in layer_of and key in parent and leaves[key] < 2 and key not in seen:
                seen.add(key)
                key = parent[key]
            home.setdefault(parent.get(oid, 0), key)
            if key not in by_key:
                order.append(key)
            by_key[key].append((oid, sid))

        en = self._english(bid)  # another language's voice: its Sounds as the English bank's, which the words go by

        def row(oid, sid):
            if oid in new_takes:  # a new take plays wherever its container is
                return self._added_slot(sid, oid, self.ix.copies(layer_of.get(parent[oid], parent[oid])), bid)
            line = en.get(oid, oid)
            slot = self._voice(self._slot(was.get(sid, sid), held.get(was.get(sid, sid)), self.voices.get(line, ""), bid),
                               line, was.get(sid, sid))
            if sid in was:  # a clip of its own: the Sound plays it wherever the Sound is
                slot.update(self._reach(self.ix.copies(oid), bid), source=str(sid), was=str(was[sid]), object=str(oid))
            return slot
        made = [([row(oid, sid) for oid, sid in by_key[key]],
                 collections.Counter(self.calls[en.get(oid, oid)] for oid, _ in by_key[key] if en.get(oid, oid) in self.calls),
                 key)
                for key in order]
        # what this bank has to itself (or shares with a variant or two) comes first; the sounds a whole family of
        # banks has copies of (every weapon's handling sounds) go last. Within each, the bank's own order.
        made.sort(key=lambda m: min(r["banks"] for r in m[0]) >= WIDELY)
        for m in [m for m in made if m[2] in layer_of]:  # a layer after the sound it plays with, and its other layers
            made.remove(m)
            beside = home.get(layer_of[m[2]])
            at = next((i + 1 for i, x in enumerate(made) if x[2] == beside), len(made))
            while at < len(made) and made[at][2] in layer_of:
                at += 1
            made.insert(at, m)

        def can_layer(key):
            """A layer beside it would play when it plays: its parent is a switch or a layer container, or an event
            plays it (and it isn't one choice of a random container)."""
            ptype = kinds.get(parent.get(key))
            return ptype in (SWITCH, LAYER) or (key in plays and ptype != RANSEQ)

        # a sound nothing says, named by the notes on its takes (data/notes.json: "Ready"), numbered when several are
        noted = [collections.Counter(l for r in rows if (l := self.cat.clip(int(r.get("was") or r["source"])).get("label")))
                 for rows, _, _ in made]
        noted_n, noted_seen = collections.Counter(c.most_common(1)[0][0] for c in noted if c), collections.Counter()
        n, borrowed, named, layers = 0, False, {}, []
        for (rows, called, key), notes in zip(made, noted):
            if len(rows) > BIG_GROUP:
                for at in range(0, len(rows), CHUNK):
                    groups.append(self._group(f"Sounds {at + 1}–{min(len(rows), at + CHUNK)}", rows[at:at + CHUNK]))
                continue
            said = collections.Counter(r["label"] for r in rows if r["label"] and r["label"] != r.get("sound"))
            wordless = collections.Counter(r.get("sound") for r in rows)
            for k, r in enumerate(rows, 1):  # the takes of one sound, told apart by number where nothing says more
                r["label"] = r["label"] or (f"Take {k}" if len(rows) > 1 else "")
            if key in layer_of:
                layers.append((self._group("", rows, added="layer", container=str(key), key=str(key), beside=str(layer_of[key]),
                                           copies=len(self.ix.copies(layer_of[key])) - 1), key))
                groups.append(layers[-1][0])
                continue
            n += 1
            borrowed |= not said and bool(called)  # the call is named, the takes keep their numbers
            said = said or called
            name = f"Sound {n}"
            if said:
                name = f"“{said.most_common(1)[0][0]}”"
            elif None not in wordless:  # takes without words: what they are
                name = KIND_GROUP.get(k := wordless.most_common(1)[0][0], k)
            elif notes:
                name = notes.most_common(1)[0][0]
                if noted_n[name] > 1:
                    noted_seen[name] += 1
                    name += f" {noted_seen[name]}"
            named[key] = name
            more = ({"container": str(key), "layer": can_layer(key), "copies": len(self.ix.copies(key)) - 1}
                    if kinds.get(key) == RANSEQ else {})
            groups.append(self._group(name, rows, **more, **({"key": str(key)} if key else {})))
        per_sound = collections.Counter(home.get(layer_of[k]) for _, k in layers)
        seen_layers = collections.Counter()
        for g, key in layers:  # "Sound 3 · Layer", or numbered when it has several
            beside = home.get(layer_of[key])
            seen_layers[beside] += 1
            g["name"] = f"{named.get(beside, 'Sound')} · Layer" + (f" {seen_layers[beside]}" if per_sound[beside] > 1 else "")
        # 3. what is left: audio this bank holds or names that none of its Sounds plays (a Sound in another bank
        # does, or nothing seen does), then what it names that has no audio in this install at all
        # (a voice bank holds the grunts and breaths of a voice's Sounds in another bank: listed by what they are)
        rest = [self._voice(self._slot(s, held.get(s), self.cat.clip(s).get("label", ""), bid), None, s)
                for s in self.sources(bid) if s not in listed]
        kinds = collections.Counter(r["sound"] for r in rest if r.get("sound") and not r["absent"])
        for title_, slots_ in (*((KIND_GROUP.get(k, k), sorted((r for r in rest if r.get("sound") == k and not r["absent"]),
                                                               key=lambda r: r["duration_ms"]))
                                 for k, _ in kinds.most_common()),
                               ("Other Audio", [r for r in rest if not r["absent"] and not r.get("sound")]),
                               ("No Audio in the Game Files", [r for r in rest if r["absent"]])):
            for at in range(0, len(slots_), CHUNK):
                name = title_ if len(slots_) <= CHUNK else f"{title_} {at + 1}–{min(len(slots_), at + CHUNK)}"
                groups.append(self._group(name, slots_[at:at + CHUNK]))

        heard = collections.Counter()  # clips without words, numbered per kind in the order they are listed
        for sl in (sl for g in groups for st in g["stems"] for sl in st["slots"]):
            if sl.get("sound") and sl["label"] == sl["sound"]:
                heard[sl["sound"]] += 1
                sl["label"] = f"{sl['sound']} {heard[sl['sound']]}"

        sets = self.bank_sets.get(bid, [])
        notes = []
        if rest and not sounds and not segments:
            notes.append("This bank only stores audio. The sounds that play it are in another bank.")
        lang = LANGUAGES.get(info.get("lang") or "", "")
        if lang:
            notes.append(f"These are {lang} voices. A replacement here only reaches players who use this language.")
            if len(self.voice_languages) < len(LANGUAGES):  # a voice has a tab per language only where it's installed
                have = self.voice_languages
                notes.append((f"Only {have[0]} voices are installed." if len(have) == 1 else
                              f"Voices installed: {', '.join(have)}.") +
                             " Other languages appear as tabs once Steam downloads their voice packs.")
        if borrowed:
            notes.append("Not transcribed. Each line is named after what another Helldiver voice says at the same place, "
                         "and the words may differ.")
        # a sound's slot names the Sound object that plays it (the first, where several do), for reference and for a
        # clip of its own: `players` counts the Sounds here that play the clip, `sound_banks` the other banks that
        # have that Sound (a clip of its own changes it in those, where a replacement changes it in `banks`)
        played_by, players = {}, collections.Counter(sid for _, sid in sounds)
        for oid, sid in sounds:
            played_by.setdefault(sid, oid)
        for g in groups:
            for st in g["stems"]:
                for sl in st["slots"]:
                    if int(sl["source"]) in played_by:
                        sl.setdefault("object", str(played_by[int(sl["source"])]))
                        sl["players"] = players[int(sl["source"])]
                        sl["sound_banks"] = max(0, len(self.ix.copies(int(sl["object"]))) - 1)
        all_slots = list(dict.fromkeys(sl["source"] for g in groups for st in g["stems"] for sl in st["slots"]))
        return {
            "id": f"bank:{bid}", "kind": "sounds", "path": list(self.where[sets[0]]) if sets else ["All Archives"],
            "name": self.bank_label(bid), "detail": "", "notes": " ".join(notes), "locked": False, "curated": bool(sets),
            "segments": len(groups), "slots": all_slots, "duration_ms": 0, "archives": len(info["archives"]),
            "contexts": 0, "archive_names": info["archives"], "segments_detail": groups, "context_list": [],
            "labels": [], "tags": [self._tag(i) for i in sets],
            "bank_name": PREFIX + (f"{info['lang']}/" if info.get("lang") else "") + self.bank_names[bid]
            if bid in self.bank_names else "", "language": lang, "lang": info.get("lang") or "",
        }

    def _streams(self, archive: str) -> dict:
        """The streams in an archive that no bank plays."""
        lost = sorted(o for o in self.ix.orphans if archive in self.ix.streams[o])
        if not lost:
            raise KeyError(archive)
        groups = [self._group("Streams" if len(lost) <= CHUNK else f"Streams {at + 1}–{min(len(lost), at + CHUNK)}",
                              [self._slot(o) for o in lost[at:at + CHUNK]]) for at in range(0, len(lost), CHUNK)]
        return {"id": f"streams:{archive}", "kind": "sounds", "path": ["All Archives", archive],
                "name": "Streams No Bank Plays", "detail": "", "locked": False, "curated": False, "segments": len(groups),
                "notes": "Audio files in this archive that no sound bank of this game version plays. The game may "
                         "never play them.",
                "slots": [str(o) for o in lost], "duration_ms": 0, "archives": 1, "contexts": 0, "archive_names": [archive],
                "segments_detail": groups, "context_list": [], "labels": [], "tags": [], "bank_name": "", "language": ""}

    def _sound(self, sid: int) -> dict:
        """One sound on its own (`sfx:<source>`): a plain sound a piece of music lists (the anthem at the flag), or a
        replacement nothing in the project's list holds."""
        sid = self.ix.resolve(sid)
        slot = self._slot(sid, wem.length_ms((self.ix.stream_data(sid, 96) or self.ix.wem(sid))[:96]))
        return {"id": f"sfx:{sid}", "kind": "sound", "path": ["Other Sounds"], "name": f"Sound {sid}", "detail": "",
                "notes": "A single sound. Audiodiver replaces it in every bank that holds or plays it.",
                "locked": False, "curated": False, "segments": 1, "slots": [str(sid)], "duration_ms": 0,
                "archives": 0, "contexts": 0, "archive_names": [], "segments_detail": [self._group("Sound", [slot])],
                "context_list": [], "labels": [], "tags": [], "bank_name": "", "language": ""}

    # --- finding things
    def _bank_home(self, bid: int) -> str:
        """Where a bank is listed: the sound set it is a part of, else the first archive that has it."""
        sets = self.bank_sets.get(bid, [])
        return sets[0] if sets else f"archive:{self.ix.banks[bid]['archives'][0]}"

    def home(self, sid: int) -> str | None:
        """The Index item a sound belongs to, else the archive it is in: where a project lists it. A sound many
        sets share goes to the first of them in the Index."""
        for cid in self.cm.by_source.get(sid, []):
            at = self.cat.music.cue_item.get(cid)
            if at:
                return at[0].id
        if sid in self.sound_items:
            return self.sound_items[sid]
        banks = sorted(self.ix.users.get(sid, ())) or sorted(self.ix.holders.get(sid, ()))
        known = [i for b in banks for i in self.bank_sets.get(b, [])]
        if known:
            return min(known, key=self.order.__getitem__)
        if banks:
            return f"archive:{self.ix.banks[banks[0]]['archives'][0]}"
        if sid in self.ix.orphans:
            return f"archive:{self.ix.streams[sid][0]}"
        return None

    def subtitle_lines(self, subs: list[int], code: str) -> list[dict]:
        """The voice lines that say these subtitles, in the voice banks of a language (English where it has none of
        them): [{cue, source, item, archives, name, subtitle, sure}], the first subtitle's first, sure ones first."""
        subs = [int(i) for i in subs]
        want = set(subs)
        if not hasattr(self, "_said_by"):  # subtitle -> the Sounds and English clips that say it
            self._said_by = collections.defaultdict(list)
            for oid, (i, _) in self.subtitles.items():
                self._said_by[i].append(("o", oid))
            for sid, (i, _) in self.clip_subtitles.items():
                self._said_by[i].append(("s", sid))
        banks = collections.defaultdict(set)  # language -> the banks to look in
        for i in want:
            for p, k in self._said_by.get(i, ()):
                for bid in self.ix.copies(k) if p == "o" else (self.ix.users.get(k) or self.ix.holders.get(k) or ()):
                    for b in self._languages(bid):  # the other languages' Sounds may go by other ids (_english)
                        banks[self.ix.banks[b].get("lang") or ""].add(b)
        out = []
        for bid in sorted(banks.get(code) or banks.get("us") or set().union(*banks.values())):
            try:
                view = self.view(f"bank:{bid}")
            except KeyError:
                continue
            for g in view["segments_detail"]:
                for st in g["stems"]:
                    for sl in st["slots"]:
                        if sl.get("subtitle") and int(sl["subtitle"]) in want:
                            out.append({"cue": f"bank:{bid}", "source": sl["source"], "item": self._bank_home(bid),
                                        "archives": self.ix.banks[bid]["archives"], "name": view["name"],
                                        "subtitle": sl["subtitle"], "sure": sl["subtitle_sure"]})
        order = {i: n for n, i in enumerate(subs)}
        return sorted(out, key=lambda r: (order[int(r["subtitle"])], not r["sure"], r["name"]))

    def places(self, n: int) -> list[dict]:
        """Where an id leads: a cue, a bank, or the cues and banks that play a source or a stream. Each place is
        {cue, source, item, archives}: what to open, the slot to select in it, the item or archive it is listed
        under, and the archives that hold it."""
        out = []
        cue = lambda cid, sid: {"cue": str(cid), "source": sid, "archives": self.cm.cues[cid]["archives"],
                                "item": (lambda at: at[0].id if at else None)(self.cat.music.cue_item.get(cid))}
        bank = lambda bid, sid: {"cue": f"bank:{bid}", "source": sid, "item": self._bank_home(bid),
                                 "archives": self.ix.banks[bid]["archives"]}
        if n in self.cm.cues:
            out.append(cue(n, None))
        if n in self.ix.banks and self._has_audio(n):
            out.append(bank(n, None))
        try:
            sid = self.ix.resolve(n)
        except KeyError:
            return out
        out += [cue(cid, str(sid)) for cid in self.cm.by_source.get(sid, [])]
        if sid in self.sound_items:
            out.append({"cue": f"sfx:{sid}", "source": str(sid), "item": self.sound_items[sid], "archives": []})
        banks = sorted(self.ix.users.get(sid, ())) or sorted(self.ix.holders.get(sid, ()))
        out += [bank(bid, str(sid)) for bid in sorted(banks, key=lambda b: (not self.bank_sets.get(b), b))]
        if sid in self.ix.orphans:
            a = self.ix.streams[sid][0]
            out.append({"cue": f"streams:{a}", "source": str(sid), "item": f"archive:{a}", "archives": [a]})
        return out
