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
      'w-full h-6 px-2 text-xs border border-gray-300 rounded text-right'
  );

  if ((schema.layout?.mode || 'force') !== 'tidy-tree') {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-1">
      <KeyTypeValueRow
        layout="keyIconValue"
        density="compact"
        keyNode={
          <Tooltip
            content={RENDERER_TIDY_TREE_CURVE_ROW_TOOLTIP}
            maxWidthPx={260}
            contentClassName="bg-gray-800/90"
            className="break-words"
          >
            <span className="text-gray-700 break-words">graph.layout.tidyTree.curve</span>
          </Tooltip>
        }
        typeNode={null}
        valueNode={
          <RightAlignedValueCell>
            <Tooltip
              content={RENDERER_TIDY_TREE_CURVE_VALUE_TOOLTIP}
              maxWidthPx={260}
              contentClassName="bg-gray-800/90"
              className="w-full"
            >
              <select
                className={uiPanelKeyValueInputClass}
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
            content={RENDERER_TIDY_TREE_ORIENTATION_ROW_TOOLTIP}
            maxWidthPx={260}
            contentClassName="bg-gray-800/90"
            className="break-words"
          >
            <span className="text-gray-700 break-words">
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
              contentClassName="bg-gray-800/90"
              className="w-full"
            >
              <select
                className={uiPanelKeyValueInputClass}
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
            contentClassName="bg-gray-800/90"
            className="break-words"
          >
            <span className="text-gray-700 break-words">
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
              contentClassName="bg-gray-800/90"
              className="w-full"
            >
              <input
                className={uiPanelKeyValueInputClass}
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
