/**
 * Project Store - State management with Zustand
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Project, Scene, Caption, GenerationProgress, ProjectStatus, CaptionSettings, AspectRatio } from '../types'
import { DEFAULT_CAPTION_SETTINGS } from '../types'

interface ProjectState {
  projects: Project[]
  currentProject: Project | null
  isGenerating: boolean
  progress: GenerationProgress | null

  // Actions
  createProject: (name: string, topic: string, sceneCount: number, duration: number, aspectRatio: AspectRatio, captionSettings?: CaptionSettings) => Project
  updateProject: (id: string, updates: Partial<Project>) => void
  deleteProject: (id: string) => void
  setCurrentProject: (project: Project | null) => void
  setScenes: (projectId: string, scenes: Scene[]) => void
  updateScene: (projectId: string, sceneId: string, updates: Partial<Scene>) => void
  setAudio: (projectId: string, audioBlob: Blob) => void
  setCaptions: (projectId: string, captions: Caption[]) => void
  setVideo: (projectId: string, videoBlob: Blob) => void
  setProjectStatus: (projectId: string, status: ProjectStatus) => void
  setIsGenerating: (value: boolean) => void
  setProgress: (progress: GenerationProgress | null) => void
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      projects: [],
      currentProject: null,
      isGenerating: false,
      progress: null,

      createProject: (name, topic, sceneCount, duration, aspectRatio, captionSettings = DEFAULT_CAPTION_SETTINGS) => {
        const project: Project = {
          id: `project-${Date.now()}`,
          name,
          topic,
          sceneCount,
          targetDuration: duration,
          aspectRatio,
          script: undefined,
          scenes: [],
          audioBlob: undefined,
          audioUrl: undefined,
          captions: undefined,
          captionSettings,
          videoBlob: undefined,
          videoUrl: undefined,
          status: 'draft',
          createdAt: new Date(),
          updatedAt: new Date()
        }

        set((state) => ({
          projects: [project, ...state.projects],
          currentProject: project
        }))

        return project
      },

      updateProject: (id, updates) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, ...updates, updatedAt: new Date() } : p
          ),
          currentProject:
            state.currentProject?.id === id
              ? { ...state.currentProject, ...updates, updatedAt: new Date() }
              : state.currentProject
        }))
      },

      deleteProject: (id) => {
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
          currentProject: state.currentProject?.id === id ? null : state.currentProject
        }))
      },

      setCurrentProject: (project) => {
        set({ currentProject: project })
      },

      setScenes: (projectId, scenes) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, scenes, updatedAt: new Date() } : p
          ),
          currentProject:
            state.currentProject?.id === projectId
              ? { ...state.currentProject, scenes, updatedAt: new Date() }
              : state.currentProject
        }))
      },

      updateScene: (projectId, sceneId, updates) => {
        set((state) => {
          const updateScenes = (scenes: Scene[]) =>
            scenes.map((s) => (s.id === sceneId ? { ...s, ...updates } : s))

          return {
            projects: state.projects.map((p) =>
              p.id === projectId ? { ...p, scenes: updateScenes(p.scenes), updatedAt: new Date() } : p
            ),
            currentProject:
              state.currentProject?.id === projectId
                ? {
                    ...state.currentProject,
                    scenes: updateScenes(state.currentProject.scenes),
                    updatedAt: new Date()
                  }
                : state.currentProject
          }
        })
      },

      setAudio: (projectId, audioBlob) => {
        const audioUrl = URL.createObjectURL(audioBlob)
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, audioBlob, audioUrl, updatedAt: new Date() } : p
          ),
          currentProject:
            state.currentProject?.id === projectId
              ? { ...state.currentProject, audioBlob, audioUrl, updatedAt: new Date() }
              : state.currentProject
        }))
      },

      setCaptions: (projectId, captions) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, captions, updatedAt: new Date() } : p
          ),
          currentProject:
            state.currentProject?.id === projectId
              ? { ...state.currentProject, captions, updatedAt: new Date() }
              : state.currentProject
        }))
      },

      setVideo: (projectId, videoBlob) => {
        const videoUrl = URL.createObjectURL(videoBlob)
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, videoBlob, videoUrl, updatedAt: new Date() } : p
          ),
          currentProject:
            state.currentProject?.id === projectId
              ? { ...state.currentProject, videoBlob, videoUrl, updatedAt: new Date() }
              : state.currentProject
        }))
      },

      setProjectStatus: (projectId, status) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, status, updatedAt: new Date() } : p
          ),
          currentProject:
            state.currentProject?.id === projectId
              ? { ...state.currentProject, status, updatedAt: new Date() }
              : state.currentProject
        }))
      },

      setIsGenerating: (value) => {
        set({ isGenerating: value })
      },

      setProgress: (progress) => {
        set({ progress })
      }
    }),
    {
      name: 'autovid-projects',
      partialize: (state) => ({
        projects: state.projects.map((p) => ({
          ...p,
          audioBlob: undefined,
          audioUrl: undefined,
          videoBlob: undefined,
          videoUrl: undefined
        }))
      })
    }
  )
)
