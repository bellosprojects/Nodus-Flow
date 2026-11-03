use reqwest::blocking::Client;
use serde_json::{json, Value};
use std::{
    io::{self, BufRead, Write},
    time::Duration,
};

const BRIDGE_URL: &str = "http://127.0.0.1:47831/v1/rpc";
const MCP_PROTOCOL_VERSION: &str = "2025-11-25";

pub fn run(client_id: &str) -> i32 {
    let token = match super::ai_bridge::load_ai_bridge_token(client_id) {
        Ok(token) => token,
        Err(error) => {
            eprintln!("Nodus MCP credential error: {error}");
            return 1;
        }
    };
    let client = match Client::builder().timeout(Duration::from_secs(125)).build() {
        Ok(client) => client,
        Err(error) => {
            eprintln!("Could not initialize the Nodus MCP adapter: {error}");
            return 1;
        }
    };

    let stdin = io::stdin();
    let mut stdout = io::stdout().lock();
    for line in stdin.lock().lines() {
        let line = match line {
            Ok(line) if line.trim().is_empty() => continue,
            Ok(line) => line,
            Err(error) => {
                eprintln!("Could not read the MCP client stream: {error}");
                return 1;
            }
        };
        let response = match serde_json::from_str::<Value>(&line) {
            Ok(message) => process_message(&client, &token, message),
            Err(error) => Some(json!({
                "jsonrpc": "2.0",
                "id": null,
                "error": { "code": -32700, "message": format!("Invalid JSON: {error}") }
            })),
        };
        if let Some(response) = response {
            if serde_json::to_writer(&mut stdout, &response).is_err()
                || stdout.write_all(b"\n").is_err()
                || stdout.flush().is_err()
            {
                eprintln!("Could not write the MCP response to the client.");
                return 1;
            }
        }
    }
    0
}

fn process_message(client: &Client, token: &str, message: Value) -> Option<Value> {
    let id = message.get("id").cloned();
    let Some(method) = message.get("method").and_then(Value::as_str) else {
        return id.map(|id| rpc_error(id, -32600, "A JSON-RPC method is required."));
    };
    let Some(id) = id else {
        return None;
    };
    if !matches!(id, Value::String(_) | Value::Number(_)) {
        return Some(rpc_error(
            id,
            -32600,
            "A string or numeric request ID is required.",
        ));
    }
    if message.get("jsonrpc").and_then(Value::as_str) != Some("2.0") {
        return Some(rpc_error(id, -32600, "Invalid JSON-RPC version."));
    }
    let params = message.get("params").cloned().unwrap_or_else(|| json!({}));

    let result = match method {
        "initialize" => {
            let requested = params
                .get("protocolVersion")
                .and_then(Value::as_str)
                .unwrap_or(MCP_PROTOCOL_VERSION);
            let version = if matches!(
                requested,
                "2024-11-05" | "2025-03-26" | "2025-06-18" | "2025-11-25"
            ) {
                requested
            } else {
                MCP_PROTOCOL_VERSION
            };
            Ok(json!({
                "protocolVersion": version,
                "capabilities": { "tools": { "listChanged": false } },
                "serverInfo": {
                    "name": "nodus-flow",
                    "version": env!("CARGO_PKG_VERSION")
                }
            }))
        }
        "ping" => Ok(json!({})),
        "tools/list" => call_bridge(client, token, "tools/list", json!({})).map(|mut result| {
            normalize_tool_names(&mut result);
            result
        }),
        "tools/call" => {
            let Some(name) = params.get("name").and_then(Value::as_str) else {
                return Some(rpc_error(id, -32602, "A tool name is required."));
            };
            let Some(internal_name) = internal_tool_name(name) else {
                return Some(rpc_error(id, -32602, "Unsupported Nodus MCP tool name."));
            };
            let mut bridge_params = params;
            if let Some(object) = bridge_params.as_object_mut() {
                object.insert("name".to_string(), Value::String(internal_name));
            }
            call_bridge(client, token, "tools/call", bridge_params)
        }
        _ if method.starts_with("notifications/") => return None,
        _ => return Some(rpc_error(id, -32601, "Method not found.")),
    };

    Some(match result {
        Ok(result) => json!({
            "jsonrpc": "2.0",
            "id": id,
            "result": result
        }),
        Err(message) => rpc_error(id, -32603, &message),
    })
}

fn call_bridge(client: &Client, token: &str, method: &str, params: Value) -> Result<Value, String> {
    let response = client
        .post(BRIDGE_URL)
        .bearer_auth(token)
        .json(&json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
            "params": params
        }))
        .send()
        .map_err(|error| format!("Could not reach the running Nodus app: {error}"))?;
    let status = response.status();
    let body = response
        .text()
        .map_err(|error| format!("Could not read the Nodus response: {error}"))?;
    if !status.is_success() {
        return Err(format!("Nodus returned HTTP {status}: {body}"));
    }
    let response: Value = serde_json::from_str(&body)
        .map_err(|error| format!("Nodus returned invalid JSON: {error}"))?;
    if let Some(error) = response.get("error") {
        return Err(error
            .get("message")
            .and_then(Value::as_str)
            .unwrap_or("Nodus tool request failed.")
            .to_string());
    }
    response
        .get("result")
        .cloned()
        .ok_or_else(|| "Nodus response did not contain a result.".to_string())
}

fn internal_tool_name(name: &str) -> Option<String> {
    name.strip_prefix("nodus_")
        .map(|suffix| format!("nodus.{suffix}"))
        .filter(|internal| {
            internal[6..].chars().all(|character| {
                character.is_ascii_alphanumeric() || character == '_' || character == '-'
            })
        })
}

fn normalize_tool_names(result: &mut Value) {
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

fn rpc_error(id: Value, code: i32, message: &str) -> Value {
    json!({
        "jsonrpc": "2.0",
        "id": id,
        "error": { "code": code, "message": message }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stdio_adapter_maps_nodus_tool_names() {
        assert_eq!(
            internal_tool_name("nodus_create_node"),
            Some("nodus.create_node".to_string())
        );
        assert_eq!(internal_tool_name("other_tool"), None);
        assert_eq!(internal_tool_name("nodus_bad.name"), None);
    }

    #[test]
    fn stdio_adapter_initializes_and_ignores_notifications() {
        let client = Client::new();
        let initialized = process_message(
            &client,
            "",
            json!({
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": { "protocolVersion": "2025-11-25" }
            }),
        )
        .unwrap();
        assert_eq!(initialized["result"]["protocolVersion"], "2025-11-25");
        assert_eq!(
            process_message(
                &client,
                "",
                json!({
                    "jsonrpc": "2.0",
                    "method": "notifications/initialized"
                })
            ),
            None
        );
    }
}
