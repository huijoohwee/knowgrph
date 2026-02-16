import { buildFlowEditorCameraInitKey } from '@/lib/canvas/flow-editor-init-key'

export function testFlowEditorCameraInitKeyUsesDatasetKeyWhenStable() {
  const key = buildFlowEditorCameraInitKey({ datasetKey: 'path:demo.md', graphData: null })
  if (key !== 'flowEditor:path:demo.md') throw new Error(`unexpected key: ${key}`)
}

export function testFlowEditorCameraInitKeyHashesWhenRev() {
  const g1 = {
    type: 'Graph',
    nodes: [{ id: 'a', type: 'X' }],
    edges: [],
    metadata: { kind: 'k', source: 's' },
  } as never
  const g2 = {
    type: 'Graph',
    nodes: [{ id: 'b', type: 'X' }],
    edges: [],
    metadata: { kind: 'k', source: 's' },
  } as never

  const k1 = buildFlowEditorCameraInitKey({ datasetKey: 'rev:1', graphData: g1 })
  const k2 = buildFlowEditorCameraInitKey({ datasetKey: 'rev:2', graphData: g2 })

  if (!k1.startsWith('flowEditor:hash:')) throw new Error(`expected hash key, got ${k1}`)
  if (!k2.startsWith('flowEditor:hash:')) throw new Error(`expected hash key, got ${k2}`)
  if (k1 === k2) throw new Error('expected different graphs to produce different init keys')
}

