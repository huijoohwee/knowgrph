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
  VOXEL_SEED_SCALE_TOOLTIP,
  VOXEL_GRID_SCALE_TOOLTIP,
  VOXEL_GHOST_OPACITY_TOOLTIP,
  VOXEL_TOP_CAP_EMISSIVE_TOOLTIP,
  VOXEL_CLUSTER_LIGHT_TOOLTIP,
  VOXEL_HUB_PULSE_TOOLTIP,
  VOXEL_CONCEPT_FLOAT_TOOLTIP,
  VOXEL_IDLE_ROTATE_DELAY_TOOLTIP,
  VOXEL_IDLE_ROTATE_SPEED_TOOLTIP,
} from '@/features/panels/views/ThreeViewTuningTooltips'
import ThreeSizingAndWidthControls from '@/features/panels/views/shared/ThreeSizingAndWidthControls'

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
          keyNode={<span className="text-gray-700">Voxel Seed Scale</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0.3}
                max={3}
                step={0.05}
                value={Number(schema.three?.voxelSeedScaleFactor ?? 1)}
                onChange={e => setThreeConfig({ voxelSeedScaleFactor: Number(e.target.value) })}
              />
              <Tooltip
                content={VOXEL_SEED_SCALE_TOOLTIP}
                maxWidthPx={260}
                contentClassName="bg-gray-800/90"
              >
                <span className="text-gray-600">
                  {String(schema.three?.voxelSeedScaleFactor ?? 1)}
                </span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className="text-gray-700">Voxel Grid Scale</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0.3}
                max={3}
                step={0.05}
                value={Number(schema.three?.voxelGridScaleFactor ?? 1)}
                onChange={e => setThreeConfig({ voxelGridScaleFactor: Number(e.target.value) })}
              />
              <Tooltip
                content={VOXEL_GRID_SCALE_TOOLTIP}
                maxWidthPx={260}
                contentClassName="bg-gray-800/90"
              >
                <span className="text-gray-600">
                  {String(schema.three?.voxelGridScaleFactor ?? 1)}
                </span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className="text-gray-700">Voxel Ghost Opacity</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0.05}
                max={0.9}
                step={0.05}
                value={Number(schema.three?.voxelGhostOpacity ?? 0.32)}
                onChange={e => setThreeConfig({ voxelGhostOpacity: Number(e.target.value) })}
              />
              <Tooltip
                content={VOXEL_GHOST_OPACITY_TOOLTIP}
                maxWidthPx={260}
                contentClassName="bg-gray-800/90"
              >
                <span className="text-gray-600">
                  {String(schema.three?.voxelGhostOpacity ?? 0.32)}
                </span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className="text-gray-700">Voxel Top Cap Glow</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0.2}
                max={2.2}
                step={0.1}
                value={Number(schema.three?.voxelTopCapEmissiveIntensity ?? 0.9)}
                onChange={e => setThreeConfig({ voxelTopCapEmissiveIntensity: Number(e.target.value) })}
              />
              <Tooltip
                content={VOXEL_TOP_CAP_EMISSIVE_TOOLTIP}
                maxWidthPx={260}
                contentClassName="bg-gray-800/90"
              >
                <span className="text-gray-600">
                  {String(schema.three?.voxelTopCapEmissiveIntensity ?? 0.9)}
                </span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className="text-gray-700">Voxel Cluster Light</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0}
                max={2}
                step={0.1}
                value={Number(schema.three?.voxelClusterLightIntensity ?? 0.7)}
                onChange={e => setThreeConfig({ voxelClusterLightIntensity: Number(e.target.value) })}
              />
              <Tooltip
                content={VOXEL_CLUSTER_LIGHT_TOOLTIP}
                maxWidthPx={260}
                contentClassName="bg-gray-800/90"
              >
                <span className="text-gray-600">
                  {String(schema.three?.voxelClusterLightIntensity ?? 0.7)}
                </span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className="text-gray-700">Voxel Hub Pulse</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0}
                max={0.5}
                step={0.01}
                value={Number(schema.three?.voxelHubPulseStrength ?? 0.07)}
                onChange={e => setThreeConfig({ voxelHubPulseStrength: Number(e.target.value) })}
              />
              <Tooltip
                content={VOXEL_HUB_PULSE_TOOLTIP}
                maxWidthPx={260}
                contentClassName="bg-gray-800/90"
              >
                <span className="text-gray-600">
                  {String(schema.three?.voxelHubPulseStrength ?? 0.07)}
                </span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className="text-gray-700">Voxel Concept Float</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0}
                max={4}
                step={0.1}
                value={Number(schema.three?.voxelConceptFloatStrength ?? 1)}
                onChange={e => setThreeConfig({ voxelConceptFloatStrength: Number(e.target.value) })}
              />
              <Tooltip
                content={VOXEL_CONCEPT_FLOAT_TOOLTIP}
                maxWidthPx={260}
                contentClassName="bg-gray-800/90"
              >
                <span className="text-gray-600">
                  {String(schema.three?.voxelConceptFloatStrength ?? 1)}
                </span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className="text-gray-700">Voxel Idle Rotate Delay</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0}
                max={6000}
                step={100}
                value={Number(schema.three?.voxelIdleAutoRotateDelayMs ?? 900)}
                onChange={e => setThreeConfig({ voxelIdleAutoRotateDelayMs: Number(e.target.value) })}
              />
              <Tooltip
                content={VOXEL_IDLE_ROTATE_DELAY_TOOLTIP}
                maxWidthPx={260}
                contentClassName="bg-gray-800/90"
              >
                <span className="text-gray-600">
                  {String(schema.three?.voxelIdleAutoRotateDelayMs ?? 900)}
                </span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className="text-gray-700">Voxel Idle Rotate Speed</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0}
                max={1.5}
                step={0.05}
                value={Number(schema.three?.voxelIdleAutoRotateSpeed ?? 0.12)}
                onChange={e => setThreeConfig({ voxelIdleAutoRotateSpeed: Number(e.target.value) })}
              />
              <Tooltip
                content={VOXEL_IDLE_ROTATE_SPEED_TOOLTIP}
                maxWidthPx={260}
                contentClassName="bg-gray-800/90"
              >
                <span className="text-gray-600">
                  {String(schema.three?.voxelIdleAutoRotateSpeed ?? 0.12)}
                </span>
              </Tooltip>
            </>
          )}
        />
        <ThreeSizingAndWidthControls
          schema={schema}
          setThreeConfig={setThreeConfig}
          uiPanelKeyValueInputClass={uiPanelKeyValueInputClass}
          variant="simple"
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
      </div>
    </CollapsibleSection>
  )
}
