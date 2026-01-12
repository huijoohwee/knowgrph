import type { GraphSchema } from '@/lib/graph/schema'

export type TidyPresetKind = 'mermaid' | 'document'

export function computeNextSchemaForTidyPreset(
  current: GraphSchema,
  nextPreset: TidyPresetKind,
  tidyDocEdgeLabelsInput: string[],
): GraphSchema {
  const layout = current.layout || {}
  const mode: 'force' | 'radial' | 'tidy-tree' = layout.mode || 'force'
  const nextMode: 'force' | 'radial' | 'tidy-tree' = mode === 'tidy-tree' ? 'tidy-tree' : 'tidy-tree'
  const baseLayout = { ...layout, mode: nextMode }
  const currentTidy = baseLayout.tidyTree || {}
  const tidyMeta = (current.metadata as Record<string, unknown> | undefined)?.tidyTree as
    | {
        edgeLabels?: unknown
        separation?: unknown
        orientation?: unknown
        direction?: unknown
      }
    | undefined
  const mermaidMetaEdgeLabels =
    tidyMeta && Array.isArray(tidyMeta.edgeLabels)
      ? tidyMeta.edgeLabels
          .map(v => String(v || '').trim())
          .filter(Boolean)
      : null
  const mermaidMetaSeparation =
    tidyMeta && typeof tidyMeta.separation === 'number' && Number.isFinite(tidyMeta.separation) && tidyMeta.separation > 0
      ? tidyMeta.separation
      : null
  const mermaidMetaOrientation = (() => {
    if (!tidyMeta) return null
    const raw = tidyMeta.orientation
    return raw === 'vertical' || raw === 'horizontal' ? raw : null
  })()
  const mermaidMetaDirection = (() => {
    if (!tidyMeta) return null
    const raw = tidyMeta.direction
    return raw === 'source-target' || raw === 'target-source' ? raw : null
  })()
  const mermaidDirection: 'auto' | 'source-target' | 'target-source' =
    currentTidy.direction === 'source-target' || currentTidy.direction === 'target-source'
      ? currentTidy.direction
      : mermaidMetaDirection != null
        ? mermaidMetaDirection
        : 'auto'
  const docDirection: 'auto' | 'source-target' | 'target-source' =
    currentTidy.direction === 'source-target' || currentTidy.direction === 'target-source'
      ? currentTidy.direction
      : 'auto'
  const mermaidColorMode: 'schema' | 'observable' =
    currentTidy.colorMode === 'schema'
      ? 'schema'
      : currentTidy.colorMode === 'observable'
        ? 'observable'
        : 'observable'
  const docColorMode: 'schema' | 'observable' =
    currentTidy.colorMode === 'observable'
      ? 'observable'
      : 'schema'
  const nextTidy =
    nextPreset === 'mermaid'
      ? {
          ...currentTidy,
          edgeLabels:
            mermaidMetaEdgeLabels && mermaidMetaEdgeLabels.length > 0
              ? mermaidMetaEdgeLabels
              : ['pointsTo'],
          orientation:
            (currentTidy.orientation === 'vertical' || currentTidy.orientation === 'horizontal'
              ? currentTidy.orientation
              : mermaidMetaOrientation || ('horizontal' as const)),
          separation:
            typeof currentTidy.separation === 'number' &&
            Number.isFinite(currentTidy.separation) &&
            currentTidy.separation > 0
              ? currentTidy.separation
              : mermaidMetaSeparation != null
                ? mermaidMetaSeparation
                : 1.5,
          direction: mermaidDirection,
          colorMode: mermaidColorMode,
        }
      : {
          ...currentTidy,
          edgeLabels: tidyDocEdgeLabelsInput.slice(),
          orientation:
            currentTidy.orientation === 'vertical' || currentTidy.orientation === 'horizontal'
              ? currentTidy.orientation
              : ('vertical' as const),
          separation:
            typeof currentTidy.separation === 'number' &&
            Number.isFinite(currentTidy.separation) &&
            currentTidy.separation > 0
              ? currentTidy.separation
              : 1,
          direction: docDirection,
          colorMode: docColorMode,
        }
  const nextSchema: GraphSchema = {
    ...current,
    layout: {
      ...baseLayout,
      tidyTree: nextTidy,
    },
  }
  return nextSchema
}

