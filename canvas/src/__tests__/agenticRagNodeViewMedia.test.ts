import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { agenticRagNodeFromGraphNode } from '@/lib/graph/jsonld/utils'

export function testAgenticRagNodeViewReadsCanonicalImageMediaSpec() {
  const view = agenticRagNodeFromGraphNode({
    id: 'agentic:image:1',
    type: 'Image',
    label: 'Agentic image',
    properties: {
      image: 'https://example.com/agentic-image.png',
    },
  } as Parameters<typeof agenticRagNodeFromGraphNode>[0])

  if (view.mediaKind !== 'image') {
    throw new Error(`expected canonical media kind image, got ${String(view.mediaKind)}`)
  }
  if (view.mediaUrl !== 'https://example.com/agentic-image.png') {
    throw new Error(`expected canonical media url from image field, got ${String(view.mediaUrl)}`)
  }
}

export function testAgenticRagNodeViewReadsMarkdownDerivedMediaSpec() {
  const view = agenticRagNodeFromGraphNode({
    id: 'agentic:markdown:1',
    type: 'Paragraph',
    label: 'Markdown image',
    properties: {
      text: 'See ![](https://example.com/agentic-inline.png)',
    },
  } as Parameters<typeof agenticRagNodeFromGraphNode>[0])

  if (view.mediaKind !== 'image') {
    throw new Error(`expected markdown-derived media kind image, got ${String(view.mediaKind)}`)
  }
  if (view.mediaUrl !== 'https://example.com/agentic-inline.png') {
    throw new Error(`expected markdown-derived media url, got ${String(view.mediaUrl)}`)
  }
}

export function testAgenticInspectorUsesCanonicalMediaFields() {
  const filePath = resolve(process.cwd(), 'src', 'features', 'panels', 'views', 'AgenticRagNodeInspectorSection.tsx')
  const text = readFileSync(filePath, 'utf8')
  const requiredSnippets = ['selectedAgenticNode.mediaKind', 'media.kind', 'media.url']
  for (const snippet of requiredSnippets) {
    if (!text.includes(snippet)) {
      throw new Error(`expected AgenticRag inspector to use canonical media snippet: ${snippet}`)
    }
  }
  if (text.includes('media_url')) {
    throw new Error('expected AgenticRag inspector to stop labeling raw media_url directly')
  }
}
