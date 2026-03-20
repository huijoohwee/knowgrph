import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { WorkspaceEntry, WorkspacePath } from '@/features/workspace-fs/types'
import { ancestorPathsForWorkspacePath, normalizeWorkspacePath, workspaceDocumentKey } from '@/features/workspace-fs/path'
import { getDocumentLocationFromMetadata } from '@/lib/graph/markdownMetadata'
import type { MarkdownWorkspaceLayoutMode } from '@/features/markdown-explorer/workspaceUi'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import type { StatusHelpers } from './useWorkspaceFileActions/types'

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
  const graphData = useGraphStore(s => s.graphData) as GraphData | null
  const setWorkspaceViewMode = useGraphStore(s => s.setWorkspaceViewMode)

  const lastCanvasSyncSigRef = React.useRef<string>('')

  React.useEffect(() => {
    if (selectionSource !== 'canvas') return
    if (!graphData) return

    const nodeId = selectedNodeId ? String(selectedNodeId) : ''
    const edgeId = !nodeId && selectedEdgeId ? String(selectedEdgeId) : ''
    const sig = nodeId ? `node:${nodeId}` : edgeId ? `edge:${edgeId}` : ''
    if (!sig) return
    if (lastCanvasSyncSigRef.current === sig) return
    lastCanvasSyncSigRef.current = sig

    const nodes = Array.isArray(graphData.nodes) ? (graphData.nodes as GraphNode[]) : []
    const edges = Array.isArray(graphData.edges) ? (graphData.edges as GraphEdge[]) : []
    const node = nodeId ? nodes.find(n => String(n.id || '') === nodeId) : null
    const edge = !node && edgeId ? edges.find(e => String(e.id || '') === edgeId) : null
    const meta = node?.metadata ?? edge?.metadata ?? null
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
    setWorkspaceViewMode('editor')
    if (layoutMode !== 'split' && layoutMode !== 'editor') setLayoutMode('split')
    revealLineInEditor(location.lineStart, location.lineEnd)
  }, [
    activePath,
    entries,
    graphData,
    layoutMode,
    revealLineInEditor,
    selectedEdgeId,
    selectedNodeId,
    selectionSource,
    setActivePathSafe,
    setExpandedPaths,
    setLayoutMode,
    setStatusError,
    setWorkspaceViewMode,
  ])
}
