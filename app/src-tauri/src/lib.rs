//! The desktop shell: starts the Python core (`python -m audiodiver serve`), hands its port and token to the UI, and
//! stops it when the window closes. The interpreter is AUDIODIVER_PYTHON if set, else the one this computer's
//! `core.json` names (see `Launch`), else `python`.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Condvar, Mutex};
use tauri::{Manager, RunEvent};

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

/// How this computer runs the core when the `python` on PATH isn't the one that has it: `core.json` in the app's local
/// data folder (%LOCALAPPDATA%\com.audiodiver.editor), e.g.
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

fn spawn_core(core: &Core, config: Option<PathBuf>) {
    let file = config.as_ref().map_or("core.json".into(), |f| f.display().to_string());
    let (launch, unread) = match config.as_ref().and_then(|f| std::fs::read_to_string(f).ok()) {
        Some(text) => match serde_json::from_str::<Launch>(&text) {
            Ok(l) => (l, String::new()),
            Err(e) => (Launch::default(), format!(" ({file} was not used: {e})")),
        },
        None => (Launch::default(), String::new()),
    };
    let python = std::env::var("AUDIODIVER_PYTHON").ok().or(launch.python).unwrap_or_else(|| "python".into());
    let mut cmd = Command::new(&python);
    if !launch.path.is_empty() {
        let mut dirs: Vec<PathBuf> = launch.path.iter().map(PathBuf::from).collect();
        if let Some(p) = std::env::var_os("PATH") {
            dirs.extend(std::env::split_paths(&p));
        }
        if let Ok(joined) = std::env::join_paths(dirs) {
            cmd.env("PATH", joined);
        }
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

pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        // the window reopens where and how big you left it
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .manage(Core::default())
        .setup(|app| {
            let config = app.path().app_local_data_dir().ok().map(|d| d.join("core.json"));
            spawn_core(&app.state::<Core>(), config);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![core_endpoint])
        .build(tauri::generate_context!())
        .expect("error while building the app");
    app.run(|handle, event| {
        if let RunEvent::Exit = event {
            if let Some(mut child) = handle.state::<Core>().child.lock().unwrap().take() {
                let _ = child.kill();
            }
        }
    });
}
