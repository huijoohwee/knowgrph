import type { GraphSchema } from '@/lib/graph/schema'

export type TreePresetKind = 'mermaid' | 'document'

export function computeNextSchemaForTreePreset(
  current: GraphSchema,
  nextPreset: TreePresetKind,
  treeDocEdgeLabelsInput: string[],
): GraphSchema {
  const layout = current.layout || {}
  const mode: 'force' | 'radial' | 'tree' = layout.mode || 'force'
  const nextMode: 'force' | 'radial' | 'tree' = mode === 'tree' ? 'tree' : 'tree'
  const baseLayout = { ...layout, mode: nextMode }
  const currentTree = baseLayout.tree || {}
  const treeMeta = (current.metadata as Record<string, unknown> | undefined)?.tree as
    | {
        edgeLabels?: unknown
        separation?: unknown
        orientation?: unknown
        direction?: unknown
      }
    | undefined
  const mermaidMetaEdgeLabels =
    treeMeta && Array.isArray(treeMeta.edgeLabels)
      ? treeMeta.edgeLabels
          .map(v => String(v || '').trim())
          .filter(Boolean)
      : null
  const mermaidMetaSeparation =
    treeMeta && typeof treeMeta.separation === 'number' && Number.isFinite(treeMeta.separation) && treeMeta.separation > 0
      ? treeMeta.separation
      : null
  const mermaidMetaOrientation = (() => {
    if (!treeMeta) return null
    const raw = treeMeta.orientation
    return raw === 'vertical' || raw === 'horizontal' ? raw : null
  })()
  const mermaidMetaDirection = (() => {
    if (!treeMeta) return null
    const raw = treeMeta.direction
    return raw === 'source-target' || raw === 'target-source' ? raw : null
  })()
  const mermaidDirection: 'auto' | 'source-target' | 'target-source' =
    currentTree.direction === 'source-target' || currentTree.direction === 'target-source'
      ? currentTree.direction
      : mermaidMetaDirection != null
        ? mermaidMetaDirection
        : 'auto'
  const docDirection: 'auto' | 'source-target' | 'target-source' =
    currentTree.direction === 'source-target' || currentTree.direction === 'target-source'
      ? currentTree.direction
      : 'auto'
  const mermaidColorMode: 'schema' | 'observable' =
    currentTree.colorMode === 'schema'
      ? 'schema'
      : currentTree.colorMode === 'observable'
        ? 'observable'
        : 'observable'
  const docColorMode: 'schema' | 'observable' =
    currentTree.colorMode === 'observable'
      ? 'observable'
      : 'schema'
  const nextTree =
    nextPreset === 'mermaid'
      ? {
          ...currentTree,
          edgeLabels:
            mermaidMetaEdgeLabels && mermaidMetaEdgeLabels.length > 0
              ? mermaidMetaEdgeLabels
              : ['pointsTo'],
          orientation:
            (currentTree.orientation === 'vertical' || currentTree.orientation === 'horizontal'
              ? currentTree.orientation
              : mermaidMetaOrientation || ('horizontal' as const)),
          separation:
            typeof currentTree.separation === 'number' &&
            Number.isFinite(currentTree.separation) &&
            currentTree.separation > 0
              ? currentTree.separation
              : mermaidMetaSeparation != null
                ? mermaidMetaSeparation
                : 1.5,
          direction: mermaidDirection,
          colorMode: mermaidColorMode,
        }
      : {
          ...currentTree,
          edgeLabels: treeDocEdgeLabelsInput.slice(),
          orientation:
            currentTree.orientation === 'vertical' || currentTree.orientation === 'horizontal'
              ? currentTree.orientation
              : ('vertical' as const),
          separation:
            typeof currentTree.separation === 'number' &&
            Number.isFinite(currentTree.separation) &&
            currentTree.separation > 0
              ? currentTree.separation
              : 1,
          direction: docDirection,
          colorMode: docColorMode,
        }
  const nextSchema: GraphSchema = {
    ...current,
    layout: {
      ...baseLayout,
      tree: nextTree,
    },
  }
  return nextSchema
}
