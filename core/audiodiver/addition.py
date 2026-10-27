"""New audio in the game's banks, on top of what replacing gives: a take added to a sound, a layer that plays with a
sound, and a clip of its own for one sound.

  A take is a new Sound in a random (or sequence) container: the container picks it like the takes it had. It is a
  copy of one of those takes (same bus, position, effects) that plays a new clip.

  A layer is a new container beside one of the game's, with takes of its own, that plays whenever that one plays: a
  switch plays it in the same states (a switch can play several things in one state), a layer container plays it
  with its other children, and every play action of that container gets a twin that plays the layer. A container
  that is one choice of a random container can't have a layer: the layer would be another choice.

  A clip of its own: one Sound plays a new clip, and the other Sounds that played its clip keep it.

Wwise keeps one copy of an object that several loaded banks have (the same id), so a change goes into every bank
with a copy of what it changes, the same way, and new objects go wherever their container is. New audio is held in
the banks (never streamed), so a voice line that streams gets its new clip inside its bank. The new objects copy the
order the game's banks use (children before their parents, child lists sorted by id). Audio settings (Make-Up Gain,
silence) are the replacements' business: patch.patch_bank sets them on the new Sounds like on the game's.

Ids for new objects and clips are 30-bit, like the ids Wwise makes, and none the game uses (index.taken).
"""
import collections
import functools
import json
import secrets
import struct
import zlib
from dataclasses import dataclass, field
from importlib import resources

from . import music
from . import bank as wbank
from .bank import MUSIC_TRACK, SOUND
from .wem import length_ms

ACTION, EVENT, RANSEQ, SWITCH, MIXER, LAYER = 0x03, 0x04, 0x05, 0x06, 0x07, 0x09
CONTAINERS = (RANSEQ, SWITCH, MIXER, LAYER)
PLAY = 0x04          # an action's kind (the high byte of its type)
WEIGHT = 50000       # a playlist item's weight, where there is none to copy (the game's are all this)
BANK = 0             # a source held in the bank
_AFTER_BASE = {RANSEQ: 24, SWITCH: 10, MIXER: 0, LAYER: 0}  # bytes between the base params and the child list
_SWITCH_PARAM = 13   # node id, bits, fade out, fade in (bank v154)


class AdditionError(ValueError):
    """Why an addition can't go into the game as it is now, in words for people."""


def new_id(taken) -> int:
    """A new 30-bit id that isn't in `taken`."""
    while True:
        i = secrets.randbelow(2 ** 30 - 1) + 1
        if i not in taken:
            return i


def derived_id(seed: str, taken) -> int:
    """A 30-bit id made from `seed` (the same every build), and not in `taken`."""
    n = 0
    while True:
        h = 0x811C9DC5
        for c in f"{seed}/{n}".encode():
            h = ((h ^ c) * 0x01000193) & 0xFFFFFFFF
        i = (h >> 30) ^ (h & 0x3FFFFFFF)
        if i and i not in taken:
            return i
        n += 1


# --- the parts of an object a change touches
def base_end(t, body) -> int:
    """Where an object's NodeBaseParams end (a Sound's start after its source, wbank.sound_base)."""
    r = music.Reader(body, wbank.sound_base(body) if t == SOUND else 0)
    music.read_node_base_params(r)
    return r.pos


def base_differs(t, game: bytes, mod: bytes) -> bool:
    """Whether a copy of a node has other NodeBaseParams than the game's, its settings (the prop bundle) aside."""
    aligned = wbank.with_props(t, game, wbank.prop_changes(t, game, mod))
    return aligned[:base_end(t, aligned)] != mod[:base_end(t, mod)]


def audio_data(wem: bytes) -> bytes | None:
    """A .wem's encoded audio (its RIFF data chunk), without the chunks around it; None when it has none."""
    p = 12
    while p + 8 <= len(wem):
        tag, n = wem[p:p + 4], struct.unpack_from("<I", wem, p + 4)[0]
        if tag == b"data":
            return wem[p + 8:p + 8 + n]
        p += 8 + n + (n & 1)
    return None


def same_audio(mod: bytes, game: bytes) -> bool:
    """Whether a mod's clip is the game's own audio in another file: an older game version's (25988413 gave every
    clip a hash chunk), or with other metadata."""
    return mod == game or (data := audio_data(mod)) is not None and data == audio_data(game)


def older_settings(t, game: bytes, mod: bytes) -> bool:
    """Whether a copy's settings are an older game version's, in part at least: it lacks one the game has (mods set,
    they don't take away), or it has other values for the game's mix (anything but wbank.MIX_PROPS)."""
    return any(v is None or k not in wbank.MIX_PROPS for k, v in wbank.prop_changes(t, game, mod).items())


def parent_at(t, body) -> int:
    """Offset of the direct parent id in a Sound's or a container's body."""
    p = (wbank.sound_base(body) if t == SOUND else 0) + 1  # fx override
    n, p = body[p], p + 1
    p += 1 + 6 * n if n else 0             # bypass bits + effects
    p += 1                                  # metadata fx override
    n, p = body[p], p + 1
    return p + 6 * n + 4                   # metadata effects, the output bus


def parent_of(t, body) -> int:
    return struct.unpack_from("<I", body, parent_at(t, body))[0]


def children_at(t, body) -> int:
    return base_end(t, body) + _AFTER_BASE[t]


def children(t, body) -> list[int]:
    return music.Reader(body, children_at(t, body)).ids()


def _with_child(t, body: bytes, child: int) -> bytes:
    """The container with one more child, its list kept in id order."""
    p = children_at(t, body)
    kids = music.Reader(body, p).ids()
    if child in kids:
        return body
    kids = sorted([*kids, child])
    return body[:p] + music.pack_ids(kids) + body[p + 4 + 4 * (len(kids) - 1):]


def playlist(body) -> list[tuple[int, int]]:
    """A random/sequence container's playlist: [(child id, weight)]."""
    r = music.Reader(body, children_at(RANSEQ, body))
    r.ids()
    return [r.take("Ii") for _ in range(r.take("H"))]


def _with_play_item(body: bytes, child: int) -> bytes:
    """The container with the child at the end of its playlist, weighted like the items it has."""
    r = music.Reader(body, children_at(RANSEQ, body))
    r.ids()
    at, n = r.pos, r.take("H")
    items = [r.take("Ii") for _ in range(n)]
    if any(i == child for i, _ in items):
        return body
    weight = items[-1][1] if items else WEIGHT
    items.append((child, weight))
    out = struct.pack("<H", len(items)) + b"".join(struct.pack("<Ii", *i) for i in items)
    return body[:at] + out + body[r.pos:]


def _empty_ranseq(body: bytes, takes: int) -> bytes:
    """A copy of a random/sequence container with no children and an empty playlist. Avoiding repeats is kept below
    the number of takes it will have, so it always has one to pick."""
    p = children_at(RANSEQ, body)
    r = music.Reader(body, p)
    r.ids()
    end = r.pos + 2 + 8 * r.take("H")
    out = bytearray(body[:p] + music.pack_ids([]) + struct.pack("<H", 0) + body[end:])
    avoid_at = base_end(RANSEQ, body) + 18  # loop count, min, max (u16), transition time, min, max (f32)
    avoid = struct.unpack_from("<H", out, avoid_at)[0]
    struct.pack_into("<H", out, avoid_at, min(avoid, max(0, takes - 1)))
    return bytes(out)


def _switch_with(body: bytes, beside: int, new: int) -> bytes:
    """A switch container that plays `new` in every state that plays `beside`, with the same switch settings."""
    body = _with_child(SWITCH, body, new)
    r = music.Reader(body, children_at(SWITCH, body))
    r.ids()
    head, groups = body[:r.pos], []
    for _ in range(r.take("I")):
        state, nodes = r.take("I"), r.ids()
        if beside in nodes and new not in nodes:
            nodes.insert(nodes.index(beside) + 1, new)
        groups.append(struct.pack("<I", state) + music.pack_ids(nodes))
    params = [r.raw(_SWITCH_PARAM) for _ in range(r.take("I"))]
    tail = body[r.pos:]
    ids = [struct.unpack_from("<I", p)[0] for p in params]
    if new not in ids and beside in ids:
        params.append(struct.pack("<I", new) + params[ids.index(beside)][4:])
        params.sort(key=lambda p: struct.unpack_from("<I", p)[0])
    return head + struct.pack("<I", len(groups)) + b"".join(groups) + struct.pack("<I", len(params)) \
        + b"".join(params) + tail


def _var(b: bytes, p: int) -> tuple[int, int]:
    """A Wwise variable-length number (7 bits a byte, the high bit says more follow): (value, offset after it)."""
    v = 0
    while True:
        c, p = b[p], p + 1
        v = (v << 7) | (c & 0x7F)
        if not c & 0x80:
            return v, p


def _pack_var(v: int) -> bytes:
    out = [v & 0x7F]
    while v := v >> 7:
        out.append(0x80 | (v & 0x7F))
    return bytes(reversed(out))


def event_actions(body) -> list[int]:
    n, p = _var(body, 0)
    return list(struct.unpack_from(f"<{n}I", body, p))


def _event_with(body: bytes, action: int) -> bytes:
    ids = event_actions(body)
    if action in ids:
        return body
    ids.append(action)
    return _pack_var(len(ids)) + struct.pack(f"<{len(ids)}I", *ids)


def play_target(body) -> int | None:
    """The object a Play action plays, None for any other action."""
    kind, target = struct.unpack_from("<HI", body)
    return target if kind >> 8 == PLAY else None


def _sound_playing(template: bytes, parent: int, source: int, wem: bytes) -> bytes:
    """A copy of a Sound that plays `source` (held in the bank) and hangs from `parent`."""
    body = bytearray(template)
    plugin, _stype, _sid, _cache, _mem, bits = wbank.SOURCE.unpack_from(body, 0)
    wbank.SOURCE.pack_into(body, 0, plugin, BANK, source, zlib.crc32(wem), len(wem), bits)
    struct.pack_into("<I", body, parent_at(SOUND, body), parent)
    return bytes(body)


def _rewired(body: bytes, source: int, wem: bytes) -> bytes:
    body = bytearray(body)
    plugin, _stype, _sid, _cache, _mem, bits = wbank.SOURCE.unpack_from(body, 0)
    wbank.SOURCE.pack_into(body, 0, plugin, BANK, source, zlib.crc32(wem), len(wem), bits)
    return bytes(body)


def is_audio(body) -> bool:
    """A Sound that plays a clip (not a generator: a tone, silence)."""
    return wbank.SOURCE.unpack_from(body, 0)[0] & 0xF == 1


# --- what the editor asks before it adds something
def read(ix, oid) -> tuple[dict, tuple[int, bytes]] | None:
    """(the objects of the first bank with a copy of it, its (type, body)); None when the game has none."""
    for bid in ix.copies(oid)[:1]:
        objects = wbank.parse(ix.bank_files(bid)[0])[1]
        return objects, objects[oid]
    return None


def sound_clip(ix, oid) -> int | None:
    """The clip a Sound of the game plays; None for a generator or no such Sound."""
    found = read(ix, oid)
    if not found or found[1][0] != SOUND or not is_audio(found[1][1]):
        return None
    return wbank.SOURCE.unpack_from(found[1][1], 0)[2]


def first_clip(ix, oid) -> int | None:
    """The clip a Sound plays, or the first take below a container plays."""
    found = read(ix, oid)
    if not found:
        return None
    objects, (t, body) = found
    if t == SOUND:
        return sound_clip(ix, oid)
    parent = {o: parent_of(tt, b) for o, (tt, b) in objects.items()
              if tt in CONTAINERS or (tt == SOUND and is_audio(b))}
    for o, (tt, b) in objects.items():
        if tt != SOUND or o not in parent:
            continue
        cur, seen = parent[o], set()
        while cur and cur not in seen:
            if cur == oid:
                return wbank.SOURCE.unpack_from(b, 0)[2]
            seen.add(cur)
            cur = parent.get(cur)
    return None


def take_problem(ix, oid) -> str | None:
    """Why the game's container can't have a new take, or None."""
    found = read(ix, oid)
    if not found or found[1][0] != RANSEQ:
        return "Only a sound with takes the game picks from can have a new take"
    objects = found[0]
    if not any(t == SOUND and is_audio(b) and parent_of(SOUND, b) == oid for t, b in objects.values()):
        return "This sound has no take to copy"
    return None


def layer_problem(ix, oid) -> str | None:
    """Why the game's container can't have a layer beside it, or None."""
    if why := take_problem(ix, oid):
        return why.replace("a new take", "a layer")
    objects, (_t, body) = read(ix, oid)
    parent = parent_of(RANSEQ, body)
    ptype = next((wbank.parse(ix.bank_files(b)[0])[1][parent][0] for b in ix.copies(parent)[:1]), None)
    if ptype == RANSEQ:
        return "This sound is one of the random choices of another sound, so a layer would only add another choice"
    if ptype not in (SWITCH, LAYER) and not any(t == ACTION and play_target(b) == oid for t, b in objects.values()):
        return "Nothing plays this sound directly, so a layer beside it would never play"
    return None


# --- what a project adds, at build time
@dataclass
class Take:
    to: int        # the container it is a take of: the game's, or a new layer's
    sound: int     # the new Sound's id
    source: int    # the new clip's id
    wem: bytes


@dataclass
class Layer:
    id: int        # the new container's id
    beside: int    # the game's container it plays with


@dataclass
class Own:
    sound: int     # the game's Sound that gets a clip of its own
    source: int
    wem: bytes


@dataclass
class BankPlan:
    layers: list = field(default_factory=list)   # [(Layer, the parent it hangs from, its parent's type or None)]
    takes: list = field(default_factory=list)    # [Take]
    own: list = field(default_factory=list)      # [Own]
    actions: list = field(default_factory=list)  # [(layer id, the action it copies, the new action's id)]
    added: set = field(default_factory=set)      # the new objects' ids
    changed: set = field(default_factory=set)    # the game's objects that change
    media: dict = field(default_factory=dict)    # the new clips: {id: wem}


@dataclass
class Plan:
    banks: dict = field(default_factory=dict)      # bank id -> BankPlan
    bodies: dict = field(default_factory=dict)     # a layer's id -> the body of what it plays with (one copy)
    templates: dict = field(default_factory=dict)  # a container's id (a layer's too) -> a take of it to copy

    def __bool__(self):
        return bool(self.banks)


def plan(ix, takes: list[Take], layers: list[Layer], own: list[Own], taken=frozenset(), keep=None) -> Plan:
    """Which banks get what. ix is the AudioIndex; `taken` adds the ids the project uses to the game's, so the new
    actions' ids clash with neither. Each addition goes into every bank with a copy of what it hangs from, or into
    those `keep` keeps of them (build.own_banks). AdditionError when the game no longer has what an addition hangs
    from."""
    out, parsed = Plan(), {}
    keep = keep or list

    def objects(bid):
        if bid not in parsed:
            parsed[bid] = wbank.parse(ix.bank_files(bid)[0])[1]
        return parsed[bid]

    def at(bid) -> BankPlan:
        return out.banks.setdefault(bid, BankPlan())

    def first(oid, kind, what):
        """(the banks with a copy of it, its body in the first)."""
        banks = ix.copies(oid)
        if not banks or objects(banks[0]).get(oid, (None,))[0] != kind:
            raise AdditionError(f"{what} {oid} isn't in this version of the game")
        return banks, objects(banks[0])[oid][1]

    def template(container, banks):
        for bid in banks:
            for t, body in objects(bid).values():
                if t == SOUND and is_audio(body) and parent_of(SOUND, body) == container:
                    return body
        raise AdditionError(f"Container {container} has no take to copy")

    layer_banks = {}
    for lay in layers:
        banks, body = first(lay.beside, RANSEQ, "Container")
        parent = parent_of(RANSEQ, body)
        ptype = next((objects(b)[parent][0] for b in ix.copies(parent)), None)
        if ptype == RANSEQ:
            raise AdditionError(f"Container {lay.beside} is one of the choices of a random container, so a layer beside it "
                                f"would only be another choice")
        out.bodies[lay.id], out.templates[lay.id] = body, template(lay.beside, banks)
        if ptype in (SWITCH, LAYER):
            banks = sorted(set(banks) | set(ix.copies(parent)))
        banks = keep(banks)
        layer_banks[lay.id], twins = banks, 0
        for bid in banks:
            here = at(bid)
            here.layers.append((lay, parent, ptype))
            here.added.add(lay.id)
            if ptype in (SWITCH, LAYER, MIXER) and parent in objects(bid):
                here.changed.add(parent)
            for oid, (t, b) in objects(bid).items():  # every play action of the container gets a twin
                if t == ACTION and play_target(b) == lay.beside:
                    events = [e for e, (et, eb) in objects(bid).items() if et == EVENT and oid in event_actions(eb)]
                    if events:
                        twin = derived_id(f"{lay.id}:{oid}", ix.taken | taken)
                        here.actions.append((lay.id, oid, twin))
                        here.added.add(twin)
                        here.changed.update(events)
                        twins += 1
        if ptype not in (SWITCH, LAYER) and not twins:
            raise AdditionError(f"Nothing plays container {lay.beside} straight from an event, so a layer beside it "
                                f"would never play")
    for take in takes:
        if take.to in layer_banks:
            banks = layer_banks[take.to]
        else:
            banks = first(take.to, RANSEQ, "Container")[0]
            out.templates.setdefault(take.to, template(take.to, banks))
            banks = keep(banks)
            for bid in banks:
                at(bid).changed.add(take.to)
        for bid in banks:
            here = at(bid)
            here.takes.append(take)
            here.added.add(take.sound)
            here.media[take.source] = take.wem
    for o in own:
        banks, body = first(o.sound, SOUND, "Sound")
        if not is_audio(body):
            raise AdditionError(f"Sound {o.sound} plays no clip")
        for bid in keep(banks):
            here = at(bid)
            here.own.append(o)
            here.changed.add(o.sound)
            here.media[o.source] = o.wem
    for here in out.banks.values():
        for lay, _p, _pt in here.layers:
            if not any(t.to == lay.id for t in here.takes):
                raise AdditionError(f"Layer {lay.id} has no takes")
    return out


def apply(bank: bytes, here: BankPlan, p: Plan) -> bytes:
    """The bank with what the plan adds to it: new objects, the game's objects that take them in, the new clips."""
    chunks = wbank.chunks(bank)
    hirc = next((c for c in chunks if c[0] == b"HIRC"), None)
    if hirc is None:
        raise AdditionError("a bank without objects")
    entries = [[t, oid, bytes(b)] for t, oid, b in music.iter_hirc(hirc[1])]
    where = lambda oid: next((i for i, e in enumerate(entries) if e[1] == oid), None)
    has = lambda oid: where(oid) is not None
    body_of = lambda oid: entries[where(oid)][2]

    def put(oid, new):
        entries[where(oid)][2] = new

    def insert(before, t, oid, body):
        """A new object, just before the one it belongs to (last, when that isn't here)."""
        i = where(before)
        entries.insert(len(entries) if i is None else i, [t, oid, body])

    # layers: a copy of the container they play with, hanging from the same parent
    for lay, parent, ptype in here.layers:
        src = body_of(lay.beside) if has(lay.beside) else p.bodies[lay.id]
        takes = sum(t.to == lay.id for t in here.takes)
        insert(parent if has(parent) else lay.beside, RANSEQ, lay.id, _empty_ranseq(src, takes))
        if has(parent):
            if ptype == SWITCH:
                put(parent, _switch_with(body_of(parent), lay.beside, lay.id))
            elif ptype in (LAYER, MIXER):
                put(parent, _with_child(ptype, body_of(parent), lay.id))
    for lay_id, action, twin in here.actions:
        body = bytearray(body_of(action))
        struct.pack_into("<I", body, 2, lay_id)
        for t, oid, b in list(entries):
            if t == EVENT and action in event_actions(b):
                put(oid, _event_with(b, twin))
                if not has(twin):
                    insert(oid, ACTION, twin, bytes(body))
    # takes: a copy of one of the container's takes (a layer's copy one of the takes of what it plays with)
    for take in here.takes:
        lay = next((lay for lay, _p, _pt in here.layers if lay.id == take.to), None)
        template = _template(entries, lay.beside if lay else take.to) or p.templates[take.to]
        insert(take.to, SOUND, take.sound, _sound_playing(template, take.to, take.source, take.wem))
        put(take.to, _with_play_item(_with_child(RANSEQ, body_of(take.to), take.sound), take.sound))
    for o in here.own:
        put(o.sound, _rewired(body_of(o.sound), o.source, o.wem))

    hirc[1] = struct.pack("<I", len(entries)) + b"".join(struct.pack("<BII", t, 4 + len(b), oid) + b
                                                         for t, oid, b in entries)
    if here.media:
        _add_media(chunks, here.media)
    return b"".join(t + struct.pack("<I", len(b)) + b for t, b in chunks)


def _template(entries, container) -> bytes | None:
    """The body of the first take of a container (here) that plays a clip, to copy a new take from."""
    for t, _oid, body in entries:
        if t == SOUND and is_audio(body) and parent_of(SOUND, body) == container:
            return bytes(body)
    return None


def _add_media(chunks, media: dict[int, bytes]):
    """New clips at the end of DIDX/DATA, aligned the way the bank aligns its own (made after BKHD when it has none)."""
    didx = next((c for c in chunks if c[0] == b"DIDX"), None)
    data = next((c for c in chunks if c[0] == b"DATA"), None)
    if didx is None or data is None:
        didx, data = [b"DIDX", b""], [b"DATA", b""]
        at = next((i + 1 for i, c in enumerate(chunks) if c[0] == b"BKHD"), 0)
        chunks[at:at] = [didx, data]
    rows = [struct.unpack_from("<III", didx[1], i) for i in range(0, len(didx[1]), 12)]
    align = 16 if all(off % 16 == 0 for _, off, _ in rows) else 1
    have = {sid for sid, _, _ in rows}
    buf, out = bytearray(data[1]), bytearray(didx[1])
    for sid, wem in media.items():
        if sid in have:
            continue
        off = (len(buf) + align - 1) // align * align
        buf += bytes(off - len(buf)) + wem
        out += struct.pack("<III", sid, off, len(wem))
    didx[1], data[1] = bytes(out), bytes(buf)


def check(patched: tuple, vanilla: tuple, here: BankPlan) -> list[str]:
    """Problems with one patched bank against its plan (patched, vanilla: wbank.parse results): exactly the planned
    objects are new, each new one is where it belongs (a take in its container's list and playlist, a layer in its
    parent and the events that play what it is beside), and every new clip is held whole."""
    (media, hirc), (_vm, v_hirc) = patched, vanilla
    problems = []
    added = set(hirc) - set(v_hirc)
    if added != here.added:
        problems.append(f"new objects {sorted(added - here.added)[:5]} unplanned, "
                        f"{sorted(here.added - added)[:5]} missing")
    for lay, parent, ptype in here.layers:
        if hirc.get(lay.id, (None,))[0] != RANSEQ:
            problems.append(f"layer {lay.id} isn't a container")
        elif ptype in (SWITCH, LAYER, MIXER) and parent in hirc and lay.id not in children(ptype, hirc[parent][1]):
            problems.append(f"layer {lay.id} isn't a child of {parent}")
    for lay_id, _action, twin in here.actions:
        t, body = hirc.get(twin, (None, b""))
        if t != ACTION or play_target(body) != lay_id:
            problems.append(f"action {twin} doesn't play layer {lay_id}")
    for take in here.takes:
        t, body = hirc.get(take.sound, (None, b""))
        if t != SOUND or wbank.SOURCE.unpack_from(body, 0)[2] != take.source or parent_of(SOUND, body) != take.to:
            problems.append(f"take {take.sound} isn't a Sound of container {take.to} playing clip {take.source}")
            continue
        ct, cb = hirc.get(take.to, (None, b""))
        if ct != RANSEQ or take.sound not in children(RANSEQ, cb) or take.sound not in dict(playlist(cb)):
            problems.append(f"take {take.sound} isn't in container {take.to}'s list and playlist")
    for o in here.own:
        t, body = hirc.get(o.sound, (None, b""))
        if t != SOUND or wbank.SOURCE.unpack_from(body, 0)[2] != o.source:
            problems.append(f"Sound {o.sound} doesn't play the clip {o.source} made for it")
    for sid, wem in here.media.items():
        if media.get(sid) != wem:
            problems.append(f"new clip {sid} isn't held whole")
    return problems


# --- a mod's patch, read back as additions (patches Unwise, wwise-teller's tool, writes: whole banks, the new audio
# held in them)
def get_prop(t, body, pid: int) -> float | None:
    """One float property of a Sound's or a container's prop bundle, None when it isn't set."""
    return wbank.props(t, body).get(pid)


@dataclass
class Found:
    """What a patch adds, as Audiodiver's additions, and what it replaces. Each clip with its audio (a .wem)."""
    replaced: dict = field(default_factory=dict)  # the game's clip -> its new audio
    takes: list = field(default_factory=list)     # (container, new Sound, new clip, wem): the game's container or a layer's
    layers: list = field(default_factory=list)    # (layer id, the game's container it plays with, its Make-Up Gain over that one's)
    own: list = field(default_factory=list)       # (the game's Sound, its new clip, wem)
    settings: dict = field(default_factory=dict)  # {the game's object: {prop id: the mod's value, or None}} (Project.settings)
    left: list = field(default_factory=list)      # what can't be brought in, in words for people
    stale: set = field(default_factory=set)       # the game's Sounds of an older version that the mod's copies still have
    older: set = field(default_factory=set)       # the game's objects (and clips) that the mod's copies have as an older version had them
    merged: set = field(default_factory=set)      # the game's objects whose copy is another bank's (a merging tool's)
    banks: set = field(default_factory=set)       # the game's banks the patch has (Project.imported_banks)
    cues: dict = field(default_factory=dict)      # {segment: (its cue points, the new audio's clips it plays)} (cue_points)


NO_HISTORY = (frozenset(), frozenset(), {})
CUE_TOLERANCE_MS = 1.0  # a cue point this close to where a build puts it is the build's own


def cue_points(d: dict, replaced: dict[int, bytes]) -> dict[int, tuple[dict, frozenset]]:
    """The cue points a patch (patch.diff) gives the music segments that play its new audio ({the game's clip:
    wem}): {segment: ({"entry_marker", "exit_marker"} where they aren't where a build puts them, the clips of new
    audio it plays)}. A build puts the Entry at 0 and the Exit where the longest new audio of the segment's tracks
    ends, so an empty dict is a segment that has those. Cue points a build can't take (past that end, an Entry after
    the Exit) are left out. Of a segment's copies in several banks, the cue points most of them have that differ
    from a build's: a tool may have changed one bank's copy only."""
    lengths = {sid: ms for sid, w in replaced.items() if (ms := length_ms(w))}
    found = collections.defaultdict(list)  # segment -> [(cue points, clips)], one per copy
    for b in d["banks"].values():
        hirc = b["read"][0][1]
        for i, (t, body) in hirc.items():
            if t != wbank.MUSIC_SEGMENT:
                continue
            try:
                seg = music.MusicSegment.read(i, music.Reader(body))
            except (struct.error, IndexError, ValueError):
                continue
            clips = {s for c in seg.node.children if hirc.get(c, (None,))[0] == MUSIC_TRACK
                     for s in wbank.source_ids(MUSIC_TRACK, hirc[c][1]) if s in lengths}
            if not clips:
                continue
            end, cues = max(lengths[s] for s in clips), {}
            entry, exit_ = seg.cue(music.ENTRY_CUE), seg.cue(music.EXIT_CUE)
            if entry is not None and abs(entry) > CUE_TOLERANCE_MS:
                cues["entry_marker"] = round(entry, 3)
            if exit_ is not None and abs(exit_ - end) > CUE_TOLERANCE_MS:
                cues["exit_marker"] = round(exit_, 3)
            if not 0 <= cues.get("entry_marker", 0.0) < cues.get("exit_marker", end) <= end + CUE_TOLERANCE_MS:
                cues = {}
            found[i].append((cues, frozenset(clips)))
    out = {}
    for i, copies in found.items():
        tally = collections.Counter(tuple(sorted(c.items())) for c, _ in copies if c)
        out[i] = (dict(tally.most_common(1)[0][0]) if tally else {}, frozenset().union(*(c for _, c in copies)))
    return out


@functools.cache
def bank_history() -> dict[int, tuple[frozenset, frozenset, dict]]:
    """{bank: (object ids earlier game versions had and this one doesn't, ids this one has and they didn't, {an
    object this one has otherwise: the fingerprints it had in them})}, from data/bank_history.json
    (tools/import_bank_history.py)."""
    d = json.loads(resources.files("audiodiver").joinpath("data", "bank_history.json").read_text(encoding="utf-8"))
    return {int(k): (frozenset(v["gone"]), frozenset(v["new"]), {int(i): frozenset(f) for i, f in v.get("changed", {}).items()})
            for k, v in d["banks"].items()}


def older_version(ix, bid, hirc, added) -> set[int]:
    """Of the objects a mod's copy of a bank has and the game's doesn't, those that are the game's own from an
    older version: the patch holds whole banks as they were when the mod was made, and an update since took them
    out. An object an earlier version had (bank_history); a Sound that plays a clip the game has (a mod's new Sound
    plays new audio: covers versions the history doesn't know); and a random container whose Sounds are all of
    these."""
    gone = bank_history().get(bid, NO_HISTORY)[0]
    out = {i for i in added if i in gone}
    out |= {i for i in added if hirc[i][0] == SOUND and is_audio(hirc[i][1])
            and ((sid := wbank.SOURCE.unpack_from(hirc[i][1], 0)[2]) in ix.holders or sid in ix.users)}
    for n in added:
        if hirc[n][0] == RANSEQ and n not in out:
            kids = [i for i in added if hirc[i][0] == SOUND and parent_of(SOUND, hirc[i][1]) == n]
            if kids and all(k in out for k in kids):
                out.add(n)
    return out


def _likeness(a: bytes, b: bytes) -> int:
    """How alike two containers' base params are, leaving out the prop bundles (Unwise sets props on its copy)."""
    def rest(body):
        start = parent_at(RANSEQ, body) + 5
        r = music.Reader(body, 0)
        music.read_node_base_params(r)
        return body[:start] + body[start + 1 + 5 * body[start]:r.pos]
    x, y = rest(a), rest(b)
    return sum(p == q for p, q in zip(x, y)) - abs(len(x) - len(y))


def _beside(n, hirc, vanilla, added) -> list[int]:
    """The game's containers a new container may play with, likeliest first. Unwise copies a container of the game
    (its "reference") into the new one, and a play action of an event into an action that plays it: so the
    candidates are what the event's actions like the copied one play (or a switch plays in the new one's states, or
    the layer container it is in has), the one most like the new container first."""
    found = []
    for a in added:
        t, body = hirc[a]
        if t != ACTION or play_target(body) != n:
            continue
        for e, (et, eb) in hirc.items():
            if et != EVENT or a not in event_actions(eb) or e not in vanilla:
                continue
            olds = [vanilla[o][1] for o in event_actions(vanilla[e][1]) if vanilla.get(o, (None,))[0] == ACTION]
            plays = [o for o in olds if play_target(o) is not None]
            same = [o for o in plays if o[:2] + o[6:] == body[:2] + body[6:]]  # the copied action's twins
            found += [play_target(o) for o in (same or plays)]
    parent = parent_of(RANSEQ, hirc[n][1])
    ptype, pbody = hirc.get(parent, (None, b""))
    if ptype == SWITCH:
        r = music.Reader(pbody, children_at(SWITCH, pbody))
        r.ids()
        for _ in range(r.take("I")):
            r.take("I")
            nodes = r.ids()
            if n in nodes:
                found += [c for c in nodes if c != n]
    if ptype == LAYER and parent in vanilla:
        found += children(LAYER, vanilla[parent][1])
    found = [c for c in dict.fromkeys(found) if vanilla.get(c, (None,))[0] == RANSEQ]
    return sorted(found, key=lambda c: (parent_of(RANSEQ, vanilla[c][1]) != parent,
                                        -_likeness(hirc[n][1], vanilla[c][1])))


def _timing_only(game_body, body) -> bool:
    """A music segment that differs from the game's only in its length and where its cue points are."""
    try:
        a, b = (music.MusicSegment.read(0, music.Reader(x)) for x in (game_body, body))
    except (struct.error, IndexError, ValueError):
        return False
    return a.node.to_bytes() == b.node.to_bytes() and [(i, n) for i, _, n in a.markers] == [(i, n) for i, _, n in b.markers]


def from_patch(ix, d: dict) -> Found:
    """The additions and replacements in a patch, from patch.diff(): new Sounds in the game's random containers are
    new takes; a new random container with new Sounds, played with one of the game's, is a layer beside it; a
    Sound of the game that plays a clip it didn't is a clip of its own; new audio for one of the game's clips is a
    replacement. The same addition in several banks counts once. Settings the mod changes on the game's objects (a
    Sound's, a container's or a MusicTrack's prop bundle: Make-Up Gain, delays, sends...) are `settings`. What
    doesn't map (other changes, objects of other kinds) is said in `left`. A patch made for an older game version
    still has the game's objects of that version: those aren't the mod's (older_version), its Sounds are counted in
    `stale`, the objects the game added since aren't ones the mod took out, nor the settings it added ones the mod
    took away, and an object exactly as an earlier version had it (bank_history's fingerprints), under another parent
    or an actor-mixer with other base params (base_differs) isn't one the mod changed (`older`), and neither is a
    clip with the game's own audio in another file (same_audio). Of the settings, only those a mod sets are its
    (wbank.MIX_PROPS), and none of a shared copy that lacks one of the game's. A copy that is another bank's, as the
    game has it there now or had it, is a merging tool's (`merged`)."""
    out, seen, same = Found(banks=set(d["banks"])), set(), set()  # same: the game's clips the mod's banks hold in an older file
    game = lambda sid: sid in ix.holders or sid in ix.users
    read = {}

    def game_hirc(bid):  # another bank's objects, read once
        if bid not in read:
            read[bid] = wbank.parse(ix.bank_files(bid)[0])[1]
        return read[bid]

    out.left += [f"bank {bid}, which this version of the game doesn't have" for bid in d.get("unknown", [])]
    # the game's clips the patch has audio for, in a bank or streamed, known before any bank is read: a music track
    # in one bank can play a clip that another bank or the stream replaces
    new_audio = {m for b in d["banks"].values() for m in b["media"] if m in b["read"][1][0] and game(m)}
    for fid in d.get("streams", ()):
        try:
            new_audio.add(ix.resolve(fid))
        except KeyError:
            pass
    for bid, b in d["banks"].items():
        (media, hirc), (vmedia, vanilla) = b["read"]
        older = older_version(ix, bid, hirc, b["added"])
        out.stale |= {i for i in older if hirc[i][0] == SOUND}
        added = set(b["added"]) - older
        before = bank_history().get(bid, NO_HISTORY)[2]
        # an object exactly as an earlier game version had it: the mod's copy is that version's, not a change of the
        # mod's (no settings either: the game changed them since)
        as_was = {i for _, i in b["objects"] if wbank.fingerprint(*hirc[i]) in before.get(i, ())}
        # one of the game's objects under another parent than today's: mods don't move the game's objects, updates
        # do, so the copy is an older version's (covers versions the history has no fingerprints of)
        as_was |= {i for _, i in b["objects"] if i in vanilla and (t := hirc[i][0]) == vanilla[i][0]
                   and t in (SOUND, *CONTAINERS) and parent_of(t, hirc[i][1]) != parent_of(t, vanilla[i][1])}
        # an actor-mixer whose base params differ beyond its settings (curves, effects, positioning): the game's
        # shared parents (one is in every weapon bank) change so in updates, and mods set at most their settings. Its
        # settings are that version's too: carried onto today's, a stale one can mute what plays under it
        as_was |= {i for _, i in b["objects"] if hirc[i][0] == MIXER and i in vanilla
                   and base_differs(MIXER, vanilla[i][1], hirc[i][1])}
        # another bank's copy: a tool that merges the copies of an object writes one bank's into the others, where the
        # game's differs (a Play action names its own bank, a container lists the children that bank has, a copy has
        # other settings), now or as an earlier version had it there. The mod didn't change it, and the bank's own
        # copy is used. (An object in more banks is a shared parent, which the checks above cover.)
        merged = {i for _, i in b["objects"] if i in vanilla and i not in as_was and 1 < len(ix.copies(i)) <= 24
                  and any(hirc[i] == game_hirc(c).get(i) or wbank.fingerprint(*hirc[i])
                          in bank_history().get(c, NO_HISTORY)[2].get(i, ()) for c in ix.copies(i) if c != bid)}
        out.merged |= merged
        as_was |= merged
        audio = lambda sid: media.get(sid) if sid in media else (ix.wem(sid) if game(sid) else None)
        for m in b["media"]:
            if m in vmedia and game(m):
                if same_audio(media[m], vmedia[m]):  # the game's clip in an older file: not the mod's audio
                    out.older.add(m)
                    same.add(m)
                else:
                    out.replaced.setdefault(m, media[m])
        explained = added | older | as_was
        new_cntr = {i for i in added if hirc[i][0] == RANSEQ}
        layer_takes = {n: [] for n in new_cntr}
        for i in sorted(added):
            t, body = hirc[i]
            if t != SOUND or not is_audio(body):
                continue
            sid, parent = wbank.SOURCE.unpack_from(body, 0)[2], parent_of(SOUND, body)
            wem = audio(sid)
            if wem is None:
                out.left.append(f"A new sound ({i}) has no audio in the patch")
            elif parent in new_cntr:
                layer_takes[parent].append((i, sid, wem))
            elif vanilla.get(parent, (None,))[0] == RANSEQ:
                explained.add(parent)
                if i not in seen:
                    seen.add(i)
                    out.takes.append((parent, i, sid, wem))
            else:
                out.left.append(f"A new sound ({i}) is in a place where Audiodiver can't add a take (under object {parent})")
        for n in sorted(new_cntr):
            candidates = _beside(n, hirc, vanilla, added)
            why = "Audiodiver can't tell which sound it plays with"
            beside = next((c for c in candidates if not layer_problem(ix, c)), None)
            if candidates and beside is None:
                why = layer_problem(ix, candidates[0])
            if beside is None or not layer_takes[n]:
                out.left.append(f"A new container ({n}) with {len(layer_takes[n])} sounds can't be a layer, because "
                                f"{why if beside is None else 'it has no sounds'}")
                continue
            explained.update({parent_of(RANSEQ, hirc[n][1])})
            explained.update(e for e, (et, eb) in hirc.items() if et == EVENT and e in vanilla
                             and event_actions(eb) != event_actions(vanilla[e][1]))
            if n not in seen:
                seen.add(n)
                gain = (get_prop(RANSEQ, hirc[n][1], 0x05) or 0.0) - (get_prop(RANSEQ, vanilla[beside][1], 0x05) or 0.0)
                out.layers.append((n, beside, round(gain, 2)))
                out.takes += [(n, i, sid, wem) for i, sid, wem in layer_takes[n]]
        for i, (t, body) in hirc.items():
            if t != SOUND or vanilla.get(i, (None,))[0] != SOUND or not is_audio(body):
                continue
            old, new = wbank.SOURCE.unpack_from(vanilla[i][1], 0)[2], wbank.SOURCE.unpack_from(body, 0)[2]
            if old == new:
                if (old in out.replaced or old in same) and body[18:] == vanilla[i][1][18:]:
                    explained.add(i)  # only its size follows the replaced clip
                continue
            explained.add(i)
            if (wem := audio(new)) is None:
                out.left.append(f"Sound {i} plays a clip that has no audio in the patch")
            elif i not in seen:
                seen.add(i)
                out.own.append((i, new, wem))
        plays_new = lambda i: i in hirc and hirc[i][0] == MUSIC_TRACK and bool(
            set(wbank.source_ids(MUSIC_TRACK, hirc[i][1])) & (new_audio | set(out.replaced) | same))
        for t, i in b["objects"]:  # a music track that plays a replaced clip: its sizes follow the clip
            if t == "MusicTrack" and plays_new(i):
                explained.add(i)
        for t, i in b["objects"]:  # its segment's length and cue points follow the clip too, and a build makes them
            # again for the new audio (fit timing): they aren't a change left out
            if t == "MusicSegment" and i in vanilla and _timing_only(vanilla[i][1], hirc[i][1]) and any(
                    plays_new(c) for c in music.MusicSegment.read(i, music.Reader(hirc[i][1])).node.children):
                explained.add(i)
        for _, i in b["objects"]:  # the mod's settings on the game's objects
            t, body = hirc[i]
            if i not in vanilla or vanilla[i][0] != t or t not in wbank.SETTABLE or i in as_was:
                continue
            if changes := wbank.prop_changes(t, vanilla[i][1], body):
                # a setting the copy doesn't have is one the game added since (mods set, they don't take away), so
                # the copy is an older version's: of its values only what a mod sets of how a sound plays is the
                # mod's (wbank.MIX_PROPS; the rest is the game's mix as it was), and where other banks have it too,
                # nothing (carried onto every copy, a stale value changes sounds far beyond the mod). A whole copy
                # that other banks share gives only those settings as well, and one in the mod's banks alone all
                lacks, shared = None in changes.values(), bool(set(ix.copies(i)) - set(d["banks"]))
                kept = {} if lacks and shared else {k: v for k, v in changes.items() if v is not None and
                                                    (k in wbank.MIX_PROPS or not (lacks or shared))}
                if kept:
                    out.settings.setdefault(i, kept)
                if kept != changes:
                    out.older.add(i)
                if i in explained:
                    continue
                now = wbank.with_props(t, vanilla[i][1], changes)
                clip = wbank.SOURCE.unpack_from(body, 0)[2] if t == SOUND else None
                at = 18 if clip in out.replaced or clip in same else 0  # its size follows the clip
                if now[at:] == body[at:]:
                    explained.add(i)
        if older:  # an object that names one of the older version's (a container listing it) is that version's too
            names_older = lambda body: any(struct.unpack_from("<I", body, k)[0] in older for k in range(len(body) - 3))
            explained.update(i for _, i in b["objects"] if i not in explained and names_older(hirc[i][1]))
        out.older |= as_was - merged
        other = [i for t, i in b["objects"] if i not in explained]
        if other:
            out.left.append(f"{len(other)} other change{'s' if len(other) != 1 else ''} in bank {bid} (settings such as "
                            f"effects, positioning or how a container picks sounds)")
        # objects the copy doesn't have aren't listed: mods don't take the game's out, so the game added them since
    return out
