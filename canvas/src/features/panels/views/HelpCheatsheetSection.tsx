import React from 'react'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import Tooltip from '@/features/panels/ui/Tooltip'
import { HELP_STEP_COPY } from '@/features/panels/config'
import { HELP_CHEATSHEET_ALIGNMENT_TOOLTIP, UI_ANCHORS, UI_COPY, UI_LABELS } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

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
          'Layout mode → switch schema.layout.mode between radial and block so radial uses hierarchy-derived circular placement while block reuses flowchart-style 2D arrangement; both remain per-mode cached with stable overlays and selection behavior.',
      },
      {
        mode: `${UI_COPY.toolbarPrefix} ${UI_LABELS.graphLayersMode}`,
        gesture: 'Toggle clusters to show or hide cluster outlines around related nodes',
        zoomDrag:
          'Zoom and node drag behave normally; cluster outlines follow the same simulation tick as nodes',
        tools:
          'Canvas clusters → toggle the toolbar button to render or hide outline clusters around nodes linked by document/subgraph structure → styling comes from schema.metadata["canvas:graphLayers"] (defaultStyle, byOwnerType, byPropertyKey) or falls back to the owner node type color for domain-agnostic grouping.',
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
        gesture: 'Create edges from floating panels or context menus',
        zoomDrag: 'Zoom and node drag stay focused on navigation',
        tools:
          'Panel-only creation → use floating panels or context menus to define relationships → keep canvas gestures focused on navigation while still emitting selection-aware overlays and Graph Data Table updates.',
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
        <div className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} ${UI_THEME_TOKENS.text.secondary} mb-2`}>
          {HELP_STEP_COPY.cheatsheet.descriptionShort}
        </div>
      )}
      <div className="overflow-x-auto">
        <table
          className={`min-w-full ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} ${UI_THEME_TOKENS.text.primary} border ${UI_THEME_TOKENS.table.cellBorder} rounded-sm`}
        >
          <thead className={UI_THEME_TOKENS.table.headerBg}>
            <tr>
              <th className={`px-2 py-1 text-left font-medium ${UI_THEME_TOKENS.text.primary}`}>Mode</th>
              <th className={`px-2 py-1 text-left font-medium ${UI_THEME_TOKENS.text.primary}`}>Canvas gesture</th>
              <th className={`px-2 py-1 text-left font-medium ${UI_THEME_TOKENS.text.primary}`}>Zoom / node drag</th>
              <th className={`px-2 py-1 text-left font-medium ${UI_THEME_TOKENS.text.primary}`}>Toolbar / panels</th>
            </tr>
          </thead>
          <tbody>
            {behaviorRows.map(row => {
              const isGraphLayerRow =
                row.mode === `${UI_COPY.toolbarPrefix} ${UI_LABELS.graphLayersMode}`
              return (
                <tr
                  key={row.mode}
                  className={`border-t ${UI_THEME_TOKENS.table.cellBorder}`}
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
