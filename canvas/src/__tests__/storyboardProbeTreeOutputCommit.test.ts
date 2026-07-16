import { commitStoryboardCardCanonicalText2d } from '@/components/StoryboardWidgetCanvas/storyboardCardCanonicalTextCommit2d'
import { buildStoryboardCardTextModel } from '@/components/StoryboardWidgetCanvas/storyboardCardTextModel'
import type { GraphData } from '@/lib/graph/types'

export function testStoryboardProbeTreeOutputCommitUpdatesDurableDraftAndCanonicalStore() {
  const cardId = 'probe-option'
  const nextOutput = 'An explicit, source-backed answer.'
  const textModel = buildStoryboardCardTextModel({
    summary: 'Which evidence should select this branch?',
    output: '',
    typeLabel: 'Probe-Tree Card',
  })
  if (textModel.secondaryField?.id !== 'output' || !textModel.secondaryEditable) {
    throw new Error(`expected Probe-Tree secondary text to use editable Output, got ${JSON.stringify(textModel)}`)
  }
  const graphData: GraphData = {
    type: 'flow',
    nodes: [{
      id: `frontmatter::${cardId}`,
      type: 'TextGeneration',
      label: 'Probe-Tree Card',
      properties: { response: 'stale alias', keep: 'yes' },
    }],
    edges: [],
  }
  let committedGraph: GraphData | null = null
  let canonicalStoreProperties: Record<string, unknown> | null = null
  const history: string[] = []
  commitStoryboardCardCanonicalText2d({
    addHistory: label => history.push(label),
    canonicalKey: textModel.secondaryField.canonicalKey,
    cardId,
    commitGraphData: next => { committedGraph = next },
    currentProperties: {},
    graphData,
    historyLabel: 'Storyboard output',
    nextValue: nextOutput,
    preserveFormatting: true,
    propertyKeys: textModel.secondaryField.propertyKeys,
    updateNode: (_id, patch) => {
      canonicalStoreProperties = (patch.properties || {}) as Record<string, unknown>
    },
  })
  const committedProperties = committedGraph?.nodes?.[0]?.properties || {}
  if (committedProperties.output !== nextOutput || canonicalStoreProperties?.output !== nextOutput) {
    throw new Error(`expected Output commit in durable draft and canonical store, got ${JSON.stringify({ committedProperties, canonicalStoreProperties })}`)
  }
  if ('response' in committedProperties || 'response' in (canonicalStoreProperties || {})) {
    throw new Error('expected Output commit to remove stale response aliases')
  }
  if (committedProperties.keep !== 'yes' || history.join('|') !== 'Storyboard output') {
    throw new Error(`expected Output commit to retain sibling properties and add one history entry, got ${JSON.stringify({ committedProperties, history })}`)
  }
}
