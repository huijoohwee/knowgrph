import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { buildSchemaLayoutEngineJson2d } from '@/lib/canvas/schema-layout-engine-json'
import { buildCollapsedGroupIdsKey } from '@/lib/canvas/collapsedGroupIdsKey'
import { buildGraphMetaKeyIgnoringPending } from '@/lib/graph/graphMetaKey'
import { computeEffectiveFrontmatterMode } from '@/lib/graph/frontmatterMode'
import { readDocumentViewModeContext } from '@/lib/graph/documentViewMode'
import { computeLayoutDatasetKey, buildLayoutViewKey, buildLayoutPositionCacheKey } from '@/lib/canvas/layoutPositioning'
import { coverageOfPositions, pickSeedFromOtherRendererCache } from '@/lib/canvas/layoutSeed'
import { readSnapGridConfigFromSchema, snapScalarToGrid } from '@/lib/canvas/gridSnap'
import { useGraphStore } from '@/hooks/useGraphStore'
import { computeLayerOffsetIndices, computePositions3d, computePositionsVoxel, type Vec3 } from '@/lib/three/positions.impl'
import { projectPositionsToSphereShell } from './sphereConstraint'
import { quantizeVoxelCoordToCellCenter, quantizeVoxelCoordToGridLine, resolveMinSpacing, resolveSphereEllipsoidAxes, resolveSphereLayerSpacing, resolveSphereRadius, resolveVoxelGridStep } from './threeLayoutConfig'
import { isRadarFlowEdge, isRadarGraph, isRadarHubNode, isRadarSpokeEdge, readRadarForceConfig } from '@/lib/graph/radarForces'
import type { Canvas3dModeId } from '@/lib/config'

export { fibSphere } from '@/lib/three/positions.impl'
export type { Vec3 } from '@/lib/three/positions.impl'

export function usePositions(nodes: GraphNode[], schema: GraphSchema | null, graphDataForViewOverride?: GraphData | null, mode: Canvas3dModeId = '3d'): Record<string, Vec3> {
  const layoutPositionCacheByMode = useGraphStore(s => s.layoutPositionCacheByMode)
  const graphDataRevision = useGraphStore(s => s.graphDataRevision)
  const graphData = useGraphStore(s => s.graphData)
  const documentSemanticMode = useGraphStore(s => s.documentSemanticMode)
  const multiDimTableModeEnabled = useGraphStore(s => s.multiDimTableModeEnabled)
  const frontmatterModeEnabled = useGraphStore(s => s.frontmatterModeEnabled)
  const documentStructureBaselineLock = useGraphStore(s => s.documentStructureBaselineLock)
  const renderMediaAsNodes = useGraphStore(s => s.renderMediaAsNodes)
  const mediaPanelDensity = useGraphStore(s => s.mediaPanelDensity)
  const collapsedGroupIds = useGraphStore(s => s.collapsedGroupIds)
  const canvas2dRenderer = useGraphStore(s => s.canvas2dRenderer)
  const infiniteCanvasInteractionMode = useGraphStore(s => s.infiniteCanvasInteractionMode)

  return useMemo(() => {
    const canvas3dMode = mode
    const layoutMode = schema ? (schema.layout?.mode as string) || 'radial' : 'radial'
    const semanticModeBase = String(documentSemanticMode || 'document')
    const graphDataForView =
      (graphDataForViewOverride as unknown as { metadata?: unknown; nodes?: Array<{ type?: unknown; properties?: unknown; metadata?: unknown }> } | null) ||
      (graphData as unknown as { metadata?: unknown; nodes?: Array<{ type?: unknown; properties?: unknown; metadata?: unknown }> } | null) ||
      null
    const effectiveFrontmatter = computeEffectiveFrontmatterMode({
      frontmatterModeEnabled: frontmatterModeEnabled === true,
      documentSemanticMode: semanticModeBase as 'document' | 'keyword',
      graphData: (graphDataForViewOverride || graphData) as any,
    })
    const semanticMode = readDocumentViewModeContext({
      frontmatterModeEnabled: effectiveFrontmatter,
      multiDimTableModeEnabled: multiDimTableModeEnabled === true,
      documentSemanticMode: semanticModeBase,
      documentStructureBaselineLock: documentStructureBaselineLock === true,
    }).documentSemanticModeKey
    const datasetKey = computeLayoutDatasetKey({ graphData: graphDataForView, graphDataRevision })
    const graphMetaKey = buildGraphMetaKeyIgnoringPending((graphDataForViewOverride || graphData) as any)
    const collapsedGroupIdsKey = buildCollapsedGroupIdsKey(collapsedGroupIds)
    const schemaLayoutEngineJson = buildSchemaLayoutEngineJson2d(schema)
    const viewKey = buildLayoutViewKey({
      schemaLayoutEngineJson,
      frontmatterModeEnabled: effectiveFrontmatter,
      documentSemanticMode: semanticMode,
      graphMetaKey,
      renderMediaAsNodes: renderMediaAsNodes === true,
      mediaPanelDensity: String(mediaPanelDensity),
      collapsedGroupIdsKey,
    })
    const baseKey = buildLayoutPositionCacheKey({
      datasetKey,
      mode: layoutMode,
      frontmatterMode: effectiveFrontmatter,
      semanticMode,
      renderMode: '2d',
      viewKey,
    })
    const seed2dRenderer = canvas3dMode === 'voxel' ? 'flowchart' : canvas2dRenderer
    const layoutVariantExpected = seed2dRenderer === 'flowchart'
      ? `flowchart:v4:${semanticMode}:${String(effectiveFrontmatter ? 1 : 0)}:${String(infiniteCanvasInteractionMode)}`
      : ''
    const expectedKey = buildLayoutPositionCacheKey({
      datasetKey,
      mode: layoutMode,
      frontmatterMode: effectiveFrontmatter,
      semanticMode,
      renderMode: '2d',
      viewKey,
      renderVariant: seed2dRenderer,
      layoutVariant: layoutVariantExpected,
    })
    const seed2d = pickSeedFromOtherRendererCache({
      nodes,
      cache: layoutPositionCacheByMode as any,
      baseKey,
      expectedKey,
      expectedLayoutVariant: layoutVariantExpected,
    })
    const seed2dFromGraph = (() => {
      const graphNodes = ((graphDataForViewOverride || graphData) as GraphData | null)?.nodes || []
      if (!Array.isArray(graphNodes) || graphNodes.length === 0) return null
      const out: Record<string, { x: number; y: number }> = {}
      for (let i = 0; i < graphNodes.length; i += 1) {
        const node = graphNodes[i] as GraphNode
        const id = String(node?.id || '').trim()
        if (!id) continue
        const x2d = (node as unknown as { x?: unknown }).x
        const y2d = (node as unknown as { y?: unknown }).y
        const props = ((node as unknown as { properties?: unknown }).properties || {}) as Record<string, unknown>
        const pos3d = Array.isArray(props.pos3d) ? props.pos3d : null
        const x3d = pos3d && typeof pos3d[0] === 'number' ? pos3d[0] : Number.NaN
        const y3d = pos3d && typeof pos3d[1] === 'number' ? pos3d[1] : Number.NaN
        const x = canvas3dMode === 'voxel'
          ? (Number.isFinite(x3d) ? x3d : (typeof x2d === 'number' && Number.isFinite(x2d) ? x2d : Number.NaN))
          : (typeof x2d === 'number' && Number.isFinite(x2d) ? x2d : (Number.isFinite(x3d) ? x3d : Number.NaN))
        const y = canvas3dMode === 'voxel'
          ? (Number.isFinite(y3d) ? y3d : (typeof y2d === 'number' && Number.isFinite(y2d) ? y2d : Number.NaN))
          : (typeof y2d === 'number' && Number.isFinite(y2d) ? y2d : (Number.isFinite(y3d) ? y3d : Number.NaN))
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue
        out[id] = { x, y }
      }
      return Object.keys(out).length > 0 ? out : null
    })()
    const voxelSeed2d = (() => {
      if (canvas3dMode !== 'voxel') return seed2d
      const graphCoverage = coverageOfPositions(nodes, seed2dFromGraph)
      const cacheCoverage = coverageOfPositions(nodes, seed2d)
      if (!seed2dFromGraph && !seed2d) return null
      if (graphCoverage >= 0.98) return seed2dFromGraph
      if (cacheCoverage > graphCoverage) return seed2d
      if (graphCoverage > 0) return seed2dFromGraph
      return seed2d || seed2dFromGraph
    })()
    const edges = ((graphDataForViewOverride || graphData) as GraphData | null)?.edges || []
    if (canvas3dMode === 'voxel') {
      return computePositionsVoxel(nodes, schema, { seed2dPositions: voxelSeed2d, seedAxis: { flipY: false, normalizeToVoxelSpan: false, centerToBounds: false } })
    }
    return computePositions3d(nodes, schema, { seed2dPositions: seed2d, edges })
  }, [canvas2dRenderer, collapsedGroupIds, documentSemanticMode, documentStructureBaselineLock, frontmatterModeEnabled, graphData, graphDataForViewOverride, graphDataRevision, infiniteCanvasInteractionMode, layoutPositionCacheByMode, mediaPanelDensity, mode, multiDimTableModeEnabled, nodes, renderMediaAsNodes, schema])
}

export function Physics3D({ positions, nodes, edges, schema, dragOverrides, paused, mode = '3d' }: { positions: Record<string, Vec3>; nodes: GraphNode[]; edges: GraphData['edges']; schema: GraphSchema; dragOverrides?: React.MutableRefObject<Record<string, Vec3>>; paused?: boolean; mode?: Canvas3dModeId }) {
  const n = nodes.length
  const layerOffsetIndices = useMemo(() => computeLayerOffsetIndices(nodes), [nodes])
  const idxById = useMemo(() => {
    const m = new Map<string, number>()
    for (let i = 0; i < n; i++) m.set(nodes[i].id, i)
    return m
  }, [nodes, n])
  const posX = useRef<Float32Array>(new Float32Array(1))
  const posY = useRef<Float32Array>(new Float32Array(1))
  const posZ = useRef<Float32Array>(new Float32Array(1))
  const velX = useRef<Float32Array>(new Float32Array(1))
  const velY = useRef<Float32Array>(new Float32Array(1))
  const velZ = useRef<Float32Array>(new Float32Array(1))
  const gridRef = useRef<Map<string, number[]>>(new Map())
  const gridBucketPoolRef = useRef<number[][]>([])
  const gridCellEntriesRef = useRef<Array<{ cx: number; cy: number; cz: number; key: string; bucket: number[] }>>([])
  const gridCellEntryPoolRef = useRef<Array<{ cx: number; cy: number; cz: number; key: string; bucket: number[] }>>([])
  const skipProjectionSetRef = useRef<Set<number>>(new Set())
  const radarGraphEnabled = isRadarGraph(nodes)
  const radarForces = readRadarForceConfig(schema)
  const chargeVal = radarGraphEnabled
    ? radarForces.nodeCharge
    : (schema.layout && schema.layout.forces && typeof schema.layout.forces.charge === 'number')
      ? schema.layout.forces.charge!
      : -300
  const effectiveCharge = chargeVal * 2.0
  const sphereRadius = resolveSphereRadius(schema, n)
  const minSpacingCfg = resolveMinSpacing(schema)
  const repelRadius = Math.max(10, Math.min(sphereRadius, (typeof minSpacingCfg === 'number' ? Math.max(minSpacingCfg, 24) : 48)))
  const repelStrength = Math.max(10, Math.abs(effectiveCharge)) * 1.5
  const springStrength = 0.06
  const damping = 0.85
  const maxSpeed = 6.0
  const layerSpacing = resolveSphereLayerSpacing(schema)
  const ellipsoidAxes = resolveSphereEllipsoidAxes(schema)
  const voxelGridStep = resolveVoxelGridStep(schema)
  const voxelHalfExtent = useMemo(() => {
    let maxAbs = 0
    for (let i = 0; i < nodes.length; i += 1) {
      const id = nodes[i].id
      const p = positions[id]
      if (!p) continue
      const ax = Math.abs(p[0])
      const ay = Math.abs(p[1])
      if (ax > maxAbs) maxAbs = ax
      if (ay > maxAbs) maxAbs = ay
    }
    const padded = Math.ceil(maxAbs / Math.max(1, voxelGridStep)) * voxelGridStep + voxelGridStep * 4
    const rawExtent = Math.max(90, sphereRadius * 0.82, padded)
    const extentByLine = Math.ceil(rawExtent / Math.max(1, voxelGridStep)) * voxelGridStep
    return Math.max(voxelGridStep * 0.5, extentByLine - voxelGridStep * 0.5)
  }, [nodes, positions, sphereRadius, voxelGridStep])
  const hubOrbitEnabled = schema.three?.globeHubOrbitEnabled !== false
  const hubOrbitStrength = typeof schema.three?.globeHubOrbitStrength === 'number' && Number.isFinite(schema.three.globeHubOrbitStrength)
    ? Math.max(0, Math.min(1.8, schema.three.globeHubOrbitStrength))
    : 0.22
  const hubOrbitSpeed = typeof schema.three?.globeHubOrbitSpeed === 'number' && Number.isFinite(schema.three.globeHubOrbitSpeed)
    ? Math.max(0, Math.min(2.2, schema.three.globeHubOrbitSpeed))
    : 0.24
  const hubOrbitRadiusFactor = typeof schema.three?.globeHubOrbitRadiusFactor === 'number' && Number.isFinite(schema.three.globeHubOrbitRadiusFactor)
    ? Math.max(0.05, Math.min(0.8, schema.three.globeHubOrbitRadiusFactor))
    : 0.2
  const targetRByIndex = useMemo(() => {
    const out = new Float32Array(Math.max(1, n))
    for (let i = 0; i < n; i += 1) {
      const off = Number.isFinite(layerOffsetIndices[i]) ? layerOffsetIndices[i]! : 0
      out[i] = sphereRadius + off * layerSpacing
    }
    return out
  }, [layerOffsetIndices, layerSpacing, n, sphereRadius])
  const edgePairs = useMemo(() => {
    const linkDistanceByLabel = (schema.layout && schema.layout.forces && schema.layout.forces.linkDistanceByLabel) || {}
    const endpointId = (v: unknown): string => {
      if (typeof v === 'string' || typeof v === 'number') return String(v)
      if (v && typeof v === 'object') {
        const id = (v as { id?: unknown }).id
        if (typeof id === 'string' || typeof id === 'number') return String(id)
      }
      return ''
    }
    const arr: Array<[number, number, number]> = []
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i]
      const sourceId = endpointId(e.source)
      const targetId = endpointId(e.target)
      const si = idxById.get(sourceId)
      const ti = idxById.get(targetId)
      if (si == null || ti == null) continue
      const props = ((e as unknown as { properties?: unknown }).properties || {}) as Record<string, unknown>
      const distancePxRaw = props.distance_px
      const distancePx = typeof distancePxRaw === 'number' && Number.isFinite(distancePxRaw) ? distancePxRaw : null
      const radialDist = (() => {
        if (!radarGraphEnabled) return null
        if (isRadarSpokeEdge(e)) return radarForces.spokeDistancePx * 0.45
        if (isRadarFlowEdge(e)) return radarForces.flowDistancePx * 0.55
        return null
      })()
      const byLabel =
        linkDistanceByLabel && typeof linkDistanceByLabel[e.label] === 'number' ? linkDistanceByLabel[e.label]! : null
      const baseDist = radialDist ?? distancePx ?? byLabel ?? Math.max(28, Math.min(140, sphereRadius * 0.5))
      const dist = Math.max(22, Math.min(Math.max(80, sphereRadius * 1.8), baseDist))
      arr.push([si, ti, dist])
    }
    return arr
  }, [edges, idxById, radarForces.flowDistancePx, radarForces.spokeDistancePx, radarGraphEnabled, schema, sphereRadius])
  const orbitHubIndexByNode = useMemo(() => {
    const out = new Int32Array(Math.max(1, n))
    out.fill(-1)
    if (!radarGraphEnabled || n <= 1) return out
    const hubIds: string[] = []
    const hubSet = new Set<string>()
    const hubByCluster = new Map<string, string>()
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i]
      if (!node || !isRadarHubNode(node)) continue
      const id = String(node.id || '').trim()
      if (!id) continue
      hubIds.push(id)
      hubSet.add(id)
      const props = ((node.properties || {}) as Record<string, unknown>)
      const cluster = String(props['kg:radarCluster'] || id).trim()
      if (cluster && !hubByCluster.has(cluster)) hubByCluster.set(cluster, id)
    }
    if (hubIds.length === 0) return out
    hubIds.sort((a, b) => a.localeCompare(b))
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i]
      if (!node) continue
      const id = String(node.id || '').trim()
      if (!id || hubSet.has(id)) continue
      const props = ((node.properties || {}) as Record<string, unknown>)
      const cluster = String(props['kg:radarCluster'] || '').trim()
      const ownerId = (cluster && hubByCluster.get(cluster)) || hubIds[i % hubIds.length]
      const hubIndex = idxById.get(ownerId)
      if (typeof hubIndex === 'number') out[i] = hubIndex
    }
    for (let i = 0; i < edges.length; i += 1) {
      const edge = edges[i]
      if (!edge || !isRadarSpokeEdge(edge)) continue
      const src = String(edge.source || '').trim()
      const tgt = String(edge.target || '').trim()
      if (!src || !tgt) continue
      const hubId = hubSet.has(src) ? src : (hubSet.has(tgt) ? tgt : '')
      const nodeId = hubId === src ? tgt : (hubId === tgt ? src : '')
      if (!hubId || !nodeId || hubSet.has(nodeId)) continue
      const ni = idxById.get(nodeId)
      const hi = idxById.get(hubId)
      if (typeof ni === 'number' && typeof hi === 'number') out[ni] = hi
    }
    return out
  }, [edges, idxById, n, nodes, radarGraphEnabled])
  React.useEffect(() => {
    if (posX.current.length !== Math.max(1, n)) {
      posX.current = new Float32Array(Math.max(1, n))
      posY.current = new Float32Array(Math.max(1, n))
      posZ.current = new Float32Array(Math.max(1, n))
      velX.current = new Float32Array(Math.max(1, n))
      velY.current = new Float32Array(Math.max(1, n))
      velZ.current = new Float32Array(Math.max(1, n))
    }
    const px = posX.current, py = posY.current, pz = posZ.current
    for (let i = 0; i < n; i++) {
      const id = nodes[i].id
      const p = positions[id] || [0, 0, 0]
      px[i] = p[0]; py[i] = p[1]; pz[i] = p[2]
    }
    velX.current.fill(0); velY.current.fill(0); velZ.current.fill(0)
  }, [nodes, positions, n])

  const reclaimGrid = () => {
    const grid = gridRef.current
    if (!grid.size) return
    const pool = gridBucketPoolRef.current
    const cellPool = gridCellEntryPoolRef.current
    const entries = gridCellEntriesRef.current
    for (const bucket of grid.values()) {
      bucket.length = 0
      pool.push(bucket)
    }
    for (let i = 0; i < entries.length; i += 1) {
      const e = entries[i]
      if (e) cellPool.push(e)
    }
    entries.length = 0
    grid.clear()
  }

  useFrame((_, delta) => {
    if (paused) return
    const dt = Math.max(0.008, Math.min(0.033, delta || 0.016))
    const px = posX.current, py = posY.current, pz = posZ.current
    const vx = velX.current, vy = velY.current, vz = velZ.current
    const overrides = dragOverrides ? dragOverrides.current : undefined
    const skipProjection = overrides ? skipProjectionSetRef.current : null
    skipProjection?.clear()
    const voxelSnapEnabled = schema?.behavior?.snapGrid?.enabled === true
    if (overrides) {
      for (let i = 0; i < n; i++) {
        const id = nodes[i].id
        const ov = overrides[id]
        if (!ov) continue
        if (mode === 'voxel') {
          const nx = voxelSnapEnabled ? quantizeVoxelCoordToCellCenter(ov[0], voxelGridStep) : ov[0]
          const ny = voxelSnapEnabled ? quantizeVoxelCoordToCellCenter(ov[1], voxelGridStep) : ov[1]
          px[i] = Math.max(-voxelHalfExtent, Math.min(voxelHalfExtent, nx))
          py[i] = Math.max(-voxelHalfExtent, Math.min(voxelHalfExtent, ny))
          const base = positions[id]
          const bz = base ? Number(base[2]) : pz[i]
          pz[i] = Number.isFinite(bz) ? bz : 0
        } else {
          const behavior = schema.behavior || { allowEdgeCreation: true, allowNodeDrag: true }
          const grid = readSnapGridConfigFromSchema(schema)
          const gridEnabled = grid.enabled
          const constraint = behavior.dragConstraint || 'free'
          let nx = ov[0]
          let ny = ov[1]
          const nz = ov[2]
          if (gridEnabled) {
            nx = snapScalarToGrid(nx, grid, 'x')
            ny = snapScalarToGrid(ny, grid, 'y')
          }
          if (constraint === 'axis-x') {
            ny = py[i]
          } else if (constraint === 'axis-y') {
            nx = px[i]
          } else if (constraint === 'none') {
            nx = px[i]
            ny = py[i]
          }
          px[i] = nx; py[i] = ny; pz[i] = nz
        }
        vx[i] = 0; vy[i] = 0; vz[i] = 0
        skipProjection?.add(i)
      }
    }
    if (mode === 'voxel') {
      for (let i = 0; i < n; i += 1) {
        if (!(skipProjection && skipProjection.has(i))) {
          const nx = voxelSnapEnabled ? quantizeVoxelCoordToCellCenter(px[i], voxelGridStep) : px[i]
          const ny = voxelSnapEnabled ? quantizeVoxelCoordToCellCenter(py[i], voxelGridStep) : py[i]
          px[i] = Math.max(-voxelHalfExtent, Math.min(voxelHalfExtent, nx))
          py[i] = Math.max(-voxelHalfExtent, Math.min(voxelHalfExtent, ny))
        }
        if (!Number.isFinite(pz[i])) pz[i] = 0
        vx[i] = 0
        vy[i] = 0
        vz[i] = 0
      }
      for (let i = 0; i < n; i += 1) {
        const id = nodes[i].id
        const p = positions[id]
        if (!p) continue
        p[0] = px[i]
        p[1] = py[i]
        p[2] = pz[i]
      }
      return
    }
    const cellSize = repelRadius
    const grid = gridRef.current
    const pool = gridBucketPoolRef.current
    const entries = gridCellEntriesRef.current
    const entryPool = gridCellEntryPoolRef.current
    reclaimGrid()
    for (let i = 0; i < n; i++) {
      const cx = Math.floor(px[i] / cellSize)
      const cy = Math.floor(py[i] / cellSize)
      const cz = Math.floor(pz[i] / cellSize)
      const key = `${cx}:${cy}:${cz}`
      const existing = grid.get(key)
      if (existing) {
        existing.push(i)
      } else {
        const bucket = pool.pop() || []
        bucket.length = 0
        bucket.push(i)
        grid.set(key, bucket)

        const entry = entryPool.pop() || { cx: 0, cy: 0, cz: 0, key: '', bucket: [] }
        entry.cx = cx
        entry.cy = cy
        entry.cz = cz
        entry.key = key
        entry.bucket = bucket
        entries.push(entry)
      }
    }
    const rr = repelRadius * repelRadius
    for (let ei = 0; ei < entries.length; ei += 1) {
      const entry = entries[ei]
      const list = entry.bucket
      const cx = entry.cx
      const cy = entry.cy
      const cz = entry.cz
      for (let dxCell = -1; dxCell <= 1; dxCell += 1) {
        for (let dyCell = -1; dyCell <= 1; dyCell += 1) {
          for (let dzCell = -1; dzCell <= 1; dzCell += 1) {
            const nk = `${cx + dxCell}:${cy + dyCell}:${cz + dzCell}`
            const other = grid.get(nk)
            if (!other) continue
            for (let a = 0; a < list.length; a++) {
              const i = list[a]
              for (let b = 0; b < other.length; b++) {
                const j = other[b]
                if (j <= i && nk === entry.key) continue
                const dx = px[i] - px[j]
                const dy = py[i] - py[j]
                const dz = pz[i] - pz[j]
                const d2 = dx * dx + dy * dy + dz * dz
                if (d2 > rr || d2 < 1e-6) continue
                const inv = 1 / Math.sqrt(d2)
                const f = (repelStrength * dt) / (d2 + 1)
                const fx = dx * inv * f
                const fy = dy * inv * f
                const fz = dz * inv * f
                vx[i] += fx; vy[i] += fy; vz[i] += fz
                vx[j] -= fx; vy[j] -= fy; vz[j] -= fz
              }
            }
          }
        }
      }
    }
    for (let k = 0; k < edgePairs.length; k++) {
      const si = edgePairs[k][0], ti = edgePairs[k][1], L = edgePairs[k][2]
      const dx = px[ti] - px[si]
      const dy = py[ti] - py[si]
      const dz = pz[ti] - pz[si]
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz)
      if (len < 1e-6) continue
      const diff = len - L
      const f = springStrength * diff * dt
      const inv = 1 / len
      const fx = dx * inv * f
      const fy = dy * inv * f
      const fz = dz * inv * f
      vx[si] += fx; vy[si] += fy; vz[si] += fz
      vx[ti] -= fx; vy[ti] -= fy; vz[ti] -= fz
    }
    if (hubOrbitEnabled && radarGraphEnabled) {
      for (let i = 0; i < n; i += 1) {
        if (skipProjection && skipProjection.has(i)) continue
        const hubIdx = orbitHubIndexByNode[i]
        if (!(hubIdx >= 0) || hubIdx >= n || hubIdx === i) continue
        if (skipProjection && skipProjection.has(hubIdx)) continue
        const hx = px[hubIdx]
        const hy = py[hubIdx]
        const hz = pz[hubIdx]
        const hl = Math.sqrt(hx * hx + hy * hy + hz * hz)
        if (!(hl > 1e-6)) continue
        const ax = hx / hl
        const ay = hy / hl
        const az = hz / hl
        const relX = px[i] - hx
        const relY = py[i] - hy
        const relZ = pz[i] - hz
        const axial = relX * ax + relY * ay + relZ * az
        let tx = relX - ax * axial
        let ty = relY - ay * axial
        let tz = relZ - az * axial
        let tl = Math.sqrt(tx * tx + ty * ty + tz * tz)
        if (!(tl > 1e-4)) {
          const fallback = (i + hubIdx + 1) * 0.61803398875
          tx = Math.cos(fallback)
          ty = Math.sin(fallback)
          tz = Math.cos(fallback * 0.7)
          tl = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1
        }
        const ntx = tx / Math.max(1e-6, tl)
        const nty = ty / Math.max(1e-6, tl)
        const ntz = tz / Math.max(1e-6, tl)
        const tanX = ay * ntz - az * nty
        const tanY = az * ntx - ax * ntz
        const tanZ = ax * nty - ay * ntx
        const tanL = Math.sqrt(tanX * tanX + tanY * tanY + tanZ * tanZ)
        if (!(tanL > 1e-6)) continue
        const targetOrbitR = Math.max(6, targetRByIndex[i] * hubOrbitRadiusFactor)
        const radialErr = targetOrbitR - tl
        const pull = hubOrbitStrength * dt * 1.4
        const spin = hubOrbitSpeed * dt * 10
        vx[i] += ntx * radialErr * pull + (tanX / tanL) * spin
        vy[i] += nty * radialErr * pull + (tanY / tanL) * spin
        vz[i] += ntz * radialErr * pull + (tanZ / tanL) * spin
      }
    }
    
    for (let i = 0; i < n; i++) {
      vx[i] *= damping; vy[i] *= damping; vz[i] *= damping
      const s = Math.sqrt(vx[i] * vx[i] + vy[i] * vy[i] + vz[i] * vz[i])
      if (s > maxSpeed) {
        const inv = maxSpeed / s
        vx[i] *= inv; vy[i] *= inv; vz[i] *= inv
      }
      px[i] += vx[i]; py[i] += vy[i]; pz[i] += vz[i]
    }

    if (!overrides) {
      let sumX = 0
      let sumY = 0
      let sumZ = 0
      let count = 0
      for (let i = 0; i < n; i++) {
        const x = px[i]
        const y = py[i]
        const z = pz[i]
        if (!(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z))) continue
        sumX += x
        sumY += y
        sumZ += z
        count += 1
      }
      if (count > 0) {
        const cx = sumX / count
        const cy = sumY / count
        const cz = sumZ / count
        if (Number.isFinite(cx) && Number.isFinite(cy) && Number.isFinite(cz) && (Math.abs(cx) > 1e-3 || Math.abs(cy) > 1e-3 || Math.abs(cz) > 1e-3)) {
          for (let i = 0; i < n; i++) {
            px[i] -= cx
            py[i] -= cy
            pz[i] -= cz
          }
        }
      }
    }

    projectPositionsToSphereShell({
      px,
      py,
      pz,
      vx,
      vy,
      vz,
      targetRByIndex,
      skipIndexSet: skipProjection,
      axisX: ellipsoidAxes.x,
      axisY: ellipsoidAxes.y,
      axisZ: ellipsoidAxes.z,
    })
    for (let i = 0; i < n; i++) {
      const id = nodes[i].id
      const p = positions[id]
      if (!p) continue
      p[0] = px[i]; p[1] = py[i]; p[2] = pz[i]
    }
  })
  return null
}
