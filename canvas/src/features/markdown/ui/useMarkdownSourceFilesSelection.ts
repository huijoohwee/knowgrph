import React from 'react'
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
