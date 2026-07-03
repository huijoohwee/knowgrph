import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { GraphNode } from '@/lib/graph/types'
import { resolveWidgetNodeTitle } from '@/components/StoryboardWidget/widgetEditorTitle'
import { resolveWidgetEditorSurfaceLabel } from '@/components/StoryboardWidget/flowWidgetOverlayShared'
import type { WidgetRegistryEntry } from '@/features/storyboard-widget-manager/widgetRegistryTypes'
import { CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT } from '@/lib/chatEndpoint'
import { UI_LABELS } from '@/lib/config'
import { FLOW_VIDEO_GENERATION_NODE_LABEL } from '@/lib/config.storyboard-widget'
import {
  FLOW_GRABMAPS_DISCOVERY_FORM_ID,
  FLOW_GRABMAPS_DISCOVERY_NODE_TYPE_ID,
  FLOW_GRABMAPS_DISCOVERY_WIDGET_TYPE_ID,
} from '@/features/storyboard-widget-manager/grabMapsDiscoveryWidget'

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

export function testWidgetTitleUsesFrontmatterDataLabelsWithoutSampleHardcodes() {
  const sharedSource = readFileSync(resolve(process.cwd(), 'src/components/StoryboardWidget/flowWidgetOverlayShared.ts'), 'utf8')
  const wrapperSource = readFileSync(resolve(process.cwd(), 'src/components/StoryboardWidgetCanvas/storyboardWidgetCanvasShared.tsx'), 'utf8')
  const runtimeSource = readFileSync(resolve(process.cwd(), 'src/components/StoryboardWidgetCanvas.runtime.tsx'), 'utf8')
  const overlayElementsSource = readFileSync(resolve(process.cwd(), 'src/components/StoryboardWidgetCanvas/runtime/storyboardWidgetOverlaySurfaceElements.tsx'), 'utf8')
  const panelSource = readFileSync(resolve(process.cwd(), 'src/components/StoryboardWidget/WidgetEditorPanel.tsx'), 'utf8')
  const viewSource = readFileSync(resolve(process.cwd(), 'src/components/StoryboardWidget/WidgetEditorView.tsx'), 'utf8')
  const formSource = readFileSync(resolve(process.cwd(), 'src/components/StoryboardWidget/WidgetEditorForm.tsx'), 'utf8')
  if (
    resolveWidgetEditorSurfaceLabel('card') !== UI_LABELS.storyboardCard
    || resolveWidgetEditorSurfaceLabel('widget') !== UI_LABELS.flowWidget
    || resolveWidgetEditorSurfaceLabel() !== UI_LABELS.flowWidget
    || !sharedSource.includes("export type WidgetEditorSurfaceKind = 'card' | 'widget'")
    || !wrapperSource.includes('editorSurfaceKind?: WidgetEditorSurfaceKind')
    || !wrapperSource.includes('editorSurfaceKind={args.editorSurfaceKind}')
    || !runtimeSource.includes("editorSurfaceKind: storyboardCardDisplayActive ? 'card' : 'widget'")
    || !overlayElementsSource.includes('editorSurfaceKind={args.editorSurfaceKind}')
    || !panelSource.includes('const editorSurfaceLabel = resolveWidgetEditorSurfaceLabel(editorSurfaceKind)')
    || !panelSource.includes('ariaLabel={editorSurfaceLabel}')
    || !panelSource.includes('actionsAriaLabel={editorSurfaceLabel}')
    || !viewSource.includes('const editorSurfaceLabel = resolveWidgetEditorSurfaceLabel(editorSurfaceKind)')
    || !viewSource.includes('aria-label={editorSurfaceLabel}')
    || !viewSource.includes('ariaLabel={editorSurfaceLabel}')
    || !viewSource.includes('editorSurfaceKind={editorSurfaceKind}')
    || !formSource.includes('aria-label={UI_LABELS.flowWidgetForm}')
    || !formSource.includes('Model for flow widget')
    || formSource.includes('flow:card')
  ) {
    throw new Error('expected Card display overlays to expose Card shell labels while default editor surfaces keep Widget labels')
  }

  const alpha = resolveWidgetNodeTitle({
    graphMetaKind: 'frontmatter-flow',
    node: makeNode({ id: '1', type: 'input', label: '`bg#7F1D1D:Raw input`', data: { label: 'Alpha' } }),
  })
  if (alpha !== 'Alpha') throw new Error(`expected Alpha, got ${alpha}`)

  const beta = resolveWidgetNodeTitle({
    graphMetaKind: 'frontmatter-flow',
    node: makeNode({ id: '2', type: 'input', label: '`bg#14532D:Raw input`', data: { title: 'Beta Driver' } }),
  })
  if (beta !== 'Beta Driver') throw new Error(`expected Beta Driver, got ${beta}`)

  const fallbackInput = resolveWidgetNodeTitle({
    graphMetaKind: 'frontmatter-flow',
    node: makeNode({ id: '3', type: 'input', label: '`bg#1E3A5F:Fallback Input`' }),
  })
  if (fallbackInput !== 'Fallback Input') throw new Error(`expected Fallback Input, got ${fallbackInput}`)

  const compute = resolveWidgetNodeTitle({
    graphMetaKind: 'frontmatter-flow',
    node: makeNode({ id: '4', type: 'default', label: 'Weighted Score' }),
  })
  if (compute !== 'Weighted Score') throw new Error(`expected Weighted Score, got ${compute}`)

  const outputFromPath = resolveWidgetNodeTitle({
    graphMetaKind: 'frontmatter-flow',
    node: makeNode({ id: '5', type: 'output', label: '`bg#78350F:Log`', data: { reads: 'data.values.margin_score' } }),
  })
  if (outputFromPath !== 'Margin Score') throw new Error(`expected Margin Score, got ${outputFromPath}`)

  const outputFallback = resolveWidgetNodeTitle({
    graphMetaKind: 'frontmatter-flow',
    node: makeNode({ id: '6', type: 'output', label: '`bg#0F172A:Logged Result`' }),
  })
  if (outputFallback !== 'Logged Result') throw new Error(`expected Logged Result, got ${outputFallback}`)

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

  const openAiTextFromPropsOnly = resolveWidgetNodeTitle({
    node: makeNode({
      id: 'text-2b',
      type: 'TextGeneration',
      label: 'Text Widget',
      properties: {
        chatProvider: 'openai',
        'flow:widgetTypeId': 'default',
        'flow:widgetFormId': 'textGeneration.openai',
      },
    }),
  })
  if (openAiTextFromPropsOnly !== 'OpenAI Text Widget') {
    throw new Error(`expected OpenAI Text Widget from widget identity fallback, got ${openAiTextFromPropsOnly}`)
  }

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
