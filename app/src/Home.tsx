import { useEffect, useMemo, useState, type ReactNode } from "react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { call, projectIconUrl } from "./api";
import { DISCORD_URL, HOME_ART, KOFI_URL, TICKER_URL } from "./content";
import { CloseIcon, DiscordIcon, KofiIcon, NextIcon, PrevIcon, ProjectIcon } from "./Icons";
import { nav } from "./nav";
import { openUrl } from "./platform";
import { useEditor } from "./store";
import { DEFAULT_SIZE, motionOn, useTheme, useThemeValue } from "./theme";

/** Where the app starts, laid out like the game's menu: a project to make, open (the last one opened) or import from
    a mod, and which one is loaded; below, Repatch and Combine. With no project open, the Project tab lists all the
    recent projects. Audiodiver Utils has no Home. */
export function Home() {
  const { project, actions } = useEditor();
  const name = project?.name;
  return (
    <section className={`home${HOME_ART.length ? " with-art" : ""}`} aria-label={t`Home`}>
      <div className="home-scroll">
        <div className="home-inner view-in">
          <header className="home-hero">
            <h1><Trans comment="The title on Home; <0/> is a line break">A new anthem<br />for Super Earth</Trans></h1>
          </header>

          {/* a menu, as the game's own: the yellow item is the way in; the Tools tab's two pages after a gap.
              Open Project holds the last project opened, after its words. It stays the same with a project open: a
              line under Open Project says which, with Go to Project and Close */}
          <nav className="home-menu" aria-label={t({ message: "Start", comment: "The menu on Home with New Project, Open Project and Import Mod" })}>
            <button className="menu-item hot" onClick={actions.newProject} data-tip={t`Start a mod`} data-tip-cmd="newProject"><Trans>New Project</Trans></button>
            <div className="menu-item menu-open">
              <button className="menu-open-btn" onClick={() => actions.openProject()} data-tip={t`Open a .audi project or a .audipack pack`} data-tip-cmd="openProject"
                data-tip-more={t`A pack is a project and the files it uses, in one file`}><Trans>Open Project</Trans></button>
              <Recent />
            </div>
            <button className="menu-item" onClick={() => actions.importMod()} data-tip={t`Make a project from an existing mod`}
              data-tip-more={t`A ZIP or a .patch_0 file, with the audio, the sounds it adds and the text`}><Trans>Import Mod</Trans></button>
            {project && (
              <div className="home-loaded">
                <span className="home-loaded-name"><Trans>Loaded: <b data-tip={project.path} data-tip-clip>{name}</b></Trans></span>
                <button className="btn quiet" onClick={() => nav.go("project")}><ProjectIcon /><Trans>Go to Project</Trans></button>
                <button className="btn quiet" onClick={actions.closeProject} data-tip={t`Close the project`} data-tip-cmd="closeProject"><CloseIcon /><Trans>Close</Trans></button>
              </div>
            )}
          </nav>

          <nav className="home-menu home-tools" aria-label={t`Tools`}>
            <button className="menu-item" onClick={() => nav.go("tools", "repatch")}
              data-tip={t`Rebuild an existing audio mod for the current game version, without a project`}
              data-tip-more={t`For a mod that went silent or wrong after a game update, or that mutes other sounds`}><Trans>Repatch</Trans></button>
            <button className="menu-item" onClick={() => nav.go("tools", "combine")}
              data-tip={t`Make one mod out of several audio mods`}
              data-tip-more={t`For mods that change the same sound banks, where only the one deployed last plays`}><Trans>Combine Mods</Trans></button>
          </nav>

        </div>
      </div>
      {HOME_ART.length ? <HomeArt><Community /></HomeArt>
        : <><div className="home-art" aria-hidden><Meters /></div><div className="home-corner"><Community /></div></>}
      <Ticker />
    </section>
  );
}

type Info = { path: string; exists: boolean; readable: boolean; name: string; modified: number | null };
const RECENT_ASKED = 4; // the last projects looked at, for one that is still there

/** The last project opened (not the loaded one), inside Open project: the mod's icon and name, and a click opens it.
    A project that is gone or can't be read gives way to the one before. The Project tab lists them all. */
function Recent() {
  const { recent, project, actions } = useEditor();
  const paths = recent.filter((p) => p !== project?.path).slice(0, RECENT_ASKED);
  const key = paths.join("\n");
  const [info, setInfo] = useState<Record<string, Info>>({});
  const [noIcon, setNoIcon] = useState("");
  useEffect(() => {
    if (!paths.length) return;
    let live = true;
    call<Info[]>("projects_info", { paths }).then((list) => { if (live) setInfo(Object.fromEntries(list.map((i) => [i.path, i]))); }).catch(() => {});
    return () => { live = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const p = paths.find((x) => info[x]?.exists && info[x].readable);
  if (!p) return null;
  const name = info[p].name;
  return (
    <button className="menu-recent" onClick={() => actions.openProject(p)} data-tip={t`Open ${name}`} data-tip-more={p}>
      {/* a project whose image is gone keeps the space, so the name doesn't move */}
      {noIcon === p ? <span className="menu-recent-icon" /> : (
        <img className="menu-recent-icon" src={projectIconUrl(p, String(info[p].modified ?? 0))} alt="" draggable={false} onError={() => setNoIcon(p)} />
      )}
      <span className="menu-recent-name">{info[p].name}</span>
    </button>
  );
}

/** The way to the modding community's Discord, for questions, feedback and help, and to Ko-fi, for supporting
    Audiodiver (in the corner, over the art). */
function Community() {
  return (
    <div className="home-links">
      <button className="home-link" onClick={() => openUrl(DISCORD_URL)}
        data-tip={t({ message: "Helldivers 2 Modding on Discord", comment: "Helldivers 2 Modding is the name of the Discord server" })}
        data-tip-more={t`Questions, feedback and help. Opens discord.gg/helldiversmodding`} data-tip-side="top">
        <DiscordIcon />Discord</button>
      <button className="home-link" onClick={() => openUrl(KOFI_URL)} data-tip={t`Support Audiodiver on Ko-fi`}
        data-tip-more={t`Opens ko-fi.com/alomare`} data-tip-side="top">
        <KofiIcon />Ko-fi</button>
    </div>
  );
}

const TICKER_SCALE = 0.625; // the overlay is 56px tall at scale 1, for a stream; 35px here at the usual text size

/** Divershub's news ticker along the bottom: the war's orders and news, as streams show them. Only to look at
    (it takes no clicks); it follows the text size and fades in once it has loaded. */
function Ticker() {
  const size = useThemeValue((t) => t.size);
  const [ready, setReady] = useState(false);
  // its page loads once Home has been drawn and the window is idle: its scripts (about 1 s on a slow PC, at every
  // visit to Home) came before Home answered, and a visit cut short now skips them
  const [load, setLoad] = useState(false);
  useEffect(() => {
    const id = requestIdleCallback(() => setLoad(true), { timeout: 1500 });
    return () => cancelIdleCallback(id);
  }, []);
  const scale = +(TICKER_SCALE * size / DEFAULT_SIZE).toFixed(3);
  if (!load) return null;
  return (
    <>
      <iframe className={`home-ticker${ready ? " ready" : ""}`} src={`${TICKER_URL}?scale=${scale}`} title={t`Divershub news ticker`}
        aria-hidden tabIndex={-1} sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer" onLoad={() => setReady(true)} />
      {/* the frame takes no pointer, so the tooltip that says what the strip is sits over it */}
      {ready && <div className="home-ticker-tip" aria-hidden data-tip={t`News and orders from the war`} />}
    </>
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
            <button onClick={() => step(-1)} aria-label={t`Previous picture`} data-tip={t`Previous picture`} data-tip-side="top"><PrevIcon /></button>
            {/* how long until the next picture: refills with each one, and isn't there while pictures stay still */}
            {moving && <span key={top.key} className="art-time" style={{ ["--art-time" as any]: `${ART_SECONDS}s` }} aria-hidden><i /></span>}
            <button onClick={() => step(1)} aria-label={t`Next picture`} data-tip={t`Next picture`} data-tip-side="top"><NextIcon /></button>
          </div>
        )}
      </div>
    </>
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
