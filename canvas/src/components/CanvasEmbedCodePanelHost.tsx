import React from 'react'
import { CanvasEmbedCodePanel } from '@/features/markdown-workspace/CanvasEmbedCodePanel'
import {
  CANVAS_EMBED_CODE_PANEL_OPEN_EVENT,
  readCanvasEmbedCodePanelDetail,
  type CanvasEmbedCodePanelDetail,
} from '@/features/canvas/canvasEmbedCodePanelEvent'

export function CanvasEmbedCodePanelHost() {
  const [panel, setPanel] = React.useState<CanvasEmbedCodePanelDetail | null>(null)

  React.useEffect(() => {
    const handleOpen = (event: Event) => {
      const detail = readCanvasEmbedCodePanelDetail(event)
      if (detail) setPanel(detail)
    }
    window.addEventListener(CANVAS_EMBED_CODE_PANEL_OPEN_EVENT, handleOpen)
    return () => window.removeEventListener(CANVAS_EMBED_CODE_PANEL_OPEN_EVENT, handleOpen)
  }, [])

  return panel ? (
    <CanvasEmbedCodePanel
      sourceName={panel.sourceName}
      title={panel.title}
      language={panel.language}
      code={panel.code}
      onClose={() => setPanel(null)}
    />
  ) : null
}
