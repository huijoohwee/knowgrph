import React from 'react'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import { KeyTypeValueRow } from '@/features/panels/ui/KeyTypeValueRow'
import Tooltip from '@/features/panels/ui/Tooltip'
import type { GraphSchema } from '@/lib/graph/schema'
import { getThreeSelectionConfig } from '@/lib/graph/schema'
import {
  ARROW_LENGTH_TOOLTIP,
  LINK_OPACITY_TOOLTIP,
  LINK_CURVATURE_TOOLTIP,
  CURVE_ROTATION_TOOLTIP,
  DIRECTIONAL_PARTICLES_TOOLTIP,
  ARROW_POSITION_TOOLTIP,
  PARTICLE_SPEED_TOOLTIP,
  SELECTED_EDGE_WIDTH_TOOLTIP,
} from '@/features/panels/views/ThreeViewTuningTooltips'
import { THREE_VIEW_FIELD_GRID_CLASS_NAME } from '@/features/panels/views/threeViewResponsiveClasses'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

interface ThreeViewLinksSectionProps {
  schema: GraphSchema
  setThreeConfig: (config: Partial<GraphSchema['three']>) => void
  collapsed: boolean
  onToggle?: (next: boolean) => void
}

export default function ThreeViewLinksSection({
  schema,
  setThreeConfig,
  collapsed,
  onToggle,
}: ThreeViewLinksSectionProps) {
  const selectionConfig = getThreeSelectionConfig(schema)
  const keyLabelClassName = UI_THEME_TOKENS.text.secondary
  const valueTextClassName = UI_THEME_TOKENS.text.tertiary

  return (
    <CollapsibleSection
      title="Edges and particles"
      collapsed={collapsed}
      onToggle={onToggle}
      headerClassName="px-0"
      stickyOffsetClassName="top-6"
    >
      <section className={THREE_VIEW_FIELD_GRID_CLASS_NAME}>
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Arrow Length</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={2}
                max={24}
                step={1}
                value={Number(schema.three?.linkDirectionalArrowLength ?? 8)}
                onChange={e =>
                  setThreeConfig({ linkDirectionalArrowLength: Number(e.target.value) })
                }
              />
              <Tooltip
                content={ARROW_LENGTH_TOOLTIP}
                maxWidthPx={260}

              >
                <span className={valueTextClassName}>
                  {String(schema.three?.linkDirectionalArrowLength ?? 8)}
                </span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Link Opacity</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={Number(schema.three?.linkOpacity ?? 0.6)}
                onChange={e => setThreeConfig({ linkOpacity: Number(e.target.value) })}
              />
              <Tooltip
                content={LINK_OPACITY_TOOLTIP}
                maxWidthPx={260}

              >
                <span className={valueTextClassName}>
                  {String(schema.three?.linkOpacity ?? 0.6)}
                </span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Default Curvature</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0}
                max={1.5}
                step={0.05}
                value={Number(schema.three?.linkCurvature ?? 0.0)}
                onChange={e => setThreeConfig({ linkCurvature: Number(e.target.value) })}
              />
              <Tooltip
                content={LINK_CURVATURE_TOOLTIP}
                maxWidthPx={260}

              >
                <span className={valueTextClassName}>
                  {String(schema.three?.linkCurvature ?? 0.0)}
                </span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Curve Rotation</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={-Math.PI}
                max={Math.PI}
                step={0.05}
                value={Number(schema.three?.linkCurveRotation ?? 0.0)}
                onChange={e => setThreeConfig({ linkCurveRotation: Number(e.target.value) })}
              />
              <Tooltip
                content={CURVE_ROTATION_TOOLTIP}
                maxWidthPx={260}

              >
                <span className={valueTextClassName}>
                  {String(schema.three?.linkCurveRotation ?? 0.0)}
                </span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Directional Particles</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0}
                max={32}
                step={1}
                value={Number(schema.three?.linkDirectionalParticles ?? 0)}
                onChange={e =>
                  setThreeConfig({ linkDirectionalParticles: Number(e.target.value) })
                }
              />
              <Tooltip
                content={DIRECTIONAL_PARTICLES_TOOLTIP}
                maxWidthPx={260}

              >
                <span className={valueTextClassName}>
                  {String(schema.three?.linkDirectionalParticles ?? 0)}
                </span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Arrow Position</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0.2}
                max={1}
                step={0.05}
                value={Number(schema.three?.linkDirectionalArrowRelPos ?? 0.85)}
                onChange={e =>
                  setThreeConfig({ linkDirectionalArrowRelPos: Number(e.target.value) })
                }
              />
              <Tooltip
                content={ARROW_POSITION_TOOLTIP}
                maxWidthPx={260}

              >
                <span className={valueTextClassName}>
                  {String(schema.three?.linkDirectionalArrowRelPos ?? 0.85)}
                </span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Particle Speed</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0.1}
                max={2}
                step={0.05}
                value={Number(schema.three?.linkDirectionalParticleSpeed ?? 0.6)}
                onChange={e =>
                  setThreeConfig({ linkDirectionalParticleSpeed: Number(e.target.value) })
                }
              />
              <Tooltip
                content={PARTICLE_SPEED_TOOLTIP}
                maxWidthPx={260}

              >
                <span className={valueTextClassName}>
                  {String(schema.three?.linkDirectionalParticleSpeed ?? 0.6)}
                </span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Selected Edge Width</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={1}
                max={6}
                step={0.25}
                value={Number(selectionConfig.selectedEdgeWidth)}
                onChange={e =>
                  setThreeConfig({ selection: { selectedEdgeWidth: Number(e.target.value) } })
                }
              />
              <Tooltip
                content={SELECTED_EDGE_WIDTH_TOOLTIP}
                maxWidthPx={260}

              >
                <span className={valueTextClassName}>
                  {String(selectionConfig.selectedEdgeWidth)}
                </span>
              </Tooltip>
            </>
          )}
        />
      </section>
    </CollapsibleSection>
  )
}
