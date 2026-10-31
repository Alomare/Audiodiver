import { defineConfig } from "@lingui/cli";
import { formatter } from "@lingui/format-po";

// The app's languages (src/i18n.ts names them for Settings). English is written in the code; `npm run extract`
// collects it into src/locales/en/messages.po and adds the new messages to every other catalog, where they wait for a
// translation (English shows meanwhile). "pseudo" stretches and accents every message, to find text that isn't
// translatable yet and labels that get cut: development only.
export default defineConfig({
  sourceLocale: "en",
  // a new language also goes into LANGUAGES (src/i18n.ts), the installer's languages (tauri.conf.json) and the core's
  // catalogs (core/tools/i18n.py extract <language>)
  locales: ["en", "pt-BR", "zh-Hans", "fr", "es-ES", "ja", "pseudo"],
  pseudoLocale: "pseudo",
  fallbackLocales: { default: "en" },
  catalogs: [{ path: "<rootDir>/src/locales/{locale}/messages", include: ["src"], exclude: ["**/node_modules/**"] }],
  // Line numbers would change the catalogs on every edit of a file; the file names are enough to find a message.
  format: formatter({ origins: true, lineNumbers: false }),
});
