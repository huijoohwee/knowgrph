import React from 'react'
import Subsection from '@/features/schema-editor/ui/Subsection'
import type { GraphSchema } from '@/lib/graph/schema'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

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
  const sectionHeadingClassName = `${uiPanelKeyValueTextSizeClass} font-semibold ${UI_THEME_TOKENS.text.secondary}`
  const inlineLabelClassName = UI_THEME_TOKENS.text.secondary
  const selectionControlClassName = `rounded ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.selectionControl}`
  return (
    <section className="space-y-3">
      <section className={sectionHeadingClassName}>
        Rules and Quality
      </section>
      <Subsection title="Performance">
        <section className="flex items-center gap-2 text-xs">
          <span className={inlineLabelClassName}>Hide labels below scale</span>
          <input
            type="number"
            min={0}
            max={4}
            step={0.1}
            value={schema.performance?.lod?.hideLabelsBelowScale ?? 0}
            onChange={e => setLodHideLabelsBelow(parseFloat(e.target.value || '0'))}
            className={uiPanelKeyValueInputClass}
          />
        </section>
      </Subsection>
      <Subsection title="Accessibility">
        <section className="flex items-center gap-2 text-xs">
          <label className={`flex items-center gap-1 ${UI_THEME_TOKENS.text.secondary}`}>
            <input
              type="checkbox"
              className={selectionControlClassName}
              checked={!!schema.accessibility?.highContrast}
              onChange={e => setHighContrast(e.target.checked)}
            />
            High Contrast
          </label>
        </section>
      </Subsection>
    </section>
  )
}
