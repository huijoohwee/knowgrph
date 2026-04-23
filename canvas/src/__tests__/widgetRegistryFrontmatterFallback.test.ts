import type { GraphData } from '@/lib/graph/types'
import { FLOW_WIDGET_REGISTRY_METADATA_KEY } from '@/lib/config'
import { applyWidgetRegistryFromMetadata } from '@/hooks/store/graphDataSliceUtils'

type StubStore = {
  documentWidgetRegistry: unknown[]
  setDocumentWidgetRegistry: (entries: unknown[]) => void
}

export function testWidgetRegistryFrontmatterFallbackKeepsNodeTypeMatchesWhenFormIdsDiffer() {
  const graph: GraphData = {
    type: 'Graph',
    context: 'frontmatter-flow',
    nodes: [
      {
        id: 'panel-1',
        type: 'RichMediaPanel',
        label: 'Panel',
        properties: {
          'flow:portTypes': {
            in: [{ portKey: 'imageUrl' }],
            out: [],
          },
        },
      },
    ],
    edges: [],
    metadata: {
      kind: 'frontmatter-flow',
      [FLOW_WIDGET_REGISTRY_METADATA_KEY]: [
        {
          id: 'qer-RichMediaPanel-default-richMediaPanel',
          isEnabled: true,
          nodeTypeId: 'RichMediaPanel',
          widgetTypeId: 'default',
          formId: 'richMediaPanel',
          fields: [],
          ports: [{ portKey: 'imageUrl', direction: 'input', schemaPath: 'properties.imageUrl' }],
          updatedAt: '2026-04-22T00:00:00.000Z',
        },
      ],
    },
  }

  let applied: unknown[] | null = null
  const stub: StubStore = {
    documentWidgetRegistry: [],
    setDocumentWidgetRegistry: entries => {
      applied = entries
    },
  }

  const get = (() => stub) as unknown as Parameters<typeof applyWidgetRegistryFromMetadata>[0]
  applyWidgetRegistryFromMetadata(get, graph.metadata, graph)

  if (!Array.isArray(applied) || applied.length !== 1) {
    throw new Error(`expected node-type fallback to retain RichMediaPanel registry, got ${Array.isArray(applied) ? applied.length : 'null'}`)
  }
}
