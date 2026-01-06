import React from 'react';
import { KeyTypeValueRow, RightAlignedValueCell } from '@/features/panels/ui/KeyTypeValueRow';
import Tooltip from '@/features/panels/ui/Tooltip';
import { useGraphStore } from '@/hooks/useGraphStore';
import {
  RENDERER_LAYOUT_MODE_ROW_TOOLTIP,
  RENDERER_LAYOUT_MODE_VALUE_TOOLTIP,
} from '@/lib/config';
import { useShallow } from 'zustand/react/shallow';

export function RendererLayoutModeSettings() {
  const { schema, setSchema, setCanvasRenderMode } = useGraphStore(
    useShallow((s) => ({
      schema: s.schema,
      setSchema: s.setSchema,
      setCanvasRenderMode: s.setCanvasRenderMode,
    }))
  );

  const uiPanelKeyValueInputClass = useGraphStore(
    (s) =>
      s.uiPanelKeyValueInputClass ||
      'w-full h-6 px-2 text-xs border border-gray-300 rounded text-right'
  );

  return (
    <div className="grid grid-cols-1 gap-1">
      <KeyTypeValueRow
        layout="keyIconValue"
        density="compact"
        keyNode={
          <Tooltip
            content={RENDERER_LAYOUT_MODE_ROW_TOOLTIP}
            maxWidthPx={260}
            contentClassName="bg-gray-800/90"
            className="break-words"
          >
            <span className="text-gray-700 break-words">schema.layout.mode</span>
          </Tooltip>
        }
        typeNode={null}
        valueNode={
          <RightAlignedValueCell>
            <Tooltip
              content={RENDERER_LAYOUT_MODE_VALUE_TOOLTIP}
              maxWidthPx={260}
              contentClassName="bg-gray-800/90"
              className="w-full"
            >
              <select
                className={uiPanelKeyValueInputClass}
                value={schema.layout?.mode || 'force'}
                onChange={(e) => {
                  const raw = String(e.target.value || '');
                  const nextMode = raw === 'radial' || raw === 'tidy-tree' ? raw : 'force';
                  const layout = schema.layout || {};
                  setSchema({ ...schema, layout: { ...layout, mode: nextMode } });
                  if (nextMode === 'radial' || nextMode === 'tidy-tree') {
                    setCanvasRenderMode('2d');
                  }
                }}
              >
                <option value="force">force</option>
                <option value="radial">radial</option>
                <option value="tidy-tree">tidy-tree</option>
              </select>
            </Tooltip>
          </RightAlignedValueCell>
        }
      />
      <KeyTypeValueRow
        layout="keyIconValue"
        density="compact"
        keyNode={
          <span className="text-gray-700 break-words">schema.layers.mode</span>
        }
        typeNode={null}
        valueNode={
          <RightAlignedValueCell>
            <select
              className={uiPanelKeyValueInputClass}
              value={schema.layers?.mode || 'property'}
              onChange={(e) => {
                const raw = String(e.target.value || '');
                const nextMode =
                  raw === 'semantic' || raw === 'document-structure' ? raw : 'property';
                const layers = schema.layers || {};
                setSchema({ ...schema, layers: { ...layers, mode: nextMode } });
              }}
            >
              <option value="property">property</option>
              <option value="document-structure">document-structure</option>
              <option value="semantic">semantic</option>
            </select>
          </RightAlignedValueCell>
        }
      />
    </div>
  );
}
