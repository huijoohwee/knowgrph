import { buildYouTubeEmbedUrl } from 'grph-shared/rich-media/providers'

const readRuntimeOrigin = (): string => {
  const runtime = globalThis as {
    location?: { origin?: unknown }
    window?: { location?: { origin?: unknown } }
  }
  const origin = runtime.window?.location?.origin ?? runtime.location?.origin
  const value = typeof origin === 'string' ? origin.trim() : ''
  return value && value !== 'null' ? value : ''
}

export const buildVideoAgentSourcePlaybackUrl = (sourceUrl: string): string => (
  buildYouTubeEmbedUrl(sourceUrl, {
    includeOrigin: true,
    origin: readRuntimeOrigin(),
  }) || sourceUrl
)
