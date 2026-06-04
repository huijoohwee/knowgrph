import React from 'react'
import { UI_COPY } from '@/lib/config'
import { SearchIcon } from '@/features/graph-fields/ui/graphFieldIcons'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import {
  UI_RESPONSIVE_GRAPH_FIELDS_INLINE_FIELD_CLASSNAME,
  UI_RESPONSIVE_GRAPH_FIELDS_INLINE_FIELD_SHELL_CLASSNAME,
  UI_RESPONSIVE_GRAPH_FIELDS_PANEL_STRIP_CLASSNAME,
} from '@/lib/ui/responsiveElementClasses'

export type GraphFieldsSearchProps = {
  search: string
  setSearch: (value: string) => void
  iconSizeClass: string
  uiIconStrokeWidth: number
}

export function GraphFieldsSearch({
  search,
  setSearch,
  iconSizeClass,
  uiIconStrokeWidth,
}: GraphFieldsSearchProps) {
  return (
    <section className={`${UI_RESPONSIVE_GRAPH_FIELDS_PANEL_STRIP_CLASSNAME} border-b ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.headerBg}`}>
      <section className={`${UI_RESPONSIVE_GRAPH_FIELDS_INLINE_FIELD_SHELL_CLASSNAME} flex items-center gap-2 rounded border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.panel.bg}`}>
        <SearchIcon
          className={`${iconSizeClass} ${UI_THEME_TOKENS.text.tertiary}`}
          strokeWidth={uiIconStrokeWidth}
        />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={UI_COPY.searchFieldsPlaceholder}
          className={`${UI_RESPONSIVE_GRAPH_FIELDS_INLINE_FIELD_CLASSNAME} bg-transparent text-xs outline-none ${UI_THEME_TOKENS.text.primary}`}
          autoFocus
        />
      </section>
    </section>
  )
}
