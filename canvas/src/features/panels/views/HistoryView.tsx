import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import IconButton from '@/components/IconButton'
import { Save as SaveIcon, RotateCcw as ResetIcon, RotateCcw as RestoreIcon } from 'lucide-react'
import { formatTimestamp } from '@/features/panels/utils/time'
import { normalized as normalizeText } from '@/features/panels/utils/json'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import { getIconSizeClass } from '@/lib/ui'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

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
    <article className="h-full flex flex-col">
      <header className={`px-3 py-2 border-b ${UI_THEME_TOKENS.panel.border}`}>
        <div className="flex items-center gap-2">
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
      </header>
      <section className="flex-1 overflow-auto px-3 py-2">
        {filtered.length === 0 ? (
          <div className={`px-3 py-2 text-sm ${UI_THEME_TOKENS.text.tertiary}`}>{UI_COPY.historyNoHistoryYet}</div>
        ) : (
          <ul className="space-y-1">
            {filtered.map((h, idx) => (
              <li
                key={h.id}
                className={`px-3 py-2 text-sm flex items-center justify-between rounded ${
                  idx === historyIndex ? UI_THEME_TOKENS.table.rowSelected : `hover:${UI_THEME_TOKENS.table.rowHover}`
                }`}
              >
                <div>
                  <div className={UI_THEME_TOKENS.text.primary}>{h.label}</div>
                  <div className={`text-xs ${UI_THEME_TOKENS.text.tertiary}`}>{formatTimestamp(h.timestamp)}</div>
                </div>
                <IconButton
                  className="App-toolbar__btn"
                  title={UI_LABELS.restore}
                  onClick={() => restoreHistory(history.findIndex(x => x.id === h.id))}
                  showTooltip
                >
                  <RestoreIcon className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden="true" />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  )
}
