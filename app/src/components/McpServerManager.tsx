import { useState } from 'react';
import { useMcpStore } from '../store/mcpStore';
import { Plus, Trash2, Power, Plug, AlertCircle, RefreshCw, Terminal, Globe } from 'lucide-react';
import McpToolList from './McpToolList';


export default function McpServerManager() {
    const { servers, serverStatuses, addServer, removeServer, connectServer } = useMcpStore();
    const [showAddForm, setShowAddForm] = useState(false);

    // Form State
    const [serverType, setServerType] = useState<'stdio' | 'sse'>('stdio');
    const [name, setName] = useState('');

    // Stdio Fields
    const [command, setCommand] = useState('');
    const [argsInput, setArgsInput] = useState('');

    // SSE Fields
    const [url, setUrl] = useState('');
    const [authToken, setAuthToken] = useState('');

    const handleAdd = () => {
        if (!name) return;

        if (serverType === 'stdio') {
            if (!command) return;
            const argsArray = argsInput.split(' ').filter(a => a.trim().length > 0);
            addServer({
                type: 'stdio',
                name,
                command,
                args: argsArray,
            });
        } else {
            if (!url) return;
            addServer({
                type: 'sse',
                name,
                url,
                authToken: authToken || undefined,
            });
        }

        // Reset
        setName('');
        setCommand('');
        setArgsInput('');
        setUrl('');
        setAuthToken('');
        setShowAddForm(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">MCP Servers</h2>
                <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
                >
                    <Plus size={16} />
                    Add Server
                </button>
            </div>

            {showAddForm && (
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-4">
                    {/* Type Toggle */}
                    <div className="flex p-1 bg-gray-200 rounded-lg w-max">
                        <button
                            onClick={() => setServerType('stdio')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${serverType === 'stdio' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            <Terminal size={14} />
                            Stdio (Local)
                        </button>
                        <button
                            onClick={() => setServerType('sse')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${serverType === 'sse' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            <Globe size={14} />
                            HTTP / SSE (Remote)
                        </button>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                placeholder="My Server"
                            />
                        </div>

                        {serverType === 'stdio' ? (
                            <>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Command</label>
                                    <input
                                        type="text"
                                        value={command}
                                        onChange={e => setCommand(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                        placeholder="npx, python, etc."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Arguments</label>
                                    <input
                                        type="text"
                                        value={argsInput}
                                        onChange={e => setArgsInput(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                        placeholder="-y @modelcontextprotocol/server-filesystem ..."
                                    />
                                </div>
                            </>
                        ) : (
                            <>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Server URL (SSE Endpoint)</label>
                                    <input
                                        type="text"
                                        value={url}
                                        onChange={e => setUrl(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                        placeholder="http://localhost:8000/sse"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Auth Token (Optional)</label>
                                    <input
                                        type="password"
                                        value={authToken}
                                        onChange={e => setAuthToken(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                        placeholder="Bearer Token"
                                    />
                                </div>
                            </>
                        )}
                    </div>

                    <div className="flex justify-end gap-2">
                        <button
                            onClick={() => setShowAddForm(false)}
                            className="px-3 py-1.5 text-gray-600 hover:bg-gray-200 rounded-lg text-sm transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleAdd}
                            disabled={!name || (serverType === 'stdio' ? !command : !url)}
                            className="px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                        >
                            Save Server
                        </button>
                    </div>
                </div>
            )}

            <div className="space-y-3">
                {servers.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200 flex flex-col items-center justify-center">
                        <Plug size={24} className="mx-auto mb-2 text-gray-400" />
                        <p className="text-sm">No MCP servers configured</p>
                    </div>
                ) : (
                    servers.map(server => {
                        const status = serverStatuses[server.id];
                        const isConnected = status?.status === 'connected';
                        const isConnecting = status?.status === 'connecting';
                        const isError = status?.status === 'error';

                        return (
                            <div key={server.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-center gap-4">
                                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : isError ? 'bg-red-500' : isConnecting ? 'bg-yellow-500' : 'bg-gray-300'}`} />
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-medium text-gray-900">{server.name}</h3>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 uppercase font-bold tracking-wider">
                                                {server.type || 'stdio'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 font-mono mt-0.5 break-all">
                                            {server.type === 'sse' ? server.url : `${server.command} ${server.args?.join(' ')}`}
                                        </p>
                                        {isError && (
                                            <div className="flex items-center gap-1 text-red-500 text-xs mt-1">
                                                <AlertCircle size={12} />
                                                <span>{status?.error}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => connectServer(server.id)}
                                        disabled={isConnecting || isConnected}
                                        className={`p-2 rounded-lg transition-colors flex items-center justify-center ${isConnected
                                            ? 'text-green-600 bg-green-50 cursor-default'
                                            : isConnecting
                                                ? 'text-yellow-600 bg-yellow-50 cursor-wait'
                                                : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'
                                            }`}
                                        title={isConnected ? "Connected" : "Connect"}
                                    >
                                        {isConnecting ? <RefreshCw size={18} className="animate-spin" /> : <Power size={18} />}
                                    </button>

                                    <button
                                        onClick={() => {
                                            if (confirm('Are you sure you want to remove this server?')) {
                                                removeServer(server.id);
                                            }
                                        }}
                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center"
                                        title="Remove Server"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Tools List */}
            <div className="pt-6 border-t border-gray-100">
                <McpToolList />
            </div>
        </div>
    );
}
