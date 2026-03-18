import React from 'react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export type KanbanCellProps = {
  rowId: string
  groupByColumnId: string
  value: string
  options: string[]
  onUpdateCell: (args: { rowId: string; columnId: string; nextValue: string }) => void
}

export const KanbanCell = React.memo(function KanbanCell(props: KanbanCellProps) {
  return (
    <footer className="mt-2">
      <label className="sr-only">Status</label>
      <select
        className={['w-full text-[10px] px-2 py-1 rounded border', UI_THEME_TOKENS.kanban.cellBg, UI_THEME_TOKENS.input.border, UI_THEME_TOKENS.input.text].join(' ')}
        value={props.value}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => e.stopPropagation()}
        onChange={e => props.onUpdateCell({ rowId: props.rowId, columnId: props.groupByColumnId, nextValue: e.target.value })}
      >
        {props.options.map(option => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </footer>
  )
})

