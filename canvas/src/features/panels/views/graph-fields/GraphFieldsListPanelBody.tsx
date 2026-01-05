import React from 'react'
import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphFieldsSelectedView } from '@/features/panels/views/GraphFieldsView'
import { GRAPH_FIELD_TYPES, type GraphField, type GraphFieldId, type GraphFieldSettingsById, type GraphFieldSettingsResolved, type GraphFieldType } from '@/features/graph-fields/graphFields'
import type { GraphDataTableColumnKey } from '@/features/graph-data-table/graphDataTable'
import {
  isGraphDataTablePropertyColumnKey,
  parseGraphDataTablePropertyColumnKey,
} from '@/features/graph-data-table/graphDataTable'
import {
  FieldKeyIcon,
  GraphFieldsIcon,
  SearchIcon,
} from '@/features/graph-fields/ui/graphFieldIcons'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import IconButton from '@/components/IconButton'
import { Plus } from 'lucide-react'
import { normalized as normalizeText } from '@/features/panels/utils/json'
import { GraphFieldsListRow } from '@/features/panels/views/graph-fields/GraphFieldsListRow'
import {
  formatLocalSchemaSubtitle,
  resolveLocalSchemaTarget,
  type LocalSchemaFacet,
} from '@/features/panels/views/graph-fields/graphFieldsListUtils'

export type GraphFieldsListPanelBodyProps = {
  uiPanelKeyValueTextSizeClass: string
  iconSizeClass: string
  uiIconStrokeWidth: number

  graphDataPresent: boolean
  searchOpen: boolean
  setSearchOpen: React.Dispatch<React.SetStateAction<boolean>>
  search: string
  setSearch: React.Dispatch<React.SetStateAction<string>>

  newFieldOpen: boolean
  setNewFieldOpen: React.Dispatch<React.SetStateAction<boolean>>
  newFieldScope: 'node' | 'edge'
  setNewFieldScope: React.Dispatch<React.SetStateAction<'node' | 'edge'>>
  newFieldKey: string
  setNewFieldKey: React.Dispatch<React.SetStateAction<string>>
  newFieldType: GraphFieldType
  setNewFieldType: React.Dispatch<React.SetStateAction<GraphFieldType>>
  createNewField: () => void

  visibleGraphFieldColumnCount: number
  orderedAllCuratorColumnKeys: GraphDataTableColumnKey[]
  filteredGraphFieldColumnKeys: GraphDataTableColumnKey[]
  curatorColumnLabelByKey: Map<GraphDataTableColumnKey, string>
  isCuratorColumnVisible: (key: GraphDataTableColumnKey) => boolean
  setCuratorColumnVisibility: (key: GraphDataTableColumnKey, visible: boolean) => void
  moveCuratorColumn: (from: GraphDataTableColumnKey, to: GraphDataTableColumnKey) => void

  draggingCuratorColumnKey: GraphDataTableColumnKey | null
  setDraggingCuratorColumnKey: React.Dispatch<React.SetStateAction<GraphDataTableColumnKey | null>>
  dragOverCuratorColumnKey: GraphDataTableColumnKey | null
  setDragOverCuratorColumnKey: React.Dispatch<React.SetStateAction<GraphDataTableColumnKey | null>>

  selectedFieldId: GraphFieldId | null
  selectedGlobalView: GraphFieldsSelectedView
  setSelectedGlobalView: React.Dispatch<React.SetStateAction<GraphFieldsSelectedView>>
  setSelectedFieldId: (id: GraphFieldId | null) => void

  fieldById: Map<GraphFieldId, GraphField>
  resolvedSettingsById: Map<GraphFieldId, GraphFieldSettingsResolved>
  settingsById: GraphFieldSettingsById
  schema: GraphSchema | null
  schemaDefinedFieldIds: ReadonlySet<GraphFieldId>
  styleOwnerByFieldId: ReadonlyMap<GraphFieldId, string>
  nodeStyleOwnerKey: string
  edgeStyleOwnerKey: string
  nodeScopeBorderColor: string
  edgeScopeBorderColor: string

  updateGraphFieldSettings: (
    fieldId: GraphFieldId,
    patch: Partial<GraphFieldSettingsResolved>,
  ) => void
  updateNodeStyle: (type: string, style: Partial<{ color: string }>) => void
  updateEdgeStyle: (
    label: string,
    style: Partial<{ color: string; width: number }>,
  ) => void

  localSchemaNodeTypes: string[]
  localSchemaEdgeLabels: string[]
}

export function GraphFieldsListPanelBody({
  uiPanelKeyValueTextSizeClass,
  iconSizeClass,
  uiIconStrokeWidth,
  graphDataPresent,
  searchOpen,
  setSearchOpen,
  search,
  setSearch,
  newFieldOpen,
  setNewFieldOpen,
  newFieldScope,
  setNewFieldScope,
  newFieldKey,
  setNewFieldKey,
  newFieldType,
  setNewFieldType,
  createNewField,
  visibleGraphFieldColumnCount,
  orderedAllCuratorColumnKeys,
  filteredGraphFieldColumnKeys,
  curatorColumnLabelByKey,
  isCuratorColumnVisible,
  setCuratorColumnVisibility,
  moveCuratorColumn,
  draggingCuratorColumnKey,
  setDraggingCuratorColumnKey,
  dragOverCuratorColumnKey,
  setDragOverCuratorColumnKey,
  selectedFieldId,
  selectedGlobalView,
  setSelectedGlobalView,
  setSelectedFieldId,
  fieldById,
  resolvedSettingsById,
  settingsById,
  schema,
  schemaDefinedFieldIds,
  styleOwnerByFieldId,
  nodeStyleOwnerKey,
  edgeStyleOwnerKey,
  nodeScopeBorderColor,
  edgeScopeBorderColor,
  updateGraphFieldSettings,
  updateNodeStyle,
  updateEdgeStyle,
  localSchemaNodeTypes,
  localSchemaEdgeLabels,
}: GraphFieldsListPanelBodyProps) {
  const selectGraphField = React.useCallback((id: GraphFieldId | null) => {
    setSelectedFieldId(id)
    if (id) setSelectedGlobalView(null)
  }, [setSelectedFieldId, setSelectedGlobalView])

  return (
    <div className="row-span-2 rounded border border-gray-200 bg-white overflow-hidden flex flex-col min-h-0 min-w-0">
      <div className="h-9 border-b border-gray-200 bg-gray-50 px-2 text-gray-700 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={uiPanelKeyValueTextSizeClass}>{UI_LABELS.graphFields}</div>
        </div>
        <div className="flex items-center gap-1">
          <IconButton
            title={UI_COPY.searchFieldsPlaceholder}
            onClick={() => {
              setSearchOpen(v => {
                const next = !v
                if (!next) setSearch('')
                return next
              })
            }}
            className="App-toolbar__btn"
            showTooltip
          >
            <SearchIcon className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
          </IconButton>
          <div className={`${uiPanelKeyValueTextSizeClass} text-gray-400 whitespace-nowrap`}>
            {UI_COPY.graphFieldsVisibleTotalStatus(
              visibleGraphFieldColumnCount,
              orderedAllCuratorColumnKeys.length,
            )}
          </div>
          <IconButton
            title={UI_LABELS.newField}
            onClick={() => setNewFieldOpen(v => !v)}
            disabled={!graphDataPresent}
            className="App-toolbar__btn"
            showTooltip
          >
            <Plus className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
          </IconButton>
        </div>
      </div>

      {searchOpen ? (
        <div className="border-b border-gray-200 bg-white p-2">
          <div className="h-8 flex items-center gap-2 rounded border border-gray-300 bg-white px-2">
            <SearchIcon
              className={`${iconSizeClass} text-gray-500`}
              strokeWidth={uiIconStrokeWidth}
            />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={UI_COPY.searchFieldsPlaceholder}
              className="h-8 w-full bg-transparent text-xs outline-none"
              autoFocus
            />
          </div>
        </div>
      ) : null}

      {newFieldOpen ? (
        <div className="border-b border-gray-200 bg-white p-2">
          <form
            onSubmit={e => {
              e.preventDefault()
              createNewField()
            }}
            className="space-y-2"
          >
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <div className={`${uiPanelKeyValueTextSizeClass} text-gray-700`}>{UI_LABELS.name}</div>
                <div className="mt-1 flex items-center gap-2 rounded border border-gray-300 bg-white px-2">
                  <FieldKeyIcon
                    className={`${iconSizeClass} text-gray-500`}
                    strokeWidth={uiIconStrokeWidth}
                  />
                  <input
                    value={newFieldKey}
                    onChange={e => setNewFieldKey(e.target.value)}
                    placeholder={UI_COPY.fieldNamePlaceholder}
                    className="h-8 w-full bg-transparent text-xs outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1">
                <div className={`${uiPanelKeyValueTextSizeClass} text-gray-700`}>{UI_LABELS.scope}</div>
                <div className="mt-1">
                  <select
                    value={newFieldScope}
                    onChange={e =>
                      setNewFieldScope(e.target.value === 'edge' ? 'edge' : 'node')
                    }
                    className="h-8 w-full rounded border border-gray-300 bg-white px-2 text-xs"
                  >
                    <option value="node">Node</option>
                    <option value="edge">Edge</option>
                  </select>
                </div>
              </div>
              <div className="flex-1">
                <div className={`${uiPanelKeyValueTextSizeClass} text-gray-700`}>{UI_LABELS.type}</div>
                <div className="mt-1">
                  <select
                    value={newFieldType}
                    onChange={e => setNewFieldType(e.target.value as GraphFieldType)}
                    className="h-8 w-full rounded border border-gray-300 bg-white px-2 text-xs"
                  >
                    {GRAPH_FIELD_TYPES.map(t => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                className={`${uiPanelKeyValueTextSizeClass} rounded border border-gray-200 bg-white px-2 py-1 text-gray-700`}
                onClick={() => setNewFieldOpen(false)}
              >
                {UI_LABELS.cancel}
              </button>
              <button
                type="submit"
                className={`${uiPanelKeyValueTextSizeClass} rounded border border-gray-200 bg-gray-50 px-2 py-1 text-gray-700 disabled:opacity-50`}
                disabled={!graphDataPresent}
              >
                {UI_LABELS.create}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        {(() => {
          const q = normalizeText(search).trim()
          const globalSchemaLabel = UI_LABELS.globalSchema
          const globalSchemaVisible =
            !q ||
            normalizeText(globalSchemaLabel).includes(q) ||
            normalizeText('global:schema').includes(q)

          const localSchemaPropsLabel = 'Local schema · Properties'
          const localSchemaTemplateLabel = 'Local schema · Template'
          const localSchemaValidationLabel = 'Local schema · Validation'
          const localSchemaLocalRulesLabel = 'Local schema · Local rules'

          const localSchemaPropsVisible =
            !q ||
            normalizeText(localSchemaPropsLabel).includes(q) ||
            normalizeText('local:schema:properties').includes(q)
          const localSchemaTemplateVisible =
            !q ||
            normalizeText(localSchemaTemplateLabel).includes(q) ||
            normalizeText('local:schema:template').includes(q)
          const localSchemaValidationVisible =
            !q ||
            normalizeText(localSchemaValidationLabel).includes(q) ||
            normalizeText('local:schema:validation').includes(q)
          const localSchemaLocalRulesVisible =
            !q ||
            normalizeText(localSchemaLocalRulesLabel).includes(q) ||
            normalizeText('local:schema:localRules').includes(q)

          const baseColumnKeys = filteredGraphFieldColumnKeys.filter(
            k => !isGraphDataTablePropertyColumnKey(k),
          )

          const propertyColumnKeys = filteredGraphFieldColumnKeys.filter(
            isGraphDataTablePropertyColumnKey,
          )

          const basePropertyColumnKeys: GraphDataTableColumnKey[] = []
          const customPropertyColumnKeys: GraphDataTableColumnKey[] = []
          const derivedPropertyColumnKeys: GraphDataTableColumnKey[] = []

          for (const key of propertyColumnKeys) {
            const parsed = parseGraphDataTablePropertyColumnKey(key)
            if (!parsed) continue
            const graphFieldId = `${parsed.scope}:${parsed.propertyKey}` as GraphFieldId
            const field = fieldById.get(graphFieldId)
            const isSchemaDefined = field ? schemaDefinedFieldIds.has(field.id) : false
            const rawSettings = settingsById[graphFieldId]
            const isCustom = rawSettings?.isCustom === true
            if (isSchemaDefined) basePropertyColumnKeys.push(key)
            else if (isCustom) customPropertyColumnKeys.push(key)
            else derivedPropertyColumnKeys.push(key)
          }

          const isOnlyVisibleColumn = visibleGraphFieldColumnCount <= 1

          const formatLocalSubtitle = (facet: LocalSchemaFacet): string =>
            formatLocalSchemaSubtitle({
              facet,
              selectedGlobalView,
              selectedFieldId,
              localSchemaNodeTypes,
              localSchemaEdgeLabels,
              schema,
            })

          const renderColumnRow = (key: GraphDataTableColumnKey) => {
            const label = curatorColumnLabelByKey.get(key) ?? key
            const visibleFromTableState = isCuratorColumnVisible(key)
            const parsedProp = isGraphDataTablePropertyColumnKey(key)
              ? parseGraphDataTablePropertyColumnKey(key)
              : null
            const graphFieldId = parsedProp
              ? (`${parsedProp.scope}:${parsedProp.propertyKey}` as GraphFieldId)
              : null
            const field = graphFieldId ? fieldById.get(graphFieldId) : undefined
            const settings = field ? resolvedSettingsById.get(field.id) ?? null : null
            const visible =
              field && settings && isGraphDataTablePropertyColumnKey(key)
                ? !settings.isHidden
                : visibleFromTableState
            const isDragOver = dragOverCuratorColumnKey === key
            const active =
              !!graphFieldId && graphFieldId === selectedFieldId && selectedGlobalView === null

            return (
              <GraphFieldsListRow
                key={key}
                columnKey={key}
                label={String(label)}
                graphFieldId={graphFieldId}
                field={field ?? null}
                settings={settings ?? null}
                settingsById={settingsById}
                schema={schema}
                schemaDefinedFieldIds={schemaDefinedFieldIds}
                styleOwnerByFieldId={styleOwnerByFieldId}
                nodeStyleOwnerKey={nodeStyleOwnerKey}
                edgeStyleOwnerKey={edgeStyleOwnerKey}
                nodeScopeBorderColor={nodeScopeBorderColor}
                edgeScopeBorderColor={edgeScopeBorderColor}
                uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
                iconSizeClass={iconSizeClass}
                uiIconStrokeWidth={uiIconStrokeWidth}
                visible={visible}
                isOnlyVisibleColumn={isOnlyVisibleColumn}
                active={active}
                isDragOver={isDragOver}
                draggingCuratorColumnKey={draggingCuratorColumnKey}
                setSelectedFieldId={selectGraphField}
                setCuratorColumnVisibility={setCuratorColumnVisibility}
                moveCuratorColumn={moveCuratorColumn}
                updateGraphFieldSettings={updateGraphFieldSettings}
                updateNodeStyle={updateNodeStyle}
                updateEdgeStyle={updateEdgeStyle}
                setDraggingCuratorColumnKey={setDraggingCuratorColumnKey}
                setDragOverCuratorColumnKey={setDragOverCuratorColumnKey}
              />
            )
          }

          const sectionHeaderClass = `mt-2 border-t border-gray-200 px-2 pt-1 ${uiPanelKeyValueTextSizeClass} font-medium tracking-wide text-gray-400`

          const hasAnyRows =
            globalSchemaVisible ||
            baseColumnKeys.length > 0 ||
            basePropertyColumnKeys.length > 0 ||
            localSchemaPropsVisible ||
            customPropertyColumnKeys.length > 0 ||
            localSchemaTemplateVisible ||
            derivedPropertyColumnKeys.length > 0 ||
            localSchemaLocalRulesVisible ||
            localSchemaValidationVisible

          if (!hasAnyRows) {
            return (
              <div className={`p-2 ${uiPanelKeyValueTextSizeClass} text-gray-500`}>
                {UI_COPY.noFields}
              </div>
            )
          }

          const localSchemaButtonClassName = (active: boolean) =>
            [
              'w-full border-b border-gray-100 last:border-b-0 px-2 py-1.5',
              'flex items-center gap-2 border-l-2',
              active ? 'bg-blue-50' : 'bg-white hover:bg-gray-50',
              'min-w-0 overflow-hidden text-left',
            ].join(' ')

          const onSelectLocalSchemaFacet = (
            facet: LocalSchemaFacet,
            category: 'base' | 'custom' | 'derived' | 'global',
          ) => {
            const target = resolveLocalSchemaTarget({
              facet,
              selectedGlobalView,
              selectedFieldId,
              localSchemaNodeTypes,
              localSchemaEdgeLabels,
              schema,
            })
            setSelectedGlobalView({
              kind: 'localSchema',
              facet,
              category,
              scope: target.scope,
              ownerKey: target.ownerKey,
            })
            setSelectedFieldId(null)
          }

          return (
            <>
              {globalSchemaVisible ? (
                <>
                  <div className={sectionHeaderClass}>{UI_LABELS.globalFields}</div>
                  <button
                    type="button"
                    className={localSchemaButtonClassName(
                      selectedGlobalView?.kind === 'globalSchema',
                    )}
                    style={{ borderLeftColor: '#93C5FD' }}
                    onClick={() => {
                      setSelectedGlobalView({ kind: 'globalSchema' })
                      setSelectedFieldId(null)
                    }}
                  >
                    <GraphFieldsIcon className={`${iconSizeClass} text-gray-500`} aria-hidden={true} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 min-w-0 text-xs text-gray-800 truncate">
                        <span className="truncate">{globalSchemaLabel}</span>
                      </div>
                      <div className={`${uiPanelKeyValueTextSizeClass} text-gray-500 truncate`}>
                        global:schema
                      </div>
                    </div>
                  </button>
                  {localSchemaValidationVisible ? (
                    <button
                      type="button"
                      className={localSchemaButtonClassName(
                        selectedGlobalView?.kind === 'localSchema' &&
                          selectedGlobalView.facet === 'validation',
                      )}
                      style={{ borderLeftColor: '#93C5FD' }}
                      onClick={() => onSelectLocalSchemaFacet('validation', 'global')}
                    >
                      <GraphFieldsIcon className={`${iconSizeClass} text-gray-500`} aria-hidden={true} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 min-w-0 text-xs text-gray-800 truncate">
                          <span className="truncate">{localSchemaValidationLabel}</span>
                        </div>
                        <div className={`${uiPanelKeyValueTextSizeClass} text-gray-500 truncate`}>
                          {formatLocalSubtitle('validation')}
                        </div>
                      </div>
                    </button>
                  ) : null}
                </>
              ) : null}

              {baseColumnKeys.length > 0 || basePropertyColumnKeys.length > 0 ? (
                <>
                  <div className={sectionHeaderClass}>{UI_LABELS.baseFields}</div>
                  {localSchemaPropsVisible ? (
                    <button
                      type="button"
                      className={localSchemaButtonClassName(
                        selectedGlobalView?.kind === 'localSchema' &&
                          selectedGlobalView.facet === 'properties',
                      )}
                      style={{ borderLeftColor: '#93C5FD' }}
                      onClick={() => onSelectLocalSchemaFacet('properties', 'base')}
                    >
                      <GraphFieldsIcon className={`${iconSizeClass} text-gray-500`} aria-hidden={true} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 min-w-0 text-xs text-gray-800 truncate">
                          <span className="truncate">{localSchemaPropsLabel}</span>
                        </div>
                        <div className={`${uiPanelKeyValueTextSizeClass} text-gray-500 truncate`}>
                          {formatLocalSubtitle('properties')}
                        </div>
                      </div>
                    </button>
                  ) : null}
                  {baseColumnKeys.map(renderColumnRow)}
                  {basePropertyColumnKeys.map(renderColumnRow)}
                </>
              ) : null}

              {customPropertyColumnKeys.length > 0 ? (
                <>
                  <div className={sectionHeaderClass}>{UI_LABELS.customFields}</div>
                  {localSchemaTemplateVisible ? (
                    <button
                      type="button"
                      className={localSchemaButtonClassName(
                        selectedGlobalView?.kind === 'localSchema' &&
                          selectedGlobalView.facet === 'template',
                      )}
                      style={{ borderLeftColor: '#93C5FD' }}
                      onClick={() => onSelectLocalSchemaFacet('template', 'custom')}
                    >
                      <GraphFieldsIcon className={`${iconSizeClass} text-gray-500`} aria-hidden={true} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 min-w-0 text-xs text-gray-800 truncate">
                          <span className="truncate">{localSchemaTemplateLabel}</span>
                        </div>
                        <div className={`${uiPanelKeyValueTextSizeClass} text-gray-500 truncate`}>
                          {formatLocalSubtitle('template')}
                        </div>
                      </div>
                    </button>
                  ) : null}
                  {customPropertyColumnKeys.map(renderColumnRow)}
                </>
              ) : null}

              {derivedPropertyColumnKeys.length > 0 ? (
                <>
                  <div className={sectionHeaderClass}>{UI_LABELS.derivedFields}</div>
                  {localSchemaLocalRulesVisible ? (
                    <button
                      type="button"
                      className={localSchemaButtonClassName(
                        selectedGlobalView?.kind === 'localSchema' &&
                          selectedGlobalView.facet === 'localRules',
                      )}
                      style={{ borderLeftColor: '#93C5FD' }}
                      onClick={() => onSelectLocalSchemaFacet('localRules', 'derived')}
                    >
                      <GraphFieldsIcon className={`${iconSizeClass} text-gray-500`} aria-hidden={true} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 min-w-0 text-xs text-gray-800 truncate">
                          <span className="truncate">{localSchemaLocalRulesLabel}</span>
                        </div>
                        <div className={`${uiPanelKeyValueTextSizeClass} text-gray-500 truncate`}>
                          {formatLocalSubtitle('localRules')}
                        </div>
                      </div>
                    </button>
                  ) : null}
                  {derivedPropertyColumnKeys.map(renderColumnRow)}
                </>
              ) : null}
            </>
          )
        })()}
      </div>
    </div>
  )
}
