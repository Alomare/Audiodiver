// The in-app tutorials: walkthroughs that point at one part of the window at a time (Tutorial.tsx draws them). A
// tutorial is a list of steps. A step to do says what to do in a few words and where (`target`), and is done when
// the app's state shows it done, so any way of doing it counts; `room` can leave more of the window to work in than
// the part it points at. A step to look (`look`) shows a part of the window and what it is for, takes no clicks at
// all, and goes on with Next. Steps can do work themselves (`enter`, `action`): the repetitive part, a selection
// cleared, the tutorial's own audio made, so nobody has to fetch a file to follow along.
import type { Job, ProjectState } from "./api";
import type { Tab } from "./nav";

/** What a step sees of the app, to tell whether it is done. */
export type TutorialState = {
  tab: Tab;
  project: ProjectState | null;
  libraryItem: string | null; // what the Library has open
  audioItem: string | null;   // what the Audio tab has open
  jobs: Record<string, Job>;
};

/** What a step can do in the app. */
export type TutorialKit = {
  call: <T>(method: string, params?: Record<string, unknown>) => Promise<T>;
  addToProject: (ids: string[], what: string) => Promise<boolean>;
  assignAll: (sources: string[], file: string) => Promise<void>;
  silence: (sources: string[], keepTiming?: boolean, what?: string) => Promise<void>;
  newProjectAt: (path: string, name: string) => Promise<ProjectState | null>;
  reveal: (path: string) => void;
  select: (sources: string[]) => void;      // the Audio tab's selection
  pickFrom: (folder: string | null) => void; // where the file picker opens while the tutorial runs
};

type Found = () => Element | Element[] | null;

export type Step = {
  id: string;
  title: string;
  text: string;                                     // Markdown: **bold**, {icon:name}, {key:command}
  target?: Found;                                   // what the step points at; none: the panel sits in the middle
  room?: Found;                                     // where clicks go through, when wider than the target
  look?: boolean;                                   // a step to read: no clicks anywhere, Next goes on
  tab?: Tab;                                        // the tab the step works in: the tutorial goes back there when
                                                    // something in its room (a link) leads to another tab
  enter?: (kit: TutorialKit, s: TutorialState) => unknown; // what the tutorial does as the step starts
  action?: { label: string; run: (kit: TutorialKit, s: TutorialState) => Promise<unknown> }; // a button that does the step
  done?: (s: TutorialState) => boolean;             // when the step is done
  next?: string;                                    // a button that goes on (a step to look has Next)
  busy?: (s: TutorialState) => string | null;       // what the panel says while the app works on the step
};

export type Tutorial = {
  id: string;
  title: string;
  category: string; // the Index category it is mostly about: its icon (CatMark)
  summary: string;
  teaches: string[];
  minutes: number;
  /** Sets the tutorial up before the first step: false when it can't start (said already). */
  start?: (kit: TutorialKit) => Promise<boolean>;
  steps: Step[];
};

// ---- finding what a step points at

/** The pane of the tab that shows (the Library and the Audio tab keep both theirs in the page). */
const pane = () => document.querySelector(".panes:not([hidden])") ?? document;
/** A main tab in the tab bar, by its name ("Library", "Build, not built yet"). */
export const tabButton = (name: string) => () =>
  [...document.querySelectorAll<HTMLElement>(".rail [role=tab]")].find((t) => (t.getAttribute("aria-label") ?? "").split(",")[0] === name) ?? null;
/** The list on the left: the Library's Index and All Archives, or what the project holds in the Audio tab, without
    the title row (in the Audio tab it has Add from the Library, which leads away from the step). */
export const listPane = () => [...(pane().querySelector("aside.library")?.children ?? [])].filter((e) => !e.matches(".lib-title"));
/** The middle: the sounds of what is open. */
export const middle = () => pane().querySelector<HTMLElement>("main.center");
/** The details panel on the right of the Audio tab. */
export const details = () => pane().querySelector<HTMLElement>("aside.inspector");
/** A sound's line in the slot list, by the container that holds its takes. */
export const soundLine = (key: string) => () => pane().querySelector<HTMLElement>(`.grp[data-key="${key}"]`);
/** The rows of these takes that show (an unfolded sound's). */
const takeRows = (sources: string[]) => sources.map((s) => pane().querySelector(`.slot[data-source="${s}"]`)).filter((x): x is Element => !!x);
/** Whether a sound shows its takes. */
const unfolded = (key: string) => !!soundLine(key)()?.classList.contains("open");
/** The box on a sound's line: ticked when every take is selected, half when some are. */
const box = (key: string) => soundLine(key)()?.querySelector<HTMLInputElement>(":scope > input.slot-check") ?? null;
const ticked = (key: string) => !!box(key)?.checked;
const touched = (key: string) => { const b = box(key); return !!b && (b.checked || b.indeterminate); };

/** Brings a target into view in the list that holds it. */
export function reveal(target: (() => Element | null)) {
  requestAnimationFrame(() => target()?.scrollIntoView({ block: "center" }));
}

// ---- How to Change the Liberator's Firing Sounds

const LIBERATOR = "set:weapons/primary/ar-23-liberator";
const LIBERATOR_BANK = "bank:14218929801082577703"; // content/audio/wep_ar19_liberator
/** The Liberator's three sets of shot sounds, one for each of the bank's firing events, by the container that holds
    each sound's takes (a sound's line carries it as data-key): the loudest layer, which gets the new shot, the
    layers that play with it, silenced so the shot plays alone, and the echo after it. The first set is the event
    wep_ar19_liberator_fire (Sounds 6 to 9 in the Library); the other two (10 to 16, 17 to 23) play the same kinds
    of layers. */
const SETS = [
  { shot: "156969628", quiet: ["263688091", "545525777"], echo: "409322750" },
  { shot: "214331208", quiet: ["810014582", "263733456", "867567974", "361854130", "1033030121"], echo: "763298375" },
  { shot: "915726933", quiet: ["185481591", "733425406", "316314551", "693453185", "955181451", "689838154"], echo: null },
];
const [SHOT, QUIET, ECHO] = [SETS[0].shot, SETS[0].quiet, SETS[0].echo!];

/** The takes (sources) of sounds in the Liberator's bank, by their containers. */
async function takes(kit: TutorialKit, keys: (string | null)[]) {
  const cue = await kit.call<{ segments_detail: { key?: string; stems: { slots: { source: string; absent?: boolean }[] }[] }[] }>(
    "cue", { id: LIBERATOR_BANK, mine: true });
  const want = new Set(keys.filter(Boolean));
  return cue.segments_detail.filter((g) => g.key && want.has(g.key))
    .flatMap((g) => g.stems.flatMap((st) => st.slots.filter((sl) => !sl.absent).map((sl) => sl.source)));
}
/** Whether every take of these sounds has new audio (or silence) in the project. */
const replaced = (s: TutorialState, sources: string[]) => sources.length > 0 && sources.every((x) => !!s.project?.assignments[x]);
const found: Record<string, string[]> = {}; // the takes of each sound a step works on, found as it starts
let builtBefore = new Set<string>();           // the jobs there were when the Build step began

const liberator: Tutorial = {
  id: "liberator",
  title: "How to Change the Liberator's Firing Sounds",
  category: "weapons",
  summary: "From the Library to a built mod: a weapon's shot replaced with new audio that the tutorial brings along.",
  teaches: ["Finding a sound in the Library and adding it to a project", "Sounds and their takes", "Replacing every take with one file",
    "The details panel, and silence", "Building the mod"],
  minutes: 6,
  async start(kit) {
    // a practice project of its own, so nothing happens to another project: the one open is saved and closed. The
    // audio the steps choose is made in it, and the file picker opens there
    const folder = await kit.call<string>("projects_folder");
    for (let n = 1; n <= 20; n++) {
      const name = n === 1 ? "Liberator Tutorial" : `Liberator Tutorial ${n}`;
      if (!(await kit.newProjectAt(`${folder}\\${name}.audi`, name))) continue;
      const shot = await kit.call<string>("tutorial_audio", { kind: "shot" });
      await kit.call<string>("tutorial_audio", { kind: "echo" });
      kit.pickFrom(shot.replace(/[\\/][^\\/]+$/, ""));
      return true;
    }
    return false;
  },
  steps: [
    {
      id: "library", title: "The Library",
      text: "Every sound in the game is in the {icon:library} **Library**. Open it.",
      target: tabButton("Library"), done: (s) => s.tab === "library",
    },
    {
      id: "index", tab: "library", title: "The Index", look: true,
      text: "The **Index** sorts the sounds of the game by where you hear them: weapons, stratagems, enemies and more. The search box finds anything by name.",
      target: listPane,
    },
    {
      id: "add", tab: "library", title: "Add the Liberator",
      text: "Find the **AR-23 Liberator** and press {icon:add} on the row to add it to the project.",
      target: listPane, done: (s) => !!s.project?.library.includes(LIBERATOR),
    },
    {
      id: "audio", title: "The Audio tab",
      text: "The {icon:audio} **Audio** tab lists what the project holds, to change it. Open it.",
      target: tabButton("Audio"), done: (s) => s.tab === "editor",
    },
    {
      id: "open", tab: "editor", title: "Open the Liberator",
      text: "Open **AR-23 Liberator** in the list.",
      target: listPane, done: (s) => s.audioItem === LIBERATOR,
    },
    {
      id: "sounds", tab: "editor", title: "The sounds", look: true,
      text: "The middle lists the sounds of the Liberator. One shot is several sounds that play at once. Each sound has one or more **takes**, recordings the game picks from at random.",
      target: middle,
    },
    {
      id: "unfold", tab: "editor", title: "Unfold a sound",
      text: "Click **Sound 6**, the loudest part of the shot, to see the takes.",
      enter: async (kit) => { reveal(soundLine(SHOT)); found.shot = await takes(kit, [SHOT]); },
      target: soundLine(SHOT), done: () => unfolded(SHOT),
    },
    {
      id: "listen", tab: "editor", title: "The takes",
      text: "Each line under **Sound 6** is one take. Press ▶ on a few to hear them.",
      target: () => [soundLine(SHOT)(), ...takeRows(found.shot ?? [])].filter((x): x is Element => !!x), next: "Next",
    },
    {
      id: "tick", tab: "editor", title: "Select the takes",
      text: "Tick the box of **Sound 6** to select every take.",
      target: soundLine(SHOT), room: () => [soundLine(SHOT)(), ...takeRows(found.shot ?? [])].filter((x): x is Element => !!x),
      done: () => ticked(SHOT),
    },
    {
      id: "details", tab: "editor", title: "The details panel", look: true,
      text: "The details panel shows what is selected and what can replace it. For several takes: one file for all of them, a file for each, or silence.",
      target: details,
    },
    {
      id: "replace", tab: "editor", title: "Replace the shot",
      text: "Press **Choose One File for All**, and choose **shot.wav** in the folder that opens. The tutorial made it.",
      target: details, room: () => [middle(), details()].filter((x): x is HTMLElement => !!x),
      done: (s) => replaced(s, found.shot ?? []),
    },
    {
      id: "pick-quiet", tab: "editor", title: "Silence the other layers",
      text: "**Sound 7** and **Sound 8** play with the shot. Tick both, so the new shot plays alone.",
      enter: async (kit) => { kit.select([]); reveal(soundLine(QUIET[0])); found.quiet = await takes(kit, QUIET); },
      target: () => QUIET.map((k) => soundLine(k)()).filter((x): x is HTMLElement => !!x), room: middle,
      done: () => QUIET.every(ticked) && !touched(SHOT),
    },
    {
      id: "silence", tab: "editor", title: "Replace with silence",
      text: "Press **Replace with Silence** in the details panel.",
      target: details, room: () => [middle(), details()].filter((x): x is HTMLElement => !!x),
      done: (s) => replaced(s, found.quiet ?? []),
    },
    {
      id: "echo", tab: "editor", title: "The echo",
      text: "**Sound 9** is the echo after each shot. Give every take **echo.wav** the same way: tick the box, then **Choose One File for All**.",
      enter: async (kit) => { kit.select([]); reveal(soundLine(ECHO)); found.echo = await takes(kit, [ECHO]); },
      target: soundLine(ECHO), room: () => [middle(), details()].filter((x): x is HTMLElement => !!x),
      done: (s) => replaced(s, found.echo ?? []),
    },
    {
      id: "others", tab: "editor", title: "Two more sets",
      text: "The Liberator has two more sets of these sounds, further down the list. The tutorial changes them the same way.",
      action: {
        label: "Change Them Too",
        async run(kit) {
          const shot = await kit.call<string>("tutorial_audio", { kind: "shot" });
          const echo = await kit.call<string>("tutorial_audio", { kind: "echo" });
          const rest = SETS.slice(1);
          const shots = await takes(kit, rest.map((x) => x.shot)), quiet = await takes(kit, rest.flatMap((x) => x.quiet));
          const echoes = await takes(kit, rest.map((x) => x.echo));
          await kit.assignAll(shots, shot);
          await kit.silence(quiet, true, "the other layers");
          if (echoes.length) await kit.assignAll(echoes, echo);
          found.others = [...shots, ...quiet, ...echoes];
        },
      },
      done: (s) => replaced(s, found.others ?? []),
    },
    {
      id: "build-tab", title: "Build",
      text: "{icon:build} **Build** makes the mod: a ZIP to install with a mod manager. Open it.",
      target: tabButton("Build"), done: (s) => s.tab === "build",
    },
    {
      id: "build", tab: "build", title: "Build the mod",
      text: "Press the **Build** button. It takes a minute or two.",
      enter: (_kit, s) => { builtBefore = new Set(Object.keys(s.jobs)); },
      target: () => document.querySelector(".bld-box .btn.build"),
      busy: (s) => (Object.values(s.jobs).some((j) => j.kind === "build" && j.state === "running") ? "Building the mod" : null),
      done: (s) => Object.values(s.jobs).some((j) => j.kind === "build" && j.state === "done" && !builtBefore.has(j.id)),
    },
    {
      id: "done", title: "The mod is ready",
      text: "Install the ZIP with a mod manager, then fire the Liberator in the game. The practice project stays in the projects folder, to change further or to delete.",
      action: {
        label: "Show the ZIP",
        async run(kit, s) { if (s.project?.last_build) kit.reveal(s.project.last_build.zip); },
      },
      next: "Finish",
    },
  ],
};

export const TUTORIALS: Tutorial[] = [liberator];

// ---- which tutorials were offered at startup (once each)

const OFFERED_KEY = "audiodiver.tutorialsOffered";
function offered(): string[] {
  try { const v = JSON.parse(localStorage.getItem(OFFERED_KEY) ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}
/** The tutorials not offered yet: on the first start, all of them; after an update, the new ones. */
export const unoffered = () => TUTORIALS.filter((t) => !offered().includes(t.id));
/** Marks these as offered: the prompt shows once for them. */
export function markOffered(ids: string[]) {
  try { localStorage.setItem(OFFERED_KEY, JSON.stringify([...new Set([...offered(), ...ids])])); } catch { /* storage off */ }
}
