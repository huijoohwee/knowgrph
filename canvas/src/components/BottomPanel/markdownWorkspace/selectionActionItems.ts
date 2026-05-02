export type SelectionActionItem = {
  key: 'refresh' | 'clear' | 'delete'
  label: string
  ariaLabel: string
  onSelect: () => void
}

export type SelectionActionMenuArgs = {
  activeEntryName: string
  clearLabel: string
  canClearActiveSelection: boolean
  onClearActiveSelection: () => void
  canRefreshActiveFromSource: boolean
  onRefreshActiveFromSource: () => void
  canDeleteActive: boolean
  onDeleteActive: () => void
}

export function buildSelectionActionItems(args: SelectionActionMenuArgs): SelectionActionItem[] {
  const items: SelectionActionItem[] = []
  if (args.canRefreshActiveFromSource) {
    items.push({
      key: 'refresh',
      label: 'Refresh from URL',
      ariaLabel: args.activeEntryName ? `Refresh ${args.activeEntryName}` : 'Refresh from URL',
      onSelect: args.onRefreshActiveFromSource,
    })
  }
  if (args.canClearActiveSelection) {
    items.push({
      key: 'clear',
      label: args.clearLabel,
      ariaLabel: args.clearLabel,
      onSelect: args.onClearActiveSelection,
    })
  }
  if (args.canDeleteActive) {
    items.push({
      key: 'delete',
      label: 'Delete',
      ariaLabel: args.activeEntryName ? `Delete ${args.activeEntryName}` : 'Delete',
      onSelect: args.onDeleteActive,
    })
  }
  return items
}
