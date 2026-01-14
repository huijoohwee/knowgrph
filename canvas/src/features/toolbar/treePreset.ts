import type { GraphSchema } from '@/lib/graph/schema'
import { deriveTreeDerivation } from '@/components/GraphCanvas/layout/treeHelpers'
import { normalizeEdgesForSim } from '@/components/GraphCanvas/simulation'
import type { GraphData } from '@/lib/graph/types'

export function computeNextSchemaForTreePreset(
  currentSchema: GraphSchema,
  graphData: GraphData | null
): GraphSchema {
  const layout = currentSchema.layout || {}
  const nextMode: NonNullable<NonNullable<GraphSchema['layout']>['mode']> =
    layout.mode === 'tree' ? 'force' : 'tree'
  const baseNext = {
    ...currentSchema,
    layout: { ...layout, mode: nextMode },
  } as GraphSchema

  if (nextMode !== 'tree') return baseNext

  const treeCfg = baseNext.layout?.tree
  const rawEdgeLabels = treeCfg?.edgeLabels
  const configuredLabels = Array.isArray(rawEdgeLabels)
    ? rawEdgeLabels.map((v: string) => String(v || '').trim()).filter(Boolean)
    : []
  const shouldResolveLabels = configuredLabels.length === 0
  const shouldResolveDirection = !treeCfg?.direction || treeCfg.direction === 'auto'
  if (!shouldResolveLabels && !shouldResolveDirection) return baseNext

  try {
    const nodes = graphData?.nodes || []
    const edges = graphData?.edges || []
    if (!nodes.length) return baseNext

    const edgesForSim = normalizeEdgesForSim(nodes, edges)
    const nodeIds = new Set<string>(nodes.map(n => String(n.id)))
    const derivation = deriveTreeDerivation(edgesForSim, baseNext, nodeIds)
    if (!derivation) return baseNext

    const nextTree = { ...(treeCfg || {}) }
    let changed = false

    if (shouldResolveLabels && derivation.labelSet.size > 0) {
      nextTree.edgeLabels = Array.from(derivation.labelSet).sort((a, b) => a.localeCompare(b))
      changed = true
    }
    if (shouldResolveDirection) {
      nextTree.direction = derivation.direction
      changed = true
    }
    if (!changed) return baseNext

    return {
      ...baseNext,
      layout: { ...(baseNext.layout || {}), tree: nextTree },
    } as GraphSchema
  } catch {
    return baseNext
  }
}
