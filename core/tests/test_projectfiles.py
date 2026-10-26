"""A project's folder (projectfiles.py): new projects in a folder of their own, moving one there, unused files,
collecting files from elsewhere, packs. None of it needs the game."""
import json
import wave
import zipfile
from pathlib import Path

import pytest

from audiodiver import projectfiles as pf
from audiodiver.editor import EditorError, Session, _digest
from audiodiver.project import Project


def _wav(path, seconds=0.2):
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(48000)
        w.writeframes(bytes(int(48000 * seconds) * 2))
    return path


@pytest.fixture(autouse=True)
def _no_recycle_bin(monkeypatch):
    """Removed files are deleted, not sent to the Recycle Bin of the person running the tests."""
    def unlink(paths):
        for p in paths:
            p.unlink()
        return []
    monkeypatch.setattr(pf, "recycle", unlink)


def _session(audi, name="M"):
    s = Session(load=False)
    s.new_project(audi, name)
    return s


def _assign(s, sid, path):
    return s._edit("assign", lambda p: s._set(p, sid, str(path)))


def test_a_new_project_gets_a_folder_of_its_own(tmp_path):
    s = Session(load=False)
    st = s.new_project(tmp_path / "Dune.audi", "Dune", folder=True)
    assert st["path"] == str(tmp_path / "Dune" / "Dune.audi") and st["own_folder"]
    # a folder named like the project already is its folder
    st = Session(load=False).new_project(tmp_path / "Mine" / "mine.audi", "Mine", folder=True)
    assert st["path"] == str(tmp_path / "Mine" / "mine.audi")
    with pytest.raises(EditorError, match="already exists"):
        Session(load=False).new_project(tmp_path / "Dune.audi", "Dune", folder=True)
    assert Session(load=False).projects_folder() == str(tmp_path)  # the next one is offered the same place


def test_a_project_beside_another_is_not_in_its_own_folder(tmp_path):
    a = _session(tmp_path / "a.audi")
    assert a.project_state()["own_folder"]  # named differently, but alone in it
    _session(tmp_path / "b.audi")
    st = a.project_state()
    assert not st["own_folder"] and st["folder_projects"] == 1


def test_slices_and_imports_go_into_the_audio_folder(tmp_path):
    from audiodiver import audio
    song = _wav(tmp_path / "music" / "song.wav", 1.0)
    d = audio.slice_folder(tmp_path / "proj", song)
    assert d.parent == tmp_path / "proj" / "audio" / "slices" and d.name.startswith("song-")
    assert audio.slice_folder(tmp_path / "proj", song, legacy=True).parent == tmp_path / "proj" / "slices"
    # two mods' patches of the same archive get folders of their own
    one, two = tmp_path / "x" / "9ba6.patch_0", tmp_path / "y" / "9ba6.patch_0"
    for p, data in ((one, b"mod one"), (two, b"mod two")):
        p.parent.mkdir()
        p.write_bytes(data)
    alone = _digest(one)
    assert alone != _digest(two)
    (one.parent / "9ba6.patch_0.stream").write_bytes(b"audio")  # the .stream counts too
    assert _digest(one) != alone


def test_moving_a_project_into_its_own_folder(tmp_path):
    """The project file moves into a new folder beside it, with what Audiodiver made for it; a slice another project
    there uses is copied, the rest renamed into place; files a person picked stay and the project points at them;
    builds go too. Undo still finds every file."""
    mine = _wav(tmp_path / "slices" / "song-abc123" / "1a2b3c4d" / "01 song.wav")
    shared = _wav(tmp_path / "slices" / "song-abc123" / "1a2b3c4d" / "02 song.wav")
    (tmp_path / "slices" / "song-abc123" / "cuts.json").write_text("{}")
    picked = _wav(tmp_path / "my music" / "drop.wav")
    old_take = _wav(tmp_path / "imported" / "9ba6-1234abcd" / "770001.wav")
    other = _session(tmp_path / "other.audi", "Other")
    _assign(other, 2, shared)
    s = _session(tmp_path / "auditest.audi", "Unwise test")
    assert s.project_state()["move_to"] == str(tmp_path / "auditest" / "auditest.audi")
    _assign(s, 9, old_take)
    s.unassign([9])  # only its undo history uses it now
    _assign(s, 1, mine)
    _assign(s, 2, shared)
    _assign(s, 3, picked)
    (tmp_path / "build").mkdir()
    (tmp_path / "build" / "unwise_test-1.zip").write_bytes(b"zip")
    (tmp_path / "build" / "other-1.zip").write_bytes(b"zip")
    file_id = mine.stat().st_ino

    st = s.move_to_own_folder()
    home = tmp_path / "auditest"
    assert st["path"] == str(home / "auditest.audi") and st["own_folder"] and st["move_to"] is None
    assert not (tmp_path / "auditest.audi").exists()
    saved = json.loads((home / "auditest.audi").read_text())
    audio = {r["target"]: r["audio"] for r in saved["replacements"]}
    assert audio == {"1": "audio/slices/song-abc123/1a2b3c4d/01 song.wav",
                     "2": "audio/slices/song-abc123/1a2b3c4d/02 song.wav", "3": "../my music/drop.wav"}
    assert (home / "audio" / "slices" / "song-abc123" / "cuts.json").exists()
    assert not mine.exists() and shared.exists()  # the other project's slice stays where it uses it
    moved = home / "audio" / "slices" / "song-abc123" / "1a2b3c4d" / "01 song.wav"
    if file_id:  # renamed, not copied: the same file
        assert moved.stat().st_ino == file_id
    assert picked.exists() and not old_take.exists() and (home / "audio" / "imported" / "9ba6-1234abcd" / "770001.wav").exists()
    assert (home / "build" / "unwise_test-1.zip").exists() and (tmp_path / "build" / "other-1.zip").exists()
    assert not st["problems"]
    st = s.undo()  # the slot of 9 had: its audio is in the new folder too
    st = s.undo(); st = s.undo(); st = s.undo()
    assert st["assignments"]["9"]["exists"]
    with pytest.raises(EditorError, match="already"):
        s.move_to_own_folder()


def test_a_move_that_fails_puts_every_file_back(tmp_path, monkeypatch):
    piece = _wav(tmp_path / "slices" / "song-abc123" / "1a2b3c4d" / "01 song.wav")
    _session(tmp_path / "other.audi", "Other")
    s = _session(tmp_path / "mine.audi", "Mine")
    _assign(s, 1, piece)

    def refuse(self, path=None):
        raise PermissionError(13, "Access is denied", str(path or self.path))
    monkeypatch.setattr(Project, "save", refuse)
    with pytest.raises(EditorError, match="couldn't move"):
        s.move_to_own_folder()
    assert piece.exists() and not (tmp_path / "mine").exists() and s.project.path == tmp_path / "mine.audi"


def test_only_what_audiodiver_named_counts_in_the_folders_beside_the_project(tmp_path):
    """Beside a project file (a project on the Desktop, say), `slices` and `imported` can be a person's own folders:
    only files named as Audiodiver named them are listed, removed or taken along by a move."""
    ours = [_wav(tmp_path / "slices" / "song-abc123" / "1a2b3c4d" / "01 song.wav"),
            _wav(tmp_path / "imported" / "9ba626afa44a3aa3" / "123456789.wav"),
            _wav(tmp_path / "imported" / "9ba626afa44a3aa3-0badf00d" / "123456789.wav")]
    (tmp_path / "slices" / "song-abc123" / "cuts.json").write_text("{}")
    theirs = [_wav(tmp_path / "slices" / "My Album" / "01 Track.wav"), _wav(tmp_path / "imported" / "Album" / "01.wav"),
              _wav(tmp_path / "imported" / "12.wav")]
    picked = theirs[0]
    s = _session(tmp_path / "p.audi")
    _assign(s, 5, picked)
    _session(tmp_path / "other.audi")
    found = {f["rel"] for f in s.unused_files()["files"]}
    assert found == {str(f.relative_to(tmp_path)) for f in ours} | {str(Path("slices/song-abc123/cuts.json"))}
    assert all("\\" in r for r in found)  # as Windows writes a path
    s.remove_unused_files([str(f) for f in ours + theirs])
    assert all(f.exists() for f in theirs) and not any(f.exists() for f in ours)
    assert (tmp_path / "imported" / "Album").is_dir() and not (tmp_path / "imported" / "9ba626afa44a3aa3").exists()
    s.move_to_own_folder()
    assert picked.exists()  # a person's file: the project points at it where it is
    assert json.loads((tmp_path / "p" / "p.audi").read_text())["replacements"][0]["audio"] == "../slices/My Album/01 Track.wav"


def test_files_are_left_alone_while_a_job_writes(tmp_path):
    from audiodiver.editor import Job
    s = _session(tmp_path / "p" / "p.audi")
    s.jobs["x"] = Job("check")  # reads the installed mods: no file of a project
    assert s.unused_files()["files"] == []
    s.jobs["y"] = Job("import")  # decodes into audio/imported before its edit adds the files to the project
    _session(tmp_path / "p" / "other.audi")  # so the project can move
    for call in (s.unused_files, lambda: s.remove_unused_files([]), s.move_to_own_folder):
        with pytest.raises(EditorError, match="Wait"):
            call()
    s.jobs["y"].state = "done"
    assert s.unused_files()["files"] == []


def test_the_folders_facts_are_read_again_only_when_something_changed(tmp_path, monkeypatch):
    import os
    import time
    s = _session(tmp_path / "p" / "p.audi")
    old = time.time() - 60
    os.utime(tmp_path / "p", (old, old))  # changed a while ago: what was found out is kept
    calls = []
    real = pf.others
    monkeypatch.setattr(pf, "others", lambda audi: calls.append(1) or real(audi))
    st = s.project_state()
    n = len(calls)
    for _ in range(3):
        s.project_state()
    assert len(calls) == n and st["own_folder"] and st["move_to"] is None
    _session(tmp_path / "p" / "q.audi")  # another project comes into the folder
    st = s.project_state()
    assert len(calls) > n and not st["own_folder"] and st["move_to"] == str(tmp_path / "p" / "p" / "p.audi")


def test_moving_a_project_with_nothing_to_carry(tmp_path):
    """A project whose audio all stays outside its folder, beside another project, still gets its folder."""
    elsewhere = _wav(tmp_path / "music" / "drop.wav")
    _session(tmp_path / "other.audi", "Other")
    s = _session(tmp_path / "mine.audi", "Mine")
    _assign(s, 1, elsewhere)
    st = s.move_to_own_folder()
    assert st["path"] == str(tmp_path / "mine" / "mine.audi") and st["own_folder"]
    saved = json.loads((tmp_path / "mine" / "mine.audi").read_text())
    assert saved["replacements"][0]["audio"] == "../music/drop.wav"
    assert elsewhere.exists()
    assert not (tmp_path / "mine.audi").exists()


def test_moving_a_project_elsewhere_takes_its_folder_and_finds_every_file(tmp_path):
    """Move project: the folder goes whole into the folder chosen (one that isn't there yet too), a file of the
    person's in it as well; a file picked from elsewhere is found as before, by the undo history too."""
    home, away = tmp_path / "Dune", tmp_path / "Projects"
    picked, take = _wav(tmp_path / "my music" / "drop.wav"), _wav(home / "takes" / "take.wav")
    s = _session(home / "Dune.audi", "Dune")
    _assign(s, 1, picked)
    _assign(s, 2, take)
    (home / "build").mkdir()
    (home / "build" / "dune-1.zip").write_bytes(b"zip")
    assert s.move_project(str(away), check=True) == {"dest": str(away / "Dune"), "copy": False}
    (away / "Dune").mkdir(parents=True)  # a folder of that name there already
    assert s.move_project(str(away), check=True)["dest"] == str(away / "Dune 2")
    (away / "Dune").rmdir()
    st = s.move_project(str(away))
    new = away / "Dune"
    assert st["path"] == str(new / "Dune.audi") and not home.exists() and not st["old_left"] and not st["problems"]
    saved = json.loads((new / "Dune.audi").read_text())
    assert {r["target"]: r["audio"] for r in saved["replacements"]} == {"1": "../../my music/drop.wav",
                                                                        "2": "takes/take.wav"}
    assert (new / "build" / "dune-1.zip").exists() and picked.exists()
    st = s.undo()
    assert st["assignments"]["1"]["exists"] and "2" not in st["assignments"]
    with pytest.raises(EditorError, match="already"):
        s.move_project(str(away))
    for inside in (new, new / "takes"):
        with pytest.raises(EditorError, match="outside"):
            s.move_project(str(inside))


def test_moving_a_project_elsewhere_from_a_shared_folder(tmp_path):
    """A project beside another gets a folder of its own first, and that folder moves."""
    elsewhere = _wav(tmp_path / "music" / "drop.wav")
    _session(tmp_path / "other.audi", "Other")
    s = _session(tmp_path / "mine.audi", "Mine")
    _assign(s, 1, elsewhere)
    new = tmp_path / "away" / "mine"
    assert s.move_project(str(tmp_path / "away"), check=True)["dest"] == str(new)
    st = s.move_project(str(tmp_path / "away"))
    assert st["path"] == str(new / "mine.audi") and st["own_folder"]
    assert json.loads((new / "mine.audi").read_text())["replacements"][0]["audio"] == "../../music/drop.wav"
    assert (tmp_path / "other.audi").exists() and not (tmp_path / "mine.audi").exists() and not (tmp_path / "mine").exists()


def test_a_move_elsewhere_that_fails_leaves_the_project_where_it_was(tmp_path, monkeypatch):
    s = _session(tmp_path / "p" / "p.audi")

    def refuse(self, path=None):
        raise PermissionError(13, "Access is denied", str(path or self.path))
    monkeypatch.setattr(Project, "save", refuse)
    with pytest.raises(EditorError, match="couldn't move"):
        s.move_project(str(tmp_path / "q"))
    assert (tmp_path / "p" / "p.audi").exists() and not (tmp_path / "q").exists()
    assert s.project.path == tmp_path / "p" / "p.audi"


def test_unused_files_are_those_nothing_uses(tmp_path):
    used = _wav(tmp_path / "p" / "audio" / "slices" / "s-1" / "a" / "01 s.wav")
    _wav(tmp_path / "p" / "audio" / "slices" / "s-1" / "b" / "01 s.wav")  # a set of cuts made before
    (tmp_path / "p" / "audio" / "slices" / "s-1" / "cuts.json").write_text("{}")
    gone = _wav(tmp_path / "p" / "audio" / "slices" / "t-2" / "a" / "01 t.wav")
    (tmp_path / "p" / "audio" / "slices" / "t-2" / "cuts.json").write_text("{}")
    undone = _wav(tmp_path / "p" / "audio" / "added" / "u.wav")
    mine = _wav(tmp_path / "p" / "keep me.wav")  # not in Audiodiver's folders: never listed
    s = _session(tmp_path / "p" / "p.audi")
    _assign(s, 1, used)
    _assign(s, 2, undone)
    s.undo()
    found = {f["rel"] for f in s.unused_files()["files"]}
    assert found == {str(Path(r)) for r in ("audio/slices/s-1/b/01 s.wav", "audio/slices/t-2/a/01 t.wav",
                                            "audio/slices/t-2/cuts.json")}
    got = s.remove_unused_files([str(tmp_path / "p" / "audio" / "slices" / "t-2" / "cuts.json"), str(gone), str(mine)])
    assert got["removed"] == 2 and not (tmp_path / "p" / "audio" / "slices" / "t-2").exists() and mine.exists()
    assert {f["rel"] for f in s.unused_files()["files"]} == {str(Path("audio/slices/s-1/b/01 s.wav"))}


def test_unused_files_leave_what_another_project_uses(tmp_path):
    theirs = _wav(tmp_path / "slices" / "s-abc123" / "1a2b3c4d" / "01 s.wav")
    other = _session(tmp_path / "other.audi")
    _assign(other, 1, theirs)
    s = _session(tmp_path / "mine.audi")
    assert s.unused_files()["files"] == []
    (tmp_path / "broken.audi").write_text("not json")
    with pytest.raises(EditorError, match="can't be read"):
        s.unused_files()


def test_collecting_copies_files_from_elsewhere_into_the_project(tmp_path):
    a = _wav(tmp_path / "music" / "a.wav")
    b = _wav(tmp_path / "other music" / "a.wav", 0.3)  # the same name, other audio
    inside = _wav(tmp_path / "p" / "c.wav")
    s = _session(tmp_path / "p" / "p.audi")
    for sid, f in ((1, a), (2, b), (3, inside)):
        _assign(s, sid, f)
    assert s.project_state()["files_elsewhere"] == 2
    st = s.collect_files()
    assert st["collected"] == 2 and st["files_elsewhere"] == 0 and st["undo_label"] == "collect"
    names = sorted(x["audio"] for x in st["assignments"].values())
    assert names == ["audio/added/a 2.wav", "audio/added/a.wav", "c.wav"]
    assert s.collect_files()["collected"] == 0
    assert s.undo()["files_elsewhere"] == 2
    assert s.collect_files()["collected"] == 2  # the copies there are the same files: no third copy
    assert sorted(f.name for f in (tmp_path / "p" / "audio" / "added").iterdir()) == ["a 2.wav", "a.wav"]


def test_a_pack_holds_the_project_and_what_it_uses(tmp_path):
    outside = _wav(tmp_path / "music" / "drop.wav")
    piece = _wav(tmp_path / "p" / "audio" / "slices" / "s-1" / "k" / "01 s.wav")
    (tmp_path / "p" / "audio" / "slices" / "s-1" / "cuts.json").write_text("{}")
    _wav(tmp_path / "p" / "audio" / "slices" / "s-1" / "old" / "01 s.wav")  # unused: stays out
    s = _session(tmp_path / "p" / "p.audi", "Pack me")
    _assign(s, 1, outside)
    _assign(s, 2, piece)
    s.project.build_folder = "../builds"
    got = pf.pack(s.project.to_json(), tmp_path / "p", "p", tmp_path / "p.audipack")
    assert got == {"files": 3, "missing": 0, "bytes": (tmp_path / "p.audipack").stat().st_size}
    with zipfile.ZipFile(tmp_path / "p.audipack") as z:
        assert sorted(z.namelist()) == ["p/audio/added/drop.wav", "p/audio/slices/s-1/cuts.json",
                                        "p/audio/slices/s-1/k/01 s.wav", "p/p.audi"]
        d = json.loads(z.read("p/p.audi"))
    assert sorted(r["audio"] for r in d["replacements"]) == ["audio/added/drop.wav", "audio/slices/s-1/k/01 s.wav"]
    assert d["build_folder"] == ""

    into = tmp_path / "unpacked"
    first, second = pf.unpack(tmp_path / "p.audipack", into), pf.unpack(tmp_path / "p.audipack", into)
    assert first == into / "p" / "p.audi" and second == into / "p 2" / "p 2.audi"
    q = Project.load(second)
    assert q.name == "Pack me" and not q.problems()


def test_a_pack_that_writes_outside_its_folder_is_refused(tmp_path):
    bad = tmp_path / "bad.audipack"
    with zipfile.ZipFile(bad, "w") as z:
        z.writestr("p/p.audi", json.dumps(Project(name="P").to_json()))
        z.writestr("p/../../evil.txt", "x")
    with pytest.raises(pf.FilesError, match="outside"):
        pf.unpack(bad, tmp_path / "out")
    two = tmp_path / "two.audipack"
    with zipfile.ZipFile(two, "w") as z:
        z.writestr("a/a.audi", json.dumps(Project(name="A").to_json()))
        z.writestr("b/b.audi", json.dumps(Project(name="B").to_json()))
    with pytest.raises(pf.FilesError, match="more than one"):
        pf.unpack(two, tmp_path / "out")
    assert not (tmp_path / "out").exists() or not any((tmp_path / "out").iterdir())
