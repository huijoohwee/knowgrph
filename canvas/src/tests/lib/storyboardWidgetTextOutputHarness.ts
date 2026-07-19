import { createStoryboardWidgetWorkflowRichMediaPublishers } from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetWorkflowRichMediaPublication'
import type { GraphData } from '@/lib/graph/types'

export function createStoryboardWidgetTextOutputHarness(
  initialGraph: GraphData,
  storeGraph: GraphData = initialGraph,
  allowCreateRichMediaPanel = true,
  options: { commitPublishedGraphData?: boolean } = {},
) {
  let draft = initialGraph
  let draftCommitCount = 0
  let publishedCommitCount = 0
  const resolveNode = (nodeId: string) => draft.nodes.find(node => String(node.id) === nodeId)
    || storeGraph.nodes.find(node => String(node.id) === nodeId)
    || null
  const publishers = createStoryboardWidgetWorkflowRichMediaPublishers({
    context: {
      draftGraph: initialGraph,
      renderGraph: initialGraph,
      baseGraph: initialGraph,
      storeGraph,
      draftNodes: initialGraph.nodes,
      renderNodes: initialGraph.nodes,
      baseNodes: initialGraph.nodes,
      storeNodes: storeGraph.nodes,
      draftNodeById: new Map(initialGraph.nodes.map(node => [String(node.id), node])),
      renderNodeById: new Map(initialGraph.nodes.map(node => [String(node.id), node])),
      baseNodeById: new Map(initialGraph.nodes.map(node => [String(node.id), node])),
      storeNodeById: new Map(storeGraph.nodes.map(node => [String(node.id), node])),
    } as never,
    graphForRun: initialGraph,
    allowCreateRichMediaPanel,
    withRunLayoutMutationGuard: run => run(),
    scheduleWorkflowOutputEdgeRefresh: () => undefined,
    readLiveDraftGraphData: () => draft,
    appendDraftNode: () => { throw new Error('text publication must use its atomic transaction') },
    commitDraftGraphDataUpdate: (_current, next) => {
      draftCommitCount += 1
      draft = next
    },
    ...(options.commitPublishedGraphData === false ? {} : { commitPublishedGraphData: (next: GraphData) => {
      publishedCommitCount += 1
      draft = next
    } }),
    updateNode: (id, patch) => {
      draft = { ...draft, nodes: draft.nodes.map(node => String(node.id) === id ? { ...node, ...patch } : node) }
    },
    resolveNodeByIdAcrossGraphs: resolveNode,
  })
  return {
    publishers,
    readGraph: () => draft,
    readCommitCounts: () => ({ draft: draftCommitCount, published: publishedCommitCount }),
  }
}
