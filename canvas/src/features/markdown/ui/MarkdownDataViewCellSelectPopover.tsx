import React from 'react'
import type { MarkdownDataView } from './markdownDataViewModel'
import type { MarkdownDataViewColumnType } from './markdownDataViewColumnType'
import { AnchoredPopover } from '@/components/ui/AnchoredPopover'
import { MarkdownDataViewMultiTagSelect } from './MarkdownDataViewMultiTagSelect'
import { MarkdownDataViewSingleSelect } from './MarkdownDataViewSingleSelect'

export function MarkdownDataViewCellSelectPopover(props: {
  editingMeta: null | {
    rowId: string
    colId: string
    baseKind: string
    uiType: MarkdownDataViewColumnType
    anchorEl: HTMLElement
  }
  placement: 'top' | 'bottom'
  draft: string
  canMutate: boolean
  editingSelectOptions: string[]
  editingMultiSelectOptions: string[]
  setDraft: (next: string) => void
  setEditingNull: () => void
  onUpdateCell: (args: { rowId: string; columnId: string; nextValue: string }) => void
}) {
  const editingMeta = props.editingMeta
  return (
    <AnchoredPopover
      open={Boolean(editingMeta && (editingMeta.baseKind === 'select' || editingMeta.baseKind === 'multi-select') && editingMeta.uiType !== 'checkbox')}
      anchorEl={editingMeta?.anchorEl || null}
      ariaLabel="Cell select panel"
      placement={props.placement === 'bottom' ? 'bottom-start' : 'top-start'}
      minWidthPx={320}
      maxWidthPx={420}
      maxHeightPx={420}
      onClose={props.setEditingNull}
    >
      {editingMeta && editingMeta.baseKind === 'select' && editingMeta.uiType !== 'checkbox' ? (
        <MarkdownDataViewSingleSelect
          autoFocus
          canCreate
          value={props.draft}
          options={props.editingSelectOptions}
          onChange={(next) => {
            if (!props.canMutate) {
              props.setEditingNull()
              return
            }
            props.setDraft(next)
            props.onUpdateCell({ rowId: editingMeta.rowId, columnId: editingMeta.colId, nextValue: next })
          }}
          onRequestClose={props.setEditingNull}
        />
      ) : editingMeta && editingMeta.baseKind === 'multi-select' ? (
        <MarkdownDataViewMultiTagSelect
          autoFocus
          canCreate={true}
          value={props.draft}
          options={props.editingMultiSelectOptions}
          onChange={(next) => {
            if (!props.canMutate) {
              props.setEditingNull()
              return
            }
            props.setDraft(next)
            props.onUpdateCell({ rowId: editingMeta.rowId, columnId: editingMeta.colId, nextValue: next })
          }}
          onRequestClose={props.setEditingNull}
        />
      ) : null}
    </AnchoredPopover>
  )
}
