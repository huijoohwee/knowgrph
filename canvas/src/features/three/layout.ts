import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { buildSchemaLayoutEngineJson2d } from '@/lib/canvas/schema-layout-engine-json'
import { buildCollapsedGroupIdsKey } from '@/lib/canvas/collapsedGroupIdsKey'
import { buildGraphMetaKeyIgnoringPending } from '@/lib/graph/graphMetaKey'
import { computeEffectiveFrontmatterMode } from '@/lib/graph/frontmatterMode'
import { computeLayoutDatasetKey, buildLayoutViewKey, buildLayoutPositionCacheKey } from '@/lib/canvas/layoutPositioning'
import { pickSeedFromOtherRendererCache } from '@/lib/canvas/layoutSeed'
import { useGraphStore } from '@/hooks/useGraphStore'
import { computeLayerOffsetIndices, computePositions3d, type Vec3 } from './positions'
import { projectPositionsToSphereShell } from './sphereConstraint'
import { resolveMinSpacing, resolveSphereLayerSpacing, resolveSphereRadius } from './threeLayoutConfig'

export { fibSphere } from './positions'
export type { Vec3 } from './positions'

export function usePositions(nodes: GraphNode[], schema: GraphSchema | null, graphDataForViewOverride?: GraphData | null): Record<string, Vec3> {
  const layoutPositionCacheByMode = useGraphStore(s => s.layoutPositionCacheByMode)
  const graphDataRevision = useGraphStore(s => s.graphDataRevision)
  const graphData = useGraphStore(s => s.graphData)
  const documentSemanticMode = useGraphStore(s => s.documentSemanticMode)
  const frontmatterModeEnabled = useGraphStore(s => s.frontmatterModeEnabled)
  const documentStructureBaselineLock = useGraphStore(s => s.documentStructureBaselineLock)
  const renderMediaAsNodes = useGraphStore(s => s.renderMediaAsNodes)
  const mediaPanelDensity = useGraphStore(s => s.mediaPanelDensity)
  const collapsedGroupIds = useGraphStore(s => s.collapsedGroupIds)

  return useMemo(() => {
    const mode = schema ? (schema.layout?.mode as string) || 'force' : 'force'
    const semanticMode = String(documentSemanticMode || 'document')
    const graphDataForView =
      (graphDataForViewOverride as unknown as { metadata?: unknown; nodes?: Array<{ type?: unknown; properties?: unknown; metadata?: unknown }> } | null) ||
      (graphData as unknown as { metadata?: unknown; nodes?: Array<{ type?: unknown; properties?: unknown; metadata?: unknown }> } | null) ||
      null
    const effectiveFrontmatter = computeEffectiveFrontmatterMode({
      frontmatterModeEnabled: frontmatterModeEnabled === true && documentStructureBaselineLock !== true,
      documentSemanticMode: semanticMode,
      graphData: (graphDataForViewOverride || graphData) as any,
    })
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
      mode,
      frontmatterMode: effectiveFrontmatter,
      semanticMode,
      renderMode: '2d',
      viewKey,
    })
    const seed2d = pickSeedFromOtherRendererCache({
      nodes,
      cache: layoutPositionCacheByMode as any,
      baseKey,
    })
    return computePositions3d(nodes, schema, { seed2dPositions: seed2d })
  }, [collapsedGroupIds, documentSemanticMode, documentStructureBaselineLock, frontmatterModeEnabled, graphData, graphDataForViewOverride, graphDataRevision, layoutPositionCacheByMode, mediaPanelDensity, nodes, renderMediaAsNodes, schema])
}

export function Physics3D({ positions, nodes, edges, schema, dragOverrides, paused }: { positions: Record<string, Vec3>; nodes: GraphNode[]; edges: GraphData['edges']; schema: GraphSchema; dragOverrides?: React.MutableRefObject<Record<string, Vec3>>; paused?: boolean }) {
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
  const chargeVal = (schema.layout && schema.layout.forces && typeof schema.layout.forces.charge === 'number') ? schema.layout.forces.charge! : -300
  // Stronger repulsion for 3D to avoid clustering
  const effectiveCharge = chargeVal * 2.0
  const sphereRadius = resolveSphereRadius(schema, n)
  // Increase minimum spacing
  const minSpacingCfg = resolveMinSpacing(schema)
  const repelRadius = Math.max(10, Math.min(sphereRadius, (typeof minSpacingCfg === 'number' ? Math.max(minSpacingCfg, 24) : 48)))
  const repelStrength = Math.max(10, Math.abs(effectiveCharge)) * 1.5
  const springStrength = 0.06
  const damping = 0.85
  const maxSpeed = 6.0
  const layerSpacing = resolveSphereLayerSpacing(schema)
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
    const arr: Array<[number, number, number]> = []
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i]
      const si = idxById.get(String(e.source))
      const ti = idxById.get(String(e.target))
      if (si == null || ti == null) continue
      const dist = (linkDistanceByLabel && typeof linkDistanceByLabel[e.label] === 'number') ? linkDistanceByLabel[e.label]! : Math.max(28, Math.min(140, sphereRadius * 0.5))
      arr.push([si, ti, dist])
    }
    return arr
  }, [edges, idxById, schema, sphereRadius])
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
    if (overrides) {
      const behavior = schema.behavior || { allowEdgeCreation: true, allowNodeDrag: true }
      const gridEnabled = !!behavior.snapGrid?.enabled
      const gridSize = Math.max(1, behavior.snapGrid?.size ?? 10)
      const constraint = behavior.dragConstraint || 'free'
      for (let i = 0; i < n; i++) {
        const id = nodes[i].id
        const ov = overrides[id]
        if (!ov) continue
        let nx = ov[0]
        let ny = ov[1]
        const nz = ov[2]
        if (gridEnabled) {
          nx = Math.round(nx / gridSize) * gridSize
          ny = Math.round(ny / gridSize) * gridSize
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
        vx[i] = 0; vy[i] = 0; vz[i] = 0
        skipProjection?.add(i)
      }
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

    projectPositionsToSphereShell({ px, py, pz, vx, vy, vz, targetRByIndex, skipIndexSet: skipProjection })
    for (let i = 0; i < n; i++) {
      const id = nodes[i].id
      const p = positions[id]
      if (!p) continue
      p[0] = px[i]; p[1] = py[i]; p[2] = pz[i]
    }
  })
  return null
}
