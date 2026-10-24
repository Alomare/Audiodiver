import { useEffect, useMemo, useRef, useState } from "react";
import { WIKI as ALL_PAGES, WIKI_GROUPS, wikiPicture } from "./content";
import { UTILS, UTILS_WIKI } from "./edition";
import { Markdown } from "./Markdown";
import { nav, useNav } from "./nav";
import { Splitter, useStoredWidth } from "./Resize";
import { scrollBehavior } from "./theme";

const NAV_WIDTH = 270;
/** The pages the list shows and Previous/Next step through: Audiodiver Utils lists only its own (a link still opens
    any page). */
const WIKI = UTILS ? ALL_PAGES.filter((p) => UTILS_WIKI.has(p.id)) : ALL_PAGES;

/** The Wiki tab: guides, resources and good practice for making audio mods. Pages are Markdown files in src/wiki
    (see content.ts for how one is laid out); the list on the left, the page in the middle, its headings on the right. */
export function Wiki() {
  const { wiki: id, anchor } = useNav(); // anchor: a heading a link to part of the page names
  const [query, setQuery] = useState("");
  const [width, setWidth] = useStoredWidth("audiodiver.wikiWidth", NAV_WIDTH);
  const [at, setAt] = useState(""); // the heading being read, for the outline
  const reader = useRef<HTMLDivElement>(null);
  const picked = useRef(""); // the heading last clicked in the outline
  const page = ALL_PAGES.find((p) => p.id === id) ?? WIKI[0];
  const index = WIKI.indexOf(page);

  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const found = useMemo(() => new Set(WIKI.filter((p) => {
    const hay = `${p.title} ${p.group} ${p.summary} ${p.text}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  }).map((p) => p.id)), [query]); // eslint-disable-line react-hooks/exhaustive-deps
  const groups = WIKI_GROUPS.map((g) => ({ ...g, pages: g.pages.filter((p) => found.has(p.id)) })).filter((g) => g.pages.length);
  const step = (by: number) => (index >= 0 ? WIKI[index + by] : undefined);

  // another page starts at its top, or at the heading a link names (once: then the page is where the reader leaves it)
  const shown = useRef<string | null>(null);
  useEffect(() => {
    const el = anchor ? document.getElementById(anchor) : null;
    if (el) { picked.current = anchor; setAt(anchor); el.scrollIntoView({ block: "start" }); nav.landed(); }
    else if (shown.current !== page?.id) { reader.current?.scrollTo({ top: 0 }); setAt(""); }
    shown.current = page?.id ?? null;
  }, [page?.id, anchor]);

  if (!page) return <section className="wiki"><p className="empty-note">No guides yet.</p></section>;

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

  return (
    <section className="wiki" aria-label="Wiki" style={{ ["--wiki-nav" as any]: `${width}px` }}>
      <nav className="wiki-nav" aria-label="Guides">
        <div className="lib-search wiki-search">
          <input type="search" placeholder="Search the guides" value={query} aria-label="Search the guides" onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") { if (query) setQuery(""); else e.currentTarget.blur(); }
              else if (e.key === "Enter" && groups.length) nav.go("wiki", groups[0].pages[0].id);
            }} />
        </div>
        <div className="wiki-list">
          {groups.map((g) => (
            <div key={g.name} className="wiki-group">
              <h2>{g.name}</h2>
              {g.pages.map((p) => (
                <button key={p.id} className={`wiki-link${p.id === page.id ? " active" : ""}`} aria-current={p.id === page.id ? "page" : undefined}
                  onClick={() => nav.go("wiki", p.id)} data-tip={p.summary} data-tip-side="right">{p.title}</button>
              ))}
            </div>
          ))}
          {!groups.length && <p className="empty-note">No guide mentions “{query}”.</p>}
        </div>
      </nav>
      <Splitter width={width} onResize={setWidth} initial={NAV_WIDTH} panel="left" label="Resize the list of guides" cssVar="--wiki-nav" />
      <div className="wiki-read" ref={reader} onScroll={follow}>
        <div className="wiki-cols">
          <article className="wiki-article view-in" key={page.id}>
            <header className="page-head">
              <h1>{page.title}</h1>
              {page.summary && <p className="page-lead">{page.summary}</p>}
            </header>
            <Markdown tokens={page.tokens} images={wikiPicture} />
            <footer className="wiki-foot">
              {step(-1) ? <button className="wiki-step" onClick={() => nav.go("wiki", step(-1)!.id)}><small>Previous</small>{step(-1)!.title}</button> : <span />}
              {step(1) && <button className="wiki-step next" onClick={() => nav.go("wiki", step(1)!.id)}><small>Next</small>{step(1)!.title}</button>}
            </footer>
          </article>
          {outline.length > 1 && (
            <aside className="wiki-outline" aria-label="On this page">
              <h2>On this page</h2>
              {outline.map((h) => (
                <button key={h.id} className={`${h.depth === 3 ? "sub" : ""}${at === h.id ? " active" : ""}`} onClick={() => jump(h.id)}>{h.text}</button>
              ))}
            </aside>
          )}
        </div>
      </div>
    </section>
  );
}

/** Words that open a Wiki page: what the app explains at length, it explains there. */
export function WikiLink({ page, about, children }: { page: string; about: string; children: React.ReactNode }) {
  return <button className="link-text" onClick={() => nav.go("wiki", page)} data-tip={`${about}: open the Wiki`}>{children}</button>;
}

/** A "?" that holds a description, so the screen doesn't have to: hovering (or focusing) it shows `tip`, and a click
    opens `page` (a Wiki page, or "page#heading" for the section on it) for the long version. Every "?" has one. */
export function Help({ tip, page }: { tip: string; page: string }) {
  // inside a label, a click on the "?" must not tick the checkbox or focus the field the label is for
  return (
    <button className="wiki-q" onClick={(e) => { e.preventDefault(); e.stopPropagation(); nav.go("wiki", page); }} aria-label={`${tip} Open the Wiki section.`}
      data-tip={tip} data-tip-more="Click for the Wiki section" data-tip-always>?</button>
  );
}
