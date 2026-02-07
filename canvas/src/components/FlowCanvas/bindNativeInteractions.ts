import type React from 'react'

import * as d3 from 'd3'

import { useGraphStore } from '@/hooks/useGraphStore'
import { clampScale, hitTestGroup, hitTestNode, requestFlowNativeDraw, setFlowNativeTransform, type FlowNativeDrawArgs, type FlowNativeRuntime } from '@/components/FlowCanvas/nativeRuntime'
import { readZoomScaleExtent } from '@/lib/graph/layoutDefaults'
import { computeWheelZoomFactor, normalizeWheelDeltaYpx } from '@/lib/canvas/zoom-input'
import { lockGlobalUserSelect, unlockGlobalUserSelect } from '@/lib/canvas/interaction-user-select'
import { coerceWheelFallback, resolveWheelAnchor } from '@/lib/canvas/wheel-anchor'
import { computeZoomWheelGuardDecision, type ZoomWheelGuardState } from '@/lib/canvas/zoom-wheel-guard'
import { shouldIgnoreCanvasWheelEvent } from '@/lib/canvas/wheel-target-guard'
import { readCanvasLocalPoint } from '@/lib/canvas/canvas-event-coords'
import { relaxFlowSceneNodePositions } from '@/components/FlowCanvas/relaxScenePositions'
import { computeFlowDragRelaxPolicy } from '@/components/FlowCanvas/relaxStepPolicy'
import type { GraphData } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import type { FlowConfig } from '@/components/FlowCanvas/config'
import { UI_SELECTORS } from '@/lib/config'

export type FlowCanvasDrag =
  | null
  | {
      type: 'pan'
      startSx: number
      startSy: number
      startTx: number
      startTy: number
      pointerId: number
    }
  | {
      type: 'node'
      nodeId: string
      startWorldX: number
      startWorldY: number
      startNodeX: number
      startNodeY: number
      pointerId: number
    }
  | {
      type: 'group'
      groupId: string
      memberNodeIds: string[]
      startWorldX: number
      startWorldY: number
      startNodePosById: Record<string, { x: number; y: number }>
      pointerId: number
    }

export function bindFlowCanvasNativeInteractions(args: {
  active: boolean
  canvasEl: HTMLCanvasElement
  runtime: FlowNativeRuntime
  allowNodeDragOverride?: boolean
  collisionDuringDrag: boolean
  requestCommit: () => void
  buildDrawArgs: () => FlowNativeDrawArgs
  dragRef: React.MutableRefObject<FlowCanvasDrag>
  lastPointerInCanvasRef: React.MutableRefObject<null | { sx: number; sy: number; ts: number }>
  lastWheelIntentRef: React.MutableRefObject<null | { dir: 'in' | 'out'; ts: number }>
  zoomWheelGuardRef: React.MutableRefObject<ZoomWheelGuardState>
  userSelectLockPointerIdRef: React.MutableRefObject<number | null>
  positionsDirtySinceCommitRef: React.MutableRefObject<boolean>
  collisionSchemaRef: React.MutableRefObject<GraphSchema | null>
  collisionGraphDataRef: React.MutableRefObject<GraphData | null>
  collisionFlowConfigRef: React.MutableRefObject<FlowConfig | null>
  collisionPresentationRef: React.MutableRefObject<
    | {
        portHandles: { enabled: boolean; sizePx: number; offsetPx: number }
      }
    | null
  >
}) {
  const canvasEl = args.canvasEl
  const runtime = args.runtime

  let pendingDragRelaxRaf: number | null = null
  let lastDragRelaxMs = 0

  const scheduleDragRelax = () => {
    if (!args.collisionDuringDrag) return
    if (pendingDragRelaxRaf != null) return
    pendingDragRelaxRaf = requestAnimationFrame(() => {
      pendingDragRelaxRaf = null
      const scene = runtime.scene
      if (!scene) return

      const policy = computeFlowDragRelaxPolicy({ nodeCount: scene.nodes.length, groupCount: scene.groups?.length || 0 })
      if (!policy.enabled) return

      const now = Date.now()
      if (lastDragRelaxMs && now - lastDragRelaxMs < policy.minIntervalMs) return
      lastDragRelaxMs = now

      const schema = args.collisionSchemaRef.current
      const graphDataForZoom = args.collisionGraphDataRef.current
      const flowConfig = args.collisionFlowConfigRef.current
      const flowPresentation = args.collisionPresentationRef.current
      if (!schema || !graphDataForZoom || !flowConfig || !flowPresentation) return

      const relaxed = relaxFlowSceneNodePositions({
        graphData: graphDataForZoom,
        sceneNodes: scene.nodes,
        groups: scene.groups || [],
        schema,
        nodeSize: { widthPx: flowConfig.node.widthPx, heightPx: flowConfig.node.heightPx },
        portHandles: {
          enabled: flowPresentation.portHandles.enabled,
          sizePx: flowPresentation.portHandles.sizePx,
          offsetPx: flowPresentation.portHandles.offsetPx,
        },
        steps: policy.steps,
      })
      if (relaxed) {
        for (let i = 0; i < scene.nodes.length; i += 1) {
          const n = scene.nodes[i]
          const p = relaxed[n.id]
          if (!p) continue
          if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
          n.x = p.x
          n.y = p.y
        }
        runtime.dirty = true
      }
      requestFlowNativeDraw(runtime, args.buildDrawArgs())
    })
  }

  const onWheel = (e: WheelEvent) => {
    if (shouldIgnoreCanvasWheelEvent({ event: e, ignoreSelector: UI_SELECTORS.canvasWheelIgnore })) {
      return
    }
    const drag = args.dragRef.current
    if (drag && drag.type !== 'pan') {
      try {
        e.preventDefault()
      } catch {
        void 0
      }
      return
    }
    const state = useGraphStore.getState()
    const schema = state.schema
    const [minScale, maxScale] = readZoomScaleExtent(schema)
    const local = readCanvasLocalPoint({ canvasEl, event: e })
    const rect = local ? null : canvasEl.getBoundingClientRect()
    const now = Date.now()
    const fallback = coerceWheelFallback({
      fallback: args.lastPointerInCanvasRef.current,
      nowMs: now,
      maxAgeMs: 800,
    })
    const anchor =
      local && local.inBounds
        ? { sx: local.sx, sy: local.sy, source: 'pointer' as const }
        : resolveWheelAnchor({
            rect: rect || canvasEl.getBoundingClientRect(),
            clientX: e.clientX,
            clientY: e.clientY,
            fallback,
          })
    const sx = anchor.sx
    const sy = anchor.sy
    if (anchor.source !== 'center') {
      args.lastPointerInCanvasRef.current = { sx, sy, ts: now }
    }
    const t0 = runtime.transform || d3.zoomIdentity
    const deltaYpx = normalizeWheelDeltaYpx(e)
    const intent: 'in' | 'out' = deltaYpx < 0 ? 'in' : 'out'
    args.lastWheelIntentRef.current = { dir: intent, ts: now }

    {
      const guard = computeZoomWheelGuardDecision({
        currentK: t0.k,
        minK: minScale,
        maxK: maxScale,
        deltaYpx,
        nowMs: now,
        state: args.zoomWheelGuardRef.current,
      })
      args.zoomWheelGuardRef.current = guard.nextState
      if (guard.block) {
        try {
          e.preventDefault()
        } catch {
          void 0
        }
        return
      }
    }
    const factor = computeWheelZoomFactor(deltaYpx)
    const nextK = clampScale(t0.k * factor, { minK: minScale, maxK: maxScale })
    if (!Number.isFinite(nextK) || Math.abs(nextK - t0.k) < 1e-12) {
      try {
        e.preventDefault()
      } catch {
        void 0
      }
      return
    }
    const wx = (sx - t0.x) / t0.k
    const wy = (sy - t0.y) / t0.k
    const nextX = sx - wx * nextK
    const nextY = sy - wy * nextK
    setFlowNativeTransform(runtime, d3.zoomIdentity.translate(nextX, nextY).scale(nextK))
    requestFlowNativeDraw(runtime, args.buildDrawArgs())
    args.requestCommit()
    try {
      e.preventDefault()
    } catch {
      void 0
    }
  }

  const onPointerDown = (e: PointerEvent) => {
    if (!args.active) return
    if (e.pointerType !== 'touch' && e.button !== 0) return
    lockGlobalUserSelect()
    const local = readCanvasLocalPoint({ canvasEl, event: e })
    if (!local) {
      unlockGlobalUserSelect()
      return
    }
    args.lastPointerInCanvasRef.current = { sx: local.sx, sy: local.sy, ts: Date.now() }
    const sx = local.sx
    const sy = local.sy
    const drawArgs = args.buildDrawArgs()
    const allowNodeHit = drawArgs.renderNodes !== false
    const allowGroupHit = drawArgs.renderGroups !== false
    const hit = allowNodeHit ? hitTestNode(runtime, { sx, sy }) : null
    const pointerId = e.pointerId
    args.userSelectLockPointerIdRef.current = pointerId
    try {
      canvasEl.setPointerCapture(pointerId)
    } catch {
      void 0
    }
    try {
      e.preventDefault()
    } catch {
      void 0
    }
    if (hit) {
      const state = useGraphStore.getState()
      state.setSelectionSource('canvas')
      state.selectEdge(null)
      state.selectNode(hit)

      const allowDrag = typeof args.allowNodeDragOverride === 'boolean' ? args.allowNodeDragOverride : state.schema?.behavior?.allowNodeDrag !== false
      if (allowDrag) {
        const t0 = runtime.transform || d3.zoomIdentity
        const wx = (sx - t0.x) / t0.k
        const wy = (sy - t0.y) / t0.k
        const node = runtime.scene?.nodeById.get(hit)
        if (node) {
          args.dragRef.current = {
            type: 'node',
            nodeId: hit,
            startWorldX: wx,
            startWorldY: wy,
            startNodeX: node.x,
            startNodeY: node.y,
            pointerId,
          }
        }
      }
      requestFlowNativeDraw(runtime, args.buildDrawArgs())
      args.requestCommit()
      return
    }

    const groupHit = allowGroupHit ? hitTestGroup(runtime, { sx, sy }) : null
    if (groupHit) {
      const state = useGraphStore.getState()
      const allowDrag = typeof args.allowNodeDragOverride === 'boolean' ? args.allowNodeDragOverride : state.schema?.behavior?.allowNodeDrag !== false
      if (allowDrag) {
        const scene = runtime.scene
        const group = scene?.groups?.find(g => String(g.id || '') === groupHit) || null
        if (scene && group) {
          const membersRaw = Array.isArray(group.memberNodeIds) ? group.memberNodeIds : []
          const memberNodeIds = membersRaw.map(v => String(v || '').trim()).filter(Boolean)
          const startNodePosById: Record<string, { x: number; y: number }> = {}
          for (let i = 0; i < memberNodeIds.length; i += 1) {
            const id = memberNodeIds[i]
            const node = scene.nodeById.get(id)
            if (!node) continue
            startNodePosById[id] = { x: node.x, y: node.y }
          }
          const t0 = runtime.transform || d3.zoomIdentity
          const wx = (sx - t0.x) / t0.k
          const wy = (sy - t0.y) / t0.k
          args.dragRef.current = {
            type: 'group',
            groupId: groupHit,
            memberNodeIds,
            startWorldX: wx,
            startWorldY: wy,
            startNodePosById,
            pointerId,
          }
          return
        }
      }
    }

    args.dragRef.current = {
      type: 'pan',
      startSx: sx,
      startSy: sy,
      startTx: runtime.transform.x,
      startTy: runtime.transform.y,
      pointerId,
    }
  }

  const onPointerMove = (e: PointerEvent) => {
    const drag = args.dragRef.current
    const local = readCanvasLocalPoint({ canvasEl, event: e })
    if (local && local.inBounds) args.lastPointerInCanvasRef.current = { sx: local.sx, sy: local.sy, ts: Date.now() }
    if (!drag) return
    if (drag.pointerId !== e.pointerId) return
    if (!local) return
    const sx = local.sx
    const sy = local.sy
    if (drag.type === 'pan') {
      const dx = sx - drag.startSx
      const dy = sy - drag.startSy
      setFlowNativeTransform(runtime, d3.zoomIdentity.translate(drag.startTx + dx, drag.startTy + dy).scale(runtime.transform.k))
      requestFlowNativeDraw(runtime, args.buildDrawArgs())
      args.requestCommit()
      try {
        e.preventDefault()
      } catch {
        void 0
      }
      return
    }

    if (drag.type === 'group') {
      const t0 = runtime.transform || d3.zoomIdentity
      const wx = (sx - t0.x) / t0.k
      const wy = (sy - t0.y) / t0.k
      const dx = wx - drag.startWorldX
      const dy = wy - drag.startWorldY
      const scene = runtime.scene
      if (!scene) return
      for (let i = 0; i < drag.memberNodeIds.length; i += 1) {
        const id = drag.memberNodeIds[i]
        const node = scene.nodeById.get(id)
        const start = drag.startNodePosById[id]
        if (!node || !start) continue
        node.x = start.x + dx
        node.y = start.y + dy
      }
      runtime.dirty = true
      args.positionsDirtySinceCommitRef.current = true
      scheduleDragRelax()
      requestFlowNativeDraw(runtime, args.buildDrawArgs())
      return
    }

    const t0 = runtime.transform || d3.zoomIdentity
    const wx = (sx - t0.x) / t0.k
    const wy = (sy - t0.y) / t0.k
    const dx = wx - drag.startWorldX
    const dy = wy - drag.startWorldY
    const scene = runtime.scene
    const node = scene?.nodeById.get(drag.nodeId)
    if (!scene || !node) return
    node.x = drag.startNodeX + dx
    node.y = drag.startNodeY + dy
    runtime.dirty = true
    args.positionsDirtySinceCommitRef.current = true
    scheduleDragRelax()
    requestFlowNativeDraw(runtime, args.buildDrawArgs())
    try {
      e.preventDefault()
    } catch {
      void 0
    }
  }

  const onPointerUp = (e: PointerEvent) => {
    if (args.userSelectLockPointerIdRef.current === e.pointerId) {
      args.userSelectLockPointerIdRef.current = null
      unlockGlobalUserSelect()
    }
    const drag = args.dragRef.current
    if (!drag) return
    if (drag.pointerId !== e.pointerId) return
    args.dragRef.current = null
    args.requestCommit()
    try {
      e.preventDefault()
    } catch {
      void 0
    }
  }

  canvasEl.addEventListener('wheel', onWheel, { passive: false })
  canvasEl.addEventListener('pointerdown', onPointerDown, { passive: false })
  canvasEl.addEventListener('pointermove', onPointerMove, { passive: false })
  canvasEl.addEventListener('pointerup', onPointerUp, { passive: false })
  canvasEl.addEventListener('pointercancel', onPointerUp, { passive: false })

  return () => {
    if (args.userSelectLockPointerIdRef.current != null) {
      args.userSelectLockPointerIdRef.current = null
      unlockGlobalUserSelect()
    }
    canvasEl.removeEventListener('wheel', onWheel)
    canvasEl.removeEventListener('pointerdown', onPointerDown)
    canvasEl.removeEventListener('pointermove', onPointerMove)
    canvasEl.removeEventListener('pointerup', onPointerUp)
    canvasEl.removeEventListener('pointercancel', onPointerUp)
  }
}
