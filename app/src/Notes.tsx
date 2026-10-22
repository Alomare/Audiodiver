import { memo, useMemo, useRef, useState } from "react";
import { useDialog } from "./dialog";
import { NoteIcon } from "./Icons";
import { Markdown, parse, plainText } from "./Markdown";
import { closeNote, notes, openNote, useEditingNote, useNote } from "./noteStore";
import { useEditor } from "./store";

/** The note button on a row of the Audio Editor: there while the pointer is on the row when nothing is written,
    always there (and lighter) when a note is. Its tip shows the start of the note. */
export const NoteButton = memo(function NoteButton({ k, name }: { k: string; name: string }) {
  const [g, p] = useNote(k);
  const has = !!(g || p);
  const first = has ? firstLine(p || g) : "";
  return (
    <button className={`note-btn${has ? " has" : ""}`} aria-label={has ? `Notes on ${name}` : `Add a note to ${name}`}
      data-tip={has ? "Notes" : "Add a note"} data-tip-more={first || undefined}
      onClick={(e) => { e.stopPropagation(); openNote(k, name); }} onDoubleClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}><NoteIcon /></button>
  );
});

/** The first line of a note with words in it, without its Markdown. */
function firstLine(md: string) {
  for (const line of md.split("\n")) {
    const text = plainText(parse(line).tokens).trim();
    if (text) return text.length > 80 ? `${text.slice(0, 79)}…` : text;
  }
  return "";
}

/** The dialog the note buttons open (mounted once, in App). */
export function NotesDialog() {
  const at = useEditingNote();
  return at ? <NotesBox key={at.key} k={at.key} name={at.name} /> : null;
}

/** A thing's two notes: the global one, in every project, and the open project's. Each is written in Markdown and
    shown as it reads. Closing the dialog (Done, Esc, a click beside it) saves what changed. */
function NotesBox({ k, name }: { k: string; name: string }) {
  const { project, actions } = useEditor();
  const was = useRef({ global: notes.global(k), project: notes.project(k) });
  const [global, setGlobal] = useState(was.current.global);
  const [own, setOwn] = useState(was.current.project);
  const saving = useRef(false);
  const done = async () => {
    if (saving.current) return;
    const g = global.trimEnd() !== was.current.global ? global : undefined;
    const p = project && own.trimEnd() !== was.current.project ? own : undefined;
    if (g === undefined && p === undefined) return closeNote();
    saving.current = true;
    const ok = await actions.setNote(k, g, p);
    saving.current = false;
    if (ok) closeNote(); // refused: the text stays here, and the notice says why
  };
  const box = useDialog(done);
  return (
    <div className="modal-back" onPointerDown={(e) => { if (e.target === e.currentTarget) done(); }}>
      <div className="modal narrow notes-dlg" role="dialog" aria-modal="true" aria-label={`Notes on ${name}`} ref={box} tabIndex={-1}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); done(); } }}>
        <h2>Notes<small data-tip={name} data-tip-clip>{name}</small></h2>
        <NoteField label="Global note" where="Shown in every project" text={global} onChange={setGlobal} />
        {project && <NoteField label="Project note" where={`Saved in ${project.name}`} text={own} onChange={setOwn} />}
        <div className="modal-foot">
          <button className="btn primary" onClick={done} data-tip="Save and close" data-tip-more="Ctrl+Enter">Done</button>
          <span className="spacer" />
          <span className="notes-hint">Markdown: # Heading, - list, **bold**, *italic*, [link](https://…)</span>
        </div>
      </div>
    </div>
  );
}

/** One note: Edit to write it, Preview to read it as it shows. A note with text opens on Preview, an empty one on
    Edit. */
function NoteField({ label, where, text, onChange }: { label: string; where: string; text: string; onChange: (t: string) => void }) {
  const [editing, setEditing] = useState(!text);
  const doc = useMemo(() => (editing ? null : parse(text)), [editing, text]);
  return (
    <section className="note-field" aria-label={label}>
      <div className="note-field-head">
        <span className="field-label">{label}</span>
        <span className="note-where">{where}</span>
        <span className="spacer" />
        <div className="segmented note-mode" role="radiogroup" aria-label={`${label}: show`}>
          <button role="radio" aria-checked={editing} className={editing ? "on" : ""} onClick={() => setEditing(true)}>Edit</button>
          <button role="radio" aria-checked={!editing} className={editing ? "" : "on"} onClick={() => setEditing(false)}>Preview</button>
        </div>
      </div>
      {editing ? (
        <textarea className="note-text" value={text} onChange={(e) => onChange(e.target.value)} spellCheck
          aria-label={label} placeholder="Write a note" />
      ) : (
        <div className="note-preview md" onDoubleClick={() => setEditing(true)}>
          {text.trim() ? <Markdown tokens={doc!.tokens} /> : <p className="note-empty">Nothing written yet.</p>}
        </div>
      )}
    </section>
  );
}
