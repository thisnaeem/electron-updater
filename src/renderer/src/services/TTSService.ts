/**
 * TTSService - Text-to-Speech using TTSFM API (OpenAI-compatible)
 * Based on TTSFM docs: https://github.com/dbcc/ttsfm
 */

const CORS_PROXY = 'https://corsproxy.io/?'

export interface TTSVoice {
  id: string
  name: string
}

export class TTSService {
  private baseUrl: string
  private maxChunkLength = 4000 // TTSFM has 4096 limit

  constructor() {
    // TTSFM public API - using OpenAI-compatible endpoint
    this.baseUrl = 'https://ttsfm.cohook.com'
  }

  /**
   * Get available voices
   */
  getVoices(): TTSVoice[] {
    // TTSFM supports these 6 voices
    return [
      { id: 'alloy', name: 'Alloy' },
      { id: 'echo', name: 'Echo' },
      { id: 'fable', name: 'Fable' },
      { id: 'onyx', name: 'Onyx' },
      { id: 'nova', name: 'Nova' },
      { id: 'shimmer', name: 'Shimmer' }
    ]
  }

  /**
   * Split text into chunks respecting sentence boundaries
   */
  private splitText(text: string): string[] {
    const chunks: string[] = []
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]

    let currentChunk = ''

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > this.maxChunkLength) {
        if (currentChunk) {
          chunks.push(currentChunk.trim())
        }
        currentChunk = sentence
      } else {
        currentChunk += sentence
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim())
    }

    return chunks.length > 0 ? chunks : [text]
  }

  /**
   * Generate speech from text using TTSFM OpenAI-compatible endpoint
   */
  async generateSpeech(
    text: string,
    voice: string = 'nova',
    onProgress?: (current: number, total: number) => void
  ): Promise<Blob | null> {
    try {
      const chunks = this.splitText(text)
      const audioChunks: ArrayBuffer[] = []

      for (let i = 0; i < chunks.length; i++) {
        onProgress?.(i + 1, chunks.length)

        // Use OpenAI-compatible endpoint with CORS proxy
        const targetUrl = `${this.baseUrl}/v1/audio/speech`
        const url = `${CORS_PROXY}${encodeURIComponent(targetUrl)}`

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'tts-1',
            input: chunks[i],
            voice: voice,
            response_format: 'mp3'
          })
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error('TTS failed:', response.status, errorText)
          continue
        }

        const arrayBuffer = await response.arrayBuffer()
        
        if (arrayBuffer.byteLength > 0) {
          audioChunks.push(arrayBuffer)
        }
      }

      if (audioChunks.length === 0) {
        console.error('No audio chunks generated')
        return null
      }

      // Combine audio chunks
      const totalLength = audioChunks.reduce((acc, chunk) => acc + chunk.byteLength, 0)
      const combined = new Uint8Array(totalLength)
      let offset = 0

      for (const chunk of audioChunks) {
        combined.set(new Uint8Array(chunk), offset)
        offset += chunk.byteLength
      }

      return new Blob([combined], { type: 'audio/mpeg' })
    } catch (error) {
      console.error('TTS error:', error)
      return null
    }
  }

  /**
   * Generate speech for multiple scenes
   */
  async generateSpeechForScenes(
    scenes: Array<{ text: string }>,
    voice: string = 'nova',
    onProgress?: (current: number, total: number, message: string) => void
  ): Promise<Blob | null> {
    const allText = scenes.map((s) => s.text).join('\n\n')

    onProgress?.(0, 1, 'Preparing audio generation...')

    return this.generateSpeech(allText, voice, (current, total) => {
      onProgress?.(current, total, `Generating audio chunk ${current}/${total}...`)
    })
  }
}

export const ttsService = new TTSService()
