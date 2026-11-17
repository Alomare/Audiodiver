import { useEffect, useRef } from "react";
import { useTheme } from "./theme";

/* Home's veil drawn once per picture, for WebKit (the window on Linux). styles.css's veil is four backdrop-filter blurs
   over the whole tab; WebKitGTK blurs them again on every frame anything on Home moves (the picture's zoom, the
   ticker, the picture timer): about 40% of a desktop GPU, and a stuttering window. Here the same four blurs, masks and
   shade go into one canvas over the picture, which zooms and fades with it, so a frame only moves finished pictures.
   The canvas also carries a little noise: WebKit draws the shade's long dark gradient in 8-bit steps, without the
   dithering Chromium adds, and the steps showed as bands. */

const BLURS: [px: number, stops: [at: number, alpha: number][]][] = [ // as .home-blur i:nth-child(n) in styles.css
  [2, [[0, 1], [1, 0]]],
  [6, [[0, 1], [0.4, 0.5], [0.9, 0]]],
  [14, [[0, 1], [0.35, 0.35], [0.75, 0]]],
  [28, [[0, 1], [0.3, 0.25], [0.6, 0]]],
];
const SHADE: [at: number, alpha: number][] = [[0, 0.94], [0.25, 0.78], [0.5, 0.5], [0.76, 0.18], [1, 0]]; // .home-shade
const RES = 0.5; // of the device's pixels: the veil is blurred or a smooth shade, so half the pixels look the same

/** A linear gradient as CSS's `to bottom right` lays it out over a w × h box: its 0% and 100% lines pass through the
    top-left and bottom-right corners, parallel to the other diagonal. */
function toBottomRight(ctx: CanvasRenderingContext2D, w: number, h: number, stops: [number, string][]) {
  const k = (w * h) / (w * w + h * h);
  const g = ctx.createLinearGradient(w / 2 - h * k, h / 2 - w * k, w / 2 + h * k, h / 2 + w * k);
  for (const [at, color] of stops) g.addColorStop(at, color);
  return g;
}

/** The colour of a CSS value (a variable of the theme), as rgb(), through an element that takes it. */
function resolved(el: HTMLElement, css: string): [number, number, number] {
  const probe = document.createElement("span");
  probe.style.color = css;
  el.appendChild(probe);
  const m = getComputedStyle(probe).color.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
  probe.remove();
  return [m[0], m[1], m[2]];
}

function bake(canvas: HTMLCanvasElement, img: HTMLImageElement, bg: [number, number, number]) {
  const box = canvas.getBoundingClientRect();
  const scale = (window.devicePixelRatio || 1) * RES;
  const w = Math.max(1, Math.round(box.width * scale)), h = Math.max(1, Math.round(box.height * scale));
  if (!img.naturalWidth || box.width < 1) return;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  // the picture as .home-art-img draws it: object-fit cover, object-position center 35%
  const cover = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const iw = img.naturalWidth * cover, ih = img.naturalHeight * cover;
  const ix = (w - iw) / 2, iy = (h - ih) * 0.35;
  const layer = document.createElement("canvas");
  layer.width = w;
  layer.height = h;
  const lc = layer.getContext("2d")!;
  for (const [px, stops] of BLURS) {
    const r = px * scale;
    lc.globalCompositeOperation = "source-over";
    lc.clearRect(0, 0, w, h);
    lc.filter = `blur(${r}px)`;
    // drawn 2r larger on every side, so the blur reads picture at the edges, as backdrop-filter does, not emptiness
    lc.drawImage(img, ix - 2 * r, iy - 2 * r, iw + 4 * r, ih + 4 * r);
    lc.filter = "none";
    lc.globalCompositeOperation = "destination-in";
    lc.fillStyle = toBottomRight(lc, w, h, stops.map(([at, a]) => [at, `rgba(0,0,0,${a})`]));
    lc.fillRect(0, 0, w, h);
    ctx.drawImage(layer, 0, 0);
  }
  const [r, g, b] = bg;
  ctx.fillStyle = toBottomRight(ctx, w, h, SHADE.map(([at, a]) => [at, `rgba(${r},${g},${b},${a})`]));
  ctx.fillRect(0, 0, w, h);
  // the noise: up to one step either way on every channel, which breaks the gradient's steps into grain too fine to see
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  for (let i = 0; i < px.length; i++) px[i] += Math.round(Math.random() + Math.random() - 1);
  ctx.putImageData(data, 0, 0);
}

/** The veil for one picture, drawn into a canvas over it once it has loaded, and again when the tab changes size or
    the theme changes its background. */
export function BakedVeil({ src }: { src: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const theme = useTheme();
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const img = new Image();
    img.src = src;
    let alive = true, timer = 0;
    const draw = () => { if (alive) bake(canvas, img, resolved(canvas.parentElement ?? document.body, "var(--bg)")); };
    img.decode().then(draw, draw);
    // a new size draws again once the resizing stops; meanwhile the last drawing stretches, which a blur hides
    const seen = new ResizeObserver(() => { clearTimeout(timer); timer = window.setTimeout(draw, 150); });
    seen.observe(canvas);
    return () => { alive = false; clearTimeout(timer); seen.disconnect(); };
  }, [src, theme]);
  return <canvas ref={ref} className="home-veil" />;
}
