import React from 'react'

import { useGraphStore } from '@/hooks/useGraphStore'
import { DEFAULT_FLOW_DAGRE_MAX_NODES, DEFAULT_FLOW_ELK_MAX_NODES } from '@/lib/graph/layoutDefaults'
import { buildElkLayout } from '@/components/FlowCanvas/elkLayout'
import { buildDagreLayout, buildFastGridLayout, buildGraphMetaKey } from '@/components/FlowCanvas/layout'
import { buildLayoutPositionCacheKey } from '@/components/GraphCanvas/layout/positioning'
import { pickSeedFromOtherRendererCache } from '@/components/FlowCanvas/seed'
import { extractNodePositions, hasCacheCoverage } from '@/components/FlowCanvas/seedPositions'
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
        seededFromOtherRendererPositionsRef.current = best
        return best
      })()
      const seededFromNodes = extractNodePositions(nodeList as ReadonlyArray<{ id?: unknown; x?: unknown; y?: unknown }>)
      const fromCache = hasCacheCoverage({ nodes: nodeList, positions: cached, minCoverage: 0.9 })
      const fromOtherRenderer = !fromCache && hasCacheCoverage({ nodes: nodeList, positions: seededFromOtherRenderer, minCoverage: 0.9 })
      const fromNodes = !fromCache && !fromOtherRenderer && hasCacheCoverage({ nodes: nodeList, positions: seededFromNodes, minCoverage: 0.9 })

      const computed = fromCache
        ? cached
        : fromOtherRenderer
          ? seededFromOtherRenderer
          : fromNodes
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

      const relaxed =
        !fromCache && args.sceneGraphData && args.schema
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
              defaultSteps: args.sceneGroups.length > 0 ? 18 : 12,
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
