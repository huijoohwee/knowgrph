const FRAME_THUMBNAIL_TOKEN_PREFIX = 'kgthumb_'
const FRAME_SAMPLE_TOKEN_PREFIX = 'kgframes_'

export type MermaidGanttFrameSampleToken = {
  frameIndex?: number
  timestampSeconds: number
  url: string
}

const readBase64Host = (): {
  atob?: (value: string) => string
  btoa?: (value: string) => string
  Buffer?: {
    from: (value: string | Uint8Array, encoding?: BufferEncoding) => {
      toString: (encoding?: BufferEncoding) => string
    }
  }
} => globalThis as unknown as {
  atob?: (value: string) => string
  btoa?: (value: string) => string
  Buffer?: {
    from: (value: string | Uint8Array, encoding?: BufferEncoding) => {
      toString: (encoding?: BufferEncoding) => string
    }
  }
}

const encodeBase64Url = (value: string): string => {
  const bytes = new TextEncoder().encode(value)
  const host = readBase64Host()
  const base64 = typeof host.btoa === 'function'
    ? host.btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''))
    : host.Buffer?.from(bytes).toString('base64') || ''
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

const decodeBase64Url = (value: string): string => {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/')
  const padded = `${normalized}${'='.repeat((4 - normalized.length % 4) % 4)}`
  const host = readBase64Host()
  if (typeof host.atob === 'function') {
    const binary = host.atob(padded)
    return new TextDecoder().decode(Uint8Array.from(binary, char => char.charCodeAt(0)))
  }
  return host.Buffer?.from(padded, 'base64').toString('utf8') || ''
}

export const formatMermaidGanttFrameThumbnailToken = (thumbnailUrl: unknown): string => {
  const value = String(thumbnailUrl || '').trim()
  if (!value) return ''
  const encoded = encodeBase64Url(value)
  return encoded ? `${FRAME_THUMBNAIL_TOKEN_PREFIX}${encoded}` : ''
}

const readFrameSampleRecord = (value: unknown): MermaidGanttFrameSampleToken | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const url = String(record.url ?? record.frameImageUrl ?? record.thumbnailUrl ?? '').trim()
  const rawTimestamp = record.timestampSeconds ?? (Number(record.timestampMs) / 1000)
  const timestampSeconds = Number(rawTimestamp)
  if (!url || !Number.isFinite(timestampSeconds) || timestampSeconds < 0) return null
  const frameIndex = Number(record.frameIndex)
  return {
    ...(Number.isFinite(frameIndex) && frameIndex >= 0 ? { frameIndex: Math.round(frameIndex) } : {}),
    timestampSeconds: Number(timestampSeconds.toFixed(3)),
    url,
  }
}

export const formatMermaidGanttFrameSamplesToken = (frameSamples: unknown): string => {
  if (!Array.isArray(frameSamples)) return ''
  const uniqueKeys = new Set<string>()
  const samples: Array<{ i?: number; t: number; u: string }> = []
  for (const item of frameSamples) {
    const sample = readFrameSampleRecord(item)
    if (!sample) continue
    const key = `${sample.timestampSeconds}:${sample.url}`
    if (uniqueKeys.has(key)) continue
    uniqueKeys.add(key)
    samples.push({
      ...(sample.frameIndex != null ? { i: sample.frameIndex } : {}),
      t: sample.timestampSeconds,
      u: sample.url,
    })
  }
  if (!samples.length) return ''
  const encoded = encodeBase64Url(JSON.stringify(samples))
  return encoded ? `${FRAME_SAMPLE_TOKEN_PREFIX}${encoded}` : ''
}

export const readMermaidGanttFrameThumbnailUrl = (line: string): string => {
  const tokens = String(line || '')
    .slice(Math.max(0, String(line || '').indexOf(':') + 1))
    .split(',')
    .map(token => token.trim())
    .filter(Boolean)
  const token = tokens.find(item => item.startsWith(FRAME_THUMBNAIL_TOKEN_PREFIX))
  if (!token) return ''
  try {
    return decodeBase64Url(token.slice(FRAME_THUMBNAIL_TOKEN_PREFIX.length)).trim()
  } catch {
    return ''
  }
}

export const readMermaidGanttFrameSamples = (line: string): readonly MermaidGanttFrameSampleToken[] => {
  const tokens = String(line || '')
    .slice(Math.max(0, String(line || '').indexOf(':') + 1))
    .split(',')
    .map(token => token.trim())
    .filter(Boolean)
  const token = tokens.find(item => item.startsWith(FRAME_SAMPLE_TOKEN_PREFIX))
  if (!token) return []
  try {
    const parsed = JSON.parse(decodeBase64Url(token.slice(FRAME_SAMPLE_TOKEN_PREFIX.length))) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null
      const record = item as Record<string, unknown>
      return readFrameSampleRecord({
        frameIndex: record.i ?? record.frameIndex,
        timestampSeconds: record.t ?? record.timestampSeconds,
        url: record.u ?? record.url,
      })
    }).filter((item): item is MermaidGanttFrameSampleToken => !!item)
  } catch {
    return []
  }
}
