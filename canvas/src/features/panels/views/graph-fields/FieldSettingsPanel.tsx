import React from 'react'
import type { GraphData, JSONValue } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import {
  GRAPH_FIELD_TYPES,
  inferFieldTypeFromGraphData,
  normalizeSettingsForField,
  type GraphField,
  type GraphFieldSettingsById,
  type GraphFieldType,
  type GraphFieldSettingsResolved,
} from '@/features/graph-fields/graphFields'
import { type GraphDataTableColumnKey } from '@/features/graph-data-table/graphDataTable'
import {
  CurrencySection,
  DecimalPlacesSection,
  DefaultValueSection,
  SelectOptionsSection,
  UrlProtocolSection,
} from '@/features/panels/views/graph-fields/FieldSettingsSections'
import Tooltip from '@/features/panels/ui/Tooltip'
import {
  GRAPH_FIELDS_DESCRIPTION_TOOLTIP_TEXT,
  UI_COPY,
  UI_LABELS,
} from '@/lib/config.copy'
import { computeFilteredLists } from '@/features/schema-editor/utils'
import { useGraphStore } from '@/hooks/useGraphStore'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import FieldSchemaSection from '@/features/panels/views/graph-fields/FieldSchemaSection'
import FieldStylesSection from '@/features/panels/views/graph-fields/FieldStylesSection'
import FieldLayoutSection from '@/features/panels/views/graph-fields/FieldLayoutSection'
import FieldEndpointsAndCardinalitySection from '@/features/panels/views/graph-fields/FieldEndpointsAndCardinalitySection'
import FieldLocalSchemaSection from '@/features/panels/views/graph-fields/FieldLocalSchemaSection'
import AdvancedSection from '@/features/schema-editor/AdvancedSection'
import SchemaUiEditor from '@/features/schema/ui/SchemaUiEditor'
import type { GraphFieldsSelectedView } from '@/features/panels/views/GraphFieldsView'
import { FieldGraphLayersSection, GraphLayerMetadataPresetsSection } from '@/features/panels/views/graph-fields/FieldGraphLayersSection'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { MonacoTextEditor } from '@/features/monaco/MonacoTextEditor'
import { MainPanelSettingsPanelShell } from '@/features/panels/ui/MainPanelSettingsPanelShell'

type FieldSettingsPanelProps = {
  graphData: GraphData | null
  selectedField: GraphField | null
  selectedGlobalView: GraphFieldsSelectedView
  setSelectedGlobalView: React.Dispatch<React.SetStateAction<GraphFieldsSelectedView>>
  settingsById: GraphFieldSettingsById
  setGraphFieldSettingsById: (next: GraphFieldSettingsById) => void
  onResync: () => void
  onStatusChange: (msg: string) => void
}

export default function FieldSettingsPanel({
  graphData,
  selectedField,
  selectedGlobalView,
  setSelectedGlobalView,
  settingsById,
  setGraphFieldSettingsById,
  onResync,
  onStatusChange,
}: FieldSettingsPanelProps) {
  const selectedSettings = React.useMemo<GraphFieldSettingsResolved | null>(() => {
    if (!selectedField) return null
    return normalizeSettingsForField(selectedField, settingsById[selectedField.id])
  }, [selectedField, settingsById])
  const suggestedFieldType = React.useMemo(
    () => inferFieldTypeFromGraphData(graphData, selectedField),
    [graphData, selectedField],
  )
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-xs',
  )
  const uiPanelMonospaceTextClass = useGraphStore(
    s => s.uiPanelMonospaceTextClass || 'font-mono text-xs',
  )
  const schema = useGraphStore(s => s.schema)
  const setSchema = useGraphStore(s => s.setSchema)

  const { uniqueNodeTypes, uniqueEdgeLabels } = React.useMemo(() => {
    if (!schema) {
      return { uniqueNodeTypes: [] as string[], uniqueEdgeLabels: [] as string[] }
    }
    return computeFilteredLists(graphData, schema)
  }, [graphData, schema])
  const localSchemaNodeTypes = React.useMemo(() => {
    if (!schema) return uniqueNodeTypes
    const nodeSchemaKeys = Object.keys(schema.propertySchemas?.node ?? {})
    const both = uniqueNodeTypes.filter(t => nodeSchemaKeys.includes(t))
    return both.length > 0 ? both : uniqueNodeTypes
  }, [schema, uniqueNodeTypes])
  const localSchemaEdgeLabels = React.useMemo(() => {
    if (!schema) return uniqueEdgeLabels
    const edgeSchemaKeys = Object.keys(schema.propertySchemas?.edge ?? {})
    const both = uniqueEdgeLabels.filter(l => edgeSchemaKeys.includes(l))
    return both.length > 0 ? both : uniqueEdgeLabels
  }, [schema, uniqueEdgeLabels])

  const filteredNodeTypesForSelectedField = React.useMemo<string[] | undefined>(() => {
    if (!schema) return undefined
    if (!selectedField) return undefined
    if (selectedField.scope !== 'node') return undefined
    const nodeSchemas = schema.propertySchemas?.node ?? {}
    const result: string[] = []
    for (const [typeKey, props] of Object.entries(nodeSchemas)) {
      if (props && Object.prototype.hasOwnProperty.call(props, selectedField.key)) {
        result.push(typeKey)
      }
    }
    return result.length > 0 ? result : undefined
  }, [schema, selectedField])

  const filteredEdgeLabelsForSelectedField = React.useMemo<string[] | undefined>(() => {
    if (!schema) return undefined
    if (!selectedField) return undefined
    if (selectedField.scope !== 'edge') return undefined
    const edgeSchemas = schema.propertySchemas?.edge ?? {}
    const result: string[] = []
    for (const [label, props] of Object.entries(edgeSchemas)) {
      if (props && Object.prototype.hasOwnProperty.call(props, selectedField.key)) {
        result.push(label)
      }
    }
    return result.length > 0 ? result : undefined
  }, [schema, selectedField])

  const preferredSchemaOwnerKey = React.useMemo<string | undefined>(() => {
    if (!selectedField) return undefined
    if (selectedField.scope === 'node') {
      return filteredNodeTypesForSelectedField?.[0]
    }
    if (selectedField.scope === 'edge') {
      return filteredEdgeLabelsForSelectedField?.[0]
    }
    return undefined
  }, [selectedField, filteredNodeTypesForSelectedField, filteredEdgeLabelsForSelectedField])

  const ownerCandidatesForSelectedField = React.useMemo<string[]>(() => {
    if (!selectedField) return []
    return selectedField.scope === 'node' ? localSchemaNodeTypes : localSchemaEdgeLabels
  }, [localSchemaEdgeLabels, localSchemaNodeTypes, selectedField])

  const [schemaOwnerKey, setSchemaOwnerKey] = React.useState('')

  React.useEffect(() => {
    if (!selectedField || !schema) {
      setSchemaOwnerKey('')
      return
    }
    if (preferredSchemaOwnerKey && ownerCandidatesForSelectedField.includes(preferredSchemaOwnerKey)) {
      setSchemaOwnerKey(preferredSchemaOwnerKey)
      return
    }
    setSchemaOwnerKey(ownerCandidatesForSelectedField[0] ?? '')
  }, [selectedField, schema, preferredSchemaOwnerKey, ownerCandidatesForSelectedField])

  const updateSelectedSettings = React.useCallback(
    (patch: Partial<GraphFieldSettingsResolved>) => {
      if (!selectedField || !selectedSettings) return
      setGraphFieldSettingsById({
        ...settingsById,
        [selectedField.id]: { ...selectedSettings, ...patch },
      })
      if (typeof patch.isHidden === 'boolean') {
        const state = useGraphStore.getState()
        const key = `prop:${selectedField.scope}:${selectedField.key}` as GraphDataTableColumnKey
        const current = state.graphDataTableVisibleColumns
        state.setGraphDataTableVisibleColumns({
          ...current,
          [key]: patch.isHidden ? false : true,
        })
      }
    },
    [selectedField, selectedSettings, setGraphFieldSettingsById, settingsById],
  )

  const resetSelectedSettings = React.useCallback(() => {
    if (!selectedField) return
    const next: GraphFieldSettingsById = { ...settingsById }
    delete next[selectedField.id]
    setGraphFieldSettingsById(next)
  }, [selectedField, setGraphFieldSettingsById, settingsById])

  const setSelectedDefaultValue = React.useCallback(
    (defaultValue: JSONValue | null) => {
      updateSelectedSettings({ defaultValue })
    },
    [updateSelectedSettings],
  )

  const selectedFieldSampleCount = selectedField ? selectedField.samples : null

  const [stylesCollapsed, setStylesCollapsed] = React.useState(false)
  const [schemaExtrasCollapsed, setSchemaExtrasCollapsed] = React.useState(true)

  const secondaryLabel = React.useMemo(() => {
    if (selectedGlobalView?.kind === 'globalSchema') {
      return UI_LABELS.globalSchema
    }
    if (selectedGlobalView?.kind === 'localSchema') {
      const categoryLabel =
        selectedGlobalView.category === 'global'
          ? UI_LABELS.globalFields
          : selectedGlobalView.category === 'base'
            ? UI_LABELS.baseFields
            : selectedGlobalView.category === 'custom'
              ? UI_LABELS.customFields
              : UI_LABELS.derivedFields
      const facetLabel =
        selectedGlobalView.facet === 'template'
          ? UI_COPY.graphFieldsLocalSchemaFacetTemplateJsonLabel
          : selectedGlobalView.facet === 'properties'
            ? UI_COPY.graphFieldsLocalSchemaFacetPropertiesLabel
            : selectedGlobalView.facet === 'validation'
              ? UI_COPY.graphFieldsLocalSchemaFacetValidationLabel
              : UI_COPY.graphFieldsLocalSchemaFacetLocalRulesLabel
      const scopeLabel =
        selectedGlobalView.scope === 'node'
          ? UI_COPY.graphFieldsScopeNodeLabel
          : UI_COPY.graphFieldsScopeEdgeLabel
      const owner = selectedGlobalView.ownerKey || '—'
      const facetSegment =
        selectedGlobalView.facet === 'template'
          ? 'template'
          : selectedGlobalView.facet === 'properties'
            ? 'properties'
            : selectedGlobalView.facet === 'validation'
              ? 'validation'
              : 'localRules'
      const scopeSegment = selectedGlobalView.scope === 'node' ? 'node' : 'edge'
      const path = `local:schema:${facetSegment}:${scopeSegment}:${owner}`
      return `${categoryLabel} · ${facetLabel} · ${scopeLabel} · ${owner} (${path})`
    }
    if (selectedField) {
      return `${
        selectedField.scope === 'node'
          ? UI_COPY.graphFieldsScopeNodeLabel
          : UI_COPY.graphFieldsScopeEdgeLabel
      } · ${selectedField.key}`
    }
    return '—'
  }, [selectedField, selectedGlobalView])

  React.useEffect(() => {
    if (!selectedField || !selectedSettings) return
    if (!suggestedFieldType) return
    const raw = settingsById[selectedField.id]
    if (raw?.fieldType) return
    setGraphFieldSettingsById({
      ...settingsById,
      [selectedField.id]: { ...selectedSettings, fieldType: suggestedFieldType },
    })
  }, [selectedField, selectedSettings, setGraphFieldSettingsById, settingsById, suggestedFieldType])

  return (
    <MainPanelSettingsPanelShell
      ariaLabel={UI_LABELS.fieldSettings}
      uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
      titleNode={
        <Tooltip
          content={UI_COPY.graphFieldsAgenticFieldSettingsDescription}
          maxWidthPx={420}
          contentClassName="bg-gray-800/90"
          className="min-w-0"
        >
          <section className={`${uiPanelKeyValueTextSizeClass} truncate`}>{UI_LABELS.fieldSettings}</section>
        </Tooltip>
      }
      secondaryNode={secondaryLabel}
    >
        {selectedGlobalView?.kind === 'globalSchema' ? (
          <div className="p-3 space-y-3">
            <SchemaUiEditor schema={schema} setSchema={setSchema} mode="globalOnly" />
            {uniqueNodeTypes.length > 0 ? (
              <div className={`rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} p-3`}>
                <AdvancedSection uniqueNodeTypes={uniqueNodeTypes} />
              </div>
            ) : null}
            {schema ? (
              <GraphLayerMetadataPresetsSection
                schema={schema as GraphSchema}
                uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
              />
            ) : null}
          </div>
        ) : selectedGlobalView?.kind === 'localSchema' ? (
          <FieldLocalSchemaSection
            graphData={graphData}
            schema={schema}
            setSchema={setSchema}
            selectedGlobalView={selectedGlobalView}
            setSelectedGlobalView={setSelectedGlobalView}
            uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
            uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
            localSchemaNodeTypes={localSchemaNodeTypes}
            localSchemaEdgeLabels={localSchemaEdgeLabels}
          />
        ) : !selectedField || !selectedSettings ? (
          <div className={`p-3 ${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.tertiary}`}>
            {UI_COPY.graphFieldsSelectFieldToEdit}
          </div>
        ) : (
          <>
            <form
              onSubmit={e => {
                e.preventDefault()
              }}
              className="p-3 space-y-3"
            >
              <div className="rounded border border-gray-200 bg-white p-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <label className={`block ${uiPanelKeyValueTextSizeClass} text-gray-700`} htmlFor="graph-fields-display-name">
                      {UI_LABELS.name}
                    </label>
                    <div className="mt-1">
                      <input
                        id="graph-fields-display-name"
                        value={selectedSettings.displayName}
                        onChange={e => updateSelectedSettings({ displayName: e.target.value })}
                        className="h-9 w-full rounded border border-gray-300 bg-white px-2 text-xs text-gray-800"
                      />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <label className={`block ${uiPanelKeyValueTextSizeClass} text-gray-700`} htmlFor="graph-fields-type">
                      {UI_LABELS.type}
                    </label>
                    <div className="mt-1">
                      <select
                        id="graph-fields-type"
                        value={selectedSettings.fieldType}
                        onChange={e => updateSelectedSettings({ fieldType: e.target.value as GraphFieldType })}
                        className="h-9 w-full rounded border border-gray-300 bg-white px-2 text-xs text-gray-800"
                      >
                        {GRAPH_FIELD_TYPES.map(t => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      {suggestedFieldType ? (
                        <div className={`${uiPanelKeyValueTextSizeClass} mt-1 text-gray-500`}>
                          Suggested: {suggestedFieldType}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div>
                  <label className={`block ${uiPanelKeyValueTextSizeClass} text-gray-700`} htmlFor="graph-fields-description">
                    <Tooltip
                      content={GRAPH_FIELDS_DESCRIPTION_TOOLTIP_TEXT}
                      maxWidthPx={260}
                      contentClassName="bg-gray-800/90"
                    >
                      <span className="inline-flex items-center gap-1">
                        <span>{UI_COPY.graphFieldsDescriptionLabel}</span>
                      </span>
                    </Tooltip>
                  </label>
                  <div className="mt-1">
                    <div className="h-[84px] w-full rounded border border-gray-300 overflow-hidden bg-white">
                      <MonacoTextEditor
                        value={selectedSettings.description}
                        onChange={(val) => updateSelectedSettings({ description: val })}
                        language="text"
                        uri="inmemory://graph-fields/description"
                        themeMode="light"
                        wordWrap
                        className="w-full h-full"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {selectedSettings.fieldType === 'Multi-select' || selectedSettings.fieldType === 'Single-select' ? (
                <SelectOptionsSection
                  selectedSettings={selectedSettings}
                  updateSettings={updateSelectedSettings}
                  sampleCount={selectedFieldSampleCount ?? undefined}
                />
              ) : null}

              {schema ? (
                <FieldSchemaSection
                  schema={schema}
                  selectedField={selectedField}
                  selectedSettings={selectedSettings}
                  ownersWithField={
                    selectedField.scope === 'node'
                      ? filteredNodeTypesForSelectedField
                      : filteredEdgeLabelsForSelectedField
                  }
                  ownerKey={schemaOwnerKey}
                  uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
                />
              ) : null}

              {schema ? (
                <CollapsibleSection
                  title={UI_COPY.graphFieldsStylesSectionTitle}
                  collapsed={stylesCollapsed}
                  onToggle={setStylesCollapsed}
                  stickyHeader={false}
                  className="mt-0 border-t-0 pt-0"
                >
                  <FieldStylesSection
                    schema={schema}
                    scope={selectedField.scope}
                    ownerKey={schemaOwnerKey}
                    uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
                  />
                </CollapsibleSection>
              ) : null}

              {schema ? (
                <CollapsibleSection
                  title={UI_COPY.graphFieldsSchemaExtrasSectionTitle}
                  collapsed={schemaExtrasCollapsed}
                  onToggle={setSchemaExtrasCollapsed}
                  stickyHeader={false}
                  className="mt-0 border-t-0 pt-0"
                >
                  <div className="rounded border border-gray-200 bg-white p-3 space-y-3">
                    <FieldGraphLayersSection
                      schema={schema as GraphSchema}
                      scope={selectedField.scope}
                      ownerKey={schemaOwnerKey}
                      fieldKey={selectedField.key}
                      uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
                    />

                    <FieldLayoutSection
                      schema={schema}
                      scope={selectedField.scope}
                      ownerKey={schemaOwnerKey}
                      uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
                    />

                    <FieldEndpointsAndCardinalitySection
                      schema={schema}
                      scope={selectedField.scope}
                      ownerKey={schemaOwnerKey}
                      uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
                    />
                  </div>
                </CollapsibleSection>
              ) : null}

              <DefaultValueSection
                selectedSettings={selectedSettings}
                setDefaultValue={setSelectedDefaultValue}
                updateSettings={updateSelectedSettings}
                onStatusChange={onStatusChange}
              />

              <DecimalPlacesSection selectedSettings={selectedSettings} updateSettings={updateSelectedSettings} />

              <CurrencySection selectedSettings={selectedSettings} updateSettings={updateSelectedSettings} />

              <UrlProtocolSection selectedSettings={selectedSettings} updateSettings={updateSelectedSettings} />

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={resetSelectedSettings}
                  className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} border border-gray-300 bg-gray-50 text-gray-700`}
                >
                  {UI_LABELS.reset}
                </button>
                <button
                  type="button"
                  onClick={onResync}
                  className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} border border-gray-300 bg-gray-50 text-gray-700`}
                  disabled={!graphData}
                >
                  {UI_COPY.graphFieldsResyncButtonLabel}
                </button>
              </div>
            </form>
          </>
        )}
    </MainPanelSettingsPanelShell>
  )
}
