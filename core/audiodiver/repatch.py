"""Repatching: an existing mod rebuilt on the game as it is now.

A mod's patch holds whole copies of the banks it changes, frozen at the game version it was made for. After a game
update those copies are stale (the game's newer objects are missing from them, and a later one replaces the game's
own). A repatch
takes what each patch replaces, adds and sets (Session.import_patch's reading) into a project of its own and makes
the patch again: the banks come from the current game, the mod's audio rides on them as it was encoded
(build.keep_encoding), its settings on the game's objects as it set them. The mod stays one mod (repackage): every
file where it was, its manifest's options and id as they were, the new patches in place of the old ones.

This module finds the patches in what was given: a .patch_N file, a folder, or a mod's ZIP. A ZIP or folder made
for a mod manager has a manifest.json (HD2 Arsenal's format, which other managers share): its Name, Description,
Guid and icon carry over, and its options name the patches found under their folders.
"""
import json
import re
import shutil
import uuid
import zipfile
from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath

PATCH_RE = re.compile(r"\.patch_\d+$", re.I)
IMAGE_TYPES = (".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif")


class RepatchError(Exception):
    for_people = True


@dataclass
class Patch:
    key: str    # where it is: its path in the ZIP, or relative to the folder ("/"-separated)
    label: str  # the manifest's option (and sub-option) it belongs to, else its folder; "" for the only one
    # the folder's other patches (patch_1 over patch_0, or another archive's): a mod manager deploys a folder whole,
    # so they are one part of the mod, in the order the game loads them
    also: list[str] = field(default_factory=list)

    @property
    def keys(self) -> list[str]:
        return [self.key, *self.also]


@dataclass
class Found:
    source: Path
    name: str
    description: str = ""
    guid: str = ""          # the manifest's, when it is one
    icon: str = ""          # where the manifest's icon is (like Patch.key), when it has one
    patches: list[Patch] = field(default_factory=list)
    manifest: dict = field(default_factory=dict)  # the manifest as it was read ({} without one)
    manifest_key: str = ""  # where it is (like Patch.key)
    names: list[str] = field(default_factory=list)  # every file of the mod (keys), for repackage

    @property
    def is_zip(self) -> bool:
        return self.source.is_file() and self.source.suffix.lower() == ".zip"

    def read(self, key: str) -> bytes | None:
        """A file of the mod by its key; None when it isn't there."""
        if self.is_zip:
            with zipfile.ZipFile(self.source) as z:
                try:
                    return z.read(key)
                except KeyError:
                    return None
        root = self.source.parent if self.source.is_file() else self.source
        f = root / key
        return f.read_bytes() if f.is_file() else None

    def place(self, key: str, folder: Path) -> Path:
        """The patch file `key` with its .stream next to it, as files on disk: where they are in a folder, or taken
        out of the ZIP into `folder` (each under its own name: nothing in the ZIP picks where it lands)."""
        if not self.is_zip:
            return (self.source.parent if self.source.is_file() else self.source) / key
        folder.mkdir(parents=True, exist_ok=True)
        out = folder / PurePosixPath(key).name
        with zipfile.ZipFile(self.source) as z:
            for suffix in ("", ".stream"):
                try:
                    with z.open(key + suffix) as src, open(str(out) + suffix, "wb") as dst:
                        shutil.copyfileobj(src, dst)
                except KeyError:
                    pass
        return out

    def copy(self, key: str, dst):
        """Writes the mod's file `key` into the open file dst."""
        if self.is_zip:
            with zipfile.ZipFile(self.source) as z, z.open(key) as src:
                shutil.copyfileobj(src, dst)
        else:
            with open((self.source.parent if self.source.is_file() else self.source) / key, "rb") as src:
                shutil.copyfileobj(src, dst)


SUFFIXES = ("", ".stream", ".gpu_resources")  # a patch's files (a missing one ships empty, as arsenal.py does)


def repackage(found: Found, out_zip: Path, rebuilt: dict[str, Path], name: str, gone=()) -> Path:
    """The mod as it was, as a ZIP for its mod manager: every file where it was, each rebuilt patch ({key: the new
    patch_0 on disk, its .stream next to it}) in place of the old one, the patches in `gone` (built into another's
    place) left out, and the manifest with `name` for its Name and nothing else changed. Written under another name
    first, so a failure leaves no broken ZIP."""
    swap = {key + s: Path(str(made) + s) for key, made in rebuilt.items() for s in SUFFIXES}
    gone = {key + s for key in gone for s in SUFFIXES}
    manifest = dict(found.manifest, Name=name) if found.manifest else None
    out_zip.parent.mkdir(parents=True, exist_ok=True)
    partial = out_zip.with_name(out_zip.name + ".partial")
    try:
        with zipfile.ZipFile(partial, "w", compression=zipfile.ZIP_DEFLATED) as z:
            for key in sorted((set(found.names) | set(swap)) - gone):
                with z.open(key, "w", force_zip64=True) as dst:
                    if key in swap:
                        if swap[key].is_file():
                            with open(swap[key], "rb") as src:
                                shutil.copyfileobj(src, dst)
                    elif key == found.manifest_key and manifest is not None:
                        dst.write((json.dumps(manifest, indent=4, ensure_ascii=False) + "\n").encode("utf-8"))
                    else:
                        found.copy(key, dst)
        partial.replace(out_zip)
    finally:
        partial.unlink(missing_ok=True)
    return out_zip


def clean_name(text: str) -> str:
    """A name HD2 Arsenal takes (arsenal.name_problem): what it can't use becomes a space."""
    text = re.sub(r"[^\x20-\x7e]|[\\/:*?\"<>|]", " ", text or "")
    return re.sub(r"\s+", " ", text).strip()


# what Nexus Mods adds to a download's name: "<name>-<mod id>-<version>-<unix time>" from the site, "<name> <mod id>
# <version> <date>T<time>Z <key>" from its app
DOWNLOAD_TAIL = re.compile(r"-\d+(?:-\d\w*)*-\d{10}$|\s\d+\s\S+\s\d{4}-\d\d-\d\dT\d\d-\d\dZ\s\w+$")


def file_name(text: str) -> str:
    """A mod's name from its file or folder name, without what a download added to it."""
    return clean_name(DOWNLOAD_TAIL.sub("", text)) or clean_name(text)


def _manifest(names: list[str], read) -> tuple[dict, str, str]:
    """The mod's manifest.json (the one nearest the top), where it is, and the folder it is in ("" at the top);
    ({}, "", "")."""
    found = sorted((n for n in names if PurePosixPath(n).name.lower() == "manifest.json"), key=lambda n: n.count("/"))
    for n in found:
        try:
            m = json.loads(read(n).decode("utf-8-sig"))
        except (ValueError, UnicodeDecodeError, AttributeError):
            continue
        if isinstance(m, dict):
            parent = str(PurePosixPath(n).parent)
            return m, n, "" if parent == "." else parent
    return {}, "", ""


def _options(manifest: dict) -> list[tuple[str, str]]:
    """[(folder, label)] the manifest's options include, longest folder first."""
    out = []

    def add(entry, label):
        inc = entry.get("Include") if isinstance(entry, dict) else None
        for folder in inc if isinstance(inc, list) else []:
            if isinstance(folder, str) and folder.strip("/\\ "):
                out.append((folder.replace("\\", "/").strip("/").lower(), label))

    for opt in manifest.get("Options") or []:
        if not isinstance(opt, dict):
            continue
        name = str(opt.get("Name") or "").strip()
        add(opt, name)
        for sub in opt.get("SubOptions") or []:
            if isinstance(sub, dict):
                add(sub, " / ".join(x for x in (name, str(sub.get("Name") or "").strip()) if x))
    return sorted(out, key=lambda x: -len(x[0]))


def scan(path) -> Found:
    """What a repatch of `path` would take: its patches, with the name and the rest a manifest gives."""
    path = Path(str(path or "")).expanduser()
    if not str(path).strip() or not path.exists():
        raise RepatchError(f"{path} wasn't found" if str(path).strip() else "Choose a mod's .patch_0 file, its "
                                                                         "folder or its ZIP")
    if path.is_file() and path.suffix.lower() == ".zip":
        try:
            with zipfile.ZipFile(path) as z:
                names = [i.filename for i in z.infolist() if not i.is_dir()]
        except (zipfile.BadZipFile, OSError):
            raise RepatchError(f"{path.name} can't be opened as a ZIP") from None
        found = Found(path, file_name(path.stem))
    elif path.is_file():
        if not PATCH_RE.search(path.name):
            raise RepatchError(f"{path.name} isn't a mod. Choose its .patch_0 file (Audiodiver reads the .stream file next to it as "
                               f"well), its folder or its ZIP" + (". Unpack .7z and .rar files first"
                                                                     if path.suffix.lower() in (".7z", ".rar") else ""))
        found = Found(path, file_name(path.parent.name))
        found.patches = [Patch(path.name, "")]
        return found
    else:
        names = [p.relative_to(path).as_posix() for p in path.rglob("*") if p.is_file()]
        found = Found(path, file_name(path.name))
    names.sort()
    found.names = names
    manifest, found.manifest_key, base = _manifest(names, found.read)
    found.manifest = manifest
    if manifest:
        found.name = clean_name(str(manifest.get("Name") or "")) or found.name
        found.description = str(manifest.get("Description") or "")
        try:
            found.guid = str(uuid.UUID(str(manifest.get("Guid"))))
        except ValueError:
            pass
        icon = str(manifest.get("IconPath") or "").replace("\\", "/").strip("/")
        if icon and icon.lower().endswith(IMAGE_TYPES):
            key = f"{base}/{icon}" if base else icon
            found.icon = next((n for n in names if n.lower() == key.lower()), "")
    options = _options(manifest)
    folders = {}
    for n in names:
        if PATCH_RE.search(n):
            folders.setdefault(str(PurePosixPath(n).parent), []).append(n)
    for folder, keys in folders.items():
        keys.sort(key=lambda n: (int(n.rsplit("_", 1)[1]), n.lower()))  # the order the game loads them in
        inner = folder[len(base) + 1:] if base and folder.startswith(base + "/") else "" if folder in (".", base) else folder
        label = next((lab for f, lab in options if inner.lower() == f or inner.lower().startswith(f + "/")), None)
        found.patches.append(Patch(keys[0], label if label is not None else inner, keys[1:]))
    if not found.patches:
        raise RepatchError(f"{path.name} holds no patch file (.patch_0)")
    if len(found.patches) == 1:
        found.patches[0].label = ""
    else:  # two folders of one option: their names tell them apart
        seen = {}
        for p in found.patches:
            seen.setdefault(p.label, []).append(p)
        for group in (g for g in seen.values() if len(g) > 1):
            for p in group:
                p.label = " / ".join(x for x in (p.label, PurePosixPath(p.key).parent.name) if x)
    return found


def documents() -> Path:
    """The user's Documents folder (where Windows has moved it, OneDrive's included)."""
    if hasattr(__import__("ctypes"), "windll"):
        import ctypes
        from ctypes import wintypes
        buf = ctypes.create_unicode_buffer(wintypes.MAX_PATH)
        if ctypes.windll.shell32.SHGetFolderPathW(None, 5, None, 0, buf) == 0 and buf.value:  # CSIDL_PERSONAL
            return Path(buf.value)
    return Path.home() / "Documents"
