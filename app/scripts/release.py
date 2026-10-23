"""What a release needs beyond `tauri build` (the release workflow, .github/workflows/release.yml, runs these):

    python app/scripts/release.py check v1.2.0   # the tag matches every version number, and the changelog has it
    python app/scripts/release.py notes v1.2.0   # the changelog's section for it: the release's text
    python app/scripts/release.py core           # app/src-tauri/core: Python, the core and its packages, the tools
    python app/scripts/release.py portable       # the portable ZIP, from the built exe and app/src-tauri/core

`core` puts together what the installer and the portable ZIP carry beside the exe (tauri.release.conf.json lists it
as resources; the shell runs `core/python/python.exe` with `core/tools` on PATH):

    core/python/     Python's embeddable package, with the core, numpy, pillow and lz4 in Lib/site-packages
    core/tools/      ffmpeg, ffprobe, vgmstream-cli (with its DLLs) and wav2wem
    core/licenses/   each one's licence, and where its source is

Every download is pinned to a version and checked against its SHA-256. wav2wem is built from its source with Go
(the module's checksums are Go's). Downloads are kept in src-tauri/target/downloads between runs.
"""
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tomllib
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "app"
TAURI = APP / "src-tauri"
OUT = TAURI / "core"
CACHE = TAURI / "target" / "downloads"

PYTHON = "3.14.7"
PACKAGES = ["numpy==2.5.4", "pillow==12.3.0", "lz4==4.4.5"]  # as the core is tested with (core/pyproject.toml)
WAV2WEM = "github.com/pas2k/wav2wem/cmd/wav2wem@v0.0.0-20260606082038-38e916953bec"
DOWNLOADS = {
    "python": (f"https://www.python.org/ftp/python/{PYTHON}/python-{PYTHON}-embed-amd64.zip",
               "d297e5ff019966817ad8502465176139f2d3d840fa4ed84b13bed399a6ab1f15"),
    "ffmpeg": ("https://github.com/GyanD/codexffmpeg/releases/download/9.0.2/ffmpeg-9.0.2-essentials_build.zip",
               "60f467265b1e312373dbcd92200c2618a74850f98d3d078e94296bb3fa2047ba"),
    "vgmstream": ("https://github.com/vgmstream/vgmstream/releases/download/r2117/vgmstream-win64.zip",
                  "6c4a8a3813864fefed081bbd337dbc0ad93bf88e0b92f5db98d7ab258b22dc6c"),
}
SOURCES = f"""The programs in this folder and where their source is. Audiodiver runs them as separate programs.

Python {PYTHON} (embeddable package)    PSF License (python.txt)
    https://www.python.org/downloads/release/python-{PYTHON.replace('.', '')}/
numpy, pillow, lz4                     their licences are in python/Lib/site-packages/*.dist-info
    {', '.join(PACKAGES)}, from PyPI
FFmpeg 9.0.2 (gyan.dev essentials build: ffmpeg, ffprobe)    GPL-3.0-or-later (ffmpeg.txt)
    https://ffmpeg.org/releases/ffmpeg-9.0.2.tar.xz
    https://github.com/GyanD/codexffmpeg/releases/tag/9.0.2 (the build and the libraries it includes)
vgmstream r2117 (vgmstream-cli and its DLLs)    ISC-style licence (vgmstream.txt)
    https://github.com/vgmstream/vgmstream/tree/r2117
wav2wem ({WAV2WEM.split('@')[1]})    GPL-2.0 (wav2wem.txt, wav2wem-third-party.md)
    https://github.com/pas2k/wav2wem/tree/{WAV2WEM.rsplit('-', 1)[1]}
"""


def run(*cmd, **kw):
    print("+", " ".join(str(c) for c in cmd), flush=True)
    subprocess.run([str(c) for c in cmd], check=True, **kw)


def fetch(name) -> Path:
    url, sha = DOWNLOADS[name]
    path = CACHE / url.rsplit("/", 1)[1]
    if not path.exists() or hashlib.sha256(path.read_bytes()).hexdigest() != sha:
        CACHE.mkdir(parents=True, exist_ok=True)
        print(f"downloading {url}", flush=True)
        with urllib.request.urlopen(url) as r, open(path.with_suffix(".part"), "wb") as f:
            shutil.copyfileobj(r, f)
        path.with_suffix(".part").replace(path)
    got = hashlib.sha256(path.read_bytes()).hexdigest()
    if got != sha:
        sys.exit(f"{path.name}: SHA-256 is {got}, expected {sha}")
    return path


def core():
    if OUT.exists():
        shutil.rmtree(OUT)
    py, tools, lic = OUT / "python", OUT / "tools", OUT / "licenses"
    for d in (py, tools, lic):
        d.mkdir(parents=True)

    # Python, with its packages where its ._pth file looks
    zipfile.ZipFile(fetch("python")).extractall(py)
    pth = next(py.glob("python*._pth"))
    pth.write_text(pth.read_text().replace(".\n", ".\nLib\\site-packages\n", 1).replace(".\r\n", ".\r\nLib\\site-packages\r\n", 1))
    site = py / "Lib" / "site-packages"
    short = "".join(PYTHON.split(".")[:2])
    run(sys.executable, "-m", "pip", "install", "--disable-pip-version-check", "--no-compile", "--target", site,
        "--platform", "win_amd64", "--python-version", short, "--implementation", "cp", "--only-binary=:all:", *PACKAGES)
    run(sys.executable, "-m", "pip", "install", "--disable-pip-version-check", "--no-compile", "--no-deps", "--target", site,
        ROOT / "core")
    shutil.rmtree(site / "bin", ignore_errors=True)  # the `audiodiver` launchers pip makes: the shell runs `-m audiodiver`
    run(py / "python.exe", "-m", "compileall", "-q", "-j", "0", site)  # Program Files is read-only: compiled once, here
    run(py / "python.exe", "-c", "import audiodiver.server, numpy, PIL.Image, lz4.frame; print('the core imports')")
    shutil.copy(py / "LICENSE.txt", lic / "python.txt")

    # the tools the core runs
    with zipfile.ZipFile(fetch("ffmpeg")) as z:
        for n in z.namelist():
            if n.endswith(("/bin/ffmpeg.exe", "/bin/ffprobe.exe")):
                (tools / Path(n).name).write_bytes(z.read(n))
            elif n.endswith("/LICENSE"):
                (lic / "ffmpeg.txt").write_bytes(z.read(n))
    with zipfile.ZipFile(fetch("vgmstream")) as z:
        for n in z.namelist():
            if n.lower().endswith((".exe", ".dll")):
                (tools / Path(n).name).write_bytes(z.read(n))
        (lic / "vgmstream.txt").write_bytes(z.read("COPYING"))
    env = {**os.environ, "GOBIN": str(tools), "GOFLAGS": "-trimpath", "CGO_ENABLED": "0"}
    run("go", "install", "-ldflags=-s -w", WAV2WEM, env=env)
    mod = Path(subprocess.run(["go", "env", "GOMODCACHE"], capture_output=True, text=True, check=True).stdout.strip())
    src = Path(f"{mod / WAV2WEM.split('/cmd/')[0]}@{WAV2WEM.split('@')[1]}")  # the module's source, with its licence
    shutil.copy(src / "LICENSE", lic / "wav2wem.txt")
    shutil.copy(src / "THIRD_PARTY_NOTICES.md", lic / "wav2wem-third-party.md")
    (lic / "README.txt").write_text(SOURCES)
    for t in ("ffmpeg", "ffprobe", "vgmstream-cli", "wav2wem"):
        if not (tools / f"{t}.exe").is_file():
            sys.exit(f"{t}.exe is missing from {tools}")
    size = sum(f.stat().st_size for f in OUT.rglob("*") if f.is_file())
    print(f"{OUT}: {sum(1 for f in OUT.rglob('*') if f.is_file())} files, {size / 1e6:.0f} MB")


def version() -> str:
    return json.loads((TAURI / "tauri.conf.json").read_text(encoding="utf-8"))["version"]


def check(tag):
    """The tag (v1.2.0) is the version in every file that has one, and the changelog has a section for it."""
    want = tag.removeprefix("v")
    found = {
        "app/src-tauri/tauri.conf.json": version(),
        "app/package.json": json.loads((APP / "package.json").read_text(encoding="utf-8"))["version"],
        "app/src-tauri/Cargo.toml": tomllib.loads((TAURI / "Cargo.toml").read_text(encoding="utf-8"))["package"]["version"],
        "core/pyproject.toml": tomllib.loads((ROOT / "core" / "pyproject.toml").read_text(encoding="utf-8"))["project"]["version"],
    }
    wrong = [f"{f} has {v}" for f, v in found.items() if v != want]
    if wrong:
        sys.exit(f"{tag}: " + "; ".join(wrong))
    if not section(want):
        sys.exit(f"{tag}: app/CHANGELOG.md has no section for {want}")
    print(f"{tag}: every version number matches, and the changelog has it")


def section(v) -> str:
    """The changelog's text for a version: what is under its `## <version> - <date>` heading."""
    text = (APP / "CHANGELOG.md").read_text(encoding="utf-8")
    m = re.search(rf"^## \[?v?{re.escape(v)}\]?(?:[ \t]+[-–—][^\n]*)?\n(.*?)(?=^## |\Z)", text, re.M | re.S)
    return m.group(1).strip() if m else ""


def notes(tag):
    v = tag.removeprefix("v")
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stdout.write(section(v) + "\n\n" + (
        f"**Audiodiver_{v}_x64-setup.exe** installs Audiodiver and updates it from inside the app. "
        f"**Audiodiver-{v}-portable.zip** runs from any folder: unzip it and start Audiodiver.exe. A portable copy "
        "keeps its settings and caches in the `data` folder beside it, and updates by downloading the new ZIP.\n"))


def portable():
    """Audiodiver-<version>-portable.zip: a folder with the exe, the core beside it and portable.txt."""
    exe = TAURI / "target" / "release" / "audiodiver.exe"
    if not exe.is_file() or not (OUT / "python" / "python.exe").is_file():
        sys.exit("build first: `release.py core`, then `tauri build`")
    out = TAURI / "target" / "release" / "bundle" / "portable" / f"Audiodiver-{version()}-portable.zip"
    out.parent.mkdir(parents=True, exist_ok=True)
    top = "Audiodiver"
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        z.write(exe, f"{top}/Audiodiver.exe")
        z.writestr(f"{top}/portable.txt", PORTABLE_TXT)
        z.write(ROOT / "LICENSE", f"{top}/LICENSE.txt")
        for f in sorted(OUT.rglob("*")):
            if f.is_file():
                z.write(f, f"{top}/core/{f.relative_to(OUT).as_posix()}")
    print(f"{out}: {out.stat().st_size / 1e6:.0f} MB")


PORTABLE_TXT = """This copy of Audiodiver is portable. It keeps its settings, caches, notes and logs in the data folder
next to Audiodiver.exe, and nothing in the user's AppData folder. The folder can be moved or copied with its data.

To update it, download the new portable ZIP from https://github.com/Alomare/Audiodiver/releases and replace
Audiodiver.exe and the core folder. Keep the data folder.
"""

if __name__ == "__main__":
    what, *args = sys.argv[1:] or ["help"]
    {"core": core, "portable": portable, "check": check, "notes": notes}.get(what, lambda *_: sys.exit(__doc__))(*args)
