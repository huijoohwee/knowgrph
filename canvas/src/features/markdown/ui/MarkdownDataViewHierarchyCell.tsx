import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { readMarkdownDataViewRowsAsRecordsHierarchyStyle } from './MarkdownDataViewRowNesting'
import { MarkdownDataViewNestedRowToggle } from './MarkdownDataViewNestedRowToggle'

export function MarkdownDataViewHierarchyCell(props: {
  cellPaddingClassName: string
  depth: number
  childCount: number
  collapsed: boolean
  scope: 'row' | 'columnRecord'
  onToggle: () => void
}) {
  return (
    <td
      className={`${props.cellPaddingClassName} w-12 border-b ${UI_THEME_TOKENS.table.cellBorder} align-top`}
      data-kg-markdown-data-view-row-hierarchy-cell={props.scope === 'row' ? '1' : undefined}
      data-kg-markdown-data-view-column-record-hierarchy-cell={props.scope === 'columnRecord' ? '1' : undefined}
      data-kg-markdown-data-view-row-hierarchy-line-depth={String(props.depth)}
      style={readMarkdownDataViewRowsAsRecordsHierarchyStyle({ depth: props.depth })}
    >
      {props.childCount > 0 ? (
        <MarkdownDataViewNestedRowToggle collapsed={props.collapsed} onToggle={props.onToggle} />
      ) : null}
    </td>
  )
}
