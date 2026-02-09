import { Square, Settings2, AlertCircle, Cloud, Zap } from 'lucide-react'
import { useState } from 'react'
import ModelSelector from './ModelSelector'
import ParametersPanel from './ParametersPanel'
import { useOllamaHealth } from '../lib/hooks'
import { useSettingsStore } from '../store/settingsStore'
import { useChatStore } from '../store/chatStore'

export default function TopBar() {
  const { serverUrl, serverPort, appMode, providers, activeProviderId } = useSettingsStore()
  const { isStreaming, stopStreaming } = useChatStore()
  const [parametersOpen, setParametersOpen] = useState(false)

  // Get active provider info
  const activeProvider = providers.find(p => p.id === activeProviderId)
  const providerType = activeProvider?.provider_type || 'ollama'
  const isCloudMode = appMode === 'cloud' && providerType !== 'ollama'

  // Only check Ollama health in local mode
  const fullServerUrl = `${serverUrl}:${serverPort}`
  const { health, isLoading } = useOllamaHealth(isCloudMode ? '' : fullServerUrl)

  return (
    <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 shadow-sm">
      {/* Left Side - Model Selector */}
      <div className="flex items-center gap-4">
        <ModelSelector />

        {/* Parameters Button */}
        <button
          onClick={() => setParametersOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-all duration-200 border border-transparent hover:border-gray-200"
        >
          <Settings2 size={18} />
          <span className="text-sm font-medium">Parameters</span>
        </button>
      </div>

      {/* Center - Connection Status */}
      <div className="flex items-center gap-4">
        {isCloudMode ? (
          /* Cloud Mode Status */
          <div className="flex items-center gap-3 px-4 py-2 bg-purple-50 rounded-xl">
            <Cloud size={16} className="text-purple-600" />
            <span className="text-sm font-medium text-purple-700">
              {activeProvider?.name || 'Cloud Provider'}
            </span>
            {activeProvider?.api_key ? (
              <div className="w-2 h-2 bg-green-500 rounded-full" title="API key configured" />
            ) : (
              <div className="w-2 h-2 bg-amber-500 rounded-full" title="No API key" />
            )}
          </div>
        ) : (
          /* Local Mode Status */
          <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-xl">
            <Zap size={16} className="text-blue-600" />
            {isLoading ? (
              <div className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse"></div>
            ) : (
              <div className={`w-2.5 h-2.5 rounded-full ${health.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            )}
            <span className="text-sm font-medium text-gray-700">
              {isLoading ? 'Connecting...' : health.connected ? 'Ollama Connected' : 'Ollama Disconnected'}
            </span>
            {health.error && (
              <div className="group relative">
                <AlertCircle size={16} className="text-red-500 cursor-help" />
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 max-w-xs">
                  {health.error}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Side - Controls */}
      <div className="flex items-center gap-4">
        {isStreaming && (
          <button
            className="flex items-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl transition-all duration-200 font-medium shadow-sm"
            onClick={stopStreaming}
          >
            <Square size={16} />
            <span>Stop generating</span>
          </button>
        )}

        <div className="text-sm text-gray-500 font-medium px-3">
          <span>Ready</span>
        </div>
      </div>

      {/* Parameters Panel */}
      <ParametersPanel
        isOpen={parametersOpen}
        onClose={() => setParametersOpen(false)}
      />
    </div>
  )
}
