import React from 'react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import {
  UI_RESPONSIVE_BLOCK_MENU_ROW_CLASSNAME,
  UI_RESPONSIVE_DATA_VIEW_NARROW_MENU_PANEL_CLASSNAME,
  UI_RESPONSIVE_SMALL_ICON_ACTION_CLASSNAME,
} from '@/lib/ui/responsiveElementClasses'
import { clampLocalOverlayTopLeftFullyInViewport } from '@/lib/ui/overlayClamp'
import { readOverlayElementSize } from '@/lib/ui/overlayPlacement'
import type { SsotSurface } from 'grph-shared/ssot/types'
import { MoreHorizontal } from 'lucide-react'
import { getLinkDisplayMode, setLinkDisplayMode } from './linkDisplayMode'
import { MARKDOWN_DATA_VIEW_COPY } from '@/lib/config-copy/markdownDataViewCopy'

export type MarkdownSelectionToolbarState = {
  x: number
  y: number
  startLine: number
  endLine: number
  text: string
  menuOpen?: boolean
}

export type MarkdownSelectionToolbarProps = {
  toolbar: MarkdownSelectionToolbarState | null
  onClose: () => void
  onShowOnCanvas: (startLine: number, endLine: number) => void
  onShowInViewer: (line: number) => void
  onShowInEditor: (line: number) => void
  onShowInPresentation: (line: number) => void
  onShowInSlidesGallery: (line: number) => void
  onShowInGraphDataTable: (line: number) => void
  currentView: SsotSurface
}

export function MarkdownSelectionToolbar(props: MarkdownSelectionToolbarProps) {
  const {
    toolbar,
    onClose,
    onShowOnCanvas,
    onShowInViewer,
    onShowInEditor,
    onShowInPresentation,
    onShowInSlidesGallery,
    onShowInGraphDataTable,
    currentView
  } = props

  const [menuOpen, setMenuOpen] = React.useState<boolean>(!!toolbar?.menuOpen)
  const [linkMode, setLinkMode] = React.useState<'snapshot' | 'card'>(() =>
    toolbar ? getLinkDisplayMode(toolbar.startLine) : 'snapshot',
  )
  const rootRef = React.useRef<HTMLElement | null>(null)
  const [clampedPosition, setClampedPosition] = React.useState<{ left: number; top: number } | null>(null)
  const updateClampedPosition = React.useCallback(() => {
    if (!toolbar) {
      setClampedPosition(null)
      return
    }
    const root = rootRef.current
    const offsetParent = root?.offsetParent instanceof HTMLElement ? root.offsetParent : null
    const rootRect = offsetParent?.getBoundingClientRect?.() || { top: 0, left: 0 }
    const viewport = {
      width: Math.max(1, typeof window !== 'undefined' ? window.innerWidth || document.documentElement.clientWidth || 1 : 1),
      height: Math.max(1, typeof window !== 'undefined' ? window.innerHeight || document.documentElement.clientHeight || 1 : 1),
    }
    const size = readOverlayElementSize(root)
    const next = clampLocalOverlayTopLeftFullyInViewport({
      localPos: { left: toolbar.x, top: toolbar.y },
      localRootRect: rootRect,
      size,
      viewport,
      snapPx: 1,
    })
    setClampedPosition(prev => {
      if (prev && prev.left === next.left && prev.top === next.top) return prev
      return next
    })
  }, [toolbar])

  React.useEffect(() => {
    if (!toolbar) {
      setMenuOpen(false)
      setClampedPosition(null)
      return
    }
    setMenuOpen(!!toolbar.menuOpen)
    setLinkMode(getLinkDisplayMode(toolbar.startLine))
  }, [toolbar])

  React.useLayoutEffect(() => {
    updateClampedPosition()
  }, [menuOpen, updateClampedPosition])

  React.useEffect(() => {
    if (!toolbar) return
    let rafId: number | null = null
    const schedule = () => {
      if (rafId != null) return
      rafId = window.requestAnimationFrame(() => {
        rafId = null
        updateClampedPosition()
      })
    }
    schedule()
    const root = rootRef.current
    const hasResizeObserver = typeof ResizeObserver !== 'undefined'
    const observer = hasResizeObserver ? new ResizeObserver(schedule) : null
    if (observer && root) {
      observer.observe(root)
      const menu = root.querySelector('[data-kg-markdown-selection-toolbar-menu="true"]')
      if (menu instanceof HTMLElement) observer.observe(menu)
    }
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, true)
    return () => {
      if (rafId != null) {
        window.cancelAnimationFrame(rafId)
        rafId = null
      }
      observer?.disconnect()
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule, true)
    }
  }, [menuOpen, toolbar, updateClampedPosition])

  if (!toolbar) return null
  const btnClass = `${UI_RESPONSIVE_BLOCK_MENU_ROW_CLASSNAME} px-3 py-1 text-left ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg} disabled:opacity-50 disabled:cursor-not-allowed`
  const bubbleButtonClass = `${UI_RESPONSIVE_SMALL_ICON_ACTION_CLASSNAME} rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`
  const safePosition = clampedPosition || { left: toolbar.x, top: toolbar.y }

  const handleSetLinkMode = (mode: 'snapshot' | 'card') => {
    setLinkDisplayMode(toolbar.startLine, mode)
    setLinkMode(mode)
    onClose()
  }

  return (
    <section
      ref={rootRef}
      className="absolute z-50"
      style={{ left: `${safePosition.left}px`, top: `${safePosition.top}px` }}
      onPointerDown={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      aria-label="Selection actions"
    >
      <button
        type="button"
        aria-label="Selection actions"
        className={bubbleButtonClass}
        onClick={() => setMenuOpen(prev => !prev)}
      >
        <MoreHorizontal className="w-3.5 h-3.5 shrink-0" />
      </button>
      {menuOpen ? (
        <menu
          className={`kg-data-view-floating-menu absolute left-0 mt-1 z-50 ${UI_THEME_TOKENS.panel.bg} border ${UI_THEME_TOKENS.panel.border} rounded shadow-md text-xs ${UI_THEME_TOKENS.text.primary} flex flex-col ${UI_RESPONSIVE_DATA_VIEW_NARROW_MENU_PANEL_CLASSNAME} list-none m-0 p-0`}
          role="menu"
          data-kg-markdown-selection-toolbar-menu="true"
        >
          <button
            type="button"
            className={btnClass}
            onClick={() => { onShowOnCanvas(toolbar.startLine, toolbar.endLine); onClose() }}
          >
            Show on Canvas
          </button>
          <button
            type="button"
            className={btnClass}
            disabled={currentView === 'markdown.viewer'}
            onClick={() => { onShowInViewer(toolbar.startLine); onClose() }}
          >
            Show in Viewer
          </button>
          <button
            type="button"
            className={btnClass}
            disabled={currentView === 'markdown.editor'}
            onClick={() => { onShowInEditor(toolbar.startLine); onClose() }}
          >
            Show in Editor
          </button>
          <button
            type="button"
            className={btnClass}
            disabled={currentView === 'markdown.presentation'}
            onClick={() => { onShowInPresentation(toolbar.startLine); onClose() }}
          >
            Show in Presentation
          </button>
          <button
            type="button"
            className={btnClass}
            disabled={currentView === 'markdown.slides'}
            onClick={() => { onShowInSlidesGallery(toolbar.startLine); onClose() }}
          >
            Show in Slides Gallery
          </button>
          <button
            type="button"
            className={btnClass}
            disabled={currentView === 'table'}
            onClick={() => { onShowInGraphDataTable(toolbar.startLine); onClose() }}
          >
            {MARKDOWN_DATA_VIEW_COPY.showInLabel}
          </button>
          <hr className={`my-1 border-0 ${UI_THEME_TOKENS.panel.border} border-t`} />
          <button
            type="button"
            className={btnClass}
            disabled={linkMode === 'snapshot'}
            onClick={() => handleSetLinkMode('snapshot')}
          >
            Link: Inline URL (default)
          </button>
          <button
            type="button"
            className={btnClass}
            disabled={linkMode === 'card'}
            onClick={() => handleSetLinkMode('card')}
          >
            Link: Horizontal Card
          </button>
        </menu>
      ) : null}
    </section>
  )
}
