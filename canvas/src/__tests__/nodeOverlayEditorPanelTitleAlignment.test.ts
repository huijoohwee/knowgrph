import type { GraphNode } from '@/lib/graph/types'
import { resolveWidgetNodeTitle } from '@/components/FlowEditor/NodeOverlayEditorPanel'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'

const makeNode = (args: {
  id: string
  type: string
  label?: string
  data?: Record<string, unknown>
  properties?: Record<string, unknown>
}): GraphNode =>
  ({
    id: args.id,
    type: args.type,
    label: args.label || args.id,
    properties: { ...(args.data ? { data: args.data } : {}), ...(args.properties || {}) },
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

  const bytePlusText = resolveWidgetNodeTitle({
    node: makeNode({ id: 'text-1', type: 'TextGeneration', label: 'Text Widget' }),
    registryEntry: {
      id: 'textGeneration-default',
      isEnabled: true,
      nodeTypeId: 'TextGeneration',
      widgetTypeId: 'default',
      formId: 'textGeneration',
      fields: [],
      ports: [],
      updatedAt: '2026-04-22T00:00:00.000Z',
    } satisfies WidgetRegistryEntry,
  })
  if (bytePlusText !== 'BytePlus Text Widget') throw new Error(`expected BytePlus Text Widget, got ${bytePlusText}`)

  const openAiText = resolveWidgetNodeTitle({
    node: makeNode({ id: 'text-2', type: 'TextGeneration', label: 'Text Widget', properties: { chatProvider: 'openai' } }),
    registryEntry: {
      id: 'textGeneration-openai',
      isEnabled: true,
      nodeTypeId: 'TextGeneration',
      widgetTypeId: 'default',
      formId: 'textGeneration.openai',
      fields: [],
      ports: [],
      updatedAt: '2026-04-22T00:00:00.000Z',
    } satisfies WidgetRegistryEntry,
  })
  if (openAiText !== 'OpenAI Text Widget') throw new Error(`expected OpenAI Text Widget, got ${openAiText}`)

  const seedreamImage = resolveWidgetNodeTitle({
    node: makeNode({ id: 'image-1', type: 'ImageGeneration', label: 'Image Widget', properties: { model: 'seedream-5-0-lite-250817' } }),
    registryEntry: {
      id: 'imageGeneration-default',
      isEnabled: true,
      nodeTypeId: 'ImageGeneration',
      widgetTypeId: 'default',
      formId: 'imageGeneration',
      fields: [],
      ports: [],
      updatedAt: '2026-04-22T00:00:00.000Z',
    } satisfies WidgetRegistryEntry,
  })
  if (seedreamImage !== 'Seedream 5.0 Lite Image Widget') throw new Error(`expected Seedream 5.0 Lite Image Widget, got ${seedreamImage}`)

  const seedanceVideo = resolveWidgetNodeTitle({
    node: makeNode({ id: 'video-1', type: 'VideoGeneration', label: 'Video Widget', properties: { model: 'dreamina-seedance-2-0-250428' } }),
    registryEntry: {
      id: 'videoGeneration-default',
      isEnabled: true,
      nodeTypeId: 'VideoGeneration',
      widgetTypeId: 'default',
      formId: 'videoGeneration',
      fields: [],
      ports: [],
      updatedAt: '2026-04-22T00:00:00.000Z',
    } satisfies WidgetRegistryEntry,
  })
  if (seedanceVideo !== 'Seedance 2.0 Video Widget') throw new Error(`expected Seedance 2.0 Video Widget, got ${seedanceVideo}`)
}
