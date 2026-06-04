import type { FlowConnectedValue } from '@/lib/flowEditor/flowDataflow'
import { inferMediaKindFromResourceUrl } from '@/lib/graph/mediaUrlKind'

export type WidgetAutoRenderKind = 'text' | 'image' | 'video' | 'audio'

const RICH_MEDIA_OUTPUT_PATH = 'properties.output'
const RICH_MEDIA_OUTPUT_SRCDOC_PATH = 'properties.outputSrcDoc'
const RICH_MEDIA_IMAGE_PATH = 'properties.imageUrl'
const RICH_MEDIA_VIDEO_PATH = 'properties.videoUrl'
const RICH_MEDIA_AUDIO_PATH = 'properties.audioUrl'

function cleanToken(value: unknown): string {
  return String(value || '').trim().toLowerCase()
}

function inferKindFromPortLikeToken(value: unknown): WidgetAutoRenderKind | null {
  const token = cleanToken(value)
  if (!token) return null
  if (token.includes('imageurl') || token === 'image' || token.endsWith('_image') || token.endsWith(':image')) return 'image'
  if (token.includes('videourl') || token === 'video' || token.endsWith('_video') || token.endsWith(':video')) return 'video'
  if (token.includes('audiourl') || token === 'audio' || token.endsWith('_audio') || token.endsWith(':audio')) return 'audio'
  if (
    token.includes('outputsrcdoc')
    || token.includes('srcdoc')
    || token.includes('text')
    || token.includes('markdown')
    || token.includes('textarea')
    || token.includes('html')
    || token.includes('string')
    || token.includes('output')
  ) {
    return 'text'
  }
  return null
}

function inferKindFromValue(value: unknown): WidgetAutoRenderKind | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const inferred = inferMediaKindFromResourceUrl(trimmed)
  if (inferred === 'image' || inferred === 'svg') return 'image'
  if (inferred === 'video') return 'video'
  if (inferred === 'audio') return 'audio'
  return null
}

function normalizeSchemaPath(schemaPath: unknown): string {
  const raw = String(schemaPath || '').trim()
  if (!raw) return ''
  if (raw.startsWith('properties.') || raw.startsWith('metadata.') || raw === 'label' || raw === 'type') return raw
  return `properties.${raw}`
}

export function inferWidgetAutoRenderKind(args: {
  connectedValue?: FlowConnectedValue | null
  schemaPath?: unknown
  portKey?: unknown
  hintTokens?: ReadonlyArray<unknown>
}): WidgetAutoRenderKind | null {
  const connectedSources = Array.isArray(args.connectedValue?.sources) ? args.connectedValue!.sources : []
  for (let i = 0; i < connectedSources.length; i += 1) {
    const fromSourcePort = inferKindFromPortLikeToken(connectedSources[i]?.portKey)
    if (fromSourcePort) return fromSourcePort
  }

  const fromValue = inferKindFromValue(args.connectedValue?.value)
  if (fromValue) return fromValue

  const hintTokens = Array.isArray(args.hintTokens) ? args.hintTokens : []
  for (let i = 0; i < hintTokens.length; i += 1) {
    const fromHint = inferKindFromPortLikeToken(hintTokens[i])
    if (fromHint) return fromHint
  }

  const fromPortKey = inferKindFromPortLikeToken(args.portKey)
  if (fromPortKey) return fromPortKey

  const fromSchemaPath = inferKindFromPortLikeToken(args.schemaPath)
  if (fromSchemaPath) return fromSchemaPath

  return null
}

export function resolveRichMediaConnectedRenderSchemaPath(args: {
  schemaPath: string
  connectedValue?: FlowConnectedValue | null
}): string {
  const normalizedPath = normalizeSchemaPath(args.schemaPath)
  if (!normalizedPath) return ''
  if (
    normalizedPath === RICH_MEDIA_IMAGE_PATH
    || normalizedPath === RICH_MEDIA_VIDEO_PATH
    || normalizedPath === RICH_MEDIA_AUDIO_PATH
    || normalizedPath === RICH_MEDIA_OUTPUT_SRCDOC_PATH
  ) {
    return normalizedPath
  }
  const inferredKind = inferWidgetAutoRenderKind({
    connectedValue: args.connectedValue,
    schemaPath: normalizedPath,
  })
  if (inferredKind === 'image') return RICH_MEDIA_IMAGE_PATH
  if (inferredKind === 'video') return RICH_MEDIA_VIDEO_PATH
  if (inferredKind === 'audio') return RICH_MEDIA_AUDIO_PATH
  if (inferredKind === 'text') return RICH_MEDIA_OUTPUT_PATH
  const connectedSources = Array.isArray(args.connectedValue?.sources) ? args.connectedValue!.sources : []
  for (let i = 0; i < connectedSources.length; i += 1) {
    const portKey = cleanToken(connectedSources[i]?.portKey)
    if (portKey.includes('outputsrcdoc') || portKey.includes('srcdoc')) return RICH_MEDIA_OUTPUT_SRCDOC_PATH
  }
  return normalizedPath || RICH_MEDIA_OUTPUT_PATH
}
