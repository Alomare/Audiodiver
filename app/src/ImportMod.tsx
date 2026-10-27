import { useEffect, useState } from "react";
import { call, modIconUrl, nameProblem, plural } from "./api";
import { Options } from "./CombinePage";
import { useDialog } from "./dialog";
import { importAsk, useImportAsk } from "./importAsk";
import { Logo } from "./Logo";
import { pickFolder, pickMod } from "./platform";
import { settings } from "./settings";
import { useEditor } from "./store";
import { plainText } from "./TextTab";
import { Help } from "./Wiki";

/** A mod as the core found it (Session.mod_scan): what its manifest says, its options and the choice they start
    with, and where new projects go. */
type Scan = {
  source: string; name: string; description: string; guid: string; icon: boolean; manifest: boolean;
  options: { id: string; name: string; sub: { id: string; name: string }[] }[]; picks: string[]; folder: string;
};
/** A line of the game text that the mod changes (Session.mod_preview). */
type Line = { table: string; id: number; kind: "subtitles" | "text"; language: string; game: string; mod: string };
/** What the options picked bring in, read without decoding any audio (Session.mod_preview). */
type Preview = { parts: string[]; audio: number; texts: Line[]; missing: number; others: string[] };

const keyOf = (l: Line) => `${l.table}:${l.id}`;
const fileName = (p: string) => p.split(/[\\/]/).filter(Boolean).pop() ?? p;
const SHOWN = 150; // lines of a group drawn before Show All: a translation can change thousands
const STALE_TIP = "A mod made for an older game version carries the text of that version too. Untick the lines where only the game changed.";

/** The Import Mod panel, wherever the store opened it (App.tsx draws it). */
export function ImportModHost() {
  const ask = useImportAsk();
  return ask ? <ImportMod key={`${ask.path}|${ask.into}`} path={ask.path} into={ask.into} /> : null;
}

/** Import Mod: a mod (a ZIP, a folder or a patch file) as a new project, or brought into the open one. The top says
    which mod it is, as a mod manager shows it; the left side sets the options it deploys and the project; the right
    side lists what comes in, with each line of text the mod changes, to keep or leave out. Nothing is written
    before Create Project or Import. */
function ImportMod({ path, into }: { path: string; into: boolean }) {
  const { project, actions } = useEditor();
  const close = () => importAsk.close();
  const box = useDialog(close);
  const [scan, setScan] = useState<Scan | null>(null);
  const [failed, setFailed] = useState("");
  const [picks, setPicks] = useState<string[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [off, setOff] = useState<Set<string>>(() => new Set()); // the lines left out
  const [name, setName] = useState("");
  const [folder, setFolder] = useState("");
  const [keepId, setKeepId] = useState(true);
  const [useIcon, setUseIcon] = useState(true);
  const [mode, setMode] = useState<"add" | "replace">("add");
  const [noImage, setNoImage] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let live = true;
    call<Scan>("mod_scan", { path })
      .then((s) => { if (!live) return; setScan(s); setPicks(s.picks); setName(s.name); setFolder(s.folder); })
      .catch((e) => { if (live) setFailed(e.message ?? String(e)); });
    return () => { live = false; };
  }, [path]);
  const picked = picks.join("\n");
  useEffect(() => {
    if (!scan) return;
    let live = true;
    setPreview(null);
    call<Preview>("mod_preview", { path, picks })
      .then((p) => { if (live) { setPreview(p); setFailed(""); } })
      .catch((e) => { if (live) setFailed(e.message ?? String(e)); });
    return () => { live = false; };
  }, [scan, path, picked]); // eslint-disable-line react-hooks/exhaustive-deps

  const another = async () => {
    const p = await pickMod("Choose a mod to import");
    if (p) importAsk.open({ path: p, into });
  };
  const target = into && project;
  const p = project;
  const empty = !p || (!Object.keys(p.assignments).length && !p.additions.length && !p.settings
    && !Object.keys(p.segment_overrides).length && !p.library.length);
  const lines = preview?.texts ?? [];
  const chosen = lines.filter((l) => !off.has(keyOf(l)));
  const problem = target ? null : nameProblem(name);
  const nothing = !!preview && !preview.audio && !chosen.length;
  const submit = async () => {
    if (!scan || !preview || problem || nothing) return;
    setSending(true);
    const texts = chosen.map((l) => ({ table: l.table, id: l.id }));
    const ok = await actions.runImport(target
      ? { path, picks, texts, mode: empty ? "add" : mode, tabs: settings.get().tabs }
      : { path, picks, texts, name: name.trim(), folder, keep_id: keepId && !!scan.guid, icon: useIcon && scan.icon, tabs: settings.get().tabs });
    setSending(false);
    if (ok) close();
  };
  const showImage = !!scan?.icon && !noImage && (target || useIcon);

  return (
    <div className="modal-back" onPointerDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal import" role="dialog" aria-modal="true" aria-label="Import Mod" ref={box} tabIndex={-1}>
        <div className="pop-head">
          <h2>{target ? `Import into ${p!.name}` : "Import Mod"}</h2>
          <button className="x" onClick={close} aria-label="Close">✕</button>
        </div>

        <div className="imp-head">
          <div className="imp-icon">
            {showImage ? <img src={modIconUrl(path)} alt="" onError={() => setNoImage(true)} /> : <Logo />}
          </div>
          <div className="imp-who">
            <b>{scan?.name ?? fileName(path)}</b>
            {scan?.description && <span className="imp-desc" data-tip={scan.description.length > 140 ? scan.description : undefined}>{scan.description}</span>}
            <span className="imp-src" data-tip={path} data-tip-clip>{fileName(path)}</span>
          </div>
          <button className="btn quiet" onClick={another}>Choose Another Mod</button>
        </div>

        {failed && !preview ? <p className="warn-box imp-failed">{failed}</p> : (
          <div className="imp-body">
            <div className="imp-side">
              {scan && scan.options.length > 0 && (
                <Options mod={{ scan, picks }} disabled={sending} onChange={setPicks}
                  help={{ tip: "The options of the mod that come in. They start as the mod manager has them, or all on", page: "importing-mods#options-name-and-folder" }} />
              )}
              {target ? (!empty && (
                <div className="field">
                  <span className="field-label">Audio in the project</span>
                  <div className="segmented" role="radiogroup" aria-label="Audio in the project">
                    <button role="radio" aria-checked={mode === "add"} className={mode === "add" ? "on" : ""} onClick={() => setMode("add")}>Add to the Project</button>
                    <button role="radio" aria-checked={mode === "replace"} className={mode === "replace" ? "on" : ""} onClick={() => setMode("replace")}>Replace the Project's Audio</button>
                  </div>
                  <small>{mode === "add" ? "Where both have audio for a slot, the mod's is used."
                    : "Removes the new audio, added sounds, cue points and list first. The audio files stay, and Undo brings them back."}</small>
                </div>
              )) : scan && (
                <>
                  <label className="field">
                    <span className="field-label">Project name</span>
                    <input value={name} maxLength={80} spellCheck={false} aria-invalid={!!problem} onChange={(e) => setName(e.target.value)} />
                    {problem && <small className="bad">{problem}</small>}
                  </label>
                  <div className="field">
                    <span className="field-label">Folder</span>
                    <div className="folder-row">
                      <span className="folder" data-tip={folder} data-tip-clip>{folder}</span>
                      <button className="btn" onClick={async () => { const f = await pickFolder(folder, "Choose where the project goes"); if (f) setFolder(f); }}>Choose</button>
                    </div>
                    <small className="imp-path" data-tip={`${folder}\\${name.trim()}`} data-tip-clip>Saved in {folder}\{name.trim() || "…"}</small>
                  </div>
                  {scan.guid && (
                    <label className="check"><input type="checkbox" checked={keepId} onChange={(e) => setKeepId(e.target.checked)} />
                      <span>Keep the mod ID <Help tip="A build of the project then updates this mod in the mod manager. Turned off, the build installs beside it as another mod." page="build-and-install#mod-id" /></span></label>
                  )}
                  {scan.icon && (
                    <label className="check"><input type="checkbox" checked={useIcon} onChange={(e) => setUseIcon(e.target.checked)} />
                      <span>Use the icon of the mod</span></label>
                  )}
                </>
              )}
            </div>

            <div className="imp-what">
              <span className="field-label">What comes in</span>
              {!preview ? <p className="set-note">Reading the mod…</p> : (
                <>
                  <ul className="imp-parts">
                    {preview.parts.map((x) => <li key={x}>{x}</li>)}
                  </ul>
                  <p className="imp-sum">
                    {preview.audio ? <>Audio from {plural(preview.audio, "patch", "patches")}</> : "No audio"}
                    {lines.length > 0 && <>, and <b>{chosen.length}</b> of {plural(lines.length, "line")} of text</>}.
                  </p>
                  {lines.length > 0 && <TextReview lines={lines} off={off} setOff={setOff} />}
                  {(preview.missing > 0 || preview.others.length > 0) && (
                    <ul className="imp-left">
                      {preview.missing > 0 && <li>Left out: {plural(preview.missing, "line")} of text that the game doesn't have</li>}
                      {preview.others.map((x) => <li key={x}>Left out: {x}</li>)}
                    </ul>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        <div className="modal-foot">
          <span className="spacer" />
          <button className="btn quiet" onClick={close}>Cancel</button>
          <button className="btn primary" disabled={!preview || !!problem || nothing || sending} onClick={submit}
            data-tip={nothing ? "Choose a line of text to import" : undefined}>{target ? "Import" : "Create Project"}</button>
        </div>
      </div>
    </div>
  );
}

/** The lines of text the mod changes, by kind (subtitles first): each with the mod's text, and the game's under it,
    struck through. A tick keeps a line, and a group's tick keeps or leaves out all of it. */
function TextReview({ lines, off, setOff }: { lines: Line[]; off: Set<string>; setOff: (f: (s: Set<string>) => Set<string>) => void }) {
  const [all, setAll] = useState<Record<string, boolean>>({});
  const languages = new Set(lines.map((l) => l.language));
  const flip = (keys: string[], keep: boolean) => setOff((s) => {
    const next = new Set(s);
    for (const k of keys) if (keep) next.delete(k); else next.add(k);
    return next;
  });
  return (
    <div className="imp-lines">
      <span className="field-label imp-lines-head">Text <Help tip={STALE_TIP} page="importing-mods#text" /></span>
      {(["subtitles", "text"] as const).map((kind) => {
        const of = lines.filter((l) => l.kind === kind);
        if (!of.length) return null;
        const kept = of.filter((l) => !off.has(keyOf(l))).length;
        const shown = all[kind] ? of : of.slice(0, SHOWN);
        return (
          <section key={kind} className="imp-group">
            <label className="check imp-group-head">
              <input type="checkbox" checked={kept === of.length} ref={(el) => { if (el) el.indeterminate = kept > 0 && kept < of.length; }}
                onChange={() => flip(of.map(keyOf), kept < of.length)} />
              <span>{kind === "subtitles" ? "Subtitles" : "Other text"}</span>
              <span className="imp-n">{kept} of {of.length}</span>
            </label>
            <ul>
              {shown.map((l) => {
                const k = keyOf(l), on = !off.has(k);
                return (
                  <li key={k} className={on ? undefined : "off"}>
                    <label className="check">
                      <input type="checkbox" checked={on} onChange={() => flip([k], !on)} />
                      <span className="imp-line">
                        <span className="imp-new">{languages.size > 1 && <i className="imp-lang">{l.language}</i>}{plainText(l.mod) || <i>No text</i>}</span>
                        <span className="imp-was">{plainText(l.game) || "No text"}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            {of.length > shown.length && (
              <button className="link-inline imp-more" onClick={() => setAll((a) => ({ ...a, [kind]: true }))}>Show All {of.length}</button>
            )}
          </section>
        );
      })}
    </div>
  );
}
