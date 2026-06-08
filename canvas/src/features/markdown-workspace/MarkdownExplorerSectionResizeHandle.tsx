import React from 'react'
import { HorizontalResizeSeparatorHr } from '@/components/ui/VerticalResizeSeparatorHr'
import { bindResizeSeparatorDragRuntime } from '@/lib/ui/resizeSeparatorDrag'
import {
  resolveMarkdownExplorerSectionResize,
  type MarkdownExplorerSectionBoundary,
  type MarkdownExplorerSectionHeightsPx,
} from './markdownExplorerSectionResize'

export function MarkdownExplorerSectionResizeHandle(props: {
  ariaLabel: string
  boundary: MarkdownExplorerSectionBoundary
  readCurrentHeightsPx: () => MarkdownExplorerSectionHeightsPx | null
  setPreviewHeightsPx: (next: MarkdownExplorerSectionHeightsPx) => void
  commitHeightsPx: (next: MarkdownExplorerSectionHeightsPx) => void
}) {
  const { ariaLabel, boundary, readCurrentHeightsPx, setPreviewHeightsPx, commitHeightsPx } = props
  const resizeHandleRef = React.useRef<HTMLHRElement | null>(null)
  const setPreviewRef = React.useRef(setPreviewHeightsPx)
  const commitRef = React.useRef(commitHeightsPx)
  const readCurrentRef = React.useRef(readCurrentHeightsPx)

  React.useEffect(() => {
    setPreviewRef.current = setPreviewHeightsPx
    commitRef.current = commitHeightsPx
    readCurrentRef.current = readCurrentHeightsPx
  }, [commitHeightsPx, readCurrentHeightsPx, setPreviewHeightsPx])

  React.useEffect(() => {
    const el = resizeHandleRef.current
    if (!el) return
    return bindResizeSeparatorDragRuntime<MarkdownExplorerSectionHeightsPx>({
      resizeHandleEl: el,
      cursor: 'row-resize',
      readCurrentValue: () => readCurrentRef.current(),
      setPreviewValue: next => setPreviewRef.current(next),
      commitValue: next => commitRef.current(next),
      resolveNextValueFromPointerDrag: input => resolveMarkdownExplorerSectionResize({
        boundary,
        startHeightsPx: input.startValue,
        deltaY: input.deltaY,
      }),
    })
  }, [boundary])

  return (
    <HorizontalResizeSeparatorHr
      ref={resizeHandleRef}
      ariaLabel={ariaLabel}
      className="kg-markdown-workspace-explorer-section-resize"
      tabIndex={0}
    />
  )
}
