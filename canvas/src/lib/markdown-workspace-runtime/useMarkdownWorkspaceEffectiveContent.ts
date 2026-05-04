import React from 'react'
import type { WorkspaceEntry, WorkspacePath } from '@/features/workspace-fs/types'
import type { MarkdownWorkspaceLayoutMode } from '@/features/markdown-explorer/workspaceUi'
import { isMarkdownPath, languageForPath } from '@/features/markdown-workspace/markdownWorkspaceUtils'

type WebpageWorkspaceMeta = {
  url?: unknown
  view?: string | null
} | null

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
  const webpageEditorMode = webpageWorkspaceMeta?.view === 'json' ? 'json' : null
  const editorUri = activePath
    ? `inmemory://workspace/${encodeURIComponent(activeDocumentKey || 'document')}${webpageEditorMode ? `?mode=${webpageEditorMode}` : ''}`
    : 'inmemory://model/empty'
  const editorLanguage = activePath ? webpageEditorMode || languageForPath(activePath) : 'markdown'

  const effectiveActiveText = React.useMemo(() => {
    if (contentMode === 'widget') return widgetEditorText
    if (activeText) return activeText
    if (markdownDocumentName === activeDocumentKey && typeof markdownDocumentText === 'string' && markdownDocumentText) {
      return markdownDocumentText
    }
    return activeText
  }, [activeDocumentKey, activeText, contentMode, markdownDocumentName, markdownDocumentText, widgetEditorText])

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
    effectiveViewerTextOverride || pdfWorkspaceViewerTextOverride || webpageWorkspaceViewerTextOverride
  const webpageDerivedReadOnlyActive = contentMode !== 'widget' && !!(webpageWorkspaceMeta?.url && webpageWorkspaceMeta?.view === 'json')
  const effectiveEditorTextOverride = contentMode === 'widget' ? null : webpageWorkspaceEditorTextOverride
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
