"""Audio added to the game's: new takes, layers, clips of their own (addition.py). Unit tests build small objects of
their own; `game` tests add to the autocannon's bank."""
import json
import struct
import time
import wave

import pytest

from audiodiver import addition as add
from audiodiver import bank as wbank
from audiodiver import music
from audiodiver.editor import EditorError, Session
from audiodiver.project import Addition, Project, Replacement


def _base(parent, bus=0):
    """NodeBaseParams with nothing set but the bus and the parent."""
    return bytes(4) + struct.pack("<IIB", bus, parent, 0) + bytes(4) + bytes(10) + bytes(2) + struct.pack("<H", 0)


def _ranseq(parent, kids, avoid=1):
    settings = struct.pack("<HHHfffHBBBB", 1, 0, 0, 0, 0, 0, avoid, 0, 0, 0, 0x12)
    items = struct.pack("<H", len(kids)) + b"".join(struct.pack("<Ii", k, 50000) for k in kids)
    return _base(parent) + settings + music.pack_ids(sorted(kids)) + items


def _sound(parent, source):
    return wbank.SOURCE.pack(0x40001, 2, source, 7, 0, 0) + _base(parent)


def _bank(objects, media=None):
    """A bank of (type, id, body), with media {id: bytes} when given."""
    head = b"BKHD" + struct.pack("<I", 8) + bytes(8)
    hirc = struct.pack("<I", len(objects)) + b"".join(struct.pack("<BII", t, 4 + len(b), i) + b for t, i, b in objects)
    out = head
    if media:
        didx = b"".join(struct.pack("<III", sid, 16 * n, len(w)) for n, (sid, w) in enumerate(media.items()))
        data = b"".join(w.ljust(16, b"\0") for w in media.values())
        out += b"DIDX" + struct.pack("<I", len(didx)) + didx + b"DATA" + struct.pack("<I", len(data)) + data
    return out + b"HIRC" + struct.pack("<I", len(hirc)) + hirc


def test_child_lists_stay_sorted_and_playlists_take_the_weight_they_have():
    body = _ranseq(9, [30, 10])
    assert add.children(add.RANSEQ, body) == [10, 30] and add.playlist(body) == [(30, 50000), (10, 50000)]
    body = add._with_play_item(add._with_child(add.RANSEQ, body, 20), 20)
    assert add.children(add.RANSEQ, body) == [10, 20, 30]
    assert add.playlist(body) == [(30, 50000), (10, 50000), (20, 50000)]
    assert add.parent_of(add.RANSEQ, body) == 9


def test_a_layer_starts_empty_and_never_avoids_more_repeats_than_it_has_takes():
    body = add._empty_ranseq(_ranseq(9, [10, 20, 30], avoid=6), takes=2)
    assert add.children(add.RANSEQ, body) == [] and add.playlist(body) == []
    assert struct.unpack_from("<H", body, add.base_end(add.RANSEQ, body) + 18)[0] == 1


def test_a_switch_plays_the_layer_in_the_states_that_play_what_it_is_beside():
    states = struct.pack("<I", 2) + struct.pack("<I", 111) + music.pack_ids([5, 6]) + struct.pack("<I", 222) + music.pack_ids([6])
    params = struct.pack("<I", 2) + struct.pack("<IBii", 5, 1, 100, 200) + struct.pack("<IBii", 6, 0, 0, 0)
    body = _base(1) + struct.pack("<BIIB", 0, 77, 111, 0) + music.pack_ids([5, 6]) + states + params
    out = add._switch_with(body, 5, 9)
    r = music.Reader(out, add.children_at(add.SWITCH, out))
    assert r.ids() == [5, 6, 9]
    assert [(r.take("I"), r.ids()) for _ in range(r.take("I"))] == [(111, [5, 9, 6]), (222, [6])]
    got = [struct.unpack_from("<IBii", r.raw(13)) for _ in range(r.take("I"))]
    assert got == [(5, 1, 100, 200), (6, 0, 0, 0), (9, 1, 100, 200)] and r.pos == len(out)


def test_an_event_takes_one_more_action_and_counts_past_127():
    body = add._pack_var(127) + struct.pack("<127I", *range(1, 128))
    assert add._var(body, 0) == (127, 1)
    out = add._event_with(body, 500)
    assert out[:2] == bytes([0x81, 0x00]) and add.event_actions(out) == [*range(1, 128), 500]
    assert add._event_with(out, 500) == out


def test_new_ids_are_30_bit_and_derived_ones_the_same_every_time():
    taken = {add.derived_id("1:2", set())}
    assert add.derived_id("1:2", set()) in taken and add.derived_id("1:2", taken) not in taken
    assert all(0 < add.new_id(taken) < 2 ** 30 for _ in range(50))


def test_a_take_goes_into_a_bank_without_media_and_checks_out():
    bank = _bank([(2, 10, _sound(30, 100)), (2, 11, _sound(30, 101)), (5, 30, _ranseq(1, [10, 11]))])
    wem = b"RIFF" + bytes(60)
    take = add.Take(30, 12, 200, wem)
    here = add.BankPlan(takes=[take], added={12}, changed={30}, media={200: wem})
    out = add.apply(bank, here, add.Plan())
    media, hirc = wbank.parse(out)
    assert [t for t, _ in wbank.chunks(out)] == [b"BKHD", b"DIDX", b"DATA", b"HIRC"]
    assert media == {200: wem} and list(hirc)[:3] == [10, 11, 12]  # before its container, as the game orders them
    plugin, stype, sid, _cache, mem, _bits = wbank.SOURCE.unpack_from(hirc[12][1], 0)
    assert (plugin, stype, sid, mem) == (0x40001, 0, 200, len(wem))  # held in the bank, though its sibling streams
    assert add.check((media, hirc), wbank.parse(bank), here) == []
    assert add.check(wbank.parse(bank), wbank.parse(bank), here)  # without it: the check says what is missing


def test_project_keeps_its_additions_and_a_file_without_them_stays_without(tmp_path):
    p = Project(name="A", path=tmp_path / "a.audi")
    p.save()
    assert "additions" not in json.loads((tmp_path / "a.audi").read_text())
    p.additions = [Addition("layer", container=5, beside=6), Addition("take", container=5, sound=7, source=8),
                   Addition("own", sound=9, source=10)]
    p.save()
    d = json.loads((tmp_path / "a.audi").read_text())
    assert d["additions"][0] == {"kind": "layer", "container": "5", "beside": "6"}
    q = Project.load(tmp_path / "a.audi")
    assert q.additions == p.additions and set(q.added()) == {8, 10} and q.made_ids() == {5, 7, 8, 10}
    d["additions"].append({"kind": "take", "container": "5"})
    (tmp_path / "a.audi").write_text(json.dumps(d))
    with pytest.raises(ValueError, match="added audio"):
        Project.load(tmp_path / "a.audi")


def test_added_audio_goes_with_its_audio():
    p = Project(name="A", additions=[Addition("layer", container=5, beside=6), Addition("take", container=5, sound=7, source=8),
                                     Addition("take", container=40, sound=41, source=42), Addition("own", sound=9, source=10)],
                replacements=[Replacement(42, "b.wav")])
    Session._tidy(p)
    assert [a.kind for a in p.additions] == ["take"] and p.additions[0].source == 42


# --- with the game
def _wav(path, seconds=0.3):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(48000)
        w.writeframes(bytes(int(48000 * seconds) * 2))
    return path


@pytest.fixture(scope="module")
def session():
    s = Session()
    s.wait_ready()
    return s


AUTOCANNON = "bank:" + str(__import__("audiodiver.game", fromlist=["x"]).murmur64_hash(b"content/audio/wep_autocannon"))


def _groups(s):
    return s.cue(AUTOCANNON, mine=True)["segments_detail"]


@pytest.mark.game
def test_takes_layers_and_clips_of_their_own_show_where_they_play(session, tmp_path):
    s = session
    s.new_project(tmp_path / "t.audi", "T")
    groups = _groups(s)
    g = next(g for g in groups if g.get("container") and g.get("layer"))
    takes = len(g["stems"][0]["slots"])
    st = s.add_takes(g["container"], [str(_wav(tmp_path / "b.wav")), str(_wav(tmp_path / "a.wav"))])
    new = st["sources"]
    assert [st["assignments"][x]["name"] for x in new] == ["a.wav", "b.wav"] and st["undo_label"] == "add take"
    g2 = next(x for x in _groups(s) if x.get("container") == g["container"])
    rows = g2["stems"][0]["slots"]
    assert len(rows) == takes + 2 and [r["source"] for r in rows[-2:]] == new
    assert rows[-1]["added"] == "take" and rows[-1]["label"] == f"Take {takes + 2}"
    assert st["outside"] == [] and st["library"]  # the bank it went into is listed

    st = s.add_layer(g["container"], [str(_wav(tmp_path / "c.wav"))])
    after = _groups(s)
    i = next(n for n, x in enumerate(after) if x.get("container") == g["container"])
    assert after[i + 1]["added"] == "layer" and after[i + 1]["beside"] == g["container"]
    assert after[i + 1]["name"] == f"{after[i]['name']} · Layer"

    row = next(r for x in after for r in x["stems"][0]["slots"]
               if not r.get("added") and not r.get("was") and r.get("object") and r["sound_banks"] < r["banks"])
    with pytest.raises(EditorError, match="new audio first"):
        s.own_clip(row["source"], row["object"])
    s.assign(row["source"], str(_wav(tmp_path / "d.wav")))
    st = s.own_clip(row["source"], row["object"])
    mine = st["source"]
    assert row["source"] not in st["assignments"] and st["assignments"][mine]["name"] == "d.wav"
    moved = next(r for x in _groups(s) for r in x["stems"][0]["slots"] if r["source"] == mine)
    assert moved["was"] == row["source"] and moved["banks"] == row["sound_banks"]
    assert s.vanilla_wav(int(mine)) == s.vanilla_wav(int(row["source"]))  # its original is the clip it stood in for
    st = s.shared_clip(mine)
    assert st["source"] == row["source"] and st["assignments"][row["source"]]["name"] == "d.wav"
    assert not any(a["kind"] == "own" for a in st["additions"])

    st = s.unassign([new[0]])  # a take is its audio: without it, it goes
    assert len([a for a in st["additions"] if a["kind"] == "take"]) == 2
    st = s.unassign(st["outside"] + [x for x in st["assignments"] if x != row["source"]])
    assert st["additions"] == []  # the layer went with its last take
    assert len(s.undo()["additions"]) == 3


@pytest.mark.game
def test_a_build_adds_the_audio_and_verifies_it(session, tmp_path, monkeypatch):
    from audiodiver import build, patch
    s, ix = session, session.ix
    s.new_project(tmp_path / "b.audi", "B")
    groups = _groups(s)
    # what is copied into the fewest banks keeps the patch small
    g = min((g for g in groups if g.get("container") and g.get("layer")), key=lambda g: len(ix.copies(int(g["container"]))))
    s.add_takes(g["container"], [str(_wav(tmp_path / "a.wav"))])
    s.add_layer(g["container"], [str(_wav(tmp_path / "b.wav"))])
    wem = ix.wem(int(g["stems"][0]["slots"][0]["source"]))  # no encoder needed: a clip of the game's stands in
    monkeypatch.setattr(build, "encode_cached", lambda src, quality=6, log=None: wem)
    zip_path = build.build(s.project, ix, tmp_path / "out", log=lambda *a: None)
    assert zip_path.exists()
    reps = build.replacements(s.project, ix)
    plan = build.additions(s.project, ix, reps)
    assert set(plan.banks) >= set(ix.copies(int(g["container"])))
    out = tmp_path / "p.patch_0"
    patch.build_patch(str(out), reps, ix, plan=plan)
    assert patch.verify(str(out), reps, ix, plan) == []
    assert patch.verify(str(out), reps, ix)  # without the plan, the new objects are changes beyond the replacements


def _with_prop(t, body: bytes, pid: int, value: float) -> bytes:
    """A container's or Sound's body with one more float property (the bundle keeps its ids in order)."""
    p = add.parent_at(t, body) + 5
    n = body[p]
    ids, vals = list(body[p + 1:p + 1 + n]), list(struct.unpack_from(f"<{n}f", body, p + 1 + n))
    i = sum(x < pid for x in ids)
    ids.insert(i, pid)
    vals.insert(i, value)
    return body[:p] + bytes([len(ids), *ids]) + struct.pack(f"<{len(vals)}f", *vals) + body[p + 1 + 5 * n:]


def _appended(t, body: bytes, child: int, play=False) -> bytes:
    """Unwise's AddLeaf: the child at the end of the list (unsorted), and of the playlist."""
    p = add.children_at(t, body)
    kids = music.Reader(body, p).ids()
    body = body[:p] + music.pack_ids([*kids, child]) + body[p + 4 + 4 * len(kids):]
    if play:
        r = music.Reader(body, add.children_at(t, body))
        r.ids()
        at, n = r.pos, r.take("H")
        body = body[:at] + struct.pack("<H", n + 1) + body[at + 2:at + 2 + 8 * n] + struct.pack("<Ii", child, 50000) \
            + body[at + 2 + 8 * n:]
    return body


def _unwise(ix, bid):
    """The bank as Unwise leaves it after NewSoundToRanSeqCntr, ImportAsRanSeqCntr (Make-Up Gain +3 dB) and
    RewireWithNewSources, written the way wwise-teller's code was seen to write it: new Sounds just before their
    container, cache id 0, child ids appended unsorted, the new container a copy of its reference under the same
    actor-mixer, a copy of the reference's play action added to the event, new media packed without alignment.
    Returns (the bank, what it did)."""
    raw = ix.bank_files(bid)[0]
    media, h = wbank.parse(raw)
    entries = [[t, oid, bytes(b)] for t, oid, b in music.iter_hirc(wbank.hirc(raw))]
    parent = {o: add.parent_of(t, b) for o, (t, b) in h.items() if t in add.CONTAINERS or (t == wbank.SOUND and add.is_audio(b))}
    sounds_of = lambda c: [o for o, p in parent.items() if p == c and h[o][0] == wbank.SOUND]
    ok = lambda c: h.get(c, (0,))[0] == add.RANSEQ and len(sounds_of(c)) >= 2 and h.get(parent.get(c), (0,))[0] == add.MIXER
    events = {e: [a for a in add.event_actions(b) if h.get(a, (0,))[0] == add.ACTION] for e, (t, b) in h.items() if t == add.EVENT}
    event, action = next((e, a) for e, acts in sorted(events.items(), key=lambda x: -len(x[1]))
                         for a in acts if add.play_target(h[a][1]) is not None and ok(add.play_target(h[a][1])))
    ref = add.play_target(h[action][1])
    mixer, template = parent[ref], h[sounds_of(ref)[0]][1]
    own = next(o for c in sorted(parent) if c != ref and h.get(c, (0,))[0] == add.RANSEQ for o in sounds_of(c))
    taken = set(ix.taken)
    ids = [add.new_id(taken | {0}) for _ in range(7)]
    assert len(set(ids)) == 7
    take, take_clip, layer, layer_take, layer_clip, twin, own_clip = ids
    clips = sorted(media, key=lambda s: len(media[s]))[:3]  # three clips of the bank stand in for new audio
    wems = dict(zip((take_clip, layer_clip, own_clip), (media[c] for c in clips)))
    at = lambda oid: next(i for i, e in enumerate(entries) if e[1] == oid)
    put = lambda oid, body: entries.__setitem__(at(oid), [entries[at(oid)][0], oid, body])
    sound = lambda clip, to: (lambda b: b[:add.parent_at(wbank.SOUND, b)] + struct.pack("<I", to) + b[add.parent_at(wbank.SOUND, b) + 4:])(
        wbank.SOURCE.pack(0x40001, 0, clip, 0, len(wems[clip]), 0) + template[18:])

    entries.insert(at(ref), [wbank.SOUND, take, sound(take_clip, ref)])            # NewSoundToRanSeqCntr
    put(ref, _appended(add.RANSEQ, entries[at(ref)][2], take, play=True))
    copy = add._empty_ranseq(h[ref][1], 9)                                          # ImportAsRanSeqCntr
    copy = _with_prop(add.RANSEQ, _appended(add.RANSEQ, copy, layer_take, play=True), 0x05, 3.0)
    entries.insert(at(mixer) if any(e[1] == mixer for e in entries) else len(entries), [add.RANSEQ, layer, copy])
    entries.insert(at(layer), [wbank.SOUND, layer_take, sound(layer_clip, layer)])
    if any(e[1] == mixer for e in entries):
        put(mixer, _appended(add.MIXER, entries[at(mixer)][2], layer))
    a = bytearray(h[action][1])
    struct.pack_into("<I", a, 2, layer)
    entries.insert(at(event), [add.ACTION, twin, bytes(a)])
    ev = add.event_actions(entries[at(event)][2])
    put(event, add._pack_var(len(ev) + 1) + struct.pack(f"<{len(ev) + 1}I", *ev, twin))
    b = bytearray(entries[at(own)][2])                                               # RewireWithNewSources
    plugin, stype, _sid, cache, _mem, bits = wbank.SOURCE.unpack_from(b, 0)
    wbank.SOURCE.pack_into(b, 0, plugin, stype, own_clip, cache, len(wems[own_clip]), bits)
    put(own, bytes(b))

    chunks = wbank.chunks(raw)
    for c in chunks:
        if c[0] == b"HIRC":
            c[1] = struct.pack("<I", len(entries)) + b"".join(struct.pack("<BII", t, 4 + len(x), o) + x for t, o, x in entries)
        elif c[0] == b"DIDX":
            rows = [struct.unpack_from("<III", c[1], i) for i in range(0, len(c[1]), 12)]
            end = max(o + n for _, o, n in rows)
            for clip, w in wems.items():
                c[1] += struct.pack("<III", clip, end, len(w))
                end += len(w)
        elif c[0] == b"DATA":
            c[1] = c[1][:max(o + n for _, o, n in rows)] + b"".join(wems.values())
    did = {"ref": ref, "take": take, "take_clip": take_clip, "layer": layer, "layer_take": layer_take,
           "layer_clip": layer_clip, "own": own, "own_clip": own_clip}
    return b"".join(t + struct.pack("<I", len(x)) + x for t, x in chunks), did


@pytest.mark.game
def test_a_mod_made_with_unwise_comes_in_as_takes_a_layer_and_a_clip_of_its_own(session, tmp_path):
    from audiodiver import patch
    s, ix = session, session.ix
    bid = int(AUTOCANNON[5:])
    bank, did = _unwise(ix, bid)
    path = tmp_path / "9ba626afa44a3aa3.patch_0"
    patch.write_patch(str(path), {}, {bid: bank}, {bid: ix.bank_files(bid)[1]})
    found = add.from_patch(ix, patch.diff(str(path), ix))
    assert [t[:3] for t in found.takes] == [(did["ref"], did["take"], did["take_clip"]),
                                            (did["layer"], did["layer_take"], did["layer_clip"])]
    assert found.layers == [(did["layer"], did["ref"], 3.0)]  # beside the container it was copied from
    assert [o[:2] for o in found.own] == [(did["own"], did["own_clip"])]
    assert found.replaced == {} and found.left == []

    s.new_project(tmp_path / "u.audi", "U")
    job = s.import_patch(str(path))
    while (j := s.job(job["id"]))["state"] == "running":
        time.sleep(0.2)
    assert j["state"] == "done" and j["result"]["added"] == 3 and j["result"]["left"] == []
    st = s.project_state()
    assert sorted(a["kind"] for a in st["additions"]) == ["layer", "own", "take", "take"]
    assert st["assignments"][str(did["layer_clip"])]["gain_db"] == 3.0  # the layer's own Make-Up Gain
    assert st["outside"] == [] and st["library"]
    j2 = s.import_patch(str(path))  # again: the same additions take the audio again, none twice
    while s.job(j2["id"])["state"] == "running":
        time.sleep(0.2)
    assert len(s.project_state()["additions"]) == 4

    # an import adds to what the project has, or replaces its audio; Undo takes either back whole
    other = next(t for t in ix.stream_of if str(t) not in st["assignments"])
    s.project.replacements.append(Replacement(target=other, audio="mine.wav"))
    s.project.library.append("deploy/loadout")
    s.project.segment_overrides[1] = {"entry_marker": 10.0}
    for mode, kept in (("add", True), ("replace", False)):
        j3 = s.import_patch(str(path), mode)
        while (j := s.job(j3["id"]))["state"] == "running":
            time.sleep(0.2)
        assert j["state"] == "done", j
        st3 = s.project_state()
        assert (str(other) in st3["assignments"]) is kept and ("deploy/loadout" in st3["library"]) is kept
        assert len(st3["additions"]) == 4 and str(did["layer_clip"]) in st3["assignments"]
    assert s.project.segment_overrides == {}
    s.undo()
    assert str(other) in s.project_state()["assignments"] and "deploy/loadout" in s.project.library
    with pytest.raises(EditorError):
        s.import_patch(str(path), "merge")


@pytest.mark.game
def test_a_segment_whose_timing_follows_new_audio_is_not_a_change_left_out(session):
    # a music mod built with fit timing changes its segments' lengths and cue points: the rebuild makes them again, so
    # the import doesn't list them as other changes (Audiodiver's own builds showed 6 to 30 "left out" per bank)
    ix, loadout_1 = session.ix, 371453169
    t, body = wbank.parse(ix.bank_files(ix.copies(loadout_1)[0])[0])[1][loadout_1]
    seg = music.MusicSegment.read(loadout_1, music.Reader(body))
    seg.duration_ms += 1500
    seg.markers = [(i, p + 1500 if k else p, n) for k, (i, p, n) in enumerate(seg.markers)]
    assert add._timing_only(body, seg.to_bytes()) and add._timing_only(body, body)
    seg.node.grid_offset += 10  # anything else of the segment is a change of its own
    assert not add._timing_only(body, seg.to_bytes())
