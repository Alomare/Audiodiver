import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { lingui } from "@lingui/vite-plugin";
import pkg from "./package.json";

// The official logo files live next to the app, in ../assets/logo: the app takes them from there (@logo/…), so
// there is one copy of each to keep up to date.
const logo = fileURLToPath(new URL("../assets/logo", import.meta.url));

export default defineConfig({
  // lingui: the t`…` and <Trans> macros become catalog lookups, and a language's .po catalog compiles when it loads
  plugins: [react(), lingui({ macroTransform: true, failOnCompileError: true })],
  clearScreen: false,
  resolve: { alias: { "@logo": logo } },
  // The Rust build writes thousands of files under src-tauri/target; watching them pins a CPU core or two.
  server: { port: 1420, strictPort: true, watch: { ignored: ["**/src-tauri/**"] }, fs: { allow: [".", logo] } },
  build: { target: "es2022" },
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
});
