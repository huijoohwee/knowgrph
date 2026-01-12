import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { GitBranch, MonitorPlay, PanelsTopLeft, SlidersHorizontal, Shapes } from 'lucide-react'
import type { ToolMenuAction, ToolMenuArea, ToolMenuPayload } from '@/features/toolbar/toolMenu'
import { useOrchestratorBottomPanelState } from '@/features/panels/hooks/useOrchestratorBottomPanelState'
import { GRAPH_TRAVERSAL_FLOATING_PANEL_EVENT } from '@/features/panels/utils/useMainPanelRect'
import OrchestratorSettingsSection from '@/features/panels/views/OrchestratorSettingsSection'
import IconButton from '@/components/IconButton'
import { ToolbarToolMenuAreas } from '@/features/toolbar/ToolbarToolMenuAreas'
import { ToolbarToolMenuRendererView } from '@/features/toolbar/ToolbarToolMenuRendererView'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getIconSizeClass } from '@/lib/ui'
import { uiPrimaryPillActiveClassName } from '@/features/graph-data-table/ui/GraphDataTableToolbarStyles'
import {
  LS_KEYS,
  UI_LABELS,
  UI_SELECTORS,
} from '@/lib/config'
import { lsBool, lsSetBool } from '@/lib/persistence'
import HeaderActions from '@/features/panels/ui/HeaderActions'
import { FloatingPropsPanel } from '@/features/toolbar/FloatingPropsPanel'
import GraphLayerView from '@/features/panels/views/GraphLayerView'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { MermaidDiagram } from '@/features/panels/views/preview-panel/ui/MermaidDiagram'
import {
  type MermaidInitConfig,
  useRootThemeMode,
} from '@/features/panels/views/preview-panel/ui/mermaidConfig'

interface ToolbarToolMenuProps {
  dataLoadOk: boolean | null
  dataLoadMsg: string
  parserLoadOk: boolean | null
  parserLoadMsg: string
  parserPreferredLanguage: 'json' | 'text' | 'yaml'
  schemaOpOk: boolean | null
  schemaOpMsg: string | null
  graphFieldsOpOk: boolean | null
  graphFieldsOpMsg: string | null
  orchestratorOpOk: boolean | null
  orchestratorOpMsg: string | null
  renderOpOk: boolean | null
  renderOpMsg: string | null
  pipelineStatus: string | null
  exportStatus: string | null
  isSourceFilesImportMenuOpen: boolean
  setIsSourceFilesImportMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  isSourceFilesExportMenuOpen: boolean
  setIsSourceFilesExportMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  isCuratorExportMenuOpen: boolean
  setIsCuratorExportMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  isParserExportMenuOpen: boolean
  setIsParserExportMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  isMarkdownImportMenuOpen: boolean
  setIsMarkdownImportMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  isHtmlImportMenuOpen: boolean
  setIsHtmlImportMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  isPdfImportMenuOpen: boolean
  setIsPdfImportMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  isJsonImportMenuOpen: boolean
  setIsJsonImportMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  isJsonLdImportMenuOpen: boolean
  setIsJsonLdImportMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  isSchemaExportMenuOpen: boolean
  setIsSchemaExportMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  isGraphFieldsExportMenuOpen: boolean
  setIsGraphFieldsExportMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  isSettingsExportMenuOpen: boolean
  setIsSettingsExportMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  isHistoryExportMenuOpen: boolean
  setIsHistoryExportMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  isValidationExportMenuOpen: boolean
  setIsValidationExportMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  onExportSchemaJson: () => void
  onExportSchemaJsonLd: () => void
  onExportSchemaCsv: () => void
  onExportGraphJsonLd: () => void
  onExportGraphJson: () => void
  onExportGraphCsvCombined: () => void
  onExportGraphMl: () => void
  onExportGraphCypher: () => void
  onCopyGraphJsonLd?: () => void
  onCopyGraphJson?: () => void
  hasSelection: boolean
  onExportSelectionJsonLd?: () => void
  onExportSelectionJson?: () => void
  onExportSelectionCsvCombined?: () => void
  onExportSelectionGraphMl?: () => void
  onExportSelectionCypher?: () => void
  onCopySchemaJsonLd?: () => void
  onCopySchemaJson?: () => void
  onExportGraphFieldSettingsJsonLd: () => void
  onExportSettingsJsonLd: () => void
  onExportHistoryJsonLd: () => void
  onExportValidationJson: () => void
  onExportValidationMarkdown: () => void
  onExportSelectionValidationJson?: () => void
  onExportSelectionValidationMarkdown?: () => void
  toolMenuCardRef: React.RefObject<HTMLDivElement>
  toolMenuCardStyle: React.CSSProperties
  onHeaderPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void
  requestedFloatingPanelView?: 'workspaceActions' | 'propsPanel' | 'graphLayer' | 'renderer' | 'graphTraversal' | 'mermaidFocus'
  requestedFloatingPanelViewSeq?: number
  onOpenData: () => void
  onRunPipeline: () => void
  onRunDemo?: () => void
  onClose: () => void
  onToolMenuAction: (
    area: ToolMenuArea,
    action: ToolMenuAction,
    payload?: ToolMenuPayload,
  ) => void
  onOpenWorkflowTab: () => void
}

type FloatingPanelView = 'workspaceActions' | 'propsPanel' | 'graphLayer' | 'renderer' | 'graphTraversal' | 'mermaidFocus'

const extractMermaidSubgraphCode = (code: string, subgraphName: string): string => {
  const text = String(code || '')
  if (!text) return ''
  const lines = text.split('\n')
  if (lines.length === 0) return ''

  let graphLine: string | null = null
  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim()
    if (!trimmed) continue
    if (trimmed.startsWith('graph ')) {
      graphLine = lines[i]
      break
    }
  }
  if (!graphLine) return text

  const name = String(subgraphName || '').trim()
  if (!name) return text

  const startRe = new RegExp(`^\\s*subgraph\\s+${name}\\b`)

  const body: string[] = []
  let inTarget = false
  let depth = 0
  let targetDepth = 0

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const trimmed = line.trim()
    if (!trimmed) continue
    if (trimmed.startsWith('graph ')) continue

    if (/^\s*subgraph\b/.test(trimmed)) {
      const isTarget = startRe.test(trimmed)
      if (isTarget && !inTarget) {
        inTarget = true
        depth += 1
        targetDepth = depth
        body.push(line)
      } else {
        depth += 1
        if (inTarget) body.push(line)
      }
      continue
    }

    if (trimmed === 'end') {
      if (inTarget) {
        body.push(line)
        depth -= 1
        if (depth < targetDepth) {
          break
        }
      } else if (depth > 0) {
        depth -= 1
      }
      continue
    }

    if (inTarget) body.push(line)
  }

  if (!inTarget || body.length === 0) return text
  const out: string[] = []
  out.push(graphLine)
  for (let i = 0; i < body.length; i += 1) out.push(body[i])
  return out.join('\n')
}

const resolveMermaidDiagramFromGraph = (graphData: GraphData | null): { code: string } | null => {
  if (!graphData || !Array.isArray(graphData.nodes)) return null
  for (let i = 0; i < graphData.nodes.length; i += 1) {
    const node = graphData.nodes[i] as GraphNode
    const type = String(node.type || '')
    if (type !== 'MermaidDiagram') continue
    const props = (node.properties || {}) as Record<string, unknown> | undefined
    if (!props) continue
    const rawCode = props.code
    const code = typeof rawCode === 'string' ? rawCode.trim() : ''
    if (!code) continue
    return { code }
  }
  return null
}

function MermaidFocusPanel() {
  const graphData = useGraphStore(s => s.graphData as GraphData | null)
  const schema = useGraphStore(s => s.schema)
  const selectedNodeId = useGraphStore(s => s.selectedNodeId || null)
  const mermaidFocusCode = useGraphStore(s => s.markdownPreviewMermaidFocusCode || '')
  const mermaidFocusConfig = useGraphStore(s => s.markdownPreviewMermaidFocusConfig || null)
  const frontmatterModeEnabled = useGraphStore(s => s.frontmatterModeEnabled || false)
  const uiPanelTextFontClass = useGraphStore(
    s => s.uiPanelTextFontClass || 'font-sans',
  )
  const rootThemeMode = useRootThemeMode()
  const [overlayPortalTarget, setOverlayPortalTarget] = React.useState<HTMLDivElement | null>(null)
  const setOverlayPortalRef = React.useCallback((el: HTMLDivElement | null) => {
    setOverlayPortalTarget(prev => (prev === el ? prev : el))
  }, [])

  const fallback = React.useMemo(() => resolveMermaidDiagramFromGraph(graphData), [graphData])
  const baseCode = React.useMemo(() => {
    const fromFocus = String(mermaidFocusCode || '').trim()
    if (!frontmatterModeEnabled && fromFocus) return fromFocus
    const fromGraph = fallback?.code ? String(fallback.code || '').trim() : ''
    if (fromGraph) return fromGraph
    return fromFocus
  }, [fallback, mermaidFocusCode, frontmatterModeEnabled])

  const selectedSubgraphName = React.useMemo(() => {
    const id = selectedNodeId ? String(selectedNodeId) : ''
    if (!graphData || !id) return ''
    const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : []
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i] as GraphNode
      if (String(n.id) !== id) continue
      const type = String(n.type || '')
      if (type !== 'MermaidNode') return ''
      const props = (n.properties || {}) as Record<string, unknown>
      const rawName = props.mermaidSubgraphName
      const name = typeof rawName === 'string' ? rawName.trim() : ''
      return name
    }
    return ''
  }, [graphData, selectedNodeId])

  const effectiveCode = React.useMemo(() => {
    const raw = baseCode
    if (!raw) return ''
    const mode = schema?.layout?.mode || 'force'
    if (mode !== 'tidy-tree') return raw
    if (!selectedSubgraphName) return raw
    return extractMermaidSubgraphCode(raw, selectedSubgraphName)
  }, [baseCode, schema, selectedSubgraphName])

  if (!effectiveCode) {
    return (
      <div ref={setOverlayPortalRef} className="h-full min-h-0 flex items-center justify-center px-3">
        <div className={['text-xs text-gray-600 text-center', uiPanelTextFontClass].join(' ')}>
          No Mermaid diagram is available for the current graph.
        </div>
      </div>
    )
  }

  return (
    <div ref={setOverlayPortalRef} className="h-full min-h-0 flex flex-col overflow-hidden relative">
      <div className="w-full h-full flex items-center justify-center">
        <div className="aspect-video w-full max-w-4xl">
          <div className="w-full h-full overflow-auto">
            <MermaidDiagram
              code={effectiveCode}
              highlightClass=""
              frontmatterConfig={mermaidFocusConfig as MermaidInitConfig | null}
              rootThemeMode={rootThemeMode}
              overlayScope="container"
              overlayPortalTarget={overlayPortalTarget}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export function ToolbarToolMenu({
  dataLoadOk,
  dataLoadMsg,
  parserLoadOk,
  parserLoadMsg,
  parserPreferredLanguage,
  schemaOpOk,
  schemaOpMsg,
  graphFieldsOpOk,
  graphFieldsOpMsg,
  orchestratorOpOk,
  orchestratorOpMsg,
  renderOpOk,
  renderOpMsg,
  pipelineStatus,
  exportStatus,
  isSourceFilesImportMenuOpen,
  setIsSourceFilesImportMenuOpen,
  isSourceFilesExportMenuOpen,
  setIsSourceFilesExportMenuOpen,
  isCuratorExportMenuOpen,
  setIsCuratorExportMenuOpen,
  isParserExportMenuOpen,
  setIsParserExportMenuOpen,
  isMarkdownImportMenuOpen,
  setIsMarkdownImportMenuOpen,
  isHtmlImportMenuOpen,
  setIsHtmlImportMenuOpen,
  isPdfImportMenuOpen,
  setIsPdfImportMenuOpen,
  isJsonImportMenuOpen,
  setIsJsonImportMenuOpen,
  isJsonLdImportMenuOpen,
  setIsJsonLdImportMenuOpen,
  isSchemaExportMenuOpen,
  setIsSchemaExportMenuOpen,
  isGraphFieldsExportMenuOpen,
  setIsGraphFieldsExportMenuOpen,
  isSettingsExportMenuOpen,
  setIsSettingsExportMenuOpen,
  isHistoryExportMenuOpen,
  setIsHistoryExportMenuOpen,
  isValidationExportMenuOpen,
  setIsValidationExportMenuOpen,
  onExportSchemaJson,
  onExportSchemaJsonLd,
  onExportSchemaCsv,
  onExportGraphJsonLd,
  onExportGraphJson,
  onExportGraphCsvCombined,
  onExportGraphMl,
  onExportGraphCypher,
  onCopyGraphJsonLd,
  onCopyGraphJson,
  hasSelection,
  onExportSelectionJsonLd,
  onExportSelectionJson,
  onExportSelectionCsvCombined,
  onExportSelectionGraphMl,
  onExportSelectionCypher,
  onCopySchemaJsonLd,
  onCopySchemaJson,
  onExportGraphFieldSettingsJsonLd,
  onExportSettingsJsonLd,
  onExportHistoryJsonLd,
  onExportValidationJson,
  onExportValidationMarkdown,
  onExportSelectionValidationJson,
  onExportSelectionValidationMarkdown,
  toolMenuCardRef,
  toolMenuCardStyle,
  onHeaderPointerDown,
  requestedFloatingPanelView,
  requestedFloatingPanelViewSeq,
  onOpenData,
  onRunPipeline,
  onRunDemo,
  onClose,
  onToolMenuAction,
  onOpenWorkflowTab,
}: ToolbarToolMenuProps) {
  const [floatingPanelPinned, setFloatingPanelPinned] = React.useState(() => lsBool(LS_KEYS.floatingPanelPinned, true))
  const [floatingPanelMinimized, setFloatingPanelMinimized] = React.useState(false)
  const [floatingPanelView, setFloatingPanelView] = React.useState<FloatingPanelView>('workspaceActions')
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')
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
    setSearchOpen(false)
    setSearchQuery('')
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
        title={UI_LABELS.workspaceActions}
        onClick={() => handleSelectView('workspaceActions')}
        className={`App-toolbar__btn ${
          floatingPanelView === 'workspaceActions' ? uiPrimaryPillActiveClassName : 'text-gray-700'
        }`}
        showTooltip
      >
        <PanelsTopLeft className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
      </IconButton>
      <IconButton
        title={UI_LABELS.propsPanel}
        onClick={() => handleSelectView('propsPanel')}
        className={`App-toolbar__btn ${
          floatingPanelView === 'propsPanel' ? uiPrimaryPillActiveClassName : 'text-gray-700'
        }`}
        showTooltip
      >
        <SlidersHorizontal className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
      </IconButton>
      <IconButton
        title={UI_LABELS.graphLayersMode}
        onClick={() => handleSelectView('graphLayer')}
        className={`App-toolbar__btn ${
          floatingPanelView === 'graphLayer' ? uiPrimaryPillActiveClassName : 'text-gray-700'
        }`}
        showTooltip
      >
        <Shapes className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
      </IconButton>
      <IconButton
        title={UI_LABELS.renderer}
        onClick={() => handleSelectView('renderer')}
        className={`App-toolbar__btn ${
          floatingPanelView === 'renderer' ? uiPrimaryPillActiveClassName : 'text-gray-700'
        }`}
        showTooltip
      >
        <MonitorPlay className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
      </IconButton>
      <IconButton
        title={UI_LABELS.graphTraversal}
        onClick={() => handleSelectView('graphTraversal')}
        className={`App-toolbar__btn ${
          floatingPanelView === 'graphTraversal' ? uiPrimaryPillActiveClassName : 'text-gray-700'
        }`}
        showTooltip
      >
        <GitBranch className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
      </IconButton>
      <IconButton
        title={UI_LABELS.mermaidFocus}
        onClick={() => handleSelectView('mermaidFocus')}
        className={`App-toolbar__btn ${
          floatingPanelView === 'mermaidFocus' ? uiPrimaryPillActiveClassName : 'text-gray-700'
        }`}
        showTooltip
      >
        <MonitorPlay className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
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
    setSearchOpen(false)
    setSearchQuery('')
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
          <div className="flex items-center gap-1 min-w-0">
              {viewButtons}
              {pipelineStatus && (
                <span className={`${uiPanelMicroLabelTextSizeClass} text-gray-500 truncate max-w-[120px]`}>
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
        className="pointer-events-auto ModalContainer flex flex-col overflow-hidden p-0"
        style={{ ...toolMenuCardStyle, ...floatingPanelSizeStyle }}
        onPointerDown={handleFloatingPanelPointerDown}
      >
        <div className="px-2 py-1 flex flex-col gap-1 min-w-[260px] min-h-[36px] h-full">
          <div className={`flex items-center justify-between gap-2 w-full select-none ${floatingPanelPinned ? 'cursor-move' : ''}`}>
            <div className="flex items-center gap-1 min-w-0">
              {viewButtons}
              {pipelineStatus && (
                <span className={`${uiPanelMicroLabelTextSizeClass} text-gray-500 truncate max-w-[120px]`}>
                  {pipelineStatus}
                </span>
              )}
              {exportStatus && (
                <span className={`${uiPanelMicroLabelTextSizeClass} text-gray-500 truncate max-w-[160px]`}>
                  {exportStatus}
                </span>
              )}
            </div>
            <HeaderActions
              onSearchToggle={
                floatingPanelView === 'workspaceActions'
                  ? () => setSearchOpen(v => !v)
                  : undefined
              }
              onPinToggle={handlePinToggle}
              pinned={floatingPanelPinned}
              onMinimize={() => {
                setFloatingPanelMinimized(true)
              }}
              onClose={onClose}
            />
          </div>
          {floatingPanelView === 'workspaceActions' && (
            <div
              className={`transition-opacity duration-150 ${searchOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              aria-hidden={!searchOpen}
            >
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={UI_LABELS.search}
                className="h-7 w-full px-2 text-xs border border-gray-300 rounded-lg bg-white"
              />
            </div>
          )}
          <div className="mt-1 -mx-1 px-1 pb-1 border-t border-gray-100 flex-1 min-h-0 overflow-y-auto overflow-x-hidden text-xs text-gray-700">
            {floatingPanelView === 'workspaceActions' && (
              <ToolbarToolMenuAreas
                dataLoadOk={dataLoadOk}
                dataLoadMsg={dataLoadMsg}
                parserLoadOk={parserLoadOk}
                parserLoadMsg={parserLoadMsg}
                parserPreferredLanguage={parserPreferredLanguage}
                schemaOpOk={schemaOpOk}
                schemaOpMsg={schemaOpMsg}
                graphFieldsOpOk={graphFieldsOpOk}
                graphFieldsOpMsg={graphFieldsOpMsg}
                orchestratorOpOk={orchestratorOpOk}
                orchestratorOpMsg={orchestratorOpMsg}
                renderOpOk={renderOpOk}
                renderOpMsg={renderOpMsg}
                isSourceFilesImportMenuOpen={isSourceFilesImportMenuOpen}
                setIsSourceFilesImportMenuOpen={setIsSourceFilesImportMenuOpen}
                isSourceFilesExportMenuOpen={isSourceFilesExportMenuOpen}
                setIsSourceFilesExportMenuOpen={setIsSourceFilesExportMenuOpen}
                isCuratorExportMenuOpen={isCuratorExportMenuOpen}
                setIsCuratorExportMenuOpen={setIsCuratorExportMenuOpen}
                isParserExportMenuOpen={isParserExportMenuOpen}
                setIsParserExportMenuOpen={setIsParserExportMenuOpen}
                isMarkdownImportMenuOpen={isMarkdownImportMenuOpen}
                setIsMarkdownImportMenuOpen={setIsMarkdownImportMenuOpen}
                isHtmlImportMenuOpen={isHtmlImportMenuOpen}
                setIsHtmlImportMenuOpen={setIsHtmlImportMenuOpen}
                isPdfImportMenuOpen={isPdfImportMenuOpen}
                setIsPdfImportMenuOpen={setIsPdfImportMenuOpen}
                isJsonImportMenuOpen={isJsonImportMenuOpen}
                setIsJsonImportMenuOpen={setIsJsonImportMenuOpen}
                isJsonLdImportMenuOpen={isJsonLdImportMenuOpen}
                setIsJsonLdImportMenuOpen={setIsJsonLdImportMenuOpen}
                isSchemaExportMenuOpen={isSchemaExportMenuOpen}
                setIsSchemaExportMenuOpen={setIsSchemaExportMenuOpen}
                isGraphFieldsExportMenuOpen={isGraphFieldsExportMenuOpen}
                setIsGraphFieldsExportMenuOpen={setIsGraphFieldsExportMenuOpen}
                isSettingsExportMenuOpen={isSettingsExportMenuOpen}
                setIsSettingsExportMenuOpen={setIsSettingsExportMenuOpen}
                isHistoryExportMenuOpen={isHistoryExportMenuOpen}
                setIsHistoryExportMenuOpen={setIsHistoryExportMenuOpen}
                isValidationExportMenuOpen={isValidationExportMenuOpen}
                setIsValidationExportMenuOpen={setIsValidationExportMenuOpen}
                onExportSchemaJson={onExportSchemaJson}
                onExportSchemaJsonLd={onExportSchemaJsonLd}
                onExportSchemaCsv={onExportSchemaCsv}
                onExportGraphJsonLd={onExportGraphJsonLd}
                onExportGraphJson={onExportGraphJson}
                onExportGraphCsvCombined={onExportGraphCsvCombined}
                onExportGraphMl={onExportGraphMl}
                onExportGraphCypher={onExportGraphCypher}
                onCopyGraphJsonLd={onCopyGraphJsonLd}
                onCopyGraphJson={onCopyGraphJson}
                hasSelection={hasSelection}
                onExportSelectionJsonLd={onExportSelectionJsonLd}
                onExportSelectionJson={onExportSelectionJson}
                onExportSelectionCsvCombined={onExportSelectionCsvCombined}
                onExportSelectionGraphMl={onExportSelectionGraphMl}
                onExportSelectionCypher={onExportSelectionCypher}
                onCopySchemaJsonLd={onCopySchemaJsonLd}
                onCopySchemaJson={onCopySchemaJson}
                onExportGraphFieldSettingsJsonLd={onExportGraphFieldSettingsJsonLd}
                onExportSettingsJsonLd={onExportSettingsJsonLd}
                onExportHistoryJsonLd={onExportHistoryJsonLd}
                onExportValidationJson={onExportValidationJson}
                onExportValidationMarkdown={onExportValidationMarkdown}
                onExportSelectionValidationJson={onExportSelectionValidationJson}
                onExportSelectionValidationMarkdown={onExportSelectionValidationMarkdown}
                onToolMenuAction={onToolMenuAction}
                onOpenWorkflowTab={onOpenWorkflowTab}
                onOpenData={onOpenData}
                onRunPipeline={onRunPipeline}
                onRunDemo={onRunDemo}
                searchQuery={searchOpen ? searchQuery : ''}
              />
            )}
            {floatingPanelView === 'propsPanel' && (
              <FloatingPropsPanel />
            )}
            {floatingPanelView === 'graphLayer' && (
              <GraphLayerView />
            )}
            {floatingPanelView === 'renderer' && (
              <ToolbarToolMenuRendererView />
            )}
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
            {floatingPanelView === 'mermaidFocus' && (
              <MermaidFocusPanel />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
