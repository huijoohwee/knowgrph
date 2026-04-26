import type { GraphNode } from '@/lib/graph/types'
import { resolveWidgetNodeTitle } from '@/components/FlowEditor/NodeOverlayEditorPanel'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import { CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT } from '@/lib/chatEndpoint'
import { FLOW_VIDEO_GENERATION_NODE_LABEL } from '@/lib/config.flow-editor'
import {
  FLOW_GRABMAPS_DISCOVERY_FORM_ID,
  FLOW_GRABMAPS_DISCOVERY_NODE_TYPE_ID,
  FLOW_GRABMAPS_DISCOVERY_WIDGET_TYPE_ID,
} from '@/features/flow-editor-manager/grabMapsDiscoveryWidget'

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
    node: makeNode({ id: 'image-1', type: 'ImageGeneration', label: 'BytePlus Image Widget', properties: { model: 'seedream-4-0-250828' } }),
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
  if (seedreamImage !== 'BytePlus Image Widget') throw new Error(`expected BytePlus Image Widget, got ${seedreamImage}`)

  const bytePlusVideo = resolveWidgetNodeTitle({
    node: makeNode({ id: 'video-1', type: 'VideoGeneration', label: FLOW_VIDEO_GENERATION_NODE_LABEL, properties: { model: CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT } }),
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
  if (bytePlusVideo !== 'BytePlus Video Widget') throw new Error(`expected BytePlus Video Widget, got ${bytePlusVideo}`)

  const discoveryWidget = resolveWidgetNodeTitle({
    node: makeNode({ id: 'discovery-1', type: FLOW_GRABMAPS_DISCOVERY_NODE_TYPE_ID, label: 'GrabMaps Chat Discovery Widget' }),
    registryEntry: {
      id: 'grabmaps-discovery',
      isEnabled: true,
      nodeTypeId: FLOW_GRABMAPS_DISCOVERY_NODE_TYPE_ID,
      widgetTypeId: FLOW_GRABMAPS_DISCOVERY_WIDGET_TYPE_ID,
      formId: FLOW_GRABMAPS_DISCOVERY_FORM_ID,
      fields: [],
      ports: [],
      updatedAt: '2026-04-24T00:00:00.000Z',
    } satisfies WidgetRegistryEntry,
  })
  if (discoveryWidget !== 'GrabMaps Chat Discovery Widget') {
    throw new Error(`expected GrabMaps Chat Discovery Widget, got ${discoveryWidget}`)
  }
}
