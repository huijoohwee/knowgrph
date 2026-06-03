import React from 'react'
import Subsection from '@/features/schema-editor/ui/Subsection'
import type { GraphSchema } from '@/lib/graph/schema'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { UI_RESPONSIVE_PANEL_INLINE_FIELD_CLASSNAME } from '@/lib/ui/responsiveElementClasses'

type LayoutAndRoutingSectionProps = {
  schema: GraphSchema
  uiPanelKeyValueInputClass: string
  uiPanelKeyValueTextSizeClass: string
  setSchema: (next: GraphSchema) => void
  setCharge: (charge: number) => void
  setAlphaDecay: (alpha: number) => void
  setThreeConfig: (cfg: { sphereRadius?: number; seed?: number; minSpacing?: number }) => void
}

export default function LayoutAndRoutingSection({
  schema,
  uiPanelKeyValueInputClass,
  uiPanelKeyValueTextSizeClass,
  setSchema,
  setCharge,
  setAlphaDecay,
  setThreeConfig,
}: LayoutAndRoutingSectionProps) {
  const sectionHeadingClassName = `${uiPanelKeyValueTextSizeClass} font-semibold ${UI_THEME_TOKENS.text.secondary}`
  const inlineLabelClassName = UI_THEME_TOKENS.text.secondary
  const selectClassName = `${UI_RESPONSIVE_PANEL_INLINE_FIELD_CLASSNAME} text-xs border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text} rounded ${UI_THEME_TOKENS.focus.primaryBorderRing}`
  return (
    <div className="space-y-3">
      <div className={sectionHeadingClassName}>Layout</div>
      <Subsection title="Layout">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <span className={inlineLabelClassName}>Charge</span>
            <input
              type="number"
              step={10}
              value={schema.layout?.forces?.charge ?? -300}
              onChange={e => setCharge(parseFloat(e.target.value || '-300'))}
              className={uiPanelKeyValueInputClass}
            />
            <span className={`ml-4 text-xs ${UI_THEME_TOKENS.text.secondary}`}>Alpha Decay</span>
            <input
              type="number"
              min={0}
              max={1}
              step={0.005}
              value={schema.layout?.forces?.alphaDecay ?? 0.02}
              onChange={e => setAlphaDecay(parseFloat(e.target.value || '0.02'))}
              className={uiPanelKeyValueInputClass}
            />
          </div>
        </div>
      </Subsection>
      <Subsection title="Edge Routing">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <span className={inlineLabelClassName}>Routing Mode</span>
            {(() => {
              const routing = schema.edgeRouting || {}
              const mode = routing.mode || 'quadratic'
              return (
                <select
                  value={mode}
                  onChange={e => {
                    const nextMode = e.target.value === 'straight' ? 'straight' : 'quadratic'
                    const cur = schema.edgeRouting || {}
                    setSchema({
                      ...schema,
                      edgeRouting: {
                        ...cur,
                        mode: nextMode as typeof cur.mode,
                        curvatureByLabel: cur.curvatureByLabel || {},
                      },
                    })
                  }}
                  className={selectClassName}
                >
                  <option value="quadratic">Quadratic</option>
                  <option value="straight">Straight</option>
                </select>
              )
            })()}
          </div>
        </div>
      </Subsection>
      <Subsection title="3D Layout">
        <div className="flex items-center gap-2 text-xs">
          <span className={inlineLabelClassName}>Sphere Radius</span>
          <input
            type="number"
            min={20}
            max={400}
            step={5}
            value={schema.three?.sphereRadius ?? 120}
            onChange={e => setThreeConfig({ sphereRadius: parseFloat(e.target.value || '120') })}
            className={uiPanelKeyValueInputClass}
          />
          <span className={`ml-4 ${UI_THEME_TOKENS.text.secondary}`}>Seed</span>
          <input
            type="number"
            min={0}
            max={999999}
            step={1}
            value={schema.three?.seed ?? 1}
            onChange={e => setThreeConfig({ seed: parseInt(e.target.value || '1', 10) })}
            className={uiPanelKeyValueInputClass}
          />
          <span className={`ml-4 ${UI_THEME_TOKENS.text.secondary}`}>Min Spacing</span>
          <input
            type="number"
            min={0}
            max={200}
            step={1}
            value={schema.three?.minSpacing ?? 0}
            onChange={e => setThreeConfig({ minSpacing: parseFloat(e.target.value || '0') })}
            className={uiPanelKeyValueInputClass}
          />
        </div>
      </Subsection>
    </div>
  )
}
