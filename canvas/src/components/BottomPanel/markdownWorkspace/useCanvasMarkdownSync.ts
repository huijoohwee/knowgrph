import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { WorkspaceEntry, WorkspacePath } from '@/features/workspace-fs/types'
import { ancestorPathsForWorkspacePath, normalizeWorkspacePath, workspaceDocumentKey } from '@/features/workspace-fs/path'
import { getDocumentLocationFromMetadata } from '@/lib/graph/markdownMetadata'
import type { MarkdownWorkspaceLayoutMode } from '@/features/markdown-explorer/workspaceUi'
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

const resolveNavigationMetadata = (
  args: {
    node: GraphNode | null
    edge: GraphEdge | null
    nodes: GraphNode[]
    edges: GraphEdge[]
  },
): Record<string, unknown> | null => {
  const { node, edge, nodes, edges } = args
  if (!node && edge) return (edge.metadata as Record<string, unknown>) || null
  if (!node) return null

  const base = (node.metadata as Record<string, unknown>) || null
  const type = String(node.type || '')
  if (type !== 'MermaidNode' && type !== 'InternalLink') return base

  const nodeId = String(node.id || '')
  if (!nodeId) return base

  const nodeById = new Map<string, GraphNode>()
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    const id = String(n?.id || '')
    if (id && !nodeById.has(id)) nodeById.set(id, n)
  }

  const pointsToTargets: GraphNode[] = []
  for (let i = 0; i < edges.length; i += 1) {
    const e = edges[i]
    if (!e) continue
    if (String(e.label || '') !== 'pointsTo') continue
    if (String(e.source || '') !== nodeId) continue
    const targetId = String(e.target || '')
    if (!targetId) continue
    const t = nodeById.get(targetId)
    if (t) pointsToTargets.push(t)
  }

  if (pointsToTargets.length === 0) return base

  const pickTargetMeta = (t: GraphNode | null): Record<string, unknown> | null => {
    if (!t) return null
    const meta = (t.metadata as Record<string, unknown>) || null
    return meta
  }

  for (let i = 0; i < pointsToTargets.length; i += 1) {
    const t = pointsToTargets[i]
    if (String(t.type || '') !== 'Anchor') continue
    const meta = pickTargetMeta(t)
    if (meta) return meta
  }
  for (let i = 0; i < pointsToTargets.length; i += 1) {
    const t = pointsToTargets[i]
    if (String(t.type || '') !== 'InternalLink') continue
    const tid = String(t.id || '')
    if (!tid) continue
    for (let j = 0; j < edges.length; j += 1) {
      const e = edges[j]
      if (!e) continue
      if (String(e.label || '') !== 'pointsTo') continue
      if (String(e.source || '') !== tid) continue
      const targetId = String(e.target || '')
      if (!targetId) continue
      const tt = nodeById.get(targetId)
      if (!tt || String(tt.type || '') !== 'Anchor') continue
      const meta = pickTargetMeta(tt)
      if (meta) return meta
    }
  }
  for (let i = 0; i < pointsToTargets.length; i += 1) {
    const t = pointsToTargets[i]
    if (String(t.type || '') !== 'Section') continue
    const meta = pickTargetMeta(t)
    if (meta) return meta
  }

  return base
}

export function useCanvasMarkdownSync(args: {
  active: boolean
  entries: WorkspaceEntry[]
  activePath: WorkspacePath | null
  setActivePathSafe: (path: WorkspacePath) => void
  setExpandedPaths: React.Dispatch<React.SetStateAction<Set<string>>>
  layoutMode: MarkdownWorkspaceLayoutMode
  setLayoutMode: (mode: MarkdownWorkspaceLayoutMode) => void
  revealLineInEditor: (line: number, endLine?: number) => void
  setStatusError: StatusHelpers['setStatusError']
}) {
  const {
    active,
    entries,
    activePath,
    setActivePathSafe,
    setExpandedPaths,
    layoutMode,
    setLayoutMode,
    revealLineInEditor,
    setStatusError,
  } = args

  const selectionSource = useGraphStore(s => s.selectionSource)
  const selectedNodeId = useGraphStore(s => s.selectedNodeId)
  const selectedEdgeId = useGraphStore(s => s.selectedEdgeId)
  const graphNodes = useGraphStore(s => ((s.graphData as GraphData | null)?.nodes as GraphNode[] | undefined) || EMPTY_GRAPH_NODES)
  const graphEdges = useGraphStore(s => ((s.graphData as GraphData | null)?.edges as GraphEdge[] | undefined) || EMPTY_GRAPH_EDGES)
  const docLocationRevision = useGraphStore(s => (s.docLocationRevision || 0) as number)

  const graphNodesRef = React.useRef<GraphNode[]>(graphNodes)
  React.useEffect(() => {
    graphNodesRef.current = graphNodes
  }, [graphNodes])
  const graphEdgesRef = React.useRef<GraphEdge[]>(graphEdges)
  React.useEffect(() => {
    graphEdgesRef.current = graphEdges
  }, [graphEdges])

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

    const nodes = Array.isArray(graphNodesRef.current) ? graphNodesRef.current : []
    const edges = Array.isArray(graphEdgesRef.current) ? graphEdgesRef.current : []
    const node = nodeId ? nodes.find(n => String(n.id || '') === nodeId) : null
    const edge = !node && edgeId ? edges.find(e => String(e.id || '') === edgeId) : null
    const meta = resolveNavigationMetadata({ node, edge, nodes, edges })
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
    if (layoutMode !== 'split' && layoutMode !== 'editor') setLayoutMode('split')
    revealLineInEditor(location.lineStart, location.lineEnd)
  }, [
    active,
    activePath,
    entries,
    layoutMode,
    revealLineInEditor,
    selectedEdgeId,
    selectedNodeId,
    selectionSource,
    docLocationRevision,
    setActivePathSafe,
    setExpandedPaths,
    setLayoutMode,
    setStatusError,
  ])
}
