import React from 'react'
import { WorkspaceDataViewNewRecordButton } from '@/features/markdown-workspace/main/viewer/WorkspaceDataViewNewRecordButton'

export function KanbanNewRecordDividerRow(props: { onClick: () => void }) {
  return (
    <li
      data-kg-kanban-group-actions="1"
      className="list-none opacity-0 pointer-events-none transition-opacity"
    >
      <WorkspaceDataViewNewRecordButton
        onClick={props.onClick}
        presentation="divider"
      />
    </li>
  )
}
