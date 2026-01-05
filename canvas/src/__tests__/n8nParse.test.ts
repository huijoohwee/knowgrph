import { isN8nWorkflow, parseN8nWorkflow } from '@/lib/graph/n8n'

const sample = {
  name: 'Sample',
  nodes: [
    { id: 'a-1', name: 'Webhook Trigger', type: 'n8n-nodes-base.webhook', position: [0,0], parameters: { path: 'x' } },
    { id: 'b-1', name: 'Text Splitter', type: '@n8n/n8n-nodes-langchain.textSplitterCharacterTextSplitter', position: [10,0], parameters: { chunkSize: 100 } },
    { id: 'c-1', name: 'Embeddings', type: '@n8n/n8n-nodes-langchain.embeddingsCohere', position: [20,0] },
  ],
  connections: {
    'Webhook Trigger': { main: [{ node: 'Text Splitter', type: 'main', index: 0 }] },
    'Text Splitter': {
      main: [{ node: 'Embeddings', type: 'main', index: 0 }],
      ai_textSplitter: [{ node: 'Embeddings', type: 'ai_textSplitter', index: 0 }],
    },
  },
}

export function testN8nParsingBasic() {
  if (!isN8nWorkflow(sample)) throw new Error('Detection failed for n8n sample')
  const { graphData } = parseN8nWorkflow(sample)
  if (graphData.nodes.length !== 3) throw new Error('Node count mismatch')
  if (graphData.edges.length !== 3) throw new Error('Edge count mismatch')
  const labels = new Set(graphData.edges.map(e => e.label))
  if (!labels.has('main') || !labels.has('ai_textSplitter')) throw new Error('Missing expected edge labels')
  const n = graphData.nodes.find(x => x.label === 'Webhook Trigger')
  if (!n || typeof n.x !== 'number') throw new Error('Position not set from node.position')
}
