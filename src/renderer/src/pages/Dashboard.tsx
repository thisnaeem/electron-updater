/**
 * Dashboard - Project creation with scene count, duration, aspect ratio, and caption settings
 */
import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
    Add01Icon,
    PlayIcon,
    Delete02Icon,
    AiVideoIcon,
    Clock01Icon,
    Calendar03Icon
} from '@hugeicons/core-free-icons'
import { useProjectStore } from '../stores/ProjectStore'
import type { Project, CaptionTemplate, CaptionPosition, CaptionSettings, AspectRatio } from '../types'
import { DEFAULT_CAPTION_SETTINGS, CAPTION_FONTS } from '../types'

interface DashboardProps {
    onOpenProject: (project: Project) => void
}

export function Dashboard({ onOpenProject }: DashboardProps) {
    const { projects, createProject, deleteProject } = useProjectStore()
    const [showNewProject, setShowNewProject] = useState(false)
    const [newProjectTopic, setNewProjectTopic] = useState('')
    const [sceneCount, setSceneCount] = useState(10)
    const [duration, setDuration] = useState(5)
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16')
    const [captionSettings, setCaptionSettings] = useState<CaptionSettings>(DEFAULT_CAPTION_SETTINGS)

    const handleCreateProject = () => {
        if (!newProjectTopic.trim()) return

        // Auto-generate name from topic
        const name = newProjectTopic.slice(0, 50) + (newProjectTopic.length > 50 ? '...' : '')
        const project = createProject(name, newProjectTopic, sceneCount, duration, aspectRatio, captionSettings)

        setShowNewProject(false)
        setNewProjectTopic('')
        setSceneCount(10)
        setDuration(5)
        setAspectRatio('9:16')
        setCaptionSettings(DEFAULT_CAPTION_SETTINGS)
        onOpenProject(project)
    }

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'completed': return 'status-completed'
            case 'error': return 'status-error'
            case 'draft': return 'status-draft'
            default: return 'status-generating'
        }
    }

    const captionTemplates: { id: CaptionTemplate; name: string; desc: string }[] = [
        { id: 'karaoke', name: 'Karaoke', desc: 'Words highlight as spoken' },
        { id: 'word-by-word', name: 'Word Pop', desc: 'One word at a time' },
        { id: 'sentence', name: 'Sentence', desc: 'Full sentences' },
        { id: 'minimal', name: 'Minimal', desc: 'Subtle captions' }
    ]

    const aspectRatios: { id: AspectRatio; name: string; desc: string }[] = [
        { id: '9:16', name: '9:16', desc: 'TikTok/Reels' },
        { id: '16:9', name: '16:9', desc: 'YouTube/Landscape' },
        { id: '1:1', name: '1:1', desc: 'Instagram Square' }
    ]

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-gradient-to-b from-slate-50/50 to-white/50">
            {/* Header */}
            <header className="shrink-0 px-6 lg:px-8 py-6 border-b border-slate-100 bg-white/60 backdrop-blur-sm">
                <div className="flex items-center justify-between max-w-7xl mx-auto">
                    <div>
                        <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
                        <p className="text-slate-500 mt-1">Create and manage your AI-generated videos</p>
                    </div>
                    <button
                        onClick={() => setShowNewProject(true)}
                        className="gradient-btn inline-flex items-center gap-2 px-5 py-2.5 text-white text-sm font-semibold rounded-xl"
                    >
                        <HugeiconsIcon icon={Add01Icon} className="w-5 h-5" />
                        <span className="hidden sm:inline">New Project</span>
                    </button>
                </div>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-auto px-6 lg:px-8 py-6">
                <div className="max-w-7xl mx-auto">
                    {/* New Project Modal */}
                    {showNewProject && (
                        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
                            <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-slide-up max-h-[95vh] overflow-auto">
                                <h2 className="text-xl font-bold text-slate-900 mb-1">Create New Video</h2>
                                <p className="text-sm text-slate-500 mb-5">Enter topic and choose settings - everything else is automated!</p>

                                <div className="space-y-4">
                                    {/* Topic */}
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Video Topic</label>
                                        <textarea
                                            value={newProjectTopic}
                                            onChange={(e) => setNewProjectTopic(e.target.value)}
                                            placeholder="e.g., The history of ancient Rome, How AI is changing healthcare..."
                                            rows={2}
                                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all resize-none bg-slate-50/50"
                                        />
                                    </div>

                                    {/* Aspect Ratio */}
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Video Size</label>
                                        <div className="flex gap-2">
                                            {aspectRatios.map((ar) => (
                                                <button
                                                    key={ar.id}
                                                    onClick={() => setAspectRatio(ar.id)}
                                                    className={`flex-1 py-3 px-3 rounded-xl border-2 text-center transition-all ${aspectRatio === ar.id
                                                            ? 'border-primary-500 bg-primary-50'
                                                            : 'border-slate-200 hover:border-slate-300'
                                                        }`}
                                                >
                                                    <p className="font-bold text-slate-900">{ar.name}</p>
                                                    <p className="text-xs text-slate-500">{ar.desc}</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Scene Count & Duration */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                                Scenes: <span className="text-primary-600">{sceneCount}</span>
                                            </label>
                                            <input
                                                type="range"
                                                value={sceneCount}
                                                onChange={(e) => setSceneCount(Number(e.target.value))}
                                                min={1}
                                                max={300}
                                                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary-500"
                                            />
                                            <div className="flex justify-between text-xs text-slate-400 mt-1">
                                                <span>1</span>
                                                <span>300</span>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                                Duration: <span className="text-primary-600">{duration} min</span>
                                            </label>
                                            <input
                                                type="range"
                                                value={duration}
                                                onChange={(e) => setDuration(Number(e.target.value))}
                                                min={1}
                                                max={60}
                                                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary-500"
                                            />
                                            <div className="flex justify-between text-xs text-slate-400 mt-1">
                                                <span>1 min</span>
                                                <span>60 min</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Caption Template */}
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Caption Style</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {captionTemplates.map((template) => (
                                                <button
                                                    key={template.id}
                                                    onClick={() => setCaptionSettings({ ...captionSettings, template: template.id })}
                                                    className={`p-3 rounded-xl border-2 text-left transition-all ${captionSettings.template === template.id
                                                            ? 'border-primary-500 bg-primary-50'
                                                            : 'border-slate-200 hover:border-slate-300'
                                                        }`}
                                                >
                                                    <p className="font-semibold text-sm text-slate-900">{template.name}</p>
                                                    <p className="text-xs text-slate-500">{template.desc}</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Caption Position & Font */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Position</label>
                                            <select
                                                value={captionSettings.position}
                                                onChange={(e) => setCaptionSettings({ ...captionSettings, position: e.target.value as CaptionPosition })}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-sm"
                                            >
                                                <option value="top">Top</option>
                                                <option value="center">Center</option>
                                                <option value="bottom">Bottom</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Font</label>
                                            <select
                                                value={captionSettings.fontFamily}
                                                onChange={(e) => setCaptionSettings({ ...captionSettings, fontFamily: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-sm"
                                            >
                                                {CAPTION_FONTS.map((font) => (
                                                    <option key={font} value={font}>{font}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3 mt-6">
                                    <button
                                        onClick={() => setShowNewProject(false)}
                                        className="flex-1 px-4 py-3 border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleCreateProject}
                                        disabled={!newProjectTopic.trim()}
                                        className="flex-1 gradient-btn px-4 py-3 text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Start Creating
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Empty State */}
                    {projects.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center mb-6">
                                <HugeiconsIcon icon={AiVideoIcon} className="w-10 h-10 text-slate-400" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">No projects yet</h3>
                            <p className="text-slate-500 mb-8 max-w-sm">Create your first AI-powered video - just enter a topic!</p>
                            <button
                                onClick={() => setShowNewProject(true)}
                                className="gradient-btn inline-flex items-center gap-2 px-6 py-3 text-white font-semibold rounded-xl"
                            >
                                <HugeiconsIcon icon={Add01Icon} className="w-5 h-5" />
                                Create Your First Video
                            </button>
                        </div>
                    ) : (
                        /* Projects Grid */
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-5">
                            {projects.map((project) => (
                                <div
                                    key={project.id}
                                    className="card p-5 cursor-pointer group relative"
                                    onClick={() => onOpenProject(project)}
                                >
                                    {/* Status Badge */}
                                    <div className={`status-badge ${getStatusStyle(project.status)} absolute top-4 right-4`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${project.status === 'completed' ? 'bg-emerald-500' :
                                                project.status === 'error' ? 'bg-red-500' :
                                                    project.status === 'draft' ? 'bg-slate-400' : 'bg-primary-500 animate-pulse'
                                            }`}></span>
                                        {project.status.replace('_', ' ')}
                                    </div>

                                    {/* Icon */}
                                    <div className="w-14 h-14 bg-gradient-to-br from-primary-100 to-primary-50 rounded-xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                                        <HugeiconsIcon icon={PlayIcon} className="w-7 h-7 text-primary-600" />
                                    </div>

                                    {/* Content */}
                                    <h3 className="font-bold text-slate-900 mb-1 truncate group-hover:text-primary-600 transition-colors">
                                        {project.name}
                                    </h3>
                                    <p className="text-sm text-slate-500 line-clamp-2 mb-4 min-h-[40px]">{project.topic}</p>

                                    {/* Meta */}
                                    <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-100">
                                        <div className="flex items-center gap-1.5">
                                            <HugeiconsIcon icon={Clock01Icon} className="w-3.5 h-3.5" />
                                            <span>{project.sceneCount} scenes • {project.aspectRatio}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <HugeiconsIcon icon={Calendar03Icon} className="w-3.5 h-3.5" />
                                            <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                                        </div>
                                    </div>

                                    {/* Delete button */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            deleteProject(project.id)
                                        }}
                                        className="absolute top-4 left-4 p-2 bg-red-50 text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-red-100"
                                    >
                                        <HugeiconsIcon icon={Delete02Icon} className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
