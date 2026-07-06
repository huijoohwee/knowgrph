import { ChevronRight } from 'lucide-react'
import { UI_RESPONSIVE_COMPACT_GLYPH_CLASSNAME } from '@/lib/ui/responsiveElementClasses'

export function MarkdownDataViewNestedRowToggle(props: {
  collapsed: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      aria-label={props.collapsed ? 'Expand nested rows' : 'Collapse nested rows'}
      aria-expanded={!props.collapsed}
      className="inline-flex align-middle text-[color:var(--kg-muted-foreground)] hover:text-[color:var(--kg-text-primary)]"
      data-kg-markdown-data-view-row-nested-toggle="1"
      onClick={event => {
        event.preventDefault()
        event.stopPropagation()
        props.onToggle()
      }}
    >
      <ChevronRight className={[UI_RESPONSIVE_COMPACT_GLYPH_CLASSNAME, props.collapsed ? '' : 'rotate-90'].join(' ')} aria-hidden="true" />
    </button>
  )
}
