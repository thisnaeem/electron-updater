/**
 * VideoComposer - OOP-level video creation with SMART captions
 * Shows max 2 lines at a time with word-by-word animation
 */
import type { Scene, Caption, CaptionSettings, AspectRatio } from '../types'
import { ASPECT_RATIO_DIMS } from '../types'

export class VideoComposer {
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private aspectRatio: AspectRatio = '9:16'
  private width: number = 1080
  private height: number = 1920

  async load(aspectRatio: AspectRatio = '9:16'): Promise<void> {
    this.aspectRatio = aspectRatio
    const dims = ASPECT_RATIO_DIMS[aspectRatio]
    this.width = dims.width
    this.height = dims.height

    this.canvas = document.createElement('canvas')
    this.canvas.width = this.width
    this.canvas.height = this.height
    this.ctx = this.canvas.getContext('2d')
  }

  async composeVideo(
    scenes: Scene[],
    audioBlob: Blob,
    captions: Caption[],
    captionSettings: CaptionSettings,
    aspectRatio: AspectRatio,
    onProgress?: (message: string) => void
  ): Promise<Blob | null> {
    await this.load(aspectRatio)

    if (!this.canvas || !this.ctx) {
      throw new Error('Canvas not initialized')
    }

    try {
      onProgress?.('Loading images...')

      // Load all images
      const images: HTMLImageElement[] = []
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i]
        if (scene.imageUrl) {
          onProgress?.(`Loading image ${i + 1}/${scenes.length}...`)
          try {
            const img = await this.loadImage(scene.imageUrl)
            images.push(img)
          } catch {
            images.push(await this.createPlaceholder(i + 1))
          }
        } else {
          images.push(await this.createPlaceholder(i + 1))
        }
      }

      onProgress?.('Preparing audio...')

      const audio = document.createElement('audio')
      audio.src = URL.createObjectURL(audioBlob)
      audio.volume = 1
      
      await new Promise<void>((resolve) => {
        audio.onloadedmetadata = () => resolve()
        audio.onerror = () => resolve()
      })

      // Calculate scene timings
      const totalDuration = scenes.reduce((acc, s) => acc + s.duration, 0)
      const sceneTimings: { start: number; end: number; image: HTMLImageElement }[] = []
      let currentTime = 0

      for (let i = 0; i < scenes.length; i++) {
        sceneTimings.push({
          start: currentTime,
          end: currentTime + scenes[i].duration,
          image: images[i]
        })
        currentTime += scenes[i].duration
      }

      onProgress?.('Setting up recording...')

      const canvasStream = this.canvas.captureStream(30)
      const audioContext = new AudioContext()
      const audioSource = audioContext.createMediaElementSource(audio)
      const destination = audioContext.createMediaStreamDestination()
      audioSource.connect(destination)

      const audioTrack = destination.stream.getAudioTracks()[0]
      if (audioTrack) {
        canvasStream.addTrack(audioTrack)
      }

      const mediaRecorder = new MediaRecorder(canvasStream, {
        mimeType: 'video/webm;codecs=vp9,opus',
        videoBitsPerSecond: 8000000,
        audioBitsPerSecond: 128000
      })

      const chunks: Blob[] = []
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }

      onProgress?.('Recording video with audio...')

      mediaRecorder.start(100)
      audio.currentTime = 0
      await audio.play()

      const startTime = Date.now()
      let lastProgress = 0

      const animate = (): void => {
        const elapsed = (Date.now() - startTime) / 1000
        const progress = Math.min(elapsed / totalDuration, 1)

        const progressPercent = Math.floor(progress * 100)
        if (progressPercent > lastProgress + 4) {
          lastProgress = progressPercent
          onProgress?.(`Recording: ${progressPercent}%`)
        }

        const currentScene = sceneTimings.find(
          (s) => elapsed >= s.start && elapsed < s.end
        ) || sceneTimings[sceneTimings.length - 1]

        this.drawFrame(currentScene.image, captions, captionSettings, elapsed)

        if (elapsed < totalDuration) {
          requestAnimationFrame(animate)
        } else {
          audio.pause()
          mediaRecorder.stop()
        }
      }

      const videoBlob = await new Promise<Blob>((resolve) => {
        mediaRecorder.onstop = () => {
          onProgress?.('Finalizing video...')
          const blob = new Blob(chunks, { type: 'video/webm' })
          resolve(blob)
        }
        animate()
      })

      audioContext.close()
      URL.revokeObjectURL(audio.src)

      onProgress?.('Video ready!')
      return videoBlob
    } catch (error) {
      console.error('Video composition error:', error)
      onProgress?.(`Error: ${error}`)
      return null
    }
  }

  private drawFrame(
    image: HTMLImageElement,
    captions: Caption[],
    settings: CaptionSettings,
    currentTime: number
  ): void {
    if (!this.ctx) return

    const ctx = this.ctx

    // Black background
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, this.width, this.height)

    // Draw image
    this.drawImageCover(ctx, image)

    // Find current caption
    const caption = captions.find((c) => currentTime >= c.startTime && currentTime < c.endTime)
    if (!caption) return

    // Draw caption - MAX 2 LINES with smart word selection
    switch (settings.template) {
      case 'karaoke':
        this.drawKaraokeCaption(ctx, caption, settings, currentTime)
        break
      case 'word-by-word':
        this.drawWordByWordCaption(ctx, caption, settings, currentTime)
        break
      case 'sentence':
        this.drawSentenceCaption(ctx, caption, settings, currentTime)
        break
      case 'minimal':
        this.drawMinimalCaption(ctx, caption, settings, currentTime)
        break
    }
  }

  private drawImageCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement): void {
    const imgAspect = image.width / image.height
    const canvasAspect = this.width / this.height

    let drawWidth, drawHeight, drawX, drawY

    if (imgAspect > canvasAspect) {
      drawHeight = this.height
      drawWidth = this.height * imgAspect
      drawX = (this.width - drawWidth) / 2
      drawY = 0
    } else {
      drawWidth = this.width
      drawHeight = this.width / imgAspect
      drawX = 0
      drawY = (this.height - drawHeight) / 2
    }

    ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight)
  }

  /**
   * KARAOKE STYLE: Show 2 lines max, current word highlighted
   * Words roll as they're spoken
   */
  private drawKaraokeCaption(
    ctx: CanvasRenderingContext2D,
    caption: Caption,
    settings: CaptionSettings,
    currentTime: number
  ): void {
    const fontSize = this.getFontSize(settings.fontSize)
    const y = this.getYPosition(settings.position)
    const padding = 20
    const lineHeight = fontSize * 1.3
    const maxWidth = this.width * 0.85

    ctx.font = `bold ${fontSize}px ${settings.fontFamily}, system-ui`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const words = caption.words || []
    if (words.length === 0) {
      this.drawSentenceCaption(ctx, caption, settings, currentTime)
      return
    }

    // Find current word index
    let currentWordIdx = -1
    for (let i = 0; i < words.length; i++) {
      if (currentTime >= words[i].start && currentTime < words[i].end) {
        currentWordIdx = i
        break
      }
    }
    if (currentWordIdx === -1) {
      for (let i = words.length - 1; i >= 0; i--) {
        if (currentTime >= words[i].end) {
          currentWordIdx = i
          break
        }
      }
    }

    // Get ~8-10 words around current word (for 2 lines)
    const wordsPerLine = 4
    const totalWordsToShow = wordsPerLine * 2
    
    let startIdx = Math.max(0, currentWordIdx - wordsPerLine + 1)
    let endIdx = Math.min(words.length, startIdx + totalWordsToShow)
    
    // Adjust if we're near the end
    if (endIdx === words.length && endIdx - startIdx < totalWordsToShow) {
      startIdx = Math.max(0, endIdx - totalWordsToShow)
    }

    const visibleWords = words.slice(startIdx, endIdx)
    
    // Split into 2 lines
    const line1Words = visibleWords.slice(0, Math.ceil(visibleWords.length / 2))
    const line2Words = visibleWords.slice(Math.ceil(visibleWords.length / 2))

    // Draw background for 2 lines
    const bgHeight = lineHeight * 2 + padding * 2
    ctx.fillStyle = settings.backgroundColor
    ctx.beginPath()
    ctx.roundRect(
      this.width / 2 - maxWidth / 2 - padding,
      y - bgHeight / 2,
      maxWidth + padding * 2,
      bgHeight,
      16
    )
    ctx.fill()

    // Draw line 1
    this.drawWordLine(ctx, line1Words, y - lineHeight / 2, currentWordIdx, startIdx, settings, fontSize)
    
    // Draw line 2
    if (line2Words.length > 0) {
      this.drawWordLine(ctx, line2Words, y + lineHeight / 2, currentWordIdx, startIdx + line1Words.length, settings, fontSize)
    }
  }

  private drawWordLine(
    ctx: CanvasRenderingContext2D,
    words: { word: string; start: number; end: number }[],
    y: number,
    currentWordIdx: number,
    lineStartIdx: number,
    settings: CaptionSettings,
    fontSize: number
  ): void {
    const lineText = words.map(w => w.word).join(' ')
    const textWidth = ctx.measureText(lineText).width
    let x = this.width / 2 - textWidth / 2

    words.forEach((word, i) => {
      const globalIdx = lineStartIdx + i
      const isCurrentWord = globalIdx === currentWordIdx
      const isPastWord = globalIdx < currentWordIdx
      const wordText = word.word
      const wordWidth = ctx.measureText(wordText).width

      if (isCurrentWord) {
        ctx.fillStyle = '#FFD700'
        ctx.shadowColor = '#FFD700'
        ctx.shadowBlur = 15
        ctx.font = `bold ${fontSize * 1.1}px ${settings.fontFamily}, system-ui`
      } else if (isPastWord) {
        ctx.fillStyle = settings.textColor
        ctx.shadowBlur = 0
        ctx.font = `bold ${fontSize}px ${settings.fontFamily}, system-ui`
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
        ctx.shadowBlur = 0
        ctx.font = `bold ${fontSize}px ${settings.fontFamily}, system-ui`
      }

      ctx.fillText(wordText, x + wordWidth / 2, y)
      ctx.shadowBlur = 0
      ctx.font = `bold ${fontSize}px ${settings.fontFamily}, system-ui`
      
      x += ctx.measureText(wordText + ' ').width
    })
  }

  /**
   * WORD BY WORD: Show ONE big word at a time
   */
  private drawWordByWordCaption(
    ctx: CanvasRenderingContext2D,
    caption: Caption,
    settings: CaptionSettings,
    currentTime: number
  ): void {
    const fontSize = this.getFontSize(settings.fontSize) * 2
    const y = this.getYPosition(settings.position)

    ctx.font = `bold ${fontSize}px ${settings.fontFamily}, system-ui`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    let currentWord = ''
    if (caption.words && caption.words.length > 0) {
      const word = caption.words.find(w => currentTime >= w.start && currentTime < w.end)
      if (word) {
        currentWord = word.word.toUpperCase()
      }
    } else {
      const words = caption.text.split(/\s+/)
      const progress = (currentTime - caption.startTime) / (caption.endTime - caption.startTime)
      const wordIdx = Math.floor(progress * words.length)
      currentWord = (words[Math.min(wordIdx, words.length - 1)] || '').toUpperCase()
    }

    if (!currentWord) return

    // Draw with strong shadow
    ctx.fillStyle = settings.textColor
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)'
    ctx.shadowBlur = 30
    ctx.shadowOffsetY = 5

    ctx.fillText(currentWord, this.width / 2, y)
    ctx.shadowBlur = 0
  }

  /**
   * SENTENCE: Show max 2 lines of current sentence portion
   */
  private drawSentenceCaption(
    ctx: CanvasRenderingContext2D,
    caption: Caption,
    settings: CaptionSettings,
    currentTime: number
  ): void {
    const fontSize = this.getFontSize(settings.fontSize)
    const y = this.getYPosition(settings.position)
    const padding = 20
    const maxWidth = this.width * 0.85
    const lineHeight = fontSize * 1.3

    ctx.font = `bold ${fontSize}px ${settings.fontFamily}, system-ui`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // Get portion of text based on time progress
    const words = caption.text.split(' ')
    const progress = (currentTime - caption.startTime) / (caption.endTime - caption.startTime)
    const endWordIdx = Math.min(words.length, Math.ceil(progress * words.length) + 4)
    const startWordIdx = Math.max(0, endWordIdx - 8)
    
    const visibleText = words.slice(startWordIdx, endWordIdx).join(' ')

    // Wrap to max 2 lines
    const lines: string[] = []
    let currentLine = ''

    for (const word of visibleText.split(' ')) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word
      if (ctx.measureText(testLine).width > maxWidth && currentLine) {
        lines.push(currentLine)
        currentLine = word
        if (lines.length >= 2) break
      } else {
        currentLine = testLine
      }
    }
    if (currentLine && lines.length < 2) lines.push(currentLine)

    // Draw background
    const bgHeight = lines.length * lineHeight + padding * 2
    ctx.fillStyle = settings.backgroundColor
    ctx.beginPath()
    ctx.roundRect(
      (this.width - maxWidth) / 2 - padding,
      y - bgHeight / 2,
      maxWidth + padding * 2,
      bgHeight,
      16
    )
    ctx.fill()

    // Draw text
    ctx.fillStyle = settings.textColor
    lines.forEach((line, i) => {
      const lineY = y - (lines.length - 1) * lineHeight / 2 + i * lineHeight
      ctx.fillText(line, this.width / 2, lineY)
    })
  }

  /**
   * MINIMAL: Small text, max 1 line
   */
  private drawMinimalCaption(
    ctx: CanvasRenderingContext2D,
    caption: Caption,
    settings: CaptionSettings,
    currentTime: number
  ): void {
    const fontSize = this.getFontSize('small')
    const y = this.height - 80

    ctx.font = `500 ${fontSize}px ${settings.fontFamily}, system-ui`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
    ctx.shadowBlur = 10

    // Show current portion
    const words = caption.text.split(' ')
    const progress = (currentTime - caption.startTime) / (caption.endTime - caption.startTime)
    const endIdx = Math.min(words.length, Math.ceil(progress * words.length) + 3)
    const startIdx = Math.max(0, endIdx - 6)
    
    const text = words.slice(startIdx, endIdx).join(' ')
    ctx.fillText(text.slice(0, 50), this.width / 2, y)
    ctx.shadowBlur = 0
  }

  private getFontSize(size: 'small' | 'medium' | 'large'): number {
    const baseSize = Math.min(this.width, this.height) / 18
    
    switch (size) {
      case 'small': return baseSize * 0.7
      case 'medium': return baseSize
      case 'large': return baseSize * 1.3
    }
  }

  private getYPosition(position: 'top' | 'center' | 'bottom'): number {
    switch (position) {
      case 'top': return this.height * 0.12
      case 'center': return this.height * 0.5
      case 'bottom': return this.height * 0.82
    }
  }

  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = url
    })
  }

  private createPlaceholder(sceneNum: number): Promise<HTMLImageElement> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas')
      canvas.width = this.width
      canvas.height = this.height
      const ctx = canvas.getContext('2d')!

      const gradient = ctx.createLinearGradient(0, 0, this.width, this.height)
      gradient.addColorStop(0, '#0ea5e9')
      gradient.addColorStop(1, '#6366f1')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, this.width, this.height)

      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
      ctx.font = `bold ${Math.min(this.width, this.height) / 4}px system-ui`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(`${sceneNum}`, this.width / 2, this.height / 2)

      const img = new Image()
      img.onload = () => resolve(img)
      img.src = canvas.toDataURL()
    })
  }
}

export const videoComposer = new VideoComposer()
