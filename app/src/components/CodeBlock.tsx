import { useState, useEffect } from 'react'
import { Check, Copy, Code, Eye, RefreshCw, Maximize2, X } from 'lucide-react'

interface CodeBlockProps {
    language: string
    code: string
    children?: React.ReactNode
}

export default function CodeBlock({ language, code, children }: CodeBlockProps) {
    const [copied, setCopied] = useState(false)
    const [activeTab, setActiveTab] = useState<'code' | 'preview'>('preview')
    const [key, setKey] = useState(0)
    const [debouncedCode, setDebouncedCode] = useState(code)
    const [isFullscreen, setIsFullscreen] = useState(false)

    // Debounce the code for the preview to prevent flashing on every token
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedCode(code)
        }, 1000)
        return () => clearTimeout(timer)
    }, [code])

    // Only HTML and SVG are previewable
    const isPreviewable = ['html', 'svg', 'xml'].includes(language?.toLowerCase())

    // If not previewable, force code tab
    useEffect(() => {
        if (!isPreviewable) {
            setActiveTab('code')
        }
    }, [isPreviewable])

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(code)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch { /* noop */ }
    }

    const refreshPreview = () => {
        setKey(prev => prev + 1)
    }

    return (
        <>
            {/* Fullscreen Modal */}
            {isFullscreen && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full h-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
                        <div className="px-4 py-3 bg-gray-100 border-b border-gray-200 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Eye size={16} className="text-gray-500" />
                                <span className="font-medium text-gray-900">Preview - {language}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={refreshPreview}
                                    className="p-2 rounded-lg hover:bg-gray-200 transition-colors text-gray-600"
                                    title="Refresh"
                                >
                                    <RefreshCw size={16} />
                                </button>
                                <button
                                    onClick={() => setIsFullscreen(false)}
                                    className="p-2 rounded-lg hover:bg-red-100 transition-colors text-gray-600 hover:text-red-600"
                                    title="Close"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto">
                            <iframe
                                key={key}
                                srcDoc={debouncedCode}
                                className="w-full h-full border-0"
                                sandbox="allow-scripts allow-modals"
                                title="Preview Fullscreen"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Inline Code Block */}
            <div className="my-4 rounded-lg border border-gray-200 shadow-sm bg-[#0a0a0a]" style={{ contain: 'inline-size', overflow: 'hidden' }}>
                {/* Header / Tabs */}
                <div className="px-3 py-2 text-xs text-gray-300 bg-[#111] border-b border-gray-800 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="flex gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]"></span>
                                <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]"></span>
                                <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]"></span>
                            </div>
                            <span className="ml-3 font-mono text-gray-400">{language || 'text'}</span>
                        </div>

                        {isPreviewable && (
                            <div className="flex bg-[#222] rounded-lg p-0.5">
                                <button
                                    onClick={() => setActiveTab('preview')}
                                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${activeTab === 'preview'
                                        ? 'bg-[#333] text-white shadow-sm'
                                        : 'text-gray-400 hover:text-gray-200'
                                        }`}
                                >
                                    <Eye size={12} />
                                    <span>Preview</span>
                                </button>
                                <button
                                    onClick={() => setActiveTab('code')}
                                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${activeTab === 'code'
                                        ? 'bg-[#333] text-white shadow-sm'
                                        : 'text-gray-400 hover:text-gray-200'
                                        }`}
                                >
                                    <Code size={12} />
                                    <span>Code</span>
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {isPreviewable && activeTab === 'preview' && (
                            <>
                                <button
                                    onClick={() => setIsFullscreen(true)}
                                    className="p-1.5 rounded hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
                                    title="Fullscreen Preview"
                                >
                                    <Maximize2 size={14} />
                                </button>
                                <button
                                    onClick={refreshPreview}
                                    className="p-1.5 rounded hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
                                    title="Restart Preview"
                                >
                                    <RefreshCw size={14} />
                                </button>
                            </>
                        )}
                        <button
                            onClick={copyToClipboard}
                            className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
                        >
                            {copied ? (
                                <>
                                    <Check size={12} className="text-green-400" />
                                    <span className="text-xs text-green-400">Copied</span>
                                </>
                            ) : (
                                <>
                                    <Copy size={12} />
                                    <span className="text-xs">Copy</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Content - Force clipped width */}
                <div style={{ overflow: 'hidden', width: '100%' }}>
                    {activeTab === 'code' ? (
                        <pre className="overflow-x-auto p-4 text-sm leading-6 text-gray-300 font-mono bg-[#0a0a0a] scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
                            <code>{children || code}</code>
                        </pre>
                    ) : (
                        <div
                            className="h-64 bg-white"
                            style={{ width: '0', minWidth: '100%', overflow: 'hidden' }}
                        >
                            <iframe
                                key={key}
                                srcDoc={debouncedCode}
                                className="h-full border-0"
                                style={{ width: '100%', display: 'block' }}
                                sandbox="allow-scripts allow-modals"
                                title="Preview"
                            />
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}
