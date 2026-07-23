import React from 'react'
import { replaceMarkdownLineRange } from 'grph-shared/markdown/lineEditing'
import { commitRichMediaInlineEditVersion } from '@/features/history/richMediaInlineEditHistory'
import { RICH_MEDIA_OUTPUT_DRAFT_VERSION_ID } from '@/lib/render/richMediaOutputVersions'
import type { RichMediaPanelProps } from './RichMediaPanel.types'
import type { RichMediaPanelModel } from './useRichMediaPanelModel'

const MarkdownPreview = React.lazy(() => import('@/features/markdown/ui/MarkdownPreview'))

export function RichMediaPanelWorkspaceViewerSurface(args: {
  model: RichMediaPanelModel
  props: RichMediaPanelProps
}) {
  const { model, props } = args
  const [viewerDraftText, setViewerDraftText] = React.useState<string | null>(null)
  const viewerText = viewerDraftText ?? model.panelDisplayText

  React.useEffect(() => {
    setViewerDraftText(null)
  }, [model.panelDisplayText])

  const commitText = React.useCallback((nextText: string) => {
    if (!model.panelTextEditable) return
    commitRichMediaInlineEditVersion({
      currentText: model.panelDisplayText,
      nextText,
      commit: () => {
        model.setPanelDraftText(nextText)
        props.onPanelChange?.({
          activeTab: 'text',
          freezeConnectedOutput: true,
          text: nextText,
          ...((props.panel?.outputVersions?.length || 0) > 0
            ? { selectedOutputVersionId: RICH_MEDIA_OUTPUT_DRAFT_VERSION_ID }
            : {}),
        })
      },
    })
  }, [model, props])

  const handleReplaceLineRange = React.useCallback((change: {
    startLine: number
    endLine: number
    replacementLines: string[]
  }) => {
    const nextText = replaceMarkdownLineRange({
      markdownText: model.panelDisplayText,
      startLine: change.startLine,
      endLine: change.endLine,
      replacementLines: change.replacementLines,
    })
    if (nextText === model.panelDisplayText) return
    setViewerDraftText(nextText)
    commitText(nextText)
  }, [commitText, model.panelDisplayText])

  return (
    <section
      aria-label="Editor Workspace Viewer"
      className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden"
      data-kg-rich-media-workspace-viewer="1"
      data-kg-canvas-pointer-ignore="true"
      data-kg-canvas-wheel-ignore="true"
      data-kg-media-scroll-surface="1"
    >
      <React.Suspense fallback={<section className="h-full w-full" aria-label="Loading Editor Workspace Viewer" />}>
        <MarkdownPreview
          markdownText={viewerText}
          activeDocumentPath={model.panelMarkdownDocumentPath}
          highlightedLineRange={null}
          markdownWordWrap
          markdownPresentationMode={false}
          markdownTextHighlight={false}
          uiPanelTextFontClass="font-sans"
          uiPanelMonospaceTextClass="font-mono text-xs"
          previewOverlayScope="container"
          previewOverlayPortalTarget={null}
          previewScrollable
          showSidebar={false}
          viewMode="viewer"
          forbidCopy={false}
          markdownTokenStoreSync={false}
          markdownViewerWidthMode="wide"
          onInlineEditStateChange={model.panelTextEditable ? active => {
            if (!active) setViewerDraftText(null)
          } : undefined}
          onInlineDraftTextChange={model.panelTextEditable ? (nextText, options) => {
            if (options?.reflectInViewer === false) return
            setViewerDraftText(nextText)
          } : undefined}
          onReplaceLineRange={model.panelTextEditable ? handleReplaceLineRange : undefined}
        />
      </React.Suspense>
    </section>
  )
}
