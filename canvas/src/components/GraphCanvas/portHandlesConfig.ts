import type { GraphSchema } from '@/lib/graph/schema'
import { getThreeSelectionConfig } from '@/lib/graph/schema'
import { UI_THEME_COLORS_CSS } from '@/lib/ui/theme-tokens'

export type PortHandlesConfig = {
  enabled: boolean
  placement: 'cardinal'
  size: number
  offset: number
  strokeWidth: number
  stroke: string
  fill: string
}

export function getPortHandlesConfig(schema: GraphSchema): PortHandlesConfig {
  const raw = schema.behavior?.portHandles || {}
  const enabled = Boolean(raw.enabled)
  const placement = raw.placement === 'cardinal' ? 'cardinal' : 'cardinal'
  const size = typeof raw.size === 'number' && Number.isFinite(raw.size) && raw.size > 0 ? raw.size : 4
  const offset = typeof raw.offset === 'number' && Number.isFinite(raw.offset) && raw.offset >= 0 ? raw.offset : 2
  const strokeWidth =
    typeof raw.strokeWidth === 'number' && Number.isFinite(raw.strokeWidth) && raw.strokeWidth >= 0 ? raw.strokeWidth : 1.5
  const stroke = getThreeSelectionConfig(schema).selectedEdgeColor
  const fill = UI_THEME_COLORS_CSS.bg
  return { enabled, placement, size, offset, strokeWidth, stroke, fill }
}

