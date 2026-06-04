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
import { THREE_VIEW_FIELD_GRID_CLASS_NAME } from '@/features/panels/views/threeViewResponsiveClasses'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import {
  UI_RESPONSIVE_COLOR_SWATCH_CLASSNAME,
  UI_RESPONSIVE_COMPACT_SELECTION_CONTROL_CLASSNAME,
} from '@/lib/ui/responsiveElementClasses'

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
  const keyLabelClassName = UI_THEME_TOKENS.text.secondary
  const valueTextClassName = UI_THEME_TOKENS.text.tertiary
  const selectionControlClassName = `${UI_RESPONSIVE_COMPACT_SELECTION_CONTROL_CLASSNAME} rounded ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.selectionControl}`
  const colorPickerClassName = `${UI_RESPONSIVE_COLOR_SWATCH_CLASSNAME} border ${UI_THEME_TOKENS.input.border} rounded cursor-pointer bg-transparent ${UI_THEME_TOKENS.focus.primaryBorderRing}`
  return (
    <CollapsibleSection
      title="Starfield"
      collapsed={collapsed}
      onToggle={onToggle}
      headerClassName="px-0"
      stickyOffsetClassName="top-6"
    >
      <section className={THREE_VIEW_FIELD_GRID_CLASS_NAME}>
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Starfield</span>}
          valueNode={(
            <input
              type="checkbox"
              className={selectionControlClassName}
              checked={Boolean(schema.three?.starfieldEnabled ?? false)}
              onChange={e => setThreeConfig({ starfieldEnabled: e.target.checked })}
            />
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Star Count</span>}
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

              >
                <span className={valueTextClassName}>
                  {String(schema.three?.starfieldCount ?? 0)}
                </span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Starfield Radius</span>}
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

              >
                <span className={valueTextClassName}>
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
          keyNode={<span className={keyLabelClassName}>Starfield Brightness</span>}
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

              >
                <span className={valueTextClassName}>
                  {String(schema.three?.starfieldOpacity ?? 0.9)}
                </span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Starfield Color</span>}
          valueNode={(
            <section className="flex items-center gap-2">
              <input
                type="color"
                className={colorPickerClassName}
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
            </section>
          )}
        />
      </section>
    </CollapsibleSection>
  )
}
