import { ph, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useDialog } from "./dialog";
import { APP_NAME } from "./edition";
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
    <button className={`about-btn${className ? ` ${className}` : ""}`} onClick={about.open} aria-label={t`About ${APP_NAME}`}
      data-tip={t`About ${APP_NAME}`} data-tip-more={t`Version, license, log file and credits`}><InfoIcon /></button>
  );
}

export function AboutDialog() {
  return useAboutOpen() ? <AboutBox /> : null;
}

function AboutBox() {
  const box = useDialog(about.close);
  return (
    <div className="modal-back" onPointerDown={(e) => { if (e.target === e.currentTarget) about.close(); }}>
      <div className="modal narrow about" role="dialog" aria-modal="true" aria-label={t`About ${APP_NAME}`} ref={box} tabIndex={-1}>
        <About />
      </div>
    </div>
  );
}

function About() {
  const { status } = useEditor();
  const core = status?.version && status.version !== APP_VERSION ? versionLabel(status.version) : null;
  const licence = LICENCE.name;
  return (
    <>
      <div className="about-head">
        <div className="about-brand">
          <Logo detail />
          <div>
            <b>{APP_NAME}</b>
            <span>{APP_LABEL}{core && ` · ${t({ message: `core ${core}`, comment: "The version of the Audiodiver core, the program behind the window" })}`}</span>
          </div>
        </div>
        <button className="x" onClick={about.close} aria-label={t`Close`}>✕</button>
      </div>
      <p className="about-licence">
        <Trans>Free software under the <button className="link-text" onClick={() => openUrl(LICENCE.url)}>{licence}</button>.</Trans>
      </p>
      <div className="row-btns">
        <button className="btn" onClick={() => openUrl(REPO_URL)}><Trans>Source Code</Trans> <ExternalIcon /></button>
        <button className="btn" onClick={() => openUrl(DISCORD_URL)} data-tip={t`Helldivers 2 Modding on Discord`}
          data-tip-more={t`Questions, feedback and help`}><DiscordIcon /> Discord <ExternalIcon /></button>
        <button className="btn" onClick={() => openUrl(KOFI_URL)} data-tip={t`Support Audiodiver on Ko-fi`}
          data-tip-more={t`Opens ko-fi.com/alomare`}><KofiIcon /> Ko-fi <ExternalIcon /></button>
      </div>
      <dl className="set-facts">
        <dt><Trans>Log file</Trans></dt>
        <dd>{status?.log ? <><span className="path-text">{status.log}</span><button className="link-inline" onClick={() => reveal(status.log)}
          data-tip={t`Show the log file in Explorer`} data-tip-more={t`Attach it to a bug report`}><Trans comment="Button: shows the log file in Explorer">Show</Trans></button></>
          : t({ message: "None", comment: "No log file" })}</dd>
      </dl>
      <section className="about-credits">
        <h2><Trans>Credits</Trans></h2>
        {CREDITS.map((g) => (
          <div key={g.group} className="credits">
            <h3>{g.group}</h3>
            <ul>
              {g.items.filter((c) => c.id !== "home-art" || HOME_ART.length > 0).map((c) => (
                <li key={c.name}>
                  {c.url ? <button className="link-text" onClick={() => openUrl(c.url!)}>{c.name}</button> : <b>{c.name}</b>}
                  {c.by && <span className="muted"> {t({ message: `by ${ph({ author: c.by })}`, comment: "Credits: who made the work named before" })}</span>}
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
