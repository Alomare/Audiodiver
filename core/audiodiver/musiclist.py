"""The Music view: the game's music the way a player meets it, from the ship to the credits.

Sections follow a mission: On the ship, Before the drop, one section per enemy faction, Objectives, Extraction, After
the mission, Credits, Training. Each item is one piece of music a player would recognise ("Loadout selection",
"Terminids ▸ Battle"), made of parts: the cues (playlists, transition bridges, stingers) or plain sounds that make it
up. A part's targets are the sources a replacement can change (heard and not marked do-not-touch).

Items come from rules over the game's own state names (MUSIC, music_enemy_type, music_encounter, the battle state
and intensity), with names and descriptions in data/music.json. Music a game update adds therefore lands in a
sensible place (a new faction gets its own section), and anything the rules can't place is listed under "Not
identified yet" with the game state that starts it, never under a bare number. Transition bridges are named by
what they connect ("Exploring → Battle"), stingers by what they play over.
"""
import collections
import json
import re
from dataclasses import dataclass, field
from importlib import resources

from .titles import title

ANY = 0xFFFFFFFF  # wildcard source/destination in transition rules
UNKNOWN = "an unknown piece"  # a rule end the game data doesn't hold
LOCK_WORDS = re.compile(r"do(?:n'?t| not) touch", re.I)
ROLE_ORDER = ["arrival", "exploring", "battle", "intense", "respawn", "death"]
PREVIEW_MS = 8000  # a preview prefers the first slot at least this long


def _data(name):
    return json.loads(resources.files("audiodiver").joinpath("data", name).read_text(encoding="utf-8"))


@dataclass
class Part:
    cue: str            # cue id, or "sfx:<source>" for a plain sound
    name: str
    kind: str           # playlist, segment, bridge, stinger or sound
    targets: list[int]
    duration_ms: float
    note: str = ""


@dataclass
class Item:
    id: str
    section: str
    name: str
    about: str
    kind: str = "music"  # music, transition or stinger
    role: str = ""
    full: str = ""       # the name outside its section ("Terminid battle")
    parts: list[Part] = field(default_factory=list)

    @property
    def targets(self) -> list[int]:
        return list(dict.fromkeys(t for p in self.parts for t in p.targets))


@dataclass
class Place:
    """Where a transition rule's source or destination is, for naming the bridge."""
    label: str
    section: str = ""
    item: Item | None = None
    part: Part | None = None


class MusicList:
    def __init__(self, catalog):
        self.cat, self.cm = catalog, catalog.cm
        self.data = d = _data("music.json")
        self.groups = d["groups"]
        self.sections = []  # [{"id", "name", "about", "unused"}]
        self.items: list[Item] = []
        self.cue_item: dict[int, tuple[Item, Part]] = {}
        self.facts = {cid: [{self.cat.name(g): self.cat.name(v) for g, v in ctx} for ctx in cue["contexts"]]
                      for cid, cue in self.cm.cues.items()}
        self.source_ms = {}
        for cue in self.cm.cues.values():
            for s in cue["segments"]:
                for st in s["stems"]:
                    for sl in st["slots"]:
                        self.source_ms[sl["source"]] = max(self.source_ms.get(sl["source"], 0), sl["duration_ms"])
        self._build()

    # --- helpers
    def targets(self, cue) -> list[int]:
        """The sources of a cue a replacement can change: heard, and not marked do-not-touch."""
        out = []
        for s in cue["segments"]:
            for st in s["stems"]:
                for sl in st["slots"]:
                    sid = sl["source"]
                    if sl["unused"] or sid in out or any(LOCK_WORDS.search(l) for l in self.cat.slot_labels(sid)):
                        continue
                    out.append(sid)
        return out

    def _part(self, cid, name="", note="") -> Part:
        cue = self.cm.cues[cid]
        return Part(str(cid), name, cue["kind"], self.targets(cue),
                    sum(s["duration_ms"] for s in cue["segments"]), note)

    def _matches(self, cid, cond: dict) -> bool:
        """Whether one of the cue's contexts meets cond. Contexts with the credits on (which override every other
        state) only count when cond asks for them."""
        return any(all(f.get(g) == v for g, v in cond.items()) for f in self.facts[cid]
                   if f.get("music_credits_switch") != "music_credits_on" or "music_credits_switch" in cond)

    def _section(self, sid) -> dict:
        return next(s for s in self.sections if s["id"] == sid)

    def _item(self, iid, section, name, about="", kind="music", role="", full="") -> Item:
        it = next((i for i in self.items if i.id == iid), None)
        if not it:
            it = Item(iid, section, name, about, kind, role, full or name)
            self.items.append(it)
        return it

    def _claim(self, item: Item, part: Part):
        item.parts.append(part)
        if not part.cue.startswith("sfx:"):
            self.cue_item.setdefault(int(part.cue), (item, part))

    # --- building
    def _build(self):
        d, cues = self.data, self.cm.cues
        factions = self._factions()
        for s in d["sections"]:
            if s["id"] == "combat":
                self.sections += [{"id": f["id"], "name": f["name"], "about": f["about"], "unused": False,
                                   "faction": f["value"]} for f in factions]
            else:
                self.sections.append({"id": s["id"], "name": s["name"], "about": s["about"],
                                      "unused": s.get("unused", False)})
        music_cues = [cid for cid, c in cues.items() if c["kind"] in ("playlist", "segment") and self.targets(c)]

        # 1. the named items of data/music.json
        role_items = {}
        for spec in d["items"]:
            it = self._item(spec["id"], spec["section"], spec["name"], spec.get("about", ""))
            if spec.get("role"):
                role_items[spec["role"]] = it
            for p in spec.get("parts", []):
                if "cue" in p and p["cue"] in cues and p["cue"] not in self.cue_item:
                    self._claim(it, self._part(p["cue"], p.get("name", "")))
                elif "sound" in p:
                    try:
                        sid = self.cm.ix.resolve(p["sound"]) if self.cm.ix else p["sound"]
                    except KeyError:
                        continue  # gone in this game version
                    it.parts.append(Part(f"sfx:{sid}", p.get("name", ""), "sound", [sid], 0.0))
                elif "match" in p:
                    found = [c for c in music_cues if c not in self.cue_item and self._matches(c, p["match"])]
                    for n, c in enumerate(found, 1):
                        name = p.get("name", "")
                        self._claim(it, self._part(c, f"{name} {n}".strip() if len(found) > 1 else name))

        # 2. combat music, one section per faction, items by role
        by_role = collections.defaultdict(list)
        for cid in music_cues:
            if cid in self.cue_item:
                continue
            r = self._combat_role(cid, factions)
            if r:
                by_role[(r[0], r[1])].append((cid, r[2], r[3]))
        roles = d["roles"]
        for f in factions:
            for role in ROLE_ORDER:
                found = by_role.get((f["id"], role))
                if not found:
                    continue
                about = " ".join(filter(None, [roles[role]["about"], f.get("roles", {}).get(role)]))
                it = self._item(f"{f['id']}/{role}", f["id"], roles[role]["name"], about, role=role,
                                full=f"{f['short']} {roles[role]['name'].lower()}")
                numbered = collections.Counter(name for _, name, _ in found)
                seen = collections.Counter()
                for cid, name, note in sorted(found, key=self._part_order):
                    if numbered[name] > 1:
                        seen[name] += 1
                        name = f"{name or 'Variant'} {seen[name]}"
                    other = self._community_name(cid)
                    if other and not re.search(r"combat music|cue|transition|bumper|^calm$|^ambient$", other, re.I) \
                            and other.lower() not in (name.lower(), it.name.lower()):
                        note = (note + " " if note else "") + f"Also called '{other}'."
                    self._claim(it, self._part(cid, name, note))
            failed = by_role.get((f["id"], "mission-failed"), [])
            if failed and "mission-failed" in role_items:
                for cid, _, _ in failed:
                    self._claim(role_items["mission-failed"], self._part(cid, f["name"]))

        # 3. training, old training and whatever is left, named by the community where it has a name
        for sec, g in [*d["generated"].items(), ("unknown", {"match": {}, "name": "Unidentified piece"})]:
            found = [c for c in music_cues if c not in self.cue_item and self._matches(c, g["match"])]
            names = [self.cat.curated.get(c, {}).get("name") or self._community_name(c) for c in found]
            repeats, seen, unnamed = collections.Counter(names), collections.Counter(), 0
            for cid, name in zip(found, names):
                if not name:
                    unnamed += 1
                    name = f"{g['name']} {unnamed}"
                elif repeats[name] > 1:
                    seen[name] += 1
                    name = f"{name} {seen[name]}"
                it = self._item(f"{sec}/{cid}", sec, name, self._starts(cid))
                self._claim(it, self._part(cid))

        for it in self.items:
            self._dedupe(it)

        # 4. stingers by what they play over, bridges by what they connect
        for cid, cue in cues.items():
            if cue.get("stinger_of") and cid not in self.cue_item and self.targets(cue):
                self._place_stinger(cid, cue)
        for cid, cue in cues.items():
            if cue.get("rules") and cid not in self.cue_item and self.targets(cue):
                self._place_bridge(cid, cue)
        for it in self.items:  # named transition items: name their parts too
            for p in it.parts:
                if not p.name and p.kind == "bridge":
                    p.name = self._bridge_name(cues[int(p.cue)], it.section)
                elif not p.name and p.kind == "stinger":
                    p.name = self._stinger_name(cues[int(p.cue)], it.section)
            kinds = {p.kind for p in it.parts}
            if kinds == {"bridge"}:
                it.kind = "transition"
            elif kinds == {"stinger"}:
                it.kind = "stinger"
        for it in self.items:
            if it.kind != "music":
                self._dedupe(it)
            repeats, seen = collections.Counter(p.name for p in it.parts), collections.Counter()
            for p in it.parts:  # different audio for the same moment: "Battle → Exploring #2"
                if p.name and repeats[p.name] > 1:
                    seen[p.name] += 1
                    p.name += f" #{seen[p.name]}"
        self.items = [i for i in self.items if i.parts]
        order = {s["id"]: n for n, s in enumerate(self.sections)}
        kind_last = {"music": 0, "stinger": 1, "transition": 2}
        self.items.sort(key=lambda i: (order[i.section], kind_last[i.kind] if i.id.endswith(("/stingers",
                                                                                               "/transitions")) else 0))

    def _part_order(self, found):
        """Parts in a sensible order: exploring by intensity, arrival with the named biomes first."""
        cid, name, _ = found
        levels = list(self.data["intensity"].values())
        level = next((n for n, lv in enumerate(levels) if name.startswith(lv)), len(levels))
        return level, name.startswith(("Other", "Any")), name, -len(self.targets(self.cm.cues[cid]))

    def _factions(self) -> list[dict]:
        """The factions in data/music.json order, plus any value of the faction group a game update added."""
        known = list(self.data["factions"])
        values = {f.get(self.groups["faction"]) for fs in self.facts.values() for f in fs} - {None}
        for v in sorted(values - {f["value"] for f in known}):
            name = v.removeprefix("music_enemy_").replace("_", " ").title()
            known.append({"value": v, "id": f"faction-{v}", "name": name, "short": name,
                          "about": f"Combat music for {v}, a faction that Audiodiver can't identify yet."})
        return [f for f in known if f["value"] in values]

    def _combat_role(self, cid, factions):
        """(faction id, role, part name, note) for a combat cue, else None."""
        g = self.groups
        facts = [f for f in self.facts[cid] if f.get("MUSIC") == "music_battle_play" and g["faction"] in f
                 and f.get("music_extraction") == "out_extraction"]
        if not facts:
            return None
        fids = {f[g["faction"]] for f in facts}
        faction = next((x["id"] for x in factions if x["value"] in fids), None)
        if len(fids) > 1 or not faction:
            return None
        states = {f.get(g["state"]) for f in facts}
        ints = {f.get(g["intensity"]) for f in facts} - {None}
        encs = {f.get(g["encounter"]) for f in facts}
        biomes = sorted({f[g["biome"]] for f in facts if g["biome"] in f})
        if states == {"music_death"}:
            return faction, "death", "", ""
        if states == {"music_mission_failure"}:
            return faction, "mission-failed", "", ""
        if states == {"music_respawn"}:
            return faction, "respawn", "Bumper", ""
        if states == {"music_scene_setter"}:
            names = [self.data["biomes"].get(b) for b in biomes]
            named = [n for n in names if n]
            if named:
                label = ", ".join(named[:-1]) + (" and " if len(named) > 1 else "") + named[-1]
                return faction, "arrival", label[0].upper() + label[1:], ""
            if biomes:
                return faction, "arrival", "Other biomes", "Biomes the game data leaves unnamed."
            return faction, "arrival", "Any other biome", ""
        if ints == {"music_intensity_high"}:
            return faction, "intense", "", ""
        if "music_encounter_active" in encs:
            return faction, "battle", "", ""
        names = [self.data["intensity"].get(i, i) for i in sorted(ints)]
        name = " and ".join(names) if len(names) <= 2 else "Several levels"
        if "music_scene_setter" in states:
            name += ", also on arrival"
        return faction, "exploring", name, ""

    def _community_name(self, cid) -> str:
        name = self.cat._label_name(self.cm.cues[cid])
        return re.sub(r"\s*\(\?\)\s*$", "", name).strip() if name else ""

    def _starts(self, cid) -> str:
        """Which game state starts a cue, for music the rules can't place."""
        f = next(iter(self.facts[cid]), {})
        state = f.get("MUSIC")
        if not state:
            return "Started directly by a game event."
        sub = f.get(state)
        return f"Starts when the MUSIC state is {state}" + (f" and {state} is {sub}" if sub else "") + "."

    # --- stingers and bridges
    def _place(self, oid) -> Place | None:
        """Where a rule's source or destination is: a music item (and part), a faction's music, or a named place."""
        if oid == ANY:
            return Place("anything")
        for cid in [oid, *self.cm.by_segment.get(oid, [])]:
            if cid in self.cue_item:
                it, part = self.cue_item[cid]
                return Place(it.full, it.section, it, part)
        if oid in self.cm.switches:
            sec = self._switch_section(oid)
            return Place(f"{sec['name']} music", sec["id"]) if sec else Place("the mission music")
        name = self.data["places"].get(str(oid))
        return Place(name) if name else None

    def _switch_section(self, sid):
        """The faction section a music switch belongs to (from the conditions that reach it)."""
        values = {f.get(self.groups["faction"]) for ctx in self.cm.switches[sid]["contexts"]
                  for f in [{self.cat.name(g): self.cat.name(v) for g, v in ctx}]} - {None}
        return next((s for s in self.sections if s.get("faction") in values), None)

    def _home(self, places: list[Place], owner_section=None) -> str:
        """The section a bridge or stinger is listed in: its faction when it touches one, else where it leads."""
        faction = next((p.section for p in places if p.section and self._section(p.section).get("faction")), None)
        return owner_section or faction or next((p.section for p in places if p.section), "unknown")

    def _bridge_ends(self, cue):
        """(from places, to places, owner sections). An id the game data doesn't hold any more becomes an
        "unknown piece" place."""
        froms, tos, owner_sections = [], [], []
        for r in cue["rules"]:
            froms += [self._place(x) or Place(UNKNOWN) for x in r["from"]]
            tos += [self._place(x) or Place(UNKNOWN) for x in r["to"]]
            if r["owner"] in self.cm.switches:
                sec = self._switch_section(r["owner"])
                if sec:
                    owner_sections.append(sec["id"])
        return froms, tos, owner_sections

    def _names(self, places: list[Place], home) -> str:
        """"Battle or Intense battle": places joined, one name per item, short inside the home section."""
        anything = any(p.label == "anything" for p in places)
        known = [p for p in places if p.label not in ("anything", UNKNOWN)]
        if not known:
            return "anything" if anything else UNKNOWN
        by_key = {}
        for p in known:
            by_key.setdefault(p.item.id if p.item else p.label, []).append(p)
        names = []
        for ps in by_key.values():
            p = ps[0]
            if not p.item:
                names.append(p.label)
                continue
            base = p.item.name if p.item.section == home else p.item.full
            parts = {q.part.name for q in ps if q.part and q.part.name}
            if len(parts) == 1 and len(p.item.parts) > 1 and p.item.kind == "music":
                part = next(iter(parts))
                base += f" ({part[0].lower() + part[1:]})"
            names.append(base)
        sections = [n for n in names if n.endswith(" music")]
        if len(sections) > 2:  # several factions' music
            names = [n for n in names if not n.endswith(" music")] + ["the combat music"]
        names = list(dict.fromkeys(names))
        if anything:
            names = names + ["anything else"] if len(names) == 1 else ["anything"]
        return " or ".join(names) if len(names) <= 2 else f"{names[0]}, {names[1]} and {len(names) - 2} more"

    def _bridge_name(self, cue, home) -> str:
        froms, tos, _ = self._bridge_ends(cue)
        return f"{self._names(froms, home)} → {self._names(tos, home)}"

    def _place_bridge(self, cid, cue):
        froms, tos, owners = self._bridge_ends(cue)
        home = self._home(tos + froms, owners[0] if len(set(owners)) == 1 else None)
        role = self.data["roles"]["transitions"]
        it = self._item(f"{home}/transitions", home, role["name"], role["about"], kind="transition",
                        role="transitions", full=f"{self._section(home)['name']} transitions")
        lost = all(all(self._place(x) is None for x in r["to"]) or all(self._place(x) is None for x in r["from"])
                   for r in cue["rules"])
        note = "One end of this transition isn't in the game data any more, so it may never play." if lost else ""
        self._claim(it, self._part(cid, self._bridge_name(cue, home), note))

    def _stinger_name(self, cue, home=None) -> str:
        over = [p for p in (self._place(s["owner"]) for s in cue["stinger_of"]) if p]
        return f"Over {self._names(over, home)}" if over else "Stinger"

    def _place_stinger(self, cid, cue):
        over = [p for p in (self._place(s["owner"]) for s in cue["stinger_of"]) if p]
        home = self._home(over)
        role = self.data["roles"]["stingers"]
        it = self._item(f"{home}/stingers", home, role["name"], role["about"], kind="stinger", role="stingers",
                        full=f"{self._section(home)['name']} stingers")
        self._claim(it, self._part(cid, self._stinger_name(cue, home)))

    def _dedupe(self, it: Item):
        """Parts with exactly the same audio become one part: music parts join their names ("Unnamed level and
        low"), transitions and stingers keep the first name and say what else the audio plays for."""
        out, by_targets, also = [], {}, collections.defaultdict(list)
        for p in it.parts:
            key = tuple(sorted(p.targets))
            if key and key in by_targets:
                first = by_targets[key]
                if p.name and p.name != first.name:
                    also[id(first)].append(p.name)
                for cid, (i, q) in list(self.cue_item.items()):
                    if q is p:
                        self.cue_item[cid] = (i, first)
                continue
            by_targets[key] = p
            out.append(p)
        for p in out:
            names = list(dict.fromkeys(also[id(p)]))
            if not names:
                continue
            if it.kind == "music" and len(out) == 1:
                p.name = ""  # one part left: the item's name says it
            elif it.kind == "music":
                p.name = " and ".join([p.name] + [n[0].lower() + n[1:] for n in names])
            else:
                more = f"{names[0]}" + (f" and {len(names) - 1} more" if len(names) > 1 else "")
                p.note = (p.note + " " if p.note else "") + f"The same audio also plays for {more}."
        it.parts = out

    # --- views
    def links(self, part: Part) -> list[tuple[str, str]]:
        """The (from, to) music items a transition part plays between, or (over, over) for a stinger: in all of
        the game's rules for every cue merged into the part. Ends in unused music are left out, since that music
        never plays."""
        out = set()
        unused = lambda q: q and q.item and self._section(q.item.section)["unused"]
        live = lambda q: q and q.item and q.item.kind == "music" and not unused(q)
        for cid, (_, q) in self.cue_item.items():
            if q is not part:
                continue
            cue = self.cm.cues[cid]
            for r in cue.get("rules", []):
                fp, tp = [self._place(x) for x in r["from"]], [self._place(x) for x in r["to"]]
                if (fp and all(map(unused, fp))) or (tp and all(map(unused, tp))):
                    continue  # from or into music the game doesn't play
                froms, tos = {x.item.id for x in fp if live(x)}, {x.item.id for x in tp if live(x)}
                out |= {(f, to) for f in froms for to in tos}
                out |= {(f, "") for f in froms if not tos} | {("", to) for to in tos if not froms}
            for s in cue.get("stinger_of", []):
                x = self._place(s["owner"])
                if live(x):
                    out.add((x.item.id, x.item.id))
        return sorted(out)

    def around(self) -> dict[str, list[dict]]:
        """Per music item: the transitions into and out of it and the stingers over it."""
        out = collections.defaultdict(list)
        for it in self.items:
            for p in it.parts:
                for f, to in self.links(p):
                    if p.kind == "stinger":
                        out[f].append({"cue": p.cue, "item": it.id, "way": "over"})
                        continue
                    if f:
                        out[f].append({"cue": p.cue, "item": it.id, "way": "out"})
                    if to:
                        out[to].append({"cue": p.cue, "item": it.id, "way": "in"})
        for k, v in out.items():
            seen, uniq = set(), []
            for a in v:
                if (a["cue"], a["way"]) not in seen:
                    seen.add((a["cue"], a["way"]))
                    uniq.append(a)
            out[k] = uniq
        return out

    def preview(self, it: Item) -> str:
        for p in it.parts:
            long = [t for t in p.targets if self.source_ms.get(t, 0) >= PREVIEW_MS]
            if long:
                return str(long[0])
        best = max(it.targets, key=lambda t: self.source_ms.get(t, 0), default=None)
        return str(best) if best is not None else ""

    def to_json(self) -> dict:
        around = self.around()
        owners = collections.defaultdict(set)
        music = set()  # sources some piece of music plays: a transition's copy of them can't be skipped alone
        for it in self.items:
            for t in it.targets:
                owners[t].add(it.id)
                if it.kind == "music":
                    music.add(t)
        sections = []
        for s in self.sections:
            items = []
            for it in (i for i in self.items if i.section == s["id"]):
                shares = collections.Counter(o for t in it.targets for o in owners[t] if o != it.id)
                items.append({
                    "id": it.id, "name": title(it.name), "full": title(it.full), "about": it.about, "kind": it.kind,
                    "role": it.role,
                    "parts": [{"cue": p.cue, "name": title(p.name), "kind": p.kind,
                               "targets": [str(t) for t in p.targets],
                               "own": [str(t) for t in p.targets if it.kind == "music" or t not in music],
                               "links": [list(x) for x in self.links(p)] if it.kind != "music" else [],
                               "duration_ms": round(p.duration_ms), "note": p.note} for p in it.parts],
                    "targets": [str(t) for t in it.targets],
                    "duration_ms": round(sum(p.duration_ms for p in it.parts)),
                    "preview": self.preview(it), "around": around.get(it.id, []),
                    "shares": [{"item": k, "count": n} for k, n in shares.most_common(4)],
                })
            if items:
                sections.append({"id": s["id"], "name": title(s["name"]), "about": s["about"], "unused": s["unused"],
                                 "items": items})
        return {"sections": sections}

    def label(self, cid) -> str:
        """A cue's name on its own: "Terminid Exploring · Idle", "Terminids: Battle → Exploring"."""
        if cid not in self.cue_item:
            return ""
        it, part = self.cue_item[cid]
        if it.role in ("transitions", "stingers"):  # this cue's own ends, not those of the part it was merged into
            cue = self.cm.cues[cid]
            own = self._bridge_name(cue, it.section) if cue.get("rules") else self._stinger_name(cue, it.section)
            return title(f"{self._section(it.section)['name']}: {own}")
        return title(it.full + (f" · {part.name}" if part.name and len(it.parts) > 1 else ""))
