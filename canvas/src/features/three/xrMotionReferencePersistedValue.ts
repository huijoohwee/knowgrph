import { XR_MOTION_REFERENCE_GRAPH_METADATA_KEY } from './xrMotionReferenceModel'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

export function resolveXrMotionReferencePersistedValue(metadataValue: unknown): unknown {
  const metadata = asRecord(metadataValue)
  if (!metadata) return undefined
  const persistedValue = metadata[XR_MOTION_REFERENCE_GRAPH_METADATA_KEY]
  if (persistedValue !== undefined) return persistedValue
  return asRecord(metadata.frontmatterMeta)?.[XR_MOTION_REFERENCE_GRAPH_METADATA_KEY]
}
