import React from 'react'
import { bindResizeSeparatorDragRuntime } from '@/lib/ui/resizeSeparatorDrag'

export function MarkdownDataViewColumnResizeHandle(props: {
  columnId: string
  width: number
  minWidth?: number
  maxWidth?: number
  onPreview: (columnId: string, width: number) => void
  onCommit?: (columnId: string, width: number) => void
}) {
  const [handleEl, setHandleEl] = React.useState<HTMLButtonElement | null>(null)
  const latestRef = React.useRef(props)
  latestRef.current = props

  React.useEffect(() => {
    if (!handleEl) return
    return bindResizeSeparatorDragRuntime<number>({
      resizeHandleEl: handleEl,
      cursor: 'col-resize',
      readCurrentValue: () => latestRef.current.width,
      setPreviewValue: next => latestRef.current.onPreview(latestRef.current.columnId, next),
      commitValue: next => latestRef.current.onCommit?.(latestRef.current.columnId, next),
      resolveNextValueFromPointerDrag: input => {
        const min = latestRef.current.minWidth ?? 72
        const max = latestRef.current.maxWidth ?? 720
        const next = input.startValue + input.deltaX
        return Math.max(min, Math.min(max, Math.round(next)))
      },
    })
  }, [handleEl])

  return (
    <button
      ref={setHandleEl}
      type="button"
      aria-label="Resize column"
      className="absolute right-0 top-0 z-20 h-full w-2 cursor-col-resize touch-none select-none bg-transparent opacity-0 transition-opacity hover:opacity-100 focus:opacity-100"
      data-kg-markdown-data-view-column-resize="1"
      style={{ transform: 'translateX(50%)' }}
      onClick={event => {
        event.preventDefault()
        event.stopPropagation()
      }}
    />
  )
}
