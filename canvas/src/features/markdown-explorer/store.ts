import { create } from 'zustand'
import type { WorkspacePath } from '@/features/workspace-fs/types'
import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import { LS_KEYS } from '@/lib/config'
import { lsJson, lsSetJson } from '@/lib/persistence'
import { toCanonicalKgcWorkspacePath } from '@/features/chat/chatHistoryWorkspace.paths'

type MarkdownExplorerState = {
  activePath: WorkspacePath | null
  requestedRevealLine: number | null
  lastSetActivePath: { path: WorkspacePath; atMs: number } | null
  setActivePath: (path: WorkspacePath | null) => void
  requestRevealLine: (line: number | null) => void
}

export const useMarkdownExplorerStore = create<MarkdownExplorerState>(set => ({
  activePath: lsJson(
    LS_KEYS.markdownExplorerActivePath,
    null as WorkspacePath | null,
    (raw) => {
      const v = typeof raw === 'string' ? raw : null
      if (!v) return null
      try {
        return normalizeWorkspacePath(v as WorkspacePath)
      } catch {
        return null
      }
    },
  ),
  requestedRevealLine: null,
  lastSetActivePath: null,
  setActivePath: (path: WorkspacePath | null) => {
    const normalized = path ? toCanonicalKgcWorkspacePath(normalizeWorkspacePath(path)) : null
    lsSetJson(LS_KEYS.markdownExplorerActivePath, normalized)
    set({
      activePath: normalized,
      lastSetActivePath: normalized ? { path: normalized, atMs: Date.now() } : null,
    })
  },
  requestRevealLine: (line: number | null) =>
    set({ requestedRevealLine: typeof line === 'number' && Number.isFinite(line) ? Math.max(1, Math.floor(line)) : null }),
}))
