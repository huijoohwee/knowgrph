import React, { act } from 'react'
import { createRoot } from 'react-dom/client'

import { buildStoryboardBoardModel } from '@/components/StoryboardCanvas/storyboardModel'
import { StoryboardCardMetaScrollRail } from '@/components/StoryboardWidgetCanvas/StoryboardCardMetaScrollRail'
import { buildStoryboardCardTextModel } from '@/components/StoryboardWidgetCanvas/storyboardCardTextModel'
import type { GraphData } from '@/lib/graph/types'
import type { FlowConnectedValuesBySchemaPath } from '@/lib/storyboardWidget/flowDataflow'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { waitForFrames } from '@/tests/lib/reactRootHarness'

const upstreamText = 'Upstream generated content must remain runtime input and never replace target-authored text.'

const graphData: GraphData = {
  type: 'Graph',
  nodes: [
    {
      id: 'source-widget',
      type: 'TextGeneration',
      label: 'Source Widget Card',
      properties: { lane: 'Widget Card', cardTypeLabel: 'Widget Card', output: upstreamText },
    },
    {
      id: 'target-widget',
      type: 'TextGeneration',
      label: 'Widget Card',
      properties: { lane: 'Widget Card', cardTypeLabel: 'Widget Card', prompt: '' },
    },
    {
      id: 'probe-target',
      type: 'TextGeneration',
      label: 'Probe-Tree Card',
      properties: { lane: 'Probe-Tree', cardTypeLabel: 'Probe-Tree Card', summary: '' },
    },
  ],
  edges: [],
}

const connectedPrompt: FlowConnectedValuesBySchemaPath = {
  'properties.prompt': {
    value: upstreamText,
    sources: [
      { edgeId: 'source-target-a', nodeId: 'source-widget', portKey: 'output' },
      { edgeId: 'source-target-b', nodeId: 'source-widget', portKey: 'output' },
    ],
  },
}

const connectedSummary: FlowConnectedValuesBySchemaPath = {
  'properties.summary': {
    value: upstreamText,
    sources: [{ edgeId: 'source-probe', nodeId: 'source-widget', portKey: 'output' }],
  },
}

export async function testStoryboardCardsRenderConnectedTextAsSourceChipsWithoutReplacingInput() {
  const board = buildStoryboardBoardModel({
    graphData,
    graphRevision: 1,
    connectedValuesByNodeId: new Map([
      ['target-widget', connectedPrompt],
      ['probe-target', connectedSummary],
    ]),
  })
  const cards = board.lanes.flatMap(lane => lane.cards)
  const target = cards.find(card => card.id === 'target-widget')
  const probeTarget = cards.find(card => card.id === 'probe-target')
  if (!target || !probeTarget) throw new Error(`expected connected target cards, got ${JSON.stringify(cards)}`)
  if (target.prompt || target.summary || target.output) {
    throw new Error(`expected connected text not to replace target-authored text, got ${JSON.stringify(target)}`)
  }
  if (target.sourceReferences?.length !== 1 || target.sourceReferences[0]?.label !== 'Source Widget Card') {
    throw new Error(`expected one deduplicated source Widget chip, got ${JSON.stringify(target.sourceReferences)}`)
  }
  if (target.sourceReferences[0]?.edgeIds.join(',') !== 'source-target-a,source-target-b') {
    throw new Error(`expected source chip to retain edge lineage, got ${JSON.stringify(target.sourceReferences[0])}`)
  }
  const targetTextModel = buildStoryboardCardTextModel(target)
  if (targetTextModel.primaryField.id !== 'prompt' || targetTextModel.primaryRaw !== '') {
    throw new Error(`expected an independent empty Prompt editor below the source chip, got ${JSON.stringify(targetTextModel)}`)
  }
  const probeTextModel = buildStoryboardCardTextModel(probeTarget)
  if (probeTextModel.primaryField.id !== 'summary' || probeTextModel.primaryRaw !== '') {
    throw new Error(`expected Probe-Tree to retain its independent Summary editor, got ${JSON.stringify(probeTextModel)}`)
  }

  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const activatedSourceNodeIds: string[] = []
  try {
    await act(async () => {
      root.render(<StoryboardCardMetaScrollRail card={target} onSourceReferenceActivate={reference => activatedSourceNodeIds.push(reference.nodeId)} />)
      await waitForFrames(dom.window, 4)
    })
    const chip = container.querySelector('[data-kg-storyboard-card-source-reference-chip="1"]')
    if (!(chip instanceof dom.window.HTMLElement)) throw new Error('expected source reference chip in the card metadata header')
    if (!(chip instanceof dom.window.HTMLButtonElement)) throw new Error('expected source reference chip to be an interactive button')
    if (chip.textContent?.trim() !== '←Source Widget Card') {
      throw new Error(`expected compact source title only, got ${JSON.stringify(chip.textContent)}`)
    }
    if (container.textContent?.includes(upstreamText)) throw new Error('expected source chip not to render upstream text')
    await act(async () => {
      chip.click()
      await waitForFrames(dom.window, 2)
    })
    if (activatedSourceNodeIds.join(',') !== 'source-widget') {
      throw new Error(`expected source chip click to activate its connected upstream node, got ${JSON.stringify(activatedSourceNodeIds)}`)
    }
  } finally {
    await act(async () => root.unmount())
    restore()
  }
}
