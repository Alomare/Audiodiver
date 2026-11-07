import { ph, plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { andList, call, fmtNumber, type ProjectState, type SaidBy, type TextGroup, type TextLine } from "./api";
import { Mark } from "./IndexTree";
import { chordOf, keymap } from "./keys";
import { useListWindow, type WindowLine } from "./listWindow";
import { nav } from "./nav";
import { copyText } from "./platform";
import { Splitter } from "./Resize";
import { RESET_LAYOUT } from "./settings";
import { useEditor } from "./store";
import { TextPreview } from "./TextPreview";
import { readTextFile, TextExport, TextImport, TextReplace, type ImportRead, type Scope } from "./TextTools";
import { Help, WikiLink } from "./Wiki";

/** The Text tab: the game's text in every language (subtitles, menus, names, everything), sorted into categories
    (core textsort.py), to find a line and change it: words, colours, sizes. The project keeps the lines it changes; a
    build carries their whole tables (core: strings.py, editor.py text_*). */
type Lang = { code: string; name: string };
type Found = { results: TextLine[]; total: number };
/** The names of the game's text languages (core strings.LANGUAGES), by code, in the window's language; a code
    missing here shows the core's name. */
const LANG_NAMES: Record<string, string> = {
  us: t`English (US)`, gb: t`English (UK)`, fr: t`French`, de: t`German`, it: t`Italian`,
  es: t`Spanish (Spain)`, ms: t`Spanish (Latin America)`, pt: t`Portuguese`, bp: t`Portuguese (Brazil)`,
  pl: t`Polish`, ru: t`Russian`, nl: t`Dutch`, jp: t`Japanese`, ko: t`Korean`,
  cn: t`Chinese (Simplified)`, tc: t`Chinese (Traditional)`,
};

/** Lines another tab asks to show (a voice line's subtitle, or the subtitles with its words): the list holds just
    them, `pick` open, until the search or the filter changes; in `lang`, the voice's language, where given. */
export type Shown = { ids: number[]; pick: number; note: string; lang?: string };
let asked: Shown | null = null;
const askers = new Set<(s: Shown) => void>();
export function showLines(s: Shown) {
  asked = s;
  askers.forEach((f) => f(s));
  nav.go("text");
}

const LANG_KEY = "audiodiver.textLanguage";
const WIDTH_KEY = "audiodiver.textLeft";
const REF_KEY = "audiodiver.textReference";
const OPEN_KEY = "audiodiver.textOpen";
const TIMING = /\{(\d+(?:\.\d+)?)->(\d+(?:\.\d+)?)\}/g;
const MARKUP = /<\/?[cifs](?:=[^>]*)?>/g;
/** The words of a line, without its timing and markup: for the list. */
export const plainText = (t: string) => t.replace(TIMING, " ").replace(MARKUP, "").replace(/\s+/g, " ").trim();

/** A line of the list: a category's or section's head that folds, or a line of the game's text. */
type ListLine = WindowLine & (
  | { kind: "cat" | "sec"; name: string; open: boolean; ids: number[]; changed: number }
  | { kind: "row"; line: TextLine; deep: boolean });
type Panel = { kind: "export" | "replace"; start: string } | { kind: "import"; read: ImportRead } | null;

export function TextTab({ hidden }: { hidden?: boolean }) {
  const { project, actions, quick, notify } = useEditor();
  const [langs, setLangs] = useState<Lang[]>([]);
  const [lang, setLang] = useState(() => { try { return asked?.lang ?? localStorage.getItem(LANG_KEY) ?? "us"; } catch { return "us"; } });
  const [reference, setReference] = useState(() => { try { return localStorage.getItem(REF_KEY) ?? ""; } catch { return ""; } });
  const [query, setQuery] = useState("");
  const [mine, setMine] = useState(false);
  const [data, setData] = useState<{ groups: TextGroup[]; lines: TextLine[] } | null>(null);
  const [error, setError] = useState("");
  const [only, setOnly] = useState<Shown | null>(asked);
  const [pick, setPick] = useState<{ table: string; id: number } | null>(asked && { table: "", id: asked.pick });
  const [open, setOpen] = useState<Record<string, boolean>>(() => { try { return JSON.parse(localStorage.getItem(OPEN_KEY) ?? "{}"); } catch { return {}; } });
  const [ticked, setTicked] = useState<ReadonlySet<number>>(new Set());
  const [panel, setPanel] = useState<Panel>(null);
  const anchor = useRef<number | null>(null); // the tick a Shift+click runs from
  useEffect(() => {
    const show = (s: Shown) => { setOnly(s); setQuery(""); setMine(false); setPick({ table: "", id: s.pick }); if (s.lang) setLang(s.lang); };
    askers.add(show);
    return () => { askers.delete(show); };
  }, []);
  useEffect(() => { asked = only; }, [only]);
  const [width, setWidth] = useState(() => { try { return Number(localStorage.getItem(WIDTH_KEY)) || 480; } catch { return 480; } });
  useEffect(() => { try { localStorage.setItem(WIDTH_KEY, String(width)); } catch { /* storage off */ } }, [width]);
  useEffect(() => {
    const reset = () => setWidth(480);
    window.addEventListener(RESET_LAYOUT, reset);
    return () => window.removeEventListener(RESET_LAYOUT, reset);
  }, []);
  useEffect(() => { try { localStorage.setItem(LANG_KEY, lang); } catch { /* storage off */ } setTicked(new Set()); }, [lang]);
  useEffect(() => { try { localStorage.setItem(REF_KEY, reference); } catch { /* storage off */ } }, [reference]);
  useEffect(() => { try { localStorage.setItem(OPEN_KEY, JSON.stringify(open)); } catch { /* storage off */ } }, [open]);
  useEffect(() => { call<Lang[]>("text_languages").then(setLangs).catch((e) => setError(e.message)); }, []);
  // a language the game's text doesn't come in (a voice's, from a link): US English
  useEffect(() => { if (langs.length && !langs.some((l) => l.code === lang)) setLang("us"); }, [langs, lang]);

  const yours = project?.texts ?? [];
  const edits = useMemo(() => JSON.stringify(yours), [yours]);
  // every line of the language, or what the search finds; only drawn once the tab shows. An edit doesn't ask again:
  // its new text comes from the project
  useEffect(() => {
    if (hidden && !data) return;
    let live = true;
    const later = setTimeout(() => {
      call<{ groups: TextGroup[]; lines: TextLine[] }>("text_lines", { language: lang, query, reference: reference && reference !== lang ? reference : null })
        .then((f) => { if (live) { setData(f); setError(""); } })
        .catch((e) => live && setError(e.message));
    }, query.trim() ? 220 : 0);
    return () => { live = false; clearTimeout(later); };
  }, [lang, query, reference, hidden]); // eslint-disable-line react-hooks/exhaustive-deps
  const lines = useMemo(() => {
    const mineNow = new Map(yours.map((y) => [`${y.table}:${y.id}`, y]));
    return (data?.lines ?? []).map((l) => {
      const y = mineNow.get(`${l.table}:${l.id}`);
      return y ? { ...l, yours: y.text, was: y.was } : l;
    });
  }, [data, edits]); // eslint-disable-line react-hooks/exhaustive-deps
  const byId = useMemo(() => new Map(lines.map((l) => [l.id, l])), [lines]);
  const changedIds = useMemo(() => lines.filter((l) => l.yours !== undefined).map((l) => l.id), [lines]);
  const shown = useMemo(() => (only ? only.ids.flatMap((i) => byId.get(i) ?? []) : mine ? lines.filter((l) => l.yours !== undefined) : lines), [only, mine, lines, byId]);
  const words = query.trim();

  const list = useMemo<ListLine[]>(() => {
    if (only) return shown.map((line) => ({ key: `l:${line.id}`, kind: "row", line, deep: false }));
    const out: ListLine[] = [];
    const within = new Map<string, TextLine[]>();
    for (const l of shown) {
      const k = `${l.cat}/${l.sec}`;
      const at = within.get(k);
      if (at) at.push(l); else within.set(k, [l]);
    }
    const all = !!words || mine; // a search or the changed lines show open
    const head = (kind: "cat" | "sec", key: string, name: string, of: TextLine[]): ListLine => ({
      key, kind, name, open: all || !!open[key], ids: of.map((l) => l.id), changed: of.filter((l) => l.yours !== undefined).length });
    for (const g of data?.groups ?? []) {
      const parts = g.sections.map((s) => ({ s, of: within.get(`${g.id}/${s.id}`) ?? [] })).filter((p) => p.of.length);
      if (!parts.length) continue;
      const cat = head("cat", `c:${g.id}`, g.name, parts.flatMap((p) => p.of));
      out.push(cat);
      if (cat.kind === "cat" && !cat.open) continue;
      for (const { s, of } of parts) {
        const sec = parts.length > 1 ? head("sec", `s:${g.id}/${s.id}`, s.name, of) : null;
        if (sec) out.push(sec);
        if (!sec || (sec.kind === "sec" && sec.open)) for (const line of of) out.push({ key: `l:${line.id}`, kind: "row", line, deep: true });
      }
    }
    return out;
  }, [only, shown, data, open, words, mine]);
  const rowIds = useMemo(() => list.flatMap((x) => (x.kind === "row" ? [x.line.id] : [])), [list]);

  const box = useRef<HTMLDivElement>(null);
  const win = useListWindow(box, list, true, (key) => box.current?.querySelector(`[data-key="${key}"]`));
  useEffect(() => { if (only) win.reveal(`l:${only.pick}`, { block: "center" }); }, [only, data]); // eslint-disable-line react-hooks/exhaustive-deps

  // the open line: from the list, or (after the search changed) asked for by its id, which every language shares
  const [extra, setExtra] = useState<TextLine | null>(null);
  const listed = (pick && byId.get(pick.id)) ?? null;
  const line = listed ?? (extra && pick && extra.id === pick.id ? extra : null);
  useEffect(() => {
    if (!pick || listed) { setExtra(null); return; }
    let live = true;
    call<Found>("text_search", { language: lang, query: String(pick.id), limit: 5 }).then((f) => {
      const r = f.results.find((x) => x.id === pick.id);
      if (live) setExtra(r ?? null);
      if (live && r) setPick({ table: r.table, id: r.id });
    }).catch(() => {});
    return () => { live = false; };
  }, [lang, pick?.id, listed, edits]); // eslint-disable-line react-hooks/exhaustive-deps
  // "Changed (n)": the lines changed in this language (the project may change others in other languages)
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!project || !yours.length) { setCount(0); return; }
    let live = true;
    call<Found>("text_search", { language: lang, mine: true, limit: 0 }).then((f) => { if (live) setCount(f.total); }).catch(() => {});
    return () => { live = false; };
  }, [lang, edits, project?.path]); // eslint-disable-line react-hooks/exhaustive-deps
  /** ↓ from the search box goes into the list; ↑ ↓ move along it; ↑ from the first line goes back to the box. */
  const listKeys = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const rows = [...(e.currentTarget.closest(".library")?.querySelectorAll<HTMLButtonElement>(".tx-row") ?? [])];
    const at = rows.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === "ArrowDown" ? at + 1 : at - 1;
    e.preventDefault();
    if (next < 0) (e.currentTarget.closest(".library")?.querySelector<HTMLInputElement>("input[type=search]"))?.focus();
    else rows[Math.min(next, rows.length - 1)]?.focus();
  };
  /** A line's tick: Shift+click reaches from the last one ticked, in list order. */
  const tick = (id: number, shift: boolean) => {
    const from = shift && anchor.current !== null ? rowIds.indexOf(anchor.current) : -1;
    const to = rowIds.indexOf(id);
    const these = from >= 0 && to >= 0 ? rowIds.slice(Math.min(from, to), Math.max(from, to) + 1) : [id];
    const on = !ticked.has(id);
    setTicked((was) => { const next = new Set(was); for (const i of these) { if (on) next.add(i); else next.delete(i); } return next; });
    anchor.current = id;
  };
  const tickAll = (ids: number[]) => setTicked((was) => {
    const next = new Set(was), on = !ids.every((i) => was.has(i));
    for (const i of ids) { if (on) next.add(i); else next.delete(i); }
    return next;
  });
  const tickedIds = useMemo(() => [...ticked].filter((i) => byId.has(i)), [ticked, byId]);
  const restorable = tickedIds.flatMap((i) => { const l = byId.get(i)!; return l.yours !== undefined ? [{ table: l.table, id: l.id }] : []; });
  const restore = async () => {
    const n = restorable.length;
    if (await actions.revertText(restorable)) {
      quick(plural(n, { one: "Restored # line", other: "Restored # lines" }), "undo");
      setTicked(new Set());
    }
  };
  // what the panels can work on, the likeliest first
  const filtered = !!words || mine || !!only;
  const scopes = useMemo<Scope[]>(() => [
    ...(tickedIds.length ? [{ id: "ticked", name: t`Selected lines`, ids: tickedIds }] : []),
    { id: "changed", name: t({ message: "Changed lines", comment: "Lines a panel of the Text tab works on: the ones the project changes" }), ids: changedIds },
    filtered ? { id: "shown", name: t`Lines shown`, ids: shown.map((l) => l.id) } : { id: "all", name: t`All lines`, ids: lines.map((l) => l.id) },
    ...(data?.groups ?? []).map((g) => ({ id: `c:${g.id}`, name: g.name, ids: lines.filter((l) => l.cat === g.id).map((l) => l.id) })),
  ], [tickedIds, changedIds, filtered, shown, lines, data]);
  const opening = tickedIds.length ? "ticked" : filtered ? "shown" : "all";
  const named = (l: Lang) => LANG_NAMES[l.code] ?? l.name;
  const importing = async () => {
    const read = await readTextFile(notify);
    if (read) setPanel({ kind: "import", read });
  };
  const picked = tickedIds.length;
  const noProject = t`Open a project to change lines`;
  // what a row does, the same object in every render: a row draws again only when its own line changes
  const acts = useRef({ tick, pick: setPick });
  acts.current = { tick, pick: setPick };
  const rowActs = useMemo(() => ({ tick: (id: number, shift: boolean) => acts.current.tick(id, shift), pick: (l: TextLine) => acts.current.pick({ table: l.table, id: l.id }) }), []);
  return (
    <div className="panes two text-tab" hidden={hidden} style={{ ["--left" as any]: `${width}px` }}>
      <aside className="library" aria-label={t`Lines`} onKeyDown={listKeys}>
        <div className="lib-search">
          <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label={t`Language`} data-tip={t`The language to show and change`}
            data-tip-more={t`Each language is a separate table, and a change in one doesn't change the others`}>
            {(langs.length ? langs : [{ code: lang, name: lang }]).map((l) => <option key={l.code} value={l.code}>{named(l)}</option>)}
          </select>
          <input type="search" placeholder={t`Search, or paste an ID`} value={query} onChange={(e) => { setOnly(null); setQuery(e.target.value); }}
            aria-label={t`Search lines`} data-tip={t`Words in this language, or a line ID`} data-tip-side="bottom"
            onKeyDown={(e) => { if (e.key === "Escape") setQuery(""); }} />
        </div>
        <div className="mus-filters">
          <div className="segmented mus-filter" role="radiogroup" aria-label={t({ message: "Show", comment: "Which lines the list shows: all of them, or the changed ones" })}>
            <button role="radio" aria-checked={!mine} className={!mine ? "on" : ""} onClick={() => { setOnly(null); setMine(false); }}><Trans>All Lines</Trans></button>
            <button role="radio" aria-checked={mine} className={mine ? "on" : ""} disabled={!project} onClick={() => { setOnly(null); setMine(true); }}
              data-tip={project ? t`Only the lines the project changes in this language` : noProject}>
              {count ? t({ message: `Changed (${count})`, context: "Filter of the Text tab: the lines the project changes" })
                : t({ message: "Changed", context: "Filter of the Text tab: the lines the project changes" })}</button>
          </div>
        </div>
        <div className="tx-tools">
          <button className="btn small-btn" disabled={!lines.length} onClick={() => setPanel({ kind: "export", start: opening })}
            data-tip={t`Save lines to a CSV or JSON file`}><Trans comment="Button of the Text tab: saves lines to a file">Export</Trans></button>
          <button className="btn small-btn" disabled={!project} onClick={importing}
            data-tip={project ? t`Bring back the new text of an exported file` : noProject} data-tip-more={project ? t`Shows what changes first` : undefined}>
            <Trans comment="Button of the Text tab: brings lines back from a file">Import</Trans></button>
          <button className="btn small-btn" disabled={!project || !lines.length} onClick={() => setPanel({ kind: "replace", start: opening })}
            data-tip={project ? t`Change words in many lines at once` : noProject} data-tip-more={project ? t`Shows what changes first` : undefined}><Trans>Find and Replace</Trans></button>
          <select value={reference} onChange={(e) => setReference(e.target.value)} aria-label={t`Second language`}
            data-tip={t`Another language to read beside the line`}>
            <option value=""><Trans comment="No second language beside the line">No Second Language</Trans></option>
            {langs.filter((l) => l.code !== lang).map((l) => <option key={l.code} value={l.code}>{named(l)}</option>)}
          </select>
        </div>
        {picked > 0 && (
          <div className="tx-tools">
            <span className="tx-picked">{plural(picked, { one: "# line selected", other: "# lines selected" })}</span>
            <span className="spacer" />
            {restorable.length > 0 && <button className="btn small-btn" onClick={restore}><Trans>Restore Original</Trans></button>}
            <button className="btn quiet small-btn" onClick={() => setTicked(new Set())}><Trans comment="Button of the Text tab: unticks the selected lines">Clear</Trans></button>
          </div>
        )}
        <div className="lib-tree tx-list" ref={box}>
          {only && (
            <div className="tx-only">
              <span>{only.note}</span>
              <button className="x" aria-label={t`Show all lines`} data-tip={t`Show all lines`} onClick={() => setOnly(null)}>✕</button>
            </div>
          )}
          {error && <p className="empty-note">{error}</p>}
          {data && !list.length && <p className="empty-note tx-none">{mine
            ? words ? t`No changed line has “${words}”.` : t`No line changed in this language yet.`
            : t`No line has “${words}”.`}</p>}
          <div ref={win.gap.top} style={{ height: win.before }} aria-hidden />
          {list.slice(win.first, win.last).map((x) => (x.kind === "row" ? (
            <TextRow key={x.key} rowKey={x.key} line={x.line} deep={x.deep} ticked={ticked.has(x.line.id)} active={line?.id === x.line.id} on={rowActs} />
          ) : (
            <div key={x.key} data-key={x.key} className={`tx-line head${x.kind === "sec" ? " sub" : ""}`}>
              <input type="checkbox" className="slot-check" tabIndex={-1} aria-label={t`Select everything in ${x.name}`}
                checked={x.ids.every((i) => ticked.has(i))} readOnly onClick={() => tickAll(x.ids)}
                ref={(el) => { if (el) el.indeterminate = x.ids.some((i) => ticked.has(i)) && !x.ids.every((i) => ticked.has(i)); }} />
              <button className={`lib-group-head${x.kind === "sec" ? " sub" : ""}`} aria-expanded={x.open} onClick={() => setOpen((o) => ({ ...o, [x.key]: !x.open }))}>
                <span className="caret" aria-hidden>▸</span>
                <span className="lib-group-name">{x.name}</span>
                {x.changed > 0 && <Mark status="done" label={t`Changed`} />}
                <span className="tx-n">{fmtNumber(x.ids.length)}</span>
              </button>
            </div>
          )))}
          <div ref={win.gap.end} style={{ height: win.after }} aria-hidden />
        </div>
      </aside>
      <Splitter width={width} onResize={setWidth} initial={480} panel="left" label={t`Resize the list`} />
      <main className="center">
        {line ? <LineEditor key={`${line.table}:${line.id}`} line={line} lang={lang} canEdit={!!project}
          reference={reference && reference !== lang ? named(langs.find((l) => l.code === reference) ?? { code: reference, name: reference }) : ""}
          onSave={(t) => actions.setText(line.table, line.id, t)}
          onRevert={async () => { if (await actions.revertText([{ table: line.table, id: line.id }])) quick(t`Original restored`, "undo"); }} />
          : (
            <section className="cue empty">
              <div className="empty-card">
                <p><Trans>Open a category or search for a line to change words, colours or size.</Trans>
                  {project ? <> <Trans>Changes go into <b>{ph({ project: project.name })}</b>.</Trans></>
                    : <> <Trans>Open or create a project on <button className="link-text" onClick={() => nav.go("home")}>Home</button> to change lines.</Trans></>}</p>
                <p><WikiLink page="text" about={t`Changing text`}><Trans>How changing text works</Trans></WikiLink></p>
              </div>
            </section>
          )}
      </main>
      {panel?.kind === "export" && <TextExport scopes={scopes} start={panel.start} lang={{ code: lang, name: named(langs.find((l) => l.code === lang) ?? { code: lang, name: lang }) }}
        langs={langs.map((l) => ({ code: l.code, name: named(l) }))} onClose={() => setPanel(null)} />}
      {panel?.kind === "import" && <TextImport read={panel.read} onClose={() => setPanel(null)} />}
      {panel?.kind === "replace" && <TextReplace scopes={scopes.filter((s) => s.id !== "changed" || s.ids.length)} start={panel.start} lang={lang} onClose={() => setPanel(null)} />}
    </div>
  );
}

const TextRow = memo(function TextRow({ rowKey, line, deep, ticked, active, on }: {
  rowKey: string; line: TextLine; deep: boolean; ticked: boolean; active: boolean;
  on: { tick: (id: number, shift: boolean) => void; pick: (line: TextLine) => void };
}) {
  const words = plainText(line.yours ?? line.text);
  return (
    <div data-key={rowKey} className={`tx-line${deep ? " deep" : ""}`}>
      <input type="checkbox" className="slot-check" checked={ticked} readOnly tabIndex={-1} aria-label={t`Select this line`}
        onClick={(e) => on.tick(line.id, e.shiftKey)} />
      <button className={`tx-row${active ? " active" : ""}`} onClick={() => on.pick(line)}>
        <span className="tx-text" data-tip={words || undefined} data-tip-clip>{words || <i className="muted">{t`(empty)`}</i>}</span>
        {line.yours !== undefined && <Mark status="done" label={t`Changed`} />}
      </button>
    </div>
  );
});

/** One line: the original, the new text (with a formatting bar), and a preview of how the game shows it. */
function LineEditor({ line, lang, canEdit, reference, onSave, onRevert }: {
  line: TextLine; lang: string; canEdit: boolean; reference: string; onSave: (text: string) => Promise<ProjectState | null>; onRevert: () => void;
}) {
  const { actions, quick, project } = useEditor();
  const rev = project?.revision ?? -1;
  // the line as the project has it now (texts holds the project's own lines; else the game's)
  const current = project?.texts.find((t) => String(t.table) === String(line.table) && t.id === line.id)?.text ?? line.text;
  const box = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState(line.yours ?? line.text);
  const [color, setColor] = useState("#FFE900");
  const [hexDraft, setHexDraft] = useState<string | null>(null); // the hex box while it is typed in
  const [size, setSize] = useState(20);
  const [sizeDraft, setSizeDraft] = useState<string | null>(null);
  const saved = useRef(line.yours ?? line.text);
  const timer = useRef(0);
  const [pending, setPending] = useState(false);
  const latest = useRef({ draft, onSave });
  latest.current = { draft, onSave };
  // which project state this box last knew: its own saves' answers (late or early) leave it alone; a change it didn't
  // make (Undo, Redo, Restore the original) is followed, once nothing it typed is on its way
  const own = useRef(rev);
  const inFlight = useRef(0);
  const [answered, setAnswered] = useState(0);
  const send = async (t: string) => {
    const before = saved.current;
    saved.current = t;
    inFlight.current++;
    const p = await onSave(t);
    inFlight.current--;
    if (p) own.current = p.revision;
    else if (saved.current === t) saved.current = before; // refused or lost: not saved, so leaving the box sends it again
    setAnswered((n) => n + 1);
  };
  // typing saves a moment after it stops (each save is one undo step), and at once when the box is left
  const save = (t: string, now = false) => {
    clearTimeout(timer.current);
    const go = () => { setPending(false); if (t !== saved.current) send(t); };
    if (now) go(); else { setPending(true); timer.current = window.setTimeout(go, 700); }
  };
  // leaving the line (another line, another tab, a key that switches tabs) saves what is typed: nothing is lost
  useEffect(() => () => {
    clearTimeout(timer.current);
    const { draft: t, onSave: keep } = latest.current;
    if (t !== saved.current) { saved.current = t; keep(t); }
  }, []);
  useEffect(() => {
    if (pending || inFlight.current > 0 || rev === own.current) return; // typing, or the state its own save left
    own.current = rev;
    if (current !== saved.current || current !== latest.current.draft) { saved.current = current; setDraft(current); }
  }, [rev, answered, pending, current]);
  const edit = (t: string, now = false) => { setDraft(t); save(t, now); };
  /** Ctrl+Z / Ctrl+Y in the box are the project's (each save one step), not the box's own one-letter undo. */
  const projectKeys = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const chord = chordOf(e.nativeEvent);
    const cmd = chord ? keymap.owner(chord) : null;
    if (cmd !== "undo" && cmd !== "redo") return;
    e.preventDefault();
    save(draft, true); // what is typed is a step of its own first; the undo goes after it in the core's queue
    if (cmd === "undo") actions.undo(); else actions.redo();
  };
  /** Puts open and close around the selected words (all of the line, after its timing, when nothing is selected). */
  const wrap = (open: string, close: string) => {
    const el = box.current!;
    let a = el.selectionStart, b = el.selectionEnd;
    if (a === b) { a = draft.match(/^(\{[^}]*\})*/)?.[0].length ?? 0; b = draft.length; }
    edit(draft.slice(0, a) + open + draft.slice(a, b) + close + draft.slice(b), true);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + open.length, b + open.length); });
  };
  const hex = color.replace("#", "").toUpperCase();
  const subtitle = line.kind === "subtitles";
  const changed = draft !== line.text;
  const fills = [...new Set((line.text.match(/#[A-Z][A-Z0-9_]+/g) ?? []))];
  const lost = fills.filter((f) => !draft.includes(f));
  const { id, table } = line;
  return (
    <section className="cue tx-edit" aria-label={t`The line`}>
      <div className="cue-top"><header className="cue-head">
        <div className="head-row"><div className="crumbs">{subtitle ? t`Subtitle · line ${id} · table ${table}` : t`Text · line ${id} · table ${table}`}{" "}
          <Help tip={t`A mod carries whole tables. When two mods change the same table, the one deployed later replaces the other`} page="text#how-text-is-built" /></div>
          <button className="link-text small" onClick={() => copyText(String(line.id), quick, `**${line.id}**`)} data-tip={t`Copy the line ID`}><Trans>Copy ID</Trans></button></div>
        <div className="item-title"><h1>{plainText(line.text).slice(0, 80) || t`(empty)`}</h1>
          {line.yours !== undefined && <span className="item-cov done"><Mark status="done" label={t`Changed`} />{t`Changed`}</span>}</div>
      </header></div>
      <div className="tx-body">
        <div className="field">
          <span className="field-label"><Trans>Original</Trans></span>
          <div className="tx-preview game"><TextPreview text={line.text} /></div>
        </div>
        {reference && (
          <div className="field">
            <span className="field-label">{reference}</span>
            <div className="tx-preview game">{line.ref !== undefined ? <TextPreview text={line.ref} /> : <i className="muted">{t`(empty)`}</i>}</div>
          </div>
        )}
        {subtitle && <VoiceLines id={line.id} lang={lang} />}
        <div className="field">
          <span className="field-label"><Trans>New text</Trans> <Help tip={t`What each format does, with examples`} page="formatting-text#applying-a-format" /></span>
          <div className="tx-bar" role="toolbar" aria-label={t`Formatting`}>
            <label className="tx-color" data-tip={t`The colour that Colour applies`}>
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label={t`Colour`} disabled={!canEdit} />
              <input className="tx-hex" value={hexDraft ?? hex} maxLength={7} aria-label={t`Colour as hex`} disabled={!canEdit} spellCheck={false}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9a-f]/gi, "").slice(0, 6).toUpperCase();
                  setHexDraft(v);
                  if (v.length === 6) setColor(`#${v}`);
                }}
                onBlur={() => setHexDraft(null)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur(); }} />
            </label>
            <button className="btn small-btn" disabled={!canEdit} onClick={() => wrap(`<c=FF${hex}>`, "</c>")}
              data-tip={t`Colour the selection (the whole line when nothing is selected)`}><Trans context="Text tab button: colours the selected words">Colour</Trans></button>
            <input type="number" className="tx-size" min={10} max={60} value={sizeDraft ?? size} disabled={!canEdit} aria-label={t`Size, 10 to 60`}
              data-tip={t`The size that Size applies, from 10 to 60`} data-tip-more={t`The normal size is 20. No game line uses sizes, but chat does`}
              onChange={(e) => setSizeDraft(e.target.value)}
              onBlur={() => { const n = Number(sizeDraft); if (sizeDraft !== null && sizeDraft.trim() !== "" && Number.isFinite(n)) setSize(Math.round(Math.max(10, Math.min(60, n)))); setSizeDraft(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
            <button className="btn small-btn" disabled={!canEdit} onClick={() => wrap(`<s=${String(size).padStart(2, "0")}>`, "</s>")}
              data-tip={t`Size the selection`}><Trans context="Text tab button: sizes the selected words">Size</Trans></button>
            <button className="btn small-btn" disabled={!canEdit} onClick={() => wrap("<i=1>", "</i>")} data-tip={t`The style tips and briefings use for terms`}><Trans>Emphasis</Trans></button>
            {subtitle && (
              <button className="btn small-btn" disabled={!canEdit} data-tip={t`Add a timing mark at the cursor`} data-tip-more={t`When the words after it appear, in seconds from the start of the voice line`}
                onClick={() => { const el = box.current!, at = el.selectionStart; edit(draft.slice(0, at) + "{0.00->2.00}" + draft.slice(at), true); }}>
                <Trans context="Text tab button: adds a timing mark to a subtitle">Timing</Trans></button>
            )}
            <span className="spacer" />
            <button className="btn quiet small-btn" disabled={!canEdit || !MARKUP.test(draft)} onClick={() => edit(draft.replace(MARKUP, ""), true)}
              data-tip={t`Remove every colour, size and style`}><Trans>Clear Formatting</Trans></button>
          </div>
          <textarea ref={box} className="tx-input" value={draft} rows={5} readOnly={!canEdit} spellCheck
            onChange={(e) => edit(e.target.value)} onBlur={() => save(draft, true)} onKeyDown={projectKeys} aria-label={t`New text`} />
          {!canEdit && <small className="muted"><Trans>Open a project to change this line.</Trans></small>}
          {lost.length > 0 && <p className="warn-box">
            {t`The game fills in ${ph({ fills: andList(lost) })} here. ${plural({ count: lost.length }, { one: "Keep it.", other: "Keep them." })}`}</p>}
          {line.was !== undefined && line.was !== line.text && <p className="warn-box">
            {t`The game has changed this line since it was edited. The original now reads: ${ph({ original: plainText(line.text) })}`}</p>}
        </div>
        <div className="field">
          <span className="field-label"><Trans>Preview</Trans></span>
          <div className="tx-preview"><TextPreview text={draft} /></div>
        </div>
        <div className="row-btns">
          {line.yours !== undefined && <button className="btn" onClick={onRevert} disabled={!canEdit}><Trans>Restore Original</Trans></button>}
          {changed && pending && <span className="muted small"><Trans>Saving…</Trans></span>}
        </div>
      </div>
    </section>
  );
}

const SHOWN_VOICES = 8;

/** The voice lines that say a subtitle, in the language open (English where it has no voices), each opening in the
    Library: the way back from a subtitle to its recordings. Where no recording is matched to this subtitle, the
    ones matched to subtitles with its words, any of which may be it (core: editor.py text_voices). */
function VoiceLines({ id, lang }: { id: number; lang: string }) {
  const { openFound } = useEditor();
  const [found, setFound] = useState<{ lines: SaidBy[]; alike: boolean } | null>(null);
  useEffect(() => {
    let live = true;
    setFound(null);
    (async () => {
      const own = await call<SaidBy[]>("text_voices", { ids: [id], language: lang });
      if (own.length) return { lines: own, alike: false };
      const ids = await call<number[]>("text_alike", { id });
      return { lines: ids.length > 1 ? await call<SaidBy[]>("text_voices", { ids: ids.slice(1), language: lang }) : [], alike: true };
    })().then((f) => live && setFound(f), () => live && setFound(null));
    return () => { live = false; };
  }, [id, lang]);
  if (!found?.lines.length) return null;
  const { lines, alike } = found;
  const takes = new Map<string, number>(); // a voice with two recordings of the line: "take 2"
  return (
    <div className="field">
      <span className="field-label">{alike ? t`Voice lines with these words` : t`Voice lines`} <Help tip={alike
        ? t`No recording is matched to this subtitle. These recordings say the same words but are matched to other subtitles. One of them may belong to this subtitle`
        : t`The recordings that say this subtitle. Open one in the Library to hear it or replace it`} page="text#subtitles-of-voice-lines" /></span>
      <div className="tx-voices">
        {lines.slice(0, SHOWN_VOICES).map((v) => {
          const n = (takes.get(v.name) ?? 0) + 1;
          takes.set(v.name, n);
          return (
            <button key={`${v.cue}:${v.source}`} className="link-text" onClick={() => openFound("library", v)}
              data-tip={v.sure && !alike ? t`Open it in the Library` : t`Several subtitles have these words, so this match is likely but not certain. Open it in the Library`}>
              {v.name}{n > 1 && ` · ${t({ message: `take ${ph({ take: n })}`, comment: "A second or later recording of the same voice line" })}`}
              {(!v.sure || alike) && <span className="tx-likely">· {t({ message: "likely", comment: "The recording probably says this subtitle" })}</span>}
            </button>
          );
        })}
        {lines.length > SHOWN_VOICES && <span className="muted small">
          {plural({ more: lines.length - SHOWN_VOICES }, { one: "and # more", other: "and # more" })}</span>}
      </div>
    </div>
  );
}
