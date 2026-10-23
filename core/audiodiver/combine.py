"""Combining mods: several mods' audio in one mod, built once on the game as it is now.

Each mod is read like an import (Session._patch_audio): what it replaces, adds and sets, with the options a player
picked in it. A manifest's Options are offered as HD2 Arsenal offers them: each is on or off, and an Option with
SubOptions has exactly one of them chosen. A mod without a manifest is all its patches, in the order the game loads
them. A mod's parts apply in order, a later one over an earlier one.

The mods' order is their priority: a later mod wins where two differ, as a mod deployed later does. Where two mods
differ is a clash, and only those are listed:

  sound    two mods give one of the game's clips other audio (the same audio in another file isn't a clash);
  clip     two mods give one Sound a clip of its own, with other audio;
  setting  two mods give one setting of one object other values. The settings of an object that plays a clip in a
           clash go with that clip's winner, and aren't listed.

New takes and layers are all kept: two mods' takes in one container are both picked from. Session.combine makes one
project of what wins (Documents\\Audiodiver\\Combined\\<name>) and builds it.
"""
import hashlib
from dataclasses import dataclass, field
from pathlib import PurePosixPath

from .addition import audio_data

# the settings a mod sets most, by prop id (bank v154), for a clash's label
PROP_NAMES = {0x00: "Volume", 0x01: "Pitch", 0x02: "Low-pass filter", 0x03: "High-pass filter", 0x05: "Make-Up Gain",
              0x22: "Initial Delay"}


def prop_name(pid: int) -> str:
    return PROP_NAMES.get(pid, f"Setting {pid}")


def fingerprint(wem: bytes) -> str:
    """What tells a clip's audio from other audio: the same for the same audio in another file (addition.same_audio
    compares the same way)."""
    return hashlib.sha1(audio_data(wem) or wem).hexdigest()


# --- a mod's options
def _folders(entry) -> list[str]:
    inc = entry.get("Include") if isinstance(entry, dict) else None
    return [f.replace("\\", "/").strip("/").lower() for f in inc if isinstance(f, str) and f.strip("/\\ ")] \
        if isinstance(inc, list) else []


def options(manifest: dict) -> list[dict]:
    """A manifest's Options: [{id, name, folders, sub: [{id, name, folders}]}]. An Option's id is its place ("0"), a
    SubOption's its Option's and its own ("1.0")."""
    out = []
    for i, opt in enumerate(o for o in (manifest or {}).get("Options") or [] if isinstance(o, dict)):
        subs = [s for s in opt.get("SubOptions") or [] if isinstance(s, dict)]
        out.append({"id": str(i), "name": str(opt.get("Name") or "").strip() or f"Option {i + 1}",
                    "folders": _folders(opt),
                    "sub": [{"id": f"{i}.{k}", "name": str(s.get("Name") or "").strip() or f"Choice {k + 1}",
                             "folders": _folders(s)} for k, s in enumerate(subs)]})
    return out


def shown(opts: list[dict]) -> list[dict]:
    """The options as the window gets them: ids and names."""
    return [{"id": o["id"], "name": o["name"], "sub": [{"id": s["id"], "name": s["name"]} for s in o["sub"]]}
            for o in opts]


def chosen(opts: list[dict], picks) -> dict[str, str | None]:
    """{Option id: "" (on), a SubOption's id (on, with that one), or None (off)} for picks: the ids of the Options
    that are on, a SubOption's id for an Option with SubOptions (its first, when the Option's own id is given).
    Ids that name nothing are passed over."""
    picks = [str(x) for x in picks or []]
    out = {}
    for o in opts:
        if o["sub"]:
            ids = [s["id"] for s in o["sub"]]
            out[o["id"]] = next((x for x in picks if x in ids), ids[0] if o["id"] in picks else None)
        else:
            out[o["id"]] = "" if o["id"] in picks else None
    return out


def default_picks(opts: list[dict], recorded=None) -> list[str]:
    """What a mod starts with: what HD2 Arsenal recorded as chosen for it (arsenal_picks), else every Option on,
    with its first SubOption."""
    if recorded is not None:
        return recorded
    return [o["sub"][0]["id"] if o["sub"] else o["id"] for o in opts]


def labels(opts: list[dict], picks) -> list[str]:
    """The chosen options by name ("Voices / Loud"), for the combined mod's description."""
    on = chosen(opts, picks)
    out = []
    for o in opts:
        if on[o["id"]] is None:
            continue
        sub = next((s["name"] for s in o["sub"] if s["id"] == on[o["id"]]), "")
        out.append(f"{o['name']} / {sub}" if sub else o["name"])
    return out


def _load_order(key: str):
    return int(key.rsplit("_", 1)[1]), key.lower()


def parts(found, opts: list[dict], picks) -> list[str]:
    """The patches (keys in found, repatch.scan's) the picks deploy, in the order they apply, as HD2 Arsenal 0.37.1
    deploys a mod: the Options in the manifest's order, each one that is on with its own Include folders before its
    chosen SubOption's, and of each folder only the patches right in it (not in its subfolders), by name. A folder
    named twice deploys twice, and its later place is the one that counts. When the picks name no folder (no options,
    every one off, or only empty Includes), Arsenal deploys the patches right in the mod's folder. A mod without a
    manifest: all its patches in the order the game loads them."""
    if not found.manifest_key:
        return sorted((k for p in found.patches for k in p.keys), key=_load_order)
    base = str(PurePosixPath(found.manifest_key).parent)
    base = "" if base == "." else base.lower()
    in_folder = {}  # a folder (as the manifest's Includes name it, from the mod's folder) -> its patches
    for p in found.patches:
        folder = str(PurePosixPath(p.key).parent).lower()
        if not base:
            inner = "" if folder == "." else folder
        elif folder == base:
            inner = ""
        elif folder.startswith(base + "/"):
            inner = folder[len(base) + 1:]
        else:
            continue  # outside the mod's folder: Arsenal never sees it
        in_folder.setdefault(inner, []).extend(p.keys)
    on = chosen(opts, picks)
    folders = []
    for o in opts:
        if on[o["id"]] is not None:
            folders += o["folders"] + next((s["folders"] for s in o["sub"] if s["id"] == on[o["id"]]), [])
    out = [k for f in folders or [""] for k in sorted(in_folder.get(f, []), key=lambda k: PurePosixPath(k).name)]
    return list(reversed(dict.fromkeys(reversed(out))))


# --- what HD2 Arsenal recorded as chosen
_NAME_KEYS = ("name", "label", "title", "id")
_FLAG_KEYS = ("enabled", "selected", "checked", "active", "deployed", "on", "isenabled", "isselected", "ischecked",
              "value", "state")
_SUB_KEYS = ("selectedsuboption", "suboption", "selectedsub", "selected", "choice", "selection", "chosen", "picked",
             "selectedindex", "index")


def _get(d: dict, keys) -> object:
    low = {str(k).lower(): v for k, v in d.items()}
    return next((low[k] for k in keys if k in low), None)


def _sub_pick(o: dict, v) -> str | None:
    """A SubOption of o named by v: its name, its place, or an entry with a flag that says chosen."""
    subs = o["sub"]
    if isinstance(v, bool) or v is None:
        return None
    if isinstance(v, int):
        return subs[v]["id"] if 0 <= v < len(subs) else None
    if isinstance(v, str):
        return next((s["id"] for s in subs if s["name"].casefold() == v.strip().casefold()), None)
    if isinstance(v, list):
        for k, x in enumerate(v):
            if isinstance(x, dict):
                if _get(x, _FLAG_KEYS) is True:
                    name = _get(x, _NAME_KEYS)
                    return (_sub_pick(o, name) if isinstance(name, str) else None) or \
                        (subs[k]["id"] if k < len(subs) else None)
            elif (got := _sub_pick(o, x)) is not None:
                return got
        return None
    if isinstance(v, dict):
        return _sub_pick(o, _get(v, _SUB_KEYS))
    return None


def _subs_in(x: dict, o: dict) -> str | None:
    """The SubOption an entry for the Option o names: under a key about SubOptions, else one about a choice."""
    return next((s for k, val in x.items() if "sub" in str(k).lower() and (s := _sub_pick(o, val)) is not None),
                None) or _sub_pick(o, _get(x, _SUB_KEYS))


def _from_value(v, opts: list[dict]) -> dict[str, str | None] | None:
    """{Option id: "" | SubOption id | None} from one value of Arsenal's entry, or None when it names no option."""
    by_name = {o["name"].casefold(): o for o in opts}
    got = {}

    def pick(o, on, sub=None):
        if not o["sub"]:
            got[o["id"]] = "" if on else None
        else:
            got[o["id"]] = (sub or o["sub"][0]["id"]) if on else None

    if isinstance(v, list):
        for k, x in enumerate(v):
            if isinstance(x, dict):
                name = _get(x, _NAME_KEYS)
                o = by_name.get(name.strip().casefold()) if isinstance(name, str) else None
                if o is None and len(v) == len(opts):
                    o = opts[k]
                if o is None:
                    continue
                pick(o, _get(x, _FLAG_KEYS) is not False, _subs_in(x, o) if o["sub"] else None)
            elif isinstance(x, str):  # the names of the options that are on ("Voices / Loud" for a SubOption)
                head, _, tail = x.partition(" / ")
                o = by_name.get(head.strip().casefold())
                if o is not None:
                    pick(o, True, _sub_pick(o, tail) if tail else None)
        if got:
            return {o["id"]: got.get(o["id"]) for o in opts}  # an option a list of what is on leaves out is off
    elif isinstance(v, dict):
        for name, x in v.items():
            o = by_name.get(str(name).strip().casefold())
            if o is None and str(name).isdigit() and int(name) < len(opts):
                o = opts[int(name)]
            if o is None:
                continue
            if isinstance(x, bool):
                pick(o, x)
            elif isinstance(x, dict):
                pick(o, _get(x, _FLAG_KEYS) is not False, _subs_in(x, o) if o["sub"] else None)
            elif o["sub"] and (s := _sub_pick(o, x)) is not None:
                pick(o, True, s)
        if got:
            return {o["id"]: got.get(o["id"], "" if not o["sub"] else o["sub"][0]["id"]) for o in opts}
    return None


def arsenal_picks(entry: dict, opts: list[dict]) -> list[str] | None:
    """The options HD2 Arsenal's data file records as chosen for a mod (installed.arsenal_entries: its library entry
    with the profile's choice as its options), as picks; None when nothing in the entry can be read as that. The
    file has [{name, enabled, suboptions: [{name, enabled}]}] (seen in Arsenal 0.37's); Arsenal doesn't publish its
    format, so this also reads what other shapes a value under a key about options or choices could take: a list of
    the names that are on, or a map from names to a flag or the chosen SubOption."""
    if not isinstance(entry, dict) or not opts:
        return None
    for k, v in entry.items():
        if any(w in str(k).lower() for w in ("option", "choice", "select", "config")):
            if (got := _from_value(v, opts)) is not None:
                return [s if s else oid for oid, s in got.items() if s is not None]
    return None


# --- reading
@dataclass
class Part:
    """One patch of a mod as Combine keeps it between reading and combining: what it does, the audio decoded into
    WAVs on disk, and fingerprints in place of the audio itself (a music mod's can be hundreds of MB)."""
    replaced: dict = field(default_factory=dict)  # the game's clip -> the fingerprint of its new audio
    takes: list = field(default_factory=list)     # (container, new Sound, new clip, None), as addition.Found has them
    layers: list = field(default_factory=list)    # (layer, the game's container it plays with, its Make-Up Gain)
    own: list = field(default_factory=list)       # (the game's Sound, its new clip, None)
    own_prints: dict = field(default_factory=dict)  # the game's Sound -> the fingerprint of its clip's audio
    settings: dict = field(default_factory=dict)  # {object: {prop: value}}
    left: list = field(default_factory=list)
    stale: set = field(default_factory=set)
    older: set = field(default_factory=set)
    banks: set = field(default_factory=set)
    files: dict = field(default_factory=dict)     # clip -> its WAV (its encoding is cached: build.keep_encoding)
    skipped: int = 0
    texts: int = 0    # string tables in the patch
    rest: int = 0     # other files that aren't audio (models, textures...)
    error: str = ""   # why it couldn't be read


def part_of(got, replaced: dict, files: dict, skipped: int) -> Part:
    """A Part from Session._patch_audio's reading (got: addition.Found)."""
    return Part(replaced={s: fingerprint(w) for s, w in replaced.items() if s in files},
                takes=[(c, s, clip, None) for c, s, clip, _ in got.takes], layers=list(got.layers),
                own=[(s, clip, None) for s, clip, _ in got.own],
                own_prints={s: fingerprint(w) for s, clip, w in got.own if clip in files},
                settings={o: dict(s) for o, s in got.settings.items()}, left=list(got.left), stale=set(got.stale),
                older=set(got.older), banks=set(got.banks), files=dict(files), skipped=skipped)


@dataclass
class Effect:
    """What one mod does over all its parts, a later part over an earlier one."""
    replaced: dict = field(default_factory=dict)  # clip -> (part, fingerprint)
    own: dict = field(default_factory=dict)       # Sound -> (part, clip, fingerprint)
    settings: dict = field(default_factory=dict)  # object -> {prop: (part, value)}


def effect(mod_parts: list[Part]) -> Effect:
    e = Effect()
    for n, pt in enumerate(mod_parts):
        for sid, fp in pt.replaced.items():
            e.replaced[sid] = (n, fp)
        for snd, clip, _ in pt.own:
            if snd in pt.own_prints:
                e.own[snd] = (n, clip, pt.own_prints[snd])
        for oid, s in pt.settings.items():
            for k, v in s.items():
                if v is not None:
                    e.settings.setdefault(oid, {})[k] = (n, v)
    return e


def clashes(effects: list[Effect], plays) -> tuple[list[dict], dict[int, str]]:
    """Where the mods differ: [{id, kind, key (the clip, Sound or (object, prop)), mods (the ones with a version, in
    order)}], and {object: the id of the clash its settings go with}. plays({objects}) -> {object: [the clips it
    plays]} is asked only when a sound or a clip clashes."""
    out = []
    for sid in sorted(set().union(*(e.replaced for e in effects))):
        have = [m for m, e in enumerate(effects) if sid in e.replaced]
        if len({effects[m].replaced[sid][1] for m in have}) > 1:
            out.append({"id": f"sound:{sid}", "kind": "sound", "key": sid, "mods": have})
    for snd in sorted(set().union(*(e.own for e in effects))):
        have = [m for m, e in enumerate(effects) if snd in e.own]
        if len({effects[m].own[snd][2] for m in have}) > 1:
            out.append({"id": f"clip:{snd}", "kind": "clip", "key": snd, "mods": have})
    objects = set().union(*(e.settings for e in effects))
    follows = {}
    if out and objects:
        sounds = {c["key"]: c["id"] for c in out if c["kind"] == "sound"}
        clips = {c["key"]: c["id"] for c in out if c["kind"] == "clip"}
        played = plays(objects)
        for oid in sorted(objects):
            if oid in clips:
                follows[oid] = clips[oid]
            elif (cid := next((sounds[s] for s in played.get(oid, ()) if s in sounds), None)) is not None:
                follows[oid] = cid
    for oid in sorted(objects - set(follows)):
        for prop in sorted(set().union(*(e.settings.get(oid, {}) for e in effects))):
            have = [m for m, e in enumerate(effects) if prop in e.settings.get(oid, {})]
            if len({round(effects[m].settings[oid][prop][1], 4) for m in have}) > 1:
                out.append({"id": f"set:{oid}:{prop}", "kind": "setting", "key": (oid, prop), "mods": have})
    return out, follows


def winners(found: list[dict], chosen_=None) -> dict[str, int]:
    """{clash id: the mod that wins it}: the one chosen (when it has a version), else the last with one."""
    chosen_ = chosen_ or {}
    out = {}
    for c in found:
        pick = chosen_.get(c["id"])
        out[c["id"]] = pick if isinstance(pick, int) and not isinstance(pick, bool) and pick in c["mods"] \
            else c["mods"][-1]
    return out


def outcome(effects: list[Effect], found: list[dict], follows: dict, won: dict[str, int]):
    """What goes into the combined mod: ({clip: (mod, part)}, {Sound: (mod, part)}, {object: {prop: value}},
    {object: the mod its settings are from, or several}). A clip or Sound without a clash goes to the last mod that
    has it (they have the same audio)."""
    clash = {c["id"]: c for c in found}
    clips, own = {}, {}
    for m, e in enumerate(effects):
        for sid, (n, _) in e.replaced.items():
            clips[sid] = (m, n)
        for snd, (n, _, _) in e.own.items():
            own[snd] = (m, n)
    for cid, m in won.items():
        kind, key = clash[cid]["kind"], clash[cid]["key"]
        if kind == "sound":
            clips[key] = (m, effects[m].replaced[key][0])
        elif kind == "clip":
            own[key] = (m, effects[m].own[key][0])
    settings, by = {}, {}
    for oid in sorted(set().union(*(e.settings for e in effects))):
        if oid in follows:
            m = won[follows[oid]]
            if oid in effects[m].settings:
                settings[oid] = {k: v for k, (_, v) in effects[m].settings[oid].items()}
                by.setdefault(oid, set()).add(m)
            continue
        for m, e in enumerate(effects):
            for k, (_, v) in e.settings.get(oid, {}).items():
                if f"set:{oid}:{k}" in won and won[f"set:{oid}:{k}"] != m:
                    continue
                settings.setdefault(oid, {})[k] = v
                by.setdefault(oid, set()).add(m)
    return clips, own, settings, by


def description(mods: list[tuple[str, list[str]]]) -> str:
    """The combined mod's description: the mods it is made of, in order, each with its chosen options."""
    return "Combined from these mods:\n" + "\n".join(
        f"- {name}" + (f" ({', '.join(chosen_)})" if chosen_ else "") for name, chosen_ in mods)
