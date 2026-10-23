import { useEffect, useMemo, useRef, useState } from "react";
import { confirm } from "./Confirm";
import { LinkIcon } from "./Icons";
import { Markdown, parse } from "./Markdown";
import { useNote } from "./noteStore";
import { useEditor } from "./store";
import { Help } from "./Wiki";

type Tool = { id: string; label: string; tip: string; keys?: string; draw: React.ReactNode };
const TOOLS: Tool[] = [
  { id: "bold", label: "Bold", tip: "Bold", keys: "Ctrl+B", draw: <b>B</b> },
  { id: "italic", label: "Italic", tip: "Italic", keys: "Ctrl+I", draw: <i>I</i> },
  { id: "heading", label: "Heading", tip: "Heading", draw: <b>H</b> },
  { id: "list", label: "List", tip: "List", draw: <span aria-hidden>•</span> },
  { id: "link", label: "Link", tip: "Link", keys: "Ctrl+K", draw: <LinkIcon /> },
];

/** The project's note on what the details panel shows: a slot (its clip) or, with no slot selected, the open item.
    Add note opens the editor; a note shows as it reads, and a click edits it. It is saved when the editor loses the
    focus (and when the panel moves on to something else), one step of Undo; Delete note asks first when the note has
    words in it. Written in Markdown, with buttons that mark the selected words. */
export function NoteSection({ k, name }: { k: string; name: string }) {
  const { project, actions } = useEditor();
  const saved = useNote(k);
  const [text, setText] = useState(saved);
  const [editing, setEditing] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const doc = useMemo(() => (editing || !saved ? null : parse(saved)), [editing, saved]);
  // what is typed and what was saved, for the save on the way out (the panel can change under a focused editor)
  const now = useRef({ text, saved });
  now.current = { text, saved };
  useEffect(() => { if (!editing) setText(saved); }, [saved, editing]); // an undo, another project
  useEffect(() => () => { const n = now.current; if (n.text.trimEnd() !== n.saved) actions.setNote(k, n.text); }, [k]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (editing) box.current?.focus(); }, [editing]);
  if (!project) return null;

  const save = async () => {
    if (text.trimEnd() !== saved) await actions.setNote(k, text);
    setEditing(false);
  };
  const remove = async () => {
    if (text.trim() && !(await confirm({ title: "Delete the note?", text: `The note on ${name} goes. Undo brings it back.`, ok: "Delete", cancel: "Keep" }))) return;
    setText("");
    setEditing(false);
    if (saved) await actions.setNote(k, "");
  };
  const has = !!saved || editing;

  return (
    <section className="insp-sec note-sec" aria-label="Note">
      <h3>Note <Help tip="A note for yourself, saved in the project. Markdown marks headings, lists, bold and links." page="reading-the-screen#notes" /></h3>
      {!has && <div className="row-btns"><button className="btn quiet" onClick={() => setEditing(true)}>Add note</button></div>}
      {editing && (
        <div className="note-editor" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) save(); }}>
          <div className="note-tools" role="toolbar" aria-label="Formatting">
            {TOOLS.map((t) => (
              <button key={t.id} className="icon-btn" aria-label={t.label} data-tip={t.tip} data-tip-more={t.keys}
                onMouseDown={(e) => e.preventDefault()} onClick={() => box.current && mark(box.current, t.id, setText)}>{t.draw}</button>
            ))}
          </div>
          <textarea ref={box} className="note-text" value={text} spellCheck aria-label={`Note on ${name}`} placeholder="Write a note"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              const tool = e.ctrlKey && !e.altKey && !e.shiftKey ? { b: "bold", i: "italic", k: "link" }[e.key.toLowerCase()] : undefined;
              if (tool) { e.preventDefault(); e.stopPropagation(); mark(e.currentTarget, tool, setText); }
              else if (e.key === "Escape") { e.stopPropagation(); e.currentTarget.blur(); }
            }} />
        </div>
      )}
      {!editing && saved && (
        <div className="note-preview md" role="button" tabIndex={0} data-tip="Edit the note" onClick={() => setEditing(true)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setEditing(true); } }}>
          <Markdown tokens={doc!.tokens} />
        </div>
      )}
      {has && <div className="row-btns"><button className="btn quiet" onClick={remove}>Delete note</button></div>}
    </section>
  );
}

/** Turns a style on or off for the selected words (or the lines they are on), through the editor's own typing so
    that Ctrl+Z in the box takes it back. */
function mark(el: HTMLTextAreaElement, tool: string, set: (t: string) => void) {
  const v = el.value;
  let s = el.selectionStart, e = el.selectionEnd;
  const put = (from: number, to: number, text: string, selFrom: number, selTo: number) => {
    el.focus();
    el.setSelectionRange(from, to);
    if (!document.execCommand("insertText", false, text)) el.setRangeText(text, from, to, "end");
    el.setSelectionRange(selFrom, selTo);
    set(el.value);
  };
  if (tool === "heading" || tool === "list") { // a mark at the start of each line the selection touches
    const start = v.lastIndexOf("\n", s - 1) + 1;
    const end = v.indexOf("\n", e) < 0 ? v.length : v.indexOf("\n", e);
    const lines = v.slice(start, end).split("\n");
    const re = tool === "heading" ? /^#{1,6} / : /^- /;
    const on = lines.every((l) => re.test(l));
    const next = lines.map((l) => (on ? l.replace(re, "") : `${tool === "heading" ? "# " : "- "}${l.replace(/^#{1,6} |^- /, "")}`)).join("\n");
    return put(start, end, next, start, start + next.length);
  }
  if (tool === "link") {
    const words = v.slice(s, e) || "text";
    const text = `[${words}](https://)`;
    return put(s, e, text, s + words.length + 3, s + text.length - 1); // the address, ready to type over
  }
  const m = tool === "bold" ? "**" : "*";
  // the selection inside the marks, or the marks inside the selection: either way they come off
  if (v.slice(s - m.length, s) === m && v.slice(e, e + m.length) === m && (m === "**" || v.slice(s - 2, s) !== "**")) {
    s -= m.length; e += m.length;
  }
  const inner = v.slice(s, e);
  if (inner.length >= 2 * m.length && inner.startsWith(m) && inner.endsWith(m) && (m === "**" || !inner.startsWith("**"))) {
    const off = inner.slice(m.length, -m.length);
    return put(s, e, off, s, s + off.length);
  }
  const words = inner || (tool === "bold" ? "bold" : "italic");
  return put(s, e, `${m}${words}${m}`, s + m.length, s + m.length + words.length);
}
