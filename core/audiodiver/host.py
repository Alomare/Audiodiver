"""What differs between Windows and Linux outside the game files: where Steam is, where the core keeps its files,
the Documents folder, the trash, the system's language, and the environment a program of the system starts with.

On Linux the app may run as an AppImage, which puts its own folder first in LD_LIBRARY_PATH, PATH and more. A program
of the system that inherits those loads the AppImage's libraries in place of its own and can fail (xdg-open, gio),
so `system_env` gives it the environment without them.
"""
import os
import re
import shutil
import time
import urllib.parse
from pathlib import Path

WINDOWS = os.name == "nt"


def home() -> Path:
    return Path.home()


def data_home() -> Path:
    """Where the core keeps its settings, caches and log: %LOCALAPPDATA% on Windows, $XDG_DATA_HOME on Linux
    (~/.local/share)."""
    if WINDOWS:
        return Path(os.environ.get("LOCALAPPDATA") or home() / "AppData" / "Local")
    return Path(os.environ.get("XDG_DATA_HOME") or home() / ".local" / "share")


def config_home() -> Path:
    """Where programs keep their settings: %APPDATA% on Windows, $XDG_CONFIG_HOME on Linux (~/.config)."""
    if WINDOWS:
        return Path(os.environ.get("APPDATA") or home() / "AppData" / "Roaming")
    return Path(os.environ.get("XDG_CONFIG_HOME") or home() / ".config")


def steam_roots_linux() -> list[str]:
    """Where Steam keeps its files on Linux: the native install (two links and the folder itself), Flatpak, Snap."""
    h = home()
    candidates = [h / ".steam" / "steam", h / ".steam" / "root", h / ".local" / "share" / "Steam",
                  h / ".var" / "app" / "com.valvesoftware.Steam" / ".local" / "share" / "Steam",
                  h / "snap" / "steam" / "common" / ".local" / "share" / "Steam"]
    out = []
    for c in candidates:
        try:
            if (c / "steamapps").is_dir():
                out.append(str(c.resolve()))
        except OSError:
            pass
    return list(dict.fromkeys(out))


def documents() -> Path:
    """The user's Documents folder: where Windows has moved it (OneDrive's included), or the XDG documents folder."""
    if WINDOWS:
        import ctypes
        from ctypes import wintypes
        buf = ctypes.create_unicode_buffer(wintypes.MAX_PATH)
        if ctypes.windll.shell32.SHGetFolderPathW(None, 5, None, 0, buf) == 0 and buf.value:  # CSIDL_PERSONAL
            return Path(buf.value)
        return home() / "Documents"
    try:  # user-dirs.dirs: XDG_DOCUMENTS_DIR="$HOME/Documents", in the user's language
        text = (config_home() / "user-dirs.dirs").read_text(errors="replace")
        m = re.search(r'^XDG_DOCUMENTS_DIR="([^"]+)"', text, re.M)
        if m:
            path = Path(m.group(1).replace("$HOME", str(home())))
            if path != home():  # set to $HOME when the folder is turned off
                return path
    except OSError:
        pass
    return home() / "Documents"


def system_language() -> str | None:
    """The language the system shows ("pt-BR"), or None when it can't tell."""
    if WINDOWS:
        try:
            import ctypes
            import locale
            name = locale.windows_locale.get(ctypes.windll.kernel32.GetUserDefaultUILanguage())
            return name.replace("_", "-") if name else None
        except (AttributeError, OSError):
            return None
    for var in ("LC_ALL", "LC_MESSAGES", "LANGUAGE", "LANG"):
        value = (os.environ.get(var) or "").split(":")[0].split(".")[0].split("@")[0]
        if value and value not in ("C", "POSIX"):
            return value.replace("_", "-")
    return None


def system_env() -> dict:
    """The environment for a program of the system: without what an AppImage added (its folder in path lists, its
    own variables). The environment as it is outside an AppImage."""
    env = dict(os.environ)
    appdir = env.get("APPDIR")
    if not appdir:
        return env
    for key in ("APPDIR", "APPIMAGE", "ARGV0", "OWD"):
        env.pop(key, None)
    for key, value in list(env.items()):
        if appdir not in value:
            continue
        parts = value.split(os.pathsep)
        kept = [p for p in parts if p and not p.startswith(appdir)]
        if kept:
            env[key] = os.pathsep.join(kept)
        else:
            del env[key]
    return env


def open_folder(path: Path) -> bool:
    """Shows path in the system's file manager (its folder, for a file). False when there is nothing to open it."""
    import subprocess
    path = Path(path)
    if WINDOWS:
        subprocess.Popen(["explorer", "/select,", str(path)] if path.is_file() else ["explorer", str(path)])
        return True
    opener = shutil.which("xdg-open", path=system_env().get("PATH"))
    if not opener:
        return False
    subprocess.Popen([opener, str(path if path.is_dir() else path.parent)], env=system_env(),
                     stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    return True


def trash(paths: list[Path]) -> None:
    """Moves files to the trash as the freedesktop.org Trash specification has it: the home trash, or the
    .Trash-<uid> folder at the top of another drive. A file that can't go there stays where it is."""
    for p in paths:
        try:
            _trash_one(Path(p).resolve())
        except OSError:
            pass


def _trash_one(p: Path):
    home_trash = data_home() / "Trash"
    there = home_trash
    while not there.exists() and there.parent != there:  # a home trash not made yet: the drive it will be on
        there = there.parent
    try:
        same_drive = p.stat().st_dev == there.stat().st_dev
    except OSError:
        same_drive = False
    if same_drive:
        trash = home_trash
    else:  # the top of the drive the file is on
        top = p
        while top.parent != top and top.parent.stat().st_dev == p.stat().st_dev:
            top = top.parent
        trash = top / f".Trash-{os.getuid()}"
    (trash / "files").mkdir(parents=True, exist_ok=True)
    (trash / "info").mkdir(parents=True, exist_ok=True)
    name, n = p.name, 1
    while True:
        info = trash / "info" / f"{name}.trashinfo"
        try:
            fd = os.open(info, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)  # the name is taken by creating it
            break
        except FileExistsError:
            n += 1
            name = f"{p.stem} {n}{p.suffix}"
    shown = str(p) if same_drive else os.path.relpath(p, trash.parent)
    with os.fdopen(fd, "w") as f:
        f.write(f"[Trash Info]\nPath={urllib.parse.quote(shown)}\nDeletionDate={time.strftime('%Y-%m-%dT%H:%M:%S')}\n")
    try:
        shutil.move(str(p), str(trash / "files" / name))
    except OSError:
        info.unlink(missing_ok=True)
        raise
