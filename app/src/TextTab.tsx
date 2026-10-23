import { useEffect, useMemo, useRef, useState } from "react";
import { call, type ProjectState, type SaidBy, type TextLine } from "./api";
import { Mark } from "./IndexTree";
import { chordOf, keymap } from "./keys";
import { nav } from "./nav";
import { copyText } from "./platform";
import { Splitter } from "./Resize";
import { RESET_LAYOUT } from "./settings";
import { useEditor } from "./store";
import { TextPreview } from "./TextPreview";
import { Help, WikiLink } from "./Wiki";

/** The Text tab: the game's text in every language (subtitles, menus, names, everything), to find a line and change
    it: words, colours, sizes. The project keeps the lines it changes; a build carries their whole tables
    (core: strings.py, editor.py text_*). */
type Lang = { code: string; name: string };
type Found = { results: TextLine[]; total: number };

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
const TIMING = /\{(\d+(?:\.\d+)?)->(\d+(?:\.\d+)?)\}/g;
const MARKUP = /<\/?[cifs](?:=[^>]*)?>/g;
/** The words of a line, without its timing and markup: for the list. */
export const plainText = (t: string) => t.replace(TIMING, " ").replace(MARKUP, "").replace(/\s+/g, " ").trim();

export function TextTab({ hidden }: { hidden?: boolean }) {
  const { project, actions, quick } = useEditor();
  const [langs, setLangs] = useState<Lang[]>([]);
  const [lang, setLang] = useState(() => { try { return asked?.lang ?? localStorage.getItem(LANG_KEY) ?? "us"; } catch { return "us"; } });
  const [query, setQuery] = useState("");
  const [mine, setMine] = useState(false);
  const [found, setFound] = useState<Found | null>(null);
  const [error, setError] = useState("");
  const [only, setOnly] = useState<Shown | null>(asked);
  const [pick, setPick] = useState<{ table: string; id: number } | null>(asked && { table: "", id: asked.pick });
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
  useEffect(() => { try { localStorage.setItem(LANG_KEY, lang); } catch { /* storage off */ } }, [lang]);
  useEffect(() => { call<Lang[]>("text_languages").then(setLangs).catch((e) => setError(e.message)); }, []);
  // a language the game's text doesn't come in (a voice's, from a link): US English
  useEffect(() => { if (langs.length && !langs.some((l) => l.code === lang)) setLang("us"); }, [langs, lang]);

  const yours = project?.texts ?? [];
  const edits = useMemo(() => JSON.stringify(yours), [yours]);
  // the list: what the search finds, or the lines the project changes; asked for again after an edit
  useEffect(() => {
    if (!query.trim() && !mine && !only) { setFound(null); return; }
    let live = true;
    const t = setTimeout(() => {
      call<Found>("text_search", { language: lang, query, mine, ...(only ? { ids: only.ids } : {}) })
        .then((f) => { if (live) { setFound(f); setError(""); } })
        .catch((e) => live && setError(e.message));
    }, only ? 0 : 220);
    return () => { live = false; clearTimeout(t); };
  }, [lang, query, mine, edits, only]);

  // the open line: from the list, or (after the language changed) asked for by its id, which every language shares
  const [extra, setExtra] = useState<TextLine | null>(null);
  const listed = found?.results.find((r) => pick && r.table === pick.table && r.id === pick.id)
    ?? found?.results.find((r) => pick && r.id === pick.id) ?? null;
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
  return (
    <div className="panes two text-tab" hidden={hidden} style={{ ["--left" as any]: `${width}px` }}>
      <aside className="library" aria-label="Lines" onKeyDown={listKeys}>
        <div className="lib-search">
          <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Language" data-tip="Language. Each language is a separate table">
            {(langs.length ? langs : [{ code: lang, name: lang }]).map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
          </select>
          <input type="search" placeholder="Search, or paste an id" value={query} onChange={(e) => { setOnly(null); setQuery(e.target.value); }}
            aria-label="Search lines" data-tip="Words in this language, or a line id" data-tip-side="bottom"
            onKeyDown={(e) => { if (e.key === "Escape") setQuery(""); }} />
        </div>
        <div className="mus-filters">
          <div className="segmented mus-filter" role="radiogroup" aria-label="Show">
            <button role="radio" aria-checked={!mine} className={!mine ? "on" : ""} onClick={() => { setOnly(null); setMine(false); }}>All lines</button>
            <button role="radio" aria-checked={mine} className={mine ? "on" : ""} disabled={!project} onClick={() => { setOnly(null); setMine(true); }}
              data-tip={project ? "Only the lines the project changes in this language" : "Open a project to change lines"}>Changed{count ? ` (${count})` : ""}</button>
          </div>
        </div>
        <div className="lib-tree tx-list">
          {only && (
            <div className="tx-only">
              <span>{only.note}</span>
              <button className="x" aria-label="Show all lines" data-tip="Show all lines" onClick={() => setOnly(null)}>✕</button>
            </div>
          )}
          {error && <p className="empty-note">{error}</p>}
          {!found && !error && (
            <div className="empty-note">
              <p>Search every line, including subtitles, mission and menu text, and names.</p>
              <p className="muted small">Try <button className="link-text" onClick={() => setQuery("democracy")}>democracy</button>, <button className="link-text"
                onClick={() => setQuery("reinforcing")}>reinforcing</button> or <button className="link-text" onClick={() => setQuery("extraction")}>extraction</button>.</p>
            </div>
          )}
          {found && !found.results.length && <p className="empty-note tx-none">{mine
            ? query.trim() ? `No changed line has “${query.trim()}”.` : "No line changed in this language yet."
            : `No line has “${query.trim()}”.`}</p>}
          {found?.results.map((r) => (
            <button key={`${r.table}:${r.id}`} className={`tx-row${line === r ? " active" : ""}`} onClick={() => setPick({ table: r.table, id: r.id })}>
              <span className={`tx-kind ${r.kind}`}>{r.kind === "subtitles" ? "Subtitle" : "Text"}</span>
              <span className="tx-text" data-tip={plainText(r.yours ?? r.text) || undefined} data-tip-clip>{plainText(r.yours ?? r.text) || <i className="muted">(empty)</i>}</span>
              {r.yours !== undefined && <Mark status="done" />}
            </button>
          ))}
          {found && found.total > found.results.length && <p className="slots-note">Showing {found.results.length} of {found.total}. Type more to narrow them down.</p>}
        </div>
      </aside>
      <Splitter width={width} onResize={setWidth} initial={480} panel="left" label="Resize the list" />
      <main className="center">
        {line ? <LineEditor key={`${line.table}:${line.id}`} line={line} lang={lang} canEdit={!!project}
          onSave={(t) => actions.setText(line.table, line.id, t)}
          onRevert={async () => { if (await actions.revertText([{ table: line.table, id: line.id }])) quick("Original restored", "undo"); }} />
          : (
            <section className="cue empty">
              <div className="empty-card">
                <p>Search for a line to change words, colours or size.
                  {project ? <> Changes go into <b>{project.name}</b>.</>
                    : <> Open or create a project on <button className="link-text" onClick={() => nav.go("home")}>Home</button> to change lines.</>}</p>
                <p><WikiLink page="text" about="Changing text">How changing text works</WikiLink></p>
              </div>
            </section>
          )}
      </main>
    </div>
  );
}

/** One line: the original, the new text (with a formatting bar), and a preview of how the game shows it. */
function LineEditor({ line, lang, canEdit, onSave, onRevert }: {
  line: TextLine; lang: string; canEdit: boolean; onSave: (text: string) => Promise<ProjectState | null>; onRevert: () => void;
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
  return (
    <section className="cue tx-edit" aria-label="The line">
      <div className="cue-top"><header className="cue-head">
        <div className="head-row"><div className="crumbs">{subtitle ? "Subtitle" : "Text"} · line {line.id} · table {line.table}</div>
          <button className="link-text small" onClick={() => copyText(String(line.id), quick, `**${line.id}**`)} data-tip="Copy the line id">Copy the id</button></div>
        <div className="item-title"><h1>{plainText(line.text).slice(0, 80) || "(empty)"}</h1>
          {line.yours !== undefined && <span className="item-cov done"><Mark status="done" />Changed</span>}</div>
      </header></div>
      <div className="tx-body">
        <div className="field">
          <span className="field-label">Original</span>
          <div className="tx-preview game"><TextPreview text={line.text} /></div>
        </div>
        {subtitle && <VoiceLines id={line.id} lang={lang} />}
        <div className="field">
          <span className="field-label">New text <Help tip="What each format does, with examples" page="formatting-text#applying-a-format" /></span>
          <div className="tx-bar" role="toolbar" aria-label="Formatting">
            <label className="tx-color" data-tip="Colour for the selected words">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Colour" disabled={!canEdit} />
              <input className="tx-hex" value={hexDraft ?? hex} maxLength={7} aria-label="Colour as hex" disabled={!canEdit} spellCheck={false}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9a-f]/gi, "").slice(0, 6).toUpperCase();
                  setHexDraft(v);
                  if (v.length === 6) setColor(`#${v}`);
                }}
                onBlur={() => setHexDraft(null)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur(); }} />
            </label>
            <button className="btn small-btn" disabled={!canEdit} onClick={() => wrap(`<c=FF${hex}>`, "</c>")}
              data-tip="Colour the selection (the whole line when nothing is selected)">Colour</button>
            <input type="number" className="tx-size" min={10} max={60} value={sizeDraft ?? size} disabled={!canEdit} aria-label="Size, 10 to 60"
              data-tip="Size from 10 to 60. The normal size is 20. No game line uses sizes, but chat does"
              onChange={(e) => setSizeDraft(e.target.value)}
              onBlur={() => { const n = Number(sizeDraft); if (sizeDraft !== null && sizeDraft.trim() !== "" && Number.isFinite(n)) setSize(Math.round(Math.max(10, Math.min(60, n)))); setSizeDraft(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
            <button className="btn small-btn" disabled={!canEdit} onClick={() => wrap(`<s=${String(size).padStart(2, "0")}>`, "</s>")}
              data-tip="Size the selection">Size</button>
            <button className="btn small-btn" disabled={!canEdit} onClick={() => wrap("<i=1>", "</i>")} data-tip="The style tips and briefings use for terms">Emphasis</button>
            {subtitle && (
              <button className="btn small-btn" disabled={!canEdit} data-tip="Add a timing mark at the cursor" data-tip-more="When the words after it appear, in seconds from the start of the voice line"
                onClick={() => { const el = box.current!, at = el.selectionStart; edit(draft.slice(0, at) + "{0.00->2.00}" + draft.slice(at), true); }}>Timing</button>
            )}
            <span className="spacer" />
            <button className="btn quiet small-btn" disabled={!canEdit || !MARKUP.test(draft)} onClick={() => edit(draft.replace(MARKUP, ""), true)}
              data-tip="Remove every colour, size and style">Clear formatting</button>
          </div>
          <textarea ref={box} className="tx-input" value={draft} rows={5} readOnly={!canEdit} spellCheck
            onChange={(e) => edit(e.target.value)} onBlur={() => save(draft, true)} onKeyDown={projectKeys} aria-label="New text" />
          {!canEdit && <small className="muted">Open a project to change this line.</small>}
          {lost.length > 0 && <p className="warn-box">The game fills in {lost.join(", ")} here. Keep {lost.length > 1 ? "them" : "it"}.</p>}
          {line.was !== undefined && line.was !== line.text && <p className="warn-box">The game has changed this line since it was edited. The original now reads: {plainText(line.text)}</p>}
        </div>
        <div className="field">
          <span className="field-label">Preview</span>
          <div className="tx-preview"><TextPreview text={draft} /></div>
        </div>
        <div className="row-btns">
          {line.yours !== undefined && <button className="btn" onClick={onRevert} disabled={!canEdit}>Restore the original</button>}
          {changed && pending && <span className="muted small">Saving…</span>}
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
      <span className="field-label">{alike ? "Voice lines with these words" : "Voice lines"} <Help tip={alike
        ? "No recording is matched to this subtitle. These recordings say the same words but are matched to other subtitles. One of them may belong to this subtitle"
        : "The recordings that say this subtitle. Open one in the Library to hear it or replace it"} page="text#subtitles-of-voice-lines" /></span>
      <div className="tx-voices">
        {lines.slice(0, SHOWN_VOICES).map((v) => {
          const n = (takes.get(v.name) ?? 0) + 1;
          takes.set(v.name, n);
          return (
            <button key={`${v.cue}:${v.source}`} className="link-text" onClick={() => openFound("library", v)}
              data-tip={v.sure && !alike ? "Open it in the Library" : "Several subtitles have these words, so this match is likely but not certain. Open it in the Library"}>
              {v.name}{n > 1 && ` · take ${n}`}{(!v.sure || alike) && <span className="tx-likely">· likely</span>}
            </button>
          );
        })}
        {lines.length > SHOWN_VOICES && <span className="muted small">and {lines.length - SHOWN_VOICES} more</span>}
      </div>
    </div>
  );
}
