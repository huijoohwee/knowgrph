import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import IconButton from '@/components/IconButton'
// import { performMarkdownImport } from '@/features/toolbar/markdownImportAction'
// import { performJsonImport } from '@/features/toolbar/jsonImportAction'
import { Save as SaveIcon, RotateCcw as ResetIcon, RotateCcw as RestoreIcon, FileText, Link as LinkIcon, FileJson, FileCode, FileType } from 'lucide-react'
import { formatTimestamp } from '@/features/panels/utils/time'
import { normalized as normalizeText } from '@/features/panels/utils/json'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import { getIconSizeClass } from '@/lib/ui'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import type { RecentFileEntry } from '@/hooks/store/types'

type HistorySubTab = 'history' | 'log'

function getFileIcon(type: RecentFileEntry['type']) {
  switch (type) {
    case 'json':
    case 'jsonld':
      return FileJson
    case 'markdown':
      return FileText
    case 'csv':
      return FileType
    case 'url':
      return LinkIcon
    default:
      return FileCode
  }
}

export default function HistoryView({ searchQuery }: { searchQuery: string }) {
  const {
    history,
    historyIndex,
    recentFiles,
    addHistory,
    undoHistory,
    redoHistory,
    restoreHistory,
    uiLogEntries,
    clearUiLog,
    uiIconScale,
    uiIconStrokeWidth,
  } = useGraphStore()
  const [tab, setTab] = React.useState<HistorySubTab>('history')
  const normalizedQuery = normalizeText(searchQuery).trim()
  const filteredHistory = React.useMemo(
    () =>
      normalizedQuery
        ? history.filter(h =>
            normalizeText([h.label, String(h.timestamp)].join(' ')).includes(normalizedQuery),
          )
        : history,
    [history, normalizedQuery],
  )
  const filteredRecent = React.useMemo(
    () =>
      normalizedQuery
        ? recentFiles.filter(f =>
            normalizeText([f.name, f.path || '', f.url || '', String(f.timestamp)].join(' ')).includes(
              normalizedQuery,
            ),
          )
        : recentFiles,
    [recentFiles, normalizedQuery],
  )
  const filteredLog = React.useMemo(() => {
    const rows = Array.isArray(uiLogEntries) ? uiLogEntries : []
    if (!normalizedQuery) return rows
    return rows.filter(r => normalizeText([r.kind, r.message, String(r.tsMs), r.source || ''].join(' ')).includes(normalizedQuery))
  }, [normalizedQuery, uiLogEntries])

  const applySnapshot = React.useCallback(() => { addHistory('Manual Snapshot') }, [addHistory])
  const iconSizeClass = getIconSizeClass(uiIconScale)

  // const handleOpen = React.useCallback(async (f: RecentFileEntry) => {
  //   if (f.type === 'markdown') {
  //     await performMarkdownImport(f.url ? 'url' : 'local', f.url || undefined)
  //   } else if (f.type === 'json' || f.type === 'jsonld') {
  //     await performJsonImport(f.url ? 'url' : 'local', f.type === 'jsonld' ? 'jsonld' : 'json', f.url || undefined)
  //   } else if (f.type === 'url') {
  //     await performMarkdownImport('url', f.url || undefined)
  //   }
  // }, [])

  return (
    <article className="h-full flex flex-col">
      <header className={`px-3 py-2 border-b ${UI_THEME_TOKENS.panel.border}`}>
        <div className="flex items-center justify-between gap-2">
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
            {tab === 'log' && (
              <IconButton className="App-toolbar__btn" title={UI_LABELS.clear} onClick={() => clearUiLog()} showTooltip>
                <ResetIcon className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden="true" />
              </IconButton>
            )}
          </div>
          <nav className="flex items-center gap-1" aria-label="History tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'history'}
              className={`App-toolbar__btn ${tab === 'history' ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}` : `${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}`}
              onClick={() => setTab('history')}
            >
              {UI_LABELS.history}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'log'}
              className={`App-toolbar__btn ${tab === 'log' ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}` : `${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}`}
              onClick={() => setTab('log')}
            >
              {UI_LABELS.log}
            </button>
          </nav>
        </div>
      </header>
      <section className="flex-1 overflow-auto px-3 py-2 space-y-6">
        {tab === 'history' && filteredRecent.length > 0 && (
          <div>
            <h3 className={`text-xs font-semibold ${UI_THEME_TOKENS.text.secondary} mb-2 uppercase tracking-wider`}>
              Recent Files
            </h3>
            <ul className="space-y-1">
              {filteredRecent.map(f => {
                const Icon = getFileIcon(f.type)
                return (
                  <li
                    key={f.id}
                    className={`px-3 py-2 text-sm flex items-center gap-3 rounded hover:${UI_THEME_TOKENS.table.rowHover} group`}
                  >
                    <Icon className={`${iconSizeClass} ${UI_THEME_TOKENS.text.secondary}`} strokeWidth={uiIconStrokeWidth} />
                    <div className="min-w-0 flex-1">
                      <div className={`${UI_THEME_TOKENS.text.primary} truncate`} title={f.name}>{f.name}</div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className={`${UI_THEME_TOKENS.text.tertiary} truncate max-w-[200px]`} title={f.path || f.url}>
                          {f.path || f.url || 'Local Memory'}
                        </span>
                        <span className={`${UI_THEME_TOKENS.text.tertiary} shrink-0`}>· {formatTimestamp(f.timestamp)}</span>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {tab === 'history' && (
          <div>
          <h3 className={`text-xs font-semibold ${UI_THEME_TOKENS.text.secondary} mb-2 uppercase tracking-wider`}>
            Edit History
          </h3>
          {filteredHistory.length === 0 ? (
            <div className={`px-3 py-2 text-sm ${UI_THEME_TOKENS.text.tertiary}`}>{UI_COPY.historyNoHistoryYet}</div>
          ) : (
            <ul className="space-y-1">
              {filteredHistory.map((h, idx) => (
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
                    className="App-toolbar__btn opacity-0 group-hover:opacity-100 focus:opacity-100"
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
          </div>
        )}

        {tab === 'log' && (
          <div>
            <h3 className={`text-xs font-semibold ${UI_THEME_TOKENS.text.secondary} mb-2 uppercase tracking-wider`}>
              {UI_LABELS.log}
            </h3>
            {filteredLog.length === 0 ? (
              <div className={`px-3 py-2 text-sm ${UI_THEME_TOKENS.text.tertiary}`}>No log entries.</div>
            ) : (
              <ul className="space-y-1">
                {filteredLog.map(row => (
                  <li key={row.id} className={`px-3 py-2 text-sm rounded hover:${UI_THEME_TOKENS.table.rowHover}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`${UI_THEME_TOKENS.text.tertiary} text-xs`}>{formatTimestamp(row.tsMs)}</span>
                      <span className={`${UI_THEME_TOKENS.text.secondary} text-xs`}>{row.kind}</span>
                    </div>
                    <div className={`${UI_THEME_TOKENS.text.primary} break-words`}>{row.message}</div>
                    {row.source && <div className={`${UI_THEME_TOKENS.text.tertiary} text-xs`}>{row.source}</div>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </article>
  )
}
