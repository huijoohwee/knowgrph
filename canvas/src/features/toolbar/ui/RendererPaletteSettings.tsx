import React from 'react';
import { KeyTypeValueRow, RightAlignedValueCell } from '@/features/panels/ui/KeyTypeValueRow';
import Tooltip from '@/features/panels/ui/Tooltip';
import { useGraphStore } from '@/hooks/useGraphStore';
import { MVP_COLOR_PALETTE } from '@/lib/graph/schema';
import { useRendererPalette } from '@/features/toolbar/hooks/useRendererPalette';
import { RENDERER_PALETTE_LIFECYCLE_TOOLTIP } from '@/lib/config';

export function RendererPaletteSettings() {
  const uiPanelKeyValueInputClass = useGraphStore(
    (s) =>
      s.uiPanelKeyValueInputClass ||
      'w-full h-6 px-2 text-xs border border-gray-300 rounded text-right'
  );

  const { palette, handleUpdatePaletteColor, normalizeColorForPicker } = useRendererPalette();

  const nodeTypes = ['idea', 'hypothesis', 'execution', 'pivot', 'alert'] as const;
  const edgeTypes = ['critical', 'neutral'] as const;

  return (
    <div className="grid grid-cols-1 gap-1">
      <div className="text-[10px] text-gray-600 leading-snug">
        <Tooltip
          content={RENDERER_PALETTE_LIFECYCLE_TOOLTIP}
          maxWidthPx={260}
          contentClassName="bg-gray-800/90"
          className="break-words"
        >
          <span>
            Lifecycle palette: Blue core ideas, Yellow hypotheses, Green execution, Orange pivots, Red alerts.
          </span>
        </Tooltip>
      </div>
      {nodeTypes.map((type) => (
        <KeyTypeValueRow
          key={`node-${type}`}
          layout="keyIconValue"
          density="compact"
          keyNode={
            <span className="text-gray-700 break-words">
              {`renderer:palette.nodes.${type}`}
            </span>
          }
          typeNode={null}
          valueNode={
            <RightAlignedValueCell>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="w-8 h-6 p-0 border border-gray-300 rounded cursor-pointer bg-transparent"
                  value={normalizeColorForPicker(
                    palette.nodes[type],
                    MVP_COLOR_PALETTE.nodes[type as keyof typeof MVP_COLOR_PALETTE.nodes]
                  )}
                  onChange={(e) => handleUpdatePaletteColor('node', type, e.target.value)}
                />
                <input
                  type="text"
                  className={uiPanelKeyValueInputClass}
                  value={String(palette.nodes[type] || '')}
                  onChange={(e) => handleUpdatePaletteColor('node', type, e.target.value)}
                  placeholder={MVP_COLOR_PALETTE.nodes[type as keyof typeof MVP_COLOR_PALETTE.nodes]}
                />
              </div>
            </RightAlignedValueCell>
          }
        />
      ))}

      {edgeTypes.map((type) => (
        <KeyTypeValueRow
          key={`edge-${type}`}
          layout="keyIconValue"
          density="compact"
          keyNode={
            <span className="text-gray-700 break-words">
              {`renderer:palette.edges.${type}`}
            </span>
          }
          typeNode={null}
          valueNode={
            <RightAlignedValueCell>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="w-8 h-6 p-0 border border-gray-300 rounded cursor-pointer bg-transparent"
                  value={normalizeColorForPicker(
                    palette.edges[type],
                    MVP_COLOR_PALETTE.edges[type as keyof typeof MVP_COLOR_PALETTE.edges]
                  )}
                  onChange={(e) => handleUpdatePaletteColor('edge', type, e.target.value)}
                />
                <input
                  type="text"
                  className={uiPanelKeyValueInputClass}
                  value={String(palette.edges[type] || '')}
                  onChange={(e) => handleUpdatePaletteColor('edge', type, e.target.value)}
                  placeholder={MVP_COLOR_PALETTE.edges[type as keyof typeof MVP_COLOR_PALETTE.edges]}
                />
              </div>
            </RightAlignedValueCell>
          }
        />
      ))}
    </div>
  );
}
