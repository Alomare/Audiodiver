import { CombinePage } from "./CombinePage";
import { nav, useNav, type ToolsTab as ToolsSub } from "./nav";
import { Page, tabArrows } from "./Page";
import { RepatchPage } from "./RepatchPage";
import { Help } from "./Wiki";

const SUBS: [ToolsSub, string, string][] = [
  ["repatch", "Repatch", "Rebuild an existing audio mod for the current game version"],
  ["combine", "Combine Mods", "Make one mod out of several audio mods"],
];

/** The Tools tab: work on existing mods, no project needed. Repatch (RepatchPage.tsx) rebuilds a mod on the game as it
    is now; Combine Mods (CombinePage.tsx) makes one mod out of several. */
export function ToolsTab() {
  const { tools: sub } = useNav();
  return (
    <Page title="Tools" wide lead={sub === "repatch"
      ? <>Rebuild an audio mod made for an older version of the game, or by another tool. <Help tip="Repatching" page="repatching" /></>
      : <>Make one mod out of several audio mods, built on the current game. <Help tip="Combining mods" page="combining-mods" /></>}>
      <div className="sub-tabs" role="tablist" aria-label="Tools" onKeyDown={tabArrows}>
        {SUBS.map(([id, name, about]) => (
          <button key={id} role="tab" aria-selected={sub === id} className={sub === id ? "on" : ""} data-tip={about}
            onClick={() => nav.go("tools", id)}>{name}</button>
        ))}
      </div>
      <div className="view-in bld-sub" key={sub}>
        {sub === "repatch" ? <RepatchPage /> : <CombinePage />}
      </div>
    </Page>
  );
}
