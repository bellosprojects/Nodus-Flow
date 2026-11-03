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
use tauri::{
    async_runtime::JoinHandle, AppHandle, Emitter, Manager, State as TauriState,
};
use tokio::{
    net::TcpListener,
    sync::{oneshot, Semaphore},
};
use uuid::Uuid;

const BRIDGE_PORT: u16 = 47831;
const MAX_PENDING_CALLS: usize = 8;
const CALL_TIMEOUT: Duration = Duration::from_secs(120);

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
pub fn get_ai_bridge_status(
    state: TauriState<'_, AiBridgeState>,
) -> Result<BridgeStatus, String> {
    let enabled = state
        .server
        .lock()
        .map_err(|_| "AI bridge state is unavailable.".to_string())?
        .is_some();
    Ok(BridgeStatus {
        enabled,
        endpoint: format!("http://127.0.0.1:{BRIDGE_PORT}/v1/rpc"),
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
                endpoint: format!("http://127.0.0.1:{BRIDGE_PORT}/v1/rpc"),
            });
        }
    }

    let address = SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), BRIDGE_PORT);
    let listener = TcpListener::bind(address)
        .await
        .map_err(|error| format!("Could not start the local AI bridge: {error}"))?;
    let router = Router::new()
        .route("/v1/rpc", post(handle_rpc))
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
        endpoint: format!("http://127.0.0.1:{BRIDGE_PORT}/v1/rpc"),
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
        endpoint: format!("http://127.0.0.1:{BRIDGE_PORT}/v1/rpc"),
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

    let mut clients = state
        .clients
        .lock()
        .map_err(|_| "AI bridge client state is unavailable.".to_string())?;
    let mut next = clients.clone();
    next.insert(id.clone(), client);
    state.persist_clients(&next)?;
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
    Ok(())
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
    if !peer.ip().is_loopback() {
        return (StatusCode::FORBIDDEN, "Loopback connections only.").into_response();
    }
    if headers.contains_key(header::ORIGIN) {
        return (StatusCode::FORBIDDEN, "Browser-origin requests are not accepted.").into_response();
    }
    let host = headers
        .get(header::HOST)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default();
    if host != format!("127.0.0.1:{BRIDGE_PORT}") && host != format!("localhost:{BRIDGE_PORT}") {
        return (StatusCode::FORBIDDEN, "Invalid local bridge host.").into_response();
    }
    let content_type = headers
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default();
    if !content_type.starts_with("application/json") {
        return (StatusCode::UNSUPPORTED_MEDIA_TYPE, "JSON content type required.").into_response();
    }

    let Some(token) = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
    else {
        return (StatusCode::UNAUTHORIZED, "A paired client token is required.").into_response();
    };
    let token_hash = Sha256::digest(token.as_bytes());
    let client = {
        let clients = match state.clients.lock() {
            Ok(clients) => clients,
            Err(_) => return StatusCode::INTERNAL_SERVER_ERROR.into_response(),
        };
        clients.iter().find_map(|(id, client)| {
            let Ok(saved_hash) = hex::decode(&client.token_hash) else {
                return None;
            };
            if bool::from(token_hash.as_slice().ct_eq(saved_hash.as_slice())) {
                Some((id.clone(), client.name.clone()))
            } else {
                None
            }
        })
    };
    let Some((client_id, client_name)) = client else {
        return (StatusCode::UNAUTHORIZED, "Invalid client token.").into_response();
    };

    if request.jsonrpc != "2.0" {
        return rpc_error(request.id, -32600, "Invalid JSON-RPC version.");
    }
    if !matches!(&request.id, Some(Value::String(_) | Value::Number(_))) {
        return rpc_error(request.id, -32600, "A string or numeric request ID is required.");
    }
    if request.method != "tools/list" && request.method != "tools/call" {
        return rpc_error(request.id, -32601, "Method not found.");
    }
    let permit = match state.permits.clone().try_acquire_owned() {
        Ok(permit) => permit,
        Err(_) => return rpc_error(request.id, -32000, "Too many pending tool calls."),
    };

    let request_id = Uuid::new_v4().to_string();
    let event = ToolRequestEvent {
        request_id: request_id.clone(),
        client_id,
        client_name,
        method: request.method,
        params: request.params,
    };
    let (sender, receiver) = oneshot::channel();
    match state.pending.lock() {
        Ok(mut pending) => {
            pending.insert(request_id.clone(), sender);
        }
        Err(_) => return StatusCode::INTERNAL_SERVER_ERROR.into_response(),
    }
    if state.app.emit("nodus-ai-bridge-request", event).is_err() {
        if let Ok(mut pending) = state.pending.lock() {
            pending.remove(&request_id);
        }
        return rpc_error(request.id, -32603, "Could not dispatch the request to Nodus.");
    }

    let result = tokio::time::timeout(CALL_TIMEOUT, receiver).await;
    drop(permit);
    match result {
        Ok(Ok(result)) => Json(json!({
            "jsonrpc": "2.0",
            "id": request.id,
            "result": result
        }))
        .into_response(),
        Ok(Err(_)) => rpc_error(request.id, -32603, "The Nodus window closed the request."),
        Err(_) => {
            if let Ok(mut pending) = state.pending.lock() {
                pending.remove(&request_id);
            }
            rpc_error(request.id, -32001, "The tool call timed out.")
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
