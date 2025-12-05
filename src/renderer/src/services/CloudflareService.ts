/**
 * CloudflareService - Image generation with aspect ratio support and Whisper transcription
 */

const CORS_PROXY = 'https://corsproxy.io/?'

export class CloudflareService {
  private accountId: string
  private apiToken: string

  constructor() {
    this.accountId = import.meta.env.VITE_CLOUDFLARE_ACCOUNT_ID || ''
    this.apiToken = import.meta.env.VITE_CLOUDFLARE_API_TOKEN || ''
  }

  /**
   * Generate image at specific aspect ratio using FLUX model
   */
  async generateImage(prompt: string, aspectRatio: string = '9:16'): Promise<Blob | null> {
    if (!this.accountId || !this.apiToken) {
      console.error('Cloudflare credentials not configured')
      return null
    }

    try {
      const url = `${CORS_PROXY}https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`

      // Get dimensions based on aspect ratio
      const dimensions = this.getImageDimensions(aspectRatio)

      // Use FormData for FLUX model
      const formData = new FormData()
      formData.append('prompt', prompt)
      formData.append('num_steps', '4')
      formData.append('width', dimensions.width.toString())
      formData.append('height', dimensions.height.toString())

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`
        },
        body: formData
      })

      if (!response.ok) {
        // Fallback to JSON body
        const jsonResponse = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            prompt: prompt,
            num_steps: 4,
            width: dimensions.width,
            height: dimensions.height
          })
        })
        
        if (!jsonResponse.ok) {
          throw new Error(`Cloudflare API error: ${jsonResponse.status}`)
        }
        
        return await this.handleImageResponse(jsonResponse)
      }

      return await this.handleImageResponse(response)
    } catch (error) {
      console.error('Image generation error:', error)
      return null
    }
  }

  private async handleImageResponse(response: Response): Promise<Blob | null> {
    const contentType = response.headers.get('content-type') || ''
    
    if (contentType.includes('image')) {
      return await response.blob()
    }
    
    const data = await response.json()
    if (data.result?.image) {
      const binaryString = atob(data.result.image)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      return new Blob([bytes], { type: 'image/png' })
    }
    
    return null
  }

  private getImageDimensions(aspectRatio: string): { width: number; height: number } {
    // FLUX supports various sizes, using optimal sizes for each ratio
    switch (aspectRatio) {
      case '16:9':
        return { width: 1024, height: 576 }
      case '9:16':
        return { width: 576, height: 1024 }
      case '1:1':
        return { width: 1024, height: 1024 }
      default:
        return { width: 576, height: 1024 } // Default to 9:16
    }
  }

  /**
   * Transcribe audio using Whisper with multipart/form-data
   */
  async transcribeAudio(audioBlob: Blob): Promise<TranscriptionResult | null> {
    if (!this.accountId || !this.apiToken) {
      console.error('Cloudflare credentials not configured')
      return null
    }

    try {
      const url = `${CORS_PROXY}https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/@cf/openai/whisper`

      const formData = new FormData()
      formData.append('audio', audioBlob, 'audio.mp3')

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`
        },
        body: formData
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Whisper API error:', response.status, errorText)
        throw new Error(`Whisper API error: ${response.status}`)
      }

      const result = await response.json()
      console.log('Whisper result:', result)
      
      if (result.result) {
        return this.parseWhisperResult(result.result)
      }

      return null
    } catch (error) {
      console.error('Transcription error:', error)
      return null
    }
  }

  private parseWhisperResult(result: any): TranscriptionResult {
    const words: WordTiming[] = []
    const text = result.text || ''

    if (result.words && Array.isArray(result.words)) {
      for (const word of result.words) {
        words.push({
          word: word.word || word.text || '',
          start: word.start || 0,
          end: word.end || 0
        })
      }
    } else {
      const wordsArray = text.split(/\s+/).filter(Boolean)
      const totalDuration = result.duration || 10
      const avgDuration = totalDuration / Math.max(wordsArray.length, 1)
      
      let time = 0
      for (const word of wordsArray) {
        words.push({
          word,
          start: time,
          end: time + avgDuration
        })
        time += avgDuration
      }
    }

    return {
      text,
      words,
      duration: result.duration || (words.length > 0 ? words[words.length - 1].end : 0)
    }
  }
}

export interface WordTiming {
  word: string
  start: number
  end: number
}

export interface TranscriptionResult {
  text: string
  words: WordTiming[]
  duration: number
}

export const cloudflareService = new CloudflareService()
