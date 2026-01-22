import React from 'react'
import type { GraphSchema } from '@/lib/graph/schema'
import { KeyTypeValueRow } from '@/features/panels/ui/KeyTypeValueRow'
import Tooltip from '@/features/panels/ui/Tooltip'
import ThreeSizingAndWidthControls from '@/features/panels/views/shared/ThreeSizingAndWidthControls'

type AiKgVisualControlsProps = {
  schema: GraphSchema
  setSchema: (schema: GraphSchema) => void
  setThreeConfig: (config: Partial<GraphSchema['three']>) => void
  uiPanelKeyValueInputClass: string
}

export default function AiKgVisualControls({
  schema,
  setSchema,
  setThreeConfig,
  uiPanelKeyValueInputClass,
}: AiKgVisualControlsProps) {
  const hoverContent = schema.behavior?.hover?.content || { showProps: true, showType: true, showId: true }

  return (
    <>
      <KeyTypeValueRow
        density="compact"
        layout="keyIconValue"
        keyNode={(
          <Tooltip
            content="Hover Tooltip → configure what information is displayed in the hover tooltip."
            maxWidthPx={260}
            contentClassName="bg-gray-800/90"
          >
            Tooltip Content
          </Tooltip>
        )}
        typeNode={null}
        valueNode={
          <div className="flex gap-2 justify-end w-full">
             <label className="flex items-center gap-1 text-xs text-gray-600">
               <input
                 type="checkbox"
                 checked={hoverContent.showType !== false}
                 onChange={e => {
                    const next = { ...hoverContent, showType: e.target.checked };
                    const behavior = schema.behavior;
                    setSchema({ ...schema, behavior: { ...behavior, hover: { ...behavior.hover, content: next } } });
                 }}
                 className="h-3 w-3"
               />
               Type
             </label>
             <label className="flex items-center gap-1 text-xs text-gray-600">
               <input
                 type="checkbox"
                 checked={hoverContent.showId !== false}
                 onChange={e => {
                    const next = { ...hoverContent, showId: e.target.checked };
                    const behavior = schema.behavior;
                    setSchema({ ...schema, behavior: { ...behavior, hover: { ...behavior.hover, content: next } } });
                 }}
                 className="h-3 w-3"
               />
               ID
             </label>
             <label className="flex items-center gap-1 text-xs text-gray-600">
               <input
                 type="checkbox"
                 checked={hoverContent.showProps !== false}
                 onChange={e => {
                    const next = { ...hoverContent, showProps: e.target.checked };
                    const behavior = schema.behavior;
                    setSchema({ ...schema, behavior: { ...behavior, hover: { ...behavior.hover, content: next } } });
                 }}
                 className="h-3 w-3"
               />
               Props
             </label>
          </div>
        }
      />
      <ThreeSizingAndWidthControls
        schema={schema}
        setThreeConfig={setThreeConfig}
        uiPanelKeyValueInputClass={uiPanelKeyValueInputClass}
        variant="aiKg"
      />
    </>
  )
}
