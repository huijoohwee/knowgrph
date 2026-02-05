import React from 'react'
import { LS_KEYS } from '@/lib/config'
import { lsBool, lsInt, lsSetBool, lsSetInt } from '@/lib/persistence'
import { startPointerDrag } from 'grph-shared/dom/pointerDrag'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import IconButton from '@/components/IconButton'
import { VerticalResizeSeparatorHr } from '@/components/ui/VerticalResizeSeparatorHr'
import { EmbeddedCanvasPreviewFrame } from '@/components/EmbeddedCanvasPreviewFrame'
import { PanelRightClose, PanelRightOpen } from 'lucide-react'
import type { PanelTypography } from '@/lib/ui/panelTypography'

export function GraphTableCanvasPreviewDock(props: { previewSrc: string; panelTypography?: PanelTypography }) {
  const titleClassName = props.panelTypography?.microLabelClass || ''
  const [collapsed, setCollapsed] = React.useState(() => lsBool(LS_KEYS.graphTablePreviewCollapsed, false))
  const [widthPx, setWidthPx] = React.useState(() => lsInt(LS_KEYS.graphTablePreviewWidthPx, 520))
  const widthRef = React.useRef(widthPx)
  widthRef.current = widthPx
  const dragHandleRef = React.useRef<HTMLHRElement | null>(null)

  React.useEffect(() => {
    lsSetBool(LS_KEYS.graphTablePreviewCollapsed, collapsed)
  }, [collapsed])

  React.useEffect(() => {
    lsSetInt(LS_KEYS.graphTablePreviewWidthPx, widthPx, { min: 320, max: 960 })
  }, [widthPx])

  React.useEffect(() => {
    const el = dragHandleRef.current
    if (!el) return
    const onDown = (ev: PointerEvent) => {
      if (ev.button !== undefined && ev.button !== 0) return
      if (collapsed) return
      const startX = ev.clientX
      const startWidth = widthRef.current
      let pending = startWidth
      startPointerDrag({
        ev,
        cursor: 'col-resize',
        shouldStart: down => {
          if (down.button !== undefined && down.button !== 0) return false
          return true
        },
        onMove: mv => {
          const dx = startX - mv.clientX
          const next = Math.max(320, Math.min(960, Math.round(startWidth + dx)))
          pending = next
          setWidthPx(next)
        },
        onEnd: () => {
          setWidthPx(pending)
        },
        onCancel: () => {
          setWidthPx(pending)
        },
      })
    }
    el.addEventListener('pointerdown', onDown)
    return () => el.removeEventListener('pointerdown', onDown)
  }, [collapsed])

  return (
    <>
      {collapsed ? null : (
        <VerticalResizeSeparatorHr
          ref={el => {
            dragHandleRef.current = el
          }}
          ariaLabel="Resize Canvas Preview"
        />
      )}
      <aside
        className={`shrink-0 min-h-0 ${UI_THEME_TOKENS.panel.bg} flex flex-col ${collapsed ? `border-l ${UI_THEME_TOKENS.panel.divider}` : ''}`}
        style={{ width: collapsed ? '40px' : `${widthPx}px` }}
        aria-label={collapsed ? 'Canvas Preview (collapsed)' : 'Canvas Preview'}
      >
        <header
          className={`h-12 shrink-0 border-b ${UI_THEME_TOKENS.panel.divider} flex items-center justify-between px-3`}
          aria-label="Canvas Preview header"
        >
          {collapsed ? (
            <span />
          ) : (
            <h2 className={`font-semibold ${UI_THEME_TOKENS.text.primary} ${titleClassName}`}>Canvas Preview</h2>
          )}
          <IconButton
            title={collapsed ? 'Show Canvas Preview' : 'Hide Canvas Preview'}
            showTooltip
            onClick={() => setCollapsed(!collapsed)}
            className={UI_THEME_TOKENS.button.square}
          >
            {collapsed ? <PanelRightOpen className="w-4 h-4" aria-hidden="true" /> : <PanelRightClose className="w-4 h-4" aria-hidden="true" />}
          </IconButton>
        </header>
        <section
          className={`flex-1 min-h-0 overflow-hidden bg-[var(--kg-canvas-bg)] ${collapsed ? 'hidden' : ''}`}
          aria-label="Canvas Preview frame"
        >
          <EmbeddedCanvasPreviewFrame previewSrc={props.previewSrc} className="block w-full h-full border-0 bg-[var(--kg-canvas-bg)]" />
        </section>
      </aside>
    </>
  )
}
