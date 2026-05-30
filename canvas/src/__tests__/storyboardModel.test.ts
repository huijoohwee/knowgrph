import { buildStoryboardBoardModel } from '@/components/StoryboardCanvas/storyboardModel'
import type { GraphData } from '@/lib/graph/types'

const makeGraph = (): GraphData => ({
  type: 'Graph',
  nodes: [
    {
      id: 'scene-1',
      label: 'Opening Scene',
      type: 'Scene',
      properties: {
        stage: 'Outline',
        summary: 'Set the problem and introduce the lead character.',
        location: 'Conference Room',
        timeOfDay: 'Monday',
        action: 'Designer and client review printed boards on the table.',
        dialogue: 'CLIENT: "Just a few small changes."',
        prompt: 'Conference room review with printed storyboard boards and marked-up notes.',
        style: 'Doodle',
        references: [
          'https://example.com/reference-a.jpg',
          'https://example.com/reference-b.jpg',
        ],
        tags: ['intro', 'hero'],
        media_url: 'https://example.com/opening.png',
        order: 1,
      },
    },
    {
      id: 'scene-2',
      label: 'Product Reveal',
      type: 'Scene',
      properties: {
        stage: 'Review',
        description: 'Reveal the product in context.',
        priority: 'High',
        videoUrl: 'https://example.com/reveal.mp4',
        order: 2,
      },
    },
    {
      id: 'root',
      label: 'Document Root',
      type: 'Document',
      properties: {
        heading: 'Storyboard Root',
      },
    },
  ],
  edges: [],
})

export function testStoryboardBoardModelProjectsSceneLikeNodesIntoLanes() {
  const board = buildStoryboardBoardModel({ graphData: makeGraph(), graphRevision: 4 })
  if (!board.semanticKey) throw new Error('expected storyboard board model to expose a semantic key')
  if (board.totalCards !== 2) throw new Error(`expected storyboard model to filter structural nodes, got ${board.totalCards}`)
  if (board.lanes.length !== 2) throw new Error(`expected two storyboard lanes, got ${board.lanes.length}`)
  const outlineLane = board.lanes.find(lane => lane.label === 'Outline')
  if (!outlineLane || outlineLane.cards.length !== 1) {
    throw new Error(`expected Outline lane with one card, got ${JSON.stringify(board.lanes)}`)
  }
  const reviewLane = board.lanes.find(lane => lane.label === 'Review')
  if (!reviewLane || reviewLane.cards[0]?.media?.kind !== 'video') {
    throw new Error(`expected Review lane video card, got ${JSON.stringify(board.lanes)}`)
  }
  const opening = outlineLane.cards[0]
  if (!opening.tags.includes('intro') || !opening.tags.includes('hero')) {
    throw new Error(`expected storyboard tags to preserve multi-value tags, got ${JSON.stringify(opening.tags)}`)
  }
  if (opening.slugline !== 'Conference Room - Monday') {
    throw new Error(`expected storyboard slugline to compose location and time, got ${opening.slugline}`)
  }
  if (!opening.action.includes('printed boards') || !opening.dialogue.includes('few small changes')) {
    throw new Error(`expected storyboard action/dialogue fields, got ${JSON.stringify(opening)}`)
  }
  if (opening.style !== 'Doodle' || !opening.prompt.includes('printed storyboard boards')) {
    throw new Error(`expected storyboard prompt/style fields, got ${JSON.stringify(opening)}`)
  }
  if (opening.references.length !== 2) {
    throw new Error(`expected storyboard references to preserve visual brief refs, got ${JSON.stringify(opening.references)}`)
  }
}

export function testStoryboardBoardModelSupportsUniversalNeutralAliases() {
  const board = buildStoryboardBoardModel({
    graphData: {
      type: 'Graph',
      nodes: [
        {
          id: 'step-1',
          label: 'Review Intake',
          type: 'Panel',
          properties: {
            group: 'Backlog',
            step: 7,
            context: 'Product Surface',
            state: 'Open Review',
            task: 'Collect comments, consolidate intent, and keep one canonical source of truth.',
            narration: 'Stakeholder: "Keep the review loop clear and neutral."',
            brief: 'Neutral product review board with compact cards, no project-specific assumptions.',
            theme: 'Neutral UI',
            assets: [
              'https://example.com/ref-ui-a.png',
              'https://example.com/ref-ui-b.png',
            ],
            documentUrl: 'https://example.com/review-brief',
          },
        },
      ],
      edges: [],
    },
    graphRevision: 9,
  })
  const card = board.lanes[0]?.cards[0]
  if (!card) throw new Error('expected neutral alias graph to project one storyboard card')
  if (board.lanes[0]?.label !== 'Backlog') {
    throw new Error(`expected lane alias group -> Backlog, got ${JSON.stringify(board.lanes)}`)
  }
  if (card.indexLabel !== '7') {
    throw new Error(`expected step alias to project index label, got ${card.indexLabel}`)
  }
  if (card.slugline !== 'Product Surface - Open Review') {
    throw new Error(`expected context/state aliases to compose slugline, got ${card.slugline}`)
  }
  if (!card.action.includes('canonical source of truth') || !card.dialogue.includes('review loop')) {
    throw new Error(`expected task/narration aliases to project action/dialogue, got ${JSON.stringify(card)}`)
  }
  if (card.style !== 'Neutral UI' || !card.prompt.includes('compact cards')) {
    throw new Error(`expected brief/theme aliases to project prompt/style, got ${JSON.stringify(card)}`)
  }
  if (card.references.length !== 2 || card.href !== 'https://example.com/review-brief') {
    throw new Error(`expected assets/documentUrl aliases to project references and href, got ${JSON.stringify(card)}`)
  }
}

export function testStoryboardBoardModelResolvesProviderVideoToRenderableEmbedAndThumbnail() {
  const videoId = ['Story', 'Board', '42'].join('')
  const watchUrl = ['https://www.youtube.com/watch', `?v=${videoId}&t=42`].join('')
  const board = buildStoryboardBoardModel({
    graphData: {
      type: 'Graph',
      nodes: [
        {
          id: 'video-source',
          label: 'Provider Video Source',
          type: 'StoryboardFrame',
          properties: {
            lane: 'Storyboard',
            mediaKind: 'video',
            mediaUrl: watchUrl,
            order: 1,
          },
        },
      ],
      edges: [],
    },
    graphRevision: 10,
  })
  const card = board.lanes[0]?.cards[0]
  if (!card) throw new Error('expected provider video source to project one storyboard card')
  if (card.media?.kind !== 'iframe' || !card.media.url.includes('/embed/') || card.media.url === watchUrl) {
    throw new Error(`expected provider video to resolve to renderable iframe media, got ${JSON.stringify(card.media)}`)
  }
  if (card.href !== watchUrl) {
    throw new Error(`expected card href to preserve source URL provenance, got ${card.href}`)
  }
  if (!card.references.some(reference => reference.kind === 'image' && reference.url.includes(`/vi/${videoId}/`))) {
    throw new Error(`expected provider video thumbnail image reference, got ${JSON.stringify(card.references)}`)
  }
}
