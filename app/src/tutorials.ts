// The in-app tutorials: walkthroughs that point at one part of the window at a time and wait for the click there
// (Tutorial.tsx draws them). A tutorial is a list of steps; each says what to do in a few words, where (`target`),
// and when it is done, read from the app's state rather than from clicks, so any way of doing it counts. Steps can do
// work themselves (`enter`, `action`): type a search, put the tutorial's own audio in slots, so nobody has to fetch a
// file to follow along.
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
};

export type Step = {
  id: string;
  title: string;
  text: string;                                     // Markdown: **bold**, {icon:name}, {key:command}
  target?: () => Element | Element[] | null;        // what the hole in the dark shows; none: the panel sits in the middle
  enter?: (kit: TutorialKit, s: TutorialState) => unknown; // what the tutorial does as the step starts
  action?: { label: string; run: (kit: TutorialKit, s: TutorialState) => Promise<unknown> }; // a button that does the step
  done?: (s: TutorialState) => boolean;             // when the step is done
  next?: string;                                    // a button that goes on, for a step to read or listen to
  busy?: (s: TutorialState) => string | null;       // what the panel says while the app works on the step
};

export type Tutorial = {
  id: string;
  title: string;
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
/** An item of the list on the left, by its name. */
export const itemRow = (name: string) => () =>
  [...pane().querySelectorAll<HTMLElement>(".mus-item")].find((r) => r.querySelector(".mus-label")?.textContent === name) ?? null;
/** A sound's line in the slot list, by the container that holds its takes. */
export const soundLine = (key: string) => () => pane().querySelector<HTMLElement>(`.grp[data-key="${key}"]`);
/** Something in the pane that shows. */
export const inPane = (css: string) => () => pane().querySelector<HTMLElement>(css);

/** Types into the search box of the list that shows, as a person would (React hears the input). */
export function typeSearch(text: string) {
  const box = pane().querySelector<HTMLInputElement>(".lib-pane:not([hidden]) .lib-search input, .lib-search input");
  if (!box) return;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(box, text);
  box.dispatchEvent(new Event("input", { bubbles: true }));
}

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
const filled: Record<string, string[]> = {}; // the takes each step filled, for its done()
let builtBefore = new Set<string>();           // the jobs there were when the Build step began

const liberator: Tutorial = {
  id: "liberator",
  title: "How to Change the Liberator's Firing Sounds",
  summary: "From the Library to a built mod: a weapon's shot replaced with new audio that the tutorial brings along.",
  teaches: ["Finding a sound in the Library", "Adding it to a project", "Replacing a sound in every take", "Silencing the layers that play with it", "Building the mod"],
  minutes: 4,
  async start(kit) {
    // a practice project of its own, so nothing happens to a project of yours: the one open is saved and closed
    const folder = await kit.call<string>("projects_folder");
    for (let n = 1; n <= 20; n++) {
      const name = n === 1 ? "Liberator Tutorial" : `Liberator Tutorial ${n}`;
      if (await kit.newProjectAt(`${folder}\\${name}.audi`, name)) return true;
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
      id: "find", title: "Find the weapon",
      text: "The search box finds anything by name, and the tutorial typed this one. Open **AR-23 Liberator**.",
      enter: () => {
        document.querySelector<HTMLElement>(".panes:not([hidden]) .lib-tabs button")?.click(); // the Index, not All Archives
        setTimeout(() => typeSearch("AR-23 Liberator"), 60);
      },
      target: itemRow("AR-23 Liberator"), done: (s) => s.libraryItem === LIBERATOR,
    },
    {
      id: "add", title: "Add it to the project",
      text: "A project holds what the mod changes. Press {icon:add} to add the Liberator.",
      target: () => itemRow("AR-23 Liberator")()?.querySelector(".lib-add") ?? null,
      done: (s) => !!s.project?.library.includes(LIBERATOR),
    },
    {
      id: "audio", title: "The Audio tab",
      text: "Sounds are replaced on the {icon:audio} **Audio** tab, which lists what the project holds. Open it.",
      target: tabButton("Audio"), done: (s) => s.tab === "editor",
    },
    {
      id: "open", title: "Open the Liberator",
      text: "Open **AR-23 Liberator** in the list.",
      target: itemRow("AR-23 Liberator"), done: (s) => s.audioItem === LIBERATOR,
    },
    {
      id: "listen", title: "The shot",
      text: "A shot is a few sounds that play together, and each has several takes the game picks from. **Sound 6** is the loudest. Press ▶ to hear it.",
      enter: () => reveal(soundLine(SETS[0].shot)), target: soundLine(SETS[0].shot), next: "Next",
    },
    {
      id: "replace", title: "Replace the shot",
      text: "A file dropped on a sound goes into every take. The tutorial brings a new shot to use.",
      target: soundLine(SETS[0].shot),
      action: {
        label: "Use the Tutorial Shot",
        async run(kit) {
          const file = await kit.call<string>("tutorial_audio", { kind: "shot" });
          filled.replace = await takes(kit, [SETS[0].shot]);
          await kit.assignAll(filled.replace, file);
        },
      },
      done: (s) => replaced(s, filled.replace ?? []),
    },
    {
      id: "quiet", title: "Silence the other layers",
      text: "**Sound 7** and **Sound 8** play with the shot. Silence them, so the new shot plays alone.",
      enter: () => reveal(soundLine(SETS[0].quiet[0])), target: () => SETS[0].quiet.map((k) => soundLine(k)()).filter((x): x is HTMLElement => !!x),
      action: {
        label: "Silence Them",
        async run(kit) {
          filled.quiet = await takes(kit, SETS[0].quiet);
          await kit.silence(filled.quiet, true, "Sound 7 and Sound 8");
        },
      },
      done: (s) => replaced(s, filled.quiet ?? []),
    },
    {
      id: "echo", title: "The echo",
      text: "**Sound 9** is the echo after each shot. The tutorial has one that goes with the new shot.",
      enter: () => reveal(soundLine(SETS[0].echo!)), target: soundLine(SETS[0].echo!),
      action: {
        label: "Use the Tutorial Echo",
        async run(kit) {
          const file = await kit.call<string>("tutorial_audio", { kind: "echo" });
          filled.echo = await takes(kit, [SETS[0].echo]);
          await kit.assignAll(filled.echo, file);
        },
      },
      done: (s) => replaced(s, filled.echo ?? []),
    },
    {
      id: "others", title: "Two more sets",
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
          filled.others = [...shots, ...quiet, ...echoes];
        },
      },
      done: (s) => replaced(s, filled.others ?? []),
    },
    {
      id: "build-tab", title: "Build",
      text: "{icon:build} **Build** makes the mod: a ZIP to install with a mod manager. Open it.",
      target: tabButton("Build"), done: (s) => s.tab === "build",
    },
    {
      id: "build", title: "Build the mod",
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
