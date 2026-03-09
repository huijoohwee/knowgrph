import { Fragment, useEffect, useMemo, useRef, useState, type ElementType } from 'react'
import type { GraphColumnDoc } from '@/features/graph-table-db/graphTableDb'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { SELECTION_INSPECTOR_EMPTY_TEXT } from '@/lib/config'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { cn } from '@/lib/utils'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import { WorkspaceModeSelect } from '../../../components/BottomPanel/markdownWorkspace/WorkspaceModeSelect'
import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import type { WorkspacePath } from '@/features/workspace-fs/types'
import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import { parseWebpageFrontmatterMeta, upsertWebpageFrontmatterMeta, type WebpageViewMode } from '@/lib/markdown/frontmatter'
import { NodeOverlayEditorPanel } from '@/components/FlowEditor/NodeOverlayEditorPanel'
import { computeFlowConnectedValuesBySchemaPath, type FlowConnectedValuesBySchemaPath } from '@/lib/flowEditor/flowDataflow'
import {
  FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY,
  FLOW_NODE_QUICK_EDITOR_TYPE_ID_KEY,
  resolveNodeQuickEditorRegistryEntry,
} from '@/features/flow-editor-manager/resolveNodeQuickEditorRegistry'
import { normalizeGraphData } from '@/lib/graph/normalize'
import { buildNodeQuickEditorBundleV1, nodeQuickEditorBundleToJsonText } from '@/lib/graph/io/nodeQuickEditorBundle'
import { useShallow } from 'zustand/react/shallow'

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
  scrollMode?: 'internal' | 'parent'
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

export function GraphTableInspector({
  columns,
  row,
  widthPx,
  scrollMode = 'internal',
  onClose,
  onChangeCell,
  onDeleteRow,
}: GraphTableInspectorProps) {
  const { panelTextClass, microLabelClass, textSizeClass, keyValueInputClass, monospaceTextClass } = usePanelTypography()
  const {
    graphData,
    sourceFiles,
    schema,
    nodeQuickEditorRegistry,
    openQuickEditorNodeIds,
    selectedNodeId,
    uiIconScale,
    uiIconStrokeWidth,
    upsertUiToast,
    updateNode,
  } = useGraphStore(
    useShallow(s => ({
      graphData: s.graphData,
      sourceFiles: s.sourceFiles,
      schema: s.schema,
      nodeQuickEditorRegistry: s.nodeQuickEditorRegistry || [],
      openQuickEditorNodeIds: s.openQuickEditorNodeIds || [],
      selectedNodeId: s.selectedNodeId,
      uiIconScale: s.uiIconScale,
      uiIconStrokeWidth: s.uiIconStrokeWidth,
      upsertUiToast: s.upsertUiToast,
      updateNode: s.updateNode,
    })),
  )
  const edgesRaw = graphData?.edges
  const allEdges: GraphEdge[] = useMemo(() => {
    if (!Array.isArray(edgesRaw)) return []
    return edgesRaw as GraphEdge[]
  }, [edgesRaw])
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

  const connectedValuesBySchemaPath: FlowConnectedValuesBySchemaPath | undefined = useMemo(() => {
    if (!node || !showQuickEditor) return undefined
    const nodeId = String(node.id || '').trim()
    if (!nodeId) return undefined
    const byNodeId = computeFlowConnectedValuesBySchemaPath({
      graphData,
      registry: Array.isArray(nodeQuickEditorRegistry) ? nodeQuickEditorRegistry : [],
      targetNodeIds: new Set([nodeId]),
    })
    return byNodeId.get(nodeId)
  }, [graphData, node, nodeQuickEditorRegistry, showQuickEditor])

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
  const [panelHideFields, setPanelHideFields] = useState(false)
  const labelInputRef = useRef<HTMLInputElement | null>(null)

  const [webpageDoc, setWebpageDoc] = useState<
    | null
    | {
        workspacePath: WorkspacePath
        url: string
        view: WebpageViewMode
      }
  >(null)

  useEffect(() => {
    if (!node) {
      setWebpageDoc(null)
      return
    }
    const meta = (node.metadata || {}) as Record<string, unknown>
    const sourceLayerId = typeof meta.sourceLayerId === 'string' ? String(meta.sourceLayerId || '').trim() : ''
    if (!sourceLayerId) {
      setWebpageDoc(null)
      return
    }
    const src = (sourceFiles || []).find(f => String(f?.id || '') === sourceLayerId) || null
    const srcPath = String(src?.source?.path || '').trim()
    if (!srcPath.startsWith('workspace:')) {
      setWebpageDoc(null)
      return
    }
    const workspacePath = normalizeWorkspacePath(srcPath.slice('workspace:'.length))

    let cancelled = false
    void (async () => {
      const fs = await getWorkspaceFs()
      const text = await fs.readFileText(workspacePath).catch(() => '')
      const fm = parseWebpageFrontmatterMeta(text)
      const url = String(fm?.url || (typeof meta.documentUrl === 'string' ? meta.documentUrl : '') || '').trim()
      if (!url) {
        if (!cancelled) setWebpageDoc(null)
        return
      }
      const view: WebpageViewMode = fm?.view || 'markdown'
      if (!cancelled) setWebpageDoc({ workspacePath, url, view })
    })()

    return () => {
      cancelled = true
    }
  }, [node, sourceFiles])

  const switchWebpageView = async (next: WebpageViewMode) => {
    const doc = webpageDoc
    if (!doc) return
    const url = String(doc.url || '').trim()
    if (!url) return
    const fs = await getWorkspaceFs()
    const prevText = await fs.readFileText(doc.workspacePath)
    const nextText = upsertWebpageFrontmatterMeta(prevText, { url, view: next })
    if (nextText !== prevText) await fs.writeFileText(doc.workspacePath, nextText)
    setWebpageDoc({ ...doc, view: next })
  }

  const handleSetLabel = (label: string) => {
    if (!node) return
    const id = String(node.id || '').trim()
    if (!id) return
    updateNode(id, { label: String(label || '') })
  }
  const handleSetType = (type: string) => {
    if (!node) return
    const id = String(node.id || '').trim()
    if (!id) return
    const trimmed = String(type || '').trim() || 'Node'
    updateNode(id, { type: trimmed })
  }
  const handlePatchProperties = (patch: Record<string, unknown>) => {
    if (!node) return
    const id = String(node.id || '').trim()
    if (!id) return
    const prevProps = (node.properties || {}) as Record<string, unknown>
    const nextProps: Record<string, unknown> = { ...prevProps }
    for (const [k, v] of Object.entries(patch)) {
      if (typeof v === 'undefined') delete nextProps[k]
      else nextProps[k] = v
    }
    updateNode(id, { properties: nextProps as never })
  }
  const handleSetProperties = (props: Record<string, unknown>) => {
    if (!node) return
    const id = String(node.id || '').trim()
    if (!id) return
    updateNode(id, { properties: (props || {}) as never })
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
  const RootTag: ElementType = scrollMode === 'internal' ? 'section' : 'div'
  const TitleTag: ElementType = scrollMode === 'internal' ? 'section' : 'div'
  const FieldsTag: ElementType = scrollMode === 'internal' ? 'section' : 'div'

  return (
    <RootTag
      className={cn(
        scrollMode === 'internal' ? 'h-full min-h-0 overflow-hidden flex flex-col' : 'flex flex-col',
        scrollMode === 'internal' ? UI_THEME_TOKENS.panel.bg : null,
        panelTextClass,
      )}
      style={widthPx ? { width: `${widthPx}px` } : undefined}
      aria-label="Record inspector"
    >
      <header className={`px-3 py-2 border-b ${UI_THEME_TOKENS.panel.divider} flex items-center justify-between gap-2`}>
        <TitleTag className="min-w-0" aria-label="Record title">
          <p className={cn(microLabelClass, UI_THEME_TOKENS.text.tertiary)}>{headerKind}</p>
          <p className={`font-semibold ${UI_THEME_TOKENS.text.primary} truncate`}>{headerLabel}</p>
        </TitleTag>
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

      {webpageDoc ? (
        <section
          className={cn('px-3 py-2 border-b flex items-center justify-between gap-2', UI_THEME_TOKENS.panel.divider)}
          aria-label="Webpage view"
        >
          <p className={cn(microLabelClass, UI_THEME_TOKENS.text.secondary)}>Webpage view</p>
          <WorkspaceModeSelect<WebpageViewMode>
            ariaLabel="Webpage view mode"
            value={webpageDoc.view}
            isActive={true}
            options={[
              { value: 'markdown', label: 'Markdown' },
              { value: 'html', label: 'HTML' },
              { value: 'json', label: 'JSON' },
            ]}
            onChange={next => void switchWebpageView(next)}
          />
        </section>
      ) : null}

      <FieldsTag
        className={scrollMode === 'internal' ? 'flex-1 min-h-0 overflow-auto' : undefined}
        aria-label="Record fields"
      >
        {isEmpty ? (
          <p className={cn('px-3 py-2', microLabelClass, UI_THEME_TOKENS.text.tertiary)}>{SELECTION_INSPECTOR_EMPTY_TEXT}</p>
        ) : (
          <>
            {row?.tableId === 'nodes' && node && showQuickEditor ? (
              <section className="px-3 py-2" aria-label="Node Quick Editor">
                <NodeOverlayEditorPanel
                  active={true}
                  node={node}
                  registryEntry={registryEntry}
                  registryEntries={nodeQuickEditorRegistry}
                  minimized={panelMinimized}
                  hideFields={panelHideFields}
                  pinned={false}
                  showPinToggle={false}
                  uiPanelOpacity={1}
                  panelTextClass={panelTextClass}
                  monospaceTextClass={monospaceTextClass}
                  microLabelClass={microLabelClass}
                  uiIconScale={uiIconScale}
                  uiIconStrokeWidth={uiIconStrokeWidth}
                  labelInputRef={labelInputRef}
                  onHeaderPointerDown={() => void 0}
                  onToggleHideFields={() => setPanelHideFields(v => !v)}
                  onToggleMinimized={() => setPanelMinimized(v => !v)}
                  onSetLabel={handleSetLabel}
                  onSetType={handleSetType}
                  onPatchProperties={handlePatchProperties}
                  onSetProperties={handleSetProperties}
                  onValidate={handleValidate}
                  connectedValuesBySchemaPath={connectedValuesBySchemaPath}
                  portHandleEdges={allEdges}
                  schema={schema}
                />

                <section className={cn('mt-3 rounded border overflow-hidden', UI_THEME_TOKENS.panel.border)} aria-label="Node Quick Editor codes">
                  <header className={cn('px-2 py-2 border-b flex items-center justify-between gap-2', UI_THEME_TOKENS.panel.border)}>
                    <p className={cn(microLabelClass, UI_THEME_TOKENS.text.secondary)}>Codes</p>
                    <section className="flex items-center gap-1" aria-label="Code format">
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
                    </section>
                  </header>
                  <section className="p-2" aria-label="Code">
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
                  </section>
                </section>
              </section>
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
      </FieldsTag>
    </RootTag>
  )
}
