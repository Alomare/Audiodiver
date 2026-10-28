import { useEffect, useMemo, useRef, useState } from "react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { WIKI as ALL_PAGES, WIKI_GROUPS, wikiPicture } from "./content";
import { UTILS, UTILS_WIKI } from "./edition";
import { DownIcon, PlayMarkIcon, SearchIcon, UpIcon } from "./Icons";
import { keyLabel, useCommands } from "./keys";
import { Markdown } from "./Markdown";
import { nav, useNav } from "./nav";
import { Splitter, useStoredWidth } from "./Resize";
import { scrollBehavior } from "./theme";
import { TUTORIALS_PAGE, TutorialsPage } from "./Tutorial";

const NAV_SHARE = 0.25; // the list of guides takes a quarter of the tab to start, the page the rest
/** The pages the list shows and Previous/Next step through: Audiodiver Utils lists only its own (a link still opens
    any page). The FAQ (the page "faq") has an entry above the groups, and isn't one of the steps. */
const WIKI = UTILS ? ALL_PAGES.filter((p) => UTILS_WIKI.has(p.id)) : ALL_PAGES.filter((p) => p.id !== "faq");
const FAQ = UTILS ? undefined : ALL_PAGES.find((p) => p.id === "faq");
/** The words that find the entry of the interactive tutorials in the guides search, in the window's language. */
const TUTORIAL_WORDS = t({ message: "interactive tutorials walkthroughs",
  comment: "Search words in lower case. Typing them in the Wiki's guide search shows the Interactive Tutorials entry." }).toLowerCase();

/** The Wiki tab: guides, resources and good practice for making audio mods. Pages are Markdown files in src/wiki
    (see content.ts for how one is laid out); the list on the left, the page in the middle, its headings on the right. */
export function Wiki() {
  const { wiki: id, anchor } = useNav(); // anchor: a heading a link to part of the page names
  const [query, setQuery] = useState("");
  const [share, setShare] = useStoredWidth("audiodiver.wikiShare", NAV_SHARE);
  const [at, setAt] = useState(""); // the heading being read, for the outline
  const reader = useRef<HTMLDivElement>(null);
  const article = useRef<HTMLElement>(null);
  const picked = useRef(""); // the heading last clicked in the outline
  const tutorials = !UTILS && id === TUTORIALS_PAGE; // the page of tutorials, which isn't Markdown (Tutorial.tsx)
  const page = ALL_PAGES.find((p) => p.id === id) ?? WIKI[0];
  const index = WIKI.indexOf(page);
  // the find bar: open, how many times Ctrl+F opened it (each one goes back to its box), and words selected then;
  // quiet when a page opened from the guides search shows the words searched for (the focus stays in the list)
  const [find, setFind] = useState<{ n: number; text?: string; quiet?: boolean } | null>(null);
  useCommands({
    search: () => {
      const sel = window.getSelection(), words = sel && !sel.isCollapsed && article.current?.contains(sel.anchorNode) ? sel.toString().trim() : "";
      setFind((f) => ({ n: (f?.n ?? 0) + 1, text: words && words.length <= 80 && !words.includes("\n") ? words : undefined }));
    },
    stop: () => (find ? setFind(null) : false), // Esc closes it from anywhere on the page, before it stops playback
  }, 1);

  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const found = useMemo(() => new Set(WIKI.filter((p) => {
    const hay = `${p.title} ${p.group} ${p.summary} ${p.text}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  }).map((p) => p.id)), [query]); // eslint-disable-line react-hooks/exhaustive-deps
  const groups = WIKI_GROUPS.map((g) => ({ ...g, pages: g.pages.filter((p) => found.has(p.id)) })).filter((g) => g.pages.length);
  const faqFound = !!FAQ && words.every((w) => `${FAQ.title} ${FAQ.summary} ${FAQ.text}`.toLowerCase().includes(w));
  const step = (by: number) => (index >= 0 ? WIKI[index + by] : undefined);
  /** A page from the search's list. The find bar marks the words searched for on it, when the page has them as typed. */
  const openFound = (id: string) => {
    nav.go("wiki", id);
    const p = ALL_PAGES.find((x) => x.id === id), phrase = query.trim().replace(/\s+/g, " ").toLowerCase();
    if (phrase && p?.text.replace(/\s+/g, " ").toLowerCase().includes(phrase)) setFind((f) => ({ n: (f?.n ?? 0) + 1, text: query.trim(), quiet: true }));
  };

  // another page starts at its top, or at the heading a link names (once: then the page is where the reader leaves it)
  const shown = useRef<string | null>(null);
  useEffect(() => {
    const el = anchor ? document.getElementById(anchor) : null;
    if (el) { picked.current = anchor; setAt(anchor); el.scrollIntoView({ block: "start" }); nav.landed(); }
    else if (shown.current !== page?.id) { reader.current?.scrollTo({ top: 0 }); setAt(""); }
    shown.current = page?.id ?? null;
  }, [page?.id, anchor]);

  if (!page) return <section className="wiki"><p className="empty-note"><Trans>No guides yet.</Trans></p></section>;

  const outline = page.headings.filter((h) => h.depth <= 3);
  /** The outline follows the reading position: the last heading that has passed the top of the page. */
  const follow = () => {
    const box = reader.current;
    if (!box) return;
    const view = box.getBoundingClientRect(), top = view.top + 90;
    let now = "";
    for (const h of outline) {
      const el = document.getElementById(h.id);
      if (el && el.getBoundingClientRect().top <= top) now = h.id;
    }
    // at the end of the page the last headings never reach the top: the one clicked (or the last in view) is the one
    if (box.scrollTop + box.clientHeight >= box.scrollHeight - 2) {
      const seen = outline.filter((h) => { const el = document.getElementById(h.id); return el && el.getBoundingClientRect().top < view.bottom; });
      now = seen.some((h) => h.id === picked.current) ? picked.current : seen[seen.length - 1]?.id ?? now;
    }
    setAt(now);
  };
  const jump = (heading: string) => {
    picked.current = heading;
    setAt(heading);
    document.getElementById(heading)?.scrollIntoView({ block: "start", behavior: scrollBehavior() });
  };
  const searchKey = keyLabel("search");

  return (
    <section className="wiki" aria-label={t`Wiki`} style={{ ["--wiki-nav" as any]: String(share) }}>
      <nav className="wiki-nav" aria-label={t`Guides`}>
        <div className="lib-search wiki-search">
          <input type="search" placeholder={t`Search the guides`} value={query} aria-label={t`Search the guides`} onChange={(e) => setQuery(e.target.value)}
            data-tip={t`Lists the guides that have every word`}
            data-tip-more={searchKey ? t({ message: `${searchKey} finds words on the open page`, comment: "searchKey is the key of the Search command, such as Ctrl+F." }) : undefined}
            onKeyDown={(e) => {
              if (e.key === "Escape") { if (query) setQuery(""); else e.currentTarget.blur(); }
              else if (e.key === "Enter" && groups.length) openFound(groups[0].pages[0].id);
              else if (e.key === "Enter" && faqFound) openFound(FAQ!.id);
            }} />
        </div>
        <div className="wiki-list">
          {!UTILS && (!words.length || words.every((w) => TUTORIAL_WORDS.includes(w))) && (
            <button className={`wiki-faq wiki-tut${tutorials ? " active" : ""}`} aria-current={tutorials ? "page" : undefined}
              onClick={() => nav.go("wiki", TUTORIALS_PAGE)} data-tip={t`Walkthroughs in the app that show where to click, one step at a time`} data-tip-side="right">
              <span className="wiki-faq-mark" aria-hidden><PlayMarkIcon /></span>
              <b className="wiki-faq-text"><Trans>Interactive Tutorials</Trans></b>
            </button>
          )}
          {FAQ && faqFound && (
            <button className={`wiki-faq${FAQ.id === page.id ? " active" : ""}`} aria-current={FAQ.id === page.id ? "page" : undefined}
              onClick={() => openFound(FAQ.id)} data-tip={FAQ.summary} data-tip-side="right">
              <span className="wiki-faq-mark" aria-hidden>?</span>
              <b className="wiki-faq-text">{FAQ.title}</b>
            </button>
          )}
          {groups.map((g) => (
            <div key={g.name} className="wiki-group">
              <h2>{g.name}</h2>
              {g.pages.map((p) => (
                <button key={p.id} className={`wiki-link${p.id === page.id && !tutorials ? " active" : ""}`} aria-current={p.id === page.id && !tutorials ? "page" : undefined}
                  onClick={() => openFound(p.id)} data-tip={p.summary} data-tip-side="right">{p.title}</button>
              ))}
            </div>
          ))}
          {!groups.length && !faqFound && <p className="empty-note"><Trans>No guide mentions “{query}”.</Trans></p>}
        </div>
      </nav>
      <Splitter fraction width={share} onResize={setShare} initial={NAV_SHARE} panel="left" label={t`Resize the list of guides`} cssVar="--wiki-nav" />
      <div className={`wiki-read${find ? " finding" : ""}`} ref={reader} onScroll={follow}>
        {find && <FindBar article={article} reader={reader} page={page.id} open={find} onClose={() => setFind(null)} />}
        {tutorials ? <div className="wiki-cols"><TutorialsPage /></div> : <div className="wiki-cols">
          <article className="wiki-article view-in" key={page.id} ref={article}>
            <header className="page-head">
              <h1>{page.title}</h1>
              {page.summary && <p className="page-lead">{page.summary}</p>}
            </header>
            <Markdown tokens={page.tokens} images={wikiPicture} />
            <footer className="wiki-foot">
              {step(-1) ? <button className="wiki-step" onClick={() => nav.go("wiki", step(-1)!.id)}><small>{t({ message: "Previous", context: "Wiki page" })}</small>{step(-1)!.title}</button> : <span />}
              {step(1) && <button className="wiki-step next" onClick={() => nav.go("wiki", step(1)!.id)}><small>{t({ message: "Next", context: "Wiki page" })}</small>{step(1)!.title}</button>}
            </footer>
          </article>
          {outline.length > 1 && (
            <aside className="wiki-outline" aria-label={t`On this page`}>
              <h2><Trans>On this page</Trans></h2>
              {outline.map((h) => (
                <button key={h.id} className={`${h.depth === 3 ? "sub" : ""}${at === h.id ? " active" : ""}`} onClick={() => jump(h.id)}>{h.text}</button>
              ))}
            </aside>
          )}
        </div>}
      </div>
    </section>
  );
}

/** Find on the page (Ctrl+F, or the Search key): every match of the words typed is marked on the page, the current one
    in the primary colour (CSS highlights, so the page itself doesn't change). Enter and Shift+Enter, or ↓ and ↑, step
    through them; Esc or ✕ closes. On another page the same words are searched again. */
function FindBar({ article, reader, page, open, onClose }: {
  article: React.RefObject<HTMLElement | null>; reader: React.RefObject<HTMLDivElement | null>; page: string;
  open: { n: number; text?: string; quiet?: boolean }; onClose: () => void;
}) {
  const [query, setQuery] = useState(open.text ?? "");
  const [matches, setMatches] = useState<Range[]>([]);
  const [now, setNow] = useState(0);
  const box = useRef<HTMLInputElement>(null);
  const shownPage = useRef(page);
  // each Ctrl+F goes back to the box, with the words selected on the page if there were some
  useEffect(() => {
    if (open.text) setQuery(open.text);
    if (!open.quiet) requestAnimationFrame(() => { box.current?.focus(); box.current?.select(); });
  }, [open.n]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const root = article.current, words = query.replace(/\s+/g, " ").toLowerCase();
    const found = root && words.trim() ? findRanges(root, words) : [];
    setMatches(found);
    // typing goes to the first match from where the page is read; another page starts at the top
    const top = (reader.current?.getBoundingClientRect().top ?? 0) + 60;
    const from = shownPage.current === page ? found.findIndex((r) => r.getBoundingClientRect().bottom > top) : 0;
    shownPage.current = page;
    setNow(Math.max(0, from));
  }, [query, page]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const marks = CSS.highlights;
    if (!marks) return;
    if (matches.length) {
      marks.set("wiki-find", new Highlight(...matches));
      marks.set("wiki-find-now", new Highlight(matches[now]));
    } else {
      marks.delete("wiki-find"); marks.delete("wiki-find-now");
    }
    // the current match in sight, below the bar
    const r = matches[now], view = reader.current;
    if (!r || !view) return;
    const at = r.getBoundingClientRect(), frame = view.getBoundingClientRect();
    if (at.top < frame.top + 64 || at.bottom > frame.bottom - 24) {
      view.scrollTo({ top: view.scrollTop + at.top - frame.top - frame.height / 3, behavior: scrollBehavior() });
    }
  }, [matches, now]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { CSS.highlights?.delete("wiki-find"); CSS.highlights?.delete("wiki-find-now"); }, []);
  const step = (by: number) => { if (matches.length) setNow((i) => (i + by + matches.length) % matches.length); };
  const current = now + 1, total = matches.length;
  const count = total ? t({ message: `${current} of ${total}`, comment: "In the find bar, the number of the match shown and how many matches there are." })
    : query.trim() ? t`No matches` : "";
  return (
    <div className="wiki-find-dock">
      <div className="wiki-find" role="search" aria-label={t`Find on this page`}>
        <SearchIcon />
        <input ref={box} type="text" value={query} placeholder={t`Find on this page`} aria-label={t`Find on this page`} spellCheck={false}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); step(e.shiftKey ? -1 : 1); }
            else if (e.key === "Escape") { e.preventDefault(); onClose(); }
          }} />
        <span className="wiki-find-count" aria-live="polite">{count}</span>
        <button className="x" onClick={() => step(-1)} disabled={!matches.length} aria-label={t`Previous match`} data-tip={t`Previous match`} data-tip-more="Shift+Enter"><UpIcon /></button>
        <button className="x" onClick={() => step(1)} disabled={!matches.length} aria-label={t`Next match`} data-tip={t`Next match`} data-tip-more="Enter"><DownIcon /></button>
        <button className="x" onClick={onClose} aria-label={t`Close`} data-tip={t`Close`} data-tip-more="Esc">✕</button>
      </div>
    </div>
  );
}

/** The ranges of a page's text where `words` (lower case, single spaces) are: the text of every element in a row, so a
    match can run through bold words or a link, but not from one paragraph into the next. Previous/Next aren't searched. */
function findRanges(root: HTMLElement, words: string): Range[] {
  const nodes: { node: Text; at: number }[] = [];
  let text = "", block: Element | null = null;
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT,
    { acceptNode: (n) => (n.parentElement?.closest(".wiki-foot") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const t = n as Text, b = t.parentElement?.closest("p, li, h1, h2, h3, h4, td, th, pre, blockquote, aside, header, div") ?? null;
    if (b !== block && text) text += "\0"; // a new block: nothing matches across it
    block = b;
    nodes.push({ node: t, at: text.length });
    text += t.data;
  }
  const hay = text.toLowerCase().replace(/\s/g, " ");
  const place = (i: number) => { // the text node holding character i
    let lo = 0, hi = nodes.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (nodes[mid].at <= i) lo = mid; else hi = mid - 1; }
    return nodes[lo];
  };
  const out: Range[] = [];
  for (let i = hay.indexOf(words); i >= 0 && out.length < 2000; i = hay.indexOf(words, i + words.length)) {
    const a = place(i), b = place(i + words.length - 1), r = document.createRange();
    r.setStart(a.node, i - a.at);
    r.setEnd(b.node, i + words.length - b.at);
    out.push(r);
  }
  return out;
}

/** Words that open a Wiki page: what the app explains at length, it explains there. */
export function WikiLink({ page, about, children }: { page: string; about: string; children: React.ReactNode }) {
  return <button className="link-text" onClick={() => nav.go("wiki", page)}
    data-tip={t({ message: `${about}: open the Wiki`, comment: "Tooltip of words that open a Wiki page. about is the subject of the page." })}>{children}</button>;
}

/** A "?" that holds a description, so the screen doesn't have to: hovering (or focusing) it shows `tip`, and a click
    opens `page` (a Wiki page, or "page#heading" for the section on it) for the long version. Every "?" has one. */
export function Help({ tip, page }: { tip: string; page: string }) {
  // inside a label, a click on the "?" must not tick the checkbox or focus the field the label is for
  return (
    <button className="wiki-q" onClick={(e) => { e.preventDefault(); e.stopPropagation(); nav.go("wiki", page); }} aria-label={t`${tip} Open the Wiki section.`}
      data-tip={tip} data-tip-more={t`Click for the Wiki section`} data-tip-always>?</button>
  );
}
