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
  const hasTreeGuide = props.childCount === 0
  const style = {
    ...readMarkdownDataViewRowsAsRecordsHierarchyStyle({ depth: props.depth }),
  } as React.CSSProperties
  return (
    <td
      className={`${MARKDOWN_DATA_VIEW_TREE_CELL_CLASSNAME} ${props.cellPaddingClassName} w-16 border-b ${UI_THEME_TOKENS.table.cellBorder} align-middle`}
      data-kg-markdown-data-view-row-hierarchy-cell={props.scope === 'row' ? '1' : undefined}
      data-kg-markdown-data-view-column-record-hierarchy-cell={props.scope === 'columnRecord' ? '1' : undefined}
      data-kg-markdown-data-view-row-hierarchy-line-depth={String(props.depth)}
      data-kg-markdown-data-view-row-hierarchy-branch={hasTreeGuide ? '1' : undefined}
      data-kg-markdown-data-view-row-hierarchy-parent={props.childCount > 0 ? '1' : undefined}
      style={style}
    >
      {hasTreeGuide ? (
        <svg className="kg-data-view-tree-cell-guide" aria-hidden="true" focusable="false" viewBox="0 0 24 24" preserveAspectRatio="none">
          <line className="kg-data-view-tree-cell-guide-line" x1="12" x2="12" y1="0" y2="24" />
        </svg>
      ) : null}
      <span className="kg-data-view-tree-control">
        {props.childCount > 0 ? (
          <MarkdownDataViewNestedRowToggle collapsed={props.collapsed} onToggle={props.onToggle} />
        ) : null}
      </span>
    </td>
  )
}
