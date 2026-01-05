import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import IconButton from '@/components/IconButton'
import { Save as SaveIcon, RotateCcw as ResetIcon, RotateCcw as RestoreIcon } from 'lucide-react'
import { formatTimestamp } from '@/features/panels/utils/time'
import { normalized as normalizeText } from '@/features/panels/utils/json'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import { getIconSizeClass } from '@/lib/ui'

export default function HistoryView({ searchQuery }: { searchQuery: string }) {
  const {
    history,
    historyIndex,
    addHistory,
    undoHistory,
    redoHistory,
    restoreHistory,
    uiIconScale,
    uiIconStrokeWidth,
  } = useGraphStore()
  const normalizedQuery = normalizeText(searchQuery).trim()
  const filtered = React.useMemo(
    () =>
      normalizedQuery
        ? history.filter(h =>
            normalizeText([h.label, String(h.timestamp)].join(' ')).includes(normalizedQuery),
          )
        : history,
    [history, normalizedQuery],
  )
  const applySnapshot = React.useCallback(() => { addHistory('Manual Snapshot') }, [addHistory])
  const iconSizeClass = getIconSizeClass(uiIconScale)
  return (
    <div>
      <div className="px-3">
        <div className="mb-2 flex items-center gap-2">
          <IconButton className="App-toolbar__btn" title={UI_LABELS.undo} onClick={() => undoHistory()} showTooltip>
            <ResetIcon className={`${iconSizeClass} rotate-180`} strokeWidth={uiIconStrokeWidth} aria-hidden="true" />
          </IconButton>
          <IconButton className="App-toolbar__btn" title={UI_LABELS.redo} onClick={() => redoHistory()} showTooltip>
            <ResetIcon className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden="true" />
          </IconButton>
          <IconButton className="App-toolbar__btn" title="Snapshot" onClick={applySnapshot} showTooltip>
            <SaveIcon className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden="true" />
          </IconButton>
        </div>
      </div>
      <div className="px-3">
        {filtered.length === 0 ? (
          <div className="px-3 py-2 text-sm text-gray-500">{UI_COPY.historyNoHistoryYet}</div>
        ) : (
          <div>
            {filtered.map((h, idx) => (
              <div
                key={h.id}
                className={`px-3 py-2 text-sm flex items-center justify-between ${idx === historyIndex ? 'bg-blue-50' : ''}`}
              >
                <div>
                  <div className="text-gray-800">{h.label}</div>
                  <div className="text-xs text-gray-500">{formatTimestamp(h.timestamp)}</div>
                </div>
                <IconButton
                  className="App-toolbar__btn"
                  title={UI_LABELS.restore}
                  onClick={() => restoreHistory(history.findIndex(x => x.id === h.id))}
                  showTooltip
                >
                  <RestoreIcon className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden="true" />
                </IconButton>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
