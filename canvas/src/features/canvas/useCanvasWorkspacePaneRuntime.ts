import React from 'react'
import { LS_KEYS } from '@/lib/config'
import { lsInt, lsSetIntCoalesced } from '@/lib/persistence'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  WORKSPACE_EDITOR_CANVAS_GUTTER_PX,
  resolveWorkspaceEditorPaneMinWidthPx,
  resolveWorkspaceEditorPaneDefaultWidthPx,
  resolveWorkspacePaneMaxWidthPx,
} from '@/features/workspace-table/workspaceViewCanvasDefaults'
import { isWorkspaceEditorOverlayOpen } from '@/features/workspace-table/workspaceTableSsot'

type CanvasWorkspacePaneResizeHandleRuntimeModule = {
  bindCanvasWorkspacePaneResizeHandleRuntime: (args: {
    resizeHandleEl: HTMLHRElement
    readCurrentWidthPx: () => number
    setWorkspacePreviewWidthPx: (next: number) => void
    persistWorkspacePreviewWidthPx: (next: number) => void
    resolveWorkspacePreviewWidthFromPointerDrag: (input: {
      startWidthPx: number
      startClientX: number
      currentClientX: number
    }) => number
  }) => () => void
}

let canvasWorkspacePaneResizeHandleRuntimePromise: Promise<CanvasWorkspacePaneResizeHandleRuntimeModule> | null = null

const loadCanvasWorkspacePaneResizeHandleRuntime = (): Promise<CanvasWorkspacePaneResizeHandleRuntimeModule> => {
  if (!canvasWorkspacePaneResizeHandleRuntimePromise) {
    canvasWorkspacePaneResizeHandleRuntimePromise = import('@/features/canvas/canvasWorkspacePaneResizeHandleRuntime')
      .then(mod => mod as CanvasWorkspacePaneResizeHandleRuntimeModule)
      .catch(err => {
        canvasWorkspacePaneResizeHandleRuntimePromise = null
        throw err
      })
  }
  return canvasWorkspacePaneResizeHandleRuntimePromise
}

function resolveWorkspacePreviewWidthBounds() {
  const minPx = resolveWorkspaceEditorPaneMinWidthPx()
  const maxPx = resolveWorkspacePaneMaxWidthPx({
    minPx,
    rightGutterPx: WORKSPACE_EDITOR_CANVAS_GUTTER_PX,
  })
  return { minPx, maxPx }
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
  const workspaceEditorOverlayOpen = useGraphStore(s => isWorkspaceEditorOverlayOpen(s))
  const [workspacePreviewWidthPx, setWorkspacePreviewWidthPx] = React.useState(() => {
    const bounds = resolveWorkspacePreviewWidthBounds()
    const raw = lsInt(
      LS_KEYS.workspacePreviewWidthPx,
      resolveWorkspaceEditorPaneDefaultWidthPx({
        minPx: bounds.minPx,
        maxPx: bounds.maxPx,
      }),
    )
    const next = clampWorkspacePreviewWidthPx(raw)
    if (next !== raw) {
      lsSetIntCoalesced(LS_KEYS.workspacePreviewWidthPx, next, { min: bounds.minPx, max: bounds.maxPx, delayMs: 0 })
    }
    return next
  })
  const workspacePreviewWidthPxRef = React.useRef(workspacePreviewWidthPx)
  workspacePreviewWidthPxRef.current = workspacePreviewWidthPx
  const [resizeHandleEl, setResizeHandleEl] = React.useState<HTMLHRElement | null>(null)

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
    let cancelled = false
    let cleanup: (() => void) | null = null
    const persistWorkspacePreviewWidthPx = (next: number) => {
      const bounds = resolveWorkspacePreviewWidthBounds()
      lsSetIntCoalesced(LS_KEYS.workspacePreviewWidthPx, next, { min: bounds.minPx, max: bounds.maxPx, delayMs: 0 })
    }
    void loadCanvasWorkspacePaneResizeHandleRuntime()
      .then(mod => {
        if (cancelled) return
        cleanup = mod.bindCanvasWorkspacePaneResizeHandleRuntime({
          resizeHandleEl: el,
          readCurrentWidthPx: () => workspacePreviewWidthPxRef.current,
          setWorkspacePreviewWidthPx,
          persistWorkspacePreviewWidthPx,
          resolveWorkspacePreviewWidthFromPointerDrag,
        })
      })
      .catch(() => {
        if (cancelled) return
      })
    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [resizeHandleEl])

  return {
    workspacePreviewWidthPx,
    setResizeHandleEl,
  }
}
