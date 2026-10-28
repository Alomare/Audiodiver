// Client for the Audiodiver core (python -m audiodiver serve). In the desktop app the shell starts the core and hands
// over its port and token; in a plain browser (development) they come from ?port=&token= (default 8765 / dev).
// It imports none of the app's modules: it connects while it loads (below), so it must never wait on one that
// imports it back (platform.ts does).
import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";

/** In the desktop app, rather than a plain browser. platform.ts passes it on to the rest of the app. */
export const isTauri = () => "__TAURI_INTERNALS__" in window;

export type Entry = {
  id: string; kind: string; path: string[]; name: string; detail: string; notes: string; locked: boolean;
  curated: boolean; segments: number; slots: string[]; duration_ms: number; archives: number; contexts: number;
};
/** What the Index knows about something: the piece of music or sound set it is (`item`), or just a category.
    Drawn in the category's colour. */
export type Tag = { name: string; category: string; item?: string };
export type Slot = {
  source: string; duration_ms: number; unused: boolean; variant: string; label: string; locked: boolean;
  absent?: boolean; // the game's data names it, but no file of this install has its audio: nothing to play or replace
  also_in: string[]; // the other cues and banks ("bank:<id>") that play it; for a bank's sounds only the first few
  also_n?: number;   // how many there are in all, when also_in was cut short
  banks?: number;    // how many of them are banks
  stream?: string;   // the file id of the stream that holds its audio (64-bit), "" when it is only inside banks
  object?: string;   // a bank's sound: the Sound object that plays it
  notes?: ClipNote[]; // what the clip notes say about this clip (core data/notes.json)
  min_ms?: number;   // the shortest replacement that works here, as the notes found it
  // the Audio tab's view of a bank (core library.py, addition.py):
  added?: "take";    // a new take the project adds: it has no original
  was?: string;      // a clip of its own: the clip this sound played, its original
  players?: number;  // how many Sounds of this bank play the clip
  sound_banks?: number; // the other banks that have the Sound: where a clip of its own would change it
  game_gain?: number;   // the Make-Up Gain the game gives the Sound that plays it: a slot's gain adds to it
  // a voice line: the subtitle it says (an id of the game's text), false where it is one of several with its words;
  // or, for a clip without words, what it is ("Grunt")
  subtitle?: string; subtitle_sure?: boolean; sound?: string;
};
/** The id a slot shows: its stream's, as other audio tools list streamed audio, else its source id (audio only
    inside banks). */
export function shownId(s: Slot): { id: string; what: "stream" | "source" } {
  return s.stream ? { id: s.stream, what: "stream" } : { id: s.source, what: "source" };
}
/** A note on one clip: what it is or a warning found in game. A note with a tag also marks the clip's row. */
export type ClipNote = { text: string; tag?: string; warn?: boolean };
export type Stem = { track: string; type: string; switch_group: string; slots: Slot[] };
export type Segment = {
  segment: string; name: string; depth: number; loop: number; duration_ms: number;
  entry_ms: number | null; exit_ms: number | null; stems: Stem[];
  group?: boolean;  // sounds that belong together (the takes of one sound), not a music segment
  kind?: GroupKind; // a group: what its sounds are (core library.py)
  made_up?: boolean; // a group nothing names: its name is a number in bank order ("Sound 6")
  shared?: number;  // a group: how many other banks play every one of its sounds
  tags?: Tag[];     // in a bank: the piece of music a segment is
  cue?: string;     // in a bank: the music cue a segment belongs to
  container?: string; // a group whose takes a random container picks: it can take new takes
  key?: string;     // a group: the container that holds its takes, whatever kind it is (what its note goes by)
  layer?: boolean;  // a layer can go beside it (it would play whenever this sound plays)
  copies?: number;  // how many other banks have its container: new takes and layers go there too
  added?: "layer";  // a layer the project adds, beside the sound in `beside`
  beside?: string;
  // Container ids (Settings): the group is the container right above its Sounds, named by its id
  ctype?: string;   // what kind of container: "Random", "Sequence", "Switch", "Layer" or "Actor-Mixer"
  above?: { ids: string[]; type: string }[]; // the containers over it, from the top down (a run of Actor-Mixers that each hold only the next on one line)
  alias?: string;   // what names the sound otherwise ("“Reloading!”", a note's name)
};
/** What a group of a bank's sounds is (core library.py): the takes of one sound, a layer the project adds, a part of
    a long list, the clips without words of one kind, the clips no sound of the bank plays, sounds with no audio in
    the game files, or the streams no bank plays. */
export type GroupKind = "sound" | "layer" | "run" | "wordless" | "other" | "absent" | "streams";
/** What a project problem is (core Project.problem_list and editor.project_state): the Project tab fixes the name,
    the icon and the mod ID; missing_file is an audio file the project uses that is gone. */
export type ProblemKind = "name" | "icon" | "icon_missing" | "mod_id" | "missing_file" | "duplicate" | "overrides"
  | "unresolved" | "same_sound" | "unreadable" | "no_file" | "loudness";
/** What opens in the middle: a music cue (kind playlist, segment, bridge or stinger), a bank's sounds ("sounds",
    id "bank:<id>" or "streams:<archive>") or one sound on its own ("sound", id "sfx:<source>"). */
export type Cue = Entry & {
  archive_names: string[]; segments_detail: Segment[]; context_list: string[]; labels: string[];
  ordered?: boolean; // a playlist: whether it plays its slots top to bottom (the Soundtrack shows the order otherwise)
  tags?: Tag[]; bank_name?: string; language?: string; lang?: string; // a voice bank's language: its name, its code
};
export const isMusic = (cue: { kind: string }) => cue.kind !== "sounds" && cue.kind !== "sound";
export type Assignment = {
  target: string; audio: string; label: string; gain_db: number; fit_timing: boolean; exists: boolean;
  name: string; cues: string[];
  silence: boolean; // plays the built-in silence: with fit_timing the game moves straight on, else it keeps its timing
  duration_ms: number | null; // the file's length
  file_segments: number; // the music segments that play the file, in this slot and others (0 for silence)
};
/** A Sound with a clip of its own (Only this sound) in place of one of the game's clips: where it is (the Library's
    name of its first bank) and every bank that has it. */
export type StandIn = { place: string; banks: string[] };
/** The Library's Index (core library.py): categories (the music first, then the named sound sets),
    their sections, and items a player would recognise. A piece of music's parts are cues, in mission order
    (core musiclist.py); a sound set's are its banks; an archive (All Archives) is an item too, with the banks it
    holds as parts. */
export type MusicPart = {
  cue: string; name: string; kind: "playlist" | "segment" | "bridge" | "stinger" | "sound" | "bank";
  targets: string[]; // the sources a replacement can change (music; a bank's sounds are too many to list)
  own: string[];     // of those, the ones no piece of music plays (what skipping a transition may silence)
  links: [string, string][]; // transitions: the (from, to) music items it plays between ("" = anything); stingers: (over, over)
  duration_ms: number; note: string;
  count?: number;    // a bank: how many sounds it has
};
export type MusicItem = {
  id: string; name: string; full: string; about: string; role: string;
  kind: "music" | "transition" | "stinger" | "sounds" | "archive";
  parts: MusicPart[]; targets: string[]; duration_ms: number; preview: string;
  around: { cue: string; item: string; way: "in" | "out" | "over" }[]; // transitions and stingers next to this music
  shares: { item: string; count: number }[];
  category?: string; // the Index category it is in ("" for an archive nobody has named)
  count?: number;    // how many sounds it has, over all its parts
  archive?: string;  // an archive: its name in the game's files
  id_name?: boolean; // an archive with no single name: called by its ID ("Archive <id>")
  tags?: Tag[]; names?: string[]; // an archive: what the Index knows is in it
  en?: string;       // the name in English, where the window's language names it otherwise (a search finds both)
};
export type MusicSection = { id: string; name: string; about: string; unused: boolean; items: MusicItem[]; en?: string };
export type MusicList = { sections: MusicSection[] };
export type Category = { id: string; name: string; hue: number; about: string; sections: MusicSection[]; en?: string };
export type Index = { categories: Category[] };
/** A row of All Archives: an archive of the game with audio in it, and what the Index knows about it. */
export type ArchiveRow = {
  id: string; names: string[]; tags: Tag[]; banks: number; sounds: number; language: string;
  en?: string[];   // the English names of its sound sets, where the window's language names them otherwise (search)
  preview: string; // one of its sounds, to hear without opening it
};
/** How a piece of music plays (core soundtrack.Piece): Original (without the items left out), One song (`song`, cut
    into segments) or a Playlist (`tracks`: whole songs, shuffled or not, from the first at each start or going on,
    `resume`) in segments of their own order, Silent, or the same music as another piece (follows); and its level.
    `song`: the file One song was cut from, as the project stores audio paths. */
export type Piece = {
  mode: "original" | "song" | "tracks" | "silent" | "same";
  segments?: string[]; left_out?: string[]; shuffle?: boolean; resume?: boolean; follows?: string; gain_db?: number;
  song?: string;
};
/** A node of a playlist (core soundtrack.as_dict): a segment, or a group that plays its children in order (rs 0), the
    next one each time (1), all in a random order (2) or one at random (3). loop: how often it plays, 0 for ever. */
export type PlayNode = { item: string; loop: number; segment?: string; rs?: number; children?: PlayNode[] };
/** How a piece of music plays (core editor.playlist_map): the game's tree, the project's (null while it is the
    game's), the item the music starts on ("0": the top), the segments a song fills, and each segment's name and
    length from Entry to Exit. */
export type PlaylistMap = {
  cue: string; tree: PlayNode; mine: PlayNode | null; entry: string; song: string[];
  segments: Record<string, { name: string; ms: number }>; piece: Piece;
};
/** Where an id leads (core Library.places): the cue to open, the slot to select in it, the item it is listed under
    and the archives that hold it. */
export type Place = { cue: string; source: string | null; item: string | null; archives: string[] };
/** A voice line that says a subtitle (core library.subtitle_lines): where it is, its bank's name, and whether the
    subtitle's id is certain or one of several with its words. */
export type SaidBy = Place & { name: string; subtitle: string; sure: boolean };
/** The frame around the icon (core arsenal.icon_frame): a border and rounded corners, in pixels of the 540 tile. */
export type IconFrame = { border: number; border_color: string; radius: number };
/** The icon as the project stores it: the image, if one is chosen (Audiodiver's default icon otherwise), and the frame
    keys it sets (the rest are defaults). */
export type Icon = Partial<IconFrame> & { image?: string };
export type ProjectState = {
  path: string; folder: string; name: string; guid: string; version: number;
  own_folder: boolean;      // the folder is the project's alone (core projectfiles.own_folder)
  folder_projects: number;  // other projects in its folder
  files_elsewhere: number;  // files it uses from outside its folder (Collect files copies them in)
  move_to: string | null;   // where Move would put the project file; null when the folder is its own
  revision: number;      // the core's count of changes to what is open: a no-op edit leaves it
  unsaved: boolean;      // edits wait for the next save (autosave on a timer, Settings ▸ System)
  description: string;   // the text a mod manager shows with the mod
  icon: Icon;
  icon_frame: IconFrame; // the icon's full frame, defaults included
  loudness_analysis: boolean;
  every_bank: boolean;   // a replaced sound goes into every bank that has it (Patch every bank with the sounds)
  project_banks_only: boolean; // added audio keeps to the project's banks (Keep added audio to the project's banks)
  patch_files: boolean;  // each build also saves the patch files in a folder named like the ZIP
  build_folder: string; zip_name: string; // where the next build goes, and what it is called
  build_folder_default: string;           // the build folder next to the project file: where builds go unless another is chosen
  last_build: { zip: string; mb: number; modified: number } | null; // this mod's newest ZIP there (modified: Unix seconds)
  game_updated: boolean; // the game updated since that build: its banks are stale (core editor._game_updated)
  rebuild: "new" | "game" | "changed" | null; // why that build isn't the project as it is now (core editor._rebuild)
  assignments: Record<string, Assignment>; unresolved: { target: string; audio: string; label: string }[];
  gains: Record<string, number>;    // Make-Up Gain on the original audio, by source; new audio's own applies while it is there
  library: string[];               // what the project works on: Index items and archives ("archive:<name>"), as added
  library_missing: string[];        // of what it lists, the ones this game version has nothing for
  in_banks: Record<string, number>; // per listed bank ("bank:<id>"): how many of its sounds are replaced
  outside: string[];                // the replaced slots that nothing on the list holds
  segment_overrides: Record<string, { entry_marker?: number; exit_marker?: number }>;
  texts: TextLine[];     // lines of the game's text the project changes (the Text tab)
  additions: { kind: "take" | "layer" | "own"; [key: string]: string }[]; // audio it adds (core project.py)
  stand_ins: Record<string, StandIn[]>; // by the game's clip: the Sounds with a clip of their own in place of it
  settings: number;      // the game's objects an imported mod's settings go on (core project.py)
  notes: Record<string, string>; // the project's notes, by key (notes.ts; core notes.py)
  soundtrack: Record<string, Piece>; // how pieces of music play, by playlist cue (core soundtrack.py); the others play as the game does
  tabs: ("editor" | "soundtrack" | "text")[] | null; // the hideable tabs it shows (nav.ts HIDEABLE); null: as Settings ▸ System says
  repairs: string[];     // damaged values in its file that opening it set back (said once, when it opens)
  problems: string[];    // what stops a build, in sentences
  problem_kinds: ProblemKind[]; // what each of them is, in the same order: the app goes by these, never by the words
  can_undo: boolean; can_redo: boolean;
  undo_label: string | null; redo_label: string | null; // what Undo / Redo would change ("fill", "move")
  history?: string[]; future?: string[]; // the History list: the edits done, oldest first, and those undone, the next to redo first
  history_at?: number[]; future_at?: number[]; opened_at?: number; // when each was made, and when the project opened (ms)
};
export type Status = {
  version: string; stage: string; error: string | null; log: string;
  game: { data: string; banks: number; music_banks: number } | null; project: ProjectState | null;
  loudness_missing: string | null; // why loudness analysis can't run on this computer, or null
  jobs: Job[];                     // jobs still running (a reloaded window picks them up)
  // the data folder in use or tried, how it was found, and the one chosen in Settings (null: found through Steam)
  game_folder: { path: string | null; how: "chosen" | "env" | "steam" | null; chosen: string | null };
  // the game's language in Steam ("brazilian") and Windows' ("pt-BR"), for Automatic (i18n.ts); the core's own
  languages?: { game: string | null; system: string | null; core: string };
};
export type Job = {
  id: string; kind: string; title: string; state: "running" | "done" | "failed" | "cancelled"; log: string[];
  result: any; error: string | null; seconds: number;
  done: number; total: number; doing: string; // progress: steps finished of total, and what it is on now
};

let endpoint: Promise<{ base: string; token: string }> | null = null;

async function discover() {
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    const e = await invoke<{ port: number; token: string; error: string | null }>("core_endpoint");
    if (e.error) throw new Error(e.error);
    return { base: `http://127.0.0.1:${e.port}`, token: e.token };
  }
  const q = new URLSearchParams(location.search);
  return { base: `http://127.0.0.1:${q.get("port") ?? "8765"}`, token: q.get("token") ?? "dev" };
}

export function connect() {
  endpoint ??= discover();
  return endpoint;
}

export class ApiError extends Error {}

export async function call<T = any>(method: string, args: Record<string, unknown> = {}): Promise<T> {
  const { base, token } = await connect();
  let res: Response;
  try {
    res = await fetch(`${base}/api/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Audiodiver-Token": token },
      body: JSON.stringify(args),
    });
  } catch {
    // before it ever answered, the core may still be starting (the window keeps asking); after, it stopped
    throw new ApiError(answered ? t`Lost contact with the Audiodiver core. Restart the app.` : t`Waiting for the Audiodiver core to start…`);
  }
  answered = true;
  const status = res.status;
  const body = await res.json().catch(() => ({ error: t`Audiodiver couldn't read the core's response (HTTP ${status})` }));
  if (!res.ok) throw new ApiError(body.error ?? `HTTP ${res.status}`);
  return body.result as T;
}
let answered = false; // the core has answered at least once

let audioBase = "";
let audioToken = "";
connect().then((e) => { audioBase = e.base; audioToken = e.token; }).catch(() => {});

export function audioUrl(kind: "vanilla" | "project", source: string, bust = "") {
  return `${audioBase}/audio/${kind}/${source}?token=${encodeURIComponent(audioToken)}${bust ? `&v=${bust}` : ""}`;
}

export function fileUrl(path: string) {
  return `${audioBase}/audio/file?token=${encodeURIComponent(audioToken)}&path=${encodeURIComponent(path)}`;
}

/** The open project's icon as the build packages it. `preview` draws an icon that isn't saved yet (a border being
    dragged, a colour being tried). */
export function iconUrl(bust: string, preview?: Icon) {
  const icon = preview ? `&icon=${encodeURIComponent(JSON.stringify(preview))}` : "";
  return `${audioBase}/project/icon?token=${encodeURIComponent(audioToken)}&v=${bust}${icon}`;
}

/** The icon of a project that isn't open (Home's recent project); `bust` changes when the project file does. */
export function projectIconUrl(path: string, bust: string) {
  return `${audioBase}/projects/icon?token=${encodeURIComponent(audioToken)}&path=${encodeURIComponent(path)}&v=${bust}`;
}

/** The image a mod's manifest names as the icon (a ZIP, a folder or a patch file's mod), for Import Mod. */
export function modIconUrl(path: string) {
  return `${audioBase}/mods/icon?token=${encodeURIComponent(audioToken)}&path=${encodeURIComponent(path)}`;
}

/** The locale dates, numbers and lists are written in: the window's language (English writes dates the British way;
    the pseudo-language of development is English underneath). */
export const intlLocale = () => (i18n.locale === "en" || i18n.locale === "pseudo" || !i18n.locale ? "en-GB" : i18n.locale);
/** A number with the language's decimal mark and `digits` decimals: 1.5 is "1.5" in English, "1,5" in Portuguese. */
export const fmtNumber = (n: number, digits = 0) =>
  new Intl.NumberFormat(intlLocale(), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
/** A number with at most `max` decimals, as many as it needs, and the language's decimal mark: 2 is "2", 1.25 is
    "1.25" ("1,25"). `sign` writes a + before a positive number. */
export const fmtDecimal = (n: number, max = 2, sign = false) =>
  new Intl.NumberFormat(intlLocale(), { maximumFractionDigits: max, signDisplay: sign ? "exceptZero" : "auto" }).format(n);
/** "A, B and C" in the window's language. */
export const andList = (items: string[]) => new Intl.ListFormat(intlLocale(), { type: "conjunction" }).format(items);
/** "A, B or C" in the window's language. */
export const orList = (items: string[]) => new Intl.ListFormat(intlLocale(), { type: "disjunction" }).format(items);

/** "today, 14:05", "yesterday, 09:30" or "12 Mar 2026" for a time in Unix seconds. */
export function fmtWhen(seconds: number | null | undefined) {
  if (!seconds) return "";
  const d = new Date(seconds * 1000), now = new Date();
  const days = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000);
  const time = d.toLocaleTimeString(intlLocale(), { hour: "2-digit", minute: "2-digit" });
  if (days === 0) return t`today, ${time}`;
  if (days === 1) return t`yesterday, ${time}`;
  return d.toLocaleDateString(intlLocale(), { day: "numeric", month: "short", year: "numeric" });
}

export function fmtBytes(bytes: number) {
  if (bytes >= 1e9) return `${fmtNumber(bytes / 1e9, 1)} GB`;
  if (bytes >= 1e6) return `${fmtNumber(bytes / 1e6)} MB`;
  return bytes > 0 ? `${fmtNumber(Math.max(1, bytes / 1e3))} KB` : t`empty`;
}

export function fmtTime(ms: number | null | undefined) {
  if (ms == null) return "–";
  const s = ms / 1000;
  if (s > 0 && s < 1) return `${fmtNumber(s, 2)} s`; // a short sound: 0.05 s, not 0.1 s
  if (s < 60) return `${fmtNumber(s, 1)} s`;
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

/** What a mod manager can't have in a mod's name (Build, Repatch): it uses the name as a folder name. */
export function nameProblem(name: string): string | null {
  if (!name.trim()) return t`A mod needs a name.`;
  const bad = [...new Set([...name].filter((c) => c.charCodeAt(0) > 126 || c.charCodeAt(0) < 32 || '\\/:*?"<>|'.includes(c)))].join(" ");
  if (bad) return t`Mod managers can't use ${bad} in a name, because it becomes a folder name. Use letters, digits, spaces and - _ ( ).`;
  if (!/[A-Za-z0-9]/.test(name)) return t`A name needs a letter or a digit.`;
  return null;
}

/** A line of the game's text: in a string table (its file id), by its id. `text` is the original; `yours` (the new text) and `was`
    are there when the open project changes it (`was`: the game's text when it was changed). */
export type TextLine = { table: string; id: number; text: string; yours?: string; was?: string; kind?: "subtitles" | "text" };
