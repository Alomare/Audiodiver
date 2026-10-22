"""audiodiver: build Helldivers 2 audio replacement mods from a .audi project.

    audiodiver new <project.audi> --name NAME [--from-folder DIR] [--skip FILE ...]
    audiodiver build <project.audi> [--out DIR] [--version N]
    audiodiver inspect <patch_0>          what a patch changes against the current game
    audiodiver index [--rebuild]          (re)build the game's audio index
    audiodiver encode <audio> <out.wem>
    audiodiver serve [--port N] [--token T] [--project P]   the editor's local API (see server.py)
"""
import argparse
import os
import sys
from pathlib import Path

from . import wem
from .build import BuildError, build
from .index import AudioIndex
from .patch import diff
from .project import Project, ProjectFormatError, replacements_from_folder


def cmd_new(a):
    path = Path(a.project)
    if path.suffix.lower() != ".audi":
        path = path.with_name(path.name + ".audi")  # as the editor names it
    if path.exists():
        sys.exit(f"{path} already exists")
    if a.from_folder and not Path(a.from_folder).is_dir():
        sys.exit(f"{a.from_folder} isn't a folder")
    path.parent.mkdir(parents=True, exist_ok=True)
    p = Project(name=a.name.strip(), path=path)
    if a.from_folder:
        p.replacements = replacements_from_folder(a.from_folder, path.parent, skip=set(a.skip))
    p.save()
    print(f"{path}: {len(p.replacements)} replacements, guid {p.guid}")
    for prob in p.problems():
        print("  problem:", prob)


def load(path) -> Project:
    """A project file, or the reason it can't be opened (as the editor says it)."""
    path = Path(path)
    if path.is_dir():
        sys.exit(f"{path} is a folder: name a .audi project file")
    if not path.exists():
        sys.exit(f"{path} wasn't found")
    try:
        return Project.load(path)
    except ProjectFormatError as e:
        sys.exit(f"{path} {e}")
    except (ValueError, KeyError, TypeError):
        sys.exit(f"{path} isn't an Audiodiver project")


def cmd_build(a):
    p = load(a.project)
    if not p.replacements and not p.texts:
        sys.exit(f"{a.project} replaces no audio and changes no text: nothing to build")
    ix, listed = AudioIndex(), None
    if p.library and not p.every_bank:  # the banks of what it lists, where its sounds go (build.reach)
        from .catalog import Catalog
        from .cuemap import CueMap
        from .library import Library
        listed = Library(Catalog(CueMap(ix))).banks(p.library)
    try:
        build(p, ix, a.out, a.version, listed=listed)
    except BuildError as e:
        sys.exit(f"build failed: {e}")


def cmd_inspect(a):
    if Path(a.patch).is_dir():
        sys.exit(f"{a.patch} is a folder: name a .patch_0 file")
    if not Path(a.patch).is_file():
        sys.exit(f"{a.patch} wasn't found")
    ix = AudioIndex()
    try:
        d = diff(a.patch, ix)
    except (AssertionError, ValueError, KeyError, IndexError, __import__("struct").error):
        sys.exit(f"{a.patch} can't be read as a game patch")
    print(f"{a.patch}: {len(d['streams'])} streams replaced"
          + (f"; banks this game version doesn't have: {d['unknown']}" if d["unknown"] else ""))
    for bid, b in d["banks"].items():
        print(f"  bank {bid} ({len(ix.banks[bid]['archives'])} archives): {len(b['media'])} media, "
              f"{len(b['objects'])} objects changed, {len(b['added'])} added, {len(b['removed'])} removed")
        for kind, oid in b["objects"][:8]:
            print(f"    {kind} {oid}")


def cmd_index(a):
    ix = AudioIndex(rebuild=a.rebuild)
    print(f"{len(ix.banks)} banks, {len(ix.streams)} streams")


def cmd_encode(a):
    if not Path(a.audio).is_file():
        sys.exit(f"{a.audio} wasn't found")
    print(wem.encode(a.audio, a.out))


def cmd_serve(a):
    from .server import serve
    serve(a.port, a.token, a.project, a.parent_pid)


def positive(text):
    """A whole number from 1 (argparse type)."""
    try:
        n = int(text)
    except ValueError:
        raise argparse.ArgumentTypeError(f"{text} isn't a whole number") from None
    if n < 1:
        raise argparse.ArgumentTypeError("the version starts at 1")
    return n


def main(argv=None):
    ap = argparse.ArgumentParser(prog="audiodiver", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(required=True)
    p = sub.add_parser("new", help="create a project")
    p.add_argument("project")
    p.add_argument("--name", required=True)
    p.add_argument("--from-folder", help="add every <id>_<name>.wav under this folder")
    p.add_argument("--skip", nargs="*", default=[], help="file names to leave out")
    p.set_defaults(func=cmd_new)
    p = sub.add_parser("build", help="build a project into a verified Arsenal ZIP")
    p.add_argument("project")
    p.add_argument("--out")
    p.add_argument("--version", type=positive)
    p.set_defaults(func=cmd_build)
    p = sub.add_parser("inspect", help="show what a patch changes against the current game")
    p.add_argument("patch")
    p.set_defaults(func=cmd_inspect)
    p = sub.add_parser("index", help="(re)build the game's audio index")
    p.add_argument("--rebuild", action="store_true")
    p.set_defaults(func=cmd_index)
    p = sub.add_parser("encode", help="encode an audio file to a game-ready .wem")
    p.add_argument("audio")
    p.add_argument("out")
    p.set_defaults(func=cmd_encode)
    p = sub.add_parser("serve", help="run the editor's local API")
    p.add_argument("--port", type=int, default=0)
    p.add_argument("--token")
    p.add_argument("--project")
    p.add_argument("--parent-pid", type=int, help="exit when this process ends (set by the desktop app)")
    p.set_defaults(func=cmd_serve)
    a = ap.parse_args(argv)
    try:
        a.func(a)
    except KeyboardInterrupt:
        sys.exit(130)
    except SystemExit:
        raise
    except Exception as e:  # a message, not a traceback: the log and --debug have those
        if "--debug" in sys.argv or os.environ.get("AUDIODIVER_DEBUG"):
            raise
        from .errors import plain
        msg = plain(e, log_hint="") if isinstance(e, OSError) or not isinstance(e, (ValueError, KeyError)) else str(e)
        sys.exit(f"audiodiver {a.func.__name__.removeprefix('cmd_')}: {msg}")


if __name__ == "__main__":
    main()
