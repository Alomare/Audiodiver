"""The editor session behind the UI: one open project, edited through small operations that autosave and can be
undone, plus background jobs (game loading, builds, patch imports). The HTTP server (server.py) is a thin layer over
this, so everything here is testable without a browser.
"""
import logging
import math
import os
import re
import shutil
import subprocess
import threading
import time
import uuid
from pathlib import Path

from . import wem
from .errors import os_error, plain  # noqa: F401 (server.py takes them from here too)
from .index import AudioIndex, CACHE_DIR
from .project import GAIN_DB, Addition, Project, ProjectFormatError, Replacement, TextEdit

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
    SETTINGS_FILE.write_text(json.dumps(d, indent=2) + "\n", encoding="utf-8")


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
        raise EditorError(f"{folder} needs its full path")
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
        self.stage, self.load_error = "starting", None
        self.game_where = {"path": None, "how": None}  # the data folder in use (or tried) and how it was found
        self.project: Project | None = None
        self.undo_stack, self.redo_stack = [], []
        # {mod id: the version its last build moved it on to}: undo and redo never take a project below it, so the
        # next build never overwrites a ZIP already made (see _bump_version). By id, not path: another project made
        # later at the same path is another mod.
        self.version_floor: dict[str, int] = {}
        self.revision = 0  # counts the changes to what is open (edits, undo, redo, another project): project_state
        self.jobs: dict[str, Job] = {}
        if load:
            threading.Thread(target=self._load_game, daemon=True).start()

    # --- game data
    def _load_game(self):
        try:
            from .catalog import Catalog
            from .cuemap import CueMap
            from .game import Game, locate
            from .library import Library
            from .render import clean_spool
            clean_spool()
            folder, how = locate(load_settings().get("game_data"))
            again = bool(self.game_where.get("path"))  # another folder was chosen: this isn't the start-up read
            self.game_where = {"path": str(folder), "how": how}
            self.stage = ("Reading the game's audio from the new folder" if again
                          else "Reading the game's audio (first run after a game update takes about a minute)")
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
            self._cue_sets, self._clips = {}, {}
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
        project adds to them (the Audio Editor's view; the Library shows the game's)."""
        self.require_game()
        try:
            cue_id = str(cue_id)
            view = self.catalog.cue(int(cue_id)) if cue_id.isdigit() else \
                self.lib.view(cue_id, self._overlay() if mine else None)
        except KeyError:
            raise EditorError(f"No cue {cue_id}") from None
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
                    raise EditorError(f"Sound {sid} has no audio in the game's files") from None
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
        legacy = self.project.path.parent / "slices" / Path(audio_path).stem  # cuts made before songs had a folder each
        return {**self.peaks("file", path=audio_path, buckets=buckets),
                "previous": audio.previous_cuts(self._slice_dir(audio_path), Path(audio_path))
                or audio.previous_cuts(legacy, Path(audio_path))}

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
    def new_project(self, path, name):
        if not given(path) or not Path(path).is_absolute():
            raise EditorError("Choose where to save the project (a full path)")
        path = Path(path).resolve()
        if path.suffix.lower() != ".audi":
            path = path.with_name(path.name + ".audi")  # "Dune 2.0" is Dune 2.0.audi, not Dune 2.audi
        if path.exists():
            raise EditorError(f"{path.name} already exists in {path.parent}")
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
        except OSError as e:
            raise EditorError(f"Can't make the folder {path.parent}: {os_error(e)}") from None
        name = str(name or "").strip() or path.stem.strip() or "My mod"
        with self.lock:
            self.project = Project(name=name, path=path, library=[])  # blank: nothing to edit yet
            self.project.save()
            self.undo_stack, self.redo_stack = [], []
            self.revision += 1
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
                raise EditorError("Give the slot its new audio first")
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
                    notes.append(f"{self._list_name(iid)} is already in the project, because its sounds are in {owners}.")
                    continue
                if have:
                    notes.append(f"{self._list_name(iid)} added. {len(have)} of its {len(mine)} banks "
                                 f"{'was' if len(have) == 1 else 'were'} already in the project, in {owners}. Their "
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
        problems = p.problems() + [f"{u['label'] or u['audio'] or 'silence'}: sound {u['target']} isn't in this "
                                   f"version of the game (remove it, or replace another sound)" for u in unresolved]
        by_sound = {}
        for r in p.replacements:  # two targets can be one sound: a stream's file id and its source id
            by_sound.setdefault(self._target(r.target), {})[r.target] = r.label or r.audio or "silence"
        problems += [f"{' and '.join(names.values())} replace the same sound" for names in by_sound.values()
                     if len(names) > 1]  # the same target twice, problems() names already
        problems += [f"{a['label'] or a['name']}: can't read its audio ({a['audio']})" for a in assignments.values()
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
                "revision": self.revision, "version": p.version, "description": p.description, "icon": p.icon, "icon_frame": frame,
                "loudness_analysis": p.loudness_analysis, "biome_fix": p.biome_fix,
                "build_folder": str(p.build_dir()), "build_folder_default": str(p.default_build_dir()),
                "zip_name": zip_name(p), "last_build": _last_build(p.build_dir(), slug(p.name)),
                "assignments": assignments, "unresolved": unresolved,
                "segment_overrides": {str(k): v for k, v in p.segment_overrides.items()},
                "texts": [{"table": str(t.table), "id": t.id, "text": t.text, "was": t.was} for t in p.texts],
                "additions": p.to_json().get("additions", []), "settings": len(p.settings),
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
                self.revision += 1
                self.undo_stack.append((label, before))
                del self.undo_stack[:-UNDO_LIMIT]
                self.redo_stack.clear()
                p.save()
            return self.project_state()

    def _restore(self, d):
        self.revision += 1
        self.project = Project.from_json(d, self.project.path)
        floor = self.version_floor.get(self.project.guid, 0)  # a build moved it on: undo doesn't take that back
        self.project.version = max(self.project.version, floor)
        self.project.save()

    def undo(self):
        with self.lock:
            self._need_project()
            if self.undo_stack:
                label, d = self.undo_stack.pop()
                self.redo_stack.append((label, self.project.to_json()))
                self._restore(d)
            return self.project_state()

    def redo(self):
        with self.lock:
            self._need_project()
            if self.redo_stack:
                label, d = self.redo_stack.pop()
                self.undo_stack.append((label, self.project.to_json()))
                self._restore(d)
            return self.project_state()

    def _relative(self, p: Project, audio) -> str:
        from .audio import duration_ms
        if not isinstance(audio, (str, os.PathLike)) or not str(audio).strip():
            raise EditorError("Choose an audio file")
        audio = Path(audio)
        if not audio.is_absolute():
            raise EditorError(f"{audio} needs its full path")
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
            raise EditorError("The icon is its frame; set an image with set_icon")
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
            raise EditorError("That folder is inside the game's folder, and Audiodiver never writes there. Choose a folder "
                              "outside it, and import the ZIP in HD2 Arsenal.")
        if folder == p.default_build_dir().resolve():
            return ""
        try:
            return folder.relative_to(p.path.parent.resolve(), walk_up=True).as_posix()
        except ValueError:  # another drive
            return str(folder)

    def settings(self, **fields):
        """Changes what the build packages the mod as (name, version, description, icon, a new id) and where its
        builds go. Every value is checked before any is changed."""
        from . import akd
        bad = set(fields) - {"name", "version", "description", "icon", "build_folder", "guid", "loudness_analysis",
                             "biome_fix"}
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
            elif k == "biome_fix" and not isinstance(v, bool):
                raise EditorError("The biome music fix is on or off")
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
                elif k == "biome_fix":
                    p.biome_fix = v
        return self._edit("settings", apply)

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

    def segment_override(self, segment, entry_marker=None, exit_marker=None):
        """Sets (or, with neither, clears) a music segment's cue points in ms of its new audio."""
        try:
            seg = int(segment)
        except (TypeError, ValueError, OverflowError):
            raise EditorError(f"{segment!r} isn't a segment id") from None
        o = {}
        for k, v in (("entry_marker", entry_marker), ("exit_marker", exit_marker)):
            if v is None or v == "":
                continue
            if isinstance(v, bool) or not isinstance(v, (int, float, str)):
                raise EditorError("A cue point is a number of milliseconds")
            try:
                ms = float(v)
            except ValueError:
                raise EditorError("A cue point is a number of milliseconds") from None
            if not math.isfinite(ms) or ms < 0 or ms > 3_600_000:
                raise EditorError("A cue point is a number of milliseconds from 0")
            o[k] = ms
        if "entry_marker" in o and "exit_marker" in o and o["entry_marker"] >= o["exit_marker"]:
            raise EditorError("The Entry cue point comes before the Exit")

        def apply(p):
            if o:
                p.segment_overrides[seg] = o
            else:
                p.segment_overrides.pop(seg, None)
        return self._edit("segment", apply)

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
        if any(j.kind == "build" and j.state == "running" for j in self.jobs.values()):
            raise EditorError("A build is already running")
        if not p.replacements and not p.texts:
            raise EditorError("Nothing to build yet. Replace some audio or change a line of text first.")
        if problems := self.project_state()["problems"]:
            raise EditorError(f"Fix the problems on the Build tab first: {problems[0]}"
                              + (f" (and {len(problems) - 1} more)" if len(problems) > 1 else ""))

        def run(job):
            with self.lock:
                snapshot = Project.load(p.path) if p.path.exists() else p

            def progress(doing, done=None, total=None):  # and a cancel stops the build here
                if total:
                    job.total = total
                job.step(doing, done)
            try:
                zip_path = build(snapshot, self.ix, log=job.say, step=progress)
            except BuildError as e:
                raise EditorError(str(e)) from None
            result = {"zip": str(zip_path), "folder": str(zip_path.parent), "version": snapshot.version,
                      "mb": round(zip_path.stat().st_size / 1e6, 1)}
            if bump:
                self._bump_version(snapshot.path, snapshot.version + 1)
            return result
        return self._start("build", run)

    def _bump_version(self, path, version):
        """After a build, its project goes on to the next version: the one that was built, even if another is open
        by now (or none). Not an edit: undo and redo keep it (version_floor), so the next build never overwrites
        the ZIP just made."""
        with self.lock:
            p = self.project if self.project and self.project.path == path else None
            if p is None:
                try:
                    p = Project.load(path)
                except (OSError, ValueError, KeyError):
                    return  # moved or deleted meanwhile: nothing to move on
            self.version_floor[p.guid] = max(version, self.version_floor.get(p.guid, 0))
            if p.version < version:
                p.version = version
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
            raise EditorError("An import adds to the project or replaces its audio")
        if not given(patch_path):
            raise EditorError("Choose a mod's .patch_0 file")
        patch_path = Path(patch_path)
        if not patch_path.is_file():
            raise EditorError(f"{patch_path} wasn't found")
        if not re.search(r"\.patch_\d+$", patch_path.name, re.I):
            raise EditorError(f"{patch_path.name} isn't a patch file. Choose the mod's .patch_0 file. Audiodiver reads the .stream file "
                              f"next to it as well.")

        def run(job):
            out_dir = p.path.parent / "imported" / patch_path.stem.split(".")[0]
            got, replaced, files, skipped = self._patch_audio(patch_path, out_dir, job)
            if not self.project or self.project.path != p.path:
                raise EditorError("Another project was opened during the import. Open this project again and import again.")
            counts = {"added": 0}

            def apply(proj):  # what the patch replaces joins the project's list (_cover), so the Editor shows it
                if mode == "replace":  # the files stay on disk
                    proj.replacements, proj.additions, proj.settings, proj.segment_overrides = [], [], {}, {}
                    proj.library = []
                counts["added"] = self._fill_from_patch(proj, got, replaced, files)
            self._edit("import", apply)
            return {"imported": sum(s in files for s in replaced), "added": counts["added"], "skipped": skipped,
                    "settings": len(got.settings), "left": got.left, "stale": len(got.stale), "folder": str(out_dir)}
        return self._start("import", run)

    def _patch_audio(self, patch_path: Path, out_dir: Path, job):
        """What a mod's patch replaces, adds and sets (addition.from_patch), its audio decoded into out_dir as WAVs, each
        keeping the patch's own encoding for builds (build.keep_encoding). Returns (got, replaced, files, skipped):
        replaced {the game's source: wem}, files {source or new clip: wav}, skipped: how many couldn't be decoded."""
        import struct
        from .addition import from_patch
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
                replaced[self.ix.resolve(fid)] = data
            except KeyError:
                job.say(f"stream {fid} is not in this game version; skipped")
        for sid, data in got.replaced.items():
            replaced.setdefault(sid, data)
        new = {src: data for *_, src, data in got.takes} | {src: data for _, src, data in got.own}
        for line in got.left:
            job.say(f"left out: {line}")
        if got.stale:
            job.say(f"{len(got.stale)} sounds of an older game version, which the game no longer has, left out")
        found = {**new, **replaced}
        if not found and got.settings:
            return got, replaced, {}, 0  # only settings
        if not found:
            raise EditorError(f"{patch_path.name} replaces, adds or sets nothing"
                              + (f" Audiodiver can bring in ({got.left[0]})" if got.left else ""))
        out_dir.mkdir(parents=True, exist_ok=True)
        files, job.total = {}, len(found)
        for i, (sid, data) in enumerate(sorted(found.items()), 1):
            wem_path, wav = out_dir / f"{sid}.wem", out_dir / f"{sid}.wav"
            wem_path.write_bytes(data)
            try:
                subprocess.run([wem.VGMSTREAM, "-o", str(wav), str(wem_path)], check=True, capture_output=True)
                keep_encoding(wav, data)
                files[sid] = wav
            except subprocess.CalledProcessError:
                job.say(f"source {sid}: can't decode its audio; skipped")
            finally:
                wem_path.unlink(missing_ok=True)
            job.step(f"Decoding {i} of {len(found)}", i)
        if not files:
            raise EditorError(f"{'The sound' if len(found) == 1 else f'None of the {len(found)} sounds'} in "
                              f"{patch_path.name} couldn't be decoded. Is its .stream file next to it?")
        return got, replaced, files, len(found) - len(files)

    def _fill_from_patch(self, p: Project, got, replaced: dict, files: dict) -> int:
        """Puts a patch's audio (_patch_audio) into a project: what it replaces, then what it adds, and its settings
        on the game's objects (a later import's go over an earlier one's). Returns how many slots it added or
        changed."""
        for sid, wav in files.items():
            if sid in replaced:
                self._set(p, sid, str(wav), label=f"imported {sid}")
        for oid, changes in got.settings.items():
            p.settings[oid] = {**p.settings.get(oid, {}), **changes}
        return self._take_in(p, got, files)

    # --- repatching (repatch.py): an existing mod rebuilt on the game as it is now
    @staticmethod
    def _repatch_root() -> Path:
        """Where repatched mods' projects go: the folder last chosen, else Documents/Audiodiver/Repatched."""
        from .repatch import documents
        return Path(load_settings().get("repatch_folder") or documents() / "Audiodiver" / "Repatched")

    def repatch_scan(self, path):
        """What repatching `path` (a .patch_N, a folder or a mod's ZIP) would take: its patches, and the name, icon
        and Arsenal id a manifest gives."""
        from .repatch import RepatchError, scan
        try:
            f = scan(path)
        except RepatchError as e:
            raise EditorError(str(e)) from None
        except OSError as e:
            raise EditorError(f"Can't read {Path(str(path)).name}: {os_error(e)}") from None
        return {"source": str(f.source), "name": f.name or "Repatched mod", "description": f.description,
                "guid": bool(f.guid), "icon": bool(f.icon), "manifest": bool(f.manifest), "zip": f.is_zip,
                "folder": str(self._repatch_root()),
                "patches": [{"key": p.key, "label": p.label, "other": self._not_audio(f, p.key)} for p in f.patches]}

    @staticmethod
    def _not_audio(found, key) -> list[str]:
        """What a patch holds besides audio, which a repatch leaves out ("2 string tables")."""
        from .game import WWISE_BANK, WWISE_DEP, WWISE_STREAM, toc_entries
        from .strings import STRINGS
        try:
            types = [tid for _, tid, *_ in toc_entries(found.read(key) or b"")]
        except Exception:  # noqa: BLE001 (a patch that can't be read says so when it is repatched)
            return []
        texts = sum(t == STRINGS for t in types)
        rest = sum(t not in (WWISE_BANK, WWISE_DEP, WWISE_STREAM, STRINGS) for t in types)
        return ([f"{texts} string table{'s' if texts != 1 else ''} (the game's text, like subtitles, which isn't supported yet)"] if texts else []) + \
               ([f"{rest} other file{'s' if rest != 1 else ''} (such as models and textures)"] if rest else [])

    def repatch(self, path, name="", folder="", biome_fix=False):
        """Rebuilds a mod on the game as it is now, as the one mod it was. Each of its patches is imported into a
        project of its own (in the mod's folder under the repatch folder, to change it further) and made again on the
        current game's banks; the new ZIP is the mod as it was, with a manifest's options, files and id kept
        (repatch.repackage), those patches in place of the old ones. Without a manifest it is a ZIP for HD2 Arsenal,
        one option per patch. A patch that can't be repatched stays as it was in a mod of several, and the result
        says so. biome_fix: the music is built with the Sound Systems Rebalanced Patch (biome.py), as a project's
        setting does it."""
        import tempfile
        from .arsenal import default_icon, name_problem, package
        from .build import PATCH, BuildError, icon_bytes, make_patch
        from .game import in_game_folder
        from .repatch import RepatchError, clean_name, repackage, scan
        self.require_game()
        try:
            f = scan(path)
        except RepatchError as e:
            raise EditorError(str(e)) from None
        name = str(name or "").strip() or f.name or "Repatched mod"
        if problem := name_problem(name):
            raise EditorError(f"The name: {problem}")
        root = Path(folder) if given(folder) else self._repatch_root()
        if not root.is_absolute():
            raise EditorError("Choose where repatched mods go (a full path)")
        if in_game_folder(root, self.ix.game.data):
            raise EditorError(f"{root} is inside the game's folder, and Audiodiver never writes there")
        if any(j.kind in ("build", "repatch") and j.state == "running" for j in self.jobs.values()):
            raise EditorError("A build is already running")
        if given(folder):
            save_settings(repatch_folder=str(root))
        if not isinstance(biome_fix, bool):
            raise EditorError("The biome music fix is on or off")
        several = len(f.patches) > 1

        def one(job, pt, home: Path, scratch: Path) -> dict:
            """A patch imported into a project at home and made again into scratch/out."""
            mod = clean_name(f"{name} {pt.label}") if several and pt.label else name
            home.mkdir(parents=True, exist_ok=True)
            p = Project(name=mod, path=home / f"{home.name}.audi", library=[], description=f.description,
                        guid=f.guid if f.guid and not several else str(uuid.uuid4()), biome_fix=biome_fix)
            if f.icon and (image := f.read(f.icon)):
                (home / f"icon{Path(f.icon).suffix.lower()}").write_bytes(image)
                p.icon = {"image": f"icon{Path(f.icon).suffix.lower()}"}
                try:
                    icon_bytes(p)
                except BuildError:
                    job.say("the mod's icon can't be read, so its project uses Audiodiver's icon")
                    p.icon = {}
            got, replaced, files, skipped = self._patch_audio(f.place(pt.key, scratch / "in"), home / "imported", job)
            with self.lock:
                added = self._fill_from_patch(p, got, replaced, files)
                self._tidy(p)
                self._tidy_cues(p)
                self._cover(p)
                p.save()

            def progress(doing, done=None, total=None):
                if total:
                    job.total = total
                job.step(doing, done)
            (scratch / "out").mkdir(parents=True)
            try:
                make_patch(p, self.ix, scratch / "out", log=job.say, step=progress)
            except BuildError as e:
                raise EditorError(str(e)) from None
            return {"label": pt.label, "project": str(p.path), "imported": sum(s in files for s in replaced),
                    "added": added, "skipped": skipped, "settings": len(got.settings), "left": got.left,
                    "stale": len(got.stale),
                    "other": self._not_audio(f, pt.key), "kept": "", "patch": str(scratch / "out" / PATCH)}

        def run(job):
            n = 1
            while (home := root / (name if n == 1 else f"{name} {n}")).exists():
                n += 1
            try:
                home.mkdir(parents=True)
            except OSError as e:
                raise EditorError(f"Can't make the folder {home}: {os_error(e)}") from None
            try:
                with tempfile.TemporaryDirectory(prefix="audiodiver-repatch-", ignore_cleanup_errors=True) as tmp:
                    parts, used = [], set()
                    for i, pt in enumerate(f.patches):
                        at = home
                        if several:
                            job.say(f"--- {pt.label or pt.key} ({i + 1} of {len(f.patches)})")
                            sub = clean_name(pt.label.replace("/", " ")) or clean_name(Path(pt.key).parent.name) or "Patch"
                            k = 1
                            while (sub if k == 1 else f"{sub} {k}").lower() in used:
                                k += 1
                            used.add((sub if k == 1 else f"{sub} {k}").lower())
                            at = home / (sub if k == 1 else f"{sub} {k}")
                        try:
                            parts.append(one(job, pt, at, Path(tmp) / str(i)))
                        except EditorError as e:
                            if not several:
                                raise
                            job.say(f"kept as it was: {e}")
                            if at != home:
                                shutil.rmtree(at, ignore_errors=True)
                            parts.append({"label": pt.label or pt.key, "kept": str(e), "other": [], "left": []})
                    if all(x["kept"] for x in parts):
                        raise EditorError(parts[0]["kept"])
                    job.step("Packing the ZIP")
                    zip_path = home / f"{name}.zip"
                    try:
                        if f.manifest:
                            repackage(f, zip_path, {pt.key: Path(x["patch"]) for pt, x in zip(f.patches, parts)
                                                    if not x["kept"]}, name)
                        else:  # no manifest: an Arsenal ZIP, each patch an option of its own
                            icon = Path(tmp) / "icon.png"
                            icon.write_bytes(default_icon())
                            options = []
                            for i, (pt, x) in enumerate(zip(f.patches, parts)):
                                if x["kept"]:  # as it was
                                    f.place(pt.key, Path(tmp) / str(i) / "kept")
                                    src = Path(tmp) / str(i) / "kept"
                                    for kept in src.iterdir():
                                        kept.rename(src / (PATCH + kept.name[len(Path(pt.key).name):]))
                                else:
                                    src = Path(x["patch"]).parent
                                options.append({"name": clean_name(pt.label.replace("/", " ")) or name, "description": "",
                                                "folder": src})
                            package(zip_path, name=name, guid=str(uuid.uuid4()), icon=icon, options=options)
                    except OSError as e:
                        raise EditorError(f"Can't write the ZIP into {home}: {os_error(e)}") from None
            except BaseException:
                if not any(home.rglob("*.audi")):
                    shutil.rmtree(home, ignore_errors=True)  # made just now, with nothing to show for it
                raise
            for x in parts:
                x.pop("patch", None)
            job.say(f"{zip_path} ({zip_path.stat().st_size / 1e6:.1f} MB)")
            return {"name": name, "zip": str(zip_path), "folder": str(home), "mb": round(zip_path.stat().st_size / 1e6, 1),
                    "kept_id": bool(f.manifest and f.guid), "manifest": bool(f.manifest), "parts": parts}
        return self._start("repatch", run, title=name)

    def _take_in(self, p: Project, got, files: dict) -> int:
        """Puts what a patch adds (addition.from_patch) into the project, each with its decoded audio (files: {clip:
        wav}): under the patch's own ids where they are free, else new ones. An addition the project has already
        (the same patch imported again) takes the new audio. Returns how many slots it added or changed."""
        from .addition import new_id
        taken = set(self.ix.taken) | p.made_ids() | {r.target for r in p.replacements}

        def free(i):
            if i in taken:
                i = new_id(taken)
            taken.add(i)
            return i

        def give(source, clip, label, gain=0.0):
            self._set(p, source, str(files[clip]), label=label)
            if gain:
                self._replacement(p, source).gain_db = max(GAIN_DB[0], min(GAIN_DB[1], gain))

        n, layers = 0, {}
        for lay, beside, gain in got.layers:
            have = next((a for a in p.additions if a.kind == "layer" and a.container == lay), None)
            layers[lay] = (have.container if have else free(lay), gain)
            if not have:
                p.additions.append(Addition("layer", container=layers[lay][0], beside=beside))
        for container, sound, clip, _wem in got.takes:
            if clip not in files:
                continue
            to, gain = layers.get(container, (container, 0.0))
            have = next((a for a in p.additions if a.kind == "take" and a.sound == sound), None)
            if not have:
                have = Addition("take", container=to, sound=free(sound), source=free(clip))
                p.additions.append(have)
            give(have.source, clip, f"imported take {clip}", gain)
            n += 1
        for sound, clip, _wem in got.own:
            if clip not in files:
                continue
            have = next((a for a in p.additions if a.kind == "own" and a.sound == sound), None)
            if not have:
                have = Addition("own", sound=sound, source=free(clip))
                p.additions.append(have)
            give(have.source, clip, f"imported {clip}")
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
        """A renderer for the game's own music ("game") or the music as the open project changes it ("mine")."""
        from .render import Renderer
        self.require_game()
        cue = self.catalog.cm.cues.get(int(cue_id)) if str(cue_id).isdigit() else None
        if not cue:
            raise EditorError(f"{cue_id} is not a piece of music. Only music has segments to mix and play through.")
        mine, overrides = {}, {}
        if side == "mine":
            mine, overrides = self._mine(), self._need_project().segment_overrides
        return Renderer(cue, self.vanilla_wav, mine, overrides)

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

    def play_through(self, cue_id, side="game", variants=None, loops=1):
        """Renders the whole cue to a preview file. Returns its path, its length and its marks: where each segment
        starts and ends, by name, and where each of its clips plays (render.Renderer.layout)."""
        from . import render
        r = self._renderer(cue_id, side)
        names = {s["segment"]: s["name"] for s in self.catalog.cue(int(cue_id))["segments_detail"]}
        try:
            v = choices(variants)
            loops = loop_count(loops)
            layout = r.layout(v, loops)
            out = CACHE_DIR / "render" / f"{cue_id}-{side}.wav"
            render.write(out, r.stream(v, int(loops), layout), "preview")
        except (render.RenderError, subprocess.CalledProcessError) as e:
            raise EditorError(str(e)) from None
        marks = layout[3]
        for m in marks:
            m["name"] = names.get(m["segment"], "")
        return {"path": str(out), "duration_ms": round(layout[2], 1), "marks": marks, "random": r.has_random()}

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
            raise EditorError("That line isn't one of the game's subtitles") from None
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
            raise EditorError("That line isn't in the game's text") from None

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
            raise EditorError("Those aren't lines of the game's text") from None

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
            raise EditorError("Nothing to export, because the export list is empty")
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
# encoded audio at the next build. The game index and the logs are not offered for clearing.
CACHE_KINDS = {"previews": ("preview", "render", "peaks"), "encoded": ("wem", "akd")}


def cache_info():
    """{folder, previews, encoded}: where the cache lives and how many bytes each clearable part takes."""
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
