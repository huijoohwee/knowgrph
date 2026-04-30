import { normalizeNodes } from '@/features/parsers/markdownFrontmatterFlowGraph.nodes'
import { tryParseMarkdownFrontmatterFlowGraph } from '@/features/parsers/markdownFrontmatterFlowGraph.core'

type ExpectValue = {
  toBe: (expected: unknown) => void
  toBeTruthy: () => void
  toBeGreaterThan: (expected: number) => void
  toBeUndefined: () => void
  not: {
    toBe: (expected: unknown) => void
    toBeUndefined: () => void
  }
}

const describe = (_name: string, run: () => void) => run()
const it = (_name: string, run: () => void) => run()
const expect = (actual: unknown): ExpectValue => ({
  toBe: expected => {
    if (actual !== expected) throw new Error(`expected ${String(actual)} to be ${String(expected)}`)
  },
  toBeTruthy: () => {
    if (!actual) throw new Error(`expected ${String(actual)} to be truthy`)
  },
  toBeGreaterThan: expected => {
    if (typeof actual !== 'number' || actual <= expected) throw new Error(`expected ${String(actual)} to be greater than ${String(expected)}`)
  },
  toBeUndefined: () => {
    if (actual !== undefined) throw new Error(`expected ${String(actual)} to be undefined`)
  },
  not: {
    toBe: expected => {
      if (actual === expected) throw new Error(`expected ${String(actual)} not to be ${String(expected)}`)
    },
    toBeUndefined: () => {
      if (actual === undefined) throw new Error('expected value not to be undefined')
    },
  },
})

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

describe('normalizeNodes frontmatter flow defaults', () => {
  it('assigns spread positions when x/y are missing', () => {
    const meta = {
      nodes: [
        { id: 'w-text', type: 'TextGeneration', label: 'Text' },
        { id: 'w-image', type: 'ImageGeneration', label: 'Image' },
        { id: 'w-video', type: 'VideoGeneration', label: 'Video' },
        { id: 'p-media', type: 'RichMediaPanel', label: 'Panel' },
      ],
    } as Record<string, unknown>
    const out = normalizeNodes(meta)
    expect(out).toBeTruthy()
    expect(out?.nodes.length).toBe(4)
    const keys = new Set<string>()
    for (let i = 0; i < (out?.nodes.length || 0); i += 1) {
      const n = out!.nodes[i]!
      expect(isFiniteNumber(n.x)).toBe(true)
      expect(isFiniteNumber(n.y)).toBe(true)
      const key = `${Math.round(n.x as number)}:${Math.round(n.y as number)}`
      expect(keys.has(key)).toBe(false)
      keys.add(key)
    }
  })

  it('uses canonical widget formId fallback for text/image/video/panel nodes', () => {
    const meta = {
      nodes: [
        { id: 'w-text', type: 'TextGeneration', label: 'Text' },
        { id: 'w-image', type: 'ImageGeneration', label: 'Image' },
        { id: 'w-video', type: 'VideoGeneration', label: 'Video' },
        { id: 'p-media', type: 'RichMediaPanel', label: 'Panel' },
        { id: 'n-custom', type: 'Node', label: 'Custom Node' },
      ],
    } as Record<string, unknown>
    const out = normalizeNodes(meta)
    expect(out).toBeTruthy()
    const byId = new Map<string, Record<string, unknown>>()
    for (let i = 0; i < (out?.nodes.length || 0); i += 1) {
      const n = out!.nodes[i]!
      byId.set(String(n.id || ''), (n.properties || {}) as Record<string, unknown>)
    }
    expect(String(byId.get('w-text')?.['flow:widgetFormId'] || '')).toBe('textGeneration')
    expect(String(byId.get('w-image')?.['flow:widgetFormId'] || '')).toBe('imageGeneration')
    expect(String(byId.get('w-video')?.['flow:widgetFormId'] || '')).toBe('videoGeneration')
    expect(String(byId.get('p-media')?.['flow:widgetFormId'] || '')).toBe('richMediaPanel')
    expect(String(byId.get('n-custom')?.['flow:widgetFormId'] || '')).toBe('fm:n-custom')
  })

  it('assigns topology-spread positions for flow block nodes so edges remain readable', () => {
    const doc = [
      '---',
      'flow:',
      '  direction: LR',
      '  nodes:',
      '    - id: w-text',
      '      type: TextGeneration',
      '      label: Text',
      '      "flow:widgetFormId": textGeneration',
      '    - id: w-image',
      '      type: ImageGeneration',
      '      label: Image',
      '      "flow:widgetFormId": imageGeneration',
      '    - id: w-video',
      '      type: VideoGeneration',
      '      label: Video',
      '      "flow:widgetFormId": videoGeneration',
      '    - id: p-video',
      '      type: RichMediaPanel',
      '      label: Panel',
      '      "flow:widgetFormId": richMediaPanel',
      '  edges:',
      '    - { id: e1, source: w-text.text_out, target: w-image.reference_image }',
      '    - { id: e2, source: w-image.imageUrl, target: w-video.reference_image }',
      '    - { id: e3, source: w-video.videoUrl, target: p-video.videoUrl }',
      '---',
    ].join('\n')
    const parsed = tryParseMarkdownFrontmatterFlowGraph('layout-test.md', doc)
    expect(parsed).toBeTruthy()
    const nodes = parsed?.graphData.nodes || []
    const byId = new Map(nodes.map(node => [String(node.id || ''), node]))
    const textNode = byId.get('w-text')
    const imageNode = byId.get('w-image')
    const videoNode = byId.get('w-video')
    const panelNode = byId.get('p-video')
    const uniquePositions = new Set(nodes.map(node => `${Math.round(Number(node.x || 0))}:${Math.round(Number(node.y || 0))}`))
    const uniqueColumns = new Set(nodes.map(node => Math.round(Number(node.x || 0))))
    expect(uniquePositions.size).toBe(nodes.length)
    expect(uniqueColumns.size).toBeGreaterThan(1)
    expect(textNode?.x).not.toBe(panelNode?.x)
    expect(imageNode?.x).not.toBeUndefined()
    expect(videoNode?.x).not.toBeUndefined()
  })
})
