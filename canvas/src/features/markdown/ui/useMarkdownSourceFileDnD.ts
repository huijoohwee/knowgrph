import React from 'react'

const SOURCE_FILE_DRAG_BLOCKED_TAGS = new Set(['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A', 'LABEL'])

export function useMarkdownSourceFileDnD(args: {
  onReorderSourceFiles?: (fromId: string, toId: string) => void
  onAfterReorderSourceFiles?: () => void
}) {
  const { onReorderSourceFiles, onAfterReorderSourceFiles } = args
  const [draggingSourceFileId, setDraggingSourceFileId] = React.useState<string | null>(null)
  const [dragOverSourceFileId, setDragOverSourceFileId] = React.useState<string | null>(null)

  const clearDragState = React.useCallback(() => {
    setDraggingSourceFileId(null)
    setDragOverSourceFileId(null)
  }, [])

  const handleDragStart = React.useCallback(
    (event: React.DragEvent<HTMLElement>, fileId: string | null | undefined) => {
      const target = event.target as HTMLElement | null
      if (target?.tagName && SOURCE_FILE_DRAG_BLOCKED_TAGS.has(target.tagName)) {
        event.preventDefault()
        return false
      }
      const nextFileId = String(fileId || '')
      if (!nextFileId) return false
      setDraggingSourceFileId(nextFileId)
      setDragOverSourceFileId(nextFileId)
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', nextFileId)
      return true
    },
    [],
  )

  const handleDragOver = React.useCallback(
    (event: React.DragEvent<HTMLElement>, fileId: string | null | undefined) => {
      event.preventDefault()
      if (!draggingSourceFileId) return false
      const nextFileId = String(fileId || '')
      if (!nextFileId) return false
      event.dataTransfer.dropEffect = 'move'
      setDragOverSourceFileId(nextFileId)
      return true
    },
    [draggingSourceFileId],
  )

  const handleDrop = React.useCallback(
    (event: React.DragEvent<HTMLElement>, fileId: string | null | undefined) => {
      event.preventDefault()
      const toId = String(fileId || '')
      if (!toId) return false
      const fromId = draggingSourceFileId || event.dataTransfer.getData('text/plain')
      if (!fromId || fromId === toId) return false
      onReorderSourceFiles?.(fromId, toId)
      onAfterReorderSourceFiles?.()
      clearDragState()
      return true
    },
    [clearDragState, draggingSourceFileId, onAfterReorderSourceFiles, onReorderSourceFiles],
  )

  const handleDragLeave = React.useCallback(
    (event: React.DragEvent<HTMLElement>, fileId: string | null | undefined) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        const nextFileId = String(fileId || '')
        if (dragOverSourceFileId === nextFileId) setDragOverSourceFileId(null)
      }
    },
    [dragOverSourceFileId],
  )

  return {
    draggingSourceFileId,
    dragOverSourceFileId,
    clearDragState,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragLeave,
  }
}
