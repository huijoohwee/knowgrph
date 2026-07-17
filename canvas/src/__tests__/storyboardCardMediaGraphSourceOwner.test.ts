import { syncActiveMarkdownDocumentTextFromParsedGraph } from '@/hooks/store/graph-data-slice/graphDataFrontmatterFlowSync'
import type { GraphData } from '@/lib/graph/types'
import {
  resolveStoryboardCardMediaGraphSourceOwner,
  shouldUpdateStoryboardCardMediaGraphActiveDocument,
} from '@/components/StoryboardWidgetCanvas/runtime/storyboardCardMediaGraphSourceOwner'

const OWNER_PATH = '/docs/workflow.md'
const GENERATED_PATH = '/docs/generated-output.md'

const ownerSourceText = [
  '---',
  'flow:',
  '  nodes:',
  '    - id: {key: id, type: string, value: n1}',
  '      type: {key: type, type: string, value: TextGeneration}',
  '      label: {key: label, type: string, value: Widget Card}',
  '      output: {key: output, type: string, value: ""}',
  '  edges: []',
  '---',
].join('\n')

export function testStoryboardCardMediaGraphPersistenceKeepsSemanticSourceOwner() {
  const generatedArtifactText = '# Generated output\n\nThis file is not the Canvas graph owner.'
  const graphData: GraphData = {
    type: 'Graph',
    nodes: [{
      id: 'n1',
      type: 'TextGeneration',
      label: 'Widget Card',
      properties: { output: 'Semantic run result' },
    }],
    edges: [],
    metadata: { kind: 'frontmatter-flow' },
  }
  const sourceFiles = [
    {
      id: 'workflow-source',
      enabled: true,
      name: 'workflow.md',
      text: ownerSourceText,
      source: { kind: 'local', path: OWNER_PATH },
    },
    {
      id: 'generated-output',
      enabled: true,
      name: 'generated-output.md',
      text: generatedArtifactText,
      source: { kind: 'local', path: GENERATED_PATH },
    },
  ]
  const ownerResolution = resolveStoryboardCardMediaGraphSourceOwner({
    state: {
      markdownDocumentName: GENERATED_PATH,
      markdownDocumentText: generatedArtifactText,
      sourceFiles,
    } as never,
    sourceOwner: {
      documentName: OWNER_PATH,
      documentText: ownerSourceText,
    },
  })
  const synced = syncActiveMarkdownDocumentTextFromParsedGraph({
    state: ownerResolution.state,
    sourceFiles: ownerResolution.state.sourceFiles,
    parsedGraphData: graphData,
  })
  const syncedOwner = synced.sourceFiles.find(file => file.id === 'workflow-source')
  const untouchedArtifact = synced.sourceFiles.find(file => file.id === 'generated-output')
  if (
    ownerResolution.ownerPath !== OWNER_PATH
    || ownerResolution.state.markdownDocumentName !== OWNER_PATH
    || ownerResolution.state.markdownDocumentText !== ownerSourceText
    || !synced.accepted
    || !String(syncedOwner?.text || '').includes('Semantic run result')
    || untouchedArtifact?.text !== generatedArtifactText
    || shouldUpdateStoryboardCardMediaGraphActiveDocument({ currentDocumentName: GENERATED_PATH, ownerPath: OWNER_PATH })
    || !shouldUpdateStoryboardCardMediaGraphActiveDocument({ currentDocumentName: OWNER_PATH, ownerPath: OWNER_PATH })
  ) {
    throw new Error(`expected graph persistence to update only its semantic source owner, got ${JSON.stringify({ ownerResolution, synced })}`)
  }
}
