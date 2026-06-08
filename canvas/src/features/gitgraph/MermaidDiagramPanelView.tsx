import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { InteractiveMermaidDiagram, type InteractiveMermaidSelectionRow } from '@/lib/diagram/InteractiveMermaidDiagram'
import type { MermaidDiagramCodeModel, MermaidStructuredDiagramKind } from '@/lib/mermaid/mermaidDiagramCode'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  resolveDiagramRowKey,
} from '@/lib/diagram/diagramRowSelection'
import type { DiagramSelectionRow } from '@/lib/diagram/diagramRowSelection'
import {
  buildMermaidInteractiveSelectionRows,
  findMermaidDiagramRowKeyForSvgLabel,
  readMermaidDirectSelectionLabels,
} from '@/lib/mermaid/mermaidDiagramSelection'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'

export type MermaidDiagramPanelRenderMode = 'diagram' | 'list' | 'split'

export function MermaidDiagramRenderPreview({
  code,
  kind,
  rootThemeMode,
  compact = false,
  rows = [],
  selectedRowKey = '',
  onSelectRowKey,
}: {
  code: string
  kind: MermaidStructuredDiagramKind
  rootThemeMode: 'light' | 'dark'
  compact?: boolean
  rows?: readonly DiagramSelectionRow[]
  selectedRowKey?: string
  onSelectRowKey?: (key: string | null) => void
}) {
  const selectedRowIndex = React.useMemo(() => {
    if (!selectedRowKey) return -1
    return rows.findIndex((row, index) => resolveDiagramRowKey(row, index) === selectedRowKey)
  }, [rows, selectedRowKey])
  const selectedRow = selectedRowIndex >= 0 ? rows[selectedRowIndex] || null : null
  const selectedLabels = React.useMemo(() => readMermaidDirectSelectionLabels(selectedRow), [selectedRow])
  const selectionRows = React.useMemo<InteractiveMermaidSelectionRow[]>(() => {
    return buildMermaidInteractiveSelectionRows(rows)
  }, [rows])
  const selectRowBySvgLabel = React.useCallback((label: string) => {
    if (!rows.length || !onSelectRowKey) return
    if (!String(label || '').trim()) {
      onSelectRowKey(null)
      return
    }
    const key = findMermaidDiagramRowKeyForSvgLabel(rows, label)
    if (key) onSelectRowKey(key)
  }, [onSelectRowKey, rows])

  if (!code) return null
  return (
    <section
      className={cn(
        'relative min-h-0 overflow-auto rounded-md border',
        compact ? 'max-h-36' : 'min-h-36 flex-1',
        UI_THEME_TOKENS.panel.border,
        UI_THEME_TOKENS.panel.bg,
      )}
      data-kg-mermaid-diagram-render="1"
      data-kg-mermaid-diagram-kind={kind}
      data-kg-mermaid-diagram-selected-row={selectedRowKey || undefined}
      data-kg-mermaid-diagram-direct-selection="1"
    >
      <InteractiveMermaidDiagram
        code={code}
        rootThemeMode={rootThemeMode}
        svgSurfaceKey={`mermaid:${kind}`}
        selectedLabels={selectedLabels}
        selectionRows={selectionRows}
        selectedRowKey={selectedRowKey}
        dimUnselected={!!selectedLabels.length}
        onSelectedLabelChange={selectRowBySvgLabel}
        onSelectedRowKeyChange={onSelectRowKey}
      />
    </section>
  )
}

export function MermaidDiagramPanelView({
  code,
  model,
  kind,
  title,
  emptyLabel,
  rootThemeMode,
  compact = false,
  surface,
  renderMode = surface === 'bottomPanel' ? 'diagram' : 'list',
  onSelectedRowKeyChange,
}: {
  code: string
  model: MermaidDiagramCodeModel
  kind: MermaidStructuredDiagramKind
  title: string
  emptyLabel: string
  rootThemeMode: 'light' | 'dark'
  compact?: boolean
  surface: 'floatingPanel' | 'bottomPanel'
  renderMode?: MermaidDiagramPanelRenderMode
  onSelectedRowKeyChange?: (rowKey: string | null) => void
}) {
  const showDiagram = renderMode !== 'list'
  const showRowList = renderMode !== 'diagram'
  const { selectedRowKey, setMermaidDiagramSelectedRowKey } = useGraphStore(
    useShallow(state => ({
      selectedRowKey: state.mermaidDiagramSelectedRowKeyByKind[kind] || '',
      setMermaidDiagramSelectedRowKey: state.setMermaidDiagramSelectedRowKey,
    })),
  )
  const setSelectedRowKey = React.useCallback((rowKey: string | null) => {
    setMermaidDiagramSelectedRowKey(kind, rowKey)
    onSelectedRowKeyChange?.(rowKey)
  }, [kind, onSelectedRowKeyChange, setMermaidDiagramSelectedRowKey])
  const rowListRef = React.useRef<HTMLElement | null>(null)
  const panelAriaLabel = showDiagram ? `${title} Mermaid diagram` : `${title} Mermaid rows`
  React.useEffect(() => {
    if (!selectedRowKey) return
    if (model.rows.some((row, index) => resolveDiagramRowKey(row, index) === selectedRowKey)) return
    setSelectedRowKey(null)
  }, [model.rows, selectedRowKey, setSelectedRowKey])
  React.useLayoutEffect(() => {
    if (!selectedRowKey || !showRowList) return
    const frame = window.requestAnimationFrame(() => {
      const row = rowListRef.current?.querySelector(`[data-kg-mermaid-diagram-command-selected="1"]`)
      if (row instanceof HTMLElement) row.scrollIntoView({ block: 'center' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [selectedRowKey, showRowList])
  if (!code) {
    return (
      <section
        className="flex h-full min-h-0 flex-col"
        aria-label={panelAriaLabel}
        data-kg-mermaid-diagram-panel="1"
        data-kg-mermaid-diagram-kind={kind}
        data-kg-mermaid-diagram-surface={surface}
        data-kg-mermaid-diagram-render-mode={renderMode}
        data-kg-mermaid-diagram-empty="1"
      >
        <section className={cn('px-1 py-1 text-xs font-semibold', UI_THEME_TOKENS.text.primary)}>{title}</section>
        <section className={cn('px-1 text-xs', UI_THEME_TOKENS.text.secondary)}>{emptyLabel}</section>
      </section>
    )
  }

  return (
    <section
      className={cn('flex h-full min-h-0 flex-col gap-2', compact && 'gap-1')}
      aria-label={panelAriaLabel}
      data-kg-mermaid-diagram-panel="1"
      data-kg-mermaid-diagram-kind={kind}
      data-kg-mermaid-diagram-surface={surface}
      data-kg-mermaid-diagram-render-mode={renderMode}
    >
      <header className="flex min-w-0 items-center justify-between gap-2 px-1">
        <section className="min-w-0">
          <section className={cn('truncate text-xs font-semibold', UI_THEME_TOKENS.text.primary)}>{title}</section>
          {showRowList ? (
            <section className={cn('truncate text-[11px]', UI_THEME_TOKENS.text.secondary)}>
              {model.rows.length} parsed rows
            </section>
          ) : null}
        </section>
      </header>
      {showDiagram ? (
        <MermaidDiagramRenderPreview
          code={code}
          kind={kind}
          rootThemeMode={rootThemeMode}
          compact={compact && showRowList}
          rows={model.rows}
          selectedRowKey={selectedRowKey}
          onSelectRowKey={setSelectedRowKey}
        />
      ) : null}
      {showRowList ? (
        <section
          ref={rowListRef}
          className={cn(
            'min-h-0 overflow-auto rounded-md border',
            compact ? 'max-h-24' : 'flex-1',
            UI_THEME_TOKENS.panel.border,
          )}
          data-kg-mermaid-diagram-command-list="1"
        >
          {model.rows.map((row, index) => {
            const key = resolveDiagramRowKey(row, index)
            const selected = key === selectedRowKey
            return (
              <button
                key={key || row.key}
                type="button"
                className={[
                  'flex w-full min-w-0 items-center gap-2 border-b border-[var(--kg-border)] px-2 py-1.5 text-left last:border-b-0',
                  selected
                    ? 'text-[var(--kg-text-primary)] shadow-[inset_3px_0_0_var(--kg-canvas-accent)] ring-2 ring-inset ring-[var(--kg-canvas-accent)]'
                    : selectedRowKey
                      ? 'text-[var(--kg-text-tertiary)] opacity-45 hover:opacity-90'
                      : 'text-[var(--kg-text-secondary)] hover:bg-[var(--kg-panel-bg-hover)]',
                ].join(' ')}
                style={selected ? {
                  backgroundColor: 'color-mix(in srgb, var(--kg-canvas-accent) 16%, var(--kg-panel-bg))',
                } : undefined}
                data-kg-mermaid-diagram-command-row="1"
                data-kg-mermaid-diagram-command-kind={row.kind}
                data-kg-mermaid-diagram-command-line={row.lineIndex}
                data-kg-mermaid-diagram-command-selected={selected ? '1' : undefined}
                onClick={() => setSelectedRowKey(key)}
              >
                <span className="w-16 shrink-0 text-[10px] uppercase tracking-normal text-[var(--kg-text-tertiary)]">{row.kind}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-[11px]">{row.label}</span>
                <span className="shrink-0 text-[10px] text-[var(--kg-text-tertiary)]">L{row.lineNumber}</span>
              </button>
            )
          })}
        </section>
      ) : null}
    </section>
  )
}
