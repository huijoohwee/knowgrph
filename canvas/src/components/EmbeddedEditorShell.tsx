import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { lsInt, lsSetInt } from '@/lib/persistence'
import { LS_KEYS } from '@/lib/config'
import { startPointerDrag } from 'grph-shared/dom/pointerDrag'
import { MarkdownWorkspace } from './BottomPanel/markdownWorkspace/MarkdownWorkspace'

export function EmbeddedEditorShell(props: { previewSrc: string }) {
  const uiPanelTextFontClass = useGraphStore(s => s.uiPanelTextFontClass || 'font-sans')
  const uiPanelMonospaceTextClass = useGraphStore(s => s.uiPanelMonospaceTextClass || 'font-mono text-xs')
  const graphData = useGraphStore(s => s.graphData)
  const graphDataRevision = useGraphStore(s => s.graphDataRevision)
  const schema = useGraphStore(s => s.schema)
  const canvasRenderMode = useGraphStore(s => s.canvasRenderMode)
  const canvas2dRenderer = useGraphStore(s => s.canvas2dRenderer)
  const selectedNodeId = useGraphStore(s => s.selectedNodeId)
  const selectedEdgeId = useGraphStore(s => s.selectedEdgeId)
  const selectedGroupId = useGraphStore(s => s.selectedGroupId)
  const selectedNodeIds = useGraphStore(s => s.selectedNodeIds)
  const selectedEdgeIds = useGraphStore(s => s.selectedEdgeIds)
  const selectedGroupIds = useGraphStore(s => s.selectedGroupIds)
  const [previewWidthPx, setPreviewWidthPx] = React.useState(() => lsInt(LS_KEYS.workspacePreviewWidthPx, 520))
  const dragHandleRef = React.useRef<HTMLHRElement | null>(null)
  const previewWidthPxRef = React.useRef(previewWidthPx)
  previewWidthPxRef.current = previewWidthPx
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null)

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

  const sendPreviewSnapshot = React.useCallback(() => {
    const iframe = iframeRef.current
    const target = iframe?.contentWindow
    if (!target) return
    try {
      target.postMessage(
        {
          kind: 'kg-preview-sync',
          payload: {
            graphData,
            schema,
            canvasRenderMode,
            canvas2dRenderer,
            selectedNodeId,
            selectedEdgeId,
            selectedGroupId,
            selectedNodeIds,
            selectedEdgeIds,
            selectedGroupIds,
          },
        },
        window.location.origin,
      )
    } catch {
      void 0
    }
  }, [
    canvas2dRenderer,
    canvasRenderMode,
    graphData,
    schema,
    selectedEdgeId,
    selectedEdgeIds,
    selectedGroupId,
    selectedGroupIds,
    selectedNodeId,
    selectedNodeIds,
  ])

  React.useEffect(() => {
    void graphDataRevision
    sendPreviewSnapshot()
  }, [graphDataRevision, sendPreviewSnapshot])

  React.useEffect(() => {
    sendPreviewSnapshot()
  }, [
    canvas2dRenderer,
    canvasRenderMode,
    schema,
    selectedEdgeId,
    selectedEdgeIds,
    selectedGroupId,
    selectedGroupIds,
    selectedNodeId,
    selectedNodeIds,
    sendPreviewSnapshot,
  ])

  return (
    <section className="flex-1 min-h-0 flex overflow-hidden" aria-label="Embedded Editor Workspace">
      <main className={`flex-1 min-w-0 min-h-0 flex ${uiPanelTextFontClass}`} aria-label="Editor and Preview">
        <section className="flex-1 min-w-0 min-h-0 flex" aria-label="Editor">
          <MarkdownWorkspace />
        </section>

        <hr
          ref={el => {
            dragHandleRef.current = el
          }}
          className={`w-1 cursor-col-resize select-none touch-none ${UI_THEME_TOKENS.panel.border}`}
          aria-label="Resize preview"
        />

        <aside
          className={`shrink-0 min-h-0 border-l ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} flex flex-col`}
          style={{ width: `${previewWidthPx}px` }}
          aria-label="Canvas Preview"
        >
          <header className={`px-3 py-2 border-b ${UI_THEME_TOKENS.panel.border}`} aria-label="Preview header">
            <h2 className={`text-xs font-semibold ${UI_THEME_TOKENS.text.primary}`}>Canvas Preview</h2>
            <p className={`text-[10px] ${UI_THEME_TOKENS.text.tertiary} ${uiPanelMonospaceTextClass}`}>Embedded</p>
          </header>
          <section className="flex-1 min-h-0 overflow-hidden bg-white dark:bg-[#0d1117]" aria-label="Preview frame">
            <iframe
              title="Canvas Preview"
              src={props.previewSrc}
              className="block w-full h-full border-0 bg-white dark:bg-[#0d1117]"
              sandbox="allow-scripts allow-same-origin allow-forms allow-downloads"
              data-kg-preview="1"
              ref={el => {
                iframeRef.current = el
              }}
              onLoad={() => {
                sendPreviewSnapshot()
              }}
            />
          </section>
        </aside>
      </main>
    </section>
  )
}
