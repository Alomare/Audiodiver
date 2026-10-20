"""Names the cue map for people: the All cues tree (Ship ▸ First load, Combat ▸ Terminids…), cue and slot names, notes
and locks. Sources of names, in order: the curated catalog (data/catalog.json), the Music view's names
(musiclist.py: "Terminid exploring · Idle", "Terminids: Battle → Exploring"), the community spreadsheet's labels
(data/labels.json), cracked Wwise names (data/names.json), then the raw ids. Single clips can also have notes
(data/notes.json): a label where the spreadsheet has none, what the clip is, and warnings found in game.
"""
import collections
import json
import re
from functools import cached_property
from importlib import resources

from .cuemap import CueMap, slots
from .game import stream_id
from .titles import title

GROUP_ORDER = ["Ship", "Hellpod", "Mission", "Combat", "Post-Mission", "Menu", "Stingers", "Other", "Unused",
               "Transitions"]
QUIET_GROUPS = {"MUSIC", "music_credits_switch", "music_extraction", "music_objective_stingers", "534536019"}
LOCK_WORDS = re.compile(r"do(?:n'?t| not) touch", re.I)


def _data(name):
    return json.loads(resources.files("audiodiver").joinpath("data", name).read_text(encoding="utf-8"))


def _clips(groups) -> dict[str, dict]:
    """data/notes.json by clip: {id: {"label", "notes": [{"text", "tag"?, "warn"?}], "min_ms"}}."""
    out = {}
    for g in groups:
        note = {"text": g["note"], **{k: g[k] for k in ("tag", "warn") if k in g}} if "note" in g else None
        for i in g["ids"]:
            c = out.setdefault(i, {})
            if "label" in g:
                c.setdefault("label", g["label"])
            if note:
                c.setdefault("notes", []).append(note)
            if "min_ms" in g:
                c["min_ms"] = g["min_ms"]
    return out


class Catalog:
    def __init__(self, cuemap: CueMap):
        self.cm = cuemap
        cat = _data("catalog.json")
        self.names = {int(k): v for k, v in _data("names.json").items()}
        # a guess marked "(?)" in the workbooks is shown as a plain name (the app states what it knows; app/README.md)
        self.labels = {k: [re.sub(r"\s*\(\?\)", "", x).strip() for x in v] for k, v in _data("labels.json").items()}
        self.clips = _clips(_data("notes.json")["groups"])
        self.curated = {int(k): v for k, v in cat["cues"].items()}
        self.factions, self.faction_group = cat["factions"], int(cat["faction_group"])
        self.events, self.values, self.groups = cat["events"], cat["values"], cat.get("groups", {})

    def name(self, i) -> str:
        return i if isinstance(i, str) else self.names.get(i, str(i))

    def slot_labels(self, sid: int) -> list[str]:
        return self.labels.get(str(sid), []) + self.labels.get(str(stream_id(sid)), [])

    def clip(self, sid: int) -> dict:
        """The notes on one clip (data/notes.json): its "label", "notes" and "min_ms", where it has them."""
        return self.clips.get(str(sid)) or self.clips.get(str(stream_id(sid))) or {}

    def clip_notes(self, sid: int) -> dict:
        """What a slot carries of its clip's notes besides the label."""
        c = self.clip(sid)
        return {k: c[k] for k in ("notes", "min_ms") if k in c}

    def cue_labels(self, cue) -> list[str]:
        out = list(self.labels.get(str(cue["id"]), []))
        for sid in slots(cue):
            out += [l for l in self.slot_labels(sid) if l not in out]
        return out

    # --- naming
    def _label_name(self, cue) -> str | None:
        bases = collections.Counter()
        for l in self.cue_labels(cue):
            if not LOCK_WORDS.search(l):
                bases[re.sub(r"\s*(?:#\s*\d+|Cue \d+|\(\?\))\s*$", "", l).strip()] += 1
        return bases.most_common(1)[0][0] if bases else None

    @cached_property
    def music(self):
        """The Music view (musiclist.MusicList), built on this catalog's names and labels."""
        from .musiclist import MusicList
        return MusicList(self)

    def _detail(self, cue) -> str:
        """The conditions that tell this cue apart, e.g. 'forest / grassland · arrival'."""
        groups = collections.defaultdict(list)
        for ctx in cue["contexts"]:
            for g, v in ctx:
                g = self.name(g)
                if g in QUIET_GROUPS or g in ("event", "bridge", "stinger") or g == self.name(self.faction_group):
                    continue
                v = self.values.get(self.name(v), self.name(v))
                v = v.removeprefix("music_").replace("_", " ")
                if v not in groups[g]:
                    groups[g].append(v)
        parts = []
        for g, vs in sorted(groups.items(), key=lambda kv: (kv[0].isdigit(), kv[0])):
            named = [v for v in vs if not v.isdigit()]
            if named and len(vs) <= 4:
                parts.append(" / ".join(sorted(named)))
        return " · ".join(parts[:3])

    def describe(self, cue) -> dict:
        cur = self.curated.get(cue["id"], {})
        conds = [(self.name(g), self.name(v)) for ctx in cue["contexts"] for g, v in ctx]
        faction = next((self.factions.get(v, v) for g, v in conds if g == self.name(self.faction_group)), None)
        event = next((v for g, v in conds if g == "event"), None)
        if cue["kind"] == "bridge":
            path = ["Transitions"]
        elif cue["kind"] == "stinger":
            path = ["Stingers"]
        elif ("MUSIC", "music_tutorial_old") in conds:
            path = ["Unused", "Old tutorial"]
        elif faction:
            path = ["Combat", faction]
        elif event in self.events:
            path = ["Combat", self.events[event], "Event layers"]
        elif event:
            path = ["Other", "Event-driven"]
        else:
            path = ["Other"]
        labels = self.cue_labels(cue)
        locked = any(LOCK_WORDS.search(l) for l in labels)
        notes = cur.get("notes", "")
        named = cur.get("name") or self.music.label(cue["id"])
        if not named and slots(cue) and not self.music.targets(cue):
            named = "Filler (do not touch)"  # nothing a replacement may change
        other = self._label_name(cue)  # the name labels.json gives it
        if other and not cur and named and not locked:
            notes = (notes + " " if notes else "") + f"Also called '{other}'."
        if locked:
            notes = (notes + " " if notes else "") + "Do not touch. Replacing it makes the music stutter."
        return {"path": [title(x) for x in cur.get("path", path)],
                "name": title(named or other or f"{cue['kind'].title()} {cue['id']}"),
                "detail": self._detail(cue), "notes": notes, "locked": locked, "curated": bool(cur),
                "slot_pattern": cur.get("slot"), "slot_first": cur.get("slot_first")}

    def variant(self, group: int, value: int) -> str:
        """'biome: forest' for the switch value a slot plays on ('' if it always plays)."""
        if not value:
            return ""
        v = self.values.get(self.name(value), self.name(value))
        g = self.groups.get(self.name(group))
        if v.isdigit():  # unnamed in the game data; a short tail of its id keeps two of them apart
            v = f"variant {v[-4:]}"
        return f"{g}: {v}" if g else v

    # --- views for the editor
    @cached_property
    def entries(self) -> list[dict]:
        out = []
        for cue in self.cm.cues.values():
            sl = slots(cue)
            if not sl:  # silent segments: nothing to replace
                continue
            d = self.describe(cue)
            out.append({"id": str(cue["id"]), "kind": cue["kind"], **d,
                        "segments": len(cue["segments"]), "slots": [str(s) for s in sl],
                        "duration_ms": sum(s["duration_ms"] for s in cue["segments"]),
                        "archives": len(cue["archives"]), "contexts": len(cue["contexts"])})
        names = collections.Counter((tuple(e["path"]), e["name"]) for e in out)
        for e in out:  # same name in the same group: tell them apart by condition, else by number
            if names[(tuple(e["path"]), e["name"])] > 1 and e["detail"]:
                e["name"] += f" · {e['detail']}"
        names = collections.Counter((tuple(e["path"]), e["name"]) for e in out)
        seen = collections.Counter()
        for e in sorted(out, key=lambda e: int(e["id"])):
            key = (tuple(e["path"]), e["name"])
            if names[key] > 1:
                seen[key] += 1
                e["name"] += f" #{seen[key]}"
        for e in out:
            e["name"] = title(e["name"])  # the conditions added above are part of the name now
        rank = lambda e: (GROUP_ORDER.index(e["path"][0]) if e["path"][0] in GROUP_ORDER else 99, e["path"],
                          not e["curated"], e["name"].lower())
        return sorted(out, key=rank)

    def cue(self, cue_id: int) -> dict:
        """A cue with its segments, stems and slots, named. KeyError for an id that is no cue, and for a cue with
        nothing to replace in it (silent segments), which `entries` leaves out."""
        cue = self.cm.cues[cue_id]
        d = next((e for e in self.entries if e["id"] == str(cue_id)), None)
        if d is None:
            raise KeyError(cue_id)
        pattern = d["slot_pattern"]
        segments = []
        for n, s in enumerate(cue["segments"]):
            stems = []
            for k, st in enumerate(s["stems"]):
                out_slots = []
                for sl in st["slots"]:
                    sid = sl["source"]
                    labels = self.slot_labels(sid)
                    out_slots.append({
                        "source": str(sid), "duration_ms": sl["duration_ms"], "unused": sl["unused"],
                        "variant": self.variant(st["switch_group"], sl["variant"]),
                        "label": next((l for l in labels if not LOCK_WORDS.search(l)), "") or
                                 self.clip(sid).get("label", ""),
                        "locked": any(LOCK_WORDS.search(l) for l in labels),
                        "also_in": [str(c) for c in self.cm.by_source[sid] if c != cue_id],
                        **self.clip_notes(sid),
                    })
                stems.append({"track": str(st["track"]), "type": st["type"],
                              "switch_group": self.name(st["switch_group"]) if st["switch_group"] else "",
                              "slots": out_slots})
            name = pattern.format(n=n + 1, n0=n) if pattern else f"Segment {n + 1}"
            if n == 0 and d["slot_first"]:
                name = d["slot_first"]
            name = title(name)
            segments.append({"segment": str(s["segment"]), "name": name, "depth": s["depth"], "loop": s["loop"],
                             "duration_ms": s["duration_ms"], "entry_ms": s["entry_ms"], "exit_ms": s["exit_ms"],
                             "stems": stems})
        contexts = [" & ".join(f"{self.name(g)}={self.values.get(self.name(v), self.name(v))}" for g, v in ctx)
                    for ctx in cue["contexts"][:12]]
        return {**d, "archive_names": cue["archives"], "segments_detail": segments, "context_list": contexts,
                "labels": self.cue_labels(cue)[:20]}
