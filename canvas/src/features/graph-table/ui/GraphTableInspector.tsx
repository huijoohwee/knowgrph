import { Fragment, useMemo, useRef, useState } from 'react'
import type { GraphColumnDoc } from '@/features/graph-table-db/graphTableDb'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { SELECTION_INSPECTOR_EMPTY_TEXT } from '@/lib/config'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { cn } from '@/lib/utils'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import { NodeOverlayEditorPanel } from '@/components/FlowEditor/NodeOverlayEditorPanel'
import { resolveNodeQuickEditorRegistryEntry } from '@/features/flow-editor-manager/resolveNodeQuickEditorRegistry'
import { useShallow } from 'zustand/react/shallow'
import { togglePortHandlesEnabledInSchema } from '@/lib/graph/portHandlesBehavior'
import { enableHandlesForAllInputsInSchema } from '@/lib/flowEditor/flowEditorActions'
import { createUniqueId } from '@/lib/ids'
import { normalizeGraphData } from '@/lib/graph/normalize'

export type GraphTableInspectorRow = {
  tableId: 'nodes' | 'edges'
  rowId: string
  order: number
  data: Record<string, unknown>
}

type GraphTableInspectorProps = {
  columns: GraphColumnDoc[]
  row: GraphTableInspectorRow | null
  widthPx?: number
  onClose: () => void
  onChangeCell: (columnId: string, next: unknown) => void
  onDeleteRow: () => void
}

const coreColumnOrder = (id: string): number => {
  if (id === 'id') return 1
  if (id === 'label') return 2
  if (id === 'type') return 3
  if (id === 'source') return 4
  if (id === 'target') return 5
  return 1000
}

export function GraphTableInspector({ columns, row, widthPx, onClose, onChangeCell, onDeleteRow }: GraphTableInspectorProps) {
  const { panelTextClass, microLabelClass, textSizeClass, keyValueInputClass } = usePanelTypography()
  const {
    graphData,
    schema,
    nodeQuickEditorRegistry,
    openQuickEditorNodeIds,
    uiIconScale,
    uiIconStrokeWidth,
    setSchema,
    upsertUiToast,
    setGraphDataPreservingLayout,
  } = useGraphStore(
    useShallow(s => ({
      graphData: s.graphData,
      schema: s.schema,
      nodeQuickEditorRegistry: s.nodeQuickEditorRegistry || [],
      openQuickEditorNodeIds: s.openQuickEditorNodeIds || [],
      uiIconScale: s.uiIconScale,
      uiIconStrokeWidth: s.uiIconStrokeWidth,
      setSchema: s.setSchema,
      upsertUiToast: s.upsertUiToast,
      setGraphDataPreservingLayout: s.setGraphDataPreservingLayout,
    })),
  )
  const allEdges = ((graphData?.edges || []) as GraphEdge[]) || []
  const node: GraphNode | null = useMemo(() => {
    if (!row || row.tableId !== 'nodes') return null
    const id = String(row.rowId || '').trim()
    if (!id || !Array.isArray(graphData?.nodes)) return null
    return (graphData?.nodes as GraphNode[]).find(n => String(n.id || '') === id) || null
  }, [graphData?.nodes, row])
  const registryEntry = useMemo(
    () => (node ? resolveNodeQuickEditorRegistryEntry({ node, registry: nodeQuickEditorRegistry }) : null),
    [node, nodeQuickEditorRegistry],
  )
  const showQuickEditor = useMemo(() => {
    if (!node) return false
    const id = String(node.id || '').trim()
    if (!id) return false
    return openQuickEditorNodeIds.includes(id)
  }, [node, openQuickEditorNodeIds])

  const [panelMinimized, setPanelMinimized] = useState(false)
  const [panelPinned, setPanelPinned] = useState(true)
  const [panelHideFields, setPanelHideFields] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLElement | null>(null)
  const moreButtonRef = useRef<HTMLButtonElement | null>(null)
  const labelInputRef = useRef<HTMLInputElement | null>(null)

  const handleSetLabel = (label: string) => {
    if (!node) return
    const id = String(node.id || '').trim()
    if (!id || !graphData) return
    const nextNodes = (graphData.nodes || []).map(n => (String(n.id || '') === id ? { ...n, label: String(label || '') } : n))
    setGraphDataPreservingLayout(normalizeGraphData({ ...graphData, nodes: nextNodes }))
  }
  const handleSetType = (type: string) => {
    if (!node) return
    const id = String(node.id || '').trim()
    if (!id || !graphData) return
    const trimmed = String(type || '').trim() || 'Node'
    const nextNodes = (graphData.nodes || []).map(n => (String(n.id || '') === id ? { ...n, type: trimmed } : n))
    setGraphDataPreservingLayout(normalizeGraphData({ ...graphData, nodes: nextNodes }))
  }
  const handlePatchProperties = (patch: Record<string, unknown>) => {
    if (!node) return
    const id = String(node.id || '').trim()
    if (!id || !graphData) return
    const nextNodes = (graphData.nodes || []).map(n => {
      if (String(n.id || '') !== id) return n
      const prevProps = (n.properties || {}) as Record<string, unknown>
      const nextProps: Record<string, unknown> = { ...prevProps }
      for (const [k, v] of Object.entries(patch)) {
        if (typeof v === 'undefined') delete nextProps[k]
        else nextProps[k] = v
      }
      return { ...n, properties: nextProps as never }
    })
    setGraphDataPreservingLayout(normalizeGraphData({ ...graphData, nodes: nextNodes }))
  }
  const handleSetProperties = (props: Record<string, unknown>) => {
    if (!node) return
    const id = String(node.id || '').trim()
    if (!id || !graphData) return
    const nextNodes = (graphData.nodes || []).map(n => (String(n.id || '') === id ? { ...n, properties: (props || {}) as never } : n))
    setGraphDataPreservingLayout(normalizeGraphData({ ...graphData, nodes: nextNodes }))
  }
  const handleValidate = () => {
    if (!node) return
    upsertUiToast({ id: `table-node-validate-${node.id}`, kind: 'success', message: 'Node validated.', ttlMs: 2000 })
  }
  const handleDuplicate = () => {
    if (!node || !graphData) return
    const nodes = (graphData.nodes || []) as GraphNode[]
    const used = new Set(nodes.map(n => String(n.id || '')).filter(Boolean))
    const nextId = createUniqueId('n', used)
    const baseLabel = String(node.label || node.id || nextId)
    const nextNode: GraphNode = { ...node, id: nextId, label: `${baseLabel} copy` }
    const next = normalizeGraphData({ ...graphData, nodes: [...nodes, nextNode] })
    setGraphDataPreservingLayout(next)
  }
  const handleRemove = () => {
    onDeleteRow()
  }
  const handleClearOutput = () => {
    if (!node) return
    upsertUiToast({ id: `table-node-clear-output-${node.id}`, kind: 'neutral', message: 'Clear output not implemented.', ttlMs: 2200 })
  }
  const handleHelp = () => {
    upsertUiToast({ id: `table-node-help-${row?.rowId || 'node'}`, kind: 'neutral', message: 'Open help from toolbar.', ttlMs: 2200 })
  }
  const handleConvertToLoop = () => {
    if (!node || !graphData) return
    const id = String(node.id || '').trim()
    if (!id) return
    const nextNodes = (graphData.nodes || []).map(n => (String(n.id || '') === id ? { ...n, type: 'Loop' } : n))
    setGraphDataPreservingLayout(normalizeGraphData({ ...graphData, nodes: nextNodes }))
  }
  const handleTogglePortHandles = () => {
    if (!schema || !setSchema) return
    const next = togglePortHandlesEnabledInSchema(schema)
    if (next.changed) setSchema(next.schema)
  }
  const handleEnableHandlesForAllInputs = () => {
    if (!schema || !setSchema) return
    const next = enableHandlesForAllInputsInSchema(schema)
    if (next.changed) setSchema(next.schema)
  }
  const ordered = useMemo(() => {
    const visible = columns.filter(c => !c.hidden)
    return visible
      .slice()
      .sort((a, b) => {
        const ak = coreColumnOrder(a.columnId)
        const bk = coreColumnOrder(b.columnId)
        if (ak !== bk) return ak - bk
        if (a.order !== b.order) return a.order - b.order
        return a.columnId.localeCompare(b.columnId)
      })
  }, [columns])

  const isEmpty = !row
  const headerKind = row ? row.tableId : 'selection'
  const headerLabel = row ? row.rowId : SELECTION_INSPECTOR_EMPTY_TEXT

  return (
    <section
      className={cn('h-full min-h-0 overflow-hidden flex flex-col', UI_THEME_TOKENS.panel.bg, panelTextClass)}
      style={widthPx ? { width: `${widthPx}px` } : undefined}
      aria-label="Record inspector"
    >
      <header className={`px-3 py-2 border-b ${UI_THEME_TOKENS.panel.divider} flex items-center justify-between gap-2`}>
        <section className="min-w-0" aria-label="Record title">
          <p className={cn(microLabelClass, UI_THEME_TOKENS.text.tertiary)}>{headerKind}</p>
          <p className={`font-semibold ${UI_THEME_TOKENS.text.primary} truncate`}>{headerLabel}</p>
        </section>
        <nav className="flex items-center gap-2" aria-label="Inspector actions">
          <button
            type="button"
            className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
            onClick={onDeleteRow}
            disabled={isEmpty}
          >
            Delete
          </button>
          <button
            type="button"
            className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
            onClick={onClose}
            disabled={isEmpty}
          >
            Close
          </button>
        </nav>
      </header>

      <section className="flex-1 min-h-0 overflow-auto" aria-label="Record fields">
        {isEmpty ? (
          <p className={cn('px-3 py-2', microLabelClass, UI_THEME_TOKENS.text.tertiary)}>{SELECTION_INSPECTOR_EMPTY_TEXT}</p>
        ) : (
          <>
            {row?.tableId === 'nodes' && node && showQuickEditor ? (
              <div className="px-3 py-2">
                <NodeOverlayEditorPanel
                  active={true}
                  node={node}
                  registryEntry={registryEntry}
                  registryEntries={nodeQuickEditorRegistry}
                  minimized={panelMinimized}
                  hideFields={panelHideFields}
                  pinned={panelPinned}
                  portHandlesEnabled={Boolean(schema?.behavior?.portHandles?.enabled)}
                  portHandlesDisabled={false}
                  enableHandlesDisabled={false}
                  convertToLoopDisabled={false}
                  uiPanelOpacity={1}
                  panelTextClass={panelTextClass}
                  microLabelClass={microLabelClass}
                  uiIconScale={uiIconScale}
                  uiIconStrokeWidth={uiIconStrokeWidth}
                  labelInputRef={labelInputRef}
                  menuOpen={menuOpen}
                  setMenuOpen={setMenuOpen}
                  menuRef={menuRef}
                  moreButtonRef={moreButtonRef}
                  onHeaderPointerDown={() => void 0}
                  onToggleHideFields={() => setPanelHideFields(v => !v)}
                  onTogglePinned={() => setPanelPinned(v => !v)}
                  onToggleMinimized={() => setPanelMinimized(v => !v)}
                  onTogglePortHandles={handleTogglePortHandles}
                  onDuplicate={handleDuplicate}
                  onRemove={handleRemove}
                  onClearOutput={handleClearOutput}
                  onHelp={handleHelp}
                  onConvertToLoopNode={handleConvertToLoop}
                  onEnableHandlesForAllInputs={handleEnableHandlesForAllInputs}
                  onSetLabel={handleSetLabel}
                  onSetType={handleSetType}
                  onPatchProperties={handlePatchProperties}
                  onSetProperties={handleSetProperties}
                  onValidate={handleValidate}
                  portHandleEdges={allEdges}
                  schema={schema}
                />
              </div>
            ) : null}
          <dl className="px-3 py-2 grid grid-cols-[120px_1fr] gap-x-2 gap-y-2 items-center">
            {ordered.map(col => {
              const value = (row.data || {})[col.columnId]
              const raw = value == null ? '' : String(value)
              const disabled = col.columnId === 'id'
              return (
                <Fragment key={col.pk}>
                  <dt className={cn(textSizeClass, UI_THEME_TOKENS.text.tertiary, 'truncate')}>{col.name}</dt>
                  <dd>
                    <input
                      className={cn(
                        'w-full',
                        keyValueInputClass,
                        textSizeClass,
                        UI_THEME_TOKENS.input.border,
                        UI_THEME_TOKENS.input.bg,
                        UI_THEME_TOKENS.input.text,
                      )}
                      value={raw}
                      disabled={disabled}
                      onChange={e => onChangeCell(col.columnId, e.target.value)}
                    />
                  </dd>
                </Fragment>
              )
            })}
          </dl>
          </>
        )}
      </section>
    </section>
  )
}
