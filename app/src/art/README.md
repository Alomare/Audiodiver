# Home tab art

Every image in this folder (`.jpg`, `.webp`, `.png`, `.avif`) is built into the app and shown behind the Home tab,
one after the other in file-name order. A picture stays for 20 seconds, grows by 2% while it shows and cross-fades
into the next. With animations off (Settings ▸ Theme, or the system's own setting) one picture stays still, and the
next launch shows the next one. Without any image, Home shows a wall of level meters instead.

- **Size:** 16:9, up to 2560 × 1440. 1920 × 1080 and 1600 × 900 work; larger only makes the app bigger.
- **Format:** JPG at quality 80–85, or WebP. sRGB. Aim for under 1 MB each.
- **Composition:** a picture fills the whole tab and is cropped to the window's shape (about 16:9 at the default
  size, wider on big screens); it is never stretched. The left ~40% sits under the welcome text and is darkened; the
  lower half sits behind the Recent projects panel. Keep the subject in the middle or on the right, in the upper two
  thirds.
- **Theme:** the darkening follows the theme (darker in dark mode, lighter in light mode), so pick art that still
  reads when its left side is dimmed.
- **Credit:** `ART_CREDIT` in `src/content.ts` says where the art comes from; About ▸ Credits lists it. Home itself
  shows no credit: its bottom right corner holds the picture controls (with more than one picture) and the Discord
  button.

The picture here (`cinematic-trailer.jpg`) is a frame from the Helldivers 2 cinematic trailer, by Arrowhead Game
Studios. It is theirs, not under Audiodiver's licence. A credit is not a licence: only add art you are allowed to
share.
