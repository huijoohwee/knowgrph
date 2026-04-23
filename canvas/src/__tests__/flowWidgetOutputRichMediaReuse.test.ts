import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { getNodeMediaSpec } from '@/components/GraphCanvas/helpers'
import { buildTextWidgetOutputPatch } from '@/features/chat/richMediaRun'
import { buildDataflowWidgetRegistry } from '@/lib/flowEditor/widgetRegistryDataflow'

export function testTextWidgetOutputPatchBuildsRichMediaIframeSpec() {
  const patch = buildTextWidgetOutputPatch({
    output: '## Hello\\n\\nWidget output',
    title: 'BytePlus Text Widget',
    model: 'seed-1-6-thinking',
  })
  const node = {
    id: 'text-widget-output',
    type: 'TextGeneration',
    label: 'BytePlus Text Widget',
    properties: patch,
  } as Parameters<typeof getNodeMediaSpec>[0]

  const spec = getNodeMediaSpec(node)
  if (spec) throw new Error('expected text widget output patch to stay off the direct media overlay path and render through Rich Media Panel instead')
}

export function testFlowEditorCanvasTextRunUsesSharedRichMediaOutputPatch() {
  const flowEditorCanvasPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.tsx')
  const text = readFileSync(flowEditorCanvasPath, 'utf8')

  if (!text.includes('buildTextWidgetOutputPatch')) {
    throw new Error('expected FlowEditorCanvas text widget run path to reuse shared text-widget rich-media output patch helper')
  }
  if (!text.includes('...clearRichMediaOutputProperties(nodeProps)')) {
    throw new Error('expected FlowEditorCanvas text widget run path to clear stale rich-media output properties before writing next output')
  }
  if (!text.includes('...buildTextWidgetOutputPatch({')) {
    throw new Error('expected FlowEditorCanvas text widget run path to write shared rich-media panel output metadata')
  }
}

export function testFlowEditorCanvasRunTargetsWritableNodeIdForComposedGraphs() {
  const flowEditorCanvasPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.tsx')
  const text = readFileSync(flowEditorCanvasPath, 'utf8')

  if (!text.includes('splitComposedNodeId')) {
    throw new Error('expected FlowEditorCanvas run path to normalize composed node ids before writeback')
  }
  if (!text.includes('const writableNodeId = pickWritableNodeId() || resolvedNodeId')) {
    throw new Error('expected FlowEditorCanvas run path to resolve a writable node id in the active draft graph')
  }
  if (!text.includes('updateRunOutputForKnownNodeIds')) {
    throw new Error('expected FlowEditorCanvas run path to write outputs via canonical id updater')
  }
  if (!text.includes("idValue.includes('::')")) {
    throw new Error('expected FlowEditorCanvas run path to normalize layer::node ids to leaf ids before writeback')
  }
  if (!text.includes('setDraftGraphData(prev => {')) {
    throw new Error('expected FlowEditorCanvas run path to update live draft graph output before renderer recompute')
  }
}

export function testFlowEditorCanvasUsesDraftRevisionForActiveRenderGraph() {
  const flowEditorCanvasPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.tsx')
  const text = readFileSync(flowEditorCanvasPath, 'utf8')

  if (!text.includes('const draftGraphDataRevision = React.useMemo(() => {')) {
    throw new Error('expected FlowEditorCanvas to derive a render revision from the live draft graph')
  }
  if (!text.includes("const raw = (meta as Record<string, unknown>).graphDataRevision")) {
    throw new Error('expected FlowEditorCanvas to read the draft graph revision from graph metadata')
  }
  if (!text.includes('graphDataRevisionOverride={flowEditorViewActive ? draftGraphDataRevision : baseGraphDataRevision}')) {
    throw new Error('expected FlowCanvas to render against the live draft revision while Flow Editor is active')
  }
}

export function testFlowEditorCanvasDataflowRegistryPrefersNonEmptyDocumentThenEffectiveThenBase() {
  const flowEditorCanvasPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.tsx')
  const text = readFileSync(flowEditorCanvasPath, 'utf8')

  if (!text.includes('buildDataflowWidgetRegistry')) {
    throw new Error('expected FlowEditorCanvas to use shared dataflow registry merger')
  }
  if (!text.includes('documentWidgetRegistry: Array.isArray(store.documentWidgetRegistry)')) {
    throw new Error('expected FlowEditorCanvas run path to include document widget registry in merged dataflow registry')
  }
  if (!text.includes('effectiveWidgetRegistry: Array.isArray(store.effectiveWidgetRegistry)')) {
    throw new Error('expected FlowEditorCanvas run path to include effective widget registry in merged dataflow registry')
  }
  if (!text.includes('widgetRegistry: Array.isArray(store.widgetRegistry)')) {
    throw new Error('expected FlowEditorCanvas run path to include base widget registry in merged dataflow registry')
  }
}

export function testBuildDataflowWidgetRegistryMergesPartialDocumentWithFallback() {
  const merged = buildDataflowWidgetRegistry({
    documentWidgetRegistry: [
      { id: 'doc-panel', isEnabled: true, nodeTypeId: 'RichMediaPanel', widgetTypeId: 'default', formId: 'richMediaPanel', fields: [], ports: [], updatedAt: '2026-04-23T00:00:00.000Z' },
    ],
    effectiveWidgetRegistry: [
      { id: 'eff-openai', isEnabled: true, nodeTypeId: 'TextGeneration', widgetTypeId: 'default', formId: 'textGeneration.openai', fields: [], ports: [], updatedAt: '2026-04-23T00:00:00.000Z' },
    ],
    widgetRegistry: [
      { id: 'base-openai', isEnabled: true, nodeTypeId: 'TextGeneration', widgetTypeId: 'default', formId: 'textGeneration.openai', fields: [], ports: [], updatedAt: '2026-04-23T00:00:00.000Z' },
    ],
  })
  const ids = new Set(merged.map(entry => String(entry.id || '').trim()))
  if (!ids.has('doc-panel')) throw new Error('expected merged registry to keep document-scoped entries')
  if (!ids.has('eff-openai')) throw new Error('expected merged registry to include effective fallback entries when document registry is partial')
}

export function testBuildDataflowWidgetRegistryPrefersRicherEntryForSameShapeAcrossSources() {
  const merged = buildDataflowWidgetRegistry({
    documentWidgetRegistry: [
      {
        id: 'doc-openai-incomplete',
        isEnabled: true,
        nodeTypeId: 'TextGeneration',
        widgetTypeId: 'default',
        formId: 'textGeneration.openai',
        fields: [],
        ports: [],
        schemaMappings: [],
        updatedAt: '2026-04-24T10:00:00.000Z',
      },
    ],
    effectiveWidgetRegistry: [
      {
        id: 'eff-openai-rich',
        isEnabled: true,
        nodeTypeId: 'TextGeneration',
        widgetTypeId: 'default',
        formId: 'textGeneration.openai',
        fields: [{ fieldKey: 'prompt', fieldType: 'textarea', schemaPath: 'properties.prompt' }],
        ports: [{ portKey: 'text_out', direction: 'output', schemaPath: 'properties.output' }],
        schemaMappings: [],
        updatedAt: '2026-04-24T09:00:00.000Z',
      },
    ],
    widgetRegistry: [],
  })
  const textOpenAi = merged.filter(entry =>
    String(entry.nodeTypeId || '') === 'TextGeneration'
    && String(entry.widgetTypeId || '') === 'default'
    && String(entry.formId || '') === 'textGeneration.openai',
  )
  if (textOpenAi.length !== 1) throw new Error(`expected one canonical TextGeneration openai entry, got ${textOpenAi.length}`)
  if (String(textOpenAi[0]?.id || '') !== 'eff-openai-rich') {
    throw new Error('expected richer same-shape entry to replace incomplete duplicate across registry sources')
  }
}
