import React from 'react'
import { runMarkdownPipelineWithStatus } from '@/features/panels/hooks/workflowJsonLdActions'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import Tooltip from '@/features/panels/ui/Tooltip'
import { KeyTypeValueRow, RightAlignedValueCell } from '@/features/panels/ui/KeyTypeValueRow'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphBehavior, GraphSchema } from '@/lib/graph/schema'
import type { GraphData } from '@/lib/graph/types'
import { RUN_CODEBASE_INDEX_PIPELINE_LABEL } from '@/lib/config'
import { RENDER_PANEL_SECTION_COPY } from '@/features/panels/config'
import RenderPresetSection from '@/features/panels/views/RenderPresetSection'
import ThreeViewTuningSection from '@/features/panels/views/ThreeViewTuningSection'
import RenderTidyTreeSettingsRows, { type TidyTreeLod } from '@/features/panels/views/RenderTidyTreeSettingsRows'

type GraphSelectMode = NonNullable<GraphBehavior['selectMode']>
type GraphCreateMode = NonNullable<GraphBehavior['createMode']>
type PerformanceLod = NonNullable<NonNullable<GraphSchema['performance']>['lod']>

interface ThreeGroupsCollapsed {
  links: boolean
  layout: boolean
  backgroundFog: boolean
  starfield: boolean
  camera: boolean
  selection: boolean
}

interface RenderSettingsSectionProps {
  threeGroupsCollapsed?: ThreeGroupsCollapsed
  onToggleThreeGroup?: (group: keyof ThreeGroupsCollapsed, next: boolean) => void
  presetsCollapsed?: boolean
  onTogglePresets?: (next: boolean) => void
  codebaseIndexCollapsed?: boolean
  onToggleCodebaseIndex?: (next: boolean) => void
}

export default function RenderSettingsSection({
  threeGroupsCollapsed,
  onToggleThreeGroup,
  presetsCollapsed,
  onTogglePresets,
  codebaseIndexCollapsed,
  onToggleCodebaseIndex,
}: RenderSettingsSectionProps) {
  const schema = useGraphStore(s => s.schema) as GraphSchema
  const setSchema = useGraphStore(s => s.setSchema)
  const canvasRenderMode = useGraphStore(s => s.canvasRenderMode)
  const setCanvasRenderMode = useGraphStore(s => s.setCanvasRenderMode)
  const setThreeConfig = useGraphStore(s => s.setThreeConfig)
  const setCharge = useGraphStore(s => s.setCharge)
  const setCollisionByType = useGraphStore(s => s.setCollisionByType)
  const updateNodeStyle = useGraphStore(s => s.updateNodeStyle)
  const updateEdgeStyle = useGraphStore(s => s.updateEdgeStyle)
  const setEdgeArrow = useGraphStore(s => s.setEdgeArrow)
  const setSelectMode = useGraphStore(s => s.setSelectMode)
  const setCreateMode = useGraphStore(s => s.setCreateMode)
  const data = useGraphStore(s => s.graphData)

  const [pipelineStatus, setPipelineStatus] = React.useState<string | null>(null)
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-xs',
  )
  const uiPanelTextFontClass = useGraphStore(
    s => s.uiPanelTextFontClass || 'font-sans',
  )
  const uiPanelMicroLabelTextSizeClass = useGraphStore(
    s => s.uiPanelMicroLabelTextSizeClass || 'text-xs',
  )
  const uiPanelKeyValueInputClass = useGraphStore(
    s =>
      s.uiPanelKeyValueInputClass
      || 'w-full h-6 px-2 text-xs border border-gray-300 rounded text-right',
  )
  const uiPanelMonospaceTextClass = useGraphStore(
    s => s.uiPanelMonospaceTextClass || 'font-mono text-xs',
  )

  const layoutMode: NonNullable<NonNullable<GraphSchema['layout']>['mode']> =
    schema.layout?.mode === 'radial' || schema.layout?.mode === 'tidy-tree' ? schema.layout.mode : 'force'
  const layers = schema.layers || {}
  const layerMode: 'property' | 'document-structure' | 'semantic' =
    layers.mode === 'document-structure' || layers.mode === 'semantic' ? layers.mode : 'property'
  const tidyTreeCfg = schema.layout?.tidyTree || {}
  const tidyTreeLod = (schema.performance?.lod?.tidyTree || {}) as TidyTreeLod
  const tidyEdgeLabelsText = React.useMemo(() => (tidyTreeCfg.edgeLabels || []).join(', '), [tidyTreeCfg.edgeLabels])
  const tidyEdgeLabelSuggestion = React.useMemo(() => {
    const graph = data as GraphData | null
    const edges = Array.isArray(graph?.edges) ? graph!.edges : []
    if (!edges.length) return null
    const counts = new Map<string, number>()
    for (let i = 0; i < edges.length; i += 1) {
      const l = String(edges[i].label ?? '').trim()
      if (!l) continue
      counts.set(l, (counts.get(l) || 0) + 1)
    }
    if (counts.size === 0) return null
    let bestLabel: string | null = null
    let bestCount = -1
    counts.forEach((count, label) => {
      if (count > bestCount) {
        bestLabel = label
        bestCount = count
        return
      }
      if (count === bestCount && bestLabel && label.localeCompare(bestLabel) < 0) {
        bestLabel = label
      }
    })
    return bestLabel ? { label: bestLabel, count: bestCount } : null
  }, [data])

  const setLayoutMode = React.useCallback(
    (mode: NonNullable<NonNullable<GraphSchema['layout']>['mode']>) => {
      const current = schema
      const curLayout = current.layout || {}
      setSchema({ ...current, layout: { ...curLayout, mode } })
    },
    [schema, setSchema],
  )

  const updateTidyTree = React.useCallback(
    (patch: Partial<NonNullable<NonNullable<GraphSchema['layout']>['tidyTree']>>) => {
      const current = schema
      const curLayout = current.layout || {}
      const cur = curLayout.tidyTree || {}
      setSchema({ ...current, layout: { ...curLayout, tidyTree: { ...cur, ...patch } } })
    },
    [schema, setSchema],
  )

  const setHideLabelsBelowScale = React.useCallback(
    (scale: number) => {
      const current = schema
      const curPerformance = current.performance || {}
      const curLod = curPerformance.lod || {}
      const nextScale = Number.isFinite(scale) ? Math.max(0, scale) : 0
      setSchema({
        ...current,
        performance: { ...curPerformance, lod: { ...curLod, hideLabelsBelowScale: nextScale } },
      })
    },
    [schema, setSchema],
  )

  const updateTidyTreeLod = React.useCallback(
    (updater: (cur: TidyTreeLod) => TidyTreeLod | null) => {
      const current = schema
      const curPerformance = current.performance || {}
      const curLod = (curPerformance.lod || {}) as PerformanceLod
      const curTidyTree = (curLod.tidyTree || {}) as TidyTreeLod
      const nextTidyTree = updater(curTidyTree)
      const nextLod: PerformanceLod = {
        ...curLod,
        tidyTree: nextTidyTree ? nextTidyTree : undefined,
      }
      setSchema({ ...current, performance: { ...curPerformance, lod: nextLod } })
    },
    [schema, setSchema],
  )

  const setFitPadding = React.useCallback(
    (value: number) => {
      const current = schema
      const curLayout = current.layout || {}
      const next = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : (curLayout.fitPadding ?? 80)
      setSchema({ ...current, layout: { ...curLayout, fitPadding: next } })
    },
    [schema, setSchema],
  )

  const applyPresentation3dPreset = React.useCallback(() => {
    setCanvasRenderMode('3d')
    setThreeConfig({
      linkOpacity: 0.45,
      linkDirectionalArrowLength: 7,
      linkCurvature: 0.16,
      linkCurveRotation: 0,
      linkDirectionalArrowRelPos: 0.85,
      linkDirectionalParticles: 0,
      linkDirectionalParticleSpeed: 0.4,
      nodeMotionIntensity: 0.15,
      fogColor: '',
      fogNear: 130,
      fogFar: 310,
      cameraDampingFactor: 0.18,
      cameraRotateSpeed: 0.38,
      cameraZoomSpeed: 0.65,
      cameraPanSpeed: 0.45,
      cameraAutoRotate: false,
      cameraAutoRotateSpeed: 0.0,
      selection: {
        selectedNodeGlowIntensity: 1.15,
        dimmedNodeOpacity: 0.32,
        dimmedEdgeOpacity: 0.32,
        selectedEdgeWidth: 2.8,
      },
    })
  }, [setCanvasRenderMode, setThreeConfig])

  const handleRunCodebaseIndexPipeline = React.useCallback(async () => {
    await runMarkdownPipelineWithStatus(setPipelineStatus)
  }, [])

  const schemaBadges = React.useMemo(() => {
    if (!schema || !schema.propertySchemas) return []
    const badges = new Set<string>()
    const nodeProps = schema.propertySchemas.node || {}
    const edgeProps = schema.propertySchemas.edge || {}
    Object.keys(nodeProps).forEach(type => {
      const props = nodeProps[type] || {}
      Object.keys(props).forEach(key => {
        const spec = schema.validation?.node?.[type]
        if (!spec) return
        const isRequired = (spec.required || []).includes(key)
        const isUnique = (spec.uniqueness || []).includes(key)
        if (isRequired) badges.add('required')
        if (isUnique) badges.add('unique')
      })
    })
    Object.keys(edgeProps).forEach(label => {
      const props = edgeProps[label] || {}
      Object.keys(props).forEach(key => {
        const spec = schema.validation?.edge?.[label]
        if (!spec) return
        const isRequired = (spec.required || []).includes(key)
        const isUnique = (spec.uniqueness || []).includes(key)
        if (isRequired) badges.add('required')
        if (isUnique) badges.add('unique')
      })
    })
    const sorted = Array.from(badges)
    sorted.sort()
    return sorted
  }, [schema])

  const renderSectionTitle = React.useCallback(
    (copyKey: keyof typeof RENDER_PANEL_SECTION_COPY) => {
      const copy = RENDER_PANEL_SECTION_COPY[copyKey]
      const titleContent = (
        <div className="flex flex-col">
          <span className="inline-flex items-center gap-2">
            {copy.badge && (
              <span className="text-xs font-semibold text-gray-500">
                {copy.badge}
              </span>
            )}
            <span className="text-xs font-semibold text-gray-800">
              {copy.title}
            </span>
          </span>
          {copy.descriptionShort && (
            <span className={`${uiPanelMicroLabelTextSizeClass} text-gray-600`}>
              {copy.descriptionShort}
            </span>
          )}
        </div>
      )
      if (!copy.tooltip) return titleContent
      return (
        <Tooltip
          content={copy.tooltip}
          maxWidthPx={260}
          contentClassName="bg-gray-800/90"
        >
          {titleContent}
        </Tooltip>
      )
    },
    [uiPanelMicroLabelTextSizeClass],
  )

  return (
    <div>
      {schemaBadges.length > 0 && (
        <div
          className={[
            'mb-2 flex flex-wrap gap-1 text-gray-700',
            uiPanelKeyValueTextSizeClass,
            uiPanelTextFontClass,
          ].join(' ')}
        >
          {schemaBadges.map(badge => (
            <span
              key={badge}
              className="px-[4px] py-[1px] rounded-full border border-gray-300 bg-gray-50"
            >
              {badge === 'required' ? 'R' : badge === 'unique' ? 'U' : badge}
            </span>
          ))}
        </div>
      )}
      <CollapsibleSection
        title={renderSectionTitle('presetsAndTuning')}
        toolbarAligned
        headerClassName="z-20"
        collapsed={presetsCollapsed}
        onToggle={onTogglePresets}
      >
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-700`}>
                Render Mode
              </div>
              <select
                className={uiPanelKeyValueInputClass}
                value={canvasRenderMode}
                onChange={e => setCanvasRenderMode(e.target.value === '3d' ? '3d' : '2d')}
              >
                <option value="2d">2d</option>
                <option value="3d">3d</option>
              </select>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-700`}>
                Selection Mode
              </div>
              <select
                className={uiPanelKeyValueInputClass}
                value={(schema.behavior?.selectMode ?? 'single') as GraphSelectMode}
                onChange={e => {
                  const raw = e.target.value
                  const next: GraphSelectMode =
                    raw === 'multi' || raw === 'lasso' ? (raw as GraphSelectMode) : 'single'
                  setSelectMode(next)
                }}
              >
                <option value="single">single</option>
                <option value="multi">multi</option>
                <option value="lasso">lasso</option>
              </select>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-700`}>
                Create Mode
              </div>
              <select
                className={uiPanelKeyValueInputClass}
                value={(schema.behavior?.createMode ?? 'shift-drag') as GraphCreateMode}
                onChange={e => {
                  const raw = e.target.value
                  const next: GraphCreateMode =
                    raw === 'click-source-target' || raw === 'panel-only'
                      ? (raw as GraphCreateMode)
                      : 'shift-drag'
                  setCreateMode(next)
                }}
              >
                <option value="shift-drag">shift-drag</option>
                <option value="click-source-target">click-source-target</option>
                <option value="panel-only">panel-only</option>
              </select>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-700`}>
                Preset
              </div>
              <button
                type="button"
                className={[
                  'App-toolbar__btn bg-gray-100 text-gray-700',
                  uiPanelKeyValueTextSizeClass,
                  uiPanelTextFontClass,
                ].join(' ')}
                onClick={applyPresentation3dPreset}
              >
                Presentation 3D
              </button>
            </div>
          </div>
          <div className="pt-1">
            <div className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} font-semibold text-gray-700`}>
              2D layout
            </div>
            <div className="mt-1 grid grid-cols-1 gap-1">
              <KeyTypeValueRow
                layout="keyValue"
                density="compact"
                keyNode={<span className={uiPanelMonospaceTextClass}>schema.layers.mode</span>}
                valueNode={(
                  <RightAlignedValueCell>
                    <select
                      className={uiPanelKeyValueInputClass}
                      value={layerMode}
                      onChange={e => {
                        const raw = e.target.value
                        const nextMode: typeof layerMode =
                          raw === 'document-structure' || raw === 'semantic' ? (raw as typeof layerMode) : 'property'
                        const current = schema
                        const baseLayers = current.layers || {}
                        const next: GraphSchema = {
                          ...current,
                          layers: {
                            ...baseLayers,
                            mode: nextMode,
                          },
                        }
                        setSchema(next)
                      }}
                    >
                      <option value="property">property (array properties)</option>
                      <option value="document-structure">document-structure (node type)</option>
                      <option value="semantic">semantic (similarity graph)</option>
                    </select>
                  </RightAlignedValueCell>
                )}
              />
              <KeyTypeValueRow
                layout="keyValue"
                density="compact"
                keyNode={<span className={uiPanelMonospaceTextClass}>graph.layout.mode</span>}
                valueNode={(
                  <RightAlignedValueCell>
                    <select
                      className={uiPanelKeyValueInputClass}
                      value={layoutMode}
                      onChange={e => {
                        const raw = e.target.value
                        const next: typeof layoutMode =
                          raw === 'radial' || raw === 'tidy-tree' ? raw : 'force'
                        setLayoutMode(next)
                        if (next === 'radial' || next === 'tidy-tree') {
                          setCanvasRenderMode('2d')
                        }
                      }}
                    >
                      <option value="force">force</option>
                      <option value="radial">radial</option>
                      <option value="tidy-tree">tidy-tree</option>
                    </select>
                  </RightAlignedValueCell>
                )}
              />
              <KeyTypeValueRow
                layout="keyValue"
                density="compact"
                keyNode={<span className={uiPanelMonospaceTextClass}>graph.layout.fitPadding</span>}
                valueNode={(
                  <RightAlignedValueCell>
                    <input
                      type="number"
                      step={1}
                      min={0}
                      className={uiPanelKeyValueInputClass}
                      value={schema.layout?.fitPadding ?? 80}
                      onChange={e => setFitPadding(parseFloat(e.target.value || '80'))}
                    />
                  </RightAlignedValueCell>
                )}
              />
              <KeyTypeValueRow
                layout="keyValue"
                density="compact"
                keyNode={<span className={uiPanelMonospaceTextClass}>graph.performance.lod.hideLabelsBelowScale</span>}
                valueNode={(
                  <RightAlignedValueCell>
                    <input
                      type="number"
                      step={0.05}
                      min={0}
                      className={uiPanelKeyValueInputClass}
                      value={schema.performance?.lod?.hideLabelsBelowScale ?? 0}
                      onChange={e => setHideLabelsBelowScale(parseFloat(e.target.value || '0'))}
                    />
                  </RightAlignedValueCell>
                )}
              />
              {layoutMode === 'tidy-tree' ? (
                <RenderTidyTreeSettingsRows
                  tidyTreeCfg={tidyTreeCfg}
                  tidyTreeLod={tidyTreeLod}
                  tidyEdgeLabelsText={tidyEdgeLabelsText}
                  tidyEdgeLabelSuggestion={tidyEdgeLabelSuggestion}
                  updateTidyTree={updateTidyTree}
                  updateTidyTreeLod={updateTidyTreeLod}
                  uiPanelKeyValueInputClass={uiPanelKeyValueInputClass}
                  uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
                  uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
                  uiPanelTextFontClass={uiPanelTextFontClass}
                />
              ) : null}
            </div>
          </div>
        </div>
        <RenderPresetSection
          schema={schema}
          setSchema={setSchema}
          setCanvasRenderMode={setCanvasRenderMode}
          setThreeConfig={setThreeConfig}
          setCharge={setCharge}
          setCollisionByType={setCollisionByType}
          updateNodeStyle={updateNodeStyle}
          updateEdgeStyle={updateEdgeStyle}
          setEdgeArrow={setEdgeArrow}
        />
        <ThreeViewTuningSection
          schema={schema}
          setThreeConfig={setThreeConfig}
          threeGroupsCollapsed={threeGroupsCollapsed}
          onToggleThreeGroup={onToggleThreeGroup}
        />
      </CollapsibleSection>
      <CollapsibleSection
        title={renderSectionTitle('codebaseIndexPipeline')}
        toolbarAligned
        collapsed={codebaseIndexCollapsed}
        onToggle={onToggleCodebaseIndex}
      >
        <div
          className={[
            'flex items-center gap-2 text-gray-500',
            uiPanelKeyValueTextSizeClass,
            uiPanelTextFontClass,
          ].join(' ')}
        >
          <button
            type="button"
            className={[
              'App-toolbar__btn bg-gray-100 text-gray-700',
              uiPanelKeyValueTextSizeClass,
              uiPanelTextFontClass,
            ].join(' ')}
            onClick={handleRunCodebaseIndexPipeline}
          >
            {RUN_CODEBASE_INDEX_PIPELINE_LABEL}
          </button>
          {pipelineStatus && (
            <span className="truncate">
              {pipelineStatus}
            </span>
          )}
        </div>
      </CollapsibleSection>
    </div>
  )
}
