// Shows Markdown (the Wiki's pages, the changelog) as React elements. marked does the parsing; this draws its
// tokens, so no HTML string is ever injected and links can stay inside the app.
//
// Beyond plain Markdown, a page can use:
//   [text](wiki:page-id)        another Wiki page          [text](app:settings/shortcuts)   a tab of the app
//   [text](app:about)           the About box (version, licence, credits)
//   [text](#a-heading)          a heading on this page     [text](https://…)                the web browser
//   {key:build}                 the key a command is on right now (ids in keys.ts)
//   {icon:link}                 one of the app's icons, as the screen shows it (ICONS below)
//   > [!TIP] … / [!NOTE] / [!WARNING]                      a callout
//   ```game-text … ```          a line of the game's text as typed, and as the game shows it (TextPreview)
import { marked, type Token, type Tokens } from "marked";
import { Fragment, type ReactNode } from "react";
import { AudioIcon, BuildIcon, ClearIcon, CollapseAllIcon, ExportIcon, ExternalIcon, FillIcon, FillPieceIcon, GearIcon, GuideIcon, HeaderIcon,
  HomeIcon, IdIcon, InfoIcon, LibraryIcon, LinkIcon, NoteIcon, OrderIcon, PlusIcon, ProjectIcon, ResetIcon, SearchIcon, SkipAllIcon, SkipIcon,
  SliceIcon, SoundtrackIcon, TextIcon, ThroughIcon, ToolsIcon, TransitionIcon, UpdatesIcon, WavesIcon } from "./Icons";
import { COMMANDS, keyLabel, useKeymap, type CommandId } from "./keys";
import { about, nav, type Tab } from "./nav";
import { openUrl } from "./platform";
import { TextPreview } from "./TextPreview";

export type Heading = { id: string; text: string; depth: number };
export type Doc = { tokens: Token[]; headings: Heading[]; text: string };

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "section";

/** The words of some tokens, without the markup: for search, and for heading ids. */
export function plainText(tokens: Token[]): string {
  return tokens.map((t): string => {
    const k = t as Tokens.Generic;
    if (k.type === "list") return plainText(k.items);
    if (k.type === "table") return [...k.header, ...k.rows.flat()].map((c: Tokens.TableCell) => plainText(c.tokens)).join(" ");
    if (k.tokens) return plainText(k.tokens);
    return k.type === "html" ? "" : (k.text ?? "");
  }).join(" ");
}

/** Parses Markdown once: the tokens to draw, the headings for an outline (each with the id it gets on the page), and
    the plain text. */
export function parse(md: string): Doc {
  const tokens = marked.lexer(md);
  const headings: Heading[] = [], used = new Map<string, number>();
  for (const t of tokens) {
    if (t.type !== "heading") continue;
    const text = plainText((t as Tokens.Heading).tokens).trim(), base = slug(text);
    const n = used.get(base) ?? 0;
    used.set(base, n + 1);
    const id = n ? `${base}-${n + 1}` : base;
    (t as Tokens.Generic).id = id;
    headings.push({ id, text, depth: (t as Tokens.Heading).depth });
  }
  return { tokens, headings, text: plainText(tokens) };
}

const TABS: Tab[] = ["home", "project", "library", "editor", "soundtrack", "text", "build", "tools", "updates", "settings", "wiki"];
const CALLOUT = /^\[!(TIP|NOTE|WARNING)\]\s*/;
const CALLOUT_NAME: Record<string, string> = { TIP: "Tip", NOTE: "Note", WARNING: "Careful" };
const REF = /\{(key|icon):(\w+)\}/g;
/** The icons a page can show in its text, so it can point at them as they look on screen. */
const ICONS: Record<string, () => ReactNode> = {
  link: LinkIcon, collapse: CollapseAllIcon,
  home: HomeIcon, library: LibraryIcon, audio: AudioIcon, soundtrack: SoundtrackIcon, text: TextIcon, build: BuildIcon, updates: UpdatesIcon,
  wiki: GuideIcon, settings: GearIcon, info: InfoIcon, note: NoteIcon, project: ProjectIcon, tools: ToolsIcon,
  fill: FillIcon, fillpiece: FillPieceIcon, slice: SliceIcon, export: ExportIcon, skip: SkipIcon, skipall: SkipAllIcon, clear: ClearIcon,
  search: SearchIcon, through: ThroughIcon, transition: TransitionIcon, order: OrderIcon, id: IdIcon, reset: ResetIcon, add: PlusIcon,
  header: () => <HeaderIcon on />, waves: () => <WavesIcon on />,
};

/** A word joiner: the line can break on either side of an icon (an svg) even next to a letter or a bracket, but never
    beside this character. */
const JOIN = "⁠";
const joins = (ch: string | undefined) => (ch && /\S/.test(ch) ? JOIN : "");

/** Text with {key:command} turned into the key that command is on now, and {icon:name} into that icon. An icon stays
    on the line of the word or bracket it touches. */
function withKeys(text: string): ReactNode {
  const parts = text.split(REF); // [text, kind, id, text, kind, id, …]
  if (parts.length === 1) return text;
  const out: ReactNode[] = [];
  for (let i = 0; i < parts.length; i += 3) {
    out.push(parts[i]);
    if (i + 2 >= parts.length) break;
    const [kind, p] = [parts[i + 1], parts[i + 2]];
    if (kind === "icon") {
      const Icon = ICONS[p];
      out.push(Icon ? <span key={i} className="md-icon" role="img" aria-label={p}>{joins(parts[i].slice(-1))}<Icon />{joins(parts[i + 3]?.[0])}</span> : `{icon:${p}}`);
    } else if (!COMMANDS.some((c) => c.id === p)) {
      out.push(`{key:${p}}`);
    } else {
      const label = keyLabel(p as CommandId);
      out.push(label ? <kbd key={i}>{label}</kbd> : <kbd key={i} className="none">no key set</kbd>);
    }
  }
  return out;
}

/** A link to a place in the app. An inline element, not a button: a button can't wrap, and the line may break
    between it and the bracket before it. Enter opens it, as a click does. */
function InApp({ go, children }: { go: () => void; children: ReactNode }) {
  return (
    <a className="link-text" role="link" tabIndex={0} onClick={(e) => { e.preventDefault(); go(); }}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); go(); } }}>{children}</a>
  );
}

function Link({ href, children }: { href: string; children: ReactNode }) {
  if (/^https?:\/\//i.test(href)) {
    return <a className="link-text" href={href} data-tip={href} onClick={(e) => { e.preventDefault(); openUrl(href); }}>{children}{JOIN}<ExternalIcon /></a>;
  }
  if (href.startsWith("#")) {
    return <a className="link-text" href={href} onClick={(e) => { e.preventDefault(); document.getElementById(href.slice(1))?.scrollIntoView({ block: "start" }); }}>{children}</a>;
  }
  const [scheme, rest = ""] = href.split(":", 2);
  const [first, sub] = rest.split("/");
  if (scheme === "wiki") return <InApp go={() => nav.go("wiki", first)}>{children}</InApp>;
  if (scheme === "app" && first === "about") return <InApp go={about.open}>{children}</InApp>;
  if (scheme === "app" && TABS.includes(first as Tab)) return <InApp go={() => nav.go(first as Tab, sub)}>{children}</InApp>;
  return <>{children}</>;
}

function Inline({ tokens, images }: { tokens: Token[] | undefined; images?: (name: string) => string | undefined }): ReactNode {
  return (tokens ?? []).map((t, i) => {
    const k = t as Tokens.Generic;
    switch (k.type) {
      case "strong": return <strong key={i}><Inline tokens={k.tokens} images={images} /></strong>;
      case "em": return <em key={i}><Inline tokens={k.tokens} images={images} /></em>;
      case "del": return <del key={i}><Inline tokens={k.tokens} images={images} /></del>;
      case "codespan": return <code key={i}>{k.text}</code>;
      case "br": return <br key={i} />;
      case "link": return <Link key={i} href={k.href}><Inline tokens={k.tokens} images={images} /></Link>;
      case "image": { const src = images?.(k.href); return src ? <img key={i} src={src} alt={k.text} /> : <Fragment key={i}>{k.text}</Fragment>; }
      case "html": return null;
      default: return k.tokens ? <Inline key={i} tokens={k.tokens} images={images} /> : <Fragment key={i}>{withKeys(k.text ?? "")}</Fragment>;
    }
  });
}

/** A blockquote that starts with [!TIP], [!NOTE] or [!WARNING] is a callout: the marker comes off its first line. */
function callout(q: Tokens.Blockquote): { kind: string; tokens: Token[] } | null {
  const m = CALLOUT.exec(q.text);
  const first = q.tokens[0] as Tokens.Generic | undefined;
  if (!m || !first?.tokens?.length) return null;
  const [lead, ...rest] = first.tokens as Tokens.Generic[];
  const stripped = { ...lead, text: String(lead.text ?? "").replace(CALLOUT, "") };
  return { kind: m[1], tokens: [{ ...first, tokens: [stripped, ...rest] } as Token, ...q.tokens.slice(1)] };
}

function Blocks({ tokens, images }: { tokens: Token[]; images?: (name: string) => string | undefined }): ReactNode {
  return tokens.map((t, i) => {
    const k = t as Tokens.Generic;
    switch (k.type) {
      case "heading": {
        const H = (k.depth <= 2 ? "h2" : k.depth === 3 ? "h3" : "h4") as "h2";
        return <H key={i} id={k.id}><Inline tokens={k.tokens} images={images} /></H>;
      }
      case "paragraph": return <p key={i}><Inline tokens={k.tokens} images={images} /></p>;
      case "text": return <Fragment key={i}><Inline tokens={k.tokens ?? [t]} images={images} /></Fragment>;
      case "list": {
        const L = (k.ordered ? "ol" : "ul") as "ol";
        return (
          <L key={i} start={k.ordered && k.start !== "" && k.start !== 1 ? k.start : undefined}>
            {(k.items as Tokens.ListItem[]).map((item, j) => <li key={j}><Blocks tokens={item.tokens} images={images} /></li>)}
          </L>
        );
      }
      case "blockquote": {
        const c = callout(t as Tokens.Blockquote);
        return c ? (
          <aside key={i} className={`callout ${c.kind.toLowerCase()}`}><b>{CALLOUT_NAME[c.kind]}</b><div><Blocks tokens={c.tokens} images={images} /></div></aside>
        ) : <blockquote key={i}><Blocks tokens={k.tokens ?? []} images={images} /></blockquote>;
      }
      case "code": return k.lang === "game-text" ? (
        <div key={i} className="md-game-text"><pre><code>{k.text}</code></pre><div className="tx-preview"><TextPreview text={k.text} /></div></div>
      ) : <pre key={i}><code>{k.text}</code></pre>;
      case "hr": return <hr key={i} />;
      case "table": {
        const table = t as Tokens.Table;
        const cell = (c: Tokens.TableCell, j: number) => {
          const C = (c.header ? "th" : "td") as "td";
          return <C key={j} style={c.align ? { textAlign: c.align } : undefined}><Inline tokens={c.tokens} images={images} /></C>;
        };
        return (
          <div key={i} className="table-wrap"><table>
            <thead><tr>{table.header.map(cell)}</tr></thead>
            <tbody>{table.rows.map((r, j) => <tr key={j}>{r.map(cell)}</tr>)}</tbody>
          </table></div>
        );
      }
      default: return null; // space, html, link definitions
    }
  });
}

/** `images` turns the file name in ![alt](name.png) into a URL; without one, images show their alt text. */
export function Markdown({ tokens, images }: { tokens: Token[]; images?: (name: string) => string | undefined }) {
  useKeymap(); // {key:…} follows a rebinding
  return <div className="md"><Blocks tokens={tokens} images={images} /></div>;
}
