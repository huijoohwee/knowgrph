import type { GraphData } from '@/lib/graph/types'
import { useGraphStore } from '@/hooks/useGraphStore'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import {
  applyComposedGraphFromSourceFiles,
  applyGraphOwnerComposedGraphFromSourceFiles,
} from '@/features/source-files/applyComposedGraphFromSourceFiles'
import {
  buildSourceFilesCompositionSignature,
  isWorkspaceBackedSourceFile,
} from '@/features/source-files/sourceFilesSignatures'

const graphWithNode = (id: string, label: string): GraphData => ({
  type: 'Graph',
  nodes: [{ id, label, type: 'Thing', properties: {} }],
  edges: [],
  metadata: {},
})

export function testSourceFilesCompositionSignatureSkipsWorkspaceBackedByDefault() {
  const localFile = {
    id: 'source:local',
    name: 'local.md',
    text: '# Local',
    enabled: true,
    status: 'parsed',
    parsedTextHash: 'local-hash',
    parsedGraphData: graphWithNode('local', 'Local'),
    source: { kind: 'local', path: 'docs/local.md' },
  }
  const workspaceFile = {
    id: 'source:workspace',
    name: 'workspace.md',
    text: '# Workspace A',
    enabled: true,
    status: 'parsed',
    parsedTextHash: 'workspace-hash-a',
    parsedGraphData: graphWithNode('workspace-a', 'Workspace A'),
    source: { kind: 'local', path: 'workspace:/docs/workspace.md' },
  }
  const changedWorkspaceFile = {
    ...workspaceFile,
    text: '# Workspace B',
    parsedTextHash: 'workspace-hash-b',
    parsedGraphData: graphWithNode('workspace-b', 'Workspace B'),
  }

  if (!isWorkspaceBackedSourceFile(workspaceFile)) {
    throw new Error('expected shared source file helper to detect workspace-backed source paths')
  }
  if (isWorkspaceBackedSourceFile(localFile)) {
    throw new Error('expected shared source file helper to leave persistable source paths outside workspace-backed composition')
  }

  const baseDefaultSignature = buildSourceFilesCompositionSignature([localFile, workspaceFile])
  const changedDefaultSignature = buildSourceFilesCompositionSignature([localFile, changedWorkspaceFile])
  if (changedDefaultSignature !== baseDefaultSignature) {
    throw new Error('expected default composition signature to ignore workspace-backed source churn')
  }

  const baseWithWorkspaceSignature = buildSourceFilesCompositionSignature(
    [localFile, workspaceFile],
    { includeWorkspaceBacked: true, intent: 'explicit-graph-owner' },
  )
  const changedWithWorkspaceSignature = buildSourceFilesCompositionSignature(
    [localFile, changedWorkspaceFile],
    { includeWorkspaceBacked: true, intent: 'explicit-graph-owner' },
  )
  if (changedWithWorkspaceSignature === baseWithWorkspaceSignature) {
    throw new Error('expected explicit workspace-backed composition signatures to track workspace text/graph changes')
  }

  const ignoredImplicitWorkspaceSignature = buildSourceFilesCompositionSignature(
    [localFile, workspaceFile],
    { includeWorkspaceBacked: true },
  )
  if (ignoredImplicitWorkspaceSignature !== baseDefaultSignature) {
    throw new Error('expected workspace-backed composition signatures to require explicit graph-owner intent')
  }
}

export function testComposedGraphApplySkipsWorkspaceBackedLayersByDefault() {
  const bootstrap = initJsdomHarness('<!doctype html><html><body></body></html>')
  try {
    const store = useGraphStore.getState()
    store.resetAll()
    store.clearSourceFiles()
    store.setGraphData({ type: 'Graph', nodes: [], edges: [], metadata: {} } as GraphData)
    store.addSourceFile({
      id: 'source:local',
      name: 'local.md',
      text: '# Local',
      enabled: true,
      status: 'parsed',
      parsedTextHash: 'local-hash',
      parsedGraphData: graphWithNode('local', 'Local'),
      source: { kind: 'local', path: 'docs/local.md' },
    })
    store.addSourceFile({
      id: 'source:workspace',
      name: 'workspace.md',
      text: '# Workspace',
      enabled: true,
      status: 'parsed',
      parsedTextHash: 'workspace-hash',
      parsedGraphData: graphWithNode('workspace', 'Workspace'),
      source: { kind: 'local', path: 'workspace:/docs/workspace.md' },
    })

    applyComposedGraphFromSourceFiles()
    const defaultNodeIds = useGraphStore.getState().graphData.nodes.map(node => node.id).join('|')
    if (defaultNodeIds !== 'source:local::local') {
      throw new Error(`expected default composition to skip workspace-backed layers, got ${defaultNodeIds}`)
    }

    applyComposedGraphFromSourceFiles({ includeWorkspaceBacked: true })
    const ignoredImplicitNodeIds = useGraphStore.getState().graphData.nodes.map(node => node.id).join('|')
    if (ignoredImplicitNodeIds !== 'source:local::local') {
      throw new Error(`expected workspace-backed compose to require explicit graph-owner intent, got ${ignoredImplicitNodeIds}`)
    }

    applyGraphOwnerComposedGraphFromSourceFiles()
    const explicitNodeIds = useGraphStore.getState().graphData.nodes.map(node => node.id).join('|')
    if (explicitNodeIds !== 'source:local::local|source:workspace::workspace') {
      throw new Error(`expected explicit workspace-backed composition to include workspace layers, got ${explicitNodeIds}`)
    }
  } finally {
    bootstrap.restore()
  }
}

export function testComposedWorkspaceBackedGraphApplyDoesNotCarryForwardPreviousLayoutStateAcrossContentChanges() {
  const bootstrap = initJsdomHarness('<!doctype html><html><body></body></html>')
  try {
    const store = useGraphStore.getState()
    store.resetAll()
    store.clearSourceFiles()
    store.setDocumentStructureBaselineLock(false)
    store.setGraphData({ type: 'Graph', nodes: [], edges: [], metadata: {} } as GraphData)
    store.addSourceFile({
      id: 'source:workspace',
      name: 'workspace.md',
      text: '# Workspace A',
      enabled: true,
      status: 'parsed',
      parsedTextHash: 'workspace-hash-a',
      parsedGraphData: {
        type: 'Graph',
        nodes: [{ id: 'workspace', label: 'Workspace A', type: 'Thing', x: 10, y: 20, properties: {} }],
        edges: [],
        metadata: { kind: 'frontmatter-flow', source: 'workspace:/docs/workspace.md', sourceLayerHash: 'doc-a' },
      } as GraphData,
      source: { kind: 'local', path: 'workspace:/docs/workspace.md' },
    })

    applyGraphOwnerComposedGraphFromSourceFiles()
    store.setDesignFramePosMany({ 'source:workspace::workspace': { x: 120, y: 220 } })
    store.setFlowWidgetPinnedByNodeId({ 'source:workspace::workspace': true })
    store.setFlowWidgetPosByNodeId({ 'source:workspace::workspace': { top: 300, left: 420 } })
    store.setFlowWidgetWorldPosByNodeId({ 'source:workspace::workspace': { x: 12, y: 24 } })

    store.setSourceFiles([
      {
        id: 'source:workspace',
        name: 'workspace.md',
        text: '# Workspace B',
        enabled: true,
        status: 'parsed',
        parsedTextHash: 'workspace-hash-b',
        parsedGraphData: {
          type: 'Graph',
          nodes: [{ id: 'workspace', label: 'Workspace B', type: 'Thing', x: 640, y: 360, properties: { version: 'b' } }],
          edges: [],
          metadata: { kind: 'frontmatter-flow', source: 'workspace:/docs/workspace.md', sourceLayerHash: 'doc-b' },
        } as GraphData,
        source: { kind: 'local', path: 'workspace:/docs/workspace.md' },
      },
    ] as never)

    applyGraphOwnerComposedGraphFromSourceFiles()
    const after = useGraphStore.getState()
    if (after.designFramePosById['source:workspace::workspace'] !== undefined) {
      throw new Error('expected composed workspace-backed content changes to reset design-frame layout carry-forward')
    }
    if (after.flowWidgetPinnedByNodeId['source:workspace::workspace'] !== undefined) {
      throw new Error('expected composed workspace-backed content changes to reset pinned widget carry-forward')
    }
    if (after.flowWidgetPosByNodeId['source:workspace::workspace'] !== undefined) {
      throw new Error('expected composed workspace-backed content changes to reset widget screen-position carry-forward')
    }
    if (after.flowWidgetWorldPosByNodeId['source:workspace::workspace'] !== undefined) {
      throw new Error('expected composed workspace-backed content changes to reset widget world-position carry-forward')
    }
  } finally {
    bootstrap.restore()
  }
}
