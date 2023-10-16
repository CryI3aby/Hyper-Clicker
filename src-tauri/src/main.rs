// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use enigo::*;
// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command

#[tauri::command]
fn single_left() {
    let mut enigo = Enigo::new();
    enigo.mouse_click(MouseButton::Left);
}

#[tauri::command]
fn single_right() {
    let mut enigo = Enigo::new();
    enigo.mouse_click(MouseButton::Right);
}

#[tauri::command]
fn single_middle() {
    let mut enigo = Enigo::new();
    enigo.mouse_click(MouseButton::Middle);
}

#[tauri::command]
fn double_left() {
    let mut enigo = Enigo::new();
    enigo.mouse_click(MouseButton::Left);
    enigo.mouse_click(MouseButton::Left);
}

#[tauri::command]
fn double_right() {
    let mut enigo = Enigo::new();
    enigo.mouse_click(MouseButton::Right);
    enigo.mouse_click(MouseButton::Right);
}

#[tauri::command]
fn double_middle() {
    let mut enigo = Enigo::new();
    enigo.mouse_click(MouseButton::Middle);
    enigo.mouse_click(MouseButton::Middle);
}

#[tauri::command]
fn set_pos(xpos: i32, ypos: i32) {
    let mut enigo = Enigo::new();
    enigo.mouse_move_to(xpos, ypos);
}

#[tauri::command]
fn mouse_pos() -> (i32, i32) {
    let enigo = Enigo::new();
    let (x, y) = enigo.mouse_location();
    return(x,y);
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            single_left, 
            single_right, 
            single_middle, 
            double_left, 
            double_right, 
            double_middle, 
            set_pos, 
            mouse_pos
            ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}


