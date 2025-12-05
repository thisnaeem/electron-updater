/**
 * Sidebar - Premium navigation with HugeIcons
 */
import { HugeiconsIcon } from '@hugeicons/react'
import {
    DashboardSquare01Icon,
    AiVideoIcon,
    Configuration01Icon,
    PlayIcon
} from '@hugeicons/core-free-icons'
import { useProjectStore } from '../stores/ProjectStore'

interface SidebarProps {
    currentView: 'dashboard' | 'editor' | 'settings'
    onNavigate: (view: 'dashboard' | 'editor' | 'settings') => void
}

export function Sidebar({ currentView, onNavigate }: SidebarProps) {
    const { currentProject } = useProjectStore()

    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: DashboardSquare01Icon },
        { id: 'editor', label: 'Video Editor', icon: AiVideoIcon, disabled: !currentProject },
        { id: 'settings', label: 'Settings', icon: Configuration01Icon }
    ] as const

    const getStatusInfo = (status: string) => {
        switch (status) {
            case 'completed': return { color: 'bg-emerald-500', text: 'Completed' }
            case 'error': return { color: 'bg-red-500', text: 'Error' }
            case 'draft': return { color: 'bg-slate-400', text: 'Draft' }
            default: return { color: 'bg-primary-500 animate-pulse', text: status.replace('_', ' ') }
        }
    }

    return (
        <aside className="w-64 lg:w-72 bg-white/80 backdrop-blur-xl border-r border-slate-200/50 flex flex-col h-full shrink-0">
            {/* Logo */}
            <div className="p-5 border-b border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-gradient-to-br from-primary-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/30">
                        <HugeiconsIcon icon={PlayIcon} className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="font-bold text-slate-900 text-lg tracking-tight">AutoVid</h1>
                        <p className="text-xs text-slate-500 font-medium">AI Video Creator</p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
                {navItems.map((item) => {
                    const isActive = currentView === item.id
                    const isDisabled = 'disabled' in item && item.disabled

                    return (
                        <button
                            key={item.id}
                            onClick={() => !isDisabled && onNavigate(item.id)}
                            disabled={isDisabled}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${isActive
                                    ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/25'
                                    : isDisabled
                                        ? 'text-slate-300 cursor-not-allowed'
                                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                }`}
                        >
                            <HugeiconsIcon
                                icon={item.icon}
                                className={`w-5 h-5 ${isActive ? 'text-white' : isDisabled ? 'text-slate-300' : 'text-slate-500'}`}
                            />
                            {item.label}
                        </button>
                    )
                })}
            </nav>

            {/* Current Project */}
            {currentProject && (
                <div className="p-4 border-t border-slate-100">
                    <div className="p-4 bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl border border-slate-200/50">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Project</p>
                            <div className={`w-2 h-2 rounded-full ${getStatusInfo(currentProject.status).color}`}></div>
                        </div>
                        <p className="text-sm font-semibold text-slate-900 truncate">{currentProject.name}</p>
                        <p className="text-xs text-slate-500 truncate mt-0.5">{currentProject.topic}</p>
                        <div className="flex items-center gap-2 mt-3">
                            <span className="text-xs px-2 py-0.5 bg-white rounded-full text-slate-600 font-medium border border-slate-200">
                                {currentProject.targetDuration} min
                            </span>
                            <span className="text-xs text-slate-400 capitalize">
                                {getStatusInfo(currentProject.status).text}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Version */}
            <div className="p-4 border-t border-slate-100">
                <p className="text-xs text-slate-400 text-center font-medium">AutoVid v1.0.1</p>
            </div>
        </aside>
    )
}
