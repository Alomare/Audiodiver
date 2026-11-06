"""Patch Content (patchcontent.py, Session.content_*): a mod's own banks as the base, and new audio for sounds in them,
also for sounds the game no longer has."""
import json
import math
import struct
import time
import wave
import zipfile
from pathlib import Path

import pytest

from audiodiver import bank as wbank
from audiodiver import patch, patchcontent, wem
from audiodiver.build import encode_cached
from audiodiver.editor import EditorError, Session
from audiodiver.game import WWISE_BANK, WWISE_DEP

FLAG = 33562081688512528  # content/audio/obj_gen_raise_flag: 7.2.2 took the anthem out of it
ANTHEM = 190505498        # one of the anthem's clips, which no bank of the game has since
GUID = "6f1d2a3b-4c5d-4e6f-8a9b-0c1d2e3f4a5b"


@pytest.fixture(scope="module")
def session():
    s = Session()
    s.wait_ready()
    return s


def tone(path: Path, hz=880, seconds=1.0) -> Path:
    rate = 48000
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(b"".join(struct.pack("<h", int(9000 * math.sin(2 * math.pi * hz * i / rate))) for i in range(int(rate * seconds))))
    return path


def renamed(bank: bytes, old: int, new: int) -> bytes:
    """The bank with a clip under another ID, in its media table and in the Sounds that play it: as the bank of an
    older game version holds a clip the game took out since."""
    chunks = wbank.chunks(bank)
    for c in chunks:
        if c[0] == b"DIDX":
            body = bytearray(c[1])
            for i in range(0, len(body), 12):
                if struct.unpack_from("<I", body, i)[0] == old:
                    struct.pack_into("<I", body, i, new)
            c[1] = bytes(body)
    bank = b"".join(x for t, b in chunks for x in (t, struct.pack("<I", len(b)), bytes(b)))

    def change(t, oid, body):
        if t == wbank.SOUND and struct.unpack_from("<I", body, 5)[0] == old:
            body = bytearray(body)
            struct.pack_into("<I", body, 5, new)
            return body
    return patch._with_objects(bank, change)[0]


def older_mod(s, folder: Path) -> tuple[Path, int]:
    """A mod as one made before 7.2.2 would be: the raise-flag bank holding a clip as the anthem (ANTHEM), with its
    name (the dep) and a string table carried beside it. Returns (the patch, the clip it renamed)."""
    ix = s.ix
    assert ANTHEM not in ix.holders and ANTHEM not in ix.users, "the game has the anthem again"
    raw, dep = ix.bank_files(FLAG)
    media, hirc = wbank.parse(raw)
    plays = {struct.unpack_from("<I", b, 5)[0] for t, b in hirc.values() if t == wbank.SOUND}
    old = next(sid for sid in sorted(media) if sid in plays)
    folder.mkdir(parents=True)
    path = folder / "9ba626afa44a3aa3.patch_0"
    text = patch.Carried(fid=0x1234, tid=0x0D4E0E4E2B6D40C2, data=b"carried as it was")
    patch.write_patch(str(path), {}, {FLAG: renamed(raw, old, ANTHEM)}, {FLAG: dep}, carried=[text])
    return path, old


def wait(s, job):
    while (j := s.job(job["id"]))["state"] == "running":
        time.sleep(0.2)
    return j


@pytest.mark.game
def test_a_mods_own_bank_takes_new_audio_for_a_sound_the_game_removed(session, tmp_path):
    s = session
    base, old = older_mod(s, tmp_path / "Old Anthem")
    got = s.content_scan(str(base))
    rows = {int(r["source"]): r for r in got["sounds"]}
    assert rows[ANTHEM]["in_game"] is False and rows[ANTHEM]["kind"] == "bank"
    assert old not in rows, "the clip went by the other ID"
    assert all(r["in_game"] for sid, r in rows.items() if sid != ANTHEM)
    assert got["sounds"][0]["source"] == str(ANTHEM), "what the game no longer has comes first"
    assert rows[ANTHEM]["banks"] and rows[ANTHEM]["duration_ms"] > 0
    assert Path(s.content_preview(ANTHEM)["path"]).is_file()

    new = tone(tmp_path / "new.wav")
    j = wait(s, s.content_write({str(ANTHEM): str(new)}, name="Anthem Test", folder=str(tmp_path / "out")))
    assert j["state"] == "done", j
    made = j["result"]
    assert (made["sounds"], made["patches"], made["banks"], made["manifest"]) == (1, 1, 1, False)
    with zipfile.ZipFile(made["zip"]) as z:
        key = next(n for n in z.namelist() if n.endswith(".patch_0"))
        (tmp_path / "x").mkdir()
        out = tmp_path / "x" / "9ba626afa44a3aa3.patch_0"
        out.write_bytes(z.read(key))
    (m0, h0), (m1, h1) = wbank.parse(dict(patch._files(str(base), WWISE_BANK))[FLAG]), wbank.parse(dict(patch._files(str(out), WWISE_BANK))[FLAG])
    assert m1[ANTHEM] == wem.with_codebook_hash(encode_cached(new)), "the new audio, whole, as the bank holds the clip"
    assert {k: v for k, v in m1.items() if k != ANTHEM} == {k: v for k, v in m0.items() if k != ANTHEM}
    changed = [oid for oid in h0 if h0[oid] != h1[oid]]
    assert changed and all(h0[o][0] == wbank.SOUND and struct.unpack_from("<I", h0[o][1], 5)[0] == ANTHEM for o in changed)
    assert dict(patch._files(str(out), WWISE_DEP)) == dict(patch._files(str(base), WWISE_DEP)), "the bank keeps its name"
    assert patch.verify_carried(str(out), patch.carried_of(str(base))) == [], "the string table as it was"


@pytest.mark.game
def test_a_mod_with_a_manifest_stays_the_mod_it_was(session, tmp_path):
    s = session
    base, _ = older_mod(s, tmp_path / "src")
    manifest = {"Version": 1, "Guid": GUID, "Name": "Flag Anthem", "Description": "The old anthem.", "Options": []}
    mod = tmp_path / "Flag Anthem.zip"
    with zipfile.ZipFile(mod, "w") as z:
        z.writestr("manifest.json", json.dumps(manifest))
        z.write(base, "Flag Anthem/04f60fc9a8eec97d.patch_0")
        z.writestr("Flag Anthem/readme.txt", "kept")
    s.content_scan(str(mod))
    j = wait(s, s.content_write({str(ANTHEM): ""}, folder=str(tmp_path / "out")))
    assert j["state"] == "done", j
    assert j["result"]["kept_id"] and j["result"]["name"] == "Flag Anthem"
    with zipfile.ZipFile(j["result"]["zip"]) as z:
        names = set(z.namelist())
        assert names == {"manifest.json", "Flag Anthem/04f60fc9a8eec97d.patch_0", "Flag Anthem/readme.txt"}, names
        assert json.loads(z.read("manifest.json"))["Guid"] == GUID
        assert z.read("Flag Anthem/readme.txt") == b"kept"
        written = tmp_path / "w.patch_0"
        written.write_bytes(z.read("Flag Anthem/04f60fc9a8eec97d.patch_0"))
    media, hirc = wbank.parse(dict(patch._files(str(written), WWISE_BANK))[FLAG])
    sound = next(b for t, b in hirc.values() if t == wbank.SOUND and struct.unpack_from("<I", b, 5)[0] == ANTHEM)
    assert wbank.props(wbank.SOUND, sound).get(patch.VOLUME) == patch.MUTE_DB, "silence leaves the mix"


@pytest.mark.game
def test_what_patch_content_refuses(session, tmp_path):
    s = session
    base, old = older_mod(s, tmp_path / "m")
    (tmp_path / "empty").mkdir()
    with pytest.raises(EditorError, match="holds no patch file"):
        s.content_scan(str(tmp_path / "empty"))
    s.content_scan(str(base))
    for choices, why in [({}, "Give a sound new audio"), ({"123": ""}, "no sound 123"), ({str(old): ""}, "no sound"),
                         ({str(ANTHEM): str(tmp_path / "gone.wav")}, "wasn't found")]:
        with pytest.raises(EditorError, match=why):
            s.content_write(choices, folder=str(tmp_path / "out"))
    with pytest.raises(EditorError, match="game folder"):
        s.content_write({str(ANTHEM): ""}, folder=str(s.ix.game.data))


def test_a_rewrite_that_changes_more_than_the_audio_fails_the_check(tmp_path):
    # verify reads the patches as they are: a bank whose other media changed is caught
    data = bytes(range(256)) * 4
    bank = lambda media: _bank({10: data, 11: media})
    a, b = tmp_path / "a.patch_0", tmp_path / "b.patch_0"
    patch.write_patch(str(a), {}, {5: bank(b"one")}, {})
    patch.write_patch(str(b), {}, {5: bank(b"two")}, {})
    rep = patch.Replacement(10, data)
    assert patchcontent.verify(a, a, {10: rep}, {10: None}) == []
    assert any("media 11 changed" in p for p in patchcontent.verify(a, b, {10: rep}, {10: None}))


def _bank(media: dict) -> bytes:
    """A bank of media alone (DIDX and DATA), enough for verify."""
    rows, blob = b"", b""
    for sid, m in media.items():
        rows += struct.pack("<III", sid, len(blob), len(m))
        blob += m
    chunk = lambda tag, body: tag + struct.pack("<I", len(body)) + body
    return chunk(b"BKHD", struct.pack("<II", 154, 5)) + chunk(b"DIDX", rows) + chunk(b"DATA", blob)
