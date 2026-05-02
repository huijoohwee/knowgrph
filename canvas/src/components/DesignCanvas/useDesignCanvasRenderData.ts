import React from 'react'
import { getNodeMediaSpec } from '@/components/GraphCanvas/helpers'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { truncateTextWithEllipsis } from '@/lib/ui/text/labelText'
import type {
  DesignCanvasFrameNodeRef,
  DesignCanvasFrameRect,
  DesignCanvasInlineMediaPreview,
  DesignCanvasNodeStyle,
} from '@/components/DesignCanvas/types'

type UseDesignCanvasRenderDataArgs = {
  activeWebpageLayoutGraphData: GraphData | null
  localGraphData: GraphData
  visibleNodes: DesignCanvasFrameNodeRef[]
  positions: Record<string, DesignCanvasFrameRect>
  selectedNodeId: unknown
  selectedNodeIds: readonly unknown[]
  designMediaOverlayNodeIdSet: ReadonlySet<string>
  webpageGraphNodesById: Record<string, GraphNode> | null
  designGraphNodeById: Map<string, GraphNode>
  showMediaPreview: boolean
}

function readSourceNodes(args: Pick<UseDesignCanvasRenderDataArgs, 'activeWebpageLayoutGraphData' | 'localGraphData'>): GraphNode[] {
  const { activeWebpageLayoutGraphData, localGraphData } = args
  if (Array.isArray(activeWebpageLayoutGraphData?.nodes) && activeWebpageLayoutGraphData.nodes.length > 0) {
    return activeWebpageLayoutGraphData.nodes as GraphNode[]
  }
  return Array.isArray(localGraphData?.nodes) ? (localGraphData.nodes as GraphNode[]) : []
}

function readSelectedNodeIdSet(selectedNodeId: unknown, selectedNodeIds: readonly unknown[]): Set<string> {
  const selected = new Set<string>()
  const single = String(selectedNodeId || '').trim()
  if (single) selected.add(single)
  for (let i = 0; i < selectedNodeIds.length; i += 1) {
    const id = String(selectedNodeIds[i] || '').trim()
    if (id) selected.add(id)
  }
  return selected
}

export function useDesignCanvasRenderData(args: UseDesignCanvasRenderDataArgs) {
  const {
    activeWebpageLayoutGraphData,
    localGraphData,
    visibleNodes,
    positions,
    selectedNodeId,
    selectedNodeIds,
    designMediaOverlayNodeIdSet,
    webpageGraphNodesById,
    designGraphNodeById,
    showMediaPreview,
  } = args

  const styleById = React.useMemo(() => {
    const sourceNodes = readSourceNodes({ activeWebpageLayoutGraphData, localGraphData })
    if (sourceNodes.length === 0) return null
    const map = new Map<string, DesignCanvasNodeStyle>()
    for (let i = 0; i < sourceNodes.length; i += 1) {
      const node = sourceNodes[i] as GraphNode
      const props = (node.properties || {}) as Record<string, unknown>
      const fill = typeof props['visual:fill'] === 'string' ? String(props['visual:fill'] || '').trim() : ''
      const stroke = typeof props['visual:stroke'] === 'string' ? String(props['visual:stroke'] || '').trim() : ''
      const strokeWidth = typeof props['visual:strokeWidth'] === 'number' ? (props['visual:strokeWidth'] as number) : undefined
      const borderRadius = typeof props['visual:borderRadius'] === 'number' ? (props['visual:borderRadius'] as number) : undefined
      const opacity = typeof props['visual:opacity'] === 'number' ? (props['visual:opacity'] as number) : undefined
      const kind = typeof props['dom:kind'] === 'string' ? String(props['dom:kind'] || '').trim() : ''
      const tag = typeof props['dom:tag'] === 'string' ? String(props['dom:tag'] || '').trim() : ''
      const position = typeof props['css:position'] === 'string' ? String(props['css:position'] || '').trim() : ''
      const stackKey = typeof props['css:stackKey'] === 'string' ? String(props['css:stackKey'] || '').trim() : ''
      const visualZIndex = typeof props['visual:zIndex'] === 'number' && Number.isFinite(props['visual:zIndex'] as number) ? (props['visual:zIndex'] as number) : undefined
      const zIndex = (() => {
        const raw = typeof props['css:zIndex'] === 'string' ? String(props['css:zIndex'] || '').trim() : ''
        if (!raw || raw === 'auto') return 0
        const value = Number(raw)
        return Number.isFinite(value) ? value : 0
      })()
      const xIndex = typeof props['visual:xIndex'] === 'number' && Number.isFinite(props['visual:xIndex'] as number) ? (props['visual:xIndex'] as number) : undefined
      const yIndex = typeof props['visual:yIndex'] === 'number' && Number.isFinite(props['visual:yIndex'] as number) ? (props['visual:yIndex'] as number) : undefined
      const boxShadow = typeof props['css:boxShadow'] === 'string' ? String(props['css:boxShadow'] || '').trim() : ''
      const id = String(node.id || '').trim()
      if (!id) continue
      map.set(id, {
        ...(fill ? { fill } : {}),
        ...(stroke ? { stroke } : {}),
        ...(typeof strokeWidth === 'number' && Number.isFinite(strokeWidth) ? { strokeWidth } : {}),
        ...(typeof borderRadius === 'number' && Number.isFinite(borderRadius) ? { borderRadius } : {}),
        ...(typeof opacity === 'number' && Number.isFinite(opacity) ? { opacity } : {}),
        ...(kind ? { kind } : {}),
        ...(typeof visualZIndex === 'number' ? { zIndex: visualZIndex } : Number.isFinite(zIndex) ? { zIndex } : {}),
        ...(stackKey ? { stackKey } : {}),
        ...(typeof xIndex === 'number' ? { xIndex } : {}),
        ...(typeof yIndex === 'number' ? { yIndex } : {}),
        ...(boxShadow ? { boxShadow } : {}),
        ...(position ? { position } : {}),
        ...(tag ? { tag } : {}),
      })
    }
    return map
  }, [activeWebpageLayoutGraphData, localGraphData])

  const wireframeNodeById = React.useMemo(() => {
    if (webpageGraphNodesById) return webpageGraphNodesById
    const out: Record<string, GraphNode> = {}
    const nodes = Array.isArray(localGraphData?.nodes) ? (localGraphData.nodes as GraphNode[]) : []
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i]
      const id = String(node?.id || '').trim()
      if (!id) continue
      out[id] = node
    }
    return Object.keys(out).length > 0 ? out : null
  }, [localGraphData, webpageGraphNodesById])

  const denseRender = visibleNodes.length > 450
  const renderNodes = React.useMemo(() => {
    const base =
      designMediaOverlayNodeIdSet.size > 0 ? visibleNodes.filter(node => !designMediaOverlayNodeIdSet.has(node.id)) : visibleNodes
    if (!styleById) return base

    const kindRank = (kind: string): number => {
      if (kind === 'container') return 0
      if (kind === 'element') return 1
      if (kind === 'media') return 2
      if (kind === 'interactive') return 3
      return 4
    }

    const boostZ = (style: DesignCanvasNodeStyle | null | undefined) => {
      const position = String(style?.position || '').toLowerCase()
      const tag = String(style?.tag || '').toUpperCase()
      const kind = String(style?.kind || '')
      let value = 0
      if (position === 'fixed' || position === 'sticky') value += 1000
      if (tag === 'HEADER' || tag === 'NAV') value += 220
      if (kind === 'interactive') value += 120
      return value
    }

    const nodes = base.slice()
    nodes.sort((a, b) => {
      const styleA = styleById.get(a.id)
      const styleB = styleById.get(b.id)
      const zA = (styleA?.zIndex ?? 0) + boostZ(styleA)
      const zB = (styleB?.zIndex ?? 0) + boostZ(styleB)
      if (zA !== zB) return zA - zB
      const stackKeyA = String(styleA?.stackKey || '')
      const stackKeyB = String(styleB?.stackKey || '')
      if (stackKeyA && stackKeyB && stackKeyA !== stackKeyB) return stackKeyA.localeCompare(stackKeyB)
      const kindA = kindRank(styleA?.kind || '')
      const kindB = kindRank(styleB?.kind || '')
      if (kindA !== kindB) return kindA - kindB
      const yA = typeof styleA?.yIndex === 'number' ? styleA.yIndex : 0
      const yB = typeof styleB?.yIndex === 'number' ? styleB.yIndex : 0
      if (yA !== yB) return yA - yB
      const xA = typeof styleA?.xIndex === 'number' ? styleA.xIndex : 0
      const xB = typeof styleB?.xIndex === 'number' ? styleB.xIndex : 0
      if (xA !== xB) return xA - xB
      const posA = positions[a.id]
      const posB = positions[b.id]
      const areaA = posA ? posA.w * posA.h : 0
      const areaB = posB ? posB.w * posB.h : 0
      if (areaA !== areaB) return areaB - areaA
      return a.id.localeCompare(b.id)
    })

    const selected = readSelectedNodeIdSet(selectedNodeId, selectedNodeIds)
    if (nodes.length <= 700) return nodes

    const kept: DesignCanvasFrameNodeRef[] = []
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i]!
      if (selected.has(node.id)) {
        kept.push(node)
        continue
      }
      const position = positions[node.id]
      if (!position) continue
      const style = styleById.get(node.id) || null
      const kind = String(style?.kind || '')
      const tag = String(style?.tag || '').toUpperCase()
      const cssPosition = String(style?.position || '').toLowerCase()
      const area = position.w * position.h
      const minSide = Math.min(position.w, position.h)
      if (minSide < 4 || area < 180) continue

      const baseNode = wireframeNodeById ? wireframeNodeById[node.id] : null
      const props = (baseNode?.properties || {}) as Record<string, unknown>
      const hasText =
        typeof props['dom:textPreview'] === 'string'
          ? !!String(props['dom:textPreview'] || '').trim()
          : typeof props['dom:text'] === 'string'
            ? !!String(props['dom:text'] || '').trim()
            : false
      const hasHref = typeof props['dom:attrs:href'] === 'string' ? !!String(props['dom:attrs:href'] || '').trim() : false
      const hasSrc = typeof props['dom:attrs:src'] === 'string' ? !!String(props['dom:attrs:src'] || '').trim() : false
      const hasFill = !!(style?.fill && style.fill !== 'transparent')
      const isSemanticContainer =
        tag === 'HEADER' || tag === 'NAV' || tag === 'MAIN' || tag === 'FOOTER' || tag === 'SECTION' || tag === 'ARTICLE' || tag === 'ASIDE'

      if (kind === 'interactive') {
        if (position.w >= 32 && position.h >= 16) kept.push(node)
        continue
      }
      if (kind === 'media') {
        if (hasSrc || (position.w >= 48 && position.h >= 48)) kept.push(node)
        continue
      }
      if (kind === 'container') {
        if (cssPosition === 'fixed' || cssPosition === 'sticky') {
          kept.push(node)
          continue
        }
        if (isSemanticContainer) {
          if (area >= 2800) kept.push(node)
          continue
        }
        if (hasFill && area >= 2200) {
          kept.push(node)
          continue
        }
        if (area >= 260_000 && minSide >= 140) {
          kept.push(node)
          continue
        }
        continue
      }

      const isImportantTag =
        tag === 'H1' || tag === 'H2' || tag === 'H3' || tag === 'BUTTON' || tag === 'A' || tag === 'IMG' || tag === 'VIDEO' || tag === 'IFRAME'
      if (isImportantTag) {
        if (area >= 600 || hasText || hasHref) kept.push(node)
        continue
      }
      if (hasText || hasHref) {
        if (position.w >= 140 && position.h >= 22) kept.push(node)
        continue
      }
      if (hasFill && area >= 6000) {
        kept.push(node)
        continue
      }
      if (area >= 16_000 && minSide >= 24) {
        kept.push(node)
      }
    }

    if (kept.length <= 1800) return kept
    const fixed: DesignCanvasFrameNodeRef[] = []
    const rest: Array<{ node: DesignCanvasFrameNodeRef; area: number }> = []
    for (let i = 0; i < kept.length; i += 1) {
      const node = kept[i]!
      if (selected.has(node.id)) fixed.push(node)
      else {
        const position = positions[node.id]
        rest.push({ node, area: position ? position.w * position.h : 0 })
      }
    }
    rest.sort((a, b) => b.area - a.area)
    const cap = Math.max(0, 1800 - fixed.length)
    return fixed.concat(rest.slice(0, cap).map(entry => entry.node))
  }, [designMediaOverlayNodeIdSet, positions, selectedNodeId, selectedNodeIds, styleById, visibleNodes, wireframeNodeById])

  const domDepthById = React.useMemo(() => {
    const out = new Map<string, number>()
    if (!wireframeNodeById) return out
    const ids = visibleNodes.map(node => String(node.id || '').trim()).filter(Boolean)
    const compute = (id: string): number => {
      if (!id) return 0
      if (out.has(id)) return out.get(id)!
      const seen = new Set<string>()
      let current = id
      let depth = 0
      while (depth < 12) {
        if (seen.has(current)) break
        seen.add(current)
        const node = wireframeNodeById[current]
        const parentId = String((node?.metadata as { domParentId?: unknown } | undefined)?.domParentId || '').trim()
        if (!parentId) break
        depth += 1
        current = parentId
      }
      out.set(id, depth)
      return depth
    }
    for (let i = 0; i < ids.length; i += 1) compute(ids[i]!)
    return out
  }, [visibleNodes, wireframeNodeById])

  const designMediaPreviewById = React.useMemo(() => {
    const map = new Map<string, DesignCanvasInlineMediaPreview>()
    if (styleById) return map
    if (!showMediaPreview) return map
    for (let i = 0; i < visibleNodes.length; i += 1) {
      const id = String(visibleNodes[i]?.id || '').trim()
      if (!id) continue
      const base = designGraphNodeById.get(id)
      if (!base) continue
      const spec = getNodeMediaSpec(base)
      if (!spec) continue
      const tag: 'IMG' | 'VIDEO' | 'IFRAME' = spec.kind === 'iframe' ? 'IFRAME' : spec.kind === 'video' ? 'VIDEO' : 'IMG'
      const rawSrc = String(spec.url || '').trim()
      if (!rawSrc) continue
      const title = tag === 'IMG' ? 'Image' : tag === 'VIDEO' ? 'Video' : 'IFrame'
      const titleChip = truncateTextWithEllipsis(title, 24)
      map.set(id, { tag, titleChip, url: rawSrc })
    }
    return map
  }, [designGraphNodeById, showMediaPreview, styleById, visibleNodes])

  return {
    styleById,
    wireframeNodeById,
    denseRender,
    renderNodes,
    domDepthById,
    designMediaPreviewById,
  }
}
