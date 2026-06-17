import React from 'react'
import type { GraphSchema } from '@/lib/graph/schema'
import { useGraphStore } from '@/hooks/useGraphStore'
import { PanelTextInput } from '@/lib/ui/panelFormControls'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { UI_RESPONSIVE_GRAPH_FIELDS_OWNER_VALUE_CLASSNAME } from '@/lib/ui/responsiveElementClasses'
import { PANEL_TYPOGRAPHY_DEFAULTS } from 'grph-shared/ui/panelTypography'

type FieldLayoutSectionProps = {
  schema: GraphSchema
  scope: 'node' | 'edge'
  ownerKey: string
  uiPanelKeyValueTextSizeClass: string
}

export default function FieldLayoutSection({
  schema,
  scope,
  ownerKey,
  uiPanelKeyValueTextSizeClass,
}: FieldLayoutSectionProps) {
  const { setLinkDistanceByLabel, setCollisionByType, setSchema } = useGraphStore()
  const uiPanelKeyValueInputClass = useGraphStore(
    s =>
      s.uiPanelKeyValueInputClass ||
      PANEL_TYPOGRAPHY_DEFAULTS.keyValueInputClass,
  )

  const hasOwner = Boolean(String(ownerKey || '').trim())

  const linkDistance = schema.layout?.forces?.linkDistanceByLabel?.[ownerKey] ?? 150
  const collisionRadius = schema.layout?.forces?.collisionByType?.[ownerKey] ?? (schema.nodeSizes?.[ownerKey]?.radius ?? 10) * 1.5
  const curvatureRaw = schema.edgeRouting?.curvatureByLabel?.[ownerKey]
  const curvature = typeof curvatureRaw === 'number' ? curvatureRaw : 0
  const panelClassName = `rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} p-3 space-y-3`
  const headingClassName = `${uiPanelKeyValueTextSizeClass} font-semibold ${UI_THEME_TOKENS.text.primary}`
  const helperTextClassName = `${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.tertiary}`
  const labelClassName = `${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.secondary}`
  const ownerValueClassName = `${UI_RESPONSIVE_GRAPH_FIELDS_OWNER_VALUE_CLASSNAME} text-xs ${UI_THEME_TOKENS.text.secondary}`

  return (
    <section className={panelClassName}>
      <section className={headingClassName}>
        Layout
      </section>

      {!hasOwner ? (
        <section className={helperTextClassName}>
          Select a {scope === 'node' ? 'node type' : 'edge label'} to edit layout settings
        </section>
      ) : scope === 'node' ? (
        <section className="space-y-2">
          <section className={labelClassName}>
            Collision radius
          </section>
          <section className="flex items-center gap-2">
            <section className={ownerValueClassName}>{ownerKey}</section>
            <PanelTextInput
              type="number"
              min={0}
              max={200}
              step={5}
              value={collisionRadius}
              onChange={e => setCollisionByType(ownerKey, parseInt(e.target.value || '0', 10))}
              className={uiPanelKeyValueInputClass}
            />
          </section>
        </section>
      ) : (
        <section className="space-y-2">
          <section className={labelClassName}>
            Link distance
          </section>
          <section className="flex items-center gap-2">
            <section className={ownerValueClassName}>{ownerKey}</section>
            <PanelTextInput
              type="number"
              min={10}
              max={400}
              step={10}
              value={linkDistance}
              onChange={e => setLinkDistanceByLabel(ownerKey, parseInt(e.target.value || '150', 10))}
              className={uiPanelKeyValueInputClass}
            />
          </section>

          <section className={labelClassName}>
            Curvature
          </section>
          <section className="flex items-center gap-2">
            <section className={ownerValueClassName}>{ownerKey}</section>
            <PanelTextInput
              type="number"
              min={0}
              max={2}
              step={0.05}
              value={curvature}
              onChange={e => {
                const v = parseFloat(e.target.value || '0')
                const routingInner = schema.edgeRouting || {}
                const curvMap = routingInner.curvatureByLabel || {}
                setSchema({
                  ...schema,
                  edgeRouting: {
                    ...routingInner,
                    curvatureByLabel: { ...curvMap, [ownerKey]: v },
                  },
                })
              }}
              className={uiPanelKeyValueInputClass}
            />
          </section>
        </section>
      )}
    </section>
  )
}
