import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { McpServerConfig, McpServerStatus } from '../types/mcp';
import { invoke } from '@tauri-apps/api/core';

interface McpState {
    servers: McpServerConfig[];
    serverStatuses: Record<string, McpServerStatus>;

    addServer: (config: Omit<McpServerConfig, 'id' | 'enabled'>) => void;
    removeServer: (id: string) => void;
    updateServer: (id: string, config: Partial<McpServerConfig>) => void;
    toggleServer: (id: string) => void;

    connectServer: (id: string) => Promise<void>;
    connectAllEnabled: () => Promise<void>;
}

export const useMcpStore = create<McpState>()(
    persist(
        (set, get) => ({
            servers: [],
            serverStatuses: {},

            addServer: (config) => set((state) => ({
                servers: [...state.servers, { ...config, id: crypto.randomUUID(), enabled: true }]
            })),

            removeServer: (id) => set((state) => ({
                servers: state.servers.filter((s) => s.id !== id),
                serverStatuses: (() => {
                    const { [id]: _, ...rest } = state.serverStatuses;
                    return rest;
                })()
            })),

            updateServer: (id, config) => set((state) => ({
                servers: state.servers.map((s) => s.id === id ? { ...s, ...config } : s)
            })),

            toggleServer: (id) => set((state) => ({
                servers: state.servers.map((s) => s.id === id ? { ...s, enabled: !s.enabled } : s)
            })),

            connectServer: async (id) => {
                const server = get().servers.find((s) => s.id === id);
                if (!server) return;

                set((state) => ({
                    serverStatuses: { ...state.serverStatuses, [id]: { id, status: 'connecting' } }
                }));

                try {
                    if (server.type === 'sse') {
                        await invoke('connect_mcp_http', {
                            name: server.name,
                            url: server.url,
                            authToken: server.authToken
                        });
                    } else {
                        await invoke('connect_mcp_server', {
                            name: server.name,
                            command: server.command,
                            args: server.args
                        });
                    }

                    set((state) => ({
                        serverStatuses: { ...state.serverStatuses, [id]: { id, status: 'connected' } }
                    }));
                } catch (e) {
                    console.error("Failed to connect MCP server:", e);
                    set((state) => ({
                        serverStatuses: { ...state.serverStatuses, [id]: { id, status: 'error', error: String(e) } }
                    }));
                }
            },

            connectAllEnabled: async () => {
                const { servers, connectServer } = get();
                await Promise.all(servers.filter(s => s.enabled).map(s => connectServer(s.id)));
            }
        }),
        {
            name: 'mcp-storage',
            partialize: (state) => ({ servers: state.servers }),
        }
    )
);
