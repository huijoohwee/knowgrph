import { defaultSchema, type GraphSchema } from '@/lib/graph/schema'
import { useGraphStore } from '@/hooks/useGraphStore'

export const testTidyTreeSeparationSchemaRoundTrip = () => {
  const store = useGraphStore.getState()
  store.resetAll()

  const baseSchema: GraphSchema = {
    ...defaultSchema,
    layout: {
      ...defaultSchema.layout,
      mode: 'tidy-tree',
      tidyTree: {
        ...(defaultSchema.layout?.tidyTree || {}),
        separation: 1.3,
      },
    },
  }

  store.setSchema(baseSchema)

  const current = useGraphStore.getState().schema
  const separation = current.layout?.tidyTree?.separation

  if (separation !== 1.3) {
    throw new Error(`expected layout.tidyTree.separation to round trip as 1.3, got ${String(separation)}`)
  }
}

