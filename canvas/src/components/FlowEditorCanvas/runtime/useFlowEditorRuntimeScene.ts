import React from 'react'

import { computeFlowGroupAabb, type FlowNativeRuntime } from '@/components/FlowCanvas/nativeRuntime'
import { placeWidgetsCenteredInGroupBounds } from '@/components/FlowEditor/seedGroupSpread'
import { computeWidgetScale, computeWidgetScaledSize } from '@/components/FlowEditor/widgetZoom'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getEffectiveZoomStateForKey } from '@/lib/canvas/zoom-effective'
import { FLOW_EDITOR_INTERACTION_FRAME_EVENT } from '@/lib/canvas/flow-editor-overlay-proxy'
import { useIsomorphicLayoutEffect } from '@/lib/react/useIsomorphicLayoutEffect'
import { viewportCenterToWorld } from '@/lib/zoom/viewport'
import { readWidgetGridLayoutSettings, snapToGridPx } from '@/components/FlowEditorCanvas/flowEditorCanvasShared'

export function useFlowEditorRuntimeScene(args: {
  active: boolean
  openWidgetNodeIds: string[]
  viewportW: number
  viewportH: number
  schema: unknown
  baseGraphDataRevision: number
  zoomViewKeyRef: React.MutableRefObject<string | null>
}) {
  const flowRuntimeRefRef = React.useRef<React.MutableRefObject<FlowNativeRuntime | null> | null>(null)
  const latestAutoSeedWorldPosByNodeIdRef = React.useRef<Record<string, { x: number; y: number }>>({})

  const getLiveNodeWorldPos = React.useCallback((nodeId: string) => {
    const id = String(nodeId || '').trim()
    if (!id) return null
    const runtime = flowRuntimeRefRef.current?.current
    if (!runtime || runtime.positionsReady !== true) return null
    const n = runtime.scene?.nodeById?.get(id) || null
    if (!n) return null
    const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : null
    const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : null
    if (x == null || y == null) return null
    return { x, y }
  }, [])

  const getLiveZoomTransform = React.useCallback(() => {
    const runtime = flowRuntimeRefRef.current?.current
    const t = runtime?.transform || null
    const k = typeof t?.k === 'number' && Number.isFinite(t.k) ? t.k : null
    const x = typeof t?.x === 'number' && Number.isFinite(t.x) ? t.x : null
    const y = typeof t?.y === 'number' && Number.isFinite(t.y) ? t.y : null
    if (k == null || x == null || y == null) return null
    return { k, x, y }
  }, [])

  const getLiveContainmentGroupAabbForNode = React.useCallback((nodeId: string) => {
    const id = String(nodeId || '').trim()
    if (!id) return null
    const runtime = flowRuntimeRefRef.current?.current
    const scene = runtime?.scene
    if (!runtime || !scene) return null
    const groupIds = scene.groupIdsByNodeId?.get(id) || []
    if (!groupIds.length) return null
    const groups = Array.isArray(scene.groups) ? scene.groups : []
    if (groups.length === 0) return null

    const groupById = new Map<string, (typeof groups)[number]>()
    for (let i = 0; i < groups.length; i += 1) {
      const g = groups[i]
      const gid = String(g?.id || '').trim()
      if (gid && !groupById.has(gid)) groupById.set(gid, g)
    }

    const isContainmentGroup = (g: { id?: unknown; source?: unknown } | null): boolean => {
      if (!g) return false
      const src = String(g.source || '').trim()
      if (src === 'userSubgraph' || src === 'mermaidSubgraph' || src === 'layer' || src === 'community') return true
      const gid = String(g.id || '')
      if (gid.startsWith('subgraph:') || gid.startsWith('layer:') || gid.startsWith('community:')) return true
      return false
    }

    let bestId: string | null = null
    let bestDepth = -Infinity
    let bestSize = Infinity
    for (let i = 0; i < groupIds.length; i += 1) {
      const gid = String(groupIds[i] || '').trim()
      if (!gid) continue
      const g = groupById.get(gid) || null
      if (!isContainmentGroup(g)) continue
      const depthRaw = (g as unknown as { depth?: unknown })?.depth
      const depth = typeof depthRaw === 'number' && Number.isFinite(depthRaw) ? Math.max(0, Math.floor(depthRaw)) : 0
      const members = Array.isArray((g as unknown as { memberNodeIds?: unknown })?.memberNodeIds)
        ? ((g as unknown as { memberNodeIds: unknown[] }).memberNodeIds as unknown[])
        : []
      const size = members.length
      if (
        bestId == null
        || depth > bestDepth
        || (depth === bestDepth && size < bestSize)
        || (depth === bestDepth && size === bestSize && gid.localeCompare(bestId) < 0)
      ) {
        bestId = gid
        bestDepth = depth
        bestSize = size
      }
    }
    if (!bestId) return null
    const best = groupById.get(bestId) || null
    if (!best) return null

    const st = useGraphStore.getState()
    const openIds = Array.isArray(st.openWidgetNodeIds) ? st.openWidgetNodeIds : []
    const worldById =
      (st as unknown as { flowWidgetWorldPosByNodeId?: Record<string, { x: number; y: number }> })
        .flowWidgetWorldPosByNodeId || {}
    const autoSeedWorldById = latestAutoSeedWorldPosByNodeIdRef.current || {}
    const t =
      getLiveZoomTransform() ||
      getEffectiveZoomStateForKey({
        zoomViewKey: args.zoomViewKeyRef.current,
        zoomStateByKey: st.zoomStateByKey,
        zoomState: st.zoomState,
      }) ||
      { k: 1, x: 0, y: 0 }
    const zoomK = typeof t.k === 'number' && Number.isFinite(t.k) && t.k > 0 ? t.k : 1
    const panelScale = computeWidgetScale(zoomK, null, { mode: 'pinnedInCanvas' })
    const panelScreen = computeWidgetScaledSize(panelScale)
    const panelWorldW = panelScreen.width / Math.max(0.001, zoomK)
    const panelWorldH = panelScreen.height / Math.max(0.001, zoomK)
    const overlayAabbByNodeId: Record<string, { minX: number; minY: number; maxX: number; maxY: number }> = {}
    for (let i = 0; i < openIds.length; i += 1) {
      const openId = String(openIds[i] || '').trim()
      if (!openId) continue
      const world = worldById[openId] || autoSeedWorldById[openId]
      if (!world || !Number.isFinite(world.x) || !Number.isFinite(world.y)) continue
      overlayAabbByNodeId[openId] = {
        minX: world.x,
        minY: world.y,
        maxX: world.x + panelWorldW,
        maxY: world.y + panelWorldH,
      }
    }

    const cfg = runtime.presentation.groups
    const aabb = computeFlowGroupAabb({
      scene,
      group: best as never,
      paddingPx: cfg.paddingPx,
      labelTopExtraPx: cfg.labelTopExtraPx,
      overlayAabbByNodeId,
    })
    if (!aabb) return null
    return { groupId: bestId, ...aabb }
  }, [args.zoomViewKeyRef, getLiveZoomTransform])

  const seededPinnedWidgetWorldPosKeyRef = React.useRef<string>('')
  const autoSeededPinnedWidgetSnapshotRef = React.useRef<{
    signature: string
    positions: Record<string, { x: number; y: number }>
  }>({ signature: '', positions: {} })

  useIsomorphicLayoutEffect(() => {
    if (!args.active) return
    const openIds = args.openWidgetNodeIds
    if (!Array.isArray(openIds) || openIds.length === 0) return

    const st = useGraphStore.getState()
    const pinnedById = st.flowWidgetPinnedByNodeId || {}
    const worldById =
      (st as unknown as { flowWidgetWorldPosByNodeId?: Record<string, { x: number; y: number }> })
        .flowWidgetWorldPosByNodeId || {}

    const pendingRaw = openIds
      .map(id => String(id || '').trim())
      .filter(Boolean)
      .filter(id => {
        const v = pinnedById[id]
        const pinned = typeof v === 'boolean' ? v : true
        if (!pinned) return false
        const w = worldById[id]
        return !(w && Number.isFinite(w.x) && Number.isFinite(w.y))
      })

    const liveZoom = getLiveZoomTransform()
    const z =
      liveZoom ||
      getEffectiveZoomStateForKey({
        zoomViewKey: args.zoomViewKeyRef.current,
        zoomStateByKey: st.zoomStateByKey,
        zoomState: st.zoomState,
      }) ||
      { k: 1, x: 0, y: 0 }
    const zoomK = typeof z.k === 'number' && Number.isFinite(z.k) ? z.k : 1
    const panelScale = computeWidgetScale(zoomK, null, { mode: 'pinnedInCanvas' })
    const panelScreen = computeWidgetScaledSize(panelScale)
    const panelWorldW = panelScreen.width / Math.max(0.001, zoomK)
    const panelWorldH = panelScreen.height / Math.max(0.001, zoomK)
    const widgetGrid = readWidgetGridLayoutSettings(args.schema)

    const gapScreenPx = Math.max(24, widgetGrid.gapPx)
    const gapWorld = gapScreenPx / Math.max(0.001, zoomK)
    const cellW = (panelScreen.width + gapScreenPx) / Math.max(0.001, zoomK)
    const cellH = (panelScreen.height + gapScreenPx) / Math.max(0.001, zoomK)
    const worldStep = widgetGrid.gridEnabled ? Math.max(1, widgetGrid.stepPx) : 1
    const snapWorld = (v: number) => (worldStep > 1 ? snapToGridPx(v, worldStep) : v)

    const center = viewportCenterToWorld({ transform: z, viewportW: args.viewportW, viewportH: args.viewportH })
    const viewportHalfWorldW = args.viewportW / Math.max(0.001, zoomK) / 2
    const viewportHalfWorldH = args.viewportH / Math.max(0.001, zoomK) / 2
    const viewportBounds = {
      minX: center.x - viewportHalfWorldW,
      minY: center.y - viewportHalfWorldH,
      maxX: center.x + viewportHalfWorldW,
      maxY: center.y + viewportHalfWorldH,
    }
    const placeSpreadGridInBounds = (ids: string[], bounds: { minX: number; minY: number; maxX: number; maxY: number }) =>
      placeWidgetsCenteredInGroupBounds({
        ids,
        bounds,
        cellW,
        cellH,
        gapWorld,
        snapWorld,
      })

    const viewportBucketId = '__viewport__'
    const pinnedOpenIds = openIds
      .map(id => String(id || '').trim())
      .filter(Boolean)
      .filter(id => {
        const v = pinnedById[id]
        return typeof v === 'boolean' ? v : true
      })
      .sort((a, b) => a.localeCompare(b))
    const allBoundsByBucket = new Map<string, { minX: number; minY: number; maxX: number; maxY: number }>()
    allBoundsByBucket.set(viewportBucketId, viewportBounds)
    for (let i = 0; i < pinnedOpenIds.length; i += 1) {
      const id = pinnedOpenIds[i]!
      const group = getLiveContainmentGroupAabbForNode(id)
      if (!group) continue
      allBoundsByBucket.set(`group:${group.groupId}`, { minX: group.minX, minY: group.minY, maxX: group.maxX, maxY: group.maxY })
    }

    const bucketSignature = Array.from(allBoundsByBucket.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([bucketId, bounds]) => {
        const minX = Math.round(bounds.minX * 1000) / 1000
        const minY = Math.round(bounds.minY * 1000) / 1000
        const maxX = Math.round(bounds.maxX * 1000) / 1000
        const maxY = Math.round(bounds.maxY * 1000) / 1000
        return `${bucketId}:${minX},${minY},${maxX},${maxY}`
      })
      .join('|')

    const snapshot = autoSeededPinnedWidgetSnapshotRef.current
    const isSameWorldPos = (a: { x: number; y: number } | null | undefined, b: { x: number; y: number } | null | undefined) => {
      if (!a || !b) return false
      return Math.abs(a.x - b.x) <= 0.0001 && Math.abs(a.y - b.y) <= 0.0001
    }
    const reseedEligible = openIds
      .map(id => String(id || '').trim())
      .filter(Boolean)
      .filter(id => {
        const v = pinnedById[id]
        const pinned = typeof v === 'boolean' ? v : true
        if (!pinned) return false
        const current = worldById[id]
        if (!current || !Number.isFinite(current.x) || !Number.isFinite(current.y)) return false
        const currentLayoutSignature = `${args.baseGraphDataRevision}|${args.zoomViewKeyRef.current || ''}|${args.viewportW}x${args.viewportH}|${bucketSignature}`
        return snapshot.signature !== '' && snapshot.signature !== currentLayoutSignature && isSameWorldPos(current, snapshot.positions[id])
      })
    const overlapEligible = (() => {
      const idsByBucket = new Map<string, string[]>()
      for (let i = 0; i < pinnedOpenIds.length; i += 1) {
        const id = pinnedOpenIds[i]!
        const world = worldById[id]
        if (!world || !Number.isFinite(world.x) || !Number.isFinite(world.y)) continue
        const group = getLiveContainmentGroupAabbForNode(id)
        const bucketId = group ? `group:${group.groupId}` : viewportBucketId
        const list = idsByBucket.get(bucketId) || []
        list.push(id)
        idsByBucket.set(bucketId, list)
      }
      const overlappingIds = new Set<string>()
      const hasOverlap = (aId: string, bId: string) => {
        const a = worldById[aId]
        const b = worldById[bId]
        if (!a || !b) return false
        const overlapX = a.x < b.x + panelWorldW && b.x < a.x + panelWorldW
        const overlapY = a.y < b.y + panelWorldH && b.y < a.y + panelWorldH
        return overlapX && overlapY
      }
      for (const ids of idsByBucket.values()) {
        for (let i = 0; i < ids.length; i += 1) {
          const a = ids[i]!
          for (let j = i + 1; j < ids.length; j += 1) {
            const b = ids[j]!
            if (!hasOverlap(a, b)) continue
            overlappingIds.add(a)
            overlappingIds.add(b)
          }
        }
      }
      return Array.from(overlappingIds)
    })()
    const pending = Array.from(new Set([...pendingRaw, ...reseedEligible, ...overlapEligible])).sort((a, b) => a.localeCompare(b))
    if (pending.length === 0) return

    const currentLayoutSignature = `${args.baseGraphDataRevision}|${args.zoomViewKeyRef.current || ''}|${args.viewportW}x${args.viewportH}|${bucketSignature}`
    const idsByBucket = new Map<string, string[]>()
    const boundsByBucket = new Map<string, { minX: number; minY: number; maxX: number; maxY: number }>()
    boundsByBucket.set(viewportBucketId, viewportBounds)
    for (let i = 0; i < pending.length; i += 1) {
      const id = pending[i]!
      const group = getLiveContainmentGroupAabbForNode(id)
      const bucketId = group ? `group:${group.groupId}` : viewportBucketId
      const list = idsByBucket.get(bucketId) || []
      list.push(id)
      idsByBucket.set(bucketId, list)
      if (group) boundsByBucket.set(bucketId, { minX: group.minX, minY: group.minY, maxX: group.maxX, maxY: group.maxY })
    }
    const bucketIds = Array.from(idsByBucket.keys()).sort((a, b) => a.localeCompare(b))
    const pendingSet = new Set(pending)
    const seedKey = `${pending.join(',')}|${currentLayoutSignature}`
    if (seededPinnedWidgetWorldPosKeyRef.current === seedKey) return
    seededPinnedWidgetWorldPosKeyRef.current = seedKey

    const nextWorld = { ...worldById }
    let changed = false
    const nextAutoSeedPositions: Record<string, { x: number; y: number }> = {}
    for (let i = 0; i < bucketIds.length; i += 1) {
      const bucketId = bucketIds[i]!
      const ids = (idsByBucket.get(bucketId) || [])
        .filter(id => pendingSet.has(id))
        .sort((a, b) => a.localeCompare(b))
      if (ids.length === 0) continue
      const bounds = boundsByBucket.get(bucketId) || viewportBounds
      const placed = placeSpreadGridInBounds(ids, bounds)
      for (let j = 0; j < placed.length; j += 1) {
        const p = placed[j]!
        const prev = worldById[p.id]
        if (!prev || Math.abs(prev.x - p.x) > 0.0001 || Math.abs(prev.y - p.y) > 0.0001) changed = true
        nextWorld[p.id] = { x: p.x, y: p.y }
        nextAutoSeedPositions[p.id] = { x: p.x, y: p.y }
      }
    }
    autoSeededPinnedWidgetSnapshotRef.current = {
      signature: currentLayoutSignature,
      positions: nextAutoSeedPositions,
    }
    latestAutoSeedWorldPosByNodeIdRef.current = nextAutoSeedPositions
    if (!changed) return
    st.setFlowWidgetWorldPosByNodeId(nextWorld)
  }, [args.active, args.baseGraphDataRevision, args.openWidgetNodeIds, args.schema, args.viewportH, args.viewportW, args.zoomViewKeyRef, getLiveContainmentGroupAabbForNode, getLiveZoomTransform])

  const emitFlowEditorInteractionFrame = React.useCallback(() => {
    if (typeof window === 'undefined') return
    try {
      window.dispatchEvent(new CustomEvent(FLOW_EDITOR_INTERACTION_FRAME_EVENT))
    } catch {
      void 0
    }
  }, [])

  return {
    emitFlowEditorInteractionFrame,
    flowRuntimeRefRef,
    getLiveContainmentGroupAabbForNode,
    getLiveNodeWorldPos,
    getLiveZoomTransform,
    latestAutoSeedWorldPosByNodeIdRef,
  }
}
