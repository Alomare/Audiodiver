import { i18n } from "@lingui/core";
import { nav } from "./nav";

/** The languages Audiodiver speaks, each named in itself (Settings ▸ System ▸ Language). English is written in the
    code; a message that has no translation yet shows in English. A new language also goes into lingui.config.ts. */
export const LANGUAGES = [
  { tag: "en", name: "English" },
  { tag: "pt-BR", name: "Português (Brasil)" },
  { tag: "zh-Hans", name: "简体中文" },
] as const;
export type Language = (typeof LANGUAGES)[number]["tag"];
/** Development only (lingui.config.ts): every message stretched and accented, to find what isn't translatable yet. */
export const PSEUDO = "pseudo";
export type Choice = Language | typeof PSEUDO | "auto";

const KEY = "audiodiver.language";          // the language chosen in Settings; none means Automatic
const AUTO_KEY = "audiodiver.autoLanguage"; // what Automatic picked last, so the next start opens in it

// Steam's names for the language a game is set to (the "language" in its app manifest, which the core reads)
const STEAM: Record<string, string> = { english: "en", brazilian: "pt-BR", portuguese: "pt-PT", latam: "es-419",
  spanish: "es-ES", french: "fr", german: "de", italian: "it", polish: "pl", russian: "ru", japanese: "ja",
  koreana: "ko", schinese: "zh-Hans", tchinese: "zh-Hant" };

const read = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key: string, value: string | null) => {
  try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* storage off */ }
};
const exact = (tag: string) => LANGUAGES.find((l) => l.tag.toLowerCase() === tag.toLowerCase())?.tag ?? null;

/** The language Audiodiver has closest to a tag ("pt-BR", "es_MX", "zh-TW", "de-AT"), or null. Spanish outside
    Spain reads the Latin American catalog, Portuguese outside Brazil the European one, and Chinese keeps to its
    script; any other region reads its language's catalog. */
export function closest(tag: string | null | undefined): Language | null {
  if (!tag) return null;
  const t = tag.replace(/_/g, "-");
  const [base, ...rest] = t.toLowerCase().split("-");
  const region = rest.find((p) => p.length === 2 || p === "419");
  if (base === "zh") return exact(rest.some((p) => ["hant", "tw", "hk", "mo"].includes(p)) ? "zh-Hant" : "zh-Hans");
  if (base === "es") return exact(!region || region === "es" ? "es-ES" : "es-419");
  if (base === "pt") return exact(!region || region === "br" ? "pt-BR" : "pt-PT");
  return exact(t) ?? LANGUAGES.find((l) => l.tag.split("-")[0].toLowerCase() === base)?.tag ?? null;
}

/** The language chosen in Settings, or "auto" to follow the game's language in Steam, then Windows, then English. */
export function chosenLanguage(): Choice {
  const v = read(KEY);
  if (v === PSEUDO) return import.meta.env.DEV ? PSEUDO : "auto";
  return exact(v ?? "") ?? "auto";
}

export const languageName = (tag: string) => LANGUAGES.find((l) => l.tag === tag)?.name ?? tag;

async function use(locale: string) {
  const { messages } = await import(`./locales/${locale}/messages.po`);
  i18n.load(locale, messages);
  i18n.activate(locale);
  document.documentElement.lang = locale === PSEUDO ? "en" : locale;
}

/** Loads the language to start in: the one chosen, else the one Automatic picked last time, else the Windows
    language as the webview has it, else English. main.tsx waits for it before importing the rest of the app, so
    the text modules set up as they load comes out in it too. */
export async function startLanguage() {
  const chosen = chosenLanguage();
  try {
    await use(chosen !== "auto" ? chosen : autoLanguage());
  } catch {
    await use("en"); // a catalog that didn't load: the window still opens
  }
}

/** The window opens again, where it was: how a language change takes effect (text is read as the app loads). */
function reopen() {
  nav.keepForReload();
  location.reload();
}

/** Once the core says which language the game is set to in Steam and which one Windows shows: Automatic takes the
    game's, else Windows', else English, and the window opens again in it if it started in another. */
let followed = false; // once per start: what the core says doesn't change while the app runs
export function followAuto(game: string | null | undefined, system: string | null | undefined) {
  if (followed || chosenLanguage() !== "auto") return;
  followed = true;
  const want = closest(STEAM[game ?? ""]) ?? closest(system) ?? "en";
  write(AUTO_KEY, want);
  if (want !== i18n.locale) reopen();
}

/** Settings: a language, or Automatic. The window opens again in it. */
export function chooseLanguage(choice: Choice) {
  write(KEY, choice === "auto" ? null : choice);
  reopen();
}

/** The language the core is told to speak (the pseudo-language of development is English to the core). */
export const coreLanguage = () => (i18n.locale === PSEUDO ? "en" : i18n.locale);

/** What Automatic would show now (for its entry in Settings). */
export const autoLanguage = (): Language => closest(read(AUTO_KEY)) ?? closest(navigator.language) ?? "en";
