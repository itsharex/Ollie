import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Wrench, RefreshCw, AlertCircle } from 'lucide-react'

interface ToolInfo {
    server: string
    name: string
    description?: string
    schema: any
}

export default function McpToolList() {
    const [tools, setTools] = useState<ToolInfo[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchTools = async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await invoke<ToolInfo[]>('list_tools')
            setTools(res)
        } catch (e: any) {
            console.error('Failed to list tools', e)
            setError(e.toString())
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchTools()
        // Refresh when servers change (listen to event? or just poll/manual refresh)
        // For now manual refresh is fine or triggering from parent
    }, [])

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Wrench size={16} className="text-blue-500" />
                    Available Tools
                </h3>
                <button
                    onClick={fetchTools}
                    disabled={loading}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                    title="Refresh Tools"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {error && (
                <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg flex items-center gap-2">
                    <AlertCircle size={14} />
                    {error}
                </div>
            )}

            {!loading && tools.length === 0 && (
                <div className="text-center py-6 text-gray-400 text-xs italic">
                    No tools available. Connect an MCP server to see tools here.
                </div>
            )}

            <div className="grid grid-cols-1 gap-2">
                {tools.map((t, i) => (
                    <div key={`${t.server}-${t.name}-${i}`} className="bg-white border border-gray-100 rounded-lg p-3 hover:shadow-sm transition-shadow">
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-900">{t.name}</span>
                                <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                                    {t.server}
                                </span>
                            </div>
                        </div>
                        {t.description && (
                            <p className="text-xs text-gray-500 line-clamp-2">{t.description}</p>
                        )}
                        <div className="mt-2 text-[10px] text-gray-400 font-mono">
                            {/* Minimal schema hint */}
                            ARGS: {Object.keys(t.schema?.properties || {}).join(', ')}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
