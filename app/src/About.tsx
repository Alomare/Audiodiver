import { useDialog } from "./dialog";
import { APP_LABEL, APP_VERSION, CREDITS, DISCORD_URL, HOME_ART, KOFI_URL, LICENCE, REPO_URL, versionLabel } from "./content";
import { DiscordIcon, ExternalIcon, InfoIcon, KofiIcon } from "./Icons";
import { Logo } from "./Logo";
import { about, useAboutOpen } from "./nav";
import { openUrl, reveal } from "./platform";
import { useEditor } from "./store";

// About Audiodiver: the version, the licence and the source, the log file, and the credits (the one place the app
// names the people and sources it builds on). It opens from the ⓘ next to the version in the status bar and from
// [About](app:about) in the Wiki.

/** The small circled "i" that opens About. */
export function AboutButton({ className }: { className?: string }) {
  return (
    <button className={`about-btn${className ? ` ${className}` : ""}`} onClick={about.open} aria-label="About Audiodiver"
      data-tip="About Audiodiver" data-tip-more="Version, license, log file and credits"><InfoIcon /></button>
  );
}

export function AboutDialog() {
  return useAboutOpen() ? <AboutBox /> : null;
}

function AboutBox() {
  const box = useDialog(about.close);
  return (
    <div className="modal-back" onPointerDown={(e) => { if (e.target === e.currentTarget) about.close(); }}>
      <div className="modal narrow about" role="dialog" aria-modal="true" aria-label="About Audiodiver" ref={box} tabIndex={-1}>
        <About />
      </div>
    </div>
  );
}

function About() {
  const { status } = useEditor();
  const core = status?.version && status.version !== APP_VERSION ? status.version : null;
  return (
    <>
      <div className="about-head">
        <div className="about-brand">
          <Logo detail />
          <div>
            <b>Audiodiver</b>
            <span>{APP_LABEL}<span className="about-ver">{APP_VERSION}</span>{core && ` · core ${versionLabel(core)}`}</span>
          </div>
        </div>
        <button className="x" onClick={about.close} aria-label="Close">✕</button>
      </div>
      <p className="about-licence">
        Free software under the <button className="link-text" onClick={() => openUrl(LICENCE.url)}>{LICENCE.name}</button>.
      </p>
      <div className="row-btns">
        <button className="btn" onClick={() => openUrl(REPO_URL)}>Source code <ExternalIcon /></button>
        <button className="btn" onClick={() => openUrl(DISCORD_URL)} data-tip="Helldivers 2 Modding on Discord"
          data-tip-more="Questions, feedback and help"><DiscordIcon /> Discord <ExternalIcon /></button>
        <button className="btn" onClick={() => openUrl(KOFI_URL)} data-tip="Support Audiodiver on Ko-fi"
          data-tip-more="Opens ko-fi.com/alomare"><KofiIcon /> Ko-fi <ExternalIcon /></button>
      </div>
      <dl className="set-facts">
        <dt>Log file</dt>
        <dd>{status?.log ? <><span className="path-text">{status.log}</span><button className="link-inline" onClick={() => reveal(status.log)}>Show</button></> : "None"}</dd>
      </dl>
      <section className="about-credits">
        <h2>Credits</h2>
        {CREDITS.map((g) => (
          <div key={g.group} className="credits">
            <h3>{g.group}</h3>
            <ul>
              {g.items.filter((c) => c.name !== "Home art" || HOME_ART.length > 0).map((c) => (
                <li key={c.name}>
                  {c.url ? <button className="link-text" onClick={() => openUrl(c.url!)}>{c.name}</button> : <b>{c.name}</b>}
                  {c.by && <span className="muted"> by {c.by}</span>}
                  {c.licence && <span className="credit-licence">{c.licence}</span>}
                  <span className="credit-for">{c.for}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </>
  );
}
