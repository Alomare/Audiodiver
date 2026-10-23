"""What the pre-release test suite found wrong in the core, kept fixed: edits that fail change nothing, damaged
project files and wrong input get words instead of tracebacks, slicing never takes pieces away, builds move the right
project on. Unit tests need nothing; `game` tests read the installed game."""
import json
import threading
import urllib.error
import urllib.request
import wave
from http.server import ThreadingHTTPServer

import pytest

from audiodiver import arsenal, audio
from audiodiver.editor import EditorError, Session, os_error, plain
from audiodiver.project import Project, ProjectFormatError
from audiodiver.server import byte_range, make_handler

MUSIC = 716451767  # a music cue with many slots (the same the editor tests use)


def _wav(path, seconds=0.5):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(48000)
        w.writeframes(bytes(int(48000 * seconds) * 2))
    return path


def _post(base, method, raw: bytes, token="tok"):
    req = urllib.request.Request(f"{base}/api/{method}", data=raw,
                                 headers={"Content-Type": "application/json", "X-Audiodiver-Token": token})
    try:
        return 200, json.load(urllib.request.urlopen(req, timeout=10))
    except urllib.error.HTTPError as e:
        return e.code, json.load(e)


@pytest.fixture
def server():
    s = Session(load=False)
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(s, "tok"))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{httpd.server_address[1]}", s
    httpd.shutdown()


# --- names and files
@pytest.mark.parametrize("name, problem", [
    ("Dune OST", None),
    ("", "A mod needs a name"),
    (" Spaced ", "The name starts or ends with a space"),
    ("---", "The name needs a letter or a digit"),
    ("Trilha Épica", "Mod managers can't use É in a name (letters, digits, spaces and - _ ( ) are fine)"),
    ("a/b", "Mod managers can't use / in a name (letters, digits, spaces and - _ ( ) are fine)"),
])
def test_names_hd2_arsenal_takes_and_why_not(name, problem):
    assert arsenal.name_problem(name) == problem
    assert arsenal.slug("---") == "mod"  # never an empty folder or ZIP name


def test_a_new_project_keeps_the_dots_in_its_name(tmp_path):
    s = Session(load=False)
    st = s.new_project(str(tmp_path / "Dune 2.0"), "")
    assert st["path"].endswith("Dune 2.0.audi") and st["name"] == "Dune 2.0"
    st = s.new_project(str(tmp_path / "  Spaced  .audi"), "  Spaced  ")
    assert st["name"] == "Spaced"


@pytest.mark.parametrize("content, words", [
    ('["a list"]', "isn't an Audiodiver project"),
    ('{"audiodiver": 1, "name": 123, "guid": "x", "library": []}', "damaged (its name)"),
    ('{"audiodiver": 1, "name": "A", "replacements": [{"target": "x", "audio": "a.wav"}]}', "damaged"),
    ('{"audiodiver": 1, "name": "A", "segment_overrides": [1]}', "damaged (its cue points)"),
    ('{"audiodiver": 9, "name": "A"}', "newer version of Audiodiver"),
    ('{"name": "A"}', "isn't an Audiodiver project"),
    ('not json', "is damaged (it can't be read)"),
])
def test_a_damaged_project_file_is_refused_in_words(tmp_path, content, words):
    f = tmp_path / "bad.audi"
    f.write_text(content, encoding="utf-8")
    s = Session(load=False)
    with pytest.raises(EditorError, match=words.replace("(", r"\(").replace(")", r"\)")):
        s.open_project(str(f))
    assert s.project is None  # nothing half open
    with pytest.raises(EditorError, match="is a folder"):
        s.open_project(str(tmp_path))
    with pytest.raises(EditorError, match="wasn't found"):
        s.open_project(str(tmp_path / "gone.audi"))


def test_odd_values_in_a_project_file_are_brought_into_range(tmp_path):
    d = {"audiodiver": 1, "name": "A", "guid": "not-a-guid", "version": 1e400, "library": [],
         "replacements": [{"target": "5", "audio": None, "gain_db": 1e400, "volume": 3}]}
    p = Project.from_json(d, tmp_path / "a.audi")
    r = p.replacements[0]
    assert r.audio == "" and r.gain_db == 0.0 and p.version == 1  # infinite numbers fall back, unknown keys go
    assert p.repairs == ["the Make-Up Gain of sound 5", "the version"]  # and opening says what it put right
    assert any("mod id" in x for x in p.problems())  # a damaged id is a problem to fix, not a crash


def test_values_of_the_wrong_kind_are_set_back_and_said(tmp_path):
    d = {"audiodiver": 1, "name": "A", "guid": "", "version": 2.5, "library": [], "loudness_analysis": "yes",
         "description": 5, "segment_overrides": {"7": {"entry_marker": "120", "exit_marker": "x"}, "8": {"exit_marker": True}},
         "replacements": [{"target": "5", "audio": "music/drop.wav", "label": 7, "gain_db": True, "fit_timing": "no"}]}
    p = Project.from_json(d, tmp_path / "a.audi")
    r = p.replacements[0]
    assert (r.label, r.gain_db, r.fit_timing) == ("", 0.0, True)
    assert (p.version, p.loudness_analysis, p.description) == (2, False, "")
    # a cue point that isn't a number goes (the automatic spot plays), it doesn't become 0 ms; a numeric string is fine
    assert p.segment_overrides == {7: {"entry_marker": 120.0}}
    assert p.repairs == ["the label of drop", "the Make-Up Gain of drop", "Fit timing for drop", "the version",
                         "Loudness analysis", "a cue point", "the description"]
    # a project's own snapshot (undo) has nothing to put right
    assert Project.from_json(p.to_json(), p.path).repairs == []


def test_os_errors_read_the_same_in_every_windows_language(tmp_path):
    import subprocess
    try:
        open(tmp_path / "missing" / "x.wav")
    except OSError as e:
        assert os_error(e).endswith("wasn't found")
    assert plain(TypeError("x")) == "Something went wrong (TypeError): the log has the details"
    assert plain(TypeError("x"), log_hint="") == "Something went wrong (TypeError)"  # the command line has no log
    assert plain(FileNotFoundError("HD2_DATA points nowhere")) == "HD2_DATA points nowhere"  # our own words stay
    ffmpeg = subprocess.CalledProcessError(1, ["ffmpeg", "-v", "error", "-y", "-i", "C:/in/song.flac", "C:/tmp/x.partial.wav"])
    assert plain(ffmpeg) == "ffmpeg couldn't process song.flac (the log has the details)"  # the input, not the output
    assert "couldn't process tone.wav" in plain(subprocess.CalledProcessError(1, ["ffprobe", "-v", "error", "tone.wav"]))


# --- edits
def test_an_edit_that_fails_half_way_changes_nothing(tmp_path):
    s = Session(load=False)
    s.new_project(str(tmp_path / "e.audi"), "E")
    with pytest.raises(EditorError):
        s.settings(name="Half Renamed", version="abc")  # the version is checked before the name is changed
    assert s.project.name == "E"

    def boom(p):
        p.name = "changed"
        raise ValueError("fails after changing")
    with pytest.raises(ValueError):
        s._edit("x", boom)
    assert s.project.name == "E" and not s.undo_stack


@pytest.mark.parametrize("fields, words", [
    ({"version": 0}, "whole number from 1"), ({"version": "2.7"}, "whole number"), ({"version": 10 ** 9}, "99999"),
    ({"name": None}, "text"), ({"loudness_analysis": "no"}, "on or off"), ({"guid": "nope"}, "isn't a mod id"),
])
def test_settings_say_what_they_take(tmp_path, fields, words):
    s = Session(load=False)
    s.new_project(str(tmp_path / "s.audi"), "S")
    with pytest.raises(EditorError, match=words):
        s.settings(**fields)


def test_cue_points_are_checked(tmp_path):
    s = Session(load=False)
    s.new_project(str(tmp_path / "c.audi"), "C")
    for kw in ({"entry_marker": -1}, {"exit_marker": float("inf")}, {"entry_marker": 500, "exit_marker": 100}):
        with pytest.raises(EditorError):
            s.segment_override(123, **kw)
    s.segment_override(123, entry_marker=100, exit_marker=500)
    assert s.project.segment_overrides[123] == {"entry_marker": 100.0, "exit_marker": 500.0}


# --- slicing
def test_slicing_again_never_takes_pieces_away(tmp_path):
    song = _wav(tmp_path / "song.wav", 2.0)
    folder = audio.slice_folder(tmp_path, song)
    first = audio.slice_song(song, [0, 500, 1000, 2000], folder)
    second = audio.slice_song(song, [0, 1000, 2000], folder)  # fewer pieces
    assert all(p.exists() for p in first + second) and set(first).isdisjoint(second)
    assert audio.slice_song(song, [0, 500, 1000, 2000], folder) == first  # the same cuts: the same files
    with pytest.raises(ValueError, match="empty|shorter"):
        audio.slice_song(song, [0, 50000, 60000], folder)
    with pytest.raises(ValueError, match="shorter"):
        audio.slice_song(song, [0, 20, 2000], folder)
    assert all(p.exists() for p in first + second)  # a cut that fails writes and deletes nothing
    (tmp_path / "elsewhere").mkdir()
    other = _wav(tmp_path / "elsewhere" / "song.wav", 1.0)
    assert audio.slice_folder(tmp_path, other) != folder  # two songs of the same name keep apart


# --- the HTTP layer
@pytest.mark.parametrize("header, size, want", [
    ("", 100, None), ("bytes=0-", 100, (0, 99)), ("bytes=10-19", 100, (10, 19)), ("bytes=-10", 100, (90, 99)),
    ("bytes=90-500", 100, (90, 99)), ("bytes=500-100", 100, "unsatisfiable"), ("bytes=110-", 100, "unsatisfiable"),
    ("bytes=-0", 100, "unsatisfiable"), ("bytes=abc-", 100, "unsatisfiable"), ("items=0-5", 100, None),
    ("bytes=-500", 100, (0, 99)), ("bytes=0-0,5-9", 100, (0, 0)),
])
def test_byte_ranges(header, size, want):
    assert byte_range(header, size) == want


def test_the_api_refuses_nan_and_keeps_python_out_of_its_words(server):
    base, _ = server
    assert _post(base, "status", b'{"x": NaN}')[0] == 400
    assert _post(base, "status", b"\xff\xfe")[0] == 400
    assert _post(base, "status", b"[1, 2]")[0] == 400
    code, body = _post(base, "status", b'{"bogus": 1}')  # a wrong argument: words, not a Python signature
    assert code == 400 and "lambda" not in body["error"] and "the log has the details" in body["error"]
    code, body = _post(base, "status", b"{}", token="wrong")
    assert code == 403 and "wrong token" in body["error"]


def test_a_preview_of_a_missing_file_is_answered(server, tmp_path):
    base, _ = server
    url = f"{base}/audio/file?token=tok&path={urllib.request.quote(str(tmp_path / 'gone.wav'))}"
    with pytest.raises(urllib.error.HTTPError) as e:
        urllib.request.urlopen(url, timeout=10)
    assert e.value.code == 404 and "wasn't found" in json.load(e.value)["error"]
    with pytest.raises(urllib.error.HTTPError) as e:
        urllib.request.urlopen(f"{base}/audio/project/1?token=tok", timeout=10)  # no project open
    assert e.value.code == 404
    # only audio of the types a project takes is read: not a text file, nor anything ffmpeg could turn into sound
    other = tmp_path / "notes.txt"
    other.write_text("not audio")
    with pytest.raises(urllib.error.HTTPError) as e:
        urllib.request.urlopen(f"{base}/audio/file?token=tok&path={urllib.request.quote(str(other))}", timeout=10)
    assert e.value.code == 404 and json.load(e.value)["error"] == "notes.txt isn't an audio file"


# --- with the game
@pytest.fixture(scope="module")
def game_session():
    s = Session()
    s.wait_ready()
    return s


@pytest.mark.game
def test_a_sound_the_game_no_longer_has_can_be_taken_out(game_session, tmp_path):
    s = game_session
    s.new_project(str(tmp_path / "u.audi"), "U")
    tone = _wav(tmp_path / "t.wav")
    order = [sl["source"] for seg in s.cue(MUSIC)["segments_detail"] for st in seg["stems"] for sl in st["slots"]]
    s.assign(order[0], str(tone))
    s.project.replacements.append(type(s.project.replacements[0])(target=12345, audio="t.wav"))
    st = s.project_state()
    assert st["unresolved"] and any("12345" in x for x in st["problems"])
    st = s.assign(order[1], str(tone))  # other edits still work
    assert order[1] in st["assignments"]
    with pytest.raises(EditorError, match="isn't in this version"):
        s.assign(12345, str(tone))
    st = s.unassign(["12345"])
    assert not st["unresolved"] and order[0] in st["assignments"]


@pytest.mark.game
def test_unreadable_audio_is_refused_when_chosen(game_session, tmp_path):
    s = game_session
    s.new_project(str(tmp_path / "r.audi"), "R")
    order = [sl["source"] for seg in s.cue(MUSIC)["segments_detail"] for st in seg["stems"] for sl in st["slots"]]
    (tmp_path / "text.wav").write_text("not audio")
    (tmp_path / "folder.wav").mkdir()
    for bad in ("text.wav", "folder.wav"):
        with pytest.raises(EditorError):
            s.assign(order[0], str(tmp_path / bad))
    with pytest.raises(EditorError, match="full path"):
        s.assign(order[0], "t.wav")
    s.assign(order[0], str(_wav(tmp_path / "ok.wav")))
    with pytest.raises(EditorError, match="Make-Up Gain goes from"):
        s.update(order[0], gain_db=40)
    with pytest.raises(EditorError, match="Make-Up Gain goes from"):
        s.update(order[0], gain_db=float("nan"))


@pytest.mark.game
def test_nothing_to_build_is_said_before_a_build_starts(game_session, tmp_path):
    s = game_session
    s.new_project(str(tmp_path / "n.audi"), "N")
    with pytest.raises(EditorError, match="Nothing to build"):
        s.build()


@pytest.mark.game
def test_the_version_moves_on_for_the_project_that_was_built(game_session, tmp_path):
    s = game_session
    a = tmp_path / "a.audi"
    s.new_project(str(a), "A")
    order = [sl["source"] for seg in s.cue(MUSIC)["segments_detail"] for st in seg["stems"] for sl in st["slots"]]
    s.assign(order[0], str(_wav(tmp_path / "t.wav")))
    s.settings(version=7)
    s._bump_version(s.project.path, 8)
    assert s.project.version == 8
    st = s.undo()  # undoing the version edit before the build: the build's move on stays
    assert st["version"] == 8
    s.new_project(str(tmp_path / "b.audi"), "B")
    s._bump_version(a.resolve(), 9)  # A is closed by now: its file moves on, B doesn't
    assert s.project.version == 1 and json.loads(a.read_text())["version"] == 9


@pytest.mark.game
def test_a_file_that_isnt_a_patch_is_refused(game_session, tmp_path):
    s = game_session
    s.new_project(str(tmp_path / "i.audi"), "I")
    (tmp_path / "notes.txt").write_text("x")
    with pytest.raises(EditorError, match="isn't a patch file"):
        s.import_patch(str(tmp_path / "notes.txt"))
