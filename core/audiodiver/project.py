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
audio then plays wherever the game uses the sound, and the mod is bigger. Added audio (new takes, layers, a sound's
own clip) and settings go into every bank with a copy of what they change, as the game plays the copy it loaded
first; "project_banks_only" keeps them to the project's banks too (build.own_banks), for a smaller mod in which
another bank's copy can play the original. These keys are left out while unused.

name, guid, description and icon are what HD2 Arsenal shows and keys the mod by (arsenal.py). The icon is the
"image" (relative to the project file, like the audio) fitted to Arsenal's 540x540 PNG, or Audiodiver's default icon
without one, in a frame (arsenal.icon_frame; keys left out take the defaults). Icons were once made from text, and
older projects store that text (and an image as a plain path): loading keeps only the image and the frame.

build_folder is where builds go, relative to the project file (absolute on another drive); "" is the build folder
next to it. "patch_files": true makes each build also save the patch files in a folder named like its ZIP, for
packing the mod another way (left out while unused). built_for is the game version its last build was made on (Steam's build id), so the Build tab can say
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

curves_off are the clips that lose the game's volume curves and fades on music tracks, by target as a replacement names
it. curves are an imported mod's curves on the game's music tracks, by track, each [clip, kind, points, source]
(music.ClipCurve): the build puts them in place of the game's. Each key is left out while empty:

      "curves_off": ["41628611"], "curves": {"990527808": [[0, 0, [[0.0, 0.0, 4], [9.5, -0.2, 4]], 41628611]]}

filters are Low-Pass and High-Pass on sounds, by target, each [low-pass, high-pass] from 0 to 100, with new audio or
without: the build adds them to what the Sounds and music tracks that play the clip have. The key is left out while
there are none:

      "filters": {"15204189411560306296": [40, 0]}

radio_off are the voices with their radio filter off (radio.FAMILIES), and radio_quieter turns those voices down to
about the radio's level. The build then carries the game's Init bank with those changes (radio.py). Each key is left
out while unused:

      "radio_off": ["eagle", "mission_control"], "radio_quieter": true

gains are Make-Up Gain on sounds that keep the original audio, by target as a replacement names it: the build puts
it on the Sounds and music tracks that play the clip and leaves the clip as it is. While a slot has new audio, the
new audio's own gain applies instead, and the entry stays for when the new audio is removed. The key is left out
while there are none:

      "gains": {"15204189411560306296": -6.0}

notes are the project's notes on what the Audio tab shows, in Markdown, keyed as notes.py says (the global notes,
for every project, are in notes.py's file). A note that isn't valid is left out when the file opens. The key is left
out while there are none:

      "notes": {"clip:15204189411560306296": "## Drop\\n- needs a quieter take", "item:deploy/loadout": "Done."}

soundtrack is how pieces of music play (soundtrack.py), by playlist: the game's order without some items, a song
or whole tracks in an order of their own, silence, or another piece; and a level for the whole piece. A playlist
set to none of that isn't listed, and the key is left out while none is:

      "soundtrack": {"841554794": {"mode": "song", "segments": ["37386235", "524665816"], "gain_db": -3.0},
                     "213690393": {"mode": "same", "follows": "841554794"}}

tabs are the window's tabs the project shows of those it can hide (TABS: the Audio, Soundtrack and Text tabs). A new
project takes Settings' choice; a file without the key shows what Settings says:

      "tabs": ["editor", "soundtrack"]
"""
import json
import math
import os
import time
import uuid
from dataclasses import dataclass, field, asdict
from pathlib import Path

from .arsenal import FRAME_KEYS, icon_frame, name_problem
from .i18n import N_, tr
from .notes import tidy as tidy_notes
from .radio import FAMILIES
from .soundtrack import Piece

FORMAT = 1
GAIN_DB = (-96.0, 96.0)  # Make-Up Gain, as the details panel's slider offers it
FILTER_RANGE = (0, 100)  # Low-Pass and High-Pass
FADE_MS = (0.0, 600_000.0)  # a fade baked into new audio
TABS = ("editor", "soundtrack", "text")  # the window's tabs a project can hide, in the tab bar's order


def tab_list(v) -> list[str] | None:
    """The tabs a project shows, in the bar's order; None for a value that isn't a list of them."""
    if not isinstance(v, list) or not all(isinstance(t, str) and t in TABS for t in v):
        return None
    return [t for t in TABS if t in v]


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


# why a file that is JSON isn't a project this version can open: (said of the file, said of the project in a pack)
FORMAT_PROBLEMS = {
    "not a project": (N_("{file} isn't an Audiodiver project"), N_("The project in {pack} isn't an Audiodiver project")),
    "newer": (N_("{file} was made by a newer version of Audiodiver. Update Audiodiver to open it"),
              N_("The project in {pack} was made by a newer version of Audiodiver. Update Audiodiver to open it")),
    "name": (N_("{file} is damaged (the name)"), N_("The project in {pack} is damaged (the name)")),
    "replacements": (N_("{file} is damaged (the replacements)"), N_("The project in {pack} is damaged (the replacements)")),
    "replacement": (N_("{file} is damaged (a replacement)"), N_("The project in {pack} is damaged (a replacement)")),
    "sound ID": (N_("{file} is damaged (a replacement's sound ID)"),
                 N_("The project in {pack} is damaged (a replacement's sound ID)")),
    "icon": (N_("{file} is damaged (the icon)"), N_("The project in {pack} is damaged (the icon)")),
    "cue points": (N_("{file} is damaged (the cue points)"), N_("The project in {pack} is damaged (the cue points)")),
    "texts": (N_("{file} is damaged (the text changes)"), N_("The project in {pack} is damaged (the text changes)")),
    "settings": (N_("{file} is damaged (the settings from a mod)"),
                 N_("The project in {pack} is damaged (the settings from a mod)")),
    "gains": (N_("{file} is damaged (the Make-Up Gain on the original audio)"),
              N_("The project in {pack} is damaged (the Make-Up Gain on the original audio)")),
    "curves": (N_("{file} is damaged (the volume curves)"), N_("The project in {pack} is damaged (the volume curves)")),
    "additions": (N_("{file} is damaged (the added audio)"), N_("The project in {pack} is damaged (the added audio)")),
    "soundtrack": (N_("{file} is damaged (the soundtrack)"), N_("The project in {pack} is damaged (the soundtrack)")),
    "values": (N_("{file} is damaged (a cue point, a text change, added audio or a setting)"),
               N_("The project in {pack} is damaged (a cue point, a text change, added audio or a setting)")),
}


class ProjectFormatError(ValueError):
    """A file that is JSON but not a project this version can open, for one of FORMAT_PROBLEMS. about(file) says so
    in a whole sentence ("drop.audi is damaged (the name)"), in_pack(pack) of the project in a pack. The message
    itself is the English that completes "<file> …" ("is damaged (the name)"), for the command line, which puts the
    file's name before it."""

    def __init__(self, problem: str):
        self.problem = problem
        super().__init__(FORMAT_PROBLEMS[problem][0].removeprefix("{file} "))

    def __reduce__(self):  # made again from the problem (a copy, a pickle), not from the message
        return type(self), (self.problem,)

    def about(self, file) -> str:
        return tr(FORMAT_PROBLEMS[self.problem][0]).format(file=file)

    def in_pack(self, pack) -> str:
        return tr(FORMAT_PROBLEMS[self.problem][1]).format(pack=pack)


ICON_KEYS = ("image", *FRAME_KEYS)
OVERRIDE_KEYS = {"entry_marker", "exit_marker"}
LEGACY_SILENCE = "silence (skipped).wav"  # what Skip wrote into the project folder before silence was built in


@dataclass
class Replacement:
    target: int
    audio: str               # relative to the project file; "" for silence
    label: str = ""
    gain_db: float = 0.0     # Make-Up Gain added to that of the Sounds/MusicTracks that play it
    fit_timing: bool = True  # fit the track/segment timing to the new clip's length
    silence: bool = False    # plays the built-in silence: with fit_timing the game moves straight on, without it
                             # the slot stays silent for as long as the game's audio would play
    fade_in_ms: float = 0.0  # fades baked into the audio (audio.faded)
    fade_out_ms: float = 0.0


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
    project_banks_only: bool = False  # added audio and settings keep to the project's banks too (build.own_banks)
    patch_files: bool = False  # each build also saves the patch files beside the ZIP (build.build)
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
    gains: dict[int, float] = field(default_factory=dict)  # Make-Up Gain on the original audio, by target
    filters: dict[int, list[int]] = field(default_factory=dict)  # [low-pass, high-pass] on a sound, by target
    radio_off: set[str] = field(default_factory=set)  # the voices without their radio filter (radio.FAMILIES)
    radio_quieter: bool = False  # those voices turned down to about the radio's level
    curves_off: set[int] = field(default_factory=set)  # the clips without the game's volume curves, by target
    curves: dict[int, list] = field(default_factory=dict)  # an imported mod's, on the game's music tracks
    notes: dict[str, str] = field(default_factory=dict)  # the project's notes ({key: Markdown}, notes.py)
    soundtrack: dict[int, Piece] = field(default_factory=dict)  # how pieces of music play, by playlist (soundtrack.py)
    tabs: list[str] | None = None  # the hideable tabs it shows (TABS); None: as Settings says
    repairs: list[str] = field(default_factory=list, repr=False, compare=False)  # damaged values opening put right (not saved)

    def added(self) -> dict[int, Addition]:
        """{new clip: the take or own clip it is} of the additions."""
        return {a.source: a for a in self.additions if a.kind in ("take", "own")}

    def additions_json(self) -> list[dict]:
        """The additions as the project file writes them (and project_state sends them)."""
        return [{"kind": a.kind, **{k: str(getattr(a, k)) for k in Addition.KINDS[a.kind]}} for a in self.additions]

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

    def heard_path(self, r: Replacement) -> Path:
        """What a replacement plays: its audio with its fades in it."""
        path = self.audio_path(r)
        if r.silence or not (r.fade_in_ms or r.fade_out_ms):
            return path
        from .audio import faded
        return faded(path, r.fade_in_ms, r.fade_out_ms)

    def icon_path(self) -> Path | None:
        """The image the icon is made from, or None when the mod takes Audiodiver's default icon."""
        return self.file(self.icon["image"]) if self.icon.get("image") else None

    def problem_list(self, exists=None) -> list[tuple[str, str]]:
        """What stops a build, each as (kind, sentence). The app goes by the kind: the Project tab fixes "name",
        "icon" (a frame value a hand-edited file broke), "icon_missing" (the image is gone) and "mod_id";
        "missing_file" is an audio file the project uses that is gone; "duplicate" and "overrides" are the others.
        exists: whether an audio file is there, when the caller has looked already (project_state)."""
        out, seen = [], {}
        exists = exists or Path.exists
        if problem := name_problem(self.name):
            out.append(("name", problem))
        if (icon := self.icon_path()) and not icon.exists():
            out.append(("icon_missing", tr("icon: image not found ({path})").format(path=icon)))
        try:
            icon_frame(self.icon)
        except ValueError as e:  # only a hand-edited file gets here: the editor checks what it saves
            out.append(("icon", tr("icon: {problem}").format(problem=e)))
        for r in self.replacements:
            name = r.label or (tr("silence") if r.silence else r.audio)
            if r.target in seen:
                out.append(("duplicate", tr("{name}: same target as {other}").format(name=name, other=seen[r.target])))
            seen[r.target] = name
            if not r.silence and not exists(self.audio_path(r)):
                out.append(("missing_file", tr("{name}: the audio file wasn't found ({path})").format(
                    name=name, path=os.path.normpath(self.audio_path(r)))))
        for seg, o in self.segment_overrides.items():
            if set(o) - OVERRIDE_KEYS:
                out.append(("overrides", tr("segment {id}: unknown overrides {keys}").format(
                    id=seg, keys=sorted(set(o) - OVERRIDE_KEYS))))
        try:
            uuid.UUID(self.guid)
        except (ValueError, TypeError, AttributeError):
            out.append(("mod_id", tr("mod ID: damaged in the project file (Make a New ID, on the Project tab)")))
        return out

    def problems(self) -> list[str]:
        """What stops a build, in sentences (problem_list without the kinds)."""
        return [text for _, text in self.problem_list()]

    # --- file I/O
    @classmethod
    def load(cls, path) -> "Project":
        path = Path(path)
        d = json.loads(path.read_text(encoding="utf-8-sig"))  # -sig: a file an editor saved with a BOM opens too
        fmt = d.get("audiodiver") if isinstance(d, dict) else None
        if fmt != FORMAT:
            if isinstance(fmt, int) and fmt > FORMAT:
                raise ProjectFormatError("newer")
            raise ProjectFormatError("not a project")
        return cls.from_json(d, path)

    @classmethod
    def from_json(cls, d: dict, path=None) -> "Project":
        """The project a to_json() dict describes (a loaded file, or an undo step). A part of the wrong kind raises
        ProjectFormatError naming it, so a damaged file is refused when it is opened, not halfway through an edit.
        Fields a newer version added are left out; numbers out of range are brought into it."""
        def need(ok, problem):
            if not ok:
                raise ProjectFormatError(problem)

        repairs = []  # what opening it put right, each named whole ("the Make-Up Gain of drop"): the app lists them

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
            raise ProjectFormatError("not a project")
        need(isinstance(d.get("name"), str), "name")
        need(isinstance(d.get("replacements", []), list), "replacements")
        reps = []
        for r in d.get("replacements", []):
            need(isinstance(r, dict) and "target" in r, "replacement")
            try:
                target = int(r["target"])
            except (TypeError, ValueError, OverflowError):
                raise ProjectFormatError("sound ID") from None
            audio = r.get("audio") if isinstance(r.get("audio"), str) else ""
            silence = r.get("silence") is True or Path(audio).name == LEGACY_SILENCE  # what Skip wrote: now silence
            # a repair names the slot by its new audio, as the screen does, else by its sound ID
            of = (r.get("label") if isinstance(r.get("label"), str) and r["label"].strip() else "") or Path(audio).stem
            if of:
                label_of, gain_of, fit_of, fade_of = (tr("the label of {name}"), tr("the Make-Up Gain of {name}"),
                                                      tr("Fit timing for {name}"), tr("the fades of {name}"))
            else:
                label_of, gain_of, fit_of, fade_of = (tr("the label of sound {id}"), tr("the Make-Up Gain of sound {id}"),
                                                      tr("Fit timing for sound {id}"), tr("the fades of sound {id}"))
            reps.append(Replacement(target=target, audio="" if silence else audio,
                                    label=kind(r, "label", str, "", label_of.format(name=of, id=target)),
                                    gain_db=number(r.get("gain_db", 0.0), 0.0, *GAIN_DB, gain_of.format(name=of, id=target)),
                                    fit_timing=kind(r, "fit_timing", bool, True, fit_of.format(name=of, id=target)),
                                    silence=silence,
                                    fade_in_ms=number(r.get("fade_in_ms", 0.0), 0.0, *FADE_MS, fade_of.format(name=of, id=target)),
                                    fade_out_ms=number(r.get("fade_out_ms", 0.0), 0.0, *FADE_MS, fade_of.format(name=of, id=target))))
        icon = d.get("icon") or {}
        if isinstance(icon, str):  # an image path, before the icon had a frame
            icon = {"image": icon}
        overrides = d.get("segment_overrides") or {}
        need(isinstance(icon, dict), "icon")
        need(isinstance(overrides, dict) and all(isinstance(o, dict) for o in overrides.values()), "cue points")
        texts = d.get("texts", [])
        need(isinstance(texts, list) and all(isinstance(t, dict) and {"table", "id", "text"} <= set(t) for t in texts),
             "texts")
        filters = d.get("filters", {})
        need(isinstance(filters, dict) and all(isinstance(v, list) and len(v) == 2 for v in filters.values()), "filters")
        settings = d.get("settings", {})
        need(isinstance(settings, dict) and all(isinstance(s, dict) and all(
            v is None or isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) for v in s.values())
            for s in settings.values()), "settings")
        gains = d.get("gains", {})
        need(isinstance(gains, dict), "gains")
        curves_off, curves = d.get("curves_off", []), d.get("curves", {})
        need(isinstance(curves_off, list) and isinstance(curves, dict) and all(
            isinstance(c, list) and all(isinstance(x, list) and len(x) == 4 for x in c) for c in curves.values()), "curves")
        adds = d.get("additions", [])
        need(isinstance(adds, list) and all(isinstance(a, dict) and set(Addition.KINDS.get(a.get("kind"), ("?",))) <= set(a)
                                            for a in adds), "additions")

        notes, dropped = tidy_notes(d.get("notes"))
        if dropped:
            repairs.append(tr("a note"))
        soundtrack = d.get("soundtrack", {})
        need(isinstance(soundtrack, dict), "soundtrack")
        try:
            pieces = {int(k): Piece.from_json(v, GAIN_DB) for k, v in soundtrack.items()}
        except (TypeError, ValueError, OverflowError):
            raise ProjectFormatError("soundtrack") from None
        tabs = tab_list(d.get("tabs"))
        if tabs is None and "tabs" in d:
            repairs.append(tr("the tabs"))

        def points(o):
            """A segment's cue points: one that isn't a number goes (the automatic spot is used), and is a repair."""
            out = {}
            for k, v in o.items():
                if (x := number(v, None, 0, 3.6e6, tr("a cue point"))) is not None:
                    out[k] = x
            return out

        try:
            p = cls(name=d["name"], guid=str(d.get("guid") or ""),
                       version=int(number(d.get("version", 1), 1, 1, 99999, tr("the version"), whole=True)),
                       icon={k: v for k, v in icon.items() if k in ICON_KEYS},
                       loudness_analysis=kind(d, "loudness_analysis", bool, False, tr("Loudness analysis")),
                       replacements=reps,
                       every_bank=kind(d, "every_bank", bool, False, tr("Banks")),
                       project_banks_only=kind(d, "project_banks_only", bool, False, tr("Banks")),
                       patch_files=kind(d, "patch_files", bool, False, tr("Patch files")),
                       imported_banks=[int(b) for b in kind(d, "imported_banks", list, [], tr("the imported mods' banks"))],
                       built_for=kind(d, "built_for", str, "", tr("the game version of the last build")),
                       built_from=kind(d, "built_from", str, "", tr("what the last build was made from")),
                       segment_overrides={int(k): kept for k, o in overrides.items() if (kept := points(o))}, path=path,
                       description=kind(d, "description", str, "", tr("the description")),
                       build_folder=kind(d, "build_folder", str, "", tr("the build folder")),
                       library=[str(i) for i in d["library"]] if isinstance(d.get("library"), list) else None,
                       texts=[TextEdit(int(t["table"]), int(t["id"]), str(t["text"]), str(t.get("was", "")))
                              for t in texts],
                       additions=[Addition(a["kind"], **{k: int(a[k]) for k in Addition.KINDS[a["kind"]]}) for a in adds],
                       settings={int(o): {int(k): None if v is None else float(v) for k, v in s.items()}
                                 for o, s in settings.items() if s},
                       gains={int(t): db for t, v in gains.items()
                              if (db := number(v, 0.0, *GAIN_DB, tr("the Make-Up Gain of sound {id}").format(id=t)))},
                       filters={int(t): kept for t, v in filters.items() if any(kept := [
                           int(number(x, 0, *FILTER_RANGE, tr("the filters of sound {id}").format(id=t), whole=True)) for x in v])},
                       radio_off={f for f in kind(d, "radio_off", list, [], tr("the radio filters")) if f in FAMILIES},
                       radio_quieter=kind(d, "radio_quieter", bool, False, tr("the radio filters")),
                       curves_off={int(t) for t in curves_off}, curves={int(t): c for t, c in curves.items()},
                       notes=notes, soundtrack={k: v for k, v in pieces.items() if not v.plain()}, tabs=tabs)
            p.repairs = list(dict.fromkeys(repairs))  # not saved: what opening it put right (project_state says it)
            return p
        except (TypeError, ValueError, OverflowError):
            raise ProjectFormatError("values") from None

    def to_json(self) -> dict:
        def rep(r):
            out = {**asdict(r), "target": str(r.target)}
            if not r.silence:
                del out["silence"]  # files stay as they were for everything but silence
            for k in ("fade_in_ms", "fade_out_ms"):
                if not out[k]:
                    del out[k]
            return out
        return {
            "audiodiver": FORMAT, "name": self.name, "guid": self.guid, "version": self.version,
            "description": self.description, "icon": dict(self.icon), "build_folder": self.build_folder,
            "loudness_analysis": self.loudness_analysis,
            **({"every_bank": True} if self.every_bank else {}),
            **({"project_banks_only": True} if self.project_banks_only else {}),
            **({"patch_files": True} if self.patch_files else {}),
            **({"imported_banks": [str(b) for b in self.imported_banks]} if self.imported_banks else {}),
            **({"built_for": self.built_for} if self.built_for else {}),
            **({"built_from": self.built_from} if self.built_from else {}),
            **({"library": list(self.library)} if self.library is not None else {}),
            "replacements": [rep(r) for r in self.replacements],
            "segment_overrides": {str(k): v for k, v in self.segment_overrides.items()},
            **({"texts": [{"table": str(t.table), "id": t.id, "text": t.text, "was": t.was} for t in self.texts]}
               if self.texts else {}),
            **({"additions": self.additions_json()} if self.additions else {}),
            **({"settings": {str(o): {str(k): v for k, v in s.items()} for o, s in self.settings.items()}}
               if self.settings else {}),
            **({"gains": {str(k): v for k, v in self.gains.items()}} if self.gains else {}),
            **({"filters": {str(k): v for k, v in self.filters.items()}} if self.filters else {}),
            **({"radio_off": sorted(self.radio_off)} if self.radio_off else {}),
            **({"radio_quieter": True} if self.radio_quieter else {}),
            **({"curves_off": sorted(map(str, self.curves_off))} if self.curves_off else {}),
            **({"curves": {str(k): v for k, v in self.curves.items()}} if self.curves else {}),
            **({"notes": dict(self.notes)} if self.notes else {}),
            **({"soundtrack": {str(k): v.to_json() for k, v in self.soundtrack.items()}} if self.soundtrack else {}),
            **({"tabs": list(self.tabs)} if self.tabs is not None else {}),
        }

    def save(self, path=None):
        self.path = Path(path or self.path)
        write_whole(self.path, json.dumps(self.to_json(), indent=2) + "\n")


def replacements_from_folder(folder, relative_to, skip=()) -> list[Replacement]:
    """A replacement for every audio file under folder whose name starts with an id (`<id>_<name>.wav`)."""
    folder, out = Path(folder), []
    for f in sorted(folder.rglob("*")):
        if f.suffix.lower() not in {".wav", ".flac", ".mp3", ".ogg", ".wem"} or f.name in skip:
            continue
        head = f.name.split("_")[0].split(".")[0]
        if not head.isdigit():
            continue
        rel = Path(f.resolve()).relative_to(Path(relative_to).resolve(), walk_up=True)
        out.append(Replacement(target=int(head), audio=rel.as_posix(),
                               label=f.relative_to(folder).with_suffix("").as_posix()))
    return out
