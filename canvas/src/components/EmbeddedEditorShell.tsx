import React from 'react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { lsInt, lsSetInt } from '@/lib/persistence'
import { LS_KEYS } from '@/lib/config'
import { startPointerDrag } from 'grph-shared/dom/pointerDrag'
import { MarkdownWorkspace } from './BottomPanel/markdownWorkspace/MarkdownWorkspace'
import { VerticalResizeSeparatorHr } from '@/components/ui/VerticalResizeSeparatorHr'
import { EmbeddedCanvasPreviewFrame } from '@/components/EmbeddedCanvasPreviewFrame'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { createRafValueScheduler } from '@/lib/react/rafValueScheduler'

export function EmbeddedEditorShell(props: { previewSrc: string }) {
  const panelTypography = usePanelTypography()
  const [previewWidthPx, setPreviewWidthPx] = React.useState(() => {
    const raw = lsInt(LS_KEYS.workspacePreviewWidthPx, 520)
    const next = Math.max(320, Math.min(960, raw))
    if (next !== raw) lsSetInt(LS_KEYS.workspacePreviewWidthPx, next, { min: 320, max: 960 })
    return next
  })
  const dragHandleRef = React.useRef<HTMLHRElement | null>(null)
  const previewWidthPxRef = React.useRef(previewWidthPx)
  previewWidthPxRef.current = previewWidthPx
  const rafSetWidthRef = React.useRef(createRafValueScheduler<number>(v => setPreviewWidthPx(v)))

  React.useEffect(() => {
    if (!Number.isFinite(previewWidthPx) || previewWidthPx < 320 || previewWidthPx > 960) {
      const next = Math.max(320, Math.min(960, Number.isFinite(previewWidthPx) ? previewWidthPx : 520))
      setPreviewWidthPx(next)
      lsSetInt(LS_KEYS.workspacePreviewWidthPx, next, { min: 320, max: 960 })
    }
  }, [previewWidthPx])

  React.useEffect(() => {
    return () => {
      rafSetWidthRef.current.cancel()
    }
  }, [])

  React.useEffect(() => {
    const el = dragHandleRef.current
    if (!el) return
    const onDown = (ev: PointerEvent) => {
      if (ev.button !== undefined && ev.button !== 0) return
      const startX = ev.clientX
      const startWidth = previewWidthPxRef.current
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
          rafSetWidthRef.current.schedule(next)
        },
        onEnd: () => {
          rafSetWidthRef.current.flush()
          setPreviewWidthPx(pending)
          lsSetInt(LS_KEYS.workspacePreviewWidthPx, pending, { min: 320, max: 960 })
        },
        onCancel: () => {
          rafSetWidthRef.current.flush()
          setPreviewWidthPx(pending)
          lsSetInt(LS_KEYS.workspacePreviewWidthPx, pending, { min: 320, max: 960 })
        },
      })
    }
    el.addEventListener('pointerdown', onDown)
    return () => el.removeEventListener('pointerdown', onDown)
  }, [])

  return (
    <section className="flex-1 min-h-0 flex overflow-hidden" aria-label="Embedded Editor Workspace">
      <main className={`flex-1 min-w-0 min-h-0 flex ${panelTypography.panelTextClass}`} aria-label="Editor and Preview">
        <section className="flex-1 min-w-0 min-h-0 overflow-hidden" aria-label="Editor">
          <MarkdownWorkspace />
        </section>

        <VerticalResizeSeparatorHr
          ref={el => {
            dragHandleRef.current = el
          }}
          ariaLabel="Resize preview"
        />

        <aside
          className={`shrink-0 min-h-0 ${UI_THEME_TOKENS.panel.bg} flex flex-col`}
          style={{ width: `${previewWidthPx}px` }}
          aria-label="Canvas Preview"
        >
          <header className={`px-3 py-2 border-b ${UI_THEME_TOKENS.panel.border}`} aria-label="Preview header">
            <h2 className={`font-semibold ${UI_THEME_TOKENS.text.primary}`}>Canvas Preview</h2>
            <p className={`${panelTypography.microLabelClass} ${UI_THEME_TOKENS.text.tertiary} ${panelTypography.monospaceTextClass}`}>Embedded</p>
          </header>
          <section className="flex-1 min-h-0 overflow-hidden bg-[var(--kg-canvas-bg)]" aria-label="Preview frame">
            <EmbeddedCanvasPreviewFrame previewSrc={props.previewSrc} className="block w-full h-full border-0 bg-[var(--kg-canvas-bg)]" />
          </section>
        </aside>
      </main>
    </section>
  )
}
