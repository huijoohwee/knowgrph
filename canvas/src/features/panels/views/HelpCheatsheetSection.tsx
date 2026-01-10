import React from 'react'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import Tooltip from '@/features/panels/ui/Tooltip'
import { HELP_STEP_COPY } from '@/features/panels/config'
import { HELP_CHEATSHEET_ALIGNMENT_TOOLTIP, UI_ANCHORS, UI_COPY, UI_LABELS } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'

interface BehaviorRow {
  mode: string
  gesture: string
  zoomDrag: string
  tools: string
}

interface HelpCheatsheetSectionProps {
  collapsed: boolean
  onToggle: (next: boolean) => void
}

export function HelpCheatsheetSection({ collapsed, onToggle }: HelpCheatsheetSectionProps) {
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-sm',
  )
  const uiPanelTextFontClass = useGraphStore(
    s => s.uiPanelTextFontClass || 'font-sans',
  )

  const behaviorRows = React.useMemo<BehaviorRow[]>(
    () => [
      {
        mode: 'Select: single',
        gesture: 'Click node',
        zoomDrag: 'Zoom and drag behave normally; one node stays selected',
        tools:
          'Single-select → click one node to focus selection → route toolbar tools, panels, and overlays to that entity for edits, metrics, and localized visualizations.',
      },
      {
        mode: `${UI_COPY.toolbarPrefix} ${UI_LABELS.fitToScreen} / ${UI_LABELS.zoomToSelection}`,
        gesture: 'Toggle Fit to Screen or Zoom to Selection in the toolbar',
        zoomDrag:
          'Zoom and node drag respect the chosen mode; camera centers on full graph or active selection',
        tools:
          'Zoom modes → toggle Fit to Screen or Zoom to Selection → persist viewport focus on the whole graph or selected subgraph so overlays, metrics, and panels stay aligned.',
      },
      {
        mode: `${UI_COPY.toolbarPrefix} ${UI_LABELS.multiSelectMode}`,
        gesture:
          'Toggle Multi-select Mode, then click nodes/edges or use Graph Data Table checkboxes / Cmd+click to build the selection',
        zoomDrag: 'Zoom, pan, and drag remain available while building a selection set',
        tools:
          'Multi-select mode → toggle the toolbar button, then build a node/edge set via canvas clicks, Graph Data Table checkboxes, or Cmd/Ctrl+click → drive bulk edits, aggregates, and selection-based overlays on the active subgraph.',
      },
      {
        mode: `${UI_COPY.toolbarPrefix} ${UI_LABELS.radialLayoutMode}`,
        gesture: 'Toggle radial cluster layout to arrange nodes in a circular tree',
        zoomDrag: 'Zoom and node drag behave normally; positions remain stable and translate as a group',
        tools:
          'Radial cluster layout → toggle the toolbar button to switch schema.layout.mode between force and radial so 2D canvas nodes use a hierarchy-derived circular layout (per-mode cached) while preserving node styles, labels, and selection-aware overlays across graph layer toggles and other UI re-renders.',
      },
      {
        mode: `${UI_COPY.toolbarPrefix} ${UI_LABELS.graphLayersMode}`,
        gesture: 'Toggle graph layers to show or hide convex hull outlines around related nodes',
        zoomDrag:
          'Zoom and node drag behave normally; graph layers follow the same simulation tick as nodes',
        tools:
          'Canvas graph layers → toggle the toolbar button to render or hide convex hulls around nodes linked by JSON-LD array properties (for example, steps/contains lists) → styling comes from schema.metadata["canvas:graphLayers"] (defaultStyle, byOwnerType, byPropertyKey) or falls back to the owner node type color for domain-agnostic grouping.',
      },
      {
        mode: `${UI_COPY.toolbarPrefix} ${UI_LABELS.tidyTreeLayoutMode}`,
        gesture: 'Toggle tidy tree to arrange nodes into a hierarchical tree',
        zoomDrag: 'Zoom and node drag behave normally; positions remain stable and translate as a group',
        tools:
          'Tidy tree layout → toggle the toolbar button (or use FloatingPanel → Render → Layout mode) to switch schema.layout.mode between force and tidy-tree; tidy-tree derives a single parent→child tree from the configured edge labels (or an auto-picked most-common label) and renders only those tree edges so the view stays uncluttered. Links and labels follow an Observable-style default (curved links, stroke #555 @ 0.4, width 1.5, small node radius, internal fill #555, leaf fill #999, haloed labels) while remaining schema-driven. The tidy-tree layout is preserved across graph layer toggles, UI re-renders, and mode switches via per-mode caching. Refine Settings → 2D layout → tidyTree (edgeLabels, direction, orientation left-to-right/top-to-bottom, nodeSize, separation, sortBy, curve, colorMode, linkStroke/linkOpacity/linkWidth, nodeRadius, internalFill/leafFill, labelFontSize/labelFontFamily) so layout and styling stay reproducible and domain-agnostic.',
      },
      {
        mode: 'Create: shift-drag',
        gesture: 'Shift + drag from source node to target node',
        zoomDrag: 'Zoom and basic node drag follow general behavior settings',
        tools:
          'Shift-drag edge creation → drag from a source node to a target while zoom and node drag follow global behavior → quickly sketch relationships without leaving the canvas or losing predictable navigation.',
      },
      {
        mode: 'Create: click-source-target',
        gesture: 'Use toolbar edge tools to click source, then target',
        zoomDrag: 'Zoom and drag are available between clicks',
        tools:
          'Toolbar edge tools → pick an edge type, click a source, then a target → create edges with clear intent while panels surface edge details for schema-aware editing and inspection.',
      },
      {
        mode: 'Create: panel-only',
        gesture: 'Create edges from side panels or context menus',
        zoomDrag: 'Zoom and node drag stay focused on navigation',
        tools:
          'Panel-only creation → use side panels or context menus to define relationships → keep canvas gestures focused on navigation while still emitting selection-aware overlays and Graph Data Table updates.',
      },
    ],
    [],
  )

  return (
    <CollapsibleSection
      title={(
        <Tooltip
          content={HELP_CHEATSHEET_ALIGNMENT_TOOLTIP}
          maxWidthPx={260}
          contentClassName="bg-gray-800/90"
        >
          <span className="inline-flex items-center gap-1">
            <span>{HELP_STEP_COPY.cheatsheet.title}</span>
          </span>
        </Tooltip>
      )}
      collapsed={collapsed}
      onToggle={onToggle}
    >
      {HELP_STEP_COPY.cheatsheet.descriptionShort && (
        <div className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-600 mb-2`}>
          {HELP_STEP_COPY.cheatsheet.descriptionShort}
        </div>
      )}
      <div className="overflow-x-auto">
        <table
          className={`min-w-full ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-700 border border-gray-200 rounded-sm`}
        >
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-1 text-left font-medium text-gray-700">Mode</th>
              <th className="px-2 py-1 text-left font-medium text-gray-700">Canvas gesture</th>
              <th className="px-2 py-1 text-left font-medium text-gray-700">Zoom / node drag</th>
              <th className="px-2 py-1 text-left font-medium text-gray-700">Toolbar / panels</th>
            </tr>
          </thead>
          <tbody>
            {behaviorRows.map(row => {
              const isGraphLayerRow =
                row.mode === `${UI_COPY.toolbarPrefix} ${UI_LABELS.graphLayersMode}`
              return (
                <tr
                  key={row.mode}
                  className="border-t border-gray-200"
                  data-kg-anchor={isGraphLayerRow ? UI_ANCHORS.helpGraphLayers : undefined}
                >
                  <td className="px-2 py-1 align-top whitespace-nowrap">{row.mode}</td>
                  <td className="px-2 py-1 align-top">{row.gesture}</td>
                  <td className="px-2 py-1 align-top">{row.zoomDrag}</td>
                  <td className="px-2 py-1 align-top">{row.tools}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </CollapsibleSection>
  )
}
