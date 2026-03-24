import { deriveMarkdownDesignLayoutFromGraphBlocks } from '@/features/markdown-edgeless/markdownDesignLayout'

export function testDeriveMarkdownDesignLayoutFromGraphBlocksBuildsBlocks(): void {
  const layout = deriveMarkdownDesignLayoutFromGraphBlocks({
    graphData: {
      nodes: [
        {
          id: 't1',
          type: 'Table',
          label: 'My Table',
          x: 10,
          y: 20,
          properties: { 'table:header': ['A'], 'table:rows': [['1']], 'visual:width': 300, 'visual:height': 120 },
        },
      ],
      edges: [],
    } as any,
    graphDataRevision: 7,
    nodePosById: null,
  })

  if (!layout) throw new Error('Expected layout')
  if (!layout.key.includes('graphBlocks|rev:7')) throw new Error('Expected key includes revision')
  if (!Array.isArray(layout.blocks) || layout.blocks.length !== 1) throw new Error('Expected one block')
  const b = layout.blocks[0]!
  if (b.id !== 't1') throw new Error('Expected id')
  if (b.preview.kind !== 'table') throw new Error('Expected table preview')
  if (b.w !== 300 || b.h !== 120) throw new Error('Expected size from visual:*')
  if (b.x !== 10 - 150 || b.y !== 20 - 60) throw new Error('Expected centered world placement')
}

