import React from 'react'
import {
  DUCKDB_SQL_FIELD_TOOLTIP,
  DUCKDB_QUERY_PRESETS_TOOLTIP,
  DUCKDB_QUERY_PRESET_ID_TOOLTIP,
  DUCKDB_QUERY_PRESET_DESCRIPTION_TOOLTIP,
  UI_COPY,
} from '@/lib/config'
import type { DuckDbQueryConfig } from '@/features/panels/utils/graphragConfig'
import { TraversalPresetSection } from '@/features/panels/views/RenderPresetSection'
import { OrchestratorTraversalSectionContent } from '@/features/panels/views/OrchestratorTraversalSection'
import { buildOrchestratorTraversalSectionViewModel } from '@/features/panels/views/OrchestratorTraversalSectionModel'
import type { GraphRagPathHelper } from '@/features/panels/views/OrchestratorTraversalPanelsModel'
import { KeyTypeValueRow } from '@/features/panels/ui/KeyTypeValueRow'
import Tooltip from '@/features/panels/ui/Tooltip'
import { useGraphStore } from '@/hooks/useGraphStore'
import { MonacoTextEditor } from '@/features/monaco/MonacoTextEditor'

type DuckDbQueryPresetDirectionMode = {
  id: string
  label: string
  buildSql: () => string
}

type DuckDbQueryPreset = DuckDbQueryConfig & {
  directionModes?: DuckDbQueryPresetDirectionMode[]
}

interface OrchestratorTraversalPresetsSectionProps {
  runGraphRagTraversal: () => void
  traversalStartNodeId: string
  setTraversalStartNodeId: (value: string) => void
  traversalMaxDepth: number
  setTraversalMaxDepth: (value: number) => void
  traversalLabelFilter: string
  setTraversalLabelFilter: (value: string) => void
  runGenericTraversalQuery: () => void
  selectedNodeId: string | null
  graphRagPathHelper: GraphRagPathHelper | null
  graphNodesById: Record<string, { label: string }>
  selectNode: (id: string | null) => void
  duckdbQueriesFromConfig?: DuckDbQueryConfig[]
}

interface GraphRagPathTraverseHelperSectionProps {
  runGraphRagTraversal: () => void
  graphRagPathHelper: GraphRagPathHelper | null
  graphNodesById: Record<string, { label: string }>
  selectNode: (id: string | null) => void
  setTraversalStartNodeId: (value: string) => void
  setTraversalLabelFilter: (value: string) => void
  setTraversalMaxDepth: (value: number) => void
  runGenericTraversalQuery: () => void
  uiPanelKeyValueTextSizeClass: string
  uiPanelTextFontClass: string
}

function GraphRagPathTraverseHelperSection({
  runGraphRagTraversal,
  graphRagPathHelper,
  graphNodesById,
  selectNode,
  setTraversalStartNodeId,
  setTraversalLabelFilter,
  setTraversalMaxDepth,
  runGenericTraversalQuery,
  uiPanelKeyValueTextSizeClass,
  uiPanelTextFontClass,
}: GraphRagPathTraverseHelperSectionProps) {
  if (!graphRagPathHelper) return null

  return (
    <div className="mb-2 border border-gray-200 rounded px-2 py-1">
      <div
        className={[
          'font-semibold uppercase tracking-wide text-gray-500 mb-1',
          uiPanelKeyValueTextSizeClass,
          uiPanelTextFontClass,
        ].join(' ')}
      >
        {UI_COPY.orchestratorGraphRagPathTraverseHelperTitle}
      </div>
      <div className="space-y-1">
        <KeyTypeValueRow
          layout="keyIconValue"
          keyNode={(
            <span className="text-gray-500 break-words">{UI_COPY.orchestratorControlsLabel}</span>
          )}
          typeNode={null}
          valueNode={(
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                className={[
                  'App-toolbar__btn bg-gray-100 text-gray-700',
                  uiPanelKeyValueTextSizeClass,
                  uiPanelTextFontClass,
                ].join(' ')}
                onClick={runGraphRagTraversal}
              >
                {UI_COPY.orchestratorPlayPathButtonLabel}
              </button>
              <Tooltip
                content="Preset optimized for inspecting a single path via traversal."
                maxWidthPx={260}
                contentClassName="bg-gray-800/90"
              >
                <button
                  type="button"
                  className={[
                    'App-toolbar__btn bg-gray-100 text-gray-700',
                    uiPanelKeyValueTextSizeClass,
                    uiPanelTextFontClass,
                  ].join(' ')}
                  onClick={() => {
                    const ownerId = graphRagPathHelper.ownerNodeId
                    if (!ownerId) return
                    selectNode(ownerId)
                    setTraversalStartNodeId(ownerId)
                    setTraversalLabelFilter(
                      'imports,contains,calls,hasRuntimeEvent,runtimeOf',
                    )
                    setTraversalMaxDepth(4)
                    runGenericTraversalQuery()
                  }}
                >
                  {UI_COPY.orchestratorPlayGraphRagTraversalButtonLabel}
                </button>
              </Tooltip>
            </div>
          )}
        />
        <KeyTypeValueRow
          density="compact"
          layout="keyIconValue"
          keyNode={(
            <span className="text-gray-500 break-words">{UI_COPY.orchestratorSequenceLabel}</span>
          )}
          typeNode={null}
          valueNode={(
            <div
              className={[
                'flex flex-wrap gap-1 text-gray-700',
                uiPanelKeyValueTextSizeClass,
                uiPanelTextFontClass,
              ].join(' ')}
            >
              {[graphRagPathHelper.ownerNodeId, ...graphRagPathHelper.traverse].map(
                (nodeId, index) => {
                  const node = graphNodesById[String(nodeId)]
                  const label = node ? node.label : String(nodeId)
                  return (
                    <button
                      key={`${nodeId}-${index}`}
                      type="button"
                      className="px-1.5 py-[1px] border border-gray-300 rounded bg-white"
                      onClick={() => selectNode(String(nodeId))}
                    >
                      {label}
                    </button>
                  )
                },
              )}
            </div>
          )}
          align="start"
        />
      </div>
    </div>
  )
}

interface DuckDbQueryPresetsSectionProps {
  presets: DuckDbQueryPreset[]
  activePresetId: string
  setActivePresetId: (value: string) => void
  editableSqlById: Record<string, string>
  setEditableSqlById: (updater: (prev: Record<string, string>) => Record<string, string>) => void
  directionModeByPresetId: Record<string, string>
  setDirectionModeByPresetId: (
    updater: (prev: Record<string, string>) => Record<string, string>,
  ) => void
  setTraversalStartNodeId: (value: string) => void
  setTraversalLabelFilter: (value: string) => void
  setTraversalMaxDepth: (value: number) => void
  uiPanelMonospaceTextClass: string
  uiPanelKeyValueTextSizeClass: string
  uiPanelTextFontClass: string
}

function DuckDbQueryPresetsSection({
  presets,
  activePresetId,
  setActivePresetId,
  editableSqlById,
  setEditableSqlById,
  directionModeByPresetId,
  setDirectionModeByPresetId,
  setTraversalStartNodeId,
  setTraversalLabelFilter,
  setTraversalMaxDepth,
  uiPanelMonospaceTextClass,
  uiPanelKeyValueTextSizeClass,
  uiPanelTextFontClass,
}: DuckDbQueryPresetsSectionProps) {
  const activePreset = presets.find(preset => preset.id === activePresetId) || null
  if (!activePreset) return null

  return (
    <div className="mb-2 border border-gray-200 rounded px-2 py-1">
      <div
        className={[
          'font-semibold uppercase tracking-wide text-gray-500 mb-1',
          uiPanelKeyValueTextSizeClass,
          uiPanelTextFontClass,
        ].join(' ')}
      >
        <Tooltip
          content={DUCKDB_QUERY_PRESETS_TOOLTIP}
          maxWidthPx={260}
          contentClassName="bg-gray-800/90"
        >
          <span>{UI_COPY.orchestratorDuckDbQueryPresetsTitle}</span>
        </Tooltip>
      </div>
      <div className="space-y-1">
        <KeyTypeValueRow
          layout="keyIconValue"
          keyNode={(
            <Tooltip
              content={DUCKDB_QUERY_PRESET_ID_TOOLTIP}
              maxWidthPx={260}
              contentClassName="bg-gray-800/90"
              className="break-words text-gray-500"
            >
              duckdbQueries[].id
            </Tooltip>
          )}
          typeNode={null}
          valueNode={(
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-1 w-full">
              <div className="flex items-center gap-1 w-full sm:w-auto">
                <Tooltip
                  content={UI_COPY.orchestratorDuckDbPresetSelectTooltip}
                  maxWidthPx={260}
                  contentClassName="bg-gray-800/90"
                  className="w-full sm:w-auto"
                >
                  <select
                    className={[
                      'border border-gray-300 rounded px-1 py-[1px] w-full sm:w-auto',
                      uiPanelKeyValueTextSizeClass,
                      uiPanelTextFontClass,
                    ].join(' ')}
                    value={activePresetId}
                    onChange={e => setActivePresetId(e.target.value)}
                  >
                    {presets.map(preset => (
                      <option key={preset.id} value={preset.id}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </Tooltip>
                {activePreset.suggestedStartNodeId && (
                  <button
                    type="button"
                    className={[
                      'App-toolbar__btn bg-gray-100 text-gray-700',
                      uiPanelKeyValueTextSizeClass,
                      uiPanelTextFontClass,
                    ].join(' ')}
                    onClick={() => {
                      setTraversalStartNodeId(activePreset.suggestedStartNodeId || '')
                      setTraversalLabelFilter('calls')
                      setTraversalMaxDepth(4)
                    }}
                  >
                    {UI_COPY.orchestratorDuckDbSeedTraversalButtonLabel}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1 w-full sm:w-auto">
                <button
                  type="button"
                  className={[
                    'App-toolbar__btn bg-gray-100 text-gray-700',
                    uiPanelKeyValueTextSizeClass,
                    uiPanelTextFontClass,
                  ].join(' ')}
                  onClick={() => {
                    const text = editableSqlById[activePresetId] || activePreset.sql
                    if (
                      navigator &&
                      navigator.clipboard &&
                      typeof navigator.clipboard.writeText === 'function'
                    ) {
                      navigator.clipboard.writeText(text).catch(() => {})
                    }
                  }}
                >
                  {UI_COPY.orchestratorDuckDbCopySqlButtonLabel}
                </button>
                {activePreset.directionModes && activePreset.directionModes.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    <span
                      className={[
                        'text-gray-500',
                        uiPanelKeyValueTextSizeClass,
                        uiPanelTextFontClass,
                      ].join(' ')}
                    >
                      {UI_COPY.orchestratorDuckDbDirectionLabel}
                    </span>
                    {activePreset.directionModes.map(mode => {
                      const currentModeId =
                        directionModeByPresetId[activePreset.id] ||
                        activePreset.directionModes?.[0]?.id ||
                        ''
                      const isActive = currentModeId === mode.id
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          className={[
                            'App-toolbar__btn',
                            isActive ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700',
                            uiPanelKeyValueTextSizeClass,
                            uiPanelTextFontClass,
                          ].join(' ')}
                          onClick={() => {
                            setDirectionModeByPresetId(prev => ({
                              ...prev,
                              [activePreset.id]: mode.id,
                            }))
                            setEditableSqlById(prev => ({
                              ...prev,
                              [activePreset.id]: mode.buildSql(),
                            }))
                          }}
                        >
                          {mode.label}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        />
        <KeyTypeValueRow
          layout="keyIconValue"
          keyNode={(
            <Tooltip
              content={DUCKDB_QUERY_PRESET_DESCRIPTION_TOOLTIP}
              maxWidthPx={260}
              contentClassName="bg-gray-800/90"
              className="text-gray-500"
            >
              duckdbQueries[].description
            </Tooltip>
          )}
          typeNode={null}
          valueNode={(
            <Tooltip
              content={UI_COPY.orchestratorDuckDbDescriptionValueTooltip}
              maxWidthPx={260}
              contentClassName="bg-gray-800/90"
            >
              <div
                className={[
                  'text-gray-600',
                  uiPanelKeyValueTextSizeClass,
                  uiPanelTextFontClass,
                ].join(' ')}
              >
                {activePreset.description}
              </div>
            </Tooltip>
          )}
          align="start"
        />
        <KeyTypeValueRow
          layout="keyIconValue"
          keyNode={(
            <Tooltip
              content={DUCKDB_SQL_FIELD_TOOLTIP}
              maxWidthPx={260}
              contentClassName="bg-gray-800/90"
              className="text-gray-500"
            >
              duckdbQueries[].sql
            </Tooltip>
          )}
          typeNode={null}
          valueNode={(
            <Tooltip
              content={UI_COPY.orchestratorDuckDbSqlValueTooltip}
              maxWidthPx={260}
              contentClassName="bg-gray-800/90"
              className="w-full"
            >
              <div className="w-full border border-gray-300 rounded overflow-hidden min-h-[96px] bg-white">
                <MonacoTextEditor
                  value={editableSqlById[activePresetId] || activePreset.sql}
                  onChange={(value) => {
                    setEditableSqlById(prev => ({
                      ...prev,
                      [activePresetId]: value,
                    }))
                  }}
                  language="sql"
                  uri={`inmemory://duckdb/sql/${encodeURIComponent(activePresetId)}`}
                  themeMode="light"
                  wordWrap={false}
                  className={`w-full h-full ${uiPanelMonospaceTextClass}`}
                />
              </div>
            </Tooltip>
          )}
          align="start"
        />
      </div>
    </div>
  )
}

export function OrchestratorTraversalPresetsSection({
  runGraphRagTraversal,
  traversalStartNodeId,
  setTraversalStartNodeId,
  traversalMaxDepth,
  setTraversalMaxDepth,
  traversalLabelFilter,
  setTraversalLabelFilter,
  runGenericTraversalQuery,
  selectedNodeId,
  graphRagPathHelper,
  graphNodesById,
  selectNode,
  duckdbQueriesFromConfig,
}: OrchestratorTraversalPresetsSectionProps) {
  const uiPanelMonospaceTextClass = useGraphStore(
    s => s.uiPanelMonospaceTextClass || 'font-mono text-xs',
  )
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-sm',
  )
  const uiPanelTextFontClass = useGraphStore(
    s => s.uiPanelTextFontClass || 'font-sans',
  )
  const presets: DuckDbQueryPreset[] = React.useMemo(() => {
    const list: DuckDbQueryPreset[] = []
    if (Array.isArray(duckdbQueriesFromConfig) && duckdbQueriesFromConfig.length > 0) {
      duckdbQueriesFromConfig.forEach((item) => {
        if (!item) return
        const id = typeof item.id === 'string' ? item.id.trim() : ''
        const label = typeof item.label === 'string' ? item.label.trim() : ''
        const sql = typeof item.sql === 'string' ? item.sql : ''
        if (!id || !label || !sql.trim()) return
        const preset: DuckDbQueryPreset = {
          id,
          label,
          sql,
          description: item.description,
          suggestedStartNodeId: item.suggestedStartNodeId,
        }
        list.push(preset)
      })
    }
    return list
  }, [duckdbQueriesFromConfig])

  const [activePresetId, setActivePresetId] = React.useState<string>(
    presets[0]?.id ?? '',
  )
  const [editableSqlById, setEditableSqlById] = React.useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    presets.forEach(preset => {
      initial[preset.id] = preset.sql
    })
    return initial
  })
  const [directionModeByPresetId, setDirectionModeByPresetId] = React.useState<Record<string, string>>(
    {},
  )

  React.useEffect(() => {
    if (!presets.length) {
      setActivePresetId('')
      setEditableSqlById({})
      setDirectionModeByPresetId({})
      return
    }
    const nextId = presets[0].id
    setActivePresetId(nextId)
    const initial: Record<string, string> = {}
    presets.forEach(preset => {
      initial[preset.id] = preset.sql
    })
    setEditableSqlById(initial)
    setDirectionModeByPresetId({})
  }, [presets])

  return (
    <>
      <TraversalPresetSection
        runGraphRagTraversal={runGraphRagTraversal}
        traversalStartNodeId={traversalStartNodeId}
        setTraversalStartNodeId={setTraversalStartNodeId}
        traversalMaxDepth={traversalMaxDepth}
        setTraversalMaxDepth={setTraversalMaxDepth}
        traversalLabelFilter={traversalLabelFilter}
        setTraversalLabelFilter={setTraversalLabelFilter}
        runTraversalQuery={runGenericTraversalQuery}
        selectedNodeId={selectedNodeId}
      />
      <GraphRagPathTraverseHelperSection
        runGraphRagTraversal={runGraphRagTraversal}
        graphRagPathHelper={graphRagPathHelper}
        graphNodesById={graphNodesById}
        selectNode={selectNode}
        setTraversalStartNodeId={setTraversalStartNodeId}
        setTraversalLabelFilter={setTraversalLabelFilter}
        setTraversalMaxDepth={setTraversalMaxDepth}
        runGenericTraversalQuery={runGenericTraversalQuery}
        uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
        uiPanelTextFontClass={uiPanelTextFontClass}
      />
      <DuckDbQueryPresetsSection
        presets={presets}
        activePresetId={activePresetId}
        setActivePresetId={setActivePresetId}
        editableSqlById={editableSqlById}
        setEditableSqlById={setEditableSqlById}
        directionModeByPresetId={directionModeByPresetId}
        setDirectionModeByPresetId={setDirectionModeByPresetId}
        setTraversalStartNodeId={setTraversalStartNodeId}
        setTraversalLabelFilter={setTraversalLabelFilter}
        setTraversalMaxDepth={setTraversalMaxDepth}
        uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
        uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
        uiPanelTextFontClass={uiPanelTextFontClass}
      />
    </>
  )
}

interface OrchestratorTraversalAndLayersSectionProps {
  traversalViewModel: ReturnType<typeof buildOrchestratorTraversalSectionViewModel>
}

export function OrchestratorTraversalAndLayersSection({
  traversalViewModel,
}: OrchestratorTraversalAndLayersSectionProps) {
  return (
    <>
      <OrchestratorTraversalSectionContent viewModel={traversalViewModel} />
    </>
  )
}
