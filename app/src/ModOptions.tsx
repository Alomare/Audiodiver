import { useEffect, useState } from "react";
import { plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { call, fmtDecimal, type ModOption, type OptionChoice, type OptionsPlan } from "./api";
import { confirm } from "./Confirm";
import { useContextMenu, type MenuEntry } from "./ContextMenu";
import { PlusIcon } from "./Icons";
import { nav } from "./nav";
import { useDraft } from "./Page";
import { useEditor } from "./store";
import { Help } from "./WikiLinks";

/** Options for Players, on the Project tab (core options.py): choices a player makes in the mod manager. Each option
    has choices, and the first is the mod as it is (Main). The others change some slots, set in the Audio tab with the
    Editing switch, or many at once with a gain or the original. Each choice says what it changes and about what it
    adds to the mod; options that change the same banks say so, with Combine. */
export function ModOptions() {
  const { project, actions, revision } = useEditor();
  const p = project!;
  const [plan, setPlan] = useState<OptionsPlan | null>(null);
  const [menu, openMenu] = useContextMenu();
  const live = p.options.some((o) => o.choices.length > 1);
  useEffect(() => { // what each choice costs, and the options that share banks: the core works it out from the game
    if (!live || p.game === "hd1") { setPlan(null); return; }
    let on = true;
    call<OptionsPlan>("options_plan").then((x) => { if (on) setPlan(x); }, () => { /* sizes stay out */ });
    return () => { on = false; };
  }, [revision, live, p.game]);

  const addMenu = (e: React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const entries: MenuEntry[] = [
      { label: t`Blank Option`, run: () => void actions.optionAdd("blank") },
      { label: t`Volume Levels`, run: () => void actions.optionAdd("volume") },
      ...(p.option_items.length ? ["-" as const] : []),
      ...p.option_items.map((i): MenuEntry => ({ label: t`Original or Replaced: ${i.name}`, run: () => void actions.optionAdd("original", [i.id]) })),
    ];
    openMenu({ clientX: r.left, clientY: r.bottom + 4, preventDefault() {}, stopPropagation() {} } as React.MouseEvent, entries);
  };
  const name = (id: string) => p.options.find((o) => o.id === id)?.name ?? id;

  return (
    <section className="set-sec opts" aria-label={t`Options for Players`}>
      <h2><Trans>Options for Players</Trans> <Help tip={t`Choices players make in the mod manager, such as how loud the mod plays or which music it brings.`} page="mod-options" /></h2>
      <p className="set-note">{p.options.length
        ? <Trans>Players pick one choice of each option in the mod manager. The first choice is the mod as it is.</Trans>
        : <Trans>Let players choose in the mod manager: a louder or quieter mod, part of it back to the original, or other audio in some slots.</Trans>}</p>
      {p.options.map((o, i) => <OptionBlock key={o.id} o={o} at={i} count={p.options.length} plan={plan} />)}
      {plan?.shared.map((s) => (
        <div key={`${s.a}:${s.b}`} className="warn-box opts-shared">
          <p>{plural(s.banks, {
            one: `${name(s.a)} and ${name(s.b)} change the same bank, so in Helldivers 2 mod managers the later one wins there whatever players pick.`,
            other: `${name(s.a)} and ${name(s.b)} change # of the same banks, so in Helldivers 2 mod managers the later one wins there whatever players pick.`,
          })}</p>
          <button className="btn" onClick={() => void actions.optionsCombine(s.a, s.b)}
            data-tip={t`One option with a choice for every pair of their choices`}><Trans>Combine into One Option</Trans></button>
        </div>
      ))}
      <div className="row-btns">
        <button className="btn" onClick={addMenu} aria-haspopup="menu"><PlusIcon /><Trans>Add Option</Trans></button>
      </div>
      {menu}
    </section>
  );
}

/** The Audio tab's Editing switch: what its edits go into, the mod as it is (Main) or a choice of an option. Shown
    once the project has an option with a choice to fill. */
export function EditingSwitch() {
  const { project, actions } = useEditor();
  const [menu, openMenu] = useContextMenu();
  const choices = (project?.options ?? []).flatMap((o) => o.choices.slice(1).map((c) => ({ o, c })));
  if (!project || !choices.length) return null;
  const e = project.editing;
  const open = (ev: React.MouseEvent) => {
    const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    openMenu({ clientX: r.left, clientY: r.bottom + 4, preventDefault() {}, stopPropagation() {} } as React.MouseEvent, [
      { label: t({ message: "Main", comment: "The mod as it is, without any choice of the options" }), disabled: !e, run: () => void actions.optionEditing() },
      "-",
      ...choices.map(({ o, c }): MenuEntry => ({ label: `${o.name}: ${c.name}`, disabled: e?.option === o.id && e.choice === c.id,
        run: () => void actions.optionEditing(o.id, c.id) })),
    ]);
  };
  return (
    <>
      <button className={`opt-switch${e ? " on" : ""}`} onClick={open} aria-haspopup="menu"
        data-tip={t`What the changes here go into`} data-tip-more={t`The mod as it is, or a choice players can pick in the mod manager (Project tab ▸ Options for Players)`}>
        <span className="opt-switch-label"><Trans comment="The Audio tab's switch: what the changes go into, Main or a choice">Editing</Trans></span>
        <b>{e ? e.choice_name : t({ message: "Main", comment: "The mod as it is, without any choice of the options" })}</b>
        <span className="caret" aria-hidden>▾</span>
      </button>
      {menu}
    </>
  );
}

/** Under the Audio tab's toolbar while a choice is picked: which one, and the way back to Main. */
export function EditingBand() {
  const { project, actions } = useEditor();
  const e = project?.editing;
  if (!e) return null;
  const changed = Object.keys(project!.choice_slots).length;
  return (
    <div className="opt-band" role="status">
      <span><Trans>Editing <b>{e.choice_name}</b> of {e.option_name}. Changes go into this choice; other slots play as in Main.</Trans>
        {" "}{plural(changed, { one: "# slot changed.", other: "# slots changed." })}</span>
      <button className="btn quiet small-btn" onClick={() => void actions.optionEditing()}><Trans>Back to Main</Trans></button>
    </div>
  );
}

/** What a choice changes, in one line: its rules, then the slots and cue points it sets. */
function changes(c: OptionChoice): string {
  const out: string[] = [];
  for (const r of c.rules) {
    const where = r.names.length ? r.names.join(", ") : t`every slot`;
    if (r.original) out.push(t`Original on ${where}`);
    if (r.gain_db) out.push(t`${fmtDecimal(r.gain_db, 1, true)} dB on ${where}`);
  }
  const own = c.slots - c.originals;
  if (own) out.push(plural(own, { one: "# slot with other audio or settings", other: "# slots with other audio or settings" }));
  if (c.originals) out.push(plural(c.originals, { one: "# slot back to the original", other: "# slots back to the original" }));
  if (c.cues) out.push(plural(c.cues, { one: "cue points of # segment", other: "cue points of # segments" }));
  return out.length ? out.join("; ") : t`The same as the first choice until it changes something`;
}

function OptionBlock({ o, at, count, plan }: { o: ModOption; at: number; count: number; plan: OptionsPlan | null }) {
  const { actions } = useEditor();
  const [name, setName] = useDraft(o.name);
  const [about, setAbout] = useDraft(o.description);
  const remove = async () => {
    const used = o.choices.slice(1).some((c) => c.slots || c.rules.length || c.cues);
    if (used && !(await confirm({ title: t`Remove ${o.name}?`, text: t`The choices and what they change go with it. Undo brings them back.`, ok: t`Remove` }))) return;
    void actions.optionRemove(o.id);
  };
  return (
    <div className="opt">
      <div className="opt-head">
        <input className="opt-name" value={name} maxLength={60} aria-label={t`Option name`} spellCheck={false}
          onChange={(e) => setName(e.target.value)} onBlur={() => { if (name.trim() && name.trim() !== o.name) void actions.optionSet(o.id, { name }); else setName(o.name); }}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
        <span className="opt-tools">
          <button className="x" disabled={at === 0} onClick={() => void actions.optionMove(o.id, at - 1)} aria-label={t`Move ${o.name} up`}
            data-tip={t`Move up`} data-tip-more={t`Options lower in the list deploy later, and win where two change one bank`}>↑</button>
          <button className="x" disabled={at === count - 1} onClick={() => void actions.optionMove(o.id, at + 1)} aria-label={t`Move ${o.name} down`} data-tip={t`Move down`}>↓</button>
          <button className="x" onClick={() => void remove()} aria-label={t`Remove ${o.name}`} data-tip={t`Remove the option`}>✕</button>
        </span>
      </div>
      <input className="opt-about" value={about} maxLength={500} placeholder={t`What players read about it (optional)`} aria-label={t`Description of ${o.name}`}
        onChange={(e) => setAbout(e.target.value)} onBlur={() => { if (about !== o.description) void actions.optionSet(o.id, { description: about }); }}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
      <ol className="opt-choices">
        {o.choices.map((c, k) => <ChoiceRow key={c.id} o={o} c={c} k={k} cost={plan?.choices[`${o.id}/${c.id}`]} />)}
      </ol>
      <button className="btn quiet small-btn opt-add" onClick={() => void actions.choiceAdd(o.id)} disabled={o.choices.length >= 16}><PlusIcon /><Trans>Add Choice</Trans></button>
    </div>
  );
}

function ChoiceRow({ o, c, k, cost }: { o: ModOption; c: OptionChoice; k: number; cost?: { banks: number; mb: number } }) {
  const { actions, project } = useEditor();
  const [name, setName] = useDraft(c.name);
  const gainRule = c.rules.find((r) => r.gain_db && !r.original);
  const [gain, setGain] = useDraft(gainRule ? String(gainRule.gain_db) : "");
  const main = k === 0;
  const editing = project?.editing?.option === o.id && project.editing.choice === c.id;
  const setGainRule = () => {
    const v = gain.trim() === "" ? 0 : Number(gain);
    if (!Number.isFinite(v) || v === (gainRule?.gain_db ?? 0)) { setGain(gainRule ? String(gainRule.gain_db) : ""); return; }
    const rest = c.rules.filter((r) => r !== gainRule).map(({ gain_db, original, items }) => ({ gain_db, original, items }));
    void actions.choiceSet(o.id, c.id, { rules: [...rest, ...(v ? [{ gain_db: Math.max(-12, Math.min(12, v)), original: false, items: gainRule?.items ?? [] }] : [])] });
  };
  const edit = async () => { await actions.optionEditing(o.id, c.id); nav.go("editor"); };
  return (
    <li className={`opt-choice${main ? " main" : ""}${editing ? " editing" : ""}`}>
      <input className="opt-choice-name" value={name} maxLength={60} aria-label={t`Choice name`} spellCheck={false}
        onChange={(e) => setName(e.target.value)} onBlur={() => { if (name.trim() && name.trim() !== c.name) void actions.choiceSet(o.id, c.id, { name }); else setName(c.name); }}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
      {main ? <span className="opt-what"><Trans>The mod as it is, what players get unless they pick another choice</Trans></span> : <>
        <span className="opt-what">{changes(c)}{cost && cost.banks > 0 && <span className="opt-cost" data-tip={t`About what this choice adds to the mod`}
          data-tip-more={plural(cost.banks, { one: "The game's bank it changes, and the streams of the slots it gives other audio", other: "The # game banks it changes, and the streams of the slots it gives other audio" })}>{" "}+{fmtDecimal(cost.mb, 1)} MB</span>}</span>
        <label className="opt-gain" data-tip={t`Make-Up Gain added to every slot the mod changes, from −12 to +12 dB`}>
          <span><Trans>Gain</Trans></span>
          <input type="number" step={0.5} min={-12} max={12} value={gain} placeholder="0" onChange={(e) => setGain(e.target.value)} onBlur={setGainRule}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} aria-label={t`Gain of ${c.name} (dB)`} /><span className="unit">dB</span>
        </label>
        <span className="opt-tools">
          <button className="btn quiet small-btn" onClick={() => void edit()} aria-pressed={editing}
            data-tip={t`Pick this choice in the Audio tab's Editing switch`} data-tip-more={t`Audio, gain, fades and the Waveform Editor then change this choice, not the mod as it is`}>
            {editing ? t`Editing` : t`Edit in Audio Tab`}</button>
          <button className="x" disabled={k <= 1} onClick={() => void actions.choiceMove(o.id, c.id, k - 1)} aria-label={t`Move ${c.name} up`} data-tip={t`Move up`}>↑</button>
          <button className="x" disabled={k === o.choices.length - 1} onClick={() => void actions.choiceMove(o.id, c.id, k + 1)} aria-label={t`Move ${c.name} down`} data-tip={t`Move down`}>↓</button>
          <button className="x" onClick={() => void actions.choiceRemove(o.id, c.id)} aria-label={t`Remove ${c.name}`} data-tip={t`Remove the choice`}>✕</button>
        </span>
      </>}
    </li>
  );
}
