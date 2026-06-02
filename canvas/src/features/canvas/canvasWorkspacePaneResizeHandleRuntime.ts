import { startPointerDrag } from 'grph-shared/dom/pointerDrag'
import { createRafValueScheduler } from '@/lib/react/rafValueScheduler'

export function bindCanvasWorkspacePaneResizeHandleRuntime(args: {
  resizeHandleEl: HTMLHRElement
  readCurrentWidthPx: () => number
  setWorkspacePreviewWidthPx: (next: number) => void
  commitWorkspacePreviewWidthPx: (next: number) => void
  resolveWorkspacePreviewWidthFromPointerDrag: (input: {
    startWidthPx: number
    startClientX: number
    currentClientX: number
  }) => number
}): () => void {
  const {
    resizeHandleEl,
    readCurrentWidthPx,
    setWorkspacePreviewWidthPx,
    commitWorkspacePreviewWidthPx,
    resolveWorkspacePreviewWidthFromPointerDrag,
  } = args

  const rafSetPreviewWidth = createRafValueScheduler<number>(value => setWorkspacePreviewWidthPx(value))

  const onDown = (ev: PointerEvent) => {
    if (ev.button !== undefined && ev.button !== 0) return
    const startX = ev.clientX
    const startWidth = readCurrentWidthPx()
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
        rafSetPreviewWidth.schedule(next)
      },
      onEnd: () => {
        rafSetPreviewWidth.flush()
        setWorkspacePreviewWidthPx(pending)
        commitWorkspacePreviewWidthPx(pending)
      },
      onCancel: () => {
        rafSetPreviewWidth.flush()
        setWorkspacePreviewWidthPx(pending)
        commitWorkspacePreviewWidthPx(pending)
      },
    })
  }

  resizeHandleEl.addEventListener('pointerdown', onDown)
  return () => {
    rafSetPreviewWidth.cancel()
    resizeHandleEl.removeEventListener('pointerdown', onDown)
  }
}
