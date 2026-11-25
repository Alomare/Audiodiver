"""Options for Players: groups of options a player turns on and picks from in the mod manager.

A project has groups (Liberator Fire); a group has options (1, 2, 3). In the mod manager a player ticks a group and
picks one of its options, or leaves the group unticked: then nothing of it is installed. The rest of the project, the
base mod, is always installed.

An option is a sparse layer over the base mod. For each slot it changes it holds a patch (`slots`: {target: patch}),
and it can move the cue points of music segments (`cues`) and add a gain to every slot the base mod changes
(`gain_db`: a Volume Levels group is options with a gain and nothing else). A patch is a partial slot: any of the
replacement's fields (REP_KEYS) and the slot's other settings (EXTRA_KEYS), each standing in for the base mod's;
`"new_audio": false` takes the base mod's new audio away; a patch of None is the slot as the game has it.

A slot belongs to one group at most: the group whose options hold a patch for it. The base mod's gain options leave a
group's slots alone. So an unticked group plays the base mod there, which is the game's own sound unless the base mod
changes that slot too.

resolve() makes the project a set of picks plays ({group id: option id}; a group left out is unticked). The build,
the preview and the Audio tab all go through it, so they agree. capture() is the other way: the Audio tab edits a
resolved project, and capture() puts each slot it changed where it belongs: the option picked in the slot's group, or,
for a slot no group has yet, the group the Audio tab sends new slots to (or the base mod).

Ids are what the mod managers keep a player's pick by: lowercase letters, digits and _ (Obsidian's rule), at most 32
characters. Names are what players see, at most 60 characters (Arsenal's limit)."""
import itertools
import math
import re
from dataclasses import asdict, dataclass, field

ID = re.compile(r"[a-z0-9_]{1,32}")
NAME_MAX = 60
DESCRIPTION_MAX = 500
MAX_GROUPS = 16
MAX_OPTIONS = 16
MAX_COMBOS = 64  # a Helldivers 1 clip several groups change: at most this many sets of their picks
GAIN_RANGE = (-12.0, 12.0)  # an option's gain on the base mod
REP_KEYS = ("audio", "label", "gain_db", "fit_timing", "silence", "fade_in_ms", "fade_out_ms", "start_ms", "end_ms",
            "delay_ms", "blocks", "layers")
EXTRA_KEYS = ("original_gain_db", "lowpass", "highpass", "keep_curve")
EXTRA_DEFAULTS = {"original_gain_db": 0.0, "lowpass": 0, "highpass": 0, "keep_curve": True}
PATCH_KEYS = (*REP_KEYS, *EXTRA_KEYS, "new_audio")
UNCHANGED = object()  # what diff_slot gives for a slot left as it was
BASE = ""  # where new slots go: the base mod
OFF = "off"  # a group off, in Obsidian (a choice of its own there): no option may take this id


@dataclass
class Option:
    id: str
    name: str
    description: str = ""
    image: str = ""  # relative to the project file, like the audio
    gain_db: float = 0.0  # added to every slot the base mod changes
    slots: dict[int, dict | None] = field(default_factory=dict)  # target: patch (JSON form), or None: the game's
    cues: dict[int, dict] = field(default_factory=dict)  # segment: its cue points ({}: the automatic ones)

    def empty(self) -> bool:
        return not (self.slots or self.cues or self.gain_db)


@dataclass
class Group:
    id: str
    name: str
    description: str = ""
    image: str = ""
    options: list[Option] = field(default_factory=list)

    def option(self, oid) -> Option | None:
        return next((o for o in self.options if o.id == oid), None)


class OptionError(ValueError):
    """What can't be done with a group or an option, in words for people."""
    for_people = True


def slug(text: str, taken=(), fallback="option") -> str:
    """An id for a name: lowercase letters, digits and _, unique among `taken` (a number added)."""
    base = re.sub(r"[^a-z0-9]+", "_", str(text).lower()).strip("_")[:28] or fallback
    out, n = base, 2
    while out in taken:
        out, n = f"{base}_{n}", n + 1
    return out


# --- the project file
def _number(v, lo, hi):
    if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v):
        return None
    return max(lo, min(hi, float(v)))


def clean_patch(v, repairs: list, what: str):
    """A slot's patch from the file: None (the game's), or a dict of the keys it may hold, each checked; a value of
    the wrong kind is left out (a repair)."""
    from .project import FADE_MS, FILTER_RANGE, GAIN_DB, TRIM_MS, Project
    if v is None:
        return None
    if not isinstance(v, dict):
        repairs.append(what)
        return {}
    out = {}
    for k, x in v.items():
        if k not in PATCH_KEYS:
            repairs.append(what)
            continue
        if k in ("audio", "label"):
            ok = isinstance(x, str)
        elif k in ("fit_timing", "silence", "keep_curve"):
            ok = isinstance(x, bool)
        elif k == "new_audio":
            ok = x is False
        elif k == "layers":
            from .project import layer_names
            ok, x = isinstance(x, list), layer_names(x)
        elif k == "blocks":
            # the blocks, checked as a project file's: through a one-slot project
            try:
                q = Project.from_json({"name": "x", "replacements": [{"target": "1", "audio": "a.wav", "blocks": x}]})
                x, ok = [asdict(b) for b in q.replacements[0].blocks], isinstance(x, list)
                if q.repairs:
                    repairs.append(what)
            except Exception:  # noqa: BLE001 - anything wrong in them: left out
                ok = False
        else:
            lo, hi = {"gain_db": GAIN_DB, "original_gain_db": GAIN_DB, "lowpass": FILTER_RANGE, "highpass": FILTER_RANGE,
                      "fade_in_ms": FADE_MS, "fade_out_ms": FADE_MS}.get(k, TRIM_MS)
            got = _number(x, lo, hi)
            ok = got is not None
            if ok:
                if got != x:
                    repairs.append(what)
                x = int(round(got)) if k in ("lowpass", "highpass") else got
        if ok:
            out[k] = x
        else:
            repairs.append(what)
    return out


def from_json(v, repairs: list) -> list[Group]:
    """The groups of a project file. Damage is put right where it can be (a repair), and a group or option without a
    usable id or name is left out, as is a slot a second group claims."""
    from .i18n import tr
    if not isinstance(v, list):
        if v is not None:
            repairs.append(tr("the options for players"))
        return []
    out, ids, claimed = [], set(), set()

    def text(d, k, limit):
        x = d.get(k, "")
        return x[:limit] if isinstance(x, str) else ""
    for g in v[:MAX_GROUPS]:
        if not isinstance(g, dict) or not isinstance(g.get("id"), str) or not ID.fullmatch(g["id"]) or g["id"] in ids \
                or not text(g, "name", NAME_MAX).strip():
            repairs.append(tr("the options for players"))
            continue
        what = tr("the group {name}").format(name=g["name"])
        grp = Group(g["id"], text(g, "name", NAME_MAX), text(g, "description", DESCRIPTION_MAX), text(g, "image", 4096))
        oids, mine = set(), set()
        for o in (g.get("options") if isinstance(g.get("options"), list) else [])[:MAX_OPTIONS]:
            if not isinstance(o, dict) or not isinstance(o.get("id"), str) or not ID.fullmatch(o["id"]) \
                    or o["id"] in oids or o["id"] == OFF or not text(o, "name", NAME_MAX).strip():
                repairs.append(what)
                continue
            oids.add(o["id"])
            opt = Option(o["id"], text(o, "name", NAME_MAX), text(o, "description", DESCRIPTION_MAX), text(o, "image", 4096))
            if "gain_db" in o:
                gain = _number(o["gain_db"], *GAIN_RANGE)
                if gain is None or gain != o["gain_db"]:
                    repairs.append(what)
                opt.gain_db = gain or 0.0
            slots = o.get("slots") if isinstance(o.get("slots"), dict) else {}
            for t, patch in slots.items():
                try:
                    t = int(t)
                except (TypeError, ValueError):
                    repairs.append(what)
                    continue
                if t in claimed:  # another group's slot: a slot belongs to one group
                    repairs.append(what)
                    continue
                opt.slots[t] = clean_patch(patch, repairs, what)
                mine.add(t)
            cues = o.get("cues") if isinstance(o.get("cues"), dict) else {}
            for seg, pts in cues.items():
                try:
                    opt.cues[int(seg)] = {k: float(x) for k, x in (pts or {}).items()
                                          if k in ("entry_marker", "exit_marker") and _number(x, 0, 3.6e6) is not None}
                except (TypeError, ValueError, AttributeError):
                    repairs.append(what)
            grp.options.append(opt)
        claimed |= mine
        ids.add(grp.id)
        out.append(grp)
    return out


def to_json(groups: list[Group]) -> list[dict]:
    def option(o: Option):
        return {"id": o.id, "name": o.name, **({"description": o.description} if o.description else {}),
                **({"image": o.image} if o.image else {}), **({"gain_db": o.gain_db} if o.gain_db else {}),
                **({"slots": {str(t): p for t, p in o.slots.items()}} if o.slots else {}),
                **({"cues": {str(s): v for s, v in o.cues.items()}} if o.cues else {})}
    return [{"id": g.id, "name": g.name, **({"description": g.description} if g.description else {}),
             **({"image": g.image} if g.image else {}), "options": [option(o) for o in g.options]} for g in groups]


def files_of(groups: list[Group]) -> list[str]:
    """Every audio file the options name, as stored: they count as the project's files (packs, moves, the
    missing-file check)."""
    out = []
    for g in groups:
        for o in g.options:
            for p in o.slots.values():
                if p:
                    if p.get("audio"):
                        out.append(p["audio"])
                    out += [b["audio"] for b in p.get("blocks") or [] if b.get("audio")]
    return list(dict.fromkeys(out))


def images_of(groups: list[Group]) -> list[str]:
    """Every image the groups and options show, as stored."""
    return list(dict.fromkeys(x for g in groups for x in (g.image, *(o.image for o in g.options)) if x))


# --- what an option does to a project
def _rep_json(r) -> dict:
    return {"audio": r.audio, "label": r.label, "gain_db": r.gain_db, "fit_timing": r.fit_timing, "silence": r.silence,
            "fade_in_ms": r.fade_in_ms, "fade_out_ms": r.fade_out_ms, "start_ms": r.start_ms, "end_ms": r.end_ms,
            "delay_ms": r.delay_ms, "blocks": [asdict(b) for b in r.blocks], "layers": list(r.layers)}


def records(p) -> dict[int, dict]:
    """Every slot the project changes, by target: its replacement's fields (when it has new audio) and the other
    settings (EXTRA_KEYS) that differ from the game's."""
    out: dict[int, dict] = {}
    for r in p.replacements:
        out[r.target] = _rep_json(r)
    for t, db in p.gains.items():
        out.setdefault(t, {})["original_gain_db"] = db
    for t, (low, high) in p.filters.items():
        out.setdefault(t, {}).update(lowpass=low, highpass=high)
    for t in p.curves_off:
        out.setdefault(t, {})["keep_curve"] = False
    return out


def _extras(rec: dict) -> dict:
    return {k: rec.get(k, d) for k, d in EXTRA_DEFAULTS.items()}


def diff_slot(base: dict, view: dict):
    """The patch that makes `base` (a slot as the base mod has it, records()) into `view`: UNCHANGED, None (the
    game's), or a dict of the keys that differ."""
    rep = lambda rec: {k: v for k, v in rec.items() if k not in EXTRA_KEYS}  # noqa: E731
    if rep(base) == rep(view) and _extras(base) == _extras(view):
        return UNCHANGED
    if "audio" not in view and _extras(view) == EXTRA_DEFAULTS:
        return None
    patch = {}
    if "audio" in view and "audio" not in base:
        patch.update({k: view[k] for k in REP_KEYS})
    elif "audio" in base and "audio" not in view:
        patch["new_audio"] = False
    elif "audio" in view:
        patch.update({k: view[k] for k in REP_KEYS if view[k] != base[k]})
    eb, ev = _extras(base), _extras(view)
    patch.update({k: ev[k] for k in EXTRA_KEYS if ev[k] != eb[k]})
    return patch


def apply_patch(p, target: int, patch):
    """An option's patch on one slot of p (changed here)."""
    from .project import Block, Replacement
    r = next((x for x in p.replacements if x.target == target), None)
    if patch is None:
        p.replacements = [x for x in p.replacements if x.target != target]
        p.gains.pop(target, None)
        p.filters.pop(target, None)
        p.curves_off.discard(target)
        return
    if patch.get("new_audio") is False:
        p.replacements = [x for x in p.replacements if x.target != target]
    elif any(k in patch for k in REP_KEYS) and (r or "audio" in patch or patch.get("silence")):
        if not r:  # new audio where the base mod has none
            r = Replacement(target=target, audio="")
            p.replacements.append(r)
        for k in REP_KEYS:
            if k in patch:
                setattr(r, k, [Block(**b) for b in patch[k]] if k == "blocks" else patch[k])
    if "original_gain_db" in patch:
        if patch["original_gain_db"]:
            p.gains[target] = patch["original_gain_db"]
        else:
            p.gains.pop(target, None)
    if "lowpass" in patch or "highpass" in patch:
        low, high = p.filters.get(target, [0, 0])
        kept = [patch.get("lowpass", low), patch.get("highpass", high)]
        if any(kept):
            p.filters[target] = kept
        else:
            p.filters.pop(target, None)
    if "keep_curve" in patch:
        if patch["keep_curve"]:
            p.curves_off.discard(target)
        else:
            p.curves_off.add(target)


def _gain(db):
    from .project import GAIN_DB
    return max(GAIN_DB[0], min(GAIN_DB[1], round(db, 2)))


def owned(groups: list[Group], key=None) -> dict:
    """{sound: the group that has it} for every slot the groups' options change. key(target): the sound a target
    stands for (a stream's file id and an old id are the sound they stand for)."""
    key = key or (lambda t: t)
    return {key(t): g for g in groups for o in g.options for t in o.slots}


def owner_of_cue(groups: list[Group], seg: int) -> Group | None:
    return next((g for g in groups for o in g.options if seg in o.cues), None)


def gain_base(p, db: float, mine: set, key=None):
    """db added to every slot of p the base mod changes, except the groups' (`mine`: their sounds). Entries that
    reach 0 stay, so capture can take the gain off again."""
    key = key or (lambda t: t)
    for r in p.replacements:
        if key(r.target) not in mine:
            r.gain_db = _gain(r.gain_db + db)
    for t in list(p.gains):
        if key(t) not in mine:
            p.gains[t] = _gain(p.gains[t] + db)


def ungain(rec: dict, db: float) -> dict:
    """A slot's record with the base mod's gain db taken off (what gain_base added)."""
    if not db:
        return rec
    rec = dict(rec)
    if "audio" in rec:
        rec["gain_db"] = _gain(rec["gain_db"] - db)
    if "original_gain_db" in rec:
        rec["original_gain_db"] = _gain(rec["original_gain_db"] - db)
    return rec


def copy(p):
    """A project of its own with what p holds (the same file path; never saved: Project.save refuses a view)."""
    from .project import Project
    q = Project.from_json(p.to_json(), p.path)
    q.view = True
    return q


def picked(p, picks: dict) -> list[tuple[Group, Option]]:
    """The (group, option) pairs picks name, in group order; a group not named, or naming no option of it, is off."""
    out = []
    for g in p.groups:
        o = g.option(picks.get(g.id))
        if o is not None:
            out.append((g, o))
    return out


def resolve(p, picks: dict, key=None):
    """The project a set of picks ({group id: option id}) plays: the base mod, each picked option's gain on the base
    mod's slots, then the options' patches. The result has the groups too (a view: never saved)."""
    q = copy(p)
    on = picked(q, picks)
    gain = sum(o.gain_db for _, o in on)
    if gain:
        gain_base(q, gain, set(owned(q.groups, key)), key)
    for _, o in on:
        for t, patch in o.slots.items():
            apply_patch(q, t, patch)
        for seg, pts in o.cues.items():
            if pts:
                q.segment_overrides[seg] = dict(pts)
            else:
                q.segment_overrides.pop(seg, None)
    return q


def capture(real, picks: dict, target, before, after, key=None) -> set[str]:
    """Puts what the Audio tab changed (before and after: resolved projects, before and after the edit) where each
    change belongs (real is changed here). A slot a group has goes into that group's picked option; a slot no group
    has goes to `target`: a group's id (its picked option), BASE (the base mod) or None (not chosen yet: refused).
    A slot whose group is off can't change. Returns the ids of the groups that got slots they didn't have."""
    from .i18n import tr
    key = key or (lambda t: t)
    on = dict((g.id, o) for g, o in picked(real, picks))
    gain = sum(o.gain_db for o in on.values())
    has = owned(real.groups, key)
    base = records(real)
    br, ar = records(before), records(after)
    grown: set[str] = set()

    def where(g, name):
        """The option a change goes into: None for the base mod."""
        if g is None:
            if target is None:
                raise OptionError(tr("Choose where changes to {name} go").format(name=name))
            if target == BASE:
                return None
            g = next((x for x in real.groups if x.id == target), None)
            if g is None or g.id not in on:
                raise OptionError(tr("Pick an option of the group the changes go to first"))
            grown.add(g.id)
        elif g.id not in on:
            raise OptionError(tr("{name} belongs to the group {group}. Edit an option of {group} to change it")
                              .format(name=name, group=g.name))
        return on[g.id]
    # every change placed first, then written: a change that can't go anywhere leaves real as it was
    slots, cues = [], []
    for t in sorted(set(br) | set(ar)):
        now = ar.get(t, {})
        if diff_slot(br.get(t, {}), now) is UNCHANGED:
            continue
        g = has.get(key(t))
        if g is None:
            now = ungain(now, gain)
        slots.append((t, where(g, tr("slot {id}").format(id=key(t))), diff_slot(base.get(t, {}), now)))
    for seg in sorted(set(before.segment_overrides) | set(after.segment_overrides)):
        now = after.segment_overrides.get(seg)
        if before.segment_overrides.get(seg) != now:
            cues.append((seg, where(owner_of_cue(real.groups, seg), tr("the cue points of segment {id}").format(id=seg)), now))
    for t, o, d in slots:
        if o is None:
            if d is not UNCHANGED:
                apply_patch(real, t, d)
            continue
        for old in [x for x in o.slots if key(x) == key(t)]:
            del o.slots[old]
        if d is not UNCHANGED:
            o.slots[t] = d
    for seg, o, now in cues:
        if o is None:
            if now:
                real.segment_overrides[seg] = dict(now)
            else:
                real.segment_overrides.pop(seg, None)
        elif real.segment_overrides.get(seg) == now:
            o.cues.pop(seg, None)
        else:
            o.cues[seg] = dict(now or {})
    return grown


# --- builds
def combos(groups: list[Group], ids) -> list[dict]:
    """Every set of picks over these groups ({group id: option id}; a group off is left out), all off first."""
    chosen = [g for g in groups if g.id in set(ids)]
    out = []
    for pick in itertools.product(*[[None, *g.options] for g in chosen]):
        out.append({g.id: o.id for g, o in zip(chosen, pick) if o is not None})
    return out
