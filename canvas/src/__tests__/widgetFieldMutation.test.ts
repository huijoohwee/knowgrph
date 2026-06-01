import {
  applyConnectedWidgetFieldsToEmptyValues,
  applyWidgetFieldValueUpdate,
  coerceWidgetFieldValue,
  normalizeWidgetFieldSchemaPath,
} from '@/features/flow-editor-manager/widgetFieldMutation'

export function testNormalizeWidgetFieldSchemaPathAndApplyWidgetFieldValueUpdate() {
  if (normalizeWidgetFieldSchemaPath('prompt', 'fallback') !== 'properties.prompt') {
    throw new Error('expected widget field schema helper to prefix unscoped property paths')
  }
  if (normalizeWidgetFieldSchemaPath('metadata.provider', 'fallback') !== 'metadata.provider') {
    throw new Error('expected widget field schema helper to preserve metadata paths')
  }

  const nextProperties = applyWidgetFieldValueUpdate({
    properties: { prompt: 'before' },
    schemaPath: 'properties.prompt',
    nextValue: 'after',
  })
  if (nextProperties.prompt !== 'after') {
    throw new Error(`expected widget field update helper to patch root properties, got ${JSON.stringify(nextProperties)}`)
  }
}

export function testApplyConnectedWidgetFieldsToEmptyValuesCoercesAndSkipsFilledFields() {
  const nextProperties = applyConnectedWidgetFieldsToEmptyValues({
    properties: {
      prompt: '',
      topP: 0.7,
    },
    fields: [
      { fieldKey: 'prompt', fieldType: 'text', schemaPath: 'properties.prompt' },
      { fieldKey: 'topP', fieldType: 'number', schemaPath: 'properties.topP' },
      { fieldKey: 'temperature', fieldType: 'number', schemaPath: 'properties.temperature' },
    ],
    connectedValuesBySchemaPath: {
      'properties.prompt': { value: 'connected prompt', sources: [] },
      'properties.topP': { value: '0.9', sources: [] },
      'properties.temperature': { value: '0.25', sources: [] },
    },
  })

  if (!nextProperties) {
    throw new Error('expected widget field autofill helper to patch empty connected fields')
  }
  if (nextProperties.prompt !== 'connected prompt') {
    throw new Error(`expected empty prompt to be autofilled, got ${JSON.stringify(nextProperties)}`)
  }
  if (nextProperties.topP !== 0.7) {
    throw new Error(`expected filled numeric field to remain unchanged, got ${JSON.stringify(nextProperties)}`)
  }
  if (nextProperties.temperature !== 0.25) {
    throw new Error(`expected numeric connected values to be coerced, got ${JSON.stringify(nextProperties)}`)
  }
  if (coerceWidgetFieldValue({ fieldType: 'number', value: '3.5' }) !== 3.5) {
    throw new Error('expected widget field coercion helper to parse numeric strings')
  }
}

export function testCoerceWidgetFieldValuePreservesTypedFrontmatterEnvelopeValues() {
  if (coerceWidgetFieldValue({ fieldType: 'boolean', value: 'false' }) !== false) {
    throw new Error('expected boolean string false to remain false')
  }
  if (coerceWidgetFieldValue({ fieldType: 'boolean', value: 'true' }) !== true) {
    throw new Error('expected boolean string true to remain true')
  }
  const arrayValue = coerceWidgetFieldValue({ fieldType: 'array', value: '["producer","AI"]' })
  if (!Array.isArray(arrayValue) || arrayValue.join('|') !== 'producer|AI') {
    throw new Error(`expected typed array field to parse JSON array, got ${JSON.stringify(arrayValue)}`)
  }
  const objectValue = coerceWidgetFieldValue({ fieldType: 'object', value: '{"target":["output"],"source":["outputSrcDoc"]}' })
  if (!objectValue || typeof objectValue !== 'object' || Array.isArray(objectValue)) {
    throw new Error(`expected typed object field to parse JSON object, got ${JSON.stringify(objectValue)}`)
  }
  const handles = objectValue as { target?: unknown; source?: unknown }
  if (!Array.isArray(handles.target) || handles.target[0] !== 'output') {
    throw new Error(`expected parsed object field to preserve target handle array, got ${JSON.stringify(objectValue)}`)
  }
  if (typeof coerceWidgetFieldValue({ fieldType: 'object', value: 'not-json' }) !== 'undefined') {
    throw new Error('expected invalid object text to be rejected instead of replacing a typed frontmatter object')
  }
}
