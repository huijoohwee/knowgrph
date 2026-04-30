import type { MutableRefObject } from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { workspaceSourcePathKey } from '@/features/workspace-fs/syncToSourceFiles'
import type { WorkspaceEntry, WorkspacePath } from '@/features/workspace-fs/types'
import type { WorkspaceSourceIndex } from '@/features/workspace-fs/sourceIndex'
import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import type { TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'

export type FolderModeContract = 'sitemap' | 'user-journey'

export const MARKDOWN_LAYOUT_REQUEST_EVENT = 'kg:markdown-workspace-layout-request'
export const WORKSPACE_REALTIME_APPLY_DEBOUNCE_MS = 180
export const WORKSPACE_TOC_PARSE_MAX_CHARS = 320_000

export const EMPTY_WIDGET_REGISTRY: WidgetRegistryEntry[] = []
export const EMPTY_GRAPH_NODES: GraphNode[] = []
export const EMPTY_GRAPH_EDGES: GraphEdge[] = []
export const EMPTY_TOC_TOKENS: TokenWithLines[] = []

export const parseStringArray = (raw: unknown): string[] | null => {
  if (!Array.isArray(raw)) return null
  const out = raw.map(v => String(v || '').trim()).filter(Boolean)
  return out
}

export function findWorkspaceSourceFileByPath(path: WorkspacePath) {
  const key = workspaceSourcePathKey(path)
  const sourceFiles = Array.isArray(useGraphStore.getState().sourceFiles) ? useGraphStore.getState().sourceFiles : []
  return sourceFiles.find(file => String(file?.source?.path || '') === key) || null
}

export function parseYoutubeWorkspaceFrontmatter(
  text: string,
): { videoId: string; format: 'markdown' | 'json' } | null {
  const raw = String(text || '')
  if (!raw.startsWith('---')) return null
  const end = raw.indexOf('\n---')
  if (end < 0) return null
  const fm = raw.slice(0, end + 4)
  const readVal = (key: string): string => {
    const m = fm.match(new RegExp(`^${key}:\\s*(.+)\\s*$`, 'm'))
    const v = m ? String(m[1] || '').trim() : ''
    if (!v) return ''
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1)
    return v
  }
  const videoId = readVal('kgYoutubeVideoId')
  const formatRaw = readVal('kgYoutubeFormat')
  const format: 'markdown' | 'json' = formatRaw === 'json' ? 'json' : 'markdown'
  if (!videoId) return null
  return { videoId, format }
}

export function inferYoutubeVideoIdFromPath(path: string): string | null {
  const base = path.split('/').pop() || ''
  const m = base.match(/^(?:transcript|youtube)-([a-zA-Z0-9_-]{11})(?:\.(?:txt|md|markdown|json))?$/i)
  return m ? m[1] : null
}

export const areWorkspaceEntriesEqual = (a: WorkspaceEntry[], b: WorkspaceEntry[]): boolean => {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    const aa = a[i]
    const bb = b[i]
    if (aa === bb) continue
    if (!aa || !bb) return false
    if (aa.kind !== bb.kind) return false
    if (aa.path !== bb.path) return false
    if (String(aa.parentPath || '') !== String(bb.parentPath || '')) return false
    if (aa.name !== bb.name) return false
    if (String(aa.text || '') !== String(bb.text || '')) return false
    if (aa.updatedAtMs !== bb.updatedAtMs) return false
  }
  return true
}

export const areWorkspaceSourcesEqual = (a: WorkspaceSourceIndex, b: WorkspaceSourceIndex): boolean => {
  if (a === b) return true
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  for (const key of aKeys) {
    const aa = a[key]
    const bb = b[key]
    if (!aa || !bb) return false
    if (aa.kind !== bb.kind) return false
    if (aa.kind === 'url' && aa.url !== (bb.kind === 'url' ? bb.url : '')) return false
    if (aa.kind === 'local' && String(aa.originalName || '') !== String(bb.kind === 'local' ? bb.originalName || '' : '')) {
      return false
    }
  }
  return true
}

export const resolveWorkspaceDirtyState = (args: {
  path: WorkspacePath
  lastLoadedRef: MutableRefObject<{ path: WorkspacePath; text: string } | null>
  activeTextRef: MutableRefObject<string>
  userEditedActiveTextRef: MutableRefObject<boolean>
}): boolean => {
  const lastLoaded = args.lastLoadedRef.current
  return !!(
    args.userEditedActiveTextRef.current &&
    lastLoaded &&
    lastLoaded.path === args.path &&
    lastLoaded.text !== args.activeTextRef.current
  )
}
