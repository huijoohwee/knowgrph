import React from 'react'
import { DropdownPanel } from '@/lib/ui/overlay'
import { ArrowUpDown, BarChart3, ChevronDown, Filter, Focus, Group, Plus, SlidersHorizontal, Eraser } from 'lucide-react'
import { UI_ANCHORS, UI_COPY, UI_LABELS } from '@/lib/config'
import { MAIN_PANEL_OPEN_EVENT } from '@/features/panels/utils/useMainPanelRect'
import type { GraphDataTablePanel } from '@/features/graph-data-table/ui/GraphDataTablePanelOverlay'
import type { GraphDataTableRowDensity } from '@/features/graph-data-table/graphDataTable'
import { graphDataTableToolbarButtonClassName, GRAPH_DATA_TABLE_TOOLBAR_ACTIVE_CLASS, uiPrimaryChipActiveClassName } from '@/features/graph-data-table/ui/GraphDataTableToolbarStyles'
import type { GraphDataTableScope } from './BottomPanelCuratorToolbarModel'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getIconSizeClass } from '@/lib/ui'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

interface BottomPanelCuratorToolbarProps {
  graphDataTablePanel: GraphDataTablePanel
  setGraphDataTablePanel: React.Dispatch<React.SetStateAction<GraphDataTablePanel>>
  graphDataTableScope: GraphDataTableScope
  setGraphDataTableScope: (scope: GraphDataTableScope) => void
  viewMode: 'allRows' | 'selectionNeighborhood' | 'traversalSequence'
  setViewMode: (mode: 'allRows' | 'selectionNeighborhood' | 'traversalSequence') => void
  selectedNodeId: string | null
  selectedEdgeId: string | null
  onDeleteSelected: () => void
  onAddNode: () => void
  onAddEdge: () => void
  nodesCount: number
  fieldsMenuRef: React.RefObject<HTMLButtonElement>
  filterMenuRef: React.RefObject<HTMLButtonElement>
  sortMenuRef: React.RefObject<HTMLButtonElement>
  groupMenuRef: React.RefObject<HTMLButtonElement>
  resetToken: number
  rowDensity: GraphDataTableRowDensity
  setRowDensity: (density: GraphDataTableRowDensity) => void
  isAutoScrollDisabled: boolean
  setIsAutoScrollDisabled: (value: boolean) => void
}

export function BottomPanelCuratorToolbar({
  graphDataTablePanel,
  setGraphDataTablePanel,
  graphDataTableScope,
  setGraphDataTableScope,
  viewMode,
  setViewMode,
  selectedNodeId,
  selectedEdgeId,
  onDeleteSelected,
  onAddNode,
  onAddEdge,
  nodesCount,
  fieldsMenuRef,
  filterMenuRef,
  sortMenuRef,
  groupMenuRef,
  resetToken,
  rowDensity,
  setRowDensity,
  isAutoScrollDisabled,
  setIsAutoScrollDisabled,
}: BottomPanelCuratorToolbarProps) {
  const filterClauses = useGraphStore(s => s.graphDataTableFilterClauses)
  const sortRules = useGraphStore(s => s.graphDataTableSortRules)
  const visibleColumns = useGraphStore(s => s.graphDataTableVisibleColumns)
  const lastTraversalSummary = useGraphStore(s => s.lastTraversalSummary)
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth)
  const uiPanelMonospaceTextClass = useGraphStore(
    s => s.uiPanelMonospaceTextClass || 'font-mono text-xs',
  )
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-xs',
  )
  const aggregateDefaultVizMode = useGraphStore(s => s.graphDataTableAggregateDefaultVizMode)
  const setAggregateDefaultVizMode = useGraphStore(s => s.setGraphDataTableAggregateDefaultVizMode)
  const iconSizeClass = getIconSizeClass(uiIconScale)
  const [isAddMenuOpen, setIsAddMenuOpen] = React.useState(false)
  const addMenuRef = React.useRef<HTMLButtonElement>(null)
  const [isScopeMenuOpen, setIsScopeMenuOpen] = React.useState(false)
  const scopeMenuRef = React.useRef<HTMLButtonElement>(null)
  const [isDensityMenuOpen, setIsDensityMenuOpen] = React.useState(false)
  const densityMenuRef = React.useRef<HTMLButtonElement>(null)

  const hasFilters = filterClauses.length > 0
  const hasSorts = sortRules.length > 0
  const hiddenColumnCount = React.useMemo(() => {
    if (!visibleColumns) return 0
    return Object.values(visibleColumns).filter(v => v === false).length
  }, [visibleColumns])

  React.useEffect(() => {
    setIsAddMenuOpen(false)
    setIsScopeMenuOpen(false)
    setIsDensityMenuOpen(false)
  }, [resetToken])

  return (
    <div className={`flex h-[48px] items-center border-b ${UI_THEME_TOKENS.panel.divider} px-2 py-2 gap-2`}>
      <button
        ref={addMenuRef}
        type="button"
        className={graphDataTableToolbarButtonClassName(false)}
        onClick={() => setIsAddMenuOpen(value => !value)}
      >
        <Plus className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
        Add record
        <ChevronDown className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
      </button>
      {isAddMenuOpen && (
        <DropdownPanel anchorRef={addMenuRef} open={isAddMenuOpen} onClose={() => setIsAddMenuOpen(false)} align="bottom-left">
          <div className="p-1 flex flex-col gap-1 w-40">
            <button
              type="button"
              className={graphDataTableToolbarButtonClassName(false)}
              onClick={() => {
                setIsAddMenuOpen(false)
                onAddNode()
              }}
            >
              Add Node
            </button>
            <button
              type="button"
              className={graphDataTableToolbarButtonClassName(false)}
              onClick={() => {
                setIsAddMenuOpen(false)
                onAddEdge()
              }}
              disabled={nodesCount < 2}
            >
              Add Edge
            </button>
          </div>
        </DropdownPanel>
      )}

      <div className="flex flex-1 items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            ref={fieldsMenuRef}
            type="button"
            className={`${graphDataTableToolbarButtonClassName(graphDataTablePanel === 'fields')} ${
              graphDataTablePanel === 'fields' ? GRAPH_DATA_TABLE_TOOLBAR_ACTIVE_CLASS : ''
            }`}
            onClick={() => {
              setGraphDataTablePanel('none')
              try {
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent(MAIN_PANEL_OPEN_EVENT, { detail: { tab: 'graphFields' } }))
                }
              } catch {
                void 0
              }
            }}
            data-kg-anchor={UI_ANCHORS.graphFields}
          >
            <SlidersHorizontal className={iconSizeClass} strokeWidth={uiIconStrokeWidth} /> {UI_LABELS.graphFields}
            {hiddenColumnCount > 0 && (
              <span className={`${uiPanelKeyValueTextSizeClass} text-gray-500 ml-1`}>({hiddenColumnCount} hidden)</span>
            )}
          </button>
          <button
            ref={filterMenuRef}
            type="button"
            className={`${graphDataTableToolbarButtonClassName(graphDataTablePanel === 'filter' || hasFilters)} ${
              graphDataTablePanel === 'filter' || hasFilters ? GRAPH_DATA_TABLE_TOOLBAR_ACTIVE_CLASS : ''
            }`}
            onClick={() => setGraphDataTablePanel(panel => (panel === 'filter' ? 'none' : 'filter'))}
          >
            <Filter className={iconSizeClass} strokeWidth={uiIconStrokeWidth} /> Filter
          </button>
          <button
            ref={sortMenuRef}
            type="button"
            className={`${graphDataTableToolbarButtonClassName(graphDataTablePanel === 'sort' || hasSorts)} ${
              graphDataTablePanel === 'sort' || hasSorts ? GRAPH_DATA_TABLE_TOOLBAR_ACTIVE_CLASS : ''
            }`}
            onClick={() => setGraphDataTablePanel(panel => (panel === 'sort' ? 'none' : 'sort'))}
          >
            <ArrowUpDown className={iconSizeClass} strokeWidth={uiIconStrokeWidth} /> Sort
          </button>
          <button
            ref={groupMenuRef}
            type="button"
            className={`${graphDataTableToolbarButtonClassName(graphDataTablePanel === 'group')} ${
              graphDataTablePanel === 'group' ? GRAPH_DATA_TABLE_TOOLBAR_ACTIVE_CLASS : ''
            }`}
            onClick={() => setGraphDataTablePanel(panel => (panel === 'group' ? 'none' : 'group'))}
          >
            <Group className={iconSizeClass} strokeWidth={uiIconStrokeWidth} /> Group
          </button>
          <button
            ref={scopeMenuRef}
            type="button"
            className={`${graphDataTableToolbarButtonClassName(isScopeMenuOpen)} ${
              isScopeMenuOpen ? GRAPH_DATA_TABLE_TOOLBAR_ACTIVE_CLASS : ''
            }`}
            onClick={() => setIsScopeMenuOpen(value => !value)}
          >
            {graphDataTableScope === 'all' ? 'All' : graphDataTableScope === 'nodes' ? 'Nodes' : 'Edges'}{' '}
            <ChevronDown className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
          </button>
          {isScopeMenuOpen && (
            <DropdownPanel anchorRef={scopeMenuRef} open={isScopeMenuOpen} onClose={() => setIsScopeMenuOpen(false)} align="bottom-left">
              <div className="p-1 flex flex-col gap-1 w-32">
                <button
                  type="button"
                  className={`${graphDataTableToolbarButtonClassName(graphDataTableScope === 'all')} ${
                    graphDataTableScope === 'all' ? GRAPH_DATA_TABLE_TOOLBAR_ACTIVE_CLASS : ''
                  }`}
                  onClick={() => {
                    setGraphDataTableScope('all')
                    setIsScopeMenuOpen(false)
                  }}
                >
                  All
                </button>
                <button
                  type="button"
                  className={`${graphDataTableToolbarButtonClassName(graphDataTableScope === 'nodes')} ${
                    graphDataTableScope === 'nodes' ? GRAPH_DATA_TABLE_TOOLBAR_ACTIVE_CLASS : ''
                  }`}
                  onClick={() => {
                    setGraphDataTableScope('nodes')
                    setIsScopeMenuOpen(false)
                  }}
                >
                  Nodes
                </button>
                <button
                  type="button"
                  className={`${graphDataTableToolbarButtonClassName(graphDataTableScope === 'edges')} ${
                    graphDataTableScope === 'edges' ? GRAPH_DATA_TABLE_TOOLBAR_ACTIVE_CLASS : ''
                  }`}
                  onClick={() => {
                    setGraphDataTableScope('edges')
                    setIsScopeMenuOpen(false)
                  }}
                >
                  Edges
                </button>
              </div>
            </DropdownPanel>
          )}
          <div className="relative">
            <button
              ref={densityMenuRef}
              type="button"
              className={`${graphDataTableToolbarButtonClassName(isDensityMenuOpen)} ${
                isDensityMenuOpen ? GRAPH_DATA_TABLE_TOOLBAR_ACTIVE_CLASS : ''
              }`}
              onClick={() => setIsDensityMenuOpen(value => !value)}
          >
              <BarChart3 className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
              Table view
              <ChevronDown className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
            </button>
            {isDensityMenuOpen && (
              <DropdownPanel
                anchorRef={densityMenuRef}
                open={isDensityMenuOpen}
                onClose={() => setIsDensityMenuOpen(false)}
                align="bottom-left"
              >
                <div className="flex flex-col gap-2 w-48 p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-gray-800">Table view</div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      className={`${graphDataTableToolbarButtonClassName(rowDensity === 'compact')} ${
                        rowDensity === 'compact' ? GRAPH_DATA_TABLE_TOOLBAR_ACTIVE_CLASS : ''
                      }`}
                      onClick={() => {
                        setRowDensity('compact')
                        setIsDensityMenuOpen(false)
                      }}
                    >
                      Compact rows
                    </button>
                    <button
                      type="button"
                      className={`${graphDataTableToolbarButtonClassName(rowDensity === 'expanded')} ${
                        rowDensity === 'expanded' ? GRAPH_DATA_TABLE_TOOLBAR_ACTIVE_CLASS : ''
                      }`}
                      onClick={() => {
                        setRowDensity('expanded')
                        setIsDensityMenuOpen(false)
                      }}
                    >
                      Expanded rows
                    </button>
                    <div className="h-px my-2 bg-gray-200" />
                    <div className="flex flex-col gap-1">
                      <div className="font-medium text-gray-800">{UI_COPY.graphDataTableAggregateChartsTitle}</div>
                      <button
                        type="button"
                        className={`${graphDataTableToolbarButtonClassName(
                          aggregateDefaultVizMode === 'none',
                        )} ${
                          aggregateDefaultVizMode === 'none'
                            ? GRAPH_DATA_TABLE_TOOLBAR_ACTIVE_CLASS
                            : ''
                        }`}
                        onClick={() => {
                          setAggregateDefaultVizMode('none')
                          setIsDensityMenuOpen(false)
                        }}
                      >
                        {UI_COPY.graphDataTableAggregateChartsStartOff}
                      </button>
                      <button
                        type="button"
                        className={`${graphDataTableToolbarButtonClassName(
                          aggregateDefaultVizMode === 'radial',
                        )} ${
                          aggregateDefaultVizMode === 'radial'
                            ? GRAPH_DATA_TABLE_TOOLBAR_ACTIVE_CLASS
                            : ''
                        }`}
                        onClick={() => {
                          setAggregateDefaultVizMode('radial')
                          setIsDensityMenuOpen(false)
                        }}
                      >
                        {UI_COPY.graphDataTableAggregateChartsStartRadial}
                      </button>
                      <button
                        type="button"
                        className={`${graphDataTableToolbarButtonClassName(
                          aggregateDefaultVizMode === 'bars',
                        )} ${
                          aggregateDefaultVizMode === 'bars'
                            ? GRAPH_DATA_TABLE_TOOLBAR_ACTIVE_CLASS
                            : ''
                        }`}
                        onClick={() => {
                          setAggregateDefaultVizMode('bars')
                          setIsDensityMenuOpen(false)
                        }}
                      >
                        {UI_COPY.graphDataTableAggregateChartsStartBars}
                      </button>
                      <button
                        type="button"
                        className={`${graphDataTableToolbarButtonClassName(
                          aggregateDefaultVizMode === 'sparkline',
                        )} ${
                          aggregateDefaultVizMode === 'sparkline'
                            ? GRAPH_DATA_TABLE_TOOLBAR_ACTIVE_CLASS
                            : ''
                        }`}
                        onClick={() => {
                          setAggregateDefaultVizMode('sparkline')
                          setIsDensityMenuOpen(false)
                        }}
                      >
                        {UI_COPY.graphDataTableAggregateChartsStartSparkline}
                      </button>
                    </div>
                    <div className="h-px my-2 bg-gray-200" />
                    <button
                      type="button"
                      className={`${graphDataTableToolbarButtonClassName(isAutoScrollDisabled)} ${
                        isAutoScrollDisabled ? GRAPH_DATA_TABLE_TOOLBAR_ACTIVE_CLASS : ''
                      }`}
                      onClick={() => {
                        setIsAutoScrollDisabled(!isAutoScrollDisabled)
                        setIsDensityMenuOpen(false)
                      }}
                    >
                      {isAutoScrollDisabled ? 'Enable auto-scroll' : 'Disable auto-scroll'}
                    </button>
                  </div>
                </div>
              </DropdownPanel>
            )}
          </div>
          <button
            type="button"
            className={`${graphDataTableToolbarButtonClassName(viewMode === 'selectionNeighborhood')} ${
              viewMode === 'selectionNeighborhood' ? GRAPH_DATA_TABLE_TOOLBAR_ACTIVE_CLASS : ''
            }`}
            onClick={() => {
              if (!selectedNodeId && !selectedEdgeId) return
              if (viewMode === 'selectionNeighborhood') {
                setViewMode('allRows')
              } else {
                setGraphDataTableScope('all')
                setViewMode('selectionNeighborhood')
              }
            }}
            disabled={!selectedNodeId && !selectedEdgeId}
          >
            <Focus className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
            Selection view
          </button>
          <button
            type="button"
            className={`${graphDataTableToolbarButtonClassName(viewMode === 'traversalSequence')} ${
              viewMode === 'traversalSequence' ? GRAPH_DATA_TABLE_TOOLBAR_ACTIVE_CLASS : ''
            }`}
            onClick={() => {
              const hasTraversalEdges =
                !!lastTraversalSummary && Array.isArray(lastTraversalSummary.edgeIds) && lastTraversalSummary.edgeIds.length > 0
              if (!hasTraversalEdges) return
              if (viewMode === 'traversalSequence') {
                setViewMode('allRows')
              } else {
                setGraphDataTableScope('all')
                setViewMode('traversalSequence')
              }
            }}
            disabled={
              !lastTraversalSummary ||
              !Array.isArray(lastTraversalSummary.edgeIds) ||
              lastTraversalSummary.edgeIds.length === 0
            }
          >
            <Focus className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
            Traversal view
          </button>
          {viewMode === 'traversalSequence' &&
            lastTraversalSummary &&
            Array.isArray(lastTraversalSummary.edgeIds) &&
            lastTraversalSummary.edgeIds.length > 0 && (
              <span
                className={`ml-1 px-2 py-0.5 rounded-full ${uiPrimaryChipActiveClassName} ${uiPanelMonospaceTextClass}`}
              >
                {lastTraversalSummary.edgeIds.length.toLocaleString()} edges
              </span>
            )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            className={graphDataTableToolbarButtonClassName(false)}
            onClick={() => {
              if (selectedNodeId || selectedEdgeId) {
                onDeleteSelected()
              }
            }}
            disabled={!selectedNodeId && !selectedEdgeId}
          >
            <Eraser className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
