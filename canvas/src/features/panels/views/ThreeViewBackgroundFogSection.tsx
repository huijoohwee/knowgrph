import React from 'react'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import { KeyTypeValueRow } from '@/features/panels/ui/KeyTypeValueRow'
import Tooltip from '@/features/panels/ui/Tooltip'
import type { GraphSchema } from '@/lib/graph/schema'
import { FOG_NEAR_TOOLTIP, FOG_FAR_TOOLTIP } from '@/features/panels/views/ThreeViewTuningTooltips'
import { THREE_VIEW_FIELD_GRID_CLASS_NAME } from '@/features/panels/views/threeViewResponsiveClasses'
import { PlainTextInputEditor } from '@/components/ui/PlainTextInputEditor'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { UI_RESPONSIVE_COLOR_SWATCH_CLASSNAME } from '@/lib/ui/responsiveElementClasses'

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
  const keyLabelClassName = UI_THEME_TOKENS.text.secondary
  const valueTextClassName = UI_THEME_TOKENS.text.tertiary
  const colorInputClassName = `${UI_RESPONSIVE_COLOR_SWATCH_CLASSNAME} border ${UI_THEME_TOKENS.input.border} rounded cursor-pointer bg-transparent ${UI_THEME_TOKENS.focus.primaryBorderRing}`
  return (
    <CollapsibleSection
      title="Background and fog"
      collapsed={collapsed}
      onToggle={onToggle}
      headerClassName="px-0"
      stickyOffsetClassName="top-6"
    >
      <section className={THREE_VIEW_FIELD_GRID_CLASS_NAME}>
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Background Color</span>}
          valueNode={(
            <section className="flex items-center gap-2">
              <input
                type="color"
                className={colorInputClassName}
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
              <PlainTextInputEditor
                className={uiPanelKeyValueInputClass}
                value={String(schema.three?.backgroundColor ?? '')}
                onChange={next => setThreeConfig({ backgroundColor: next })}
                placeholder="#020617"
              />
            </section>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Fog Color (blank = off)</span>}
          valueNode={(
            <section className="flex items-center gap-2">
              <input
                type="color"
                className={colorInputClassName}
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
              <PlainTextInputEditor
                className={uiPanelKeyValueInputClass}
                value={String(schema.three?.fogColor ?? '')}
                onChange={next => setThreeConfig({ fogColor: next })}
                placeholder="#1e1b4b"
              />
            </section>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Fog Near</span>}
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

              >
                <span className={valueTextClassName}>
                  {String(schema.three?.fogNear ?? 180)}
                </span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Fog Far</span>}
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

              >
                <span className={valueTextClassName}>
                  {String(schema.three?.fogFar ?? 360)}
                </span>
              </Tooltip>
            </>
          )}
        />
      </section>
    </CollapsibleSection>
  )
}
