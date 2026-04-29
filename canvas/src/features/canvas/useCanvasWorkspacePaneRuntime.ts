import React from 'react'
import { LS_KEYS } from '@/lib/config'
import { lsInt, lsSetIntCoalesced } from '@/lib/persistence'
import { startPointerDrag } from 'grph-shared/dom/pointerDrag'
import { createRafValueScheduler } from '@/lib/react/rafValueScheduler'

const MIN_WORKSPACE_PREVIEW_WIDTH_PX = 320
const MAX_WORKSPACE_PREVIEW_WIDTH_PX = 960

function clampWorkspacePreviewWidthPx(widthPx: number): number {
  return Math.max(MIN_WORKSPACE_PREVIEW_WIDTH_PX, Math.min(MAX_WORKSPACE_PREVIEW_WIDTH_PX, widthPx))
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
  const [workspacePreviewWidthPx, setWorkspacePreviewWidthPx] = React.useState(() => {
    const raw = lsInt(LS_KEYS.workspacePreviewWidthPx, 520)
    const next = clampWorkspacePreviewWidthPx(raw)
    if (next !== raw) lsSetIntCoalesced(LS_KEYS.workspacePreviewWidthPx, next, { min: MIN_WORKSPACE_PREVIEW_WIDTH_PX, max: MAX_WORKSPACE_PREVIEW_WIDTH_PX, delayMs: 0 })
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

  React.useEffect(() => {
    if (!Number.isFinite(workspacePreviewWidthPx) || workspacePreviewWidthPx < MIN_WORKSPACE_PREVIEW_WIDTH_PX || workspacePreviewWidthPx > MAX_WORKSPACE_PREVIEW_WIDTH_PX) {
      const next = clampWorkspacePreviewWidthPx(Number.isFinite(workspacePreviewWidthPx) ? workspacePreviewWidthPx : 520)
      setWorkspacePreviewWidthPx(next)
      lsSetIntCoalesced(LS_KEYS.workspacePreviewWidthPx, next, { min: MIN_WORKSPACE_PREVIEW_WIDTH_PX, max: MAX_WORKSPACE_PREVIEW_WIDTH_PX, delayMs: 0 })
    }
  }, [workspacePreviewWidthPx])

  React.useEffect(() => {
    lsSetIntCoalesced(LS_KEYS.workspacePreviewWidthPx, workspacePreviewWidthPx, { min: MIN_WORKSPACE_PREVIEW_WIDTH_PX, max: MAX_WORKSPACE_PREVIEW_WIDTH_PX })
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
          rafSetPreviewWidthRef.current.flush()
          setWorkspacePreviewWidthPx(pending)
          lsSetIntCoalesced(LS_KEYS.workspacePreviewWidthPx, pending, { min: MIN_WORKSPACE_PREVIEW_WIDTH_PX, max: MAX_WORKSPACE_PREVIEW_WIDTH_PX, delayMs: 0 })
        },
        onCancel: () => {
          rafSetPreviewWidthRef.current.flush()
          setWorkspacePreviewWidthPx(pending)
          lsSetIntCoalesced(LS_KEYS.workspacePreviewWidthPx, pending, { min: MIN_WORKSPACE_PREVIEW_WIDTH_PX, max: MAX_WORKSPACE_PREVIEW_WIDTH_PX, delayMs: 0 })
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
