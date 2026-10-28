/// <reference types="vite/client" />

/** The app's version, from package.json (vite.config.ts). */
declare const __APP_VERSION__: string;

/** A language's catalog, compiled by the Lingui plugin when it is imported (i18n.ts). */
declare module "*.po" {
  export const messages: import("@lingui/core").Messages;
}
