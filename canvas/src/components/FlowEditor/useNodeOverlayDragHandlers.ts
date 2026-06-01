import React from 'react'

import { startPointerDrag } from 'grph-shared/dom/pointerDrag'

import { createRafLatestScheduler } from '@/lib/react/rafLatestScheduler'
import { getEffectiveZoomStateForKey } from '@/lib/canvas/zoom-effective'
import { screenToWorld } from '@/lib/zoom/viewport'
import { useGraphStore } from '@/hooks/useGraphStore'
import { emitFlowEditorInteractionFrame } from '@/lib/canvas/flow-editor-overlay-proxy'
import { lockGlobalUserSelect, unlockGlobalUserSelect } from '@/lib/canvas/interaction-user-select'
import { UI_SELECTORS } from '@/lib/config'

export function useNodeOverlayDragHandlers(args: {
  nodeId: string
  active: boolean
  floating: boolean
  pinnedInCanvas: boolean
  zoomViewKey?: string | null
  getLiveZoomTransform?: () => { k: number; x: number; y: number } | null
  pinnedTopPx: number
  pinnedLeftPx: number
  applyOverlayPosition: (opts?: { persistClamp?: boolean; emitInteractionFrame?: boolean }) => void
  persistFloatingPlacement: (pos: { top: number; left: number }) => void
  persistWorldPos: (pos: { x: number; y: number }) => void
  setSelectionSource: (source: 'canvas' | 'editor' | 'none') => void
  selectNode: (nodeId: string) => void
  setToolbarVisible: React.Dispatch<React.SetStateAction<boolean>>
  canvasWindowOffsetRef: React.MutableRefObject<{ left: number; top: number }>
  zoomStateRef: React.MutableRefObject<{ k: number; x: number; y: number } | null>
  anchoredPosRef: React.MutableRefObject<{ top: number; left: number }>
  autoStackOffset: { top: number; left: number }
  widgetWorldPosRef: React.MutableRefObject<{ x: number; y: number } | null>
  worldDragOverrideRef: React.MutableRefObject<{ x: number; y: number } | null>
  pinnedDragOverrideRef: React.MutableRefObject<{ left: number; top: number } | null>
  lastAppliedRef: React.MutableRefObject<{ left: number; top: number; scale: number; offsetLeft: number; offsetTop: number } | null>
  scaledSizeRef: React.MutableRefObject<{ width: number; height: number }>
  viewportRef: React.MutableRefObject<{ width: number; height: number }>
}) {
  const {
    nodeId,
    active,
    floating,
    pinnedInCanvas,
    zoomViewKey,
    getLiveZoomTransform,
    pinnedTopPx,
    pinnedLeftPx,
    applyOverlayPosition,
    persistFloatingPlacement,
    persistWorldPos,
    setSelectionSource,
    selectNode,
    setToolbarVisible,
    canvasWindowOffsetRef,
    zoomStateRef,
    anchoredPosRef,
    autoStackOffset,
  widgetWorldPosRef,
  worldDragOverrideRef,
  pinnedDragOverrideRef,
  lastAppliedRef,
} = args

  const handleHeaderPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest(UI_SELECTORS.draggablePanelIgnorePointerDown)) return

      if (nodeId) {
        setSelectionSource('editor')
        selectNode(nodeId)
        setToolbarVisible(true)
      }
      if (pinnedInCanvas) return

      try {
        event.preventDefault()
      } catch {
        void 0
      }
      try {
        event.stopPropagation()
      } catch {
        void 0
      }

      const startX = event.clientX
      const startY = event.clientY

      try {
        lockGlobalUserSelect()
      } catch {
        void 0
      }

      if (!floating) {
        useGraphStore.getState().setFlowWidgetDraggingNodeId(nodeId)
        applyOverlayPosition()

        const startClientX = event.clientX
        const startClientY = event.clientY
        const startOffset = canvasWindowOffsetRef.current

        const readZoom = () => {
          const liveZoom = getLiveZoomTransform ? getLiveZoomTransform() : null
          const storeZoom = getEffectiveZoomStateForKey({
            zoomViewKey,
            zoomStateByKey: useGraphStore.getState().zoomStateByKey,
            zoomState: useGraphStore.getState().zoomState,
          })
          let z = liveZoom || zoomStateRef.current
          if (!liveZoom && storeZoom && storeZoom !== z) {
            z = storeZoom
            zoomStateRef.current = storeZoom
          }
          return z || { k: 1, x: 0, y: 0 }
        }

        const z0 = readZoom()
        const storedWorld = widgetWorldPosRef.current
        const defaultWorld = screenToWorld({
          transform: z0,
          sx: anchoredPosRef.current.left + autoStackOffset.left,
          sy: anchoredPosRef.current.top + autoStackOffset.top,
        })
        const startWorld = worldDragOverrideRef.current || storedWorld || defaultWorld
        const startPointerWorld = screenToWorld({
          transform: z0,
          sx: startClientX - startOffset.left,
          sy: startClientY - startOffset.top,
        })
        const grabDx = startPointerWorld.x - startWorld.x
        const grabDy = startPointerWorld.y - startWorld.y

        let pending: { x: number; y: number } | null = null

        const flush = (p: { x: number; y: number } | null) => {
          if (!p) return
          worldDragOverrideRef.current = p
          applyOverlayPosition()
          emitFlowEditorInteractionFrame()
        }

        const scheduler = createRafLatestScheduler((p: { x: number; y: number }) => {
          pending = p
          flush(p)
        })

        startPointerDrag({
          ev: event.nativeEvent,
          cursor: 'move',
          onMove: mv => {
            const z = readZoom()
            const offset = canvasWindowOffsetRef.current
            const pointerWorld = screenToWorld({
              transform: z,
              sx: mv.clientX - offset.left,
              sy: mv.clientY - offset.top,
            })
            pending = { x: pointerWorld.x - grabDx, y: pointerWorld.y - grabDy }
            scheduler.schedule(pending)
          },
          onEnd: () => {
            scheduler.cancel()
            flush(pending)
            const out = worldDragOverrideRef.current || startWorld
            worldDragOverrideRef.current = null
            persistWorldPos(out)
            useGraphStore.getState().setFlowWidgetDraggingNodeId(null)
            unlockGlobalUserSelect()
          },
          onCancel: () => {
            scheduler.cancel()
            flush(pending)
            worldDragOverrideRef.current = null
            applyOverlayPosition()
            useGraphStore.getState().setFlowWidgetDraggingNodeId(null)
            unlockGlobalUserSelect()
          },
        })
        return
      }

      const applied = lastAppliedRef.current
      const startTop = applied ? applied.top : pinnedTopPx
      const startLeft = applied ? applied.left : pinnedLeftPx
      useGraphStore.getState().setFlowWidgetDraggingNodeId(nodeId)
      let pendingTop = startTop
      let pendingLeft = startLeft

      const flush = (pos: { top: number; left: number }) => {
        pendingTop = pos.top
        pendingLeft = pos.left
        pinnedDragOverrideRef.current = { left: pendingLeft, top: pendingTop }
        applyOverlayPosition()
        emitFlowEditorInteractionFrame()
      }

      const scheduler = createRafLatestScheduler((pos: { top: number; left: number }) => {
        flush(pos)
      })

      startPointerDrag({
        ev: event.nativeEvent,
        cursor: 'move',
        onMove: mv => {
          const dx = mv.clientX - startX
          const dy = mv.clientY - startY
          pendingTop = startTop + dy
          pendingLeft = startLeft + dx
          scheduler.schedule({ top: pendingTop, left: pendingLeft })
        },
        onEnd: () => {
          scheduler.cancel()
          flush({ top: pendingTop, left: pendingLeft })
          pinnedDragOverrideRef.current = null
          persistFloatingPlacement({ top: pendingTop, left: pendingLeft })
          useGraphStore.getState().setFlowWidgetDraggingNodeId(null)
          unlockGlobalUserSelect()
        },
        onCancel: () => {
          scheduler.cancel()
          flush({ top: pendingTop, left: pendingLeft })
          pinnedDragOverrideRef.current = null
          persistFloatingPlacement({ top: pendingTop, left: pendingLeft })
          useGraphStore.getState().setFlowWidgetDraggingNodeId(null)
          unlockGlobalUserSelect()
        },
      })
    },
    [
      active,
      applyOverlayPosition,
      autoStackOffset.left,
      autoStackOffset.top,
      canvasWindowOffsetRef,
      floating,
      getLiveZoomTransform,
      nodeId,
      pinnedInCanvas,
      pinnedLeftPx,
      pinnedTopPx,
      pinnedDragOverrideRef,
      persistFloatingPlacement,
      persistWorldPos,
      selectNode,
      setSelectionSource,
      setToolbarVisible,
      worldDragOverrideRef,
      zoomStateRef,
      zoomViewKey,
      widgetWorldPosRef,
      anchoredPosRef,
      lastAppliedRef,
    ],
  )

  return {
    handleHeaderPointerDown,
  }
}
