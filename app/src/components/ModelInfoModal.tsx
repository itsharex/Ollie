import { X, FileText, Cpu, Ruler, Box, ChevronDown, ChevronRight, Hash } from 'lucide-react'
import { useState } from 'react'
import type { ModelInfo } from '../store/modelsStore'

interface ModelInfoModalProps {
    modelName: string
    info: ModelInfo | null
    onClose: () => void
}

export default function ModelInfoModal({ modelName, info, onClose }: ModelInfoModalProps) {
    const [showLicense, setShowLicense] = useState(false)
    const [showModelfile, setShowModelfile] = useState(false)

    if (!info) return null

    // Parse Modelfile for key fields
    const parseModelfile = (modelfile: string) => {
        const lines = modelfile.split('\n')
        const config: Record<string, string> = {}
        let currentKey = ''

        lines.forEach(line => {
            const match = line.match(/^([A-Z]+)\s+(.+)$/)
            if (match) {
                currentKey = match[1]
                config[currentKey] = match[2]
            }
        })

        return config
    }

    const modelfileData = info.modelfile ? parseModelfile(info.modelfile) : {}
    const parameters = info.parameters?.split('\n').filter(p => p.trim()) || []

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-gray-900 rounded-xl">
                            <Box className="text-white" size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">{modelName}</h2>
                            <p className="text-sm text-gray-500 font-mono">{info.details?.family || 'Unknown family'}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-900 transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">

                    {/* Key Stats Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                            <div className="flex items-center gap-2 mb-1 text-blue-700 font-medium">
                                <Ruler size={16} />
                                <span className="text-xs">Parameter Size</span>
                            </div>
                            <div className="text-lg font-bold text-blue-900">{info.details?.parameter_size || 'N/A'}</div>
                        </div>

                        <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl">
                            <div className="flex items-center gap-2 mb-1 text-purple-700 font-medium">
                                <Hash size={16} />
                                <span className="text-xs">Quantization</span>
                            </div>
                            <div className="text-lg font-bold text-purple-900">{info.details?.quantization_level || 'N/A'}</div>
                        </div>

                        <div className="p-4 bg-green-50 border border-green-100 rounded-xl">
                            <div className="flex items-center gap-2 mb-1 text-green-700 font-medium">
                                <FileText size={16} />
                                <span className="text-xs">Format</span>
                            </div>
                            <div className="text-lg font-bold text-green-900">{info.details?.format || 'N/A'}</div>
                        </div>

                        {/* Fallback for family if needed, or just generic info */}
                        <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl">
                            <div className="flex items-center gap-2 mb-1 text-gray-700 font-medium">
                                <Cpu size={16} />
                                <span className="text-xs">Architecture</span>
                            </div>
                            <div className="text-lg font-bold text-gray-900 truncate">{info.details?.family || 'N/A'}</div>
                        </div>
                    </div>

                    {/* System Prompt Section */}
                    {modelfileData['SYSTEM'] && (
                        <div>
                            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <FileText size={16} />
                                System Prompt
                            </h3>
                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-700 font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                                {modelfileData['SYSTEM']}
                            </div>
                        </div>
                    )}

                    {/* Config Parameters */}
                    {(modelfileData['TEMPLATE'] || parameters.length > 0) && (
                        <div>
                            <button
                                onClick={() => setShowModelfile(!showModelfile)}
                                className="flex items-center gap-2 w-full text-left text-sm font-semibold text-gray-900 uppercase tracking-wider mb-2 hover:text-blue-600 transition-colors"
                            >
                                {showModelfile ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                Template & Parameters
                            </button>

                            {showModelfile && (
                                <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
                                    {modelfileData['TEMPLATE'] && (
                                        <div className="bg-gray-900 rounded-xl p-4 overflow-x-auto">
                                            <div className="text-xs text-gray-400 mb-2 uppercase">Chat Template</div>
                                            <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">{modelfileData['TEMPLATE']}</pre>
                                        </div>
                                    )}

                                    {parameters.length > 0 && (
                                        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-50 text-left text-gray-500 font-medium">
                                                    <tr>
                                                        <th className="p-3 border-b border-gray-100">Parameter</th>
                                                        <th className="p-3 border-b border-gray-100">Value</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {parameters.map((p, i) => {
                                                        // parameter stop "..."
                                                        const [key, ...vals] = p.split(' ')
                                                        return (
                                                            <tr key={i} className="hover:bg-gray-50/50">
                                                                <td className="p-3 font-mono text-gray-600">{key}</td>
                                                                <td className="p-3 font-mono text-gray-900">{vals.join(' ')}</td>
                                                            </tr>
                                                        )
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* License Section */}
                    {info.license && (
                        <div>
                            <button
                                onClick={() => setShowLicense(!showLicense)}
                                className="flex items-center gap-2 w-full text-left text-sm font-semibold text-gray-900 uppercase tracking-wider mb-2 hover:text-blue-600 transition-colors"
                            >
                                {showLicense ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                License
                            </button>
                            {showLicense && (
                                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-600 font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto animate-in slide-in-from-top-2 duration-200">
                                    {info.license}
                                </div>
                            )}
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors shadow-sm font-medium"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}
