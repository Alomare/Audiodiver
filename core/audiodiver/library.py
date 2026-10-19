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
with what it says, where the community has written that down (data/voices.json).

A project lists the Index items and archives it works on (project.py, "library"); `home` finds the one a sound
belongs to, for a project that has replacements but no list yet.
"""
import collections
import json
import re
import struct
import threading
from functools import cached_property
from importlib import resources

from . import bank as wbank
from . import music, wem
from .cuemap import slots
from .game import murmur64_hash
from .index import LANGUAGES
from .titles import title

PREFIX = "content/audio/"
CONTAINERS = (0x05, 0x06, 0x07, 0x09)  # random/sequence, switch, actor-mixer, layer: what a Sound can sit in
MUSIC = {"id": "music", "name": "Music", "hue": 300,
         "about": "The game's music by where it plays, from the ship to the credits."}
BIG_GROUP, CHUNK = 150, 100  # a group with more sounds than this is listed in runs of CHUNK
ALSO_LISTED = 8              # how many of the other places a sound plays in a slot names; the rest are counted
WIDELY = 10                  # a sound in this many other banks or more is one a whole family of banks shares
VIEWS_KEPT = 12


def _data(name):
    return json.loads(resources.files("audiodiver").joinpath("data", name).read_text(encoding="utf-8"))


def slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def _line(text: str) -> str:
    """A transcribed voice line, starting with a capital: the community writes them either way."""
    return text[:1].upper() + text[1:]


def _part(cue: str, name: str, count: int) -> dict:
    """A part of a sound set or an archive: one bank (or an archive's loose streams), shaped like a part of a piece
    of music. `count` is how many sounds it has."""
    return {"cue": cue, "name": name, "kind": "bank", "targets": [], "own": [], "links": [], "duration_ms": 0,
            "note": "", "count": count}


class Library:
    def __init__(self, catalog):
        self.cat, self.cm, self.ix = catalog, catalog.cm, catalog.cm.ix
        voices = _data("voices.json")
        self.voices = {int(k): _line(v) for k, v in voices["lines"].items()}
        self.calls = {int(k): _line(v) for k, v in voices.get("calls", {}).items()}  # untranscribed: a sibling's words
        self.bank_names = {}  # bank id -> the last part of its path name ("wep_autocannon")
        for tail in _data("banks.json")["names"]:
            for path in (PREFIX + tail, *(f"{PREFIX}{code}/{tail}" for code in LANGUAGES)):
                bid = murmur64_hash(path.encode())
                if bid in self.ix.banks:
                    self.bank_names[bid] = tail
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
                    for old in e.get("was", []):  # a project that listed it by an older name finds it
                        self.renamed.setdefault(f"set:{sec['id']}/{slug(old)}", iid)
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

    # --- a bank's sounds, as something to open
    def view(self, cue_id: str) -> dict:
        """The cue-shaped view of `bank:<id>` or `streams:<archive>`. KeyError when there is no such thing."""
        with self._lock:
            if cue_id in self._views:
                self._views.move_to_end(cue_id)
                return self._views[cue_id]
        kind, _, key = cue_id.partition(":")
        try:
            v = (self._bank(int(key)) if kind == "bank" else self._streams(key) if kind == "streams"
                 else self._sound(int(key)) if kind == "sfx" else None)
        except (ValueError, KeyError):
            v = None
        if v is None:
            raise KeyError(f"nothing to open as {cue_id}")
        with self._lock:
            self._views[cue_id] = v
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

    @staticmethod
    def _group(name, slots_, **more) -> dict:
        """Sounds that belong together, shaped like a music segment with one stem. `shared` is how many other banks
        play every one of them (0 for sounds this bank has to itself)."""
        return {"segment": "", "name": name, "depth": 0, "loop": 1, "duration_ms": 0, "entry_ms": None, "exit_ms": None,
                "stems": [{"track": "", "type": "sound", "switch_group": "", "slots": slots_}], "tags": [], "group": True,
                "shared": min((s["banks"] for s in slots_), default=0), **more}

    def _bank(self, bid: int) -> dict:
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
        sounds, parent, segments = [], {}, []
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
                try:
                    parent[oid] = music.read_node_base_params(music.Reader(body, 0))[1]
                except Exception:
                    pass
            elif t == music.MUSIC_SEGMENT:
                segments.append(oid)

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

        # 2. sounds, by the container that holds the takes of one sound: the nearest one above with more than one
        leaves = collections.Counter()
        for oid, _sid in sounds:
            cur, seen = parent.get(oid), set()
            while cur in parent and cur not in seen:
                seen.add(cur)
                leaves[cur] += 1
                cur = parent[cur]
        by_key, order = collections.defaultdict(list), []
        for oid, sid in sounds:
            if sid in listed:
                continue  # in the music above, or played by a Sound that came before: one thing to replace
            listed.add(sid)
            key, seen = parent.get(oid, 0), set()
            while key in parent and leaves[key] < 2 and key not in seen:
                seen.add(key)
                key = parent[key]
            if key not in by_key:
                order.append(key)
            by_key[key].append((oid, sid))
        made = [([self._slot(sid, held.get(sid), self.voices.get(oid, ""), bid) for oid, sid in by_key[key]],
                 collections.Counter(self.calls[oid] for oid, _ in by_key[key] if oid in self.calls)) for key in order]
        # what this bank has to itself (or shares with a variant or two) comes first; the sounds a whole family of
        # banks has copies of (every weapon's handling sounds) go last. Within each, the bank's own order.
        made.sort(key=lambda m: min(r["banks"] for r in m[0]) >= WIDELY)
        # a sound nothing says, named by the notes on its takes (data/notes.json: "Ready"), numbered when several are
        noted = [collections.Counter(l for r in rows if (l := self.cat.clip(int(r["source"])).get("label")))
                 for rows, _ in made]
        noted_n, noted_seen = collections.Counter(c.most_common(1)[0][0] for c in noted if c), collections.Counter()
        n, borrowed = 0, False
        for (rows, called), notes in zip(made, noted):
            if len(rows) > BIG_GROUP:
                for at in range(0, len(rows), CHUNK):
                    groups.append(self._group(f"Sounds {at + 1}–{min(len(rows), at + CHUNK)}", rows[at:at + CHUNK]))
                continue
            n += 1
            said = collections.Counter(r["label"] for r in rows if r["label"])
            for k, r in enumerate(rows, 1):  # the takes of one sound, told apart by number where nothing says more
                r["label"] = r["label"] or (f"Take {k}" if len(rows) > 1 else "")
            borrowed |= not said and bool(called)  # the call is named, the takes keep their numbers
            said = said or called
            name = f"Sound {n}"
            if said:
                name = f"“{said.most_common(1)[0][0]}”"
            elif notes:
                name = notes.most_common(1)[0][0]
                if noted_n[name] > 1:
                    noted_seen[name] += 1
                    name += f" {noted_seen[name]}"
            groups.append(self._group(name, rows))
        # 3. what is left: audio this bank holds or names that none of its Sounds plays (a Sound in another bank
        # does, or nothing seen does), then what it names that has no audio in this install at all
        rest = [self._slot(s, held.get(s), self.cat.clip(s).get("label", ""), bid) for s in self.sources(bid)
                if s not in listed]
        for title_, slots_ in (("Other Audio", [r for r in rest if not r["absent"]]), ("No Audio in the Game Files", [r for r in rest if r["absent"]])):
            for at in range(0, len(slots_), CHUNK):
                name = title_ if len(slots_) <= CHUNK else f"{title_} {at + 1}–{min(len(slots_), at + CHUNK)}"
                groups.append(self._group(name, slots_[at:at + CHUNK]))

        sets = self.bank_sets.get(bid, [])
        notes = []
        if rest and not sounds and not segments:
            notes.append("This bank only stores audio: the sounds that play it are in another bank.")
        lang = LANGUAGES.get(info.get("lang") or "", "")
        if lang:
            notes.append(f"{lang} voices: a replacement here only reaches players who use this language.")
            if len(self.voice_languages) < len(LANGUAGES):  # a voice has a tab per language only where it's installed
                have = self.voice_languages
                notes.append((f"Only {have[0]} voices are installed." if len(have) == 1 else
                              f"Voices installed: {', '.join(have)}.") +
                             " Other languages appear as tabs once Steam downloads their voice packs.")
        if borrowed:
            notes.append("Not transcribed: each line is named after what another Helldiver voice says in its place, "
                         "and the words may differ.")
        # a sound's slot names the Sound object that plays it (the first, where several do), for reference
        played_by = {}
        for oid, sid in sounds:
            played_by.setdefault(sid, oid)
        for g in groups:
            for st in g["stems"]:
                for sl in st["slots"]:
                    if int(sl["source"]) in played_by:
                        sl.setdefault("object", str(played_by[int(sl["source"])]))
        all_slots = list(dict.fromkeys(sl["source"] for g in groups for st in g["stems"] for sl in st["slots"]))
        return {
            "id": f"bank:{bid}", "kind": "sounds", "path": list(self.where[sets[0]]) if sets else ["All Archives"],
            "name": self.bank_label(bid), "detail": "", "notes": " ".join(notes), "locked": False, "curated": bool(sets),
            "segments": len(groups), "slots": all_slots, "duration_ms": 0, "archives": len(info["archives"]),
            "contexts": 0, "archive_names": info["archives"], "segments_detail": groups, "context_list": [],
            "labels": [], "tags": [self._tag(i) for i in sets],
            "bank_name": PREFIX + (f"{info['lang']}/" if info.get("lang") else "") + self.bank_names[bid]
            if bid in self.bank_names else "", "language": lang,
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
                "notes": "A sound on its own. Audiodiver replaces it in every bank that holds or plays it.",
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
