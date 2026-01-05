import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useRenderBottomPanelState } from '@/features/panels/hooks/useRenderBottomPanelState'
import RenderSettingsSection from '@/features/panels/views/RenderSettingsSection'
import AiKgLayersSection from '@/features/panels/views/AiKgLayersSection'
import { KeyTypeValueRow, RightAlignedValueCell } from '@/features/panels/ui/KeyTypeValueRow'
import Tooltip from '@/features/panels/ui/Tooltip'
import { useGraphStore } from '@/hooks/useGraphStore'
import { lsInt, lsSetInt } from '@/lib/persistence'
import { MVP_COLOR_PALETTE } from '@/lib/graph/schema'
import type { JSONValue } from '@/lib/graph/types'
import {
  ORCHESTRATOR_TRAVERSAL_DELAY_DEFAULT_MS,
  ORCHESTRATOR_TRAVERSAL_DELAY_MAX_MS,
  ORCHESTRATOR_TRAVERSAL_DELAY_MIN_MS,
} from '@/features/panels/utils/orchestratorTraversal'
import {
  RENDERER_LAYOUT_MODE_ROW_TOOLTIP,
  RENDERER_LAYOUT_MODE_VALUE_TOOLTIP,
  RENDERER_TIDY_TREE_CURVE_ROW_TOOLTIP,
  RENDERER_TIDY_TREE_CURVE_VALUE_TOOLTIP,
  RENDERER_TIDY_TREE_ORIENTATION_ROW_TOOLTIP,
  RENDERER_TIDY_TREE_ORIENTATION_VALUE_TOOLTIP,
  RENDERER_TIDY_TREE_LINK_OPACITY_ROW_TOOLTIP,
  RENDERER_TIDY_TREE_LINK_OPACITY_VALUE_TOOLTIP,
  LS_KEYS,
  UI_LABELS,
} from '@/lib/config'

export function ToolbarToolMenuRendererView() {
  const { schema, setSchema, setCanvasRenderMode, setThreeConfig, setCharge, setCollisionByType } = useGraphStore(
    useShallow(s => ({
      schema: s.schema,
      setSchema: s.setSchema,
      setCanvasRenderMode: s.setCanvasRenderMode,
      setThreeConfig: s.setThreeConfig,
      setCharge: s.setCharge,
      setCollisionByType: s.setCollisionByType,
    })),
  )

  const uiPanelKeyValueInputClass = useGraphStore(
    s =>
      s.uiPanelKeyValueInputClass
      || 'w-full h-6 px-2 text-xs border border-gray-300 rounded text-right',
  )

  const {
    sections: renderSections,
    allSectionsCollapsed: allRenderSectionsCollapsed,
    collapseAllSections: collapseRenderSections,
    expandAllSections: expandRenderSections,
  } = useRenderBottomPanelState({ source: 'floatingPanel' })
  const renderSectionsCollapsed = renderSections.byKey
  const renderSectionSetters = renderSections.setters

  const renderLinksCollapsed = renderSectionsCollapsed.links
  const renderLayoutCollapsed = renderSectionsCollapsed.layout
  const renderBackgroundFogCollapsed = renderSectionsCollapsed.backgroundFog
  const renderStarfieldCollapsed = renderSectionsCollapsed.starfield
  const renderCameraCollapsed = renderSectionsCollapsed.camera
  const renderSelectionCollapsed = renderSectionsCollapsed.selection
  const renderPresetsCollapsed = renderSectionsCollapsed.presets
  const renderCodebaseIndexCollapsed = renderSectionsCollapsed.codebaseIndex

  const setRenderLinksCollapsed = renderSectionSetters.links
  const setRenderLayoutCollapsed = renderSectionSetters.layout
  const setRenderBackgroundFogCollapsed = renderSectionSetters.backgroundFog
  const setRenderStarfieldCollapsed = renderSectionSetters.starfield
  const setRenderCameraCollapsed = renderSectionSetters.camera
  const setRenderSelectionCollapsed = renderSectionSetters.selection
  const setRenderPresetsCollapsed = renderSectionSetters.presets
  const setRenderCodebaseIndexCollapsed = renderSectionSetters.codebaseIndex

  const [traversalDelayMs, setTraversalDelayMs] = React.useState(() =>
    lsInt(LS_KEYS.orchestratorTraversalDelayMs, ORCHESTRATOR_TRAVERSAL_DELAY_DEFAULT_MS),
  )

  const handleSetTraversalDelayMs = React.useCallback(
    (value: number) => {
      const clamped = lsSetInt(LS_KEYS.orchestratorTraversalDelayMs, value, {
        min: ORCHESTRATOR_TRAVERSAL_DELAY_MIN_MS,
        max: ORCHESTRATOR_TRAVERSAL_DELAY_MAX_MS,
      })
      setTraversalDelayMs(clamped)
    },
    [],
  )

  const palette = React.useMemo(
    () => {
      const meta = schema.metadata && typeof schema.metadata === 'object' && !Array.isArray(schema.metadata)
        ? schema.metadata
        : {}
      const raw = Object.prototype.hasOwnProperty.call(meta, 'renderer:palette')
        ? (meta['renderer:palette'] as unknown)
        : undefined
      const baseNodes = MVP_COLOR_PALETTE.nodes
      const baseEdges = MVP_COLOR_PALETTE.edges
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const obj = raw as { nodes?: Record<string, string>; edges?: Record<string, string> }
        return {
          nodes: { ...baseNodes, ...(obj.nodes || {}) },
          edges: { ...baseEdges, ...(obj.edges || {}) },
        }
      }
      return { nodes: baseNodes, edges: baseEdges }
    },
    [schema],
  )

  const handleUpdatePaletteColor = React.useCallback(
    (kind: 'node' | 'edge', key: string, value: string) => {
      const trimmed = String(value || '').trim()
      if (!trimmed) return
      const current = schema
      const meta =
        current.metadata && typeof current.metadata === 'object' && !Array.isArray(current.metadata)
          ? (current.metadata as Record<string, JSONValue>)
          : ({} as Record<string, JSONValue>)
      const existingRaw = Object.prototype.hasOwnProperty.call(meta, 'renderer:palette')
        ? (meta['renderer:palette'] as unknown)
        : undefined
      const existing =
        existingRaw && typeof existingRaw === 'object' && !Array.isArray(existingRaw)
          ? (existingRaw as { nodes?: Record<string, string>; edges?: Record<string, string> })
          : { nodes: {}, edges: {} }
      const nextNodes: Record<string, string> = { ...(existing.nodes || {}) }
      const nextEdges: Record<string, string> = { ...(existing.edges || {}) }
      if (kind === 'node') {
        nextNodes[key] = trimmed
      } else {
        nextEdges[key] = trimmed
      }
      const nextPalette: { nodes?: Record<string, string>; edges?: Record<string, string> } = {
        ...existing,
        nodes: nextNodes,
        edges: nextEdges,
      }
      const nextSchema = {
        ...current,
        metadata: {
          ...meta,
          'renderer:palette': nextPalette as JSONValue,
        },
      }
      setSchema(nextSchema)
    },
    [schema, setSchema],
  )

  const normalizeColorForPicker = (raw: string, fallback: string) => {
    const v = String(raw || '').trim() || fallback
    if (!v.startsWith('#')) return '#000000'
    if (v.length === 4 || v.length === 7) return v
    return '#000000'
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-1 gap-1">
        <KeyTypeValueRow
          layout="keyIconValue"
          density="compact"
          keyNode={(
            <Tooltip
              content={RENDERER_LAYOUT_MODE_ROW_TOOLTIP}
              maxWidthPx={260}
              contentClassName="bg-gray-800/90"
              className="break-words"
            >
              <span className="text-gray-700 break-words">
                schema.layout.mode
              </span>
            </Tooltip>
          )}
          typeNode={null}
          valueNode={(
            <RightAlignedValueCell>
              <Tooltip
                content={RENDERER_LAYOUT_MODE_VALUE_TOOLTIP}
                maxWidthPx={260}
                contentClassName="bg-gray-800/90"
                className="w-full"
              >
                <select
                  className={uiPanelKeyValueInputClass}
                  value={schema.layout?.mode || 'force'}
                  onChange={e => {
                    const raw = String(e.target.value || '')
                    const nextMode = raw === 'radial' || raw === 'tidy-tree' ? raw : 'force'
                    const layout = schema.layout || {}
                    setSchema({ ...schema, layout: { ...layout, mode: nextMode } })
                    if (nextMode === 'radial' || nextMode === 'tidy-tree') {
                      setCanvasRenderMode('2d')
                    }
                  }}
                >
                  <option value="force">force</option>
                  <option value="radial">radial</option>
                  <option value="tidy-tree">tidy-tree</option>
                </select>
              </Tooltip>
            </RightAlignedValueCell>
          )}
        />
        <KeyTypeValueRow
          layout="keyIconValue"
          density="compact"
          keyNode={(
            <span className="text-gray-700 break-words">
              schema.layers.mode
            </span>
          )}
          typeNode={null}
          valueNode={(
            <RightAlignedValueCell>
              <select
                className={uiPanelKeyValueInputClass}
                value={schema.layers?.mode || 'property'}
                onChange={e => {
                  const raw = String(e.target.value || '')
                  const nextMode =
                    raw === 'semantic' || raw === 'document-structure'
                      ? raw
                      : 'property'
                  const layers = schema.layers || {}
                  setSchema({ ...schema, layers: { ...layers, mode: nextMode } })
                }}
              >
                <option value="property">property</option>
                <option value="document-structure">document-structure</option>
                <option value="semantic">semantic</option>
              </select>
            </RightAlignedValueCell>
          )}
        />
      </div>
      <div className="grid grid-cols-1 gap-1">
        <KeyTypeValueRow
          layout="keyIconValue"
          density="compact"
          keyNode={(
            <span className="text-gray-700 break-words">
              renderer:palette.nodes.idea
            </span>
          )}
          typeNode={null}
          valueNode={(
            <RightAlignedValueCell>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="w-8 h-6 p-0 border border-gray-300 rounded cursor-pointer bg-transparent"
                  value={normalizeColorForPicker(palette.nodes.idea, MVP_COLOR_PALETTE.nodes.idea)}
                  onChange={e => handleUpdatePaletteColor('node', 'idea', e.target.value)}
                />
                <input
                  type="text"
                  className={uiPanelKeyValueInputClass}
                  value={String(palette.nodes.idea || '')}
                  onChange={e => handleUpdatePaletteColor('node', 'idea', e.target.value)}
                  placeholder={MVP_COLOR_PALETTE.nodes.idea}
                />
              </div>
            </RightAlignedValueCell>
          )}
        />
        <KeyTypeValueRow
          layout="keyIconValue"
          density="compact"
          keyNode={(
            <span className="text-gray-700 break-words">
              renderer:palette.nodes.hypothesis
            </span>
          )}
          typeNode={null}
          valueNode={(
            <RightAlignedValueCell>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="w-8 h-6 p-0 border border-gray-300 rounded cursor-pointer bg-transparent"
                  value={normalizeColorForPicker(palette.nodes.hypothesis, MVP_COLOR_PALETTE.nodes.hypothesis)}
                  onChange={e => handleUpdatePaletteColor('node', 'hypothesis', e.target.value)}
                />
                <input
                  type="text"
                  className={uiPanelKeyValueInputClass}
                  value={String(palette.nodes.hypothesis || '')}
                  onChange={e => handleUpdatePaletteColor('node', 'hypothesis', e.target.value)}
                  placeholder={MVP_COLOR_PALETTE.nodes.hypothesis}
                />
              </div>
            </RightAlignedValueCell>
          )}
        />
        <KeyTypeValueRow
          layout="keyIconValue"
          density="compact"
          keyNode={(
            <span className="text-gray-700 break-words">
              renderer:palette.nodes.execution
            </span>
          )}
          typeNode={null}
          valueNode={(
            <RightAlignedValueCell>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="w-8 h-6 p-0 border border-gray-300 rounded cursor-pointer bg-transparent"
                  value={normalizeColorForPicker(palette.nodes.execution, MVP_COLOR_PALETTE.nodes.execution)}
                  onChange={e => handleUpdatePaletteColor('node', 'execution', e.target.value)}
                />
                <input
                  type="text"
                  className={uiPanelKeyValueInputClass}
                  value={String(palette.nodes.execution || '')}
                  onChange={e => handleUpdatePaletteColor('node', 'execution', e.target.value)}
                  placeholder={MVP_COLOR_PALETTE.nodes.execution}
                />
              </div>
            </RightAlignedValueCell>
          )}
        />
        <KeyTypeValueRow
          layout="keyIconValue"
          density="compact"
          keyNode={(
            <span className="text-gray-700 break-words">
              renderer:palette.nodes.pivot
            </span>
          )}
          typeNode={null}
          valueNode={(
            <RightAlignedValueCell>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="w-8 h-6 p-0 border border-gray-300 rounded cursor-pointer bg-transparent"
                  value={normalizeColorForPicker(palette.nodes.pivot, MVP_COLOR_PALETTE.nodes.pivot)}
                  onChange={e => handleUpdatePaletteColor('node', 'pivot', e.target.value)}
                />
                <input
                  type="text"
                  className={uiPanelKeyValueInputClass}
                  value={String(palette.nodes.pivot || '')}
                  onChange={e => handleUpdatePaletteColor('node', 'pivot', e.target.value)}
                  placeholder={MVP_COLOR_PALETTE.nodes.pivot}
                />
              </div>
            </RightAlignedValueCell>
          )}
        />
        <KeyTypeValueRow
          layout="keyIconValue"
          density="compact"
          keyNode={(
            <span className="text-gray-700 break-words">
              renderer:palette.nodes.alert
            </span>
          )}
          typeNode={null}
          valueNode={(
            <RightAlignedValueCell>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="w-8 h-6 p-0 border border-gray-300 rounded cursor-pointer bg-transparent"
                  value={normalizeColorForPicker(palette.nodes.alert, MVP_COLOR_PALETTE.nodes.alert)}
                  onChange={e => handleUpdatePaletteColor('node', 'alert', e.target.value)}
                />
                <input
                  type="text"
                  className={uiPanelKeyValueInputClass}
                  value={String(palette.nodes.alert || '')}
                  onChange={e => handleUpdatePaletteColor('node', 'alert', e.target.value)}
                  placeholder={MVP_COLOR_PALETTE.nodes.alert}
                />
              </div>
            </RightAlignedValueCell>
          )}
        />
        <KeyTypeValueRow
          layout="keyIconValue"
          density="compact"
          keyNode={(
            <span className="text-gray-700 break-words">
              renderer:palette.edges.critical
            </span>
          )}
          typeNode={null}
          valueNode={(
            <RightAlignedValueCell>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="w-8 h-6 p-0 border border-gray-300 rounded cursor-pointer bg-transparent"
                  value={normalizeColorForPicker(palette.edges.critical, MVP_COLOR_PALETTE.edges.critical)}
                  onChange={e => handleUpdatePaletteColor('edge', 'critical', e.target.value)}
                />
                <input
                  type="text"
                  className={uiPanelKeyValueInputClass}
                  value={String(palette.edges.critical || '')}
                  onChange={e => handleUpdatePaletteColor('edge', 'critical', e.target.value)}
                  placeholder={MVP_COLOR_PALETTE.edges.critical}
                />
              </div>
            </RightAlignedValueCell>
          )}
        />
        <KeyTypeValueRow
          layout="keyIconValue"
          density="compact"
          keyNode={(
            <span className="text-gray-700 break-words">
              renderer:palette.edges.neutral
            </span>
          )}
          typeNode={null}
          valueNode={(
            <RightAlignedValueCell>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="w-8 h-6 p-0 border border-gray-300 rounded cursor-pointer bg-transparent"
                  value={normalizeColorForPicker(palette.edges.neutral, MVP_COLOR_PALETTE.edges.neutral)}
                  onChange={e => handleUpdatePaletteColor('edge', 'neutral', e.target.value)}
                />
                <input
                  type="text"
                  className={uiPanelKeyValueInputClass}
                  value={String(palette.edges.neutral || '')}
                  onChange={e => handleUpdatePaletteColor('edge', 'neutral', e.target.value)}
                  placeholder={MVP_COLOR_PALETTE.edges.neutral}
                />
              </div>
            </RightAlignedValueCell>
          )}
        />
      </div>
      <AiKgLayersSection
        schema={schema}
        setSchema={setSchema}
        setThreeConfig={setThreeConfig}
        setCharge={setCharge}
        setCollisionByType={setCollisionByType}
        traversalDelayMs={traversalDelayMs}
        setTraversalDelayMs={handleSetTraversalDelayMs}
      />
      {(schema.layout?.mode || 'force') === 'tidy-tree' && (
        <div className="grid grid-cols-1 gap-1">
          <KeyTypeValueRow
            layout="keyIconValue"
            density="compact"
            keyNode={(
              <Tooltip
                content={RENDERER_TIDY_TREE_CURVE_ROW_TOOLTIP}
                maxWidthPx={260}
                contentClassName="bg-gray-800/90"
                className="break-words"
              >
                <span className="text-gray-700 break-words">
                  graph.layout.tidyTree.curve
                </span>
              </Tooltip>
            )}
            typeNode={null}
            valueNode={(
              <RightAlignedValueCell>
                <Tooltip
                  content={RENDERER_TIDY_TREE_CURVE_VALUE_TOOLTIP}
                  maxWidthPx={260}
                  contentClassName="bg-gray-800/90"
                  className="w-full"
                >
                  <select
                    className={uiPanelKeyValueInputClass}
                    value={schema.layout?.tidyTree?.curve || 'bump'}
                    onChange={e => {
                      const raw = String(e.target.value || '')
                      const curve = raw === 'linear' || raw === 'step' || raw === 'bump' ? raw : 'bump'
                      const layout = schema.layout || {}
                      const tidyTree = layout.tidyTree || {}
                      setSchema({ ...schema, layout: { ...layout, tidyTree: { ...tidyTree, curve } } })
                    }}
                  >
                    <option value="bump">bump</option>
                    <option value="linear">linear</option>
                    <option value="step">step</option>
                  </select>
                </Tooltip>
              </RightAlignedValueCell>
            )}
          />
          <KeyTypeValueRow
            layout="keyIconValue"
            density="compact"
            keyNode={(
              <Tooltip
                content={RENDERER_TIDY_TREE_ORIENTATION_ROW_TOOLTIP}
                maxWidthPx={260}
                contentClassName="bg-gray-800/90"
                className="break-words"
              >
                <span className="text-gray-700 break-words">
                  graph.layout.tidyTree.orientation
                </span>
              </Tooltip>
            )}
            typeNode={null}
            valueNode={(
              <RightAlignedValueCell>
                <Tooltip
                  content={RENDERER_TIDY_TREE_ORIENTATION_VALUE_TOOLTIP}
                  maxWidthPx={260}
                  contentClassName="bg-gray-800/90"
                  className="w-full"
                >
                  <select
                    className={uiPanelKeyValueInputClass}
                    value={schema.layout?.tidyTree?.orientation === 'vertical' ? 'vertical' : 'horizontal'}
                    onChange={e => {
                      const raw = String(e.target.value || '')
                      const orientation = raw === 'vertical' ? 'vertical' : 'horizontal'
                      const layout = schema.layout || {}
                      const tidyTree = layout.tidyTree || {}
                      setSchema({ ...schema, layout: { ...layout, tidyTree: { ...tidyTree, orientation } } })
                    }}
                  >
                    <option value="horizontal">left-to-right</option>
                    <option value="vertical">top-to-bottom</option>
                  </select>
                </Tooltip>
              </RightAlignedValueCell>
            )}
          />
          <KeyTypeValueRow
            layout="keyIconValue"
            density="compact"
            keyNode={(
              <Tooltip
                content={RENDERER_TIDY_TREE_LINK_OPACITY_ROW_TOOLTIP}
                maxWidthPx={260}
                contentClassName="bg-gray-800/90"
                className="break-words"
              >
                <span className="text-gray-700 break-words">
                  graph.layout.tidyTree.linkOpacity
                </span>
              </Tooltip>
            )}
            typeNode={null}
            valueNode={(
              <RightAlignedValueCell>
                <Tooltip
                  content={RENDERER_TIDY_TREE_LINK_OPACITY_VALUE_TOOLTIP}
                  maxWidthPx={260}
                  contentClassName="bg-gray-800/90"
                  className="w-full"
                >
                  <input
                    className={uiPanelKeyValueInputClass}
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    value={typeof schema.layout?.tidyTree?.linkOpacity === 'number' ? schema.layout?.tidyTree?.linkOpacity : 0.4}
                    onChange={e => {
                      const raw = parseFloat(String(e.target.value || '0.4'))
                      const linkOpacity = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 0.4
                      const layout = schema.layout || {}
                      const tidyTree = layout.tidyTree || {}
                      setSchema({ ...schema, layout: { ...layout, tidyTree: { ...tidyTree, linkOpacity } } })
                    }}
                  />
                </Tooltip>
              </RightAlignedValueCell>
            )}
          />
        </div>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="App-toolbar__btn text-xs bg-gray-100 text-gray-700"
          onClick={collapseRenderSections}
          disabled={allRenderSectionsCollapsed}
        >
          {UI_LABELS.collapseAll}
        </button>
        <button
          type="button"
          className="App-toolbar__btn text-xs bg-gray-100 text-gray-700"
          onClick={expandRenderSections}
        >
          {UI_LABELS.expandAll}
        </button>
      </div>
      <RenderSettingsSection
        threeGroupsCollapsed={{
          links: renderLinksCollapsed,
          layout: renderLayoutCollapsed,
          backgroundFog: renderBackgroundFogCollapsed,
          starfield: renderStarfieldCollapsed,
          camera: renderCameraCollapsed,
          selection: renderSelectionCollapsed,
        }}
        onToggleThreeGroup={(group, next) => {
          if (group === 'links') setRenderLinksCollapsed(next)
          else if (group === 'layout') setRenderLayoutCollapsed(next)
          else if (group === 'backgroundFog') setRenderBackgroundFogCollapsed(next)
          else if (group === 'starfield') setRenderStarfieldCollapsed(next)
          else if (group === 'camera') setRenderCameraCollapsed(next)
          else if (group === 'selection') setRenderSelectionCollapsed(next)
        }}
        presetsCollapsed={renderPresetsCollapsed}
        onTogglePresets={setRenderPresetsCollapsed}
        codebaseIndexCollapsed={renderCodebaseIndexCollapsed}
        onToggleCodebaseIndex={setRenderCodebaseIndexCollapsed}
      />
    </div>
  )
}
