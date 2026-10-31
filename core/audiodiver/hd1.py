"""Helldivers 1's audio, for the Library: browsing, playing and exporting. Nothing here writes to the game.

Helldivers 1 shares the engine of Helldivers 2 but not the audio: its sounds are Timpani, with no Wwise in the game. A
bundle (contents/<16 hex>, also in contents/dlc) is chunks of 64 KB, zlib unless a chunk is stored whole. It lists
resources, each with a variant per language, and the stream part of a variant sits in <bundle>.stream after those of
everything before it.

  bank    u32 count, u32 0, then count rows: u64 clip, u32 offset and u32 bytes in the bank, u32 offset and u32 bytes
          in the stream
  clip    a header of 68 bytes (word 2: samples; a WAVEFORMATEX at 48), then Ogg Vorbis or PCM, which goes on in the
          stream
  master  u32 magic, 7 section offsets. Sounds: a count, offsets, records by kind (`event_clips`). Events: a count, then
          the top 32 bits of a name's hash and an offset, sorted by hash; a record is 12 bytes, a count, offsets from
          the record's start and that many actions, of which those of type 0 play a sound and the rest stop one

An Index item is a named event, its parts are the languages it has (`cue`) and its slots are the clips it picks from.
Battle music is an item for each theme: an enemy's event chooses by `threat`, which the game sets from the mission's
difficulty before the music starts (TIERS), and each theme's clips are takes of one recording that it picks between.
All Archives lists the banks, which open as everything they hold, named or not. A source is the clip's id with the
language's flag above it (`source`), wider than any source of Helldivers 2. Reading the bundles takes a while, so what
they hold is kept in the cache until one changes.

The names (data/hd1_events.json) are hashes matched: the game's strings, then the code names of its text keys with the
words events end in. What a place in the Index is called comes from the game's text table when it can, in the language
in use: `strings` is a magic, a count, then the top 32 bits of a key's hash and an offset, sorted by hash. Voice events
share keys with the lines shown on screen, `vo_x` and `dia_x`, so the line is an item's description. The clips are far
shorter than those lines, so they don't read them out, and an item isn't named by its line.
"""
import collections
import hashlib
import json
import logging
import operator
import os
import re
import struct
import subprocess
import wave
import zlib
from importlib import resources
from pathlib import Path

from . import wem
from .audio import cache_lock
from .game import murmur64_hash, steam_libraries
from .i18n import N_, tr
from .index import CACHE_DIR, LANGUAGES
from .library import BIG_GROUP, CHUNK as GROUP_CHUNK, Library, _part

log = logging.getLogger(__name__)
FORMAT = 3            # of the kept reading: a new one reads the game again
VERSION = 0xF0000004  # of a bundle
CHUNK = 0x10000
BANK, MASTER, STRINGS = murmur64_hash(b"timpani_bank"), murmur64_hash(b"timpani_master"), murmur64_hash(b"strings")
HEAD = 68
VORBIS, PCM = 0x566F, 1
LOW = (1 << 64) - 1
NONE = 0xFFFFFFFF     # of a sound or an offset: there is none
ENGLISH = 0
THREAT = murmur64_hash(b"threat") >> 32  # the parameter an enemy's battle music chooses by
# the game's setup sets it to 0 up to difficulty 4, to 0.5 up to difficulty 8 and to 1 from there
THREATS, TIERS = (0.0, 0.5, 1.0), ("Difficulty 1-4", "Difficulty 5-8", "Difficulty 9+")
TESTS = {2: operator.lt, 3: operator.le, 4: operator.gt, 5: operator.ge}  # how a condition compares, by its number
ENEMIES = {"bugs": "@enc_bug", "cyborgs": "@enc_cyborg", "illuminates": "@enc_illuminate"}
BATTLE = {murmur64_hash(f"music_action_{enemy}".encode()) >> 32 for enemy in ENEMIES}
# a variant's language flag, read from the text of the game's `strings` under each flag: the two Spanish ones by
# "vosotros" and "ustedes"
FLAGS = {ENGLISH: "us", 0x1: "jp", 0x100: "fr", 0x200: "ms", 0x400: "es", 0x800: "bp", 0x1000: "ru", 0x2000: "it", 0x4000: "de"}
TEXT = {"en": 0, "ja": 0x1, "zh-Hans": 0x2, "fr": 0x100, "es-ES": 0x400, "pt-BR": 0x800}  # the app's languages, as flags
# the Index's categories in order: id, name ("@" and a key of the game's text, or a name of ours), hue
CATEGORIES = [
    ("music", N_("Music"), 300),
    ("voices", N_("Voices"), 160),
    ("weapons", N_("Weapons"), 60),
    ("stratagems", N_("Stratagems"), 30),
    ("vehicles", N_("Vehicles"), 100),
    ("bugs", "@enc_bug", 45),
    ("cyborgs", "@enc_cyborg", 10),
    ("illuminate", "@enc_illuminate", 275),
    ("movement", N_("Footsteps and Movement"), 190),
    ("impacts", N_("Impacts"), 350),
    ("radio", N_("Radio"), 250),
    ("ambience", N_("Ambience"), 135),
    ("interface", N_("Interface"), 320),
    ("other", N_("Other Sounds"), 215),
]
MISSIONS, MENUS = N_("Missions"), N_("Menus")
# the music by what it does, in the order a mission gets to it: a name, its section, what the Index calls it. Each enemy
# has its own battle, boss and encounter events: the game adds the enemy to the name when it plays them
MUSIC = {
    **{f"{stem}_{enemy}": (section, title) for enemy, section in ENEMIES.items()
       for stem, title in (("music_action", "Battle"), ("music_boss", "Boss"), ("encounter_start", "Encounter"))},
    "music_mission_start": (MISSIONS, "Mission Start"), "music_threat": (MISSIONS, "Threat"), "music_objective_found": (MISSIONS, "Objective Found"),
    "objective_found": (MISSIONS, "Objective Found, Long"), "music_objective_complete": (MISSIONS, "Objective Complete"),
    "music_objective_fail": (MISSIONS, "Objective Failed"), "music_action_plus": (MISSIONS, "Extraction"), "music_mission_end_success": (MISSIONS, "Mission Success"),
    "music_mission_end_failed": (MISSIONS, "Mission Failed"), "music_intro": (MENUS, "Intro"), "music_theme": (MENUS, "Main Theme"), "music_bridge": (MENUS, "Ship Bridge"),
    "music_ship": (MENUS, "Ship"), "music_jingle": (MENUS, "Jingle"), "music_credits": (MENUS, "Credits"),
}
ORDER = {name: n for n, name in enumerate(MUSIC)}
# where a name goes, by its first words (the most words that match): category, then section ("@" and a key of the game's
# text, a name of ours, or "" for none). A label leaves out the words that matched.
PLACES = {
    "music": ("music", MENUS),
    "wep": ("weapons", N_("General")), "wep_ar": ("weapons", N_("Assault Rifles")), "wep_ar_carbine": ("weapons", "@weapon_carbine"),
    "wep_ar_combat": ("weapons", "@weapon_combatrifle"), "wep_ar_rifle": ("weapons", "@weapon_assaultrifle"), "wep_arc": ("weapons", "@weapon_arcrifle"),
    "wep_chemthrower": ("weapons", "@weapon_chemthrower"), "wep_flamethrower": ("weapons", "@weapon_flamethrower"),
    "wep_flamathrower": ("weapons", "@weapon_flamethrower"), "wep_grenadelauncher": ("weapons", "@stratagem_grenadelauncher"),
    "wep_handgrenade": ("weapons", N_("Grenades")), "wep_laser_cannon": ("weapons", "@stratagem_lasercannon"), "wep_laser_rifle": ("weapons", "@weapon_laserrifle"),
    "wep_laser_smg": ("weapons", "@weapon_lasersmg"), "wep_law": ("weapons", "@stratagem_law"), "wep_machinegun": ("weapons", "@stratagem_machinegun"),
    "wep_mannable_turret": ("weapons", "@stratagem_mannable_turret"), "wep_mg": ("weapons", N_("Machine Guns")), "wep_mg_machinepistol": ("weapons", "@weapon_machinepistol"),
    "wep_mg_submachinegun": ("weapons", "@weapon_submachinegun"), "wep_missile_launcher": ("weapons", "@stratagem_missile_launcher"),
    "wep_mortar": ("weapons", "@stratagem_mortar"), "wep_nailgun": ("weapons", "@weapon_nailgun"), "wep_pistol01": ("weapons", "@weapon_pistol"),
    "wep_railgun": ("weapons", "@weapon_railgun"), "wep_rpg": ("weapons", N_("Rocket Launchers")), "wep_saber": ("weapons", "@weapon_saber"),
    "wep_sg": ("weapons", N_("Shotguns")), "wep_shotgun": ("weapons", N_("Shotguns")), "wep_sg_dbarrel": ("weapons", "@weapon_shotgundouble"),
    "wep_submachine": ("weapons", N_("Submachine Guns")),
    "game": ("other", ""), "game_airstrike": ("stratagems", "@stratagem_airstrike"), "game_artillery": ("stratagems", "@stratagem_artillery"),
    "game_barricade": ("stratagems", "@stratagem_barricade"), "game_beacon": ("stratagems", N_("Stratagem Beacons")), "game_distractor": ("stratagems", "@stratagem_distractor"),
    "game_divebomb": ("stratagems", "@stratagem_dive_bomb"), "game_hellbomb": ("stratagems", "@stratagem_hellbomb"), "game_jumppack": ("stratagems", "@stratagem_jumppack"),
    "game_metaldetector": ("stratagems", "@stratagem_metaldetector"), "game_mine": ("stratagems", "@stratagem_minedrop"), "game_minedrop_stun": ("stratagems", "@stratagem_minedrop_stun"),
    "game_missile_strike": ("stratagems", "@stratagem_missile_strike"), "game_shield": ("stratagems", N_("Shields")), "game_staticfield": ("stratagems", "@stratagem_staticfield"),
    "game_tesla": ("stratagems", "@stratagem_tesla_tower"), "game_tesla_tower": ("stratagems", "@stratagem_tesla_tower"), "game_turret": ("stratagems", N_("Turrets")),
    "repairtool": ("stratagems", "@stratagem_repairtool"), "hellpod": ("stratagems", N_("Hellpods")),
    "game_apc": ("vehicles", "@stratagem_apc"), "game_bike": ("vehicles", "@stratagem_bike"), "game_shuttle": ("vehicles", N_("Extraction Shuttle")), "mech": ("vehicles", N_("Exosuits")),
    "chr_bug": ("bugs", N_("General")), "chr_bug_boss": ("bugs", "@enc_bug_boss"), "chr_bug_impaler": ("bugs", "@enc_bug_impaler"), "chr_bug_scout": ("bugs", "@enc_bug_scout"),
    "chr_bug_stalker": ("bugs", "@enc_bug_stalker"), "chr_bug_tank": ("bugs", "@enc_bug_tank"), "chr_bug_warrior": ("bugs", "@enc_bug_warrior"),
    "chr_cyborg": ("cyborgs", N_("General")), "chr_cyborg_dog": ("cyborgs", "@enc_cyborg_hound"), "chr_cyborg_hulk": ("cyborgs", "@enc_cyborg_hulk"),
    "chr_cyborg_ifv": ("cyborgs", "@enc_cyborg_ifv"), "chr_cyborg_initiate": ("cyborgs", "@enc_cyborg_initiate"), "chr_cyborg_soldier": ("cyborgs", "@enc_cyborg_soldier"),
    "chr_vo_berserker": ("cyborgs", "@enc_cyborg_berserker"), "chr_vo_berserker_elite": ("cyborgs", "@enc_cyborg_berserker_elite"), "chr_vo_hulk": ("cyborgs", "@enc_cyborg_hulk"),
    "chr_vo_ifv": ("cyborgs", "@enc_cyborg_ifv"), "chr_vo_initiate": ("cyborgs", "@enc_cyborg_initiate"), "chr_vo_soldier": ("cyborgs", "@enc_cyborg_soldier"),
    "chr_fs_initiate": ("cyborgs", "@enc_cyborg_initiate"), "boss": ("cyborgs", "@enc_cyborg_boss"), "hit_berserker": ("cyborgs", "@enc_cyborg_berserker"),
    "hit_initiate": ("cyborgs", "@enc_cyborg_initiate"), "hit_soldier": ("cyborgs", "@enc_cyborg_soldier"), "wep_cyborg": ("cyborgs", N_("General")),
    "wep_hulk": ("cyborgs", "@enc_cyborg_hulk"), "wep_soldier": ("cyborgs", "@enc_cyborg_soldier_cannon"),
    "chr_illuminate": ("illuminate", N_("General")), "chr_illuminate_apprentice": ("illuminate", "@enc_illuminate_apprentice"), "chr_illuminate_boss": ("illuminate", "@enc_illuminate_boss"),
    "chr_illuminate_hunter": ("illuminate", "@enc_illuminate_sniper"), "chr_illuminate_illusionist": ("illuminate", "@enc_illuminate_psyker"),
    "chr_illuminate_observer": ("illuminate", "@enc_illuminate_observer"), "chr_illuminate_tripod": ("illuminate", "@enc_illuminate_warrior"),
    "fs": ("movement", ""), "footstep": ("movement", ""), "chr_fs": ("movement", ""), "bf": ("movement", ""), "cloth": ("movement", ""), "foley": ("movement", ""),
    "bullet": ("impacts", ""), "shrapnel": ("impacts", ""), "hit": ("impacts", ""),
    "radio": ("radio", ""), "equip": ("radio", ""), "amb": ("ambience", ""), "enter": ("ambience", ""), "ui": ("interface", ""), "menu": ("interface", ""),
}
KEPT = ("bullet", "shrapnel", "hit", "bf", "footstep", "cloth", "foley", "enter", "equip")  # first words a label keeps: the place doesn't say them
VOICES = {"admiral": N_("Admiral"), "engineer": N_("Chief Communications Officer"), "scientist": N_("Science Officer"), "soldier1": N_("Private 1"),
          "soldier2": N_("Private 2"), "helldiver": N_("Helldiver"), "tutorial": N_("Tutorial")}
WORDS = {"ar": "AR", "bf": "BF", "ifv": "IFV", "rpg": "RPG", "sg": "SG", "smg": "SMG", "ui": "UI", "fs": "Footstep", "med": "Medium", "galcamp": "Galactic Campaign",
         "missionc": "Mission Complete", "missiond": "Mission Failed", "planetc": "Planet Complete", "noplanet": "No Planet", "attackevent": "Attack Event",
         "defendevent": "Defense Event", "wardeclared": "War Declared", "diffunlocked": "Difficulty Unlocked", "ammoempty": "Ammo Empty", "ammolow": "Ammo Low",
         "cannotgetout": "Cannot Get Out", "helpme": "Help Me", "jumpfail": "Jump Fail", "reloadme": "Reload Me", "emptyclick": "Empty Click", "magins": "Magazine In",
         "magrel": "Magazine Release", "noammo": "No Ammo", "lowammo": "Low Ammo", "explose": "Explosion"}


def contents_folder(path) -> Path:
    """The contents folder of a folder chosen in Settings: the install folder or contents itself. ValueError for
    anything else."""
    for folder in (Path(path), Path(path) / "contents"):
        if is_contents(folder):
            return folder
    raise ValueError(tr("{folder} has no Helldivers 1 files").format(folder=path))


def locate(chosen=None) -> tuple[Path | None, str | None]:
    """(contents folder, how it was found): "chosen" in Audiodiver's settings, "env" from $HD1_CONTENTS, or "steam" from
    the Steam libraries. (None, None) when it isn't there."""
    if chosen:
        try:
            return contents_folder(chosen), "chosen"
        except ValueError:
            return None, None
    if env := os.environ.get("HD1_CONTENTS"):
        return (Path(env), "env") if is_contents(env) else (None, None)
    found = next((c for lib in steam_libraries() if is_contents(c := Path(lib) / "steamapps" / "common" / "Helldivers" / "contents")), None)
    return (found, "steam") if found else (None, None)


def is_contents(folder) -> bool:
    return Path(folder).is_dir() and any(_bundles(Path(folder)))


def _bundles(contents: Path) -> list[Path]:
    return sorted(p for p in (*contents.glob("*"), *contents.glob("dlc/*")) if re.fullmatch(r"[0-9a-f]{16}", p.name))


class Bundle:
    """A bundle's contents as one run of bytes. Only the chunks asked for are inflated, and `chunks` (what the file
    has) is kept by whoever reads it often."""

    def __init__(self, path, chunks=None):
        self.f = open(path, "rb")
        if struct.unpack("<I", self.f.read(4))[0] != VERSION:
            self.f.close()
            raise ValueError(f"{Path(path).name} isn't a bundle this reader knows")
        self.chunks = chunks if chunks is not None else self._walk()
        self.last = (None, b"")

    def _walk(self) -> list[tuple[int, int]]:
        out, at, end = [], 12, self.f.seek(0, 2)
        while at < end:
            self.f.seek(at)
            n = struct.unpack("<I", self.f.read(4))[0]
            out.append((at + 4, n))
            at += 4 + n
        return out

    def _chunk(self, i: int) -> bytes:
        if self.last[0] != i:
            at, n = self.chunks[i]
            self.f.seek(at)
            body = self.f.read(n)
            self.last = (i, body if n == CHUNK else zlib.decompress(body))
        return self.last[1]

    def read(self, at: int, n: int) -> bytes:
        out = bytearray()
        while n > 0:
            piece = self._chunk(at // CHUNK)[at % CHUNK:at % CHUNK + n]
            out += piece
            at += len(piece)
            n -= len(piece)
        return bytes(out)

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.f.close()


def _resources(b: Bundle):
    """(type, name, language flag, where in the bundle, bytes, where in the .stream, bytes there) of every variant."""
    count = struct.unpack("<I", b.read(0, 4))[0]
    at, stream_at = 4 + 256 + 16 * count, 0
    for _ in range(count):
        kind, name, n, _flags = struct.unpack("<QQII", b.read(at, 24))
        at += 24
        heads = list(struct.iter_unpack("<III", b.read(at, 12 * n)))
        at += 12 * n
        for lang, size, stream in heads:
            yield kind, name, lang, at, size, stream_at, stream
            at += size
            stream_at += stream


def _clip_ms(head: bytes) -> float:
    samples = struct.unpack_from("<I", head, 8)[0]
    rate = struct.unpack_from("<I", head, 52)[0]
    return round(samples * 1000 / rate, 1) if rate else 0.0


def _rows(b: Bundle, at: int) -> list[list[int]]:
    """A bank's clips: [clip, offset in the bank, bytes, offset in the stream, bytes, length in ms]."""
    count = struct.unpack("<I", b.read(at, 4))[0]
    rows = struct.iter_unpack("<QIIII", b.read(at + 8, 24 * count))
    return [[*r, _clip_ms(b.read(at + r[1], HEAD))] for r in rows]


def _conditions(m: bytes, table: int, at: int) -> list[tuple[int, int, int, float]]:
    """The conditions at this offset of a choice's table, which all have to hold: (parameter, test, type, value)."""
    group = struct.unpack_from("<I", m, table + at + 4)[0]
    n = struct.unpack_from("<I", m, table + group)[0]
    return [struct.unpack_from("<IIIf", m, table + group + 4 + 16 * k) for k in range(n)]


def _holds(condition: tuple[int, int, int, float], threat: float) -> bool:
    """Whether a condition lets a sound through at this threat: one about anything else always does."""
    parameter, test, kind, value = condition
    return parameter != THREAT or kind != 0 or test not in TESTS or TESTS[test](threat, value)


def event_clips(m: bytes) -> tuple[dict, dict, dict]:
    """From the master: ({an event's name hash (top 32 bits): the clips it can play, in the order of the tree},
    {a battle music event: its clips at each of THREATS}, {an event: {a clip that starts or ends a loop: 0 or 1}})."""
    sounds, events, end = struct.unpack_from("<3I", m, 12)
    count = struct.unpack_from("<I", m, sounds)[0]
    offsets = [*struct.unpack_from(f"<{count}I", m, sounds + 4), events - sounds]
    leaf, kids, rules, edges = {}, {}, {}, {}
    for i in range(count):
        at = sounds + offsets[i]
        kind = struct.unpack_from("<I", m, at)[0]
        if kind == 0:  # a clip
            leaf[i] = struct.unpack_from("<Q", m, at + 16)[0]
        elif kind == 1:  # a random pick: children and weights
            n = struct.unpack_from("<I", m, at + 8)[0]
            kids[i] = [struct.unpack_from("<I", m, at + 24 + 8 * k)[0] for k in range(n)]
        elif kind == 3:  # a choice: children, each with an offset into the table of conditions after them; one without plays when no other does
            n = struct.unpack_from("<I", m, at + 8)[0]
            pairs = [struct.unpack_from("<II", m, at + 12 + 8 * k) for k in range(n)]
            kids[i] = [child for child, _ in pairs]
            rules[i] = {child: _conditions(m, at + 12 + 8 * n, where) for child, where in pairs if where != NONE}
        elif kind == 4:  # what plays once first, what loops, what plays once at the end
            first, loop, last = struct.unpack_from("<III", m, at + 8)
            kids[i] = [k for k in (first, loop, last) if k != NONE]
            edges[i] = {first: 0, last: 1}

    def walk(starts: list[int], threat: float | None = None) -> tuple[list[int], dict[int, int]]:
        """The clips under these sounds, and which of them start or end a loop. With a threat, only what it chooses."""
        out, marks, seen, todo = [], {}, set(), [(s, None) for s in reversed(starts)]
        while todo:
            i, mark = todo.pop()
            if i in seen or i >= count:
                continue
            seen.add(i)
            if i in leaf:
                out.append(leaf[i])
                if mark is not None:
                    marks[leaf[i]] = mark
            under = kids.get(i, [])
            if threat is not None and i in rules:
                passed = [k for k in under if k in rules[i] and all(_holds(c, threat) for c in rules[i][k])]
                under = passed or [k for k in under if k not in rules[i]]
            todo.extend((k, edges.get(i, {}).get(k, mark)) for k in reversed(under))
        return out, marks

    n = struct.unpack_from("<I", m, events)[0]
    table = [struct.unpack_from("<II", m, events + 4 + 8 * i) for i in range(n)]
    out, tiers, ends = {}, {}, {}
    for name, at in table:
        record = events + at
        refs = struct.unpack_from("<I", m, record + 12)[0]
        actions = [struct.unpack_from("<3I", m, record + where) for where in struct.unpack_from(f"<{refs}I", m, record + 16)]
        plays = [sound for kind, _, sound in actions if kind == 0]
        out[name], marks = walk(plays)
        out[name] = list(dict.fromkeys(out[name]))
        if marks:
            ends[name] = marks
        if name in BATTLE:
            tiers[name] = [list(dict.fromkeys(walk(plays, threat)[0])) for threat in THREATS]
    return out, tiers, ends


def scan(contents: Path) -> dict:
    """What the bundles hold, in the form the cache keeps."""
    banks, seen, master, texts = [], set(), None, {}
    wanted = _text_keys()
    for path in _bundles(contents):
        with Bundle(path) as b:
            for kind, name, lang, at, size, stream_at, stream in _resources(b):
                if kind == MASTER and master is None:
                    master = b.read(at, size)
                elif kind == STRINGS and lang in TEXT.values():
                    texts.setdefault(lang, {}).update(_text(b.read(at, size), wanted))
                elif kind == BANK and (name, lang) not in seen:  # a bank can sit in several bundles
                    seen.add((name, lang))
                    banks.append({"bundle": path.relative_to(contents).as_posix(), "name": name, "lang": lang, "at": at,
                                  "stream": stream_at, "rows": _rows(b, at)})
    if master is None:
        raise ValueError("no timpani_master in the game")
    clips = {r[0] for b in banks for r in b["rows"]}
    events, tiers, ends = event_clips(master)
    return {"banks": banks, "texts": {str(f): {str(k): v for k, v in lines.items()} for f, lines in texts.items()},
            "events": {str(e): [c for c in got if c in clips] for e, got in events.items()},
            "tiers": {str(e): [[c for c in got if c in clips] for got in themes] for e, themes in tiers.items()},
            "ends": {str(e): {str(c): mark for c, mark in marks.items()} for e, marks in ends.items()}}


def _text(raw: bytes, wanted: set[int]) -> dict[int, str]:
    """The lines of a `strings` resource with the keys wanted."""
    count = struct.unpack_from("<I", raw, 4)[0]
    out = {}
    for key, at in struct.iter_unpack("<II", raw[8:8 + 8 * count]):
        if key in wanted:
            out[key] = raw[at:raw.index(b"\0", at)].decode("utf-8", "replace")
    return out


def _key(name: str) -> int:
    return murmur64_hash(name.encode()) >> 32


def _line_keys(name: str) -> list[str]:
    """The keys an event's line can have: the events of soldiers go by their own names, and one line can differ by
    enemy."""
    rest = name.removeprefix("vo_")
    return [name, rest, f"dia_{rest}", f"dia_{rest.replace('illuminates', 'illuminate')}", *(f"dia_{rest}_{e}" for e in ("bugs", "cyborgs", "illuminates"))]


def _text_keys() -> set[int]:
    """Every key of the game's text the Index can use."""
    keys = [p[1:] for p in (*(c[1] for c in CATEGORIES), *(s for _, s in PLACES.values())) if p.startswith("@")]
    keys += [k for n in _names().values() if n.startswith(("vo_", "tutorial_", "general_")) for k in _line_keys(n)]
    return {_key(k) for k in keys}


def _fingerprint(contents: Path) -> str:
    h = hashlib.sha1(str(FORMAT).encode())
    for p in _bundles(contents):
        s = p.stat()
        h.update(f"{p.name} {s.st_size} {s.st_mtime_ns}\n".encode())
    return h.hexdigest()


def _names() -> dict[int, str]:
    """{an event's name hash: the name}, of the names known."""
    names = json.loads(resources.files("audiodiver").joinpath("data", "hd1_events.json").read_text(encoding="utf-8"))
    return {murmur64_hash(n.encode()) >> 32: n for n in names}


def label(name: str, drop: int) -> str:
    """An event's name as the Library shows it, without the first words the place in the Index says: "fs_rock_run" is
    "Rock Run"; a number goes apart from the word it ends, as in "Easy 2"."""
    words = name.split("_")
    return " ".join(WORDS.get(w, w.capitalize()) for part in words[drop:] for w in re.sub(r"^([a-z]{2,})(\d+)$", r"\1 \2", part).split())


def _place(name: str) -> tuple[str, str, int]:
    """(category, section, words a label leaves out) of a named event."""
    if name.startswith(("vo_", "tutorial_", "general_")):
        word, *more = name.split("_")
        sec = "tutorial" if word == "tutorial" else more[0] if more and more[0] in VOICES else "helldiver"
        return "voices", sec, 1 if sec in ("tutorial", "helldiver") else 2
    if name in MUSIC:
        return "music", MUSIC[name][0], 0
    words = name.split("_")
    for n in range(len(words), 0, -1):
        if got := PLACES.get("_".join(words[:n])):
            return got[0], got[1], 0 if n == 1 and words[0] in KEPT else n
    return "other", "", 0


def _spoken(line: str) -> str:
    """A line of the game's text as it reads on screen, with what the game fills in left open."""
    line = re.sub(r"\[P=[\d.]+\]", " ", line)
    line = re.sub(r"#PLAYERRANK #PLAYERNAME|#PLAYERRANK|#PLAYERNAME", "Helldiver", line)
    return " ".join(re.sub(r"#[A-Z_]+", "…", line).split())


def source(clip: int, lang: int = ENGLISH) -> int:
    return clip | lang << 64


class Hd1:
    def __init__(self, contents: Path, read: dict):
        self.contents, self.banks = contents, read["banks"]
        self.texts = {int(f): {int(k): v for k, v in lines.items()} for f, lines in read.get("texts", {}).items()}
        self.events = {int(e): clips for e, clips in read["events"].items() if clips}
        self.tiers = {int(e): themes for e, themes in read.get("tiers", {}).items() if all(themes)}  # battle music -> the clips of each theme
        self.ends = {int(e): {int(c): mark for c, mark in marks.items()} for e, marks in read.get("ends", {}).items()}  # an event -> what starts or ends a loop
        self.where, self.langs = {}, collections.defaultdict(list)  # source -> (bank, row); clip -> language flags
        for bank in self.banks:
            for row in bank["rows"]:
                at = source(row[0], bank["lang"])
                if at not in self.where:
                    self.where[at] = (bank, row)
                    self.langs[row[0]].append(bank["lang"])
        self.chunks = {}    # a bundle -> what Bundle found in it
        self.made = (None, [], [])  # the language, the categories named in it, and All Archives
        self.titles = {}    # a named event -> what it is called in a bank
        self.items_ = {}    # an item's id -> its item
        self.event_of = collections.defaultdict(list)  # a clip -> the events that play it
        for event, clips in self.events.items():
            for clip in clips:
                self.event_of[clip].append(event)

    @classmethod
    def read(cls, contents: Path) -> "Hd1":
        """Reads the game, or what was kept of it while no bundle has changed."""
        key, kept = _fingerprint(contents), CACHE_DIR / "hd1_index.json"
        try:
            saved = json.loads(kept.read_text(encoding="utf-8"))
            if saved["key"] == key:
                return cls(contents, saved)
        except (OSError, ValueError, KeyError):
            pass
        read = scan(contents)
        kept.parent.mkdir(parents=True, exist_ok=True)
        tmp = kept.with_suffix(".partial")
        tmp.write_text(json.dumps({"key": key, **read}, separators=(",", ":")), encoding="utf-8")
        tmp.replace(kept)
        return cls(contents, read)

    # --- the Index
    def _say(self, key: str, language: str) -> str | None:
        """A line of the game's text in this language, else in English."""
        k = _key(key)
        return self.texts.get(TEXT.get(language, ENGLISH), {}).get(k) or self.texts.get(ENGLISH, {}).get(k)

    def _name(self, name: str, language: str) -> str:
        """A name of a category or section: `name` itself, or the game's text for "@key" (its enemies are in capitals)."""
        if not name.startswith("@"):
            return tr(VOICES.get(name, name)) if name else ""
        said = self._say(name[1:], language) or name.split("_")[-1].capitalize()
        if not name.startswith("@enc_"):
            return said
        said = said.replace("SIEGEMECH", "SIEGE MECH")
        return said.title() if language == "en" else said.capitalize()

    def categories(self, language: str) -> list[dict]:
        """The Library's categories of Helldivers 1, named in this language."""
        return self._make(language)[1]

    def archives(self, language: str) -> list[dict]:
        """The banks as rows of All Archives (library.py)."""
        return self._make(language)[2]

    def _make(self, language: str):
        if self.made[0] == language:
            return self.made
        names = _names()
        made = {cid: {"id": f"hd1/{cid}", "name": self._name(name, language) if name.startswith("@") else tr(name), "hue": hue,
                      "about": "", "sections": [], "game": "hd1"} for cid, name, hue in CATEGORIES}
        sections = collections.defaultdict(dict)
        self.titles = {}
        by_bank, named = collections.defaultdict(collections.Counter), collections.defaultdict(list)
        for event, name in sorted(names.items(), key=lambda e: (ORDER.get(e[1], len(ORDER)), e[1])):
            if event not in self.events:
                continue
            cid, sec, drop = _place(name)
            title = self._name(sec, language)
            short = MUSIC[name][1] if name in MUSIC else label(name, drop) or title or label(name, 0)
            self.titles[event] = f"{title} {short}" if title and short != title else short
            line = next((said for k in _line_keys(name) if (said := self._say(k, language))), None) if cid == "voices" else None
            for iid, clips, tier in self._themes(event):
                sections[cid].setdefault(sec, []).append(self._item(iid, clips, short + tier, _spoken(line) if line else "", made[cid], self.titles[event] + tier, name))
            bank = self._bank_of(self.events[event])
            by_bank[bank][cid] += 1
            named[bank].append(short)
        orders = {"voices": [*VOICES], "music": [*ENEMIES.values(), MISSIONS, MENUS]}
        for cid, cat in made.items():
            order = orders.get(cid)
            for sec, items in sorted(sections[cid].items(), key=lambda s: order.index(s[0]) if order else self._name(s[0], language).strip("'\"").casefold()):
                cat["sections"].append({"id": f"{cat['id']}/{sec.lstrip('@') or 'all'}", "name": self._name(sec, language) or cat["name"],
                                        "about": "", "unused": False, "items": items})
        rows = [self._bank_row(bank, by_bank[bank], named[bank], made) for bank in sorted({b["name"] for b in self.banks})]
        rows.sort(key=lambda r: (not r["names"], -r["sounds"], r["id"]))
        self.made = (language, [c for c in made.values() if c["sections"]], rows)
        return self.made

    def _bank_of(self, clips: list[int]) -> int:
        """The bank an event's first clip is in."""
        return self.where[next(s for c in clips if (s := source(c, self.langs[c][0])) in self.where)][0]["name"]

    def _flags(self, bank: int) -> list[int]:
        """The languages a bank has, English first."""
        have = {b["lang"] for b in self.banks if b["name"] == bank}
        return [f for f in FLAGS if f in have] or sorted(have)

    def _bank_row(self, bank: int, held: collections.Counter, titles: list[str], made: dict) -> dict:
        """A bank as a row of All Archives, and as an item to open. It goes by what it holds: a few events by their
        names, more by their categories."""
        flags, iid = self._flags(bank), f"hd1:bank:{bank:016x}"
        clips = {r[0]: r for b in self.banks if b["name"] == bank for r in b["rows"]}
        one = len(flags) == 1
        counts = {f: sum(len(b["rows"]) for b in self.banks if b["name"] == bank and b["lang"] == f) for f in flags}
        first = source(next(iter(clips)), self.langs[next(iter(clips))][0])
        names = titles if len(titles) <= 3 else [made[cid]["name"] for cid, _ in held.most_common(3)]
        name = ", ".join(names) or tr("Bank {id}").format(id=f"{bank:016x}")
        it = _shell(iid, name, "" if names else tr("Not named yet."), "", str(first), counts[flags[0]])
        it["parts"] = [_part(iid if one else f"{iid}:{f:x}", "" if one else tr(LANGUAGES[FLAGS.get(f, "us")]), counts[f]) for f in flags]
        self.items_[iid] = it
        tags = [{"category": made[cid]["id"], "name": made[cid]["name"]} for cid, _ in held.most_common()]
        return {"id": f"{bank:016x}", "item": iid, "game": "hd1", "names": names, "tags": tags, "banks": len(flags), "sounds": len(clips),
                "language": tr("{n} languages").format(n=len(flags)) if not one else "", "preview": str(first)}

    def _themes(self, event: int) -> list[tuple[str, list[int], str]]:
        """What an event opens as: (the item's id, its clips, what its name ends in) of each. One, or a theme of battle
        music for each difficulty."""
        iid = f"hd1:{event:08x}"
        if event in self.tiers:
            return [(f"{iid}.{n}", clips, f", {tier}") for n, (clips, tier) in enumerate(zip(self.tiers[event], TIERS))]
        return [(iid, self.events[event], "")]

    def _labels(self, event: int | None, clips: list[int]) -> list[str]:
        """What each of an event's clips is called: what starts or ends a loop says so, and the rest are takes, or the
        loop when it is one clip."""
        ends = self.ends.get(event, {})
        rest = sum(c not in ends for c in clips)
        takes, one = iter(range(1, rest + 1)), tr("Loop") if ends else ""
        return [(tr("Start"), tr("End"))[ends[c]] if c in ends else tr("Take {n}").format(n=next(takes)) if rest > 1 else one for c in clips]

    def _item(self, iid: str, clips: list[int], name: str, about: str, cat: dict, full: str, code: str) -> dict:
        flags = [f for f in FLAGS if any(f in self.langs[c] for c in clips)] or [self.langs[clips[0]][0]]
        one = len(flags) == 1
        parts = [_part(iid if one else f"{iid}:{f:x}", "" if one else tr(LANGUAGES[FLAGS[f]]),
                       sum(f in self.langs[c] for c in clips)) for f in flags]
        first = next(c for c in clips if flags[0] in self.langs[c])
        it = _shell(iid, name, about, cat["id"], str(source(first, flags[0])), parts[0]["count"])
        it["parts"], it["full"], it["en"] = parts, full, code  # `en`: a search finds it by the game's name for it too
        self.items_[iid] = it
        return it

    def item(self, iid: str) -> dict:
        """An item by its id. KeyError when there is none."""
        return self.items_[iid]

    # --- what opens in the middle
    def view(self, cue_id: str) -> dict:
        """The cue-shaped view of an event in a language, or of a bank in a language. KeyError when there is no such
        thing."""
        _, kind, *more = cue_id.split(":")
        if kind == "bank":
            return self._bank_view(cue_id, int(more[0], 16), int(more[1], 16) if len(more) > 1 else None)
        event = int(kind.partition(".")[0], 16)
        it = self.items_[f"hd1:{kind}"]
        clips = next(got for iid, got, _ in self._themes(event) if iid == it["id"])
        flag = int(more[0], 16) if more else next(f for c in clips for f in self.langs[c])
        have = [c for c in clips if source(c, flag) in self.where]
        rows = [self._slot(source(c, flag), self.where[source(c, flag)][1], take) for c, take in zip(have, self._labels(event, have))]
        if not rows:
            raise KeyError(cue_id)
        return _shape(cue_id, it["name"], [tr("Helldivers 1"), it["full"]], [Library._group(it["name"], rows)], rows)

    def _bank_view(self, cue_id: str, bank: int, flag: int | None) -> dict:
        """What a bank holds in a language: each event's clips as a group, the named ones first, then the clips no event
        plays."""
        flag = self._flags(bank)[0] if flag is None else flag
        held = {r[0]: r for b in self.banks if b["name"] == bank and b["lang"] == flag for r in b["rows"]}
        if not held:
            raise KeyError(cue_id)
        groups, slots, seen = [], [], set()

        def add(title: str, clips: list[int], event: int | None = None):
            rows = [self._slot(source(c, flag), held[c], take) for c, take in zip(clips, self._labels(event, clips))]
            chunk = len(rows) if len(rows) <= BIG_GROUP else GROUP_CHUNK
            for i in range(0, len(rows), chunk):
                groups.append(Library._group(title if chunk == len(rows) else f"{title} {i + 1}–{min(len(rows), i + chunk)}", rows[i:i + chunk]))
            slots.extend(rows)
            seen.update(clips)

        for event in sorted(self.events, key=lambda e: (e not in self.titles, self.titles.get(e, ""), e)):
            for _, clips, tier in self._themes(event):
                if got := [c for c in clips if c in held and c not in seen]:
                    add((self.titles.get(event) or tr("Event {id}").format(id=f"{event:08x}")) + tier, got, event)
        if rest := [c for c in held if c not in seen]:
            add(tr("Clips No Event Plays"), rest)
        return _shape(cue_id, self.items_[f"hd1:bank:{bank:016x}"]["name"], [tr("Helldivers 1"), tr("All Archives")], groups, slots)

    @staticmethod
    def _slot(at: int, row: list, take: str) -> dict:
        return {"source": str(at), "stream": str(row[0]), "file_id": str(row[0]), "duration_ms": row[5], "unused": False,
                "absent": False, "variant": "", "label": take, "locked": False, "also_in": [], "also_n": 0, "banks": 0}

    def places(self, n: int) -> list[dict]:
        """Where a clip's ID leads, as Library.places says it: the events with a name, else the bank."""
        if n not in self.langs:
            return []
        at = source(n, self.langs[n][0])
        bank = f"{self.where[at][0]['name']:016x}"
        named = [iid for e in self.event_of.get(n, ()) if e in self.titles for iid, clips, _ in self._themes(e) if n in clips]
        return [{"cue": iid, "source": str(at), "item": iid, "archives": [bank]} for iid in named or [f"hd1:bank:{bank}"]]

    # --- the audio
    def _bytes(self, at: int) -> tuple[bytes, bytes]:
        """A clip's header and audio."""
        bank, row = self.where[at]
        _, off, size, stream_off, stream_size, _ = row
        path = self.contents / bank["bundle"]
        with Bundle(path, self.chunks.get(path)) as b:
            self.chunks[path] = b.chunks
            data = b.read(bank["at"] + off, size)
        if stream_size:
            with open(path.with_name(path.name + ".stream"), "rb") as f:
                f.seek(bank["stream"] + stream_off)
                data += f.read(stream_size)
        return data[:HEAD], data[HEAD:]

    def wav(self, at: int) -> Path:
        """A clip decoded to WAV (cached)."""
        out = CACHE_DIR / "preview" / f"hd1-{at:x}.wav"
        with cache_lock(out):
            if not out.exists():
                out.parent.mkdir(parents=True, exist_ok=True)
                head, audio = self._bytes(at)
                tag, channels, rate, _, _, bits = struct.unpack_from("<HHIIHH", head, 48)
                tmp = out.with_name(f"{out.stem}.partial.wav")
                if tag == VORBIS:
                    ogg = out.with_suffix(".ogg")
                    ogg.write_bytes(audio)
                    try:
                        subprocess.run([wem.FFMPEG, "-v", "error", "-y", "-i", str(ogg), "-c:a", "pcm_s16le", str(tmp)],
                                       check=True, capture_output=True)
                    finally:
                        ogg.unlink(missing_ok=True)
                elif tag == PCM:
                    with wave.open(str(tmp), "wb") as w:
                        w.setnchannels(channels)
                        w.setsampwidth(bits // 8)
                        w.setframerate(rate)
                        w.writeframes(audio)
                else:
                    raise ValueError(f"clip {at & LOW:016x} has audio of kind {tag:#x}")
                tmp.replace(out)
        return out

    def has(self, at: int) -> bool:
        return at in self.where


def _shell(iid: str, name: str, about: str, category: str, preview: str, count: int) -> dict:
    """An item, shaped like one of the Index (library.py)."""
    return {"id": iid, "name": name, "full": name, "about": about, "kind": "sounds", "role": "", "category": category,
            "parts": [], "targets": [], "duration_ms": 0, "preview": preview, "around": [], "shares": [], "count": count,
            "game": "hd1"}


def _shape(cue_id: str, name: str, path: list[str], groups: list[dict], rows: list[dict]) -> dict:
    """A cue view, shaped like one of the Library's (library.py)."""
    return {"id": cue_id, "kind": "sounds", "path": path, "name": name, "detail": "", "locked": False, "curated": False,
            "segments": len(groups), "notes": "", "slots": [r["source"] for r in rows], "duration_ms": 0, "archives": 0,
            "contexts": 0, "archive_names": [], "segments_detail": groups, "context_list": [], "labels": [], "tags": [],
            "bank_name": "", "language": "", "game": "hd1"}
