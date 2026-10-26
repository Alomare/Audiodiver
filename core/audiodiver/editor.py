"""The editor session behind the UI: one open project, edited through small operations that autosave and can be
undone, plus background jobs (game loading, builds, patch imports). The HTTP server (server.py) is a thin layer over
this, so everything here is testable without a browser.
"""
import collections
import copy
import logging
import math
import os
import re
import shutil
import struct
import subprocess
import threading
import time
import uuid
from pathlib import Path, PurePosixPath
from types import SimpleNamespace

from . import wem
from .errors import os_error, plain  # noqa: F401 (server.py takes them from here too)
from .index import AudioIndex, CACHE_DIR
from .project import GAIN_DB, TABS, Addition, Project, ProjectFormatError, Replacement, TextEdit, tab_list, write_whole

log = logging.getLogger("audiodiver")
LOG_FILE = CACHE_DIR / "logs" / "core.log"
SETTINGS_FILE = CACHE_DIR / "settings.json"  # the core's own settings: where the game is
AUDIO_TYPES = {".wav", ".flac", ".mp3", ".ogg", ".opus", ".m4a", ".aac", ".aif", ".aiff", ".wma"}
UNDO_LIMIT = 200


def load_settings() -> dict:
    try:
        import json
        d = json.loads(SETTINGS_FILE.read_text(encoding="utf-8"))
        return d if isinstance(d, dict) else {}
    except (OSError, ValueError):
        return {}


def save_settings(**changes):
    import json
    d = {k: v for k, v in {**load_settings(), **changes}.items() if v is not None}
    SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    write_whole(SETTINGS_FILE, json.dumps(d, indent=2) + "\n")


def clean_temp(age_s: float = 3600):
    """Removes the temp folders of builds, repatches and combines that a core closed mid-job left behind (closing the
    window ends the core at once: a Dune build left 297 MB). A folder untouched for an hour is no live job's."""
    import tempfile
    for d in Path(tempfile.gettempdir()).glob("audiodiver-*"):
        try:
            if d.is_dir() and time.time() - max(f.stat().st_mtime for f in [d, *d.rglob("*")]) > age_s:
                shutil.rmtree(d, ignore_errors=True)
        except OSError:
            pass


def _unsaved(e: OSError, path) -> str:
    """Why an edit, undo or redo didn't happen: the project file couldn't be written (named as the project file, not
    the hidden one beside it that write_whole writes first)."""
    why = os_error(OSError(e.errno, e.strerror, str(path)) if e.errno is not None else e)
    return f"Nothing changed, because the project file couldn't be saved. {why}."


class EditorError(Exception):
    """A message for the person using the app: the UI shows it as it is."""
    for_people = True


class Cancelled(Exception):
    pass




def given(path) -> bool:
    """True for a path argument that names something: a non-empty string or a Path."""
    return isinstance(path, (str, os.PathLike)) and bool(str(path).strip())


def out_folder(folder) -> Path:
    """A folder the UI chose to save into, checked before a job starts (so the dialog can stay open): a full path,
    not a file, and a folder that can be made and written to (a missing drive, a name Windows refuses, a read-only
    place are refused here, not halfway through the job)."""
    import tempfile
    if not given(folder):
        raise EditorError("Choose a folder to save into")
    f = Path(folder)
    if not f.is_absolute():
        raise EditorError(f"{folder} isn't a full path")
    if f.is_file():
        raise EditorError(f"{f.name} is a file. Choose a folder.")
    try:
        f.mkdir(parents=True, exist_ok=True)
    except PermissionError:
        raise EditorError(f"{f} can't be written to. Choose another folder.") from None
    except OSError as e:  # "Q:\ wasn't found", "…\bad?name isn't a valid path"
        raise EditorError(os_error(e, str(f))) from None
    if not f.is_dir():  # a device name (CON, NUL) "makes" nothing
        raise EditorError(f"{f.name} can't be used as a folder name. Choose another name.")
    try:
        with tempfile.TemporaryFile(dir=f):
            pass
    except OSError:
        raise EditorError(f"{f} can't be written to. Choose another folder.") from None
    return f


def choices(variants) -> dict[int, int]:
    """{switch group: value} as the UI sends them for a play-through or an export."""
    if variants is None:
        return {}
    if not isinstance(variants, dict):
        raise EditorError("The variants to play are pairs of a switch group and a value")
    try:
        return {int(g): int(x) for g, x in variants.items()}
    except (TypeError, ValueError, OverflowError):
        raise EditorError("The variants to play are pairs of a switch group and a value") from None


def loop_count(loops) -> int:
    """How many times a play-through or an export plays the loops the game repeats forever (the Export dialog offers
    1 to 8)."""
    try:
        n = int(loops)
    except (TypeError, ValueError, OverflowError):
        raise EditorError("The number of times is a whole number") from None
    if not 1 <= n <= 20:
        raise EditorError("Loops play 1 to 20 times")
    return n


class Job:
    """A background task the UI follows: a log, optional progress (done of total, what it is on) and a cancel flag
    the task checks between steps."""

    def __init__(self, kind, title=""):
        self.id, self.kind, self.title = uuid.uuid4().hex[:8], kind, title
        self.state, self.log, self.result, self.error = "running", [], None, None
        self.started, self.ended = time.time(), None
        self.done, self.total, self.doing = 0, 0, ""
        self.cancel_requested = False

    def say(self, *parts):
        self.log.append(" ".join(str(p) for p in parts))

    def check(self):
        if self.cancel_requested:
            raise Cancelled()

    def step(self, doing, done=None):
        """Reports what the job is on now (done: steps finished so far) and stops here if it was cancelled."""
        self.check()
        self.doing = doing
        if done is not None:
            self.done = done

    def to_json(self):
        return {"id": self.id, "kind": self.kind, "title": self.title, "state": self.state, "log": self.log[-200:],
                "result": self.result, "error": self.error, "done": self.done, "total": self.total,
                "doing": self.doing, "seconds": round((self.ended or time.time()) - self.started, 1)}


class Session:
    def __init__(self, load=True):
        self.lock = threading.RLock()
        self.ix: AudioIndex | None = None
        self.catalog = None
        self.lib = None  # library.Library: the Index and All Archives
        self.texts = None  # strings.Texts: the game's text, read when first asked for
        self._cue_sets = {}  # part cue id -> its sounds, for the parts of what projects list
        self._clips = {}     # object id -> the game's clip it plays (_clip_of)
        self._segments = {}  # source -> the music segments that play it (_segments_of)
        self.stage, self.load_error = "starting", None
        self.game_where = {"path": None, "how": None}  # the data folder in use (or tried) and how it was found
        self.project: Project | None = None
        self.undo_stack, self.redo_stack = [], []
        # {mod id: the version its last build moved it on to}: undo and redo never take a project below it, so the
        # next build never overwrites a ZIP already made (see _bump_version). By id, not path: another project made
        # later at the same path is another mod.
        self.version_floor: dict[str, int] = {}
        self.built_for: dict[str, str] = {}  # the same for the game version a build was made on (Project.built_for)
        self.built_from: dict[str, str] = {}  # and for what it was made from (Project.built_from)
        self.revision = 0  # counts the changes to what is open (edits, undo, redo, another project): project_state
        self.jobs: dict[str, Job] = {}
        self.build_lock = threading.Lock()  # a build's "already running" check and its start, as one step
        self._facts = {}  # what project_state found out about the project's folder (_folder_facts)
        # Combine: each patch read (combine.Part) by its digest, and the digest of a patch by where it is and its time
        self._combine_parts, self._combine_ids = collections.OrderedDict(), {}
        self._music_objs = None  # (index, the game's music objects): read when the Soundtrack first needs them
        if load:
            threading.Thread(target=self._load_game, daemon=True).start()

    # --- game data
    def _load_game(self, chosen=None):
        """Reads the game: from `chosen` (a folder the command line names), else as Settings has it."""
        try:
            from .catalog import Catalog
            from .cuemap import CueMap
            from .game import Game, locate
            from .library import Library
            try:
                from .render import clean_spool
            except ImportError:
                pass  # no renderer (Audiodiver Utils has no numpy), so no spool files either
            else:
                clean_spool()
            clean_temp()
            folder, how = locate(chosen or load_settings().get("game_data"))
            again = bool(self.game_where.get("path"))  # another folder was chosen: this isn't the start-up read
            self.game_where = {"path": str(folder), "how": how}
            self.stage = ("Reading the game audio from the new folder" if again
                          else "Reading the game audio (the first run after a game update takes about a minute)")
            ix = AudioIndex(Game(folder), log=lambda *a: None)
            self.stage = "Mapping the music"
            cat = Catalog(CueMap(ix, log=lambda *a: None))
            cat.entries  # name everything now, not on the first request
            self.stage = "Sorting the sounds"
            lib = Library(cat)
            lib.archives
            self.ix, self.catalog, self.lib, self.stage = ix, cat, lib, "ready"
            log.info("game data from %s (%s)", folder, how)
        except Exception as e:
            self.load_error, self.stage = str(e) if isinstance(e, FileNotFoundError) else f"{type(e).__name__}: {e}", "failed"
            log.exception("loading the game failed")

    def set_game_folder(self, path=None):
        """Reads the game from another folder (None: find it through Steam again) and saves that choice. The folder
        is checked first, so a wrong one changes nothing; then the game data loads again, as at start-up."""
        from .game import data_folder
        if self.stage not in ("ready", "failed"):
            raise EditorError("The game is still loading. Try again when it's done.")
        if any(j.state == "running" for j in self.jobs.values()):
            raise EditorError("Wait for the build or export to finish first")
        chosen = None
        if path:
            try:
                chosen = str(data_folder(path))
            except ValueError as e:
                raise EditorError(str(e)) from None
        save_settings(game_data=chosen)
        with self.lock:
            self.ix, self.catalog, self.lib, self.load_error, self.texts = None, None, None, None, None
            self._cue_sets, self._clips, self._segments = {}, {}, {}
            self.__dict__.pop("_music_json", None)
            self.stage = "starting"
            self.game_where = {"path": chosen, "how": "chosen" if chosen else None}
        threading.Thread(target=self._load_game, daemon=True).start()
        return self.status()

    def wait_ready(self, timeout=600):
        t0 = time.time()
        while self.stage not in ("ready", "failed") and time.time() - t0 < timeout:
            time.sleep(0.1)
        if self.stage != "ready":
            raise EditorError(self.load_error or "game data not loaded")

    def require_game(self):
        if self.stage != "ready":
            raise EditorError(self.load_error or f"still loading: {self.stage}")

    def status(self):
        from . import __version__, akd
        game = None
        if self.ix:
            game = {"data": str(self.ix.game.data), "banks": len(self.ix.banks),
                    "music_banks": len(self.ix.music_banks)}
        return {"version": __version__, "stage": self.stage, "error": self.load_error, "game": game,
                "game_folder": {**self.game_where, "chosen": load_settings().get("game_data")},
                "log": str(LOG_FILE),
                "loudness_missing": akd.unavailable(),
                "jobs": [j.to_json() for j in self.jobs.values() if j.state == "running"],  # a reloaded window follows them
                "project": self.project_state() if self.project else None}

    def cues(self):
        """Every music cue with something to replace in it, named, in the game's own structure (catalog.py)."""
        self.require_game()
        return self.catalog.entries

    def music(self):
        """The game's music by where a player hears it (musiclist.py): the Index's first category."""
        self.require_game()
        if not hasattr(self, "_music_json"):
            self._music_json = self.catalog.music.to_json()
        return self._music_json

    def index(self):
        """The Library's Index: the music and the sound sets the community has named, by category (library.py)."""
        self.require_game()
        return self.lib.index()

    def archives(self):
        """The Library's All Archives: every archive with audio in it, named and tagged where the Index knows it."""
        self.require_game()
        return self.lib.archives

    def item(self, item_id):
        """An Index item or an archive ("archive:<name>") as something to open: its parts are cues to ask `cue`
        for."""
        self.require_game()
        try:
            return self.lib.item(str(item_id))
        except KeyError:
            raise EditorError(f"{item_id} is not in this game version") from None

    def cue(self, cue_id, mine=False):
        """What opens in the middle: a music cue by its id, a bank's sounds as "bank:<id>", an archive's loose
        streams as "streams:<archive>", or one sound as "sfx:<source>". mine: a bank's sounds with the audio the open
        project adds to them (the Audio tab's view; the Library shows the game's)."""
        self.require_game()
        try:
            cue_id = str(cue_id)
            view = self.catalog.cue(int(cue_id)) if cue_id.isdigit() else \
                self.lib.view(cue_id, self._overlay() if mine else None)
        except KeyError:
            raise EditorError(f"No cue {cue_id}") from None
        # a playlist says whether it plays its slots top to bottom (the Soundtrack shows the order when it doesn't)
        if cue_id.isdigit() and view.get("kind") == "playlist":
            from . import music, soundtrack as st
            pl = self._music().get(int(cue_id))
            if isinstance(pl, music.MusicPlaylist):
                view["ordered"] = st.in_order(pl.root, st.entry_item(self._music(), pl.id))
        # every slot also says the file id of the stream that holds its audio ("" when it is only inside banks): the
        # 64-bit id modders often go by
        for seg in view.get("segments_detail", []):
            for st in seg["stems"]:
                for sl in st["slots"]:
                    if "stream" not in sl:
                        fid = self.ix.stream_file(int(sl["source"]))
                        sl["stream"] = str(fid) if fid is not None else ""
        return view

    def find(self, query: str):
        """Where an id leads: [{cue, source, item}] for a source id, a stream's file id, a cue id or a bank id."""
        self.require_game()
        try:
            return self.lib.places(int(str(query).strip()))
        except (ValueError, OverflowError):
            return []

    def find_text(self, query: str, limit: int = 200):
        """Where a name leads: [{cue, source, item, archives, label}] for the slots and cues whose community label or
        clip note has every word of the query. Places outside the Index (no item) are left out, and so are the banks
        that hold a clip of music: its cues are where it is replaced."""
        self.require_game()
        words = str(query).lower().split()
        if sum(map(len, words)) < 3:
            return []
        has = lambda text: all(w in text.lower() for w in words)
        cat, out, seen = self.catalog, [], set()
        named = [*cat.labels.items(), *((k, [c["label"]]) for k, c in cat.clips.items() if c.get("label"))]
        for key, labels in named:
            label = next((l for l in labels if has(l)), None)  # one label has every word: it says why it matched
            if label is None:
                continue
            places = [p for p in self.lib.places(int(key)) if p["item"]]
            for p in [p for p in places if p["cue"].isdigit()] or places:
                at = (p["item"], p["cue"], p["source"])
                if at in seen:
                    continue
                seen.add(at)
                out.append({**p, "label": label})
                if len(out) >= limit:
                    return out
        return out

    # --- vanilla and project audio for preview
    def vanilla_wav(self, sid: int) -> Path:
        """The vanilla audio of a source decoded to WAV (cached). A clip of its own's is the clip it stands in for."""
        from .audio import cache_lock
        self.require_game()
        if sid in self._added():
            if (was := self._original(sid)) is None:
                raise EditorError("A new take has no original audio")
            sid = was
        out = CACHE_DIR / "preview" / f"{sid}.wav"
        with cache_lock(out):
            if not out.exists():
                out.parent.mkdir(parents=True, exist_ok=True)
                src = CACHE_DIR / "preview" / f"{sid}.wem"
                try:
                    data = self.ix.wem(sid)
                except KeyError:  # a "No audio" slot: the game's data names it, no file holds it
                    raise EditorError(f"Sound {sid} has no audio in the game files") from None
                src.write_bytes(data)
                tmp = out.with_name(f"{sid}.partial.wav")
                subprocess.run([wem.VGMSTREAM, "-o", str(tmp), str(src)], check=True, capture_output=True)
                tmp.replace(out)
                src.unlink()
        return out

    def project_audio(self, sid: int) -> Path:
        self._need_project()
        r = self._rep(sid)
        path = self.project.audio_path(r)
        if not path.exists():
            raise EditorError(f"{path} wasn't found")
        return path

    def peaks(self, kind, source=None, path=None, buckets=1200):
        """Waveform peaks of the game's audio ("vanilla"), the assigned audio ("project") or any file ("file")."""
        from . import audio
        try:
            buckets = int(buckets)
        except (TypeError, ValueError, OverflowError):
            raise EditorError("The waveform's width is a whole number") from None
        buckets = max(1, min(120_000, buckets))
        if kind == "vanilla":
            f = self.vanilla_wav(self._source(source))
        elif kind == "project":
            f = self.project_audio(self._source(source))
        elif kind == "file":
            if not given(path):
                raise EditorError("Choose an audio file")
            f = Path(path)
            if not f.is_file():
                raise EditorError(f"{f} wasn't found")
        else:
            raise EditorError(f"Unknown waveform kind {kind}")
        try:
            return audio.peaks(f, buckets)
        except (subprocess.CalledProcessError, ValueError, OSError):
            raise EditorError(f"Can't read the audio in {f.name}") from None

    def _slice_dir(self, audio_path) -> Path:
        from .audio import slice_folder
        return slice_folder(self.project.path.parent, Path(audio_path))

    def slice_info(self, audio_path):
        """Peaks of a song to slice, fine enough to zoom in on (one per 2.5 ms, at most 120,000), plus the cut points
        used the last time it was sliced in this project."""
        from . import audio
        self._need_project()
        if not given(audio_path):
            raise EditorError("Choose a song to slice")
        ms = audio.duration_ms(Path(audio_path)) or 0
        buckets = int(min(120_000, max(2000, ms / 2.5)))
        home, song = self.project.path.parent, Path(audio_path)
        # then where cuts were kept before: the slices folder beside the project file, by song, and before songs had
        # a folder each
        places = [self._slice_dir(audio_path), audio.slice_folder(home, song, legacy=True), home / "slices" / song.stem]
        return {**self.peaks("file", path=audio_path, buckets=buckets),
                "previous": next(filter(None, (audio.previous_cuts(d, song) for d in places)), None)}

    def slice_fill(self, cue_id, audio_path, bounds_ms, start_source=None, sources=None):
        """Cuts one song at bounds_ms and assigns the pieces, in order: to `sources` when given (the slice tool's
        one slot per segment, so layers that play together don't get consecutive pieces), else to the cue's slots
        from start_source on."""
        from . import audio
        self.require_game()
        self._need_project()
        self._relative(self.project, audio_path)  # same checks as any assigned file
        if not isinstance(bounds_ms, list):
            raise EditorError("The cut points are a list of milliseconds")
        try:
            pieces = audio.slice_song(Path(audio_path), bounds_ms, self._slice_dir(audio_path))
        except ValueError as e:
            raise EditorError(str(e)) from None
        except OSError as e:
            raise EditorError(os_error(e)) from None
        if sources:
            return self.fill_sources(sources, [str(p) for p in pieces])
        return self.fill(cue_id, [str(p) for p in pieces], start_source=start_source)

    # --- project lifecycle
    def new_project(self, path, name, folder=False, tabs=None):
        """A new, empty project at path. folder: the project gets a folder of its own there, named like the file
        (`Dune.audi` chosen in Mods is Mods/Dune/Dune.audi), unless the folder chosen is named like it already.
        tabs: the hideable tabs it shows (project.TABS), as Settings has them; None leaves it to Settings."""
        from .projectfiles import folder_name
        if not given(path) or not Path(path).is_absolute():
            raise EditorError("Choose where to save the project (a full path)")
        if tabs is not None and (tabs := tab_list(tabs)) is None:
            raise EditorError("The tabs are some of " + ", ".join(TABS))
        path = Path(path).resolve()
        if path.suffix.lower() != ".audi":
            path = path.with_name(path.name + ".audi")  # "Dune 2.0" is Dune 2.0.audi, not Dune 2.audi
        if folder and path.parent.name.casefold() != path.stem.casefold():
            path = path.parent / folder_name(path.stem) / path.name
        if path.exists():
            raise EditorError(f"{path.name} already exists in {path.parent}")
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
        except OSError as e:
            raise EditorError(f"Can't make the folder {path.parent}: {os_error(e)}") from None
        name = str(name or "").strip() or path.stem.strip() or "My mod"
        with self.lock:
            self.project = Project(name=name, path=path, library=[], tabs=tabs)  # blank: nothing to edit yet
            self.project.save()
            self.undo_stack, self.redo_stack = [], []
            self.revision += 1
        if folder:  # the next new project is offered the same place
            save_settings(projects_folder=str(path.parent.parent))
        return self.project_state()

    def open_project(self, path):
        if not given(path) or not Path(path).is_absolute():
            raise EditorError("Choose a .audi project file (a full path)")
        path = Path(path).resolve()
        if self.project and self.project.path == path:
            return self.project_state()  # already open: keep its undo history
        if path.is_dir():
            raise EditorError(f"{path.name} is a folder. Choose a .audi project file.")
        if not path.exists():
            raise EditorError(f"{path} wasn't found")
        try:
            p = Project.load(path)
        except OSError as e:
            raise EditorError(f"Can't read {path.name}: {os_error(e)}") from None
        except ProjectFormatError as e:
            raise EditorError(f"{path.name} {e}") from None
        except (ValueError, KeyError, TypeError):  # not JSON at all: cut short, or another kind of file
            raise EditorError(f"{path.name} " + ("is damaged (it can't be read)" if path.suffix.lower() == ".audi"
                                                  else "isn't an Audiodiver project")) from None
        with self.lock:
            self.project, self.undo_stack, self.redo_stack = p, [], []
            self.revision += 1
        return self.project_state()

    def save_project(self):
        """Writes the project file now (Ctrl+S). Every edit saves it already; this is for peace of mind, and for a
        file that was changed on disk meanwhile."""
        with self.lock:
            self._need_project().save()
            return self.project_state()

    def close_project(self):
        with self.lock:
            self.project, self.undo_stack, self.redo_stack = None, [], []
            self.revision += 1

    def _need_project(self):
        if not self.project:
            raise EditorError("No project open")
        return self.project

    def _sources(self):
        """{source id: replacement} for the open project's targets that resolve in this game version (or are clips
        it adds)."""
        out, added = {}, self._added()
        for r in self.project.replacements:
            try:
                out[r.target if r.target in added or not self.ix else self.ix.resolve(r.target)] = r
            except KeyError:
                pass
        return out

    # --- audio the project adds (addition.py): new takes, layers, clips of their own
    def _added(self) -> dict:
        """{new clip: its addition} of the open project."""
        return self.project.added() if self.project else {}

    def _overlay(self):
        """The open project's added audio, as the banks' views show it (library.Added)."""
        from .library import Added
        p = self.project
        if not p or not p.additions:
            return None
        return Added(takes=tuple((a.container, a.sound, a.source) for a in p.additions if a.kind == "take"),
                     layers=tuple((a.container, a.beside) for a in p.additions if a.kind == "layer"),
                     own=tuple((a.sound, a.source) for a in p.additions if a.kind == "own"))

    def _clip_of(self, oid: int) -> int | None:
        """The game's clip a Sound plays, or the first take of a container plays (kept: it reads a bank)."""
        from .addition import first_clip
        if oid not in self._clips:
            self._clips[oid] = first_clip(self.ix, oid)
        return self._clips[oid]

    def _stand_ins(self, p: Project) -> dict:
        """{the game's clip: [{"place", "banks"}]}, one entry per Sound that plays a clip of its own in place of
        it: the Audio tab tags the other Sounds that play the clip, which keep the Original. place: the Library's
        name of the Sound's first bank."""
        out = {}
        if not self.ix or not self.lib:
            return out
        for a in p.additions:
            if a.kind == "own" and (clip := self._clip_of(a.sound)) is not None:
                banks = self.ix.copies(a.sound)
                out.setdefault(str(clip), []).append({"place": self.lib.bank_label(banks[0]) if banks else "",
                                                      "banks": [str(b) for b in banks]})
        return out

    def _original(self, sid: int) -> int | None:
        """The game's clip an added clip stands in for: a clip of its own's; None for a new take."""
        a = self._added().get(sid)
        return self._clip_of(a.sound) if a and a.kind == "own" else None

    def _anchor(self, sid: int) -> int:
        """The game's clip that says where an added clip is listed: the one it stands in for, or one of the sound's
        it is a take of (a layer's: of the sound it plays with). Any other clip is its own anchor."""
        a = self._added().get(sid)
        if not a or not self.ix:
            return sid
        if a.kind == "own":
            return self._clip_of(a.sound) or sid
        beside = {x.container: x.beside for x in self.project.additions if x.kind == "layer"}
        return self._clip_of(beside.get(a.container, a.container)) or sid

    @staticmethod
    def _tidy(p: Project):
        """Added audio is its audio: a take or a clip of its own whose new audio is gone goes too, and a layer
        without takes."""
        have = {r.target for r in p.replacements}
        kept = [a for a in p.additions if a.kind == "layer" or a.source in have]
        used = {a.container for a in kept if a.kind == "take"}
        p.additions = [a for a in kept if a.kind != "layer" or a.container in used]

    def _tidy_cues(self, p: Project):
        """Cue points are in ms of a segment's new audio: when the last of it goes, so do they (left behind, they
        would move the game's own cue points)."""
        if not p.segment_overrides or not self.catalog:
            return
        have = {self._target(r.target) for r in p.replacements}
        for seg in list(p.segment_overrides):
            cue = next((self.catalog.cm.cues[c] for c in self.catalog.cm.by_segment.get(seg, [])), None)
            if cue is None:
                continue  # a segment this game version doesn't have: kept, as the build leaves it out
            sources = {sl["source"] for s in cue["segments"] if s["segment"] == seg
                       for st in s["stems"] for sl in st["slots"]}
            if not sources & have:
                del p.segment_overrides[seg]

    def _new_ids(self, p: Project, n: int) -> list[int]:
        """n new ids the game and the project don't use."""
        from .addition import new_id
        taken, out = set(self.ix.taken) | p.made_ids() | {r.target for r in p.replacements}, []
        for _ in range(n):
            out.append(new_id(taken))
            taken.add(out[-1])
        return out

    def _audio_files(self, files) -> list[str]:
        from .audio import natural
        if not isinstance(files, list) or not files or not all(given(f) for f in files):
            raise EditorError("Choose the audio files to add")
        return sorted((str(f) for f in files), key=natural)

    def add_takes(self, container, files):
        """New takes in a random container (the game's, or a layer's), one per file, in file-name order, as one
        undo step: the container picks them like its other takes. The answer's `sources` are their slots."""
        from .addition import take_problem
        self.require_game()
        files = self._audio_files(files)
        cid, made = self._object_id(container), []
        p = self._need_project()
        if not any(a.kind == "layer" and a.container == cid for a in p.additions):
            if why := take_problem(self.ix, cid):
                raise EditorError(why)

        def apply(p):
            for f in files:
                sound, source = self._new_ids(p, 2)
                p.additions.append(Addition("take", container=cid, sound=sound, source=source))
                self._set(p, source, f)
                made.append(str(source))
        return {**self._edit("add take", apply), "sources": made}

    def add_layer(self, beside, files):
        """A layer beside one of the game's containers, with a take per file, as one undo step: it plays whenever
        that container plays. The answer's `sources` are the takes' slots."""
        from .addition import layer_problem
        self.require_game()
        files = self._audio_files(files)
        cid, made = self._object_id(beside), []
        self._need_project()
        if why := layer_problem(self.ix, cid):
            raise EditorError(why)

        def apply(p):
            (layer,) = self._new_ids(p, 1)
            p.additions.append(Addition("layer", container=layer, beside=cid))
            for f in files:
                sound, source = self._new_ids(p, 2)
                p.additions.append(Addition("take", container=layer, sound=sound, source=source))
                self._set(p, source, f)
                made.append(str(source))
        return {**self._edit("add layer", apply), "sources": made}

    def own_clip(self, source, sound):
        """Gives one Sound a clip of its own: the new audio in its slot plays only where that Sound plays, and the
        other Sounds that play the clip keep the original. The answer's `source` is the slot it moves to."""
        from .addition import sound_clip
        self.require_game()
        sid, snd, made = self._source(source), self._object_id(sound), []
        if sound_clip(self.ix, snd) != sid:
            raise EditorError(f"Sound {snd} doesn't play {sid}")
        if any(a.kind == "own" and a.sound == snd for a in self._need_project().additions):
            raise EditorError("That sound already has a separate clip")

        def apply(p):
            r = self._replacement(p, sid)
            if not r:
                raise EditorError("Add new audio to the slot first")
            (new,) = self._new_ids(p, 1)
            p.additions.append(Addition("own", sound=snd, source=new))
            r.target = new
            made.append(str(new))
        return {**self._edit("own clip", apply), "source": made[0]}

    def shared_clip(self, source):
        """Takes a clip of its own back: the new audio goes to every Sound that plays the clip again. The answer's
        `source` is the slot it moves to."""
        self.require_game()
        sid = self._source(source)
        a = self._added().get(sid)
        if not a or a.kind != "own":
            raise EditorError("That slot doesn't have a separate clip")
        was = self._clip_of(a.sound)

        def apply(p):
            if self._replacement(p, was):
                raise EditorError("Another sound that plays this clip already has new audio. Remove that audio first.")
            self._replacement(p, sid).target = was
        return {**self._edit("shared clip", apply), "source": str(was)}

    @staticmethod
    def _object_id(v) -> int:
        try:
            return int(v)
        except (TypeError, ValueError, OverflowError):
            raise EditorError(f"{v!r} isn't an object id") from None

    def _rep(self, sid) -> Replacement:
        try:
            key = int(sid)
        except (TypeError, ValueError, OverflowError):
            raise EditorError(f"{sid!r} isn't a sound id") from None
        r = self._sources().get(key)
        if not r:
            raise EditorError(f"Slot {sid} has no new audio")
        return r

    # --- what the project works on: its list of Index items and archives (project.py, "library")
    def _part_sounds(self, cue_id: str) -> frozenset:
        """The sounds of one part of a listed item (kept: a bank's can run to thousands)."""
        if cue_id not in self._cue_sets:
            try:
                self._cue_sets[cue_id] = frozenset(self.lib.cue_sources(cue_id))
            except (KeyError, ValueError):
                self._cue_sets[cue_id] = frozenset()
        return self._cue_sets[cue_id]

    def _listed(self, ids) -> tuple[dict[str, frozenset], list[str]]:
        """({part cue id: its sounds} over these items, the ids this game version has nothing for)."""
        parts, missing = {}, []
        for iid in ids:
            try:
                item = self.lib.item(iid)
            except KeyError:
                missing.append(iid)
                continue
            for part in item["parts"]:
                parts[part["cue"]] = self._part_sounds(part["cue"])
        return parts, missing

    def _listed_banks(self, p: Project) -> set[int]:
        """The banks of what a project lists, where a build puts its sounds (build.reach)."""
        return self.lib.banks(p.library or []) if self.lib and not p.every_bank else set()

    def _homes(self, sids, covered=()) -> list[str]:
        """The items and archives these sounds belong to, in the Index's order, leaving out the sounds in
        `covered` (what the project lists already)."""
        covered, homes = set(covered), []
        for sid in sids:
            if sid in covered:
                continue
            home = self.lib.home(sid)
            if home and home not in homes:
                homes.append(home)
                covered |= self.lib.item_sources(home)
        order = self.lib.order
        return sorted(homes, key=lambda i: (i not in order, order.get(i, 0), i))

    def _resolved(self, r: Replacement) -> int | None:
        """The game's sound a replacement is listed by: its target as this game version has it, or for an added
        clip its anchor; None for a target the game no longer has."""
        if r.target in self._added():
            return self._anchor(r.target)
        try:
            return self.ix.resolve(r.target)
        except KeyError:
            return None

    def _cover(self, p: Project):
        """Keeps the list in step with the replacements: what a project replaces, it lists, so the Editor shows it.
        A replacement in a slot nothing on the list holds adds the piece of music, sound set or archive it belongs
        to (skipping a transition the project doesn't list yet, importing a mod's patch)."""
        if p.library is None or not self.lib:
            return
        parts = self._listed(p.library)[0].values()
        loose = [s for s in map(self._resolved, p.replacements) if s is not None and not any(s in part for part in parts)]
        if loose:
            p.library = [*p.library, *(h for h in self._homes(loose) if h not in p.library)]

    def _adopt(self, p: Project):
        """A project from before projects listed what they work on gets its list: the piece of music, sound set or
        archive each of its replacements belongs to. It needs the game, so until that is read there is no list.
        A sound set the Index has renamed since the list was written goes by its new name."""
        if p.library is None and self.lib:
            p.library = []
            self._cover(p)
        elif p.library and self.lib and any(i in self.lib.renamed for i in p.library):
            p.library = list(dict.fromkeys(self.lib.renamed.get(i, i) for i in p.library))

    def _list_name(self, iid) -> str:
        """An item as the Editor's list shows it, telling an archive from the sound set it is named after."""
        it = self.lib.item(iid)
        return f"{it['full']} (archive {it['archive']})" if "archive" in it and it["full"] != f"Archive {it['archive']}" \
            else it["full"]

    def library_add(self, items):
        """Adds Index items and archives to what the project works on. From then on the Editor shows them. The same
        bank is never listed twice: a sound set or archive whose banks the list has already (a weapon's set and its
        archive, or two archives with the same bank) isn't added, and one that shares only some is; the answer's
        `notes` say so in a sentence each. Music goes by its cues and is always added."""
        self.require_game()
        ids = list(dict.fromkeys(str(i) for i in items))
        for i in ids:
            self.item(i)  # EditorError for one this game version doesn't have
        notes = []
        banks = lambda it: [x["cue"] for x in it["parts"] if x["cue"].startswith(("bank:", "streams:"))]

        def apply(p):
            held = {}  # a bank (or an archive's loose streams) -> the listed item that has it
            for iid in p.library or []:
                try:
                    for c in banks(self.lib.item(iid)):
                        held.setdefault(c, iid)
                except KeyError:
                    continue  # this game version has nothing for it
            new = []
            for iid in ids:
                if iid in (p.library or []):
                    continue
                it = self.lib.item(iid)
                mine = banks(it)
                have = [c for c in mine if c in held]
                owners = ", ".join(self._list_name(o) for o in dict.fromkeys(held[c] for c in have))
                if mine and len(have) == len(it["parts"]):
                    notes.append(f"The sounds of {self._list_name(iid)} are already in the project, under {owners}.")
                    continue
                if have:
                    notes.append(f"{self._list_name(iid)} added. {len(have)} of {len(mine)} banks "
                                 f"{'was' if len(have) == 1 else 'were'} already in the project, under {owners}. Those "
                                 f"sounds show under both.")
                new.append(iid)
                for c in mine:
                    held.setdefault(c, iid)
            p.library = [*(p.library or []), *new]
        return {**self._edit("add", apply), "notes": notes}

    def library_remove(self, items):
        """Takes items off the project's list, and with them your audio in their slots: what the project no longer
        lists, it no longer replaces. Audio in a slot that something still on the list has too is kept."""
        self.require_game()
        gone = {str(i) for i in items}

        def apply(p):
            drop = {id(r) for r in self._unlisted(p, gone)}
            p.library = [i for i in (p.library or []) if i not in gone]
            p.replacements = [r for r in p.replacements if id(r) not in drop]
        return self._edit("unlist", apply)

    def library_remove_preview(self, items):
        """What library_remove would take with the items: the slots with new audio, and the files they play (the
        app asks before taking them)."""
        self.require_game()
        drop = self._unlisted(self._need_project(), {str(i) for i in items})
        return {"slots": len(drop), "files": list(dict.fromkeys(Path(r.audio).name for r in drop if not r.silence))}

    def _unlisted(self, p: Project, gone: set) -> list:
        """The replacements that go when the items `gone` leave the list: those in their slots, but for a slot that
        something still on the list has too."""
        keep = [i for i in (p.library or []) if i not in gone]
        sounds = lambda ids: {s for part in self._listed(ids)[0].values() for s in part}
        drop = sounds(i for i in (p.library or []) if i in gone) - sounds(keep)
        return [r for r in p.replacements if self._resolved(r) in drop]

    FACTS_SECONDS = 30  # how long project_state trusts what it found out about the project's folder

    def _folder_facts(self, p: Project) -> dict:
        """The project's folder, for the Project tab: whether it is the project's own, how many other projects are in
        it, where Move would put the project file (move_to, None in a folder of its own), and how many of the files
        it uses are outside it. project_state runs on every edit (a slider's every save), so what needs the disk is
        kept: the folder's facts until a file is added, removed or renamed in it (its time changes), the files' until
        the project uses others; either for FACTS_SECONDS at most. A folder changed in the last two seconds is read
        again each time, as Windows' file times move in steps of about 16 ms."""
        from . import projectfiles as pf
        folder, now, c = p.path.parent, time.monotonic(), self._facts
        try:
            stamp = folder.stat().st_mtime_ns
        except OSError:
            stamp = None
        if c.get("where") != (str(p.path), stamp) or now - c["where_at"] > self.FACTS_SECONDS \
                or stamp is None or time.time_ns() - stamp < 2_000_000_000:
            own = pf.own_folder(p.path)
            dest = None if own else pf.move_dest(p.path)
            c.update(where=(str(p.path), stamp), where_at=now, own_folder=own, folder_projects=len(pf.others(p.path)),
                     move_to=str(dest / f"{dest.name}.audi") if dest else None)
        rels = frozenset([*(r.audio for r in p.replacements if not r.silence), p.icon.get("image") or ""])
        if c.get("uses") != (str(p.path), rels) or now - c["uses_at"] > self.FACTS_SECONDS:
            used = {pf.norm(folder / rel) for rel in rels if isinstance(rel, str) and rel.strip()}
            c.update(uses=(str(p.path), rels), uses_at=now,
                     files_elsewhere=sum(1 for f in used if pf.inside(f, folder) is None and f.is_file()))
        return {k: c[k] for k in ("own_folder", "folder_projects", "move_to", "files_elsewhere")}

    def project_state(self):
        from .arsenal import icon_frame, slug
        from .audio import SILENCE_MS, duration_ms
        from .build import zip_name
        p = self._need_project()
        self._adopt(p)
        assignments, unresolved, added = {}, [], p.added()
        for r in p.replacements:
            try:
                sid = self.ix.resolve(r.target) if self.ix and r.target not in added else r.target
            except KeyError:
                unresolved.append({"target": str(r.target), "audio": r.audio, "label": r.label})
                continue
            cues = self.catalog.cm.by_source.get(sid, []) if self.catalog else []
            exists = r.silence or p.audio_path(r).exists()
            assignments[str(sid)] = {
                "target": str(r.target), "audio": r.audio, "label": r.label, "gain_db": r.gain_db,
                "fit_timing": r.fit_timing, "silence": r.silence, "exists": exists,
                "name": "Silence" if r.silence else Path(r.audio).name, "cues": [str(c) for c in cues],
                "duration_ms": SILENCE_MS if r.silence else duration_ms(p.audio_path(r)) if exists else None}
        by_file = {}  # a file -> the music segments that play it: where one slot's cue points can go too
        for sid, a in assignments.items():
            if not a["silence"]:
                by_file.setdefault(a["audio"], set()).update(self._segments_of(int(sid)))
        for a in assignments.values():
            a["file_segments"] = 0 if a["silence"] else len(by_file[a["audio"]])
        problems = p.problems() + [f"{u['label'] or u['audio'] or 'silence'}: sound {u['target']} isn't in this "
                                   f"version of the game (remove it, or replace another sound)" for u in unresolved]
        by_sound = {}
        for r in p.replacements:  # two targets can be one sound: a stream's file id and its source id
            by_sound.setdefault(self._target(r.target), {})[r.target] = r.label or r.audio or "silence"
        problems += [f"{' and '.join(names.values())} replace the same sound" for names in by_sound.values()
                     if len(names) > 1]  # the same target twice, problems() names already
        problems += [f"{a['label'] or a['name']}: can't read the audio file ({a['audio']})" for a in assignments.values()
                     if a["exists"] and a["audio"] and not a["silence"] and not a["duration_ms"]]
        problems += [f"{a['label'] or 'a slot'}: no audio file named" for a in assignments.values()
                     if not a["audio"] and not a["silence"]]
        if p.loudness_analysis:
            from . import akd
            if why := akd.unavailable():
                problems.append(f"Wwise loudness analysis: {why[:1].lower() + why[1:]} (turn it off under Build options)")
        try:
            frame = icon_frame(p.icon)
        except ValueError:  # a hand-edited project file: the build names the problem
            frame = icon_frame()
        # the project's list: what the Editor shows. in_banks counts your audio in each bank it lists (a bank's
        # sounds are too many to send along, so the count stands in for them); outside is your audio that nothing
        # on the list holds
        library, missing, in_banks, outside = list(p.library or []), [], {}, []
        if self.lib:
            parts, missing = self._listed(library)
            mine = {int(s): self._anchor(int(s)) for s in assignments}  # an added clip is listed by its anchor
            inside = set()
            for cue, sounds in parts.items():
                got = {s for s, at in mine.items() if at in sounds}
                inside |= got
                if got and not cue.isdigit():
                    in_banks[cue] = len(got)
            outside = [s for s in assignments if int(s) not in inside]
        return {"repairs": p.repairs, "library": [i for i in library if i not in missing], "library_missing": missing, "in_banks": in_banks,
                "outside": outside,
                "path": str(p.path), "folder": str(p.path.parent), "name": p.name, "guid": p.guid,
                **self._folder_facts(p),
                "revision": self.revision, "version": p.version, "description": p.description, "icon": p.icon, "icon_frame": frame,
                "loudness_analysis": p.loudness_analysis, "every_bank": p.every_bank, "patch_files": p.patch_files,
                "build_folder": str(p.build_dir()), "build_folder_default": str(p.default_build_dir()),
                "zip_name": zip_name(p), "last_build": (last := _last_build(p.build_dir(), slug(p.name))),
                "game_updated": (updated := bool(self.ix) and _game_updated(p, self.ix.game, last)),
                "rebuild": _rebuild(p, updated, last),
                "assignments": assignments, "unresolved": unresolved,
                "segment_overrides": {str(k): v for k, v in p.segment_overrides.items()},
                "texts": [{"table": str(t.table), "id": t.id, "text": t.text, "was": t.was} for t in p.texts],
                "additions": p.to_json().get("additions", []), "stand_ins": self._stand_ins(p),
                "settings": len(p.settings), "notes": dict(p.notes),
                "soundtrack": {str(k): v.to_json() for k, v in p.soundtrack.items()}, "tabs": p.tabs,
                "problems": problems, "can_undo": bool(self.undo_stack), "can_redo": bool(self.redo_stack),
                "undo_label": self.undo_stack[-1][0] if self.undo_stack else None,
                "redo_label": self.redo_stack[-1][0] if self.redo_stack else None}

    # --- edits (each one is undoable and autosaves)
    def _edit(self, label, fn):
        with self.lock:
            p = self._need_project()
            self._adopt(p)  # before the edit, so undoing it doesn't take the list away again
            before = p.to_json()
            try:
                fn(p)
                self._tidy(p)
                self._tidy_cues(p)
                self._cover(p)
            except BaseException:
                self.project = Project.from_json(before, p.path)  # an edit that fails half-way changes nothing
                raise
            if p.to_json() != before:
                try:
                    p.save()
                except OSError as e:  # memory and the file stay the same: the edit didn't happen
                    self.project = Project.from_json(before, p.path)
                    raise EditorError(_unsaved(e, p.path)) from None
                self.revision += 1
                self.undo_stack.append((label, before))
                del self.undo_stack[:-UNDO_LIMIT]
                self.redo_stack.clear()
            return self.project_state()

    def _restore(self, d):
        self.revision += 1
        self.project = Project.from_json(d, self.project.path)
        floor = self.version_floor.get(self.project.guid, 0)  # a build moved it on: undo doesn't take that back
        self.project.version = max(self.project.version, floor)
        self.project.built_for = self.built_for.get(self.project.guid, self.project.built_for)
        self.project.built_from = self.built_from.get(self.project.guid, self.project.built_from)
        self.project.save()

    def undo(self):
        with self.lock:
            self._need_project()
            if self.undo_stack:
                self._step(self.undo_stack, self.redo_stack)
            return self.project_state()

    def redo(self):
        with self.lock:
            self._need_project()
            if self.redo_stack:
                self._step(self.redo_stack, self.undo_stack)
            return self.project_state()

    def _step(self, src, dst):
        """Moves one step from src to dst (undo or redo). A project file that can't be saved keeps both as they were."""
        label, d = src[-1]
        now = self.project.to_json()
        try:
            self._restore(d)
        except OSError as e:
            self.project = Project.from_json(now, self.project.path)
            raise EditorError(_unsaved(e, self.project.path)) from None
        src.pop()
        dst.append((label, now))

    def _relative(self, p: Project, audio) -> str:
        from .audio import duration_ms
        if not isinstance(audio, (str, os.PathLike)) or not str(audio).strip():
            raise EditorError("Choose an audio file")
        audio = Path(audio)
        if not audio.is_absolute():
            raise EditorError(f"{audio} isn't a full path")
        if not audio.exists():
            raise EditorError(f"{audio} wasn't found")
        if audio.suffix.lower() not in AUDIO_TYPES or audio.is_dir():
            raise EditorError(f"{audio.name} is not an audio file Audiodiver can read")
        if not duration_ms(audio):  # unreadable or empty: refused now, not at the next build
            raise EditorError(f"Can't read the audio in {audio.name}")
        try:
            return audio.resolve().relative_to(p.path.parent.resolve(), walk_up=True).as_posix()
        except ValueError:  # another drive
            return str(audio.resolve())

    def _target(self, t: int) -> int:
        """The source a replacement's target plays now; the same id when this game version no longer has it (such a
        replacement stays in the project, listed as unresolved, until it is removed)."""
        if not self.ix or t in self._added():
            return t
        try:
            return self.ix.resolve(t)
        except KeyError:
            return t

    def _source(self, s) -> int:
        """A source id the UI sends, as the source it plays in this game version."""
        try:
            sid = int(s)
        except (TypeError, ValueError, OverflowError):
            raise EditorError(f"{s!r} isn't a sound id") from None
        if not self.ix or sid in self._added():
            return sid
        try:
            return self.ix.resolve(sid)
        except KeyError:
            raise EditorError(f"Sound {sid} isn't in this version of the game") from None

    def _set(self, p: Project, sid: int, audio: str, label=None):
        rel = self._relative(p, audio)
        current = {self._target(r.target): r for r in p.replacements}
        if sid in current:
            r = current[sid]
            if r.silence:  # a file in place of silence: its timing follows the file again, as for any new file
                r.silence, r.fit_timing = False, True
            r.audio, r.label = rel, label if label is not None else Path(audio).stem
        else:
            p.replacements.append(Replacement(target=sid, audio=rel, label=label or Path(audio).stem))

    def assign(self, source, audio, label=None):
        self.require_game()
        sid = self._source(source)
        return self._edit("assign", lambda p: self._set(p, sid, audio, None if label is None else str(label)))

    def fill(self, cue_id, files, only_empty=False, start_source=None):
        """Assigns files, in file-name order, to a cue's slots (play order; skips never-heard, locked and absent slots).
        only_empty keeps existing assignments; start_source starts at that slot (dropping an album on slot #3)."""
        cue = self.cue(cue_id, mine=True)
        targets = [s["source"] for seg in cue["segments_detail"] for st in seg["stems"] for s in st["slots"]
                   if not s["unused"] and not s["locked"] and not s.get("absent")]
        targets = list(dict.fromkeys(targets))
        if start_source is not None and str(start_source) in targets:
            targets = targets[targets.index(str(start_source)):]
        return self.fill_sources(targets, files, only_empty)

    def fill_sources(self, sources, files, only_empty=False):
        """Assigns files to sources in order, as one undo step. Files go in natural file-name order ("Track 2"
        before "Track 10"), whatever order a picker or a drop gave them in. Fills a whole multi-part piece too."""
        from .audio import natural
        self.require_game()
        if not isinstance(files, list) or not isinstance(sources, list):
            raise EditorError("Choose the files and the slots to fill")
        files = sorted((str(f) for f in files), key=natural)
        targets = list(dict.fromkeys(self._source(s) for s in sources))  # stream ids and old ids as the sounds they are

        def apply(p):
            taken = set(self._sources()) if only_empty else set()
            free = [t for t in targets if t not in taken]
            for sid, f in zip(free, files):
                self._set(p, sid, f)
        return self._edit("fill", apply)

    def _replacement(self, p, sid):
        return next((r for r in p.replacements if self._target(r.target) == sid), None)

    def copy_audio(self, pairs):
        """Gives each target slot the audio and settings of another slot ([[from, to], ...]), as one undo step:
        copy and paste between slots."""
        self.require_game()
        if not isinstance(pairs, list) or not all(isinstance(x, (list, tuple)) and len(x) == 2 for x in pairs):
            raise EditorError("Copy needs pairs of slots, from and to")
        pairs = [(self._source(a), self._source(b)) for a, b in pairs]

        def apply(p):
            for a, b in pairs:
                src = self._replacement(p, a)
                if not src or a == b:
                    continue
                dst = self._replacement(p, b)
                if not dst:
                    dst = Replacement(target=b, audio=src.audio)
                    p.replacements.append(dst)
                dst.audio, dst.label, dst.gain_db, dst.fit_timing, dst.silence = \
                    src.audio, src.label, src.gain_db, src.fit_timing, src.silence
        return self._edit("paste", apply)

    def swap(self, a, b):
        """Swaps the audio and settings of two slots, as one undo step; an empty slot takes the other's audio
        (moving it). For reordering after a fill."""
        self.require_game()
        sa, sb = self._source(a), self._source(b)

        def apply(p):
            ra, rb = self._replacement(p, sa), self._replacement(p, sb)
            if ra:
                ra.target = sb
            if rb:
                rb.target = sa
        return self._edit("move", apply)

    def silence(self, sources, keep_timing=False, label="silence"):
        """Replaces sources with the built-in silence, as one undo step. keep_timing=False fits the timing to it, so
        the game moves straight on (skipping a transition, or a stinger that would play over your music); True keeps
        the game's timing, so the slot is silent for as long as the game's audio would play (muting one layer)."""
        self._need_project()
        if not isinstance(sources, list):
            raise EditorError("Choose the slots to silence")
        sids = [self._source(s) for s in sources]

        def apply(p):
            for sid in sids:
                r = self._replacement(p, sid)
                if not r:
                    r = Replacement(target=sid, audio="")
                    p.replacements.append(r)
                r.audio, r.label, r.silence, r.gain_db, r.fit_timing = "", "", True, 0.0, not keep_timing
        return self._edit(label, apply)

    def skip(self, sources):
        """Silence that moves straight on: for transitions and stingers that would otherwise play the game's audio
        between or over yours."""
        return self.silence(sources, keep_timing=False, label="skip")

    def unassign(self, sources):
        """Takes the new audio off slots. An id the game no longer has (an unresolved target) is taken off too:
        that is how such a replacement leaves the project."""
        if not isinstance(sources, list):
            raise EditorError("Choose the slots to clear")
        try:
            sids = {int(s) for s in sources}
        except (TypeError, ValueError, OverflowError):
            raise EditorError("Those aren't sound ids") from None
        if self.ix:
            sids |= {self._target(s) for s in sids}

        def apply(p):
            p.replacements = [r for r in p.replacements if r.target not in sids and self._target(r.target) not in sids]
        return self._edit("unassign", apply)

    @staticmethod
    def _field(k, v):
        """A slot setting from the UI, checked: Make-Up Gain is a finite number of dB in the slider's range."""
        if k == "gain_db":
            if isinstance(v, bool) or not isinstance(v, (int, float)):
                raise EditorError("Make-Up Gain is a number of dB")
            g = float(v)
            if not math.isfinite(g) or not GAIN_DB[0] <= g <= GAIN_DB[1]:
                raise EditorError(f"Make-Up Gain goes from {GAIN_DB[0]:+g} to {GAIN_DB[1]:+g} dB")
            return g
        if k == "fit_timing":
            if not isinstance(v, bool):
                raise EditorError("Fit timing is on or off")
            return v
        if v is not None and not isinstance(v, str):
            raise EditorError("A slot's label is text")
        return v or ""  # label

    def update(self, source, **fields):
        bad = set(fields) - {"gain_db", "fit_timing", "label"}
        if bad:
            raise EditorError(f"Unknown fields {sorted(bad)}")
        checked = {k: self._field(k, v) for k, v in fields.items()}  # all checked before any is changed

        def apply(p):
            r = self._rep(source)
            for k, v in checked.items():
                setattr(r, k, v)
        return self._edit("update", apply)

    def update_many(self, sources, **fields):
        if not isinstance(sources, list):
            raise EditorError("Choose the slots to change")
        checked = {k: self._field(k, v) for k, v in fields.items() if k in ("gain_db", "fit_timing")}

        def apply(p):
            for s in sources:
                r = self._rep(s)
                for k, v in checked.items():
                    setattr(r, k, v)
        return self._edit("update", apply)

    @staticmethod
    def _icon(p: Project, v) -> dict:
        """An icon from the UI, checked: its frame (only the keys it sets; the rest stay defaults) and the project's
        image. An image comes in through set_icon; here it can only be kept, or left out to go back to the default
        icon."""
        from .arsenal import FRAME_KEYS, icon_frame
        if not isinstance(v, dict):
            raise EditorError("The icon setting holds the frame; set an image with set_icon")
        given = {k: v[k] for k in FRAME_KEYS if k in v}
        try:
            frame = icon_frame(given)
        except ValueError as e:
            raise EditorError(f"Icon: {e}") from None
        out = {k: frame[k] for k in given}
        if v.get("image") and v["image"] == p.icon.get("image"):
            out["image"] = p.icon["image"]
        return out

    def _build_folder(self, p: Project, v) -> str:
        """A folder for this project's builds, as the project stores it: relative to the project file (absolute on
        another drive), or "" for the build folder next to it (also when that one is chosen by hand). It has to be
        a folder that exists, outside the game's own: Audiodiver never writes there."""
        from .game import in_game_folder
        if not v:
            return ""
        folder = Path(str(v))
        if not folder.is_absolute() or not folder.is_dir():
            raise EditorError(f"{folder} is not a folder")
        folder = folder.resolve()
        if self.game_where["path"] and in_game_folder(folder, self.game_where["path"]):
            raise EditorError("That folder is inside the game folder, and Audiodiver never writes there. Choose another "
                              "folder, and import the ZIP in a mod manager.")
        if folder == p.default_build_dir().resolve():
            return ""
        try:
            return folder.relative_to(p.path.parent.resolve(), walk_up=True).as_posix()
        except ValueError:  # another drive
            return str(folder)

    def settings(self, **fields):
        """Changes what the build packages the mod as (name, version, description, icon, a new id or one given),
        where its builds go and whether they also save the patch files, and the tabs the project shows. Every value
        is checked before any is changed."""
        from . import akd
        bad = set(fields) - {"name", "version", "description", "icon", "build_folder", "guid", "loudness_analysis",
                             "every_bank", "patch_files", "tabs"}
        if bad:
            raise EditorError(f"Unknown setting {sorted(bad)[0]}")
        checked = {}
        for k, v in fields.items():
            if k in ("name", "description") and not isinstance(v, str):
                raise EditorError(f"The {k} is text")
            if k == "version":
                if isinstance(v, bool) or not isinstance(v, (int, float, str)) or not str(v).strip().isdigit() \
                        or not 1 <= int(str(v).strip()) <= 99999:
                    raise EditorError("The version is a whole number from 1 to 99999")
                v = int(str(v).strip())
            elif k == "guid" and v != "new":
                try:
                    v = str(uuid.UUID(str(v)))
                except ValueError:
                    raise EditorError("That isn't a mod id (a GUID like 3f2a…-…)") from None
            elif k == "loudness_analysis":
                if not isinstance(v, bool):
                    raise EditorError("Loudness analysis is on or off")
                if v and (why := akd.unavailable()):
                    raise EditorError(f"Loudness analysis: {why}")
            elif k == "every_bank" and not isinstance(v, bool):
                raise EditorError("Every bank is on or off")
            elif k == "patch_files" and not isinstance(v, bool):
                raise EditorError("Patch files are on or off")
            elif k == "tabs" and v is not None and (v := tab_list(v)) is None:
                raise EditorError("The tabs are some of " + ", ".join(TABS))
            checked[k] = v

        def apply(p):
            for k, v in checked.items():
                if k == "name":
                    p.name = v.strip() or p.name
                elif k == "version":
                    p.version = v
                    self.version_floor.pop(p.guid, None)  # set by hand: that is the version from now on
                elif k == "description":
                    p.description = v.strip()
                elif k == "icon":
                    p.icon = self._icon(p, v)
                elif k == "build_folder":  # None: back to the build folder next to the project file
                    p.build_folder = self._build_folder(p, v)
                elif k == "guid":  # "new": a mod of its own from now on (a copied project, a fork)
                    p.guid = str(uuid.uuid4()) if v == "new" else v
                elif k == "loudness_analysis":
                    p.loudness_analysis = v
                elif k == "every_bank":
                    p.every_bank = v
                elif k == "patch_files":
                    p.patch_files = v
                elif k == "tabs":  # None: as Settings says again
                    p.tabs = v
        return self._edit("tabs" if set(checked) == {"tabs"} else "settings", apply)

    def set_note(self, key, project_text):
        """Writes the open project's note on one thing (notes.py's keys); "" removes it. One undoable edit. Returns
        the project."""
        from . import notes
        try:
            notes.check(key, project_text)
        except ValueError as e:
            raise EditorError(str(e)) from None
        self._need_project()

        def apply(p):
            kept = notes.check(key, project_text)[1]
            if kept:
                p.notes[key] = kept
            else:
                p.notes.pop(key, None)
        return {"project": self._edit("note", apply)}

    def set_icon(self, image):
        """Uses an image file as the mod's icon. Like audio, it stays where it is and the project points at it;
        the build fits it to Arsenal's 540x540 PNG. The icon's frame stays as it is."""
        from PIL import Image
        from . import arsenal
        p = self._need_project()
        if not given(image):
            raise EditorError("Choose an image")
        image = Path(image)
        if not image.is_file():
            raise EditorError(f"{image} wasn't found")
        try:
            arsenal.icon_png(image)
        except Image.DecompressionBombError:
            raise EditorError(f"{image.name} is too large to use as an icon") from None
        except (ValueError, OSError) as e:
            raise EditorError(str(e)) from None
        try:
            rel = image.resolve().relative_to(p.path.parent.resolve(), walk_up=True).as_posix()
        except ValueError:  # another drive
            rel = str(image.resolve())
        return self._edit("settings", lambda p: setattr(p, "icon", {**p.icon, "image": rel}))

    def icon(self, preview=None) -> bytes:
        """The open project's icon as the build would package it (PNG bytes). preview: an icon (as settings takes
        it) to draw instead of the saved one, for trying a border or corners before they are saved."""
        from .build import BuildError, icon_bytes
        p = self._need_project()
        try:
            return icon_bytes(p, None if preview is None else self._icon(p, preview))
        except BuildError as e:
            raise EditorError(str(e)) from None

    @staticmethod
    def _segment_id(segment) -> int:
        try:
            return int(segment)
        except (TypeError, ValueError, OverflowError):
            raise EditorError(f"{segment!r} isn't a segment id") from None

    @staticmethod
    def _cue_ms(v) -> float | None:
        """A cue point the UI sends, in ms; None for an empty one."""
        if v is None or v == "":
            return None
        if isinstance(v, bool) or not isinstance(v, (int, float, str)):
            raise EditorError("A cue point is a number of milliseconds")
        try:
            ms = float(v)
        except ValueError:
            raise EditorError("A cue point is a number of milliseconds") from None
        if not math.isfinite(ms) or ms < 0 or ms > 3_600_000:
            raise EditorError("A cue point is a number of milliseconds from 0")
        return ms

    @staticmethod
    def _cues_ok(o: dict) -> dict:
        if "entry_marker" in o and "exit_marker" in o and o["entry_marker"] >= o["exit_marker"]:
            raise EditorError("The Entry cue point comes before the Exit")
        return o

    @staticmethod
    def _put_cues(p: Project, seg: int, o: dict):
        if o:
            p.segment_overrides[seg] = dict(o)
        else:
            p.segment_overrides.pop(seg, None)

    def segment_override(self, segment, entry_marker=None, exit_marker=None):
        """Sets (or, with neither, clears) a music segment's cue points in ms of its new audio."""
        seg = self._segment_id(segment)
        o = self._cues_ok({k: ms for k, v in (("entry_marker", entry_marker), ("exit_marker", exit_marker))
                           if (ms := self._cue_ms(v)) is not None})
        return self._edit("segment", lambda p: self._put_cues(p, seg, o))

    def segment_overrides(self, segments, **cues):
        """Cue points for several music segments at once, in ms of each one's new audio: one given (entry_marker,
        exit_marker) goes on every segment, an empty one comes off every segment, and one not given stays as each
        segment has it."""
        if not isinstance(segments, list) or not segments:
            raise EditorError("Choose the segments to change")
        if unknown := set(cues) - {"entry_marker", "exit_marker"}:
            raise EditorError(f"Not a cue point: {', '.join(sorted(unknown))}")
        segs, given = [self._segment_id(s) for s in segments], {k: self._cue_ms(v) for k, v in cues.items()}

        def apply(p):  # a segment whose Entry would come after its Exit stops the whole edit
            for seg in segs:
                o = {k: v for k, v in {**p.segment_overrides.get(seg, {}), **given}.items() if v is not None}
                self._put_cues(p, seg, self._cues_ok(o))
        return self._edit("segment", apply)

    def _segments_of(self, sid: int) -> frozenset:
        """The music segments that play a source (none without the game)."""
        if not self.catalog:
            return frozenset()
        if sid not in self._segments:
            cm = self.catalog.cm
            self._segments[sid] = frozenset(s["segment"] for c in cm.by_source.get(sid, []) for s in cm.cues[c]["segments"]
                                            if any(sl["source"] == sid for st in s["stems"] for sl in st["slots"]))
        return self._segments[sid]

    def same_cue_points(self, segment, source):
        """Gives the cue points of `segment` (none, where it has none) to every other segment that plays the file
        replacing `source`. Returns the project's state, with `segments`: how many changed."""
        self.require_game()
        seg, r, p = self._segment_id(segment), self._rep(source), self._need_project()
        if r.silence:
            raise EditorError("Silence has no cue points")
        sources = {self._target(x.target) for x in p.replacements if x.audio == r.audio and not x.silence}
        segs, changed = sorted(set().union(*(self._segments_of(sid) for sid in sources)) - {seg}), []

        def apply(proj):  # read under the edit's lock: a cue point typed just before is in
            o = dict(proj.segment_overrides.get(seg, {}))
            for s in segs:
                if proj.segment_overrides.get(s, {}) != o:
                    self._put_cues(proj, s, o)
                    changed.append(s)
        return {**self._edit("segment", apply), "segments": len(changed)}

    # --- the project's folder (projectfiles.py)
    def _history(self) -> list[dict]:
        """The open project and every step of its undo history, as to_json() dicts: what may still use a file."""
        return [self.project.to_json(), *(d for _, d in self.undo_stack), *(d for _, d in self.redo_stack)]

    def projects_folder(self) -> str:
        """Where new projects go: the folder the last one was made in, else Documents/Audiodiver/Projects (made when
        asked for, so the dialog can start in it)."""
        from .repatch import documents
        f = Path(load_settings().get("projects_folder") or documents() / "Audiodiver" / "Projects")
        try:
            f.mkdir(parents=True, exist_ok=True)
        except OSError:  # a drive that is gone
            f = documents()
        return str(f)

    # jobs that write no file beside a project: the rest can be halfway through writing one (an import decodes its
    # audio into audio/imported before its edit adds it to the project)
    READ_ONLY_JOBS = ("check", "combine_read")

    def _files_busy(self):
        """Refuses while a job that writes files beside a project runs."""
        if any(j.state == "running" and j.kind not in self.READ_ONLY_JOBS for j in self.jobs.values()):
            raise EditorError("Wait until the running job is done")

    def move_to_own_folder(self):
        """Gives the project a folder of its own, beside its file and named like it. The project file moves there,
        with what Audiodiver made for it (slices, imported and collected audio) and its builds in the default build
        folder. Files a person picked stay where they are, and the project points at them. A file another project in
        the old folder uses is copied there; the others are renamed into place (projectfiles.carry), so a move takes a
        moment whatever their size. The undo history moves with the project."""
        from . import projectfiles as pf
        from .arsenal import slug
        with self.lock:
            p = self._need_project()
            if pf.own_folder(p.path):
                raise EditorError("The project already has a folder to itself")
            self._files_busy()
            old_file, old = p.path, p.path.parent
            dest = pf.move_dest(old_file)
            plan = pf.move_plan(old_file, dest, self._history())
            if not p.build_folder:
                s = slug(p.name)
                plan |= {pf.norm(z): dest / "build" / z.name for z in (old / "build").glob(f"{s}-*.zip")
                         if z.stem[len(s) + 1:].isdigit()}
            done = []
            try:
                dest.mkdir(parents=True, exist_ok=True)  # a project with nothing to carry still gets its folder
                done = pf.carry(old_file, plan)
                moved = Project.from_json(pf.rebase(p.to_json(), old, dest, plan), dest / f"{dest.name}.audi")
                moved.save()
            except BaseException as e:
                if pf.put_back(done):  # (carry puts back what it did when it fails itself)
                    shutil.rmtree(dest, ignore_errors=True)  # made just now: nothing else is in it
                if isinstance(e, OSError):
                    raise EditorError(f"The project couldn't move: {os_error(e)}") from None
                raise
            self.project = moved
            self.undo_stack = [(label, pf.rebase(d, old, dest, plan)) for label, d in self.undo_stack]
            self.redo_stack = [(label, pf.rebase(d, old, dest, plan)) for label, d in self.redo_stack]
            self.revision += 1
            try:
                old_file.unlink()
            except OSError as e:
                log.warning("the old project file stays: %s", os_error(e))
            pf.prune(old)
            log.info("project moved from %s to %s: %d files moved, %d copied", old_file, moved.path,
                     sum(m for *_, m in done), sum(not m for *_, m in done))
            return self.project_state()

    def move_project(self, folder, check=False):
        """Moves the project's folder, with everything in it, into `folder` (made when it isn't there), under the
        name it has, or "<name> 2"... when that is taken there. Paths to files outside the project's folder are
        written again, so the project finds every file as before. A project without a folder of its own gets one
        first (move_to_own_folder). On one drive the folder is renamed; to another, it is copied and the old one
        taken away ({…project, old_left} says when some of it stayed). The undo history moves with the project.
        check: only {dest, copy}, where it would go and whether it is copied there."""
        from . import projectfiles as pf
        from .game import in_game_folder
        if not isinstance(folder, str) or not folder.strip() or not Path(folder).is_absolute():
            raise EditorError("Choose a folder to move the project to (a full path)")
        to = pf.norm(folder)
        with self.lock:
            p = self._need_project()
            self._files_busy()
            if self.ix and in_game_folder(to, self.ix.game.data):
                raise EditorError("That folder is inside the game folder, and Audiodiver never writes there")
            own = pf.own_folder(p.path)
            old = p.path.parent if own else pf.move_dest(p.path)  # the folder that moves
            if pf.key(to) == pf.key(old.parent):
                raise EditorError("The project is in that folder already")
            if pf.inside(to, old) is not None:
                raise EditorError("Choose a folder outside the project's folder")
            if to.exists() and not to.is_dir():
                raise EditorError("That is a file, not a folder")
            dest = pf.free(to / old.name)
            other_drive = os.path.splitdrive(old)[0].lower() != os.path.splitdrive(dest)[0].lower()
            if check:
                return {"dest": str(dest), "copy": other_drive}
            if not own:
                self.move_to_own_folder()
                p, old = self.project, self.project.path.parent
                dest = pf.free(to / old.name)
            made = not to.exists()

            def back():  # a failed move takes away the folder it made for the project
                if other_drive:
                    shutil.rmtree(dest, ignore_errors=True)
                if made:
                    try:
                        to.rmdir()
                    except OSError:
                        pass
            try:
                to.mkdir(parents=True, exist_ok=True)
                if other_drive:
                    shutil.copytree(old, dest)
                else:
                    os.replace(old, dest)
            except OSError as e:
                back()
                raise EditorError(f"The project couldn't move: {os_error(e)}") from None
            try:
                moved = Project.from_json(pf.rebase(p.to_json(), old, dest, whole=True), dest / p.path.name)
                moved.save()
            except BaseException as e:
                if not other_drive:
                    os.replace(dest, old)
                back()
                if isinstance(e, OSError):
                    raise EditorError(f"The project couldn't move: {os_error(e)}") from None
                raise
            self.project = moved
            self.undo_stack = [(label, pf.rebase(d, old, dest, whole=True)) for label, d in self.undo_stack]
            self.redo_stack = [(label, pf.rebase(d, old, dest, whole=True)) for label, d in self.redo_stack]
            self.revision += 1
            left = False
            if other_drive:
                shutil.rmtree(old, ignore_errors=True)
                left = old.exists()
            log.info("project moved from %s to %s%s", old, dest, " (some of the old folder stays)" if left else "")
            return {**self.project_state(), "old_left": left}

    def unused_files(self):
        """The files in Audiodiver's folders beside the project that nothing uses (projectfiles.unused):
        {folder, files: [{path, rel, bytes}], bytes}. rel is the path in the project's folder, as Windows writes it."""
        from . import projectfiles as pf
        with self.lock:
            p = self._need_project()
            self._files_busy()
            try:
                found = pf.unused(p.path, self._history())
            except pf.FilesError as e:
                raise EditorError(str(e)) from None
            folder = p.path.parent
        files = []
        for f in found:
            try:
                files.append({"path": str(f), "rel": str(pf.inside(f, folder) or f), "bytes": f.stat().st_size})
            except OSError:
                pass  # gone meanwhile
        return {"folder": str(folder), "files": files, "bytes": sum(f["bytes"] for f in files)}

    def remove_unused_files(self, paths):
        """Moves those of `paths` that nothing uses now to the Recycle Bin, then takes away Audiodiver's folders that
        are empty. {removed, left, bytes}."""
        from . import projectfiles as pf
        if not isinstance(paths, list):
            raise EditorError("Name the files to remove")
        with self.lock:
            p = self._need_project()
            self._files_busy()
            try:
                now = {pf.key(f): f for f in pf.unused(p.path, self._history())}
            except pf.FilesError as e:
                raise EditorError(str(e)) from None
            chosen = [now[k] for x in paths if isinstance(x, str) and (k := pf.key(x)) in now]
            sizes = {f: f.stat().st_size for f in chosen if f.exists()}
            left = pf.recycle(chosen)
            pf.prune(p.path.parent)
        log.info("unused files: %d to the Recycle Bin, %d left", len(chosen) - len(left), len(left))
        return {"removed": len(chosen) - len(left), "left": len(left),
                "bytes": sum(n for f, n in sizes.items() if f not in left)}

    def collect_files(self):
        """Copies the files the project uses from outside its folder into its audio/added folder and points the
        project at the copies. One step of Undo; the copies stay on disk. {…project, collected}."""
        from . import projectfiles as pf
        with self.lock:
            p = self._need_project()
            folder = p.path.parent
            plan = pf.collect_plan(folder, pf.uses(p.to_json(), folder))
            if not plan:
                return {**self.project_state(), "collected": 0}
            try:
                pf.copy(plan)
            except OSError as e:
                raise EditorError(f"The files couldn't be copied: {os_error(e)}") from None

            def apply(proj: Project):
                d = pf.rebase(proj.to_json(), folder, folder, plan)
                for r, now in zip(proj.replacements, d["replacements"]):
                    r.audio = now["audio"]
                proj.icon = d["icon"]
            return {**self._edit("collect", apply), "collected": len(plan)}

    def export_pack(self, dest):
        """Packs the project and the files it uses into dest (.audipack), as a job (projectfiles.pack)."""
        from . import projectfiles as pf
        p = self._need_project()
        if not given(dest) or not Path(dest).is_absolute():
            raise EditorError("Choose where to save the pack (a full path)")
        dest = Path(dest)
        if dest.suffix.lower() != pf.PACK:
            dest = dest.with_name(dest.name + pf.PACK)
        if not dest.parent.is_dir():
            raise EditorError(f"{dest.parent} is not a folder")
        with self.lock:
            d, folder, name = p.to_json(), p.path.parent, p.path.stem

        def run(job):
            got = pf.pack(d, folder, name, dest, job)
            job.say(f"{got['files']} files packed into {dest.name}"
                    + (f"; {got['missing']} the project uses weren't found" if got["missing"] else ""))
            return {"pack": str(dest), "mb": round(got["bytes"] / 1e6, 1), **got}
        return self._start("pack", run, p.name)

    def open_pack(self, path, folder=None):
        """Unpacks a .audipack into a folder of its own in `folder` (by default, where new projects go), as a job. Its
        result names the project file, and the window opens it."""
        from . import projectfiles as pf
        if not given(path) or not Path(path).is_file():
            raise EditorError(f"{path} wasn't found")
        src = Path(path)
        into = Path(folder) if given(folder) else Path(self.projects_folder())
        if not into.is_absolute():
            raise EditorError("Choose where to unpack it (a full path)")

        def run(job):
            try:
                audi = pf.unpack(src, into, job)
            except pf.FilesError as e:
                raise EditorError(str(e)) from None
            job.say(f"unpacked into {audi.parent}")
            return {"project": str(audi), "folder": str(audi.parent)}
        return self._start("unpack", run, src.stem)

    # --- jobs
    def _start(self, kind, fn, title="") -> dict:
        job = Job(kind, title)
        self.jobs[job.id] = job
        log.info("job %s %s started: %s", job.id, kind, title)

        def run():
            try:
                job.result = fn(job)
                job.state = "done"
                log.info("job %s done in %.1fs: %s", job.id, time.time() - job.started, job.result)
            except Cancelled:
                job.error, job.state = "cancelled", "cancelled"
                log.info("job %s cancelled after %.1fs", job.id, time.time() - job.started)
            except Exception as e:
                job.error, job.state = plain(e), "failed"
                job.say(f"failed: {job.error}")  # the traceback is in the log file, not on the Build tab
                log.exception("job %s (%s: %s) failed", job.id, kind, title)
            job.ended = time.time()
            if self.ix and not any(j.state == "running" for j in self.jobs.values()):
                self.ix.game.trim_caches()  # the streams a job read, and packages the Library opened
        threading.Thread(target=run, daemon=True).start()
        return job.to_json()

    def cancel_job(self, job_id):
        """Asks a running job to stop; it does at its next step."""
        if job_id not in self.jobs:
            raise EditorError(f"No job {job_id}")
        self.jobs[job_id].cancel_requested = True
        return self.jobs[job_id].to_json()

    def job(self, job_id):
        if job_id not in self.jobs:
            raise EditorError(f"No job {job_id}")
        return self.jobs[job_id].to_json()

    def build(self, bump=True):
        from .build import BuildError, build
        self.require_game()
        p = self._need_project()

        def run(job):
            with self.lock:
                snapshot = Project.load(p.path) if p.path.exists() else p
                made_from = build_inputs(snapshot)

            def progress(doing, done=None, total=None):  # and a cancel stops the build here
                if total:
                    job.total = total
                job.step(doing, done)
            try:
                zip_path = build(snapshot, self.ix, log=job.say, step=progress, listed=self._listed_banks(snapshot))
            except BuildError as e:
                raise EditorError(str(e)) from None
            result = {"zip": str(zip_path), "folder": str(zip_path.parent), "version": snapshot.version,
                      "mb": round(zip_path.stat().st_size / 1e6, 1)}
            self._bump_version(snapshot.path, snapshot.version + 1 if bump else 0, self.ix.game.version, made_from)
            return result
        with self.build_lock:  # two builds sent together both started, and wrote one .partial ZIP
            if any(j.kind == "build" and j.state == "running" for j in self.jobs.values()):
                raise EditorError("A build is already running")
            if not p.replacements and not p.texts and not p.soundtrack:
                raise EditorError("Nothing to build yet. Replace some audio, set a piece in the Soundtrack or change a line of text first.")
            if problems := self.project_state()["problems"]:
                raise EditorError(f"Fix the problems on the Build tab first: {problems[0]}"
                                  + (f" (and {len(problems) - 1} more)" if len(problems) > 1 else ""))
            return self._start("build", run)

    def _bump_version(self, path, version, built_for="", built_from=""):
        """After a build, its project goes on to the next version (0: stays) and notes the game version it was made
        on and what it was made from: the project that was built, even if another is open by now (or none). Not an
        edit: undo and redo keep it (version_floor, built_for, built_from), so the next build never overwrites the
        ZIP just made."""
        with self.lock:
            p = self.project if self.project and self.project.path == path else None
            if p is None:
                try:
                    p = Project.load(path)
                except (OSError, ValueError, KeyError):
                    return  # moved or deleted meanwhile: nothing to move on
            self.version_floor[p.guid] = max(version, self.version_floor.get(p.guid, 0))
            if built_for:
                self.built_for[p.guid] = built_for
            if built_from:
                self.built_from[p.guid] = built_from
            if p.version < version or (built_for and p.built_for != built_for) or (built_from and p.built_from != built_from):
                p.version = max(p.version, version)
                p.built_for = built_for or p.built_for
                p.built_from = built_from or p.built_from
                p.save()
                self.revision += 1

    def import_patch(self, patch_path, mode="add"):
        """Turns an existing .patch_0 (any mod, old tool or Audiodiver) into assignments: every replaced source's
        audio is decoded to <project>/imported/<source>.wav. mode "add": it joins what the project has (where both
        have audio for a slot, the patch's goes in); "replace": the project's audio goes first (its new audio,
        additions, cue points, settings and list; its text edits stay). One edit either way, so Undo takes it back."""
        self.require_game()
        p = self._need_project()
        if mode not in ("add", "replace"):
            raise EditorError("An import adds to the project or replaces the audio in it")
        if not given(patch_path):
            raise EditorError("Choose a mod's .patch_0 file")
        patch_path = Path(patch_path)
        if not patch_path.is_file():
            raise EditorError(f"{patch_path} wasn't found")
        if not re.search(r"\.patch_\d+$", patch_path.name, re.I):
            raise EditorError(f"{patch_path.name} isn't a patch file. Choose a .patch_0 file. Audiodiver also reads the .stream file "
                              f"next to it.")

        def run(job):
            # a folder per patch: two mods' patches of one archive have the same name, so the name of the folder
            # carries what is in them too (the same mod imported twice uses the same folder)
            out_dir = p.path.parent / "audio" / "imported" / f"{patch_path.stem.split('.')[0]}-{_digest(patch_path)}"
            got, replaced, files, skipped = self._patch_audio(patch_path, out_dir, job)
            if not self.project or self.project.path != p.path:
                raise EditorError("Another project was opened during the import. Open this project again and import again.")
            counts = {"added": 0}

            def apply(proj):  # what the patch replaces joins the project's list (_cover), so the Editor shows it
                if mode == "replace":  # the files stay on disk
                    proj.replacements, proj.additions, proj.settings, proj.segment_overrides = [], [], {}, {}
                    proj.library, proj.imported_banks = [], []
                counts["added"] = self._fill_from_patch(proj, got, replaced, files)
            self._edit("import", apply)
            return {"imported": sum(s in files for s in replaced), "added": counts["added"], "skipped": skipped,
                    "settings": len(got.settings), "left": got.left, "stale": len(got.stale), "older": len(got.older),
                    "folder": str(out_dir)}
        return self._start("import", run)

    def _patch_audio(self, patch_path: Path, out_dir: Path, job, reuse=False):
        """What a mod's patch replaces, adds and sets (addition.from_patch), its audio decoded into out_dir as WAVs, each
        keeping the patch's own encoding for builds (build.keep_encoding). Returns (got, replaced, files, skipped):
        replaced {the game's source: wem}, files {source or new clip: wav}, skipped: how many couldn't be decoded.
        reuse: out_dir is this patch's alone (Combine's cache), and the WAVs a finished reading left there (it writes
        `.done`) are used again, not decoded again."""
        import struct
        from .addition import cue_points, from_patch, same_audio
        from .build import keep_encoding
        from .patch import diff
        job.say(f"reading {patch_path.name}")
        try:
            d = diff(str(patch_path), self.ix)
            got = from_patch(self.ix, d)  # what it adds (Unwise's new takes, layers, rewired sounds) and replaces
        except (AssertionError, struct.error, ValueError, KeyError, IndexError):
            raise EditorError(f"{patch_path.name} can't be read as a game patch") from None
        def named(m):  # a bank as the Library names it
            return f'{m[1]} the bank "{self.lib.bank_label(int(m[2]))}"' if self.lib and int(m[2]) in self.ix.banks else m[0]
        got.left = [re.sub(r"\b(in|of) bank (\d+)", named, line) for line in got.left]
        replaced = {}  # the game's source id -> wem bytes
        for fid, data in d["streams"].items():
            try:
                sid = self.ix.resolve(fid)
            except KeyError:
                job.say(f"stream {fid} is not in this game version; skipped")
                continue
            try:
                if same_audio(data, self.ix.wem(sid)):  # the game's clip in an older file: not the mod's audio
                    got.older.add(sid)
                    continue
            except KeyError:
                pass
            replaced[sid] = data
        for sid, data in got.replaced.items():
            replaced.setdefault(sid, data)
        got.cues = cue_points(d, replaced)
        new = {src: data for *_, src, data in got.takes} | {src: data for _, src, data in got.own}
        for line in got.left:
            job.say(f"left out: {line}")
        if got.stale:
            job.say(f"{len(got.stale)} sounds of an older game version, which the game no longer has, left out")
        if got.older:
            job.say(f"{len(got.older)} objects as an older game version had them; the current ones are used")
        if got.merged:
            job.say(f"{len(got.merged)} objects copied from another bank by the tool that made the mod; each bank's "
                    f"own are used")
        found = {**new, **replaced}
        if not found and got.settings:
            return got, replaced, {}, 0  # only settings
        if not found:
            raise EditorError(f"{patch_path.name} replaces, adds or sets nothing"
                              + (f" Audiodiver can bring in ({got.left[0]})" if got.left else ""))
        out_dir.mkdir(parents=True, exist_ok=True)
        files, job.total = {}, len(found)
        decoded = reuse and (out_dir / ".done").is_file()
        for i, (sid, data) in enumerate(sorted(found.items()), 1):
            wem_path, wav = out_dir / f"{sid}.wem", out_dir / f"{sid}.wav"
            if decoded and wav.is_file():
                keep_encoding(wav, data)
                files[sid] = wav
                job.step(f"Decoding {i} of {len(found)}", i)
                continue
            wem_path.write_bytes(data)
            try:
                subprocess.run([wem.VGMSTREAM, "-o", str(wav), str(wem_path)], check=True, capture_output=True)
                keep_encoding(wav, data)
                files[sid] = wav
            except subprocess.CalledProcessError:
                job.say(f"source {sid}: can't decode the audio; skipped")
            finally:
                wem_path.unlink(missing_ok=True)
            job.step(f"Decoding {i} of {len(found)}", i)
        if not files:
            what = "The sound" if len(found) == 1 else f"None of the {len(found)} sounds"
            could = "couldn't" if len(found) == 1 else "could"
            raise EditorError(f"{what} in {patch_path.name} {could} be decoded. "
                              + (f"The folder {out_dir} has too long a path for the decoder. Choose a shorter one."
                                 if len(str(out_dir)) > 230 else "Is the .stream file next to the patch?"))
        if reuse:
            (out_dir / ".done").write_text("")
        return got, replaced, files, len(found) - len(files)

    def _fill_from_patch(self, p: Project, got, replaced: dict, files: dict) -> int:
        """Puts a patch's audio (_patch_audio) into a project: what it replaces, then what it adds, its settings on
        the game's objects and its cue points (a later import's go over an earlier one's). Returns how many slots it
        added or changed."""
        for sid, wav in files.items():
            if sid in replaced:
                self._set(p, sid, str(wav), label=f"imported {sid}")
        for seg, (cues, clips) in got.cues.items():  # a segment the patch gives new audio takes its cue points too
            if clips & files.keys():
                self._put_cues(p, seg, cues)
        for oid, changes in got.settings.items():
            p.settings[oid] = {**p.settings.get(oid, {}), **changes}
        p.imported_banks = sorted(set(p.imported_banks) | got.banks)  # where its sounds go (build.reach)
        return self._take_in(p, got, files)

    # --- repatching (repatch.py): an existing mod rebuilt on the game as it is now
    @staticmethod
    def _repatch_root() -> Path:
        """Where repatched mods go: the folder last chosen, else Documents/Audiodiver/Repatched."""
        from .repatch import documents
        return Path(load_settings().get("repatch_folder") or documents() / "Audiodiver" / "Repatched")

    def repatch_scan(self, path):
        """What repatching `path` (a .patch_N, a folder or a mod's ZIP) would take: its patches, and the name, icon
        and mod id a manifest gives."""
        from .repatch import RepatchError, scan
        try:
            f = scan(path)
        except RepatchError as e:
            raise EditorError(str(e)) from None
        except OSError as e:
            raise EditorError(f"Can't read {Path(str(path)).name}: {os_error(e)}") from None

        def patch(p):  # audio: whether repatching changes it (one without stays as it is); others go in as they were
            kinds = [self._kinds(f, key) for key in p.keys]
            return {"key": p.key, "label": p.label, "files": len(p.keys), "audio": any(k[0] for k in kinds),
                    "others": self._file_lines(sum(k[1] for k in kinds), sum(k[2] for k in kinds))}
        return {"source": str(f.source), "name": f.name or "Repatched mod", "description": f.description,
                "guid": bool(f.guid), "icon": bool(f.icon), "manifest": bool(f.manifest), "zip": f.is_zip,
                "folder": str(self._repatch_root()), "patches": [patch(p) for p in f.patches]}

    def check_mods(self):
        """The installed mods (the game's data folder and the mod managers' libraries) checked for sound banks of an older
        game version (installed.check), as a job: its result lists each mod with sound banks, worst first."""
        from .installed import check
        self.require_game()
        if any(j.kind == "check" and j.state == "running" for j in self.jobs.values()):
            raise EditorError("The installed mods are being checked already")

        def run(job):
            def progress(doing, done, total):
                job.total = total
                job.step(doing, done)
            return check(self.ix, self.ix.game.data, step=progress)
        return self._start("check", run, title="installed mods")

    @staticmethod
    def _kinds(found, key) -> tuple[bool, int, int]:
        """(holds audio, string tables, other files) of a mod's patch. One that can't be read counts as audio: kept
        as it was, it may be a mod's old sound banks, where a patch of models or textures alone is fine as it is."""
        from .game import WWISE_BANK, WWISE_DEP, WWISE_STREAM, toc_entries
        from .strings import STRINGS
        try:
            types = [tid for _, tid, *_ in toc_entries(found.read(key) or b"")]
        except Exception:  # noqa: BLE001 (a patch that can't be read says so when it is repatched)
            return True, 0, 0
        audio = (WWISE_BANK, WWISE_DEP, WWISE_STREAM)
        return (any(t in audio for t in types), sum(t == STRINGS for t in types),
                sum(t not in (*audio, STRINGS) for t in types))

    @staticmethod
    def _not_audio_counts(found, key) -> tuple[int, int]:
        """(string tables, other files) in a mod's patch: what it holds besides audio."""
        return Session._kinds(found, key)[1:]

    @staticmethod
    def _file_lines(texts: int, rest: int) -> list[str]:
        """What a mod holds besides its audio, which a repatch or a combine carries as it was ("2 string tables")."""
        return ([f"{texts} string table{'s' if texts != 1 else ''}"] if texts else []) + \
               ([f"{rest} other file{'s' if rest != 1 else ''}, such as models or textures"] if rest else [])

    @staticmethod
    def _carried_lines(carried) -> list[str]:
        """_file_lines of carried files (patch.Carried; one of an id counts once)."""
        from .strings import STRINGS
        kinds = {(c.tid, c.fid) for c in carried}
        texts = sum(t == STRINGS for t, _ in kinds)
        return Session._file_lines(texts, len(kinds) - texts)

    @staticmethod
    def _carried(paths) -> list:
        """The files besides audio of these patches on disk (patch.carried_of), in order: of two with one id, the
        later patch's goes in."""
        from .patch import carried_of
        out = []
        for path in paths:
            try:
                out += carried_of(str(path))
            except (ValueError, OSError, struct.error) as e:
                raise EditorError(f"The files besides audio can't be read: {e}") from None
        return out

    def repatch(self, path, name="", folder="", every_bank=False, remember=True):
        """Rebuilds a mod on the game as it is now, as the one mod it was. Each of its patches is imported into a
        project of its own (in a temp folder, gone after) and made again on the current game's banks; the new ZIP,
        the only thing left in the repatch folder, is the mod as it was, with a manifest's options, files and id kept
        (repatch.repackage), those patches in place of the old ones. Without a manifest it is a mod manager ZIP,
        one option per patch. A patch that can't be repatched stays as it was in a mod of several, and the result
        says so. every_bank: the mod's sounds go into every bank that has them, not only the banks the mod patched
        (build.reach). remember: a folder given becomes the one Repatch starts on (the command line leaves it)."""
        import tempfile
        from .arsenal import default_icon, name_problem, package
        from .build import PATCH, BuildError, make_patch
        from .game import in_game_folder
        from .repatch import RepatchError, clean_name, repackage, scan
        self.require_game()
        try:
            f = scan(path)
        except RepatchError as e:
            raise EditorError(str(e)) from None
        name = str(name or "").strip() or f.name or "Repatched mod"
        if problem := name_problem(name):
            raise EditorError(problem)
        root = Path(folder) if given(folder) else self._repatch_root()
        if not root.is_absolute():
            raise EditorError("Choose where repatched mods go (a full path)")
        if in_game_folder(root, self.ix.game.data):
            raise EditorError(f"{root} is inside the game folder, and Audiodiver never writes there")
        if any(j.kind in ("build", "repatch") and j.state == "running" for j in self.jobs.values()):
            raise EditorError("A build is already running")
        if given(folder) and remember:
            save_settings(repatch_folder=str(root))
        if not isinstance(every_bank, bool):
            raise EditorError("Every bank is on or off")
        several = len(f.patches) > 1

        def one(job, pt, scratch: Path) -> dict:
            """A patch imported into a project in scratch and made again into scratch/out (with the patches loaded
            over it, pt.also, imported after it: one part of the mod, one patch)."""
            home = scratch / "project"
            home.mkdir(parents=True)
            p = Project(name=name, path=home / "repatch.audi", library=[], every_bank=every_bank)
            placed = [f.place(key, scratch / "in" / str(k)) for k, key in enumerate(pt.keys)]
            reads = [self._patch_audio(at, home / "audio" / "imported", job) for at in placed]
            carried = self._carried(placed)
            with self.lock:
                added = sum(self._fill_from_patch(p, got, replaced, files) for got, replaced, files, _ in reads)
                self._tidy(p)
                self._tidy_cues(p)
                self._cover(p)

            def progress(doing, done=None, total=None):
                if total:
                    job.total = total
                job.step(doing, done)
            (scratch / "out").mkdir(parents=True)
            try:
                make_patch(p, self.ix, scratch / "out", log=job.say, step=progress, listed=self._listed_banks(p),
                           carried=carried)
            except BuildError as e:
                raise EditorError(str(e)) from None
            return {"label": pt.label,
                    "imported": len({s for _, replaced, files, _ in reads for s in replaced if s in files}),
                    "added": added, "skipped": sum(r[3] for r in reads), "settings": len(p.settings),
                    "left": [x for got, *_ in reads for x in got.left],
                    "stale": len(set().union(*(got.stale for got, *_ in reads))),
                    "older": len(set().union(*(got.older for got, *_ in reads))),
                    "others": self._carried_lines(carried), "kept": "", "audio": True,
                    "patch": str(scratch / "out" / PATCH)}

        def run(job):
            try:
                root.mkdir(parents=True, exist_ok=True)
            except OSError as e:
                raise EditorError(f"Can't make the folder {root}: {os_error(e)}") from None
            n = 1
            while (zip_path := root / (f"{name}.zip" if n == 1 else f"{name} {n}.zip")).exists():
                n += 1
            partial = zip_path.with_name(f".{zip_path.name}.partial")  # the ZIP shows up whole or not at all
            with tempfile.TemporaryDirectory(prefix="audiodiver-repatch-", ignore_cleanup_errors=True) as tmp:
                parts = []
                for i, pt in enumerate(f.patches):
                    if several:
                        job.say(f"--- {pt.label or pt.key} ({i + 1} of {len(f.patches)})")
                    try:
                        parts.append(one(job, pt, Path(tmp) / str(i)))
                    except EditorError as e:
                        if not several:
                            raise
                        job.say(f"kept as it was: {e}")
                        parts.append({"label": pt.label or pt.key, "kept": str(e), "others": [], "left": [],
                                      "audio": any(self._kinds(f, key)[0] for key in pt.keys)})
                if not any(x["audio"] for x in parts):
                    raise EditorError("The mod has no audio to repatch")
                if all(x["kept"] for x in parts):
                    raise EditorError(parts[0]["kept"])
                job.step("Packing the ZIP")
                try:
                    made = [(pt, x) for pt, x in zip(f.patches, parts) if not x["kept"]]
                    if f.manifest:  # a part's patches built into its first one's place
                        repackage(f, partial, {pt.key: Path(x["patch"]) for pt, x in made}, name,
                                  gone=[key for pt, _ in made for key in pt.also])
                    else:  # no manifest: an Arsenal ZIP, each part an option of its own
                        icon = Path(tmp) / "icon.png"
                        icon.write_bytes(default_icon())
                        options = []
                        for i, (pt, x) in enumerate(zip(f.patches, parts)):
                            label = clean_name(pt.label.replace("/", " ")) or name
                            if not x["kept"]:
                                options.append({"name": label, "description": "", "folder": Path(x["patch"]).parent})
                                continue
                            for k, key in enumerate(pt.keys):  # as it was, each patch an option
                                src = Path(tmp) / str(i) / "kept" / str(k)
                                f.place(key, src)
                                for kept in src.iterdir():
                                    kept.rename(src / (PATCH + kept.name[len(Path(key).name):]))
                                options.append({"name": f"{label} {k + 1}" if pt.also else label,
                                                "description": "", "folder": src})
                        package(partial, name=name, guid=str(uuid.uuid4()), icon=icon, options=options)
                    os.replace(partial, zip_path)
                except OSError as e:
                    raise EditorError(f"Can't write the ZIP into {root}: {os_error(e)}") from None
                finally:
                    partial.unlink(missing_ok=True)
            for x in parts:
                x.pop("patch", None)
            job.say(f"{zip_path} ({zip_path.stat().st_size / 1e6:.1f} MB)")
            return {"name": name, "zip": str(zip_path), "mb": round(zip_path.stat().st_size / 1e6, 1),
                    "kept_id": bool(f.manifest and f.guid), "manifest": bool(f.manifest), "parts": parts}
        return self._start("repatch", run, title=name)

    # --- combining mods (combine.py): several mods in one, built on the game as it is now
    COMBINE_KEPT = 64  # patches read for Combine kept in memory (combine.Part: no audio, the WAVs are on disk)

    @staticmethod
    def _combine_root() -> Path:
        """Where combined mods go: the folder last chosen, else Documents/Audiodiver/Combined."""
        from .repatch import documents
        return Path(load_settings().get("combine_folder") or documents() / "Audiodiver" / "Combined")

    def combine_folder(self) -> str:
        """Where combined mods go (made when asked for, so the dialog can start in it)."""
        from .repatch import documents
        f = self._combine_root()
        try:
            f.mkdir(parents=True, exist_ok=True)
        except OSError:  # a drive that is gone
            f = documents()
        return str(f)

    @staticmethod
    def _scan(path):
        from .repatch import RepatchError, scan
        try:
            return scan(path)
        except RepatchError as e:
            raise EditorError(str(e)) from None
        except OSError as e:
            raise EditorError(f"Can't read {Path(str(path)).name}: {os_error(e)}") from None

    @staticmethod
    def _manager_recorded(source: Path, opts) -> list[str] | None:
        """What a mod manager's library records as chosen for the mod at source, as picks; None for a mod that isn't
        in a library, or an entry nothing can be read from (combine.recorded_picks)."""
        from . import combine as cb
        from . import projectfiles as pf
        from .installed import manager_entries
        if not opts:
            return None
        for name, folder, entry in manager_entries():
            if pf.key(folder) == pf.key(source):
                picks = cb.recorded_picks(entry, opts)
                log.info("combine: the library's entry for %s has the keys %s; the recorded choice was %s", name,
                         sorted(map(str, entry)), "read" if picks is not None else "not found")
                return picks
        return None

    def combine_scan(self, path):
        """A mod to combine (a .patch_N, a folder or a mod's ZIP): {source, name, description, manifest, others
        (what it holds besides audio, which goes in as it was), options (a manifest's: [{id, name, sub: [{id, name}]}]),
        picks (the choice it starts with: the mod manager's, else every Option on with its first SubOption)}."""
        from . import combine as cb
        f = self._scan(path)
        opts = cb.options(f.manifest)
        counts = [self._not_audio_counts(f, k) for p in f.patches for k in p.keys]
        texts, rest = sum(c[0] for c in counts), sum(c[1] for c in counts)
        return {"source": str(f.source), "name": f.name or "Mod", "description": f.description,
                "manifest": bool(f.manifest), "others": self._file_lines(texts, rest),
                "options": cb.shown(opts), "picks": cb.default_picks(opts, self._manager_recorded(f.source, opts))}

    def combine_installed(self):
        """The mods in the mod managers' libraries, to combine: {mods: [{name, source, deployed}], library: whether
        one was found}. deployed: one of the mod's patches is in the game's data folder (the same file)."""
        from .installed import deployed, manager_entries, same_file
        from .repatch import PATCH_RE
        data = self.ix.game.data if self.ix else Path(self.game_where["path"]) if self.game_where.get("path") else None
        sizes = {}
        try:
            for f in deployed(data) if data else []:
                sizes.setdefault(f.stat().st_size, []).append(f)
        except OSError:
            sizes = {}
        entries, mods = manager_entries(), []
        for name, folder, _ in entries:
            on = False
            for f in folder.rglob("*") if sizes else []:
                try:
                    if PATCH_RE.search(f.name) and f.is_file() and \
                            any(same_file(f, q) for q in sizes.get(f.stat().st_size, ())):
                        on = True
                        break
                except OSError:
                    continue
            mods.append({"name": name, "source": str(folder), "deployed": on})
        return {"mods": mods, "library": bool(entries)}

    @staticmethod
    def _combine_list(mods) -> list[tuple[str, list[str] | None]]:
        """The mods to combine as the window sends them ([{source, picks}]), checked: [(source, picks or None)]."""
        if not isinstance(mods, list) or not mods:
            raise EditorError("Choose the mods to combine")
        out = []
        for m in mods:
            if not isinstance(m, dict) or not given(m.get("source")):
                raise EditorError("Each mod to combine is a patch file, a folder or a ZIP")
            picks = m.get("picks")
            if picks is not None and (not isinstance(picks, list) or not all(isinstance(x, str) for x in picks)):
                raise EditorError("A mod's options are a list of their ids")
            out.append((str(m["source"]), picks))
        return out

    def _combine_part(self, job, f, key: str, scratch: Path):
        """One patch of a mod, read for Combine: (its digest, combine.Part). A patch is kept by its digest, and known
        by where it is and its time, so a mod read once is read again only after the game changed or its WAVs were
        cleared from the cache."""
        from . import combine as cb
        try:
            if f.is_zip:
                st, path = f.source.stat(), None
                stamp = (str(f.source), st.st_mtime_ns, st.st_size, key)
            else:
                path = f.place(key, scratch)
                stream = path.with_name(path.name + ".stream")
                stamp = (str(path), path.stat().st_mtime_ns, path.stat().st_size,
                         *((stream.stat().st_mtime_ns, stream.stat().st_size) if stream.is_file() else ()))
            version = self.ix.game.version
            digest = self._combine_ids.get(stamp)
            if digest is None:
                path = path or f.place(key, scratch / uuid.uuid4().hex[:8])
                digest = self._combine_ids[stamp] = _digest(path)
        except OSError as e:
            raise EditorError(f"Can't read {f.name}: {os_error(e)}") from None
        out_dir = CACHE_DIR / "combine" / digest
        kept = self._combine_parts.get(digest)
        if kept and kept[0] == version and (not kept[1].files or (out_dir / ".done").is_file()):
            self._combine_parts.move_to_end(digest)
            return digest, kept[1]
        if path is None:
            path = f.place(key, scratch / uuid.uuid4().hex[:8])
        try:
            part = cb.part_of(*self._patch_audio(path, out_dir, job, reuse=True))
        except EditorError as e:  # nothing it can bring in, or no game patch at all: said with the mod
            part = cb.Part(error=str(e))
        part.texts, part.rest = self._not_audio_counts(f, key)
        self._combine_parts[digest] = (version, part)
        while len(self._combine_parts) > self.COMBINE_KEPT:
            self._combine_parts.popitem(last=False)
        return digest, part

    def _combine_gather(self, job, mods) -> list[dict]:
        """Each mod to combine read (what was read before is used again): [{source, name, chosen (its options by
        name), parts: [(key, digest, combine.Part)], left, sounds}]."""
        import tempfile
        from . import combine as cb
        out = []
        with tempfile.TemporaryDirectory(prefix="audiodiver-combine-", ignore_cleanup_errors=True) as tmp:
            for n, (source, picks) in enumerate(mods):
                f = self._scan(source)
                opts = cb.options(f.manifest)
                if picks is None:
                    picks = cb.default_picks(opts, self._manager_recorded(f.source, opts))
                name = f.name or Path(source).stem
                job.say(f"--- {name} ({n + 1} of {len(mods)})")
                parts = []
                for key in cb.parts(f, opts, picks):
                    job.step(f"Reading {name}")
                    parts.append((key, *self._combine_part(job, f, key, Path(tmp))))
                pts = [pt for *_, pt in parts]
                left = list(dict.fromkeys(x for pt in pts for x in pt.left))
                left += [pt.error for pt in pts if pt.error and not (pt.texts or pt.rest)]  # those go in as they were
                if not parts:
                    left.append("No patch is in the chosen options")
                sounds = set().union(*(set(pt.replaced) | {t[2] for t in pt.takes if t[2] in pt.files}
                                       | {o[1] for o in pt.own if o[1] in pt.files} for pt in pts))
                out.append({"source": str(f.source), "name": name, "chosen": cb.labels(opts, picks), "parts": parts,
                            "left": left, "sounds": len(sounds)})
        return out

    def _plays(self, oids) -> dict[int, list[int]]:
        """{object: the clips it plays} as the first bank with a copy of it has it: a Sound's clip, a music track's,
        and the clips of the Sounds below a container. Each bank is read once."""
        from . import bank as wbank
        from .addition import CONTAINERS, is_audio, parent_of
        by_bank = {}
        for oid in oids:
            if banks := self.ix.copies(oid):
                by_bank.setdefault(banks[0], []).append(oid)
        out = {}
        for bid, here in by_bank.items():
            parent, clips = {}, {}
            for oid, (t, body) in wbank.parse(self.ix.bank_files(bid)[0])[1].items():
                try:
                    if t == wbank.SOUND and is_audio(body):
                        clips[oid], parent[oid] = [wbank.SOURCE.unpack_from(body, 0)[2]], parent_of(t, body)
                    elif t == wbank.MUSIC_TRACK:
                        clips[oid] = wbank.source_ids(t, body)
                    elif t in CONTAINERS:
                        parent[oid] = parent_of(t, body)
                except Exception:  # noqa: BLE001 (an object this reading doesn't know: it plays nothing here)
                    continue
            for oid in here:
                if oid in clips:
                    out[oid] = clips[oid]
                    continue
                below = []
                for o, c in clips.items():
                    cur, seen = parent.get(o), set()
                    while cur and cur not in seen:
                        if cur == oid:
                            below += c
                            break
                        seen.add(cur)
                        cur = parent.get(cur)
                out[oid] = below
        return out

    def _slot_label(self, sid: int, views: dict, of: int | None = None) -> str:
        """A sound as the Library shows its slot: the music and its segment, or the sound and take in its bank. of: an
        object that plays it (a setting's), named by the slot only when it is the Sound the slot names, else by the
        group (a container: the sound whose takes it holds)."""
        for place in self.lib.places(sid):
            cue = place["cue"]
            if cue not in views:
                try:
                    views[cue] = self.catalog.cue(int(cue)) if cue.isdigit() else self.lib.view(cue)
                except (KeyError, ValueError):
                    views[cue] = None
            v = views[cue]
            for g in (v or {}).get("segments_detail", []):
                for st in g["stems"]:
                    if any(sl["source"] == str(sid) for sl in st["slots"]):
                        sl = next(sl for sl in st["slots"] if sl["source"] == str(sid))
                        take = (sl.get("label") or "") if of is None or sl.get("object") == str(of) else ""
                        bits = [v["name"] if cue.isdigit() else "", g["name"], take]
                        return " · ".join(dict.fromkeys(b for b in bits if b))
        return f"Sound {sid}"

    def _combine_clashes(self, read):
        """(the mods' effects, their clashes, {object: the clash its settings go with}) of what _combine_gather read."""
        from . import combine as cb
        effects = [cb.effect([pt for *_, pt in m["parts"]]) for m in read]
        found, follows = cb.clashes(effects, self._plays)
        return effects, found, follows

    def _combine_result(self, read, effects, found) -> dict:
        """combine_read's answer: the mods, and the clashes grouped by the Index item they belong to."""
        from . import combine as cb
        from .audio import duration_ms
        views, groups = {}, {}
        sounds = self._plays({c["key"] for c in found if c["kind"] == "clip"})  # a Sound -> its clip
        objects = self._plays({c["key"][0] for c in found if c["kind"] == "setting"})
        for c in found:
            kind, key = c["kind"], c["key"]
            src = key if kind == "sound" else next(iter((sounds if kind == "clip" else objects).get(
                key if kind == "clip" else key[0], [])), None)
            label = self._slot_label(src, views, key[0] if kind == "setting" else None) if src is not None else \
                f"Object {key[0] if kind == 'setting' else key}"
            versions = []
            for m in c["mods"]:
                e, parts = effects[m], read[m]["parts"]
                if kind == "setting":
                    versions.append({"mod": m, "value": round(e.settings[key[0]][key[1]][1], 4)})
                    continue
                n, clip = (e.replaced[key][0], key) if kind == "sound" else e.own[key][:2]
                wav = parts[n][2].files[clip]
                versions.append({"mod": m, "audio": str(wav), "ms": duration_ms(wav)})
            item = (self.lib.home(src) or "") if src is not None else ""
            groups.setdefault(item, []).append({
                "id": c["id"], "kind": kind, "label": label + (f" · {cb.prop_name(key[1])}" if kind == "setting" else ""),
                **({"source": str(src)} if src is not None else {}), "versions": versions, "winner": c["mods"][-1]})
        order, kinds = self.lib.order, {"sound": 0, "clip": 1, "setting": 2}

        def item_name(i):
            try:
                return self._list_name(i) if i else "Other Sounds"
            except KeyError:
                return i
        return {"mods": [{"source": m["source"], "name": m["name"], "left": m["left"], "sounds": m["sounds"]}
                         for m in read],
                "groups": [{"item": i, "name": item_name(i),
                            "clashes": sorted(groups[i], key=lambda x: (kinds[x["kind"]], x["label"]))}
                           for i in sorted(groups, key=lambda i: (i == "", i not in order, order.get(i, 0), i))]}

    def _combine_busy(self, kinds, what):
        if any(j.kind in kinds and j.state == "running" for j in self.jobs.values()):
            raise EditorError(what)

    def combine_read(self, mods):
        """Reads the mods to combine ([{source, picks}], in order: a later one wins where two differ), as a job: what
        each leaves out and the clashes between them (combine.clashes), grouped by the Index item they belong to,
        each with every mod's version and the one that wins by default. Each patch's audio is decoded into the cache
        (CACHE_DIR/combine/<digest>) and what was read is kept, so another order or other winners read nothing
        again."""
        self.require_game()
        mods = self._combine_list(mods)
        self._combine_busy(("combine", "combine_read"), "The mods are being read or combined already")

        def run(job):
            read = self._combine_gather(job, mods)
            job.step("Comparing the mods")
            effects, found, _ = self._combine_clashes(read)
            job.say(f"{len(found)} clash{'es' if len(found) != 1 else ''}")
            return self._combine_result(read, effects, found)
        return self._start("combine_read", run, title=f"{len(mods)} mods")

    def combine(self, mods, winners=None, name="", folder="", every_bank=False, remember=True):
        """Combines the mods ([{source, picks}], in order) into one, as a job: a project in a temp folder (gone after),
        with a new id, Audiodiver's icon and a description that lists the mods and their options, built into an HD2
        Arsenal ZIP, the only thing left in the combine folder (`<name>.zip`, `<name> 2.zip` beside an earlier one).
        winners: {clash id: the mod that wins it}; a clash not named goes to the last mod with a version. Takes and
        layers of every mod go in, and their files besides audio as they were (of two with one id, the later mod's).
        every_bank: the sounds go into every bank that has them (build.reach). remember: as for repatch."""
        from . import combine as cb
        from .arsenal import name_problem
        import tempfile
        from .build import BuildError, build
        from .game import in_game_folder
        self.require_game()
        mods = self._combine_list(mods)
        name = str(name or "").strip() or "Combined mods"
        if problem := name_problem(name):
            raise EditorError(problem)
        root = Path(folder) if given(folder) else self._combine_root()
        if not root.is_absolute():
            raise EditorError("Choose where combined mods go (a full path)")
        if in_game_folder(root, self.ix.game.data):
            raise EditorError(f"{root} is inside the game folder, and Audiodiver never writes there")
        if not isinstance(every_bank, bool):
            raise EditorError("Every bank is on or off")
        if winners is not None and not isinstance(winners, dict):
            raise EditorError("The winners are pairs of a clash and a mod")
        chosen = {str(k): v for k, v in (winners or {}).items()}
        self._combine_busy(("build", "repatch", "combine", "combine_read"),
                           "Wait until the running build, repatch or combine is done")
        if given(folder) and remember:
            save_settings(combine_folder=str(root))

        def copy_in(pt, clips, into: Path) -> dict:
            """The WAVs of these clips copied from the cache into the project: {clip: its copy}."""
            out = {}
            for clip in sorted(clips):
                src = pt.files.get(clip)
                if src is None or not src.is_file():
                    continue
                to = into / f"{clip}.wav"
                if not to.exists():
                    to.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(src, to)
                out[clip] = to
            return out

        def run(job):
            read = self._combine_gather(job, mods)
            effects, found, follows = self._combine_clashes(read)
            won = cb.winners(found, chosen)
            clips, own, settings, by = cb.outcome(effects, found, follows, won)
            try:
                root.mkdir(parents=True, exist_ok=True)
            except OSError as e:
                raise EditorError(f"Can't make the folder {root}: {os_error(e)}") from None
            stats = [{"name": m["name"], "imported": 0, "added": 0,
                      "settings": sum(i in ms for ms in by.values()),
                      "stale": len(set().union(*(pt.stale for *_, pt in m["parts"]))),
                      "older": len(set().union(*(pt.older for *_, pt in m["parts"]))), "left": m["left"]}
                     for i, m in enumerate(read)]
            with tempfile.TemporaryDirectory(prefix="audiodiver-combine-", ignore_cleanup_errors=True) as tmp:
                home = Path(tmp) / "project"
                p = Project(name=name, path=home / "combined.audi", library=[], every_bank=every_bank,
                            description=cb.description([(m["name"], m["chosen"]) for m in read]))
                job.step("Putting the mods together")
                with self.lock:
                    for i, m in enumerate(read):
                        mine = {}  # this mod's additions (_take_in): another mod's with the same ids go in beside them
                        for k, (key, digest, pt) in enumerate(m["parts"]):
                            if pt.error:
                                continue
                            wins = {sid for sid, at in clips.items() if at == (i, k)}
                            own_here = [o for o in pt.own if own.get(o[0]) == (i, k)]
                            local = copy_in(pt, wins | {t[2] for t in pt.takes} | {o[1] for o in own_here},
                                            home / "audio" / "imported" / f"{PurePosixPath(key).name.split('.')[0]}-{digest}")
                            for sid in sorted(wins & set(local)):
                                self._set(p, sid, str(local[sid]), label=f"{m['name']} {sid}")
                                stats[i]["imported"] += 1
                            for seg, (cues, seg_clips) in pt.cues.items():  # where all of its new audio won
                                if seg_clips and all(clips.get(s) == (i, k) for s in seg_clips):
                                    self._put_cues(p, seg, cues)
                            got = SimpleNamespace(layers=pt.layers, takes=pt.takes, own=own_here)
                            stats[i]["added"] += self._take_in(p, got, local, mine, tag=m["name"])
                            p.imported_banks = sorted(set(p.imported_banks) | pt.banks)  # where its sounds go
                    p.settings = settings
                    self._tidy(p)
                    self._tidy_cues(p)
                    self._cover(p)
                    if not p.replacements and not p.settings:
                        raise EditorError("None of the mods has audio or settings that Audiodiver can bring in")

                carried, owner, lost = {}, {}, [0] * len(read)  # {(type, id): file}, the mod it is from, lost to later ones
                for i, m in enumerate(read):
                    f = self._scan(m["source"])
                    try:
                        files = self._carried([f.place(key, Path(tmp) / "in" / f"{i}-{k}")
                                               for k, (key, *_) in enumerate(m["parts"])])
                    except EditorError as e:
                        raise EditorError(f"{m['name']}: {e}") from None
                    for c in files:
                        if owner.get((c.tid, c.fid), i) != i:
                            lost[owner[(c.tid, c.fid)]] += 1
                        carried[(c.tid, c.fid)], owner[(c.tid, c.fid)] = c, i
                for i in range(len(read)):
                    stats[i]["others"] = self._carried_lines([c for key, c in carried.items() if owner[key] == i])
                    if lost[i]:
                        stats[i]["left"] = [*stats[i]["left"], f"{lost[i]} file{'s' if lost[i] != 1 else ''} besides "
                                            f"audio that a later mod replaces"]

                def progress(doing, done=None, total=None):
                    if total:
                        job.total = total
                    job.step(doing, done)

                def say(line):  # the build's last line names its ZIP in the temp folder: said below for the copy
                    if not line.startswith(tmp):
                        job.say(line)
                try:
                    made = build(p, self.ix, Path(tmp) / "out", log=say, step=progress, listed=self._listed_banks(p),
                                 carried=list(carried.values()))
                except BuildError as e:
                    raise EditorError(str(e)) from None
                n = 1
                while (zip_path := root / (f"{name}.zip" if n == 1 else f"{name} {n}.zip")).exists():
                    n += 1
                partial = zip_path.with_name(f".{zip_path.name}.partial")  # the ZIP shows up whole or not at all
                try:
                    shutil.copyfile(made, partial)
                    os.replace(partial, zip_path)
                except OSError as e:
                    raise EditorError(f"Can't write the ZIP into {root}: {os_error(e)}") from None
                finally:
                    partial.unlink(missing_ok=True)
            job.say(f"{zip_path} ({zip_path.stat().st_size / 1e6:.1f} MB)")
            return {"name": name, "zip": str(zip_path), "mb": round(zip_path.stat().st_size / 1e6, 1), "mods": stats}
        return self._start("combine", run, title=name)

    def _take_in(self, p: Project, got, files: dict, mine: dict | None = None, tag="imported") -> int:
        """Puts what a patch adds (addition.from_patch) into the project, each with its decoded audio (files: {clip:
        wav}): under the patch's own ids where they are free, else new ones. An addition the project has already
        (the same patch imported again) takes the new audio. mine: {(kind, the patch's id): the addition it became}
        for one mod's patches (Combine), so only that mod's own additions are matched; another mod's take or layer
        with the same id goes in beside it, under new ids. A clip of its own is one per Sound, whoever's it is. tag
        starts the slots' labels. Returns how many slots it added or changed."""
        from .addition import new_id
        taken = set(self.ix.taken) | p.made_ids() | {r.target for r in p.replacements}

        def free(i):
            if i in taken:
                i = new_id(taken)
            taken.add(i)
            return i

        def find(kind, i):
            if mine is not None:
                return mine.get((kind, i))
            return next((a for a in p.additions if a.kind == kind and (a.container if kind == "layer" else a.sound) == i),
                        None)

        def add(kind, i, a):
            p.additions.append(a)
            if mine is not None:
                mine[(kind, i)] = a
            return a

        def give(source, clip, label, gain=0.0):
            self._set(p, source, str(files[clip]), label=label)
            if gain:
                self._replacement(p, source).gain_db = max(GAIN_DB[0], min(GAIN_DB[1], gain))

        n, layers = 0, {}
        for lay, beside, gain in got.layers:
            have = find("layer", lay) or add("layer", lay, Addition("layer", container=free(lay), beside=beside))
            layers[lay] = (have.container, gain)
        for container, sound, clip, _wem in got.takes:
            if clip not in files:
                continue
            to, gain = layers.get(container, (container, 0.0))
            have = find("take", sound) or add("take", sound, Addition("take", container=to, sound=free(sound),
                                                                      source=free(clip)))
            give(have.source, clip, f"{tag} take {clip}", gain)
            n += 1
        for sound, clip, _wem in got.own:
            if clip not in files:
                continue
            have = next((a for a in p.additions if a.kind == "own" and a.sound == sound), None)
            if not have:
                have = Addition("own", sound=sound, source=free(clip))
                p.additions.append(have)
            give(have.source, clip, f"{tag} {clip}")
            n += 1
        return n

    # --- export and play-through (render.py)
    def _mine(self) -> dict:
        """{source id: render.Mine} of the open project's replacements whose audio is there."""
        from .render import Mine
        p = self._need_project()
        return {sid: Mine(p.audio_path(r), r.gain_db, r.fit_timing) for sid, r in self._sources().items()
                if p.audio_path(r).exists()}

    def _renderer(self, cue_id, side):
        """A renderer for the game's own music ("game") or the music as the open project changes it ("mine"): its
        new audio and cue points, and the order and level the Soundtrack gives the piece (a piece that plays another
        renders that one)."""
        from . import soundtrack as st
        from .render import Renderer
        self.require_game()
        cue = self.catalog.cm.cues.get(int(cue_id)) if str(cue_id).isdigit() else None
        if not cue:
            raise EditorError(f"{cue_id} is not a piece of music. Only music has segments to mix and play through.")
        mine, overrides, levels = {}, {}, {}
        if side == "mine":
            p = self._need_project()
            piece = p.soundtrack.get(cue["id"])
            if piece and piece.mode == "silent":
                raise EditorError("This piece is set to Silent, so it plays nothing")
            if piece and piece.mode == "same" and piece.follows in self.catalog.cm.cues:
                cue = self.catalog.cm.cues[piece.follows]
                piece = p.soundtrack.get(cue["id"])
            if piece and cue.get("playlist"):
                try:
                    new = st.tree(self._music(), cue["id"], piece)
                except ValueError:
                    new = None
                if new is not None:
                    cue = {**cue, "playlist": st.as_dict(new)}
            mine, overrides = self._mine(), p.segment_overrides
            levels = st.levels(self._music(), p.soundtrack) if p.soundtrack else {}
        return Renderer(cue, self.vanilla_wav, mine, overrides, levels)

    def _variant_name(self, group, value) -> str:
        return self.catalog.variant(group, value).split(": ", 1)[-1]

    def export_options(self, cue_id):
        """What the export dialog offers for a cue: whether it is music (segments to mix, a whole cue to play
        through; a bank's sounds export one by one), its switch groups and whether its order is random in game."""
        if not str(cue_id).isdigit():
            self.cue(cue_id)  # EditorError for one that isn't there
            return {"music": False, "groups": [], "random": False, "playlist": False, "segments": 0}
        r = self._renderer(cue_id, "game")
        cat = self.catalog
        groups = [{"group": str(g), "name": cat.groups.get(cat.name(g)) or cat.name(g),
                   "values": [{"value": str(v), "name": self._variant_name(g, v)} for v in vals]}
                  for g, vals in r.switch_groups().items() if vals]
        return {"music": True, "groups": groups, "random": r.has_random(), "playlist": bool(r.cue.get("playlist")),
                "segments": len(r.segments)}

    def play_through(self, cue_id, side="game", variants=None, loops=1, fight=None):
        """Renders the whole cue to a preview file. Returns its path, its length and its marks: where each segment
        starts and ends, by name, and where each of its clips plays (render.Renderer.layout). fight ({"ms", "state"})
        renders one fight as the game plays it instead: from where the music starts, for about ms, with step groups
        and random picks going on from state (soundtrack.fight); the answer's "state" is for the next fight."""
        from . import render
        r = self._renderer(cue_id, side)
        names = {}
        for s in self.catalog.cue(r.cue["id"])["segments_detail"]:
            names.setdefault(s["segment"], s["name"])
        state = None
        try:
            v = choices(variants)
            loops = loop_count(loops)
            order = None
            if fight is not None:
                order, state = self._fight(r, side, fight)
            layout = r.layout(v, loops, order)
            out = CACHE_DIR / "render" / f"{cue_id}-{side}.wav"
            render.write(out, r.stream(v, int(loops), layout), "preview")
        except (render.RenderError, subprocess.CalledProcessError) as e:
            raise EditorError(str(e)) from None
        marks = layout[3]
        for m in marks:
            m["name"] = names.get(m["segment"], "")
        return {"path": str(out), "duration_ms": round(layout[2], 1), "marks": marks, "random": r.has_random(),
                **({"state": state} if state is not None else {})}

    def _fight(self, r, side, fight):
        """(segments, state) of one fight of the renderer's cue (play_through's fight)."""
        from . import music, soundtrack as st
        if not isinstance(fight, dict):
            raise EditorError("A fight is {ms, state}")
        objs = self._music()
        pid = r.cue["id"]
        pl = objs.get(pid)
        if not isinstance(pl, music.MusicPlaylist):
            raise EditorError("Only a playlist plays a fight")
        root = pl.root
        if side == "mine" and (piece := self._need_project().soundtrack.get(pid)):
            try:
                root = st.tree(objs, pid, piece) or root
            except ValueError:
                pass
        entry = st.entry_item(objs, pid)
        if entry and not st.path_to(root, entry):
            entry = 0  # gone from this tree: the music starts at its top
        state = fight.get("state")
        state = {k: {str(i): int(n) for i, n in v.items() if isinstance(n, int)} for k, v in state.items()
                 if k in ("step", "last") and isinstance(v, dict)} if isinstance(state, dict) else {}
        try:
            ms = max(10_000.0, min(600_000.0, float(fight.get("ms", 150_000))))
        except (TypeError, ValueError):
            raise EditorError("A fight's length is in milliseconds") from None

        def length(seg):
            p = r.plan(seg)
            return p.exit_ms - p.entry_ms
        return st.fight(root, entry, state, ms, length), state

    # --- the Soundtrack (soundtrack.py): how each piece of music plays
    def _music(self):
        """The game's music objects (cuemap.load_music), read once for each game version."""
        from . import cuemap
        self.require_game()
        cached = self._music_objs
        if cached is None or cached[0] is not self.ix:
            cached = self._music_objs = (self.ix, cuemap.load_music(self.ix)[0])
        return cached[1]

    def _playlist(self, cue_id) -> int:
        """The playlist a cue id names, checked."""
        from . import music
        try:
            pid = int(cue_id)
        except (TypeError, ValueError, OverflowError):
            raise EditorError(f"{cue_id!r} isn't a piece of music") from None
        if not isinstance(self._music().get(pid), music.MusicPlaylist):
            raise EditorError("Only a playlist has an order to change")
        return pid

    def playlist_map(self, cue_id):
        """How a piece of music plays: its playlist's tree (soundtrack.as_dict), the item the music starts on, the tree
        as the open project plays it ("mine", or None while that is the game's), the segments a song fills in order,
        each segment's name, and the piece as the project sets it."""
        from . import soundtrack as st
        objs = self._music()
        pid = self._playlist(cue_id)
        root = objs[pid].root
        names = {}
        for s in self.catalog.cue(pid)["segments_detail"]:
            names.setdefault(s["segment"], {"name": s["name"], "ms": round((s["exit_ms"] if s["exit_ms"] is not None
                                                                           else s["duration_ms"]) - (s["entry_ms"] or 0), 1)})
        piece = self.project.soundtrack.get(pid) if self.project else None
        try:
            mine = st.tree(objs, pid, piece)
        except ValueError:
            mine = None
        entry = st.entry_item(objs, pid)
        return {"cue": str(pid), "tree": st.as_dict(root), "mine": st.as_dict(mine) if mine is not None else None,
                "entry": str(entry), "song": [str(s) for s in st.song_segments(root, entry)], "segments": names,
                "piece": piece.to_json() if piece else {"mode": "original"}}

    def _check_piece(self, pid, d):
        """A piece as the window sends it (Piece.to_json), checked against the game's playlist."""
        from . import music, soundtrack as st
        objs = self._music()
        try:
            piece = st.Piece.from_json(d, GAIN_DB)
        except (TypeError, ValueError, OverflowError) as e:
            raise EditorError(f"Can't set that piece: {e}") from None
        pl = objs[pid]
        if bad := [s for s in piece.segments if s not in set(pl.segments())]:
            raise EditorError(f"Segments {bad[:3]} aren't in this piece of music")
        if bad := [i for i in piece.left_out if i not in st.items(pl.root)]:
            raise EditorError(f"Items {bad[:3]} aren't in this piece of music")
        if piece.mode == "same" and (piece.follows == pid or not isinstance(objs.get(piece.follows), music.MusicPlaylist)):
            raise EditorError("Same song needs another piece of music to follow")
        try:
            st.tree(objs, pid, piece)
        except ValueError as e:
            try:
                name = self.catalog.cue(pid)["name"]
            except KeyError:
                name = str(pid)
            raise EditorError(f"{name}: {e}") from None
        return piece

    def soundtrack_set(self, pieces, label="soundtrack"):
        """Sets how pieces of music play ({cue id: a piece as Piece.to_json, or None for the game's own}), as one
        undo step (a template sets many at once)."""
        if not isinstance(pieces, dict) or not pieces:
            raise EditorError("Choose the pieces of music to set")
        self._need_project()
        checked = {}
        for k, d in pieces.items():
            pid = self._playlist(k)
            checked[pid] = None if d is None else self._check_piece(pid, d)

        def apply(p):
            for pid, piece in checked.items():
                if piece is None or piece.plain():
                    p.soundtrack.pop(pid, None)
                else:
                    p.soundtrack[pid] = piece
        return self._edit(str(label)[:60] or "soundtrack", apply)

    def _segment_slots(self, pid):
        """{segment id: [(slot, variant)]} of a playlist: the slots that can take audio, layer by layer. A slot's
        variant is the switch value it plays at ("" for one that always plays)."""
        out = {}
        for s in self.catalog.cue(pid)["segments_detail"]:
            if s["segment"] not in out:
                out[s["segment"]] = [(int(sl["source"]), sl["variant"]) for st in s["stems"] for sl in st["slots"]
                                     if not sl["unused"] and not sl["locked"] and not sl.get("absent")]
        return out

    def _whole_segments(self, p, pid, segments, files):
        """Puts files[i] into segments[i], whole: into the first layer that plays at each switch value (low and high
        intensity in the Extraction music), with the timing fitted to the file, and silence into the other layers
        (keeping their timing). So the file plays alone, whatever the switch."""
        slots = self._segment_slots(pid)
        for seg, f in zip(segments, files):
            first = {}
            for sid, variant in slots.get(str(seg), []):
                first.setdefault(variant, sid)
            whole = set(first.values())
            for sid in whole:
                self._set(p, sid, f)
                self._replacement(p, sid).fit_timing = True
            for sid in {sid for sid, _ in slots.get(str(seg), [])} - whole:
                r = self._replacement(p, sid)
                if not r:
                    r = Replacement(target=sid, audio="")
                    p.replacements.append(r)
                r.audio, r.label, r.silence, r.gain_db, r.fit_timing = "", "", True, 0.0, False

    def _song_of(self, p, pid, seg):
        """The song a segment holds (as _whole_segments puts it): a copy of its first slot's replacement, or None."""
        for sid, _ in self._segment_slots(pid).get(str(seg), [])[:1]:
            r = self._replacement(p, sid)
            if r and not r.silence and r.audio:
                return copy.copy(r)
        return None

    def _put_song(self, p, pid, seg, song):
        """A song into a segment whole, as _whole_segments puts a file: the audio, label and Make-Up Gain of `song`
        (a Replacement) on the first layer at each switch value, silence on the other layers."""
        slots = self._segment_slots(pid).get(str(seg), [])
        first = {}
        for sid, variant in slots:
            first.setdefault(variant, sid)
        whole = set(first.values())
        for sid, _ in slots:
            r = self._replacement(p, sid)
            if not r:
                r = Replacement(target=sid, audio="")
                p.replacements.append(r)
            if sid in whole:
                r.audio, r.label, r.silence, r.gain_db, r.fit_timing = song.audio, song.label, False, song.gain_db, True
            else:
                r.audio, r.label, r.silence, r.gain_db, r.fit_timing = "", "", True, 0.0, False

    def _clear_song(self, p, pid, seg):
        """Takes what a song put into a segment off its slots (the song and the silence on the other layers)."""
        sids = {sid for sid, _ in self._segment_slots(pid).get(str(seg), [])}
        p.replacements = [r for r in p.replacements if self._target(r.target) not in sids]

    def _songs_of(self, p, pid):
        """The segments the piece's song or playlist fills now (to clear what a new one leaves out)."""
        old = p.soundtrack.get(pid)
        return set(old.segments) if old and old.mode in ("song", "tracks") else set()

    def playlist_set(self, cue_id, places, shuffle=None, resume=None):
        """A piece of music's songs place by place, as one undo step (the Soundtrack's Playlist). `places` lists the
        places for songs in play order (soundtrack.song_segments: a segment each), each None (empty), {"file": a
        full path} (a new song) or {"keep": i} (the song at place i now). The piece plays the filled places in that
        order, shuffled with shuffle, going on with the next song at each start with resume (None keeps either as
        it was). A place the playlist leaves empty loses the song it had."""
        from . import soundtrack as st
        p = self._need_project()
        pid = self._playlist(cue_id)
        objs = self._music()
        order = st.song_segments(objs[pid].root, st.entry_item(objs, pid))
        if not isinstance(places, list) or len(places) > len(order):
            raise EditorError(f"This music has {len(order)} places for songs")
        listed = self._songs_of(p, pid) if (old := p.soundtrack.get(pid)) and old.mode == "tracks" else set()
        now = [self._song_of(p, pid, seg) if seg in listed else None for seg in order]
        songs = []
        for x in places + [None] * (len(order) - len(places)):
            if x is None:
                songs.append(None)
            elif isinstance(x, dict) and "file" in x:
                songs.append(Replacement(target=0, audio=self._relative(p, x["file"]), label=Path(str(x["file"])).stem))
            elif isinstance(x, dict) and type(k := x.get("keep")) is int and 0 <= k < len(order) and now[k]:
                songs.append(now[k])
            else:
                raise EditorError("A place for a song is empty, a new file or one of the songs there now")
        keep = old if old and old.mode == "tracks" else st.Piece("tracks")
        piece = st.Piece("tracks", [seg for seg, s in zip(order, songs) if s],
                         shuffle=keep.shuffle if shuffle is None else shuffle is True,
                         resume=keep.resume if resume is None else resume is True, gain_db=old.gain_db if old else 0.0)
        cleared = self._songs_of(p, pid) - set(piece.segments)  # a song or another playlist before: what it filled

        def apply(p):
            for seg in cleared:
                self._clear_song(p, pid, seg)
            for seg, song in zip(order, songs):
                if song:
                    self._put_song(p, pid, seg, song)
            p.soundtrack[pid] = piece
        return self._edit("playlist", apply)

    def soundtrack_copy(self, cue_id, to):
        """Sets other pieces of music as this one is set, as one undo step: the same mode, options and level, and for
        a song or a playlist the same audio, place by place, as far as each one has places. `to` maps each piece to
        set ({cue id: the piece it follows, for Same song; else None}). Answers the project, and in "short" the
        pieces with too few places for every song or piece of the song."""
        from . import soundtrack as st
        p = self._need_project()
        pid = self._playlist(cue_id)
        objs = self._music()
        src = p.soundtrack.get(pid)
        if not src or src.mode == "original":
            raise EditorError("Set this music to another mode first")
        if not isinstance(to, dict) or not to:
            raise EditorError("Choose the music to set")
        mine = st.song_segments(objs[pid].root, st.entry_item(objs, pid))
        held = {seg: self._song_of(p, pid, seg) for seg in src.segments}
        plans, short = {}, []
        for k, follows in to.items():
            tid = self._playlist(k)
            if tid == pid:
                continue
            order = st.song_segments(objs[tid].root, st.entry_item(objs, tid))
            if src.mode == "song":  # the pieces in order, from the first place on
                songs = [held[s] for s in src.segments][:len(order)]
                fill = list(zip(order, songs))
            elif src.mode == "tracks":  # each song at the place it has here
                at = {s: i for i, s in enumerate(mine)}
                fill = [(order[at[s]], held[s]) for s in src.segments if at.get(s, len(order)) < len(order)]
            else:
                fill = []
            if len(fill) < len(src.segments):
                short.append(str(tid))
            fill = [(seg, song) for seg, song in fill if song]
            d = {"mode": src.mode, "gain_db": src.gain_db, "shuffle": src.shuffle, "resume": src.resume,
                 "song": src.song, "segments": [str(seg) for seg, _ in fill]}
            if src.mode == "same":
                if follows is None:
                    continue
                d["follows"] = str(follows)
            plans[tid] = (self._check_piece(tid, d), fill)
        if not plans:
            raise EditorError("No other music to set")

        def apply(p):
            for tid, (piece, fill) in plans.items():
                for seg in self._songs_of(p, tid) - set(piece.segments):
                    self._clear_song(p, tid, seg)
                for seg, song in fill:
                    self._put_song(p, tid, seg, song)
                p.soundtrack[tid] = piece
        state = self._edit("soundtrack", apply)
        return {**state, "short": short}

    def song_fill(self, cue_id, audio_path, bounds_ms, segments=None):
        """A song for a piece of music, as one undo step: cut at bounds_ms, one piece per segment (segments: those
        the song fills, in order; the piece's song segments by default), each into its segment whole
        (_whole_segments). The piece then plays the song from its first segment every time the music starts. The
        segments an earlier song or playlist filled that this one doesn't lose that audio."""
        from . import audio, soundtrack as st
        self._need_project()
        pid = self._playlist(cue_id)
        objs = self._music()
        order = [int(s) for s in segments] if segments else st.song_segments(objs[pid].root, st.entry_item(objs, pid))
        rel = self._relative(self.project, audio_path)
        if not isinstance(bounds_ms, list):
            raise EditorError("The cut points are a list of milliseconds")
        if len(bounds_ms) - 1 > len(order):
            raise EditorError(f"This music has {len(order)} segments for a song, so cut it into {len(order)} pieces at most")
        try:
            pieces = audio.slice_song(Path(audio_path), bounds_ms, self._slice_dir(audio_path))
        except ValueError as e:
            raise EditorError(str(e)) from None
        except OSError as e:
            raise EditorError(os_error(e)) from None
        song = order[:len(pieces)]
        piece = self._check_piece(pid, {"mode": "song", "segments": [str(s) for s in song], "song": rel})

        def apply(p):
            for seg in self._songs_of(p, pid) - set(song):
                self._clear_song(p, pid, seg)
            self._whole_segments(p, pid, song, [str(f) for f in pieces])
            piece.gain_db = p.soundtrack[pid].gain_db if pid in p.soundtrack else 0.0
            p.soundtrack[pid] = piece
        return self._edit("song", apply)

    def tracks_fill(self, cue_id, files, shuffle=False, segments=None):
        """Whole songs for a piece of music, as one undo step: each file into a segment of its own, whole
        (_whole_segments), in file-name order; the piece plays them in that order, or in a random order (shuffle)."""
        from . import soundtrack as st
        from .audio import natural
        self._need_project()
        pid = self._playlist(cue_id)
        objs = self._music()
        if not isinstance(files, list) or not files:
            raise EditorError("Choose the songs")
        files = sorted((str(f) for f in files), key=natural)
        for f in files:
            self._relative(self.project, f)
        order = [int(s) for s in segments] if segments else st.song_segments(objs[pid].root, st.entry_item(objs, pid))
        if len(files) > len(order):
            raise EditorError(f"This music has {len(order)} segments for songs, so choose {len(order)} songs at most")
        chosen = order[:len(files)]
        piece = self._check_piece(pid, {"mode": "tracks", "segments": [str(s) for s in chosen], "shuffle": shuffle is True})

        def apply(p):
            for seg in self._songs_of(p, pid) - set(chosen):
                self._clear_song(p, pid, seg)
            self._whole_segments(p, pid, chosen, files)
            piece.gain_db = p.soundtrack[pid].gain_db if pid in p.soundtrack else 0.0
            p.soundtrack[pid] = piece
        return self._edit("playlist", apply)

    def export(self, cue_id, folder, what="segments", whose="game", fmt="wav", sources=None, variants=None,
               all_variants=False, loops=1, tails=True, title=None):
        """Exports a cue's audio to folder as a background job.
        what: "slots" (each slot's own audio), "segments" (each segment as the game mixes it) or "cue" (the whole
        cue played through). whose: "game", "mine" or "both". sources limits slots/segments to those slots."""
        from . import render
        self.require_game()
        if what not in ("slots", "segments", "cue") or whose not in ("game", "mine", "both"):
            raise EditorError("Unknown export choice")
        if fmt not in render.FORMATS or fmt == "preview":
            raise EditorError(f"Unknown format {fmt}")
        if whose != "game":
            self._need_project()
        detail = self.cue(cue_id, mine=whose != "game")
        if detail["kind"] in ("sounds", "sound") and what != "slots":
            raise EditorError("A bank's sounds export one by one, because there are no segments to mix")
        folder, loops = out_folder(folder), loop_count(loops)
        only = {int(s) for s in sources} if sources else None
        chosen = choices(variants)
        ext = render.FORMATS[fmt][0]
        # "Weapons - AC-8 Autocannon": where it is in the Library, a name said once
        # the names the Library shows when the window sends them ("Before the Drop - Loadout Selection")
        title = (title.strip() if isinstance(title, str) and title.strip() else
                 " - ".join(dict.fromkeys(x for x in [*detail["path"], detail["name"]] if x)))
        album = f"Helldivers 2 - {title}"

        seg_names = {s["segment"]: s["name"] for s in detail["segments_detail"]}

        def run(job):
            folder.mkdir(parents=True, exist_ok=True)
            used, files = set(), []
            sides = ["game", "mine"] if whose == "both" else [whose]
            job.step("Getting ready")

            def target(stem):
                stem = _filename(stem)
                name, n = stem, 2
                while name.lower() in used:
                    name, n = f"{stem} {n}", n + 1
                used.add(name.lower())
                return folder / f"{name}.{ext}"

            def label(v):
                return "".join(f" ({self._variant_name(g, x)})" for g, x in sorted(v.items()))

            def pick(groups, limit=64):
                if all_variants:
                    return render.variant_sets(groups, limit)
                return [{g: chosen.get(g, vals[0]) for g, vals in groups.items() if vals}]

            def save(path, audio, n=None):
                job.check()
                change = render.write(path, audio, fmt, {"title": path.stem, "album": album, "track": n})
                job.say(path.name + (f" (turned down {-change:.1f} dB to avoid clipping)" if change else ""))
                files.append(str(path))

            slots = list(_slots_of(detail)) if what == "slots" else []
            if what == "slots":
                job.total, digits = len(sides) * len(slots), max(2, len(str(len(slots))))
            for side_no, side in enumerate(sides):
                tag = "original" if side == "game" else "replaced"
                whose_label = tag
                if what == "slots":  # each slot's own audio: the same for music and for a bank's sounds
                    mine = self._mine() if side == "mine" else {}
                    for n, (seg, sl) in enumerate(slots, 1):
                        sid = int(sl["source"])
                        job.step(f"{seg['name']} ({whose_label})", job.done + 1)
                        if (only and sid not in only) or (side == "mine" and sid not in mine) or \
                                (side == "game" and (sl.get("absent") or sl.get("added"))):  # a new take: no original
                            continue
                        path = target(_slot_stem(title, n, digits, seg, sl, tag))
                        src = mine[sid].path if side == "mine" else self.vanilla_wav(sid)
                        render.transcode(src, path, fmt, {"title": path.stem, "album": album, "track": n})
                        job.say(path.name)
                        files.append(str(path))
                    continue
                r = self._renderer(cue_id, side)
                if what == "segments":
                    job.total = len(sides) * len(r.segments)
                    for n, (seg_id, seg) in enumerate(r.segments.items(), 1):
                        job.step(f"{seg_names.get(str(seg_id), 'segment')} ({whose_label})",
                                 side_no * len(r.segments) + n - 1)
                        if only and not only & {sl["source"] for st in seg["stems"] for sl in st["slots"]}:
                            continue
                        name = next(s["name"] for s in detail["segments_detail"] if s["segment"] == str(seg_id))
                        for v in pick(r.switch_groups(seg_id)):
                            plan = r.plan(seg_id, v)
                            if side == "mine" and whose == "both" and not plan.changed:
                                continue  # the same as the game's, which is exported already
                            if not plan.clips:
                                continue
                            audio = r.segment(seg_id, v, plan=plan)
                            if not tails:
                                audio = audio[render.frames(plan.entry_ms):render.frames(plan.exit_ms)]
                            save(target(f"{title} - {n:02d} {name}{label(v)} ({tag})"), audio, n)
                else:
                    sets = pick(r.switch_groups(), 16)
                    for k, v in enumerate(sets):
                        layout = r.layout(v, int(loops))
                        plays = len(layout[0])
                        job.total = len(sides) * len(sets) * (plays + 1)
                        before = (side_no * len(sets) + k) * (plays + 1)

                        def on_segment(i, count, plan, before=before):
                            job.step(f"{seg_names.get(str(plan.segment), 'segment')} ({whose_label}), "
                                     f"{i + 1} of {count}", before + i)
                        path = target(f"{title}{label(v)} ({tag})")
                        pieces = r.stream(v, int(loops), layout, on_segment)
                        change = render.write(path, _then(pieces, lambda: job.step(
                            f"Writing {path.name}", before + plays)), fmt, {"title": path.stem, "album": album})
                        job.say(path.name + (f" (turned down {-change:.1f} dB to avoid clipping)" if change else ""))
                        files.append(str(path))
            if not files:
                # the job's notice reads "Export failed: …"
                raise EditorError("None of these slots is replaced yet" if whose == "mine" else "There was nothing to export")
            job.done, job.doing = job.total, ""
            return {"files": len(files), "folder": str(folder), "first": files[0]}

        def guarded(job):
            try:
                return run(job)
            except (render.RenderError, subprocess.CalledProcessError) as e:
                raise EditorError(str(e)) from None
        return self._start("export", guarded, title)

    # --- the game's text (strings.py): subtitles and every other line, in each language
    def _texts(self):
        from . import strings
        self.require_game()
        if self.texts is None:
            self.texts = strings.Texts(self.ix.game)
        return self.texts

    def text_languages(self):
        """The languages the game's text comes in: [{code, name}], US English first."""
        from . import strings
        return [{"code": c, "name": strings.LANGUAGES.get(c, c)} for c in self._texts().languages()]

    def text_search(self, language, query="", mine=False, limit=300, ids=None):
        """Lines of the game's text in a language that have every word of query in them (or that are the id typed);
        mine: only the ones the open project changes; ids: only these lines (a voice line's subtitle and those with
        its words), in that order, whatever the query. Subtitles come first. {results, total}: results stop at limit."""
        from . import strings
        tx = self._texts()
        edits = {(t.table, t.id): t for t in (self.project.texts if self.project else [])}
        words = str(query or "").lower().split()
        try:
            limit = max(0, min(5000, int(limit)))
            only = None if ids is None else {int(i): k for k, i in enumerate(ids)}
        except (TypeError, ValueError, OverflowError):
            raise EditorError("The number of lines to show is a whole number") from None
        out, total = [], 0
        tables = sorted(tx.tables(language), key=lambda ft: tx.kind(ft[0]) != "subtitles")
        for fid, t in tables:
            kind = tx.kind(fid)
            for sid, text in t.texts.items():
                e = edits.get((fid, sid))
                if mine and not e:
                    continue
                if only is not None:
                    if sid not in only:
                        continue
                elif words and not (str(sid) == words[0] and len(words) == 1):
                    hay = f"{strings.plain(text)} {strings.plain(e.text) if e else ''}".lower()
                    if not all(w in hay for w in words):
                        continue
                elif not words and not mine:
                    continue
                total += 1
                if len(out) < limit:
                    out.append({"table": str(fid), "id": sid, "kind": kind, "text": text,
                                **({"yours": e.text, "was": e.was} if e else {})})
        if only is not None:
            out.sort(key=lambda r: only[r["id"]])
        return {"results": out, "total": total}

    def text_alike(self, id):
        """The subtitles with the same words as this one in US English, this one first: the game has a subtitle per
        script line, and several lines can say the same ("Reloading." is 32). A voice line matched by its words
        alone is one of them (library.py, `subtitle_sure`)."""
        from . import strings
        tx = self._texts()
        subs = {}
        for fid, t in tx.tables("us"):
            if tx.kind(fid) == "subtitles":
                subs.update(t.texts)
        words = lambda t: re.sub(r"[^\w']+", " ", strings.plain(t).lower()).split()
        try:
            id = int(id)
            mine = words(subs[id])
        except (TypeError, ValueError, OverflowError, KeyError):
            raise EditorError("That line isn't a game subtitle") from None
        return [id, *(i for i, t in subs.items() if i != id and words(t) == mine)]

    def text_voices(self, ids, language):
        """The voice lines that say these subtitles (one, or those with its words), in a text language's voices
        (English where that language has no voices): where each is, to open it in the Library (library.py)."""
        self.require_game()
        try:
            ids = [int(i) for i in ids]
        except (TypeError, ValueError, OverflowError):
            raise EditorError("Subtitle ids are whole numbers") from None
        return self.lib.subtitle_lines(ids, str(language))

    def text_set(self, table, id, text):
        """Changes one line of the game's text in the open project (undoable). Back to the game's own text, it is
        no longer the project's."""
        if not isinstance(text, str):
            raise EditorError("A line of text is text")
        try:
            table, id = int(table), int(id)
            was = self._texts().table(table).texts[id]
        except (TypeError, ValueError, OverflowError, KeyError):
            raise EditorError("That line isn't in the game text") from None

        def apply(p):
            mine = next((t for t in p.texts if t.table == table and t.id == id), None)
            if text == was:
                p.texts = [t for t in p.texts if t is not mine]
            elif mine:
                mine.text, mine.was = text, was
            else:
                p.texts.append(TextEdit(table, id, text, was))
        return self._edit("text", apply)

    def text_revert(self, lines):
        """Gives lines ([{table, id}]) back the game's text."""
        try:
            gone = {(int(x["table"]), int(x["id"])) for x in lines}
        except (TypeError, ValueError, KeyError, OverflowError):
            raise EditorError("Those aren't lines of the game text") from None

        def apply(p):
            p.texts = [t for t in p.texts if (t.table, t.id) not in gone]
        return self._edit("text", apply)

    def export_list(self, entries, folder, whose="game", fmt="wav", apart=True):
        """Exports the export list, what the user collected from anywhere in the Library and the Editor, as one
        background job. Each entry is a cue (a bank's sounds, a piece of music's slots), optionally only some of its
        slots ("sources"), and a "name". Every slot's own audio is saved as it is, as "Each slot" does; apart: one
        folder per entry, named after it, else all in folder."""
        from . import render
        self.require_game()
        if whose not in ("game", "mine", "both"):
            raise EditorError("Unknown export choice")
        if fmt not in render.FORMATS or fmt == "preview":
            raise EditorError(f"Unknown format {fmt}")
        if whose != "game":
            self._need_project()
        if not isinstance(entries, list) or not all(isinstance(e, dict) and "cue" in e for e in entries):
            raise EditorError("The export list can't be read. Clear it and add the items again.")
        plan = []  # (folder name, title, [(segment, slot)])
        for e in entries:
            detail = self.cue(e["cue"], mine=whose != "game")
            only = {str(s) for s in e.get("sources") or ()}
            # the name it has on the list (the Index's, or one typed) names its folder and starts its files' names
            title = str(e.get("name") or "").strip() or " - ".join(dict.fromkeys(x for x in [*detail["path"], detail["name"]] if x))
            plan.append((_filename(title), title,
                         [(seg, sl) for seg, sl in _slots_of(detail) if not only or str(sl["source"]) in only]))
        if not any(slots for *_, slots in plan):
            raise EditorError("The export list is empty")
        folder, ext = out_folder(folder), render.FORMATS[fmt][0]
        sides = ["game", "mine"] if whose == "both" else [whose]

        def run(job):
            mine = self._mine() if whose != "game" else {}
            # what is written: the original of a slot the game's files have audio for, the new audio of a replaced one
            heard = lambda side, sl: int(sl["source"]) in mine if side == "mine" else not (sl.get("absent") or sl.get("added"))
            job.total = sum(heard(side, sl) for *_, slots in plan for side in sides for _, sl in slots)
            absent = sum(bool(sl.get("absent")) for *_, slots in plan for _, sl in slots) if "game" in sides else 0
            job.step("Getting ready")
            used, files = set(), []
            for name, title, slots in plan:
                where = folder / name if apart else folder
                where.mkdir(parents=True, exist_ok=True)
                digits = max(2, len(str(len(slots))))
                for side in sides:
                    tag = "original" if side == "game" else "replaced"
                    for n, (seg, sl) in enumerate(slots, 1):
                        sid = int(sl["source"])
                        if not heard(side, sl):
                            continue
                        job.step(f"{name}: {seg['name']}", job.done + 1)
                        stem = base = _filename(_slot_stem(title, n, digits, seg, sl, tag))
                        k = 2
                        while str(where / stem).lower() in used:  # the same slot listed twice into one folder
                            stem, k = f"{base} {k}", k + 1
                        used.add(str(where / stem).lower())
                        path = where / f"{stem}.{ext}"
                        job.check()
                        src = mine[sid].path if side == "mine" else self.vanilla_wav(sid)
                        render.transcode(src, path, fmt, {"title": path.stem, "album": f"Helldivers 2 - {title}", "track": n})
                        job.say(path.name)
                        files.append(str(path))
            if not files:
                # the job's notice reads "Export failed: …"
                raise EditorError("None of these slots is replaced yet" if whose == "mine" else "There was nothing to export")
            job.done, job.doing = job.total, ""
            return {"files": len(files), "folder": str(folder), "first": files[0], "absent": absent}

        def guarded(job):
            try:
                return run(job)
            except (render.RenderError, subprocess.CalledProcessError) as e:
                raise EditorError(str(e)) from None
        return self._start("export", guarded, "the export list")


def _slots_of(detail):
    """(segment, slot) for every slot of a cue the game plays, each source once, in list order: what exports as
    "each slot"."""
    seen = set()
    for seg in detail["segments_detail"]:
        for st in seg["stems"]:
            for sl in st["slots"]:
                if sl["unused"] or sl["source"] in seen:
                    continue
                seen.add(sl["source"])
                yield seg, sl


def _slot_stem(title, n, digits, seg, sl, tag):
    """A slot's exported file name: where it is, its place in the list, its segment or group, the take (a take is told
    apart by its label: "Take 3", or what a voice line says), its variant, and whose audio it is."""
    var = f" ({sl['variant'].split(': ', 1)[-1]})" if sl["variant"] else ""
    take = sl["label"] if seg.get("group") and sl["label"] not in seg["name"] else ""
    return f"{title} - {n:0{digits}d} {seg['name']}{' ' + take if take else ''}{var} ({tag})"


def _then(pieces, after):
    """pieces, then a call once they are used up (a progress step between rendering and encoding)."""
    yield from pieces
    after()


def _game_updated(p: Project, game, last) -> bool:
    """Whether the game updated since the project's last build (last: _last_build's): the build was made on an
    older game version, or, for a build from before projects noted that, its ZIP is older than Steam's last update
    of the game. Its banks' copies of what many banks share are then stale and can mute the game's sounds."""
    if not last:
        return False
    if p.built_for:
        if p.built_for.isdigit() and game.version.isdigit():
            return int(p.built_for) < int(game.version)  # a computer with an older game says nothing
        return p.built_for != game.version
    return "updated" in game.steam and last["modified"] < game.steam["updated"]


def build_inputs(p: Project) -> str:
    """A fingerprint of what a build of the project is made from: its file but for its notes and its build records,
    and the size and time of each file it uses, so audio changed in another program counts too."""
    import hashlib
    import json
    d = p.to_json()
    for k in ("version", "built_for", "built_from", "build_folder", "notes", "tabs"):
        d.pop(k, None)
    files = {r.audio for r in p.replacements if not r.silence and r.audio} | {p.icon.get("image") or ""}
    stats = {}
    for rel in sorted(f for f in files if isinstance(f, str) and f):
        try:
            st = p.file(rel).stat()
            stats[rel] = [st.st_size, st.st_mtime_ns]
        except OSError:
            stats[rel] = None
    return hashlib.sha1(json.dumps([d, stats], sort_keys=True).encode()).hexdigest()[:16]


def _rebuild(p: Project, game_updated: bool, last) -> str | None:
    """Why the mod in the build folder isn't the project as it is now: "new" (no build yet), "game" (the game updated
    since), "changed" (the project did), or None. A build from before projects noted what it was made from says
    nothing until the next one."""
    if not p.replacements and not p.texts and not p.soundtrack:
        return None  # nothing to build
    if not last:
        return "new"
    if game_updated:
        return "game"
    if p.built_from and p.built_from != build_inputs(p):
        return "changed"
    return None


def _last_build(folder: Path, slug: str):
    """The newest build of a mod in its build folder, <slug>-<version>.zip (other mods may build into the same
    folder): {zip, mb, modified}, or None."""
    try:
        zips = [(f.stat(), f) for f in folder.glob(f"{slug}-*.zip") if f.stem[len(slug) + 1:].isdigit()]
    except OSError:
        return None
    if not zips:
        return None
    st, f = max(zips, key=lambda z: z[0].st_mtime)
    return {"zip": str(f), "mb": round(st.st_size / 1e6, 1), "modified": st.st_mtime}


def _digest(patch: Path) -> str:
    """A short fingerprint of a patch file and its .stream: what tells two mods' patches of one archive apart."""
    import hashlib
    h = hashlib.sha1()
    for f in (patch, patch.with_name(patch.name + ".stream")):
        try:
            with open(f, "rb") as r:
                while chunk := r.read(1 << 20):
                    h.update(chunk)
        except OSError:
            pass  # no .stream: the patch alone
    return h.hexdigest()[:8]


def projects_info(paths):
    """What the Home tab lists for each recent project: whether the file is still there, the mod's name and when it
    was last saved."""
    import json
    out = []
    for path in paths if isinstance(paths, list) else []:
        f = Path(str(path))
        info = {"path": str(path), "exists": False, "readable": False, "name": f.stem, "modified": None}
        try:
            info["modified"] = f.stat().st_mtime
            info["exists"] = f.is_file()
            d = json.loads(f.read_text(encoding="utf-8"))
            if isinstance(d, dict) and d.get("audiodiver") == 1:
                info["name"] = str(d.get("name") or f.stem)
                info["readable"] = True
        except (OSError, ValueError, AttributeError):
            pass  # moved, deleted or not a project: the list says which
        out.append(info)
    return out


# What Audiodiver keeps on disk to save time, by what it costs to lose: previews are made again as you listen,
# encoded audio at the next build, the mods Combine read when they are read again. The game index and the logs are
# not offered for clearing.
CACHE_KINDS = {"previews": ("preview", "render", "peaks"), "encoded": ("wem", "akd"), "combine": ("combine",)}


def cache_info():
    """{folder, previews, encoded, combine}: where the cache is and how many bytes each clearable part takes."""
    def size(name):
        total = 0
        for f in (CACHE_DIR / name).rglob("*"):
            try:
                total += f.stat().st_size if f.is_file() else 0
            except OSError:
                pass  # gone meanwhile
        return total
    return {"folder": str(CACHE_DIR), **{kind: sum(size(n) for n in names) for kind, names in CACHE_KINDS.items()}}


def cache_clear(kind):
    """Deletes one part of the cache. Files in use (a preview that is playing, a render being written) are skipped:
    Windows won't delete an open file, and they are not worth failing over."""
    if kind not in CACHE_KINDS:
        raise EditorError(f"Unknown cache {kind}")
    for name in CACHE_KINDS[kind]:
        for f in (CACHE_DIR / name).rglob("*"):
            try:
                if f.is_file():
                    f.unlink()
            except OSError:
                pass
    return cache_info()


def _filename(stem: str) -> str:
    """stem made safe as a Windows file name."""
    for ch in '<>:"/\\|?*':
        stem = stem.replace(ch, " ")
    return " ".join(stem.split()).rstrip(". ")[:180]


def reveal(path):
    """Opens Explorer at path (used when the UI runs in a plain browser)."""
    path = Path(path)
    if os.name == "nt":
        subprocess.Popen(["explorer", "/select,", str(path)] if path.is_file() else ["explorer", str(path)])
    elif shutil.which("xdg-open"):
        subprocess.Popen(["xdg-open", str(path if path.is_dir() else path.parent)])
