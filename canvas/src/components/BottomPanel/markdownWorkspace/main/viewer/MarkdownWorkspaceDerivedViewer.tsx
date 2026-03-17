import React from 'react'
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
  defaultWorkspaceDataViewConfig,
  readWorkspaceDataViewConfig,
  type WorkspaceDataViewConfig,
  type WorkspaceDataViewFilterGroup,
  writeWorkspaceDataViewConfig,
} from './workspaceDataViewConfig'

export type MarkdownWorkspaceDerivedViewerKind = 'markdown' | 'html'
export type MarkdownWorkspaceDerivedViewerMode = 'read' | 'kanban' | 'table'

type DataViewCandidate = {
  id: string
  label: string
  table: TokenWithLines & TokensTable
  view: MarkdownDataView
}

const buildDataViewCandidates = (markdownText: string): DataViewCandidate[] => {
  const { tokens } = lexMarkdown(markdownText)
  const tables = tokens.filter((t): t is TokenWithLines & TokensTable => t.type === 'table')
  const candidates: DataViewCandidate[] = []
  for (let i = 0; i < tables.length; i += 1) {
    const table = tables[i]
    const view = buildMarkdownDataViewFromTableToken(table)
    if (!view) continue
    candidates.push({
      id: `table_${i}`,
      label: `Table ${candidates.length + 1}`,
      table,
      view,
    })
  }
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
  const candidatesKey = React.useMemo(() => buildMarkdownTokensKey(props.markdownText), [props.markdownText])
  const [selectedTableId, setSelectedTableId] = React.useState<string>('')
  const [viewConfig, setViewConfig] = React.useState<WorkspaceDataViewConfig | null>(null)
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [headerState, setHeaderState] = React.useState<WorkspaceDataViewHeaderState>(() => ({
    searchQuery: '',
    visibleGroups: null,
    sortMode: 'none',
  }))

  const candidates = React.useMemo(() => {
    if (props.viewerMode === 'read') return []
    return buildDataViewCandidates(props.markdownText)
  }, [props.markdownText, props.viewerMode, candidatesKey])

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
      title: props.viewerMode === 'kanban' ? 'Kanban View' : 'Table View',
      layout: props.viewerMode === 'table' ? 'table' : 'kanban',
      groupByColumnId: selected.view.groupByColumnId || null,
    })
    const cfg = readWorkspaceDataViewConfig({
      activeDocumentPath: props.activeDocumentPath ?? null,
      tableId: selected.id,
      fallback,
    })
    setViewConfig(cfg)
  }, [props.activeDocumentPath, props.viewerMode, selected])

  React.useEffect(() => {
    if (!selected) return
    if (!viewConfig) return
    writeWorkspaceDataViewConfig({
      activeDocumentPath: props.activeDocumentPath ?? null,
      tableId: selected.id,
      value: viewConfig,
    })
  }, [props.activeDocumentPath, selected, viewConfig])

  const canMutate = !props.disableViewerMutations

  const onResetDataView = React.useCallback(() => {
    setHeaderState({ searchQuery: '', visibleGroups: null, sortMode: 'none' })
  }, [])

  const displayedView = React.useMemo((): MarkdownDataView | null => {
    if (!selected) return null
    const base: MarkdownDataView = viewConfig?.groupByColumnId
      ? { ...selected.view, groupByColumnId: viewConfig.groupByColumnId }
      : selected.view
    const q = String(headerState.searchQuery || '').trim().toLowerCase()
    const filterGroups = headerState.visibleGroups
    const sortMode = headerState.sortMode
    const dataFilters: WorkspaceDataViewFilterGroup[] = viewConfig?.filterGroups || []
    const needsFilter = !!(q || filterGroups || dataFilters.some(g => g.rules.length))
    const needsSort = sortMode !== 'none'
    if (!needsFilter && !needsSort) return base

    const titleIndex = base.columns.findIndex(c => c.id === base.titleColumnId)
    const groupIndex = base.groupByColumnId ? base.columns.findIndex(c => c.id === base.groupByColumnId) : -1
    const allowedGroups = filterGroups ? new Set(filterGroups.map(x => String(x || '').trim())) : null

    const ruleMatch = (row: (typeof base.rows)[number], rule: WorkspaceDataViewFilterGroup['rules'][number]): boolean => {
      const colIndex = base.columns.findIndex(c => c.id === rule.columnId)
      if (colIndex < 0) return true
      const cell = String(row.cells[colIndex] ?? '')
      const v = String(rule.value ?? '').trim()
      if (!v) return true
      if (rule.op === 'equals') return cell.trim() === v
      if (rule.op === 'includes') {
        const tokens = cell.split(',').map(x => x.trim()).filter(Boolean)
        return tokens.includes(v)
      }
      return cell.toLowerCase().includes(v.toLowerCase())
    }

    const rowPassesDataFilters = (row: (typeof base.rows)[number]): boolean => {
      if (!dataFilters.length) return true
      for (const g of dataFilters) {
        if (!g.rules.length) continue
        let ok = true
        for (const r of g.rules) {
          if (!ruleMatch(row, r)) {
            ok = false
            break
          }
        }
        if (ok) return true
      }
      return dataFilters.every(g => g.rules.length === 0)
    }

    let rows = base.rows
    if (needsFilter) {
      rows = rows.filter(r => {
        if (allowedGroups && groupIndex >= 0) {
          const g = String(r.cells[groupIndex] ?? '').trim() || 'Ungrouped'
          if (!allowedGroups.has(g)) return false
        }
        if (!rowPassesDataFilters(r)) return false
        if (!q) return true
        const title = titleIndex >= 0 ? String(r.cells[titleIndex] ?? '') : ''
        if (title.toLowerCase().includes(q)) return true
        for (let i = 0; i < base.columns.length; i += 1) {
          if (i === titleIndex) continue
          const v = String(r.cells[i] ?? '')
          if (v && v.toLowerCase().includes(q)) return true
        }
        return false
      })
    }

    if (needsSort && titleIndex >= 0) {
      const dir = sortMode === 'title_desc' ? -1 : 1
      rows = [...rows].sort((a, b) => {
        const ta = String(a.cells[titleIndex] ?? '')
        const tb = String(b.cells[titleIndex] ?? '')
        return dir * ta.localeCompare(tb)
      })
    }

    return { ...base, rows }
  }, [headerState.searchQuery, headerState.sortMode, headerState.visibleGroups, selected, viewConfig])

  const groupOptions = React.useMemo((): string[] => {
    if (!selected) return []
    const groupById = viewConfig?.groupByColumnId || selected.view.groupByColumnId
    if (!groupById) return []
    const groupIndex = selected.view.columns.findIndex(c => c.id === groupById)
    if (groupIndex < 0) return []
    const col = selected.view.columns[groupIndex]
    const opts = Array.isArray(col.options) ? col.options.map(x => String(x || '').trim()).filter(Boolean) : []
    if (opts.length) return opts
    const set = new Set<string>()
    for (const r of selected.view.rows) {
      const g = String(r.cells[groupIndex] ?? '').trim() || 'Ungrouped'
      set.add(g)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
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

  if (props.viewerMode === 'read') {
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
        onInsertLineAfter={props.onInsertLineAfter}
        onReorderLineBlock={props.onReorderLineBlock}
        onReplaceLineRange={props.onReplaceLineRange}
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
            onUpdateCell={onUpdateCell}
            onActivateRow={onActivateRow}
            onNewRecord={canMutate ? () => onNewRecord() : undefined}
            onAddColumn={canMutate ? onAddColumn : undefined}
            onChangeColumnType={onChangeColumnType}
          />
        )}
      </main>
    </section>
  )
}
