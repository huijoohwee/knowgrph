import React from 'react'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { sanitizeInvalidDataUrls } from '@/features/markdown-workspace/main/sanitize'
import { MarkdownWorkspaceDerivedViewer } from './MarkdownWorkspaceDerivedViewer'
import { useCanvasWorkspaceDataViewSource } from './workspaceDataViewCanvasSource'

const NOOP_REVEAL_LINE = () => void 0
const NOOP_VIEWER_ROOT_REF = () => void 0
const NOOP_INSERT_LINE = () => void 0
const NOOP_REORDER_LINE_BLOCK = () => void 0
const NOOP_REPLACE_LINE_RANGE = () => void 0

export function CanvasWorkspaceDataViewFloatingRegistrationBridge(props: {
  active?: boolean
  fallbackDocumentName: string
}) {
  const active = props.active !== false
  const panelTypography = usePanelTypography()
  const source = useCanvasWorkspaceDataViewSource(props.fallbackDocumentName)
  const markdownText = React.useMemo(() => {
    const sourceText = String(source.sourceBackedMarkdownText || '')
    if (sourceText.trim()) return sanitizeInvalidDataUrls(sourceText)
    const jsonSource = String(source.jsonSourceDocumentText || '').trim()
    return sanitizeInvalidDataUrls(jsonSource ? source.jsonSourceDocumentText : sourceText)
  }, [source.jsonSourceDocumentText, source.sourceBackedMarkdownText])

  if (!active) return null
  if (!markdownText.trim()) return null

  return (
    <MarkdownWorkspaceDerivedViewer
      floatingPanelRegistrationOnly
      viewerKind="markdown"
      viewerMode="multiDimTable"
      markdownText={markdownText}
      title={source.title}
      activeDocumentPath={source.activeDocumentPath}
      markdownWordWrap={true}
      markdownTextHighlight={false}
      uiPanelTextFontClass={panelTypography.fontClass}
      uiPanelMonospaceTextClass={panelTypography.monospaceTextClass}
      disableViewerMutations={true}
      onInsertLineAfter={NOOP_INSERT_LINE}
      onReorderLineBlock={NOOP_REORDER_LINE_BLOCK}
      onReplaceLineRange={NOOP_REPLACE_LINE_RANGE}
      onRevealLineInEditor={NOOP_REVEAL_LINE}
      onViewerRootRef={NOOP_VIEWER_ROOT_REF}
    />
  )
}
