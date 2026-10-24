"""The Soundtrack: how each piece of music plays, as the project sets it, and what that changes in the game's music
objects.

A piece of music is a playlist (music.MusicPlaylist): a tree of groups that play their children in order
(ContinuousSequence), the next one each time the group plays (StepSequence, which keeps its place between fights),
all of them in a random order (ContinuousRandom) or one at random (StepRandom). The rules of a music switch say
where the music starts when it moves to a playlist: most combat music jumps to a group of short openings, the
playlist's entry (entry_item).

Project.soundtrack sets each playlist one way (Piece.mode):

    original  the game's tree, without the items left out (Piece.left_out: playlist item ids)
    song      Piece.segments play in that order from the first, every time the music starts; the entry group stays.
              Piece.song is the file they were cut from, so the cuts can be changed
    tracks    the same, with a whole song in each segment, in order or in a random order (Piece.shuffle), from the
              first song at every start or going on with the next one (Piece.resume); a rule that waits for a
              segment's Exit leaves a track at the next bar instead, with a fade
    silent    the switch paths to the playlist lead to nothing
    same      the switch paths to the playlist lead to another one (Piece.follows): the intense battle music goes
              on with the battle song

A rule that jumps into an item that is gone starts the playlist from its top instead. Every music bank has a copy
of these objects and the game uses the first one it loads, so a build changes every copy (apply). Piece.gain_db is
the piece's level: Make-Up Gain on every track of its segments (levels)."""
import copy
import math
import random
import struct
from dataclasses import dataclass, field

from . import bank as wbank
from . import music

MODES = ("original", "song", "tracks", "silent", "same")
CS, SS, CR, SR = range(4)  # music.RS_TYPES
SPECIFIC_ITEM = 1          # music.JUMP_TYPES
NEXT_BAR, EXIT_MARKER = 2, 7  # music.SYNC_TYPES
TRACK_FADE_MS, LINEAR = 2000, 4  # leaving a whole track: a fade-out this long, on a straight curve


@dataclass
class Piece:
    mode: str = "original"
    segments: list[int] = field(default_factory=list)  # song, tracks: the segments that play, in order
    left_out: list[int] = field(default_factory=list)  # original: playlist items taken out
    shuffle: bool = False                                # tracks: in a random order
    resume: bool = False                                 # tracks: a new start goes on with the next song
    follows: int = 0                                     # same: the playlist that plays instead
    gain_db: float = 0.0                                 # the level of the whole piece
    song: str = ""                                       # song: the file cut into the segments (a project path)

    def to_json(self) -> dict:
        out = {"mode": self.mode}
        if self.segments:
            out["segments"] = [str(s) for s in self.segments]
        if self.left_out:
            out["left_out"] = [str(i) for i in self.left_out]
        if self.shuffle:
            out["shuffle"] = True
        if self.resume:
            out["resume"] = True
        if self.follows:
            out["follows"] = str(self.follows)
        if self.gain_db:
            out["gain_db"] = self.gain_db
        if self.song:
            out["song"] = self.song
        return out

    @classmethod
    def from_json(cls, d: dict, gain=(-96.0, 96.0)) -> "Piece":
        """A piece as a project file stores it. ValueError for one that is damaged."""
        if not isinstance(d, dict) or d.get("mode", "original") not in MODES:
            raise ValueError("a piece of the soundtrack")
        ids = lambda key: [int(x) for x in d.get(key, [])]
        g = d.get("gain_db", 0.0)
        if isinstance(g, bool) or not isinstance(g, (int, float)) or not math.isfinite(g):
            raise ValueError("the level of a piece")
        song = d.get("song", "")
        if not isinstance(song, str):
            raise ValueError("the song of a piece")
        return cls(d.get("mode", "original"), ids("segments"), ids("left_out"), d.get("shuffle") is True,
                   d.get("resume") is True, int(d.get("follows", 0)), max(gain[0], min(gain[1], float(g))), song)

    def plain(self) -> bool:
        """Nothing set: the game's own playlist at the game's level."""
        return self.mode == "original" and not self.left_out and not self.gain_db


# --- the trees
def items(root: music.PlaylistItem) -> set[int]:
    return {i.item_id for _, i in root.walk()}


def path_to(root: music.PlaylistItem, item_id: int) -> list[int]:
    """The child indices from root down to an item ([] for the root itself, or for an item it doesn't have)."""
    for i, c in enumerate(root.children):
        if c.item_id == item_id:
            return [i]
        if (sub := path_to(c, item_id)):
            return [i, *sub]
    return []


def entry_item(objs: dict, playlist_id: int) -> int:
    """The playlist item the music starts on when it moves to this playlist from anything (a rule from ANY that
    jumps to a specific item), or 0 for the top of the playlist."""
    pl = objs.get(playlist_id)
    if not isinstance(pl, music.MusicPlaylist):
        return 0
    own, found = items(pl.root), 0
    for o in objs.values():
        for r in getattr(o, "rules", []):
            if r.jump_type == SPECIFIC_ITEM and r.jump_to_id in own and music.ANY in r.sources \
                    and (playlist_id in r.destinations or music.ANY in r.destinations):
                if r.sources == [music.ANY] and r.destinations == [playlist_id]:
                    return r.jump_to_id
                found = found or r.jump_to_id
    return found


def in_order(root: music.PlaylistItem, entry: int = 0) -> bool:
    """Whether the playlist plays its segments top to bottom: groups in order only, and the music starts at its top."""
    return not entry and all(i.rs_type == CS for _, i in root.walk() if not i.segment_id)


def segments_in_order(root: music.PlaylistItem) -> list[int]:
    """The segments of a tree, each once, in the order they first come in it."""
    out = []
    for _, it in root.walk():
        if it.segment_id and it.segment_id not in out:
            out.append(it.segment_id)
    return out


def entry_branch(root: music.PlaylistItem, entry: int) -> music.PlaylistItem | None:
    """The group of openings the music starts on: the entry item, when it is a group below the top (the
    Automatons' intense music has it a level deeper than the others)."""
    path = path_to(root, entry) if entry and entry != root.item_id else []
    node = root
    for i in path:
        node = node.children[i]
    return node if path and not node.segment_id else None


def song_segments(root: music.PlaylistItem, entry: int = 0) -> list[int]:
    """The segments a song fills, in the order they first come: every segment but the openings'."""
    branch = entry_branch(root, entry)

    def outside(n):
        if n is branch:
            return
        if n.segment_id:
            yield n.segment_id
        for c in n.children:
            yield from outside(c)
    return list(dict.fromkeys(outside(root)))


def _fresh(root: music.PlaylistItem) -> int:
    taken = items(root)
    n = (max(taken) + 1) & 0xFFFFFFFF if taken else 1
    while n in taken or n == 0:
        n = (n + 1) & 0xFFFFFFFF
    return n


def song_root(root: music.PlaylistItem, segments: list[int], entry: int = 0, shuffle: bool = False,
              resume: bool = False) -> music.PlaylistItem:
    """The playlist's new tree for a song (or tracks): the segments one after another, from the first, forever (in a
    random order with shuffle). With resume, each start plays on from the segment after the last one played (a step
    group, or a random pick that avoids the ones just played). The entry group, a group of openings the music jumps
    to when it starts that plays none of these segments, stays where it was, so a fight opens as the game opens it
    and the song follows."""
    return _song(root, segments, entry, shuffle, resume)[0]


def _song(root, segments, entry, shuffle, resume=False) -> tuple[music.PlaylistItem, set[int]]:
    """song_root, and the items of the entry group it kept (rules may still jump there)."""
    first = {}
    for _, it in root.walk():
        if it.segment_id and it.segment_id not in first:
            first[it.segment_id] = it
    if missing := [s for s in segments if s not in first]:
        raise ValueError(f"segments {missing} aren't in this playlist")
    if not segments:
        raise ValueError("a song needs at least one segment")
    leaves = []
    for s in segments:
        leaf = copy.copy(first[s])
        leaf.loop, leaf.children = 1, []
        leaves.append(leaf)
    song = copy.copy(root)  # a group with the root's settings, under an id of its own
    song.segment_id, song.item_id, song.loop, song.children = 0, _fresh(root), 0, leaves
    song.rs_type = (SR if resume else CR) if shuffle else (SS if resume else CS)
    if shuffle:
        song.avoid_repeat, song.shuffle = max(1, len(leaves) - 1), 0  # a random order that plays each before a repeat
    branch = entry_branch(root, entry)
    if branch is not None and set(segments_in_order(branch)) & set(segments):
        branch = None
    if branch is None or root.segment_id:
        song.item_id = root.item_id
        return song, set()
    new = copy.copy(root)
    new.rs_type, new.loop = CS, 0
    leads = path_to(root, entry) == [0]  # openings that came first still do
    new.children = [branch, song] if leads else [song, branch]
    return new, items(branch)


def pruned(item: music.PlaylistItem, left_out: set[int]) -> music.PlaylistItem | None:
    """The tree without the items left out; a group left with nothing goes too (None: nothing is left)."""
    if item.item_id in left_out:
        return None
    if item.segment_id:
        return copy.copy(item)
    kids = [k for c in item.children if (k := pruned(c, left_out)) is not None]
    if not kids:
        return None
    new = copy.copy(item)
    new.children = kids
    return new


def tree(objs: dict, playlist_id: int, piece: Piece | None) -> music.PlaylistItem | None:
    """The playlist's tree as the piece sets it: None when the piece keeps the game's (or plays nothing of its own:
    silent, same)."""
    return _tree(objs, playlist_id, piece)[0]


def _tree(objs, playlist_id, piece) -> tuple[music.PlaylistItem | None, set[int]]:
    """tree, and the items that rules can no longer jump to: those gone, and in a song every item but the openings'
    (a fight starts the song from its first segment, whatever played last)."""
    pl = objs.get(playlist_id)
    if not isinstance(pl, music.MusicPlaylist) or piece is None:
        return None, set()
    if piece.mode in ("song", "tracks") and piece.segments:
        tracks = piece.mode == "tracks"
        new, kept = _song(pl.root, piece.segments, entry_item(objs, playlist_id), tracks and piece.shuffle,
                          tracks and piece.resume)
        return new, (items(pl.root) | items(new)) - kept - {new.item_id}
    if piece.mode == "original" and piece.left_out:
        new = pruned(pl.root, set(piece.left_out))
        if new is None:
            raise ValueError("every segment of the piece is left out")
        return new, items(pl.root) - items(new)
    return None, set()


# --- what a build changes
@dataclass
class Plan:
    roots: dict[int, music.PlaylistItem] = field(default_factory=dict)  # playlist id -> its new tree
    gone: set[int] = field(default_factory=set)        # playlist items rules can no longer jump to
    routes: dict[int, int] = field(default_factory=dict)  # audio node -> what switch paths to it lead to (0: nothing)
    prompt: set[int] = field(default_factory=set)      # tracks and their segments: rules leave them at the next bar
    objects: set[int] = field(default_factory=set)     # every object whose copies change
    skipped: list[int] = field(default_factory=list)   # pieces this game version doesn't have

    def __bool__(self):
        return bool(self.objects)


def plan(objs: dict, pieces: dict[int, Piece]) -> Plan:
    out = Plan()
    for pid, p in pieces.items():
        pl = objs.get(pid)
        if not isinstance(pl, music.MusicPlaylist):
            out.skipped.append(pid)
            continue
        root, gone = _tree(objs, pid, p)
        if root is not None:
            out.roots[pid] = root
            out.gone |= gone
        if p.mode == "silent":
            out.routes[pid] = 0
        elif p.mode == "same" and p.follows and p.follows != pid and isinstance(objs.get(p.follows), music.MusicPlaylist):
            out.routes[pid] = p.follows
        elif p.mode == "tracks" and p.segments:
            out.prompt |= {pid, *p.segments}  # a rule that waits for the Exit would wait for the whole song
    out.objects |= set(out.roots)
    for oid, o in objs.items():
        if out.gone and any(r.jump_type == SPECIFIC_ITEM and r.jump_to_id in out.gone for r in getattr(o, "rules", [])):
            out.objects.add(oid)
        if out.prompt and any(r.sync_type == EXIT_MARKER and out.prompt & set(r.sources) for r in getattr(o, "rules", [])):
            out.objects.add(oid)
        if out.routes and isinstance(o, music.MusicSwitch) and _routed(o, out.routes):
            out.objects.add(oid)
    return out


def _leaves(sw: music.MusicSwitch) -> list[int]:
    """The indices of the decision tree's leaves (as MusicSwitch.paths walks them)."""
    depth, out = len(sw.arguments), []

    def visit(i, d):
        n = sw.tree[i]
        idx, cnt = n.value & 0xFFFF, n.value >> 16
        if d == depth or idx + cnt > len(sw.tree) or cnt == 0:
            out.append(i)
            return
        for c in range(idx, idx + cnt):
            visit(c, d + 1)

    if sw.tree:
        visit(0, 0)
    return out


def _routed(sw: music.MusicSwitch, routes: dict[int, int]) -> list[int]:
    """The leaves of a switch that a route changes: to nothing, or to another of its children."""
    return [i for i in _leaves(sw) if (v := sw.tree[i].value) in routes and v != routes[v]
            and (routes[v] == 0 or routes[v] in sw.node.children)]


def change(obj, p: Plan) -> bool:
    """Puts the plan on one copy of an object (a playlist or a switch, parsed); whether that changed it."""
    changed = False
    if isinstance(obj, music.MusicPlaylist) and obj.id in p.roots:
        obj.root = copy.deepcopy(p.roots[obj.id])
        changed = True
    for r in obj.rules:
        if r.jump_type == SPECIFIC_ITEM and r.jump_to_id in p.gone:
            r.jump_type, r.jump_to_id = 0, 0  # StartOfPlaylist
            changed = True
        if r.sync_type == EXIT_MARKER and p.prompt & set(r.sources):
            r.sync_type = NEXT_BAR
            if r.src_fade.time_ms < TRACK_FADE_MS:
                r.src_fade = music.Fade(TRACK_FADE_MS, LINEAR, 0)
            changed = True
    if isinstance(obj, music.MusicSwitch):
        for i in _routed(obj, p.routes):
            obj.tree[i].value = p.routes[obj.tree[i].value]
            changed = True
    return changed


def apply(bank: bytes, p: Plan) -> tuple[bytes, list[int]]:
    """The bank with the plan on the copies it has; and their ids. It comes back as it was when it has none."""
    if not p.objects:
        return bank, []
    chunks = wbank.chunks(memoryview(bank))
    hirc = next((c for c in chunks if c[0] == b"HIRC"), None)
    if hirc is None:
        return bank, []
    entries, done = [], []
    for t, id, body in music.iter_hirc(bytes(hirc[1])):
        if id in p.objects and t in (music.MUSIC_RANSEQ, music.MUSIC_SWITCH):
            obj = music.PARSERS[t].read(id, music.Reader(bytes(body)))
            if change(obj, p):
                body = obj.to_bytes()
                done.append(id)
        entries.append((t, id, body))
    if not done:
        return bank, []
    hirc[1] = struct.pack("<I", len(entries)) + b"".join(struct.pack("<BII", t, 4 + len(b), id) + bytes(b)
                                                         for t, id, b in entries)
    return b"".join(x for tag, b in chunks for x in (tag, struct.pack("<I", len(b)), b)), done


def levels(objs: dict, pieces: dict[int, Piece]) -> dict[int, float]:
    """{music track: dB}: the level of each piece on the tracks of its segments (the first piece that sets one, for
    a track two pieces share)."""
    out = {}
    for pid, p in pieces.items():
        pl = objs.get(pid)
        if not p.gain_db or not isinstance(pl, music.MusicPlaylist):
            continue
        for seg in pl.segments():
            s = objs.get(seg)
            for track in s.node.children if isinstance(s, music.MusicSegment) else []:
                out.setdefault(track, p.gain_db)
    return out


# --- a fight, as the game plays it
def fight(root: music.PlaylistItem, entry: int, state: dict, ms: float, length, rng=None, cap=400) -> list[int]:
    """The segments the music plays from its start, until about `ms` have played (length(segment) is how long one
    plays, Entry to Exit). The music starts on the entry item; step groups go on from where they stopped, and random
    groups avoid the child they picked last, both kept in `state` ({"step": {item: next child}, "last": {item:
    child}}), which this updates for the next fight."""
    rng = rng or random.Random()
    step = state.setdefault("step", {})
    last = state.setdefault("last", {})

    def play(n, path):
        times = math.inf if n.loop == 0 else max(1, n.loop)
        if n.segment_id:
            k = 0
            while k < times:
                yield n.segment_id
                k += 1
            return
        kids, key = n.children, str(n.item_id)
        if not kids:
            return
        p = 0
        while p < times:
            lead = path if p == 0 and path else None
            heard = False
            if n.rs_type == CS:
                for i in range(lead[0] if lead else 0, len(kids)):
                    for s in play(kids[i], lead[1:] if lead and i == lead[0] else None):
                        heard = True
                        yield s
            elif n.rs_type == SS:
                i = lead[0] if lead else step.get(key, 0) % len(kids)
                step[key] = (i + 1) % len(kids)
                for s in play(kids[i], lead[1:] if lead else None):
                    heard = True
                    yield s
            elif n.rs_type == CR:
                order = list(range(len(kids)))
                rng.shuffle(order)
                if lead:
                    order.remove(lead[0])
                    order.insert(0, lead[0])
                for j, i in enumerate(order):
                    for s in play(kids[i], lead[1:] if lead and j == 0 else None):
                        heard = True
                        yield s
            else:
                if lead:
                    i = lead[0]
                else:
                    pick = [i for i in range(len(kids)) if len(kids) == 1 or i != last.get(key)]
                    i = rng.choice(pick)
                last[key] = i
                for s in play(kids[i], lead[1:] if lead else None):
                    heard = True
                    yield s
            if not heard:
                return  # a pass with nothing to play: an endless loop of nothing ends here
            p += 1

    out, total = [], 0.0
    for seg in play(root, path_to(root, entry) if entry else None):
        out.append(seg)
        total += max(1.0, length(seg))
        if total >= ms or len(out) >= cap:
            break
    return out


def as_dict(item: music.PlaylistItem) -> dict:
    """A tree for the window: groups with their kind and loop count, segments, each with its item id."""
    if item.segment_id:
        return {"item": str(item.item_id), "segment": str(item.segment_id), "loop": item.loop}
    return {"item": str(item.item_id), "rs": item.rs_type, "loop": item.loop, "children": [as_dict(c) for c in item.children]}
