import React, { useState, useEffect } from 'react'
import { X, CheckCircle, AlertCircle, Loader2, Play, Download, ExternalLink, Zap, Cloud, Bot, Brain, Sparkles, ArrowRight, ArrowLeft } from 'lucide-react'
import { useSetupStore } from '../store/setupStore'
import { useSettingsStore } from '../store/settingsStore'
import type { ProviderConfig } from '../store/settingsStore'
import { invoke } from '@tauri-apps/api/core'

type WizardStep = 'mode-select' | 'local-detection' | 'local-install' | 'local-service' | 'cloud-setup' | 'complete'

const PROVIDER_PRESETS = {
    openai: { name: 'OpenAI', base_url: 'https://api.openai.com', icon: Bot },
    anthropic: { name: 'Anthropic (Claude)', base_url: 'https://api.anthropic.com', icon: Brain },
    google: { name: 'Google Gemini', base_url: 'https://generativelanguage.googleapis.com', icon: Sparkles },
}

export const ModeSelectionWizard: React.FC = () => {
    const { detection, isDetecting, detectOllama, startService, serviceAction, lastServiceResult } = useSetupStore()
    const { setAppMode, setSetupCompleted, saveSettingsToBackend, addProvider, setActiveProviderId } = useSettingsStore()

    const [isOpen, setIsOpen] = useState(false)
    const [step, setStep] = useState<WizardStep>('mode-select')
    const [selectedMode, setSelectedMode] = useState<'local' | 'cloud'>('local')

    // Cloud setup state
    const [selectedProvider, setSelectedProvider] = useState<'openai' | 'anthropic' | 'google'>('openai')
    const [apiKey, setApiKey] = useState('')
    const [providerName, setProviderName] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Check if wizard should open on mount
    useEffect(() => {
        const checkSetup = async () => {
            try {
                const settings = await invoke<any>('settings_get')
                if (!settings.setup_completed) {
                    setIsOpen(true)
                }
            } catch (e) {
                console.error('Failed to check setup status:', e)
                setIsOpen(true)
            }
        }

        const timer = setTimeout(checkSetup, 500)
        return () => clearTimeout(timer)
    }, [])

    const handleModeSelect = async (mode: 'local' | 'cloud') => {
        setSelectedMode(mode)
        setAppMode(mode)

        if (mode === 'local') {
            await detectOllama()
            setStep('local-detection')
        } else {
            setProviderName(PROVIDER_PRESETS[selectedProvider].name)
            setStep('cloud-setup')
        }
    }

    const handleCloudSubmit = async () => {
        if (!apiKey.trim()) {
            setError('API key is required')
            return
        }

        setIsSubmitting(true)
        setError(null)

        try {
            const newProvider: ProviderConfig = {
                id: `${selectedProvider}-${Date.now()}`,
                name: providerName || PROVIDER_PRESETS[selectedProvider].name,
                provider_type: selectedProvider,
                api_key: apiKey,
                base_url: PROVIDER_PRESETS[selectedProvider].base_url,
                enabled: true,
            }

            await addProvider(newProvider)
            setActiveProviderId(newProvider.id)
            setStep('complete')
        } catch (e) {
            setError(`Failed to save provider: ${e}`)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleComplete = async () => {
        setSetupCompleted(true)
        await saveSettingsToBackend()
        setIsOpen(false)
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
    }

    if (!isOpen) return null

    const renderModeSelect = () => (
        <div className="space-y-8">
            <div className="text-center">
                {/* Ollie Logo */}
                <div className="w-20 h-20 flex items-center justify-center mx-auto mb-6 shadow-none">
                    <img src="/ollie-logo.png" alt="Ollie Logo" className="w-full h-full object-contain" />
                </div>
                <h3 className="text-3xl font-bold text-gray-900 mb-3">Welcome to Ollie</h3>
                <p className="text-gray-600 text-lg max-w-md mx-auto">Choose how you'd like to run your AI models</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <button
                    onClick={() => handleModeSelect('local')}
                    className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-blue-200 rounded-2xl text-left transition-all duration-200 group hover:shadow-lg hover:-translate-y-1"
                >
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0">
                            <Zap className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-gray-900 mb-2 text-lg">Local Models</h4>
                            <p className="text-sm text-gray-600">Run models on your computer with Ollama. Free, private, and fully offline.</p>
                        </div>
                    </div>
                </button>

                <button
                    onClick={() => handleModeSelect('cloud')}
                    className="p-6 bg-gradient-to-br from-purple-50 to-violet-50 hover:from-purple-100 hover:to-violet-100 border border-purple-200 rounded-2xl text-left transition-all duration-200 group hover:shadow-lg hover:-translate-y-1"
                >
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-full bg-purple-500 flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0">
                            <Cloud className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-gray-900 mb-2 text-lg">Cloud Providers</h4>
                            <p className="text-sm text-gray-600">Use OpenAI, Claude, or Gemini with your API key for powerful models.</p>
                        </div>
                    </div>
                </button>
            </div>
        </div>
    )

    const renderLocalDetection = () => (
        <div className="space-y-6">
            <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center shadow-md">
                    {isDetecting ? (
                        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                    ) : detection?.installed ? (
                        <CheckCircle className="w-8 h-8 text-green-600" />
                    ) : (
                        <AlertCircle className="w-8 h-8 text-amber-600" />
                    )}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {isDetecting ? 'Detecting Ollama...' : 'Ollama Status'}
                </h3>
                <p className="text-gray-600">Checking your system for Ollama installation</p>
            </div>

            {detection && !isDetecting && (
                <div className="grid grid-cols-2 gap-4">
                    <div className={`p-4 rounded-2xl border transition-all duration-200 ${detection.installed
                        ? 'border-green-200 bg-gradient-to-br from-green-50 to-emerald-50'
                        : 'border-red-200 bg-gradient-to-br from-red-50 to-rose-50'}`}>
                        <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${detection.installed ? 'bg-green-500' : 'bg-red-500'}`}></div>
                            <span className="text-sm font-semibold text-gray-900">Installation</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-2">
                            {detection.installed ? `Installed (${detection.version || 'Unknown'})` : 'Not installed'}
                        </p>
                    </div>

                    <div className={`p-4 rounded-2xl border transition-all duration-200 ${detection.service_running
                        ? 'border-green-200 bg-gradient-to-br from-green-50 to-emerald-50'
                        : 'border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50'}`}>
                        <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${detection.service_running ? 'bg-green-500' : 'bg-amber-500'}`}></div>
                            <span className="text-sm font-semibold text-gray-900">Service</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-2">
                            {detection.service_running ? 'Running' : 'Not running'}
                        </p>
                    </div>
                </div>
            )}

            <div className="flex gap-3 justify-between">
                <button onClick={() => setStep('mode-select')} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-50 transition-all duration-200">
                    <ArrowLeft size={16} /> Back
                </button>
                <div className="flex gap-2">
                    <button onClick={detectOllama} disabled={isDetecting} className="px-4 py-2.5 text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-all duration-200">
                        Re-scan
                    </button>
                    {detection && !detection.installed && (
                        <button onClick={() => setStep('local-install')} className="px-4 py-2.5 text-sm font-medium bg-gray-900 text-white rounded-xl hover:bg-gray-800 shadow-lg hover:shadow-xl transition-all duration-200">
                            Install Ollama
                        </button>
                    )}
                    {detection && detection.installed && !detection.service_running && (
                        <button onClick={() => setStep('local-service')} className="px-4 py-2.5 text-sm font-medium bg-green-600 text-white rounded-xl hover:bg-green-700 shadow-lg hover:shadow-xl transition-all duration-200">
                            Start Service
                        </button>
                    )}
                    {detection && detection.installed && detection.service_running && (
                        <button onClick={() => setStep('complete')} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-gray-900 text-white rounded-xl hover:bg-gray-800 shadow-lg hover:shadow-xl transition-all duration-200">
                            Continue <ArrowRight size={16} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    )

    const renderLocalInstall = () => (
        <div className="space-y-6">
            <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center shadow-md">
                    <Download className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Install Ollama</h3>
                <p className="text-gray-600">Run this command in your terminal:</p>
            </div>

            <div className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl">
                <div className="bg-gray-900 p-4 rounded-xl font-mono text-sm text-green-400 shadow-inner">
                    curl -fsSL https://ollama.com/install.sh | sh
                </div>
                <div className="mt-3 flex gap-2">
                    <button onClick={() => copyToClipboard('curl -fsSL https://ollama.com/install.sh | sh')} className="text-sm px-3 py-1.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 font-medium transition-colors">
                        Copy
                    </button>
                    <a href="https://ollama.com/download" target="_blank" rel="noopener noreferrer" className="text-sm px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 flex items-center gap-1.5 font-medium transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" /> Visit Site
                    </a>
                </div>
            </div>

            <div className="flex gap-3 justify-between">
                <button onClick={() => setStep('local-detection')} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-50 transition-all duration-200">
                    <ArrowLeft size={16} /> Back
                </button>
                <button onClick={async () => { await detectOllama(); setStep('local-detection') }} className="px-4 py-2.5 text-sm font-medium bg-gray-900 text-white rounded-xl hover:bg-gray-800 shadow-lg hover:shadow-xl transition-all duration-200">
                    I've installed it
                </button>
            </div>
        </div>
    )

    const renderLocalService = () => (
        <div className="space-y-6">
            <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center shadow-md">
                    {serviceAction !== 'idle' ? <Loader2 className="w-8 h-8 text-green-600 animate-spin" /> : <Play className="w-8 h-8 text-green-600" />}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Start Ollama Service</h3>
                <p className="text-gray-600">The service needs to be running to use local models</p>
            </div>

            {lastServiceResult && (
                <div className={`p-4 rounded-2xl border ${lastServiceResult.success
                    ? 'border-green-200 bg-gradient-to-br from-green-50 to-emerald-50'
                    : 'border-red-200 bg-gradient-to-br from-red-50 to-rose-50'}`}>
                    <p className="text-sm text-gray-700">{lastServiceResult.message}</p>
                </div>
            )}

            <div className="flex gap-3 justify-between">
                <button onClick={() => setStep('local-detection')} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-50 transition-all duration-200">
                    <ArrowLeft size={16} /> Back
                </button>
                <button
                    onClick={async () => { await startService(); await detectOllama(); if (detection?.service_running) setStep('complete') }}
                    disabled={serviceAction !== 'idle'}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 shadow-lg hover:shadow-xl transition-all duration-200"
                >
                    {serviceAction === 'starting' ? <><Loader2 className="w-4 h-4 animate-spin" /> Starting...</> : <><Play className="w-4 h-4" /> Start Service</>}
                </button>
            </div>
        </div>
    )

    const renderCloudSetup = () => (
        <div className="space-y-6">
            <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-100 to-violet-100 flex items-center justify-center shadow-md">
                    <Cloud className="w-8 h-8 text-purple-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Connect Cloud Provider</h3>
                <p className="text-gray-600">Enter your API key to get started</p>
            </div>

            {/* Provider Selection */}
            <div className="flex p-1.5 bg-gray-100 rounded-xl">
                {(['openai', 'anthropic', 'google'] as const).map((provider) => {
                    const Icon = PROVIDER_PRESETS[provider].icon
                    return (
                        <button
                            key={provider}
                            onClick={() => { setSelectedProvider(provider); setProviderName(PROVIDER_PRESETS[provider].name) }}
                            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${selectedProvider === provider
                                ? 'bg-white shadow-md text-gray-900'
                                : 'text-gray-600 hover:text-gray-900'}`}
                        >
                            <Icon size={16} />
                            {provider === 'openai' ? 'OpenAI' : provider === 'anthropic' ? 'Claude' : 'Gemini'}
                        </button>
                    )
                })}
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Display Name</label>
                    <input
                        type="text"
                        value={providerName}
                        onChange={(e) => setProviderName(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all duration-200"
                        placeholder="My OpenAI Account"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">API Key</label>
                    <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all duration-200"
                        placeholder={selectedProvider === 'openai' ? 'sk-...' : selectedProvider === 'anthropic' ? 'sk-ant-...' : 'AIza...'}
                    />
                </div>
            </div>

            {error && (
                <div className="p-4 bg-gradient-to-br from-red-50 to-rose-50 border border-red-200 rounded-2xl">
                    <p className="text-sm text-red-700">{error}</p>
                </div>
            )}

            <div className="flex gap-3 justify-between">
                <button onClick={() => setStep('mode-select')} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-50 transition-all duration-200">
                    <ArrowLeft size={16} /> Back
                </button>
                <button
                    onClick={handleCloudSubmit}
                    disabled={isSubmitting || !apiKey.trim()}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-50 shadow-lg hover:shadow-xl transition-all duration-200"
                >
                    {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <>Continue <ArrowRight size={16} /></>}
                </button>
            </div>
        </div>
    )

    const renderComplete = () => (
        <div className="space-y-6">
            <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center shadow-md">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">You're all set!</h3>
                <p className="text-gray-600">
                    {selectedMode === 'local'
                        ? 'Ollama is ready. You can now pull models and start chatting.'
                        : `${PROVIDER_PRESETS[selectedProvider].name} is configured. Select a model to start chatting.`
                    }
                </p>
            </div>

            <div className="p-5 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl">
                <p className="text-sm text-green-800">
                    <strong>Tip:</strong> You can switch between local and cloud modes anytime in Settings.
                </p>
            </div>

            <div className="flex justify-center">
                <button onClick={handleComplete} className="px-6 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200">
                    Start Using Ollie
                </button>
            </div>
        </div>
    )

    const getStepContent = () => {
        switch (step) {
            case 'mode-select': return renderModeSelect()
            case 'local-detection': return renderLocalDetection()
            case 'local-install': return renderLocalInstall()
            case 'local-service': return renderLocalService()
            case 'cloud-setup': return renderCloudSetup()
            case 'complete': return renderComplete()
            default: return renderModeSelect()
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-3xl">
                    <h2 className="text-lg font-semibold text-gray-900">Setup</h2>
                    {step !== 'mode-select' && (
                        <button onClick={() => { setSetupCompleted(true); saveSettingsToBackend(); setIsOpen(false) }} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>
                <div className="px-6 py-8">{getStepContent()}</div>
            </div>
        </div>
    )
}
