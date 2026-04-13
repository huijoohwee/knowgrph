import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Eye } from 'lucide-react'
import type { Canvas2dRendererId } from '@/lib/config'
import { UI_COPY } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'
import { ToolbarDropdownSelect } from '@/components/toolbar/ToolbarDropdownSelect'
import { isFlowCanvas2dRenderer } from '@/lib/config.render'
import { getVoxelModeInapplicableReason, isVoxelModeApplicable } from '@/lib/canvas/canvas3dMode'
import type { CanvasViewOptionId, CanvasViewModelState } from '@/components/toolbar/canvasViewTypes'
import { buildCanvasViewOptions, getCanvasViewRendererOptions, getCanvasViewTriggerState } from '@/components/toolbar/canvasViewMenu'
import { applyCanvasViewSelection } from '@/components/toolbar/canvasViewActions'

type Canvas2dRendererSelectProps = {
  iconSizeClass: string
  iconStrokeWidth: number
  ensureBaselineUnlocked: () => boolean
  geospatialEnabled: boolean
  onOpenGeospatialMode: () => void
}

export function Canvas2dRendererSelect({
  iconSizeClass,
  iconStrokeWidth,
  ensureBaselineUnlocked,
  geospatialEnabled,
  onOpenGeospatialMode,
}: Canvas2dRendererSelectProps) {
  const state = useGraphStore(
    useShallow(s => ({
      canvas2dRenderer: (s.canvas2dRenderer || 'd3') as Canvas2dRendererId,
      canvasRenderMode: s.canvasRenderMode,
      canvas3dMode: s.canvas3dMode,
      documentSemanticMode: s.documentSemanticMode || 'document',
      frontmatterModeEnabled: s.frontmatterModeEnabled === true,
      multiDimTableModeEnabled: s.multiDimTableModeEnabled === true,
      renderMediaAsNodes: s.renderMediaAsNodes === true,
      setCanvas2dRenderer: s.setCanvas2dRenderer,
      setCanvasRenderMode: s.setCanvasRenderMode,
      setCanvas3dMode: s.setCanvas3dMode,
      setSchema: s.setSchema,
      setRenderMediaAsNodes: s.setRenderMediaAsNodes,
      setDocumentSemanticMode: s.setDocumentSemanticMode,
      setFrontmatterModeEnabled: s.setFrontmatterModeEnabled,
      setMultiDimTableModeEnabled: s.setMultiDimTableModeEnabled,
      layoutMode: s.schema?.layout?.mode,
      schema: s.schema,
    })),
  )

  const frontmatterOnlyAllowed = state.canvasRenderMode === '2d' && isFlowCanvas2dRenderer(state.canvas2dRenderer)
  const isD3Like2dLayoutToggle = state.canvas2dRenderer === 'd3' || state.canvas2dRenderer === 'd3Bipartite'
  const voxelApplicable = isVoxelModeApplicable({
    canvas2dRenderer: state.canvas2dRenderer,
    documentSemanticMode: state.documentSemanticMode,
    frontmatterModeEnabled: state.frontmatterModeEnabled,
    multiDimTableModeEnabled: state.multiDimTableModeEnabled,
    schema: state.schema,
  })
  const inapplicableReason = getVoxelModeInapplicableReason({
    canvas2dRenderer: state.canvas2dRenderer,
    documentSemanticMode: state.documentSemanticMode,
    frontmatterModeEnabled: state.frontmatterModeEnabled,
    multiDimTableModeEnabled: state.multiDimTableModeEnabled,
    schema: state.schema,
  })
  const voxelDisabledReason = React.useMemo(() => {
    if (inapplicableReason === 'renderer') {
      return {
        reason: 'Requires Canvas View Mode: D3 Bipartite renderer',
        hint: 'Switch renderer to D3 Bipartite',
      }
    }
    if (inapplicableReason === 'semantic') {
      return {
        reason: 'Voxel Mode requires Document/Keyword, Frontmatter, or Multi-dimensional Table mode',
        hint: 'Enable one semantic mode, then retry',
      }
    }
    if (inapplicableReason === 'layout') {
      return {
        reason: 'Voxel Mode is disabled in Radial Layout',
        hint: 'Set layout mode to Block',
      }
    }
    return null
  }, [inapplicableReason])

  const modelState = React.useMemo(
    () =>
      ({
        canvas2dRenderer: state.canvas2dRenderer,
        canvas3dMode: state.canvas3dMode,
        canvasRenderMode: state.canvasRenderMode,
        documentSemanticMode: state.documentSemanticMode,
        frontmatterModeEnabled: state.frontmatterModeEnabled,
        multiDimTableModeEnabled: state.multiDimTableModeEnabled,
        renderMediaAsNodes: state.renderMediaAsNodes,
        geospatialEnabled,
        layoutMode: state.layoutMode,
        schema: state.schema,
        frontmatterOnlyAllowed,
        isD3Like2dLayoutToggle,
        voxelApplicable,
        voxelDisabledReason,
      }) satisfies CanvasViewModelState,
    [
      frontmatterOnlyAllowed,
      geospatialEnabled,
      isD3Like2dLayoutToggle,
      state.canvas2dRenderer,
      state.canvas3dMode,
      state.canvasRenderMode,
      state.documentSemanticMode,
      state.frontmatterModeEnabled,
      state.layoutMode,
      state.multiDimTableModeEnabled,
      state.renderMediaAsNodes,
      state.schema,
      voxelApplicable,
      voxelDisabledReason,
    ],
  )

  const rendererOptions = React.useMemo(() => getCanvasViewRendererOptions(), [])
  const options = React.useMemo(() => buildCanvasViewOptions(modelState, rendererOptions), [modelState, rendererOptions])
  const triggerState = React.useMemo(() => getCanvasViewTriggerState(modelState, rendererOptions), [modelState, rendererOptions])

  return (
    <ToolbarDropdownSelect
      value={triggerState.id}
      options={options}
      title={`${UI_COPY.canvasViewModeTitle}: ${triggerState.title}`}
      tooltipContent={UI_COPY.canvasViewModeTooltip}
      disabled={false}
      onSelect={id =>
        applyCanvasViewSelection({
          id: id as CanvasViewOptionId,
          ensureBaselineUnlocked,
          geospatialEnabled,
          onOpenGeospatialMode,
          canvas2dRenderer: state.canvas2dRenderer,
          canvas3dMode: state.canvas3dMode,
          canvasRenderMode: state.canvasRenderMode,
          documentSemanticMode: state.documentSemanticMode,
          frontmatterModeEnabled: state.frontmatterModeEnabled,
          multiDimTableModeEnabled: state.multiDimTableModeEnabled,
          renderMediaAsNodes: state.renderMediaAsNodes,
          schema: state.schema,
          setCanvas2dRenderer: state.setCanvas2dRenderer,
          setCanvasRenderMode: state.setCanvasRenderMode,
          setCanvas3dMode: state.setCanvas3dMode,
          setSchema: state.setSchema,
          setRenderMediaAsNodes: state.setRenderMediaAsNodes,
          setDocumentSemanticMode: state.setDocumentSemanticMode,
          setFrontmatterModeEnabled: state.setFrontmatterModeEnabled,
          setMultiDimTableModeEnabled: state.setMultiDimTableModeEnabled,
        })
      }
      renderButtonContent={() => (
        <div className="flex items-center gap-1">
          <Eye className={iconSizeClass} strokeWidth={iconStrokeWidth} />
          <span className="text-xs">View</span>
        </div>
      )}
      renderOptionContent={option => (
        <>
          <option.Icon className={iconSizeClass} strokeWidth={iconStrokeWidth} />
          <span className="truncate">{option.title}</span>
        </>
      )}
      menuWidthClass="w-64"
    />
  )
}
