import React from 'react';
import { KeyTypeValueRow } from '@/features/panels/ui/KeyTypeValueRow';
import Tooltip from '@/features/panels/ui/Tooltip';
import { useGraphStore } from '@/hooks/useGraphStore';
import { useShallow } from 'zustand/react/shallow';

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
    const behavior = schema.behavior || { enabled: true };
    setSchema({ ...schema, behavior: { ...behavior, hover: { ...behavior.hover, content: next } } });
  };

  return (
    <KeyTypeValueRow
      density="compact"
      layout="keyIconValue"
      keyNode={
        <Tooltip
          content="Configure what information is displayed in the hover tooltip."
          maxWidthPx={260}
          contentClassName="bg-gray-800/90"
        >
          <span className="text-gray-700">Tooltip Info</span>
        </Tooltip>
      }
      typeNode={null}
      valueNode={
        <div className="flex gap-2 justify-end w-full">
          <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={hoverContent.showType !== false}
              onChange={(e) => updateHover('showType', e.target.checked)}
              className="h-3 w-3"
            />
            Type
          </label>
          <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={hoverContent.showId !== false}
              onChange={(e) => updateHover('showId', e.target.checked)}
              className="h-3 w-3"
            />
            ID
          </label>
          <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={hoverContent.showProps !== false}
              onChange={(e) => updateHover('showProps', e.target.checked)}
              className="h-3 w-3"
            />
            Props
          </label>
        </div>
      }
    />
  );
}
