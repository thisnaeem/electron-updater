/**
 * Main App - Premium dashboard layout with HugeIcons
 */
import { useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { Dashboard } from './pages/Dashboard'
import { VideoEditor } from './pages/VideoEditor'
import { useProjectStore } from './stores/ProjectStore'
import type { Project } from './types'
import { HugeiconsIcon } from '@hugeicons/react'
import { Configuration01Icon, InformationCircleIcon } from '@hugeicons/core-free-icons'

type View = 'dashboard' | 'editor' | 'settings'

function App(): React.JSX.Element {
  const [currentView, setCurrentView] = useState<View>('dashboard')
  const { setCurrentProject } = useProjectStore()

  const handleOpenProject = (project: Project) => {
    setCurrentProject(project)
    setCurrentView('editor')
  }

  const handleNavigate = (view: View) => {
    setCurrentView(view)
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      <Sidebar currentView={currentView} onNavigate={handleNavigate} />

      <main className="flex-1 flex flex-col overflow-hidden">
        {currentView === 'dashboard' && <Dashboard onOpenProject={handleOpenProject} />}
        {currentView === 'editor' && <VideoEditor />}
        {currentView === 'settings' && <SettingsPage />}
      </main>
    </div>
  )
}

function SettingsPage() {
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-gradient-to-b from-slate-50/50 to-white/50">
      {/* Header */}
      <header className="shrink-0 px-6 lg:px-8 py-6 border-b border-slate-100 bg-white/60 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
          <p className="text-slate-500 mt-1">Configure your AutoVid preferences</p>
        </div>
      </header>

      <div className="flex-1 overflow-auto px-6 lg:px-8 py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* API Configuration */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
                <HugeiconsIcon icon={Configuration01Icon} className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">API Configuration</h2>
                <p className="text-sm text-slate-500">Manage your API connections</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                <div>
                  <p className="font-semibold text-slate-900">Google Gemini</p>
                  <p className="text-xs text-slate-500">Script generation</p>
                </div>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">
                  Connected
                </span>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                <div>
                  <p className="font-semibold text-slate-900">Cloudflare AI</p>
                  <p className="text-xs text-slate-500">Image generation</p>
                </div>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">
                  Connected
                </span>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                <div>
                  <p className="font-semibold text-slate-900">TTSFM</p>
                  <p className="text-xs text-slate-500">Text-to-speech</p>
                </div>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">
                  Connected
                </span>
              </div>
            </div>
          </div>

          {/* About */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                <HugeiconsIcon icon={InformationCircleIcon} className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">About AutoVid</h2>
                <p className="text-sm text-slate-500">Version information</p>
              </div>
            </div>

            <div className="text-slate-600 space-y-2">
              <p><span className="font-semibold">Version:</span> 1.0.1</p>
              <p><span className="font-semibold">Platform:</span> Electron + React</p>
              <p className="text-sm text-slate-500 mt-4">
                AutoVid is an AI-powered video creation platform that generates long-form videos from a single topic.
                It uses Gemini for scripts, Cloudflare AI for images, TTSFM for voiceover, and FFmpeg for video composition.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
