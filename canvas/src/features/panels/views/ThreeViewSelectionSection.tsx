import React from 'react'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import { useCanvasKeyTypeValueStaticRowProps } from '@/features/panels/ui/canvasKeyTypeValueRuntime'
import { KeyTypeValueStaticRow } from 'grph-shared/react/keyTypeValueRow'
import Tooltip from '@/features/panels/ui/Tooltip'
import type { GraphSchema } from '@/lib/graph/schema'
import {
  SELECTED_NODE_GLOW_TOOLTIP,
  DIMMED_NODE_OPACITY_TOOLTIP,
  DIMMED_EDGE_OPACITY_TOOLTIP,
} from '@/features/panels/views/ThreeViewTuningTooltips'
import { THREE_VIEW_FIELD_GRID_CLASS_NAME } from '@/features/panels/views/threeViewResponsiveClasses'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

interface ThreeViewSelectionSectionProps {
  schema: GraphSchema
  setThreeConfig: (config: Partial<GraphSchema['three']>) => void
  collapsed: boolean
  onToggle?: (next: boolean) => void
}

export default function ThreeViewSelectionSection({
  schema,
  setThreeConfig,
  collapsed,
  onToggle,
}: ThreeViewSelectionSectionProps) {
  const keyLabelClassName = UI_THEME_TOKENS.text.secondary
  const valueTextClassName = UI_THEME_TOKENS.text.tertiary
  const compactStaticRowProps = useCanvasKeyTypeValueStaticRowProps('compact')

  return (
    <CollapsibleSection
      title="Selection highlighting"
      collapsed={collapsed}
      onToggle={onToggle}
      headerClassName="px-0"
      stickyOffsetClassName="top-6"
    >
      <section className={THREE_VIEW_FIELD_GRID_CLASS_NAME}>
        <KeyTypeValueStaticRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Selected Node Glow</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0}
                max={3}
                step={0.1}
                value={Number(schema.three?.selection?.selectedNodeGlowIntensity ?? 0.8)}
                onChange={e =>
                  setThreeConfig({
                    selection: { selectedNodeGlowIntensity: Number(e.target.value) },
                  })
                }
              />
              <Tooltip
                content={SELECTED_NODE_GLOW_TOOLTIP}
                maxWidthPx={260}

              >
                <span className={valueTextClassName}>
                  {String(schema.three?.selection?.selectedNodeGlowIntensity ?? 0.8)}
                </span>
              </Tooltip>
            </>
          )}
          {...compactStaticRowProps}
        />
        <KeyTypeValueStaticRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Dimmed Node Opacity</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={Number(schema.three?.selection?.dimmedNodeOpacity ?? 0.2)}
                onChange={e =>
                  setThreeConfig({
                    selection: { dimmedNodeOpacity: Number(e.target.value) },
                  })
                }
              />
              <Tooltip
                content={DIMMED_NODE_OPACITY_TOOLTIP}
                maxWidthPx={260}

              >
                <span className={valueTextClassName}>
                  {String(schema.three?.selection?.dimmedNodeOpacity ?? 0.2)}
                </span>
              </Tooltip>
            </>
          )}
          {...compactStaticRowProps}
        />
        <KeyTypeValueStaticRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Dimmed Edge Opacity</span>}
          valueNode={(
            <>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={Number(schema.three?.selection?.dimmedEdgeOpacity ?? 0.2)}
                onChange={e =>
                  setThreeConfig({
                    selection: { dimmedEdgeOpacity: Number(e.target.value) },
                  })
                }
              />
              <Tooltip
                content={DIMMED_EDGE_OPACITY_TOOLTIP}
                maxWidthPx={260}

              >
                <span className={valueTextClassName}>
                  {String(schema.three?.selection?.dimmedEdgeOpacity ?? 0.2)}
                </span>
              </Tooltip>
            </>
          )}
          {...compactStaticRowProps}
        />
      </section>
    </CollapsibleSection>
  )
}
