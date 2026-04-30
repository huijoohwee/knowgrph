import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_ANCHORS, UI_COPY } from '@/lib/config'
import MainPanelBody from '@/features/panels/ui/MainPanelBody'
import MainPanelGraphFieldsHeader from '@/features/panels/ui/MainPanelGraphFieldsHeader'
import {
  AGENTIC_RAG_FIELD_KIND_META,
  computeDerivedFields,
  getAgenticRagFieldKind,
  parseGraphFieldId,
  type GraphField,
  type GraphFieldId,
} from '@/features/graph-fields/graphFields'
import GraphFieldsListPanel from '@/features/panels/views/graph-fields/GraphFieldsListPanel'
import FieldSettingsPanel from '@/features/panels/views/graph-fields/FieldSettingsPanel'
import { normalized } from '@/features/panels/utils/json'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'

export type GraphFieldsSelectedView =
  | { kind: 'globalSchema' }
  | {
      kind: 'localSchema'
      facet: 'template' | 'properties' | 'validation' | 'localRules'
      category: 'global' | 'base' | 'custom' | 'derived'
      scope: 'node' | 'edge'
      ownerKey: string
    }
  | null

type GraphFieldsViewProps = {
  onStatusChange: (msg: string) => void
  searchQuery?: string
  embedded?: boolean
  entryAliasLabels?: ReadonlyArray<string>
  onEntryAliasClick?: ((label: string) => void) | null
  entryOpenRequest?: {
    token: number
    entryLabel: string
  } | null
}

export default function GraphFieldsView({
  onStatusChange,
  searchQuery,
  embedded = false,
  entryAliasLabels = [],
  onEntryAliasClick = null,
  entryOpenRequest = null,
}: GraphFieldsViewProps) {
  const graphData = useActiveGraphRenderData()
  const graphDataRevision = useGraphStore(s => s.graphDataRevision)
  const upsertUiToast = useGraphStore(s => s.upsertUiToast)
  const dismissUiToast = useGraphStore(s => s.dismissUiToast)
  const settingsById = useGraphStore(s => s.graphFieldSettingsById)
  const patchGraphFieldSetting = useGraphStore(s => s.patchGraphFieldSetting)
  const removeGraphFieldSetting = useGraphStore(s => s.removeGraphFieldSetting)
  const graphDataTableVisibleColumns = useGraphStore(s => s.graphDataTableVisibleColumns)
  const graphDataTableColumnOrder = useGraphStore(s => s.graphDataTableColumnOrder)
  const setGraphDataTableVisibleColumns = useGraphStore(s => s.setGraphDataTableVisibleColumns)
  const setGraphDataTableColumnOrder = useGraphStore(s => s.setGraphDataTableColumnOrder)
  const selectedFieldId = useGraphStore(s => s.selectedGraphFieldId)
  const setSelectedFieldId = useGraphStore(s => s.setSelectedGraphFieldId)
  const [selectedGlobalView, setSelectedGlobalView] = React.useState<GraphFieldsSelectedView>(null)
  const fieldSettingsPaneRef = React.useRef<HTMLElement | null>(null)

  const derivedFields = React.useMemo<ReadonlyArray<GraphField>>(() => {
    if (!graphData) return []
    return computeDerivedFields(graphData)
  }, [graphData])

  const fields = React.useMemo<ReadonlyArray<GraphField>>(() => {
    if (!graphData) return []
    const derivedIds = new Set<string>(derivedFields.map(f => f.id))
    const custom: GraphField[] = []
    for (const [id, v] of Object.entries(settingsById)) {
      if (!v || v.isCustom !== true) continue
      if (derivedIds.has(id)) continue
      const parsed = parseGraphFieldId(id)
      if (!parsed) continue
      custom.push({
        id: `${parsed.scope}:${parsed.key}` as GraphFieldId,
        scope: parsed.scope,
        key: parsed.key,
        kind: 'unknown',
        samples: 0,
      })
    }
    const merged = [...derivedFields, ...custom]
    merged.sort((a, b) => {
      if (a.scope !== b.scope) return a.scope === 'node' ? -1 : 1
      return a.key.localeCompare(b.key)
    })
    return merged
  }, [derivedFields, graphData, settingsById])

  const agenticLegend = React.useMemo(() => {
    const kinds = new Set<string>()
    for (const field of fields) {
      const kind = getAgenticRagFieldKind(field)
      if (!kind) continue
      kinds.add(kind)
    }
    if (kinds.size === 0) return null
    const entries: string[] = []
    if (kinds.has('chunk_text')) entries.push(AGENTIC_RAG_FIELD_KIND_META.chunk_text.legendLabel)
    if (kinds.has('embedding')) entries.push(AGENTIC_RAG_FIELD_KIND_META.embedding.legendLabel)
    if (kinds.has('media_url')) entries.push(AGENTIC_RAG_FIELD_KIND_META.media_url.legendLabel)
    if (kinds.has('graphRAGPath')) entries.push(AGENTIC_RAG_FIELD_KIND_META.graphRAGPath.legendLabel)
    return entries
  }, [fields])

  const normalizedQuery = normalized(searchQuery).trim()

  const visibleFieldIds = React.useMemo<ReadonlySet<GraphFieldId> | null>(() => {
    if (!normalizedQuery) return null
    const ids = new Set<GraphFieldId>()
    for (const field of fields) {
      const scopeText = normalized(field.scope)
      const keyText = normalized(field.key)
      if (scopeText.includes(normalizedQuery) || keyText.includes(normalizedQuery)) {
        ids.add(field.id)
      }
    }
    return ids
  }, [fields, normalizedQuery])

  React.useEffect(() => {
    if (!graphData) {
      if (selectedFieldId !== null) setSelectedFieldId(null)
      setSelectedGlobalView(prev => (prev === null ? prev : null))
      onStatusChange(UI_COPY.noGraphLoaded)
      return
    }
    if (selectedGlobalView) {
      if (selectedFieldId !== null) setSelectedFieldId(null)
      return
    }
    if (!selectedFieldId || !fields.some(f => f.id === selectedFieldId)) {
      const nextId = fields.length > 0 ? fields[0].id : null
      if (selectedFieldId !== nextId) setSelectedFieldId(nextId)
    }
    if (fields.length > 0) {
      onStatusChange(UI_COPY.syncedFieldsStatus(fields.length))
    } else {
      onStatusChange(UI_COPY.syncedNoFieldsFoundStatus)
    }
  }, [fields, graphData, onStatusChange, selectedFieldId, selectedGlobalView, setSelectedFieldId])

  const selectedField = React.useMemo(() => {
    if (!selectedFieldId) return null
    return fields.find(f => f.id === selectedFieldId) || null
  }, [fields, selectedFieldId])

  React.useEffect(() => {
    if (!entryOpenRequest || !graphData || fields.length === 0) return
    const label = normalized(entryOpenRequest.entryLabel).toLowerCase()
    const rendererHint = label.includes('renderer')
    const nodeHint = label.includes('node')
    const edgeOnly = label.includes('edge')
    const clusterHint = label.includes('cluster') || label.includes('sample') || label.includes('group')
    const layerHint = label.includes('layer')
    const flowHint = label.includes('workflow') || label.includes('step') || label.includes('tier b') || label.includes('runtime') || label.includes('pipeline') || label.includes('mermaid') || label.includes('flow')
    const inspectorHint = label.includes('inspector')

    const byScope = (scope: 'node' | 'edge') => fields.find(f => f.scope === scope) || null
    const byScopeNonChunkText = (scope: 'node' | 'edge') =>
      fields.find(f => f.scope === scope && !normalized(f.key).includes('chunk_text')) || null
    const byKeyContains = (parts: string[]) => {
      for (const part of parts) {
        const hit = fields.find(f => normalized(f.key).includes(normalized(part)))
        if (hit) return hit
      }
      return null
    }

    let target: GraphField | null = null
    if (edgeOnly) {
      target = byScope('edge')
    } else if (rendererHint) {
      target = byKeyContains(['renderer', 'layout', 'style', 'theme', 'color']) || byScopeNonChunkText('node') || byScope('node')
    } else if (layerHint) {
      target = byKeyContains(['layer', 'cluster', 'group', 'subgraph']) || byScopeNonChunkText('node') || byScope('node')
    } else if (nodeHint) {
      target = byScope('node')
    } else if (clusterHint) {
      target = byKeyContains(['cluster', 'group', 'layer']) || byScopeNonChunkText('node') || byScope('node')
    } else if (flowHint || inspectorHint) {
      target = byKeyContains(['flow', 'pipeline', 'runtime', 'step', 'node']) || byScope('node')
    }
    if (!target && selectedFieldId) target = fields.find(f => f.id === selectedFieldId) || null
    if (!target) target = fields[0] || null
    if (!target) return

    setSelectedGlobalView(prev => (prev === null ? prev : null))
    if (selectedFieldId !== target.id) setSelectedFieldId(target.id)
    try {
      upsertUiToast({
        id: `graphFields:entryOpen:${entryOpenRequest.token}`,
        kind: 'neutral',
        message: `Opened Field Settings via ${entryOpenRequest.entryLabel}: ${target.id}`,
        ttlMs: 1800,
      })
    } catch {
      void 0
    }
    try {
      fieldSettingsPaneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    } catch {
      void 0
    }
    onStatusChange(`Opened Field Settings via ${entryOpenRequest.entryLabel}: ${target.id}`)
  }, [entryOpenRequest, fields, graphData, onStatusChange, selectedFieldId, setSelectedFieldId, upsertUiToast])

  const resync = React.useCallback(() => {
    if (!graphData) return
    if (fields.length > 0) {
      onStatusChange(UI_COPY.syncedFieldsStatus(fields.length))
    } else {
      onStatusChange(UI_COPY.syncedNoFieldsFoundStatus)
    }
  }, [fields, graphData, onStatusChange])

  const lastRawNodesEdgesToastRevisionRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    const isRawNodesEdges = graphData && graphData.context === 'raw-nodes-edges'
    const toastId = 'graphFields:raw-nodes-edges'

    if (!isRawNodesEdges) {
      lastRawNodesEdgesToastRevisionRef.current = null
      dismissUiToast(toastId)
      return
    }

    if (lastRawNodesEdgesToastRevisionRef.current === graphDataRevision) return
    lastRawNodesEdgesToastRevisionRef.current = graphDataRevision

    const message = `${UI_COPY.graphFieldsRawNodesEdgesToastTitle}\n${UI_COPY.graphFieldsRawNodesEdgesToastBody}`
    upsertUiToast({
      id: toastId,
      kind: 'warning',
      message,
      ttlMs: 10_000,
      dismissible: true,
    })
  }, [dismissUiToast, graphData, graphDataRevision, upsertUiToast])

  const content = (
    <article
      className="min-h-full flex flex-col overflow-visible"
      data-kg-anchor={UI_ANCHORS.graphFields}
    >
      <div className="min-h-0">
        <div className="min-h-0 min-w-0 grid grid-cols-3 gap-2">
          <section className="col-span-2 min-h-0 overflow-auto">
            <GraphFieldsListPanel
            graphData={graphData}
            graphDataRevision={graphDataRevision}
            fields={fields}
            visibleFieldIds={visibleFieldIds}
            selectedFieldId={selectedFieldId}
            setSelectedFieldId={setSelectedFieldId}
            selectedGlobalView={selectedGlobalView}
            setSelectedGlobalView={setSelectedGlobalView}
            settingsById={settingsById}
            patchGraphFieldSetting={patchGraphFieldSetting}
            graphDataTableVisibleColumns={graphDataTableVisibleColumns}
            graphDataTableColumnOrder={graphDataTableColumnOrder}
            setGraphDataTableVisibleColumns={setGraphDataTableVisibleColumns}
            setGraphDataTableColumnOrder={setGraphDataTableColumnOrder}
            onStatusChange={onStatusChange}
            />
          </section>
          <section ref={fieldSettingsPaneRef} className="col-span-1 min-h-0 overflow-auto">
            <FieldSettingsPanel
            graphData={graphData}
            selectedField={selectedField}
            selectedGlobalView={selectedGlobalView}
            setSelectedGlobalView={setSelectedGlobalView}
            settingsById={settingsById}
            patchGraphFieldSetting={patchGraphFieldSetting}
            removeGraphFieldSetting={removeGraphFieldSetting}
            onResync={resync}
            onStatusChange={onStatusChange}
            />
          </section>
        </div>
      </div>
    </article>
  )

  if (embedded) {
    return (
      <section className="h-full min-h-0 flex flex-col">
        <section className="mb-2">
          <MainPanelGraphFieldsHeader agenticLegend={agenticLegend} />
        </section>
        {entryAliasLabels.length > 0 && onEntryAliasClick ? (
          <section className="mb-2 rounded border border-white/10 p-2" aria-label="Graph Fields entry aliases">
            <section className={cn('text-[10px] mb-2', UI_THEME_TOKENS.text.tertiary)}>
              Entry aliases (click to open Field Settings)
            </section>
            <section className="flex flex-wrap gap-1">
              {entryAliasLabels.map(label => (
                <button
                  key={label}
                  type="button"
                  className={cn('App-toolbar__btn text-xs', UI_THEME_TOKENS.button.text, UI_THEME_TOKENS.button.hoverBg)}
                  onClick={() => onEntryAliasClick(label)}
                >
                  {label}
                </button>
              ))}
            </section>
          </section>
        ) : null}
        <section className="flex-1 min-h-0 w-full overflow-auto">
          {content}
        </section>
      </section>
    )
  }

  return (
    <MainPanelBody header={<MainPanelGraphFieldsHeader agenticLegend={agenticLegend} />} scrollable={false}>
      {content}
    </MainPanelBody>
  )
}
