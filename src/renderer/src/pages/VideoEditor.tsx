/**
 * VideoEditor - Fully automated video generation
 * One-click: Script → Images → Audio → Captions → Video
 */
import { useEffect, useCallback, useRef, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
    File01Icon,
    Image01Icon,
    MusicNote01Icon,
    ClosedCaptionIcon,
    AiVideoIcon,
    FileDownloadIcon,
    CheckmarkCircle02Icon,
    Loading01Icon,
    ArrowRight01Icon
} from '@hugeicons/core-free-icons'
import { useProjectStore } from '../stores/ProjectStore'
import { geminiService } from '../services/GeminiService'
import { cloudflareService } from '../services/CloudflareService'
import { ttsService } from '../services/TTSService'
import { videoComposer } from '../services/VideoComposer'
import { VideoPlayer } from '../components/VideoPlayer'
import type { Caption, WordTiming, CaptionSettings, CaptionTemplate, CaptionPosition } from '../types'
import { DEFAULT_CAPTION_SETTINGS, CAPTION_FONTS } from '../types'

type Step = 'script' | 'images' | 'audio' | 'captions' | 'video' | 'complete'

interface StepInfo {
    id: Step
    label: string
    icon: typeof File01Icon
}

export function VideoEditor() {
    const {
        currentProject,
        updateProject,
        setScenes,
        updateScene,
        setProgress,
        setIsGenerating,
        isGenerating,
        progress,
        setProjectStatus,
        setAudio,
        setCaptions,
        setVideo
    } = useProjectStore()

    const isRunning = useRef(false)
    const [captionSettings, setCaptionSettingsState] = useState<CaptionSettings>(
        currentProject?.captionSettings || DEFAULT_CAPTION_SETTINGS
    )
    const [isReRendering, setIsReRendering] = useState(false)

    const steps: StepInfo[] = [
        { id: 'script', label: 'Script', icon: File01Icon },
        { id: 'images', label: 'Images', icon: Image01Icon },
        { id: 'audio', label: 'Audio', icon: MusicNote01Icon },
        { id: 'captions', label: 'Captions', icon: ClosedCaptionIcon },
        { id: 'video', label: 'Video', icon: AiVideoIcon },
        { id: 'complete', label: 'Done', icon: FileDownloadIcon }
    ]

    const getCurrentStep = (): Step => {
        if (!currentProject) return 'script'
        if (currentProject.status === 'completed') return 'complete'
        if (currentProject.videoBlob) return 'complete'
        if (currentProject.captions?.length) return 'video'
        if (currentProject.audioBlob) return 'captions'
        if (currentProject.scenes.some(s => s.imageUrl)) return 'audio'
        if (currentProject.scenes.length > 0) return 'images'
        return 'script'
    }

    const currentStep = getCurrentStep()
    const stepIndex = steps.findIndex(s => s.id === currentStep)

    // Auto-run pipeline
    const runAutomatedPipeline = useCallback(async () => {
        if (!currentProject || isRunning.current || currentProject.status === 'completed') return

        isRunning.current = true
        setIsGenerating(true)

        try {
            // Step 1: Generate Script
            if (!currentProject.script || currentProject.scenes.length === 0) {
                setProjectStatus(currentProject.id, 'generating_script')
                setProgress({ step: 'script', current: 0, total: 1, message: 'Generating script...' })

                const script = await geminiService.generateScript(
                    currentProject.topic,
                    currentProject.targetDuration,
                    undefined,
                    currentProject.sceneCount
                )

                updateProject(currentProject.id, { script })
                const scenes = geminiService.parseScriptToScenes(script, currentProject.sceneCount)
                setScenes(currentProject.id, scenes)

                setProgress({ step: 'script', current: 1, total: 1, message: `Created ${scenes.length} scenes` })
                await new Promise(r => setTimeout(r, 500))
            }

            // Get fresh state
            const project = useProjectStore.getState().currentProject
            if (!project) throw new Error('Project not found')

            // Step 2: Generate Images
            const hasAllImages = project.scenes.every(s => s.imageUrl)
            if (!hasAllImages) {
                setProjectStatus(project.id, 'generating_images')

                for (let i = 0; i < project.scenes.length; i++) {
                    const scene = project.scenes[i]
                    if (scene.imageUrl) continue // Skip if already has image

                    setProgress({
                        step: 'images',
                        current: i + 1,
                        total: project.scenes.length,
                        message: `Generating image ${i + 1}/${project.scenes.length}`
                    })

                    const imageBlob = await cloudflareService.generateImage(scene.imagePrompt, project.aspectRatio)
                    if (imageBlob) {
                        const imageUrl = URL.createObjectURL(imageBlob)
                        updateScene(project.id, scene.id, { imageBlob, imageUrl })
                    }
                }
            }

            // Step 3: Generate Audio
            const latestProject = useProjectStore.getState().currentProject
            if (!latestProject) throw new Error('Project not found')

            if (!latestProject.audioBlob) {
                setProjectStatus(latestProject.id, 'generating_audio')
                setProgress({ step: 'audio', current: 0, total: 1, message: 'Generating voiceover...' })

                const audioBlob = await ttsService.generateSpeechForScenes(
                    latestProject.scenes,
                    'nova',
                    (current, total, msg) => {
                        setProgress({ step: 'audio', current, total, message: msg })
                    }
                )

                if (audioBlob) {
                    setAudio(latestProject.id, audioBlob)
                } else {
                    throw new Error('Failed to generate audio')
                }
            }

            // Step 4: Generate Captions with word timings
            const projectWithAudio = useProjectStore.getState().currentProject
            if (!projectWithAudio) throw new Error('Project not found')

            if (!projectWithAudio.captions || projectWithAudio.captions.length === 0) {
                setProjectStatus(projectWithAudio.id, 'generating_captions')
                setProgress({ step: 'captions', current: 0, total: 1, message: 'Transcribing audio...' })

                // Try to get word-level transcription
                let captions: Caption[] = []

                if (projectWithAudio.audioBlob) {
                    const transcription = await cloudflareService.transcribeAudio(projectWithAudio.audioBlob)

                    if (transcription && transcription.words.length > 0) {
                        // Create captions from transcription with word timings
                        captions = createCaptionsFromTranscription(transcription.words, projectWithAudio.scenes)
                    }
                }

                // Fallback: create captions from scene text
                if (captions.length === 0) {
                    let currentTime = 0
                    captions = projectWithAudio.scenes.map((scene, i) => {
                        // Generate word timings from scene text
                        const words = scene.text.split(/\s+/).filter(Boolean)
                        const wordDuration = scene.duration / words.length
                        const wordTimings: WordTiming[] = words.map((word, wi) => ({
                            word,
                            start: currentTime + wi * wordDuration,
                            end: currentTime + (wi + 1) * wordDuration
                        }))

                        const caption: Caption = {
                            id: `caption-${i}`,
                            startTime: currentTime,
                            endTime: currentTime + scene.duration,
                            text: scene.text,
                            words: wordTimings
                        }
                        currentTime += scene.duration
                        return caption
                    })
                }

                setCaptions(projectWithAudio.id, captions)
                setProgress({ step: 'captions', current: 1, total: 1, message: `Created ${captions.length} captions` })
            }

            // Step 5: Compose Video
            const finalProject = useProjectStore.getState().currentProject
            if (!finalProject) throw new Error('Project not found')

            if (!finalProject.videoBlob) {
                setProjectStatus(finalProject.id, 'composing_video')

                const videoBlob = await videoComposer.composeVideo(
                    finalProject.scenes,
                    finalProject.audioBlob!,
                    finalProject.captions!,
                    finalProject.captionSettings,
                    finalProject.aspectRatio,
                    (msg) => setProgress({ step: 'video', current: 0, total: 1, message: msg })
                )

                if (videoBlob) {
                    setVideo(finalProject.id, videoBlob)
                    setProjectStatus(finalProject.id, 'completed')
                    setProgress({ step: 'complete', current: 1, total: 1, message: 'Video complete!' })
                } else {
                    throw new Error('Failed to compose video')
                }
            }
        } catch (error) {
            console.error('Pipeline error:', error)
            if (currentProject) {
                setProjectStatus(currentProject.id, 'error')
                setProgress({ step: 'error', current: 0, total: 1, message: `Error: ${error}` })
            }
        } finally {
            setIsGenerating(false)
            isRunning.current = false
        }
    }, [currentProject, setIsGenerating, setProjectStatus, setProgress, updateProject, setScenes, updateScene, setAudio, setCaptions, setVideo])

    // Auto-start when project is loaded
    useEffect(() => {
        if (currentProject && currentProject.status === 'draft' && !isRunning.current) {
            runAutomatedPipeline()
        }
    }, [currentProject?.id])

    const exportVideo = useCallback(() => {
        if (!currentProject?.videoBlob) return

        const url = URL.createObjectURL(currentProject.videoBlob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${currentProject.name.replace(/\s+/g, '_')}.webm`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }, [currentProject])

    if (!currentProject) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-slate-50 to-white">
                <div className="text-center">
                    <HugeiconsIcon icon={AiVideoIcon} className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500 font-medium">Select a project to start</p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-gradient-to-b from-slate-50/50 to-white/50">
            {/* Header with Steps */}
            <header className="shrink-0 bg-white/80 backdrop-blur-sm border-b border-slate-200/50 px-6 py-4">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 truncate">{currentProject.topic.slice(0, 60)}</h1>
                        <p className="text-sm text-slate-500">{currentProject.sceneCount} scenes • {currentProject.captionSettings.template} style</p>
                    </div>
                </div>

                {/* Progress Steps */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {steps.map((step, i) => {
                        const isComplete = i < stepIndex
                        const isCurrent = step.id === currentStep
                        const isActive = isGenerating && isCurrent

                        return (
                            <div key={step.id} className="flex items-center shrink-0">
                                <div
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${isCurrent
                                        ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/25'
                                        : isComplete
                                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                            : 'bg-slate-100 text-slate-400'
                                        }`}
                                >
                                    <HugeiconsIcon
                                        icon={isComplete ? CheckmarkCircle02Icon : isActive ? Loading01Icon : step.icon}
                                        className={`w-4 h-4 ${isActive ? 'animate-spin' : ''}`}
                                    />
                                    <span className="hidden sm:inline">{step.label}</span>
                                </div>
                                {i < steps.length - 1 && (
                                    <div className={`w-6 h-0.5 mx-1 ${isComplete ? 'bg-emerald-300' : 'bg-slate-200'}`} />
                                )}
                            </div>
                        )
                    })}
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 overflow-auto p-6">
                <div className="max-w-4xl mx-auto">
                    {/* Progress Card */}
                    {progress && currentStep !== 'complete' && (
                        <div className="card p-6 mb-6 animate-slide-up">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                                    <HugeiconsIcon icon={Loading01Icon} className="w-6 h-6 text-primary-600 animate-spin" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-slate-900">{progress.message}</h3>
                                    {progress.total > 1 && (
                                        <p className="text-sm text-slate-500">{progress.current} of {progress.total}</p>
                                    )}
                                </div>
                            </div>

                            {progress.total > 1 && (
                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-primary-500 to-indigo-500 transition-all duration-300"
                                        style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Scene Preview Grid */}
                    {currentProject.scenes.length > 0 && currentStep !== 'complete' && (
                        <div className="card p-6 animate-slide-up">
                            <h3 className="font-bold text-slate-900 mb-4">Scenes ({currentProject.scenes.length})</h3>
                            <div className={`grid gap-2 ${currentProject.aspectRatio === '16:9'
                                ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
                                : currentProject.aspectRatio === '1:1'
                                    ? 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-5'
                                    : 'grid-cols-4 sm:grid-cols-5 lg:grid-cols-6'
                                }`}>
                                {currentProject.scenes.slice(0, 12).map((scene, i) => (
                                    <div
                                        key={scene.id}
                                        className={`bg-slate-100 rounded-lg overflow-hidden ${currentProject.aspectRatio === '16:9'
                                            ? 'aspect-video'
                                            : currentProject.aspectRatio === '1:1'
                                                ? 'aspect-square'
                                                : 'aspect-[9/16]'
                                            }`}
                                    >
                                        {scene.imageUrl ? (
                                            <img src={scene.imageUrl} alt={`Scene ${i + 1}`} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <span className="text-2xl font-bold text-slate-300">{i + 1}</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {currentProject.scenes.length > 12 && (
                                    <div className={`bg-slate-100 rounded-lg flex items-center justify-center ${currentProject.aspectRatio === '16:9'
                                        ? 'aspect-video'
                                        : currentProject.aspectRatio === '1:1'
                                            ? 'aspect-square'
                                            : 'aspect-[9/16]'
                                        }`}>
                                        <span className="text-sm font-semibold text-slate-400">+{currentProject.scenes.length - 12}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Completed State with Caption Style Selector */}
                    {currentStep === 'complete' && (
                        <div className="card p-6 animate-slide-up">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                                    <HugeiconsIcon icon={CheckmarkCircle02Icon} className="w-6 h-6 text-emerald-600" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900">Video Ready! 🎉</h2>
                                    <p className="text-sm text-slate-500">Customize captions and download</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Video Preview */}
                                <div>
                                    {currentProject.videoUrl && (
                                        <VideoPlayer
                                            src={currentProject.videoUrl}
                                            aspectRatio={currentProject.aspectRatio}
                                            title={currentProject.name}
                                            onDownload={exportVideo}
                                        />
                                    )}
                                </div>

                                {/* Caption Style Selector */}
                                <div className="space-y-4">
                                    <h3 className="font-bold text-slate-900">Caption Style</h3>

                                    {/* Style Templates */}
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { id: 'karaoke', name: 'Karaoke', desc: 'Word highlight' },
                                            { id: 'word-by-word', name: 'Word Pop', desc: 'One at a time' },
                                            { id: 'sentence', name: 'Sentence', desc: 'Full text' },
                                            { id: 'minimal', name: 'Minimal', desc: 'Subtle' }
                                        ].map((template) => (
                                            <button
                                                key={template.id}
                                                onClick={() => setCaptionSettingsState({ ...captionSettings, template: template.id as CaptionTemplate })}
                                                className={`p-3 rounded-xl border-2 text-left transition-all ${captionSettings.template === template.id
                                                        ? 'border-primary-500 bg-primary-50'
                                                        : 'border-slate-200 hover:border-slate-300'
                                                    }`}
                                            >
                                                <p className="font-semibold text-sm">{template.name}</p>
                                                <p className="text-xs text-slate-500">{template.desc}</p>
                                            </button>
                                        ))}
                                    </div>

                                    {/* Position & Font */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Position</label>
                                            <select
                                                value={captionSettings.position}
                                                onChange={(e) => setCaptionSettingsState({ ...captionSettings, position: e.target.value as CaptionPosition })}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-sm"
                                            >
                                                <option value="top">Top</option>
                                                <option value="center">Center</option>
                                                <option value="bottom">Bottom</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Font</label>
                                            <select
                                                value={captionSettings.fontFamily}
                                                onChange={(e) => setCaptionSettingsState({ ...captionSettings, fontFamily: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-sm"
                                            >
                                                {CAPTION_FONTS.map((font) => (
                                                    <option key={font} value={font}>{font}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Font Size */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">Font Size</label>
                                        <div className="flex gap-2">
                                            {(['small', 'medium', 'large'] as const).map((size) => (
                                                <button
                                                    key={size}
                                                    onClick={() => setCaptionSettingsState({ ...captionSettings, fontSize: size })}
                                                    className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium capitalize ${captionSettings.fontSize === size
                                                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                                                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                                                        }`}
                                                >
                                                    {size}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Re-render Button */}
                                    <button
                                        onClick={async () => {
                                            if (!currentProject || isReRendering) return
                                            setIsReRendering(true)
                                            setProgress({ step: 'video', current: 0, total: 1, message: 'Re-rendering with new captions...' })

                                            try {
                                                updateProject(currentProject.id, { captionSettings })
                                                const videoBlob = await videoComposer.composeVideo(
                                                    currentProject.scenes,
                                                    currentProject.audioBlob!,
                                                    currentProject.captions!,
                                                    captionSettings,
                                                    currentProject.aspectRatio,
                                                    (msg) => setProgress({ step: 'video', current: 0, total: 1, message: msg })
                                                )
                                                if (videoBlob) {
                                                    setVideo(currentProject.id, videoBlob)
                                                }
                                            } catch (e) {
                                                console.error('Re-render error:', e)
                                            }

                                            setIsReRendering(false)
                                            setProgress(null)
                                        }}
                                        disabled={isReRendering}
                                        className="w-full py-3 bg-indigo-100 text-indigo-700 font-semibold rounded-xl hover:bg-indigo-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {isReRendering ? (
                                            <>
                                                <HugeiconsIcon icon={Loading01Icon} className="w-5 h-5 animate-spin" />
                                                Re-rendering...
                                            </>
                                        ) : (
                                            <>
                                                <HugeiconsIcon icon={ArrowRight01Icon} className="w-5 h-5" />
                                                Apply & Re-render
                                            </>
                                        )}
                                    </button>

                                    {/* Download Button */}
                                    <button
                                        onClick={exportVideo}
                                        className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                                    >
                                        <HugeiconsIcon icon={FileDownloadIcon} className="w-5 h-5" />
                                        Download Video
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

/**
 * Create captions from Whisper transcription with word timings
 */
function createCaptionsFromTranscription(words: WordTiming[], scenes: { duration: number }[]): Caption[] {
    const captions: Caption[] = []
    let wordIndex = 0
    let sceneStartTime = 0

    for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i]
        const sceneEndTime = sceneStartTime + scene.duration

        // Collect words that fall within this scene's timeframe
        const sceneWords: WordTiming[] = []
        let captionText = ''

        while (wordIndex < words.length && words[wordIndex].start < sceneEndTime) {
            sceneWords.push(words[wordIndex])
            captionText += (captionText ? ' ' : '') + words[wordIndex].word
            wordIndex++
        }

        if (sceneWords.length > 0) {
            captions.push({
                id: `caption-${i}`,
                startTime: sceneStartTime,
                endTime: sceneEndTime,
                text: captionText,
                words: sceneWords
            })
        }

        sceneStartTime = sceneEndTime
    }

    return captions
}
