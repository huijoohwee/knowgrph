import { applyPulledKnowgrphStorageChangesToSourceFiles } from '@/features/source-files/sourceFilesInboundStorageApply'
import { useGraphStore } from '@/hooks/useGraphStore'

export function testPulledKnowgrphStorageChangesMaterializeIntoVisibleSourceFilesAndComposeGraph() {
  useGraphStore.getState().resetAll()
  useGraphStore.getState().setSourceFiles([])

  const result = applyPulledKnowgrphStorageChangesToSourceFiles({
    workspaceId: 'kgws:remote-visible',
    changes: {
      documents: [
        {
          id: 'sf:remote_demo',
          workspaceId: 'kgws:remote-visible',
          canonicalPath: 'workspace:/remote-demo.md',
          title: 'remote-demo.md',
          docType: 'markdown',
          lang: null,
          graphId: 'sf-graph:remote_demo',
          sourceKind: 'markdown',
          contentMd: '# Remote Demo',
          contentHash: 'sha256:remote-demo',
          parserVersion: 'markdown-frontmatter',
          revision: 2,
          updatedAtMs: 1_777_200_000_000,
          deleted: false,
        },
      ],
      documentChunks: [],
      graphSnapshots: [
        {
          id: 'sf-graph:remote_demo',
          documentId: 'sf:remote_demo',
          workspaceId: 'kgws:remote-visible',
          graphRevision: 4,
          graphHash: 'sha256:remote-graph',
          graphJson: {
            type: 'Graph',
            nodes: [{ id: 'remote-node', label: 'Remote Node' }],
            edges: [],
            metadata: {},
          },
          layoutJson: null,
          derivedFromDocumentRevision: 2,
          updatedAtMs: 1_777_200_000_100,
        },
      ],
    },
  })

  if (!result.applied) throw new Error('expected pulled storage changes to apply into visible source files')
  const store = useGraphStore.getState()
  const file = store.sourceFiles.find(entry => entry.id === 'remote_demo') || null
  if (!file) throw new Error('expected pulled remote document to become a visible source file')
  if (String(file.text || '') !== '# Remote Demo') throw new Error('expected visible source file text to reflect pulled remote markdown')
  if ((file.parsedGraphData?.nodes || []).length !== 1) throw new Error('expected visible source file to carry pulled graph snapshot data')
  if (!Array.isArray(store.graphData?.nodes) || store.graphData.nodes.length < 1) {
    throw new Error('expected pulled remote source file to recompose into a non-empty visible canvas graph automatically')
  }
}

export function testPulledKnowgrphStorageDeletesRemoveVisibleSourceFiles() {
  useGraphStore.getState().resetAll()
  useGraphStore.getState().setSourceFiles([
    {
      id: 'remote_demo',
      name: 'remote-demo.md',
      text: '# Remote Demo',
      enabled: true,
      status: 'parsed',
      parsedParserId: 'markdown-frontmatter',
      parsedTextHash: 'sha256:remote-demo',
      parsedGraphRevision: 1,
      parsedGraphData: {
        type: 'Graph',
        nodes: [{ id: 'remote-node', label: 'Remote Node', type: 'Thing', properties: {} }],
        edges: [],
        metadata: {},
      },
      source: { kind: 'local', path: 'workspace:/remote-demo.md' },
    },
  ])

  const result = applyPulledKnowgrphStorageChangesToSourceFiles({
    workspaceId: 'kgws:remote-visible',
    changes: {
      documents: [
        {
          id: 'sf:remote_demo',
          workspaceId: 'kgws:remote-visible',
          canonicalPath: 'workspace:/remote-demo.md',
          title: 'remote-demo.md',
          docType: 'markdown',
          lang: null,
          graphId: 'sf-graph:remote_demo',
          sourceKind: 'markdown',
          contentMd: '# Remote Demo',
          contentHash: 'sha256:remote-demo',
          parserVersion: 'markdown-frontmatter',
          revision: 3,
          updatedAtMs: 1_777_200_000_200,
          deleted: true,
        },
      ],
      documentChunks: [],
      graphSnapshots: [],
    },
  })

  if (!result.applied) throw new Error('expected pulled delete to apply into visible source files')
  const file = useGraphStore.getState().sourceFiles.find(entry => entry.id === 'remote_demo') || null
  if (file) throw new Error('expected pulled delete tombstone to remove the visible source file')
}
