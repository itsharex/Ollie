import { useEffect } from 'react'
import { useSettingsStore } from '../store/settingsStore'
import McpServerManager from '../components/McpServerManager'
import ProviderSettings from '../components/ProviderSettings'
import { Zap, Cloud, Save, Check } from 'lucide-react'
import { useState } from 'react'

export default function SettingsRoute() {
  const {
    serverUrl, serverPort, defaultModel, defaultParams, appMode,
    setServerUrl, setServerPort, setDefaultModel, setDefaultParams, setAppMode,
    loadSettingsFromBackend, saveSettingsToBackend
  } = useSettingsStore()

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { loadSettingsFromBackend() }, [])

  const save = async () => {
    setSaving(true)
    try {
      await saveSettingsToBackend()
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const handleModeChange = (mode: 'local' | 'cloud') => {
    console.log('Handling mode change to:', mode)
    setAppMode(mode)
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header with Save Button */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
          <p className="text-gray-600">Configure your preferences and connection settings</p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold shadow-lg transition-all duration-200 transform hover:-translate-y-0.5 ${saved
            ? 'bg-green-600 text-white'
            : 'bg-gradient-to-br from-gray-900 to-gray-800 hover:from-gray-800 hover:to-gray-700 text-white'
            }`}
        >
          {saved ? (
            <><Check size={18} /> Saved</>
          ) : saving ? (
            <><Save size={18} className="animate-pulse" /> Saving...</>
          ) : (
            <><Save size={18} /> Save Settings</>
          )}
        </button>
      </div>

      <div className="space-y-8">
        {/* Mode Toggle */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-3">
            <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
            Mode
          </h2>
          <div className="flex p-1 bg-gray-100 rounded-xl w-max">
            <button
              onClick={() => handleModeChange('local')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${appMode === 'local'
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              <Zap size={16} className={appMode === 'local' ? 'text-blue-600' : ''} />
              Local (Ollama)
            </button>
            <button
              onClick={() => handleModeChange('cloud')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${appMode === 'cloud'
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              <Cloud size={16} className={appMode === 'cloud' ? 'text-purple-600' : ''} />
              Cloud Providers
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            {appMode === 'local'
              ? 'Using local Ollama models. Free and private.'
              : 'Using cloud AI providers with your API keys.'
            }
          </p>
        </div>

        {/* LOCAL MODE SECTIONS */}
        {appMode === 'local' && (
          <>
            {/* Server Configuration */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                Server Configuration
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Server Connection</label>
                  <div className="flex gap-3">
                    <input
                      value={serverUrl}
                      onChange={(e) => setServerUrl(e.target.value)}
                      placeholder="http://localhost"
                      className="flex-1 px-4 py-3 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200 text-gray-900 placeholder-gray-500"
                    />
                    <input
                      type="number"
                      value={serverPort}
                      onChange={(e) => setServerPort(Number(e.target.value))}
                      placeholder="11434"
                      className="w-32 px-4 py-3 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200 text-gray-900 placeholder-gray-500"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Configure the Ollama server URL and port</p>
                </div>
              </div>
            </div>

            {/* Model Configuration */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                Model Settings
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Default Model</label>
                  <input
                    value={defaultModel}
                    onChange={(e) => setDefaultModel(e.target.value)}
                    placeholder="llama3:instruct"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200 text-gray-900 placeholder-gray-500"
                  />
                  <p className="text-xs text-gray-500 mt-2">Model to use by default for new chats</p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* CLOUD MODE SECTIONS */}
        {appMode === 'cloud' && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-3">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              LLM Providers
            </h2>
            <ProviderSettings />
          </div>
        )}

        {/* ALWAYS VISIBLE SECTIONS */}
        {/* Generation Parameters */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-3">
            <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
            Generation Parameters
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Temperature</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={defaultParams.temperature}
                onChange={(e) => setDefaultParams({ temperature: Number(e.target.value) })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200 text-gray-900"
              />
              <p className="text-xs text-gray-500 mt-1">Controls randomness (0.0 - 2.0)</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Top K</label>
              <input
                type="number"
                min="1"
                value={defaultParams.topK}
                onChange={(e) => setDefaultParams({ topK: Number(e.target.value) })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200 text-gray-900"
              />
              <p className="text-xs text-gray-500 mt-1">Limits token choices</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Top P</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={defaultParams.topP}
                onChange={(e) => setDefaultParams({ topP: Number(e.target.value) })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200 text-gray-900"
              />
              <p className="text-xs text-gray-500 mt-1">Nucleus sampling (0.0 - 1.0)</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Max Tokens</label>
              <input
                type="number"
                min="1"
                value={defaultParams.maxTokens}
                onChange={(e) => setDefaultParams({ maxTokens: Number(e.target.value) })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200 text-gray-900"
              />
              <p className="text-xs text-gray-500 mt-1">Maximum response length</p>
            </div>
          </div>
        </div>

        {/* MCP Servers */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <McpServerManager />
        </div>
      </div>
    </div>
  )
}
