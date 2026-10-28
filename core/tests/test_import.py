"""Import Mod (Session.mod_scan, mod_preview and import_mod): a mod manager ZIP, a folder or a patch, with the options
chosen in it, into a new project or the open one, with the lines of the game text it changes; and import_patch, which
brings a patch's text too. The mods are made from the game's own files: a voice line given another one's audio, and
the game's string tables with a few lines changed."""
import io
import json
import shutil
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from http.server import ThreadingHTTPServer
from pathlib import Path
from types import SimpleNamespace

import pytest

from audiodiver import bank as wbank
from audiodiver import editor, installed, patch, strings
from audiodiver.editor import EditorError, Session
from audiodiver.project import Replacement
from audiodiver.server import make_handler

GUID = "c558536e-905b-4839-a1b0-328cf4631624"
SUBTITLES, TEXT = 2060271984843282606, 7125271031410732524  # US English: the subtitles, and other text (names)
AUDIO, TEXTS = "7c221cf5b12213ac.patch_0", "9ba626afa44a3aa3.patch_0"  # a patch of sounds, a patch of text
TEXTURE = 0xCD4238C6A0C69E32  # a type a mod's patch holds besides audio and text
MANIFEST = {"Version": 1, "Guid": GUID, "Name": "Bandog", "Description": "Solitary.", "IconPath": "art/portrait.png",
            "Options": [{"Name": "Subtitles", "SubOptions": [{"Name": "With Text", "Include": ["with"]},
                                                             {"Name": "Without Text", "Include": ["without"]}]},
                        {"Name": "Extra", "Include": ["extra"]},
                        {"Name": "Broken", "Include": ["broken"]}]}


def _png() -> bytes:
    from PIL import Image
    out = io.BytesIO()
    Image.new("RGB", (64, 48), (200, 40, 40)).save(out, "PNG")
    return out.getvalue()


def _zip(path, files: dict, manifest=None):
    with zipfile.ZipFile(path, "w") as z:
        for name, data in files.items():
            z.writestr(name, data)
        if manifest is not None:
            z.writestr("manifest.json", json.dumps(manifest))
    return path


@pytest.fixture
def no_library(tmp_path, monkeypatch):
    """No mod manager's library (a mod starts with every Option on), and new projects go to tmp_path/Projects."""
    monkeypatch.setattr(installed, "ARSENAL_DATA", tmp_path / "none.json")
    monkeypatch.setattr(installed, "ECHELON_DATA", tmp_path / "none.json")
    monkeypatch.setattr(editor, "SETTINGS_FILE", tmp_path / "settings.json")
    editor.save_settings(projects_folder=str(tmp_path / "Projects"))
    return tmp_path / "Projects"


def test_a_mods_name_id_options_and_icon_are_read_before_the_import(tmp_path, no_library):
    icon = _png()
    mod = _zip(tmp_path / "Bandog Version 9.zip", {"with/" + AUDIO: b"x", "without/" + AUDIO: b"x",
                                                   "art/portrait.png": icon}, MANIFEST)
    s = Session(load=False)
    assert s.mod_scan(str(mod)) == {
        "source": str(mod), "name": "Bandog", "description": "Solitary.", "guid": GUID, "icon": True, "manifest": True,
        "options": [{"id": "0", "name": "Subtitles", "sub": [{"id": "0.0", "name": "With Text"},
                                                             {"id": "0.1", "name": "Without Text"}]},
                    {"id": "1", "name": "Extra", "sub": []}, {"id": "2", "name": "Broken", "sub": []}],
        "picks": ["0.0", "1", "2"], "folder": str(no_library)}
    assert editor.mod_icon(str(mod)) == (icon, "image/png")
    # no manifest: named after the file, less what a download added; no mod ID, icon or options
    plain = _zip(tmp_path / "Plain Mod-17608-1-0-1729430000.zip", {AUDIO: b"x"})
    got = s.mod_scan(str(plain))
    assert (got["name"], got["guid"], got["icon"], got["manifest"], got["options"], got["picks"]) == \
        ("Plain Mod", "", False, False, [], [])
    with pytest.raises(EditorError, match="has no icon"):
        editor.mod_icon(str(plain))
    for gone in (tmp_path / "gone.zip", "relative.zip"):
        with pytest.raises(EditorError, match="wasn't found"):
            editor.mod_icon(str(gone))
    with pytest.raises(EditorError, match="wasn't found"):
        s.mod_scan(str(tmp_path / "gone.zip"))

    # the window gets the icon from the core, as it gets a project's
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(s, "tok"))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

    def get(path, token="tok"):
        query = urllib.parse.urlencode({"path": str(path), "token": token})
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{httpd.server_address[1]}/mods/icon?{query}") as r:
                return r.status, r.headers["Content-Type"], r.read()
        except urllib.error.HTTPError as e:
            return e.code, None, b""
    try:
        assert get(mod) == (200, "image/png", icon)
        assert get(plain)[0] == 404 and get(tmp_path / "gone.zip")[0] == 404 and get(mod, "wrong")[0] == 403
    finally:
        httpd.shutdown()


# --- with the game
@pytest.fixture(scope="module")
def session():
    s = Session()
    s.wait_ready()
    return s


def _wait(s, job):
    while (j := s.job(job["id"]))["state"] == "running":
        time.sleep(0.2)
    return j


def _voices(ix):
    """Two US English voice lines with other audio, each streamed: a mod gives the first the second's audio."""
    found = []
    for sid in sorted(sid for sid, code in ix.language.items() if code == "us"):
        wem = ix.wem(sid)
        if 4000 < len(wem) < 200_000 and all(wem != w for _, w in found):
            found.append((sid, wem))
        if len(found) == 2:
            return found
    pytest.skip("the game has no two voice lines in US English")


def _lines(s, fid, n) -> list[int]:
    """The first n lines with text of a table of the game."""
    return [i for i, t in s._texts().table(fid).texts.items() if t.strip()][:n]


def _table(s, fid, changes: dict, gone=()) -> bytes:
    """A table of the game as a mod carries it, whole: changes ({line: text}) made, and lines the game doesn't have."""
    t = s._texts().table(fid)
    return strings.serialize(strings.Table(t.language, {**t.texts, **changes, **{i: "Gone." for i in gone}}))


def _patch(path: Path, streams=None, tables=None, carried=None) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    patch.write_patch(str(path), streams or {}, {}, {}, tables, carried)
    return path


@pytest.fixture(scope="module")
def mod(session, tmp_path_factory):
    """A mod like Bandog: Subtitles ▸ With Text deploys a voice line's new audio and a patch of text (a subtitle, a
    name and a line the game doesn't have); Without Text the audio alone; Extra the subtitle table again, later and
    with other changes, and a texture; Broken a file that is no patch."""
    s, ix = session, session.ix
    tmp = tmp_path_factory.mktemp("mod")
    (a, _), (_, b_audio) = _voices(ix)
    sub1, sub2 = _lines(s, SUBTITLES, 2)
    (name,) = _lines(s, TEXT, 1)
    gone = next(i for i in range(1, 10_000) if i not in s._texts().table(SUBTITLES).texts)
    audio = _patch(tmp / "a" / AUDIO, {ix.stream_file(a): b_audio})
    text = _patch(tmp / "t" / TEXTS, tables={SUBTITLES: _table(s, SUBTITLES, {sub1: "{0.00->1.00}Changed."}, [gone]),
                                             TEXT: _table(s, TEXT, {name: "AWACS Bandog"})})
    extra = _patch(tmp / "e" / TEXTS, tables={SUBTITLES: _table(s, SUBTITLES, {sub1: "{0.00->1.00}Later.",
                                                                               sub2: "{0.00->1.00}Also."})},
                   carried=[patch.Carried(5, TEXTURE, b"tex", gpu=b"g" * 64)])
    icon, files = _png(), {}
    for folder, made in (("with", audio), ("with", text), ("without", audio), ("extra", extra)):
        for suffix in ("", ".stream", ".gpu_resources"):
            if Path(f"{made}{suffix}").is_file():
                files[f"{folder}/{made.name}{suffix}"] = Path(f"{made}{suffix}").read_bytes()
    zip_path = _zip(tmp / "Bandog Version 9.zip", {**files, "broken/" + TEXTS: b"not a patch", "art/portrait.png": icon},
                    MANIFEST)
    return SimpleNamespace(zip=zip_path, a=a, b_audio=b_audio, sub1=sub1, sub2=sub2, name=name, gone=gone, text=text,
                           icon=icon)


@pytest.mark.game
def test_the_options_chosen_change_the_patches_and_the_lines_of_text(session, mod):
    s = session
    got = s.mod_preview(str(mod.zip), ["0.0", "1"])
    assert got["parts"] == [f"Subtitles / With Text · {AUDIO}", f"Subtitles / With Text · {TEXTS}", f"Extra · {TEXTS}"]
    assert got["audio"] == 1 and got["others"] == ["1 other file, such as models or textures"]
    # subtitles first; the later patch's subtitle table wins whole, and it has no line the game doesn't
    assert [(x["table"], x["id"], x["kind"], x["language"], x["mod"]) for x in got["texts"]] == [
        (str(SUBTITLES), mod.sub1, "subtitles", "us", "{0.00->1.00}Later."),
        (str(SUBTITLES), mod.sub2, "subtitles", "us", "{0.00->1.00}Also."),
        (str(TEXT), mod.name, "text", "us", "AWACS Bandog")]
    assert got["texts"][0]["game"] == s._texts().table(SUBTITLES).texts[mod.sub1] and got["missing"] == 0
    got = s.mod_preview(str(mod.zip), ["0.0"])  # without Extra: the first table, with a line the game doesn't have
    assert [x["id"] for x in got["texts"]] == [mod.sub1, mod.name] and got["texts"][0]["mod"] == "{0.00->1.00}Changed."
    assert got["missing"] == 1 and got["others"] == []
    assert s.mod_preview(str(mod.zip), ["0.1"]) == {"parts": [f"Subtitles / Without Text · {AUDIO}"], "audio": 1,
                                                    "texts": [], "missing": 0, "others": []}
    assert s.mod_preview(str(mod.zip), ["2"])["audio"] == 1  # no patch: the import says what is wrong with it
    assert s.mod_preview(str(mod.zip), [])["parts"] == []  # every option off: no patch right in the mod's folder
    with pytest.raises(EditorError, match="list of their IDs"):
        s.mod_preview(str(mod.zip), "0.0")


@pytest.mark.game
def test_a_mod_comes_in_as_a_new_project_with_the_lines_chosen(session, mod, tmp_path, no_library):
    s, folder = session, no_library
    game = {fid: s._texts().table(fid).texts for fid in (SUBTITLES, TEXT)}
    j = _wait(s, s.import_mod(str(mod.zip), ["0.0", "1"], folder=str(folder), tabs=["editor"],
                              texts=[{"table": str(SUBTITLES), "id": mod.sub1}, {"table": str(TEXT), "id": mod.name}]))
    assert j["state"] == "done", j["error"]
    home, r = folder / "Bandog", j["result"]
    assert (r["project"], r["folder"]) == (str(home / "Bandog.audi"), str(home))
    assert (r["imported"], r["added"], r["skipped"], r["settings"], r["texts"], r["left"]) == (1, 0, 0, 0, 2, [])
    assert r["others"] == ["1 other file, such as models or textures"]
    st = s.project_state()  # opened, with nothing to undo
    assert (st["path"], st["name"], st["description"], st["guid"]) == (r["project"], "Bandog", "Solitary.", GUID)
    assert st["icon"] == {"image": "icon.png"} and (home / "icon.png").read_bytes() == mod.icon
    assert st["tabs"] == ["editor", "text"] and not st["can_undo"] and st["problems"] == []
    assert st["texts"] == [
        {"table": str(SUBTITLES), "id": mod.sub1, "text": "{0.00->1.00}Later.", "was": game[SUBTITLES][mod.sub1]},
        {"table": str(TEXT), "id": mod.name, "text": "AWACS Bandog", "was": game[TEXT][mod.name]}]
    assert st["assignments"][str(mod.a)]["audio"].startswith("audio/imported/7c221cf5b12213ac-")
    assert editor.load_settings()["projects_folder"] == str(folder)  # where the next new project goes
    with pytest.raises(EditorError, match="already exists"):
        s.import_mod(str(mod.zip), ["0.0"], folder=str(folder))
    with pytest.raises(EditorError, match="Mod managers can't use"):
        s.import_mod(str(mod.zip), ["0.0"], "Bad: name", str(folder))

    # another name, a new mod ID, the default icon, every line
    j = _wait(s, s.import_mod(str(mod.zip), ["0.0", "1"], "Bandog Two", str(folder), keep_id=False, icon=False))
    assert j["state"] == "done", j["error"]
    st = s.project_state()
    assert (st["name"], st["icon"], st["tabs"]) == ("Bandog Two", {}, None) and st["guid"] not in ("", GUID)
    assert [t["id"] for t in st["texts"]] == [mod.sub1, mod.sub2, mod.name]
    assert not list((folder / "Bandog Two").glob("icon*"))

    # a failed import leaves no folder behind, and the open project stays open
    j = _wait(s, s.import_mod(str(mod.zip), ["2"], "Broken", str(folder)))
    assert j["state"] == "failed" and "can't be read as a game patch" in j["error"]
    assert not (folder / "Broken").exists() and s.project_state()["name"] == "Bandog Two"


@pytest.mark.game
def test_a_mod_goes_into_the_open_project_as_one_edit(session, mod, tmp_path):
    s = session
    s.new_project(tmp_path / "open.audi", "Open")
    s.text_set(SUBTITLES, mod.sub2, "{0.00->1.00}Mine.")
    other = next(t for t in s.ix.stream_of if t != mod.a)
    s.project.replacements.append(Replacement(target=other, audio="mine.wav"))
    s.project.library.append("deploy/loadout")
    j = _wait(s, s.import_mod(str(mod.zip), ["0.0"], tabs=["editor"]))  # tabs: Settings' list
    assert j["state"] == "done", j["error"]
    st = s.project_state()
    assert {str(other), str(mod.a)} <= set(st["assignments"]) and "deploy/loadout" in st["library"]
    assert {t["id"]: t["text"] for t in st["texts"]} == {mod.sub2: "{0.00->1.00}Mine.", mod.sub1: "{0.00->1.00}Changed.",
                                                         mod.name: "AWACS Bandog"}
    assert st["undo_label"] == "import" and st["tabs"] == ["editor", "text"]
    assert j["result"]["project"] == st["path"] and j["result"]["left"] == ["1 line of text that the game doesn't have"]
    st = s.undo()  # all of it at once
    assert str(mod.a) not in st["assignments"] and [t["id"] for t in st["texts"]] == [mod.sub2] and st["tabs"] is None

    j = _wait(s, s.import_mod(str(mod.zip), ["0.1"], mode="replace"))  # the audio alone, in place of the project's
    assert j["state"] == "done", j["error"]
    st = s.project_state()
    assert list(st["assignments"]) == [str(mod.a)] and "deploy/loadout" not in st["library"]
    assert [t["id"] for t in st["texts"]] == [mod.sub2] and j["result"]["texts"] == 0  # the text edits stay
    assert str(other) in s.undo()["assignments"]
    with pytest.raises(EditorError, match="adds to the project or replaces"):
        s.import_mod(str(mod.zip), ["0.1"], mode="merge")
    with pytest.raises(EditorError, match="No patch"):
        s.import_mod(str(mod.zip), [])


@pytest.mark.game
def test_a_mod_of_text_alone_comes_in_and_one_with_nothing_to_bring_is_refused(session, mod, tmp_path, no_library):
    s = session
    only = tmp_path / "Text Only"
    only.mkdir()
    shutil.copyfile(mod.text, only / TEXTS)
    got = s.mod_preview(str(only))
    assert (got["parts"], got["audio"], got["missing"]) == ([TEXTS], 0, 1)
    assert [x["id"] for x in got["texts"]] == [mod.sub1, mod.name]
    j = _wait(s, s.import_mod(str(only), folder=str(no_library)))
    assert j["state"] == "done", j["error"]
    assert (j["result"]["imported"], j["result"]["texts"]) == (0, 2) and not (no_library / "Text Only" / "audio").exists()
    st = s.project_state()
    assert st["name"] == "Text Only" and st["assignments"] == {} and len(st["texts"]) == 2
    # refused before the job: no line chosen, or none the mod changes; and a texture alone
    for texts in ([], [{"table": str(SUBTITLES), "id": 1}]):
        with pytest.raises(EditorError, match="Choose a line of text to import"):
            s.import_mod(str(only), texts=texts)
    with pytest.raises(EditorError, match="Each line of text to import has a table and an ID"):
        s.import_mod(str(only), texts=[{"table": "subtitles"}])
    texture = _patch(tmp_path / "Texture" / TEXTS, carried=[patch.Carried(5, TEXTURE, b"tex", gpu=b"g" * 64)])
    with pytest.raises(EditorError, match="Texture holds no audio or text that Audiodiver can bring in"):
        s.import_mod(str(texture.parent))


@pytest.mark.game
def test_a_patch_brings_the_lines_of_text_it_changes(session, mod, tmp_path):
    s, ix = session, session.ix
    both = _patch(tmp_path / "both" / TEXTS, {ix.stream_file(mod.a): mod.b_audio},
                  {SUBTITLES: _table(s, SUBTITLES, {mod.sub1: "{0.00->1.00}Changed."}, [mod.gone])})
    s.new_project(tmp_path / "p.audi", "P", tabs=["editor"])
    j = _wait(s, s.import_patch(str(both)))
    assert j["state"] == "done", j["error"]
    r = j["result"]
    assert (r["imported"], r["texts"], r["others"]) == (1, 1, [])
    assert r["left"] == ["1 line of text that the game doesn't have"] and r["folder"].startswith(str(tmp_path / "audio"))
    st = s.project_state()
    assert st["texts"] == [{"table": str(SUBTITLES), "id": mod.sub1, "text": "{0.00->1.00}Changed.",
                            "was": s._texts().table(SUBTITLES).texts[mod.sub1]}]
    assert str(mod.a) in st["assignments"] and st["tabs"] == ["editor", "text"] and st["undo_label"] == "import"
    s.undo()
    j = _wait(s, s.import_patch(str(mod.text)))  # text alone: no audio to decode, and no failure
    assert j["state"] == "done", j["error"]
    assert (j["result"]["imported"], j["result"]["texts"]) == (0, 2) and len(s.project_state()["texts"]) == 2
    texture = _patch(tmp_path / "texture" / TEXTS, carried=[patch.Carried(5, TEXTURE, b"tex", gpu=b"g" * 64)])
    j = _wait(s, s.import_patch(str(texture)))
    assert j["state"] == "failed" and j["error"] == f"{TEXTS} holds no audio or text that Audiodiver can bring in"


@pytest.mark.game
def test_the_library_search_finds_words_in_global_notes(session, tmp_path, monkeypatch):
    monkeypatch.setattr(editor, "SETTINGS_FILE", tmp_path / "settings.json")
    s = session
    (clip, _), _ = _voices(s.ix)
    s.set_global_note(f"clip:{clip}", "# Bandog barks\nloud")
    s.set_global_note("item:deploy/loadout", "**Bandog** intro")
    hits = s.find_text("bandog")
    assert hits and all(h["note"] for h in hits)
    assert {"item": "deploy/loadout", "cue": None, "label": "Bandog intro"}.items() <= next(
        h for h in hits if h["item"] == "deploy/loadout").items()
    assert any(h["source"] == str(clip) and h["label"] == "Bandog barks" for h in hits) or not [
        p for p in s.lib.places(clip) if p["item"]]  # a clip outside the Index has no place to find


@pytest.mark.game
def test_a_patchs_make_up_gain_comes_in_on_the_slot(session, tmp_path):
    """A patch that changes only a Sound's Make-Up Gain, as hd2-audio-modder writes it: the gain comes in on the slot
    of the clip, over the game's own (the Original's while the slot has no new audio, else the new audio's), not as
    a setting the details panel can't show."""
    s, ix = session, session.ix
    (clip, _), _ = _voices(ix)
    bid = sorted(ix.banks_for(clip))[0]
    bank, dep = ix.bank_files(bid)
    hirc = wbank.parse(bank)[1]
    sound = next(i for i, (t, b) in hirc.items() if t == wbank.SOUND and wbank.source_ids(t, bytes(b)) == [clip])
    own = wbank.props(wbank.SOUND, bytes(hirc[sound][1])).get(patch.MAKEUP_GAIN, 0.0)
    made = tmp_path / "gain" / AUDIO
    made.parent.mkdir()
    patch.write_patch(str(made), {}, {bid: patch.apply_settings(bank, {sound: {patch.MAKEUP_GAIN: own - 1.0}})[0]},
                      {bid: dep} if dep else {})
    s.new_project(tmp_path / "gain.audi", "Gain")
    j = _wait(s, s.import_patch(str(made)))
    assert j["state"] == "done", j["error"]
    assert (j["result"]["gains"], j["result"]["settings"]) == (1, 0)
    st = s.project_state()
    assert st["gains"] == {str(clip): -1.0} and st["settings"] == 0 and not st["assignments"]
    s.project.replacements.append(Replacement(target=clip, audio="mine.wav"))
    j = _wait(s, s.import_patch(str(made)))
    assert j["state"] == "done", j["error"]
    assert next(r for r in s.project.replacements if r.target == clip).gain_db == -1.0 and not s.project.settings
