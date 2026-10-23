"""The `.audi` project: what each audio file replaces and how, never which archives to patch.

    {
      "audiodiver": 1,
      "name": "Dune OST Overhaul", "guid": "...", "version": 4,
      "description": "",
      "icon": {"image": "art/cover.jpg", "border": 12, "border_color": "#ffd400", "radius": 40},
      "build_folder": "",
      "loudness_analysis": false,
      "every_bank": false,
      "imported_banks": ["2954416524880961046"],
      "built_for": "25988413",
      "library": ["deploy/loadout", "set:weapons/support/ac-8-autocannon", "archive:6ad7cc21015a5f85"],
      "replacements": [{"target": "15204189411560306296", "audio": "replacers/x.wav", "label": "...",
                        "gain_db": 0, "fit_timing": true},
                       {"target": "5938561", "audio": "", "label": "", "gain_db": 0, "fit_timing": true,
                        "silence": true}],
      "segment_overrides": {"967132321": {"exit_marker": 6000.0}},
      "texts": [{"table": "2060271984843282606", "id": 652636, "text": "{0.00->3.85}Defeat is <c=FFFFE900>but</c>…",
                 "was": "{0.00->3.85}Defeat is but…"}]
    }

A target is a 32-bit Wwise source id or a 64-bit stream file id, stored as a string (JavaScript can't hold 64-bit
ints). Audio paths are relative to the project file. A replacement with "silence" plays Audiodiver's built-in silence
(audio.silence_wav) instead of a file. Archives come from the audio index at build time, so a project survives game
updates that move or copy banks.

library is what the project works on: the pieces of music, sound sets and archives added to it from the Library
(library.py; an Index item by its id, an archive as "archive:<name>"), in the order they were added. The Editor
shows these and nothing else. A project file without the key is from before projects had a list, and the editor
gives it one from its replacements when it opens it.

A sound is often in many banks (a weapon's clip in every weapon's bank that plays it). The build puts a replaced
sound into the project's banks: those the mods imported into it patched ("imported_banks"), else those of what its
list holds, else every bank that has it (build.reach). "every_bank" puts it into every bank that has it: the new
audio then plays wherever the game uses the sound, and the mod is bigger. Both keys are left out while unused.

name, guid, description and icon are what HD2 Arsenal shows and keys the mod by (arsenal.py). The icon is the
"image" (relative to the project file, like the audio) fitted to Arsenal's 540x540 PNG, or Audiodiver's default icon
without one, in a frame (arsenal.icon_frame; keys left out take the defaults). Icons were once made from text, and
older projects store that text (and an image as a plain path): loading keeps only the image and the frame.

build_folder is where builds go, relative to the project file (absolute on another drive); "" is the build folder
next to it. built_for is the game version its last build was made on (Steam's build id), so the Build tab can say
when the game updated since: a build carries whole banks, and their copies of what many banks share go stale.
built_from is a fingerprint of what that build was made from (editor.build_inputs), so the tab bar can say when the
project changed since.

texts are lines of the game's text the project changes (strings.py): the table (its file id: one table per
language), the string's id, the new text, and the text it had when it was changed ("was"), so a game update that
changes the line can be noticed. The key is left out while there are none, so older files stay as they were.

additions are audio the project adds to the game's (addition.py), each under ids Audiodiver made for it:

      "additions": [{"kind": "take", "container": "351417743", "sound": "368266363", "source": "149317725"},
                    {"kind": "layer", "container": "838227169", "beside": "351417743"},
                    {"kind": "take", "container": "838227169", "sound": "...", "source": "..."},
                    {"kind": "own", "sound": "5565038", "source": "..."}]

A take is a new Sound ("sound") in a container: the game's, or a layer's. A layer is a new container ("container")
that plays with one of the game's ("beside"). "own" gives one of the game's Sounds a clip of its own. A take's or an
own clip's audio is the replacement whose target is its "source", like any other: an addition without one adds
nothing (the editor removes it), and a layer without takes neither. The key is left out while there are none.

settings are an imported mod's settings on the game's objects (addition.from_patch): per object (a Sound, a
container, a MusicTrack), the props its patch set differently from the game (prop ids as bank v154 numbers them;
on an object other banks share too, those a mod sets: bank.MIX_PROPS). Files imported before 2026-10-21 can have
null for one the patch didn't have: the build leaves those out, as the game added them after the mod was made. The
build puts them on the game's objects as they are now; a replacement's Make-Up Gain or silence, when set, goes on
top. The key is left out while there are none:

      "settings": {"372068234": {"5": 12.0, "12": 0.0}}

notes are the project's notes on what the Audio Editor shows, in Markdown, keyed as notes.py says (the global notes,
for every project, are in notes.py's file). A note that isn't valid is left out when the file opens. The key is left
out while there are none:

      "notes": {"clip:15204189411560306296": "## Drop\\n- needs a quieter take", "item:deploy/loadout": "Done."}
"""
import json
import math
import os
import time
import uuid
from dataclasses import dataclass, field, asdict
from pathlib import Path

from .arsenal import FRAME_KEYS, icon_frame, name_problem
from .notes import tidy as tidy_notes

FORMAT = 1
GAIN_DB = (-12.0, 12.0)  # Make-Up Gain, as the details panel's slider offers it


def write_whole(path, text: str, tries=5):
    """Writes a file whole or not at all: a hidden file beside it, then a rename over it, so a crash or a full disk
    mid-write leaves the old file as it was (writing in place left it empty). Retries a moment while another program
    (Syncthing, a virus scanner) holds the file."""
    path = Path(path)
    tmp = path.with_name(f".{path.name}.saving")
    try:
        for n in range(tries):
            try:
                with open(tmp, "w", encoding="utf-8") as f:
                    f.write(text)
                    f.flush()
                    os.fsync(f.fileno())
                os.replace(tmp, path)
                return
            except PermissionError:
                if n == tries - 1:
                    raise
                time.sleep(0.05 * (n + 1))
    finally:
        tmp.unlink(missing_ok=True)


class ProjectFormatError(ValueError):
    """A file that is JSON but not a project this version can open. Its message completes "<file> …": "isn't an
    Audiodiver project", "is damaged (its name)", "was made by a newer version…"."""
ICON_KEYS = ("image", *FRAME_KEYS)
OVERRIDE_KEYS = {"entry_marker", "exit_marker"}
LEGACY_SILENCE = "silence (skipped).wav"  # what Skip wrote into the project folder before silence was built in


@dataclass
class Replacement:
    target: int
    audio: str               # relative to the project file; "" for silence
    label: str = ""
    gain_db: float = 0.0     # Make-Up Gain on the Sounds/MusicTracks that play it
    fit_timing: bool = True  # fit the track/segment timing to the new clip's length
    silence: bool = False    # plays the built-in silence: with fit_timing the game moves straight on, without it
                             # the slot stays silent for as long as the game's audio would play


@dataclass
class TextEdit:
    table: int   # the string table's file id
    id: int      # the string's id in it
    text: str    # the new text, markup and subtitle timing included
    was: str     # the game's text when it was changed


@dataclass
class Addition:
    kind: str           # "take", "layer" or "own"
    container: int = 0  # take: the container it is a take of (the game's or a layer's); layer: its own id
    sound: int = 0      # take: its new Sound; own: the game's Sound that gets a clip of its own
    source: int = 0     # take and own: the new clip, the target of the replacement that holds its audio
    beside: int = 0     # layer: the game's container it plays with

    KINDS = {"take": ("container", "sound", "source"), "layer": ("container", "beside"), "own": ("sound", "source")}

    def ids(self) -> list[int]:
        """The ids Audiodiver made for it."""
        return {"take": [self.sound, self.source], "layer": [self.container], "own": [self.source]}[self.kind]


@dataclass
class Project:
    name: str
    guid: str = field(default_factory=lambda: str(uuid.uuid4()))
    version: int = 1
    icon: dict = field(default_factory=dict)
    loudness_analysis: bool = False
    every_bank: bool = False  # a replaced sound goes into every bank that has it, not only the project's (build.reach)
    imported_banks: list[int] = field(default_factory=list)  # the banks the mods imported into it patched
    built_for: str = ""     # the game version (Game.version) its last build was made on; "" before one
    built_from: str = ""    # a fingerprint of what its last build was made from (editor.build_inputs); "" before one
    replacements: list[Replacement] = field(default_factory=list)
    segment_overrides: dict[int, dict] = field(default_factory=dict)
    path: Path | None = None  # where it was loaded from / saved to
    description: str = ""     # the manifest's Description, exactly as written
    build_folder: str = ""    # where builds go, as the project stores it; "" for the default
    library: list[str] | None = None  # what the project works on; None: a file from before there was a list
    texts: list[TextEdit] = field(default_factory=list)  # lines of the game's text it changes
    additions: list[Addition] = field(default_factory=list)  # audio it adds to the game's (addition.py)
    settings: dict[int, dict[int, float | None]] = field(default_factory=dict)  # an imported mod's, on the game's objects
    notes: dict[str, str] = field(default_factory=dict)  # the project's notes ({key: Markdown}, notes.py)
    repairs: list[str] = field(default_factory=list, repr=False, compare=False)  # damaged values opening put right (not saved)

    def added(self) -> dict[int, Addition]:
        """{new clip: the take or own clip it is} of the additions."""
        return {a.source: a for a in self.additions if a.kind in ("take", "own")}

    def made_ids(self) -> set[int]:
        """Every id Audiodiver made for this project's additions."""
        return {i for a in self.additions for i in a.ids()}

    def file(self, rel) -> Path:
        """A path the project stores (relative to the project file, or absolute) as a full path."""
        return (self.path.parent if self.path else Path.cwd()) / rel

    def default_build_dir(self) -> Path:
        return self.file("build")

    def build_dir(self) -> Path:
        """Where builds go: the folder chosen for this project, or the build folder next to the project file."""
        if not self.build_folder:
            return self.default_build_dir()
        return Path(os.path.normpath(self.file(self.build_folder)))  # "../builds" without the dots

    def audio_path(self, r: Replacement) -> Path:
        if r.silence:
            from .audio import silence_wav
            return silence_wav()
        return self.file(r.audio)

    def icon_path(self) -> Path | None:
        """The image the icon is made from, or None when the mod takes Audiodiver's default icon."""
        return self.file(self.icon["image"]) if self.icon.get("image") else None

    def problems(self) -> list[str]:
        out, seen = [], {}
        if problem := name_problem(self.name):
            out.append(f'name "{self.name}": {problem}')
        if (icon := self.icon_path()) and not icon.exists():
            out.append(f"icon: image not found ({icon})")
        try:
            icon_frame(self.icon)
        except ValueError as e:  # only a hand-edited file gets here: the editor checks what it saves
            out.append(f"icon: {e}")
        for r in self.replacements:
            name = r.label or ("silence" if r.silence else r.audio)
            if r.target in seen:
                out.append(f"{name}: same target as {seen[r.target]}")
            seen[r.target] = name
            if not r.silence and not self.audio_path(r).exists():
                out.append(f"{name}: its audio file wasn't found ({os.path.normpath(self.audio_path(r))})")
        for seg, o in self.segment_overrides.items():
            if set(o) - OVERRIDE_KEYS:
                out.append(f"segment {seg}: unknown overrides {sorted(set(o) - OVERRIDE_KEYS)}")
        try:
            uuid.UUID(self.guid)
        except (ValueError, TypeError, AttributeError):
            out.append("mod id: damaged in the project file (Make a new id, on the Project tab)")
        return out

    # --- file I/O
    @classmethod
    def load(cls, path) -> "Project":
        path = Path(path)
        d = json.loads(path.read_text(encoding="utf-8-sig"))  # -sig: a file an editor saved with a BOM opens too
        fmt = d.get("audiodiver") if isinstance(d, dict) else None
        if fmt != FORMAT:
            if isinstance(fmt, int) and fmt > FORMAT:
                raise ProjectFormatError("was made by a newer version of Audiodiver: update Audiodiver to open it")
            raise ProjectFormatError("isn't an Audiodiver project")
        return cls.from_json(d, path)

    @classmethod
    def from_json(cls, d: dict, path=None) -> "Project":
        """The project a to_json() dict describes (a loaded file, or an undo step). A part of the wrong kind raises
        ProjectFormatError naming it, so a damaged file is refused when it is opened, not halfway through an edit.
        Fields a newer version added are left out; numbers out of range are brought into it."""
        def need(ok, what):
            if not ok:
                raise ProjectFormatError(f"is damaged ({what})")

        repairs = []

        def number(v, default, lo, hi, what="", whole=False):
            try:
                x = math.nan if isinstance(v, bool) else float(v)  # true isn't 1 dB
            except (TypeError, ValueError):
                x = math.nan
            fixed = max(lo, min(hi, x)) if math.isfinite(x) else default
            if whole:
                fixed = round(fixed)
            if what and fixed != x:
                repairs.append(what)
            return fixed

        def kind(d, key, typ, default, what):
            """d[key] when it is a typ; else the default (a value of the wrong kind is a repair; none at all isn't)."""
            v = d.get(key, default)
            if isinstance(v, typ):
                return v
            repairs.append(what)
            return default

        if not isinstance(d, dict):
            raise ProjectFormatError("isn't an Audiodiver project")
        need(isinstance(d.get("name"), str), "its name")
        need(isinstance(d.get("replacements", []), list), "its replacements")
        reps = []
        for r in d.get("replacements", []):
            need(isinstance(r, dict) and "target" in r, "a replacement")
            try:
                target = int(r["target"])
            except (TypeError, ValueError, OverflowError):
                raise ProjectFormatError("is damaged (a replacement's sound id)") from None
            audio = r.get("audio") if isinstance(r.get("audio"), str) else ""
            silence = r.get("silence") is True or Path(audio).name == LEGACY_SILENCE  # what Skip wrote: now silence
            # a repair names the slot by its new audio, as the screen does
            of = (r.get("label") if isinstance(r.get("label"), str) and r["label"].strip() else "") \
                or Path(audio).stem or f"sound {target}"
            reps.append(Replacement(target=target, audio="" if silence else audio,
                                    label=kind(r, "label", str, "", f"the label of {of}"),
                                    gain_db=number(r.get("gain_db", 0.0), 0.0, *GAIN_DB, f"the Make-Up Gain of {of}"),
                                    fit_timing=kind(r, "fit_timing", bool, True, f"Fit timing for {of}"), silence=silence))
        icon = d.get("icon") or {}
        if isinstance(icon, str):  # an image path, before the icon had a frame
            icon = {"image": icon}
        overrides = d.get("segment_overrides") or {}
        need(isinstance(icon, dict), "its icon")
        need(isinstance(overrides, dict) and all(isinstance(o, dict) for o in overrides.values()), "its cue points")
        texts = d.get("texts", [])
        need(isinstance(texts, list) and all(isinstance(t, dict) and {"table", "id", "text"} <= set(t) for t in texts),
             "its text changes")
        settings = d.get("settings", {})
        need(isinstance(settings, dict) and all(isinstance(s, dict) and all(
            v is None or isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) for v in s.values())
            for s in settings.values()), "its settings from a mod")
        adds = d.get("additions", [])
        need(isinstance(adds, list) and all(isinstance(a, dict) and set(Addition.KINDS.get(a.get("kind"), ("?",))) <= set(a)
                                            for a in adds), "its added audio")

        notes, dropped = tidy_notes(d.get("notes"))
        if dropped:
            repairs.append("a note")

        def points(o):
            """A segment's cue points: one that isn't a number goes (the automatic spot is used), and is a repair."""
            out = {}
            for k, v in o.items():
                if (x := number(v, None, 0, 3.6e6, "a cue point")) is not None:
                    out[k] = x
            return out

        try:
            p = cls(name=d["name"], guid=str(d.get("guid") or ""),
                       version=int(number(d.get("version", 1), 1, 1, 99999, "the version", whole=True)),
                       icon={k: v for k, v in icon.items() if k in ICON_KEYS},
                       loudness_analysis=kind(d, "loudness_analysis", bool, False, "Loudness analysis"), replacements=reps,
                       every_bank=kind(d, "every_bank", bool, False, "Banks"),
                       imported_banks=[int(b) for b in kind(d, "imported_banks", list, [], "the imported mods' banks")],
                       built_for=kind(d, "built_for", str, "", "the game version of the last build"),
                       built_from=kind(d, "built_from", str, "", "what the last build was made from"),
                       segment_overrides={int(k): kept for k, o in overrides.items() if (kept := points(o))}, path=path,
                       description=kind(d, "description", str, "", "the description"),
                       build_folder=kind(d, "build_folder", str, "", "the build folder"),
                       library=[str(i) for i in d["library"]] if isinstance(d.get("library"), list) else None,
                       texts=[TextEdit(int(t["table"]), int(t["id"]), str(t["text"]), str(t.get("was", "")))
                              for t in texts],
                       additions=[Addition(a["kind"], **{k: int(a[k]) for k in Addition.KINDS[a["kind"]]}) for a in adds],
                       settings={int(o): {int(k): None if v is None else float(v) for k, v in s.items()}
                                 for o, s in settings.items() if s},
                       notes=notes)
            p.repairs = list(dict.fromkeys(repairs))  # not saved: what opening it put right (project_state says it)
            return p
        except (TypeError, ValueError, OverflowError):
            raise ProjectFormatError("is damaged (a cue point, a text change, added audio or a setting)") from None

    def to_json(self) -> dict:
        def rep(r):
            out = {**asdict(r), "target": str(r.target)}
            if not r.silence:
                del out["silence"]  # files stay as they were for everything but silence
            return out
        return {
            "audiodiver": FORMAT, "name": self.name, "guid": self.guid, "version": self.version,
            "description": self.description, "icon": dict(self.icon), "build_folder": self.build_folder,
            "loudness_analysis": self.loudness_analysis,
            **({"every_bank": True} if self.every_bank else {}),
            **({"imported_banks": [str(b) for b in self.imported_banks]} if self.imported_banks else {}),
            **({"built_for": self.built_for} if self.built_for else {}),
            **({"built_from": self.built_from} if self.built_from else {}),
            **({"library": list(self.library)} if self.library is not None else {}),
            "replacements": [rep(r) for r in self.replacements],
            "segment_overrides": {str(k): v for k, v in self.segment_overrides.items()},
            **({"texts": [{"table": str(t.table), "id": t.id, "text": t.text, "was": t.was} for t in self.texts]}
               if self.texts else {}),
            **({"additions": [{"kind": a.kind, **{k: str(getattr(a, k)) for k in Addition.KINDS[a.kind]}}
                              for a in self.additions]} if self.additions else {}),
            **({"settings": {str(o): {str(k): v for k, v in s.items()} for o, s in self.settings.items()}}
               if self.settings else {}),
            **({"notes": dict(self.notes)} if self.notes else {}),
        }

    def save(self, path=None):
        self.path = Path(path or self.path)
        write_whole(self.path, json.dumps(self.to_json(), indent=2) + "\n")


def replacements_from_folder(folder, relative_to, skip=()) -> list[Replacement]:
    """A replacement for every audio file under folder whose name starts with an id (`<id>_<name>.wav`)."""
    folder, out = Path(folder), []
    for f in sorted(folder.rglob("*")):
        if f.suffix.lower() not in {".wav", ".flac", ".mp3", ".ogg"} or f.name in skip:
            continue
        head = f.name.split("_")[0].split(".")[0]
        if not head.isdigit():
            continue
        rel = Path(f.resolve()).relative_to(Path(relative_to).resolve(), walk_up=True)
        out.append(Replacement(target=int(head), audio=rel.as_posix(),
                               label=f.relative_to(folder).with_suffix("").as_posix()))
    return out
