import React, { forwardRef } from 'react'
import IconButton from '@/components/IconButton'
import { X } from 'lucide-react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { scheduleDebouncedSearch } from '@/features/toolbar/utils'
import type { SearchResult } from '@/features/search/types'
import { UI_ANCHORS, UI_LABELS } from '@/lib/config'
import { getIconSizeClass } from '@/lib/ui'

interface SearchPanelProps {
  onClose?: () => void
}

const SearchPanel = forwardRef<HTMLDivElement, SearchPanelProps>(({ onClose }, ref) => {
  const { graphData, selectNode, selectEdge, graphId, historyIndex, uiIconScale, uiIconStrokeWidth } = useGraphStore()
  const [searchQuery, setSearchQuery] = React.useState('')
  const [searchResults, setSearchResults] = React.useState<SearchResult[]>([])
  const [activeIdx, setActiveIdx] = React.useState<number>(0)
  const iconSizeClass = getIconSizeClass(uiIconScale)
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-xs',
  )

  React.useEffect(() => {
    const versionKey = `${graphId || ''}|${historyIndex ?? ''}`
    return scheduleDebouncedSearch(graphData, searchQuery, 50, 150, versionKey, (res) => {
      setSearchResults(res)
      setActiveIdx(0)
    })
  }, [graphData, searchQuery, graphId, historyIndex])

  return (
    <div
      ref={ref}
      className="mt-1 w-80 rounded border border-gray-200 bg-white shadow p-2"
      data-kg-anchor={UI_ANCHORS.searchPanel}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-gray-600">{UI_LABELS.search}</span>
        <IconButton className="App-toolbar__btn" title={UI_LABELS.close} onClick={() => onClose?.()} showTooltip>
          <X className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
        </IconButton>
      </div>
      <input
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        placeholder="Search nodes and edges…"
        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
        aria-label="Search graph"
        onKeyDown={e => {
          const k = e.key.toLowerCase()
          if (k === 'enter') {
            const r = searchResults[activeIdx]
            if (!r) return
            if (r.kind === 'node') selectNode(r.id)
            else selectEdge(r.id)
            onClose?.()
          } else if (k === 'arrowdown') {
            e.preventDefault()
            setActiveIdx(i => Math.min(i + 1, Math.max(0, searchResults.length - 1)))
          } else if (k === 'arrowup') {
            e.preventDefault()
            setActiveIdx(i => Math.max(i - 1, 0))
          }
        }}
      />
      <div className="mt-2 max-h-64 overflow-auto">
        {searchQuery.trim() && searchResults.length === 0 ? (
          <div className="px-2 py-2 text-xs text-gray-500">No results</div>
        ) : (
          searchResults.map((r, idx) => (
            <div
              key={`${r.kind}:${r.id}`}
              className={`flex items-center justify-between rounded px-2 py-2 text-sm ${
                idx === activeIdx ? 'bg-blue-50' : 'hover:bg-gray-50'
              }`}
              onMouseEnter={() => setActiveIdx(idx)}
              onClick={() => {
                if (r.kind === 'node') selectNode(r.id)
                else selectEdge(r.id)
                onClose?.()
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`${uiPanelKeyValueTextSizeClass} px-1.5 py-0.5 rounded ${
                    r.kind === 'node'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {r.kind === 'node' ? UI_ANCHORS.searchNode : UI_ANCHORS.searchEdge}
                </span>
                <span className="text-gray-800">{r.title}</span>
              </div>
              {r.kind === 'node' ? (
                <span className={`${uiPanelKeyValueTextSizeClass} text-gray-500`}>
                  {r.meta?.type ?? ''}
                </span>
              ) : (
                <span className={`${uiPanelKeyValueTextSizeClass} text-gray-500`}>
                  {r.meta?.source ?? ''} → {r.meta?.target ?? ''}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
})

export default SearchPanel
