import React from 'react'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import { KeyTypeValueRow } from '@/features/panels/ui/KeyTypeValueRow'
import Tooltip from '@/features/panels/ui/Tooltip'
import type { GraphSchema } from '@/lib/graph/schema'
import {
  SELECTED_NODE_GLOW_TOOLTIP,
  DIMMED_NODE_OPACITY_TOOLTIP,
  DIMMED_EDGE_OPACITY_TOOLTIP,
} from '@/features/panels/views/ThreeViewTuningTooltips'

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
  return (
    <CollapsibleSection
      title="Selection highlighting"
      collapsed={collapsed}
      onToggle={onToggle}
      headerClassName="px-0"
      stickyOffsetClassName="top-6"
    >
      <div className="grid grid-cols-2 gap-3">
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className="text-gray-700">Selected Node Glow</span>}
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
                contentClassName="bg-gray-800/90"
              >
                <span className="text-gray-600">
                  {String(schema.three?.selection?.selectedNodeGlowIntensity ?? 0.8)}
                </span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className="text-gray-700">Dimmed Node Opacity</span>}
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
                contentClassName="bg-gray-800/90"
              >
                <span className="text-gray-600">
                  {String(schema.three?.selection?.dimmedNodeOpacity ?? 0.2)}
                </span>
              </Tooltip>
            </>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className="text-gray-700">Dimmed Edge Opacity</span>}
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
                contentClassName="bg-gray-800/90"
              >
                <span className="text-gray-600">
                  {String(schema.three?.selection?.dimmedEdgeOpacity ?? 0.2)}
                </span>
              </Tooltip>
            </>
          )}
        />
      </div>
    </CollapsibleSection>
  )
}

