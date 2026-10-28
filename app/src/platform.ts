// Native features (file dialogs, file drag-and-drop, revealing files) in the desktop app, with plain-browser
// fallbacks so the UI can be developed and tested in a browser against the same core.
import { t } from "@lingui/core/macro";
import { call, isTauri } from "./api";

export { isTauri };

const AUDIO = ["wav", "flac", "mp3", "ogg", "opus", "m4a", "aac", "aif", "aiff", "wma", "wem"];
const AUDIO_DIR_KEY = "audiodiver.audioDir"; // the file picker opens where you picked audio last time

const folderOf = (path?: string | null) => (path ? path.replace(/[\\/][^\\/]*$/, "") : undefined);
function lastAudioDir() {
  try { return localStorage.getItem(AUDIO_DIR_KEY) ?? undefined; } catch { return undefined; }
}

function promptPaths(message: string, multiple: boolean): string[] | null {
  const raw = window.prompt(`${message}\n(Desktop app shows a file picker here. Paste ${multiple ? "paths separated by |" : "a path"}.)`);
  if (!raw) return null;
  return raw.split("|").map((s) => s.trim().replace(/^"|"$/g, "")).filter(Boolean);
}

let audioStart: string | null = null;
/** Where the audio picker opens while a tutorial runs (the folder of the audio it made); null: the last folder used. */
export function startAudioPickerIn(folder: string | null) { audioStart = folder; }

export async function pickAudio(multiple = true): Promise<string[] | null> {
  if (!isTauri()) return promptPaths("Audio file", multiple);
  const { open } = await import("@tauri-apps/plugin-dialog");
  const r = await open({ multiple, defaultPath: audioStart ?? lastAudioDir(),
    filters: [{ name: t({ message: "Audio", comment: "File type in the file picker: audio files" }), extensions: AUDIO }] });
  if (!r) return null;
  const files = Array.isArray(r) ? r : [r];
  try { localStorage.setItem(AUDIO_DIR_KEY, folderOf(files[0]) ?? ""); } catch { /* storage off */ }
  return files;
}

/** A project, or a pack to unpack. near: a project path; the picker starts in its folder. */
export async function pickProjectToOpen(near?: string): Promise<string | null> {
  if (!isTauri()) return promptPaths("Audiodiver project (.audi) or pack (.audipack)", false)?.[0] ?? null;
  const { open } = await import("@tauri-apps/plugin-dialog");
  const r = await open({ multiple: false, defaultPath: folderOf(near),
    filters: [{ name: t`Audiodiver projects and packs`, extensions: ["audi", "audipack"] }] });
  return (r as string) ?? null;
}

/** The new project's name and where its folder goes (dir: where the picker starts). */
export async function pickProjectToCreate(suggested: string, dir?: string): Promise<string | null> {
  if (!isTauri()) return promptPaths("Where to save the new project (.audi). Audiodiver makes a folder for it there.", false)?.[0] ?? null;
  const { save } = await import("@tauri-apps/plugin-dialog");
  return await save({ title: t`New project`, defaultPath: dir ? `${dir}\\${suggested}` : suggested,
    filters: [{ name: t`Audiodiver project`, extensions: ["audi"] }] });
}

/** Where a project's pack goes (dir: where the picker starts). */
export async function pickPackToSave(suggested: string, dir?: string): Promise<string | null> {
  if (!isTauri()) return promptPaths("Where to save the pack (.audipack)", false)?.[0] ?? null;
  const { save } = await import("@tauri-apps/plugin-dialog");
  return await save({ title: t`Export the project as a pack`, defaultPath: dir ? `${dir}\\${suggested}` : suggested,
    filters: [{ name: t`Audiodiver pack`, extensions: ["audipack"] }] });
}

/** The project or pack Audiodiver was started with (a double-click in Explorer), once; null without one. */
export async function launchFile(): Promise<string | null> {
  if (!isTauri()) return null;
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string | null>("launch_file").catch(() => null);
}

/** Calls back with each project or pack opened in Explorer while Audiodiver runs. */
export async function onOpenFile(cb: (path: string) => void): Promise<() => void> {
  if (!isTauri()) return () => {};
  const { listen } = await import("@tauri-apps/api/event");
  return listen<string>("open-file", (e) => cb(e.payload));
}

/** title: the picker's title; without one, "Choose a folder". */
export async function pickFolder(startAt?: string, title?: string): Promise<string | null> {
  if (!isTauri()) return promptPaths(title ?? "Folder to save into", false)?.[0] ?? null;
  const { open } = await import("@tauri-apps/plugin-dialog");
  const r = await open({ directory: true, multiple: false, defaultPath: startAt || undefined, title: title ?? t`Choose a folder` });
  return (r as string) ?? null;
}

export async function pickPatch(): Promise<string | null> {
  if (!isTauri()) return promptPaths("Patch file (.patch_0)", false)?.[0] ?? null;
  const { open } = await import("@tauri-apps/plugin-dialog");
  const r = await open({ multiple: false, title: t`Import a mod's patch file`,
    filters: [{ name: t`Game patches (.patch_0)`, extensions: ["patch_0", "patch_1", "patch_2", "patch_3", "patch_4"] }, { name: t`All files`, extensions: ["*"] }] });
  return (r as string) ?? null;
}

/** A mod to repatch: its ZIP or its patch file (a folder: pickFolder). */
export async function pickMod(title = t`Choose a mod to repatch`): Promise<string | null> {
  if (!isTauri()) return promptPaths("Mod ZIP or .patch_0 file", false)?.[0] ?? null;
  const { open } = await import("@tauri-apps/plugin-dialog");
  const r = await open({ multiple: false, title,
    filters: [{ name: t`Mods (.zip, .patch_0)`, extensions: ["zip", "patch_0", "patch_1", "patch_2", "patch_3", "patch_4"] }, { name: t`All files`, extensions: ["*"] }] });
  return (r as string) ?? null;
}

/** Mods to combine: ZIPs and patch files, several at once. */
export async function pickMods(): Promise<string[] | null> {
  if (!isTauri()) return promptPaths("Mod ZIPs or .patch_0 files", true);
  const { open } = await import("@tauri-apps/plugin-dialog");
  const r = await open({ multiple: true, title: t`Choose mods to combine`,
    filters: [{ name: t`Mods (.zip, .patch_0)`, extensions: ["zip", "patch_0", "patch_1", "patch_2", "patch_3", "patch_4"] }, { name: t`All files`, extensions: ["*"] }] });
  return r ? (Array.isArray(r) ? r : [r]) : null;
}

export const IMAGES = ["png", "jpg", "jpeg", "webp", "bmp", "gif", "tif", "tiff"];
export const isImage = (path: string) => IMAGES.includes(path.split(".").pop()?.toLowerCase() ?? "");
export const isAudio = (path: string) => AUDIO.includes(path.split(".").pop()?.toLowerCase() ?? "");

/** The audio files copied in Explorer, folders opened up, and the clipboard's change count (core clipboard_files). */
export async function clipboardAudio(): Promise<{ audio: string[]; seq: number }> {
  const c = await call<{ files: string[]; seq: number }>("clipboard_files").catch(() => ({ files: [], seq: 0 }));
  return { audio: c.files.length ? (await expandDropped(c.files)).filter(isAudio) : [], seq: c.seq };
}

/** near: a folder to start in (the project's). */
export async function pickImage(near?: string): Promise<string | null> {
  if (!isTauri()) return promptPaths("Image file for the icon", false)?.[0] ?? null;
  const { open } = await import("@tauri-apps/plugin-dialog");
  const r = await open({ multiple: false, defaultPath: near || undefined, title: t`Choose an image for the icon`, filters: [{ name: t`Images`, extensions: IMAGES }] });
  return (r as string) ?? null;
}

let portable: Promise<boolean> | null = null;
/** A portable copy of the desktop app (the release's ZIP): it updates from the release's page, not the installer. */
export function isPortable(): Promise<boolean> {
  portable ??= isTauri()
    ? import("@tauri-apps/api/core").then(({ invoke }) => invoke<boolean>("is_portable")).catch(() => false)
    : Promise.resolve(false);
  return portable;
}

/** Opens a web page in the user's browser, never inside the app's own window. */
export async function openUrl(url: string) {
  if (!/^https?:\/\//i.test(url)) return;
  if (isTauri()) {
    const opener = await import("@tauri-apps/plugin-opener");
    await opener.openUrl(url);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

/** Puts text on the clipboard and says so in a quick note (`what`: how the note names it, `**bold**` allowed; `note`:
    the whole note, for a name that is a phrase, such as "Copied the mod ID"); a clipboard that refuses says that
    instead. */
export async function copyText(text: string, quick: (text: string, icon?: "copy" | "info") => void, what = "", note?: string) {
  try {
    await navigator.clipboard.writeText(text);
    const copied = what || `**${text}**`;
    quick(note ?? t({ message: `Copied ${copied}`, comment: "Quick note; copied is the copied text in bold" }), "copy");
  } catch {
    quick(t`Couldn't copy to the clipboard`, "info");
  }
}

/** The window's title (the taskbar shows it too). */
export async function setTitle(title: string) {
  document.title = title;
  if (!isTauri()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().setTitle(title).catch(() => {});
}

/** The full path of a file the project names relative to its own folder ("../music/a.wav" included). */
export function fullPath(folder: string, rel: string) {
  if (/^[a-z]:[\\/]|^[\\/]/i.test(rel)) return rel;
  const parts = folder.split(/[\\/]/);
  for (const step of rel.split(/[\\/]/)) {
    if (step === "..") parts.pop();
    else if (step && step !== ".") parts.push(step);
  }
  return parts.join("\\");
}

export async function reveal(path: string) {
  if (isTauri()) {
    const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
    await revealItemInDir(path);
  } else {
    await call("reveal", { path });
  }
}

/** Expands dropped folders into the audio files inside them (sorted by name). Images come through as they are:
    one dropped on the Project tab's icon becomes the icon. */
export async function expandDropped(paths: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const p of paths) {
    const ext = p.split(".").pop()?.toLowerCase() ?? "";
    if (AUDIO.includes(ext) || /\.patch_\d+$|\.audi(pack)?$/i.test(p) || isImage(p)) out.push(p);
    else {
      try { out.push(...(await call<string[]>("list_audio", { folder: p }))); } catch { /* not a folder */ }
    }
  }
  return out;
}

export type DropPhase = { kind: "over"; x: number; y: number } | { kind: "drop"; x: number; y: number; paths: string[] } | { kind: "leave" };

/** Calls back with drag-and-drop of files from Explorer onto the window (desktop app only). */
export async function onFileDrop(cb: (e: DropPhase) => void): Promise<() => void> {
  if (!isTauri()) return () => {};
  const { getCurrentWebview } = await import("@tauri-apps/api/webview");
  return await getCurrentWebview().onDragDropEvent((ev) => {
    const p = ev.payload as any;
    const r = window.devicePixelRatio || 1;
    if (p.type === "over" || p.type === "enter") cb({ kind: "over", x: p.position.x / r, y: p.position.y / r });
    else if (p.type === "drop") cb({ kind: "drop", x: p.position.x / r, y: p.position.y / r, paths: p.paths });
    else cb({ kind: "leave" });
  });
}
