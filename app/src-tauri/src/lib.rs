//! The desktop shell: starts the Python core (`python -m audiodiver serve`), hands its port and token to the UI, and
//! stops it when the window closes. The interpreter is AUDIODIVER_PYTHON if set, else the one this computer's
//! `core.json` names (see `Launch`), else the one a release carries (`core/python` beside the exe, with the tools in
//! `core/tools`), else `python`.
//!
//! A portable copy (the release's ZIP: a `portable.txt` beside the exe) keeps everything in `data` beside the exe,
//! and nothing in the user's AppData: the core's settings, caches, notes and log (AUDIODIVER_CACHE), `core.json`, the
//! WebView2 profile, and the window's size and place (`window.json`, in place of the window-state plugin, which
//! always writes into the app's config folder).
//!
//! The installer makes `.audi` projects and `.audipack` packs open in Audiodiver (`bundle.fileAssociations`). Windows
//! starts the exe with the file: the window asks for it once it is ready (`launch_file`). Audiodiver runs once: a file
//! opened while it runs goes to the window that is open (the `open-file` event), and no second core starts.
//!
//! Audiodiver Utils is this same exe with a `utils.txt` beside it (the release's Utils ZIP, always portable too): the
//! window shows only the Tools, takes no projects, and runs beside Audiodiver (no single-instance hand-over). The page
//! learns it from `window.__AUDIODIVER_EDITION__`, set before its scripts run.
//!
//! The Wiki can move into a second window (`open_wiki`), the same pages with `?view=wiki` (wikiWindow.ts in the UI).
//! It has no core and nothing to save, and it closes with the main window: Tauri exits only with the last window, and
//! the core stops at that exit.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Condvar, Mutex};
use tauri::{Emitter, Manager, PhysicalPosition, PhysicalSize, RunEvent, WebviewWindow, WindowEvent};

#[derive(Clone, Serialize, Default)]
struct Endpoint {
    port: u16,
    token: String,
    error: Option<String>,
}

#[derive(Default)]
struct Core {
    child: Mutex<Option<Child>>,
    endpoint: Arc<(Mutex<Option<Endpoint>>, Condvar)>,
}

/// The data folder of a portable copy, or None for an installed one (or a development build).
fn portable_data() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let dir = exe.parent()?;
    dir.join("portable.txt").is_file().then(|| dir.join("data"))
}

/// Audiodiver Utils: a `utils.txt` beside the exe.
fn utils_edition() -> bool {
    std::env::current_exe().ok().and_then(|exe| exe.parent().map(|d| d.join("utils.txt").is_file())).unwrap_or(false)
}

/// What the shell starts the core with: this computer's `core.json`, the core a release carries, and (portable) the
/// folder the core keeps its files in.
struct Paths {
    config: Option<PathBuf>,
    bundled: Option<PathBuf>,
    cache: Option<PathBuf>,
}

/// How this computer runs the core when the `python` on PATH isn't the one that has it: `core.json` in the app's local
/// data folder (%LOCALAPPDATA%\com.audiodiver.editor; a portable copy's `data`), e.g.
/// `{"python": "C:\\dev\\venv\\Scripts\\python.exe", "path": ["C:\\dev\\bin"], "env": {"PYTHONUTF8": "1"}}`.
/// `path` folders go first on the core's PATH (where it finds ffmpeg, vgmstream-cli and wav2wem). The file stays on
/// its computer, so a synced or copied app still runs each computer's own Python.
#[derive(Deserialize, Default)]
struct Launch {
    python: Option<String>,
    #[serde(default)]
    path: Vec<String>,
    #[serde(default)]
    env: HashMap<String, String>,
}

fn spawn_core(core: &Core, paths: Paths) {
    let file = paths.config.as_ref().map_or("core.json".into(), |f| f.display().to_string());
    let (launch, unread) = match paths.config.as_ref().and_then(|f| std::fs::read_to_string(f).ok()) {
        Some(text) => match serde_json::from_str::<Launch>(&text) {
            Ok(l) => (l, String::new()),
            Err(e) => (Launch::default(), format!(" ({file} was not used: {e})")),
        },
        None => (Launch::default(), String::new()),
    };
    let bundled = paths.bundled.filter(|d| d.join("python").join("python.exe").is_file());
    let python = std::env::var("AUDIODIVER_PYTHON")
        .ok()
        .or(launch.python)
        .or_else(|| bundled.as_ref().map(|d| d.join("python").join("python.exe").display().to_string()))
        .unwrap_or_else(|| "python".into());
    let mut cmd = Command::new(&python);
    let mut dirs: Vec<PathBuf> = launch.path.iter().map(PathBuf::from).collect();
    dirs.extend(bundled.as_ref().map(|d| d.join("tools")));
    if !dirs.is_empty() {
        if let Some(p) = std::env::var_os("PATH") {
            dirs.extend(std::env::split_paths(&p));
        }
        if let Ok(joined) = std::env::join_paths(dirs) {
            cmd.env("PATH", joined);
        }
    }
    if let Some(cache) = &paths.cache {
        cmd.env("AUDIODIVER_CACHE", cache);
    }
    cmd.envs(&launch.env);
    // The core watches this process and exits with it, so it never outlives the app, even after a crash.
    // It gets no stdin: a windowed app has no console, and the core keeps its own log file. Its stderr is read only
    // for the message when it can't start (Python's own words, such as a missing module).
    let pid = std::process::id().to_string();
    cmd.args(["-u", "-m", "audiodiver", "serve", "--parent-pid", pid.as_str()])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    let pair = core.endpoint.clone();
    let set = move |e: Endpoint| {
        let (lock, cv) = &*pair;
        *lock.lock().unwrap() = Some(e);
        cv.notify_all();
    };
    match cmd.spawn() {
        Ok(mut child) => {
            let stdout = child.stdout.take().unwrap();
            let stderr = child.stderr.take().unwrap();
            *core.child.lock().unwrap() = Some(child);
            // read to the end, so the pipe never fills; only the last line is kept
            let last_err = std::thread::spawn(move || {
                let mut last = String::new();
                for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                    if !line.trim().is_empty() {
                        last = line.trim().to_string();
                    }
                }
                last
            });
            std::thread::spawn(move || {
                let mut found = false;
                for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                    if let Some(json) = line.strip_prefix("AUDIODIVER_SERVER ") {
                        if let Ok(v) = serde_json::from_str::<serde_json::Value>(json) {
                            found = true;
                            set(Endpoint {
                                port: v["port"].as_u64().unwrap_or(0) as u16,
                                token: v["token"].as_str().unwrap_or("").into(),
                                error: None,
                            });
                        }
                    } else {
                        println!("[core] {line}");
                    }
                }
                if !found {
                    let said = last_err.join().unwrap_or_default();
                    let why = if said.is_empty() { "it gave no reason".to_string() } else { said.clone() };
                    let next = if said.contains("No module named") {
                        format!("That Python doesn't have the core, or a package the core needs: install the core into it (`pip install -e core`), or name the Python that has it in {file} as \"python\".")
                    } else {
                        format!("Check that `{python} -m audiodiver serve` runs in a terminal.")
                    };
                    set(Endpoint {
                        error: Some(format!("The Audiodiver core stopped before it started: {why}. Python: {python}{unread}. {next}")),
                        ..Default::default()
                    });
                }
            });
        }
        Err(e) => set(Endpoint {
            error: Some(format!(
                "Can't start Python ({python}): {e}{unread}. Install Python 3.12+ with the core, or name the Python that has it in {file} as \"python\"."
            )),
            ..Default::default()
        }),
    }
}

#[tauri::command]
fn core_endpoint(core: tauri::State<'_, Core>) -> Endpoint {
    let (lock, cv) = &*core.endpoint;
    let guard = cv
        .wait_timeout_while(lock.lock().unwrap(), std::time::Duration::from_secs(60), |e| e.is_none())
        .unwrap()
        .0;
    guard.clone().unwrap_or(Endpoint {
        error: Some("The Audiodiver core did not start within a minute.".into()),
        ..Default::default()
    })
}

const WEBVIEW2_URL: &str = "https://developer.microsoft.com/microsoft-edge/webview2/";

/// The window is drawn by the WebView2 Runtime. Windows 11 always has it and nearly every Windows 10 PC does; on one
/// without it the window would fail to open with no reason given.
#[cfg(windows)]
fn has_webview2() -> bool {
    use webview2_com::Microsoft::Web::WebView2::Win32::GetAvailableCoreWebView2BrowserVersionString;
    let mut version = windows_core::PWSTR::null();
    let found = unsafe { GetAvailableCoreWebView2BrowserVersionString(windows_core::PCWSTR::null(), &mut version) }.is_ok();
    found && !version.is_null() && !webview2_com::take_pwstr(version).is_empty()
}

/// Says the runtime is missing, in a plain Windows message box, and opens Microsoft's download page if asked.
#[cfg(windows)]
fn ask_for_webview2() {
    const OPEN: &str = "Open the download page";
    let answer = rfd::MessageDialog::new()
        .set_level(rfd::MessageLevel::Error)
        .set_title("Audiodiver")
        .set_description(
            "Audiodiver needs the Microsoft Edge WebView2 Runtime, which isn't installed on this computer.\n\n\
             It is free from Microsoft and installs without administrator rights. Choose the Evergreen Bootstrapper \
             on the download page, then start Audiodiver again.",
        )
        .set_buttons(rfd::MessageButtons::OkCancelCustom(OPEN.into(), "Close".into()))
        .show();
    if matches!(answer, rfd::MessageDialogResult::Custom(ref b) if b == OPEN) || answer == rfd::MessageDialogResult::Ok {
        let _ = Command::new("explorer").arg(WEBVIEW2_URL).spawn();
    }
}

/// A portable copy: it updates by downloading the new ZIP from the release's page, not through the installer.
#[tauri::command]
fn is_portable() -> bool {
    portable_data().is_some()
}

/// A project or pack among the arguments Audiodiver was started with (Explorer passes the file's full path; one
/// relative to `cwd` is made full).
fn file_arg(args: impl IntoIterator<Item = String>, cwd: &Path) -> Option<String> {
    args.into_iter()
        .skip(1)
        .find(|a| {
            let a = a.to_ascii_lowercase();
            a.ends_with(".audi") || a.ends_with(".audipack")
        })
        .map(|a| cwd.join(a).display().to_string())
}

/// The file Audiodiver was started with, until the window takes it.
#[derive(Default)]
struct LaunchFile(Mutex<Option<String>>);

/// The file Audiodiver was started with (a double-clicked project or pack), once: None after the first ask.
#[tauri::command]
fn launch_file(file: tauri::State<'_, LaunchFile>) -> Option<String> {
    file.0.lock().unwrap().take()
}

/// A portable copy's window: its place and size (inner, in physical pixels), kept in `data/window.json`.
#[derive(Serialize, Deserialize, Clone, Copy)]
struct Place {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    maximized: bool,
}

/// The portable window's place as it last was, and the file it is written to when the app exits.
#[derive(Default)]
struct Placed(Mutex<Option<(PathBuf, Place)>>);

/// The window as it was left: its size, its place if a screen is still there, and maximized.
fn restore_place(window: &WebviewWindow, file: &Path) {
    let Some(p) = std::fs::read_to_string(file).ok().and_then(|t| serde_json::from_str::<Place>(&t).ok()) else {
        return;
    };
    let on_screen = window.available_monitors().unwrap_or_default().iter().any(|m| {
        let (at, size) = (m.position(), m.size());
        p.x < at.x + size.width as i32 && p.x + p.width as i32 > at.x && p.y >= at.y - 8 && p.y < at.y + size.height as i32 - 40
    });
    let _ = window.set_size(PhysicalSize::new(p.width.max(400), p.height.max(300)));
    if on_screen {
        let _ = window.set_position(PhysicalPosition::new(p.x, p.y));
    }
    if p.maximized {
        let _ = window.maximize();
    }
}

/// The window's place now (a maximized or minimized window keeps the place it had before).
fn place_now(window: &WebviewWindow, before: Option<Place>) -> Option<Place> {
    if window.is_minimized().unwrap_or(false) {
        return before;
    }
    if window.is_maximized().unwrap_or(false) {
        return before.map(|b| Place { maximized: true, ..b });
    }
    let (at, size) = (window.outer_position().ok()?, window.inner_size().ok()?);
    Some(Place { x: at.x, y: at.y, width: size.width, height: size.height, maximized: false })
}

const WIKI: &str = "wiki"; // the label of the Wiki's own window

/// Whether the Wiki is in its own window (the main window loads again on a change of language, and asks).
#[tauri::command]
fn wiki_is_open(app: tauri::AppHandle) -> bool {
    app.get_webview_window(WIKI).is_some()
}

/// Brings a window to the front: the Wiki's for a page asked for in the main one, the main one for a link in the Wiki.
#[tauri::command]
fn bring_forward(label: String, app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window(&label) {
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// The Wiki in a window of its own, or to the front if it is there. Async: a window built in a synchronous command
/// deadlocks on Windows. A portable copy keeps this window's place as it keeps the main one's; it shares the WebView2
/// profile either way, and with it the browser storage that holds the theme and the language.
#[tauri::command]
async fn open_wiki(app: tauri::AppHandle) -> Result<(), String> {
    if app.get_webview_window(WIKI).is_some() {
        bring_forward(WIKI.into(), app);
        return Ok(());
    }
    let mut window = tauri::WebviewWindowBuilder::new(&app, WIKI, tauri::WebviewUrl::App("index.html?view=wiki".into()))
        .title("Audiodiver Wiki")
        .inner_size(1100.0, 800.0)
        .min_inner_size(640.0, 480.0);
    if utils_edition() {
        window = window.title("Audiodiver Utils Wiki").initialization_script("window.__AUDIODIVER_EDITION__ = 'utils';");
    }
    let portable = portable_data();
    if let Some(data) = &portable {
        window = window.data_directory(data.join("webview")).visible(false);
    }
    let window = window.build().map_err(|e| e.to_string())?;
    let place_file = portable.map(|data| data.join("wiki-window.json"));
    if let Some(file) = &place_file {
        restore_place(&window, file);
        let _ = window.show();
    }
    let w = window.clone();
    window.on_window_event(move |e| match e {
        WindowEvent::CloseRequested { .. } => {
            if let (Some(file), Some(place)) = (&place_file, place_now(&w, None)) {
                let _ = std::fs::write(file, serde_json::to_vec_pretty(&place).unwrap_or_default());
            }
        }
        WindowEvent::Destroyed => {
            let _ = app.emit_to("main", "wiki-closed", ());
        }
        _ => {}
    });
    Ok(())
}

/// Closes the Wiki's window, which brings the Wiki back into its tab.
#[tauri::command]
fn close_wiki(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window(WIKI) {
        let _ = window.close();
    }
}

pub fn run() {
    #[cfg(windows)]
    if !has_webview2() {
        ask_for_webview2();
        return;
    }
    let portable = portable_data();
    let utils = utils_edition();
    let cwd = std::env::current_dir().unwrap_or_default();
    let mut builder = tauri::Builder::default();
    if !utils {
        // first, so a second start hands over its file and ends before anything else of it runs
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            let Some(window) = app.get_webview_window("main") else { return };
            let _ = window.unminimize();
            let _ = window.set_focus();
            if let Some(file) = file_arg(args, Path::new(&cwd)) {
                let _ = window.emit("open-file", file);
            }
        }));
    }
    builder = builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init());
    if portable.is_none() {
        // the window reopens where and how big you left it
        builder = builder.plugin(tauri_plugin_window_state::Builder::default().build());
    }
    let app = builder
        // updates from the GitHub releases' latest.json, installed only when their signature matches the public key
        // in tauri.conf.json (the private key that signs releases is kept out of the repository)
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(Core::default())
        .manage(Placed::default())
        .manage(LaunchFile(Mutex::new(if utils { None } else { file_arg(std::env::args(), &cwd) })))
        .setup(move |app| {
            // the window, built here (it has `create: false` in tauri.conf.json) so a portable copy can keep its
            // WebView2 profile in its own data folder
            let config = app.config().app.windows.iter().find(|w| w.label == "main").cloned().expect("the main window's config");
            let mut window = tauri::WebviewWindowBuilder::from_config(app.handle(), &config)?;
            if utils {
                window = window.title("Audiodiver Utils").initialization_script("window.__AUDIODIVER_EDITION__ = 'utils';");
            }
            if let Some(data) = &portable {
                window = window.data_directory(data.join("webview")).visible(false);
            }
            let window = window.build()?;
            let handle = app.handle().clone();
            window.on_window_event(move |e| {
                if matches!(e, WindowEvent::Destroyed) {
                    close_wiki(handle.clone());
                }
            });
            if let Some(data) = &portable {
                let file = data.join("window.json");
                restore_place(&window, &file);
                let _ = window.show();
                *app.state::<Placed>().0.lock().unwrap() = place_now(&window, None).map(|p| (file, p));
                let w = window.clone();
                let handle = app.handle().clone();
                window.on_window_event(move |e| {
                    if matches!(e, WindowEvent::Moved(_) | WindowEvent::Resized(_)) {
                        let placed = handle.state::<Placed>();
                        let mut placed = placed.0.lock().unwrap();
                        if let Some((_, p)) = placed.as_mut() {
                            *p = place_now(&w, Some(*p)).unwrap_or(*p);
                        }
                    }
                });
            }
            let paths = Paths {
                config: match &portable {
                    Some(data) => Some(data.join("core.json")),
                    None => app.path().app_local_data_dir().ok().map(|d| d.join("core.json")),
                },
                bundled: app.path().resource_dir().ok().map(|d| d.join("core")),
                cache: portable.clone(),
            };
            spawn_core(&app.state::<Core>(), paths);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![core_endpoint, is_portable, launch_file, open_wiki, close_wiki, wiki_is_open, bring_forward])
        .build(tauri::generate_context!())
        .expect("error while building the app");
    app.run(|handle, event| {
        if let RunEvent::Exit = event {
            if let Some(mut child) = handle.state::<Core>().child.lock().unwrap().take() {
                let _ = child.kill();
            }
            if let Some((file, place)) = handle.state::<Placed>().0.lock().unwrap().take() {
                if let Some(dir) = file.parent() {
                    let _ = std::fs::create_dir_all(dir);
                }
                let _ = std::fs::write(file, serde_json::to_vec_pretty(&place).unwrap_or_default());
            }
        }
    });
}
