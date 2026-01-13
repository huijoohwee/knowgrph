import React from 'react';
import { KeyTypeValueRow, RightAlignedValueCell } from '@/features/panels/ui/KeyTypeValueRow';
import Tooltip from '@/features/panels/ui/Tooltip';
import { useGraphStore } from '@/hooks/useGraphStore';
import {
  RENDERER_TIDY_TREE_CURVE_ROW_TOOLTIP,
  RENDERER_TIDY_TREE_CURVE_VALUE_TOOLTIP,
  RENDERER_TIDY_TREE_ORIENTATION_ROW_TOOLTIP,
  RENDERER_TIDY_TREE_ORIENTATION_VALUE_TOOLTIP,
  RENDERER_TIDY_TREE_LINK_OPACITY_ROW_TOOLTIP,
  RENDERER_TIDY_TREE_LINK_OPACITY_VALUE_TOOLTIP,
} from '@/lib/config';
import { useShallow } from 'zustand/react/shallow';
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens';

export function RendererTidyTreeSettings() {
  const { schema, setSchema } = useGraphStore(
    useShallow((s) => ({
      schema: s.schema,
      setSchema: s.setSchema,
    }))
  );

  const uiPanelKeyValueInputClass = useGraphStore(
    (s) =>
      s.uiPanelKeyValueInputClass ||
      `w-full h-6 px-2 text-xs ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} rounded text-right`
  );

  if ((schema.layout?.mode || 'force') !== 'tidy-tree') {
    return null;
  }

  const tidyMeta = (schema.metadata as Record<string, unknown> | undefined)?.tidyTree as
    | Record<string, unknown>
    | undefined;
  const mermaidDensity = tidyMeta?.mermaidDensity as
    | {
        statementCount?: unknown;
        density?: unknown;
      }
    | undefined;
  const densityLabel =
    mermaidDensity && typeof mermaidDensity.density === 'string'
      ? mermaidDensity.density
      : '';
  const statementCount =
    mermaidDensity && typeof mermaidDensity.statementCount === 'number' && Number.isFinite(mermaidDensity.statementCount)
      ? mermaidDensity.statementCount
      : null;

  return (
    <div className="grid grid-cols-1 gap-1">
      <KeyTypeValueRow
        layout="keyIconValue"
        density="compact"
        keyNode={
          <Tooltip
            content={RENDERER_TIDY_TREE_CURVE_ROW_TOOLTIP}
            maxWidthPx={260}
            contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
            className="break-words"
          >
            <span className={`${UI_THEME_TOKENS.text.primary} break-words`}>graph.layout.tidyTree.curve</span>
          </Tooltip>
        }
        typeNode={null}
        valueNode={
          <RightAlignedValueCell>
            <Tooltip
              content={RENDERER_TIDY_TREE_CURVE_VALUE_TOOLTIP}
              maxWidthPx={260}
              contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
              className="w-full"
            >
              <select
                className={`${uiPanelKeyValueInputClass} ${UI_THEME_TOKENS.text.primary}`}
                value={schema.layout?.tidyTree?.curve || 'bump'}
                onChange={(e) => {
                  const raw = String(e.target.value || '');
                  const curve = raw === 'linear' || raw === 'step' || raw === 'bump' ? raw : 'bump';
                  const layout = schema.layout || {};
                  const tidyTree = layout.tidyTree || {};
                  setSchema({
                    ...schema,
                    layout: { ...layout, tidyTree: { ...tidyTree, curve } },
                  });
                }}
              >
                <option value="bump">bump</option>
                <option value="linear">linear</option>
                <option value="step">step</option>
              </select>
            </Tooltip>
          </RightAlignedValueCell>
        }
      />
      <KeyTypeValueRow
        layout="keyIconValue"
        density="compact"
        keyNode={
          <Tooltip
            content="Read-only summary of metadata.tidyTree.mermaidDensity from the parser, showing the bucket and statement count used to seed the initial separation."
            maxWidthPx={260}
            contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
            className="break-words"
          >
            <span className={`${UI_THEME_TOKENS.text.primary} break-words`}>
              metadata.tidyTree.mermaidDensity
            </span>
          </Tooltip>
        }
        typeNode={null}
        valueNode={
          <RightAlignedValueCell>
            <span className={`text-xs ${UI_THEME_TOKENS.text.tertiary}`}>
              {densityLabel && statementCount != null
                ? `${densityLabel} (${statementCount} statements)`
                : 'not available'}
            </span>
          </RightAlignedValueCell>
        }
      />
      <KeyTypeValueRow
        layout="keyIconValue"
        density="compact"
        keyNode={
          <Tooltip
            content="Set graph.layout.tidyTree.separation to control Dagre node and rank spacing; Mermaid frontmatter diagrams seed a density-aware default via metadata.tidyTree.separation, and this field overrides that suggestion for the active schema."
            maxWidthPx={260}
            contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
            className="break-words"
          >
            <span className={`${UI_THEME_TOKENS.text.primary} break-words`}>
              graph.layout.tidyTree.separation
            </span>
          </Tooltip>
        }
        typeNode={null}
        valueNode={
          <RightAlignedValueCell>
            <Tooltip
              content="Default: 1; larger values increase Dagre nodesep/ranksep; fractional values (e.g. 1.3, 1.5, 1.8, 2.1) are allowed. Mermaid density presets influence the initial value via metadata.tidyTree.mermaidDensity.config, but the schema separation here is the final authority."
              maxWidthPx={260}
              contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
              className="w-full"
            >
              <input
                className={`${uiPanelKeyValueInputClass} ${UI_THEME_TOKENS.text.primary}`}
                type="number"
                min={0.25}
                step={0.1}
                value={
                  typeof schema.layout?.tidyTree?.separation === 'number'
                    ? schema.layout?.tidyTree?.separation
                    : 1
                }
                onChange={(e) => {
                  const raw = parseFloat(String(e.target.value || '1'));
                  const sep = Number.isFinite(raw) ? Math.max(0.25, raw) : 1;
                  const layout = schema.layout || {};
                  const tidyTree = layout.tidyTree || {};
                  setSchema({
                    ...schema,
                    layout: { ...layout, tidyTree: { ...tidyTree, separation: sep } },
                  });
                }}
              />
            </Tooltip>
          </RightAlignedValueCell>
        }
      />
      <KeyTypeValueRow
        layout="keyIconValue"
        density="compact"
        keyNode={
          <Tooltip
            content={RENDERER_TIDY_TREE_ORIENTATION_ROW_TOOLTIP}
            maxWidthPx={260}
            contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
            className="break-words"
          >
            <span className={`${UI_THEME_TOKENS.text.primary} break-words`}>
              graph.layout.tidyTree.orientation
            </span>
          </Tooltip>
        }
        typeNode={null}
        valueNode={
          <RightAlignedValueCell>
            <Tooltip
              content={RENDERER_TIDY_TREE_ORIENTATION_VALUE_TOOLTIP}
              maxWidthPx={260}
              contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
              className="w-full"
            >
              <select
                className={`${uiPanelKeyValueInputClass} ${UI_THEME_TOKENS.text.primary}`}
                value={
                  schema.layout?.tidyTree?.orientation === 'vertical' ? 'vertical' : 'horizontal'
                }
                onChange={(e) => {
                  const raw = String(e.target.value || '');
                  const orientation = raw === 'vertical' ? 'vertical' : 'horizontal';
                  const layout = schema.layout || {};
                  const tidyTree = layout.tidyTree || {};
                  setSchema({
                    ...schema,
                    layout: { ...layout, tidyTree: { ...tidyTree, orientation } },
                  });
                }}
              >
                <option value="horizontal">left-to-right</option>
                <option value="vertical">top-to-bottom</option>
              </select>
            </Tooltip>
          </RightAlignedValueCell>
        }
      />
      <KeyTypeValueRow
        layout="keyIconValue"
        density="compact"
        keyNode={
          <Tooltip
            content={RENDERER_TIDY_TREE_LINK_OPACITY_ROW_TOOLTIP}
            maxWidthPx={260}
            contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
            className="break-words"
          >
            <span className={`${UI_THEME_TOKENS.text.primary} break-words`}>
              graph.layout.tidyTree.linkOpacity
            </span>
          </Tooltip>
        }
        typeNode={null}
        valueNode={
          <RightAlignedValueCell>
            <Tooltip
              content={RENDERER_TIDY_TREE_LINK_OPACITY_VALUE_TOOLTIP}
              maxWidthPx={260}
              contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
              className="w-full"
            >
              <input
                className={`${uiPanelKeyValueInputClass} ${UI_THEME_TOKENS.text.primary}`}
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={
                  typeof schema.layout?.tidyTree?.linkOpacity === 'number'
                    ? schema.layout?.tidyTree?.linkOpacity
                    : 0.4
                }
                onChange={(e) => {
                  const raw = parseFloat(String(e.target.value || '0.4'));
                  const linkOpacity = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 0.4;
                  const layout = schema.layout || {};
                  const tidyTree = layout.tidyTree || {};
                  setSchema({
                    ...schema,
                    layout: { ...layout, tidyTree: { ...tidyTree, linkOpacity } },
                  });
                }}
              />
            </Tooltip>
          </RightAlignedValueCell>
        }
      />
    </div>
  );
}
