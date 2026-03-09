import { tryParseMarkdownPanelFlowGraph } from '@/features/parsers/markdownPanelFlowGraph'
import { FLOW_NODE_QUICK_EDITOR_REGISTRY_METADATA_KEY } from '@/lib/config'

export function testMarkdownPanelFlowGraphParsesPanelsAndEdges() {
  const md = [
    '---',
    'subject:',
    '  name: null',
    '---',
    '',
    '## Column 1 — Sources',
    '',
    '### Copy library',
    '',
    '| ← Inputs | Settings | Outputs → |',
    '|---|---|---|',
    '| — | `{{copy.title}}` | **subject info** 🟢 |',
    '| | `{{copy.hashtags}}` | **hashtags** 🔵 |',
    '',
    '**Edges**',
    '`subject info` → Post caption : subject in',
    '`hashtags` → Post caption : hashtags in',
    '',
    '### Post caption',
    '',
    '| ← Inputs | Settings | Outputs → |',
    '|---|---|---|',
    '| subject in 🟢 ← Copy library | — | **caption** 🔵 |',
    '| hashtags in 🔵 ← Copy library | — | |',
    '',
  ].join('\n')

  const res = tryParseMarkdownPanelFlowGraph('demo.md', md)
  if (!res) throw new Error('expected panel flow parse result')
  if (res.graphData.context !== 'markdown-panel-flow') throw new Error('expected markdown-panel-flow context')
  if (res.graphData.nodes.length < 2) throw new Error(`expected >=2 nodes, got ${res.graphData.nodes.length}`)
  if (res.graphData.edges.length !== 2) throw new Error(`expected 2 edges, got ${res.graphData.edges.length}`)
  const meta = (res.graphData.metadata || {}) as Record<string, unknown>
  const registry = meta[FLOW_NODE_QUICK_EDITOR_REGISTRY_METADATA_KEY]
  if (!Array.isArray(registry) || registry.length < 2) throw new Error('expected quick editor registry entries')
}

