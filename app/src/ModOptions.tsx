import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { call, fmtDecimal, fmtExact, optionImageUrl, type ChangeAudio, type ModOption, type OptionChanges, type OptionGroup, type OptionsPlan } from "./api";
import { confirm } from "./Confirm";
import { useDialog } from "./dialog";
import { AudioIcon, CheckIcon, DownIcon, PlusIcon, TrashIcon, UndoIcon, UpIcon } from "./Icons";
import { useDraft } from "./Page";
import { useEditor } from "./store";
import { Help } from "./WikiLinks";

/** Options for Players, on the Project tab (core options.py). A group (Liberator Fire) has options (1, 2, 3): in the
    mod manager players tick the group and pick one option, or leave it unticked and get none of it. What each option
    changes is set in the Audio tab with the group's picker; each option says what it changes and about what it adds
    to the mod. Groups that change the same banks say so. */
export function ModOptions() {
  const { project, actions } = useEditor();
  const p = project!;
  const [plan, setPlan] = useState<OptionsPlan | null>(null);
  const live = p.groups.length > 0;
  useEffect(() => { // what each option costs, and the groups that share banks: the core works it out from the game
    if (!live || p.game === "hd1") { setPlan(null); return; }
    let on = true;
    call<OptionsPlan>("options_plan").then((x) => { if (on) setPlan(x); }, () => { /* sizes stay out */ });
    return () => { on = false; };
  }, [p.revision, live, p.game]);
  const name = (id: string) => p.groups.find((g) => g.id === id)?.name ?? id;

  return (
    <section className="set-sec opts" aria-label={t`Options for Players`}>
      <h2><Trans>Options for Players</Trans> <Help tip={t`Groups players turn on in the mod manager, each with options to pick one of`} page="mod-options" /></h2>
      {p.groups.map((g, i) => <GroupBlock key={g.id} g={g} at={i} count={p.groups.length} plan={plan} />)}
      {plan?.shared.map((s) => (
        <p key={`${s.a}:${s.b}`} className="warn-box opts-shared">{plural(s.banks, {
          one: `${name(s.a)} and ${name(s.b)} change the same bank, so in Helldivers 2 mod managers the later one wins there whatever players pick.`,
          other: `${name(s.a)} and ${name(s.b)} change # of the same banks, so in Helldivers 2 mod managers the later one wins there whatever players pick.`,
        })}</p>
      ))}
      <div className="row-btns">
        <button className="btn" onClick={() => void actions.groupAdd()} disabled={p.groups.length >= 16}><PlusIcon /><Trans>Add Group</Trans></button>
        {live && <button className="btn quiet" onClick={() => void actions.optionPick()} disabled={!Object.keys(p.picks).length}
          data-tip={t`Changes in the Audio tab go into the base mod`}><Trans>Back to Base Mod</Trans></button>}
      </div>
    </section>
  );
}

/** A group's or option's image: the picture, or a box to choose one; a group's code sits in its corner. ✕ takes the
    image away. */
function ImageBox({ group, option, image, label, code }: { group: string; option?: string; image: string; label: string; code?: string }) {
  const { actions, project } = useEditor();
  const broken = project?.problem_kinds.includes("option_image") ?? false;
  const clear = () => (option ? actions.optionSet(group, option, { image: "" }) : actions.groupSet(group, { image: "" }));
  return (
    <span className={`opt-img${option ? " small" : ""}`}>
      <button className="opt-img-pick" onClick={() => void actions.optionImage(group, option)} aria-label={image ? t`Choose another image for ${label}` : t`Choose an image for ${label}`}
        data-tip={image ? t`Choose Another Image` : t`Choose an Image`}>
        {image && !broken ? <img src={optionImageUrl(group, option, image)} alt="" draggable={false} /> : <PlusIcon />}
      </button>
      {code && <span className="opt-img-code" aria-label={t`Group ${code}`}>{code}</span>}
      {image && <button className="x opt-img-x" onClick={() => void clear()} aria-label={t`Remove the image of ${label}`} data-tip={t`Remove the image`}>✕</button>}
    </span>
  );
}

/** A field saved when it loses focus (Enter too). A name can't be left empty: it goes back to the saved one. */
function Field({ value, save, className, label, placeholder, max, required }: {
  value: string; save: (v: string) => void; className: string; label: string; placeholder?: string; max: number; required?: boolean;
}) {
  const [text, setText] = useDraft(value);
  return (
    <input className={className} value={text} maxLength={max} aria-label={label} placeholder={placeholder} spellCheck={false}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => { const v = required ? text.trim() : text; if (required && !v) setText(value); else if (v !== value) save(v); }}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
  );
}

function GroupBlock({ g, at, count, plan }: { g: OptionGroup; at: number; count: number; plan: OptionsPlan | null }) {
  const { actions } = useEditor();
  const remove = async () => {
    const used = g.options.some((o) => o.slots || o.cues || o.gain_db);
    if (used && !(await confirm({ title: t`Remove ${g.name}?`, text: t`The options go with it.`, ok: t`Remove` }))) return;
    void actions.groupRemove(g.id);
  };
  return (
    <div className="opt">
      <div className="opt-head">
        <ImageBox group={g.id} image={g.image} label={g.name} code={g.letter} />
        <div className="opt-texts">
          <Field className="opt-field opt-name" value={g.name} max={60} required label={t`Group name`} save={(name) => void actions.groupSet(g.id, { name })} />
          <Field className="opt-field opt-about" value={g.description} max={500} label={t`Description of ${g.name}`} placeholder={t`Description (Optional)`}
            save={(description) => void actions.groupSet(g.id, { description })} />
        </div>
        <span className="opt-tools">
          <button className="x" disabled={at === 0} onClick={() => void actions.groupMove(g.id, at - 1)} aria-label={t`Move ${g.name} up`} data-tip={t`Move up`}><UpIcon /></button>
          <button className="x" disabled={at === count - 1} onClick={() => void actions.groupMove(g.id, at + 1)} aria-label={t`Move ${g.name} down`} data-tip={t`Move down`}><DownIcon /></button>
          <button className="x opt-del" onClick={() => void remove()} aria-label={t`Remove ${g.name}`} data-tip={t`Remove the group`}><TrashIcon /></button>
        </span>
      </div>
      <ol className="opt-choices">
        {g.options.map((o, k) => <OptionRow key={o.id} g={g} o={o} k={k} cost={plan?.options[`${g.id}/${o.id}`]} />)}
      </ol>
      <button className="btn quiet small-btn opt-add" onClick={() => void actions.optionAdd(g.id)} disabled={g.options.length >= 16}><PlusIcon /><Trans>Add Option</Trans></button>
    </div>
  );
}

/** What an option changes and about what it adds, in one line ("" for nothing). */
function changes(o: ModOption, cost?: { banks: number; mb: number }): string {
  const out: string[] = [];
  if (o.slots) out.push(plural(o.slots, { one: "# slot", other: "# slots" }));
  if (o.cues) out.push(plural(o.cues, { one: "# segment", other: "# segments" }));
  if (cost && cost.banks > 0) out.push(`+${fmtDecimal(cost.mb, 1)} MB`);
  return out.join(" · ");
}

function OptionRow({ g, o, k, cost }: { g: OptionGroup; o: ModOption; k: number; cost?: { banks: number; mb: number } }) {
  const { actions, project } = useEditor();
  const [gain, setGain] = useDraft(o.gain_db ? String(o.gain_db) : "");
  const [listing, setListing] = useState(false);
  const picked = project?.picks[g.id] === o.id;
  const saveGain = () => {
    const v = gain.trim() === "" ? 0 : Number(gain.replace(",", ".").replace("−", "-"));
    if (!Number.isFinite(v) || v === o.gain_db) { setGain(o.gain_db ? String(o.gain_db) : ""); return; }
    void actions.optionSet(g.id, o.id, { gain_db: Math.max(-12, Math.min(12, v)) });
  };
  const edit = () => void (picked ? actions.optionPick() : actions.optionPick(g.id, o.id));
  const what = changes(o, cost);
  const remove = async () => {
    const last = g.options.length === 1;
    if ((o.slots || o.cues || last) && !(await confirm({
      title: t`Remove ${o.name}?`, ok: t`Remove`,
      text: last ? t`${g.name} goes with it.` : t`What it changes goes with it.`,
    }))) return;
    void actions.optionRemove(g.id, o.id);
  };
  return (
    <li className={`opt-choice${picked ? " editing" : ""}`}>
      <span className="opt-pic">
        <span className="opt-row-code" aria-label={t`Option ${g.letter}${o.number}`}>{g.letter}{o.number}</span>
        <ImageBox group={g.id} option={o.id} image={o.image} label={o.name} />
      </span>
      <Field className="opt-field opt-choice-name" value={o.name} max={60} required label={t`Option name`} save={(name) => void actions.optionSet(g.id, o.id, { name })} />
      <Field className="opt-field opt-about" value={o.description} max={500} label={t`Description of ${o.name}`} placeholder={t`Description (Optional)`}
        save={(description) => void actions.optionSet(g.id, o.id, { description })} />
      {what && <span className="opt-what">{what}</span>}
      <span className="opt-acts">
        <button className="btn quiet small-btn opt-edit" onClick={edit} aria-pressed={picked}
          data-tip={picked ? t`Back to the base mod` : t`Changes in the Audio tab go into this option`}>
          {picked ? <CheckIcon /> : <AudioIcon />}{picked ? t`Selected` : t`Select`}</button>
        <button className="btn quiet small-btn opt-changes-btn" onClick={() => setListing(true)} disabled={!o.slots && !o.cues}
          data-tip={t`What this option changes from the base mod`}><Trans>Changes</Trans>
          {o.slots + o.cues > 0 && <span className="opt-count">{o.slots + o.cues}</span>}</button>
      </span>
      <label className="opt-gain" data-tip={t`Gain, added to every slot the mod changes outside the groups, from −12 to +12 dB`}>
        <input className="opt-field" inputMode="decimal" value={gain} placeholder="0" onChange={(e) => setGain(e.target.value)} onBlur={saveGain}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); else if (e.key === "Escape") { setGain(o.gain_db ? String(o.gain_db) : ""); } }}
          aria-label={t`Gain of ${o.name} (dB)`} /><span className="unit">dB</span>
      </label>
      {listing && <OptionChangesDialog g={g} o={o} close={() => setListing(false)} />}
      <span className="opt-tools">
        <button className="x" disabled={k === 0} onClick={() => void actions.optionMove(g.id, o.id, k - 1)} aria-label={t`Move ${o.name} up`} data-tip={t`Move up`}><UpIcon /></button>
        <button className="x" disabled={k === g.options.length - 1} onClick={() => void actions.optionMove(g.id, o.id, k + 1)} aria-label={t`Move ${o.name} down`} data-tip={t`Move down`}><DownIcon /></button>
        <button className="x opt-del" onClick={() => void remove()} aria-label={t`Remove ${o.name}`} data-tip={t`Remove the option`}><TrashIcon /></button>
      </span>
    </li>
  );
}

/** A setting's name in the list of changes. */
function fieldName(key: string): string {
  switch (key) {
    case "audio": return t`Audio`;
    case "gain_db": return t`Gain`;
    case "original_gain_db": return t`Original Gain`;
    case "fade_in_ms": return t`Fade In`;
    case "fade_out_ms": return t`Fade Out`;
    case "start_ms": return t`Start`;
    case "end_ms": return t`End`;
    case "delay_ms": return t`Delay`;
    case "fit_timing": return t`Fit Timing`;
    case "blocks": return t`Waveform Suite`;
    case "layers": return t`Layer Names`;
    case "lowpass": return t`Low-Pass`;
    case "highpass": return t`High-Pass`;
    case "keep_curve": return t`Volume Curve`;
    case "entry_marker": return t`Entry`;
    case "exit_marker": return t`Exit`;
    default: return key;
  }
}

/** A setting's value in the list of changes ("–" where the base mod has no new audio to set it on). */
function fieldValue(key: string, v: unknown): string {
  if (key === "audio") {
    const a = v as ChangeAudio;
    if (!a) return t`Original`;
    if ("silence" in a) return t`Silence`;
    if ("blocks" in a) return plural(a.blocks, { one: "Edited, # block", other: "Edited, # blocks" });
    return a.file;
  }
  if (key === "entry_marker" || key === "exit_marker") return v == null ? t`Automatic` : fmtExact(v as number);
  if (v == null) return "–";
  switch (key) {
    case "gain_db": case "original_gain_db": return `${fmtDecimal(v as number, 1, true)} dB`;
    case "fade_in_ms": case "fade_out_ms": case "start_ms": case "end_ms": case "delay_ms": return `${fmtDecimal(v as number, 0)} ms`;
    case "fit_timing": return v ? t`On` : t`Off`;
    case "keep_curve": return v ? t`Kept` : t`Off`;
    case "blocks": return plural(v as number, { one: "# block", other: "# blocks" });
    case "layers": return (v as string[]).filter(Boolean).join(", ") || "–";
    default: return String(v);
  }
}

/** What an option changes from the base mod, a row per slot and per segment, each with a way to undo it (back to
    the base mod's there). A slot's name opens it in the Audio tab. */
function OptionChangesDialog({ g, o, close }: { g: OptionGroup; o: ModOption; close: () => void }) {
  const { actions, goTo, project } = useEditor();
  const [list, setList] = useState<OptionChanges | null>(null);
  const box = useDialog(close);
  useEffect(() => {
    let on = true;
    call<OptionChanges>("option_changes", { group: g.id, option: o.id }).then((x) => { if (on) setList(x); }, () => { if (on) close(); });
    return () => { on = false; };
  }, [project?.revision, g.id, o.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const code = `${g.letter}${o.number}`, group = g.name, option = o.name;
  const undo = async (what: string, changes: { slots?: string[]; segments?: string[] }) => {
    if (!(await confirm({ title: t`Undo the change to ${what}?`, text: t`It plays as the base mod has it.`, ok: t`Undo Change` }))) return;
    void actions.optionRevert(g.id, o.id, changes);
  };
  const show = (s: OptionChanges["slots"][number]) => {
    close();
    const scope = s.item && project?.library.includes(s.item) ? "editor" : "library";
    void goTo({ scope, itemId: s.item, cueId: s.cue, source: s.source });
  };
  const rows = (fields: { key: string; base: unknown; option: unknown }[]) => fields.length ? fields : [{ key: "", base: null, option: null }];
  // on the body, as the app's other dialogs: inside the Project tab, its scrolling page would carry the dialog along
  return createPortal(
    <div className="modal-back" onPointerDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal opt-changes" role="dialog" aria-modal="true" aria-label={t`Changes in ${group}: ${option}`} ref={box} tabIndex={-1}>
        <div className="opt-changes-head">
          <h2><span className="opt-code on">{code}</span> <Trans>Changes in {group}: {option}</Trans></h2>
          <button className="x" onClick={close} aria-label={t`Close`}>✕</button>
        </div>
        {!list ? <p className="muted"><Trans>Reading…</Trans></p>
          : !list.slots.length && !list.segments.length ? <p className="muted"><Trans>No changes</Trans></p> : (
            <div className="opt-changes-scroll">
              <table className="opt-changes-table">
                <thead>
                  <tr><th><Trans>Slot</Trans></th><th><Trans>Setting</Trans></th><th><Trans>Base Mod</Trans></th><th>{code}</th><th aria-label={t`Undo`} /></tr>
                </thead>
                {list.slots.map((s) => {
                  const what = s.label || t`Slot ${s.source}`;
                  const fields = rows(s.fields);
                  return (
                    <tbody key={s.source}>
                      {fields.map((f, i) => (
                        <tr key={f.key || i}>
                          {i === 0 && (
                            <td rowSpan={fields.length} className="opt-changes-slot">
                              <button className="link-text" onClick={() => show(s)} data-tip={t`Show in the Audio tab`}>{what}</button>
                              {s.name && <span className="muted">{s.name}</span>}
                            </td>
                          )}
                          <td className="muted">{f.key && fieldName(f.key)}</td>
                          <td>{f.key && fieldValue(f.key, f.base)}</td>
                          <td className="opt-changes-new">{f.key && fieldValue(f.key, f.option)}</td>
                          {i === 0 && (
                            <td rowSpan={fields.length} className="opt-changes-act">
                              <button className="x" onClick={() => void undo(what, { slots: [s.source] })} aria-label={t`Undo the change to ${what}`}
                                data-tip={t`Undo Change`}><UndoIcon /></button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  );
                })}
                {list.segments.map((s) => {
                  const what = t`Segment ${s.segment}`;
                  const fields = rows(s.fields);
                  return (
                    <tbody key={`seg:${s.segment}`}>
                      {fields.map((f, i) => (
                        <tr key={f.key || i}>
                          {i === 0 && <td rowSpan={fields.length} className="opt-changes-slot">{what}<span className="muted"><Trans>Cue points</Trans></span></td>}
                          <td className="muted">{f.key && fieldName(f.key)}</td>
                          <td>{f.key && fieldValue(f.key, f.base)}</td>
                          <td className="opt-changes-new">{f.key && fieldValue(f.key, f.option)}</td>
                          {i === 0 && (
                            <td rowSpan={fields.length} className="opt-changes-act">
                              <button className="x" onClick={() => void undo(what, { segments: [s.segment] })} aria-label={t`Undo the change to ${what}`}
                                data-tip={t`Undo Change`}><UndoIcon /></button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  );
                })}
              </table>
            </div>
          )}
      </div>
    </div>,
    document.body,
  );
}

/** A group's or option's image, small, for the Audio tab's picker (an empty square without one). */
function Thumb({ group, option, image }: { group: string; option?: string; image: string }) {
  const { project } = useEditor();
  const broken = project?.problem_kinds.includes("option_image") ?? false;
  return <span className="opt-thumb">{image && !broken && <img src={optionImageUrl(group, option, image)} alt="" draggable={false} />}</span>;
}

/** Over the Audio tab, in a project with groups: what is being edited (the base mod or an option), a menu to pick
    another (the base mod, then each group with its options under it), and the way back to the base mod. */
export function EditingLabel() {
  const { project, actions } = useEditor();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  if (!project?.groups.length) return null;
  const [gid, oid] = Object.entries(project.picks)[0] ?? [];
  const g = project.groups.find((x) => x.id === gid);
  const o = g?.options.find((x) => x.id === oid);
  const group = g?.name ?? "", option = o?.name ?? "";
  return (
    <div className={`opt-editing${o ? " on" : ""}${o?.image ? " has-img" : ""}`}>
      <span className="opt-editing-lead"><Trans>Editing</Trans></span>
      <button ref={button} className="opt-pick" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open}>
        {g && o ? <>
          {o.image && <Thumb group={g.id} option={o.id} image={o.image} />}
          <span className="opt-code on">{g.letter}{o.number}</span>
          <span className="opt-pick-name"><Trans>{group}: {option}</Trans></span>
        </> : <span className="opt-pick-name"><Trans>Base Mod</Trans></span>}
        <DownIcon />
      </button>
      {o && <button className="link-inline" onClick={() => void actions.optionPick()}>{t`Back to Base Mod`}</button>}
      {open && <OptionMenu at={button.current} close={() => setOpen(false)} />}
    </div>
  );
}

/** The Audio tab's picker: the base mod, then each group (a heading) with its options indented under it. Arrow keys
    walk the entries; a click, Escape or a click elsewhere closes it. */
function OptionMenu({ at, close }: { at: HTMLElement | null; close: () => void }) {
  const { project, actions } = useEditor();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; maxHeight: number } | null>(null);
  useLayoutEffect(() => {
    const r = at?.getBoundingClientRect();
    if (!r) return;
    const top = r.bottom + 4;
    setPos({ left: Math.min(r.left, window.innerWidth - (ref.current?.offsetWidth ?? 320) - 8), top, maxHeight: window.innerHeight - top - 12 });
  }, [at]);
  const placed = pos !== null;
  useEffect(() => { // once placed (hidden while measured, it can't take the focus): the entry picked now
    if (placed) ref.current?.querySelector<HTMLButtonElement>("[aria-checked=true]")?.focus({ preventScroll: true });
  }, [placed]);
  useEffect(() => {
    const away = (e: Event) => { if (!ref.current?.contains(e.target as Node) && !at?.contains(e.target as Node)) close(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); at?.focus(); } };
    window.addEventListener("pointerdown", away, true);
    window.addEventListener("keydown", key, true);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("pointerdown", away, true);
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("blur", close);
    };
  }, [at, close]);
  if (!project) return null;
  const picked = Object.entries(project.picks)[0];
  const pick = (gid?: string, oid?: string) => { close(); at?.focus(); void actions.optionPick(gid, oid); };
  const move = (e: React.KeyboardEvent) => {
    const d = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const items = [...ref.current!.querySelectorAll<HTMLButtonElement>("button")];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    items[(i + d + items.length) % items.length]?.focus();
  };
  return createPortal(
    <div className="opt-menu" role="menu" ref={ref} style={pos ?? { visibility: "hidden" }} onKeyDown={move}>
      <button role="menuitemradio" aria-checked={!picked} className="opt-menu-base" onClick={() => pick()}>
        <span className="opt-menu-name"><Trans>Base Mod</Trans></span>
      </button>
      {project.groups.map((g) => (
        <div key={g.id} className="opt-menu-group" role="group" aria-label={g.name}>
          <div className="opt-menu-head">
            <Thumb group={g.id} image={g.image} />
            <span className="opt-code">{g.letter}</span>
            <span className="opt-menu-name">{g.name}</span>
          </div>
          {g.options.map((o) => (
            <button key={o.id} role="menuitemradio" aria-checked={picked?.[0] === g.id && picked?.[1] === o.id} className="opt-menu-option"
              onClick={() => pick(g.id, o.id)}>
              <Thumb group={g.id} option={o.id} image={o.image} />
              <span className="opt-code">{g.letter}{o.number}</span>
              <span className="opt-menu-name">{o.name}</span>
            </button>
          ))}
        </div>
      ))}
    </div>,
    document.body,
  );
}

/** In the details panel, for a slot a group has: which option changes it, and what plays without that. */
export function OptionNote({ source }: { source: string }) {
  const { project, actions } = useEditor();
  const s = project?.option_slots[source];
  if (!s || !project) return null;
  const g = project.groups.find((x) => x.id === s.group);
  if (!g) return null;
  const o = g.options.find((x) => x.id === s.option);
  const base = s.base ? (s.base.gain_db ? `${s.base.name}, ${fmtDecimal(s.base.gain_db, 1, true)} dB` : s.base.name) : t`the original`;
  const group = g.name, option = o?.name ?? "", pickedName = g.options.find((x) => x.id === project.picks[g.id])?.name ?? "";
  return (
    <p className="opt-note">
      <span className="opt-code on">{o ? `${g.letter}${o.number}` : g.letter}</span>{" "}
      {!s.on ? <Trans><b>{group}</b>: Off</Trans>
        : o ? <Trans><b>{group}: {option}</b>. Without the group: {base}.</Trans>
          : <Trans><b>{group}</b>: unchanged in {pickedName}</Trans>}
      {o && <>{" "}<button className="link-inline" onClick={() => void actions.optionSlotsOff([source])}>{t`Remove from Option`}</button></>}
    </p>
  );
}
