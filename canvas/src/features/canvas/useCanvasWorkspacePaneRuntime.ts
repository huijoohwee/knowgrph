import React from 'react'
import { LS_KEYS } from '@/lib/config'
import { lsInt, lsSetIntCoalesced } from '@/lib/persistence'
import { startPointerDrag } from 'grph-shared/dom/pointerDrag'
import { createRafValueScheduler } from '@/lib/react/rafValueScheduler'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  resolveWorkspacePaneMaxWidthPx,
} from '@/features/workspace-table/workspaceViewCanvasDefaults'

const MIN_WORKSPACE_PREVIEW_WIDTH_PX = 320
const WORKSPACE_PREVIEW_RIGHT_GUTTER_PX = 48

function resolveWorkspacePreviewWidthBounds() {
  const maxPx = resolveWorkspacePaneMaxWidthPx({
    minPx: MIN_WORKSPACE_PREVIEW_WIDTH_PX,
    rightGutterPx: WORKSPACE_PREVIEW_RIGHT_GUTTER_PX,
  })
  return { minPx: MIN_WORKSPACE_PREVIEW_WIDTH_PX, maxPx }
}

function clampWorkspacePreviewWidthPx(widthPx: number): number {
  const bounds = resolveWorkspacePreviewWidthBounds()
  return Math.max(bounds.minPx, Math.min(bounds.maxPx, widthPx))
}

export function resolveWorkspacePreviewWidthFromPointerDrag(args: {
  startWidthPx: number
  startClientX: number
  currentClientX: number
}): number {
  const dx = args.currentClientX - args.startClientX
  return clampWorkspacePreviewWidthPx(Math.round(args.startWidthPx + dx))
}

export function useCanvasWorkspacePaneRuntime(): {
  workspacePreviewWidthPx: number
  setResizeHandleEl: React.Dispatch<React.SetStateAction<HTMLHRElement | null>>
} {
  const workspaceEditorOverlayOpen = useGraphStore(
    s => s.workspaceViewMode === 'editor' && s.workspaceCanvasPaneOpen === true,
  )
  const [workspacePreviewWidthPx, setWorkspacePreviewWidthPx] = React.useState(() => {
    const raw = lsInt(
      LS_KEYS.workspacePreviewWidthPx,
      resolveWorkspaceEditorPaneDefaultWidthPx({
        minPx: MIN_WORKSPACE_PREVIEW_WIDTH_PX,
        maxPx: resolveWorkspacePreviewWidthBounds().maxPx,
      }),
    )
    const next = clampWorkspacePreviewWidthPx(raw)
    if (next !== raw) {
      const bounds = resolveWorkspacePreviewWidthBounds()
      lsSetIntCoalesced(LS_KEYS.workspacePreviewWidthPx, next, { min: bounds.minPx, max: bounds.maxPx, delayMs: 0 })
    }
    return next
  })
  const workspacePreviewWidthPxRef = React.useRef(workspacePreviewWidthPx)
  workspacePreviewWidthPxRef.current = workspacePreviewWidthPx
  const [resizeHandleEl, setResizeHandleEl] = React.useState<HTMLHRElement | null>(null)
  const rafSetPreviewWidthRef = React.useRef(createRafValueScheduler<number>(v => setWorkspacePreviewWidthPx(v)))

  React.useEffect(() => {
    const raf = rafSetPreviewWidthRef.current
    return () => {
      raf.cancel()
    }
  }, [])

  const wasEditorOverlayOpenRef = React.useRef<boolean>(workspaceEditorOverlayOpen)
  React.useEffect(() => {
    const wasOpen = wasEditorOverlayOpenRef.current
    wasEditorOverlayOpenRef.current = workspaceEditorOverlayOpen
    if (!workspaceEditorOverlayOpen || wasOpen) return
    const bounds = resolveWorkspacePreviewWidthBounds()
    const next = clampWorkspacePreviewWidthPx(workspacePreviewWidthPxRef.current)
    if (next === workspacePreviewWidthPxRef.current) return
    setWorkspacePreviewWidthPx(next)
    lsSetIntCoalesced(LS_KEYS.workspacePreviewWidthPx, next, { min: bounds.minPx, max: bounds.maxPx, delayMs: 0 })
  }, [workspaceEditorOverlayOpen])

  React.useEffect(() => {
    const bounds = resolveWorkspacePreviewWidthBounds()
    if (!Number.isFinite(workspacePreviewWidthPx) || workspacePreviewWidthPx < bounds.minPx || workspacePreviewWidthPx > bounds.maxPx) {
      const next = clampWorkspacePreviewWidthPx(
        Number.isFinite(workspacePreviewWidthPx)
          ? workspacePreviewWidthPx
          : resolveWorkspaceEditorPaneDefaultWidthPx({
              minPx: bounds.minPx,
              maxPx: bounds.maxPx,
            }),
      )
      setWorkspacePreviewWidthPx(next)
      lsSetIntCoalesced(LS_KEYS.workspacePreviewWidthPx, next, { min: bounds.minPx, max: bounds.maxPx, delayMs: 0 })
    }
  }, [workspacePreviewWidthPx])

  React.useEffect(() => {
    const bounds = resolveWorkspacePreviewWidthBounds()
    lsSetIntCoalesced(LS_KEYS.workspacePreviewWidthPx, workspacePreviewWidthPx, { min: bounds.minPx, max: bounds.maxPx })
  }, [workspacePreviewWidthPx])

  React.useEffect(() => {
    const el = resizeHandleEl
    if (!el) return
    const onDown = (ev: PointerEvent) => {
      if (ev.button !== undefined && ev.button !== 0) return
      const startX = ev.clientX
      const startWidth = workspacePreviewWidthPxRef.current
      let pending = startWidth
      startPointerDrag({
        ev,
        cursor: 'col-resize',
        shouldStart: down => {
          if (down.button !== undefined && down.button !== 0) return false
          return true
        },
        onMove: mv => {
          const next = resolveWorkspacePreviewWidthFromPointerDrag({
            startWidthPx: startWidth,
            startClientX: startX,
            currentClientX: mv.clientX,
          })
          pending = next
          rafSetPreviewWidthRef.current.schedule(next)
        },
        onEnd: () => {
          const bounds = resolveWorkspacePreviewWidthBounds()
          rafSetPreviewWidthRef.current.flush()
          setWorkspacePreviewWidthPx(pending)
          lsSetIntCoalesced(LS_KEYS.workspacePreviewWidthPx, pending, { min: bounds.minPx, max: bounds.maxPx, delayMs: 0 })
        },
        onCancel: () => {
          const bounds = resolveWorkspacePreviewWidthBounds()
          rafSetPreviewWidthRef.current.flush()
          setWorkspacePreviewWidthPx(pending)
          lsSetIntCoalesced(LS_KEYS.workspacePreviewWidthPx, pending, { min: bounds.minPx, max: bounds.maxPx, delayMs: 0 })
        },
      })
    }
    el.addEventListener('pointerdown', onDown)
    return () => el.removeEventListener('pointerdown', onDown)
  }, [resizeHandleEl])

  return {
    workspacePreviewWidthPx,
    setResizeHandleEl,
  }
}
