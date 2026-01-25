import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { GitBranch, MonitorPlay, SlidersHorizontal } from 'lucide-react'
import { useOrchestratorBottomPanelState } from '@/features/panels/hooks/useOrchestratorBottomPanelState'
import { GRAPH_TRAVERSAL_FLOATING_PANEL_EVENT } from '@/features/panels/utils/useMainPanelRect'
import OrchestratorSettingsSection from '@/features/panels/views/OrchestratorSettingsSection'
import IconButton from '@/components/IconButton'
import { ToolbarToolMenuRendererView } from '@/features/toolbar/ToolbarToolMenuRendererView'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getIconSizeClass } from '@/lib/ui'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { uiPrimaryPillActiveClassName } from '@/features/graph-data-table/ui/GraphDataTableToolbarStyles'
import {
  LS_KEYS,
  UI_LABELS,
  UI_SELECTORS,
} from '@/lib/config'
import { lsBool, lsSetBool } from '@/lib/persistence'
import HeaderActions from '@/features/panels/ui/HeaderActions'
import { FloatingPropsPanel } from '@/features/toolbar/FloatingPropsPanel'
import type { ToolbarToolMenuProps } from '@/features/toolbar/ToolbarToolMenuTypes'

type FloatingPanelView = 'propsPanel' | 'renderer' | 'graphTraversal'

export function ToolbarToolMenu({
  pipelineStatus,
  exportStatus,
  toolMenuCardRef,
  toolMenuCardStyle,
  onHeaderPointerDown,
  requestedFloatingPanelView,
  requestedFloatingPanelViewSeq,
  onClose,
}: ToolbarToolMenuProps) {
  const [floatingPanelPinned, setFloatingPanelPinned] = React.useState(() => lsBool(LS_KEYS.floatingPanelPinned, true))
  const [floatingPanelMinimized, setFloatingPanelMinimized] = React.useState(false)
  const [floatingPanelView, setFloatingPanelView] = React.useState<FloatingPanelView>('propsPanel')
  const handledRequestedViewSeqRef = React.useRef<number | undefined>(undefined)
  const setFloatingPanelZIndex = useGraphStore(s => s.setFloatingPanelZIndex)

  const { floatingPanelWidthRatio, floatingPanelHeightRatio, floatingPanelZIndex, uiIconScale, uiIconStrokeWidth } = useGraphStore(
    useShallow(state => ({
      floatingPanelWidthRatio: state.floatingPanelWidthRatio,
      floatingPanelHeightRatio: state.floatingPanelHeightRatio,
      floatingPanelZIndex: state.floatingPanelZIndex,
      uiIconScale: state.uiIconScale,
      uiIconStrokeWidth: state.uiIconStrokeWidth,
    })),
  )
  const uiPanelMicroLabelTextSizeClass = useGraphStore(
    s => s.uiPanelMicroLabelTextSizeClass || s.uiIconBadgeChipTextSizeClass || 'text-[9px]',
  )
  const uiPanelTextFontClass = useGraphStore(s => s.uiPanelTextFontClass || 'font-sans')

  const { sections: orchestratorSections } = useOrchestratorBottomPanelState()
  const orchestratorSectionCollapsedById = orchestratorSections.byId
  const orchestratorSectionSetters = orchestratorSections.setters

  const orchestratorGraphRagCollapsed = orchestratorSectionCollapsedById.graphRag
  const orchestratorPresetsCollapsed = orchestratorSectionCollapsedById.presets
  const orchestratorEditorCollapsed = orchestratorSectionCollapsedById.editor
  const orchestratorContextCollapsed = orchestratorSectionCollapsedById.context
  const orchestratorWorkflowIndexingCollapsed = orchestratorSectionCollapsedById.workflowIndexing
  const orchestratorWorkflowTracingCollapsed = orchestratorSectionCollapsedById.workflowTracing

  const setOrchestratorGraphRagCollapsed = orchestratorSectionSetters.graphRag
  const setOrchestratorPresetsCollapsed = orchestratorSectionSetters.presets
  const setOrchestratorEditorCollapsed = orchestratorSectionSetters.editor
  const setOrchestratorContextCollapsed = orchestratorSectionSetters.context
  const setOrchestratorWorkflowIndexingCollapsed = orchestratorSectionSetters.workflowIndexing
  const setOrchestratorWorkflowTracingCollapsed = orchestratorSectionSetters.workflowTracing

  const handleSelectView = React.useCallback((view: FloatingPanelView) => {
    setFloatingPanelView(view)
  }, [])

  const handleFloatingPanelPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!floatingPanelPinned) return
      const target = event.target
      if (!(target instanceof Element)) return
      if (
        target.closest(
          UI_SELECTORS.draggablePanelIgnorePointerDown,
        )
      ) {
        return
      }
      onHeaderPointerDown(event)
    },
    [floatingPanelPinned, onHeaderPointerDown],
  )

  const floatingPanelRootClassName = 'fixed inset-0 pointer-events-none'

  const handlePinToggle = React.useCallback(() => {
    setFloatingPanelPinned(prev => {
      const next = !prev
      lsSetBool(LS_KEYS.floatingPanelPinned, next)
      return next
    })
  }, [])

  const floatingPanelRootStyle = React.useMemo(() => {
    const safeZ = Number.isFinite(floatingPanelZIndex) ? Math.max(1, Math.floor(floatingPanelZIndex)) : 5000
    return { zIndex: floatingPanelPinned ? Math.max(safeZ, 1000) : 90 }
  }, [floatingPanelPinned, floatingPanelZIndex])

  const floatingPanelSizeStyle = React.useMemo(() => {
    const widthRatio = Number.isFinite(floatingPanelWidthRatio) ? floatingPanelWidthRatio : 0.25
    const heightRatio = Number.isFinite(floatingPanelHeightRatio) ? floatingPanelHeightRatio : 0.5
    const safeWidth = Math.max(0.15, Math.min(0.6, widthRatio))
    const safeHeight = Math.max(0.3, Math.min(0.9, heightRatio))
    return {
      width: `${Math.round(safeWidth * 100)}vw`,
      height: `${Math.round(safeHeight * 100)}vh`,
    }
  }, [floatingPanelWidthRatio, floatingPanelHeightRatio])

  const iconSizeClass = getIconSizeClass(uiIconScale)

  const viewButtons = (
    <>
      <IconButton
        title={UI_LABELS.propsPanel}
        onClick={() => handleSelectView('propsPanel')}
        className={`App-toolbar__btn ${
          floatingPanelView === 'propsPanel' ? uiPrimaryPillActiveClassName : UI_THEME_TOKENS.text.secondary
        }`}
        showTooltip
      >
        <SlidersHorizontal className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
      </IconButton>
      <IconButton
        title={UI_LABELS.renderer}
        onClick={() => handleSelectView('renderer')}
        className={`App-toolbar__btn ${
          floatingPanelView === 'renderer' ? uiPrimaryPillActiveClassName : UI_THEME_TOKENS.text.secondary
        }`}
        showTooltip
      >
        <MonitorPlay className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
      </IconButton>
      <IconButton
        title={UI_LABELS.graphTraversal}
        onClick={() => handleSelectView('graphTraversal')}
        className={`App-toolbar__btn ${
          floatingPanelView === 'graphTraversal' ? uiPrimaryPillActiveClassName : UI_THEME_TOKENS.text.secondary
        }`}
        showTooltip
      >
        <GitBranch className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
      </IconButton>
    </>
  )

  React.useEffect(() => {
    if (!floatingPanelPinned) return
    if (!Number.isFinite(floatingPanelZIndex)) return
    if (floatingPanelZIndex >= 1000) return
    setFloatingPanelZIndex(1000)
  }, [floatingPanelPinned, floatingPanelZIndex, setFloatingPanelZIndex])

  React.useEffect(() => {
    if (!requestedFloatingPanelView || !requestedFloatingPanelViewSeq) return
    if (handledRequestedViewSeqRef.current === requestedFloatingPanelViewSeq) return
    handledRequestedViewSeqRef.current = requestedFloatingPanelViewSeq
    setFloatingPanelMinimized(false)
    setFloatingPanelView(requestedFloatingPanelView)
  }, [requestedFloatingPanelView, requestedFloatingPanelViewSeq])

  React.useEffect(() => {
    const handleOpenGraphTraversal = () => {
      setFloatingPanelMinimized(false)
      setFloatingPanelView('graphTraversal')
    }
    window.addEventListener(GRAPH_TRAVERSAL_FLOATING_PANEL_EVENT, handleOpenGraphTraversal)
    return () => {
      window.removeEventListener(GRAPH_TRAVERSAL_FLOATING_PANEL_EVENT, handleOpenGraphTraversal)
    }
  }, [])

  if (floatingPanelMinimized) {
    return (
      <div className={floatingPanelRootClassName} style={floatingPanelRootStyle}>
        <div
          ref={toolMenuCardRef}
          className={`pointer-events-auto ModalContainer App-toolbar App-toolbar--compact select-none min-w-[260px] max-w-xs w-80 p-0 ${floatingPanelPinned ? 'cursor-move' : ''}`}
          style={toolMenuCardStyle}
          onPointerDown={handleFloatingPanelPointerDown}
        >
          <div className="flex items-center justify-between gap-2 w-full">
            <div className={`flex items-center gap-1 min-w-0 ${uiPanelTextFontClass}`}>
              {viewButtons}
              {pipelineStatus && (
                <span className={`${uiPanelMicroLabelTextSizeClass} ${UI_THEME_TOKENS.text.tertiary} truncate max-w-[120px]`}>
                  {pipelineStatus}
                </span>
              )}
            </div>
            <HeaderActions
              onPinToggle={handlePinToggle}
              pinned={floatingPanelPinned}
              onRestore={() => {
                setFloatingPanelMinimized(false)
              }}
              onClose={onClose}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={floatingPanelRootClassName} style={floatingPanelRootStyle}>
      <div
        ref={toolMenuCardRef}
        className={`pointer-events-auto ModalContainer flex flex-col overflow-hidden p-0 ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`}
        style={{ ...toolMenuCardStyle, ...floatingPanelSizeStyle }}
        onPointerDown={handleFloatingPanelPointerDown}
      >
        <div className="px-2 py-1 flex flex-col gap-1 min-w-[260px] min-h-[36px] h-full">
          <div className={`flex items-center justify-between gap-2 w-full select-none ${floatingPanelPinned ? 'cursor-move' : ''}`}>
            <div className={`flex items-center gap-1 min-w-0 ${uiPanelTextFontClass}`}>
              {viewButtons}
              {pipelineStatus && (
                <span className={`${uiPanelMicroLabelTextSizeClass} ${UI_THEME_TOKENS.text.tertiary} truncate max-w-[120px]`}>
                  {pipelineStatus}
                </span>
              )}
              {exportStatus && (
                <span className={`${uiPanelMicroLabelTextSizeClass} ${UI_THEME_TOKENS.text.tertiary} truncate max-w-[160px]`}>
                  {exportStatus}
                </span>
              )}
            </div>
            <HeaderActions
              onPinToggle={handlePinToggle}
              pinned={floatingPanelPinned}
              onMinimize={() => {
                setFloatingPanelMinimized(true)
              }}
              onClose={onClose}
            />
          </div>
          <div className={`mt-1 flex-1 min-h-0 overflow-y-auto overflow-x-hidden ${uiPanelTextFontClass} text-xs ${UI_THEME_TOKENS.text.primary}`}>
            {floatingPanelView === 'propsPanel' && <FloatingPropsPanel />}
            {floatingPanelView === 'renderer' && <ToolbarToolMenuRendererView />}
            {floatingPanelView === 'graphTraversal' && (
              <OrchestratorSettingsSection
                variant="floatingPanel"
                graphRagCollapsed={orchestratorGraphRagCollapsed}
                presetsCollapsed={orchestratorPresetsCollapsed}
                editorCollapsed={orchestratorEditorCollapsed}
                contextCollapsed={orchestratorContextCollapsed}
                setGraphRagCollapsed={setOrchestratorGraphRagCollapsed}
                setPresetsCollapsed={setOrchestratorPresetsCollapsed}
                setEditorCollapsed={setOrchestratorEditorCollapsed}
                setContextCollapsed={setOrchestratorContextCollapsed}
                indexingCollapsed={orchestratorWorkflowIndexingCollapsed}
                setIndexingCollapsed={setOrchestratorWorkflowIndexingCollapsed}
                tracingCollapsed={orchestratorWorkflowTracingCollapsed}
                setTracingCollapsed={setOrchestratorWorkflowTracingCollapsed}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
