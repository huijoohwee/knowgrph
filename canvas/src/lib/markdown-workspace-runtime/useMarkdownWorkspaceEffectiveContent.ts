import React from 'react'
import type { WorkspaceEntry, WorkspacePath } from '@/features/workspace-fs/types'
import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import type { MarkdownWorkspaceLayoutMode } from '@/features/markdown-explorer/workspaceUi'
import { isMarkdownPath, languageForPath } from '@/features/markdown-workspace/markdownWorkspaceUtils'
import { matchesMarkdownDocumentPath } from 'grph-shared/markdown/documentPath'
import { useGraphStore } from '@/hooks/useGraphStore'

type WebpageWorkspaceMeta = {
  url?: unknown
  view?: string | null
} | null

export function resolveLiveWorkspaceStreamingText(args: {
  activePath: WorkspacePath | null
  streamingPath: WorkspacePath | null
  streamingText: string | null | undefined
  userEditedActiveText: boolean
}): string {
  if (args.userEditedActiveText === true) return ''
  const activePath = normalizeWorkspacePath(String(args.activePath || '').trim())
  const streamingPath = normalizeWorkspacePath(String(args.streamingPath || '').trim())
  if (!activePath || !streamingPath || activePath !== streamingPath) return ''
  return String(args.streamingText || '')
}

export function useMarkdownWorkspaceEffectiveContent(args: {
  activePath: WorkspacePath | null
  activeDocumentKey: string
  activeEntryKind: WorkspaceEntry['kind'] | null
  activeText: string
  setActiveText: React.Dispatch<React.SetStateAction<string>>
  markdownDocumentName: string
  markdownDocumentText: string
  layoutMode: MarkdownWorkspaceLayoutMode
  contentMode: 'document' | 'widget'
  widgetFormat: 'json' | 'markdown'
  widgetEditorText: string
  widgetViewerText: string
  pdfWorkspaceViewerTextOverride: string | null
  webpageWorkspaceMeta: WebpageWorkspaceMeta
  webpageWorkspaceEditorTextOverride: string | null
  webpageWorkspaceViewerTextOverride: string | null
  userEditedActiveTextRef: React.MutableRefObject<boolean>
}) {
  const {
    activePath,
    activeDocumentKey,
    activeEntryKind,
    activeText,
    setActiveText,
    markdownDocumentName,
    markdownDocumentText,
    layoutMode,
    contentMode,
    widgetFormat,
    widgetEditorText,
    widgetViewerText,
    pdfWorkspaceViewerTextOverride,
    webpageWorkspaceMeta,
    webpageWorkspaceEditorTextOverride,
    webpageWorkspaceViewerTextOverride,
    userEditedActiveTextRef,
  } = args
  const chatWorkspaceStreamingPath = useGraphStore(s => s.chatWorkspaceStreamingPath || null)
  const chatWorkspaceStreamingText = useGraphStore(s => s.chatWorkspaceStreamingText || null)
  const webpageEditorMode = webpageWorkspaceMeta?.view === 'json' ? 'json' : null
  const editorUri = activePath
    ? `inmemory://workspace/${encodeURIComponent(activeDocumentKey || 'document')}${webpageEditorMode ? `?mode=${webpageEditorMode}` : ''}`
    : 'inmemory://model/empty'
  const editorLanguage = activePath ? webpageEditorMode || languageForPath(activePath) : 'markdown'
  const isMatchingMarkdownDocument = React.useMemo(() => {
    const docKey = String(activeDocumentKey || '').trim()
    const markdownName = String(markdownDocumentName || '').trim()
    if (!docKey || !markdownName) return false
    if (!isMarkdownPath(String(activePath || docKey))) return false
    return matchesMarkdownDocumentPath(docKey, markdownName)
  }, [activeDocumentKey, activePath, markdownDocumentName])
  const canonicalMarkdownText = typeof markdownDocumentText === 'string' ? markdownDocumentText : ''
  const shouldSyncProgrammaticActiveText = (
    contentMode !== 'widget'
    && isMatchingMarkdownDocument
    && !!canonicalMarkdownText
    && !userEditedActiveTextRef.current
    && activeText !== canonicalMarkdownText
  )

  React.useEffect(() => {
    if (!shouldSyncProgrammaticActiveText) return
    userEditedActiveTextRef.current = false
    setActiveText(prev => (prev === canonicalMarkdownText ? prev : canonicalMarkdownText))
  }, [canonicalMarkdownText, setActiveText, shouldSyncProgrammaticActiveText, userEditedActiveTextRef])

  const liveWorkspaceStreamingText = React.useMemo(
    () =>
      resolveLiveWorkspaceStreamingText({
        activePath,
        streamingPath: chatWorkspaceStreamingPath,
        streamingText: chatWorkspaceStreamingText,
        userEditedActiveText: userEditedActiveTextRef.current,
      }),
    [activePath, chatWorkspaceStreamingPath, chatWorkspaceStreamingText, userEditedActiveTextRef],
  )

  const effectiveActiveText = React.useMemo(() => {
    if (contentMode === 'widget') return widgetEditorText
    if (liveWorkspaceStreamingText) return liveWorkspaceStreamingText
    if (shouldSyncProgrammaticActiveText) return canonicalMarkdownText
    if (activeText) return activeText
    if (isMatchingMarkdownDocument && canonicalMarkdownText) {
      return canonicalMarkdownText
    }
    return activeText
  }, [activeText, canonicalMarkdownText, contentMode, isMatchingMarkdownDocument, liveWorkspaceStreamingText, shouldSyncProgrammaticActiveText, widgetEditorText])

  const effectiveSetActiveText = React.useCallback(
    (next: string) => {
      if (contentMode === 'widget') return
      userEditedActiveTextRef.current = true
      setActiveText(next)
    },
    [contentMode, setActiveText, userEditedActiveTextRef],
  )

  const effectiveViewerTextOverride = contentMode === 'widget' && widgetFormat === 'json' ? widgetViewerText : null
  const combinedViewerTextOverride =
    liveWorkspaceStreamingText || effectiveViewerTextOverride || pdfWorkspaceViewerTextOverride || webpageWorkspaceViewerTextOverride
  const webpageDerivedReadOnlyActive = contentMode !== 'widget' && !!(webpageWorkspaceMeta?.url && webpageWorkspaceMeta?.view === 'json')
  const effectiveEditorTextOverride = contentMode === 'widget' ? null : (liveWorkspaceStreamingText || webpageWorkspaceEditorTextOverride)
  const effectiveIsEditing =
    contentMode !== 'widget' &&
    (layoutMode === 'editor' || layoutMode === 'split') &&
    !webpageDerivedReadOnlyActive
  const effectiveIsMarkdown =
    contentMode !== 'widget' &&
    isMarkdownPath(String(activePath || '')) &&
    !(webpageWorkspaceMeta && webpageWorkspaceMeta.view !== 'markdown')
  const saveEnabled = effectiveIsEditing && activeEntryKind === 'file' && !!activeDocumentKey
  const disableEditorMutations =
    webpageDerivedReadOnlyActive ||
    (webpageWorkspaceMeta?.view === 'json' && typeof effectiveEditorTextOverride === 'string')

  return {
    webpageEditorMode,
    editorUri,
    editorLanguage,
    effectiveActiveText,
    effectiveSetActiveText,
    combinedViewerTextOverride,
    webpageDerivedReadOnlyActive,
    effectiveEditorTextOverride,
    effectiveIsEditing,
    effectiveIsMarkdown,
    saveEnabled,
    disableEditorMutations,
    disableViewerMutations: contentMode === 'widget',
  }
}
