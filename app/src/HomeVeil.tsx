import { useEffect, useRef } from "react";
import { useTheme } from "./theme";

/* Home's shade drawn into a canvas, for WebKit (the window on Linux). WebKitGTK draws styles.css's .home-shade, a long
   dark gradient, in 8-bit steps without the dithering Chromium adds, and the steps showed as bands. The canvas draws
   the same gradient with a little noise in it, once, and again only when the tab changes size or the theme its
   background. */

const SHADE: [at: number, alpha: number][] = [[0, 0.94], [0.25, 0.78], [0.5, 0.5], [0.76, 0.18], [1, 0]]; // .home-shade

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

function draw(canvas: HTMLCanvasElement, bg: [number, number, number]) {
  const box = canvas.getBoundingClientRect();
  if (box.width < 1) return;
  const scale = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(box.width * scale)), h = Math.max(1, Math.round(box.height * scale));
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const [r, g, b] = bg;
  ctx.fillStyle = toBottomRight(ctx, w, h, SHADE.map(([at, a]) => [at, `rgba(${r},${g},${b},${a})`]));
  ctx.fillRect(0, 0, w, h);
  // the noise: up to one step either way on every channel, which breaks the gradient's steps into grain too fine to see
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  for (let i = 0; i < px.length; i++) px[i] += Math.round(Math.random() + Math.random() - 1);
  ctx.putImageData(data, 0, 0);
}

/** The shade over Home's pictures, dithered. */
export function DitheredShade() {
  const ref = useRef<HTMLCanvasElement>(null);
  const theme = useTheme();
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let timer = 0;
    const redraw = () => draw(canvas, resolved(canvas.parentElement ?? document.body, "var(--bg)"));
    redraw();
    // a new size draws again once the resizing stops; meanwhile the last drawing stretches, which a shade hides
    const seen = new ResizeObserver(() => { clearTimeout(timer); timer = window.setTimeout(redraw, 150); });
    seen.observe(canvas);
    return () => { clearTimeout(timer); seen.disconnect(); };
  }, [theme]);
  return <canvas ref={ref} className="home-veil" />;
}
