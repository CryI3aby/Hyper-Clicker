// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use enigo::{Button, Coordinate, Direction::Click, Enigo, Mouse, Settings};
use device_query::{DeviceState, MousePosition, DeviceQuery};
use std::time::Duration;
use std::thread;


#[tauri::command]
fn click(mouse_button: i32, click_type: i32, picked: bool, x_coord: i32, y_coord: i32) { 
    let mut enigo: Enigo = Enigo::new(&Settings::default()).unwrap();
    

    if picked == true {
        enigo.move_mouse(x_coord, y_coord, Coordinate::Abs).unwrap();
    }
    

    match mouse_button {
        1 => {
            enigo.button(Button::Left, Click).unwrap();
            if click_type == 2 {
                enigo.button(Button::Left, Click).unwrap();
            }
        },
        2 => {
            enigo.button(Button::Right, Click).unwrap();
            if click_type == 2 {
                enigo.button(Button::Right, Click).unwrap();
            }
        },
        3 => {
            enigo.button(Button::Middle, Click).unwrap();
            if click_type == 2 {
                enigo.button(Button::Middle, Click).unwrap();
            }
        },
        _ => { return; }
    }

}


#[tauri::command]
async fn get_mouse_pos() -> (i32, i32) {

    let device_state = DeviceState::new();
    let click_coords: MousePosition;
    
    loop {
        let mouse = device_state.get_mouse();
        if mouse.button_pressed[1] == true {
            click_coords = mouse.coords;
            break;
        }
        thread::sleep(Duration::from_millis(10));
    }

    return click_coords;
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![click, get_mouse_pos])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
