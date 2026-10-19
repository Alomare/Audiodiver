// What the app shows that is written, not coded: the Wiki's pages (src/wiki/*.md), the changelog (CHANGELOG.md) and
// the Home tab's background art (src/art/home.*). All of it is bundled at build time.
import type { Token, Tokens } from "marked";
import changelog from "../CHANGELOG.md?raw";
import { parse, type Doc } from "./Markdown";

export const APP_VERSION = __APP_VERSION__;
/** A version as people read it: "1.0.0-beta.1" is "Beta 1"; a release keeps its number ("v1.2.0"). */
export function versionLabel(version: string) {
  const m = /^\d+\.\d+\.\d+-(alpha|beta|rc)\.?(\d+)$/i.exec(version);
  if (!m) return `v${version}`;
  const stage = m[1].toLowerCase();
  return `${stage === "rc" ? "Release candidate" : stage[0].toUpperCase() + stage.slice(1)} ${m[2]}`;
}
export const APP_LABEL = versionLabel(APP_VERSION);
/** Where Audiodiver's source and releases are (also in the core's updates.py). */
export const REPO_URL = "https://github.com/Alomare/Audiodiver";
export const LICENCE = { name: "GNU General Public License v3.0 or later", url: "https://www.gnu.org/licenses/gpl-3.0.html" };
/** Where questions and feedback go: the Helldivers 2 modding community's Discord (Home's corner and About). */
export const DISCORD_URL = "https://discord.gg/helldiversmodding";

/** "2026-10-05" as "5 Oct 2026"; anything else as it is. */
export function fmtDate(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : iso;
}

// ---- Home art: every image in src/art, in file-name order ("wp (2)" before "wp (10)"). Home shows them one after
// the other; without any, it shows a wall of level meters.
export const HOME_ART = Object.entries(import.meta.glob("./art/*.{jpg,jpeg,png,webp,avif}",
  { query: "?url", import: "default", eager: true }) as Record<string, string>)
  .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })).map(([, url]) => url);
/** Where the art comes from: About ▸ Credits names it. */
export const ART_CREDIT = { name: "Arrowhead Game Studios", url: "https://www.arrowheadgamestudios.com", for: "a frame from the Helldivers 2 cinematic trailer" };

/** Everyone whose work Audiodiver builds on: About ▸ Credits (the ⓘ by the version and on Home), the one place the
    app names people and sources. Notes, tooltips, the Wiki and the core's data never do: they say what a thing is,
    not who found it. */
export type Credit = { name: string; by?: string; url?: string; licence?: string; for: string };
export const CREDITS: { group: string; items: Credit[] }[] = [
  { group: "Names and notes", items: [
    { name: "Helldivers 2 Archive Labeling", by: "the HD2 modding community", for: "names of sound sets, banks and archives, and voice-line transcripts" },
    { name: "Helldivers 2 Music Stuff", by: "the HD2 modding community", for: "names of music clips and the do-not-touch marks" },
    { name: "Music notes", by: "geoffreyhdt1", for: "Illuminate Void and Automaton clip names, when clips play, warnings and minimum lengths" },
    { name: "FileDiver", by: "xypwn", url: "https://github.com/xypwn/filediver", for: "the name lists behind the banks' path names" },
  ] },
  { group: "Code and research", items: [
    { name: "hd2-audio-modder", by: "RaidingForPants", url: "https://github.com/RaidingForPants/hd2-audio-modder", licence: "MIT",
      for: "reading the game's archives, and how HD2 keeps its sound banks" },
    { name: "wwise-teller", by: "Dekr0", url: "https://github.com/Dekr0/wwise-teller", licence: "MIT",
      for: "Wwise property ids, and the difference between Volume and Make-Up Gain" },
    { name: "wwiser", by: "bnnm", url: "https://github.com/bnnm/wwiser", for: "the reference for Wwise sound bank structures" },
  ] },
  { group: "Tools Audiodiver runs", items: [
    { name: "FFmpeg", url: "https://ffmpeg.org", for: "reading and converting audio files" },
    { name: "vgmstream", url: "https://github.com/vgmstream/vgmstream", for: "playing the game's audio" },
    { name: "wav2wem", by: "pas2k", url: "https://github.com/pas2k/wav2wem", licence: "GPL-2.0", for: "encoding audio for the game" },
  ] },
  { group: "Art and type", items: [
    { name: "Home art", by: ART_CREDIT.name, url: ART_CREDIT.url, for: ART_CREDIT.for },
    { name: "Archivo, Noto Serif and Roboto Mono", url: "https://openfontlicense.org", licence: "SIL Open Font License", for: "the typefaces" },
  ] },
];

// ---- the Wiki. A page is one Markdown file, listed in file-name order ("20-preparing-audio.md" before "30-…"). It starts
// with a few lines about itself:
//
//     ---
//     title: Preparing the audio
//     group: Making a mod          pages with the same group are listed together, groups in order of first use
//     summary: One or two sentences shown under the title and in search.
//     ---
export type WikiPage = Doc & { id: string; title: string; group: string; summary: string };

const sources = import.meta.glob("./wiki/*.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const pictures = import.meta.glob("./wiki/*.{png,jpg,jpeg,webp,gif}", { query: "?url", import: "default", eager: true }) as Record<string, string>;

function page(path: string, source: string): WikiPage {
  const name = path.split("/").pop()!.replace(/\.md$/, "");
  const head = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);
  const about: Record<string, string> = {};
  for (const line of head?.[1].split(/\r?\n/) ?? []) {
    const at = line.indexOf(":");
    if (at > 0) about[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return {
    ...parse(head ? source.slice(head[0].length) : source),
    id: name.replace(/^\d+-/, ""), title: about.title || name, group: about.group || "Guides", summary: about.summary || "",
  };
}

export const WIKI: WikiPage[] = Object.keys(sources).sort().map((path) => page(path, sources[path]));
/** The pages by group, groups in the order their first page comes. */
export const WIKI_GROUPS: { name: string; pages: WikiPage[] }[] = [];
for (const p of WIKI) {
  let g = WIKI_GROUPS.find((x) => x.name === p.group);
  if (!g) WIKI_GROUPS.push((g = { name: p.group, pages: [] }));
  g.pages.push(p);
}
/** The URL of a picture a page shows with ![alt](name.png). */
export const wikiPicture = (name: string) => pictures[`./wiki/${name.replace(/^\.\//, "")}`];

// ---- the changelog: "## 0.2.0 - 2026-10-05" starts a release, newest first
export type Release = { version: string; date: string; tokens: Token[] };

export const RELEASES: Release[] = [];
for (const t of parse(changelog).tokens) {
  if (t.type === "heading" && (t as Tokens.Heading).depth === 2) {
    const m = /^\[?v?([^\]\s]+)\]?(?:\s+[-–—]\s+(.+))?$/.exec((t as Tokens.Heading).text.trim());
    RELEASES.push({ version: m?.[1] ?? (t as Tokens.Heading).text, date: m?.[2] ?? "", tokens: [] });
  } else if (RELEASES.length) RELEASES[RELEASES.length - 1].tokens.push(t);
}
