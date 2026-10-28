import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { App } from "./App";
import { EditorProvider } from "./store";

/** Draws the window. main.tsx imports this once the language has loaded (i18n.ts). */
export function boot() {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <I18nProvider i18n={i18n}>
        <EditorProvider>
          <App />
        </EditorProvider>
      </I18nProvider>
    </StrictMode>,
  );
}
