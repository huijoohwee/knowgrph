import React from 'react'

import { useGraphStore } from '@/hooks/useGraphStore'
import { DEFAULT_FLOW_DAGRE_MAX_NODES, DEFAULT_FLOW_ELK_MAX_NODES } from '@/lib/graph/layoutDefaults'
import { buildElkLayout } from '@/components/FlowCanvas/elkLayout'
import { buildDagreLayout, buildFastGridLayout, buildGraphMetaKey } from '@/components/FlowCanvas/layout'
import { buildLayoutPositionCacheKey } from '@/components/GraphCanvas/layout/positioning'
import { pickSeedFromOtherRendererCache } from '@/components/FlowCanvas/seed'
import { extractNodePositions, hasCacheCoverage, looksUnstablePositions } from '@/components/FlowCanvas/seedPositions'
import { relaxFlowPositionsWithCollision } from '@/components/FlowCanvas/relaxPositions'
import { packDisjointPositions2d } from '@/components/GraphCanvas/layout/collectivePackPositions'
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
  const {
    active,
    cacheKey,
    datasetKey,
    layoutMode,
    layoutVariant,
    documentSemanticMode,
    effectiveFrontmatter,
    layoutViewKey,
    rankdir,
    sceneGraphData,
    sceneGroups,
    schema,
    flowConfig,
    flowPresentation,
    layoutPositionsForMode,
    setLayoutPositionsForMode,
  } = args

  const [computedPositions, setComputedPositions] = React.useState<Record<string, { x: number; y: number }> | null>(
    () => layoutPositionsForMode || null,
  )
  const computedPositionsRef = React.useRef<Record<string, { x: number; y: number }> | null>(computedPositions)
  const lastLayoutGraphKeyRef = React.useRef<string>('')
  const seededFromOtherRendererKeyRef = React.useRef<string>('')
  const seededFromOtherRendererPositionsRef = React.useRef<Record<string, { x: number; y: number }> | null>(null)
  const lastOutputHashRef = React.useRef<string>('')

  React.useEffect(() => {
    computedPositionsRef.current = computedPositions
  }, [computedPositions])

  const hashPositions = (
    positions: Record<string, { x: number; y: number }> | null,
    nodeIds: string[],
  ): string => {
    if (!positions) return ''
    const ids = nodeIds.length > 0 ? nodeIds : Object.keys(positions)
    const ordered = ids.length <= 250 ? [...ids].sort((a, b) => a.localeCompare(b)) : [...ids].sort((a, b) => a.localeCompare(b)).slice(0, 250)
    let h = 2166136261
    const step = Math.max(1, Math.floor(ordered.length / 200))
    for (let i = 0; i < ordered.length; i += step) {
      const id = ordered[i]
      const p = positions[id]
      if (!p) continue
      const x = Number.isFinite(p.x) ? Math.round(p.x * 10) : 0
      const y = Number.isFinite(p.y) ? Math.round(p.y * 10) : 0
      const s = `${id}:${x}:${y};`
      for (let j = 0; j < s.length; j += 1) {
        h ^= s.charCodeAt(j)
        h = Math.imul(h, 16777619)
      }
    }
    return `${nodeIds.length}|${h >>> 0}`
  }

  React.useEffect(() => {
    if (!active) return
    void cacheKey
    const next = layoutPositionsForMode || null
    setComputedPositions(prev => (prev === next ? prev : next))
  }, [active, cacheKey, layoutPositionsForMode])

  React.useEffect(() => {
    let cancelled = false
    if (!active) return
    const g = sceneGraphData
    const nodeList = Array.isArray(g?.nodes) ? g?.nodes : []
    const edgeList = Array.isArray(g?.edges) ? g?.edges : []
    const graphKey = `${nodeList.length}:${edgeList.length}:${buildGraphMetaKey(g)}:${layoutVariant}`
    if (graphKey === lastLayoutGraphKeyRef.current && computedPositionsRef.current) return
    lastLayoutGraphKeyRef.current = graphKey

    const run = async () => {
      const nodeW = Math.max(1, Math.floor(flowConfig.node.widthPx))
      const nodeH = Math.max(1, Math.floor(flowConfig.node.heightPx))
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

      const cached = layoutPositionsForMode || null
      const seededFromOtherRenderer = (() => {
        const seedKey = `${graphKey}:${String(documentSemanticMode || 'document')}:${effectiveFrontmatter ? '1' : '0'}:${layoutMode}`
        if (seededFromOtherRendererKeyRef.current === seedKey) return seededFromOtherRendererPositionsRef.current
        seededFromOtherRendererKeyRef.current = seedKey

        const cache = useGraphStore.getState().layoutPositionCacheByMode || null
        const baseKey = buildLayoutPositionCacheKey({
          datasetKey,
          mode: layoutMode,
          frontmatterMode: effectiveFrontmatter,
          semanticMode: String(documentSemanticMode || 'document'),
          renderMode: '2d',
          viewKey: layoutViewKey,
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
                    nodeSize: { widthPx: flowConfig.node.widthPx, heightPx: flowConfig.node.heightPx },
                  })
                }

                const dagre = () =>
                  buildDagreLayout({
                    nodes: nodeList.map(n => ({ id: String(n.id) })),
                    edges: edgeList.map(e => ({ source: String((e as { source?: unknown }).source), target: String((e as { target?: unknown }).target) })),
                    rankdir,
                    nodeSize: { widthPx: flowConfig.node.widthPx, heightPx: flowConfig.node.heightPx },
                  })

                const grid = () =>
                  buildFastGridLayout({
                    nodes: nodeList.map(n => ({ id: String(n.id) })),
                    nodeSize: { widthPx: flowConfig.node.widthPx, heightPx: flowConfig.node.heightPx },
                  })

                const allowElk = nodeList.length <= DEFAULT_FLOW_ELK_MAX_NODES
                const allowDagre = nodeList.length <= DEFAULT_FLOW_DAGRE_MAX_NODES

                if (flowConfig.engine === 'grid') return grid()
                if (flowConfig.engine === 'dagre') return allowDagre ? dagre() : grid()
                if (flowConfig.engine === 'elk') {
                  if (!allowElk) return allowDagre ? dagre() : grid()
                  try {
                    return await buildElkLayout({ graphData: { nodes: nodeList, edges: edgeList }, config: flowConfig })
                  } catch {
                    return dagre()
                  }
                }

                if (!allowDagre) return grid()
                if (!allowElk) return dagre()
                try {
                  return await buildElkLayout({ graphData: { nodes: nodeList, edges: edgeList }, config: flowConfig })
                } catch {
                  return dagre()
                }
              })()

      const semanticMode = String(documentSemanticMode || 'document')
      const computedCoverageOk = hasCacheCoverage({ nodes: nodeList, positions: computed, minCoverage: 0.98 })
      const computedUnstable =
        computedCoverageOk &&
        looksUnstablePositions({ nodes: nodeList, positions: computed, nodeSize: { widthPx: nodeW, heightPx: nodeH } })
      const estimateOverlapPressure = (positions: Record<string, { x: number; y: number }> | null): number => {
        if (!positions) return 0
        if (nodeList.length < 3) return 0
        const cell = Math.max(8, Math.floor(Math.max(nodeW, nodeH) * 0.75))
        const counts = new Map<string, number>()
        let used = 0
        for (let i = 0; i < nodeList.length; i += 1) {
          const id = String(nodeList[i]?.id || '')
          if (!id) continue
          const p = positions[id]
          if (!p) continue
          const x = p.x
          const y = p.y
          if (!Number.isFinite(x) || !Number.isFinite(y)) continue
          const gx = Math.floor(x / cell)
          const gy = Math.floor(y / cell)
          const key = `${gx}:${gy}`
          counts.set(key, (counts.get(key) || 0) + 1)
          used += 1
        }
        if (used < 3) return 0
        let collisions = 0
        for (const c of counts.values()) {
          if (c > 1) collisions += c - 1
        }
        return collisions / used
      }
      const overlapPressure = estimateOverlapPressure(computed)
      const shouldRelax = computedUnstable || overlapPressure >= 0.005
      const relaxed =
        shouldRelax && sceneGraphData && schema
          ? relaxFlowPositionsWithCollision({
              graphData: sceneGraphData,
              groups: sceneGroups,
              positions: computed,
              schema,
              nodeSize: { widthPx: flowConfig.node.widthPx, heightPx: flowConfig.node.heightPx },
              portHandles: {
                enabled: flowPresentation.portHandles.enabled,
                sizePx: flowPresentation.portHandles.sizePx,
                offsetPx: flowPresentation.portHandles.offsetPx,
              },
              defaultSteps: semanticMode === 'keyword' ? 12 : (sceneGroups.length > 0 ? 18 : 12),
            })
          : computed
      const packed =
        relaxed
          ? packDisjointPositions2d({
              nodeIds: nodeList.map(n => String(n.id)),
              edges: edgeList.map(e => ({ source: String((e as { source?: unknown }).source), target: String((e as { target?: unknown }).target) })),
              positions: relaxed,
              nodeSize: { widthPx: nodeW, heightPx: nodeH },
              groups: sceneGroups,
              paddingPx: semanticMode === 'document' ? 120 : 80,
              targetAspect: (() => {
                const raw = schema?.layout?.fitTargetAspectRatio
                return typeof raw === 'number' && Number.isFinite(raw) && raw > 0.05 ? raw : 16 / 9
              })(),
            })
          : relaxed

      if (cancelled) return
      const nodeIds = nodeList.map(n => String(n.id)).filter(Boolean)
      const outHash = hashPositions(packed, nodeIds)
      if (outHash && outHash === lastOutputHashRef.current) return
      lastOutputHashRef.current = outHash
      if (
        cacheKey &&
        typeof setLayoutPositionsForMode === 'function' &&
        packed &&
        Object.keys(packed).length > 0
      ) {
        setLayoutPositionsForMode(cacheKey, packed)
      }
      setComputedPositions(packed)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [
    active,
    cacheKey,
    datasetKey,
    documentSemanticMode,
    effectiveFrontmatter,
    flowConfig,
    flowPresentation,
    layoutMode,
    layoutPositionsForMode,
    layoutVariant,
    layoutViewKey,
    rankdir,
    sceneGraphData,
    sceneGroups,
    schema,
    setLayoutPositionsForMode,
  ])

  return computedPositions
}
