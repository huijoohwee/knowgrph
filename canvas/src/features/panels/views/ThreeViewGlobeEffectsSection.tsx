import React from 'react'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import { KeyTypeValueRow } from '@/features/panels/ui/KeyTypeValueRow'
import Tooltip from '@/features/panels/ui/Tooltip'
import type { GraphSchema } from '@/lib/graph/schema'
import {
  GLOBE_ARC_COUNT_TOOLTIP,
  GLOBE_ATMOSPHERE_OPACITY_TOOLTIP,
  GLOBE_CAMERA_ELLIPSE_HEIGHT_TOOLTIP,
  GLOBE_CAMERA_ELLIPSE_FOLLOW_TOOLTIP,
  GLOBE_CAMERA_ELLIPSE_RADIUS_TOOLTIP,
  GLOBE_CAMERA_ELLIPSE_SPEED_TOOLTIP,
  GLOBE_ELLIPSOID_AXIS_TOOLTIP,
  GLOBE_GRID_DENSITY_TOOLTIP,
  GLOBE_HUB_ORBIT_RADIUS_TOOLTIP,
  GLOBE_HUB_ORBIT_SPEED_TOOLTIP,
  GLOBE_HUB_ORBIT_STRENGTH_TOOLTIP,
  GLOBE_ORBIT_RING_COUNT_TOOLTIP,
  GLOBE_PARTICLE_COUNT_TOOLTIP,
} from '@/features/panels/views/ThreeViewTuningTooltips'
import { THREE_VIEW_FIELD_GRID_CLASS_NAME } from '@/features/panels/views/threeViewResponsiveClasses'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { UI_RESPONSIVE_SMALL_SELECTION_CONTROL_CLASSNAME } from '@/lib/ui/responsiveElementClasses'

interface ThreeViewGlobeEffectsSectionProps {
  schema: GraphSchema
  setThreeConfig: (config: Partial<GraphSchema['three']>) => void
  collapsed: boolean
  onToggle?: (next: boolean) => void
}

export default function ThreeViewGlobeEffectsSection({
  schema,
  setThreeConfig,
  collapsed,
  onToggle,
}: ThreeViewGlobeEffectsSectionProps) {
  const globeEffectsEnabled = schema.three?.globeEffectsEnabled !== false
  const keyLabelClassName = UI_THEME_TOKENS.text.secondary
  const valueTextClassName = UI_THEME_TOKENS.text.tertiary
  const selectionControlClassName = `${UI_RESPONSIVE_SMALL_SELECTION_CONTROL_CLASSNAME} rounded ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.selectionControl}`
  return (
    <CollapsibleSection
      title="Globe effects"
      collapsed={collapsed}
      onToggle={onToggle}
      headerClassName="px-0"
      stickyOffsetClassName="top-6"
    >
      <section className={THREE_VIEW_FIELD_GRID_CLASS_NAME}>
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Enable Effects</span>}
          valueNode={(
            <input
              type="checkbox"
              className={selectionControlClassName}
              checked={globeEffectsEnabled}
              onChange={e => setThreeConfig({ globeEffectsEnabled: e.target.checked })}
            />
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Label Depth Fade</span>}
          valueNode={(
            <input
              type="checkbox"
              className={selectionControlClassName}
              checked={schema.three?.globeLabelDepthFade !== false}
              onChange={e => setThreeConfig({ globeLabelDepthFade: e.target.checked })}
            />
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Label Back-face Culling</span>}
          valueNode={(
            <input
              type="checkbox"
              className={selectionControlClassName}
              checked={schema.three?.globeLabelBackfaceCulling !== false}
              onChange={e => setThreeConfig({ globeLabelBackfaceCulling: e.target.checked })}
            />
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Auto Rotate Speed</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0}
                max={0.4}
                step={0.01}
                value={Number(schema.three?.globeAutoRotateSpeed ?? 0.08)}
                onChange={e => setThreeConfig({ globeAutoRotateSpeed: Number(e.target.value) })}
              />
              <span className={valueTextClassName}>{String(schema.three?.globeAutoRotateSpeed ?? 0.08)}</span>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Ellipse Camera Path</span>}
          valueNode={(
            <input
              type="checkbox"
              className={selectionControlClassName}
              checked={schema.three?.globeCameraEllipseEnabled !== false}
              onChange={e => setThreeConfig({ globeCameraEllipseEnabled: e.target.checked })}
            />
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Ellipse Speed</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0}
                max={0.4}
                step={0.01}
                value={Number(schema.three?.globeCameraEllipseSpeed ?? 0.045)}
                onChange={e => setThreeConfig({ globeCameraEllipseSpeed: Number(e.target.value) })}
              />
              <Tooltip content={GLOBE_CAMERA_ELLIPSE_SPEED_TOOLTIP} maxWidthPx={260}>
                <span className={valueTextClassName}>{String(schema.three?.globeCameraEllipseSpeed ?? 0.045)}</span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Ellipse Radius X</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0.4}
                max={2.2}
                step={0.02}
                value={Number(schema.three?.globeCameraEllipseRadiusXFactor ?? 1.24)}
                onChange={e => setThreeConfig({ globeCameraEllipseRadiusXFactor: Number(e.target.value) })}
              />
              <Tooltip content={GLOBE_CAMERA_ELLIPSE_RADIUS_TOOLTIP} maxWidthPx={260}>
                <span className={valueTextClassName}>{String(schema.three?.globeCameraEllipseRadiusXFactor ?? 1.24)}</span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Ellipse Radius Z</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0.4}
                max={2.2}
                step={0.02}
                value={Number(schema.three?.globeCameraEllipseRadiusZFactor ?? 1.02)}
                onChange={e => setThreeConfig({ globeCameraEllipseRadiusZFactor: Number(e.target.value) })}
              />
              <Tooltip content={GLOBE_CAMERA_ELLIPSE_RADIUS_TOOLTIP} maxWidthPx={260}>
                <span className={valueTextClassName}>{String(schema.three?.globeCameraEllipseRadiusZFactor ?? 1.02)}</span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Ellipse Height</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={Number(schema.three?.globeCameraEllipseHeightFactor ?? 0.26)}
                onChange={e => setThreeConfig({ globeCameraEllipseHeightFactor: Number(e.target.value) })}
              />
              <Tooltip content={GLOBE_CAMERA_ELLIPSE_HEIGHT_TOOLTIP} maxWidthPx={260}>
                <span className={valueTextClassName}>{String(schema.three?.globeCameraEllipseHeightFactor ?? 0.26)}</span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Ellipse Follow</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0.02}
                max={1}
                step={0.02}
                value={Number(schema.three?.globeCameraEllipseFollow ?? 0.06)}
                onChange={e => setThreeConfig({ globeCameraEllipseFollow: Number(e.target.value) })}
              />
              <Tooltip content={GLOBE_CAMERA_ELLIPSE_FOLLOW_TOOLTIP} maxWidthPx={260}>
                <span className={valueTextClassName}>{String(schema.three?.globeCameraEllipseFollow ?? 0.06)}</span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Hub Orbit</span>}
          valueNode={(
            <input
              type="checkbox"
              className={selectionControlClassName}
              checked={schema.three?.globeHubOrbitEnabled !== false}
              onChange={e => setThreeConfig({ globeHubOrbitEnabled: e.target.checked })}
            />
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Hub Orbit Strength</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0}
                max={1.8}
                step={0.02}
                value={Number(schema.three?.globeHubOrbitStrength ?? 0.22)}
                onChange={e => setThreeConfig({ globeHubOrbitStrength: Number(e.target.value) })}
              />
              <Tooltip content={GLOBE_HUB_ORBIT_STRENGTH_TOOLTIP} maxWidthPx={260}>
                <span className={valueTextClassName}>{String(schema.three?.globeHubOrbitStrength ?? 0.22)}</span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Hub Orbit Speed</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0}
                max={2.2}
                step={0.02}
                value={Number(schema.three?.globeHubOrbitSpeed ?? 0.24)}
                onChange={e => setThreeConfig({ globeHubOrbitSpeed: Number(e.target.value) })}
              />
              <Tooltip content={GLOBE_HUB_ORBIT_SPEED_TOOLTIP} maxWidthPx={260}>
                <span className={valueTextClassName}>{String(schema.three?.globeHubOrbitSpeed ?? 0.24)}</span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Hub Orbit Radius</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0.05}
                max={0.8}
                step={0.01}
                value={Number(schema.three?.globeHubOrbitRadiusFactor ?? 0.2)}
                onChange={e => setThreeConfig({ globeHubOrbitRadiusFactor: Number(e.target.value) })}
              />
              <Tooltip content={GLOBE_HUB_ORBIT_RADIUS_TOOLTIP} maxWidthPx={260}>
                <span className={valueTextClassName}>{String(schema.three?.globeHubOrbitRadiusFactor ?? 0.2)}</span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Ellipsoid Axis X</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0.5}
                max={1.8}
                step={0.02}
                value={Number(schema.three?.globeSphereEllipsoidX ?? 1.08)}
                onChange={e => setThreeConfig({ globeSphereEllipsoidX: Number(e.target.value) })}
              />
              <Tooltip content={GLOBE_ELLIPSOID_AXIS_TOOLTIP} maxWidthPx={260}>
                <span className={valueTextClassName}>{String(schema.three?.globeSphereEllipsoidX ?? 1.08)}</span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Ellipsoid Axis Y</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0.5}
                max={1.8}
                step={0.02}
                value={Number(schema.three?.globeSphereEllipsoidY ?? 0.88)}
                onChange={e => setThreeConfig({ globeSphereEllipsoidY: Number(e.target.value) })}
              />
              <Tooltip content={GLOBE_ELLIPSOID_AXIS_TOOLTIP} maxWidthPx={260}>
                <span className={valueTextClassName}>{String(schema.three?.globeSphereEllipsoidY ?? 0.88)}</span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Ellipsoid Axis Z</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0.5}
                max={1.8}
                step={0.02}
                value={Number(schema.three?.globeSphereEllipsoidZ ?? 1)}
                onChange={e => setThreeConfig({ globeSphereEllipsoidZ: Number(e.target.value) })}
              />
              <Tooltip content={GLOBE_ELLIPSOID_AXIS_TOOLTIP} maxWidthPx={260}>
                <span className={valueTextClassName}>{String(schema.three?.globeSphereEllipsoidZ ?? 1)}</span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Particle Count</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0}
                max={4000}
                step={40}
                value={Number(schema.three?.globeParticleCount ?? 720)}
                onChange={e => setThreeConfig({ globeParticleCount: Number(e.target.value) })}
              />
              <Tooltip content={GLOBE_PARTICLE_COUNT_TOOLTIP} maxWidthPx={260}>
                <span className={valueTextClassName}>{String(schema.three?.globeParticleCount ?? 720)}</span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Atmosphere Opacity</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0}
                max={0.8}
                step={0.02}
                value={Number(schema.three?.globeAtmosphereOpacity ?? 0.22)}
                onChange={e => setThreeConfig({ globeAtmosphereOpacity: Number(e.target.value) })}
              />
              <Tooltip content={GLOBE_ATMOSPHERE_OPACITY_TOOLTIP} maxWidthPx={260}>
                <span className={valueTextClassName}>{String(schema.three?.globeAtmosphereOpacity ?? 0.22)}</span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Grid Density</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={4}
                max={36}
                step={1}
                value={Number(schema.three?.globeGridDensity ?? 12)}
                onChange={e => setThreeConfig({ globeGridDensity: Number(e.target.value) })}
              />
              <Tooltip content={GLOBE_GRID_DENSITY_TOOLTIP} maxWidthPx={260}>
                <span className={valueTextClassName}>{String(schema.three?.globeGridDensity ?? 12)}</span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Orbit Rings</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0}
                max={10}
                step={1}
                value={Number(schema.three?.globeOrbitRingCount ?? 4)}
                onChange={e => setThreeConfig({ globeOrbitRingCount: Number(e.target.value) })}
              />
              <Tooltip content={GLOBE_ORBIT_RING_COUNT_TOOLTIP} maxWidthPx={260}>
                <span className={valueTextClassName}>{String(schema.three?.globeOrbitRingCount ?? 4)}</span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Tool Nodes</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0}
                max={80}
                step={1}
                value={Number(schema.three?.globeToolNodeCount ?? 24)}
                onChange={e => setThreeConfig({ globeToolNodeCount: Number(e.target.value) })}
              />
              <span className={valueTextClassName}>{String(schema.three?.globeToolNodeCount ?? 24)}</span>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Great-circle Arcs</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0}
                max={36}
                step={1}
                value={Number(schema.three?.globeArcCount ?? 12)}
                onChange={e => setThreeConfig({ globeArcCount: Number(e.target.value) })}
              />
              <Tooltip content={GLOBE_ARC_COUNT_TOOLTIP} maxWidthPx={260}>
                <span className={valueTextClassName}>{String(schema.three?.globeArcCount ?? 12)}</span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Arc Travelers</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0}
                max={4}
                step={1}
                value={Number(schema.three?.globeArcTravelerCount ?? 1)}
                onChange={e => setThreeConfig({ globeArcTravelerCount: Number(e.target.value) })}
              />
              <span className={valueTextClassName}>{String(schema.three?.globeArcTravelerCount ?? 1)}</span>
            </>
          )}
        />
      </section>
    </CollapsibleSection>
  )
}
