import { ChevronsDown, ChevronsRight } from 'lucide-react'
import { UI_RESPONSIVE_COMPACT_GLYPH_CLASSNAME } from '@/lib/ui/responsiveElementClasses'

export function MarkdownDataViewNestedRowsBulkToggle(props: {
  collapsed: boolean
  onToggle: () => void
}) {
  const Icon = props.collapsed ? ChevronsRight : ChevronsDown
  return (
    <button
      type="button"
      aria-label={props.collapsed ? 'Expand all nested rows' : 'Collapse all nested rows'}
      aria-pressed={props.collapsed}
      className="inline-flex align-middle text-[color:var(--kg-muted-foreground)] hover:text-[color:var(--kg-text-primary)]"
      data-kg-markdown-data-view-row-nested-bulk-toggle="1"
      onClick={event => {
        event.preventDefault()
        event.stopPropagation()
        props.onToggle()
      }}
    >
      <Icon className={UI_RESPONSIVE_COMPACT_GLYPH_CLASSNAME} aria-hidden="true" />
    </button>
  )
}
