use axum::{
    extract::{ConnectInfo, DefaultBodyLimit, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::post,
    Json, Router,
};
use rand::{rngs::OsRng, RngCore};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    net::{IpAddr, Ipv4Addr, SocketAddr},
    path::PathBuf,
    sync::{Arc, Mutex},
    time::Duration,
};
use subtle::ConstantTimeEq;
use tauri::{async_runtime::JoinHandle, AppHandle, Emitter, Manager, State as TauriState};
use tokio::{
    net::TcpListener,
    sync::{oneshot, Semaphore},
};
use uuid::Uuid;

const BRIDGE_PORT: u16 = 47831;
const MAX_PENDING_CALLS: usize = 8;
const CALL_TIMEOUT: Duration = Duration::from_secs(120);
const MCP_PROTOCOL_VERSION: &str = "2025-11-25";
const AI_TOKEN_KEYRING_SERVICE: &str = "com.bellosprojects.nodus.ai-bridge";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BridgeStatus {
    enabled: bool,
    endpoint: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BridgeClient {
    id: String,
    name: String,
    created_at: u64,
}

#[derive(Clone, Serialize, Deserialize)]
struct StoredClient {
    name: String,
    created_at: u64,
    token_hash: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NewBridgeClient {
    client: BridgeClient,
    token: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiClientSetup {
    config_path: String,
    backup_path: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiClientTargetInfo {
    id: String,
    label: String,
    detected: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ToolRequestEvent {
    request_id: String,
    client_id: String,
    client_name: String,
    method: String,
    params: Value,
}

#[derive(Deserialize)]
struct RpcRequest {
    jsonrpc: String,
    id: Option<Value>,
    method: String,
    #[serde(default)]
    params: Value,
}

#[derive(Clone)]
pub struct AiBridgeState {
    app: AppHandle,
    clients: Arc<Mutex<HashMap<String, StoredClient>>>,
    pending: Arc<Mutex<HashMap<String, oneshot::Sender<Value>>>>,
    server: Arc<Mutex<Option<JoinHandle<()>>>>,
    permits: Arc<Semaphore>,
    clients_path: PathBuf,
}

impl AiBridgeState {
    pub fn new(app: AppHandle) -> Result<Self, String> {
        let data_dir = app
            .path()
            .app_data_dir()
            .map_err(|error| format!("Could not resolve app data directory: {error}"))?;
        let clients_path = data_dir.join("ai-bridge-clients.json");
        let clients = match std::fs::read(&clients_path) {
            Ok(data) => match serde_json::from_slice(&data) {
                Ok(clients) => clients,
                Err(error) => {
                    eprintln!(
                        "Could not restore paired AI clients; they must be paired again: {error}"
                    );
                    HashMap::new()
                }
            },
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => HashMap::new(),
            Err(error) => return Err(format!("Could not read AI bridge clients: {error}")),
        };

        Ok(Self {
            app,
            clients: Arc::new(Mutex::new(clients)),
            pending: Arc::new(Mutex::new(HashMap::new())),
            server: Arc::new(Mutex::new(None)),
            permits: Arc::new(Semaphore::new(MAX_PENDING_CALLS)),
            clients_path,
        })
    }

    fn persist_clients(&self, clients: &HashMap<String, StoredClient>) -> Result<(), String> {
        let parent = self
            .clients_path
            .parent()
            .ok_or_else(|| "AI bridge client storage path is invalid.".to_string())?;
        std::fs::create_dir_all(parent)
            .map_err(|error| format!("Could not create AI bridge storage: {error}"))?;
        let contents = serde_json::to_vec(clients)
            .map_err(|error| format!("Could not serialize AI bridge clients: {error}"))?;
        std::fs::write(&self.clients_path, contents)
            .map_err(|error| format!("Could not save AI bridge clients: {error}"))
    }
}

#[tauri::command]
pub fn get_ai_bridge_status(state: TauriState<'_, AiBridgeState>) -> Result<BridgeStatus, String> {
    let enabled = state
        .server
        .lock()
        .map_err(|_| "AI bridge state is unavailable.".to_string())?
        .is_some();
    Ok(BridgeStatus {
        enabled,
        endpoint: format!("http://127.0.0.1:{BRIDGE_PORT}/mcp"),
    })
}

#[tauri::command]
pub async fn start_ai_bridge(state: TauriState<'_, AiBridgeState>) -> Result<BridgeStatus, String> {
    {
        let server = state
            .server
            .lock()
            .map_err(|_| "AI bridge state is unavailable.".to_string())?;
        if server.is_some() {
            return Ok(BridgeStatus {
                enabled: true,
                endpoint: format!("http://127.0.0.1:{BRIDGE_PORT}/mcp"),
            });
        }
    }

    let address = SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), BRIDGE_PORT);
    let listener = TcpListener::bind(address)
        .await
        .map_err(|error| format!("Could not start the local AI bridge: {error}"))?;
    let router = Router::new()
        .route("/v1/rpc", post(handle_rpc))
        .route("/mcp", post(handle_mcp).get(handle_mcp_get))
        .layer(DefaultBodyLimit::max(64 * 1024))
        .with_state(state.inner().clone());
    let task = tauri::async_runtime::spawn(async move {
        if let Err(error) = axum::serve(
            listener,
            router.into_make_service_with_connect_info::<SocketAddr>(),
        )
        .await
        {
            eprintln!("AI bridge server stopped: {error}");
        }
    });

    let mut server = state
        .server
        .lock()
        .map_err(|_| "AI bridge state is unavailable.".to_string())?;
    if server.is_some() {
        task.abort();
    } else {
        *server = Some(task);
    }

    Ok(BridgeStatus {
        enabled: true,
        endpoint: format!("http://127.0.0.1:{BRIDGE_PORT}/mcp"),
    })
}

#[tauri::command]
pub fn stop_ai_bridge(state: TauriState<'_, AiBridgeState>) -> Result<BridgeStatus, String> {
    let mut server = state
        .server
        .lock()
        .map_err(|_| "AI bridge state is unavailable.".to_string())?;
    if let Some(task) = server.take() {
        task.abort();
    }
    state
        .pending
        .lock()
        .map_err(|_| "AI bridge request state is unavailable.".to_string())?
        .clear();
    Ok(BridgeStatus {
        enabled: false,
        endpoint: format!("http://127.0.0.1:{BRIDGE_PORT}/mcp"),
    })
}

#[tauri::command]
pub fn list_ai_bridge_clients(
    state: TauriState<'_, AiBridgeState>,
) -> Result<Vec<BridgeClient>, String> {
    let clients = state
        .clients
        .lock()
        .map_err(|_| "AI bridge client state is unavailable.".to_string())?;
    let mut result = clients
        .iter()
        .map(|(id, client)| BridgeClient {
            id: id.clone(),
            name: client.name.clone(),
            created_at: client.created_at,
        })
        .collect::<Vec<_>>();
    result.sort_by(|left, right| left.name.cmp(&right.name));
    Ok(result)
}

#[tauri::command]
pub fn pair_ai_bridge_client(
    state: TauriState<'_, AiBridgeState>,
    name: String,
) -> Result<NewBridgeClient, String> {
    if state
        .server
        .lock()
        .map_err(|_| "AI bridge state is unavailable.".to_string())?
        .is_none()
    {
        return Err("Enable the local AI bridge before pairing a client.".to_string());
    }
    let name = name.trim();
    if name.is_empty() || name.chars().count() > 60 {
        return Err("Client name must contain 1-60 characters.".to_string());
    }

    let mut bytes = [0_u8; 32];
    OsRng.fill_bytes(&mut bytes);
    let token = hex::encode(bytes);
    let token_hash = hex::encode(Sha256::digest(token.as_bytes()));
    let id = Uuid::new_v4().to_string();
    let created_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|error| format!("System clock is invalid: {error}"))?
        .as_secs();
    let client = StoredClient {
        name: name.to_string(),
        created_at,
        token_hash,
    };

    store_ai_bridge_token(&id, &token)?;
    let mut clients = state
        .clients
        .lock()
        .map_err(|_| "AI bridge client state is unavailable.".to_string())?;
    let mut next = clients.clone();
    next.insert(id.clone(), client);
    if let Err(error) = state.persist_clients(&next) {
        let cleanup = delete_ai_bridge_token(&id);
        return Err(match cleanup {
            Ok(()) => error,
            Err(cleanup_error) => format!("{error} Token cleanup also failed: {cleanup_error}"),
        });
    }
    *clients = next;

    Ok(NewBridgeClient {
        client: BridgeClient {
            id,
            name: name.to_string(),
            created_at,
        },
        token,
    })
}

#[tauri::command]
pub fn revoke_ai_bridge_client(
    state: TauriState<'_, AiBridgeState>,
    client_id: String,
) -> Result<(), String> {
    let mut clients = state
        .clients
        .lock()
        .map_err(|_| "AI bridge client state is unavailable.".to_string())?;
    if !clients.contains_key(&client_id) {
        return Err("Paired client not found.".to_string());
    }
    let mut next = clients.clone();
    next.remove(&client_id);
    state.persist_clients(&next)?;
    *clients = next;
    delete_ai_bridge_token(&client_id)?;
    Ok(())
}

pub(crate) fn load_ai_bridge_token(client_id: &str) -> Result<String, String> {
    let entry = keyring::Entry::new(AI_TOKEN_KEYRING_SERVICE, client_id)
        .map_err(|error| format!("Could not access the system credential store: {error}"))?;
    match entry.get_password() {
        Ok(token) => Ok(token),
        Err(keyring::Error::NoEntry) => Err(
            "This paired client has no securely stored token. Revoke it and pair it again."
                .to_string(),
        ),
        Err(error) => Err(format!("Could not read the paired AI credential: {error}")),
    }
}

fn store_ai_bridge_token(client_id: &str, token: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(AI_TOKEN_KEYRING_SERVICE, client_id)
        .map_err(|error| format!("Could not access the system credential store: {error}"))?;
    entry
        .set_password(token)
        .map_err(|error| format!("Could not store the AI credential securely: {error}"))
}

fn delete_ai_bridge_token(client_id: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(AI_TOKEN_KEYRING_SERVICE, client_id)
        .map_err(|error| format!("Could not access the system credential store: {error}"))?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(format!(
            "Could not remove the stored AI credential: {error}"
        )),
    }
}

#[tauri::command]
pub fn configure_ai_client(
    state: TauriState<'_, AiBridgeState>,
    client_id: String,
    target: String,
) -> Result<AiClientSetup, String> {
    let active_client = state
        .clients
        .lock()
        .map_err(|_| "AI bridge client state is unavailable.".to_string())?
        .contains_key(&client_id);
    if !active_client {
        return Err("Paired client not found.".to_string());
    }
    load_ai_bridge_token(&client_id)?;

    let (config_path, property_name, include_stdio_type) = ai_client_config_path(&target)?;
    let executable = std::env::current_exe()
        .map_err(|error| format!("Could not locate the Nodus executable: {error}"))?
        .to_string_lossy()
        .replace('\\', "/");
    let args: jsonc_parser::cst::CstInputValue = vec![
        jsonc_parser::cst::CstInputValue::from("--mcp-stdio"),
        jsonc_parser::cst::CstInputValue::from(client_id.as_str()),
    ]
    .into();
    let mut server_fields = vec![
        ("command".to_string(), executable.as_str().into()),
        ("args".to_string(), args),
    ];
    if include_stdio_type {
        server_fields.insert(0, ("type".to_string(), "stdio".into()));
    }
    let server = jsonc_parser::cst::CstInputValue::from(server_fields);

    let original = match std::fs::read_to_string(&config_path) {
        Ok(contents) => contents,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => "{}\n".to_string(),
        Err(error) => return Err(format!("Could not read AI client config: {error}")),
    };
    let updated = upsert_config_entry(&original, property_name, server)?;

    let backup_path = if config_path.exists() {
        let backup_path = config_backup_path(&config_path)?;
        std::fs::copy(&config_path, &backup_path)
            .map_err(|error| format!("Could not back up AI client config: {error}"))?;
        Some(backup_path.to_string_lossy().into_owned())
    } else {
        None
    };
    if let Some(parent) = config_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|error| format!("Could not create AI client config directory: {error}"))?;
    }
    std::fs::write(&config_path, updated)
        .map_err(|error| format!("Could not write AI client config: {error}"))?;

    Ok(AiClientSetup {
        config_path: config_path.to_string_lossy().into_owned(),
        backup_path,
    })
}

#[tauri::command]
pub fn unconfigure_ai_client(target: String) -> Result<AiClientSetup, String> {
    let (config_path, property_name, _) = ai_client_config_path(&target)?;
    let original = std::fs::read_to_string(&config_path)
        .map_err(|error| format!("Could not read AI client config: {error}"))?;
    let parsed: Value =
        jsonc_parser::parse_to_serde_value(&original, &jsonc_parser::ParseOptions::default())
            .map_err(|error| format!("AI client config is not valid JSONC: {error}"))?
            .ok_or_else(|| "AI client config does not contain a JSON value.".to_string())?;
    let server = parsed
        .get(property_name)
        .and_then(Value::as_object)
        .and_then(|servers| servers.get("nodus-flow"))
        .ok_or_else(|| "Nodus is not configured in this AI client.".to_string())?;
    let is_nodus_stdio = server
        .get("args")
        .and_then(Value::as_array)
        .is_some_and(|args| {
            args.first().and_then(Value::as_str) == Some("--mcp-stdio")
                && args
                    .get(1)
                    .and_then(Value::as_str)
                    .is_some_and(|client_id| Uuid::parse_str(client_id).is_ok())
        });
    if !is_nodus_stdio {
        return Err(
            "The nodus-flow entry is not a Nodus stdio configuration; it was left unchanged."
                .to_string(),
        );
    }

    let updated = remove_config_entry(&original, property_name)?;

    let backup_path = config_backup_path(&config_path)?;
    std::fs::copy(&config_path, &backup_path)
        .map_err(|error| format!("Could not back up AI client config: {error}"))?;
    std::fs::write(&config_path, updated)
        .map_err(|error| format!("Could not write AI client config: {error}"))?;
    Ok(AiClientSetup {
        config_path: config_path.to_string_lossy().into_owned(),
        backup_path: Some(backup_path.to_string_lossy().into_owned()),
    })
}

fn upsert_config_entry(
    original: &str,
    property_name: &str,
    server: jsonc_parser::cst::CstInputValue,
) -> Result<String, String> {
    let root =
        jsonc_parser::cst::CstRootNode::parse(original, &jsonc_parser::ParseOptions::default())
            .map_err(|error| format!("AI client config is not valid JSONC: {error}"))?;
    let root_object = root
        .object_value_or_create()
        .ok_or_else(|| "AI client config must contain a JSON object at the root.".to_string())?;
    let servers = root_object
        .object_value_or_create(property_name)
        .ok_or_else(|| {
            format!("AI client config property \"{property_name}\" must be an object.")
        })?;
    if let Some(existing) = servers.get("nodus-flow") {
        existing.set_value(server);
    } else {
        servers.append("nodus-flow", server);
    }
    Ok(root.to_string())
}

fn remove_config_entry(original: &str, property_name: &str) -> Result<String, String> {
    let root =
        jsonc_parser::cst::CstRootNode::parse(original, &jsonc_parser::ParseOptions::default())
            .map_err(|error| format!("AI client config is not valid JSONC: {error}"))?;
    let root_object = root
        .object_value()
        .ok_or_else(|| "AI client config must contain a JSON object at the root.".to_string())?;
    let servers = root_object.object_value(property_name).ok_or_else(|| {
        format!("AI client config property \"{property_name}\" must be an object.")
    })?;
    servers
        .get("nodus-flow")
        .ok_or_else(|| "Nodus is not configured in this AI client.".to_string())?
        .remove();
    Ok(root.to_string())
}

fn ai_client_config_path(target: &str) -> Result<(PathBuf, &'static str, bool), String> {
    let config_dir = dirs::config_dir()
        .ok_or_else(|| "Could not locate the user configuration directory.".to_string())?;
    let home_dir =
        dirs::home_dir().ok_or_else(|| "Could not locate the user home directory.".to_string())?;
    match target {
        "vscode" => {
            let stable = config_dir.join("Code").join("User").join("mcp.json");
            let insiders = config_dir
                .join("Code - Insiders")
                .join("User")
                .join("mcp.json");
            let path = if stable.exists() || !insiders.exists() {
                stable
            } else {
                insiders
            };
            Ok((path, "servers", true))
        }
        "claude" => Ok((
            config_dir.join("Claude").join("claude_desktop_config.json"),
            "mcpServers",
            false,
        )),
        "cursor" => Ok((
            home_dir.join(".cursor").join("mcp.json"),
            "mcpServers",
            false,
        )),
        _ => Err("Unsupported AI client. Choose VS Code, Claude Desktop, or Cursor.".to_string()),
    }
}

#[tauri::command]
pub fn list_ai_client_targets() -> Result<Vec<AiClientTargetInfo>, String> {
    let config_dir = dirs::config_dir()
        .ok_or_else(|| "Could not locate the user configuration directory.".to_string())?;
    let home_dir =
        dirs::home_dir().ok_or_else(|| "Could not locate the user home directory.".to_string())?;
    let local_app_data = std::env::var_os("LOCALAPPDATA").map(PathBuf::from);
    let program_files = std::env::var_os("ProgramFiles").map(PathBuf::from);

    let vscode_detected = [
        config_dir.join("Code").join("User"),
        config_dir.join("Code - Insiders").join("User"),
        local_app_data
            .as_ref()
            .map(|path| {
                path.join("Programs")
                    .join("Microsoft VS Code")
                    .join("Code.exe")
            })
            .unwrap_or_default(),
        program_files
            .as_ref()
            .map(|path| path.join("Microsoft VS Code").join("Code.exe"))
            .unwrap_or_default(),
        PathBuf::from("/Applications/Visual Studio Code.app"),
        home_dir.join("Applications").join("Visual Studio Code.app"),
    ]
    .iter()
    .any(|path| !path.as_os_str().is_empty() && path.exists())
        || executable_in_path(&["code", "code.exe"]);
    let claude_detected = [
        config_dir.join("Claude"),
        local_app_data
            .as_ref()
            .map(|path| path.join("Programs").join("Claude").join("Claude.exe"))
            .unwrap_or_default(),
        PathBuf::from("/Applications/Claude.app"),
        home_dir.join("Applications").join("Claude.app"),
    ]
    .iter()
    .any(|path| !path.as_os_str().is_empty() && path.exists());
    let cursor_detected = [
        home_dir.join(".cursor"),
        local_app_data
            .as_ref()
            .map(|path| path.join("Programs").join("Cursor").join("Cursor.exe"))
            .unwrap_or_default(),
        PathBuf::from("/Applications/Cursor.app"),
        home_dir.join("Applications").join("Cursor.app"),
    ]
    .iter()
    .any(|path| !path.as_os_str().is_empty() && path.exists())
        || executable_in_path(&["cursor", "cursor.exe"]);

    Ok(vec![
        AiClientTargetInfo {
            id: "vscode".to_string(),
            label: "VS Code / Copilot".to_string(),
            detected: vscode_detected,
        },
        AiClientTargetInfo {
            id: "claude".to_string(),
            label: "Claude Desktop".to_string(),
            detected: claude_detected,
        },
        AiClientTargetInfo {
            id: "cursor".to_string(),
            label: "Cursor".to_string(),
            detected: cursor_detected,
        },
    ])
}

fn executable_in_path(names: &[&str]) -> bool {
    let Some(path) = std::env::var_os("PATH") else {
        return false;
    };
    std::env::split_paths(&path)
        .any(|directory| names.iter().any(|name| directory.join(name).is_file()))
}

fn config_backup_path(config_path: &PathBuf) -> Result<PathBuf, String> {
    let file_name = config_path
        .file_name()
        .ok_or_else(|| "AI client config path is invalid.".to_string())?
        .to_string_lossy();
    let unique = Uuid::new_v4().simple().to_string();
    Ok(config_path.with_file_name(format!(
        "{file_name}.nodus-backup-{}-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|error| format!("System clock is invalid: {error}"))?
            .as_secs(),
        &unique[..8]
    )))
}

#[tauri::command]
pub fn complete_ai_bridge_request(
    state: TauriState<'_, AiBridgeState>,
    request_id: String,
    result: Value,
) -> Result<(), String> {
    let sender = state
        .pending
        .lock()
        .map_err(|_| "AI bridge request state is unavailable.".to_string())?
        .remove(&request_id)
        .ok_or_else(|| "AI bridge request expired or was already completed.".to_string())?;
    sender
        .send(result)
        .map_err(|_| "AI bridge client disconnected before receiving the result.".to_string())
}

async fn handle_rpc(
    State(state): State<AiBridgeState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(request): Json<RpcRequest>,
) -> Response {
    let (client_id, client_name) = match authenticate(&state, peer, &headers) {
        Ok(client) => client,
        Err(response) => return response,
    };
    let content_type = headers
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default();
    if !content_type.starts_with("application/json") {
        return (
            StatusCode::UNSUPPORTED_MEDIA_TYPE,
            "JSON content type required.",
        )
            .into_response();
    }
    if request.jsonrpc != "2.0" {
        return rpc_error(request.id, -32600, "Invalid JSON-RPC version.");
    }
    if !matches!(&request.id, Some(Value::String(_) | Value::Number(_))) {
        return rpc_error(
            request.id,
            -32600,
            "A string or numeric request ID is required.",
        );
    }
    if request.method != "tools/list" && request.method != "tools/call" {
        return rpc_error(request.id, -32601, "Method not found.");
    }
    match relay_tool_request(
        &state,
        client_id,
        client_name,
        request.method,
        request.params,
    )
    .await
    {
        Ok(result) => Json(json!({
            "jsonrpc": "2.0",
            "id": request.id,
            "result": result
        }))
        .into_response(),
        Err(error) => rpc_error(request.id, error.code, &error.message),
    }
}

async fn handle_mcp(
    State(state): State<AiBridgeState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(mut request): Json<RpcRequest>,
) -> Response {
    let (client_id, client_name) = match authenticate(&state, peer, &headers) {
        Ok(client) => client,
        Err(response) => return response,
    };
    let content_type = headers
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default();
    if !content_type.starts_with("application/json") {
        return (
            StatusCode::UNSUPPORTED_MEDIA_TYPE,
            "JSON content type required.",
        )
            .into_response();
    }
    let accept = headers
        .get(header::ACCEPT)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default();
    if !accept.contains("application/json") || !accept.contains("text/event-stream") {
        return (
            StatusCode::NOT_ACCEPTABLE,
            "MCP clients must accept JSON and event streams.",
        )
            .into_response();
    }
    if request.jsonrpc != "2.0" {
        return rpc_error(request.id, -32600, "Invalid JSON-RPC version.");
    }
    let response_version = if request.method == "initialize" {
        request
            .params
            .get("protocolVersion")
            .and_then(Value::as_str)
            .unwrap_or(MCP_PROTOCOL_VERSION)
            .to_string()
    } else {
        let Some(version) = headers
            .get("mcp-protocol-version")
            .and_then(|value| value.to_str().ok())
        else {
            return (
                StatusCode::BAD_REQUEST,
                "MCP-Protocol-Version is required after initialize.",
            )
                .into_response();
        };
        if !is_supported_protocol_version(version) {
            return (StatusCode::BAD_REQUEST, "Unsupported MCP protocol version.").into_response();
        }
        version.to_string()
    };
    let Some(id) = request.id.clone() else {
        if request.method.starts_with("notifications/") {
            return with_protocol_version(StatusCode::ACCEPTED.into_response(), &response_version);
        }
        return rpc_error(
            None,
            -32600,
            "Requests must include a string or numeric ID.",
        );
    };
    if !matches!(id, Value::String(_) | Value::Number(_)) {
        return rpc_error(
            request.id,
            -32600,
            "A string or numeric request ID is required.",
        );
    }

    match request.method.as_str() {
        "initialize" => {
            let protocol_version = if is_supported_protocol_version(&response_version) {
                response_version.as_str()
            } else {
                MCP_PROTOCOL_VERSION
            };
            with_protocol_version(
                Json(json!({
                    "jsonrpc": "2.0",
                    "id": id,
                    "result": {
                        "protocolVersion": protocol_version,
                        "capabilities": { "tools": { "listChanged": false } },
                        "serverInfo": {
                            "name": "nodus-flow",
                            "version": env!("CARGO_PKG_VERSION")
                        }
                    }
                }))
                .into_response(),
                protocol_version,
            )
        }
        "ping" => with_protocol_version(
            Json(json!({
                "jsonrpc": "2.0",
                "id": id,
                "result": {}
            }))
            .into_response(),
            &response_version,
        ),
        "tools/list" | "tools/call" => {
            let is_list = request.method == "tools/list";
            if !is_list {
                let Some(name) = request
                    .params
                    .get_mut("name")
                    .and_then(|value| value.as_str())
                else {
                    return rpc_error(request.id, -32602, "A tool name is required.");
                };
                let Some(internal_name) = mcp_tool_name_to_internal(name) else {
                    return rpc_error(request.id, -32602, "Unsupported Nodus MCP tool name.");
                };
                if let Some(params) = request.params.as_object_mut() {
                    params.insert("name".to_string(), Value::String(internal_name));
                }
            }
            match relay_tool_request(
                &state,
                client_id,
                client_name,
                request.method.clone(),
                request.params,
            )
            .await
            {
                Ok(mut result) => {
                    if is_list {
                        normalize_mcp_tool_names(&mut result);
                    }
                    with_protocol_version(
                        Json(json!({
                            "jsonrpc": "2.0",
                            "id": id,
                            "result": result
                        }))
                        .into_response(),
                        &response_version,
                    )
                }
                Err(error) => rpc_error(request.id, error.code, &error.message),
            }
        }
        _ => rpc_error(request.id, -32601, "Method not found."),
    }
}

fn is_supported_protocol_version(version: &str) -> bool {
    matches!(
        version,
        "2024-11-05" | "2025-03-26" | "2025-06-18" | "2025-11-25"
    )
}

fn with_protocol_version(mut response: Response, version: &str) -> Response {
    if let Ok(value) = version.parse() {
        response.headers_mut().insert("mcp-protocol-version", value);
    }
    response
}

async fn handle_mcp_get(
    State(state): State<AiBridgeState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
) -> Response {
    if let Err(response) = authenticate(&state, peer, &headers) {
        return response;
    }
    (StatusCode::METHOD_NOT_ALLOWED, [("allow", "POST")]).into_response()
}

fn authenticate(
    state: &AiBridgeState,
    peer: SocketAddr,
    headers: &HeaderMap,
) -> Result<(String, String), Response> {
    if !peer.ip().is_loopback() {
        return Err((StatusCode::FORBIDDEN, "Loopback connections only.").into_response());
    }
    if headers.contains_key(header::ORIGIN) {
        return Err((
            StatusCode::FORBIDDEN,
            "Browser-origin requests are not accepted.",
        )
            .into_response());
    }
    let host = headers
        .get(header::HOST)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default();
    if host != format!("127.0.0.1:{BRIDGE_PORT}") && host != format!("localhost:{BRIDGE_PORT}") {
        return Err((StatusCode::FORBIDDEN, "Invalid local bridge host.").into_response());
    }
    let Some(token) = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
    else {
        return Err((
            StatusCode::UNAUTHORIZED,
            "A paired client token is required.",
        )
            .into_response());
    };
    let token_hash = Sha256::digest(token.as_bytes());
    let clients = state
        .clients
        .lock()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response())?;
    clients
        .iter()
        .find_map(|(id, client)| {
            let Ok(saved_hash) = hex::decode(&client.token_hash) else {
                return None;
            };
            if bool::from(token_hash.as_slice().ct_eq(saved_hash.as_slice())) {
                Some((id.clone(), client.name.clone()))
            } else {
                None
            }
        })
        .ok_or_else(|| (StatusCode::UNAUTHORIZED, "Invalid client token.").into_response())
}

struct BridgeError {
    code: i32,
    message: String,
}

async fn relay_tool_request(
    state: &AiBridgeState,
    client_id: String,
    client_name: String,
    method: String,
    params: Value,
) -> Result<Value, BridgeError> {
    let permit = state
        .permits
        .clone()
        .try_acquire_owned()
        .map_err(|_| BridgeError {
            code: -32000,
            message: "Too many pending tool calls.".to_string(),
        })?;
    let request_id = Uuid::new_v4().to_string();
    let event = ToolRequestEvent {
        request_id: request_id.clone(),
        client_id,
        client_name,
        method,
        params,
    };
    let (sender, receiver) = oneshot::channel();
    state
        .pending
        .lock()
        .map_err(|_| BridgeError {
            code: -32603,
            message: "AI bridge request state is unavailable.".to_string(),
        })?
        .insert(request_id.clone(), sender);
    if state.app.emit("nodus-ai-bridge-request", event).is_err() {
        if let Ok(mut pending) = state.pending.lock() {
            pending.remove(&request_id);
        }
        return Err(BridgeError {
            code: -32603,
            message: "Could not dispatch the request to Nodus.".to_string(),
        });
    }

    let result = tokio::time::timeout(CALL_TIMEOUT, receiver).await;
    drop(permit);
    match result {
        Ok(Ok(result)) => Ok(result),
        Ok(Err(_)) => Err(BridgeError {
            code: -32603,
            message: "The Nodus window closed the request.".to_string(),
        }),
        Err(_) => {
            if let Ok(mut pending) = state.pending.lock() {
                pending.remove(&request_id);
            }
            Err(BridgeError {
                code: -32001,
                message: "The tool call timed out.".to_string(),
            })
        }
    }
}

fn mcp_tool_name_to_internal(name: &str) -> Option<String> {
    name.strip_prefix("nodus_")
        .map(|suffix| format!("nodus.{suffix}"))
        .filter(|internal| {
            internal[6..].chars().all(|character| {
                character.is_ascii_alphanumeric() || character == '_' || character == '-'
            })
        })
}

fn normalize_mcp_tool_names(result: &mut Value) {
    if let Some(tools) = result.get_mut("tools").and_then(Value::as_array_mut) {
        for tool in tools {
            if let Some(name) = tool
                .get_mut("name")
                .and_then(|value| value.as_str())
                .map(str::to_string)
            {
                if let Some(suffix) = name.strip_prefix("nodus.") {
                    if let Some(name_value) = tool.get_mut("name") {
                        *name_value = Value::String(format!("nodus_{suffix}"));
                    }
                }
            }
        }
    }
}

fn rpc_error(id: Option<Value>, code: i32, message: &str) -> Response {
    Json(json!({
        "jsonrpc": "2.0",
        "id": id,
        "error": { "code": code, "message": message }
    }))
    .into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_server_entry() -> jsonc_parser::cst::CstInputValue {
        let args: jsonc_parser::cst::CstInputValue = vec![
            jsonc_parser::cst::CstInputValue::from("--mcp-stdio"),
            jsonc_parser::cst::CstInputValue::from("client-id"),
        ]
        .into();
        jsonc_parser::cst::CstInputValue::from(vec![
            ("command".to_string(), "C:/Nodus/Nodus Flow.exe".into()),
            ("args".to_string(), args),
        ])
    }

    #[test]
    fn config_updates_preserve_other_entries_and_comments() {
        let original = r#"{
  // Keep this unrelated server.
  "servers": {
    "other": { "type": "http", "url": "http://localhost:9000" }
  }
}"#;
        let updated = upsert_config_entry(original, "servers", test_server_entry()).unwrap();
        assert!(updated.contains("// Keep this unrelated server."));
        let parsed: Value =
            jsonc_parser::parse_to_serde_value(&updated, &jsonc_parser::ParseOptions::default())
                .unwrap()
                .unwrap();
        assert_eq!(parsed["servers"]["other"]["url"], "http://localhost:9000");
        assert_eq!(parsed["servers"]["nodus-flow"]["args"][0], "--mcp-stdio");

        let removed = remove_config_entry(&updated, "servers").unwrap();
        let parsed: Value =
            jsonc_parser::parse_to_serde_value(&removed, &jsonc_parser::ParseOptions::default())
                .unwrap()
                .unwrap();
        assert!(parsed["servers"].get("nodus-flow").is_none());
        assert_eq!(parsed["servers"]["other"]["url"], "http://localhost:9000");
    }

    #[test]
    fn invalid_config_shapes_are_not_overwritten() {
        assert!(upsert_config_entry(r#"{"servers": []}"#, "servers", test_server_entry()).is_err());
        assert!(upsert_config_entry(
            r#"{"servers": {"nodus-flow": {"command": "custom"}}}"#,
            "servers",
            test_server_entry()
        )
        .unwrap()
        .contains("Nodus Flow.exe"));
    }

    #[test]
    fn mcp_tool_names_are_translated_only_for_nodus() {
        assert_eq!(
            mcp_tool_name_to_internal("nodus_create_node"),
            Some("nodus.create_node".to_string())
        );
        assert_eq!(mcp_tool_name_to_internal("other_tool"), None);
        assert_eq!(mcp_tool_name_to_internal("nodus_bad.name"), None);
    }
}
