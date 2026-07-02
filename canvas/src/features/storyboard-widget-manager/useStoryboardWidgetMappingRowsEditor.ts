import React from 'react'
import { patchById } from 'grph-shared/array/patchArrayItem'
import { createUniqueId } from '@/lib/ids'
import type { StoryboardWidgetMappingRow } from '@/features/storyboard-widget-manager/mappingRows'

export function useStoryboardWidgetMappingRowsEditor(
  setEditorRows: React.Dispatch<React.SetStateAction<StoryboardWidgetMappingRow[]>>,
) {
  const addEditorRow = React.useCallback(() => {
    setEditorRows(prev => {
      const used = new Set(prev.map(r => r.id))
      const id = createUniqueId('qerRow', used)
      return [...prev, { id, key: '', type: 'text', value: '', required: false, direction: 'default' }]
    })
  }, [setEditorRows])

  const updateEditorRow = React.useCallback((id: string, patch: Partial<StoryboardWidgetMappingRow>) => {
    const target = String(id || '').trim()
    if (!target) return
    setEditorRows(prev => patchById(prev, target, r => r.id, r => ({ ...r, ...patch })))
  }, [setEditorRows])

  const deleteEditorRow = React.useCallback((id: string) => {
    const target = String(id || '').trim()
    if (!target) return
    setEditorRows(prev => prev.filter(r => r.id !== target))
  }, [setEditorRows])

  const reorderEditorRow = React.useCallback((fromId: string, toId: string) => {
    const from = String(fromId || '').trim()
    const to = String(toId || '').trim()
    if (!from || !to || from === to) return
    setEditorRows(prev => {
      const fromIndex = prev.findIndex(r => r.id === from)
      const toIndex = prev.findIndex(r => r.id === to)
      if (fromIndex < 0 || toIndex < 0) return prev
      if (fromIndex === toIndex) return prev
      const next = prev.slice()
      const [moved] = next.splice(fromIndex, 1)
      const insertIndex = fromIndex < toIndex ? Math.max(0, toIndex - 1) : toIndex
      next.splice(insertIndex, 0, moved)
      return next
    })
  }, [setEditorRows])

  return { addEditorRow, updateEditorRow, deleteEditorRow, reorderEditorRow }
}
