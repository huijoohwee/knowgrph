import type { MediaLightboxPromptParameters } from '@/lib/ui/MediaLightbox'

export type ProceduralMediaKind = 'image' | 'audio' | 'video'

export type ProceduralMediaSettings = {
  aspectRatio: string
  durationSeconds: number
  kind: ProceduralMediaKind
  prompt: string
  resolution: string
}

export type ProceduralMediaArtifact = ProceduralMediaSettings & {
  blob: Blob
  contentType: string
  engineId: typeof PROCEDURAL_MEDIA_ENGINE_ID
  fileName: string
  frameRate: number
  height: number
  id: string
  seed: number
  sizeBytes: number
  width: number
}

export const PROCEDURAL_MEDIA_ENGINE_ID = 'browser-native-procedural' as const

const DEFAULT_PROMPT = 'procedural media'
const DEFAULT_DURATION_SECONDS = 4
const VIDEO_FRAME_RATE = 30
const AUDIO_SAMPLE_RATE = 48000
const AUDIO_CHANNEL_COUNT = 2

const cleanInline = (value: unknown): string => String(value || '').replace(/\s+/g, ' ').trim()

const clampNumber = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

const hashStringToSeed = (value: string): number => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const seededUnit = (seed: number, offset: number): number => {
  let value = seed + Math.imul(offset + 1, 0x9e3779b1)
  value ^= value << 13
  value ^= value >>> 17
  value ^= value << 5
  return ((value >>> 0) % 10000) / 10000
}

const readMediaKind = (value: unknown): ProceduralMediaKind => {
  const kind = cleanInline(value).toLowerCase()
  return kind === 'image' || kind === 'audio' || kind === 'video' ? kind : 'video'
}

const readDurationSeconds = (value: unknown): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? clampNumber(parsed, 1, 12) : DEFAULT_DURATION_SECONDS
}

const sanitizeFileStem = (value: unknown): string => {
  const clean = cleanInline(value).replace(/\.[a-z0-9]+$/i, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase()
  return clean.slice(0, 48) || 'procedural-media'
}

const resolveAspectPair = (aspectRatio: string): [number, number] => {
  const value = cleanInline(aspectRatio).toLowerCase()
  if (value === 'portrait' || value === '9:16') return [9, 16]
  if (value === 'square' || value === '1:1') return [1, 1]
  if (value === '3:4') return [3, 4]
  if (value === '4:3') return [4, 3]
  return [16, 9]
}

const resolveLongEdge = (resolution: string): number => {
  const value = cleanInline(resolution).toLowerCase()
  if (value === '2k') return 2048
  if (value === '1080p') return 1920
  return 1280
}

const resolveDimensions = (settings: Pick<ProceduralMediaSettings, 'aspectRatio' | 'kind' | 'resolution'>): { width: number; height: number } => {
  if (settings.kind === 'audio') return { width: 0, height: 0 }
  const [aspectWidth, aspectHeight] = resolveAspectPair(settings.aspectRatio)
  const longEdge = resolveLongEdge(settings.resolution)
  const landscape = aspectWidth >= aspectHeight
  const width = landscape ? longEdge : Math.round((longEdge * aspectWidth) / aspectHeight)
  const height = landscape ? Math.round((longEdge * aspectHeight) / aspectWidth) : longEdge
  return { width: Math.max(1, width), height: Math.max(1, height) }
}

const createCanvas = (width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> => new Promise((resolve, reject) => {
  canvas.toBlob(blob => {
    if (blob) {
      resolve(blob)
      return
    }
    reject(new Error('Canvas export failed'))
  }, type, quality)
})

const drawProceduralFrame = (ctx: CanvasRenderingContext2D, settings: ProceduralMediaSettings & { height: number; seed: number; width: number }, timeSeconds: number): void => {
  const width = settings.width
  const height = settings.height
  const progress = settings.durationSeconds > 0 ? timeSeconds / settings.durationSeconds : 0
  const baseHue = Math.floor(seededUnit(settings.seed, 1) * 360)
  const accentHue = (baseHue + 90 + Math.floor(seededUnit(settings.seed, 2) * 120)) % 360
  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, `hsl(${baseHue}, 72%, 16%)`)
  gradient.addColorStop(0.55, `hsl(${accentHue}, 62%, 28%)`)
  gradient.addColorStop(1, `hsl(${(baseHue + 210) % 360}, 74%, 12%)`)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  const bandCount = 8
  for (let index = 0; index < bandCount; index += 1) {
    const phase = seededUnit(settings.seed, index + 20) * Math.PI * 2
    const y = height * ((index + 0.5) / bandCount)
    const amplitude = height * (0.04 + seededUnit(settings.seed, index + 40) * 0.08)
    ctx.beginPath()
    for (let x = 0; x <= width; x += Math.max(8, width / 160)) {
      const t = x / width
      const wave = Math.sin(t * Math.PI * 2 * (1.5 + index * 0.2) + phase + progress * Math.PI * 2)
      const yy = y + wave * amplitude
      if (x === 0) ctx.moveTo(x, yy)
      else ctx.lineTo(x, yy)
    }
    ctx.strokeStyle = `hsla(${(baseHue + index * 24) % 360}, 85%, ${55 + index}%, 0.32)`
    ctx.lineWidth = Math.max(2, width * 0.004)
    ctx.stroke()
  }
  const particleCount = 28
  for (let index = 0; index < particleCount; index += 1) {
    const orbit = seededUnit(settings.seed, index + 70)
    const radius = Math.min(width, height) * (0.05 + seededUnit(settings.seed, index + 90) * 0.19)
    const cx = width * (0.5 + Math.cos(progress * Math.PI * 2 + orbit * 6.28) * 0.18)
    const cy = height * (0.5 + Math.sin(progress * Math.PI * 2 + orbit * 6.28) * 0.22)
    const angle = progress * Math.PI * 2 * (0.3 + orbit) + seededUnit(settings.seed, index + 110) * Math.PI * 2
    const x = cx + Math.cos(angle) * radius
    const y = cy + Math.sin(angle) * radius
    const size = Math.max(4, Math.min(width, height) * (0.008 + seededUnit(settings.seed, index + 130) * 0.018))
    ctx.beginPath()
    ctx.arc(x, y, size, 0, Math.PI * 2)
    ctx.fillStyle = `hsla(${(accentHue + index * 17) % 360}, 90%, 62%, 0.58)`
    ctx.fill()
  }
  ctx.restore()
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  ctx.fillRect(0, height - Math.max(2, height * 0.012), width * clampNumber(progress, 0, 1), Math.max(2, height * 0.012))
}

const encodeWav = (channels: Float32Array[], sampleRate: number): Blob => {
  const sampleCount = channels[0]?.length || 0
  const blockAlign = AUDIO_CHANNEL_COUNT * 2
  const dataBytes = sampleCount * blockAlign
  const buffer = new ArrayBuffer(44 + dataBytes)
  const view = new DataView(buffer)
  const writeString = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index))
  }
  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, AUDIO_CHANNEL_COUNT, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, dataBytes, true)
  let offset = 44
  for (let index = 0; index < sampleCount; index += 1) {
    for (let channelIndex = 0; channelIndex < AUDIO_CHANNEL_COUNT; channelIndex += 1) {
      const sample = clampNumber(channels[channelIndex]?.[index] || 0, -1, 1)
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

const generateAudioBlob = (settings: ProceduralMediaSettings, seed: number): Blob => {
  const sampleCount = Math.max(1, Math.floor(settings.durationSeconds * AUDIO_SAMPLE_RATE))
  const left = new Float32Array(sampleCount)
  const right = new Float32Array(sampleCount)
  const baseFrequency = 110 + Math.floor(seededUnit(seed, 150) * 220)
  const chord = [1, 1.25, 1.5, 2]
  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / AUDIO_SAMPLE_RATE
    const progress = time / settings.durationSeconds
    const envelope = Math.sin(Math.PI * clampNumber(progress, 0, 1))
    const phraseIndex = Math.floor(progress * chord.length * 2) % chord.length
    const frequency = baseFrequency * chord[phraseIndex]
    const shimmer = Math.sin(time * Math.PI * 2 * (frequency * 2 + 13)) * 0.11
    const sample = (Math.sin(time * Math.PI * 2 * frequency) * 0.34 + shimmer) * envelope
    const pan = Math.sin(progress * Math.PI * 2)
    left[index] = sample * (0.7 - pan * 0.18)
    right[index] = sample * (0.7 + pan * 0.18)
  }
  return encodeWav([left, right], AUDIO_SAMPLE_RATE)
}

const pickRecorderMimeType = (): string => {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ]
  return candidates.find(candidate => MediaRecorder.isTypeSupported(candidate)) || ''
}

const startProceduralAudioNodes = (audioContext: AudioContext, destination: MediaStreamAudioDestinationNode, seed: number, durationSeconds: number): void => {
  const now = audioContext.currentTime
  const baseFrequency = 140 + seededUnit(seed, 200) * 180
  const intervals = [1, 1.25, 1.5]
  for (let index = 0; index < intervals.length; index += 1) {
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()
    oscillator.type = index === 0 ? 'sine' : 'triangle'
    oscillator.frequency.setValueAtTime(baseFrequency * intervals[index], now)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.045 / (index + 1), now + 0.05)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSeconds)
    oscillator.connect(gain)
    gain.connect(destination)
    oscillator.start(now)
    oscillator.stop(now + durationSeconds + 0.05)
  }
}

const waitForProceduralVideoFrame = (): Promise<void> => new Promise(resolve => {
  let done = false
  const finish = () => {
    if (done) return
    done = true
    window.clearTimeout(timeoutId)
    resolve()
  }
  const timeoutId = window.setTimeout(finish, Math.ceil(1000 / VIDEO_FRAME_RATE))
  window.requestAnimationFrame(finish)
})

async function generateVideoBlob(settings: ProceduralMediaSettings, seed: number, width: number, height: number): Promise<{ blob: Blob; contentType: string }> {
  if (typeof MediaRecorder === 'undefined') throw new Error('Browser video recording is unavailable')
  const mimeType = pickRecorderMimeType()
  const canvas = createCanvas(width, height)
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) throw new Error('Canvas 2D context is unavailable')
  const stream = canvas.captureStream(VIDEO_FRAME_RATE)
  const audioContext = new AudioContext({ sampleRate: AUDIO_SAMPLE_RATE })
  const audioDestination = audioContext.createMediaStreamDestination()
  startProceduralAudioNodes(audioContext, audioDestination, seed, settings.durationSeconds)
  for (const track of audioDestination.stream.getAudioTracks()) stream.addTrack(track)
  const chunks: BlobPart[] = []
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
  const stopped = new Promise<void>((resolve, reject) => {
    const stopTimeoutId = window.setTimeout(resolve, 4000)
    recorder.ondataavailable = event => {
      if (event.data?.size) chunks.push(event.data)
    }
    recorder.onerror = () => reject(new Error('Browser video recording failed'))
    recorder.onstop = () => {
      window.clearTimeout(stopTimeoutId)
      resolve()
    }
  })
  const startedAt = performance.now()
  recorder.start(250)
  void audioContext.resume().catch(() => undefined)
  while (performance.now() - startedAt < settings.durationSeconds * 1000) {
    const elapsedSeconds = (performance.now() - startedAt) / 1000
    drawProceduralFrame(context, { ...settings, height, seed, width }, elapsedSeconds)
    await waitForProceduralVideoFrame()
  }
  drawProceduralFrame(context, { ...settings, height, seed, width }, settings.durationSeconds)
  recorder.stop()
  await stopped
  stream.getTracks().forEach(track => track.stop())
  await audioContext.close().catch(() => undefined)
  const contentType = mimeType.split(';')[0] || 'video/webm'
  return { blob: new Blob(chunks, { type: contentType }), contentType }
}

export function readProceduralMediaGenerationSettings(promptRaw: string, parameters?: MediaLightboxPromptParameters): ProceduralMediaSettings {
  const prompt = cleanInline(promptRaw) || DEFAULT_PROMPT
  const kind = readMediaKind(parameters?.kind)
  return {
    aspectRatio: cleanInline(parameters?.aspectRatio) || (kind === 'image' ? 'landscape' : '16:9'),
    durationSeconds: kind === 'image' ? 0 : readDurationSeconds(parameters?.duration),
    kind,
    prompt,
    resolution: cleanInline(parameters?.resolution) || (kind === 'image' ? '2K' : '720p'),
  }
}

export async function generateProceduralMediaArtifact(settings: ProceduralMediaSettings): Promise<ProceduralMediaArtifact> {
  const seed = hashStringToSeed(`${settings.kind}:${settings.prompt}:${settings.aspectRatio}:${settings.resolution}:${settings.durationSeconds}`)
  const { width, height } = resolveDimensions(settings)
  let blob: Blob
  let contentType: string
  if (settings.kind === 'audio') {
    blob = generateAudioBlob(settings, seed)
    contentType = 'audio/wav'
  } else if (settings.kind === 'video') {
    const video = await generateVideoBlob(settings, seed, width, height)
    blob = video.blob
    contentType = video.contentType
  } else {
    const canvas = createCanvas(width, height)
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) throw new Error('Canvas 2D context is unavailable')
    drawProceduralFrame(context, { ...settings, durationSeconds: 1, height, seed, width }, 0.42)
    blob = await canvasToBlob(canvas, 'image/png')
    contentType = 'image/png'
  }
  const extension = settings.kind === 'audio' ? 'wav' : settings.kind === 'video' ? 'webm' : 'png'
  const id = `${settings.kind}-${seed.toString(36)}`
  return {
    ...settings,
    blob,
    contentType,
    engineId: PROCEDURAL_MEDIA_ENGINE_ID,
    fileName: `${sanitizeFileStem(settings.prompt)}-${id}.${extension}`,
    frameRate: settings.kind === 'video' ? VIDEO_FRAME_RATE : 0,
    height,
    id,
    seed,
    sizeBytes: blob.size,
    width,
  }
}

export function buildProceduralMediaMarkdown(args: {
  artifact: ProceduralMediaArtifact
  url: string
}): string {
  const title = args.artifact.fileName.replace(/[\]\n\r]/g, ' ').trim() || 'Procedural media'
  const escapedTitle = title.replace(/"/g, '&quot;')
  const header = [
    '---',
    'kgCanvasRenderMode: "2d"',
    'kgCanvas2dRenderer: "media"',
    'kgDocumentSemanticMode: "document"',
    'kgFrontmatterModeEnabled: true',
    'kgProceduralMedia: true',
    `kgProceduralMediaEngine: "${PROCEDURAL_MEDIA_ENGINE_ID}"`,
    `kgProceduralMediaKind: "${args.artifact.kind}"`,
    `kgProceduralMediaSeed: ${args.artifact.seed}`,
    `kgProceduralMediaContentType: "${args.artifact.contentType}"`,
    `kgProceduralMediaByteSize: ${args.artifact.sizeBytes}`,
    '---',
    '',
    `# Procedural Media: ${title}`,
    '',
  ].join('\n')
  if (args.artifact.kind === 'image') return `${header}![${title}](${args.url})\n`
  if (args.artifact.kind === 'audio') return `${header}<audio src="${args.url}" title="${escapedTitle}" controls></audio>\n`
  return `${header}<video src="${args.url}" title="${escapedTitle}" controls></video>\n`
}
