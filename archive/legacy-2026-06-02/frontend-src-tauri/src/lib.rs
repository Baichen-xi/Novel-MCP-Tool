use std::{
    fs::OpenOptions,
    net::{SocketAddr, TcpStream},
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::{Mutex, OnceLock},
    time::Duration,
};

use tauri::{AppHandle, Manager};

static BACKEND_PROCESS: OnceLock<Mutex<Option<Child>>> = OnceLock::new();

#[derive(serde::Serialize)]
struct BackendStatus {
    running: bool,
    backend_dir: Option<String>,
    bundled_backend_path: Option<String>,
    launch_mode: String,
    app_data_dir: Option<String>,
    database_path: Option<String>,
    log_path: Option<String>,
    python_available: bool,
    python_version: Option<String>,
    dependencies_available: bool,
    dependency_error: Option<String>,
    last_log: String,
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![backend_status])
        .setup(|app| {
            start_backend(app.handle());
            Ok(())
        })
        .on_window_event(|_, event| {
            if matches!(event, tauri::WindowEvent::Destroyed) {
                stop_backend();
            }
        })
        .run(tauri::generate_context!())
        .expect("failed to run novel cockpit");
}

#[tauri::command]
fn backend_status(app: AppHandle) -> BackendStatus {
    collect_backend_status(&app)
}

fn start_backend(app: &AppHandle) {
    if backend_is_running() {
        return;
    }

    let Ok(app_data_dir) = app.path().app_data_dir() else {
        eprintln!("novel cockpit app data directory not available");
        return;
    };

    if let Err(error) = std::fs::create_dir_all(&app_data_dir) {
        eprintln!("failed to create app data directory: {error}");
        return;
    }

    let db_path = app_data_dir.join("novel.db");
    let log_path = app_data_dir.join("backend.log");
    append_log(&log_path, "starting backend");

    let Ok(stdout) = OpenOptions::new().create(true).append(true).open(&log_path) else {
        eprintln!("failed to open backend log");
        return;
    };
    let Ok(stderr) = stdout.try_clone() else {
        eprintln!("failed to clone backend log handle");
        return;
    };

    let (mut command, launch_mode) = if let Some(exe_path) = resolve_bundled_backend_exe(app) {
        append_log(&log_path, &format!("using bundled backend: {}", exe_path.display()));
        (Command::new(exe_path), "bundled-exe".to_string())
    } else {
        let Some(backend_dir) = resolve_backend_dir(app) else {
            append_log(&log_path, "backend directory not found");
            eprintln!("novel cockpit backend directory not found");
            return;
        };
        let (python_available, python_version) = python_version();
        if !python_available {
            append_log(&log_path, "python command not available");
            return;
        }
        if let Err(error) = check_python_dependencies(&backend_dir) {
            append_log(&log_path, &format!("python dependency check failed: {error}"));
            return;
        }
        let mut python = Command::new("python");
        python
            .args([
                "-m",
                "uvicorn",
                "app.main:app",
                "--host",
                "127.0.0.1",
                "--port",
                "8765",
            ])
            .current_dir(backend_dir);
        append_log(&log_path, &format!("using python backend with {python_version:?}"));
        (python, "python".to_string())
    };

    command
        .env("NOVEL_COCKPIT_DB", db_path)
        .env("NOVEL_COCKPIT_PORT", "8765")
        .env("PYTHONUTF8", "1")
        .stdin(Stdio::null())
        .stdout(Stdio::from(stdout))
        .stderr(Stdio::from(stderr));

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }

    match command.spawn() {
        Ok(child) => {
            append_log(&log_path, &format!("backend process spawned in {launch_mode} mode"));
            let process = BACKEND_PROCESS.get_or_init(|| Mutex::new(None));
            if let Ok(mut slot) = process.lock() {
                *slot = Some(child);
            }
        }
        Err(error) => {
            append_log(&log_path, &format!("failed to start backend: {error}"));
            eprintln!("failed to start novel cockpit backend: {error}");
        }
    }
}

fn stop_backend() {
    let Some(process) = BACKEND_PROCESS.get() else {
        return;
    };
    if let Ok(mut slot) = process.lock() {
        if let Some(child) = slot.as_mut() {
            let _ = child.kill();
            let _ = child.wait();
        }
        *slot = None;
    }
}

fn backend_is_running() -> bool {
    let addr = SocketAddr::from(([127, 0, 0, 1], 8765));
    TcpStream::connect_timeout(&addr, Duration::from_millis(200)).is_ok()
}

fn resolve_backend_dir(app: &AppHandle) -> Option<PathBuf> {
    let mut candidates = Vec::new();

    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join("backend"));
        candidates.push(resource_dir);
    }

    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    if let Some(project_root) = manifest_dir.parent().and_then(|frontend| frontend.parent()) {
        candidates.push(project_root.join("backend"));
    }

    candidates
        .into_iter()
        .find(|path| path.join("app").join("main.py").exists())
}

fn resolve_bundled_backend_exe(app: &AppHandle) -> Option<PathBuf> {
    let mut candidates = Vec::new();

    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join("backend").join("dist").join(exe_name()));
        candidates.push(resource_dir.join("dist").join(exe_name()));
        candidates.push(resource_dir.join(exe_name()));
    }

    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    if let Some(project_root) = manifest_dir.parent().and_then(|frontend| frontend.parent()) {
        candidates.push(project_root.join("backend").join("dist").join(exe_name()));
    }

    candidates.into_iter().find(|path| path.exists())
}

fn exe_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "novel-cockpit-backend.exe"
    } else {
        "novel-cockpit-backend"
    }
}

fn collect_backend_status(app: &AppHandle) -> BackendStatus {
    let backend_dir = resolve_backend_dir(app);
    let bundled_backend_path = resolve_bundled_backend_exe(app);
    let app_data_dir = app.path().app_data_dir().ok();
    let database_path = app_data_dir.as_ref().map(|path| path.join("novel.db"));
    let log_path = app_data_dir.as_ref().map(|path| path.join("backend.log"));
    let (python_available, python_version) = python_version();
    let dependency_result = if bundled_backend_path.is_some() {
        Ok(())
    } else {
        backend_dir
            .as_ref()
            .map(|path| check_python_dependencies(path))
            .unwrap_or_else(|| Err("backend directory not found".to_string()))
    };
    let launch_mode = if bundled_backend_path.is_some() {
        "bundled-exe"
    } else if python_available && dependency_result.is_ok() {
        "python"
    } else {
        "unavailable"
    };

    BackendStatus {
        running: backend_is_running(),
        backend_dir: backend_dir.map(|path| path.display().to_string()),
        bundled_backend_path: bundled_backend_path.map(|path| path.display().to_string()),
        launch_mode: launch_mode.to_string(),
        app_data_dir: app_data_dir.map(|path| path.display().to_string()),
        database_path: database_path.map(|path| path.display().to_string()),
        log_path: log_path.as_ref().map(|path| path.display().to_string()),
        python_available,
        python_version,
        dependencies_available: dependency_result.is_ok(),
        dependency_error: dependency_result.err(),
        last_log: log_path
            .as_ref()
            .and_then(|path| std::fs::read_to_string(path).ok())
            .map(|text| tail_lines(&text, 12))
            .unwrap_or_default(),
    }
}

fn python_version() -> (bool, Option<String>) {
    match Command::new("python").arg("--version").output() {
        Ok(output) if output.status.success() => {
            let text = if output.stdout.is_empty() { output.stderr } else { output.stdout };
            (true, Some(String::from_utf8_lossy(&text).trim().to_string()))
        }
        Ok(output) => (
            false,
            Some(String::from_utf8_lossy(&output.stderr).trim().to_string()),
        ),
        Err(_) => (false, None),
    }
}

fn check_python_dependencies(backend_dir: &PathBuf) -> Result<(), String> {
    let output = Command::new("python")
        .args(["-c", "import fastapi, uvicorn, fastmcp, pydantic"])
        .current_dir(backend_dir)
        .output()
        .map_err(|error| error.to_string())?;
    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(if stderr.is_empty() {
            "failed to import fastapi, uvicorn, fastmcp or pydantic".to_string()
        } else {
            stderr
        })
    }
}

fn append_log(path: &PathBuf, message: &str) {
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let line = format!("[novel-cockpit] {message}\n");
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
        use std::io::Write;
        let _ = file.write_all(line.as_bytes());
    }
}

fn tail_lines(text: &str, count: usize) -> String {
    let lines: Vec<&str> = text.lines().collect();
    let start = lines.len().saturating_sub(count);
    lines[start..].join("\n")
}
