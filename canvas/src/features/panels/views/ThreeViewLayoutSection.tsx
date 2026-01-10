import React from 'react'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import { KeyTypeValueRow } from '@/features/panels/ui/KeyTypeValueRow'
import Tooltip from '@/features/panels/ui/Tooltip'
import type { GraphSchema } from '@/lib/graph/schema'
import {
  NODE_MOTION_TOOLTIP,
  MINIMAP_OPACITY_TOOLTIP,
  SPHERE_RADIUS_TOOLTIP,
  MIN_SPACING_TOOLTIP,
  LAYOUT_SEED_TOOLTIP,
  POLYGON_ELEVATION_TOOLTIP,
  POLYGON_OPACITY_MULTIPLIER_TOOLTIP,
} from '@/features/panels/views/ThreeViewTuningTooltips'

interface ThreeViewLayoutSectionProps {
  schema: GraphSchema
  setThreeConfig: (config: Partial<GraphSchema['three']>) => void
  collapsed: boolean
  onToggle?: (next: boolean) => void
  uiPanelKeyValueInputClass: string
}

export default function ThreeViewLayoutSection({
  schema,
  setThreeConfig,
  collapsed,
  onToggle,
  uiPanelKeyValueInputClass,
}: ThreeViewLayoutSectionProps) {
  const nodeSizingFormula: 'schema' | 'importance' =
    schema.three?.nodeSizingFormula === 'importance' ? 'importance' : 'schema'
  const edgeWidthFormula: 'schema' | 'weight' =
    schema.three?.edgeWidthFormula === 'weight' ? 'weight' : 'schema'
  const layerOpacityByLayer = schema.three?.layerOpacityByLayer || {}
  const layer1 = typeof layerOpacityByLayer['1'] === 'number' ? layerOpacityByLayer['1'] : 1.0
  const layer2 = typeof layerOpacityByLayer['2'] === 'number' ? layerOpacityByLayer['2'] : 0.9
  const layer3 = typeof layerOpacityByLayer['3'] === 'number' ? layerOpacityByLayer['3'] : 0.8

  return (
    <CollapsibleSection
      title="Layout and geometry"
      collapsed={collapsed}
      onToggle={onToggle}
      headerClassName="px-0"
      stickyOffsetClassName="top-6"
    >
      <div className="grid grid-cols-2 gap-3">
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className="text-gray-700">Node Motion</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0}
                max={2}
                step={0.1}
                value={Number(schema.three?.nodeMotionIntensity ?? 1.0)}
                onChange={e =>
                  setThreeConfig({ nodeMotionIntensity: Number(e.target.value) })
                }
              />
              <Tooltip
                content={NODE_MOTION_TOOLTIP}
                maxWidthPx={260}
                contentClassName="bg-gray-800/90"
              >
                <span className="text-gray-600">
                  {String(schema.three?.nodeMotionIntensity ?? 1.0)}
                </span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className="text-gray-700">Minimap Opacity</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0.2}
                max={1}
                step={0.05}
                value={Number(schema.three?.minimapOpacity ?? 0.7)}
                onChange={e => setThreeConfig({ minimapOpacity: Number(e.target.value) })}
              />
              <Tooltip
                content={MINIMAP_OPACITY_TOOLTIP}
                maxWidthPx={260}
                contentClassName="bg-gray-800/90"
              >
                <span className="text-gray-600">
                  {String(schema.three?.minimapOpacity ?? 0.7)}
                </span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className="text-gray-700">Sphere Radius</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={60}
                max={260}
                step={5}
                value={Number(schema.three?.sphereRadius ?? 120)}
                onChange={e => setThreeConfig({ sphereRadius: Number(e.target.value) })}
              />
              <Tooltip
                content={SPHERE_RADIUS_TOOLTIP}
                maxWidthPx={260}
                contentClassName="bg-gray-800/90"
              >
                <span className="text-gray-600">
                  {String(schema.three?.sphereRadius ?? 120)}
                </span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className="text-gray-700">Min Spacing</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0}
                max={80}
                step={2}
                value={Number(schema.three?.minSpacing ?? 0)}
                onChange={e => setThreeConfig({ minSpacing: Number(e.target.value) })}
              />
              <Tooltip
                content={MIN_SPACING_TOOLTIP}
                maxWidthPx={260}
                contentClassName="bg-gray-800/90"
              >
                <span className="text-gray-600">
                  {String(schema.three?.minSpacing ?? 0)}
                </span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className="text-gray-700">Layout Seed</span>}
          valueNode={(
            <Tooltip
              content={LAYOUT_SEED_TOOLTIP}
              maxWidthPx={260}
              contentClassName="bg-gray-800/90"
            >
              <input
                type="number"
                className={uiPanelKeyValueInputClass}
                value={Number(schema.three?.seed ?? 1)}
                onChange={e => {
                  const parsed = Number(e.target.value)
                  const next = Number.isFinite(parsed) ? parsed : 1
                  setThreeConfig({ seed: next })
                }}
              />
            </Tooltip>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className="text-gray-700">Node Sizing</span>}
          valueNode={(
            <select
              className={uiPanelKeyValueInputClass}
              value={nodeSizingFormula}
              onChange={e => {
                const next: 'schema' | 'importance' = e.target.value === 'importance' ? 'importance' : 'schema'
                setThreeConfig({ nodeSizingFormula: next })
              }}
            >
              <option value="schema">schema</option>
              <option value="importance">importance</option>
            </select>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className="text-gray-700">Edge Width</span>}
          valueNode={(
            <select
              className={uiPanelKeyValueInputClass}
              value={edgeWidthFormula}
              onChange={e => {
                const next: 'schema' | 'weight' = e.target.value === 'weight' ? 'weight' : 'schema'
                setThreeConfig({ edgeWidthFormula: next })
              }}
            >
              <option value="schema">schema</option>
              <option value="weight">weight</option>
            </select>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className="text-gray-700">Layer 1 Opacity</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={Number(layer1)}
                onChange={e => {
                  const next = Number(e.target.value)
                  setThreeConfig({ layerOpacityByLayer: { ...layerOpacityByLayer, '1': next } })
                }}
              />
              <span className="text-gray-600">
                {String(layer1)}
              </span>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className="text-gray-700">Layer 2 Opacity</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={Number(layer2)}
                onChange={e => {
                  const next = Number(e.target.value)
                  setThreeConfig({ layerOpacityByLayer: { ...layerOpacityByLayer, '2': next } })
                }}
              />
              <span className="text-gray-600">
                {String(layer2)}
              </span>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className="text-gray-700">Layer 3 Opacity</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={Number(layer3)}
                onChange={e => {
                  const next = Number(e.target.value)
                  setThreeConfig({ layerOpacityByLayer: { ...layerOpacityByLayer, '3': next } })
                }}
              />
              <span className="text-gray-600">
                {String(layer3)}
              </span>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className="text-gray-700">Graph Layer Elevation</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={-5}
                max={5}
                step={0.1}
                value={Number(schema.three?.polygons?.elevationOffset ?? -0.1)}
                onChange={e =>
                  setThreeConfig({ polygons: { ...(schema.three?.polygons || {}), elevationOffset: Number(e.target.value) } })
                }
              />
              <Tooltip
                content={POLYGON_ELEVATION_TOOLTIP}
                maxWidthPx={260}
                contentClassName="bg-gray-800/90"
              >
                <span className="text-gray-600">
                  {String(schema.three?.polygons?.elevationOffset ?? -0.1)}
                </span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className="text-gray-700">Graph Layer Opacity ×</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0}
                max={2}
                step={0.05}
                value={Number(schema.three?.polygons?.opacityMultiplier ?? 1)}
                onChange={e =>
                  setThreeConfig({ polygons: { ...(schema.three?.polygons || {}), opacityMultiplier: Number(e.target.value) } })
                }
              />
              <Tooltip
                content={POLYGON_OPACITY_MULTIPLIER_TOOLTIP}
                maxWidthPx={260}
                contentClassName="bg-gray-800/90"
              >
                <span className="text-gray-600">
                  {String(schema.three?.polygons?.opacityMultiplier ?? 1)}
                </span>
              </Tooltip>
            </>
          )}
        />
      </div>
    </CollapsibleSection>
  )
}
