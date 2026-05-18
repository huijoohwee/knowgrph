import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { isWorkspaceGraphMutationBlocked } from '@/features/workspace-table/workspaceTableSsot'
import { DEFAULT_FLOW_DAGRE_MAX_NODES, DEFAULT_FLOW_ELK_MAX_NODES } from '@/lib/graph/layoutDefaults'
import { buildElkLayout } from '@/components/FlowCanvas/elkLayout'
import { buildDagreLayout, buildFastGridLayout, buildGraphMetaKeyIgnoringPending } from '@/components/FlowCanvas/layout'
import { buildLayoutPositionCacheKey } from '@/components/GraphCanvas/layout/positioning'
import { pickPreferredLayoutSeed, pickSeedFromOtherRendererCache } from '@/components/FlowCanvas/seed'
import { extractNodePositions, hasCacheCoverage, looksUnstablePositions } from '@/components/FlowCanvas/seedPositions'
import { relaxFlowPositionsWithCollision } from '@/components/FlowCanvas/relaxPositions'
import { packDisjointPositions2d } from '@/components/GraphCanvas/layout/collectivePackPositions'
import { readCollisionConfig, readGroupLabelTopExtra } from '@/components/GraphCanvas/layout/collisionConfig'
import { computeBorderGapPx } from '@/lib/graph/collision/borderGap'
import { readGroupStrokeWidthPx } from '@/lib/graph/collision/strokeWidth'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import type { FlowConfig } from '@/components/FlowCanvas/config'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'
import { computeRadarGalaxyPositions2d } from '@/lib/graph/radarGalaxyLayout'
import { getCachedGraphLookup } from '@/lib/graph/lookupCache'

export function useFlowComputedPositions(args: {
  active: boolean
  cacheKey: string
  datasetKey: string
  graphDataRevision: number
  layoutMode: string
  layoutVariant: string
  flowEditorMode?: boolean
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
    graphDataRevision,
    layoutMode,
    layoutVariant,
    flowEditorMode,
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
  const layoutPositionsForModeRef = React.useRef<Record<string, { x: number; y: number }> | null>(layoutPositionsForMode || null)

  React.useEffect(() => {
    computedPositionsRef.current = computedPositions
  }, [computedPositions])

  React.useEffect(() => {
    layoutPositionsForModeRef.current = layoutPositionsForMode || null
  }, [layoutPositionsForMode])

  const sceneGraphLookup = React.useMemo(() => {
    return getCachedGraphLookup({
      cacheScope: 'flow-canvas-computed-positions-scene-graph',
      graphData: sceneGraphData,
      graphRevision: graphDataRevision,
    })
  }, [graphDataRevision, sceneGraphData])
  const sceneGraphNodeById = sceneGraphLookup?.nodeById || null

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
    setComputedPositions(prev => {
      if (prev === next) return prev
      const ids = Array.isArray(sceneGraphData?.nodes)
        ? sceneGraphData!.nodes.map(n => String(n.id || '')).filter(Boolean)
        : []
      const prevHash = hashPositions(prev, ids)
      const nextHash = hashPositions(next, ids)
      if (prevHash && nextHash && prevHash === nextHash) return prev
      if (!prevHash && !nextHash) return prev
      return next
    })
  }, [active, cacheKey, layoutPositionsForMode, sceneGraphData])

  React.useEffect(() => {
    let cancelled = false
    if (!active) return
    const g = sceneGraphData
    const nodeList = Array.isArray(g?.nodes) ? g?.nodes : []
    const edgeList = Array.isArray(g?.edges) ? g?.edges : []
    const semanticGraphKey = buildGraphMetaKeyIgnoringPending(g)
    const sourceSeedHash = hashPositions(
      extractNodePositions(nodeList as ReadonlyArray<{ id?: unknown; x?: unknown; y?: unknown }>),
      nodeList.map(n => String(n?.id || '')).filter(Boolean),
    )
    const graphKey = `graph:${semanticGraphKey}:${nodeList.length}:${edgeList.length}:${layoutVariant}:${sourceSeedHash}`
    if (graphKey === lastLayoutGraphKeyRef.current && computedPositionsRef.current) return
    lastLayoutGraphKeyRef.current = graphKey

    const run = async () => {
      const nodeW = Math.max(1, Math.floor(flowConfig.node.widthPx))
      const nodeH = Math.max(1, Math.floor(flowConfig.node.heightPx))
      const usePerNodeVisualSize = String((g as unknown as { context?: unknown })?.context || '') === 'frontmatter-mermaid'

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
          const dims = (() => {
            if (!usePerNodeVisualSize) return { w: nodeW, h: nodeH }
            const n = sceneGraphNodeById?.get(id) as unknown as { properties?: unknown } | undefined
            const props = n?.properties && typeof n.properties === 'object' && !Array.isArray(n.properties) ? (n.properties as Record<string, unknown>) : null
            const vw = props && typeof props['visual:width'] === 'number' && Number.isFinite(props['visual:width'] as number) ? (props['visual:width'] as number) : null
            const vh = props && typeof props['visual:height'] === 'number' && Number.isFinite(props['visual:height'] as number) ? (props['visual:height'] as number) : null
            return { w: vw != null ? Math.max(1, Math.floor(vw)) : nodeW, h: vh != null ? Math.max(1, Math.floor(vh)) : nodeH }
          })()
          out[id] = { x: x - dims.w / 2, y: y - dims.h / 2 }
        }
        return out
      }

      const cached = layoutPositionsForModeRef.current || null
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
          allowVariantFallback: false,
        })
        const normalized = centerToTopLeft(best)
        seededFromOtherRendererPositionsRef.current = normalized
        return normalized
      })()
      const seededFromNodes = centerToTopLeft(extractNodePositions(nodeList as ReadonlyArray<{ id?: unknown; x?: unknown; y?: unknown }>))
      const cacheCoverageOk = hasCacheCoverage({ nodes: nodeList, positions: cached, minCoverage: 0.9 })
      const cacheUnstable = cacheCoverageOk && looksUnstablePositions({ nodes: nodeList, positions: cached, nodeSize: { widthPx: nodeW, heightPx: nodeH } })
      const allowCache = cacheCoverageOk && !cacheUnstable

      const preferSourceSeededPositions =
        flowEditorMode === true &&
        effectiveFrontmatter === true &&
        !usePerNodeVisualSize

      const shouldUseCacheFirst = !preferSourceSeededPositions
      const cacheAllowed = shouldUseCacheFirst && allowCache

      const otherCoverageOk = !cacheAllowed && hasCacheCoverage({ nodes: nodeList, positions: seededFromOtherRenderer, minCoverage: 0.9 })
      const otherUnstable = otherCoverageOk && looksUnstablePositions({ nodes: nodeList, positions: seededFromOtherRenderer, nodeSize: { widthPx: nodeW, heightPx: nodeH } })
      const allowOther = otherCoverageOk && !otherUnstable

      const nodesCoverageOk = !cacheAllowed && !allowOther && hasCacheCoverage({ nodes: nodeList, positions: seededFromNodes, minCoverage: 0.9 })
      const nodesUnstable = nodesCoverageOk && looksUnstablePositions({ nodes: nodeList, positions: seededFromNodes, nodeSize: { widthPx: nodeW, heightPx: nodeH } })
      const allowNodes = nodesCoverageOk && !nodesUnstable

      const preferMermaid = usePerNodeVisualSize && nodesCoverageOk && seededFromNodes

      const isMermaidLayout = usePerNodeVisualSize
      const preferredSeed = isMermaidLayout
        ? (nodesCoverageOk ? seededFromNodes : null)
        : pickPreferredLayoutSeed({
            preferSourceSeededPositions,
            cachedPositions: cached,
            allowCached: cacheAllowed,
            otherRendererPositions: seededFromOtherRenderer,
            allowOther,
            sourcePositions: seededFromNodes,
            allowSource: allowNodes,
          })
      const computed = preferredSeed
        ? preferredSeed
        : await (async () => {
                if (layoutMode === 'radial') {
                  const dim = Math.max(
                    1200,
                    Math.floor(Math.sqrt(Math.max(1, nodeList.length))) * Math.max(nodeW, nodeH) * 4,
                  )
                  const radial = computeRadarGalaxyPositions2d({
                    nodes: nodeList as unknown as GraphNode[],
                    edges: edgeList as unknown as GraphEdge[],
                    width: dim,
                    height: dim,
                    paddingPx: Math.max(24, Math.floor(Math.max(nodeW, nodeH) * 0.5)),
                  })
                  const radialTopLeft = centerToTopLeft(radial)
                  if (radialTopLeft && hasCacheCoverage({ nodes: nodeList, positions: radialTopLeft, minCoverage: 0.9 })) {
                    return radialTopLeft
                  }
                }
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
                    spacingPx: flowEditorMode === true
                      ? {
                          nodesep: Math.max(14, Math.min(90, Math.round(flowConfig.node.widthPx * 0.12))),
                          ranksep: Math.max(22, Math.min(140, Math.round(flowConfig.node.heightPx * 1.15))),
                        }
                      : undefined,
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
      const estimateNodeOverlapPressure = (positions: Record<string, { x: number; y: number }> | null): number => {
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

      const estimateGroupOverlapPressure = (positions: Record<string, { x: number; y: number }> | null): number => {
        if (!positions) return 0
        if (!schema) return 0
        if (!sceneGroups || sceneGroups.length < 2) return 0

        const groupPadRaw = schema.layout?.groups?.padding
        const groupPad = typeof groupPadRaw === 'number' && Number.isFinite(groupPadRaw) ? Math.max(0, groupPadRaw) : 0
        const labelTopExtra = readGroupLabelTopExtra(schema)
        const borderGapMinPx = readCollisionConfig(schema).groupBbox.borderGapPx

        const maxDepth = (() => {
          let m = 0
          for (let i = 0; i < sceneGroups.length; i += 1) {
            const d = sceneGroups[i]
            const depth = typeof d?.depth === 'number' && Number.isFinite(d.depth) ? Math.max(0, Math.floor(d.depth)) : 0
            if (depth > m) m = depth
          }
          return m
        })()

        const nodeById = new Map<string, { w: number; h: number }>()
        for (let i = 0; i < nodeList.length; i += 1) {
          const n = nodeList[i]
          const id = String(n?.id || '').trim()
          if (!id) continue
          const props = (n?.properties || {}) as Record<string, unknown>
          const wRaw = typeof props['visual:width'] === 'number' && Number.isFinite(props['visual:width']) ? (props['visual:width'] as number) : null
          const hRaw = typeof props['visual:height'] === 'number' && Number.isFinite(props['visual:height']) ? (props['visual:height'] as number) : null
          const w = wRaw != null && wRaw > 0 ? Math.max(24, Math.min(2400, Math.floor(wRaw))) : nodeW
          const h = hRaw != null && hRaw > 0 ? Math.max(16, Math.min(1800, Math.floor(hRaw))) : nodeH
          nodeById.set(id, { w, h })
        }

        type GroupAabb = { minX: number; minY: number; maxX: number; maxY: number; w: number; h: number }
        const aabbs: GroupAabb[] = []

        for (let gi = 0; gi < sceneGroups.length; gi += 1) {
          const g = sceneGroups[gi]
          const memberNodeIds = Array.isArray(g?.memberNodeIds) ? g.memberNodeIds : []
          if (memberNodeIds.length === 0) continue

          const depth = typeof g?.depth === 'number' && Number.isFinite(g.depth) ? Math.max(0, Math.floor(g.depth)) : 0
          const strokeWidthPx = readGroupStrokeWidthPx(schema, depth, maxDepth)
          const borderGapPx = computeBorderGapPx(strokeWidthPx, borderGapMinPx)
          const pad = Math.max(0, groupPad + borderGapPx)

          let minX = Infinity
          let minY = Infinity
          let maxX = -Infinity
          let maxY = -Infinity
          let used = 0

          for (let mi = 0; mi < memberNodeIds.length; mi += 1) {
            const nid = String(memberNodeIds[mi] || '').trim()
            if (!nid) continue
            const p = positions[nid]
            if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
            const sz = nodeById.get(nid) || { w: nodeW, h: nodeH }
            minX = Math.min(minX, p.x - pad)
            minY = Math.min(minY, p.y - pad - labelTopExtra)
            maxX = Math.max(maxX, p.x + sz.w + pad)
            maxY = Math.max(maxY, p.y + sz.h + pad)
            used += 1
          }

          if (used === 0 || !Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) continue
          const w = Math.max(1, maxX - minX)
          const h = Math.max(1, maxY - minY)
          aabbs.push({ minX, minY, maxX, maxY, w, h })
        }

        if (aabbs.length < 2) return 0

        let sumW = 0
        let sumH = 0
        for (let i = 0; i < aabbs.length; i += 1) {
          sumW += aabbs[i]!.w
          sumH += aabbs[i]!.h
        }
        const avgW = sumW / aabbs.length
        const avgH = sumH / aabbs.length
        const cell = Math.max(48, Math.floor(Math.max(32, Math.min(1200, Math.max(avgW, avgH) * 0.6))))

        const buckets = new Map<string, number>()
        const add = (gx: number, gy: number) => {
          const key = `${gx}:${gy}`
          buckets.set(key, (buckets.get(key) || 0) + 1)
        }

        for (let i = 0; i < aabbs.length; i += 1) {
          const b = aabbs[i]!
          const gx0 = Math.floor(b.minX / cell)
          const gx1 = Math.floor(b.maxX / cell)
          const gy0 = Math.floor(b.minY / cell)
          const gy1 = Math.floor(b.maxY / cell)
          const span = (gx1 - gx0 + 1) * (gy1 - gy0 + 1)
          if (!Number.isFinite(span) || span <= 0) continue
          if (span > 36) {
            const cx = (b.minX + b.maxX) * 0.5
            const cy = (b.minY + b.maxY) * 0.5
            add(Math.floor(cx / cell), Math.floor(cy / cell))
            continue
          }
          for (let gx = gx0; gx <= gx1; gx += 1) {
            for (let gy = gy0; gy <= gy1; gy += 1) add(gx, gy)
          }
        }

        let collisions = 0
        for (const c of buckets.values()) {
          if (c > 1) collisions += c - 1
        }
        return collisions / aabbs.length
      }

      const nodeOverlapPressure = estimateNodeOverlapPressure(computed)
      const groupOverlapPressure = estimateGroupOverlapPressure(computed)
      const overlapPressure = Math.max(nodeOverlapPressure, groupOverlapPressure)
      const shouldRelax =
        !isMermaidLayout &&
        ((computedUnstable && overlapPressure >= 0.01) || overlapPressure >= 0.02)
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
              defaultSteps: semanticMode === 'keyword' ? 10 : (sceneGroups.length > 0 ? 12 : 8),
            })
          : computed
      const hasMultipleComponents = (() => {
        if (!relaxed) return false
        if (nodeList.length < 2) return false
        const nodeIds = nodeList.map(n => String(n.id)).filter(Boolean)
        const adj = new Map<string, string[]>()
        for (let i = 0; i < nodeIds.length; i += 1) adj.set(nodeIds[i]!, [])
        for (let i = 0; i < edgeList.length; i += 1) {
          const e = edgeList[i] as unknown as { source?: unknown; target?: unknown }
          const s = String(e.source || '').trim()
          const t = String(e.target || '').trim()
          if (!s || !t) continue
          const a = adj.get(s)
          const b = adj.get(t)
          if (!a || !b) continue
          a.push(t)
          b.push(s)
        }
        const visited = new Set<string>()
        let comps = 0
        for (let i = 0; i < nodeIds.length; i += 1) {
          const start = nodeIds[i]!
          if (visited.has(start)) continue
          comps += 1
          if (comps > 1) return true
          const q = [start]
          visited.add(start)
          while (q.length) {
            const cur = q.pop()!
            const ns = adj.get(cur) || []
            for (let j = 0; j < ns.length; j += 1) {
              const nxt = ns[j]!
              if (visited.has(nxt)) continue
              visited.add(nxt)
              q.push(nxt)
            }
          }
        }
        return false
      })()

      const shouldPack = !isMermaidLayout && hasMultipleComponents && nodeOverlapPressure >= 0.02

      const packed =
        isMermaidLayout
          ? relaxed
          : !shouldPack
          ? relaxed
          : relaxed
          ? packDisjointPositions2d({
              nodeIds: nodeList.map(n => String(n.id)),
              edges: edgeList.map(e => ({ source: String((e as { source?: unknown }).source), target: String((e as { target?: unknown }).target) })),
              positions: relaxed,
              nodeSize: { widthPx: nodeW, heightPx: nodeH },
              groups: sceneGroups,
              paddingPx: (() => {
                const flow = schema?.layout?.flow
                const pack = flow && typeof flow === 'object' ? (flow as { pack?: { paddingPxDocument?: unknown; paddingPxKeyword?: unknown } }).pack : null
                const rawDoc = pack ? pack.paddingPxDocument : null
                const rawKey = pack ? pack.paddingPxKeyword : null
                const doc = typeof rawDoc === 'number' && Number.isFinite(rawDoc) ? rawDoc : 80
                const keyword = typeof rawKey === 'number' && Number.isFinite(rawKey) ? rawKey : 64
                const base = semanticMode === 'document' ? doc : keyword
                const basePx = Math.max(0, Math.min(240, Math.floor(base)))
                if (flowEditorMode !== true) return basePx
                const nodeMin = Math.max(1, Math.min(nodeW, nodeH))
                const cap = Math.max(28, Math.min(96, Math.floor(24 + nodeMin * 0.35)))
                return Math.max(0, Math.min(basePx, cap))
              })(),
              targetAspect: (() => {
                const raw = schema?.layout?.fitTargetAspectRatio
                const base = typeof raw === 'number' && Number.isFinite(raw) && raw > 0.05 ? raw : 16 / 9
                if (flowEditorMode !== true) return base
                return Math.max(0.8, Math.min(1.6, base))
              })(),
            })
          : relaxed

      if (cancelled) return
      const nodeIds = nodeList.map(n => String(n.id)).filter(Boolean)
      const outHash = hashPositions(packed, nodeIds)
      if (outHash && outHash === lastOutputHashRef.current) return
      lastOutputHashRef.current = outHash
      if (!isMermaidLayout) {
        const workspaceState = useGraphStore.getState()
        if (
          cacheKey &&
          typeof setLayoutPositionsForMode === 'function' &&
          packed &&
          Object.keys(packed).length > 0 &&
          !isWorkspaceGraphMutationBlocked(workspaceState)
        ) {
          setLayoutPositionsForMode(cacheKey, packed)
        }
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
    flowEditorMode,
    documentSemanticMode,
    effectiveFrontmatter,
    flowConfig,
    flowPresentation,
    graphDataRevision,
    layoutMode,
    layoutVariant,
    layoutViewKey,
    rankdir,
    sceneGraphData,
    sceneGraphNodeById,
    sceneGroups,
    schema,
    setLayoutPositionsForMode,
  ])

  return computedPositions
}
