import React from 'react';
import { Eraser } from 'lucide-react';
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection';
import Tooltip from '@/features/panels/ui/Tooltip';
import { HELP_STEP_COPY } from '@/features/panels/config';
import {
  UI_ANCHORS,
  GRAPH_FIELDS_ICON_LEGEND_TOOLTIP,
  GRAPH_FIELDS_GRAPH_DATA_TABLE_MAPPING_TOOLTIP,
  UI_COPY,
  GRAPH_FIELDS_ICON_LEGEND_REUSE_TEXT,
} from '@/lib/config';
import { FieldOriginIcon, KindPill, ScopeIcon, VisibilityIcon } from '@/features/graph-fields/ui/graphFieldIcons';
import { useGraphStore } from '@/hooks/useGraphStore';
import { getIconSizeClass, getPillClass } from '@/lib/ui';
import { uiToolbarButtonMutedClassName } from '@/features/toolbar/ui/toolbarStyles';
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens';

interface IconRow {
  category: string;
  icon: React.ReactNode;
  name: string;
  agentic: string;
  usage: string;
}

interface HelpIconsSectionProps {
  collapsed: boolean;
  onToggle: (next: boolean) => void;
  onOpenSettingsTab: () => void;
}

export function HelpIconsSection({ collapsed, onToggle, onOpenSettingsTab }: HelpIconsSectionProps) {
  const uiIconScale = useGraphStore(s => s.uiIconScale);
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth);
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-sm',
  );
  const uiPanelTextFontClass = useGraphStore(
    s => s.uiPanelTextFontClass || 'font-sans',
  );
  const iconSizeClass = getIconSizeClass(uiIconScale);

  const iconRows = React.useMemo<IconRow[]>(
    () => {
      const state = useGraphStore.getState();
      const basePillClass = state.uiIconPillClass;
      const legendTextSizeClass = state.uiIconPillLegendTextSizeClass;
      const pillClass = getPillClass('legend', {
        baseClass: `${basePillClass} inline-flex items-center gap-1`,
        legendTextSizeClass,
        textColorClass: UI_THEME_TOKENS.text.primary,
      });
      const iconOnlyPillClass = 'inline-flex items-center justify-center';
      return [
        {
          category: 'Scope',
          icon: <ScopeIcon scope="node" className={`${iconSizeClass} ${UI_THEME_TOKENS.text.tertiary}`} strokeWidth={uiIconStrokeWidth} />,
          name: 'Node field',
          agentic: 'Node-level property',
          usage: 'Field attached to nodes; use for node attributes such as title or type.',
        },
        {
          category: 'Scope',
          icon: <ScopeIcon scope="edge" className={`${iconSizeClass} ${UI_THEME_TOKENS.text.tertiary}`} strokeWidth={uiIconStrokeWidth} />,
          name: 'Edge field',
          agentic: 'Edge-level property',
          usage: 'Field attached to edges; use for relationship attributes such as weight or labels.',
        },
        {
          category: 'Origin',
          icon: (
            <FieldOriginIcon
              isCustom
              className={iconOnlyPillClass}
              iconClassName={iconSizeClass}
              strokeWidth={uiIconStrokeWidth}
            />
          ),
          name: 'Custom field',
          agentic: 'User-defined property',
          usage: 'Schema-defined field created by the user; stored alongside node or edge properties.',
        },
        {
          category: 'Origin',
          icon: (
            <FieldOriginIcon
              isCustom={false}
              className={iconOnlyPillClass}
              iconClassName={iconSizeClass}
              strokeWidth={uiIconStrokeWidth}
            />
          ),
          name: 'Derived field',
          agentic: 'Computed metadata',
          usage: 'Field computed from graph data; treated as derived metadata for nodes or edges.',
        },
        {
          category: 'Visibility',
          icon: (
            <VisibilityIcon
              hidden={false}
              iconClassName={iconSizeClass}
              strokeWidth={uiIconStrokeWidth}
            />
          ),
          name: 'Show in Graph Data Table',
          agentic: 'Visible column',
          usage: 'Field is visible as a column in the Graph Data Table view.',
        },
        {
          category: 'Visibility',
          icon: (
            <VisibilityIcon
              hidden
              iconClassName={iconSizeClass}
              strokeWidth={uiIconStrokeWidth}
            />
          ),
          name: 'Hide in Graph Data Table',
          agentic: 'Hidden column',
          usage: 'Field remains available but is hidden from the Graph Data Table view.',
        },
        {
          category: 'Field type',
          icon: (
            <KindPill
              kind="string"
              label="Single line text"
              className={iconOnlyPillClass}
              iconClassName={iconSizeClass}
              iconStrokeWidth={uiIconStrokeWidth}
            />
          ),
          name: 'Single line text',
          agentic: 'Short string property',
          usage: 'Short, single-line text values such as titles, names, or labels.',
        },
        {
          category: 'Field type',
          icon: (
            <KindPill
              kind="string"
              label="Long text"
              className={iconOnlyPillClass}
              iconClassName={iconSizeClass}
              iconStrokeWidth={uiIconStrokeWidth}
            />
          ),
          name: 'Long text',
          agentic: 'Long string property',
          usage: 'Longer freeform text such as descriptions, notes, or documents.',
        },
        {
          category: 'Field type',
          icon: (
            <KindPill
              kind="number"
              label="Number"
              className={iconOnlyPillClass}
              iconClassName={iconSizeClass}
              iconStrokeWidth={uiIconStrokeWidth}
            />
          ),
          name: 'Number',
          agentic: 'Numeric scalar',
          usage: 'Whole-number numeric values such as counts or discrete scores.',
        },
        {
          category: 'Field type',
          icon: (
            <KindPill
              kind="number"
              label="Decimal"
              className={iconOnlyPillClass}
              iconClassName={iconSizeClass}
              iconStrokeWidth={uiIconStrokeWidth}
            />
          ),
          name: 'Decimal',
          agentic: 'Numeric scalar (decimal)',
          usage: 'Numeric values with decimals such as probabilities or ratios.',
        },
        {
          category: 'Field type',
          icon: (
            <KindPill
              kind="boolean"
              label="Checkbox"
              className={iconOnlyPillClass}
              iconClassName={iconSizeClass}
              iconStrokeWidth={uiIconStrokeWidth}
            />
          ),
          name: 'Checkbox',
          agentic: 'Boolean flag',
          usage: 'True/false flags representing toggles, switches, or binary states.',
        },
        {
          category: 'Field type',
          icon: (
            <KindPill
              kind="string"
              label="Multi-select"
              className={iconOnlyPillClass}
              iconClassName={iconSizeClass}
              iconStrokeWidth={uiIconStrokeWidth}
            />
          ),
          name: 'Multi-select',
          agentic: 'List of categorical values',
          usage: 'Array of selected options such as tags or multi-label categories.',
        },
        {
          category: 'Field type',
          icon: (
            <KindPill
              kind="string"
              label="Single-select"
              className={iconOnlyPillClass}
              iconClassName={iconSizeClass}
              iconStrokeWidth={uiIconStrokeWidth}
            />
          ),
          name: 'Single-select',
          agentic: 'Categorical value',
          usage: 'Single selected option from a fixed set such as status or type.',
        },
        {
          category: 'Field type',
          icon: (
            <KindPill
              kind="string"
              label="Date Time"
              className={iconOnlyPillClass}
              iconClassName={iconSizeClass}
              iconStrokeWidth={uiIconStrokeWidth}
            />
          ),
          name: 'Date Time',
          agentic: 'Temporal value',
          usage: 'Timestamp or date-time string used for temporal reasoning or filtering.',
        },
        {
          category: 'Field type',
          icon: (
            <KindPill
              kind="string"
              label="URL"
              className={iconOnlyPillClass}
              iconClassName={iconSizeClass}
              iconStrokeWidth={uiIconStrokeWidth}
            />
          ),
          name: 'URL',
          agentic: 'URI string',
          usage: 'Link or URL string pointing to external resources or documents.',
        },
        {
          category: 'Field type',
          icon: (
            <KindPill
              kind="number"
              label="Currency"
              className={iconOnlyPillClass}
              iconClassName={iconSizeClass}
              iconStrokeWidth={uiIconStrokeWidth}
            />
          ),
          name: 'Currency',
          agentic: 'Monetary numeric',
          usage: 'Numeric values representing currency amounts such as prices or balances.',
        },
        {
          category: 'Field type',
          icon: (
            <KindPill
              kind="object"
              label="JSON"
              className={iconOnlyPillClass}
              iconClassName={iconSizeClass}
              iconStrokeWidth={uiIconStrokeWidth}
            />
          ),
          name: 'JSON',
          agentic: 'Structured JSON payload',
          usage: 'Structured JSON objects used for nested metadata or model outputs.',
        },
        {
          category: 'Actions',
          icon: (
            <span className={iconOnlyPillClass}>
              <Eraser className={`${iconSizeClass} ${UI_THEME_TOKENS.text.secondary}`} strokeWidth={uiIconStrokeWidth} />
            </span>
          ),
          name: 'Clear / Reset',
          agentic: 'Non-destructive erase',
          usage: 'Clears selections, filters, or default values across panels without removing underlying graph data.',
        },
      ];
    },
    [iconSizeClass, uiIconStrokeWidth],
  );

  return (
    <div data-kg-anchor={UI_ANCHORS.graphFieldsIcons}>
      <CollapsibleSection
        title={HELP_STEP_COPY.icons.title}
        collapsed={collapsed}
        onToggle={onToggle}
        id={UI_ANCHORS.graphFieldsIcons}
      >
        {HELP_STEP_COPY.icons.descriptionShort && (
          <div className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} ${UI_THEME_TOKENS.text.secondary} mb-2`}>
            {HELP_STEP_COPY.icons.descriptionShort}
          </div>
        )}
        <div className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} ${UI_THEME_TOKENS.text.secondary} mb-2 flex items-center gap-1`}>
          <Tooltip
            content={GRAPH_FIELDS_ICON_LEGEND_TOOLTIP}
            maxWidthPx={260}
            contentClassName="bg-gray-800/90"
          >
            <div>
              {UI_COPY.graphFieldsIconLegendHeaderLabel}
            </div>
          </Tooltip>
        </div>
        <div className="mb-2 flex flex-wrap gap-2 items-center">
          <button
            type="button"
            className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} ${uiToolbarButtonMutedClassName}`}
            onClick={onOpenSettingsTab}
            data-kg-anchor={UI_ANCHORS.settingsUiIconScale}
          >
            {UI_COPY.openSettingsUiDensityIconsButton}
          </button>
          <div className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} ${UI_THEME_TOKENS.text.tertiary}`}>
            Icons in toolbars, headers, and this legend follow the
            {' '}
            <span className="font-semibold">UI Density: Icons</span>
            {' '}
            setting in Panel Settings (compact vs default).
          </div>
        </div>
        <div className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} mb-2 ${UI_THEME_TOKENS.text.tertiary}`}>
          {GRAPH_FIELDS_ICON_LEGEND_REUSE_TEXT}
        </div>
        <div className={`mb-2 border ${UI_THEME_TOKENS.panel.border} rounded px-2 py-1 ${UI_THEME_TOKENS.button.neutralSubtle} ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} ${UI_THEME_TOKENS.text.secondary}`}>
          <div className="font-semibold mb-0.5">
            Graph Data Table mapping
          </div>
          <div>{GRAPH_FIELDS_GRAPH_DATA_TABLE_MAPPING_TOOLTIP}</div>
        </div>
        <div className="overflow-x-auto">
          <table className={`min-w-full text-xs ${UI_THEME_TOKENS.text.primary} border ${UI_THEME_TOKENS.table.cellBorder} rounded-sm`}>
            <thead className={UI_THEME_TOKENS.table.headerBg}>
              <tr>
                <th className={`px-2 py-1 text-left font-medium ${UI_THEME_TOKENS.text.primary}`}>Category</th>
                <th className={`px-2 py-1 text-left font-medium ${UI_THEME_TOKENS.text.primary}`}>Icon</th>
                <th className={`px-2 py-1 text-left font-medium ${UI_THEME_TOKENS.text.primary}`}>Name</th>
                <th className={`px-2 py-1 text-left font-medium ${UI_THEME_TOKENS.text.primary}`}>AgenticRAG alignment</th>
                <th className={`px-2 py-1 text-left font-medium ${UI_THEME_TOKENS.text.primary}`}>Usage notes</th>
              </tr>
            </thead>
            <tbody>
              {iconRows.map(row => (
                <tr key={`${row.category}-${row.name}`} className={`border-t ${UI_THEME_TOKENS.table.cellBorder}`}>
                  <td className="px-2 py-1 align-top whitespace-nowrap">{row.category}</td>
                  <td className="px-2 py-1 align-top">
                    <span className="inline-flex items-center justify-center">{row.icon}</span>
                  </td>
                  <td className="px-2 py-1 align-top whitespace-nowrap">{row.name}</td>
                  <td className="px-2 py-1 align-top">{row.agentic}</td>
                  <td className="px-2 py-1 align-top">{row.usage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CollapsibleSection>
    </div>
  );
}
