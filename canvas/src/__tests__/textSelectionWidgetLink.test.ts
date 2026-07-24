import React from 'react'
import { createRoot } from 'react-dom/client'

import {
  beginTextSelectionWidgetLinkSession,
  buildTextSelectionWidgetEdge,
  clearTextSelectionWidgetLinkSession,
  TEXT_SELECTION_WIDGET_CREATE_EVENT,
  getTextSelectionWidgetLinkSnapshot,
  isTextSelectionWidgetEdgePersisted,
  resolveTextSelectionWidgetTargetPosition,
  TEXT_SELECTION_WIDGET_LINK_SCHEMA,
  type TextSelectionWidgetCreateDetail,
} from '@/lib/storyboardWidget/textSelectionWidgetLink'
import type { GraphData } from '@/lib/graph/types'
import type { WidgetRegistryEntry } from '@/features/storyboard-widget-manager/widgetRegistryTypes'
import WidgetPalette from '@/features/toolbar/WidgetPalette'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { installDeterministicRaf, mountReactRoot, unmountReactRoot } from '@/tests/lib/reactRootHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'

export function testTextSelectionWidgetLinkBuildsTargetPlacementAndProvenanceEdge() {
  clearTextSelectionWidgetLinkSession()
  const session = beginTextSelectionWidgetLinkSession({
    sourceNodeId: 'source-panel',
    selectedText: '  selected source text  ',
    startLine: 12,
    endLine: 13,
    documentPath: 'notes/example.md',
  })
  if (!session || getTextSelectionWidgetLinkSnapshot() !== session) {
    throw new Error('expected the selected text to arm one active Widget-link session')
  }
  if (session.selectedText !== 'selected source text') {
    throw new Error(`expected normalized selected text, got ${JSON.stringify(session.selectedText)}`)
  }

  const graphData: GraphData = {
    type: 'Graph',
    nodes: [
      {
        id: 'source-panel',
        type: 'RichMediaPanel',
        label: 'Source',
        x: 100,
        y: 220,
        properties: { 'visual:width': 720 },
      },
      {
        id: 'target-widget',
        type: 'TextGeneration',
        label: 'Target',
        x: 940,
        y: 220,
        properties: {},
      },
    ],
    edges: [],
  }
  const position = resolveTextSelectionWidgetTargetPosition({ sourceNode: graphData.nodes[0]! })
  if (position.x !== 940 || position.y !== 220) {
    throw new Error(`expected target placement beside the Rich Media source, got ${JSON.stringify(position)}`)
  }
  const edge = buildTextSelectionWidgetEdge({
    graphData,
    session,
    targetNodeId: 'target-widget',
  })
  if (!edge || edge.source !== 'source-panel' || edge.target !== 'target-widget' || edge.label !== 'selection') {
    throw new Error(`expected a source-to-target selection edge, got ${JSON.stringify(edge)}`)
  }
  if (edge.properties.schema !== TEXT_SELECTION_WIDGET_LINK_SCHEMA
    || edge.properties['selection:text'] !== 'selected source text'
    || edge.properties['selection:startLine'] !== 12
    || edge.properties['selection:endLine'] !== 13
    || edge.properties['selection:documentPath'] !== 'notes/example.md') {
    throw new Error(`expected persisted selection provenance, got ${JSON.stringify(edge.properties)}`)
  }

  graphData.edges.push(edge)
  const duplicate = buildTextSelectionWidgetEdge({
    graphData,
    session,
    targetNodeId: 'target-widget',
  })
  if (duplicate?.id !== edge.id) {
    throw new Error('expected repeated target creation to resolve the existing provenance edge')
  }
  const composedGraphData: GraphData = {
    ...graphData,
    nodes: graphData.nodes.map(node => ({ ...node, id: `workspace-layer::${node.id}` })),
    edges: [{
      ...edge,
      id: `workspace-layer::${edge.id}`,
      source: `workspace-layer::${edge.source}`,
      target: `workspace-layer::${edge.target}`,
    }],
  }
  if (!isTextSelectionWidgetEdgePersisted({ graphData: composedGraphData, edge })) {
    throw new Error('expected composed workspace edge identity to satisfy the post-write persistence proof')
  }
  const composedDuplicate = buildTextSelectionWidgetEdge({
    graphData: composedGraphData,
    session,
    targetNodeId: 'target-widget',
  })
  if (composedDuplicate?.id !== `workspace-layer::${edge.id}`) {
    throw new Error(
      `expected inner endpoint ids to resolve the existing composed edge, got ${JSON.stringify(composedDuplicate)}`,
    )
  }
  const composedEdge = buildTextSelectionWidgetEdge({
    graphData: {
      ...composedGraphData,
      edges: [{
        id: 'workspace-layer::e1',
        source: 'workspace-layer::unrelated-source',
        target: 'workspace-layer::unrelated-target',
        label: 'flow',
        properties: {},
      }],
    },
    session,
    targetNodeId: 'target-widget',
  })
  if (!composedEdge
    || composedEdge.id !== 'e2'
    || composedEdge.source !== 'workspace-layer::source-panel'
    || composedEdge.target !== 'workspace-layer::target-widget') {
    throw new Error(
      `expected inner ids to resolve against the composed graph without reusing e1, got ${JSON.stringify(composedEdge)}`,
    )
  }
  clearTextSelectionWidgetLinkSession()
  if (getTextSelectionWidgetLinkSnapshot() !== null) {
    throw new Error('expected completing or cancelling the flow to clear the active selection')
  }
}

export async function testWidgetPaletteCreatesTargetFromActiveTextSelection() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null

  try {
    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    anyWindow.requestAnimationFrame = installDeterministicRaf(dom.window)
    const entry: WidgetRegistryEntry = {
      id: 'default/textGeneration',
      isEnabled: true,
      nodeTypeId: 'TextGeneration',
      widgetTypeId: 'default',
      formId: 'textGeneration',
      fields: [],
      ports: [],
      updatedAt: '2026-07-24T00:00:00.000Z',
    }
    const session = beginTextSelectionWidgetLinkSession({
      sourceNodeId: 'source-panel',
      selectedText: 'selected source text',
      startLine: 12,
      endLine: 13,
      documentPath: 'notes/example.md',
    })
    if (!session) throw new Error('expected an active selection-link session')

    let received: TextSelectionWidgetCreateDetail | null = null
    const onCreate = (event: Event) => {
      received = (event as CustomEvent<TextSelectionWidgetCreateDetail>).detail
      if (received) received.claimed = true
    }
    dom.window.addEventListener(TEXT_SELECTION_WIDGET_CREATE_EVENT, onCreate)

    const container = dom.window.document.createElement('section')
    dom.window.document.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)
    await mountReactRoot(
      root,
      React.createElement(WidgetPalette, { entries: [entry], dragEnabled: true }),
      { window: dom.window, frames: 4 },
    )

    const header = String(container.textContent || '')
    if (!header.includes('Choose a target Widget to link to “selected source text”.')) {
      throw new Error(`expected active link-mode guidance, got ${JSON.stringify(header)}`)
    }
    const button = container.querySelector('[role="button"][aria-label="Create linked Widget Card Type 0"]')
    if (!(button instanceof dom.window.HTMLElement)) {
      throw new Error('expected the Widget palette entry to switch from drag mode to linked-create mode')
    }
    button.click()
    await new Promise<void>(resolve => dom.window.requestAnimationFrame(() => resolve()))

    if (!received || received.session !== session) {
      throw new Error('expected the palette click to dispatch the active selection session')
    }
    if (received.target.registryEntryId !== entry.id
      || received.target.nodeTypeId !== entry.nodeTypeId
      || received.target.layoutVariantId !== 'widget-card-type-0') {
      throw new Error(`expected the selected palette target contract, got ${JSON.stringify(received.target)}`)
    }
    dom.window.removeEventListener(TEXT_SELECTION_WIDGET_CREATE_EVENT, onCreate)
  } finally {
    clearTextSelectionWidgetLinkSession()
    try {
      if (root) await unmountReactRoot(root, { window: dom.window })
    } catch {
      void 0
    }
    restoreDom()
    restoreWindow()
  }
}
