import React from 'react'
import { startPointerDrag } from 'grph-shared/dom/pointerDrag'
import { createRafValueScheduler } from '@/lib/react/rafValueScheduler'
import { HorizontalResizeSeparatorHr } from '@/components/ui/VerticalResizeSeparatorHr'
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

  const schedulerRef = React.useRef(
    createRafValueScheduler<MarkdownExplorerSectionHeightsPx>(value => {
      setPreviewRef.current(value)
    }),
  )

  React.useEffect(() => () => schedulerRef.current.cancel(), [])

  React.useEffect(() => {
    const el = resizeHandleRef.current
    if (!el) return
    const handlePointerDown = (ev: PointerEvent) => {
      if (ev.button !== undefined && ev.button !== 0) return
      const startHeightsPx = readCurrentRef.current()
      if (!startHeightsPx) return
      const startClientY = ev.clientY
      let pendingHeightsPx = startHeightsPx

      startPointerDrag({
        ev,
        cursor: 'row-resize',
        shouldStart: down => {
          if (down.button !== undefined && down.button !== 0) return false
          return true
        },
        onMove: move => {
          pendingHeightsPx = resolveMarkdownExplorerSectionResize({
            boundary,
            startHeightsPx,
            deltaY: move.clientY - startClientY,
          })
          schedulerRef.current.schedule(pendingHeightsPx)
        },
        onEnd: () => {
          schedulerRef.current.flush()
          setPreviewRef.current(pendingHeightsPx)
          commitRef.current(pendingHeightsPx)
        },
        onCancel: () => {
          schedulerRef.current.flush()
          setPreviewRef.current(pendingHeightsPx)
          commitRef.current(pendingHeightsPx)
        },
      })
    }
    el.addEventListener('pointerdown', handlePointerDown)
    return () => el.removeEventListener('pointerdown', handlePointerDown)
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
