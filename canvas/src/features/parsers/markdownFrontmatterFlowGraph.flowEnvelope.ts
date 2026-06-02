function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function unwrapFlowEnvelopeFieldValue(args: {
  raw: unknown
  path: string
  expectedKey?: string
  warnings: string[]
}): unknown {
  const { raw, path, expectedKey, warnings } = args
  if (!isRecord(raw)) return raw
  const record = raw as Record<string, unknown>
  const hasKey = Object.prototype.hasOwnProperty.call(record, 'key')
  const hasType = Object.prototype.hasOwnProperty.call(record, 'type')
  const hasValue = Object.prototype.hasOwnProperty.call(record, 'value')
  const keys = Object.keys(record)
  const hasOnlyEnvelopeKeys = keys.every(k => k === 'key' || k === 'type' || k === 'value')
  const looksLikeEnvelope = hasKey || hasType || (hasValue && hasOnlyEnvelopeKeys)
  if (!looksLikeEnvelope) return raw
  if (!hasOnlyEnvelopeKeys || !hasKey || !hasType || !hasValue) {
    warnings.push(`Flow typed envelope malformed at ${path}: expected exact { key, type, value } wrapper`)
    return raw
  }
  const keyValue = record.key
  if (typeof keyValue !== 'string' || !keyValue.trim()) {
    warnings.push(`Flow typed envelope malformed at ${path}: wrapper key must be a non-empty string`)
    return raw
  }
  if (expectedKey && keyValue !== expectedKey) {
    warnings.push(`Flow typed envelope malformed at ${path}: expected key "${expectedKey}" but found "${keyValue}"`)
    return raw
  }
  const typeValue = record.type
  if (typeof typeValue !== 'string' || !typeValue.trim()) {
    warnings.push(`Flow typed envelope malformed at ${path}: wrapper type must be a non-empty string`)
    return raw
  }
  return record.value
}

export function normalizeFlowEnvelopeRecord(args: {
  rawRecord: Record<string, unknown>
  recordPath: string
  warnings: string[]
}): Record<string, unknown> {
  const { rawRecord, recordPath, warnings } = args
  return Object.fromEntries(Object.entries(rawRecord).map(([key, value]) => [
    key,
    unwrapFlowEnvelopeFieldValue({ raw: value, path: `${recordPath}.${key}`, expectedKey: key, warnings }),
  ]))
}
