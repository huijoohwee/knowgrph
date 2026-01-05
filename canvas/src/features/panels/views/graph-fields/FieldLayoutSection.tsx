import React from 'react'
import type { GraphSchema } from '@/lib/graph/schema'
import { useGraphStore } from '@/hooks/useGraphStore'

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
      'w-full h-6 px-2 text-sm border border-gray-300 rounded text-right',
  )

  const hasOwner = Boolean(String(ownerKey || '').trim())

  const linkDistance = schema.layout?.forces?.linkDistanceByLabel?.[ownerKey] ?? 100
  const collisionRadius = schema.layout?.forces?.collisionByType?.[ownerKey] ?? (schema.nodeSizes?.[ownerKey]?.radius ?? 10)
  const curvatureRaw = schema.edgeRouting?.curvatureByLabel?.[ownerKey]
  const curvature = typeof curvatureRaw === 'number' ? curvatureRaw : 0

  return (
    <div className="rounded border border-gray-200 bg-white p-3 space-y-3">
      <div className={`${uiPanelKeyValueTextSizeClass} font-semibold text-gray-800`}>
        Layout
      </div>

      {!hasOwner ? (
        <div className={`${uiPanelKeyValueTextSizeClass} text-gray-500`}>
          Select a {scope === 'node' ? 'node type' : 'edge label'} to edit layout settings
        </div>
      ) : scope === 'node' ? (
        <div className="space-y-2">
          <div className={`${uiPanelKeyValueTextSizeClass} text-gray-700`}>
            Collision radius
          </div>
          <div className="flex items-center gap-2">
            <div className="w-40 truncate text-xs text-gray-700">{ownerKey}</div>
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
          <div className={`${uiPanelKeyValueTextSizeClass} text-gray-700`}>
            Link distance
          </div>
          <div className="flex items-center gap-2">
            <div className="w-40 truncate text-xs text-gray-700">{ownerKey}</div>
            <input
              type="number"
              min={10}
              max={400}
              step={10}
              value={linkDistance}
              onChange={e => setLinkDistanceByLabel(ownerKey, parseInt(e.target.value || '100', 10))}
              className={uiPanelKeyValueInputClass}
            />
          </div>

          <div className={`${uiPanelKeyValueTextSizeClass} text-gray-700`}>
            Curvature
          </div>
          <div className="flex items-center gap-2">
            <div className="w-40 truncate text-xs text-gray-700">{ownerKey}</div>
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

