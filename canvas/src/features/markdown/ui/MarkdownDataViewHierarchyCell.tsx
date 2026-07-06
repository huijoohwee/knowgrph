import type React from 'react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { readMarkdownDataViewRowsAsRecordsHierarchyStyle } from './MarkdownDataViewRowNesting'
import { MarkdownDataViewNestedRowToggle } from './MarkdownDataViewNestedRowToggle'

const MARKDOWN_DATA_VIEW_TREE_CELL_CLASSNAME = 'kg-data-view-tree-cell'

export function MarkdownDataViewHierarchyCell(props: {
  cellPaddingClassName: string
  depth: number
  childCount: number
  collapsed: boolean
  scope: 'row' | 'columnRecord'
  onToggle: () => void
}) {
  const style = {
    ...readMarkdownDataViewRowsAsRecordsHierarchyStyle({ depth: props.depth }),
    '--kg-data-view-tree-depth': String(Math.max(0, props.depth)),
  } as React.CSSProperties
  return (
    <td
      className={`${MARKDOWN_DATA_VIEW_TREE_CELL_CLASSNAME} ${props.cellPaddingClassName} w-12 border-b ${UI_THEME_TOKENS.table.cellBorder} align-top`}
      data-kg-markdown-data-view-row-hierarchy-cell={props.scope === 'row' ? '1' : undefined}
      data-kg-markdown-data-view-column-record-hierarchy-cell={props.scope === 'columnRecord' ? '1' : undefined}
      data-kg-markdown-data-view-row-hierarchy-line-depth={String(props.depth)}
      data-kg-markdown-data-view-row-hierarchy-branch={props.depth > 0 || props.childCount > 0 ? '1' : undefined}
      data-kg-markdown-data-view-row-hierarchy-parent={props.childCount > 0 ? '1' : undefined}
      style={style}
    >
      {props.childCount > 0 ? (
        <MarkdownDataViewNestedRowToggle collapsed={props.collapsed} onToggle={props.onToggle} />
      ) : null}
    </td>
  )
}
