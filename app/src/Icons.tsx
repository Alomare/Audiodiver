// Line icons, drawn in the current text colour. Sized in em, so they follow the text size setting.
import type { ReactNode } from "react";

function Icon({ children, size = 1.25, stroke = 1.8 }: { children: ReactNode; size?: number; stroke?: number }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" width={`${size}em`} height={`${size}em`} fill="none" stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">{children}</svg>
  );
}

/** A cog with flat, angular teeth. */
const GEAR = (() => {
  const teeth = 8, outer = 9.6, inner = 7.1, pt = (r: number, deg: number) => {
    const a = (deg * Math.PI) / 180;
    return `${(12 + r * Math.cos(a)).toFixed(2)} ${(12 + r * Math.sin(a)).toFixed(2)}`;
  };
  const step = 360 / teeth;
  let d = "";
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    d += `${i ? "L" : "M"}${pt(inner, a - 14)}L${pt(outer, a - 8)}L${pt(outer, a + 8)}L${pt(inner, a + 14)}`;
  }
  return `${d}Z`;
})();

export const GearIcon = () => <Icon><path d={GEAR} /><circle cx="12" cy="12" r="2.9" /></Icon>;

/** An open book: the guides. */
export const GuideIcon = () => (
  <Icon>
    <path d="M12 6.6C10.1 5.2 7.5 4.6 3.6 4.8v13.3c3.9-.2 6.5.4 8.4 1.8 1.9-1.4 4.5-2 8.4-1.8V4.8c-3.9-.2-6.5.4-8.4 1.8z" />
    <path d="M12 6.6v13.3" />
    <path d="M6.4 8.9c1.2 0 2.2.2 3.1.5M6.4 12.2c1.2 0 2.2.2 3.1.5M17.6 8.9c-1.2 0-2.2.2-3.1.5M17.6 12.2c-1.2 0-2.2.2-3.1.5" strokeWidth={1.3} />
  </Icon>
);

export const UndoIcon = () => <Icon><path d="M9 6 4 11l5 5" /><path d="M4 11h10.5a4.75 4.75 0 0 1 0 9.5H10" /></Icon>;

// The quick notes' icons (App.tsx, QuickNote): what just happened, at a glance.
export const CheckIcon = () => <Icon size={1.1} stroke={2.2}><path d="m5 12.5 4.5 4.5L19 7.5" /></Icon>;
export const PlusIcon = () => <Icon size={1.1} stroke={2.2}><path d="M12 5v14M5 12h14" /></Icon>;
/** A disk with its label and shutter. */
export const SaveIcon = () => (
  <Icon size={1.1}><path d="M5 4h11.5L20 7.5V20H4V4z" /><path d="M8 4v5h7V4M7.5 20v-6h9v6" /></Icon>
);
export const CopyIcon = () => <Icon size={1.1}><rect x="8.5" y="8.5" width="11" height="11" rx="1" /><path d="M15.5 8.5v-4h-11v11h4" /></Icon>;
export const InfoIcon = () => <Icon size={1.1}><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5M12 7.6v.1" strokeWidth={2.4} /></Icon>;
/** A folder: show a file in its folder. */
/** A page with a folded corner and lines of writing: a note. */
export const NoteIcon = () => <Icon size={1}><path d="M5.5 3.5h9l4 4v13h-13z" /><path d="M14.5 3.5v4h4M8.5 12h7M8.5 15.5h7M8.5 8.5h3" /></Icon>;
export const FolderIcon = () => <Icon size={1}><path d="M3.5 6.5h6l2 2h9v10h-17z" /></Icon>;
/** Zoom in and out (a magnifier with + or −), and fit the whole width. */
export const ZoomInIcon = () => <Icon size={1}><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 5 5M8 10.5h5M10.5 8v5" /></Icon>;
export const ZoomOutIcon = () => <Icon size={1}><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 5 5M8 10.5h5" /></Icon>;
export const FitIcon = () => <Icon size={1}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></Icon>;
export const RedoIcon = () => <Icon><path d="m15 6 5 5-5 5" /><path d="M20 11H9.5a4.75 4.75 0 0 0 0 9.5H14" /></Icon>;

// The toolbar above the slots (CueView): one icon per tool.

/** A file with an arrow going into it: files into the slots. */
export const FillIcon = () => (
  <Icon><path d="M14 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8z" /><path d="M14 3.5V8h4.5M12 10.5v6.5M9 14l3 3 3-3" /></Icon>
);
/** Two files with the arrow: every part of the piece. */
export const FillPieceIcon = () => (
  <Icon>
    <path d="M8.5 6V5A1.5 1.5 0 0 1 10 3.5h6l4 4v10a1.5 1.5 0 0 1-1.5 1.5H17" />
    <path d="M13.5 7H5.5A1.5 1.5 0 0 0 4 8.5v11A1.5 1.5 0 0 0 5.5 21h9a1.5 1.5 0 0 0 1.5-1.5v-10z" />
    <path d="M10 12v5.5M7.5 15.25 10 17.75l2.5-2.5" />
  </Icon>
);
/** Scissors: cut a song into pieces. */
export const SliceIcon = () => (
  <Icon><circle cx="6.5" cy="7" r="2.5" /><circle cx="6.5" cy="17" r="2.5" /><path d="M8.6 8.4 19.5 17.5M8.6 15.6 19.5 6.5" /></Icon>
);
/** An arrow out of a tray: audio files saved out. */
export const ExportIcon = () => (
  <Icon><path d="M12 14.5V3.8" /><path d="m7.6 8.2 4.4-4.4 4.4 4.4" /><path d="M4.5 13.5v6h15v-6" /></Icon>
);
/** Skip forward: a short silence instead, so the next music comes at once. */
export const SkipIcon = () => <Icon><path d="M6 6.5v11l8.5-5.5z" /><path d="M18 6.5v11" /></Icon>;
/** A speaker with a cross: silence in place of the original. */
export const SilenceIcon = () => <Icon><path d="M4.5 9.5h3l4.5-4v13l-4.5-4h-3z" /><path d="m16 9.5 5 5m0-5-5 5" /></Icon>;
/** Skip forward twice: every part at once. */
export const SkipAllIcon = () => <Icon><path d="M3.5 6.5v11l6.5-5.5zM11 6.5v11l6.5-5.5z" /><path d="M20.5 6.5v11" /></Icon>;
/** An eraser: the new audio taken off. */
export const ClearIcon = () => (
  <Icon><path d="M13.9 4.6 19.4 10a1.5 1.5 0 0 1 0 2.1L12.5 19H7.6l-3-3a1.5 1.5 0 0 1 0-2.1l7.2-7.3a1.5 1.5 0 0 1 2.1 0z" /><path d="m8.6 9.9 5.5 5.5M12.5 19h7" /></Icon>
);
/** The letters ID in a box: sounds named by container ID. */
export const IdIcon = () => (
  <Icon size={1.1}><rect x="2.5" y="5.5" width="19" height="13" rx="2" /><path d="M7.5 9v6M11 9h2.25a3 3 0 0 1 0 6H11z" strokeWidth={2} /></Icon>
);
/** An arrow turning back: a value back to where it started. */
export const ResetIcon = () => <Icon size={1}><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" /><path d="M4.5 4v4.5H9" /></Icon>;
/** A magnifier: a search box. */
export const SearchIcon = () => <Icon size={1}><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 5 5" /></Icon>;
/** A play sign before three bars: the segments played one after another. */
export const ThroughIcon = () => <Icon size={1}><path d="M4 6.5v11l7.5-5.5z" /><path d="M14.5 8.5v7M18 8.5v7M21.5 8.5v7" /></Icon>;
export const PauseIcon = () => <Icon size={1}><path d="M8.5 6v12M15.5 6v12" /></Icon>;

/** A cross: close (the project, on Home). */
export const CloseIcon = () => <Icon size={1}><path d="m6.5 6.5 11 11M17.5 6.5l-11 11" /></Icon>;

/** Marks a link that opens in the web browser. */
export const ExternalIcon = () => <Icon size={0.85}><path d="M10 5H5v14h14v-5" /><path d="M14 4h6v6M20 4l-9 9" /></Icon>;

export const PrevIcon = () => <Icon size={0.95}><path d="m14.5 6-6 6 6 6" /></Icon>;
export const NextIcon = () => <Icon size={0.95}><path d="m9.5 6 6 6-6 6" /></Icon>;
export const UpIcon = () => <Icon size={0.95}><path d="m6 14.5 6-6 6 6" /></Icon>;
export const DownIcon = () => <Icon size={0.95}><path d="m6 9.5 6 6 6-6" /></Icon>;

/** Discord's logo, filled and unchanged (their brand rules): it marks the button to the modding community's server. */
export const DiscordIcon = () => (
  <svg className="icon discord-logo" viewBox="0 0 24 24" width="1.2em" height="1.2em" fill="currentColor" aria-hidden focusable="false">
    <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.058a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .078-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.363 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);

/** Ko-fi's cup with the heart (Simple Icons, CC0). Keeps Ko-fi's own colour, as Discord's logo does. */
export const KofiIcon = () => (
  <svg className="icon kofi-logo" viewBox="0 0 24 24" width="1.2em" height="1.2em" fill="currentColor" aria-hidden focusable="false">
    <path d="M11.351 2.715c-2.7 0-4.986.025-6.83.26C2.078 3.285 0 5.154 0 8.61c0 3.506.182 6.13 1.585 8.493 1.584 2.701 4.233 4.182 7.662 4.182h.83c4.209 0 6.494-2.234 7.637-4a9.5 9.5 0 0 0 1.091-2.338C21.792 14.688 24 12.22 24 9.208v-.415c0-3.247-2.13-5.507-5.792-5.87-1.558-.156-2.65-.208-6.857-.208m0 1.947c4.208 0 5.09.052 6.571.182 2.624.311 4.13 1.584 4.13 4v.39c0 2.156-1.792 3.844-3.87 3.844h-.935l-.156.649c-.208 1.013-.597 1.818-1.039 2.546-.909 1.428-2.545 3.064-5.922 3.064h-.805c-2.571 0-4.831-.883-6.078-3.195-1.09-2-1.298-4.155-1.298-7.506 0-2.181.857-3.402 3.012-3.714 1.533-.233 3.559-.26 6.39-.26m6.547 2.287c-.416 0-.65.234-.65.546v2.935c0 .311.234.545.65.545 1.324 0 2.051-.754 2.051-2s-.727-2.026-2.052-2.026m-10.39.182c-1.818 0-3.013 1.48-3.013 3.142 0 1.533.858 2.857 1.949 3.897.727.701 1.87 1.429 2.649 1.896a1.47 1.47 0 0 0 1.507 0c.78-.467 1.922-1.195 2.623-1.896 1.117-1.039 1.974-2.364 1.974-3.897 0-1.662-1.247-3.142-3.039-3.142-1.065 0-1.792.545-2.338 1.298-.493-.753-1.246-1.298-2.312-1.298" />
  </svg>
);

/** Two links of a chain: tied to something else. Drawn heavier, as it sits inside small tags. */
export const LinkIcon = () => (
  <Icon size={1.05} stroke={2.4}><path d="m9.5 14.5 5-5M11 6.6l1.4-1.4a3.9 3.9 0 0 1 5.5 5.5l-1.4 1.4M13 17.4l-1.4 1.4a3.9 3.9 0 0 1-5.5-5.5l1.4-1.4" /></Icon>
);

/** Two arrows passing each other: music that plays into and out of this music (transitions, stingers). */
export const TransitionIcon = () => (
  <Icon size={1.05} stroke={2}><path d="M4 8.5h13.5M14 5l3.5 3.5L14 12M20 15.5H6.5M10 12l-3.5 3.5L10 19" /></Icon>
);
/** Steps down a list in another order: the order the game plays the slots in. */
export const OrderIcon = () => (
  <Icon size={1.05} stroke={2}><path d="M4 6h7M4 12h4M4 18h7" /><path d="M14 5.5c4.5 0 4.5 6.5 0 6.5s-4.5 6.5 0 6.5" /><path d="m12 16.5 2 2-2 2" /></Icon>
);

// How a group of the Soundtrack's play order picks what plays (Soundtrack.tsx, PlayOrder), and a group that repeats.
/** In order: steps along a line. */
export const InOrderIcon = () => <Icon size={1} stroke={2}><path d="M3.5 12h15M14.5 7.5 19 12l-4.5 4.5" /><path d="M6 9.5v5M10 9.5v5" /></Icon>;
/** The next each time: an arrow coming round. */
export const NextEachIcon = () => <Icon size={1} stroke={2}><path d="M19 12a7 7 0 1 1-2.05-4.95" /><path d="M17.5 3.5v4h-4" /></Icon>;
/** Shuffled: two crossing arrows. */
export const ShuffleIcon = () => (
  <Icon size={1} stroke={2}><path d="M3.5 7.5h3.5l9 9h3.5M3.5 16.5h3.5l2.5-2.5M14 10l2-2.5h3.5" /><path d="m17.5 5 2 2.5-2 2.5M17.5 14l2 2.5-2 2.5" /></Icon>
);
/** One at random: a die. */
export const RandomIcon = () => (
  <Icon size={1} stroke={2}><rect x="4.5" y="4.5" width="15" height="15" rx="3" /><path d="M9 9h.01M15 9h.01M12 12h.01M9 15h.01M15 15h.01" strokeWidth={3} /></Icon>
);
/** Plays again: two arrows chasing each other. */
export const RepeatIcon = () => (
  <Icon size={0.95} stroke={2}><path d="M4.5 11V9.5a3 3 0 0 1 3-3h11M15.5 3.5l3 3-3 3M19.5 13v1.5a3 3 0 0 1-3 3h-11M8.5 20.5l-3-3 3-3" /></Icon>
);

/** Fold everything: a box with a minus, another box behind it (as code editors draw it). */
export const CollapseAllIcon = () => (
  <Icon size={1.05}><rect x="3.5" y="8.5" width="12" height="12" rx="1" /><path d="M7 14.5h5M7.5 8.5v-4h12v12h-4" /></Icon>
);

// The master tabs, in the tab bar: an icon each.

/** Home: a house. */
export const HomeIcon = () => (
  <Icon><path d="M3.5 11.2 12 4l8.5 7.2" /><path d="M5.8 9.4V20h12.4V9.4" /><path d="M10 20v-5.4h4V20" /></Icon>
);

/** The Project tab: a folder with level bars in it. */
export const ProjectIcon = () => (
  <Icon><path d="M3.5 6h6.2l2 2.2h8.8V19.5h-17z" /><path d="M8.5 12.6v3.4M11 11.2v6.2M13.5 13v2.6M16 12v4.4" strokeWidth={1.4} /></Icon>
);

/** The Library: books on a shelf, the last one leaning. */
export const LibraryIcon = () => (
  <Icon>
    <rect x="3.8" y="4.5" width="4" height="15.5" rx=".7" />
    <rect x="8.9" y="6.8" width="4" height="13.2" rx=".7" />
    <path d="M14.96 18.9 18.41 6.89l3.84 1.1L18.8 20z" />
    <path d="M3.8 8.3h4M8.9 10.4h4" strokeWidth={1.3} />
  </Icon>
);

/** The Audio tab: a waveform. */
export const AudioIcon = () => <Icon><path d="M4 10v4M7.2 7v10M10.4 4v16M13.6 8v8M16.8 5.5v13M20 9.5v5" /></Icon>;

/** The Soundtrack: lines of a playlist beside a note. */
export const SoundtrackIcon = () => (
  <Icon><path d="M3.5 6.5h9M3.5 11h9M3.5 15.5h5.5" /><path d="M18 17V4.5c1 1.6 2.4 2.4 3.5 2.6" /><ellipse cx="15.6" cy="17.2" rx="2.4" ry="2" /></Icon>
);

/** The header above the slots, or the waveforms below them: a window with its top or bottom band, filled while it
    shows. */
export const HeaderIcon = ({ on }: { on: boolean }) => (
  <Icon size={1.05}><rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />{on && <rect x="3.5" y="4.5" width="17" height="5" rx="1.5" fill="currentColor" stroke="none" opacity={0.55} />}<path d="M3.5 9.5h17" /></Icon>
);
export const WavesIcon = ({ on }: { on: boolean }) => (
  <Icon size={1.05}><rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />{on && <rect x="3.5" y="13.5" width="17" height="6" rx="1.5" fill="currentColor" stroke="none" opacity={0.55} />}<path d="M3.5 13.5h17" /></Icon>
);

/** The Text tab: a letter T beside lines of text. */
export const TextIcon = () => <Icon><path d="M3.5 5.5H14M8.75 5.5V19M16.5 11h4M16.5 15h4M16.5 19h4" /></Icon>;

/** Updates: an arrow coming down into a tray. */
export const UpdatesIcon = () => (
  <Icon><path d="M12 3.8v10.6" /><path d="m7.6 10 4.4 4.4 4.4-4.4" /><path d="M4.5 14.8v4.7h15v-4.7" /></Icon>
);

/** Build: a parcel with its tape, the mod packed for a mod manager. */
export const BuildIcon = () => (
  <Icon><path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z" /><path d="M4 7.5 12 12l8-4.5M12 12v9" /><path d="M8 5.25 16 9.75" strokeWidth={1.5} /></Icon>
);

/** Tools: an open-ended wrench. */
export const ToolsIcon = () => (
  <Icon><path d="M20.06 6.91A4.2 4.2 0 0 1 14.19 11.79L6.19 19.79A1.4 1.4 0 0 1 4.21 17.81L12.21 9.81A4.2 4.2 0 0 1 17.09 3.94L15.53 5.5 18.5 8.47Z" /></Icon>
);
