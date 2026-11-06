import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { CombinePage } from "./CombinePage";
import { nav, useNav, type ToolsTab as ToolsSub } from "./nav";
import { Page, tabArrows } from "./Page";
import { PatchContentPage } from "./PatchContentPage";
import { RepatchPage } from "./RepatchPage";
import { Help } from "./Wiki";

const SUBS: [ToolsSub, string, string][] = [
  ["repatch", t`Repatch`, t`Rebuild an existing audio mod for the current game version`],
  ["combine", t`Combine Mods`, t`Make one mod out of several audio mods`],
  ["content", t`Patch Content`, t`Give new audio to sounds inside an existing mod, also sounds the game no longer has`],
];

/** The Tools tab: work on existing mods, no project needed. Repatch (RepatchPage.tsx) rebuilds a mod on the game as it
    is now; Combine Mods (CombinePage.tsx) makes one mod out of several; Patch Content (PatchContentPage.tsx) gives
    sounds inside a mod new audio, on the mod's own banks. */
export function ToolsTab() {
  const { tools: sub } = useNav();
  return (
    <Page title={t`Tools`} wide lead={sub === "repatch"
      ? <><Trans>Rebuild an audio mod made for an older version of the game, or by another tool.</Trans>{" "}
        <Help tip={t`A mod holds copies of the sound banks from the game version it was made for. Repatching puts the mod's audio into the current banks`} page="repatching" /></>
      : sub === "content"
      ? <><Trans>Replace sounds inside an existing mod, also sounds that an update took out of the game.</Trans>{" "}
        <Help tip={t`A mod holds copies of the sound banks from the game version it was made for, and the game plays those copies instead of the current banks. A sound the copies still have can get new audio there`} page="patch-content" /></>
      : <><Trans>Make one mod out of several audio mods, built on the current game.</Trans>{" "}
        <Help tip={t`When two mods change the same sound bank, only the one deployed later plays. Combining puts both into one mod`} page="combining-mods" /></>}>
      <div className="sub-tabs" role="tablist" aria-label={t`Tools`} onKeyDown={tabArrows}>
        {SUBS.map(([id, name, about]) => (
          <button key={id} role="tab" aria-selected={sub === id} className={sub === id ? "on" : ""} data-tip={about}
            onClick={() => nav.go("tools", id)}>{name}</button>
        ))}
      </div>
      <div className="view-in bld-sub" key={sub}>
        {sub === "repatch" ? <RepatchPage /> : sub === "content" ? <PatchContentPage /> : <CombinePage />}
      </div>
    </Page>
  );
}
