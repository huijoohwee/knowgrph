import React from 'react'
import type { GraphSchema } from '@/lib/graph/schema'
import { AI_KG_LAYER_MODE_TOOLTIP } from '@/lib/config'
import { KeyTypeValueRow, RightAlignedValueCell } from '@/features/panels/ui/KeyTypeValueRow'
import Tooltip from '@/features/panels/ui/Tooltip'

type AiKgLayerModeControlsProps = {
  schema: GraphSchema
  setSchema: (schema: GraphSchema) => void
  uiPanelKeyValueInputClass: string
}

export default function AiKgLayerModeControls({
  schema,
  setSchema,
  uiPanelKeyValueInputClass,
}: AiKgLayerModeControlsProps) {
  const layers = schema.layers || {}
  const layerMode: 'property' | 'document-structure' | 'semantic' =
    layers.mode === 'document-structure' || layers.mode === 'semantic'
      ? layers.mode
      : 'property'
  const documentStructure = layers.documentStructure || {}
  const rawMinGroupSize = documentStructure.minGroupSize
  const minGroupSize =
    typeof rawMinGroupSize === 'number' && Number.isFinite(rawMinGroupSize)
      ? Math.max(2, Math.floor(rawMinGroupSize))
      : 2

  return (
    <>
      <KeyTypeValueRow
        density="compact"
        layout="keyIconValue"
        keyNode={(
          <Tooltip
            content={AI_KG_LAYER_MODE_TOOLTIP}
            maxWidthPx={260}
            contentClassName="bg-gray-800/90"
            className="text-gray-700 break-words"
          >
            <span className="text-gray-700 break-words">
              schema.layers.mode
            </span>
          </Tooltip>
        )}
        typeNode={null}
        valueNode={(
          <RightAlignedValueCell>
            <select
              className="w-full max-w-[180px] px-1 py-0.5 border border-gray-300 rounded text-right"
              value={layerMode}
              onChange={e => {
                const raw = String(e.target.value || '')
                const nextMode: 'property' | 'document-structure' | 'semantic' =
                  raw === 'document-structure' || raw === 'semantic'
                    ? (raw as 'document-structure' | 'semantic')
                    : 'property'
                const current = schema
                const nextLayers = current.layers || {}
                const next: GraphSchema = {
                  ...current,
                  layers: {
                    ...nextLayers,
                    mode: nextMode,
                  },
                }
                setSchema(next)
                // Mode change will automatically trigger "fit" via GraphCanvas effects
              }}
            >
              <option value="property">property (array properties)</option>
              <option value="document-structure">document-structure (node type)</option>
              <option value="semantic">semantic (similarity graph)</option>
            </select>
          </RightAlignedValueCell>
        )}
      />
      {(layerMode === 'document-structure' || layerMode === 'semantic') && (
        <KeyTypeValueRow
          density="compact"
          layout="keyIconValue"
          keyNode={(
            <Tooltip
              content="Derived group size → set minimum nodes per document-structure or semantic group → merge smaller groups back into base graph layers to keep layers readable."
              maxWidthPx={260}
              contentClassName="bg-gray-800/90"
              className="text-gray-700 break-words"
            >
              <span className="text-gray-700 break-words">
                schema.layers.documentStructure.minGroupSize
              </span>
            </Tooltip>
          )}
          typeNode={null}
          valueNode={(
            <RightAlignedValueCell>
              <input
                className={uiPanelKeyValueInputClass}
                type="number"
                min={2}
                step={1}
                value={Number(minGroupSize)}
                onChange={e => {
                  const raw = Number(e.target.value)
                  const nextValue = Number.isFinite(raw) ? Math.max(2, Math.floor(raw)) : 2
                  const current = schema
                  const baseLayers = current.layers || {}
                  const baseDoc = baseLayers.documentStructure || {}
                  const next: GraphSchema = {
                    ...current,
                    layers: {
                      ...baseLayers,
                      documentStructure: {
                        ...baseDoc,
                        minGroupSize: nextValue,
                      },
                    },
                  }
                  setSchema(next)
                }}
              />
            </RightAlignedValueCell>
          )}
        />
      )}
    </>
  )
}
