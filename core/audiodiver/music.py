"""Wwise bank v154 interactive-music parser: segments, playlists, music switches and transition rules.

Field layout follows bnnm/wwiser (wparser.py). Pure Python, no hd2-audio-modder dependency. Every object writes
itself back byte-identically with to_bytes(); node base params are kept raw since Audiodiver never edits them.
"""
import struct
from dataclasses import dataclass, field

MUSIC_SEGMENT, MUSIC_TRACK, MUSIC_SWITCH, MUSIC_RANSEQ = 0x0A, 0x0B, 0x0C, 0x0D
ENTRY_CUE, EXIT_CUE = 43573010, 1539036744

SYNC_TYPES = ["Immediate", "NextGrid", "NextBar", "NextBeat", "NextMarker", "NextUserMarker", "EntryMarker",
              "ExitMarker", "ExitNever", "LastExitPosition"]
RS_TYPES = ["ContinuousSequence", "StepSequence", "ContinuousRandom", "StepRandom"]
ENTRY_TYPES = ["EntryMarker", "SameTime", "RandomMarker", "RandomUserMarker", "LastExitTime"]
JUMP_TYPES = ["StartOfPlaylist", "SpecificItem", "LastPlayedSegment", "NextSegment"]
ANY = 0xFFFFFFFF  # wildcard source/destination in transition rules


class Reader:
    def __init__(self, data: bytes, pos: int = 0):
        self.data, self.pos = data, pos

    def take(self, fmt: str):
        values = struct.unpack_from("<" + fmt, self.data, self.pos)
        self.pos += struct.calcsize("<" + fmt)
        return values if len(values) > 1 else values[0]

    def raw(self, n: int) -> bytes:
        self.pos += n
        return self.data[self.pos - n:self.pos]

    def ids(self) -> list[int]:
        n = self.take("I")
        self.pos += 4 * n
        return list(struct.unpack_from(f"<{n}I", self.data, self.pos - 4 * n))

    def cstr(self) -> bytes:
        end = self.data.index(b"\0", self.pos) + 1
        return self.raw(end - self.pos)


def pack_ids(ids: list[int]) -> bytes:
    return struct.pack(f"<I{len(ids)}I", len(ids), *ids)


def read_node_base_params(r: Reader) -> tuple[bytes, int]:
    """Skips NodeBaseParams; returns (raw bytes, direct parent id)."""
    start = r.pos
    r.take("B")  # fx override
    if n := r.take("B"):
        r.raw(1 + 6 * n)  # bypass bits + (index u8, fx id u32, is share set u8) each
    r.take("B")  # metadata fx override
    if n := r.take("B"):
        r.raw(6 * n)
    _bus, parent, _bits = r.take("IIB")
    n = r.take("B"); r.raw(5 * n)  # props: ids then f32 values
    n = r.take("B"); r.raw(9 * n)  # ranged props: ids then (min, max)
    positioning = r.take("B")
    if positioning & 1 and positioning & 2:
        r.take("B")  # 3d bits
        if (positioning >> 5) & 3:
            r.raw(5)  # path mode, transition time
            n = r.take("I"); r.raw(16 * n)  # vertices
            n = r.take("I"); r.raw(8 * n + 12 * n)  # playlist items, automation params
    if r.take("B") & 0b1000:  # aux
        r.raw(16)
    r.raw(4 + 6)  # reflection aux bus, adv settings
    n = r.take("B"); r.raw(3 * n)  # state props
    for _ in range(r.take("B")):  # state groups
        _group, _sync, states = r.take("IBB")
        for _ in range(states):
            _state, props = r.take("IH")
            r.raw(6 * props)
    for _ in range(r.take("H")):  # rtpc curves
        r.raw(4 + 3 + 4 + 1)
        r.raw(12 * r.take("H"))
    return r.data[start:r.pos], parent


@dataclass
class Stinger:
    trigger_id: int
    segment_id: int
    sync_type: int
    cue_filter: int
    dont_repeat_ms: int
    lookahead: int
    FMT = "IIIIiI"


@dataclass
class MusicNode:
    """CAkMusicNode params shared by segments, playlists and switches."""
    flags: int
    base: bytes
    parent_id: int
    children: list[int]
    grid_period: float
    grid_offset: float
    tempo: float
    beats_per_bar: int
    beat_value: int
    meter_override: int
    stingers: list[Stinger]

    @classmethod
    def read(cls, r: Reader):
        flags = r.take("B")
        base, parent = read_node_base_params(r)
        children = r.ids()
        meter = r.take("ddfBBB")
        stingers = [Stinger(*r.take(Stinger.FMT)) for _ in range(r.take("I"))]
        return cls(flags, base, parent, children, *meter, stingers)

    def to_bytes(self) -> bytes:
        return b"".join([
            struct.pack("<B", self.flags), self.base, pack_ids(self.children),
            struct.pack("<ddfBBB", self.grid_period, self.grid_offset, self.tempo, self.beats_per_bar,
                        self.beat_value, self.meter_override),
            struct.pack("<I", len(self.stingers)),
            *(struct.pack("<" + Stinger.FMT, *vars(s).values()) for s in self.stingers),
        ])


@dataclass
class Fade:
    time_ms: int
    curve: int
    offset_ms: int


@dataclass
class TransitionRule:
    """What happens when the music moves from one of `sources` to one of `destinations` (ANY = wildcard)."""
    sources: list[int]
    destinations: list[int]
    src_fade: Fade
    sync_type: int          # when to leave the source (SYNC_TYPES)
    src_cue_filter: int
    play_post_exit: int
    dst_fade: Fade
    dst_cue_filter: int
    jump_to_id: int         # playlist item to start at, for jump_type SpecificItem
    jump_type: int          # JUMP_TYPES
    entry_type: int         # where to enter the destination (ENTRY_TYPES)
    play_pre_entry: int
    match_source_cue: int
    has_transition: int     # AllocTransObjectFlag
    transition_segment: int = 0  # bridge segment played between the two
    transition_fade_in: Fade | None = None
    transition_fade_out: Fade | None = None
    transition_pre_entry: int = 0
    transition_post_exit: int = 0

    @classmethod
    def read(cls, r: Reader):
        srcs, dsts = r.ids(), r.ids()
        t, c, o, sync, cue, post = r.take("iIiIIB")
        dt, dc, do, dcue, jump_id, jump_type, entry, pre, match = r.take("iIiIIHHBB")
        rule = cls(srcs, dsts, Fade(t, c, o), sync, cue, post, Fade(dt, dc, do), dcue, jump_id, jump_type, entry,
                   pre, match, r.take("B"))
        if rule.has_transition:
            seg, *fades, rule.transition_pre_entry, rule.transition_post_exit = r.take("IiIiiIiBB")
            rule.transition_segment = seg
            rule.transition_fade_in, rule.transition_fade_out = Fade(*fades[:3]), Fade(*fades[3:])
        return rule

    def to_bytes(self) -> bytes:
        s, d = self.src_fade, self.dst_fade
        out = [pack_ids(self.sources), pack_ids(self.destinations),
               struct.pack("<iIiIIB", s.time_ms, s.curve, s.offset_ms, self.sync_type, self.src_cue_filter,
                           self.play_post_exit),
               struct.pack("<iIiIIHHBB", d.time_ms, d.curve, d.offset_ms, self.dst_cue_filter, self.jump_to_id,
                           self.jump_type, self.entry_type, self.play_pre_entry, self.match_source_cue),
               struct.pack("<B", self.has_transition)]
        if self.has_transition:
            fi, fo = self.transition_fade_in, self.transition_fade_out
            out.append(struct.pack("<IiIiiIiBB", self.transition_segment, fi.time_ms, fi.curve, fi.offset_ms,
                                   fo.time_ms, fo.curve, fo.offset_ms, self.transition_pre_entry,
                                   self.transition_post_exit))
        return b"".join(out)


def read_rules(r: Reader) -> list[TransitionRule]:
    return [TransitionRule.read(r) for _ in range(r.take("I"))]


def pack_rules(rules: list[TransitionRule]) -> bytes:
    return struct.pack("<I", len(rules)) + b"".join(x.to_bytes() for x in rules)


@dataclass
class PlaylistItem:
    """A playlist node: a group (children, rs_type) or a leaf playing segment_id."""
    segment_id: int
    item_id: int
    rs_type: int
    loop: int               # 0 = infinite
    loop_min: int
    loop_max: int
    weight: int
    avoid_repeat: int
    use_weight: int
    shuffle: int
    children: list["PlaylistItem"] = field(default_factory=list)
    FMT = "IIIIhhhIHBB"

    @classmethod
    def read_list(cls, r: Reader, count: int) -> list["PlaylistItem"]:
        items = []
        for _ in range(count):
            seg, item, n, *rest = r.take(cls.FMT)
            items.append(cls(seg, item, *rest))
            items[-1].children = cls.read_list(r, n)
        return items

    def to_bytes(self) -> bytes:
        return struct.pack("<" + self.FMT, self.segment_id, self.item_id, len(self.children), self.rs_type,
                           self.loop, self.loop_min, self.loop_max, self.weight, self.avoid_repeat,
                           self.use_weight, self.shuffle) + b"".join(c.to_bytes() for c in self.children)

    def walk(self, depth=0):
        yield depth, self
        for c in self.children:
            yield from c.walk(depth + 1)


@dataclass
class MusicSegment:
    id: int
    node: MusicNode
    duration_ms: float
    markers: list[tuple[int, float, bytes]]  # (id, position ms, name incl. NUL)

    @classmethod
    def read(cls, id, r: Reader):
        node, duration = MusicNode.read(r), r.take("d")
        markers = [(*r.take("Id"), r.cstr()) for _ in range(r.take("I"))]
        return cls(id, node, duration, markers)

    def to_bytes(self) -> bytes:
        return self.node.to_bytes() + struct.pack("<dI", self.duration_ms, len(self.markers)) + b"".join(
            struct.pack("<Id", i, p) + n for i, p, n in self.markers)

    def cue(self, cue_id: int) -> float | None:
        return next((p for i, p, _ in self.markers if i == cue_id), None)


@dataclass
class MusicPlaylist:
    """CAkMusicRanSeqCntr: plays its segments in sequence/random order per its playlist tree."""
    id: int
    node: MusicNode
    rules: list[TransitionRule]
    root: PlaylistItem

    @classmethod
    def read(cls, id, r: Reader):
        node, rules, count = MusicNode.read(r), read_rules(r), r.take("I")
        (root,) = PlaylistItem.read_list(r, 1)
        assert count == sum(1 for _ in root.walk()), f"playlist {id}: item count mismatch"
        return cls(id, node, rules, root)

    def to_bytes(self) -> bytes:
        return (self.node.to_bytes() + pack_rules(self.rules) +
                struct.pack("<I", sum(1 for _ in self.root.walk())) + self.root.to_bytes())

    def segments(self) -> list[int]:
        return [i.segment_id for _, i in self.root.walk() if i.segment_id]


@dataclass
class TreeNode:
    key: int                # switch/state value id (0 = default)
    value: int              # audio node id at a leaf, else (count << 16 | first child index)
    weight: int
    probability: int


@dataclass
class MusicSwitch:
    """CAkMusicSwitchCntr: picks a child by game syncs (switch/state groups) through a decision tree."""
    id: int
    node: MusicNode
    rules: list[TransitionRule]
    continue_playback: int
    arguments: list[tuple[int, int]]  # (group id, 0 = switch / 1 = state)
    mode: int
    tree: list[TreeNode]

    @classmethod
    def read(cls, id, r: Reader):
        node, rules, cont, depth = MusicNode.read(r), read_rules(r), *r.take("BI")
        groups = [r.take("I") for _ in range(depth)]
        args = [(g, r.take("B")) for g in groups]
        size, mode = r.take("IB")
        tree = [TreeNode(*r.take("IIHH")) for _ in range(size // 12)]
        return cls(id, node, rules, cont, args, mode, tree)

    def to_bytes(self) -> bytes:
        return b"".join([
            self.node.to_bytes(), pack_rules(self.rules), struct.pack("<BI", self.continue_playback,
                                                                      len(self.arguments)),
            b"".join(struct.pack("<I", g) for g, _ in self.arguments),
            b"".join(struct.pack("<B", t) for _, t in self.arguments),
            struct.pack("<IB", 12 * len(self.tree), self.mode),
            b"".join(struct.pack("<IIHH", n.key, n.value, n.weight, n.probability) for n in self.tree),
        ])

    def paths(self) -> list[tuple[tuple[int, ...], int]]:
        """Resolves the decision tree into ((key per argument), audio node id) leaves."""
        depth, out = len(self.arguments), []

        def visit(i, d, keys):
            n = self.tree[i]
            idx, cnt = n.value & 0xFFFF, n.value >> 16
            if d == depth or idx + cnt > len(self.tree) or cnt == 0:
                out.append((keys, n.value))
                return
            for c in range(idx, idx + cnt):
                visit(c, d + 1, keys + (self.tree[c].key,))

        if self.tree:
            visit(0, 0, ())
        return out


TRACK_TYPES = ["normal", "random", "sequence", "switch"]


@dataclass
class TrackClip:
    subtrack: int
    source: int
    play_at_ms: float
    begin_trim_ms: float
    end_trim_ms: float
    source_ms: float


@dataclass
class TrackInfo:
    """What a MusicTrack plays (read-only view; the patcher edits tracks in place)."""
    type: str
    sources: list[int]
    clips: list[TrackClip]
    switch_group: int = 0           # for switch tracks: the game sync that picks the subtrack
    switch_values: list[int] = field(default_factory=list)  # switch value per subtrack

    @classmethod
    def read(cls, body: bytes):
        r = Reader(body)
        n = r.take("I")
        sources = [struct.unpack_from("<I", body, r.pos + 18 * i + 5)[0] for i in range(n)]
        r.raw(18 * n + 1)  # sources, flags
        clips = [TrackClip(*r.take("IIII")[:2], *r.take("dddd")) for _ in range(r.take("I"))]
        if clips:
            r.take("I")  # subtrack count
        for _ in range(r.take("I")):  # clip automations
            r.raw(8)
            r.raw(12 * r.take("I"))
        read_node_base_params(r)
        ttype = r.take("B")
        group, values = 0, []
        if ttype == 3:
            _gtype, group, _default = r.take("BII")
            values = [r.take("I") for _ in range(r.take("I"))]
            r.raw(12 + 4 + 4 + 12)  # transition params
        r.raw(4)  # look-ahead
        assert r.pos == len(body), f"MusicTrack: {len(body) - r.pos} bytes left unparsed"
        return cls(TRACK_TYPES[ttype], sources, clips, group, values)


PARSERS = {MUSIC_SEGMENT: MusicSegment, MUSIC_SWITCH: MusicSwitch, MUSIC_RANSEQ: MusicPlaylist}


def iter_hirc(hirc: bytes):
    """Yields (type, id, body) for each HIRC entry; body excludes the type/size/id header."""
    r = Reader(hirc)
    for _ in range(r.take("I")):
        t, size, id = r.take("BII")
        yield t, id, r.raw(size - 4)


def parse_music(hirc: bytes) -> dict[int, object]:
    """Parses the music objects of a HIRC chunk; asserts each one round-trips byte-identically."""
    out = {}
    for t, id, body in iter_hirc(hirc):
        if t in PARSERS:
            r = Reader(body)
            obj = PARSERS[t].read(id, r)
            assert r.pos == len(body), f"{PARSERS[t].__name__} {id}: {len(body) - r.pos} bytes left unparsed"
            assert obj.to_bytes() == body, f"{PARSERS[t].__name__} {id}: round-trip mismatch"
            out[id] = obj
    return out
