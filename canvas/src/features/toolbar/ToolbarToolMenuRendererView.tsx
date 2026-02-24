import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useRenderBottomPanelState } from '@/features/panels/hooks/useRenderBottomPanelState'
import RenderSettingsSection from '@/features/panels/views/RenderSettingsSection'
import { UI_LABELS } from '@/lib/config'
import { RendererPaletteSettings } from '@/features/toolbar/ui/RendererPaletteSettings'
import { RendererHoverSettings } from '@/features/toolbar/ui/RendererHoverSettings'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { useGraphStore } from '@/hooks/useGraphStore'
import { GraphEditorToolRail, type GraphEditorToolId } from '@/features/graph-editor/GraphEditorToolRail'
import { GraphEditorRightPanel } from '@/features/graph-editor/GraphEditorRightPanel'

export function ToolbarToolMenuRendererView() {
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

  const { workspaceViewMode, canvasRenderMode, canvas2dRenderer, graphData, setCanvasPointerMode2d } = useGraphStore(
    useShallow(s => ({
      workspaceViewMode: s.workspaceViewMode,
      canvasRenderMode: s.canvasRenderMode,
      canvas2dRenderer: s.canvas2dRenderer,
      graphData: s.graphData,
      setCanvasPointerMode2d: s.setCanvasPointerMode2d,
    })),
  )

  const [toolId, setToolId] = React.useState<GraphEditorToolId>('select')

  React.useEffect(() => {
    const next = toolId === 'pan' ? 'pan' : 'select'
    setCanvasPointerMode2d(next)
  }, [toolId, setCanvasPointerMode2d])

  const showGraphEditorUi =
    workspaceViewMode === 'editor' && canvasRenderMode === '2d' && canvas2dRenderer === 'd3'

  return (
    <div className="flex flex-col gap-2">
      <RendererPaletteSettings />
      <RendererHoverSettings />
      {showGraphEditorUi ? (
        <section className="flex gap-2" aria-label="Graph editor tools and inspector">
          <GraphEditorToolRail
            activeToolId={toolId}
            onSelectTool={setToolId}
            disabled={!graphData}
          />
          <div className="flex-1 min-w-0">
            <GraphEditorRightPanel />
          </div>
        </section>
      ) : null}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={`App-toolbar__btn text-xs ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
          onClick={collapseRenderSections}
          disabled={allRenderSectionsCollapsed}
        >
          {UI_LABELS.collapseAll}
        </button>
        <button
          type="button"
          className={`App-toolbar__btn text-xs ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
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
