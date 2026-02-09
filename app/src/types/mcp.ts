export interface McpServerConfig {
    id: string;
    type: 'stdio' | 'sse';
    name: string;

    // Stdio
    command?: string;
    args?: string[];

    // SSE
    url?: string;
    authToken?: string;

    enabled: boolean;
}

export type McpConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface McpServerStatus {
    id: string;
    status: McpConnectionStatus;
    error?: string;
}
