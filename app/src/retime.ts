import type { Block } from "./api";

/** Cuts of a song that follow the song's audio when the Waveform Suite changes it (SliceTool's Suite tab).

    A cut is a time in the song as `from` blocks make it. It is pinned to the audio it falls on: the block under it
    (the top one where blocks overlap, as the list has them last) and the time in that block's file. In the song as
    `to` blocks make it, the cut goes where that moment of the file plays now; where it plays more than once (a
    duplicated block), to the place nearest where the cut was. A cut whose audio was trimmed away or removed goes to
    the nearest edge of what is left of that file; a cut between blocks keeps its distance from the end of the block
    before it. A cut at the very start or end of the song stays at the start or end. */

const END_MS = 5; // a cut this near the song's end is at the end (the player and the core measure a file a little apart)
const speed =(b: Block) => b.tempo ?? 1;
const endOf = (b: Block) => b.at_ms + (b.end_ms - b.start_ms) / speed(b);
const keyOf = (b: Block) => b.audio ?? "";
/** The song's length as blocks make it. */
export const songMs = (blocks: Block[]) => Math.max(0, ...blocks.map(endOf));

type Pin = { key: string; file: number; was: number } | { after: Pin; by: number } | { at: number };

function pin(blocks: Block[], ms: number): Pin {
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i];
    if (ms >= b.at_ms && ms <= endOf(b)) return { key: keyOf(b), file: b.start_ms + (ms - b.at_ms) * speed(b), was: ms };
  }
  // between blocks: from the end of the block that ends last before it
  let before: Block | null = null;
  for (const b of blocks) if (endOf(b) <= ms && (!before || endOf(b) > endOf(before))) before = b;
  if (!before) return { at: ms };
  return { after: { key: keyOf(before), file: before.end_ms, was: endOf(before) }, by: ms - endOf(before) };
}

function place(blocks: Block[], p: Pin): number {
  if ("at" in p) return p.at;
  if ("after" in p) return place(blocks, p.after) + p.by;
  const same = blocks.filter((b) => keyOf(b) === p.key);
  if (!same.length) return p.was;
  let best: number | null = null;
  for (const b of same) {
    if (p.file < b.start_ms || p.file > b.end_ms) continue;
    const at = b.at_ms + (p.file - b.start_ms) / speed(b);
    if (best === null || Math.abs(at - p.was) < Math.abs(best - p.was)) best = at;
  }
  if (best !== null) return best;
  // that moment is gone: the nearest edge of what is left of the file
  let edge = p.was, far = Infinity;
  for (const b of same) {
    for (const [f, at] of [[b.start_ms, b.at_ms], [b.end_ms, endOf(b)]] as const) {
      const d = Math.abs(f - p.file);
      if (d < far) { far = d; edge = at; }
    }
  }
  return edge;
}

/** `cuts` (in order, ms) moved from the song `from` makes to the song `to` makes, kept in order and in the song. */
export function retime(cuts: number[], from: Block[], to: Block[]): number[] {
  if (!cuts.length) return cuts;
  const was = songMs(from), now = songMs(to);
  const out = cuts.map((ms) => {
    if (ms <= 0.5) return 0;
    if (Math.abs(ms - was) <= END_MS) return now;
    return place(to, pin(from, ms));
  }).map((ms) => Math.round(Math.max(0, Math.min(now, ms))));
  for (let i = 1; i < out.length; i++) out[i] = Math.max(out[i], out[i - 1]);
  return out;
}
