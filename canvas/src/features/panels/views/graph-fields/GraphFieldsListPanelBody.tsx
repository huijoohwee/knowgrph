import React from 'react'
import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphFieldsSelectedView } from '@/features/panels/views/GraphFieldsView'
import { type GraphField, type GraphFieldId, type GraphFieldSettingsById, type GraphFieldSettingsResolved, type GraphFieldType } from '@/features/graph-fields/graphFields'
import type { GraphDataTableColumnKey } from '@/features/graph-data-table/graphDataTable'
import {
  isGraphDataTablePropertyColumnKey,
  parseGraphDataTablePropertyColumnKey,
} from '@/features/graph-data-table/graphDataTable'
import {
  GraphFieldsIcon,
  SearchIcon,
} from '@/features/graph-fields/ui/graphFieldIcons'
import { UI_COPY, UI_LABELS, SCHEMA_KEYS } from '@/lib/config'
import IconButton from '@/components/IconButton'
import { Plus } from 'lucide-react'
import { GraphFieldsListRow } from '@/features/panels/views/graph-fields/GraphFieldsListRow'
import {
  formatLocalSchemaSubtitle,
  resolveLocalSchemaTarget,
  type LocalSchemaFacet,
} from '@/features/panels/views/graph-fields/graphFieldsListUtils'
import { NewFieldForm } from './NewFieldForm'
import { useGraphFieldsFiltering } from '@/features/panels/views/graph-fields/hooks/useGraphFieldsFiltering'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

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

  const {
    globalSchemaVisible,
    localSchemaPropsVisible,
    localSchemaTemplateVisible,
    localSchemaValidationVisible,
    localSchemaLocalRulesVisible,
    baseColumnKeys,
    basePropertyColumnKeys,
    customPropertyColumnKeys,
    derivedPropertyColumnKeys,
    globalSchemaLabel,
    localSchemaPropsLabel,
    localSchemaTemplateLabel,
    localSchemaValidationLabel,
    localSchemaLocalRulesLabel,
  } = useGraphFieldsFiltering({
    search,
    filteredGraphFieldColumnKeys,
    fieldById,
    schemaDefinedFieldIds,
    settingsById,
  })

  return (
    <div className={`row-span-2 rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} overflow-hidden flex flex-col min-h-0 min-w-0`}>
      <div className={`h-9 border-b ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.headerBg} px-2 ${UI_THEME_TOKENS.text.primary} flex items-center justify-between gap-2`}>
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
          <div className={`${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.tertiary} whitespace-nowrap`}>
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
        <div className={`border-b ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} p-2`}>
          <div className={`h-8 flex items-center gap-2 rounded border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.panel.bg} px-2`}>
            <SearchIcon
              className={`${iconSizeClass} ${UI_THEME_TOKENS.text.tertiary}`}
              strokeWidth={uiIconStrokeWidth}
            />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={UI_COPY.searchFieldsPlaceholder}
              className={`h-8 w-full bg-transparent text-xs outline-none ${UI_THEME_TOKENS.text.primary}`}
              autoFocus
            />
          </div>
        </div>
      ) : null}

      {newFieldOpen ? (
        <NewFieldForm
          newFieldKey={newFieldKey}
          setNewFieldKey={setNewFieldKey}
          newFieldScope={newFieldScope}
          setNewFieldScope={setNewFieldScope}
          newFieldType={newFieldType}
          setNewFieldType={setNewFieldType}
          createNewField={createNewField}
          setNewFieldOpen={setNewFieldOpen}
          graphDataPresent={graphDataPresent}
          uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
          iconSizeClass={iconSizeClass}
          uiIconStrokeWidth={uiIconStrokeWidth}
        />
      ) : null}

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        {(() => {
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

          const sectionHeaderClass = `mt-2 border-t ${UI_THEME_TOKENS.panel.border} px-2 pt-1 ${uiPanelKeyValueTextSizeClass} font-medium tracking-wide ${UI_THEME_TOKENS.text.tertiary}`

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
              <div className={`p-2 ${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.secondary}`}>
                {UI_COPY.noFields}
              </div>
            )
          }

          const localSchemaButtonClassName = (active: boolean) =>
            [
              `w-full border-b ${UI_THEME_TOKENS.panel.divider} last:border-b-0 px-2 py-1.5`,
              'flex items-center gap-2 border-l-2',
              active ? UI_THEME_TOKENS.table.rowSelected : `${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.table.rowHover}`,
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
                    <GraphFieldsIcon className={`${iconSizeClass} ${UI_THEME_TOKENS.text.tertiary}`} aria-hidden={true} />
                    <div className="min-w-0 flex-1">
                      <div className={`flex items-center gap-1 min-w-0 text-xs ${UI_THEME_TOKENS.text.primary} truncate`}>
                        <span className="truncate">{globalSchemaLabel}</span>
                      </div>
                      <div className={`${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.tertiary} truncate`}>
                        {SCHEMA_KEYS.globalSchema}
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
                      <GraphFieldsIcon className={`${iconSizeClass} ${UI_THEME_TOKENS.text.tertiary}`} aria-hidden={true} />
                      <div className="min-w-0 flex-1">
                        <div className={`flex items-center gap-1 min-w-0 text-xs ${UI_THEME_TOKENS.text.primary} truncate`}>
                          <span className="truncate">{localSchemaValidationLabel}</span>
                        </div>
                        <div className={`${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.tertiary} truncate`}>
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
                      <GraphFieldsIcon className={`${iconSizeClass} ${UI_THEME_TOKENS.text.tertiary}`} aria-hidden={true} />
                      <div className="min-w-0 flex-1">
                        <div className={`flex items-center gap-1 min-w-0 text-xs ${UI_THEME_TOKENS.text.primary} truncate`}>
                          <span className="truncate">{localSchemaPropsLabel}</span>
                        </div>
                        <div className={`${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.tertiary} truncate`}>
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
                      <GraphFieldsIcon className={`${iconSizeClass} ${UI_THEME_TOKENS.text.tertiary}`} aria-hidden={true} />
                      <div className="min-w-0 flex-1">
                        <div className={`flex items-center gap-1 min-w-0 text-xs ${UI_THEME_TOKENS.text.primary} truncate`}>
                          <span className="truncate">{localSchemaTemplateLabel}</span>
                        </div>
                        <div className={`${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.tertiary} truncate`}>
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
                      <GraphFieldsIcon className={`${iconSizeClass} ${UI_THEME_TOKENS.text.tertiary}`} aria-hidden={true} />
                      <div className="min-w-0 flex-1">
                        <div className={`flex items-center gap-1 min-w-0 text-xs ${UI_THEME_TOKENS.text.primary} truncate`}>
                          <span className="truncate">{localSchemaLocalRulesLabel}</span>
                        </div>
                        <div className={`${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.tertiary} truncate`}>
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
