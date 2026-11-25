"""Mod Options: choices a player makes in the mod manager (internal/docs/study-mod-options.md).

A project has options; an option has choices, and the first choice is the default: the project as it is, Main. Every
other choice is a sparse layer over Main. For some slots it says what differs (`slots`: {target: patch}), for many at
once it has rules (`rules`: a gain added, or the original back, on the whole mod or on Library items), and it can move
the cue points of music segments (`cues`). A patch is a partial slot: any of the replacement's fields (REP_KEYS) and
the slot's other settings (EXTRA_KEYS), each standing in for Main's; `"new_audio": false` takes Main's new audio
away; a patch of None is the original as the game has it (no new audio, no gain, no filter, the game's curves).

resolve() makes the project a set of picks plays (Main, then each picked choice's rules, then its patches, in option
order). The build, the preview and the Audio tab all go through it, so they agree. capture() is the other way: the
Audio tab edits a resolved project while a choice is picked (the Editing switch), and capture() keeps what differs
from Main as that choice's patches.

Ids are what the mod managers keep a player's pick by: lowercase letters, digits and _ (Obsidian's rule), at most 32
characters. Names are what players see, at most 60 characters (Arsenal's limit)."""
import itertools
import math
import re
from dataclasses import asdict, dataclass, field

ID = re.compile(r"[a-z0-9_]{1,32}")
NAME_MAX = 60
DESCRIPTION_MAX = 500
MAX_OPTIONS = 16
MAX_CHOICES = 16
MAX_COMBOS = 64  # Combine, and a Helldivers 1 clip several options change: at most this many choices together
REP_KEYS = ("audio", "label", "gain_db", "fit_timing", "silence", "fade_in_ms", "fade_out_ms", "start_ms", "end_ms",
            "delay_ms", "blocks")
EXTRA_KEYS = ("original_gain_db", "lowpass", "highpass", "keep_curve")
EXTRA_DEFAULTS = {"original_gain_db": 0.0, "lowpass": 0, "highpass": 0, "keep_curve": True}
PATCH_KEYS = (*REP_KEYS, *EXTRA_KEYS, "new_audio")
UNCHANGED = object()  # what diff_slot gives for a slot the choice leaves as Main has it


@dataclass
class Rule:
    """A change over many slots: a gain added to their Make-Up Gain, or the original back. items: Library items of
    the project (their slots); none: every slot the project changes."""
    gain_db: float = 0.0
    original: bool = False
    items: list[str] = field(default_factory=list)


@dataclass
class Choice:
    id: str
    name: str
    description: str = ""
    slots: dict[int, dict | None] = field(default_factory=dict)  # target: patch (JSON form), or None: the original
    rules: list[Rule] = field(default_factory=list)
    cues: dict[int, dict] = field(default_factory=dict)  # segment: its cue points ({}: the automatic ones)

    def empty(self) -> bool:
        return not (self.slots or self.rules or self.cues)


@dataclass
class Option:
    id: str
    name: str
    description: str = ""
    choices: list[Choice] = field(default_factory=list)

    def choice(self, cid) -> Choice | None:
        return next((c for c in self.choices if c.id == cid), None)


class OptionError(ValueError):
    """What can't be done with an option, in words for people."""
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
    """A slot's patch from the file: None (the original), or a dict of the keys it may hold, each checked; a value of
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


def from_json(v, repairs: list) -> list[Option]:
    """The options of a project file. Damage is put right where it can be (a repair), and an option or choice
    without a usable id or name is left out."""
    from .i18n import tr
    if not isinstance(v, list):
        if v is not None:
            repairs.append(tr("the options for players"))
        return []
    out, ids = [], set()

    def text(d, k, limit):
        x = d.get(k, "")
        return x[:limit] if isinstance(x, str) else ""
    for o in v[:MAX_OPTIONS]:
        if not isinstance(o, dict) or not isinstance(o.get("id"), str) or not ID.fullmatch(o["id"]) or o["id"] in ids \
                or not text(o, "name", NAME_MAX).strip():
            repairs.append(tr("the options for players"))
            continue
        what = tr("the option {name}").format(name=o["name"])
        opt = Option(o["id"], text(o, "name", NAME_MAX), text(o, "description", DESCRIPTION_MAX))
        cids = set()
        for c in (o.get("choices") if isinstance(o.get("choices"), list) else [])[:MAX_CHOICES]:
            if not isinstance(c, dict) or not isinstance(c.get("id"), str) or not ID.fullmatch(c["id"]) \
                    or c["id"] in cids or not text(c, "name", NAME_MAX).strip():
                repairs.append(what)
                continue
            cids.add(c["id"])
            ch = Choice(c["id"], text(c, "name", NAME_MAX), text(c, "description", DESCRIPTION_MAX))
            slots = c.get("slots") if isinstance(c.get("slots"), dict) else {}
            for t, patch in slots.items():
                try:
                    ch.slots[int(t)] = clean_patch(patch, repairs, what)
                except (TypeError, ValueError):
                    repairs.append(what)
            for r in c.get("rules") if isinstance(c.get("rules"), list) else []:
                if not isinstance(r, dict):
                    repairs.append(what)
                    continue
                gain = _number(r.get("gain_db", 0.0), -12.0, 12.0)
                items = [str(i) for i in r.get("items", []) if isinstance(i, str)] if isinstance(r.get("items"), list) else []
                rule = Rule(gain or 0.0, r.get("original") is True, items)
                if rule.gain_db or rule.original:
                    ch.rules.append(rule)
            cues = c.get("cues") if isinstance(c.get("cues"), dict) else {}
            for seg, pts in cues.items():
                try:
                    ch.cues[int(seg)] = {k: float(x) for k, x in (pts or {}).items()
                                         if k in ("entry_marker", "exit_marker") and _number(x, 0, 3.6e6) is not None}
                except (TypeError, ValueError, AttributeError):
                    repairs.append(what)
            opt.choices.append(ch)
        if not opt.choices:
            repairs.append(what)
            continue
        if not opt.choices[0].empty():  # the first choice is Main: it carries nothing
            opt.choices[0].slots, opt.choices[0].rules, opt.choices[0].cues = {}, [], {}
            repairs.append(what)
        ids.add(opt.id)
        out.append(opt)
    return out


def to_json(options: list[Option]) -> list[dict]:
    def choice(c: Choice):
        return {"id": c.id, "name": c.name, **({"description": c.description} if c.description else {}),
                **({"slots": {str(t): p for t, p in c.slots.items()}} if c.slots else {}),
                **({"rules": [{k: v for k, v in asdict(r).items() if v} for r in c.rules]} if c.rules else {}),
                **({"cues": {str(s): v for s, v in c.cues.items()}} if c.cues else {})}
    return [{"id": o.id, "name": o.name, **({"description": o.description} if o.description else {}),
             "choices": [choice(c) for c in o.choices]} for o in options]


def files_of(options: list[Option]) -> list[str]:
    """Every audio file the choices name, as stored: they count as the project's files (packs, moves, the missing-file
    check)."""
    out = []
    for o in options:
        for c in o.choices:
            for p in c.slots.values():
                if p:
                    if p.get("audio"):
                        out.append(p["audio"])
                    out += [b["audio"] for b in p.get("blocks") or [] if b.get("audio")]
    return list(dict.fromkeys(out))


# --- what a choice does to a project
def _rep_json(r) -> dict:
    return {"audio": r.audio, "label": r.label, "gain_db": r.gain_db, "fit_timing": r.fit_timing, "silence": r.silence,
            "fade_in_ms": r.fade_in_ms, "fade_out_ms": r.fade_out_ms, "start_ms": r.start_ms, "end_ms": r.end_ms,
            "delay_ms": r.delay_ms, "blocks": [asdict(b) for b in r.blocks]}


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
    """The patch that makes `base` (a slot as Main has it, records()) into `view`: UNCHANGED, None (the original), or
    a dict of the keys that differ."""
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
    """A choice's patch on one slot of p (changed here)."""
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
        if not r:  # new audio where Main has none
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


def apply_rule(p, rule: Rule, slots_of=None, key=None):
    """A rule on p (changed here). slots_of(items) gives the sound ids of Library items; key(target) the sound id of
    a target (a stream's file id and an old id are the sound they stand for)."""
    key = key or (lambda t: t)
    inside = set(slots_of(rule.items)) if rule.items and slots_of else None
    if rule.items and inside is None:
        return  # no way to know the items' slots here: the editor always gives one
    hit = (lambda t: True) if inside is None else (lambda t: key(t) in inside)
    if rule.original:
        p.replacements = [r for r in p.replacements if not hit(r.target)]
        p.gains = {t: v for t, v in p.gains.items() if not hit(t)}
        p.filters = {t: v for t, v in p.filters.items() if not hit(t)}
        p.curves_off = {t for t in p.curves_off if not hit(t)}
    if rule.gain_db:
        had = set()
        for r in p.replacements:
            if hit(r.target):
                r.gain_db = _gain(r.gain_db + rule.gain_db)
                had.add(key(r.target))
        for t in list(p.gains):
            if hit(t):
                p.gains[t] = _gain(p.gains[t] + rule.gain_db)
                had.add(key(t))
        for sid in (inside or set()) - had:  # the item's sounds without new audio: louder or quieter as the game has them
            p.gains[sid] = _gain(rule.gain_db)
        p.gains = {t: v for t, v in p.gains.items() if v}


def apply_choice(p, c: Choice, slots_of=None, key=None, patches=True):
    for rule in c.rules:
        apply_rule(p, rule, slots_of, key)
    if patches:
        for t, patch in c.slots.items():
            apply_patch(p, t, patch)
        for seg, pts in c.cues.items():
            if pts:
                p.segment_overrides[seg] = dict(pts)
            else:
                p.segment_overrides.pop(seg, None)


def copy(p):
    """A project of its own with what p holds (the same file path; never saved: Project.save refuses a view)."""
    from .project import Project
    q = Project.from_json(p.to_json(), p.path)
    q.view = True
    return q


def resolve(p, picks: dict, slots_of=None, key=None):
    """The project a set of picks ({option id: choice id}) plays: Main, then each picked choice in option order. An
    option not picked, or at its first choice, is Main. The result has the options too (a view: never saved)."""
    q = copy(p)
    for o in q.options:
        c = o.choice(picks.get(o.id))
        if c is not None and c is not o.choices[0]:
            apply_choice(q, c, slots_of, key)
    return q


def capture(real, option_id: str, choice_id: str, view, slots_of=None, key=None) -> Choice:
    """Keeps what `view` (a resolved project the Audio tab edited while this choice was picked) changes from Main and
    the choice's rules as the choice's patches and cue points (real is changed here). Returns the choice."""
    o = next(x for x in real.options if x.id == option_id)
    c = o.choice(choice_id)
    base = copy(real)
    apply_choice(base, c, slots_of, key, patches=False)
    br, vr = records(base), records(view)
    slots = {}
    for t in sorted(set(br) | set(vr)):
        d = diff_slot(br.get(t, {}), vr.get(t, {}))
        if d is not UNCHANGED:
            slots[t] = d
    cues = {}
    for seg in set(base.segment_overrides) | set(view.segment_overrides):
        if base.segment_overrides.get(seg) != view.segment_overrides.get(seg):
            cues[seg] = dict(view.segment_overrides.get(seg, {}))
    c.slots, c.cues = slots, cues
    return c


def changed_targets(c: Choice) -> set[int]:
    return set(c.slots)


# --- making options
def unique(base: str, taken) -> str:
    return slug(base, set(taken))


def new_option(options: list[Option], name: str, choices: list[tuple[str, list[Rule]]], description="") -> Option:
    """An option with these choices (name, rules), the first the default, with ids made from the names."""
    o = Option(slug(name, {x.id for x in options}), name[:NAME_MAX], description)
    for cname, rules in choices:
        o.choices.append(Choice(slug(cname, {c.id for c in o.choices}, "choice"), cname[:NAME_MAX], rules=rules))
    return o


def combine(options: list[Option], a_id: str, b_id: str, names=None) -> Option:
    """Two options as one: a choice for every pair of their choices, the first pair the default. A pair's rules are
    both choices' rules, and where both change a slot, the second option's patch wins, as it would in game (it
    deploys later). The new option takes the first one's place; the second goes. names: {pair id: name}."""
    a = next(o for o in options if o.id == a_id)
    b = next(o for o in options if o.id == b_id)
    if len(a.choices) * len(b.choices) > MAX_COMBOS:
        raise OptionError(f"{len(a.choices) * len(b.choices)} choices together are too many (at most {MAX_COMBOS})")
    out = Option(a.id, f"{a.name} and {b.name}"[:NAME_MAX], a.description or b.description)
    for ca, cb in itertools.product(a.choices, b.choices):
        cid = slug(f"{ca.id}_{cb.id}", {c.id for c in out.choices}, "choice")
        name = (names or {}).get(cid) or f"{ca.name} · {cb.name}"[:NAME_MAX]
        out.choices.append(Choice(cid, name, rules=[*ca.rules, *cb.rules], slots={**ca.slots, **cb.slots},
                                  cues={**ca.cues, **cb.cues}))
    at = options.index(a)
    options[at] = out
    options.remove(b)
    return out


def combos(options: list[Option], ids) -> list[dict]:
    """Every set of picks over these options ({option id: choice id}), the defaults first."""
    chosen = [o for o in options if o.id in set(ids)]
    return [dict(zip([o.id for o in chosen], [c.id for c in pick]))
            for pick in itertools.product(*[o.choices for o in chosen])]
