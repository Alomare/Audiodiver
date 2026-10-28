import { t } from "@lingui/core/macro";
import { useEffect, useMemo, useRef, useState } from "react";
import { confirm } from "./Confirm";
import { LinkIcon } from "./Icons";
import { Markdown, parse } from "./Markdown";
import { notes, useGlobalNote, useGlobalNotes, useNote } from "./noteStore";
import { useEditor } from "./store";
import { Help } from "./Wiki";

type Tool = { id: string; label: string; tip: string; keys?: string; draw: React.ReactNode };
const TOOLS: Tool[] = [
  { id: "bold", label: t`Bold`, tip: t`Bold`, keys: "Ctrl+B", draw: <b>B</b> },
  { id: "italic", label: t`Italic`, tip: t`Italic`, keys: "Ctrl+I", draw: <i>I</i> },
  { id: "heading", label: t`Heading`, tip: t`Heading`, draw: <b>H</b> },
  { id: "list", label: t`List`, tip: t({ message: "List", comment: "Note editor button: makes the lines a bulleted list" }), draw: <span aria-hidden>•</span> },
  { id: "link", label: t`Link`, tip: t({ message: "Link", comment: "Note editor button: makes the words a web link" }), keys: "Ctrl+K", draw: <LinkIcon /> },
];

/** A note on what the details panel shows: a slot (its clip) or, with no slot selected, the open item. The Project
    Note is kept in the project file, one step of Undo; the Global Note in the global notes file (Settings ▸ System
    says where), which every project and the Library see, outside Undo. Add opens the editor; a note shows as it
    reads, and a click edits it. It is saved when the editor loses the focus (and when the panel moves on to something
    else); Delete asks first when the note has words in it. Written in Markdown, with buttons that mark the selected
    words. */
export function NoteSection({ k, name, scope }: { k: string; name: string; scope: "project" | "global" }) {
  const { project, actions, notify } = useEditor();
  const global = scope === "global";
  const projectNote = useNote(k), globalNote = useGlobalNote(k);
  const { error } = useGlobalNotes();
  const saved = global ? globalNote : projectNote;
  const [text, setText] = useState(saved);
  const [editing, setEditing] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const doc = useMemo(() => (editing || !saved ? null : parse(saved)), [editing, saved]);
  /** Writes the note ("" deletes it); true when it was kept. */
  const write = async (value: string) => {
    if (!global) return actions.setNote(k, value);
    try { await notes.setGlobalNote(k, value); return true; } catch (e: any) { notify("bad", e.message ?? String(e)); return false; }
  };
  // what is typed and what was saved, for the save on the way out (the panel can change under a focused editor)
  const now = useRef({ text, saved, write });
  now.current = { text, saved, write };
  useEffect(() => { if (!editing) setText(saved); }, [saved, editing]); // an undo, another project
  useEffect(() => () => { const n = now.current; if (n.text.trimEnd() !== n.saved) n.write(n.text); }, [k]);
  useEffect(() => { if (editing) box.current?.focus(); }, [editing]);
  if (!global && !project) return null;

  const save = async () => {
    if (text.trimEnd() !== saved) await write(text);
    setEditing(false);
  };
  const remove = async () => {
    const keep = t({ message: "Keep", comment: "Answer to Delete the note?: the note stays" });
    if (text.trim() && !(await confirm(global
      ? { title: t`Delete the global note?`, text: t`The global note on ${name} will be deleted. Undo can't bring it back.`, ok: t`Delete`, cancel: keep }
      : { title: t`Delete the project note?`, text: t`The project note on ${name} will be deleted. Undo brings it back.`, ok: t`Delete`, cancel: keep }))) return;
    setText("");
    setEditing(false);
    if (saved) await write("");
  };
  const has = !!saved || editing;
  const label = global ? t`Global Note` : t`Project Note`;

  return (
    <section className="insp-sec note-sec" aria-label={label}>
      <h3>{label} <Help tip={global
        ? t`Shown in every project and in the Library, from the notes file in the folder set in Settings ▸ System. A note on a slot shows wherever the clip plays. Markdown formats headings, lists, bold and links.`
        : t`Kept in the project file. Builds leave notes out. A note on a slot shows wherever the clip plays. Markdown formats headings, lists, bold and links.`}
        page="reading-the-screen#notes" /></h3>
      {global && error && <p className="warn-box">{error}</p>}
      {!has && !(global && error) && <div className="row-btns"><button className="btn quiet" onClick={() => setEditing(true)}>
        {global ? t`Add Global Note` : t`Add Project Note`}</button></div>}
      {editing && (
        <div className="note-editor" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) save(); }}>
          <div className="note-tools" role="toolbar" aria-label={t`Formatting`}>
            {TOOLS.map((t) => (
              <button key={t.id} className="icon-btn" aria-label={t.label} data-tip={t.tip} data-tip-more={t.keys}
                onMouseDown={(e) => e.preventDefault()} onClick={() => box.current && mark(box.current, t.id, setText)}>{t.draw}</button>
            ))}
          </div>
          <textarea ref={box} className="note-text" value={text} spellCheck aria-label={global ? t`Global note on ${name}` : t`Project note on ${name}`} placeholder={t`Write a note`}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              const tool = e.ctrlKey && !e.altKey && !e.shiftKey ? { b: "bold", i: "italic", k: "link" }[e.key.toLowerCase()] : undefined;
              if (tool) { e.preventDefault(); e.stopPropagation(); mark(e.currentTarget, tool, setText); }
              else if (e.key === "Escape") { e.stopPropagation(); e.currentTarget.blur(); }
            }} />
        </div>
      )}
      {!editing && saved && (
        <div className="note-preview md" role="button" tabIndex={0} data-tip={t`Edit the note`} onClick={() => setEditing(true)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setEditing(true); } }}>
          <Markdown tokens={doc!.tokens} />
        </div>
      )}
      {has && <div className="row-btns"><button className="btn quiet" onClick={remove}>{global ? t`Delete Global Note` : t`Delete Project Note`}</button></div>}
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
    const words = v.slice(s, e) || t({ message: "text", comment: "Put in a note as the words of a new link when no words are selected" });
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
  const words = inner || (tool === "bold"
    ? t({ message: "bold", comment: "Put in a note, in bold, when Bold is clicked with no words selected" })
    : t({ message: "italic", comment: "Put in a note, in italics, when Italic is clicked with no words selected" }));
  return put(s, e, `${m}${words}${m}`, s + m.length, s + m.length + words.length);
}
