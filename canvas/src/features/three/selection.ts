import type { GraphSchema } from '@/lib/graph/schema'
import { getThreeConfig, getRendererPalette, MVP_COLOR_PALETTE } from '@/lib/graph/schema'

export type NodeSelectionMode = 'none' | 'node' | 'edge'

export type NodeSelectionState = {
  mode: NodeSelectionMode
  isSelected: boolean
  isNeighbor: boolean
  isEdgeEndpoint: boolean
}

export type SelectionVisuals = {
  selectedNodeGlowIntensity: number;
  dimmedNodeOpacity: number;
  dimmedEdgeOpacity: number;
  selectedEdgeWidth: number;
  selectedEdgeColor: string;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

export function getSelectionVisuals(schema: GraphSchema): SelectionVisuals {
  const threeCfg = getThreeConfig(schema)
  const raw = (threeCfg.selection || {}) as {
    selectedNodeGlowIntensity?: number;
    dimmedNodeOpacity?: number;
    dimmedEdgeOpacity?: number;
    selectedEdgeWidth?: number;
    selectedEdgeColor?: string;
  }
  const glow = typeof raw.selectedNodeGlowIntensity === 'number' ? clamp(raw.selectedNodeGlowIntensity, 0, 5) : 0.8
  const dimNode = typeof raw.dimmedNodeOpacity === 'number' ? clamp(raw.dimmedNodeOpacity, 0, 1) : 0.2
  const dimEdge = typeof raw.dimmedEdgeOpacity === 'number' ? clamp(raw.dimmedEdgeOpacity, 0, 1) : 0.2
  const width = typeof raw.selectedEdgeWidth === 'number' ? clamp(raw.selectedEdgeWidth, 1, 6) : 3
  const palette = getRendererPalette(schema)
  const defaultEdgeColor = typeof palette.nodes.idea === 'string' && palette.nodes.idea.trim()
    ? palette.nodes.idea
    : MVP_COLOR_PALETTE.nodes.idea
  const edgeColor = typeof raw.selectedEdgeColor === 'string' && raw.selectedEdgeColor.trim().length > 0
    ? raw.selectedEdgeColor
    : defaultEdgeColor
  return {
    selectedNodeGlowIntensity: glow,
    dimmedNodeOpacity: dimNode,
    dimmedEdgeOpacity: dimEdge,
    selectedEdgeWidth: width,
    selectedEdgeColor: edgeColor,
  }
}
