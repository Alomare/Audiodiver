// The Wiki's pages (src/wiki/*.md), apart from content.ts so they load with the Wiki and not with the app: the
// English pages are some 300 kB of text, and a translated window waited for its language's pages before anything
// showed. A page is one Markdown file, listed in file-name order ("20-preparing-audio.md" before "30-…"). It starts
// with a few lines about itself:
//
//     ---
//     title: Preparing the audio
//     group: Making a mod          pages with the same group are listed together, groups in order of first use
//     summary: One or two sentences shown under the title and in search.
//     ---
import { i18n } from "@lingui/core";
import { parse, type Doc } from "./Markdown";

export type WikiPage = Doc & { id: string; title: string; group: string; summary: string };

const sources = import.meta.glob("./wiki/*.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const pictures = import.meta.glob("./wiki/*.{png,jpg,jpeg,webp,gif}", { query: "?url", import: "default", eager: true }) as Record<string, string>;
// A translated page has the English page's file name in a folder named for the language (wiki/pt-BR/20-….md). Only
// the window's language loads (this module waits for it); a page not translated yet shows in English.
const translations = import.meta.glob("./wiki/*/*.md", { query: "?raw", import: "default" }) as Record<string, () => Promise<string>>;
const translated: Record<string, string> = Object.fromEntries(await Promise.all(Object.entries(translations)
  .filter(([path]) => path.split("/")[2] === i18n.locale)
  .map(async ([path, load]) => [`./wiki/${path.split("/")[3]}`, await load()] as const)));

function page(path: string, source: string): WikiPage {
  const name = path.split("/").pop()!.replace(/\.md$/, "");
  const head = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);
  const about: Record<string, string> = {};
  for (const line of head?.[1].split(/\r?\n/) ?? []) {
    const at = line.indexOf(":");
    if (at > 0) about[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  // its Markdown is read when the page is first shown or searched, not as the Wiki opens (all of them took 230 ms
  // of a slow PC's start)
  let doc: Doc | null = null;
  const body = () => (doc ??= parse(head ? source.slice(head[0].length) : source));
  return {
    get tokens() { return body().tokens; }, get headings() { return body().headings; }, get text() { return body().text; },
    id: name.replace(/^\d+-/, ""), title: about.title || name, group: about.group || "Guides", summary: about.summary || "",
  };
}

export const WIKI: WikiPage[] = Object.keys(sources).sort().map((path) => page(path, translated[path] ?? sources[path]));
/** The pages by group, groups in the order their first page comes. */
export const WIKI_GROUPS: { name: string; pages: WikiPage[] }[] = [];
for (const p of WIKI) {
  let g = WIKI_GROUPS.find((x) => x.name === p.group);
  if (!g) WIKI_GROUPS.push((g = { name: p.group, pages: [] }));
  g.pages.push(p);
}
/** The URL of a picture a page shows with ![alt](name.png). */
export const wikiPicture = (name: string) => pictures[`./wiki/${name.replace(/^\.\//, "")}`];
