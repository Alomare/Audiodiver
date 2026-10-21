import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AboutButton } from "./About";
import { call, fmtWhen } from "./api";
import { DISCORD_URL, fmtDate, HOME_ART, KOFI_URL, RELEASES, TICKER_URL } from "./content";
import { Fold, useLastWhile } from "./Fold";
import { DiscordIcon, FolderIcon, KofiIcon, NextIcon, PrevIcon } from "./Icons";
import { Logo } from "./Logo";
import { Markdown } from "./Markdown";
import { nav } from "./nav";
import { openUrl, reveal } from "./platform";
import { useEditor } from "./store";
import { DEFAULT_SIZE, motionMs, motionOn, useTheme } from "./theme";

type Info = { path: string; exists: boolean; readable: boolean; name: string; modified: number | null };
const fileName = (path: string) => path.split(/[\\/]/).pop()!.replace(/\.audi$/i, "");

/** Where the app starts, laid out like the game's menu: the open project to continue (with its file, Import a mod's
    patch and Close under it), a project to make or open, a mod to repatch; then the recent projects and what changed
    in this version. */
export function Home() {
  const { project, recent, actions } = useEditor();
  const [info, setInfo] = useState<Record<string, Info>>({});
  const shown = useLastWhile(project, !!project); // Continue still says which project while it folds away
  const others = recent.filter((path) => path !== project?.path);
  const [leaving, setLeaving] = useState<string[]>([]); // rows folding away after their ✕
  const forget = (path: string) => {
    setLeaving((l) => [...l, path]);
    setTimeout(() => { actions.forgetRecent(path); setLeaving((l) => l.filter((p) => p !== path)); }, motionMs(160));
  };

  // the list says whether each file is still there, and shows the mod's name rather than the file's
  useEffect(() => {
    if (!recent.length) return;
    let live = true;
    call<Info[]>("projects_info", { paths: recent })
      .then((list) => { if (live) setInfo(Object.fromEntries(list.map((i) => [i.path, i]))); })
      .catch(() => { /* the list still works from the paths alone */ });
    return () => { live = false; };
  }, [recent, project?.path, project?.name]);

  return (
    <section className={`home${HOME_ART.length ? " with-art" : ""}`} aria-label="Home">
      <div className="home-scroll">
        <div className="home-inner view-in">
          <header className="home-hero">
            <div className="home-brand"><Logo detail />Audiodiver<AboutButton /></div>
            <h1>A new anthem for Super Earth</h1>
          </header>

          {/* a menu, as the game's own: the yellow item is the way in (Continue with a project open, else New project) */}
          <nav className="home-menu" aria-label="Start">
            <Fold open={!!project}>
              {shown && (
                <>
                  <button className="menu-item hot" onClick={() => nav.go("editor")} data-tip="Continue in the Audio Editor">
                    <span>Continue<small>{shown.name}</small></span>
                  </button>
                  <div className="menu-sub">
                    <span className="home-path-line">
                      <span className="home-path" data-tip={shown.path} data-tip-clip>{shown.path}</span>
                      <button className="x" onClick={() => reveal(shown.path)} aria-label="Show in folder" data-tip="Show in folder"><FolderIcon /></button>
                    </span>
                    <button className="link-text" onClick={() => actions.importPatch()}
                      data-tip="Take the replaced and added sounds of an existing mod's .patch_0 file into this project">Import a mod's patch…</button>
                    <button className="link-text" onClick={actions.closeProject} data-tip="Close the project" data-tip-cmd="closeProject">Close</button>
                  </div>
                </>
              )}
            </Fold>
            <button className={`menu-item${project ? "" : " hot"}`} onClick={actions.newProject} data-tip="Start a mod" data-tip-cmd="newProject">New project</button>
            <button className="menu-item" onClick={() => actions.openProject()} data-tip="Open a .audi project file" data-tip-cmd="openProject">Open project</button>
            <button className="menu-item" onClick={() => nav.go("build", "repatch")}
              data-tip="Rebuild an existing audio mod for the current game version, without a project">Repatch a mod</button>
          </nav>

          <div className="home-cols">
            {others.length > 0 && ( // nothing to show until a project has been made or opened
              <section className="home-recent" aria-label="Recent projects">
                <h2>Recent projects</h2>
                <ul>
                  {others.map((path) => {
                    const i = info[path];
                    const name = i?.name ?? fileName(path);
                    const missing = i ? !i.exists : false;
                    const unreadable = !!i && i.exists && !i.readable;
                    const gone = leaving.includes(path);
                    return (
                      <li key={path} className={`recent-row${missing || unreadable ? " missing" : ""}${gone ? " leaving" : ""}`} inert={gone}>
                        <button className="x recent-folder" aria-label={`Show ${name} in its folder`} disabled={missing}
                          onClick={() => reveal(path)} data-tip="Show in folder"><FolderIcon /></button>
                        <button className="recent-open" disabled={missing} onClick={() => actions.openProject(path)}>
                          <span className="recent-name" data-tip={path} data-tip-more={name}>{name}</span>
                        </button>
                        <span className="recent-when" data-tip={missing ? "Moved, renamed or deleted" : unreadable ? "Not an Audiodiver project, or damaged" : undefined}>
                          {missing ? "Not found" : unreadable ? "Can't be read" : fmtWhen(i?.modified)}</span>
                        <button className="x recent-forget" aria-label={`Remove ${name} from this list`} onClick={() => forget(path)}
                          data-tip="Take off this list" data-tip-more="The file stays where it is">✕</button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
            <News />
          </div>
        </div>
      </div>
      {HOME_ART.length ? <HomeArt><Community /></HomeArt>
        : <><div className="home-art" aria-hidden><Meters /></div><div className="home-corner"><Community /></div></>}
      <Ticker />
    </section>
  );
}

/** The way to the modding community's Discord, for questions, feedback and help, and to Ko-fi, for supporting
    Audiodiver (in the corner, over the art). */
function Community() {
  return (
    <div className="home-links">
      <button className="home-link" onClick={() => openUrl(DISCORD_URL)} data-tip="Helldivers 2 Modding on Discord"
        data-tip-more="Questions, feedback and help. Opens discord.gg/helldiversmodding" data-tip-side="top">
        <DiscordIcon />Discord</button>
      <button className="home-link" onClick={() => openUrl(KOFI_URL)} data-tip="Support Audiodiver on Ko-fi"
        data-tip-more="Opens ko-fi.com/alomare" data-tip-side="top">
        <KofiIcon />Ko-fi</button>
    </div>
  );
}

const TICKER_SCALE = 0.625; // the overlay is 56px tall at scale 1, for a stream; 35px here at the usual text size

/** Divershub's news ticker along the bottom: the war's orders and news, as streams show them. Only to look at
    (it takes no clicks); it follows the text size and fades in once it has loaded. */
function Ticker() {
  const { size } = useTheme();
  const [ready, setReady] = useState(false);
  const scale = +(TICKER_SCALE * size / DEFAULT_SIZE).toFixed(3);
  return (
    <iframe className={`home-ticker${ready ? " ready" : ""}`} src={`${TICKER_URL}?scale=${scale}`} title="Divershub news ticker"
      aria-hidden tabIndex={-1} sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer" onLoad={() => setReady(true)} />
  );
}

const ART_SECONDS = 20;               // how long a picture stays before the next one comes
const ART_KEY = "audiodiver.homeArt"; // the picture Home starts on, so each launch opens on the next one

/** The picture Home opens on this time: the one after last time's. */
function firstPicture() {
  let at = 0;
  try {
    at = (Number(localStorage.getItem(ART_KEY) ?? -1) + 1) % HOME_ART.length || 0;
    localStorage.setItem(ART_KEY, String(at));
  } catch { /* storage off: start on the first */ }
  return at;
}
let opening: number | null = null; // chosen once per launch; coming back to Home carries on from there

/** The art behind Home: the pictures in src/art, one after the other. Each fills the tab (cropped to its shape,
    never stretched), drifts in very slowly (a 2% zoom over its time on screen) and gives way to the next with a
    cross-fade. With animations off (Settings ▸ Theme, or the system's own setting) one picture stays still, and
    the next launch shows the next one. The corner holds whatever Home puts there, on the left, and the picture
    controls (with more than one picture) on the right. */
function HomeArt({ children }: { children?: ReactNode }) {
  const moving = motionOn(useTheme()) && HOME_ART.length > 1;
  // the picture that shows and, while it fades in, the one under it. A new key replays the fade and the zoom.
  const [layers, setLayers] = useState(() => [{ key: 0, at: (opening ??= firstPicture()) }]);
  const top = layers[layers.length - 1];
  useEffect(() => { opening = top.at; }, [top.at]);

  // a window that was hidden when a picture was due carries on when it shows again
  const [woken, wake] = useState(0);
  useEffect(() => {
    const seen = () => { if (!document.hidden) wake((n) => n + 1); };
    document.addEventListener("visibilitychange", seen);
    return () => document.removeEventListener("visibilitychange", seen);
  }, []);

  /** Straight to the picture before or after this one (the buttons in the corner); its full time starts again. */
  const step = (by: number) => setLayers((ls) => {
    const cur = ls[ls.length - 1];
    const next = { key: cur.key + 1, at: (cur.at + by + HOME_ART.length) % HOME_ART.length };
    return moving ? [cur, next] : [next];
  });

  useEffect(() => {
    if (!moving) return;
    const ready = new Image(); // read ahead, so the cross-fade never starts on a picture still loading
    ready.src = HOME_ART[(top.at + 1) % HOME_ART.length];
    const id = setTimeout(() => {
      if (document.hidden) return; // nobody is looking
      const show = () => setLayers((ls) => {
        const cur = ls[ls.length - 1];
        return [cur, { key: cur.key + 1, at: (cur.at + 1) % HOME_ART.length }];
      });
      ready.decode().then(show, show);
    }, ART_SECONDS * 1000);
    return () => clearTimeout(id);
  }, [moving, top.key, top.at, woken]);

  return (
    <>
      <div className="home-art" aria-hidden style={{ ["--art-time" as any]: `${ART_SECONDS}s` }}>
        {(moving ? layers : [top]).map((l) => <img key={l.key} className="home-art-img" src={HOME_ART[l.at]} alt="" draggable={false} />)}
      </div>
      <div className="home-corner">
        {children}
        {HOME_ART.length > 1 && (
          <div className="home-steps">
            <button onClick={() => step(-1)} aria-label="Previous picture" data-tip="Previous picture" data-tip-side="top"><PrevIcon /></button>
            {/* how long until the next picture: refills with each one, and isn't there while pictures stay still */}
            {moving && <span key={top.key} className="art-time" style={{ ["--art-time" as any]: `${ART_SECONDS}s` }} aria-hidden><i /></span>}
            <button onClick={() => step(1)} aria-label="Next picture" data-tip="Next picture" data-tip-side="top"><NextIcon /></button>
          </div>
        )}
      </div>
    </>
  );
}

/** What changed in this version, folded to its heading until asked for; earlier versions fold out inside it. */
function News() {
  const [open, setOpen] = useState(false);
  const [older, setOlder] = useState(false);
  const [latest, ...earlier] = RELEASES;
  if (!latest) return null;
  return (
    <section className={`home-news${open ? " open" : ""}`} aria-label="What's new">
      <h2>What's new in {latest.version}{latest.date && <span className="news-date">{fmtDate(latest.date)}</span>}</h2>
      <button className="news-toggle" aria-expanded={open} aria-controls="news-body" onClick={() => setOpen(!open)}>
        <span className="caret" aria-hidden>▸</span>{open ? "Hide the changes" : "Show the changes"}
      </button>
      <Fold open={open} id="news-body">
        <div className="news-body">
          <Markdown tokens={latest.tokens} />
          {earlier.length > 0 && (
            <>
              <button className="news-toggle" aria-expanded={older} onClick={() => setOlder(!older)}>
                <span className="caret" aria-hidden>▸</span>{older ? "Hide earlier versions" : "Earlier versions"}
              </button>
              <Fold open={older}>
                {earlier.map((r) => (
                  <div key={r.version} className="news-older">
                    <h3>{r.version}{r.date && <span className="news-date">{fmtDate(r.date)}</span>}</h3>
                    <Markdown tokens={r.tokens} />
                  </div>
                ))}
              </Fold>
            </>
          )}
        </div>
      </Fold>
    </section>
  );
}

/** The backdrop until there is art: a wall of level meters, like the bars on the logo's brow. */
function Meters() {
  const bars = useMemo(() => Array.from({ length: 72 }, (_, i) => {
    const level = 0.12 + 0.88 * Math.abs(Math.sin(i * 0.37) * Math.cos(i * 0.113 + 1.3)) ** 0.8;
    return { level, hot: i % 23 === 11 };
  }), []);
  return (
    <svg className="home-meters" viewBox="0 0 1440 400" preserveAspectRatio="none">
      {bars.map((b, i) => (
        <rect key={i} className={b.hot ? "hot" : undefined} x={i * 20 + 4} width={12} y={200 - b.level * 190} height={b.level * 380} />
      ))}
    </svg>
  );
}
