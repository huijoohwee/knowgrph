import { buildSelectionActionItems } from '@/features/markdown-workspace/selectionActionItems'

export function testSelectionActionsMenuBuildsSharedActionItems() {
  const called: string[] = []
  const items = buildSelectionActionItems({
    activeEntryName: 'note.md',
    clearLabel: 'Clear',
    canClearActiveSelection: true,
    onClearActiveSelection: () => called.push('clear'),
    canRefreshActiveFromSource: true,
    onRefreshActiveFromSource: () => called.push('refresh'),
    canDeleteActive: true,
    onDeleteActive: () => called.push('delete'),
  })

  const keys = items.map(item => item.key).join(',')
  if (keys !== 'refresh,clear,delete') {
    throw new Error(`expected shared selection actions order refresh,clear,delete, got ${keys}`)
  }
  if (items[0]?.ariaLabel !== 'Refresh note.md') {
    throw new Error(`expected refresh aria label for active entry, got ${String(items[0]?.ariaLabel || '')}`)
  }
  if (items[1]?.label !== 'Clear') {
    throw new Error(`expected clear label to reuse clearLabel, got ${String(items[1]?.label || '')}`)
  }
  if (items[2]?.label !== 'Delete') {
    throw new Error(`expected delete label to be Delete, got ${String(items[2]?.label || '')}`)
  }

  for (const item of items) item.onSelect()
  if (called.join(',') !== 'refresh,clear,delete') {
    throw new Error(`expected shared actions to preserve handlers, got ${called.join(',')}`)
  }
}
