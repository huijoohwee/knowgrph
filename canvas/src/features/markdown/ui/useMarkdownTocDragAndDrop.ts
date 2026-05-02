import React from 'react'

export type MarkdownTocDropPosition = 'before' | 'after'
export type MarkdownTocDragState = 'none' | 'top' | 'bottom'

export function useMarkdownTocDragAndDrop(args: {
  itemId: string
  enabled?: boolean
  onReorder?: (sourceId: string, targetId: string, position: MarkdownTocDropPosition) => void
}) {
  const { itemId, enabled = true, onReorder } = args
  const reorderEnabled = enabled && typeof onReorder === 'function'
  const [dragState, setDragState] = React.useState<MarkdownTocDragState>('none')
  const [isDragging, setIsDragging] = React.useState(false)

  const handleDragStart = React.useCallback(
    (e: React.DragEvent) => {
      if (!reorderEnabled) return
      setIsDragging(true)
      e.dataTransfer.setData('text/plain', itemId)
      e.dataTransfer.effectAllowed = 'move'
    },
    [itemId, reorderEnabled],
  )

  const handleDragEnd = React.useCallback(() => {
    setIsDragging(false)
    setDragState('none')
  }, [])

  const handleDragOver = React.useCallback(
    (e: React.DragEvent) => {
      if (!reorderEnabled) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      const rect = e.currentTarget.getBoundingClientRect()
      const midY = rect.top + rect.height / 2
      setDragState(e.clientY < midY ? 'top' : 'bottom')
    },
    [reorderEnabled],
  )

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    setDragState('none')
  }, [])

  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      if (!reorderEnabled || !onReorder) return
      e.preventDefault()
      e.stopPropagation()
      const sourceId = e.dataTransfer.getData('text/plain')
      const position: MarkdownTocDropPosition = dragState === 'bottom' ? 'after' : 'before'
      setDragState('none')
      if (!sourceId || sourceId === itemId) return
      onReorder(sourceId, itemId, position)
    },
    [dragState, itemId, onReorder, reorderEnabled],
  )

  return {
    dragState,
    isDragging,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  }
}
