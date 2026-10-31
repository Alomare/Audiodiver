"""The radio switches (Init, radio.py), Low-Pass and High-Pass on a slot, and fades baked into new audio."""
import math
import struct
import wave

import numpy as np
import pytest

from audiodiver import addition, audio, bank as wbank, installed, music, patch, radio
from audiodiver.build import PATCH, make_patch
from audiodiver.project import Project, Replacement


def tone(path, seconds=1.0, rate=48000):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate)
        w.writeframes(b"".join(struct.pack("<h", 12000 if i % 40 < 20 else -12000) for i in range(int(rate * seconds))))
    return path


def levels(path):
    with wave.open(str(path)) as w:
        return np.abs(np.frombuffer(w.readframes(w.getnframes()), "<i2").reshape(-1, w.getnchannels())).max(axis=1)


def test_fades_shape_the_audio_and_keep_its_length(tmp_path):
    src = tone(tmp_path / "a.wav")
    out = audio.faded(src, 100, 200)
    v = levels(out)
    assert len(v) == 48000
    assert v[0] < 300 and v[2400:4800].max() > 6000 and v[24000] >= 11900  # up over the first 100 ms, then full
    assert v[-1] < 300 and v[-4800:].max() < 6500 and v[-9700:-9500].max() > 11000  # down over the last 200 ms
    assert audio.faded(src, 100, 200) == out  # made once
    assert audio.faded(src, 100, 201) != out


def test_equal_fades_go_on_each_end_and_a_long_fade_stops_at_the_audio(tmp_path):
    src = tone(tmp_path / "a.wav")
    v = levels(audio.faded(src, 50.0, 50.0))
    assert v[0] < 300 and v[-1] < 300 and v[24000] >= 11900
    v = levels(audio.faded(src, 5000, 0))
    assert len(v) == 48000 and v[0] < 300 and v[-1] > 11000


def test_the_project_file_keeps_filters_fades_and_the_radio(tmp_path):
    p = Project(name="P", path=tmp_path / "p.audi", replacements=[Replacement(5, "a.wav", fade_in_ms=20.0)],
                filters={7: [40, 0]}, radio_off={"eagle", "admiral"}, radio_quieter=True)
    d = p.to_json()
    assert d["filters"] == {"7": [40, 0]} and d["radio_off"] == ["admiral", "eagle"] and d["radio_quieter"] is True
    assert d["replacements"][0]["fade_in_ms"] == 20.0 and "fade_out_ms" not in d["replacements"][0]
    q = Project.from_json(d, tmp_path / "p.audi")
    assert (q.filters, q.radio_off, q.radio_quieter) == ({7: [40, 0]}, {"eagle", "admiral"}, True)
    assert q.replacements[0].fade_in_ms == 20.0
    plain = Project(name="P", path=tmp_path / "p.audi", replacements=[Replacement(5, "a.wav")]).to_json()
    assert not {"filters", "radio_off", "radio_quieter"} & set(plain) and "fade_in_ms" not in plain["replacements"][0]
    d.update(filters={"7": [400, 0], "8": [0, 0]}, radio_off=["eagle", "not_a_voice"])
    q = Project.from_json(d, tmp_path / "p.audi")
    assert q.filters == {7: [100, 0]} and q.radio_off == {"eagle"}


def game():
    from audiodiver.game import Game
    from audiodiver.index import AudioIndex
    return AudioIndex(game=Game())


@pytest.fixture(scope="module")
def ix():
    return game()


def diff_positions(a, b):
    return [k for k, (x, y) in enumerate(zip(a, b)) if x != y]


@pytest.mark.game
def test_every_voice_off_is_seven_bytes_of_init_and_nothing_else(ix, tmp_path):
    p = Project(name="R", path=tmp_path / "r.audi", radio_off=set(radio.FAMILIES))
    edits = make_patch(p, ix, tmp_path, log=lambda *_: None)  # verified
    init = radio.init_of(ix)
    assert list(edits) == [init] and sorted(edits[init].radio) == sorted(b for bs in radio.FAMILIES.values() for b in bs)
    made = next(d for _, d in patch._files(str(tmp_path / PATCH), patch.WWISE_BANK, init))
    raw, dep = ix.bank_files(init)
    assert len(made) == len(raw) and len(diff_positions(raw, made)) == 7
    assert [d for _, d in patch._files(str(tmp_path / PATCH), patch.WWISE_DEP)] == [dep]


@pytest.mark.game
def test_one_voice_leaves_the_others_filtered(ix, tmp_path):
    p = Project(name="R", path=tmp_path / "r.audi", radio_off={"eagle"})
    edits = make_patch(p, ix, tmp_path, log=lambda *_: None)
    assert edits[radio.init_of(ix)].radio == list(radio.FAMILIES["eagle"])


@pytest.mark.game
def test_quieter_lowers_bus_volume_on_those_buses_and_only_there(ix, tmp_path):
    p = Project(name="R", path=tmp_path / "r.audi", radio_off={"eagle", "pelican"}, radio_quieter=True)
    make_patch(p, ix, tmp_path, log=lambda *_: None)
    init = radio.init_of(ix)
    made = next(d for _, d in patch._files(str(tmp_path / PATCH), patch.WWISE_BANK, init))
    before = {(t, i): b for t, i, b in radio.entries_of(ix.bank_files(init)[0])}
    after = {(t, i): b for t, i, b in radio.entries_of(bytes(made))}
    assert list(before) == list(after)
    assert {k[1] for k in before if before[k] != after[k]} == {2421160179, 2211648952}
    was = radio.props(before[(radio.BUS, 2421160179)]).get(radio.BUS_VOLUME, 0.0)
    assert radio.props(after[(radio.BUS, 2421160179)])[radio.BUS_VOLUME] == was + radio.QUIETER_DB
    # the one that had no Bus Volume takes it in id order, and keeps its other props
    new = radio.props(after[(radio.BUS, 2211648952)])
    assert list(new) == sorted(new) and new[radio.BUS_VOLUME] == radio.QUIETER_DB
    assert {k: v for k, v in new.items() if k != radio.BUS_VOLUME} == radio.props(before[(radio.BUS, 2211648952)])


@pytest.mark.game
def test_import_reads_the_switches_and_a_rebuild_drops_the_rest_of_a_mods_init(ix, tmp_path):
    init = radio.init_of(ix)
    raw, dep = ix.bank_files(init)
    mod = patch.apply_radio(raw, radio.Plan({"admiral"}, True))[0]
    # the mod's Init also has another mix on a bus that has nothing to do with the radio: Volume on vo_radio
    stale = bytes(radio.with_bus_volume(next(b for t, i, b in radio.entries_of(mod) if i == 641270256), 9.0))
    mod = patch._with_objects(mod, lambda t, i, b: stale if t == radio.BUS and i == 641270256 else None)[0]
    path = str(tmp_path / PATCH)
    patch.write_patch(path, {}, {init: mod}, {init: dep})
    found = addition.from_patch(ix, patch.diff(path, ix))
    assert found.radio.off == {"admiral"} and found.radio.quieter is True and found.other == {init: 1}
    state = installed.check_patch(path, ix)
    assert state["state"] == installed.SHARED and state["objects"] == 1  # the stale mix reaches every sound

    p = Project(name="R", path=tmp_path / "r.audi", radio_off=found.radio.off, radio_quieter=found.radio.quieter)
    out = tmp_path / "again"
    out.mkdir()
    make_patch(p, ix, out, log=lambda *_: None)
    assert installed.check_patch(str(out / PATCH), ix)["state"] == installed.CURRENT


@pytest.mark.game
def test_the_check_refuses_an_init_with_anything_else_changed(ix, tmp_path):
    init = radio.init_of(ix)
    raw, dep = ix.bank_files(init)
    plan = radio.Plan({"eagle"}, False)
    mod = patch.apply_radio(patch.apply_radio(raw, plan)[0], radio.Plan({"pelican"}, False))[0]
    path = str(tmp_path / PATCH)
    patch.write_patch(path, {}, {init: mod}, {init: dep})
    assert any("Init" in p for p in patch.verify(path, [], ix, radio_plan=plan))


def sound_with(ix, low, high=0):
    """A Sound in a small bank that plays a clip of its own, its bank, and the Low-Pass and High-Pass it has."""
    for bid, b in sorted(ix.banks.items(), key=lambda kv: len(kv[1].get("objects") or ())):
        if not 2 < len(b.get("objects") or ()) < 400:
            continue
        for t, i, body in music.iter_hirc(wbank.hirc(ix.bank_files(bid)[0])):
            if t == wbank.SOUND and len(sources := wbank.source_ids(t, body)) == 1:
                have = wbank.props(t, body)
                if have.get(patch.LOWPASS, 0) == low and have.get(patch.HIGHPASS, 0) == high and ix.banks_for(sources[0]) == {bid}:
                    return bid, i, sources[0]
    raise AssertionError("no such sound")


@pytest.mark.game
def test_filters_on_the_original_go_on_the_sound_and_add_to_the_game(ix, tmp_path):
    bid, sound, clip = sound_with(ix, 0)
    p = Project(name="F", path=tmp_path / "f.audi", filters={clip: [40, 15]})
    edits = make_patch(p, ix, tmp_path, log=lambda *_: None)  # verified, audio untouched
    assert sound in edits[bid].filters and not edits[bid].media
    _, hirc = patch.read_patch(str(tmp_path / PATCH))[0][bid]
    have = wbank.props(*hirc[sound])
    assert have[patch.LOWPASS] == 40 and have[patch.HIGHPASS] == 15


@pytest.mark.game
def test_a_filter_and_new_audio_on_one_slot_stay_one_replacement(ix, tmp_path):
    bid, sound, clip = sound_with(ix, 0)
    wav = tone(tmp_path / "new.wav")
    p = Project(name="F", path=tmp_path / "f.audi", replacements=[Replacement(clip, "new.wav", fade_out_ms=100.0)],
                filters={clip: [60, 0]}, gains={})
    edits = make_patch(p, ix, tmp_path, log=lambda *_: None)
    _, streams = patch.read_patch(str(tmp_path / PATCH))
    assert (clip in edits[bid].media or streams) and sound in edits[bid].filters and wav.exists()
