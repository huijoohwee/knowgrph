import React, { forwardRef } from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { scheduleDebouncedSearch } from '@/features/toolbar/utils'
import type { SearchResult } from '@/features/search/types'
import { UI_ANCHORS } from '@/lib/config'
import { dispatchRuntimeZoomActionSoon } from '@/lib/canvas/runtimeZoomDispatch'

interface SearchPanelProps {
  onClose?: () => void
}

const SearchPanel = forwardRef<HTMLDivElement, SearchPanelProps>(({ onClose }, ref) => {
  const { graphData, graphDataRevision, selectNode, selectEdge, setSelectionSource, graphId, historyIndex } = useGraphStore()
  const [searchQuery, setSearchQuery] = React.useState('')
  const [searchResults, setSearchResults] = React.useState<SearchResult[]>([])

  React.useEffect(() => {
    const versionKey = `${graphId || ''}|${historyIndex ?? ''}|${graphDataRevision ?? ''}`
    return scheduleDebouncedSearch(graphData, searchQuery, 50, 150, versionKey, (res) => {
      setSearchResults(res)
    })
  }, [graphData, graphDataRevision, searchQuery, graphId, historyIndex])

  const commitSearchSelection = React.useCallback((result: SearchResult | null | undefined) => {
    if (!result) return
    setSelectionSource('menu')
    if (result.kind === 'node') selectNode(result.id)
    else selectEdge(result.id)
    dispatchRuntimeZoomActionSoon('selection')
    onClose?.()
  }, [onClose, selectEdge, selectNode, setSelectionSource])

  return (
    <div
      ref={ref}
      className="kg-toolbar-dropdown-menu mt-1 w-80 rounded border border-[color:var(--kg-border)] bg-[var(--kg-panel-bg)] shadow p-1"
      data-kg-anchor={UI_ANCHORS.searchPanel}
    >
      <input
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        placeholder="Search nodes and edges..."
        className="w-full min-w-0 h-[var(--kg-control-height,28px)] px-2 rounded border border-[color:var(--kg-border)] bg-[var(--kg-panel-bg)] text-[color:var(--kg-text-primary)] font-sans text-sm"
        aria-label="Search graph"
        onKeyDown={e => {
          const k = e.key.toLowerCase()
          if (k === 'enter') {
            commitSearchSelection(searchResults[0])
          } else if (k === 'escape') {
            if (searchQuery.trim().length > 0) {
              setSearchQuery('')
              return
            }
            onClose?.()
          }
        }}
        autoFocus
      />
    </div>
  )
})

export default SearchPanel
