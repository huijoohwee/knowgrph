import React from 'react'
import { UI_COPY } from '@/lib/config'
import { SearchIcon } from '@/features/graph-fields/ui/graphFieldIcons'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

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
    <div className={`border-b ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.headerBg} p-2`}>
      <div className={`h-8 flex items-center gap-2 rounded border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.panel.bg} px-2`}>
        <SearchIcon
          className={`${iconSizeClass} ${UI_THEME_TOKENS.text.tertiary}`}
          strokeWidth={uiIconStrokeWidth}
        />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={UI_COPY.searchFieldsPlaceholder}
          className={`h-8 w-full bg-transparent text-xs outline-none ${UI_THEME_TOKENS.text.primary}`}
          autoFocus
        />
      </div>
    </div>
  )
}
