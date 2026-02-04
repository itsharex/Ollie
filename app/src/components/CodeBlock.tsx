import { useState, useEffect } from 'react'
import { Check, Copy, Code, Eye, RefreshCw } from 'lucide-react'

interface CodeBlockProps {
    language: string
    code: string
    children?: React.ReactNode
}

export default function CodeBlock({ language, code, children }: CodeBlockProps) {
    const [copied, setCopied] = useState(false)
    const [activeTab, setActiveTab] = useState<'code' | 'preview'>('preview') // Default to preview for HTML/SVG
    const [key, setKey] = useState(0) // To force iframe refresh
    const [debouncedCode, setDebouncedCode] = useState(code)

    // Debounce the code for the preview to prevent flashing on every token
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedCode(code)
        }, 1000) // 1s delay for preview updates
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
        <div className="my-4 overflow-hidden rounded-lg border border-gray-200 shadow-sm bg-[#0a0a0a]">
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
                        <button
                            onClick={refreshPreview}
                            className="p-1.5 rounded hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
                            title="Restart Preview"
                        >
                            <RefreshCw size={14} />
                        </button>
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

            {/* Content */}
            <div className="relative">
                {activeTab === 'code' ? (
                    <pre className="overflow-x-auto p-4 text-sm leading-6 text-gray-300 font-mono bg-[#0a0a0a] scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
                        <code>{children || code}</code>
                    </pre>
                ) : (
                    <div className="w-full h-96 bg-white resize-y overflow-auto min-h-[200px]">
                        <iframe
                            key={key}
                            srcDoc={debouncedCode}
                            className="w-full h-full border-0"
                            sandbox="allow-scripts allow-modals" // Secure sandbox
                            title="Preview"
                        />
                    </div>
                )}
            </div>
        </div>
    )
}
