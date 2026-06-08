import { bindResizeSeparatorDragRuntime } from '@/lib/ui/resizeSeparatorDrag'

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

  return bindResizeSeparatorDragRuntime<number>({
    resizeHandleEl,
    cursor: 'col-resize',
    readCurrentValue: readCurrentWidthPx,
    setPreviewValue: setWorkspacePreviewWidthPx,
    commitValue: commitWorkspacePreviewWidthPx,
    resolveNextValueFromPointerDrag: input => resolveWorkspacePreviewWidthFromPointerDrag({
      startWidthPx: input.startValue,
      startClientX: input.startClientX,
      currentClientX: input.currentClientX,
    }),
  })
}
