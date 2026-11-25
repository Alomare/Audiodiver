import { useEffect, useState } from "react";
import { plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { call, fmtDecimal, optionImageUrl, type ModOption, type OptionGroup, type OptionsPlan } from "./api";
import { confirm } from "./Confirm";
import { PlusIcon } from "./Icons";
import { nav } from "./nav";
import { useDraft } from "./Page";
import { useEditor } from "./store";
import { Help } from "./WikiLinks";

/** Options for Players, on the Project tab (core options.py). A group (Liberator Fire) has options (1, 2, 3): in the
    mod manager players tick the group and pick one option, or leave it unticked and get none of it. What each option
    changes is set in the Audio tab with the group's picker; each option says what it changes and about what it adds
    to the mod. Groups that change the same banks say so. */
export function ModOptions() {
  const { project, actions, revision } = useEditor();
  const p = project!;
  const [plan, setPlan] = useState<OptionsPlan | null>(null);
  const live = p.groups.length > 0;
  useEffect(() => { // what each option costs, and the groups that share banks: the core works it out from the game
    if (!live || p.game === "hd1") { setPlan(null); return; }
    let on = true;
    call<OptionsPlan>("options_plan").then((x) => { if (on) setPlan(x); }, () => { /* sizes stay out */ });
    return () => { on = false; };
  }, [revision, live, p.game]);
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
      </div>
    </section>
  );
}

/** A group's or option's image: the picture, or a box to choose one. Right-click or ✕ takes it away. */
function ImageBox({ group, option, image, label }: { group: string; option?: string; image: string; label: string }) {
  const { actions, project } = useEditor();
  const broken = project?.problem_kinds.includes("option_image") ?? false;
  const clear = () => (option ? actions.optionSet(group, option, { image: "" }) : actions.groupSet(group, { image: "" }));
  return (
    <span className={`opt-img${option ? " small" : ""}`}>
      <button className="opt-img-pick" onClick={() => void actions.optionImage(group, option)} aria-label={image ? t`Choose another image for ${label}` : t`Choose an image for ${label}`}
        data-tip={image ? t`Choose Another Image` : t`Choose an Image`}>
        {image && !broken ? <img src={optionImageUrl(group, option, image)} alt="" draggable={false} /> : <PlusIcon />}
      </button>
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
        <ImageBox group={g.id} image={g.image} label={g.name} />
        <div className="opt-texts">
          <Field className="opt-field opt-name" value={g.name} max={60} required label={t`Group name`} save={(name) => void actions.groupSet(g.id, { name })} />
          <Field className="opt-field opt-about" value={g.description} max={500} label={t`Description of ${g.name}`} placeholder={t`Description (Optional)`}
            save={(description) => void actions.groupSet(g.id, { description })} />
        </div>
        <span className="opt-tools">
          <button className="x" disabled={at === 0} onClick={() => void actions.groupMove(g.id, at - 1)} aria-label={t`Move ${g.name} up`} data-tip={t`Move up`}>↑</button>
          <button className="x" disabled={at === count - 1} onClick={() => void actions.groupMove(g.id, at + 1)} aria-label={t`Move ${g.name} down`} data-tip={t`Move down`}>↓</button>
          <button className="x" onClick={() => void remove()} aria-label={t`Remove ${g.name}`} data-tip={t`Remove the group`}>✕</button>
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
  const picked = project?.picks[g.id] === o.id;
  const saveGain = () => {
    const v = gain.trim() === "" ? 0 : Number(gain);
    if (!Number.isFinite(v) || v === o.gain_db) { setGain(o.gain_db ? String(o.gain_db) : ""); return; }
    void actions.optionSet(g.id, o.id, { gain_db: Math.max(-12, Math.min(12, v)) });
  };
  const edit = async () => { await actions.optionPick(g.id, o.id); nav.go("editor"); };
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
      <ImageBox group={g.id} option={o.id} image={o.image} label={o.name} />
      <Field className="opt-field opt-choice-name" value={o.name} max={60} required label={t`Option name`} save={(name) => void actions.optionSet(g.id, o.id, { name })} />
      <Field className="opt-field opt-about" value={o.description} max={500} label={t`Description of ${o.name}`} placeholder={t`Description (Optional)`}
        save={(description) => void actions.optionSet(g.id, o.id, { description })} />
      {what && <span className="opt-what">{what}</span>}
      <button className="btn quiet small-btn opt-edit" onClick={() => void edit()} aria-pressed={picked} data-tip={t`Pick this option in the Audio tab`}>
        {picked ? t`Picked` : t`Edit in Audio Tab`}</button>
      <label className="opt-gain" data-tip={t`Added to every slot the mod changes outside the groups, from −12 to +12 dB`}>
        <span><Trans>Gain</Trans></span>
        <input type="number" step={0.5} min={-12} max={12} value={gain} placeholder="0" onChange={(e) => setGain(e.target.value)} onBlur={saveGain}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} aria-label={t`Gain of ${o.name} (dB)`} /><span className="unit">dB</span>
      </label>
      <span className="opt-tools">
        <button className="x" disabled={k === 0} onClick={() => void actions.optionMove(g.id, o.id, k - 1)} aria-label={t`Move ${o.name} up`} data-tip={t`Move up`}>↑</button>
        <button className="x" disabled={k === g.options.length - 1} onClick={() => void actions.optionMove(g.id, o.id, k + 1)} aria-label={t`Move ${o.name} down`} data-tip={t`Move down`}>↓</button>
        <button className="x" onClick={() => void remove()} aria-label={t`Remove ${o.name}`} data-tip={t`Remove the option`}>✕</button>
      </span>
    </li>
  );
}

/** Over the Audio tab: a picker for each group, the option it plays and edits or Off, and where changes to slots no
    group has go. Shown once the project has a group. */
export function OptionPickers() {
  const { project, actions } = useEditor();
  if (!project?.groups.length) return null;
  const picked = project.groups.filter((g) => project.picks[g.id]);
  const target = project.target;
  return (
    <div className={`opt-bar${picked.length ? " on" : ""}`} role="group" aria-label={t`Options for Players`}>
      {project.groups.map((g) => {
        const pick = project.picks[g.id] ?? "";
        return (
          <label key={g.id} className={`opt-pick${pick ? " on" : ""}`} data-tip={t`What ${g.name} plays here`}
            data-tip-more={t`Changes to the slots of the group go into the option picked. Off: the mod without the group.`}>
            <span className="opt-pick-name">{g.name}</span>
            <select value={pick} onChange={(e) => void actions.optionPick(g.id, e.target.value || undefined)}>
              <option value="">{t({ message: "Off", comment: "A group for players unticked: none of the options of the group" })}</option>
              {g.options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
        );
      })}
      {picked.length > 0 && (
        <label className={`opt-pick opt-target${target === null ? " ask" : ""}`}
          data-tip={t`Where changes to slots go when no group has them yet`} data-tip-more={t`A picked group, or the mod without groups`}>
          <span className="opt-pick-name"><Trans>New Slots Go To</Trans></span>
          <select value={target ?? "?"} onChange={(e) => void actions.optionTarget(e.target.value)}>
            {target === null && <option value="?" disabled>{t`Choose…`}</option>}
            <option value="">{t({ message: "The Base Mod", comment: "The mod without the groups for players" })}</option>
            {picked.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </label>
      )}
      <Help tip={t`Pick an option of a group to hear it and change the slots of the group`} page="mod-options#in-the-audio-tab" />
    </div>
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
      {!s.on ? <Trans><b>{group}</b>: Off</Trans>
        : o ? <Trans><b>{group}: {option}</b>. Without the group: {base}.</Trans>
          : <Trans><b>{group}</b>: unchanged in {pickedName}</Trans>}
      {o && <>{" "}<button className="link-inline" onClick={() => void actions.optionSlotsOff([source])}>{t`Remove from Option`}</button></>}
    </p>
  );
}
