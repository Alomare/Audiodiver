import { plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { call } from "./api";
import { useDialog } from "./dialog";
import { pickTextFile, pickTextToSave } from "./platform";
import { useEditor } from "./store";
import { TextPreview } from "./TextPreview";
import { Help } from "./Wiki";

/** The Text tab's panels that work on many lines: Export to a file, Import it back, and Find and Replace. Import and
    Replace show what they would change before anything is, and apply as one undo step (core: editor.py text_*). */

/** Lines to work on, named for the panels: the selection, the changed ones, what the list shows, a category. */
export type Scope = { id: string; name: string; ids: number[] };
/** A line a panel would change (core _text_changes). */
export type TextChange = { language: string; table: string; id: number; before: string; after: string; lost: string[] };
export type ImportRead = { changes: TextChange[]; same: number; unknown: number; stale: number; empty: number };

const SHOWN_CHANGES = 200; // the panels list this many; the count says the rest
const FORMAT_KEY = "audiodiver.textFormat";

function ScopeField({ scopes, value, onChange }: { scopes: Scope[]; value: string; onChange: (id: string) => void }) {
  return (
    <label className="field">
      <span className="field-label"><Trans comment="Which lines a panel of the Text tab works on">Lines</Trans></span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {scopes.map((s) => <option key={s.id} value={s.id} disabled={!s.ids.length}>{s.name} ({s.ids.length})</option>)}
      </select>
    </label>
  );
}

function Panel({ title, onClose, children, foot }: { title: string; onClose: () => void; children: ReactNode; foot: ReactNode }) {
  const box = useDialog(onClose);
  return (
    <div className="modal-back" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal narrow tx-panel" role="dialog" aria-modal="true" aria-label={title} ref={box} tabIndex={-1}>
        <div className="pop-head">
          <h2>{title}</h2>
          <button className="x" onClick={onClose} aria-label={t`Close`}>✕</button>
        </div>
        {children}
        <div className="modal-foot"><span className="spacer" />{foot}</div>
      </div>
    </div>
  );
}

/** Before and after, for the first lines of a change. */
function Changes({ changes }: { changes: TextChange[] }) {
  const more = changes.length - SHOWN_CHANGES;
  return (
    <div className="tx-changes">
      {changes.slice(0, SHOWN_CHANGES).map((c) => (
        <div key={`${c.table}:${c.id}`} className="tx-change">
          <div className="tx-before"><TextPreview text={c.before} /></div>
          <div className="tx-after"><TextPreview text={c.after} /></div>
        </div>
      ))}
      {more > 0 && <p className="muted small">{plural(more, { one: "and # more", other: "and # more" })}</p>}
    </div>
  );
}

export function TextExport({ scopes, start, lang, langs, onClose }: {
  scopes: Scope[]; start: string; lang: { code: string; name: string }; langs: { code: string; name: string }[]; onClose: () => void;
}) {
  const { quick, notify } = useEditor();
  const [scope, setScope] = useState(start);
  const [format, setFormat] = useState<"csv" | "json">(() => { try { return localStorage.getItem(FORMAT_KEY) === "json" ? "json" : "csv"; } catch { return "csv"; } });
  const [reference, setReference] = useState("");
  const chosen = scopes.find((s) => s.id === scope);
  const go = async () => {
    if (!chosen) return;
    const path = await pickTextToSave(`${lang.code} ${chosen.name}.${format}`, format);
    if (!path) return;
    try { localStorage.setItem(FORMAT_KEY, format); } catch { /* storage off */ }
    try {
      const r = await call<{ lines: number }>("text_export", { path, language: lang.code, ids: chosen.ids, reference: reference || null });
      const lines = r.lines;
      quick(plural(lines, { one: "Exported # line", other: "Exported # lines" }));
      onClose();
    } catch (e: any) { notify("bad", e.message ?? String(e)); }
  };
  return (
    <Panel title={t`Export Lines`} onClose={onClose} foot={<>
      <button className="btn quiet" onClick={onClose}><Trans>Cancel</Trans></button>
      <button className="btn primary" disabled={!chosen?.ids.length} onClick={go}><Trans>Export</Trans></button>
    </>}>
      <ScopeField scopes={scopes} value={scope} onChange={setScope} />
      <div className="field">
        <span className="field-label"><Trans>Format</Trans> <Help tip={t`CSV opens in a spreadsheet. Fill in the New text column, then import the file`} page="text#exporting-and-importing" /></span>
        <div className="segmented" role="radiogroup" aria-label={t`Format`}>
          {(["csv", "json"] as const).map((f) => <button key={f} role="radio" aria-checked={format === f} className={format === f ? "on" : ""} onClick={() => setFormat(f)}>{f.toUpperCase()}</button>)}
        </div>
      </div>
      <label className="field">
        <span className="field-label"><Trans>Second language</Trans></span>
        <select value={reference} onChange={(e) => setReference(e.target.value)} data-tip={t`Adds a column with these lines in another language`}>
          <option value=""><Trans comment="No second language in the file">None</Trans></option>
          {langs.filter((l) => l.code !== lang.code).map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
        </select>
      </label>
    </Panel>
  );
}

/** Asks for a file and reads it, changing nothing; null when the file was refused or none was chosen. */
export async function readTextFile(notify: (tone: "bad", text: string) => void): Promise<ImportRead | null> {
  const path = await pickTextFile();
  if (!path) return null;
  try { return await call<ImportRead>("text_import", { path }); } catch (e: any) { notify("bad", e.message ?? String(e)); return null; }
}

export function TextImport({ read, onClose }: { read: ImportRead; onClose: () => void }) {
  const { actions, quick } = useEditor();
  const risky = read.changes.filter((c) => c.lost.length).length;
  const [leaveOut, setLeaveOut] = useState(true);
  const changes = useMemo(() => (leaveOut ? read.changes.filter((c) => !c.lost.length) : read.changes), [leaveOut, read.changes]);
  const count = changes.length, skipped = read.unknown, stale = read.stale;
  const apply = async () => {
    if (await actions.applyTexts(changes.map((c) => ({ table: c.table, id: c.id, text: c.after })))) {
      quick(plural(count, { one: "Changed # line", other: "Changed # lines" }), "undo");
      onClose();
    }
  };
  return (
    <Panel title={t`Import Lines`} onClose={onClose} foot={<>
      <button className="btn quiet" onClick={onClose}><Trans>Cancel</Trans></button>
      <button className="btn primary" disabled={!count} onClick={apply}>{plural(count, { one: "Change # Line", other: "Change # Lines" })}</button>
    </>}>
      {!read.changes.length && <p className="info-box"><Trans>Nothing to change: the file has no new text that differs from the project.</Trans></p>}
      {skipped > 0 && <p className="warn-box">{plural(skipped, { one: "# line in the file isn't in the game, so it stays out.", other: "# lines in the file aren't in the game, so they stay out." })}</p>}
      {stale > 0 && <p className="warn-box">{plural(stale, { one: "The game has changed # line since the file was made. Check the new text.", other: "The game has changed # lines since the file was made. Check the new text." })}</p>}
      {risky > 0 && (
        <label className="check">
          <input type="checkbox" checked={leaveOut} onChange={(e) => setLeaveOut(e.target.checked)} />
          <span>{plural(risky, { one: "Leave out # line that lost timing or words the game fills in", other: "Leave out # lines that lost timing or words the game fills in" })}{" "}
            <Help tip={t`A subtitle needs timing to show, and the game replaces words like #COUNT when it shows a line`} page="text#what-to-keep" /></span>
        </label>
      )}
      <Changes changes={changes} />
    </Panel>
  );
}

export function TextReplace({ scopes, start, lang, onClose }: { scopes: Scope[]; start: string; lang: string; onClose: () => void }) {
  const { actions, quick, revision } = useEditor();
  const [scope, setScope] = useState(start);
  const [find, setFind] = useState("");
  const [to, setTo] = useState("");
  const [cased, setCased] = useState(false);
  const [changes, setChanges] = useState<TextChange[] | null>(null);
  const ids = scopes.find((s) => s.id === scope)?.ids;
  useEffect(() => {
    if (!find) { setChanges(null); return; }
    let live = true;
    const later = setTimeout(() => {
      call<{ changes: TextChange[] }>("text_replace", { language: lang, find, new: to, ids, case: cased })
        .then((r) => { if (live) setChanges(r.changes); }).catch(() => { if (live) setChanges([]); });
    }, 220);
    return () => { live = false; clearTimeout(later); };
  }, [find, to, cased, lang, ids, revision]);
  const count = changes?.length ?? 0;
  const apply = async () => {
    if (await actions.applyTexts((changes ?? []).map((c) => ({ table: c.table, id: c.id, text: c.after })))) {
      quick(plural(count, { one: "Changed # line", other: "Changed # lines" }), "undo");
      onClose();
    }
  };
  return (
    <Panel title={t`Find and Replace`} onClose={onClose} foot={<>
      <button className="btn quiet" onClick={onClose}><Trans>Cancel</Trans></button>
      <button className="btn primary" disabled={!count} onClick={apply}>{plural(count, { one: "Replace in # Line", other: "Replace in # Lines" })}</button>
    </>}>
      <ScopeField scopes={scopes} value={scope} onChange={setScope} />
      <label className="field"><span className="field-label"><Trans>Find</Trans></span>
        <input value={find} autoFocus onChange={(e) => setFind(e.target.value)} /></label>
      <label className="field"><span className="field-label"><Trans>Replace with</Trans> <Help tip={t`Timing, colours, sizes and words the game fills in stay as they are`} page="text#find-and-replace" /></span>
        <input value={to} onChange={(e) => setTo(e.target.value)} /></label>
      <label className="check"><input type="checkbox" checked={cased} onChange={(e) => setCased(e.target.checked)} /><span><Trans>Match case</Trans></span></label>
      {changes && !changes.length && <p className="muted small"><Trans>No line has these words.</Trans></p>}
      {changes && changes.length > 0 && <Changes changes={changes} />}
    </Panel>
  );
}
