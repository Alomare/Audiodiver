"""Packages HD2 patch archives into an HD2 Arsenal mod ZIP.

Layout matches the Script workspace's packager (Mods/Script/tools/package.py): manifest.json at the root, every Include folder
holds a 9ba626afa44a3aa3.patch_0, with its .stream and .gpu_resources when they hold data (most audio mods ship
without an empty one, and audio has no GPU data). Arsenal renumbers patch_0 to a free slot on deploy, so every
folder uses patch_0.

Manifest rules (BSL CLAUDE.md, hd2-lua-mod skill 6.16):
  - Name is plain ASCII without \\ / : * ? " < > | or edge spaces (managers use it as a folder name), and no
    version: Arsenal keeps the Name from the first import.
  - Guid stays fixed for the life of a mod, so a re-import updates it instead of adding a copy.
  - IconPath is a 540x540 PNG, reused as every option's Image.

An option is {name, description, folder} or {name, description, choices: [{name, description, folder}]},
where folder is a local directory of archive files. Choices become Arsenal SubOptions (exactly one is
deployed).
"""
import io
import json
import re
import shutil
import time
import uuid
import zipfile
from pathlib import Path

ARCHIVE = '9ba626afa44a3aa3.patch_0'
SUFFIXES = ('', '.stream', '.gpu_resources')
PNG_MAGIC = b'\x89PNG\r\n\x1a\n'
ICON_SIZE = 540

# The frame around an icon when the project doesn't set one: no border, square corners. The colour is #rrggbb;
# border and radius are pixels of the 540 tile.
FRAME = {'border': 0, 'border_color': '#ffd400', 'radius': 0}
FRAME_KEYS = tuple(FRAME)
BORDER_MAX, RADIUS_MAX = 48, 270



def name_problem(name):
    """Why a mod manager can't take this as a mod's name (it names a folder after it), or None. The app's Build tab
    says the same as you type (nameProblem in BuildTab.tsx)."""
    if not name.strip():
        return "A mod needs a name"
    if name != name.strip():
        return "The name starts or ends with a space"
    bad = sorted({c for c in name if not 32 <= ord(c) <= 126 or c in '\\/:*?"<>|'})
    if bad:  # an invisible one is named
        shown = ["a tab" if c == "\t" else f"U+{ord(c):04X}" if ord(c) < 32 else c for c in bad]
        return f"Mod managers can't use {' '.join(shown)} in a name (letters, digits, spaces and - _ ( ) are fine)"
    if not re.search(r"[A-Za-z0-9]", name):
        return "The name needs a letter or a digit"
    return None


def check_name(name):
    if problem := name_problem(name):
        raise ValueError(f"name {name!r}: {problem}")


def slug(text):
    """A folder or file name for text: lowercase letters, digits and _ ("mod" when nothing is left)."""
    return re.sub(r'[^a-z0-9]+', '_', text.lower()).strip('_') or 'mod'


def archive_files(folder):
    """The patch's files in folder as the ZIP takes them: {name: its path}, without a .stream or .gpu_resources that
    is missing or empty."""
    folder = Path(folder)
    if not (folder / ARCHIVE).is_file():
        raise FileNotFoundError(f'{folder} has no {ARCHIVE}')
    extra = [p.name for p in folder.iterdir() if p.name not in {ARCHIVE + s for s in SUFFIXES}]
    if extra:
        raise ValueError(f'{folder} has files a mod manager would not expect: {extra}')
    return {ARCHIVE + s: f for s in SUFFIXES if (f := folder / (ARCHIVE + s)).is_file() and (not s or f.stat().st_size)}


def save_patch_files(folder, to):
    """Copies the patch's files in folder, as the ZIP takes them, into the folder `to`, in place of those there: a
    file this patch lacks is taken away from there too."""
    to = Path(to)
    to.mkdir(parents=True, exist_ok=True)
    files = archive_files(folder)
    for name in (ARCHIVE + s for s in SUFFIXES):
        if name in files:
            shutil.copyfile(files[name], to / name)
        else:
            (to / name).unlink(missing_ok=True)


def icon_frame(icon=None) -> dict:
    """The full frame of an icon: FRAME with what `icon` sets. Values are checked and normalised; a bad one raises
    ValueError naming it."""
    icon = icon or {}
    out = dict(FRAME)
    if 'border_color' in icon:
        if not re.fullmatch(r'#[0-9a-fA-F]{6}', str(icon['border_color'])):
            raise ValueError(f'border_color is a colour like #ffd400, not {icon["border_color"]!r}')
        out['border_color'] = str(icon['border_color']).lower()
    for key, top in (('border', BORDER_MAX), ('radius', RADIUS_MAX)):
        if key in icon:
            try:
                out[key] = max(0, min(top, round(float(icon[key]))))
            except (TypeError, ValueError, OverflowError):  # OverflowError: Infinity
                raise ValueError(f'{key} is a number of pixels, not {icon[key]!r}') from None
    return out


def _rgb(color):
    return tuple(int(color[i:i + 2], 16) for i in (1, 3, 5))


def framed(img, frame):
    """img (540x540) with the frame's border and rounded corners, drawn at four times the size and scaled down so
    the curves are smooth. Rounded corners leave the outside transparent."""
    from PIL import Image, ImageChops, ImageDraw
    border, radius = frame['border'], frame['radius']
    if not border and not radius:
        return img
    n, k = img.width, 4
    big = n * k

    def shape(inset, r):
        m = Image.new('L', (big, big), 0)
        ImageDraw.Draw(m).rounded_rectangle((inset * k, inset * k, big - 1 - inset * k, big - 1 - inset * k),
                                            max(0, r) * k, fill=255)
        return m

    outer = shape(0, radius)
    out = img.convert('RGBA')
    if radius:
        out.putalpha(ImageChops.multiply(out.getchannel('A'), outer.resize((n, n), Image.Resampling.LANCZOS)))
    if border:
        ring = ImageChops.subtract(outer, shape(border, radius - border)).resize((n, n), Image.Resampling.LANCZOS)
        paint = Image.new('RGBA', (n, n), _rgb(frame['border_color']) + (255,))
        paint.putalpha(ring)
        out = Image.alpha_composite(out, paint)
    return out


def _png(img) -> bytes:
    out = io.BytesIO()
    img.save(out, format='PNG', optimize=True)
    return out.getvalue()


def default_icon(frame=None) -> bytes:
    """Audiodiver's default icon, for a mod without an image of its own, as a 540x540 PNG in the frame `frame` sets
    (icon_frame): Audiodiver's logo on its dark tile (data/icon.png, which tools/import_logo.py makes from the
    official image in assets/logo)."""
    from importlib import resources
    frame = icon_frame(frame)
    data = resources.files('audiodiver').joinpath('data', 'icon.png').read_bytes()
    if not frame['border'] and not frame['radius']:
        return data  # without Pillow, as Repatch and Combine in Audiodiver Utils make it
    from PIL import Image
    with Image.open(io.BytesIO(data)) as img:
        return _png(framed(img.convert('RGB'), frame))


def icon_png(image, frame=None) -> bytes:
    """A 540x540 PNG made from any image file Pillow reads: cropped to a square around the centre, resized, and
    framed as `frame` says (no frame by default). An unframed image that already is a 540x540 PNG is returned as
    it is. Raises ValueError for a file that is no image."""
    from PIL import Image, ImageOps, UnidentifiedImageError
    frame = icon_frame(frame)
    data = Path(image).read_bytes()
    try:
        with Image.open(io.BytesIO(data)) as img:
            if img.format == 'PNG' and img.size == (ICON_SIZE, ICON_SIZE) and not frame['border'] and not frame['radius']:
                return data
            img = ImageOps.exif_transpose(img)  # a phone photo keeps its orientation in EXIF
            img = img.convert('RGBA' if 'A' in img.getbands() or 'transparency' in img.info else 'RGB')
            return _png(framed(ImageOps.fit(img, (ICON_SIZE, ICON_SIZE), Image.Resampling.LANCZOS), frame))
    except Image.DecompressionBombError:
        raise ValueError(f'{Path(image).name} is too large to use as an icon') from None
    except (UnidentifiedImageError, OSError, SyntaxError) as e:
        raise ValueError(f'{Path(image).name} is not an image Audiodiver can read') from e


def package(out_zip, *, name, guid, icon, options, description=''):
    """description is left empty for test builds: the user finds it clutters Arsenal's UI. The ZIP is written under
    another name first, so a build that fails halfway leaves no broken ZIP behind."""
    check_name(name)
    guid = str(uuid.UUID(guid))
    icon_bytes = Path(icon).read_bytes()
    if not icon_bytes.startswith(PNG_MAGIC):
        raise ValueError(f'icon {icon} is not a PNG')

    files = {'icon.png': icon_bytes}
    manifest_options = []
    for opt in options:
        top = slug(opt['name'])
        entry = {'Name': opt['name'], 'Description': opt['description'], 'Include': [top], 'Image': 'icon.png'}
        if 'choices' in opt:
            subs = []
            for choice in opt['choices']:
                path = f"{top}/{slug(choice['name'])}"
                for fname, data in archive_files(choice['folder']).items():
                    files[f'{path}/{fname}'] = data
                subs.append({'Name': choice['name'], 'Description': choice['description'], 'Include': [path],
                             'Image': 'icon.png'})
            entry['SubOptions'] = subs
        else:
            for fname, data in archive_files(opt['folder']).items():
                files[f'{top}/{fname}'] = data
        manifest_options.append(entry)

    manifest = {'Version': 1, 'Guid': guid, 'Name': name, 'Description': description, 'IconPath': 'icon.png',
                'Options': manifest_options}
    files['manifest.json'] = (json.dumps(manifest, indent=4) + '\n').encode()

    out_zip = Path(out_zip)
    out_zip.parent.mkdir(parents=True, exist_ok=True)
    partial = out_zip.with_name(out_zip.name + '.partial')
    # the files are dated when the ZIP is made: a fixed 1980-01-01 00:00 showed in Windows as 31 December 1979, 23:00
    made = time.localtime()[:6]
    try:
        with zipfile.ZipFile(partial, 'w', compression=zipfile.ZIP_DEFLATED) as z:
            for path, data in sorted(files.items()):
                info = zipfile.ZipInfo(path, date_time=made)
                info.external_attr = 0o100644 << 16
                # a patch file is stored, copied from disk: Vorbis barely deflates (3% for half of a build's time)
                if isinstance(data, Path):
                    info.compress_type = zipfile.ZIP_STORED
                    info.file_size = data.stat().st_size
                    with open(data, 'rb') as src, z.open(info, 'w') as dst:
                        shutil.copyfileobj(src, dst, 1 << 20)
                else:
                    info.compress_type = zipfile.ZIP_DEFLATED
                    z.writestr(info, data)
        partial.replace(out_zip)
    finally:
        partial.unlink(missing_ok=True)
    return out_zip
