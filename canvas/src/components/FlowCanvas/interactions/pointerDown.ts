import * as d3 from 'd3'

import { useGraphStore } from '@/hooks/useGraphStore'
import {
  computeFlowGroupAabb,
  hitTestGroup,
  hitTestNode,
  requestFlowNativeDraw,
  type FlowNativeRuntime,
} from '@/components/FlowCanvas/nativeRuntime'
import { cancelFlowZoomRequestAnim } from '@/components/FlowCanvas/applyZoomRequestNative'
import { readAllowGroupResize } from '@/lib/canvas/groupResizePolicy'
import { lockGlobalUserSelect } from '@/lib/canvas/interaction-user-select'
import { disableAutoZoomModesForUserGesture } from '@/lib/canvas/auto-zoom-modes'
import { isSpacePanHeld } from '@/lib/canvas/space-pan'
import { readCanvasLocalPoint } from '@/lib/canvas/canvas-event-coords'
import {
  isPanDragButton,
  shouldAllowPanDragForPointerEvent,
  shouldStartSelectionDragForPreset,
} from '@/lib/canvas/viewport-controls'
import { computeDynamicGroupResizeHandlePx, pxToWorld, readGroupResizeHandleConfig } from '@/lib/canvas/groupResizeHandleConfig'
import { computeMinGroupResizeSize } from '@/lib/canvas/groupResizeMath2d'
import { computeFlowDeltaClampForNodes, computeFlowNodeClamp } from '@/components/FlowCanvas/groupContainment'

import type { FlowNativeInteractionsContext } from '@/components/FlowCanvas/interactions/context'
import type { FlowCanvasDrag } from '@/components/FlowCanvas/interactions/types'

export function createFlowNativePointerDownHandler(ctx: FlowNativeInteractionsContext) {
  const canvasEl = ctx.canvasEl
  const runtime: FlowNativeRuntime = ctx.runtime

  return (e: PointerEvent) => {
    if (!ctx.args.active) return

    ctx.viewportWheelController.destroy()
    cancelFlowZoomRequestAnim(runtime)

    const presetRaw = ctx.getPreset()
    const storeStateAtDown = useGraphStore.getState()
    const isFlowEditor = String(storeStateAtDown.canvas2dRenderer || '') === 'flowEditor'
    const preset = presetRaw
    const allowButton = e.pointerType === 'touch' || e.button === 0 || isPanDragButton(e.button, preset)
    if (!allowButton) return
    try {
      disableAutoZoomModesForUserGesture(storeStateAtDown)
    } catch {
      void 0
    }

    const local = readCanvasLocalPoint({ canvasEl, event: e })
    if (!local) return
    ctx.args.lastPointerInCanvasRef.current = { sx: local.sx, sy: local.sy, ts: Date.now() }
    const sx = local.sx
    const sy = local.sy

    const drawArgs = ctx.args.buildDrawArgs()
    const allowNodeHit = drawArgs.renderNodes !== false
    const allowGroupHit = drawArgs.renderGroups !== false
    const hit = allowNodeHit ? hitTestNode(runtime, { sx, sy }) : null
    const pointerId = e.pointerId

    const spacePanHeld = isSpacePanHeld()
    const allowPan = shouldAllowPanDragForPointerEvent({
      preset,
      eventType: 'pointerdown',
      button: e.button,
      shiftKey: e.shiftKey === true,
      spacePanHeld,
    })
    const selectionDrag = shouldStartSelectionDragForPreset({
      preset,
      button: e.button,
      shiftKey: e.shiftKey === true,
      spacePanHeld,
      selectionOnDrag: ctx.args.selectionOnDrag,
    })

    const startDrag = (next: FlowCanvasDrag) => {
      lockGlobalUserSelect()
      ctx.args.userSelectLockPointerIdRef.current = pointerId
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
      ctx.args.dragRef.current = next
    }

    if (e.pointerType === 'touch') {
      ctx.touchPointsById.set(pointerId, { sx, sy })
      if (ctx.touchPointsById.size >= 2) {
        const entries = Array.from(ctx.touchPointsById.entries())
        const first = entries[0]
        const second = entries[1]
        const a = first ? first[1] : { sx, sy }
        const b = second ? second[1] : { sx, sy }
        ctx.args.setSelectionBox(null)
        startDrag({
          type: 'pinch',
          pointerIdA: first ? first[0] : pointerId,
          pointerIdB: second ? second[0] : pointerId,
          startTransform: runtime.transform || d3.zoomIdentity,
          startA: { sx: a.sx, sy: a.sy },
          startB: { sx: b.sx, sy: b.sy },
          pointerId,
        })
        return
      }
    }

    if (spacePanHeld === true && e.button === 0 && allowPan === true && selectionDrag !== true) {
      startDrag({
        type: 'pan',
        startSx: sx,
        startSy: sy,
        startTx: runtime.transform.x,
        startTy: runtime.transform.y,
        pointerId,
      })
      return
    }

    if (hit) {
      const state = storeStateAtDown
      state.setSelectionSource('canvas')
      state.selectEdge(null)
      const mode = ctx.readEffectiveSelectMode(state, isFlowEditor)
      const wantsToggle = (mode === 'multi' || mode === 'lasso') && (e.shiftKey === true || e.metaKey === true || e.ctrlKey === true)
      const selectedAtDownRaw = Array.isArray(state.selectedNodeIds) ? state.selectedNodeIds : []
      const selectedAtDown = selectedAtDownRaw.map(v => String(v || '').trim()).filter(Boolean)
      const isHitSelected = selectedAtDown.includes(hit)
      if (wantsToggle) {
        state.selectNode(hit)
      } else if (mode === 'multi' || mode === 'lasso') {
        if (isHitSelected && selectedAtDown.length > 1) {
          state.selectNodesExpanded({ nodeIds: selectedAtDown, activeNodeId: hit })
        } else {
          state.selectNodesExpanded({ nodeIds: [hit], activeNodeId: hit })
        }
      } else {
        state.selectNode(hit)
      }

      const allowDrag = typeof ctx.args.allowNodeDragOverride === 'boolean' ? ctx.args.allowNodeDragOverride : state.schema?.behavior?.allowNodeDrag !== false
      if (!allowDrag) {
        ctx.args.setSelectionBox(null)
        requestFlowNativeDraw(runtime, ctx.args.buildDrawArgs())
        ctx.args.requestCommit()
        if (allowPan === true && selectionDrag !== true) {
          startDrag({
            type: 'pan',
            startSx: sx,
            startSy: sy,
            startTx: runtime.transform.x,
            startTy: runtime.transform.y,
            pointerId,
          })
        }
        return
      }

      const t0 = runtime.transform || d3.zoomIdentity
      const wx = (sx - t0.x) / t0.k
      const wy = (sy - t0.y) / t0.k
      const scene = runtime.scene
      if (scene) {
        const selectedForDrag = (mode === 'multi' || mode === 'lasso') && !wantsToggle && isHitSelected && selectedAtDown.length > 1
        if (selectedForDrag) {
          const memberNodeIds = selectedAtDown.map(v => String(v || '').trim()).filter(id => id && scene.nodeById.has(id))
          const startNodePosById: Record<string, { x: number; y: number }> = {}
          for (let i = 0; i < memberNodeIds.length; i += 1) {
            const id = memberNodeIds[i]
            const n = scene.nodeById.get(id)
            if (!n) continue
            startNodePosById[id] = { x: n.x, y: n.y }
          }
          const startPosById = new Map<string, { x: number; y: number }>()
          for (let i = 0; i < memberNodeIds.length; i += 1) {
            const id = memberNodeIds[i]
            const p = startNodePosById[id]
            if (!p) continue
            startPosById.set(id, p)
          }
          const deltaClamp = computeFlowDeltaClampForNodes({ runtime, nodeIds: memberNodeIds, startPosById })
          startDrag({
            type: 'nodes',
            memberNodeIds,
            startWorldX: wx,
            startWorldY: wy,
            startNodePosById,
            deltaClamp,
            pointerId,
          })
        } else {
          const node = scene.nodeById.get(hit)
          if (node) {
            const clamp = computeFlowNodeClamp({ runtime, nodeId: hit })
            startDrag({
              type: 'node',
              nodeId: hit,
              startWorldX: wx,
              startWorldY: wy,
              startNodeX: node.x,
              startNodeY: node.y,
              clamp,
              pointerId,
            })
          }
        }
      }
      requestFlowNativeDraw(runtime, ctx.args.buildDrawArgs())
      ctx.args.requestCommit()
      return
    }

    const groupHit = allowGroupHit ? hitTestGroup(runtime, { sx, sy }) : null
    if (groupHit) {
      const state = storeStateAtDown
      const selectedGroupId = String(state.selectedGroupId || '').trim()
      const allowGroupResize = readAllowGroupResize(state.schema)
      const allowDrag = typeof ctx.args.allowNodeDragOverride === 'boolean' ? ctx.args.allowNodeDragOverride : state.schema?.behavior?.allowNodeDrag !== false

      if (
        isFlowEditor &&
        allowPan === true &&
        selectionDrag !== true &&
        spacePanHeld !== true &&
        e.altKey !== true &&
        String(state.selectedGroupId || '').trim() !== String(groupHit || '').trim()
      ) {
        state.setSelectionSource('canvas')
        state.selectEdge(null)
        state.selectGroup(groupHit)
        startDrag({
          type: 'pan',
          startSx: sx,
          startSy: sy,
          startTx: runtime.transform.x,
          startTy: runtime.transform.y,
          pointerId,
        })
        return
      }

      if (e.pointerType !== 'touch' && e.button === 0 && spacePanHeld !== true && e.shiftKey !== true && e.metaKey !== true && e.ctrlKey !== true) {
        state.setSelectionSource('canvas')
        state.selectEdge(null)
        state.selectGroup(groupHit)
      }

      let groupAabbForHeader: { minX: number; minY: number; maxX: number; maxY: number } | null = null
      if (allowGroupResize) {
        const scene = runtime.scene
        const group = scene?.groups?.find(g => String(g.id || '').trim() === String(groupHit || '').trim()) || null
        if (scene && group) {
          const gCfg = runtime.presentation.groups
          const paddingPx = Math.max(0, gCfg.paddingPx)
          const labelTopExtraPx = Math.max(0, gCfg.labelTopExtraPx)
          const aabb = computeFlowGroupAabb({ scene, group, paddingPx, labelTopExtraPx })
          groupAabbForHeader = aabb ? { ...aabb } : null
          if (aabb) {
            const handleCfg = runtime.presentation.groups.resizeHandle || readGroupResizeHandleConfig(state.schema)
            const min = computeMinGroupResizeSize({
              minBoundsSizePx: handleCfg.minBoundsSizePx,
              explicitBounds: { x: aabb.minX, y: aabb.minY, w: aabb.maxX - aabb.minX, h: aabb.maxY - aabb.minY },
              autoBounds: null,
            })
            const minWidth = min.minW
            const minHeight = min.minH
            const t0 = runtime.transform || d3.zoomIdentity
            const wx = (sx - t0.x) / t0.k
            const wy = (sy - t0.y) / t0.k
            const handleSizePx = computeDynamicGroupResizeHandlePx({
              dotRadiusPx: handleCfg.dotRadiusPx,
              hitRadiusPx: handleCfg.hitRadiusPx,
              strokeWidthPx: handleCfg.strokeWidthPx,
              groupWidth: Math.max(1, aabb.maxX - aabb.minX),
              groupHeight: Math.max(1, aabb.maxY - aabb.minY),
            })
            const handleSizeWorld = pxToWorld(handleSizePx.hitRadiusPx, t0.k)
            const inHandle =
              wx >= aabb.maxX - handleSizeWorld &&
              wx <= aabb.maxX + handleSizeWorld &&
              wy >= aabb.maxY - handleSizeWorld &&
              wy <= aabb.maxY + handleSizeWorld
            if (inHandle) {
              const explicit = (group as unknown as { bounds?: unknown }).bounds
              if (!explicit || typeof explicit !== 'object' || Array.isArray(explicit)) {
                ;(group as unknown as { bounds?: unknown }).bounds = {
                  x: aabb.minX,
                  y: aabb.minY,
                  width: Math.max(1, aabb.maxX - aabb.minX),
                  height: Math.max(1, aabb.maxY - aabb.minY),
                }
              }
              startDrag({
                type: 'groupResize',
                groupId: groupHit,
                startWorldX: wx,
                startWorldY: wy,
                startBounds: {
                  x: aabb.minX,
                  y: aabb.minY,
                  width: Math.max(1, aabb.maxX - aabb.minX),
                  height: Math.max(1, aabb.maxY - aabb.minY),
                },
                minWidth,
                minHeight,
                pointerId,
              })
              return
            }
          }
        }
      }

      if (!allowDrag) {
        ctx.args.setSelectionBox(null)
        if (allowPan === true && selectionDrag !== true) {
          startDrag({
            type: 'pan',
            startSx: sx,
            startSy: sy,
            startTx: runtime.transform.x,
            startTy: runtime.transform.y,
            pointerId,
          })
        }
        return
      }

      const scene = runtime.scene
      const group = scene?.groups?.find(g => String(g.id || '').trim() === String(groupHit || '').trim()) || null
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
        const groupAabb = (() => {
          if (groupAabbForHeader) return groupAabbForHeader
          const gCfg = runtime.presentation.groups
          const paddingPx = Math.max(0, gCfg.paddingPx)
          const labelTopExtraPx = Math.max(0, gCfg.labelTopExtraPx)
          return computeFlowGroupAabb({ scene, group, paddingPx, labelTopExtraPx })
        })()
        if (groupAabb) {
          const headerHeightPxRaw = Math.max(
            16,
            runtime.presentation.labels.groupFontSizePx + 10,
            runtime.presentation.groups.labelTopExtraPx + 8,
          )
          const headerHeightWorld = pxToWorld(headerHeightPxRaw, t0.k)
          const maxHeaderWorld = Math.max(1, (groupAabb.maxY - groupAabb.minY) * 0.45)
          const headerH = Math.min(headerHeightWorld, maxHeaderWorld)
          const inHeader =
            wx >= groupAabb.minX &&
            wx <= groupAabb.maxX &&
            wy >= groupAabb.minY &&
            wy <= groupAabb.minY + headerH
          if (!inHeader) return
        }
        startDrag({
          type: 'group',
          groupId: groupHit,
          memberNodeIds,
          startWorldX: wx,
          startWorldY: wy,
          startNodePosById,
          pointerId,
        })
        return
      }
    }

    {
      const state = storeStateAtDown
      const selectMode = ctx.readEffectiveSelectMode(state, isFlowEditor)
      const allowLasso = selectMode === 'lasso' || (isFlowEditor && selectMode === 'multi' && e.shiftKey === true)
      const wantLasso =
        allowLasso &&
        e.pointerType !== 'touch' &&
        ((selectionDrag && (!isFlowEditor || e.shiftKey === true)) || (isFlowEditor && e.shiftKey === true && selectionDrag !== true))
      if (wantLasso) {
        state.setSelectionSource('canvas')
        state.selectEdge(null)
        state.selectGroup(null)
        ctx.args.setSelectionBox({ left: sx, top: sy, width: 1, height: 1 })
        const mode: 'replace' | 'add' | 'remove' =
          e.altKey === true ? 'remove' : e.shiftKey === true || e.metaKey === true || e.ctrlKey === true ? 'add' : 'replace'
        startDrag({ type: 'lasso', startSx: sx, startSy: sy, lastSx: sx, lastSy: sy, pointerId, mode })
        return
      }
    }

    if (
      !groupHit &&
      e.pointerType !== 'touch' &&
      e.button === 0 &&
      spacePanHeld !== true &&
      e.shiftKey !== true &&
      e.metaKey !== true &&
      e.ctrlKey !== true &&
      e.altKey !== true
    ) {
      const state = storeStateAtDown
      state.setSelectionSource('canvas')
      state.selectNode(null)
      state.selectEdge(null)
      state.selectGroup(null)
      ctx.args.setSelectionBox(null)
    }

    if (e.pointerType === 'touch') {
      startDrag({
        type: 'pan',
        startSx: sx,
        startSy: sy,
        startTx: runtime.transform.x,
        startTy: runtime.transform.y,
        pointerId,
      })
      return
    }

    if (allowPan !== true || selectionDrag === true) return
    startDrag({
      type: 'pan',
      startSx: sx,
      startSy: sy,
      startTx: runtime.transform.x,
      startTy: runtime.transform.y,
      pointerId,
    })
  }
}
