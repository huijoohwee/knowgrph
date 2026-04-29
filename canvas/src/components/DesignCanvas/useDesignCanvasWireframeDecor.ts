import React from 'react'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import {
  buildEdgePathD,
  ensureEdgeAnimationStyleElement,
  readEdgePathCurveOptions,
  readGlobalEdgeAnimationEnabled,
  readGlobalEdgeColor,
  readGlobalEdgeThicknessPx,
  readGlobalEdgeType,
} from '@/lib/graph/edgeTypes'
import { applyMediaProxySrc, resolveUrlAgainstBase } from '@/lib/url'
import { estimateMaxCharsForWidthPx, truncateTextWithEllipsis, wrapTextByMaxChars } from '@/lib/ui/text/labelText'
import { hashText } from '@/features/parsers/hash'
import type { GraphSchema } from '@/lib/graph/schema'
import type {
  DesignCanvasFrameNodeRef,
  DesignCanvasFrameRect,
  DesignCanvasFrameVisual,
  DesignCanvasNodeStyle,
  DesignCanvasWireframeEdge,
  DesignCanvasWireframePreview,
} from '@/components/DesignCanvas/types'

type WireframeSettingsLike = {
  showEdges: boolean
  maxEdges: number
  showTextPreview: boolean
  showMediaPreview: boolean
  depthFade: boolean
}

type UseDesignCanvasWireframeDecorArgs = {
  styleById: Map<string, DesignCanvasNodeStyle> | null
  wireframeSettings: WireframeSettingsLike
  localGraphData: GraphData
  positions: Record<string, DesignCanvasFrameRect>
  schema: GraphSchema | null
  selectedNodeId: unknown
  documentUrl: string
  domDepthById: Map<string, number>
  renderNodes: DesignCanvasFrameNodeRef[]
  wireframeNodeById: Record<string, GraphNode> | null
  denseRender: boolean
  hasWebpageOverlay: boolean
}

function safeCssColor(raw: unknown): string | null {
  const value = typeof raw === 'string' ? String(raw || '').trim() : ''
  if (!value || value.length > 80) return null
  const lower = value.toLowerCase()
  if (lower === 'transparent' || lower === 'inherit' || lower === 'currentcolor') return null
  if (lower.includes('var(') || lower.includes('url(')) return null
  if (/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value)) return value
  if (/^rgba?\(/i.test(value) || /^hsla?\(/i.test(value)) return value
  if (/^[a-z]+$/i.test(value)) return value
  return null
}

function safeFontFamily(raw: unknown): string | null {
  const value = typeof raw === 'string' ? String(raw || '').trim() : ''
  if (!value || value.length > 160) return null
  const first = value.split(',')[0]?.trim() || ''
  const cleaned = first.replace(/^['"]+|['"]+$/g, '').trim()
  if (!cleaned || cleaned.length > 60) return null
  return cleaned
}

function parseBoxPx(raw: unknown): { top: number; right: number; bottom: number; left: number } | null {
  const value = typeof raw === 'string' ? String(raw || '').trim() : ''
  if (!value) return null
  const numbers = Array.from(value.matchAll(/(-?\d+(\.\d+)?)px/gi))
    .map(match => Number(match[1]))
    .filter(Number.isFinite)
    .slice(0, 8)
  if (numbers.length === 0) return null
  const clamp = (n: number) => Math.max(0, Math.min(200, n))
  if (numbers.length === 1) {
    const all = clamp(numbers[0]!)
    return { top: all, right: all, bottom: all, left: all }
  }
  if (numbers.length === 2) {
    const vertical = clamp(numbers[0]!)
    const horizontal = clamp(numbers[1]!)
    return { top: vertical, right: horizontal, bottom: vertical, left: horizontal }
  }
  if (numbers.length === 3) {
    const top = clamp(numbers[0]!)
    const horizontal = clamp(numbers[1]!)
    const bottom = clamp(numbers[2]!)
    return { top, right: horizontal, bottom, left: horizontal }
  }
  return {
    top: clamp(numbers[0]!),
    right: clamp(numbers[1]!),
    bottom: clamp(numbers[2]!),
    left: clamp(numbers[3]!),
  }
}

export function useDesignCanvasWireframeDecor(args: UseDesignCanvasWireframeDecorArgs) {
  const {
    styleById,
    wireframeSettings,
    localGraphData,
    positions,
    schema,
    selectedNodeId,
    documentUrl,
    domDepthById,
    renderNodes,
    wireframeNodeById,
    denseRender,
    hasWebpageOverlay,
  } = args

  const wireframeEdges = React.useMemo(() => {
    if (!styleById || !wireframeSettings.showEdges) return [] as DesignCanvasWireframeEdge[]
    const edges = Array.isArray(localGraphData?.edges) ? (localGraphData.edges as GraphEdge[]) : []
    if (edges.length === 0) return [] as DesignCanvasWireframeEdge[]
    const out: DesignCanvasWireframeEdge[] = []
    const maxEdges = Math.max(0, Math.min(5000, Math.floor(wireframeSettings.maxEdges)))
    const edgeType = readGlobalEdgeType(schema)
    for (let i = 0; i < edges.length; i += 1) {
      if (maxEdges > 0 && out.length >= maxEdges) break
      const edge = edges[i]
      const id = String(edge?.id || '').trim() || `e:${i}`
      const src = String(edge?.source || '').trim()
      const tgt = String(edge?.target || '').trim()
      if (!src || !tgt) continue
      const srcPos = positions[src]
      const tgtPos = positions[tgt]
      if (!srcPos || !tgtPos) continue
      const depth = domDepthById.get(tgt) ?? 0
      if (depth > 5 && !(selectedNodeId === tgt || selectedNodeId === src)) continue
      const srcKind = styleById.get(src)?.kind || ''
      const tgtKind = styleById.get(tgt)?.kind || ''
      if (srcKind === 'element' && tgtKind === 'element' && depth > 2) continue
      out.push({
        id,
        d: buildEdgePathD({
          edgeType,
          sx: srcPos.x + srcPos.w / 2,
          sy: srcPos.y + srcPos.h / 2,
          tx: tgtPos.x + tgtPos.w / 2,
          ty: tgtPos.y + tgtPos.h / 2,
          curve: readEdgePathCurveOptions(edge, schema),
        }),
        opacity: Math.max(0.06, Math.min(0.42, 0.28 / (1 + depth * 0.55))),
      })
    }
    return out
  }, [domDepthById, localGraphData, positions, schema, selectedNodeId, styleById, wireframeSettings.maxEdges, wireframeSettings.showEdges])

  const wireframeEdgeStroke = readGlobalEdgeColor(schema)
  const wireframeEdgeStrokeWidth = readGlobalEdgeThicknessPx(schema)
  const wireframeEdgesAnimated = readGlobalEdgeAnimationEnabled(schema)

  React.useEffect(() => {
    if (!wireframeEdgesAnimated) return
    ensureEdgeAnimationStyleElement(typeof document !== 'undefined' ? document : null)
  }, [wireframeEdgesAnimated])

  const wireframePreviewById = React.useMemo(() => {
    const map = new Map<string, DesignCanvasWireframePreview>()
    if (!styleById) return map
    if (!wireframeSettings.showTextPreview && !wireframeSettings.showMediaPreview) return map
    if (!wireframeNodeById) return map

    const selected = String(selectedNodeId || '').trim()
    for (let i = 0; i < renderNodes.length; i += 1) {
      const node = renderNodes[i]!
      const position = positions[node.id]
      if (!position) continue
      const isSelected = selected === node.id
      if (denseRender && !isSelected) continue

      const base = wireframeNodeById[node.id]
      const props = (base?.properties || {}) as Record<string, unknown>
      const domTextRaw =
        typeof props['dom:textPreview'] === 'string'
          ? String(props['dom:textPreview'] || '').trim()
          : typeof props['dom:text'] === 'string'
            ? String(props['dom:text'] || '').trim()
            : ''
      const domText = domTextRaw.replace(/\s+/g, ' ').trim()
      const tag = typeof props['dom:tag'] === 'string' ? String(props['dom:tag'] || '').trim().toUpperCase() : ''
      const src = typeof props['dom:attrs:src'] === 'string' ? String(props['dom:attrs:src'] || '').trim() : ''
      const alt = typeof props['dom:attrs:alt'] === 'string' ? String(props['dom:attrs:alt'] || '').trim() : ''
      const href = typeof props['dom:attrs:href'] === 'string' ? String(props['dom:attrs:href'] || '').trim() : ''
      const srcResolved = src ? resolveUrlAgainstBase(documentUrl, src) : ''
      const hrefResolved = href ? resolveUrlAgainstBase(documentUrl, href) : ''
      const kindFromNode = typeof props['dom:kind'] === 'string' ? String(props['dom:kind'] || '').trim() : ''
      const cssFontSize = typeof props['css:fontSize'] === 'string' ? String(props['css:fontSize'] || '').trim() : ''
      const cssFontWeight = typeof props['css:fontWeight'] === 'string' ? String(props['css:fontWeight'] || '').trim() : ''
      const cssTextAlign = typeof props['css:textAlign'] === 'string' ? String(props['css:textAlign'] || '').trim().toLowerCase() : ''
      const cssColor = safeCssColor(props['css:color'])
      const cssFontFamily = safeFontFamily(props['css:fontFamily'])
      const cssPadding = parseBoxPx(props['css:padding'])
      const style = styleById.get(node.id) || null
      const kind = style?.kind || kindFromNode

      const padX = Math.max(10, Math.min(26, Math.round((cssPadding?.left ?? 14) * 0.75)))
      const topY = Math.max(36, Math.min(72, Math.round(32 + (cssPadding?.top ?? 16) * 0.75)))
      const maxW = Math.max(0, position.w - padX * 2)
      const maxH = Math.max(0, position.h - topY - 12)
      if (maxW < 90 || maxH < 18) continue

      const isMedia = kind === 'media' || tag === 'IMG' || tag === 'VIDEO' || tag === 'IFRAME' || tag === 'CANVAS' || tag === 'SVG'
      if (isMedia) {
        if (!wireframeSettings.showMediaPreview) continue
        const srcFinal = tag === 'IMG' ? applyMediaProxySrc(srcResolved || src) : srcResolved || src
        const title = (() => {
          if (tag === 'IMG') {
            return (
              alt ||
              (srcResolved ? srcResolved.split('/').slice(-1)[0] || 'IMG' : src ? src.split('/').slice(-1)[0] || 'IMG' : 'IMG')
            )
          }
          if (tag === 'IFRAME') return 'IFRAME'
          if (tag === 'VIDEO') return 'VIDEO'
          if (tag === 'CANVAS') return 'CANVAS'
          if (tag === 'SVG') return 'SVG'
          return tag || 'MEDIA'
        })()
        const innerW = Math.max(1, position.w - padX * 2)
        map.set(node.id, {
          kind: 'media',
          innerX: padX,
          innerY: topY,
          innerW,
          innerH: Math.max(1, position.h - topY - 12),
          tag,
          titleChip: truncateTextWithEllipsis(title, Math.max(8, Math.min(64, estimateMaxCharsForWidthPx(Math.max(0, innerW - 20), 10)))),
          src: srcFinal,
          isDataImage: /^data:image\//i.test(srcResolved || src),
          clipId: `kgwf-clip-${hashText(node.id)}`,
        })
        continue
      }

      const isTextish =
        !!domText &&
        (kind === 'element' ||
          tag === 'P' ||
          tag === 'SPAN' ||
          tag === 'H1' ||
          tag === 'H2' ||
          tag === 'H3' ||
          tag === 'H4' ||
          tag === 'H5' ||
          tag === 'H6' ||
          tag === 'LI' ||
          tag === 'A' ||
          tag === 'BUTTON' ||
          tag === 'LABEL')
      if (!isTextish || !wireframeSettings.showTextPreview) continue

      const isHeading = tag === 'H1' || tag === 'H2' || tag === 'H3' || tag === 'H4' || tag === 'H5' || tag === 'H6'
      const isCta = tag === 'A' || tag === 'BUTTON'
      const depth = domDepthById.get(node.id) ?? 0
      if (!isSelected && !isHeading && !isCta) {
        if (depth >= 4) continue
        if (position.w < 180 || position.h < 60) continue
      }

      const title = (() => {
        if (tag === 'A') {
          const value = hrefResolved || href
          if (!value) return 'Link'
          try {
            const url = new URL(value)
            const host = url.host || ''
            const pathname = decodeURIComponent(url.pathname || '').replace(/\/+$/, '')
            const detail = pathname && pathname !== '/' ? pathname : ''
            return `Link: ${host ? `${host}${detail}` : detail || value}`
          } catch {
            return `Link: ${value}`
          }
        }
        if (tag === 'BUTTON') return 'Button'
        return ''
      })()
      const fontSize = (() => {
        const match = cssFontSize.match(/(-?\d+(\.\d+)?)px/i)
        const px = match ? Number(match[1]) : NaN
        if (Number.isFinite(px) && px > 0) return Math.max(10, Math.min(18, Math.round(px * 0.65)))
        return tag === 'H1' || tag === 'H2' || tag === 'H3' ? 12 : 11
      })()
      const lineH = fontSize + 4
      const maxLinesWanted = Math.max(1, Math.min(isSelected ? 4 : 2, Math.floor(maxH / lineH)))
      const maxCharsPerLine = Math.max(6, estimateMaxCharsForWidthPx(Math.max(0, maxW), fontSize))
      const allLines = wrapTextByMaxChars(domText, maxCharsPerLine)
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .slice(0, 60)
      if (allLines.length === 0) continue
      if (tag === 'LI') {
        const first = allLines[0] || ''
        allLines[0] = first.startsWith('•') ? first : `• ${first}`
      }
      let lines = allLines.slice(0, maxLinesWanted)
      if (allLines.length > maxLinesWanted && lines.length > 0) {
        const last = lines[lines.length - 1] || ''
        lines = lines.slice(0, -1).concat([
          last.endsWith('…') ? last : last.length >= maxCharsPerLine ? truncateTextWithEllipsis(last, maxCharsPerLine) : `${last}…`,
        ])
      }
      const fontWeight = (() => {
        const weight = Number(cssFontWeight)
        if (Number.isFinite(weight) && weight >= 600) return 600
        if (isHeading || isCta) return 600
        return 400
      })()
      const textAnchor = isCta ? 'middle' : cssTextAlign === 'center' ? 'middle' : cssTextAlign === 'right' ? 'end' : 'start'
      map.set(node.id, {
        kind: 'text',
        title,
        titleMaxChars: Math.max(10, Math.min(90, estimateMaxCharsForWidthPx(Math.max(0, maxW), 10))),
        x: isCta ? padX + maxW / 2 : textAnchor === 'middle' ? padX + maxW / 2 : textAnchor === 'end' ? padX + maxW : padX,
        y: isCta ? topY + Math.max(fontSize, Math.min(maxH - 2, position.h * 0.5 - fontSize * 0.3)) : topY + fontSize,
        fontSize,
        fontWeight,
        textAnchor,
        lineH,
        lines,
        ...(cssColor ? { fill: cssColor } : {}),
        ...(cssFontFamily ? { fontFamily: cssFontFamily } : {}),
      })
    }
    return map
  }, [
    denseRender,
    documentUrl,
    domDepthById,
    positions,
    renderNodes,
    selectedNodeId,
    styleById,
    wireframeNodeById,
    wireframeSettings.showMediaPreview,
    wireframeSettings.showTextPreview,
  ])

  const frameVisualById = React.useMemo(() => {
    const map = new Map<string, DesignCanvasFrameVisual>()
    for (let i = 0; i < renderNodes.length; i += 1) {
      const node = renderNodes[i]!
      const position = positions[node.id]
      if (!position) continue
      const isSelected = selectedNodeId === node.id
      const style = styleById ? styleById.get(node.id) || null : null
      const base = wireframeNodeById ? wireframeNodeById[node.id] : null
      const baseProps = (base?.properties || {}) as Record<string, unknown>
      const domTag = typeof baseProps['dom:tag'] === 'string' ? String(baseProps['dom:tag'] || '').trim().toUpperCase() : ''
      const domClass = typeof baseProps['dom:attrs:class'] === 'string' ? String(baseProps['dom:attrs:class'] || '').trim() : ''
      const isSynthSection = domTag === 'SECTION' && domClass.includes('kg-synth-section')
      const kind = style?.kind || ''
      const depth = wireframeSettings.depthFade ? (domDepthById.get(node.id) ?? 0) : 0
      const hasFill = !!(styleById && style?.fill && style.fill !== 'transparent')
      const fill = (() => {
        if (hasWebpageOverlay) {
          if (hasFill) return style!.fill!
          if (isSynthSection) return 'var(--kg-panel-bg)'
          return 'transparent'
        }
        if (!styleById) return 'var(--kg-panel-bg)'
        if (hasFill) return style!.fill!
        if (kind === 'container' || kind === 'interactive') return 'var(--kg-panel-bg)'
        return 'transparent'
      })()
      map.set(node.id, {
        fill,
        stroke: isSelected ? 'var(--kg-canvas-accent)' : style?.stroke || 'var(--kg-border)',
        strokeWidth: isSelected ? 2 : style?.strokeWidth ?? (kind === 'interactive' ? 2 : 1),
        ...( !isSelected && kind === 'container'
          ? {
              strokeDasharray: isSynthSection ? (depth <= 1 ? '10 6' : '8 6') : depth <= 1 ? '8 4' : '6 4',
            }
          : {}),
        rx: typeof style?.borderRadius === 'number' && Number.isFinite(style.borderRadius) ? style.borderRadius : 8,
        rectOpacity: (() => {
          const baseOpacity = typeof style?.opacity === 'number' && Number.isFinite(style.opacity) ? style.opacity : 1
          if (hasWebpageOverlay) {
            const hasWireFill = hasFill || isSynthSection
            if (!hasWireFill) return 0
            const area = position.w * position.h
            if (area < 3200) return 0
            const factor = isSynthSection ? 0.08 : kind === 'interactive' ? 0.22 : kind === 'container' ? 0.18 : kind === 'media' ? 0.12 : 0.1
            return baseOpacity * (factor * (isSelected ? 1.25 : 1)) / (1 + depth * 0.35)
          }
          if (!styleById) return baseOpacity
          if (style?.fill) return baseOpacity
          if (kind === 'container') return baseOpacity * (0.26 / (1 + depth * 0.55))
          if (kind === 'interactive') return baseOpacity * (0.28 / (1 + depth * 0.35))
          return baseOpacity
        })(),
        strokeOpacity: (() => {
          if (!styleById || isSelected) return 1
          const baseOpacity = kind === 'container' ? 0.55 : kind === 'interactive' ? 0.75 : kind === 'media' ? 0.65 : 0.22
          return Math.max(0.08, baseOpacity / (1 + depth * 0.35))
        })(),
        showDecor: !styleById && !denseRender,
        filter: isSelected || !!(styleById && style?.boxShadow && style.boxShadow !== 'none') ? 'url(#shadow-md)' : 'url(#shadow-sm)',
      })
    }
    return map
  }, [denseRender, domDepthById, hasWebpageOverlay, positions, renderNodes, selectedNodeId, styleById, wireframeNodeById, wireframeSettings.depthFade])

  return {
    wireframeEdges,
    wireframeEdgeStroke,
    wireframeEdgeStrokeWidth,
    wireframeEdgesAnimated,
    wireframePreviewById,
    frameVisualById,
  }
}
