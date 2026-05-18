import React from 'react'
import { flushSync } from 'react-dom'
import { setGeospatialModeEnabled } from '@/features/geospatial/gympgrphBridge'
import { useGraphStore } from '@/hooks/useGraphStore'
import { shouldPrimeStrictFlowEditorModeForWorkspaceText } from '@/lib/markdown-workspace-runtime/workspaceSwitchPreset'
import {
  expandMarkdownSourceFolderAncestors,
  normalizeMarkdownSourceFolderPath,
  resolveMarkdownSourceParentFolderPath,
  toggleMarkdownSourceFolderPath,
} from './markdownSourceFileTree'

export function useMarkdownSourceFilesSelection(args: {
  initialExpandedPaths?: ReadonlyArray<string> | ReadonlySet<string>
  selectedFolderPath?: string | null
  onSelectedFolderPathChange?: (path: string) => void
  onSourceFileSelect?: (id: string) => void
}) {
  const {
    initialExpandedPaths,
    selectedFolderPath,
    onSelectedFolderPathChange,
    onSourceFileSelect,
  } = args
  const [selectedSourceFolderPath, setSelectedSourceFolderPath] = React.useState<string>(() =>
    normalizeMarkdownSourceFolderPath(selectedFolderPath),
  )
  const [expandedSourceFolderPaths, setExpandedSourceFolderPaths] = React.useState<Set<string>>(() => {
    const next = new Set<string>([''])
    if (!initialExpandedPaths) return next
    for (const path of initialExpandedPaths) {
      next.add(normalizeMarkdownSourceFolderPath(path))
    }
    return next
  })

  React.useEffect(() => {
    const next = normalizeMarkdownSourceFolderPath(selectedFolderPath)
    if (!next) return
    setSelectedSourceFolderPath(prev => (prev === next ? prev : next))
  }, [selectedFolderPath])

  React.useEffect(() => {
    if (!selectedSourceFolderPath) return
    setExpandedSourceFolderPaths(prev =>
      expandMarkdownSourceFolderAncestors({
        expandedPaths: prev,
        selectedFolderPath: selectedSourceFolderPath,
      }),
    )
  }, [selectedSourceFolderPath])

  const selectFolder = React.useCallback(
    (path: string) => {
      const nextPath = normalizeMarkdownSourceFolderPath(path)
      setSelectedSourceFolderPath(nextPath)
      onSelectedFolderPathChange?.(nextPath)
      setExpandedSourceFolderPaths(prev => toggleMarkdownSourceFolderPath(prev, nextPath))
    },
    [onSelectedFolderPathChange],
  )

  const selectFile = React.useCallback(
    (args: { fileId: string; path: string }) => {
      const fileId = String(args.fileId || '').trim()
      if (fileId) {
        const state = useGraphStore.getState()
        const sourceFile = (state.sourceFiles || []).find(file => String(file?.id || '').trim() === fileId) || null
        const sourceText = sourceFile && typeof sourceFile.text === 'string' ? sourceFile.text : ''
        if (shouldPrimeStrictFlowEditorModeForWorkspaceText(sourceText)) {
          flushSync(() => {
            if (state.documentStructureBaselineLock === true) state.setDocumentStructureBaselineLock(false)
            state.setCanvasRenderMode('2d')
            state.setCanvas2dRenderer('flowEditor')
            state.setDocumentSemanticMode('document')
            state.setFrontmatterModeEnabled(true)
          })
          void setGeospatialModeEnabled(false).catch(() => void 0)
        }
      }
      const parentPath = resolveMarkdownSourceParentFolderPath(args.path)
      React.startTransition(() => {
        onSourceFileSelect?.(args.fileId)
        setSelectedSourceFolderPath(parentPath)
        onSelectedFolderPathChange?.(parentPath)
        if (parentPath) {
          setExpandedSourceFolderPaths(prev =>
            expandMarkdownSourceFolderAncestors({
              expandedPaths: prev,
              selectedFolderPath: parentPath,
            }),
          )
        }
      })
    },
    [onSelectedFolderPathChange, onSourceFileSelect],
  )

  return {
    expandedSourceFolderPaths,
    selectedSourceFolderPath,
    setExpandedSourceFolderPaths,
    selectFolder,
    selectFile,
  }
}
