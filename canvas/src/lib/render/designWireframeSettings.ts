import type { GraphSchema } from '@/lib/graph/schema'
import type { JSONValue } from '@/lib/graph/types'
import { toMetadataRecord } from '@/lib/graph/documentMetadata'

export type DesignWireframeSettings = {
  showEdges: boolean
  showLabelChips: boolean
  showMetaChips: boolean
  avoidLabelCollisions: boolean
  showTextPreview: boolean
  showMediaPreview: boolean
  depthFade: boolean
  maxEdges: number
  maxLabelChars: number
}

export const DESIGN_WIREFRAME_META_KEY = 'renderer:designWireframe'

export const DEFAULT_DESIGN_WIREFRAME_SETTINGS: DesignWireframeSettings = {
  showEdges: false,
  showLabelChips: true,
  showMetaChips: true,
  avoidLabelCollisions: true,
  showTextPreview: true,
  showMediaPreview: true,
  depthFade: true,
  maxEdges: 900,
  maxLabelChars: 44,
}

export function readDesignWireframeSettings(
  schema: GraphSchema | null | undefined,
  graphMetadata?: Record<string, JSONValue> | null,
): DesignWireframeSettings {
  const schemaMeta = toMetadataRecord(schema?.metadata) as Record<string, JSONValue>
  const graphMeta = graphMetadata ? (toMetadataRecord(graphMetadata) as Record<string, JSONValue>) : null
  const schemaRaw = Object.prototype.hasOwnProperty.call(schemaMeta, DESIGN_WIREFRAME_META_KEY)
    ? (schemaMeta[DESIGN_WIREFRAME_META_KEY] as unknown)
    : undefined
  const graphRaw = graphMeta && Object.prototype.hasOwnProperty.call(graphMeta, DESIGN_WIREFRAME_META_KEY)
    ? (graphMeta[DESIGN_WIREFRAME_META_KEY] as unknown)
    : undefined
  const schemaObj = schemaRaw && typeof schemaRaw === 'object' && !Array.isArray(schemaRaw) ? (schemaRaw as Record<string, unknown>) : null
  const graphObj = graphRaw && typeof graphRaw === 'object' && !Array.isArray(graphRaw) ? (graphRaw as Record<string, unknown>) : null
  const obj = schemaObj || graphObj ? ({ ...(schemaObj || {}), ...(graphObj || {}) } as Record<string, unknown>) : null
  if (!obj) return DEFAULT_DESIGN_WIREFRAME_SETTINGS
  const readBool = (k: keyof DesignWireframeSettings): boolean =>
    typeof obj[k as string] === 'boolean'
      ? (obj[k as string] as boolean)
      : (DEFAULT_DESIGN_WIREFRAME_SETTINGS[k] as unknown as boolean)
  const readInt = (k: keyof DesignWireframeSettings, min: number, max: number): number => {
    const v = typeof obj[k as string] === 'number' ? (obj[k as string] as number) : Number.NaN
    if (!Number.isFinite(v)) return DEFAULT_DESIGN_WIREFRAME_SETTINGS[k] as unknown as number
    return Math.max(min, Math.min(max, Math.floor(v)))
  }
  return {
    showEdges: readBool('showEdges'),
    showLabelChips: readBool('showLabelChips'),
    showMetaChips: readBool('showMetaChips'),
    avoidLabelCollisions: readBool('avoidLabelCollisions'),
    showTextPreview: readBool('showTextPreview'),
    showMediaPreview: readBool('showMediaPreview'),
    depthFade: readBool('depthFade'),
    maxEdges: readInt('maxEdges', 0, 5000),
    maxLabelChars: readInt('maxLabelChars', 8, 140),
  }
}
