import React from 'react';
import { KeyTypeValueRow, RightAlignedValueCell } from '@/features/panels/ui/KeyTypeValueRow';
import Tooltip from '@/features/panels/ui/Tooltip';
import { useGraphStore } from '@/hooks/useGraphStore';
import { MVP_COLOR_PALETTE } from '@/lib/graph/schema';
import { useRendererPalette } from '@/features/toolbar/hooks/useRendererPalette';
import {
  RENDERER_PALETTE_LIFECYCLE_TOOLTIP,
  RENDERER_PALETTE_ENTRY_KEY_TOOLTIP,
  RENDERER_PALETTE_ENTRY_VALUE_TOOLTIP,
} from '@/lib/config';
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens';
import { PlainTextInputEditor } from '@/components/ui/PlainTextInputEditor';

export function RendererPaletteSettings() {
  const uiPanelKeyValueInputClass = useGraphStore(
    (s) =>
      s.uiPanelKeyValueInputClass ||
      `w-full h-6 px-2 text-xs ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} rounded text-right`
  );

  const { palette, handleUpdatePaletteColor, normalizeColorForPicker } = useRendererPalette();

  const nodeTypes = ['idea', 'hypothesis', 'execution', 'pivot', 'alert'] as const;
  const edgeTypes = ['critical', 'neutral'] as const;

  return (
    <div className="grid grid-cols-1 gap-1">
      <div className={`text-[10px] ${UI_THEME_TOKENS.text.secondary} leading-snug`}>
        <Tooltip
          content={RENDERER_PALETTE_LIFECYCLE_TOOLTIP}
          maxWidthPx={260}
          contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
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
            <Tooltip
              content={RENDERER_PALETTE_ENTRY_KEY_TOOLTIP}
              maxWidthPx={260}
              contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
              className="break-words"
            >
              <span className={`${UI_THEME_TOKENS.text.primary} break-words`}>
                {`renderer:palette.nodes.${type}`}
              </span>
            </Tooltip>
          }
          typeNode={null}
          valueNode={
            <RightAlignedValueCell>
              <Tooltip
                content={RENDERER_PALETTE_ENTRY_VALUE_TOOLTIP}
                maxWidthPx={260}
                contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
                className="w-full"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    className={`w-8 h-6 p-0 border ${UI_THEME_TOKENS.input.border} rounded cursor-pointer bg-transparent`}
                    value={normalizeColorForPicker(
                      palette.nodes[type],
                      MVP_COLOR_PALETTE.nodes[type as keyof typeof MVP_COLOR_PALETTE.nodes]
                    )}
                    onChange={(e) => handleUpdatePaletteColor('node', type, e.target.value)}
                  />
                  <PlainTextInputEditor
                    className={`${uiPanelKeyValueInputClass} ${UI_THEME_TOKENS.text.primary}`}
                    value={String(palette.nodes[type] || '')}
                    onChange={(next) => handleUpdatePaletteColor('node', type, next)}
                    placeholder={MVP_COLOR_PALETTE.nodes[type as keyof typeof MVP_COLOR_PALETTE.nodes]}
                  />
                </div>
              </Tooltip>
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
            <Tooltip
              content={RENDERER_PALETTE_ENTRY_KEY_TOOLTIP}
              maxWidthPx={260}
              contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
              className="break-words"
            >
              <span className={`${UI_THEME_TOKENS.text.primary} break-words`}>
                {`renderer:palette.edges.${type}`}
              </span>
            </Tooltip>
          }
          typeNode={null}
          valueNode={
            <RightAlignedValueCell>
              <Tooltip
                content={RENDERER_PALETTE_ENTRY_VALUE_TOOLTIP}
                maxWidthPx={260}
                contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
                className="w-full"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    className={`w-8 h-6 p-0 border ${UI_THEME_TOKENS.input.border} rounded cursor-pointer bg-transparent`}
                    value={normalizeColorForPicker(
                      palette.edges[type],
                      MVP_COLOR_PALETTE.edges[type as keyof typeof MVP_COLOR_PALETTE.edges]
                    )}
                    onChange={(e) => handleUpdatePaletteColor('edge', type, e.target.value)}
                  />
                  <PlainTextInputEditor
                    className={`${uiPanelKeyValueInputClass} ${UI_THEME_TOKENS.text.primary}`}
                    value={String(palette.edges[type] || '')}
                    onChange={(next) => handleUpdatePaletteColor('edge', type, next)}
                    placeholder={MVP_COLOR_PALETTE.edges[type as keyof typeof MVP_COLOR_PALETTE.edges]}
                  />
                </div>
              </Tooltip>
            </RightAlignedValueCell>
          }
        />
      ))}
    </div>
  );
}
