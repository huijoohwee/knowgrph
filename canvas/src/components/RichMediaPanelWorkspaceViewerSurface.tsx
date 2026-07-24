import React from 'react'
import { replaceMarkdownLineRange } from 'grph-shared/markdown/lineEditing'
import { commitRichMediaInlineEditVersion } from '@/features/history/richMediaInlineEditHistory'
import { RICH_MEDIA_OUTPUT_DRAFT_VERSION_ID } from '@/lib/render/richMediaOutputVersions'
import {
  UI_VIEW_EDIT_SURFACE_DATA_ATTRIBUTES,
  UI_VIEW_EDIT_SURFACE_VIEWER_CLASS_NAME,
} from '@/lib/ui/surfaceClasses'
import { useGraphStore } from '@/hooks/useGraphStore'
import { requestPropsPanelOpen } from '@/features/toolbar/floatingPanelBridge'
import { beginTextSelectionWidgetLinkSession } from '@/lib/storyboardWidget/textSelectionWidgetLink'
import { TextSelectionWidgetLinkContext } from '@/lib/storyboardWidget/textSelectionWidgetLinkContext'
import type { RichMediaPanelProps } from './RichMediaPanel.types'
import type { RichMediaPanelModel } from './useRichMediaPanelModel'

const MarkdownWorkspaceViewerSurface = React.lazy(() =>
  import('@/features/markdown-workspace/main/viewer/MarkdownWorkspaceViewerSurface')
    .then(module => ({ default: module.MarkdownWorkspaceViewerSurface })),
)

const RICH_MEDIA_WORKSPACE_VIEWER_DATA_ATTRIBUTES = {
  'data-kg-rich-media-workspace-viewer': '1',
  'data-kg-canvas-pointer-ignore': 'true',
  'data-kg-canvas-wheel-ignore': 'true',
  'data-kg-media-scroll-surface': '1',
} as const

export function RichMediaPanelWorkspaceViewerSurface(args: {
  model: RichMediaPanelModel
  props: RichMediaPanelProps
}) {
  const { model, props } = args
  const [viewerDraftText, setViewerDraftText] = React.useState<string | null>(null)
  const pendingCommittedTextRef = React.useRef<string | null>(null)
  const viewerText = viewerDraftText ?? model.panelDisplayText
  const selectionWidgetLink = React.useMemo(() => {
    const sourceNodeId = String(props.overlayId || '').trim()
    if (!sourceNodeId) return null
    return {
      createLinkedWidget: (selection: {
        selectedText: string
        startLine: number
        endLine: number
      }) => {
        const session = beginTextSelectionWidgetLinkSession({
          sourceNodeId,
          selectedText: selection.selectedText,
          startLine: selection.startLine,
          endLine: selection.endLine,
          documentPath: model.panelMarkdownDocumentPath,
        })
        if (!session) return
        requestPropsPanelOpen()
        useGraphStore.getState().upsertUiToast({
          id: 'rich-media-selection-widget-link',
          kind: 'neutral',
          message: 'Choose a Widget to create and link to the selected text.',
          ttlMs: 4000,
        })
      },
    }
  }, [model.panelMarkdownDocumentPath, props.overlayId])

  React.useEffect(() => {
    const pendingCommittedText = pendingCommittedTextRef.current
    if (pendingCommittedText !== null && model.panelDisplayText !== pendingCommittedText) return
    pendingCommittedTextRef.current = null
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
    const canonicalText = model.panelDisplayText
    const nextText = replaceMarkdownLineRange({
      markdownText: canonicalText,
      startLine: change.startLine,
      endLine: change.endLine,
      replacementLines: change.replacementLines,
    })
    if (nextText === canonicalText) return
    pendingCommittedTextRef.current = nextText
    setViewerDraftText(nextText)
    commitText(nextText)
  }, [commitText, model.panelDisplayText])

  return (
    <React.Suspense fallback={(
      <section
        aria-label="Loading Editor Workspace Viewer"
        className={UI_VIEW_EDIT_SURFACE_VIEWER_CLASS_NAME}
        {...UI_VIEW_EDIT_SURFACE_DATA_ATTRIBUTES}
        {...RICH_MEDIA_WORKSPACE_VIEWER_DATA_ATTRIBUTES}
      />
    )}>
      <TextSelectionWidgetLinkContext.Provider value={selectionWidgetLink}>
        <MarkdownWorkspaceViewerSurface
          markdownText={viewerText}
          activeDocumentPath={model.panelMarkdownDocumentPath}
          highlightedLineRange={null}
          markdownWordWrap
          markdownTextHighlight={false}
          uiPanelTextFontClass="font-sans"
          uiPanelMonospaceTextClass="font-mono text-xs"
          markdownTokenStoreSync={false}
          markdownViewerWidthMode="wide"
          dataAttributes={RICH_MEDIA_WORKSPACE_VIEWER_DATA_ATTRIBUTES}
          onInlineEditStateChange={model.panelTextEditable ? active => {
            if (!active && pendingCommittedTextRef.current === null) setViewerDraftText(null)
          } : undefined}
          onInlineDraftTextChange={model.panelTextEditable ? (nextText, options) => {
            if (options?.reflectInViewer === false) return
            setViewerDraftText(nextText)
          } : undefined}
          onReplaceLineRange={model.panelTextEditable ? handleReplaceLineRange : undefined}
        />
      </TextSelectionWidgetLinkContext.Provider>
    </React.Suspense>
  )
}
