import { toParserSpec } from '@/features/parsers/custom'
import { registerParser, applyParser } from '@/features/parsers/registry'
import { toParserId } from '@/features/parsers'
import type { CustomParserConfig } from '@/features/parsers/persistence'

export function testCustomParserTransforms() {
  const cfg: CustomParserConfig = {
    id: 'custom-n8n-map',
    name: 'Custom N8n Map',
    base: 'n8n',
    match: { mode: 'contains', value: 'n8n' },
    transforms: {
      node: {
        typeMap: { '@n8n/n8n-nodes-langchain.embeddingsCohere': 'Embeddings' },
        labelFrom: 'properties.parameters.model',
        props: { pick: ['parameters'], map: { model: 'properties.parameters.model' } },
      },
      edge: {
        labelMap: { main: 'flow' },
        props: { set: { via: 'parser' } },
      },
    },
  }
  const spec = toParserSpec(cfg)
  if (!spec) throw new Error('toParserSpec failed')
  registerParser(spec)
  const text = JSON.stringify({ name: 'n8n', nodes: [{ id: 'x', name: 'Embeddings', type: '@n8n/n8n-nodes-langchain.embeddingsCohere', parameters: { model: 'm' } }], connections: { 'Embeddings': { main: [] } } })
  const res = applyParser(toParserId('custom-n8n-map'), { name: 'n8n.json', text })
  if (!res) throw new Error('applyParser failed')
  const n = res.graphData.nodes[0]
  if (n.label !== 'm') throw new Error('labelFrom not applied')
  const eLabelOk = res.graphData.edges.every(e => e.label === 'flow')
  if (!eLabelOk) throw new Error('edge labelMap not applied')
}
