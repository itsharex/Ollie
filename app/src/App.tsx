import './App.css'
import Sidebar from './components/Sidebar.tsx'
import MainPanel from './components/MainPanel.tsx'
import TopBar from './components/TopBar.tsx'
import { SetupWizard } from './components/SetupWizard.tsx'
import { NotificationContainer } from './components/Notifications.tsx'
import ModelsRoute from './routes/models'
import SettingsRoute from './routes/settings'
import MonitoringDashboard from './components/MonitoringDashboard.tsx'
import { useUIStore } from './store/uiStore'
import { useSetupStore } from './store/setupStore'
import { useOllamaHealth } from './lib/hooks'
import { useMonitoringStore } from './store/monitoringStore'
import { useEffect } from 'react'
import TitleBar from './components/TitleBar.tsx'

function App() {
  const { view } = useUIStore()
  // ... (hooks)
  const { openSetupWizard, detection, detectOllama } = useSetupStore()
  const { health } = useOllamaHealth()

  // Auto-open setup wizard if Ollama is not detected
  useEffect(() => {
    const checkSetup = async () => {
      if (!health.connected && !detection) {
        const result = await detectOllama()
        // Open setup wizard if Ollama is not properly configured
        if (!result || !result.installed || !result.service_running) {
          openSetupWizard()
        }
      }
    }

    // Delay check to avoid immediate popup on app start
    const timer = setTimeout(checkSetup, 2000)
    return () => clearTimeout(timer)
  }, [health.connected, detection, detectOllama, openSetupWizard])

  // System monitoring auto-resume
  const { monitoringEnabled, isMonitoring, startMonitoring } = useMonitoringStore()

  useEffect(() => {
    // If enabled but not running (e.g. after reload), start it
    if (monitoringEnabled && !isMonitoring) {
      startMonitoring()
    }
  }, [monitoringEnabled, isMonitoring, startMonitoring])

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 overflow-hidden pt-9">
      <TitleBar />
      {/* Left Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        {view === 'chat' && <MainPanel />}
        {view === 'models' && <div className="flex-1 overflow-auto bg-white"><ModelsRoute /></div>}
        {view === 'settings' && <div className="flex-1 overflow-auto bg-white"><SettingsRoute /></div>}
        {view === 'monitoring' && <div className="flex-1 overflow-auto bg-gray-50"><MonitoringDashboard /></div>}
      </div>

      {/* Setup Wizard */}
      <SetupWizard />

      {/* Notifications */}
      <NotificationContainer />
    </div>
  )
}

export default App
