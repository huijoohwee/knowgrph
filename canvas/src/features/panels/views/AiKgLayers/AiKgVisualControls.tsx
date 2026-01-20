import React from 'react'
import type { GraphSchema } from '@/lib/graph/schema'
import { getThreeConfig } from '@/lib/graph/schema'
import { KeyTypeValueRow, RightAlignedValueCell } from '@/features/panels/ui/KeyTypeValueRow'
import Tooltip from '@/features/panels/ui/Tooltip'

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
  const threeCfg = getThreeConfig(schema)
  const nodeSizingFormula: 'schema' | 'importance' = threeCfg.nodeSizingFormula || 'schema'
  const edgeWidthFormula: 'schema' | 'weight' = threeCfg.edgeWidthFormula || 'schema'
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
      <KeyTypeValueRow
        density="compact"
        layout="keyIconValue"
        keyNode={(
          <Tooltip
            content="Renderer → choose three.nodeSizingFormula for AI KG layers → size nodes by schema type or visual importance so key concepts stand out in dense 3D traversal views."
            maxWidthPx={260}
            contentClassName="bg-gray-800/90"
          >
            <span className="text-gray-700 break-words">
              schema.three.nodeSizingFormula
            </span>
          </Tooltip>
        )}
        typeNode={null}
        valueNode={(
          <RightAlignedValueCell>
            <Tooltip
              content="Default: schema; Impact: toggles node sizes between schema types and importance weights."
              maxWidthPx={260}
              contentClassName="bg-gray-800/90"
              className="w-full h-full"
            >
              <select
                className={['w-full max-w-[180px] text-right', uiPanelKeyValueInputClass].filter(Boolean).join(' ')}
                value={nodeSizingFormula}
                onChange={e => {
                  const v: 'schema' | 'importance' =
                    e.target.value === 'importance' ? 'importance' : 'schema'
                  setThreeConfig({ nodeSizingFormula: v })
                }}
              >
                <option value="schema">Schema (type-based)</option>
                <option value="importance">Importance (visual:importance)</option>
              </select>
            </Tooltip>
          </RightAlignedValueCell>
        )}
      />
      <KeyTypeValueRow
        density="compact"
        layout="keyIconValue"
        keyNode={(
          <Tooltip
            content="Renderer → choose three.edgeWidthFormula for AI KG layers for AI KG layers → map edge thickness to schema label or weight so stronger relations appear visually bolder along traversal paths."
            maxWidthPx={260}
            contentClassName="bg-gray-800/90"
          >
            <span className="text-gray-700 break-words">
              schema.three.edgeWidthFormula
            </span>
          </Tooltip>
        )}
        typeNode={null}
        valueNode={(
          <RightAlignedValueCell>
            <Tooltip
              content="Default: schema; Impact: toggles edge widths between labels and weight-based emphasis."
              maxWidthPx={260}
              contentClassName="bg-gray-800/90"
              className="w-full h-full"
            >
              <select
                className={['w-full max-w-[180px] text-right', uiPanelKeyValueInputClass].filter(Boolean).join(' ')}
                value={edgeWidthFormula}
                onChange={e => {
                  const v: 'schema' | 'weight' =
                    e.target.value === 'weight' ? 'weight' : 'schema'
                  setThreeConfig({ edgeWidthFormula: v })
                }}
              >
                <option value="schema">Schema (label-based)</option>
                <option value="weight">Weight (edge weight)</option>
              </select>
            </Tooltip>
          </RightAlignedValueCell>
        )}
      />
    </>
  )
}
