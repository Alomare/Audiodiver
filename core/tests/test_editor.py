"""The editor session and its HTTP API. Unit tests need nothing; `game` tests read the installed game."""
import json
import threading
import urllib.error
import urllib.parse
import urllib.request
import wave
from http.server import ThreadingHTTPServer

import pytest

from audiodiver.editor import EditorError, Session
from audiodiver.server import make_handler


def _wav(path, seconds=0.2):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(48000)
        w.writeframes(bytes(int(48000 * seconds) * 2))
    return path


# --- HTTP layer (no game)
@pytest.fixture
def server():
    s = Session(load=False)
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(s, "tok"))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{httpd.server_address[1]}", s
    httpd.shutdown()


def _post(base, method, token="tok", **args):
    req = urllib.request.Request(f"{base}/api/{method}", data=json.dumps(args).encode(),
                                 headers={"Content-Type": "application/json", "X-Audiodiver-Token": token})
    try:
        return 200, json.load(urllib.request.urlopen(req))
    except urllib.error.HTTPError as e:
        return e.code, json.load(e)


def test_api_needs_the_token(server):
    base, _ = server
    assert _post(base, "status", token="wrong")[0] == 403
    code, body = _post(base, "status")
    assert code == 200 and body["result"]["stage"] == "starting"


def test_api_reports_errors_as_messages(server):
    base, _ = server
    assert _post(base, "no_such_method")[0] == 404
    code, body = _post(base, "index")
    assert code == 400 and "loading" in body["error"]


def test_project_edits_autosave_and_undo_without_the_game(tmp_path):
    s = Session(load=False)
    s.new_project(tmp_path / "m.audi", "M")
    a = _wav(tmp_path / "a.wav")
    s._edit("assign", lambda p: s._set(p, 1234, str(a)))
    assert json.loads((tmp_path / "m.audi").read_text())["replacements"][0]["audio"] == "a.wav"
    st = s.update(1234, gain_db=8)
    assert st["assignments"]["1234"]["gain_db"] == 8.0
    assert s.undo()["assignments"]["1234"]["gain_db"] == 0.0
    assert s.redo()["assignments"]["1234"]["gain_db"] == 8.0
    assert s.unassign([1234])["assignments"] == {}
    with pytest.raises(EditorError):
        s.update(1234, volume=3)


def test_save_writes_the_project_file_now(tmp_path):
    s = Session(load=False)
    s.new_project(tmp_path / "m.audi", "M")
    (tmp_path / "m.audi").write_text("{}")  # changed on disk meanwhile: Ctrl+S puts the open project back
    st = s.save_project()
    assert st["name"] == "M" and json.loads((tmp_path / "m.audi").read_text())["name"] == "M"
    s.close_project()
    with pytest.raises(EditorError):
        s.save_project()


def test_relative_audio_paths_and_rejects_non_audio(tmp_path):
    s = Session(load=False)
    s.new_project(tmp_path / "proj" / "m.audi", "M")
    (tmp_path / "music").mkdir()
    a = _wav(tmp_path / "music" / "x.wav")
    assert s._relative(s.project, a) == "../music/x.wav"
    (tmp_path / "notes.txt").write_text("x")
    with pytest.raises(EditorError):
        s._relative(s.project, tmp_path / "notes.txt")


# --- what the mod is packaged as, and where (the Build tab)
def _image(path, size=(300, 200), color=(200, 40, 40)):
    from PIL import Image
    Image.new("RGB", size, color).save(path)
    return path


def _png_size(data: bytes):
    import io
    from PIL import Image
    with Image.open(io.BytesIO(data)) as img:
        return img.format, img.size


def _pixels(data: bytes):
    import io
    from PIL import Image
    return Image.open(io.BytesIO(data)).convert("RGBA")


def test_package_settings_save_undo_and_flag_a_name_arsenal_rejects(tmp_path):
    s = Session(load=False)
    guid = s.new_project(tmp_path / "m.audi", "My Mod")["guid"]
    st = s.settings(description="  Epic music.  ", icon={"border": "12"})
    assert st["description"] == "Epic music." and st["icon"] == {"border": 12} and st["zip_name"] == "my_mod-1.zip"
    assert json.loads((tmp_path / "m.audi").read_text())["description"] == "Epic music."
    assert s.undo()["description"] == "" and s.redo()["description"] == "Epic music."  # undo steps keep the field
    assert s.settings(guid="new")["guid"] != guid and s.undo()["guid"] == guid
    assert s.settings(name="Trilha Épica")["problems"] == [
        'name "Trilha Épica": HD2 Arsenal can\'t use É in a name (letters, digits, spaces and - _ ( ) are fine)']
    with pytest.raises(EditorError):
        s.settings(icon="cover.png")  # an image goes through set_icon, which checks it


def test_an_image_becomes_the_icon_and_is_fitted_to_540(tmp_path):
    s = Session(load=False)
    assert s.new_project(tmp_path / "proj" / "m.audi", "M")["icon"] == {}
    default = s.icon()  # no image yet: Audiodiver's own icon, its yellow logo on a dark tile
    img = _pixels(default)
    assert _png_size(default) == ("PNG", (540, 540)) and img.getpixel((4, 4)) == (26, 26, 26, 255)
    assert img.getpixel((270, 280)) == (255, 232, 0, 255)  # between the skull's eyes
    (tmp_path / "art").mkdir()
    st = s.set_icon(_image(tmp_path / "art" / "cover.jpg"))
    assert st["icon"] == {"image": "../art/cover.jpg"} and st["problems"] == []  # stays where it is
    assert _png_size(s.icon()) == ("PNG", (540, 540)) and s.icon() != default
    assert s.undo()["icon"] == {} and s.icon() == default
    exact = tmp_path / "exact.png"
    _image(exact, (540, 540))
    s.set_icon(exact)
    assert s.icon() == exact.read_bytes()  # already what Arsenal wants: packaged untouched
    exact.unlink()
    assert any(p.startswith("icon: image not found") for p in s.project_state()["problems"])
    (tmp_path / "notes.txt").write_text("x")
    with pytest.raises(EditorError):
        s.set_icon(tmp_path / "notes.txt")


def test_icon_is_served_to_the_ui(server, tmp_path):
    base, s = server
    def get(query=""):
        try:
            with urllib.request.urlopen(f"{base}/project/icon?token=tok{query}") as r:
                return r.status, r.headers["Content-Type"], r.read()
        except urllib.error.HTTPError as e:
            return e.code, None, b""
    preview = lambda icon: "&icon=" + urllib.parse.quote(json.dumps(icon))
    assert get()[0] == 404  # no project open
    s.new_project(tmp_path / "m.audi", "M")
    code, kind, data = get()
    assert (code, kind) == (200, "image/png") and data == s.icon()
    trying = {"border": 20, "border_color": "#2f6db5"}
    assert get(preview(trying))[2] == s.icon(trying) != data
    assert get(preview({}))[2] == data
    assert get(preview({"border_color": "red"}))[0] == 404  # not a colour: no picture, and nothing saved
    assert s.project.icon == {}


def test_icon_frame_is_checked_and_goes_on_the_default_icon_and_on_an_image(tmp_path):
    s = Session(load=False)
    st = s.new_project(tmp_path / "m.audi", "M")
    assert st["icon_frame"] == {"border": 0, "border_color": "#ffd400", "radius": 0}
    st = s.settings(icon={"border_color": "#FF0000", "radius": 600, "title": "no longer a thing"})
    assert st["icon"] == {"border_color": "#ff0000", "radius": 270}
    assert st["icon_frame"] == {"border": 0, "border_color": "#ff0000", "radius": 270}  # the rest: defaults
    for bad in ({"border_color": "yellow"}, {"border": "thick"}, {"radius": None}):
        with pytest.raises(EditorError):
            s.settings(icon=bad)
    img = _pixels(s.icon())  # the default icon as a circle: see-through outside it
    assert img.getpixel((0, 0))[3] == 0 and img.getpixel((270, 20)) == (26, 26, 26, 255)
    # an image takes the frame as it is, and going back to the default icon keeps it too
    st = s.set_icon(_image(tmp_path / "cover.png", (540, 540)))
    assert st["icon"] == {"border_color": "#ff0000", "radius": 270, "image": "cover.png"}
    img = _pixels(s.icon())
    assert img.getpixel((0, 0))[3] == 0 and img.getpixel((270, 270))[:3] == (200, 40, 40)
    st = s.settings(icon={**st["icon"], "border": 20, "border_color": "#ffffff"})
    assert _pixels(s.icon()).getpixel((270, 8))[:3] == (255, 255, 255)  # the border is drawn over the picture's edge
    st = s.settings(icon={k: v for k, v in st["icon"].items() if k != "image"})
    assert st["icon"] == {"border": 20, "border_color": "#ffffff", "radius": 270}
    assert _pixels(s.icon()).getpixel((270, 8))[:3] == (255, 255, 255)
    with pytest.raises(EditorError):  # an image only comes in through set_icon, which checks it...
        s.set_icon(tmp_path / "missing.png")
    assert s.settings(icon={"image": "elsewhere.png", "border": 4})["icon"] == {"border": 4}  # ...not settings


def test_old_projects_load_their_icon_and_skipped_slots(tmp_path):
    from audiodiver.project import Project
    old = {"audiodiver": 1, "name": "Old", "guid": "613bc667-0000-4000-8000-000000000000", "icon": "art/cover.jpg",
           "replacements": [{"target": "5938561", "audio": "silence (skipped).wav", "label": "skipped",
                             "gain_db": 0, "fit_timing": True}]}
    (tmp_path / "old.audi").write_text(json.dumps(old))
    p = Project.load(tmp_path / "old.audi")
    assert p.icon == {"image": "art/cover.jpg"} and p.replacements[0].silence and p.replacements[0].audio == ""
    assert p.to_json()["replacements"][0]["silence"] is True and p.build_folder == ""
    # an icon made from text, when there was such a thing: the text and its fonts go, the frame and the image stay
    old["icon"] = {"title": "Dune", "subtitle": "OST overhaul", "title_font": "swiss", "title_color": "#ffd400",
                   "background": "#181b20", "border": 12, "image": "art/cover.jpg"}
    (tmp_path / "old.audi").write_text(json.dumps(old))
    p = Project.load(tmp_path / "old.audi")
    assert p.icon == {"border": 12, "image": "art/cover.jpg"} and p.to_json()["icon"] == p.icon


def test_builds_go_to_a_chosen_folder_or_next_to_the_project(tmp_path, monkeypatch):
    s = Session(load=False)
    st = s.new_project(tmp_path / "proj" / "m.audi", "M")
    default = str(tmp_path / "proj" / "build")
    assert st["build_folder"] == st["build_folder_default"] == default
    out = tmp_path / "builds"
    out.mkdir()
    st = s.settings(build_folder=str(out))
    assert st["build_folder"] == str(out) and st["build_folder_default"] == default
    assert json.loads((tmp_path / "proj" / "m.audi").read_text())["build_folder"] == "../builds"  # moves with it
    (out / "m-3.zip").write_bytes(bytes(1_000_000))
    (out / "other_mod-9.zip").write_bytes(b"")  # another mod builds here too
    assert s.project_state()["last_build"]["zip"] == str(out / "m-3.zip")
    assert s.undo()["build_folder"] == default and s.redo()["build_folder"] == str(out)
    assert s.settings(build_folder=None)["build_folder"] == default
    (tmp_path / "proj" / "build").mkdir()
    s.settings(build_folder=str(out))
    assert s.settings(build_folder=default)["build_folder"] == default  # the default, chosen by hand
    assert json.loads((tmp_path / "proj" / "m.audi").read_text())["build_folder"] == ""
    for bad in (tmp_path / "missing", tmp_path / "proj" / "m.audi", "builds"):
        with pytest.raises(EditorError, match="is not a folder"):
            s.settings(build_folder=str(bad))
    game = tmp_path / "Helldivers 2"
    (game / "data").mkdir(parents=True)
    (game / "bin").mkdir()
    s.game_where = {"path": str(game / "data"), "how": "steam"}
    for inside in (game, game / "data", game / "bin"):
        with pytest.raises(EditorError, match="inside the game's"):
            s.settings(build_folder=str(inside))
    assert s.project_state()["build_folder"] == default


def test_silence_is_built_in_and_says_how_it_times(tmp_path):
    s = Session(load=False)
    s.new_project(tmp_path / "m.audi", "M")
    st = s.silence([1234])
    a = st["assignments"]["1234"]
    assert a["silence"] and a["exists"] and a["fit_timing"] and a["name"] == "Silence" and a["duration_ms"] == 100
    assert st["problems"] == [] and not list(tmp_path.glob("*.wav"))  # nothing written next to the project
    saved = json.loads((tmp_path / "m.audi").read_text())["replacements"][0]
    assert saved["silence"] is True and saved["audio"] == ""
    assert s.silence([1234], keep_timing=True)["assignments"]["1234"]["fit_timing"] is False
    s._edit("assign", lambda p: s._set(p, 1234, str(_wav(tmp_path / "a.wav"))))  # a file in its place
    a = s.project_state()["assignments"]["1234"]
    assert not a["silence"] and a["fit_timing"] and a["name"] == "a.wav"
    assert "silence" not in json.loads((tmp_path / "m.audi").read_text())["replacements"][0]
    assert s.undo()["assignments"]["1234"]["silence"]
    from audiodiver.audio import silence_wav
    assert s.project.audio_path(s.project.replacements[0]) == silence_wav() and silence_wav().stat().st_size > 19000


def test_game_folder_is_checked_saved_and_found_from_the_game_or_library_folder(tmp_path, monkeypatch):
    from audiodiver import editor, game
    monkeypatch.setattr(editor, "SETTINGS_FILE", tmp_path / "settings.json")
    library = tmp_path / "SteamLibrary"
    data = library / "steamapps" / "common" / "Helldivers 2" / "data"
    data.mkdir(parents=True)
    (data / "bundles.00.nxa").write_bytes(b"")
    for picked in (data, data.parent, library):
        assert game.data_folder(picked) == data
    with pytest.raises(ValueError):
        game.data_folder(tmp_path)
    assert game.locate(str(data.parent)) == (data, "chosen")

    s = Session(load=False)
    loads = []
    monkeypatch.setattr(s, "_load_game", lambda: loads.append(1))
    with pytest.raises(EditorError):
        s.set_game_folder(data)  # still loading
    s.stage = "failed"
    with pytest.raises(EditorError):
        s.set_game_folder(tmp_path)  # no game in it: nothing changes
    assert not (tmp_path / "settings.json").exists() and not loads
    st = s.set_game_folder(data.parent)
    assert st["stage"] == "starting" and st["game_folder"] == {"path": str(data), "how": "chosen", "chosen": str(data)}
    assert json.loads((tmp_path / "settings.json").read_text()) == {"game_data": str(data)}
    import time
    time.sleep(0.05)
    assert loads == [1]
    s.stage = "ready"
    assert s.set_game_folder(None)["game_folder"]["chosen"] is None  # back to finding it through Steam
    assert json.loads((tmp_path / "settings.json").read_text()) == {}


def test_game_is_looked_for_in_order_and_a_folder_without_its_files_is_no_game(tmp_path, monkeypatch):
    from audiodiver import game
    library = tmp_path / "SteamLibrary"
    data = library / "steamapps" / "common" / "Helldivers 2" / "data"
    data.mkdir(parents=True)
    (data / "bundles.00.nxa").write_bytes(b"")
    monkeypatch.setattr(game, "_steam_roots", lambda: [str(tmp_path / "no steam here"), str(library)])
    monkeypatch.delenv("HD2_DATA", raising=False)
    found, how = game.locate()
    assert how == "steam" and found.samefile(data)

    elsewhere = tmp_path / "copy" / "data"
    elsewhere.mkdir(parents=True)
    monkeypatch.setenv("HD2_DATA", str(elsewhere))  # set, but the game isn't there: said in words, not guessed around
    with pytest.raises(FileNotFoundError, match="HD2_DATA"):
        game.locate()
    (elsewhere / "bundles.00.nxa").write_bytes(b"")
    assert game.locate() == (elsewhere, "env")                # the variable goes before Steam
    assert game.locate(str(library)) == (data, "chosen")      # and a folder chosen in Settings before both

    monkeypatch.delenv("HD2_DATA")
    (data / "bundles.00.nxa").unlink()                        # an uninstalled game can leave its folder behind
    with pytest.raises(FileNotFoundError, match="Steam"):
        game.locate()


def test_recent_projects_say_whether_they_are_still_there(tmp_path):
    from audiodiver.editor import projects_info
    s = Session(load=False)
    s.new_project(tmp_path / "file-name.audi", "Mod Name")
    here, gone = projects_info([str(tmp_path / "file-name.audi"), str(tmp_path / "moved.audi")])
    assert here["exists"] and here["name"] == "Mod Name" and here["modified"] > 0
    assert not gone["exists"] and gone["name"] == "moved" and gone["modified"] is None


def test_last_build_is_the_newest_zip(tmp_path):
    import os
    s = Session(load=False)
    assert s.new_project(tmp_path / "m.audi", "M")["last_build"] is None
    (tmp_path / "build").mkdir()
    for n, age in (("m-1.zip", 100), ("m-2.zip", 10), ("m-notes.zip", 5), ("my-3.zip", 1)):
        (tmp_path / "build" / n).write_bytes(bytes(2_000_000))
        os.utime(tmp_path / "build" / n, (1_700_000_000 - age, 1_700_000_000 - age))
    last = s.project_state()["last_build"]  # the newest ZIP named after this mod and a version, nothing else
    assert last["zip"].endswith("m-2.zip") and last["mb"] == 2.0 and last["modified"] == 1_700_000_000 - 10


def test_cache_is_sized_and_cleared_by_kind(tmp_path, monkeypatch):
    from audiodiver import editor
    monkeypatch.setattr(editor, "CACHE_DIR", tmp_path)
    for folder, size in (("preview", 300), ("render", 50), ("peaks", 5), ("wem", 70), ("logs", 9)):
        (tmp_path / folder).mkdir()
        (tmp_path / folder / "x").write_bytes(bytes(size))
    (tmp_path / "audio_index.json").write_text("{}")
    assert editor.cache_info() == {"folder": str(tmp_path), "previews": 355, "encoded": 70}
    assert editor.cache_clear("previews") == {"folder": str(tmp_path), "previews": 0, "encoded": 70}
    assert (tmp_path / "logs" / "x").exists() and (tmp_path / "audio_index.json").exists()  # never offered
    with pytest.raises(EditorError):
        editor.cache_clear("everything")


# --- with the game
@pytest.fixture(scope="module")
def game_session():
    s = Session()
    s.wait_ready()
    return s


@pytest.mark.game
def test_the_main_cues_are_named(game_session):
    by_name = {e["name"]: e for e in game_session.cues()}
    loadout = by_name["Loadout Selection"]
    assert loadout["path"] == ["Hellpod"] and len(loadout["slots"]) == 15
    assert "Drop Location Selection" in by_name and "Extraction" in by_name
    cue = game_session.cue(loadout["id"])
    assert [s["name"] for s in cue["segments_detail"][:2]] == ["Loadout Start", "Loadout #1"]


@pytest.mark.game
def test_fill_assigns_in_play_order_and_skips_taken_slots(game_session, tmp_path):
    s = game_session
    s.new_project(tmp_path / "f.audi", "F")
    files = [str(_wav(tmp_path / f"{i}.wav")) for i in range(3)]
    cue = s.cue(716451767)
    order = [sl["source"] for seg in cue["segments_detail"] for st in seg["stems"] for sl in st["slots"]]
    st = s.fill(716451767, files[:2])
    assert [st["assignments"][o]["name"] for o in order[:2]] == ["0.wav", "1.wav"]
    st = s.fill(716451767, files[2:], only_empty=True)
    assert st["assignments"][order[2]]["name"] == "2.wav"
    st = s.fill(716451767, files[:1], start_source=order[5])
    assert st["assignments"][order[5]]["name"] == "0.wav"


@pytest.mark.game
def test_fill_goes_in_natural_file_order_and_copy_move_are_one_step(game_session, tmp_path):
    s = game_session
    s.new_project(tmp_path / "q.audi", "Q")
    names = ["Track 10.wav", "Track 2.wav", "Track 1.wav"]
    files = [str(_wav(tmp_path / n, seconds=0.25)) for n in names]
    cue = s.cue(716451767)
    order = list(dict.fromkeys(sl["source"] for seg in cue["segments_detail"] for st in seg["stems"] for sl in st["slots"]))
    st = s.fill_sources(order[:3], files)
    assert [st["assignments"][o]["name"] for o in order[:3]] == ["Track 1.wav", "Track 2.wav", "Track 10.wav"]
    assert st["assignments"][order[0]]["duration_ms"] == 250.0 and st["undo_label"] == "fill"
    s.update(order[0], gain_db=4)
    st = s.copy_audio([[order[0], order[5]]])  # paste into an empty slot, settings included
    assert st["assignments"][order[5]]["name"] == "Track 1.wav" and st["assignments"][order[5]]["gain_db"] == 4.0
    st = s.swap(order[1], order[2])
    assert [st["assignments"][o]["name"] for o in order[1:3]] == ["Track 10.wav", "Track 2.wav"]
    assert st["undo_label"] == "move"
    st = s.swap(order[2], order[3])  # into an empty slot: a move
    assert order[2] not in st["assignments"] and st["assignments"][order[3]]["name"] == "Track 2.wav"
    st = s.undo()
    assert st["assignments"][order[2]]["name"] == "Track 2.wav" and st["redo_label"] == "move"


@pytest.mark.game
def test_player_and_waveform_can_ask_for_new_audio_at_once(game_session):
    """Clicking ▶ on a slot asks for its audio and its waveform together. Both used to decode it into the same temp
    file, and one failed ("no supported source", or a waveform stuck loading)."""
    from audiodiver.index import CACHE_DIR
    s = game_session
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(s, "tok"))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{httpd.server_address[1]}"
    cue = s.cue(716451767)
    sids = list(dict.fromkeys(sl["source"] for seg in cue["segments_detail"] for st in seg["stems"] for sl in st["slots"]))[:3]
    for sid in sids:
        for f in (CACHE_DIR / "preview").glob(f"{sid}*"):
            f.unlink()
    got = []
    def audio(sid):
        with urllib.request.urlopen(f"{base}/audio/vanilla/{sid}?token=tok") as r:
            got.append((r.status, r.read(4)))
    def peaks(sid):
        got.append(_post(base, "peaks", kind="vanilla", source=sid, buckets=64)[:1] + (b"RIFF",))
    ts = [threading.Thread(target=f, args=(sid,)) for sid in sids for f in (audio, peaks, audio)]
    [t.start() for t in ts]
    [t.join() for t in ts]
    httpd.shutdown()
    assert got == [(200, b"RIFF")] * len(ts)


@pytest.mark.game
def test_find_resolves_stream_ids_to_cues(game_session):
    hits = game_session.find("1622724751373655930")  # the WoS mod's stream id: hellpod descent
    first = hits[0]  # the music before the banks that hold it
    assert (first["cue"], first["source"], first["item"]) == ("978454350", "41628611", "deploy/descent") and first["archives"]


# --- audio helpers (need ffmpeg, not the game)
def _tone(path, seconds=1.0):
    import math, struct
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(48000)
        w.writeframes(b"".join(struct.pack("<hh", int(8000 * math.sin(i / 20)), i % 3000)
                               for i in range(int(48000 * seconds))))
    return path


def test_slices_join_back_into_the_song_sample_for_sample(tmp_path):
    from audiodiver import audio
    song = _tone(tmp_path / "song.wav", 1.0)
    pieces = audio.slice_song(song, [100, 333.3, 600, 950], tmp_path / "out")
    assert [p.name for p in pieces] == ["01 song.wav", "02 song.wav", "03 song.wav"]
    joined = b"".join(wave.open(str(p)).readframes(10 ** 9) for p in pieces)
    with wave.open(str(song)) as w:
        w.setpos(4800)
        assert joined == w.readframes(45600 - 4800)
    assert audio.previous_cuts(tmp_path / "out", song) == [100, 333.3, 600, 950]
    with pytest.raises(ValueError):
        audio.slice_song(song, [500, 400], tmp_path / "out2")


def test_peaks_follow_the_loudness(tmp_path, monkeypatch):
    from audiodiver import audio
    monkeypatch.setattr(audio, "CACHE_DIR", tmp_path / "cache")
    d = audio.peaks(_tone(tmp_path / "t.wav", 0.5), buckets=50)
    assert len(d["peaks"]) == 50 and abs(d["duration_ms"] - 500) < 2 and 40 < max(d["peaks"]) < 90


def test_peaks_are_the_same_with_numpy_or_without(tmp_path, monkeypatch):
    """numpy does the slice tool's 100,000 buckets at once; the plain loop is the fallback, with the same answer
    (also for more buckets than samples)."""
    import sys
    from audiodiver import audio
    pytest.importorskip("numpy")
    song, tiny = _tone(tmp_path / "t.wav", 0.6), _tone(tmp_path / "tiny.wav", 0.01)
    fast = [audio._peaks(song, 333), audio._peaks(tiny, 200)]
    monkeypatch.setitem(sys.modules, "numpy", None)  # import numpy now fails
    assert [audio._peaks(song, 333), audio._peaks(tiny, 200)] == fast


@pytest.mark.game
def test_a_sliced_song_goes_to_the_slots_given(game_session, tmp_path):
    """The slice tool sends one piece per segment, so layers that play together never get consecutive pieces."""
    s = game_session
    s.new_project(tmp_path / "s.audi", "S")
    song = _tone(tmp_path / "song.wav", 1.0)
    cue = s.cue(716451767)
    order = list(dict.fromkeys(sl["source"] for seg in cue["segments_detail"] for st in seg["stems"] for sl in st["slots"]))
    st = s.slice_fill(716451767, str(song), [0, 400, 1000], sources=[order[0], order[3]])
    assert st["assignments"][order[0]]["name"] == "01 song.wav" and st["assignments"][order[3]]["name"] == "02 song.wav"
    assert order[1] not in st["assignments"] and st["undo_label"] == "fill"


@pytest.mark.game
def test_cue_points_go_with_their_segments_new_audio(game_session, tmp_path):
    """Cue points are in ms of a segment's new audio. Taking the last of it off takes them off too; a build leaves
    out those of a segment without new audio (an older project can have them) and keeps the game's; and it refuses
    an Entry at or after the Exit, where the game would play the music before it on until the Entry."""
    from audiodiver import bank as wbank, patch
    from audiodiver.build import BuildError, make_patch
    s = game_session
    s.new_project(tmp_path / "c.audi", "C")
    segs = s.cue(716451767)["segments_detail"]
    first, second = (int(x["segment"]) for x in segs[:2])
    slot = segs[0]["stems"][0]["slots"][0]["source"]
    s.fill_sources([slot], [str(_tone(tmp_path / "a.wav", 0.5))])
    s.segment_override(first, entry_marker=100)
    assert s.unassign([slot])["segment_overrides"] == {}
    s.undo()
    s.project.segment_overrides[second] = {"entry_marker": 309362.0}  # as an older project left it
    lines = []
    make_patch(s.project, s.ix, tmp_path, log=lines.append)
    banks, _ = patch.read_patch(str(tmp_path / "9ba626afa44a3aa3.patch_0"))
    for bid, (_media, hirc) in banks.items():
        if second in hirc:
            assert hirc[second] == wbank.parse(s.ix.bank_files(bid)[0])[1][second]
    assert any("cue points of 1 segment without new audio left out" in x for x in lines)
    s.project.segment_overrides[first] = {"entry_marker": 600.0}  # past the new audio's end, where Exit is
    with pytest.raises(BuildError, match="Entry cue point"):
        make_patch(s.project, s.ix, tmp_path, log=lines.append)
