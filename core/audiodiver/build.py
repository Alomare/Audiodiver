"""Builds a project into a verified patch and an HD2 Arsenal ZIP."""
import hashlib
import tempfile
import time
from pathlib import Path

from . import addition, akd, arsenal, cuemap, patch, soundtrack, strings, wem
from .errors import os_error
from .game import in_game_folder
from .index import AudioIndex, CACHE_DIR
from .project import Project

PATCH = "9ba626afa44a3aa3.patch_0"


class BuildError(Exception):
    """Why a build can't be made, in words for the person building."""
    for_people = True


def _encoded(wav: bytes, quality: float) -> Path:
    """Where the encoding of this audio is cached."""
    return CACHE_DIR / "wem" / f"{hashlib.sha1(wav + f'q{quality}'.encode()).hexdigest()[:16]}.wem"


def encode_cached(src: Path, quality: float = 6, log=None) -> bytes:
    """The Vorbis .wem of src, encoded once per content (wav2wem + channel-config fix + vgmstream check)."""
    out = _encoded(src.read_bytes(), quality)
    key = out.stem
    if not out.exists():
        if log:
            log(f"encoding {src.name}")
        out.parent.mkdir(parents=True, exist_ok=True)
        tmp = out.with_name(f"{key}.partial.wem")
        wem.encode(str(src), str(tmp), quality)
        tmp.replace(out)
    return out.read_bytes()


def keep_encoding(wav: Path, data: bytes, quality: float = 6):
    """Takes the .wem a wav was decoded from (a mod's patch, imported) as that wav's encoding: built unchanged, it
    ships as the mod had it, not encoded a second time. Audio changed since is new content, and is encoded."""
    out = _encoded(wav.read_bytes(), quality)
    if not out.exists():
        out.parent.mkdir(parents=True, exist_ok=True)
        tmp = out.with_name(f"{out.stem}.partial.wem")
        tmp.write_bytes(data)
        tmp.replace(out)


def replacements(project: Project, ix: AudioIndex, log=None, step=None) -> list[patch.Replacement]:
    """step(doing, done, total), when given, hears of each file as it is encoded (the job's progress; it may stop
    the build there)."""
    sources = [project.audio_path(r) for r in project.replacements]  # silence: the built-in silence file
    heard = sorted({src for r, src in zip(project.replacements, sources) if not r.silence})
    analysis = akd.analyse_files(heard) if project.loudness_analysis and heard else {}
    out, by_sound, added = [], {}, project.added()
    for i, (r, src) in enumerate(zip(project.replacements, sources)):
        name = r.label or ("silence" if r.silence else Path(r.audio).name)
        if step:
            step(f"Encoding {name}", i, len(sources))
        try:
            sid = r.target if r.target in added else ix.resolve(r.target)
        except KeyError:
            raise BuildError(f"{name}: sound {r.target} isn't in this version of the game") from None
        if sid in by_sound:
            raise BuildError(f"{by_sound[sid]} and {name} replace the same sound")
        by_sound[sid] = name
        data = encode_cached(src, log=log)
        if project.loudness_analysis and not r.silence and akd.get_chunk(data, b"akd ") is None:  # a mod's own may have it
            data = akd.insert(data, analysis[src])
        out.append(patch.Replacement(sid, data, fit_timing=r.fit_timing, makeup_db=r.gain_db, mute=r.silence))
    return out


def additions(project: Project, ix: AudioIndex, reps: list[patch.Replacement]) -> addition.Plan:
    """What the project adds to the game's banks, with the new clips' audio (reps, encoded). A take or own clip
    without audio adds nothing, and a layer without takes neither."""
    if not project.additions:
        return addition.Plan()
    wem_of = {r.source: r.wem for r in reps}
    clash = sorted(project.made_ids() & ix.taken)
    if clash:
        raise BuildError(f"Since the last game update, the game uses some ids that the added audio also uses "
                         f"({', '.join(map(str, clash[:3]))}). Remove that audio and add it again.")
    takes = [addition.Take(a.container, a.sound, a.source, wem_of[a.source]) for a in project.additions
             if a.kind == "take" and a.source in wem_of]
    layers = [addition.Layer(a.container, a.beside) for a in project.additions
              if a.kind == "layer" and any(t.to == a.container for t in takes)]
    own = [addition.Own(a.sound, a.source, wem_of[a.source]) for a in project.additions
           if a.kind == "own" and a.source in wem_of]
    try:
        return addition.plan(ix, takes, layers, own, project.made_ids())
    except addition.AdditionError as e:
        raise BuildError(f"Added audio: {e}") from None


def reach(project: Project, ix: AudioIndex, reps: list[patch.Replacement], settings: dict, listed=None) \
        -> tuple[dict[int, set[int]], dict[int, set[int]]]:
    """({source: banks}, {object: banks}): where the replaced sounds and the settings go, when the project keeps to
    its banks (Project.every_bank off). A sound goes into the banks the mods imported into the project patched that
    have it, else into the banks of what the project lists that have it (listed: Library.banks of its list), else
    into every bank that has it. A bank that only plays a sound takes its audio from one that holds it, so the
    holders join when none of them is among those; a streamed sound's holders all join, as each has the start of
    the stream. Music keeps every bank. The game uses the first loaded copy of an object, every mission music bank
    has copies of every faction's music, and music_init, loaded first, has copies of much of it (nearly all of the
    second Automaton set's): a track retimed in one bank can play with another's old timing and cut off. Which
    copies a mission loads isn't known, so all of them get the new timing. Settings, from imported mods, go into the
    copies in the banks those mods patched. A sound or object left out goes into every bank that has it."""
    if project.every_bank:
        return {}, {}
    mod, listed, music = set(project.imported_banks), set(listed or ()), set(ix.music_banks)
    sounds = {}
    for r in reps:
        every = ix.banks_for(r.source)
        if every & music or not (mine := every & mod or every & listed):
            continue
        holders = ix.holders.get(r.source, set())
        if ix.stream_file(r.source) is not None or not mine & holders:
            mine |= holders
        sounds[r.source] = mine
    objects = {o: mine for o in settings if (mine := set(ix.copies(o)) & mod)}
    return sounds, objects


def soundtrack_plan(project: Project, ix: AudioIndex, reps: list[patch.Replacement], settings: dict, log=print) \
        -> soundtrack.Plan:
    """The Soundtrack's changes to the game's music objects (soundtrack.plan), and its levels: a piece's level goes
    on top of the gain of the new audio in its tracks, and onto its other tracks as a setting (`settings`, changed
    here)."""
    if not project.soundtrack:
        return soundtrack.Plan()
    objs, tracks, *_ = cuemap.load_music(ix)
    plan = soundtrack.plan(objs, project.soundtrack)
    if plan.skipped:
        log(f"soundtrack: {len(plan.skipped)} piece{'s' if len(plan.skipped) != 1 else ''} of music the project sets "
            f"{'are' if len(plan.skipped) != 1 else 'is'} not in this game version; left out")
    levels = soundtrack.levels(objs, project.soundtrack)
    if levels:
        by_source = {r.source: r for r in reps}
        for tid, db in levels.items():
            heard = [by_source[s] for s in tracks[tid].sources if s in by_source] if tid in tracks else []
            for r in heard:
                r.makeup_db += db
            if not heard:
                settings.setdefault(tid, {})[patch.MAKEUP_GAIN] = db
    changed = len([o for o in plan.objects if o in plan.roots])
    if plan:
        log(f"soundtrack: {changed} playlist{'s' if changed != 1 else ''} in a new order, "
            f"{len(plan.routes)} piece{'s' if len(plan.routes) != 1 else ''} led elsewhere"
            + (f", levels on {len(levels)} tracks" if levels else ""))
    return plan


def text_tables(project: Project, texts, log=print) -> dict[int, bytes]:
    """{file id: table bytes} of the string tables the project changes: each the live table with the project's lines
    in it. A line the game no longer has is left out, and a line the game changed since it was edited is named."""
    by_table = {}
    for t in project.texts:
        by_table.setdefault(t.table, {})[t.id] = t
    out, applied = {}, 0
    for fid, edits in by_table.items():
        try:
            live = texts.table(fid).texts
        except KeyError:
            log(f"text: table {fid} is not in this game version; its {len(edits)} lines are left out")
            continue
        changed = [i for i, t in edits.items() if i in live and t.was and live[i] != t.was]
        if changed:
            log(f"text: the game changed {len(changed)} line(s) since the project changed them (ids {changed[:5]}); the project's are used")
        out[fid], missing = texts.apply(fid, {i: t.text for i, t in edits.items()})
        applied += len(edits) - len(missing)
        if missing:
            log(f"text: {len(missing)} line(s) are not in table {fid} any more and are left out (ids {missing[:5]})")
    if out:
        log(f"text: {applied} line{'s' if applied != 1 else ''} in {len(out)} table{'s' if len(out) != 1 else ''}")
    return out


def make_patch(project: Project, ix: AudioIndex, patch_dir: Path, log=print, step=None, after=0, listed=None,
               carried=None) -> dict:
    """Writes the project's patch (patch_dir/PATCH and its .stream) and checks it; returns {bank id: BankEdit}.
    step(doing, done, total) follows it, counting `after` more steps the caller takes once the patch is made.
    listed: the banks of what the project lists (Library.banks), where its sounds go (reach). carried: a mod's files
    besides its audio (patch.Carried), which go in as they were."""
    carried = carried or []
    t0 = time.time()
    if problems := project.problems():
        raise BuildError("Project problems:\n  " + "\n  ".join(problems))
    steps = len(project.replacements) + 2 + after  # every file, then the banks and the check
    reps = replacements(project, ix, log, step)
    if step:
        step("Patching the sound banks", steps - after - 2, steps)
    log(f"patching the {'' if project.every_bank else "project's "}banks that hold or play {len(reps)} "
        f"sound{'s' if len(reps) != 1 else ''}")
    plan = additions(project, ix, reps)
    tables = text_tables(project, strings.Texts(ix.game), log) if project.texts else {}
    # a setting taken away (None) came from a copy older than the game, in projects imported before that was known
    settings = {o: kept for o, s in project.settings.items()
                if ix.copies(o) and (kept := {k: v for k, v in s.items() if v is not None})}
    if gone := len({o for o in project.settings if not ix.copies(o)}):
        log(f"settings: {gone} object{'s' if gone != 1 else ''} the mod set {'are' if gone != 1 else 'is'} not in "
            f"this game version; left out")
    music_plan = soundtrack_plan(project, ix, reps, settings, log)
    where, set_where = reach(project, ix, reps, settings, listed)
    try:
        edits = patch.build_patch(str(patch_dir / PATCH), reps, ix, project.segment_overrides, tables, plan,
                                  settings, where, set_where, carried, music_plan)
    except patch.CueError as e:
        raise BuildError(f"Music segment {e.segment}: the Entry cue point ({e.entry_ms / 1000:.1f} s) is at or "
                         f"after the Exit ({e.exit_ms / 1000:.1f} s), so the game would play the music before it "
                         f"until the Entry. Move the cue points on the Audio tab, or reset them.") from None
    if unused := set(project.segment_overrides) - {s for e in edits.values() for s in e.segments}:
        log(f"cue points of {len(unused)} segment{'s' if len(unused) != 1 else ''} without new audio left out")
    if step:
        step("Checking the patch", steps - after - 1, steps)
    if problems := patch.verify(str(patch_dir / PATCH), reps, ix, plan, settings, where, music_plan) \
            + patch.verify_strings(str(patch_dir / PATCH), tables, [c.fid for c in carried if c.tid == strings.STRINGS]) \
            + (patch.verify_carried(str(patch_dir / PATCH), carried, tables) if carried else []):
        raise BuildError("The patch failed verification:\n  " + "\n  ".join(problems))
    gains = sum(len(e.gains) for e in edits.values())
    mutes = sum(len(e.mutes) for e in edits.values())
    set_on = len({i for e in edits.values() for i in e.settings})
    grown = sum(bool(e.added) for e in edits.values())
    log(f"{len(reps)} replacements -> {len(edits)} banks patched"
        + (f", added audio in {grown}" if grown else "")
        + (f", make-up gain on {gains} objects" if gains else "")
        + (f", {mutes} silenced sounds taken out of the mix" if mutes else "")
        + (f", a mod's settings on {set_on} objects" if set_on else "") + f", verified ({time.time() - t0:.0f}s)")
    if kept := len({(c.tid, c.fid) for c in carried} - {(strings.STRINGS, t) for t in tables}):
        log(f"{kept} file{'s' if kept != 1 else ''} besides audio (text, models, textures...) carried as "
            f"{'they were' if kept != 1 else 'it was'}")
    return edits


def build(project: Project, ix: AudioIndex, out_dir=None, version=None, log=print, step=None, listed=None,
          carried=None) -> Path:
    """Writes <out_dir>/<name>-<version>.zip and returns its path; out_dir defaults to the project's build folder.
    step(doing, done, total), when given, follows the build (the job's progress; it may stop the build there).
    The patch and the icon are made and checked in a scratch folder, so the ZIP is all a build adds to out_dir:
    any folder can take builds, also one that other mods build into."""
    out_dir = Path(out_dir or project.build_dir())
    if in_game_folder(out_dir, ix.game.data):  # a project file can name any folder; the editor refuses this one
        raise BuildError(f"{out_dir} is inside the game folder, and Audiodiver never writes there. Choose another "
                         f"folder for the builds.")
    if problems := project.problems():
        raise BuildError("Project problems:\n  " + "\n  ".join(problems))
    icon = icon_bytes(project)  # an image that can't be read fails the build before the long part
    with tempfile.TemporaryDirectory(prefix="audiodiver-build-", ignore_cleanup_errors=True) as scratch:
        patch_dir = Path(scratch) / "patch"
        patch_dir.mkdir()
        make_patch(project, ix, patch_dir, log, step, after=1, listed=listed, carried=carried)
        icon_path = Path(scratch) / "icon.png"
        icon_path.write_bytes(icon)
        version = version or project.version
        if step:
            steps = len(project.replacements) + 3
            step("Packing the ZIP", steps - 1, steps)
        try:
            out_dir.mkdir(parents=True, exist_ok=True)
            zip_path = arsenal.package(out_dir / zip_name(project, version), name=project.name,
                                       guid=project.guid, icon=icon_path, description=project.description,
                                       options=[{"name": project.name, "description": "", "folder": patch_dir}])
        except OSError as e:
            raise BuildError(f"Can't write the ZIP into {out_dir}: {os_error(e)}") from None
    log(f"{zip_path} ({zip_path.stat().st_size / 1e6:.1f} MB)")
    return zip_path


def zip_name(project: Project, version=None) -> str:
    return f"{arsenal.slug(project.name)}-{version or project.version}.zip"


def icon_bytes(project: Project, icon: dict | None = None) -> bytes:
    """The mod's icon as Arsenal gets it, a 540x540 PNG: the project's image fitted to that, or Audiodiver's default
    icon, either one in the icon's frame. icon stands in for the saved one (the editor's preview while a border is
    tried)."""
    icon = project.icon if icon is None else icon
    try:
        if icon.get("image"):
            return arsenal.icon_png(project.file(icon["image"]), icon)
        return arsenal.default_icon(icon)
    except OSError as e:
        raise BuildError(f"Icon: {os_error(e)}") from None
    except ValueError as e:
        raise BuildError(f"Icon: {e}") from None
