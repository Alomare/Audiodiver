import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { TooltipLayer } from "./Tooltip";
import { Wiki } from "./Wiki";

/** Draws the Wiki's own window (wikiWindow.ts): only the Wiki and its tooltips, with no project and no core. main.tsx
    imports this in place of boot.tsx. */
export function boot() {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <I18nProvider i18n={i18n}>
        <div className="wiki-window">
          <Wiki />
        </div>
        <TooltipLayer />
      </I18nProvider>
    </StrictMode>,
  );
}
