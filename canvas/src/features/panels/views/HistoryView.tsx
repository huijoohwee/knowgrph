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
import { downloadBlob } from '@/lib/graph/save'

type HistorySubTab = 'chat' | 'history' | 'log'

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
    chatExchangeLogs,
    clearChatExchangeLogs,
    uiIconScale,
    uiIconStrokeWidth,
  } = useGraphStore()
  const [tab, setTab] = React.useState<HistorySubTab>('chat')
  const [expandedChatLogIds, setExpandedChatLogIds] = React.useState<Record<string, boolean>>({})
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
  const filteredChatLogs = React.useMemo(() => {
    const rows = Array.isArray(chatExchangeLogs) ? chatExchangeLogs : []
    if (!normalizedQuery) return rows
    return rows.filter(r =>
      normalizeText([r.request, r.response, r.snippet, String(r.tsMs), r.status, r.model || ''].join(' ')).includes(normalizedQuery),
    )
  }, [chatExchangeLogs, normalizedQuery])

  const buildLogMarkdown = React.useCallback((rows: typeof filteredLog) => {
    const esc = (raw: unknown) =>
      String(raw ?? '')
        .replace(/\r?\n/g, ' ')
        .replace(/\|/g, '\\|')
        .trim()
    const lines: string[] = []
    lines.push('| Timestamp | Message | Source | Kind |')
    lines.push('|----------|---------|--------|------|')
    for (const r of rows) {
      lines.push(`| ${esc(formatTimestamp(r.tsMs))} | ${esc(r.message)} | ${esc(r.source || '')} | ${esc(r.kind)} |`)
    }
    return lines.join('\n')
  }, [])

  const exportLogMarkdown = React.useCallback(() => {
    const md = buildLogMarkdown(filteredLog)
    const blob = new Blob([md], { type: 'text/markdown' })
    const d = new Date()
    const yyyy = String(d.getFullYear())
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    downloadBlob(blob, `history-log-${yyyy}-${mm}-${dd}.md`)
  }, [buildLogMarkdown, filteredLog])

  const applySnapshot = React.useCallback(() => { addHistory('Manual Snapshot') }, [addHistory])
  const iconSizeClass = getIconSizeClass(uiIconScale)

  const canUndo = historyIndex > 0
  const canRedo = historyIndex >= 0 && historyIndex < history.length - 1

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
            <IconButton className="App-toolbar__btn" title={UI_LABELS.undo} onClick={() => undoHistory()} disabled={!canUndo} showTooltip>
              <ResetIcon className={`${iconSizeClass} rotate-180`} strokeWidth={uiIconStrokeWidth} aria-hidden="true" />
            </IconButton>
            <IconButton className="App-toolbar__btn" title={UI_LABELS.redo} onClick={() => redoHistory()} disabled={!canRedo} showTooltip>
              <ResetIcon className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden="true" />
            </IconButton>
            <IconButton className="App-toolbar__btn" title="Snapshot" onClick={applySnapshot} showTooltip>
              <SaveIcon className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden="true" />
            </IconButton>
            {tab === 'chat' && (
              <IconButton className="App-toolbar__btn" title={UI_LABELS.clear} onClick={() => clearChatExchangeLogs()} showTooltip>
                <ResetIcon className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden="true" />
              </IconButton>
            )}
            {tab === 'log' && (
              <>
                <IconButton className="App-toolbar__btn" title="Export Markdown" onClick={exportLogMarkdown} showTooltip>
                  <FileText className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden="true" />
                </IconButton>
                <IconButton className="App-toolbar__btn" title={UI_LABELS.clear} onClick={() => clearUiLog()} showTooltip>
                  <ResetIcon className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden="true" />
                </IconButton>
              </>
            )}
          </div>
          <nav className="flex items-center gap-1" aria-label="History tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'chat'}
              className={`App-toolbar__btn ${tab === 'chat' ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}` : `${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}`}
              onClick={() => setTab('chat')}
            >
              Chat
            </button>
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
              {filteredHistory.map((h) => {
                const originalIndex = history.findIndex(x => x.id === h.id)
                const isSelected = originalIndex >= 0 && originalIndex === historyIndex
                return (
                <li
                  key={h.id}
                  className={`group px-3 py-2 text-sm flex items-center justify-between rounded ${
                    isSelected ? UI_THEME_TOKENS.table.rowSelected : `hover:${UI_THEME_TOKENS.table.rowHover}`
                  }`}
                >
                  <div>
                    <div className={UI_THEME_TOKENS.text.primary}>{h.label}</div>
                    <div className={`text-xs ${UI_THEME_TOKENS.text.tertiary}`}>{formatTimestamp(h.timestamp)}</div>
                  </div>
                  <IconButton
                    className="App-toolbar__btn opacity-0 group-hover:opacity-100 focus:opacity-100"
                    title={UI_LABELS.restore}
                    onClick={() => {
                      if (originalIndex < 0) return
                      restoreHistory(originalIndex)
                    }}
                    showTooltip
                  >
                    <RestoreIcon className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden="true" />
                  </IconButton>
                </li>
                )
              })}
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
              <div className={`rounded border ${UI_THEME_TOKENS.panel.border} overflow-hidden`}>
                <table className="w-full text-sm" aria-label="History Log Table">
                  <thead className={`${UI_THEME_TOKENS.panel.bg} border-b ${UI_THEME_TOKENS.panel.border}`}>
                    <tr>
                      <th className={`text-left px-3 py-2 text-xs ${UI_THEME_TOKENS.text.secondary}`}>Timestamp</th>
                      <th className={`text-left px-3 py-2 text-xs ${UI_THEME_TOKENS.text.secondary}`}>Message</th>
                      <th className={`text-left px-3 py-2 text-xs ${UI_THEME_TOKENS.text.secondary}`}>Source</th>
                      <th className={`text-left px-3 py-2 text-xs ${UI_THEME_TOKENS.text.secondary}`}>Kind</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLog.map(row => (
                      <tr key={row.id} className={`hover:${UI_THEME_TOKENS.table.rowHover}`}>
                        <td className={`px-3 py-2 align-top text-xs ${UI_THEME_TOKENS.text.tertiary} whitespace-nowrap`}>{formatTimestamp(row.tsMs)}</td>
                        <td className={`px-3 py-2 align-top ${UI_THEME_TOKENS.text.primary} break-words`}>{row.message}</td>
                        <td className={`px-3 py-2 align-top text-xs ${UI_THEME_TOKENS.text.tertiary} whitespace-nowrap`}>{row.source || ''}</td>
                        <td className={`px-3 py-2 align-top text-xs ${UI_THEME_TOKENS.text.secondary} whitespace-nowrap`}>{row.kind}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        {tab === 'chat' && (
          <div>
            <h3 className={`text-xs font-semibold ${UI_THEME_TOKENS.text.secondary} mb-2 uppercase tracking-wider`}>
              Chat
            </h3>
            {filteredChatLogs.length === 0 ? (
              <div className={`px-3 py-2 text-sm ${UI_THEME_TOKENS.text.tertiary}`}>No chat entries.</div>
            ) : (
              <div className={`rounded border ${UI_THEME_TOKENS.panel.border} overflow-hidden`}>
                <table className="w-full text-sm" aria-label="Chat Exchange Table">
                  <thead className={`${UI_THEME_TOKENS.panel.bg} border-b ${UI_THEME_TOKENS.panel.border}`}>
                    <tr>
                      <th className={`text-left px-3 py-2 text-xs ${UI_THEME_TOKENS.text.secondary}`}>User Request / AI Response</th>
                      <th className={`text-left px-3 py-2 text-xs ${UI_THEME_TOKENS.text.secondary}`}>Snippet</th>
                      <th className={`text-left px-3 py-2 text-xs ${UI_THEME_TOKENS.text.secondary}`}>Timestamp</th>
                      <th className={`text-left px-3 py-2 text-xs ${UI_THEME_TOKENS.text.secondary}`}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredChatLogs.map(row => {
                      const isExpanded = expandedChatLogIds[row.id] === true
                      return (
                        <React.Fragment key={row.id}>
                          <tr className={`hover:${UI_THEME_TOKENS.table.rowHover}`}>
                            <td className={`px-3 py-2 align-top ${UI_THEME_TOKENS.text.primary} break-words`}>
                              <div className="font-medium">User: {row.request || '—'}</div>
                              <div className={`mt-1 ${UI_THEME_TOKENS.text.secondary}`}>AI: {row.response || '—'}</div>
                            </td>
                            <td className="px-3 py-2 align-top">
                              <button
                                type="button"
                                className={`App-toolbar__btn text-xs ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
                                onClick={() => {
                                  setExpandedChatLogIds(prev => ({ ...prev, [row.id]: !isExpanded }))
                                }}
                              >
                                {isExpanded ? 'Collapse' : 'Expand'}
                              </button>
                              <div className={`mt-1 text-xs ${UI_THEME_TOKENS.text.tertiary}`}>{row.snippet || '—'}</div>
                            </td>
                            <td className={`px-3 py-2 align-top text-xs ${UI_THEME_TOKENS.text.tertiary} whitespace-nowrap`}>{formatTimestamp(row.tsMs)}</td>
                            <td className={`px-3 py-2 align-top text-xs ${UI_THEME_TOKENS.text.secondary} whitespace-nowrap`}>{row.status}</td>
                          </tr>
                          {isExpanded && (
                            <tr className={`${UI_THEME_TOKENS.panel.bg}`}>
                              <td colSpan={4} className={`px-3 py-2 text-xs ${UI_THEME_TOKENS.text.primary} border-t ${UI_THEME_TOKENS.panel.border}`}>
                                <div className="space-y-2">
                                  <div>
                                    <div className={`font-semibold ${UI_THEME_TOKENS.text.secondary}`}>User Request</div>
                                    <pre className="whitespace-pre-wrap break-words">{row.request || '—'}</pre>
                                  </div>
                                  <div>
                                    <div className={`font-semibold ${UI_THEME_TOKENS.text.secondary}`}>AI Response</div>
                                    <pre className="whitespace-pre-wrap break-words">{row.response || '—'}</pre>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>
    </article>
  )
}
