import React from 'react';
import { KeyTypeValueStaticRow } from 'grph-shared/react/keyTypeValueRow';
import Tooltip from '@/features/panels/ui/Tooltip';
import { useGraphStore } from '@/hooks/useGraphStore';
import { useShallow } from 'zustand/react/shallow';
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { RENDERER_HOVER_CONTENT_KEY_TOOLTIP, RENDERER_HOVER_CONTENT_VALUE_TOOLTIP } from '@/lib/config'
import {
  UI_RESPONSIVE_COMPACT_SELECTION_CONTROL_CLASSNAME,
  UI_RESPONSIVE_LABEL_ROW_CLASSNAME,
} from '@/lib/ui/responsiveElementClasses'

export function RendererHoverSettings() {
  const {
    schema,
    setSchema,
    uiPanelKeyValueTextSizeClass,
    uiPanelTextFontClass,
    uiPanelRowDensityCompactClass,
  } = useGraphStore(
    useShallow((s) => ({
      schema: s.schema,
      setSchema: s.setSchema,
      uiPanelKeyValueTextSizeClass: s.uiPanelKeyValueTextSizeClass || 'text-sm',
      uiPanelTextFontClass: s.uiPanelTextFontClass || 'font-sans',
      uiPanelRowDensityCompactClass: s.uiPanelRowDensityCompactClass || 'py-0.5',
    }))
  );

  const hoverContent = schema.behavior?.hover?.content || { showProps: true, showType: true, showId: true };
  const selectionControlClassName = `${UI_RESPONSIVE_COMPACT_SELECTION_CONTROL_CLASSNAME} ${UI_THEME_TOKENS.input.border}`

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
    <KeyTypeValueStaticRow
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
          <section className="flex gap-2 justify-end w-full">
            <label className={`${UI_RESPONSIVE_LABEL_ROW_CLASSNAME} ${UI_THEME_TOKENS.text.secondary} cursor-pointer`}>
              <input
                type="checkbox"
                checked={hoverContent.showType !== false}
                onChange={(e) => updateHover('showType', e.target.checked)}
                className={selectionControlClassName}
              />
              Type
            </label>
            <label className={`${UI_RESPONSIVE_LABEL_ROW_CLASSNAME} ${UI_THEME_TOKENS.text.secondary} cursor-pointer`}>
              <input
                type="checkbox"
                checked={hoverContent.showId !== false}
                onChange={(e) => updateHover('showId', e.target.checked)}
                className={selectionControlClassName}
              />
              ID
            </label>
            <label className={`${UI_RESPONSIVE_LABEL_ROW_CLASSNAME} ${UI_THEME_TOKENS.text.secondary} cursor-pointer`}>
              <input
                type="checkbox"
                checked={hoverContent.showProps !== false}
                onChange={(e) => updateHover('showProps', e.target.checked)}
                className={selectionControlClassName}
              />
              Props
            </label>
          </section>
        </Tooltip>
      }
      textSizeClassName={uiPanelKeyValueTextSizeClass}
      fontClassName={uiPanelTextFontClass}
      densityClassName={uiPanelRowDensityCompactClass}
      activeClassName={UI_THEME_TOKENS.table.rowHoverHighlight}
    />
  );
}
