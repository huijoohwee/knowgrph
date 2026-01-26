import React from 'react';
import { KeyTypeValueRow } from '@/features/panels/ui/KeyTypeValueRow';
import Tooltip from '@/features/panels/ui/Tooltip';
import { useGraphStore } from '@/hooks/useGraphStore';
import { useShallow } from 'zustand/react/shallow';
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { RENDERER_HOVER_CONTENT_KEY_TOOLTIP, RENDERER_HOVER_CONTENT_VALUE_TOOLTIP } from '@/lib/config'

export function RendererHoverSettings() {
  const { schema, setSchema } = useGraphStore(
    useShallow((s) => ({
      schema: s.schema,
      setSchema: s.setSchema,
    }))
  );

  const hoverContent = schema.behavior?.hover?.content || { showProps: true, showType: true, showId: true };

  const updateHover = (key: 'showProps' | 'showType' | 'showId', val: boolean) => {
    const next = { ...hoverContent, [key]: val };
    setSchema({
      ...schema,
      behavior: {
        ...schema.behavior,
        hover: {
          ...(schema.behavior?.hover || {}),
          content: next
        }
      }
    });
  };

  return (
    <KeyTypeValueRow
      density="compact"
      layout="keyIconValue"
      keyNode={
        <Tooltip
          content={RENDERER_HOVER_CONTENT_KEY_TOOLTIP}
          maxWidthPx={260}
          contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
        >
          <span className={UI_THEME_TOKENS.text.primary}>schema.behavior.hover.content</span>
        </Tooltip>
      }
      typeNode={null}
      valueNode={
        <Tooltip
          content={RENDERER_HOVER_CONTENT_VALUE_TOOLTIP}
          maxWidthPx={260}
          contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
          className="w-full"
        >
          <div className="flex gap-2 justify-end w-full">
            <label className={`flex items-center gap-1 text-xs ${UI_THEME_TOKENS.text.secondary} cursor-pointer`}>
              <input
                type="checkbox"
                checked={hoverContent.showType !== false}
                onChange={(e) => updateHover('showType', e.target.checked)}
                className={`h-3 w-3 ${UI_THEME_TOKENS.input.border}`}
              />
              Type
            </label>
            <label className={`flex items-center gap-1 text-xs ${UI_THEME_TOKENS.text.secondary} cursor-pointer`}>
              <input
                type="checkbox"
                checked={hoverContent.showId !== false}
                onChange={(e) => updateHover('showId', e.target.checked)}
                className={`h-3 w-3 ${UI_THEME_TOKENS.input.border}`}
              />
              ID
            </label>
            <label className={`flex items-center gap-1 text-xs ${UI_THEME_TOKENS.text.secondary} cursor-pointer`}>
              <input
                type="checkbox"
                checked={hoverContent.showProps !== false}
                onChange={(e) => updateHover('showProps', e.target.checked)}
                className={`h-3 w-3 ${UI_THEME_TOKENS.input.border}`}
              />
              Props
            </label>
          </div>
        </Tooltip>
      }
    />
  );
}
