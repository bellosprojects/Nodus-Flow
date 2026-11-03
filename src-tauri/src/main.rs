// src-tauri/src/main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let mut args = std::env::args_os().skip(1);
    if args
        .next()
        .is_some_and(|argument| argument == "--mcp-stdio")
    {
        let Some(client_id) = args.next().and_then(|argument| argument.into_string().ok()) else {
            eprintln!("Missing or invalid Nodus MCP client ID.");
            std::process::exit(2);
        };
        if args.next().is_some() {
            eprintln!("Unexpected argument for Nodus MCP stdio mode.");
            std::process::exit(2);
        }
        std::process::exit(nodus_lib::run_mcp_stdio(&client_id));
    }
    nodus_lib::run();
}
