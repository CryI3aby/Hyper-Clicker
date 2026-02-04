use std::str::FromStr;
use std::sync::{
    atomic::{AtomicBool, AtomicU64, Ordering},
    Arc, Mutex,
};
use std::thread::{self, Thread};
use std::time::Duration;

use tauri::Emitter;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

use device_query::{DeviceQuery, DeviceState, Keycode};
use enigo::{Button, Coordinate, Direction::Click, Enigo, Mouse, Settings};
use rand::Rng;


#[derive(Clone, serde::Deserialize)]
#[serde(tag = "type", content = "value")]
enum RepeatMode {
    Infinite,
    Count(u32),
}

#[derive(Clone, serde::Deserialize)]
struct ClickerConfig {
    interval_ms: u64,
    offset_ms: u64,
    offset_enabled: bool,
    button_type: String,
    click_type: String,
    repeat_mode: RepeatMode,
    lock_at_enabled: bool,
    x: i32,
    y: i32,
}

struct ClickerState {
    is_running: AtomicBool,
    interval_ms: AtomicU64,
    offset_ms: AtomicU64,
    offset_enabled: AtomicBool,
    button_type: Mutex<String>,
    click_type: Mutex<String>,
    repeat_mode: Mutex<RepeatMode>,
    lock_at_enabled: AtomicBool,
    coords: Mutex<(i32, i32)>,

    worker_thread: Mutex<Option<Thread>>,
}


#[tauri::command]
fn send_config(config: ClickerConfig, state: tauri::State<Arc<ClickerState>>) {
    state.interval_ms.store(config.interval_ms, Ordering::SeqCst);
    state.offset_ms.store(config.offset_ms, Ordering::SeqCst);
    state.offset_enabled.store(config.offset_enabled, Ordering::SeqCst);
    state.lock_at_enabled.store(config.lock_at_enabled, Ordering::SeqCst);

    {
        let mut btn = state.button_type.lock().unwrap();
        *btn = config.button_type;
    }
    {
        let mut ct = state.click_type.lock().unwrap();
        *ct = config.click_type;
    }
    {
        let mut rm = state.repeat_mode.lock().unwrap();
        *rm = config.repeat_mode;
    }
    {
        let mut co = state.coords.lock().unwrap();
        *co = (config.x, config.y);
    }
}

fn request_config(app: &tauri::AppHandle) {
    let _ = app.emit("request-config", ());
}

#[tauri::command]
fn start_engine(state: tauri::State<Arc<ClickerState>>) {
    state.is_running.store(true, Ordering::SeqCst);
    if let Some(thread) = state.worker_thread.lock().unwrap().as_ref() {
        thread.unpark();
    }
}

#[tauri::command]
fn stop_engine(state: tauri::State<Arc<ClickerState>>) {
    state.is_running.store(false, Ordering::SeqCst);
    if let Some(t) = state.worker_thread.lock().unwrap().as_ref() {
        t.unpark();
    }
}

fn engine(state: Arc<ClickerState>, app_handle: tauri::AppHandle) {
    thread::spawn(move || {
        let mut enigo = Enigo::new(&Settings::default()).unwrap();
        let mut rng = rand::rng();

        *state.worker_thread.lock().unwrap() = Some(thread::current());

        loop {
            if !state.is_running.load(Ordering::SeqCst) {
                thread::park();
            }
            if !state.is_running.load(Ordering::SeqCst) {
                continue;
            }

            let mut stop_after_this = false;
            {
                let mut mode = state.repeat_mode.lock().unwrap();
                if let RepeatMode::Count(ref mut count) = *mode {
                    if *count > 0 {
                        *count -= 1;
                    }
                    if *count == 0 {
                        stop_after_this = true;
                    }
                }
            }

            if state.lock_at_enabled.load(Ordering::SeqCst) {
                let (x, y) = *state.coords.lock().unwrap();
                let _ = enigo.move_mouse(x, y, Coordinate::Abs);
            }

            let button = {
                let guard = state.button_type.lock().unwrap();
                match guard.as_str() {
                    "Right" => Button::Right,
                    "Middle" => Button::Middle,
                    _ => Button::Left,
                }
            };

            let is_double = {
                let guard = state.click_type.lock().unwrap();
                guard.as_str() == "Double"
            };

            let _ = enigo.button(button, Click);
            if is_double {
                thread::park_timeout(Duration::from_millis(30));
                if !state.is_running.load(Ordering::SeqCst) {
                    continue;
                }
                let _ = enigo.button(button, Click);
            }

            if stop_after_this {
                state.is_running.store(false, Ordering::SeqCst);
                let _ = app_handle.emit("engine-stopped", ());
            }

            let base_interval = state.interval_ms.load(Ordering::SeqCst);
            let delay = if state.offset_enabled.load(Ordering::SeqCst) {
                let offset = state.offset_ms.load(Ordering::SeqCst);

                if offset > 0 {
                    let jitter = rng.random_range(0..=offset);
                    let plus = rng.random_bool(0.5);

                    if plus {
                        base_interval.saturating_add(jitter)
                    } else {
                        base_interval.saturating_sub(jitter)
                    }
                } else {
                    base_interval
                }
            } else {
                base_interval
            };

            thread::park_timeout(Duration::from_millis(delay));
        }
    });
}

#[tauri::command]
async fn get_mouse_pos() -> (i32, i32) {
    let device_state = DeviceState::new();

    loop {
        let keys = device_state.get_keys();

        if keys.contains(&Keycode::Enter) {
            let mouse = device_state.get_mouse();
            return mouse.coords;
        }

        thread::sleep(Duration::from_millis(50));
    }
}

#[tauri::command]
fn update_hotkey(app: tauri::AppHandle, hotkey: String) -> Result<(), String> {
    let manager = app.global_shortcut();
    let _ = manager.unregister_all();

    let shortcut = Shortcut::from_str(&hotkey)
        .map_err(|e| format!("Critical hotkey error: {}", e))?;

    manager.register(shortcut)
        .map_err(|e| format!("Declined by system: {}", e))?;

    Ok(())
}

#[tauri::command]
fn unregister_current_hotkey(app: tauri::AppHandle) -> Result<(), String> {
    let manager = app.global_shortcut();
    let _ = manager.unregister_all();
    Ok(())
}

#[tauri::command]
async fn capture_hotkey() -> Result<String, String> {
    let device_state = DeviceState::new();

    loop {
        if device_state.get_keys().is_empty() { break; }
        thread::sleep(Duration::from_millis(20));
    }

    let mut captured_keys: Vec<Keycode>;

    loop {
        let keys = device_state.get_keys();
        if !keys.is_empty() {
            captured_keys = keys;
            break;
        }
        thread::sleep(Duration::from_millis(10));
    }

    loop {
        let keys = device_state.get_keys();
        if keys.is_empty() { break; }
        for k in keys {
            if !captured_keys.contains(&k) {
                captured_keys.push(k);
            }
        }
        thread::sleep(Duration::from_millis(10));
    }

    let mut mods = Vec::new();
    let mut main_key = String::new();

    for key in captured_keys {
        match key {
            Keycode::LControl | Keycode::RControl => if !mods.contains(&"Control") { mods.push("Control") },
            Keycode::LShift | Keycode::RShift => if !mods.contains(&"Shift") { mods.push("Shift") },
            Keycode::LAlt | Keycode::RAlt => if !mods.contains(&"Alt") { mods.push("Alt") },
            Keycode::LMeta | Keycode::RMeta => if !mods.contains(&"Command") { mods.push("Command") },
            _ => {
                let k_str = format!("{:?}", key);
                main_key = k_str.replace("Key", "");
            }
        }
    }

    if main_key.is_empty() && mods.is_empty() {
        return Err("No keys captured".into());
    }

    if main_key.is_empty() {
        Ok(mods.join("+"))
    } else if mods.is_empty() {
        Ok(main_key)
    } else {
        Ok(format!("{}+{}", mods.join("+"), main_key))
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {

    let clicker_state = Arc::new(ClickerState {
        is_running: AtomicBool::new(false),
        interval_ms: AtomicU64::new(5),
        offset_enabled: AtomicBool::new(false),
        offset_ms: AtomicU64::new(0),

        button_type: Mutex::new("Left".to_string()),
        click_type: Mutex::new("Single".to_string()),
        repeat_mode: Mutex::new(RepeatMode::Infinite),
        lock_at_enabled: AtomicBool::new(false),
        coords: Mutex::new((0, 0)),

        worker_thread: Mutex::new(None),
    });

    tauri::Builder::default()
        .manage(clicker_state.clone())
        .setup({
            let state = clicker_state.clone();

            move |app| {
                engine(state.clone(), app.handle().clone());

                #[cfg(desktop)]
                {
                    use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Shortcut, ShortcutState};

                    let default_shortcut = Shortcut::new(None, Code::F6);
                    let state_for_handler = state.clone();

                    app.handle().plugin(
                        tauri_plugin_global_shortcut::Builder::new().with_handler(move |_app, _shortcut, event| {
                            if event.state() == ShortcutState::Pressed {
                                let is_running_now = state_for_handler.is_running.load(Ordering::SeqCst);

                                if !is_running_now {
                                    request_config(&_app);
                                } else {
                                    state_for_handler.is_running.store(false, Ordering::SeqCst);
                                    let _ = _app.emit("engine-stopped", ());
                                    if let Some(t) = state_for_handler.worker_thread.lock().unwrap().as_ref() {
                                        t.unpark();
                                    }
                                }

                            }
                        })
                        .build(),
                    )?;

                    let _ = app.global_shortcut().register(default_shortcut)?;
                }
                Ok(())
            }
        })
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            send_config,
            start_engine,
            stop_engine,
            get_mouse_pos,
            capture_hotkey,
            update_hotkey,
            unregister_current_hotkey,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
