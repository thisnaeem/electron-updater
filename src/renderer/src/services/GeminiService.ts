/**
 * GeminiService - Handles AI script generation using Google Gemini API
 */
import { GoogleGenAI, Type } from '@google/genai'
import type { Scene } from '../types'

export class GeminiService {
  private ai: GoogleGenAI

  constructor() {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY
    if (!apiKey) {
      throw new Error('VITE_GEMINI_API_KEY is not defined')
    }
    this.ai = new GoogleGenAI({ apiKey })
  }

  /**
   * Generate a script for a long-form video
   */
  async generateScript(
    topic: string,
    targetDurationMinutes: number,
    onProgress?: (message: string) => void,
    sceneCount?: number
  ): Promise<string> {
    onProgress?.('Starting script generation...')

    const wordsPerMinute = 150
    const targetWordCount = targetDurationMinutes * wordsPerMinute
    const targetSceneCount = sceneCount || Math.max(5, Math.ceil(targetDurationMinutes / 2))

    const prompt = `You are a professional video script writer. Create a detailed, engaging video script about:

TOPIC: ${topic}

REQUIREMENTS:
- Target length: approximately ${targetWordCount} words (for a ${targetDurationMinutes} minute video)
- Write in a conversational, engaging tone suitable for voiceover
- Include natural pauses marked with [PAUSE]
- Create exactly ${targetSceneCount} SCENES, each scene should be about 60-120 seconds of narration
- Each scene MUST start with [SCENE X] where X is the scene number
- After each scene heading, include IMAGE_PROMPT: with a detailed visual description
- The image prompts should be detailed and suitable for AI image generation
- Make the content educational, informative, and engaging
- Include interesting facts, examples, and explanations

STRICT FORMAT:
[SCENE 1]
IMAGE_PROMPT: A stunning detailed visual description here...

The narration text for scene 1 goes here...

[SCENE 2]
IMAGE_PROMPT: Another detailed visual description...

The narration text for scene 2 goes here...

Write the complete script now with exactly ${targetSceneCount} scenes:`

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt
      })

      if (!response.text) {
        throw new Error('No response from Gemini API')
      }

      onProgress?.('Script generation complete!')
      return response.text
    } catch (error: any) {
      console.error('Gemini API Error:', error)
      throw new Error(`Script generation failed: ${error.message || 'Unknown error'}`)
    }
  }

  /**
   * Parse script into individual scenes
   */
  parseScriptToScenes(script: string, maxScenes?: number): Scene[] {
    const scenes: Scene[] = []
    const sceneRegex = /\[SCENE\s*(\d+)\]\s*(?:IMAGE_PROMPT:|Image[_ ]?Prompt:?)\s*(.+?)(?:\n|\r\n)([\s\S]*?)(?=\[SCENE|\[END\]|$)/gi

    let match
    let index = 0

    while ((match = sceneRegex.exec(script)) !== null) {
      const sceneNumber = parseInt(match[1])
      const imagePrompt = match[2].trim()
      const text = match[3].trim().replace(/\[PAUSE\]/g, '').trim()

      // Estimate duration based on word count (150 words per minute)
      const wordCount = text.split(/\s+/).length
      const duration = Math.max(10, Math.ceil((wordCount / 150) * 60))

      scenes.push({
        id: `scene-${sceneNumber}`,
        index: index++,
        text,
        imagePrompt,
        duration
      })
    }

    // If no scenes found with the regex, create a single scene
    if (scenes.length === 0 && script.trim()) {
      scenes.push({
        id: 'scene-1',
        index: 0,
        text: script.trim(),
        imagePrompt: 'A beautiful, cinematic scene representing the topic, detailed illustration, 8k quality',
        duration: 60
      })
    }

    return scenes
  }

  /**
   * Analyze script and generate scene breakdowns using structured output
   */
  async analyzeScript(scriptText: string, targetSceneCount: number = 5): Promise<Scene[]> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: `
          Analyze the following story script. Break it down into exactly ${targetSceneCount} distinct visual scenes.
          For each scene, provide a highly detailed, cinematic visual prompt suitable for an AI image generator.
          Also provide the narration text.
          
          Script:
          "${scriptText}"
        `,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              scenes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    sceneNumber: { type: Type.INTEGER },
                    visualDescription: {
                      type: Type.STRING,
                      description: 'Detailed visual prompt for AI image generation'
                    },
                    narration: { type: Type.STRING, description: 'The narration text for this scene' }
                  },
                  required: ['sceneNumber', 'visualDescription', 'narration']
                }
              }
            }
          }
        }
      })

      if (!response.text) {
        throw new Error('Failed to analyze script')
      }

      const result = JSON.parse(response.text)

      return result.scenes.map((scene: any, index: number) => ({
        id: `scene-${scene.sceneNumber}`,
        index,
        text: scene.narration,
        imagePrompt: scene.visualDescription,
        duration: Math.max(10, Math.ceil((scene.narration.split(/\s+/).length / 150) * 60))
      }))
    } catch (error: any) {
      console.error('Error analyzing script:', error)
      throw error
    }
  }
}

export const geminiService = new GeminiService()
