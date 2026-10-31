"""Dev tool: puts the official logo (assets/logo) where the core and the app's build tools take it from.

    python core/tools/import_logo.py

Run it again whenever the files in assets/logo change. It writes:

  core/audiodiver/data/icon.png  the icon a mod gets when its project has no image of its own (arsenal.default_icon):
                                 the logo on its dark tile, at the 540x540 HD2 Arsenal shows.
  app/app-icon.png               the image Tauri's icon tool starts from.
  app/src-tauri/icons/installer-sidebar.bmp, installer-header.bmp
                                 the installer's Welcome and Finish pages (164x314) and the top of the pages between
                                 them (150x57): the logo and the name on the dark of the banner. NSIS takes 24-bit BMP.

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
DARK = (24, 24, 24)            # the banner's background
NAME, TRAIL = (460, 645, 1460, 745), (460, 645, 1460, 910)  # in the banner: the name, and the name with the audio under it


def lifted(banner: Image.Image, box: tuple, width: int) -> Image.Image:
    """A part of the banner this wide, as light on nothing: the banner's dark and the pattern on it fall away."""
    part = banner.crop(box).point(lambda v: min(255, max(0, (v - 50) * 255 // 180)))
    part = part.resize((width, round(part.height * width / part.width)), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", part.size, (235, 235, 235, 0))
    out.putalpha(part)
    return out


def installer():
    with Image.open(LOGO / "logo-fullres.png") as img:
        skull = img.convert("RGBA").crop(img.getbbox())
    with Image.open(LOGO / "banner.jpg") as img:
        banner = img.convert("L")

    def fit(height: int) -> Image.Image:
        return skull.resize((round(skull.width * height / skull.height), height), Image.Resampling.LANCZOS)

    def save(image: Image.Image, name: str):
        out = ROOT / "app" / "src-tauri" / "icons" / name
        image.convert("RGB").save(out, format="BMP")
        print(f"{out.relative_to(ROOT)}: {image.width}x{image.height}, {out.stat().st_size} bytes")

    side, logo, words = Image.new("RGBA", (164, 314), DARK), fit(118), lifted(banner, TRAIL, 142)
    top = (side.height - logo.height - 14 - words.height) // 2
    side.alpha_composite(logo, ((side.width - logo.width) // 2, top))
    side.alpha_composite(words, ((side.width - words.width) // 2, top + logo.height + 14))
    save(side, "installer-sidebar.bmp")

    head, logo, words = Image.new("RGBA", (150, 57), DARK), fit(41), lifted(banner, NAME, 86)
    head.alpha_composite(logo, (8, (head.height - logo.height) // 2))
    head.alpha_composite(words, (8 + logo.width + 6, (head.height - words.height) // 2))
    save(head, "installer-header.bmp")


def main():
    tile = LOGO / "icon-dark-fullres.png"
    with Image.open(tile) as img:
        assert img.width == img.height, f"{tile.name} isn't square"
        out = ROOT / "core" / "audiodiver" / "data" / "icon.png"
        img.convert("RGB").resize((SIZE, SIZE), Image.Resampling.LANCZOS).save(out, format="PNG", optimize=True)
        print(f"{out.relative_to(ROOT)}: {SIZE}x{SIZE}, {out.stat().st_size} bytes (from {tile.name}, {img.width}x{img.height})")
    shutil.copyfile(tile, ROOT / "app" / "app-icon.png")
    print("app/app-icon.png: a copy of", tile.name)
    installer()


if __name__ == "__main__":
    main()
