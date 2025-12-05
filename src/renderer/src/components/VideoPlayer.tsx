/**
 * Custom Video Player - Premium OOP-level player component
 * Shows duration from the start, not just at the end
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
    PlayIcon,
    PauseIcon,
    VolumeHighIcon,
    VolumeMute01Icon,
    Maximize01Icon,
    Minimize01Icon,
    Forward01Icon,
    Backward01Icon,
    Download01Icon
} from '@hugeicons/core-free-icons'

interface VideoPlayerProps {
    src: string
    aspectRatio?: '16:9' | '9:16' | '1:1'
    title?: string
    onDownload?: () => void
}

export function VideoPlayer({ src, aspectRatio = '9:16', title, onDownload }: VideoPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const progressRef = useRef<HTMLDivElement>(null)

    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)
    const [volume, setVolume] = useState(1)
    const [isMuted, setIsMuted] = useState(false)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [showControls, setShowControls] = useState(true)
    const [isHovering, setIsHovering] = useState(false)

    const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Preload video to get duration immediately
    useEffect(() => {
        const video = videoRef.current
        if (!video) return

        // Force load metadata
        video.load()
    }, [src])

    // Handle play/pause
    const togglePlay = useCallback(() => {
        if (!videoRef.current) return

        if (isPlaying) {
            videoRef.current.pause()
        } else {
            videoRef.current.play()
        }
        setIsPlaying(!isPlaying)
    }, [isPlaying])

    // Handle video events
    useEffect(() => {
        const video = videoRef.current
        if (!video) return

        const updateDuration = () => {
            if (video.duration && !isNaN(video.duration) && isFinite(video.duration)) {
                setDuration(video.duration)
            }
        }

        const onPlay = () => setIsPlaying(true)
        const onPause = () => setIsPlaying(false)
        const onTimeUpdate = () => {
            setCurrentTime(video.currentTime)
            updateDuration() // Keep trying to get duration
        }
        const onLoadedMetadata = () => updateDuration()
        const onDurationChange = () => updateDuration()
        const onCanPlay = () => updateDuration()
        const onLoadedData = () => updateDuration()
        const onEnded = () => {
            setIsPlaying(false)
            video.currentTime = 0
        }

        video.addEventListener('play', onPlay)
        video.addEventListener('pause', onPause)
        video.addEventListener('timeupdate', onTimeUpdate)
        video.addEventListener('loadedmetadata', onLoadedMetadata)
        video.addEventListener('durationchange', onDurationChange)
        video.addEventListener('canplay', onCanPlay)
        video.addEventListener('loadeddata', onLoadedData)
        video.addEventListener('ended', onEnded)

        return () => {
            video.removeEventListener('play', onPlay)
            video.removeEventListener('pause', onPause)
            video.removeEventListener('timeupdate', onTimeUpdate)
            video.removeEventListener('loadedmetadata', onLoadedMetadata)
            video.removeEventListener('durationchange', onDurationChange)
            video.removeEventListener('canplay', onCanPlay)
            video.removeEventListener('loadeddata', onLoadedData)
            video.removeEventListener('ended', onEnded)
        }
    }, [])

    // Auto-hide controls
    useEffect(() => {
        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current)
        }

        if (!isHovering && isPlaying) {
            controlsTimeoutRef.current = setTimeout(() => {
                setShowControls(false)
            }, 3000)
        } else {
            setShowControls(true)
        }

        return () => {
            if (controlsTimeoutRef.current) {
                clearTimeout(controlsTimeoutRef.current)
            }
        }
    }, [isHovering, isPlaying])

    // Seek video
    const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!videoRef.current || !progressRef.current || duration <= 0) return

        const rect = progressRef.current.getBoundingClientRect()
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
        videoRef.current.currentTime = percent * duration
    }, [duration])

    // Skip forward/backward
    const skip = useCallback((seconds: number) => {
        if (!videoRef.current) return
        const newTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds))
        videoRef.current.currentTime = newTime
    }, [duration])

    // Toggle mute
    const toggleMute = useCallback(() => {
        if (!videoRef.current) return
        videoRef.current.muted = !isMuted
        setIsMuted(!isMuted)
    }, [isMuted])

    // Toggle fullscreen
    const toggleFullscreen = useCallback(() => {
        if (!containerRef.current) return

        if (!isFullscreen) {
            if (containerRef.current.requestFullscreen) {
                containerRef.current.requestFullscreen()
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen()
            }
        }
        setIsFullscreen(!isFullscreen)
    }, [isFullscreen])

    // Handle volume change
    const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseFloat(e.target.value)
        setVolume(newVolume)
        if (videoRef.current) {
            videoRef.current.volume = newVolume
            setIsMuted(newVolume === 0)
        }
    }, [])

    // Format time - Safe for NaN/undefined
    const formatTime = (seconds: number): string => {
        if (!seconds || isNaN(seconds) || !isFinite(seconds) || seconds < 0) {
            return '0:00'
        }
        const mins = Math.floor(seconds / 60)
        const secs = Math.floor(seconds % 60)
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    // Progress percentage
    const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0

    // Get aspect ratio style
    const getAspectStyle = () => {
        switch (aspectRatio) {
            case '16:9':
                return { aspectRatio: '16/9', maxWidth: '100%' }
            case '9:16':
                return { aspectRatio: '9/16', maxHeight: '65vh', maxWidth: '100%' }
            case '1:1':
                return { aspectRatio: '1/1', maxWidth: '400px' }
            default:
                return { aspectRatio: '9/16', maxHeight: '65vh' }
        }
    }

    return (
        <div
            ref={containerRef}
            className="relative bg-black rounded-2xl overflow-hidden shadow-2xl mx-auto"
            style={getAspectStyle()}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            onMouseMove={() => setShowControls(true)}
        >
            {/* Video Element - preload metadata */}
            <video
                ref={videoRef}
                src={src}
                className="w-full h-full object-contain bg-black"
                onClick={togglePlay}
                playsInline
                preload="metadata"
            />

            {/* Play/Pause Overlay */}
            {!isPlaying && (
                <button
                    onClick={togglePlay}
                    className="absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity"
                >
                    <div className="w-20 h-20 bg-white/90 rounded-full flex items-center justify-center shadow-xl transform hover:scale-110 transition-transform">
                        <HugeiconsIcon icon={PlayIcon} className="w-10 h-10 text-slate-900 ml-1" />
                    </div>
                </button>
            )}

            {/* Controls Overlay */}
            <div
                className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
            >
                {/* Title */}
                {title && (
                    <p className="text-white text-sm font-medium mb-3 truncate">{title}</p>
                )}

                {/* Progress Bar */}
                <div
                    ref={progressRef}
                    className="relative h-1.5 bg-white/30 rounded-full cursor-pointer mb-3 group"
                    onClick={handleSeek}
                >
                    <div
                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full transition-all"
                        style={{ width: `${progressPercent}%` }}
                    />
                    <div
                        className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ left: `calc(${progressPercent}% - 8px)` }}
                    />
                </div>

                {/* Controls Row */}
                <div className="flex items-center justify-between gap-3">
                    {/* Left Controls */}
                    <div className="flex items-center gap-1">
                        <button
                            onClick={togglePlay}
                            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <HugeiconsIcon
                                icon={isPlaying ? PauseIcon : PlayIcon}
                                className="w-5 h-5 text-white"
                            />
                        </button>

                        <button
                            onClick={() => skip(-10)}
                            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <HugeiconsIcon icon={Backward01Icon} className="w-4 h-4 text-white" />
                        </button>

                        <button
                            onClick={() => skip(10)}
                            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <HugeiconsIcon icon={Forward01Icon} className="w-4 h-4 text-white" />
                        </button>

                        <div className="flex items-center gap-1 group">
                            <button
                                onClick={toggleMute}
                                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                            >
                                <HugeiconsIcon
                                    icon={isMuted || volume === 0 ? VolumeMute01Icon : VolumeHighIcon}
                                    className="w-4 h-4 text-white"
                                />
                            </button>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                value={volume}
                                onChange={handleVolumeChange}
                                className="w-0 group-hover:w-16 transition-all duration-200 h-1 bg-white/30 rounded-full appearance-none cursor-pointer accent-white"
                            />
                        </div>

                        {/* Time Display - Always show both current and total */}
                        <span className="text-white text-xs font-mono ml-2 min-w-[70px]">
                            {formatTime(currentTime)} / {formatTime(duration)}
                        </span>
                    </div>

                    {/* Right Controls */}
                    <div className="flex items-center gap-1">
                        {onDownload && (
                            <button
                                onClick={onDownload}
                                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                            >
                                <HugeiconsIcon icon={Download01Icon} className="w-4 h-4 text-white" />
                            </button>
                        )}

                        <button
                            onClick={toggleFullscreen}
                            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <HugeiconsIcon
                                icon={isFullscreen ? Minimize01Icon : Maximize01Icon}
                                className="w-4 h-4 text-white"
                            />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
