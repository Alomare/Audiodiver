import { useSyncExternalStore } from "react";

/** The look (Settings ▸ Theme): dark or light, the primary colour that fills the main buttons and marks what is replaced
    (Super Earth yellow by default), the secondary colour that navigates and informs (Super Earth blue), Night mode,
    the typefaces, the text size, spacing, contrast and animations.
    Kept per user in localStorage; applied as data-theme, data-density, data-contrast, data-motion and data-night on
    <html> and as custom properties. */
export type ThemeMode = "dark" | "light";
export type Density = "compact" | "balanced" | "relaxed";
export type FontId = "archivo" | "noto-serif" | "roboto-mono";
export type Theme = {
  mode: ThemeMode;
  hue: number;              // the primary colour's hue
  hue2: number;             // the secondary colour's hue
  size: number;
  bodyFont: FontId;         // everything that isn't a title
  titleFont: FontId;        // page and panel titles (h1 to h3) and the app's name
  density: Density;         // how much room rows and panels get
  contrast: boolean | null; // high contrast on or off; null follows the system ("Contrast themes" in Windows)
  motion: boolean | null;   // animations on or off; null follows the system ("Animation effects" in Windows settings)
  speed: number;            // animation speed, × normal
  night: boolean;           // Night mode: every colour on screen warmer, as a night light makes it
  warmth: number;           // how warm Night mode makes them, from WARMTH[0] to 1
};

/** The OKLCH hue of Super Earth yellow (#ffe135), the default primary colour. */
export const YELLOW_HUE = 99;
/** The OKLCH hue of the default secondary colour: Super Earth blue. */
export const BLUE_HUE = 250;
/** Night mode's warmth: the slider's range and where it starts. */
export const WARMTH = [0.15, 1] as const;
export const DEFAULT_WARMTH = 0.5;
/** Body text sizes in px that the slider snaps to; everything else scales with it. */
export const TEXT_SIZES = [13, 14, 15, 16, 17, 18, 20, 22];
export const DEFAULT_SIZE = 15;
/** Animation speeds the slider snaps to. */
export const SPEEDS = [0.5, 0.75, 1, 1.5, 2];
/** Spacing presets: the factor every padding and gap that sets density is scaled by (--sp in styles.css). */
export const DENSITIES: [Density, string, number][] = [["compact", "Compact", 0.55], ["balanced", "Balanced", 1], ["relaxed", "Relaxed", 1.6]];
/** The typefaces on offer, for text and for titles. All three are free to ship (SIL Open Font License 1.1) and are
    built into the app (main.tsx loads them), so nothing comes from the web. Each has the four weights the app uses:
    300, 400, 500 and 700. */
export const FONTS: { id: FontId; name: string; stack: string; about: string }[] = [
  { id: "archivo", name: "Archivo", stack: '"Archivo Variable", "Segoe UI", system-ui, sans-serif', about: "A sturdy sans serif. The default." },
  { id: "noto-serif", name: "Noto Serif", stack: '"Noto Serif Variable", Georgia, "Times New Roman", serif', about: "A serif, for a bookish look." },
  { id: "roboto-mono", name: "Roboto Mono", stack: '"Roboto Mono Variable", Consolas, "Cascadia Mono", monospace', about: "Monospaced: every character equally wide." },
];
export const fontStack = (id: FontId) => (FONTS.find((f) => f.id === id) ?? FONTS[0]).stack;
export const DEFAULT_THEME: Theme = { mode: "dark", hue: YELLOW_HUE, hue2: BLUE_HUE, size: DEFAULT_SIZE, bodyFont: "archivo", titleFont: "archivo",
  density: "balanced", contrast: null, motion: null, speed: 1, night: false, warmth: DEFAULT_WARMTH };
const KEY = "audiodiver.theme";

// ---- colour maths: OKLCH -> sRGB, so every hue gets the same perceived brightness

function oklchToLinear(L: number, C: number, h: number): [number, number, number] {
  const a = C * Math.cos((h * Math.PI) / 180), b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}
const inGamut = (L: number, C: number, h: number) => oklchToLinear(L, C, h).every((v) => v >= -1e-4 && v <= 1 + 1e-4);

/** The most saturated chroma sRGB can show at this lightness and hue. */
function maxChroma(L: number, h: number) {
  let lo = 0, hi = 0.4;
  for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; if (inGamut(L, mid, h)) lo = mid; else hi = mid; }
  return lo;
}
/** The lightness where this hue is most colourful (yellow is light, blue is dark). */
function cuspLightness(h: number) {
  let best = 0.5, bestC = 0;
  for (let L = 0.3; L < 0.99; L += 0.01) { const c = maxChroma(L, h); if (c > bestC) { bestC = c; best = L; } }
  return best;
}
function hex(L: number, C: number, h: number) {
  const enc = (x: number) => {
    x = Math.max(0, Math.min(1, x));
    return Math.round((x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055) * 255).toString(16).padStart(2, "0");
  };
  C = Math.min(C, maxChroma(L, h));
  return "#" + oklchToLinear(L, C, h).map(enc).join("");
}

export type Accent = { accent: string; fg: string; dim: string; hover: string; ink: string };
export type Second = { fg: string; dim: string };

/** The secondary colours for a hue: what navigates and informs (links, the open tab, the selection, focus), where
    the primary colour marks what is replaced. `fg` is for text and lines on the page background, so it is light on the
    dark theme and dark on the light one; `dim` is for quieter lines and fills. */
export function secondFor(mode: ThemeMode, hue: number, high = false): Second {
  const h = ((hue % 360) + 360) % 360;
  return mode === "dark" ? { fg: hex(high ? 0.86 : 0.78, 0.13, h), dim: hex(high ? 0.62 : 0.5, 0.1, h) }
    : { fg: hex(high ? 0.4 : 0.5, 0.16, h), dim: hex(high ? 0.62 : 0.78, 0.08, h) };
}

/** The primary colours for a hue. `accent` is a bright fill with dark `ink` text on it; `fg` is for text and lines on
    the page background. On the light theme the primary colour only fills: a light page needs a dark cut for text and
    lines, which many hues don't have (a dark yellow reads as olive or orange), so they take the secondary colour
    (`second`, a hue). */
export function accentFor(mode: ThemeMode, hue: number, high = false, second = BLUE_HUE): Accent {
  const h = ((hue % 360) + 360) % 360;
  if (mode === "dark" && Math.round(h) === YELLOW_HUE) {
    return { accent: "#ffe135", fg: "#ffe135", dim: high ? "#dcc431" : "#b9a52c", hover: "#fff07a", ink: "#191606" };
  }
  // Fill: as light as the hue allows while dark text on it stays readable (blue can't be both light and vivid).
  const L = Math.min(Math.max(cuspLightness(h), 0.74), 0.91);
  const C = Math.min(maxChroma(L, h), 0.18);
  const accent = hex(L, C, h), hover = hex(Math.min(L + 0.035, 0.97), C * 0.8, h), ink = hex(0.2, 0.03, h);
  // high contrast: dim marks stay closer to the full colour
  if (mode === "dark") return { accent, fg: accent, dim: hex(L * (high ? 0.9 : 0.79), C * (high ? 0.9 : 0.77), h), hover, ink };
  return { accent, ...secondFor(mode, second, high), hover, ink };
}

/** Night mode's tint at a warmth from 0 to 1: what every colour on screen is multiplied by, from white towards
    candlelight (about 6500 K to 2700 K), as a night light does. */
export function nightTint(warmth: number) {
  const w = Math.max(0, Math.min(1, warmth));
  return `rgb(255 ${Math.round(255 - 86 * w)} ${Math.round(255 - 168 * w)})`;
}

// ---- store

function load(): Theme {
  try {
    const t = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (t && (t.mode === "dark" || t.mode === "light") && Number.isFinite(t.hue)) {
      const font = (id: unknown): FontId => (FONTS.some((f) => f.id === id) ? (id as FontId) : "archivo");
      return { mode: t.mode, hue: t.hue, hue2: Number.isFinite(t.hue2) ? t.hue2 : BLUE_HUE, size: TEXT_SIZES.includes(t.size) ? t.size : DEFAULT_SIZE,
        bodyFont: font(t.bodyFont), titleFont: font(t.titleFont),
        density: DENSITIES.some(([d]) => d === t.density) ? t.density : "balanced",
        contrast: typeof t.contrast === "boolean" ? t.contrast : null,
        motion: typeof t.motion === "boolean" ? t.motion : null, speed: SPEEDS.includes(t.speed) ? t.speed : 1,
        night: t.night === true, warmth: Number.isFinite(t.warmth) ? Math.min(WARMTH[1], Math.max(WARMTH[0], t.warmth)) : DEFAULT_WARMTH };
    }
  } catch { /* storage off or bad value */ }
  return DEFAULT_THEME;
}

let current = load();
const listeners = new Set<() => void>();

// Windows' "Animation effects" switch, and "Adjust for best performance", reach the webview as reduced motion;
// its contrast themes as more contrast
const reduced = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
const more = typeof matchMedia === "function" ? matchMedia("(prefers-contrast: more)") : null;
/** Whether the system asks apps for more contrast. */
export const systemWantsContrast = () => !!more?.matches;
/** Whether high contrast is on: the user's choice, else the system's. */
export const contrastOn = (t: Theme = current) => t.contrast ?? systemWantsContrast();
/** Whether the system asks apps for less motion. */
export const systemReducesMotion = () => !!reduced?.matches;
/** Whether animations play: the user's choice, else the system's. */
export const motionOn = (t: Theme = current) => t.motion ?? !systemReducesMotion();
/** "smooth" when animations play, for scrollIntoView and scrollTo. */
export const scrollBehavior = (): ScrollBehavior => (motionOn() ? "smooth" : "auto");
/** How long an animation of `ms` (at normal speed) takes now: scaled by the speed setting, 0 when animations are off.
    For timers that wait for an animation; keep in step with the --t1/--t2/--t3 times in styles.css. */
export const motionMs = (ms: number) => (motionOn() ? ms / current.speed : 0);

function apply(t: Theme) {
  const root = document.documentElement;
  root.dataset.theme = t.mode;
  root.style.setProperty("--fs", String(t.size / DEFAULT_SIZE));
  root.style.setProperty("--body", fontStack(t.bodyFont));
  root.style.setProperty("--title", fontStack(t.titleFont));
  const high = contrastOn(t);
  root.dataset.contrast = high ? "high" : "normal";
  root.dataset.density = t.density;
  root.style.setProperty("--sp", String(DENSITIES.find(([d]) => d === t.density)?.[2] ?? 1));
  const a = accentFor(t.mode, t.hue, high, t.hue2);
  root.style.setProperty("--accent", a.accent);
  root.style.setProperty("--accent-fg", a.fg);
  root.style.setProperty("--accent-dim", a.dim);
  root.style.setProperty("--accent-hover", a.hover);
  root.style.setProperty("--accent-ink", a.ink);
  const s = secondFor(t.mode, t.hue2, high);
  root.style.setProperty("--second-fg", s.fg);
  root.style.setProperty("--second-dim", s.dim);
  const on = motionOn(t);
  root.dataset.motion = on ? "on" : "off";
  root.style.setProperty("--anim", on ? String(1 / t.speed) : "0"); // every animation time in styles.css scales by it
  // Night mode: a tint over the whole window that every colour is multiplied by (the .night layer in App.tsx)
  root.dataset.night = t.night ? "on" : "off";
  root.style.setProperty("--night", nightTint(t.warmth));
}
// the system changed its mind: apply it, and tell Settings ▸ Theme
const systemChanged = () => { apply(current); current = { ...current }; listeners.forEach((f) => f()); };
reduced?.addEventListener("change", systemChanged);
more?.addEventListener("change", systemChanged);

export const theme = {
  get: () => current,
  /** Applies a change straight away and remembers it. */
  set(patch: Partial<Theme>) {
    current = { ...current, ...patch };
    apply(current);
    try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* storage off */ }
    listeners.forEach((f) => f());
  },
  reset() { theme.set(DEFAULT_THEME); },
  subscribe(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; },
  /** Call once before the first render, so the app never flashes the wrong theme. */
  init() { apply(current); },
};

export const useTheme = () => useSyncExternalStore(theme.subscribe, theme.get);
