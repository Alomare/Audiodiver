"""What a release needs beyond `tauri build` (the release workflow, .github/workflows/release.yml, runs these):

    python app/scripts/release.py check v1.2.0   # the tag matches every version number, and the changelog has it
    python app/scripts/release.py notes v1.2.0   # the changelog's section for it: the release's text
    python app/scripts/release.py core           # app/src-tauri/core: Python, the core and its packages, the tools
    python app/scripts/release.py portable       # the portable ZIP, from the built exe and app/src-tauri/core
    python app/scripts/release.py utils          # the Audiodiver Utils ZIP, from the same exe and core

`core` puts together what the installer and the portable ZIP carry beside the exe (tauri.release.conf.json lists it
as resources; the shell runs `core/python/python.exe` with `core/tools` on PATH):

    core/python/     Python's embeddable package, with the core, numpy, pillow and lz4 in Lib/site-packages
    core/tools/      ffmpeg, ffprobe, vgmstream-cli (with its DLLs) and wav2wem (on Linux also oggenc, built here)
    core/licenses/   each one's licence, and where its source is

Every download is pinned to a version and checked against its SHA-256. wav2wem is built from its source with Go
(the module's checksums are Go's). Downloads are kept in src-tauri/target/downloads between runs.
"""
import hashlib
import io
import json
import os
import re
import shutil
import subprocess
import tarfile
import time
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
    # 7-Zip's installer, a 7z archive itself: its 7z.exe and 7z.dll read .7z and .rar mods (archives.py)
    "7zip": ("https://github.com/ip7z/7zip/releases/download/26.05/7z2605-x64.exe",
             "fd99e86f57d8f429ef5ed045bf98315af962e2309b0f1ba87a147a44c71647d0"),
    # Linux: a standalone build of the same Python, BtbN's static FFmpeg (a month's last build, which stays up),
    # vgmstream's Linux build and its licence, 7-Zip's 7zz
    "python-linux": (f"https://github.com/astral-sh/python-build-standalone/releases/download/20260929/"
                     f"cpython-{PYTHON}%2B20260929-x86_64-unknown-linux-gnu-install_only_stripped.tar.gz",
                     "da5357f47b1d9c8d4c439004d463d893ef688a44c27438a62b47073d26d1377e"),
    # the shared build: ffmpeg and ffprobe share their libraries (in core/lib, where their RPATH $ORIGIN/../lib looks),
    # where the static one carried every codec twice (332 MB)
    "ffmpeg-linux": ("https://github.com/BtbN/FFmpeg-Builds/releases/download/autobuild-2026-10-31-12-59/"
                     "ffmpeg-n9.0.2-39-g7adfbe40dc-linux64-gpl-shared-9.0.tar.xz",
                     "90a42a7d9689c031beacc3d03b139fd8243351d616988e8a74188df949fe5d08"),
    "vgmstream-linux": ("https://github.com/vgmstream/vgmstream/releases/download/r2117/vgmstream-linux.zip",
                        "2f98c77f756079f63fbd119939067f1ed461d77e70993bc4cc372736d859c84a"),
    "vgmstream-copying": ("https://raw.githubusercontent.com/vgmstream/vgmstream/r2117/COPYING",
                          "fcc26d35c4c4365e31f21734f846e4ee362ff0b57ba696085605a7b4768d8763"),
    "7zip-linux": ("https://github.com/ip7z/7zip/releases/download/26.05/7z2605-linux-x64.tar.xz",
                   "22cf82fcc6eb7474f1d5bb4f02c0f8ebd573a718089d6833dc30f8350a3b232e"),
    # oggenc for Linux, with the aoTuV libvorbis of wav2wem's own (Windows) encoder: built from these (oggenc_linux)
    "libogg": ("https://downloads.xiph.org/releases/ogg/libogg-1.3.6.tar.xz",
               "5c8253428e181840cd20d41f3ca16557a9cc04bad4a3d04cce84808677fa1061"),
    "aotuv": ("https://github.com/AO-Yumi/vorbis_aotuv/archive/refs/tags/beta6.03-2020.tar.gz",
              "b529eb656a28cdd3a3ce22fe470a2f7705a088a87ccabe6675f1748e843aef0d"),
    "vorbis-tools": ("https://downloads.xiph.org/releases/vorbis/vorbis-tools-1.4.3.tar.gz",
                     "a1fe3ddc6777bdcebf6b797e7edfe0437954b24756ffcc8c6b816b63e0460dde"),
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
7-Zip 26.05 (7z, 7z.dll)    GNU LGPL with the unRAR restriction (7zip.txt)
    https://github.com/ip7z/7zip/releases/tag/26.05
"""
SOURCES_LINUX = f"""The programs in this folder and where their source is. Audiodiver runs them as separate programs.

Python {PYTHON} (python-build-standalone 20260929)    PSF License (python.txt)
    https://www.python.org/downloads/release/python-{PYTHON.replace('.', '')}/
    https://github.com/astral-sh/python-build-standalone/releases/tag/20260929 (the build and the libraries it includes)
numpy, pillow, lz4                     their licences are in python/lib/python3.*/site-packages/*.dist-info
    {', '.join(PACKAGES)}, from PyPI
FFmpeg 9.0.2 (BtbN's shared GPL build: ffmpeg, ffprobe, their libraries in lib)    GPL-3.0-or-later (ffmpeg.txt)
    https://ffmpeg.org/releases/ffmpeg-9.0.2.tar.xz
    https://github.com/BtbN/FFmpeg-Builds/releases/tag/autobuild-2026-10-31-12-59 (the build and the libraries it includes)
vgmstream r2117 (vgmstream-cli)    ISC-style licence (vgmstream.txt)
    https://github.com/vgmstream/vgmstream/tree/r2117
wav2wem ({WAV2WEM.split('@')[1]})    GPL-2.0 (wav2wem.txt, wav2wem-third-party.md)
    https://github.com/pas2k/wav2wem/tree/{WAV2WEM.rsplit('-', 1)[1]}
oggenc (vorbis-tools 1.4.3, static, with libvorbis aoTuV b6.03 2020 and libogg 1.3.6)    GPL-2.0 (oggenc.txt);
    libvorbis and libogg BSD-3-Clause (aotuv.txt, libogg.txt)
    https://downloads.xiph.org/releases/vorbis/vorbis-tools-1.4.3.tar.gz
    https://github.com/AO-Yumi/vorbis_aotuv/tree/beta6.03-2020
    https://downloads.xiph.org/releases/ogg/libogg-1.3.6.tar.xz
7-Zip 26.05 (7zz)    GNU LGPL with the unRAR restriction (7zip.txt)
    https://github.com/ip7z/7zip/releases/tag/26.05
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


LINUX = sys.platform.startswith("linux")
EXE = ".exe" if not LINUX else ""


def core():
    if OUT.exists():  # Go's module files arrive read-only, which Windows won't delete as they are
        shutil.rmtree(OUT, onexc=lambda f, p, _: (os.chmod(p, 0o666), f(p)))
    py, tools, lic = OUT / "python", OUT / "tools", OUT / "licenses"
    for d in (py, tools, lic):
        d.mkdir(parents=True)
    if LINUX:
        core_linux(py, tools, lic)
    else:
        core_windows(py, tools, lic)
    # 7-Zip, for mods packed as .7z or .rar (archives.py)
    sys.path.insert(0, str(ROOT / "core"))
    from audiodiver.archives import seven_zip
    if LINUX:
        with tarfile.open(fetch("7zip-linux")) as t:
            for name, to in (("7zz", tools / "7zz"), ("License.txt", lic / "7zip.txt")):
                with t.extractfile(name) as src, open(to, "wb") as dst:
                    shutil.copyfileobj(src, dst)
    else:  # the installer unpacked by the 7-Zip already on the computer (GitHub's Windows runners have one)
        if not (have := seven_zip()):
            sys.exit("7-Zip is needed to unpack 7-Zip's installer")
        run(have, "e", "-y", "-bso0", f"-o{tools}", fetch("7zip"), "7z.exe", "7z.dll")
        run(have, "e", "-y", "-bso0", f"-o{lic}", fetch("7zip"), "License.txt")
        (lic / "License.txt").replace(lic / "7zip.txt")
    (lic / "README.txt").write_text(SOURCES_LINUX if LINUX else SOURCES)
    for t in ("ffmpeg", "ffprobe", "vgmstream-cli", "wav2wem", *(("7zz", "oggenc") if LINUX else ("7z",))):
        if not (tools / f"{t}{EXE}").is_file():
            sys.exit(f"{t}{EXE} is missing from {tools}")
    if LINUX:  # the run permission, which the archives and downloads don't all keep
        for f in [*tools.iterdir(), *(py / "bin").iterdir()]:
            if f.is_file():
                f.chmod(0o755)
        for f in OUT.rglob("*"):  # writable by its owner: Python's build has read-only files, which a second copy
            f.chmod(f.stat().st_mode | 0o200)  # of the resources (Tauri's, into target/release) can't replace
    size = sum(f.stat().st_size for f in OUT.rglob("*") if f.is_file() and not f.is_symlink())
    print(f"{OUT}: {sum(1 for f in OUT.rglob('*') if f.is_file())} files, {size / 1e6:.0f} MB")


def core_linux(py, tools, lic):
    """A standalone Python build (python-build-standalone) with the packages installed by its own pip, the
    static FFmpeg build of BtbN, vgmstream's Linux build and wav2wem built for Linux."""
    with tarfile.open(fetch("python-linux")) as t:
        t.extractall(OUT, filter="tar")  # its top folder is python/
    python = py / "bin" / "python3"
    python.chmod(0o755)
    run(python, "-m", "ensurepip", "--default-pip")  # pip, if the build left it out
    run(python, "-m", "pip", "install", "--disable-pip-version-check", "--no-compile", "--only-binary=:all:", *PACKAGES)
    run(python, "-m", "pip", "install", "--disable-pip-version-check", "--no-compile", "--no-deps", ROOT / "core")
    for f in (py / "bin").glob("*"):  # the launchers pip made: the shell runs `-m audiodiver`
        if f.name not in ("python3", f"python{PYTHON.rsplit('.', 1)[0]}") and not f.name.startswith("python3."):
            f.unlink()
    # what the core never uses: pip once the packages are in, Tk and the programs made with it
    stdlib = next(py.glob("lib/python3.*"))
    for gone in [*stdlib.glob("site-packages/pip"), *stdlib.glob("site-packages/pip-*"), stdlib / "ensurepip",
                 stdlib / "idlelib", stdlib / "tkinter", stdlib / "turtledemo", *py.glob("lib/tcl*"), *py.glob("lib/tk*"),
                 *py.glob("lib/itcl*"), *py.glob("lib/thread*")]:
        shutil.rmtree(gone, ignore_errors=True)
    for gone in [*py.glob("lib/libtcl*"), *py.glob("lib/libtk*"), *stdlib.glob("lib-dynload/_tkinter*")]:
        gone.unlink()
    run(python, "-m", "compileall", "-q", "-j", "0", py / "lib")  # /usr/lib and an AppImage are read-only
    run(python, "-c", "import audiodiver.server, numpy, PIL.Image, lz4.frame; print('the core imports')")
    licence = next(py.glob("lib/python3.*/LICENSE.txt"), None)
    if licence:
        shutil.copy(licence, lic / "python.txt")
    libs = OUT / "lib"
    libs.mkdir()
    with tarfile.open(fetch("ffmpeg-linux")) as t:
        for m in t.getmembers():
            parts = m.name.split("/")
            # each library once, under the name the programs load (libavcodec.so.63): Tauri copies a link as a file,
            # so the other two names would be two more copies
            if len(parts) == 3 and parts[1] == "lib" and re.fullmatch(r"lib\w+\.so\.\d+", parts[2]):
                real = m
                while real.issym():
                    real = t.getmember(f"{parts[0]}/lib/{real.linkname}")
                with t.extractfile(real) as src, open(libs / parts[2], "wb") as dst:
                    shutil.copyfileobj(src, dst)
            elif m.name.endswith(("/bin/ffmpeg", "/bin/ffprobe")) or m.name.endswith("/LICENSE.txt"):
                to = tools / Path(m.name).name if "/bin/" in m.name else lic / "ffmpeg.txt"
                with t.extractfile(m) as src, open(to, "wb") as dst:
                    shutil.copyfileobj(src, dst)
    for f in libs.iterdir():  # each finds the others beside it, as linuxdeploy checks the AppImage's libraries one by one
        run("patchelf", "--set-rpath", "$ORIGIN", f)
    with zipfile.ZipFile(fetch("vgmstream-linux")) as z:
        (tools / "vgmstream-cli").write_bytes(z.read("vgmstream-cli"))
    shutil.copy(fetch("vgmstream-copying"), lic / "vgmstream.txt")
    wav2wem(tools, lic)
    oggenc_linux(tools, lic)
    # links as plain files: what Tauri, the AppImage and the .tar.gz all keep the same way
    for f in [f for f in OUT.rglob("*") if f.is_symlink()]:
        target = f.resolve()
        f.unlink()
        if target.is_file():
            shutil.copy2(target, f)


def wav2wem(tools, lic):
    """wav2wem built from its source with Go, with its licences."""
    env = {**os.environ, "GOBIN": str(tools), "GOFLAGS": "-trimpath", "CGO_ENABLED": "0"}
    run("go", "install", "-ldflags=-s -w", WAV2WEM, env=env)
    mod = Path(subprocess.run(["go", "env", "GOMODCACHE"], capture_output=True, text=True, check=True).stdout.strip())
    src = Path(f"{mod / WAV2WEM.split('/cmd/')[0]}@{WAV2WEM.split('@')[1]}")  # the module's source, with its licence
    shutil.copy(src / "LICENSE", lic / "wav2wem.txt")
    shutil.copy(src / "THIRD_PARTY_NOTICES.md", lic / "wav2wem-third-party.md")


def oggenc_linux(tools, lic):
    """oggenc as one static program: wav2wem's own encoder is oggenc2.exe (libvorbis aoTuV b6.03), which runs only on
    Windows, so the core encodes with this one off Windows and wav2wem takes its .ogg (wem.OGGENC). Static, so it runs
    on any Linux whatever its C library."""
    work = CACHE.parent / "oggenc-build"
    shutil.rmtree(work, ignore_errors=True)
    prefix = work / "prefix"
    dirs = {}
    for name in ("libogg", "aotuv", "vorbis-tools"):
        with tarfile.open(fetch(name)) as t:
            t.extractall(work, filter="tar")
            dirs[name] = work / t.getnames()[0].split("/")[0]
    env = {**os.environ, "CFLAGS": "-O2", "PKG_CONFIG_PATH": str(prefix / "lib" / "pkgconfig")}
    jobs = f"-j{os.cpu_count() or 2}"
    static = ("--disable-shared", "--enable-static")

    def configure(d, *args):
        for f in ("configure", "config.guess", "config.sub", "install-sh", "missing", "depcomp", "compile"):
            if (d / f).is_file():  # aoTuV's archive leaves out the run permission
                (d / f).chmod(0o755)
        run("./configure", "-q", f"--prefix={prefix}", *args, cwd=d, env=env)

    for name in ("libogg", "aotuv"):
        configure(dirs[name], *static, *((f"--with-ogg={prefix}",) if name == "aotuv" else ()))
        run("make", "-s", jobs, cwd=dirs[name], env=env)
        run("make", "-s", "install", cwd=dirs[name], env=env)
    vt = dirs["vorbis-tools"]
    configure(vt, "--disable-nls", "--disable-ogg123", "--disable-oggdec", "--disable-ogginfo", "--disable-vcut",
              "--disable-vorbiscomment", "--without-flac", "--without-speex", "--without-kate", "--without-curl",
              f"--with-ogg={prefix}", f"--with-vorbis={prefix}")
    run("make", "-s", jobs, "-C", "share", cwd=vt, env=env)
    run("make", "-s", jobs, "-C", "oggenc", "LDFLAGS=-all-static", cwd=vt, env=env)
    shutil.copy(vt / "oggenc" / "oggenc", tools / "oggenc")
    run("strip", tools / "oggenc")
    shutil.copy(vt / "COPYING", lic / "oggenc.txt")
    shutil.copy(dirs["aotuv"] / "COPYING", lic / "aotuv.txt")
    shutil.copy(dirs["libogg"] / "COPYING", lic / "libogg.txt")
    shutil.rmtree(work, ignore_errors=True)


def core_windows(py, tools, lic):
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
    wav2wem(tools, lic)


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
        # the core's own, which About compares with the app's
        "core/audiodiver/__init__.py": re.search(r'__version__ = "([^"]+)"',
                                                 (ROOT / "core" / "audiodiver" / "__init__.py").read_text(encoding="utf-8")).group(1),
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
    """The release text on GitHub and in the Updates tab: the changelog section alone."""
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stdout.write(section(tag.removeprefix("v")) + "\n")


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


def utils():
    """Audiodiver-Utils-<version>-portable.zip: the same exe (a utils.txt beside it makes it show only the Tools) with
    the core minus ffmpeg, ffprobe, numpy and Pillow (Repatch, Combine and Patch Content decode with vgmstream and
    play WAVs; Patch Content encodes silence, a .wem or a 16-bit WAV at 48 kHz, which need no ffmpeg), and
    audiodiver.cmd for the command line (`audiodiver repatch`, `combine`, `check`, `scan`), on the same data folder as
    the window. On Linux: Audiodiver-Utils-<version>-linux-x86_64.tar.gz, the same with an `audiodiver` script."""
    if LINUX:
        return utils_linux()
    exe = TAURI / "target" / "release" / "audiodiver.exe"
    if not exe.is_file() or not (OUT / "python" / "python.exe").is_file():
        sys.exit("build first: `release.py core`, then `tauri build`")
    out = TAURI / "target" / "release" / "bundle" / "portable" / f"Audiodiver-Utils-{version()}-portable.zip"
    out.parent.mkdir(parents=True, exist_ok=True)
    left_out = {"tools/ffmpeg.exe", "tools/ffprobe.exe", "licenses/ffmpeg.txt", "licenses/README.txt"}
    # numpy and Pillow, more than half of the core: they render exports and frame icons, which the Tools don't
    # (test_the_tools_work_without_numpy_and_pillow)
    left_pkgs = re.compile(r"python/Lib/site-packages/(numpy|numpy\.libs|numpy-[^/]*\.dist-info|PIL|pillow-[^/]*\.dist-info)/")
    top = "Audiodiver Utils"
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        z.write(exe, f"{top}/Audiodiver Utils.exe")
        z.writestr(f"{top}/portable.txt", PORTABLE_TXT.replace("Audiodiver.exe", "Audiodiver Utils.exe")
                   .replace("the new portable ZIP", "the new Audiodiver Utils ZIP").replace("This copy of Audiodiver", "This copy of Audiodiver Utils"))
        z.writestr(f"{top}/utils.txt", UTILS_TXT)
        z.writestr(f"{top}/audiodiver.cmd", UTILS_CMD.replace("\n", "\r\n"))
        z.write(ROOT / "LICENSE", f"{top}/LICENSE.txt")
        z.writestr(f"{top}/core/licenses/README.txt", re.sub(r"FFmpeg .*?\n(?:    .*\n)+", "", SOURCES)
                   .replace("numpy, pillow, lz4                     their licences are in python/Lib/site-packages/*.dist-info",
                            "lz4                                   its licence is in python/Lib/site-packages/lz4-*.dist-info")
                   .replace(", ".join(PACKAGES), next(p for p in PACKAGES if p.startswith("lz4"))))
        for f in sorted(OUT.rglob("*")):
            rel = f.relative_to(OUT).as_posix()
            if f.is_file() and rel not in left_out and not left_pkgs.match(rel):
                z.write(f, f"{top}/core/{rel}")
    print(f"{out}: {out.stat().st_size / 1e6:.0f} MB")


def utils_linux():
    """Audiodiver Utils for Linux, as a folder in a .tar.gz (permissions kept): the program, the core beside it without
    ffmpeg, numpy and Pillow, utils.txt, portable.txt and the `audiodiver` script."""
    exe = TAURI / "target" / "release" / "audiodiver"
    if not exe.is_file() or not (OUT / "python" / "bin" / "python3").is_file():
        sys.exit("build first: `release.py core`, then `tauri build`")
    out = TAURI / "target" / "release" / "bundle" / "portable" / f"Audiodiver-Utils-{version()}-linux-x86_64.tar.gz"
    out.parent.mkdir(parents=True, exist_ok=True)
    left_out = {"tools/ffmpeg", "tools/ffprobe", "licenses/ffmpeg.txt", "licenses/README.txt"}
    ffmpeg_libs = re.compile(r"lib/lib(av|sw|postproc)[^/]*$")  # the libraries of FFmpeg, which Utils leaves out with it
    left_pkgs = re.compile(r"python/lib/python3\.\d+/site-packages/(numpy|numpy\.libs|numpy-[^/]*\.dist-info|PIL|pillow\.libs|pillow-[^/]*\.dist-info)/")
    top = "Audiodiver Utils"

    def text(t: tarfile.TarFile, name: str, body: str, mode=0o644):
        data = body.encode()
        info = tarfile.TarInfo(f"{top}/{name}")
        info.size, info.mode, info.mtime = len(data), mode, int(time.time())
        t.addfile(info, io.BytesIO(data))

    with tarfile.open(out, "w:gz", compresslevel=9) as t:
        t.add(exe, f"{top}/audiodiver-utils")
        text(t, "portable.txt", PORTABLE_TXT_LINUX)
        text(t, "utils.txt", UTILS_TXT.replace("Audiodiver Utils.exe is the window; audiodiver.cmd runs",
                                               "audiodiver-utils is the window; the audiodiver script runs"))
        text(t, "audiodiver", UTILS_SH, 0o755)
        t.add(ROOT / "LICENSE", f"{top}/LICENSE.txt")
        text(t, "core/licenses/README.txt", re.sub(r"FFmpeg .*?\n(?:    .*\n)+", "", SOURCES_LINUX)
             .replace("numpy, pillow, lz4                     their licences are in python/lib/python3.*/site-packages/*.dist-info",
                      "lz4                                   its licence is in python/lib/python3.*/site-packages/lz4-*.dist-info")
             .replace(", ".join(PACKAGES), next(p for p in PACKAGES if p.startswith("lz4"))))
        for f in sorted(OUT.rglob("*")):
            rel = f.relative_to(OUT).as_posix()
            if (f.is_file() or f.is_symlink()) and rel not in left_out and not left_pkgs.match(rel) and not ffmpeg_libs.match(rel):
                t.add(f, f"{top}/core/{rel}", recursive=False)
    print(f"{out}: {out.stat().st_size / 1e6:.0f} MB")


UTILS_SH = """#!/bin/sh
# Audiodiver's tools from a command line: audiodiver repatch|combine|check|scan ... (utils.txt has more)
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PATH="$HERE/core/tools:$PATH"
export PATH
: "${AUDIODIVER_CACHE:=$HERE/data}"
export AUDIODIVER_CACHE
exec "$HERE/core/python/bin/python3" -X utf8 -m audiodiver "$@"
"""

PORTABLE_TXT_LINUX = """This copy of Audiodiver Utils is portable. It keeps its settings, caches and logs in the data folder next to
audiodiver-utils, and nothing in the home folder. The folder can be moved or copied with its data.

To update it, download the new Audiodiver Utils archive from https://github.com/Alomare/Audiodiver/releases and
replace audiodiver-utils and the core folder. Keep the data folder.
"""

UTILS_TXT = """This is Audiodiver Utils: the Tools of Audiodiver (Repatch, Combine Mods, Patch Content and the installed mods
check) without projects. Patch Content takes new audio as a 16-bit WAV at 48 kHz or a .wem: the full Audiodiver
converts other formats. Audiodiver Utils.exe is the window; audiodiver.cmd runs the other tools from a command line:

    audiodiver scan <mod>              what a mod holds: its patches, options and the choice it starts with
    audiodiver repatch <mod> [--out DIR] [--name NAME] [--every-bank]
    audiodiver combine <mod> <mod> ... [--plan FILE] [--clashes] [--out DIR] [--name NAME] [--every-bank]
    audiodiver check                   the installed mods with sound banks of an older game version

A mod is a ZIP, a folder or a .patch_0 file. --json prints the result as JSON; `audiodiver <command> --help` has
the rest. Both read the game the same way and keep their files in the data folder here.
"""

UTILS_CMD = """@echo off
rem Audiodiver's tools from a command line: audiodiver repatch|combine|check|scan ... (utils.txt has more)
setlocal
set "HERE=%~dp0"
set "PATH=%HERE%core\\tools;%PATH%"
if not defined AUDIODIVER_CACHE set "AUDIODIVER_CACHE=%HERE%data"
"%HERE%core\\python\\python.exe" -X utf8 -m audiodiver %*
"""

PORTABLE_TXT = """This copy of Audiodiver is portable. It keeps its settings, caches, notes and logs in the data folder
next to Audiodiver.exe, and nothing in the user's AppData folder. The folder can be moved or copied with its data.

To update it, download the new portable ZIP from https://github.com/Alomare/Audiodiver/releases and replace
Audiodiver.exe and the core folder. Keep the data folder.
"""

if __name__ == "__main__":
    what, *args = sys.argv[1:] or ["help"]
    {"core": core, "portable": portable, "utils": utils, "check": check, "notes": notes}.get(what, lambda *_: sys.exit(__doc__))(*args)
