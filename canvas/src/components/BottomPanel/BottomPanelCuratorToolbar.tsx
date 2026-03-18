import React from 'react'
import { DropdownPanel } from '@/lib/ui/overlay'
import { ArrowUpDown, BarChart3, ChevronDown, Filter, Group, Plus, SlidersHorizontal, Eraser } from 'lucide-react'
import { UI_ANCHORS, UI_COPY, UI_LABELS } from '@/lib/config'
import { MAIN_PANEL_OPEN_EVENT } from '@/features/panels/utils/useMainPanelRect'
import type { GraphDataTablePanel } from '@/features/graph-data-table/ui/GraphDataTablePanelOverlay'
import type { GraphDataTableRowDensity } from '@/features/graph-data-table/graphDataTable'
import { graphDataTableToolbarButtonClassName, GRAPH_DATA_TABLE_TOOLBAR_ACTIVE_CLASS, uiPrimaryChipActiveClassName } from '@/features/graph-data-table/ui/GraphDataTableToolbarStyles'
import type { GraphDataTableScope } from './BottomPanelCuratorToolbarModel'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getIconSizeClass } from '@/lib/ui'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { WorkspaceHeader, WorkspaceHeaderRow } from '@/components/ui/WorkspaceHeader'
import { WorkspaceModeSelect } from '@/components/BottomPanel/markdownWorkspace/WorkspaceModeSelect'
import { useShallow } from 'zustand/react/shallow'

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
  const {
    filterClauses,
    sortRules,
    visibleColumns,
    lastTraversalSummary,
    uiIconScale,
    uiIconStrokeWidth,
    uiPanelMonospaceTextClass,
    uiPanelKeyValueTextSizeClass,
    aggregateDefaultVizMode,
    setAggregateDefaultVizMode,
  } = useGraphStore(
    useShallow(s => ({
      filterClauses: s.graphDataTableFilterClauses,
      sortRules: s.graphDataTableSortRules,
      visibleColumns: s.graphDataTableVisibleColumns,
      lastTraversalSummary: s.lastTraversalSummary,
      uiIconScale: s.uiIconScale,
      uiIconStrokeWidth: s.uiIconStrokeWidth,
      uiPanelMonospaceTextClass: s.uiPanelMonospaceTextClass || 'font-mono text-xs',
      uiPanelKeyValueTextSizeClass: s.uiPanelKeyValueTextSizeClass || 'text-xs',
      aggregateDefaultVizMode: s.graphDataTableAggregateDefaultVizMode,
      setAggregateDefaultVizMode: s.setGraphDataTableAggregateDefaultVizMode,
    })),
  )
  const iconSizeClass = getIconSizeClass(uiIconScale)
  const [isAddMenuOpen, setIsAddMenuOpen] = React.useState(false)
  const addMenuRef = React.useRef<HTMLButtonElement>(null)
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
    setIsDensityMenuOpen(false)
  }, [resetToken])

  const scopeOptions = React.useMemo(
    () =>
      [
        { value: 'all' as const, label: 'All' },
        { value: 'nodes' as const, label: 'Nodes' },
        { value: 'edges' as const, label: 'Edges' },
      ] satisfies Array<{ value: GraphDataTableScope; label: string }>,
    [],
  )

  const viewModeOptions = React.useMemo(
    () =>
      [
        { value: 'allRows' as const, label: 'All rows' },
        { value: 'selectionNeighborhood' as const, label: 'Selection view' },
        { value: 'traversalSequence' as const, label: 'Traversal view' },
      ] satisfies Array<{ value: BottomPanelCuratorToolbarProps['viewMode']; label: string }>,
    [],
  )

  const hasTraversalEdges =
    !!lastTraversalSummary && Array.isArray(lastTraversalSummary.edgeIds) && lastTraversalSummary.edgeIds.length > 0

  const setViewModeSafe = React.useCallback(
    (next: BottomPanelCuratorToolbarProps['viewMode']) => {
      if (next === 'selectionNeighborhood') {
        if (!selectedNodeId && !selectedEdgeId) return
        setGraphDataTableScope('all')
        setViewMode('selectionNeighborhood')
        return
      }
      if (next === 'traversalSequence') {
        if (!hasTraversalEdges) return
        setGraphDataTableScope('all')
        setViewMode('traversalSequence')
        return
      }
      setViewMode('allRows')
    },
    [hasTraversalEdges, selectedEdgeId, selectedNodeId, setGraphDataTableScope, setViewMode],
  )

  return (
    <WorkspaceHeader ariaLabel="Graph Data Table header" border="divider" className="px-2">
      <WorkspaceHeaderRow ariaLabel="Graph Data Table controls" className="px-0 py-2 gap-2 flex-wrap">
        <section className="flex items-center gap-2 min-w-0" aria-label="Graph Data Table title and add">
          <h2 className={`text-sm font-semibold ${UI_THEME_TOKENS.text.primary} truncate`}>{UI_LABELS.graphDataTable}</h2>

          <menu className="flex items-center gap-1 list-none m-0 p-0" aria-label="Create">
            <li className="list-none">
              <button
                ref={addMenuRef}
                type="button"
                className={graphDataTableToolbarButtonClassName(false)}
                onClick={() => setIsAddMenuOpen(value => !value)}
              >
                <Plus className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
                Add
                <ChevronDown className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
              </button>
            </li>
          </menu>
          {isAddMenuOpen && (
            <DropdownPanel anchorRef={addMenuRef} open={isAddMenuOpen} onClose={() => setIsAddMenuOpen(false)} align="bottom-left">
              <menu className={`p-1 flex flex-col gap-1 w-40 list-none m-0 ${UI_THEME_TOKENS.panel.bg} border ${UI_THEME_TOKENS.panel.border} rounded shadow-md`}>
                <li className="list-none">
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
                </li>
                <li className="list-none">
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
                </li>
              </menu>
            </DropdownPanel>
          )}
        </section>

        <nav
          className="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto"
          aria-label="Graph Data Table toolbar"
        >
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
              <span className={`${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.tertiary} ml-1`}>
                ({hiddenColumnCount} hidden)
              </span>
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

          <WorkspaceModeSelect<GraphDataTableScope>
            ariaLabel="Graph Data Table scope"
            value={graphDataTableScope}
            options={scopeOptions}
            onChange={setGraphDataTableScope}
          />

          <WorkspaceModeSelect<BottomPanelCuratorToolbarProps['viewMode']>
            ariaLabel="Graph Data Table view"
            value={viewMode}
            isActive={viewMode !== 'allRows'}
            options={viewModeOptions}
            onChange={setViewModeSafe}
          />

          {viewMode === 'traversalSequence' && hasTraversalEdges && (
            <output className={`ml-1 px-2 py-0.5 rounded-full ${uiPrimaryChipActiveClassName} ${uiPanelMonospaceTextClass}`}>
              {(lastTraversalSummary?.edgeIds?.length ?? 0).toLocaleString()} edges
            </output>
          )}

          <span className={`mx-2 h-5 w-px ${UI_THEME_TOKENS.panel.divider}`} aria-hidden="true" />

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
              View
              <ChevronDown className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
            </button>
            {isDensityMenuOpen && (
              <DropdownPanel
                anchorRef={densityMenuRef}
                open={isDensityMenuOpen}
                onClose={() => setIsDensityMenuOpen(false)}
                align="bottom-left"
              >
                <section className={`flex flex-col gap-2 w-56 p-3 ${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.primary}`} aria-label="View settings">
                  <div className={`font-medium ${UI_THEME_TOKENS.text.secondary}`}>Row density</div>
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
                      Compact
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
                      Expanded
                    </button>
                  </div>

                  <hr className={`my-1 border-0 h-px ${UI_THEME_TOKENS.panel.divider}`} />

                  <div className={`font-medium ${UI_THEME_TOKENS.text.secondary}`}>{UI_COPY.graphDataTableAggregateChartsTitle}</div>
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      className={`${graphDataTableToolbarButtonClassName(aggregateDefaultVizMode === 'none')} ${
                        aggregateDefaultVizMode === 'none' ? GRAPH_DATA_TABLE_TOOLBAR_ACTIVE_CLASS : ''
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
                      className={`${graphDataTableToolbarButtonClassName(aggregateDefaultVizMode === 'radial')} ${
                        aggregateDefaultVizMode === 'radial' ? GRAPH_DATA_TABLE_TOOLBAR_ACTIVE_CLASS : ''
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
                      className={`${graphDataTableToolbarButtonClassName(aggregateDefaultVizMode === 'bars')} ${
                        aggregateDefaultVizMode === 'bars' ? GRAPH_DATA_TABLE_TOOLBAR_ACTIVE_CLASS : ''
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
                      className={`${graphDataTableToolbarButtonClassName(aggregateDefaultVizMode === 'sparkline')} ${
                        aggregateDefaultVizMode === 'sparkline' ? GRAPH_DATA_TABLE_TOOLBAR_ACTIVE_CLASS : ''
                      }`}
                      onClick={() => {
                        setAggregateDefaultVizMode('sparkline')
                        setIsDensityMenuOpen(false)
                      }}
                    >
                      {UI_COPY.graphDataTableAggregateChartsStartSparkline}
                    </button>
                  </div>

                  <hr className={`my-1 border-0 h-px ${UI_THEME_TOKENS.panel.divider}`} />

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
                </section>
              </DropdownPanel>
            )}
          </div>
        </nav>

        <nav className="flex items-center gap-1" aria-label="Graph Data Table actions">
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
        </nav>
      </WorkspaceHeaderRow>
    </WorkspaceHeader>
  )
}
