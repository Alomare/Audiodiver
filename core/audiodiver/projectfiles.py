"""A project's folder: which files a project uses, and keeping them together with it.

A project has a folder of its own, named like its file: `Dune/Dune.audi`. What Audiodiver makes for it goes into
`audio` there (`slices`, the slice tool's pieces; `imported`, a mod's patch decoded; `added`, files collected from
elsewhere), and its builds into `build`. Audio a person picks stays where it is, and the project points at it.
Projects from before this layout can sit several to a folder, with `slices` and `imported` beside them; they keep
working there, and move() gives one a folder of its own.

Paths in a project file are relative to it (absolute on another drive), so moving or packing one rewrites them
(rebase). A pack (`.audipack`) is a ZIP of a project and the files it uses, and nothing else: `<name>/<name>.audi`,
its files where its folder has them, and files from elsewhere in `audio/added`. Builds aren't packed.
"""
import filecmp
import functools
import json
import os
import re
import shutil
import zipfile
from pathlib import Path, PurePosixPath

AUDIO = "audio"
MADE = ("slices", "imported", "added")  # Audiodiver's folders in a project's audio folder
LEGACY = ("slices", "imported")         # where they were before, beside the project file
# Beside the project file, a folder named like these can be a person's own (a project on the Desktop), so only the
# files named as Audiodiver named them count as its: a song's pieces in slices/<song>-<6 hex>/<8 hex>/ with the cut
# points in slices/<song>-<6 hex>/cuts.json, and a patch's audio in imported/<archive>/<source>.wav (a repatched
# mod's in imported/<source>.wav). LEGACY_DIRS are the folders those files are in.
LEGACY_FILES = {
    "slices": re.compile(r"[^/]+-[0-9a-f]{6}/(?:cuts\.json|\.?[0-9a-f]{8}(?:\.partial)?/[^/]+\.wav)", re.I),
    "imported": re.compile(r"(?:(?:[0-9a-f]{16}|[^/]+-[0-9a-f]{8})/)?\d{5,20}\.(?:wav|wem)", re.I),
}
LEGACY_DIRS = {
    "slices": re.compile(r"[^/]+-[0-9a-f]{6}(?:/\.?[0-9a-f]{8}(?:\.partial)?)?", re.I),
    "imported": re.compile(r"[0-9a-f]{16}|[^/]+-[0-9a-f]{8}", re.I),
}
PACK = ".audipack"
# kept as they are in a pack: compressing them again saves nothing
PACKED_ALREADY = {".flac", ".mp3", ".ogg", ".opus", ".m4a", ".aac", ".wma", ".png", ".jpg", ".jpeg", ".webp", ".gif"}


class FilesError(ValueError):
    """A message for the person using the app."""


def norm(path) -> Path:
    return Path(os.path.normpath(path))


def key(path) -> str:
    """A path as Windows compares them: one spelling, any case."""
    return os.path.normcase(os.path.normpath(path))


def stored(path, base: Path) -> str:
    """How a project file in the folder base stores path: relative to it, or absolute on another drive."""
    try:
        return norm(path).relative_to(norm(base), walk_up=True).as_posix()
    except ValueError:
        return str(norm(path))


def inside(path, folder: Path) -> Path | None:
    """path relative to folder, or None for a path outside it."""
    try:
        return norm(path).relative_to(norm(folder))
    except ValueError:
        return None


def free(path: Path) -> Path:
    """path, or the first of "<name> 2", "<name> 3"... that isn't taken (before the suffix, for a file name)."""
    if not path.exists():
        return path
    n = 2
    while (p := path.with_name(f"{path.stem} {n}{path.suffix}")).exists():
        n += 1
    return p


def folder_name(stem: str) -> str:
    """A folder name for a project named stem: Windows drops a trailing dot or space."""
    return stem.rstrip(" .") or "Project"


# --- what a project uses
def uses(d: dict, base: Path) -> set[Path]:
    """The files a project uses (d: its to_json() dict, or a project file as read), the project file being in the
    folder base: its new audio and the icon's image."""
    reps = d.get("replacements") if isinstance(d.get("replacements"), list) else []
    rels = [r.get("audio") for r in reps if isinstance(r, dict) and not r.get("silence")]
    icon = d.get("icon")
    rels.append(icon.get("image") if isinstance(icon, dict) else icon)  # an image path, before icons had a frame
    return {norm(Path(base) / rel) for rel in rels if isinstance(rel, str) and rel.strip()}


def rebase(d: dict, old: Path, new: Path, moved: dict | None = None) -> dict:
    """d (a to_json() dict of a project file in the folder old) as a project file in the folder new: every path
    points at the same file, or at where `moved` ({from: to}) says it went."""
    moved = {key(f): t for f, t in (moved or {}).items()}

    def again(rel):
        if not isinstance(rel, str) or not rel.strip():
            return rel
        f = norm(Path(old) / rel)
        return stored(moved.get(key(f), f), new)

    out = json.loads(json.dumps(d))
    for r in out.get("replacements", []):
        if not r.get("silence"):
            r["audio"] = again(r.get("audio"))
    if isinstance(out.get("icon"), dict) and out["icon"].get("image"):
        out["icon"]["image"] = again(out["icon"]["image"])
    if out.get("build_folder"):  # "" stays: the build folder next to the project file
        out["build_folder"] = again(out["build_folder"])
    return out


# --- whose folder it is
def others(audi: Path) -> list[Path]:
    """The other projects in a project file's folder."""
    try:
        return sorted(f for f in Path(audi).parent.glob("*.audi") if f.is_file() and key(f) != key(audi))
    except OSError:
        return []


@functools.cache
def _shared_places() -> frozenset[str]:
    """Folders that are never a project's own: the user's home, Desktop, Documents and Downloads."""
    from .repatch import documents
    home = Path.home()
    return frozenset(key(p) for p in (home, home / "Desktop", home / "Downloads", home / "OneDrive" / "Desktop",
                                      documents()))


def own_folder(audi: Path) -> bool:
    """Whether a project has its folder to itself: no other project is in it, and it isn't a drive, the Desktop,
    Documents or Downloads."""
    folder = Path(audi).parent
    return not others(audi) and folder.parent != folder and key(folder) not in _shared_places()


def move_dest(audi: Path) -> Path:
    """The folder a project moves into (move_to_own_folder): beside its file and named like it, or "<name> 2"... when
    that is taken. The project file there is named like the folder."""
    return free(Path(audi).parent / folder_name(Path(audi).stem))


def made_dirs(folder: Path) -> list[Path]:
    """Audiodiver's folders beside a project file: those in `audio`, then those from before."""
    return [folder / AUDIO / m for m in MADE] + [folder / m for m in LEGACY]


def _ours(d: Path, rel, folder: Path, names=LEGACY_FILES) -> bool:
    """Whether what is at rel in d, one of Audiodiver's folders beside a project file in folder, is Audiodiver's:
    anything in `audio`, and in the folders from before what is named as Audiodiver named it."""
    if key(Path(d).parent) != key(folder):
        return True
    return bool(names[Path(d).name].fullmatch(PurePosixPath(*Path(rel).parts).as_posix()))


def made(path, folder: Path) -> Path | None:
    """Where a file Audiodiver made beside a project file in folder belongs in a folder of the project's own
    (relative to it), or None for any other file."""
    for d in made_dirs(folder):
        if (rel := inside(path, d)) is not None and rel.parts and _ours(d, rel, folder):
            return Path(AUDIO) / d.name / rel
    return None


def cuts_of(path, folder: Path) -> Path | None:
    """The cut points (cuts.json) of the song a slice tool's piece in folder was cut from, or None."""
    for d in (folder / AUDIO / "slices", folder / "slices"):
        if (rel := inside(path, d)) is not None and len(rel.parts) > 1:
            return norm(d / rel.parts[0] / "cuts.json")
    return None


def _used_by_others(audi: Path) -> set[str] | None:
    """What the other projects in the folder use (as key()s), or None when one of them can't be read."""
    out = set()
    for other in others(audi):
        try:
            out |= {key(f) for f in uses(json.loads(other.read_text(encoding="utf-8-sig")), other.parent)}
        except (OSError, ValueError, AttributeError):
            return None
    return out


def unused(audi: Path, projects: list[dict]) -> list[Path]:
    """The files in Audiodiver's folders beside a project file that nothing uses: neither the project (`projects`:
    it and every step of its undo history, as to_json() dicts) nor another project in the folder. A song's cut
    points go when none of its pieces is used."""
    folder = Path(audi).parent
    theirs = _used_by_others(audi)
    if theirs is None:
        raise FilesError("Another project in this folder can't be read, so it isn't known which files it uses")
    used = theirs | {key(f) for d in projects for f in uses(d, folder)}
    used |= {key(c) for f in used if (c := cuts_of(f, folder))}
    out = []
    for d in made_dirs(folder):
        if d.is_dir():
            out += [norm(f) for f in d.rglob("*") if f.is_file() and key(f) not in used
                    and _ours(d, f.relative_to(d), folder)]
    return sorted(out)


def prune(folder: Path):
    """Takes away Audiodiver's folders beside a project file that are empty now, from the deepest up. Of the folders
    from before, only those named as Audiodiver named them, and the folder itself only when one of them went."""
    for d in [*made_dirs(folder), folder / AUDIO]:
        if not d.is_dir():
            continue
        legacy, gone = d.name in LEGACY and key(d.parent) == key(folder), False
        for sub in sorted((x for x in d.rglob("*") if x.is_dir()), key=lambda x: len(x.parts), reverse=True):
            if legacy and not _ours(d, sub.relative_to(d), folder, LEGACY_DIRS):
                continue
            try:
                sub.rmdir()
                gone = True
            except OSError:
                pass  # not empty
        if legacy and not gone:
            continue
        try:
            d.rmdir()
        except OSError:
            pass


def recycle(paths: list[Path]) -> list[Path]:
    """Moves files to the Recycle Bin. Returns those still there after (none, unless Windows refused some). On a
    drive without a Recycle Bin, Windows asks before it deletes them for good."""
    paths = [Path(p) for p in paths if Path(p).exists()]
    if not paths:
        return []
    if os.name == "nt":
        import ctypes
        from ctypes import wintypes

        class FileOp(ctypes.Structure):  # SHFILEOPSTRUCTW
            _fields_ = [("hwnd", wintypes.HWND), ("wFunc", wintypes.UINT), ("pFrom", wintypes.LPCWSTR),
                        ("pTo", wintypes.LPCWSTR), ("fFlags", ctypes.c_ushort), ("fAnyOperationsAborted", wintypes.BOOL),
                        ("hNameMappings", ctypes.c_void_p), ("lpszProgressTitle", wintypes.LPCWSTR)]
        FO_DELETE, FOF_SILENT, FOF_NOCONFIRMATION, FOF_ALLOWUNDO, FOF_NOERRORUI = 3, 0x4, 0x10, 0x40, 0x400
        FOF_WANTNUKEWARNING = 0x4000  # asks first where a file can't go to the Recycle Bin (overrides NOCONFIRMATION)
        for i in range(0, len(paths), 200):  # the list is one string: a few hundred paths at a time
            names = "\0".join(str(p.resolve()) for p in paths[i:i + 200]) + "\0"  # ends in two nulls
            op = FileOp(None, FO_DELETE, names, None, FOF_SILENT | FOF_NOCONFIRMATION | FOF_ALLOWUNDO | FOF_NOERRORUI
                        | FOF_WANTNUKEWARNING, False, None, None)
            ctypes.windll.shell32.SHFileOperationW(ctypes.byref(op))
    else:
        for p in paths:
            try:
                p.unlink()
            except OSError:
                pass
    return [p for p in paths if p.exists()]


# --- moving a project into a folder of its own
def move_plan(audi: Path, dest: Path, projects: list[dict]) -> dict[Path, Path]:
    """What goes with a project moving from beside audi into the folder dest: the files Audiodiver made for it (the
    project's and its undo history's), with their songs' cut points, as {from: to}. What a person picked stays."""
    folder, plan = Path(audi).parent, {}
    for f in set().union(*(uses(d, folder) for d in projects)):
        if (rel := made(f, folder)) and f.is_file():
            plan[f] = dest / rel
            if (c := cuts_of(f, folder)) and c.is_file() and (crel := made(c, folder)):
                plan[c] = dest / crel
    return plan


def copy(plan: dict[Path, Path]):
    """Copies each file to its place (the folders made as needed). A file there already is the same one (a plan
    says so: collect_plan), and is left as it is."""
    for src, dst in sorted(plan.items()):
        if not dst.exists():
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)


def carry(audi: Path, plan: dict[Path, Path]) -> list[tuple[Path, Path, bool]]:
    """Takes the files of a project that moves (move_plan, {from: to}) to their places, the folders made as needed.
    A file is renamed into place (the new folder is on the same drive, so even gigabytes take a moment). It is copied
    when another project in the old folder uses it too (every file, when one of those can't be read), or when Windows
    won't let it go (a file in use stays behind, unused). Returns what was done, [(from, to, moved)], for put_back.
    On a failure, what was done is put back before the error goes on."""
    theirs, done = _used_by_others(audi), []
    try:
        for src, dst in sorted(plan.items()):
            dst.parent.mkdir(parents=True, exist_ok=True)
            if theirs is not None and key(src) not in theirs:
                try:
                    os.replace(src, dst)
                    done.append((src, dst, True))
                    continue
                except OSError:
                    pass  # in use: copied below
            shutil.copy2(src, dst)
            done.append((src, dst, False))
    except BaseException:
        put_back(done)
        raise
    return done


def put_back(done: list[tuple[Path, Path, bool]]) -> bool:
    """Undoes carry: the moved files go back, the copies go. False when a file couldn't go back (then the new
    folder still has it, and must stay)."""
    ok = True
    for src, dst, moved in reversed(done):
        try:
            if moved:
                os.replace(dst, src)
            else:
                dst.unlink()
        except OSError:
            ok = False
    return ok


# --- collecting the files a project uses from elsewhere
def collect_plan(folder: Path, used: set[Path]) -> dict[Path, Path]:
    """Where each file the project in folder uses from outside it goes: audio/added, under its own name (or "name 2"
    when another file has that name; a copy that is there already is used again)."""
    plan, taken = {}, set()
    for f in sorted(used, key=lambda x: str(x).lower()):
        if inside(f, folder) is not None or not f.is_file():
            continue
        to = folder / AUDIO / "added" / f.name
        n = 2
        while key(to) in taken or (to.exists() and not filecmp.cmp(f, to, shallow=False)):
            to = to.with_name(f"{Path(f.name).stem} {n}{f.suffix}")
            n += 1
        taken.add(key(to))
        plan[f] = to
    return plan


# --- packs
def pack(d: dict, folder: Path, name: str, dest: Path, job=None) -> dict:
    """Writes a project (d: its to_json() dict, its file in folder) and the files it uses into the pack dest:
    `<name>/<name>.audi`, its files where the folder has them, files from elsewhere in audio/added, and its songs'
    cut points. Builds stay out. Returns {files, missing, bytes}."""
    used, plan, missing = uses(d, folder), {}, 0
    for f in sorted(used, key=lambda x: str(x).lower()):
        if not f.is_file():
            missing += 1
        elif (rel := inside(f, folder)) is not None:
            plan[f] = rel
            if (c := cuts_of(f, folder)) and c.is_file():
                plan[c] = inside(c, folder)
    taken = {key(r) for r in plan.values()}
    for f in sorted(used, key=lambda x: str(x).lower()):
        if f.is_file() and f not in plan:
            to, n = Path(AUDIO) / "added" / f.name, 2
            while key(to) in taken:
                to = to.with_name(f"{Path(f.name).stem} {n}{f.suffix}")
                n += 1
            taken.add(key(to))
            plan[f] = to
    packed = rebase(d, folder, folder, {f: folder / rel for f, rel in plan.items()})
    packed["build_folder"] = ""
    top = PurePosixPath(folder_name(name))
    part = dest.with_name(dest.name + ".partial")
    if job:
        job.total = len(plan)
    try:
        with zipfile.ZipFile(part, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
            z.writestr(str(top / f"{top.name}.audi"), json.dumps(packed, indent=2) + "\n")
            for i, (f, rel) in enumerate(sorted(plan.items(), key=lambda x: str(x[1]).lower()), 1):
                if job:
                    job.step(f"Packing {f.name}", i - 1)
                z.write(f, str(top / PurePosixPath(rel.as_posix())),
                        zipfile.ZIP_STORED if f.suffix.lower() in PACKED_ALREADY else zipfile.ZIP_DEFLATED)
        part.replace(dest)
    except BaseException:
        part.unlink(missing_ok=True)  # never half a pack under the pack's name
        raise
    return {"files": len(plan), "missing": missing, "bytes": dest.stat().st_size}


def unpack(src: Path, into: Path, job=None) -> Path:
    """Unpacks a pack into a folder of its own in `into`, named like its project ("<name> 2" when that is taken), and
    returns the project file. Everything is checked before anything is written."""
    from .project import Project, ProjectFormatError
    try:
        z = zipfile.ZipFile(src)
    except (zipfile.BadZipFile, OSError):
        raise FilesError(f"{src.name} isn't an Audiodiver pack, or it is damaged") from None
    with z:
        files = [i for i in z.infolist() if not i.is_dir()]
        for i in files:
            p = PurePosixPath(i.filename.replace("\\", "/"))
            if p.is_absolute() or ".." in p.parts or ":" in i.filename:
                raise FilesError(f"{src.name} has a file that would go outside its folder ({i.filename})")
        projects = [i for i in files if i.filename.lower().endswith(".audi") and len(PurePosixPath(i.filename).parts) <= 2]
        if len(projects) != 1:
            raise FilesError(f"{src.name} holds {'no project' if not projects else 'more than one project'}")
        audi = PurePosixPath(projects[0].filename)
        top = audi.parent.parts  # () for a project at the pack's top
        files = [i for i in files if PurePosixPath(i.filename).parts[:len(top)] == top]
        try:
            Project.from_json(json.loads(z.read(projects[0]).decode("utf-8-sig")))
        except (ValueError, ProjectFormatError) as e:
            raise FilesError(f"{src.name}: its project {e if isinstance(e, ProjectFormatError) else 'is damaged'}") from None
        into.mkdir(parents=True, exist_ok=True)
        need = sum(i.file_size for i in files)
        if need > shutil.disk_usage(into).free:
            raise FilesError(f"{src.name} needs {need / 1e6:.0f} MB, and {into} has less free space")
        dest = free(into / folder_name(audi.stem))
        part = into / f".{dest.name}.partial"
        shutil.rmtree(part, ignore_errors=True)
        if job:
            job.total = len(files)
        try:
            for n, i in enumerate(files, 1):
                if job:
                    job.step(f"Unpacking {PurePosixPath(i.filename).name}", n - 1)
                to = part.joinpath(*PurePosixPath(i.filename).parts[len(top):])
                to.parent.mkdir(parents=True, exist_ok=True)
                with z.open(i) as r, open(to, "wb") as w:
                    shutil.copyfileobj(r, w, 1 << 20)
            if audi.name != f"{dest.name}.audi":  # the file is named like its folder
                (part / audi.name).rename(part / f"{dest.name}.audi")
            part.rename(dest)
        except BaseException:
            shutil.rmtree(part, ignore_errors=True)
            raise
    return dest / f"{dest.name}.audi"
