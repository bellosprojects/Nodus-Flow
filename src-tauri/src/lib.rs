use tauri_plugin_deep_link::DeepLinkExt;
mod ai_bridge;

use ai_bridge::{
    complete_ai_bridge_request, get_ai_bridge_status, list_ai_bridge_clients, pair_ai_bridge_client,
    revoke_ai_bridge_client, start_ai_bridge, stop_ai_bridge, AiBridgeState,
};
use std::process::{Stdio};
use std::io::{BufRead, BufReader, Write};
use std::sync::Mutex;
use tauri::{Emitter, Manager, State};

use tauri_plugin_shell::ShellExt;

struct HezaConsole {
    process: Mutex<std::process::Child>,
}

#[tauri::command]
fn eval_heza(state: State<'_, HezaConsole>, expr: String) -> Result<String, String> {
    let mut child = state.process.lock().unwrap();

    let mut stdin = child.stdin.take().ok_or("Error abriendo stdin")?;
    let stdout = child.stdout.take().ok_or("Error abriendo stdout")?;
    let mut reader = BufReader::new(stdout);

    let result = (|| -> Result<String, String> {
        let payload = format!("{}\n", expr);
        stdin.write_all(payload.as_bytes()).map_err(|e| e.to_string())?;
        stdin.flush().map_err(|e| e.to_string())?;

        let mut response = String::new();
        reader.read_line(&mut response).map_err(|e| e.to_string())?;

        Ok(response.trim().to_string())
    })();

    child.stdin = Some(stdin);
    child.stdout = Some(reader.into_inner());

    result
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        // 1. Registrar el plugin single-instance PRIMERO
        
        // 2. Luego el plugin deep-link
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            let bridge_state = AiBridgeState::new(app.handle().clone())
                .map_err(|error| std::io::Error::new(std::io::ErrorKind::Other, error))?;
            app.manage(bridge_state);

            #[cfg(any(target_os = "linux", target_os = "windows"))]
            {
                // En Linux/Windows, registramos el esquema para el ejecutable actual.
                app.deep_link().register_all().unwrap();
            }

            // Configuramos el callback principal para cuando la app se abre con un enlace.
            let app_handle = app.handle().clone();
            app.deep_link().on_open_url({
                let app_handle = app_handle.clone();
                move |event| {
                    let urls = event.urls().to_vec();
                    println!("URL recibida: {:?}", urls);
                    let _ = app_handle.emit("deep-link-url", urls);
                }
            });

            let sidecar_command = app.shell()
                .sidecar("heza_console")
                .expect("Fallo al crear el comando sidecar");

            let mut std_command: std::process::Command = sidecar_command.into();

            let mut child = std_command
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .spawn()
                .expect("Fallo al ejecutar heza_console.exe");

            if let Some(stdout) = child.stdout.as_mut() {
                let mut reader = BufReader::new(stdout);
                let mut welcome_banner = String::new();
                let _ = reader.read_line(&mut welcome_banner);
                println!("Mensaje de bienvenida omitido: {}", welcome_banner.trim());
            }

            app.manage(HezaConsole { process: Mutex::new(child)});

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            eval_heza,
            get_ai_bridge_status,
            start_ai_bridge,
            stop_ai_bridge,
            list_ai_bridge_clients,
            pair_ai_bridge_client,
            revoke_ai_bridge_client,
            complete_ai_bridge_request
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
