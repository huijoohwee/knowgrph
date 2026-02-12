import { hashGraphDataForPreviewSync } from '@/hooks/store/graphDataSliceUtils'

export function testPreviewSyncHashIgnoresRevisionAndHash() {
  const base = {
    metadata: {
      kind: 'test',
      source: 'local',
    },
    nodes: [{ id: 'a', label: 'a', type: 'T', properties: {} }],
    edges: [{ id: 'e', source: 'a', target: 'a', label: 'e', properties: {} }],
  }

  const a = {
    ...base,
    metadata: {
      ...(base.metadata as Record<string, unknown>),
      graphDataRevision: 1,
      hash: 'rev:1',
    },
  }
  const b = {
    ...base,
    metadata: {
      ...(base.metadata as Record<string, unknown>),
      graphDataRevision: 999,
      hash: 'rev:999',
    },
  }

  const ha = hashGraphDataForPreviewSync(a)
  const hb = hashGraphDataForPreviewSync(b)
  if (!ha || !hb) throw new Error('expected preview hash to be non-empty')
  if (ha !== hb) throw new Error('expected preview hash to ignore revision/hash metadata')
}

