import React from 'react'
import { deriveMarkdownDesignLayout } from '@/features/markdown-edgeless/markdownDesignLayout'
import { buildMarkdownTokensKey, lexMarkdown } from '@/features/markdown/ui/markdownPreviewLex'
import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { readDocumentViewModeContext } from '@/lib/graph/documentViewMode'
import { deriveGraphGroups } from '@/components/GraphCanvas/layout/graphGroups'
import { readAllowGroupResize } from '@/lib/canvas/groupResizePolicy'
import { readGroupResizeHandleConfig } from '@/lib/canvas/groupResizeHandleConfig'
import { buildDeepestGroupRectByNodeId, buildGroupRectByIdFromSchemaOverrides } from '@/lib/canvas/groupExplicitBounds'
import type { RectBounds } from '@/lib/canvas/groupContainment'
import {
  buildMarkdownMatchedBlockNodeIdSetFromGraphNodes,
  buildPanelOnlyNodeIdSetFromGraphNodes,
  type MarkdownPanelLineRanges,
} from '@/lib/render/markdownPanelOverlayPool'
import { listDisplayRichMediaOverlayNodes } from '@/lib/render/richMediaSsot'
import type { DesignCanvasFrameRect, DesignCanvasGroupBounds } from '@/components/DesignCanvas/types'

type UseDesignCanvasMarkdownPanelGroupsArgs = {
  active: boolean
  localGraphData: GraphData
  positions: Record<string, DesignCanvasFrameRect>
  graphData: GraphData | null
  schema: GraphSchema | null
  documentSemanticMode: string
  frontmatterModeEnabled: boolean
  multiDimTableModeEnabled: boolean
  documentStructureBaselineLock: boolean
  renderMediaAsNodes: boolean
  threeIframeOverlayPoolMax: number
  markdownDocumentName: string | null
  markdownDocumentText: string
}

function readMarkdownPanelLineRanges(markdownText: string, markdownDocumentName: string | null): MarkdownPanelLineRanges | null {
  const text = String(markdownText || '')
  if (!text.trim()) return null
  const activeDocumentPath = String(markdownDocumentName || '').trim() || 'markdown'
  const markdownTokensKey = buildMarkdownTokensKey(text)
  const lexed = lexMarkdown(text)
  const layout = deriveMarkdownDesignLayout({ activeDocumentPath, markdownTokensKey, tokens: lexed.tokens as never })
  const table = new Set<number>()
  const code = new Set<number>()
  const blockquote = new Set<number>()
  const iframe = new Set<number>()
  for (let i = 0; i < layout.blocks.length; i += 1) {
    const block = layout.blocks[i]!
    const start = Math.max(1, Math.floor(Number(block.startLine) || 1))
    if (block.type === 'table') table.add(start)
    else if (block.type === 'code') code.add(start)
    else if (block.type === 'blockquote' || block.type === 'callout') blockquote.add(start)
    else if (block.type === 'html') {
      const raw = String(block.preview.kind === 'html' ? block.preview.html?.raw || '' : '').trim()
      if (/<\s*iframe\b/i.test(raw)) iframe.add(start)
    }
  }
  return { table, code, blockquote, iframe }
}

export function useDesignCanvasMarkdownPanelGroups(args: UseDesignCanvasMarkdownPanelGroupsArgs) {
  const {
    active,
    localGraphData,
    positions,
    graphData,
    schema,
    documentSemanticMode,
    frontmatterModeEnabled,
    multiDimTableModeEnabled,
    documentStructureBaselineLock,
    renderMediaAsNodes,
    threeIframeOverlayPoolMax,
    markdownDocumentName,
    markdownDocumentText,
  } = args

  const deferredMarkdownText = React.useDeferredValue(String(markdownDocumentText || ''))

  const markdownPanelLineRanges = React.useMemo(
    () => readMarkdownPanelLineRanges(deferredMarkdownText, markdownDocumentName),
    [deferredMarkdownText, markdownDocumentName],
  )

  const documentViewMode = React.useMemo(
    () =>
      readDocumentViewModeContext({
        frontmatterModeEnabled,
        multiDimTableModeEnabled,
        documentSemanticMode,
        documentStructureBaselineLock,
      }),
    [documentSemanticMode, documentStructureBaselineLock, frontmatterModeEnabled, multiDimTableModeEnabled],
  )
  const markdownPanelAllowedKinds = documentViewMode.markdownPanelAllowedKinds

  const panelOnlyNodeIdSet = React.useMemo(() => {
    if (!active || !markdownPanelLineRanges) return null
    const nodes = Array.isArray(localGraphData?.nodes) ? (localGraphData.nodes as GraphNode[]) : []
    if (nodes.length === 0) return null
    const ids = buildPanelOnlyNodeIdSetFromGraphNodes(nodes)
    const matchedNodeIds = buildMarkdownMatchedBlockNodeIdSetFromGraphNodes({
      nodes,
      lineRanges: markdownPanelLineRanges,
    })
    for (const id of matchedNodeIds) ids.add(id)
    return ids.size > 0 ? ids : null
  }, [active, localGraphData, markdownPanelLineRanges])

  const designGroups = React.useMemo(() => {
    if (!graphData) return []
    return deriveGraphGroups(graphData, {
      forceDocumentStructure: documentViewMode.forceDocumentStructureGroups,
    })
  }, [documentViewMode.forceDocumentStructureGroups, graphData])

  const allowGroupResize = readAllowGroupResize(schema)
  const groupHandleCfg = readGroupResizeHandleConfig(schema)

  const explicitGroupRectById = React.useMemo(() => {
    const nodes = Array.isArray(localGraphData?.nodes) ? (localGraphData.nodes as GraphNode[]) : []
    if (!schema || nodes.length === 0 || designGroups.length === 0) return new Map<string, RectBounds>()
    return buildGroupRectByIdFromSchemaOverrides({ groups: designGroups as any, graphNodes: nodes, schema })
  }, [designGroups, localGraphData?.nodes, schema])

  const explicitGroupRectByNodeId = React.useMemo(() => {
    if (designGroups.length === 0 || explicitGroupRectById.size === 0) return new Map<string, RectBounds>()
    return buildDeepestGroupRectByNodeId({ groups: designGroups as any, groupRectById: explicitGroupRectById })
  }, [designGroups, explicitGroupRectById])

  const designGroupBoundsById = React.useMemo(() => {
    const cfg = schema?.layout?.groups as { padding?: unknown } | null | undefined
    const padding = typeof cfg?.padding === 'number' && Number.isFinite(cfg.padding) ? Math.max(0, cfg.padding) : 24
    const out: Record<string, DesignCanvasGroupBounds> = {}
    for (let i = 0; i < designGroups.length; i += 1) {
      const group = designGroups[i]
      const id = String(group.id || '').trim()
      if (!id) continue
      const explicit = explicitGroupRectById.get(id) || null
      if (explicit) {
        out[id] = { x: explicit.x, y: explicit.y, w: explicit.width, h: explicit.height, explicit: true }
        continue
      }
      const members = Array.isArray(group.memberNodeIds) ? group.memberNodeIds : []
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      let valid = 0
      for (let j = 0; j < members.length; j += 1) {
        const nodeId = String(members[j] || '').trim()
        if (!nodeId) continue
        const position = positions[nodeId]
        if (!position) continue
        const x0 = position.x
        const y0 = position.y
        const x1 = position.x + position.w
        const y1 = position.y + position.h
        if (!Number.isFinite(x0) || !Number.isFinite(y0) || !Number.isFinite(x1) || !Number.isFinite(y1)) continue
        if (x0 < minX) minX = x0
        if (y0 < minY) minY = y0
        if (x1 > maxX) maxX = x1
        if (y1 > maxY) maxY = y1
        valid += 1
      }
      if (!valid || minX === Infinity) continue
      out[id] = {
        x: minX - padding,
        y: minY - padding,
        w: Math.max(1, maxX - minX + padding * 2),
        h: Math.max(1, maxY - minY + padding * 2),
        explicit: false,
      }
    }
    return out
  }, [designGroups, explicitGroupRectById, positions, schema])

  const designMediaOverlayNodes = React.useMemo(() => {
    const nodes = Array.isArray(localGraphData?.nodes) ? (localGraphData.nodes as GraphNode[]) : []
    const poolMaxRaw = typeof threeIframeOverlayPoolMax === 'number' && Number.isFinite(threeIframeOverlayPoolMax) ? threeIframeOverlayPoolMax : 0
    const poolMax = poolMaxRaw > 0 ? poolMaxRaw : 24
    return listDisplayRichMediaOverlayNodes({
      renderMediaAsNodes,
      canvasRenderMode: '2d',
      canvas2dRenderer: 'design',
      nodes,
      poolMax,
    })
  }, [localGraphData, renderMediaAsNodes, threeIframeOverlayPoolMax])

  const designMediaOverlayNodeIdSet = React.useMemo(() => {
    const ids = new Set<string>()
    for (let i = 0; i < designMediaOverlayNodes.length; i += 1) {
      const id = String(designMediaOverlayNodes[i]?.id || '').trim()
      if (id) ids.add(id)
    }
    return ids
  }, [designMediaOverlayNodes])

  const designMediaOverlayNodeIdsKey = React.useMemo(() => designMediaOverlayNodes.map(node => node.id).join('|'), [designMediaOverlayNodes])

  return {
    markdownPanelAllowedKinds,
    panelOnlyNodeIdSet,
    designGroups,
    allowGroupResize,
    groupHandleCfg,
    explicitGroupRectByNodeId,
    designGroupBoundsById,
    designMediaOverlayNodes,
    designMediaOverlayNodeIdSet,
    designMediaOverlayNodeIdsKey,
  }
}
