import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// The typefaces Settings ▸ Theme offers, built into the app; a font's files load only once it is used.
// Archivo comes with its width axis, since big titles are set wide.
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/archivo/wdth-italic.css";
import "@fontsource-variable/noto-serif/wght.css";
import "@fontsource-variable/noto-serif/wght-italic.css";
import "@fontsource-variable/roboto-mono/wght.css";
import "@fontsource-variable/roboto-mono/wght-italic.css";
import "./styles.css";
import icon from "@logo/icon-dark-lowres.png";
import { App } from "./App";
import { EditorProvider } from "./store";
import { theme } from "./theme";

theme.init();

// Night mode's tint: one layer over everything, the start-up screens included. theme.ts turns it on and colours it.
const night = Object.assign(document.createElement("div"), { className: "night" });
night.setAttribute("aria-hidden", "true");
document.body.append(night);

// The page's icon, for when the interface runs in a browser (the desktop app's comes with its window).
document.head.append(Object.assign(document.createElement("link"), { rel: "icon", type: "image/png", href: icon }));

// The webview's own right-click menu (Back, Reload, Print…) has no place in an app. Text fields keep theirs, for cut,
// copy and paste; slots and music items open a menu of ours (they handle the event first).
window.addEventListener("contextmenu", (e) => {
  const t = e.target as HTMLElement;
  if (!t.closest?.('input:not([type=range]):not([type=checkbox]):not([type=radio]), textarea, [contenteditable="true"]')) e.preventDefault();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <EditorProvider>
      <App />
    </EditorProvider>
  </StrictMode>,
);
