import { Fragment, useMemo, useRef, useState } from 'react'
import type { GraphColumnDoc } from '@/features/graph-table-db/graphTableDb'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { SELECTION_INSPECTOR_EMPTY_TEXT } from '@/lib/config'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { cn } from '@/lib/utils'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import { NodeOverlayEditorPanel } from '@/components/FlowEditor/NodeOverlayEditorPanel'
import {
  FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY,
  FLOW_NODE_QUICK_EDITOR_TYPE_ID_KEY,
  resolveNodeQuickEditorRegistryEntry,
} from '@/features/flow-editor-manager/resolveNodeQuickEditorRegistry'
import { useShallow } from 'zustand/react/shallow'

import { normalizeGraphData } from '@/lib/graph/normalize'
import { buildNodeQuickEditorBundleV1, nodeQuickEditorBundleToJsonText } from '@/lib/graph/io/nodeQuickEditorBundle'

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
  const { panelTextClass, microLabelClass, textSizeClass, keyValueInputClass, monospaceTextClass } = usePanelTypography()
  const {
    graphData,
    schema,
    nodeQuickEditorRegistry,
    openQuickEditorNodeIds,
    selectedNodeId,
    uiIconScale,
    uiIconStrokeWidth,
    upsertUiToast,
    setGraphDataPreservingLayout,
  } = useGraphStore(
    useShallow(s => ({
      graphData: s.graphData,
      schema: s.schema,
      nodeQuickEditorRegistry: s.nodeQuickEditorRegistry || [],
      openQuickEditorNodeIds: s.openQuickEditorNodeIds || [],
      selectedNodeId: s.selectedNodeId,
      uiIconScale: s.uiIconScale,
      uiIconStrokeWidth: s.uiIconStrokeWidth,
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
    const props = (node.properties || {}) as Record<string, unknown>
    const hasHint =
      (typeof props[FLOW_NODE_QUICK_EDITOR_TYPE_ID_KEY] === 'string' && String(props[FLOW_NODE_QUICK_EDITOR_TYPE_ID_KEY]).trim()) ||
      (typeof props[FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY] === 'string' && String(props[FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY]).trim())
    const isSelected = id === String(selectedNodeId || '')
    const isPinned = openQuickEditorNodeIds.includes(id)
    const isQuickEditorNode = hasHint || !!registryEntry
    return isQuickEditorNode && (isSelected || isPinned)
  }, [node, openQuickEditorNodeIds, registryEntry, selectedNodeId])

  const [codeFormat, setCodeFormat] = useState<'json' | 'markdown'>('json')
  const quickEditorCodeText = useMemo(() => {
    if (!node || !showQuickEditor) return ''
    const nodeId = String(node.id || '').trim()
    if (!nodeId) return ''

    const safeType = String(node.type || '').trim()
    const registryForType = (nodeQuickEditorRegistry || []).filter((e: unknown) => {
      if (!e || typeof e !== 'object') return false
      const rec = e as { isEnabled?: unknown; nodeTypeId?: unknown }
      if (rec.isEnabled !== true) return false
      return String(rec.nodeTypeId || '').trim() === safeType
    })

    const edges = (allEdges || []).filter(e => String(e.source || '') === nodeId || String(e.target || '') === nodeId)
    const graph = {
      context: '',
      type: 'Graph',
      nodes: [node],
      edges,
    }
    const bundleText = nodeQuickEditorBundleToJsonText(
      buildNodeQuickEditorBundleV1({ registryEntries: registryForType, graphData: graph as never }),
    )
    if (codeFormat === 'markdown') return `\`\`\`json\n${bundleText}\n\`\`\``
    return bundleText
  }, [allEdges, codeFormat, node, nodeQuickEditorRegistry, showQuickEditor])

  const copyQuickEditorCode = () => {
    const text = quickEditorCodeText
    if (!text) return
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      upsertUiToast({ id: 'qe-code-copy-unavailable', kind: 'neutral', message: 'Clipboard not available.', ttlMs: 2200 })
      return
    }
    void navigator.clipboard
      .writeText(text)
      .then(() => {
        upsertUiToast({ id: 'qe-code-copied', kind: 'success', message: 'Copied.', ttlMs: 1400 })
      })
      .catch(() => {
        upsertUiToast({ id: 'qe-code-copy-failed', kind: 'neutral', message: 'Copy failed.', ttlMs: 2200 })
      })
  }

  const [panelMinimized, setPanelMinimized] = useState(false)
  const [panelPinned, setPanelPinned] = useState(true)
  const [panelHideFields, setPanelHideFields] = useState(false)
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
                  uiPanelOpacity={1}
                  panelTextClass={panelTextClass}
                  microLabelClass={microLabelClass}
                  uiIconScale={uiIconScale}
                  uiIconStrokeWidth={uiIconStrokeWidth}
                  labelInputRef={labelInputRef}
                  onHeaderPointerDown={() => void 0}
                  onToggleHideFields={() => setPanelHideFields(v => !v)}
                  onTogglePinned={() => setPanelPinned(v => !v)}
                  onToggleMinimized={() => setPanelMinimized(v => !v)}
                  onSetLabel={handleSetLabel}
                  onSetType={handleSetType}
                  onPatchProperties={handlePatchProperties}
                  onSetProperties={handleSetProperties}
                  onValidate={handleValidate}
                  portHandleEdges={allEdges}
                  schema={schema}
                />

                <section className={cn('mt-3 rounded border overflow-hidden', UI_THEME_TOKENS.panel.border)} aria-label="Node Quick Editor codes">
                  <header className={cn('px-2 py-2 border-b flex items-center justify-between gap-2', UI_THEME_TOKENS.panel.border)}>
                    <div className={cn(microLabelClass, UI_THEME_TOKENS.text.secondary)}>Codes</div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className={cn(
                          'App-toolbar__btn',
                          microLabelClass,
                          codeFormat === 'json' ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}` : `${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`,
                        )}
                        onClick={() => setCodeFormat('json')}
                      >
                        JSON
                      </button>
                      <button
                        type="button"
                        className={cn(
                          'App-toolbar__btn',
                          microLabelClass,
                          codeFormat === 'markdown'
                            ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}`
                            : `${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`,
                        )}
                        onClick={() => setCodeFormat('markdown')}
                      >
                        Markdown
                      </button>
                      <button
                        type="button"
                        className={cn('App-toolbar__btn', microLabelClass, UI_THEME_TOKENS.button.text, UI_THEME_TOKENS.button.hoverBg)}
                        onClick={copyQuickEditorCode}
                        disabled={!quickEditorCodeText}
                      >
                        Copy
                      </button>
                    </div>
                  </header>
                  <div className="p-2">
                    <textarea
                      className={cn(
                        'w-full h-[220px] rounded border px-2 py-1',
                        monospaceTextClass,
                        textSizeClass,
                        UI_THEME_TOKENS.input.bg,
                        UI_THEME_TOKENS.input.border,
                        UI_THEME_TOKENS.input.text,
                      )}
                      value={quickEditorCodeText}
                      readOnly
                      spellCheck={false}
                    />
                  </div>
                </section>
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
