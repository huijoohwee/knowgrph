import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { lsInt, lsSetInt } from '@/lib/persistence'
import { LS_KEYS } from '@/lib/config'
import { startPointerDrag } from 'grph-shared/dom/pointerDrag'
import { MarkdownWorkspace } from './BottomPanel/markdownWorkspace/MarkdownWorkspace'
import { VerticalResizeSeparatorHr } from '@/components/ui/VerticalResizeSeparatorHr'
import { EmbeddedCanvasPreviewFrame } from '@/components/EmbeddedCanvasPreviewFrame'

export function EmbeddedEditorShell(props: { previewSrc: string }) {
  const uiPanelTextFontClass = useGraphStore(s => s.uiPanelTextFontClass || 'font-sans')
  const uiPanelMonospaceTextClass = useGraphStore(s => s.uiPanelMonospaceTextClass || 'font-mono text-xs')
  const [previewWidthPx, setPreviewWidthPx] = React.useState(() => lsInt(LS_KEYS.workspacePreviewWidthPx, 520))
  const dragHandleRef = React.useRef<HTMLHRElement | null>(null)
  const previewWidthPxRef = React.useRef(previewWidthPx)
  previewWidthPxRef.current = previewWidthPx

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
          setPreviewWidthPx(next)
        },
        onEnd: () => {
          setPreviewWidthPx(pending)
          lsSetInt(LS_KEYS.workspacePreviewWidthPx, pending, { min: 320, max: 960 })
        },
        onCancel: () => {
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
      <main className={`flex-1 min-w-0 min-h-0 flex ${uiPanelTextFontClass}`} aria-label="Editor and Preview">
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
            <h2 className={`text-xs font-semibold ${UI_THEME_TOKENS.text.primary}`}>Canvas Preview</h2>
            <p className={`text-[10px] ${UI_THEME_TOKENS.text.tertiary} ${uiPanelMonospaceTextClass}`}>Embedded</p>
          </header>
          <section className="flex-1 min-h-0 overflow-hidden bg-[var(--kg-canvas-bg)]" aria-label="Preview frame">
            <EmbeddedCanvasPreviewFrame previewSrc={props.previewSrc} className="block w-full h-full border-0 bg-[var(--kg-canvas-bg)]" />
          </section>
        </aside>
      </main>
    </section>
  )
}
