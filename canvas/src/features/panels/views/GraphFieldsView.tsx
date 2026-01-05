import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_ANCHORS, UI_COPY } from '@/lib/config'
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
  const graphData = useGraphStore(s => s.graphData)
  const graphDataRevision = useGraphStore(s => s.graphDataRevision)
  const settingsById = useGraphStore(s => s.graphFieldSettingsById)
  const setGraphFieldSettingsById = useGraphStore(s => s.setGraphFieldSettingsById)
  const graphDataTableVisibleColumns = useGraphStore(s => s.graphDataTableVisibleColumns)
  const graphDataTableColumnOrder = useGraphStore(s => s.graphDataTableColumnOrder)
  const setGraphDataTableVisibleColumns = useGraphStore(s => s.setGraphDataTableVisibleColumns)
  const setGraphDataTableColumnOrder = useGraphStore(s => s.setGraphDataTableColumnOrder)
  const selectedFieldId = useGraphStore(s => s.selectedGraphFieldId)
  const setSelectedFieldId = useGraphStore(s => s.setSelectedGraphFieldId)
  const [selectedGlobalView, setSelectedGlobalView] = React.useState<GraphFieldsSelectedView>(null)

  const fields = React.useMemo<ReadonlyArray<GraphField>>(() => {
    if (!graphData) return []
    const derived = computeDerivedFields(graphData)
    const derivedIds = new Set<string>(derived.map(f => f.id))
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
    const merged = [...derived, ...custom]
    merged.sort((a, b) => {
      if (a.scope !== b.scope) return a.scope === 'node' ? -1 : 1
      return a.key.localeCompare(b.key)
    })
    return merged
  }, [graphData, settingsById])

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
    if (kinds.has('geo')) entries.push(AGENTIC_RAG_FIELD_KIND_META.geo.legendLabel)
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
      setSelectedFieldId(null)
      setSelectedGlobalView(null)
      onStatusChange(UI_COPY.noGraphLoaded)
      return
    }
    if (selectedGlobalView) {
      setSelectedFieldId(null)
      return
    }
    if (!selectedFieldId || !fields.some(f => f.id === selectedFieldId)) {
      const nextId = fields.length > 0 ? fields[0].id : null
      setSelectedFieldId(nextId)
    }
    if (fields.length > 0) {
      onStatusChange(UI_COPY.syncedFieldsStatus(fields.length))
    } else {
      onStatusChange(UI_COPY.syncedNoFieldsFoundStatus)
    }
  }, [graphData, fields, onStatusChange, selectedFieldId, selectedGlobalView, setSelectedFieldId])

  const selectedField = React.useMemo(() => {
    if (!selectedFieldId) return null
    return fields.find(f => f.id === selectedFieldId) || null
  }, [fields, selectedFieldId])

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

  return (
    <MainPanelBody header={<MainPanelGraphFieldsHeader agenticLegend={agenticLegend} />} scrollable={false}>
      <div
        className="h-full min-h-0 flex flex-col overflow-hidden"
        data-kg-anchor={UI_ANCHORS.graphFields}
      >
        <div className="flex-1 min-h-0 overflow-hidden">
          <div className="h-full min-h-0 min-w-0 overflow-hidden grid grid-cols-2 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
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
            <FieldSamplesPanel
              graphData={graphData}
              selectedField={selectedField}
              selectedSettings={selectedSettings}
              onApplyAsSelectOptions={applySamplesAsSelectOptions}
              onStatusChange={onStatusChange}
            />
          </div>
        </div>
      </div>
    </MainPanelBody>
  )
}
