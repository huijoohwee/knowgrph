import React from 'react';
import { KeyTypeValueRow, RightAlignedValueCell } from '@/features/panels/ui/KeyTypeValueRow';
import Tooltip from '@/features/panels/ui/Tooltip';
import { useGraphStore } from '@/hooks/useGraphStore';
import {
  RENDERER_TREE_CURVE_ROW_TOOLTIP,
  RENDERER_TREE_CURVE_VALUE_TOOLTIP,
  RENDERER_TREE_ORIENTATION_ROW_TOOLTIP,
  RENDERER_TREE_ORIENTATION_VALUE_TOOLTIP,
  RENDERER_TREE_LINK_OPACITY_ROW_TOOLTIP,
  RENDERER_TREE_LINK_OPACITY_VALUE_TOOLTIP,
} from '@/lib/config';
import { useShallow } from 'zustand/react/shallow';
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens';

export function RendererTreeSettings() {
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

  if ((schema.layout?.mode || 'force') !== 'tree') {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-1">
      <KeyTypeValueRow
        layout="keyIconValue"
        density="compact"
        keyNode={
          <Tooltip
            content={RENDERER_TREE_CURVE_ROW_TOOLTIP}
            maxWidthPx={260}
            contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
            className="break-words"
          >
            <span className={`${UI_THEME_TOKENS.text.primary} break-words`}>graph.layout.tree.curve</span>
          </Tooltip>
        }
        typeNode={null}
        valueNode={
          <RightAlignedValueCell>
            <Tooltip
              content={RENDERER_TREE_CURVE_VALUE_TOOLTIP}
              maxWidthPx={260}
              contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
              className="w-full"
            >
              <select
                className={`${uiPanelKeyValueInputClass} ${UI_THEME_TOKENS.text.primary}`}
                value={schema.layout?.tree?.curve || 'bump'}
                onChange={(e) => {
                  const raw = String(e.target.value || '');
                  const curve = raw === 'linear' || raw === 'step' || raw === 'bump' ? raw : 'bump';
                  const layout = schema.layout || {};
                  const tree = layout.tree || {};
                  setSchema({
                    ...schema,
                    layout: { ...layout, tree: { ...tree, curve } },
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
            content="Set graph.layout.tree.separation to control node spacing."
            maxWidthPx={260}
            contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
            className="break-words"
          >
            <span className={`${UI_THEME_TOKENS.text.primary} break-words`}>
              graph.layout.tree.separation
            </span>
          </Tooltip>
        }
        typeNode={null}
        valueNode={
          <RightAlignedValueCell>
            <Tooltip
              content="Default: 1; larger values increase spacing."
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
                  typeof schema.layout?.tree?.separation === 'number'
                    ? schema.layout?.tree?.separation
                    : 1
                }
                onChange={(e) => {
                  const raw = parseFloat(String(e.target.value || '1'));
                  const sep = Number.isFinite(raw) ? Math.max(0.25, raw) : 1;
                  const layout = schema.layout || {};
                  const tree = layout.tree || {};
                  setSchema({
                    ...schema,
                    layout: { ...layout, tree: { ...tree, separation: sep } },
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
            content={RENDERER_TREE_ORIENTATION_ROW_TOOLTIP}
            maxWidthPx={260}
            contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
            className="break-words"
          >
            <span className={`${UI_THEME_TOKENS.text.primary} break-words`}>
              graph.layout.tree.orientation
            </span>
          </Tooltip>
        }
        typeNode={null}
        valueNode={
          <RightAlignedValueCell>
            <Tooltip
              content={RENDERER_TREE_ORIENTATION_VALUE_TOOLTIP}
              maxWidthPx={260}
              contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
              className="w-full"
            >
              <select
                className={`${uiPanelKeyValueInputClass} ${UI_THEME_TOKENS.text.primary}`}
                value={
                  schema.layout?.tree?.orientation === 'vertical' ? 'vertical' : 'horizontal'
                }
                onChange={(e) => {
                  const raw = String(e.target.value || '');
                  const orientation = raw === 'vertical' ? 'vertical' : 'horizontal';
                  const layout = schema.layout || {};
                  const tree = layout.tree || {};
                  setSchema({
                    ...schema,
                    layout: { ...layout, tree: { ...tree, orientation } },
                  });
                }}
              >
                <option value="horizontal">horizontal</option>
                <option value="vertical">vertical</option>
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
            content={RENDERER_TREE_LINK_OPACITY_ROW_TOOLTIP}
            maxWidthPx={260}
            contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
            className="break-words"
          >
            <span className={`${UI_THEME_TOKENS.text.primary} break-words`}>
              graph.layout.tree.linkOpacity
            </span>
          </Tooltip>
        }
        typeNode={null}
        valueNode={
          <RightAlignedValueCell>
            <Tooltip
              content={RENDERER_TREE_LINK_OPACITY_VALUE_TOOLTIP}
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
                  typeof schema.layout?.tree?.linkOpacity === 'number'
                    ? schema.layout?.tree?.linkOpacity
                    : 0.4
                }
                onChange={(e) => {
                  const raw = parseFloat(String(e.target.value || '0.4'));
                  const linkOpacity = Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 0.4;
                  const layout = schema.layout || {};
                  const tree = layout.tree || {};
                  setSchema({
                    ...schema,
                    layout: { ...layout, tree: { ...tree, linkOpacity } },
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
