import type { GraphData } from '@/lib/graph/types'
import { findSelectionTarget } from '@/features/markdown/ui/markdownPreviewSelection'

export function testMarkdownSelectionTargetEmptyDocPathFallsBackToAnyDocument() {
  const graphData: GraphData = {
    type: 'Graph',
    nodes: [
      {
        id: 'n1',
        type: 'Paragraph',
        label: 'First',
        properties: {},
        metadata: { documentPath: 'docs/example.md', lineStart: 5, lineEnd: 7 },
      },
      {
        id: 'n2',
        type: 'Paragraph',
        label: 'Second',
        properties: {},
        metadata: { documentPath: 'docs/other.md', lineStart: 5, lineEnd: 7 },
      },
    ],
    edges: [],
    metadata: {},
  }

  const target = findSelectionTarget(graphData, '', 6, 6)
  if (!target) throw new Error('expected a target when documentPath is empty')
  if (target.kind !== 'node') throw new Error(`expected node target, got ${target.kind}`)
  if (target.id !== 'n1') throw new Error(`expected n1 (first node in tie), got ${target.id}`)
}

