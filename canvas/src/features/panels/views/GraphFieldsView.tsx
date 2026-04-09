import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_ANCHORS, UI_COPY, UI_LABELS } from '@/lib/config'
import MainPanelBody from '@/features/panels/ui/MainPanelBody'
import MainPanelGraphFieldsHeader from '@/features/panels/ui/MainPanelGraphFieldsHeader'
import {
  AGENTIC_RAG_FIELD_KIND_META,
  computeDerivedFields,
  getAgenticRagFieldKind,
  normalizeSelectOptionsAndDefaultValue,
  normalizeSettingsForField,
  parseGraphFieldId,
  type GraphField,
  type GraphFieldId,
} from '@/features/graph-fields/graphFields'
import GraphFieldsListPanel from '@/features/panels/views/graph-fields/GraphFieldsListPanel'
import FieldSettingsPanel from '@/features/panels/views/graph-fields/FieldSettingsPanel'
import FieldSamplesPanel from '@/features/panels/views/graph-fields/FieldSamplesPanel'
import { normalized } from '@/features/panels/utils/json'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import { WorkspaceTableModeControl } from '@/features/workspace-table/ui/WorkspaceTableModeControl'
import {
  FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY,
  FLOW_NODE_QUICK_EDITOR_TYPE_ID_KEY,
} from '@/features/flow-editor-manager/resolveNodeQuickEditorRegistry'
import { buildNodeQuickEditorDraftFromSmartFields } from '@/features/flow-editor-manager/registryTemplates'
import { usePanelTypography } from '@/lib/ui/panelTypography'
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
}

export default function GraphFieldsView({ onStatusChange, searchQuery }: GraphFieldsViewProps) {
  const { microLabelClass } = usePanelTypography()
  const graphData = useActiveGraphRenderData()
  const graphDataRevision = useGraphStore(s => s.graphDataRevision)
  const upsertUiToast = useGraphStore(s => s.upsertUiToast)
  const dismissUiToast = useGraphStore(s => s.dismissUiToast)
  const {
    selectedNodeId,
    nodeQuickEditorRegistry,
    upsertNodeQuickEditorRegistryEntry,
    updateNode,
  } = useGraphStore(
    useShallow(s => ({
      selectedNodeId: s.selectedNodeId,
      nodeQuickEditorRegistry: s.nodeQuickEditorRegistry,
      upsertNodeQuickEditorRegistryEntry: s.upsertNodeQuickEditorRegistryEntry,
      updateNode: s.updateNode,
    })),
  )
  const settingsById = useGraphStore(s => s.graphFieldSettingsById)
  const setGraphFieldSettingsById = useGraphStore(s => s.setGraphFieldSettingsById)
  const graphDataTableVisibleColumns = useGraphStore(s => s.graphDataTableVisibleColumns)
  const graphDataTableColumnOrder = useGraphStore(s => s.graphDataTableColumnOrder)
  const setGraphDataTableVisibleColumns = useGraphStore(s => s.setGraphDataTableVisibleColumns)
  const setGraphDataTableColumnOrder = useGraphStore(s => s.setGraphDataTableColumnOrder)
  const selectedFieldId = useGraphStore(s => s.selectedGraphFieldId)
  const setSelectedFieldId = useGraphStore(s => s.setSelectedGraphFieldId)
  const [selectedGlobalView, setSelectedGlobalView] = React.useState<GraphFieldsSelectedView>(null)

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

  const selectedNode = React.useMemo(() => {
    const nodeId = String(selectedNodeId || '').trim()
    if (!nodeId || !graphData) return null
    return (graphData.nodes || []).find(n => n && n.id === nodeId) || null
  }, [graphData, selectedNodeId])

  const smartMediaPresetState = React.useMemo(() => {
    const nodeTypeId = String(selectedNode?.type || '').trim()
    if (!nodeTypeId) {
      return {
        nodeTypeId: '',
        entryId: '',
        isReady: false,
      }
    }
    const found = (nodeQuickEditorRegistry || []).find(e =>
      e.nodeTypeId === nodeTypeId && e.quickEditorTypeId === 'default' && e.formId === 'nodeQuickEditor',
    ) || null
    return {
      nodeTypeId,
      entryId: String(found?.id || ''),
      isReady: !!found,
    }
  }, [nodeQuickEditorRegistry, selectedNode])

  const selectedSettings = React.useMemo(() => {
    if (!selectedField) return null
    return normalizeSettingsForField(selectedField, settingsById[selectedField.id])
  }, [selectedField, settingsById])

  const resync = React.useCallback(() => {
    if (!graphData) return
    if (fields.length > 0) {
      onStatusChange(UI_COPY.syncedFieldsStatus(fields.length))
    } else {
      onStatusChange(UI_COPY.syncedNoFieldsFoundStatus)
    }
  }, [fields, graphData, onStatusChange])

  const applySamplesAsSelectOptions = React.useCallback(
    (values: ReadonlyArray<string>) => {
      if (!selectedField || !selectedSettings) return
      if (selectedSettings.fieldType !== 'Multi-select' && selectedSettings.fieldType !== 'Single-select') return

      const next = normalizeSelectOptionsAndDefaultValue({
        fieldType: selectedSettings.fieldType,
        selectOptions: [...selectedSettings.selectOptions, ...values],
        defaultValue: selectedSettings.defaultValue,
      })

      const added = Math.max(0, next.selectOptions.length - selectedSettings.selectOptions.length)
      setGraphFieldSettingsById({
        ...settingsById,
        [selectedField.id]: { ...selectedSettings, ...next },
      })
      if (added > 0) onStatusChange(UI_COPY.graphFieldsSamplesAddedToOptionsStatus(added))
    },
    [onStatusChange, selectedField, selectedSettings, setGraphFieldSettingsById, settingsById],
  )

  const setupSmartMediaQuickEditorPreset = React.useCallback(() => {
    const node = selectedNode
    const nodeId = String(node?.id || '').trim()
    const nodeTypeId = String(node?.type || '').trim()
    if (!node || !nodeId || !nodeTypeId) {
      upsertUiToast({ id: 'graph-fields-smart-media-no-selected-node', kind: 'warning', message: 'Select a node first.', ttlMs: 2500 })
      return
    }
    const draft = buildNodeQuickEditorDraftFromSmartFields({ nodeTypeId })
    const result = upsertNodeQuickEditorRegistryEntry({
      id: smartMediaPresetState.entryId || undefined,
      isEnabled: true,
      nodeTypeId: draft.nodeTypeId,
      quickEditorTypeId: draft.quickEditorTypeId,
      formId: draft.formId,
      fields: draft.fields,
      ports: draft.ports,
      schemaMappings: Array.isArray(draft.schemaMappings) ? draft.schemaMappings : [],
    })
    if (result.ok !== true) {
      upsertUiToast({ id: 'graph-fields-smart-media-setup-failed', kind: 'warning', message: result.message || 'Failed to setup smart-media preset.', ttlMs: 3500 })
      return
    }
    const nextProps: Record<string, unknown> = {
      ...(node.properties || {}),
      [FLOW_NODE_QUICK_EDITOR_TYPE_ID_KEY]: draft.quickEditorTypeId,
      [FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY]: draft.formId,
    }
    updateNode(nodeId, { properties: nextProps } as never)
    upsertUiToast({ id: 'graph-fields-smart-media-setup-ok', kind: 'neutral', message: 'Smart-media quick-editor preset is set up for the selected node.', ttlMs: 2500 })
  }, [selectedNode, smartMediaPresetState.entryId, updateNode, upsertNodeQuickEditorRegistryEntry, upsertUiToast])

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

  return (
    <MainPanelBody header={<MainPanelGraphFieldsHeader agenticLegend={agenticLegend} />} scrollable={false}>
      <article
        className="h-full min-h-0 flex flex-col overflow-hidden"
        data-kg-anchor={UI_ANCHORS.graphFields}
      >
        <div className="flex-1 min-h-0 overflow-hidden">
          <div className="h-full min-h-0 min-w-0 overflow-hidden grid grid-cols-2 grid-rows-[auto_auto_minmax(0,1fr)_minmax(0,1fr)] gap-2">
            <section className="col-span-2 rounded-md border border-white/10 p-2">
              <WorkspaceTableModeControl />
            </section>
            <section className="col-span-2 rounded-md border border-white/10 p-2 min-h-0 max-h-28 overflow-auto" aria-label="Quick Editor Gallery">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className={cn('font-medium truncate', UI_THEME_TOKENS.text.primary)}>Quick Editor Gallery</p>
                  <p className={cn('truncate', microLabelClass, UI_THEME_TOKENS.text.tertiary)}>
                    Smart-media preset (Model, Prompt, Aspect ratio, Duration, Resolution, Generate audio, Fast, Reference image)
                  </p>
                </div>
                <button
                  type="button"
                  className={cn('rounded-md border px-2 py-1 text-xs', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.button.hoverBg, UI_THEME_TOKENS.button.text)}
                  onClick={setupSmartMediaQuickEditorPreset}
                  disabled={!selectedNode}
                >
                  {smartMediaPresetState.isReady ? 'Setup Selected Node' : 'Setup Preset'}
                </button>
              </div>
            </section>
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
              setGraphFieldSettingsById={setGraphFieldSettingsById}
              graphDataTableVisibleColumns={graphDataTableVisibleColumns}
              graphDataTableColumnOrder={graphDataTableColumnOrder}
              setGraphDataTableVisibleColumns={setGraphDataTableVisibleColumns}
              setGraphDataTableColumnOrder={setGraphDataTableColumnOrder}
              onStatusChange={onStatusChange}
            />
            <FieldSettingsPanel
              graphData={graphData}
              selectedField={selectedField}
              selectedGlobalView={selectedGlobalView}
              setSelectedGlobalView={setSelectedGlobalView}
              settingsById={settingsById}
              setGraphFieldSettingsById={setGraphFieldSettingsById}
              onResync={resync}
              onStatusChange={onStatusChange}
            />
            <section className="min-h-0 overflow-hidden col-span-2" aria-label={UI_LABELS.samples}>
              <FieldSamplesPanel
                graphData={graphData}
                selectedField={selectedField}
                selectedSettings={selectedSettings}
                onApplyAsSelectOptions={applySamplesAsSelectOptions}
                onStatusChange={onStatusChange}
              />
            </section>
          </div>
        </div>
      </article>
    </MainPanelBody>
  )
}
