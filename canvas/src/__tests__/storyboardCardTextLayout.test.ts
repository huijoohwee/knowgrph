import fs from 'node:fs'
import path from 'node:path'

import { buildStoryboardBoardModel } from '@/components/StoryboardCanvas/storyboardModel'
import type { GraphData } from '@/lib/graph/types'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

export function testStoryboardCardTextLayoutKeepsSemanticLabelsReadable() {
  const graphData: GraphData = {
    type: 'application/json',
    nodes: [
      {
        id: 'source-card',
        type: 'RuntimeProofGate',
        label: 'Source evidence',
        properties: {
          lane: 'Source',
          summary: 'Imported source evidence for a validation-ready storyboard card.',
          action: 'Review and approve the source evidence before generation.',
        },
      },
      {
        id: 'frame-card',
        type: 'StoryboardFrame',
        label: 'Storyboard frame',
        properties: {
          lane: 'Storyboard',
          summary: 'Frame-level storyboard card generated from approved source evidence.',
        },
      },
    ],
    edges: [{ id: 'source-to-frame', source: 'source-card', target: 'frame-card', label: 'produces', properties: {} }],
  }
  const board = buildStoryboardBoardModel({ graphData, graphRevision: 1 })
  const cards = board.lanes.flatMap(lane => lane.cards)
  assert(cards.find(card => card.id === 'source-card')?.typeLabel === 'Runtime Proof Gate', 'expected compact PascalCase type labels to render as readable semantic words')
  assert(cards.find(card => card.id === 'frame-card')?.typeLabel === 'Storyboard Frame', 'expected storyboard frame type labels to render as readable semantic words')
}

export function testStoryboardCardOverlayTextLayoutUsesReadableCardChrome() {
  const source = fs.readFileSync(path.resolve(process.cwd(), 'src/components/StoryboardWidgetCanvas/StoryboardCardOverlayLayer2d.tsx'), 'utf8')
  for (const snippet of [
    'data-kg-storyboard-card-title-row="1"',
    'max-w-[8.75rem] shrink-0 truncate rounded border',
    'grid-cols-[minmax(0,1fr)_minmax(4.75rem,24%)]',
    'flex min-h-0 flex-col gap-1.5 overflow-hidden',
    'line-clamp-3 select-none',
    'line-clamp-4',
    'mt-auto flex min-w-0 items-center gap-1 border-t pt-1',
  ]) {
    assert(source.includes(snippet), `expected Storyboard card overlay to keep readable text layout snippet: ${snippet}`)
  }
  assert(!source.includes('grid-rows-[auto_minmax(0,1fr)_auto]'), 'expected Storyboard card text column not to reserve a blank middle row that hides useful card copy')
}
