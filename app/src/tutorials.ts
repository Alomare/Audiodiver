// The in-app tutorials: walkthroughs that point at one part of the window at a time (Tutorial.tsx draws them). A
// tutorial is a list of steps. A step to do says what to do in a few words and where (`target`), and is done when
// the app's state shows it done, so any way of doing it counts; `room` can leave more of the window to work in than
// the part it points at. A step to look (`look`) shows a part of the window and what it is for, takes no clicks at
// all, and goes on with Next. Steps can do work themselves (`enter`, `action`): the repetitive part, a selection
// cleared, the tutorial's own audio made, so nobody has to fetch a file to follow along.
import { t } from "@lingui/core/macro";
import type { Job, ProjectState } from "./api";
import type { CommandId } from "./keys";
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
/** A main tab in the tab bar, by the command that opens it ("tabLibrary", the tab's data-tip-cmd), since the name on
    the tab is translated. */
export const tabButton = (cmd: CommandId) => () =>
  document.querySelector<HTMLElement>(`.rail [role=tab][data-tip-cmd="${cmd}"]`);
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
// the icons in the step texts ({icon:name}, Markdown.tsx) go into the messages as values, since a message can't hold
// braces
const libraryIcon = "{icon:library}", addIcon = "{icon:add}", audioIcon = "{icon:audio}", buildIcon = "{icon:build}";

const liberator: Tutorial = {
  id: "liberator",
  title: t({ message: "How to Change the Liberator's Firing Sounds", comment: "The Liberator is a weapon in Helldivers 2 (AR-23 Liberator)." }),
  category: "weapons",
  summary: t`From the Library to a built mod: a weapon's shot replaced with new audio that the tutorial brings along.`,
  teaches: [t`Finding a sound in the Library and adding it to a project`, t`Sounds and their takes`, t`Replacing every take with one file`,
    t`The details panel, and silence`, t`Building the mod`],
  minutes: 6,
  async start(kit) {
    // a practice project of its own, so nothing happens to another project: the one open is saved and closed. The
    // audio the steps choose is made in it, and the file picker opens there
    const folder = await kit.call<string>("projects_folder");
    for (let n = 1; n <= 20; n++) {
      // in English in every language: the project name is the mod name the build writes, and mod managers take
      // ASCII names only
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
      id: "library", title: t`The Library`,
      text: t({ message: `Every sound in the game is in the ${libraryIcon} **Library**. Open it.`,
        comment: "Markdown. {libraryIcon} shows the icon of the Library tab. **Library** is the tab name and must read as the translation of the tab name does." }),
      target: tabButton("tabLibrary"), done: (s) => s.tab === "library",
    },
    {
      id: "index", tab: "library", title: t`The Index`, look: true,
      text: t({ message: "The **Index** sorts the sounds of the game by where you hear them: weapons, stratagems, enemies and more. The search box finds anything by name.",
        comment: "Markdown. **Index** is the button above the Library list, and the bold word must read as the translation of the button does." }),
      target: listPane,
    },
    {
      id: "add", tab: "library", title: t`Add the Liberator`,
      text: t({ message: `Find the **AR-23 Liberator** and press ${addIcon} on the row to add it to the project.`,
        comment: "Markdown. **AR-23 Liberator** is the weapon as the Library lists it. {addIcon} shows the + button of the row." }),
      target: listPane, done: (s) => !!s.project?.library.includes(LIBERATOR),
    },
    {
      id: "audio", title: t`The Audio tab`,
      text: t({ message: `The ${audioIcon} **Audio** tab lists what the project holds, to change it. Open it.`,
        comment: "Markdown. {audioIcon} shows the icon of the Audio tab. **Audio** is the tab name and must read as the translation of the tab name does." }),
      target: tabButton("tabEditor"), done: (s) => s.tab === "editor",
    },
    {
      id: "open", tab: "editor", title: t`Open the Liberator`,
      text: t({ message: "Open **AR-23 Liberator** in the list.", comment: "Markdown. **AR-23 Liberator** is the weapon as the list shows it." }),
      target: listPane, done: (s) => s.audioItem === LIBERATOR,
    },
    {
      id: "sounds", tab: "editor", title: t`The sounds`, look: true,
      text: t({ message: "The middle lists the sounds of the Liberator. One shot is several sounds that play at once. Each sound has one or more **takes**, recordings the game picks from at random.",
        comment: "Markdown. **takes** is the word the app uses everywhere for the recordings of one sound." }),
      target: middle,
    },
    {
      id: "unfold", tab: "editor", title: t`Unfold a sound`,
      text: t({ message: "Click **Sound 6**, the loudest part of the shot, to see the takes.",
        comment: "Markdown. **Sound 6** is the name the slot list shows for this sound." }),
      enter: async (kit) => { reveal(soundLine(SHOT)); found.shot = await takes(kit, [SHOT]); },
      target: soundLine(SHOT), done: () => unfolded(SHOT),
    },
    {
      id: "listen", tab: "editor", title: t`The takes`,
      text: t({ message: "Each line under **Sound 6** is one take. Press ▶ on a few to hear them.",
        comment: "Markdown. **Sound 6** is the name the slot list shows for this sound. ▶ is the play button." }),
      target: () => [soundLine(SHOT)(), ...takeRows(found.shot ?? [])].filter((x): x is Element => !!x),
      next: t({ message: "Next", context: "tutorial step", comment: "The button that goes on to the next step of a tutorial" }),
    },
    {
      id: "tick", tab: "editor", title: t`Select the takes`,
      text: t({ message: "Tick the box of **Sound 6** to select every take.", comment: "Markdown. **Sound 6** is the name the slot list shows for this sound." }),
      target: soundLine(SHOT), room: () => [soundLine(SHOT)(), ...takeRows(found.shot ?? [])].filter((x): x is Element => !!x),
      done: () => ticked(SHOT),
    },
    {
      id: "details", tab: "editor", title: t`The details panel`, look: true,
      text: t`The details panel shows what is selected and what can replace it. For several takes: one file for all of them, a file for each, or silence.`,
      target: details,
    },
    {
      id: "replace", tab: "editor", title: t`Replace the shot`,
      text: t({ message: "Press **Choose One File for All**, and choose **shot.wav** in the folder that opens. The tutorial made it.",
        comment: "Markdown. **Choose One File for All** is a button in the details panel, and the bold words must read as the translation of the button does. **shot.wav** is a file name that stays as it is." }),
      target: details, room: () => [middle(), details()].filter((x): x is HTMLElement => !!x),
      done: (s) => replaced(s, found.shot ?? []),
    },
    {
      id: "pick-quiet", tab: "editor", title: t`Silence the other layers`,
      text: t({ message: "**Sound 7** and **Sound 8** play with the shot. Tick both, so the new shot plays alone.",
        comment: "Markdown. **Sound 7** and **Sound 8** are the names the slot list shows for these sounds." }),
      enter: async (kit) => { kit.select([]); reveal(soundLine(QUIET[0])); found.quiet = await takes(kit, QUIET); },
      target: () => QUIET.map((k) => soundLine(k)()).filter((x): x is HTMLElement => !!x), room: middle,
      done: () => QUIET.every(ticked) && !touched(SHOT),
    },
    {
      id: "silence", tab: "editor", title: t`Replace with silence`,
      text: t({ message: "Press **Replace with Silence** in the details panel.",
        comment: "Markdown. **Replace with Silence** is a button in the details panel, and the bold words must read as the translation of the button does." }),
      target: details, room: () => [middle(), details()].filter((x): x is HTMLElement => !!x),
      done: (s) => replaced(s, found.quiet ?? []),
    },
    {
      id: "echo", tab: "editor", title: t`The echo`,
      text: t({ message: "**Sound 9** is the echo after each shot. Give every take **echo.wav** the same way: tick the box, then **Choose One File for All**.",
        comment: "Markdown. **Sound 9** is the name the slot list shows for this sound. **echo.wav** is a file name that stays as it is. **Choose One File for All** is a button in the details panel, and the bold words must read as the translation of the button does." }),
      enter: async (kit) => { kit.select([]); reveal(soundLine(ECHO)); found.echo = await takes(kit, [ECHO]); },
      target: soundLine(ECHO), room: () => [middle(), details()].filter((x): x is HTMLElement => !!x),
      done: (s) => replaced(s, found.echo ?? []),
    },
    {
      id: "others", tab: "editor", title: t`Two more sets`,
      text: t`The Liberator has two more sets of these sounds, further down the list. The tutorial changes them the same way.`,
      action: {
        label: t`Change Them Too`,
        async run(kit) {
          const shot = await kit.call<string>("tutorial_audio", { kind: "shot" });
          const echo = await kit.call<string>("tutorial_audio", { kind: "echo" });
          const rest = SETS.slice(1);
          const shots = await takes(kit, rest.map((x) => x.shot)), quiet = await takes(kit, rest.flatMap((x) => x.quiet));
          const echoes = await takes(kit, rest.map((x) => x.echo));
          await kit.assignAll(shots, shot);
          await kit.silence(quiet, true, t({ message: "the other layers", comment: "Goes into the quick note “**the other layers** replaced with silence”" }));
          if (echoes.length) await kit.assignAll(echoes, echo);
          found.others = [...shots, ...quiet, ...echoes];
        },
      },
      done: (s) => replaced(s, found.others ?? []),
    },
    {
      id: "build-tab", title: t({ message: "Build", comment: "The name of the Build tab, as the title of a tutorial step" }),
      text: t({ message: `${buildIcon} **Build** makes the mod: a ZIP to install with a mod manager. Open it.`,
        comment: "Markdown. {buildIcon} shows the icon of the Build tab. **Build** is the tab name and must read as the translation of the tab name does." }),
      target: tabButton("tabBuild"), done: (s) => s.tab === "build",
    },
    {
      id: "build", tab: "build", title: t`Build the mod`,
      text: t({ message: "Press the **Build** button. It takes a minute or two.",
        comment: "Markdown. **Build** is the button on the Build tab, and the bold word must read as the translation of the button does." }),
      enter: (_kit, s) => { builtBefore = new Set(Object.keys(s.jobs)); },
      target: () => document.querySelector(".bld-box .btn.build"),
      busy: (s) => (Object.values(s.jobs).some((j) => j.kind === "build" && j.state === "running") ? t`Building the mod` : null),
      done: (s) => Object.values(s.jobs).some((j) => j.kind === "build" && j.state === "done" && !builtBefore.has(j.id)),
    },
    {
      id: "done", title: t`The mod is ready`,
      text: t`Install the ZIP with a mod manager, then fire the Liberator in the game. The practice project stays in the projects folder, to change further or to delete.`,
      action: {
        label: t`Show the ZIP`,
        async run(kit, s) { if (s.project?.last_build) kit.reveal(s.project.last_build.zip); },
      },
      next: t({ message: "Finish", comment: "The button that ends a tutorial, on the last step" }),
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
