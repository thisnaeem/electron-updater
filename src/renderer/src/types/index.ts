/**
 * AutoVid Types
 */

export type CaptionTemplate = 'karaoke' | 'word-by-word' | 'sentence' | 'minimal'
export type CaptionPosition = 'top' | 'center' | 'bottom'
export type AspectRatio = '16:9' | '9:16' | '1:1'

export interface CaptionSettings {
  template: CaptionTemplate
  position: CaptionPosition
  fontSize: 'small' | 'medium' | 'large'
  fontFamily: string
  textColor: string
  backgroundColor: string
}

export interface WordTiming {
  word: string
  start: number
  end: number
}

export interface Scene {
  id: string
  index: number
  text: string
  imagePrompt: string
  duration: number
  imageBlob?: Blob
  imageUrl?: string
}

export interface Caption {
  id: string
  startTime: number
  endTime: number
  text: string
  words?: WordTiming[]
}

export type ProjectStatus =
  | 'draft'
  | 'generating_script'
  | 'generating_images'
  | 'generating_audio'
  | 'generating_captions'
  | 'composing_video'
  | 'completed'
  | 'error'

export interface Project {
  id: string
  name: string
  topic: string
  sceneCount: number
  targetDuration: number
  aspectRatio: AspectRatio
  script?: string
  scenes: Scene[]
  audioBlob?: Blob
  audioUrl?: string
  captions?: Caption[]
  captionSettings: CaptionSettings
  videoBlob?: Blob
  videoUrl?: string
  status: ProjectStatus
  createdAt: Date
  updatedAt: Date
}

export interface GenerationProgress {
  step: string
  current: number
  total: number
  message: string
}

export interface Voice {
  id: string
  name: string
}

// Default caption settings
export const DEFAULT_CAPTION_SETTINGS: CaptionSettings = {
  template: 'karaoke',
  position: 'bottom',
  fontSize: 'large',
  fontFamily: 'Inter',
  textColor: '#ffffff',
  backgroundColor: 'rgba(0, 0, 0, 0.8)'
}

// Available fonts
export const CAPTION_FONTS = [
  'Inter',
  'Montserrat',
  'Poppins',
  'Oswald',
  'Bebas Neue'
]

// Aspect ratio dimensions for video
export const ASPECT_RATIO_DIMS: Record<AspectRatio, { width: number; height: number }> = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 }
}
