import type { GraphNode } from '@/lib/graph/types'
import type { FlowConnectedValuesBySchemaPath } from '@/lib/storyboardWidget/flowDataflow'

export const IMAGE_TO_THREEJS_SKILL_NODE_TYPE_ID = 'ImageToThreeJsSkill' as const
export const IMAGE_TO_THREEJS_SKILL_NODE_LABEL = 'Image to Three.js Skill' as const
export const IMAGE_TO_THREEJS_SKILL_WIDGET_TYPE_ID = 'default' as const
export const IMAGE_TO_THREEJS_SKILL_FORM_ID = 'imageToThreeJsSkill' as const
export const IMAGE_TO_THREEJS_RENDER_MODE = 'threejs' as const
export const IMAGE_TO_THREEJS_SCHEMA = 'knowgrph-image-to-threejs/v1' as const

export type ImageToThreeJsSourceKind = 'raster' | 'svg'
export type ImageToThreeJsRenderMode = typeof IMAGE_TO_THREEJS_RENDER_MODE

export type ImageToThreeJsManifest = {
  schema: typeof IMAGE_TO_THREEJS_SCHEMA
  source: {
    url: string
    kind: ImageToThreeJsSourceKind
    extension: 'jpg' | 'png' | 'svg'
  }
  render: {
    engine: 'three'
    primitive: 'shape-geometry' | 'textured-plane'
  }
  cost: {
    model: 'local-threejs'
    prompt_tokens: 0
    completion_tokens: 0
    cache_hits: 0
    estimated_cost_usd: 0
  }
}

export type ImageToThreeJsConversionResult =
  | { ok: true; manifest: ImageToThreeJsManifest; patch: Record<string, unknown> }
  | { ok: false; errorCode: 'missing-source' | 'unsupported-format'; reason: string }

const SUPPORTED_EXTENSION_PATTERN = /\.(png|jpe?g|svg)$/i
const SOURCE_PROPERTY_KEYS = ['sourceImageUrl', 'imageUrl', 'reference_image', 'media_url', 'mediaUrl', 'image'] as const
const SOURCE_SCHEMA_PATHS = SOURCE_PROPERTY_KEYS.map(key => `properties.${key}`)

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function unwrapScalar(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !('value' in value)) return value
  return (value as { value?: unknown }).value
}

function readExtension(url: string): 'jpg' | 'png' | 'svg' | null {
  const dataMime = url.match(/^data:image\/(png|jpeg|jpg|svg\+xml)(?:[;,])/i)?.[1]?.toLowerCase()
  if (dataMime === 'png') return 'png'
  if (dataMime === 'jpg' || dataMime === 'jpeg') return 'jpg'
  if (dataMime === 'svg+xml') return 'svg'
  try {
    const parsed = new URL(url, 'http://localhost')
    const pathname = parsed.pathname
    const match = pathname.match(SUPPORTED_EXTENSION_PATTERN)?.[1]?.toLowerCase()
    if (match === 'png') return 'png'
    if (match === 'jpg' || match === 'jpeg') return 'jpg'
    if (match === 'svg') return 'svg'
    for (const key of ['url', 'path', 'src']) {
      const nested = parsed.searchParams.get(key) || ''
      const nestedMatch = nested.split(/[?#]/, 1)[0]?.match(SUPPORTED_EXTENSION_PATTERN)?.[1]?.toLowerCase()
      if (nestedMatch === 'png') return 'png'
      if (nestedMatch === 'jpg' || nestedMatch === 'jpeg') return 'jpg'
      if (nestedMatch === 'svg') return 'svg'
    }
  } catch {
    const match = url.split(/[?#]/, 1)[0]?.match(SUPPORTED_EXTENSION_PATTERN)?.[1]?.toLowerCase()
    if (match === 'png') return 'png'
    if (match === 'jpg' || match === 'jpeg') return 'jpg'
    if (match === 'svg') return 'svg'
  }
  return null
}

export function resolveImageToThreeJsSourceKind(url: unknown): ImageToThreeJsSourceKind | null {
  const extension = readExtension(cleanString(url))
  if (extension === 'svg') return 'svg'
  return extension === 'jpg' || extension === 'png' ? 'raster' : null
}

export function readImageToThreeJsRenderMode(properties: unknown): ImageToThreeJsRenderMode | undefined {
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return undefined
  const record = properties as Record<string, unknown>
  return cleanString(unwrapScalar(record.mediaRenderMode)).toLowerCase() === IMAGE_TO_THREEJS_RENDER_MODE
    ? IMAGE_TO_THREEJS_RENDER_MODE
    : undefined
}

export function isImageToThreeJsSkillNode(node: Pick<GraphNode, 'type' | 'properties'> | null | undefined): boolean {
  if (!node) return false
  if (cleanString(unwrapScalar(node.type)) === IMAGE_TO_THREEJS_SKILL_NODE_TYPE_ID) return true
  const properties = (node.properties || {}) as Record<string, unknown>
  return cleanString(unwrapScalar(properties['flow:widgetFormId'])) === IMAGE_TO_THREEJS_SKILL_FORM_ID
}

export function resolveImageToThreeJsSourceUrl(args: {
  node: Pick<GraphNode, 'properties'>
  connectedValuesBySchemaPath?: FlowConnectedValuesBySchemaPath
}): string {
  for (const schemaPath of SOURCE_SCHEMA_PATHS) {
    const connected = cleanString(unwrapScalar(args.connectedValuesBySchemaPath?.[schemaPath]?.value))
    if (connected) return connected
  }
  const properties = (args.node.properties || {}) as Record<string, unknown>
  for (const key of SOURCE_PROPERTY_KEYS) {
    const local = cleanString(unwrapScalar(properties[key]))
    if (local) return local
  }
  return ''
}

export function buildImageToThreeJsConversion(sourceUrl: unknown): ImageToThreeJsConversionResult {
  const url = cleanString(sourceUrl)
  if (!url) {
    return {
      ok: false,
      errorCode: 'missing-source',
      reason: 'Image to Three.js requires a PNG, JPG, or SVG source URL.',
    }
  }
  const extension = readExtension(url)
  if (!extension) {
    return {
      ok: false,
      errorCode: 'unsupported-format',
      reason: 'Image to Three.js supports only .png, .jpg, .jpeg, and .svg sources.',
    }
  }
  const kind: ImageToThreeJsSourceKind = extension === 'svg' ? 'svg' : 'raster'
  const manifest: ImageToThreeJsManifest = {
    schema: IMAGE_TO_THREEJS_SCHEMA,
    source: { url, kind, extension },
    render: {
      engine: 'three',
      primitive: kind === 'svg' ? 'shape-geometry' : 'textured-plane',
    },
    cost: {
      model: 'local-threejs',
      prompt_tokens: 0,
      completion_tokens: 0,
      cache_hits: 0,
      estimated_cost_usd: 0,
    },
  }
  return {
    ok: true,
    manifest,
    patch: {
      imageUrl: url,
      media_url: url,
      media_kind: kind === 'svg' ? 'svg' : 'image',
      mediaRenderMode: IMAGE_TO_THREEJS_RENDER_MODE,
      imageThreeJsManifest: manifest,
      output: JSON.stringify(manifest, null, 2),
      outputMimeType: 'application/vnd.knowgrph.image-threejs+json',
      outputModel: 'local-threejs',
      outputSourceUrl: url,
      richMediaActiveTab: 'image',
      lastRunAt: new Date().toISOString(),
    },
  }
}
