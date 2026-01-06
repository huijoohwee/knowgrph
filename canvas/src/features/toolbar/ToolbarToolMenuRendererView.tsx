import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useRenderBottomPanelState } from '@/features/panels/hooks/useRenderBottomPanelState'
import RenderSettingsSection from '@/features/panels/views/RenderSettingsSection'
import AiKgLayersSection from '@/features/panels/views/AiKgLayersSection'
import { useGraphStore } from '@/hooks/useGraphStore'
import { lsInt, lsSetInt } from '@/lib/persistence'
import {
  ORCHESTRATOR_TRAVERSAL_DELAY_DEFAULT_MS,
  ORCHESTRATOR_TRAVERSAL_DELAY_MAX_MS,
  ORCHESTRATOR_TRAVERSAL_DELAY_MIN_MS,
} from '@/features/panels/utils/orchestratorTraversal'
import { LS_KEYS, UI_LABELS } from '@/lib/config'
import { RendererPaletteSettings } from '@/features/toolbar/ui/RendererPaletteSettings'
import { RendererTidyTreeSettings } from '@/features/toolbar/ui/RendererTidyTreeSettings'
import { RendererLayoutModeSettings } from '@/features/toolbar/ui/RendererLayoutModeSettings'

export function ToolbarToolMenuRendererView() {
  const { schema, setSchema, setThreeConfig, setCharge, setCollisionByType } = useGraphStore(
    useShallow(s => ({
      schema: s.schema,
      setSchema: s.setSchema,
      setThreeConfig: s.setThreeConfig,
      setCharge: s.setCharge,
      setCollisionByType: s.setCollisionByType,
    })),
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

  return (
    <div className="flex flex-col gap-2">
      <RendererLayoutModeSettings />
      <RendererPaletteSettings />
      <AiKgLayersSection
        schema={schema}
        setSchema={setSchema}
        setThreeConfig={setThreeConfig}
        setCharge={setCharge}
        setCollisionByType={setCollisionByType}
        traversalDelayMs={traversalDelayMs}
        setTraversalDelayMs={handleSetTraversalDelayMs}
      />
      <RendererTidyTreeSettings />
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
