"""Builds a project into a verified patch and an HD2 Arsenal ZIP."""
import hashlib
import struct
import subprocess
import tempfile
import time
from pathlib import Path

from . import addition, akd, arsenal, cuemap, music, patch, radio, soundtrack, strings, wem
from .errors import os_error
from .game import in_game_folder
from .i18n import ntr, tr
from .index import AudioIndex, CACHE_DIR
from .project import Project

PATCH = "9ba626afa44a3aa3.patch_0"


class BuildError(Exception):
    """Why a build can't be made, in words for the person building."""
    for_people = True


def _encoded(wav: bytes, quality: float) -> Path:
    """Where the encoding of this audio is cached."""
    return CACHE_DIR / "wem" / f"{hashlib.sha1(wav + f'q{quality}'.encode()).hexdigest()[:16]}.wem"


def ready_wem(src: Path, data: bytes) -> bytes | None:
    """A .wem the game plays as it is: mono or stereo Wwise Vorbis as the game's clips are, the fmt chunk first (where
    patch.Replacement reads it), and read whole by vgmstream; with the channel config set where its encoder left it
    empty. None for any other file, which is encoded."""
    fmt = wem.vorbis_fmt(data) if src.suffix.lower() == ".wem" else None
    if fmt != 20 or struct.unpack_from("<H", data, fmt + 2)[0] not in (1, 2):
        return None
    wem.decoded(src)  # cached since the file was chosen, unless it changed since
    return bytes(wem.fix_channel_config(bytearray(data)))


def encode_cached(src: Path, quality: float = 6, log=None) -> bytes:
    """The Vorbis .wem of src, encoded once per content (wav2wem + channel-config fix + vgmstream check). A .wem the
    game plays as it is goes in unchanged (ready_wem), not encoded a second time."""
    data = src.read_bytes()
    if (ready := ready_wem(src, data)) is not None:
        return ready
    out = _encoded(data, quality)
    key = out.stem
    if not out.exists():
        if log:
            log(tr("encoding {file}").format(file=src.name))
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


def curve_plan(project: Project, ix: AudioIndex, log=None) -> tuple[set[int], dict]:
    """The clips that lose the game's volume curves (Project.curves_off), and a mod's curves by track (Project.curves),
    as this game version has them."""
    off, gone = set(), 0
    for target in project.curves_off:
        try:
            off.add(ix.resolve(target))
        except KeyError:
            gone += 1
    tracks = {t: [music.ClipCurve(*c) for c in curves] for t, curves in project.curves.items() if ix.copies(t)}
    gone += len(project.curves) - len(tracks)
    if gone and log:
        log(ntr("curves: {n} sound or track is not in this game version; left out",
                "curves: {n} sounds or tracks are not in this game version; left out", gone).format(n=gone))
    return off, tracks


def replacements(project: Project, ix: AudioIndex, log=None, step=None) -> list[patch.Replacement]:
    """The project's new audio, encoded, then its Make-Up Gain on original audio (Project.gains) as replacements
    that keep the game's clip; a gain on a sound with new audio is left out, as the new audio's own applies.
    step(doing, done, total), when given, hears of each file as it is encoded (the job's progress; it may stop
    the build there)."""
    sources = []
    for r in project.replacements:
        try:
            sources.append(project.heard_path(r))  # silence: the built-in silence file
        except (subprocess.CalledProcessError, ValueError, OSError):
            raise BuildError(tr("{name}: can't read the audio in {file}").format(name=r.label or r.audio, file=Path(r.audio).name)) from None
    heard = sorted({src for r, src in zip(project.replacements, sources) if not r.silence})
    analysis = akd.analyse_files(heard) if project.loudness_analysis and heard else {}
    out, by_sound, added = [], {}, project.added()
    for i, (r, src) in enumerate(zip(project.replacements, sources)):
        name = r.label or (tr("silence") if r.silence else Path(r.audio).name)
        if step:
            step(tr("Encoding {name}").format(name=name), i, len(sources))
        try:
            sid = r.target if r.target in added else ix.resolve(r.target)
        except KeyError:
            raise BuildError(tr("{name}: sound {id} isn't in this version of the game").format(name=name, id=r.target)) \
                from None
        if sid in by_sound:
            raise BuildError(tr("{names} and {last} replace the same sound").format(names=by_sound[sid], last=name))
        by_sound[sid] = name
        # an encoding cached before Audiodiver set the hash, or a mod's own, may give another setup's
        try:
            data = wem.with_codebook_hash(encode_cached(src, log=log))
        except subprocess.CalledProcessError:
            raise BuildError(tr("{name}: can't read the audio in {file}").format(name=name, file=src.name)) from None
        if project.loudness_analysis and not r.silence and akd.get_chunk(data, b"akd ") is None:  # a mod's own may have it
            data = akd.insert(data, analysis[src])
        out.append(patch.Replacement(sid, data, fit_timing=r.fit_timing, makeup_db=r.gain_db, mute=r.silence))
    gone = 0
    for target, db in project.gains.items():
        try:
            sid = target if target in added else ix.resolve(target)
        except KeyError:
            gone += 1
            continue
        if sid not in by_sound:
            by_sound[sid] = tr("sound {id}").format(id=target)
            out.append(patch.Replacement(sid, None, makeup_db=db))
    if gone and log:
        log(ntr("gain: {n} sound with Make-Up Gain on the original is not in this game version; left out",
                "gain: {n} sounds with Make-Up Gain on the original are not in this game version; left out", gone)
            .format(n=gone))
    gone, reps = 0, {r.source: r for r in out}
    for target, (low, high) in project.filters.items():
        try:
            sid = target if target in added else ix.resolve(target)
        except KeyError:
            gone += 1
            continue
        if sid not in reps:
            reps[sid] = patch.Replacement(sid, None)
            out.append(reps[sid])
        reps[sid].lowpass, reps[sid].highpass = low, high
    if gone and log:
        log(ntr("filters: {n} sound with a filter is not in this game version; left out",
                "filters: {n} sounds with a filter are not in this game version; left out", gone).format(n=gone))
    return out


def own_banks(project: Project, ix: AudioIndex, listed=None):
    """With project_banks_only (and every_bank off), what keeps a list of banks with copies of something to the
    project's: those the imported mods patched, else those of what the list holds (listed: Library.banks of it), as
    reach keeps a sound; all of them when none is, or when one is a music bank (music keeps every copy, see reach).
    None without project_banks_only: added audio and settings go into every copy."""
    if project.every_bank or not project.project_banks_only:
        return None
    mod, listed, music = set(project.imported_banks), set(listed or ()), set(ix.music_banks)

    def keep(banks):
        banks = list(banks)
        if music & set(banks):
            return banks
        return [b for b in banks if b in mod] or [b for b in banks if b in listed] or banks
    return keep


def additions(project: Project, ix: AudioIndex, reps: list[patch.Replacement], listed=None) -> addition.Plan:
    """What the project adds to the game's banks, with the new clips' audio (reps, encoded). A take or own clip
    without audio adds nothing, and a layer without takes neither. Each goes into every bank with a copy of what it
    changes, or only into the project's banks (own_banks; listed as there)."""
    if not project.additions:
        return addition.Plan()
    wem_of = {r.source: r.wem for r in reps if r.wem is not None}
    clash = sorted(project.made_ids() & ix.taken)
    if clash:
        raise BuildError(tr("Since the last game update, the game uses some IDs that the added audio also uses ({ids}). "
                            "Remove that audio and add it again.").format(ids=", ".join(map(str, clash[:3]))))
    takes = [addition.Take(a.container, a.sound, a.source, wem_of[a.source]) for a in project.additions
             if a.kind == "take" and a.source in wem_of]
    layers = [addition.Layer(a.container, a.beside) for a in project.additions
              if a.kind == "layer" and any(t.to == a.container for t in takes)]
    own = [addition.Own(a.sound, a.source, wem_of[a.source]) for a in project.additions
           if a.kind == "own" and a.source in wem_of]
    try:
        return addition.plan(ix, takes, layers, own, project.made_ids(), own_banks(project, ix, listed))
    except addition.AdditionError as e:
        raise BuildError(tr("Added audio: {problem}").format(problem=e)) from None


def reach(project: Project, ix: AudioIndex, reps: list[patch.Replacement], settings: dict, listed=None) \
        -> tuple[dict[int, set[int]], dict[int, set[int]]]:
    """({source: banks}, {object: banks}): where the replaced sounds and the settings go, when the project keeps to
    its banks (Project.every_bank off). A sound goes into the banks the mods imported into the project patched that
    have it, else into the banks of what the project lists that have it (listed: Library.banks of its list), else
    into every bank that has it. A bank that only plays a sound takes its audio from one that holds it, so the
    holders join when none of them is among those; a streamed sound's holders all join, as each has the start of
    the stream; a gain or filter on the original moves no audio, so they don't. Music keeps every bank. The game uses the first loaded copy of an object, every mission music bank
    has copies of every faction's music, and music_init, loaded first, has copies of much of it (nearly all of the
    second Automaton set's): a track retimed in one bank can play with another's old timing and cut off. Which
    copies a mission loads isn't known, so all of them get the new timing. Settings, from imported mods, go into the
    copies in the banks those mods patched; with project_banks_only, every setting keeps to the project's banks
    (own_banks). A sound or object left out goes into every bank that has it."""
    if project.every_bank:
        return {}, {}
    mod, listed, music = set(project.imported_banks), set(listed or ()), set(ix.music_banks)
    sounds = {}
    for r in reps:
        every = ix.banks_for(r.source)
        if every & music or not (mine := every & mod or every & listed):
            continue
        holders = ix.holders.get(r.source, set())
        if r.wem is not None and (ix.stream_file(r.source) is not None or not mine & holders):
            mine |= holders
        sounds[r.source] = mine
    if keep := own_banks(project, ix, listed):
        objects = {o: set(keep(copies)) for o in settings if (copies := ix.copies(o))}
    else:
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
    if n := len(plan.skipped):
        log(ntr("soundtrack: {n} piece of music the project sets is not in this game version; left out",
                "soundtrack: {n} pieces of music the project sets are not in this game version; left out", n).format(n=n))
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
    if plan:  # a list of what changed, each part whole
        done = [ntr("{n} playlist in a new order", "{n} playlists in a new order", changed).format(n=changed),
                ntr("{n} piece led elsewhere", "{n} pieces led elsewhere", len(plan.routes)).format(n=len(plan.routes))]
        if levels:
            done.append(ntr("levels on {n} track", "levels on {n} tracks", len(levels)).format(n=len(levels)))
        log(tr("soundtrack: {changes}").format(changes=", ".join(done)))
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
            log(ntr("text: table {table} is not in this game version; the {n} line changed in it is left out",
                    "text: table {table} is not in this game version; the {n} lines changed in it are left out",
                    len(edits)).format(table=fid, n=len(edits)))
            continue
        changed = [i for i, t in edits.items() if i in live and t.was and live[i] != t.was]
        if changed:
            log(ntr("text: the game changed {n} line since the project changed it (ID {ids}); the project's is used",
                    "text: the game changed {n} lines since the project changed them (IDs {ids}); the project's are used",
                    len(changed)).format(n=len(changed), ids=changed[:5]))
        out[fid], missing = texts.apply(fid, {i: t.text for i, t in edits.items()})
        applied += len(edits) - len(missing)
        if missing:
            log(ntr("text: {n} line is not in table {table} any more and is left out (ID {ids})",
                    "text: {n} lines are not in table {table} any more and are left out (IDs {ids})",
                    len(missing)).format(n=len(missing), table=fid, ids=missing[:5]))
    if out:  # the lines inside the count of tables, which the sentence turns on
        lines = ntr("{n} line", "{n} lines", applied).format(n=applied)
        log(ntr("text: {lines} in {n} table", "text: {lines} in {n} tables", len(out)).format(lines=lines, n=len(out)))
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
        raise BuildError(tr("Project problems:") + "\n  " + "\n  ".join(problems))
    steps = len(project.replacements) + 2 + after  # every file, then the banks and the check
    reps = replacements(project, ix, log, step)
    if step:
        step(tr("Patching the sound banks"), steps - after - 2, steps)
    if project.every_bank:
        log(ntr("patching the banks that hold or play {n} sound", "patching the banks that hold or play {n} sounds",
                len(reps)).format(n=len(reps)))
    else:
        log(ntr("patching the project's banks that hold or play {n} sound",
                "patching the project's banks that hold or play {n} sounds", len(reps)).format(n=len(reps)))
    plan = additions(project, ix, reps, listed)
    tables = text_tables(project, strings.Texts(ix.game), log) if project.texts else {}
    # a setting taken away (None) came from a copy older than the game, in projects imported before that was known
    settings = {o: kept for o, s in project.settings.items()
                if ix.copies(o) and (kept := {k: v for k, v in s.items() if v is not None})}
    if gone := len({o for o in project.settings if not ix.copies(o)}):
        log(ntr("settings: {n} object the mod set is not in this game version; left out",
                "settings: {n} objects the mod set are not in this game version; left out", gone).format(n=gone))
    music_plan = soundtrack_plan(project, ix, reps, settings, log)
    where, set_where = reach(project, ix, reps, settings, listed)
    curves_off, track_curves = curve_plan(project, ix, log)
    radio_plan = radio.Plan(set(project.radio_off), project.radio_quieter)
    try:
        edits = patch.build_patch(str(patch_dir / PATCH), reps, ix, project.segment_overrides, tables, plan,
                                  settings, where, set_where, carried, music_plan, curves_off, track_curves, radio_plan)
    except patch.CueError as e:
        raise BuildError(tr("Music segment {segment}: the Entry cue point ({entry} s) is at or after the Exit ({exit} s), "
                            "so the game would play the music before it until the Entry. Move the cue points on the "
                            "Audio tab, or reset them.").format(segment=e.segment, entry=f"{e.entry_ms / 1000:.1f}",
                                                                exit=f"{e.exit_ms / 1000:.1f}")) from None
    if unused := set(project.segment_overrides) - {s for e in edits.values() for s in e.segments}:
        log(ntr("cue points of {n} segment without new audio left out",
                "cue points of {n} segments without new audio left out", len(unused)).format(n=len(unused)))
    if step:
        step(tr("Checking the patch"), steps - after - 1, steps)
    # what a check finds is a fault of Audiodiver's, for its log and a bug report: listed in English
    if problems := patch.verify(str(patch_dir / PATCH), reps, ix, plan, settings, where, music_plan, curves_off, track_curves, radio_plan) \
            + patch.verify_strings(str(patch_dir / PATCH), tables, [c.fid for c in carried if c.tid == strings.STRINGS]) \
            + (patch.verify_carried(str(patch_dir / PATCH), carried, tables) if carried else []):
        raise BuildError(tr("The patch failed verification:") + "\n  " + "\n  ".join(problems))
    gains = sum(len(e.gains) for e in edits.values())
    mutes = sum(len(e.mutes) for e in edits.values())
    set_on = len({i for e in edits.values() for i in e.settings})
    curved = len({i for e in edits.values() for i in e.curves})
    grown = sum(bool(e.added) for e in edits.values())
    made = sum(r.wem is not None for r in reps)
    # the summary: a list of what the build did, each part whole (the first turns on the count of banks)
    done = [ntr("{replacements} -> {n} bank patched", "{replacements} -> {n} banks patched", len(edits)).format(
        n=len(edits), replacements=ntr("{n} replacement", "{n} replacements", made).format(n=made))]
    if grown:
        done.append(ntr("added audio in {n} bank", "added audio in {n} banks", grown).format(n=grown))
    if gains:
        done.append(ntr("make-up gain on {n} object", "make-up gain on {n} objects", gains).format(n=gains))
    if mutes:
        done.append(ntr("{n} silenced sound taken out of the mix", "{n} silenced sounds taken out of the mix", mutes)
                    .format(n=mutes))
    if set_on:
        done.append(ntr("a mod's settings on {n} object", "a mod's settings on {n} objects", set_on).format(n=set_on))
    if curved:
        done.append(ntr("volume curves changed on {n} music track", "volume curves changed on {n} music tracks", curved).format(n=curved))
    if filtered := len({i for e in edits.values() for i in e.filters}):
        done.append(ntr("filters on {n} object", "filters on {n} objects", filtered).format(n=filtered))
    if radio_plan:
        buses = {i for e in edits.values() for i in e.radio}
        done.append(ntr("radio filter off on {n} bus", "radio filter off on {n} buses", len(buses)).format(n=len(buses)))
        if buses != radio_plan.buses():
            log(tr("radio filter: this game version has changed some of those buses, so they keep the filter"))
    done.append(tr("verified ({seconds}s)").format(seconds=f"{time.time() - t0:.0f}"))
    log(", ".join(done))
    if kept := len({(c.tid, c.fid) for c in carried} - {(strings.STRINGS, t) for t in tables}):
        log(ntr("{n} file besides audio (text, models, textures...) carried as it was",
                "{n} files besides audio (text, models, textures...) carried as they were", kept).format(n=kept))
    return edits


def build(project: Project, ix: AudioIndex, out_dir=None, version=None, log=print, step=None, listed=None,
          carried=None) -> Path:
    """Writes <out_dir>/<name>-<version>.zip and returns its path; out_dir defaults to the project's build folder.
    step(doing, done, total), when given, follows the build (the job's progress; it may stop the build there).
    The patch and the icon are made and checked in a scratch folder, so the ZIP is all a build adds to out_dir
    (with the project's patch_files, also a folder named like the ZIP holding the patch files): any folder can take
    builds, also one that other mods build into."""
    out_dir = Path(out_dir or project.build_dir())
    if in_game_folder(out_dir, ix.game.data):  # a project file can name any folder; the editor refuses this one
        raise BuildError(tr("{folder} is inside the game folder, and Audiodiver never writes there. Choose another "
                            "folder for the builds.").format(folder=out_dir))
    if problems := project.problems():
        raise BuildError(tr("Project problems:") + "\n  " + "\n  ".join(problems))
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
            step(tr("Packing the ZIP"), steps - 1, steps)
        try:
            out_dir.mkdir(parents=True, exist_ok=True)
            zip_path = arsenal.package(out_dir / zip_name(project, version), name=project.name,
                                       guid=project.guid, icon=icon_path, description=project.description,
                                       options=[{"name": project.name, "description": "", "folder": patch_dir}])
        except OSError as e:
            raise BuildError(tr("Can't write the ZIP into {folder}: {why}").format(folder=out_dir, why=os_error(e))) \
                from None
        # the ZIP's path first, no words: Session.combine leaves out the line that starts with its temp folder
        log(f"{zip_path} ({zip_path.stat().st_size / 1e6:.1f} MB)")
        if project.patch_files:
            folder = out_dir / zip_path.stem
            try:
                arsenal.save_patch_files(patch_dir, folder)
            except OSError as e:
                raise BuildError(tr("Can't save the patch files into {folder}: {why}").format(folder=folder,
                                                                                            why=os_error(e))) from None
            log(tr("patch files in {folder}").format(folder=folder))
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
        raise BuildError(tr("Icon: {why}").format(why=os_error(e))) from None
    except ValueError as e:
        raise BuildError(tr("Icon: {why}").format(why=e)) from None
