import React from 'react'
import Subsection from '@/features/schema-editor/ui/Subsection'
import type { GraphSchema } from '@/lib/graph/schema'

type RulesAndQualitySectionProps = {
  schema: GraphSchema
  uiPanelKeyValueInputClass: string
  uiPanelKeyValueTextSizeClass: string
  setLodHideLabelsBelow: (scale: number) => void
  setHighContrast: (enabled: boolean) => void
}

export default function RulesAndQualitySection({
  schema,
  uiPanelKeyValueInputClass,
  uiPanelKeyValueTextSizeClass,
  setLodHideLabelsBelow,
  setHighContrast,
}: RulesAndQualitySectionProps) {
  return (
    <div className="space-y-3">
      <div className={`${uiPanelKeyValueTextSizeClass} font-semibold text-gray-700`}>
        Rules and Quality
      </div>
      <Subsection title="Performance">
        <div className="flex items-center gap-2 text-xs">
          <span>Hide labels below scale</span>
          <input
            type="number"
            min={0}
            max={4}
            step={0.1}
            value={schema.performance?.lod?.hideLabelsBelowScale ?? 0}
            onChange={e => setLodHideLabelsBelow(parseFloat(e.target.value || '0'))}
            className={uiPanelKeyValueInputClass}
          />
        </div>
      </Subsection>
      <Subsection title="Accessibility">
        <div className="flex items-center gap-2 text-xs">
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={!!schema.accessibility?.highContrast}
              onChange={e => setHighContrast(e.target.checked)}
            />
            High Contrast
          </label>
        </div>
      </Subsection>
    </div>
  )
}

