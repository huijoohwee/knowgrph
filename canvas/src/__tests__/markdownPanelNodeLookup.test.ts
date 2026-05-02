import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildMarkdownIframeNodeIdSetFromGraphNodes,
  buildMarkdownMatchedBlockNodeIdSetFromGraphNodes,
  buildPanelOnlyNodeIdSetFromGraphNodes,
} from '@/lib/render/markdownPanelOverlayPool'

export function testBuildMarkdownIframeNodeIdSetFromGraphNodesMatchesCanonicalIframeRows() {
  const ids = buildMarkdownIframeNodeIdSetFromGraphNodes({
    nodes: [
      {
        id: 'blk:iframe:1',
        type: 'IFrame',
        label: 'Embed',
        properties: {
          iframe_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        },
        metadata: {
          lineStart: 12,
        },
      },
      {
        id: 'blk:image:1',
        type: 'Image',
        label: 'Image',
        properties: {
          image: 'https://example.com/image.png',
        },
        metadata: {
          lineStart: 12,
        },
      },
    ] as Parameters<typeof buildMarkdownIframeNodeIdSetFromGraphNodes>[0]['nodes'],
    iframeLineStarts: new Set([12]),
  })

  if (!ids.has('blk:iframe:1')) throw new Error('expected iframe node id to match iframe line range')
  if (ids.has('blk:image:1')) throw new Error('expected non-iframe media node to stay excluded from iframe lookup')
}

export function testBuildMarkdownMatchedBlockNodeIdSetFromGraphNodesMatchesMarkdownRanges() {
  const ids = buildMarkdownMatchedBlockNodeIdSetFromGraphNodes({
    nodes: [
      {
        id: 'blk:table:1',
        type: 'Table',
        label: 'Table',
        properties: {},
        metadata: { lineStart: 3 },
      },
      {
        id: 'blk:code:1',
        type: 'CodeBlock',
        label: 'Code',
        properties: {},
        metadata: { lineStart: 5 },
      },
      {
        id: 'blk:quote:1',
        type: 'Paragraph',
        label: 'Quote',
        properties: {},
        metadata: { lineStart: 8 },
      },
      {
        id: 'blk:iframe:1',
        type: 'IFrame',
        label: 'Iframe',
        properties: {
          iframe_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        },
        metadata: { lineStart: 13 },
      },
    ] as Parameters<typeof buildMarkdownMatchedBlockNodeIdSetFromGraphNodes>[0]['nodes'],
    lineRanges: {
      table: new Set([3]),
      code: new Set([5]),
      blockquote: new Set([8]),
      iframe: new Set([13]),
    },
  })

  const expected = ['blk:table:1', 'blk:code:1', 'blk:quote:1', 'blk:iframe:1']
  for (const id of expected) {
    if (!ids.has(id)) throw new Error(`expected markdown matched node id: ${id}`)
  }
}

export function testBuildPanelOnlyNodeIdSetFromGraphNodesKeepsParagraphPanelSignals() {
  const ids = buildPanelOnlyNodeIdSetFromGraphNodes([
    {
      id: 'blk:callout:1',
      type: 'Paragraph',
      label: 'Callout',
      properties: { calloutType: true, text: '> note' },
    },
  ] as Parameters<typeof buildPanelOnlyNodeIdSetFromGraphNodes>[0])

  if (!ids.has('blk:callout:1')) throw new Error('expected paragraph callout to remain panel-only')
}

export function testGraphCanvasRootUsesSharedMarkdownPanelLookupHelpers() {
  const filePath = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'GraphCanvasRootImpl.tsx')
  const text = readFileSync(filePath, 'utf8')
  const requiredSnippets = [
    'buildMarkdownIframeNodeIdSetFromGraphNodes',
    'buildMarkdownMatchedBlockNodeIdSetFromGraphNodes',
  ]
  for (const snippet of requiredSnippets) {
    if (!text.includes(snippet)) {
      throw new Error(`expected GraphCanvasRootImpl to use shared markdown panel lookup helper: ${snippet}`)
    }
  }
  if (text.includes("const lineStartRaw = meta ? meta.lineStart : null")) {
    throw new Error('expected GraphCanvasRootImpl to remove duplicated markdown panel lineStart scans')
  }
}

export function testDesignCanvasMarkdownPanelGroupsUsesSharedMarkdownPanelLookupHelpers() {
  const filePath = resolve(process.cwd(), 'src', 'components', 'DesignCanvas', 'useDesignCanvasMarkdownPanelGroups.ts')
  const text = readFileSync(filePath, 'utf8')
  const requiredSnippets = [
    'buildPanelOnlyNodeIdSetFromGraphNodes',
    'buildMarkdownMatchedBlockNodeIdSetFromGraphNodes',
  ]
  for (const snippet of requiredSnippets) {
    if (!text.includes(snippet)) {
      throw new Error(`expected DesignCanvas markdown panel groups to use shared helper: ${snippet}`)
    }
  }
  if (text.includes('const lineStartRaw = meta ? meta.lineStart : null')) {
    throw new Error('expected DesignCanvas markdown panel groups to remove duplicated lineStart scans')
  }
}

export function testMarkdownPanelOverlayPoolReusesSharedMetadataReaderForLineStarts() {
  const filePath = resolve(process.cwd(), 'src', 'lib', 'render', 'markdownPanelOverlayPool.ts')
  const text = readFileSync(filePath, 'utf8')
  if (!text.includes("import { toMetadataRecord } from '@/lib/graph/documentMetadata'")) {
    throw new Error('expected markdownPanelOverlayPool to reuse the shared document metadata coercion helper upstream')
  }
  if (!text.includes('const raw = toMetadataRecord(n.metadata).lineStart')) {
    throw new Error('expected markdownPanelOverlayPool lineStart reads to reuse the shared document metadata coercion helper')
  }
  if (text.includes("n.metadata && typeof n.metadata === 'object' && !Array.isArray(n.metadata)")) {
    throw new Error('expected markdownPanelOverlayPool to stop coercing node metadata inline when reading lineStart values')
  }
}
