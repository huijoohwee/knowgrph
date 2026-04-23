import { resolveWidgetRegistryEntry, FLOW_WIDGET_FORM_ID_KEY, FLOW_WIDGET_TYPE_ID_KEY } from '@/features/flow-editor-manager/resolveWidgetRegistry'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'

export function testResolveWidgetRegistryEntryPrefersRicherMatchingEntry() {
  const registry: WidgetRegistryEntry[] = [
    {
      id: 'text-openai-incomplete',
      isEnabled: true,
      nodeTypeId: 'TextGeneration',
      widgetTypeId: 'default',
      formId: 'textGeneration.openai',
      fields: [],
      ports: [],
      schemaMappings: [],
      updatedAt: '2026-04-24T10:00:00.000Z',
    },
    {
      id: 'text-openai-rich',
      isEnabled: true,
      nodeTypeId: 'TextGeneration',
      widgetTypeId: 'default',
      formId: 'textGeneration.openai',
      fields: [
        { fieldKey: 'prompt', fieldType: 'textarea', schemaPath: 'properties.prompt' },
      ],
      ports: [
        { portKey: 'prompt_in', direction: 'input', schemaPath: 'properties.prompt' },
        { portKey: 'text_out', direction: 'output', schemaPath: 'properties.output' },
      ],
      schemaMappings: [],
      updatedAt: '2026-04-24T09:00:00.000Z',
    },
  ]

  const resolved = resolveWidgetRegistryEntry({
    node: {
      id: 'w-openai-text',
      type: 'TextGeneration',
      properties: {
        [FLOW_WIDGET_TYPE_ID_KEY]: 'default',
        [FLOW_WIDGET_FORM_ID_KEY]: 'textGeneration.openai',
      },
    },
    registry,
    graphMetaKind: 'frontmatter-flow',
  })

  if (!resolved) throw new Error('expected resolveWidgetRegistryEntry to return a matching entry')
  if (resolved.id !== 'text-openai-rich') {
    throw new Error(`expected richer matching entry to win over newer incomplete entry, got ${String(resolved.id || '')}`)
  }
}
