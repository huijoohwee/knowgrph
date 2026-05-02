import {
  applyWidgetCompactPreviewTextUpdate,
  buildWidgetCompactPreviewViewModel,
  resolveWidgetCompactPreview,
} from '@/features/flow-editor-manager/widgetCompactPreview'
import type { FlowConnectedValuesBySchemaPath } from '@/lib/flowEditor/flowDataflow'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'

const BASE_REGISTRY_ENTRY: WidgetRegistryEntry = {
  id: 'text-default',
  isEnabled: true,
  nodeTypeId: 'TextGeneration',
  widgetTypeId: 'textGeneration',
  formId: 'textGeneration',
  fields: [
    { fieldKey: 'output', fieldType: 'text', schemaPath: 'properties.output' },
    { fieldKey: 'outputSrcDoc', fieldType: 'html', schemaPath: 'properties.outputSrcDoc' },
  ],
  ports: [
    { portKey: 'output', direction: 'output', schemaPath: 'properties.output' },
    { portKey: 'outputSrcDoc', direction: 'output', schemaPath: 'properties.outputSrcDoc' },
  ],
  updatedAt: '2026-05-02T00:00:00.000Z',
}

const OPENAI_REGISTRY_ENTRY: WidgetRegistryEntry = {
  ...BASE_REGISTRY_ENTRY,
  id: 'text-openai',
  widgetTypeId: 'textGeneration.openai',
  formId: 'textGeneration.openai',
}

export function testResolveWidgetCompactPreviewSkipsBytePlusTextWidgets() {
  const preview = resolveWidgetCompactPreview({
    node: {
      id: 'text-byteplus',
      type: 'TextGeneration',
      properties: {
        chatProvider: 'byteplus-modelark',
        'flow:widgetTypeId': 'textGeneration',
        'flow:widgetFormId': 'textGeneration',
        output: 'Should stay hidden',
      },
    } as never,
    registryEntry: BASE_REGISTRY_ENTRY,
  })

  if (preview !== null) {
    throw new Error('expected compact preview helper to suppress BytePlus text widget previews')
  }
}

export function testResolveWidgetCompactPreviewPrefersConnectedValuesOverLocalFallback() {
  const connectedValuesBySchemaPath: FlowConnectedValuesBySchemaPath = {
    'properties.output': {
      value: 'Connected output wins',
      sources: [{ edgeId: 'edge-1', nodeId: 'source-node', portKey: 'output' }],
    },
  }
  const preview = resolveWidgetCompactPreview({
    node: {
      id: 'text-openai',
      type: 'TextGeneration',
      properties: {
        chatProvider: 'openai',
        'flow:widgetTypeId': 'textGeneration.openai',
        'flow:widgetFormId': 'textGeneration.openai',
        output: 'Local fallback',
      },
    } as never,
    registryEntry: OPENAI_REGISTRY_ENTRY,
    connectedValuesBySchemaPath,
  })

  if (!preview || preview.kind !== 'text') {
    throw new Error('expected compact preview helper to resolve a text preview')
  }
  if (preview.source !== 'connected' || preview.text !== 'Connected output wins') {
    throw new Error(`expected connected value preview to win, got ${JSON.stringify(preview)}`)
  }
}

export function testResolveWidgetCompactPreviewMarksOutputSrcDocAsReadOnly() {
  const preview = resolveWidgetCompactPreview({
    node: {
      id: 'text-html',
      type: 'TextGeneration',
      properties: {
        chatProvider: 'openai',
        'flow:widgetTypeId': 'textGeneration.openai',
        'flow:widgetFormId': 'textGeneration.openai',
        outputSrcDoc: '<html><body>Preview</body></html>',
      },
    } as never,
    registryEntry: OPENAI_REGISTRY_ENTRY,
  })

  if (!preview || preview.kind !== 'text') {
    throw new Error('expected compact preview helper to resolve text preview from outputSrcDoc')
  }
  if (preview.schemaPath !== 'properties.outputSrcDoc') {
    throw new Error(`expected outputSrcDoc schema path, got ${String(preview.schemaPath || '')}`)
  }
  if (preview.editable !== false) {
    throw new Error('expected outputSrcDoc compact preview to remain read-only')
  }
}

export function testApplyWidgetCompactPreviewTextUpdatePreservesRawTextAndClearsEmptyString() {
  const nextProperties = applyWidgetCompactPreviewTextUpdate({
    preview: {
      kind: 'text',
      schemaPath: 'properties.output',
      portKey: 'output',
      source: 'local',
      editable: true,
      text: 'before',
    },
    properties: { output: 'before' },
    nextText: '  keep spacing  ',
  })
  if (!nextProperties || nextProperties.output !== '  keep spacing  ') {
    throw new Error(`expected compact preview writeback to preserve raw text, got ${JSON.stringify(nextProperties)}`)
  }

  const clearedProperties = applyWidgetCompactPreviewTextUpdate({
    preview: {
      kind: 'text',
      schemaPath: 'properties.output',
      portKey: 'output',
      source: 'local',
      editable: true,
      text: 'before',
    },
    properties: { output: 'before' },
    nextText: '',
  })
  if (!clearedProperties || Object.prototype.hasOwnProperty.call(clearedProperties, 'output')) {
    throw new Error(`expected compact preview writeback to clear empty strings, got ${JSON.stringify(clearedProperties)}`)
  }
}

export function testApplyWidgetCompactPreviewTextUpdateSkipsReadOnlyPreview() {
  const nextProperties = applyWidgetCompactPreviewTextUpdate({
    preview: {
      kind: 'text',
      schemaPath: 'properties.outputSrcDoc',
      portKey: 'outputSrcDoc',
      source: 'local',
      editable: false,
      text: '<html></html>',
    },
    properties: { outputSrcDoc: '<html></html>' },
    nextText: '<html><body>changed</body></html>',
  })
  if (nextProperties !== null) {
    throw new Error('expected compact preview writeback helper to ignore read-only previews')
  }
}

export function testBuildWidgetCompactPreviewViewModelProvidesSharedTextAndImagePresentationState() {
  const textView = buildWidgetCompactPreviewViewModel({
    preview: {
      kind: 'text',
      schemaPath: 'properties.outputSrcDoc',
      portKey: 'outputSrcDoc',
      source: 'local',
      editable: false,
      text: '<html><body>Preview</body></html>',
    },
    node: { id: 'node-a', label: 'Preview Widget' } as never,
  })
  if (!textView || textView.kind !== 'text') {
    throw new Error('expected compact preview view-model helper to preserve text previews')
  }
  if (textView.sectionAriaLabel !== 'Widget output preview' || textView.textAriaLabel !== 'Widget text output preview') {
    throw new Error(`expected shared text preview labels, got ${JSON.stringify(textView)}`)
  }
  if (textView.readOnly !== true) {
    throw new Error('expected view-model helper to expose readOnly state for non-editable text previews')
  }

  const imageView = buildWidgetCompactPreviewViewModel({
    preview: {
      kind: 'image',
      schemaPath: 'properties.imageUrl',
      portKey: 'imageUrl',
      source: 'local',
      editable: false,
      url: 'https://example.com/image.png',
    },
    node: { id: 'node-b', label: '' } as never,
  })
  if (!imageView || imageView.kind !== 'image') {
    throw new Error('expected compact preview view-model helper to preserve image previews')
  }
  if (imageView.mediaAlt !== 'node-b') {
    throw new Error(`expected image preview alt text to fall back to node id, got ${JSON.stringify(imageView)}`)
  }
}
