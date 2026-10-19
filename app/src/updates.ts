// Audiodiver's own updates: its releases on GitHub (asked through the core, updates.py), whether one is newer than
// this app, and installing it. The desktop shell's updater plugin downloads the installer named in the release's
// latest.json, checks its signature and runs it; Audiodiver closes while it installs and opens again on the new
// version. Where the shell has no updater (or the release no latest.json), Update opens the release's page instead.
import { useSyncExternalStore } from "react";
import { call } from "./api";
import { APP_VERSION } from "./content";
import { isTauri, openUrl } from "./platform";
import { settings } from "./settings";

export type RemoteRelease = {
  version: string; name: string; date: string; notes: string; url: string; prerelease: boolean;
  installer: { name: string; size: number; url: string } | null;
};
type Answer = { repo: string; releases: RemoteRelease[]; checked: number; error: string | null };

/** idle: not asked yet. ready: GitHub answered (latest says whether there is something newer). failed: it didn't. */
export type Phase = "idle" | "checking" | "ready" | "failed" | "downloading" | "installing";
export type UpdateState = {
  phase: Phase;
  releases: RemoteRelease[];     // newest first
  latest: RemoteRelease | null;  // the newest release after this app's version
  checked: number | null;        // when GitHub last answered (seconds)
  error: string | null;          // why the check failed: "offline", "limit", or what went wrong
  failedAt: number;              // when it failed (ms), for waiting a while after GitHub's limit
  installError: string | null;   // why the last install stopped
  got: number; total: number;    // bytes of the update downloaded, of how many
};

/** Orders versions as semver does: 1.0.0-beta.2 < 1.0.0-beta.10 < 1.0.0-rc.1 < 1.0.0 < 1.0.1. */
export function compareVersions(a: string, b: string): number {
  const split = (v: string) => {
    const [main, pre = ""] = v.trim().replace(/^v/i, "").split("+")[0].split(/-(.*)/s);
    return { nums: main.split(".").map((n) => Number(n) || 0), pre: pre ? pre.split(".") : [] };
  };
  const x = split(a), y = split(b);
  for (let i = 0; i < 3; i++) if ((x.nums[i] ?? 0) !== (y.nums[i] ?? 0)) return (x.nums[i] ?? 0) - (y.nums[i] ?? 0);
  if (!x.pre.length || !y.pre.length) return y.pre.length - x.pre.length; // a release comes after its pre-releases
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i], q = y.pre[i];
    if (p === undefined || q === undefined) return p === undefined ? -1 : 1;
    if (p === q) continue;
    const pn = /^\d+$/.test(p), qn = /^\d+$/.test(q);
    if (pn && qn) return Number(p) - Number(q);
    if (pn !== qn) return pn ? -1 : 1;
    return p < q ? -1 : 1;
  }
  return 0;
}

let state: UpdateState = { phase: "idle", releases: [], latest: null, checked: null, error: null, failedAt: 0, installError: null, got: 0, total: 0 };
const listeners = new Set<() => void>();
let frame = 0;
function set(patch: Partial<UpdateState>, soon = false) {
  state = { ...state, ...patch };
  if (!soon) { cancelAnimationFrame(frame); frame = 0; listeners.forEach((f) => f()); return; }
  // download progress arrives in many small pieces: the screen hears of it once a frame
  frame ||= requestAnimationFrame(() => { frame = 0; listeners.forEach((f) => f()); });
}

const busy = () => state.phase === "checking" || state.phase === "downloading" || state.phase === "installing";
let startup: Promise<StartupAction | null> | null = null;
let claimed = false;
/** What the startup check leaves to the window: ask (the prompt) or install straight away. */
export type StartupAction = "prompt" | "auto";

export const updates = {
  get: () => state,
  subscribe(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; },

  /** Asks GitHub (through the core) which releases there are. `force` skips the core's ten-minute memory. */
  async check(force = false) {
    if (busy()) return;
    set({ phase: "checking" });
    try {
      const a = await call<Answer>("releases", { force });
      if (a.error) return set({ phase: "failed", error: a.error, failedAt: Date.now() });
      const releases = [...a.releases].sort((x, y) => compareVersions(y.version, x.version));
      set({ phase: "ready", releases, latest: releases.find((r) => compareVersions(r.version, APP_VERSION) > 0) ?? null,
        checked: a.checked, error: null });
    } catch (e: any) {
      set({ phase: "failed", error: e.message ?? String(e) });
    }
  },

  /** The check at startup, once per launch: what the setting says to do about a new version, if there is one
      (Manual only lights the Updates tab up). Automatic needs the desktop app; in a browser it asks instead. */
  startup(): Promise<StartupAction | null> {
    startup ??= updates.check().then(() => {
      if (!state.latest) return null;
      const mode = settings.get().updates;
      return mode === "manual" ? null : mode === "auto" && isTauri() ? "auto" : "prompt";
    });
    return startup;
  },

  /** True the first time it is asked in a launch: the startup question (or the automatic update) happens once, even
      when the window's main part mounts again (the game read from another folder brings the start-up screen back). */
  claimStartup() {
    if (claimed) return false;
    claimed = true;
    return true;
  },

  /** Downloads and installs the newest release. Resolves "page" when it can't be installed from here (no updater in
      this shell, or no latest.json in the release): the release's page opens in the browser, unless `openPage` is
      false (the automatic update at startup). "browser": outside the desktop app. `onStart` hears when the download
      really starts. */
  async install(openPage = true, onStart?: () => void): Promise<"installing" | "page" | "browser" | "failed"> {
    const target = state.latest;
    if (!target || busy()) return "failed";
    if (!isTauri()) return "browser";
    set({ phase: "downloading", got: 0, total: target.installer?.size ?? 0, installError: null });
    let update;
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      update = await check({ timeout: 30000 });
    } catch { update = null; } // the shell has no updater yet
    if (!update || compareVersions(update.version, target.version) < 0) {
      set({ phase: "ready" });
      if (openPage) await openUrl(target.url);
      return "page";
    }
    try {
      await update.downloadAndInstall((ev) => {
        if (ev.event === "Started") { set({ total: ev.data.contentLength ?? state.total }); onStart?.(); }
        else if (ev.event === "Progress") set({ got: state.got + ev.data.chunkLength }, true);
        else set({ phase: "installing" });
      });
      return "installing"; // the installer closes Audiodiver and opens the new version
    } catch (e: any) {
      set({ phase: "ready", installError: e.message ?? String(e) });
      return "failed";
    }
  },
};

export const useUpdates = () => useSyncExternalStore(updates.subscribe, updates.get);
