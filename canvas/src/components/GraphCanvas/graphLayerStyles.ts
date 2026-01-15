import type { GraphData, GraphNode, JSONValue } from '@/lib/graph/types'
import { getAgenticRagTagColor, getRendererPalette, MVP_COLOR_PALETTE, type GraphSchema } from '@/lib/graph/schema'
import type { NodeGroup } from './nodeGroups'

export type GraphLayerGroupStyle = {
  fill: string
  fillOpacity: number
  stroke: string
  strokeWidth: number
  dash: string
}

type GraphLayerStyleConfig = {
  fill?: unknown
  fillColor?: unknown
  stroke?: unknown
  strokeColor?: unknown
  dash?: unknown
  dashArray?: unknown
  strokeDasharray?: unknown
  opacity?: unknown
  fillOpacity?: unknown
  strokeWidth?: unknown
}

const isRecord = (val: unknown): val is Record<string, unknown> =>
  !!val && typeof val === 'object' && !Array.isArray(val)

const applyStyleOverrides = (style: GraphLayerGroupStyle, config: GraphLayerStyleConfig): void => {
  const fill =
    typeof config.fill === 'string'
      ? config.fill
      : typeof config.fillColor === 'string'
        ? config.fillColor
        : null
  const stroke =
    typeof config.stroke === 'string'
      ? config.stroke
      : typeof config.strokeColor === 'string'
        ? config.strokeColor
        : null
  const dash =
    typeof config.dash === 'string'
      ? config.dash
      : typeof config.dashArray === 'string'
        ? config.dashArray
        : typeof config.strokeDasharray === 'string'
          ? config.strokeDasharray
          : null
  const opacity =
    typeof config.opacity === 'number'
      ? config.opacity
      : typeof config.fillOpacity === 'number'
        ? config.fillOpacity
        : null
  const strokeWidth = typeof config.strokeWidth === 'number' ? config.strokeWidth : null

  if (fill) style.fill = fill
  if (stroke) style.stroke = stroke
  if (dash) style.dash = dash
  if (opacity != null && Number.isFinite(opacity)) style.fillOpacity = opacity
  if (strokeWidth != null && Number.isFinite(strokeWidth)) style.strokeWidth = strokeWidth
}

export const getGraphLayerStyleForGroup = (args: {
  group: NodeGroup
  graphData: GraphData
  schema: GraphSchema
}): GraphLayerGroupStyle => {
  const { group, graphData, schema } = args

  const palette = getRendererPalette(schema)
  const baseColor = typeof palette.nodes.idea === 'string' && palette.nodes.idea.trim()
    ? palette.nodes.idea
    : MVP_COLOR_PALETTE.nodes.idea

  const base: GraphLayerGroupStyle = {
    fill: baseColor,
    fillOpacity: 0.16,
    stroke: baseColor,
    strokeWidth: 1.25,
    dash: '4,2',
  }

  const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : []
  const nodeById = new Map<string, GraphNode>()
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    nodeById.set(String(n.id), n)
  }

  const idParts = String(group.id || '').split('::')
  const ownerId = group.meta?.ownerId ?? (idParts[0] || '')
  const propKey = group.meta?.propertyKey ?? (idParts.length > 1 ? idParts[1] : '')
  const owner = ownerId ? nodeById.get(ownerId) || null : null
  const ownerType = group.meta?.ownerType ?? (owner ? String(owner.type || '') : '')

  const metadata = schema && schema.metadata && isRecord(schema.metadata) ? schema.metadata : null
  const hasGraphLayersMeta =
    metadata && Object.prototype.hasOwnProperty.call(metadata, 'canvas:graphLayers')
  const graphLayersMetaRaw = hasGraphLayersMeta
    ? (metadata['canvas:graphLayers'] as JSONValue | undefined)
    : undefined

  const style: GraphLayerGroupStyle = { ...base }

  if (group.meta?.groupBy === 'community') {
    const first = group.memberIds.length > 0 ? nodeById.get(String(group.memberIds[0])) : null
    const props = (first?.properties || {}) as Record<string, unknown>
    const fill = typeof props['visual:fill'] === 'string' ? String(props['visual:fill']).trim() : ''
    if (fill) {
      style.fill = fill
      style.stroke = fill
      style.fillOpacity = 0.12
      style.strokeWidth = 1.25
      style.dash = '3,2'
    }
  }

  if (graphLayersMetaRaw && isRecord(graphLayersMetaRaw)) {
    const meta = graphLayersMetaRaw

    const defaultStyleRaw = 'defaultStyle' in meta ? meta.defaultStyle : undefined
    if (defaultStyleRaw && isRecord(defaultStyleRaw)) {
      applyStyleOverrides(style, defaultStyleRaw as GraphLayerStyleConfig)
    }

    const byOwnerTypeRaw = 'byOwnerType' in meta ? meta.byOwnerType : undefined
    if (ownerType && byOwnerTypeRaw && isRecord(byOwnerTypeRaw)) {
      const ownerStyleRaw = byOwnerTypeRaw[ownerType] as unknown
      if (ownerStyleRaw && isRecord(ownerStyleRaw)) {
        applyStyleOverrides(style, ownerStyleRaw as GraphLayerStyleConfig)
      }
    }

    const byPropertyKeyRaw = 'byPropertyKey' in meta ? meta.byPropertyKey : undefined
    if (propKey && byPropertyKeyRaw && isRecord(byPropertyKeyRaw)) {
      const keyStyleRaw = byPropertyKeyRaw[propKey] as unknown
      if (keyStyleRaw && isRecord(keyStyleRaw)) {
        applyStyleOverrides(style, keyStyleRaw as GraphLayerStyleConfig)
      }
    }
  }

  if (!graphLayersMetaRaw) {
    if (ownerType === 'MermaidSubgraph') {
       // 1. Determine base style from Schema (if applicable) or Default
       let baseFill = '#f4f4f4'
       let baseStroke = '#333333'
       let baseOpacity = 1.0

       if (owner) {
          const tagColor = getAgenticRagTagColor(owner, schema)
          if (tagColor && typeof tagColor === 'string' && tagColor.trim()) {
              baseFill = tagColor
              baseStroke = tagColor
              baseOpacity = 0.15 // Schema colors are usually strong, so use low opacity for layers
          }
       }

       style.fill = baseFill
       style.fillOpacity = baseOpacity
       style.stroke = baseStroke
       style.strokeWidth = 1.5
       style.dash = '0'

       // 2. Apply Mermaid-specific overrides (explicit classDef or inline styles)
       // These take precedence over schema colors
       if (owner) {
         const props = (owner.properties || {}) as Record<string, unknown>
         
         // Helper to check if a value is a valid non-empty string
         const hasStr = (k: string) => typeof props[k] === 'string' && props[k]
         
         if (hasStr('fill') || hasStr('visual:fill')) {
             style.fill = (props['visual:fill'] || props.fill) as string
             // If explicit fill is provided, assume user wants full control (or default opacity)
             // Unless opacity is also specified
             if (style.fill.startsWith('#') && baseOpacity < 1.0 && !hasStr('fillOpacity')) {
                 // If we had a schema opacity (low), but user provided a specific fill color,
                 // we might want to keep it low OR reset to 1.0. 
                 // Usually mermaid styles imply opaque backgrounds unless alpha is used.
                 // Let's stick to the current opacity unless overridden.
                 style.fillOpacity = 1.0 
             }
         }
         
         if (hasStr('stroke') || hasStr('visual:stroke')) {
             style.stroke = (props['visual:stroke'] || props.stroke) as string
         }
         
          const sw = props['visual:strokeWidth'] ?? props['stroke-width'] ?? props.strokeWidth ?? props['visual:stroke-width']
         if (typeof sw === 'number' && Number.isFinite(sw)) style.strokeWidth = sw
         if (typeof sw === 'string') {
            const parsed = parseFloat(sw)
            if (Number.isFinite(parsed)) style.strokeWidth = parsed
         }

          const dash = typeof props.strokeDasharray === 'string' ? props.strokeDasharray : typeof props['stroke-dasharray'] === 'string' ? props['stroke-dasharray'] : ''
          if (dash) style.dash = dash
          
          const op = props['fillOpacity'] ?? props['visual:fillOpacity'] ?? props['opacity']
          if (typeof op === 'number' && Number.isFinite(op)) style.fillOpacity = op
          if (typeof op === 'string') {
             const parsed = parseFloat(op)
             if (Number.isFinite(parsed)) style.fillOpacity = parsed
          }
       }
    } else if (group.meta?.groupBy !== 'community' && owner) {
      const tagColor = getAgenticRagTagColor(owner, schema)
      if (typeof tagColor === 'string' && tagColor.trim()) {
        style.fill = tagColor
        style.fillOpacity = 0.16
        style.stroke = tagColor
        style.strokeWidth = 1.5
      } else if (ownerType && schema.nodeStyles && schema.nodeStyles[ownerType] && schema.nodeStyles[ownerType]?.color) {
        const c = schema.nodeStyles[ownerType]?.color
        if (typeof c === 'string' && c.trim()) {
          style.fill = c
          style.fillOpacity = 0.12
          style.stroke = c
          style.strokeWidth = 1.5
        }
      }
    }
  }

  return style
}
