import React from 'react'
import type { GraphSchema } from '@/lib/graph/schema'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

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
      `w-full h-6 px-2 text-sm border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text} rounded text-right ${UI_THEME_TOKENS.focus.primaryBorderRing}`,
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
  const ownerValueClassName = `w-40 truncate text-xs ${UI_THEME_TOKENS.text.secondary}`

  return (
    <div className={panelClassName}>
      <div className={headingClassName}>
        Layout
      </div>

      {!hasOwner ? (
        <div className={helperTextClassName}>
          Select a {scope === 'node' ? 'node type' : 'edge label'} to edit layout settings
        </div>
      ) : scope === 'node' ? (
        <div className="space-y-2">
          <div className={labelClassName}>
            Collision radius
          </div>
          <div className="flex items-center gap-2">
            <div className={ownerValueClassName}>{ownerKey}</div>
            <input
              type="number"
              min={0}
              max={200}
              step={5}
              value={collisionRadius}
              onChange={e => setCollisionByType(ownerKey, parseInt(e.target.value || '0', 10))}
              className={uiPanelKeyValueInputClass}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className={labelClassName}>
            Link distance
          </div>
          <div className="flex items-center gap-2">
            <div className={ownerValueClassName}>{ownerKey}</div>
            <input
              type="number"
              min={10}
              max={400}
              step={10}
              value={linkDistance}
              onChange={e => setLinkDistanceByLabel(ownerKey, parseInt(e.target.value || '150', 10))}
              className={uiPanelKeyValueInputClass}
            />
          </div>

          <div className={labelClassName}>
            Curvature
          </div>
          <div className="flex items-center gap-2">
            <div className={ownerValueClassName}>{ownerKey}</div>
            <input
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
          </div>
        </div>
      )}
    </div>
  )
}
