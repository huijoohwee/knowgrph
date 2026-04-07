import React from 'react'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import { KeyTypeValueRow } from '@/features/panels/ui/KeyTypeValueRow'
import Tooltip from '@/features/panels/ui/Tooltip'
import type { GraphSchema } from '@/lib/graph/schema'
import {
  STAR_COUNT_TOOLTIP,
  STARFIELD_RADIUS_TOOLTIP,
  STARFIELD_BRIGHTNESS_TOOLTIP,
} from '@/features/panels/views/ThreeViewTuningTooltips'
import { PlainTextInputEditor } from '@/components/ui/PlainTextInputEditor'

interface ThreeViewStarfieldSectionProps {
  schema: GraphSchema
  setThreeConfig: (config: Partial<GraphSchema['three']>) => void
  collapsed: boolean
  onToggle?: (next: boolean) => void
  uiPanelKeyValueInputClass: string
}

export default function ThreeViewStarfieldSection({
  schema,
  setThreeConfig,
  collapsed,
  onToggle,
  uiPanelKeyValueInputClass,
}: ThreeViewStarfieldSectionProps) {
  return (
    <CollapsibleSection
      title="Starfield"
      collapsed={collapsed}
      onToggle={onToggle}
      headerClassName="px-0"
      stickyOffsetClassName="top-6"
    >
      <div className="grid grid-cols-2 gap-3">
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className="text-gray-700">Starfield</span>}
          valueNode={(
            <input
              type="checkbox"
              className="h-3 w-3"
              checked={Boolean(schema.three?.starfieldEnabled ?? false)}
              onChange={e => setThreeConfig({ starfieldEnabled: e.target.checked })}
            />
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className="text-gray-700">Star Count</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0}
                max={4000}
                step={100}
                value={Number(schema.three?.starfieldCount ?? 0)}
                onChange={e => setThreeConfig({ starfieldCount: Number(e.target.value) })}
              />
              <Tooltip
                content={STAR_COUNT_TOOLTIP}
                maxWidthPx={260}
                contentClassName="bg-gray-800/90"
              >
                <span className="text-gray-600">
                  {String(schema.three?.starfieldCount ?? 0)}
                </span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className="text-gray-700">Starfield Radius</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={60}
                max={800}
                step={10}
                value={Number(
                  schema.three?.starfieldRadius ??
                    schema.three?.sphereRadius ??
                    650,
                )}
                onChange={e => setThreeConfig({ starfieldRadius: Number(e.target.value) })}
              />
              <Tooltip
                content={STARFIELD_RADIUS_TOOLTIP}
                maxWidthPx={260}
                contentClassName="bg-gray-800/90"
              >
                <span className="text-gray-600">
                  {String(
                    schema.three?.starfieldRadius ??
                      schema.three?.sphereRadius ??
                      650,
                  )}
                </span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className="text-gray-700">Starfield Brightness</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={Number(schema.three?.starfieldOpacity ?? 0.9)}
                onChange={e => setThreeConfig({ starfieldOpacity: Number(e.target.value) })}
              />
              <Tooltip
                content={STARFIELD_BRIGHTNESS_TOOLTIP}
                maxWidthPx={260}
                contentClassName="bg-gray-800/90"
              >
                <span className="text-gray-600">
                  {String(schema.three?.starfieldOpacity ?? 0.9)}
                </span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className="text-gray-700">Starfield Color</span>}
          valueNode={(
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="w-8 h-6 p-0 border border-gray-300 rounded cursor-pointer bg-transparent"
                value={
                  (() => {
                    const raw = String(schema.three?.starfieldColor ?? '')
                    const normalized = raw.trim() || '#facc15'
                    return normalized.startsWith('#') &&
                      (normalized.length === 4 || normalized.length === 7)
                      ? normalized
                      : '#000000'
                  })()
                }
                onChange={e => setThreeConfig({ starfieldColor: e.target.value })}
              />
              <PlainTextInputEditor
                className={uiPanelKeyValueInputClass}
                value={String(schema.three?.starfieldColor ?? '')}
                onChange={next => setThreeConfig({ starfieldColor: next })}
                placeholder="#facc15"
              />
            </div>
          )}
        />
      </div>
    </CollapsibleSection>
  )
}
