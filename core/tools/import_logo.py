"""Dev tool: puts the official logo (assets/logo) where the core and the app's build tools take it from.

    python core/tools/import_logo.py

Run it again whenever the files in assets/logo change. It writes:

  core/audiodiver/data/icon.png  the icon a mod gets when its project has no image of its own (arsenal.default_icon):
                                 the logo on its dark tile, at the 540x540 HD2 Arsenal shows.
  app/app-icon.png               the image Tauri's icon tool starts from.

The app's own icons (the exe, the taskbar, the installer) are made from that with Tauri's tool. It also writes
icons for phones, which this app doesn't have: delete those two folders afterwards.

    cd app
    npx tauri icon app-icon.png
    (delete src-tauri/icons/android and src-tauri/icons/ios)

The interface itself needs nothing done: it takes the logo straight from assets/logo (app/vite.config.ts, @logo).
"""
import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
LOGO = ROOT / "assets" / "logo"
SIZE = 540  # arsenal.ICON_SIZE


def main():
    tile = LOGO / "icon-dark-fullres.png"
    with Image.open(tile) as img:
        assert img.width == img.height, f"{tile.name} isn't square"
        out = ROOT / "core" / "audiodiver" / "data" / "icon.png"
        img.convert("RGB").resize((SIZE, SIZE), Image.Resampling.LANCZOS).save(out, format="PNG", optimize=True)
        print(f"{out.relative_to(ROOT)}: {SIZE}x{SIZE}, {out.stat().st_size} bytes (from {tile.name}, {img.width}x{img.height})")
    shutil.copyfile(tile, ROOT / "app" / "app-icon.png")
    print("app/app-icon.png: a copy of", tile.name)


if __name__ == "__main__":
    main()
