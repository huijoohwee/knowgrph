import type { GraphNode } from '@/lib/graph/types'
import { resolveWidgetNodeTitle } from '@/components/FlowEditor/NodeOverlayEditorPanel'

const makeNode = (args: {
  id: string
  type: string
  label?: string
  data?: Record<string, unknown>
}): GraphNode =>
  ({
    id: args.id,
    type: args.type,
    label: args.label || args.id,
    properties: { ...(args.data ? { data: args.data } : {}) },
  } as unknown as GraphNode)

export function testWidgetTitleAlignsWithComputingFlowRfSample() {
  const red = resolveWidgetNodeTitle({
    graphMetaKind: 'frontmatter-flow',
    node: makeNode({ id: '1', type: 'input', label: '`bg#7F1D1D:R — NumberInput`', data: { label: 'R' } }),
  })
  if (red !== 'Red') throw new Error(`expected Red, got ${red}`)

  const green = resolveWidgetNodeTitle({
    graphMetaKind: 'frontmatter-flow',
    node: makeNode({ id: '2', type: 'input', label: '`bg#14532D:G — NumberInput`', data: { label: 'G' } }),
  })
  if (green !== 'Green') throw new Error(`expected Green, got ${green}`)

  const blue = resolveWidgetNodeTitle({
    graphMetaKind: 'frontmatter-flow',
    node: makeNode({ id: '3', type: 'input', label: '`bg#1E3A5F:B — NumberInput`', data: { label: 'B' } }),
  })
  if (blue !== 'Blue') throw new Error(`expected Blue, got ${blue}`)

  const rgb = resolveWidgetNodeTitle({
    graphMetaKind: 'frontmatter-flow',
    node: makeNode({ id: '4', type: 'default', label: 'ColorPreview' }),
  })
  if (rgb !== 'RGB') throw new Error(`expected RGB, got ${rgb}`)

  const lightDark = resolveWidgetNodeTitle({
    graphMetaKind: 'frontmatter-flow',
    node: makeNode({ id: '5', type: 'default', label: 'Lightness' }),
  })
  if (lightDark !== 'LightDark') throw new Error(`expected LightDark, got ${lightDark}`)

  const light = resolveWidgetNodeTitle({
    graphMetaKind: 'frontmatter-flow',
    node: makeNode({ id: '6', type: 'output', label: '`bg#78350F:Log — light`', data: { reads: 'data.values.light' } }),
  })
  if (light !== 'Light') throw new Error(`expected Light, got ${light}`)

  const dark = resolveWidgetNodeTitle({
    graphMetaKind: 'frontmatter-flow',
    node: makeNode({ id: '7', type: 'output', label: '`bg#0F172A:Log — dark`', data: { reads: 'data.values.dark' } }),
  })
  if (dark !== 'Dark') throw new Error(`expected Dark, got ${dark}`)
}

