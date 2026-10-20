import type { Token } from "marked";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { fmtBytes, fmtWhen } from "./api";
import { APP_LABEL, APP_VERSION, fmtDate, RELEASES, REPO_URL, versionLabel } from "./content";
import { Fold } from "./Fold";
import { CheckIcon, CollapseAllIcon, ExternalIcon, UpdatesIcon } from "./Icons";
import { Logo } from "./Logo";
import { Markdown, parse } from "./Markdown";
import { nav } from "./nav";
import { Page } from "./Page";
import { openUrl } from "./platform";
import { UPDATE_MODES, UPDATE_NOTES, useSettings } from "./settings";
import { useEditor } from "./store";
import { useDialog } from "./dialog";
import { compareVersions, updates, useUpdates, type RemoteRelease, type UpdateState } from "./updates";

/** Installs the newest version from a button, and says why when it can't from here. */
export function useInstall() {
  const { quick } = useEditor();
  return async () => {
    const r = await updates.install();
    if (r === "browser") quick("Updates install from the desktop app", "info");
    else if (r === "page") quick("Download page opened in the browser", "info");
  };
}

/** The Updates tab: this version and whether a newer one is out (and installing it), then every version's changes. */
export function UpdatesTab() {
  const u = useUpdates();
  useEffect(() => { if (u.phase === "idle") updates.check(); }, [u.phase]);
  return (
    <Page title="Updates">
      <UpdateCard u={u} />
      <Changelog releases={u.releases} waiting={u.phase === "idle" || (u.phase === "checking" && u.checked === null)}
        failed={u.phase === "failed" && u.checked === null} />
    </Page>
  );
}

const CHECK_ERRORS: Record<string, string> = { offline: "Can't reach GitHub", limit: "Too many checks this hour" };

function UpdateCard({ u }: { u: UpdateState }) {
  const { updates: mode } = useSettings();
  const install = useInstall();
  const latest = u.latest;
  const working = u.phase === "downloading" || u.phase === "installing";
  const [, tick] = useState(0);
  const limited = u.phase === "failed" && u.error === "limit" && Date.now() < u.failedAt + 5 * 60_000;
  useEffect(() => { // the button comes back by itself once the five minutes are over
    if (!limited) return;
    const t = setTimeout(() => tick((n) => n + 1), u.failedAt + 5 * 60_000 - Date.now() + 50);
    return () => clearTimeout(t);
  }, [limited, u.failedAt]);
  const size = latest?.installer?.size;

  let tone = "current", icon: ReactNode = <CheckIcon />, title: ReactNode, sub: ReactNode = null, action: ReactNode = null;
  if (u.phase === "downloading" || u.phase === "installing") {
    tone = "new"; icon = <UpdatesIcon />;
    title = u.phase === "installing" ? `Installing ${versionLabel(latest!.version)}` : `Downloading ${versionLabel(latest!.version)}`;
    sub = u.phase === "installing" ? "Audiodiver restarts when the update is installed."
      : u.total ? `${fmtBytes(u.got)} of ${fmtBytes(u.total)}` : fmtBytes(u.got);
  } else if (latest) {
    tone = "new"; icon = <UpdatesIcon />;
    title = `${versionLabel(latest.version)} is available`;
    sub = [latest.date && `Released ${fmtDate(latest.date)}`, size && fmtBytes(size)].filter(Boolean).join(" · ");
    action = <button className="btn primary" onClick={install}>Update now</button>;
  } else if (u.phase === "failed") {
    tone = "warn"; icon = <span className="upd-bang" aria-hidden>!</span>;
    title = CHECK_ERRORS[u.error ?? ""] ?? "Couldn't check for updates";
    sub = u.error === "limit" ? (limited ? "GitHub allows 60 checks an hour. Try again in a few minutes." : "GitHub allows 60 checks an hour.") : u.error === "offline" ? "Check the internet connection." : u.error;
  } else if (u.checked === null) {
    tone = "wait"; icon = <span className="upd-spin" aria-hidden />;
    title = "Checking for updates…";
  } else {
    title = "Up to date";
    sub = `Checked ${fmtWhen(u.checked)}`;
  }

  return (
    <>
      <section className={`upd-card ${tone}`} aria-label="This version">
        <div className="upd-app">
          <Logo detail />
          <div className="upd-app-name">
            <b>Audiodiver {APP_LABEL}</b>
            <span className="upd-ver">{APP_VERSION}</span>
          </div>
          {/* after GitHub's hourly limit, another check now would only fail again */}
          <button className={`btn${u.phase === "failed" ? "" : " quiet"}`} disabled={u.phase === "checking" || working || limited}
            onClick={() => updates.check(true)}>{u.phase === "failed" ? "Try again" : u.phase === "checking" && u.checked !== null ? "Checking…" : "Check now"}</button>
        </div>
        <div className="upd-state" role="status" aria-live="polite">
          <span className={`upd-icon ${tone}`}>{icon}</span>
          <div className="upd-text">
            <b>{title}</b>
            {sub && <span>{sub}</span>}
            {u.phase === "downloading" && (
              <div className={`job-bar${u.total ? "" : " unknown"}`} role="progressbar" aria-valuemin={0} aria-valuemax={100}
                aria-valuenow={u.total ? Math.round((u.got / u.total) * 100) : undefined}>
                <div style={u.total ? { transform: `scaleX(${Math.min(1, u.got / u.total)})` } : undefined} />
              </div>
            )}
          </div>
          {action}
        </div>
        {u.phase === "failed" && latest && (
          <p className="info-box">Couldn't check again ({CHECK_ERRORS[u.error ?? ""] ?? u.error}). The list below is from {fmtWhen(u.checked)}.</p>
        )}
        {u.installError && latest && (
          <p className="warn-box" role="alert">Couldn't install: {u.installError}{" "}
            <button className="link-inline" onClick={() => openUrl(latest.url)}>Download it from GitHub</button></p>
        )}
      </section>
      <p className="upd-foot">
        <span>{UPDATE_NOTES[mode]}</span>
        <button className="link-inline" onClick={() => nav.go("settings", "system")}
          data-tip={`Settings ▸ System: ${UPDATE_MODES.find(([m]) => m === mode)?.[1]}`}>Change</button>
        <span className="spacer" />
        <button className="link-text" onClick={() => openUrl(`${REPO_URL}/releases`)}>Releases on GitHub <ExternalIcon /></button>
      </p>
    </>
  );
}

type Entry = { version: string; date: string; tokens: Token[]; url?: string; when: "new" | "installed" | "older" };

/** Every version there are notes for, newest first: GitHub's releases, and the changelog this app was built with
    (so the installed version and older ones read offline too). */
function entriesOf(releases: RemoteRelease[]): Entry[] {
  const when = (v: string): Entry["when"] => {
    const c = compareVersions(v, APP_VERSION);
    return c > 0 ? "new" : c === 0 ? "installed" : "older";
  };
  const by = new Map<string, Entry>();
  for (const r of RELEASES) by.set(r.version, { version: r.version, date: r.date, tokens: r.tokens, when: when(r.version) });
  for (const r of releases) {
    const had = by.get(r.version);
    by.set(r.version, { version: r.version, date: r.date || had?.date || "", url: r.url, when: when(r.version),
      tokens: r.notes.trim() ? parse(r.notes).tokens : had?.tokens ?? [] });
  }
  return [...by.values()].sort((a, b) => compareVersions(b.version, a.version));
}

/** The versions as a timeline. New ones and the installed one start open, older ones folded. */
function Changelog({ releases, waiting, failed }: { releases: RemoteRelease[]; waiting: boolean; failed: boolean }) {
  const entries = useMemo(() => entriesOf(releases), [releases]);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const isOpen = (e: Entry) => open[e.version] ?? e.when !== "older";
  const anyOpen = entries.some(isOpen);
  return (
    <section className="upd-log" aria-label="Changelog">
      <div className="upd-log-head">
        <h2>Changelog</h2>
        {entries.length > 1 && (
          <button className="icon-btn" disabled={!anyOpen} aria-label="Collapse all"
            onClick={() => setOpen(Object.fromEntries(entries.map((e) => [e.version, false])))}
            data-tip={anyOpen ? "Collapse all" : "Every version is collapsed"}><CollapseAllIcon /></button>
        )}
      </div>
      {entries.length ? (
        <ol className="upd-timeline">
          {entries.map((e) => {
            const shown = isOpen(e);
            return (
              <li key={e.version} className={`upd-entry ${e.when}${shown ? " open" : ""}`}>
                <button className="upd-entry-head" aria-expanded={shown} onClick={() => setOpen((o) => ({ ...o, [e.version]: !shown }))}>
                  <span className="caret" aria-hidden>▸</span>
                  <b>{versionLabel(e.version)}</b>
                  <span className="upd-ver">{e.version}</span>
                  {e.when === "new" && <span className="upd-badge new">New</span>}
                  {e.when === "installed" && <span className="upd-badge installed">Installed</span>}
                  <span className="spacer" />
                  {e.date && <span className="upd-date">{fmtDate(e.date)}</span>}
                </button>
                <Fold open={shown}>
                  <div className="upd-entry-body">
                    {e.tokens.length ? <Markdown tokens={e.tokens} /> : <p className="muted">No notes for this version.</p>}
                    {e.url && <button className="link-text" onClick={() => openUrl(e.url!)}>On GitHub <ExternalIcon /></button>}
                  </div>
                </Fold>
              </li>
            );
          })}
        </ol>
      ) : (
        !waiting && <p className="upd-empty">{failed ? "The changelog comes from GitHub, which couldn't be reached." : "No releases yet."}</p>
      )}
    </section>
  );
}

/** At startup, with Prompt on startup (Settings ▸ System): a new version, and what to do about it. */
export function UpdatePrompt({ onClose }: { onClose: () => void }) {
  const u = useUpdates();
  const install = useInstall();
  const box = useDialog(onClose); // the dialog takes the focus, not Update now: a key pressed as it opens updates nothing
  const latest = u.latest;
  if (!latest) return null;
  const size = latest.installer?.size;
  return (
    <div className="modal-back" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal narrow upd-prompt" role="dialog" aria-modal="true" aria-label="A new version of Audiodiver" ref={box} tabIndex={-1}>
        <div className="upd-prompt-head">
          <span className="upd-icon new"><UpdatesIcon /></span>
          <div>
            <h2>{versionLabel(latest.version)} is available</h2>
            <p>{[latest.date && `Released ${fmtDate(latest.date)}`, size && fmtBytes(size)].filter(Boolean).join(" · ")}
              {latest.date || size ? ". " : ""}You have {APP_LABEL}.</p>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn primary" onClick={() => { onClose(); nav.go("updates"); install(); }}>Update now</button>
          <button className="btn" onClick={() => { onClose(); nav.go("updates"); }}>Read the changelog</button>
          <span className="spacer" />
          <button className="btn quiet" onClick={onClose}>Not now</button>
        </div>
      </div>
    </div>
  );
}
