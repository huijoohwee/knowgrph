import React from 'react'
import { MARKDOWN_DATA_VIEW_COPY } from '@/lib/config-copy/markdownDataViewCopy'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import { buildMarkdownTokensKey, lexMarkdown } from '@/features/markdown/ui/markdownPreviewLex'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import type { HighlightedLineRange } from '../../markdownWorkspaceTypes'
import type { MarkdownGeoDatasetIntegration } from '@/features/markdown/ui/MarkdownRendererTypes'
import type { TokenWithLines } from '@/features/markdown/ui/markdownPreviewLexUtils'
import type { TokensTable } from '@/features/markdown/ui/MarkdownTokens'
import {
  appendMarkdownDataViewRow,
  appendMarkdownDataViewColumn,
  buildMarkdownDataViewFromTableToken,
  updateMarkdownDataViewCell,
  type MarkdownDataView,
  type MarkdownDataViewColumnKind,
} from '@/features/markdown/ui/markdownDataViewModel'
import { serializeMarkdownDataViewToTableLines } from '@/features/markdown/ui/markdownDataViewSerialize'
import { MarkdownDataViewKanbanView } from '@/features/markdown/ui/MarkdownDataViewKanbanView'
import { MarkdownDataViewTableView } from '@/features/markdown/ui/MarkdownDataViewTableView'
import {
  columnTypeToBaseKind,
  defaultColumnTypeForInferredKind,
  type MarkdownDataViewColumnType,
} from '@/features/markdown/ui/markdownDataViewColumnType'
import { WorkspaceModeSelect } from '../../WorkspaceModeSelect'
import { MarkdownWorkspaceHtmlViewerPane } from './MarkdownWorkspaceHtmlViewerPane'
import { rowIdToMarkdownLineInTable } from './markdownDataViewSourceMap'
import { WorkspaceDataViewHeader, type WorkspaceDataViewHeaderState } from './WorkspaceDataViewHeader'
import {
  applyWorkspaceDataViewQuery,
  computeWorkspaceDataViewGroupOptions,
  defaultWorkspaceDataViewConfig,
  readWorkspaceDataViewConfig,
  readWorkspaceDataViewStateWithMeta,
  type WorkspaceDataViewConfig,
  type WorkspaceDataViewFilterOp,
  writeWorkspaceDataViewConfig,
  writeWorkspaceDataViewState,
} from './workspaceDataViewConfig'
import { LRUCache } from '@/lib/cache/LRUCache'
import type { JsonToMarkdownMode } from '@/features/markdown/jsonToMarkdown'
import { tryBuildJsonMarkdownTablesFromText } from '@/features/markdown/jsonToMarkdownDocument'
import { cancelWorkspaceSyncTask, scheduleWorkspaceSyncTask } from '@/lib/async/workspaceSyncScheduler'
import { WORKSPACE_SYNC_SCOPE_MARKDOWN_WORKSPACE_DATAVIEW_RUNTIME_PERSISTENCE } from '@/lib/async/workspaceSyncKeys'
import { hashStringToHex } from '@/lib/hash/stringHash'

export type MarkdownWorkspaceDerivedViewerKind = 'markdown' | 'html' | 'json'
export type MarkdownWorkspaceDerivedViewerMode = 'read' | 'table' | 'multiDimTable' | 'kanban'

function tryBuildApiGraphMarkdownTablesFromJson(text: string, preferredMode?: JsonToMarkdownMode): string | null {
  return tryBuildJsonMarkdownTablesFromText(text, preferredMode)
}

type DataViewCandidate = {
  id: string
  legacyId?: string
  label: string
  table: TokenWithLines & TokensTable
  view: MarkdownDataView
}

const DATA_VIEW_CANDIDATES_CACHE = new LRUCache<string, DataViewCandidate[]>(60)
const DERIVED_TABLE_SCAN_MAX_CHARS = 320_000

const buildMarkdownDataViewFromTableTokenLoose = (table: TokensTable): MarkdownDataView | null => {
  const headerCells = Array.isArray(table.header) ? table.header : []
  const rowsCells = Array.isArray(table.rows) ? table.rows : []
  const colCount = Math.max(headerCells.length, ...rowsCells.map(r => r.length))
  if (!Number.isFinite(colCount) || colCount <= 1 || colCount > 32) return null

  const headerNames = Array.from({ length: colCount }).map((_, i) => String(headerCells[i]?.text ?? '').trim())
  const rows = rowsCells.map((r, rowIndex) => {
    const cells = Array.from({ length: colCount }).map((_, colIndex) => String(r[colIndex]?.text ?? '').trim())
    return { id: `row_${rowIndex}`, cells }
  })
  if (rows.length < 1) return null

  const columns = headerNames.map((name, colIndex) => {
    const safe = name || `Column ${colIndex + 1}`
    return { id: `col_${colIndex}`, name: safe, kind: 'text' as const }
  })

  const titleColumnId = columns[0]?.id ?? 'col_0'
  return { columns, rows, titleColumnId, groupByColumnId: null }
}

const HEADING_LINE_RE = /^#{1,6}\s+(.+?)\s*#*\s*$/

const deriveCandidateBaseLabel = (markdownLines: string[], startLine: number, fallbackIndex: number): string => {
  const fromIndex = Math.max(0, startLine - 2)
  for (let i = fromIndex; i >= 0; i -= 1) {
    const raw = String(markdownLines[i] || '')
    const line = raw.trim()
    if (!line) continue
    const headingMatch = line.match(HEADING_LINE_RE)
    if (headingMatch?.[1]) return headingMatch[1].trim()
    if (line.startsWith('|')) continue
    if (line.startsWith('```')) break
  }
  return `Table ${fallbackIndex}`
}

const buildDataViewCandidates = (markdownText: string, candidatesKey: string, relaxed: boolean): DataViewCandidate[] => {
  if (markdownText.length > DERIVED_TABLE_SCAN_MAX_CHARS) return []
  const cacheKey = `${candidatesKey}|${relaxed ? 'relaxed' : 'strict'}`
  const cached = DATA_VIEW_CANDIDATES_CACHE.get(cacheKey)
  if (cached) return cached
  const { tokens } = lexMarkdown(markdownText)
  const markdownLines = markdownText.split('\n')
  const tables = tokens.filter((t): t is TokenWithLines & TokensTable => t.type === 'table')
  const candidates: DataViewCandidate[] = []
  const seenLabels = new Map<string, number>()
  for (let i = 0; i < tables.length; i += 1) {
    const table = tables[i]
    const view = relaxed
      ? (buildMarkdownDataViewFromTableToken(table) || buildMarkdownDataViewFromTableTokenLoose(table))
      : buildMarkdownDataViewFromTableToken(table)
    if (!view) continue
    const startLine = Math.max(1, Math.floor(Number((table as unknown as { startLine?: unknown }).startLine || 0)))
    const endLine = Math.max(startLine, Math.floor(Number((table as unknown as { endLine?: unknown }).endLine || 0)))
    const stableId = `md-block:${startLine}-${endLine}`
    const baseLabel = deriveCandidateBaseLabel(markdownLines, startLine, candidates.length + 1)
    const labelCount = seenLabels.get(baseLabel) || 0
    seenLabels.set(baseLabel, labelCount + 1)
    const label = labelCount > 0 ? `${baseLabel} (${labelCount + 1})` : baseLabel
    candidates.push({
      id: stableId,
      legacyId: `table_${i}`,
      label,
      table,
      view,
    })
  }
  DATA_VIEW_CANDIDATES_CACHE.set(cacheKey, candidates)
  return candidates
}


export function MarkdownWorkspaceDerivedViewer(props: {
  viewerKind: MarkdownWorkspaceDerivedViewerKind
  viewerMode: MarkdownWorkspaceDerivedViewerMode
  onChangeViewerMode?: (mode: MarkdownWorkspaceDerivedViewerMode) => void
  markdownText: string
  title?: string
  activeDocumentPath?: string | null
  highlightedLineRange?: HighlightedLineRange
  markdownWordWrap: boolean
  markdownTextHighlight: boolean
  uiPanelTextFontClass: string
  uiPanelMonospaceTextClass: string
  webpageLayoutWireframeAscii?: string | null
  geoDatasetIntegration?: MarkdownGeoDatasetIntegration
  disableViewerMutations: boolean
  onInsertLineAfter: (afterLine: number) => void
  onReorderLineBlock: (
    source: { startLine: number; endLine: number },
    target: { startLine: number; endLine: number },
    position: 'before' | 'after',
  ) => void
  onReplaceLineRange: (args: { startLine: number; endLine: number; replacementLines: string[] }) => void
  onRevealLineInEditor: (line: number) => void
  onViewerRootRef: (el: HTMLDivElement | null) => void
}) {
  const panelTypography = usePanelTypography()

  const derivedStructuredText = React.useMemo(() => {
    const showStructuredInJsonViews = props.viewerKind === 'json'
    const showStructuredInMarkdownViews =
      props.viewerKind === 'markdown' &&
      (props.viewerMode === 'read' || props.viewerMode === 'table' || props.viewerMode === 'multiDimTable')
    if (!showStructuredInJsonViews && !showStructuredInMarkdownViews) return null
    const preferredMode: JsonToMarkdownMode | undefined =
      props.viewerKind === 'markdown' && props.viewerMode === 'read' ? 'table' : undefined
    return tryBuildApiGraphMarkdownTablesFromJson(props.markdownText, preferredMode)
  }, [props.markdownText, props.viewerKind, props.viewerMode])

  const effectiveMarkdownText = derivedStructuredText || props.markdownText
  const candidatesKey = React.useMemo(() => buildMarkdownTokensKey(effectiveMarkdownText), [effectiveMarkdownText])
  const [selectedTableId, setSelectedTableId] = React.useState<string>('')
  const [viewConfig, setViewConfig] = React.useState<WorkspaceDataViewConfig | null>(null)
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [headerState, setHeaderState] = React.useState<WorkspaceDataViewHeaderState>(() => ({
    searchQuery: '',
    visibleGroups: null,
    sortMode: 'none',
  }))

  const strictCandidates = React.useMemo(() => {
    if (props.viewerMode === 'read') return []
    if (props.viewerKind === 'json') return []
    return buildDataViewCandidates(effectiveMarkdownText, candidatesKey, false)
  }, [candidatesKey, effectiveMarkdownText, props.viewerKind, props.viewerMode])

  const relaxedCandidates = React.useMemo(() => {
    if (props.viewerMode === 'read') return []
    const shouldRelax = props.viewerKind === 'json'
      ? !!derivedStructuredText
      : strictCandidates.length === 0
    return shouldRelax ? buildDataViewCandidates(effectiveMarkdownText, candidatesKey, true) : []
  }, [candidatesKey, derivedStructuredText, effectiveMarkdownText, props.viewerKind, props.viewerMode, strictCandidates.length])

  const candidates = strictCandidates.length > 0 ? strictCandidates : relaxedCandidates
  const usingLooseTables = strictCandidates.length === 0 && relaxedCandidates.length > 0

  React.useEffect(() => {
    if (candidates.length < 1) {
      setSelectedTableId('')
      return
    }
    if (selectedTableId && candidates.some(c => c.id === selectedTableId)) return
    setSelectedTableId(candidates[0].id)
  }, [candidates, selectedTableId])

  const selected = React.useMemo(() => {
    if (!selectedTableId) return candidates[0] ?? null
    return candidates.find(c => c.id === selectedTableId) ?? (candidates[0] ?? null)
  }, [candidates, selectedTableId])

  React.useEffect(() => {
    if (!selected) {
      setViewConfig(null)
      return
    }
    const fallback = defaultWorkspaceDataViewConfig({
      title: props.viewerMode === 'kanban' ? MARKDOWN_DATA_VIEW_COPY.kanbanViewLabel : MARKDOWN_DATA_VIEW_COPY.tableViewLabel,
      layout: props.viewerMode === 'kanban' ? 'kanban' : 'table',
      groupByColumnId: selected.view.groupByColumnId || null,
    })

    const docPath = props.activeDocumentPath ?? null
    const stableId = selected.id
    const legacyId = selected.legacyId

    const stableMeta = readWorkspaceDataViewStateWithMeta({
      activeDocumentPath: docPath,
      tableId: stableId,
    })
    if (!stableMeta.hasStoredValue && legacyId) {
      const legacyMeta = readWorkspaceDataViewStateWithMeta({
        activeDocumentPath: docPath,
        tableId: legacyId,
      })
      if (legacyMeta.hasStoredValue) {
        writeWorkspaceDataViewState({
          activeDocumentPath: docPath,
          tableId: stableId,
          value: legacyMeta.state,
        })
      }
    }

    const cfg = readWorkspaceDataViewConfig({ activeDocumentPath: docPath, tableId: stableId, fallback })
    setViewConfig(cfg)
  }, [props.activeDocumentPath, props.viewerMode, selected])

  React.useEffect(() => {
    if (!selected) return
    if (!viewConfig) return

    const docPath = props.activeDocumentPath ?? null
    const tableId = selected.id
    const value = viewConfig
    const taskKey = `markdown-workspace:dataview:${tableId}`
    const signature = hashStringToHex(
      JSON.stringify({
        docPath,
        tableId,
        value,
      }),
    )
    scheduleWorkspaceSyncTask(taskKey, () => {
      writeWorkspaceDataViewConfig({ activeDocumentPath: docPath, tableId, value })
    }, 200, {
      signature,
      scopeKey: WORKSPACE_SYNC_SCOPE_MARKDOWN_WORKSPACE_DATAVIEW_RUNTIME_PERSISTENCE,
    })

    return () => {
      cancelWorkspaceSyncTask(taskKey)
    }
  }, [props.activeDocumentPath, selected, viewConfig])

  const canMutate = !props.disableViewerMutations && props.viewerKind !== 'json' && !usingLooseTables

  const onResetDataView = React.useCallback(() => {
    setHeaderState({ searchQuery: '', visibleGroups: null, sortMode: 'none' })
  }, [])

  const displayedView = React.useMemo((): MarkdownDataView | null => {
    if (!selected) return null
    const base: MarkdownDataView = viewConfig?.groupByColumnId ? { ...selected.view, groupByColumnId: viewConfig.groupByColumnId } : selected.view
    return applyWorkspaceDataViewQuery({ view: base, viewConfig, state: headerState })
  }, [headerState.searchQuery, headerState.sortMode, headerState.visibleGroups, selected, viewConfig])

  const groupOptions = React.useMemo((): string[] => {
    if (!selected) return []
    return computeWorkspaceDataViewGroupOptions({
      view: selected.view,
      groupByColumnId: viewConfig?.groupByColumnId || selected.view.groupByColumnId,
    })
  }, [selected, viewConfig?.groupByColumnId])

  const visibleColumnIds = viewConfig?.visibleColumnIds ?? null
  const columnTypesById = viewConfig?.columnTypesById ?? null

  const onUpdateCell = React.useCallback(
    (args: { rowId: string; columnId: string; nextValue: string }) => {
      if (!selected) return
      if (!canMutate) return
      const next = updateMarkdownDataViewCell({
        view: selected.view,
        rowId: args.rowId,
        columnId: args.columnId,
        nextValue: args.nextValue,
      })
      if (!next) return
      const replacementLines = serializeMarkdownDataViewToTableLines(next)
      props.onReplaceLineRange({ startLine: selected.table.startLine, endLine: selected.table.endLine, replacementLines })
    },
    [canMutate, props, selected],
  )

  const onNewRecord = React.useCallback(
    (seed?: Partial<Record<string, string>>) => {
      if (!selected) return
      if (!canMutate) return
      const next = appendMarkdownDataViewRow({ view: selected.view, seed })
      const replacementLines = serializeMarkdownDataViewToTableLines(next)
      props.onReplaceLineRange({ startLine: selected.table.startLine, endLine: selected.table.endLine, replacementLines })
    },
    [canMutate, props, selected],
  )

  const onActivateRow = React.useCallback(
    (rowId: string) => {
      if (!selected) return
      const line = rowIdToMarkdownLineInTable({
        rowId,
        tableStartLine: selected.table.startLine,
        tableEndLine: selected.table.endLine,
      })
      if (line == null) return
      props.onRevealLineInEditor(line)
    },
    [props, selected],
  )

  const onAddColumn = React.useCallback(
    (args: { name: string; columnType: MarkdownDataViewColumnType }) => {
      if (!selected) return
      if (!canMutate) return
      const next = appendMarkdownDataViewColumn({
        view: selected.view,
        name: args.name,
        kind: columnTypeToBaseKind(args.columnType),
      })
      const replacementLines = serializeMarkdownDataViewToTableLines(next)
      props.onReplaceLineRange({ startLine: selected.table.startLine, endLine: selected.table.endLine, replacementLines })

      const newColId = next.columns[next.columns.length - 1]?.id
      if (!newColId) return
      setViewConfig(prev => {
        if (!prev) return prev
        const nextVisible = prev.visibleColumnIds ? [...prev.visibleColumnIds, newColId] : prev.visibleColumnIds
        const nextTypes = { ...(prev.columnTypesById ?? {}), [newColId]: args.columnType }
        return { ...prev, visibleColumnIds: nextVisible, columnTypesById: nextTypes }
      })
    },
    [canMutate, props, selected],
  )

  const onChangeColumnType = React.useCallback(
    (args: { columnId: string; nextType: MarkdownDataViewColumnType }) => {
      if (!selected) return
      setViewConfig(prev => {
        if (!prev) return prev
        const col = selected.view.columns.find(c => c.id === args.columnId)
        const defaultType = col ? defaultColumnTypeForInferredKind(col.kind) : 'text'
        const nextMap = { ...(prev.columnTypesById ?? {}) }
        if (args.nextType === defaultType) delete nextMap[args.columnId]
        else nextMap[args.columnId] = args.nextType
        const normalized = Object.keys(nextMap).length ? nextMap : null
        return { ...prev, columnTypesById: normalized }
      })
    },
    [selected],
  )

  const onHideColumnInView = React.useCallback(
    (columnId: string) => {
      if (!selected) return
      setViewConfig(prev => {
        if (!prev) return prev
        const allIds = selected.view.columns.map(c => c.id)
        const base = prev.visibleColumnIds ? prev.visibleColumnIds : allIds
        const next = base.filter(id => id !== columnId)
        return { ...prev, visibleColumnIds: next }
      })
    },
    [selected],
  )

  const onUpsertColumnFilter = React.useCallback(
    (args: { columnId: string; columnKind: MarkdownDataViewColumnKind; op: WorkspaceDataViewFilterOp; value: string }) => {
      if (!selected) return
      const value = String(args.value ?? '').trim()
      setViewConfig(prev => {
        if (!prev) return prev
        const makeId = () => {
          if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
          return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`
        }
        const groups = prev.filterGroups.length ? prev.filterGroups : [{ id: 'g0', rules: [] }]
        const first = groups[0]
        const rest = groups.slice(1)
        const remaining = first.rules.filter(r => r.columnId !== args.columnId)
        const nextRules = value
          ? [...remaining, { id: makeId(), columnId: args.columnId, columnKind: args.columnKind, op: args.op, value }]
          : remaining
        return { ...prev, filterGroups: [{ ...first, rules: nextRules }, ...rest] }
      })
    },
    [selected],
  )

  const onSetColumnSort = React.useCallback(
    (args: { columnId: string; direction: 'asc' | 'desc' }) => {
      if (!selected) return
      if (args.columnId !== selected.view.titleColumnId) return
      setHeaderState(prev => ({
        ...prev,
        sortMode: args.direction === 'desc' ? 'title_desc' : 'title_asc',
      }))
    },
    [selected],
  )

  if (props.viewerMode === 'read') {
    if (props.viewerKind === 'json') {
      if (derivedStructuredText) {
        return (
          <MarkdownPreview
            ref={props.onViewerRootRef}
            markdownText={derivedStructuredText}
            activeDocumentPath={props.activeDocumentPath ?? null}
            highlightedLineRange={props.highlightedLineRange}
            markdownWordWrap={props.markdownWordWrap}
            markdownPresentationMode={false}
            markdownTextHighlight={props.markdownTextHighlight}
            selectionKind={null}
            uiPanelTextFontClass={props.uiPanelTextFontClass}
            uiPanelMonospaceTextClass={props.uiPanelMonospaceTextClass}
            webpageLayoutWireframeAscii={props.webpageLayoutWireframeAscii ?? null}
            geoDatasetIntegration={props.geoDatasetIntegration}
            previewOverlayScope="container"
            previewOverlayPortalTarget={null}
            previewScrollable={true}
            showSidebar={false}
            viewMode="viewer"
            forbidCopy={false}
            onInsertLineAfter={canMutate ? props.onInsertLineAfter : undefined}
            onReorderLineBlock={canMutate ? props.onReorderLineBlock : undefined}
            onReplaceLineRange={props.onReplaceLineRange}
            onShowInEditor={props.onRevealLineInEditor}
          />
        )
      }
      return (
        <div
          ref={props.onViewerRootRef}
          className={`h-full w-full overflow-auto ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary} ${props.uiPanelMonospaceTextClass}`}
          aria-label="JSON viewer"
        >
          <pre className="m-0 p-3 text-[11px] leading-snug whitespace-pre-wrap break-words">{props.markdownText}</pre>
        </div>
      )
    }
    if (props.viewerKind === 'html') {
      return (
        <div ref={props.onViewerRootRef} className="h-full w-full">
          <MarkdownWorkspaceHtmlViewerPane
            markdownText={props.markdownText}
            title={props.title}
          />
        </div>
      )
    }
    return (
      <MarkdownPreview
        ref={props.onViewerRootRef}
        markdownText={props.markdownText}
        activeDocumentPath={props.activeDocumentPath ?? null}
        highlightedLineRange={props.highlightedLineRange}
        markdownWordWrap={props.markdownWordWrap}
        markdownPresentationMode={false}
        markdownTextHighlight={props.markdownTextHighlight}
        selectionKind={null}
        uiPanelTextFontClass={props.uiPanelTextFontClass}
        uiPanelMonospaceTextClass={props.uiPanelMonospaceTextClass}
        webpageLayoutWireframeAscii={props.webpageLayoutWireframeAscii ?? null}
        geoDatasetIntegration={props.geoDatasetIntegration}
        previewOverlayScope="container"
        previewOverlayPortalTarget={null}
        previewScrollable={true}
        showSidebar={false}
        viewMode="viewer"
        forbidCopy={false}
        onInsertLineAfter={canMutate ? props.onInsertLineAfter : undefined}
        onReorderLineBlock={canMutate ? props.onReorderLineBlock : undefined}
        onReplaceLineRange={props.onReplaceLineRange}
        onShowInEditor={props.onRevealLineInEditor}
      />
    )
  }

  return (
    <section className="h-full w-full flex flex-col" aria-label="Workspace data view">
      <WorkspaceDataViewHeader
        title={props.title || 'Workspace'}
        viewerMode={props.viewerMode}
        canMutate={canMutate}
        columns={(selected?.view.columns ?? [])}
        groupByColumnId={viewConfig?.groupByColumnId || selected?.view.groupByColumnId || null}
        groupOptions={groupOptions}
        state={headerState}
        onChangeState={setHeaderState}
        onChangeViewerMode={(mode) => props.onChangeViewerMode?.(mode)}
        onNewRecord={canMutate ? () => onNewRecord() : undefined}
        onAddColumn={canMutate ? onAddColumn : undefined}
        viewConfig={viewConfig}
        setViewConfig={(next) => setViewConfig(next)}
        openSettings={() => setSettingsOpen(true)}
        settingsOpen={settingsOpen}
        closeSettings={() => setSettingsOpen(false)}
        tableSelector={
          candidates.length > 1 ? (
            <WorkspaceModeSelect
              value={selected?.id ?? ''}
              ariaLabel="Select data view table"
              options={candidates.map(c => ({ value: c.id, label: c.label }))}
              presentation="tabs"
              onChange={setSelectedTableId}
            />
          ) : null
        }
        onReset={onResetDataView}
      />
      <main className="flex-1 min-h-0 overflow-auto">
        {!selected ? (
          <section className="p-4" aria-label="No data views">
            <p className={`${UI_THEME_TOKENS.text.tertiary} ${panelTypography.microLabelClass}`}>No eligible Markdown tables found.</p>
          </section>
        ) : props.viewerMode === 'kanban' ? (
          <MarkdownDataViewKanbanView
            view={displayedView || selected.view}
            visibleColumnIds={visibleColumnIds}
            canMutate={canMutate}
            onUpdateCell={onUpdateCell}
            onNewRecord={onNewRecord}
            onActivateRow={onActivateRow}
          />
        ) : (
          <MarkdownDataViewTableView
            view={displayedView || selected.view}
            visibleColumnIds={visibleColumnIds}
            columnTypesById={columnTypesById}
            canMutate={canMutate}
            canConfigure={true}
            onUpdateCell={onUpdateCell}
            onActivateRow={onActivateRow}
            onNewRecord={canMutate ? () => onNewRecord() : undefined}
            onAddColumn={canMutate ? onAddColumn : undefined}
            onChangeColumnType={onChangeColumnType}
            onHideColumnInView={onHideColumnInView}
            onUpsertColumnFilter={onUpsertColumnFilter}
            onSetColumnSort={onSetColumnSort}
          />
        )}
      </main>
    </section>
  )
}
