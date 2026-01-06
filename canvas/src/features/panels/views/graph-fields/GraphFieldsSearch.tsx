import React from 'react'
import { UI_COPY } from '@/lib/config'
import { SearchIcon } from '@/features/graph-fields/ui/graphFieldIcons'

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
    <div className="border-b border-gray-200 bg-white p-2">
      <div className="h-8 flex items-center gap-2 rounded border border-gray-300 bg-white px-2">
        <SearchIcon
          className={`${iconSizeClass} text-gray-500`}
          strokeWidth={uiIconStrokeWidth}
        />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={UI_COPY.searchFieldsPlaceholder}
          className="h-8 w-full bg-transparent text-xs outline-none"
          autoFocus
        />
      </div>
    </div>
  )
}
