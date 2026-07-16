import { createStoryboardWidgetWorkflowPublicationTransaction } from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetWorkflowPublicationTransaction'
import type { GraphData } from '@/lib/graph/types'

export function testTerminalPublicationRepairsLaggingCanonicalAuthorityFromUnchangedDraft() {
  const draft: GraphData = {
    type: 'Graph',
    context: 'frontmatter-flow',
    nodes: [
      { id: 'n1', type: 'TextGeneration', label: 'Widget Card', properties: { prompt: '@knowgrph.probe-tree' } },
      {
        id: 'n2',
        type: 'RichMediaPanel',
        label: 'Probe-Tree Branches',
        properties: {
          output: '# Probe-Tree Branches',
          richMediaActiveTab: 'text',
          workflowOutputKey: 'probe-tree-branches',
        },
      },
    ],
    edges: [{ id: 'e1', source: 'n1', target: 'n2', label: 'probe-tree-branches', properties: {} }],
  }
  let published: GraphData | null = null
  let refreshCount = 0
  const transaction = createStoryboardWidgetWorkflowPublicationTransaction({
    readLiveDraftGraphData: () => draft,
    commitDraftGraphDataUpdate: () => { throw new Error('unchanged terminal draft must not take the draft-only path') },
    commitPublishedGraphData: graphData => { published = graphData },
    updateNode: () => undefined,
    scheduleWorkflowOutputEdgeRefresh: () => { refreshCount += 1 },
  })
  const committed = transaction?.finish({
    preferPublishedGraphCommit: true,
    updatedNodeIds: ['n2'],
  })
  if (!committed || published !== draft || refreshCount !== 1) {
    throw new Error(`expected explicit terminal publication to republish the current draft, got ${JSON.stringify({ committed, published: Boolean(published), refreshCount })}`)
  }
}
