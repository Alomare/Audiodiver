# Home tab art

Every image in this folder (`.jpg`, `.webp`, `.png`, `.avif`) is built into the app and shown behind the Home tab,
one after the other in file-name order. A picture stays for 20 seconds, grows by 2% while it shows and cross-fades
into the next. With animations off (Settings ▸ Theme, or the system's own setting) one picture stays still, and the
next launch shows the next one. Without any image, Home shows a wall of level meters instead.

- **Size:** at most the width of a big screen (the pictures here are 3440 × 1440). A wider picture than the window is
  cropped at its sides, a taller one at its top and bottom; it is never stretched.
- **Format:** WebP at quality 85, sRGB. The three here are 110 to 210 KB each.
- **Helldivers 1:** the images in `hd1/` show in the same way while Home is in Helldivers 1 mode.
- **Composition:** a blur and a shade start from nothing at the top right and grow to the bottom left, under the menu.
  Keep the subject towards the top right.
- **Theme:** the shade follows the theme (darker in dark mode, lighter in light mode).
- **Credit:** `ART_CREDIT` in `src/content.ts` says where the art comes from; About ▸ Credits lists it. Home itself
  shows no credit, because its bottom right corner holds the picture controls (when there is more than one picture)
  and the Discord button.

The pictures here (`home-1.webp` to `home-3.webp`) are screenshots of Helldivers 2 taken by Alomare. The originals
are in `internal/art/`. The pictures in `hd1/` come from Helldivers 1's art and videos (originals in `internal/art/hd1/`).
The games in them belong to Arrowhead Game Studios and aren't covered by Audiodiver's licence.
