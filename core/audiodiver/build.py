"""Builds a project into a verified patch and an HD2 Arsenal ZIP."""
import hashlib
import tempfile
import time
from pathlib import Path

from . import akd, arsenal, patch, strings, wem
from .errors import os_error
from .game import in_game_folder
from .index import AudioIndex, CACHE_DIR
from .project import Project

PATCH = "9ba626afa44a3aa3.patch_0"


class BuildError(Exception):
    """Why a build can't be made, in words for the person building."""
    for_people = True


def encode_cached(src: Path, quality: float = 6, log=None) -> bytes:
    """The Vorbis .wem of src, encoded once per content (wav2wem + channel-config fix + vgmstream check)."""
    key = hashlib.sha1(src.read_bytes() + f"q{quality}".encode()).hexdigest()[:16]
    out = CACHE_DIR / "wem" / f"{key}.wem"
    if not out.exists():
        if log:
            log(f"encoding {src.name}")
        out.parent.mkdir(parents=True, exist_ok=True)
        tmp = out.with_name(f"{key}.partial.wem")
        wem.encode(str(src), str(tmp), quality)
        tmp.replace(out)
    return out.read_bytes()


def replacements(project: Project, ix: AudioIndex, log=None, step=None) -> list[patch.Replacement]:
    """step(doing, done, total), when given, hears of each file as it is encoded (the job's progress; it may stop
    the build there)."""
    sources = [project.audio_path(r) for r in project.replacements]  # silence: the built-in silence file
    heard = sorted({src for r, src in zip(project.replacements, sources) if not r.silence})
    analysis = akd.analyse_files(heard) if project.loudness_analysis and heard else {}
    out, by_sound = [], {}
    for i, (r, src) in enumerate(zip(project.replacements, sources)):
        name = r.label or ("silence" if r.silence else Path(r.audio).name)
        if step:
            step(f"Encoding {name}", i, len(sources))
        try:
            sid = ix.resolve(r.target)
        except KeyError:
            raise BuildError(f"{name}: sound {r.target} isn't in this version of the game") from None
        if sid in by_sound:
            raise BuildError(f"{by_sound[sid]} and {name} replace the same sound")
        by_sound[sid] = name
        data = encode_cached(src, log=log)
        if project.loudness_analysis and not r.silence:
            data = akd.insert(data, analysis[src])
        out.append(patch.Replacement(sid, data, fit_timing=r.fit_timing, makeup_db=r.gain_db, mute=r.silence))
    return out


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


def build(project: Project, ix: AudioIndex, out_dir=None, version=None, log=print, step=None) -> Path:
    """Writes <out_dir>/<name>-<version>.zip and returns its path; out_dir defaults to the project's build folder.
    step(doing, done, total), when given, follows the build (the job's progress; it may stop the build there).
    The patch and the icon are made and checked in a scratch folder, so the ZIP is all a build adds to out_dir:
    any folder can take builds, also one that other mods build into."""
    t0 = time.time()
    out_dir = Path(out_dir or project.build_dir())
    if in_game_folder(out_dir, ix.game.data):  # a project file can name any folder; the editor refuses this one
        raise BuildError(f"{out_dir} is inside the game's folder, and Audiodiver never writes there. Choose another "
                         f"folder for the builds.")
    if problems := project.problems():
        raise BuildError("Project problems:\n  " + "\n  ".join(problems))
    icon = icon_bytes(project)  # an image that can't be read fails the build before the long part
    with tempfile.TemporaryDirectory(prefix="audiodiver-build-", ignore_cleanup_errors=True) as scratch:
        patch_dir = Path(scratch) / "patch"
        patch_dir.mkdir()
        steps = len(project.replacements) + 3  # every file, then the banks, the check and the ZIP
        reps = replacements(project, ix, log, step)
        if step:
            step("Patching the sound banks", steps - 3, steps)
        log(f"patching the banks that hold or play {len(reps)} sound{'s' if len(reps) != 1 else ''}")
        tables = text_tables(project, strings.Texts(ix.game), log) if project.texts else {}
        edits = patch.build_patch(str(patch_dir / PATCH), reps, ix, project.segment_overrides, tables)
        missing = set(project.segment_overrides) - {s for e in edits.values() for s in e.segments}
        if missing:
            raise BuildError(f"Segment overrides matched no segment of a replaced clip: {sorted(missing)}")
        if step:
            step("Checking the patch", steps - 2, steps)
        if problems := patch.verify(str(patch_dir / PATCH), reps, ix) + patch.verify_strings(str(patch_dir / PATCH), tables):
            raise BuildError("The patch failed verification:\n  " + "\n  ".join(problems))
        gains = sum(len(e.gains) for e in edits.values())
        mutes = sum(len(e.mutes) for e in edits.values())
        log(f"{len(reps)} replacements -> {len(edits)} banks patched"
            + (f", make-up gain on {gains} objects" if gains else "")
            + (f", {mutes} silenced sounds taken out of the mix" if mutes else "") + f", verified ({time.time() - t0:.0f}s)")

        icon_path = Path(scratch) / "icon.png"
        icon_path.write_bytes(icon)
        version = version or project.version
        if step:
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
