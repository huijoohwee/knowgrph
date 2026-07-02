import {
  applyWidgetFieldValueUpdate,
  coerceWidgetFieldValue,
  normalizeWidgetFieldSchemaPath,
} from '@/features/storyboard-widget-manager/widgetFieldMutation'

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

  const nextUnscopedProperties = applyWidgetFieldValueUpdate({
    properties: { monthly_active_users: 2500 },
    schemaPath: 'monthly_active_users',
    nextValue: 9999,
  })
  if (nextUnscopedProperties.monthly_active_users !== 9999 || Object.prototype.hasOwnProperty.call(nextUnscopedProperties, 'properties')) {
    throw new Error(`expected unscoped widget field update to patch root properties, got ${JSON.stringify(nextUnscopedProperties)}`)
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
