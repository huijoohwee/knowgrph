import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { WorkspaceEntry, WorkspacePath } from '@/features/workspace-fs/types'
import { ancestorPathsForWorkspacePath, normalizeWorkspacePath, workspaceDocumentKey } from '@/features/workspace-fs/path'
import {
  getDocumentLocationFromMetadata,
  resolveMarkdownNavigationMetadata,
} from '@/lib/graph/markdownMetadata'
import { getCachedGraphLookup } from '@/lib/graph/lookupCache'
import { buildScopedGraphSemanticKey } from '@/lib/graph/semanticKey'
import { hashScopedStringArraySignature, hashSignatureParts } from '@/lib/hash/signature'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import type { StatusHelpers } from './useWorkspaceFileActions/types'

const EMPTY_GRAPH_NODES: GraphNode[] = []
const EMPTY_GRAPH_EDGES: GraphEdge[] = []

const stripLineFragment = (raw: string) => {
  const text = String(raw || '').trim()
  if (!text) return ''
  const hashIndex = text.indexOf('#')
  if (hashIndex < 0) return text
  return text.slice(0, hashIndex).trim()
}

const normalizeDocumentPathKey = (raw: unknown) => {
  const key = stripLineFragment(String(raw || '')).replace(/^\/+/, '').trim()
  return key
}

const findWorkspacePathForDocumentKey = (entries: WorkspaceEntry[], docKey: string): WorkspacePath | null => {
  const normalizedKey = normalizeDocumentPathKey(docKey)
  if (!normalizedKey) return null

  let exact: WorkspacePath | null = null
  let suffix: WorkspacePath | null = null
  let suffixLen = Number.POSITIVE_INFINITY

  for (const e of entries) {
    if (e.kind !== 'file') continue
    const key = workspaceDocumentKey(e.path)
    if (!key) continue
    if (key === normalizedKey) {
      exact = e.path
      break
    }
    if (key.endsWith(`/${normalizedKey}`) || key.endsWith(normalizedKey)) {
      const len = key.length
      if (len < suffixLen) {
        suffixLen = len
        suffix = e.path
      }
    }
  }
  return exact || suffix
}

export function useCanvasMarkdownSync(args: {
  active: boolean
  entries: WorkspaceEntry[]
  activePath: WorkspacePath | null
  setActivePathSafe: (path: WorkspacePath) => void
  setExpandedPaths: React.Dispatch<React.SetStateAction<Set<string>>>
  revealLineInEditor: (line: number, endLine?: number) => void
  setStatusError: StatusHelpers['setStatusError']
}) {
  const {
    active,
    entries,
    activePath,
    setActivePathSafe,
    setExpandedPaths,
    revealLineInEditor,
    setStatusError,
  } = args

  const selectionSource = useGraphStore(s => s.selectionSource)
  const selectedNodeId = useGraphStore(s => s.selectedNodeId)
  const selectedEdgeId = useGraphStore(s => s.selectedEdgeId)
  const graphNodes = useGraphStore(s => ((s.graphData as GraphData | null)?.nodes as GraphNode[] | undefined) || EMPTY_GRAPH_NODES)
  const graphEdges = useGraphStore(s => ((s.graphData as GraphData | null)?.edges as GraphEdge[] | undefined) || EMPTY_GRAPH_EDGES)
  const graphDataRevision = useGraphStore(s => (s.graphDataRevision || 0) as number)
  const docLocationRevision = useGraphStore(s => (s.docLocationRevision || 0) as number)

  const graphLookupSemanticKey = React.useMemo(() => {
    const nodeIdsKey = hashScopedStringArraySignature(
      'canvas-markdown-sync-node-ids',
      graphNodes.map(node => String(node?.id || '').trim()).filter(Boolean),
    )
    const edgeIdsKey = hashScopedStringArraySignature(
      'canvas-markdown-sync-edge-ids',
      graphEdges.map(edge => String(edge?.id || '').trim()).filter(Boolean),
    )
    return buildScopedGraphSemanticKey('canvas-markdown-sync-graph', {
      graphRevision: graphDataRevision,
      graphSemanticKey: hashSignatureParts([nodeIdsKey, edgeIdsKey]),
    })
  }, [graphDataRevision, graphEdges, graphNodes])

  const graphLookup = React.useMemo(() => {
    if (graphNodes.length === 0 && graphEdges.length === 0) return null
    return getCachedGraphLookup({
      cacheScope: 'canvas-markdown-sync-graph',
      graphData: {
        type: 'Graph',
        nodes: graphNodes,
        edges: graphEdges,
      } as GraphData,
      graphRevision: graphDataRevision,
      graphSemanticKey: graphLookupSemanticKey,
      preferCurrentGraphDataRefs: true,
    })
  }, [graphDataRevision, graphEdges, graphLookupSemanticKey, graphNodes])

  const graphLookupRef = React.useRef(graphLookup)
  React.useEffect(() => {
    graphLookupRef.current = graphLookup
  }, [graphLookup])

  const lastCanvasSyncSigRef = React.useRef<string>('')

  React.useEffect(() => {
    if (!active) return
    if (selectionSource !== 'canvas') return

    const nodeId = selectedNodeId ? String(selectedNodeId) : ''
    const edgeId = !nodeId && selectedEdgeId ? String(selectedEdgeId) : ''
    const sig = nodeId ? `node:${nodeId}` : edgeId ? `edge:${edgeId}` : ''
    if (!sig) return
    if (lastCanvasSyncSigRef.current === sig) return
    lastCanvasSyncSigRef.current = sig

    const lookup = graphLookupRef.current
    const node = nodeId ? lookup?.nodeById.get(nodeId) || null : null
    const edge = !node && edgeId ? lookup?.edgeById.get(edgeId) || null : null
    const meta = resolveMarkdownNavigationMetadata({
      node,
      edge,
      graphLookup: lookup,
    })
    const location = getDocumentLocationFromMetadata(meta)
    if (!location) {
      return
    }

    const docKey = normalizeDocumentPathKey(location.documentPath)
    const targetPath = findWorkspacePathForDocumentKey(entries, docKey)
    if (!targetPath) {
      setStatusError(`Missing file: ${docKey}`, { ttlMs: 3500, dismissible: true })
      return
    }

    const normalizedTarget = normalizeWorkspacePath(targetPath)
    if (activePath !== normalizedTarget) {
      setExpandedPaths(prev => {
        const next = new Set(prev)
        for (const ancestor of ancestorPathsForWorkspacePath(normalizedTarget)) next.add(ancestor)
        return next
      })
      setActivePathSafe(normalizedTarget)
    }
    revealLineInEditor(location.lineStart, location.lineEnd)
  }, [
    active,
    activePath,
    entries,
    revealLineInEditor,
    selectedEdgeId,
    selectedNodeId,
    selectionSource,
    docLocationRevision,
    setActivePathSafe,
    setExpandedPaths,
    setStatusError,
  ])
}
