/** Which app this is: Audiodiver, or Audiodiver Utils (the same app showing only the Tools: Repatch, Combine Mods and
    the installed mods check, without projects). The shell says so before the page's scripts run, when a `utils.txt`
    is beside the exe (lib.rs); in a browser against the dev servers, `?edition=utils` does the same. */
export const UTILS = (window as { __AUDIODIVER_EDITION__?: string }).__AUDIODIVER_EDITION__ === "utils"
  || new URLSearchParams(location.search).get("edition") === "utils";

/** This window is the Wiki on its own (wikiWindow.ts): the page opened with `?view=wiki`. */
export const WIKI_WINDOW = new URLSearchParams(location.search).get("view") === "wiki";

/** The app's name, as the window title and the start-up card show it. */
export const APP_NAME = UTILS ? "Audiodiver Utils" : "Audiodiver";

/** The Wiki pages Audiodiver Utils lists (its other pages still open from a link). */
export const UTILS_WIKI = new Set(["repatching", "combining-mods", "tools-and-links"]);
