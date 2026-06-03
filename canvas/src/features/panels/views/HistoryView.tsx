import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import IconButton from '@/components/IconButton'
import { UiActionButtons } from '@/components/ui/UiActionButtons'
// import { performMarkdownImport } from '@/features/toolbar/markdownImportAction'
// import { performJsonImport } from '@/features/toolbar/jsonImportAction'
import { Save as SaveIcon, RotateCcw as ResetIcon, RotateCcw as RestoreIcon, FileText, Link as LinkIcon, FileJson, FileCode, FileType } from 'lucide-react'
import { formatTimestamp } from '@/features/panels/utils/time'
import { normalized as normalizeText } from '@/features/panels/utils/json'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import { getIconSizeClass } from '@/lib/ui'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import type { ChatExchangeLogEntry, GraphState, RecentFileEntry, UiLogEntry } from '@/hooks/store/types'
import { downloadBlob } from '@/lib/graph/save'
import { useShallow } from 'zustand/react/shallow'
import { hashArrayOfObjectsSignature, hashSignatureParts } from '@/lib/hash/signature'
import { ToolbarDropdownSelect } from '@/components/toolbar/ToolbarDropdownSelect'
import {
  UI_RESPONSIVE_HISTORY_RECENT_FILE_LOCATION_CLASSNAME,
  UI_RESPONSIVE_TINY_TOOLBAR_DROPDOWN_WIDTH_CLASSNAME,
} from '@/lib/ui/responsiveElementClasses'

type HistorySubTab = 'chat' | 'history' | 'log'
type HistoryEntry = GraphState['history'][number]

const EMPTY_HISTORY: HistoryEntry[] = []
const EMPTY_RECENT_FILES: RecentFileEntry[] = []
const EMPTY_UI_LOG_ENTRIES: UiLogEntry[] = []
const EMPTY_CHAT_EXCHANGE_LOG_ENTRIES: ChatExchangeLogEntry[] = []

function useSemanticSnapshot<T>(value: T, signature: string): T {
  const ref = React.useRef<{ signature: string; value: T } | null>(null)
  if (ref.current?.signature !== signature) {
    ref.current = { signature, value }
  }
  return ref.current.value
}

function buildHistoryEntriesSignature(rows: readonly HistoryEntry[]): string {
  return hashSignatureParts([
    'history-view:history',
    rows.length,
    hashArrayOfObjectsSignature(
      rows.map(row => ({
        id: String(row?.id || ''),
        label: String(row?.label || ''),
        timestamp: typeof row?.timestamp === 'number' ? row.timestamp : 0,
      })),
      { maxItems: Math.max(48, rows.length), maxKeysPerItem: 3 },
    ),
  ])
}

function buildRecentFilesSignature(rows: readonly RecentFileEntry[]): string {
  return hashSignatureParts([
    'history-view:recent',
    rows.length,
    hashArrayOfObjectsSignature(
      rows.map(row => ({
        id: String(row?.id || ''),
        name: String(row?.name || ''),
        path: String(row?.path || ''),
        url: String(row?.url || ''),
        timestamp: typeof row?.timestamp === 'number' ? row.timestamp : 0,
        type: String(row?.type || ''),
      })),
      { maxItems: Math.max(48, rows.length), maxKeysPerItem: 6 },
    ),
  ])
}

function buildUiLogEntriesSignature(rows: readonly UiLogEntry[]): string {
  return hashSignatureParts([
    'history-view:ui-log',
    rows.length,
    hashArrayOfObjectsSignature(
      rows.map(row => ({
        id: String(row?.id || ''),
        kind: String(row?.kind || ''),
        message: String(row?.message || ''),
        tsMs: typeof row?.tsMs === 'number' ? row.tsMs : 0,
        source: String(row?.source || ''),
        actions: Array.isArray(row?.actions)
          ? row.actions.map(action => `${String(action?.id || '')}:${String(action?.label || '')}:${String(action?.tone || '')}`).join('|')
          : '',
      })),
      { maxItems: Math.max(80, rows.length), maxKeysPerItem: 6 },
    ),
  ])
}

function buildChatExchangeLogsSignature(rows: readonly ChatExchangeLogEntry[]): string {
  return hashSignatureParts([
    'history-view:chat-log',
    rows.length,
    hashArrayOfObjectsSignature(
      rows.map(row => ({
        id: String(row?.id || ''),
        request: String(row?.request || ''),
        response: String(row?.response || ''),
        snippet: String(row?.snippet || ''),
        tsMs: typeof row?.tsMs === 'number' ? row.tsMs : 0,
        status: String(row?.status || ''),
        model: String(row?.model || ''),
      })),
      { maxItems: Math.max(80, rows.length), maxKeysPerItem: 7 },
    ),
  ])
}

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
    history: historyRaw,
    historyIndex,
    recentFiles: recentFilesRaw,
    addHistory,
    undoHistory,
    redoHistory,
    restoreHistory,
    uiLogEntries: uiLogEntriesRaw,
    clearUiLog,
    chatExchangeLogs: chatExchangeLogsRaw,
    clearChatExchangeLogs,
    requestedHistorySubTab,
    requestHistorySubTab,
    uiIconScale,
    uiIconStrokeWidth,
  } = useGraphStore(
    useShallow(s => ({
      history: Array.isArray(s.history) ? s.history : EMPTY_HISTORY,
      historyIndex: s.historyIndex,
      recentFiles: Array.isArray(s.recentFiles) ? s.recentFiles : EMPTY_RECENT_FILES,
      addHistory: s.addHistory,
      undoHistory: s.undoHistory,
      redoHistory: s.redoHistory,
      restoreHistory: s.restoreHistory,
      uiLogEntries: Array.isArray(s.uiLogEntries) ? s.uiLogEntries : EMPTY_UI_LOG_ENTRIES,
      clearUiLog: s.clearUiLog,
      chatExchangeLogs: Array.isArray(s.chatExchangeLogs) ? s.chatExchangeLogs : EMPTY_CHAT_EXCHANGE_LOG_ENTRIES,
      clearChatExchangeLogs: s.clearChatExchangeLogs,
      requestedHistorySubTab: s.requestedHistorySubTab as string | null,
      requestHistorySubTab: s.requestHistorySubTab,
      uiIconScale: s.uiIconScale,
      uiIconStrokeWidth: s.uiIconStrokeWidth,
    })),
  )
  const [tab, setTab] = React.useState<HistorySubTab>('chat')
  React.useEffect(() => {
    if (!requestedHistorySubTab) return
    const valid = requestedHistorySubTab === 'chat' || requestedHistorySubTab === 'history' || requestedHistorySubTab === 'log'
    if (valid) setTab(requestedHistorySubTab as HistorySubTab)
    requestHistorySubTab(null)
  }, [requestedHistorySubTab, requestHistorySubTab])
  const [expandedChatLogIds, setExpandedChatLogIds] = React.useState<Record<string, boolean>>({})
  const normalizedQuery = normalizeText(searchQuery).trim()
  const historySignature = React.useMemo(() => buildHistoryEntriesSignature(historyRaw), [historyRaw])
  const recentFilesSignature = React.useMemo(() => buildRecentFilesSignature(recentFilesRaw), [recentFilesRaw])
  const uiLogEntriesSignature = React.useMemo(() => buildUiLogEntriesSignature(uiLogEntriesRaw), [uiLogEntriesRaw])
  const chatExchangeLogsSignature = React.useMemo(() => buildChatExchangeLogsSignature(chatExchangeLogsRaw), [chatExchangeLogsRaw])
  const history = useSemanticSnapshot(historyRaw, historySignature)
  const recentFiles = useSemanticSnapshot(recentFilesRaw, recentFilesSignature)
  const uiLogEntries = useSemanticSnapshot(uiLogEntriesRaw, uiLogEntriesSignature)
  const chatExchangeLogs = useSemanticSnapshot(chatExchangeLogsRaw, chatExchangeLogsSignature)
  const historyIndexById = React.useMemo(() => {
    const byId = new Map<string, number>()
    for (let i = 0; i < history.length; i += 1) {
      const id = String(history[i]?.id || '').trim()
      if (id) byId.set(id, i)
    }
    return byId
  }, [history])
  const filteredHistory = React.useMemo(
    () =>
      tab === 'history' && normalizedQuery
        ? history.filter(h =>
            normalizeText([h.label, String(h.timestamp)].join(' ')).includes(normalizedQuery),
          )
        : history,
    [history, normalizedQuery, tab],
  )
  const filteredRecent = React.useMemo(
    () =>
      tab === 'history' && normalizedQuery
        ? recentFiles.filter(f =>
            normalizeText([f.name, f.path || '', f.url || '', String(f.timestamp)].join(' ')).includes(
              normalizedQuery,
            ),
          )
        : recentFiles,
    [normalizedQuery, recentFiles, tab],
  )
  const filteredLog = React.useMemo(() => {
    const rows = uiLogEntries
    if (tab !== 'log') return rows
    if (!normalizedQuery) return rows
    return rows.filter(r => normalizeText([r.kind, r.message, String(r.tsMs), r.source || ''].join(' ')).includes(normalizedQuery))
  }, [normalizedQuery, tab, uiLogEntries])
  const filteredChatLogs = React.useMemo(() => {
    const rows = chatExchangeLogs
    if (tab !== 'chat') return rows
    if (!normalizedQuery) return rows
    return rows.filter(r =>
      normalizeText([r.request, r.response, r.snippet, String(r.tsMs), r.status, r.model || ''].join(' ')).includes(normalizedQuery),
    )
  }, [chatExchangeLogs, normalizedQuery, tab])

  React.useEffect(() => {
    const liveChatLogIds = new Set(chatExchangeLogs.map(row => String(row?.id || '').trim()).filter(Boolean))
    setExpandedChatLogIds(prev => {
      const next: Record<string, boolean> = {}
      let changed = false
      for (const [id, expanded] of Object.entries(prev)) {
        if (expanded !== true) {
          changed = true
          continue
        }
        if (!liveChatLogIds.has(id)) {
          changed = true
          continue
        }
        next[id] = true
      }
      if (!changed && Object.keys(next).length === Object.keys(prev).length) return prev
      return next
    })
  }, [chatExchangeLogs])

  const buildLogMarkdown = React.useCallback((rows: readonly UiLogEntry[]) => {
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
  const historyTabs = React.useMemo(
    () =>
      [
        { id: 'chat' as const, title: 'Chat' },
        { id: 'history' as const, title: UI_LABELS.history },
        { id: 'log' as const, title: UI_LABELS.log },
      ] satisfies Array<{ id: HistorySubTab; title: string }>,
    [],
  )

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
            {canUndo ? (
              <IconButton className="App-toolbar__btn" title={UI_LABELS.undo} onClick={() => undoHistory()} showTooltip>
                <ResetIcon className={`${iconSizeClass} rotate-180`} strokeWidth={uiIconStrokeWidth} aria-hidden="true" />
              </IconButton>
            ) : null}
            {canRedo ? (
              <IconButton className="App-toolbar__btn" title={UI_LABELS.redo} onClick={() => redoHistory()} showTooltip>
                <ResetIcon className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden="true" />
              </IconButton>
            ) : null}
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
          <ToolbarDropdownSelect
            value={tab}
            options={historyTabs}
            title={`History section: ${historyTabs.find(item => item.id === tab)?.title || 'Chat'}`}
            showTooltip={false}
            isButtonActive={true}
            onSelect={id => setTab(id as HistorySubTab)}
            renderButtonContent={activeOption => <span>{activeOption.title}</span>}
            renderOptionContent={option => <span className="truncate">{option.title}</span>}
            menuWidthClass={UI_RESPONSIVE_TINY_TOOLBAR_DROPDOWN_WIDTH_CLASSNAME}
          />
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
                        <span className={`${UI_THEME_TOKENS.text.tertiary} ${UI_RESPONSIVE_HISTORY_RECENT_FILE_LOCATION_CLASSNAME}`} title={f.path || f.url}>
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
                const originalIndex = historyIndexById.get(String(h.id || '').trim()) ?? -1
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
                        <td className={`px-3 py-2 align-top ${UI_THEME_TOKENS.text.primary} break-words`}>
                          <div>{row.message}</div>
                          <UiActionButtons actions={row.actions} className="mt-2" />
                        </td>
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
