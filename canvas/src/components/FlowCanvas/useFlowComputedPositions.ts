import React from 'react'

import { useGraphStore } from '@/hooks/useGraphStore'
import { DEFAULT_FLOW_DAGRE_MAX_NODES, DEFAULT_FLOW_ELK_MAX_NODES } from '@/lib/graph/layoutDefaults'
import { buildElkLayout } from '@/components/FlowCanvas/elkLayout'
import { buildDagreLayout, buildFastGridLayout, buildGraphMetaKey } from '@/components/FlowCanvas/layout'
import { buildLayoutPositionCacheKey } from '@/components/GraphCanvas/layout/positioning'
import { pickSeedFromOtherRendererCache } from '@/components/FlowCanvas/seed'
import { extractNodePositions, hasCacheCoverage, looksUnstablePositions } from '@/components/FlowCanvas/seedPositions'
import { relaxFlowPositionsWithCollision } from '@/components/FlowCanvas/relaxPositions'
import type { GraphData } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import type { FlowConfig } from '@/components/FlowCanvas/config'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'

export function useFlowComputedPositions(args: {
  active: boolean
  cacheKey: string
  datasetKey: string
  layoutMode: string
  layoutVariant: string
  documentSemanticMode: string
  effectiveFrontmatter: boolean
  layoutViewKey: string
  rankdir: 'TB' | 'LR'
  sceneGraphData: GraphData | null
  sceneGroups: GraphGroup[]
  schema: GraphSchema | null
  flowConfig: FlowConfig
  flowPresentation: {
    portHandles: { enabled: boolean; sizePx: number; offsetPx: number }
  }
  layoutPositionsForMode: Record<string, { x: number; y: number }> | null
  setLayoutPositionsForMode?: (cacheKey: string, positions: Record<string, { x: number; y: number }>) => void
}): Record<string, { x: number; y: number }> | null {
  const [computedPositions, setComputedPositions] = React.useState<Record<string, { x: number; y: number }> | null>(
    () => args.layoutPositionsForMode || null,
  )
  const lastLayoutGraphKeyRef = React.useRef<string>('')
  const seededFromOtherRendererKeyRef = React.useRef<string>('')
  const seededFromOtherRendererPositionsRef = React.useRef<Record<string, { x: number; y: number }> | null>(null)

  React.useEffect(() => {
    if (!args.active) return
    const next = args.layoutPositionsForMode || null
    setComputedPositions(prev => (prev === next ? prev : next))
  }, [args.active, args.cacheKey, args.layoutPositionsForMode])

  React.useEffect(() => {
    let cancelled = false
    if (!args.active) return
    const g = args.sceneGraphData
    const nodeList = Array.isArray(g?.nodes) ? g?.nodes : []
    const edgeList = Array.isArray(g?.edges) ? g?.edges : []
    const graphKey = `${nodeList.length}:${edgeList.length}:${buildGraphMetaKey(g)}:${args.layoutVariant}`
    if (graphKey === lastLayoutGraphKeyRef.current && computedPositions) return
    lastLayoutGraphKeyRef.current = graphKey

    const run = async () => {
      const nodeW = Math.max(1, Math.floor(args.flowConfig.node.widthPx))
      const nodeH = Math.max(1, Math.floor(args.flowConfig.node.heightPx))
      const centerToTopLeft = (positions: Record<string, { x: number; y: number }> | null): Record<string, { x: number; y: number }> | null => {
        if (!positions) return null
        const out: Record<string, { x: number; y: number }> = {}
        const keys = Object.keys(positions)
        for (let i = 0; i < keys.length; i += 1) {
          const id = keys[i]
          const p = positions[id]
          if (!p) continue
          const x = p.x
          const y = p.y
          if (!Number.isFinite(x) || !Number.isFinite(y)) continue
          out[id] = { x: x - nodeW / 2, y: y - nodeH / 2 }
        }
        return out
      }

      const cached = args.layoutPositionsForMode || null
      const seededFromOtherRenderer = (() => {
        const seedKey = `${graphKey}:${String(args.documentSemanticMode || 'document')}:${args.effectiveFrontmatter ? '1' : '0'}:${args.layoutMode}`
        if (seededFromOtherRendererKeyRef.current === seedKey) return seededFromOtherRendererPositionsRef.current
        seededFromOtherRendererKeyRef.current = seedKey

        const cache = useGraphStore.getState().layoutPositionCacheByMode || null
        const baseKey = buildLayoutPositionCacheKey({
          datasetKey: args.datasetKey,
          mode: args.layoutMode,
          frontmatterMode: args.effectiveFrontmatter,
          semanticMode: String(args.documentSemanticMode || 'document'),
          renderMode: '2d',
          viewKey: args.layoutViewKey,
          renderVariant: 'd3',
        })
        const best = pickSeedFromOtherRendererCache({
          nodes: nodeList,
          cache,
          baseKey,
        })
        const normalized = centerToTopLeft(best)
        seededFromOtherRendererPositionsRef.current = normalized
        return normalized
      })()
      const seededFromNodes = centerToTopLeft(extractNodePositions(nodeList as ReadonlyArray<{ id?: unknown; x?: unknown; y?: unknown }>))
      const cacheCoverageOk = hasCacheCoverage({ nodes: nodeList, positions: cached, minCoverage: 0.9 })
      const cacheUnstable = cacheCoverageOk && looksUnstablePositions({ nodes: nodeList, positions: cached, nodeSize: { widthPx: nodeW, heightPx: nodeH } })
      const allowCache = cacheCoverageOk && !cacheUnstable

      const otherCoverageOk = !allowCache && hasCacheCoverage({ nodes: nodeList, positions: seededFromOtherRenderer, minCoverage: 0.9 })
      const otherUnstable = otherCoverageOk && looksUnstablePositions({ nodes: nodeList, positions: seededFromOtherRenderer, nodeSize: { widthPx: nodeW, heightPx: nodeH } })
      const allowOther = otherCoverageOk && !otherUnstable

      const nodesCoverageOk = !allowCache && !allowOther && hasCacheCoverage({ nodes: nodeList, positions: seededFromNodes, minCoverage: 0.9 })
      const nodesUnstable = nodesCoverageOk && looksUnstablePositions({ nodes: nodeList, positions: seededFromNodes, nodeSize: { widthPx: nodeW, heightPx: nodeH } })
      const allowNodes = nodesCoverageOk && !nodesUnstable

      const computed = allowCache
        ? cached
        : allowOther
          ? seededFromOtherRenderer
          : allowNodes
            ? seededFromNodes
            : await (async () => {
                if (nodeList.length > DEFAULT_FLOW_DAGRE_MAX_NODES) {
                  return buildFastGridLayout({
                    nodes: nodeList.map(n => ({ id: String(n.id) })),
                    nodeSize: { widthPx: args.flowConfig.node.widthPx, heightPx: args.flowConfig.node.heightPx },
                  })
                }

                const dagre = () =>
                  buildDagreLayout({
                    nodes: nodeList.map(n => ({ id: String(n.id) })),
                    edges: edgeList.map(e => ({ source: String((e as { source?: unknown }).source), target: String((e as { target?: unknown }).target) })),
                    rankdir: args.rankdir,
                    nodeSize: { widthPx: args.flowConfig.node.widthPx, heightPx: args.flowConfig.node.heightPx },
                  })

                const grid = () =>
                  buildFastGridLayout({
                    nodes: nodeList.map(n => ({ id: String(n.id) })),
                    nodeSize: { widthPx: args.flowConfig.node.widthPx, heightPx: args.flowConfig.node.heightPx },
                  })

                const allowElk = nodeList.length <= DEFAULT_FLOW_ELK_MAX_NODES
                const allowDagre = nodeList.length <= DEFAULT_FLOW_DAGRE_MAX_NODES

                if (args.flowConfig.engine === 'grid') return grid()
                if (args.flowConfig.engine === 'dagre') return allowDagre ? dagre() : grid()
                if (args.flowConfig.engine === 'elk') {
                  if (!allowElk) return allowDagre ? dagre() : grid()
                  try {
                    return await buildElkLayout({ graphData: { nodes: nodeList, edges: edgeList }, config: args.flowConfig })
                  } catch {
                    return dagre()
                  }
                }

                if (!allowDagre) return grid()
                if (!allowElk) return dagre()
                try {
                  return await buildElkLayout({ graphData: { nodes: nodeList, edges: edgeList }, config: args.flowConfig })
                } catch {
                  return dagre()
                }
              })()

      const semanticMode = String(args.documentSemanticMode || 'document')
      const computedCoverageOk = hasCacheCoverage({ nodes: nodeList, positions: computed, minCoverage: 0.98 })
      const computedUnstable =
        computedCoverageOk &&
        looksUnstablePositions({ nodes: nodeList, positions: computed, nodeSize: { widthPx: nodeW, heightPx: nodeH } })
      const shouldRelax = computedUnstable
      const relaxed =
        shouldRelax && args.sceneGraphData && args.schema
          ? relaxFlowPositionsWithCollision({
              graphData: args.sceneGraphData,
              groups: args.sceneGroups,
              positions: computed,
              schema: args.schema,
              nodeSize: { widthPx: args.flowConfig.node.widthPx, heightPx: args.flowConfig.node.heightPx },
              portHandles: {
                enabled: args.flowPresentation.portHandles.enabled,
                sizePx: args.flowPresentation.portHandles.sizePx,
                offsetPx: args.flowPresentation.portHandles.offsetPx,
              },
              defaultSteps: semanticMode === 'keyword' ? 12 : (args.sceneGroups.length > 0 ? 18 : 12),
            })
          : computed

      if (cancelled) return
      if (
        args.cacheKey &&
        typeof args.setLayoutPositionsForMode === 'function' &&
        relaxed &&
        Object.keys(relaxed).length > 0
      ) {
        args.setLayoutPositionsForMode(args.cacheKey, relaxed)
      }
      setComputedPositions(relaxed)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [
    args.active,
    args.cacheKey,
    args.datasetKey,
    args.documentSemanticMode,
    args.effectiveFrontmatter,
    args.flowConfig,
    args.flowPresentation,
    args.layoutMode,
    args.layoutPositionsForMode,
    args.layoutVariant,
    args.layoutViewKey,
    args.rankdir,
    args.sceneGraphData,
    args.sceneGroups,
    args.schema,
    args.setLayoutPositionsForMode,
    computedPositions,
  ])

  return computedPositions
}
