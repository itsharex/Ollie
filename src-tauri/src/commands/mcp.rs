use crate::mcp::McpClient;

#[tauri::command]
pub async fn connect_mcp_server(name: String, command: String, args: Vec<String>) -> Result<(), String> {
    match McpClient::connect(&name, &command, &args).await {
        Ok(_) => {
            println!("Connected to MCP server: {}", name);
            Ok(())
        },
        Err(e) => Err(format!("Failed to connect to MCP server {}: {}", name, e)),
    }
}

#[tauri::command]
pub async fn connect_mcp_http(name: String, url: String, auth_token: Option<String>) -> Result<String, String> {
    match McpClient::connect_http(&name, &url, auth_token).await {
        Ok(_) => Ok(format!("Connected to {}", name)),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn list_mcp_servers() -> Vec<String> {
    McpClient::list_active_clients()
}

#[derive(serde::Serialize)]
pub struct ToolInfo {
    pub server: String,
    pub name: String,
    pub description: Option<String>,
    pub schema: serde_json::Value,
}

#[tauri::command]
pub async fn list_tools() -> Result<Vec<ToolInfo>, String> {
    let clients = McpClient::list_active_clients();
    let mut all_tools = Vec::new();

    for name in clients {
        if let Some(client) = McpClient::get_client(&name) {
            match client.list_tools().await {
                Ok(tools) => {
                    for tool in tools {
                         all_tools.push(ToolInfo {
                             server: name.clone(),
                             name: tool.name,
                             description: tool.description,
                             schema: tool.input_schema,
                         });
                    }
                }
                Err(e) => {
                    // Log error but continue
                    eprintln!("Failed to list tools for {}: {}", name, e);
                }
            }
        }
    }
    Ok(all_tools)
}
