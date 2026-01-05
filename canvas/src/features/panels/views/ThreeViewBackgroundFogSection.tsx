import React from 'react'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import { KeyTypeValueRow } from '@/features/panels/ui/KeyTypeValueRow'
import Tooltip from '@/features/panels/ui/Tooltip'
import type { GraphSchema } from '@/lib/graph/schema'
import { FOG_NEAR_TOOLTIP, FOG_FAR_TOOLTIP } from '@/features/panels/views/ThreeViewTuningTooltips'

interface ThreeViewBackgroundFogSectionProps {
  schema: GraphSchema
  setThreeConfig: (config: Partial<GraphSchema['three']>) => void
  collapsed: boolean
  onToggle?: (next: boolean) => void
  uiPanelKeyValueInputClass: string
}

export default function ThreeViewBackgroundFogSection({
  schema,
  setThreeConfig,
  collapsed,
  onToggle,
  uiPanelKeyValueInputClass,
}: ThreeViewBackgroundFogSectionProps) {
  return (
    <CollapsibleSection
      title="Background and fog"
      collapsed={collapsed}
      onToggle={onToggle}
      headerClassName="px-0"
      stickyOffsetClassName="top-6"
    >
      <div className="grid grid-cols-2 gap-3">
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className="text-gray-700">Background Color</span>}
          valueNode={(
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="w-8 h-6 p-0 border border-gray-300 rounded cursor-pointer bg-transparent"
                value={
                  (() => {
                    const raw = String(schema.three?.backgroundColor ?? '')
                    const normalized = raw.trim() || '#020617'
                    return normalized.startsWith('#') &&
                      (normalized.length === 4 || normalized.length === 7)
                      ? normalized
                      : '#000000'
                  })()
                }
                onChange={e => setThreeConfig({ backgroundColor: e.target.value })}
              />
              <input
                type="text"
                className={uiPanelKeyValueInputClass}
                value={String(schema.three?.backgroundColor ?? '')}
                onChange={e => setThreeConfig({ backgroundColor: e.target.value })}
                placeholder="#020617"
              />
            </div>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className="text-gray-700">Fog Color (blank = off)</span>}
          valueNode={(
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="w-8 h-6 p-0 border border-gray-300 rounded cursor-pointer bg-transparent"
                value={
                  (() => {
                    const raw = String(schema.three?.fogColor ?? '')
                    const normalized = raw.trim() || '#1e1b4b'
                    return normalized.startsWith('#') &&
                      (normalized.length === 4 || normalized.length === 7)
                      ? normalized
                      : '#000000'
                  })()
                }
                onChange={e => setThreeConfig({ fogColor: e.target.value })}
              />
              <input
                type="text"
                className={uiPanelKeyValueInputClass}
                value={String(schema.three?.fogColor ?? '')}
                onChange={e => setThreeConfig({ fogColor: e.target.value })}
                placeholder="#1e1b4b"
              />
            </div>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className="text-gray-700">Fog Near</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={50}
                max={400}
                step={5}
                value={Number(schema.three?.fogNear ?? 180)}
                onChange={e => setThreeConfig({ fogNear: Number(e.target.value) })}
              />
              <Tooltip
                content={FOG_NEAR_TOOLTIP}
                maxWidthPx={260}
                contentClassName="bg-gray-800/90"
              >
                <span className="text-gray-600">
                  {String(schema.three?.fogNear ?? 180)}
                </span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className="text-gray-700">Fog Far</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={80}
                max={600}
                step={5}
                value={Number(schema.three?.fogFar ?? 360)}
                onChange={e => setThreeConfig({ fogFar: Number(e.target.value) })}
              />
              <Tooltip
                content={FOG_FAR_TOOLTIP}
                maxWidthPx={260}
                contentClassName="bg-gray-800/90"
              >
                <span className="text-gray-600">
                  {String(schema.three?.fogFar ?? 360)}
                </span>
              </Tooltip>
            </>
          )}
        />
      </div>
    </CollapsibleSection>
  )
}

