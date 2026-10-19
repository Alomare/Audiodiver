"""The music cue map: every piece of interactive music the game can play, found by walking the game data.

A cue is a playlist (or a segment a switch or event plays directly) plus the game-sync conditions that select it,
walked down from the music root switches. Each cue lists its segments in play order, each segment its stems
(MusicTracks), and each stem its slots: the audio sources a replacement targets, plus the clips that place them on
the segment's timeline. Playlists keep their tree (order, loops), which render.py follows. Transition bridges and
stingers are cues too, since they play outside any playlist: a bridge keeps the rules that play it (from which
objects to which), a stinger the objects it plays over. Switches keep the conditions that reach them, so a rule
that names a switch can be read as "into the Terminid combat music".

Generated per game version from the music banks the index discovers (never a hard-coded archive list) and cached
next to the index. `catalog.py` turns it into the named library the editor shows.
"""
import collections
import json
import time

from . import bank as wbank
from . import music
from .index import AudioIndex, CACHE_DIR

FORMAT = 3
EVENT, ACTION = 0x04, 0x03
PLAY_ACTIONS = (0x0403, 0x0503)  # Play, PlayAndContinue


def _event_actions(body):
    r, n, shift = music.Reader(body), 0, 0
    while True:  # varint action count
        b = r.take("B")
        n |= (b & 0x7F) << shift
        shift += 7
        if b < 0x80:
            break
    return [r.take("I") for _ in range(n)]


def load_music(ix: AudioIndex):
    """({id: music object}, {track id: TrackInfo}, {object id: archives}, {target id: [event ids]})."""
    objs, tracks, archives = {}, {}, collections.defaultdict(set)
    events, actions = {}, {}
    for bid in ix.music_banks:
        arch = ix.banks[bid]["archives"]
        for t, id, body in music.iter_hirc(wbank.hirc(ix.bank_files(bid)[0])):
            if t in music.PARSERS:
                archives[id].update(arch)
                obj = music.PARSERS[t].read(id, music.Reader(body))
                if id in objs:  # per-bank children lists are merged
                    objs[id].node.children += [c for c in obj.node.children if c not in objs[id].node.children]
                else:
                    objs[id] = obj
            elif t == music.MUSIC_TRACK:
                archives[id].update(arch)
                tracks.setdefault(id, music.TrackInfo.read(body))
            elif t == EVENT:
                events[id] = _event_actions(body)
            elif t == ACTION:
                actions[id] = music.Reader(body).take("HI")
    plays = collections.defaultdict(list)
    for e, acts in events.items():
        for a in acts:
            if a in actions and actions[a][0] in PLAY_ACTIONS:
                plays[actions[a][1]].append(e)
    return objs, tracks, archives, plays


def build(ix: AudioIndex, log=print) -> dict:
    t0 = time.time()
    objs, tracks, archives, plays = load_music(ix)
    cues, visited = {}, set()

    def stems(seg_id):
        out = []
        for tid in objs[seg_id].node.children:
            ti = tracks.get(tid)
            if not ti:
                continue
            durations = {}
            for c in ti.clips:
                if c.source:
                    durations.setdefault(c.source, (c.subtrack, c.source_ms))
            slots = []
            for sid in ti.sources:
                slot = {"source": sid, "duration_ms": 0.0, "variant": 0, "unused": sid not in durations}
                if sid in durations:  # sources no clip places on the timeline are never heard
                    sub, ms = durations[sid]
                    slot["duration_ms"] = round(ms, 3)
                    if ti.type == "switch" and sub < len(ti.switch_values):
                        slot["variant"] = ti.switch_values[sub]
                slots.append(slot)
            clips = [{"source": c.source, "subtrack": c.subtrack, "play_at_ms": c.play_at_ms,
                      "begin_trim_ms": c.begin_trim_ms, "end_trim_ms": c.end_trim_ms, "source_ms": c.source_ms}
                     for c in ti.clips if c.source]
            out.append({"track": tid, "type": ti.type, "switch_group": ti.switch_group,
                        "switch_values": ti.switch_values, "slots": slots, "clips": clips})
        return out

    def add_segments(cue, items, id):
        for depth, item in items:
            seg = objs[item.segment_id if item else id]
            cue["segments"].append({
                "segment": seg.id, "depth": depth, "loop": item.loop if item else 1,
                "duration_ms": round(seg.duration_ms, 3),
                "entry_ms": seg.cue(music.ENTRY_CUE), "exit_ms": seg.cue(music.EXIT_CUE),
                "stems": stems(seg.id)})

    def new_cue(id, kind):
        return {"id": id, "kind": kind, "archives": sorted(archives[id]), "contexts": [], "segments": [],
                "playlist": None}

    def tree(item):
        """A playlist node: a segment to play, or a group of nodes (rs: music.RS_TYPES index)."""
        if item.segment_id:
            return {"segment": item.segment_id, "loop": item.loop}
        return {"rs": item.rs_type, "loop": item.loop, "children": [tree(c) for c in item.children]}

    switches = {}  # switch id -> {"parent", "contexts"}: the conditions that reach it

    def visit(id, conds):
        o = objs.get(id)
        visited.add(id)
        if isinstance(o, music.MusicSwitch):
            sw = switches.setdefault(id, {"parent": o.node.parent_id, "contexts": []})
            if len(sw["contexts"]) < 64:
                sw["contexts"].append(conds)
            for keys, child in o.paths():
                visit(child, conds + [[g, k] for (g, _), k in zip(o.arguments, keys) if k])
        elif isinstance(o, (music.MusicPlaylist, music.MusicSegment)):
            cue = cues.setdefault(id, new_cue(id, "playlist" if isinstance(o, music.MusicPlaylist) else "segment"))
            cue["contexts"].append(conds)
            if not cue["segments"]:
                items = ([(d, i) for d, i in o.root.walk() if i.segment_id] if isinstance(o, music.MusicPlaylist)
                         else [(0, None)])
                add_segments(cue, items, id)
                if isinstance(o, music.MusicPlaylist):
                    cue["playlist"] = tree(o.root)

    roots = [o.id for o in objs.values() if o.node.parent_id not in objs and not isinstance(o, music.MusicSegment)]
    for r in roots:
        visit(r, [])
    # objects that events start directly (battle music, stingers) sit outside the root decision tree
    for target, evs in sorted(plays.items()):
        if target in objs and target not in roots:
            roots.append(target)
            visit(target, [["event", e] for e in sorted(evs)][:1])
    # bridge segments of transition rules and stinger segments play outside any playlist
    extra = collections.defaultdict(set)
    rules = collections.defaultdict(dict)     # bridge segment -> {(owner, from, to): rule}
    stingers = collections.defaultdict(dict)  # stinger segment -> {(owner, trigger): stinger}
    for id in visited:
        o = objs.get(id)
        for r in getattr(o, "rules", []):
            if r.has_transition and r.transition_segment in objs:
                extra[r.transition_segment].add(("bridge", id))
                key = (id, tuple(r.sources), tuple(r.destinations))
                rules[r.transition_segment][key] = {"owner": id, "from": r.sources, "to": r.destinations}
        for st in o.node.stingers if o else []:
            if st.segment_id in objs:
                extra[st.segment_id].add(("stinger", id))
                stingers[st.segment_id][(id, st.trigger_id)] = {"owner": id, "trigger": st.trigger_id}
    for seg, owners in sorted(extra.items()):
        if seg not in cues:
            cue = cues[seg] = new_cue(seg, sorted(owners)[0][0])
            cue["contexts"] = [[[kind, owner]] for kind, owner in sorted(owners)]
            add_segments(cue, [(0, None)], seg)
        cues[seg]["rules"] = [rules[seg][k] for k in sorted(rules[seg])]
        cues[seg]["stinger_of"] = [stingers[seg][k] for k in sorted(stingers[seg])]
    log(f"cue map: {len(cues)} cues from {len(ix.music_banks)} music banks ({time.time() - t0:.0f}s)")
    return {"format": FORMAT, "fingerprint": ix.game.fingerprint, "roots": roots, "cues": list(cues.values()),
            "switches": {str(k): v for k, v in switches.items()}}


class CueMap:
    def __init__(self, ix: AudioIndex, rebuild=False, log=print):
        self.ix = ix
        path = CACHE_DIR / "cuemap.json"
        d = None
        if path.exists() and not rebuild:
            d = json.loads(path.read_text())
            if d.get("format") != FORMAT or d.get("fingerprint") != ix.game.fingerprint:
                d = None
        if d is None:
            d = build(ix, log)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(d))
        self.cues = {c["id"]: c for c in d["cues"]}
        self.switches = {int(k): v for k, v in d["switches"].items()}
        self.by_segment = collections.defaultdict(list)  # segment id -> [cue ids that play it]
        for c in d["cues"]:
            for s in c["segments"]:
                if c["id"] not in self.by_segment[s["segment"]]:
                    self.by_segment[s["segment"]].append(c["id"])
        self.by_source = collections.defaultdict(list)  # source id -> [cue ids]
        for c in d["cues"]:
            for sid in slots(c):
                if c["id"] not in self.by_source[sid]:
                    self.by_source[sid].append(c["id"])


def slots(cue) -> list[int]:
    """The cue's source ids, in play order, without repeats."""
    out = []
    for s in cue["segments"]:
        for st in s["stems"]:
            for sl in st["slots"]:
                if sl["source"] not in out:
                    out.append(sl["source"])
    return out
