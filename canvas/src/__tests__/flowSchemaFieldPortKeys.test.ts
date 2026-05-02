import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { computeFlowHandlesByNode } from '@/components/FlowCanvas/handles'
import { pickDefaultFlowPortKey, pickDefaultTypedFlowPortKey } from '@/lib/graph/flowPorts'

export const testFlowSchemaFieldPortKeysCreateStableHandlesForSchemaFields = () => {
  const nodes = [
    {
      id: 't1',
      properties: {
        'schema:fields': ['id', { title: 'warehouse_id', type: 'uuid' }],
      },
    },
    { id: 't2', properties: {} },
  ]

  const edges = [
    {
      id: 'e1',
      source: 't1',
      target: 't2',
      properties: { 'flow:sourcePortKey': 'field:warehouse_id', 'flow:targetPortKey': 'field:id' },
    },
  ]

  const byNode = computeFlowHandlesByNode({ nodes, edges })
  const t1 = byNode['t1']
  const t2 = byNode['t2']
  if (!t1) throw new Error('expected handles for t1')
  if (!t2) throw new Error('expected handles for t2')

  const t1OutIds = new Set((t1.out || []).map(h => h.id))
  if (!t1OutIds.has('out:field:id')) throw new Error('expected schema field out handle out:field:id')
  if (!t1OutIds.has('out:field:warehouse_id')) throw new Error('expected schema field out handle out:field:warehouse_id')

  const t2InIds = new Set((t2.in || []).map(h => h.id))
  if (!t2InIds.has('in:field:id')) throw new Error('expected target port handle in:field:id')
}

export const testFlowDefaultPortKeyPrefersTypedWidgetPortsByDirection = () => {
  const node = {
    properties: {
      'flow:portTypes': {
        in: { output: 'TEXT', imageUrl: 'IMAGE_URL', videoUrl: 'VIDEO_URL' },
        out: { text_out: 'TEXT' },
      },
      'schema:fields': ['fallback'],
    },
  }

  const defaultOut = pickDefaultTypedFlowPortKey(node as never, 'out')
  if (defaultOut !== 'text_out') throw new Error(`expected typed out port text_out, got ${String(defaultOut || '')}`)

  const defaultIn = pickDefaultTypedFlowPortKey(node as never, 'in')
  if (defaultIn !== 'output') throw new Error(`expected typed in port output, got ${String(defaultIn || '')}`)

  const resolvedOut = pickDefaultFlowPortKey(node as never, 'out')
  if (resolvedOut !== 'text_out') throw new Error(`expected default out flow port text_out, got ${String(resolvedOut || '')}`)

  const resolvedIn = pickDefaultFlowPortKey(node as never, 'in')
  if (resolvedIn !== 'output') throw new Error(`expected default in flow port output, got ${String(resolvedIn || '')}`)
}

export const testFlowPortHelpersReuseSharedNodePropertyReader = () => {
  const flowPortsPath = resolve(process.cwd(), 'src', 'lib', 'graph', 'flowPorts.ts')
  const flowPortsText = readFileSync(flowPortsPath, 'utf8')
  if (!flowPortsText.includes("import { readNodeProperties } from '@/lib/graph/nodeProperties'")) {
    throw new Error('expected flowPorts to reuse the shared node property reader upstream')
  }
  if (!flowPortsText.includes("import { isPlainObject } from '@/lib/graph/value'")) {
    throw new Error('expected flowPorts to reuse the shared plain-object guard upstream')
  }
  if (!flowPortsText.includes('const props = readNodeProperties(node)')) {
    throw new Error('expected flowPorts node property reads to reuse the shared node property reader')
  }
  if (flowPortsText.includes('function isRecord(')) {
    throw new Error('expected flowPorts to stop defining a local record guard')
  }
}
