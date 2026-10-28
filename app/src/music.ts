// The Index as the app looks things up in it, what a project covers of an item or a part, and the transitions and
// stingers that would still play the original next to new music.
import { t } from "@lingui/core/macro";
import type { Assignment, Category, Index, MusicItem, MusicPart, MusicSection, ProjectState } from "./api";

export type Coverage = { n: number; total: number };
export type Status = "none" | "part" | "done" | "na";

export type ItemIndex = {
  items: Map<string, MusicItem>;                              // every Index item, and the archives looked up so far
  section: Map<string, MusicSection>;                         // item id -> its section
  category: Map<string, Category>;                            // item id, and category id -> the category
  byCue: Map<string, { item: MusicItem; part: MusicPart }>;  // cue id -> the Index item and part it belongs to
  music: MusicSection[];                                      // the music's sections, in mission order
};

/** `archives`: the archives opened or listed so far (All Archives items, fetched one by one). They are found by
    id, but a bank goes by the Index item it is a part of, never by an archive that also holds it. */
export function indexItems(index: Index | null, archives: Record<string, MusicItem> = {}): ItemIndex {
  const idx: ItemIndex = { items: new Map(), section: new Map(), category: new Map(), byCue: new Map(), music: [] };
  for (const c of index?.categories ?? []) {
    idx.category.set(c.id, c);
    if (c.id === "music") idx.music = c.sections;
    for (const s of c.sections) for (const it of s.items) {
      idx.items.set(it.id, it);
      idx.section.set(it.id, s);
      idx.category.set(it.id, c);
      for (const p of it.parts) if (!idx.byCue.has(p.cue)) idx.byCue.set(p.cue, { item: it, part: p });
    }
  }
  for (const it of Object.values(archives)) {
    idx.items.set(it.id, it);
    const c = it.category ? idx.category.get(it.category) : undefined;
    if (c) idx.category.set(it.id, c);
  }
  return idx;
}

/** A piece of music, a transition or a stinger: what has slots to count, parts with a length, and things around it. */
export const isMusicItem = (item: MusicItem) => item.kind === "music" || item.kind === "transition" || item.kind === "stinger";

/** The slots that count for an item: all of a piece of music; for a transition or stinger only those no music plays
 * (the rest change with that music). A bank's sounds aren't listed: see itemCoverage. */
export function counted(item: MusicItem, part?: MusicPart): string[] {
  const parts = part ? [part] : item.parts;
  const all = parts.flatMap((p) => (item.kind === "transition" || item.kind === "stinger" ? p.own : p.targets));
  return [...new Set(all)];
}

export function coverage(sources: string[], a: Record<string, Assignment>): Coverage {
  return { n: sources.filter((s) => a[s]).length, total: sources.length };
}

/** How much of an item, or of one of its parts, is replaced. Music counts its slots. A bank has too many sounds to
    list, so the project says how many of them are replaced (in_banks) and the part how many there are. */
export function itemCoverage(item: MusicItem, project: ProjectState | null, part?: MusicPart): Coverage {
  if (!project) return { n: 0, total: 0 };
  const music = coverage(counted(item, part), project.assignments);
  for (const p of part ? [part] : item.parts) {
    if (p.kind !== "bank") continue;
    music.n += project.in_banks[p.cue] ?? 0;
    music.total += p.count ?? 0;
  }
  return music;
}

export function statusOf(c: Coverage): Status {
  if (!c.total) return "na";
  return c.n === 0 ? "none" : c.n >= c.total ? "done" : "part";
}

/** A status in words: whether something plays the original or a replacement. */
export const COVERAGE: Record<Status, string> = { none: t`Original`, part: t`Partly replaced`, done: t`Replaced`, na: "" };

export type Clash = { item: MusicItem; part: MusicPart; next: MusicItem[]; open: string[] };

let lastClashes: { idx: ItemIndex; a: Record<string, Assignment>; out: Clash[] } | null = null;

/** Transitions that still play the original between two replaced pieces of music, and stingers that still play
 * it over replaced music. An original transition into original music is not a clash. Worked out again only when
 * the project's assignments change: the Editor's list and the open item's head ask on every render (a selection's
 * move cost 6 ms of it on a slow PC). */
export function clashes(idx: ItemIndex, a: Record<string, Assignment>): Clash[] {
  if (lastClashes?.idx === idx && lastClashes.a === a) return lastClashes.out;
  const touched = (id: string) => !!id && !!idx.items.get(id)?.targets.some((t) => a[t]);
  const out: Clash[] = [];
  for (const s of idx.music) {
    if (s.unused) continue;
    for (const it of s.items) {
      if (it.kind === "music") continue;
      for (const part of it.parts) {
        const open = part.own.filter((t) => !a[t]);
        if (!open.length) continue;
        const hits = part.links.filter(([f, t]) => (part.kind === "stinger" ? touched(f) : touched(f) && touched(t)));
        if (!hits.length) continue;
        const next = [...new Set(hits.flat())].filter(Boolean).map((id) => idx.items.get(id)!).filter(Boolean);
        out.push({ item: it, part, next, open });
      }
    }
  }
  lastClashes = { idx, a, out };
  return out;
}

const isBank = (cue: string) => cue.startsWith("bank:") || cue.startsWith("streams:");

/** The banks the project lists (an archive's loose streams count as one), each with the listed item it is in. The
    core never lists a bank twice (`library_add`); this says where one already is. */
export function listedBanks(idx: ItemIndex, library: string[]): Map<string, MusicItem> {
  const out = new Map<string, MusicItem>();
  for (const id of library) {
    const it = idx.items.get(id);
    for (const p of it?.parts ?? []) if (isBank(p.cue) && !out.has(p.cue)) out.set(p.cue, it!);
  }
  return out;
}

/** The listed item that has every bank of this sound set or archive already (a weapon's set and its archive, two
    archives with the same bank), or null: adding it would only show the same sounds twice. Music goes by its cues,
    so it is never held. */
export function heldBy(banks: Map<string, MusicItem>, item: MusicItem): MusicItem | null {
  if (!item.parts.length || !item.parts.every((p) => isBank(p.cue))) return null;
  const owners = item.parts.map((p) => banks.get(p.cue));
  return owners.every((o) => o && o.id !== item.id) ? owners[0]! : null;
}

/** An item as the Editor's list shows it, telling an archive from the sound set it is named after. An archive
    called by its ID (`id_name`) says so already. */
export const listName = (it: MusicItem) => {
  const { full, archive } = it;
  return archive && !it.id_name ? t`${full} (archive ${archive})` : full;
};

/** "Terminids ▸ Exploring", "Weapons ▸ AC-8 Autocannon": an item with where it is in the Index. */
export function where(idx: ItemIndex, item: MusicItem) {
  const s = idx.section.get(item.id), c = idx.category.get(item.id);
  const group = c && c.id !== "music" ? (s && s.name !== c.name ? `${c.name} ▸ ${s.name}` : c.name) : s?.name;
  return group && (item.role || !isMusicItem(item)) ? `${group} ▸ ${item.name}` : item.name;
}

/** The colour a category's tags are drawn in: its hue, at the lightness and strength the theme sets (styles.css,
    --tag-l and --tag-c). */
export const hueOf = (idx: ItemIndex, category: string | undefined) => (category ? idx.category.get(category)?.hue : undefined);
