"""audiodiver: build Helldivers 2 audio replacement mods from a .audi project.

    audiodiver new <project.audi> --name NAME [--from-folder DIR] [--skip FILE ...]
    audiodiver build <project.audi> [--out DIR] [--version N]
    audiodiver inspect <patch_0>          what a patch changes against the current game
    audiodiver index [--rebuild]          (re)build the game's audio index
    audiodiver encode <audio> <out.wem>
    audiodiver serve [--port N] [--token T] [--project P]   the editor's local API (see server.py)

Mods made for an older game version (Tools in the window; Audiodiver Utils ships these too):

    audiodiver scan <mod>                 what a mod holds: its patches, options and the choice it starts with
    audiodiver repatch <mod> [--name N] [--out DIR] [--every-bank]
    audiodiver combine <mod> <mod> ... [--plan FILE] [--clashes] [--name N] [--out DIR] [--every-bank]
    audiodiver check                      the installed mods with sound banks of an older game version

A mod is a ZIP, a folder or a .patch_0 file. --json prints the result as JSON on stdout (progress goes to stderr);
--game DIR reads the game from that folder. Without --out the ZIP goes where the window's Tools put it last.
Combine's --plan is a JSON file {"mods": [{"source": path, "picks": [option ids]}], "winners": {clash id: mod}},
the mods in order (a later one wins where two differ); `scan` lists a mod's option ids, `--clashes` the clash ids.
"""
import argparse
import json
import os
import sys
import time
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


# --- the Tools: Repatch, Combine Mods, the installed mods check. They run the window's own jobs (editor.Session)
def _session(a, game=True):
    """A Session with the game read (the window's start, done here in the foreground)."""
    from .editor import Session
    s = Session(load=False)
    if game:
        _say(a, "Reading the game audio (the first run after a game update takes about a minute)")
        s._load_game(a.game)
        if s.stage != "ready":
            _fail(a, s.load_error or "the game couldn't be read")
    return s


def _say(a, line):
    if not a.json_out or a.verbose:
        print(line, file=sys.stderr, flush=True)


def _fail(a, msg):
    if a.json_out:
        print(json.dumps({"error": msg}))
    sys.exit(f"audiodiver {a.func.__name__.removeprefix('cmd_')}: {msg}")


def _run(a, s, call):
    """Starts a job (call() returns its JSON, or raises EditorError), follows it on stderr and returns its result.
    Ctrl+C asks it to stop, as Cancel does in the window."""
    from .editor import EditorError
    try:
        job = s.jobs[call()["id"]]
    except EditorError as e:
        _fail(a, str(e))
    shown = None
    try:
        while job.state == "running":
            time.sleep(0.2)
            now = (job.doing, job.done, job.total)
            if job.doing and now != shown:
                shown = now
                _say(a, f"{job.doing}" + (f" ({100 * job.done // job.total}%)" if job.total else ""))
    except KeyboardInterrupt:
        job.cancel_requested = True
        while job.state == "running":
            time.sleep(0.2)
    if job.state != "done":
        _fail(a, job.error or job.state)
    return job.result


def _out(a, result, text):
    print(json.dumps(result, indent=1, ensure_ascii=False) if a.json_out else text)


def cmd_scan(a):
    from .editor import EditorError
    s = _session(a, game=False)
    try:
        got = {**s.repatch_scan(a.mod), **{k: v for k, v in s.combine_scan(a.mod).items() if k in ("options", "picks")}}
    except EditorError as e:
        _fail(a, str(e))
    lines = [f"{got['name']}: {len(got['patches'])} patch{'es' if len(got['patches']) != 1 else ''}"
             + (" (a mod manager manifest)" if got["manifest"] else "")]
    lines += [f"  {p['label'] or p['key']}" + ("" if p["audio"] else " (no audio)") for p in got["patches"]]
    for o in got["options"]:
        lines.append(f"  option {o['id']}: {o['name']}" + "".join(f"\n    choice {x['id']}: {x['name']}" for x in o["sub"]))
    if got["options"]:
        lines.append(f"  starts with: {' '.join(got['picks']) or 'nothing on'}")
    _out(a, got, "\n".join(lines))


def cmd_repatch(a):
    s = _session(a)
    r = _run(a, s, lambda: s.repatch(a.mod, a.name or "", str(Path(a.out).resolve()) if a.out else "", a.every_bank,
                                      remember=False))
    lines = [f"{r['zip']} ({r['mb']} MB)" + (", the old mod's id kept" if r["kept_id"] else "")]
    for p in r["parts"]:
        label = p["label"] or r["name"]
        lines.append(f"  {label}: kept as it was ({p['kept']})" if p["kept"] else
                     f"  {label}: {p['imported']} sounds carried over" + (f", {len(p['left'])} changes left out" if p["left"] else ""))
    _out(a, r, "\n".join(lines))


def cmd_combine(a):
    plan = {}
    if a.plan:
        try:
            plan = json.loads(Path(a.plan).read_text(encoding="utf-8"))
        except (OSError, ValueError) as e:
            _fail(a, f"the plan {a.plan} can't be read: {e}")
        if not isinstance(plan, dict):
            _fail(a, "the plan is a JSON object with mods and winners")
    mods = plan.get("mods") or [{"source": m} for m in a.mods]
    if a.mods and plan.get("mods"):
        _fail(a, "name the mods in the plan or on the command line, not both")
    s = _session(a)
    if a.clashes:
        r = _run(a, s, lambda: s.combine_read(mods))
        lines = [f"{len(r['mods'])} mods, {sum(len(g['clashes']) for g in r['groups'])} clashes"]
        for g in r["groups"]:
            lines.append(f"  {g['name']}")
            lines += [f"    {c['id']}: {c['label']} (mods {', '.join(str(v['mod']) for v in c['versions'])}; "
                      f"mod {c['winner']} wins)" for c in g["clashes"]]
        return _out(a, r, "\n".join(lines))
    r = _run(a, s, lambda: s.combine(mods, plan.get("winners"), a.name or plan.get("name") or "",
                                      str(Path(a.out).resolve()) if a.out else "", a.every_bank, remember=False))
    _out(a, r, f"{r['zip']} ({r['mb']} MB)\n" + "\n".join(f"  {m['name']}" for m in r["mods"]))


def cmd_check(a):
    s = _session(a)
    r = _run(a, s, s.check_mods)
    states = {"shared": "older shared settings", "older": "older sound banks", "current": "up to date",
              "unreadable": "can't be read"}
    lines = [f"  {m['name']}: {states.get(m['state'], m['state'])}" + (" (deployed)" if m["deployed"] else "")
             for m in r["mods"]]
    if not r["library"]:
        lines.insert(0, "No mod manager's library was found, so only the game's folder was checked.")
    _out(a, r, "\n".join(lines) or "No installed mod has sound banks.")


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
    p = sub.add_parser("build", help="build a project into a verified mod manager ZIP")
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

    def tool(name, func, help):
        p = sub.add_parser(name, help=help)
        p.add_argument("--json", dest="json_out", action="store_true", help="the result as JSON on stdout")
        p.add_argument("--verbose", action="store_true", help="progress on stderr also with --json")
        p.add_argument("--game", help="the game's folder (else the one Settings has, $HD2_DATA, or Steam's)")
        p.set_defaults(func=func)
        return p
    p = tool("scan", cmd_scan, "what a mod holds: patches, options, the choice it starts with")
    p.add_argument("mod")
    p = tool("repatch", cmd_repatch, "rebuild a mod for the current game version")
    p.add_argument("mod")
    p.add_argument("--name", help="the new mod's name (else the mod's own)")
    p.add_argument("--out", help="the folder the ZIP goes into")
    p.add_argument("--every-bank", action="store_true", help="the mod's sounds into every bank that has them")
    p = tool("combine", cmd_combine, "make one mod out of several, built on the current game")
    p.add_argument("mods", nargs="*")
    p.add_argument("--plan", help="a JSON file with the mods, their options and the clashes' winners")
    p.add_argument("--clashes", action="store_true", help="only read the mods and list where they clash")
    p.add_argument("--name", help="the combined mod's name")
    p.add_argument("--out", help="the folder the ZIP goes into")
    p.add_argument("--every-bank", action="store_true", help="the sounds into every bank that has them")
    tool("check", cmd_check, "the installed mods with sound banks of an older game version")
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
